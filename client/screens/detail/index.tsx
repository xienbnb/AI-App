import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  RefreshControl,
} from "react-native";
import { useSafeRouter, useSafeSearchParams } from "@/hooks/useSafeRouter";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

function formatWordCount(count: number) {
  if (count >= 10000) return (count / 10000).toFixed(1) + "万";
  if (count >= 1000) return (count / 1000).toFixed(1) + "k";
  return count.toString();
}

function getCategoryIcon(category: string) {
  const icons: Record<string, string> = { 玄幻: "S", 仙侠: "M", 都市: "C", 科幻: "F", 历史: "H" };
  return icons[category] || "B";
}

function getCoverColors(cover: string): [string, string] {
  const colors: Record<string, [string, string]> = {
    "from-purple-500 to-blue-500": ["#8B5CF6", "#6366F1"],
    "from-green-500 to-teal-500": ["#22C55E", "#14B8A6"],
    "from-rose-500 to-pink-500": ["#F43F5E", "#EC4899"],
    "from-amber-500 to-orange-500": ["#F59E0B", "#F97316"],
    "from-cyan-500 to-sky-500": ["#06B6D4", "#0EA5E9"],
    "from-red-500 to-rose-500": ["#EF4444", "#F43F5E"],
    "from-indigo-500 to-purple-500": ["#6366F1", "#8B5CF6"],
    "from-emerald-500 to-green-500": ["#10B981", "#22C55E"],
    "from-fuchsia-500 to-pink-500": ["#D946EF", "#EC4899"],
    "from-violet-500 to-indigo-500": ["#8B5CF6", "#6366F1"],
    "from-slate-700 to-slate-900": ["#334155", "#0F172A"],
    "from-sky-400 to-blue-600": ["#38BDF8", "#2563EB"],
  };
  return colors[cover] || ["#8B5CF6", "#6366F1"];
}

interface Chapter {
  id: string;
  title: string;
  wordCount: number;
  createdAt: string;
  content: string;
}

interface Book {
  id: string;
  title: string;
  category: string;
  status: string;
  cover: string;
  description: string;
  createdAt: string;
  wordCount: number;
  chapters: Chapter[];
}

export default function DetailScreen() {
  const router = useSafeRouter();
  const { id } = useSafeSearchParams<{ id: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [chapterTitle, setChapterTitle] = useState("");

  const fetchBook = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/${id}`);
      const json = await res.json();
      if (json.success) setBook(json.data);
    } catch (e) {
      console.error("获取书籍详情失败", e);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchBook();
    }, [fetchBook])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBook();
    setRefreshing(false);
  }, [fetchBook]);

  const handleCreateChapter = async () => {
    if (!chapterTitle.trim()) {
      Alert.alert("提示", "请输入章节标题");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/${id}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: chapterTitle.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setModalVisible(false);
        setChapterTitle("");
        await fetchBook();
        router.push("/editor", { bookId: id, chapterId: json.data.id });
      }
    } catch (e) {
      Alert.alert("错误", "创建章节失败");
    }
  };

  const handleDeleteChapter = (chapterId: string, chapterTitle: string) => {
    Alert.alert("确认删除", `确定要删除"${chapterTitle}"吗？`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            const res = await fetch(`${API_BASE}/api/v1/writing/${id}/chapters/${chapterId}`, {
              method: "DELETE",
            });
            const json = await res.json();
            if (json.success) {
              await fetchBook();
            }
          } catch (e) {
            Alert.alert("错误", "删除章节失败");
          }
        },
      },
    ]);
  };

  if (!book) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">加载中...</Text>
        </View>
      </Screen>
    );
  }

  const [c1] = getCoverColors(book.cover);

  return (
    <Screen>
      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
      >
        {/* 书籍信息 */}
        <View className="flex-row gap-4 mt-2 mb-4">
          <View
            className="w-24 h-32 rounded-xl items-center justify-center"
            style={{ backgroundColor: c1 }}
          >
            <Text className="text-4xl">{getCategoryIcon(book.category)}</Text>
          </View>
          <View className="flex-1 justify-center">
            <Text className="text-lg font-bold text-gray-800 mb-1">{book.title}</Text>
            <Text className="text-sm text-gray-500 mb-2">
              {book.category} · {book.status === "writing" ? "正在写" : book.status === "completed" ? "已完结" : "已暂停"}
            </Text>
            <View className="flex-row gap-2">
              <Text className="px-2 py-0.5 bg-primary-500/10 text-primary-500 text-xs rounded-full">
                {formatWordCount(book.wordCount)}字
              </Text>
              <Text className="px-2 py-0.5 bg-green-500/10 text-green-600 text-xs rounded-full">
                {book.chapters.length}章
              </Text>
            </View>
          </View>
        </View>

        {/* 简介 */}
        <View className="bg-white rounded-2xl p-4 mb-4" style={{
          shadowColor: "#6366F1",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 1,
        }}>
          <Text className="text-sm font-semibold text-gray-800 mb-2">N 作品简介</Text>
          <Text className="text-sm text-gray-600 leading-relaxed">{book.description}</Text>
        </View>

        {/* 操作按钮 */}
        <View className="flex-row gap-3 mb-4">
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            className="flex-1 aspect-square rounded-2xl items-center justify-center"
            style={{ backgroundColor: "#6366F1" }}
          >
            <Text className="text-xl mb-1 text-white">+</Text>
            <Text className="text-xs font-medium text-white">新建章节</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-1 aspect-square bg-white rounded-2xl items-center justify-center" style={{
            shadowColor: "#6366F1",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 1,
          }}>
            <Text className="text-xl mb-1">L</Text>
            <Text className="text-xs font-medium text-gray-700">大纲</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-1 aspect-square bg-white rounded-2xl items-center justify-center" style={{
            shadowColor: "#6366F1",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 1,
          }}>
            <Text className="text-xl mb-1">D</Text>
            <Text className="text-xs font-medium text-gray-700">数据</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-1 aspect-square bg-white rounded-2xl items-center justify-center" style={{
            shadowColor: "#6366F1",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 1,
          }}>
            <Text className="text-xl mb-1">Setting</Text>
            <Text className="text-xs font-medium text-gray-700">设置</Text>
          </TouchableOpacity>
        </View>

        {/* 章节列表 */}
        <View className="mb-8">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-semibold text-gray-800">B 章节列表</Text>
            <TouchableOpacity onPress={() => setModalVisible(true)}>
              <Text className="text-sm text-primary-500 font-medium">+ 新建</Text>
            </TouchableOpacity>
          </View>
          {book.chapters.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center" style={{
              shadowColor: "#6366F1",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
              elevation: 1,
            }}>
              <Text className="text-4xl mb-2">N</Text>
              <Text className="text-sm text-gray-400">还没有章节</Text>
            </View>
          ) : (
            <View className="space-y-2 gap-2">
              {book.chapters.map((chapter, i) => (
                <View
                  key={chapter.id}
                  className="bg-white rounded-2xl p-4 flex-row items-center"
                  style={{
                    shadowColor: "#6366F1",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.04,
                    shadowRadius: 8,
                    elevation: 1,
                  }}
                >
                  <TouchableOpacity
                    className="flex-1"
                    onPress={() => router.push("/editor", { bookId: id, chapterId: chapter.id })}
                  >
                    <Text className="text-sm font-medium text-gray-800">
                      第{i + 1}章 {chapter.title}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-1">
                      {chapter.createdAt} · {formatWordCount(chapter.wordCount)}字
                    </Text>
                  </TouchableOpacity>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => router.push("/editor", { bookId: id, chapterId: chapter.id })}
                      className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                    >
                      <Text className="text-primary-500">E</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteChapter(chapter.id, chapter.title)}
                      className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                    >
                      <Text className="text-red-500">DL</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* 新建章节 Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === "web"}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View className="flex-1 justify-end bg-black/50">
              <View className="bg-white rounded-t-3xl p-6">
                <View className="flex-row items-center justify-between mb-6">
                  <Text className="text-xl font-bold text-gray-800">N 新建章节</Text>
                  <TouchableOpacity
                    onPress={() => setModalVisible(false)}
                    className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                  >
                    <Text>x</Text>
                  </TouchableOpacity>
                </View>
                <Text className="text-sm text-gray-500 mb-4">{book.title}</Text>
                <Text className="text-sm font-medium text-gray-700 mb-2">章节标题</Text>
                <TextInput
                  value={chapterTitle}
                  onChangeText={setChapterTitle}
                  placeholder="如：第一章 初入异世"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 mb-6 text-gray-800"
                />
                <TouchableOpacity
                  onPress={handleCreateChapter}
                  className="w-full py-4 rounded-xl mb-4"
                  style={{ backgroundColor: "#6366F1" }}
                >
                  <Text className="text-white text-center font-bold">E 开始写作</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
    </Screen>
  );
}