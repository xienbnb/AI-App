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
  Image,
} from "react-native";
import { useSafeRouter, useSafeSearchParams } from "@/hooks/useSafeRouter";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

const COVER_TEMPLATES = [
  { id: "from-purple-500 to-blue-500", colors: ["#8B5CF6", "#6366F1"] },
  { id: "from-green-500 to-teal-500", colors: ["#22C55E", "#14B8A6"] },
  { id: "from-rose-500 to-pink-500", colors: ["#F43F5E", "#EC4899"] },
  { id: "from-amber-500 to-orange-500", colors: ["#F59E0B", "#F97316"] },
  { id: "from-cyan-500 to-sky-500", colors: ["#06B6D4", "#0EA5E9"] },
  { id: "from-red-500 to-rose-500", colors: ["#EF4444", "#F43F5E"] },
  { id: "from-indigo-500 to-purple-500", colors: ["#6366F1", "#8B5CF6"] },
  { id: "from-emerald-500 to-green-500", colors: ["#10B981", "#22C55E"] },
  { id: "from-fuchsia-500 to-pink-500", colors: ["#D946EF", "#EC4899"] },
  { id: "from-violet-500 to-indigo-500", colors: ["#8B5CF6", "#6366F1"] },
  { id: "from-slate-700 to-slate-900", colors: ["#334155", "#0F172A"] },
  { id: "from-sky-400 to-blue-600", colors: ["#38BDF8", "#2563EB"] },
];

function formatWordCount(count: number) {
  if (count >= 10000) return (count / 10000).toFixed(1) + "万";
  if (count >= 1000) return (count / 1000).toFixed(1) + "k";
  return count.toString();
}

const getCoverColors = (cover: string): [string, string] => {
  const found = COVER_TEMPLATES.find((t) => t.id === cover);
  return found ? (found.colors as [string, string]) : ["#8B5CF6", "#6366F1"];
};

const CATEGORY_ICONS: Record<string, string> = {
  玄幻: "dragon", 仙侠: "mountain", 都市: "city", 科幻: "rocket", 历史: "scroll",
};

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
  coverImage?: string;
  description: string;
  createdAt: string;
  wordCount: number;
  chapters: Chapter[];
}

function getStatusConfig(status: string) {
  const configs: Record<string, { label: string; bg: string; text: string }> = {
    writing: { label: "正在写", bg: "bg-primary-500/10", text: "text-primary-500" },
    completed: { label: "已完结", bg: "bg-green-500/10", text: "text-green-600" },
    paused: { label: "已暂停", bg: "bg-gray-100", text: "text-gray-500" },
  };
  return configs[status] || configs.paused;
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
    Alert.alert("删除确认", `确定删除"${chapterTitle}"？删除后不可恢复。`, [
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
            if (json.success) await fetchBook();
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

  const [c1, c2] = getCoverColors(book.cover);
  const catIcon = CATEGORY_ICONS[book.category] || "book";
  const statusConfig = getStatusConfig(book.status);

  return (
    <Screen>
      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
      >
        {/* 书籍封面头部 */}
        <View className="mt-2 mb-6">
          {book.coverImage ? (
            <View className="rounded-3xl overflow-hidden h-56 relative">
              <Image
                source={{ uri: `${API_BASE}${book.coverImage}` }}
                className="w-full h-full"
                resizeMode="cover"
              />
              <View className="absolute inset-0 bg-black/30" />
              <View className="absolute bottom-0 left-0 right-0 p-6">
                <Text className="text-white/70 text-sm font-medium tracking-wider uppercase">
                  {book.category}
                </Text>
                <Text className="text-white text-2xl font-bold mt-1" numberOfLines={2}>
                  {book.title}
                </Text>
                <Text className="text-white/60 text-xs mt-1">{book.createdAt}</Text>
              </View>
            </View>
          ) : (
            <View
              className="rounded-3xl px-6 py-8"
              style={{ backgroundColor: c1 }}
            >
              <View className="items-center">
                <FontAwesome6 name={catIcon} size={44} color="rgba(255,255,255,0.9)" />
                <Text className="text-white/70 text-sm mt-2 font-medium tracking-wider uppercase">
                  {book.category}
                </Text>
                <Text className="text-white text-2xl font-bold mt-3 text-center" numberOfLines={2}>
                  {book.title}
                </Text>
                <Text className="text-white/60 text-xs mt-2">{book.createdAt}</Text>
              </View>
            </View>
          )}

          {/* 状态标签 */}
          <View className="flex-row justify-center -mt-4 gap-2">
            <View className="px-3 py-1 rounded-full bg-white shadow-sm flex-row items-center gap-1.5"
              style={{
                shadowColor: "#6366F1",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <View className="w-2 h-2 rounded-full" style={{ backgroundColor: c1 }} />
              <Text className="text-xs font-medium text-gray-700">{statusConfig.label}</Text>
            </View>
            <View className="px-3 py-1 rounded-full bg-white shadow-sm flex-row items-center gap-1.5"
              style={{
                shadowColor: "#6366F1",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <FontAwesome6 name="file-lines" size={10} color="#6B7280" />
              <Text className="text-xs text-gray-600">{book.chapters.length}章</Text>
            </View>
            <View className="px-3 py-1 rounded-full bg-white shadow-sm flex-row items-center gap-1.5"
              style={{
                shadowColor: "#6366F1",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <FontAwesome6 name="pen" size={10} color="#6B7280" />
              <Text className="text-xs text-gray-600">{formatWordCount(book.wordCount)}字</Text>
            </View>
          </View>
        </View>

        {/* 作品简介 */}
        <View className="bg-white rounded-3xl px-5 py-5 mb-5"
          style={{
            shadowColor: "#6366F1",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 12,
            elevation: 2,
          }}
        >
          <View className="flex-row items-center gap-2 mb-3">
            <View className="w-7 h-7 rounded-full bg-primary-500/10 items-center justify-center">
              <FontAwesome6 name="book-open" size={12} color="#6366F1" />
            </View>
            <Text className="text-sm font-bold text-gray-800">作品简介</Text>
          </View>
          <Text className="text-sm text-gray-600 leading-relaxed">{book.description}</Text>
        </View>

        {/* 快捷操作按钮 */}
        <View className="flex-row gap-3 mb-5">
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            className="flex-1 py-4 rounded-2xl items-center justify-center flex-row gap-2"
            style={{ backgroundColor: "#6366F1" }}
          >
            <FontAwesome6 name="plus" size={14} color="white" />
            <Text className="text-sm font-bold text-white">新建章节</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="py-4 px-5 rounded-2xl items-center justify-center bg-white flex-row gap-2"
            style={{
              shadowColor: "#6366F1",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
              elevation: 1,
            }}
          >
            <FontAwesome6 name="list" size={14} color="#6B7280" />
            <Text className="text-sm font-medium text-gray-700">大纲</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="py-4 px-5 rounded-2xl items-center justify-center bg-white flex-row gap-2"
            style={{
              shadowColor: "#6366F1",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
              elevation: 1,
            }}
          >
            <FontAwesome6 name="chart-simple" size={14} color="#6B7280" />
            <Text className="text-sm font-medium text-gray-700">数据</Text>
          </TouchableOpacity>
        </View>

        {/* 章节列表 */}
        <View className="mb-8">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-2">
              <View className="w-7 h-7 rounded-full bg-primary-500/10 items-center justify-center">
                <FontAwesome6 name="list" size={12} color="#6366F1" />
              </View>
              <Text className="text-base font-bold text-gray-800">章节列表</Text>
              <Text className="text-xs text-gray-400">({book.chapters.length})</Text>
            </View>
            <TouchableOpacity
              onPress={() => setModalVisible(true)}
              className="w-8 h-8 rounded-full bg-primary-500/10 items-center justify-center"
            >
              <FontAwesome6 name="plus" size={14} color="#6366F1" />
            </TouchableOpacity>
          </View>

          {book.chapters.length === 0 ? (
            <View className="bg-white rounded-3xl py-12 items-center"
              style={{
                shadowColor: "#6366F1",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 1,
              }}
            >
              <FontAwesome6 name="file-pen" size={36} color="#D1D5DB" />
              <Text className="text-sm text-gray-400 mt-3">还没有章节</Text>
              <Text className="text-xs text-gray-300 mt-1">点击上方按钮新建第一章</Text>
            </View>
          ) : (
            <View className="gap-2.5">
              {book.chapters.map((chapter, i) => (
                <View
                  key={chapter.id}
                  className="bg-white rounded-2xl p-4 flex-row items-center"
                  style={{
                    shadowColor: "#6366F1",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.04,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                >
                  {/* 序号 */}
                  <View className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center mr-3">
                    <Text className="text-sm font-bold text-gray-400">{i + 1}</Text>
                  </View>

                  {/* 内容 */}
                  <TouchableOpacity
                    className="flex-1"
                    onPress={() =>
                      router.push("/editor", { bookId: id, chapterId: chapter.id })
                    }
                  >
                    <Text className="text-sm font-semibold text-gray-800" numberOfLines={1}>
                      {chapter.title}
                    </Text>
                    <View className="flex-row items-center gap-2 mt-1">
                      <FontAwesome6 name="pen" size={8} color="#9CA3AF" />
                      <Text className="text-[11px] text-gray-400">
                        {formatWordCount(chapter.wordCount)}字
                      </Text>
                      <Text className="text-[11px] text-gray-300">|</Text>
                      <Text className="text-[11px] text-gray-400">{chapter.createdAt}</Text>
                    </View>
                  </TouchableOpacity>

                  {/* 操作 */}
                  <View className="flex-row gap-1.5 ml-2">
                    <TouchableOpacity
                      onPress={() =>
                        router.push("/editor", { bookId: id, chapterId: chapter.id })
                      }
                      className="w-8 h-8 rounded-full bg-primary-500/10 items-center justify-center"
                    >
                      <FontAwesome6 name="pen-to-square" size={12} color="#6366F1" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteChapter(chapter.id, chapter.title)}
                      className="w-8 h-8 rounded-full bg-red-50 items-center justify-center"
                    >
                      <FontAwesome6 name="trash-can" size={12} color="#EF4444" />
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
            <View className="flex-1 justify-end bg-black/40">
              <View
                className="bg-white rounded-t-[32px] px-6 pt-6 pb-8"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: -4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 24,
                  elevation: 10,
                }}
              >
                <View className="flex-row items-center justify-between mb-5">
                  <View className="flex-row items-center gap-2">
                    <View className="w-9 h-9 rounded-full bg-primary-500/10 items-center justify-center">
                      <FontAwesome6 name="file-pen" size={16} color="#6366F1" />
                    </View>
                    <Text className="text-lg font-bold text-gray-800">新建章节</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setModalVisible(false)}
                    className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                  >
                    <FontAwesome6 name="xmark" size={16} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <Text className="text-sm text-gray-500 mb-5">{book.title}</Text>

                <Text className="text-sm font-medium text-gray-700 mb-2">章节标题</Text>
                <TextInput
                  value={chapterTitle}
                  onChangeText={setChapterTitle}
                  placeholder="如：第一章 初入异世"
                  className="w-full px-4 py-3.5 rounded-2xl bg-gray-50 text-gray-800 mb-6"
                  autoFocus
                />

                <TouchableOpacity
                  onPress={handleCreateChapter}
                  className="w-full py-4 rounded-2xl"
                  style={{ backgroundColor: "#6366F1" }}
                >
                  <Text className="text-white text-center font-bold text-base">开始写作</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
    </Screen>
  );
}