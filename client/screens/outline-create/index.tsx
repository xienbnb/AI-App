import { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, Platform, KeyboardAvoidingView } from "react-native";
import { useSafeRouter, useSafeSearchParams } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";
import RichEditor from "@/components/RichEditor";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

interface OutlineItem {
  id: string;
  type: "大纲" | "细纲";
  title: string;
  content: string;
}

export default function OutlineCreateScreen() {
  const router = useSafeRouter();
  const { bookId, outlineId } = useSafeSearchParams<{ bookId: string; outlineId?: string }>();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [allOutlines, setAllOutlines] = useState<OutlineItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const isEditing = !!outlineId;

  // 加载已有大纲列表，如果是编辑模式则填充数据
  useEffect(() => {
    const load = async () => {
      if (!bookId) return;
      try {
        const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/outline-items`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setAllOutlines(json.data);
          if (outlineId) {
            const item = json.data.find((o: OutlineItem) => o.id === outlineId);
            if (item) {
              setTitle(item.title);
              setContent(item.content);
            }
          }
        }
      } catch {}
      setLoaded(true);
    };
    load();
  }, [bookId, outlineId]);

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
      let updatedItems: OutlineItem[];
      if (isEditing) {
        // 编辑模式：更新已有条目
        updatedItems = allOutlines.map((o) =>
          o.id === outlineId
            ? { ...o, title: title.trim(), content }
            : o
        );
      } else {
        // 新建模式：添加新条目
        const newItem: OutlineItem = {
          id: Date.now().toString(),
          type: "大纲",
          title: title.trim(),
          content,
        };
        updatedItems = [...allOutlines, newItem];
      }

      const res = await fetch(`${API_BASE}/api/v1/writing/${bookId}/outline-items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: updatedItems }),
      });
      const json = await res.json();
      if (json.success) {
        Alert.alert("保存成功", "大纲已保存", [
          { text: "返回", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert("错误", json.message || "保存失败，请重试");
      }
    } catch (e) {
      console.error("保存大纲失败", e);
      Alert.alert("错误", "保存失败，请重试");
    }
    setSaving(false);
  }, [bookId, outlineId, title, content, allOutlines, isEditing, router]);

  const nightMode = false;

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
          <Text className="text-lg font-bold" style={{ color: "#2C1810" }}>
            {isEditing ? "编辑大纲" : "创建大纲"}
          </Text>
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
            initialContent={content}
            onChange={setContent}
            nightMode={false}
            style={{ flex: 1, borderRadius: 16, overflow: "hidden" }}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}