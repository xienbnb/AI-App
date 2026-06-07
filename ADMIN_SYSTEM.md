# 管理员系统设计文档

> 管理后台分为 **Web 端（网站）** 和 **移动端（App）**，共享同一套后端 API。

---

## 一、系统架构

```
┌─────────────────────────────────────────────────┐
│                 共享后端 API                       │
│            /api/v1/admin/*                       │
└────────────┬────────────────────┬───────────────┘
             │                    │
     ┌───────▼───────┐    ┌──────▼──────┐
     │   Web 管理后台  │    │  App 管理入口 │
     │  (PC浏览器)     │    │  (手机端)    │
     │  完整功能面板    │    │  轻量管理    │
     └───────────────┘    └─────────────┘
```

- **Web 端**：给管理员在电脑上用的完整管理面板（所有功能）
- **移动端**：App 内嵌的管理入口，做紧急操作和实时监控

---

## 二、权限体系

### 管理员角色

| 角色 | 级别 | 可管理范围 |
|------|------|-----------|
| **超级管理员** | Lv3 | 全部权限，包括添加/删除管理员 |
| **运营管理员** | Lv2 | 用户管理、内容审核、兑换码管理 |
| **客服管理员** | Lv1 | 用户查询、工单处理、查看数据 |

### 权限控制方式

```typescript
// 后端中间件示例
function requireAdmin(minLevel: number) {
  return (req, res, next) => {
    const admin = req.admin; // 从 x-session 解析
    if (!admin || admin.level < minLevel) {
      return res.status(403).json({ error: "权限不足" });
    }
    next();
  };
}
```

---

## 三、功能模块

### 模块 1：仪表盘 / Dashboard

| 功能 | Web | App | 说明 |
|------|:---:|:---:|------|
| 总用户数统计 | ✅ | ✅ | 今日新增 + 累计用户 |
| 付费用户数 | ✅ | ✅ | VIP 转化率 |
| 今日AI调用量 | ✅ | ✅ | 当前日调用次数/字数消耗 |
| 今日收入 | ✅ | ✅ | 模拟支付/真实支付金额 |
| 热门模型排行 | ✅ | ❌ | 各模型调用占比 |
| 近7日趋势图 | ✅ | ❌ | 折线图展示 |

**Web 端示例布局**：
```
┌─────────────────────────────────────────────┐
│  📊 数据概览                                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │
│  │总用户 │ │日活   │ │调用量 │ │收入   │       │
│  │ 1,234 │ │ 567  │ │8,901 │ │¥2,345│       │
│  └──────┘ └──────┘ └──────┘ └──────┘       │
│                                              │
│  📈 近7日趋势                                 │
│  ╱╲╱╲╱╲╱╲╱╲╱╲╱╲                               │
│  ────────────────────────────────────        │
│                                              │
│  📋 最新动态（实时滚动）                       │
│  • 用户XXX 购买了月卡 VIP                     │
│  • 用户XXX 兑换了兑换码                       │
└─────────────────────────────────────────────┘
```

---

### 模块 2：用户管理

| 功能 | Web | App | 说明 |
|------|:---:|:---:|------|
| 用户列表 | ✅ | ✅ | 搜索、分页、筛选 |
| 用户详情 | ✅ | ✅ | 查看用户信息/额度/记录 |
| 封禁/解封 | ✅ | ✅ | 封禁后无法登录和使用 |
| 设置VIP | ✅ | ✅ | 手动给用户开通VIP |
| 调整额度 | ✅ | ✅ | 手动增减字数额度/调用次数 |
| 查看调用记录 | ✅ | ❌ | 详细的API调用日志 |
| 导出用户数据 | ✅ | ❌ | CSV/Excel 导出 |

**用户列表接口**：
```
GET /api/v1/admin/users?page=1&limit=20&keyword=手机号&status=active&vip=free

Response:
{
  "total": 100,
  "page": 1,
  "data": [
    {
      "id": "xxx",
      "phone": "138****8000",
      "planType": "free",
      "tokenBalance": 5000,
      "usedMonthly": 12,
      "status": "active",
      "createdAt": "2026-01-01"
    }
  ]
}
```

---

### 模块 3：兑换码管理

| 功能 | Web | App | 说明 |
|------|:---:|:---:|------|
| 生成兑换码 | ✅ | ❌ | 指定类型、数量、有效期 |
| 批量生成 | ✅ | ❌ | 一键生成N个兑换码 |
| 兑换记录 | ✅ | ✅ | 谁兑换了、什么时候 |
| 手动核销 | ✅ | ✅ | 给用户手动发奖励 |

**兑换码类型**：

| 类型 | code 前缀 | 说明 |
|------|-----------|------|
| 字数包 | `TOKEN_` | 兑换获得指定字数余额 |
| 调用次数 | `CALL_` | 兑换获得指定次数的AI调用 |
| VIP时长 | `VIP_` | 兑换获得N天/月 VIP 资格 |

**兑换码数据库表**：
```sql
CREATE TABLE redeem_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(32) UNIQUE NOT NULL,      -- 兑换码
  type          VARCHAR(20) NOT NULL,              -- token / call / vip
  value         INTEGER NOT NULL,                  -- 数值（字数/天数/次数）
  uses_total    INTEGER NOT NULL DEFAULT 1,        -- 总可兑换次数
  uses_left     INTEGER NOT NULL DEFAULT 1,        -- 剩余可兑换次数
  expires_at    TIMESTAMP,                         -- 过期时间（null=永久有效）
  created_by    UUID NOT NULL,                     -- 创建者
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE redeem_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id       UUID NOT NULL REFERENCES redeem_codes(id),
  user_id       UUID NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);
```

---

### 模块 4：内容审核

| 功能 | Web | App | 说明 |
|------|:---:|:---:|------|
| 帖子列表 | ✅ | ✅ | 待审核/已审核 |
| 审核操作 | ✅ | ✅ | 通过/驳回/删除 |
| 举报管理 | ✅ | ❌ | 用户举报处理 |
| 敏感词管理 | ✅ | ❌ | 配置敏感词库 |

---

### 模块 5：系统设置

| 功能 | Web | App | 说明 |
|------|:---:|:---:|------|
| 公告管理 | ✅ | ❌ | 发布 App 公告/通知 |
| 套餐配置 | ✅ | ❌ | 调整VIP套餐价格/权益 |
| 任务配置 | ✅ | ❌ | 调整福利任务奖励 |
| 管理员管理 | ✅ | ❌ | 添加/删除管理员账号 |

---

## 四、后端 API 概览

所有管理接口统一前缀：`/api/v1/admin/`

### 认证方式
- 使用现有的 `x-session` header 鉴权
- 后端从 Supabase session 获取用户信息
- 检查 `user.role === 'admin'` 或独立的管理员表

### 接口清单

```
# 仪表盘
GET    /api/v1/admin/dashboard              → 数据概览

# 用户管理
GET    /api/v1/admin/users                   → 用户列表
GET    /api/v1/admin/users/:id              → 用户详情
PATCH  /api/v1/admin/users/:id/ban          → 封禁/解封
PATCH  /api/v1/admin/users/:id/vip          → 设置VIP
PATCH  /api/v1/admin/users/:id/quota        → 调整额度

# 兑换码管理
POST   /api/v1/admin/redeem/generate        → 生成兑换码
POST   /api/v1/admin/redeem/batch-generate  → 批量生成
GET    /api/v1/admin/redeem/list            → 兑换码列表
GET    /api/v1/admin/redeem/logs            → 兑换记录
POST   /api/v1/admin/redeem/manual          → 手动发放

# 内容审核
GET    /api/v1/admin/posts                   → 帖子列表
PATCH  /api/v1/admin/posts/:id/review       → 审核操作

# 系统设置
GET    /api/v1/admin/settings               → 获取设置
PUT    /api/v1/admin/settings               → 更新设置
GET    /api/v1/admin/admins                 → 管理员列表
POST   /api/v1/admin/admins                 → 添加管理员
DELETE /api/v1/admin/admins/:id             → 删除管理员
```

---

## 五、前端页面结构

### Web 端（独立管理网站）

```
admin/
├── login.tsx                  # 管理员登录（独立于用户登录）
├── layout.tsx                 # 管理后台布局（侧边栏+顶栏）
├── index.tsx                  # 仪表盘
├── users/
│   ├── index.tsx              # 用户列表
│   └── [id].tsx              # 用户详情
├── redeem/
│   ├── index.tsx              # 兑换码管理
│   └── generate.tsx           # 生成兑换码
├── posts/
│   ├── index.tsx              # 帖子审核列表
│   └── [id].tsx              # 帖子详情
├── settings/
│   ├── index.tsx              # 系统设置
│   └── admins.tsx             # 管理员管理
└── components/
    ├── Sidebar.tsx             # 侧边导航栏
    ├── StatsCard.tsx           # 统计卡片
    └── DataTable.tsx           # 通用数据表格
```

### App 端（嵌入现有 App）

在「我的」页面新增入口：**管理员登录** → 进入移动管理面板

```
app/(tabs)/
├── admin/                     # 管理员入口分组
│   ├── index.tsx              # 管理首页（仪表盘精简版）
│   ├── users.tsx              # 用户管理
│   ├── user-detail.tsx        # 用户详情
│   ├── redeem-codes.tsx       # 兑换码管理
│   └── posts.tsx              # 帖子审核
```

---

## 六、数据库变更（新增表）

```sql
-- 管理员表（独立于普通用户表）
CREATE TABLE admin_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID UNIQUE NOT NULL REFERENCES users(id),
  role          VARCHAR(20) NOT NULL DEFAULT 'operator',  -- super_admin / operator / support
  level         INTEGER NOT NULL DEFAULT 1,               -- 权限级别 1-3
  created_at    TIMESTAMP DEFAULT NOW()
);

-- 兑换码表
CREATE TABLE redeem_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(32) UNIQUE NOT NULL,
  type          VARCHAR(20) NOT NULL,              -- token / call / vip
  value         INTEGER NOT NULL,
  uses_total    INTEGER NOT NULL DEFAULT 1,
  uses_left     INTEGER NOT NULL DEFAULT 1,
  expires_at    TIMESTAMP,
  created_by    UUID NOT NULL REFERENCES admin_users(id),
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- 兑换记录表
CREATE TABLE redeem_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id       UUID NOT NULL REFERENCES redeem_codes(id),
  user_id       UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT NOW()
);

-- 系统设置表
CREATE TABLE system_settings (
  key           VARCHAR(64) PRIMARY KEY,
  value         JSONB NOT NULL,
  updated_at    TIMESTAMP DEFAULT NOW()
);
```

---

## 七、实施计划

| 阶段 | 内容 | 备注 |
|------|------|------|
| **Phase 1** | 创建数据库表 + 管理员认证中间件 | 后端基础 |
| **Phase 2** | 实现后端管理 API（用户/兑换码/仪表盘） | 后端功能 |
| **Phase 3** | 管理后台 Web 端 | 用 HTML + Tailwind 实现 |
| **Phase 4** | App 端轻量管理入口 | 嵌入现有 Expo App |

---

## 八、Web 端技术选型建议

管理后台 Web 端优先使用 **HTML + Tailwind CSS v4 + JS** 纯静态页面（不依赖 React/Next.js），通过 fetch 直接调用后端 API。

优势：
- 无需额外编译构建
- 部署简单（扔到静态目录即可）
- 和后端 API 分离，互不影响

存放位置：`server/public/admin/` 或独立目录