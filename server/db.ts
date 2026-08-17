import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  Chapter,
  BookPage,
  Ebook,
  EbookAsset,
  EbookExport,
  InsertUser,
  User,
  chapters,
  bookPages,
  ebookAssets,
  ebookExports,
  ebooks,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

function requireDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new Error("Database unavailable");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0] as User | undefined;
}

export type EbookDetails = {
  ebook: Ebook;
  chapters: Chapter[];
  pages: BookPage[];
  assets: EbookAsset[];
  exports: EbookExport[];
};

export type CreateEbookInput = {
  userId: number;
  title: string;
  idea: string;
  subtitle?: string;
  objective?: string;
  referenceNotes?: string;
  discoveryAnalysis?: string;
  genre?: string;
  bookType?: "historybook" | "coloring";
  pageCount?: number;
  tone?: string;
  targetAudience?: string;
  visualStyle?: string;
};

export async function listEbooksByUser(userId: number) {
  const db = requireDb(await getDb());
  return db.select().from(ebooks).where(eq(ebooks.userId, userId)).orderBy(desc(ebooks.updatedAt));
}

export async function createEbook(input: CreateEbookInput) {
  const db = requireDb(await getDb());
  const result = await db.insert(ebooks).values({
    ...input,
    subtitle: input.subtitle ?? null,
    objective: input.objective ?? null,
    referenceNotes: input.referenceNotes ?? null,
    discoveryAnalysis: input.discoveryAnalysis ?? null,
    genre: input.genre ?? null,
    bookType: input.bookType ?? "historybook",
    pageCount: input.pageCount ?? 10,
    tone: input.tone ?? null,
    targetAudience: input.targetAudience ?? null,
    visualStyle: input.visualStyle ?? "Editorial minimalista",
  });
  const id = Number(result[0].insertId);
  const created = await db.select().from(ebooks).where(eq(ebooks.id, id)).limit(1);
  return created[0] as Ebook;
}

export async function getEbookDetails(ebookId: number, userId: number): Promise<EbookDetails | null> {
  const db = requireDb(await getDb());
  const result = await db
    .select()
    .from(ebooks)
    .where(and(eq(ebooks.id, ebookId), eq(ebooks.userId, userId)))
    .limit(1);
  const ebook = result[0] as Ebook | undefined;
  if (!ebook) return null;

  const [chapterRows, pageRows, assetRows, exportRows] = await Promise.all([
    db.select().from(chapters).where(eq(chapters.ebookId, ebookId)).orderBy(asc(chapters.position)),
    db.select().from(bookPages).where(eq(bookPages.ebookId, ebookId)).orderBy(asc(bookPages.position)),
    db.select().from(ebookAssets).where(eq(ebookAssets.ebookId, ebookId)).orderBy(desc(ebookAssets.createdAt)),
    db.select().from(ebookExports).where(eq(ebookExports.ebookId, ebookId)).orderBy(desc(ebookExports.createdAt)),
  ]);
  return { ebook, chapters: chapterRows, pages: pageRows, assets: assetRows, exports: exportRows };
}

export async function updateEbook(
  ebookId: number,
  userId: number,
  input: Partial<Pick<Ebook, "title" | "subtitle" | "objective" | "referenceNotes" | "discoveryAnalysis" | "positioning" | "genre" | "bookType" | "pageCount" | "tone" | "targetAudience" | "visualStyle" | "coverUrl" | "status">>,
) {
  const db = requireDb(await getDb());
  await db.update(ebooks).set(input).where(and(eq(ebooks.id, ebookId), eq(ebooks.userId, userId)));
  return getEbookDetails(ebookId, userId);
}

export async function deleteEbook(ebookId: number, userId: number) {
  const db = requireDb(await getDb());
  await db.delete(ebooks).where(and(eq(ebooks.id, ebookId), eq(ebooks.userId, userId)));
}

export async function replaceChapters(
  ebookId: number,
  userId: number,
  drafts: Array<{ title: string; summary: string }>,
) {
  const db = requireDb(await getDb());
  const owned = await getEbookDetails(ebookId, userId);
  if (!owned) return null;
  await db.delete(chapters).where(eq(chapters.ebookId, ebookId));
  if (drafts.length) {
    await db.insert(chapters).values(drafts.map((chapter, index) => ({
      ebookId,
      position: index + 1,
      title: chapter.title,
      summary: chapter.summary,
      content: "",
    })));
  }
  return getEbookDetails(ebookId, userId);
}

export async function updateChapter(
  chapterId: number,
  ebookId: number,
  userId: number,
  input: Partial<Pick<Chapter, "title" | "summary" | "content">>,
) {
  const db = requireDb(await getDb());
  const owned = await getEbookDetails(ebookId, userId);
  if (!owned?.chapters.some(chapter => chapter.id === chapterId)) return null;
  await db.update(chapters).set(input).where(eq(chapters.id, chapterId));
  const result = await db.select().from(chapters).where(eq(chapters.id, chapterId)).limit(1);
  return result[0] as Chapter | undefined;
}

export async function replaceBookPages(ebookId: number, userId: number, drafts: Array<{ title: string; content?: string; imagePrompt: string }>) {
  const db = requireDb(await getDb());
  const owned = await getEbookDetails(ebookId, userId);
  if (!owned) return null;
  await db.delete(bookPages).where(eq(bookPages.ebookId, ebookId));
  if (drafts.length) {
    await db.insert(bookPages).values(drafts.map((page, index) => ({
      ebookId,
      position: index + 1,
      title: page.title,
      content: page.content ?? "",
      imagePrompt: page.imagePrompt,
      status: "draft" as const,
    })));
  }
  return getEbookDetails(ebookId, userId);
}

export async function updateBookPage(pageId: number, ebookId: number, userId: number, input: Partial<Pick<BookPage, "title" | "content" | "imagePrompt" | "imageUrl" | "status">>) {
  const db = requireDb(await getDb());
  const owned = await getEbookDetails(ebookId, userId);
  if (!owned?.pages.some(page => page.id === pageId)) return null;
  await db.update(bookPages).set(input).where(eq(bookPages.id, pageId));
  const result = await db.select().from(bookPages).where(eq(bookPages.id, pageId)).limit(1);
  return result[0] as BookPage | undefined;
}

export async function createEbookAsset(input: {
  ebookId: number;
  chapterId?: number;
  type: "cover" | "illustration";
  prompt: string;
  imageUrl: string;
}) {
  const db = requireDb(await getDb());
  const result = await db.insert(ebookAssets).values({ ...input, chapterId: input.chapterId ?? null });
  const id = Number(result[0].insertId);
  const created = await db.select().from(ebookAssets).where(eq(ebookAssets.id, id)).limit(1);
  return created[0] as EbookAsset;
}

export async function createEbookExport(input: {
  ebookId: number;
  format: "pdf" | "epub" | "docx";
  storageKey: string;
  downloadUrl: string;
}) {
  const db = requireDb(await getDb());
  const result = await db.insert(ebookExports).values(input);
  const id = Number(result[0].insertId);
  const created = await db.select().from(ebookExports).where(eq(ebookExports.id, id)).limit(1);
  return created[0] as EbookExport;
}
