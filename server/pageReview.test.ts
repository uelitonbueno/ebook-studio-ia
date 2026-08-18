import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    createEbookAsset: vi.fn(), createEbookExport: vi.fn(), createEbook: vi.fn(), createImageLibraryItem: vi.fn(), deleteEbook: vi.fn(),
    getEbookDetails: vi.fn(), getImageLibraryItem: vi.fn(), listImageLibraryByUser: vi.fn(), listEbooksByUser: vi.fn(), replaceBookPages: vi.fn(), replaceChapters: vi.fn(),
    updateBookPage: vi.fn(), updateChapter: vi.fn(), updateEbook: vi.fn(),
  },
  imageGeneration: { generateImage: vi.fn() },
  storage: { storagePut: vi.fn() },
}));

vi.mock("./db", () => mocks.db);
vi.mock("./_core/imageGeneration", () => mocks.imageGeneration);
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn(), listLLMModels: vi.fn() }));
vi.mock("./storage", () => mocks.storage);

import { appRouter } from "./routers";

const context = {
  user: { id: 1, openId: "test-user", name: "Teste", email: null, loginMethod: "manus", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: {} as never,
  res: {} as never,
};

describe("ebook.updateBookPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marca uma página como revisada e preserva o conteúdo editorial", async () => {
    mocks.db.updateBookPage.mockResolvedValue({ id: 41, ebookId: 7, title: "No princípio", content: "", imagePrompt: "Ilustração infantil em line art para colorir", status: "reviewed" });
    const result = await appRouter.createCaller(context).ebook.updateBookPage({
      ebookId: 7,
      pageId: 41,
      title: "No princípio",
      content: "",
      imagePrompt: "Ilustração infantil em line art para colorir",
      status: "reviewed",
    });

    expect(result?.status).toBe("reviewed");
    expect(mocks.db.updateBookPage).toHaveBeenCalledWith(41, 7, 1, expect.objectContaining({ status: "reviewed", title: "No princípio" }));
  });

  it("persiste e respeita o bloqueio após o provedor informar uso esgotado", async () => {
    const page = { id: 41, ebookId: 7, position: 1, title: "No princípio", content: "", imagePrompt: "Ilustração infantil em line art para colorir", imageUrl: null, status: "reviewed", updatedAt: new Date() };
    const project = {
      ebook: { id: 7, title: "Gênesis para colorir", idea: "Histórias bíblicas para crianças", bookType: "coloring", imageGenerationRetryAfter: null },
      pages: [page], chapters: [], assets: [], exports: [],
    };
    mocks.db.getEbookDetails.mockResolvedValue(project);
    mocks.imageGeneration.generateImage.mockRejectedValue(new Error("Image generation request failed: usage exhausted"));

    const caller = appRouter.createCaller(context);
    await expect(caller.ebook.generatePageImage({ ebookId: 7, pageId: 41 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    expect(mocks.db.updateBookPage).toHaveBeenCalledWith(41, 7, 1, { status: "reviewed" });
    expect(mocks.db.updateEbook).toHaveBeenCalledWith(7, 1, { imageGenerationRetryAfter: expect.any(Date) });

    mocks.imageGeneration.generateImage.mockClear();
    mocks.db.getEbookDetails.mockResolvedValue({ ...project, ebook: { ...project.ebook, imageGenerationRetryAfter: new Date(Date.now() + 60_000) } });

    await expect(caller.ebook.generatePageImage({ ebookId: 7, pageId: 41 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(mocks.imageGeneration.generateImage).not.toHaveBeenCalled();
  });
});

describe("ebook.imageLibrary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("faz upload, persiste a imagem e rejeita formato inválido", async () => {
    const stored = { key: "image-library/1/desenho_png.png", url: "/manus-storage/image-library/1/desenho_png.png" };
    const saved = { id: 9, userId: 1, name: "desenho.png", ...stored, mimeType: "image/png", fileSize: 75, createdAt: new Date() };
    mocks.storage.storagePut.mockResolvedValue(stored);
    mocks.db.createImageLibraryItem.mockResolvedValue(saved);
    const dataUrl = `data:image/png;base64,${"a".repeat(100)}`;

    const result = await appRouter.createCaller(context).ebook.uploadLibraryImage({ name: "desenho.png", mimeType: "image/png", dataUrl });

    expect(result).toEqual(saved);
    expect(mocks.storage.storagePut).toHaveBeenCalledWith(expect.stringContaining("image-library/1/"), expect.any(Buffer), "image/png");
    expect(mocks.db.createImageLibraryItem).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, imageUrl: stored.url, mimeType: "image/png" }));
    await expect(appRouter.createCaller(context).ebook.uploadLibraryImage({ name: "vetor.svg", mimeType: "image/svg+xml" as never, dataUrl })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("aplica a imagem selecionada à página correta e solicita nova revisão", async () => {
    const project = { ebook: { id: 7 }, pages: [{ id: 41 }], chapters: [], assets: [], exports: [] };
    const libraryImage = { id: 9, userId: 1, imageUrl: "/manus-storage/library.png" };
    const updated = { id: 41, ebookId: 7, imageUrl: libraryImage.imageUrl, status: "ready" };
    mocks.db.getEbookDetails.mockResolvedValue(project);
    mocks.db.getImageLibraryItem.mockResolvedValue(libraryImage);
    mocks.db.updateBookPage.mockResolvedValue(updated);

    const result = await appRouter.createCaller(context).ebook.applyLibraryImage({ ebookId: 7, pageId: 41, imageId: 9 });

    expect(result).toEqual(updated);
    expect(mocks.db.updateBookPage).toHaveBeenCalledWith(41, 7, 1, { imageUrl: libraryImage.imageUrl, status: "ready" });
  });
});

describe("ebook.uploadLibraryImage limites", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejeita payload de imagem acima de 12 MB", async () => {
    const oversizedDataUrl = `data:image/png;base64,${"a".repeat(16_800_000)}`;
    await expect(appRouter.createCaller(context).ebook.uploadLibraryImage({ name: "grande.png", mimeType: "image/png", dataUrl: oversizedDataUrl })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.storage.storagePut).not.toHaveBeenCalled();
  });
});
