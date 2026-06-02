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
} from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { FontAwesome6 } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

const COVER_TEMPLATES = [
  { id: "from-purple-500 to-blue-500", name: "紫蓝渐变", icon: "S" },
  { id: "from-green-500 to-teal-500", name: "青绿渐变", icon: "M" },
  { id: "from-rose-500 to-pink-500", name: "玫粉渐变", icon: "H" },
  { id: "from-amber-500 to-orange-500", name: "金黄渐变", icon: "C" },
  { id: "from-cyan-500 to-sky-500", name: "天蓝渐变", icon: "F" },
  { id: "from-red-500 to-rose-500", name: "绯红渐变", icon: "K" },
  { id: "from-indigo-500 to-purple-500", name: "靛紫渐变", icon: "N" },
  { id: "from-emerald-500 to-green-500", name: "翡翠渐变", icon: "G" },
  { id: "from-fuchsia-500 to-pink-500", name: "樱花渐变", icon: "P" },
  { id: "from-violet-500 to-indigo-500", name: "堇紫渐变", icon: "L" },
  { id: "from-slate-700 to-slate-900", name: "暗黑渐变", icon: "D" },
  { id: "from-sky-400 to-blue-600", name: "深海渐变", icon: "O" },
];

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

function getCategoryIcon(category: string) {
  const icons: Record<string, string> = { 玄幻: "S", 仙侠: "M", 都市: "C", 科幻: "F", 历史: "H" };
  return icons[category] || "B";
}

function getStatusText(status: string) {
  const texts: Record<string, string> = { writing: "正在写", completed: "已完结", paused: "已暂停" };
  return texts[status] || "未知";
}

function getCoverColors(cover: string) {
  const colors: Record<string, string[]> = {
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

export default function HomeScreen() {
  const router = useSafeRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("玄幻");
  const [newCover, setNewCover] = useState("from-purple-500 to-blue-500");
  const [newCoverImage, setNewCoverImage] = useState<string | null>(null);
  const [coverType, setCoverType] = useState<"gradient" | "man" | "women">("gradient");
  const [newDesc, setNewDesc] = useState("");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

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
    await (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/writing`);
        const json = await res.json();
        if (json.success) setBooks(json.data);
      } catch (e) {
        console.error("获取书籍列表失败", e);
      }
    })();
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
          cover: newCoverImage ? "cover-image" : newCover,
          coverImage: newCoverImage,
          description: newDesc.trim() || "暂无简介",
        }),
      });
      const json = await res.json();
      if (json.success) {
        setModalVisible(false);
        setNewTitle("");
        setNewDesc("");
        setNewCover("from-purple-500 to-blue-500");
        setNewCoverImage(null);
        setNewCategory("玄幻");
        setCoverType("gradient");
        await fetchBooks();
        router.push("/detail", { id: json.data.id });
      }
    } catch (e) {
      Alert.alert("错误", "创建失败");
    }
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
              <Text className="text-2xl font-bold" style={{ color: "#6366F1" }}>·</Text>
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

        {/* ===== 创建新书按钮 - 渐变背景+图标 ===== */}
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
          {/* 底部装饰线 */}
          <View className="h-1" style={{ backgroundColor: "#4F46E5" }} />
        </TouchableOpacity>

        {/* ===== 统计卡片网格 ===== */}
        <View className="flex-row gap-3 mb-5">
          <View className="flex-1 bg-white rounded-2xl p-4" style={{
            shadowColor: "#6366F1",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.07,
            shadowRadius: 10,
            elevation: 3,
          }}>
            <View className="w-8 h-8 rounded-xl bg-primary-500/10 items-center justify-center mb-2">
              <FontAwesome6 name="pen-to-square" size={14} color="#6366F1" />
            </View>
            <Text className="text-xs" style={{ color: "#94A3B8" }}>今日创作</Text>
            <Text className="text-xl font-bold mt-0.5" style={{ color: "#1E293B" }}>2,150</Text>
            <Text className="text-xs" style={{ color: "#CBD5E1" }}>字</Text>
          </View>
          <View className="flex-1 bg-white rounded-2xl p-4" style={{
            shadowColor: "#8B5CF6",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.07,
            shadowRadius: 10,
            elevation: 3,
          }}>
            <View className="w-8 h-8 rounded-xl bg-ai-500/10 items-center justify-center mb-2">
              <FontAwesome6 name="fire" size={14} color="#8B5CF6" />
            </View>
            <Text className="text-xs" style={{ color: "#94A3B8" }}>连续创作</Text>
            <Text className="text-xl font-bold mt-0.5" style={{ color: "#1E293B" }}>7</Text>
            <Text className="text-xs" style={{ color: "#CBD5E1" }}>天</Text>
          </View>
          <View className="flex-1 bg-white rounded-2xl p-4" style={{
            shadowColor: "#059669",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.07,
            shadowRadius: 10,
            elevation: 3,
          }}>
            <View className="w-8 h-8 rounded-xl bg-emerald-500/10 items-center justify-center mb-2">
              <FontAwesome6 name="book" size={14} color="#059669" />
            </View>
            <Text className="text-xs" style={{ color: "#94A3B8" }}>作品总数</Text>
            <Text className="text-xl font-bold mt-0.5" style={{ color: "#1E293B" }}>{books.length}</Text>
            <Text className="text-xs" style={{ color: "#CBD5E1" }}>本</Text>
          </View>
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
            <View className="space-y-3 gap-3">
              {books.slice(0, 3).map((book) => {
                const [c1, c2] = getCoverColors(book.cover);
                return (
                  <TouchableOpacity
                    key={book.id}
                    onPress={() => router.push("/detail", { id: book.id })}
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
                      {/* 封面侧边条 */}
                      {book.coverImage ? (
                        <View className="w-20 h-24">
                          <Image
                            source={{ uri: `${API_BASE}${book.coverImage}` }}
                            className="w-full h-full"
                            resizeMode="cover"
                          />
                        </View>
                      ) : (
                        <View className="w-20 h-24 items-center justify-center" style={{ backgroundColor: c1 }}>
                          <FontAwesome6 name="book" size={24} color="#FFFFFF" />
                        </View>
                      )}
                      {/* 内容区域 */}
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
                            <FontAwesome6 name="circle" size={6} color="#22C55E" />
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
                );
              })}
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

      {/* 创建新书 Modal */}
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
                      <Text className="text-gray-400">x</Text>
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
                      { key: "gradient" as const, label: "渐变风格" },
                      { key: "man" as const, label: "男频封面" },
                      { key: "women" as const, label: "女频封面" },
                    ].map((tab) => (
                      <TouchableOpacity
                        key={tab.key}
                        onPress={() => { setCoverType(tab.key); setNewCoverImage(null); }}
                        className={`flex-1 py-2 rounded-lg ${
                          coverType === tab.key ? "bg-white shadow-sm" : ""
                        }`}
                      >
                        <Text className={`text-center text-sm font-medium ${
                          coverType === tab.key ? "text-primary-500" : "text-gray-500"
                        }`}>
                          {tab.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* 封面内容 */}
                  {coverType === "gradient" ? (
                    <View className="flex-row flex-wrap gap-2 mb-5">
                      {COVER_TEMPLATES.map((cover) => {
                        const [c1] = getCoverColors(cover.id);
                        const selected = newCover === cover.id;
                        return (
                          <TouchableOpacity
                            key={cover.id}
                            onPress={() => { setNewCover(cover.id); setNewCoverImage(null); }}
                            className={`w-[22%] aspect-[3/4] rounded-xl items-center justify-center mb-2 ${
                              selected ? "border-2 border-primary-500" : ""
                            }`}
                            style={{ backgroundColor: c1 }}
                          >
                            <Text className="text-xl">{cover.icon}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
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
                  )}

                  {/* 分类选择 */}
                  <Text className="text-sm font-medium text-gray-700 mb-2">分类</Text>
                  <View className="flex-row flex-wrap gap-2 mb-5">
                    {CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setNewCategory(cat)}
                        className={`px-4 py-2 rounded-xl ${
                          newCategory === cat
                            ? "bg-primary-500"
                            : "bg-gray-100"
                        }`}
                      >
                        <Text
                          className={`text-sm font-medium ${
                            newCategory === cat ? "text-white" : "text-gray-700"
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
    </Screen>
  );
}