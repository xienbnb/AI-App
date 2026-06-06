/**
 * AI 工作流 API 路由
 * 
 * 提供高质量、分阶段的 AI 生成接口
 */

import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { quotaMiddleware } from "../middleware/quota.middleware.js";
import { executeWorkflow, chapterGenerationWorkflow, polishWorkflow } from "../ai-workflow/index.js";

const router = Router();

// 所有接口都需要认证和限流
router.use(requireAuth);
router.use(quotaMiddleware);

/**
 * POST /api/v1/workflow/chapter
 * 高质量章节生成（工作流版本）
 * 
 * Body:
 * - bookTitle: 书名
 * - genre: 类型
 * - previousContent: 上文内容摘要
 * - requirements: 本章要求
 * - style: 风格要求（可选）
 */
router.post("/chapter", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { bookTitle, genre, previousContent, requirements, style } = req.body;

    // 启动流式响应
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, no-transform, must-revalidate");
    res.setHeader("Connection", "keep-alive");

    // 发送开始事件
    sseSend(res, "start", {
      message: "开始生成章节",
      totalSteps: chapterGenerationWorkflow.length,
      steps: chapterGenerationWorkflow.map(s => ({ id: s.id, name: s.name })),
    });

    const context = {
      bookTitle: bookTitle || "未命名",
      genre: genre || "玄幻",
      previousContent: previousContent || "暂无前文",
      requirements: requirements || "请生成一个精彩的章节",
      style: style || "",
    };

    let currentStepIndex = 0;

    const result = await executeWorkflow(chapterGenerationWorkflow, context, {
      onStepComplete: (stepId, output) => {
        currentStepIndex++;
        sseSend(res, "step_complete", {
          stepId,
          stepName: chapterGenerationWorkflow.find(s => s.id === stepId)?.name,
          stepIndex: currentStepIndex,
          output: stepId === "drafting" || stepId === "polishing" ? output : undefined,
        });
      },
    });

    if (result.success) {
      sseSend(res, "complete", {
        output: result.output,
        totalSteps: result.steps.length,
      });
    } else {
      sseSend(res, "error", {
        message: result.error || "生成失败",
      });
    }

    res.end();
  } catch (error: any) {
    console.error("Chapter workflow error:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message || "生成失败" });
    }
  }
});

/**
 * POST /api/v1/workflow/polish
 * 智能润色（工作流版本）
 * 
 * Body:
 * - text: 待润色的文本
 * - requirements: 润色要求
 */
router.post("/polish", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { text, requirements } = req.body;

    if (!text) {
      return res.status(400).json({ success: false, message: "请提供待润色的文本" });
    }

    const context = {
      text: text.substring(0, 10000), // 限制长度
      requirements: requirements || "全面提升文字质量",
    };

    const result = await executeWorkflow(polishWorkflow, context);

    if (result.success) {
      res.json({
        success: true,
        data: {
          polishedText: result.output,
          steps: result.steps.map(s => ({
            stepId: s.stepId,
            stepName: polishWorkflow.find(w => w.id === s.stepId)?.name,
            duration: s.duration,
          })),
        },
      });
    } else {
      res.status(500).json({ success: false, message: result.error || "润色失败" });
    }
  } catch (error: any) {
    console.error("Polish workflow error:", error);
    res.status(500).json({ success: false, message: error.message || "润色失败" });
  }
});

/**
 * GET /api/v1/workflow/templates
 * 获取可用的工作流模板列表
 */
router.get("/templates", (_req: Request, res: Response) => {
  const templates = [
    {
      id: "chapter",
      name: "高质量章节生成",
      description: "四阶段工作流：规划→起草→润色→质检，生成高质量小说章节",
      steps: 4,
      estimatedTime: "30-60秒",
      aiCallsCost: 1, // 消耗 1 次调用次数（虽然内部多次调用）
      requiredVipLevel: 2, // 需要年卡会员
    },
    {
      id: "polish",
      name: "智能润色",
      description: "先分析后润色，针对性提升文字质量",
      steps: 2,
      estimatedTime: "15-30秒",
      aiCallsCost: 1,
      requiredVipLevel: 1, // 月卡及以上
    },
    {
      id: "outline",
      name: "专业大纲生成",
      description: "从核心创意到完整大纲，多层级细化",
      steps: 3,
      estimatedTime: "20-40秒",
      aiCallsCost: 1,
      requiredVipLevel: 1,
    },
  ];

  res.json({
    success: true,
    data: templates,
  });
});

// ==================== 工具函数 ====================

function sseSend(res: Response, event: string, data: any) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export default router;
