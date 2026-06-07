import express from "express";
import cors from "cors";
import { ZodError } from "zod";
import writingRouter from "./routes/writing.js";
import aiRouter from "./routes/ai.js";
import communityRouter from "./routes/community.js";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import vipRouter from "./routes/vip.js";
import backupRouter from "./routes/backup.js";
import workflowRouter from "./routes/workflow.js";
import agentRouter from "./routes/agent.js";
import billingRouter from "./routes/billing.js";
import welfareRouter from "./routes/welfare.js";
import adminRouter from "./routes/admin.js";
import { authMiddleware, optionalAuthMiddleware } from "./middleware/auth.js";
import { quotaMiddleware } from "./middleware/quota.middleware.js";
import { cleanupGuestUsers } from "./services/cleanup.service.js";

const app = express();
const port = process.env.PORT || 9091;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  credentials: true,
  exposedHeaders: ['Content-Disposition'],
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Static files
app.use('/api/v1/static', express.static('public'));
app.use('/admin', express.static('public/admin'));

// 请求日志中间件
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/api/v1/health', (req, res) => {
  console.log('Health check success');
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api/v1/writing', authMiddleware, writingRouter);
app.use('/api/v1/ai', optionalAuthMiddleware, quotaMiddleware('ai_generate'), aiRouter);
app.use('/api/v1/community', optionalAuthMiddleware, communityRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', authMiddleware, usersRouter);
app.use('/api/v1/vip', authMiddleware, vipRouter);
app.use('/api/v1/backup', authMiddleware, backupRouter);
app.use('/api/v1/workflow', authMiddleware, quotaMiddleware('ai_generate'), workflowRouter);
app.use('/api/v1/agent', authMiddleware, quotaMiddleware('ai_generate'), agentRouter);
app.use('/api/v1/billing', authMiddleware, billingRouter);
app.use('/api/v1/welfare', authMiddleware, welfareRouter);
app.use('/api/v1/admin', adminRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `接口不存在: ${req.method} ${req.path}` });
});

// ===== Global Error Handler =====
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err?.message || err);

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "参数校验失败",
      details: err.issues.map((e: any) => ({
        path: e.path?.join(".") || "",
        message: e.message,
      })),
    });
  }

  // Known HTTP errors
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: err.message || "请求处理失败",
    });
  }

  // Default 500
  res.status(500).json({
    error: "服务器内部错误",
  });
});

// ===== 定时任务：清理7天未活动的游客账号 =====
setInterval(async () => {
  try {
    const result = await cleanupGuestUsers();
    if (result.deleted > 0) {
      console.log(`[Cleanup] 已删除 ${result.deleted} 个未活跃游客账号`);
    }
  } catch (err: any) {
    console.error("[Cleanup] Guest cleanup error:", err?.message || err);
  }
}, 6 * 60 * 60 * 1000); // 每6小时执行一次

// 启动时立即执行一次
setTimeout(async () => {
  try {
    const result = await cleanupGuestUsers();
    if (result.deleted > 0) {
      console.log(`[Cleanup] 启动清理: 已删除 ${result.deleted} 个未活跃游客账号`);
    }
  } catch (err: any) {
    console.error("[Cleanup] Initial cleanup error:", err?.message || err);
  }
}, 10000); // 启动后10秒执行

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/`);
});