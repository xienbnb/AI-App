import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import MarkdownDisplay from "react-native-markdown-display";

/**
 * Markdown 渲染组件
 * - 支持代码块高亮/复制
 * - 支持行内代码
 * - 流畅的流式渲染
 */

// Markdown 样式定义
export const markdownStyles = {
  body: { color: "#374151", fontSize: 14, lineHeight: 22 },
  heading1: { fontSize: 20, fontWeight: "700" as const, color: "#111827", marginVertical: 8, lineHeight: 28 },
  heading2: { fontSize: 17, fontWeight: "700" as const, color: "#1F2937", marginVertical: 6, lineHeight: 24 },
  heading3: { fontSize: 15, fontWeight: "600" as const, color: "#374151", marginVertical: 4, lineHeight: 22 },
  paragraph: { marginVertical: 4, lineHeight: 22 },
  code_inline: {
    backgroundColor: "#F3F4F6",
    color: "#BE185D",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  code_block: {
    backgroundColor: "#1E293B",
    color: "#E2E8F0",
    padding: 14,
    borderRadius: 10,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginVertical: 8,
  },
  fence: {
    backgroundColor: "#1E293B",
    color: "#E2E8F0",
    padding: 14,
    borderRadius: 10,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginVertical: 8,
  },
  blockquote: { borderLeftWidth: 3, borderLeftColor: "#6366F1", paddingLeft: 12, marginVertical: 6, opacity: 0.85 },
  bullet_list: { marginVertical: 2 },
  ordered_list: { marginVertical: 2 },
  list_item: { marginVertical: 1, lineHeight: 22 },
  strong: { fontWeight: "700" as const },
  em: { fontStyle: "italic" as const },
  link: { color: "#6366F1", textDecorationLine: "underline" as const },
  hr: { backgroundColor: "#E5E7EB", height: 1, marginVertical: 12 },
  table: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8, marginVertical: 8 },
  thead: { backgroundColor: "#F9FAFB" },
  th: { padding: 8, fontWeight: "600" as const, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  td: { padding: 8, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  tr: { borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
};

// 代理消息的绿色主题样式
export const agentMarkdownStyles = {
  ...markdownStyles,
  body: { ...markdownStyles.body, color: "#065F46" },
  heading1: { ...markdownStyles.heading1, color: "#064E3B" },
  heading2: { ...markdownStyles.heading2, color: "#065F46" },
  heading3: { ...markdownStyles.heading3, color: "#065F46" },
  code_inline: { ...markdownStyles.code_inline, backgroundColor: "#D1FAE5", color: "#047857" },
  link: { color: "#059669" },
  blockquote: { ...markdownStyles.blockquote, borderLeftColor: "#34D399" },
};

interface MarkdownRendererProps {
  content: string;
  variant?: "default" | "agent";
}

export function MarkdownRenderer({ content, variant = "default" }: MarkdownRendererProps) {
  if (!content) return null;

  const styles = variant === "agent" ? agentMarkdownStyles : markdownStyles;

  return (
    <MarkdownDisplay style={styles}>
      {content}
    </MarkdownDisplay>
  );
}

/**
 * 代码块复制按钮组件
 * 用于自定义渲染器中的代码块
 */
interface CodeBlockProps {
  content: string;
  language?: string;
}

export function CopyableCodeBlock({ content, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      // ignore
    }
  }, [content]);

  return (
    <View className="my-2 rounded-xl overflow-hidden" style={{ backgroundColor: "#1E293B" }}>
      {/* 顶栏：语言标签 + 复制按钮 */}
      <View className="flex-row items-center justify-between px-4 py-2" style={{ backgroundColor: "#334155" }}>
        <Text className="text-xs font-medium text-gray-400">{language || "code"}</Text>
        <TouchableOpacity
          onPress={handleCopy}
          className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-md"
          style={{ backgroundColor: copied ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.1)" }}
        >
          <FontAwesome6 name={copied ? "check" : "copy"} size={11} color={copied ? "#10B981" : "#94A3B8"} />
          <Text className="text-xs" style={{ color: copied ? "#10B981" : "#94A3B8" }}>{copied ? "已复制" : "复制"}</Text>
        </TouchableOpacity>
      </View>
      {/* 代码内容 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 py-3">
        <Text
          className="text-sm"
          style={{
            color: "#E2E8F0",
            fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
            lineHeight: 20,
          }}
        >
          {content}
        </Text>
      </ScrollView>
    </View>
  );
}