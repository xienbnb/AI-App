import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";

const FEATURES = [
  { icon: "S", title: "智能润色", desc: "优化表达，更具文采", gradient: ["#8B5CF6", "#EC4899"] },
  { icon: "G", title: "扩写缩写", desc: "扩展或压缩内容", gradient: ["#22C55E", "#14B8A6"] },
  { icon: "I", title: "灵感生成", desc: "激发创作灵感", gradient: ["#F59E0B", "#F97316"] },
  { icon: "M", title: "人设生成", desc: "快速生成人物设定", gradient: ["#06B6D4", "#0EA5E9"] },
  { icon: "R", title: "大纲助手", desc: "智能搭建故事框架", gradient: ["#F43F5E", "#EF4444"] },
  { icon: "Y", title: "AI检测", desc: "检测AI生成概率", gradient: ["#6366F1", "#8B5CF6"] },
];

export default function AIWorkshopScreen() {
  const router = useSafeRouter();

  return (
    <Screen>
      <ScrollView className="flex-1 px-4">
        {/* 头部Banner */}
        <View
          className="rounded-2xl p-5 mt-2 mb-4"
          style={{
            backgroundColor: "#6366F1",
            shadowColor: "#6366F1",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-1">
              <Text className="text-xl font-bold text-white">AI 写作工坊</Text>
              <Text className="text-sm text-white/80 mt-1">智能辅助，创作无忧</Text>
            </View>
            <Text className="text-4xl">A</Text>
          </View>
          <View className="flex-row items-center justify-between">
            <View className="items-center">
              <Text className="text-2xl font-bold text-white">98%</Text>
              <Text className="text-xs text-white/80">AI检测通过率</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-white">1000+</Text>
              <Text className="text-xs text-white/80">模板可用</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-white">24/7</Text>
              <Text className="text-xs text-white/80">全天服务</Text>
            </View>
          </View>
        </View>

        {/* 功能网格 */}
        <View className="flex-row flex-wrap gap-3 mb-8">
          {FEATURES.map((feature) => (
            <TouchableOpacity
              key={feature.title}
              onPress={() => router.push("/report")}
              className="w-[48%] bg-white rounded-2xl p-4"
              style={{
                shadowColor: "#6366F1",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 1,
              }}
            >
              <View
                className="w-10 h-10 rounded-xl items-center justify-center mb-3"
                style={{ backgroundColor: feature.gradient[0] }}
              >
                <Text className="text-lg text-white">{feature.icon}</Text>
              </View>
              <Text className="font-semibold text-sm text-gray-800 mb-1">{feature.title}</Text>
              <Text className="text-xs text-gray-500">{feature.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}