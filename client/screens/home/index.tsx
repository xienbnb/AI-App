import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
  FlatList,
  TouchableWithoutFeedback,
} from "react-native";
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

interface ChatMessage {
  role: "ai" | "user";
  content: string;
  step?: CreationStep;
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
  "穿越到修仙世界获得签到系统",
  "重生回到高中改写人生",
  "末日废土上的异能觉醒",
  "在星际时代开了一家美食店",
  "我养的猫竟然是上古神兽",
];

// ===== Helpers =====
function getChapterCount(book: Book): number {
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
                  className="flex-1 bg-gray-50 rounded-xl p-3 border border-gray-100"
                  onPress={() => { onSelect(item.name); onClose(); }}
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
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ===== ConfirmModal =====
function ConfirmModal({ visible, title, message, confirmText = "确认", confirmColor = "bg-indigo-500", onConfirm, onClose }: {
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

// ===== ChapterEditorModal =====
function ChapterEditorModal({ visible, title, summary, onTitleChange, onSummaryChange, onSave, onClose }: {
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

// ===== Main Home Component =====
export default function HomeScreen() {
  const router = useSafeRouter();
  const scrollRef = useRef<ScrollView>(null);

  // Creation flow state
  const [creationStep, setCreationStep] = useState<CreationStep>("welcome");
  const [inspiration, setInspiration] = useState("");
  const [configValues, setConfigValues] = useState({ genre: "", audience: "", platform: "", length: "" });
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
  const [expandedVolume, setExpandedVolume] = useState<string | null>(null);
  const sseRef = useRef<any>(null);
  const confirmActionRef = useRef<(() => void) | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMsg, setConfirmMsg] = useState("");

  // Chat messages
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", content: "你好！我是你的 AI 创作助手。\n\n写下你的小说灵感，我来帮你从大纲到成书，完成整个创作过程。", step: "welcome" },
  ]);

  const [books, setBooks] = useState<Book[]>([]);
  const fetchBooks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing`);
      const json = await res.json();
      if (json.success) setBooks(json.data || []);
    } catch (e) { /* silent */ }
  }, []);

  useFocusEffect(useCallback(() => { fetchBooks(); }, [fetchBooks]));

  const addMessage = (role: "ai" | "user", content: string, step?: CreationStep) => {
    setMessages((prev) => [...prev, { role, content, step }]);
  };

  const resetAll = () => {
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
    setExpandedVolume(null);
    setMessages([
      { role: "ai", content: "你好！我是你的 AI 创作助手。\n\n写下你的小说灵感，我来帮你从大纲到成书，完成整个创作过程。", step: "welcome" },
    ]);
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

  // ===== Step Handlers =====
  const handleInspirationSubmit = () => {
    if (!inspiration.trim()) return;
    addMessage("user", inspiration);
    setInspiration("");
    setCreationStep("guiding");
    setConfigStep(0);
    addMessage("ai", "好的！让我来帮你完善创作设定。\n\n**第一步：选择小说类型**\n请点击下方选择你的创作方向：", "guiding");
  };

  const handleConfigSelect = (key: string, value: string) => {
    setConfigValues((prev) => ({ ...prev, [key]: value }));
    if (configStep < configSteps.length - 1) {
      const nextStep = configStep + 1;
      const msgs = [
        "好的！让我来帮你完善创作设定。\n\n**第一步：选择小说类型**\n请点击下方选择你的创作方向：",
        "**第二步：选择受众定位**\n确定目标读者群体：",
        "**第三步：选择目标平台**\n选择主要发布平台：",
        "**第四步：选择篇幅**\n规划故事的篇幅长度：",
      ];
      setConfigStep(nextStep);
      addMessage("ai", "\n" + msgs[nextStep], "guiding");
    } else {
      setCreationStep("config_summary");
      const summary = [
        "**创作设定确认**\n",
        `类型：${configValues.genre}`,
        `受众：${value}`,
        `平台：${configValues.platform}`,
        `篇幅：${configValues.length}`,
      ].join("\n");
      addMessage("ai", summary, "config_summary");
    }
  };

  const handleGenerateOutline = async () => {
    setCreationStep("generating_outline");
    setStreamContent("");
    setAnalysis("");
    setCharacters("");
    setWorldBuilding("");
    setOutlineVolumes([]);
    addMessage("ai", "**AI 正在分析你的灵感并生成大纲...**\n\n这可能需要 15-30 秒，请稍候...", "generating_outline");

    try {
      const sse = new RNSSE(`${API_BASE}/api/v1/writing/generate-outline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspiration: messages.find((m) => m.role === "user")?.content || inspiration,
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
          addMessage("ai", "**大纲生成完成！**\n\n请查看下方的大纲内容，可以点击章节编辑修改，满意后点击「确认」继续。", "reviewing_outline");
          return;
        }
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.content) {
            fullContent += parsed.content;
            setStreamContent(fullContent);
          }
          if (parsed.analysis) setAnalysis(parsed.analysis);
          if (parsed.characters) setCharacters(parsed.characters);
          if (parsed.worldBuilding) setWorldBuilding(parsed.worldBuilding);
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
    addMessage("ai", "**正在生成作品详情...**\n\nAI 正在为你构思书名、简介和完整内容...", "generating_details");

    const volumesForPrompt = outlineVolumes.map((v) => ({
      title: v.title, summary: v.summary,
      chapters: v.chapters.map((c) => ({ title: c.title })),
    }));

    try {
      const sse = new RNSSE(`${API_BASE}/api/v1/writing/generate-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspiration: messages.find((m) => m.role === "user")?.content || inspiration,
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
          addMessage("ai", "**作品详情已生成！**\n\n请查看下方的书名和简介，可以手动修改，满意后点击「创建作品」。", "reviewing_details");
          return;
        }
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.content) setStreamContent((prev) => prev + parsed.content);
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
        addMessage("ai", `**创作成功！**\n\n《${bookTitle || "未命名"}》已创建，共 ${outlineVolumes.reduce((s, v) => s + v.chapters.length, 0)} 章！\n\n你可以继续创作新作品，或前往「作品」页面查看。`, "completed");
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
      newVolumes[editingVolumeIdx] = { ...newVolumes[editingVolumeIdx], chapters: [...newVolumes[editingVolumeIdx].chapters] };
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

  const renderContent = () => {
    return (
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="bg-indigo-500 pt-12 pb-3 px-5 rounded-b-[24px]">
          <View className="flex-row items-center gap-2">
            <View className="w-8 h-8 rounded-xl bg-white/20 items-center justify-center">
              <FontAwesome6 name="pen-fancy" size={14} color="white" />
            </View>
            <Text className="text-lg font-bold text-white">AI 创作助手</Text>
          </View>
        </View>

        {/* Messages Area */}
        <ScrollView
          ref={scrollRef}
          className="flex-1 px-4 pt-4"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((msg, i) => (
            <View key={i} className={`mb-4 ${msg.role === "user" ? "items-end" : "items-start"}`}>
              {/* AI message */}
              {msg.role === "ai" && (
                <View className="flex-row gap-2 max-w-[85%]">
                  <View className="w-8 h-8 rounded-full bg-indigo-100 items-center justify-center mt-1">
                    <FontAwesome6 name="robot" size={14} color="#6366F1" />
                  </View>
                  <View className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3">
                    <Text className="text-sm text-gray-800 leading-6">{msg.content}</Text>
                  </View>
                </View>
              )}

              {/* User message */}
              {msg.role === "user" && (
                <View className="bg-indigo-500 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
                  <Text className="text-sm text-white leading-6">{msg.content}</Text>
                </View>
              )}
            </View>
          ))}

          {/* ===== Guiding Options ===== */}
          {creationStep === "guiding" && (
            <View className="mb-4 pl-10">
              <Text className="text-sm font-medium text-gray-700 mb-2">{configSteps[configStep].title}</Text>
              <View className="flex-row flex-wrap gap-2">
                {configSteps[configStep].options.map((opt) => {
                  const isSelected = configValues[configSteps[configStep].key as keyof typeof configValues] === opt.label;
                  const [bg, textCls, border] = opt.color.split(" ");
                  return (
                    <TouchableOpacity
                      key={opt.label}
                      className={`px-4 py-2.5 rounded-xl border flex-row items-center gap-2 ${isSelected ? `${bg} ${border}` : "bg-white border-gray-200"}`}
                      onPress={() => handleConfigSelect(configSteps[configStep].key, opt.label)}
                    >
                      {(opt as any).icon && (
                        <FontAwesome6 name={(opt as any).icon as any} size={14} solid={isSelected} color={isSelected ? "#6366F1" : "#94A3B8"} />
                      )}
                      <Text className={`text-sm ${isSelected ? "font-semibold text-indigo-600" : "text-gray-600"}`}>{opt.label}</Text>
                      {(opt as any).subtitle && (
                        <Text className={`text-xs ${isSelected ? "text-indigo-400" : "text-gray-400"}`}>{(opt as any).subtitle}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ===== Config Summary Actions ===== */}
          {creationStep === "config_summary" && (
            <View className="mb-4 pl-10 flex-row gap-3">
              <TouchableOpacity className="flex-1 bg-gray-100 rounded-xl py-2.5 items-center" onPress={() => { setCreationStep("guiding"); setConfigStep(0); }}>
                <Text className="text-sm text-gray-600 font-medium">修改设定</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 bg-indigo-500 rounded-xl py-2.5 items-center" onPress={handleGenerateOutline}>
                <Text className="text-sm text-white font-medium">开始生成大纲</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ===== Generating Outline (streaming) ===== */}
          {(creationStep === "generating_outline" || creationStep === "generating_details") && (
            <View className="mb-4 pl-10">
              <View className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
                <View className="flex-row items-center gap-2 mb-2">
                  <ActivityIndicator size="small" color="#6366F1" />
                  <Text className="text-sm font-medium text-indigo-700">
                    {creationStep === "generating_outline" ? "AI 正在生成大纲..." : "AI 正在生成详情..."}
                  </Text>
                </View>
                {streamContent.length > 0 && (
                  <Text className="text-sm text-indigo-600 leading-5">{streamContent}</Text>
                )}
              </View>
            </View>
          )}

          {/* ===== Review Outline ===== */}
          {creationStep === "reviewing_outline" && outlineVolumes.length > 0 && (
            <View className="mb-4 pl-10">
              <Text className="text-sm text-gray-500 mb-2">{outlineVolumes.length} 卷, {outlineVolumes.reduce((s, v) => s + v.chapters.length, 0)} 章</Text>
              {outlineVolumes.map((volume, vIdx) => (
                <View key={volume.id} className="bg-white rounded-2xl mb-2 border border-gray-100 overflow-hidden">
                  <TouchableOpacity
                    className="flex-row items-center justify-between px-4 py-3"
                    onPress={() => setExpandedVolume(expandedVolume === volume.id ? null : volume.id)}
                  >
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-gray-900">{volume.title}</Text>
                      <Text className="text-xs text-gray-400 mt-0.5">{volume.chapters.length}章</Text>
                    </View>
                    <FontAwesome6 name={expandedVolume === volume.id ? "chevron-up" : "chevron-down"} size={12} color="#94A3B8" />
                  </TouchableOpacity>
                  {expandedVolume === volume.id && (
                    <View className="border-t border-gray-100 px-4 pb-2 pt-1">
                      {volume.chapters.map((chapter, cIdx) => (
                        <TouchableOpacity key={chapter.id} className="flex-row items-center py-2 border-b border-gray-50 last:border-b-0" onPress={() => handleEditChapter(vIdx, cIdx)}>
                          <View className="w-5 h-5 rounded-full bg-gray-100 items-center justify-center mr-2">
                            <Text className="text-[10px] font-medium text-gray-500">{cIdx + 1}</Text>
                          </View>
                          <Text className="text-sm text-gray-800 flex-1">{chapter.title}</Text>
                          <FontAwesome6 name="pen" size={10} color="#CBD5E1" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ))}
              <View className="flex-row gap-3 mt-3">
                <TouchableOpacity className="flex-1 bg-gray-100 rounded-xl py-2.5 items-center" onPress={() => setCreationStep("config_summary")}>
                  <Text className="text-sm text-gray-600 font-medium">返回修改</Text>
                </TouchableOpacity>
                <TouchableOpacity className="flex-1 bg-indigo-500 rounded-xl py-2.5 items-center" onPress={handleGenerateDetails}>
                  <Text className="text-sm text-white font-medium">确认，下一步</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ===== Review Details ===== */}
          {creationStep === "reviewing_details" && (
            <View className="mb-4 pl-10">
              <View className="bg-white rounded-2xl p-4 border border-gray-100 mb-3">
                <Text className="text-xs text-gray-400 mb-1">作品名称</Text>
                <TextInput className="bg-gray-50 rounded-xl px-3 py-2 text-gray-900 text-sm border border-gray-100" value={bookTitle} onChangeText={setBookTitle} placeholder="输入书名" placeholderTextColor="#94A3B8" />
              </View>
              <View className="bg-white rounded-2xl p-4 border border-gray-100 mb-3">
                <Text className="text-xs text-gray-400 mb-1">作品简介</Text>
                <TextInput className="bg-gray-50 rounded-xl px-3 py-2 text-gray-900 text-sm border border-gray-100 min-h-[80px]" value={bookDesc} onChangeText={setBookDesc} multiline placeholder="输入简介" placeholderTextColor="#94A3B8" />
              </View>
              <View className="flex-row gap-3">
                <TouchableOpacity className="flex-1 bg-gray-100 rounded-xl py-2.5 items-center" onPress={() => setCreationStep("reviewing_outline")}>
                  <Text className="text-sm text-gray-600 font-medium">上一步</Text>
                </TouchableOpacity>
                <TouchableOpacity className="flex-1 bg-indigo-500 rounded-xl py-2.5 items-center" onPress={() => showConfirmDialog("创建作品", `确定创建《${bookTitle || "未命名"}》？将包含 ${outlineVolumes.reduce((s, v) => s + v.chapters.length, 0)} 个章节。`, handleCreateBook)}>
                  <Text className="text-sm text-white font-medium">创建作品</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ===== Creating ===== */}
          {creationStep === "creating" && (
            <View className="mb-4 pl-10">
              <View className="bg-indigo-50 rounded-2xl p-4 items-center">
                <ActivityIndicator size="small" color="#6366F1" />
                <Text className="text-sm text-indigo-600 mt-2">正在创建作品...</Text>
              </View>
            </View>
          )}

          {/* ===== Completed ===== */}
          {creationStep === "completed" && (
            <View className="mb-4 pl-10">
              <TouchableOpacity className="bg-indigo-500 rounded-xl py-2.5 items-center mb-2" onPress={() => {
                const latestBook = books[0];
                if (latestBook) router.push("/detail", { id: latestBook.id });
              }}>
                <Text className="text-sm text-white font-medium">查看作品</Text>
              </TouchableOpacity>
              <TouchableOpacity className="bg-gray-100 rounded-xl py-2.5 items-center" onPress={resetAll}>
                <Text className="text-sm text-gray-600 font-medium">继续创作</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Bottom spacing for input */}
          <View className="h-4" />
        </ScrollView>

        {/* Input Bar */}
        <View className="border-t border-gray-100 px-4 pt-2 pb-4 bg-white">
          {/* Inspiration Chips - only when idle */}
          {creationStep === "welcome" && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2 -mx-4 px-4">
              <View className="flex-row gap-2">
                {INSPIRATION_CHIPS.map((chip, i) => (
                  <TouchableOpacity key={i} className="bg-gray-50 rounded-full px-3.5 py-1.5 border border-gray-200" onPress={() => setInspiration(chip)}>
                    <Text className="text-xs text-gray-500">{chip}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              className="w-9 h-9 rounded-xl bg-purple-50 items-center justify-center"
              onPress={() => setShowSkillPicker(true)}
            >
              <FontAwesome6 name="at" size={15} color="#9333EA" />
            </TouchableOpacity>

            <View className="flex-1 bg-gray-50 rounded-2xl border border-gray-200 flex-row items-center px-3">
              <TextInput
                className="flex-1 py-2.5 text-gray-900 text-sm max-h-20"
                value={inspiration}
                onChangeText={setInspiration}
                placeholder={creationStep === "welcome" ? "写下你的小说灵感..." : "输入想法..."}
                placeholderTextColor="#94A3B8"
                multiline
              />
              {creationStep !== "welcome" && (
                <TouchableOpacity className="ml-1" onPress={resetAll}>
                  <FontAwesome6 name="xmark" size={14} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              className="w-9 h-9 rounded-full bg-indigo-500 items-center justify-center"
              onPress={handleInspirationSubmit}
            >
              <FontAwesome6 name="arrow-up" size={14} color="white" solid />
            </TouchableOpacity>
          </View>
        </View>

        {/* Modals */}
        <SkillPickerModal
          visible={showSkillPicker}
          onSelect={(skill) => {
            setInspiration((prev) => (prev ? prev + " @" + skill : "@" + skill));
          }}
          onClose={() => setShowSkillPicker(false)}
        />

        <ConfirmModal
          visible={showConfirm}
          title={confirmTitle}
          message={confirmMsg}
          onConfirm={handleConfirm}
          onClose={() => setShowConfirm(false)}
        />

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
  };

  return renderContent();
}