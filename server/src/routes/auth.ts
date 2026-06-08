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
import { authMiddleware } from "../middleware/auth.js";
import { db } from "../storage/database/client.js";
import { users } from "../storage/database/shared/schema.js";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router = Router();

// OTP 存储（内存中，生产环境应使用 Redis）
const otpStore = new Map<string, { code: string; expiresAt: number; lastSentAt: number }>();
const OTP_EXPIRES_IN = 5 * 60 * 1000; // 5 分钟
const OTP_RATE_LIMIT = 60 * 1000; // 60 秒限流

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
    const userIp = req.ip || req.socket.remoteAddress || "";
    const [newUser] = await db.insert(users).values({
      id: authUserId,
      email,
      nickname: nickname || email.split("@")[0],
      ipAddress: userIp,
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
 * POST /api/v1/auth/password-login
 * 手机号+密码登录（基于数据库中的 bcrypt 密码）
 * Body: { phone: string, password: string }
 */
router.post("/password-login", async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      res.status(400).json({ error: "手机号和密码不能为空" });
      return;
    }

    // 查询用户
    const [user] = await db.select().from(users).where(eq(users.email, phone)).limit(1);
    if (!user) {
      res.status(401).json({ error: "用户不存在" });
      return;
    }

    if (!user.passwordHash) {
      res.status(401).json({ error: "未设置密码，请使用验证码登录" });
      return;
    }

    // 验证密码
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "密码错误" });
      return;
    }

    // 更新登录IP
    const userIp = req.ip || req.socket.remoteAddress || "";
    db.update(users).set({ ipAddress: userIp }).where(eq(users.id, user.id)).catch(() => {});

    // 生成 token
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const phoneToken = `phone_${user.id}_${expiresAt}`;

    res.json({
      token: phoneToken,
      refreshToken: phoneToken,
      expiresIn: 7 * 24 * 60 * 60,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatar: user.avatar,
        bio: user.bio,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error("[AUTH] Password login error:", err);
    res.status(500).json({ error: err.message || "登录失败" });
  }
});

/**
 * POST /api/v1/auth/set-password
 * 设置密码（通过 OTP 验证后设置）
 * Body: { phone: string, password: string, code: string }
 */
router.post("/set-password", async (req: Request, res: Response) => {
  try {
    const { phone, password, code } = req.body;
    if (!phone || !password || !code) {
      res.status(400).json({ error: "手机号、密码和验证码不能为空" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "密码长度不能少于6位" });
      return;
    }

    // 验证 OTP
    const storedOtp = otpStore.get(phone);
    if (!storedOtp || storedOtp.code !== code) {
      res.status(400).json({ error: "验证码错误" });
      return;
    }
    if (Date.now() > storedOtp.expiresAt) {
      otpStore.delete(phone);
      res.status(400).json({ error: "验证码已过期" });
      return;
    }
    // 删除已使用的 OTP
    otpStore.delete(phone);

    // 查询用户
    const [existingUser] = await db.select().from(users).where(eq(users.email, phone)).limit(1);
    if (!existingUser) {
      res.status(404).json({ error: "用户不存在" });
      return;
    }

    // 更新密码
    const passwordHash = await bcrypt.hash(password, 10);
    await db.update(users)
      .set({ passwordHash: passwordHash })
      .where(eq(users.id, existingUser.id));

    res.json({ success: true, message: "密码设置成功" });
  } catch (err: any) {
    console.error("[AUTH] Set password error:", err);
    res.status(500).json({ error: err.message || "设置密码失败" });
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
      const userIp = req.ip || req.socket.remoteAddress || "";
      const [newUser] = await db.insert(users).values({
        id: data.user.id,
        email: data.user.email || email,
        nickname: data.user.email?.split("@")[0] || email.split("@")[0],
        ipAddress: userIp,
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

    // 更新登录用户的IP地址（不阻塞响应）
    const userIp = req.ip || req.socket.remoteAddress || "";
    db.update(users).set({ ipAddress: userIp }).where(eq(users.id, user.id)).catch(() => {});

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

    // 游客令牌验证 (格式: guest_<uuid>_<expiresAt>)
    if (token.startsWith("guest_")) {
      const parts = token.split("_");
      if (parts.length >= 3) {
        const guestId = parts[1];
        const expiresAt = parseInt(parts[2], 10);
        
        // 检查 token 是否已过期
        if (isNaN(expiresAt) || Date.now() > expiresAt) {
          return res.status(401).json({ error: "游客令牌已过期，请重新登录" });
        }
        
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

    // 手机验证码令牌验证 (格式: phone_<userId>_<expiresAt>)
    if (token.startsWith("phone_")) {
      const parts = token.split("_");
      if (parts.length >= 3) {
        const userId = parts[1];
        const expiresAt = parseInt(parts[2], 10);
        
        if (isNaN(expiresAt) || Date.now() > expiresAt) {
          return res.status(401).json({ error: "登录已过期，请重新登录" });
        }
        
        const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (result.length > 0) {
          return res.json({
            user: {
              id: result[0].id,
              email: result[0].email,
              nickname: result[0].nickname,
              avatar: result[0].avatar || "",
              bio: result[0].bio || "",
              isGuest: false,
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
// 游客 Token 有效期（7天）
const GUEST_TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000;

router.post("/guest", async (_req: Request, res: Response) => {
  try {
    const guestId = crypto.randomUUID();
    const guestName = "游客" + guestId.slice(0, 6).toUpperCase();
    const expiresAt = Date.now() + GUEST_TOKEN_EXPIRES_IN;

    const [guestUser] = await db.insert(users).values({
      id: guestId,
      email: `guest_${guestId}@guest.app`,
      nickname: guestName,
      avatar: "",
      bio: "游客用户",
      role: "guest",
    }).returning();

    // 生成带过期时间的 guest token（格式：guest_<uuid>_<expiresAt>）
    const guestToken = `guest_${guestId}_${expiresAt}`;

    res.json({
      token: guestToken,
      refreshToken: guestToken,
      expiresIn: GUEST_TOKEN_EXPIRES_IN / 1000,
      user: {
        id: guestUser.id,
        email: guestUser.email,
        nickname: guestUser.nickname,
        avatar: guestUser.avatar || "",
        bio: guestUser.bio || "",
        isGuest: true,
      },
    });
  } catch (err: any) {
    console.error("[AUTH] Guest error:", err);
    res.status(500).json({ error: err.message || "游客登录失败" });
  }
});

/**
 * POST /api/v1/auth/send-otp
 * 发送验证码（手机号或邮箱）
 * Body: { phone?: string, email?: string }
 */
router.post("/send-otp", async (req: Request, res: Response) => {
  try {
    const { phone, email } = req.body;
    const target = phone || email;
    if (!target) {
      res.status(400).json({ error: "手机号或邮箱不能为空" });
      return;
    }
    // 限流检查
    const lastSent = otpStore.get(target);
    if (lastSent && (Date.now() - lastSent.lastSentAt) < OTP_RATE_LIMIT) {
      res.status(429).json({ error: "发送太频繁，请稍后重试" });
      return;
    }

    // 生成6位随机验证码
    const code = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(target, {
      code,
      expiresAt: Date.now() + OTP_EXPIRES_IN,
      lastSentAt: Date.now(),
    });
    console.log(`[AUTH] Send OTP to ${target}: ${code}`);
    res.json({ success: true, message: "验证码已发送", code });
  } catch (err: any) {
    console.error("[AUTH] Send OTP error:", err);
    res.status(500).json({ error: err.message || "发送验证码失败" });
  }
});

// 手机验证码 Token 有效期（7天）
const PHONE_TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000;

/**
 * POST /api/v1/auth/verify-otp
 * 验证手机验证码（占位）
 */
router.post("/verify-otp", async (req: Request, res: Response) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      res.status(400).json({ error: "手机号和验证码不能为空" });
      return;
    }
    
    // 验证 OTP
    const storedOtp = otpStore.get(phone);
    if (!storedOtp) {
      res.status(400).json({ error: "请先获取验证码" });
      return;
    }
    if (storedOtp.code !== code) {
      res.status(400).json({ error: "验证码错误" });
      return;
    }
    if (Date.now() > storedOtp.expiresAt) {
      otpStore.delete(phone);
      res.status(400).json({ error: "验证码已过期" });
      return;
    }
    // 删除已使用的 OTP
    otpStore.delete(phone);

    const expiresAt = Date.now() + PHONE_TOKEN_EXPIRES_IN;

    // 查找或创建用户
    const [existingUser] = await db.select().from(users).where(eq(users.email, phone));

    if (existingUser) {
      // 更新登录IP
      const userIp = req.ip || req.socket.remoteAddress || "";
      db.update(users).set({ ipAddress: userIp }).where(eq(users.id, existingUser.id)).catch(() => {});

      // 生成带过期时间的 phone token（格式：phone_<userId>_<expiresAt>）
      const phoneToken = `phone_${existingUser.id}_${expiresAt}`;
      res.json({
        token: phoneToken,
        refreshToken: phoneToken,
        expiresIn: PHONE_TOKEN_EXPIRES_IN / 1000,
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
    const userId = crypto.randomUUID();
    const userIp = req.ip || req.socket.remoteAddress || "";
    const [newUser] = await db.insert(users).values({
      id: userId,
      email: phone,
      nickname: `用户${phone.slice(-4)}`,
      ipAddress: userIp,
    }).returning();

    const phoneToken = `phone_${userId}_${expiresAt}`;
    res.json({
      token: phoneToken,
      refreshToken: phoneToken,
      expiresIn: PHONE_TOKEN_EXPIRES_IN / 1000,
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
 * GET /api/v1/auth/bindings
 * 获取当前用户的账号绑定信息
 * Header: x-session <token>
 */
router.get("/bindings", async (req: Request, res: Response) => {
  try {
    const token = req.headers["x-session"] as string;
    if (!token) {
      res.status(401).json({ error: "未登录" });
      return;
    }

    // 解析用户 ID
    let userId: string | null = null;
    if (token.startsWith("phone_")) {
      userId = token.split("_")[1];
    } else if (token.startsWith("guest_")) {
      res.json({
        phone: "",
        email: "",
        emailVerified: false,
        hasPassword: false,
        wechat: { bound: false, nickname: "" },
        qq: { bound: false, nickname: "" },
      });
      return;
    } else {
      // Supabase token
      const { url, anonKey } = getSupabaseCredentials();
      const anonClient = createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData } = await anonClient.auth.getUser(token);
      if (userData?.user) userId = userData.user.id;
    }

    if (!userId) {
      res.status(401).json({ error: "令牌无效" });
      return;
    }

    const [user] = await db.select({
      phone: users.phone,
      email: users.email,
      emailVerified: users.emailVerified,
      passwordHash: users.passwordHash,
      wechatOpenid: users.wechatOpenid,
      qqOpenid: users.qqOpenid,
      wechatNickname: users.wechatNickname,
      qqNickname: users.qqNickname,
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      res.status(404).json({ error: "用户不存在" });
      return;
    }

    res.json({
      phone: user.phone || "",
      email: user.email,
      emailVerified: user.emailVerified || false,
      hasPassword: !!user.passwordHash,
      wechat: {
        bound: !!user.wechatOpenid,
        nickname: user.wechatNickname || "",
      },
      qq: {
        bound: !!user.qqOpenid,
        nickname: user.qqNickname || "",
      },
    });
  } catch (err: any) {
    console.error("[AUTH] Bindings error:", err);
    res.status(500).json({ error: err.message || "获取绑定信息失败" });
  }
});

/**
 * PUT /api/v1/auth/change-password
 * 修改密码（需要当前密码验证）
 * Header: x-session <token>
 * Body: { oldPassword: string, newPassword: string }
 */
router.put("/change-password", async (req: Request, res: Response) => {
  try {
    const token = req.headers["x-session"] as string;
    if (!token) {
      res.status(401).json({ error: "未登录" });
      return;
    }

    // 解析用户 ID
    let userId: string | null = null;
    if (token.startsWith("phone_")) {
      userId = token.split("_")[1];
    } else if (token.startsWith("guest_")) {
      res.status(403).json({ error: "游客不能修改密码" });
      return;
    } else {
      const { url, anonKey } = getSupabaseCredentials();
      const anonClient = createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData } = await anonClient.auth.getUser(token);
      if (userData?.user) userId = userData.user.id;
    }

    if (!userId) {
      res.status(401).json({ error: "令牌无效" });
      return;
    }

    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      res.status(400).json({ error: "旧密码和新密码不能为空" });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: "新密码长度不能少于6位" });
      return;
    }

    // 查询当前用户
    const [user] = await db.select({
      passwordHash: users.passwordHash,
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      res.status(404).json({ error: "用户不存在" });
      return;
    }

    // 验证旧密码
    if (!user.passwordHash) {
      res.status(400).json({ error: "尚未设置密码，请使用验证码登录后设置" });
      return;
    }

    const valid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!valid) {
      res.status(400).json({ error: "旧密码错误" });
      return;
    }

    // 更新为新密码
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.update(users)
      .set({ passwordHash: newHash, updatedAt: new Date().toISOString() })
      .where(eq(users.id, userId));

    res.json({ success: true, message: "密码修改成功" });
  } catch (err: any) {
    console.error("[AUTH] Change password error:", err);
    res.status(500).json({ error: err.message || "修改密码失败" });
  }
});

/**
 * PUT /api/v1/auth/change-phone
 * 修改手机号（需要旧手机号验证码 + 新手机号验证码）
 * Header: x-session <token>
 * Body: { oldPhone: string, oldCode: string, newPhone: string, newCode: string }
 */
router.put("/change-phone", async (req: Request, res: Response) => {
  try {
    const token = req.headers["x-session"] as string;
    if (!token) {
      res.status(401).json({ error: "未登录" });
      return;
    }

    let userId: string | null = null;
    if (token.startsWith("phone_")) {
      userId = token.split("_")[1];
    } else if (token.startsWith("guest_")) {
      res.status(403).json({ error: "游客不能修改手机号" });
      return;
    } else {
      const { url, anonKey } = getSupabaseCredentials();
      const anonClient = createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData } = await anonClient.auth.getUser(token);
      if (userData?.user) userId = userData.user.id;
    }

    if (!userId) {
      res.status(401).json({ error: "令牌无效" });
      return;
    }

    const { oldPhone, oldCode, newPhone, newCode } = req.body;
    if (!oldPhone || !oldCode || !newPhone || !newCode) {
      res.status(400).json({ error: "参数不完整" });
      return;
    }

    // 验证旧手机号验证码
    const storedOldOtp = otpStore.get(oldPhone);
    if (!storedOldOtp || storedOldOtp.code !== oldCode) {
      res.status(400).json({ error: "旧手机号验证码错误" });
      return;
    }
    if (Date.now() > storedOldOtp.expiresAt) {
      otpStore.delete(oldPhone);
      res.status(400).json({ error: "旧手机号验证码已过期" });
      return;
    }
    otpStore.delete(oldPhone);

    // 验证新手机号验证码
    const storedNewOtp = otpStore.get(newPhone);
    if (!storedNewOtp || storedNewOtp.code !== newCode) {
      res.status(400).json({ error: "新手机号验证码错误" });
      return;
    }
    if (Date.now() > storedNewOtp.expiresAt) {
      otpStore.delete(newPhone);
      res.status(400).json({ error: "新手机号验证码已过期" });
      return;
    }
    otpStore.delete(newPhone);

    // 更新手机号
    await db.update(users)
      .set({ phone: newPhone, updatedAt: new Date().toISOString() })
      .where(eq(users.id, userId));

    res.json({ success: true, message: "手机号修改成功", phone: newPhone });
  } catch (err: any) {
    console.error("[AUTH] Change phone error:", err);
    res.status(500).json({ error: err.message || "修改手机号失败" });
  }
});

/**
 * POST /api/v1/auth/bind-email
 * 绑定邮箱（需要邮箱验证码）
 * Header: x-session <token>
 * Body: { email: string, code: string }
 */
router.post("/bind-email", async (req: Request, res: Response) => {
  try {
    const token = req.headers["x-session"] as string;
    if (!token) {
      res.status(401).json({ error: "未登录" });
      return;
    }

    let userId: string | null = null;
    if (token.startsWith("phone_")) {
      userId = token.split("_")[1];
    } else if (token.startsWith("guest_")) {
      res.status(403).json({ error: "游客不能绑定邮箱" });
      return;
    } else {
      const { url, anonKey } = getSupabaseCredentials();
      const anonClient = createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData } = await anonClient.auth.getUser(token);
      if (userData?.user) userId = userData.user.id;
    }

    if (!userId) {
      res.status(401).json({ error: "令牌无效" });
      return;
    }

    const { email, code } = req.body;
    if (!email || !code) {
      res.status(400).json({ error: "邮箱和验证码不能为空" });
      return;
    }

    // 验证邮箱验证码
    const storedOtp = otpStore.get(email);
    if (!storedOtp || storedOtp.code !== code) {
      res.status(400).json({ error: "邮箱验证码错误" });
      return;
    }
    if (Date.now() > storedOtp.expiresAt) {
      otpStore.delete(email);
      res.status(400).json({ error: "邮箱验证码已过期" });
      return;
    }
    otpStore.delete(email);

    // 绑定邮箱
    await db.update(users)
      .set({ email, emailVerified: true, updatedAt: new Date().toISOString() })
      .where(eq(users.id, userId));

    res.json({ success: true, message: "邮箱绑定成功", email });
  } catch (err: any) {
    console.error("[AUTH] Bind email error:", err);
    res.status(500).json({ error: err.message || "绑定邮箱失败" });
  }
});

/**
 * POST /api/v1/auth/bind-social
 * 绑定社交账号（微信/QQ） — 简化版
 * Header: x-session <token>
 * Body: { platform: "wechat" | "qq", openid: string, nickname?: string }
 */
router.post("/bind-social", async (req: Request, res: Response) => {
  try {
    const token = req.headers["x-session"] as string;
    if (!token) {
      res.status(401).json({ error: "未登录" });
      return;
    }

    let userId: string | null = null;
    if (token.startsWith("phone_")) {
      userId = token.split("_")[1];
    } else if (token.startsWith("guest_")) {
      res.status(403).json({ error: "游客不能绑定社交账号" });
      return;
    } else {
      const { url, anonKey } = getSupabaseCredentials();
      const anonClient = createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData } = await anonClient.auth.getUser(token);
      if (userData?.user) userId = userData.user.id;
    }

    if (!userId) {
      res.status(401).json({ error: "令牌无效" });
      return;
    }

    const { platform, openid, nickname } = req.body;
    if (!platform || !openid) {
      res.status(400).json({ error: "平台和 openid 不能为空" });
      return;
    }

    if (platform !== "wechat" && platform !== "qq") {
      res.status(400).json({ error: "仅支持 wechat 和 qq 平台" });
      return;
    }

    // 检查该 openid 是否已被其他用户绑定
    const field = platform === "wechat" ? users.wechatOpenid : users.qqOpenid;
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(field, openid)).limit(1);
    if (existing && existing.id !== userId) {
      res.status(400).json({ error: "该社交账号已被其他用户绑定" });
      return;
    }

    // 更新绑定信息
    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (platform === "wechat") {
      updates.wechatOpenid = openid;
      if (nickname) updates.wechatNickname = nickname;
    } else {
      updates.qqOpenid = openid;
      if (nickname) updates.qqNickname = nickname;
    }

    await db.update(users).set(updates).where(eq(users.id, userId));

    res.json({ success: true, message: `${platform === "wechat" ? "微信" : "QQ"}绑定成功` });
  } catch (err: any) {
    console.error("[AUTH] Bind social error:", err);
    res.status(500).json({ error: err.message || "绑定失败" });
  }
});

/**
 * GET /api/v1/auth/custom-key
 * 获取用户的 自定义API Key
 */
router.get("/custom-key", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "未登录" });
      return;
    }

    const [user] = await db.select({ id: users.id, customApiKey: users.customApiKey })
      .from(users).where(eq(users.id, userId)).limit(1);
    
    if (!user) {
      res.status(404).json({ error: "用户不存在" });
      return;
    }

    res.json({
      success: true,
      data: {
        hasKey: !!user.customApiKey,
        // 不返回完整的 key，只返回掩码
        keyPreview: user.customApiKey ? user.customApiKey.slice(0, 8) + "..." + user.customApiKey.slice(-4) : "",
      },
    });
  } catch (err: any) {
    console.error("[AUTH] Get custom key error:", err);
    res.status(500).json({ error: err.message || "获取失败" });
  }
});

/**
 * PUT /api/v1/auth/custom-key
 * 设置/更新自定义 API Key
 */
router.put("/custom-key", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { apiKey } = req.body;
    
    if (!userId) {
      res.status(401).json({ error: "未登录" });
      return;
    }

    if (!apiKey || typeof apiKey !== 'string') {
      res.status(400).json({ error: "请提供有效的 API Key" });
      return;
    }

    await db.update(users).set({ customApiKey: apiKey }).where(eq(users.id, userId));

    res.json({
      success: true,
      message: "API Key 已保存",
      data: { keyPreview: apiKey.slice(0, 8) + "..." + apiKey.slice(-4) },
    });
  } catch (err: any) {
    console.error("[AUTH] Save custom key error:", err);
    res.status(500).json({ error: err.message || "保存失败" });
  }
});

/**
 * DELETE /api/v1/auth/custom-key
 * 删除自定义 API Key
 */
router.delete("/custom-key", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "未登录" });
      return;
    }

    await db.update(users).set({ customApiKey: "" }).where(eq(users.id, userId));

    res.json({
      success: true,
      message: "API Key 已删除",
    });
  } catch (err: any) {
    console.error("[AUTH] Delete custom key error:", err);
    res.status(500).json({ error: err.message || "删除失败" });
  }
});

export default router;