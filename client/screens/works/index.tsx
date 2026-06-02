import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  Image,
  RefreshControl,
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

const COVER_IMAGES_MAN = Array.from({ length: 16 }, (_, i) => ({
  id: `man_${i + 1}`,
  path: `/api/v1/static/images/covers/man/${i + 1}.jpg`,
  url: `${API_BASE}/api/v1/static/images/covers/man/${i + 1}.jpg`,
  type: "man" as const,
}));

const COVER_IMAGES_WOMEN = Array.from({ length: 16 }, (_, i) => ({
  id: `women_${i + 1}`,
  path: `/api/v1/static/images/covers/women/${i + 1}.jpg`,
  url: `${API_BASE}/api/v1/static/images/covers/women/${i + 1}.jpg`,
  type: "women" as const,
}));

const ALL_COVERS = [...COVER_IMAGES_MAN, ...COVER_IMAGES_WOMEN];

function formatWordCount(count: number) {
  if (count >= 10000) return (count / 10000).toFixed(1) + "万";
  if (count >= 1000) return (count / 1000).toFixed(1) + "k";
  return count.toString();
}

function getStatusText(status: string) {
  const texts: Record<string, string> = { writing: "连载中", completed: "已完结", paused: "已暂停" };
  return texts[status] || "未知";
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
  chapters: { id: string; title: string }[];
}

/** 长按操作面板 */
function BookActionSheet({
  visible,
  book,
  onClose,
  onEdit,
  onDelete,
}: {
  visible: boolean;
  book: Book | null;
  onClose: () => void;
  onEdit: (book: Book) => void;
  onDelete: (book: Book) => void;
}) {
  if (!book) return null;
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 justify-end bg-black/30">
          <TouchableWithoutFeedback>
            <View className="bg-white rounded-t-[28px] px-6 pt-6 pb-10">
              <View className="items-center mb-4">
                <View className="w-10 h-1 rounded-full bg-gray-300 mb-4" />
                <Text className="text-base font-bold text-gray-800">{book.title}</Text>
              </View>

              <TouchableOpacity
                onPress={() => { onClose(); onEdit(book); }}
                className="flex-row items-center gap-4 py-4 border-b border-gray-100"
              >
                <View className="w-10 h-10 rounded-full bg-primary-500/10 items-center justify-center">
                  <FontAwesome6 name="pen-to-square" size={18} color="#6366F1" />
                </View>
                <View>
                  <Text className="text-base font-medium text-gray-800">编辑书籍</Text>
                  <Text className="text-xs text-gray-500 mt-0.5">修改书名、简介、分类</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  onClose();
                  Alert.alert("确认删除", `确定要删除「${book.title}」吗？所有章节内容将永久丢失。`, [
                    { text: "取消", style: "cancel" },
                    { text: "删除", style: "destructive", onPress: () => onDelete(book) },
                  ]);
                }}
                className="flex-row items-center gap-4 py-4"
              >
                <View className="w-10 h-10 rounded-full bg-red-50 items-center justify-center">
                  <FontAwesome6 name="trash-can" size={18} color="#EF4444" />
                </View>
                <View>
                  <Text className="text-base font-medium text-red-500">删除书籍</Text>
                  <Text className="text-xs text-gray-500 mt-0.5">不可恢复的操作</Text>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

/** 编辑书籍弹窗 */
function EditBookModal({
  visible,
  book,
  onClose,
  onSaved,
}: {
  visible: boolean;
  book: Book | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("玄幻");
  const [status, setStatus] = useState("writing");
  const [submitting, setSubmitting] = useState(false);

  // 当 book 变化时同步数据
  useEffect(() => {
    if (book) {
      setTitle(book.title);
      setDescription(book.description);
      setCategory(book.category);
      setStatus(book.status);
    }
  }, [book]);

  const handleSave = async () => {
    if (!title.trim() || !book) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/${book.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), category, status }),
      });
      const json = await res.json();
      if (json.success) {
        onClose();
        onSaved();
      }
    } catch (e) {
      Alert.alert("错误", "保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  const categories = ["玄幻", "仙侠", "都市", "科幻", "历史"];
  const statuses = [
    { key: "writing", label: "连载中" },
    { key: "completed", label: "已完结" },
    { key: "paused", label: "已暂停" },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === "web"}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
                    <FontAwesome6 name="pen-to-square" size={16} color="#6366F1" />
                  </View>
                  <Text className="text-lg font-bold text-gray-800">编辑书籍</Text>
                </View>
                <TouchableOpacity onPress={onClose} className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
                  <FontAwesome6 name="xmark" size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView className="max-h-[420px]" showsVerticalScrollIndicator={false}>
                <Text className="text-sm font-medium text-gray-700 mb-2">书名</Text>
                <TextInput value={title} onChangeText={setTitle} placeholder="输入书名" className="w-full px-4 py-3.5 rounded-2xl bg-gray-50 text-gray-800 mb-4" />

                <Text className="text-sm font-medium text-gray-700 mb-2">分类</Text>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {categories.map((cat) => (
                    <TouchableOpacity key={cat} onPress={() => setCategory(cat)}
                      className={`px-4 py-2 rounded-full ${category === cat ? "bg-primary-500" : "bg-gray-100"}`}>
                      <Text className={`text-sm font-medium ${category === cat ? "text-white" : "text-gray-600"}`}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text className="text-sm font-medium text-gray-700 mb-2">状态</Text>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {statuses.map((s) => (
                    <TouchableOpacity key={s.key} onPress={() => setStatus(s.key)}
                      className={`px-4 py-2 rounded-full ${status === s.key ? "bg-primary-500" : "bg-gray-100"}`}>
                      <Text className={`text-sm font-medium ${status === s.key ? "text-white" : "text-gray-600"}`}>{s.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text className="text-sm font-medium text-gray-700 mb-2">简介</Text>
                <TextInput value={description} onChangeText={setDescription} placeholder="简介..." multiline numberOfLines={2} className="w-full px-4 py-3.5 rounded-2xl bg-gray-50 text-gray-800 mb-4 min-h-[64px]" />
              </ScrollView>

              <TouchableOpacity onPress={handleSave} disabled={submitting} className="w-full py-4 rounded-2xl mt-3" style={{ backgroundColor: "#6366F1" }}>
                <Text className="text-white text-center font-bold text-base">{submitting ? "保存中..." : "保存修改"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

/** 单本书籍卡片组件 */
function BookCard({
  book,
  onPress,
  onLongPress,
}: {
  book: Book;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const catIcon = CATEGORY_ICONS[book.category] || "book";
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
      onLongPress={onLongPress}
      delayLongPress={500}
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
      {/* 封面 - 仅展示真实图片 */}
      {book.coverImage ? (
        <View className="h-44 relative">
          <Image
            source={{ uri: `${API_BASE}${book.coverImage}` }}
            className="w-full h-full"
            resizeMode="cover"
          />
          <View className="absolute inset-0 bg-black/20" />
          <View className="absolute bottom-3 left-4">
            <Text className="text-white/80 text-xs font-medium tracking-wider">{book.category}</Text>
            <Text className="text-white font-bold text-base mt-0.5" numberOfLines={1}>{book.title}</Text>
          </View>
        </View>
      ) : (
        <View className="h-44 bg-gradient-to-br from-indigo-400 to-purple-500 items-center justify-center">
          <FontAwesome6 name={catIcon} size={40} color="rgba(255,255,255,0.7)" />
          <Text className="text-white/80 text-xs mt-2 font-medium">{book.category}</Text>
          <Text className="text-white font-bold text-base mt-1" numberOfLines={1}>{book.title}</Text>
        </View>
      )}

      {/* 底部信息 */}
      <View className="px-4 py-3.5 bg-white">
        <Text className="text-xs text-gray-500 leading-relaxed" numberOfLines={2}>{book.description}</Text>
        <View className="flex-row items-center justify-between mt-3">
          <View className="flex-row items-center gap-1.5">
            <View className="px-2 py-0.5 rounded-full bg-primary-500/10">
              <Text className="text-primary-500 text-[10px] font-medium">{getStatusText(book.status)}</Text>
            </View>
            <Text className="text-[10px] text-gray-400">{chapterCount}章 · {formatWordCount(book.wordCount)}字</Text>
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
  const [coverTab, setCoverTab] = useState<"man" | "women">("man");
  const [selectedCoverId, setSelectedCoverId] = useState<string>(COVER_IMAGES_MAN[0].id);
  const [submitting, setSubmitting] = useState(false);

  const currentCovers = coverTab === "man" ? COVER_IMAGES_MAN : COVER_IMAGES_WOMEN;
  const selectedCover = ALL_COVERS.find((c) => c.id === selectedCoverId);

  const handleCreate = async () => {
    if (!title.trim()) { Alert.alert("提示", "请输入书名"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          cover: "cover-image",
          coverImage: selectedCover?.path || "",
        }),
      });
      const json = await res.json();
      if (json.success) {
        setTitle(""); setDescription(""); setCategory("玄幻");
        setSelectedCoverId(COVER_IMAGES_MAN[0].id);
        onClose(); onCreated();
      }
    } catch (e) { Alert.alert("错误", "创建失败"); }
    finally { setSubmitting(false); }
  };

  const categories = ["玄幻", "仙侠", "都市", "科幻", "历史"];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === "web"}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View className="flex-1 justify-end bg-black/40">
            <View className="bg-white rounded-t-[32px] px-6 pt-6 pb-8"
              style={{ shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 24, elevation: 10 }}>
              <View className="flex-row items-center justify-between mb-5">
                <View className="flex-row items-center gap-2">
                  <View className="w-9 h-9 rounded-full bg-primary-500/10 items-center justify-center">
                    <FontAwesome6 name="pen-fancy" size={16} color="#6366F1" />
                  </View>
                  <Text className="text-lg font-bold text-gray-800">创建新书</Text>
                </View>
                <TouchableOpacity onPress={onClose} className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
                  <FontAwesome6 name="xmark" size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView className="max-h-[480px]" showsVerticalScrollIndicator={false}>
                <Text className="text-sm font-medium text-gray-700 mb-2">书名</Text>
                <TextInput value={title} onChangeText={setTitle} placeholder="输入书名"
                  className="w-full px-4 py-3.5 rounded-2xl bg-gray-50 text-gray-800 mb-4" />

                <Text className="text-sm font-medium text-gray-700 mb-2">选择封面</Text>
                {/* 封面切换标签 */}
                <View className="flex-row gap-2 mb-3">
                  <TouchableOpacity onPress={() => setCoverTab("man")}
                    className={`px-4 py-2 rounded-full ${coverTab === "man" ? "bg-primary-500" : "bg-gray-100"}`}>
                    <Text className={`text-sm font-medium ${coverTab === "man" ? "text-white" : "text-gray-600"}`}>男频封面</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setCoverTab("women")}
                    className={`px-4 py-2 rounded-full ${coverTab === "women" ? "bg-primary-500" : "bg-gray-100"}`}>
                    <Text className={`text-sm font-medium ${coverTab === "women" ? "text-white" : "text-gray-600"}`}>女频封面</Text>
                  </TouchableOpacity>
                </View>
                {/* 封面网格 */}
                <View className="flex-row flex-wrap gap-2.5 mb-4">
                  {currentCovers.map((cover) => {
                    const selected = selectedCoverId === cover.id;
                    return (
                      <TouchableOpacity key={cover.id} onPress={() => setSelectedCoverId(cover.id)}>
                        <View className={`rounded-xl overflow-hidden ${selected ? "border-2 border-primary-500" : ""}`}>
                          <Image source={{ uri: cover.url }} className="w-[68px] h-[96px]" resizeMode="cover" />
                          {selected && (
                            <View className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary-500 items-center justify-center">
                              <FontAwesome6 name="check" size={10} color="white" />
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text className="text-sm font-medium text-gray-700 mb-2">分类</Text>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {categories.map((cat) => (
                    <TouchableOpacity key={cat} onPress={() => setCategory(cat)}
                      className={`px-4 py-2 rounded-full ${category === cat ? "bg-primary-500" : "bg-gray-100"}`}>
                      <Text className={`text-sm font-medium ${category === cat ? "text-white" : "text-gray-600"}`}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text className="text-sm font-medium text-gray-700 mb-2">一句话简介</Text>
                <TextInput value={description} onChangeText={setDescription} placeholder="简介..." multiline numberOfLines={2}
                  className="w-full px-4 py-3.5 rounded-2xl bg-gray-50 text-gray-800 mb-4 min-h-[64px]" />
              </ScrollView>

              <TouchableOpacity onPress={handleCreate} disabled={submitting}
                className="w-full py-4 rounded-2xl mt-3" style={{ backgroundColor: "#6366F1" }}>
                <Text className="text-white text-center font-bold text-base">{submitting ? "创建中..." : "创建作品"}</Text>
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
  const [actionBook, setActionBook] = useState<Book | null>(null);
  const [actionVisible, setActionVisible] = useState(false);
  const [editBook, setEditBook] = useState<Book | null>(null);
  const [editVisible, setEditVisible] = useState(false);
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
    } catch (e) { console.error("获取作品列表失败", e); }
  }, []);

  useFocusEffect(useCallback(() => { fetchBooks(); }, [fetchBooks]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await fetchBooks(); setRefreshing(false);
  }, [fetchBooks]);

  const handleDelete = async (book: Book) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/${book.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) fetchBooks();
    } catch (e) { Alert.alert("错误", "删除失败"); }
  };

  const handleLongPress = (book: Book) => {
    setActionBook(book);
    setActionVisible(true);
  };

  const handleEdit = (book: Book) => {
    setEditBook(book);
    setEditVisible(true);
  };

  return (
    <Screen>
      <ScrollView className="flex-1 px-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}>
        {/* 顶部统计 */}
        <View className="flex-row items-center justify-between mt-2 mb-5">
          <View>
            <Text className="text-2xl font-bold text-gray-800">作品</Text>
            <Text className="text-sm text-gray-500 mt-0.5">共 {pageInfo.total} 本 · {formatWordCount(pageInfo.totalWords)}字</Text>
          </View>
          <TouchableOpacity onPress={() => setModalVisible(true)}
            className="px-5 py-3 rounded-2xl flex-row items-center gap-2" style={{ backgroundColor: "#6366F1" }}>
            <FontAwesome6 name="plus" size={14} color="white" />
            <Text className="text-white text-sm font-bold">新书</Text>
          </TouchableOpacity>
        </View>

        {books.length === 0 ? (
          <View className="items-center py-20">
            <View className="w-20 h-20 rounded-full bg-primary-500/10 items-center justify-center mb-4">
              <FontAwesome6 name="book-open" size={32} color="#6366F1" />
            </View>
            <Text className="text-base text-gray-500 mb-2">还没有作品</Text>
            <TouchableOpacity onPress={() => setModalVisible(true)}
              className="px-6 py-3 rounded-xl" style={{ backgroundColor: "#6366F1" }}>
              <Text className="text-white font-medium">创建你的第一本书</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="gap-4 pb-4">
            {books.map((book) => (
              <BookCard key={book.id} book={book}
                onPress={() => router.push("/detail", { id: book.id })}
                onLongPress={() => handleLongPress(book)}
              />
            ))}
          </View>
        )}
        <View className="h-8" />
      </ScrollView>

      <NewBookModal visible={modalVisible} onClose={() => setModalVisible(false)} onCreated={fetchBooks} />
      <BookActionSheet visible={actionVisible} book={actionBook}
        onClose={() => setActionVisible(false)}
        onEdit={(book) => { setEditBook(book); setEditVisible(true); }}
        onDelete={handleDelete}
      />
      <EditBookModal visible={editVisible} book={editBook}
        onClose={() => { setEditVisible(false); setEditBook(null); }}
        onSaved={() => { setEditBook(null); fetchBooks(); }}
      />
    </Screen>
  );
}