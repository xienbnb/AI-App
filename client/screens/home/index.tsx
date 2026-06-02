import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { FontAwesome6 } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import RNSSE from "react-native-sse";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 12) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

const suggestedTopics = [
  { icon: "rocket", label: "穿越异界", desc: "现代人意外穿越到异世界" },
  { icon: "heart", label: "都市甜宠", desc: "甜蜜的爱情故事" },
  { icon: "skull", label: "悬疑推理", desc: "破解离奇案件" },
  { icon: "dragon", label: "玄幻修真", desc: "修仙问道之路" },
];

export default function HomeScreen() {
  const router = useSafeRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const addMessage = (role: "user" | "assistant", content: string) => {
    setMessages((prev) => [...prev, { id: Date.now().toString(), role, content }]);
  };

  const updateLastMessage = (content: string) => {
    setMessages((prev) => {
      const copy = [...prev];
      if (copy.length > 0) {
        copy[copy.length - 1] = { ...copy[copy.length - 1], content };
      }
      return copy;
    });
  };

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    Keyboard.dismiss();
    addMessage("user", text);
    setLoading(true);

    const welcomeMsg: Message = {
      id: "welcome",
      role: "assistant",
      content: "",
    };
    setMessages((prev) => [...prev, welcomeMsg]);

    try {
      const sse = new RNSSE(`${API_BASE}/api/v1/writing/ai-dialogue`, {
        method: "POST",
        body: JSON.stringify({ message: text }),
        headers: { "Content-Type": "application/json" },
      });

      let accumulated = "";

      sse.addEventListener("message", (event: any) => {
        if (event.data === "[DONE]") {
          sse.close();
          setLoading(false);
          return;
        }
        try {
          const data = JSON.parse(event.data);
          if (data.content) {
            accumulated += data.content;
            updateLastMessage(accumulated);
          }
          if (data.bookCreated) {
            // Add a create button message after the AI response
            const createMsg = `\n\n---\n**书籍已生成！**\n\n书名：**${data.bookTitle}**\n类型：${data.bookCategory}\n简介：${data.bookDescription}\n章节数：${data.chaptersCount}章\n\n点击下方按钮前往创作！`;
            updateLastMessage(accumulated + createMsg);
            // Auto navigate after a short delay
            setTimeout(() => {
              router.push("/detail", { id: data.bookId });
            }, 2000);
          }
          if (data.error) {
            accumulated += `\n\n${data.error}`;
            updateLastMessage(accumulated);
          }
        } catch {
          // raw text
        }
      });

      sse.addEventListener("error", () => {
        sse.close();
        updateLastMessage(accumulated || "抱歉，网络连接异常，请稍后重试。");
        setLoading(false);
      });
    } catch (err) {
      updateLastMessage("抱歉，连接AI服务失败，请稍后重试。");
      setLoading(false);
    }
  };

  const handleTopicPress = (topic: string) => {
    setInput(topic);
  };

  return (
    <Screen
      safeAreaEdges={["left", "right", "bottom"]}
      backgroundColor="#F8FAFC"
    >
      {/* Header */}
      <View className="px-4 pt-4 pb-3 flex-row items-center justify-between">
        <View>
          <Text className="text-sm" style={{ color: "#8B5CF6" }}>
            {getGreeting()}，创作者
          </Text>
          <View className="flex-row items-center gap-2">
            <FontAwesome6 name="wand-magic-sparkles" size={16} color="#6366F1" />
            <Text className="text-xl font-bold" style={{ color: "#1E293B" }}>
              AI 创作助手
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/works")}
          className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl"
          style={{ backgroundColor: "#EEF2FF" }}
        >
          <FontAwesome6 name="book" size={14} color="#6366F1" />
          <Text className="text-xs font-medium" style={{ color: "#6366F1" }}>
            我的作品
          </Text>
        </TouchableOpacity>
      </View>

      {/* Chat Area */}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            /* Welcome state */
            <View className="pt-8 pb-4">
              {/* Welcome card */}
              <View
                className="rounded-3xl p-6 mb-6"
                style={{
                  backgroundColor: "#EEF2FF",
                }}
              >
                <View className="w-14 h-14 rounded-2xl items-center justify-center mb-4"
                  style={{ backgroundColor: "#6366F1" }}
                >
                  <FontAwesome6 name="feather" size={24} color="#FFFFFF" />
                </View>
                <Text className="text-xl font-bold mb-2" style={{ color: "#1E293B" }}>
                  开始你的创作之旅
                </Text>
                <Text className="text-sm leading-5" style={{ color: "#64748B" }}>
                  告诉我你的创意想法，我来帮你把它变成一部完整的小说！
                  你可以随意说说你的灵感、喜欢的题材，或者从下方选择一个主题开始。
                </Text>
              </View>

              {/* Suggested topics */}
              <Text className="text-sm font-semibold mb-3" style={{ color: "#475569" }}>
                热门创作方向
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {suggestedTopics.map((topic, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => handleTopicPress(topic.label)}
                    activeOpacity={0.7}
                    className="rounded-2xl p-4"
                    style={{
                      width: "47%",
                      backgroundColor: "#FFFFFF",
                      shadowColor: "#6366F1",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.06,
                      shadowRadius: 8,
                      elevation: 2,
                    }}
                  >
                    <View
                      className="w-9 h-9 rounded-xl items-center justify-center mb-2"
                      style={{ backgroundColor: "#EEF2FF" }}
                    >
                      <FontAwesome6 name={topic.icon as any} size={16} color="#6366F1" />
                    </View>
                    <Text className="font-semibold text-sm mb-1" style={{ color: "#1E293B" }}>
                      {topic.label}
                    </Text>
                    <Text className="text-xs" style={{ color: "#94A3B8" }}>
                      {topic.desc}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Example */}
              <TouchableOpacity
                onPress={() => handleTopicPress("我想写一个关于平行世界的故事，主角能在不同世界之间穿梭")}
                className="mt-4 rounded-2xl p-4 flex-row items-center gap-3"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1,
                  borderColor: "#E2E8F0",
                  borderStyle: "dashed",
                }}
              >
                <FontAwesome6 name="lightbulb" size={16} color="#F59E0B" />
                <View className="flex-1">
                  <Text className="text-xs font-medium mb-0.5" style={{ color: "#8B5CF6" }}>
                    试试这样说
                  </Text>
                  <Text className="text-xs" style={{ color: "#94A3B8" }}>
                    {'\u201C'}我想写一个关于平行世界的故事，主角能在不同世界之间穿梭{'\u201D'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            /* Messages */
            <View className="py-4 gap-4">
              {messages.map((msg) => (
                <View
                  key={msg.id}
                  className={`flex-row ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <View
                      className="w-8 h-8 rounded-xl items-center justify-center mr-2 mt-1"
                      style={{ backgroundColor: "#EEF2FF" }}
                    >
                      <FontAwesome6 name="wand-magic-sparkles" size={13} color="#6366F1" />
                    </View>
                  )}
                  <View
                    className={`rounded-2xl px-4 py-3 max-w-[80%] ${
                      msg.role === "user" ? "" : ""
                    }`}
                    style={{
                      backgroundColor: msg.role === "user" ? "#6366F1" : "#FFFFFF",
                      shadowColor: msg.role === "user" ? "#6366F1" : "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: msg.role === "user" ? 0.2 : 0.04,
                      shadowRadius: 8,
                      elevation: msg.role === "user" ? 4 : 1,
                    }}
                  >
                    <Text
                      className={`text-sm leading-5 ${msg.role === "user" ? "text-white" : ""}`}
                      style={{
                        color: msg.role === "user" ? "#FFFFFF" : "#1E293B",
                        lineHeight: 22,
                      }}
                    >
                      {msg.content || (loading && msg.id === "welcome" ? "思考中..." : "")}
                    </Text>
                    {loading && msg.id === "welcome" && !msg.content && (
                      <View className="flex-row gap-1.5 py-2">
                        <View
                          className="w-2 h-2 rounded-full opacity-40"
                          style={{ backgroundColor: "#6366F1" }}
                        />
                        <View
                          className="w-2 h-2 rounded-full opacity-60"
                          style={{ backgroundColor: "#6366F1" }}
                        />
                        <View
                          className="w-2 h-2 rounded-full opacity-80"
                          style={{ backgroundColor: "#6366F1" }}
                        />
                      </View>
                    )}
                  </View>
                </View>
              ))}
              {loading && (
                <View className="flex-row items-center gap-2 ml-10">
                  <ActivityIndicator size="small" color="#6366F1" />
                  <Text className="text-xs" style={{ color: "#94A3B8" }}>
                    AI正在创作...
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Input Bar */}
        <View
          className="px-4 pt-3 pb-4"
          style={{
            backgroundColor: "#F8FAFC",
            borderTopWidth: 1,
            borderTopColor: "#F1F5F9",
          }}
        >
          <View
            className="flex-row items-end rounded-2xl px-4 py-2"
            style={{
              backgroundColor: "#FFFFFF",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
              elevation: 2,
              borderWidth: 1,
              borderColor: "#E2E8F0",
            }}
          >
            <TextInput
              className="flex-1 text-sm max-h-24 py-1"
              placeholder="说说你的创作灵感..."
              placeholderTextColor="#94A3B8"
              value={input}
              onChangeText={setInput}
              multiline
              style={{ color: "#1E293B", lineHeight: 20 }}
              onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-xl items-center justify-center ml-2"
              style={{
                backgroundColor: input.trim() && !loading ? "#6366F1" : "#E2E8F0",
              }}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <FontAwesome6
                  name="arrow-up"
                  size={16}
                  color={input.trim() ? "#FFFFFF" : "#94A3B8"}
                />
              )}
            </TouchableOpacity>
          </View>
          <Text className="text-xs text-center mt-2" style={{ color: "#CBD5E1" }}>
            AI生成的内容仅供参考，请合理使用
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}