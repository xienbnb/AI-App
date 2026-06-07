import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";
import { useState } from "react";
import { FontAwesome6, MaterialCommunityIcons } from "@expo/vector-icons";

const TABS = ["关注", "广场", "作品展示", "投稿指南"];

const SAMPLE_POSTS = [
  {
    id: "1",
    userName: "创作达人",
    title: "如何写出吸引人的开篇",
    content: "一个好的开篇能在三秒内抓住读者。我总结了三种经典的开篇方式...",
    tag: "写作技巧",
    likes: 128,
    comments: 23,
  },
  {
    id: "2",
    userName: "素材君",
    title: "古风小说常用场景素材包",
    content: "整理了一些古风小说常用的场景描写素材，包括宫殿、庭院、战场等...",
    tag: "素材分享",
    likes: 89,
    comments: 15,
  },
  {
    id: "3",
    userName: "新手上路",
    title: "求大佬帮忙看看这段对话",
    content: "这段对话感觉很生硬，不知道怎么改，求大家指点...",
    tag: "求助提问",
    likes: 34,
    comments: 42,
  },
];

const SHOWCASE_ITEMS = [
  { title: "《剑镇山河》", author: "忘川", desc: "仙侠 · 124万字 · 连载中", stars: "⭐⭐⭐⭐" },
  { title: "《时光偷不走的梦》", author: "月下", desc: "都市 · 68万字 · 已完结", stars: "⭐⭐⭐⭐⭐" },
  { title: "《深渊之下》", author: "黑猫", desc: "悬疑 · 43万字 · 连载中", stars: "⭐⭐⭐⭐" },
];

export default function CommunityScreen() {
  const router = useSafeRouter();
  const [activeTab, setActiveTab] = useState(0);

  const showComingSoon = () => {
    Alert.alert("提示", "功能正在完善中，敬请期待");
  };

  const handlePostPress = () => {
    Alert.alert("提示", "功能正在完善中，敬请期待");
  };

  return (
    <Screen>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <TouchableOpacity onPress={() => router.back()}>
          <FontAwesome6 name="arrow-left" size={18} color="#6B7280" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900 dark:text-white">社区</Text>
        <TouchableOpacity onPress={showComingSoon}>
          <View className="bg-indigo-500 px-3 py-1.5 rounded-full">
            <Text className="text-white text-xs font-medium">发帖</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-gray-100 dark:border-gray-800">
        {TABS.map((tab, index) => (
          <TouchableOpacity
            key={tab}
            className={`flex-1 py-3 items-center ${activeTab === index ? "border-b-2 border-indigo-500" : ""}`}
            onPress={() => setActiveTab(index)}
          >
            <Text
              className={`text-sm ${activeTab === index ? "text-indigo-500 font-semibold" : "text-gray-500 dark:text-gray-400"}`}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* 关注 Tab */}
        {activeTab === 0 && (
          <View className="py-20 items-center">
            <MaterialCommunityIcons name="heart-outline" size={64} color="#D1D5DB" />
            <Text className="text-gray-400 mt-4 text-base">还没有关注任何人</Text>
            <Text className="text-gray-400 text-sm mt-1">去广场发现有趣的创作者吧</Text>
            <TouchableOpacity
              className="mt-4 bg-indigo-500 px-6 py-2.5 rounded-full"
              onPress={() => setActiveTab(1)}
            >
              <Text className="text-white font-medium">去广场看看</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 广场 Tab */}
        {activeTab === 1 && (
          <View>
            <View className="flex-row items-center justify-between mt-4 mb-3">
              <Text className="text-base font-semibold text-gray-800 dark:text-white">热门推荐</Text>
              <TouchableOpacity onPress={showComingSoon}>
                <Text className="text-indigo-500 text-sm">更多</Text>
              </TouchableOpacity>
            </View>
            {SAMPLE_POSTS.map((post) => (
              <TouchableOpacity
                key={post.id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-3 shadow-sm"
                onPress={handlePostPress}
              >
                <View className="flex-row items-center mb-2">
                  <View className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 items-center justify-center">
                    <Text className="text-indigo-600 dark:text-indigo-300 text-xs font-bold">
                      {post.userName[0]}
                    </Text>
                  </View>
                  <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-2">{post.userName}</Text>
                  <View className="ml-auto bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                    <Text className="text-xs text-gray-500 dark:text-gray-400">{post.tag}</Text>
                  </View>
                </View>
                <Text className="text-base font-semibold text-gray-900 dark:text-white mb-1">{post.title}</Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400 leading-5" numberOfLines={3}>
                  {post.content}
                </Text>
                <View className="flex-row items-center mt-3 pt-3 border-t border-gray-50 dark:border-gray-700">
                  <View className="flex-row items-center mr-4">
                    <FontAwesome6 name="heart" size={12} color="#EF4444" solid />
                    <Text className="text-xs text-gray-500 dark:text-gray-400 ml-1">{post.likes}</Text>
                  </View>
                  <View className="flex-row items-center mr-4">
                    <FontAwesome6 name="comment" size={12} color="#6B7280" />
                    <Text className="text-xs text-gray-500 dark:text-gray-400 ml-1">{post.comments}</Text>
                  </View>
                  <TouchableOpacity
                    className="ml-auto bg-amber-50 dark:bg-amber-900/30 px-3 py-1 rounded-full"
                    onPress={(e) => {
                      e.stopPropagation();
                      showComingSoon();
                    }}
                  >
                    <Text className="text-amber-600 dark:text-amber-400 text-xs font-medium">打赏 Token</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity className="py-4 items-center" onPress={showComingSoon}>
              <Text className="text-gray-400 text-sm">加载更多...</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 作品展示 Tab */}
        {activeTab === 2 && (
          <View className="pt-4">
            <Text className="text-base font-semibold text-gray-800 dark:text-white mb-3">精选作品</Text>
            {SHOWCASE_ITEMS.map((item, i) => (
              <TouchableOpacity
                key={i}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-3 shadow-sm"
                onPress={handlePostPress}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-base font-bold text-gray-900 dark:text-white">{item.title}</Text>
                    <Text className="text-sm text-gray-500 mt-1">{item.author} · {item.desc}</Text>
                    <Text className="text-sm mt-1">{item.stars}</Text>
                  </View>
                  <View className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 items-center justify-center">
                    <FontAwesome6 name="book" size={20} color="#6366F1" />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 投稿指南 Tab */}
        {activeTab === 3 && (
          <View className="pt-4 pb-8">
            <View className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm">
              <Text className="text-lg font-bold text-gray-900 dark:text-white mb-2">投稿指南</Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400 mb-4">让你的作品被更多人发现</Text>

              <View className="mb-4">
                <Text className="text-base font-semibold text-gray-800 dark:text-white mb-2">📝 基本要求</Text>
                <Text className="text-sm text-gray-600 dark:text-gray-400 leading-6">
                  • 作品须为原创，不得抄袭{'\n'}
                  • 内容健康向上，符合社区规范{'\n'}
                  • 建议配图增加吸引力{'\n'}
                  • 标题简洁明了，15字以内最佳
                </Text>
              </View>

              <View className="mb-4">
                <Text className="text-base font-semibold text-gray-800 dark:text-white mb-2">🏷️ 标签规范</Text>
                <Text className="text-sm text-gray-600 dark:text-gray-400 leading-6">
                  • 写作技巧：分享创作经验{'\n'}
                  • 素材分享：分享写作素材{'\n'}
                  • 互推互评：交换点评作品{'\n'}
                  • 求助提问：寻求创作建议
                </Text>
              </View>

              <View>
                <Text className="text-base font-semibold text-gray-800 dark:text-white mb-2">⭐ 推荐机制</Text>
                <Text className="text-sm text-gray-600 dark:text-gray-400 leading-6">
                  • 优质内容会推荐到「作品展示」{'\n'}
                  • 点赞和评论越多，曝光越高{'\n'}
                  • 活跃用户有机会获得官方推荐
                </Text>
              </View>
            </View>
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </Screen>
  );
}