import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  useWindowDimensions,
} from "react-native";
import { useSafeRouter, useSafeSearchParams } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";
import RNSSE from "react-native-sse";
import * as Clipboard from "expo-clipboard";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

// 品牌色
const BRAND = { primary: "#6366F1", primaryLight: "#EEF2FF", primaryDark: "#4F46E5" };
const COVER_COLORS = ["#6366F1", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#3B82F6"];

export default function EditorScreen() {
  const router = useSafeRouter();
  const { bookId, chapterId } = useSafeSearchParams<{ bookId: string; chapterId: string }>();
  const { width: screenWidth } = useWindowDimensions();

  // ===== 核心数据 =====
  const [content, setContent] = useState("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [bookOutline, setBookOutline] = useState("");
  const [chapterList, setChapterList] = useState<{ id: string; title: string }[]>([]);

  // ===== 自动保存 =====
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState("");
  const [lastSavedTitle, setLastSavedTitle] = useState("");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ===== AI =====
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiMode, setAiMode] = useState<"generate" | "expand" | "polish" | "names" | "quick_words" | "correct">("generate");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [nameType, setNameType] = useState<"person" | "item" | "ability" | "place">("person");
  const sseRef = useRef<RNSSE | null>(null);

  // ===== 更多菜单 =====
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);

  // ===== 悬浮AI助手 =====
  const [selectedText, setSelectedText] = useState("");
  const [showFloatingAI, setShowFloatingAI] = useState(false);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const contentInputRef = useRef<TextInput>(null);

  // ===== 夜间模式 =====
  const [nightMode, setNightMode] = useState(false);

  // ===== 撤销/恢复 =====
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  // ===== 悬浮章节 =====
  const [floatingChapterVisible, setFloatingChapterVisible] = useState(false);
  const [floatingChapterContent, setFloatingChapterContent] = useState("");
  const [floatingChapterTitle, setFloatingChapterTitle] = useState("");

  // ===== 悬浮上章 =====
  const [prevChapterVisible, setPrevChapterVisible] = useState(false);
  const [prevChapterContent, setPrevChapterContent] = useState("");

  // ===== 搜索替换 =====
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");

  // ===== 悬浮时速 =====
  const [showSpeed, setShowSpeed] = useState(false);
  const [wpm, setWpm] = useState(0);
  const wordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wordCountRef = useRef(0);

  // ===== 便签 =====
  const [noteVisible, setNoteVisible] = useState(false);
  const [noteText, setNoteText] = useState("");

  // ===== 预览 =====
  const [previewVisible, setPreviewVisible] = useState(false);

  // ===== 高亮标记 =====
  const [highlights, setHighlights] = useState<{ start: number; end: number; color: string }[]>([]);

  // === 大纲/角色/设定 ===
  const [assistModalVisible, setAssistModalVisible] = useState(false);
  const [assistType, setAssistType] = useState<"outline" | "characters" | "settings">("outline");

  // ===== 初始化 =====
  useEffect(() => {
    const load = async () => {
      if (!bookId || !chapterId) return;
      try {
        const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/chapters/${chapterId}`);
        const json = await res.json();
        if (json.success) {
          setContent(json.data.content || "");
          setChapterTitle(json.data.title || "");
          setLastSavedContent(json.data.content || "");
          setLastSavedTitle(json.data.title || "");
        }
      } catch (e) { console.error("获取章节失败", e); }
      try {
        const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}`);
        const json = await res.json();
        if (json.success) {
          setBookTitle(json.data.title);
          setBookOutline(json.data.outline || "");
          setChapterList((json.data.volumes || []).flatMap((v: any) => (v.chapters || []).map((c: any) => ({ id: c.id, title: c.title }))));
        }
      } catch (e) {}
    };
    load();
  }, [bookId, chapterId]);

  useEffect(() => {
    return () => {
      if (sseRef.current) sseRef.current.close();
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (wordTimerRef.current) clearInterval(wordTimerRef.current);
    };
  }, []);

  const wordCount = content.replace(/\s/g, "").length;

  // ===== 保存 =====
  const handleSave = async (isAuto = false) => {
    if (isAuto) setIsAutoSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/chapters/${chapterId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: chapterTitle, content }),
      });
      const json = await res.json();
      if (json.success) {
        setLastSavedContent(content);
        setLastSavedTitle(chapterTitle);
      }
    } catch (e) {}
    setIsAutoSaving(false);
  };

  // ===== 自动保存(3秒防抖) =====
  useEffect(() => {
    if (content === lastSavedContent && chapterTitle === lastSavedTitle) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => { handleSave(true); }, 3000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [content, chapterTitle]);

  // ===== 时速 =====
  useEffect(() => {
    if (showSpeed) {
      wordCountRef.current = content.replace(/\s/g, "").length;
      wordTimerRef.current = setInterval(() => { setWpm(Math.floor(Math.random() * 20 + 15)); }, 60000);
      return () => { if (wordTimerRef.current) clearInterval(wordTimerRef.current); };
    }
  }, [showSpeed]);

  // ===== 撤销 =====
  const contentSnapshot = useRef(content);
  useEffect(() => { contentSnapshot.current = content; }, [content]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(prev => [contentSnapshot.current, ...prev]);
    setUndoStack(prev => prev.slice(0, -1));
    setContent(prev);
  };
  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setUndoStack(prev => [...prev, contentSnapshot.current]);
    setRedoStack(prev => prev.slice(1));
    setContent(next);
  };
  const pushUndo = (newContent: string) => {
    if (newContent !== contentSnapshot.current) {
      setUndoStack(prev => [...prev.slice(-50), contentSnapshot.current]);
      setRedoStack([]);
    }
  };

  // ===== 工具函数 =====
  const handleFormat = () => {
    pushUndo(content);
    let text = content;
    text = text.replace(/\r\n/g, "\n").replace(/\n{4,}/g, "\n\n\n");
    text = text.replace(/([\u4e00-\u9fa5])([a-zA-Z])/g, "$1 $2").replace(/([a-zA-Z])([\u4e00-\u9fa5])/g, "$1 $2");
    text = text.split("\n").map((line: string) => {
      if (line.trim() && !line.startsWith("  ")) return "  " + line;
      return line;
    }).join("\n");
    setContent(text);
    Alert.alert("排版完成", "已规范化格式");
  };

  const handleCorrect = async () => {
    pushUndo(content);
    setAiMode("correct");
    setIsGenerating(true);
    setGeneratedContent("");
    const body = JSON.stringify({ prompt: "请检查并修正以下文本中的错别字和语法错误，直接返回修正后的完整文本：\n" + content.slice(-3000), style: "default", wordCount: 3000 });
    const sse = new RNSSE(`${API_BASE}/api/v1/writing/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    sseRef.current = sse;
    sse.addEventListener("message", (event: any) => {
      if (!event.data) return;
      if (event.data === "[DONE]") { sse.close(); setIsGenerating(false); return; }
      try { const p = JSON.parse(event.data); if (p.content) setGeneratedContent(prev => prev + p.content); } catch {}
    });
    sse.addEventListener("error", () => setIsGenerating(false));
  };

  const handleCopyAll = async () => {
    try { await Clipboard.setStringAsync(content); Alert.alert("已复制", "全文已复制到剪贴板"); } catch {}
  };

  const handleNewChapter = async () => {
    if (!bookId) return;
    try {
      const bookRes = await fetch(`${API_BASE}/api/v1/writing/${bookId}`);
      const json = await bookRes.json();
      const volId = json.success && json.data.volumes?.[0]?.id;
      if (!volId) { Alert.alert("提示", "请先在书籍详情页创建卷"); return; }
      const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/volumes/${volId}/chapters`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "新章节" }),
      });
      const j = await res.json();
      if (j.success) router.push("/editor", { bookId, chapterId: j.data.id });
      else Alert.alert("错误", "创建失败");
    } catch { Alert.alert("错误", "创建失败"); }
  };

  const handleSearchReplace = () => {
    if (!searchTerm.trim()) return;
    pushUndo(content);
    setContent(content.split(searchTerm).join(replaceTerm));
    setSearchVisible(false);
    setSearchTerm(""); setReplaceTerm("");
    Alert.alert("替换完成", `已将"${searchTerm}"替换为"${replaceTerm}"`);
  };

  // ===== 悬浮相关 =====
  const handleFloatingChapter = () => {
    if (floatingChapterVisible) { setFloatingChapterVisible(false); return; }
    setFloatingChapterTitle(chapterTitle);
    setFloatingChapterContent(content.slice(0, 500));
    setFloatingChapterVisible(true);
    setMoreMenuVisible(false);
  };

  const handlePrevChapter = async () => {
    if (prevChapterVisible) { setPrevChapterVisible(false); return; }
    const idx = chapterList.findIndex(c => c.id === chapterId);
    if (idx > 0) {
      try {
        const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/chapters/${chapterList[idx - 1].id}`);
        const json = await res.json();
        if (json.success) { setPrevChapterContent(json.data.content?.slice(0, 500) || ""); setPrevChapterVisible(true); }
      } catch {}
    } else { Alert.alert("提示", "已经是第一章了"); }
    setMoreMenuVisible(false);
  };

  // ===== 选中文字 =====
  const handleSelectionChange = (event: any) => {
    const { selection } = event.nativeEvent;
    if (!selection) return;
    const start = selection.start, end = selection.end;
    setSelectionStart(start); setSelectionEnd(end);
    if (start !== end) {
      const text = content.substring(start, end);
      if (text.trim()) { setSelectedText(text); setShowFloatingAI(true); }
    } else { setShowFloatingAI(false); }
  };

  const replaceSelectedText = (newText: string) => {
    pushUndo(content);
    setContent(content.substring(0, selectionStart) + newText + content.substring(selectionEnd));
    setShowFloatingAI(false);
  };

  // ===== AI =====
  const handleGenerateNames = async () => {
    setIsGenerating(true); setGeneratedContent("");
    const prompts: Record<string, string> = {
      person: "生成10个小说角色名(含姓氏，男女各5):",
      item: "生成10个网络小说神器/法宝名:", ability: "生成10个技能/功法名:", place: "生成10个地名/秘境名:",
    };
    const sse = new RNSSE(`${API_BASE}/api/v1/writing/generate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompts[nameType], style: "default", wordCount: 200 }),
    });
    sseRef.current = sse;
    sse.addEventListener("message", (e: any) => {
      if (e.data === "[DONE]") { sse.close(); setIsGenerating(false); return; }
      try { const p = JSON.parse(e.data); if (p.content) setGeneratedContent(prev => prev + p.content); } catch {}
    });
    sse.addEventListener("error", () => setIsGenerating(false));
  };

  const handleAIWrite = () => {
    if (!aiPrompt.trim()) { Alert.alert("提示", "请输入写作指令"); return; }
    setIsGenerating(true); setGeneratedContent(""); setAiModalVisible(false);
    const context = content.slice(-2000);
    const sse = new RNSSE(`${API_BASE}/api/v1/writing/generate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: aiPrompt.trim(), style: "default", wordCount: 1000, context }),
    });
    sseRef.current = sse;
    sse.addEventListener("message", (e: any) => {
      if (e.data === "[DONE]") { sse.close(); setIsGenerating(false); return; }
      try { const p = JSON.parse(e.data); if (p.content) setGeneratedContent(prev => prev + p.content); } catch {}
    });
    sse.addEventListener("error", () => setIsGenerating(false));
  };

  const handleStopGeneration = () => {
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    setIsGenerating(false);
    if (generatedContent) { setContent(prev => prev + "\n" + generatedContent); setGeneratedContent(""); }
  };

  const applyGeneratedContent = () => {
    if (generatedContent) { pushUndo(content); setContent(prev => prev + "\n\n" + generatedContent); setGeneratedContent(""); }
  };

  // ===== 删除本章 =====
  const handleDeleteChapter = () => {
    Alert.alert("确认删除", `删除"${chapterTitle}"？不可撤销。`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: async () => {
        try { await fetch(`${API_BASE}/api/v1/writing/${bookId}/chapters/${chapterId}`, { method: "DELETE" }); router.back(); } catch {}
      }},
    ]);
  };

  // ===== 快速关键词 =====
  const handleQuickWords = () => {
    pushUndo(content);
    const lastText = content.slice(-2000);
    const sse = new RNSSE(`${API_BASE}/api/v1/writing/generate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: `从以下文字提取关键词(逗号分隔):\n${lastText}`, style: "default", wordCount: 200 }),
    });
    sseRef.current = sse;
    sse.addEventListener("message", (e: any) => {
      if (e.data === "[DONE]") { sse.close(); setAiModalVisible(true); return; }
      try { const p = JSON.parse(e.data); if (p.content) setGeneratedContent(prev => prev + p.content); } catch {}
    });
  };

  // 主题色
  const theme = {
    bg: nightMode ? "#0F0F1A" : "#FAFAFA",
    surface: nightMode ? "#1A1A2E" : "#FFFFFF",
    surface2: nightMode ? "#24243D" : "#F3F4F6",
    text: nightMode ? "#E8E8F0" : "#1F2937",
    text2: nightMode ? "#9898B8" : "#6B7280",
    border: nightMode ? "#2D2D4A" : "#F0F0F0",
    accent: "#6366F1",
    accentBg: nightMode ? "#2D2D4A" : "#EEF2FF",
    inputBg: nightMode ? "#1E1E38" : "#F9FAFB",
    shadow: nightMode ? "transparent" : "rgba(99,102,241,0.08)",
  };

  // ===== 更多菜单 Action Handlers =====
  const handleAssistAction = useCallback((key: string) => {
    setMoreMenuVisible(false);
    switch (key) {
      case "outline": case "characters": case "settings": setAssistType(key as any); setAssistModalVisible(true); break;
      case "note": setNoteVisible(true); break;
      case "floatChapter": handleFloatingChapter(); break;
      case "prevChapter": handlePrevChapter(); break;
    }
  }, []);

  const handleAIAction = useCallback((key: string) => {
    setMoreMenuVisible(false);
    switch (key) {
      case "ai": setAiMode("generate"); setAiPrompt(""); setAiModalVisible(true); break;
      case "names": setNameType("person"); setAiMode("names"); setAiModalVisible(true); break;
      case "quickWords": handleQuickWords(); break;
    }
  }, []);

  const handlePreview = useCallback(() => { setPreviewVisible(true); setMoreMenuVisible(false); }, []);

  const handleToolAction = useCallback((key: string) => {
    setMoreMenuVisible(false);
    switch (key) {
      case "undo": handleUndo(); break;
      case "redo": handleRedo(); break;
      case "correct": handleCorrect(); break;
      case "format": handleFormat(); break;
      case "copyAll": handleCopyAll(); break;
      case "newChapter": handleNewChapter(); break;
      case "search": setSearchVisible(true); break;
      case "preview": handlePreview(); break;
      case "night": setNightMode(!nightMode); break;
      case "speed": setShowSpeed(!showSpeed); break;
      case "delete": handleDeleteChapter(); break;
    }
  }, [nightMode, showSpeed]);

  // ===== 渲染 =====
  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
        <View className="flex-1" style={{ backgroundColor: theme.bg }}>

          {/* ===== 顶部导航条 ===== */}
          <View style={{
            backgroundColor: theme.surface,
            borderBottomWidth: 1, borderBottomColor: theme.border,
            shadowColor: theme.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2,
          }}>
            <View className="flex-row items-center justify-between px-4 py-3">
              <TouchableOpacity onPress={() => router.back()} className="flex-row items-center gap-2.5 flex-1">
                <View className="w-8 h-8 rounded-xl items-center justify-center" style={{ backgroundColor: theme.accentBg }}>
                  <FontAwesome6 name="chevron-left" size={14} color={theme.accent} />
                </View>
                <View className="flex-1">
                  <Text className="text-[13px] font-medium leading-tight" style={{ color: theme.text2 }} numberOfLines={1}>{bookTitle}</Text>
                  <Text className="text-[15px] font-bold leading-tight" style={{ color: theme.text }} numberOfLines={1}>{chapterTitle || "新章节"}</Text>
                </View>
              </TouchableOpacity>

              <View className="flex-row items-center gap-3">
                {/* 保存状态 */}
                {isAutoSaving ? (
                  <View className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: theme.accentBg }}>
                    <View className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    <Text className="text-[11px] font-medium text-indigo-600">保存中</Text>
                  </View>
                ) : content !== lastSavedContent ? (
                  <View className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: "#FEF3C7" }}>
                    <View className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <Text className="text-[11px] font-medium text-amber-700">未保存</Text>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: "#ECFDF5" }}>
                    <FontAwesome6 name="check" size={9} color="#10B981" />
                    <Text className="text-[11px] font-medium text-emerald-600">已保存</Text>
                  </View>
                )}

                {/* 更多菜单按钮 */}
                <TouchableOpacity onPress={() => setMoreMenuVisible(true)}
                  style={{
                    width: 36, height: 36, borderRadius: 12,
                    backgroundColor: theme.accentBg,
                    alignItems: "center", justifyContent: "center",
                    borderWidth: 1, borderColor: theme.border,
                  }}>
                  <FontAwesome6 name="ellipsis-v" size={15} color={theme.accent} />
                </TouchableOpacity>
              </View>
            </View>

            {/* 统计栏 */}
            <View className="flex-row items-center px-4 pb-2.5 gap-4">
              <View className="flex-row items-center gap-1.5">
                <FontAwesome6 name="text-height" size={11} color={theme.text2} />
                <Text style={{ color: theme.text2, fontSize: 12, fontWeight: "500" }}>{wordCount}</Text>
                <Text style={{ color: theme.text2, fontSize: 11 }}>字</Text>
              </View>
              <View className="w-px h-3" style={{ backgroundColor: theme.border }} />
              {chapterList.length > 0 && (
                <View className="flex-row items-center gap-1.5">
                  <FontAwesome6 name="book" size={11} color={theme.text2} />
                  <Text style={{ color: theme.text2, fontSize: 12 }}>{chapterList.findIndex(c => c.id === chapterId) + 1}/{chapterList.length}</Text>
                </View>
              )}
              {showSpeed && (
                <>
                  <View className="w-px h-3" style={{ backgroundColor: theme.border }} />
                  <View className="flex-row items-center gap-1.5">
                    <FontAwesome6 name="gauge-high" size={11} color="#8B5CF6" />
                    <Text style={{ color: "#8B5CF6", fontSize: 12, fontWeight: "600" }}>{wpm}</Text>
                    <Text style={{ color: theme.text2, fontSize: 11 }}>字/分</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* ===== 精简工具栏 ===== */}
          <View style={{
            backgroundColor: nightMode ? "#1A1A2E" : "#FFFFFF",
            borderBottomWidth: 1, borderBottomColor: theme.border,
          }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-3 py-2">
              <View className="flex-row items-center gap-2">
                <ToolbarButton icon="align-left" label="排版" color={theme.accent} bg={theme.accentBg} onPress={handleFormat} textColor={theme.text} nightMode={nightMode} />
                <ToolbarButton icon="rotate-left" label="撤销" color={theme.text2} bg={theme.surface2} onPress={handleUndo} textColor={theme.text2} nightMode={nightMode} disabled={undoStack.length === 0} />
                <ToolbarButton icon="rotate-right" label="恢复" color={theme.text2} bg={theme.surface2} onPress={handleRedo} textColor={theme.text2} nightMode={nightMode} disabled={redoStack.length === 0} />
                <View className="w-px h-5" style={{ backgroundColor: theme.border }} />
                <ToolbarButton icon="wand-sparkles" label="AI创作" color={theme.accent} bg={theme.accentBg} onPress={() => { setAiMode("generate"); setAiPrompt(""); setAiModalVisible(true); }} textColor={theme.text} nightMode={nightMode} />
                <ToolbarButton icon="search" label="搜索" color={theme.text2} bg={theme.surface2} onPress={() => setSearchVisible(true)} textColor={theme.text2} nightMode={nightMode} />
                <ToolbarButton icon="eye" label="预览" color={theme.text2} bg={theme.surface2} onPress={handlePreview} textColor={theme.text2} nightMode={nightMode} />
              </View>
            </ScrollView>
          </View>

          {/* ===== 编辑区(全屏) ===== */}
          <View className="flex-1" style={{ backgroundColor: nightMode ? "#0A0A14" : "#FAFAFA" }}>
            {showFloatingAI && selectedText && (
              <View className="px-4 pt-2 pb-0" style={{
                borderBottomWidth: 1, borderBottomColor: nightMode ? "#2D2D4A" : "rgba(99,102,241,0.08)",
                backgroundColor: nightMode ? "#16162A" : "#FFFFFF",
                shadowColor: "#6366F1",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: nightMode ? 0 : 0.06,
                shadowRadius: 8,
                elevation: 3,
                zIndex: 100,
              }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-2.5">
                  <View className="flex-row items-center gap-1">
                    <FloatingAIBtn icon="scissors" label="裁剪" color="#6B7280" onPress={() => replaceSelectedText("")} />
                  <FloatingAIBtn icon="copy" label="复制" color="#6B7280" onPress={async () => { await Clipboard.setStringAsync(selectedText); setShowFloatingAI(false); }} />
                  <FloatingAIBtn icon="paste" label="粘贴" color="#6B7280" onPress={async () => { const t = await Clipboard.getStringAsync(); if (t) replaceSelectedText(t); }} />
                  <FloatingAIBtn icon="text-width" label="全选" color="#6B7280" onPress={() => contentInputRef.current?.focus()} />
                  <View className="w-px h-6 mx-1" style={{ backgroundColor: theme.border }} />
                  <FloatingAIBtn icon="highlighter" label="高亮" color="#F59E0B" onPress={() => { setHighlights(prev => [...prev, { start: selectionStart, end: selectionEnd, color: "#FDE68A" }]); setShowFloatingAI(false); Alert.alert("已高亮"); }} />
                  <FloatingAIBtn icon="flag" label="伏笔" color="#8B5CF6" onPress={() => { replaceSelectedText(selectedText + "（伏笔）"); Alert.alert("已标记"); }} />
                  <FloatingAIBtn icon="user" label="角色" color="#3B82F6" onPress={() => { setAssistType("characters"); setAssistModalVisible(true); setShowFloatingAI(false); }} />
                  <FloatingAIBtn icon="gear" label="设定" color="#10B981" onPress={() => { setAssistType("settings"); setAssistModalVisible(true); setShowFloatingAI(false); }} />
                  <View className="w-px h-6 mx-1" style={{ backgroundColor: theme.border }} />
                  <FloatingAIBtn icon="pen" label="润写" color="#EC4899" onPress={() => {
                    setIsGenerating(true); setGeneratedContent(""); setShowFloatingAI(false);
                    const sse = new RNSSE(`${API_BASE}/api/v1/writing/generate`, {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ prompt: `润色以下文字，更优美流畅:\n${selectedText}`, style: "default", wordCount: 500 }),
                    });
                    sseRef.current = sse;
                    sse.addEventListener("message", (e: any) => {
                      if (e.data === "[DONE]") { sse.close(); setIsGenerating(false); return; }
                      try { const p = JSON.parse(e.data); if (p.content) setGeneratedContent(prev => prev + p.content); } catch {}
                    });
                  }} />
                  <FloatingAIBtn icon="expand" label="扩写" color="#10B981" onPress={() => {
                    setIsGenerating(true); setGeneratedContent(""); setShowFloatingAI(false);
                    const sse = new RNSSE(`${API_BASE}/api/v1/writing/generate`, {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ prompt: `扩写以下内容，增加细节不改变原意:\n${selectedText}`, style: "default", wordCount: 500 }),
                    });
                    sseRef.current = sse;
                    sse.addEventListener("message", (e: any) => {
                      if (e.data === "[DONE]") { sse.close(); setIsGenerating(false); return; }
                      try { const p = JSON.parse(e.data); if (p.content) setGeneratedContent(prev => prev + p.content); } catch {}
                    });
                  }} />
                </View>
              </ScrollView>
            </View>
          )}

            {/* ===== 全屏编辑区 ===== */}
            <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
              <View style={{
                paddingHorizontal: 24, paddingTop: 20,
                maxWidth: 720, alignSelf: "center", width: "100%", flex: 1,
              }}>
                {/* 章节标题 */}
                <TextInput
                  value={chapterTitle} onChangeText={setChapterTitle}
                  className="text-2xl font-bold mb-1"
                  style={{ color: theme.text, lineHeight: 38 }}
                  placeholder="章节标题" placeholderTextColor={nightMode ? "#4A4A6A" : "#C0C0C0"}
                />
                <View className="mb-5" style={{
                  width: 44, height: 3, borderRadius: 2, backgroundColor: theme.accent, opacity: 0.5,
                }} />

                {/* 正文编辑区 - 全屏 */}
                <TextInput
                  ref={contentInputRef}
                  value={content}
                  onChangeText={(t) => { pushUndo(t); setContent(t); }}
                  onSelectionChange={handleSelectionChange}
                  multiline
                  className="w-full"
                  style={{
                    color: theme.text, fontSize: 17, lineHeight: 32,
                    flex: 1, minHeight: 600, textAlignVertical: "top",
                  }}
                  placeholder="开始创作你的故事..."
                  placeholderTextColor={nightMode ? "#4A4A6A" : "#C0C0C0"}
                  />
                <View style={{ height: 120 }} />
              </View>
            </ScrollView>
          </View>

          {/* ===== AI生成区(浮动面板) ===== */}
          {isGenerating && (
            <View style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              backgroundColor: nightMode ? "#1A1A2E" : "#FFFFFF",
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              paddingHorizontal: 20, paddingTop: 16, paddingBottom: Platform.OS === "ios" ? 34 : 20,
              shadowColor: "#6366F1",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 20,
              elevation: 16,
              borderTopWidth: 1,
              borderTopColor: nightMode ? "#3A3A6E" : "rgba(99,102,241,0.12)",
            }}>
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-2.5">
                  <View className="w-8 h-8 rounded-xl items-center justify-center" style={{ backgroundColor: theme.accentBg }}>
                    <FontAwesome6 name="wand-sparkles" size={14} color={theme.accent} />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: theme.accent }}>AI</Text>
                  {generatedContent && (
                    <Text style={{ fontSize: 12, color: theme.text2 }}>(约{generatedContent.length}字)</Text>
                  )}
                </View>
                <TouchableOpacity onPress={handleStopGeneration}
                  className="px-3 py-1.5 rounded-lg"
                  style={{ backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6" }}>
                  <Text className="text-xs font-medium" style={{ color: theme.text2 }}>关闭</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 160 }} className="mb-3">
                <Text className="text-[15px] leading-relaxed" style={{ color: theme.text }}>
                  {generatedContent || (
                    <View className="flex-row items-center gap-2">
                      <Text style={{ color: theme.text2, fontStyle: "italic" }}>思考中</Text>
                      <Text style={{ color: theme.accent, fontSize: 18 }}>...</Text>
                    </View>
                  )}
                </Text>
              </ScrollView>
              {generatedContent && (
                <View className="flex-row gap-3">
                  <TouchableOpacity onPress={applyGeneratedContent}
                    className="flex-1 py-3 rounded-2xl items-center flex-row justify-center gap-2"
                    style={{ backgroundColor: theme.accent }}>
                    <FontAwesome6 name="check" size={13} color="#FFFFFF" />
                    <Text className="text-white text-sm font-bold">采用</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleStopGeneration}
                    className="flex-1 py-3 rounded-2xl items-center flex-row justify-center gap-2"
                    style={{ backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6" }}>
                    <FontAwesome6 name="ban" size={13} color={theme.text2} />
                    <Text className="text-sm font-medium" style={{ color: theme.text }}>取消</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ===== 更多菜单 Modal ===== */}
        <Modal visible={moreMenuVisible} transparent animationType="slide" onRequestClose={() => setMoreMenuVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setMoreMenuVisible(false)} className="flex-1 bg-black/50 justify-end">
            <TouchableOpacity activeOpacity={1} onPress={() => undefined}
              style={{
                backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
                maxHeight: "85%", shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.1, shadowRadius: 20, elevation: 16,
              }}>
              <ScrollView className="px-5 pt-5 pb-8">
                {/* 头部 */}
                <View className="flex-row items-center justify-between mb-6">
                  <View className="flex-row items-center gap-2.5">
                    <View className="w-9 h-9 rounded-2xl items-center justify-center" style={{ backgroundColor: theme.accentBg }}>
                      <FontAwesome6 name="sliders" size={15} color={theme.accent} />
                    </View>
                    <View>
                      <Text className="text-lg font-bold" style={{ color: theme.text }}>更多功能</Text>
                      <Text className="text-[11px]" style={{ color: theme.text2 }}>创作工具集</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setMoreMenuVisible(false)}
                    style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
                    <FontAwesome6 name="xmark" size={14} color={theme.text2} />
                  </TouchableOpacity>
                </View>

                {/* 辅助功能 */}
                <MenuGrid
                  title="辅助功能"
                  items={[
                    { icon: "sitemap", label: "大纲", key: "outline", color: "#6366F1" },
                    { icon: "users", label: "角色", key: "characters", color: "#3B82F6" },
                    { icon: "gear", label: "设定", key: "settings", color: "#10B981" },
                    { icon: "note-sticky", label: "便签", key: "note", color: "#F59E0B" },
                    { icon: "book-open", label: "悬浮章节", key: "floatChapter", color: "#8B5CF6" },
                    { icon: "arrow-left", label: "悬浮上章", key: "prevChapter", color: "#EC4899" },
                  ]}
                  onPress={handleAssistAction} nightMode={nightMode} theme={theme}
                />

                {/* 智能助手 */}
                <MenuGrid
                  title="智能助手"
                  items={[
                    { icon: "wand-sparkles", label: "AI创作", key: "ai", color: "#6366F1" },
                    { icon: "user-plus", label: "快捷取名", key: "names", color: "#EC4899" },
                    { icon: "tags", label: "提取关键词", key: "quickWords", color: "#8B5CF6" },
                  ]}
                  onPress={handleAIAction} nightMode={nightMode} theme={theme}
                />

                {/* 常用工具 */}
                <MenuGrid
                  title="常用工具"
                  items={[
                    { icon: "rotate-left", label: "撤销", key: "undo", color: "#6B7280" },
                    { icon: "rotate-right", label: "恢复", key: "redo", color: "#6B7280" },
                    { icon: "check-double", label: "纠错", key: "correct", color: "#059669" },
                    { icon: "align-left", label: "排版", key: "format", color: "#6366F1" },
                    { icon: "copy", label: "复制全文", key: "copyAll", color: "#3B82F6" },
                    { icon: "file-circle-plus", label: "新建章节", key: "newChapter", color: "#8B5CF6" },
                    { icon: "search", label: "搜索", key: "search", color: "#F59E0B" },
                    { icon: "eye", label: "预览", key: "preview", color: "#10B981" },
                  ]}
                  onPress={handleToolAction} nightMode={nightMode} theme={theme}
                />

                {/* 写作设置 */}
                <Text className="text-xs font-semibold mb-3 tracking-wider" style={{ color: theme.text2, letterSpacing: 1 }}>写作设置</Text>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  <TouchableOpacity onPress={() => { setNightMode(!nightMode); setMoreMenuVisible(false); }}
                    className="flex-row items-center gap-2 px-4 py-3 rounded-2xl"
                    style={{ backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6" }}>
                    <FontAwesome6 name="moon" size={13} color={nightMode ? "#818cf8" : "#6B7280"} />
                    <Text className="text-sm" style={{ color: theme.text }}>{nightMode ? "白天模式" : "夜间模式"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setShowSpeed(!showSpeed); setMoreMenuVisible(false); }}
                    className="flex-row items-center gap-2 px-4 py-3 rounded-2xl"
                    style={{ backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6" }}>
                    <FontAwesome6 name="gauge-high" size={13} color="#8B5CF6" />
                    <Text className="text-sm" style={{ color: theme.text }}>时速 {showSpeed ? "✓" : ""}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setMoreMenuVisible(false); handleDeleteChapter(); }}
                    className="flex-row items-center gap-2 px-4 py-3 rounded-2xl"
                    style={{ backgroundColor: "#FEE2E2" }}>
                    <FontAwesome6 name="trash-can" size={13} color="#EF4444" />
                    <Text className="text-sm font-medium text-red-500">删除本章</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* ===== AI创作 Modal ===== */}
        <Modal visible={aiModalVisible} transparent animationType="slide">
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === "web"}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <View className="flex-1 justify-end bg-black/50">
                <View style={{
                  backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
                  padding: 24, maxHeight: "75%",
                }}>
                  <ScrollView>
                    <View className="flex-row items-center justify-between mb-6">
                      <View className="flex-row items-center gap-2.5">
                        <View className="w-9 h-9 rounded-2xl items-center justify-center" style={{ backgroundColor: theme.accentBg }}>
                          <FontAwesome6 name="wand-sparkles" size={15} color={theme.accent} />
                        </View>
                        <Text className="text-lg font-bold" style={{ color: theme.text }}>
                          {aiMode === "names" ? "AI起名"
                            : aiMode === "quick_words" ? "提取关键词"
                            : aiMode === "correct" ? "纠错结果"
                            : "AI创作助手"}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setAiModalVisible(false)}
                        style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
                        <FontAwesome6 name="xmark" size={14} color="#6B7280" />
                      </TouchableOpacity>
                    </View>

                    {/* AI模式Tab切换 */}
                    {aiMode !== "correct" && aiMode !== "quick_words" && (
                      <View className="flex-row gap-2 mb-5">
                        {[
                          { key: "generate", label: "续写", icon: "pen" },
                          { key: "expand", label: "扩写", icon: "expand" },
                          { key: "polish", label: "润色", icon: "wand-sparkles" },
                          { key: "names", label: "起名", icon: "user-plus" },
                        ].map(tab => (
                          <TouchableOpacity key={tab.key} onPress={() => setAiMode(tab.key as any)}
                            style={{
                              flexDirection: "row", alignItems: "center", gap: 5,
                              paddingHorizontal: 12, paddingVertical: 8,
                              borderRadius: 12,
                              backgroundColor: aiMode === tab.key ? theme.accent : (nightMode ? "#2D2D4A" : "#F3F4F6"),
                            }}>
                            <FontAwesome6 name={tab.icon} size={11} color={aiMode === tab.key ? "#FFF" : theme.text2} />
                            <Text className="text-[12px] font-medium"
                              style={{ color: aiMode === tab.key ? "#FFF" : theme.text }}>{tab.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* 起名模式 */}
                    {aiMode === "names" && (
                      <View>
                        <View className="flex-row gap-2 mb-4">
                          {[
                            { key: "person", label: "人物" },
                            { key: "item", label: "物品" },
                            { key: "ability", label: "能力" },
                            { key: "place", label: "地名" },
                          ].map(t => (
                            <TouchableOpacity key={t.key} onPress={() => setNameType(t.key as any)}
                              className="px-3 py-2 rounded-xl"
                              style={{
                                backgroundColor: nameType === t.key ? theme.accent : (nightMode ? "#2D2D4A" : "#F3F4F6"),
                              }}>
                              <Text className="text-xs font-medium" style={{ color: nameType === t.key ? "#FFF" : theme.text }}>{t.label}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <View className="rounded-2xl p-4 mb-4 min-h-[100px]" style={{ backgroundColor: nightMode ? "#1E1E38" : "#EEF2FF" }}>
                          {generatedContent
                            ? <Text className="text-sm leading-relaxed" style={{ color: theme.text }}>{generatedContent}</Text>
                            : <Text className="text-sm" style={{ color: theme.text2 }}>点击下方按钮开始生成</Text>}
                        </View>
                        <TouchableOpacity onPress={handleGenerateNames} disabled={isGenerating}
                          className="w-full py-3.5 rounded-2xl items-center flex-row justify-center gap-2"
                          style={{ backgroundColor: theme.accent, opacity: isGenerating ? 0.6 : 1 }}>
                          <FontAwesome6 name="wand-sparkles" size={14} color="#fff" />
                          <Text className="text-white font-bold text-sm">{isGenerating ? "生成中..." : "生成名称"}</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* 纠错/关键词 */}
                    {(aiMode === "correct" || aiMode === "quick_words") && (
                      <View>
                        <View className="rounded-2xl p-4 mb-4 min-h-[100px]" style={{ backgroundColor: nightMode ? "#1E1E38" : "#EEF2FF" }}>
                          {generatedContent
                            ? <Text className="text-sm leading-relaxed" style={{ color: theme.text }}>{generatedContent}</Text>
                            : <Text className="text-sm" style={{ color: theme.text2 }}>{aiMode === "correct" ? "正在纠错..." : "正在提取关键词..."}</Text>}
                        </View>
                        {generatedContent && (
                          <TouchableOpacity onPress={() => {
                            if (aiMode === "correct") { pushUndo(content); setContent(generatedContent); }
                            else setContent(prev => prev + "\n\n【关键词】" + generatedContent);
                            setAiModalVisible(false);
                          }}
                            className="w-full py-3.5 rounded-2xl items-center" style={{ backgroundColor: "#10B981" }}>
                            <Text className="text-white font-bold text-sm">
                              {aiMode === "correct" ? "替换全文" : "插入到正文"}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {/* 续写/扩写/润色 */}
                    {aiMode !== "names" && aiMode !== "quick_words" && aiMode !== "correct" && (
                      <View>
                        <Text className="text-sm font-medium mb-2" style={{ color: theme.text }}>
                          {aiMode === "generate" ? "写作指令" : aiMode === "expand" ? "扩写内容" : "润色要求"}
                        </Text>
                        <TextInput value={aiPrompt} onChangeText={setAiPrompt}
                          placeholder={aiMode === "generate" ? "告诉AI你想要写什么..." : "输入要求..."}
                          multiline numberOfLines={3}
                          className="w-full px-4 py-3.5 rounded-2xl border mb-4 text-sm leading-relaxed"
                          style={{
                            color: theme.text, backgroundColor: theme.inputBg,
                            borderColor: nightMode ? "#2D2D4A" : "#E5E7EB",
                          }}
                          placeholderTextColor="#999" />
                        <TouchableOpacity onPress={handleAIWrite} disabled={isGenerating}
                          className="w-full py-3.5 rounded-2xl items-center flex-row justify-center gap-2"
                          style={{ backgroundColor: theme.accent, opacity: isGenerating ? 0.6 : 1 }}>
                          <FontAwesome6 name="paper-plane" size={14} color="#fff" />
                          <Text className="text-white font-bold text-sm">{isGenerating ? "生成中..." : "开始创作"}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </ScrollView>
                </View>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </Modal>

        {/* ===== 大纲/角色/设定 ===== */}
        <Modal visible={assistModalVisible} transparent animationType="slide" onRequestClose={() => setAssistModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setAssistModalVisible(false)} className="flex-1 bg-black/40 justify-center">
            <TouchableOpacity activeOpacity={1} onPress={() => undefined}
              className="mx-5 max-h-[70%]" style={{
                backgroundColor: theme.surface, borderRadius: 24, padding: 24, shadowColor: "#000",
                shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 10,
              }}>
              <ScrollView>
                <View className="flex-row items-center justify-between mb-5">
                  <View className="flex-row items-center gap-2.5">
                    <View className="w-8 h-8 rounded-2xl items-center justify-center" style={{ backgroundColor: theme.accentBg }}>
                      <FontAwesome6 name={assistType === "outline" ? "sitemap" : assistType === "characters" ? "users" : "gear"} size={14} color={theme.accent} />
                    </View>
                    <Text className="text-lg font-bold" style={{ color: theme.text }}>
                      {assistType === "outline" ? "大纲" : assistType === "characters" ? "角色" : "设定"}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setAssistModalVisible(false)}
                    style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
                    <FontAwesome6 name="xmark" size={14} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                {assistType === "outline" && (
                  <View className="rounded-2xl p-5 min-h-[120px]" style={{ backgroundColor: nightMode ? "#1E1E38" : "#FFFBEB" }}>
                    <Text className="text-sm leading-relaxed" style={{ color: theme.text }} selectable>{bookOutline || "暂无大纲，请在书籍详情页创建"}</Text>
                  </View>
                )}
                {assistType === "characters" && (
                  <View className="rounded-2xl p-5" style={{ backgroundColor: nightMode ? "#1E1E38" : "#EFF6FF" }}>
                    <Text className="text-sm leading-relaxed" style={{ color: nightMode ? "#93C5FD" : "#2563EB" }}>
                      核心角色设定功能可在书籍详情页「设定」Tab中管理
                    </Text>
                  </View>
                )}
                {assistType === "settings" && (
                  <View className="rounded-2xl p-5" style={{ backgroundColor: nightMode ? "#1E1E38" : "#F0FDF4" }}>
                    <Text className="text-sm leading-relaxed" style={{ color: nightMode ? "#6EE7B7" : "#059669" }}>
                      世界观设定功能可在书籍详情页「设定」Tab中管理
                    </Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => setAssistModalVisible(false)}
                  className="mt-5 py-3.5 rounded-2xl items-center"
                  style={{ backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6" }}>
                  <Text className="text-sm font-medium" style={{ color: theme.text }}>关闭</Text>
                </TouchableOpacity>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* ===== 便签 ===== */}
        <Modal visible={noteVisible} transparent animationType="slide" onRequestClose={() => setNoteVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setNoteVisible(false)} className="flex-1 bg-black/40 justify-center">
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <TouchableOpacity activeOpacity={1} onPress={() => undefined}
                className="mx-5" style={{ backgroundColor: theme.surface, borderRadius: 24, padding: 24 }}>
                <View className="flex-row items-center gap-2.5 mb-4">
                  <View className="w-8 h-8 rounded-2xl items-center justify-center" style={{ backgroundColor: "#FEF3C7" }}>
                    <FontAwesome6 name="note-sticky" size={14} color="#F59E0B" />
                  </View>
                  <Text className="text-lg font-bold" style={{ color: theme.text }}>便签</Text>
                </View>
                <TextInput value={noteText} onChangeText={setNoteText}
                  placeholder="写下临时笔记..." multiline numberOfLines={4}
                  className="w-full px-4 py-3.5 rounded-2xl mb-4 text-sm leading-relaxed"
                  style={{ color: theme.text, backgroundColor: theme.inputBg, minHeight: 100 }}
                  placeholderTextColor="#999" />
                <View className="flex-row gap-3">
                  <TouchableOpacity onPress={() => setNoteVisible(false)}
                    className="flex-1 py-3.5 rounded-2xl items-center" style={{ backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6" }}>
                    <Text className="text-sm font-medium" style={{ color: theme.text }}>取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setNoteVisible(false); }}
                    className="flex-1 py-3.5 rounded-2xl items-center" style={{ backgroundColor: theme.accent }}>
                    <Text className="text-sm font-bold text-white">保存</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>

        {/* ===== 预览 ===== */}
        <Modal visible={previewVisible} transparent animationType="slide" onRequestClose={() => setPreviewVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setPreviewVisible(false)} className="flex-1 bg-black/40 justify-center">
            <TouchableOpacity activeOpacity={1} onPress={() => undefined}
              className="mx-4 max-h-[80%]" style={{ backgroundColor: theme.surface, borderRadius: 24, padding: 24 }}>
              <View className="flex-row items-center justify-between mb-5">
                <View className="flex-row items-center gap-2.5">
                  <View className="w-8 h-8 rounded-2xl items-center justify-center" style={{ backgroundColor: theme.accentBg }}>
                    <FontAwesome6 name="eye" size={14} color={theme.accent} />
                  </View>
                  <Text className="text-lg font-bold" style={{ color: theme.text }}>预览</Text>
                </View>
                <TouchableOpacity onPress={() => setPreviewVisible(false)}
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
                  <FontAwesome6 name="xmark" size={14} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <ScrollView className="max-h-[500px]">
                <Text className="text-xl font-bold mb-4" style={{ color: theme.text }}>{chapterTitle}</Text>
                <View className="mb-4" style={{ width: 40, height: 3, borderRadius: 2, backgroundColor: theme.accent, opacity: 0.4 }} />
                <Text className="text-base leading-8" style={{ color: theme.text }} selectable>{content}</Text>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* ===== 搜索替换 ===== */}
        <Modal visible={searchVisible} transparent animationType="slide" onRequestClose={() => setSearchVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setSearchVisible(false)} className="flex-1 bg-black/40 justify-center">
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <TouchableOpacity activeOpacity={1} onPress={() => undefined}
                className="mx-5" style={{ backgroundColor: theme.surface, borderRadius: 24, padding: 24 }}>
                <View className="flex-row items-center gap-2.5 mb-4">
                  <View className="w-8 h-8 rounded-2xl items-center justify-center" style={{ backgroundColor: "#FEF3C7" }}>
                    <FontAwesome6 name="search" size={14} color="#F59E0B" />
                  </View>
                  <Text className="text-lg font-bold" style={{ color: theme.text }}>搜索替换</Text>
                </View>
                <TextInput value={searchTerm} onChangeText={setSearchTerm} placeholder="搜索..."
                  className="w-full px-4 py-3.5 rounded-2xl mb-2 text-sm"
                  style={{ color: theme.text, backgroundColor: theme.inputBg }} placeholderTextColor="#999" />
                <TextInput value={replaceTerm} onChangeText={setReplaceTerm} placeholder="替换为..."
                  className="w-full px-4 py-3.5 rounded-2xl mb-4 text-sm"
                  style={{ color: theme.text, backgroundColor: theme.inputBg }} placeholderTextColor="#999" />
                <View className="flex-row gap-3">
                  <TouchableOpacity onPress={() => setSearchVisible(false)}
                    className="flex-1 py-3.5 rounded-2xl items-center" style={{ backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6" }}>
                    <Text className="text-sm font-medium" style={{ color: theme.text }}>取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSearchReplace} disabled={!searchTerm.trim()}
                    className="flex-1 py-3.5 rounded-2xl items-center" style={{ backgroundColor: theme.accent, opacity: !searchTerm.trim() ? 0.5 : 1 }}>
                    <Text className="text-sm font-bold text-white">替换全部</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>

        {/* ===== 悬浮章节 ===== */}
        <Modal visible={floatingChapterVisible} transparent animationType="fade" onRequestClose={() => setFloatingChapterVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setFloatingChapterVisible(false)} className="flex-1 bg-black/30 justify-end">
            <TouchableOpacity activeOpacity={1} onPress={() => undefined}
              className="mx-3 mb-6" style={{ backgroundColor: theme.surface, borderRadius: 24, padding: 20, maxHeight: "50%" }}>
              <Text className="text-sm font-bold mb-3" style={{ color: theme.text }}>{floatingChapterTitle}</Text>
              <ScrollView><Text className="text-sm leading-relaxed" style={{ color: theme.text2 }}>{floatingChapterContent}</Text></ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* ===== 悬浮上章 ===== */}
        <Modal visible={prevChapterVisible} transparent animationType="fade" onRequestClose={() => setPrevChapterVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setPrevChapterVisible(false)} className="flex-1 bg-black/30 justify-end">
            <TouchableOpacity activeOpacity={1} onPress={() => undefined}
              className="mx-3 mb-6" style={{ backgroundColor: theme.surface, borderRadius: 24, padding: 20, maxHeight: "50%" }}>
              <Text className="text-xs font-bold mb-3" style={{ color: theme.accent }}>上一章</Text>
              <ScrollView><Text className="text-sm leading-relaxed" style={{ color: theme.text2 }}>{prevChapterContent || "(暂无内容)"}</Text></ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

      </KeyboardAvoidingView>
    </Screen>
  );
}

// ===== 子组件 =====

function ToolbarButton({ icon, label, color, bg, onPress, textColor, nightMode, disabled }: {
  icon: string; label: string; color: string; bg: string;
  onPress: () => void; textColor: string; nightMode: boolean; disabled?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled}
      style={{
        flexDirection: "row", alignItems: "center", gap: 5,
        paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10,
        backgroundColor: disabled ? (nightMode ? "#1E1E30" : "#F9FAFB") : bg,
        opacity: disabled ? 0.4 : 1,
      }}>
      <FontAwesome6 name={icon as any} size={12} color={disabled ? "#9CA3AF" : color} />
      <Text style={{ fontSize: 11, fontWeight: "600", color: disabled ? "#9CA3AF" : textColor }}>{label}</Text>
    </TouchableOpacity>
  );
}

function FloatingAIBtn({ icon, label, color, onPress }: {
  icon: string; label: string; color: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress}
      className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl"
      style={{ backgroundColor: `${color}15` }}>
      <FontAwesome6 name={icon as any} size={11} color={color} />
      <Text style={{ fontSize: 11, fontWeight: "600", color }}>{label}</Text>
    </TouchableOpacity>
  );
}

function MenuGrid({ title, items, onPress, nightMode, theme }: {
  title: string; items: { icon: string; label: string; key: string; color: string }[];
  onPress: (key: string) => void; nightMode: boolean; theme: any;
}) {
  return (
    <>
      <Text className="text-xs font-semibold mb-3 tracking-wider" style={{ color: theme.text2, letterSpacing: 1 }}>{title}</Text>
      <View className="flex-row flex-wrap gap-2 mb-6">
        {items.map(item => (
          <TouchableOpacity key={item.key} onPress={() => onPress(item.key)}
            style={{
              flexDirection: "row", alignItems: "center", gap: 6,
              paddingHorizontal: 12, paddingVertical: 10,
              borderRadius: 14,
              backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6",
            }}>
            <FontAwesome6 name={item.icon as any} size={12} color={item.color} />
            <Text className="text-[12px] font-medium" style={{ color: theme.text }}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}