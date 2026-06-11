import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { Screen } from "@/components/Screen";
import { useSafeRouter, useSafeSearchParams } from "@/hooks/useSafeRouter";
import { FontAwesome6 } from "@expo/vector-icons";
import { DataManager } from "@/services/data-manager";

interface ContentItem {
  id: string;
  type?: string;
  title?: string;
  content?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function ContentEditorScreen() {
  const router = useSafeRouter();
  const { bookId, type } = useSafeSearchParams<{
    bookId: string;
    type: string;
  }>();

  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<{
    visible: boolean;
    item?: ContentItem | null;
    title: string;
    content: string;
  }>({ visible: false, title: "", content: "" });

  const fetchItems = useCallback(async () => {
    if (!bookId) return;
    setLoading(true);
    try {
      if (type === "大纲" || type === "细纲") {
        const result = await DataManager.getOutlines(bookId as string);
        if (result.success) {
          setItems(
            (result.data || []).filter(
              (item: ContentItem) => (item.type || "大纲") === type
            )
          );
        }
      } else if (type === "设定") {
        const result = await DataManager.getSettingsArray(bookId as string);
        if (result.success) setItems(result.data || []);
      } else if (type === "灵感") {
        const result = await DataManager.getInspirationsArray(bookId as string);
        if (result.success) setItems(result.data || []);
      }
    } catch (err) {
      console.error("加载失败", err);
    } finally {
      setLoading(false);
    }
  }, [bookId, type]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleCreate = async (createType: string) => {
    setShowCreateModal(false);
    if (!bookId || !createType) return;

    if (createType === "大纲" || createType === "细纲") {
      const newItem: ContentItem = {
        id: Date.now().toString(),
        type: createType,
        title: createType,
        content: "",
        createdAt: new Date().toISOString(),
      };
      const existing = await DataManager.getOutlines(bookId as string);
      const updated = existing.success ? [...(existing.data || []), newItem] : [newItem];
      const result = await DataManager.saveOutlines(bookId as string, updated);
      if (result.success) {
        router.push("/outline-create", {
          bookId,
          outlineId: newItem.id,
          type: createType,
        });
        return;
      }
    }
    // Default: open outline-create
    router.push("/outline-create", { bookId, type: createType });
  };

  const handleEdit = (item: ContentItem) => {
    if (type === "大纲" || type === "细纲") {
      router.push("/outline-create", {
        bookId,
        outlineId: item.id,
        type: item.type || type,
      });
    } else if (type === "设定") {
      setEditModal({
        visible: true,
        item,
        title: item.title || "",
        content: item.content || "",
      });
    } else if (type === "灵感") {
      setEditModal({
        visible: true,
        item,
        title: item.title || "",
        content: item.content || "",
      });
    }
  };

  const handleSaveEdit = async () => {
    const { item, title, content } = editModal;
    if (!bookId || !item) return;

    try {
      if (type === "设定") {
        const updatedItems = items.map((i) =>
          i.id === item.id ? { ...i, title, content } : i
        );
        const result = await DataManager.saveSettingsArray(bookId as string, updatedItems);
        if (result.success) {
          setItems(updatedItems);
          setEditModal({ visible: false, title: "", content: "", item: null });
        }
      } else if (type === "灵感") {
        const updatedItems = items.map((i) =>
          i.id === item.id ? { ...i, title, content } : i
        );
        const result = await DataManager.saveInspirationsArray(bookId as string, updatedItems);
        if (result.success) {
          setItems(updatedItems);
          setEditModal({ visible: false, title: "", content: "", item: null });
        }
      }
    } catch (err) {
      console.error("保存失败", err);
    }
  };

  const handleDelete = (item: ContentItem) => {
    Alert.alert("确认删除", "确定要删除这个项目吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            if (type === "灵感") {
              const updatedItems = items.filter((i) => i.id !== item.id);
              await DataManager.saveInspirationsArray(bookId as string, updatedItems);
            } else if (type === "大纲" || type === "细纲") {
              const updatedItems = items.filter((i) => i.id !== item.id);
              await DataManager.saveOutlines(bookId as string, updatedItems);
            } else if (type === "设定") {
              const updatedItems = items.filter((i) => i.id !== item.id);
              await DataManager.saveSettingsArray(bookId as string, updatedItems);
            }
            fetchItems();
          } catch (err) {
            console.error("删除失败", err);
          }
        },
      },
    ]);
  };

  const getCreateOptions = () => {
    if (type === "大纲") {
      return [
        { key: "大纲", label: "新建大纲", icon: "file-lines", color: "#4F46E5" },
        { key: "细纲", label: "新建细纲", icon: "pencil", color: "#6B7280" },
        { key: "ai", label: "AI 创建", icon: "wand-magic-sparkles", color: "#8B5CF6" },
      ];
    }
    return [
      { key: type, label: `新建${type}`, icon: "plus", color: "#4F46E5" },
    ];
  };

  return (
    <Screen>
      {/* Top bar */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <FontAwesome6 name="arrow-left" size={20} color="#374151" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-800 dark:text-white">
          {type || "内容"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content list */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400">加载中...</Text>
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <FontAwesome6
            name="file-pen"
            size={48}
            color="#D1D5DB"
            style={{ marginBottom: 16 }}
          />
          <Text className="text-gray-400 text-center text-base mb-2">
            暂无{type}
          </Text>
          <Text className="text-gray-300 text-center text-sm">
            点击右下角 + 按钮开始创建
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-4 pt-4">
          {items.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => handleEdit(item)}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-3 shadow-sm border border-gray-50 dark:border-gray-700"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 3,
              }}
            >
              <Text className="text-base font-semibold text-gray-800 dark:text-white mb-1">
                {item.title || item.type || type}
              </Text>
              {item.content ? (
                <Text className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2" numberOfLines={2}>
                  {item.content}
                </Text>
              ) : (
                <Text className="text-sm text-gray-300 italic">暂无内容，点击编辑</Text>
              )}
              <View className="flex-row justify-end mt-2">
                <TouchableOpacity
                  onPress={() => handleDelete(item)}
                  className="p-2"
                >
                  <FontAwesome6 name="trash-can" size={14} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Floating + button */}
      <TouchableOpacity
        onPress={() => setShowCreateModal(true)}
        className="absolute bottom-8 right-6 w-14 h-14 rounded-full items-center justify-center"
        style={{
          backgroundColor: "#4F46E5",
          shadowColor: "#4F46E5",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <FontAwesome6 name="plus" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Create options modal */}
      <Modal visible={showCreateModal} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setShowCreateModal(false)}>
          <View className="flex-1 bg-black/30 justify-center items-center">
            <TouchableWithoutFeedback>
              <View className="bg-white dark:bg-gray-800 rounded-3xl p-6 mx-8 w-72">
                <Text className="text-lg font-bold text-gray-800 dark:text-white mb-4 text-center">
                  新建内容
                </Text>
                {getCreateOptions().map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => handleCreate(opt.key)}
                    className="flex-row items-center px-4 py-4 rounded-xl mb-2"
                    style={{ backgroundColor: `${opt.color}10` }}
                  >
                    <FontAwesome6
                      name={opt.icon as any}
                      size={18}
                      color={opt.color}
                      style={{ width: 28 }}
                    />
                    <Text
                      className="text-base font-medium ml-2"
                      style={{ color: opt.color }}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  onPress={() => setShowCreateModal(false)}
                  className="mt-2 py-3 items-center"
                >
                  <Text className="text-gray-400 text-sm">取消</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Edit modal for settings/inspirations */}
      <Modal
        visible={editModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setEditModal({ ...editModal, visible: false })
        }
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView
            className="flex-1 justify-end"
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <TouchableWithoutFeedback>
              <View className="bg-white dark:bg-gray-800 rounded-t-3xl p-5 min-h-[50%]">
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-lg font-bold text-gray-800 dark:text-white">
                    编辑
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      setEditModal({ ...editModal, visible: false })
                    }
                  >
                    <FontAwesome6 name="xmark" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
                <TextInput
                  className="bg-gray-50 dark:bg-gray-700 rounded-xl px-4 py-3 text-base text-gray-800 dark:text-white mb-3"
                  placeholder="标题"
                  placeholderTextColor="#9CA3AF"
                  value={editModal.title}
                  onChangeText={(t) =>
                    setEditModal({ ...editModal, title: t })
                  }
                />
                <TextInput
                  className="bg-gray-50 dark:bg-gray-700 rounded-xl px-4 py-3 text-base text-gray-800 dark:text-white mb-4 flex-1"
                  placeholder="内容"
                  placeholderTextColor="#9CA3AF"
                  value={editModal.content}
                  onChangeText={(c) =>
                    setEditModal({ ...editModal, content: c })
                  }
                  multiline
                  textAlignVertical="top"
                  style={{ minHeight: 120 }}
                />
                <TouchableOpacity
                  onPress={handleSaveEdit}
                  className="bg-indigo-600 rounded-xl py-3.5 items-center"
                >
                  <Text className="text-white font-semibold text-base">
                    保存
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
    </Screen>
  );
}