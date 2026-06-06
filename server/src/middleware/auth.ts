import { type Request, type Response, type NextFunction } from "express";
import { getSupabaseClient } from "../storage/database/supabase-client.js";
import { db } from "../storage/database/client.js";
import { users } from "../storage/database/shared/schema.js";
import { eq } from "drizzle-orm";

export interface AuthUser {
  id: string;
  email: string;
  nickname: string;
  avatar: string;
  bio: string;
  isGuest?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * 认证中间件 - 验证用户 Token
 * 支持 Bearer Token 和 x-session header 两种方式
 * 支持游客 Token
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers["x-session"] as string ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null);

    if (!token) {
      res.status(401).json({ error: "未登录" });
      return;
    }

    // 游客令牌验证 (格式: guest_<uuid>_<expiresAt>)
    if (token.startsWith("guest_")) {
      const parts = token.split("_");
      if (parts.length < 3) {
        res.status(401).json({ error: "游客令牌无效" });
        return;
      }

      const guestId = parts[1];
      const expiresAt = parseInt(parts[2], 10);

      if (isNaN(expiresAt) || Date.now() > expiresAt) {
        res.status(401).json({ error: "游客令牌已过期，请重新登录" });
        return;
      }

      const result = await db.select().from(users).where(eq(users.id, guestId)).limit(1);
      if (result.length === 0) {
        res.status(401).json({ error: "游客令牌无效" });
        return;
      }

      req.user = {
        id: result[0].id,
        email: result[0].email,
        nickname: result[0].nickname,
        avatar: result[0].avatar || "",
        bio: result[0].bio || "",
        isGuest: true,
      };
      next();
      return;
    }

    // 手机验证码令牌验证 (格式: phone_<userId>_<expiresAt>)
    if (token.startsWith("phone_")) {
      const parts = token.split("_");
      if (parts.length < 3) {
        res.status(401).json({ error: "手机令牌无效" });
        return;
      }

      const userId = parts[1];
      const expiresAt = parseInt(parts[2], 10);

      if (isNaN(expiresAt) || Date.now() > expiresAt) {
        res.status(401).json({ error: "登录已过期，请重新登录" });
        return;
      }

      const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (result.length === 0) {
        res.status(401).json({ error: "手机令牌无效" });
        return;
      }

      req.user = {
        id: result[0].id,
        email: result[0].email,
        nickname: result[0].nickname,
        avatar: result[0].avatar || "",
        bio: result[0].bio || "",
        isGuest: false,
      };
      next();
      return;
    }

    // 正式用户 Token 验证 (Supabase Auth)
    const client = getSupabaseClient(token);
    const { data: userData, error } = await client.auth.getUser(token);

    if (error || !userData.user) {
      res.status(401).json({ error: "token 无效或已过期" });
      return;
    }

    // 查询本地用户信息
    const [user] = await db.select().from(users).where(eq(users.id, userData.user.id));

    if (!user) {
      res.status(404).json({ error: "用户不存在" });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatar: user.avatar || "",
      bio: user.bio || "",
    };
    next();
  } catch (err: any) {
    console.error("[AUTH] Middleware error:", err);
    res.status(500).json({ error: "认证失败" });
  }
}

/**
 * 可选认证中间件 - 如果有 token 就解析，没有也继续
 */
export async function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers["x-session"] as string ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null);

    if (!token) {
      next();
      return;
    }

    // 游客令牌
    if (token.startsWith("guest_")) {
      const parts = token.split("_");
      if (parts.length >= 3) {
        const guestId = parts[1];
        const expiresAt = parseInt(parts[2], 10);
        if (!isNaN(expiresAt) && Date.now() <= expiresAt) {
          const result = await db.select().from(users).where(eq(users.id, guestId)).limit(1);
          if (result.length > 0) {
            req.user = {
              id: result[0].id,
              email: result[0].email,
              nickname: result[0].nickname,
              avatar: result[0].avatar || "",
              bio: result[0].bio || "",
              isGuest: true,
            };
          }
        }
      }
      next();
      return;
    }

    // 手机验证码令牌
    if (token.startsWith("phone_")) {
      const parts = token.split("_");
      if (parts.length >= 3) {
        const userId = parts[1];
        const expiresAt = parseInt(parts[2], 10);
        if (!isNaN(expiresAt) && Date.now() <= expiresAt) {
          const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
          if (result.length > 0) {
            req.user = {
              id: result[0].id,
              email: result[0].email,
              nickname: result[0].nickname,
              avatar: result[0].avatar || "",
              bio: result[0].bio || "",
              isGuest: false,
            };
          }
        }
      }
      next();
      return;
    }

    // 正式用户
    const client = getSupabaseClient(token);
    const { data: userData } = await client.auth.getUser(token);
    if (userData.user) {
      const [user] = await db.select().from(users).where(eq(users.id, userData.user.id));
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          avatar: user.avatar || "",
          bio: user.bio || "",
        };
      }
    }

    next();
  } catch {
    // 认证失败不阻断，继续作为匿名用户处理
    next();
  }
}

// 别名
export const requireAuth = authMiddleware;