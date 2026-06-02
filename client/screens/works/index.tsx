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
  Animated,
} from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";
import RNSSE from "react-native-sse";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

// ========== 封面图片列表 ==========
const COVER_IMAGES_MAN = Array.from({ length: 16 }, (_, i) => ({
  id: `man_${i + 1}`,
  url: `${API_BASE}/api/v1/static/images/covers/man/${i + 1}.jpg`,
  path: `/api/v1/static/images/covers/man/${i + 1}.jpg`,
  label: `男频${i + 1}`,
}));
const COVER_IMAGES_WOMEN = Array.from({ length: 16 }, (_, i) => ({
  id: `women_${i + 1}`,
  url: `${API_BASE}/api/v1/static/images/covers/women/${i + 1}.jpg`,
  path: `/api/v1/static/images/covers/women/${i + 1}.jpg`,
  label: `女频${i + 1}`,
}));

const CATEGORIES = ["玄幻", "仙侠", "都市", "科幻", "历史", "言情", "悬疑", "游戏", "武侠", "奇幻"];
const STATUSES = [
  { value: "writing", label: "连载中" },
  { value: "completed", label: "已完结" },
  { value: "paused", label: "已暂停" },
];

function formatWordCount(n: number) {
  if (n >= 10000) return (n / 10000).toFixed(1) + "万";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
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
  volumes: { id: string; title: string; chapters: { id: string; title: string }[] }[];
}

function getChapterCount(book: Book): number {
  if (!book.volumes) return 0;
  return book.volumes.reduce((sum, v) => sum + (v.chapters?.length || 0), 0);
}

// ========== 书籍卡片组件 ==========
function BookCard({
  book,
  viewMode,
  onPress,
  onLongPress,
}: {
  book: Book;
  viewMode: "grid" | "list" | "book";
  onPress: () => void;
  onLongPress: () => void;
}) {
  const statusDot = (() => {
    if (book.status === "writing") return "bg-green-500";
    if (book.status === "completed") return "bg-gray-400";
    return "bg-amber-400";
  })();
  const statusLabel = (() => {
    if (book.status === "writing") return "连载";
    if (book.status === "completed") return "完结";
    return "暂停";
  })();

  if (viewMode === "list") {
    return (
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={500}
        className="bg-white rounded-2xl flex-row overflow-hidden mb-2.5"
        style={{
          shadowColor: "#6366F1",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        {/* 封面缩略图 */}
        <View className="w-16 h-20">
          {book.coverImage ? (
            <Image
              source={{ uri: `${API_BASE}${book.coverImage}` }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-full bg-primary-500 items-center justify-center">
              <FontAwesome6 name="book" size={18} color="rgba(255,255,255,0.7)" />
            </View>
          )}
        </View>
        {/* 信息 */}
        <View className="flex-1 px-3 py-2.5 justify-center">
          <Text className="text-sm font-bold text-gray-800" numberOfLines={1}>{book.title}</Text>
          <View className="flex-row items-center gap-2 mt-1">
            <View className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
            <Text className="text-[10px] text-gray-500">{statusLabel}</Text>
            <Text className="text-[10px] text-gray-400">|</Text>
            <Text className="text-[10px] text-gray-500">{book.category}</Text>
          </View>
          <Text className="text-[10px] text-gray-400 mt-0.5">{getChapterCount(book)}章 · {formatWordCount(book.wordCount)}字</Text>
        </View>
        {/* 更多按钮（兼容Web鼠标操作） */}
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); onLongPress(); }}
          className="w-9 h-full items-center justify-center"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View className="w-6 h-6 rounded-full bg-gray-100 items-center justify-center">
            <Text className="text-gray-500 text-sm font-bold leading-none">⋯</Text>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  if (viewMode === "book") {
    return (
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={500}
        className="w-[48%] mb-5"
      >
        {/* 3D书本效果 */}
        <View className="rounded-xl overflow-hidden" style={{
          shadowColor: "#6366F1",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 6,
        }}>
          <View className="h-44 relative">
            {book.coverImage ? (
              <Image
                source={{ uri: `${API_BASE}${book.coverImage}` }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <View className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 items-center justify-center">
                <FontAwesome6 name="book" size={36} color="rgba(255,255,255,0.6)" />
              </View>
            )}
            {/* 书脊效果 */}
            <View className="absolute left-0 top-0 bottom-0 w-2 bg-black/20" />
            {/* 更多按钮（兼容Web鼠标操作） */}
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation?.(); onLongPress(); }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 items-center justify-center"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text className="text-white text-lg font-bold leading-none">⋯</Text>
            </TouchableOpacity>
            {/* 底部渐变 */}
            <View className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
            <View className="absolute bottom-2 left-3 right-3">
              <Text className="text-white text-xs font-bold" numberOfLines={1}>{book.title}</Text>
              <Text className="text-white/60 text-[9px] mt-0.5">{book.category}</Text>
            </View>
          </View>
        </View>
        {/* 底部信息 */}
        <View className="flex-row items-center justify-between mt-2 px-0.5">
          <View className={`px-1.5 py-0.5 rounded-full ${book.status === "writing" ? "bg-green-500/10" : "bg-gray-100"}`}>
            <Text className={`text-[9px] ${book.status === "writing" ? "text-green-600" : "text-gray-500"}`}>{statusLabel}</Text>
          </View>
          <Text className="text-[10px] text-gray-400">{getChapterCount(book)}章</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // grid 模式（默认）
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}
      className="w-[48%] bg-white rounded-2xl overflow-hidden mb-3.5"
      style={{
        shadowColor: "#6366F1",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
      }}
    >
      {/* 封面图 */}
      <View className="h-32 relative">
        {book.coverImage ? (
          <Image
            source={{ uri: `${API_BASE}${book.coverImage}` }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 items-center justify-center">
            <FontAwesome6 name="book" size={28} color="rgba(255,255,255,0.5)" />
          </View>
        )}
        {/* 状态标签 */}
        <View className={`absolute top-2 left-2 px-2 py-0.5 rounded-full ${statusDot.replace("bg-", "bg-")} bg-white/90`}>
          <Text className={`text-[9px] font-medium ${book.status === "writing" ? "text-green-600" : book.status === "completed" ? "text-gray-500" : "text-amber-500"}`}>
            {statusLabel}
          </Text>
        </View>
        {/* 更多按钮 */}
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); onLongPress(); }}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/30 items-center justify-center"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-white text-lg font-bold leading-none">⋯</Text>
        </TouchableOpacity>
      </View>
      {/* 信息区 */}
      <View className="px-3 py-2.5">
        <Text className="text-sm font-bold text-gray-800" numberOfLines={1}>{book.title}</Text>
        <View className="flex-row items-center gap-2 mt-1">
          <Text className="text-[10px] text-gray-400">{book.category}</Text>
          <Text className="text-[10px] text-gray-300">|</Text>
          <Text className="text-[10px] text-gray-400">{getChapterCount(book)}章</Text>
        </View>
        <Text className="text-[10px] text-gray-400 mt-0.5">{formatWordCount(book.wordCount)}字</Text>
      </View>
    </TouchableOpacity>
  );
}

// ========== 主页面 ==========
export default function WorksScreen() {
  const router = useSafeRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // 搜索
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<Book[]>([]);

  // 视图模式
  const [viewMode, setViewMode] = useState<"grid" | "list" | "book">("grid");

  // 创建弹窗
  const [createSheetVisible, setCreateSheetVisible] = useState(false);

  // 更多弹窗
  const [moreSheetVisible, setMoreSheetVisible] = useState(false);

  // 排序
  const [sortBy, setSortBy] = useState<"new" | "old" | "name" | "words">("new");

  // 新建书籍弹窗（手动）
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("玄幻");
  const [newStatus, setNewStatus] = useState("writing");
  const [coverTab, setCoverTab] = useState<"man" | "women">("man");
  const [selectedCover, setSelectedCover] = useState(COVER_IMAGES_MAN[0].path);

  // AI创建
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  // 长按弹窗
  const [longPressBook, setLongPressBook] = useState<Book | null>(null);

  const fetchBooks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing`);
      const json = await res.json();
      if (json.success) setBooks(json.data);
    } catch (e) {
      console.error("获取书籍列表失败", e);
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

  // 搜索
  const handleSearch = useCallback((text: string) => {
    setSearchText(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    const q = text.toLowerCase();
    setSearchResults(books.filter((b) => b.title.toLowerCase().includes(q) || b.category.includes(q)));
  }, [books]);

  // 获取排序后的书籍
  const getSortedBooks = useCallback(() => {
    const sorted = [...books];
    if (sortBy === "new") sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else if (sortBy === "old") sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    else if (sortBy === "name") sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortBy === "words") sorted.sort((a, b) => b.wordCount - a.wordCount);
    return sorted;
  }, [books, sortBy]);

  const displayBooks = searchVisible && searchText.trim() ? searchResults : getSortedBooks();

  // 手动创建
  const handleCreateBook = async () => {
    if (!newTitle.trim()) {
      Alert.alert("提示", "请输入书名");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc.trim(),
          category: newCategory,
          status: newStatus,
          cover: "cover-image",
          coverImage: selectedCover,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setModalVisible(false);
        resetForm();
        await fetchBooks();
        router.push("/detail", { id: json.data.id });
      }
    } catch (e) {
      Alert.alert("错误", "创建书籍失败");
    }
  };

  // AI创建
  const handleAICreate = async () => {
    if (!aiTopic.trim()) {
      Alert.alert("提示", "请输入创作主题或想法");
      return;
    }
    setAiGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/ai-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: aiTopic.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setAiModalVisible(false);
        setAiTopic("");
        await fetchBooks();
        router.push("/detail", { id: json.data.id });
      }
    } catch (e) {
      Alert.alert("错误", "AI创建失败，请重试");
    }
    setAiGenerating(false);
  };

  const resetForm = () => {
    setNewTitle("");
    setNewDesc("");
    setNewCategory("玄幻");
    setNewStatus("writing");
    setSelectedCover(COVER_IMAGES_MAN[0].path);
  };

  // 删除书籍
  const handleDeleteBook = (book: Book) => {
    Alert.alert("删除确认", `确定删除《${book.title}》？所有章节将不可恢复。`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除", style: "destructive",
        onPress: async () => {
          try {
            const res = await fetch(`${API_BASE}/api/v1/writing/${book.id}`, { method: "DELETE" });
            const json = await res.json();
            if (json.success) {
              setLongPressBook(null);
              await fetchBooks();
            }
          } catch (e) {
            Alert.alert("错误", "删除失败");
          }
        },
      },
    ]);
  };

  const sortOptions = [
    { value: "new", label: "最近更新", icon: "arrow-down-1-9" },
    { value: "old", label: "最早创建", icon: "arrow-up-1-9" },
    { value: "name", label: "按书名", icon: "font" },
    { value: "words", label: "按字数", icon: "text-height" },
  ] as const;

  return (
    <Screen>
      {/* ======== 顶部导航栏 ======== */}
      <View className="px-4 pt-2 pb-3 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-gray-900 tracking-tight">作品</Text>
        <View className="flex-row items-center gap-4">
          <TouchableOpacity onPress={() => setSearchVisible(!searchVisible)}>
            <FontAwesome6 name={searchVisible ? "times" : "magnifying-glass"} size={18} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCreateSheetVisible(true)}>
            <FontAwesome6 name="plus" size={18} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMoreSheetVisible(true)}>
            <FontAwesome6 name="ellipsis" size={18} color="#374151" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ======== 搜索栏 ======== */}
      {searchVisible && (
        <View className="px-4 pb-3">
          <View className="bg-gray-100 rounded-2xl px-4 py-2.5 flex-row items-center gap-3">
            <FontAwesome6 name="magnifying-glass" size={14} color="#9CA3AF" />
            <TextInput
              className="flex-1 text-sm text-gray-800"
              placeholder="搜索书名..."
              placeholderTextColor="#9CA3AF"
              value={searchText}
              onChangeText={handleSearch}
              autoFocus
            />
            {searchText ? (
              <TouchableOpacity onPress={() => { setSearchText(""); setSearchResults([]); }}>
                <FontAwesome6 name="xmark" size={14} color="#9CA3AF" />
              </TouchableOpacity>
            ) : null}
          </View>
          {searchText.trim() && (
            <Text className="text-xs text-gray-400 mt-1.5 ml-1">
              {searchResults.length > 0 ? `找到 ${searchResults.length} 本书` : "未找到匹配的书籍"}
            </Text>
          )}
        </View>
      )}

      {/* ======== 书籍列表 ======== */}
      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
      >
        {/* 排序指示器 */}
        {!searchVisible && (
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs text-gray-400">共 {books.length} 部作品</Text>
            <TouchableOpacity
              onPress={() => setMoreSheetVisible(true)}
              className="flex-row items-center gap-1.5 bg-gray-50 px-3 py-1 rounded-full"
            >
              <FontAwesome6 name="arrow-down-wide-short" size={10} color="#6B7280" />
              <Text className="text-[11px] text-gray-500">{sortOptions.find(s => s.value === sortBy)?.label}</Text>
            </TouchableOpacity>
          </View>
        )}

        {displayBooks.length === 0 ? (
          <View className="items-center justify-center py-20">
            <View className="w-20 h-20 rounded-full bg-primary-500/10 items-center justify-center mb-4">
              <FontAwesome6 name="book" size={32} color="#6366F1" />
            </View>
            <Text className="text-base font-semibold text-gray-500">
              {searchVisible ? "没有找到匹配的书籍" : "还没有作品"}
            </Text>
            <Text className="text-sm text-gray-400 mt-1">
              {searchVisible ? "换个关键词试试" : "点击右上角 + 开始创作"}
            </Text>
          </View>
        ) : viewMode === "grid" ? (
          <View className="flex-row flex-wrap justify-between">
            {displayBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                viewMode="grid"
                onPress={() => router.push("/detail", { id: book.id })}
                onLongPress={() => setLongPressBook(book)}
              />
            ))}
          </View>
        ) : viewMode === "book" ? (
          <View className="flex-row flex-wrap justify-between">
            {displayBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                viewMode="book"
                onPress={() => router.push("/detail", { id: book.id })}
                onLongPress={() => setLongPressBook(book)}
              />
            ))}
          </View>
        ) : (
          <View>
            {displayBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                viewMode="list"
                onPress={() => router.push("/detail", { id: book.id })}
                onLongPress={() => setLongPressBook(book)}
              />
            ))}
          </View>
        )}
        <View className="h-20" />
      </ScrollView>

      {/* ======== 创建方式选择弹窗 ======== */}
      <Modal visible={createSheetVisible} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setCreateSheetVisible(false)}>
          <View className="flex-1 justify-end bg-black/30">
            <TouchableWithoutFeedback>
              <View className="bg-white rounded-[32px] pt-6 pb-8 px-6">
                <View className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-5" />
                <Text className="text-lg font-bold text-gray-900 text-center mb-5">创建作品</Text>
                <View className="flex-row gap-4">
                  <TouchableOpacity
                    onPress={() => {
                      setCreateSheetVisible(false);
                      setSelectedCover(COVER_IMAGES_MAN[0].path);
                      resetForm();
                      setModalVisible(true);
                    }}
                    className="flex-1 py-8 rounded-3xl items-center bg-primary-500/5"
                    style={{
                      shadowColor: "#6366F1",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.08,
                      shadowRadius: 8,
                      elevation: 2,
                    }}
                  >
                    <View className="w-14 h-14 rounded-2xl bg-primary-500 items-center justify-center mb-3">
                      <FontAwesome6 name="pen" size={22} color="white" />
                    </View>
                    <Text className="text-sm font-bold text-gray-800">手动创建</Text>
                    <Text className="text-[11px] text-gray-400 mt-1 text-center">自由设定书名、分类和简介</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setCreateSheetVisible(false);
                      setAiTopic("");
                      setAiModalVisible(true);
                    }}
                    className="flex-1 py-8 rounded-3xl items-center bg-purple-500/5"
                    style={{
                      shadowColor: "#8B5CF6",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.08,
                      shadowRadius: 8,
                      elevation: 2,
                    }}
                  >
                    <View className="w-14 h-14 rounded-2xl bg-purple-500 items-center justify-center mb-3">
                      <FontAwesome6 name="wand-magic-sparkles" size={22} color="white" />
                    </View>
                    <Text className="text-sm font-bold text-gray-800">AI创建</Text>
                    <Text className="text-[11px] text-gray-400 mt-1 text-center">输入主题，AI自动生成</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ======== 更多菜单弹窗 ======== */}
      <Modal visible={moreSheetVisible} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setMoreSheetVisible(false)}>
          <View className="flex-1 justify-end bg-black/30">
            <TouchableWithoutFeedback>
              <View className="bg-white rounded-[32px] pt-6 pb-8 px-6">
                <View className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-5" />
                <Text className="text-lg font-bold text-gray-900 text-center mb-5">更多操作</Text>

                {/* 视图切换 */}
                <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">视图模式</Text>
                <View className="flex-row gap-3 mb-6">
                  {[
                    { value: "grid", icon: "grid-2", label: "网格" },
                    { value: "list", icon: "list", label: "列表" },
                    { value: "book", icon: "book", label: "书籍" },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => { setViewMode(opt.value as "grid" | "list" | "book"); setMoreSheetVisible(false); }}
                      className={`flex-1 py-3.5 rounded-2xl items-center flex-row justify-center gap-2 ${
                        viewMode === opt.value ? "bg-primary-500" : "bg-gray-50"
                      }`}
                    >
                      <FontAwesome6 name={opt.icon} size={14} color={viewMode === opt.value ? "white" : "#6B7280"} />
                      <Text className={`text-sm font-medium ${viewMode === opt.value ? "text-white" : "text-gray-600"}`}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* 排序方式 */}
                <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">排序方式</Text>
                <View className="flex-row flex-wrap gap-2">
                  {sortOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => { setSortBy(opt.value); setMoreSheetVisible(false); }}
                      className={`px-4 py-2.5 rounded-xl flex-row items-center gap-2 ${
                        sortBy === opt.value ? "bg-primary-500/10 border border-primary-500/30" : "bg-gray-50"
                      }`}
                    >
                      <FontAwesome6 name={opt.icon} size={12} color={sortBy === opt.value ? "#6366F1" : "#6B7280"} />
                      <Text className={`text-sm ${sortBy === opt.value ? "text-primary-500 font-medium" : "text-gray-600"}`}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ======== 长按操作弹窗 ======== */}
      <Modal visible={!!longPressBook} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setLongPressBook(null)}>
          <View className="flex-1 justify-end bg-black/30">
            <TouchableWithoutFeedback>
              <View className="bg-white rounded-[32px] pt-6 pb-8 px-6">
                <View className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-5" />
                <Text className="text-base font-bold text-gray-900 text-center mb-1">
                  {longPressBook?.title}
                </Text>
                <Text className="text-xs text-gray-400 text-center mb-5">{longPressBook?.category}</Text>

                {[
                  { icon: "pen-to-square", label: "修改信息", color: "#6366F1", action: () => {
                    const b = longPressBook!;
                    setNewTitle(b.title);
                    setNewDesc(b.description);
                    setNewCategory(b.category);
                    setNewStatus(b.status);
                    setSelectedCover(b.coverImage || COVER_IMAGES_MAN[0].path);
                    setLongPressBook(null);
                    setTimeout(() => setModalVisible(true), 300);
                  }},
                  { icon: "trash-can", label: "删除书籍", color: "#EF4444", action: () => {
                    const b = longPressBook!;
                    setLongPressBook(null);
                    setTimeout(() => handleDeleteBook(b), 300);
                  }},
                  { icon: "file-export", label: "导出书籍", color: "#10B981", action: () => {
                    Alert.alert("提示", "导出功能开发中");
                    setLongPressBook(null);
                  }},
                  { icon: "arrow-down-wide-short", label: "章节排序", color: "#F59E0B", action: () => {
                    Alert.alert("提示", "请在书籍详情页设置章节排序");
                    setLongPressBook(null);
                  }},
                ].map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    onPress={item.action}
                    className="flex-row items-center gap-4 py-4 px-2 rounded-2xl active:bg-gray-50"
                  >
                    <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: item.color + "15" }}>
                      <FontAwesome6 name={item.icon as any} size={16} color={item.color} />
                    </View>
                    <Text className="text-sm font-medium text-gray-800">{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ======== 手动创建弹窗 ======== */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => undefined}>
          <KeyboardAvoidingView className="flex-1 justify-center px-6" behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View className="bg-white rounded-[32px] pt-6 pb-8 max-h-[85%]">
                <View className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-5" />
                <ScrollView className="px-6" showsVerticalScrollIndicator={false}>
                  <Text className="text-lg font-bold text-gray-900 text-center mb-5">
                    {longPressBook ? "修改信息" : "新建作品"}
                  </Text>

                  {/* 书名 */}
                  <Text className="text-xs font-semibold text-gray-500 mb-1.5">书名</Text>
                  <TextInput
                    className="bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-800 mb-4"
                    placeholder="输入书名"
                    placeholderTextColor="#9CA3AF"
                    value={newTitle}
                    onChangeText={setNewTitle}
                  />

                  {/* 描述 */}
                  <Text className="text-xs font-semibold text-gray-500 mb-1.5">简介</Text>
                  <TextInput
                    className="bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-800 mb-4"
                    placeholder="输入作品简介"
                    placeholderTextColor="#9CA3AF"
                    value={newDesc}
                    onChangeText={setNewDesc}
                    multiline
                    numberOfLines={3}
                  />

                  {/* 分类 */}
                  <Text className="text-xs font-semibold text-gray-500 mb-1.5">分类</Text>
                  <View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                    <View className="flex-row gap-2">
                      {CATEGORIES.map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          onPress={() => setNewCategory(cat)}
                          className={`px-4 py-2 rounded-xl ${
                            newCategory === cat ? "bg-primary-500" : "bg-gray-50"
                          }`}
                        >
                          <Text className={`text-sm ${newCategory === cat ? "text-white font-medium" : "text-gray-600"}`}>
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                  </View>

                  {/* 状态 */}
                  <Text className="text-xs font-semibold text-gray-500 mb-1.5">状态</Text>
                  <View className="flex-row gap-2 mb-5">
                    {STATUSES.map((s) => (
                      <TouchableOpacity
                        key={s.value}
                        onPress={() => setNewStatus(s.value)}
                        className={`px-4 py-2 rounded-xl ${
                          newStatus === s.value ? "bg-primary-500" : "bg-gray-50"
                        }`}
                      >
                        <Text className={`text-sm ${newStatus === s.value ? "text-white font-medium" : "text-gray-600"}`}>
                          {s.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* 封面选择 */}
                  <Text className="text-xs font-semibold text-gray-500 mb-1.5">封面</Text>
                  <View className="flex-row gap-2 mb-3">
                    <TouchableOpacity
                      onPress={() => setCoverTab("man")}
                      className={`px-4 py-2 rounded-xl ${coverTab === "man" ? "bg-indigo-500" : "bg-gray-50"}`}
                    >
                      <Text className={`text-sm ${coverTab === "man" ? "text-white" : "text-gray-600"}`}>男频封面</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setCoverTab("women")}
                      className={`px-4 py-2 rounded-xl ${coverTab === "women" ? "bg-pink-500" : "bg-gray-50"}`}
                    >
                      <Text className={`text-sm ${coverTab === "women" ? "text-white" : "text-gray-600"}`}>女频封面</Text>
                    </TouchableOpacity>
                  </View>
                  <View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
                    <View className="flex-row gap-2.5">
                      {(coverTab === "man" ? COVER_IMAGES_MAN : COVER_IMAGES_WOMEN).map((img) => (
                        <TouchableOpacity
                          key={img.id}
                          onPress={() => setSelectedCover(img.path)}
                          className={`rounded-2xl overflow-hidden border-2 ${
                            selectedCover === img.path ? "border-primary-500" : "border-transparent"
                          }`}
                        >
                          <Image source={{ uri: img.url }} className="w-20 h-28" resizeMode="cover" />
                          {selectedCover === img.path && (
                            <View className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary-500 items-center justify-center">
                              <FontAwesome6 name="check" size={10} color="white" />
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                  </View>

                  {/* 按钮 */}
                  <View className="flex-row gap-3 mb-4">
                    <TouchableOpacity
                      onPress={() => { setModalVisible(false); setLongPressBook(null); }}
                      className="flex-1 py-3.5 rounded-2xl items-center bg-gray-100"
                    >
                      <Text className="text-sm font-medium text-gray-600">取消</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleCreateBook}
                      className="flex-[2] py-3.5 rounded-2xl items-center" style={{ backgroundColor: "#6366F1" }}
                    >
                      <Text className="text-sm font-bold text-white">
                        {longPressBook ? "保存修改" : "创建作品"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ======== AI创建弹窗 ======== */}
      <Modal visible={aiModalVisible} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => undefined}>
          <KeyboardAvoidingView className="flex-1 justify-end" behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View className="bg-white rounded-[32px] p-6">
                <View className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-5" />

                {/* 标题 */}
                <View className="flex-row items-center gap-3 mb-4">
                  <View className="w-10 h-10 rounded-2xl bg-purple-500 items-center justify-center">
                    <FontAwesome6 name="wand-magic-sparkles" size={18} color="white" />
                  </View>
                  <View>
                    <Text className="text-lg font-bold text-gray-900">AI创作</Text>
                    <Text className="text-xs text-gray-400">输入主题，AI自动生成作品</Text>
                  </View>
                </View>

                <TextInput
                  className="bg-gray-50 rounded-2xl px-4 py-4 text-sm text-gray-800 mb-4 min-h-[100px]"
                  placeholder={`例如：\n一个少年在末日世界觉醒异能的故事`}
                  placeholderTextColor="#9CA3AF"
                  value={aiTopic}
                  onChangeText={setAiTopic}
                  multiline
                  textAlignVertical="top"
                />

                {/* 示例提示 */}
                <View className="flex-row flex-wrap gap-1.5 mb-4">
                  {["异能觉醒", "星际穿越", "修仙重生", "都市神医", "悬疑探案"].map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => setAiTopic(tag)}
                      className="px-3 py-1.5 rounded-full bg-purple-500/10"
                    >
                      <Text className="text-[11px] text-purple-600">{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setAiModalVisible(false)}
                    className="flex-1 py-3.5 rounded-2xl items-center bg-gray-100"
                  >
                    <Text className="text-sm font-medium text-gray-600">取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleAICreate}
                    disabled={aiGenerating}
                    className="flex-[2] py-3.5 rounded-2xl items-center flex-row justify-center gap-2"
                    style={{ backgroundColor: aiGenerating ? "#A78BFA" : "#8B5CF6" }}
                  >
                    {aiGenerating ? (
                      <>
                        <FontAwesome6 name="spinner" size={14} color="white" />
                        <Text className="text-sm font-bold text-white">生成中...</Text>
                      </>
                    ) : (
                      <>
                        <FontAwesome6 name="wand-magic-sparkles" size={14} color="white" />
                        <Text className="text-sm font-bold text-white">AI生成</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
    </Screen>
  );
}