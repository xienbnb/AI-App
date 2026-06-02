import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Switch, Modal, Platform, KeyboardAvoidingView, TextInput, Alert } from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";

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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [guardianEnabled, setGuardianEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // AI 设置
  const [showAISettings, setShowAISettings] = useState(false);
  const [aiModel, setAiModel] = useState("doubao-seed-2-0-lite-260215");
  const [temperature, setTemperature] = useState("0.8");
  const [maxTokens, setMaxTokens] = useState("4096");

  // 数据统计弹窗
  const [showDataStats, setShowDataStats] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing`);
      const json = await res.json();
      if (json.success) {
        setBookCount(json.data.length);
        setTotalWords(json.data.reduce((sum: number, b: any) => sum + (b.wordCount || 0), 0));
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

  const settingsSections = [
    {
      title: "创作工具",
      items: [
        { icon: "sliders", label: "AI模型设置", color: "#8B5CF6", onPress: () => setShowAISettings(true) },
        { icon: "chart-simple", label: "数据统计", color: "#3B82F6", onPress: () => setShowDataStats(true) },
        { icon: "file-lines", label: "导出模板", color: "#06B6D4", onPress: () => undefined },
      ],
    },
    {
      title: "个性化",
      items: [
        { icon: "palette", label: "主题设置", color: "#EC4899", hasSwitch: true, switchValue: darkMode, onSwitchChange: setDarkMode },
        { icon: "bell", label: "消息通知", color: "#F59E0B", onPress: () => undefined },
      ],
    },
    {
      title: "其他",
      items: [
        { icon: "circle-question", label: "帮助与反馈", color: "#10B981", onPress: () => undefined },
        { icon: "info", label: "关于应用", color: "#6B7280", onPress: () => undefined },
      ],
    },
  ];

  return (
    <Screen>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ===== 用户信息卡 ===== */}
        <View
          className="mx-4 rounded-3xl p-6 mt-4 mb-5"
          style={{
            backgroundColor: "#4F46E5",
            shadowColor: "#4F46E5",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 16,
            elevation: 10,
          }}
        >
          <View className="flex-row items-center gap-4 mb-5">
            <View className="w-16 h-16 rounded-2xl bg-white/20 items-center justify-center">
              <FontAwesome6 name="user" size={28} color="#fff" />
            </View>
            <View className="flex-1">
              <Text className="text-xl font-bold text-white">码字达人</Text>
              <Text className="text-sm text-white/70 mt-0.5">创作 2 年 · {bookCount} 部作品</Text>
            </View>
            {!isLoggedIn ? (
              <TouchableOpacity
                className="bg-white/20 px-4 py-2 rounded-full"
                onPress={() => Alert.alert("功能预告", "登录功能即将上线，敬请期待！")}
              >
                <Text className="text-white text-sm font-medium">登录</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View className="flex-row justify-between bg-white/10 rounded-2xl p-4">
            <View className="items-center flex-1">
              <Text className="text-2xl font-bold text-white">{bookCount}</Text>
              <Text className="text-xs text-white/70 mt-1">作品</Text>
            </View>
            <View className="w-px bg-white/15" />
            <View className="items-center flex-1">
              <Text className="text-2xl font-bold text-white">{formatWordCount(totalWords)}</Text>
              <Text className="text-xs text-white/70 mt-1">总字数</Text>
            </View>
            <View className="w-px bg-white/15" />
            <View className="items-center flex-1">
              <Text className="text-2xl font-bold text-white">365</Text>
              <Text className="text-xs text-white/70 mt-1">连续天数</Text>
            </View>
          </View>
        </View>

        {/* ===== 快捷入口 ===== */}
        <View className="mx-4 mb-5">
          <View className="flex-row gap-3">
            {[
              { icon: "pen-to-square", label: "今日写作", color: "#4F46E5", count: "0字" },
              { icon: "lightbulb", label: "创作灵感", color: "#F59E0B", count: "3条" },
              { icon: "award", label: "成就徽章", color: "#EC4899", count: "5个" },
            ].map((item, i) => (
              <TouchableOpacity
                key={item.label}
                className="flex-1 bg-white rounded-2xl p-3.5 items-center"
                style={{
                  shadowColor: "#4F46E5",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 8,
                  elevation: 1,
                }}
              >
                <View className="w-9 h-9 rounded-xl items-center justify-center mb-2" style={{ backgroundColor: `${item.color}15` }}>
                  <FontAwesome6 name={item.icon as any} size={16} color={item.color} />
                </View>
                <Text className="text-xs font-medium text-gray-800">{item.label}</Text>
                <Text className="text-[10px] text-gray-400 mt-0.5">{item.count}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ===== 人设守护 ===== */}
        <View
          className="mx-4 bg-white rounded-2xl p-4 mb-5"
          style={{
            shadowColor: "#4F46E5",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 1,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: "#4F46E515" }}>
                <FontAwesome6 name="shield" size={18} color="#4F46E5" />
              </View>
              <View>
                <Text className="font-semibold text-gray-800">人设守护</Text>
                <Text className="text-xs text-gray-400 mt-0.5">保持角色设定一致性</Text>
              </View>
            </View>
            <Switch
              value={guardianEnabled}
              onValueChange={setGuardianEnabled}
              trackColor={{ false: "#D1D5DB", true: "#C7D2FE" }}
              thumbColor={guardianEnabled ? "#4F46E5" : "#F3F4F6"}
            />
          </View>
        </View>

        {/* ===== 常用角色 ===== */}
        <View className="mx-4 mb-5">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-semibold text-gray-800">常用角色</Text>
            <TouchableOpacity onPress={() => router.push("/ai-character")}>
              <Text className="text-sm font-medium" style={{ color: "#4F46E5" }}>管理</Text>
            </TouchableOpacity>
          </View>
          <View><ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-3">
              {[
                { name: "谢峰", role: "主角", color: "#8B5CF6" },
                { name: "蔷薇", role: "女主角", color: "#3B82F6" },
                { name: "林夜", role: "反派", color: "#EF4444" },
                { name: "白老", role: "导师", color: "#10B981" },
              ].map((char) => (
                <TouchableOpacity
                  key={char.name}
                  className="bg-white rounded-2xl p-3 items-center"
                  style={{
                    shadowColor: "#4F46E5",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.04,
                    shadowRadius: 8,
                    elevation: 1,
                  }}
                >
                  <View className="w-12 h-12 rounded-2xl items-center justify-center mb-2" style={{ backgroundColor: `${char.color}15` }}>
                    <FontAwesome6 name="user" size={20} color={char.color} />
                  </View>
                  <Text className="text-xs font-medium text-gray-800">{char.name}</Text>
                  <Text className="text-[10px] text-gray-400 mt-0.5">{char.role}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                className="bg-white rounded-2xl p-3 items-center justify-center"
                style={{
                  shadowColor: "#4F46E5",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 8,
                  elevation: 1,
                }}
                onPress={() => router.push("/ai-character")}
              >
                <View className="w-12 h-12 rounded-2xl items-center justify-center mb-2" style={{ backgroundColor: "#4F46E515" }}>
                  <FontAwesome6 name="plus" size={20} color="#4F46E5" />
                </View>
                <Text className="text-xs font-medium" style={{ color: "#4F46E5" }}>新建</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* ===== 设置分区 ===== */}
        {settingsSections.map((section, sIdx) => (
          <View key={section.title} className="mx-4 mb-4">
            <Text className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2.5 ml-1">
              {section.title}
            </Text>
            <View
              className="bg-white rounded-2xl overflow-hidden"
              style={{
                shadowColor: "#4F46E5",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 1,
              }}
            >
              {section.items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  className={`flex-row items-center px-4 py-3.5 ${i !== section.items.length - 1 ? "border-b border-gray-50" : ""}`}
                  onPress={item.onPress}
                  activeOpacity={item.onPress ? 0.6 : 1}
                >
                  <View className="w-8 h-8 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: `${item.color}15` }}>
                    <FontAwesome6 name={item.icon as any} size={14} color={item.color} />
                  </View>
                  <Text className="flex-1 text-sm font-medium text-gray-800">{item.label}</Text>
                  {"hasSwitch" in item && item.hasSwitch ? (
                    <Switch
                      value={item.switchValue}
                      onValueChange={(val) => item.onSwitchChange?.(val)}
                      trackColor={{ false: "#D1D5DB", true: "#C7D2FE" }}
                      thumbColor={item.switchValue ? "#4F46E5" : "#F3F4F6"}
                    />
                  ) : (
                    <FontAwesome6 name="chevron-right" size={12} color="#CBD5E1" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* ===== AI设置弹窗 ===== */}
      <Modal visible={showAISettings} transparent animationType="slide">
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => setShowAISettings(false)}
        >
          <KeyboardAvoidingView
            style={{ flex: 1, justifyContent: "flex-end" }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => undefined}>
              <View
                className="bg-white rounded-3xl p-6"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: -4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 20,
                  elevation: 20,
                }}
              >
                <View className="flex-row items-center justify-between mb-5">
                  <Text className="text-lg font-bold text-gray-800">AI模型设置</Text>
                  <TouchableOpacity onPress={() => setShowAISettings(false)}>
                    <FontAwesome6 name="xmark" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                <Text className="text-sm font-medium text-gray-700 mb-2">AI模型</Text>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {[
                    { id: "doubao-seed-2-0-lite-260215", name: "豆包Lite" },
                    { id: "doubao-seed-2-0-pro-260215", name: "豆包Pro" },
                    { id: "deepseek-v3-2-251201", name: "DeepSeek V3" },
                    { id: "kimi-k2-5-260127", name: "Kimi K2" },
                  ].map((model) => (
                    <TouchableOpacity
                      key={model.id}
                      className={`px-4 py-2 rounded-full border ${aiModel === model.id ? "border-indigo-500 bg-indigo-50" : "border-gray-200"}`}
                      onPress={() => setAiModel(model.id)}
                    >
                      <Text className={`text-sm ${aiModel === model.id ? "text-indigo-600 font-medium" : "text-gray-600"}`}>
                        {model.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text className="text-sm font-medium text-gray-700 mb-2">温度 {temperature}</Text>
                <View className="flex-row gap-2 mb-4">
                  {["0.1", "0.5", "0.8", "1.0"].map((t) => (
                    <TouchableOpacity
                      key={t}
                      className={`px-4 py-2 rounded-full border ${temperature === t ? "border-indigo-500 bg-indigo-50" : "border-gray-200"}`}
                      onPress={() => setTemperature(t)}
                    >
                      <Text className={`text-sm ${temperature === t ? "text-indigo-600 font-medium" : "text-gray-600"}`}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text className="text-sm font-medium text-gray-700 mb-2">最大Token</Text>
                <TextInput
                  className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-800 mb-5"
                  value={maxTokens}
                  onChangeText={setMaxTokens}
                  keyboardType="number-pad"
                />

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    className="flex-1 py-3 rounded-xl bg-gray-100 items-center"
                    onPress={() => setShowAISettings(false)}
                  >
                    <Text className="text-sm font-medium text-gray-600">取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 py-3 rounded-xl items-center"
                    style={{ backgroundColor: "#4F46E5" }}
                    onPress={() => setShowAISettings(false)}
                  >
                    <Text className="text-sm font-medium text-white">保存</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* ===== 数据统计弹窗 ===== */}
      <Modal visible={showDataStats} transparent animationType="slide">
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => setShowDataStats(false)}
        >
          <KeyboardAvoidingView
            style={{ flex: 1, justifyContent: "flex-end" }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => undefined}>
              <View
                className="bg-white rounded-3xl p-6"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: -4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 20,
                  elevation: 20,
                }}
              >
                <View className="flex-row items-center justify-between mb-5">
                  <Text className="text-lg font-bold text-gray-800">数据统计</Text>
                  <TouchableOpacity onPress={() => setShowDataStats(false)}>
                    <FontAwesome6 name="xmark" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                <View className="flex-row flex-wrap gap-3 mb-5">
                  {[
                    { label: "作品数", value: bookCount.toString(), color: "#4F46E5", icon: "book" },
                    { label: "总字数", value: formatWordCount(totalWords), color: "#3B82F6", icon: "pen" },
                    { label: "连续天数", value: "365", color: "#10B981", icon: "fire" },
                    { label: "今日写作", value: "0", color: "#F59E0B", icon: "clock" },
                  ].map((stat) => (
                    <View
                      key={stat.label}
                      className="w-[47%] bg-gray-50 rounded-2xl p-4"
                    >
                      <View className="w-9 h-9 rounded-xl items-center justify-center mb-3" style={{ backgroundColor: `${stat.color}15` }}>
                        <FontAwesome6 name={stat.icon as any} size={16} color={stat.color} />
                      </View>
                      <Text className="text-2xl font-bold text-gray-800">{stat.value}</Text>
                      <Text className="text-xs text-gray-400 mt-1">{stat.label}</Text>
                    </View>
                  ))}
                </View>

                <View className="bg-gray-50 rounded-2xl p-4">
                  <Text className="text-sm font-medium text-gray-700 mb-2">本周写作趋势</Text>
                  <View className="flex-row justify-between items-end h-20">
                    {["一", "二", "三", "四", "五", "六", "日"].map((day, i) => (
                      <View key={day} className="items-center flex-1">
                        <View
                          className="w-full mx-1 rounded-t-lg"
                          style={{
                            height: Math.max(4, ((i * 137 + 50) % 60) + 4),
                            backgroundColor: "#C7D2FE",
                            borderTopLeftRadius: 6,
                            borderTopRightRadius: 6,
                          }}
                        />
                        <Text className="text-[10px] text-gray-400 mt-1.5">{day}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  className="mt-5 py-3 rounded-xl items-center"
                  style={{ backgroundColor: "#F3F4F6" }}
                  onPress={() => setShowDataStats(false)}
                >
                  <Text className="text-sm font-medium text-gray-600">关闭</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}