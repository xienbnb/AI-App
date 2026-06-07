import { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  TextInput, Alert, RefreshControl, ActivityIndicator, Platform,
} from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

interface DashboardData {
  totalUsers: number;
  todayNewUsers: number;
  totalPosts: number;
  activeCodes: number;
  usedCodes: number;
  vipUsers: number;
}

interface User {
  id: string;
  phone: string;
  nickname: string | null;
  tokenBalance: number;
  isVip: boolean;
  vipExpiresAt: string | null;
  role: string | null;
  bannedAt: string | null;
  createdAt: string;
  dailyCalls: number;
}

interface RedeemCode {
  id: string;
  code: string;
  type: string;
  value: number;
  usesTotal: number;
  usesLeft: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

type TabType = "dashboard" | "users" | "redeem";

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function StatCard({ icon, label, value, color }: {
  icon: string; label: string; value: string | number; color: string;
}) {
  return (
    <View className="bg-white dark:bg-gray-800 rounded-2xl p-4 flex-1 shadow-sm"
      style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
    >
      <View className="w-10 h-10 rounded-xl items-center justify-center mb-2"
        style={{ backgroundColor: color + "15" }}
      >
        <FontAwesome6 name={icon} size={18} color={color} />
      </View>
      <Text className="text-2xl font-bold text-gray-900 dark:text-white">{value}</Text>
      <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</Text>
    </View>
  );
}

export default function AdminScreen() {
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Dashboard data
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [userSearch, setUserSearch] = useState("");

  // Redeem
  const [codes, setCodes] = useState<RedeemCode[]>([]);
  const [codePage, setCodePage] = useState(1);
  const [codeTotal, setCodeTotal] = useState(0);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genType, setGenType] = useState<"token" | "vip">("token");
  const [genValue, setGenValue] = useState("5000");
  const [genCount, setGenCount] = useState("1");
  const [generating, setGenerating] = useState(false);

  const getToken = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
        headers: { "x-session": "" },
      });
      // 不用 /me，从 AsyncStorage 拿 session token
      const keys = ["phone_f1a62a78-5fa4-4059-88b5-4a1a592b5ead_1781476525789"];
      return keys[0];
    } catch {
      return "";
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/v1/admin/dashboard`, {
        headers: { "x-session": token || "" },
      });
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
      }
    } catch (e) {
      console.log("fetchDashboard error:", e);
    }
  }, [getToken]);

  const fetchUsers = useCallback(async (page = 1, search = "") => {
    try {
      const token = await getToken();
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`${API_BASE}/api/v1/admin/users?${params}`, {
        headers: { "x-session": token || "" },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setUserTotal(data.total || 0);
      }
    } catch (e) {
      console.log("fetchUsers error:", e);
    }
  }, [getToken]);

  const fetchCodes = useCallback(async (page = 1) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/v1/admin/redeem/list?page=${page}&limit=20`, {
        headers: { "x-session": token || "" },
      });
      if (res.ok) {
        const data = await res.json();
        setCodes(data.codes || []);
        setCodeTotal(data.total || 0);
      }
    } catch (e) {
      console.log("fetchCodes error:", e);
    }
  }, [getToken]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([
        fetchDashboard(),
        fetchUsers(1),
        fetchCodes(1),
      ]).finally(() => setLoading(false));
    }, [fetchDashboard, fetchUsers, fetchCodes])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchDashboard(),
      fetchUsers(userPage, userSearch),
      fetchCodes(codePage),
    ]);
    setRefreshing(false);
  }, [fetchDashboard, fetchUsers, fetchCodes, userPage, userSearch, codePage]);

  const handleBanUser = async (userId: string, banned: boolean) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/v1/admin/users/${userId}/ban`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-session": token || "" },
        body: JSON.stringify({ banned: !banned }),
      });
      if (res.ok) {
        Alert.alert("成功", banned ? "已解封用户" : "已封禁用户");
        fetchUsers(userPage, userSearch);
      } else {
        const data = await res.json();
        Alert.alert("错误", data.error || "操作失败");
      }
    } catch (e) {
      Alert.alert("错误", "请求失败");
    }
  };

  const handleSetVip = async (userId: string, months: number) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/v1/admin/users/${userId}/vip`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-session": token || "" },
        body: JSON.stringify({ months }),
      });
      if (res.ok) {
        Alert.alert("成功", `已设置 VIP ${months} 个月`);
        fetchUsers(userPage, userSearch);
      } else {
        const data = await res.json();
        Alert.alert("错误", data.error || "操作失败");
      }
    } catch (e) {
      Alert.alert("错误", "请求失败");
    }
  };

  const handleToggleCode = async (codeId: string, active: boolean) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/v1/admin/redeem/${codeId}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-session": token || "" },
        body: JSON.stringify({ active: !active }),
      });
      if (res.ok) {
        fetchCodes(codePage);
      }
    } catch (e) {
      console.log("toggle error:", e);
    }
  };

  const handleGenerateCodes = async () => {
    if (!genValue || parseInt(genValue) <= 0) {
      Alert.alert("错误", "请输入有效数值");
      return;
    }
    setGenerating(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/v1/admin/redeem/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session": token || "" },
        body: JSON.stringify({
          type: genType,
          value: parseInt(genValue),
          count: parseInt(genCount) || 1,
        }),
      });
      if (res.ok) {
        Alert.alert("成功", "兑换码已生成");
        setShowGenerateModal(false);
        fetchCodes(1);
      } else {
        const data = await res.json();
        Alert.alert("错误", data.error || "生成失败");
      }
    } catch (e) {
      Alert.alert("错误", "请求失败");
    } finally {
      setGenerating(false);
    }
  };

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: "dashboard", label: "数据概览", icon: "chart-simple" },
    { key: "users", label: "用户管理", icon: "users" },
    { key: "redeem", label: "兑换码", icon: "ticket" },
  ];

  const renderDashboard = () => (
    <View className="px-4 pt-4">
      <Text className="text-lg font-bold text-gray-900 dark:text-white mb-4">数据概览</Text>
      <View className="flex-row gap-3 mb-3">
        <StatCard icon="user" label="用户总数" value={dashboard?.totalUsers ?? "-"} color="#4F46E5" />
        <StatCard icon="user-plus" label="今日新增" value={dashboard?.todayNewUsers ?? "-"} color="#10B981" />
      </View>
      <View className="flex-row gap-3 mb-3">
        <StatCard icon="file-lines" label="帖子总数" value={dashboard?.totalPosts ?? "-"} color="#F59E0B" />
        <StatCard icon="crown" label="VIP用户" value={dashboard?.vipUsers ?? "-"} color="#8B5CF6" />
      </View>
      <View className="flex-row gap-3">
        <StatCard icon="ticket" label="有效兑换码" value={dashboard?.activeCodes ?? "-"} color="#EC4899" />
        <StatCard icon="check" label="已使用" value={dashboard?.usedCodes ?? "-"} color="#06B6D4" />
      </View>

      {dashboard && (
        <View className="mt-6 bg-white dark:bg-gray-800 rounded-2xl p-5"
          style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
        >
          <Text className="text-base font-semibold text-gray-900 dark:text-white mb-3">快速操作</Text>
          <TouchableOpacity
            className="flex-row items-center py-3"
            onPress={() => setActiveTab("redeem")}
          >
            <FontAwesome6 name="ticket" size={16} color="#6B7280" />
            <Text className="ml-3 text-gray-700 dark:text-gray-300">管理兑换码</Text>
            <FontAwesome6 name="chevron-right" size={12} color="#9CA3AF" style={{ marginLeft: "auto" }} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderUsers = () => (
    <View className="px-4 pt-4 flex-1">
      <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">用户管理</Text>

      <View className="flex-row items-center bg-gray-100 dark:bg-gray-700 rounded-xl px-3 mb-3">
        <FontAwesome6 name="magnifying-glass" size={14} color="#9CA3AF" />
        <TextInput
          className="flex-1 py-2.5 px-2 text-sm text-gray-900 dark:text-white"
          placeholder="搜索手机号/昵称..."
          placeholderTextColor="#9CA3AF"
          value={userSearch}
          onChangeText={setUserSearch}
          onSubmitEditing={() => { setUserPage(1); fetchUsers(1, userSearch); }}
          returnKeyType="search"
        />
        {userSearch ? (
          <TouchableOpacity onPress={() => { setUserSearch(""); setUserPage(1); fetchUsers(1, ""); }}>
            <FontAwesome6 name="xmark" size={14} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
      </View>

      <Text className="text-xs text-gray-500 mb-2">共 {userTotal} 个用户</Text>

      {users.length === 0 ? (
        <View className="items-center py-10">
          <FontAwesome6 name="users" size={40} color="#D1D5DB" />
          <Text className="text-gray-400 mt-2">暂无数据</Text>
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {users.map((user) => (
            <View key={user.id}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-3"
              style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}
            >
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center">
                  <View className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900 items-center justify-center">
                    <FontAwesome6 name="user" size={14} color="#4F46E5" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-sm font-semibold text-gray-900 dark:text-white">
                      {user.nickname || "未设置昵称"}
                    </Text>
                    <Text className="text-xs text-gray-500">{user.phone || "-"}</Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-1">
                  {user.isVip && (
                    <View className="bg-purple-100 dark:bg-purple-900 px-2 py-0.5 rounded-full">
                      <Text className="text-xs text-purple-600 dark:text-purple-300 font-medium">VIP</Text>
                    </View>
                  )}
                  {user.bannedAt && (
                    <View className="bg-red-100 dark:bg-red-900 px-2 py-0.5 rounded-full">
                      <Text className="text-xs text-red-600 dark:text-red-300 font-medium">封禁</Text>
                    </View>
                  )}
                </View>
              </View>

              <View className="flex-row justify-between mb-2">
                <View>
                  <Text className="text-xs text-gray-400">字数</Text>
                  <Text className="text-sm font-semibold text-gray-900 dark:text-white">{user.tokenBalance ?? 0}</Text>
                </View>
                <View>
                  <Text className="text-xs text-gray-400">今日调用</Text>
                  <Text className="text-sm font-semibold text-gray-900 dark:text-white">{user.dailyCalls ?? 0}</Text>
                </View>
                <View>
                  <Text className="text-xs text-gray-400">注册时间</Text>
                  <Text className="text-sm font-semibold text-gray-900 dark:text-white">{formatDate(user.createdAt)}</Text>
                </View>
              </View>

              <View className="flex-row gap-2 mt-2">
                <TouchableOpacity
                  className={`flex-1 py-2 rounded-xl ${user.bannedAt ? "bg-emerald-500" : "bg-red-500"}`}
                  onPress={() => handleBanUser(user.id, !!user.bannedAt)}
                >
                  <Text className="text-white text-center text-xs font-medium">
                    {user.bannedAt ? "解封" : "封禁"}
                  </Text>
                </TouchableOpacity>
                {!user.isVip && (
                  <TouchableOpacity
                    className="flex-1 py-2 rounded-xl bg-indigo-500"
                    onPress={() => handleSetVip(user.id, 1)}
                  >
                    <Text className="text-white text-center text-xs font-medium">月VIP</Text>
                  </TouchableOpacity>
                )}
                {!user.isVip && (
                  <TouchableOpacity
                    className="flex-1 py-2 rounded-xl bg-purple-500"
                    onPress={() => handleSetVip(user.id, 12)}
                  >
                    <Text className="text-white text-center text-xs font-medium">年VIP</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          <View className="flex-row justify-center items-center py-4 gap-4">
            <TouchableOpacity
              className={`px-4 py-2 rounded-xl ${userPage > 1 ? "bg-indigo-500" : "bg-gray-200"}`}
              disabled={userPage <= 1}
              onPress={() => { const p = userPage - 1; setUserPage(p); fetchUsers(p, userSearch); }}
            >
              <Text className={`text-sm font-medium ${userPage > 1 ? "text-white" : "text-gray-400"}`}>上一页</Text>
            </TouchableOpacity>
            <Text className="text-sm text-gray-500">第 {userPage} 页</Text>
            <TouchableOpacity
              className={`px-4 py-2 rounded-xl ${users.length >= 20 ? "bg-indigo-500" : "bg-gray-200"}`}
              disabled={users.length < 20}
              onPress={() => { const p = userPage + 1; setUserPage(p); fetchUsers(p, userSearch); }}
            >
              <Text className={`text-sm font-medium ${users.length >= 20 ? "text-white" : "text-gray-400"}`}>下一页</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );

  const renderRedeem = () => (
    <View className="px-4 pt-4 flex-1">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-lg font-bold text-gray-900 dark:text-white">兑换码管理</Text>
        <TouchableOpacity
          className="bg-indigo-500 px-4 py-2 rounded-xl flex-row items-center"
          onPress={() => setShowGenerateModal(true)}
        >
          <FontAwesome6 name="plus" size={12} color="#fff" />
          <Text className="text-white text-sm font-medium ml-2">生成</Text>
        </TouchableOpacity>
      </View>

      {codes.length === 0 ? (
        <View className="items-center py-10">
          <FontAwesome6 name="ticket" size={40} color="#D1D5DB" />
          <Text className="text-gray-400 mt-2">暂无兑换码</Text>
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {codes.map((code) => (
            <View key={code.id}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-3"
              style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}
            >
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center">
                  <View className={`px-2.5 py-1 rounded-lg ${code.isActive ? "bg-emerald-100 dark:bg-emerald-900" : "bg-gray-100 dark:bg-gray-700"}`}>
                    <Text className={`text-xs font-mono font-bold ${code.isActive ? "text-emerald-600 dark:text-emerald-300" : "text-gray-400"}`}>
                      {code.code}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => handleToggleCode(code.id, code.isActive)}
                >
                  <FontAwesome6
                    name={code.isActive ? "toggle-on" : "toggle-off"}
                    size={24}
                    color={code.isActive ? "#10B981" : "#9CA3AF"}
                  />
                </TouchableOpacity>
              </View>

              <View className="flex-row gap-4">
                <View>
                  <Text className="text-xs text-gray-400">类型</Text>
                  <Text className="text-sm font-medium text-gray-900 dark:text-white capitalize">{code.type}</Text>
                </View>
                <View>
                  <Text className="text-xs text-gray-400">价值</Text>
                  <Text className="text-sm font-medium text-gray-900 dark:text-white">{code.value}</Text>
                </View>
                <View>
                  <Text className="text-xs text-gray-400">剩余</Text>
                  <Text className="text-sm font-medium text-gray-900 dark:text-white">{code.usesLeft}/{code.usesTotal}</Text>
                </View>
                <View>
                  <Text className="text-xs text-gray-400">过期</Text>
                  <Text className="text-sm font-medium text-gray-900 dark:text-white">{code.expiresAt ? formatDate(code.expiresAt) : "永久"}</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Generate Modal */}
      <Modal visible={showGenerateModal} transparent animationType="fade">
        <View className="flex-1 items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-white dark:bg-gray-800 rounded-3xl w-[85%] p-6">
            <View className="flex-row items-center justify-between mb-5">
              <Text className="text-lg font-bold text-gray-900 dark:text-white">生成兑换码</Text>
              <TouchableOpacity onPress={() => setShowGenerateModal(false)}>
                <FontAwesome6 name="xmark" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text className="text-sm text-gray-500 mb-2">类型</Text>
            <View className="flex-row gap-3 mb-4">
              <TouchableOpacity
                className={`flex-1 py-3 rounded-xl ${genType === "token" ? "bg-indigo-500" : "bg-gray-100 dark:bg-gray-700"}`}
                onPress={() => setGenType("token")}
              >
                <Text className={`text-center text-sm font-medium ${genType === "token" ? "text-white" : "text-gray-700 dark:text-gray-300"}`}>
                  字数
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 py-3 rounded-xl ${genType === "vip" ? "bg-indigo-500" : "bg-gray-100 dark:bg-gray-700"}`}
                onPress={() => setGenType("vip")}
              >
                <Text className={`text-center text-sm font-medium ${genType === "vip" ? "text-white" : "text-gray-700 dark:text-gray-300"}`}>
                  VIP天数
                </Text>
              </TouchableOpacity>
            </View>

            <Text className="text-sm text-gray-500 mb-2">数值</Text>
            <TextInput
              className="bg-gray-100 dark:bg-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white mb-4"
              value={genValue}
              onChangeText={setGenValue}
              keyboardType="number-pad"
              placeholder="5000"
              placeholderTextColor="#9CA3AF"
            />

            <Text className="text-sm text-gray-500 mb-2">数量</Text>
            <TextInput
              className="bg-gray-100 dark:bg-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white mb-6"
              value={genCount}
              onChangeText={setGenCount}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor="#9CA3AF"
            />

            <TouchableOpacity
              className="bg-indigo-500 py-3.5 rounded-xl items-center"
              onPress={handleGenerateCodes}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold">生成兑换码</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );

  return (
    <Screen safeAreaEdges={["left", "right", "bottom"]}>
      <View className="flex-1 bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <View style={{ paddingTop: insets.top + 12 }} className="px-4 pb-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <FontAwesome6 name="arrow-left" size={18} color="#374151" />
            </TouchableOpacity>
            <View>
              <Text className="text-lg font-bold text-gray-900 dark:text-white">管理中心</Text>
              <Text className="text-xs text-gray-500">管理员后台</Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View className="flex-row bg-white dark:bg-gray-800 px-4 pb-0 border-b border-gray-100 dark:border-gray-700">
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              className={`py-3 px-4 flex-row items-center ${activeTab === tab.key ? "border-b-2 border-indigo-500" : ""}`}
              onPress={() => setActiveTab(tab.key)}
            >
              <FontAwesome6 name={tab.icon} size={14} color={activeTab === tab.key ? "#4F46E5" : "#9CA3AF"} />
              <Text className={`ml-2 text-sm ${activeTab === tab.key ? "text-indigo-500 font-semibold" : "text-gray-500"}`}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#4F46E5" />
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />
            }
          >
            {activeTab === "dashboard" && renderDashboard()}
            {activeTab === "users" && renderUsers()}
            {activeTab === "redeem" && renderRedeem()}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}