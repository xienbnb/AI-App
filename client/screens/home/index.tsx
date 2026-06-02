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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome6 } from "@expo/vector-icons";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import RNSSE from "react-native-sse";

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

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

// ===== Genre/Audience/Platform/Length Options =====
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

// ===== ChipSelect Component =====
function ChipSelect({
  options,
  selected,
  onSelect,
  multi = false,
}: {
  options: { label: string; subtitle?: string; icon?: string; color: string }[];
  selected: string | string[];
  onSelect: (value: string) => void;
  multi?: boolean;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((opt) => {
        const isSelected = multi
          ? (selected as string[]).includes(opt.label)
          : selected === opt.label;
        return (
          <TouchableOpacity
            key={opt.label}
            onPress={() => onSelect(opt.label)}
            className={`px-4 py-2.5 rounded-xl border ${
              isSelected
                ? "bg-primary-500 border-primary-500"
                : opt.color
            }`}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center gap-1.5">
              {opt.icon && (
                <FontAwesome6
                  name={opt.icon as any}
                  size={13}
                  color={isSelected ? "#fff" : undefined}
                />
              )}
              <Text
                className={`text-sm font-medium ${
                  isSelected ? "text-white" : "text-gray-700"
                }`}
              >
                {opt.label}
              </Text>
              {opt.subtitle && !isSelected && (
                <Text className="text-xs text-gray-400 ml-0.5">{opt.subtitle}</Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ===== Main Component =====
export default function HomeScreen() {
  const router = useSafeRouter();

  // Creation workflow state
  const [step, setStep] = useState<CreationStep>("welcome");
  const [inspiration, setInspiration] = useState("");

  // Config selections
  const [genre, setGenre] = useState("");
  const [audience, setAudience] = useState("");
  const [platform, setPlatform] = useState("");
  const [length, setLength] = useState("");

  // Guiding conversation
  const [guidingStep, setGuidingStep] = useState(0);
  const [guidingMessages, setGuidingMessages] = useState<
    { role: "ai" | "user"; text: string }[]
  >([]);

  // Outline
  const [outlineVolumes, setOutlineVolumes] = useState<{ id: string; title: string; summary: string; chapters: { title: string; summary: string }[] }[]>([]);
  const [outlineAnalysis, setOutlineAnalysis] = useState("");
  const [outlineFullText, setOutlineFullText] = useState("");
  const [editingChapter, setEditingChapter] = useState<{ volIdx: number; chIdx: number } | null>(null);
  const [editingChapterText, setEditingChapterText] = useState("");
  const [expandedVolumes, setExpandedVolumes] = useState<Set<number>>(new Set([0]));

  // Details
  const [bookTitle, setBookTitle] = useState("");
  const [bookDescription, setBookDescription] = useState("");
  const [coverPrompt, setCoverPrompt] = useState("");
  const [showManualTitle, setShowManualTitle] = useState(false);
  const [showManualDesc, setShowManualDesc] = useState(false);

  // Created book
  const [createdBookId, setCreatedBookId] = useState("");

  // Loading
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const sseRef = useRef<any>(null);

  // Streaming content for outline/details
  const [streamContent, setStreamContent] = useState("");
  const [streamContentType, setStreamContentType] = useState<"outline" | "details">("outline");

  const cleanupSSE = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
  }, []);

  // ===== Step 1: Input Inspiration =====
  const handleStartCreation = () => {
    if (!inspiration.trim()) {
      Alert.alert("提示", "请先输入你的创作灵感");
      return;
    }
    setStep("guiding");
    setGuidingStep(0);
    setGuidingMessages([{ role: "ai", text: `太好了！"${inspiration}"这个想法很有潜力！让我先了解一些基本信息，帮你把作品打磨得更适合目标读者~` }]);
  };

  const fillInspiration = (text: string) => {
    setInspiration(text);
  };

  // ===== Step 2: Guiding - select genre/audience/platform/length =====
  const handleSelectGenre = (value: string) => {
    setGenre(value);
    setGuidingMessages((prev) => [
      ...prev,
      { role: "user", text: value },
      { role: "ai", text: `${value}题材，不错的选择！接下来，你的作品主要面向哪个读者群体？` },
    ]);
    setGuidingStep(1);
  };

  const handleSelectAudience = (value: string) => {
    setAudience(value);
    const audienceText = value === "男频" ? "男生" : value === "女频" ? "女生" : "所有读者";
    setGuidingMessages((prev) => [
      ...prev,
      { role: "user", text: value },
      { role: "ai", text: `面向${audienceText}读者，明白了！你觉得这部作品更适合发布在哪个平台？` },
    ]);
    setGuidingStep(2);
  };

  const handleSelectPlatform = (value: string) => {
    setPlatform(value);
    setGuidingMessages((prev) => [
      ...prev,
      { role: "user", text: value },
      { role: "ai", text: `${value}是个好平台！最后，你打算写多长的篇幅？` },
    ]);
    setGuidingStep(3);
  };

  const handleSelectLength = (value: string) => {
    setLength(value);
    setGuidingMessages((prev) => [
      ...prev,
      { role: "user", text: value },
      { role: "ai", text: `太棒了！基本信息都收集齐了，我来帮你生成一份完整的大纲吧！` },
    ]);
    // Move to config summary automatically
    setTimeout(() => {
      setStep("config_summary");
    }, 800);
  };

  const handleRegenerateGuide = () => {
    setStep("guiding");
    setGuidingStep(0);
    setGenre("");
    setAudience("");
    setPlatform("");
    setLength("");
    setGuidingMessages([{ role: "ai", text: `好的，让我们重新开始！首先，你想写什么类型的小说？` }]);
  };

  // ===== Step 3: Generate Outline =====
  const handleGenerateOutline = () => {
    setStep("generating_outline");
    setLoading(true);
    setLoadingText("AI正在构思大纲...");
    setStreamContent("");

    const url = `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/writing/generate-outline`;
    const sse = new RNSSE(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inspiration, genre, audience, platform, length }),
    });
    sseRef.current = sse;

    sse.addEventListener("message", (event: any) => {
      if (event.data === "[DONE]") {
        cleanupSSE();
        setLoading(false);
        return;
      }
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "outline") {
          setStreamContent((prev) => prev + parsed.content);
        } else if (parsed.type === "outline_complete") {
          const vols = (parsed.volumes || []).map((v: any, vi: number) => ({
            id: `vol-${Date.now()}-${vi}`,
            title: v.title || `第${vi + 1}卷`,
            summary: v.summary || "",
            chapters: (v.chapters || []).map((c: any) => ({
              title: c.title || "",
              summary: c.summary || "",
            })),
          }));
          setOutlineVolumes(vols.length > 0 ? vols : []);
          setOutlineAnalysis(parsed.analysis || "");
          setOutlineFullText(parsed.fullOutline || streamContent);
          setExpandedVolumes(new Set(vols.length > 0 ? vols.map((_: any, i: number) => i) : [0]));
          setStep("reviewing_outline");
          setLoading(false);
        }
      } catch {
        // ignore
      }
    });

    sse.addEventListener("error", () => {
      cleanupSSE();
      setLoading(false);
      Alert.alert("错误", "大纲生成失败，请重试");
    });
  };

  // ===== Step 4: Edit Outline =====
  const handleEditChapter = (volIdx: number, chIdx: number) => {
    setEditingChapter({ volIdx, chIdx });
    const ch = outlineVolumes[volIdx]?.chapters[chIdx];
    if (ch) {
      setEditingChapterText(`${ch.title} - ${ch.summary}`);
    }
  };

  const handleSaveChapterEdit = () => {
    if (!editingChapter) return;
    const { volIdx, chIdx } = editingChapter;
    const parts = editingChapterText.split("-").map((s) => s.trim());
    const updated = [...outlineVolumes];
    const ch = { ...updated[volIdx].chapters[chIdx] };
    ch.title = parts[0] || ch.title;
    ch.summary = parts[1] || ch.summary;
    updated[volIdx] = { ...updated[volIdx], chapters: [...updated[volIdx].chapters] };
    updated[volIdx].chapters[chIdx] = ch;
    setOutlineVolumes(updated);
    setEditingChapter(null);
    setEditingChapterText("");
  };

  const toggleVolume = (vi: number) => {
    setExpandedVolumes((prev) => {
      const next = new Set(prev);
      if (next.has(vi)) next.delete(vi);
      else next.add(vi);
      return next;
    });
  };

  const handleConfirmOutline = () => {
    setStep("generating_details");
    setLoading(true);
    setLoadingText("AI正在生成书名和简介...");
    setStreamContent("");

    // Generate details
    const url = `${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/writing/generate-details`;
    const sse = new RNSSE(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outline: outlineFullText,
        volumes: outlineVolumes,
        genre,
        inspiration,
      }),
    });
    sseRef.current = sse;

    sse.addEventListener("message", (event: any) => {
      if (event.data === "[DONE]") {
        cleanupSSE();
        setLoading(false);
        return;
      }
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "details") {
          setStreamContent((prev) => prev + parsed.content);
        } else if (parsed.type === "details_complete") {
          setBookTitle(parsed.title || "");
          setBookDescription(parsed.description || "");
          setCoverPrompt(parsed.coverPrompt || "");
          setStep("reviewing_details");
          setLoading(false);
        }
      } catch {
        // ignore
      }
    });

    sse.addEventListener("error", () => {
      cleanupSSE();
      setLoading(false);
      Alert.alert("错误", "详情生成失败，请重试");
    });
  };

  const handleRegenerateDetails = () => {
    handleConfirmOutline();
  };

  // ===== Step 5: Create Book =====
  const handleCreateBook = async () => {
    if (!bookTitle.trim()) {
      Alert.alert("提示", "请输入书名");
      return;
    }
    setStep("creating");
    setLoading(true);
    setLoadingText("正在创建作品...");

    try {
      const volumes = outlineVolumes.map((v) => ({
        id: `${Date.now().toString(36)}_v${outlineVolumes.indexOf(v)}`,
        title: v.title,
        order: outlineVolumes.indexOf(v) + 1,
        chapters: v.chapters.map((ch) => ({
          id: `${Date.now().toString(36)}_${outlineVolumes.indexOf(v)}_${v.chapters.indexOf(ch)}`,
          title: ch.title,
          content: ch.summary || "",
          wordCount: 0,
        })),
      }));

      const coverImage = `/api/v1/static/images/covers/${
        ["man", "women"][Math.floor(Math.random() * 2)]
      }/${Math.floor(Math.random() * 16) + 1}.jpg`;

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/writing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: bookTitle.trim(),
          description: bookDescription.trim(),
          category: genre || "其他",
          cover: "from-purple-500 to-blue-500",
          coverImage,
          volumes,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setCreatedBookId(result.data.id);
        setStep("completed");
      } else {
        Alert.alert("错误", result.message || "创建失败");
        setStep("reviewing_details");
      }
    } catch (err) {
      Alert.alert("错误", "创建失败，请重试");
      setStep("reviewing_details");
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setStep("welcome");
    setInspiration("");
    setGenre("");
    setAudience("");
    setPlatform("");
    setLength("");
    setGuidingStep(0);
    setGuidingMessages([]);
    setOutlineVolumes([]);
    setOutlineAnalysis("");
    setOutlineFullText("");
    setBookTitle("");
    setBookDescription("");
    setCoverPrompt("");
    setShowManualTitle(false);
    setShowManualDesc(false);
    setCreatedBookId("");
    setStreamContent("");
    setLoading(false);
    cleanupSSE();
  };

  // ===== Render: Loading Modal =====
  const renderLoading = () => (
    <View className="flex-1 items-center justify-center bg-white/80">
      <View className="bg-white rounded-2xl px-8 py-10 items-center shadow-lg" style={{ elevation: 8 }}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text className="mt-5 text-base text-gray-600">{loadingText}</Text>
        {streamContent ? (
          <Text className="mt-3 text-xs text-gray-400 text-center max-w-xs" numberOfLines={3}>
            {streamContent.substring(0, 100)}...
          </Text>
        ) : null}
      </View>
    </View>
  );

  // ===== Render: Welcome =====
  const renderWelcome = () => (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View className="px-5 pt-8 pb-6">
        {/* Brand */}
        <View className="items-center mb-8">
          <View className="w-16 h-16 bg-primary-500 rounded-2xl items-center justify-center mb-4">
            <FontAwesome6 name="pen-nib" size={28} color="#fff" />
          </View>
          <Text className="text-2xl font-bold text-gray-900">AI 创作助手</Text>
          <Text className="text-sm text-gray-500 mt-1">用灵感创作你的世界</Text>
        </View>

        {/* Inspiration Input */}
        <View className="bg-gray-50 rounded-2xl px-5 py-4 mb-4">
          <TextInput
            className="text-base text-gray-900 min-h-[60px]"
            placeholder="输入你的小说灵感..."
            placeholderTextColor="#9CA3AF"
            value={inspiration}
            onChangeText={setInspiration}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Inspiration chips */}
        <View className="flex-row flex-wrap gap-2 mb-6">
          {INSPIRATION_CHIPS.map((chip, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => fillInspiration(chip.text)}
              className="bg-primary-50 rounded-full px-3.5 py-2 border border-primary-100"
              activeOpacity={0.7}
            >
              <Text className="text-xs text-primary-600">{chip.text}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Start button */}
        <TouchableOpacity
          onPress={handleStartCreation}
          className="bg-primary-500 rounded-2xl py-3.5 items-center flex-row justify-center gap-2"
          activeOpacity={0.8}
        >
          <FontAwesome6 name="wand-magic-sparkles" size={16} color="#fff" />
          <Text className="text-white text-base font-semibold">开始创作</Text>
        </TouchableOpacity>

        {/* Quick tips */}
        <View className="mt-6 bg-amber-50 rounded-2xl px-4 py-3.5 border border-amber-100">
          <View className="flex-row items-center gap-2 mb-2">
            <FontAwesome6 name="lightbulb" size={14} color="#D97706" />
            <Text className="text-sm font-medium text-amber-800">创作小贴士</Text>
          </View>
          <Text className="text-xs text-amber-700 leading-5">
            灵感越具体，AI生成的大纲和内容就越精准。试试带上主角设定、世界观或核心冲突，效果会更好哦~
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  // ===== Render: AI Guiding =====
  const renderGuiding = () => (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className="px-5 pt-4 pb-6">
        {/* Header */}
        <View className="flex-row items-center gap-3 mb-5">
          <TouchableOpacity onPress={() => { setStep("welcome"); cleanupSSE(); }} activeOpacity={0.7}>
            <FontAwesome6 name="arrow-left" size={18} color="#6366F1" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900">创作引导</Text>
            <Text className="text-xs text-gray-500">一步步完善你的作品设定</Text>
          </View>
          <View className="bg-primary-50 rounded-full px-3 py-1">
            <Text className="text-xs text-primary-600 font-medium">
              {guidingStep + 1}/4
            </Text>
          </View>
        </View>

        {/* Guiding messages */}
        <View className="gap-3 mb-5">
          {guidingMessages.map((msg, i) => (
            <View
              key={i}
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === "ai"
                  ? "bg-gray-100 self-start rounded-bl-md"
                  : "bg-primary-500 self-end rounded-br-md"
              }`}
            >
              <Text
                className={`text-sm leading-6 ${
                  msg.role === "ai" ? "text-gray-800" : "text-white"
                }`}
              >
                {msg.text}
              </Text>
            </View>
          ))}
        </View>

        {/* Options - show based on step */}
        {guidingStep === 0 && (
          <View className="bg-white rounded-2xl p-4 border border-gray-100">
            <Text className="text-sm font-medium text-gray-700 mb-3">选择小说类型</Text>
            <ChipSelect options={GENRE_OPTIONS} selected={genre} onSelect={handleSelectGenre} />
          </View>
        )}

        {guidingStep === 1 && (
          <View className="bg-white rounded-2xl p-4 border border-gray-100">
            <Text className="text-sm font-medium text-gray-700 mb-3">选择受众定位</Text>
            <ChipSelect options={AUDIENCE_OPTIONS} selected={audience} onSelect={handleSelectAudience} />
          </View>
        )}

        {guidingStep === 2 && (
          <View className="bg-white rounded-2xl p-4 border border-gray-100">
            <Text className="text-sm font-medium text-gray-700 mb-3">选择目标平台</Text>
            <ChipSelect options={PLATFORM_OPTIONS} selected={platform} onSelect={handleSelectPlatform} />
          </View>
        )}

        {guidingStep === 3 && (
          <View className="bg-white rounded-2xl p-4 border border-gray-100">
            <Text className="text-sm font-medium text-gray-700 mb-3">选择篇幅</Text>
            <ChipSelect options={LENGTH_OPTIONS} selected={length} onSelect={handleSelectLength} />
          </View>
        )}
      </View>
    </ScrollView>
  );

  // ===== Render: Config Summary =====
  const renderConfigSummary = () => (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className="px-5 pt-4 pb-8">
        {/* Header */}
        <View className="flex-row items-center gap-3 mb-5">
          <TouchableOpacity onPress={handleRegenerateGuide} activeOpacity={0.7}>
            <FontAwesome6 name="arrow-left" size={18} color="#6366F1" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900">确认设定</Text>
            <Text className="text-xs text-gray-500">检查以下信息是否正确</Text>
          </View>
        </View>

        {/* Summary cards */}
        <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-5">
          <Text className="text-sm font-medium text-gray-700 mb-2">你的灵感</Text>
          <Text className="text-base text-gray-900 leading-6">{inspiration}</Text>
        </View>

        <View className="flex-row flex-wrap gap-3 mb-6">
          {[
            { label: "类型", value: genre },
            { label: "受众", value: audience },
            { label: "平台", value: platform },
            { label: "篇幅", value: length },
          ].map((item, i) => (
            <View key={i} className="bg-primary-50 rounded-xl px-4 py-2.5">
              <Text className="text-xs text-primary-500 mb-0.5">{item.label}</Text>
              <Text className="text-sm font-medium text-primary-700">{item.value}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleGenerateOutline}
          className="bg-primary-500 rounded-2xl py-3.5 items-center flex-row justify-center gap-2"
          activeOpacity={0.8}
        >
          <FontAwesome6 name="robot" size={16} color="#fff" />
          <Text className="text-white text-base font-semibold">AI 生成大纲</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleRegenerateGuide}
          className="mt-3 py-3 items-center"
          activeOpacity={0.7}
        >
          <Text className="text-sm text-primary-500">重新选择</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  // ===== Render: Review Outline =====
  const renderReviewOutline = () => (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className="px-5 pt-4 pb-8">
        <View className="flex-row items-center gap-3 mb-5">
          <TouchableOpacity onPress={() => { setStep("config_summary"); cleanupSSE(); }} activeOpacity={0.7}>
            <FontAwesome6 name="arrow-left" size={18} color="#6366F1" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900">大纲预览</Text>
            <Text className="text-xs text-gray-500">你可以修改或确认章节</Text>
          </View>
        </View>

        {/* Analysis */}
        {outlineAnalysis ? (
          <View className="bg-amber-50 rounded-2xl p-4 border border-amber-100 mb-5">
            <View className="flex-row items-center gap-2 mb-1">
              <FontAwesome6 name="lightbulb" size={14} color="#D97706" />
              <Text className="text-sm font-medium text-amber-800">AI分析</Text>
            </View>
            <Text className="text-sm text-amber-700 leading-6">{outlineAnalysis}</Text>
          </View>
        ) : null}

        {/* Volumes & Chapters */}
        <View className="gap-3 mb-6">
          {outlineVolumes.map((vol, vi) => (
            <View key={vi} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <TouchableOpacity
                onPress={() => toggleVolume(vi)}
                className="flex-row items-center justify-between px-4 py-3 bg-gray-50"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-2 flex-1">
                  <FontAwesome6 name="book" size={14} color="#6366F1" />
                  <Text className="text-sm font-bold text-gray-900">{vol.title}</Text>
                  {vol.summary ? (
                    <Text className="text-xs text-gray-400 ml-1 flex-1" numberOfLines={1}>{vol.summary}</Text>
                  ) : null}
                </View>
                <FontAwesome6
                  name={expandedVolumes.has(vi) ? "chevron-up" : "chevron-down"}
                  size={12} color="#9CA3AF"
                />
              </TouchableOpacity>

              {expandedVolumes.has(vi) && (
                <View className="px-4 py-2 gap-1.5">
                  {vol.chapters.map((ch, ci) => (
                    <View key={ci} className="flex-row items-center py-2 border-b border-gray-50 last:border-0">
                      <View className="w-6 h-6 bg-primary-50 rounded-full items-center justify-center mr-3">
                        <Text className="text-[11px] font-bold text-primary-600">{vi * 99 + ci + 1}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-medium text-gray-900">{ch.title}</Text>
                        {ch.summary ? (
                          <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={2}>{ch.summary}</Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        onPress={() => handleEditChapter(vi, ci)}
                        className="w-8 h-8 items-center justify-center"
                        activeOpacity={0.7}
                      >
                        <FontAwesome6 name="pen" size={13} color="#9CA3AF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleConfirmOutline}
          className="bg-primary-500 rounded-2xl py-3.5 items-center flex-row justify-center gap-2"
          activeOpacity={0.8}
        >
          <FontAwesome6 name="check" size={16} color="#fff" />
          <Text className="text-white text-base font-semibold">确认大纲，生成书名</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleGenerateOutline}
          className="mt-3 py-3 items-center flex-row justify-center gap-2"
          activeOpacity={0.7}
        >
          <FontAwesome6 name="rotate" size={13} color="#6366F1" />
          <Text className="text-sm text-primary-500">重新生成</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  // ===== Render: Review Details =====
  const renderReviewDetails = () => (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className="px-5 pt-4 pb-8">
        <View className="flex-row items-center gap-3 mb-5">
          <TouchableOpacity onPress={() => { setStep("generating_outline"); setLoading(true); handleGenerateOutline(); }} activeOpacity={0.7}>
            <FontAwesome6 name="arrow-left" size={18} color="#6366F1" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900">完善作品信息</Text>
            <Text className="text-xs text-gray-500">确认或修改书名和简介</Text>
          </View>
        </View>

        {/* Book Title */}
        <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-medium text-gray-700">书名</Text>
            <TouchableOpacity onPress={() => setShowManualTitle(!showManualTitle)} activeOpacity={0.7}>
              <Text className="text-xs text-primary-500">
                {showManualTitle ? "使用AI推荐" : "手动输入"}
              </Text>
            </TouchableOpacity>
          </View>
          {showManualTitle ? (
            <TextInput
              className="text-base text-gray-900 border border-gray-200 rounded-xl px-4 py-3"
              placeholder="输入书名"
              placeholderTextColor="#9CA3AF"
              value={bookTitle}
              onChangeText={setBookTitle}
            />
          ) : (
            <TouchableOpacity
              onPress={() => setBookTitle("")}
              className="bg-gray-50 rounded-xl px-4 py-3.5"
              activeOpacity={0.7}
            >
              <Text className={`text-base ${bookTitle ? "text-gray-900" : "text-gray-400"}`}>
                {bookTitle || "点击使用AI推荐的书名（将重新生成）"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Description */}
        <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-medium text-gray-700">简介</Text>
            <TouchableOpacity onPress={() => setShowManualDesc(!showManualDesc)} activeOpacity={0.7}>
              <Text className="text-xs text-primary-500">
                {showManualDesc ? "使用AI推荐" : "手动输入"}
              </Text>
            </TouchableOpacity>
          </View>
          {showManualDesc ? (
            <TextInput
              className="text-sm text-gray-900 border border-gray-200 rounded-xl px-4 py-3 min-h-[100px]"
              placeholder="输入作品简介..."
              placeholderTextColor="#9CA3AF"
              value={bookDescription}
              onChangeText={setBookDescription}
              multiline
              textAlignVertical="top"
            />
          ) : (
            <TouchableOpacity
              onPress={() => setBookDescription("")}
              className="bg-gray-50 rounded-xl px-4 py-3.5"
              activeOpacity={0.7}
            >
              <Text className={`text-sm leading-6 ${bookDescription ? "text-gray-900" : "text-gray-400"}`} numberOfLines={5}>
                {bookDescription || "点击使用AI推荐的简介（将重新生成）"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Cover Info */}
        {coverPrompt ? (
          <View className="bg-white rounded-2xl p-5 border border-gray-100 mb-6">
            <Text className="text-sm font-medium text-gray-700 mb-2">封面描述</Text>
            <Text className="text-xs text-gray-500 leading-5">{coverPrompt}</Text>
            <Text className="text-xs text-gray-400 mt-2">（可在AI工坊生成封面图片）</Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={handleCreateBook}
          className="bg-primary-500 rounded-2xl py-3.5 items-center flex-row justify-center gap-2"
          activeOpacity={0.8}
        >
          <FontAwesome6 name="check" size={16} color="#fff" />
          <Text className="text-white text-base font-semibold">确认创建作品</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleRegenerateDetails}
          className="mt-3 py-3 items-center flex-row justify-center gap-2"
          activeOpacity={0.7}
        >
          <FontAwesome6 name="rotate" size={13} color="#6366F1" />
          <Text className="text-sm text-primary-500">重新生成</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  // ===== Render: Completed =====
  const renderCompleted = () => (
    <View className="flex-1 items-center justify-center px-5">
      <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-5">
        <FontAwesome6 name="check" size={36} color="#059669" />
      </View>
      <Text className="text-xl font-bold text-gray-900 mb-2">作品创建成功!</Text>
      <Text className="text-base text-gray-600 mb-1">{bookTitle}</Text>
      <Text className="text-sm text-gray-400 mb-8">{genre} · {length} · {outlineVolumes.reduce((sum, v) => sum + v.chapters.length, 0)}章</Text>

      <View className="flex-row gap-3">
        <TouchableOpacity
          onPress={() => router.push("/works")}
          className="bg-white rounded-2xl py-3 px-6 border border-gray-200"
          activeOpacity={0.7}
        >
          <Text className="text-gray-700 font-medium">去作品页</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={resetAll}
          className="bg-primary-500 rounded-2xl py-3 px-6"
          activeOpacity={0.8}
        >
          <Text className="text-white font-medium">继续创作</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ===== Edit Chapter Modal =====
  const renderEditModal = () => (
    <Modal visible={editingChapter !== null} transparent animationType="fade">
      <View className="flex-1 bg-black/40 justify-center px-5">
        <View className="bg-white rounded-2xl p-5">
          <Text className="text-lg font-bold text-gray-900 mb-4">编辑章节</Text>
          <Text className="text-xs text-gray-500 mb-2">格式：标题 - 概要</Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 mb-4"
            value={editingChapterText}
            onChangeText={setEditingChapterText}
            placeholder="第X章：标题 - 内容概要"
            placeholderTextColor="#9CA3AF"
          />
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => { setEditingChapter(null); setEditingChapterText(""); }}
              className="flex-1 bg-gray-100 rounded-xl py-3 items-center"
              activeOpacity={0.7}
            >
              <Text className="text-gray-700 font-medium">取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSaveChapterEdit}
              className="flex-1 bg-primary-500 rounded-xl py-3 items-center"
              activeOpacity={0.8}
            >
              <Text className="text-white font-medium">保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ===== Main Render =====
  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Loading overlay */}
      {(step === "generating_outline" || step === "generating_details" || step === "creating") && loading ? (
        renderLoading()
      ) : (
        <>
          {step === "welcome" && renderWelcome()}
          {step === "guiding" && renderGuiding()}
          {step === "config_summary" && renderConfigSummary()}
          {step === "reviewing_outline" && renderReviewOutline()}
          {step === "reviewing_details" && renderReviewDetails()}
          {step === "completed" && renderCompleted()}
        </>
      )}
      {renderEditModal()}
    </SafeAreaView>
  );
}