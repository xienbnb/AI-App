import { View, Text, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

const TOOLS = [
  { icon: "users", title: "AI角色库", desc: "快速生成原创角色", color: "#8B5CF6", bgColor: "#F3E8FF", route: "/ai-character" },
  { icon: "sitemap", title: "大纲助手", desc: "智能搭建故事框架", color: "#06B6D4", bgColor: "#CFFAFE", route: "/ai-outline" },
  { icon: "image", title: "封面生成器", desc: "AI 生成精美封面", color: "#F43F5E", bgColor: "#FFE4E6", route: "/ai-cover" },
  { icon: "magnifying-glass", title: "AI检测", desc: "检测AI生成概率", color: "#F59E0B", bgColor: "#FEF3C7", route: "/ai-detect" },
  { icon: "map", title: "地图生成器", desc: "生成奇幻世界地图", color: "#10B981", bgColor: "#D1FAE5", route: "/ai-map" },
  { icon: "palette", title: "图片生成", desc: "生成小说精美插画", color: "#EC4899", bgColor: "#FCE7F3", route: "/ai-image-gen" },
  { icon: "circle-nodes", title: "人物关系网", desc: "角色关系网络分析", color: "#6366F1", bgColor: "#E0E7FF", route: "/ai-relationship" },
  { icon: "file-pen", title: "智能润色", desc: "优化表达提升文采", color: "#14B8A6", bgColor: "#CCFBF1", route: "/ai-character" },
  { icon: "arrows-left-right", title: "扩写缩写", desc: "扩展或压缩内容", color: "#8B5CF6", bgColor: "#EDE9FE", route: "/ai-outline" },
  { icon: "lightbulb", title: "灵感生成", desc: "激发创作灵感", color: "#F97316", bgColor: "#FFEDD5", route: "/ai-outline" },
  { icon: "wand-magic-sparkles", title: "创作技能", desc: "12项专业创作工具", color: "#6366F1", bgColor: "#EEF2FF", route: "/ai-skills" },
];
const KNOWLEDGE_BASES = [
  { name: "世界观库", icon: "globe", color: "#6366F1", count: 0 },
  { name: "人物库", icon: "users", color: "#F59E0B", count: 0 },
  { name: "大纲库", icon: "layers", color: "#10B981", count: 0 },
  { name: "素材库", icon: "archive", color: "#EC4899", count: 0 },
];


export default function AIWorkshopScreen() {
  const router = useSafeRouter();

  const navigateTo = (route: string, title: string) => {
    router.push(route as any);
  };

  return (
    <Screen>
      <ScrollView className="flex-1 px-4">
        {/* Header Banner */}
        <View className="rounded-2xl p-6 mt-2 mb-5 overflow-hidden"
          style={{ backgroundColor: "#6366F1" }}
        >
          {/* Decorative circles */}
          <View className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20" style={{ backgroundColor: "#FFFFFF" }} />
          <View className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full opacity-10" style={{ backgroundColor: "#FFFFFF" }} />

          <View className="flex-row items-center mb-4">
            <View className="w-12 h-12 rounded-2xl items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
              <FontAwesome6 name="wand-magic-sparkles" size={22} color="white" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-xl font-bold text-white">AI 写作工坊</Text>
              <Text className="text-sm text-white/80">智能辅助，创作无忧</Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between mt-2">
            <View className="items-center flex-1">
              <Text className="text-xl font-bold text-white">12</Text>
              <Text className="text-xs text-white/80">AI工具</Text>
            </View>
            <View className="w-px h-8 bg-white/20" />
            <View className="items-center flex-1">
              <Text className="text-xl font-bold text-white">98%</Text>
              <Text className="text-xs text-white/80">通过率</Text>
            </View>
            <View className="w-px h-8 bg-white/20" />
            <View className="items-center flex-1">
              <Text className="text-xl font-bold text-white">1000+</Text>
              <Text className="text-xs text-white/80">模板</Text>
            </View>
          </View>
        </View>

        {/* Tool Grid */}
        <View className="flex-row flex-wrap justify-between mb-8">
          {TOOLS.map((tool) => (
            <TouchableOpacity
              key={tool.title}
              onPress={() => navigateTo(tool.route, tool.title)}
              className="bg-white rounded-2xl p-4 mb-3"
              style={{
                width: CARD_WIDTH,
                shadowColor: tool.color,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View className="w-10 h-10 rounded-xl items-center justify-center mb-3"
                style={{ backgroundColor: tool.bgColor }}>
                <FontAwesome6 name={tool.icon as any} size={18} color={tool.color} />
              </View>
              <Text className="font-semibold text-sm text-gray-800 mb-1">{tool.title}</Text>
              <Text className="text-xs text-gray-500">{tool.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

          {/* 知识库 */}
          <View className="mt-6 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-base font-bold text-gray-900">知识库</Text>
              <TouchableOpacity>
                <Text className="text-xs text-indigo-500 font-medium">查看全部</Text>
              </TouchableOpacity>
            </View>
            <View className="flex-row flex-wrap">
              {KNOWLEDGE_BASES.map((kb, idx) => (
                <TouchableOpacity key={idx}
                  className="w-1/2 p-3 rounded-xl mb-2"
                  style={{ backgroundColor: kb.color + "0f" }}>
                  <FontAwesome6 name={kb.icon} size={18} color={kb.color} />
                  <Text className="text-sm font-semibold text-gray-800 mt-1.5">{kb.name}</Text>
                  <Text className="text-xs text-gray-500 mt-0.5">{kb.count} 个条目</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
      </ScrollView>
    </Screen>
  );
}