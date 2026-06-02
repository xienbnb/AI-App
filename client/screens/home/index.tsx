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

const suggestedTopics = [
  { label: "玄幻修仙", icon: "wand-magic-sparkles", desc: "丹田破碎后觉醒前世记忆", color: "#8B5CF6", bg: "#F5F3FF" },
  { label: "都市言情", icon: "heart", desc: "总裁的替身前妻带球跑", color: "#EC4899", bg: "#FDF2F8" },
  { label: "科幻未来", icon: "rocket", desc: "2077年，我成了赛博改造人", color: "#06B6D4", bg: "#ECFEFF" },
  { label: "悬疑推理", icon: "magnifying-glass", desc: "每个夜里都有不为人知的秘密", color: "#F97316", bg: "#FFF7ED" },
  { label: "系统爽文", icon: "bolt", desc: "签到十年，我出世即无敌", color: "#10B981", bg: "#ECFDF5" },
  { label: "历史穿越", icon: "crown", desc: "我穿成了古代最废柴的皇子", color: "#F59E0B", bg: "#FFFBEB" },
];

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  bookData?: {
    title: string;
    category: string;
    description: string;
    outline?: string[];
  };
  timestamp: number;
}

interface Book {
  id: string;
  title: string;
  category: string;
  coverImage?: string;
  wordCount: number;
  volumes: Array<{ id: string; title: string; chapters: Array<{ id: string; title: string }> }>;
}

export default function HomeScreen() {
  const router = useSafeRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [recentBooks, setRecentBooks] = useState<Book[]>([]);
  const [activeStep, setActiveStep] = useState<"idle" | "brainstorming" | "creating" | "done">("idle");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      fetchRecentBooks();
      setShowWelcome(messages.length === 0);
    }, [])
  );

  const fetchRecentBooks = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/writing`);
      const json = await res.json();
      if (json.success) {
        setRecentBooks((json.data || []).slice(0, 3));
      }
    } catch {
      // Silently fail
    }
  };

  useEffect(() => {
    if (showWelcome) {
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
    setActiveStep("brainstorming");

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
        setActiveStep("done");
        return;
      }
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "thinking") {
          fullContent += parsed.content;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: fullContent } : m))
          );
          setActiveStep("brainstorming");
        } else if (parsed.type === "result") {
          fullContent = parsed.content || fullContent;
          let bookData = undefined;
          if (parsed.book) {
            bookData = {
              title: parsed.book.title || "未命名作品",
              category: parsed.book.category || "未分类",
              description: parsed.book.description || "",
              outline: parsed.book.outline || [],
            };
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: fullContent, bookData }
                : m
            )
          );
          setActiveStep(bookData ? "creating" : "done");
        }
      } catch {
        fullContent += event.data;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: fullContent } : m))
        );
      }
    });

    sse.addEventListener("error", () => {
      sse.close();
      setLoading(false);
      setActiveStep("idle");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: fullContent || "抱歉，AI暂时无法响应，请稍后再试。" }
            : m
        )
      );
    });
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
          { text: "去看看", onPress: () => router.push("/(tabs)") },
          { text: "继续创作" },
        ]);
        fetchRecentBooks();
        setActiveStep("done");
      } else {
        Alert.alert("创建失败", json.error || "请稍后再试");
      }
    } catch {
      Alert.alert("网络错误", "无法连接到服务器");
    } finally {
      setLoading(false);
    }
  };

  const handleTopicPress = (topic: string) => {
    setInput(topic);
  };

  const handleNewChat = () => {
    setMessages([]);
    setShowWelcome(true);
    setActiveStep("idle");
  };

  const formatDate = (d: Date) => {
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const getBookCoverBg = (category: string) => {
    const colors: Record<string, string> = {
      "玄幻": "linear-gradient(135deg, #8B5CF6, #6D28D9)",
      "奇幻": "linear-gradient(135deg, #06B6D4, #0891B2)",
      "言情": "linear-gradient(135deg, #EC4899, #BE185D)",
      "都市": "linear-gradient(135deg, #F97316, #EA580C)",
      "科幻": "linear-gradient(135deg, #6366F1, #4F46E5)",
      "悬疑": "linear-gradient(135deg, #1E293B, #334155)",
      "历史": "linear-gradient(135deg, #F59E0B, #D97706)",
      "系统": "linear-gradient(135deg, #10B981, #059669)",
    };
    return colors[category] || "linear-gradient(135deg, #8B5CF6, #6366F1)";
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Header */}
        <View
          className="px-5 pt-4 pb-4 flex-row items-center justify-between"
          style={{ backgroundColor: "#F8FAFC" }}
        >
          <View>
            <Text className="text-xl font-bold" style={{ color: "#0F172A" }}>
              AI 创作助手
            </Text>
            <Text className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
              {activeStep === "brainstorming"
                ? "AI正在构思中..."
                : activeStep === "creating"
                ? "可以创建作品了"
                : "输入灵感，开始创作"}
            </Text>
          </View>
          {messages.length > 0 && (
            <TouchableOpacity
              onPress={handleNewChat}
              className="w-9 h-9 rounded-xl items-center justify-center"
              style={{ backgroundColor: "#F1F5F9" }}
            >
              <FontAwesome6 name="plus" size={16} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>

        {showWelcome ? (
          /* Welcome View */
          <Animated.View className="flex-1 px-5" style={{ opacity: fadeAnim }}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {/* Hero */}
              <View className="pt-8 pb-6 items-center">
                <View
                  className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
                  style={{ backgroundColor: "#EEF2FF" }}
                >
                  <FontAwesome6 name="wand-magic-sparkles" size={28} color="#6366F1" />
                </View>
                <Text className="text-2xl font-bold text-center mb-2" style={{ color: "#0F172A" }}>
                  用灵感创作世界
                </Text>
                <Text className="text-sm text-center leading-5 px-4" style={{ color: "#94A3B8" }}>
                  告诉我你的想法，AI帮你构思书名、类型、大纲，一键生成完整作品
                </Text>
              </View>

              {/* Creation Flow Steps */}
              <View className="flex-row justify-center gap-3 mb-6">
                {[
                  { step: "1", label: "灵感", icon: "lightbulb", color: "#F59E0B" },
                  { step: "2", label: "构思", icon: "brain", color: "#8B5CF6" },
                  { step: "3", label: "创作", icon: "pen-fancy", color: "#06B6D4" },
                  { step: "4", label: "成书", icon: "book", color: "#10B981" },
                ].map((item, i) => (
                  <View key={i} className="items-center gap-1.5">
                    <View
                      className="w-10 h-10 rounded-xl items-center justify-center"
                      style={{ backgroundColor: `${item.color}15` }}
                    >
                      <FontAwesome6 name={item.icon as any} size={16} color={item.color} />
                    </View>
                    <Text className="text-xs font-medium" style={{ color: "#64748B" }}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Suggested Topics */}
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
                      shadowColor: topic.color,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.08,
                      shadowRadius: 8,
                      elevation: 2,
                    }}
                  >
                    <View
                      className="w-9 h-9 rounded-xl items-center justify-center mb-2"
                      style={{ backgroundColor: topic.bg }}
                    >
                      <FontAwesome6 name={topic.icon as any} size={16} color={topic.color} />
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

              {/* Example prompt */}
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

              {/* Recent Books */}
              {recentBooks.length > 0 && (
                <View className="mt-6">
                  <Text className="text-sm font-semibold mb-3" style={{ color: "#475569" }}>
                    最近作品
                  </Text>
                  <View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 px-5">
                      <View className="flex-row gap-3">
                      {recentBooks.map((book) => {
                        const totalChapters = book.volumes?.reduce(
                          (sum, v) => sum + (v.chapters?.length || 0), 0
                        ) || 0;
                        return (
                          <TouchableOpacity
                            key={book.id}
                            onPress={() => router.push(`/detail?id=${book.id}`)}
                            className="rounded-2xl overflow-hidden"
                            style={{ width: 140 }}
                            activeOpacity={0.8}
                          >
                            <View
                              className="h-28 items-center justify-center"
                              style={{ backgroundColor: "#EEF2FF" }}
                            >
                              <FontAwesome6 name="book-open" size={32} color="#6366F1" opacity={0.6} />
                              <Text
                                className="text-xs font-bold mt-2 px-2 text-center"
                                style={{ color: "#6366F1" }}
                                numberOfLines={1}
                              >
                                {book.title}
                              </Text>
                            </View>
                            <View className="px-2 py-2" style={{ backgroundColor: "#FFFFFF" }}>
                              <Text className="text-xs" style={{ color: "#94A3B8" }}>
                                {book.category} · {totalChapters}章
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                  </View>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        ) : (
          /* Chat Messages */
          <ScrollView
            ref={scrollRef}
            className="flex-1 px-5"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 16, paddingBottom: 8 }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            <View className="gap-4">
              {messages.map((msg) => (
                <View key={msg.id}>
                  <View
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
                      className={`rounded-2xl px-4 py-3 max-w-[80%]`}
                      style={{
                        backgroundColor: msg.role === "user" ? "#6366F1" : "#FFFFFF",
                        shadowColor: msg.role === "user" ? "#6366F1" : "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: msg.role === "user" ? 0.2 : 0.04,
                        shadowRadius: 8,
                        elevation: msg.role === "user" ? 4 : 1,
                      }}
                    >
                      {loading && msg.content === "" && msg.role === "assistant" ? (
                        <View className="flex-row gap-1.5 py-2">
                          {[1, 2, 3].map((i) => (
                            <View
                              key={i}
                              className="w-2 h-2 rounded-full"
                              style={{
                                backgroundColor: "#6366F1",
                                opacity: i * 0.3,
                              }}
                            />
                          ))}
                        </View>
                      ) : (
                        <Text
                          className="text-sm leading-5"
                          style={{
                            color: msg.role === "user" ? "#FFFFFF" : "#1E293B",
                            lineHeight: 22,
                          }}
                        >
                          {msg.content}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Book Creation Card */}
                  {msg.bookData && msg.content && (
                    <View className="ml-10 mt-3">
                      <View
                        className="rounded-2xl p-4"
                        style={{
                          backgroundColor: "#FFFFFF",
                          shadowColor: "#6366F1",
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.1,
                          shadowRadius: 12,
                          elevation: 4,
                          borderWidth: 1,
                          borderColor: "#EEF2FF",
                        }}
                      >
                        {/* Book Preview */}
                        <View className="flex-row gap-3 mb-3">
                          <View
                            className="w-16 h-20 rounded-xl items-center justify-center"
                            style={{ backgroundColor: "#EEF2FF" }}
                          >
                            <FontAwesome6 name="book-open" size={24} color="#6366F1" />
                          </View>
                          <View className="flex-1 justify-center">
                            <Text className="font-bold text-base" style={{ color: "#0F172A" }}>
                              《{msg.bookData.title}》
                            </Text>
                            <View
                              className="self-start rounded-full px-2.5 py-0.5 mt-1"
                              style={{ backgroundColor: "#EEF2FF" }}
                            >
                              <Text className="text-xs font-medium" style={{ color: "#6366F1" }}>
                                {msg.bookData.category}
                              </Text>
                            </View>
                          </View>
                        </View>

                        <Text className="text-sm mb-3" style={{ color: "#475569", lineHeight: 20 }}>
                          {msg.bookData.description}
                        </Text>

                        {/* Outline Preview */}
                        {msg.bookData.outline && msg.bookData.outline.length > 0 && (
                          <View className="mb-3">
                            <Text className="text-xs font-semibold mb-1.5" style={{ color: "#94A3B8" }}>
                              章节规划
                            </Text>
                            {msg.bookData.outline.slice(0, 3).map((item, i) => (
                              <View key={i} className="flex-row items-center gap-2 mb-1">
                                <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#6366F1" }} />
                                <Text className="text-xs" style={{ color: "#64748B" }} numberOfLines={1}>
                                  {item}
                                </Text>
                              </View>
                            ))}
                            {msg.bookData.outline.length > 3 && (
                              <Text className="text-xs mt-1" style={{ color: "#94A3B8" }}>
                                +{msg.bookData.outline.length - 3}章...
                              </Text>
                            )}
                          </View>
                        )}

                        {/* Action Buttons */}
                        <View className="flex-row gap-3">
                          <TouchableOpacity
                            onPress={() => handleCreateBook(msg)}
                            disabled={loading}
                            className="flex-1 h-10 rounded-xl items-center justify-center flex-row gap-2"
                            style={{ backgroundColor: "#6366F1" }}
                          >
                            {loading ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <FontAwesome6 name="check" size={14} color="#FFFFFF" />
                                <Text className="text-sm font-semibold text-white">创作作品</Text>
                              </>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              setInput(`修改一下《${msg.bookData?.title}》，${msg.bookData?.description}`);
                            }}
                            className="h-10 rounded-xl items-center justify-center px-4"
                            style={{ backgroundColor: "#F1F5F9" }}
                          >
                            <FontAwesome6 name="pen" size={14} color="#64748B" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              ))}

              {loading && messages[messages.length - 1]?.content !== "" && (
                <View className="flex-row items-center gap-2 ml-10 mt-2">
                  <ActivityIndicator size="small" color="#6366F1" />
                  <Text className="text-xs" style={{ color: "#94A3B8" }}>
                    AI正在创作...
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        )}

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