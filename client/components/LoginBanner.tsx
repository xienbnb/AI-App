/**
 * 全局登录提醒横幅
 *
 * 未登录时在页面顶部显示，提醒用户登录避免数据丢失
 *
 * @file /client/components/LoginBanner.tsx
 */
import React, { useState } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginBanner() {
  const { isAuthenticated, isLoading } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const router = useSafeRouter();

  if (isLoading || isAuthenticated || dismissed) return null;

  return (
    <View className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex-row items-center">
      <View className="w-8 h-8 rounded-full bg-amber-100 items-center justify-center mr-3">
        <FontAwesome6 name="circle-exclamation" size={16} color="#D97706" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-medium text-amber-800">
          您尚未登录
        </Text>
        <Text className="text-xs text-amber-600 mt-0.5 leading-4">
          若设备恢复出厂设置，本地数据将无法找回，建议立即登录
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => router.push("/login")}
        className="px-4 py-2 rounded-full bg-amber-500 mr-2"
      >
        <Text className="text-sm font-semibold text-white">登录</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setDismissed(true)}
        className="w-7 h-7 rounded-full items-center justify-center"
      >
        <FontAwesome6 name="xmark" size={14} color="#92400E" />
      </TouchableOpacity>
    </View>
  );
}