/**
 * 关于页面
 *
 * 展示应用名称、图标、版本号、检查更新入口和简要描述
 *
 * @file /client/screens/about/index.tsx
 */
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";

export default function AboutPage() {
  const router = useSafeRouter();
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const appVersion = "v1.0.0";
  const buildNumber = "2024060101";

  // 检查更新
  const checkForUpdates = () => {
    setCheckingUpdate(true);
    // 模拟检查更新过程
    setTimeout(() => {
      setCheckingUpdate(false);
      Alert.alert(
        "检查更新",
        "当前已是最新版本 " + appVersion,
        [{ text: "知道了" }]
      );
    }, 1500);
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
          关于应用
        </Text>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* 应用图标和名称 */}
        <View className="items-center my-8">
          {/* 应用图标 */}
          <View className="w-24 h-24 rounded-3xl items-center justify-center mb-4 bg-indigo-500"
            style={{
              shadowColor: "#4F46E5",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            <FontAwesome6 name="pen-fancy" size={40} color="#fff" />
          </View>
          <Text className="text-2xl font-bold text-gray-800">AI 网文创作助手</Text>
          <Text className="text-sm text-gray-400 mt-1.5">
            版本 {appVersion} (Build {buildNumber})
          </Text>
        </View>

        {/* 应用描述 */}
        <View className="bg-indigo-50 rounded-2xl p-5 mb-6">
          <Text className="text-sm text-indigo-700 leading-6">
            AI 网文创作助手是一款专为网络文学创作者打造的智能写作工具。
            集成多种大语言模型，提供从世界观构建、角色设定、大纲规划到正文生成的全流程AI辅助创作服务。
            支持AI续写、扩写、润色、逻辑校验等多种创作技能，帮助创作者提升写作效率和质量。
          </Text>
        </View>

        {/* 检查更新按钮 */}
        <TouchableOpacity
          className="bg-white rounded-xl p-4 mb-6 border border-gray-100 flex-row items-center"
          onPress={checkForUpdates}
          disabled={checkingUpdate}
          activeOpacity={0.7}
        >
          <View className="w-10 h-10 rounded-xl items-center justify-center mr-3 bg-blue-50">
            <FontAwesome6 name="cloud-arrow-up" size={18} color="#3B82F6" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-gray-800">检查更新</Text>
            <Text className="text-xs text-gray-400 mt-0.5">当前版本 {appVersion}</Text>
          </View>
          {checkingUpdate ? (
            <ActivityIndicator size="small" color="#3B82F6" />
          ) : (
            <FontAwesome6 name="chevron-right" size={12} color="#CBD5E1" />
          )}
        </TouchableOpacity>

        {/* 应用信息列表 */}
        <View className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-6">
          {[
            { icon: "file-contract", label: "服务条款", color: "#8B5CF6", onPress: () => router.push("/tos") },
            { icon: "shield-halved", label: "隐私政策", color: "#3B82F6", onPress: () => router.push("/privacy") },
            { icon: "copyright", label: "版权信息", color: "#6B7280", detail: "© 2026 AI 网文创作助手" },
          ].map((item, index) => (
            <TouchableOpacity
              key={item.label}
              className={`flex-row items-center px-4 py-3.5 ${
                index !== 2 ? "border-b border-gray-50" : ""
              }`}
              onPress={item.onPress}
              activeOpacity={item.onPress ? 0.6 : 1}
            >
              <View
                className="w-8 h-8 rounded-xl items-center justify-center mr-3"
                style={{ backgroundColor: `${item.color}15` }}
              >
                <FontAwesome6 name={item.icon as any} size={14} color={item.color} />
              </View>
              <Text className="flex-1 text-sm font-medium text-gray-800">{item.label}</Text>
              {"detail" in item ? (
                <Text className="text-xs text-gray-400">{item.detail}</Text>
              ) : (
                <FontAwesome6 name="chevron-right" size={12} color="#CBD5E1" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* 技术栈信息 */}
        <View className="bg-gray-50 rounded-xl p-4 mb-6">
          <Text className="text-xs font-semibold text-gray-400 mb-2">技术信息</Text>
          <View className="flex-row flex-wrap gap-2">
            {[
              { name: "React Native", color: "#61DAFB" },
              { name: "Expo", color: "#000" },
              { name: "Uniwind", color: "#4F46E5" },
              { name: "FontAwesome", color: "#528DD7" },
            ].map((tech) => (
              <View
                key={tech.name}
                className="px-3 py-1.5 rounded-full bg-white border border-gray-200"
              >
                <Text className="text-xs font-medium text-gray-600">{tech.name}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 底部版权 */}
        <View className="items-center">
          <Text className="text-xs text-gray-400">
            Made with ❤️ for writers everywhere
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}