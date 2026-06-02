import { useCallback, useRef, useState } from "react";
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

const API_BASE =
  process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

// ===== Types =====
type ChatMessage = {
  role: "ai" | "user";
  content: string;
  step?: string;
};

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

const INSPIRATION_CHIPS = [
  "穿越到修仙世界获得签到系统",
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

// ===== Main Home Component =====
export default function HomeScreen() {
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  // -- Core chat state --
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", content: "你好！我是你的 AI 创作助手。\n\n你可以随意和我聊任何创作相关的话题——给我一个灵感、让我帮你设计角色、或者直接开始创作一部小说。", step: "welcome" },
  ]);
  const [inputText, setInputText] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const sseRef = useRef<any>(null);
  const confirmActionRef = useRef<(() => void) | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMsg, setConfirmMsg] = useState("");
  const [showNewBookBtn, setShowNewBookBtn] = useState(false);
  const [pendingBookData, setPendingBookData] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Simplified state - no guided creation, just free chat
  const resetDialog = useCallback(() => {
    cleanupSSE();
    setStreamContent("");
    setShowNewBookBtn(false);
    setPendingBookData(null);
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

  // Clean up SSE
  const cleanupSSE = () => {
    if (sseRef.current) {
      try { sseRef.current.close(); } catch (e) { /* ignore */ }
      sseRef.current = null;
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

  // ===== Render =====
  return (
    <View className="flex-1 bg-white">
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
                <View className="w-8 h-8 rounded-full bg-indigo-100 items-center justify-center mt-1 shrink-0">
                  <FontAwesome6 name="robot" size={14} color="#6366F1" />
                </View>
                <View className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3 flex-shrink">
                  <Text className="text-sm text-gray-800 leading-6 flex-shrink flex-wrap">{msg.content}</Text>
                </View>
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
            <View className="flex-row gap-2 max-w-[85%]">
              <View className="w-8 h-8 rounded-full bg-indigo-100 items-center justify-center mt-1 shrink-0">
                <FontAwesome6 name="robot" size={14} color="#6366F1" />
              </View>
              <View className="bg-indigo-50 rounded-2xl rounded-tl-sm px-4 py-3 border border-indigo-100 flex-shrink">
                <Text className="text-sm text-indigo-800 leading-6 flex-shrink flex-wrap">{streamContent}</Text>
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

      <ConfirmModal
        visible={showConfirm}
        title={confirmTitle}
        message={confirmMsg}
        onConfirm={handleConfirm}
        onClose={() => setShowConfirm(false)}
      />

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

                {/* Sidebar Menu Items */}
                <View className="flex-1 px-3 py-3">
                  <TouchableOpacity className="flex-row items-center gap-3 px-3 py-3 rounded-xl bg-indigo-50 mb-1">
                    <FontAwesome6 name="message" size={16} color="#6366F1" />
                    <Text className="text-sm font-medium text-indigo-600">当前对话</Text>
                  </TouchableOpacity>

                  <TouchableOpacity className="flex-row items-center gap-3 px-3 py-3 rounded-xl active:bg-gray-50 mb-1">
                    <FontAwesome6 name="clock-rotate-left" size={16} color="#6B7280" />
                    <Text className="text-sm text-gray-600">历史记录</Text>
                  </TouchableOpacity>

                  <View className="border-t border-gray-100 my-3" />

                  <TouchableOpacity
                    className="flex-row items-center gap-3 px-3 py-3 rounded-xl active:bg-gray-50 mb-1"
                    onPress={() => {
                      setSidebarOpen(false);
                      router.navigate('/');
                    }}
                  >
                    <FontAwesome6 name="book" size={16} color="#6B7280" />
                    <Text className="text-sm text-gray-600">我的作品</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className="flex-row items-center gap-3 px-3 py-3 rounded-xl active:bg-gray-50 mb-1"
                    onPress={() => {
                      setSidebarOpen(false);
                      router.navigate('/');
                    }}
                  >
                    <FontAwesome6 name="compass" size={16} color="#6B7280" />
                    <Text className="text-sm text-gray-600">AI 工坊</Text>
                  </TouchableOpacity>
                </View>

                {/* Sidebar Footer */}
                <View className="px-5 py-4 border-t border-gray-100">
                  <TouchableOpacity
                    className="flex-row items-center gap-3 px-3 py-2.5 rounded-xl active:bg-gray-50"
                    onPress={() => setSidebarOpen(false)}
                  >
                    <FontAwesome6 name="gear" size={16} color="#9CA3AF" />
                    <Text className="text-sm text-gray-400">设置</Text>
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