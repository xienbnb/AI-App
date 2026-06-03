import { pgTable, serial, timestamp, uuid, text, integer, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const books = pgTable("books", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull().default('default'),
	title: text().notNull().default(''),
	category: text().notNull().default(''),
	status: text().notNull().default('草稿'),
	cover: text().notNull().default('default'),
	coverImage: text("cover_image"),
	description: text().notNull().default(''),
	outline: text(),
	outlineAnalysis: text("outline_analysis"),
	outlineCharacters: jsonb("outline_characters").default('[]'),
	outlineWorldBuilding: text("outline_world_building"),
	volumes: jsonb().notNull().default('[]'),
	wordCount: integer("word_count").notNull().default(0),
	chapterCount: integer("chapter_count").notNull().default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const outlines = pgTable("outlines", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	bookId: uuid("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
	content: text().notNull().default(''),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	userId: text("user_id").notNull().default('default'),
});

export const userSettings = pgTable("user_settings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	bookId: uuid("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
	data: jsonb().notNull().default('[]'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const inspirations = pgTable("inspirations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	bookId: uuid("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
	data: jsonb().notNull().default('[]'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});