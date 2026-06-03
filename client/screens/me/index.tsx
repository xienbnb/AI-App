import { useState, useCallback, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Switch, Modal, Platform, KeyboardAvoidingView, TextInput, Alert } from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

function formatWordCount(count: number) {
  if (count >= 10000) return (count / 10000).toFixed(1) + "万";
  if (count >= 1000) return (count / 1000).toFixed(1) + "k";
  return count.toString();
}

interface CustomModel {
  id: string;
  name: string;
  modelId: string;
  apiKey: string;
  baseUrl: string;
  createdAt: string;
}

interface Skill {
  id: string;
  name: string;
  desc: string;
  enabled: boolean;
}

const presetModels = [
  { id: "doubao-seed-2-0-lite-260215", name: "豆包 Lite", provider: "ByteDance", desc: "轻量快速，适合日常创作" },
  { id: "doubao-seed-2-0-pro-260215", name: "豆包 Pro", provider: "ByteDance", desc: "更强能力，适合复杂任务" },
  { id: "deepseek-v3-2-251201", name: "DeepSeek V3", provider: "DeepSeek", desc: "深度推理，逻辑严谨" },
  { id: "kimi-k2-5-260127", name: "Kimi K2", provider: "Moonshot", desc: "长文本处理，理解力强" },
  { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", provider: "Anthropic", desc: "安全可控，创意出色" },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", desc: "全能模型，综合表现优秀" },
];

const defaultSkills: Skill[] = [
  { id: "market", name: "赛道分析", desc: "爆款赛道分析与差异化定位", enabled: true },
  { id: "planning", name: "篇幅规划", desc: "规划作品篇幅与更新节奏", enabled: true },
  { id: "worldbuild", name: "世界观", desc: "构建完整世界观底层规则", enabled: true },
  { id: "character", name: "人物设定", desc: "生成核心人物三维设定", enabled: true },
  { id: "relations", name: "关系网", desc: "构建人物关系网络", enabled: true },
  { id: "outline", name: "分卷大纲", desc: "生成三幕式分卷大纲", enabled: true },
  { id: "chapter", name: "单章大纲", desc: "生成单章精细化大纲", enabled: false },
  { id: "writing", name: "正文生成", desc: "生成单章正文初稿", enabled: false },
  { id: "scene", name: "场景优化", desc: "优化关键场景描写", enabled: false },
  { id: "logic", name: "逻辑校验", desc: "检测逻辑漏洞与人物OOC", enabled: false },
  { id: "polish", name: "批量润色", desc: "全文批量润色与文风统一", enabled: false },
  { id: "blurb", name: "爆款简介", desc: "生成爆款简介与章节标题", enabled: false },
];

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
  const [aiTab, setAiTab] = useState<"preset" | "custom" | "skills">("preset");
  const [customModels, setCustomModels] = useState<CustomModel[]>([]);
  const [skills, setSkills] = useState<Skill[]>(defaultSkills);

  // 自定义模型表单
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customModelId, setCustomModelId] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");

  // 加载持久化的 AI 设置
  useEffect(() => {
    AsyncStorage.getItem("ai_settings").then((data) => {
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (parsed.aiModel) setAiModel(parsed.aiModel);
          if (parsed.temperature) setTemperature(parsed.temperature);
          if (parsed.maxTokens) setMaxTokens(parsed.maxTokens);
          if (parsed.skills) setSkills(parsed.skills);
          if (parsed.customModels) setCustomModels(parsed.customModels);
        } catch {}
      }
    });
  }, []);

  // 保存 AI 设置
  const saveAISettings = useCallback((updates: Record<string, unknown>) => {
    AsyncStorage.getItem("ai_settings").then((data) => {
      const current = data ? JSON.parse(data) : {};
      Object.assign(current, updates);
      AsyncStorage.setItem("ai_settings", JSON.stringify(current));
    });
  }, []);

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

  const addCustomModel = () => {
    if (!customName.trim() || !customModelId.trim() || !customApiKey.trim()) {
      Alert.alert("提示", "请填写模型名称、模型ID和API Key");
      return;
    }
    const newModel: CustomModel = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      modelId: customModelId.trim(),
      apiKey: customApiKey.trim(),
      baseUrl: customBaseUrl.trim() || "https://api.openai.com/v1",
      createdAt: new Date().toLocaleDateString(),
    };
    const updatedModels = [...customModels, newModel];
    setCustomModels(updatedModels);
    setAiModel(newModel.id);
    saveAISettings({ customModels: updatedModels, aiModel: newModel.id });
    setCustomName("");
    setCustomModelId("");
    setCustomApiKey("");
    setCustomBaseUrl("");
    setShowCustomForm(false);
  };

  const deleteCustomModel = (id: string) => {
    Alert.alert("删除模型", "确定要删除这个自定义模型吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () => {
          const updatedModels = customModels.filter((m) => m.id !== id);
          setCustomModels(updatedModels);
          if (aiModel === id) {
            setAiModel("doubao-seed-2-0-lite-260215");
            saveAISettings({ customModels: updatedModels, aiModel: "doubao-seed-2-0-lite-260215" });
          } else {
            saveAISettings({ customModels: updatedModels });
          }
        },
      },
    ]);
  };

  const toggleSkill = (id: string) => {
    const updatedSkills = skills.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
    setSkills(updatedSkills);
    saveAISettings({ skills: updatedSkills });
  };

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
            ].map((item) => (
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
        {settingsSections.map((section) => (
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
                className="bg-white rounded-3xl"
                style={{
                  maxHeight: "90%",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: -4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 20,
                  elevation: 20,
                }}
              >
                {/* Header */}
                <View className="flex-row items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
                  <Text className="text-lg font-bold text-gray-800">AI模型设置</Text>
                  <TouchableOpacity onPress={() => setShowAISettings(false)}>
                    <FontAwesome6 name="xmark" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                {/* Tabs */}
                <View className="flex-row px-6 pt-3 pb-2 gap-1">
                  {[
                    { key: "preset" as const, label: "预设模型", icon: "list" },
                    { key: "custom" as const, label: "自定义", icon: "microchip" },
                    { key: "skills" as const, label: "技能", icon: "bolt" },
                  ].map((tab) => (
                    <TouchableOpacity
                      key={tab.key}
                      className={`flex-row items-center gap-1.5 px-3.5 py-2 rounded-full ${
                        aiTab === tab.key ? "bg-indigo-50" : "bg-gray-50"
                      }`}
                      onPress={() => setAiTab(tab.key)}
                    >
                      <FontAwesome6
                        name={tab.icon as any}
                        size={11}
                        color={aiTab === tab.key ? "#4F46E5" : "#9CA3AF"}
                      />
                      <Text
                        className={`text-xs font-medium ${
                          aiTab === tab.key ? "text-indigo-600" : "text-gray-500"
                        }`}
                      >
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <ScrollView className="px-6 pb-4" style={{ maxHeight: 400 }}>
                  {/* ===== Preset Models ===== */}
                  {aiTab === "preset" && (
                    <View className="gap-2 py-2">
                      {presetModels.map((model) => (
                        <TouchableOpacity
                          key={model.id}
                          className={`flex-row items-center p-3.5 rounded-xl border ${
                            aiModel === model.id
                              ? "border-indigo-500 bg-indigo-50"
                              : "border-gray-100 bg-white"
                          }`}
                          onPress={() => { setAiModel(model.id); saveAISettings({ aiModel: model.id }); }}
                        >
                          <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${
                            aiModel === model.id ? "bg-indigo-100" : "bg-gray-50"
                          }`}>
                            <FontAwesome6 name="brain" size={16} color={aiModel === model.id ? "#4F46E5" : "#9CA3AF"} />
                          </View>
                          <View className="flex-1">
                            <View className="flex-row items-center gap-2">
                              <Text className="text-sm font-semibold text-gray-800">{model.name}</Text>
                              {aiModel === model.id && (
                                <View className="bg-indigo-500 rounded-full px-1.5 py-0.5">
                                  <Text className="text-[10px] text-white font-medium">当前</Text>
                                </View>
                              )}
                            </View>
                            <Text className="text-xs text-gray-400 mt-0.5">{model.provider} · {model.desc}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* ===== Custom Models ===== */}
                  {aiTab === "custom" && (
                    <View className="py-2">
                      {customModels.length === 0 && !showCustomForm && (
                        <View className="items-center py-8">
                          <View className="w-14 h-14 rounded-2xl items-center justify-center mb-3 bg-gray-50">
                            <FontAwesome6 name="microchip" size={24} color="#CBD5E1" />
                          </View>
                          <Text className="text-sm text-gray-500 mb-1">暂无自定义模型</Text>
                          <Text className="text-xs text-gray-400 mb-4">你可以添加自己的AI模型和API Key</Text>
                        </View>
                      )}

                      {customModels.map((model) => (
                        <View
                          key={model.id}
                          className={`flex-row items-center p-3.5 rounded-xl mb-2 border ${
                            aiModel === model.id ? "border-indigo-500 bg-indigo-50" : "border-gray-100 bg-white"
                          }`}
                        >
                          <View className="w-10 h-10 rounded-xl items-center justify-center mr-3 bg-amber-50">
                            <FontAwesome6 name="microchip" size={16} color="#F59E0B" />
                          </View>
                          <TouchableOpacity
                            className="flex-1"
                            onPress={() => { setAiModel(model.id); saveAISettings({ aiModel: model.id }); }}
                          >
                            <Text className="text-sm font-semibold text-gray-800">{model.name}</Text>
                            <Text className="text-xs text-gray-400 mt-0.5" numberOfLines={1}>
                              {model.modelId} · {model.baseUrl}
                            </Text>
                          </TouchableOpacity>
                          {aiModel === model.id && (
                            <View className="bg-indigo-500 rounded-full px-1.5 py-0.5 mr-2">
                              <Text className="text-[10px] text-white font-medium">当前</Text>
                            </View>
                          )}
                          <TouchableOpacity onPress={() => deleteCustomModel(model.id)}>
                            <FontAwesome6 name="trash-can" size={14} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      ))}

                      {showCustomForm ? (
                        <View className="bg-gray-50 rounded-xl p-4 mt-2">
                          <Text className="text-sm font-semibold text-gray-700 mb-3">添加自定义模型</Text>

                          <Text className="text-xs font-medium text-gray-600 mb-1">模型名称</Text>
                          <TextInput
                            className="bg-white rounded-xl px-4 py-2.5 text-sm text-gray-800 mb-3 border border-gray-200"
                            placeholder="如：我的模型"
                            placeholderTextColor="#CBD5E1"
                            value={customName}
                            onChangeText={setCustomName}
                          />

                          <Text className="text-xs font-medium text-gray-600 mb-1">模型ID</Text>
                          <TextInput
                            className="bg-white rounded-xl px-4 py-2.5 text-sm text-gray-800 mb-3 border border-gray-200"
                            placeholder="如：gpt-4o-mini"
                            placeholderTextColor="#CBD5E1"
                            value={customModelId}
                            onChangeText={setCustomModelId}
                          />

                          <Text className="text-xs font-medium text-gray-600 mb-1">API Key</Text>
                          <TextInput
                            className="bg-white rounded-xl px-4 py-2.5 text-sm text-gray-800 mb-3 border border-gray-200"
                            placeholder="sk-xxxxxxxxxxxxxxxx"
                            placeholderTextColor="#CBD5E1"
                            value={customApiKey}
                            onChangeText={setCustomApiKey}
                            secureTextEntry
                          />

                          <Text className="text-xs font-medium text-gray-600 mb-1">Base URL（可选）</Text>
                          <TextInput
                            className="bg-white rounded-xl px-4 py-2.5 text-sm text-gray-800 mb-3 border border-gray-200"
                            placeholder="https://api.openai.com/v1"
                            placeholderTextColor="#CBD5E1"
                            value={customBaseUrl}
                            onChangeText={setCustomBaseUrl}
                          />

                          <View className="flex-row gap-3 mt-1">
                            <TouchableOpacity
                              className="flex-1 py-2.5 rounded-xl bg-gray-200 items-center"
                              onPress={() => { setShowCustomForm(false); setCustomName(""); setCustomModelId(""); setCustomApiKey(""); setCustomBaseUrl(""); }}
                            >
                              <Text className="text-sm font-medium text-gray-600">取消</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              className="flex-1 py-2.5 rounded-xl items-center"
                              style={{ backgroundColor: "#4F46E5" }}
                              onPress={addCustomModel}
                            >
                              <Text className="text-sm font-medium text-white">添加</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          className="flex-row items-center justify-center py-3 rounded-xl border border-dashed border-gray-200 mt-2"
                          onPress={() => setShowCustomForm(true)}
                        >
                          <FontAwesome6 name="plus" size={14} color="#4F46E5" />
                          <Text className="text-sm font-medium ml-2" style={{ color: "#4F46E5" }}>
                            添加自定义模型
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* ===== Skills ===== */}
                  {aiTab === "skills" && (
                    <View className="py-2">
                      <Text className="text-xs text-gray-500 mb-3">
                        开启AI技能，让模型拥有更专业的能力
                      </Text>
                      {skills.map((skill) => (
                        <View
                          key={skill.id}
                          className="flex-row items-center p-3.5 rounded-xl mb-2 bg-white border border-gray-100"
                        >
                          <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${
                            skill.enabled ? "bg-indigo-50" : "bg-gray-50"
                          }`}>
                            <FontAwesome6
                              name="bolt"
                              size={16}
                              color={skill.enabled ? "#4F46E5" : "#CBD5E1"}
                            />
                          </View>
                          <View className="flex-1">
                            <Text className={`text-sm font-semibold ${skill.enabled ? "text-gray-800" : "text-gray-400"}`}>
                              {skill.name}
                            </Text>
                            <Text className={`text-xs mt-0.5 ${skill.enabled ? "text-gray-400" : "text-gray-300"}`}>
                              {skill.desc}
                            </Text>
                          </View>
                          <Switch
                            value={skill.enabled}
                            onValueChange={() => toggleSkill(skill.id)}
                            trackColor={{ false: "#E5E7EB", true: "#C7D2FE" }}
                            thumbColor={skill.enabled ? "#4F46E5" : "#F3F4F6"}
                          />
                        </View>
                      ))}
                    </View>
                  )}
                </ScrollView>

                {/* Footer */}
                <View className="px-6 pb-5 pt-2 border-t border-gray-100">
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