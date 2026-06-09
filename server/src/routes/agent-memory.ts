/**
 * Agent 长期记忆 API
 *
 * 职责：
 * 1. 保存 Agent 对话中产生的关键信息到长期记忆
 * 2. 查询与当前对话相关的记忆，注入到 Agent 系统提示词
 * 3. 支持手动管理记忆（查看/删除）
 */
import { Router, type Request, type Response } from "express";
import { db } from "../storage/database/client.js";
import { agentMemories } from "../storage/database/shared/schema.js";
import { eq, and, like, desc, asc, sql } from "drizzle-orm";

const router = Router();

// 获取用户ID
function getUserId(req: Request): string {
  return req.user?.id || "";
}

// ============ 1. 保存记忆 ============
// POST /api/v1/agent-memory/save
router.post("/save", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: "未登录" });

    const { key, content, source, conversationId } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, error: "内容不能为空" });
    }

    // 使用 upsert 逻辑：相同 user_id + key 时更新
    const existing = await db
      .select()
      .from(agentMemories)
      .where(and(eq(agentMemories.userId, userId), eq(agentMemories.key, key || "general")))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(agentMemories)
        .set({
          content,
          summary: req.body.summary || existing[0].summary,
          source: source || existing[0].source,
          conversationId: conversationId || existing[0].conversationId,
          updatedAt: sql`now()`,
        })
        .where(eq(agentMemories.id, existing[0].id));
    } else {
      await db.insert(agentMemories).values({
        userId,
        key: key || "general",
        content,
        summary: req.body.summary || "",
        source: source || "manual",
        conversationId: conversationId || "",
      });
    }

    res.json({ success: true, message: "记忆已保存" });
  } catch (err: any) {
    console.error("Save memory error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============ 2. 查询记忆（用于注入到 Agent prompt） ============
// GET /api/v1/agent-memory/query?keys=writing_style,user_prefs
router.get("/query", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: "未登录" });

    const keys = (req.query.keys as string)?.split(",").filter(Boolean) || [];

    let memories;
    if (keys.length > 0) {
      memories = await db
        .select()
        .from(agentMemories)
        .where(
          and(eq(agentMemories.userId, userId), sql`${agentMemories.key} = ANY(${keys}::text[])`)
        )
        .orderBy(desc(agentMemories.updatedAt));
    } else {
      memories = await db
        .select()
        .from(agentMemories)
        .where(eq(agentMemories.userId, userId))
        .orderBy(desc(agentMemories.updatedAt));
    }

    res.json({ success: true, data: memories });
  } catch (err: any) {
    console.error("Query memory error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============ 3. 获取所有记忆（用户管理用） ============
// GET /api/v1/agent-memory/list
router.get("/list", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: "未登录" });

    const memories = await db
      .select()
      .from(agentMemories)
      .where(eq(agentMemories.userId, userId))
      .orderBy(desc(agentMemories.updatedAt));

    res.json({ success: true, data: memories });
  } catch (err: any) {
    console.error("List memory error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============ 4. 删除记忆 ============
// DELETE /api/v1/agent-memory/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: "未登录" });

    const id = req.params.id as string;
    await db
      .delete(agentMemories)
      .where(
        and(eq(agentMemories.userId, userId), eq(agentMemories.id, id))
      );

    res.json({ success: true, message: "记忆已删除" });
  } catch (err: any) {
    console.error("Delete memory error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;