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
import bcrypt from "bcryptjs";
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

    // 游客令牌验证 (格式: guest_UUID_TIMESTAMP)
    if (token.startsWith("guest_")) {
      const parts = token.split("_");
      if (parts.length >= 2) {
        const guestId = parts[1];
        const result = await db.select().from(users).where(eq(users.id, guestId)).limit(1);
        if (result.length > 0) {
          return res.json({
            user: {
              id: result[0].id,
              email: result[0].email,
              nickname: result[0].nickname,
              avatar: result[0].avatar || "",
              bio: result[0].bio || "",
              isGuest: true,
            },
          });
        }
      }
      return res.status(401).json({ error: "游客令牌无效" });
    }

    // Phone 令牌验证 (格式: phone_PHONE_TIMESTAMP)
    if (token.startsWith("phone_")) {
      const parts = token.split("_");
      if (parts.length >= 2) {
        const phone = parts[1];
        const result = await db.select().from(users).where(eq(users.email, phone)).limit(1);
        if (result.length > 0) {
          return res.json({
            user: {
              id: result[0].id,
              email: result[0].email,
              nickname: result[0].nickname,
              avatar: result[0].avatar || "",
              bio: result[0].bio || "",
              role: result[0].role || "user",
            },
          });
        }
      }
      return res.status(401).json({ error: "手机令牌无效" });
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
        role: user.role || "user",
      },
    });
  } catch (err: any) {
    console.error("[AUTH] Me error:", err);
    res.status(500).json({ error: err.message || "获取用户信息失败" });
  }
});

/**
 * POST /api/v1/auth/guest
 * 游客登录（无账号，快速体验）
 */
router.post("/guest", async (req: Request, res: Response) => {
  try {
    const { phone } = req.body || {};

    // 如果提供了手机号，尝试查找已有用户
    if (phone) {
      const [existingUser] = await db.select()
        .from(users)
        .where(eq(users.email, phone))
        .limit(1);

      if (existingUser) {
        const guestToken = `guest_${existingUser.id}_${Date.now()}`;
        return res.json({
          token: guestToken,
          user: {
            id: existingUser.id,
            email: existingUser.email,
            nickname: existingUser.nickname || "用户" + existingUser.email?.slice(-4),
            avatar: existingUser.avatar || "",
            bio: existingUser.bio || "",
            role: existingUser.role || "user",
            isGuest: true,
          },
        });
      }
    }

    // 没有提供手机号或用户不存在 → 创建新游客
    const guestId = crypto.randomUUID();
    const guestName = "游客" + guestId.slice(0, 6).toUpperCase();

    const [guestUser] = await db.insert(users).values({
      id: guestId,
      email: phone || `guest_${guestId}@guest.app`,
      nickname: guestName,
      avatar: "",
      bio: "游客用户",
    }).returning();

    const guestToken = `guest_${guestId}_${Date.now()}`;

    res.json({
      token: guestToken,
      user: {
        id: guestUser.id,
        email: guestUser.email,
        nickname: guestUser.nickname,
        avatar: guestUser.avatar,
        bio: guestUser.bio,
        isGuest: true,
      },
    });
  } catch (err: any) {
    console.error("[AUTH] Guest error:", err);
    res.status(500).json({ error: err.message || "游客登录失败" });
  }
});

// ===== In-Memory OTP Store =====
interface OtpEntry {
  code: string;
  expiresAt: number;
  lastSentAt: number;
  used: boolean;
}
const otpStore = new Map<string, OtpEntry>();

// 定时清理过期的 OTP（每 5 分钟执行一次）
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of otpStore.entries()) {
    if (now > entry.expiresAt || entry.used) {
      otpStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * POST /api/v1/auth/send-otp
 * 发送手机验证码
 */
router.post("/send-otp", async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      res.status(400).json({ error: "手机号不能为空" });
      return;
    }

    // 验证手机号格式（简单校验）
    if (!/^1\d{10}$/.test(phone)) {
      res.status(400).json({ error: "手机号格式不正确" });
      return;
    }

    const now = Date.now();
    const existing = otpStore.get(phone);

    // 限制发送频率：同一手机号 60 秒内只能发一次
    if (existing && (now - existing.lastSentAt) < 60 * 1000) {
      const remaining = Math.ceil(60 - (now - existing.lastSentAt) / 1000);
      res.status(429).json({ error: `发送过于频繁，请 ${remaining} 秒后再试` });
      return;
    }

    // 生成随机 6 位数字验证码
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = now + 5 * 60 * 1000; // 5 分钟过期

    otpStore.set(phone, { code, expiresAt, lastSentAt: now, used: false });

    console.log(`[AUTH] OTP sent to ${phone}: ${code}`);
    // 实际生产环境应接入 SMS 服务商发送短信
    // 开发阶段将验证码返回给前端便于调试
    res.json({ success: true, message: "验证码已发送" });
  } catch (err: any) {
    console.error("[AUTH] Send OTP error:", err);
    res.status(500).json({ error: err.message || "发送验证码失败" });
  }
});

/**
 * POST /api/v1/auth/verify-otp
 * 验证手机验证码
 */
router.post("/verify-otp", async (req: Request, res: Response) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      res.status(400).json({ error: "手机号和验证码不能为空" });
      return;
    }

    const entry = otpStore.get(phone);
    if (!entry) {
      res.status(400).json({ error: "请先获取验证码" });
      return;
    }

    // 检查是否已使用（防重复使用）
    if (entry.used) {
      otpStore.delete(phone);
      res.status(400).json({ error: "验证码已使用，请重新获取" });
      return;
    }

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      otpStore.delete(phone);
      res.status(400).json({ error: "验证码已过期，请重新获取" });
      return;
    }

    // 校验验证码
    if (code !== entry.code) {
      res.status(400).json({ error: "验证码错误" });
      return;
    }

    // 验证成功后立即标记为已使用（不可重复使用）
    entry.used = true;

    // 查找或创建用户
    const [existingUser] = await db.select().from(users).where(eq(users.email, phone));

    if (existingUser) {
      res.json({
        token: `phone_${phone}_${Date.now()}`,
        user: {
          id: existingUser.id,
          email: existingUser.email,
          nickname: existingUser.nickname,
          avatar: existingUser.avatar,
          bio: existingUser.bio,
        },
      });
      return;
    }

    // 创建新用户
    const [newUser] = await db.insert(users).values({
      id: crypto.randomUUID(),
      email: phone,
      nickname: `用户${phone.slice(-4)}`,
    }).returning();

    res.json({
      token: `phone_${phone}_${Date.now()}`,
      user: {
        id: newUser.id,
        email: newUser.email,
        nickname: newUser.nickname,
        avatar: newUser.avatar,
        bio: newUser.bio,
      },
    });
  } catch (err: any) {
    console.error("[AUTH] Verify OTP error:", err);
    res.status(500).json({ error: err.message || "验证失败" });
  }
});

/**
 * POST /password-login
 * 手机号 + 密码登录（用于 账号密码 登录方式）
 * Body: phone, password
 */
router.post("/password-login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) { res.status(400).json({ error: "手机号和密码不能为空" }); return; }

    const client = getSupabaseClient();
    const { data: user, error } = await client
      .from("users")
      .select("id, email, nickname, avatar, password_hash, role")
      .eq("email", phone)
      .maybeSingle();

    if (error || !user) { res.status(400).json({ error: "账号不存在" }); return; }
    if (!user.password_hash) { res.status(400).json({ error: "该账号未设置密码，请使用验证码登录" }); return; }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) { res.status(400).json({ error: "密码错误" }); return; }

    const token = `phone_${phone}_${Date.now()}`;
    res.json({ token, user: { id: user.id, email: user.email, nickname: user.nickname, avatar: user.avatar, role: user.role } });
  } catch (err) {
    console.error("密码登录失败:", err);
    res.status(500).json({ error: "密码登录失败" });
  }
});

/**
 * POST /set-password
 * 设置/修改密码（需要登录态）
 * Body: password, code(OTP验证码)
 */
router.post("/set-password", async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, code, password } = req.body;
    if (!phone || !code || !password) { res.status(400).json({ error: "参数不完整" }); return; }
    if (password.length < 6) { res.status(400).json({ error: "密码至少6位" }); return; }

    // 验证 OTP
    const entry = otpStore.get(phone);
    if (!entry || entry.used || entry.code !== code || Date.now() > entry.expiresAt) {
      res.status(400).json({ error: "验证码无效或已过期" }); return;
    }
    entry.used = true;

    const hash = bcrypt.hashSync(password, 10);
    const client = getSupabaseClient();
    await client.from("users").update({ password_hash: hash }).eq("email", phone);
    res.json({ success: true, message: "密码设置成功" });
  } catch (err) {
    console.error("设置密码失败:", err);
    res.status(500).json({ error: "设置密码失败" });
  }
});

export default router;