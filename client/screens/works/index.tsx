import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Platform,
  Image,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
} from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

const CATEGORY_ICONS: Record<string, string> = {
  玄幻: "dragon",
  仙侠: "mountain",
  都市: "city",
  科幻: "rocket",
  历史: "scroll",
};
const CATEGORY_EMOJIS: Record<string, string> = {
  玄幻: "S",
  仙侠: "M",
  都市: "C",
  科幻: "F",
  历史: "H",
};

const COVER_TEMPLATES = [
  { id: "from-purple-500 to-blue-500", name: "紫蓝渐变", colors: ["#8B5CF6", "#6366F1"] },
  { id: "from-green-500 to-teal-500", name: "青绿渐变", colors: ["#22C55E", "#14B8A6"] },
  { id: "from-rose-500 to-pink-500", name: "玫粉渐变", colors: ["#F43F5E", "#EC4899"] },
  { id: "from-amber-500 to-orange-500", name: "金黄渐变", colors: ["#F59E0B", "#F97316"] },
  { id: "from-cyan-500 to-sky-500", name: "天蓝渐变", colors: ["#06B6D4", "#0EA5E9"] },
  { id: "from-red-500 to-rose-500", name: "绯红渐变", colors: ["#EF4444", "#F43F5E"] },
  { id: "from-indigo-500 to-purple-500", name: "靛紫渐变", colors: ["#6366F1", "#8B5CF6"] },
  { id: "from-emerald-500 to-green-500", name: "翡翠渐变", colors: ["#10B981", "#22C55E"] },
  { id: "from-fuchsia-500 to-pink-500", name: "樱花渐变", colors: ["#D946EF", "#EC4899"] },
  { id: "from-violet-500 to-indigo-500", name: "堇紫渐变", colors: ["#8B5CF6", "#6366F1"] },
  { id: "from-slate-700 to-slate-900", name: "暗黑渐变", colors: ["#334155", "#0F172A"] },
  { id: "from-sky-400 to-blue-600", name: "深海渐变", colors: ["#38BDF8", "#2563EB"] },
];

function formatWordCount(count: number) {
  if (count >= 10000) return (count / 10000).toFixed(1) + "万";
  if (count >= 1000) return (count / 1000).toFixed(1) + "k";
  return count.toString();
}

function getStatusText(status: string) {
  const texts: Record<string, string> = { writing: "正在写", completed: "已完结", paused: "已暂停" };
  return texts[status] || "未知";
}

const getCoverColors = (cover: string): [string, string] => {
  const found = COVER_TEMPLATES.find((t) => t.id === cover);
  return found ? (found.colors as [string, string]) : ["#8B5CF6", "#6366F1"];
};

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
  chapters: { id: string; title: string }[];
}

/** 单本书籍卡片组件 */
function BookCard({
  book,
  onPress,
}: {
  book: Book;
  onPress: () => void;
}) {
  const [c1, c2] = getCoverColors(book.cover);
  const catIcon = CATEGORY_ICONS[book.category] || "book";
  const catEmoji = CATEGORY_EMOJIS[book.category] || "B";
  const chapterCount = book.chapters ? book.chapters.length : 0;
  const statusColor =
    book.status === "writing"
      ? "bg-primary-500/10 text-primary-500"
      : book.status === "completed"
        ? "bg-green-500/10 text-green-600"
        : "bg-gray-100 text-gray-500";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="bg-white rounded-3xl overflow-hidden"
      style={{
        shadowColor: "#6366F1",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 3,
      }}
    >
      {/* 封面 - 有图片则展示图片，否则用渐变 */}
      {book.coverImage ? (
        <View className="h-44 relative">
          <Image
            source={{ uri: `${API_BASE}${book.coverImage}` }}
            className="w-full h-full"
            resizeMode="cover"
          />
          <View className="absolute inset-0 bg-black/20" />
          <View className="absolute bottom-3 left-4">
            <Text className="text-white/80 text-xs font-medium tracking-wider">
              {book.category}
            </Text>
            <Text
              className="text-white font-bold text-base mt-0.5"
              numberOfLines={1}
            >
              {book.title}
            </Text>
          </View>
        </View>
      ) : (
        <View
          className="px-5 py-6"
          style={{ backgroundColor: c1 }}
        >
          <View className="items-center">
            <FontAwesome6 name={catIcon} size={32} color="rgba(255,255,255,0.9)" />
            <Text className="text-white/80 text-xs mt-2 font-medium tracking-wider">
              {book.category}
            </Text>
            <Text
              className="text-white font-bold text-base mt-1 text-center"
              numberOfLines={1}
            >
              {book.title}
            </Text>
          </View>
        </View>
      )}

      {/* 底部信息 */}
      <View className="px-4 py-3.5 bg-white">
        <Text className="text-xs text-gray-500 leading-relaxed" numberOfLines={2}>
          {book.description}
        </Text>
        <View className="flex-row items-center justify-between mt-3">
          <View className="flex-row items-center gap-1.5">
            <View className="px-2 py-0.5 rounded-full bg-primary-500/10">
              <Text className="text-primary-500 text-[10px] font-medium">
                {getStatusText(book.status)}
              </Text>
            </View>
            <Text className="text-[10px] text-gray-400">
              {chapterCount}章 · {formatWordCount(book.wordCount)}字
            </Text>
          </View>
          <Text className="text-[10px] text-gray-400">{book.createdAt}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** 新建书籍 Modal */
function NewBookModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("玄幻");
  const [selectedCover, setSelectedCover] = useState("from-purple-500 to-blue-500");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert("提示", "请输入书名");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          cover: selectedCover,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setTitle("");
        setDescription("");
        setCategory("玄幻");
        setSelectedCover("from-purple-500 to-blue-500");
        onClose();
        onCreated();
      }
    } catch (e) {
      Alert.alert("错误", "创建失败");
    } finally {
      setSubmitting(false);
    }
  };

  const categories = ["玄幻", "仙侠", "都市", "科幻", "历史"];

  return (
    <Modal visible={visible} transparent animationType="slide">
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
              {/* 头部 */}
              <View className="flex-row items-center justify-between mb-5">
                <View className="flex-row items-center gap-2">
                  <View className="w-9 h-9 rounded-full bg-primary-500/10 items-center justify-center">
                    <FontAwesome6 name="pen-fancy" size={16} color="#6366F1" />
                  </View>
                  <Text className="text-lg font-bold text-gray-800">创建新书</Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                >
                  <FontAwesome6 name="xmark" size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView className="max-h-[420px]" showsVerticalScrollIndicator={false}>
                {/* 书名 */}
                <Text className="text-sm font-medium text-gray-700 mb-2">书名</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="输入书名"
                  className="w-full px-4 py-3.5 rounded-2xl bg-gray-50 text-gray-800 mb-4"
                />

                {/* 封面选择 */}
                <Text className="text-sm font-medium text-gray-700 mb-2">选择封面</Text>
                <View className="mb-4 -mx-2">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2.5 px-2">
                    {COVER_TEMPLATES.map((cover) => {
                      const [c1] = cover.colors;
                      const selected = selectedCover === cover.id;
                      return (
                        <TouchableOpacity
                          key={cover.id}
                          onPress={() => setSelectedCover(cover.id)}
                          className="items-center gap-1"
                        >
                          <View
                            className="w-16 h-22 rounded-xl items-center justify-center"
                            style={{
                              backgroundColor: c1,
                              width: 60,
                              height: 85,
                              borderRadius: 12,
                              borderWidth: selected ? 3 : 0,
                              borderColor: selected ? "#6366F1" : "transparent",
                            }}
                          >
                            <FontAwesome6
                              name={CATEGORY_ICONS[category] || "book"}
                              size={20}
                              color="rgba(255,255,255,0.85)"
                            />
                          </View>
                          <Text className="text-[10px] text-gray-500 mt-0.5">{cover.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
                </View>

                {/* 分类 */}
                <Text className="text-sm font-medium text-gray-700 mb-2">分类</Text>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setCategory(cat)}
                      className={`px-4 py-2 rounded-full ${
                        category === cat ? "bg-primary-500" : "bg-gray-100"
                      }`}
                    >
                      <Text
                        className={`text-sm font-medium ${
                          category === cat ? "text-white" : "text-gray-600"
                        }`}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* 简介 */}
                <Text className="text-sm font-medium text-gray-700 mb-2">一句话简介</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="简介..."
                  multiline
                  numberOfLines={2}
                  className="w-full px-4 py-3.5 rounded-2xl bg-gray-50 text-gray-800 mb-4 min-h-[64px]"
                />
              </ScrollView>

              {/* 创建按钮 */}
              <TouchableOpacity
                onPress={handleCreate}
                disabled={submitting}
                className="w-full py-4 rounded-2xl mt-3"
                style={{ backgroundColor: "#6366F1" }}
              >
                <Text className="text-white text-center font-bold text-base">
                  {submitting ? "创建中..." : "创建作品"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

export default function WorksScreen() {
  const router = useSafeRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [pageInfo, setPageInfo] = useState({ total: 0, totalWords: 0 });

  const fetchBooks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing`);
      const json = await res.json();
      if (json.success) {
        setBooks(json.data);
        const total = json.data.length;
        const totalWords = json.data.reduce((sum: number, b: Book) => sum + (b.wordCount || 0), 0);
        setPageInfo({ total, totalWords });
      }
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
        {/* 顶部统计 */}
        <View className="flex-row items-center justify-between mt-2 mb-5">
          <View>
            <Text className="text-2xl font-bold text-gray-800">作品</Text>
            <Text className="text-sm text-gray-500 mt-0.5">
              共 {pageInfo.total} 本 · {formatWordCount(pageInfo.totalWords)}字
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            className="px-5 py-3 rounded-2xl flex-row items-center gap-2"
            style={{ backgroundColor: "#6366F1" }}
          >
            <FontAwesome6 name="plus" size={14} color="white" />
            <Text className="text-white text-sm font-bold">新书</Text>
          </TouchableOpacity>
        </View>

        {/* 书籍列表 */}
        {books.length === 0 ? (
          <View className="items-center py-20">
            <View className="w-20 h-20 rounded-full bg-primary-500/10 items-center justify-center mb-4">
              <FontAwesome6 name="book-open" size={32} color="#6366F1" />
            </View>
            <Text className="text-base text-gray-500 mb-2">还没有作品</Text>
            <TouchableOpacity
              onPress={() => setModalVisible(true)}
              className="px-6 py-3 rounded-xl"
              style={{ backgroundColor: "#6366F1" }}
            >
              <Text className="text-white font-medium">创建你的第一本书</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="gap-4 pb-4">
            {books.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onPress={() => router.push("/detail", { id: book.id })}
              />
            ))}
          </View>
        )}

        <View className="h-8" />
      </ScrollView>

      <NewBookModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onCreated={fetchBooks}
      />
    </Screen>
  );
}