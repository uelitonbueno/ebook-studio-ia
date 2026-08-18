import { relations } from "drizzle-orm";
import { int, mediumtext, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const ebooks = mysqlTable("ebooks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  subtitle: text("subtitle"),
  idea: mediumtext("idea").notNull(),
  objective: mediumtext("objective"),
  referenceNotes: mediumtext("referenceNotes"),
  discoveryAnalysis: mediumtext("discoveryAnalysis"),
  positioning: text("positioning"),
  genre: varchar("genre", { length: 120 }),
  bookType: mysqlEnum("bookType", ["historybook", "coloring"]).default("historybook").notNull(),
  pageCount: int("pageCount").default(10).notNull(),
  tone: text("tone"),
  targetAudience: text("targetAudience"),
  visualStyle: text("visualStyle"),
  coverUrl: text("coverUrl"),
  imageGenerationRetryAfter: timestamp("imageGenerationRetryAfter"),
  status: mysqlEnum("status", ["draft", "generating", "ready"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const chapters = mysqlTable("chapters", {
  id: int("id").autoincrement().primaryKey(),
  ebookId: int("ebookId").notNull().references(() => ebooks.id, { onDelete: "cascade" }),
  position: int("position").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  summary: text("summary"),
  content: text("content"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const bookPages = mysqlTable("bookPages", {
  id: int("id").autoincrement().primaryKey(),
  ebookId: int("ebookId").notNull().references(() => ebooks.id, { onDelete: "cascade" }),
  position: int("position").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: mediumtext("content"),
  imagePrompt: text("imagePrompt").notNull(),
  imageUrl: text("imageUrl"),
  status: mysqlEnum("status", ["draft", "generating", "ready", "reviewed"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const ebookAssets = mysqlTable("ebookAssets", {
  id: int("id").autoincrement().primaryKey(),
  ebookId: int("ebookId").notNull().references(() => ebooks.id, { onDelete: "cascade" }),
  chapterId: int("chapterId").references(() => chapters.id, { onDelete: "set null" }),
  type: mysqlEnum("type", ["cover", "illustration"]).notNull(),
  prompt: text("prompt").notNull(),
  imageUrl: text("imageUrl").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const imageLibrary = mysqlTable("imageLibrary", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  storageKey: varchar("storageKey", { length: 1024 }).notNull(),
  imageUrl: text("imageUrl").notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  fileSize: int("fileSize").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const ebookExports = mysqlTable("ebookExports", {
  id: int("id").autoincrement().primaryKey(),
  ebookId: int("ebookId").notNull().references(() => ebooks.id, { onDelete: "cascade" }),
  format: mysqlEnum("format", ["pdf", "epub", "docx"]).notNull(),
  storageKey: varchar("storageKey", { length: 1024 }).notNull(),
  downloadUrl: text("downloadUrl").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({ ebooks: many(ebooks), imageLibrary: many(imageLibrary) }));
export const ebooksRelations = relations(ebooks, ({ one, many }) => ({
  user: one(users, { fields: [ebooks.userId], references: [users.id] }),
  chapters: many(chapters),
  pages: many(bookPages),
  assets: many(ebookAssets),
  exports: many(ebookExports),
}));
export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  ebook: one(ebooks, { fields: [chapters.ebookId], references: [ebooks.id] }),
  assets: many(ebookAssets),
}));
export const bookPagesRelations = relations(bookPages, ({ one }) => ({
  ebook: one(ebooks, { fields: [bookPages.ebookId], references: [ebooks.id] }),
}));
export const ebookAssetsRelations = relations(ebookAssets, ({ one }) => ({
  ebook: one(ebooks, { fields: [ebookAssets.ebookId], references: [ebooks.id] }),
  chapter: one(chapters, { fields: [ebookAssets.chapterId], references: [chapters.id] }),
}));
export const ebookExportsRelations = relations(ebookExports, ({ one }) => ({
  ebook: one(ebooks, { fields: [ebookExports.ebookId], references: [ebooks.id] }),
}));
export const imageLibraryRelations = relations(imageLibrary, ({ one }) => ({
  user: one(users, { fields: [imageLibrary.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Ebook = typeof ebooks.$inferSelect;
export type Chapter = typeof chapters.$inferSelect;
export type BookPage = typeof bookPages.$inferSelect;
export type EbookAsset = typeof ebookAssets.$inferSelect;
export type EbookExport = typeof ebookExports.$inferSelect;
export type ImageLibraryItem = typeof imageLibrary.$inferSelect;
