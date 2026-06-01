import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Switch } from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

function formatWordCount(count: number) {
  if (count >= 10000) return (count / 10000).toFixed(1) + "万";
  if (count >= 1000) return (count / 1000).toFixed(1) + "k";
  return count.toString();
}

export default function ProfileScreen() {
  const router = useSafeRouter();
  const [bookCount, setBookCount] = useState(0);
  const [totalWords, setTotalWords] = useState(0);
  const [guardianEnabled, setGuardianEnabled] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing`);
      const json = await res.json();
      if (json.success) {
        setBookCount(json.data.length);
        setTotalWords(json.data.reduce((sum: number, b: any) => sum + b.wordCount, 0));
      }
    } catch (e) {
      console.error("获取统计数据失败", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [fetchStats])
  );

  return (
    <Screen>
      <ScrollView className="flex-1 px-4">
        {/* 用户信息卡片 */}
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
          <View className="flex-row items-center gap-4 mb-4">
            <View className="w-16 h-16 rounded-2xl bg-white/20 items-center justify-center">
              <Text className="text-3xl">W</Text>
            </View>
            <View>
              <Text className="text-xl font-bold text-white">码字达人</Text>
              <Text className="text-sm text-white/80">番茄签约作者 · 创作2年</Text>
            </View>
          </View>
          <View className="flex-row justify-between">
            <View className="items-center">
              <Text className="text-2xl font-bold text-white">{bookCount}</Text>
              <Text className="text-xs text-white/80">作品</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-white">{formatWordCount(totalWords)}</Text>
              <Text className="text-xs text-white/80">总字数</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-white">365</Text>
              <Text className="text-xs text-white/80">连续创作</Text>
            </View>
          </View>
        </View>

        {/* 人设守护 */}
        <View className="bg-white rounded-2xl p-4 mb-4" style={{
          shadowColor: "#6366F1",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 1,
        }}>
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2">
              <Text className="text-xl">Shield</Text>
              <Text className="font-semibold text-gray-800">人设守护</Text>
            </View>
            <Switch
              value={guardianEnabled}
              onValueChange={setGuardianEnabled}
              trackColor={{ false: "#D1D5DB", true: "#818CF8" }}
              thumbColor={guardianEnabled ? "#6366F1" : "#F3F4F6"}
            />
          </View>
          <Text className="text-xs text-gray-500">实时检测人物设定一致性，防止OOC和人设崩坏</Text>
        </View>

        {/* 人物管理 */}
        <View className="mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-semibold text-gray-800">Team 人物管理</Text>
            <TouchableOpacity>
              <Text className="text-sm text-primary-500 font-medium">+ 添加</Text>
            </TouchableOpacity>
          </View>
          {[
            { name: "谢峰", role: "主角", desc: "穿越前是996社畜，穿越后获得阿拉德系统", gradient: ["#8B5CF6", "#EC4899"] },
            { name: "蔷薇", role: "女主角", desc: "缔造者能力拥有者，性格外冷内热", gradient: ["#3B82F6", "#06B6D4"] },
          ].map((char) => (
            <TouchableOpacity
              key={char.name}
              className="bg-white rounded-2xl p-4 flex-row items-center gap-3 mb-2"
              style={{
                shadowColor: "#6366F1",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 1,
              }}
            >
              <View
                className="w-12 h-12 rounded-xl items-center justify-center"
                style={{ backgroundColor: char.gradient[0] }}
              >
                <Text className="text-xl text-white">U</Text>
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="font-semibold text-gray-800">{char.name}</Text>
                  <Text className="px-2 py-0.5 bg-primary-500/10 text-primary-500 text-[10px] rounded-full">
                    {char.role}
                  </Text>
                </View>
                <Text className="text-xs text-gray-500" numberOfLines={1}>{char.desc}</Text>
              </View>
              <Text className="text-gray-300">›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 设置列表 */}
        <View className="bg-white rounded-2xl overflow-hidden mb-8" style={{
          shadowColor: "#6366F1",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 1,
        }}>
          {[
            { icon: "O", label: "深色模式" },
            { icon: "R", label: "大纲模板" },
            { icon: "AR", label: "主题设置" },
            { icon: "Bell", label: "提醒设置" },
            { icon: "Q", label: "帮助与反馈" },
          ].map((item, i) => (
            <TouchableOpacity
              key={item.label}
              className={`flex-row items-center justify-between px-4 py-3.5 ${i !== 4 ? "border-b border-gray-100" : ""}`}
            >
              <View className="flex-row items-center gap-3">
                <Text className="text-lg">{item.icon}</Text>
                <Text className="text-sm font-medium text-gray-800">{item.label}</Text>
              </View>
              <Text className="text-gray-300">›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}