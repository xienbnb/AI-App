import { Router, type Request, type Response } from 'express';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import crypto from 'crypto';
import dayjs from 'dayjs';

const router = Router();

// ==================== 内存存储 ====================
interface Article {
  id: string;
  title: string;
  content: string;
  topic: string;
  createdAt: string;
  updatedAt: string;
}

const articles = new Map<string, Article>();

// ==================== GET /api/v1/writing - 获取文章列表 ====================
router.get('/', (_req: Request, res: Response) => {
  const list = Array.from(articles.values())
    .sort((a, b) => dayjs(b.updatedAt).unix() - dayjs(a.updatedAt).unix());

  res.json({ success: true, data: list });
});

// ==================== GET /api/v1/writing/:id - 获取文章详情 ====================
router.get('/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const article = articles.get(id);
  if (!article) {
    res.status(404).json({ success: false, message: '文章不存在' });
    return;
  }
  res.json({ success: true, data: article });
});

// ==================== POST /api/v1/writing - 保存文章 ====================
router.post('/', (req: Request, res: Response) => {
  const { title, content, topic } = req.body;

  if (!title || !content) {
    res.status(400).json({ success: false, message: '标题和内容不能为空' });
    return;
  }

  const id = crypto.randomUUID();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const article: Article = {
    id,
    title,
    content,
    topic: topic || '',
    createdAt: now,
    updatedAt: now,
  };

  articles.set(id, article);
  res.json({ success: true, data: article });
});

// ==================== DELETE /api/v1/writing/:id - 删除文章 ====================
router.delete('/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  if (!articles.has(id)) {
    res.status(404).json({ success: false, message: '文章不存在' });
    return;
  }
  articles.delete(id);
  res.json({ success: true, message: '删除成功' });
});

// ==================== POST /api/v1/writing/generate - AI写作生成（SSE流式） ====================
router.post('/generate', async (req: Request, res: Response) => {
  const { topic, writingStyle, wordCount } = req.body;

  if (!topic) {
    res.status(400).json({ success: false, message: '请提供写作主题' });
    return;
  }

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, no-transform, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const styleGuide = writingStyle ? `写作风格要求：${writingStyle}。` : '';
  const wordGuide = wordCount ? `请生成约 ${wordCount} 字的内容。` : '';

  const systemPrompt = `你是一位专业的写作助手，擅长各种文体创作。请根据用户提供的主题进行创作。

要求：
1. 内容结构清晰，逻辑连贯
2. 语言优美，表达准确
3. ${styleGuide}
4. ${wordGuide}
5. 直接输出正文内容，不要输出标题外的其他说明文字`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: `请以"${topic}"为主题写一篇文章，先拟定一个吸引人的标题（用## 包裹），然后输出正文。` },
  ];

  try {
    const config = new Config();
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);
    const client = new LLMClient(config, customHeaders);

    const stream = client.stream(messages, {
      model: 'doubao-seed-2-0-lite-260215',
      temperature: 0.8,
    });

    for await (const chunk of stream) {
      if (chunk.content) {
        const text = chunk.content.toString();
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    console.error('AI生成错误:', error);
    res.write(`data: ${JSON.stringify({ error: '生成失败，请稍后重试' })}\n\n`);
    res.write(`data: [DONE]\n\n`);
    res.end();
  }
});

export default router;