# AI Novel Writing Workflow System Design

> **Project:** 网络文学创作平台 (Web Novel Platform)
> **Date:** 2025-06-25
> **Status:** Draft / Design

---

## Table of Contents

1. [Current AI Endpoints](#1-current-ai-endpoints)
2. [Three-Step Workflow Design](#2-three-step-workflow-design)
3. [API Endpoints Design](#3-api-endpoints-design)
4. [Request/Response Formats](#4-requestresponse-formats)
5. [Frontend Interaction Flow](#5-frontend-interaction-flow)
6. [Database Tables Needed](#6-database-tables-needed)
7. [Implementation Notes](#7-implementation-notes)

---

## 1. Current AI Endpoints

The existing system at `/workspace/projects/server/src/routes/ai.ts` has **7 AI-powered endpoints**, all mounted under `/api/v1/ai`:

| # | Endpoint | Method | Description | Response Type |
|---|----------|--------|-------------|---------------|
| 1 | `/character` | POST | **AI 角色库** — 根据 `genre` (类型), `style` (风格), `count` (数量) 生成原创小说角色，每人包含角色名、身份背景、性格、外貌、能力、定位、人物小传 | SSE stream |
| 2 | `/outline` | POST | **大纲助手** — 根据 `title`, `genre`, `description`, `detail` 生成完整故事大纲，含背景、核心设定、角色、主线、分章 | SSE stream |
| 3 | `/detect` | POST | **AI 检测** — 检测给定 `text` 是否为 AI 生成，返回 AI 概率、判断依据、可疑特征、修改建议 | SSE stream |
| 4 | `/relationship` | POST | **人物关系网** — 根据 `title`, `genre`, `characters` 构建人物关系网络，含关系总览、核心关系链、情感关系、势力划分、关系演变 | SSE stream |
| 5 | `/cover` | POST | **封面生成器** — 根据 `title`, `genre`, `style`, `description` 生成小说封面图片 | JSON (imageUrl) |
| 6 | `/map` | POST | **地图生成器** — 根据 `worldName`, `genre`, `features` 生成奇幻世界地图图片 | JSON (imageUrl) |
| 7 | `/generate-image` | POST | **通用图片生成** — 根据 `prompt`, `style`, `aspectRatio` 生成小说插画 | JSON (imageUrl) |

### Common Patterns

- **Auth:** All endpoints use `requireAuth` middleware (except optional in some GET routes)
- **Rate Limit:** All endpoints pass through `aiRateLimit` middleware applied at router level
- **SSE Streaming:** Most text-generation endpoints use Server-Sent Events (`text/event-stream`) with a `[DONE]` signal
- **LLM Client:** Uses `coze-coding-dev-sdk`'s `LLMClient` with model `doubao-seed-2-0-lite-260215`
- **Image Generation:** Uses `coze-coding-dev-sdk`'s `ImageGenerationClient` with custom headers forwarding
- **Error Handling:** Re-throws as standard HTTP errors; global error handler catches ZodError and others

### Existing Infrastructure

- **ORM:** Drizzle ORM with PostgreSQL (`node-postgres` driver)
- **Database:** Supabase (used both via Supabase client for auth ops and direct DB for queries)
- **User Table:** `users` table with `aiSettings` (JSONB), `vipLevel`, consumption tracking fields
- **Book/Chapter Model:** Books stored with JSONB `volumes` field containing nested chapters — see schema in `schema.ts`

---

## 2. Three-Step Workflow Design

### Overview

The AI Writing Workflow guides the user through three sequential steps to go from a story concept to a polished novel:

```
[Story Concept] → Step 1: 草稿大纲 (Outline) → Step 2: 逐章扩写 (Expand) → Step 3: 润色定稿 (Polish)
```

Each step is a **discrete session** with its own state, allowing the user to pause, regenerate, modify, and approve before advancing.

---

### Step 1: Outline Generation (草稿大纲)

**Purpose:** Transform a raw story idea into a structured, multi-chapter outline.

**User Inputs:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `storyConcept` | string | Yes | The core idea / elevator pitch |
| `genre` | string | Yes | Genre (玄幻/仙侠/都市/科幻/历史/言情/悬疑/游戏/武侠/奇幻) |
| `desiredLength` | string | Yes | Target length (短篇/中篇/长篇) |
| `referenceStyle` | string | No | Reference author or work style |
| `existingOutline` | string | No | If user already has partial outline, start from there |

**AI Generates:**
- **故事背景** (Story background/world)
- **核心设定** (Core rules/magic system/unique mechanics)
- **主要角色** (Main characters with brief bios)
- **故事主线** (Main plot broken into 3-5 chapters/sections)
- **分章大纲** (Per-chapter breakdown: title + key events + estimated word count)

**User Actions:**
| Action | Description |
|--------|-------------|
| ✅ Approve | Accept the outline and move to Step 2 |
| ✏️ Modify | Edit specific sections of the outline |
| 🔄 Regenerate | Ask AI to regenerate with different focus |
| 💬 Chat | Free-form discussion to refine the outline |
| ⏸️ Pause | Save progress and resume later |

**Output:** A structured outline stored as Markdown, linked to a `workflow_session`.

---

### Step 2: Chapter Expansion (逐章扩写)

**Purpose:** Select a chapter from the approved outline and expand it into full narrative text.

**User Inputs:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chapterIndex` | number | Yes | Which chapter to expand |
| `tone` | string | No | Writing tone (轻松/严肃/悬疑/热血) |
| `targetWordCount` | number | No | Target word count (default: 2000-5000) |
| `additionalNotes` | string | No | User's specific notes for this chapter |
| `styleContinuity` | boolean | No | Whether to maintain style from previous chapter |

**AI Generates:**
- Full narrative text (2000-5000 words)
- Maintains character voice and plot consistency
- Follows the outline's key events for the selected chapter

**User Actions:**
| Action | Description |
|--------|-------------|
| ✅ Approve | Accept the chapter content |
| ✏️ Modify | Edit specific paragraphs/sentences |
| 🔄 Regenerate | Ask AI to regenerate this chapter |
| 📝 Add Notes | Add specific writing notes before regenerating |
| ⏸️ Pause | Save chapter progress and resume later |

**Output:** Full chapter text stored in the workflow step, also synced to the book's `volumes` structure.

---

### Step 3: Polish & Finalize (润色定稿)

**Purpose:** AI reviews the completed work for grammar, pacing, character consistency, and suggests improvements.

**User Inputs:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reviewScope` | string | Yes | What to review: `grammar`, `pacing`, `consistency`, `all` |
| `strictness` | string | No | `light` / `medium` / `strict` |
| `focusAreas` | string[] | No | Specific areas to focus on |

**AI Reviews:**
1. **Grammar & Language** — Typos, syntax issues, stylistic inconsistencies
2. **Pacing** — Too rushed / too slow, scene balance
3. **Character Consistency** — Do characters act in-character? Dialogues ring true?
4. **Plot Consistency** — Any contradictions with earlier chapters?
5. **Readability** — Sentence variety, paragraph length, flow

**User Actions:**
| Action | Description |
|--------|-------------|
| ✅ Accept Change | Accept a specific suggestion |
| ❌ Reject Change | Reject a specific suggestion |
| 🔄 Regenerate | Regenerate specific sections with AI |
| 📝 Manual Edit | Directly edit the text |
| 🏁 Finalize | Mark the workflow as complete |

**Output:** Final polished text + changelog of accepted/rejected suggestions.

---

## 3. API Endpoints Design

### Workflow Management Endpoints

All under `/api/v1/ai/workflow`, prefixed with `requireAuth` + `aiRateLimit` middleware.

#### 1. `POST /api/v1/ai/workflow/start` — Start a New Workflow Session

```typescript
// Request
{
  "bookId": "uuid",              // Optional: link to existing book
  "initialStep": "outline",      // Starting step: outline | expand | polish
  "title": "My Novel",           // Working title
  "genre": "玄幻",
  "desiredLength": "长篇",
  "storyConcept": "A young cultivator discovers...",
  "referenceStyle": "辰东风格"   // Optional
}

// Response 201
{
  "success": true,
  "data": {
    "sessionId": "uuid-string",
    "status": "in_progress",
    "currentStep": "outline",
    "bookId": "uuid-string",
    "createdAt": "2025-06-25T10:00:00Z",
    "steps": [
      {
        "stepType": "outline",
        "status": "pending",
        "order": 1
      },
      {
        "stepType": "expand",
        "status": "pending",
        "order": 2
      },
      {
        "stepType": "polish",
        "status": "pending",
        "order": 3
      }
    ]
  }
}
```

#### 2. `POST /api/v1/ai/workflow/step` — Execute a Workflow Step (SSE)

```typescript
// Request
{
  "sessionId": "uuid-string",
  "stepType": "outline",          // outline | expand | polish
  "inputs": {
    // Step-specific inputs (see section 4 below)
  }
}

// Response: SSE stream (text/event-stream)
// data: { "content": "chunk of generated text..." }
// ...
// data: [DONE]
//
// After stream completes, a final JSON event:
// data: { "stepResult": { "stepId": "uuid", "status": "completed", "output": { ... } } }
```

#### 3. `POST /api/v1/ai/workflow/regenerate` — Regenerate Current Step

```typescript
// Request
{
  "sessionId": "uuid-string",
  "stepId": "uuid-string",
  "modifiedInputs": {
    // Updated inputs for regeneration
  }
}

// Response: SSE stream (same as /step)
```

#### 4. `GET /api/v1/ai/workflow/:sessionId/status` — Get Workflow Status

```typescript
// Response 200
{
  "success": true,
  "data": {
    "sessionId": "uuid-string",
    "status": "in_progress",        // not_started | in_progress | completed | paused | cancelled
    "currentStep": "outline",
    "progress": {
      "stepsCompleted": 0,
      "stepsTotal": 3,
      "currentStepProgress": 45     // percentage or word count
    },
    "steps": [
      {
        "stepId": "uuid",
        "stepType": "outline",
        "status": "completed",
        "output": { ... }           // truncated for large content
      },
      {
        "stepId": "uuid",
        "stepType": "expand",
        "status": "in_progress",
        "output": null
      }
    ],
    "bookId": "uuid-string",
    "createdAt": "2025-06-25T10:00:00Z",
    "updatedAt": "2025-06-25T10:45:00Z"
  }
}
```

#### 5. `PATCH /api/v1/ai/workflow/:sessionId/step` — Update/Confirm a Step

```typescript
// Request
{
  "stepId": "uuid-string",
  "action": "approve",            // approve | modify | pause | cancel
  "modifications": {              // Only for "modify" action
    "editedContent": "Updated text..."
  }
}

// Response 200
{
  "success": true,
  "data": {
    "stepId": "uuid-string",
    "stepType": "outline",
    "status": "approved",          // approved | modified | paused | cancelled
    "approvedContent": "Final approved content...",
    "modifiedAt": "2025-06-25T11:00:00Z"
  }
}
```

### Writing Style Settings Endpoints

#### 6. `GET /api/v1/ai/writing-style` — Get User's Writing Style Preferences

```typescript
// Response 200
{
  "success": true,
  "data": {
    "defaultGenre": "玄幻",
    "preferredTone": "轻松",
    "preferredPacing": "medium",
    "wordCountPerChapter": 3000,
    "customInstructions": "偏好短句、对话多",
    "referenceAuthors": ["辰东", "唐家三少"],
    "updatedAt": "2025-06-20T08:00:00Z"
  }
}
```

#### 7. `PUT /api/v1/ai/writing-style` — Save Writing Style Settings

```typescript
// Request
{
  "defaultGenre": "玄幻",
  "preferredTone": "轻松",
  "preferredPacing": "medium",
  "wordCountPerChapter": 3000,
  "customInstructions": "偏好短句、对话多",
  "referenceAuthors": ["辰东", "唐家三少"]
}

// Response 200
{
  "success": true,
  "data": {
    "message": "写作风格设置已保存",
    "updatedAt": "2025-06-25T12:00:00Z"
  }
}
```

---

## 4. Request/Response Formats

### Step 1: Outline — Detailed Formats

**Request Body for `POST /api/v1/ai/workflow/step` (stepType="outline"):**

```typescript
{
  "sessionId": "uuid-string",
  "stepType": "outline",
  "inputs": {
    "storyConcept": "一位现代程序员穿越到修仙世界，用编程思维破解上古阵法",
    "genre": "玄幻",
    "desiredLength": "长篇",          // 短篇 | 中篇 | 长篇
    "referenceStyle": "轻松幽默",
    "existingOutline": "",           // Optional: user's existing outline text
    "additionalNotes": "希望有系统面板元素"
  }
}
```

**Response Stream Final Result:**

```typescript
{
  "stepId": "uuid-string",
  "stepType": "outline",
  "status": "completed",
  "output": {
    "outlineText": "## 故事背景\n\n...\n\n## 分章大纲\n\n### 第一章：穿越从Hello World开始\n核心事件：...\n\n### 第二章：...",
    "chapters": [
      { "title": "穿越从Hello World开始", "keyEvents": ["穿越", "发现系统"], "estimatedWords": 3000 },
      { "title": "编程破阵", "keyEvents": ["破解阵眼", "收服灵兽"], "estimatedWords": 3500 },
      { "title": "首次危机", "keyEvents": ["宗门大比", "暴露身份"], "estimatedWords": 4000 },
      { "title": "崛起之路", "keyEvents": ["突破境界", "建立势力"], "estimatedWords": 3000 },
      { "title": "天道之争", "keyEvents": ["最终对决", "世界真相"], "estimatedWords": 5000 }
    ],
    "mainCharacters": [
      { "name": "陈默", "role": "主角", "brief": "30岁程序员，意外穿越" },
      { "name": "苏小小", "role": "女主", "brief": "天才符修少女" }
    ],
    "generatedAt": "2025-06-25T10:30:00Z"
  }
}
```

### Step 2: Expand — Detailed Formats

**Request Body for `POST /api/v1/ai/workflow/step` (stepType="expand"):**

```typescript
{
  "sessionId": "uuid-string",
  "stepType": "expand",
  "inputs": {
    "chapterIndex": 0,
    "chapterTitle": "穿越从Hello World开始",
    "keyEvents": ["穿越", "发现系统", "初次使用编程能力"],
    "additionalNotes": "希望开头有吸引力，加入一些搞笑元素",
    "tone": "轻松幽默",
    "targetWordCount": 3000,
    "previousChapterSummary": "",     // For continuity in later chapters
    "outlineContext": "完整的大纲文本..."  // The full outline for context
  }
}
```

**Response Stream Final Result:**

```typescript
{
  "stepId": "uuid-string",
  "stepType": "expand",
  "status": "completed",
  "output": {
    "chapterTitle": "穿越从Hello World开始",
    "content": "陈默睁开眼睛，映入眼帘的不是他熟悉的27寸显示器，而是一个古色古香的木质屋顶...\n\n（完整章节内容，约3000字）",
    "wordCount": 3150,
    "keyScenes": [
      { "title": "穿越", "paragraph": "3-5", "description": "主角从睡梦中醒来发现穿越" },
      { "title": "系统觉醒", "paragraph": "6-10", "description": "发现编程系统面板" },
      { "title": "初次尝试", "paragraph": "11-15", "description": "用print('Hello World')点亮阵法" }
    ],
    "generatedAt": "2025-06-25T11:00:00Z"
  }
}
```

### Step 3: Polish — Detailed Formats

**Request Body for `POST /api/v1/ai/workflow/step` (stepType="polish"):**

```typescript
{
  "sessionId": "uuid-string",
  "stepType": "polish",
  "inputs": {
    "reviewScope": "all",              // grammar | pacing | consistency | all
    "strictness": "medium",            // light | medium | strict
    "focusAreas": ["dialogues", "character voice"],
    "chapters": [
      { "index": 0, "title": "穿越从Hello World开始", "content": "（完整正文）" },
      { "index": 1, "title": "编程破阵", "content": "（完整正文）" }
    ]
  }
}
```

**Response Stream Final Result:**

```typescript
{
  "stepId": "uuid-string",
  "stepType": "polish",
  "status": "completed",
  "output": {
    "summary": {
      "totalIssues": 12,
      "critical": 1,
      "moderate": 5,
      "minor": 6,
      "overallScore": 85               // 0-100 quality score
    },
    "reviews": [
      {
        "category": "grammar",
        "issues": [
          {
            "id": "g001",
            "severity": "minor",
            "location": { "chapterIndex": 0, "paragraph": 3 },
            "original": "他感到非常非常的惊讶",
            "suggestion": "他感到十分惊讶",
            "reason": "词语重复"
          }
        ]
      },
      {
        "category": "character_consistency",
        "issues": [
          {
            "id": "cc001",
            "severity": "moderate",
            "location": { "chapterIndex": 1, "dialog": "苏小小" },
            "original": "'这阵法我看不懂。' 苏小小冷冷地说。",
            "suggestion": "'哇！这个阵法好厉害！' 苏小小眼睛发亮。",
            "reason": "苏小小的角色设定是活泼天才少女，语气应更活泼"
          }
        ]
      },
      {
        "category": "pacing",
        "issues": [
          {
            "id": "p001",
            "severity": "minor",
            "location": { "chapterIndex": 0, "paragraphs": "10-15" },
            "original": "系统介绍占据了5段篇幅",
            "suggestion": "将系统介绍分散到后续章节，此处只保留核心说明",
            "reason": "开篇信息密度过高，影响阅读节奏"
          }
        ]
      }
    ],
    "polishedChapters": [
      {
        "chapterIndex": 0,
        "originalWordCount": 3150,
        "polishedWordCount": 3080,
        "changesCount": 5,
        "content": "（润色后的完整正文）"
      }
    ],
    "generatedAt": "2025-06-25T12:00:00Z"
  }
}
```

### Regeneration Request

**Request Body for `POST /api/v1/ai/workflow/regenerate`:**

```typescript
{
  "sessionId": "uuid-string",
  "stepId": "uuid-string",
  "modifiedInputs": {
    // Same structure as the original step inputs, with modifications
    "storyConcept": "Updated concept...",
    "additionalNotes": "More focus on world-building this time..."
  },
  "regenerateStrategy": "full"     // full | partial (for polish: regenerate specific sections only)
}
```

### Error Responses (All Endpoints)

```typescript
// Validation Error (400)
{
  "success": false,
  "error": "参数校验失败",
  "details": [
    { "path": "storyConcept", "message": "故事概念不能为空" }
  ]
}

// Auth Error (401)
{
  "success": false,
  "error": "请先登录"
}

// Rate Limit (403)
{
  "success": false,
  "error": "本月AI调用次数已达上限（500次），下月1号重置",
  "data": { "used": 500, "limit": 500, "tier": "月卡VIP" }
}

// Not Found (404)
{
  "success": false,
  "error": "工作流会话不存在"
}

// Server Error (500)
{
  "success": false,
  "error": "AI 服务出错，请重试"
}
```

---

## 5. Frontend Interaction Flow

### User Journey

```
┌─────────────────────────────────────────────────────────────┐
│                     Workflow Entry Point                     │
│  User clicks "AI 写作工作流" button on book editing page   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Step 1: Outline Generation (草稿大纲)          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Input Panel                                         │   │
│  │  ├─ Story Concept  [text area]                       │   │
│  │  ├─ Genre          [dropdown: 玄幻/仙侠/...]         │   │
│  │  ├─ Desired Length [radio: 短篇/中篇/长篇]           │   │
│  │  ├─ Reference Style [text input, optional]           │   │
│  │  └─ [开始生成] button                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Generating... Streaming outline appears in real-time]     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Outline Preview (Markdown rendered)                │   │
│  │  ├─ 故事背景                                        │   │
│  │  ├─ 核心设定                                        │   │
│  │  ├─ 主要角色                                        │   │
│  │  └─ 分章大纲 (5 chapters listed)                    │   │
│  │                                                     │   │
│  │  Actions: [✏️ 修改] [🔄 重新生成] [✅ 确认进入扩写] │   │
│  │           [💬 对话调整] [⏸️ 保存草稿]               │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │  User approves outline
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Step 2: Chapter Expansion (逐章扩写)           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Chapter Selector                                    │   │
│  │  ├─ [●] 第1章 穿越从Hello World开始  [已扩写]       │   │
│  │  ├─ [○] 第2章 编程破阵              [待扩写]        │   │
│  │  ├─ [○] 第3章 首次危机              [待扩写]        │   │
│  │  └─ [○] 第4章 崛起之路              [待扩写]        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Expand Panel (for selected chapter)                │   │
│  │  ├─ Tone: [轻松/严肃/悬疑/热血] dropdown           │   │
│  │  ├─ Target Words: [slider: 2000-5000]              │   │
│  │  ├─ Additional Notes: [text area, optional]        │   │
│  │  └─ [开始扩写] button                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Generating... Streaming chapter appears in real-time]     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Chapter Editor (rich text)                        │   │
│  │  ├─ Editable content area                          │   │
│  │  ├─ Word count: 3,150 / 3,000                      │   │
│  │  └─                                                 │   │
│  │  Actions: [✏️ 手动编辑] [📝 添加备注再生成]         │   │
│  │           [🔄 重新生成] [✅ 确认] [⏸️ 保存进度]     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  (Repeat for each chapter)                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │  All chapters approved
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Step 3: Polish & Finalize (润色定稿)           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Review Configuration                               │   │
│  │  ├─ Scope: [○ 语法] [○ 节奏] [○ 一致性] [● 全部]  │   │
│  │  ├─ Strictness: [轻/中/严格] radio                 │   │
│  │  ├─ Focus Areas: [多选: 对话/描写/节奏/角色塑造]    │   │
│  │  └─ [开始审查] button                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Analyzing... Progress bar per chapter]                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Review Results                                     │   │
│  │  ├─ Overall Score: 85/100                          │   │
│  │  ├─ Critical: 1   Moderate: 5   Minor: 6           │   │
│  │  ├─ By Chapter: [tab navigation]                   │   │
│  │  │                                                 │   │
│  │  │  ┌─ Issue #1 (语法) [小]                        │   │
│  │  │  │  Original: "他感到非常非常的惊讶"            │   │
│  │  │  │  Suggestion: "他感到十分惊讶"                │   │
│  │  │  │  Actions: [✅ 接受] [❌ 拒绝] [✏️ 手动改]    │   │
│  │  │  └─                                              │   │
│  │  │                                                 │   │
│  │  │  ┌─ Issue #2 (角色一致性) [中]                  │   │
│  │  │  │  ...                                         │   │
│  │  │  └─                                              │   │
│  │  └─                                                  │   │
│  │                                                     │   │
│  │  Actions: [🔄 重新审查] [🏁 完成定稿]               │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │  User finalizes
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Workflow Complete 🎉                     │
│  ├─ All content synced to book                             │
│  ├─ Session marked as completed                            │
│  ├─ Notification: "小说《XXX》已完成AI写作工作流"         │
│  └─ User redirected to book editing page                   │
└─────────────────────────────────────────────────────────────┘
```

### Required UI Components

| Component | Step(s) | Description |
|-----------|---------|-------------|
| `AIStepInputPanel` | 1, 2, 3 | Configurable input form for each step's parameters |
| `StreamingContentArea` | 1, 2 | Real-time markdown/text display for SSE streaming output |
| `MarkdownEditor` | 1 | Editable markdown preview for outline |
| `RichTextEditor` | 2 | Editable rich text area for chapter content |
| `ChapterSelector` | 2 | Sidebar list of chapters with completion status |
| `ReviewResultPanel` | 3 | Issue list with accept/reject actions |
| `WorkflowProgressBar` | All | Top-level progress indicator (Step 1 → 2 → 3) |
| `WorkflowActionBar` | All | Bottom action bar with primary actions |
| `StepNavigation` | All | Breadcrumb or step indicator showing current position |

### State Management

```typescript
// Vue/Pinia store or React context structure

interface WorkflowState {
  // Session info
  sessionId: string | null;
  status: 'not_started' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
  currentStep: 'outline' | 'expand' | 'polish' | null;

  // Per-step state
  steps: {
    outline: {
      status: 'pending' | 'generating' | 'completed' | 'approved';
      inputs: OutlineInputs;
      output: OutlineOutput | null;
      modifiedOutput: string | null;  // User's manual edits
    };
    expand: {
      status: 'pending' | 'generating' | 'completed' | 'approved';
      currentChapterIndex: number;
      chapters: ChapterOutput[];
      inputs: ExpandInputs;
    };
    polish: {
      status: 'pending' | 'generating' | 'completed' | 'finalized';
      inputs: PolishInputs;
      output: PolishOutput | null;
      acceptedChanges: Set<string>;  // Issue IDs
      rejectedChanges: Set<string>;
    };
  };

  // Book link
  bookId: string | null;

  // UX
  isStreaming: boolean;
  error: string | null;
}
```

### Pause/Interrupt Handling

- **Auto-save:** After each chunk received via SSE, save to local storage (or IndexedDB for large content)
- **Server-side persistence:** Every step completion auto-saves to `workflow_steps` table
- **Session resume:** `GET /api/v1/ai/workflow/:sessionId/status` returns full state; frontend restores from server state
- **Interrupt during generation:**
  - User clicks "暂停" → frontend closes SSE connection → server continues but marks `cancelled_at` when stream ends
  - On resume, user can see partial output and choose to continue or regenerate

### Regeneration Flow

```
User clicks "重新生成"
  → Frontend collects current modified inputs (user edits + new notes)
  → Calls POST /api/v1/ai/workflow/regenerate
  → Receives new SSE stream
  → When done, replaces the previous output in the store
  → Previous output is stored in step history for comparison
```

---

## 6. Database Tables Needed

### Table: `workflow_sessions`

Stores the overall workflow session — one session per book/creation attempt.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `uuid_generate_v4()` | Unique session identifier |
| `user_id` | `text` | NOT NULL | FK to `users.id` |
| `book_id` | `uuid` | FK → `books.id`, nullable | Optional link to existing book |
| `title` | `text` | NOT NULL, default '' | Working title for this workflow |
| `genre` | `text` | NOT NULL, default '' | Selected genre |
| `desired_length` | `text` | NOT NULL, default '中篇' | 短篇/中篇/长篇 |
| `story_concept` | `text` | NOT NULL, default '' | Original story concept |
| `status` | `text` | NOT NULL, default 'in_progress' | `not_started` \| `in_progress` \| `paused` \| `completed` \| `cancelled` |
| `current_step` | `text` | NOT NULL, default 'outline' | Current active step: `outline` \| `expand` \| `polish` |
| `current_step_order` | `integer` | NOT NULL, default 1 | 1=outline, 2=expand, 3=polish |
| `metadata` | `jsonb` | default '{}' | Flexible metadata (reference style, extra settings) |
| `started_at` | `timestamp with tz` | default `now()` | When session was created |
| `updated_at` | `timestamp with tz` | default `now()` | Last update time |
| `completed_at` | `timestamp with tz` | nullable | When workflow was finalized |
| `cancelled_at` | `timestamp with tz` | nullable | When workflow was cancelled |

**Indexes:**
```sql
CREATE INDEX idx_workflow_sessions_user_id ON workflow_sessions(user_id);
CREATE INDEX idx_workflow_sessions_book_id ON workflow_sessions(book_id);
CREATE INDEX idx_workflow_sessions_status ON workflow_sessions(status);
```

**Drizzle ORM Definition:**

```typescript
export const workflowSessions = pgTable("workflow_sessions", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  userId: text("user_id").notNull(),
  bookId: uuid("book_id").references(() => books.id, { onDelete: "set null" }),
  title: text().notNull().default(''),
  genre: text().notNull().default(''),
  desiredLength: text("desired_length").notNull().default('中篇'),
  storyConcept: text("story_concept").notNull().default(''),
  status: text().notNull().default('in_progress'),
  currentStep: text("current_step").notNull().default('outline'),
  currentStepOrder: integer("current_step_order").notNull().default(1),
  metadata: jsonb().default('{}'),
  startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: 'string' }),
});
```

### Table: `workflow_steps`

Stores individual step results — one session has 3 steps (outline, expand, polish).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `uuid_generate_v4()` | Unique step identifier |
| `session_id` | `uuid` | NOT NULL, FK → `workflow_sessions.id` ON DELETE CASCADE | Parent session |
| `step_type` | `text` | NOT NULL | `outline` \| `expand` \| `polish` |
| `step_order` | `integer` | NOT NULL | 1=outline, 2=expand, 3=polish |
| `status` | `text` | NOT NULL, default 'pending' | `pending` \| `generating` \| `completed` \| `approved` \| `modified` \| `cancelled` |
| `input_snapshot` | `jsonb` | NOT NULL, default '{}' | Full input parameters used for this generation |
| `output_data` | `jsonb` | default '{}' | Generated output (outline text, chapter content, review results) |
| `approved_content` | `text` | nullable | User-approved final content (after edits) |
| `generation_history` | `jsonb` | default '[]' | Array of previous generation outputs (for regen tracking) |
| `started_at` | `timestamp with tz` | default `now()` | Generation start time |
| `completed_at` | `timestamp with tz` | nullable | Generation completion time |
| `approved_at` | `timestamp with tz` | nullable | When user approved/modified this step |

**Indexes:**
```sql
CREATE INDEX idx_workflow_steps_session_id ON workflow_steps(session_id);
CREATE INDEX idx_workflow_steps_session_type ON workflow_steps(session_id, step_type);
```

**Drizzle ORM Definition:**

```typescript
export const workflowSteps = pgTable("workflow_steps", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  sessionId: uuid("session_id").notNull().references(() => workflowSessions.id, { onDelete: "cascade" }),
  stepType: text("step_type").notNull(),
  stepOrder: integer("step_order").notNull(),
  status: text().notNull().default('pending'),
  inputSnapshot: jsonb("input_snapshot").notNull().default('{}'),
  outputData: jsonb("output_data").default('{}'),
  approvedContent: text("approved_content"),
  generationHistory: jsonb("generation_history").default('[]'),
  startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
  approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
});

// Relations
export const workflowSessionsRelations = relations(workflowSessions, ({ many, one }) => ({
  steps: many(workflowSteps),
  book: one(books, {
    fields: [workflowSessions.bookId],
    references: [books.id],
  }),
}));

export const workflowStepsRelations = relations(workflowSteps, ({ one }) => ({
  session: one(workflowSessions, {
    fields: [workflowSteps.sessionId],
    references: [workflowSessions.id],
  }),
}));
```

### `output_data` JSONB Structure Per Step

**Step 1 (outline):**
```json
{
  "outlineText": "## 故事背景\n...",
  "chapters": [
    { "title": "第1章", "keyEvents": ["..."], "estimatedWords": 3000 },
    { "title": "第2章", "keyEvents": ["..."], "estimatedWords": 3500 }
  ],
  "mainCharacters": [
    { "name": "陈默", "role": "主角", "brief": "..." }
  ]
}
```

**Step 2 (expand):**
```json
{
  "chapterIndex": 0,
  "chapterTitle": "穿越从Hello World开始",
  "content": "完整的章节正文...",
  "wordCount": 3150,
  "keyScenes": [
    { "title": "穿越", "paragraph": "3-5", "description": "..." }
  ]
}
```

**Step 3 (polish):**
```json
{
  "summary": {
    "totalIssues": 12,
    "critical": 1,
    "moderate": 5,
    "minor": 6,
    "overallScore": 85
  },
  "reviews": [
    {
      "category": "grammar",
      "issues": [
        {
          "id": "g001",
          "severity": "minor",
          "location": { "chapterIndex": 0, "paragraph": 3 },
          "original": "原文...",
          "suggestion": "建议...",
          "reason": "原因..."
        }
      ]
    }
  ],
  "polishedChapters": [
    {
      "chapterIndex": 0,
      "originalWordCount": 3150,
      "polishedWordCount": 3080,
      "changesCount": 5,
      "content": "润色后的正文..."
    }
  ]
}
```

---

## 7. Implementation Notes

### File Structure

```
server/src/
├── routes/
│   ├── ai.ts                          # Existing AI routes (keep as-is)
│   └── ai-workflow.ts                 # NEW: workflow endpoints
├── middleware/
│   └── aiRateLimit.ts                 # Existing (reuse)
├── storage/database/shared/
│   ├── schema.ts                      # ADD: workflow_sessions, workflow_steps tables
│   └── relations.ts                   # ADD: workflow relations
├── services/
│   └── workflow.service.ts            # NEW: business logic for workflow management
├── prompts/
│   ├── outline.prompt.ts              # NEW: system prompt for Step 1
│   ├── expand.prompt.ts               # NEW: system prompt for Step 2
│   └── polish.prompt.ts               # NEW: system prompt for Step 3
└── utils/
    └── sse-helper.ts                  # Existing SSE write helper (reuse)
```

### Key Design Decisions

1. **SSE for all generation endpoints** — Consistent with existing `/api/v1/ai/*` endpoints, provides real-time streaming UX
2. **JSONB for flexibility** — `workflow_steps.output_data` uses JSONB to accommodate different output shapes per step type
3. **Regeneration history** — `generation_history` stores previous outputs so users can roll back
4. **Session-scoped** — Each workflow session is independent; a book can have multiple sessions (user may restart workflow)
5. **Book sync on approval** — Content is synced to the `books.volumes` structure only when user explicitly approves
6. **Reuse existing patterns** — `requireAuth`, `aiRateLimit`, SSE stream helpers, error handling all follow existing code patterns

### Migration Strategy

1. Add `workflow_sessions` and `workflow_steps` tables to `schema.ts`
2. Add relations to `relations.ts`
3. Run migration (Drizzle push or manual SQL)
4. Create `services/workflow.service.ts` with core business logic
5. Create prompt files for each step
6. Create `routes/ai-workflow.ts` with the 7 endpoints
7. Register router in `index.ts`: `app.use('/api/v1/ai/workflow', workflowRouter)`

### System Prompts (Brief)

**Step 1 - Outline Prompt Theme:**
> 你是一位顶级网文大纲创作专家。根据用户提供的故事概念和类型，生成结构化大纲。包含故事背景、核心设定、主要角色、主线剧情和分章大纲。每章给出标题、核心事件和预估字数。

**Step 2 - Expand Prompt Theme:**
> 你是一位资深网文作家。根据大纲和用户要求，将指定章节扩写为2000-5000字的完整叙事。需保持角色一致性、风格连贯性，并加入生动的场景描写和对话。

**Step 3 - Polish Prompt Theme:**
> 你是一位专业的文学编辑。对用户的章节进行全面的润色审查，检查语法错误、节奏问题、角色一致性，按严重程度分类给出具体修改建议。

---

> **End of Document**