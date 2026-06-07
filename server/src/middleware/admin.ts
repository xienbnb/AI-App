import { type Request, type Response, type NextFunction } from "express";
import { db } from "../storage/database/client.js";
import { adminUsers } from "../storage/database/shared/schema.js";
import { eq } from "drizzle-orm";

export type AdminRole = 'super_admin' | 'operator' | 'support';

export interface AdminInfo {
  id: string;
  userId: string;
  role: AdminRole;
  level: number;
}

declare global {
  namespace Express {
    interface Request {
      admin?: AdminInfo;
    }
  }
}

/**
 * 管理员认证中间件
 * 需要先通过 authMiddleware 鉴权，再检查管理员身份
 * @param minLevel 最低权限级别（1=客服, 2=运营, 3=超级管理员）
 */
export function requireAdmin(minLevel: number = 1) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "请先登录" });
        return;
      }

      const [admin] = await db.select()
        .from(adminUsers)
        .where(eq(adminUsers.userId, req.user.id))
        .limit(1);

      if (!admin) {
        res.status(403).json({ error: "无管理员权限" });
        return;
      }

      if (admin.level < minLevel) {
        res.status(403).json({ error: "权限不足" });
        return;
      }

      req.admin = {
        id: admin.id,
        userId: admin.userId,
        role: admin.role as AdminRole,
        level: admin.level,
      };

      next();
    } catch (err: any) {
      console.error("[ADMIN] Middleware error:", err);
      res.status(500).json({ error: "管理员认证失败" });
    }
  };
}