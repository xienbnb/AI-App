import { View, Text, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";

export default function PostDetailScreen() {
  const router = useSafeRouter();

  return (
    <Screen>
      <ScrollView className="flex-1">
        <View className="px-4 pt-2">
          {/* 用户信息 */}
          <View className="flex-row items-center gap-3 mb-4">
            <View className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 items-center justify-center">
              <Text className="text-white font-bold">TA</Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-800">老作家小王</Text>
              <Text className="text-xs text-gray-400">2小时前</Text>
            </View>
            <TouchableOpacity className="px-3 py-1 bg-primary-500/10 rounded-full">
              <Text className="text-primary-500 text-xs font-medium">+ 关注</Text>
            </TouchableOpacity>
          </View>

          <Text className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-600 mb-2 overflow-hidden">
            B 干货
          </Text>
          <Text className="text-lg font-bold text-gray-800 mb-3">
            三万字首秀数据分享，给新人避坑
          </Text>

          <View className="text-sm leading-relaxed space-y-3 mb-4 gap-3">
            <Text className="text-gray-600 leading-relaxed">
              今天三万字首秀终于出数据了，给大家分享一下经验，希望能帮到新人朋友们。
            </Text>
            <Text className="text-gray-600 leading-relaxed">
              <Text className="font-bold text-gray-800">D 首秀数据：</Text>
              {"\n"}阅读完成率65%，追读率28%，书架转化率12%
            </Text>
            <Text className="text-gray-600 leading-relaxed">
              <Text className="font-bold text-gray-800">I 避坑点1：</Text>
              黄金三章必须有冲突！我前两章铺垫太长，第三章才来高潮，导致很多人没看到就走了。
            </Text>
            <Text className="text-gray-600 leading-relaxed">
              <Text className="font-bold text-gray-800">I 避坑点2：</Text>
              每章结尾必须断章！不要觉得不好意思，读者就是吃这套的。
            </Text>
            <Text className="text-gray-600 leading-relaxed">大家加油！码字路上一起进步 P</Text>
          </View>
        </View>

        {/* 互动栏 */}
        <View className="flex-row items-center justify-around py-4 mx-4 border-y border-gray-100 mb-4">
          <TouchableOpacity className="items-center gap-1">
            <Text className="text-lg">L</Text>
            <Text className="text-xs text-gray-500">128</Text>
          </TouchableOpacity>
          <TouchableOpacity className="items-center gap-1">
            <Text className="text-lg">T</Text>
            <Text className="text-xs text-gray-500">45</Text>
          </TouchableOpacity>
          <TouchableOpacity className="items-center gap-1">
            <Text className="text-lg">F</Text>
            <Text className="text-xs text-gray-500">67</Text>
          </TouchableOpacity>
          <TouchableOpacity className="items-center gap-1">
            <Text className="text-lg">U</Text>
            <Text className="text-xs text-gray-500">分享</Text>
          </TouchableOpacity>
        </View>

        {/* 评论 */}
        <View className="px-4 mb-4">
          <Text className="text-sm font-semibold text-gray-800 mb-3">
            T 热门评论 (45)
          </Text>
          <View className="space-y-4 gap-4">
            <View className="flex-row gap-3">
              <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center">
                <Text className="text-xs font-bold text-blue-600">新</Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-gray-700">
                  <Text className="font-medium">新人报道：</Text>
                  太有用了！我的首秀追读才15%C
                </Text>
                <Text className="text-xs text-gray-400 mt-1">1小时前 V 32</Text>
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="w-8 h-8 rounded-full bg-green-100 items-center justify-center">
                <Text className="text-xs font-bold text-green-600">老</Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-gray-700">
                  <Text className="font-medium">老作家小王：</Text>
                  补充一点，开头必须把主角的目标说清楚！
                </Text>
                <Text className="text-xs text-gray-400 mt-1">30分钟前 V 18</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 评论输入 */}
        <View className="px-4 py-3 border-t border-gray-100 bg-white">
          <View className="flex-row items-center gap-2">
            <TextInput
              placeholder="写下你的评论..."
              className="flex-1 px-4 py-3 rounded-full text-sm bg-gray-100 text-gray-700"
            />
            <TouchableOpacity
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{ backgroundColor: "#6366F1" }}
            >
              <Text>U</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="h-8" />
      </ScrollView>
    </Screen>
  );
}