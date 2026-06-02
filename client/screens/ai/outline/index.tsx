import { createToolPage } from "@/screens/ai/shared";

export default createToolPage({
  title: "大纲助手",
  icon: "sitemap",
  subtitle: "智能搭建故事框架，生成完整大纲",
  endpoint: "/api/v1/ai/outline",
  fields: [
    { key: "title", label: "书名", placeholder: "输入你的小说书名" },
    { key: "genre", label: "小说类型", placeholder: "例：玄幻、都市、科幻、悬疑..." },
    { key: "description", label: "故事简介", placeholder: "简单描述故事背景和核心设定", multiline: true },
  ],
  suggestions: ["修仙 - 凡人逆袭", "悬疑 - 密室谜案", "科幻 - 星际战争", "都市 - 重生商战"],
});