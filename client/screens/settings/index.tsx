import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome6 } from "@expo/vector-icons";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { useAuth } from "@/contexts/AuthContext";

interface SettingsItemProps {
  icon: string;
  label: string;
  description?: string;
  onPress: () => void;
  showArrow?: boolean;
  danger?: boolean;
}

function SettingsItem({
  icon,
  label,
  description,
  onPress,
  showArrow = true,
  danger = false,
}: SettingsItemProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center px-5 py-4 bg-white active:bg-gray-50"
    >
      <View className="w-9 h-9 rounded-xl items-center justify-center bg-gray-100 mr-4">
        <FontAwesome6
          name={icon as any}
          size={18}
          color={danger ? "#ef4444" : "#6366f1"}
        />
      </View>
      <View className="flex-1">
        <Text
          className={`text-base font-medium ${
            danger ? "text-red-500" : "text-gray-900"
          }`}
        >
          {label}
        </Text>
        {description && (
          <Text className="text-xs text-gray-400 mt-0.5">{description}</Text>
        )}
      </View>
      {showArrow && (
        <FontAwesome6
          name="chevron-right"
          size={14}
          color="#d1d5db"
        />
      )}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useSafeRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert("退出账号", "确定要退出当前账号吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "退出",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  const handleSwitchAccount = () => {
    Alert.alert("切换账号", "切换账号将退出当前登录，是否继续？", [
      { text: "取消", style: "cancel" },
      {
        text: "切换",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <SafeAreaView edges={["top"]} className="bg-white">
        <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center rounded-full bg-gray-100"
          >
            <FontAwesome6 name="arrow-left" size={18} color="#374151" />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-lg font-bold text-gray-900 mr-10">
            设置
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 用户信息摘要 */}
        <View className="mx-4 mt-4 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <View className="flex-row items-center">
            <View className="w-14 h-14 rounded-full bg-indigo-100 items-center justify-center">
              <Text className="text-xl font-bold text-indigo-600">
                {user?.nickname?.charAt(0) || "用"}
              </Text>
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-lg font-bold text-gray-900">
                {user?.nickname || "用户"}
              </Text>
              <Text className="text-sm text-gray-400 mt-1">
                {user?.email || "未绑定"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/user-profile")}
              className="px-4 py-2 rounded-full bg-indigo-50"
            >
              <Text className="text-sm font-medium text-indigo-600">编辑</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 账号与安全 */}
        <View className="mx-4 mt-6">
          <Text className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-1">
            账号与安全
          </Text>
          <View className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <SettingsItem
              icon="user"
              label="个人信息"
              description="修改头像、昵称、手机号等"
              onPress={() => router.push("/user-profile")}
            />
            <View className="h-px bg-gray-50 ml-[72px]" />
            <SettingsItem
              icon="lock"
              label="账号与安全"
              description="密码、登录方式管理"
              onPress={() => {
                Alert.alert(
                  "账号与安全",
                  "密码修改、登录方式等功能开发中，敬请期待"
                );
              }}
            />
          </View>
        </View>

        {/* 通用设置 */}
        <View className="mx-4 mt-6">
          <Text className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-1">
            通用设置
          </Text>
          <View className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <SettingsItem
              icon="bell"
              label="通知设置"
              description="管理消息推送通知"
              onPress={() => {
                Alert.alert(
                  "通知设置",
                  "通知推送功能开发中，敬请期待"
                );
              }}
            />
            <View className="h-px bg-gray-50 ml-[72px]" />
            <SettingsItem
              icon="palette"
              label="界面与显示"
              description="主题、字体、布局设置"
              onPress={() => router.push("/theme-settings")}
            />
          </View>
        </View>

        {/* 其他 */}
        <View className="mx-4 mt-6">
          <Text className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-1">
            其他
          </Text>
          <View className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <SettingsItem
              icon="arrow-right-from-bracket"
              label="切换账号"
              description="切换到其他账号"
              onPress={handleSwitchAccount}
            />
            <View className="h-px bg-gray-50 ml-[72px]" />
            <SettingsItem
              icon="right-from-bracket"
              label="退出账号"
              onPress={handleLogout}
              showArrow={false}
              danger
            />
          </View>
        </View>

        {/* 版本信息 */}
        <Text className="text-center text-xs text-gray-300 mt-8">
          App Version 1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}