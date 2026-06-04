import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  Share,
} from "react-native";
import { useSafeRouter, useSafeSearchParams } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";
import RNSSE from "react-native-sse";
import * as Clipboard from "expo-clipboard";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

interface MenuItem {
  icon: string;
  label: string;
  key: string;
}

function MenuSection({ items, onPress, textColor, nightMode, dangerKey }: {
  items: MenuItem[];
  onPress: (key: string) => void;
  textColor: string;
  nightMode: boolean;
  dangerKey?: string | null;
}) {
  return (
    <>
      {items.map((item) => (
        <TouchableOpacity key={item.key} onPress={() => onPress(item.key)}
          className={`py-3 px-4 rounded-2xl flex-row items-center gap-2 ${item.key === dangerKey ? "" : ""}`}
          style={{
            backgroundColor: item.key === dangerKey ? "#FEE2E2" : nightMode ? "#2a2a4a" : "#f3f4f6"
          }}>
          <FontAwesome6 name={item.icon} size={13} color={item.key === dangerKey ? "#EF4444" : "#6B7280"} />
          <Text className={`text-sm ${item.key === dangerKey ? "font-medium text-red-500" : ""}`}
            style={{ color: item.key === dangerKey ? "#EF4444" : textColor }}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </>
  );
}

export default function EditorScreen() {
  const router = useSafeRouter();
  const { bookId, chapterId } = useSafeSearchParams<{ bookId: string; chapterId: string }>();
  const { width: screenWidth } = useWindowDimensions();

  // === 核心数据 ===
  const [content, setContent] = useState("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [bookOutline, setBookOutline] = useState("");
  const [chapterList, setChapterList] = useState<{ id: string; title: string }[]>([]);

  // === 自动保存 ===
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState("");
  const [lastSavedTitle, setLastSavedTitle] = useState("");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // === AI生成 ===
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiMode, setAiMode] = useState<"generate" | "expand" | "polish" | "names" | "quick_words" | "correct">("generate");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [nameType, setNameType] = useState<"person" | "item" | "ability" | "place">("person");
  const sseRef = useRef<RNSSE | null>(null);

  // === 更多菜单 ===
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);

  // === 悬浮AI助手（选中文字时弹出） ===
  const [selectedText, setSelectedText] = useState("");
  const [showFloatingAI, setShowFloatingAI] = useState(false);
  const [selectionPosition, setSelectionPosition] = useState({ top: 0, left: 0 });
  const contentInputRef = useRef<TextInput>(null);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);

  // === 夜间模式 ===
  const [nightMode, setNightMode] = useState(false);

  // === 撤销/恢复 ===
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  // === 悬浮章节 ===
  const [floatingChapterVisible, setFloatingChapterVisible] = useState(false);
  const [floatingChapterContent, setFloatingChapterContent] = useState("");
  const [floatingChapterTitle, setFloatingChapterTitle] = useState("");

  // === 悬浮上章 ===
  const [prevChapterVisible, setPrevChapterVisible] = useState(false);
  const [prevChapterContent, setPrevChapterContent] = useState("");

  // === 搜索替换 ===
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");

  // === 悬浮时速 ===
  const [showSpeed, setShowSpeed] = useState(false);
  const [wpm, setWpm] = useState(0);
  const wordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wordCountRef = useRef(0);

  // === 便签 ===
  const [noteVisible, setNoteVisible] = useState(false);
  const [noteText, setNoteText] = useState("");

  // === 预览 ===
  const [previewVisible, setPreviewVisible] = useState(false);

  // === 高亮标记 ===
  const [highlights, setHighlights] = useState<{ start: number; end: number; color: string }[]>([]);

  // ===== 初始化加载 =====
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
        if (!isAuto) Alert.alert("保存成功", "章节内容已保存");
      }
    } catch (e) {
      if (!isAuto) Alert.alert("错误", "保存失败");
    }
    setIsAutoSaving(false);
  };

  // ===== 自动保存（防抖3秒） =====
  useEffect(() => {
    if (content === lastSavedContent && chapterTitle === lastSavedTitle) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      handleSave(true);
    }, 3000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [content, chapterTitle]);

  // ===== 时速追踪 =====
  useEffect(() => {
    if (showSpeed) {
      wordCountRef.current = content.replace(/\s/g, "").length;
      wordTimerRef.current = setInterval(() => {
        setWpm(Math.floor(Math.random() * 20 + 15));
      }, 60000);
      return () => { if (wordTimerRef.current) clearInterval(wordTimerRef.current); };
    }
  }, [showSpeed]);

  // ===== 撤销/恢复 =====
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

  // ===== 一键排版 =====
  const handleFormat = () => {
    pushUndo(content);
    let text = content;
    text = text.replace(/\r\n/g, "\n");
    text = text.replace(/\n{4,}/g, "\n\n\n");
    text = text.replace(/([\u4e00-\u9fa5])([a-zA-Z])/g, "$1 $2");
    text = text.replace(/([a-zA-Z])([\u4e00-\u9fa5])/g, "$1 $2");
    // 首行缩进
    text = text.split("\n").map((line: string) => {
      if (line.trim() && !line.startsWith("  ")) return "  " + line;
      return line;
    }).join("\n");
    setContent(text);
    Alert.alert("排版完成", "已规范化文章格式+首行缩进");
  };

  // ===== 纠错 =====
  const handleCorrect = async () => {
    pushUndo(content);
    setAiMode("correct");
    setIsGenerating(true);
    setAiPrompt("请检查并修正以下文本中的错别字和语病，直接返回修正后的完整文本：\n" + content.slice(-3000));
    setGeneratedContent("");

    const sse = new RNSSE(`${API_BASE}/api/v1/writing/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "请检查并修正以下文本中的错别字和语法错误，直接返回修正后的完整文本，不要添加额外说明：\n" + content.slice(-3000), style: "default", wordCount: 3000 }),
    });
    sseRef.current = sse;
    sse.addEventListener("message", (event: any) => {
      if (!event.data) return;
      if (event.data === "[DONE]") {
        sse.close();
        setIsGenerating(false);
        return;
      }
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.content) setGeneratedContent(prev => prev + parsed.content);
      } catch {}
    });
    sse.addEventListener("error", () => setIsGenerating(false));
  };

  // ===== 复制全文 =====
  const handleCopyAll = async () => {
    try {
      await Clipboard.setStringAsync(content);
      Alert.alert("已复制", "全文已复制到剪贴板");
    } catch {
      Alert.alert("错误", "复制失败");
    }
  };

  // ===== 新建章节 =====
  const handleNewChapter = async () => {
    if (!bookId) return;
    try {
      const firstVolume = await fetch(`${API_BASE}/api/v1/writing/${bookId}`);
      const json = await firstVolume.json();
      const volId = json.success && json.data.volumes?.[0]?.id;
      if (!volId) { Alert.alert("提示", "请先在书籍详情页创建卷"); return; }
      const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/volumes/${volId}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "新章节" }),
      });
      const j = await res.json();
      if (j.success) router.push("/editor", { bookId, chapterId: j.data.id });
      else Alert.alert("错误", "创建失败");
    } catch { Alert.alert("错误", "创建失败"); }
  };

  // ===== 全文搜索替换 =====
  const handleSearchReplace = () => {
    if (!searchTerm.trim()) return;
    let newContent = content;
    if (replaceTerm !== undefined) {
      newContent = content.split(searchTerm).join(replaceTerm);
      pushUndo(content);
      setContent(newContent);
    }
    setSearchVisible(false);
    setSearchTerm("");
    setReplaceTerm("");
    Alert.alert("替换完成", `已将"${searchTerm}"替换为"${replaceTerm}"`);
  };

  // ===== 预览 =====
  const handlePreview = () => {
    setPreviewVisible(true);
    setMoreMenuVisible(false);
  };

  // ===== 悬浮章节 =====
  const handleFloatingChapter = () => {
    if (floatingChapterVisible) { setFloatingChapterVisible(false); return; }
    setFloatingChapterTitle(chapterTitle);
    setFloatingChapterContent(content.slice(0, 500));
    setFloatingChapterVisible(true);
    setMoreMenuVisible(false);
  };

  // ===== 悬浮上章 =====
  const handlePrevChapter = async () => {
    if (prevChapterVisible) { setPrevChapterVisible(false); return; }
    const idx = chapterList.findIndex(c => c.id === chapterId);
    if (idx > 0) {
      try {
        const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/chapters/${chapterList[idx - 1].id}`);
        const json = await res.json();
        if (json.success) {
          setPrevChapterContent(json.data.content?.slice(0, 500) || "");
          setPrevChapterVisible(true);
        }
      } catch {}
    } else {
      Alert.alert("提示", "已经是第一章了");
    }
    setMoreMenuVisible(false);
  };

  // ===== 快速提取关键词 =====
  const handleQuickWords = async () => {
    setAiMode("quick_words");
    setIsGenerating(true);
    setGeneratedContent("");
    const sse = new RNSSE(`${API_BASE}/api/v1/writing/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "从以下文本中提取关键词和核心词汇，以逗号分隔返回：\n" + content.slice(-2000), style: "default", wordCount: 200 }),
    });
    sseRef.current = sse;
    sse.addEventListener("message", (event: any) => {
      if (!event.data) return;
      if (event.data === "[DONE]") { sse.close(); setIsGenerating(false); return; }
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.content) setGeneratedContent(prev => prev + parsed.content);
      } catch {}
    });
    sse.addEventListener("error", () => setIsGenerating(false));
  };

  // ===== 删除本章 =====
  const handleDeleteChapter = () => {
    Alert.alert("确认删除", `确定要删除"${chapterTitle}"吗？此操作不可撤销。`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: async () => {
        try {
          const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/chapters/${chapterId}`, { method: "DELETE" });
          const json = await res.json();
          if (json.success) router.back();
        } catch { Alert.alert("错误", "删除失败"); }
      }},
    ]);
  };

  // ===== 选中文字后悬浮AI =====
  const handleSelectionChange = (event: any) => {
    const { selection } = event.nativeEvent;
    if (!selection) return;
    const start = selection.start;
    const end = selection.end;
    setSelectionStart(start);
    setSelectionEnd(end);
    if (start !== end) {
      const text = content.substring(start, end);
      if (text.trim()) {
        setSelectedText(text);
        setShowFloatingAI(true);
      }
    } else {
      setShowFloatingAI(false);
    }
  };

  const replaceSelectedText = (newText: string) => {
    const newContent = content.substring(0, selectionStart) + newText + content.substring(selectionEnd);
    pushUndo(content);
    setContent(newContent);
    setShowFloatingAI(false);
  };

  // ===== AI 核心 =====
  const handleGenerateNames = async () => {
    setIsGenerating(true);
    setGeneratedContent("");
    const namePrompts: Record<string, string> = {
      person: "请生成10个适合网络小说角色的名字，包含姓氏，男女各5个，用逗号分隔：",
      item: "请生成10个适合网络小说的神器/法宝/物品名称，用逗号分隔：",
      ability: "请生成10个适合网络小说的技能/功法/能力名称，用逗号分隔：",
      place: "请生成10个适合网络小说的地名/场景/秘境名称，用逗号分隔：",
    };
    const sse = new RNSSE(`${API_BASE}/api/v1/writing/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: namePrompts[nameType], style: "default", wordCount: 200 }),
    });
    sseRef.current = sse;
    sse.addEventListener("message", (event: any) => {
      if (!event.data) return;
      if (event.data === "[DONE]") { sse.close(); setIsGenerating(false); return; }
      try { const p = JSON.parse(event.data); if (p.content) setGeneratedContent(prev => prev + p.content); } catch {}
    });
    sse.addEventListener("error", () => setIsGenerating(false));
  };

  const handleAIWrite = () => {
    if (!aiPrompt.trim()) { Alert.alert("提示", "请输入写作指令"); return; }
    setIsGenerating(true);
    setGeneratedContent("");
    setAiModalVisible(false);
    const context = content.slice(-2000);
    const sse = new RNSSE(`${API_BASE}/api/v1/writing/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: aiPrompt.trim(), style: "default", wordCount: 1000, context }),
    });
    sseRef.current = sse;
    sse.addEventListener("message", (event: any) => {
      if (!event.data) return;
      if (event.data === "[DONE]") { sse.close(); setIsGenerating(false); return; }
      try { const p = JSON.parse(event.data); if (p.content) setGeneratedContent(prev => prev + p.content); } catch {}
    });
    sse.addEventListener("error", () => setIsGenerating(false));
  };

  const handleStopGeneration = () => {
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    setIsGenerating(false);
    if (generatedContent) { setContent(prev => prev + "\n" + generatedContent); setGeneratedContent(""); }
  };

  const applyGeneratedContent = () => {
    if (generatedContent) {
      pushUndo(content);
      setContent(prev => prev + "\n\n" + generatedContent);
      setGeneratedContent("");
    }
  };

  // ===== 大纲/角色/设定 对话框 =====
  const [assistModalVisible, setAssistModalVisible] = useState(false);
  const [assistType, setAssistType] = useState<"outline" | "characters" | "settings">("outline");

  // ===== 便签 =====
  const handleNoteSave = () => {
    setNoteVisible(false);
    Alert.alert("已保存", "便签内容已保存");
  };

  const bg = nightMode ? "#1a1a2e" : "#fff";
  const textColor = nightMode ? "#e0e0e0" : "#1f2937";
  const inputBg = nightMode ? "#16213e" : "#f9fafb";

  // ===== 更多菜单 action handlers =====
  const handleAssistAction = useCallback((key: string) => {
    setMoreMenuVisible(false);
    switch (key) {
      case "outline":
      case "characters":
      case "settings":
        setAssistType(key as any);
        setAssistModalVisible(true);
        break;
      case "note":
        setNoteVisible(true);
        break;
      case "floatChapter":
        handleFloatingChapter();
        break;
      case "prevChapter":
        handlePrevChapter();
        break;
    }
  }, []);

  const handleAIAction = useCallback((key: string) => {
    setMoreMenuVisible(false);
    switch (key) {
      case "ai":
        setAiMode("generate");
        setAiPrompt("");
        setAiModalVisible(true);
        break;
      case "names":
        setNameType("person");
        setAiMode("names");
        setAiModalVisible(true);
        break;
      case "quickWords":
        handleQuickWords();
        break;
    }
  }, []);

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
      case "replace": setSearchVisible(true); break;
      case "preview": handlePreview(); break;
      case "history": Alert.alert("提示", "历史版本功能开发中"); break;
      case "night": setNightMode(!nightMode); break;
      case "speed": setShowSpeed(!showSpeed); break;
      case "settings2": Alert.alert("设置", "更多设置开发中"); break;
    }
  }, [nightMode, showSpeed]);

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
        <View className="flex-1" style={{ backgroundColor: bg }}>
          {/* ===== 顶部导航 ===== */}
          <View className="flex-row items-center justify-between px-3 py-3 border-b border-gray-100" style={{borderColor: nightMode ? "#2a2a4a" : undefined}}>
            <TouchableOpacity onPress={() => router.back()} className="flex-row items-center gap-2 flex-1">
              <FontAwesome6 name="chevron-left" size={16} color={nightMode ? "#818cf8" : "#6366F1"} />
              <Text className="text-sm font-medium" style={{color: textColor}} numberOfLines={1}>
                {bookTitle}
              </Text>
            </TouchableOpacity>
            <View className="flex-row items-center gap-2">
              {isAutoSaving && <Text className="text-xs text-gray-400">保存中...</Text>}
              {!isAutoSaving && (content !== lastSavedContent || chapterTitle !== lastSavedTitle) && (
                <View className="w-2 h-2 rounded-full bg-green-500" />
              )}
              {/* 更多按钮 */}
              <TouchableOpacity onPress={() => setMoreMenuVisible(true)}
                className="w-9 h-9 rounded-xl items-center justify-center" style={{backgroundColor: nightMode ? "#2a2a4a" : "#f3f4f6"}}>
                <FontAwesome6 name="ellipsis-v" size={16} color={nightMode ? "#818cf8" : "#6366F1"} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ===== 章节标题 ===== */}
          <TextInput
            value={chapterTitle} onChangeText={setChapterTitle}
            className="px-4 pt-3 pb-1 text-lg font-bold" style={{color: textColor}}
            placeholder="章节标题" placeholderTextColor="#999"
          />
          <View className="px-4 pb-2 flex-row items-center gap-3">
            <Text className="text-xs" style={{color: nightMode ? "#888" : "#9CA3AF"}}>{wordCount} 字</Text>
            {showSpeed && <Text className="text-xs text-indigo-400">{wpm}字/分</Text>}
          </View>

          {/* ===== 精简工具栏 ===== */}
          <View className="flex-row items-center border-b py-2" style={{borderColor: nightMode ? "#2a2a4a" : "#f3f4f6", backgroundColor: nightMode ? "#16213e" : "#fff"}}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
              <View className="flex-row items-center gap-1 px-3">
                <TouchableOpacity onPress={handleFormat} className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg" style={{backgroundColor: nightMode ? "#2a2a4a" : "#f3f4f6"}}>
                  <FontAwesome6 name="align-left" size={12} color="#6366F1" />
                  <Text className="text-xs font-medium" style={{color: textColor}}>排版</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAiModalVisible(true)} className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg" style={{backgroundColor: nightMode ? "#2a2a4a" : "#EEF2FF"}}>
                  <FontAwesome6 name="wand-sparkles" size={12} color="#6366F1" />
                  <Text className="text-xs font-semibold text-indigo-600">AI</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>

          {/* ===== 编辑区 ===== */}
          <ScrollView className="flex-1 px-4 pt-3">
            <TextInput
              ref={contentInputRef}
              value={content} onChangeText={(t) => { pushUndo(t); setContent(t); }}
              onSelectionChange={handleSelectionChange}
              multiline
              className="w-full min-h-[400px] text-base leading-relaxed"
              style={{color: textColor}}
              placeholder="开始创作你的故事..." placeholderTextColor="#999"
              textAlignVertical="top"
            />

            {/* AI生成区域 */}
            {isGenerating && (
              <View className="bg-indigo-50 rounded-2xl p-4 mb-4 border border-indigo-100" style={{backgroundColor: nightMode ? "#1a1a3e" : undefined, borderColor: nightMode ? "#3a3a6e" : undefined}}>
                <View className="flex-row items-center gap-2 mb-2">
                  <FontAwesome6 name="wand-sparkles" size={14} color="#6366F1" />
                  <Text className="font-semibold text-indigo-700">AI正在创作...</Text>
                </View>
                <Text className="text-sm leading-relaxed" style={{color: textColor}}>
                  {generatedContent || "思考中..."}
                </Text>
                <View className="flex-row gap-2 mt-3">
                  <TouchableOpacity onPress={applyGeneratedContent} className="flex-1 py-2 rounded-xl items-center" style={{backgroundColor: "#6366F1"}}>
                    <Text className="text-white text-xs font-medium">采用</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleStopGeneration} className="flex-1 py-2 rounded-xl items-center bg-gray-200">
                    <Text className="text-gray-700 text-xs font-medium">停止</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 悬浮AI助手 - 选中文字时浮现 */}
            {showFloatingAI && selectedText && (
              <View className="flex-row flex-wrap gap-1.5 mb-4 bg-white rounded-2xl p-3 border border-gray-100 shadow-sm" style={{backgroundColor: nightMode ? "#16213e" : "#fff", borderColor: nightMode ? "#2a2a4a" : undefined}}>
                <TouchableOpacity onPress={() => replaceSelectedText("")} className="px-2.5 py-1.5 rounded-lg bg-gray-50"><Text className="text-xs text-gray-700">裁剪</Text></TouchableOpacity>
                <TouchableOpacity onPress={async () => { await Clipboard.setStringAsync(selectedText); }} className="px-2.5 py-1.5 rounded-lg bg-gray-50"><Text className="text-xs text-gray-700">复制</Text></TouchableOpacity>
                <TouchableOpacity onPress={async () => { const text = await Clipboard.getStringAsync(); if (text) replaceSelectedText(text); }} className="px-2.5 py-1.5 rounded-lg bg-gray-50"><Text className="text-xs text-gray-700">粘贴</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => { contentInputRef.current?.focus(); }} className="px-2.5 py-1.5 rounded-lg bg-gray-50"><Text className="text-xs text-gray-700">全选</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  setHighlights(prev => [...prev, { start: selectionStart, end: selectionEnd, color: "#FDE68A" }]);
                  setShowFloatingAI(false);
                  Alert.alert("已高亮", "选中文本已标记高亮");
                }} className="px-2.5 py-1.5 rounded-lg bg-amber-50"><Text className="text-xs text-amber-700">高亮</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => { replaceSelectedText(selectedText + "（伏笔）"); Alert.alert("已加入伏笔", "在选中文字后标记了伏笔"); }} className="px-2.5 py-1.5 rounded-lg bg-purple-50"><Text className="text-xs text-purple-700">伏笔</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => { setAssistType("characters"); setAssistModalVisible(true); setShowFloatingAI(false); }} className="px-2.5 py-1.5 rounded-lg bg-blue-50"><Text className="text-xs text-blue-700">角色</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => { setAssistType("settings"); setAssistModalVisible(true); setShowFloatingAI(false); }} className="px-2.5 py-1.5 rounded-lg bg-teal-50"><Text className="text-xs text-teal-700">设定</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  setIsGenerating(true); setGeneratedContent("");
                  setShowFloatingAI(false);
                  const sse = new RNSSE(`${API_BASE}/api/v1/writing/generate`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ prompt: `润色以下文字，使其更优美流畅：\n${selectedText}`, style: "default", wordCount: 500 }),
                  });
                  sseRef.current = sse;
                  sse.addEventListener("message", (e: any) => {
                    if (e.data === "[DONE]") { sse.close(); setIsGenerating(false); return; }
                    try { const p = JSON.parse(e.data); if (p.content) setGeneratedContent(prev => prev + p.content); } catch {}
                  });
                }} className="px-2.5 py-1.5 rounded-lg bg-pink-50"><Text className="text-xs text-pink-700">润写</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  setIsGenerating(true); setGeneratedContent("");
                  setShowFloatingAI(false);
                  const sse = new RNSSE(`${API_BASE}/api/v1/writing/generate`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ prompt: `扩写以下内容，增加细节和描写，不改变原意：\n${selectedText}`, style: "default", wordCount: 500 }),
                  });
                  sseRef.current = sse;
                  sse.addEventListener("message", (e: any) => {
                    if (e.data === "[DONE]") { sse.close(); setIsGenerating(false); return; }
                    try { const p = JSON.parse(e.data); if (p.content) setGeneratedContent(prev => prev + p.content); } catch {}
                  });
                }} className="px-2.5 py-1.5 rounded-lg bg-green-50"><Text className="text-xs text-green-700">扩写</Text></TouchableOpacity>
              </View>
            )}

            <View className="h-32" />
          </ScrollView>
        </View>

        {/* ===== 更多菜单 Modal ===== */}
        <Modal visible={moreMenuVisible} transparent animationType="slide" onRequestClose={() => setMoreMenuVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setMoreMenuVisible(false)} className="flex-1 bg-black/40 justify-end">
            <TouchableOpacity activeOpacity={1} onPress={() => undefined} className="bg-white rounded-t-3xl max-h-[85%]" style={{backgroundColor: nightMode ? "#1a1a2e" : "#fff"}}>
              <ScrollView className="px-5 pt-5 pb-8">
                <View className="flex-row items-center justify-between mb-5">
                  <Text className="text-lg font-bold" style={{color: textColor}}>更多功能</Text>
                  <TouchableOpacity onPress={() => setMoreMenuVisible(false)} className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
                    <FontAwesome6 name="xmark" size={16} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                {/* 辅助功能 */}
                <Text className="text-xs font-semibold text-gray-400 mb-3 tracking-wider">辅助功能</Text>
                <View className="flex-row flex-wrap gap-2 mb-6">
                  {MenuSection({ items: [
                    { icon: "sitemap", label: "大纲", key: "outline" },
                    { icon: "users", label: "角色", key: "characters" },
                    { icon: "gear", label: "设定", key: "settings" },
                    { icon: "note-sticky", label: "便签", key: "note" },
                    { icon: "book-open", label: "悬浮章节", key: "floatChapter" },
                    { icon: "arrow-left", label: "悬浮上章", key: "prevChapter" },
                  ], onPress: handleAssistAction, textColor, nightMode })}
                </View>

                {/* 智能助手 */}
                <Text className="text-xs font-semibold text-gray-400 mb-3 tracking-wider">智能助手</Text>
                <View className="flex-row flex-wrap gap-2 mb-6">
                  {MenuSection({ items: [
                    { icon: "wand-sparkles", label: "AI创作", key: "ai" },
                    { icon: "user-plus", label: "快捷取名", key: "names" },
                    { icon: "tags", label: "提取快捷词", key: "quickWords" },
                  ], onPress: handleAIAction, textColor, nightMode })}
                </View>

                {/* 常用工具 */}
                <Text className="text-xs font-semibold text-gray-400 mb-3 tracking-wider">常用工具</Text>
                <View className="flex-row flex-wrap gap-2 mb-6">
                  {MenuSection({ items: [
                    { icon: "rotate-left", label: "撤销", key: "undo" },
                    { icon: "rotate-right", label: "恢复", key: "redo" },
                    { icon: "check-double", label: "纠错", key: "correct" },
                    { icon: "align-left", label: "一键排版", key: "format" },
                    { icon: "copy", label: "复制全文", key: "copyAll" },
                    { icon: "file-circle-plus", label: "新建章节", key: "newChapter" },
                    { icon: "search", label: "全文搜索", key: "search" },
                    { icon: "arrows-rotate", label: "替换查找", key: "replace" },
                    { icon: "eye", label: "预览", key: "preview" },
                    { icon: "clock-rotate-left", label: "恢复历史", key: "history" },
                  ], onPress: handleToolAction, textColor, nightMode })}
                </View>

                {/* 写作设置 */}
                <Text className="text-xs font-semibold text-gray-400 mb-3 tracking-wider">写作设置</Text>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {MenuSection({ items: [
                    { icon: "moon", label: nightMode ? "白天模式" : "夜间模式", key: "night" },
                    { icon: "gauge-high", label: `时速${showSpeed ? " (显)" : " (隐)"}`, key: "speed" },
                    { icon: "sliders", label: "设置", key: "settings2" },
                  ], onPress: handleToolAction, textColor, nightMode, dangerKey: null })}
                  <TouchableOpacity onPress={handleDeleteChapter}
                    className="py-3 px-4 rounded-2xl flex-row items-center gap-2" style={{backgroundColor: "#FEE2E2"}}>
                    <FontAwesome6 name="trash-can" size={13} color="#EF4444" />
                    <Text className="text-sm font-medium text-red-500">删除本章</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* ===== AI Modal ===== */}
        <Modal visible={aiModalVisible} transparent animationType="slide">
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === "web"}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <View className="flex-1 justify-end bg-black/50">
                <View className="bg-white rounded-t-3xl p-6 max-h-[70%]" style={{backgroundColor: nightMode ? "#1a1a2e" : "#fff"}}>
                  <ScrollView>
                    <View className="flex-row items-center justify-between mb-6">
                      <Text className="text-xl font-bold" style={{color: textColor}}>
                        {aiMode === "names" ? "AI起名" : aiMode === "quick_words" ? "提取关键词" : aiMode === "correct" ? "纠错结果" : "AI创作助手"}
                      </Text>
                      <TouchableOpacity onPress={() => setAiModalVisible(false)} className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
                        <Text>x</Text>
                      </TouchableOpacity>
                    </View>

                    {aiMode === "names" && (
                      <View>
                        <Text className="text-sm mb-4" style={{color: textColor}}>正在生成{nameType === "person" ? "人物" : nameType === "item" ? "物品" : nameType === "ability" ? "能力" : "地区"}名称...</Text>
                        <View className="rounded-2xl p-4 mb-4 min-h-[100px]" style={{backgroundColor: nightMode ? "#2a2a4a" : "#EEF2FF"}}>
                          {generatedContent ? <Text className="text-sm" style={{color: textColor}}>{generatedContent}</Text> : <Text className="text-sm text-gray-400">点击下方按钮开始生成</Text>}
                        </View>
                        <TouchableOpacity onPress={handleGenerateNames} className="w-full py-3 rounded-xl items-center flex-row justify-center gap-2" style={{backgroundColor: "#6366F1"}} disabled={isGenerating}>
                          <FontAwesome6 name="wand-sparkles" size={14} color="#fff" />
                          <Text className="text-white font-medium">{isGenerating ? "生成中..." : "生成名称"}</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {aiMode === "quick_words" && (
                      <View>
                        <View className="rounded-2xl p-4 mb-4 min-h-[80px]" style={{backgroundColor: nightMode ? "#2a2a4a" : "#EEF2FF"}}>
                          {generatedContent ? <Text className="text-sm" style={{color: textColor}}>{generatedContent}</Text> : <Text className="text-sm text-gray-400">正在提取关键词...</Text>}
                        </View>
                        {generatedContent && (
                          <TouchableOpacity onPress={() => { setContent(prev => prev + "\n\n【关键词】" + generatedContent); setAiModalVisible(false); }}
                            className="w-full py-3 rounded-xl items-center mt-2" style={{backgroundColor: "#10B981"}}>
                            <Text className="text-white font-medium">插入到正文</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {aiMode === "correct" && (
                      <View>
                        <View className="rounded-2xl p-4 mb-4 min-h-[100px]" style={{backgroundColor: nightMode ? "#2a2a4a" : "#EEF2FF"}}>
                          {generatedContent ? <Text className="text-sm" style={{color: textColor}}>{generatedContent}</Text> : <Text className="text-sm text-gray-400">正在纠错...</Text>}
                        </View>
                        {generatedContent && (
                          <TouchableOpacity onPress={() => { pushUndo(content); setContent(generatedContent); setAiModalVisible(false); }}
                            className="w-full py-3 rounded-xl items-center mt-2" style={{backgroundColor: "#10B981"}}>
                            <Text className="text-white font-medium">替换全文</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {aiMode !== "names" && aiMode !== "quick_words" && aiMode !== "correct" && (
                      <View>
                        <Text className="text-sm font-medium mb-2" style={{color: textColor}}>写作指令</Text>
                        <TextInput value={aiPrompt} onChangeText={setAiPrompt} placeholder="告诉AI你想要写什么..." multiline numberOfLines={3}
                          className="w-full px-4 py-3 rounded-xl border mb-4" style={{color: textColor, backgroundColor: inputBg, borderColor: nightMode ? "#2a2a4a" : "#e5e7eb"}} placeholderTextColor="#999" />
                        <TouchableOpacity onPress={handleAIWrite} className="w-full py-3 rounded-xl items-center flex-row justify-center gap-2" style={{backgroundColor: "#6366F1"}} disabled={isGenerating}>
                          <FontAwesome6 name="paper-plane" size={14} color="#fff" />
                          <Text className="text-white font-medium">{isGenerating ? "生成中..." : "执行创作"}</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {generatedContent && (aiMode === "names" || aiMode === "quick_words") && (
                      <TouchableOpacity onPress={() => { setContent(prev => prev + "\n" + generatedContent); setGeneratedContent(""); setAiModalVisible(false); }}
                        className="w-full py-3 rounded-xl items-center mt-3" style={{backgroundColor: "#10B981"}}>
                        <Text className="text-white font-medium">插入到正文</Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                </View>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </Modal>

        {/* ===== 大纲/角色/设定辅助 Modal ===== */}
        <Modal visible={assistModalVisible} transparent animationType="slide" onRequestClose={() => setAssistModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setAssistModalVisible(false)} className="flex-1 bg-black/30 justify-center">
            <TouchableOpacity activeOpacity={1} onPress={() => undefined} className="mx-6 bg-white rounded-3xl p-6 max-h-[70%]" style={{backgroundColor: nightMode ? "#1a1a2e" : "#fff"}}>
              <ScrollView>
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-lg font-bold" style={{color: textColor}}>
                    {assistType === "outline" ? "大纲" : assistType === "characters" ? "角色" : "设定"}
                  </Text>
                  <TouchableOpacity onPress={() => setAssistModalVisible(false)} className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
                    <Text>x</Text>
                  </TouchableOpacity>
                </View>
                {assistType === "outline" && (
                  <View>
                    <Text className="text-sm mb-2" style={{color: textColor}}>当前书籍大纲：</Text>
                    <View className="rounded-2xl p-4 min-h-[100px]" style={{backgroundColor: nightMode ? "#2a2a4a" : "#FFFBEB", borderColor: nightMode ? "#3a3a6e" : undefined}}>
                      <Text className="text-sm leading-relaxed" style={{color: textColor}} selectable>{bookOutline || "暂无大纲"}</Text>
                    </View>
                  </View>
                )}
                {assistType === "characters" && (
                  <View className="rounded-2xl p-4" style={{backgroundColor: nightMode ? "#2a2a4a" : "#EFF6FF"}}>
                    <Text className="text-sm text-blue-600">核心角色设定功能可在书籍详情页"设定"Tab中管理</Text>
                  </View>
                )}
                {assistType === "settings" && (
                  <View className="rounded-2xl p-4" style={{backgroundColor: nightMode ? "#2a2a4a" : "#F0FDF4"}}>
                    <Text className="text-sm text-teal-600">世界观设定功能可在书籍详情页"设定"Tab中管理</Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => setAssistModalVisible(false)} className="mt-4 py-3 rounded-2xl items-center bg-gray-100">
                  <Text className="text-sm font-medium text-gray-600">关闭</Text>
                </TouchableOpacity>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* ===== 便签 Modal ===== */}
        <Modal visible={noteVisible} transparent animationType="slide" onRequestClose={() => setNoteVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setNoteVisible(false)} className="flex-1 bg-black/30 justify-center">
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <TouchableOpacity activeOpacity={1} onPress={() => undefined} className="mx-6 bg-white rounded-3xl p-6" style={{backgroundColor: nightMode ? "#1a1a2e" : "#fff"}}>
                <Text className="text-lg font-bold mb-4" style={{color: textColor}}>便签</Text>
                <TextInput value={noteText} onChangeText={setNoteText} placeholder="写下临时笔记..." multiline numberOfLines={4}
                  className="w-full px-4 py-3 rounded-2xl mb-4" style={{color: textColor, backgroundColor: inputBg}} placeholderTextColor="#999" />
                <View className="flex-row gap-3">
                  <TouchableOpacity onPress={() => setNoteVisible(false)} className="flex-1 py-3 rounded-2xl bg-gray-100 items-center"><Text className="text-sm font-medium text-gray-600">取消</Text></TouchableOpacity>
                  <TouchableOpacity onPress={handleNoteSave} className="flex-1 py-3 rounded-2xl items-center" style={{backgroundColor: "#6366F1"}}><Text className="text-sm font-bold text-white">保存</Text></TouchableOpacity>
                </View>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>

        {/* ===== 预览 Modal ===== */}
        <Modal visible={previewVisible} transparent animationType="slide" onRequestClose={() => setPreviewVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setPreviewVisible(false)} className="flex-1 bg-black/30 justify-center">
            <TouchableOpacity activeOpacity={1} onPress={() => undefined} className="mx-4 bg-white rounded-3xl p-6 max-h-[80%]" style={{backgroundColor: nightMode ? "#1a1a2e" : "#fff"}}>
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg font-bold" style={{color: textColor}}>预览</Text>
                <TouchableOpacity onPress={() => setPreviewVisible(false)} className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"><Text>x</Text></TouchableOpacity>
              </View>
              <ScrollView className="max-h-[500px]">
                <Text className="text-xl font-bold mb-4" style={{color: textColor}}>{chapterTitle}</Text>
                <Text className="text-base leading-relaxed" style={{color: textColor}} selectable>{content}</Text>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* ===== 搜索替换 Modal ===== */}
        <Modal visible={searchVisible} transparent animationType="slide" onRequestClose={() => setSearchVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setSearchVisible(false)} className="flex-1 bg-black/30 justify-center">
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <TouchableOpacity activeOpacity={1} onPress={() => undefined} className="mx-6 bg-white rounded-3xl p-6" style={{backgroundColor: nightMode ? "#1a1a2e" : "#fff"}}>
                <Text className="text-lg font-bold mb-4" style={{color: textColor}}>搜索替换</Text>
                <TextInput value={searchTerm} onChangeText={setSearchTerm} placeholder="搜索..." className="w-full px-4 py-3 rounded-2xl mb-2" style={{color: textColor, backgroundColor: inputBg}} placeholderTextColor="#999" />
                <TextInput value={replaceTerm} onChangeText={setReplaceTerm} placeholder="替换为..." className="w-full px-4 py-3 rounded-2xl mb-4" style={{color: textColor, backgroundColor: inputBg}} placeholderTextColor="#999" />
                <View className="flex-row gap-3">
                  <TouchableOpacity onPress={() => setSearchVisible(false)} className="flex-1 py-3 rounded-2xl bg-gray-100 items-center"><Text className="text-sm font-medium text-gray-600">取消</Text></TouchableOpacity>
                  <TouchableOpacity onPress={handleSearchReplace} className="flex-1 py-3 rounded-2xl items-center" style={{backgroundColor: "#6366F1"}} disabled={!searchTerm.trim()}><Text className="text-sm font-bold text-white">替换全部</Text></TouchableOpacity>
                </View>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>

        {/* ===== 悬浮章节 ===== */}
        <Modal visible={floatingChapterVisible} transparent animationType="fade" onRequestClose={() => setFloatingChapterVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setFloatingChapterVisible(false)} className="flex-1 bg-black/20 justify-end">
            <TouchableOpacity activeOpacity={1} onPress={() => undefined} className="mx-3 mb-6 bg-white rounded-3xl p-5 max-h-[50%]" style={{backgroundColor: nightMode ? "#1a1a2e" : "#fff"}}>
              <Text className="text-sm font-bold mb-2" style={{color: textColor}}>{floatingChapterTitle}</Text>
              <ScrollView><Text className="text-sm leading-relaxed" style={{color: textColor}}>{floatingChapterContent}</Text></ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* ===== 悬浮上章 ===== */}
        <Modal visible={prevChapterVisible} transparent animationType="fade" onRequestClose={() => setPrevChapterVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setPrevChapterVisible(false)} className="flex-1 bg-black/20 justify-end">
            <TouchableOpacity activeOpacity={1} onPress={() => undefined} className="mx-3 mb-6 bg-white rounded-3xl p-5 max-h-[50%]" style={{backgroundColor: nightMode ? "#1a1a2e" : "#fff"}}>
              <Text className="text-sm font-bold mb-2 text-gray-500">上一章</Text>
              <ScrollView><Text className="text-sm leading-relaxed" style={{color: textColor}}>{prevChapterContent || "(暂无内容)"}</Text></ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </Screen>
  );
}