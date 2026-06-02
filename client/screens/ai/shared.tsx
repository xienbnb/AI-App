import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView } from "react-native";
import { useState, useRef, useEffect } from "react";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";
import RNSSE from "react-native-sse";

export const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

function useSSE() {
  const sseRef = useRef<RNSSE | null>(null);

  const start = (
    url: string,
    body: Record<string, any>,
    callbacks: { onChunk: (fullText: string) => void; onDone: () => void; onError: (err: string) => void }
  ) => {
    stop();
    const sse = new RNSSE(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    sseRef.current = sse;
    let full = "";
    sse.addEventListener("message", (event: any) => {
      if (!event.data) return;
      if (event.data === "[DONE]") { sse.close(); callbacks.onDone(); return; }
      try { const d = JSON.parse(event.data); if (d.content) { full += d.content; callbacks.onChunk(full); } } catch (_) {}
    });
    sse.addEventListener("error", (event: any) => callbacks.onError(event?.message || "连接错误"));
  };

  const stop = () => { if (sseRef.current) { sseRef.current.close(); sseRef.current = null; } };
  useEffect(() => () => stop(), []);
  return { start, stop };
}

export function createToolPage(config: {
  title: string;
  icon: string;
  subtitle: string;
  endpoint: string;
  fields: { key: string; label: string; placeholder: string; multiline?: boolean }[];
  suggestions?: string[];
}) {
  return function ToolPage() {
    const router = useSafeRouter();
    const [form, setForm] = useState<Record<string, string>>({});
    const [result, setResult] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState("");
    const { start, stop } = useSSE();

    const handleGenerate = () => {
      const body: Record<string, any> = {};
      config.fields.forEach((f) => { if (form[f.key]) body[f.key] = form[f.key]; });
      setResult(""); setError(""); setIsStreaming(true);
      start(`${API_BASE}${config.endpoint}`, body, {
        onChunk: setResult,
        onDone: () => setIsStreaming(false),
        onError: (err) => { setError(err); setIsStreaming(false); },
      });
    };

    const fillSuggestion = (text: string) => {
      if (config.fields.length > 0) setForm((prev) => ({ ...prev, [config.fields[0].key]: text }));
    };

    return (
      <Screen>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
          <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
            <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center mr-2">
              <FontAwesome6 name="arrow-left" size={18} color="#374151" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-lg font-bold text-gray-800">{config.title}</Text>
              <Text className="text-xs text-gray-400">{config.subtitle}</Text>
            </View>
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: "#EEF2FF" }}>
              <FontAwesome6 name={config.icon as any} size={16} color="#6366F1" />
            </View>
          </View>

          <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
            {config.fields.map((field) => (
              <View key={field.key} className="mt-3">
                <Text className="text-sm font-medium text-gray-700 mb-1">{field.label}</Text>
                {field.multiline ? (
                  <TextInput
                    className="bg-gray-50 rounded-xl px-4 py-3 text-gray-800 min-h-[80px]"
                    placeholder={field.placeholder} placeholderTextColor="#9CA3AF"
                    value={form[field.key] || ""}
                    onChangeText={(t) => setForm((prev) => ({ ...prev, [field.key]: t }))}
                    multiline textAlignVertical="top"
                  />
                ) : (
                  <TextInput
                    className="bg-gray-50 rounded-xl px-4 py-3 text-gray-800"
                    placeholder={field.placeholder} placeholderTextColor="#9CA3AF"
                    value={form[field.key] || ""}
                    onChangeText={(t) => setForm((prev) => ({ ...prev, [field.key]: t }))}
                  />
                )}
              </View>
            ))}

            {config.suggestions && (
              <View className="mt-4">
                <Text className="text-xs text-gray-500 mb-2">快速输入：</Text>
                <View className="flex-row flex-wrap gap-2">
                  {config.suggestions.map((s) => (
                    <TouchableOpacity key={s} onPress={() => fillSuggestion(s)}
                      className="px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100">
                      <Text className="text-xs text-indigo-600">{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={isStreaming ? stop : handleGenerate}
              className="mt-5 py-3.5 rounded-xl items-center flex-row justify-center"
              style={{ backgroundColor: isStreaming ? "#EF4444" : "#6366F1" }}
            >
              {isStreaming ? (
                <><FontAwesome6 name="stop" size={16} color="white" /><Text className="text-white font-semibold ml-2">停止生成</Text></>
              ) : (
                <><FontAwesome6 name="wand-magic-sparkles" size={16} color="white" /><Text className="text-white font-semibold ml-2">开始生成</Text></>
              )}
            </TouchableOpacity>

            {error ? (
              <View className="mt-4 p-3 bg-red-50 rounded-xl"><Text className="text-sm text-red-600">{error}</Text></View>
            ) : null}

            {result ? (
              <View className="mt-5 mb-8">
                <View className="flex-row items-center mb-3">
                  <FontAwesome6 name="file-lines" size={14} color="#6366F1" />
                  <Text className="text-sm font-semibold text-gray-700 ml-2">生成结果</Text>
                  {isStreaming && <ActivityIndicator size="small" color="#6366F1" style={{ marginLeft: 8 }} />}
                </View>
                <View className="bg-gray-50 rounded-2xl p-4">
                  <Text className="text-sm text-gray-800 leading-6">{result}</Text>
                </View>
              </View>
            ) : isStreaming ? (
              <View className="mt-8 items-center py-10">
                <ActivityIndicator size="large" color="#6366F1" />
                <Text className="text-sm text-gray-400 mt-3">AI 正在思考...</Text>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    );
  };
}