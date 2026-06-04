import { z } from "zod";
import type { ZodSchema } from "zod";
import type { Request, Response, NextFunction } from "express";

/**
 * Generate a simple error class for HTTP errors
 */
export class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * Validate request body against a zod schema
 */
export function validateBody<T>(schema: ZodSchema<T>, body: unknown): T {
  return schema.parse(body);
}

/**
 * Wrap async route handler to catch errors
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ===== Shared Validation Schemas =====

/** Book create schema */
export const createBookSchema = z.object({
  title: z.string().min(1, "书名不能为空").max(100),
  author: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  outline: z.string().optional(),
  audience: z.string().optional(),
  epoch: z.string().optional(),
});

/** Book update schema */
export const updateBookSchema = z.object({
  title: z.string().min(1, "书名不能为空").max(100).optional(),
  author: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  outline: z.string().optional(),
  audience: z.string().optional(),
  epoch: z.string().optional(),
});

/** Chapter create schema */
export const createChapterSchema = z.object({
  volumeId: z.string().uuid("卷ID格式不正确"),
  title: z.string().min(1, "章节标题不能为空"),
  content: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

/** Chapter update schema */
export const updateChapterSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

/** Volume create schema */
export const createVolumeSchema = z.object({
  title: z.string().min(1, "卷名不能为空"),
  sortOrder: z.number().int().optional(),
});

/** AI dialogue schema */
export const aiDialogueSchema = z.object({
  message: z.string().min(1, "消息不能为空"),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).optional(),
  bookId: z.string().uuid().optional().nullable(),
  bookTitle: z.string().optional(),
  skill: z.string().optional(),
});

/** Community post schema */
export const createPostSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(100),
  content: z.string().min(1, "内容不能为空"),
  tag: z.string().optional(),
});