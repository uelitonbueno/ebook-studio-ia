import { describe, expect, it } from "vitest";
import { decodeLibraryImageDataUrl, imageExtension } from "./imageLibraryRules";

describe("imageLibraryRules", () => {
  it("decodifica uma imagem PNG válida", () => {
    const data = decodeLibraryImageDataUrl("data:image/png;base64,aGVsbG8=", "image/png");
    expect(data.toString()).toBe("hello");
  });

  it("normaliza a extensão JPEG para jpg", () => {
    expect(imageExtension("image/jpeg")).toBe("jpg");
    expect(imageExtension("image/webp")).toBe("webp");
  });

  it("rejeita data URL com MIME diferente do informado", () => {
    expect(() => decodeLibraryImageDataUrl("data:image/svg+xml;base64,PHN2Zz4=", "image/png")).toThrow("inválido");
  });

  it("rejeita conteúdo vazio", () => {
    expect(() => decodeLibraryImageDataUrl("data:image/png;base64,", "image/png")).toThrow("12 MB");
  });
});
