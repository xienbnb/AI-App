/**
 * @file Express 认证中间件
 * @description 从 x-session header 或 Authorization: Bearer header 提取 token，
 * 调用 Supabase getUser() 验证身份，将 user 信息挂载到 req.user
 */

import type { Request, Response, NextFunction } from "express";
import { getSupabaseClient } from "../storage/database/supabase-client.js";
import { db } from "../storage/database/client.js";
import { users } from "../storage/database/shared/schema.js";
import { eq } from "drizzle-orm";

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        nickname?: string;
        isGuest?: boolean;
      };
    }
  }
}

/**
 * 从请求头中提取 token
 * 优先使用 x-session header，兼容 Authorization: Bearer
 */
function extractToken(req: Request): string | null {
  const sessionHeader = req.headers["x-session"];
  if (sessionHeader && typeof sessionHeader === "string") {
    return sessionHeader;
  }

  const authHeader = req.headers["authorization"];
  if (authHeader && typeof authHeader === "string") {
    const parts = authHeader.split(" ");
    if (parts[0].toLowerCase() === "bearer" && parts[1]) {
      return parts[1];
    }
  }

  return null;
}

/**
 * 游客 token 处理：guest_{uuid}_{timestamp}
 * 直接解析出 user_id
 */
function parseGuestToken(token: string): { id: string } | null {
  if (!token.startsWith("guest_")) return null;
  const parts = token.split("_");
  if (parts.length >= 3) {
    return { id: `guest_${parts[1]}` };
  }
  return null;
}

/**
 * 处理自定义 token 格式：phone_{phone}_{timestamp}
 * 从数据库中查找对应用户
 */
async function resolveCustomToken(token: string): Promise<{ id: string; email?: string; nickname?: string } | null> {
  // phone token 格式: phone_{phone}_{timestamp}
  if (token.startsWith("phone_")) {
    const parts = token.split("_");
    if (parts.length < 3) return null;
    const phone = parts[1];
    const [user] = await db.select().from(users).where(eq(users.email, phone)).limit(1);
    if (user) {
      return { id: user.id, email: user.email, nickname: user.nickname ?? undefined };
    }
  }
  return null;
}

/**
 * 强制认证中间件
 * 必须登录才能访问，游客用户也会被拒绝
 * 使用：router.post("/xxx", requireAuth, handler)
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ error: "未登录，请先登录" });
      return;
    }

    // 处理游客 token - 拒绝访问写操作
    const guest = parseGuestToken(token);
    if (guest) {
      res.status(401).json({ error: "游客用户无权执行此操作，请先注册/登录" });
      return;
    }

    // 尝试解析自定义 token (phone_xxx 等)
    const customUser = await resolveCustomToken(token);
    if (customUser) {
      req.user = customUser;
      next();
      return;
    }

    // Supabase JWT 验证
    const supabase = getSupabaseClient(token);
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({ error: "登录已过期，请重新登录" });
      return;
    }

    const user = data.user;
    req.user = {
      id: user.id,
      email: user.email || undefined,
      nickname:
        user.user_metadata?.nickname ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "用户",
    };

    next();
  } catch (err) {
    console.error("[Auth Middleware Error]", err);
    res.status(500).json({ error: "认证服务异常" });
  }
}

/**
 * 可选认证中间件
 * 如果已登录则解析用户信息，未登录也不拒绝
 * 用于 GET 等读操作（可以展示公开数据，但知道是谁在访问）
 * 使用：router.get("/xxx", optionalAuth, handler)
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      next();
      return;
    }

    // 处理游客 token
    const guest = parseGuestToken(token);
    if (guest) {
      req.user = { id: guest.id, isGuest: true, nickname: "游客" };
      next();
      return;
    }

    // 尝试解析自定义 token (phone_xxx 等)
    const customUser = await resolveCustomToken(token);
    if (customUser) {
      req.user = customUser;
      next();
      return;
    }

    // Supabase JWT 验证
    const supabase = getSupabaseClient(token);
    const { data, error } = await supabase.auth.getUser(token);

    if (!error && data.user) {
      req.user = {
        id: data.user.id,
        email: data.user.email || undefined,
        nickname:
          data.user.user_metadata?.nickname ||
          data.user.user_metadata?.full_name ||
          data.user.email?.split("@")[0] ||
          "用户",
      };
    }

    next();
  } catch {
    // 认证失败不阻塞请求，只是 user 为 undefined
    next();
  }
}