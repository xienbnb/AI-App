import { pgTable, serial, timestamp, uuid, text, integer, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull().unique(),
	nickname: text().notNull().default(''),
	avatar: text().default(''),
	bio: text().default(''),
	role: text().notNull().default('user'),
	penName: text("pen_name").default(''),
	gender: text().default(''),
	phone: text().default(''),
	realName: text("real_name").default(''),
	theme: text().default('system'),
	aiSettings: jsonb("ai_settings").default('{}'),
	consecutiveDays: integer("consecutive_days").default(0),
	todayWordCount: integer("today_word_count").default(0),
	lastActiveDate: text("last_active_date").default(''),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

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

export const posts = pgTable("posts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull().default('default'),
	userName: text("user_name").notNull().default('匿名用户'),
	title: text().notNull().default(''),
	content: text().notNull().default(''),
	tag: text().notNull().default('B 全部'),
	likes: integer("likes").notNull().default(0),
	comments: integer("comments").notNull().default(0),
	featured: integer("featured").notNull().default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const feedback = pgTable("feedback", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull().default(''),
	content: text().notNull().default(''),
	contact: text().default(''),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const follows = pgTable("follows", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	followerId: text("follower_id").notNull(),
	followingId: text("following_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});