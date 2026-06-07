import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome6 } from "@expo/vector-icons";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { useState } from "react";

const tutorials = [
  {
    id: "quick-start",
    icon: "rocket",
    title: "快速开始",
    color: "#4F46E5",
    steps: [
      "下载并安装AI创作助手App",
      "注册账号或使用游客模式",
      "点击底部「创作」进入编辑器",
      "选择新建书籍或导入现有作品",
    ],
  },
  {
    id: "writing",
    icon: "pen-fancy",
    title: "如何使用AI写作",
    color: "#3B82F6",
    steps: [
      "打开书籍后，点击「AI助手」按钮",
      "选择「续写」「扩写」或「灵感」模式",
      "输入提示词或选择创作方向",
      "AI会自动生成内容，可编辑后保存",
    ],
  },
  {
    id: "outline",
    icon: "list-tree",
    title: "大纲规划",
    color: "#10B981",
    steps: [
      "进入书籍详情页，点击「大纲」",
      "点击「+」按钮新建卷/章",
      "可输入每章的概要内容",
      "AI可以辅助生成大纲内容",
    ],
  },
  {
    id: "characters",
    icon: "users",
    title: "角色管理",
    color: "#F59E0B",
    steps: [
      "在书籍详情页点击「角色」",
      "点击「+」添加新角色",
      "填写角色姓名、性格、背景等",
      "AI会记住角色设定保持一致",
    ],
  },
  {
    id: "vip",
    icon: "crown",
    title: "VIP功能指南",
    color: "#EC4899",
    steps: [
      "成为VIP会员解锁所有高级功能",
      "每日领取免费字数额度",
      "使用充值中心购买额外字数",
      "VIP享有优先生成和更多模板",
    ],
  },
  {
    id: "sync",
    icon: "cloud-upload-alt",
    title: "数据同步与备份",
    color: "#8B5CF6",
    steps: [
      "所有数据自动同步至云端",
      "更换设备登录后数据自动恢复",
      "支持离线写作，联网自动同步",
      "重要章节建议手动备份",
    ],
  },
  {
    id: "export",
    icon: "file-export",
    title: "导出与发布",
    color: "#EF4444",
    steps: [
      "支持导出为TXT、Markdown格式",
      "可直接发布到社区与其他用户交流",
      "支持复制全文到剪贴板",
      "社区发布后可获得点赞和评论",
    ],
  },
];

export default function TutorialScreen() {
  const router = useSafeRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <View className="flex-1 bg-gray-50">
      <SafeAreaView edges={["top"]} className="bg-white">
        <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center rounded-full bg-gray-100"
          >
            <FontAwesome6 name="arrow-left" size={18} color="#374151" />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-lg font-bold text-gray-900 mr-10">操作教程</Text>
        </View>
      </SafeAreaView>

      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 30 }}>
        {tutorials.map((tutorial) => {
          const isExpanded = expandedId === tutorial.id;
          return (
            <TouchableOpacity
              key={tutorial.id}
              className="bg-white rounded-2xl mb-3 border border-gray-100 overflow-hidden"
              activeOpacity={0.7}
              onPress={() => setExpandedId(isExpanded ? null : tutorial.id)}
            >
              <View className="flex-row items-center px-5 py-4">
                <View
                  className="w-11 h-11 rounded-2xl items-center justify-center mr-4"
                  style={{ backgroundColor: `${tutorial.color}15` }}
                >
                  <FontAwesome6 name={tutorial.icon as any} size={18} color={tutorial.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900">{tutorial.title}</Text>
                  <Text className="text-xs text-gray-400 mt-0.5">
                    {isExpanded ? "点击收起" : "点击展开教程"}
                  </Text>
                </View>
                <FontAwesome6
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={14}
                  color="#9CA3AF"
                />
              </View>
              {isExpanded && (
                <View className="px-5 pb-5 pt-1 border-t border-gray-50">
                  {tutorial.steps.map((step, i) => (
                    <View key={i} className="flex-row items-start py-1.5">
                      <View className="w-6 h-6 rounded-full bg-indigo-50 items-center justify-center mr-3 mt-0.5">
                        <Text className="text-xs font-bold text-indigo-500">{i + 1}</Text>
                      </View>
                      <Text className="flex-1 text-sm text-gray-600 leading-5">{step}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        <View className="mt-4 items-center">
          <View className="bg-amber-50 rounded-2xl px-5 py-4 border border-amber-100 w-full">
            <View className="flex-row items-center mb-2">
              <FontAwesome6 name="circle-info" size={14} color="#D97706" />
              <Text className="text-xs font-medium text-amber-700 ml-2">小贴士</Text>
            </View>
            <Text className="text-xs text-amber-600 leading-5">
              更多教程和技巧正在持续更新中。如有任何疑问，请在「设置」中联系客服。
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}