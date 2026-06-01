import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";

const ITEMS = [
  { label: "AI生成概率", score: 3, status: "极低", color: "from-green-400 to-emerald-500" },
  { label: "原创性检测", score: 9, status: "优秀", color: "from-green-400 to-emerald-500" },
  { label: "人设一致性", score: 8.5, status: "良好", color: "from-blue-400 to-cyan-500" },
  { label: "剧情连贯性", score: 9, status: "优秀", color: "from-green-400 to-emerald-500" },
  { label: "重复内容检测", score: 10, status: "完美", color: "from-green-400 to-emerald-500" },
];

export default function ReportScreen() {
  const router = useSafeRouter();

  return (
    <Screen>
      <ScrollView className="flex-1 px-4">
        {/* 评分头部 */}
        <View
          className="rounded-2xl p-5 mt-2 mb-4 items-center"
          style={{
            backgroundColor: "#10B981",
            shadowColor: "#10B981",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <Text className="text-sm text-white/90 mb-1">AI内容质量评分</Text>
          <Text className="text-5xl font-bold text-white mb-2">98</Text>
          <Text className="text-sm text-white/90">V 内容质量优秀，通过检测</Text>
        </View>

        {/* 检测详情 */}
        <View className="bg-white rounded-2xl p-4 mb-4" style={{
          shadowColor: "#6366F1",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 1,
        }}>
          <Text className="text-sm font-semibold text-gray-800 mb-4">D 检测详情</Text>
          <View className="space-y-4 gap-4">
            {ITEMS.map((item) => (
              <View key={item.label}>
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-sm text-gray-600">{item.label}</Text>
                  <View className="flex-row items-center gap-2">
                    <Text
                      className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                      style={{ backgroundColor: item.score >= 8 ? "#10B981" : item.score >= 6 ? "#6366F1" : "#EF4444" }}
                    >
                      {item.status}
                    </Text>
                    <Text className="text-sm font-bold text-gray-800">{item.score}/10</Text>
                  </View>
                </View>
                <View className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${item.score * 10}%`,
                      backgroundColor: item.score >= 8 ? "#10B981" : item.score >= 6 ? "#6366F1" : "#EF4444",
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 操作按钮 */}
        <View className="flex-row gap-3 mb-8">
          <TouchableOpacity className="flex-1 py-3 rounded-xl bg-gray-100 items-center">
            <Text className="text-gray-700 text-sm font-medium">U 导出报告</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 py-3 rounded-xl items-center"
            style={{ backgroundColor: "#6366F1" }}
          >
            <Text className="text-white text-sm font-medium">Y 采纳建议</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  );
}