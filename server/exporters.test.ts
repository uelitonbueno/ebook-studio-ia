import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildDocxBuffer, buildEpubBuffer, buildPdfBuffer } from "./exporters";

const ebook = { title: "Guia de Teste", subtitle: "Uma edição de demonstração", genre: "Educação", targetAudience: "Pessoas curiosas", bookType: "historybook" as const };
const chapters = [{ position: 1, title: "Começo", content: "<p>Primeiro parágrafo.</p><p>Segundo parágrafo.</p>" }];

describe("exportadores de e-book", () => {
  it("gera um PDF válido com conteúdo editorial", async () => {
    const buffer = await buildPdfBuffer(ebook, chapters);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(buffer.length).toBeGreaterThan(500);
  });

  it("gera um DOCX compactado", async () => {
    const buffer = await buildDocxBuffer(ebook, chapters);
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
    expect(buffer.length).toBeGreaterThan(500);
  });

  it("gera um EPUB com manifesto e página", async () => {
    const buffer = await buildEpubBuffer(ebook, chapters);
    const archive = await JSZip.loadAsync(buffer);
    expect(await archive.file("mimetype")?.async("string")).toBe("application/epub+zip");
    expect(archive.file("OEBPS/content.opf")).toBeTruthy();
    expect(archive.file("OEBPS/page-1.xhtml")).toBeTruthy();
    const chapter = await archive.file("OEBPS/page-1.xhtml")?.async("string");
    expect(chapter).toContain("Primeiro parágrafo.");
    expect(chapter).not.toContain("&lt;p&gt;");
  });
});
