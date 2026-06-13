/**
 * @file 大纲创建/编辑页面
 * @description 使用 Quill 富文本编辑器编写创作大纲，支持新增和编辑两种模式
 *
 * - 新建：跳转时传 bookId + type（"大纲"|"细纲"），无 outlineId
 * - 编辑：跳转时传 bookId + outlineId，自动回填内容
 * - 保存时写入本地存储（自动同步云端）
 * - 支持内容变化自动保存（防抖 3 秒）+ 手动保存按钮
 * - 保存后自动返回上一页
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, TouchableOpacity, Alert, Platform, KeyboardAvoidingView } from "react-native";
import { useSafeRouter, useSafeSearchParams } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";
import RichEditor from "@/components/RichEditor";
import { DataManager } from "@/services/data-manager";

interface OutlineItem {
  id: string;
  type: "大纲" | "细纲";
  title: string;
  content: string;
}

const AUTOSAVE_DELAY = 3000; // 3 秒防抖自动保存

export default function OutlineCreateScreen() {
  const router = useSafeRouter();
  const { bookId, outlineId, type } = useSafeSearchParams<{ bookId: string; outlineId?: string; type?: string }>();

  const itemType = (type === "细纲" ? "细纲" : "大纲") as "大纲" | "细纲";
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [allOutlines, setAllOutlines] = useState<OutlineItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const isEditing = !!outlineId;
  const contentRef = useRef(content);
  const hasChangesRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 始终同步 contentRef
  useEffect(() => { contentRef.current = content; }, [content]);

  // 加载已有大纲列表（本地优先），如果是编辑模式则填充数据
  useEffect(() => {
    const load = async () => {
      if (!bookId) return;
      try {
        const result = await DataManager.getOutlines(bookId as string);
        if (result.success && Array.isArray(result.data)) {
          setAllOutlines(result.data);
          if (outlineId) {
            const item = result.data.find((o: OutlineItem) => o.id === outlineId);
            if (item) {
              setContent(item.content);
            }
          }
        }
      } catch {}
      setLoaded(true);
    };
    load();
  }, [bookId, outlineId]);

  const getCurrentContent = (): string => {
    try {
      if (typeof document !== "undefined") {
        const editorEl = document.querySelector(".ql-editor");
        if (editorEl) return (editorEl as HTMLElement).innerHTML;
      }
    } catch {}
    return contentRef.current;
  };

  const performAutoSave = async () => {
    const currentContent = getCurrentContent();
    if (!currentContent.trim() || currentContent === "<p><br></p>") return;

    try {
      let updatedItems: OutlineItem[];
      if (isEditing && outlineId) {
        updatedItems = allOutlines.map((o) =>
          o.id === outlineId ? { ...o, content: currentContent } : o
        );
      } else {
        // 查找是否已在列表中
        const existingIndex = allOutlines.findIndex((o) => o.id === outlineId);
        if (existingIndex >= 0) {
          updatedItems = allOutlines.map((o, i) =>
            i === existingIndex ? { ...o, content: currentContent } : o
          );
        } else {
          return; // 尚未保存过，不自动保存（等待手动保存）
        }
      }
      await DataManager.saveOutlines(bookId as string, updatedItems);
    } catch (e) {
      // 静默处理自动保存错误
    }
  };

  // 自动保存：内容变化时设置防抖定时器
  useEffect(() => {
    // 加载完成前不触发自动保存
    if (!loaded) return;
    // 初始加载时不触发（第一次 setContent 来自加载，不计为「已修改」）
    if (!hasChangesRef.current && !outlineId && content === "") return;

    hasChangesRef.current = true;

    // 清除上一次的定时器
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // 设置新的防抖定时器
    autoSaveTimerRef.current = setTimeout(() => {
      performAutoSave();
    }, AUTOSAVE_DELAY);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [content, loaded]);

  const handleSave = useCallback(async () => {
    // 清除自动保存定时器
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    // 直接从 DOM 读取 Quill 内容（绕过 React state 可能的延迟）
    let currentContent = contentRef.current;
    try {
      if (typeof document !== "undefined") {
        const editorEl = document.querySelector(".ql-editor");
        if (editorEl) currentContent = (editorEl as HTMLElement).innerHTML;
      }
    } catch {}

    if (!currentContent.trim() || currentContent === "<p><br></p>") {
      Alert.alert("提示", "请编写内容");
      return;
    }
    setSaving(true);
    try {
      let updatedItems: OutlineItem[];
      if (isEditing && outlineId) {
        updatedItems = allOutlines.map((o) =>
          o.id === outlineId
            ? { ...o, content: currentContent }
            : o
        );
      } else {
        const newItem: OutlineItem = {
          id: Date.now().toString(),
          type: itemType,
          title: "",
          content: currentContent,
        };
        updatedItems = [...allOutlines, newItem];
      }

      const result = await DataManager.saveOutlines(bookId as string, updatedItems);
      if (result.success) {
        hasChangesRef.current = false;
        Alert.alert("保存成功", `${itemType}已保存`, [
          { text: "返回", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert("错误", result.error || "保存失败，请重试");
      }
    } catch (e) {
      console.error("保存失败", e);
      Alert.alert("错误", "保存失败，请重试");
    }
    setSaving(false);
  }, [bookId, outlineId, allOutlines, isEditing, itemType, router]);

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
            {isEditing ? "编辑" + itemType : "创建" + itemType}
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