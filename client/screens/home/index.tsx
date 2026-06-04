import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Modal,
  FlatList,
  TouchableWithoutFeedback,
  Alert,
} from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { useFocusEffect } from "expo-router";
import RNSSE from "react-native-sse";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Markdown from "react-native-markdown-display";

const API_BASE =
  process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

// ===== Types =====
type ChatMessage = {
  role: "ai" | "user";
  content: string;
  step?: string;
};

// ===== Skill Categories =====
const SKILL_CATEGORIES = [
  {
    name: "灵感创意",
    icon: "lightbulb",
    color: "#F59E0B",
    bgColor: "#FEF3C7",
    skills: [
      { name: "赛道分析", desc: "分析爆款赛道与差异化定位" },
      { name: "世界观构建", desc: "构建完整世界观底层规则" },
      { name: "灵感发散", desc: "从关键词发散创意脑洞" },
    ],
  },
  {
    name: "角色设定",
    icon: "user-group",
    color: "#8B5CF6",
    bgColor: "#EDE9FE",
    skills: [
      { name: "人物设定", desc: "生成核心人物三维设定" },
      { name: "关系网构建", desc: "构建人物关系网络" },
      { name: "角色对话", desc: "生成符合人设的对话" },
    ],
  },
  {
    name: "大纲规划",
    icon: "list-tree",
    color: "#3B82F6",
    bgColor: "#DBEAFE",
    skills: [
      { name: "篇幅规划", desc: "规划作品篇幅与更新节奏" },
      { name: "分卷大纲", desc: "生成三幕式分卷大纲" },
      { name: "单章大纲", desc: "生成单章精细化大纲" },
    ],
  },
  {
    name: "正文写作",
    icon: "pen-fancy",
    color: "#10B981",
    bgColor: "#D1FAE5",
    skills: [
      { name: "正文生成", desc: "生成单章正文初稿" },
      { name: "场景优化", desc: "优化关键场景描写" },
      { name: "爆款简介", desc: "生成爆款简介与章节标题" },
    ],
  },
  {
    name: "优化完善",
    icon: "wrench",
    color: "#EF4444",
    bgColor: "#FEE2E2",
    skills: [
      { name: "逻辑校验", desc: "检测逻辑漏洞与角色OOC" },
      { name: "批量润色", desc: "全文润色与文风统一" },
      { name: "文风模仿", desc: "模仿特定作家文风" },
    ],
  },
];

const INSPIRATION_CHIPS = [
  "创作一本玄幻修仙小说",
  "重生回到高中改写人生",
  "末日废土上的异能觉醒",
  "在星际时代开了一家美食店",
  "我养的猫竟然是上古神兽",
];

const SUGGESTIONS = [
  { title: "帮我写一部玄幻小说", subtitle: "主角获得签到系统，穿越到修仙世界", icon: "wand-magic-sparkles" },
  { title: "设计一个复杂反派", subtitle: "让读者又爱又恨的悲剧反派角色", icon: "mask" },
  { title: "润色这段文字", subtitle: "帮我提升文笔，让描写更生动", icon: "pen-fancy" },
  { title: "续写都市剧情", subtitle: "豪门千金与草根逆袭的故事走向", icon: "book-open" },
];

// ===== Helpers =====
function generateTempId(): string {
  return "tmp_" + Math.random().toString(36).substring(2, 9);
}

// ===== Skill Picker Modal (Category based) =====
function SkillPickerModal({ visible, onSelect, onClose }: {
  visible: boolean;
  onSelect: (skill: string) => void;
  onClose: () => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const currentCategory = SKILL_CATEGORIES.find(c => c.name === selectedCategory);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl max-h-[70%] pb-8">
            <View className="items-center pt-4 pb-2">
              <View className="w-10 h-1 bg-gray-300 rounded-full" />
            </View>

            {!currentCategory ? (
              <>
                <Text className="text-lg font-bold text-gray-900 text-center mb-1">选择技能分类</Text>
                <Text className="text-sm text-gray-500 text-center mb-4">选择你要使用的创作方向</Text>
                <ScrollView className="px-4" showsVerticalScrollIndicator={false}>
                  {SKILL_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.name}
                      className="flex-row items-center gap-3 rounded-2xl p-4 mb-2"
                      style={{ backgroundColor: cat.bgColor }}
                      onPress={() => setSelectedCategory(cat.name)}
                    >
                      <View className="w-11 h-11 rounded-2xl items-center justify-center" style={{ backgroundColor: cat.color + "20" }}>
                        <FontAwesome6 name={cat.icon as any} size={18} color={cat.color} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-gray-900">{cat.name}</Text>
                        <Text className="text-xs text-gray-500 mt-0.5">{cat.skills.map(s => s.name).join("、")}</Text>
                      </View>
                      <FontAwesome6 name="chevron-right" size={12} color={cat.color} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : (
              <>
                <View className="flex-row items-center px-4 mb-2">
                  <TouchableOpacity className="mr-2 w-8 h-8 rounded-full bg-gray-100 items-center justify-center" onPress={() => setSelectedCategory(null)}>
                    <FontAwesome6 name="arrow-left" size={14} color="#374151" />
                  </TouchableOpacity>
                  <Text className="text-lg font-bold text-gray-900 flex-1">{currentCategory.name}</Text>
                  <View className="w-8" />
                </View>
                <Text className="text-sm text-gray-500 text-center mb-3">选择一个技能，AI将按该技能模式回复</Text>
                <ScrollView className="px-4" showsVerticalScrollIndicator={false}>
                  {currentCategory.skills.map((sk) => (
                    <TouchableOpacity
                      key={sk.name}
                      className="flex-row items-center gap-3 rounded-2xl p-4 mb-2 border border-gray-100 bg-gray-50 active:bg-gray-100"
                      onPress={() => { onSelect(sk.name); setSelectedCategory(null); onClose(); }}
                    >
                      <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: currentCategory.color + "15" }}>
                        <FontAwesome6 name={currentCategory.icon as any} size={16} color={currentCategory.color} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-gray-900">{sk.name}</Text>
                        <Text className="text-xs text-gray-500 mt-0.5">{sk.desc}</Text>
                      </View>
                      <FontAwesome6 name="plus-circle" size={16} color={currentCategory.color} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
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

// ===== Markdown Content Renderer =====
const mdStyles = {
  body: { color: "#374151", fontSize: 14, lineHeight: 22 },
  heading1: { fontSize: 20, fontWeight: "700" as const, color: "#111827", marginVertical: 8, lineHeight: 28 },
  heading2: { fontSize: 17, fontWeight: "700" as const, color: "#1F2937", marginVertical: 6, lineHeight: 24 },
  heading3: { fontSize: 15, fontWeight: "600" as const, color: "#374151", marginVertical: 4, lineHeight: 22 },
  paragraph: { marginVertical: 4, lineHeight: 22 },
  code_inline: { backgroundColor: "#F3F4F6", color: "#BE185D", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, fontSize: 13 },
  code_block: { backgroundColor: "#1F2937", color: "#D1D5DB", padding: 12, borderRadius: 8, fontSize: 13, lineHeight: 20, marginVertical: 6 },
  fence: { backgroundColor: "#1F2937", color: "#D1D5DB", padding: 12, borderRadius: 8, fontSize: 13, lineHeight: 20, marginVertical: 6 },
  blockquote: { borderLeftWidth: 3, borderLeftColor: "#6366F1", paddingLeft: 12, marginVertical: 6, opacity: 0.8 },
  bullet_list: { marginVertical: 2 },
  ordered_list: { marginVertical: 2 },
  list_item: { marginVertical: 1, lineHeight: 22 },
  strong: { fontWeight: "700" as const },
  em: { fontStyle: "italic" as const },
  link: { color: "#6366F1", textDecorationLine: "underline" as const },
};

function MarkdownContent({ content, isStream }: { content: string; isStream?: boolean }) {
  if (!content) return null;
  // For streaming, use simple text to avoid markdown parsing lag
  if (isStream) {
    return <Text className="text-sm text-indigo-800 leading-6 flex-shrink flex-wrap">{content}</Text>;
  }
  return (
    <Markdown style={mdStyles}>
      {content}
    </Markdown>
  );
}

// ===== BookPickerModal =====
function BookPickerModal({ visible, books, selectedId, onSelect, onClose }: {
  visible: boolean;
  books: any[];
  selectedId: string | null;
  onSelect: (book: any) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl max-h-[65%] pb-8 min-h-[300px]">
            <View className="items-center pt-4 pb-2">
              <View className="w-10 h-1 bg-gray-300 rounded-full" />
            </View>
            <Text className="text-lg font-bold text-gray-900 text-center mb-1">选择作品上下文</Text>
            <Text className="text-sm text-gray-500 text-center mb-4">AI 将基于选定作品进行创作</Text>

            <FlatList
              data={books}
              className="px-4"
              contentContainerStyle={{ gap: 8 }}
              ListEmptyComponent={
                <View className="items-center py-10">
                  <FontAwesome6 name="book-open" size={32} color="#D1D5DB" />
                  <Text className="text-sm text-gray-400 mt-3">暂无作品</Text>
                  <Text className="text-xs text-gray-300 mt-1">先去创作一本小说吧</Text>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = item.id === selectedId;
                return (
                  <TouchableOpacity
                    className={`flex-row items-center gap-3 rounded-2xl p-4 border ${isSelected ? "border-indigo-300 bg-indigo-50" : "border-gray-100 bg-gray-50"}`}
                    onPress={() => { onSelect(item); onClose(); }}
                  >
                    <View className={`w-10 h-10 rounded-xl items-center justify-center ${isSelected ? "bg-indigo-500" : "bg-white"}`}>
                      <FontAwesome6 name="book" size={16} color={isSelected ? "white" : "#6366F1"} />
                    </View>
                    <View className="flex-1">
                      <Text className={`text-sm font-semibold ${isSelected ? "text-indigo-700" : "text-gray-800"}`}>
                        {item.title || item.name || "未命名作品"}
                      </Text>
                      <Text className="text-xs text-gray-400 mt-0.5">
                        {item.type || "未分类"} · {item.chaptersCount ?? item.chapters?.length ?? 0} 章
                      </Text>
                    </View>
                    {isSelected && (
                      <View className="bg-indigo-500 rounded-full px-2.5 py-0.5">
                        <Text className="text-xs text-white font-medium">当前</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
              keyExtractor={(item) => item.id}
            />
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ===== Main Home Component =====
export default function HomeScreen() {
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  // Chat history session
  const sessionIdRef = useRef<string>("init_0");
  const sessionCounter = useRef(0);
  const [sessionList, setSessionList] = useState<{ id: string; preview: string; ts: number }[]>([]);

  // -- Core chat state --
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", content: "你好！我是你的 AI 创作助手。\n\n随便聊——给我一个灵感、想个角色、或者直接说「帮我写本小说」，我来搞定一切。", step: "welcome" },
  ]);
  const [inputText, setInputText] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const confirmActionRef = useRef<(() => void) | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMsg, setConfirmMsg] = useState("");
  const [showNewBookBtn, setShowNewBookBtn] = useState(false);
  const [pendingBookData, setPendingBookData] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [activeBook, setActiveBook] = useState<any>(null);
  const [showBookPicker, setShowBookPicker] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);

  const sseRef = useRef<any>(null);

  // Clean up SSE
  const cleanupSSE = () => {
    if (sseRef.current) {
      try { sseRef.current.close(); } catch (e) { /* ignore */ }
      sseRef.current = null;
    }
  };

  // Load last session + active book on mount
  useEffect(() => {
    const load = async () => {
        try {
          const raw = await AsyncStorage.getItem("chat_sessions");
          const list: { id: string; preview: string; ts: number }[] = raw ? JSON.parse(raw) : [];
          setSessionList(list);
          if (list.length > 0 && !historyLoaded) {
            const last = list[0];
            const msgRaw = await AsyncStorage.getItem(`chat_messages_${last.id}`);
            if (msgRaw) {
              const msgs = JSON.parse(msgRaw);
              if (msgs.length > 0) {
                setMessages(msgs);
                sessionIdRef.current = last.id;
              }
            }
          } else if (list.length === 0 && !sessionIdRef.current) {
            sessionCounter.current += 1;
            sessionIdRef.current = `chat_${sessionCounter.current}`;
          }
        } catch {}
        // Restore active book
        try {
          const bookRaw = await AsyncStorage.getItem("active_book");
          if (bookRaw) {
            const book = JSON.parse(bookRaw);
            if (book?.id) setActiveBook(book);
          }
        } catch {}
        setHistoryLoaded(true);
      };
      load();
    }, []);

  // Auto-save messages whenever they change
  useEffect(() => {
    if (!historyLoaded || messages.length === 0) return;
    const timer = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(`chat_messages_${sessionIdRef.current}`, JSON.stringify(messages));
        const preview = messages.find(m => m.role === "user")?.content?.slice(0, 30) || "新对话";
        const list = sessionList.filter(s => s.id !== sessionIdRef.current);
        list.unshift({ id: sessionIdRef.current, preview, ts: Date.now() });
        setSessionList(list);
        await AsyncStorage.setItem("chat_sessions", JSON.stringify(list.slice(0, 20)));
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [messages, historyLoaded]);

  const resetDialog = useCallback(() => {
    cleanupSSE();
    setStreamContent("");
    setShowNewBookBtn(false);
    setPendingBookData(null);
    sessionIdRef.current = `chat_${Date.now()}`;
    setMessages([
      { role: "ai", content: "你好！我是你的 AI 创作助手。\n\n随便聊——给我一个灵感、想个角色、或者直接说「帮我写本小说」，我来搞定一切。", step: "welcome" },
    ]);
  }, []);

  const [books, setBooks] = useState<any[]>([]);
  const fetchBooks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing`);
      const json = await res.json();
      if (json.success) setBooks(json.data || []);
    } catch (e) { /* silent */ }
  }, []);

  useFocusEffect(useCallback(() => { fetchBooks(); }, [fetchBooks]));

  const addMessage = (role: "ai" | "user", content: string, step?: string) => {
    setMessages((prev) => [...prev, { role, content, step }]);
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

  // ===== Free-form chat with AI =====
  const sendFreeChat = async (text: string) => {
    if (!text.trim() || isAiThinking) return;

    const userText = text.trim();
    setInputText("");
    addMessage("user", userText);
    setIsAiThinking(true);
    setStreamContent("");

    // Build conversation history for context
    const history = messages
      .filter((m) => m.content && m.content.length > 0)
      .slice(-10) // last 10 messages for context
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      cleanupSSE();
      const sse = new RNSSE(`${API_BASE}/api/v1/writing/ai-dialogue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          history,
          bookId: activeBook?.id || null,
          bookTitle: activeBook?.title || null,
        }),
      });
      sseRef.current = sse;
      let fullContent = "";

      sse.addEventListener("message", (event: any) => {
        if (event.data === "[DONE]") {
          sse.close();
          setIsAiThinking(false);
          if (fullContent) {
            addMessage("ai", fullContent);
          }

          // Check if server sent bookCreated signal (from the previous backend)
          // Backend checks for book creation patterns in the AI response
          setStreamContent("");
          return;
        }
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.error) {
            setIsAiThinking(false);
            addMessage("ai", parsed.error);
            setStreamContent("");
            return;
          }
          if (parsed.content) {
            fullContent += parsed.content;
            setStreamContent(fullContent);
          }
          if (parsed.bookCreated) {
            // AI decided to create a book automatically -> offer to view
            setShowNewBookBtn(true);
            setPendingBookData({
              bookId: parsed.bookId,
              bookTitle: parsed.bookTitle,
              chaptersCount: parsed.chaptersCount,
            });
          }
        } catch (e) {
          fullContent += event.data;
          setStreamContent(fullContent);
        }
      });

      sse.addEventListener("error", () => {
        cleanupSSE();
        setIsAiThinking(false);
        addMessage("ai", "抱歉，AI 回复出错了，请稍后重试。");
      });
    } catch (e) {
      setIsAiThinking(false);
      addMessage("ai", "网络连接失败，请检查网络后重试。");
    }
  };

  // ===== Reset all =====
  const resetAll = resetDialog;

  // ===== File Upload =====
  const handleFileUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/plain", "text/markdown", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name || "file.txt",
        type: file.mimeType || "text/plain",
      } as any);

      addMessage("user", `[上传文件] ${file.name}`);
      setIsAiThinking(true);
      setStreamContent("正在读取文件...");

      const res = await fetch(`${API_BASE}/api/v1/writing/upload`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (json.success) {
        const fileContent = json.data.content;
        // Send file content to AI
        const text = `我上传了一个文件《${file.name}》，内容是：\n\`\`\`\n${fileContent.substring(0, 3000)}\n\`\`\`\n请帮我分析这个文件的内容。`;
        setInputText(text);
        setIsAiThinking(false);
        setStreamContent("");
        // Auto-send
        setTimeout(() => sendFreeChat(text), 100);
      } else {
        setIsAiThinking(false);
        addMessage("ai", "文件上传失败：" + (json.error || "未知错误"));
      }
    } catch (e: any) {
      setIsAiThinking(false);
      addMessage("ai", "文件上传出错：" + (e.message || "未知错误"));
    }
  };

  // ===== Send button handler =====
  const handleSend = () => {
    if (!inputText.trim() || isAiThinking) return;
    sendFreeChat(inputText.trim());
  };

  // ===== Load Session =====
  const handleLoadSession = useCallback((sid: string) => {
    (async () => {
      try {
        const msgRaw = await AsyncStorage.getItem(`chat_messages_${sid}`);
        if (msgRaw) {
          const msgs = JSON.parse(msgRaw);
          if (msgs.length > 0) {
            setMessages(msgs);
            sessionIdRef.current = sid;
          }
        }
      } catch {}
      setSidebarOpen(false);
    })();
  }, []);

  // ===== Delete Session =====
  const handleDeleteSession = useCallback((sid: string) => {
    setDeleteTarget(sid);
    setShowDeleteConfirm(true);
  }, []);

  const confirmDeleteSession = useCallback(async () => {
    const sid = deleteTarget;
    if (!sid) return;
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
    try {
      await AsyncStorage.removeItem(`chat_messages_${sid}`);
      const newList = sessionList.filter(s => s.id !== sid);
      setSessionList(newList);
      await AsyncStorage.setItem("chat_sessions", JSON.stringify(newList.slice(0, 20)));
      if (sid === sessionIdRef.current) {
        resetDialog();
      }
    } catch (e) {
      Alert.alert("错误", "删除失败");
    }
  }, [deleteTarget, sessionList, resetDialog]);

  // ===== Insert AI content into book =====
  const handleInsertToBook = useCallback(async (content: string) => {
    if (!activeBook?.id || !content) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/${activeBook.id}`);
      if (!res.ok) return;
      const json = await res.json();
      if (!json.success) return;
      const book = json.data;
      const vols = book?.volumes || [];
      const firstVol = vols.length > 0 ? vols[0] : null;
      const chapterRes = await fetch(`${API_BASE}/api/v1/writing/${activeBook.id}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "AI 生成内容",
          content: content,
          volumeId: firstVol?.id || null,
        }),
      });
      const chJson = await chapterRes.json();
      if (chJson.success) {
        Alert.alert("插入成功", `已将 AI 内容插入到《${activeBook.title || activeBook.name}》`);
      }
    } catch (e) {
      Alert.alert("插入失败", "无法连接到服务器");
    }
  }, [activeBook]);

  // ===== Regenerate last AI response =====
  const handleRegenerate = useCallback((msgIndex: number) => {
    // Find the last user message before this AI response
    const prevMessages = messages.slice(0, msgIndex);
    let lastUserIdx = prevMessages.length - 1;
    while (lastUserIdx >= 0 && prevMessages[lastUserIdx]?.role !== "user") {
      lastUserIdx--;
    }
    const userMsg = prevMessages[lastUserIdx]?.role === "user" ? prevMessages[lastUserIdx].content : null;
    if (!userMsg) return;

    // Remove this AI message and regenerate
    setMessages(prev => prev.slice(0, msgIndex));
    setRegeneratingIndex(msgIndex);
    sendFreeChat(userMsg);
    setRegeneratingIndex(null);
  }, [messages, sendFreeChat]);

  // ===== Render =====

  // ===== Build session items for render =====
  const curSid = sessionList.length > 0 ? sessionList[0].id : "new";
  const sessionItems: React.ReactNode[] = [];
  const sessionsToShow = sessionList.slice(0, 8);
  for (let i = 0; i < sessionsToShow.length; i++) {
    const s = sessionsToShow[i];
    const isActive = s.id === curSid;
    const dateStr = new Date(s.ts).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    sessionItems.push(
      <TouchableOpacity
        key={s.id}
        className={`flex-row items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 ${isActive ? "bg-indigo-50" : "active:bg-gray-50"}`}
        onPress={() => handleLoadSession(s.id)}
      >
        <FontAwesome6 name="comment" size={14} color={isActive ? "#6366F1" : "#9CA3AF"} />
        <View className="flex-1">
          <Text className={`text-sm ${isActive ? "text-indigo-600 font-medium" : "text-gray-600"}`} numberOfLines={1}>
            {s.preview}
          </Text>
          <Text className="text-xs text-gray-400 mt-0.5">{dateStr}</Text>
        </View>
        <TouchableOpacity
          className="w-7 h-7 rounded-lg items-center justify-center"
          onPress={() => handleDeleteSession(s.id)}
        >
          <FontAwesome6 name="trash-can" size={12} color="#EF4444" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  // ===== Render =====
  return (
    <View className="flex-1 bg-white overflow-hidden">
      {/* Top Bar */}
      <View className="flex-row items-center justify-between px-4 border-b border-gray-100" style={{ paddingTop: insets.top + 4, paddingBottom: 10 }}>
        <TouchableOpacity
          className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center"
          onPress={() => setSidebarOpen(true)}
        >
          <FontAwesome6 name="bars" size={18} color="#374151" />
        </TouchableOpacity>

        <View className="flex-row items-center gap-2">
          <View className="w-6 h-6 rounded-full bg-indigo-100 items-center justify-center">
            <FontAwesome6 name="robot" size={11} color="#6366F1" />
          </View>
          <Text className="text-sm font-medium text-gray-700">豆包 Seed 2.0</Text>
        </View>

        <TouchableOpacity
          className="h-9 px-3 rounded-xl bg-indigo-50 items-center justify-center"
          onPress={resetAll}
        >
          <FontAwesome6 name="plus" size={13} color="#6366F1" />
        </TouchableOpacity>
      </View>

      {/* Book Context Bar */}
      <TouchableOpacity
        className="flex-row items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50/80 active:bg-gray-100"
        onPress={() => setShowBookPicker(true)}
      >
        <FontAwesome6 name={activeBook ? "book-bookmark" : "feather"} size={14} color={activeBook ? "#6366F1" : "#9CA3AF"} />
        <Text className="text-sm flex-1" style={{ color: activeBook ? "#374151" : "#9CA3AF" }}>
          {activeBook ? `当前创作：${activeBook.title || activeBook.name}` : "自由创作（点击选择作品上下文）"}
        </Text>
        <View className="flex-row items-center gap-2">
          {activeBook && (
            <TouchableOpacity
              className="w-6 h-6 rounded-full bg-gray-200 items-center justify-center"
              onPress={(e) => { e.stopPropagation(); setActiveBook(null); }}
            >
              <FontAwesome6 name="xmark" size={10} color="#6B7280" />
            </TouchableOpacity>
          )}
          <FontAwesome6 name="chevron-down" size={10} color="#9CA3AF" />
        </View>
      </TouchableOpacity>

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
              <View className="w-full">
                <View className="flex-row gap-2 max-w-[90%]">
                  <View className="w-8 h-8 rounded-full bg-indigo-100 items-center justify-center mt-1 shrink-0">
                    <FontAwesome6 name="robot" size={14} color="#6366F1" />
                  </View>
                  <View className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3 flex-shrink">
                    <MarkdownContent content={msg.content} />
                  </View>
                </View>
                {/* Action buttons for AI messages (not the first welcome message) */}
                {i > 0 && (
                  <View className="flex-row gap-1.5 pl-10 mt-1.5">
                    <TouchableOpacity
                      className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 active:bg-gray-200"
                      onPress={() => {
                        // Follow-up - copy the AI message content as context
                        setInputText("继续说说：" + msg.content.slice(0, 50) + (msg.content.length > 50 ? "..." : ""));
                      }}
                    >
                      <FontAwesome6 name="comment-dots" size={10} color="#6B7280" />
                      <Text className="text-xs text-gray-600 font-medium">追问</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 active:bg-blue-100"
                      onPress={() => {
                        // Insert into active book (or show book picker)
                        if (activeBook?.id) {
                          handleInsertToBook(msg.content);
                        } else {
                          setShowBookPicker(true);
                        }
                      }}
                    >
                      <FontAwesome6 name="book-medical" size={10} color="#3B82F6" />
                      <Text className="text-xs text-blue-600 font-medium">插入书籍</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 active:bg-amber-100"
                      onPress={() => handleRegenerate(i)}
                    >
                      <FontAwesome6 name="rotate-right" size={10} color="#D97706" />
                      <Text className="text-xs text-amber-600 font-medium">重新生成</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* User message */}
            {msg.role === "user" && (
              <View className="bg-indigo-500 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
                <Text className="text-sm text-white leading-6 flex-shrink flex-wrap">{msg.content}</Text>
              </View>
            )}
          </View>
        ))}

        {/* Streaming content */}
        {isAiThinking && streamContent.length > 0 && (
          <View className="mb-4 items-start">
            <View className="flex-row gap-2 max-w-[90%]">
              <View className="w-8 h-8 rounded-full bg-indigo-100 items-center justify-center mt-1 shrink-0">
                <FontAwesome6 name="robot" size={14} color="#6366F1" />
              </View>
              <View className="bg-indigo-50 rounded-2xl rounded-tl-sm px-4 py-3 border border-indigo-100 flex-shrink">
                <MarkdownContent content={streamContent} isStream />
              </View>
            </View>
          </View>
        )}

        {/* AI thinking indicator */}
        {isAiThinking && streamContent.length === 0 && (
          <View className="mb-4 items-start">
            <View className="flex-row gap-2 max-w-[88%]">
              <View className="w-8 h-8 rounded-full bg-indigo-100 items-center justify-center mt-1 shrink-0">
                <FontAwesome6 name="robot" size={14} color="#6366F1" />
              </View>
              <View className="bg-indigo-50 rounded-2xl rounded-tl-sm px-4 py-3">
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator size="small" color="#6366F1" />
                  <Text className="text-sm text-indigo-600">AI 思考中...</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ===== Coze-style Suggestion Bars (only when idle) ===== */}
        {!isAiThinking && messages.length <= 1 && (
          <View className="mb-4">
            <Text className="text-xs text-gray-400 mb-3 pl-1">试试这些创作方向</Text>
            {SUGGESTIONS.map((s, i) => (
              <TouchableOpacity
                key={i}
                className="flex-row items-center bg-white rounded-2xl px-4 py-3.5 mb-2 border border-gray-100 active:bg-gray-50"
                onPress={() => setInputText(s.title)}
              >
                <View className="w-9 h-9 rounded-xl bg-indigo-50 items-center justify-center mr-3">
                  <FontAwesome6 name={s.icon as any} size={15} color="#6366F1" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-800">{s.title}</Text>
                  <Text className="text-xs text-gray-400 mt-0.5">{s.subtitle}</Text>
                </View>
                <FontAwesome6 name="arrow-up-right-from-square" size={11} color="#CBD5E1" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ===== Book Created (from free chat) ===== */}
        {showNewBookBtn && pendingBookData && (
          <View className="mb-4 pl-10">
            <View className="bg-green-50 rounded-2xl p-4 border border-green-200">
              <Text className="text-sm font-semibold text-green-800 mb-1">作品已创建</Text>
              <Text className="text-sm text-green-700">《{pendingBookData.bookTitle}》已创建，共 {pendingBookData.chaptersCount} 章</Text>
            </View>
            <TouchableOpacity
              className="bg-green-500 rounded-xl py-2.5 items-center mt-2"
              onPress={() => {
                if (pendingBookData?.bookId) router.push("/detail", { id: pendingBookData.bookId });
              }}
            >
              <Text className="text-sm text-white font-medium">查看作品</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom spacing */}
        <View className="h-4" />
      </ScrollView>

      {/* Input Bar - ALWAYS visible */}
      <View className="border-t border-gray-100 px-4 pt-2 pb-4 bg-white">
        {/* Quick chips (when idle) */}
        {!isAiThinking && messages.length <= 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2 -mx-4 px-4">
            <View className="flex-row gap-2">
              {INSPIRATION_CHIPS.map((chip, i) => (
                <TouchableOpacity
                  key={i}
                  className="bg-gray-50 rounded-full px-3.5 py-1.5 border border-gray-200"
                  onPress={() => setInputText(chip)}
                >
                  <Text className="text-xs text-gray-500">{chip}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        <View className="flex-row items-end gap-2">
          {/* File upload button */}
          <TouchableOpacity
            className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center border border-gray-200"
            onPress={handleFileUpload}
            disabled={isAiThinking}
          >
            <FontAwesome6 name="paperclip" size={15} color={isAiThinking ? "#CBD5E1" : "#64748B"} />
          </TouchableOpacity>

          {/* @ Skill button */}
          <TouchableOpacity
            className="w-9 h-9 rounded-xl bg-purple-50 items-center justify-center border border-purple-200"
            onPress={() => setShowSkillPicker(true)}
          >
            <FontAwesome6 name="at" size={15} color="#9333EA" />
          </TouchableOpacity>

          {/* Text input */}
          <View className="flex-1 bg-gray-50 rounded-2xl border border-gray-200 flex-row items-center px-3">
            <TextInput
              className="flex-1 py-2.5 text-gray-900 text-sm max-h-20 leading-5"
              value={inputText}
              onChangeText={setInputText}
              placeholder={isAiThinking ? "AI 正在回复中..." : "输入你的想法..."}
              placeholderTextColor="#94A3B8"
              multiline
              editable={!isAiThinking}
              onSubmitEditing={handleSend}
              blurOnSubmit
            />
          </View>

          {/* Send button */}
          <TouchableOpacity
            className={`w-9 h-9 rounded-full items-center justify-center ${inputText.trim() && !isAiThinking ? "bg-indigo-500" : "bg-gray-200"}`}
            onPress={handleSend}
            disabled={!inputText.trim() || isAiThinking}
          >
            <FontAwesome6 name="arrow-up" size={14} color={inputText.trim() && !isAiThinking ? "white" : "#CBD5E1"} solid />
          </TouchableOpacity>
        </View>
      </View>

      {/* Modals */}
      <SkillPickerModal
        visible={showSkillPicker}
        onSelect={(skill) => {
          setInputText((prev) => (prev ? prev + " @" + skill : "@" + skill));
        }}
        onClose={() => setShowSkillPicker(false)}
      />

      <BookPickerModal
        visible={showBookPicker}
        books={books}
        selectedId={activeBook?.id || null}
        onSelect={(book) => {
          setActiveBook(book);
          AsyncStorage.setItem("active_book", JSON.stringify(book)).catch(() => {});
        }}
        onClose={() => setShowBookPicker(false)}
      />

      <ConfirmModal
        visible={showConfirm}
        title={confirmTitle}
        message={confirmMsg}
        onConfirm={handleConfirm}
        onClose={() => setShowConfirm(false)}
      />

      {/* Delete History Confirm Modal */}
      <Modal visible={showDeleteConfirm} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
        <TouchableOpacity className="flex-1 bg-black/50 justify-center px-8" activeOpacity={1} onPress={() => setShowDeleteConfirm(false)}>
          <View className="bg-white rounded-2xl p-6 items-center" onStartShouldSetResponder={() => true}>
            <View className="w-12 h-12 rounded-full bg-red-50 items-center justify-center mb-3">
              <FontAwesome6 name="trash-can" size={22} color="#EF4444" />
            </View>
            <Text className="text-lg font-bold text-gray-900 mb-2">删除确认</Text>
            <Text className="text-sm text-gray-500 text-center mb-5">确定删除该对话？删除后无法恢复。</Text>
            <View className="flex-row gap-3 w-full">
              <TouchableOpacity className="flex-1 bg-gray-100 rounded-xl py-3 items-center" onPress={() => setShowDeleteConfirm(false)}>
                <Text className="text-gray-600 font-medium">取消</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 bg-red-500 rounded-xl py-3 items-center" onPress={confirmDeleteSession}>
                <Text className="text-white font-medium">删除</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sidebar Drawer */}
      <Modal visible={sidebarOpen} transparent animationType="none" onRequestClose={() => setSidebarOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setSidebarOpen(false)}>
          <View className="flex-1 bg-black/40">
            <TouchableWithoutFeedback>
              <View className="w-[280px] h-full bg-white" style={{ paddingTop: insets.top }}>
                {/* Sidebar Header */}
                <View className="px-5 py-4 border-b border-gray-100">
                  <View className="flex-row items-center gap-3 mb-4">
                    <View className="w-10 h-10 rounded-full bg-indigo-100 items-center justify-center">
                      <FontAwesome6 name="pen-fancy" size={18} color="#6366F1" />
                    </View>
                    <View>
                      <Text className="text-base font-bold text-gray-900">AI 创作</Text>
                      <Text className="text-xs text-gray-400">创意写作助手</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    className="bg-indigo-500 rounded-xl py-2.5 items-center"
                    onPress={() => { setSidebarOpen(false); resetAll(); }}
                  >
                    <Text className="text-sm text-white font-medium">新对话</Text>
                  </TouchableOpacity>
                </View>

                {/* Sidebar Menu Items - Chat History */}
                <ScrollView className="flex-1 px-3 py-3">
                  <TouchableOpacity className="flex-row items-center gap-3 px-3 py-3 rounded-xl bg-indigo-50 mb-1">
                    <FontAwesome6 name="message" size={16} color="#6366F1" />
                    <Text className="text-sm font-medium text-indigo-600">当前对话</Text>
                  </TouchableOpacity>

                  {/* Recent Sessions */}
                  {sessionList.length > 0 && (
                    <>
                      <View className="border-t border-gray-100 my-3" />
                      <Text className="text-xs font-medium text-gray-400 px-3 mb-2">最近对话</Text>
                      {sessionItems}
                    </>
                  )}
                </ScrollView>

                {/* Sidebar Footer */}
                <View className="px-5 py-3 border-t border-gray-100 gap-1">
                  <TouchableOpacity
                    className="flex-row items-center gap-3 px-3 py-2.5 rounded-xl active:bg-gray-50"
                    onPress={() => { setSidebarOpen(false); router.push('/'); }}
                  >
                    <FontAwesome6 name="book" size={16} color="#6B7280" />
                    <Text className="text-sm text-gray-600">我的作品</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-row items-center gap-3 px-3 py-2.5 rounded-xl active:bg-gray-50"
                    onPress={() => { setSidebarOpen(false); router.push('/'); }}
                  >
                    <FontAwesome6 name="compass" size={16} color="#6B7280" />
                    <Text className="text-sm text-gray-600">AI 工坊</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}