import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome6 } from "@expo/vector-icons";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

interface Benefit {
  id: string;
  title: string;
  description: string;
  reward: number;
  icon: string;
  color: string;
  bg: string;
  type: "daily" | "achievement" | "bonus";
  claimed?: boolean;
  progress?: number;
  maxProgress?: number;
}

export default function WelfareScreen() {
  const router = useSafeRouter();
  const [benefits, setBenefits] = useState<Benefit[]>([
    {
      id: "daily_signin",
      title: "每日签到",
      description: "每天签到领取免费字数",
      reward: 500,
      icon: "calendar-check",
      color: "#4F46E5",
      bg: "#EEF2FF",
      type: "daily",
      claimed: false,
    },
    {
      id: "daily_write",
      title: "日写千字",
      description: "今日写作达到1000字",
      reward: 200,
      icon: "pen-nib",
      color: "#3B82F6",
      bg: "#EFF6FF",
      type: "daily",
      progress: 0,
      maxProgress: 1000,
    },
    {
      id: "first_chapter",
      title: "初出茅庐",
      description: "完成第一部作品的第一章",
      reward: 1000,
      icon: "star",
      color: "#F59E0B",
      bg: "#FFFBEB",
      type: "achievement",
      claimed: false,
    },
    {
      id: "ten_chapters",
      title: "笔耕不辍",
      description: "累计创作10个章节",
      reward: 2000,
      icon: "feather-pointed",
      color: "#10B981",
      bg: "#ECFDF5",
      type: "achievement",
      progress: 0,
      maxProgress: 10,
    },
    {
      id: "novice",
      title: "新人福利",
      description: "新用户注册7天内可领取",
      reward: 3000,
      icon: "gift",
      color: "#EC4899",
      bg: "#FDF2F8",
      type: "bonus",
      claimed: false,
    },
    {
      id: "share",
      title: "分享有礼",
      description: "分享作品给好友获得奖励",
      reward: 500,
      icon: "share-nodes",
      color: "#8B5CF6",
      bg: "#F5F3FF",
      type: "bonus",
      claimed: false,
    },
    {
      id: "invite",
      title: "邀请好友",
      description: "邀请好友注册双方各得奖励",
      reward: 2000,
      icon: "user-plus",
      color: "#EF4444",
      bg: "#FEF2F2",
      type: "bonus",
      claimed: false,
    },
    {
      id: "comment",
      title: "互动达人",
      description: "在社区获得50条评论",
      reward: 1000,
      icon: "comments",
      color: "#06B6D4",
      bg: "#ECFEFF",
      type: "achievement",
      progress: 0,
      maxProgress: 50,
    },
  ]);

  const handleClaim = (benefit: Benefit) => {
    if (benefit.claimed) {
      Alert.alert("已领取", "该奖励已经领取过了");
      return;
    }
    Alert.alert(
      "领取奖励",
      `${benefit.title}\n奖励：+${benefit.reward.toLocaleString()} 字数\n${benefit.description}`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "立即领取",
          onPress: () => {
            setBenefits((prev) =>
              prev.map((b) => (b.id === benefit.id ? { ...b, claimed: true } : b))
            );
            Alert.alert("领取成功", `恭喜获得 ${benefit.reward.toLocaleString()} 字数奖励！`);
          },
        },
      ]
    );
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "daily": return { text: "每日任务", color: "#4F46E5", bg: "#EEF2FF" };
      case "achievement": return { text: "成就", color: "#F59E0B", bg: "#FFFBEB" };
      case "bonus": return { text: "福利", color: "#EC4899", bg: "#FDF2F8" };
      default: return { text: type, color: "#6B7280", bg: "#F3F4F6" };
    }
  };

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
          <Text className="flex-1 text-center text-lg font-bold text-gray-900 mr-10">福利中心</Text>
        </View>
      </SafeAreaView>

      {/* 横幅 */}
      <View className="mx-4 mt-4 p-5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600">
        <View className="flex-row items-center">
          <FontAwesome6 name="gift" size={24} color="#fff" />
          <Text className="text-lg font-bold text-white ml-3">福利中心</Text>
        </View>
        <Text className="text-sm text-indigo-100 mt-2 leading-5">
          完成每日任务和成就挑战，赢取海量免费字数奖励！
        </Text>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 16, paddingBottom: 30 }}>
        {/* 按类型分组显示 */}
        {(["daily", "achievement", "bonus"] as const).map((type) => {
          const typeInfo = getTypeLabel(type);
          const items = benefits.filter((b) => b.type === type);
          if (items.length === 0) return null;

          return (
            <View key={type} className="mb-5">
              <View className="flex-row items-center mb-3 ml-1">
                <View className="w-1.5 h-5 rounded-full mr-2" style={{ backgroundColor: typeInfo.color }} />
                <Text className="text-sm font-semibold text-gray-700">{typeInfo.text}</Text>
              </View>

              {items.map((benefit) => {
                const isClaimed = benefit.claimed;
                const hasProgress = benefit.progress !== undefined && benefit.maxProgress !== undefined;
                const progressPercent = hasProgress ? Math.min((benefit.progress! / benefit.maxProgress!) * 100, 100) : 0;

                return (
                  <TouchableOpacity
                    key={benefit.id}
                    className="bg-white rounded-2xl p-4 mb-2.5 border border-gray-100"
                    activeOpacity={0.7}
                    onPress={() => handleClaim(benefit)}
                  >
                    <View className="flex-row items-center">
                      <View className="w-11 h-11 rounded-2xl items-center justify-center mr-4" style={{ backgroundColor: benefit.bg }}>
                        <FontAwesome6 name={benefit.icon as any} size={18} color={benefit.color} />
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-sm font-semibold text-gray-900">{benefit.title}</Text>
                          {isClaimed && (
                            <View className="px-2 py-0.5 rounded-full bg-green-50">
                              <Text className="text-[10px] font-medium text-green-600">已领取</Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-xs text-gray-400 mt-0.5">{benefit.description}</Text>
                        {hasProgress && (
                          <View className="mt-2">
                            <View className="flex-row items-center gap-2">
                              <View className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                <View
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${progressPercent}%`,
                                    backgroundColor: benefit.color,
                                  }}
                                />
                              </View>
                              <Text className="text-[10px] text-gray-400">
                                {benefit.progress}/{benefit.maxProgress}
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                      <View className="items-end ml-2">
                        <Text className="text-base font-bold" style={{ color: benefit.color }}>
                          +{benefit.reward.toLocaleString()}
                        </Text>
                        <TouchableOpacity
                          className={`mt-1 px-3 py-1.5 rounded-lg ${
                            isClaimed ? "bg-gray-100" : "bg-indigo-50"
                          }`}
                          onPress={() => handleClaim(benefit)}
                        >
                          <Text className={`text-[11px] font-medium ${isClaimed ? "text-gray-400" : "text-indigo-600"}`}>
                            {isClaimed ? "已领取" : "去领取"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}