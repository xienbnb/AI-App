/**
 * 隐私政策页面
 *
 * 展示应用的隐私政策详情，包括信息收集、使用、存储、共享等条款
 *
 * @file /client/screens/privacy/index.tsx
 */
import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Platform } from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";

const sections = [
  {
    title: "引言",
    content: "感谢您使用「AI 网文创作助手」（以下简称「本应用」）。我们深知个人信息对您的重要性，因此我们承诺严格遵守法律法规，保护您的个人信息安全。本隐私政策将详细说明我们在您使用本应用时如何收集、使用、存储和共享您的个人信息。",
  },
  {
    title: "一、我们收集的信息",
    content: "1.1 账号信息：您在注册或登录时提供的邮箱地址、手机号码、昵称和头像。\n1.2 创作内容：您在本应用中创建、编辑、保存的小说作品、大纲、角色设定、世界观设定等创作内容。\n1.3 使用数据：您的操作日志、功能使用频率、页面浏览记录、偏好设置等。\n1.4 设备信息：设备型号、操作系统版本、唯一设备标识符、IP地址等。\n1.5 AI交互数据：您与AI助手的对话内容、生成请求及反馈，用于优化AI服务质量。",
  },
  {
    title: "二、信息的使用",
    content: "2.1 为您提供小说创作、编辑、保存、分享等核心功能。\n2.2 基于您的创作内容和需求，提供AI续写、扩写、润色等智能辅助服务。\n2.3 优化和改善我们的产品和服务，提升用户体验。\n2.4 向您推送产品更新、功能通知和服务公告。\n2.5 进行数据分析和研究，以改进AI模型的创作辅助能力。",
  },
  {
    title: "三、信息的存储",
    content: "3.1 数据存储位置：您的数据存储于我们合作的云服务平台，位于中华人民共和国境内。\n3.2 存储期限：在您使用本应用期间，我们持续保存您的数据。账号注销后，我们将在30天内删除您的个人信息，创作内容将匿名化处理。\n3.3 数据安全：我们采用包括SSL加密传输、数据加密存储、访问权限控制在内的多层次安全措施保护您的数据。",
  },
  {
    title: "四、信息的共享",
    content: "4.1 我们不会将您的个人信息出售给第三方。\n4.2 在以下情况下，我们可能共享您的信息：\n   （a）获得您的明确同意；\n   （b）法律法规要求或行政机关、司法机关依法要求；\n   （c）为保护本应用的用户或其他个人的生命、财产等重大合法权益。\n4.3 我们可能聘请第三方服务提供商协助我们运营服务（如云存储、数据分析），这些第三方将受到严格的保密义务约束。",
  },
  {
    title: "五、您的权利",
    content: "5.1 访问权：您可以随时查看您的个人信息和创作内容。\n5.2 更正权：如发现个人信息有误，您可以随时更正。\n5.3 删除权：您可以删除您的创作内容，或申请注销账号。\n5.4 撤回同意权：您可以随时撤回对个人信息收集和使用的同意。\n5.5 数据可携权：您可以申请导出您的创作数据。\n5.6 如行使上述权利，请通过本政策末尾的联系方式与我们联系。",
  },
  {
    title: "六、未成年人保护",
    content: "6.1 本应用不建议未成年人独立使用。若您为未成年人，请在法定监护人的监护和指导下使用本应用。\n6.2 我们不会故意收集未成年人的个人信息。如发现我们无意中收集了未成年人的信息，我们会尽快删除。",
  },
  {
    title: "七、隐私政策的更新",
    content: "我们可能会不时更新本隐私政策。更新后的政策将在应用内公示，并在显著位置标明更新日期。如涉及重大变更，我们将通过弹窗或邮件等方式通知您。建议您定期查看本页面以了解最新信息。",
  },
  {
    title: "八、联系我们",
    content: "如果您对本隐私政策有任何疑问、意见或建议，请通过以下方式与我们联系：\n客服邮箱：privacy@aiwenote.com\n在线反馈：应用内「帮助与反馈」入口\n我们将在收到您的请求后15个工作日内回复。",
  },
];

export default function PrivacyPage() {
  const router = useSafeRouter();
  const [expandedSections, setExpandedSections] = useState<string[]>(["引言"]);

  const toggleSection = (title: string) => {
    setExpandedSections((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
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
          隐私政策
        </Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* 头部图标 */}
        <View className="items-center my-6">
          <View
            className="w-16 h-16 rounded-3xl items-center justify-center mb-3"
            style={{ backgroundColor: "#4F46E510" }}
          >
            <FontAwesome6 name="shield-halved" size={28} color="#4F46E5" />
          </View>
          <Text className="text-lg font-bold text-gray-800">隐私政策</Text>
          <Text className="text-xs text-gray-400 mt-1">最后更新：2026年6月</Text>
        </View>

        {/* 摘要 */}
        <View className="bg-indigo-50 rounded-2xl p-4 mb-5">
          <Text className="text-sm text-indigo-700 leading-5">
            我们重视您的隐私。本隐私政策说明了我们如何收集、使用和保护您的个人信息。请仔细阅读。
          </Text>
        </View>

        {/* 章节列表 */}
        {sections.map((section) => {
          const isExpanded = expandedSections.includes(section.title);
          return (
            <View key={section.title} className="mb-3">
              <TouchableOpacity
                className="flex-row items-center bg-white rounded-xl px-4 py-3.5"
                style={{
                  shadowColor: "#4F46E5",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                  elevation: 1,
                }}
                onPress={() => toggleSection(section.title)}
                activeOpacity={0.6}
              >
                <FontAwesome6
                  name={isExpanded ? "chevron-down" : "chevron-right"}
                  size={12}
                  color="#9CA3AF"
                />
                <Text className="flex-1 text-sm font-semibold text-gray-800 ml-3">
                  {section.title}
                </Text>
              </TouchableOpacity>

              {isExpanded && (
                <View className="mt-1.5 bg-white rounded-xl px-4 py-3.5">
                  <Text className="text-sm text-gray-600 leading-6">
                    {section.content}
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        {/* 底部提示 */}
        <View className="mt-6 items-center">
          <Text className="text-xs text-gray-400 text-center leading-5">
            如您继续使用本应用，即表示您同意本隐私政策的条款。{Platform.OS === "web" ? "\n" : ""}
            如果您不同意，请停止使用本应用。
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}