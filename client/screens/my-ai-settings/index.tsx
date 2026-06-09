/**
 * AI模型设置页面
 *
 * 独立页面版的AI设置，包含预设模型/自定义模型/技能三个Tab
 * 与我的页面中的弹窗功能相同，但作为独立页面
 * 从服务端获取/保存设置
 *
 * @file /client/screens/my-ai-settings/index.tsx
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

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
  prompt?: string;
  isCustom?: boolean;
  icon?: string;
}

// 预设模型列表
const presetModels = [
  { id: "doubao-seed-2-0-lite-260215", name: "豆包 Lite", provider: "ByteDance", desc: "轻量快速，适合日常创作" },
  { id: "doubao-seed-2-0-pro-260215", name: "豆包 Pro", provider: "ByteDance", desc: "更强能力，适合复杂任务" },
  { id: "deepseek-v3-2-251201", name: "DeepSeek V3", provider: "DeepSeek", desc: "深度推理，逻辑严谨" },
  { id: "kimi-k2-5-260127", name: "Kimi K2", provider: "Moonshot", desc: "长文本处理，理解力强" },
  { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", provider: "Anthropic", desc: "安全可控，创意出色" },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", desc: "全能模型，综合表现优秀" },
];

// 公益AI模型列表（SiliconFlow 免费接口）
const publicWelfareModels = [
  { id: "Pro/zai-org/GLM-4.7", name: "GLM-4.7", provider: "公益AI", desc: "智谱GLM，免费公益模型" },
  { id: "nex-agi/Nex-N2-Pro", name: "Nex N2 Pro", provider: "公益AI", desc: "高性能免费模型" },
  { id: "deepseek-ai/DeepSeek-OCR", name: "DeepSeek OCR", provider: "公益AI", desc: "DeepSeek 视觉理解" },
  { id: "tencent/Hunyuan-MT-7B", name: "混元 MT-7B", provider: "公益AI", desc: "腾讯混元翻译模型" },
];

// 默认技能列表
const defaultSkills: Skill[] = [
  { id: "create-book", name: "创建书籍", desc: "创建新作品（仅此技能可创建书籍）", enabled: true, icon: "book", prompt: "你是一个帮助用户创建新书籍的助手。根据用户提供的小说名称、类型和简介，严格遵守以下规则：只创建书籍，不生成大纲，不生成正文，不生成任何其他内容。创建完成后告知用户书籍已创建成功。" },
  { id: "market", name: "赛道分析", desc: "爆款赛道分析与差异化定位", enabled: true, icon: "chart-line" },
  { id: "planning", name: "篇幅规划", desc: "规划作品篇幅与更新节奏", enabled: true, icon: "ruler" },
  { id: "worldbuild", name: "世界观", desc: "构建完整世界观底层规则", enabled: true, icon: "globe" },
  { id: "character", name: "人物设定", desc: "生成核心人物三维设定", enabled: true, icon: "users" },
  { id: "relations", name: "关系网", desc: "构建人物关系网络", enabled: true, icon: "share-nodes" },
  { id: "outline", name: "分卷大纲", desc: "仅生成三幕式分卷大纲（不创建任何章节）", enabled: true, icon: "sitemap" },
  { id: "chapter", name: "单章大纲", desc: "仅生成单章精细化大纲（需挂载书籍）", enabled: false, icon: "list" },
  { id: "writing", name: "正文生成", desc: "仅生成单章正文初稿（需挂载书籍并选择章节）", enabled: false, icon: "pen-fancy" },
  { id: "scene", name: "场景优化", desc: "仅优化关键场景描写", enabled: false, icon: "image" },
  { id: "logic", name: "逻辑校验", desc: "仅检测逻辑漏洞与人物OOC", enabled: false, icon: "check-double" },
  { id: "polish", name: "批量润色", desc: "仅全文润色（不修改章节结构）", enabled: false, icon: "wand-magic-sparkles" },
  { id: "blurb", name: "爆款简介", desc: "仅生成作品简介与章节标题", enabled: false, icon: "bookmark" },
];

export default function MyAISettingsPage() {
  const router = useSafeRouter();

  // 加载状态
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 当前Tab
  const [activeTab, setActiveTab] = useState<"preset" | "custom" | "skills">("preset");

  // AI模型设置
  const [aiModel, setAiModel] = useState("doubao-seed-2-0-lite-260215");
  const [temperature, setTemperature] = useState("0.8");
  const [maxTokens, setMaxTokens] = useState("4096");
  const [customModels, setCustomModels] = useState<CustomModel[]>([]);
  const [skills, setSkills] = useState<Skill[]>(defaultSkills);

  // 自定义模型表单
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customModelId, setCustomModelId] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");

  // 自定义技能表单
  const [showCustomSkillForm, setShowCustomSkillForm] = useState(false);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillDesc, setNewSkillDesc] = useState("");
  const [newSkillPrompt, setNewSkillPrompt] = useState("");

  // 从服务端获取AI设置
  const fetchAISettings = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("auth_token");
      if (!token) {
        setLoading(false);
        return;
      }
      const res = await fetch(`${API_BASE}/api/v1/users/ai-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.settings) {
        const data = json.settings;
        if (data.aiModel) setAiModel(data.aiModel);
        if (data.temperature) setTemperature(data.temperature);
        if (data.maxTokens) setMaxTokens(String(data.maxTokens));
        if (data.customModels) setCustomModels(data.customModels);
        if (data.skills) setSkills(data.skills);
      }
    } catch (e) {
      console.error("获取AI设置失败", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAISettings();
  }, [fetchAISettings]);

  // 保存AI设置到服务端
  const saveToServer = useCallback(async (updates: Record<string, unknown>) => {
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("auth_token");
      if (!token) {
        Alert.alert("提示", "请先登录");
        return;
      }
      const currentSettings = {
        aiModel,
        temperature,
        maxTokens: parseInt(maxTokens, 10) || 4096,
        customModels,
        skills,
        ...updates,
      };
      const res = await fetch(`${API_BASE}/api/v1/users/ai-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ settings: currentSettings }),
      });
      const json = await res.json();
      if (json.success) {
        // 更新本地状态
        if (updates.aiModel) setAiModel(updates.aiModel as string);
        if (updates.customModels) setCustomModels(updates.customModels as CustomModel[]);
        if (updates.skills) setSkills(updates.skills as Skill[]);
        if (updates.temperature) setTemperature(updates.temperature as string);
        if (updates.maxTokens) setMaxTokens(String(updates.maxTokens));
      } else {
        Alert.alert("保存失败", json.message || "请稍后重试");
      }
    } catch (e) {
      console.error("保存AI设置失败", e);
      Alert.alert("保存失败", "网络异常，请检查连接后重试");
    } finally {
      setSaving(false);
    }
  }, [aiModel, temperature, maxTokens, customModels, skills]);

  // 添加自定义模型
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
    saveToServer({ customModels: updatedModels, aiModel: newModel.id });
    setCustomName("");
    setCustomModelId("");
    setCustomApiKey("");
    setCustomBaseUrl("");
    setShowCustomForm(false);
  };

  // 删除自定义模型
  const deleteCustomModel = (id: string) => {
    Alert.alert("删除模型", "确定要删除这个自定义模型吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () => {
          const updatedModels = customModels.filter((m) => m.id !== id);
          setCustomModels(updatedModels);
          const newModelId = aiModel === id ? "doubao-seed-2-0-lite-260215" : aiModel;
          setAiModel(newModelId);
          saveToServer({ customModels: updatedModels, aiModel: newModelId });
        },
      },
    ]);
  };

  // 切换技能开关
  const toggleSkill = (id: string) => {
    const updatedSkills = skills.map((s) =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );
    setSkills(updatedSkills);
    saveToServer({ skills: updatedSkills });
  };

  // 添加自定义技能
  const addCustomSkill = () => {
    if (!newSkillName.trim()) {
      Alert.alert("提示", "请输入技能名称");
      return;
    }
    const newSkill: Skill = {
      id: `custom-${Date.now()}`,
      name: newSkillName.trim(),
      desc: newSkillDesc.trim() || "自定义技能",
      enabled: true,
      prompt: newSkillPrompt.trim(),
      isCustom: true,
    };
    const updated = [...skills, newSkill];
    setSkills(updated);
    saveToServer({ skills: updated });
    setShowCustomSkillForm(false);
    setNewSkillName("");
    setNewSkillDesc("");
    setNewSkillPrompt("");
  };

  // 删除自定义技能
  const deleteCustomSkill = (id: string) => {
    Alert.alert("删除技能", "确定要删除这个自定义技能吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () => {
          const updated = skills.filter((s) => s.id !== id);
          setSkills(updated);
          saveToServer({ skills: updated });
        },
      },
    ]);
  };

  // 选择预设模型
  const selectPresetModel = (id: string) => {
    setAiModel(id);
    saveToServer({ aiModel: id });
  };

  const renderPresetTab = () => (
    <View className="gap-2 py-2">
      {/* 温度与最大Token设置 */}
      <View className="bg-gray-50 rounded-xl p-4 mb-3">
        <Text className="text-sm font-semibold text-gray-700 mb-3">模型参数</Text>
        <View className="flex-row items-center mb-3">
          <Text className="text-xs font-medium text-gray-600 w-20">温度</Text>
          <TextInput
            className="flex-1 bg-white rounded-xl px-4 py-2 text-sm text-gray-800 border border-gray-200"
            placeholder="0.0 - 2.0"
            placeholderTextColor="#CBD5E1"
            value={temperature}
            onChangeText={setTemperature}
            keyboardType="decimal-pad"
          />
        </View>
        <View className="flex-row items-center">
          <Text className="text-xs font-medium text-gray-600 w-20">最大Token</Text>
          <TextInput
            className="flex-1 bg-white rounded-xl px-4 py-2 text-sm text-gray-800 border border-gray-200"
            placeholder="如 4096"
            placeholderTextColor="#CBD5E1"
            value={maxTokens}
            onChangeText={setMaxTokens}
            keyboardType="number-pad"
          />
        </View>
      </View>

      <Text className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 ml-1">
        选择模型
      </Text>
      {presetModels.map((model) => (
        <TouchableOpacity
          key={model.id}
          className={`flex-row items-center p-3.5 rounded-xl border ${
            aiModel === model.id
              ? "border-indigo-500 bg-indigo-50"
              : "border-gray-100 bg-white"
          }`}
          onPress={() => selectPresetModel(model.id)}
          activeOpacity={0.7}
        >
          <View
            className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${
              aiModel === model.id ? "bg-indigo-100" : "bg-gray-50"
            }`}
          >
            <FontAwesome6
              name="brain"
              size={16}
              color={aiModel === model.id ? "#4F46E5" : "#9CA3AF"}
            />
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
            <Text className="text-xs text-gray-400 mt-0.5">
              {model.provider} · {model.desc}
            </Text>
          </View>
        </TouchableOpacity>
      ))}

      {/* 公益AI分隔线 */}
      <View className="flex-row items-center my-2">
        <View className="flex-1 h-px bg-gray-200" />
        <View className="flex-row items-center bg-blue-50 rounded-full px-2.5 py-1 mx-2">
          <FontAwesome6 name="hand-holding-heart" size={10} color="#3B82F6" />
          <Text className="text-xs font-medium text-blue-600 ml-1">公益AI</Text>
        </View>
        <View className="flex-1 h-px bg-gray-200" />
      </View>

      {publicWelfareModels.map((model) => (
        <TouchableOpacity
          key={model.id}
          className={`flex-row items-center p-3.5 rounded-xl border ${
            aiModel === model.id
              ? "border-blue-500 bg-blue-50"
              : "border-gray-100 bg-white"
          }`}
          onPress={() => selectPresetModel(model.id)}
          activeOpacity={0.7}
        >
          <View
            className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${
              aiModel === model.id ? "bg-blue-100" : "bg-gray-50"
            }`}
          >
            <FontAwesome6
              name="seedling"
              size={16}
              color={aiModel === model.id ? "#3B82F6" : "#9CA3AF"}
            />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-sm font-semibold text-gray-800">{model.name}</Text>
              <View className="bg-blue-500 rounded-full px-1.5 py-0.5">
                <Text className="text-[10px] text-white font-medium">免费</Text>
              </View>
              {aiModel === model.id && (
                <View className="bg-blue-500 rounded-full px-1.5 py-0.5">
                  <Text className="text-[10px] text-white font-medium">当前</Text>
                </View>
              )}
            </View>
            <Text className="text-xs text-gray-400 mt-0.5">
              {model.provider} · {model.desc}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderCustomTab = () => (
    <View className="py-2">
      {customModels.length === 0 && !showCustomForm && (
        <View className="items-center py-10">
          <View className="w-14 h-14 rounded-2xl items-center justify-center mb-3 bg-gray-50">
            <FontAwesome6 name="microchip" size={24} color="#CBD5E1" />
          </View>
          <Text className="text-sm text-gray-500 mb-1">暂无自定义模型</Text>
          <Text className="text-xs text-gray-400 mb-4">你可以添加自己的AI模型和API Key</Text>
          <TouchableOpacity
            className="bg-indigo-500 px-5 py-2.5 rounded-full flex-row items-center gap-2"
            onPress={() => setShowCustomForm(true)}
          >
            <FontAwesome6 name="plus" size={12} color="#fff" />
            <Text className="text-sm font-medium text-white">添加模型</Text>
          </TouchableOpacity>
        </View>
      )}

      {customModels.map((model) => (
        <View
          key={model.id}
          className={`flex-row items-center p-3.5 rounded-xl mb-2 border ${
            aiModel === model.id
              ? "border-indigo-500 bg-indigo-50"
              : "border-gray-100 bg-white"
          }`}
        >
          <View className="w-10 h-10 rounded-xl items-center justify-center mr-3 bg-amber-50">
            <FontAwesome6 name="microchip" size={16} color="#F59E0B" />
          </View>
          <TouchableOpacity
            className="flex-1"
            onPress={() => {
              setAiModel(model.id);
              saveToServer({ aiModel: model.id });
            }}
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

      {!showCustomForm && customModels.length > 0 && (
        <TouchableOpacity
          className="flex-row items-center justify-center py-3.5 rounded-xl border border-dashed border-gray-300 mt-2"
          onPress={() => setShowCustomForm(true)}
        >
          <FontAwesome6 name="plus" size={12} color="#6B7280" />
          <Text className="text-sm font-medium text-gray-500 ml-2">添加自定义模型</Text>
        </TouchableOpacity>
      )}

      {showCustomForm && (
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
              onPress={() => {
                setShowCustomForm(false);
                setCustomName("");
                setCustomModelId("");
                setCustomApiKey("");
                setCustomBaseUrl("");
              }}
            >
              <Text className="text-sm font-medium text-gray-600">取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 py-2.5 rounded-xl bg-indigo-500 items-center"
              onPress={addCustomModel}
            >
              <Text className="text-sm font-medium text-white">确认添加</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const renderSkillsTab = () => (
    <View className="py-2">
      {/* 系统技能列表 */}
      <Text className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 ml-1">
        系统技能
      </Text>
      {skills
        .filter((s) => !s.isCustom)
        .map((skill) => (
          <View
            key={skill.id}
            className="flex-row items-center bg-white rounded-xl p-3.5 mb-2 border border-gray-100"
          >
            <View className="w-10 h-10 rounded-xl items-center justify-center mr-3 bg-indigo-50">
              <FontAwesome6
                name={(skill.icon || "bolt") as any}
                size={16}
                color="#4F46E5"
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-gray-800">{skill.name}</Text>
              <Text className="text-xs text-gray-400 mt-0.5">{skill.desc}</Text>
            </View>
            <View className="ml-2">
              <TouchableOpacity
                onPress={() => toggleSkill(skill.id)}
                className={`px-3 py-1.5 rounded-full ${
                  skill.enabled ? "bg-indigo-500" : "bg-gray-200"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    skill.enabled ? "text-white" : "text-gray-500"
                  }`}
                >
                  {skill.enabled ? "已开启" : "已关闭"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

      {/* 自定义技能列表 */}
      {skills.filter((s) => s.isCustom).length > 0 && (
        <>
          <Text className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 mt-4 ml-1">
            自定义技能
          </Text>
          {skills
            .filter((s) => s.isCustom)
            .map((skill) => (
              <View
                key={skill.id}
                className="flex-row items-center bg-white rounded-xl p-3.5 mb-2 border border-amber-100"
              >
                <View className="w-10 h-10 rounded-xl items-center justify-center mr-3 bg-amber-50">
                  <FontAwesome6 name="wand-magic-sparkles" size={16} color="#F59E0B" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-800">{skill.name}</Text>
                  <Text className="text-xs text-gray-400 mt-0.5">{skill.desc}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => deleteCustomSkill(skill.id)}
                  className="ml-2 p-2"
                >
                  <FontAwesome6 name="trash-can" size={14} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
        </>
      )}

      {!showCustomSkillForm ? (
        <TouchableOpacity
          className="flex-row items-center justify-center py-3.5 rounded-xl border border-dashed border-gray-300 mt-2"
          onPress={() => setShowCustomSkillForm(true)}
        >
          <FontAwesome6 name="plus" size={12} color="#6B7280" />
          <Text className="text-sm font-medium text-gray-500 ml-2">添加自定义技能</Text>
        </TouchableOpacity>
      ) : (
        <View className="bg-gray-50 rounded-xl p-4 mt-2">
          <Text className="text-sm font-semibold text-gray-700 mb-3">添加自定义技能</Text>

          <Text className="text-xs font-medium text-gray-600 mb-1">技能名称</Text>
          <TextInput
            className="bg-white rounded-xl px-4 py-2.5 text-sm text-gray-800 mb-3 border border-gray-200"
            placeholder="如：润色助手"
            placeholderTextColor="#CBD5E1"
            value={newSkillName}
            onChangeText={setNewSkillName}
          />

          <Text className="text-xs font-medium text-gray-600 mb-1">描述（可选）</Text>
          <TextInput
            className="bg-white rounded-xl px-4 py-2.5 text-sm text-gray-800 mb-3 border border-gray-200"
            placeholder="技能的简要描述"
            placeholderTextColor="#CBD5E1"
            value={newSkillDesc}
            onChangeText={setNewSkillDesc}
          />

          <Text className="text-xs font-medium text-gray-600 mb-1">系统提示词（可选）</Text>
          <TextInput
            className="bg-white rounded-xl px-4 py-2.5 text-sm text-gray-800 mb-3 border border-gray-200"
            placeholder="为技能设定系统提示词..."
            placeholderTextColor="#CBD5E1"
            value={newSkillPrompt}
            onChangeText={setNewSkillPrompt}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <View className="flex-row gap-3 mt-1">
            <TouchableOpacity
              className="flex-1 py-2.5 rounded-xl bg-gray-200 items-center"
              onPress={() => {
                setShowCustomSkillForm(false);
                setNewSkillName("");
                setNewSkillDesc("");
                setNewSkillPrompt("");
              }}
            >
              <Text className="text-sm font-medium text-gray-600">取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 py-2.5 rounded-xl bg-indigo-500 items-center"
              onPress={addCustomSkill}
            >
              <Text className="text-sm font-medium text-white">确认添加</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <Screen>
      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-3">
        <TouchableOpacity
          className="w-9 h-9 rounded-xl items-center justify-center"
          style={{ backgroundColor: "#F3F4F6" }}
          onPress={() => router.back()}
        >
          <FontAwesome6 name="arrow-left" size={16} color="#374151" />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold text-gray-800 text-center mr-9">
          AI模型设置
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text className="text-sm text-gray-400 mt-3">加载中...</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Tabs */}
          <View className="flex-row px-4 pb-2 gap-1">
            {[
              { key: "preset" as const, label: "预设模型", icon: "list" },
              { key: "custom" as const, label: "自定义", icon: "microchip" },
              { key: "skills" as const, label: "技能", icon: "bolt" },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                className={`flex-row items-center gap-1.5 px-3.5 py-2 rounded-full ${
                  activeTab === tab.key ? "bg-indigo-50" : "bg-gray-50"
                }`}
                onPress={() => setActiveTab(tab.key)}
              >
                <FontAwesome6
                  name={tab.icon as any}
                  size={11}
                  color={activeTab === tab.key ? "#4F46E5" : "#9CA3AF"}
                />
                <Text
                  className={`text-xs font-medium ${
                    activeTab === tab.key ? "text-indigo-600" : "text-gray-500"
                  }`}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>
            {activeTab === "preset" && renderPresetTab()}
            {activeTab === "custom" && renderCustomTab()}
            {activeTab === "skills" && renderSkillsTab()}
          </ScrollView>

          {/* 保存按钮 */}
          {saving && (
            <View className="absolute top-0 left-0 right-0 bottom-0 items-center justify-center bg-white/60">
              <ActivityIndicator size="large" color="#4F46E5" />
              <Text className="text-sm text-gray-500 mt-2">保存中...</Text>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}