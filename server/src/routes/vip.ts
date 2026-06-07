import { Router, type Request, type Response } from "express";
import {
  getOrCreateUserVip,
  getUserQuota,
  getVipPlans,
  upgradeVip,
  claimDailyTokens,
  hasClaimedDailyTokens,
  getTaskList,
  getUserTasks,
  completeTask,
  getUsageHistory,
  type VipPlanType,
} from "../services/vip.service.js";
import {
  getUserApiKeys,
  addApiKey,
  updateApiKey,
  deleteApiKey,
  setActiveApiKey,
} from "../services/api-key.service.js";
import { clearUserClientCache } from "../utils/ai-client.js";
import { db } from "../storage/database/client.js";
import { users } from "../storage/database/shared/schema.js";
import { eq } from "drizzle-orm";

const router = Router();

// ==================== 查询类接口 ====================

// 获取用户额度信息（别名：/info）
router.get("/info", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "未登录" });
      return;
    }
    const vipInfo = await getOrCreateUserVip(userId);
    
    // 查询用户角色
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const isAdmin = user?.role === 'admin';
    
    // 映射到前端期望的格式
    const levelMap: Record<string, number> = { free: 0, monthly: 1, yearly: 2, super_admin: 0 };
    const tierMap: Record<string, string> = { free: '普通用户', monthly: '月卡VIP', yearly: '年卡VIP', super_admin: '管理员' };
    
    const vipLevel = levelMap[vipInfo.planType] ?? 0;
    const isVip = vipInfo.planType === 'monthly' || vipInfo.planType === 'yearly';
    const now = new Date();
    const endDate = vipInfo.endDate ? new Date(vipInfo.endDate) : null;
    const isExpired = isVip && endDate ? endDate < now : false;
    
    res.json({
      success: true,
      data: {
        vipLevel,
        vipExpiresAt: vipInfo.endDate || "",
        dailyAiCount: vipInfo.usedDaily || 0,
        dailyLimit: vipInfo.dailyQuota || 50,
        isExpired,
        isVip: isVip && !isExpired,
        remainCount: Math.max(0, (vipInfo.dailyQuota || 50) - (vipInfo.usedDaily || 0)),
        maxTokens: vipInfo.dailyTokenQuota || 2000,
        usedDailyTokens: vipInfo.usedDailyTokens || 0,
        tierName: isAdmin ? '管理员' : (tierMap[vipInfo.planType] || '普通用户'),
        isAdmin,
        monthlyLimit: vipInfo.monthlyQuota || 500,
        usedMonthly: vipInfo.usedMonthly || 0,
      },
    });
  } catch (err: any) {
    console.error("[VIP] Info error:", err);
    res.status(500).json({ error: err.message || "获取VIP信息失败" });
  }
});

// 获取用户额度信息
router.get("/quota", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "未登录" });
    }

    const quota = await getUserQuota(userId);
    res.json({ success: true, data: quota });
  } catch (err: any) {
    console.error("[VIP] Get quota error:", err);
    res.status(500).json({ success: false, error: err.message || "获取额度信息失败" });
  }
});

// 获取VIP套餐列表（别名：/packages）
router.get("/packages", async (_req: Request, res: Response) => {
  try {
    const plans = getVipPlans();
    res.json({ success: true, data: plans });
  } catch (err: any) {
    console.error("[VIP] Packages error:", err);
    res.status(500).json({ error: err.message || "获取套餐失败" });
  }
});

// 获取VIP套餐列表
router.get("/plans", async (_req: Request, res: Response) => {
  try {
    const plans = getVipPlans();
    res.json({ success: true, data: plans });
  } catch (err: any) {
    console.error("[VIP] Get plans error:", err);
    res.status(500).json({ success: false, error: "获取套餐列表失败" });
  }
});

// 获取使用记录
router.get("/usage", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "未登录" });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const records = await getUsageHistory(userId, Math.min(limit, 100));
    res.json({ success: true, data: records });
  } catch (err: any) {
    console.error("[VIP] Get usage error:", err);
    res.status(500).json({ success: false, error: "获取使用记录失败" });
  }
});

// ==================== 操作类接口 ====================

// 领取每日免费字数
router.post("/claim-daily", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "未登录" });
    }

    const result = await claimDailyTokens(userId);
    res.json({
      success: result.success,
      message: result.message,
      data: result.success ? { tokens: result.tokens } : undefined,
    });
  } catch (err: any) {
    console.error("[VIP] Claim daily error:", err);
    res.status(500).json({ success: false, error: err.message || "领取失败" });
  }
});

// 检查今日是否已领取
router.get("/claim-daily/status", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "未登录" });
    }

    const claimed = await hasClaimedDailyTokens(userId);
    res.json({ success: true, data: { claimed } });
  } catch (err: any) {
    console.error("[VIP] Check claim status error:", err);
    res.status(500).json({ success: false, error: "检查状态失败" });
  }
});

// 升级VIP（模拟接口，实际需要支付系统）
router.post("/upgrade", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "未登录" });
    }

    const { planType, duration } = req.body;
    if (!planType || !['monthly', 'yearly'].includes(planType)) {
      return res.status(400).json({ success: false, error: "无效的套餐类型" });
    }

    const durationMonths = planType === 'yearly' ? 12 : (duration || 1);
    const result = await upgradeVip(userId, planType as VipPlanType, durationMonths);

    res.json({
      success: true,
      message: `成功升级为${result.planType === 'yearly' ? '年卡' : '月卡'}会员`,
      data: {
        planType: result.planType,
        endDate: result.endDate,
      },
    });
  } catch (err: any) {
    console.error("[VIP] Upgrade error:", err);
    res.status(500).json({ success: false, error: err.message || "升级失败" });
  }
});

// ==================== 任务系统 ====================

// 获取任务列表
router.get("/tasks", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      // 未登录也可以看任务列表
      const tasks = await getTaskList();
      return res.json({ success: true, data: tasks });
    }

    const userTasks = await getUserTasks(userId);
    res.json({ success: true, data: userTasks });
  } catch (err: any) {
    console.error("[VIP] Get tasks error:", err);
    res.status(500).json({ success: false, error: "获取任务列表失败" });
  }
});

// 完成任务并领取奖励
router.post("/tasks/:taskId/claim", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "未登录" });
    }

    const { taskId } = req.params;
    const result = await completeTask(userId, taskId as string);

    res.json({
      success: true,
      message: `任务完成，获得 ${result.rewardQuota} 次调用次数和 ${result.rewardTokens} 字额度`,
      data: result,
    });
  } catch (err: any) {
    console.error("[VIP] Complete task error:", err);
    res.status(400).json({ success: false, error: err.message || "任务完成失败" });
  }
});

// ==================== API Key 管理 ====================

// 获取用户API Key列表
router.get("/api-keys", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "未登录" });
    }

    const keys = await getUserApiKeys(userId);
    res.json({ success: true, data: keys });
  } catch (err: any) {
    console.error("[VIP] Get api keys error:", err);
    res.status(500).json({ success: false, error: err.message || "获取API Key失败" });
  }
});

// 添加API Key
router.post("/api-keys", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "未登录" });
    }

    const { keyName, provider, apiKey, apiBase, model, rateLimitPerMinute } = req.body;
    if (!apiKey) {
      return res.status(400).json({ success: false, error: "API Key不能为空" });
    }

    const result = await addApiKey(userId, {
      keyName: keyName || '默认Key',
      provider: provider || 'custom',
      apiKey,
      apiBase,
      model,
      rateLimitPerMinute,
    });

    // 清除AI客户端缓存，下次请求使用新的Key
    clearUserClientCache(userId);

    res.json({
      success: true,
      message: "API Key添加成功",
      data: result,
    });
  } catch (err: any) {
    console.error("[VIP] Add api key error:", err);
    res.status(400).json({ success: false, error: err.message || "添加失败" });
  }
});

// 更新API Key
router.put("/api-keys/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "未登录" });
    }

    const { id } = req.params;
    const { keyName, apiKey, apiBase, model, rateLimitPerMinute, isActive } = req.body;

    const result = await updateApiKey(userId, id as string, {
      keyName,
      apiKey,
      apiBase,
      model,
      rateLimitPerMinute,
      isActive,
    });

    // 清除AI客户端缓存
    clearUserClientCache(userId);

    res.json({
      success: true,
      message: "更新成功",
      data: result,
    });
  } catch (err: any) {
    console.error("[VIP] Update api key error:", err);
    res.status(400).json({ success: false, error: err.message || "更新失败" });
  }
});

// 设置激活的API Key
router.post("/api-keys/:id/activate", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "未登录" });
    }

    const { id } = req.params;
    await setActiveApiKey(userId, id as string);

    // 清除AI客户端缓存，下次使用新激活的Key
    clearUserClientCache(userId);

    res.json({ success: true, message: "已设为默认使用" });
  } catch (err: any) {
    console.error("[VIP] Activate api key error:", err);
    res.status(400).json({ success: false, error: err.message || "设置失败" });
  }
});

// 删除API Key
router.delete("/api-keys/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "未登录" });
    }

    const { id } = req.params;
    await deleteApiKey(userId, id as string);

    // 清除AI客户端缓存
    clearUserClientCache(userId);

    res.json({ success: true, message: "删除成功" });
  } catch (err: any) {
    console.error("[VIP] Delete api key error:", err);
    res.status(400).json({ success: false, error: err.message || "删除失败" });
  }
});

export default router;
