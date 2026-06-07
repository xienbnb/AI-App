import { useState, useCallback, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, Platform } from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

function formatWordCount(count: number) {
  if (count >= 10000) return (count / 10000).toFixed(1) + "万";
  if (count >= 1000) return (count / 1000).toFixed(1) + "k";
  return count.toString();
}

export default function ProfileScreen() {
  const router = useSafeRouter();
  const { isAuthenticated, user, logout } = useAuth();
  const [bookCount, setBookCount] = useState(0);
  const [totalWords, setTotalWords] = useState(0);
  const [consecutiveDays, setConsecutiveDays] = useState(0);
  const [todayWords, setTodayWords] = useState(0);
  const [vipLevel, setVipLevel] = useState(0);
  const [vipPlanName, setVipPlanName] = useState('');
  const [dailyAiCount, setDailyAiCount] = useState(0);
  const [usedDailyAi, setUsedDailyAi] = useState(0);
  const [showDataStats, setShowDataStats] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["x-session"] = token;
      const res = await fetch(`${API_BASE}/api/v1/users/stats`, { headers });
      const json = await res.json();
      if (json.bookCount !== undefined) {
        setBookCount(json.bookCount);
        setTotalWords(json.totalWords);
        setConsecutiveDays(json.consecutiveDays || 0);
        setTodayWords(json.todayWords || 0);
      }
    } catch (e) {
      console.error("获取统计数据失败", e);
    }
  }, []);

  const fetchVipInfo = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["x-session"] = token;
      const res = await fetch(`${API_BASE}/api/v1/vip/info`, { headers });
      const json = await res.json();
      if (json.success && json.data) {
        setVipLevel(json.data.vipLevel ?? 0);
        setVipPlanName(json.data.planName || '');
        setDailyAiCount(json.data.dailyAiCount ?? 0);
        setUsedDailyAi(json.data.usedDailyAi ?? 0);
      } else if (json.vipLevel !== undefined) {
        setVipLevel(json.vipLevel);
        setVipPlanName(json.planName || '');
        setDailyAiCount(json.dailyAiCount ?? 0);
        setUsedDailyAi(json.usedDailyAi ?? 0);
      }
    } catch (e) {
      console.error("获取VIP信息失败", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
      fetchVipInfo();
    }, [fetchStats, fetchVipInfo])
  );

  const settingsSections = [
    {
      title: "会员特权",
      items: [
        { icon: "crown", label: "会员中心", color: "#F59E0B", onPress: () => router.push("/vip") },
      ],
    },
    {
      title: "创作工具",
      items: [
        { icon: "sliders", label: "AI模型设置", color: "#8B5CF6", onPress: () => router.push("/my-ai-settings") },
        { icon: "chart-simple", label: "数据统计", color: "#3B82F6", onPress: () => setShowDataStats(true) },
      ],
    },
    {
      title: "系统设置",
      items: [
        { icon: "gear", label: "设置", color: "#6B7280", onPress: () => router.push("/settings") },
        ...(isAuthenticated
          ? [{ icon: "right-from-bracket", label: "退出登录", color: "#EF4444", isLogout: true } as const]
          : []),
      ],
    },
  ];

  return (
    <Screen>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ===== 用户信息卡（可点击进入主页） ===== */}
        <TouchableOpacity
          className="mx-4 rounded-3xl p-6 mt-4 mb-5"
          activeOpacity={0.8}
          onPress={() => router.push("/user-profile")}
          style={{
            backgroundColor: "#4F46E5",
            shadowColor: "#4F46E5",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 16,
            elevation: 10,
          }}
        >
          <View className="flex-row items-center gap-4 mb-5">
            <View className="w-16 h-16 rounded-2xl bg-white/20 items-center justify-center">
              {user?.avatar ? (
                <View className="w-16 h-16 rounded-2xl overflow-hidden">
                  <img src={user.avatar} style={{ width: 64, height: 64 }} alt="avatar" />
                </View>
              ) : (
                <FontAwesome6 name="user" size={28} color="#fff" />
              )}
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-xl font-bold text-white">{user?.nickname || "码字达人"}</Text>
                {vipLevel > 0 && (
                  <View className="bg-yellow-400/30 rounded-full px-2 py-0.5">
                    <Text className="text-[10px] font-bold text-yellow-200">{vipPlanName}</Text>
                  </View>
                )}
              </View>
              <Text className="text-sm text-white/70 mt-0.5">{bookCount} 部作品 · {consecutiveDays} 天连续</Text>
              {dailyAiCount > 0 && (
                <Text className="text-xs text-white/50 mt-0.5">AI次数 {usedDailyAi}/{dailyAiCount}</Text>
              )}
            </View>
            <View className="bg-white/20 rounded-full p-2.5">
              <FontAwesome6 name="chevron-right" size={14} color="#fff" />
            </View>
          </View>

          <View className="flex-row justify-between bg-white/10 rounded-2xl p-4">
            <View className="items-center flex-1">
              <Text className="text-2xl font-bold text-white">{bookCount}</Text>
              <Text className="text-xs text-white/70 mt-1">作品</Text>
            </View>
            <View className="w-px bg-white/15" />
            <View className="items-center flex-1">
              <Text className="text-2xl font-bold text-white">{formatWordCount(totalWords)}</Text>
              <Text className="text-xs text-white/70 mt-1">总字数</Text>
            </View>
            <View className="w-px bg-white/15" />
            <View className="items-center flex-1">
              <Text className="text-2xl font-bold text-white">{consecutiveDays}</Text>
              <Text className="text-xs text-white/70 mt-1">连续天数</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* ===== 快捷入口 ===== */}
        <View className="mx-4 mb-5">
          <View className="flex-row gap-3">
            {[
              { icon: "pen-to-square", label: "今日写作", color: "#4F46E5", count: `${todayWords}字` },
              { icon: "lightbulb", label: "数据统计", color: "#F59E0B", count: "查看", onPress: () => setShowDataStats(true) },
              { icon: "award", label: "成就徽章", color: "#EC4899", count: `${consecutiveDays}天` },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                className="flex-1 bg-white rounded-2xl p-3.5 items-center"
                onPress={(item as any).onPress}
                style={{
                  shadowColor: "#4F46E5",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 8,
                  elevation: 1,
                }}
              >
                <View className="w-9 h-9 rounded-xl items-center justify-center mb-2" style={{ backgroundColor: `${item.color}15` }}>
                  <FontAwesome6 name={item.icon as any} size={16} color={item.color} />
                </View>
                <Text className="text-xs font-medium text-gray-800">{item.label}</Text>
                <Text className="text-[10px] text-gray-400 mt-0.5">{item.count}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ===== 人设守护 ===== */}
        <View
          className="mx-4 bg-white rounded-2xl p-4 mb-5"
          style={{
            shadowColor: "#4F46E5",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 1,
          }}
        >
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: "#4F46E515" }}>
              <FontAwesome6 name="shield" size={18} color="#4F46E5" />
            </View>
            <View>
              <Text className="font-semibold text-gray-800">人设守护</Text>
              <Text className="text-xs text-gray-400 mt-0.5">保持角色设定一致性</Text>
            </View>
          </View>
        </View>

        {/* ===== 设置分区 ===== */}
        {settingsSections.map((section) => (
          <View key={section.title} className="mx-4 mb-4">
            <Text className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2.5 ml-1">
              {section.title}
            </Text>
            <View
              className="bg-white rounded-2xl overflow-hidden"
              style={{
                shadowColor: "#4F46E5",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 1,
              }}
            >
              {section.items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  className={`flex-row items-center px-4 py-3.5 ${i !== section.items.length - 1 ? "border-b border-gray-50" : ""}`}
                  onPress={() => {
                    if ((item as any).isLogout) {
                      setShowLogoutModal(true);
                    } else {
                      (item as any).onPress?.();
                    }
                  }}
                  activeOpacity={0.6}
                >
                  <View className="w-8 h-8 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: `${item.color}15` }}>
                    <FontAwesome6 name={item.icon as any} size={14} color={item.color} />
                  </View>
                  <Text className="flex-1 text-sm font-medium text-gray-800">{item.label}</Text>
                  <FontAwesome6 name="chevron-right" size={12} color="#CBD5E1" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* ===== 数据统计弹窗 ===== */}
      <Modal visible={showDataStats} transparent animationType="slide">
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => setShowDataStats(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => undefined}>
            <View className="flex-1 justify-end">
              <View
                className="bg-white rounded-3xl p-6 mx-4 mb-10"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: -4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 20,
                  elevation: 20,
                }}
              >
                <View className="flex-row items-center justify-between mb-5">
                  <Text className="text-lg font-bold text-gray-800">数据统计</Text>
                  <TouchableOpacity onPress={() => setShowDataStats(false)}>
                    <FontAwesome6 name="xmark" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                <View className="flex-row flex-wrap gap-3 mb-5">
                  {[
                    { label: "作品数", value: bookCount.toString(), color: "#4F46E5", icon: "book" },
                    { label: "总字数", value: formatWordCount(totalWords), color: "#3B82F6", icon: "pen" },
                    { label: "连续天数", value: consecutiveDays.toString(), color: "#10B981", icon: "fire" },
                    { label: "今日写作", value: todayWords.toString(), color: "#F59E0B", icon: "clock" },
                  ].map((stat) => (
                    <View
                      key={stat.label}
                      className="w-[47%] bg-gray-50 rounded-2xl p-4"
                    >
                      <View className="w-9 h-9 rounded-xl items-center justify-center mb-3" style={{ backgroundColor: `${stat.color}15` }}>
                        <FontAwesome6 name={stat.icon as any} size={16} color={stat.color} />
                      </View>
                      <Text className="text-2xl font-bold text-gray-800">{stat.value}</Text>
                      <Text className="text-xs text-gray-400 mt-1">{stat.label}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  className="py-3 rounded-xl items-center"
                  style={{ backgroundColor: "#F3F4F6" }}
                  onPress={() => setShowDataStats(false)}
                >
                  <Text className="text-sm font-medium text-gray-600">关闭</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ===== 退出登录确认弹窗 ===== */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => setShowLogoutModal(false)}
        >
          <View className="flex-1 items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
            <TouchableOpacity activeOpacity={1} onPress={() => undefined}>
              <View
                className="bg-white rounded-3xl p-6 mx-8 w-72"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.15,
                  shadowRadius: 24,
                  elevation: 20,
                }}
              >
                <View className="w-12 h-12 rounded-2xl bg-red-50 items-center justify-center self-center mb-4">
                  <FontAwesome6 name="right-from-bracket" size={20} color="#EF4444" />
                </View>
                <Text className="text-lg font-bold text-gray-800 text-center mb-2">退出登录</Text>
                <Text className="text-sm text-gray-500 text-center mb-6">确定要退出登录吗？</Text>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    className="flex-1 py-3 rounded-xl items-center"
                    style={{ backgroundColor: "#F3F4F6" }}
                    onPress={() => setShowLogoutModal(false)}
                  >
                    <Text className="text-sm font-medium text-gray-600">取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 py-3 rounded-xl items-center"
                    style={{ backgroundColor: "#EF4444" }}
                    onPress={async () => {
                      setShowLogoutModal(false);
                      try {
                        await logout();
                        router.replace("/login");
                      } catch (e) {
                        console.error("退出登录失败", e);
                      }
                    }}
                  >
                    <Text className="text-sm font-medium text-white">退出</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}