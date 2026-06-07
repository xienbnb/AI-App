import { pgTable, serial, timestamp, uuid, text, integer, jsonb, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull().unique(),
	nickname: text().notNull().default(''),
	avatar: text().default(''),
	bio: text().default(''),
	role: text().notNull().default('user'),
	passwordHash: text("password_hash"),
	penName: text("pen_name").default(''),
	gender: text().default(''),
	phone: text().default(''),
	realName: text("real_name").default(''),
	theme: text().default('system'),
	aiSettings: jsonb("ai_settings").default('{}'),
	consecutiveDays: integer("consecutive_days").default(0),
	todayWordCount: integer("today_word_count").default(0),
	lastActiveDate: text("last_active_date").default(''),
	vipLevel: integer("vip_level").default(0),
	vipExpiresAt: text("vip_expires_at").default(''),
	dailyAiCount: integer("daily_ai_count").default(0),
	lastResetDate: text("last_reset_date").default(''),
	monthlyAiCount: integer("monthly_ai_count").default(0),
	lastMonthlyReset: text("last_monthly_reset").default(''),
	// 社交绑定字段
	wechatOpenid: text("wechat_openid").default(''),
	qqOpenid: text("qq_openid").default(''),
	wechatNickname: text("wechat_nickname").default(''),
	qqNickname: text("qq_nickname").default(''),
	emailVerified: boolean("email_verified").default(false),
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

export const comments = pgTable("comments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
	userId: text("user_id").notNull().default('default'),
	userName: text("user_name").notNull().default('匿名用户'),
	content: text().notNull().default(''),
	parentId: text("parent_id"),
	likes: integer("likes").notNull().default(0),
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

// ==================== Agent 对话系统 ====================

export const agentConversations = pgTable("agent_conversations", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull().default(''),
	title: text("title").notNull().default('新对话'),
	messages: jsonb("messages").notNull().default('[]'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const follows = pgTable("follows", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	followerId: text("follower_id").notNull(),
	followingId: text("following_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const postLikes = pgTable("post_likes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
	userId: text("user_id").notNull().default('default'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

// ==================== VIP & 权限系统 ====================

export const userVips = pgTable("user_vips", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	planType: text("plan_type").notNull().default('free'),
	status: text("status").notNull().default('active'),
	startDate: timestamp("start_date", { withTimezone: true, mode: 'string' }),
	endDate: timestamp("end_date", { withTimezone: true, mode: 'string' }),
	monthlyQuota: integer("monthly_quota").notNull().default(50),
	dailyQuota: integer("daily_quota").notNull().default(10),
	dailyTokenQuota: integer("daily_token_quota").notNull().default(5000),
	usedMonthly: integer("used_monthly").notNull().default(0),
	usedDaily: integer("used_daily").notNull().default(0),
	usedDailyTokens: integer("used_daily_tokens").notNull().default(0),
	tokenBalance: integer("token_balance").notNull().default(0),
	lastResetDate: text("last_reset_date"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const userApiKeys = pgTable("user_api_keys", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	keyName: text("key_name").notNull().default('默认Key'),
	provider: text("provider").notNull().default('custom'),
	apiKey: text("api_key").notNull(),
	apiBase: text("api_base"),
	model: text("model"),
	rateLimitPerMinute: integer("rate_limit_per_minute").default(10),
	isActive: boolean("is_active").notNull().default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const tokenPackages = pgTable("token_packages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	tokens: integer().notNull(),
	price: text().notNull(),
	bonusTokens: integer("bonus_tokens").default(0),
	popular: boolean().default(false),
	description: text().default(''),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const usageRecords = pgTable("usage_records", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	operationType: text("operation_type").notNull(),
	quotaUsed: integer("quota_used").notNull().default(1),
	tokensUsed: integer("tokens_used").default(0),
	model: text("model"),
	success: boolean("success").notNull().default(true),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const dailyTokenClaims = pgTable("daily_token_claims", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	claimDate: text("claim_date").notNull(),
	tokensClaimed: integer("tokens_claimed").notNull().default(5000),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	title: text("title").notNull(),
	description: text("description"),
	taskType: text("task_type").notNull().default('daily'),
	rewardQuota: integer("reward_quota").notNull().default(0),
	rewardTokens: integer("reward_tokens").notNull().default(0),
	action: text("action").notNull(),
	sortOrder: integer("sort_order").notNull().default(0),
	isActive: boolean("is_active").notNull().default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const userTaskRecords = pgTable("user_task_records", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
	status: text("status").notNull().default('completed'),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	claimedAt: timestamp("claimed_at", { withTimezone: true, mode: 'string' }),
});