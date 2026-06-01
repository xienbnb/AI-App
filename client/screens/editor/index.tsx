import { useState, useEffect, useCallback, useRef } from "react";
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
import RNSSE from "react-native-sse";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

const STYLE_OPTIONS = [
  { key: "default", label: "默认" },
  { key: "formal", label: "正式" },
  { key: "casual", label: "轻松" },
  { key: "literary", label: "文艺" },
  { key: "professional", label: "专业" },
];

export default function EditorScreen() {
  const router = useSafeRouter();
  const { bookId, chapterId } = useSafeSearchParams<{ bookId: string; chapterId: string }>();
  const [content, setContent] = useState("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStyle, setAiStyle] = useState("default");
  const [aiWordCount, setAiWordCount] = useState("500");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const sseRef = useRef<RNSSE | null>(null);

  const fetchChapter = useCallback(async () => {
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
    // 获取书名
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}`);
      const json = await res.json();
      if (json.success) setBookTitle(json.data.title);
    } catch (e) {}
  }, [bookId, chapterId]);

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
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, []);

  const wordCount = content.replace(/\s/g, "").length;

  const handleSave = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/chapters/${chapterId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: chapterTitle,
          content,
        }),
      });
      const json = await res.json();
      if (json.success) {
        Alert.alert("Save", "保存成功！");
      }
    } catch (e) {
      Alert.alert("错误", "保存失败");
    }
  };

  const handleAIWrite = () => {
    if (!aiPrompt.trim()) {
      Alert.alert("提示", "请输入写作主题");
      return;
    }

    setIsGenerating(true);
    setGeneratedContent("");
    setAiModalVisible(false);

    const url = `${API_BASE}/api/v1/writing/generate`;

    const sse = new RNSSE(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: aiPrompt.trim(),
        style: aiStyle,
        wordCount: parseInt(aiWordCount) || 500,
        context: content,
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
        } else if (parsed.error) {
          Alert.alert("错误", parsed.error);
          setIsGenerating(false);
        }
      } catch {
        // ignore parse errors
      }
    });

    sse.addEventListener("error", () => {
      setIsGenerating(false);
      Alert.alert("错误", "AI生成失败，请稍后重试");
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

  const editorActions = [
    { key: "bold", label: "B", style: "font-bold" },
    { key: "italic", label: "I", style: "italic" },
    { key: "heading", label: "H" },
  ];

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View className="flex-1">
          {/* 标题区 */}
          <View className="px-4 pt-2 pb-2 border-b border-gray-100">
            <TextInput
              value={chapterTitle}
              onChangeText={setChapterTitle}
              className="text-lg font-bold text-gray-800"
              placeholder="章节标题"
            />
            <View className="flex-row items-center gap-3 mt-1">
              <Text className="text-xs text-gray-400">D {wordCount} 字</Text>
              <Text className="text-xs text-gray-400">B {bookTitle}</Text>
            </View>
          </View>

          {/* 编辑器工具栏 */}
          <View className="flex-row items-center justify-between px-3 py-2 border-b border-gray-100 bg-white">
            <View className="flex-row items-center gap-1">
              {editorActions.map((action) => (
                <TouchableOpacity
                  key={action.key}
                  className="w-9 h-9 rounded-full items-center justify-center"
                >
                  <Text className={`text-gray-500 ${action.style || ""}`}>{action.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity className="w-9 h-9 rounded-full items-center justify-center">
                <Text className="text-gray-500">☰</Text>
              </TouchableOpacity>
              <TouchableOpacity className="w-9 h-9 rounded-full items-center justify-center">
                <Text className="text-gray-500">❝</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => setAiModalVisible(true)}
              className="px-4 h-9 rounded-xl flex-row items-center gap-1.5"
              style={{ backgroundColor: "#6366F1" }}
            >
              <Text className="text-white text-xs">S</Text>
              <Text className="text-white text-xs font-semibold">AI写作</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              className="w-9 h-9 rounded-full items-center justify-center"
            >
              <Text className="text-green-500">✓</Text>
            </TouchableOpacity>
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

            {/* AI生成内容展示 */}
            {isGenerating && (
              <View className="bg-purple-50 rounded-2xl p-4 mb-4">
                <View className="flex-row items-center gap-2 mb-2">
                  <Text className="text-lg">S</Text>
                  <Text className="font-semibold text-purple-700">AI正在创作...</Text>
                </View>
                <Text className="text-sm text-gray-700 leading-relaxed">
                  {generatedContent || "思考中..."}
                </Text>
                <View className="flex-row gap-2 mt-3">
                  <TouchableOpacity
                    onPress={applyGeneratedContent}
                    className="flex-1 py-2 rounded-xl items-center"
                    style={{ backgroundColor: "#6366F1" }}
                  >
                    <Text className="text-white text-xs font-medium">Y 采用</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleStopGeneration}
                    className="flex-1 py-2 rounded-xl items-center bg-gray-200"
                  >
                    <Text className="text-gray-700 text-xs font-medium">Stop 停止</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View className="h-20" />
          </ScrollView>
        </View>

        {/* AI写作面板 Modal */}
        <Modal visible={aiModalVisible} transparent animationType="slide">
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === "web"}>
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <View className="flex-1 justify-end bg-black/50">
                <View className="bg-white rounded-t-3xl p-6 max-h-[80%]">
                  <ScrollView>
                    <View className="flex-row items-center justify-between mb-6">
                      <Text className="text-xl font-bold text-gray-800">A AI写作助手</Text>
                      <TouchableOpacity
                        onPress={() => setAiModalVisible(false)}
                        className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                      >
                        <Text>x</Text>
                      </TouchableOpacity>
                    </View>

                    {/* AI功能按钮 */}
                    <View className="flex-row flex-wrap gap-3 mb-6">
                      {[
                        { key: "continue", icon: "W", label: "智能续写" },
                        { key: "polish", icon: "S", label: "内容润色" },
                        { key: "expand", icon: "G", label: "扩写" },
                        { key: "brainstorm", icon: "I", label: "灵感" },
                      ].map((item) => (
                        <TouchableOpacity
                          key={item.key}
                          onPress={() => {
                            const prompts: Record<string, string> = {
                              continue: "请根据以上内容继续创作，保持风格一致：",
                              polish: "请对以下内容进行润色优化，提升文采：",
                              expand: "请对以下内容进行扩写，增加细节描写：",
                              brainstorm: "请为以下主题提供一些创作灵感：",
                            };
                            setAiPrompt(prompts[item.key] || "");
                            handleAIWrite();
                          }}
                          className="w-[48%] aspect-square bg-gray-50 rounded-2xl items-center justify-center"
                        >
                          <Text className="text-xl mb-1">{item.icon}</Text>
                          <Text className="text-xs font-medium text-gray-700">{item.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* 字数统计 */}
                    <View className="bg-gray-50 rounded-2xl p-4 mb-4">
                      <Text className="text-xs text-gray-500 mb-1">当前字数</Text>
                      <Text className="text-2xl font-bold text-primary-500">{wordCount} 字</Text>
                    </View>

                    {/* 风格选择 */}
                    <Text className="text-sm font-medium text-gray-700 mb-2">写作风格</Text>
                    <View className="flex-row flex-wrap gap-2 mb-4">
                      {STYLE_OPTIONS.map((style) => (
                        <TouchableOpacity
                          key={style.key}
                          onPress={() => setAiStyle(style.key)}
                          className={`px-4 py-2 rounded-xl ${
                            aiStyle === style.key ? "bg-primary-500" : "bg-gray-100"
                          }`}
                        >
                          <Text
                            className={`text-xs font-medium ${
                              aiStyle === style.key ? "text-white" : "text-gray-700"
                            }`}
                          >
                            {style.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* 字数要求 */}
                    <Text className="text-sm font-medium text-gray-700 mb-2">篇幅要求</Text>
                    <View className="flex-row flex-wrap gap-2 mb-4">
                      {["300", "500", "1000", "2000"].map((count) => (
                        <TouchableOpacity
                          key={count}
                          onPress={() => setAiWordCount(count)}
                          className={`px-4 py-2 rounded-xl ${
                            aiWordCount === count ? "bg-primary-500" : "bg-gray-100"
                          }`}
                        >
                          <Text
                            className={`text-xs font-medium ${
                              aiWordCount === count ? "text-white" : "text-gray-700"
                            }`}
                          >
                            {count}字
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* 自定义输入 */}
                    <TextInput
                      value={aiPrompt}
                      onChangeText={setAiPrompt}
                      placeholder="告诉AI你想要怎么创作..."
                      multiline
                      numberOfLines={3}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 mb-4 text-gray-800"
                    />

                    <TouchableOpacity
                      onPress={handleAIWrite}
                      className="w-full py-3 rounded-xl mb-4"
                      style={{ backgroundColor: "#6366F1" }}
                    >
                      <Text className="text-white text-center font-medium">F 执行创作</Text>
                    </TouchableOpacity>
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