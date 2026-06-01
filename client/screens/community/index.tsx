import { View, Text, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";

const POSTS = [
  { id: "1", user: "老作家小王", tag: "B 干货", title: "三万字首秀数据分享，给新人避坑", likes: 128, comments: 45, time: "2小时前", featured: true },
  { id: "2", user: "码字民工", tag: "W 技巧", title: "断章的艺术：如何让读者欲罢不能", likes: 89, comments: 23, time: "5小时前", featured: false },
  { id: "3", user: "新人求关注", tag: "Hand 互推", title: "奇幻题材新书《万界之主》求收藏", likes: 56, comments: 89, time: "昨天", featured: false },
];

const TAGS = ["B 全部", "W 写作技巧", "N 素材分享", "Hand 互推互评", "Q 求助提问"];

export default function CommunityScreen() {
  const router = useSafeRouter();

  return (
    <Screen>
      <ScrollView className="flex-1">
        {/* 顶部搜索 */}
        <View className="px-4 pt-2 pb-2">
          <View className="flex-row items-center gap-3 mb-4">
            <View className="flex-1 relative">
              <TextInput
                placeholder="搜索话题..."
                className="w-full px-4 py-3 rounded-xl text-sm bg-gray-100 text-gray-700 pl-10"
              />
              <Text className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">SE</Text>
            </View>
            <TouchableOpacity className="w-12 h-12 rounded-xl items-center justify-center" style={{ backgroundColor: "#6366F1" }}>
              <Text>E</Text>
            </TouchableOpacity>
          </View>

          {/* 标签页 */}
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 -mx-4 px-4">
              <View className="flex-row gap-2">
                {TAGS.map((tag, i) => (
                  <TouchableOpacity
                    key={tag}
                    className={`px-4 py-2 rounded-full ${i === 0 ? "bg-primary-500" : "bg-gray-100"}`}
                  >
                    <Text className={`text-xs font-medium ${i === 0 ? "text-white" : "text-gray-700"}`}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* 热门话题 */}
          <View className="bg-purple-50 rounded-2xl p-4 mb-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-xs text-ai-600 mb-1">Fire 热门话题</Text>
                <Text className="font-semibold text-gray-800">#三万字首秀经验分享</Text>
                <Text className="text-xs text-gray-500 mt-1">128人参与 · 45条讨论</Text>
              </View>
              <TouchableOpacity className="px-4 py-2 rounded-xl" style={{ backgroundColor: "#8B5CF6" }}>
                <Text className="text-white text-xs font-medium">加入</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 帖子列表 */}
        <View className="px-4 space-y-4 gap-4">
          {POSTS.map((post) => (
            <TouchableOpacity
              key={post.id}
              onPress={() => router.push("/post-detail")}
              className="bg-white rounded-2xl p-4"
              style={{
                shadowColor: "#6366F1",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 1,
              }}
            >
              <View className="flex-row items-start gap-3 mb-3">
                <View className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 items-center justify-center">
                  <Text className="text-white font-bold">{post.user[0]}</Text>
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm font-medium text-gray-800">{post.user}</Text>
                    {post.featured && (
                      <Text className="px-1.5 py-0.5 bg-yellow-100 text-yellow-600 text-[10px] rounded-full">精华</Text>
                    )}
                  </View>
                  <Text className="text-xs text-gray-400">{post.time}</Text>
                </View>
              </View>
              <Text className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-600 mb-2 overflow-hidden">
                {post.tag}
              </Text>
              <Text className="font-semibold text-gray-800 mb-2">{post.title}</Text>
              <View className="flex-row items-center gap-4 text-xs text-gray-500">
                <Text>L {post.likes}</Text>
                <Text>T {post.comments}</Text>
                <Text>F 收藏</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View className="h-8" />
      </ScrollView>
    </Screen>
  );
}