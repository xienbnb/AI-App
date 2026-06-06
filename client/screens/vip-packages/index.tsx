import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------
interface VipPackage {
  id: string;
  name: string;
  level: string;
  price: number;
  duration_days: number;
  features: string[];
}

interface VipInfo {
  vipLevel: string;
  vipExpiresAt: string | null;
  dailyAiCount: number;
  isVip: boolean;
  remainCount: number;
}

interface SubscribeResponse {
  success: boolean;
  data: {
    message: string;
    [key: string]: unknown;
  };
}

// -----------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------
const PACKAGE_THEME: Record<
  string,
  { cardBg: string; borderColor: string; accentColor: string; label: string; icon: string }
> = {
  free: {
    cardBg: "#FFFFFF",
    borderColor: "#E5E7EB",
    accentColor: "#9CA3AF",
    label: "基础",
    icon: "gift",
  },
  monthly: {
    cardBg: "#FAFAFA",
    borderColor: "#D1D5DB",
    accentColor: "#6B7280",
    label: "月度",
    icon: "calendar",
  },
  yearly: {
    cardBg: "#FFFBEB",
    borderColor: "#F59E0B",
    accentColor: "#D97706",
    label: "年度",
    icon: "crown",
  },
};

const FEATURE_COMPARE: { label: string; free: boolean; monthly: boolean; yearly: boolean }[] = [
  { label: "AI 辅助写作", free: true, monthly: true, yearly: true },
  { label: "每日 AI 次数", free: true, monthly: true, yearly: true },
  { label: "高级 AI 模型", free: false, monthly: true, yearly: true },
  { label: "世界观生成", free: false, monthly: true, yearly: true },
  { label: "人物设定辅助", free: false, monthly: true, yearly: true },
  { label: "大纲智能规划", free: false, monthly: true, yearly: true },
  { label: "素材库管理", free: true, monthly: true, yearly: true },
  { label: "导出无水印", free: false, monthly: false, yearly: true },
  { label: "优先客服支持", free: false, monthly: false, yearly: true },
];

const LEVEL_ORDER: Record<string, number> = {
  free: 0,
  monthly: 1,
  yearly: 2,
};

// -----------------------------------------------------------------------
// Helper: get auth headers
// -----------------------------------------------------------------------
async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem("auth_token");
  return token ? { "Content-Type": "application/json", "x-session": token } : { "Content-Type": "application/json" };
}

// -----------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------
export default function VipPackagesScreen() {
  const router = useSafeRouter();

  // Data states
  const [packages, setPackages] = useState<VipPackage[]>([]);
  const [vipInfo, setVipInfo] = useState<VipInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  // Modal states
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // -----------------------------------------------------------------------
  // Fetch data
  // -----------------------------------------------------------------------
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();

      const [packagesRes, infoRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/vip/packages`, { headers }),
        fetch(`${API_BASE}/api/v1/vip/info`, { headers }),
      ]);

      const packagesJson = await packagesRes.json();
      const infoJson = await infoRes.json();

      if (packagesJson.data && Array.isArray(packagesJson.data)) {
        // Sort by level priority: free -> monthly -> yearly
        const sorted = [...packagesJson.data].sort(
          (a, b) => (LEVEL_ORDER[a.level] ?? 99) - (LEVEL_ORDER[b.level] ?? 99)
        );
        setPackages(sorted);
      }

      if (infoJson.data) {
        setVipInfo(infoJson.data);
      }
    } catch (e) {
      console.error("获取 VIP 数据失败", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -----------------------------------------------------------------------
  // Subscribe
  // -----------------------------------------------------------------------
  const handleSubscribe = async (packageId: string) => {
    try {
      setSubscribing(packageId);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/v1/vip/subscribe`, {
        method: "POST",
        headers,
        body: JSON.stringify({ packageId }),
      });
      const json: SubscribeResponse = await res.json();

      if (json.success) {
        setSuccessMessage(json.data?.message || "订阅成功！");
        setShowSuccessModal(true);
        // Refresh VIP info
        fetchData();
      } else {
        Alert.alert("订阅失败", json.data?.message || "请稍后重试");
      }
    } catch (e) {
      console.error("订阅失败", e);
      Alert.alert("网络错误", "无法连接到服务器，请检查网络后重试");
    } finally {
      setSubscribing(null);
    }
  };

  // -----------------------------------------------------------------------
  // Determine current package level
  // -----------------------------------------------------------------------
  const currentLevel = vipInfo?.vipLevel || "free";

  // -----------------------------------------------------------------------
  // Get remaining days if VIP
  // -----------------------------------------------------------------------
  const getRemainingDays = (): number => {
    if (!vipInfo?.vipExpiresAt) return 0;
    const expires = new Date(vipInfo.vipExpiresAt).getTime();
    const now = Date.now();
    const diff = expires - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const remainingDays = getRemainingDays();

  // -----------------------------------------------------------------------
  // Format price display
  // -----------------------------------------------------------------------
  const formatPrice = (price: number): string => {
    if (price === 0) return "免费";
    if (Number.isInteger(price)) return `¥${price}`;
    return `¥${price.toFixed(1)}`;
  };

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------
  if (loading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center bg-gray-50">
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text className="text-sm text-gray-400 mt-3">加载中...</Text>
        </View>
      </Screen>
    );
  }

  // -----------------------------------------------------------------------
  // Main Render
  // -----------------------------------------------------------------------
  return (
    <Screen>
      <ScrollView className="flex-1 bg-gray-50" showsVerticalScrollIndicator={false}>
        {/* ===== Header ===== */}
        <View className="bg-indigo-600 rounded-b-[32px] pt-14 pb-8 px-5">
          <View className="flex-row items-center gap-3 mb-4">
            <TouchableOpacity
              className="w-9 h-9 rounded-xl bg-white/20 items-center justify-center"
              onPress={() => router.back()}
            >
              <FontAwesome6 name="chevron-left" size={16} color="white" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-white">VIP 套餐</Text>
          </View>

          {/* Current VIP status summary */}
          <View className="bg-white/10 rounded-2xl p-4">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-white/20 items-center justify-center">
                <FontAwesome6
                  name={vipInfo?.isVip ? "crown" : "user"}
                  size={18}
                  color="white"
                />
              </View>
              <View className="flex-1">
                <Text className="text-white font-semibold text-base">
                  {vipInfo?.isVip ? `VIP · ${vipInfo.vipLevel.toUpperCase()}` : "免费用户"}
                </Text>
                <Text className="text-white/70 text-sm mt-0.5">
                  {vipInfo?.isVip
                    ? `剩余 ${remainingDays} 天 · 今日可用 ${vipInfo.remainCount} 次`
                    : `今日可用 ${vipInfo?.remainCount ?? 0} 次`}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ===== Package Cards ===== */}
        <View className="px-4 pt-6 pb-4">
          <Text className="text-base font-bold text-gray-900 mb-4">选择套餐</Text>

          {packages.map((pkg) => {
            const theme = PACKAGE_THEME[pkg.level] || PACKAGE_THEME.free;
            const isYearly = pkg.level === "yearly";
            const isCurrent = currentLevel === pkg.level;
            const isSubscribing = subscribing === pkg.id;

            return (
              <View
                key={pkg.id}
                className="rounded-3xl p-5 mb-4 border-2"
                style={{
                  backgroundColor: theme.cardBg,
                  borderColor: isCurrent ? theme.accentColor : theme.borderColor,
                }}
              >
                {/* Recommended badge for yearly */}
                {isYearly && (
                  <View
                    className="absolute -top-3 left-6 px-4 py-1 rounded-full"
                    style={{ backgroundColor: theme.accentColor }}
                  >
                    <Text className="text-xs font-bold text-white">推荐</Text>
                  </View>
                )}

                {/* Current plan badge */}
                {isCurrent && (
                  <View className="absolute -top-3 right-6 px-4 py-1 rounded-full bg-indigo-500">
                    <Text className="text-xs font-bold text-white">当前方案</Text>
                  </View>
                )}

                {/* Package header */}
                <View className="flex-row items-center gap-3 mb-4">
                  <View
                    className="w-11 h-11 rounded-xl items-center justify-center"
                    style={{ backgroundColor: `${theme.accentColor}18` }}
                  >
                    <FontAwesome6
                      name={theme.icon as any}
                      size={20}
                      color={theme.accentColor}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-gray-900">{pkg.name}</Text>
                    <Text className="text-xs text-gray-500">{theme.label}套餐</Text>
                  </View>
                </View>

                {/* Price */}
                <View className="flex-row items-baseline gap-1 mb-4">
                  <Text
                    className="text-4xl font-extrabold"
                    style={{ color: isYearly ? theme.accentColor : "#1F2937" }}
                  >
                    {formatPrice(pkg.price)}
                  </Text>
                  {pkg.price > 0 && (
                    <Text className="text-sm text-gray-500 ml-1">
                      / {pkg.duration_days >= 365 ? "年" : pkg.duration_days >= 30 ? "月" : `${pkg.duration_days}天`}
                    </Text>
                  )}
                </View>

                {/* Features */}
                <View className="mb-5 gap-2.5">
                  {(pkg.features || []).map((feature, fi) => (
                    <View key={fi} className="flex-row items-center gap-2.5">
                      <View className="w-5 h-5 rounded-full bg-emerald-50 items-center justify-center">
                        <FontAwesome6 name="check" size={10} color="#10B981" solid />
                      </View>
                      <Text className="text-sm text-gray-700 flex-1">{feature}</Text>
                    </View>
                  ))}
                </View>

                {/* CTA Button */}
                <TouchableOpacity
                  className={`py-3.5 rounded-2xl items-center ${isCurrent ? "opacity-60" : ""}`}
                  style={{
                    backgroundColor: isCurrent ? "#E5E7EB" : isYearly ? theme.accentColor : "#4F46E5",
                  }}
                  disabled={isCurrent || isSubscribing}
                  onPress={() => handleSubscribe(pkg.id)}
                >
                  {isSubscribing ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text
                      className="text-sm font-bold"
                      style={{ color: isCurrent ? "#9CA3AF" : "white" }}
                    >
                      {isCurrent ? "当前方案" : "立即订阅"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* ===== Feature Comparison Table ===== */}
        <View className="px-4 pb-6">
          <Text className="text-base font-bold text-gray-900 mb-4">功能对比</Text>

          <View className="bg-white rounded-3xl overflow-hidden border border-gray-100">
            {/* Header row */}
            <View className="flex-row border-b border-gray-100 bg-gray-50">
              <View className="flex-[2] py-3.5 px-4">
                <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider">功能</Text>
              </View>
              <View className="flex-1 py-3.5 items-center border-l border-gray-100">
                <Text className="text-xs font-semibold text-gray-400">免费</Text>
              </View>
              <View className="flex-1 py-3.5 items-center border-l border-gray-100">
                <Text className="text-xs font-semibold text-gray-500">月度</Text>
              </View>
              <View className="flex-1 py-3.5 items-center border-l border-gray-100">
                <View className="flex-row items-center gap-1">
                  <FontAwesome6 name="crown" size={10} color="#D97706" />
                  <Text className="text-xs font-semibold text-amber-600">年度</Text>
                </View>
              </View>
            </View>

            {/* Feature rows */}
            {FEATURE_COMPARE.map((feat, fi) => (
              <View
                key={feat.label}
                className={`flex-row items-center ${
                  fi !== FEATURE_COMPARE.length - 1 ? "border-b border-gray-50" : ""
                }`}
              >
                <View className="flex-[2] py-3 px-4">
                  <Text className="text-sm text-gray-700">{feat.label}</Text>
                </View>
                <View className="flex-1 items-center py-3 border-l border-gray-50">
                  {feat.free ? (
                    <FontAwesome6 name="check" size={14} color="#10B981" solid />
                  ) : (
                    <FontAwesome6 name="xmark" size={14} color="#D1D5DB" solid />
                  )}
                </View>
                <View className="flex-1 items-center py-3 border-l border-gray-50">
                  {feat.monthly ? (
                    <FontAwesome6 name="check" size={14} color="#10B981" solid />
                  ) : (
                    <FontAwesome6 name="xmark" size={14} color="#D1D5DB" solid />
                  )}
                </View>
                <View className="flex-1 items-center py-3 border-l border-gray-50">
                  {feat.yearly ? (
                    <FontAwesome6 name="check" size={14} color="#10B981" solid />
                  ) : (
                    <FontAwesome6 name="xmark" size={14} color="#D1D5DB" solid />
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Bottom spacing */}
        <View className="h-8" />
      </ScrollView>

      {/* ===== Success Modal ===== */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => setShowSuccessModal(false)}
        >
          <View
            className="flex-1 items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => undefined}>
              <View
                className="bg-white rounded-3xl p-7 mx-8 w-72 items-center"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.15,
                  shadowRadius: 24,
                  elevation: 20,
                }}
              >
                {/* Success icon */}
                <View className="w-16 h-16 rounded-full bg-emerald-50 items-center justify-center mb-4">
                  <FontAwesome6 name="check" size={28} color="#10B981" solid />
                </View>
                <Text className="text-lg font-bold text-gray-900 text-center mb-2">
                  订阅成功
                </Text>
                <Text className="text-sm text-gray-500 text-center mb-6 leading-5">
                  {successMessage || "感谢您的订阅，立即享受 VIP 权益吧！"}
                </Text>
                <TouchableOpacity
                  className="w-full py-3 rounded-xl items-center"
                  style={{ backgroundColor: "#4F46E5" }}
                  onPress={() => {
                    setShowSuccessModal(false);
                    router.back();
                  }}
                >
                  <Text className="text-sm font-bold text-white">我知道了</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}