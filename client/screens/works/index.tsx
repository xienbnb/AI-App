import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
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

function getStatusText(status: string) {
  const texts: Record<string, string> = { writing: "正在写", completed: "已完结", paused: "已暂停" };
  return texts[status] || "未知";
}

const getCoverColors = (cover: string): [string, string] => {
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
};

interface Book {
  id: string;
  title: string;
  category: string;
  status: string;
  cover: string;
  description: string;
  createdAt: string;
  wordCount: number;
  chapters: { id: string; title: string }[];
}

export default function WorksScreen() {
  const router = useSafeRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBooks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing`);
      const json = await res.json();
      if (json.success) setBooks(json.data);
    } catch (e) {
      console.error("获取作品列表失败", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBooks();
    }, [fetchBooks])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBooks();
    setRefreshing(false);
  }, [fetchBooks]);

  return (
    <Screen>
      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
      >
        <View className="flex-row items-center justify-between mt-2 mb-4">
          <Text className="text-sm text-gray-500">共 {books.length} 本作品</Text>
          <TouchableOpacity
            onPress={() => router.push("/")}
            className="px-4 py-2 bg-primary-500/10 rounded-xl"
          >
            <Text className="text-primary-500 text-sm font-medium">+ 新书</Text>
          </TouchableOpacity>
        </View>

        {books.length === 0 ? (
          <View className="items-center py-16">
            <Text className="text-5xl mb-4">B</Text>
            <Text className="text-base text-gray-500 mb-2">还没有作品</Text>
            <TouchableOpacity onPress={() => router.push("/")}>
              <Text className="text-primary-500 font-medium">点击创建你的第一本书 →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="space-y-4 gap-4">
            {books.map((book) => {
              const [c1] = getCoverColors(book.cover);
              return (
                <TouchableOpacity
                  key={book.id}
                  onPress={() => router.push("/detail", { id: book.id })}
                  className="bg-white rounded-2xl p-4 flex-row gap-4"
                  style={{
                    shadowColor: "#6366F1",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.06,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                >
                  <View
                    className="w-20 h-28 rounded-xl items-center justify-center"
                    style={{ backgroundColor: c1 }}
                  >
                    <Text className="text-3xl">{getCategoryIcon(book.category)}</Text>
                  </View>
                  <View className="flex-1 pt-1">
                    <Text className="font-bold text-gray-800 text-lg" numberOfLines={1}>
                      {book.title}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-1">
                      {book.category} · {book.chapters.length}章 · {formatWordCount(book.wordCount)}字
                    </Text>
                    <Text className="text-xs text-gray-600 mt-2 leading-relaxed" numberOfLines={2}>
                      {book.description}
                    </Text>
                    <View className="flex-row items-center gap-2 mt-3">
                      <Text className="px-2.5 py-0.5 bg-primary-500/10 text-primary-500 text-xs rounded-full font-medium">
                        {getStatusText(book.status)}
                      </Text>
                      <Text className="text-xs text-gray-400">{book.createdAt}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </Screen>
  );
}