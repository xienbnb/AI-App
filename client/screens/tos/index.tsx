/**
 * 服务条款页面
 *
 * 展示应用的服务条款详情，包括用户权利与义务、知识产权、免责声明等内容
 *
 * @file /workspace/projects/client/screens/tos/index.tsx
 */
import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";

const sections = [
  {
    title: "引言",
    content: "欢迎使用「 AI 网文创作助手」（以下简称「本应用」）。本服务条款（以下简称「本条款」）是您与本应用运营方之间关于使用本应用服务的协议。请您在使用本应用前仔细阅读并充分理解本条款的全部内容。您开始使用本应用即视为您已充分阅读、理解并接受本条款。",
  },
  {
    title: "一、服务说明",
    content: "1.1 本应用提供以下服务：小说创作与编辑、AI辅助写作（续写/扩写/润色）、作品管理与发布、创作社区交流、数据分析统计等。\n1.2 我们有权根据业务发展需要调整、增减或暂停部分服务，并将在应用内提前公示。\n1.3 部分高级功能可能需要付费订阅，具体以应用内展示的定价为准。",
  },
  {
    title: "二、用户账号",
    content: "2.1 您需要注册账号才能使用本应用的全部功能。注册时请提供真实、准确的信息。\n2.2 您对账号下的所有行为负责，请妥善保管账号信息。因账号密码泄露导致的损失由您自行承担。\n2.3 如发现账号被盗用，请立即通知我们。\n2.4 您有权随时注销账号，注销后我们将按规定删除您的个人信息。",
  },
  {
    title: "三、用户行为规范",
    content: "3.1 您承诺遵守法律法规，不利用本应用从事违法违规活动。\n3.2 您不得创作、发布包含以下内容的作品：\n   （a）违反宪法基本原则或法律法规的；\n   （b）危害国家安全、泄露国家秘密的；\n   （c）色情、淫秽、暴力、赌博、毒品等违法内容的；\n   （d）诽谤、侮辱他人或侵犯他人合法权益的；\n   （e）其他法律法规禁止的内容。\n3.3 您不得利用技术手段干扰本应用的正常运行，包括但不限于爬取数据、攻击服务器等。",
  },
  {
    title: "四、知识产权",
    content: "4.1 您在本应用内创作的文字作品（小说、大纲、角色设定等）的知识产权归您所有。\n4.2 您授予我们在应用范围内展示、存储、备份您作品的许可，以便为您提供服务。\n4.3 本应用的软件、界面设计、图标、品牌标识等知识产权归运营方所有。\n4.4 AI辅助生成的内容，其权利归属以现行法律法规为准。",
  },
  {
    title: "五、AI服务条款",
    content: "5.1 本应用的AI写作辅助功能基于大语言模型技术，生成的内容仅供参考和辅助创作。\n5.2 AI生成的内容可能存在不准确、不完整或不符合预期的情况，您应在使用前自行判断和修改。\n5.3 您不得利用AI功能批量生成低质量、重复或侵权内容。\n5.4 我们保留对AI使用行为进行监控和限制的权利，以防止滥用。\n5.5 您与AI助手的对话内容将用于改进服务质量，详见隐私政策。",
  },
  {
    title: "六、付费服务",
    content: "6.1 付费订阅一经购买，即开通相应服务权限。\n6.2 虚拟商品（如会员、AI额度）一旦使用，不支持退款。如因本应用原因导致服务无法正常使用的，我们将酌情处理。\n6.3 我们有权调整服务价格，调整前将在应用内公示。已生效的订阅不受价格调整影响。",
  },
  {
    title: "七、免责声明",
    content: "7.1 本应用按「现状」提供服务，不保证服务完全无中断或无误。\n7.2 因不可抗力（如自然灾害、战争、政府行为等）导致服务中断的，我们不承担责任。\n7.3 对于因您违反本条款而导致的任何损失，我们不承担责任。\n7.4 AI生成内容仅供参考，我们不保证其准确性、完整性和适用性。",
  },
  {
    title: "八、条款变更",
    content: "我们可能会不时修改本条款。修改后的条款将在应用内公示。如您不同意修改后的条款，请停止使用本应用。继续使用即视为接受修改后的条款。",
  },
  {
    title: "九、法律适用与争议解决",
    content: "9.1 本条款适用中华人民共和国法律。\n9.2 因本条款引起的或与之相关的争议，双方应首先友好协商解决；协商不成的，任何一方均可向运营方所在地有管辖权的人民法院提起诉讼。",
  },
  {
    title: "十、联系方式",
    content: "如您对本条款有任何疑问，请通过以下方式联系我们：\n客服邮箱：support@aiwenote.com\n在线反馈：应用内「帮助与反馈」入口\n我们将在收到您的请求后15个工作日内回复。",
  },
];

export default function TosPage() {
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
          服务条款
        </Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* 头部图标 */}
        <View className="items-center my-6">
          <View
            className="w-16 h-16 rounded-3xl items-center justify-center mb-3"
            style={{ backgroundColor: "#4F46E510" }}
          >
            <FontAwesome6 name="file-contract" size={28} color="#4F46E5" />
          </View>
          <Text className="text-lg font-bold text-gray-800">服务条款</Text>
          <Text className="text-xs text-gray-400 mt-1">最后更新：2026年6月</Text>
        </View>

        {/* 摘要 */}
        <View className="bg-indigo-50 rounded-2xl p-4 mb-5">
          <Text className="text-sm text-indigo-700 leading-5">
            欢迎使用 AI 网文创作助手。请仔细阅读以下服务条款，使用本应用即表示您同意遵守本条款。
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
            如您继续使用本应用，即表示您同意本服务条款的全部内容。
            如果您不同意，请停止使用本应用。
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}