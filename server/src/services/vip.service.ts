import { db } from "../storage/database/client.js";
import { userVips, usageRecords, dailyTokenClaims, tasks, userTaskRecords, users } from "../storage/database/shared/schema.js";
import { eq, and, desc, gte, lt } from "drizzle-orm";

export type VipPlanType = 'free' | 'monthly' | 'yearly' | 'super_admin';

export interface VipPlan {
  type: VipPlanType;
  name: string;
  monthlyQuota: number;
  dailyQuota: number;
  dailyTokenQuota: number;
  price?: string;
  features: string[];
}

export const VIP_PLANS: Record<VipPlanType, VipPlan> = {
  free: {
    type: 'free',
    name: '免费用户',
    monthlyQuota: 50,
    dailyQuota: 10,
    dailyTokenQuota: 5000,
    features: ['基础AI写作功能', '每日10次调用', '每日5000字免费额度'],
  },
  monthly: {
    type: 'monthly',
    name: '月卡会员',
    monthlyQuota: 500,
    dailyQuota: 50,
    dailyTokenQuota: 50000,
    price: '29.9元/月',
    features: ['全部AI写作功能', '每日50次调用', '每日5万字额度', '优先客服支持'],
  },
  yearly: {
    type: 'yearly',
    name: '年卡会员',
    monthlyQuota: 500,
    dailyQuota: 50,
    dailyTokenQuota: 50000,
    price: '299元/年',
    features: ['全部AI写作功能', '每日50次调用', '每日5万字额度', '优先客服支持', '专属会员标识'],
  },
  super_admin: {
    type: 'super_admin',
    name: '超级管理员',
    monthlyQuota: -1, // -1 表示无限
    dailyQuota: -1,
    dailyTokenQuota: -1,
    features: ['无限调用', '全部功能', '最高优先级'],
  },
};

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function getMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 获取或创建用户VIP记录
 */
export async function getOrCreateUserVip(userId: string) {
  // 先查询
  const existing = await db.select().from(userVips)
    .where(eq(userVips.userId, userId))
    .limit(1);
  
  if (existing.length > 0) {
    let vip = existing[0];
    
    // 检查是否需要重置日额度
    const today = getTodayStr();
    if (vip.lastResetDate !== today) {
      // 重置日额度
      const updateData: any = {
        usedDaily: 0,
        usedDailyTokens: 0,
        lastResetDate: today,
      };
      
      // 检查是否需要重置月额度（每月1号）
      const todayDate = new Date(today);
      if (todayDate.getDate() === 1) {
        updateData.usedMonthly = 0;
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
 * 检查用户是否有足够的额度
 */
export async function checkQuota(userId: string, tokensNeeded: number = 0): Promise<{
  ok: boolean;
  reason?: string;
  remaining?: {
    daily: number;
    monthly: number;
    dailyTokens: number;
  };
}> {
  const vip = await getOrCreateUserVip(userId);
  
  if (vip.status !== 'active') {
    return { ok: false, reason: 'VIP状态异常，请联系客服' };
  }
  
  const plan = VIP_PLANS[vip.planType as VipPlanType] || VIP_PLANS.free;
  
  // 无限额度
  if (plan.dailyQuota === -1 && plan.monthlyQuota === -1 && plan.dailyTokenQuota === -1) {
    return { 
      ok: true, 
      remaining: { daily: -1, monthly: -1, dailyTokens: -1 } 
    };
  }
  
  // 检查日次数
  if (plan.dailyQuota >= 0 && vip.usedDaily >= plan.dailyQuota) {
    return { ok: false, reason: '今日调用次数已用完，请明天再来或升级VIP' };
  }
  
  // 检查月次数
  if (plan.monthlyQuota >= 0 && vip.usedMonthly >= plan.monthlyQuota) {
    return { ok: false, reason: '本月调用次数已用完，请下月再来或升级VIP' };
  }
  
  // 检查token额度（如果传入了）
  if (tokensNeeded > 0 && plan.dailyTokenQuota >= 0) {
    if (vip.usedDailyTokens + tokensNeeded > plan.dailyTokenQuota) {
      return { ok: false, reason: '今日字数额度不足，请明天再来或升级VIP' };
    }
  }
  
  return {
    ok: true,
    remaining: {
      daily: Math.max(0, plan.dailyQuota - vip.usedDaily),
      monthly: Math.max(0, plan.monthlyQuota - vip.usedMonthly),
      dailyTokens: Math.max(0, plan.dailyTokenQuota - vip.usedDailyTokens),
    },
  };
}

/**
 * 扣减用户额度
 */
export async function consumeQuota(
  userId: string, 
  operationType: string, 
  tokensUsed: number = 0,
  success: boolean = true,
  errorMessage?: string
) {
  const vip = await getOrCreateUserVip(userId);
  const plan = VIP_PLANS[vip.planType as VipPlanType] || VIP_PLANS.free;
  
  // 无限额度不扣减，但记录使用
  const isUnlimited = plan.dailyQuota === -1 && plan.monthlyQuota === -1;
  
  if (!isUnlimited && success) {
    // 扣减额度
    await db.update(userVips)
      .set({
        usedDaily: vip.usedDaily + 1,
        usedMonthly: vip.usedMonthly + 1,
        usedDailyTokens: vip.usedDailyTokens + tokensUsed,
      })
      .where(eq(userVips.id, vip.id));
  }
  
  // 记录使用日志
  await db.insert(usageRecords).values({
    userId,
    operationType,
    quotaUsed: 1,
    tokensUsed,
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
  const plan = VIP_PLANS[vip.planType as VipPlanType] || VIP_PLANS.free;
  
  // 记录领取
  await db.insert(dailyTokenClaims).values({
    userId,
    claimDate: today,
    tokensClaimed: plan.dailyTokenQuota,
  });
  
  // 更新用户的日token额度（这里简化处理，直接增加额度）
  // 实际上我们已经在 getOrCreateUserVip 中设置了每日额度，领取只是确认使用
  // 所以这里不需要额外增加，只是标记已领取
  
  return {
    success: true,
    message: `成功领取 ${plan.dailyTokenQuota} 字免费额度`,
    tokens: plan.dailyTokenQuota,
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
  const hasClaimed = await hasClaimedDailyTokens(userId);
  
  return {
    planType: vip.planType,
    planName: plan.name,
    status: vip.status,
    tokenBalance: vip.tokenBalance || 0,
    daily: {
      total: plan.dailyQuota,
      used: vip.usedDaily,
      remaining: plan.dailyQuota === -1 ? -1 : Math.max(0, plan.dailyQuota - vip.usedDaily),
    },
    monthly: {
      total: plan.monthlyQuota,
      used: vip.usedMonthly,
      remaining: plan.monthlyQuota === -1 ? -1 : Math.max(0, plan.monthlyQuota - vip.usedMonthly),
    },
    dailyTokens: {
      total: plan.dailyTokenQuota,
      used: vip.usedDailyTokens,
      remaining: plan.dailyTokenQuota === -1 ? -1 : Math.max(0, plan.dailyTokenQuota - vip.usedDailyTokens),
      claimed: hasClaimed,
    },
    isUnlimited: plan.dailyQuota === -1 && plan.monthlyQuota === -1,
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
  
  const [updated] = await db.update(userVips)
    .set({
      planType,
      status: 'active',
      monthlyQuota: plan.monthlyQuota,
      dailyQuota: plan.dailyQuota,
      dailyTokenQuota: plan.dailyTokenQuota,
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
  // 检查任务是否存在
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task || !task.isActive) {
    throw new Error('任务不存在或已下线');
  }
  
  // 检查是否已完成
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
    // 直接领取奖励
    await claimTaskReward(userId, taskId, task.rewardQuota || 0, task.rewardTokens || 0);
    return { success: true, rewardQuota: task.rewardQuota, rewardTokens: task.rewardTokens };
  }
  
  // 创建完成记录
  await db.insert(userTaskRecords).values({
    userId,
    taskId,
    status: 'completed',
  });
  
  // 领取奖励
  await claimTaskReward(userId, taskId, task.rewardQuota || 0, task.rewardTokens || 0);
  
  return { success: true, rewardQuota: task.rewardQuota, rewardTokens: task.rewardTokens };
}

async function claimTaskReward(userId: string, taskId: string, rewardQuota: number, rewardTokens: number) {
  const vip = await getOrCreateUserVip(userId);
  
  // 增加额度
  await db.update(userVips)
    .set({
      dailyQuota: vip.dailyQuota + rewardQuota,
      dailyTokenQuota: vip.dailyTokenQuota + rewardTokens,
    })
    .where(eq(userVips.id, vip.id));
  
  // 更新任务记录状态
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
