import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  FlatList,
  TouchableWithoutFeedback,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome6 } from "@expo/vector-icons";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { useFocusEffect } from "expo-router";
import RNSSE from "react-native-sse";

const API_BASE =
  process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

// ===== Types =====
type CreationStep =
  | "welcome"
  | "guiding"
  | "config_summary"
  | "generating_outline"
  | "reviewing_outline"
  | "generating_details"
  | "reviewing_details"
  | "creating"
  | "completed";

type PageMode = "dashboard" | "creation";

interface OutlineVolume {
  id: string;
  title: string;
  summary: string;
  order: number;
  chapters: OutlineChapter[];
}

interface OutlineChapter {
  id: string;
  title: string;
  summary: string;
  wordCount?: number;
}

interface Book {
  id: string;
  title: string;
  category: string;
  description?: string;
  cover?: string;
  volumes: { chapters: unknown[] }[];
  chapters?: { title: string }[];
  createdAt: string;
}

// ===== Static Data =====
const SKILL_LIST = [
  { name: "赛道分析", icon: "A", desc: "分析爆款赛道与差异化定位" },
  { name: "篇幅规划", icon: "B", desc: "规划作品篇幅与更新节奏" },
  { name: "世界观构建", icon: "C", desc: "构建完整世界观底层规则" },
  { name: "人物设定", icon: "D", desc: "生成核心人物三维设定" },
  { name: "关系网构建", icon: "E", desc: "构建人物关系网络" },
  { name: "分卷大纲", icon: "F", desc: "生成三幕式分卷大纲" },
  { name: "单章大纲", icon: "G", desc: "生成单章精细化大纲" },
  { name: "正文生成", icon: "H", desc: "生成单章正文初稿" },
  { name: "场景优化", icon: "I", desc: "优化关键场景描写" },
  { name: "逻辑校验", icon: "J", desc: "检测逻辑漏洞与角色OOC" },
  { name: "批量润色", icon: "K", desc: "全文润色与文风统一" },
  { name: "爆款简介", icon: "L", desc: "生成爆款简介与章节标题" },
];


const GENRE_OPTIONS = [
  { label: "玄幻", icon: "dragon", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { label: "言情", icon: "heart", color: "bg-pink-50 text-pink-700 border-pink-200" },
  { label: "科幻", icon: "rocket", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { label: "悬疑", icon: "magnifying-glass", color: "bg-gray-50 text-gray-700 border-gray-200" },
  { label: "都市", icon: "building", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { label: "仙侠", icon: "wand-magic-sparkles", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { label: "历史", icon: "landmark", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { label: "轻小说", icon: "pen-fancy", color: "bg-rose-50 text-rose-700 border-rose-200" },
];

const AUDIENCE_OPTIONS = [
  { label: "男频", subtitle: "男性向", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { label: "女频", subtitle: "女性向", color: "bg-pink-50 text-pink-700 border-pink-200" },
  { label: "无差别", subtitle: "全民向", color: "bg-green-50 text-green-700 border-green-200" },
];

const PLATFORM_OPTIONS = [
  { label: "起点中文网", color: "bg-orange-50 text-orange-700 border-orange-200" },
  { label: "晋江文学城", color: "bg-pink-50 text-pink-700 border-pink-200" },
  { label: "番茄小说", color: "bg-red-50 text-red-700 border-red-200" },
  { label: "纵横中文网", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { label: "飞卢小说网", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { label: "创世中文网", color: "bg-green-50 text-green-700 border-green-200" },
];

const LENGTH_OPTIONS = [
  { label: "短篇", subtitle: "3-10万字", icon: "file-lines", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { label: "中篇", subtitle: "10-30万字", icon: "book", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { label: "长篇", subtitle: "30万字以上", icon: "book-open", color: "bg-purple-50 text-purple-700 border-purple-200" },
];

const INSPIRATION_CHIPS = [
  { text: "穿越到修仙世界获得签到系统" },
  { text: "重生回到高中改写人生" },
  { text: "末日废土上的异能觉醒" },
  { text: "在星际时代开了一家美食店" },
  { text: "我养的猫竟然是上古神兽" },
];

// ===== Helpers =====
function getChapterCount(book: Book): number {
  // try volumes first, then fallback to chapters
  if (Array.isArray(book.volumes)) {
    return book.volumes.reduce((sum, v) => sum + (Array.isArray(v.chapters) ? v.chapters.length : 0), 0);
  }
  if (Array.isArray(book.chapters)) {
    return book.chapters.length;
  }
  return 0;
}

function generateTempId(): string {
  return "tmp_" + Math.random().toString(36).substring(2, 9);
}

// ===== ChipSelect Component =====
function ChipSelect({
  options,
  selected,
  onSelect,
  multi = false,
}: {
  options: { label: string; subtitle?: string; icon?: string; color: string }[];
  selected: string | string[];
  onSelect: (val: string) => void;
  multi?: boolean;
}) {
  return (
    <View className="flex-row flex-wrap gap-2.5">
      {options.map((opt) => {
        const isSelected = multi
          ? (selected as string[]).includes(opt.label)
          : selected === opt.label;
        const [bg, text, border] = opt.color.split(" ");
        return (
          <TouchableOpacity
            key={opt.label}
            className={`px-4 py-2.5 rounded-xl border flex-row items-center gap-2 ${
              isSelected ? `${bg} ${border}` : "bg-white border-gray-200"
            }`}
            onPress={() => onSelect(opt.label)}
          >
            {opt.icon && (
              <FontAwesome6 name={opt.icon as any} size={14} solid={isSelected} color={isSelected ? "#6366F1" : "#94A3B8"} />
            )}
            <Text className={`text-sm ${isSelected ? "font-semibold text-indigo-600" : "text-gray-600"}`}>
              {opt.label}
            </Text>
            {opt.subtitle && (
              <Text className={`text-xs ${isSelected ? "text-indigo-400" : "text-gray-400"}`}>
                {opt.subtitle}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ===== ChapterEditorModal =====
function ChapterEditorModal({
  visible,
  title,
  summary,
  onTitleChange,
  onSummaryChange,
  onSave,
  onClose,
}: {
  visible: boolean;
  title: string;
  summary: string;
  onTitleChange: (t: string) => void;
  onSummaryChange: (s: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity className="flex-1 bg-black/50 justify-center px-5" activeOpacity={1} onPress={onClose}>
        <View className="bg-white rounded-2xl p-5" onStartShouldSetResponder={() => true}>
          <Text className="text-lg font-bold text-gray-900 mb-4">编辑章节</Text>
          <Text className="text-sm text-gray-500 mb-1">章节标题</Text>
          <TextInput
            className="bg-gray-50 rounded-xl px-4 py-3 text-gray-900 text-sm mb-3 border border-gray-200"
            value={title}
            onChangeText={onTitleChange}
            placeholder="输入章节标题"
            placeholderTextColor="#94A3B8"
          />
          <Text className="text-sm text-gray-500 mb-1">章节概要</Text>
          <TextInput
            className="bg-gray-50 rounded-xl px-4 py-3 text-gray-900 text-sm mb-5 border border-gray-200 min-h-[80px]"
            value={summary}
            onChangeText={onSummaryChange}
            multiline
            placeholder="输入章节概要"
            placeholderTextColor="#94A3B8"
          />
          <View className="flex-row gap-3">
            <TouchableOpacity className="flex-1 bg-gray-100 rounded-xl py-3 items-center" onPress={onClose}>
              <Text className="text-gray-600 font-medium">取消</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-1 bg-indigo-500 rounded-xl py-3 items-center" onPress={onSave}>
              <Text className="text-white font-medium">保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ===== ConfirmModal =====
function ConfirmModal({
  visible,
  title,
  message,
  confirmText = "确认",
  confirmColor = "bg-indigo-500",
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity className="flex-1 bg-black/50 justify-center px-8" activeOpacity={1} onPress={onClose}>
        <View className="bg-white rounded-2xl p-6 items-center" onStartShouldSetResponder={() => true}>
          <View className="w-12 h-12 rounded-full bg-indigo-50 items-center justify-center mb-3">
            <FontAwesome6 name="circle-info" size={22} color="#6366F1" />
          </View>
          <Text className="text-lg font-bold text-gray-900 mb-2">{title}</Text>
          <Text className="text-sm text-gray-500 text-center mb-5">{message}</Text>
          <View className="flex-row gap-3 w-full">
            <TouchableOpacity className="flex-1 bg-gray-100 rounded-xl py-3 items-center" onPress={onClose}>
              <Text className="text-gray-600 font-medium">取消</Text>
            </TouchableOpacity>
            <TouchableOpacity className={`flex-1 ${confirmColor} rounded-xl py-3 items-center`} onPress={onConfirm}>
              <Text className="text-white font-medium">{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ===== Skill Picker Modal =====
function SkillPickerModal({ visible, onSelect, onClose }: {
  visible: boolean;
  onSelect: (skill: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 justify-end bg-black/40">
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View className="bg-white rounded-t-3xl max-h-[70%] pb-8">
              <View className="items-center pt-4 pb-2">
                <View className="w-10 h-1 bg-gray-300 rounded-full" />
              </View>
              <Text className="text-lg font-bold text-gray-900 text-center mb-1">选择技能</Text>
              <Text className="text-sm text-gray-500 text-center mb-4">点击技能插入到输入框中</Text>
              <FlatList
                data={SKILL_LIST}
                numColumns={2}
                scrollEnabled
                className="px-4"
                columnWrapperStyle={{ gap: 10 }}
                contentContainerStyle={{ gap: 10 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    className="flex-1 bg-gray-50 rounded-xl p-3 border border-gray-100 active:bg-primary-50 active:border-primary-200"
                    onPress={() => {
                      onSelect(item.name);
                      onClose();
                    }}
                  >
                    <View className="flex-row items-center gap-2 mb-1">
                      <Text className="text-base">{item.icon}</Text>
                      <Text className="font-semibold text-gray-900 text-sm">{item.name}</Text>
                    </View>
                    <Text className="text-xs text-gray-500 leading-tight">{item.desc}</Text>
                  </TouchableOpacity>
                )}
                keyExtractor={(_, i) => String(i)}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ===== Main Home Component =====
export default function HomeScreen() {
  const router = useSafeRouter();
  const [pageMode, setPageMode] = useState<PageMode>("dashboard");

  // Dashboard state
  const [books, setBooks] = useState<Book[]>([]);
  const [expandedVolume, setExpandedVolume] = useState<string | null>(null);

  // Creation flow state (same as before)
  const [creationStep, setCreationStep] = useState<CreationStep>("welcome");
  const [inspiration, setInspiration] = useState("");
  const [configValues, setConfigValues] = useState({
    genre: "",
    audience: "",
    platform: "",
    length: "",
  });
  const [configStep, setConfigStep] = useState(0);
  const configSteps = [
    { title: "选择小说类型", key: "genre", options: GENRE_OPTIONS },
    { title: "选择受众定位", key: "audience", options: AUDIENCE_OPTIONS },
    { title: "选择目标平台", key: "platform", options: PLATFORM_OPTIONS },
    { title: "选择篇幅", key: "length", options: LENGTH_OPTIONS },
  ];
  const [loading, setLoading] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [bookDesc, setBookDesc] = useState("");
  const [editingVolumeIdx, setEditingVolumeIdx] = useState(-1);
  const [editingChapterIdx, setEditingChapterIdx] = useState(-1);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [characters, setCharacters] = useState("");
  const [worldBuilding, setWorldBuilding] = useState("");
  const [outlineVolumes, setOutlineVolumes] = useState<OutlineVolume[]>([]);
  const sseRef = useRef<any>(null);
  const confirmActionRef = useRef<(() => void) | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMsg, setConfirmMsg] = useState("");

  // ===== Dashboard =====
  const fetchBooks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing`);
      const json = await res.json();
      if (json.success) setBooks(json.data || []);
    } catch (e) {
      // silent
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBooks();
    }, [fetchBooks])
  );

  const totalChapters = books.reduce((sum, b) => sum + getChapterCount(b), 0);
  const totalWords = totalChapters * 2500; // estimated
  const recentBooks = [...books].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }).slice(0, 5);

  // ===== Creation Flow =====
  const startCreation = () => {
    setPageMode("creation");
    setCreationStep("welcome");
    setInspiration("");
    setConfigValues({ genre: "", audience: "", platform: "", length: "" });
    setConfigStep(0);
    setStreamContent("");
    setBookTitle("");
    setBookDesc("");
    setAnalysis("");
    setCharacters("");
    setWorldBuilding("");
    setOutlineVolumes([]);
  };

  const showConfirmDialog = (title: string, msg: string, action: () => void) => {
    setConfirmTitle(title);
    setConfirmMsg(msg);
    confirmActionRef.current = action;
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    setShowConfirm(false);
    if (confirmActionRef.current) {
      confirmActionRef.current();
      confirmActionRef.current = null;
    }
  };

  const handleInspirationSubmit = () => {
    if (!inspiration.trim()) return;
    setCreationStep("guiding");
    setConfigStep(0);
  };

  const handleConfigSelect = (key: string, value: string) => {
    setConfigValues((prev) => ({ ...prev, [key]: value }));
    if (configStep < configSteps.length - 1) {
      setConfigStep(configStep + 1);
    } else {
      // All config done -> show summary
      setCreationStep("config_summary");
    }
  };

  const handleGenerateOutline = async () => {
    setCreationStep("generating_outline");
    setStreamContent("");
    setAnalysis("");
    setCharacters("");
    setWorldBuilding("");
    setOutlineVolumes([]);

    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/generate-outline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspiration,
          genre: configValues.genre,
          audience: configValues.audience,
          platform: configValues.platform,
          length: configValues.length,
        }),
      });

      const sse = new RNSSE(res.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspiration,
          genre: configValues.genre,
          audience: configValues.audience,
          platform: configValues.platform,
          length: configValues.length,
        }),
      });
      sseRef.current = sse;
      let fullContent = "";

      sse.addEventListener("message", (event: any) => {
        if (event.data === "[DONE]") {
          sse.close();
          setCreationStep("reviewing_outline");
          setLoading(false);
          return;
        }
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.content) {
            fullContent += parsed.content;
            setStreamContent(fullContent);
          }
          if (parsed.analysis) {
            setAnalysis(parsed.analysis);
          }
          if (parsed.characters) {
            setCharacters(parsed.characters);
          }
          if (parsed.worldBuilding) {
            setWorldBuilding(parsed.worldBuilding);
          }
          if (parsed.volumes && Array.isArray(parsed.volumes)) {
            setOutlineVolumes(parsed.volumes);
          }
        } catch (e) {
          fullContent += event.data;
          setStreamContent(fullContent);
        }
      });
    } catch (e) {
      Alert.alert("错误", "大纲生成失败，请重试");
      setCreationStep("config_summary");
    }
  };

  const handleGenerateDetails = async () => {
    setCreationStep("generating_details");
    setStreamContent("");
    setBookTitle("");
    setBookDesc("");

    const volumesForPrompt = outlineVolumes.map((v) => ({
      title: v.title,
      summary: v.summary,
      chapters: v.chapters.map((c) => ({ title: c.title })),
    }));

    try {
      const sse = new RNSSE(`${API_BASE}/api/v1/writing/generate-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspiration,
          genre: configValues.genre,
          chapters: volumesForPrompt,
        }),
      });
      sseRef.current = sse;

      sse.addEventListener("message", (event: any) => {
        if (event.data === "[DONE]") {
          sse.close();
          setCreationStep("reviewing_details");
          setLoading(false);
          return;
        }
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.content) {
            setStreamContent((prev) => prev + parsed.content);
          }
          if (parsed.title) setBookTitle(parsed.title);
          if (parsed.description) setBookDesc(parsed.description);
        } catch (e) {
          setStreamContent((prev) => prev + event.data);
        }
      });
    } catch (e) {
      Alert.alert("错误", "详情生成失败，请重试");
      setCreationStep("reviewing_outline");
    }
  };

  const handleCreateBook = async () => {
    setCreationStep("creating");

    const volumesForCreate = outlineVolumes.map((v, vi) => ({
      id: v.id || "v_" + generateTempId(),
      title: v.title,
      order: vi + 1,
      chapters: v.chapters.map((c, ci) => ({
        id: c.id || "c_" + generateTempId(),
        title: c.title,
        content: "",
        summary: c.summary || "",
        wordCount: 0,
        order: ci + 1,
        volumeId: v.id || "v_" + generateTempId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
    }));

    try {
      const res = await fetch(`${API_BASE}/api/v1/writing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: bookTitle || inspiration.substring(0, 20),
          category: configValues.genre || "玄幻",
          description: bookDesc || inspiration,
          volumes: volumesForCreate,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCreationStep("completed");
        await fetchBooks();
      } else {
        Alert.alert("错误", json.error || "创建失败");
        setCreationStep("reviewing_details");
      }
    } catch (e) {
      Alert.alert("错误", "网络错误，请重试");
      setCreationStep("reviewing_details");
    }
  };

  const handleEditChapter = (vIdx: number, cIdx: number) => {
    const chapter = outlineVolumes[vIdx].chapters[cIdx];
    setEditingVolumeIdx(vIdx);
    setEditingChapterIdx(cIdx);
    setEditTitle(chapter.title);
    setEditSummary(chapter.summary || "");
  };

  const saveChapter = () => {
    if (editingVolumeIdx >= 0 && editingChapterIdx >= 0) {
      const newVolumes = [...outlineVolumes];
      newVolumes[editingVolumeIdx] = {
        ...newVolumes[editingVolumeIdx],
        chapters: [...newVolumes[editingVolumeIdx].chapters],
      };
      newVolumes[editingVolumeIdx].chapters[editingChapterIdx] = {
        ...newVolumes[editingVolumeIdx].chapters[editingChapterIdx],
        title: editTitle,
        summary: editSummary,
      };
      setOutlineVolumes(newVolumes);
    }
    setEditingVolumeIdx(-1);
    setEditingChapterIdx(-1);
  };

  // ===== Render: Dashboard =====
  const renderDashboard = () => (
    <ScrollView className="flex-1 bg-gray-50" showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View className="bg-indigo-500 pt-12 pb-6 px-5 rounded-b-[32px]">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <View className="w-9 h-9 rounded-xl bg-white/20 items-center justify-center">
              <FontAwesome6 name="pen-fancy" size={16} color="white" />
            </View>
            <Text className="text-xl font-bold text-white">创作台</Text>
          </View>
          <TouchableOpacity className="w-9 h-9 rounded-xl bg-white/20 items-center justify-center">
            <FontAwesome6 name="sliders" size={15} color="white" />
          </TouchableOpacity>
        </View>
        {/* Stats */}
        <View className="flex-row justify-between mt-1">
          <View className="items-center flex-1">
            <Text className="text-2xl font-bold text-white">{books.length}</Text>
            <Text className="text-xs text-white/70 mt-0.5">作品数</Text>
          </View>
          <View className="w-px bg-white/20" />
          <View className="items-center flex-1">
            <Text className="text-2xl font-bold text-white">{totalWords > 10000 ? `${(totalWords / 10000).toFixed(1)}万` : totalWords}</Text>
            <Text className="text-xs text-white/70 mt-0.5">总字数</Text>
          </View>
          <View className="w-px bg-white/20" />
          <View className="items-center flex-1">
            <Text className="text-2xl font-bold text-white">{totalChapters}</Text>
            <Text className="text-xs text-white/70 mt-0.5">总章节</Text>
          </View>
        </View>
      </View>

      <View className="px-5 pt-4 pb-8">
        {/* Quick Create */}
        <TouchableOpacity
          className="bg-indigo-500 rounded-2xl p-5 shadow-lg flex-row items-center justify-between"
          style={{ shadowColor: "#6366F1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 }}
          onPress={startCreation}
        >
          <View className="flex-1">
            <Text className="text-white text-lg font-bold">开始创作新作品</Text>
            <Text className="text-white/70 text-sm mt-1">输入灵感，AI 帮你完成从大纲到成书</Text>
          </View>
          <View className="w-11 h-11 rounded-xl bg-white/20 items-center justify-center">
            <FontAwesome6 name="arrow-right" size={16} color="white" />
          </View>
        </TouchableOpacity>

        {/* Active Projects */}
        {recentBooks.length > 0 && (
          <View className="mt-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-bold text-gray-900">进行中作品</Text>
              <TouchableOpacity onPress={() => router.push("/works")}>
                <Text className="text-xs text-indigo-500">查看全部</Text>
              </TouchableOpacity>
            </View>
            <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 px-5">
              <View className="flex-row gap-3">
                {recentBooks.map((book) => {
                  const chCount = getChapterCount(book);
                  const progress = chCount > 0 ? Math.min(chCount / 20, 1) : 0;
                  return (
                    <TouchableOpacity
                      key={book.id}
                      className="bg-white rounded-2xl p-4 shadow-sm w-40"
                      onPress={() => router.push(`/detail`, { id: book.id })}
                    >
                      <View className="w-full h-20 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 items-center justify-center mb-3">
                        <FontAwesome6 name="book" size={24} color="#6366F1" />
                      </View>
                      <Text className="text-sm font-semibold text-gray-900 mb-1" numberOfLines={1}>
                        {book.title}
                      </Text>
                      <Text className="text-xs text-gray-400 mb-2">{chCount}章</Text>
                      <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <View className="h-full bg-indigo-500 rounded-full" style={{ width: `${progress * 100}%` }} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            </View>
          </View>
        )}

        

      </View>
    </ScrollView>
  );

  // ===== Render: Welcome =====
  const renderWelcome = () => (
    <View className="flex-1 pt-12 px-5">
      <View className="items-center mt-8 mb-6">
        <View className="w-16 h-16 rounded-2xl bg-indigo-50 items-center justify-center mb-4">
          <FontAwesome6 name="pen-fancy" size={28} color="#6366F1" />
        </View>
        <Text className="text-xl font-bold text-gray-900">AI 创作助手</Text>
        <Text className="text-sm text-gray-400 mt-1">用灵感创作你的世界</Text>
      </View>

      <View className="bg-white rounded-2xl p-1 shadow-sm mb-4 border border-gray-100">
        <TextInput
          className="px-4 py-4 text-gray-900 text-base min-h-[52px]"
          value={inspiration}
          onChangeText={setInspiration}
          placeholder="写下你的小说灵感..."
          placeholderTextColor="#94A3B8"
          multiline
        />
        <View className="px-4 pb-3 flex-row items-center justify-between">
          <View className="flex-row gap-2">
            <TouchableOpacity onPress={() => setShowSkillPicker(true)} className="bg-purple-50 rounded-lg px-3 py-1.5 flex-row items-center gap-1.5">
              <FontAwesome6 name="at" size={12} color="#9333EA" />
              <Text className="text-xs text-purple-600 font-medium">技能</Text>
            </TouchableOpacity>
            <TouchableOpacity className="bg-emerald-50 rounded-lg px-3 py-1.5 flex-row items-center gap-1.5">
              <FontAwesome6 name="file" size={12} color="#059669" />
              <Text className="text-xs text-emerald-600 font-medium">文件</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            className="w-9 h-9 rounded-full bg-indigo-500 items-center justify-center"
            onPress={handleInspirationSubmit}
          >
            <FontAwesome6 name="arrow-up" size={14} color="white" solid />
          </TouchableOpacity>
        </View>
      </View>

      {/* Inspiration chips */}
      <View className="flex-row flex-wrap gap-2 mb-4">
        {INSPIRATION_CHIPS.map((chip, i) => (
          <TouchableOpacity
            key={i}
            className="bg-white rounded-full px-4 py-2 border border-gray-200"
            onPress={() => setInspiration(chip.text)}
          >
            <Text className="text-xs text-gray-500">{chip.text}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex-row items-start gap-3">
        <FontAwesome6 name="lightbulb" size={18} color="#D97706" solid />
        <Text className="text-sm text-amber-800 flex-1">
          试试这样说：{'\u201C'}我想写一个穿越到修仙世界获得签到系统的故事{'\u201D'} 或 {'\u201C'}写一个末日废土异能觉醒的小说{'\u201D'}
        </Text>
      </View>
    </View>
  );

  // ===== Render: Config Summary =====
  const renderConfigSummary = () => (
    <View className="flex-1 pt-12 px-5">
      <Text className="text-lg font-bold text-gray-900 mb-1">确认创作设定</Text>
      <Text className="text-sm text-gray-400 mb-5">请确认以下创作方向，AI 将据此生成大纲</Text>

      <View className="bg-white rounded-2xl p-5 shadow-sm mb-4 border border-gray-100">
        <View className="flex-row items-start gap-3 mb-4">
          <View className="w-8 h-8 rounded-lg bg-indigo-50 items-center justify-center mt-0.5">
            <FontAwesome6 name="lightbulb" size={16} color="#6366F1" />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-400 mb-0.5">灵感</Text>
            <Text className="text-sm text-gray-900">{inspiration}</Text>
          </View>
        </View>
        <View className="h-px bg-gray-100 mb-4" />
        {configSteps.map((step) => (
          <View key={step.key} className="flex-row items-center gap-3 mb-3">
            <Text className="text-xs text-gray-400 w-16">{step.title}</Text>
            <Text className="text-sm font-medium text-indigo-600">
              {configValues[step.key as keyof typeof configValues] || "未选择"}
            </Text>
          </View>
        ))}
      </View>

      <View className="flex-row gap-3">
        <TouchableOpacity
          className="flex-1 bg-gray-100 rounded-xl py-3.5 items-center"
          onPress={() => { setCreationStep("guiding"); setConfigStep(0); }}
        >
          <Text className="text-gray-600 font-medium">修改设定</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-indigo-500 rounded-xl py-3.5 items-center"
          onPress={handleGenerateOutline}
        >
          <Text className="text-white font-medium">开始生成大纲</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ===== Render: Config Guiding =====
  const renderGuiding = () => {
    const step = configSteps[configStep];
    const currentVal = configValues[step.key as keyof typeof configValues];
    return (
      <View className="flex-1 pt-12 px-5">
        {/* Step indicator */}
        <View className="flex-row items-center gap-2 mb-6">
          {configSteps.map((s, i) => (
            <View key={i} className={`flex-1 h-1 rounded-full ${i <= configStep ? "bg-indigo-500" : "bg-gray-200"}`} />
          ))}
        </View>

        <Text className="text-lg font-bold text-gray-900 mb-1">{step.title}</Text>
        <Text className="text-sm text-gray-400 mb-5">{configStep === 0 ? "选择你想创作的题材方向" : configStep === 1 ? "确定目标读者群体" : configStep === 2 ? "选择主要发布平台" : "规划故事的篇幅长度"}</Text>

        <View className="flex-row flex-wrap gap-2.5">
          {renderConfigOptions(step)}
        </View>

        {/* AI对话区域 - 展示AI的引导信息 */}
        {configStep === 0 && (
          <View className="mt-6 bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
            <View className="flex-row items-center gap-2 mb-2">
              <View className="w-6 h-6 rounded-full bg-indigo-100 items-center justify-center">
                <FontAwesome6 name="robot" size={12} color="#6366F1" />
              </View>
              <Text className="text-sm font-medium text-indigo-700">AI 助手</Text>
            </View>
            <Text className="text-sm text-indigo-600 leading-5">
              不同类型的小说有不同的读者群体和创作特点。选择与你的灵感最匹配的类型，这样我能为你生成更精准的大纲。
            </Text>
          </View>
        )}
      </View>
    );
  };

  // ===== Render: Options for config step =====
  const renderConfigOptions = (step: typeof configSteps[0]) => {
    return step.options.map((opt) => {
      const isSelected = configValues[step.key as keyof typeof configValues] === opt.label;
      const [bg, text, border] = opt.color ? opt.color.split(" ") : ["bg-white", "text-gray-600", "border-gray-200"];
      const optAny = opt as any;
      return (
        <TouchableOpacity
          key={opt.label}
          className={`px-4 py-3 rounded-xl border flex-row items-center gap-2 ${
            isSelected ? `${bg} ${border}` : "bg-white border-gray-200"
          }`}
          onPress={() => handleConfigSelect(step.key, opt.label)}
        >
          {optAny.icon && (
            <FontAwesome6 name={optAny.icon as any} size={14} solid={isSelected} color={isSelected ? "#6366F1" : "#94A3B8"} />
          )}
          <Text className={`text-sm ${isSelected ? "font-semibold text-indigo-600" : "text-gray-600"}`}>
            {opt.label}
          </Text>
          {optAny.subtitle && (
            <Text className={`text-xs ${isSelected ? "text-indigo-400" : "text-gray-400"}`}>
              {optAny.subtitle}
            </Text>
          )}
        </TouchableOpacity>
      );
    });
  };

  // ===== Render: Loading / Streaming =====
  const renderGenerating = (title: string) => (
    <View className="flex-1 pt-12 px-5">
      <View className="flex-1 items-center justify-center">
        <View className="w-16 h-16 rounded-2xl bg-indigo-50 items-center justify-center mb-4">
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
        <Text className="text-lg font-bold text-gray-900 mb-2">{title}</Text>
        <Text className="text-sm text-gray-400 text-center mb-4">AI 正在思考创作中...</Text>
        {streamContent.length > 0 && (
          <View className="w-full bg-white rounded-2xl p-4 border border-gray-100 max-h-60">
            <ScrollView>
              <Text className="text-sm text-gray-600 leading-5">{streamContent}</Text>
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );

  // ===== Render: Review Outline =====
  const renderReviewOutline = () => (
    <View className="flex-1 pt-12">
      <View className="px-5 mb-4">
        <Text className="text-lg font-bold text-gray-900 mb-1">大纲预览</Text>
        <Text className="text-sm text-gray-400">包含 {outlineVolumes.length} 卷, {outlineVolumes.reduce((s, v) => s + v.chapters.length, 0)} 章</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {/* Analysis */}
        {analysis ? (
          <View className="bg-indigo-50 rounded-2xl p-4 mb-3 border border-indigo-100">
            <Text className="text-sm font-semibold text-indigo-700 mb-1">AI 分析</Text>
            <Text className="text-sm text-indigo-600 leading-5">{analysis}</Text>
          </View>
        ) : null}

        {/* Characters */}
        {characters ? (
          <View className="bg-amber-50 rounded-2xl p-4 mb-3 border border-amber-100">
            <Text className="text-sm font-semibold text-amber-700 mb-1">角色设定</Text>
            <Text className="text-sm text-amber-600 leading-5">{characters}</Text>
          </View>
        ) : null}

        {/* World Building */}
        {worldBuilding ? (
          <View className="bg-emerald-50 rounded-2xl p-4 mb-3 border border-emerald-100">
            <Text className="text-sm font-semibold text-emerald-700 mb-1">世界观</Text>
            <Text className="text-sm text-emerald-600 leading-5">{worldBuilding}</Text>
          </View>
        ) : null}

        {/* Volumes */}
        {outlineVolumes.map((volume, vIdx) => (
          <View key={volume.id} className="bg-white rounded-2xl mb-3 border border-gray-100 overflow-hidden">
            <TouchableOpacity
              className="flex-row items-center justify-between px-4 py-3.5"
              onPress={() => setExpandedVolume(expandedVolume === volume.id ? null : volume.id)}
            >
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900">
                  {volume.title}
                </Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  {volume.chapters.length}章 · {volume.summary ? volume.summary.substring(0, 30) + "..." : ""}
                </Text>
              </View>
              <FontAwesome6
                name={expandedVolume === volume.id ? "chevron-up" : "chevron-down"}
                size={12}
                color="#94A3B8"
              />
            </TouchableOpacity>

            {expandedVolume === volume.id && (
              <View className="border-t border-gray-100 px-4 pb-3 pt-2">
                {volume.summary ? (
                  <Text className="text-xs text-gray-500 mb-3 leading-5">{volume.summary}</Text>
                ) : null}
                {volume.chapters.map((chapter, cIdx) => (
                  <TouchableOpacity
                    key={chapter.id}
                    className="flex-row items-center py-2.5 border-b border-gray-50 last:border-b-0"
                    onPress={() => handleEditChapter(vIdx, cIdx)}
                  >
                    <View className="w-6 h-6 rounded-full bg-gray-100 items-center justify-center mr-3">
                      <Text className="text-xs font-medium text-gray-500">{cIdx + 1}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm text-gray-800">{chapter.title}</Text>
                      {chapter.summary ? (
                        <Text className="text-xs text-gray-400 mt-0.5">{chapter.summary}</Text>
                      ) : null}
                    </View>
                    <FontAwesome6 name="pen" size={10} color="#CBD5E1" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ))}

        <View className="flex-row gap-3 pb-8 pt-2">
          <TouchableOpacity
            className="flex-1 bg-gray-100 rounded-xl py-3.5 items-center"
            onPress={() => { setCreationStep("config_summary"); }}
          >
            <Text className="text-gray-600 font-medium">返回修改</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-indigo-500 rounded-xl py-3.5 items-center"
            onPress={handleGenerateDetails}
          >
            <Text className="text-white font-medium">确认，下一步</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Chapter Editor Modal */}
      <ChapterEditorModal
        visible={editingVolumeIdx >= 0 && editingChapterIdx >= 0}
        title={editTitle}
        summary={editSummary}
        onTitleChange={setEditTitle}
        onSummaryChange={setEditSummary}
        onSave={saveChapter}
        onClose={() => { setEditingVolumeIdx(-1); setEditingChapterIdx(-1); }}
      />
    </View>
  );

  // ===== Render: Review Details =====
  const renderReviewDetails = () => (
    <View className="flex-1 pt-12 px-5">
      <Text className="text-lg font-bold text-gray-900 mb-1">确认作品详情</Text>
      <Text className="text-sm text-gray-400 mb-5">可手动修改书名和简介</Text>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Book Title */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1.5">作品名称</Text>
          <TextInput
            className="bg-white border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 text-base"
            value={bookTitle}
            onChangeText={setBookTitle}
            placeholder="输入书名"
            placeholderTextColor="#94A3B8"
          />
        </View>

        {/* Description */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1.5">作品简介</Text>
          <TextInput
            className="bg-white border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 text-sm min-h-[120px]"
            value={bookDesc}
            onChangeText={setBookDesc}
            multiline
            placeholder="输入简介"
            placeholderTextColor="#94A3B8"
          />
        </View>

        {/* Summary */}
        <View className="bg-gray-50 rounded-2xl p-4 mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-2">作品概览</Text>
          <View className="flex-row justify-between">
            <View className="items-center">
              <Text className="text-lg font-bold text-gray-900">{outlineVolumes.length}</Text>
              <Text className="text-xs text-gray-400">分卷</Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold text-gray-900">{outlineVolumes.reduce((s, v) => s + v.chapters.length, 0)}</Text>
              <Text className="text-xs text-gray-400">章节</Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold text-gray-900">{configValues.genre || "玄幻"}</Text>
              <Text className="text-xs text-gray-400">类型</Text>
            </View>
          </View>
        </View>

        {/* Cover placeholder */}
        <View className="bg-white rounded-2xl border border-dashed border-gray-300 p-6 items-center mb-6">
          <View className="w-12 h-12 rounded-xl bg-gray-100 items-center justify-center mb-2">
            <FontAwesome6 name="image" size={20} color="#94A3B8" />
          </View>
          <Text className="text-sm text-gray-400">封面将自动生成</Text>
        </View>
      </ScrollView>

      <View className="flex-row gap-3 pb-4 pt-2">
        <TouchableOpacity
          className="flex-1 bg-gray-100 rounded-xl py-3.5 items-center"
          onPress={() => { setCreationStep("reviewing_outline"); }}
        >
          <Text className="text-gray-600 font-medium">上一步</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-indigo-500 rounded-xl py-3.5 items-center"
          onPress={() => showConfirmDialog("创建作品", `确定创建《${bookTitle || "未命名"}》？将包含 ${outlineVolumes.reduce((s, v) => s + v.chapters.length, 0)} 个章节。`, handleCreateBook)}
        >
          <Text className="text-white font-medium">创建作品</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ===== Render: Completed =====
  const renderCompleted = () => {
    const latestBook = recentBooks[0];
    return (
      <View className="flex-1 pt-12 px-5 items-center justify-center">
        <View className="w-20 h-20 rounded-full bg-green-50 items-center justify-center mb-4">
          <FontAwesome6 name="circle-check" size={36} color="#10B981" solid />
        </View>
        <Text className="text-xl font-bold text-gray-900 mb-2">创作成功！</Text>
        <Text className="text-sm text-gray-400 text-center mb-6">
          《{bookTitle || inspiration.substring(0, 20)}》已创建，共 {outlineVolumes.reduce((s, v) => s + v.chapters.length, 0)} 章
        </Text>
        <View className="flex-row gap-3">
          <TouchableOpacity
            className="bg-indigo-500 rounded-xl px-6 py-3.5 items-center"
            onPress={() => latestBook ? router.push(`/detail`, { id: latestBook.id }) : null}
          >
            <Text className="text-white font-medium">查看作品</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-gray-100 rounded-xl px-6 py-3.5 items-center"
            onPress={startCreation}
          >
            <Text className="text-gray-600 font-medium">继续创作</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ===== Main Render =====
  const renderContent = () => {
    if (pageMode === "dashboard") {
      return renderDashboard();
    }

    // Creation flow
    return (
      <View className="flex-1 bg-white">
        {/* Top bar for creation mode */}
        <View className="flex-row items-center justify-between px-5 pt-12 pb-3 bg-white border-b border-gray-100">
          <TouchableOpacity
            className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center"
            onPress={() => {
              sseRef.current?.close();
              setPageMode("dashboard");
            }}
          >
            <FontAwesome6 name="xmark" size={16} color="#64748B" />
          </TouchableOpacity>
          <View className="flex-row items-center gap-1.5">
            {["welcome", "guiding", "config_summary", "generating_outline", "reviewing_outline", "generating_details", "reviewing_details", "creating", "completed"].indexOf(creationStep) >= 0 && (
              <>
                <View className={`w-2 h-2 rounded-full ${creationStep === "welcome" || creationStep === "guiding" || creationStep === "config_summary" ? "bg-indigo-500" : "bg-gray-300"}`} />
                <View className={`w-2 h-2 rounded-full ${creationStep === "generating_outline" || creationStep === "reviewing_outline" ? "bg-indigo-500" : "bg-gray-300"}`} />
                <View className={`w-2 h-2 rounded-full ${creationStep === "generating_details" || creationStep === "reviewing_details" || creationStep === "creating" || creationStep === "completed" ? "bg-indigo-500" : "bg-gray-300"}`} />
              </>
            )}
          </View>
          <View className="w-9" />
        </View>

        {creationStep === "welcome" && renderWelcome()}
        {creationStep === "guiding" && renderGuiding()}
        {creationStep === "config_summary" && renderConfigSummary()}
        {(creationStep === "generating_outline") && renderGenerating("AI 正在生成大纲...")}
        {(creationStep === "generating_details") && renderGenerating("AI 正在生成作品详情...")}
        {(creationStep === "creating") && renderGenerating("正在创建作品...")}
        {creationStep === "reviewing_outline" && renderReviewOutline()}
        {creationStep === "reviewing_details" && renderReviewDetails()}
        {creationStep === "completed" && renderCompleted()}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      {renderContent()}
      <ConfirmModal
        visible={showConfirm}
        title={confirmTitle}
        message={confirmMsg}
        confirmText="确认创建"
        onConfirm={handleConfirm}
        onClose={() => setShowConfirm(false)}
      />
      <SkillPickerModal
        visible={showSkillPicker}
        onSelect={(skill) => setInspiration(`@${skill} `)}
        onClose={() => setShowSkillPicker(false)}
      />
    </View>
  );
}