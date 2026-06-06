/**
 * @file 作品详情页
 * @description 展示单部作品的完整信息，包含四个子 Tab 页：
 *
 * - 章节 Tab：展示卷/章节树，支持展开收起，提供添加/删除/重命名操作
 * - 大纲 Tab：展示大纲列表+AI生成大纲，支持新建/编辑/删除大纲和细纲
 * - 设定 Tab：展示/编辑世界观设定信息
 * - 灵感 Tab：灵感记录列表
 *
 * 大纲管理要点：
 * - 大纲（type:"outline"）的新建/编辑跳转至 /outline-create 使用 Quill 编辑器
 * - 细纲（type:"summary"）在 Modal 中完成编辑
 * - 数据通过 GET/PUT /api/v1/writing/:id/outline-items 持久化
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Image,
  Linking,
  ActivityIndicator,
} from "react-native";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/contexts/AuthContext";
import { useFocusEffect } from "expo-router";
import { useSafeRouter, useSafeSearchParams } from "@/hooks/useSafeRouter";
import { FontAwesome6 } from "@expo/vector-icons";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

interface Chapter {
  id: string;
  title: string;
  wordCount: number;
  createdAt: string;
  content?: string;
}

interface Volume {
  id: string;
  title: string;
  order: number;
  chapters: Chapter[];
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
  volumes: Volume[];
  outline?: string;
}

function getChapterCount(book: Book): number {
  if (!book.volumes) return 0;
  return book.volumes.reduce((sum, v) => sum + (v.chapters?.length || 0), 0);
}

function formatWordCount(n: number | undefined | null) {
  if (n == null) return "0";
  if (n >= 10000) return (n / 10000).toFixed(1) + "万";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toString();
}

function getStatusConfig(status: string) {
  const configs: Record<string, { label: string; bg: string; text: string }> = {
    writing: { label: "连载中", bg: "bg-emerald-500/10", text: "text-emerald-600" },
    completed: { label: "已完结", bg: "bg-blue-500/10", text: "text-blue-600" },
    draft: { label: "草稿", bg: "bg-gray-100", text: "text-gray-500" },
    paused: { label: "暂停", bg: "bg-amber-500/10", text: "text-amber-600" },
  };
  return configs[status] || configs.draft;
}

const CATEGORY_ICONS: Record<string, string> = {
 玄幻: "dragon", 仙侠: "wand-magic", 言情: "heart", 都市: "building",
 悬疑: "magnifying-glass", 科幻: "rocket", 历史: "landmark", 游戏: "gamepad",
};

// ====== 设定数据类型 ======
interface WorldSetting {
  id: string;
  type: "角色" | "物品" | "世界背景" | "金手指" | string;
  name: string;
  description: string;
}

interface Outline {
  id: string;
  type: "大纲" | "细纲";
  title: string;
  content: string;
}

interface Inspiration {
  id: string;
  content: string;
  createdAt: string;
}

const defaultWorldSettings: WorldSetting[] = [];
const defaultOutlines: Outline[] = [];
const defaultInspirations: Inspiration[] = [];

export default function DetailScreen() {
  const router = useSafeRouter();
  const { id } = useSafeSearchParams<{ id: string }>();
  const { token } = useAuth();
  const getAuthHeaders = useCallback(() => ({ "Content-Type": "application/json", ...(token ? { "x-session": token } : {}) }), [token]);
  const [book, setBook] = useState<Book | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chapterTitle, setChapterTitle] = useState("");
  const [selectedVolumeId, setSelectedVolumeId] = useState("");

  // 卷折叠状态
  const [collapsedVolumes, setCollapsedVolumes] = useState<Record<string, boolean>>({});

  // 章节编辑状态
  const [editingChapter, setEditingChapter] = useState<{ id: string; title: string } | null>(null);
  const [editChapterTitle, setEditChapterTitle] = useState("");
  
  // 章节操作菜单状态
  const [chapterActionChapter, setChapterActionChapter] = useState<Chapter | null>(null);
  const [deleteConfirmInfo, setDeleteConfirmInfo] = useState<{ id: string; title: string; type: "chapter" | "volume" } | null>(null);

  // 卷编辑状态
  const [editingVolume, setEditingVolume] = useState<{ id: string; title: string } | null>(null);
  const [editVolumeTitle, setEditVolumeTitle] = useState("");

  // +菜单: 选择创建卷或章节
  const [plusMenuVolumeId, setPlusMenuVolumeId] = useState<string | null>(null);
  // 创建卷
  const [volumeCreateVisible, setVolumeCreateVisible] = useState(false);
  const [volumeName, setVolumeName] = useState("");

  // Tab 状态
  const [activeTab, setActiveTab] = useState<"章节" | "大纲" | "设定" | "灵感">("章节");
  const [chapterSort, setChapterSort] = useState<"asc" | "desc">("asc");

  // 设定状态
  const [settings, setSettings] = useState<WorldSetting[]>(defaultWorldSettings);
  const [settingModal, setSettingModal] = useState(false);
  const [newSetting, setNewSetting] = useState({ type: "角色", name: "", description: "" });

  // 大纲状态
  const [outlines, setOutlines] = useState<Outline[]>(defaultOutlines);
  const [outlineModal, setOutlineModal] = useState(false);
  const [newOutline, setNewOutline] = useState({ type: "大纲" as "大纲" | "细纲", title: "", content: "" });

  // 灵感状态
  const [inspirations, setInspirations] = useState<Inspiration[]>(defaultInspirations);
  const [inspirationModal, setInspirationModal] = useState(false);
  const [newInspiration, setNewInspiration] = useState("");

  // 自定义设定类型
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [showTypeInput, setShowTypeInput] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

  // 更多操作弹窗
  const [actionModal, setActionModal] = useState(false);

  // === 大纲折叠状态 ===
  const [collapsedOutlines, setCollapsedOutlines] = useState<Record<string, boolean>>({});
  // 大纲编辑状态
  const [editingOutline, setEditingOutline] = useState<Outline | null>(null);
  const [editOutlineTitle, setEditOutlineTitle] = useState("");
  const [editOutlineContent, setEditOutlineContent] = useState("");
  const [editOutlineType, setEditOutlineType] = useState<"大纲" | "细纲">("大纲");
  // 大纲导入弹窗
  const [importOutlineVisible, setImportOutlineVisible] = useState(false);
  const [importOutlineText, setImportOutlineText] = useState("");

  // === 设定编辑状态 ===
  const [editingSettingItem, setEditingSettingItem] = useState<WorldSetting | null>(null);
  const [editSettingType, setEditSettingType] = useState("角色");
  const [editSettingName, setEditSettingName] = useState("");
  const [editSettingDesc, setEditSettingDesc] = useState("");
  const [editSettingVisible, setEditSettingVisible] = useState(false);

  // === 灵感折叠状态 ===
  const [collapsedInspirations, setCollapsedInspirations] = useState(false);
  // 灵感编辑
  const [editingInspiration, setEditingInspiration] = useState<Inspiration | null>(null);
  const [editInspirationContent, setEditInspirationContent] = useState("");
  const [editInspirationVisible, setEditInspirationVisible] = useState(false);

  const fetchBook = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/v1/writing/${id}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setBook(json.data);
    } catch (e) {
      console.error("获取书籍详情失败", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // ===== 大纲 API =====
  const fetchOutlines = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/${id}/outline-items`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setOutlines(json.data || []);
    } catch (e) { console.error("获取大纲失败", e); }
  }, [id]);

  const saveOutlines = async (newOutlines: Outline[]) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/${id}/outline-items`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ items: newOutlines }),
      });
      const json = await res.json();
      if (json.success) setOutlines(newOutlines);
    } catch (e) { Alert.alert("错误", "保存大纲失败"); }
  };

  // ===== 设定 API =====
  const fetchSettings = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/${id}/settings`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setSettings(json.data || []);
    } catch (e) { console.error("获取设定失败", e); }
  }, [id]);

  const saveSettings = async (newSettings: WorldSetting[]) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/${id}/settings`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ data: newSettings }),
      });
      const json = await res.json();
      if (json.success) setSettings(newSettings);
    } catch (e) { Alert.alert("错误", "保存设定失败"); }
  };

  // ===== 灵感 API =====
  const fetchInspirations = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/${id}/inspirations`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setInspirations(json.data || []);
    } catch (e) { console.error("获取灵感失败", e); }
  }, [id]);

  const saveInspirations = async (newInspirations: Inspiration[]) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/${id}/inspirations`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ data: newInspirations }),
      });
      const json = await res.json();
      if (json.success) setInspirations(newInspirations);
    } catch (e) { Alert.alert("错误", "保存灵感失败"); }
  };

  useFocusEffect(
    useCallback(() => {
      fetchBook();
      fetchOutlines();
      fetchSettings();
      fetchInspirations();
    }, [fetchBook, fetchOutlines, fetchSettings, fetchInspirations])
  );

  const handleCreateChapter = async () => {
    if (!chapterTitle.trim()) {
      Alert.alert("提示", "请输入章节标题");
      return;
    }
    const volumeId = selectedVolumeId || (book?.volumes?.[0]?.id);
    if (!volumeId) {
      Alert.alert("提示", "请先创建卷");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/${id}/volumes/${volumeId}/chapters`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ title: chapterTitle.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setModalVisible(false);
        setChapterTitle("");
        setSelectedVolumeId("");
        await fetchBook();
        router.push("/editor", { bookId: id, chapterId: json.data.id });
      } else {
        Alert.alert("错误", json.error || "创建章节失败");
      }
    } catch (e) {
      Alert.alert("错误", "创建章节失败");
    }
  };

  const handleCreateVolume = async () => {
    const name = volumeName.trim();
    if (!name) { Alert.alert("提示", "请输入卷名"); return; }
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/${id}/volumes`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ title: name }),
      });
      const json = await res.json();
      if (json.success) {
        setVolumeCreateVisible(false);
        setVolumeName("");
        await fetchBook();
      } else {
        Alert.alert("错误", json.error || "创建卷失败");
      }
    } catch (e) {
      Alert.alert("错误", "创建卷失败");
    }
  };

  const handleDeleteChapter = (chapterId: string, chapterTitle: string) => {
    setDeleteConfirmInfo({ id: chapterId, title: chapterTitle, type: "chapter" });
  };
  const handleConfirmDelete = async () => {
    if (!deleteConfirmInfo) return;
    const { id: itemId, type } = deleteConfirmInfo;
    setDeleteConfirmInfo(null);
    try {
      if (type === "chapter") {
        const res = await fetch(`${API_BASE}/api/v1/writing/${id}/chapters/${itemId}`, { method: "DELETE", headers: getAuthHeaders() });
        const json = await res.json();
        if (json.success) await fetchBook();
      } else if (type === "volume") {
        const res = await fetch(`${API_BASE}/api/v1/writing/${id}/volumes/${itemId}`, { method: "DELETE", headers: getAuthHeaders() });
        const json = await res.json();
        if (json.success) await fetchBook();
      }
    } catch (e) { Alert.alert("错误", `删除${type === "chapter" ? "章节" : "卷"}失败`); }
  };

  // 编辑章节
  const handleUpdateChapter = async (chapterId: string, newTitle: string) => {
    if (!newTitle.trim()) {
      Alert.alert("提示", "请输入章节标题");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/${id}/chapters/${chapterId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setModalVisible(false);
        setEditingChapter(null);
        setEditChapterTitle("");
        await fetchBook();
      } else {
        Alert.alert("错误", json.error || "修改失败");
      }
    } catch (e) {
      Alert.alert("错误", "修改章节失败");
    }
  };

  // 长按章节 - 弹出操作选项
  const handleLongPressChapter = (chapter: Chapter) => {
    setChapterActionChapter(chapter);
  };

  // 编辑卷名
  const handleUpdateVolume = async (volumeId: string, currentTitle: string) => {
    setEditingVolume({ id: volumeId, title: currentTitle });
    setEditVolumeTitle(currentTitle);
  };

  // 删除卷 - 改用 Modal 确认，跨平台兼容
  const handleDeleteVolume = (volumeId: string, volumeTitle: string) => {
    setDeleteConfirmInfo({ id: volumeId, title: volumeTitle, type: "volume" });
  };

  // 长按卷 - 弹出操作选项（用 Modal 替代 Alert，跨平台兼容）
  const handleLongPressVolume = (volume: Volume) => {
    setEditVolumeTitle(volume.title);
    setEditingVolume({ id: volume.id, title: volume.title });
  };

  // 新增设定
  const handleAddSetting = () => {
    if (!newSetting.name.trim()) { Alert.alert("提示", "请输入名称"); return; }
    const item: WorldSetting = { id: Date.now().toString(), ...newSetting };
    saveSettings([...settings, item]);
    setSettingModal(false);
    setNewSetting({ type: "角色", name: "", description: "" });
  };

  // 编辑设定
  const handleSaveEditSetting = () => {
    if (!editSettingName.trim() || !editingSettingItem) return;
    const updated = settings.map(s =>
      s.id === editingSettingItem.id
        ? { ...s, type: editSettingType, name: editSettingName.trim(), description: editSettingDesc.trim() }
        : s
    );
    saveSettings(updated);
    setEditSettingVisible(false);
    setEditingSettingItem(null);
  };

  // 删除设定
  const handleDeleteSetting = (settingId: string) => {
    saveSettings(settings.filter((s) => s.id !== settingId));
  };

  // 新增大纲
  const handleAddOutline = () => {
    if (!newOutline.title.trim()) { Alert.alert("提示", "请输入标题"); return; }
    const item: Outline = { id: Date.now().toString(), ...newOutline };
    saveOutlines([...outlines, item]);
    setOutlineModal(false);
    setNewOutline({ type: "大纲", title: "", content: "" });
  };

  // 编辑大纲
  const handleSaveEditOutline = () => {
    if (!editOutlineTitle.trim() || !editingOutline) return;
    const updated = outlines.map(o =>
      o.id === editingOutline.id
        ? { ...o, type: editOutlineType, title: editOutlineTitle.trim(), content: editOutlineContent.trim() }
        : o
    );
    saveOutlines(updated);
    setEditingOutline(null);
  };

  // 删除大纲
  const handleDeleteOutline = (outlineId: string) => {
    saveOutlines(outlines.filter(o => o.id !== outlineId));
  };

  // 导入大纲
  const handleImportOutline = () => {
    if (!importOutlineText.trim()) { Alert.alert("提示", "请输入大纲内容"); return; }
    const lines = importOutlineText.trim().split("\n").filter(l => l.trim());
    const newOnes: Outline[] = lines.map((line, i) => ({
      id: Date.now().toString() + "_" + i,
      type: "大纲" as "大纲" | "细纲",
      title: line.length > 40 ? line.substring(0, 40) + "..." : line,
      content: line,
    }));
    saveOutlines([...outlines, ...newOnes]);
    setImportOutlineVisible(false);
    setImportOutlineText("");
  };

  // 新增灵感
  const handleAddInspiration = () => {
    if (!newInspiration.trim()) { Alert.alert("提示", "请输入内容"); return; }
    const item: Inspiration = { id: Date.now().toString(), content: newInspiration, createdAt: new Date().toISOString().split("T")[0] };
    saveInspirations([...inspirations, item]);
    setInspirationModal(false);
    setNewInspiration("");
  };

  // 编辑灵感
  const handleSaveEditInspiration = () => {
    if (!editInspirationContent.trim() || !editingInspiration) return;
    const updated = inspirations.map(i =>
      i.id === editingInspiration.id ? { ...i, content: editInspirationContent.trim() } : i
    );
    saveInspirations(updated);
    setEditInspirationVisible(false);
    setEditingInspiration(null);
  };

  // 删除灵感
  const handleDeleteInspiration = (inspirationId: string) => {
    saveInspirations(inspirations.filter(i => i.id !== inspirationId));
  };

  if (!book) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">加载中...</Text>
        </View>
      </Screen>
    );
  }

  // Flatten all chapters from all volumes for sorting
  const allChapters = book.volumes?.flatMap((v) => v.chapters || []) || [];
  const sortedChapters = [...allChapters].sort((a, b) =>
    chapterSort === "asc" ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id)
  );
  const statusConfig = getStatusConfig(book.status);
  const catIcon = CATEGORY_ICONS[book.category] || "book";

  const allSettingTypes = ["角色", "物品", "世界背景", "金手指", ...customTypes];

  const renderSettingTab = () => (
    <View className="pb-8">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-base font-bold text-gray-800">设定管理</Text>
        <TouchableOpacity
          onPress={() => setSettingModal(true)}
          className="w-8 h-8 rounded-full bg-primary-500/10 items-center justify-center"
        >
          <FontAwesome6 name="plus" size={14} color="#6366F1" />
        </TouchableOpacity>
      </View>

      {allSettingTypes.map((type) => {
        const items = settings.filter((s) => s.type === type);
        return (
          <View key={type} className="mb-4">
            <TouchableOpacity
              className="flex-row items-center justify-between mb-2"
              onPress={() => setCollapsedOutlines(prev => ({ ...prev, ["setting_" + type]: !prev["setting_" + type] }))}
            >
              <Text className="text-sm font-semibold text-gray-600">{type} ({items.length})</Text>
              <FontAwesome6 name={collapsedOutlines["setting_" + type] ? "chevron-down" : "chevron-up"} size={10} color="#9CA3AF" />
            </TouchableOpacity>
            {collapsedOutlines["setting_" + type] ? null : items.length === 0 ? (
              <Text className="text-xs text-gray-400 ml-1">暂无{type}</Text>
            ) : (
              items.map((item) => (
                <View key={item.id} className="bg-white rounded-xl p-3 mb-2 flex-row items-center justify-between"
                  style={{ shadowColor: "#6366F1", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
                >
                  <TouchableOpacity className="flex-1 mr-2" onPress={() => {
                    setEditingSettingItem(item);
                    setEditSettingType(item.type);
                    setEditSettingName(item.name);
                    setEditSettingDesc(item.description);
                    setEditSettingVisible(true);
                  }}>
                    <Text className="text-sm font-medium text-gray-800">{item.name}</Text>
                    {item.description ? <Text className="text-xs text-gray-500 mt-0.5">{item.description}</Text> : null}
                  </TouchableOpacity>
                  <View className="flex-row gap-2">
                    <TouchableOpacity onPress={() => {
                      setEditingSettingItem(item);
                      setEditSettingType(item.type);
                      setEditSettingName(item.name);
                      setEditSettingDesc(item.description);
                      setEditSettingVisible(true);
                    }}>
                      <FontAwesome6 name="pen-to-square" size={13} color="#6366F1" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteSetting(item.id)}>
                      <FontAwesome6 name="trash-can" size={13} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        );
      })}

      <TouchableOpacity
        onPress={() => setShowTypeInput(true)}
        className="flex-row items-center gap-2 mt-2"
      >
        <FontAwesome6 name="circle-plus" size={14} color="#6366F1" />
        <Text className="text-sm text-primary-500">自定义设定分类</Text>
      </TouchableOpacity>

      {showTypeInput && (
        <View className="flex-row items-center gap-2 mt-2">
          <TextInput
            className="flex-1 bg-white rounded-xl px-4 py-2 text-sm border border-gray-200"
            placeholder="输入分类名称"
            value={newTypeName}
            onChangeText={setNewTypeName}
          />
          <TouchableOpacity
            onPress={() => {
              if (newTypeName.trim() && !customTypes.includes(newTypeName.trim())) {
                setCustomTypes([...customTypes, newTypeName.trim()]);
                setNewTypeName("");
                setShowTypeInput(false);
              }
            }}
            className="bg-primary-500 px-4 py-2 rounded-xl"
          >
            <Text className="text-white text-sm font-medium">添加</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderOutlineTab = () => (
    <View className="pb-8">
      {/* AI 生成的大纲 */}
      {book.outline ? (
        <View className="mb-5">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <View className="w-7 h-7 rounded-full bg-amber-500/10 items-center justify-center">
                <FontAwesome6 name="wand-magic-sparkles" size={12} color="#F59E0B" />
              </View>
              <Text className="text-base font-bold text-gray-800">AI 生成大纲</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                const url = `${API_BASE}/api/v1/writing/${id}/outline/export`;
                if (Platform.OS === "web") {
                  window.open(url, "_blank");
                } else {
                  Linking.openURL(url);
                }
              }}
              className="h-8 px-3 rounded-xl bg-amber-500/10 flex-row items-center gap-1.5"
            >
              <FontAwesome6 name="download" size={11} color="#F59E0B" />
              <Text className="text-xs font-medium text-amber-600">导出MD</Text>
            </TouchableOpacity>
          </View>
          <View className="bg-amber-50 rounded-2xl p-5 border border-amber-200/30">
            {book.outline.split("\n").map((line: string, i: number) => {
              if (line.startsWith("## ")) {
                return (
                  <Text key={i} className="text-base font-bold text-amber-900 mt-4 mb-2 first:mt-0 leading-6" selectable>
                    {line.replace("## ", "")}
                  </Text>
                );
              }
              if (line.startsWith("### ")) {
                return (
                  <Text key={i} className="text-sm font-semibold text-amber-800 mt-3 mb-1.5 leading-6" selectable>
                    {line.replace("### ", "")}
                  </Text>
                );
              }
              if (line.startsWith("**") && line.endsWith("**")) {
                return (
                  <Text key={i} className="text-sm font-bold text-amber-800 leading-6" selectable>
                    {line.replace(/\*\*/g, "")}
                  </Text>
                );
              }
              if (line.startsWith("- ") || line.startsWith("* ")) {
                return (
                  <Text key={i} className="text-sm text-gray-700 leading-7 ml-3" selectable>
                    {"• "}{line.substring(2)}
                  </Text>
                );
              }
              if (line.startsWith("1. ") || line.startsWith("2. ") || line.startsWith("3. ") || line.startsWith("4. ") || line.startsWith("5. ") || line.startsWith("6. ")) {
                return (
                  <Text key={i} className="text-sm text-gray-700 leading-7 ml-2" selectable>
                    {line}
                  </Text>
                );
              }
              if (line.trim() === "") {
                return <View key={i} className="h-1.5" />;
              }
              return (
                <Text key={i} className="text-sm text-gray-700 leading-6" selectable>
                  {line}
                </Text>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* 手动大纲管理 */}
      <View className="flex-row gap-2 mb-4">
        <TouchableOpacity
          onPress={() => router.push("/outline-create", { bookId: id })}
          className="flex-1 py-3 rounded-2xl items-center flex-row justify-center gap-2"
          style={{ backgroundColor: "#6366F1" }}
        >
          <FontAwesome6 name="plus" size={13} color="white" />
          <Text className="text-sm font-bold text-white">新建大纲</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { setNewOutline({ type: "细纲", title: "", content: "" }); setOutlineModal(true); }}
          className="py-3 px-5 rounded-2xl items-center flex-row gap-2 bg-white"
          style={{ shadowColor: "#6366F1", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
        >
          <FontAwesome6 name="pen" size={13} color="#6B7280" />
          <Text className="text-sm font-medium text-gray-700">新建细纲</Text>
        </TouchableOpacity>
      </View>

      {/* 导入按钮 */}
      <TouchableOpacity
        onPress={() => { setImportOutlineText(""); setImportOutlineVisible(true); }}
        className="flex-row items-center gap-1.5 mb-4"
      >
        <FontAwesome6 name="file-import" size={12} color="#6366F1" />
        <Text className="text-xs text-primary-500">批量导入大纲</Text>
      </TouchableOpacity>

      {["大纲", "细纲"].map((type) => {
        const items = outlines.filter((o) => o.type === type);
        const collapsedKey = "outline_" + type;
        return (
          <View key={type} className="mb-4">
            <TouchableOpacity
              className="flex-row items-center justify-between mb-2"
              onPress={() => setCollapsedOutlines(prev => ({ ...prev, [collapsedKey]: !prev[collapsedKey] }))}
            >
              <Text className="text-sm font-semibold text-gray-700">{type} ({items.length})</Text>
              <FontAwesome6 name={collapsedOutlines[collapsedKey] ? "chevron-down" : "chevron-up"} size={10} color="#9CA3AF" />
            </TouchableOpacity>
            {collapsedOutlines[collapsedKey] ? null : items.length === 0 ? (
              <Text className="text-xs text-gray-400 ml-1">暂无{type}</Text>
            ) : (
              items.map((item) => (
                <View key={item.id} className="bg-white rounded-2xl p-4 mb-2"
                  style={{ shadowColor: "#6366F1", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-bold text-gray-800 flex-1 mr-2">{item.title}</Text>
                    <View className="flex-row gap-2.5">
                      <TouchableOpacity onPress={() => {
                        if (item.type === "大纲") {
                          router.push("/outline-create", { bookId: id, outlineId: item.id });
                        } else {
                          setEditingOutline(item);
                          setEditOutlineType(item.type);
                          setEditOutlineTitle(item.title);
                          setEditOutlineContent(item.content);
                        }
                      }}>
                        <FontAwesome6 name="pen-to-square" size={13} color="#6366F1" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteOutline(item.id)}>
                        <FontAwesome6 name="trash-can" size={13} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {item.content ? <Text className="text-xs text-gray-500 mt-1.5 leading-relaxed">{item.content}</Text> : null}
                </View>
              ))
            )}
          </View>
        );
      })}
    </View>
  );

  const renderInspirationTab = () => (
    <View className="pb-8">
      <TouchableOpacity
        onPress={() => setInspirationModal(true)}
        className="py-3 rounded-2xl items-center flex-row justify-center gap-2 mb-4"
        style={{ backgroundColor: "#8B5CF6" }}
      >
        <FontAwesome6 name="lightbulb" size={14} color="white" />
        <Text className="text-sm font-bold text-white">记录灵感</Text>
      </TouchableOpacity>

      {/* 折叠切换 */}
      <TouchableOpacity
        className="flex-row items-center gap-2 mb-3"
        onPress={() => setCollapsedInspirations(!collapsedInspirations)}
      >
        <FontAwesome6 name={collapsedInspirations ? "chevron-down" : "chevron-up"} size={10} color="#9CA3AF" />
        <Text className="text-xs font-medium text-gray-500">灵感笔记 ({inspirations.length})</Text>
      </TouchableOpacity>

      {!collapsedInspirations && (inspirations.length === 0 ? (
        <View className="bg-white rounded-3xl py-12 items-center"
          style={{ shadowColor: "#8B5CF6", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
        >
          <FontAwesome6 name="lightbulb" size={36} color="#D1D5DB" />
          <Text className="text-sm text-gray-400 mt-3">还没有灵感笔记</Text>
          <Text className="text-xs text-gray-300 mt-1">随时记录创作灵感</Text>
        </View>
      ) : (
        inspirations.map((item) => (
          <View key={item.id} className="bg-white rounded-2xl p-4 mb-2"
            style={{ shadowColor: "#8B5CF6", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1 mr-2">
                <Text className="text-sm text-gray-700 leading-relaxed">{item.content}</Text>
                <Text className="text-xs text-gray-400 mt-2">{item.createdAt}</Text>
              </View>
              <View className="flex-row gap-2.5 mt-1">
                <TouchableOpacity onPress={() => {
                  setEditingInspiration(item);
                  setEditInspirationContent(item.content);
                  setEditInspirationVisible(true);
                }}>
                  <FontAwesome6 name="pen-to-square" size={13} color="#8B5CF6" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteInspiration(item.id)}>
                  <FontAwesome6 name="trash-can" size={13} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))
      ))}
    </View>
  );

  return (
    <Screen>
      {loading ? (
        <View className="flex-1 items-center justify-center py-32">
          <ActivityIndicator size="large" color="#6366F1" />
          <Text className="text-gray-400 mt-4 text-sm">加载中...</Text>
        </View>
      ) : (
      <ScrollView
        className="flex-1 px-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchBook(); setRefreshing(false); }} tintColor="#6366F1" />}
      >
        {/* 书籍封面头部 */}
        <View className="mt-2 mb-4">
          {book.coverImage ? (
            <View className="rounded-3xl overflow-hidden h-52 relative">
              <Image source={{ uri: `${API_BASE}${book.coverImage}` }} className="w-full h-full" resizeMode="cover" />
              <View className="absolute inset-0 bg-black/30" />
              <View className="absolute bottom-0 left-0 right-0 p-6">
                <Text className="text-white/70 text-sm font-medium tracking-wider">{book.category}</Text>
                <Text className="text-white text-2xl font-bold mt-1" numberOfLines={2}>{book.title}</Text>
                <Text className="text-white/60 text-xs mt-1">{book.createdAt}</Text>
              </View>
            </View>
          ) : (
            <View className="rounded-3xl px-6 py-8 items-center" style={{ backgroundColor: "#6366F1" }}>
              <FontAwesome6 name={catIcon} size={44} color="rgba(255,255,255,0.9)" />
              <Text className="text-white/70 text-sm mt-2 font-medium tracking-wider">{book.category}</Text>
              <Text className="text-white text-2xl font-bold mt-3 text-center" numberOfLines={2}>{book.title}</Text>
              <Text className="text-white/60 text-xs mt-2">{book.createdAt}</Text>
            </View>
          )}
        </View>

        {/* 状态标签 */}
        <View className="flex-row justify-center -mt-2 mb-4 gap-2">
          <View className="px-3 py-1.5 rounded-full bg-white flex-row items-center gap-1.5"
            style={{ shadowColor: "#6366F1", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }}>
            <View className="w-2 h-2 rounded-full bg-emerald-500" />
            <Text className="text-xs font-medium text-gray-700">{statusConfig.label}</Text>
          </View>
          <View className="px-3 py-1.5 rounded-full bg-white flex-row items-center gap-1.5"
            style={{ shadowColor: "#6366F1", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }}>
            <FontAwesome6 name="file-lines" size={10} color="#6B7280" />
            <Text className="text-xs text-gray-600">{getChapterCount(book)}章</Text>
          </View>
          <View className="px-3 py-1.5 rounded-full bg-white flex-row items-center gap-1.5"
            style={{ shadowColor: "#6366F1", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }}>
            <FontAwesome6 name="pen" size={10} color="#6B7280" />
            <Text className="text-xs text-gray-600">{formatWordCount(book.wordCount ?? 0)}字</Text>
          </View>
        </View>

        {/* 四段式 Tab 导航 */}
        <View className="flex-row bg-white rounded-2xl p-1 mb-5"
          style={{ shadowColor: "#6366F1", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}
        >
          {(["章节", "大纲", "设定", "灵感"] as const).map((tab) => {
            const icons: Record<string, string> = { 章节: "list", 大纲: "sitemap", 设定: "gear", 灵感: "lightbulb" };
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5 ${isActive ? "bg-primary-500" : ""}`}
              >
                <FontAwesome6 name={icons[tab]} size={11} color={isActive ? "white" : "#9CA3AF"} />
                <Text className={`text-xs font-medium ${isActive ? "text-white" : "text-gray-400"}`}>{tab}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ===== Tab 内容区域 ===== */}
        {activeTab === "章节" && (
          <View className="pb-8">
            {/* 排序切换 */}
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center gap-2">
                <View className="w-7 h-7 rounded-full bg-primary-500/10 items-center justify-center">
                  <FontAwesome6 name="list" size={12} color="#6366F1" />
                </View>
                <Text className="text-base font-bold text-gray-800">章节列表</Text>
                <Text className="text-xs text-gray-400">({allChapters.length})</Text>
              </View>
              <View className="flex-row gap-1.5">
                <TouchableOpacity
                  onPress={() => setChapterSort("asc")}
                  className={`px-3 py-1 rounded-full ${chapterSort === "asc" ? "bg-primary-500" : "bg-gray-100"}`}
                >
                  <Text className={`text-xs ${chapterSort === "asc" ? "text-white" : "text-gray-500"}`}>正序</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setChapterSort("desc")}
                  className={`px-3 py-1 rounded-full ${chapterSort === "desc" ? "bg-primary-500" : "bg-gray-100"}`}
                >
                  <Text className={`text-xs ${chapterSort === "desc" ? "text-white" : "text-gray-500"}`}>倒序</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setPlusMenuVolumeId("__section__"); }}
                  className="w-8 h-8 rounded-full bg-primary-500/10 items-center justify-center ml-1"
                >
                  <FontAwesome6 name="plus" size={14} color="#6366F1" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setVolumeCreateVisible(true); setVolumeName(""); }}
                  className="w-8 h-8 rounded-full bg-green-500/10 items-center justify-center ml-1"
                >
                  <Text className="text-xs text-green-500 font-medium">卷</Text>
                </TouchableOpacity>
              </View>
            </View>

            {book.volumes && book.volumes.length > 0 ? (
              <View className="gap-3">
                {book.volumes.map((volume, vi) => {
                  const isCollapsed = collapsedVolumes[volume.id] || false;
                  const volChapters = volume.chapters || [];
                  const sortedVolChapters = [...volChapters].sort((a, b) =>
                    chapterSort === "asc" ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id)
                  );
                  return (
                    <View key={volume.id} className="bg-white rounded-2xl overflow-hidden"
                      style={{ shadowColor: "#6366F1", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
                    >
                      {/* Volume Header */}
                      <TouchableOpacity
                        className="flex-row items-center justify-between px-4 py-3.5"
                        onPress={() => setCollapsedVolumes(prev => ({ ...prev, [volume.id]: !prev[volume.id] }))}
                        onLongPress={() => handleLongPressVolume(volume)}
                        delayLongPress={500}
                      >
                        <View className="flex-row items-center gap-2.5">
                          <View className="w-8 h-8 rounded-lg bg-primary-500/10 items-center justify-center">
                            <FontAwesome6 name="folder" size={14} color="#6366F1" />
                          </View>
                          <View>
                            <Text className="text-sm font-semibold text-gray-800">{volume.title}</Text>
                            <Text className="text-xs text-gray-400">{volChapters.length}章</Text>
                          </View>
                        </View>
                        <View className="flex-row items-center gap-2">
                          <TouchableOpacity
                            className="w-7 h-7 rounded-full bg-primary-500/10 items-center justify-center"
                            onPress={(e) => {
                              e.stopPropagation?.();
                              setPlusMenuVolumeId(volume.id);
                            }}
                          >
                            <FontAwesome6 name="plus" size={11} color="#6366F1" />
                          </TouchableOpacity>
                          <FontAwesome6 name={isCollapsed ? "chevron-down" : "chevron-up"} size={12} color="#9CA3AF" />
                        </View>
                      </TouchableOpacity>

                      {/* Chapters in this volume */}
                      {!isCollapsed && (
                        <View className="px-3 pb-3 gap-1.5">
                          {sortedVolChapters.length === 0 ? (
                            <View className="py-4 items-center">
                              <Text className="text-xs text-gray-400">该卷暂无章节</Text>
                            </View>
                          ) : (
                            sortedVolChapters.map((chapter, ci) => (
                              <View key={chapter.id} className="flex-row items-center px-3 py-2.5 rounded-xl bg-gray-50">
                                <TouchableOpacity
                                  className="flex-1 flex-row items-center"
                                  onPress={() => router.push("/editor", { bookId: id, chapterId: chapter.id })}
                                  onLongPress={() => handleLongPressChapter(chapter)}
                                  delayLongPress={400}
                                >
                                  <View className="w-7 h-7 rounded-lg bg-primary-500/10 items-center justify-center mr-2.5">
                                    <Text className="text-xs font-bold text-primary-500">
                                      {chapterSort === "asc" ? ci + 1 : sortedVolChapters.length - ci}
                                    </Text>
                                  </View>
                                  <View className="flex-1">
                                    <Text className="text-sm font-medium text-gray-700">{chapter.title}</Text>
                                    <Text className="text-xs text-gray-400 mt-0.5">{formatWordCount(chapter.wordCount)}字 · {chapter.createdAt}</Text>
                                  </View>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  className="w-7 h-7 rounded-lg items-center justify-center ml-1"
                                  onPress={() => handleLongPressChapter(chapter)}
                                >
                                  <FontAwesome6 name="ellipsis-vertical" size={12} color="#9CA3AF" />
                                </TouchableOpacity>
                              </View>
                            ))
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              <View className="bg-white rounded-3xl py-12 items-center"
                style={{ shadowColor: "#6366F1", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
              >
                <FontAwesome6 name="file-pen" size={36} color="#D1D5DB" />
                <Text className="text-sm text-gray-400 mt-3">还没有章节</Text>
                <Text className="text-xs text-gray-300 mt-1">点击右上角 + 新建第一章</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === "大纲" && renderOutlineTab()}
        {activeTab === "设定" && renderSettingTab()}
        {activeTab === "灵感" && renderInspirationTab()}
      </ScrollView>
      )}

      <Modal visible={modalVisible} transparent animationType="slide">
        <TouchableOpacity activeOpacity={1} onPress={() => { setModalVisible(false); setEditingChapter(null); }} className="flex-1 bg-black/30 justify-center">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <TouchableOpacity activeOpacity={1} onPress={() => undefined} className="mx-6 bg-white rounded-3xl p-6"
              style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10 }}
            >
              <Text className="text-lg font-bold text-gray-800 mb-4">{editingChapter ? "编辑章节" : "新建章节"}</Text>
              <TextInput
                className="bg-gray-50 rounded-2xl px-4 py-3.5 text-sm"
                placeholder="输入章节标题"
                value={editingChapter ? editChapterTitle : chapterTitle}
                onChangeText={editingChapter ? setEditChapterTitle : setChapterTitle}
                autoFocus
              />
              {/* Volume selector for new chapters */}
              {!editingChapter && (
                <View className="mt-3">
                  <Text className="text-xs text-gray-500 mb-2">选择所属卷</Text>
                  <View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View className="flex-row gap-2">
                        {book?.volumes?.map((vol: any) => (
                          <TouchableOpacity
                            key={vol.id}
                            onPress={() => setSelectedVolumeId(vol.id)}
                            className={`px-4 py-2 rounded-full ${selectedVolumeId === vol.id ? "bg-primary-500" : "bg-gray-100"}`}
                          >
                          <Text className={`text-xs font-medium ${selectedVolumeId === vol.id ? "text-white" : "text-gray-600"}`}>{vol.title}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                  </View>
                </View>
              )}
              <View className="flex-row gap-3 mt-5">
                <TouchableOpacity onPress={() => { setModalVisible(false); setEditingChapter(null); }} className="flex-1 py-3 rounded-2xl bg-gray-100 items-center">
                  <Text className="text-sm font-medium text-gray-600">取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (editingChapter) {
                      handleUpdateChapter(editingChapter.id, editChapterTitle);
                    } else {
                      handleCreateChapter();
                    }
                  }}
                  className="flex-1 py-3 rounded-2xl items-center"
                  style={{ backgroundColor: "#6366F1", opacity: (!editingChapter && !selectedVolumeId) ? 0.4 : 1 }}
                  disabled={!editingChapter && !selectedVolumeId}
                >
                  <Text className="text-sm font-bold text-white">{editingChapter ? "保存" : "创建并编辑"}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* 编辑卷名弹窗 */}
      <Modal visible={!!editingVolume} transparent animationType="fade">
        <TouchableOpacity activeOpacity={1} onPress={() => setEditingVolume(null)} className="flex-1 bg-black/30 justify-center">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <TouchableOpacity activeOpacity={1} onPress={() => undefined} className="mx-6 bg-white rounded-3xl p-6">
              <Text className="text-lg font-bold text-gray-800 mb-4">修改卷名</Text>
              <TextInput
                className="bg-gray-50 rounded-2xl px-4 py-3 text-sm mb-4"
                placeholder="请输入新卷名"
                value={editVolumeTitle}
                onChangeText={setEditVolumeTitle}
                autoFocus
              />
              <View className="flex-row gap-3">
                <TouchableOpacity onPress={() => setEditingVolume(null)} className="flex-1 py-3 rounded-2xl bg-gray-100 items-center">
                  <Text className="text-sm font-semibold text-gray-600">取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    if (!editVolumeTitle.trim() || !editingVolume) return;
                    try {
                      const res = await fetch(`${API_BASE}/api/v1/writing/${id}/volumes/${editingVolume.id}`, {
                        method: "PUT",
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ title: editVolumeTitle.trim() }),
                      });
                      const json = await res.json();
                      if (json.success) await fetchBook();
                    } catch (e) { Alert.alert("错误", "修改卷名失败"); }
                    setEditingVolume(null);
                    setEditVolumeTitle("");
                  }}
                  className="flex-1 py-3 rounded-2xl bg-primary-500 items-center"
                >
                  <Text className="text-sm font-bold text-white">保存</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* 新增设定弹窗 */}
      <Modal visible={settingModal} transparent animationType="slide">
        <TouchableOpacity activeOpacity={1} onPress={() => setSettingModal(false)} className="flex-1 bg-black/30 justify-center">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <TouchableOpacity activeOpacity={1} onPress={() => undefined} className="mx-6 bg-white rounded-3xl p-6">
              <Text className="text-lg font-bold text-gray-800 mb-4">新增设定</Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {allSettingTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setNewSetting({ ...newSetting, type })}
                    className={`px-3 py-1.5 rounded-full ${newSetting.type === type ? "bg-primary-500" : "bg-gray-100"}`}
                  >
                    <Text className={`text-xs ${newSetting.type === type ? "text-white" : "text-gray-600"}`}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput className="bg-gray-50 rounded-2xl px-4 py-3 text-sm mb-2" placeholder="名称" value={newSetting.name} onChangeText={(t) => setNewSetting({ ...newSetting, name: t })} />
              <TextInput className="bg-gray-50 rounded-2xl px-4 py-3 text-sm mb-4" placeholder="描述（可选）" value={newSetting.description} onChangeText={(t) => setNewSetting({ ...newSetting, description: t })} multiline />
              <View className="flex-row gap-3">
                <TouchableOpacity onPress={() => setSettingModal(false)} className="flex-1 py-3 rounded-2xl bg-gray-100 items-center"><Text className="text-sm font-medium text-gray-600">取消</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleAddSetting} className="flex-1 py-3 rounded-2xl items-center" style={{ backgroundColor: "#6366F1" }}><Text className="text-sm font-bold text-white">保存</Text></TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* 新增大纲/细纲弹窗 */}
      <Modal visible={outlineModal} transparent animationType="slide">
        <TouchableOpacity activeOpacity={1} onPress={() => setOutlineModal(false)} className="flex-1 bg-black/30 justify-center">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <TouchableOpacity activeOpacity={1} onPress={() => undefined} className="mx-6 bg-white rounded-3xl p-6">
              <Text className="text-lg font-bold text-gray-800 mb-4">新建{newOutline.type}</Text>
              <TextInput className="bg-gray-50 rounded-2xl px-4 py-3 text-sm mb-2" placeholder="标题" value={newOutline.title} onChangeText={(t) => setNewOutline({ ...newOutline, title: t })} />
              <TextInput className="bg-gray-50 rounded-2xl px-4 py-3 text-sm mb-4" placeholder="内容（可选）" value={newOutline.content} onChangeText={(t) => setNewOutline({ ...newOutline, content: t })} multiline />
              <View className="flex-row gap-3">
                <TouchableOpacity onPress={() => setOutlineModal(false)} className="flex-1 py-3 rounded-2xl bg-gray-100 items-center"><Text className="text-sm font-medium text-gray-600">取消</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleAddOutline} className="flex-1 py-3 rounded-2xl items-center" style={{ backgroundColor: "#6366F1" }}><Text className="text-sm font-bold text-white">保存</Text></TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* 记录灵感弹窗 */}
      <Modal visible={inspirationModal} transparent animationType="slide">
        <TouchableOpacity activeOpacity={1} onPress={() => setInspirationModal(false)} className="flex-1 bg-black/30 justify-center">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <TouchableOpacity activeOpacity={1} onPress={() => undefined} className="mx-6 bg-white rounded-3xl p-6">
              <Text className="text-lg font-bold text-gray-800 mb-4">记录灵感</Text>
              <TextInput className="bg-gray-50 rounded-2xl px-4 py-3 text-sm mb-4" placeholder="写下你的灵感..." value={newInspiration} onChangeText={setNewInspiration} multiline autoFocus />
              <View className="flex-row gap-3">
                <TouchableOpacity onPress={() => setInspirationModal(false)} className="flex-1 py-3 rounded-2xl bg-gray-100 items-center"><Text className="text-sm font-medium text-gray-600">取消</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleAddInspiration} className="flex-1 py-3 rounded-2xl items-center" style={{ backgroundColor: "#8B5CF6" }}><Text className="text-sm font-bold text-white">保存</Text></TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* 章节操作弹窗 */}
      <Modal transparent visible={!!chapterActionChapter} animationType="fade" onRequestClose={() => setChapterActionChapter(null)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setChapterActionChapter(null)} className="flex-1 bg-black/30 justify-center">
          <TouchableOpacity activeOpacity={1} onPress={() => undefined} className="mx-8 bg-white rounded-3xl overflow-hidden" style={{ elevation: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 24 }}>
            {chapterActionChapter && (
              <>
                <View className="px-6 pt-5 pb-3 border-b border-gray-100">
                  <Text className="text-base font-bold text-gray-800 text-center">{chapterActionChapter.title}</Text>
                </View>
                <TouchableOpacity onPress={() => {
                  setEditingChapter({ id: chapterActionChapter.id, title: chapterActionChapter.title });
                  setEditChapterTitle(chapterActionChapter.title);
                  setChapterActionChapter(null);
                  setTimeout(() => setModalVisible(true), 300);
                }} className="flex-row items-center px-6 py-4 active:bg-gray-50">
                  <FontAwesome6 name="pen-to-square" size={18} color="#6B7280" />
                  <Text className="ml-4 text-[16px] text-gray-700 font-medium">编辑标题</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  const c = chapterActionChapter;
                  setChapterActionChapter(null);
                  handleDeleteChapter(c.id, c.title);
                }} className="flex-row items-center px-6 py-4 border-t border-gray-100 active:bg-gray-50">
                  <FontAwesome6 name="trash-can" size={18} color="#EF4444" />
                  <Text className="ml-4 text-[16px] text-red-500 font-medium">删除章节</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setChapterActionChapter(null)} className="border-t border-gray-100 py-4 items-center active:bg-gray-50">
                  <Text className="text-[16px] text-gray-400 font-medium">取消</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal visible={!!deleteConfirmInfo} transparent animationType="fade" onRequestClose={() => setDeleteConfirmInfo(null)}>
        <TouchableOpacity style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as any} className="flex-1 bg-black/30 justify-center items-center" onPress={() => setDeleteConfirmInfo(null)} activeOpacity={1}>
          <View className="bg-white rounded-2xl w-[280px] p-6 items-center">
            <FontAwesome6 name="triangle-exclamation" size={36} color="#ef4444" />
            <Text className="text-[17px] font-bold text-gray-900 mt-3 mb-1">确认删除</Text>
            <Text className="text-[14px] text-gray-500 text-center mb-5">{deleteConfirmInfo ? `确定删除"${deleteConfirmInfo.title}"？此操作不可撤销。` : ""}</Text>
            <View className="flex-row gap-3 w-full">
              <TouchableOpacity onPress={() => setDeleteConfirmInfo(null)} className="flex-1 py-3 rounded-xl bg-gray-100 items-center active:bg-gray-200">
                <Text className="text-[15px] font-medium text-gray-600">取消</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { const info = deleteConfirmInfo; setDeleteConfirmInfo(null); handleConfirmDelete(); }} className="flex-1 py-3 rounded-xl bg-red-500 items-center active:bg-red-600">
                <Text className="text-[15px] font-medium text-white">删除</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 创建卷/章节选择弹窗 */}
      <Modal visible={plusMenuVolumeId !== null} transparent animationType="fade">
        <TouchableOpacity className="flex-1 bg-black/40 justify-center items-center" onPress={() => setPlusMenuVolumeId(null)} activeOpacity={1}>
          <View className="bg-white rounded-2xl w-[240px] p-4 gap-1" onStartShouldSetResponder={() => true}>
            <TouchableOpacity className="flex-row items-center gap-3 px-3 py-3.5 rounded-xl bg-gray-50 active:bg-gray-100" onPress={() => {
              const volId = plusMenuVolumeId;
              setPlusMenuVolumeId(null);
              if (volId && volId !== "__section__") setSelectedVolumeId(volId);
              setChapterTitle("");
              setModalVisible(true);
            }}>
              <FontAwesome6 name="file-pen" size={16} color="#4F46E5" />
              <Text className="text-base text-gray-800 font-medium">创建章节</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-row items-center gap-3 px-3 py-3.5 rounded-xl bg-gray-50 active:bg-gray-100" onPress={() => {
              setPlusMenuVolumeId(null);
              setVolumeName("");
              setVolumeCreateVisible(true);
            }}>
              <FontAwesome6 name="folder-open" size={16} color="#059669" />
              <Text className="text-base text-gray-800 font-medium">创建卷</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 创建卷弹窗 */}
      <Modal visible={volumeCreateVisible} transparent animationType="fade">
        <TouchableOpacity className="flex-1 bg-black/40 justify-center items-center" onPress={() => setVolumeCreateVisible(false)} activeOpacity={1}>
          <View className="bg-white rounded-2xl w-[300px] p-5 gap-4" onStartShouldSetResponder={() => true}>
            <Text className="text-lg font-bold text-gray-900">创建新卷</Text>
            <TextInput
              className="w-full px-4 py-3 bg-gray-50 rounded-xl text-base text-gray-900 border border-gray-200"
              placeholder="输入卷名称"
              placeholderTextColor="#999"
              value={volumeName}
              onChangeText={setVolumeName}
            />
            <View className="flex-row gap-3">
              <TouchableOpacity className="flex-1 px-4 py-3 bg-gray-100 rounded-xl items-center" onPress={() => setVolumeCreateVisible(false)}>
                <Text className="text-base text-gray-600 font-medium">取消</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 px-4 py-3 bg-primary-500 rounded-xl items-center" onPress={handleCreateVolume}>
                <Text className="text-base text-white font-medium">创建</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 编辑大纲弹窗 */}
      <Modal visible={!!editingOutline} transparent animationType="fade">
        <TouchableOpacity activeOpacity={1} onPress={() => setEditingOutline(null)} className="flex-1 bg-black/30 justify-center">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <TouchableOpacity activeOpacity={1} onPress={() => undefined} className="mx-6 bg-white rounded-3xl p-6">
              <Text className="text-lg font-bold text-gray-800 mb-4">编辑{editOutlineType}</Text>
              <View className="flex-row gap-2 mb-3">
                {(["大纲", "细纲"] as const).map((t) => (
                  <TouchableOpacity key={t} onPress={() => setEditOutlineType(t)}
                    className={`px-3 py-1.5 rounded-full ${editOutlineType === t ? "bg-primary-500" : "bg-gray-100"}`}>
                    <Text className={`text-xs ${editOutlineType === t ? "text-white" : "text-gray-600"}`}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput className="bg-gray-50 rounded-2xl px-4 py-3 text-sm mb-2" placeholder="标题" value={editOutlineTitle} onChangeText={setEditOutlineTitle} />
              <TextInput className="bg-gray-50 rounded-2xl px-4 py-3 text-sm mb-4" placeholder="内容（可选）" value={editOutlineContent} onChangeText={setEditOutlineContent} multiline />
              <View className="flex-row gap-3">
                <TouchableOpacity onPress={() => setEditingOutline(null)} className="flex-1 py-3 rounded-2xl bg-gray-100 items-center"><Text className="text-sm font-medium text-gray-600">取消</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleSaveEditOutline} className="flex-1 py-3 rounded-2xl items-center" style={{ backgroundColor: "#6366F1" }}><Text className="text-sm font-bold text-white">保存</Text></TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* 导入大纲弹窗 */}
      <Modal visible={importOutlineVisible} transparent animationType="slide">
        <TouchableOpacity activeOpacity={1} onPress={() => setImportOutlineVisible(false)} className="flex-1 bg-black/30 justify-center">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <TouchableOpacity activeOpacity={1} onPress={() => undefined} className="mx-6 bg-white rounded-3xl p-6">
              <Text className="text-lg font-bold text-gray-800 mb-4">批量导入大纲</Text>
              <Text className="text-xs text-gray-500 mb-3">每行一个大纲条目，将自动逐行创建</Text>
              <TextInput className="bg-gray-50 rounded-2xl px-4 py-3 text-sm mb-4 min-h-[120px]" placeholder={"第一章 初入异世\n第二章 神秘邂逅\n第三章 觉醒之力"} value={importOutlineText} onChangeText={setImportOutlineText} multiline />
              <View className="flex-row gap-3">
                <TouchableOpacity onPress={() => setImportOutlineVisible(false)} className="flex-1 py-3 rounded-2xl bg-gray-100 items-center"><Text className="text-sm font-medium text-gray-600">取消</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleImportOutline} className="flex-1 py-3 rounded-2xl items-center" style={{ backgroundColor: "#6366F1" }}><Text className="text-sm font-bold text-white">导入</Text></TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* 编辑设定弹窗 */}
      <Modal visible={editSettingVisible} transparent animationType="fade">
        <TouchableOpacity activeOpacity={1} onPress={() => { setEditSettingVisible(false); setEditingSettingItem(null); }} className="flex-1 bg-black/30 justify-center">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <TouchableOpacity activeOpacity={1} onPress={() => undefined} className="mx-6 bg-white rounded-3xl p-6">
              <Text className="text-lg font-bold text-gray-800 mb-4">编辑设定</Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {allSettingTypes.map((type) => (
                  <TouchableOpacity key={type} onPress={() => setEditSettingType(type)}
                    className={`px-3 py-1.5 rounded-full ${editSettingType === type ? "bg-primary-500" : "bg-gray-100"}`}>
                    <Text className={`text-xs ${editSettingType === type ? "text-white" : "text-gray-600"}`}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput className="bg-gray-50 rounded-2xl px-4 py-3 text-sm mb-2" placeholder="名称" value={editSettingName} onChangeText={setEditSettingName} />
              <TextInput className="bg-gray-50 rounded-2xl px-4 py-3 text-sm mb-4" placeholder="描述（可选）" value={editSettingDesc} onChangeText={setEditSettingDesc} multiline />
              <View className="flex-row gap-3">
                <TouchableOpacity onPress={() => { setEditSettingVisible(false); setEditingSettingItem(null); }} className="flex-1 py-3 rounded-2xl bg-gray-100 items-center"><Text className="text-sm font-medium text-gray-600">取消</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleSaveEditSetting} className="flex-1 py-3 rounded-2xl items-center" style={{ backgroundColor: "#6366F1" }}><Text className="text-sm font-bold text-white">保存</Text></TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* 编辑灵感弹窗 */}
      <Modal visible={editInspirationVisible} transparent animationType="fade">
        <TouchableOpacity activeOpacity={1} onPress={() => { setEditInspirationVisible(false); setEditingInspiration(null); }} className="flex-1 bg-black/30 justify-center">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <TouchableOpacity activeOpacity={1} onPress={() => undefined} className="mx-6 bg-white rounded-3xl p-6">
              <Text className="text-lg font-bold text-gray-800 mb-4">编辑灵感</Text>
              <TextInput className="bg-gray-50 rounded-2xl px-4 py-3 text-sm mb-4" placeholder="写下你的灵感..." value={editInspirationContent} onChangeText={setEditInspirationContent} multiline />
              <View className="flex-row gap-3">
                <TouchableOpacity onPress={() => { setEditInspirationVisible(false); setEditingInspiration(null); }} className="flex-1 py-3 rounded-2xl bg-gray-100 items-center"><Text className="text-sm font-medium text-gray-600">取消</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleSaveEditInspiration} className="flex-1 py-3 rounded-2xl items-center" style={{ backgroundColor: "#8B5CF6" }}><Text className="text-sm font-bold text-white">保存</Text></TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}