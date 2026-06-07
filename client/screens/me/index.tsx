import { useState, useCallback, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, Platform, Alert, Linking } from "react-native";
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

  // Stats
  const [bookCount, setBookCount] = useState(0);
  const [totalWords, setTotalWords] = useState(0);
  const [consecutiveDays, setConsecutiveDays] = useState(0);
  const [todayWords, setTodayWords] = useState(0);

  // VIP & Token
  const [vipLevel, setVipLevel] = useState(0);
  const [vipPlanName, setVipPlanName] = useState("");
  const [isVip, setIsVip] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [vipExpiresAt, setVipExpiresAt] = useState("");
  const [dailyAiLimit, setDailyAiLimit] = useState(100);
  const [usedDailyAi, setUsedDailyAi] = useState(0);
  const [remainAiCalls, setRemainAiCalls] = useState(100);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [tokensClaimed, setTokensClaimed] = useState(false);
  const [claimingToken, setClaimingToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminPhone, setAdminPhone] = useState("");

  // Modals
  const [showDataStats, setShowDataStats] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const getAuthHeaders = useCallback(async () => {
    const token = await AsyncStorage.getItem("auth_token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["x-session"] = token;
    return headers;
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
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
  }, [getAuthHeaders]);

  const fetchVipInfo = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/v1/vip/info`, { headers });
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        setVipLevel(d.vipLevel ?? 0);
        setIsVip(d.isVip ?? false);
        setIsExpired(d.isExpired ?? false);
        setVipPlanName(d.tierName || "");
        setVipExpiresAt(d.vipExpiresAt || "");
        setDailyAiLimit(d.dailyLimit ?? 100);
        setUsedDailyAi(d.dailyAiCount ?? 0);
        setRemainAiCalls(d.remainCount ?? 0);
        setTokenBalance(d.tokenBalance ?? 0);
      }
    } catch (e) {
      console.error("获取VIP信息失败", e);
    }
  }, [getAuthHeaders]);

  const fetchClaimStatus = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/v1/vip/claim-daily/status`, { headers });
      const json = await res.json();
      if (json.success) {
        setTokensClaimed(json.data?.claimed ?? false);
      }
    } catch (e) {
      console.error("获取领取状态失败", e);
    }
  }, [getAuthHeaders]);

  const handleClaimDaily = useCallback(async () => {
    try {
      setClaimingToken(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/v1/vip/claim-daily`, {
        method: "POST",
        headers,
      });
      const json = await res.json();
      if (json.success) {
        setTokensClaimed(true);
        const claimedTokens = json.data?.tokens || 0;
        Alert.alert("领取成功", `已获得 ${claimedTokens.toLocaleString()} 字免费额度！`);
        fetchVipInfo();
      } else {
        Alert.alert("领取失败", json.message || "今日已领取过");
      }
    } catch (e) {
      console.error("领取免费额度失败", e);
      Alert.alert("领取失败", "网络异常，请稍后重试");
    } finally {
      setClaimingToken(false);
    }
  }, [getAuthHeaders, fetchVipInfo]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      AsyncStorage.getItem("last_phone").then((p) => setAdminPhone(p || ""));
      Promise.all([fetchStats(), fetchVipInfo(), fetchClaimStatus()]).finally(() =>
        setLoading(false)
      );
    }, [fetchStats, fetchVipInfo, fetchClaimStatus])
  );

  const aiPercent = dailyAiLimit > 0 ? Math.min(usedDailyAi / dailyAiLimit, 1) : 0;
  const isUnlimited = dailyAiLimit === -1;

  const getVipBadge = () => {
    if (vipLevel >= 1 && isVip) return { label: vipPlanName, bg: "bg-yellow-500", text: "text-white" };
    if (isExpired) return { label: "已过期", bg: "bg-gray-400", text: "text-white" };
    return { label: "免费用户", bg: "bg-gray-200", text: "text-gray-600" };
  };

  const vipBadge = getVipBadge();

  const settingsSections = [
    {
      title: "会员特权",
      items: [
        { icon: "gem", label: "VIP套餐", color: "#8B5CF6", onPress: () => router.push("/vip-packages") },
        { icon: "gift", label: "福利中心", color: "#EC4899", onPress: () => router.push("/welfare") },
      ],
    },
    {
      title: "财务管理",
      items: [
        { icon: "receipt", label: "扣费明细", color: "#3B82F6", onPress: () => router.push("/billing") },
        { icon: "cart-shopping", label: "充值字数", color: "#10B981", onPress: () => router.push("/recharge") },
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
      title: "社区与内容",
      items: [
        { icon: "users", label: "社区管理", color: "#F59E0B", onPress: () => router.push("/community-manage") },
        { icon: "comments", label: "社区", color: "#EC4899", onPress: () => router.push("/community") },
        { icon: "book-open", label: "操作教程", color: "#6366F1", onPress: () => router.push("/tutorial") },
      ],
    },
    {
      title: "其他",
      items: [
        { icon: "circle-info", label: "关于我们", color: "#6B7280", onPress: () => router.push("/about") },
        { icon: "gear", label: "设置", color: "#6B7280", onPress: () => router.push("/settings") },
        { icon: "shield-halved", label: "管理后台", color: "#4F46E5", onPress: () => router.push("/admin") },
        ...((isAuthenticated
          ? [{ icon: "right-from-bracket", label: "退出登录", color: "#EF4444", isLogout: true } as const]
          : [])),
      ].filter(item => !("label" in item && item.label === "管理后台") || adminPhone === "13252269161"),
    },
  ];

  return (
    <Screen>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* ===== 用户信息卡 ===== */}
        <TouchableOpacity
          className="mx-4 rounded-3xl p-6 mt-4 mb-4"
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
          <View className="flex-row items-center gap-4 mb-4">
            <View className="w-16 h-16 rounded-2xl bg-white/20 items-center justify-center overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} style={{ width: 64, height: 64 }} alt="avatar" />
              ) : (
                <FontAwesome6 name="user" size={28} color="#fff" />
              )}
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-xl font-bold text-white">{user?.nickname || "码字达人"}</Text>
                {vipLevel > 0 && isVip && (
                  <FontAwesome6 name="crown" size={14} color="#FBBF24" solid />
                )}
              </View>
              <View className="flex-row items-center gap-2 mt-1">
                <View className={`rounded-full px-2.5 py-0.5 ${vipBadge.bg}`}>
                  <Text className={`text-[10px] font-semibold ${vipBadge.text}`}>{vipBadge.label}</Text>
                </View>
                {isVip && vipExpiresAt && (
                  <Text className="text-[10px] text-white/60">到期 {vipExpiresAt.slice(0, 10)}</Text>
                )}
              </View>
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

        {/* ===== 字数额度 & VIP 余额卡 ===== */}
        <View className="mx-4 mb-4 bg-white rounded-2xl p-5 border border-gray-100" style={{
          shadowColor: "#4F46E5",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
          elevation: 2,
        }}>
          {/* 标题 */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-2">
              <View className="w-8 h-8 rounded-xl bg-indigo-50 items-center justify-center">
                <FontAwesome6 name="coins" size={16} color="#4F46E5" />
              </View>
              <Text className="text-base font-bold text-gray-900">字数额度</Text>
            </View>
            {vipLevel >= 1 && (
              <View className="flex-row items-center gap-1 bg-yellow-50 rounded-full px-2.5 py-1">
                <FontAwesome6 name="crown" size={10} color="#F59E0B" solid />
                <Text className="text-[10px] font-semibold text-yellow-700">{vipPlanName}</Text>
              </View>
            )}
          </View>

          {/* Token余额 - 长久有效 */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-1.5">
              <Text className="text-sm font-medium text-gray-700">字数额度</Text>
              <Text className="text-sm font-bold text-gray-900">
                {tokenBalance.toLocaleString()} 字
              </Text>
            </View>
            <Text className="text-xs text-gray-400">长久有效，不限时间</Text>
            <View className="h-1 w-full bg-gray-100 rounded-full mt-1" />
          </View>

          {/* AI调用余额 - 月度 */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-1.5">
              <Text className="text-sm font-medium text-gray-700">AI调用次数</Text>
              <Text className="text-sm font-bold text-gray-900">
                {isUnlimited ? "∞" : `本月剩余 ${remainAiCalls} / ${dailyAiLimit}`}
              </Text>
            </View>
            {isUnlimited ? (
              <Text className="text-xs text-green-500">会员不限次数</Text>
            ) : (
              <>
                <View className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${aiPercent * 100}%`,
                      backgroundColor: aiPercent > 0.8 ? "#EF4444" : aiPercent > 0.5 ? "#F59E0B" : "#10B981",
                    }}
                  />
                </View>
                <Text className="text-xs text-gray-400 mt-1">每月重置，办卡或做活动可增加次数</Text>
              </>
            )}
          </View>

          {/* 操作按钮 */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              className={`flex-1 flex-row items-center justify-center py-3 rounded-xl gap-2 ${
                tokensClaimed ? "bg-gray-100" : "bg-indigo-50"
              }`}
              onPress={handleClaimDaily}
              disabled={tokensClaimed || claimingToken}
            >
              <FontAwesome6
                name={tokensClaimed ? "check" : "gift"}
                size={14}
                color={tokensClaimed ? "#9CA3AF" : "#4F46E5"}
              />
              <Text
                className={`text-sm font-semibold ${tokensClaimed ? "text-gray-400" : "text-indigo-600"}`}
              >
                {claimingToken ? "领取中..." : tokensClaimed ? "今日已领取" : "领取免费字数"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center py-3 rounded-xl gap-2"
              style={{ backgroundColor: "#4F46E5" }}
              onPress={() => router.push("/recharge")}
            >
              <FontAwesome6 name="cart-shopping" size={14} color="#fff" />
              <Text className="text-sm font-semibold text-white">充值字数</Text>
            </TouchableOpacity>
          </View>
        </View>

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
                className="flex-1 bg-white rounded-2xl p-3.5 items-center border border-gray-100"
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
        <View className="mx-4 bg-white rounded-2xl p-4 mb-5 border border-gray-100" style={{
          shadowColor: "#4F46E5",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 1,
        }}>
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
              className="bg-white rounded-2xl overflow-hidden border border-gray-100"
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
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowDataStats(false)}>
          <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.3)" }}>
            <TouchableOpacity activeOpacity={1} onPress={() => undefined}>
              <View className="bg-white rounded-3xl p-6 mx-4 mb-10" style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.1,
                shadowRadius: 20,
                elevation: 20,
              }}>
                <View className="flex-row items-center justify-between mb-5">
                  <Text className="text-lg font-bold text-gray-800">数据统计</Text>
                  <TouchableOpacity onPress={() => setShowDataStats(false)}>
                    <FontAwesome6 name="xmark" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
                <View className="flex-row flex-wrap gap-3 mb-4">
                  {[
                    { label: "作品数", value: bookCount.toString(), color: "#4F46E5", icon: "book" },
                    { label: "总字数", value: formatWordCount(totalWords), color: "#3B82F6", icon: "pen" },
                    { label: "连续天数", value: `${consecutiveDays}天`, color: "#10B981", icon: "fire" },
                    { label: "今日写作", value: `${todayWords}字`, color: "#F59E0B", icon: "clock" },
                    { label: "剩余次数", value: `${isUnlimited ? "∞" : `${remainAiCalls}次`}`, color: "#8B5CF6", icon: "brain" },
                    { label: "剩余字数", value: `${tokenBalance.toLocaleString()}字`, color: "#EC4899", icon: "coins" },
                  ].map((stat) => (
                    <View key={stat.label} className="w-[47%] bg-gray-50 rounded-2xl p-4">
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
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ===== 退出登录确认 ===== */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowLogoutModal(false)}>
          <View className="flex-1 items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
            <TouchableOpacity activeOpacity={1} onPress={() => undefined}>
              <View className="bg-white rounded-3xl p-6 mx-8 w-72" style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.15,
                shadowRadius: 24,
                elevation: 20,
              }}>
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