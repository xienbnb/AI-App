# AI 写作助手 - 长期发展规划

## 概述

AI 写作助手是一款集 AI 辅助创作、作品管理、社区交流于一体的移动写作平台，支持多端运行（iOS/Android/Web）。当前已完成核心功能搭建，包括 AI 对话创作、书籍卷章管理、富文本编辑、技能系统、社区帖子、作品列表等。本计划旨在按阶段持续完善，打造专业级别的写作工具。

**当前技术栈**：Expo 54 + React Native + Express.js + Supabase PostgreSQL + 大语言模型(SSE流式)

---

## 技术方案

| 维度 | 选择 | 理由 |
|------|------|------|
| 前端框架 | Expo 54 + React Native (Uniwind) | 三端兼容，快速迭代 |
| 后端框架 | Express.js + TypeScript | 与前端语言统一，轻量高效 |
| 数据库 | Supabase PostgreSQL | 托管数据库，内置权限管理 |
| AI 推理 | 豆包大模型(SSE) | 流式输出，低延迟 |
| 存储 | AsyncStorage (前端) + Supabase (后端) | 本地持久化 + 云端存储 |
| 认证 | (待接入) Supabase Auth | 渐进式引入登录系统 |

---

## 功能模块

### 1. AI 创作中心（首页）
- AI 对话式创作，支持 13 种技能（大纲/正文/设定/灵感等）
- 技能系统从设置页动态同步，严格权限范围
- 书籍上下文挂载，插入到指定章节/大纲/设定/灵感
- 文件上传分析
- 历史会话管理（保存/删除/切换）

### 2. 作品管理
- 书籍 CRUD（创建/编辑/删除）
- 卷/章组织结构（可折叠、可排序）
- 大纲/设定/灵感独立编辑区（富文本+结构化）
- 多种视图（网格/列表/画廊）

### 3. 富文本编辑器
- 自动保存 + 保存状态指示
- 更多菜单（辅助功能/AI助手/常用工具/写作设置）
- 悬浮 AI 助手（选中文字后浮现）
- 夜间模式
- 撤销/恢复(50步)

### 4. 社区
- 帖子列表（分类/标签/点赞）
- 帖子详情
- （待完善）评论系统、用户主页

### 5. AI 工具箱
- AI 文生图
- AI 角色对话
- AI 地图生成
- 关系网分析等

### 6. 个人中心
- 技能管理（启用/禁用/自定义）
- AI 模型参数配置
- 知识库管理
- 统计数据

### 数据结构

```typescript
// 书籍
books: { id: uuid, userId: string, title: string, author: string,
  category: string, description: string, cover: string, status: string,
  outline: string, volumes: jsonb, outlineItems: jsonb,
  inspirations: jsonb, settings: jsonb, createdAt, updatedAt }

// 章节
chapters: { id: uuid, bookId: uuid, title: string, content: string,
  volumeId: string, sortOrder: number, status: string, wordCount: number }

// 社区帖子
posts: { id: uuid, userId: string, userName: string, title: string,
  content: string, tag: string, likes: number, comments: number,
  featured: boolean }

// 聊天会话 (AsyncStorage)
chatSessions: { id: string, messages: ChatMessage[], createdAt: string }

// AI 设置 (AsyncStorage)
aiSettings: { provider: string, model: string, skillEnabled: boolean[],
  customSkills: Skill[], temperature: number }
```

---

## 是否有原型设计

否（此为已开发项目的长期优化计划，非全新项目）

---

## 实施步骤

### 阶段一：核心稳定与数据闭环（当前优先）

**Step 1: 后端健全性加固**
- 新增全局 API 错误处理中间件（统一错误格式 + 日志）
- 所有 POST/PUT 路由添加参数校验（zod schemas）
- 关键 API 添加 try-catch 兜底，返回友好错误信息
- 涉及文件: `server/src/routes/writing.ts`, `server/src/routes/community.ts`, `server/src/index.ts`

**Step 2: 插入系统完整闭环**
- 确保插入大纲 / 章节 / 灵感 / 设定均调通后端 API
- 插入成功后刷新前端数据（useFocusEffect + 本地状态同步）
- 插入章节时自动计算 sortOrder 和 volumeId
- 涉及文件: `client/screens/home/index.tsx`, `server/src/routes/writing.ts`

**Step 3: 空状态 / 加载态 / 错误态覆盖**
- 所有列表页（首页会话、作品列表、社区、知识库）添加空状态引导
- 数据加载中显示骨架屏或 Loading 指示器
- API 请求失败时显示错误提示 + 重试按钮
- 涉及文件: `client/screens/home/index.tsx`, `client/screens/works/index.tsx`, `client/screens/community/index.tsx`, `client/screens/ai-knowledge/index.tsx`

### 阶段二：写作体验升级

**Step 4: 编辑器全面增强**
- 添加字数/阅读时间统计（底部状态栏）
- 悬浮 AI 助手增加更多选中文本操作（翻译、提炼摘要）
- 全文搜索替换增加高亮匹配和逐条跳转
- 导出功能兼容 .txt / .md / .pdf 格式
- 涉及文件: `client/screens/editor/index.tsx`, `server/src/routes/writing.ts`

**Step 5: 作品管理增强**
- 卷/章拖拽排序
- 书籍封面自定义（上传图片）
- 作品字数/章节数统计展示
- 多选批量操作（删除/移动章节）
- 涉及文件: `client/screens/detail/index.tsx`, `client/screens/works/index.tsx`, `server/src/routes/writing.ts`

### 阶段三：社区与社交

**Step 6: 社区功能完善**
- 帖子评论系统（嵌套评论）
- 用户个人主页（作品列表、发帖记录）
- 帖子搜索/热门推荐
- 关注/粉丝系统
- 涉及文件: `client/app/(tabs)/community.tsx`, `client/screens/community/index.tsx`, `client/screens/post-detail/index.tsx`, `server/src/routes/community.ts`, `server/src/routes/user.ts`

### 阶段四：数据洞察与高级功能

**Step 7: 写作统计与报告**
- 写作日历（每日字数热力图）
- 作品分析报告（总字数/章节分布/写作速度）
- 读者互动数据（社区）
- 涉及文件: `client/screens/report/index.tsx`, `server/src/routes/writing.ts`, `server/src/storage/database/shared/schema.ts`

**Step 8: 用户体验打磨**
- 全局动画（页面过渡、列表入場、按钮反馈）
- 深色模式所有弹窗/Modal 全面适配
- 输入体验优化（键盘避让、自动聚焦、快捷键）
- 性能优化（大列表虚拟化、图片懒加载）
- 涉及文件: 全局 (client/app/_layout.tsx, client/components/)

---

## 页面规格

### 全局导航

##### @nav(mobile-tabbar)
> type: tabbar
> platform: mobile

- @page(/) 首页 | icon: comment-dots
- @page(/works) 作品 | icon: book-open
- @page(/community) 社区 | icon: users
- @page(/ai) AI工坊 | icon: sparkles
- @page(/me) 我的 | icon: user

### 页面详情

##### @page(/) 首页（AI 对话）

**核心职责**：AI 辅助创作的主入口，按技能分类提供上下文感知的写作对话。

**布局**：
- 顶部：Logo + 设置入口 + 历史会话按钮
- 书籍上下文条：显示当前挂载的作品名，点击打开选择器
- 技能标签行：从设置页同步的已启用技能
- 消息列表：Markdown 渲染 + 操作按钮（追问/插入/重新生成）
- 底部输入区：文本输入 + 技能标签提示 + 文件上传 + @技能

**状态**：
- 空态：对话引导卡（"试试这些技能"）
- 加载态：流式输出实时展示
- 错误态：重试按钮

**交互说明**

| 元素 | 动作 | 响应 | 备注 |
|------|------|------|------|
| 技能标签 | 点击 | 输入框显示提示文案，发送时携带 skill 参数 | |
| AI 回复 | 追问 | 将内容填入输入框，追加"请进一步..." | |
| AI 回复 | 插入当前书籍 | 弹出 InsertModal，选择插入目标 | |
| AI 回复 | 重新生成 | 删除最后一条AI消息，重新发送请求 | |
| 侧边栏会话 | 点击 | 切换会话 | |
| 侧边栏会话 | 长按 | 弹出删除确认弹窗 | |
| 书籍上下文条 | 点击 | 打开 BookPickerModal | |
| 文件上传按钮 | 点击 | 打开文件选择器 | |

##### @page(/works) 作品

**核心职责**：管理所有创作作品，支持多视图展示。

**布局**：
- 顶部：搜索 + 视图切换（网格/列表）
- 作品列表：封面 + 标题 + 字数 + 状态
- 创建按钮（FAB）

**状态**：
- 空态：插画 + "创作你的第一部作品" + 新建按钮
- 加载态：骨架屏

**交互说明**

| 元素 | 动作 | 响应 |
|------|------|------|
| 作品卡片 | 点击 | 跳转 @page(/detail) |
| 作品卡片 | 长按 | 弹出操作菜单（编辑/删除） |
| 创建按钮 | 点击 | 弹出新建作品表单 |
| 视图切换 | 点击 | 切换网格/列表 |

##### @page(/detail) 作品详情

**核心职责**：管理单本书的卷/章/大纲/设定/灵感。

**布局**：
- 顶部：作品信息 + 编辑按钮
- Tab 切换：章节 / 大纲 / 设定 / 灵感
- 内容区：对应 Tab 的列表/编辑器

**交互说明**

| 元素 | 动作 | 响应 |
|------|------|------|
| 章节/卷 | + 按钮 | 弹出选项（创建章节/创建卷） |
| 章节项 | 点击 | 跳转 @page(/editor) |
| 章节项 | 长按 | 编辑/删除 |
| 卷 | 点击 | 折叠/展开 |
| 大纲项 | 长按 | 编辑/删除 |
| 大纲 | 导入按钮 | 弹出导入面板 |
| 灵感项 | 长按 | 编辑/删除 |

##### @page(/editor) 编辑器

**核心职责**：章节内容的富文本编辑，自动保存 + AI辅助。

**布局**：
- 顶部：返回 + 书名/章节名 + 保存状态 + 更多菜单
- 正文区：全屏 TextInput
- 工具栏（底部）：排版/撤销/恢复/AI/搜索/预览
- 悬浮AI助手：选中文字后浮现

**交互说明**

| 元素 | 动作 | 响应 |
|------|------|------|
| 正文输入 | 内容变更 | 3秒防抖自动保存 |
| 更多菜单 | 点击 | 弹出底部面板（辅助/AI/工具/设置） |
| 选中文字 | 自动 | 悬浮AI助手出现 |
| 悬浮AI | 点击功能 | 执行对应操作（润写/扩写等） |
| 搜索按钮 | 点击 | 弹出搜索替换面板 |
| 预览按钮 | 点击 | 切换预览模式 |

##### @page(/community) 社区

**核心职责**：用户作品分享与交流。

**布局**：
- 顶部：分类Tab（推荐/热门/最新/标签）
- 帖子列表：标题 + 预览 + 标签 + 互动数据
- 发布按钮（FAB）

##### @page(/me) 我的

**核心职责**：个人配置与数据管理。

**布局**：
- 顶部：用户头像 + 昵称 + 统计数据
- Tab 切换：技能管理 / AI 设置 / 知识库
- 技能管理：技能开关 + 自定义技能创建
- AI 设置：模型选择 + 参数配置
- 知识库：文档上传 + 管理