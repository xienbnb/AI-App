import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
} from "react-native";
import { Screen } from "@/components/Screen";
import { useFocusEffect } from "expo-router";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { FontAwesome6 } from "@expo/vector-icons";
import RNSSE from "react-native-sse";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

// Dark theme colors
const C = {
  bg: "#0A0A0F",
  surface: "#14141F",
  card: "#1A1A2E",
  border: "#252540",
  accent: "#8B5CF6",
  accentLight: "#A78BFA",
  accentBg: "rgba(139,92,246,0.12)",
  text: "#FFFFFF",
  muted: "#94A3B8",
  dim: "#4A4A6A",
  inputBg: "#1E1E3A",
  danger: "#EF4444",
  success: "#10B981",
};

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  bookData?: {
    title: string;
    category: string;
    description: string;
  };
  timestamp: number;
}

const featureCards = [
  {
    id: "create",
    icon: "wand-magic-sparkles",
    title: "灵感创作",
    desc: "用AI将想法变成完整小说",
    color: C.accent,
    route: "/(tabs)",
  },
  {
    id: "works",
    icon: "book-bookmark",
    title: "作品管理",
    desc: "查看和管理你的所有作品",
    color: "#06B6D4",
    route: "/(tabs)",
  },
  {
    id: "ai-tools",
    icon: "microchip",
    title: "AI工坊",
    desc: "角色/大纲/封面等创作工具",
    color: "#F59E0B",
    route: "/ai",
  },
];

export default function HomeScreen() {
  const router = useSafeRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      setShowWelcome(messages.length === 0);
    }, [])
  );

  useEffect(() => {
    if (showWelcome) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }).start();
    }
  }, [showWelcome]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setShowWelcome(false);

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    const assistantMsg: Message = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setLoading(true);

    const sse = new RNSSE(`${API_BASE}/api/v1/writing/ai-dialogue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    let fullContent = "";

    sse.addEventListener("message", (event: any) => {
      if (event.data === "[DONE]") {
        sse.close();
        setLoading(false);
        return;
      }
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.content) {
          fullContent += parsed.content;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: fullContent } : m
            )
          );
        }
        if (parsed.bookCreated) {
          const bookData = {
            title: parsed.bookTitle || "未命名作品",
            category: parsed.bookCategory || "未分类",
            description: parsed.bookDescription || "",
          };
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: fullContent, bookData } : m
            )
          );
        }
      } catch {
        fullContent += event.data;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: fullContent } : m
          )
        );
      }
    });

    sse.addEventListener("error", () => {
      sse.close();
      setLoading(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: fullContent || "抱歉，AI暂时无法响应，请稍后再试。" }
            : m
        )
      );
    });
  };

  const handleNewChat = () => {
    setMessages([]);
    setShowWelcome(true);
    setInput("");
  };

  const handleCardPress = (card: typeof featureCards[0]) => {
    if (card.id === "works" || card.id === "create") {
      router.push("/works");
    } else {
      router.push("/ai");
    }
  };

  const handleCreateBook = async (msg: Message) => {
    if (!msg.bookData) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing/ai-create-book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `书名：${msg.bookData.title}，类型：${msg.bookData.category}，简介：${msg.bookData.description}`,
        }),
      });
      const json = await res.json();
      if (json.success) {
        Alert.alert("创作成功", `《${json.data?.title || msg.bookData.title}》已保存到作品列表`, [
          { text: "去看看", onPress: () => router.push("/works") },
          { text: "继续创作" },
        ]);
      } else {
        Alert.alert("创建失败", json.error || "请稍后再试");
      }
    } catch {
      Alert.alert("网络错误", "无法连接到服务器");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View className="flex-1" style={{ backgroundColor: C.bg }}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          {/* ===== Header ===== */}
          <View
            className="flex-row items-center justify-between px-5 pt-3 pb-2"
            style={{ backgroundColor: C.bg }}
          >
            <View className="flex-row items-center gap-3">
              {!showWelcome && (
                <TouchableOpacity
                  onPress={handleNewChat}
                  className="w-8 h-8 rounded-lg items-center justify-center"
                  style={{ backgroundColor: C.accentBg }}
                >
                  <FontAwesome6 name="plus" size={14} color={C.accentLight} />
                </TouchableOpacity>
              )}
              <Text className="text-base font-semibold" style={{ color: C.text }}>
                {showWelcome ? "AI 创作" : "新对话"}
              </Text>
            </View>
            <Text className="text-xs" style={{ color: C.dim }}>v1.0</Text>
          </View>

          {/* ===== Content ===== */}
          {showWelcome ? (
            <Animated.View className="flex-1 px-5" style={{ opacity: fadeAnim }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 16 }}
              >
                {/* Brand Area */}
                <View className="items-center pt-8 pb-6">
                  <View
                    className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
                    style={{ backgroundColor: C.accentBg }}
                  >
                    <FontAwesome6 name="wand-magic-sparkles" size={28} color={C.accent} />
                  </View>
                  <Text
                    className="text-2xl font-bold tracking-wide"
                    style={{ color: C.text, letterSpacing: 1 }}
                  >
                    AI 创作助手
                  </Text>
                  <Text className="text-sm mt-2" style={{ color: C.muted }}>
                    用灵感创作你的世界
                  </Text>
                </View>

                {/* Feature Cards */}
                <View className="gap-3">
                  {featureCards.map((card) => (
                    <TouchableOpacity
                      key={card.id}
                      onPress={() => handleCardPress(card)}
                      activeOpacity={0.7}
                      className="rounded-2xl p-4 flex-row items-center"
                      style={{
                        backgroundColor: C.surface,
                        borderWidth: 1,
                        borderColor: C.border,
                      }}
                    >
                      <View
                        className="w-11 h-11 rounded-xl items-center justify-center mr-3"
                        style={{ backgroundColor: `${card.color}18` }}
                      >
                        <FontAwesome6
                          name={card.icon as any}
                          size={18}
                          color={card.color}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-base font-semibold" style={{ color: C.text }}>
                          {card.title}
                        </Text>
                        <Text className="text-xs mt-0.5" style={{ color: C.muted }}>
                          {card.desc}
                        </Text>
                      </View>
                      <FontAwesome6
                        name="chevron-right"
                        size={14}
                        color={C.dim}
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Suggested Topics - Compact */}
                <Text className="text-xs font-medium mt-6 mb-3" style={{ color: C.dim }}>
                  热门创作方向
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {[
                    { label: "玄幻修仙", color: C.accent },
                    { label: "都市言情", color: "#EC4899" },
                    { label: "科幻未来", color: "#06B6D4" },
                    { label: "悬疑推理", color: "#F97316" },
                    { label: "系统爽文", color: "#10B981" },
                    { label: "历史穿越", color: "#F59E0B" },
                  ].map((tag, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => setInput(`我想写一篇关于${tag.label}的小说`)}
                      className="rounded-full px-3.5 py-1.5"
                      style={{ backgroundColor: `${tag.color}15` }}
                    >
                      <Text className="text-xs font-medium" style={{ color: tag.color }}>
                        {tag.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </Animated.View>
          ) : (
            /* Chat Messages */
            <ScrollView
              ref={scrollRef}
              className="flex-1 px-4"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 16 }}
              onContentSizeChange={() =>
                scrollRef.current?.scrollToEnd({ animated: true })
              }
            >
              <View className="gap-4">
                {messages.map((msg) => (
                  <View key={msg.id}>
                    {/* Message Bubble */}
                    <View
                      className={`flex-row items-end gap-2 ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <View
                          className="w-7 h-7 rounded-lg items-center justify-center"
                          style={{ backgroundColor: C.accentBg }}
                        >
                          <FontAwesome6
                            name="wand-magic-sparkles"
                            size={12}
                            color={C.accent}
                          />
                        </View>
                      )}
                      <View
                        className={`rounded-2xl px-4 py-3 max-w-[80%]`}
                        style={{
                          backgroundColor:
                            msg.role === "user" ? C.accent : C.surface,
                          borderWidth: msg.role === "assistant" ? 1 : 0,
                          borderColor: C.border,
                        }}
                      >
                        {loading && msg.content === "" && msg.role === "assistant" ? (
                          <View className="flex-row gap-1.5 py-2 px-1">
                            {[0.3, 0.6, 1].map((o, i) => (
                              <View
                                key={i}
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: C.accent, opacity: o }}
                              />
                            ))}
                          </View>
                        ) : (
                          <Text
                            className="text-sm leading-6"
                            style={{
                              color: msg.role === "user" ? "#FFFFFF" : C.text,
                            }}
                          >
                            {msg.content}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Book Creation Card */}
                    {msg.bookData && msg.content && (
                      <View className="ml-9 mt-3">
                        <View
                          className="rounded-2xl overflow-hidden"
                          style={{
                            backgroundColor: C.surface,
                            borderWidth: 1,
                            borderColor: C.border,
                          }}
                        >
                          {/* Book Preview */}
                          <View className="p-4">
                            <View className="flex-row gap-3 mb-3">
                              <View
                                className="w-16 h-20 rounded-xl items-center justify-center"
                                style={{ backgroundColor: C.accentBg }}
                              >
                                <FontAwesome6
                                  name="book-open"
                                  size={24}
                                  color={C.accent}
                                />
                              </View>
                              <View className="flex-1 justify-center">
                                <Text
                                  className="font-bold text-base"
                                  style={{ color: C.text }}
                                >
                                  《{msg.bookData.title}》
                                </Text>
                                <View
                                  className="self-start rounded-full px-2.5 py-0.5 mt-1.5"
                                  style={{ backgroundColor: C.accentBg }}
                                >
                                  <Text
                                    className="text-xs font-medium"
                                    style={{ color: C.accentLight }}
                                  >
                                    {msg.bookData.category}
                                  </Text>
                                </View>
                              </View>
                            </View>
                            <Text
                              className="text-sm leading-5 mb-4"
                              style={{ color: C.muted }}
                            >
                              {msg.bookData.description}
                            </Text>

                            {/* Actions */}
                            <View className="flex-row gap-3">
                              <TouchableOpacity
                                onPress={() => handleCreateBook(msg)}
                                disabled={loading}
                                className="flex-1 h-10 rounded-xl items-center justify-center flex-row gap-2"
                                style={{ backgroundColor: C.accent }}
                              >
                                <FontAwesome6 name="check" size={14} color="#FFF" />
                                <Text className="text-sm font-semibold text-white">
                                  确认创作
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => {
                                  setInput(`修改《${msg.bookData?.title}》的设定，${msg.bookData?.description}`);
                                }}
                                className="w-10 h-10 rounded-xl items-center justify-center"
                                style={{ backgroundColor: C.accentBg }}
                              >
                                <FontAwesome6 name="pen" size={14} color={C.accentLight} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                ))}

                {loading && messages[messages.length - 1]?.content !== "" && (
                  <View className="flex-row items-center gap-2 ml-9">
                    <ActivityIndicator size="small" color={C.accent} />
                    <Text className="text-xs" style={{ color: C.dim }}>
                      AI 正在创作...
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}

          {/* ===== Input Bar ===== */}
          <View className="px-4 pt-2 pb-4" style={{ backgroundColor: C.bg }}>
            <View
              className="flex-row items-end rounded-2xl px-3 py-1.5"
              style={{
                backgroundColor: C.inputBg,
                borderWidth: 1,
                borderColor: C.border,
              }}
            >
              {/* Shortcut buttons */}
              <TouchableOpacity
                className="w-8 h-8 rounded-lg items-center justify-center mr-1.5"
                style={{ backgroundColor: C.accentBg }}
              >
                <FontAwesome6 name="at" size={14} color={C.accent} />
              </TouchableOpacity>

              <TextInput
                className="flex-1 text-sm max-h-20 py-1.5"
                placeholder="写下你的故事..."
                placeholderTextColor={C.dim}
                value={input}
                onChangeText={setInput}
                multiline
                style={{ color: C.text, lineHeight: 20 }}
                onFocus={() =>
                  scrollRef.current?.scrollToEnd({ animated: true })
                }
              />

              {input.trim() ? (
                <TouchableOpacity
                  onPress={handleSend}
                  disabled={loading}
                  className="w-8 h-8 rounded-lg items-center justify-center ml-1.5"
                  style={{
                    backgroundColor: loading ? C.dim : C.accent,
                  }}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <FontAwesome6 name="arrow-up" size={14} color="#FFF" />
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  className="w-8 h-8 rounded-lg items-center justify-center ml-1.5"
                  style={{ backgroundColor: C.dim }}
                >
                  <FontAwesome6 name="arrow-up" size={14} color={C.muted} />
                </TouchableOpacity>
              )}
            </View>
            <View className="flex-row items-center justify-between mt-2 px-1">
              <View className="flex-row gap-3">
                <Text className="text-xs" style={{ color: C.dim }}>
                  联网搜索
                </Text>
              </View>
              <Text className="text-xs" style={{ color: C.dim }}>
                Enter 发送
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Screen>
  );
}