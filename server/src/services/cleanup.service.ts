import { db } from "../storage/database/client.js";
import { users } from "../storage/database/shared/schema.js";
import { eq, sql, and, lt } from "drizzle-orm";

/**
 * 清理7天内未活动的游客账号
 * 游客账号：role = 'guest'
 * 未活动：last_active_at < 7天前 或 last_active_at IS NULL
 * 使用 createdAt 作为判断依据（游客没有登录即表示未活动）
 */
export async function cleanupGuestUsers() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const result = await db.delete(users)
    .where(
      and(
        eq(users.role, 'guest'),
        sql`(${users.createdAt} IS NULL OR ${users.createdAt}::timestamp < ${sevenDaysAgo}::timestamp)`
      )
    )
    .returning({ id: users.id });

  return { deleted: result.length };
}