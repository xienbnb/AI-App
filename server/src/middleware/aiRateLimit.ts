import type { Request, Response, NextFunction } from "express";
import { db } from "../storage/database/client.js";
import { users } from "../storage/database/shared/schema.js";
import { eq } from "drizzle-orm";

/**
 * VIP 分级限流中间件
 *
 * 规则：
 * - 管理员（手机 13252269161）：跳过所有限制
 * - 普通用户（level 0）：每日 5000 字额度（按 token 字数估算）
 * - 月卡VIP（level 1）：每月 500 次调用，8000 token/次
 * - 年卡VIP（level 2）：每月 500 次调用，8000 token/次
 * - 自定义 API Key：跳过 token 限制，仍受调用次数限制
 *
 * 刷新周期：
 * - 普通用户：每天 0 点重置
 * - VIP：每月 1 号重置
 */
const TIER_CONFIG: Record<number, { type: "daily_chars" | "monthly_calls"; limit: number; maxTokens: number; label: string }> = {
  0: { type: "daily_chars", limit: 5000, maxTokens: 2000, label: "普通用户" },
  1: { type: "monthly_calls", limit: 500, maxTokens: 8000, label: "月卡VIP" },
  2: { type: "monthly_calls", limit: 500, maxTokens: 8000, label: "年卡VIP" },
};

const ADMIN_EMAIL = "13252269161";

export async function aiRateLimit(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "请先登录" });
      return;
    }

    // 查询用户完整信息
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        vipLevel: users.vipLevel,
        vipExpiresAt: users.vipExpiresAt,
        dailyAiCount: users.dailyAiCount,
        lastResetDate: users.lastResetDate,
        monthlyAiCount: users.monthlyAiCount,
        lastMonthlyReset: users.lastMonthlyReset,
        aiSettings: users.aiSettings,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      res.status(401).json({ success: false, error: "用户不存在" });
      return;
    }

    // ── 1. 管理员检查：跳过所有限制 ──
    if (user.email === ADMIN_EMAIL) {
      (req as any).maxTokensPerRequest = 16000;
      return next();
    }

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // ── 2. 判断有效会员等级（检查过期） ──
    let effectiveLevel = Number(user.vipLevel || 0);
    if (effectiveLevel > 0) {
      const expiresAt = user.vipExpiresAt || "";
      if (expiresAt && new Date(expiresAt) <= now) {
        effectiveLevel = 0; // 已过期，降为普通用户
      }
    }

    const config = TIER_CONFIG[effectiveLevel];

    // ── 3. 检查是否有自定义 API Key ──
    let hasCustomApiKey = false;
    try {
      const settings = typeof user.aiSettings === "string" ? JSON.parse(user.aiSettings) : (user.aiSettings || {});
      hasCustomApiKey = !!settings.customApiKey;
    } catch {}

    // 有自定义 API Key 则不受 token 上限限制
    const maxTokens = hasCustomApiKey ? 999999 : config.maxTokens;
    (req as any).maxTokensPerRequest = maxTokens;

    // ── 4. 按等级执行限流 ──
    if (config.type === "daily_chars") {
      // 普通用户：按天重置字数
      let dailyChars = Number(user.dailyAiCount || 0);
      if (user.lastResetDate !== today) {
        dailyChars = 0;
        await db.update(users).set({ dailyAiCount: 0, lastResetDate: today }).where(eq(users.id, userId));
      }

      if (dailyChars >= config.limit) {
        res.status(403).json({
          success: false,
          error: `今日写作字数已达上限（${config.limit}字），升级VIP解锁更多额度`,
          data: { used: dailyChars, limit: config.limit, tier: config.label },
        });
        return;
      }

      // 按 token 上限估算本次消耗字数，预先扣除
      const estimatedChars = Math.min(maxTokens, config.limit - dailyChars);
      await db.update(users).set({ dailyAiCount: dailyChars + estimatedChars }).where(eq(users.id, userId));
    } else {
      // VIP 用户：按月重置调用次数
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      let monthlyCalls = Number(user.monthlyAiCount || 0);

      if (user.lastMonthlyReset !== currentMonth) {
        monthlyCalls = 0;
        await db.update(users).set({ monthlyAiCount: 0, lastMonthlyReset: currentMonth }).where(eq(users.id, userId));
      }

      if (monthlyCalls >= config.limit) {
        res.status(403).json({
          success: false,
          error: `本月AI调用次数已达上限（${config.limit}次），下月1号重置`,
          data: { used: monthlyCalls, limit: config.limit, tier: config.label },
        });
        return;
      }

      await db.update(users).set({ monthlyAiCount: monthlyCalls + 1 }).where(eq(users.id, userId));
    }

    next();
  } catch (err: any) {
    console.error("AI rate limit error:", err.message);
    // 出错时放行，避免影响用户体验
    (req as any).maxTokensPerRequest = 2000;
    next();
  }
}