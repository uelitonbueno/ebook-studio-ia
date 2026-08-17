import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    createEbookAsset: vi.fn(), createEbookExport: vi.fn(), createEbook: vi.fn(), deleteEbook: vi.fn(),
    getEbookDetails: vi.fn(), listEbooksByUser: vi.fn(), replaceBookPages: vi.fn(), replaceChapters: vi.fn(),
    updateBookPage: vi.fn(), updateChapter: vi.fn(), updateEbook: vi.fn(),
  },
  imageGeneration: { generateImage: vi.fn() },
}));

vi.mock("./db", () => mocks.db);
vi.mock("./_core/imageGeneration", () => mocks.imageGeneration);
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn(), listLLMModels: vi.fn() }));
vi.mock("./storage", () => ({ storagePut: vi.fn() }));

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
