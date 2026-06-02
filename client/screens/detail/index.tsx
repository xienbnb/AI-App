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
} from "react-native";
import { Screen } from "@/components/Screen";
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
  chapters: Chapter[];
}

function formatWordCount(n: number) {
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
 玄幻: "dragon", 仙侠: "wand-sparkles", 言情: "heart", 都市: "building",
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
  const [book, setBook] = useState<Book | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [chapterTitle, setChapterTitle] = useState("");

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

  const fetchBook = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/${id}`);
      const json = await res.json();
      if (json.success) setBook(json.data);
    } catch (e) {
      console.error("获取书籍详情失败", e);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchBook();
    }, [fetchBook])
  );

  const handleCreateChapter = async () => {
    if (!chapterTitle.trim()) {
      Alert.alert("提示", "请输入章节标题");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/${id}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: chapterTitle.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setModalVisible(false);
        setChapterTitle("");
        await fetchBook();
        router.push("/editor", { bookId: id, chapterId: json.data.id });
      }
    } catch (e) {
      Alert.alert("错误", "创建章节失败");
    }
  };

  const handleDeleteChapter = (chapterId: string, chapterTitle: string) => {
    Alert.alert("删除确认", `确定删除"${chapterTitle}"？`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除", style: "destructive",
        onPress: async () => {
          try {
            const res = await fetch(`${API_BASE}/api/v1/writing/${id}/chapters/${chapterId}`, { method: "DELETE" });
            const json = await res.json();
            if (json.success) await fetchBook();
          } catch (e) { Alert.alert("错误", "删除章节失败"); }
        },
      },
    ]);
  };

  // 新增设定
  const handleAddSetting = () => {
    if (!newSetting.name.trim()) { Alert.alert("提示", "请输入名称"); return; }
    const item: WorldSetting = { id: Date.now().toString(), ...newSetting };
    setSettings([...settings, item]);
    setSettingModal(false);
    setNewSetting({ type: "角色", name: "", description: "" });
  };

  // 删除设定
  const handleDeleteSetting = (settingId: string) => {
    setSettings(settings.filter((s) => s.id !== settingId));
  };

  // 新增大纲
  const handleAddOutline = () => {
    if (!newOutline.title.trim()) { Alert.alert("提示", "请输入标题"); return; }
    const item: Outline = { id: Date.now().toString(), ...newOutline };
    setOutlines([...outlines, item]);
    setOutlineModal(false);
    setNewOutline({ type: "大纲", title: "", content: "" });
  };

  // 新增灵感
  const handleAddInspiration = () => {
    if (!newInspiration.trim()) { Alert.alert("提示", "请输入内容"); return; }
    const item: Inspiration = { id: Date.now().toString(), content: newInspiration, createdAt: new Date().toISOString().split("T")[0] };
    setInspirations([inspirations[0] || item, ...inspirations.filter((i) => i !== inspirations[0])]);
    setInspirationModal(false);
    setNewInspiration("");
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

  const sortedChapters = [...book.chapters].sort((a, b) =>
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
            <Text className="text-sm font-semibold text-gray-600 mb-2">{type}</Text>
            {items.length === 0 ? (
              <Text className="text-xs text-gray-400 ml-1">暂无{type}</Text>
            ) : (
              items.map((item) => (
                <View key={item.id} className="bg-white rounded-xl p-3 mb-2 flex-row items-center justify-between"
                  style={{ shadowColor: "#6366F1", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
                >
                  <View className="flex-1 mr-2">
                    <Text className="text-sm font-medium text-gray-800">{item.name}</Text>
                    {item.description ? <Text className="text-xs text-gray-500 mt-0.5">{item.description}</Text> : null}
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteSetting(item.id)}>
                    <FontAwesome6 name="trash-can" size={14} color="#EF4444" />
                  </TouchableOpacity>
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
        <FontAwesome6 name="plus-circle" size={14} color="#6366F1" />
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
      <View className="flex-row gap-2 mb-4">
        <TouchableOpacity
          onPress={() => setOutlineModal(true)}
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

      {["大纲", "细纲"].map((type) => {
        const items = outlines.filter((o) => o.type === type);
        return (
          <View key={type} className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">{type}</Text>
            {items.length === 0 ? (
              <Text className="text-xs text-gray-400 ml-1">暂无{type}</Text>
            ) : (
              items.map((item) => (
                <View key={item.id} className="bg-white rounded-2xl p-4 mb-2"
                  style={{ shadowColor: "#6366F1", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}
                >
                  <Text className="text-sm font-bold text-gray-800">{item.title}</Text>
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

      {inspirations.length === 0 ? (
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
            <Text className="text-sm text-gray-700 leading-relaxed">{item.content}</Text>
            <Text className="text-xs text-gray-400 mt-2">{item.createdAt}</Text>
          </View>
        ))
      )}
    </View>
  );

  return (
    <Screen>
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
            <Text className="text-xs text-gray-600">{book.chapters.length}章</Text>
          </View>
          <View className="px-3 py-1.5 rounded-full bg-white flex-row items-center gap-1.5"
            style={{ shadowColor: "#6366F1", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }}>
            <FontAwesome6 name="pen" size={10} color="#6B7280" />
            <Text className="text-xs text-gray-600">{formatWordCount(book.wordCount)}字</Text>
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
                <Text className="text-xs text-gray-400">({book.chapters.length})</Text>
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
                  onPress={() => setModalVisible(true)}
                  className="w-8 h-8 rounded-full bg-primary-500/10 items-center justify-center ml-1"
                >
                  <FontAwesome6 name="plus" size={14} color="#6366F1" />
                </TouchableOpacity>
              </View>
            </View>

            {sortedChapters.length === 0 ? (
              <View className="bg-white rounded-3xl py-12 items-center"
                style={{ shadowColor: "#6366F1", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
              >
                <FontAwesome6 name="file-pen" size={36} color="#D1D5DB" />
                <Text className="text-sm text-gray-400 mt-3">还没有章节</Text>
                <Text className="text-xs text-gray-300 mt-1">点击右上角 + 新建第一章</Text>
              </View>
            ) : (
              <View className="gap-2.5">
                {sortedChapters.map((chapter, i) => (
                  <TouchableOpacity
                    key={chapter.id}
                    onPress={() => router.push("/editor", { bookId: id, chapterId: chapter.id })}
                    onLongPress={() => handleDeleteChapter(chapter.id, chapter.title)}
                    className="bg-white rounded-2xl p-4 flex-row items-center"
                    style={{ shadowColor: "#6366F1", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
                  >
                    <View className="w-10 h-10 rounded-xl bg-primary-500/10 items-center justify-center mr-3">
                      <Text className="text-sm font-bold text-primary-500">
                        {chapterSort === "asc" ? i + 1 : sortedChapters.length - i}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-gray-800">{chapter.title}</Text>
                      <Text className="text-xs text-gray-400 mt-0.5">{formatWordCount(chapter.wordCount)}字 · {chapter.createdAt}</Text>
                    </View>
                    <FontAwesome6 name="chevron-right" size={12} color="#D1D5DB" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === "大纲" && renderOutlineTab()}
        {activeTab === "设定" && renderSettingTab()}
        {activeTab === "灵感" && renderInspirationTab()}
      </ScrollView>

      {/* 新建章节弹窗 */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <TouchableOpacity activeOpacity={1} onPress={() => setModalVisible(false)} className="flex-1 bg-black/30 justify-center">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}} className="mx-6 bg-white rounded-3xl p-6"
              style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10 }}
            >
              <Text className="text-lg font-bold text-gray-800 mb-4">新建章节</Text>
              <TextInput
                className="bg-gray-50 rounded-2xl px-4 py-3.5 text-sm"
                placeholder="输入章节标题"
                value={chapterTitle}
                onChangeText={setChapterTitle}
                autoFocus
              />
              <View className="flex-row gap-3 mt-5">
                <TouchableOpacity onPress={() => setModalVisible(false)} className="flex-1 py-3 rounded-2xl bg-gray-100 items-center">
                  <Text className="text-sm font-medium text-gray-600">取消</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCreateChapter} className="flex-1 py-3 rounded-2xl items-center" style={{ backgroundColor: "#6366F1" }}>
                  <Text className="text-sm font-bold text-white">创建并编辑</Text>
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
            <TouchableOpacity activeOpacity={1} onPress={() => {}} className="mx-6 bg-white rounded-3xl p-6">
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
            <TouchableOpacity activeOpacity={1} onPress={() => {}} className="mx-6 bg-white rounded-3xl p-6">
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
            <TouchableOpacity activeOpacity={1} onPress={() => {}} className="mx-6 bg-white rounded-3xl p-6">
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
    </Screen>
  );
}