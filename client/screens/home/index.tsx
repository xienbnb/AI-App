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
  KeyboardAvoidingView,
  Keyboard,
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
  skillName?: string;
};

type Skill = {
  id: string;
  name: string;
  desc: string;
  prompt: string;
  enabled: boolean;
  isCustom?: boolean;
};

// ===== Default skills (strict scope) =====
const DEFAULT_SKILLS: Skill[] = [
  { id: "create-book", name: "创建书籍", desc: "创建新作品（仅此技能可创建书籍）", prompt: "你是一个帮助用户创建新书籍的助手。根据用户提供的小说名称、类型和简介，严格遵守以下规则：只创建书籍，不生成大纲，不生成正文，不生成任何其他内容。创建完成后告知用户书籍已创建成功。", enabled: true },
  { id: "market", name: "赛道分析", desc: "爆款赛道分析与差异化定位", prompt: "你是一个小说赛道分析专家。请严格只分析赛道趋势、市场定位和差异化建议。不要创建书籍、不要写正文。", enabled: true },
  { id: "planning", name: "篇幅规划", desc: "规划作品篇幅与更新节奏", prompt: "你是一个小说篇幅规划师。请严格只规划作品的大致篇幅、章节数量和更新节奏。不要创建书籍、不要写正文。", enabled: true },
  { id: "worldbuild", name: "世界观", desc: "构建完整世界观底层规则", prompt: "你是一个世界观构建专家。请严格只构建世界观底层规则和设定。不要创建书籍、不要写正文。", enabled: true },
  { id: "character", name: "人物设定", desc: "生成核心人物三维设定", prompt: "你是一个小说角色设定专家。请严格只创作角色设定（外貌、性格、背景等）。不要创建书籍、不要写正文。", enabled: true },
  { id: "relations", name: "关系网", desc: "构建人物关系网络", prompt: "你是一个人物关系网构建师。请严格只构建人物之间的关系网络图。不要创建书籍、不要写正文。", enabled: true },
  { id: "outline", name: "分卷大纲", desc: "仅生成三幕式分卷大纲（不创建任何章节）", prompt: "你是一个小说大纲规划师。请严格只生成分卷大纲和各卷概要。不要创建书籍、不要写章节正文。", enabled: true },
  { id: "chapter", name: "单章大纲", desc: "仅生成单章精细化大纲（需挂载书籍）", prompt: "你是一个章节大纲师。请严格只生成单章的细纲。不要创建书籍、不要写正文内容。", enabled: true },
  { id: "writing", name: "正文生成", desc: "仅生成单章正文初稿（需挂载书籍并选择章节）", prompt: "你是一个小说正文创作助手。请严格只根据用户提供的设定和大纲撰写正文内容。不要创建书籍、不要生成大纲。", enabled: true },
  { id: "scene", name: "场景优化", desc: "仅优化关键场景描写", prompt: "你是一个场景优化专家。请严格只优化场景描写、氛围渲染和画面感。不要创建书籍、不要改写其他内容。", enabled: true },
  { id: "logic", name: "逻辑校验", desc: "仅检测逻辑漏洞与人物OOC", prompt: "你是一个严谨的逻辑校验师。请严格只检测故事中的逻辑漏洞、时间线冲突和角色OOC问题。不要创建书籍、不要修改正文。", enabled: true },
  { id: "polish", name: "批量润色", desc: "仅全文润色（不修改章节结构）", prompt: "你是一个专业的编辑。请严格只对文本进行语言润色和文风统一。不要创建书籍、不要改变原有剧情。", enabled: true },
  { id: "blurb", name: "爆款简介", desc: "仅生成作品简介与章节标题", prompt: "你是一个小说简介创作师。请严格只生成吸引人的小说简介、推荐语和封面文案。不要创建书籍、不要写正文。", enabled: true },
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

// ===== Default config for AsyncStorage =====
function defaultAiSettings() {
  return { skills: DEFAULT_SKILLS };
}

// ===== Confirm Modal =====
function ConfirmModal({ visible, title, message, confirmText = "确认", confirmColor = "#6366F1", onConfirm, onClose }: {
  visible: boolean; title: string; message: string; confirmText?: string; confirmColor?: string;
  onConfirm: () => void; onClose: () => void;
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
            <TouchableOpacity className="flex-1 py-3 rounded-xl items-center" style={{ backgroundColor: confirmColor }} onPress={onConfirm}>
              <Text className="text-white font-medium">{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ===== Markdown Renderer =====
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
  if (isStream) {
    return <Text className="text-sm text-indigo-800 leading-6 flex-shrink flex-wrap">{content}</Text>;
  }
  return (
    <Markdown style={mdStyles}>{content}</Markdown>
  );
}

// ===== Skill Picker Modal (flat list from settings) =====
function SkillPickerModal({ visible, skills, onSelect, onClose }: {
  visible: boolean; skills: Skill[]; onSelect: (skill: Skill) => void; onClose: () => void;
}) {
  const enabledSkills = skills.filter(s => s.enabled);
  // Group by category for visual
  const categories = [
    { name: "📚 创作规划", skills: ["market", "planning", "worldbuild"] },
    { name: "👥 角色设定", skills: ["character", "relations"] },
    { name: "📋 大纲规划", skills: ["outline", "chapter"] },
    { name: "✍️ 正文写作", skills: ["writing", "scene", "blurb"] },
    { name: "🔍 优化完善", skills: ["logic", "polish"] },
    { name: "⭐ 特殊能力", skills: ["create-book"] },
  ];

  // Custom skills go to the end
  const customSkills = enabledSkills.filter(s => s.isCustom);

  const getSkillColor = (skillId: string) => {
    if (skillId === "create-book") return "#10B981";
    if (["market", "planning", "worldbuild", "outline", "chapter"].includes(skillId)) return "#6366F1";
    if (["character", "relations"].includes(skillId)) return "#8B5CF6";
    if (["writing", "scene", "blurb"].includes(skillId)) return "#EC4899";
    if (["logic", "polish"].includes(skillId)) return "#F59E0B";
    if (customSkills.find(s => s.id === skillId)) return "#F59E0B";
    return "#6366F1";
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl max-h-[72%] pb-8">
            <View className="items-center pt-4 pb-2">
              <View className="w-10 h-1 bg-gray-300 rounded-full" />
            </View>
            <Text className="text-lg font-bold text-gray-900 text-center mb-1">选择一个技能</Text>
            <Text className="text-sm text-gray-500 text-center mb-4">AI 将严格按该技能的职责范围回复</Text>
            <ScrollView className="px-4" showsVerticalScrollIndicator={false}>
              {categories.map((cat) => {
                const catSkills = enabledSkills.filter(s => cat.skills.includes(s.id));
                if (catSkills.length === 0) return null;
                return (
                  <View key={cat.name} className="mb-3">
                    <Text className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 ml-1">{cat.name}</Text>
                    {catSkills.map((sk) => (
                      <TouchableOpacity
                        key={sk.id}
                        className="flex-row items-center gap-3 rounded-2xl p-3.5 mb-1.5 border border-gray-100 active:bg-gray-50"
                        onPress={() => { onSelect(sk); onClose(); }}
                      >
                        <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: getSkillColor(sk.id) + "15" }}>
                          <FontAwesome6
                            name={sk.id === "create-book" ? "book" : sk.isCustom ? "magic" : "bolt"}
                            size={14} color={getSkillColor(sk.id)}
                          />
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-gray-900">{sk.name}</Text>
                          <Text className="text-xs text-gray-400 mt-0.5">{sk.desc}</Text>
                        </View>
                        <FontAwesome6 name="chevron-right" size={12} color="#D1D5DB" />
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}
              {/* Custom skills */}
              {customSkills.length > 0 && (
                <View className="mt-1 pt-3 border-t border-gray-100">
                  <Text className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 ml-1">自定义技能</Text>
                  {customSkills.map((sk) => (
                    <TouchableOpacity
                      key={sk.id}
                      className="flex-row items-center gap-3 rounded-2xl p-3.5 mb-1.5 border border-amber-100 bg-amber-50/30 active:bg-amber-50"
                      onPress={() => { onSelect(sk); onClose(); }}
                    >
                      <View className="w-9 h-9 rounded-xl items-center justify-center bg-amber-100">
                        <FontAwesome6 name="magic" size={14} color="#D97706" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-gray-900">{sk.name}</Text>
                        <Text className="text-xs text-gray-400 mt-0.5">{sk.desc}</Text>
                      </View>
                      <FontAwesome6 name="chevron-right" size={12} color="#D1D5DB" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ===== BookPickerModal =====
function BookPickerModal({ visible, books, selectedId, onSelect, onClose }: {
  visible: boolean; books: any[]; selectedId: string | null; onSelect: (book: any) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl max-h-[65%] pb-8 min-h-[300px]">
            <View className="items-center pt-4 pb-2"><View className="w-10 h-1 bg-gray-300 rounded-full" /></View>
            <Text className="text-lg font-bold text-gray-900 text-center mb-1">选择作品上下文</Text>
            <Text className="text-sm text-gray-500 text-center mb-4">AI 将基于选定作品进行创作</Text>
            <FlatList
              data={books} className="px-4" contentContainerStyle={{ gap: 8 }}
              ListEmptyComponent={
                <View className="items-center py-10">
                  <FontAwesome6 name="book-open" size={32} color="#D1D5DB" />
                  <Text className="text-sm text-gray-400 mt-3">暂无作品</Text>
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
                        {item.title || item.name || "未命名"}
                      </Text>
                      <Text className="text-xs text-gray-400 mt-0.5">{item.type || "未分类"} · {item.chaptersCount ?? item.chapters?.length ?? 0} 章</Text>
                    </View>
                    {isSelected && <View className="bg-indigo-500 rounded-full px-2.5 py-0.5"><Text className="text-xs text-white font-medium">当前</Text></View>}
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

// ===== Chapter Selector Modal (for "insert into book" or "write chapter") =====
function ChapterSelectorModal({ visible, bookId, chapterTitle, content, onInsert, onClose }: {
  visible: boolean; bookId: string; chapterTitle: string; content: string;
  onInsert: (chapterId: string | null, title: string) => void; onClose: () => void;
}) {
  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState(chapterTitle || "AI 生成内容");
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);

  useEffect(() => {
    if (!bookId || !visible) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/chapters`);
        const json = await res.json();
        setChapters(json.data || []);
      } catch (e) { /* silent */ }
      setLoading(false);
    })();
  }, [bookId, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl max-h-[72%] pb-8">
            <View className="items-center pt-4 pb-2"><View className="w-10 h-1 bg-gray-300 rounded-full" /></View>
            <Text className="text-lg font-bold text-gray-900 text-center mb-1">插入到作品</Text>
            <Text className="text-sm text-gray-500 text-center mb-4">选择插入方式</Text>

            <View className="px-4 mb-3">
              <Text className="text-xs font-medium text-gray-600 mb-1">章节标题</Text>
              <TextInput
                className="bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-800 border border-gray-200"
                value={title} onChangeText={setTitle} placeholder="输入标题"
                placeholderTextColor="#CBD5E1"
              />
            </View>

            <ScrollView className="px-4" showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                className={`flex-row items-center gap-3 rounded-2xl p-3.5 mb-2 border ${selectedChapter === null ? "border-indigo-300 bg-indigo-50" : "border-gray-100 bg-gray-50"}`}
                onPress={() => setSelectedChapter(null)}
              >
                <View className="w-9 h-9 rounded-xl bg-indigo-100 items-center justify-center">
                  <FontAwesome6 name="file-circle-plus" size={16} color="#6366F1" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900">创建为新章节</Text>
                  <Text className="text-xs text-gray-400 mt-0.5">作为独立新章节添加到作品</Text>
                </View>
                {selectedChapter === null && <FontAwesome6 name="circle-check" size={18} color="#6366F1" solid />}
              </TouchableOpacity>

              {loading ? (
                <View className="items-center py-4"><ActivityIndicator size="small" color="#6366F1" /></View>
              ) : (
                chapters.map((ch: any) => (
                  <TouchableOpacity
                    key={ch.id}
                    className={`flex-row items-center gap-3 rounded-2xl p-3.5 mb-2 border ${selectedChapter === ch.id ? "border-emerald-300 bg-emerald-50" : "border-gray-100 bg-gray-50"}`}
                    onPress={() => setSelectedChapter(ch.id)}
                  >
                    <View className="w-9 h-9 rounded-xl bg-emerald-100 items-center justify-center">
                      <FontAwesome6 name="pen-to-square" size={14} color="#10B981" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-gray-900">替换章节：{ch.title}</Text>
                      <Text className="text-xs text-gray-400 mt-0.5">用 AI 内容替换此章节</Text>
                    </View>
                    {selectedChapter === ch.id && <FontAwesome6 name="circle-check" size={18} color="#10B981" solid />}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <View className="flex-row gap-3 px-4 mt-3">
              <TouchableOpacity className="flex-1 bg-gray-100 rounded-xl py-3 items-center" onPress={onClose}>
                <Text className="text-gray-600 font-medium">取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-3 rounded-xl items-center" style={{ backgroundColor: "#6366F1" }}
                onPress={() => { onInsert(selectedChapter, title); onClose(); }}
              >
                <Text className="text-white font-medium">确认插入</Text>
              </TouchableOpacity>
            </View>
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

  // Chat session
  const sessionIdRef = useRef<string>("init_0");
  const [currentSessionId, setCurrentSessionId] = useState("init_0");
  const sessionCounter = useRef(0);
  const [sessionList, setSessionList] = useState<{ id: string; preview: string; ts: number }[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", content: "你好！我是你的 AI 创作助手。\n\n选择一个技能开始创作，或者直接自由聊天。\n\n**已启用的技能**在设置中配置，每个技能有严格的职责范围。", step: "welcome" },
  ]);
  const [inputText, setInputText] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeBook, setActiveBook] = useState<any>(null);
  const [showBookPicker, setShowBookPicker] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Skills loaded from settings
  const [skills, setSkills] = useState<Skill[]>(DEFAULT_SKILLS);
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null);

  // Insert to book
  const [pendingInsertContent, setPendingInsertContent] = useState("");
  const [pendingInsertTitle, setPendingInsertTitle] = useState("");
  const [showChapterModal, setShowChapterModal] = useState(false);

  const sseRef = useRef<any>(null);

  const cleanupSSE = () => {
    if (sseRef.current) {
      try { sseRef.current.close(); } catch (e) { /* ignore */ }
      sseRef.current = null;
    }
  };

  // Load skills from AsyncStorage settings
  const loadSkills = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem("ai_settings");
      if (raw) {
        const cfg = JSON.parse(raw);
        if (Array.isArray(cfg.skills)) {
          // Merge stored skills with defaults to fill in prompt fields and fix ID mismatches
          const defaultMap = new Map(DEFAULT_SKILLS.map(s => [s.id, s]));
          const merged = cfg.skills.map((stored: Record<string, unknown>) => {
            const def = defaultMap.get(stored.id as string);
            return {
              ...def,              // take all default fields (including prompt)
              ...stored,           // override with stored (including enabled status)
              isCustom: stored.isCustom === true, // preserve custom flag
            } as Skill;
          });
          setSkills(merged);
          return;
        }
      }
      // Fallback to defaults
      const def = defaultAiSettings();
      await AsyncStorage.setItem("ai_settings", JSON.stringify(def));
      setSkills(def.skills);
    } catch (e) { /* silent */ }
  }, []);

  // Load last session + active book on mount
  useEffect(() => {
    (async () => {
      await loadSkills();
      try {
        const raw = await AsyncStorage.getItem("chat_sessions");
        const list: { id: string; preview: string; ts: number }[] = raw ? JSON.parse(raw) : [];
        setSessionList(list);
        if (list.length > 0) {
          const last = list[0];
          const msgRaw = await AsyncStorage.getItem(`chat_messages_${last.id}`);
          if (msgRaw) {
            const msgs = JSON.parse(msgRaw);
            if (msgs.length > 0) {
              setMessages(msgs);
              sessionIdRef.current = last.id;
              setCurrentSessionId(last.id);
            }
          }
        } else {
          sessionCounter.current += 1;
          sessionIdRef.current = `chat_${sessionCounter.current}`;
          setCurrentSessionId(`chat_${sessionCounter.current}`);
        }
      } catch {}
      try {
        const bookRaw = await AsyncStorage.getItem("active_book");
        if (bookRaw) setActiveBook(JSON.parse(bookRaw));
      } catch {}
    })();
  }, []);

  // Save sessions on change
  useEffect(() => {
    if (sessionList.length > 0) {
      AsyncStorage.setItem("chat_sessions", JSON.stringify(sessionList.slice(0, 20)));
    }
  }, [sessionList]);

  // Save messages on change
  useEffect(() => {
    if (sessionIdRef.current && messages.length > 0) {
      AsyncStorage.setItem(`chat_messages_${sessionIdRef.current}`, JSON.stringify(messages.slice(-50)));
    }
  }, [messages]);

  // Reset dialog
  const resetDialog = useCallback(() => {
    cleanupSSE();
    setIsAiThinking(false);
    setStreamContent("");
    setActiveSkill(null);
    sessionCounter.current += 1;
    sessionIdRef.current = `chat_${sessionCounter.current}`;
          setCurrentSessionId(`chat_${sessionCounter.current}`);
    setMessages([
      { role: "ai", content: "你好！我是你的 AI 创作助手。\n\n选择一个技能开始创作，或者直接自由聊天。\n\n**已启用的技能**在设置中配置，每个技能有严格的职责范围。", step: "welcome" },
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

  const addMessage = (role: "ai" | "user", content: string, step?: string, skillName?: string) => {
    setMessages((prev) => [...prev, { role, content, step, skillName }]);
  };

  // ===== Free-form chat with AI (supports skillType) =====
  const sendFreeChat = async (text: string, skill?: Skill | null) => {
    if (!text.trim() || isAiThinking) return;
    const userText = text.trim();
    setInputText("");
    setIsAiThinking(true);
    setStreamContent("");

    // If a skill is selected, show which skill
    if (skill) {
      addMessage("user", `[${skill.name}] ${userText}`, undefined, skill.name);
    } else {
      addMessage("user", userText);
    }

    const history = messages
      .filter((m) => m.content && m.content.length > 0)
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    // Build system instruction for skill scoping
    let systemMessage = "";
    if (skill) {
      systemMessage = skill.prompt;
      if (skill.id === "body-writing" && activeBook) {
        systemMessage += `\n\n当前挂载的作品是《${activeBook.title || activeBook.name}》，请基于该作品的设定和大纲进行正文创作。`;
      }
    } else {
      systemMessage = "你是专业的创作助手。请根据用户的意图自由创作。除非用户明确要求创建书籍，否则不要创建书籍。";
    }

    try {
      cleanupSSE();
      const sse = new RNSSE(`${API_BASE}/api/v1/writing/ai-dialogue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          history,
          system: systemMessage,
          skillId: skill?.id || null,
          skillName: skill?.name || null,
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
          setStreamContent("");
          return;
        }
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.error) {
            setIsAiThinking(false);
            addMessage("ai", "错误：" + parsed.error);
            setStreamContent("");
            return;
          }
          if (parsed.content) {
            fullContent += parsed.content;
            setStreamContent(fullContent);
          }
          if (parsed.bookCreated) {
            // For create-book skill, show book created notification
            fetchBooks();
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

  // ===== Handle skill selection =====
  const handleSkillSelect = useCallback((skill: Skill) => {
    if (skill.id === "create-book") {
      // Open input with creation prompt
      setActiveSkill(skill);
      setInputText("");
      // Show a quick message guiding the user
      return;
    }
    if (skill.id === "body-writing" && !activeBook) {
      addMessage("ai", "⚠️ 正文生成需要先挂载一个作品。请点击上方「自由创作」选择一本作品。");
      return;
    }
    setActiveSkill(skill);
  }, [activeBook, addMessage]);

  // ===== Insert AI content into book =====
  const handleInsertToBook = useCallback(async (content: string, title: string, chapterId: string | null) => {
    if (!activeBook?.id || !content) return;
    try {
      let res;
      if (chapterId) {
        // Update existing chapter
        res = await fetch(`${API_BASE}/api/v1/writing/${activeBook.id}/chapters/${chapterId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content }),
        });
      } else {
        // Create new chapter
        const bookRes = await fetch(`${API_BASE}/api/v1/writing/${activeBook.id}`);
        const bookJson = await bookRes.json();
        const vols = bookJson.success ? (bookJson.data?.volumes || []) : [];
        const firstVol = vols.length > 0 ? vols[0] : null;
        res = await fetch(`${API_BASE}/api/v1/writing/${activeBook.id}/chapters`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content, volumeId: firstVol?.id || null }),
        });
      }
      const json = await res.json();
      if (json.success) {
        addMessage("ai", `✅ 内容已成功插入到《${activeBook.title || activeBook.name}》${chapterId ? "（替换章节）" : "（新章节）"}！`);
      } else {
        addMessage("ai", "❌ 插入失败：" + (json.error || "未知错误"));
      }
    } catch (e) {
      addMessage("ai", "❌ 插入失败：无法连接到服务器");
    }
  }, [activeBook, addMessage]);

  // ===== Open insert modal =====
  const handleOpenInsert = useCallback((content: string, title?: string) => {
    if (!activeBook?.id) {
      setShowBookPicker(true);
      return;
    }
    setPendingInsertContent(content);
    setPendingInsertTitle(title || "AI 生成内容");
    setShowChapterModal(true);
  }, [activeBook]);

  // ===== Regenerate last AI response =====
  const handleRegenerate = useCallback((msgIndex: number) => {
    const prevMessages = messages.slice(0, msgIndex);
    let lastUserIdx = prevMessages.length - 1;
    while (lastUserIdx >= 0 && prevMessages[lastUserIdx]?.role !== "user") lastUserIdx--;
    const userMsg = prevMessages[lastUserIdx]?.role === "user" ? prevMessages[lastUserIdx].content : null;
    if (!userMsg) return;
    setMessages(prev => prev.slice(0, msgIndex));
    const skillName = prevMessages[lastUserIdx]?.skillName;
    const skill = skills.find(s => s.name === skillName);
    sendFreeChat(userMsg, skill || null);
  }, [messages, skills, sendFreeChat]);

  // ===== Send =====
  const handleSend = () => {
    if (!inputText.trim() || isAiThinking) return;
    const skill = activeSkill;
    setActiveSkill(null);
    sendFreeChat(inputText.trim(), skill);
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
            setCurrentSessionId(sid);
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
      if (sid === currentSessionId) {
        resetDialog();
      }
    } catch (e) { /* silent */ }
  }, [deleteTarget, sessionList, resetDialog, currentSessionId]);

  // ===== Build session items =====
  const curSid = currentSessionId;
  const sessionsToShow = sessionList.slice(0, 8);
  const sessionItems = sessionsToShow.map((s) => {
    const isActive = s.id === curSid;
    const dateStr = new Date(s.ts).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    return (
      <TouchableOpacity
        key={s.id}
        className={`flex-row items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 ${isActive ? "bg-indigo-50" : "active:bg-gray-50"}`}
        onPress={() => handleLoadSession(s.id)}
      >
        <FontAwesome6 name="comment" size={14} color={isActive ? "#6366F1" : "#9CA3AF"} />
        <View className="flex-1">
          <Text className={`text-sm ${isActive ? "text-indigo-600 font-medium" : "text-gray-600"}`} numberOfLines={1}>{s.preview}</Text>
          <Text className="text-xs text-gray-400 mt-0.5">{dateStr}</Text>
        </View>
        <TouchableOpacity className="w-7 h-7 rounded-lg items-center justify-center" onPress={() => handleDeleteSession(s.id)}>
          <FontAwesome6 name="trash-can" size={12} color="#EF4444" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  });

  // ===== Render =====
  return (
    <View className="flex-1 bg-white overflow-hidden">
      {/* Top Bar */}
      <View className="flex-row items-center justify-between px-4 border-b border-gray-100" style={{ paddingTop: insets.top + 4, paddingBottom: 10 }}>
        <TouchableOpacity className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center" onPress={() => setSidebarOpen(true)}>
          <FontAwesome6 name="bars" size={18} color="#374151" />
        </TouchableOpacity>
        <View className="flex-row items-center gap-2">
          <View className="w-6 h-6 rounded-full bg-indigo-100 items-center justify-center">
            <FontAwesome6 name="robot" size={11} color="#6366F1" />
          </View>
          <Text className="text-sm font-medium text-gray-700">豆包 Seed 2.0</Text>
        </View>
        <TouchableOpacity className="h-9 px-3 rounded-xl bg-indigo-50 items-center justify-center" onPress={resetDialog}>
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
            <TouchableOpacity className="w-6 h-6 rounded-full bg-gray-200 items-center justify-center" onPress={(e) => { e.stopPropagation(); setActiveBook(null); AsyncStorage.removeItem("active_book"); }}>
              <FontAwesome6 name="xmark" size={10} color="#6B7280" />
            </TouchableOpacity>
          )}
          <FontAwesome6 name="chevron-down" size={10} color="#9CA3AF" />
        </View>
      </TouchableOpacity>

      {/* Active Skill Indicator */}
      {activeSkill && (
        <View className="flex-row items-center gap-2 px-4 py-2 bg-purple-50/80 border-b border-purple-100">
          <FontAwesome6 name="bolt" size={12} color="#9333EA" />
          <Text className="text-xs font-medium text-purple-700 flex-1">技能模式：{activeSkill.name}</Text>
          <TouchableOpacity onPress={() => setActiveSkill(null)}>
            <FontAwesome6 name="xmark" size={12} color="#9333EA" />
          </TouchableOpacity>
        </View>
      )}

      {/* Messages Area */}
      <ScrollView ref={scrollRef} className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {messages.map((msg, i) => (
          <View key={i} className={`mb-4 ${msg.role === "user" ? "items-end" : "items-start"}`}>
            {msg.role === "ai" && (
              <View className="w-full">
                <View className="flex-row gap-2 max-w-[90%]">
                  <View className="w-8 h-8 rounded-full bg-indigo-100 items-center justify-center mt-1 shrink-0">
                    <FontAwesome6 name="robot" size={14} color="#6366F1" />
                  </View>
                  {msg.step === "welcome" ? (
                    <View className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3 flex-shrink">
                      <MarkdownContent content={msg.content} />
                    </View>
                  ) : (
                    <View className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3 flex-shrink">
                      <MarkdownContent content={msg.content} />
                    </View>
                  )}
                </View>
                {/* Action buttons */}
                {i > 0 && msg.role === "ai" && !isAiThinking && (
                  <View className="flex-row gap-1.5 pl-10 mt-1.5">
                    <TouchableOpacity
                      className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 active:bg-gray-200"
                      onPress={() => setInputText("继续说说：" + msg.content.slice(0, 50) + (msg.content.length > 50 ? "..." : ""))}
                    >
                      <FontAwesome6 name="comment-dots" size={10} color="#6B7280" />
                      <Text className="text-xs text-gray-600 font-medium">追问</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 active:bg-blue-100"
                      onPress={() => handleOpenInsert(msg.content)}
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
            {msg.role === "user" && (
              <View className="bg-indigo-500 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
                <Text className="text-sm text-white leading-6 flex-shrink flex-wrap">{msg.content}</Text>
              </View>
            )}
          </View>
        ))}

        {/* Streaming */}
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

        {/* Thinking */}
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

        {/* Suggestions */}
        {!isAiThinking && messages.length <= 1 && (
          <View className="mb-4">
            <Text className="text-xs text-gray-400 mb-3 pl-1">试试这些创作方向</Text>
            {SUGGESTIONS.map((s, i) => (
              <TouchableOpacity key={i} className="flex-row items-center bg-white rounded-2xl px-4 py-3.5 mb-2 border border-gray-100 active:bg-gray-50" onPress={() => setInputText(s.title)}>
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

        <View className="h-4" />
      </ScrollView>

      {/* Input Bar */}
      <View className="border-t border-gray-100 px-4 pt-2 pb-4 bg-white">
        {!isAiThinking && messages.length <= 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2 -mx-4 px-4">
            <View className="flex-row gap-2">
              {INSPIRATION_CHIPS.map((chip, i) => (
                <TouchableOpacity key={i} className="bg-gray-50 rounded-full px-3.5 py-1.5 border border-gray-200" onPress={() => setInputText(chip)}>
                  <Text className="text-xs text-gray-500">{chip}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        <View className="flex-row items-end gap-2">
          <TouchableOpacity className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center border border-gray-200" onPress={async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: ["text/plain", "text/markdown", "application/pdf"],
                copyToCacheDirectory: true,
              });
              if (result.canceled || !result.assets?.[0]) return;
              const file = result.assets[0];
              const formData = new FormData();
              formData.append("file", { uri: file.uri, name: file.name || "file.txt", type: file.mimeType || "text/plain" } as any);
              addMessage("user", `[上传文件] ${file.name}`);
              setIsAiThinking(true);
              setStreamContent("正在读取文件...");
              const res = await fetch(`${API_BASE}/api/v1/writing/upload`, { method: "POST", body: formData });
              const json = await res.json();
              if (json.success) {
                const text = `我上传了一个文件《${file.name}》，内容是：\n\`\`\`\n${json.data.content.substring(0, 3000)}\n\`\`\`\n请帮我分析这个文件的内容。`;
                setInputText(text);
                setIsAiThinking(false);
                setStreamContent("");
                setTimeout(() => sendFreeChat(text), 100);
              } else {
                setIsAiThinking(false);
                addMessage("ai", "文件上传失败：" + (json.error || "未知错误"));
              }
            } catch (e: any) {
              setIsAiThinking(false);
              addMessage("ai", "文件上传出错：" + (e.message || "未知错误"));
            }
          }} disabled={isAiThinking}>
            <FontAwesome6 name="paperclip" size={15} color={isAiThinking ? "#CBD5E1" : "#64748B"} />
          </TouchableOpacity>

          <TouchableOpacity className="w-9 h-9 rounded-xl bg-purple-50 items-center justify-center border border-purple-200" onPress={() => setShowSkillPicker(true)}>
            <FontAwesome6 name="at" size={15} color="#9333EA" />
          </TouchableOpacity>

          <View className="flex-1 bg-gray-50 rounded-2xl border border-gray-200 flex-row items-center px-3">
            <TextInput
              className="flex-1 py-2.5 text-gray-900 text-sm max-h-20 leading-5"
              value={inputText}
              onChangeText={setInputText}
              placeholder={activeSkill ? `输入内容以使用 [${activeSkill.name}] 技能...` : isAiThinking ? "AI 正在回复中..." : "输入你的想法..."}
              placeholderTextColor="#94A3B8"
              multiline
              editable={!isAiThinking}
              onSubmitEditing={handleSend}
              blurOnSubmit
            />
          </View>

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
      <SkillPickerModal visible={showSkillPicker} skills={skills} onSelect={handleSkillSelect} onClose={() => setShowSkillPicker(false)} />
      <BookPickerModal visible={showBookPicker} books={books} selectedId={activeBook?.id || null} onSelect={(book) => {
        setActiveBook(book);
        AsyncStorage.setItem("active_book", JSON.stringify(book));
      }} onClose={() => setShowBookPicker(false)} />

      {/* Insert Modal */}
      <ChapterSelectorModal
        visible={showChapterModal}
        bookId={activeBook?.id || ""}
        chapterTitle={pendingInsertTitle}
        content={pendingInsertContent}
        onInsert={(chapterId, title) => {
          handleInsertToBook(pendingInsertContent, title, chapterId);
          setShowChapterModal(false);
        }}
        onClose={() => setShowChapterModal(false)}
      />

      {/* Delete Confirm */}
      <ConfirmModal
        visible={showDeleteConfirm}
        title="删除对话"
        message="确定要删除这个对话记录吗？此操作不可恢复。"
        confirmText="删除"
        confirmColor="#EF4444"
        onConfirm={confirmDeleteSession}
        onClose={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }}
      />

      {/* Sidebar */}
      <Modal visible={sidebarOpen} transparent animationType="fade" onRequestClose={() => setSidebarOpen(false)}>
        <TouchableOpacity className="flex-1 bg-black/40" activeOpacity={1} onPress={() => setSidebarOpen(false)}>
          <View className="w-[75%] h-full bg-white pt-12" onStartShouldSetResponder={() => true}>
            <View className="px-4 mb-4">
              <Text className="text-lg font-bold text-gray-900">对话历史</Text>
              <Text className="text-xs text-gray-400 mt-1">共 {sessionList.length} 条记录</Text>
            </View>
            <ScrollView className="flex-1 px-3">
              {sessionList.length === 0 ? (
                <View className="items-center py-10">
                  <FontAwesome6 name="comments" size={28} color="#D1D5DB" />
                  <Text className="text-sm text-gray-400 mt-3">暂无对话记录</Text>
                </View>
              ) : sessionItems}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}