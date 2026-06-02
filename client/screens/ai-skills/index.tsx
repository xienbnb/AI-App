import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";
import { useSafeRouter } from "@/hooks/useSafeRouter";

const SKILLS = [
  {
    category: "定位规划",
    items: [
      {
        name: "赛道分析",
        icon: "bullseye",
        color: "#E11D48",
        bgColor: "#FFF1F2",
        desc: "分析爆款赛道与差异化定位，精准把握市场机会",
      },
      {
        name: "篇幅规划",
        icon: "calendar",
        color: "#2563EB",
        bgColor: "#EFF6FF",
        desc: "规划作品篇幅长度与更新节奏，掌控创作节奏",
      },
    ],
  },
  {
    category: "世界构建",
    items: [
      {
        name: "世界观",
        icon: "globe",
        color: "#059669",
        bgColor: "#ECFDF5",
        desc: "构建完整世界观底层规则，打造沉浸式世界",
      },
      {
        name: "人物设定",
        icon: "user",
        color: "#D97706",
        bgColor: "#FFFBEB",
        desc: "生成核心人物三维设定，塑造鲜活角色",
      },
      {
        name: "关系网",
        icon: "share-nodes",
        color: "#9333EA",
        bgColor: "#FAF5FF",
        desc: "构建人物关系网络，理清角色脉络",
      },
    ],
  },
  {
    category: "大纲创作",
    items: [
      {
        name: "分卷大纲",
        icon: "layer-group",
        color: "#6366F1",
        bgColor: "#EEF2FF",
        desc: "生成三幕式分卷大纲，搭建故事骨架",
      },
      {
        name: "单章大纲",
        icon: "file-lines",
        color: "#0891B2",
        bgColor: "#ECFEFF",
        desc: "生成单章精细化大纲，把控章节脉络",
      },
    ],
  },
  {
    category: "正文生成",
    items: [
      {
        name: "正文生成",
        icon: "pen",
        color: "#EA580C",
        bgColor: "#FFF7ED",
        desc: "生成单章正文初稿，高效产出内容",
      },
      {
        name: "场景优化",
        icon: "bolt",
        color: "#DC2626",
        bgColor: "#FEF2F2",
        desc: "优化关键场景描写，提升画面感与张力",
      },
    ],
  },
  {
    category: "品质打磨",
    items: [
      {
        name: "逻辑校验",
        icon: "magnifying-glass",
        color: "#0D9488",
        bgColor: "#F0FDFA",
        desc: "检测逻辑漏洞与角色OOC，确保剧情连贯",
      },
      {
        name: "批量润色",
        icon: "paintbrush",
        color: "#7C3AED",
        bgColor: "#F5F3FF",
        desc: "全文润色与文风统一，提升文字质感",
      },
      {
        name: "爆款简介",
        icon: "bullhorn",
        color: "#DB2777",
        bgColor: "#FDF2F8",
        desc: "生成爆款简介与吸睛章节标题，提升点击",
      },
    ],
  },
];

export default function AISkillsScreen() {
  const router = useSafeRouter();

  return (
    <Screen>
      <ScrollView className="flex-1 bg-gray-50" showsVerticalScrollIndicator={false}>
        {/* Header Banner */}
        <View className="bg-indigo-500 pt-12 pb-8 px-5 rounded-b-[32px]">
          <View className="flex-row items-center gap-2 mb-1">
            <TouchableOpacity
              className="w-9 h-9 rounded-xl bg-white/20 items-center justify-center"
              onPress={() => router.back()}
            >
              <FontAwesome6 name="arrow-left" size={16} color="white" />
            </TouchableOpacity>
            <View className="w-9 h-9 rounded-xl bg-white/20 items-center justify-center">
              <FontAwesome6 name="wand-magic-sparkles" size={18} color="white" />
            </View>
            <Text className="text-xl font-bold text-white">创作技能</Text>
          </View>
          <Text className="text-sm text-white/80 ml-[72px]">12项专业工具，覆盖创作全流程</Text>
        </View>

        <View className="px-4 pt-5 pb-8">
          {/* Skills Flow Diagram */}
          <View className="bg-white rounded-2xl p-5 mb-5 shadow-sm border border-gray-100">
            <Text className="text-sm font-bold text-gray-900 mb-3">创作全流程</Text>
            <View className="flex-row items-center justify-between">
              {[
                { label: "定位", icon: "compass", color: "#E11D48" },
                { label: "构建", icon: "sitemap", color: "#059669" },
                { label: "大纲", icon: "layer-group", color: "#6366F1" },
                { label: "正文", icon: "pen", color: "#EA580C" },
                { label: "打磨", icon: "gem", color: "#7C3AED" },
              ].map((step, i) => (
                <View key={i} className="items-center flex-1">
                  <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: step.color + "15" }}>
                    <FontAwesome6 name={step.icon as any} size={16} color={step.color} />
                  </View>
                  <Text className="text-[10px] text-gray-500 mt-1.5">{step.label}</Text>
                  {i < 4 && (
                    <View className="absolute -right-2 top-5">
                      <FontAwesome6 name="chevron-right" size={8} color="#CBD5E1" />
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Skill Categories */}
          {SKILLS.map((category, cIdx) => (
            <View key={cIdx} className="mb-5">
              <Text className="text-sm font-bold text-gray-900 mb-3 ml-1">{category.category}</Text>
              <View className="gap-3">
                {category.items.map((skill, sIdx) => (
                  <TouchableOpacity
                    key={sIdx}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex-row items-center active:opacity-80"
                    style={{
                      shadowColor: skill.color,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.06,
                      shadowRadius: 6,
                      elevation: 1,
                    }}
                  >
                    <View
                      className="w-12 h-12 rounded-2xl items-center justify-center mr-4"
                      style={{ backgroundColor: skill.bgColor }}
                    >
                      <FontAwesome6 name={skill.icon as any} size={20} color={skill.color} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold text-gray-900 text-base mb-0.5">{skill.name}</Text>
                      <Text className="text-sm text-gray-500 leading-tight">{skill.desc}</Text>
                    </View>
                    <FontAwesome6 name="chevron-right" size={12} color="#CBD5E1" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}