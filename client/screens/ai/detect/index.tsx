import { createToolPage } from "@/screens/ai/shared";

export default createToolPage({
  title: "AI检测",
  icon: "magnifying-glass",
  subtitle: "检测文本是否为AI生成",
  endpoint: "/api/v1/ai/detect",
  fields: [
    { key: "text", label: "待检测文本", placeholder: "粘贴需要检测的文本内容（建议300字以上）", multiline: true },
  ],
  suggestions: [],
});