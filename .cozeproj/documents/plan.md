# 创作助手 App — 首页 & AI 设置优化

## 概述

在现有创作助手 App 基础上进行 5 项优化：首页历史会话可视化管理、AI 消息状态友好化、输入区布局重构、AI 自定义密钥接入与连接测试、Agent 记忆持久化。配合原型设计先行，确保交互体验与视觉效果一致。

## 技术方案

| 维度 | 选择 | 理由 |
|------|------|------|
| 前端 | Expo 54 + React Native | 现有技术栈，不改动 |
| 样式 | TailwindCSS (Uniwind) | 现有方案 |
| 导航 | Stack + 模态弹窗 | 现有方案 |
| 存储 | AsyncStorage + Drizzle (PG) | 会话用 AsyncStorage 缓存，消息/记忆用 PG 持久化 |
| AI 协议 | Coze SDK + OpenAI 兼容 + SiliconFlow | 现有 ai-provider.ts 已支持 |
| 原型 | 是（设计引导已开启） | 移动端原型优先 |

## 功能模块

### 1. 历史会话管理（P0）
- 左侧侧边栏展示所有会话（不限 8 条），支持滚动
- 每条展示预览文字 + 时间戳
- 支持删除、点击加载、新建会话
- 自动保存最新 50 条消息到 AsyncStorage

### 2. AI 消息状态友好化（P1）
- 后端 `action_start` 中 `toolLabel` 映射为中文化提示：
  - create_book → "正在创建书籍..."
  - save_outline → "正在生成大纲..."
  - create_chapter → "正在创作章节..."
  - create_volume → "正在规划卷..."
  - save_world_setting → "正在构建世界观..."
  - get_book_info → "正在加载作品信息..."
  - get_characters → "正在读取角色..."
  - get_volumes → "正在整理目录..."
  - continue_chapter → "正在续写章节..."
- 前端 agent 状态栏使用纯中文描述，不显示 `[处理]` `[完成]` 等技术前缀
- 流式内容实时展示（已有 `agentStreamContent` / `streamContent`，确认可用）

### 3. 输入区布局优化（P1）
- 重新设计输入栏布局：`+` 按钮 → 输入框 → 发送按钮（箭头）
- 模型选择器保留在输入区，但默认收起（隐藏），点击输入框时在输入栏上方展开显示（类似 iOS 键盘工具栏效果），输入完成后自动隐藏
- 解决键盘弹出时输入框被遮挡问题

### 4. AI 自定义密钥 + 测试按钮（P1）
- AI 设置页「自定义模型」Tab 已有表单，需补充：
  - 添加「测试连接」按钮，调用 `POST /api/v1/ai/test-connection`
  - 后端新增测试接口，用 `fetch` 请求 OpenAI 兼容 API 的 `/v1/models` 或 `/v1/chat/completions`（单条消息极短）验证 key 是否有效
  - 测试结果 Toast/提示：成功或失败原因
- 自定义模型选择后，首页模型选择器下拉中显示自定义模型列表

### 6. Agent 模式切换（P1）
- 创作首页顶部/标题栏区域添加模式选择器（三段式切换）：
  - **Agent 模式**（默认）：当前 agent 行为，支持工具调用（创建书籍/生成章节等）
  - **对话模式**：纯对话，无工具调用，类似普通 AI 聊天
  - **计划模式**：agent 输出结构化计划（分步展开），用户确认后再执行
- 切换模式后，前台只发当前模式、输入框 placeholder 变化，后端根据模式调整 agent 行为

### 5. Agent 记忆设计（P1）
- **会话级记忆**（已完成）：每次 agent 执行保存到 `agentConversations` 表，`messages` 字段存完整 JSON
- **全局记忆**：`userSettings` 表存储 AI 偏好（model, temperature, skills 等）—— 已完成
- **长期记忆**：新增 `agent_memories` 表，存储 key-value 型的长期知识（如用户偏好风格、常用角色名等）
  - 表结构：`id, userId, key, value, createdAt, updatedAt`
  - API: `GET/PUT /api/v1/agent/memories`
  - agent 系统 prompt 尾部注入记忆内容

## 是否有原型设计

是

## 页面规格

### 全局导航

##### @nav(mobile-tabbar)
> type: tabbar
> platform: mobile

- @page(/) 创作 | icon: pen-nib
- @page(/my-ai-settings) AI设置 | icon: sliders
- @page(/profile) 我的 | icon: user

### @page(/) 创作首页

**核心职责**：AI 对话/Agent 创作的主交互页面
**访问路径**：底部 Tab 直接访问，自动加载最近会话
**布局**：
- 顶部导航栏：左侧汉堡菜单（打开历史侧边栏）+ 标题"AI 创作" + 模式选择器（Agent/对话/计划）+ 右侧新建按钮
- 作品上下文栏：当前挂载书籍提示，可点击切换
- 消息列表区：滚动消息流，AI 头像（机器人/魔法棒）+ 用户气泡
- 底部输入区：`+` 附件按钮 + 多行输入框 + 发送按钮（↑）
- 模型选择器：默认收起，点击输入框时在输入栏上方展开显示，输入完成后自动收起
- 侧边栏：从左侧滑出的历史会话列表

**状态**：
- 空态：欢迎语卡片，引导用户开始创作
- 加载态：`AI 思考中...` 提示 + 流式内容实时展示
- Agent 状态：中文化步骤提示（"正在创建书籍..."）而非 `[处理]...`

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 历史菜单 | 点击 | 左侧滑出侧边栏 | — | 显示会话列表 |
| 侧边栏会话项 | 点击 | 加载该会话消息 | sessionId | — |
| 侧边栏删除 | 点击 | 弹窗确认删除 | sessionId | — |
| 模式选择器 | 点击 | 切换 Agent/对话/计划模式 | mode | 输入框 placeholder 随模式变化 |
| 新建设建按钮 | 点击 | 新建会话 | — | 清空当前消息 |
| 模型选择栏（输入框上方） | 点击 | 弹出模型选择面板 | modelId | 输入框获得焦点时自动展开 |
| 作品上下文栏 | 点击 | 弹出书籍选择器 | — | — |
| + 按钮 | 点击 | 弹出附件菜单（上传文件/选择技能） | — | — |
| 发送按钮 | 点击 | 发送消息 | 输入文本 | 禁用态：无输入或 AI 思考中 |
| AI 消息 | 显示 | 追问/插入书籍/重新生成按钮组 | — | — |
| 停止按钮 | 点击 | 停止 AI 生成 | — | AI 思考中时显示 |

### @page(/my-ai-settings) AI 设置

**核心职责**：管理 AI 模型（预设/自定义/公益AI）、技能开关、自定义 API Key
**访问路径**：底部 Tab 直接访问
**布局**：顶部 Tabs（预设模型 | 自定义模型 | 技能）

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 预设模型项 | 点击 | 选择该模型 | modelId | — |
| 自定义模型项 | 点击 | 选择该模型 | modelId | — |
| 自定义模型「测试连接」 | 点击 | 调用测试接口，显示结果 | modelId | 新增功能 |
| 添加自定义模型 | 点击 | 展开表单 | — | — |
| 删除自定义模型 | 点击 | 确认删除 | modelId | — |
| 技能开关 | 点击 | 切换启用/禁用 | skillId | — |
| 添加自定义技能 | 点击 | 展开表单 | — | — |

## 实施步骤

### 阶段一：原型设计

先对 **创作首页** 和 **AI 设置页** 进行移动端原型设计，确保交互方案准确后再开发。

涉及页面：
- @page(/) 创作首页（消息区 + 输入区 + 侧边栏 + 模型选择器）
- @page(/my-ai-settings) AI 设置页（自定义模型测试按钮）

### 阶段二：代码开发

1. **AI 消息友好化 + 输入区重构 + Agent 模型切换** — 修改 `server/src/routes/agent.ts`（工具名中文映射 + 模式处理） + 修改 `client/screens/home/index.tsx`（输入栏布局 + 模式选择器 + 收起模型选择器）
2. **历史会话管理优化** — 修改 `client/screens/home/index.tsx` 侧边栏会话列表（不限8条、加载全部）
3. **自定义 Key 测试接口** — 新增 `server/src/routes/ai.ts`（`POST /api/v1/ai/test-connection`）+ 修改 `client/screens/my-ai-settings/index.tsx`（添加测试按钮 + 结果展示）
4. **Agent 长期记忆** — 新增数据库迁移 + `server/src/routes/agent-memory.ts`（`GET/PUT /api/v1/agent/memories`）+ 修改 `server/src/routes/agent.ts`（注入记忆到 system prompt）
5. **集成测试 & 部署** — 重启服务、curl 测试 API、前端静态检查