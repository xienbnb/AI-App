import { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, Platform, KeyboardAvoidingView } from "react-native";
import { useSafeRouter, useSafeSearchParams } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";
import RichEditor from "@/components/RichEditor";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

export default function OutlineCreateScreen() {
  const router = useSafeRouter();
  const { bookId } = useSafeSearchParams<{ bookId: string }>();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [existingOutline, setExistingOutline] = useState("");

  // 加载已有大纲（如果有）
  useEffect(() => {
    const load = async () => {
      if (!bookId) return;
      try {
        const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}`);
        const json = await res.json();
        if (json.success && json.data?.outline) {
          setExistingOutline(json.data.outline);
        }
      } catch {}
    };
    load();
  }, [bookId]);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert("提示", "请输入大纲标题");
      return;
    }
    if (!content.trim() || content === "<p><br></p>") {
      Alert.alert("提示", "请编写大纲内容");
      return;
    }
    setSaving(true);
    try {
      // 通过 outlines API 保存为一条大纲记录
      const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/outlines`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outline: content }),
      });
      const json = await res.json();
      if (json.success) {
        Alert.alert("保存成功", "大纲已保存", [
          { text: "返回", onPress: () => router.back() },
        ]);
      }
    } catch (e) {
      console.error("保存大纲失败", e);
      Alert.alert("错误", "保存失败，请重试");
    }
    setSaving(false);
  }, [bookId, title, content, router]);

  const nightMode = false; // 按需：从详情页取的 theme

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        {/* 顶部导航栏 */}
        <View className="flex-row items-center justify-between px-5 pt-2 pb-3"
          style={{ backgroundColor: "#F8F4ED", borderBottomWidth: 1, borderBottomColor: "#EDE4D4" }}>
          <TouchableOpacity onPress={() => router.back()}
            className="w-9 h-9 rounded-full items-center justify-center"
            style={{ backgroundColor: "#F2EDE4" }}>
            <FontAwesome6 name="arrow-left" size={15} color="#5C4A38" />
          </TouchableOpacity>
          <Text className="text-lg font-bold" style={{ color: "#2C1810" }}>创建大纲</Text>
          <TouchableOpacity onPress={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-full"
            style={{ backgroundColor: saving ? "#9CA3AF" : "#6366F1" }}>
            <Text className="text-sm font-semibold text-white">
              {saving ? "保存中..." : "保存"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 标题输入 */}
        <View className="px-5 pt-4 pb-2" style={{ backgroundColor: "#F8F4ED" }}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="大纲标题"
            placeholderTextColor="#C4B8A0"
            className="w-full text-lg font-bold"
            style={{ color: "#2C1810" }}
          />
          <View className="h-px mt-2" style={{ backgroundColor: "#EDE4D4" }} />
        </View>

        {/* Quill 富文本编辑器 */}
        <View className="flex-1 px-4 pb-4" style={{ backgroundColor: "#F8F4ED" }}>
          <RichEditor
            initialContent={existingOutline || ""}
            onChange={setContent}
            nightMode={false}
            style={{ flex: 1, borderRadius: 16, overflow: "hidden" }}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}