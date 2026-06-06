import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../storage/database/client.js";
import { users } from "../storage/database/shared/schema.js";
import { eq } from "drizzle-orm";

const router = Router();

// 套餐定义（按最新需求）
const VIP_PACKAGES = [
  {
    id: "free",
    name: "普通用户",
    level: 0,
    price: 0,
    duration_days: 0,
    daily_chars: 5000,
    max_tokens: 2000,
    features: ["每日 5000 字写作额度", "基础写作功能", "本地存储"],
    limits: "每日 5000 字，单次 2000 token",
  },
  {
    id: "monthly",
    name: "月卡VIP",
    level: 1,
    price: 29.9,
    duration_days: 30,
    monthly_calls: 500,
    max_tokens: 8000,
    features: ["每月 500 次 AI 调用", "单次 8000 token", "云备份", "高级写作模板", "专属客服"],
    limits: "每月 500 次，单次 8000 token",
  },
  {
    id: "yearly",
    name: "年卡VIP",
    level: 2,
    price: 99.9,
    duration_days: 365,
    monthly_calls: 500,
    max_tokens: 8000,
    features: ["每月 500 次 AI 调用", "单次 8000 token", "云备份", "高级写作模板", "专属客服", "优先体验新功能", "年度报告"],
    limits: "每月 500 次，单次 8000 token",
  },
];

// GET /api/v1/vip/packages - 套餐列表
router.get("/packages", (_req: Request, res: Response) => {
  res.json({ data: VIP_PACKAGES });
});

// GET /api/v1/vip/info - 会员信息
router.get("/info", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const [user] = await db
      .select({
        vipLevel: users.vipLevel,
        vipExpiresAt: users.vipExpiresAt,
        dailyAiCount: users.dailyAiCount,
        lastResetDate: users.lastResetDate,
        monthlyAiCount: users.monthlyAiCount,
        lastMonthlyReset: users.lastMonthlyReset,
        aiSettings: users.aiSettings,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      res.status(404).json({ success: false, error: "用户不存在" });
      return;
    }

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // 判断有效等级
    let effectiveLevel = Number(user.vipLevel || 0);
    if (effectiveLevel > 0) {
      const expiresAt = user.vipExpiresAt || "";
      if (expiresAt && new Date(expiresAt) <= now) {
        effectiveLevel = 0;
      }
    }

    // 检查自定义 API Key
    let hasCustomApiKey = false;
    try {
      const settings = typeof user.aiSettings === "string" ? JSON.parse(user.aiSettings) : (user.aiSettings || {});
      hasCustomApiKey = !!settings.customApiKey;
    } catch {}

    // 根据等级计算限额
    const ADMIN_EMAIL = "13252269161";
    const isAdmin = user.email === ADMIN_EMAIL;

    if (isAdmin) {
      res.json({
        data: {
          vipLevel: 99,
          tierName: "超级管理员",
          vipExpiresAt: "",
          isVip: true,
          isExpired: false,
          isAdmin: true,
          hasCustomApiKey,
          dailyAiCount: 0,
          dailyLimit: 999999,
          monthlyAiCount: 0,
          monthlyLimit: 999999,
          maxTokens: 999999,
          remainCount: 999999,
          usageType: "unlimited",
        },
      });
      return;
    }

    // 普通 / VIP 用户
    if (effectiveLevel === 0) {
      // 普通用户：每日字数
      let dailyChars = Number(user.dailyAiCount || 0);
      if (user.lastResetDate !== today) {
        dailyChars = 0;
      }

      const maxTokens = hasCustomApiKey ? 999999 : 2000;

      res.json({
        data: {
          vipLevel: 0,
          tierName: "普通用户",
          vipExpiresAt: "",
          isVip: false,
          isExpired: false,
          isAdmin: false,
          hasCustomApiKey,
          dailyAiCount: dailyChars,
          dailyLimit: 5000,
          monthlyAiCount: 0,
          monthlyLimit: 0,
          maxTokens,
          remainCount: Math.max(0, 5000 - dailyChars),
          usageType: "daily_chars",
          usageLabel: `${dailyChars} / 5000 字`,
        },
      });
    } else {
      // VIP：每月调用次数
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      let monthlyCalls = Number(user.monthlyAiCount || 0);
      if (user.lastMonthlyReset !== currentMonth) {
        monthlyCalls = 0;
      }

      const tierName = effectiveLevel === 1 ? "月卡VIP" : "年卡VIP";
      const maxTokens = hasCustomApiKey ? 999999 : 8000;

      res.json({
        data: {
          vipLevel: effectiveLevel,
          tierName,
          vipExpiresAt: user.vipExpiresAt || "",
          isVip: true,
          isExpired: false,
          isAdmin: false,
          hasCustomApiKey,
          dailyAiCount: 0,
          dailyLimit: 0,
          monthlyAiCount: monthlyCalls,
          monthlyLimit: 500,
          maxTokens,
          remainCount: Math.max(0, 500 - monthlyCalls),
          usageType: "monthly_calls",
          usageLabel: `${monthlyCalls} / 500 次`,
        },
      });
    }
  } catch (err: any) {
    console.error("VIP info error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/vip/subscribe - 购买/续费会员
router.post("/subscribe", requireAuth, async (req: Request, res: Response) => {
  try {
    const { packageId } = req.body;
    const userId = req.user!.id;

    const pkg = VIP_PACKAGES.find((p) => p.id === packageId);
    if (!pkg || pkg.level === 0) {
      res.status(400).json({ success: false, error: "无效的套餐" });
      return;
    }

    console.log(`[VIP] User ${userId} subscribing to ${pkg.name} (¥${pkg.price})`);

    // 模拟支付成功
    const now = new Date();
    const expiresAt = new Date(now.getTime() + pkg.duration_days * 24 * 60 * 60 * 1000);

    await db
      .update(users)
      .set({
        vipLevel: pkg.level,
        vipExpiresAt: expiresAt.toISOString(),
        monthlyAiCount: 0,
        lastMonthlyReset: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      })
      .where(eq(users.id, userId));

    res.json({
      success: true,
      data: {
        vipLevel: pkg.level,
        vipExpiresAt: expiresAt.toISOString(),
        packageName: pkg.name,
        message: `🎉 恭喜成为${pkg.name}！有效期至 ${expiresAt.toLocaleDateString("zh-CN")}`,
      },
    });
  } catch (err: any) {
    console.error("VIP subscribe error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;