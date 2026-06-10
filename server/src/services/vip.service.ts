import { db } from "../storage/database/client.js";
import { userVips, usageRecords, dailyTokenClaims, tasks, userTaskRecords, users } from "../storage/database/shared/schema.js";
import { eq, and, desc } from "drizzle-orm";

export type VipPlanType = 'free' | 'monthly' | 'yearly' | 'super_admin';

export interface VipPlan {
  type: VipPlanType;
  name: string;
  monthlyQuota: number;    // -1 表示无限
  dailyQuota: number;      // -1 表示无限
  dailyTokenQuota: number; // -1 表示余额制
  initialTokens: number;   // 升级时赠送的初始字数
  price?: string;
  features: string[];
}

export const VIP_PLANS: Record<VipPlanType, VipPlan> = {
  free: {
    type: 'free',
    name: '免费用户',
    monthlyQuota: 100,
    dailyQuota: 20,
    dailyTokenQuota: -1,
    initialTokens: 0,
    features: ['基础AI写作功能', '每月100次AI调用', '每日20次AI调用', '字数余额制', '可配置自定义API Key'],
  },
  monthly: {
    type: 'monthly',
    name: '月卡会员',
    monthlyQuota: -1,
    dailyQuota: -1,
    dailyTokenQuota: -1,
    initialTokens: 50000,
    price: '29.9元/月',
    features: ['全部AI写作功能', 'AI调用不限次数', '字数余额制（初始赠5万字）', '优先客服支持'],
  },
  yearly: {
    type: 'yearly',
    name: '年卡会员',
    monthlyQuota: -1,
    dailyQuota: -1,
    dailyTokenQuota: -1,
    initialTokens: 500000,
    price: '299元/年',
    features: ['全部AI写作功能', 'AI调用不限次数', '字数余额制（初始赠50万字）', '优先客服支持', '专属会员标识'],
  },
  super_admin: {
    type: 'super_admin',
    name: '超级管理员',
    monthlyQuota: -1,
    dailyQuota: -1,
    dailyTokenQuota: -1,
    initialTokens: 0,
    features: ['无限调用', '无限字数', '全部功能', '最高优先级'],
  },
};

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * 获取或创建用户VIP记录
 */
export async function getOrCreateUserVip(userId: string) {
  const existing = await db.select().from(userVips)
    .where(eq(userVips.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    let vip = existing[0];

    // 检查是否需要日重置
    const today = getTodayStr();
    if ((vip as any).lastResetDate !== today) {
      const updateData: any = {
        usedDaily: 0,
        lastResetDate: today,
      };

      // 同时检查月重置
      const currentMonth = today.substring(0, 7);
      const lastResetMonth = ((vip as any).lastMonthlyReset || '').substring(0, 7);
      if (lastResetMonth !== currentMonth) {
        updateData.usedMonthly = 0;
        (updateData as any).lastMonthlyReset = currentMonth;
      }

      const [updated] = await db.update(userVips)
        .set(updateData)
        .where(eq(userVips.id, vip.id))
        .returning();
      vip = updated;
    }

    return vip;
  }

  // 检查是否是超级管理员（手机号 13252269161）
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const isSuperAdmin = user?.email === '13252269161';

  const planType: VipPlanType = isSuperAdmin ? 'super_admin' : 'free';
  const plan = VIP_PLANS[planType];

  const [newVip] = await db.insert(userVips).values({
    userId,
    planType,
    status: 'active',
    monthlyQuota: plan.monthlyQuota,
    dailyQuota: plan.dailyQuota,
    dailyTokenQuota: plan.dailyTokenQuota,
    lastResetDate: getTodayStr(),
  }).returning();

  return newVip;
}

/**
 * 确保日/月数据已重置
 */
async function ensureReset(vip: any) {
  const today = getTodayStr();
  const needsUpdate: any = {};

  // 日重置
  if (vip.lastResetDate !== today) {
    needsUpdate.usedDaily = 0;
    needsUpdate.lastResetDate = today;
  }

  // 月重置
  const currentMonth = today.substring(0, 7);
  const lastResetMonth = ((vip as any).lastMonthlyReset || '').substring(0, 7);
  if (lastResetMonth !== currentMonth) {
    needsUpdate.usedMonthly = 0;
    (needsUpdate as any).lastMonthlyReset = currentMonth;
  }

  if (Object.keys(needsUpdate).length > 0) {
    await db.update(userVips)
      .set(needsUpdate)
      .where(eq(userVips.id, vip.id));
  }
}

/**
 * 检查用户是否有足够的调用次数（AI调用前检查）
 * @param useCustomKey 使用自定义Key时跳过字数检查
 */
export async function checkQuota(
  userId: string,
  _tokensNeeded: number = 0,
  useCustomKey: boolean = false
): Promise<{
  ok: boolean;
  reason?: string;
  remaining?: {
    daily: number;
    monthly: number;
    tokenBalance: number;
  };
}> {
  const vip = await getOrCreateUserVip(userId);

  if (vip.status !== 'active') {
    return { ok: false, reason: 'VIP状态异常，请联系客服' };
  }

  const plan = VIP_PLANS[vip.planType as VipPlanType] || VIP_PLANS.free;

  // 保证日/月数据准确
  await ensureReset(vip);
  const [updatedVip] = await db.select().from(userVips).where(eq(userVips.id, vip.id)).limit(1);
  const current = updatedVip || vip;

  const isUnlimited = plan.monthlyQuota === -1;
  const isSuperAdmin = plan.type === 'super_admin';

  // 超级管理员：无限
  if (isSuperAdmin) {
    return { ok: true, remaining: { daily: -1, monthly: -1, tokenBalance: -1 } };
  }

  // 免费用户：检查日调用次数
  if (!isUnlimited) {
    const dailyRemaining = plan.dailyQuota - (current.usedDaily || 0);
    if (dailyRemaining <= 0) {
      return {
        ok: false,
        reason: `今日AI调用次数已用完（每日${plan.dailyQuota}次），明天自动重置。升级VIP可享无限调用`,
        remaining: { daily: 0, monthly: plan.monthlyQuota - (current.usedMonthly || 0), tokenBalance: current.tokenBalance || 0 },
      };
    }

    // 检查月调用次数
    const monthlyRemaining = plan.monthlyQuota - (current.usedMonthly || 0);
    if (monthlyRemaining <= 0) {
      return {
        ok: false,
        reason: `本月AI调用次数已用完（每月${plan.monthlyQuota}次），升级VIP可享无限调用`,
        remaining: { daily: dailyRemaining, monthly: 0, tokenBalance: current.tokenBalance || 0 },
      };
    }
  }

  // 检查字数余额（自定义Key跳过）
  if (!useCustomKey && !isSuperAdmin) {
    const balance = current.tokenBalance || 0;
    if (balance <= 0) {
      return {
        ok: false,
        reason: '字数余额不足，请领取每日免费字数或购买字数包',
        remaining: {
          daily: isUnlimited ? -1 : plan.dailyQuota - (current.usedDaily || 0),
          monthly: isUnlimited ? -1 : plan.monthlyQuota - (current.usedMonthly || 0),
          tokenBalance: 0,
        },
      };
    }
  }

  return {
    ok: true,
    remaining: {
      daily: isUnlimited ? -1 : plan.dailyQuota - (current.usedDaily || 0),
      monthly: isUnlimited ? -1 : plan.monthlyQuota - (current.usedMonthly || 0),
      tokenBalance: useCustomKey ? -1 : (current.tokenBalance || 0),
    },
  };
}

/**
 * 扣减调用次数 + 扣除字数
 * @param useCustomKey 使用自定义Key时不扣字数，仅计调用次数
 */
export async function consumeQuota(
  userId: string,
  operationType: string,
  tokensUsed: number = 0,
  success: boolean = true,
  errorMessage?: string,
  useCustomKey: boolean = false
) {
  const vip = await getOrCreateUserVip(userId);
  const plan = VIP_PLANS[vip.planType as VipPlanType] || VIP_PLANS.free;

  // 保证日/月数据准确
  await ensureReset(vip);
  const [updatedVip] = await db.select().from(userVips).where(eq(userVips.id, vip.id)).limit(1);
  const current = updatedVip || vip;

  const isUnlimited = plan.monthlyQuota === -1;
  const isSuperAdmin = plan.type === 'super_admin';

  if (success) {
    const updateData: any = {};

    // 免费用户：扣日调用次数 + 月调用次数
    if (!isUnlimited) {
      updateData.usedDaily = (current.usedDaily || 0) + 1;
      updateData.usedMonthly = (current.usedMonthly || 0) + 1;
    }

    // 扣除字数（非自定义Key、非超级管理员时从tokenBalance扣）
    if (!useCustomKey && !isSuperAdmin && tokensUsed > 0) {
      const newBalance = Math.max(0, (current.tokenBalance || 0) - tokensUsed);
      updateData.tokenBalance = newBalance;
    }

    if (Object.keys(updateData).length > 0) {
      await db.update(userVips)
        .set(updateData)
        .where(eq(userVips.id, vip.id));
    }
  }

  // 记录使用日志
  await db.insert(usageRecords).values({
    userId,
    operationType,
    quotaUsed: isUnlimited ? 0 : 1,
    tokensUsed: useCustomKey || isSuperAdmin ? 0 : tokensUsed,
    success,
    errorMessage,
  });
}

/**
 * 领取每日免费token
 */
export async function claimDailyTokens(userId: string): Promise<{
  success: boolean;
  message: string;
  tokens?: number;
}> {
  const today = getTodayStr();

  // 检查今天是否已经领取过
  const existing = await db.select().from(dailyTokenClaims)
    .where(and(
      eq(dailyTokenClaims.userId, userId),
      eq(dailyTokenClaims.claimDate, today),
    ))
    .limit(1);

  if (existing.length > 0) {
    return { success: false, message: '今日已领取过免费字数' };
  }

  const vip = await getOrCreateUserVip(userId);

  // 记录领取
  await db.insert(dailyTokenClaims).values({
    userId,
    claimDate: today,
    tokensClaimed: 5000,
  });

  // 给用户余额增加5000字数
  await db.update(userVips)
    .set({ tokenBalance: (vip.tokenBalance || 0) + 5000 })
    .where(eq(userVips.id, vip.id));

  return {
    success: true,
    message: `成功领取 5000 字到余额`,
    tokens: 5000,
  };
}

/**
 * 检查今日是否已领取免费token
 */
export async function hasClaimedDailyTokens(userId: string): Promise<boolean> {
  const today = getTodayStr();
  const existing = await db.select().from(dailyTokenClaims)
    .where(and(
      eq(dailyTokenClaims.userId, userId),
      eq(dailyTokenClaims.claimDate, today),
    ))
    .limit(1);
  return existing.length > 0;
}

/**
 * 获取用户额度信息
 */
export async function getUserQuota(userId: string) {
  const vip = await getOrCreateUserVip(userId);
  const plan = VIP_PLANS[vip.planType as VipPlanType] || VIP_PLANS.free;
  await ensureReset(vip);
  const [freshVip] = await db.select().from(userVips).where(eq(userVips.id, vip.id)).limit(1);
  const current = freshVip || vip;
  const hasClaimed = await hasClaimedDailyTokens(userId);

  const isUnlimited = plan.monthlyQuota === -1;

  return {
    planType: current.planType,
    planName: plan.name,
    status: current.status,
    tokenBalance: current.tokenBalance || 0,
    daily: {
      total: plan.dailyQuota,
      used: current.usedDaily || 0,
      remaining: isUnlimited ? -1 : Math.max(0, plan.dailyQuota - (current.usedDaily || 0)),
    },
    monthly: {
      total: plan.monthlyQuota,
      used: current.usedMonthly || 0,
      remaining: isUnlimited ? -1 : Math.max(0, plan.monthlyQuota - (current.usedMonthly || 0)),
    },
    dailyTokens: {
      claimed: hasClaimed,
    },
    isUnlimited,
    isVip: plan.type === 'monthly' || plan.type === 'yearly',
  };
}

/**
 * 获取VIP套餐列表
 */
export function getVipPlans(): VipPlan[] {
  return Object.values(VIP_PLANS).filter(p => p.type !== 'super_admin');
}

/**
 * 升级VIP（模拟实现，实际需要对接支付系统）
 */
export async function upgradeVip(userId: string, planType: VipPlanType, durationMonths: number = 1) {
  const plan = VIP_PLANS[planType];
  if (!plan || planType === 'super_admin' || planType === 'free') {
    throw new Error('无效的套餐类型');
  }

  const vip = await getOrCreateUserVip(userId);

  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + durationMonths);

  // 升级时赠送初始字数
  const newBalance = (vip.tokenBalance || 0) + plan.initialTokens;

  const [updated] = await db.update(userVips)
    .set({
      planType,
      status: 'active',
      monthlyQuota: plan.monthlyQuota,
      dailyQuota: plan.dailyQuota,
      dailyTokenQuota: plan.dailyTokenQuota,
      tokenBalance: newBalance,
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
    })
    .where(eq(userVips.id, vip.id))
    .returning();

  return updated;
}

/**
 * 获取任务列表
 */
export async function getTaskList() {
  const tasksList = await db.select().from(tasks)
    .where(eq(tasks.isActive, true))
    .orderBy(tasks.sortOrder);
  return tasksList;
}

/**
 * 获取用户任务完成情况
 */
export async function getUserTasks(userId: string) {
  const allTasks = await getTaskList();
  const userRecords = await db.select().from(userTaskRecords)
    .where(eq(userTaskRecords.userId, userId));

  const recordMap = new Map(userRecords.map(r => [r.taskId, r]));

  return allTasks.map(task => ({
    ...task,
    status: recordMap.get(task.id)?.status || 'incomplete',
  }));
}

/**
 * 完成任务并领取奖励
 */
export async function completeTask(userId: string, taskId: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task || !task.isActive) {
    throw new Error('任务不存在或已下线');
  }

  const [existing] = await db.select().from(userTaskRecords)
    .where(and(
      eq(userTaskRecords.userId, userId),
      eq(userTaskRecords.taskId, taskId),
    ))
    .limit(1);

  if (existing && existing.status === 'claimed') {
    throw new Error('任务奖励已领取');
  }

  if (existing && existing.status === 'completed') {
    await claimTaskReward(userId, taskId, task.rewardQuota || 0, task.rewardTokens || 0);
    return { success: true, rewardQuota: task.rewardQuota, rewardTokens: task.rewardTokens };
  }

  await db.insert(userTaskRecords).values({
    userId,
    taskId,
    status: 'completed',
  });

  await claimTaskReward(userId, taskId, task.rewardQuota || 0, task.rewardTokens || 0);

  return { success: true, rewardQuota: task.rewardQuota, rewardTokens: task.rewardTokens };
}

async function claimTaskReward(userId: string, taskId: string, rewardQuota: number, rewardTokens: number) {
  const vip = await getOrCreateUserVip(userId);

  await db.update(userVips)
    .set({
      dailyQuota: vip.dailyQuota + rewardQuota,
      dailyTokenQuota: vip.dailyTokenQuota + rewardTokens,
    })
    .where(eq(userVips.id, vip.id));

  await db.update(userTaskRecords)
    .set({ status: 'claimed', claimedAt: new Date().toISOString() })
    .where(and(
      eq(userTaskRecords.userId, userId),
      eq(userTaskRecords.taskId, taskId),
    ));
}

/**
 * 获取用户使用记录
 */
export async function getUsageHistory(userId: string, limit: number = 20) {
  const records = await db.select().from(usageRecords)
    .where(eq(usageRecords.userId, userId))
    .orderBy(desc(usageRecords.createdAt))
    .limit(limit);
  return records;
}
