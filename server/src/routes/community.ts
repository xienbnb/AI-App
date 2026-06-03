import { Router, type Request, type Response } from "express";
import { getSupabaseClient } from "../storage/database/supabase-client.js";
import { toCamelCase } from "../utils/case-transform.js";

const router = Router();

// GET /api/v1/community - 获取帖子列表
router.get("/", async (req: Request, res: Response) => {
  try {
    const { tag } = req.query;
    const client = getSupabaseClient();

    let query = client.from("posts").select("*").order("created_at", { ascending: false });

    if (tag && tag !== "B 全部") {
      query = query.eq("tag", tag as string);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Get posts error:", error);
      return res.status(500).json({ success: false, message: "获取帖子失败" });
    }

    const posts = (data || []).map((row: any) => toCamelCase(row));
    res.json({ success: true, data: posts });
  } catch (err) {
    console.error("Get posts error:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// POST /api/v1/community - 创建帖子
router.post("/", async (req: Request, res: Response) => {
  try {
    const { userName, title, content, tag } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: "请输入标题" });
    }

    const client = getSupabaseClient();
    const { data, error } = await client.from("posts").insert({
      user_name: userName || "匿名用户",
      title: title.trim(),
      content: content || "",
      tag: tag || "B 全部",
      likes: 0,
      comments: 0,
      featured: 0,
    }).select().single();

    if (error) {
      console.error("Create post error:", error);
      return res.status(500).json({ success: false, message: "创建帖子失败" });
    }

    res.json({ success: true, data: toCamelCase(data) });
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// GET /api/v1/community/:id - 获取帖子详情
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = getSupabaseClient();
    const { data, error } = await client.from("posts").select("*").eq("id", id).single();

    if (error || !data) {
      return res.status(404).json({ success: false, message: "帖子不存在" });
    }

    res.json({ success: true, data: toCamelCase(data) });
  } catch (err) {
    console.error("Get post error:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// PUT /api/v1/community/:id/like - 点赞
router.put("/:id/like", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const client = getSupabaseClient();

    const { data: existing } = await client.from("posts").select("likes").eq("id", id).single();
    if (!existing) {
      return res.status(404).json({ success: false, message: "帖子不存在" });
    }

    const newLikes = (existing.likes || 0) + 1;
    const { error } = await client.from("posts").update({ likes: newLikes }).eq("id", id);

    if (error) {
      return res.status(500).json({ success: false, message: "点赞失败" });
    }

    res.json({ success: true, data: { likes: newLikes } });
  } catch (err) {
    console.error("Like post error:", err);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

export default router;
