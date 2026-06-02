import { createToolPage } from "@/screens/ai/shared";

export default createToolPage({
  title: "人物关系网",
  icon: "circle-nodes",
  subtitle: "构建小说角色关系网络",
  endpoint: "/api/v1/ai/relationship",
  fields: [
    { key: "title", label: "书名", placeholder: "输入你的小说书名" },
    { key: "genre", label: "小说类型", placeholder: "例：玄幻、都市、修仙..." },
    { key: "characters", label: "已有角色", placeholder: "列出已设定的角色名称，用逗号隔开", multiline: true },
  ],
  suggestions: ["玄幻 - 主角+师父+宿敌", "宫斗 - 皇后+贵妃+皇帝", "都市 - 男主+女主+兄弟"],
});