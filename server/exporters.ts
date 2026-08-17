import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import JSZip from "jszip";
import PDFDocument from "pdfkit";

export type ExportableEbook = {
  title: string;
  subtitle: string | null;
  genre: string | null;
  targetAudience: string | null;
};

export type ExportableChapter = {
  position: number;
  title: string;
  content: string | null;
};

export type EbookExportFormat = "pdf" | "epub" | "docx";

const cleanText = (value: string | null | undefined) => (value ?? "").replace(/\r/g, "").trim();
const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const slugify = (value: string) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "ebook";

function contentParagraphs(content: string | null | undefined) {
  const normalized = cleanText(content)
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|h[1-6]|li|blockquote)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"");
  return normalized
    .split(/\n\s*\n/)
    .map(part => part.replace(/^#{1,6}\s+/gm, "").replace(/\*\*(.*?)\*\*/g, "$1").trim())
    .filter(Boolean);
}

function chapterXhtml(chapter: ExportableChapter) {
  const blocks = contentParagraphs(chapter.content).map(block => `<p>${escapeXml(block).replace(/\n/g, "<br/>")}</p>`).join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="pt-BR"><head><title>${escapeXml(chapter.title)}</title><link rel="stylesheet" type="text/css" href="styles.css" /></head><body><section><h1>${escapeXml(chapter.title)}</h1>${blocks || "<p>Conteúdo em desenvolvimento.</p>"}</section></body></html>`;
}

export async function buildDocxBuffer(ebook: ExportableEbook, chapterList: ExportableChapter[]) {
  const content: Paragraph[] = [
    new Paragraph({ text: ebook.title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 280 } }),
    ...(ebook.subtitle ? [new Paragraph({ text: ebook.subtitle, alignment: AlignmentType.CENTER, spacing: { after: 720 } })] : []),
    new Paragraph({ text: "", pageBreakBefore: true }),
    new Paragraph({ text: "Sumário", heading: HeadingLevel.HEADING_1 }),
    ...chapterList.map(chapter => new Paragraph({ text: `${chapter.position}. ${chapter.title}`, spacing: { after: 120 } })),
  ];

  for (const chapter of chapterList) {
    content.push(new Paragraph({ text: "", pageBreakBefore: true }));
    content.push(new Paragraph({ text: `${chapter.position}. ${chapter.title}`, heading: HeadingLevel.HEADING_1 }));
    for (const block of contentParagraphs(chapter.content)) {
      content.push(new Paragraph({ children: [new TextRun(block)], spacing: { after: 180 }, alignment: AlignmentType.JUSTIFIED }));
    }
  }

  const document = new Document({ sections: [{ children: content }] });
  return Packer.toBuffer(document);
}

export async function buildEpubBuffer(ebook: ExportableEbook, chapterList: ExportableChapter[]) {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  zip.file("OEBPS/styles.css", "body{font-family:Georgia,serif;line-height:1.55;margin:6%;color:#151719}h1{font-family:Arial,sans-serif;font-size:1.7em;margin:0 0 1em}p{margin:0 0 1em}");
  zip.file("OEBPS/nav.xhtml", `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Sumário</title></head><body><nav epub:type="toc"><h1>Sumário</h1><ol>${chapterList.map(chapter => `<li><a href="chapter-${chapter.position}.xhtml">${escapeXml(chapter.title)}</a></li>`).join("")}</ol></nav></body></html>`);
  zip.file("OEBPS/title.xhtml", `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeXml(ebook.title)}</title><link rel="stylesheet" type="text/css" href="styles.css" /></head><body><h1>${escapeXml(ebook.title)}</h1>${ebook.subtitle ? `<p>${escapeXml(ebook.subtitle)}</p>` : ""}</body></html>`);
  for (const chapter of chapterList) zip.file(`OEBPS/chapter-${chapter.position}.xhtml`, chapterXhtml(chapter));

  const manifest = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="style" href="styles.css" media-type="text/css"/>',
    '<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>',
    ...chapterList.map(chapter => `<item id="c${chapter.position}" href="chapter-${chapter.position}.xhtml" media-type="application/xhtml+xml"/>`),
  ].join("");
  const spine = ["<itemref idref=\"title\"/>", ...chapterList.map(chapter => `<itemref idref="c${chapter.position}"/>`)].join("");
  const identifier = `urn:ebook-studio:${slugify(ebook.title)}`;
  zip.file("OEBPS/content.opf", `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="pt-BR"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">${escapeXml(identifier)}</dc:identifier><dc:title>${escapeXml(ebook.title)}</dc:title><dc:language>pt-BR</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}</meta></metadata><manifest>${manifest}</manifest><spine>${spine}</spine></package>`);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export async function buildPdfBuffer(ebook: ExportableEbook, chapterList: ExportableChapter[]) {
  return new Promise<Buffer>((resolve, reject) => {
    const document = new PDFDocument({ size: "A4", margin: 58, info: { Title: ebook.title, Author: "Ebook Studio IA" } });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));

    document.fillColor("#101314").font("Helvetica-Bold").fontSize(32).text(ebook.title, { align: "center" });
    if (ebook.subtitle) document.moveDown(0.8).font("Helvetica").fontSize(14).fillColor("#52585c").text(ebook.subtitle, { align: "center" });
    document.moveDown(12).font("Helvetica").fontSize(9).fillColor("#8a9194").text("Criado no Ebook Studio IA", { align: "center" });

    document.addPage();
    document.fillColor("#101314").font("Helvetica-Bold").fontSize(22).text("Sumário");
    document.moveDown();
    chapterList.forEach(chapter => document.font("Helvetica").fontSize(12).fillColor("#343a3d").text(`${chapter.position}. ${chapter.title}`, { indent: 8, lineGap: 6 }));

    for (const chapter of chapterList) {
      document.addPage();
      document.fillColor("#101314").font("Helvetica-Bold").fontSize(22).text(`${chapter.position}. ${chapter.title}`);
      document.moveDown(1.3);
      const blocks = contentParagraphs(chapter.content);
      if (!blocks.length) document.font("Helvetica").fontSize(11).fillColor("#5a6064").text("Conteúdo em desenvolvimento.", { lineGap: 6 });
      for (const block of blocks) {
        document.font("Helvetica").fontSize(11).fillColor("#252a2d").text(block, { align: "justify", lineGap: 5, paragraphGap: 12 });
        document.moveDown(0.7);
      }
    }
    document.end();
  });
}

export async function buildEbookExportBuffer(format: EbookExportFormat, ebook: ExportableEbook, chapterList: ExportableChapter[]) {
  if (format === "pdf") return buildPdfBuffer(ebook, chapterList);
  if (format === "epub") return buildEpubBuffer(ebook, chapterList);
  return buildDocxBuffer(ebook, chapterList);
}
