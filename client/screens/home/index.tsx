import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  Image,
  ActionSheetIOS,
} from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { FontAwesome6 } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

// 真实封面图片列表（从后端静态文件服务获取）
const COVER_IMAGES_MAN = Array.from({ length: 16 }, (_, i) => ({
  id: `man/${i + 1}.jpg`,
  url: `${API_BASE}/api/v1/static/images/covers/man/${i + 1}.jpg`,
  path: `/api/v1/static/images/covers/man/${i + 1}.jpg`,
  label: `男频封面 ${i + 1}`,
}));

const COVER_IMAGES_WOMEN = Array.from({ length: 16 }, (_, i) => ({
  id: `women/${i + 1}.jpg`,
  url: `${API_BASE}/api/v1/static/images/covers/women/${i + 1}.jpg`,
  path: `/api/v1/static/images/covers/women/${i + 1}.jpg`,
  label: `女频封面 ${i + 1}`,
}));

const CATEGORIES = ["玄幻", "仙侠", "都市", "科幻", "历史"];

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

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "早上好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function formatWordCount(count: number) {
  if (count >= 10000) return (count / 10000).toFixed(1) + "万";
  if (count >= 1000) return (count / 1000).toFixed(1) + "k";
  return count.toString();
}

function getStatusText(status: string) {
  const texts: Record<string, string> = { writing: "正在写", completed: "已完结", paused: "已暂停" };
  return texts[status] || "未知";
}

const DEFAULT_COVER = `${API_BASE}/api/v1/static/images/covers/man/1.jpg`;

export default function HomeScreen() {
  const router = useSafeRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // 创建弹窗
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("玄幻");
  const [newCoverImage, setNewCoverImage] = useState<string>(COVER_IMAGES_MAN[0].path);
  const [coverType, setCoverType] = useState<"man" | "women">("man");
  const [newDesc, setNewDesc] = useState("");

  // 长按编辑弹窗
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("玄幻");
  const [editDesc, setEditDesc] = useState("");

  const fetchBooks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing`);
      const json = await res.json();
      if (json.success) setBooks(json.data);
    } catch (e) {
      console.error("获取书籍列表失败", e);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/writing`);
        const json = await res.json();
        if (json.success) setBooks(json.data);
      } catch (e) {
        console.error("获取书籍列表失败", e);
      }
    };
    load();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing`);
      const json = await res.json();
      if (json.success) setBooks(json.data);
    } catch (e) {
      console.error("获取书籍列表失败", e);
    }
    setRefreshing(false);
  }, []);

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
          category: newCategory,
          cover: "cover-image",
          coverImage: newCoverImage,
          description: newDesc.trim() || "暂无简介",
        }),
      });
      const json = await res.json();
      if (json.success) {
        setModalVisible(false);
        setNewTitle("");
        setNewDesc("");
        setNewCoverImage(COVER_IMAGES_MAN[0].path);
        setNewCategory("玄幻");
        setCoverType("man");
        await fetchBooks();
        router.push("/detail", { id: json.data.id });
      }
    } catch (e) {
      Alert.alert("错误", "创建失败");
    }
  };

  // 长按处理
  const handleLongPress = (book: Book) => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["取消", "编辑信息", "删除书籍"],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
        },
        (index) => {
          if (index === 1) openEditModal(book);
          else if (index === 2) handleDeleteBook(book);
        }
      );
    } else {
      Alert.alert("操作", `《${book.title}》`, [
        { text: "编辑信息", onPress: () => openEditModal(book) },
        { text: "删除书籍", style: "destructive", onPress: () => handleDeleteBook(book) },
        { text: "取消", style: "cancel" },
      ]);
    }
  };

  const openEditModal = (book: Book) => {
    setEditingBook(book);
    setEditTitle(book.title);
    setEditCategory(book.category);
    setEditDesc(book.description);
    setEditModalVisible(true);
  };

  const handleEditSave = async () => {
    if (!editingBook || !editTitle.trim()) {
      Alert.alert("提示", "书名不能为空");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/${editingBook.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          category: editCategory,
          description: editDesc.trim() || "暂无简介",
        }),
      });
      const json = await res.json();
      if (json.success) {
        setEditModalVisible(false);
        setEditingBook(null);
        await fetchBooks();
        Alert.alert("成功", "书籍信息已更新");
      }
    } catch (e) {
      Alert.alert("错误", "更新失败");
    }
  };

  const handleDeleteBook = (book: Book) => {
    Alert.alert("确认删除", `确定要删除《${book.title}》吗？此操作不可恢复。`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            const res = await fetch(`${API_BASE}/api/v1/writing/${book.id}`, {
              method: "DELETE",
            });
            const json = await res.json();
            if (json.success) {
              await fetchBooks();
              Alert.alert("已删除", `《${book.title}》已删除`);
            }
          } catch (e) {
            Alert.alert("错误", "删除失败");
          }
        },
      },
    ]);
  };

  const totalWords = books.reduce((sum, b) => sum + b.wordCount, 0);

  return (
    <Screen>
      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
      >
        {/* ===== 头部问候区 ===== */}
        <View className="flex-row items-center justify-between mt-2 mb-5">
          <View>
            <Text className="text-sm" style={{ color: "#8B5CF6" }}>{getGreeting()}，作者</Text>
            <View className="flex-row items-baseline gap-1">
              <Text className="text-2xl font-bold text-gray-800">开始创作</Text>
              <Text className="text-2xl font-bold" style={{ color: "#6366F1" }}>.</Text>
            </View>
          </View>
          <TouchableOpacity
            className="w-12 h-12 rounded-full items-center justify-center"
            style={{
              backgroundColor: "#EEF2FF",
              shadowColor: "#6366F1",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 6,
              elevation: 3,
            }}
          >
            <FontAwesome6 name="pen-nib" size={20} color="#6366F1" />
          </TouchableOpacity>
        </View>

        {/* ===== 创建新书按钮 ===== */}
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          activeOpacity={0.9}
          className="w-full rounded-2xl mb-5 overflow-hidden"
          style={{
            shadowColor: "#6366F1",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 16,
            elevation: 10,
          }}
        >
          <View className="flex-row items-center p-5" style={{ backgroundColor: "#6366F1" }}>
            <View className="w-14 h-14 rounded-2xl bg-white/15 items-center justify-center mr-4">
              <FontAwesome6 name="feather" size={26} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-white mb-0.5">创建新书</Text>
              <Text className="text-sm text-white/70">开启你的创作之旅</Text>
            </View>
            <View className="w-8 h-8 rounded-full bg-white/15 items-center justify-center">
              <FontAwesome6 name="arrow-right" size={14} color="#FFFFFF" />
            </View>
          </View>
          <View className="h-1" style={{ backgroundColor: "#4F46E5" }} />
        </TouchableOpacity>

        {/* ===== 统计卡片网格 ===== */}
        <View className="flex-row gap-3 mb-5">
          {[
            { icon: "pen-to-square", color: "#6366F1", bgColor: "#EEF2FF", label: "今日创作", value: "2,150", unit: "字" },
            { icon: "fire", color: "#8B5CF6", bgColor: "#F3E8FF", label: "连续创作", value: "7", unit: "天" },
            { icon: "book", color: "#059669", bgColor: "#ECFDF5", label: "作品总数", value: books.length.toString(), unit: "本" },
          ].map((stat, idx) => (
            <View
              key={idx}
              className="flex-1 bg-white rounded-2xl p-4"
              style={{
                shadowColor: stat.color,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.07,
                shadowRadius: 10,
                elevation: 3,
              }}
            >
              <View className="w-8 h-8 rounded-xl items-center justify-center mb-2" style={{ backgroundColor: stat.bgColor }}>
                <FontAwesome6 name={stat.icon as any} size={14} color={stat.color} />
              </View>
              <Text className="text-xs" style={{ color: "#94A3B8" }}>{stat.label}</Text>
              <Text className="text-xl font-bold mt-0.5" style={{ color: "#1E293B" }}>{stat.value}</Text>
              <Text className="text-xs" style={{ color: "#CBD5E1" }}>{stat.unit}</Text>
            </View>
          ))}
        </View>

        {/* ===== 最近作品 ===== */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <View className="w-1 h-4 rounded-full" style={{ backgroundColor: "#6366F1" }} />
              <Text className="text-base font-semibold" style={{ color: "#1E293B" }}>最近作品</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/works")}
              className="flex-row items-center gap-1 px-3 py-1.5 rounded-full"
              style={{ backgroundColor: "#EEF2FF" }}
            >
              <Text className="text-xs font-medium" style={{ color: "#6366F1" }}>查看全部</Text>
              <FontAwesome6 name="chevron-right" size={10} color="#6366F1" />
            </TouchableOpacity>
          </View>
          {books.length === 0 ? (
            <View className="bg-white rounded-2xl py-10 items-center" style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
              elevation: 1,
            }}>
              <View className="w-16 h-16 rounded-2xl bg-gray-100 items-center justify-center mb-3">
                <FontAwesome6 name="book-open" size={24} color="#94A3B8" />
              </View>
              <Text className="text-gray-400 text-sm">还没有作品，点击上方创建</Text>
            </View>
          ) : (
            <View className="gap-3">
              {books.slice(0, 5).map((book) => (
                <TouchableOpacity
                  key={book.id}
                  onPress={() => router.push("/detail", { id: book.id })}
                  onLongPress={() => handleLongPress(book)}
                  delayLongPress={500}
                  activeOpacity={0.7}
                  className="bg-white rounded-2xl overflow-hidden"
                  style={{
                    shadowColor: "#6366F1",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.06,
                    shadowRadius: 10,
                    elevation: 3,
                  }}
                >
                  <View className="flex-row">
                    {/* 封面 */}
                    <View className="w-20 h-24">
                      <Image
                        source={{ uri: `${API_BASE}${book.coverImage || "/api/v1/static/images/covers/man/1.jpg"}` }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    </View>
                    {/* 内容 */}
                    <View className="flex-1 p-3.5 justify-between">
                      <View>
                        <Text className="font-semibold text-base" style={{ color: "#1E293B" }} numberOfLines={1}>
                          {book.title}
                        </Text>
                        <Text className="text-xs mt-1" style={{ color: "#94A3B8" }}>
                          {book.category} · {book.chapters.length}章
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-2 mt-1">
                        <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full" style={{ backgroundColor: "#EEF2FF" }}>
                          <FontAwesome6 name="pen" size={8} color="#6366F1" />
                          <Text className="text-xs font-medium" style={{ color: "#6366F1" }}>
                            {formatWordCount(book.wordCount)}字
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full" style={{ backgroundColor: "#F0FDF4" }}>
                          <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: book.status === "completed" ? "#22C55E" : book.status === "paused" ? "#F59E0B" : "#6366F1" }} />
                          <Text className="text-xs" style={{ color: "#22C55E" }}>
                            {getStatusText(book.status)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View className="justify-center pr-4">
                      <FontAwesome6 name="chevron-right" size={12} color="#CBD5E1" />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ===== 今日写作建议 ===== */}
        <View className="rounded-2xl p-5 mb-8 overflow-hidden" style={{ backgroundColor: "#EEF2FF" }}>
          <View className="flex-row items-center gap-3 mb-3">
            <View className="w-9 h-9 rounded-xl bg-white items-center justify-center" style={{
              shadowColor: "#6366F1",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2,
            }}>
              <FontAwesome6 name="lightbulb" size={16} color="#6366F1" />
            </View>
            <View>
              <Text className="font-semibold" style={{ color: "#1E293B" }}>今日写作建议</Text>
              <Text className="text-xs" style={{ color: "#6366F1" }}>写作技巧</Text>
            </View>
          </View>
          <Text className="text-sm leading-relaxed" style={{ color: "#475569" }}>
            试着在每章结尾留下一个悬念或反转，这能有效提升读者的追读欲望。
            好的断章位置往往在冲突爆发前或真相揭晓时。
          </Text>
          <View className="flex-row items-center gap-2 mt-3">
            <View className="flex-1 h-1.5 rounded-full bg-white/60" />
            <TouchableOpacity className="px-3 py-1.5 rounded-lg bg-white" style={{
              shadowColor: "#6366F1",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.08,
              shadowRadius: 3,
              elevation: 1,
            }}>
              <Text className="text-xs font-medium" style={{ color: "#6366F1" }}>换一条</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="h-6" />
      </ScrollView>

      {/* ===== 创建新书 Modal ===== */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === "web"}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View className="flex-1 justify-end bg-black/50">
              <View className="bg-white rounded-t-3xl p-6 max-h-[85%]" style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.1,
                shadowRadius: 20,
                elevation: 10,
              }}>
                <ScrollView>
                  <View className="flex-row items-center justify-between mb-6">
                    <Text className="text-xl font-bold text-gray-800">创建新书</Text>
                    <TouchableOpacity
                      onPress={() => setModalVisible(false)}
                      className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                    >
                      <FontAwesome6 name="xmark" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>

                  {/* 书名 */}
                  <Text className="text-sm font-medium text-gray-700 mb-2">书名</Text>
                  <TextInput
                    value={newTitle}
                    onChangeText={setNewTitle}
                    placeholder="输入书名"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 mb-5 text-gray-800"
                  />

                  {/* 封面选择 */}
                  <Text className="text-sm font-medium text-gray-700 mb-3">选择封面</Text>
                  {/* 封面类型切换 */}
                  <View className="flex-row bg-gray-100 rounded-xl p-1 mb-4">
                    {[
                      { key: "man" as const, label: "男频封面" },
                      { key: "women" as const, label: "女频封面" },
                    ].map((tab) => (
                      <TouchableOpacity
                        key={tab.key}
                        onPress={() => { setCoverType(tab.key); setNewCoverImage(tab.key === "man" ? COVER_IMAGES_MAN[0].path : COVER_IMAGES_WOMEN[0].path); }}
                        className={`flex-1 py-2 rounded-lg ${coverType === tab.key ? "bg-white shadow-sm" : ""}`}
                      >
                        <Text className={`text-center text-sm font-medium ${coverType === tab.key ? "text-primary-500" : "text-gray-500"}`}>
                          {tab.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* 封面网格 */}
                  <View className="flex-row flex-wrap gap-2 mb-5">
                    {(coverType === "man" ? COVER_IMAGES_MAN : COVER_IMAGES_WOMEN).map((img) => {
                      const selected = newCoverImage === img.path;
                      return (
                        <TouchableOpacity
                          key={img.id}
                          onPress={() => setNewCoverImage(img.path)}
                          className={`w-[22%] aspect-[3/4] rounded-xl overflow-hidden mb-2 ${
                            selected ? "border-2 border-primary-500" : ""
                          }`}
                        >
                          <Image
                            source={{ uri: img.url }}
                            className="w-full h-full"
                            resizeMode="cover"
                          />
                          {selected && (
                            <View className="absolute inset-0 bg-primary-500/20 items-center justify-center">
                              <FontAwesome6 name="check" size={20} color="#6366F1" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* 分类选择 */}
                  <Text className="text-sm font-medium text-gray-700 mb-2">分类</Text>
                  <View className="flex-row flex-wrap gap-2 mb-5">
                    {CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setNewCategory(cat)}
                        className={`px-4 py-2 rounded-xl ${newCategory === cat ? "bg-primary-500" : "bg-gray-100"}`}
                      >
                        <Text className={`text-sm font-medium ${newCategory === cat ? "text-white" : "text-gray-700"}`}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* 简介 */}
                  <Text className="text-sm font-medium text-gray-700 mb-2">一句话简介</Text>
                  <TextInput
                    value={newDesc}
                    onChangeText={setNewDesc}
                    placeholder="简介..."
                    multiline
                    numberOfLines={2}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 mb-6 text-gray-800"
                  />

                  {/* 提交按钮 */}
                  <TouchableOpacity
                    onPress={handleCreateBook}
                    className="w-full py-4 rounded-xl mb-4"
                    style={{ backgroundColor: "#6366F1" }}
                  >
                    <Text className="text-white text-center font-bold">创建作品</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ===== 编辑书籍 Modal ===== */}
      <Modal visible={editModalVisible} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === "web"}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View className="flex-1 justify-end bg-black/50">
              <View className="bg-white rounded-t-3xl p-6 max-h-[75%]" style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.1,
                shadowRadius: 20,
                elevation: 10,
              }}>
                <View className="flex-row items-center justify-between mb-6">
                  <Text className="text-xl font-bold text-gray-800">编辑书籍</Text>
                  <TouchableOpacity
                    onPress={() => setEditModalVisible(false)}
                    className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                  >
                    <FontAwesome6 name="xmark" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                {/* 封面预览 */}
                {editingBook && (
                  <View className="flex-row items-center gap-4 mb-5">
                    <Image
                      source={{ uri: `${API_BASE}${editingBook.coverImage || "/api/v1/static/images/covers/man/1.jpg"}` }}
                      className="w-16 h-20 rounded-xl"
                      resizeMode="cover"
                    />
                    <View className="flex-1">
                      <Text className="font-semibold text-gray-800">{editingBook.title}</Text>
                      <Text className="text-xs text-gray-400 mt-1">ID: {editingBook.id}</Text>
                    </View>
                  </View>
                )}

                <Text className="text-sm font-medium text-gray-700 mb-2">书名</Text>
                <TextInput
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="输入书名"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 mb-5 text-gray-800"
                />

                <Text className="text-sm font-medium text-gray-700 mb-2">分类</Text>
                <View className="flex-row flex-wrap gap-2 mb-5">
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setEditCategory(cat)}
                      className={`px-4 py-2 rounded-xl ${editCategory === cat ? "bg-primary-500" : "bg-gray-100"}`}
                    >
                      <Text className={`text-sm font-medium ${editCategory === cat ? "text-white" : "text-gray-700"}`}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text className="text-sm font-medium text-gray-700 mb-2">简介</Text>
                <TextInput
                  value={editDesc}
                  onChangeText={setEditDesc}
                  placeholder="简介..."
                  multiline
                  numberOfLines={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 mb-6 text-gray-800"
                />

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setEditModalVisible(false)}
                    className="flex-1 py-4 rounded-xl bg-gray-100"
                  >
                    <Text className="text-gray-700 text-center font-medium">取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleEditSave}
                    className="flex-1 py-4 rounded-xl"
                    style={{ backgroundColor: "#6366F1" }}
                  >
                    <Text className="text-white text-center font-bold">保存</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
    </Screen>
  );
}