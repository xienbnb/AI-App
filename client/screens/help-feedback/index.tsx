/**
 * 帮助与反馈页面
 *
 * 包含FAQ常见问题（可折叠展开）和反馈表单
 * 反馈提交到服务端
 *
 * @file /client/screens/help-feedback/index.tsx
 */
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

// FAQ 数据列表
const faqItems = [
  {
    id: "faq-1",
    question: "如何创建一部新小说？",
    answer: "在首页点击「开始创作」按钮，选择「新建作品」，填写作品名称、类型和简介后即可创建。创建完成后，您可以在作品详情页中添加章节、大纲和角色设定。",
  },
  {
    id: "faq-2",
    question: "AI辅助写作如何使用？",
    answer: "在写作编辑器中，选中需要优化的文本，点击下方AI工具栏选择所需功能（续写、扩写、润色等）。AI将根据上下文生成建议内容，您可以采纳或修改。注意AI生成内容仅供参考，建议人工审核后再发布。",
  },
  {
    id: "faq-3",
    question: "如何导出我的作品？",
    answer: "进入作品详情页，点击右上角菜单按钮，选择「导出」。支持导出为 TXT、PDF 和 EPUB 格式。付费会员可享受更多导出格式和批量导出功能。",
  },
  {
    id: "faq-4",
    question: "订阅会员可以享受哪些权益？",
    answer: "订阅会员可享受：无限AI写作次数、高级模型访问权限、批量导出（PDF/EPUB）、去除广告、优先客服支持等专属权益。具体定价请参见应用内「会员中心」。",
  },
];

export default function HelpFeedbackPage() {
  const router = useSafeRouter();

  // FAQ 展开状态
  const [expandedFAQs, setExpandedFAQs] = useState<string[]>([]);

  // 反馈表单状态
  const [feedbackContent, setFeedbackContent] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 切换FAQ展开/收起
  const toggleFAQ = (id: string) => {
    setExpandedFAQs((prev) =>
      prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
    );
  };

  // 提交反馈
  const submitFeedback = async () => {
    if (!feedbackContent.trim()) {
      Alert.alert("提示", "请输入反馈内容");
      return;
    }
    try {
      setSubmitting(true);
      const token = await AsyncStorage.getItem("auth_token");
      if (!token) {
        Alert.alert("提示", "请先登录后再提交反馈");
        return;
      }
      const res = await fetch(`${API_BASE}/api/v1/users/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: feedbackContent.trim(),
          contact: contactInfo.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        Alert.alert("提交成功", "感谢您的反馈！我们会尽快处理。");
        setFeedbackContent("");
        setContactInfo("");
      } else {
        Alert.alert("提交失败", json.message || "请稍后重试");
      }
    } catch (e) {
      console.error("提交反馈失败", e);
      Alert.alert("提交失败", "网络异常，请检查连接后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-3">
        <TouchableOpacity
          className="w-9 h-9 rounded-xl items-center justify-center"
          style={{ backgroundColor: "#F3F4F6" }}
          onPress={() => router.back()}
        >
          <FontAwesome6 name="arrow-left" size={16} color="#374151" />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold text-gray-800 text-center mr-9">
          帮助与反馈
        </Text>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>
          {/* ===== 头部图标 ===== */}
          <View className="items-center my-4">
            <View className="w-16 h-16 rounded-3xl items-center justify-center mb-3 bg-emerald-50">
              <FontAwesome6 name="circle-question" size={28} color="#10B981" />
            </View>
            <Text className="text-base font-bold text-gray-800">常见问题与反馈</Text>
            <Text className="text-xs text-gray-400 mt-1">遇到问题？先看看FAQ，或直接向我们反馈</Text>
          </View>

          {/* ===== FAQ 分区 ===== */}
          <View className="mb-6">
            <View className="flex-row items-center gap-2 mb-3">
              <View className="w-1 h-5 rounded-full bg-emerald-500" />
              <Text className="text-base font-bold text-gray-800">常见问题</Text>
            </View>

            <View className="gap-2">
              {faqItems.map((faq) => {
                const isExpanded = expandedFAQs.includes(faq.id);
                return (
                  <View
                    key={faq.id}
                    className="bg-white rounded-xl overflow-hidden border border-gray-100"
                  >
                    <TouchableOpacity
                      className="flex-row items-center px-4 py-3.5"
                      onPress={() => toggleFAQ(faq.id)}
                      activeOpacity={0.6}
                    >
                      <FontAwesome6
                        name={isExpanded ? "chevron-down" : "chevron-right"}
                        size={12}
                        color="#9CA3AF"
                      />
                      <Text className="flex-1 text-sm font-semibold text-gray-800 ml-3">
                        {faq.question}
                      </Text>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View className="px-4 pb-3.5 pt-1 border-t border-gray-50">
                        <View className="flex-row items-start gap-3">
                          <View className="w-5 h-5 rounded-full bg-emerald-50 items-center justify-center mt-0.5">
                            <FontAwesome6 name="check" size={10} color="#10B981" />
                          </View>
                          <Text className="text-sm text-gray-600 leading-6 flex-1">
                            {faq.answer}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* ===== 反馈表单分区 ===== */}
          <View className="mb-4">
            <View className="flex-row items-center gap-2 mb-3">
              <View className="w-1 h-5 rounded-full bg-indigo-500" />
              <Text className="text-base font-bold text-gray-800">意见反馈</Text>
            </View>

            <View className="bg-white rounded-xl p-4 border border-gray-100">
              <Text className="text-xs font-medium text-gray-500 mb-2">
                反馈内容 <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-800 border border-gray-200 min-h-[120px]"
                placeholder="请详细描述您遇到的问题或建议..."
                placeholderTextColor="#CBD5E1"
                value={feedbackContent}
                onChangeText={setFeedbackContent}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />

              <Text className="text-xs font-medium text-gray-500 mb-2 mt-4">
                联系方式（可选）
              </Text>
              <TextInput
                className="bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-800 border border-gray-200"
                placeholder="邮箱或手机号，方便我们回复您"
                placeholderTextColor="#CBD5E1"
                value={contactInfo}
                onChangeText={setContactInfo}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <TouchableOpacity
                className={`mt-4 py-3 rounded-xl items-center flex-row justify-center gap-2 ${
                  submitting || !feedbackContent.trim()
                    ? "bg-gray-300"
                    : "bg-indigo-500"
                }`}
                onPress={submitFeedback}
                disabled={submitting || !feedbackContent.trim()}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <FontAwesome6 name="paper-plane" size={14} color="#fff" />
                )}
                <Text className="text-sm font-semibold text-white">
                  {submitting ? "提交中..." : "提交反馈"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 底部提示 */}
          <View className="bg-gray-50 rounded-xl p-4 mt-2">
            <View className="flex-row items-start gap-3">
              <FontAwesome6 name="clock" size={16} color="#9CA3AF" />
              <Text className="text-sm text-gray-500 flex-1 leading-5">
                我们通常会在 1-3 个工作日内回复您的反馈。紧急问题请通过客服邮箱 support@aiwenote.com 联系。
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}