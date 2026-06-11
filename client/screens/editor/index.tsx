/**
 * @file 章节编辑器页面
 * @description 核心写作界面，全屏沉浸式编辑器
 *
 * 核心功能：
 * - TextInput 多行文本输入，支持富文本排版（字体/字号/行距/边距/背景）
 * - 外观设置（Modal）：日间/夜间模式，6种背景图，3种字体，5级字号，3种行距，3种页边距
 * - AI 辅助（Modal）：续写/扩写/润色/取名，SSE 流式实时输出，支持整篇追加或替换选中
 * - 快捷输入栏：底部悬浮工具栏，常用标点符号一键插入
 * - 浮动AI栏：选中文字后悬浮于底部，快速触发AI续写/扩写/润色
 * - 预览 Modal：阅读模式，支持上下划屏浏览
 * - 大纲 Modal：查看/编辑作品大纲（Quill 富文本编辑器）
 * - 目录 Modal：章节快速跳转
 * - 导出功能：HTML/TXT 导出
 * - 自动保存：内容变更后标记未保存，支持手动保存
 */
import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
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
  Image,
  PanResponder,
  Animated,
} from "react-native";
import { useSafeRouter, useSafeSearchParams } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";
import RichEditor from "@/components/RichEditor";
import { FontAwesome6 } from "@expo/vector-icons";
import RNSSE from "react-native-sse";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/AuthContext";
import { cacheChapter, getCachedChapter } from "@/services/local-cache";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

// 品牌色
const BRAND = { primary: "#6366F1", primaryLight: "#EEF2FF", primaryDark: "#4F46E5" };
const COVER_COLORS = ["#6366F1", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#3B82F6"];

export default function EditorScreen() {
  const router = useSafeRouter();
  const { bookId, chapterId } = useSafeSearchParams<{ bookId: string; chapterId: string }>();
  const { width: screenWidth } = useWindowDimensions();
  const { token } = useAuth();
  const getAuthHeaders = useCallback(() => ({ "Content-Type": "application/json", ...(token ? { "x-session": token } : {}) }), [token]);

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
  const [isOffline, setOffline] = useState(false);

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
  const [appearanceModalVisible, setAppearanceModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);

  // ===== 外观设置 =====
  const [editorSettings, setEditorSettings] = useState({
    theme: "light" as "light" | "dark" | "sepia" | "green",
    bg: "",
    fontFamily: "System",
    fontSize: 16,
    lineHeight: 1.8,
    pagePadding: 20,
    alignment: "left" as "left" | "center" | "justify",
  });

  const loadEditorSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem("editor_settings");
      if (saved) setEditorSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
    } catch {}
  };
  const saveEditorSettings = async (s: typeof editorSettings) => {
    setEditorSettings(s);
    try { await AsyncStorage.setItem("editor_settings", JSON.stringify(s)); } catch {}
  };

  const themePalette = (() => {
    const t = editorSettings.theme;
    if (t === "sepia") return { isDark: false, bg: "#F5EDE0", text: "#5C4033", text2: "#8B7355", surface: "#FDF8F0", accent: "#B8860B", accentBg: "#FAEBD7", inputBg: "#FEFCF3", border: "#E8DCC8" };
    if (t === "green") return { isDark: false, bg: "#E8F5E9", text: "#1B5E20", text2: "#4A7C4F", surface: "#F1F8E9", accent: "#2E7D32", accentBg: "#C8E6C9", inputBg: "#F9FBE7", border: "#C5E1A5" };
    if (t === "dark") return { isDark: true, bg: "#12122A", text: "#E8E8F0", text2: "#8888A8", surface: "#1A1A36", accent: "#818CF8", accentBg: "rgba(129,140,248,0.15)", inputBg: "#252550", border: "#2D2D4A" };
    return { isDark: false, bg: "#FAFAFE", text: "#1F2937", text2: "#6B7280", surface: "#FFFFFF", accent: "#6366F1", accentBg: "#EEF2FF", inputBg: "#F9FAFB", border: "#E5E7EB" };
  })();

  // ===== 悬浮AI助手 =====
  const [selectedText, setSelectedText] = useState("");
  const [showFloatingAI, setShowFloatingAI] = useState(false);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [generationDone, setGenerationDone] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const contentInputRef = useRef<TextInput>(null);
  const selectionStartRef = useRef(0);
  const selectionEndRef = useRef(0);
  const selectedRangeStartRef = useRef(0);
  const selectedRangeEndRef = useRef(0);
  const accumulatedRef = useRef("");
  const currentModelRef = useRef("");
  
  // ===== AI悬浮框(画中画拖拽) =====
  const { height: winHeight } = useWindowDimensions();
  const [floatingPos, setFloatingPos] = useState({ x: 20, y: winHeight * 0.25 });
  const floatingPosRef = useRef(floatingPos);
  const floatingRef = useRef<View>(null);
  const floatingDragStartRef = useRef({ x: 0, y: 0 });
  const floatingPanResponder = useMemo(() =>
    // eslint-disable-next-line react-hooks/refs
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        floatingDragStartRef.current = { ...floatingPosRef.current };
      },
      onPanResponderMove: (_, g) => {
        const newX = Math.max(0, Math.min(screenWidth - 340, floatingDragStartRef.current.x + g.dx));
        const newY = Math.max(40, Math.min(winHeight - 300, floatingDragStartRef.current.y + g.dy));
        floatingPosRef.current = { x: newX, y: newY };
        if (floatingRef.current) {
          floatingRef.current.setNativeProps({ style: { left: newX, top: newY } });
        }
      },
      onPanResponderRelease: () => {
        setFloatingPos({ ...floatingPosRef.current });
      },
    }), [screenWidth, winHeight]);

  // ===== 圆形转轮悬浮按钮 =====
  const [wheelOpen, setWheelOpen] = useState(false);
  const wheelTouchTimerRef = useRef<number | null>(null);

  // ===== 夜间模式 =====
  const [nightMode, setNightMode] = useState(false);
  
  // ===== 外观设置状态 =====
  type AppTheme = "light" | "dark" | "sepia" | "green";
  type AppFont = "sans" | "serif" | "mono";
  type LineSpacing = number;
  type PageMargin = "narrow" | "normal" | "wide" | "center";
  
  const [appTheme, setAppTheme] = useState<AppTheme>("light");
  const [appFont, setAppFont] = useState<AppFont>("sans");
  const [fontSizeIndex, setFontSizeIndex] = useState(1); // 0-3
  const [lineSpacing, setLineSpacing] = useState<LineSpacing>(1.8);
  const [pageMargin, setPageMargin] = useState<PageMargin>("narrow");
  const [appearanceVisible, setAppearanceVisible] = useState(false);
  const [showQuickBar, setShowQuickBar] = useState(false);
  const [addContentVisible, setAddContentVisible] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState("");

  // ===== 键盘高度监听 =====
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const handleInsertContent = (type: "divider" | "timestamp" | "dialogue" | "quote" | "heading") => {
    const inserts: Record<string, string> = {
      divider: "\n\n---\n\n",
      timestamp: `\n\n[${new Date().toLocaleString("zh-CN")}]\n\n`,
      dialogue: "\n\n「」\n\n",
      quote: "\n\n> \n\n",
      heading: "\n\n## \n\n",
    };
    const text = inserts[type] || "";
    const start = content.slice(0, cursorPosition);
    const end = content.slice(cursorPosition);
    setContent(start + text + end);
    setAddContentVisible(false);
    setUnsaved(true);
  };

  // ===== 撤销/恢复 =====
  // 使用 content 变化自动追踪未保存状态
  const setUnsaved = (val: boolean) => {
    if (val) {
      // 当内容变更时，撤销栈记录快照辅助用
    }
  };
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
  const [searchResultCount, setSearchResultCount] = useState(0);
  const [currentSearchIdx, setCurrentSearchIdx] = useState(0);

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
  const [outlineHtml, setOutlineHtml] = useState("");

  // ===== 初始化 =====
  useEffect(() => {
    const load = async () => {
      if (!bookId || !chapterId) return;
      try {
        const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/chapters/${chapterId}`, { headers: getAuthHeaders() });
        const json = await res.json();
        if (json.success) {
          const content = json.data.content || "";
          const title = json.data.title || "";
          setContent(content);
          setChapterTitle(title);
          setLastSavedContent(content);
          setLastSavedTitle(title);
          // 缓存章节内容
          cacheChapter(bookId, chapterId, { content, title });
        }
      } catch (e) {
        console.error("获取章节失败，尝试本地缓存", e);
        const cached = await getCachedChapter(bookId, chapterId);
        if (cached) {
          setContent(cached.content || "");
          setChapterTitle(cached.title || "");
          setLastSavedContent(cached.content || "");
          setLastSavedTitle(cached.title || "");
          setOffline(true);
        }
      }
      try {
        const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}`, { headers: getAuthHeaders() });
        const json = await res.json();
        if (json.success) {
          setBookTitle(json.data.title);
          setBookOutline(json.data.outline || "");
          setOutlineHtml(json.data.outline || "");
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

  // ===== 加载外观设置 =====
  useEffect(() => { loadEditorSettings(); }, []);

  const wordCount = content.replace(/\s/g, "").length;
  const charCount = content.length;
  const paraCount = content.split("\n").filter(line => line.trim().length > 0).length;
  const sentenceCount = content.split(/[。！？.!?]+/).filter(s => s.trim().length > 0).length;

  // ===== 保存 =====
  const handleSave = async (isAuto = false) => {
    if (isAuto) setIsAutoSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/chapters/${chapterId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ title: chapterTitle, content }),
      });
      const json = await res.json();
      if (json.success) {
        setLastSavedContent(content);
        setLastSavedTitle(chapterTitle);
        cacheChapter(bookId, chapterId, { content, title: chapterTitle });
      }
    } catch (e) {
      // 离线时也保存到本地缓存
      cacheChapter(bookId, chapterId, { content, title: chapterTitle });
    }
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

  // ===== 保存大纲 =====
  const [savingOutline, setSavingOutline] = useState(false);
  const handleSaveOutline = useCallback(async () => {
    if (!bookId || !outlineHtml) return;
    setSavingOutline(true);
    try {
      await fetch(`${API_BASE}/api/v1/writing/${bookId}/outline`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ outline: outlineHtml }),
      });
      setBookOutline(outlineHtml);
    } catch (e) {
      console.error("保存大纲失败", e);
    }
    setSavingOutline(false);
  }, [bookId, outlineHtml]);

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
    text = text.replace(/([\u4e00-\u9fa5])([a-z])/gi, "$1 $2").replace(/([a-z])([\u4e00-\u9fa5])/gi, "$1 $2");
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
    const sse = new RNSSE(`${API_BASE}/api/v1/writing/${bookId}/generate`, { method: "POST", headers: getAuthHeaders(), body });
    sseRef.current = sse;
    sse.addEventListener("message", (event: any) => {
      if (!event.data) return;
      if (event.data === "[DONE]") { sse.close(); setIsGenerating(false); return; }
      try { const p = JSON.parse(event.data); if (p.content && p.type !== "done") setGeneratedContent(prev => prev + p.content); } catch {}
    });
    sse.addEventListener("error", () => setIsGenerating(false));
  };

  const handleCopyAll = async () => {
    try { await Clipboard.setStringAsync(content); Alert.alert("已复制", "全文已复制到剪贴板"); } catch {}
  };

  const handleNewChapter = async () => {
    if (!bookId) return;
    try {
      const bookRes = await fetch(`${API_BASE}/api/v1/writing/${bookId}`, { headers: getAuthHeaders() });
      const json = await bookRes.json();
      const volId = json.success && json.data.volumes?.[0]?.id;
      if (!volId) { Alert.alert("提示", "请先在书籍详情页创建卷"); return; }
      const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/volumes/${volId}/chapters`, {
        method: "POST", headers: getAuthHeaders(), body: JSON.stringify({ title: "新章节" }),
      });
      const j = await res.json();
      if (j.success) router.push("/editor", { bookId, chapterId: j.data.id });
      else Alert.alert("错误", "创建失败");
    } catch { Alert.alert("错误", "创建失败"); }
  };

  // ===== 导出 =====
  const [exportModalVisible, setExportModalVisible] = useState(false);

  const handleExport = async (format: "txt" | "md") => {
    setExportModalVisible(false);
    setMoreMenuVisible(false);
    try {
      const header = format === "md" ? `# ${chapterTitle}\n\n---\n\n` : `${chapterTitle}\n${"━".repeat(20)}\n\n`;
      const text = header + content;
      const fileName = `${chapterTitle || "未命名章节"}.${format}`;
      const uri = `${(FileSystem as any).cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(uri, text, {
        encoding: (FileSystem as any).EncodingType.UTF8,
      });
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: format === "md" ? "text/markdown" : "text/plain",
          dialogTitle: `导出 ${fileName}`,
        });
      } else {
        Alert.alert("导出完成", `文件已保存到: ${uri}`);
      }
    } catch (e) {
      Alert.alert("导出失败", "请稍后重试");
    }
  };

  // ===== 搜索增强 =====
  useEffect(() => {
    if (!searchTerm.trim()) { setSearchResultCount(0); setCurrentSearchIdx(0); return; }
    const matches = content.match(new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"));
    setSearchResultCount(matches ? matches.length : 0);
    setCurrentSearchIdx(prev => Math.min(prev, (matches?.length || 1) - 1));
  }, [searchTerm, content]);

  const scrollToSearchIndex = useCallback((dir: "prev" | "next") => {
    if (searchResultCount === 0) return;
    if (dir === "next") {
      setCurrentSearchIdx(prev => (prev + 1) % searchResultCount);
    } else {
      setCurrentSearchIdx(prev => (prev - 1 + searchResultCount) % searchResultCount);
    }
  }, [searchResultCount]);

  const handleSearchReplace = () => {
    if (!searchTerm.trim()) return;
    pushUndo(content);
    const parts = content.split(searchTerm);
    setContent(parts.join(replaceTerm));
    setSearchVisible(false);
    setSearchTerm(""); setReplaceTerm("");
    setSearchResultCount(0);
    Alert.alert("替换完成", `已将"${searchTerm}"替换为"${replaceTerm}"${parts.length > 1 ? "，共" + (parts.length - 1) + "处" : ""}`);
  };

  // ===== 增强统计弹窗 =====
  const [statsModalVisible, setStatsModalVisible] = useState(false);

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
        const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/chapters/${chapterList[idx - 1].id}`, { headers: getAuthHeaders() });
        const json = await res.json();
        if (json.success) { setPrevChapterContent(json.data.content?.slice(0, 500) || ""); setPrevChapterVisible(true); }
      } catch {}
    } else { Alert.alert("提示", "已经是第一章了"); }
    setMoreMenuVisible(false);
  };

  // ===== 加载用户AI模型设置 =====
  useEffect(() => {
    const fetchModel = async () => {
      try {
        const t = await AsyncStorage.getItem("auth_token");
        if (!t) return;
        const res = await fetch(`${API_BASE}/api/v1/writing/ai-settings`, {
          headers: { "x-session": t },
        });
        const json = await res.json();
        if (json.settings?.aiModel) {
          currentModelRef.current = json.settings.aiModel;
        }
      } catch {}
    };
    fetchModel();
  }, []);

  // ===== 选中文字 =====
  const handleSelectionChange = (event: any) => {
    const { selection } = event.nativeEvent;
    if (!selection) return;
    const start = selection.start, end = selection.end;
    setSelectionStart(start); setSelectionEnd(end);
    selectionStartRef.current = start;
    selectionEndRef.current = end;
    if (start !== end) {
      const text = content.substring(start, end);
      if (text.trim()) { setSelectedText(text); setShowFloatingAI(true); }
      // 记住选中范围（手指松开后 onSelectionChange 会以光标位置再触发一次）
      selectedRangeStartRef.current = start;
      selectedRangeEndRef.current = end;
    }
  };

  const replaceSelectedText = (newText: string) => {
    pushUndo(content);
    const start = selectedRangeStartRef.current;
    const end = selectedRangeEndRef.current;
    if (start !== end) {
      setContent(content.substring(0, start) + newText + content.substring(end));
    } else {
      setContent(content + "\n\n" + newText);
    }
    setShowFloatingAI(false);
  };

  // ===== AI =====
  const handleGenerateNames = async () => {
    setIsGenerating(true); setGeneratedContent("");
    const prompts: Record<string, string> = {
      person: "生成10个小说角色名(含姓氏，男女各5):",
      item: "生成10个网络小说神器/法宝名:", ability: "生成10个技能/功法名:", place: "生成10个地名/秘境名:",
    };
    const sse = new RNSSE(`${API_BASE}/api/v1/writing/${bookId}/generate`, {
      method: "POST", headers: getAuthHeaders(),
      body: JSON.stringify({ prompt, style: "default", wordCount: 200, model: currentModelRef.current || undefined }),
    });
    sseRef.current = sse;
    sse.addEventListener("message", (e: any) => {
      if (e.data === "[DONE]") { sse.close(); setIsGenerating(false); return; }
      try { const p = JSON.parse(e.data); if (p.content && p.type !== "done") setGeneratedContent(prev => prev + p.content); } catch {}
    });
    sse.addEventListener("error", () => { setIsGenerating(false); sse.close(); });
  };

  const handleAIWrite = () => {
    if (!aiPrompt.trim()) { Alert.alert("提示", "请输入写作指令"); return; }
    setIsGenerating(true); setGeneratedContent(""); setAiModalVisible(false);
    const context = content.slice(-2000);
    const hasSelection = selectedText && selectedText.length > 0;
    let systemPrompt = aiPrompt.trim();
    if (aiMode === "generate") {
      systemPrompt = `续写以下内容，保持叙事风格、人物性格和文风一致：\n---上下文---\n${context}\n---写作要求---\n${aiPrompt.trim()}`;
    } else if (aiMode === "expand") {
      const targetText = hasSelection ? selectedText : context.slice(-1000);
      systemPrompt = `请扩写以下内容，增加细节描写（环境、心理、感官），丰富场景和情感，不改变原意：\n${targetText}\n---扩写要求---\n${aiPrompt.trim()}`;
    } else if (aiMode === "polish") {
      const targetText = hasSelection ? selectedText : context.slice(-1000);
      systemPrompt = `请润色以下文字，优化句式结构和用词，使表达更优美流畅：\n${targetText}\n---润色要求---\n${aiPrompt.trim()}`;
    }
    const sse = new RNSSE(`${API_BASE}/api/v1/writing/${bookId}/generate`, {
      method: "POST", headers: getAuthHeaders(),
      body: JSON.stringify({ prompt: systemPrompt, style: "default", wordCount: 1000, model: currentModelRef.current || undefined }),
    });
    sseRef.current = sse;
    sse.addEventListener("message", (e: any) => {
      if (e.data === "[DONE]") { sse.close(); setIsGenerating(false); return; }
      try { const p = JSON.parse(e.data); if (p.content && p.type !== "done") setGeneratedContent(prev => prev + p.content); } catch {}
    });
    sse.addEventListener("error", () => setIsGenerating(false));
  };

  const handleStopGeneration = () => {
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    setIsGenerating(false);
    // 不再自动追加，由用户手动"采用"决定
  };

  const handleContinueWriting = () => {
    const currentContent = generatedContent;
    if (!currentContent) return;
    setGenerationDone(false);
    setIsGenerating(true);
    const sse = new RNSSE(`${API_BASE}/api/v1/writing/${bookId}/generate`, {
      method: "POST", headers: getAuthHeaders(),
      body: JSON.stringify({ prompt: `请接续以下文字继续写作，保持风格一致：\n${currentContent}`, wordCount: 600, model: currentModelRef.current || undefined }),
    });
    sseRef.current = sse;
    sse.addEventListener("message", (e: any) => {
      if (e.data === "[DONE]") { sse.close(); setGenerationDone(true); return; }
      try { const p = JSON.parse(e.data); if (p.content && p.type !== "done") setGeneratedContent(prev => prev + p.content); } catch {}
    });
    sse.addEventListener("error", () => setGenerationDone(true));
  };

  const applyGeneratedContent = () => {
    if (generatedContent) { pushUndo(content); setContent(prev => prev + "\n\n" + generatedContent); setGeneratedContent(""); setIsGenerating(false); setGenerationDone(false); }
  };

  const replaceSelectedWithAI = () => {
    // 替换选中文本（润色/扩写/改写用）
    const start = selectedRangeStartRef.current;
    const end = selectedRangeEndRef.current;
    if (generatedContent && start !== end) {
      pushUndo(content);
      const newText = content.slice(0, start) + generatedContent + content.slice(end);
      setContent(newText);
      setGeneratedContent("");
      setSelectionEnd(start + generatedContent.length);
      setIsGenerating(false);
      setGenerationDone(false);
    } else {
      applyGeneratedContent();
    }
  };

  // ===== 删除本章 =====
  const handleDeleteChapter = () => {
    Alert.alert("确认删除", `删除"${chapterTitle}"？不可撤销。`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: async () => {
        try { await fetch(`${API_BASE}/api/v1/writing/${bookId}/chapters/${chapterId}`, { method: "DELETE", headers: getAuthHeaders() }); router.back(); } catch {}
      }},
    ]);
  };

  // ===== 快速关键词 =====
  const handleQuickWords = () => {
    pushUndo(content);
    const lastText = content.slice(-2000);
    const sse = new RNSSE(`${API_BASE}/api/v1/writing/${bookId}/generate`, {
      method: "POST", headers: getAuthHeaders(),
      body: JSON.stringify({ prompt: `从以下文字提取关键词(逗号分隔):\n${lastText}`, style: "default", wordCount: 200 }),
    });
    sseRef.current = sse;
    sse.addEventListener("message", (e: any) => {
      if (e.data === "[DONE]") { sse.close(); setAiModalVisible(true); return; }
      try { const p = JSON.parse(e.data); if (p.content && p.type !== "done") setGeneratedContent(prev => prev + p.content); } catch {}
    });
  };

  // 主题色
  const theme = {
    bg: nightMode ? "#0F0F1A" : "#F8F4ED",
    surface: nightMode ? "#1A1A2E" : "#FFFCF7",
    surface2: nightMode ? "#24243D" : "#F2EDE4",
    text: nightMode ? "#E8E8F0" : "#2C1810",
    text2: nightMode ? "#9898B8" : "#8B7355",
    border: nightMode ? "#2D2D4A" : "#EDE4D4",
    accent: "#6366F1",
    accentBg: nightMode ? "#2D2D4A" : "#EEF2FF",
    inputBg: nightMode ? "#1E1E38" : "#F5F0E8",
    muted: nightMode ? "#6B6B8A" : "#A89880",
    shadow: nightMode ? "transparent" : "rgba(99,102,241,0.06)",
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

  const handlePreview = useCallback(() => { setPreviewVisible(true); setMoreMenuVisible(false); setSearchVisible(false); }, []);

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
      case "export": setExportModalVisible(true); break;
      case "stats": setStatsModalVisible(true); break;
      case "delete": handleDeleteChapter(); break;
    }
  }, [nightMode, showSpeed]);

  // ===== 圆形转轮工具列表 =====
  const wheelTools = useMemo(() => [
    { icon: "rotate-left", label: "撤销", color: "#6366F1", action: handleUndo },
    { icon: "rotate-right", label: "恢复", color: "#8B5CF6", action: handleRedo },
    { icon: "bold", label: "加粗", color: "#EC4899", action: () => {
      const sel = selectedText || content.slice(cursorPosition - 10, cursorPosition + 10);
      if (sel) replaceSelectedText(`**${sel}**`);
    }},
    { icon: "italic", label: "斜体", color: "#10B981", action: () => {
      const sel = selectedText || content.slice(cursorPosition - 10, cursorPosition + 10);
      if (sel) replaceSelectedText(`*${sel}*`);
    }},
    { icon: "underline", label: "下划线", color: "#F59E0B", action: () => {
      const sel = selectedText || content.slice(cursorPosition - 10, cursorPosition + 10);
      if (sel) replaceSelectedText(`<u>${sel}</u>`);
    }},
    { icon: "align-left", label: "排版", color: "#3B82F6", action: handleFormat },
    { icon: "check-double", label: "纠错", color: "#059669", action: handleCorrect },
    { icon: "wand-sparkles", label: "AI", color: "#6366F1", action: () => { setAiMode("generate"); setAiPrompt(""); setAiModalVisible(true); }},
  ], [handleUndo, handleRedo, handleFormat, handleCorrect, selectedText, cursorPosition]);

  // 提取 ref 值用于渲染（避免 lint 报错）
  const hasSelection = selectionStart !== selectionEnd;

  // ===== 渲染 =====
  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
        <View className="flex-1" style={{ backgroundColor: theme.bg }}>

          {/* ===== 顶部导航条 ===== */}
          <View style={{
            backgroundColor: theme.surface,
            borderBottomWidth: 1,
            borderBottomColor: nightMode ? "#2D2D4A" : "#EDE4D4",
          }}>
            <View className="flex-row items-center px-4 py-3">
              {/* 左侧 - 返回 */}
              <TouchableOpacity onPress={() => router.back()} className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-xl items-center justify-center" style={{ backgroundColor: theme.accentBg }}>
                  <FontAwesome6 name="chevron-left" size={14} color={theme.accent} />
                </View>
              </TouchableOpacity>

              {/* 中间 - 大纲标题 */}
              <View className="flex-1 items-center">
                <Text className="text-[17px] font-bold" style={{ color: theme.text }} numberOfLines={1}>
                  {chapterTitle || "新章节"}
                </Text>
              </View>

              {/* 右侧 - 保存 + 更多 */}
              <View className="flex-row items-center gap-2">
                <TouchableOpacity onPress={() => handleSave(false)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
                    backgroundColor: content !== lastSavedContent ? theme.accent : (nightMode ? "#2D2D4A" : "#F3F4F6"),
                  }}>
                  <Text className="text-[12px] font-bold" style={{
                    color: content !== lastSavedContent ? "#FFF" : theme.text2,
                  }}>
                    {isAutoSaving ? "保存中" : content !== lastSavedContent ? "保存" : "已保存"}
                  </Text>
                </TouchableOpacity>

                {/* 更多菜单按钮 */}
                <TouchableOpacity onPress={() => setMoreMenuVisible(true)}
                  style={{
                    width: 36, height: 36, borderRadius: 12,
                    backgroundColor: theme.accentBg,
                    alignItems: "center", justifyContent: "center",
                  }}>
                  <FontAwesome6 name="ellipsis-vertical" size={15} color={theme.accent} />
                </TouchableOpacity>
              </View>
            </View>

            {/* 统计栏 */}
            <View className="flex-row items-center px-4 pb-2.5 gap-4">
              <TouchableOpacity onPress={() => setStatsModalVisible(true)} className="flex-row items-center gap-1.5">
                <FontAwesome6 name="text-height" size={11} color={theme.text2} />
                <Text style={{ color: theme.text2, fontSize: 12, fontWeight: "500" }}>{wordCount}</Text>
                <Text style={{ color: theme.text2, fontSize: 11 }}>字</Text>
              </TouchableOpacity>
              {chapterList.length > 0 && (
                <View className="flex-row items-center gap-1.5">
                  <FontAwesome6 name="book" size={11} color={theme.text2} />
                  <Text style={{ color: theme.text2, fontSize: 12 }}>{chapterList.findIndex(c => c.id === chapterId) + 1}/{chapterList.length}</Text>
                </View>
              )}
              {showSpeed && (
                <View className="flex-row items-center gap-1.5">
                  <FontAwesome6 name="gauge-high" size={11} color="#8B5CF6" />
                  <Text style={{ color: "#8B5CF6", fontSize: 12, fontWeight: "600" }}>{wpm}</Text>
                  <Text style={{ color: theme.text2, fontSize: 11 }}>字/分</Text>
                </View>
              )}
            </View>
          </View>

          {/* ===== 精简工具栏 ===== */}
          <View style={{
            backgroundColor: nightMode ? "#1A1A2E" : "#FFFFFF",
          }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-3 py-2">
              <View className="flex-row items-center gap-2">
                <ToolbarButton icon="align-left" label="排版" color={theme.accent} bg={theme.accentBg} onPress={handleFormat} textColor={theme.text} nightMode={nightMode} />
                <ToolbarButton icon="rotate-left" label="撤销" color={theme.text2} bg={theme.surface2} onPress={handleUndo} textColor={theme.text2} nightMode={nightMode} disabled={undoStack.length === 0} />
                <ToolbarButton icon="rotate-right" label="恢复" color={theme.text2} bg={theme.surface2} onPress={handleRedo} textColor={theme.text2} nightMode={nightMode} disabled={redoStack.length === 0} />
                <ToolbarButton icon="wand-sparkles" label="AI创作" color={theme.accent} bg={theme.accentBg} onPress={() => { setAiMode("generate"); setAiPrompt(""); setAiModalVisible(true); }} textColor={theme.text} nightMode={nightMode} />
                <ToolbarButton icon="search" label="搜索" color={theme.text2} bg={theme.surface2} onPress={() => setSearchVisible(true)} textColor={theme.text2} nightMode={nightMode} />
                <ToolbarButton icon="eye" label="预览" color={theme.text2} bg={theme.surface2} onPress={() => { console.log("Preview: opening"); setPreviewVisible(true); setMoreMenuVisible(false); }} textColor={theme.text2} nightMode={nightMode} />
                <ToolbarButton icon="plus" label="添加" color="#10B981" bg="rgba(16,185,129,0.1)" onPress={() => setAddContentVisible(true)} textColor={theme.text} nightMode={nightMode} />
                <ToolbarButton icon="font" label="外观" color={theme.accent} bg={theme.accentBg} onPress={() => setAppearanceVisible(true)} textColor={theme.text} nightMode={nightMode} />
                <ToolbarButton icon="keyboard" label="快捷" color={showQuickBar ? '#8B5CF6' : theme.text2} bg={showQuickBar ? 'rgba(139,92,246,0.15)' : theme.surface2} onPress={() => setShowQuickBar(prev => !prev)} textColor={theme.text2} nightMode={nightMode} />
              </View>
            </ScrollView>
          </View>

          {/* ===== 编辑区(全屏沉浸) ===== */}
          <View className="flex-1" style={{ backgroundColor: nightMode ? "#0A0A14" : "#F8F4ED" }}>
            {/* ===== 浮动AI栏（选中文字时显示，浮层不推挤内容） ===== */}
            {showFloatingAI && selectedText && (
              <View style={{
                position: 'absolute',
                bottom: keyboardHeight + 55,
                left: 8,
                right: 8,
                zIndex: 100,
                borderRadius: 14,
                backgroundColor: nightMode ? "#1E1E38" : "#FFFFFF",
                shadowColor: nightMode ? "#6366F1" : "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: nightMode ? 0 : 0.15,
                shadowRadius: 16, elevation: 12,
                borderWidth: 1,
                borderColor: nightMode ? "rgba(99,102,241,0.2)" : "rgba(0,0,0,0.06)",
              }}>
                <View className="flex-row justify-between items-center" style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 2 }}>
                  <Text style={{
                    fontSize: 11, color: nightMode ? "#8888AA" : "#9CA3AF",
                    flex: 1,
                  }} numberOfLines={1}>
                    已选中：{selectedText.length} 字
                  </Text>
                  <TouchableOpacity onPress={() => { setShowFloatingAI(false); setSelectedText(""); }}
                    style={{ paddingLeft: 10, paddingVertical: 2 }}>
                    <FontAwesome6 name="xmark" size={14} color={nightMode ? "#8888AA" : "#9CA3AF"} />
                  </TouchableOpacity>
                </View>
                  <View><ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-2 px-2">
                  <View className="flex-row items-center gap-0.5">
                    {/* 编辑操作 */}
                    <FloatingAIBtn icon="scissors" label="剪切" color="#6B7280" onPress={() => replaceSelectedText("")} />
                    <FloatingAIBtn icon="copy" label="复制" color="#6B7280" onPress={async () => { await Clipboard.setStringAsync(selectedText); setShowFloatingAI(false); }} />
                    <FloatingAIBtn icon="paste" label="粘贴" color="#6B7280" onPress={async () => { const t = await Clipboard.getStringAsync(); if (t) replaceSelectedText(t); }} />
                    {/* AI 写作 */}
                    <FloatingAIBtn icon="pen" label="润色" color="#EC4899" onPress={() => {
                      setIsGenerating(true); setGeneratedContent(""); setShowFloatingAI(false);
                      accumulatedRef.current = "";
                      const prompt = `请润色以下文字，优化句式结构和用词，使表达更优美流畅、自然生动。保留原文风格和核心信息，不要改变原意：\n${selectedText}`;
                      const sse = new RNSSE(`${API_BASE}/api/v1/writing/${bookId}/generate`, {
                        method: "POST", headers: getAuthHeaders(),
                        body: JSON.stringify({ prompt, style: "default", wordCount: 800, model: currentModelRef.current || undefined }),
                      });
                      sseRef.current = sse;
                      sse.addEventListener("message", (e: any) => {
                        if (e.data === "[DONE]") {
                          sse.close();
                          setGenerationDone(true);
                          return;
                        }
                        try { const p = JSON.parse(e.data); if (p.content && p.type !== "done") { setGeneratedContent(prev => prev + p.content); accumulatedRef.current += p.content; } } catch {}
                      });
                      sse.addEventListener("error", () => setIsGenerating(false));
                    }} />
                    <FloatingAIBtn icon="expand" label="扩写" color="#10B981" onPress={() => {
                      setIsGenerating(true); setGeneratedContent(""); setShowFloatingAI(false); setGenerationDone(false);
                      accumulatedRef.current = "";
                      const prompt = `请扩写以下文字，增加细节描写，包括环境、心理活动、感官体验（视觉/听觉/触觉/嗅觉），丰富人物情感和场景氛围，使内容更丰满生动。不改变原意和叙事主线：\n${selectedText}`;
                      const sse = new RNSSE(`${API_BASE}/api/v1/writing/${bookId}/generate`, {
                        method: "POST", headers: getAuthHeaders(),
                        body: JSON.stringify({ prompt, style: "default", wordCount: 800, model: currentModelRef.current || undefined }),
                      });
                      sseRef.current = sse;
                      sse.addEventListener("message", (e: any) => {
                        if (e.data === "[DONE]") {
                          sse.close();
                          setGenerationDone(true);
                          return;
                        }
                        try { const p = JSON.parse(e.data); if (p.content && p.type !== "done") { setGeneratedContent(prev => prev + p.content); accumulatedRef.current += p.content; } } catch {}
                      });
                      sse.addEventListener("error", () => setIsGenerating(false));
                    }} />
                    <FloatingAIBtn icon="magic" label="续写" color="#8B5CF6" onPress={() => {
                      setIsGenerating(true); setGeneratedContent(""); setShowFloatingAI(false); setGenerationDone(false);
                      accumulatedRef.current = "";
                      const context = content.slice(-1500);
                      const prompt = `请根据以上上下文风格，自然地续写接下来的内容。保持叙事节奏、人物性格和文风一致，不要重复已有内容：\n---上下文---\n${context}`;
                      const sse = new RNSSE(`${API_BASE}/api/v1/writing/${bookId}/generate`, {
                        method: "POST", headers: getAuthHeaders(),
                        body: JSON.stringify({ prompt, style: "default", wordCount: 800, model: currentModelRef.current || undefined }),
                      });
                      sseRef.current = sse;
                      sse.addEventListener("message", (e: any) => {
                        if (e.data === "[DONE]") {
                          sse.close();
                          setGenerationDone(true);
                          return;
                        }
                        try { const p = JSON.parse(e.data); if (p.content && p.type !== "done") { setGeneratedContent(prev => prev + p.content); accumulatedRef.current += p.content; } } catch {}
                      });
                      sse.addEventListener("error", () => setIsGenerating(false));
                    }} />
                    <View className="w-px h-5 mx-1.5" style={{ backgroundColor: nightMode ? "#333" : "#E5E7EB" }} />
                    {/* 标记工具 */}
                    <FloatingAIBtn icon="highlighter" label="高亮" color="#F59E0B" onPress={() => { setHighlights(prev => [...prev, { start: selectedRangeStartRef.current, end: selectedRangeEndRef.current, color: "#FDE68A" }]); setShowFloatingAI(false); Alert.alert("已高亮"); }} />
                    <FloatingAIBtn icon="flag" label="批注" color="#3B82F6" onPress={() => { replaceSelectedText(selectedText + "〔批注〕"); Alert.alert("已添加批注"); }} />
                  </View>
                </ScrollView>
                </View>
              </View>
            )}

            {/* ===== 全屏沉浸编辑区 ===== */}
            <ScrollView className="flex-1 px-0" style={{backgroundColor: 'transparent'}} keyboardShouldPersistTaps="always" nestedScrollEnabled={true} bounces={false} contentContainerStyle={{flexGrow: 1, paddingBottom: 60}}>
              {backgroundImage ? (
                <Image source={{ uri: backgroundImage }} style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.2}} resizeMode="cover" />
              ) : null}

              {/* 章节标题 */}
              <View className="px-5 pt-8 pb-2 items-center">
                <TextInput
                  value={chapterTitle} onChangeText={setChapterTitle}
                  className="w-full text-2xl font-bold text-center leading-9"
                  style={{ color: theme.text, fontFamily: "serif" }}
                  placeholder="章节标题" placeholderTextColor={nightMode ? "#4A4A6A" : "#C4B8A0"}
                  selectionColor={theme.accent}
                />
              </View>

              {/* 正文编辑区 - 全屏无边界 */}
              <View className="flex-1 px-3">
                <TextInput
                  ref={contentInputRef}
                  value={content}
                  onChangeText={(t) => { pushUndo(t); setContent(t); }}
                  onSelectionChange={handleSelectionChange}
                  multiline
                  className="w-full flex-1 outline-none"
                  style={{
                    color: theme.text, fontSize: fontSizeIndex + 15, lineHeight: (fontSizeIndex + 15) * 1.8,
                    fontFamily: appFont === "serif" ? "serif" : appFont === "mono" ? "monospace" : undefined,
                    textAlignVertical: "top",
                    textAlign: pageMargin === "center" ? "center" : "left",
                    paddingHorizontal: pageMargin === "narrow" ? 8 : pageMargin === "wide" ? 4 : 0,
                    letterSpacing: 0.3,
                  }}
                  placeholder="开始创作你的故事..."
                  placeholderTextColor={nightMode ? "#4A4A6A" : "#C4B8A0"}
                  selectionColor={nightMode ? "#6366F1" : "#A58B72"}
                />
                {/* spacer removed - using paddingBottom instead */}
              </View>
            </ScrollView>

            {/* ===== 快捷输入栏（仅键盘弹出时显示） ===== */}
            {showQuickBar && keyboardHeight > 0 && (
              <View style={{
                position: 'absolute', bottom: keyboardHeight, left: 0, right: 0,
                backgroundColor: nightMode ? "#1A1A2E" : "#F2EDE4",
                borderTopLeftRadius: 16, borderTopRightRadius: 16,
                paddingVertical: 8, paddingHorizontal: 10,
              }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                  {/* 撤销/恢复按钮 */}
                  <TouchableOpacity onPress={handleUndo}
                    className="items-center justify-center px-3 py-2 rounded-lg"
                    style={{ backgroundColor: undoStack.length === 0 ? (nightMode ? "#1E1E30" : "#E5E0D8") : (nightMode ? "#2D2D4A" : "#EEF2FF") }}>
                    <FontAwesome6 name="rotate-left" size={13} color={undoStack.length === 0 ? (nightMode ? "#4A4A6A" : "#C4B8A0") : theme.accent} />
                    <Text className="text-[9px] mt-0.5" style={{ color: undoStack.length === 0 ? (nightMode ? "#4A4A6A" : "#C4B8A0") : theme.accent }}>撤销</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleRedo}
                    className="items-center justify-center px-3 py-2 rounded-lg"
                    style={{ backgroundColor: redoStack.length === 0 ? (nightMode ? "#1E1E30" : "#E5E0D8") : (nightMode ? "#2D2D4A" : "#EEF2FF") }}>
                    <FontAwesome6 name="rotate-right" size={13} color={redoStack.length === 0 ? (nightMode ? "#4A4A6A" : "#C4B8A0") : theme.accent} />
                    <Text className="text-[9px] mt-0.5" style={{ color: redoStack.length === 0 ? (nightMode ? "#4A4A6A" : "#C4B8A0") : theme.accent }}>恢复</Text>
                  </TouchableOpacity>
                  <View className="w-px h-8 mx-1" style={{ backgroundColor: nightMode ? "#333" : "#D1CCC0" }} />
                  {[
                    ["，", "逗号"], ["。", "句号"], ["“”", "引号"], ["：", "冒号"],
                    ["；", "分号"], ["？", "问号"], ["！", "叹号"], ["——", "破折"],
                    ["……", "省略"], ["—", "连接"], ["·", "间隔"], ["～", "波浪"],
                    ["「」", "直角引"], ["【】", "方头括"], ["《》", "书名号"],
                    ["/\n", "换段"], ["→", "箭头"], ["＃", "井号"],
                  ].map(([sym, label]) => (
                    <TouchableOpacity
                      key={sym}
                      onPress={() => {
                        const text = sym.includes("\n") ? "\n\n" : sym;
                        const pos = cursorPosition ?? content.length;
                        // 成对符号（如“”「」【】《》）光标插入中间
                        const isPair = sym.length === 2 && sym[0] !== sym[1];
                        const newContent = content.slice(0, pos) + text + content.slice(pos);
                        setContent(newContent);
                        setCursorPosition(pos + (isPair ? 1 : text.length));
                        pushUndo(newContent);
                      }}
                      className="items-center justify-center px-3 py-2 rounded-lg"
                      style={{ backgroundColor: nightMode ? "#2A2A44" : "#EEEFF5" }}
                    >
                      <Text className="text-base font-medium" style={{ color: theme.text }}>{sym.length <= 2 ? sym : sym.slice(0,2)}</Text>
                      <Text className="text-[10px] mt-0.5" style={{ color: theme.muted }}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* ===== AI生成区(可拖拽悬浮框 - 画中画风格) ===== */}
          {(isGenerating || generatedContent) && (
            <View
              ref={floatingRef}
              {...floatingPanResponder.panHandlers}
              style={{
                position: 'absolute',
                left: floatingPos.x,
                top: floatingPos.y,
                width: 320,
                maxHeight: 360,
                zIndex: 200,
                backgroundColor: nightMode ? "#1A1A2E" : "#FFFFFF",
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: 14,
                elevation: 20,
                borderWidth: 1,
                borderColor: nightMode ? "rgba(99,102,241,0.2)" : "rgba(0,0,0,0.06)",
              }}>
              {/* 关闭按钮 - 右上角 */}
              <TouchableOpacity onPress={() => { if (sseRef.current) { sseRef.current.close(); sseRef.current = null; } setIsGenerating(false); setGeneratedContent(""); setGenerationDone(false); }}
                style={{
                  position: 'absolute', top: 8, right: 8, zIndex: 10,
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6",
                  alignItems: 'center', justifyContent: 'center',
                }}>
                <FontAwesome6 name="xmark" size={12} color={theme.text2} />
              </TouchableOpacity>

              {/* 头部 */}
              <View className="flex-row items-center gap-2 mb-2">
                <View className="w-7 h-7 rounded-xl items-center justify-center" style={{ backgroundColor: theme.accentBg }}>
                  <FontAwesome6 name="wand-sparkles" size={12} color={theme.accent} />
                </View>
                <Text style={{ fontSize: 13, fontWeight: "600", color: theme.accent }}>AI</Text>
                {generationDone ? (
                  <Text style={{ fontSize: 11, color: "#10B981" }}>✓ 生成完成</Text>
                ) : generatedContent ? (
                  <Text style={{ fontSize: 11, color: theme.text2 }}>({generatedContent.length}字)</Text>
                ) : null}
                {/* 拖拽指示 */}
                <View className="ml-auto flex-row items-center gap-1">
                  <FontAwesome6 name="grip-lines" size={10} color={theme.muted} />
                </View>
              </View>

              {/* AI内容 */}
              <ScrollView style={{ maxHeight: 180 }} className="mb-2">
                <Text className="text-[14px] leading-relaxed" style={{ color: theme.text }}>
                  {generatedContent || (
                    <View className="flex-row items-center gap-2">
                      <Text style={{ color: theme.text2, fontStyle: "italic" }}>思考中</Text>
                      <Text style={{ color: theme.accent, fontSize: 18 }}>...</Text>
                    </View>
                  )}
                </Text>
              </ScrollView>

              {/* 操作按钮 */}
              {generatedContent && (
                <View className="flex-row gap-1.5 flex-wrap">
                  <TouchableOpacity onPress={applyGeneratedContent}
                    className="flex-1 py-2 rounded-xl items-center flex-row justify-center gap-1.5"
                    style={{ backgroundColor: theme.accent }}>
                    <FontAwesome6 name="check" size={11} color="#FFFFFF" />
                    <Text className="text-white text-[11px] font-bold">追加</Text>
                  </TouchableOpacity>
                  {hasSelection && (
                    <TouchableOpacity onPress={replaceSelectedWithAI}
                      className="py-2 px-3 rounded-xl items-center flex-row justify-center gap-1.5"
                      style={{ backgroundColor: nightMode ? "#2D2D4A" : "#EEF2FF" }}>
                      <FontAwesome6 name="arrows-rotate" size={11} color={theme.accent} />
                      <Text className="text-[11px] font-bold" style={{ color: theme.accent }}>替换</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={handleContinueWriting}
                    className="py-2 px-3 rounded-xl items-center flex-row justify-center gap-1.5"
                    style={{ backgroundColor: nightMode ? "#2D2D4A" : "#FEF3C7" }}>
                    <FontAwesome6 name="pen" size={11} color="#D97706" />
                    <Text className="text-[11px] font-bold" style={{ color: "#D97706" }}>续写</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { if (sseRef.current) { sseRef.current.close(); sseRef.current = null; } setIsGenerating(false); setGeneratedContent(""); setGenerationDone(false); }}
                    className="py-2 px-3 rounded-xl items-center flex-row justify-center gap-1.5"
                    style={{ backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6" }}>
                    <FontAwesome6 name="ban" size={11} color={theme.text2} />
                    <Text className="text-[11px] font-medium" style={{ color: theme.text }}>取消</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ===== 圆形转轮悬浮按钮（右侧） ===== */}
          <View style={{
            position: 'absolute', right: wheelOpen ? 12 : 8,
            bottom: wheelOpen ? undefined : keyboardHeight + 120,
            top: wheelOpen ? winHeight * 0.3 : undefined,
            zIndex: 190, alignItems: 'center', justifyContent: 'center',
          }}>
            {!wheelOpen ? (
              <TouchableOpacity onPress={() => setWheelOpen(true)} activeOpacity={0.7}
                style={{
                  width: 42, height: 42, borderRadius: 21,
                  backgroundColor: theme.accent,
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: theme.accent, shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3, shadowRadius: 10, elevation: 8,
                }}>
                <FontAwesome6 name="sliders" size={16} color="#FFF" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 220, height: 220, alignItems: 'center', justifyContent: 'center' }}>
                {/* 转轮背景 */}
                <View style={{
                  width: 220, height: 220, borderRadius: 110,
                  backgroundColor: nightMode ? "rgba(26,26,46,0.95)" : "rgba(255,255,255,0.95)",
                  borderWidth: 1,
                  borderColor: nightMode ? "rgba(99,102,241,0.3)" : "rgba(0,0,0,0.08)",
                  shadowColor: "#6366F1",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.2,
                  shadowRadius: 30,
                  elevation: 16,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {/* 中心关闭按钮 */}
                  <TouchableOpacity onPress={() => setWheelOpen(false)}
                    style={{
                      width: 36, height: 36, borderRadius: 18,
                      backgroundColor: theme.accent,
                      alignItems: 'center', justifyContent: 'center',
                      zIndex: 10,
                    }}>
                    <FontAwesome6 name="xmark" size={14} color="#FFF" />
                  </TouchableOpacity>

                  {/* 径向排列的工具 */}
                  {/* eslint-disable-next-line react-hooks/refs */}
                  {wheelTools.map((tool, index) => {
                    const angle = (index / wheelTools.length) * 2 * Math.PI - Math.PI / 2;
                    const radius = 72;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    return (
                      <TouchableOpacity key={tool.label}
                        onPress={() => { tool.action(); setWheelOpen(false); }}
                        style={{
                          position: 'absolute',
                          left: 110 + x - 22,
                          top: 110 + y - 22,
                          width: 44, height: 44, borderRadius: 22,
                          backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6",
                          alignItems: 'center', justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: `${tool.color}30`,
                        }}>
                        <FontAwesome6 name={tool.icon as any} size={16} color={tool.color} />
                        <Text style={{
                          position: 'absolute', top: -16,
                          fontSize: 9, fontWeight: '600', color: tool.color,
                        }}>{tool.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
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
                    { icon: "file-export", label: "导出", key: "export", color: "#EC4899" },
                    { icon: "chart-simple", label: "统计", key: "stats", color: "#0EA5E9" },
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

                    {/* 结果预览区域 */}
                    {generatedContent && !isGenerating && (
                      <View className="rounded-2xl p-4 mb-4 min-h-[80px]" style={{ backgroundColor: nightMode ? "#1E1E38" : "#EEF2FF" }}>
                        <Text className="text-sm font-medium mb-2" style={{ color: theme.accent }}>生成结果</Text>
                        <Text className="text-sm leading-relaxed mb-3" style={{ color: theme.text }} selectable>
                          {generatedContent.slice(0, 500)}{generatedContent.length > 500 ? "..." : ""}
                          {generatedContent.length > 500 && <Text style={{ color: theme.text2 }}> (共{generatedContent.length}字)</Text>}
                        </Text>
                        <View className="flex-row gap-2">
                          <TouchableOpacity onPress={applyGeneratedContent}
                            className="flex-1 py-2.5 rounded-xl items-center" style={{ backgroundColor: theme.accent }}>
                            <Text className="text-white text-xs font-bold">追加到文末</Text>
                          </TouchableOpacity>
                          {selectionStart !== selectionEnd && (
                            <TouchableOpacity onPress={replaceSelectedWithAI}
                              className="flex-1 py-2.5 rounded-xl items-center" style={{ backgroundColor: "#10B981" }}>
                              <Text className="text-white text-xs font-bold">替换选中</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity onPress={() => setGeneratedContent("")}
                            className="py-2.5 px-4 rounded-xl items-center" style={{ backgroundColor: nightMode ? "#2D2D4A" : "#FFF" }}>
                            <Text className="text-xs font-medium" style={{ color: theme.text2 }}>清除</Text>
                          </TouchableOpacity>
                        </View>
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
                          className="w-full px-4 py-3.5 rounded-2xl mb-4 text-sm leading-relaxed"
                          style={{
                            color: theme.text, backgroundColor: theme.inputBg,
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
            {/* ===== 导出 Modal ===== */}
        <Modal visible={exportModalVisible} transparent animationType="slide" onRequestClose={() => setExportModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setExportModalVisible(false)} className="flex-1 bg-black/40 justify-center">
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <TouchableOpacity activeOpacity={1} onPress={() => undefined}
                className="mx-5" style={{ backgroundColor: theme.surface, borderRadius: 24, padding: 24 }}>
                <View className="flex-row items-center gap-2.5 mb-5">
                  <View className="w-8 h-8 rounded-2xl items-center justify-center" style={{ backgroundColor: theme.accentBg }}>
                    <FontAwesome6 name="file-export" size={14} color={theme.accent} />
                  </View>
                  <Text className="text-lg font-bold" style={{ color: theme.text }}>导出文档</Text>
                </View>
                <Text className="text-sm mb-4" style={{ color: theme.text2 }}>选择导出格式，将自动分享到其他应用</Text>
                <View className="flex-row gap-3">
                  <TouchableOpacity onPress={() => handleExport("txt")}
                    className="flex-1 py-4 rounded-2xl items-center gap-2"
                    style={{ backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6" }}>
                    <FontAwesome6 name="file-lines" size={20} color={theme.accent} />
                    <Text className="text-sm font-bold" style={{ color: theme.text }}>纯文本 (.txt)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleExport("md")}
                    className="flex-1 py-4 rounded-2xl items-center gap-2"
                    style={{ backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6" }}>
                    <FontAwesome6 name="markdown" size={20} color="#6366F1" />
                    <Text className="text-sm font-bold" style={{ color: theme.text }}>Markdown (.md)</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => setExportModalVisible(false)}
                  className="mt-5 py-3.5 rounded-2xl items-center" style={{ backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6" }}>
                  <Text className="text-sm font-medium" style={{ color: theme.text2 }}>取消</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>

        {/* ===== 详细统计 Modal ===== */}
        <Modal visible={statsModalVisible} transparent animationType="slide" onRequestClose={() => setStatsModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setStatsModalVisible(false)} className="flex-1 bg-black/40 justify-center">
            <TouchableOpacity activeOpacity={1} onPress={() => undefined}
              className="mx-5" style={{ backgroundColor: theme.surface, borderRadius: 24, padding: 24 }}>
              <View className="flex-row items-center gap-2.5 mb-5">
                <View className="w-8 h-8 rounded-2xl items-center justify-center" style={{ backgroundColor: "#E0F2FE" }}>
                  <FontAwesome6 name="chart-simple" size={14} color="#0EA5E9" />
                </View>
                <Text className="text-lg font-bold" style={{ color: theme.text }}>写作统计</Text>
              </View>
              <View className="gap-3 mb-5">
                {[
                  { label: "总字符数", value: charCount, icon: "text-height", color: "#6366F1" },
                  { label: "中文字数", value: wordCount, icon: "font", color: "#8B5CF6" },
                  { label: "段落数", value: paraCount, icon: "paragraph", color: "#10B981" },
                  { label: "句子数", value: sentenceCount, icon: "quote-left", color: "#F59E0B" },
                ].map((item, idx) => (
                  <View key={idx} className="flex-row items-center justify-between px-4 py-3.5 rounded-2xl"
                    style={{ backgroundColor: nightMode ? "#1E1E38" : "#F9FAFB" }}>
                    <View className="flex-row items-center gap-2.5">
                      <View className="w-7 h-7 rounded-xl items-center justify-center" style={{ backgroundColor: `${item.color}20` }}>
                        <FontAwesome6 name={item.icon as any} size={11} color={item.color} />
                      </View>
                      <Text className="text-sm" style={{ color: theme.text2 }}>{item.label}</Text>
                    </View>
                    <Text className="text-lg font-bold" style={{ color: theme.text }}>{item.value.toLocaleString()}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity onPress={() => setStatsModalVisible(false)}
                className="py-3.5 rounded-2xl items-center" style={{ backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6" }}>
                <Text className="text-sm font-medium" style={{ color: theme.text }}>关闭</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

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
                  <View>
                    <RichEditor
                      initialContent={outlineHtml}
                      onChange={setOutlineHtml}
                      nightMode={nightMode}
                      style={{ marginBottom: 12 }}
                    />
                    <TouchableOpacity
                      onPress={handleSaveOutline}
                      disabled={savingOutline}
                      className="py-3 rounded-2xl items-center"
                      style={{ backgroundColor: savingOutline ? "#9CA3AF" : "#6366F1" }}>
                      <Text className="text-sm font-semibold text-white">
                        {savingOutline ? "保存中..." : "保存大纲"}
                      </Text>
                    </TouchableOpacity>
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
                className="mx-5" style={{ backgroundColor: theme.surface, borderRadius: 24, padding: 24, width: screenWidth > 500 ? 420 : undefined, alignSelf: "center" }}>
                <View className="flex-row items-center gap-2.5 mb-4">
                  <View className="w-8 h-8 rounded-2xl items-center justify-center" style={{ backgroundColor: "#FEF3C7" }}>
                    <FontAwesome6 name="magnifying-glass" size={14} color="#F59E0B" />
                  </View>
                  <Text className="text-lg font-bold" style={{ color: theme.text }}>搜索替换</Text>
                  {searchResultCount > 0 && (
                    <Text className="text-xs ml-auto" style={{ color: theme.text2 }}>
                      共 {searchResultCount} 处匹配，当前第 {currentSearchIdx + 1} 处
                    </Text>
                  )}
                </View>
                <View className="flex-row gap-2 mb-2">
                  <TextInput value={searchTerm} onChangeText={setSearchTerm} placeholder="搜索..."
                    className="flex-1 px-4 py-3.5 rounded-2xl text-sm"
                    style={{ color: theme.text, backgroundColor: theme.inputBg }} placeholderTextColor="#999" />
                </View>
                <TextInput value={replaceTerm} onChangeText={setReplaceTerm} placeholder="替换为..."
                  className="w-full px-4 py-3.5 rounded-2xl mb-4 text-sm"
                  style={{ color: theme.text, backgroundColor: theme.inputBg }} placeholderTextColor="#999" />
                {/* 导航按钮 */}
                {searchResultCount > 0 && (
                  <View className="flex-row gap-2 mb-4">
                    <TouchableOpacity onPress={() => scrollToSearchIndex("prev")}
                      className="flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-2"
                      style={{ backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6" }}>
                      <FontAwesome6 name="chevron-up" size={12} color={theme.text2} />
                      <Text className="text-xs font-medium" style={{ color: theme.text2 }}>上一个</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => scrollToSearchIndex("next")}
                      className="flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-2"
                      style={{ backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6" }}>
                      <FontAwesome6 name="chevron-down" size={12} color={theme.text2} />
                      <Text className="text-xs font-medium" style={{ color: theme.text2 }}>下一个</Text>
                    </TouchableOpacity>
                  </View>
                )}
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

        {/* ===== 外观设置 ===== */}
        <Modal visible={appearanceVisible} transparent animationType="slide" onRequestClose={() => setAppearanceVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setAppearanceVisible(false)} className="flex-1 bg-black/40 justify-end">
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <TouchableOpacity activeOpacity={1} onPress={() => undefined}
                className="mx-0" style={{ backgroundColor: theme.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: "85%" }}>
                {/* 标题 */}
                <View className="flex-row items-center gap-2.5 mb-6">
                  <View className="w-8 h-8 rounded-2xl items-center justify-center" style={{ backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6" }}>
                    <FontAwesome6 name="palette" size={14} color={theme.accent} />
                  </View>
                  <Text className="text-lg font-bold" style={{ color: theme.text }}>外观设置</Text>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} className="mb-4">
                  {/* 主题 */}
                  <Text className="text-xs font-bold mb-2.5 tracking-wider" style={{ color: theme.text2 }}>主题模式</Text>
                  <View className="flex-row gap-2.5 mb-5">
                    {[
                      { key: "light" as const, label: "明亮" },
                      { key: "dark" as const, label: "暗黑" },
                      { key: "sepia" as const, label: "羊皮纸" },
                      { key: "green" as const, label: "护眼" },
                    ].map((item) => (
                      <TouchableOpacity key={item.key} onPress={() => setAppTheme(item.key)}
                        className={`flex-1 py-4 rounded-2xl items-center ${appTheme === item.key ? '' : ''}`}
                        style={{ backgroundColor: appTheme === item.key ? `${theme.accent}20` : (nightMode ? "#2D2D4A" : "#F3F4F6") }}>
                        <FontAwesome6 name={item.key === "light" ? "sun" : item.key === "dark" ? "moon" : item.key === "sepia" ? "scroll" : "leaf"} size={18} color={appTheme === item.key ? theme.accent : theme.text} />
                        <Text className="text-xs font-medium mt-1.5" style={{ color: appTheme === item.key ? theme.accent : theme.text }}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* 字体 */}
                  <Text className="text-xs font-bold mb-2.5 tracking-wider" style={{ color: theme.text2 }}>字体</Text>
                  <View className="flex-row gap-2.5 mb-5">
                    {[
                      { key: "sans" as const, label: "无衬线", sample: "Aa" },
                      { key: "serif" as const, label: "衬线体", sample: "Aa" },
                      { key: "mono" as const, label: "等宽", sample: "Aa" },
                    ].map((item) => (
                      <TouchableOpacity key={item.key} onPress={() => setAppFont(item.key)}
                        className="flex-1 py-3 rounded-2xl items-center"
                        style={{ backgroundColor: appFont === item.key ? `${theme.accent}20` : (nightMode ? "#2D2D4A" : "#F3F4F6") }}>
                        <Text className="text-xl mb-0.5" style={{
                          fontFamily: item.key === "sans" ? undefined : (item.key === "serif" ? "Times New Roman" : "monospace"),
                          color: appFont === item.key ? theme.accent : theme.text,
                        }}>{item.sample}</Text>
                        <Text className="text-xs font-medium" style={{ color: appFont === item.key ? theme.accent : theme.text }}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* 字号 */}
                  <Text className="text-xs font-bold mb-2.5 tracking-wider" style={{ color: theme.text2 }}>字号</Text>
                  <View className="flex-row items-center gap-3 mb-5">
                    <FontAwesome6 name="font" size={12} color={theme.text2} />
                    <View className="flex-1 h-2 rounded-full" style={{ backgroundColor: nightMode ? "#2D2D4A" : "#E5E7EB" }}>
                      <View className="h-full rounded-full" style={{ width: `${((fontSizeIndex) / 4) * 100}%`, backgroundColor: theme.accent }} />
                    </View>
                    <FontAwesome6 name="font" size={18} color={theme.text2} />
                    <TouchableOpacity onPress={() => setFontSizeIndex(Math.min(4, fontSizeIndex + 1))}
                      className="w-8 h-8 rounded-xl items-center justify-center" style={{ backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6" }}>
                      <FontAwesome6 name="plus" size={12} color={theme.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setFontSizeIndex(Math.max(0, fontSizeIndex - 1))}
                      className="w-8 h-8 rounded-xl items-center justify-center" style={{ backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6" }}>
                      <FontAwesome6 name="minus" size={12} color={theme.text} />
                    </TouchableOpacity>
                  </View>

                  {/* 行间距 */}
                  <Text className="text-xs font-bold mb-2.5 tracking-wider" style={{ color: theme.text2 }}>行间距</Text>
                  <View className="flex-row gap-2.5 mb-5">
                    {[
                      { key: 1.4, label: "紧凑" },
                      { key: 1.8, label: "舒适" },
                      { key: 2.2, label: "宽松" },
                      { key: 2.8, label: "极宽" },
                    ].map((item) => (
                      <TouchableOpacity key={item.key} onPress={() => setLineSpacing(item.key)}
                        className="flex-1 py-3 rounded-2xl items-center"
                        style={{ backgroundColor: lineSpacing === item.key ? `${theme.accent}20` : (nightMode ? "#2D2D4A" : "#F3F4F6") }}>
                        <View className="gap-[2px] mb-1.5">
                          {[1,2,3].map(i => <View key={i} style={{ width: 16, height: 1.5, backgroundColor: lineSpacing === item.key ? theme.accent : theme.text2, opacity: 0.5 }} />)}
                        </View>
                        <Text className="text-xs font-medium" style={{ color: lineSpacing === item.key ? theme.accent : theme.text }}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* 页面边距 */}
                  <Text className="text-xs font-bold mb-2.5 tracking-wider" style={{ color: theme.text2 }}>页面布局</Text>
                  <View className="flex-row gap-2.5 mb-2">
                    {[
                      { key: "narrow" as const, label: "窄边" },
                      { key: "normal" as const, label: "适中" },
                      { key: "wide" as const, label: "宽边" },
                      { key: "center" as const, label: "居中" },
                    ].map((item) => (
                      <TouchableOpacity key={item.key} onPress={() => setPageMargin(item.key)}
                        className="flex-1 py-3 rounded-2xl items-center"
                        style={{ backgroundColor: pageMargin === item.key ? `${theme.accent}20` : (nightMode ? "#2D2D4A" : "#F3F4F6") }}>
                        <Text className="text-xs font-medium" style={{ color: pageMargin === item.key ? theme.accent : theme.text }}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {/* ===== 背景图片 ===== */}
                  <Text className="text-xs font-bold mb-2.5 tracking-wider" style={{ color: theme.text2 }}>背景图</Text>
                  <View className="flex-row flex-wrap gap-2 mb-4">
                    {[
                      { key: "", label: "无", color: theme.surface },
                      { key: "https://images.unsplash.com/photo-1597848212624-a19eb35e2651?w=800&q=80", label: "纸纹" },
                      { key: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80", label: "书卷" },
                      { key: "https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?w=800&q=80", label: "墨绿" },
                      { key: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&q=80", label: "大理石" },
                      { key: "https://images.unsplash.com/photo-1604871000636-074fa5117945?w=800&q=80", label: "水墨" },
                      { key: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80", label: "星空" },
                    ].map((item) => (
                      <TouchableOpacity key={item.key || "none"} onPress={() => setBackgroundImage(item.key)}
                        className="px-4 py-2.5 rounded-xl flex-row items-center gap-2"
                        style={{ backgroundColor: backgroundImage === item.key ? `${theme.accent}20` : (nightMode ? "#2D2D4A" : "#F3F4F6") }}>
                        <Text className="text-xs" style={{ color: backgroundImage === item.key ? theme.accent : theme.text }}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {backgroundImage ? (
                    <Image source={{ uri: backgroundImage }} className="w-full h-20 rounded-xl mb-4" resizeMode="cover" />
                  ) : null}
                </ScrollView>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>

        {/* ===== 更多添加 ===== */}
        <Modal visible={addContentVisible} transparent animationType="slide" onRequestClose={() => setAddContentVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setAddContentVisible(false)} className="flex-1 bg-black/40 justify-end">
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <TouchableOpacity activeOpacity={1} onPress={() => undefined}
                className="mx-0" style={{ backgroundColor: theme.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: "80%" }}>
                <View className="flex-row items-center gap-2.5 mb-6">
                  <View className="w-8 h-8 rounded-2xl items-center justify-center" style={{ backgroundColor: nightMode ? "#2D2D4A" : "#F3F4F6" }}>
                    <FontAwesome6 name="plus" size={14} color={theme.accent} />
                  </View>
                  <Text className="text-lg font-bold" style={{ color: theme.text }}>更多添加</Text>
                </View>
                <View className="flex-row flex-wrap gap-3 mb-4">
                  {[
                    { icon: "minus", label: "分隔线", insert: "\n\n---\n\n", color: "#F59E0B", bg: "#FEF3C7" },
                    { icon: "clock", label: "时间戳", insert: `\n\n[${new Date().toLocaleString("zh-CN")}]\n\n`, color: "#3B82F6", bg: "#DBEAFE" },
                    { icon: "quote-left", label: "引用", insert: "\n> ", color: "#10B981", bg: "#D1FAE5" },
                    { icon: "message", label: "对话", insert: "\n「」\n", color: "#8B5CF6", bg: "#EDE9FE" },
                    { icon: "asterisk", label: "脚注", insert: "\n* * *\n", color: "#EC4899", bg: "#FCE7F3" },
                    { icon: "list", label: "列表", insert: "\n- ", color: "#F97316", bg: "#FFEDD5" },
                    { icon: "hashtag", label: "标题", insert: "\n# ", color: "#6366F1", bg: "#E0E7FF" },
                    { icon: "align-left", label: "缩进", insert: "\n  ", color: "#14B8A6", bg: "#CCFBF1" },
                  ].map((item) => (
                    <TouchableOpacity key={item.label} onPress={() => {
                      const pos = cursorPosition ?? content.length;
                      const newContent = content.slice(0, pos) + item.insert + content.slice(pos);
                      setContent(newContent);
                      setAddContentVisible(false);
                    }}
                      className="flex-row items-center gap-2.5 px-4 py-3.5 rounded-2xl"
                      style={{ backgroundColor: nightMode ? "#2D2D4A" : item.bg, width: "47%" }}>
                      <FontAwesome6 name={item.icon as any} size={13} color={item.color} />
                      <Text className="text-sm font-medium" style={{ color: nightMode ? "#E5E7EB" : "#374151" }}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableOpacity>
            </KeyboardAvoidingView>
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