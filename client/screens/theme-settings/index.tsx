/**
 * 主题设置页面
 *
 * 提供主题选择功能：系统、浅色、深色、护眼(sepia)、绿色(green)
 * 每个主题以卡片预览形式展示，带有色彩样本
 * 从服务端获取/保存主题设置
 *
 * @file /client/screens/theme-settings/index.tsx
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Uniwind } from 'uniwind';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

const THEME_KEY = "user_theme";

// 将自定义主题映射到 Uniwind 支持的值
function mapToUniwindTheme(themeId: string): "system" | "light" | "dark" {
  switch (themeId) {
    case "dark": return "dark";
    case "sepia":
    case "green":
    case "light": return "light";
    default: return "system";
  }
}

interface ThemeOption {
  id: string;
  label: string;
  description: string;
  icon: string;
  colors: {
    primary: string;
    background: string;
    surface: string;
    text: string;
    accent: string;
  };
}

// 主题选项列表
const themeOptions: ThemeOption[] = [
  {
    id: "system",
    label: "跟随系统",
    description: "自动根据系统设置切换浅色/深色模式",
    icon: "mobile-screen-button",
    colors: {
      primary: "#4F46E5",
      background: "#F9FAFB",
      surface: "#FFFFFF",
      text: "#111827",
      accent: "#6366F1",
    },
  },
  {
    id: "light",
    label: "浅色模式",
    description: "明亮清晰的界面，适合日间使用",
    icon: "sun",
    colors: {
      primary: "#4F46E5",
      background: "#FFFFFF",
      surface: "#F3F4F6",
      text: "#111827",
      accent: "#6366F1",
    },
  },
  {
    id: "dark",
    label: "深色模式",
    description: "暗色背景，适合夜间阅读创作",
    icon: "moon",
    colors: {
      primary: "#818CF8",
      background: "#0F172A",
      surface: "#1E293B",
      text: "#F1F5F9",
      accent: "#A5B4FC",
    },
  },
  {
    id: "sepia",
    label: "护眼模式",
    description: "暖色纸张质感，保护眼睛",
    icon: "book",
    colors: {
      primary: "#8B6914",
      background: "#FBF0D9",
      surface: "#F5E6C8",
      text: "#5B4636",
      accent: "#A67B27",
    },
  },
  {
    id: "green",
    label: "绿色模式",
    description: "淡绿色背景，舒缓视觉疲劳",
    icon: "leaf",
    colors: {
      primary: "#059669",
      background: "#ECFDF5",
      surface: "#D1FAE5",
      text: "#064E3B",
      accent: "#10B981",
    },
  },
];

export default function ThemeSettingsPage() {
  const router = useSafeRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentTheme, setCurrentTheme] = useState("system");

  // 从服务端获取当前主题
  const fetchTheme = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("auth_token");
      if (!token) {
        setLoading(false);
        return;
      }
      const res = await fetch(`${API_BASE}/api/v1/users/theme`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.theme) {
        setCurrentTheme(json.theme);
      }
    } catch (e) {
      console.error("获取主题设置失败", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTheme();
  }, [fetchTheme]);

  // 选择主题并保存
  const selectTheme = useCallback(async (themeId: string) => {
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("auth_token");
      if (!token) {
        Alert.alert("提示", "请先登录");
        return;
      }
      const res = await fetch(`${API_BASE}/api/v1/users/theme`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ theme: themeId }),
      });
      const json = await res.json();
      if (json.success || json.theme) {
        setCurrentTheme(themeId);
        // 保存到本地并立即应用
        await AsyncStorage.setItem(THEME_KEY, themeId);
        Uniwind.setTheme(mapToUniwindTheme(themeId));
      } else {
        Alert.alert("保存失败", json.message || "请稍后重试");
      }
    } catch (e) {
      console.error("保存主题设置失败", e);
      Alert.alert("保存失败", "网络异常，请检查连接后重试");
    } finally {
      setSaving(false);
    }
  }, []);

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
          主题设置
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text className="text-sm text-gray-400 mt-3">加载中...</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>
          {/* 头部提示 */}
          <View className="items-center mb-6 mt-2">
            <View className="w-16 h-16 rounded-3xl items-center justify-center mb-3 bg-indigo-50">
              <FontAwesome6 name="palette" size={28} color="#4F46E5" />
            </View>
            <Text className="text-base font-bold text-gray-800">选择界面主题</Text>
            <Text className="text-xs text-gray-400 mt-1">自定义应用的外观风格</Text>
          </View>

          {/* 主题卡片列表 */}
          {themeOptions.map((theme) => {
            const isActive = currentTheme === theme.id;
            return (
              <TouchableOpacity
                key={theme.id}
                className={`mb-4 rounded-2xl overflow-hidden border-2 ${
                  isActive ? "border-indigo-500" : "border-transparent"
                }`}
                onPress={() => selectTheme(theme.id)}
                activeOpacity={0.8}
              >
                {/* 颜色预览区域 */}
                <View
                  className="p-4"
                  style={{ backgroundColor: theme.colors.background }}
                >
                  <View className="flex-row items-center gap-3 mb-3">
                    {/* 图标 */}
                    <View
                      className="w-12 h-12 rounded-xl items-center justify-center"
                      style={{ backgroundColor: theme.colors.surface }}
                    >
                      <FontAwesome6
                        name={theme.icon as any}
                        size={20}
                        color={theme.colors.primary}
                      />
                    </View>
                    <View className="flex-1">
                      <Text
                        className="text-base font-bold"
                        style={{ color: theme.colors.text }}
                      >
                        {theme.label}
                      </Text>
                      <Text
                        className="text-xs mt-0.5"
                        style={{ color: theme.colors.text + "99" }}
                      >
                        {theme.description}
                      </Text>
                    </View>
                    {isActive && (
                      <View
                        className="w-7 h-7 rounded-full items-center justify-center"
                        style={{ backgroundColor: theme.colors.primary }}
                      >
                        <FontAwesome6 name="check" size={12} color="#fff" />
                      </View>
                    )}
                  </View>

                  {/* 颜色样本条 */}
                  <View className="flex-row gap-2">
                    <View className="flex-1 h-8 rounded-lg items-center justify-center" style={{ backgroundColor: theme.colors.primary }}>
                      <Text className="text-[10px] font-medium text-white">主色</Text>
                    </View>
                    <View className="flex-1 h-8 rounded-lg items-center justify-center" style={{ backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.text + "20" }}>
                      <Text className="text-[10px] font-medium" style={{ color: theme.colors.text }}>表面</Text>
                    </View>
                    <View className="flex-1 h-8 rounded-lg items-center justify-center" style={{ backgroundColor: theme.colors.accent }}>
                      <Text className="text-[10px] font-medium text-white">强调</Text>
                    </View>
                  </View>

                  {/* 模拟文本行 */}
                  <View className="mt-3 gap-1.5">
                    <View className="h-2.5 rounded-full" style={{ backgroundColor: theme.colors.text + "30", width: "70%" }} />
                    <View className="h-2.5 rounded-full" style={{ backgroundColor: theme.colors.text + "20", width: "50%" }} />
                    <View className="h-2.5 rounded-full" style={{ backgroundColor: theme.colors.text + "15", width: "60%" }} />
                  </View>
                </View>

                {/* 底部标签 */}
                <View
                  className="py-2.5 px-4 flex-row items-center justify-between"
                  style={{ backgroundColor: theme.colors.surface }}
                >
                  <View className="flex-row items-center gap-1.5">
                    <FontAwesome6
                      name={theme.icon as any}
                      size={12}
                      color={theme.colors.primary}
                    />
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: theme.colors.primary }}
                    >
                      {theme.label}
                    </Text>
                  </View>
                  {isActive && (
                    <Text
                      className="text-xs"
                      style={{ color: theme.colors.primary }}
                    >
                      当前主题
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* 保存提示 */}
          <View className="bg-indigo-50 rounded-xl p-4 mt-2">
            <View className="flex-row items-start gap-3">
              <FontAwesome6 name="circle-info" size={16} color="#4F46E5" />
              <Text className="text-sm text-indigo-700 flex-1 leading-5">
                主题设置会自动保存。部分主题可能需要重启应用才能完全生效。
              </Text>
            </View>
          </View>
        </ScrollView>
      )}

      {/* 保存中遮罩 */}
      {saving && (
        <View className="absolute top-0 left-0 right-0 bottom-0 items-center justify-center bg-white/60">
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text className="text-sm text-gray-500 mt-2">保存中...</Text>
        </View>
      )}
    </Screen>
  );
}