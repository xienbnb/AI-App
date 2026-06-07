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

interface TokenPackage {
  id: string;
  name: string;
  tokens: number;
  price: string;
  bonus_tokens: number;
  popular: boolean;
  description: string;
}

interface QuotaData {
  tokenBalance?: number;
  planName?: string;
  dailyTokens?: { total: number; used: number; remaining: number; claimed?: boolean };
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem("auth_token");
  return token ? { "Content-Type": "application/json", "x-session": token } : { "Content-Type": "application/json" };
}

function formatNumber(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + "万";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toLocaleString();
}

export default function RechargeScreen() {
  const router = useSafeRouter();

  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const [pkgRes, quotaRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/vip/token-packages`, { headers }),
        fetch(`${API_BASE}/api/v1/vip/quota`, { headers }),
      ]);
      const pkgJson = await pkgRes.json();
      const quotaJson = await quotaRes.json();
      if (pkgJson.success) setPackages(pkgJson.data || []);
      if (quotaJson.success) setQuota(quotaJson.data);
    } catch (e) {
      console.error("加载充值数据失败", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleBuy = async (pkgId: string) => {
    try {
      setBuying(pkgId);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/v1/vip/buy-tokens`, {
        method: "POST",
        headers,
        body: JSON.stringify({ packageId: pkgId }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg(json.message || "购买成功！");
        setShowSuccessModal(true);
        fetchData();
      } else {
        Alert.alert("购买失败", json.error || "请稍后重试");
      }
    } catch (e) {
      console.error("购买失败", e);
      Alert.alert("网络错误", "无法连接到服务器");
    } finally {
      setBuying(null);
    }
  };

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

  return (
    <Screen>
      <ScrollView className="flex-1 bg-gray-50" showsVerticalScrollIndicator={false}>
        {/* ===== Header ===== */}
        <View className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-b-[32px] pt-14 pb-8 px-5">
          <View className="flex-row items-center gap-3 mb-5">
            <TouchableOpacity
              className="w-9 h-9 rounded-xl bg-white/20 items-center justify-center"
              onPress={() => router.back()}
            >
              <FontAwesome6 name="chevron-left" size={16} color="white" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-white">字数充值</Text>
          </View>

          {/* Balance card */}
          <View className="bg-white/10 rounded-2xl p-5">
            <Text className="text-white/60 text-xs mb-2">当前字数余额</Text>
            <View className="flex-row items-baseline gap-1">
              <Text className="text-3xl font-extrabold text-white">
                {formatNumber(quota?.tokenBalance || 0)}
              </Text>
              <Text className="text-white/70 text-sm">字</Text>
            </View>
            <View className="h-px bg-white/10 my-3" />
            <View className="flex-row justify-between">
              <View>
                <Text className="text-white/50 text-xs">今日可用</Text>
                <Text className="text-white font-semibold text-sm">
                  {quota?.dailyTokens ? formatNumber(quota.dailyTokens.remaining) : '-'} 字
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-white/50 text-xs">套餐</Text>
                <Text className="text-white font-semibold text-sm">{quota?.planName || '免费'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ===== Token Packages ===== */}
        <View className="px-4 pt-6 pb-4">
          <Text className="text-base font-bold text-gray-900 mb-1">选择充值套餐</Text>
          <Text className="text-xs text-gray-400 mb-4">购买后字数长期有效，不过期</Text>

          {packages.map((pkg, idx) => {
            const priceNum = parseFloat(pkg.price);
            const totalTokens = pkg.tokens + (pkg.bonus_tokens || 0);
            const isPopular = pkg.popular;
            const isBuying = buying === pkg.id;

            return (
              <TouchableOpacity
                key={pkg.id}
                activeOpacity={0.9}
                onPress={() => handleBuy(pkg.id)}
                disabled={!!buying}
                className={`mb-4 rounded-3xl overflow-hidden border-2 ${
                  isPopular ? "border-amber-400" : "border-gray-100"
                }`}
                style={{
                  backgroundColor: isPopular ? "#FFFBEB" : "#FFFFFF",
                  shadowColor: isPopular ? "#F59E0B" : "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.08,
                  shadowRadius: 12,
                  elevation: 4,
                }}
              >
                {/* Popular badge */}
                {isPopular && (
                  <View className="bg-amber-400 absolute -top-3 right-6 px-4 py-1 rounded-full z-10">
                    <Text className="text-xs font-bold text-white">推荐</Text>
                  </View>
                )}

                <View className="p-5">
                  {/* Header */}
                  <View className="flex-row items-center gap-3 mb-3">
                    <View
                      className="w-10 h-10 rounded-xl items-center justify-center"
                      style={{
                        backgroundColor: isPopular ? "#FEF3C7" : "#EEF2FF",
                      }}
                    >
                      <FontAwesome6
                        name={idx === 0 ? "seedling" : idx === packages.length - 1 ? "gem" : "coins"}
                        size={18}
                        color={isPopular ? "#D97706" : "#4F46E5"}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-lg font-bold text-gray-900">{pkg.name}</Text>
                      <Text className="text-xs text-gray-400">{pkg.description}</Text>
                    </View>
                  </View>

                  {/* Amount + Price */}
                  <View className="flex-row items-baseline mb-3">
                    <Text className="text-3xl font-extrabold text-gray-900">
                      {formatNumber(totalTokens)}
                    </Text>
                    <Text className="text-sm text-gray-500 ml-1">字</Text>
                    <View className="flex-1" />
                    <Text className="text-xl font-bold text-indigo-600">
                      ¥{priceNum}
                    </Text>
                  </View>

                  {/* Bonus tag */}
                  {pkg.bonus_tokens > 0 && (
                    <View className="flex-row items-center gap-1.5 mb-3">
                      <View className="px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200">
                        <Text className="text-xs font-bold text-rose-500">
                          赠送 {formatNumber(pkg.bonus_tokens)} 字
                        </Text>
                      </View>
                      <Text className="text-xs text-rose-400 font-medium">
                        +{(pkg.bonus_tokens / pkg.tokens * 100).toFixed(0)}%
                      </Text>
                    </View>
                  )}

                  {/* Buy button */}
                  <TouchableOpacity
                    disabled={!!buying}
                    onPress={() => handleBuy(pkg.id)}
                    className={`py-3.5 rounded-2xl items-center ${
                      isPopular ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-indigo-600"
                    } ${isBuying ? "opacity-70" : ""}`}
                  >
                    {isBuying ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text className="text-sm font-bold text-white">立即购买</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ===== Highlights ===== */}
        <View className="px-4 pb-6">
          <View className="bg-white rounded-3xl p-5 border border-gray-100">
            <Text className="text-sm font-bold text-gray-900 mb-3">购买须知</Text>
            <View className="gap-3">
              {[
                { icon: "check-circle", text: "购买后字数永久有效，长期不过期" },
                { icon: "check-circle", text: "字数额度全平台通用，支持所有AI功能" },
                { icon: "check-circle", text: "先消耗每日免费额度，再用余额字数" },
                { icon: "check-circle", text: "购买后即时到账，可在我的页面查看" },
              ].map((item, i) => (
                <View key={i} className="flex-row items-center gap-2.5">
                  <FontAwesome6 name={item.icon as any} size={14} color="#10B981" solid />
                  <Text className="text-sm text-gray-600 flex-1">{item.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View className="h-8" />
      </ScrollView>

      {/* ===== Success Modal ===== */}
      <Modal visible={showSuccessModal} transparent animationType="fade" onRequestClose={() => setShowSuccessModal(false)}>
        <View className="flex-1 items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
          <View className="bg-white rounded-3xl p-7 mx-8 w-72 items-center"
            style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 20 }}>
            <View className="w-16 h-16 rounded-full bg-emerald-50 items-center justify-center mb-4">
              <FontAwesome6 name="check" size={28} color="#10B981" solid />
            </View>
            <Text className="text-lg font-bold text-gray-900 text-center mb-2">购买成功</Text>
            <Text className="text-sm text-gray-500 text-center mb-6 leading-5">{successMsg}</Text>
            <TouchableOpacity
              className="w-full py-3 rounded-xl items-center"
              style={{ backgroundColor: "#4F46E5" }}
              onPress={() => { setShowSuccessModal(false); router.back(); }}
            >
              <Text className="text-sm font-bold text-white">我知道了</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}