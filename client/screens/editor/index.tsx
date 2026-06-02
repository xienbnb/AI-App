import { useState, useEffect, useRef } from "react";
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
} from "react-native";
import { useSafeRouter, useSafeSearchParams } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";
import RNSSE from "react-native-sse";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

export default function EditorScreen() {
  const router = useSafeRouter();
  const { bookId, chapterId } = useSafeSearchParams<{ bookId: string; chapterId: string }>();
  const [content, setContent] = useState("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiMode, setAiMode] = useState<"generate" | "expand" | "polish" | "names">("generate");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [nameType, setNameType] = useState<"person" | "item" | "ability" | "place">("person");
  const sseRef = useRef<RNSSE | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!bookId || !chapterId) return;
      try {
        const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/chapters/${chapterId}`);
        const json = await res.json();
        if (json.success) {
          setContent(json.data.content || "");
          setChapterTitle(json.data.title || "");
        }
      } catch (e) {
        console.error("获取章节失败", e);
      }
      try {
        const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}`);
        const json = await res.json();
        if (json.success) setBookTitle(json.data.title);
      } catch (e) {}
    };
    load();
  }, [bookId, chapterId]);

  useEffect(() => {
    return () => {
      if (sseRef.current) sseRef.current.close();
    };
  }, []);

  const wordCount = content.replace(/\s/g, "").length;

  const handleSave = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/chapters/${chapterId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: chapterTitle, content }),
      });
      const json = await res.json();
      if (json.success) Alert.alert("保存成功", "章节内容已保存");
    } catch (e) {
      Alert.alert("错误", "保存失败");
    }
  };

  // 一键排版：规范化标点、空格等
  const handleFormat = () => {
    let text = content;
    // 统一换行
    text = text.replace(/\r\n/g, "\n");
    // 删除多余空行
    text = text.replace(/\n{4,}/g, "\n\n\n");
    // 中文后英文前加空格
    text = text.replace(/([\u4e00-\u9fa5])([a-z])/gi, "$1 $2");
    text = text.replace(/([a-z])([\u4e00-\u9fa5])/gi, "$1 $2");
    setContent(text);
    Alert.alert("排版完成", "已规范化文章格式");
  };

  // 双引号规范化
  const handleQuotes = () => {
    let text = content;
    // 替换英文引号为中文引号
    text = text.replace(/"([^"]*)"/g, "\u201c$1\u201d");
    text = text.replace(/'([^']*)'/g, "\u2018$1\u2019");
    setContent(text);
    Alert.alert("引号替换", "已替换为中文引号");
  };

  // 起名生成
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
      if (event.data === "[DONE]") {
        sse.close();
        setIsGenerating(false);
        return;
      }
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.fullContent) {
          setGeneratedContent((prev) => prev + parsed.fullContent);
          setIsGenerating(false);
        } else if (parsed.content) {
          setGeneratedContent((prev) => prev + parsed.content);
        }
      } catch {}
    });
    sse.addEventListener("error", () => {
      setIsGenerating(false);
      Alert.alert("错误", "生成失败");
    });
  };

  const handleAIWrite = () => {
    if (!aiPrompt.trim()) {
      Alert.alert("提示", "请输入写作指令");
      return;
    }
    setIsGenerating(true);
    setGeneratedContent("");
    setAiModalVisible(false);

    const context = content.slice(-2000);
    const sse = new RNSSE(`${API_BASE}/api/v1/writing/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: aiPrompt.trim(),
        style: "default",
        wordCount: 1000,
        context,
      }),
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
        if (parsed.done && parsed.fullContent) {
          setContent((prev) => prev + "\n\n" + parsed.fullContent);
          setIsGenerating(false);
        } else if (parsed.content) {
          setGeneratedContent((prev) => prev + parsed.content);
        }
      } catch {}
    });
    sse.addEventListener("error", () => {
      setIsGenerating(false);
      Alert.alert("错误", "AI生成失败");
    });
  };

  const handleStopGeneration = () => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    setIsGenerating(false);
    if (generatedContent) {
      setContent((prev) => prev + "\n" + generatedContent);
      setGeneratedContent("");
    }
  };

  const applyGeneratedContent = () => {
    if (generatedContent) {
      setContent((prev) => prev + "\n\n" + generatedContent);
      setGeneratedContent("");
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View className="flex-1">
          {/* 顶部导航 */}
          <View className="flex-row items-center justify-between px-3 py-3 border-b border-gray-100">
            <TouchableOpacity onPress={() => router.back()} className="flex-row items-center gap-2">
              <FontAwesome6 name="chevron-left" size={16} color="#6366F1" />
              <Text className="text-sm text-gray-800 font-medium" numberOfLines={1}>
                {bookTitle}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              className="px-5 py-2 rounded-xl flex-row items-center gap-1.5"
              style={{ backgroundColor: "#6366F1" }}
            >
              <FontAwesome6 name="check" size={12} color="#fff" />
              <Text className="text-white text-xs font-semibold">保存</Text>
            </TouchableOpacity>
          </View>

          {/* 章节标题 */}
          <TextInput
            value={chapterTitle}
            onChangeText={setChapterTitle}
            className="px-4 pt-3 pb-1 text-lg font-bold text-gray-800"
            placeholder="章节标题"
          />
          <View className="px-4 pb-2">
            <Text className="text-xs text-gray-400">{wordCount} 字</Text>
          </View>

          {/* 编辑工具栏 */}
          <View className="flex-row items-center border-b border-gray-100 bg-white py-2">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
              <View className="flex-row items-center gap-1 px-3">
                <TouchableOpacity onPress={handleFormat} className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-50">
                  <FontAwesome6 name="align-left" size={12} color="#6366F1" />
                  <Text className="text-xs text-gray-700 font-medium">排版</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleQuotes} className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-50">
                  <Text className="text-xs text-gray-700 font-medium" style={{fontSize:13}}>{'"'}</Text>
                  <Text className="text-xs text-gray-700 font-medium">双引号</Text>
                </TouchableOpacity>

                <View className="w-px h-5 bg-gray-200 mx-1" />

                {/* 起名 */}
                {(["person", "item", "ability", "place"] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => { setNameType(type); setAiMode("names"); setAiModalVisible(true); }}
                    className="px-3 py-1.5 rounded-lg bg-gray-50"
                  >
                    <Text className="text-xs text-gray-700 font-medium">
                      {type === "person" ? "人物" : type === "item" ? "物品" : type === "ability" ? "能力" : "地区"}
                    </Text>
                  </TouchableOpacity>
                ))}

                <View className="w-px h-5 bg-gray-200 mx-1" />

                {/* AI功能 */}
                <TouchableOpacity onPress={() => { setAiMode("generate"); setAiModalVisible(true); setAiPrompt(""); }}
                  className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg" style={{backgroundColor: "#EEF2FF"}}>
                  <FontAwesome6 name="wand-sparkles" size={12} color="#6366F1" />
                  <Text className="text-xs font-semibold" style={{color: "#6366F1"}}>AI创作</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setAiMode("expand"); setAiPrompt("请扩写以下内容，增加细节和描写："); setAiModalVisible(true); }}
                  className="px-3 py-1.5 rounded-lg bg-gray-50">
                  <Text className="text-xs text-gray-700 font-medium">扩写</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setAiMode("polish"); setAiPrompt("请润色以下内容，提升文采和表达："); setAiModalVisible(true); }}
                  className="px-3 py-1.5 rounded-lg bg-gray-50">
                  <Text className="text-xs text-gray-700 font-medium">润色</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>

          {/* 编辑区 */}
          <ScrollView className="flex-1 px-4 pt-3">
            <TextInput
              value={content}
              onChangeText={setContent}
              multiline
              className="w-full min-h-[400px] text-base text-gray-700 leading-relaxed"
              placeholder="开始创作你的故事..."
              textAlignVertical="top"
            />

            {/* AI生成区域 */}
            {isGenerating && (
              <View className="bg-indigo-50 rounded-2xl p-4 mb-4 border border-indigo-100">
                <View className="flex-row items-center gap-2 mb-2">
                  <FontAwesome6 name="wand-sparkles" size={14} color="#6366F1" />
                  <Text className="font-semibold text-indigo-700">AI正在创作...</Text>
                </View>
                <Text className="text-sm text-gray-700 leading-relaxed">
                  {generatedContent || "思考中..."}
                </Text>
                <View className="flex-row gap-2 mt-3">
                  <TouchableOpacity onPress={applyGeneratedContent}
                    className="flex-1 py-2 rounded-xl items-center" style={{backgroundColor: "#6366F1"}}>
                    <Text className="text-white text-xs font-medium">采用</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleStopGeneration}
                    className="flex-1 py-2 rounded-xl items-center bg-gray-200">
                    <Text className="text-gray-700 text-xs font-medium">停止</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            <View className="h-24" />
          </ScrollView>
        </View>

        {/* AI / 起名 Modal */}
        <Modal visible={aiModalVisible} transparent animationType="slide">
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === "web"}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <View className="flex-1 justify-end bg-black/50">
                <View className="bg-white rounded-t-3xl p-6 max-h-[70%]">
                  <ScrollView>
                    <View className="flex-row items-center justify-between mb-6">
                      <Text className="text-xl font-bold text-gray-800">
                        {aiMode === "names" ? "AI起名" : "AI创作助手"}
                      </Text>
                      <TouchableOpacity onPress={() => setAiModalVisible(false)}
                        className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
                        <Text>x</Text>
                      </TouchableOpacity>
                    </View>

                    {/* 起名模式 */}
                    {aiMode === "names" && (
                      <View>
                        <Text className="text-sm text-gray-600 mb-4">
                          正在生成{nameType === "person" ? "人物" : nameType === "item" ? "物品" : nameType === "ability" ? "能力" : "地区"}名称...
                        </Text>
                        <View className="bg-indigo-50 rounded-2xl p-4 mb-4 min-h-[100px]">
                          {generatedContent ? (
                            <Text className="text-sm text-gray-800 leading-relaxed">{generatedContent}</Text>
                          ) : (
                            <Text className="text-sm text-gray-400">点击下方按钮开始生成</Text>
                          )}
                        </View>
                        <TouchableOpacity onPress={handleGenerateNames}
                          className="w-full py-3 rounded-xl items-center flex-row justify-center gap-2"
                          style={{backgroundColor: "#6366F1"}} disabled={isGenerating}>
                          <FontAwesome6 name="wand-sparkles" size={14} color="#fff" />
                          <Text className="text-white font-medium">{isGenerating ? "生成中..." : "生成名称"}</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* AI写作模式 */}
                    {aiMode !== "names" && (
                      <View>
                        <Text className="text-sm font-medium text-gray-700 mb-2">写作指令</Text>
                        <TextInput
                          value={aiPrompt}
                          onChangeText={setAiPrompt}
                          placeholder="告诉AI你想要写什么..."
                          multiline
                          numberOfLines={3}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 mb-4 text-gray-800"
                        />
                        <TouchableOpacity onPress={handleAIWrite}
                          className="w-full py-3 rounded-xl items-center flex-row justify-center gap-2"
                          style={{backgroundColor: "#6366F1"}} disabled={isGenerating}>
                          <FontAwesome6 name="paper-plane" size={14} color="#fff" />
                          <Text className="text-white font-medium">{isGenerating ? "生成中..." : "执行创作"}</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {generatedContent && aiMode === "names" && (
                      <TouchableOpacity onPress={() => {
                        setContent((prev) => prev + "\n" + generatedContent);
                        setGeneratedContent("");
                        setAiModalVisible(false);
                      }}
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
      </KeyboardAvoidingView>
    </Screen>
  );
}