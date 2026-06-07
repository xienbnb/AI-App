import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome6 } from "@expo/vector-icons";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

interface BillingRecord {
  id: string;
  type: "deduction" | "recharge" | "claim";
  title: string;
  amount: number;
  balanceAfter: number;
  detail?: string;
  createdAt: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  const hour = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  return `${month}-${day} ${hour}:${min}`;
}

export default function BillingScreen() {
  const router = useSafeRouter();
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ totalDeductions: 0, totalRecharges: 0, totalClaims: 0 });
  const [selectedRecord, setSelectedRecord] = useState<BillingRecord | null>(null);
  const pageSize = 20;

  const fetchRecords = useCallback(async (p: number = 1) => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("auth_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["x-session"] = token;

      const res = await fetch(
        `${API_BASE}/api/v1/billing?page=${p}&pageSize=${pageSize}`,
        { headers }
      );
      const json = await res.json();
      if (json.success) {
        setRecords(json.data.records || []);
        setTotal(json.data.total || 0);
        setSummary(json.data.summary || { totalDeductions: 0, totalRecharges: 0, totalClaims: 0 });
      }
    } catch (e) {
      console.error("获取扣费明细失败", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setPage(1);
      fetchRecords(1);
    }, [fetchRecords])
  );

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "deduction": return { icon: "minus-circle" as const, color: "#EF4444", bg: "#FEF2F2", label: "消费" };
      case "recharge": return { icon: "plus-circle" as const, color: "#10B981", bg: "#ECFDF5", label: "充值" };
      case "claim": return { icon: "gift" as const, color: "#F59E0B", bg: "#FFFBEB", label: "领取" };
      default: return { icon: "circle" as const, color: "#6B7280", bg: "#F3F4F6", label: type };
    }
  };

  const formatAmount = (type: string, amount: number) => {
    const prefix = type === "deduction" ? "-" : "+";
    const color = type === "deduction" ? "text-red-500" : type === "recharge" ? "text-emerald-500" : "text-amber-500";
    return { text: `${prefix}${amount.toLocaleString()}`, color };
  };

  const totalPages = Math.ceil(total / pageSize);

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
          <Text className="flex-1 text-center text-lg font-bold text-gray-900 mr-10">
            扣费明细
          </Text>
        </View>
      </SafeAreaView>

      {/* 统计概览 */}
      <View className="flex-row mx-4 mt-4 gap-3">
        <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100">
          <Text className="text-xs text-gray-400 mb-1">总消费</Text>
          <Text className="text-lg font-bold text-red-500">
            -{summary.totalDeductions.toLocaleString()}
          </Text>
        </View>
        <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100">
          <Text className="text-xs text-gray-400 mb-1">总充值</Text>
          <Text className="text-lg font-bold text-emerald-500">
            +{summary.totalRecharges.toLocaleString()}
          </Text>
        </View>
        <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100">
          <Text className="text-xs text-gray-400 mb-1">总领取</Text>
          <Text className="text-lg font-bold text-amber-500">
            +{summary.totalClaims.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* 筛选快速标签 */}
      <View className="flex-row mx-4 mt-3 gap-2">
        {[
          { label: "全部", value: "all" },
          { label: "消费", value: "deduction" },
          { label: "充值", value: "recharge" },
          { label: "领取", value: "claim" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.value}
            className="px-4 py-2 rounded-full bg-white border border-gray-200"
            activeOpacity={0.7}
          >
            <Text className="text-xs font-medium text-gray-600">{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 记录列表 */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-gray-400">加载中...</Text>
        </View>
      ) : records.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <FontAwesome6 name="receipt" size={48} color="#D1D5DB" />
          <Text className="text-sm text-gray-400 mt-3">暂无扣费记录</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-4 mt-4" contentContainerStyle={{ paddingBottom: 20 }}>
          {records.map((record) => {
            const typeInfo = getTypeIcon(record.type);
            const amount = formatAmount(record.type, record.amount);
            return (
              <TouchableOpacity
                key={record.id}
                className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 active:bg-gray-50"
                onPress={() => setSelectedRecord(record)}
              >
                <View className="flex-row items-center">
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                    style={{ backgroundColor: typeInfo.bg }}
                  >
                    <FontAwesome6 name={typeInfo.icon} size={16} color={typeInfo.color} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm font-semibold text-gray-900">{record.title}</Text>
                      <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: typeInfo.bg }}>
                        <Text className="text-[10px] font-medium" style={{ color: typeInfo.color }}>{typeInfo.label}</Text>
                      </View>
                    </View>
                    <Text className="text-xs text-gray-400 mt-0.5">{formatDate(record.createdAt)}</Text>
                  </View>
                  <View className="items-end">
                    <Text className={`text-base font-bold ${amount.color}`}>{amount.text}</Text>
                    <Text className="text-[10px] text-gray-400 mt-0.5">
                      余额: {record.balanceAfter.toLocaleString()}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* 分页 */}
          {totalPages > 1 && (
            <View className="flex-row items-center justify-center gap-4 mt-2">
              <TouchableOpacity
                className={`px-4 py-2 rounded-xl ${page <= 1 ? "bg-gray-100" : "bg-indigo-50"}`}
                disabled={page <= 1}
                onPress={() => {
                  const newPage = page - 1;
                  setPage(newPage);
                  fetchRecords(newPage);
                }}
              >
                <Text className={`text-sm font-medium ${page <= 1 ? "text-gray-300" : "text-indigo-600"}`}>上一页</Text>
              </TouchableOpacity>
              <Text className="text-sm text-gray-400">{page}/{totalPages}</Text>
              <TouchableOpacity
                className={`px-4 py-2 rounded-xl ${page >= totalPages ? "bg-gray-100" : "bg-indigo-50"}`}
                disabled={page >= totalPages}
                onPress={() => {
                  const newPage = page + 1;
                  setPage(newPage);
                  fetchRecords(newPage);
                }}
              >
                <Text className={`text-sm font-medium ${page >= totalPages ? "text-gray-300" : "text-indigo-600"}`}>下一页</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* 详情弹窗 */}
      {selectedRecord && (
        <TouchableOpacity
          className="absolute inset-0 bg-black/40 justify-center px-6"
          activeOpacity={1}
          onPress={() => setSelectedRecord(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => undefined}
            className="bg-white rounded-3xl p-6"
          >
            <View className="flex-row items-center justify-between mb-5">
              <Text className="text-lg font-bold text-gray-900">扣费详情</Text>
              <TouchableOpacity onPress={() => setSelectedRecord(null)}>
                <FontAwesome6 name="xmark" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <View className="space-y-4">
              <DetailRow label="类型" value={selectedRecord.type === "deduction" ? "消费" : selectedRecord.type === "recharge" ? "充值" : "领取"} />
              <DetailRow label="标题" value={selectedRecord.title} />
              <DetailRow label="金额" value={`${selectedRecord.type === "deduction" ? "-" : "+"}${selectedRecord.amount.toLocaleString()} 字`} valueColor={selectedRecord.type === "deduction" ? "#EF4444" : "#10B981"} />
              <DetailRow label="余额" value={`${selectedRecord.balanceAfter.toLocaleString()} 字`} />
              {selectedRecord.detail && <DetailRow label="详情" value={selectedRecord.detail} />}
              <DetailRow label="时间" value={new Date(selectedRecord.createdAt).toLocaleString("zh-CN")} />
            </View>
            <TouchableOpacity
              className="mt-6 py-3 rounded-xl items-center bg-gray-100"
              onPress={() => setSelectedRecord(null)}
            >
              <Text className="text-sm font-medium text-gray-600">关闭</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      )}
    </View>
  );
}

function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View className="flex-row items-center justify-between py-2 border-b border-gray-50">
      <Text className="text-sm text-gray-400">{label}</Text>
      <Text className="text-sm font-medium" style={{ color: valueColor || "#374151" }}>{value}</Text>
    </View>
  );
}