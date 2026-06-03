import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from "react-native";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";
import { useSafeRouter, useSafeSearchParams } from "@/hooks/useSafeRouter";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

let _kbIdCounter = 0;
function nextKbId() { return "kb_" + (++_kbIdCounter); }

const KB_CONFIG: Record<string, { name: string; icon: string; color: string; bgColor: string; desc: string }> = {
  world: { name: "世界观库", icon: "globe", color: "#6366F1", bgColor: "#EEF2FF", desc: "构建完整的虚拟世界" },
  character: { name: "人物库", icon: "users", color: "#F59E0B", bgColor: "#FFFBEB", desc: "管理角色设定与档案" },
  outline: { name: "大纲库", icon: "layers", color: "#10B981", bgColor: "#ECFDF5", desc: "存储故事大纲与结构" },
  material: { name: "素材库", icon: "archive", color: "#EC4899", bgColor: "#FDF2F8", desc: "收集创作灵感素材" },
};

const SUGGESTIONS: Record<string, string[]> = {
  world: ["魔法体系的底层规则", "大陆地理划分与势力", "历史编年表关键事件", "种族设定与文明特征", "科技/修炼等级体系"],
  character: ["主角性格与背景设定", "配角关系与成长弧光", "反派动机与能力设计", "角色外貌与标志特征", "角色说话风格与习惯"],
  outline: ["三幕式故事结构", "章节节奏与高潮布局", "伏笔设计与回收计划", "多线叙事交叉点规划", "开篇吸引力设计"],
  material: ["民俗传说与神话原型", "历史事件改编灵感", "专业领域知识笔记", "风景场景描写素材", "精彩对话片段收集"],
};

export default function AIKnowledgeScreen() {
  const router = useSafeRouter();
  const { type } = useSafeSearchParams<{ type: string }>();
  const kbType = (type || "world") as string;
  const config = KB_CONFIG[kbType] || KB_CONFIG.world;
  const suggestions = SUGGESTIONS[kbType] || SUGGESTIONS.world;

  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);
  const [inputTitle, setInputTitle] = useState("");
  const [inputContent, setInputContent] = useState("");

  const STORAGE_KEY = `ai_knowledge_${kbType}`;

  // 加载持久化数据
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((data) => {
      if (data) {
        try { setItems(JSON.parse(data)); } catch {}
      }
    });
  }, [STORAGE_KEY]);

  // 保存数据
  const saveItems = useCallback((newItems: KnowledgeItem[]) => {
    setItems(newItems);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
  }, [STORAGE_KEY]);

  const openAdd = () => {
    setEditingItem(null);
    setInputTitle("");
    setInputContent("");
    setShowAddModal(true);
  };

  const openEdit = (item: KnowledgeItem) => {
    setEditingItem(item);
    setInputTitle(item.title);
    setInputContent(item.content);
    setShowAddModal(true);
  };

  const handleSave = () => {
    if (!inputTitle.trim()) {
      Alert.alert("提示", "请输入标题");
      return;
    }
    if (editingItem) {
      saveItems(
        items.map((item) =>
          item.id === editingItem.id
            ? { ...item, title: inputTitle.trim(), content: inputContent.trim() }
            : item
        )
      );
    } else {
      const newItem: KnowledgeItem = {
        id: nextKbId(),
        title: inputTitle.trim(),
        content: inputContent.trim(),
        createdAt: new Date().toLocaleDateString("zh-CN"),
      };
      saveItems([newItem, ...items]);
    }
    setShowAddModal(false);
  };

  const handleDelete = (id: string) => {
    saveItems(items.filter((item) => item.id !== id));
  };

  const handleSuggestionAdd = (suggestion: string) => {
    const newItem: KnowledgeItem = {
      id: nextKbId(),
      title: suggestion,
      content: "",
      createdAt: new Date().toLocaleDateString("zh-CN"),
    };
    saveItems([newItem, ...items]);
  };

  return (
    <Screen>
      <ScrollView className="flex-1 bg-gray-50" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="rounded-b-[32px] pt-12 pb-6 px-5" style={{ backgroundColor: config.color }}>
          <View className="flex-row items-center gap-2 mb-3">
            <TouchableOpacity
              className="w-9 h-9 rounded-xl bg-white/20 items-center justify-center"
              onPress={() => router.back()}
            >
              <FontAwesome6 name="arrow-left" size={16} color="white" />
            </TouchableOpacity>
            <View className="w-9 h-9 rounded-xl bg-white/20 items-center justify-center">
              <FontAwesome6 name={config.icon as any} size={18} color="white" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-white">{config.name}</Text>
              <Text className="text-xs text-white/80">{config.desc}</Text>
            </View>
          </View>
          <View className="flex-row justify-between items-center mt-1">
            <Text className="text-sm text-white/70">{items.length} 个条目</Text>
            <TouchableOpacity
              className="bg-white/20 rounded-xl px-4 py-2 flex-row items-center gap-1.5"
              onPress={openAdd}
            >
              <FontAwesome6 name="plus" size={12} color="white" />
              <Text className="text-sm font-medium text-white">新增</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="px-4 pt-5 pb-8">
          {/* Quick Add Suggestions */}
          {items.length === 0 && (
            <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
              <View className="flex-row items-center gap-2 mb-3">
                <View className="w-7 h-7 rounded-lg items-center justify-center" style={{ backgroundColor: config.color + "20" }}>
                  <FontAwesome6 name="lightbulb" size={12} color={config.color} />
                </View>
                <Text className="text-sm font-semibold text-gray-900">快速开始</Text>
              </View>
              <Text className="text-xs text-gray-500 mb-3">选择一个模板快速创建条目：</Text>
              <View className="flex-row flex-wrap gap-2">
                {suggestions.map((s, i) => (
                  <TouchableOpacity
                    key={i}
                    className="px-3.5 py-2 rounded-xl border border-gray-200 bg-gray-50"
                    onPress={() => handleSuggestionAdd(s)}
                  >
                    <Text className="text-xs text-gray-600">+ {s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Items List */}
          {items.map((item) => (
            <TouchableOpacity
              key={item.id}
              className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-gray-100"
              onPress={() => openEdit(item)}
              activeOpacity={0.7}
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1 mr-3">
                  <Text className="font-semibold text-gray-900 text-base mb-1">{item.title}</Text>
                  {item.content ? (
                    <Text className="text-sm text-gray-500 leading-5" numberOfLines={3}>{item.content}</Text>
                  ) : (
                    <Text className="text-xs text-gray-400 italic">暂无内容</Text>
                  )}
                </View>
                <TouchableOpacity
                  className="w-8 h-8 rounded-full bg-red-50 items-center justify-center"
                  onPress={(e) => {
                    e.stopPropagation?.();
                    handleDelete(item.id);
                  }}
                >
                  <FontAwesome6 name="trash-can" size={13} color="#EF4444" />
                </TouchableOpacity>
              </View>
              <View className="flex-row items-center mt-3 pt-3 border-t border-gray-50">
                <FontAwesome6 name="clock" size={10} color="#94A3B8" />
                <Text className="text-xs text-gray-400 ml-1.5">{item.createdAt}</Text>
              </View>
            </TouchableOpacity>
          ))}

          {/* Empty state */}
          {items.length === 0 && (
            <View className="items-center py-12">
              <View className="w-16 h-16 rounded-2xl items-center justify-center mb-3" style={{ backgroundColor: config.bgColor }}>
                <FontAwesome6 name={config.icon as any} size={28} color={config.color} />
              </View>
              <Text className="text-base font-medium text-gray-400">{config.name}为空</Text>
              <Text className="text-sm text-gray-300 mt-1">点击「新增」或上方模板开始添加</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl pb-8 max-h-[80%]">
            <View className="items-center pt-4 pb-2">
              <View className="w-10 h-1 bg-gray-300 rounded-full" />
            </View>
            <ScrollView className="px-5" showsVerticalScrollIndicator={false}>
              <Text className="text-lg font-bold text-gray-900 mb-1">
                {editingItem ? "编辑条目" : "新增条目"}
              </Text>
              <Text className="text-xs text-gray-500 mb-5">{config.name}</Text>

              <Text className="text-sm font-medium text-gray-700 mb-1.5">标题</Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm mb-4"
                value={inputTitle}
                onChangeText={setInputTitle}
                placeholder="输入标题"
                placeholderTextColor="#94A3B8"
              />

              <Text className="text-sm font-medium text-gray-700 mb-1.5">内容</Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm min-h-[160px] mb-5"
                value={inputContent}
                onChangeText={setInputContent}
                multiline
                textAlignVertical="top"
                placeholder="输入详细内容..."
                placeholderTextColor="#94A3B8"
              />

              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 bg-gray-100 rounded-xl py-3.5 items-center"
                  onPress={() => setShowAddModal(false)}
                >
                  <Text className="text-gray-600 font-medium">取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 rounded-xl py-3.5 items-center"
                  style={{ backgroundColor: config.color }}
                  onPress={handleSave}
                >
                  <Text className="text-white font-medium">保存</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}