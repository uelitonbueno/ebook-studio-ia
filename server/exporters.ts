import { AlignmentType, Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } from "docx";
import JSZip from "jszip";
import PDFDocument from "pdfkit";

export type ExportableEbook = { title: string; subtitle: string | null; genre: string | null; targetAudience: string | null; bookType?: "historybook" | "coloring" };
export type ExportablePage = { position: number; title: string; content: string | null; imageUrl?: string | null };
export type ExportableChapter = ExportablePage;
export type EbookExportFormat = "pdf" | "epub" | "docx";

const cleanText = (value: string | null | undefined) => (value ?? "").replace(/\r/g, "").trim();
const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const slugify = (value: string) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "ebook";

function contentParagraphs(content: string | null | undefined) {
  const normalized = cleanText(content).replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/(?:p|div|h[1-6]|li|blockquote)>/gi, "\n\n").replace(/<li[^>]*>/gi, "• ").replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, "\"");
  return normalized.split(/\n\s*\n/).map(part => part.replace(/^#{1,6}\s+/gm, "").replace(/\*\*(.*?)\*\*/g, "$1").trim()).filter(Boolean);
}

async function remoteImage(url?: string | null) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch { return null; }
}

function pageXhtml(page: ExportablePage, imagePath?: string) {
  const blocks = contentParagraphs(page.content).map(block => `<p>${escapeXml(block).replace(/\n/g, "<br/>")}</p>`).join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="pt-BR"><head><title>${escapeXml(page.title)}</title><link rel="stylesheet" type="text/css" href="styles.css" /></head><body><section><h1>${escapeXml(page.title)}</h1>${imagePath ? `<img class="page-image" src="${imagePath}" alt="${escapeXml(page.title)}" />` : ""}${blocks}</section></body></html>`;
}

export async function buildDocxBuffer(ebook: ExportableEbook, pages: ExportablePage[]) {
  const content: Paragraph[] = [new Paragraph({ text: ebook.title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 280 } }), ...(ebook.subtitle ? [new Paragraph({ text: ebook.subtitle, alignment: AlignmentType.CENTER, spacing: { after: 720 } })] : []), new Paragraph({ text: "", pageBreakBefore: true }), new Paragraph({ text: "Páginas", heading: HeadingLevel.HEADING_1 }), ...pages.map(page => new Paragraph({ text: `${page.position}. ${page.title}`, spacing: { after: 120 } }))];
  for (const page of pages) {
    content.push(new Paragraph({ text: "", pageBreakBefore: true }));
    content.push(new Paragraph({ text: `${page.position}. ${page.title}`, heading: HeadingLevel.HEADING_1 }));
    const image = await remoteImage(page.imageUrl);
    if (image) content.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: image, type: "png", transformation: { width: 460, height: 300 } })] }));
    const blocks = contentParagraphs(page.content);
    if (!blocks.length && ebook.bookType === "coloring") content.push(new Paragraph({ text: page.title, alignment: AlignmentType.CENTER, spacing: { before: 180 } }));
    for (const block of blocks) content.push(new Paragraph({ children: [new TextRun(block)], spacing: { after: 180 }, alignment: AlignmentType.JUSTIFIED }));
  }
  return Packer.toBuffer(new Document({ sections: [{ children: content }] }));
}

export async function buildEpubBuffer(ebook: ExportableEbook, pages: ExportablePage[]) {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  zip.file("OEBPS/styles.css", "body{font-family:Georgia,serif;line-height:1.55;margin:6%;color:#151719}h1{font-family:Arial,sans-serif;font-size:1.7em;margin:0 0 1em}p{margin:0 0 1em}.page-image{display:block;max-width:100%;margin:0 auto 1.5em}");
  const imageEntries = await Promise.all(pages.map(async page => ({ position: page.position, data: await remoteImage(page.imageUrl) })));
  const imageSet = new Set(imageEntries.filter(entry => entry.data).map(entry => entry.position));
  for (const image of imageEntries) if (image.data) zip.file(`OEBPS/images/page-${image.position}.png`, image.data);
  zip.file("OEBPS/nav.xhtml", `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Páginas</title></head><body><nav epub:type="toc"><h1>Páginas</h1><ol>${pages.map(page => `<li><a href="page-${page.position}.xhtml">${escapeXml(page.title)}</a></li>`).join("")}</ol></nav></body></html>`);
  zip.file("OEBPS/title.xhtml", `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeXml(ebook.title)}</title><link rel="stylesheet" type="text/css" href="styles.css" /></head><body><h1>${escapeXml(ebook.title)}</h1>${ebook.subtitle ? `<p>${escapeXml(ebook.subtitle)}</p>` : ""}</body></html>`);
  for (const page of pages) zip.file(`OEBPS/page-${page.position}.xhtml`, pageXhtml(page, imageSet.has(page.position) ? `images/page-${page.position}.png` : undefined));
  const manifest = ["<item id=\"nav\" href=\"nav.xhtml\" media-type=\"application/xhtml+xml\" properties=\"nav\"/>", "<item id=\"style\" href=\"styles.css\" media-type=\"text/css\"/>", "<item id=\"title\" href=\"title.xhtml\" media-type=\"application/xhtml+xml\"/>", ...pages.map(page => `<item id="p${page.position}" href="page-${page.position}.xhtml" media-type="application/xhtml+xml"/>`), ...Array.from(imageSet).map(position => `<item id="img${position}" href="images/page-${position}.png" media-type="image/png"/>`)].join("");
  const spine = ["<itemref idref=\"title\"/>", ...pages.map(page => `<itemref idref="p${page.position}"/>`)].join("");
  const identifier = `urn:ebook-studio:${slugify(ebook.title)}`;
  zip.file("OEBPS/content.opf", `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="pt-BR"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">${escapeXml(identifier)}</dc:identifier><dc:title>${escapeXml(ebook.title)}</dc:title><dc:language>pt-BR</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}</meta></metadata><manifest>${manifest}</manifest><spine>${spine}</spine></package>`);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export async function buildPdfBuffer(ebook: ExportableEbook, pages: ExportablePage[]) {
  return new Promise<Buffer>(async (resolve, reject) => {
    const document = new PDFDocument({ size: "A4", margin: 58, info: { Title: ebook.title, Author: "Ebook Studio IA" } });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.fillColor("#29473a").font("Helvetica-Bold").fontSize(32).text(ebook.title, { align: "center" });
    if (ebook.subtitle) document.moveDown(0.8).font("Helvetica").fontSize(14).fillColor("#65736b").text(ebook.subtitle, { align: "center" });
    document.moveDown(12).font("Helvetica").fontSize(9).fillColor("#8a9194").text("Criado no Ebook Studio IA", { align: "center" });
    for (const page of pages) {
      document.addPage();
      document.fillColor("#29473a").font("Helvetica-Bold").fontSize(21).text(`${page.position}. ${page.title}`);
      document.moveDown(0.8);
      const image = await remoteImage(page.imageUrl);
      if (image) {
        try { document.image(image, { fit: [470, 410], align: "center", valign: "center" }); document.moveDown(1); } catch { /* export without image if source is unsupported */ }
      }
      const blocks = contentParagraphs(page.content);
      if (!blocks.length && ebook.bookType === "coloring") document.font("Helvetica").fontSize(12).fillColor("#525f57").text(page.title, { align: "center" });
      for (const block of blocks) { document.font("Helvetica").fontSize(11).fillColor("#252a2d").text(block, { align: "justify", lineGap: 5, paragraphGap: 12 }); document.moveDown(0.7); }
    }
    document.end();
  });
}

export async function buildEbookExportBuffer(format: EbookExportFormat, ebook: ExportableEbook, pages: ExportablePage[]) {
  if (format === "pdf") return buildPdfBuffer(ebook, pages);
  if (format === "epub") return buildEpubBuffer(ebook, pages);
  return buildDocxBuffer(ebook, pages);
}
