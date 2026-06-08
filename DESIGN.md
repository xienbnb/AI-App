# AI 小说创作 App — 架构分析与解耦规划

## 一、现状分析

### 1.1 API 接口映射

#### 后端路由总览（11 个路由文件）

| 路由文件 | API 前缀 | 端点数量 | 说明 |
|---------|----------|---------|------|
| `auth.ts` | `/api/v1/auth` | ~10 | 登录、注册、OTP、密码管理 |
| `users.ts` | `/api/v1/users` | ~6 | 用户资料、头像、AI 设置 |
| `writing.ts` | `/api/v1/writing` | ~20 | 书籍/卷/章节 CRUD + AI 生成 |
| `agent.ts` | `/api/v1/agent` | ~3 | Agent 对话 SSE、对话管理 |
| `ai.ts` | `/api/v1/ai` | ~2 | 图片生成、封面生成 |
| `vip.ts` | `/api/v1/vip` | ~8 | VIP 套餐、Token 包、日签 |
| `community.ts` | `/api/v1/community` | ~8 | 帖子/评论 CRUD |
| `admin.ts` | `/api/v1/admin` | ~12 | 仪表盘、用户管理、兑换码 |
| `billing.ts` | `/api/v1/billing` | ~3 | 账单记录 |
| `welfare.ts` | `/api/v1/welfare` | ~3 | 任务/签到 |
| `workflow.ts` | `/api/v1/workflow` | ~1 | 工作流 |

**总计：约 76 个 API 端点**

#### 前端调用现状

- **无统一 API 客户端**：每个屏幕（screen）都自己调用 `fetch()`
- **环境变量不一致**：
  - 多数用 `const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091"`
  - login、account-security 直接用 `EXPO_PUBLIC_BACKEND_BASE_URL`
  - utils/index.ts 有自己的 `API_BASE` 定义
- **认证头重复**：每个屏幕自己写 `getAuthHeaders()` / `headers()` 函数
- **错误处理不统一**：有的 `.catch()`, 有的 `try/catch`, 有的不处理

### 1.2 AI 集成点（Coze SDK）

| 文件 | 使用 SDK | 功能 | 解耦影响 |
|------|---------|------|---------|
| `server/src/utils/ai-client.ts` | `LLMClient`, `Config`, `ImageGenerationClient` | LLM 流式/非流式 + 图片生成 | ⭐ 核心入口，需替换为 HTTP 客户端 |
| `server/src/routes/agent.ts` | `LLMClient`, `Config` | Agent 对话（SSE 流式） | 需解耦 + 保留工具调用逻辑 |
| `server/src/routes/writing.ts` | `getUserLLMClient`, `getLLMClient` | AI 创建书籍/章节 | 调 ai-client 层，改动小 |
| `server/src/routes/ai.ts` | `createImageClient`, `getUserImageClient` | 图片生成、封面 | 调 ai-client 层，改动小 |
| `server/src/storage/database/supabase-client.ts` | Coze Python 工具（备选） | 获取 Supabase 凭据 | 已解耦，支持自定义环境变量 |

**耦合度最高**的模块：
1. `ai-client.ts` — 所有 AI 操作入口，需重写底层
2. `agent.ts` — 复杂的工具调用 + SSE 流，需保留逻辑仅换 LLM 协议

### 1.3 数据库架构

| 数据通道 | 用途 | 当前凭据来源 |
|---------|------|------------|
| Drizzle ORM + `pg` | 所有 CRUD 操作 | `DATABASE_URL` |
| Supabase Client | 部分 CRUD 操作（writing.ts 使用） | `SUPABASE_URL` + `ANON_KEY` |
| Supabase Auth | 登录鉴权 | `SUPABASE_URL` + `ANON_KEY` |

**问题**：writing.ts 同时使用 **Drizzle ORM** 和 **Supabase Client** 两种方式操作数据库，标准不统一。

---

## 二、重构计划

### 2.1 立即执行（本轮）

#### ✅ 前端统一 API 客户端
- 创建 `client/utils/api.ts`
  - 统一 `request()` 函数：自动加 `Content-Type`、`x-session` token
  - 统一错误处理：401 自动跳登录页
  - 统一 `API_BASE` 读取（只用 `EXPO_PUBLIC_BACKEND_BASE_URL`）
  - 支持 GET/POST/PUT/DELETE 快捷方法

#### ✅ 后端路由中间件统一
- 创建 `server/src/middleware/error-handler.ts`
  - 统一错误响应格式 `{ success: false, error: string }`
  - 自动捕获所有 `throw` 和未处理异常

### 2.2 后续规划（出沙箱前）

#### 1️⃣ AI 服务解耦（替换 Coze SDK）
创建适配器层 `server/src/services/ai-provider.ts`，支持多种后端：

```
┌──────────────────┐
│  业务代码（不变）    │
│  agent.ts/writing  │
└────────┬─────────┘
         │ 调 AIProvider 接口
         ▼
┌──────────────────┐
│  AI Provider 适配器 │
│  (ai-provider.ts)  │
└────────┬─────────┘
         │ 根据配置选择
    ┌────┴────┐
    ▼         ▼
┌──────┐  ┌──────┐
│Coze  │  │OpenAI│  ← 未来可扩展
│SDK   │  │HTTP  │
└──────┘  └──────┘
```

**用户自定义 API Key 已支持**：`ai-client.ts` 已有 `getUserLLMClient()`，会读取用户设置的 API Key。

#### 2️⃣ 统一数据库访问层
- writing.ts 中 Supabase Client 调用 → 全部收归 Drizzle ORM
- 消除 `toCamelCase`/`toSnakeCase` 转换层

#### 3️⃣ Agent 工具调用优化
- 工具调用（`save_outline`, `create_book`, `create_chapter`）分离为独立 Service
- 支持前端自定义工具注册

---

## 三、潜在 Bug 列表

| # | 问题 | 位置 | 风险 |
|---|------|------|------|
| 1 | `API_BASE` 多份定义，修改后不一致 | 7 个 screen 文件 | 中 |
| 2 | writing.ts 混用 Drizzle + Supabase Client | writing.ts | 高 — 换数据库时可能遗漏 |
| 3 | 401 未统一处理，用户可能看到"服务器错误" | 各 screen | 中 |
| 4 | `agent.ts` `extractJsonObject` 有死循环风险（`escapeNext` 在 `ch === '\\'` 前未清除） | agent.ts:30-31 | 低 |
| 5 | AI 模型名硬编码 `doubao-seed-2-0-lite-260215` | ai-client.ts, writing.ts | 中 — 换模型需改多处 |
| 6 | 用户自定义 API Key 仅缓存 30 分钟，更新后需等过期 | ai-client.ts | 低 |
| 7 | `streamLLM` generator 无超时控制，挂起时连接不释放 | ai-client.ts | 中 |
| 8 | 未处理的 SSE 连接泄漏 | home/index.tsx | 中 |

---

## 四、AI 解耦方案建议

### 方案 A：直接替换为 OpenAI API（推荐）

```typescript
// server/src/services/ai-provider.ts
export class AIProvider {
  constructor(private config: { apiKey: string; baseUrl?: string }) {}

  async stream(messages, options): AsyncGenerator<{ content: string }> {
    const response = await fetch(`${this.config.baseUrl || 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model || 'gpt-4o',
        messages,
        stream: true,
      }),
    });
    // 解析 SSE 流...
  }
}
```

### 优势
- 不依赖 Coze 平台，用户可自由选择模型（OpenAI / DeepSeek / 豆包 / Claude）
- 用户已有的 API Key 直接可用
- 与当前 `getUserLLMClient()` 的用户自定义 Key 机制完美对接

### 需要替换的文件

| 文件 | 改动量 | 说明 |
|------|--------|------|
| `server/src/utils/ai-client.ts` | 🔴 全部重写 | 替换 LLMClient、ImageClient 为 HTTP |
| `server/src/routes/agent.ts` | 🟡 部分修改 | 只改 LLM 调用部分，保留工具逻辑 |
| `server/src/routes/ai.ts` | 🟡 部分修改 | 图片生成改为 HTTP 调用 |
| `server/src/routes/writing.ts` | 🟢 少量修改 | 只需改 import 路径 |

---

## 五、总结

**优先做**：统一前端 API 客户端 + 后端错误处理（本轮完成）
**随后做**：AI Provider 适配器层（出沙箱前）
**最终做**：统一数据库访问 + Agent 工具分离