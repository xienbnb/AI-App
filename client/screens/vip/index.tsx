/**
 * VIP 会员中心页面
 *
 * 展示会员等级、权益对比、AI调用次数等信息，支持升级/续费操作
 *
 * API: GET /api/v1/vip/info
 * 响应格式:
 * {
 *   "data": {
 *     "vipLevel": 0|1|2,
 *     "vipExpiresAt": "ISO date or empty",
 *     "dailyAiCount": 0,
 *     "dailyLimit": 50,
 *     "isExpired": false,
 *     "isVip": false,
 *     "remainCount": 50,
 *     "maxTokens": 2000,
 *     "tierName": "普通用户",
 *     "isAdmin": false,
 *     "monthlyLimit": 500
 *   }
 * }
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

/** VIP 等级枚举 */
const VIP_LEVELS = {
  0: { label: "免费用户", tag: "FREE", color: "#9CA3AF", gradientColors: ["#D1D5DB", "#9CA3AF"] as const },
  1: { label: "月卡VIP", tag: "MONTHLY", color: "#F59E0B", gradientColors: ["#FBBF24", "#F59E0B"] as const },
  2: { label: "年卡VIP", tag: "YEARLY", color: "#D97706", gradientColors: ["#F59E0B", "#D97706"] as const },
} as const;

/** 价格配置 */
const PRICES = {
  monthly: { label: "月卡VIP", price: 29.9, unit: "月", icon: "crown" as const },
  yearly: { label: "年卡VIP", price: 99.9, unit: "年", icon: "gem" as const },
} as const;

/** 特色权益功能列表 */
const FEATURES = [
  {
    id: "ai_assistant",
    label: "AI写作助手",
    desc: "智能写作引擎，助力创作",
    levels: [0, 1, 2],
    freeDesc: "每日50次",
    vipDesc: "无限使用",
  },
  {
    id: "ai_continue",
    label: "AI续写",
    desc: "自动续写章节内容",
    levels: [1, 2],
    freeDesc: "不支持",
    vipDesc: "无限使用",
  },
  {
    id: "ai_expand",
    label: "AI扩写",
    desc: "将大纲/片段扩展为完整内容",
    levels: [1, 2],
    freeDesc: "不支持",
    vipDesc: "无限使用",
  },
  {
    id: "ai_chat",
    label: "AI角色对话",
    desc: "与虚拟角色互动对话",
    levels: [0, 1, 2],
    freeDesc: "每日3次",
    vipDesc: "无限使用",
  },
  {
    id: "sync",
    label: "多设备同步",
    desc: "创作进度实时同步",
    levels: [0, 1, 2],
    freeDesc: "已支持",
    vipDesc: "已支持",
  },
  {
    id: "export",
    label: "多格式导出",
    desc: "TXT/EPUB/PDF等格式",
    levels: [1, 2],
    freeDesc: "仅TXT",
    vipDesc: "全格式支持",
  },
  {
    id: "storage",
    label: "云存储空间",
    desc: "作品云端备份存储",
    levels: [0, 1, 2],
    freeDesc: "10MB",
    vipDesc: "1GB",
  },
  {
    id: "ad_free",
    label: "去广告",
    desc: "清爽无打扰的创作体验",
    levels: [1, 2],
    freeDesc: "有广告",
    vipDesc: "无广告",
  },
  {
    id: "priority",
    label: "优先客服",
    desc: "专享客服优先响应",
    levels: [1, 2],
    freeDesc: "不支持",
    vipDesc: "优先响应",
  },
] as const;

interface VipInfo {
  vipLevel: 0 | 1 | 2;
  vipExpiresAt: string;
  dailyAiCount: number;
  dailyLimit: number;
  isExpired: boolean;
  isVip: boolean;
  remainCount: number;
  maxTokens: number;
  tierName: string;
  isAdmin: boolean;
  monthlyLimit: number;
}

const defaultVipInfo: VipInfo = {
  vipLevel: 0,
  vipExpiresAt: "",
  dailyAiCount: 0,
  dailyLimit: 50,
  isExpired: false,
  isVip: false,
  remainCount: 0,
  maxTokens: 2000,
  tierName: "普通用户",
  isAdmin: false,
  monthlyLimit: 500,
};

export default function VipCenterScreen() {
  const router = useSafeRouter();

  const [loading, setLoading] = useState(true);
  const [vipInfo, setVipInfo] = useState<VipInfo>(defaultVipInfo);

  // 获取 VIP 信息
  const fetchVipInfo = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("auth_token");
      if (!token) {
        setLoading(false);
        return;
      }
      const res = await fetch(`${API_BASE}/api/v1/vip/info`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.data) {
        setVipInfo(json.data);
      }
    } catch (e) {
      console.error("获取VIP信息失败", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVipInfo();
  }, [fetchVipInfo]);

  const { vipLevel, vipExpiresAt, dailyAiCount, dailyLimit, isExpired, isVip, remainCount, maxTokens, tierName, isAdmin, monthlyLimit } = vipInfo;
  const currentLevel = VIP_LEVELS[vipLevel];
  const showUpgrade = !isVip || isExpired;

  // 格式化过期时间
  const formatExpireDate = (isoStr: string): string => {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    } catch {
      return isoStr;
    }
  };

  // 计算进度条百分比（每日AI调用）
  const progressPercent = dailyLimit > 0 ? Math.min((dailyAiCount / dailyLimit) * 100, 100) : 0;

  // 处理升级/续费
  const handleUpgrade = () => {
    Alert.alert("升级VIP", "即将跳转至支付页面", [{ text: "知道了" }]);
  };

  // 判断某功能在当前等级是否高亮
  const isFeatureHighlighted = (featureLevels: readonly number[]) => {
    return featureLevels.includes(vipLevel);
  };

  return (
    <Screen>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text className="text-sm text-gray-400 mt-3">加载中...</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 bg-gray-50" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* ===== 返回按钮 ===== */}
          <View className="px-4 pt-3 pb-2">
            <TouchableOpacity
              className="w-9 h-9 rounded-xl items-center justify-center"
              style={{ backgroundColor: "#F3F4F6" }}
              onPress={() => router.back()}
            >
              <FontAwesome6 name="chevron-left" size={16} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* ===== VIP 会员卡片（渐变头部） ===== */}
          <View className="mx-4 mb-6">
            <LinearGradient
              colors={currentLevel.gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="rounded-3xl overflow-hidden"
              style={{
                shadowColor: currentLevel.color,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
                elevation: 10,
              }}
            >
              {/* 头部区域 */}
              <View className="px-6 pt-8 pb-6">
                <View className="flex-row items-center justify-between mb-3">
                  <View>
                    <Text className="text-white/70 text-xs font-medium tracking-wider uppercase">
                      当前等级
                    </Text>
                    <Text className="text-white text-2xl font-bold mt-1">
                      {currentLevel.label}
                    </Text>
                  </View>
                  {/* VIP 徽章 */}
                  <View className="bg-white/20 rounded-2xl px-4 py-2.5 items-center">
                    <FontAwesome6
                      name={isVip ? "crown" : "user"}
                      size={20}
                      color="#FFFFFF"
                    />
                    <Text className="text-white text-xs font-semibold mt-0.5">
                      {isVip ? "VIP" : "FREE"}
                    </Text>
                  </View>
                </View>

                {/* VIP 有效期限 */}
                {isVip && vipExpiresAt && !isExpired && (
                  <View className="flex-row items-center gap-1.5 mt-1">
                    <FontAwesome6 name="calendar" size={12} color="#FFFFFF" />
                    <Text className="text-white/80 text-sm">
                      有效期至 {formatExpireDate(vipExpiresAt)}
                    </Text>
                  </View>
                )}
                {isExpired && (
                  <View className="flex-row items-center gap-1.5 mt-1">
                    <FontAwesome6 name="triangle-exclamation" size={12} color="#FEF3C7" />
                    <Text className="text-yellow-100 text-sm">已过期，请续费以恢复权益</Text>
                  </View>
                )}
              </View>

              {/* 底部统计区 */}
              <View className="bg-black/10 px-6 py-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <FontAwesome6 name="brain" size={14} color="#FFFFFF" />
                    <Text className="text-white/80 text-sm font-medium">{isAdmin ? "AI调用" : isVip ? "本月AI调用" : "今日AI调用"}</Text>
                  </View>
                  <Text className="text-white text-sm font-bold">
                    {isAdmin ? "无限" : `${remainCount} / ${isVip ? monthlyLimit : dailyLimit}`}
                  </Text>
                </View>
                {/* 进度条（仅免费用户显示） */}
                {!isVip && (
                  <View className="mt-2.5 h-2.5 bg-white/20 rounded-full overflow-hidden">
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${progressPercent}%`,
                        backgroundColor: progressPercent >= 80 ? "#FCA5A5" : "#FFFFFF",
                      }}
                    />
                  </View>
                )}
                {!isAdmin && (
                  <Text className="text-white/60 text-xs mt-1.5">
                    {remainCount <= 10
                      ? isVip
                        ? `⚠️ 本月剩余 ${remainCount} 次，升级更高等级享更多`
                        : `⚠️ 今日剩余 ${remainCount} 次，升级VIP享更多调用`
                      : isVip
                        ? `本月剩余 ${remainCount} 次调用`
                        : `今日剩余 ${remainCount} 次调用（${maxTokens}token/次）`}
                  </Text>
                )}
              </View>
            </LinearGradient>
          </View>

          {/* ===== 特色权益 ===== */}
          <View className="mx-4 mb-6">
            <Text className="text-base font-bold text-gray-800 mb-3">特色权益</Text>
            <View className="flex-row flex-wrap gap-3">
              {/* 权益卡片：无限AI调用 */}
              <View className="bg-white rounded-2xl p-4 flex-1 min-w-[45%]" style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 1,
              }}>
                <View className="w-10 h-10 rounded-xl items-center justify-center mb-2" style={{ backgroundColor: "#F59E0B15" }}>
                  <FontAwesome6 name="wand-magic-sparkles" size={18} color="#F59E0B" />
                </View>
                <Text className="text-sm font-semibold text-gray-800">无限AI调用</Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  {isVip ? "已解锁" : "每日限50次"}
                </Text>
              </View>
              {/* 权益卡片：全格式导出 */}
              <View className="bg-white rounded-2xl p-4 flex-1 min-w-[45%]" style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 1,
              }}>
                <View className="w-10 h-10 rounded-xl items-center justify-center mb-2" style={{ backgroundColor: "#8B5CF615" }}>
                  <FontAwesome6 name="file-export" size={18} color="#8B5CF6" />
                </View>
                <Text className="text-sm font-semibold text-gray-800">全格式导出</Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  {isVip ? "TXT/EPUB/PDF" : "仅支持TXT"}
                </Text>
              </View>
              {/* 权益卡片：云存储 */}
              <View className="bg-white rounded-2xl p-4 flex-1 min-w-[45%]" style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 1,
              }}>
                <View className="w-10 h-10 rounded-xl items-center justify-center mb-2" style={{ backgroundColor: "#3B82F615" }}>
                  <FontAwesome6 name="cloud" size={18} color="#3B82F6" />
                </View>
                <Text className="text-sm font-semibold text-gray-800">云存储空间</Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  {isVip ? "1GB" : "10MB"}
                </Text>
              </View>
              {/* 权益卡片：去广告 */}
              <View className="bg-white rounded-2xl p-4 flex-1 min-w-[45%]" style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 1,
              }}>
                <View className="w-10 h-10 rounded-xl items-center justify-center mb-2" style={{ backgroundColor: "#10B98115" }}>
                  <FontAwesome6 name="ban" size={18} color="#10B981" />
                </View>
                <Text className="text-sm font-semibold text-gray-800">去广告</Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  {isVip ? "无广告体验" : "有广告"}
                </Text>
              </View>
            </View>
          </View>

          {/* ===== 全部功能对比 ===== */}
          <View className="mx-4 mb-6">
            <Text className="text-base font-bold text-gray-800 mb-3">全部功能对比</Text>
            <View className="bg-white rounded-2xl overflow-hidden" style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
              elevation: 1,
            }}>
              {/* 表头 */}
              <View className="flex-row border-b border-gray-100 bg-gray-50/80 px-4 py-3">
                <View className="flex-[2]">
                  <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider">功能</Text>
                </View>
                <View className="flex-1 items-center">
                  <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider">免费</Text>
                </View>
                <View className="flex-1 items-center">
                  <Text className="text-xs font-semibold text-amber-600 uppercase tracking-wider">VIP</Text>
                </View>
              </View>

              {/* 功能行 */}
              {FEATURES.map((feature, index) => {
                const freeHighlighted = isFeatureHighlighted(feature.levels);
                return (
                  <View
                    key={feature.id}
                    className={`flex-row items-center px-4 py-3.5 ${
                      index < FEATURES.length - 1 ? "border-b border-gray-50" : ""
                    }`}
                  >
                    {/* 功能名称 */}
                    <View className="flex-[2]">
                      <Text className="text-sm font-medium text-gray-800">{feature.label}</Text>
                      <Text className="text-xs text-gray-400 mt-0.5">{feature.desc}</Text>
                    </View>
                    {/* 免费列 */}
                    <View className="flex-1 items-center">
                      {freeHighlighted ? (
                        <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: "#D1FAE5" }}>
                          <FontAwesome6 name="check" size={12} color="#059669" />
                        </View>
                      ) : (
                        <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
                          <FontAwesome6 name="xmark" size={12} color="#DC2626" />
                        </View>
                      )}
                      <Text className="text-[10px] text-gray-400 mt-1">{feature.freeDesc}</Text>
                    </View>
                    {/* VIP列 */}
                    <View className="flex-1 items-center">
                      <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: "#FEF3C7" }}>
                        <FontAwesome6 name="check" size={12} color="#D97706" />
                      </View>
                      <Text className="text-[10px] text-gray-400 mt-1">{feature.vipDesc}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* ===== 升级方案 ===== */}
          <View className="mx-4 mb-6">
            <Text className="text-base font-bold text-gray-800 mb-3">选择升级方案</Text>
            <View className="flex-row gap-3">
              {/* 月卡方案 */}
              <TouchableOpacity
                className="flex-1 bg-white rounded-2xl overflow-hidden"
                activeOpacity={0.8}
                onPress={handleUpgrade}
                style={{
                  shadowColor: "#F59E0B",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 12,
                  elevation: 3,
                }}
              >
                <LinearGradient
                  colors={["#FBBF24", "#F59E0B"] as const}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="px-4 py-4 items-center"
                >
                  <FontAwesome6 name="crown" size={22} color="#FFFFFF" />
                  <Text className="text-white text-base font-bold mt-1.5">月卡VIP</Text>
                </LinearGradient>
                <View className="px-4 py-4 items-center">
                  <View className="flex-row items-baseline">
                    <Text className="text-2xl font-bold text-gray-800">¥{PRICES.monthly.price}</Text>
                    <Text className="text-xs text-gray-400 ml-1">/{PRICES.monthly.unit}</Text>
                  </View>
                  <Text className="text-xs text-gray-400 mt-2 text-center leading-4">
                    无限AI调用{"\n"}全格式导出 · 去广告
                  </Text>
                </View>
              </TouchableOpacity>

              {/* 年卡方案（推荐） */}
              <TouchableOpacity
                className="flex-1 bg-white rounded-2xl overflow-hidden"
                activeOpacity={0.8}
                onPress={handleUpgrade}
                style={{
                  shadowColor: "#D97706",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  elevation: 4,
                }}
              >
                <LinearGradient
                  colors={["#F59E0B", "#D97706"] as const}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="px-4 py-4 items-center relative"
                >
                  {/* 推荐标签 */}
                  <View className="absolute -top-0.5 right-3 bg-red-500 rounded-full px-2 py-0.5">
                    <Text className="text-white text-[9px] font-bold">推荐</Text>
                  </View>
                  <FontAwesome6 name="gem" size={22} color="#FFFFFF" />
                  <Text className="text-white text-base font-bold mt-1.5">年卡VIP</Text>
                </LinearGradient>
                <View className="px-4 py-4 items-center">
                  <View className="flex-row items-baseline">
                    <Text className="text-2xl font-bold text-gray-800">¥{PRICES.yearly.price}</Text>
                    <Text className="text-xs text-gray-400 ml-1">/{PRICES.yearly.unit}</Text>
                  </View>
                  <Text className="text-xs text-amber-600 font-medium mt-1">
                    平均 ¥{(PRICES.yearly.price / 12).toFixed(1)}/月
                  </Text>
                  <Text className="text-xs text-gray-400 mt-2 text-center leading-4">
                    全部权益 · 优先客服{"\n"}性价比之选
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* ===== 升级/续费 按钮 ===== */}
          <View className="mx-4 mb-4">
            {showUpgrade ? (
              <TouchableOpacity
                className="rounded-2xl overflow-hidden"
                activeOpacity={0.85}
                onPress={handleUpgrade}
              >
                <LinearGradient
                  colors={["#FBBF24", "#F59E0B", "#D97706"] as const}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="py-4 items-center"
                  style={{
                    shadowColor: "#F59E0B",
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.4,
                    shadowRadius: 16,
                    elevation: 8,
                  }}
                >
                  <FontAwesome6
                    name={isExpired ? "arrow-rotate-right" : "crown"}
                    size={18}
                    color="#FFFFFF"
                    style={{ marginBottom: 4 }}
                  />
                  <Text className="text-white text-base font-bold">
                    {isExpired ? "续费VIP" : "升级VIP"}
                  </Text>
                  <Text className="text-white/80 text-xs mt-0.5">
                    {isExpired
                      ? "恢复所有VIP权益，继续畅享创作"
                      : "解锁全部功能，开启高效创作之旅"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              /* 已经是VIP且未过期 - 显示续费入口 */
              <TouchableOpacity
                className="bg-white rounded-2xl py-4 items-center border-2 border-amber-200"
                activeOpacity={0.8}
                onPress={handleUpgrade}
                style={{
                  shadowColor: "#F59E0B",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                <FontAwesome6 name="arrow-rotate-right" size={18} color="#D97706" />
                <Text className="text-amber-700 text-base font-bold mt-1">续费VIP</Text>
                <Text className="text-amber-500 text-xs mt-0.5">延长会员有效期，持续享受全部权益</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ===== 底部说明 ===== */}
          <View className="mx-4 mt-2">
            <View className="bg-amber-50 rounded-2xl p-4 flex-row items-start gap-3">
              <FontAwesome6 name="circle-info" size={16} color="#D97706" />
              <Text className="text-sm text-amber-800 flex-1 leading-5">
                VIP会员权益以付费页面说明为准。续费将叠加会员有效期，不自动扣费。
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}