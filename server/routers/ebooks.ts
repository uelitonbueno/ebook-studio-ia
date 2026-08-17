import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createEbookAsset, createEbookExport, createEbook, deleteEbook, getEbookDetails, listEbooksByUser, replaceBookPages, replaceChapters, updateBookPage, updateChapter, updateEbook } from "../db";
import { bookPlanSchema, buildBookPlanPrompt, buildChapterPrompt, buildDiscoveryPrompt, buildOutlinePrompt, buildPageImagePrompt, buildRewritePrompt, discoverySchema, outlineSchema } from "../ebookRules";
import { buildEbookExportBuffer, EbookExportFormat } from "../exporters";
import { generateImage } from "../_core/imageGeneration";
import { invokeLLM, listLLMModels } from "../_core/llm";
import { protectedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { getImageGenerationRetryAfter, isImageGenerationBlocked, isImageGenerationUnavailable, restorePageStatusAfterImageFailure } from "../imageGenerationState";

const projectInput = z.object({
  idea: z.string().min(12, "Descreva um pouco mais a sua ideia.").max(30000),
  title: z.string().min(2).max(255).optional(),
  genre: z.string().max(120).optional(),
  tone: z.string().max(5000).optional(),
  targetAudience: z.string().max(30000).optional(),
  visualStyle: z.string().max(30000).optional(),
  objective: z.string().max(30000).optional(),
  referenceNotes: z.string().max(30000).optional(),
  discoveryAnalysis: z.string().max(30000).optional(),
  bookType: z.enum(["historybook", "coloring"]).default("historybook"),
  pageCount: z.number().int().min(4).max(24).default(10),
});

const discoveryInput = projectInput.pick({ idea: true, genre: true, tone: true, targetAudience: true, visualStyle: true, objective: true, referenceNotes: true });

function safeFilename(value: string) {
  return value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "ebook";
}

async function selectWritingModel() {
  const { data } = await listLLMModels();
  return data.find(model => model.id === "gpt-5-mini")?.id ?? data[0]?.id;
}

async function getOwnedEbook(ebookId: number, userId: number) {
  const project = await getEbookDetails(ebookId, userId);
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Projeto não encontrado." });
  return project;
}

const outlineResponseFormat = {
  type: "json_schema" as const,
  json_schema: {
    name: "ebook_outline",
    strict: true,
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        subtitle: { type: "string" },
        positioning: { type: "string" },
        genre: { type: "string" },
        tone: { type: "string" },
        targetAudience: { type: "string" },
        chapters: {
          type: "array",
          items: {
            type: "object",
            properties: { title: { type: "string" }, summary: { type: "string" } },
            required: ["title", "summary"],
            additionalProperties: false,
          },
        },
      },
      required: ["title", "subtitle", "positioning", "genre", "tone", "targetAudience", "chapters"],
      additionalProperties: false,
    },
  },
};

const discoveryResponseFormat = {
  type: "json_schema" as const,
  json_schema: {
    name: "book_discovery",
    strict: true,
    schema: {
      type: "object",
      properties: {
        editorialSummary: { type: "string" },
        refinedIdea: { type: "string" },
        suggestedAudience: { type: "string" },
        suggestedTone: { type: "string" },
        suggestedVisualStyle: { type: "string" },
        intentions: { type: "array", items: { type: "string" } },
        themes: { type: "array", items: { type: "string" } },
        titleSuggestions: { type: "array", items: { type: "object", properties: { title: { type: "string" }, subtitle: { type: "string" }, rationale: { type: "string" } }, required: ["title", "subtitle", "rationale"], additionalProperties: false } },
        structureSuggestions: { type: "array", items: { type: "object", properties: { title: { type: "string" }, purpose: { type: "string" } }, required: ["title", "purpose"], additionalProperties: false } },
        coverDirections: { type: "array", items: { type: "string" } },
        illustrationDirections: { type: "array", items: { type: "string" } },
        keywords: { type: "array", items: { type: "string" } },
      },
      required: ["editorialSummary", "refinedIdea", "suggestedAudience", "suggestedTone", "suggestedVisualStyle", "intentions", "themes", "titleSuggestions", "structureSuggestions", "coverDirections", "illustrationDirections", "keywords"],
      additionalProperties: false,
    },
  },
};

const bookPlanResponseFormat = {
  type: "json_schema" as const,
  json_schema: {
    name: "book_page_plan",
    strict: true,
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        subtitle: { type: "string" },
        positioning: { type: "string" },
        pages: { type: "array", items: { type: "object", properties: { title: { type: "string" }, content: { type: "string" }, imagePrompt: { type: "string" } }, required: ["title", "content", "imagePrompt"], additionalProperties: false } },
      },
      required: ["title", "subtitle", "positioning", "pages"],
      additionalProperties: false,
    },
  },
};

export const ebookRouter = router({
  list: protectedProcedure.query(({ ctx }) => listEbooksByUser(ctx.user.id)),

  get: protectedProcedure.input(z.object({ ebookId: z.number().int().positive() })).query(({ ctx, input }) => getOwnedEbook(input.ebookId, ctx.user.id)),

  create: protectedProcedure.input(projectInput).mutation(async ({ ctx, input }) => {
    const suggestedTitle = input.title?.trim() || input.idea.trim().split(/[.!?]/)[0].slice(0, 72) || "Novo e-book";
    return createEbook({ userId: ctx.user.id, ...input, title: suggestedTitle });
  }),

  analyzeDiscovery: protectedProcedure.input(discoveryInput).mutation(async ({ input }) => {
    const model = await selectWritingModel();
    const result = await invokeLLM({
      model,
      messages: [
        { role: "system", content: "Você é uma editora cristã brasileira experiente. Analise briefings extensos com cuidado, respeite a fé cristã apresentada pelo autor e proponha conteúdo original, útil e publicável. Não imite autores, não use trechos protegidos e não invente citações ou fatos bíblicos." },
        { role: "user", content: buildDiscoveryPrompt(input) },
      ],
      response_format: discoveryResponseFormat,
    });
    const raw = result.choices[0]?.message.content;
    try {
      return discoverySchema.parse(JSON.parse(typeof raw === "string" ? raw : "{}"));
    } catch {
      throw new TRPCError({ code: "BAD_GATEWAY", message: "A IA devolveu uma sugestão em formato inesperado. Tente analisar o briefing novamente." });
    }
  }),

  update: protectedProcedure.input(z.object({
    ebookId: z.number().int().positive(),
    title: z.string().min(2).max(255).optional(),
    subtitle: z.string().max(500).nullable().optional(),
    genre: z.string().max(120).nullable().optional(),
    tone: z.string().max(120).nullable().optional(),
    targetAudience: z.string().max(255).nullable().optional(),
    visualStyle: z.string().max(160).nullable().optional(),
  })).mutation(async ({ ctx, input }) => {
    const { ebookId, ...changes } = input;
    await getOwnedEbook(ebookId, ctx.user.id);
    return updateEbook(ebookId, ctx.user.id, changes);
  }),

  remove: protectedProcedure.input(z.object({ ebookId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await getOwnedEbook(input.ebookId, ctx.user.id);
    await deleteEbook(input.ebookId, ctx.user.id);
    return { success: true };
  }),

  generateOutline: protectedProcedure.input(z.object({ ebookId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const project = await getOwnedEbook(input.ebookId, ctx.user.id);
    await updateEbook(input.ebookId, ctx.user.id, { status: "generating" });
    try {
      const model = await selectWritingModel();
      const result = await invokeLLM({
        model,
        messages: [
          { role: "system", content: "Você é uma editora brasileira experiente. Crie projetos de e-book originais, úteis e éticos. Não imite autores vivos, não use personagens ou trechos protegidos e escreva em português brasileiro. Retorne somente o JSON solicitado." },
          { role: "user", content: buildOutlinePrompt(project.ebook) },
        ],
        response_format: outlineResponseFormat,
      });
      const raw = result.choices[0]?.message.content;
      let outline: z.infer<typeof outlineSchema>;
      try {
        outline = outlineSchema.parse(JSON.parse(typeof raw === "string" ? raw : "{}"));
      } catch {
        throw new TRPCError({ code: "BAD_GATEWAY", message: "A IA gerou uma estrutura extensa demais para validar agora. Tente gerar a estrutura novamente." });
      }
      await updateEbook(input.ebookId, ctx.user.id, {
        title: outline.title,
        subtitle: outline.subtitle,
        positioning: outline.positioning,
        genre: outline.genre,
        tone: outline.tone,
        targetAudience: outline.targetAudience,
        status: "ready",
      });
      await replaceChapters(input.ebookId, ctx.user.id, outline.chapters);
      return getOwnedEbook(input.ebookId, ctx.user.id);
    } catch (error) {
      await updateEbook(input.ebookId, ctx.user.id, { status: "draft" });
      throw error;
    }
  }),

  generateBookPages: protectedProcedure.input(z.object({ ebookId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const project = await getOwnedEbook(input.ebookId, ctx.user.id);
    await updateEbook(input.ebookId, ctx.user.id, { status: "generating" });
    try {
      const model = await selectWritingModel();
      const result = await invokeLLM({
        model,
        messages: [
          { role: "system", content: "Você é uma editora brasileira especializada em livros cristãos para crianças. Crie somente material original, culturalmente respeitoso e seguro para crianças. Retorne exclusivamente o JSON solicitado." },
          { role: "user", content: buildBookPlanPrompt(project.ebook) },
        ],
        response_format: bookPlanResponseFormat,
      });
      const raw = result.choices[0]?.message.content;
      const plan = bookPlanSchema.parse(JSON.parse(typeof raw === "string" ? raw : "{}"));
      if (plan.pages.length < project.ebook.pageCount) throw new TRPCError({ code: "BAD_GATEWAY", message: "A IA não conseguiu preparar todas as páginas. Tente gerar o livro novamente." });
      const pages = plan.pages.slice(0, project.ebook.pageCount).map(page => ({ ...page, content: project.ebook.bookType === "coloring" ? "" : page.content }));
      await updateEbook(input.ebookId, ctx.user.id, { title: plan.title, subtitle: plan.subtitle, positioning: plan.positioning, status: "ready" });
      await replaceBookPages(input.ebookId, ctx.user.id, pages);
      return getOwnedEbook(input.ebookId, ctx.user.id);
    } catch (error) {
      await updateEbook(input.ebookId, ctx.user.id, { status: "draft" });
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "BAD_GATEWAY", message: "Não foi possível montar o livro agora. Tente novamente em instantes." });
    }
  }),

  updateBookPage: protectedProcedure.input(z.object({
    ebookId: z.number().int().positive(),
    pageId: z.number().int().positive(),
    title: z.string().min(2).max(255).optional(),
    content: z.string().max(100000).nullable().optional(),
    imagePrompt: z.string().min(20).max(6000).optional(),
    status: z.enum(["draft", "generating", "ready", "reviewed"]).optional(),
  })).mutation(async ({ ctx, input }) => {
    const { ebookId, pageId, ...changes } = input;
    const page = await updateBookPage(pageId, ebookId, ctx.user.id, changes);
    if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "Página não encontrada." });
    return page;
  }),

  generatePageImage: protectedProcedure.input(z.object({ ebookId: z.number().int().positive(), pageId: z.number().int().positive(), direction: z.string().max(6000).optional(), variation: z.string().max(200).optional() })).mutation(async ({ ctx, input }) => {
    const project = await getOwnedEbook(input.ebookId, ctx.user.id);
    const page = project.pages.find(item => item.id === input.pageId);
    if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "Página não encontrada." });
    if (isImageGenerationBlocked(project.ebook.imageGenerationRetryAfter)) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A geração de imagens está indisponível para esta conta no momento. Tente novamente mais tarde." });
    }
    await updateBookPage(page.id, input.ebookId, ctx.user.id, { status: "generating" });
    const prompt = `${buildPageImagePrompt(project.ebook, page)} Direção adicional do autor: ${input.direction ?? "seguir o conteúdo e a proposta visual da página"}.${input.variation ? ` Crie uma nova composição visual, distinta das tentativas anteriores. Variação: ${input.variation}.` : ""}`;
    try {
      const generated = await generateImage({ prompt, quality: "medium" });
      if (!generated.url) throw new Error("Imagem ausente");
      await updateEbook(input.ebookId, ctx.user.id, { imageGenerationRetryAfter: null });
      return await updateBookPage(page.id, input.ebookId, ctx.user.id, { imageUrl: generated.url, status: "ready", imagePrompt: input.direction?.trim() || page.imagePrompt });
    } catch (error) {
      console.error("[Ebook] Falha ao gerar imagem de página", { ebookId: input.ebookId, pageId: input.pageId, error });
      await updateBookPage(page.id, input.ebookId, ctx.user.id, { status: restorePageStatusAfterImageFailure(page.status) });
      if (isImageGenerationUnavailable(error)) {
        await updateEbook(input.ebookId, ctx.user.id, { imageGenerationRetryAfter: getImageGenerationRetryAfter() });
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A geração de imagens está indisponível para esta conta no momento. Tente novamente mais tarde." });
      }
      throw new TRPCError({ code: "BAD_GATEWAY", message: "Não foi possível gerar a imagem desta página. Tente novamente." });
    }
  }),

  generateChapter: protectedProcedure.input(z.object({ ebookId: z.number().int().positive(), chapterId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const project = await getOwnedEbook(input.ebookId, ctx.user.id);
    const chapter = project.chapters.find(item => item.id === input.chapterId);
    if (!chapter) throw new TRPCError({ code: "NOT_FOUND", message: "Capítulo não encontrado." });
    const model = await selectWritingModel();
    const result = await invokeLLM({
      model,
      messages: [
        { role: "system", content: "Você é uma autora brasileira de não ficção e ficção comercial. Produza texto original em português brasileiro, claro, coeso e publicável. Não copie nem imite autores, obras ou personagens existentes. Use títulos e subtítulos simples quando ajudarem a leitura." },
        { role: "user", content: buildChapterPrompt(project.ebook, chapter) },
      ],
    });
    const raw = result.choices[0]?.message.content;
    const content = typeof raw === "string" ? raw.trim() : "";
    if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "A IA não retornou conteúdo para este capítulo." });
    return updateChapter(chapter.id, input.ebookId, ctx.user.id, { content });
  }),

  rewriteChapter: protectedProcedure.input(z.object({
    ebookId: z.number().int().positive(),
    chapterId: z.number().int().positive(),
    instruction: z.string().min(8, "Diga como deseja aprimorar o capítulo.").max(1200),
  })).mutation(async ({ ctx, input }) => {
    const project = await getOwnedEbook(input.ebookId, ctx.user.id);
    const chapter = project.chapters.find(item => item.id === input.chapterId);
    if (!chapter) throw new TRPCError({ code: "NOT_FOUND", message: "Capítulo não encontrado." });
    if (!chapter.content?.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "Gere ou escreva o capítulo antes de pedir uma reescrita." });
    const model = await selectWritingModel();
    const result = await invokeLLM({
      model,
      messages: [
        { role: "system", content: "Você é uma editora brasileira. Reescreva somente o texto recebido em português brasileiro, preservando fatos, intenção e a voz do autor quando possível. Não cite esta instrução e não imite autores ou obras existentes. Retorne apenas o capítulo revisado." },
        { role: "user", content: buildRewritePrompt(project.ebook, { title: chapter.title, content: chapter.content }, input.instruction) },
      ],
    });
    const raw = result.choices[0]?.message.content;
    const content = typeof raw === "string" ? raw.trim() : "";
    if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "A IA não retornou uma nova versão para este capítulo." });
    return updateChapter(chapter.id, input.ebookId, ctx.user.id, { content });
  }),

  updateChapter: protectedProcedure.input(z.object({
    ebookId: z.number().int().positive(),
    chapterId: z.number().int().positive(),
    title: z.string().min(2).max(255).optional(),
    summary: z.string().max(6000).nullable().optional(),
    content: z.string().max(100000).nullable().optional(),
  })).mutation(async ({ ctx, input }) => {
    const { ebookId, chapterId, ...changes } = input;
    const chapter = await updateChapter(chapterId, ebookId, ctx.user.id, changes);
    if (!chapter) throw new TRPCError({ code: "NOT_FOUND", message: "Capítulo não encontrado." });
    return chapter;
  }),

  generateArtwork: protectedProcedure.input(z.object({
    ebookId: z.number().int().positive(),
    type: z.enum(["cover", "illustration"]),
    chapterId: z.number().int().positive().optional(),
    direction: z.string().max(800).optional(),
  })).mutation(async ({ ctx, input }) => {
    const project = await getOwnedEbook(input.ebookId, ctx.user.id);
    const selectedChapter = input.chapterId ? project.chapters.find(chapter => chapter.id === input.chapterId) : undefined;
    if (input.chapterId && !selectedChapter) throw new TRPCError({ code: "NOT_FOUND", message: "Capítulo não encontrado." });
    const savedDiscovery = (() => {
      try { return project.ebook.discoveryAnalysis ? discoverySchema.parse(JSON.parse(project.ebook.discoveryAnalysis)) : null; } catch { return null; }
    })();
    const suggestedDirection = input.type === "cover" ? savedDiscovery?.coverDirections[0] : savedDiscovery?.illustrationDirections[0];
    const prompt = input.type === "cover"
      ? `Capa editorial de e-book para uma obra com o conceito: ${project.ebook.idea}. Estilo visual: ${project.ebook.visualStyle ?? "minimalismo escandinavo, formas geométricas em azul pastel e rosa blush"}. Composição sofisticada, espaço negativo, aparência de capa de livraria contemporânea, sem palavras, sem letras, sem marcas, sem logotipos. Direção adicional: ${input.direction ?? suggestedDirection ?? "equilíbrio entre clareza e impacto"}.`
      : `Ilustração editorial interna para o capítulo "${selectedChapter?.title ?? "do e-book"}" de uma obra sobre ${project.ebook.idea}. Resumo: ${selectedChapter?.summary ?? "crie uma imagem conceitual"}. Estilo: ${project.ebook.visualStyle ?? "minimalismo escandinavo, formas geométricas em azul pastel e rosa blush"}. Sem palavras, sem letras, sem marcas, sem logotipos. Direção adicional: ${input.direction ?? suggestedDirection ?? "delicada e conceitual"}.`;
    const generated = await generateImage({ prompt, quality: "high" });
    if (!generated.url) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível gerar a imagem agora." });
    const url = generated.url;
    const asset = await createEbookAsset({ ebookId: input.ebookId, chapterId: input.chapterId, type: input.type, prompt, imageUrl: url });
    if (input.type === "cover") await updateEbook(input.ebookId, ctx.user.id, { coverUrl: url });
    return asset;
  }),

  export: protectedProcedure.input(z.object({ ebookId: z.number().int().positive(), format: z.enum(["pdf", "epub", "docx"]) })).mutation(async ({ ctx, input }) => {
    const project = await getOwnedEbook(input.ebookId, ctx.user.id);
    const publishablePages = project.pages.length ? project.pages : project.chapters;
    if (!publishablePages.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Gere as páginas ou a estrutura do livro antes de exportar." });
    const buffer = await buildEbookExportBuffer(input.format as EbookExportFormat, project.ebook, publishablePages);
    const mimeTypes = { pdf: "application/pdf", epub: "application/epub+zip", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
    const { key, url } = await storagePut(`ebooks/${ctx.user.id}/exports/${safeFilename(project.ebook.title)}.${input.format}`, buffer, mimeTypes[input.format]);
    return createEbookExport({ ebookId: input.ebookId, format: input.format, storageKey: key, downloadUrl: url });
  }),
});
