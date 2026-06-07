import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome6 } from "@expo/vector-icons";
import { useSafeRouter } from "@/hooks/useSafeRouter";

const VERSION = "1.0.0";
const BUILD_NUMBER = "1";

const pages = [
  {
    id: "version",
    icon: "code-branch",
    label: "版本说明",
    content: `## 版本说明 v${VERSION}

当前版本：${VERSION} (Build ${BUILD_NUMBER})
更新日期：${new Date().toISOString().slice(0, 10)}

### 主要功能

- 📝 AI智能写作：基于大模型的智能创作助手
- 📖 书籍管理：多卷本、章节级管理
- 🎨 AI续写：自动续写、创意扩写
- 🎭 角色设定：智能角色创建与管理
- 📊 数据统计：写作进度与数据分析
- 🔄 云端同步：多设备数据同步
- 🎯 大纲规划：智能大纲生成

### 技术架构

- 前端：Expo 54 + React Native
- 后端：Express.js + PostgreSQL
- AI引擎：大语言模型 + RAG`,
  },
  {
    id: "privacy",
    icon: "shield",
    label: "隐私政策",
    content: `## 隐私政策

最后更新日期：${new Date().toISOString().slice(0, 10)}

### 信息收集

我们收集以下类型的信息：

1. **账号信息**：手机号、邮箱、昵称、头像
2. **创作内容**：您创作的小说、章节、大纲等文字内容
3. **使用数据**：操作日志、功能使用频率、设备信息
4. **支付信息**：通过第三方支付平台完成，我们不会存储完整的支付信息

### 信息使用

收集的信息用于：
- 提供、维护和改进服务
- 个性化推荐和优化
- 安全保障和防欺诈
- 法律合规要求

### 信息分享

我们不会向第三方出售您的个人信息。在以下情况可能会共享：
- 获得您的明确同意
- 法律规定或政府要求
- 保护用户或公众安全`,
  },
  {
    id: "collect",
    icon: "list-check",
    label: "个人信息收集清单",
    content: `## 个人信息收集清单

### 必需收集的信息

| 信息类型 | 用途 | 收集方式 |
|---------|------|---------|
| 手机号码 | 账号注册与登录 | 用户提供 |
| 邮箱地址 | 账号绑定与通知 | 用户提供 |
| 昵称 | 用户标识与展示 | 用户提供 |

### 可选收集的信息

| 信息类型 | 用途 | 收集方式 |
|---------|------|---------|
| 头像图片 | 个人展示 | 用户上传 |
| 个人简介 | 个人展示 | 用户填写 |
| 性别 | 个性化推荐 | 用户选择 |
| 笔名 | 创作署名 | 用户填写 |

### 自动收集的信息

| 信息类型 | 用途 |
|---------|------|
| 设备型号 | 兼容性优化 |
| 操作系统版本 | 功能适配 |
| IP地址 | 安全防护 |
| 操作日志 | 问题排查`,
  },
  {
    id: "third-party",
    icon: "share-nodes",
    label: "第三方共享信息清单",
    content: `## 第三方共享信息清单

### 服务提供商

| 第三方 | 共享信息 | 用途 | 隐私政策 |
|-------|---------|------|---------|
| 阿里云 | 图片、文件 | 对象存储 | aliyun.com/privacy |
| Supabase | 用户账号 | 身份认证 | supabase.com/privacy |
| 微信支付 | 订单信息 | 支付处理 | pay.weixin.qq.com |
| QQ钱包 | 订单信息 | 支付处理 | qq.com/privacy |

### 社交媒体登录

| 平台 | 获取的信息 |
|-----|-----------|
| 微信 | OpenID、昵称、头像 |
| QQ | OpenID、昵称、头像 |

### 数据传输说明

- 所有数据传输采用加密传输(HTTPS/TLS)
- 数据仅存储在境内服务器
- 不会将个人信息传输至境外`,
  },
  {
    id: "agreement",
    icon: "file-contract",
    label: "用户协议",
    content: `## 用户协议

### 一、服务条款

欢迎使用本AI创作平台。使用本服务即表示您同意以下条款。

### 二、账号管理

1. 用户需注册账号方可使用完整服务
2. 账号仅限本人使用，不得转让
3. 用户对账号下的所有活动负责
4. 发现异常登录应及时通知平台

### 三、内容规范

1. 用户创作内容应符合法律法规
2. 禁止发布违法、色情、暴力等内容
3. 平台有权对违规内容进行处理
4. 用户保留创作内容的著作权

### 四、AI生成内容

1. AI生成内容仅供参考
2. 用户应自行审核AI生成内容
3. 平台不对AI生成内容的准确性保证

### 五、服务变更与终止

1. 平台有权调整服务内容
2. VIP服务变更将提前通知
3. 违反协议可能导致账号封禁`,
  },
];

const quickLinks = [
  {
    id: "update",
    icon: "rotate",
    label: "检测更新",
    color: "#4F46E5",
    desc: "检查是否有新版本",
    onPress: () => Alert.alert("检测更新", "当前已是最新版本 v" + VERSION),
  },
  {
    id: "feedback",
    icon: "message",
    label: "意见反馈",
    color: "#3B82F6",
    desc: "告诉我们您的建议",
    onPress: () => Alert.alert("意见反馈", "反馈功能开发中，敬请期待\n您可以发送邮件至：feedback@app.com"),
  },
  {
    id: "rate",
    icon: "star",
    label: "给我们评分",
    color: "#F59E0B",
    desc: "支持我们做得更好",
    onPress: () => Alert.alert("评分", "即将跳转到应用商店评分页面"),
  },
];

export default function AboutScreen() {
  const router = useSafeRouter();
  const [activePage, setActivePage] = useState<string | null>(null);

  const activeContent = pages.find((p) => p.id === activePage);

  return (
    <View className="flex-1 bg-gray-50">
      <SafeAreaView edges={["top"]} className="bg-white">
        <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
          <TouchableOpacity
            onPress={() => (activePage ? setActivePage(null) : router.back())}
            className="w-10 h-10 items-center justify-center rounded-full bg-gray-100"
          >
            <FontAwesome6 name="arrow-left" size={18} color="#374151" />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-lg font-bold text-gray-900 mr-10">
            {activePage ? pages.find((p) => p.id === activePage)?.label || "关于我们" : "关于我们"}
          </Text>
        </View>
      </SafeAreaView>

      {activePage && activeContent ? (
        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 20 }}>
          <View className="bg-white rounded-2xl p-5 border border-gray-100">
            <Text className="text-sm text-gray-700 leading-6 whitespace-pre-line">{activeContent.content}</Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 30 }}>
          {/* App Logo & 信息 */}
          <View className="items-center py-8">
            <View className="w-20 h-20 rounded-3xl bg-indigo-500 items-center justify-center mb-4">
              <FontAwesome6 name="pen-fancy" size={32} color="#fff" />
            </View>
            <Text className="text-xl font-bold text-gray-900">AI创作助手</Text>
            <Text className="text-sm text-gray-400 mt-1">版本 {VERSION}</Text>
          </View>

          {/* 快捷操作 */}
          <View className="mx-4 mb-6">
            <View className="bg-white rounded-2xl overflow-hidden border border-gray-100">
              {quickLinks.map((link, i) => (
                <TouchableOpacity
                  key={link.id}
                  className={`flex-row items-center px-5 py-4 ${i !== quickLinks.length - 1 ? "border-b border-gray-50" : ""}`}
                  onPress={link.onPress}
                  activeOpacity={0.6}
                >
                  <View className="w-10 h-10 rounded-xl items-center justify-center mr-4" style={{ backgroundColor: `${link.color}15` }}>
                    <FontAwesome6 name={link.icon as any} size={16} color={link.color} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-gray-900">{link.label}</Text>
                    <Text className="text-xs text-gray-400 mt-0.5">{link.desc}</Text>
                  </View>
                  <FontAwesome6 name="chevron-right" size={14} color="#D1D5DB" />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 关于我们列表 */}
          <View className="mx-4">
            <Text className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2.5 ml-1">更多信息</Text>
            <View className="bg-white rounded-2xl overflow-hidden border border-gray-100">
              {pages.map((page, i) => (
                <TouchableOpacity
                  key={page.id}
                  className={`flex-row items-center px-5 py-4 ${i !== pages.length - 1 ? "border-b border-gray-50" : ""}`}
                  onPress={() => setActivePage(page.id)}
                  activeOpacity={0.6}
                >
                  <View className="w-10 h-10 rounded-xl items-center justify-center mr-4 bg-gray-50">
                    <FontAwesome6 name={page.icon as any} size={16} color="#6366F1" />
                  </View>
                  <Text className="flex-1 text-sm font-medium text-gray-900">{page.label}</Text>
                  <FontAwesome6 name="chevron-right" size={14} color="#D1D5DB" />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text className="text-center text-xs text-gray-300 mt-8">
            © 2024 AI创作助手 - 保留所有权利
          </Text>
        </ScrollView>
      )}
    </View>
  );
}