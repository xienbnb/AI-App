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
    color: "bg-primary-500",
    bgLight: "bg-primary-50",
    route: "/works",
  },
  {
    id: "works",
    icon: "book-bookmark",
    title: "作品管理",
    desc: "查看和管理你的所有作品",
    color: "bg-cyan-500",
    bgLight: "bg-cyan-50",
    route: "/works",
  },
  {
    id: "ai-tools",
    icon: "microchip",
    title: "AI工坊",
    desc: "角色/大纲/封面等创作工具",
    color: "bg-amber-500",
    bgLight: "bg-amber-50",
    route: "/ai",
  },
];

const topicTags = [
  { label: "玄幻修仙", icon: "wand-magic-sparkles", color: "text-primary-500", bg: "bg-primary-50" },
  { label: "都市言情", icon: "heart", color: "text-rose-500", bg: "bg-rose-50" },
  { label: "科幻未来", icon: "rocket", color: "text-cyan-500", bg: "bg-cyan-50" },
  { label: "悬疑推理", icon: "magnifying-glass", color: "text-orange-500", bg: "bg-orange-50" },
  { label: "系统爽文", icon: "bolt", color: "text-emerald-500", bg: "bg-emerald-50" },
  { label: "历史穿越", icon: "crown", color: "text-amber-500", bg: "bg-amber-50" },
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
        duration: 600,
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

    // POST /api/v1/writing/ai-dialogue
    // Body: { message: string }
    // Response: SSE stream with {"content": "xxx"} chunks, then {"bookCreated":true,...} then [DONE]
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
    router.push(card.route as any);
  };

  const handleCreateBook = async (msg: Message) => {
    if (!msg.bookData) return;
    setLoading(true);
    try {
      // POST /api/v1/writing/ai-create-book
      // Body: { prompt: string }
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
      <View className="flex-1 bg-white dark:bg-gray-900">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          {/* ===== Header ===== */}
          <View className="flex-row items-center justify-between px-5 pt-2 pb-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
            <View className="flex-row items-center gap-3">
              {!showWelcome && (
                <TouchableOpacity
                  onPress={handleNewChat}
                  className="w-8 h-8 rounded-lg items-center justify-center bg-primary-50 dark:bg-primary-900/30"
                >
                  <FontAwesome6 name="plus" size={14} color="#6366F1" />
                </TouchableOpacity>
              )}
              <Text className="text-lg font-bold text-gray-900 dark:text-white">
                {showWelcome ? "AI 创作" : "新对话"}
              </Text>
            </View>
            <Text className="text-xs text-gray-400 dark:text-gray-500">v1.0</Text>
          </View>

          {/* ===== Content ===== */}
          {showWelcome ? (
            <Animated.View className="flex-1" style={{ opacity: fadeAnim }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 16 }}
                className="px-5"
              >
                {/* Brand Area */}
                <View className="items-center pt-8 pb-7">
                  <View className="w-16 h-16 rounded-2xl items-center justify-center mb-4 bg-primary-50 dark:bg-primary-900/30">
                    <FontAwesome6 name="wand-magic-sparkles" size={28} color="#6366F1" />
                  </View>
                  <Text className="text-2xl font-bold text-gray-900 dark:text-white tracking-wide">
                    AI 创作助手
                  </Text>
                  <Text className="text-sm mt-2 text-gray-500 dark:text-gray-400">
                    用灵感创作你的世界
                  </Text>
                </View>

                {/* Feature Cards */}
                <View className="gap-3 mb-6">
                  {featureCards.map((card) => (
                    <TouchableOpacity
                      key={card.id}
                      onPress={() => handleCardPress(card)}
                      activeOpacity={0.7}
                      className="flex-row items-center p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                      style={{
                        shadowColor: "#6366F1",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.06,
                        shadowRadius: 8,
                        elevation: 2,
                      }}
                    >
                      <View className={`w-11 h-11 rounded-xl items-center justify-center mr-3 ${card.bgLight} dark:bg-gray-700`}>
                        <FontAwesome6 name={card.icon as any} size={18} color={card.color === "bg-primary-500" ? "#6366F1" : card.color === "bg-cyan-500" ? "#06B6D4" : "#F59E0B"} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-gray-900 dark:text-white">
                          {card.title}
                        </Text>
                        <Text className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">
                          {card.desc}
                        </Text>
                      </View>
                      <FontAwesome6 name="chevron-right" size={14} color="#CBD5E1" />
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Divider */}
                <View className="flex-row items-center gap-3 mb-4">
                  <View className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                  <Text className="text-xs text-gray-400 dark:text-gray-500 font-medium">热门方向</Text>
                  <View className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                </View>

                {/* Topic Tags */}
                <View className="flex-row flex-wrap gap-2.5 mb-6">
                  {topicTags.map((tag, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => setInput(`我想写一篇关于${tag.label}的小说`)}
                      className={`flex-row items-center gap-1.5 rounded-full px-3.5 py-2 ${tag.bg} dark:bg-gray-800`}
                    >
                      <FontAwesome6 name={tag.icon as any} size={11} color={tag.color === "text-primary-500" ? "#6366F1" : tag.color === "text-rose-500" ? "#F43F5E" : tag.color === "text-cyan-500" ? "#06B6D4" : tag.color === "text-orange-500" ? "#F97316" : tag.color === "text-emerald-500" ? "#10B981" : "#F59E0B"} />
                      <Text className={`text-xs font-medium ${tag.color} dark:text-gray-300`}>
                        {tag.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Example Prompt */}
                <TouchableOpacity
                  onPress={() => setInput("我想写一个关于平行世界的故事，主角能在不同世界之间穿梭")}
                  className="flex-row items-center gap-3 rounded-2xl p-4 border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50"
                >
                  <View className="w-8 h-8 rounded-lg items-center justify-center bg-amber-50 dark:bg-amber-900/30">
                    <FontAwesome6 name="lightbulb" size={14} color="#F59E0B" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-medium text-primary-500 mb-0.5">试试这样说</Text>
                    <Text className="text-xs text-gray-400 dark:text-gray-500">
                      {'\u201C'}我想写一个关于平行世界的故事，主角能在不同世界之间穿梭{'\u201D'}
                    </Text>
                  </View>
                </TouchableOpacity>
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
                        <View className="w-7 h-7 rounded-lg items-center justify-center bg-primary-50 dark:bg-primary-900/30">
                          <FontAwesome6 name="wand-magic-sparkles" size={12} color="#6366F1" />
                        </View>
                      )}
                      <View
                        className={`rounded-2xl px-4 py-3 max-w-[80%] ${
                          msg.role === "user"
                            ? "bg-primary-500"
                            : "bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                        }`}
                        style={
                          msg.role === "assistant"
                            ? {
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.04,
                                shadowRadius: 4,
                                elevation: 1,
                              }
                            : undefined
                        }
                      >
                        {loading && msg.content === "" && msg.role === "assistant" ? (
                          <View className="flex-row gap-1.5 py-2 px-1">
                            {[0.3, 0.6, 1].map((o, i) => (
                              <View
                                key={i}
                                className="w-2 h-2 rounded-full bg-primary-500"
                                style={{ opacity: o }}
                              />
                            ))}
                          </View>
                        ) : (
                          <Text
                            className={`text-sm leading-6 ${
                              msg.role === "user" ? "text-white" : "text-gray-800 dark:text-gray-200"
                            }`}
                          >
                            {msg.content}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Book Creation Card */}
                    {msg.bookData && msg.content && (
                      <View className="ml-9 mt-3">
                        <View className="rounded-2xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                          style={{
                            shadowColor: "#6366F1",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.1,
                            shadowRadius: 12,
                            elevation: 4,
                          }}
                        >
                          <View className="p-4">
                            {/* Book Preview */}
                            <View className="flex-row gap-3 mb-3">
                              <View className="w-16 h-20 rounded-xl items-center justify-center bg-primary-50 dark:bg-primary-900/30">
                                <FontAwesome6 name="book-open" size={24} color="#6366F1" />
                              </View>
                              <View className="flex-1 justify-center">
                                <Text className="font-bold text-base text-gray-900 dark:text-white">
                                  《{msg.bookData.title}》
                                </Text>
                                <View className="self-start rounded-full px-2.5 py-0.5 mt-1.5 bg-primary-50 dark:bg-primary-900/30">
                                  <Text className="text-xs font-medium text-primary-500">
                                    {msg.bookData.category}
                                  </Text>
                                </View>
                              </View>
                            </View>

                            <Text className="text-sm leading-5 mb-4 text-gray-600 dark:text-gray-400">
                              {msg.bookData.description}
                            </Text>

                            {/* Actions */}
                            <View className="flex-row gap-3">
                              <TouchableOpacity
                                onPress={() => handleCreateBook(msg)}
                                disabled={loading}
                                className="flex-1 h-10 rounded-xl items-center justify-center flex-row gap-2 bg-primary-500"
                              >
                                {loading ? (
                                  <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                  <>
                                    <FontAwesome6 name="check" size={14} color="#FFF" />
                                    <Text className="text-sm font-semibold text-white">
                                      确认创作
                                    </Text>
                                  </>
                                )}
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => {
                                  setInput(`修改《${msg.bookData?.title}》的设定，${msg.bookData?.description}`);
                                }}
                                className="w-10 h-10 rounded-xl items-center justify-center bg-gray-100 dark:bg-gray-700"
                              >
                                <FontAwesome6 name="pen" size={14} color="#64748B" />
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
                    <ActivityIndicator size="small" color="#6366F1" />
                    <Text className="text-xs text-gray-400 dark:text-gray-500">
                      AI 正在创作...
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}

          {/* ===== Input Bar ===== */}
          <View className="px-4 pt-2 pb-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
            <View className="flex-row items-end rounded-2xl px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
              <TouchableOpacity className="w-8 h-8 rounded-lg items-center justify-center mr-1.5 bg-primary-50 dark:bg-primary-900/30">
                <FontAwesome6 name="at" size={14} color="#6366F1" />
              </TouchableOpacity>

              <TextInput
                className="flex-1 text-sm max-h-20 py-1.5 text-gray-900 dark:text-white"
                placeholder="写下你的故事..."
                placeholderTextColor="#9CA3AF"
                value={input}
                onChangeText={setInput}
                multiline
                style={{ lineHeight: 20 }}
                onFocus={() =>
                  scrollRef.current?.scrollToEnd({ animated: true })
                }
              />

              {input.trim() ? (
                <TouchableOpacity
                  onPress={handleSend}
                  disabled={loading}
                  className="w-8 h-8 rounded-lg items-center justify-center ml-1.5 bg-primary-500"
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <FontAwesome6 name="arrow-up" size={14} color="#FFF" />
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity className="w-8 h-8 rounded-lg items-center justify-center ml-1.5 bg-gray-200 dark:bg-gray-700">
                  <FontAwesome6 name="arrow-up" size={14} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
            <View className="flex-row items-center justify-between mt-2 px-1">
              <Text className="text-xs text-gray-400 dark:text-gray-500">联网搜索</Text>
              <Text className="text-xs text-gray-400 dark:text-gray-500">Enter 发送</Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Screen>
  );
}