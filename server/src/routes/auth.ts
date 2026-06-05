/**
 * 认证路由
 *
 * 功能：用户注册、登录、获取用户信息、登出
 * 基于 Supabase Auth (email + password) 实现
 *
 * @file /server/src/routes/auth.ts
 */
import { Router, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseCredentials, getSupabaseServiceRoleKey } from "../storage/database/supabase-client.js";
import { getSupabaseClient } from "../storage/database/supabase-client.js";
import { db } from "../storage/database/client.js";
import { users } from "../storage/database/shared/schema.js";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * POST /api/v1/auth/register
 * 注册新用户
 * Body: { email: string, password: string, nickname?: string }
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, nickname } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "邮箱和密码不能为空" });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: "密码至少6位" });
      return;
    }

    // 使用 Supabase Admin API 创建用户
    const serviceRoleKey = getSupabaseServiceRoleKey();
    const { url } = getSupabaseCredentials();

    if (!serviceRoleKey) {
      res.status(500).json({ error: "服务配置错误" });
      return;
    }

    const adminClient = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      res.status(400).json({ error: authError.message });
      return;
    }

    if (!authData.user) {
      res.status(500).json({ error: "创建用户失败" });
      return;
    }

    const authUserId = authData.user.id;

    // 在 users 表中创建记录
    const [newUser] = await db.insert(users).values({
      id: authUserId,
      email,
      nickname: nickname || email.split("@")[0],
    }).returning();

    res.json({
      user: {
        id: newUser.id,
        email: newUser.email,
        nickname: newUser.nickname,
        avatar: newUser.avatar,
        bio: newUser.bio,
      },
    });
  } catch (err: any) {
    console.error("[AUTH] Register error:", err);
    res.status(500).json({ error: err.message || "注册失败" });
  }
});

/**
 * POST /api/v1/auth/login
 * 用户登录
 * Body: { email: string, password: string }
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "邮箱和密码不能为空" });
      return;
    }

    // 使用 Supabase anon key 登录
    const { url, anonKey } = getSupabaseCredentials();
    const anonClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await anonClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      res.status(401).json({ error: error.message || "邮箱或密码错误" });
      return;
    }

    if (!data.session) {
      res.status(401).json({ error: "登录失败" });
      return;
    }

    // 查询用户信息
    const [user] = await db.select().from(users).where(eq(users.id, data.user.id));

    if (!user) {
      // 如果 users 表中没有记录，自动创建
      const [newUser] = await db.insert(users).values({
        id: data.user.id,
        email: data.user.email || email,
        nickname: data.user.email?.split("@")[0] || email.split("@")[0],
      }).returning();

      res.json({
        token: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user: {
          id: newUser.id,
          email: newUser.email,
          nickname: newUser.nickname,
          avatar: newUser.avatar,
          bio: newUser.bio,
        },
      });
      return;
    }

    res.json({
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatar: user.avatar,
        bio: user.bio,
      },
    });
  } catch (err: any) {
    console.error("[AUTH] Login error:", err);
    res.status(500).json({ error: err.message || "登录失败" });
  }
});

/**
 * GET /api/v1/auth/me
 * 获取当前登录用户信息
 * Header: Authorization: Bearer <token>
 */
router.get("/me", async (req: Request, res: Response) => {
  try {
    // 兼容 x-session 和 Authorization: Bearer 两种方式
    const token = req.headers["x-session"] as string || 
                  (req.headers.authorization?.startsWith("Bearer ") 
                    ? req.headers.authorization.split(" ")[1] 
                    : null);
    
    if (!token) {
      res.status(401).json({ error: "未登录" });
      return;
    }

    // 验证 token
    const { url, anonKey } = getSupabaseCredentials();
    const anonClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error } = await anonClient.auth.getUser(token);

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

    res.json({
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatar: user.avatar,
        bio: user.bio,
      },
    });
  } catch (err: any) {
    console.error("[AUTH] Me error:", err);
    res.status(500).json({ error: err.message || "获取用户信息失败" });
  }
});

export default router;