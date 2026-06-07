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
    monthlyQuota: -1,
    dailyQuota: 100,              // 每日100次AI调用
    dailyTokenQuota: -1,          // 字数不设日限，从余额扣除
    features: ['基础AI写作功能', '每日100次AI调用', '字数用完需购买'],
  },
  monthly: {
    type: 'monthly',
    name: '月卡会员',
    monthlyQuota: -1,
    dailyQuota: -1,
    dailyTokenQuota: -1,
    price: '29.9元/月',
    features: ['全部AI写作功能', 'AI调用不限次数', '字数使用不限量', '优先客服支持'],
  },
  yearly: {
    type: 'yearly',
    name: '年卡会员',
    monthlyQuota: -1,
    dailyQuota: -1,
    dailyTokenQuota: -1,
    price: '299元/年',
    features: ['全部AI写作功能', 'AI调用不限次数', '字数使用不限量', '优先客服支持', '专属会员标识'],
  },
  super_admin: {
    type: 'super_admin',
    name: '超级管理员',
    monthlyQuota: -1,
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
    
    // 检查是否需要重置日调用次数
    const today = getTodayStr();
    if (vip.lastResetDate !== today) {
      // 重置日调用次数
      const updateData: any = {
        usedDaily: 0,
        lastResetDate: today,
      };
      
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
 * 检查用户是否有足够的调用次数（AI调用前检查）
 */
export async function checkQuota(userId: string, _tokensNeeded: number = 0): Promise<{
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
  
  // VIP/管理员: 不限调用次数，但字数（Token）仍从余额扣除
  if (plan.dailyQuota === -1) {
    return { 
      ok: true, 
      remaining: { daily: -1, monthly: -1, dailyTokens: vip.tokenBalance || 0 } 
    };
  }
  
  // 检查日调用次数（免费用户每日100次）
  if (vip.usedDaily >= plan.dailyQuota) {
    return { ok: false, reason: '今日AI调用次数已用完（每日100次），升级VIP可享无限调用' };
  }
  
  return {
    ok: true,
    remaining: {
      daily: Math.max(0, plan.dailyQuota - vip.usedDaily),
      monthly: -1,
      dailyTokens: vip.tokenBalance || 0,
    },
  };
}

/**
 * 扣减调用次数 + 扣除字数（从余额扣除，非日限）
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
  
  // VIP/管理员不扣调用次数，但需要扣字数
  const isUnlimited = plan.dailyQuota === -1;
  
  if (!isUnlimited && success) {
    // 免费用户：扣调用次数
    await db.update(userVips)
      .set({
        usedDaily: vip.usedDaily + 1,
      })
      .where(eq(userVips.id, vip.id));
  }
  
  // 扣除字数（从tokenBalance扣，所有用户包括VIP都要扣）
  if (success && tokensUsed > 0 && (vip.tokenBalance || 0) > 0) {
    const newBalance = Math.max(0, (vip.tokenBalance || 0) - tokensUsed);
    await db.update(userVips)
      .set({ tokenBalance: newBalance })
      .where(eq(userVips.id, vip.id));
    
    // 记录扣费明细
    await db.insert(usageRecords).values({
      userId,
      operationType,
      quotaUsed: 1,
      tokensUsed,
      success,
      errorMessage,
    });
  } else {
    // 记录使用日志（不扣字数）
    await db.insert(usageRecords).values({
      userId,
      operationType,
      quotaUsed: isUnlimited ? 0 : 1,
      tokensUsed,
      success,
      errorMessage,
    });
  }
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
    dailyTokens: {
      total: -1,          // 不设日限
      used: 0,
      remaining: vip.tokenBalance || 0,
      claimed: hasClaimed,
    },
    isUnlimited: plan.dailyQuota === -1,
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
