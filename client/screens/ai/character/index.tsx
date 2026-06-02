import { createToolPage } from "@/screens/ai/shared";

export default createToolPage({
  title: "AI角色库",
  icon: "users",
  subtitle: "快速生成原创小说角色",
  endpoint: "/api/v1/ai/character",
  fields: [
    { key: "genre", label: "小说类型", placeholder: "例：玄幻、都市、言情、修仙..." },
    { key: "style", label: "角色风格", placeholder: "例：冷酷霸道、温柔治愈、腹黑..." },
  ],
  suggestions: ["玄幻 - 剑仙", "都市 - 霸总", "言情 - 甜宠", "修仙 - 反派"],
});