import { useState, useCallback, useEffect } from "react";
import {
  View, Text, Image, ScrollView, TouchableOpacity, Modal,
  TextInput, Alert, RefreshControl, ActivityIndicator, Platform,
} from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

// ==================== Types ====================

interface DashboardData {
  totalUsers: number; todayNewUsers: number; totalPosts: number;
  activeCodes: number; usedCodes: number; vipUsers: number;
}

interface User {
  id: string; phone: string; nickname: string | null;
  tokenBalance: number; isVip: boolean; dailyCalls: number;
  createdAt: string; email?: string; role: string;
  vipExpiresAt?: string | null; avatar?: string;
}

interface RedeemCode {
  id: string; code: string; type: string; value: number;
  usesTotal: number; usesLeft: number; expiresAt: string | null;
  isActive: boolean; createdAt: string;
}

interface Post {
  id: string; userId: string; title: string | null; content: string;
  createdAt: string; likesCount: number; commentsCount: number; imageUrls: string[];
}

interface BillingRecord {
  id: string; userId: string; type: string; title: string;
  amount: number; balanceAfter: number; detail: string | null;
  createdAt: string; userPhone: string | null; userName: string | null;
}

interface SystemSetting {
  key: string; value: string; updatedAt: string;
}

interface RedeemLog {
  id: string; code: string; type: string; value: number;
  userPhone: string | null; userName: string | null; createdAt: string;
}

type TabType = "dashboard" | "users" | "redeem" | "posts" | "billing" | "settings";

// ==================== Helpers ====================

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatToken(v: number | undefined | null) {
  if (v == null) return "0";
  if (v >= 10000) return (v / 10000).toFixed(1) + "万";
  return v.toLocaleString();
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between items-center py-2.5 border-b border-gray-100 dark:border-gray-700">
      <Text className="text-sm text-gray-500 dark:text-gray-400">{label}</Text>
      <Text className="text-sm font-medium text-gray-900 dark:text-white text-right flex-1 ml-4">{value}</Text>
    </View>
  );
}

// ==================== Components ====================

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  return (
    <View className="bg-white dark:bg-gray-800 rounded-2xl p-4 flex-1 shadow-sm"
      style={{ shadowColor: color, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 }}
    >
      <View className="w-10 h-10 rounded-xl items-center justify-center mb-2" style={{ backgroundColor: color + "18" }}>
        <FontAwesome6 name={icon} size={18} color={color} />
      </View>
      <Text className="text-2xl font-bold text-gray-900 dark:text-white">{value}</Text>
      <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</Text>
    </View>
  );
}

function Pagination({ page, hasMore, onPrev, onNext }: { page: number; hasMore: boolean; onPrev: () => void; onNext: () => void }) {
  return (
    <View className="flex-row justify-center items-center py-4 gap-3">
      <TouchableOpacity
        className={`px-4 py-1.5 rounded-xl ${page > 1 ? "bg-indigo-500" : "bg-gray-200 dark:bg-gray-700"}`}
        disabled={page <= 1} onPress={onPrev}
      >
        <Text className={`text-sm font-medium ${page > 1 ? "text-white" : "text-gray-400"}`}>上一页</Text>
      </TouchableOpacity>
      <Text className="text-sm text-gray-500 dark:text-gray-400">第 {page} 页</Text>
      <TouchableOpacity
        className={`px-4 py-1.5 rounded-xl ${hasMore ? "bg-indigo-500" : "bg-gray-200 dark:bg-gray-700"}`}
        disabled={!hasMore} onPress={onNext}
      >
        <Text className={`text-sm font-medium ${hasMore ? "text-white" : "text-gray-400"}`}>下一页</Text>
      </TouchableOpacity>
    </View>
  );
}

// ==================== Main Screen ====================

export default function AdminScreen() {
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Session token
  const [token, setToken] = useState<string>("");
  useEffect(() => {
    AsyncStorage.getItem("auth_token").then((t) => { if (t) setToken(t); });
  }, []);

  const headers = useCallback(() => ({ "Content-Type": "application/json", "x-session": token }), [token]);

  // Dashboard data
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [userSearch, setUserSearch] = useState("");
  const [detailUser, setDetailUser] = useState<User | null>(null);
  const [showUserDetail, setShowUserDetail] = useState(false);

  // Redeem
  const [codes, setCodes] = useState<RedeemCode[]>([]);
  const [codePage, setCodePage] = useState(1);
  const [codeTotal, setCodeTotal] = useState(0);
  const [showGenModal, setShowGenModal] = useState(false);
  const [genType, setGenType] = useState<"token" | "vip">("token");
  const [genValue, setGenValue] = useState("5000");
  const [genCount, setGenCount] = useState("1");
  const [generating, setGenerating] = useState(false);

  // Posts
  const [posts, setPosts] = useState<Post[]>([]);
  const [postPage, setPostPage] = useState(1);
  const [postTotal, setPostTotal] = useState(0);
  const [deletingPost, setDeletingPost] = useState<string | null>(null);

  // Billing
  const [bills, setBills] = useState<BillingRecord[]>([]);
  const [billPage, setBillPage] = useState(1);
  const [billTotal, setBillTotal] = useState(0);
  const [billType, setBillType] = useState("");

  // Settings
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [editSettingKey, setEditSettingKey] = useState<string | null>(null);
  const [editSettingValue, setEditSettingValue] = useState("");

  // Redeem logs
  const [redeemLogs, setRedeemLogs] = useState<RedeemLog[]>([]);
  const [showRedeemLogs, setShowRedeemLogs] = useState(false);

  // ==================== API Calls ====================

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/dashboard`, { headers: headers() });
      if (res.ok) setDashboard(await res.json());
    } catch (e) { console.log("fetchDashboard error:", e); }
  }, [headers]);

  const fetchUsers = useCallback(async (page = 1, search = "") => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`${API_BASE}/api/v1/admin/users?${params}`, { headers: headers() });
      if (res.ok) { const d = await res.json(); setUsers(d.users || []); setUserTotal(d.total || 0); }
    } catch (e) { console.log("fetchUsers error:", e); }
  }, [headers]);

  const fetchCodes = useCallback(async (page = 1) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/redeem/list?page=${page}&limit=20`, { headers: headers() });
      if (res.ok) { const d = await res.json(); setCodes(d.codes || []); setCodeTotal(d.total || 0); }
    } catch (e) { console.log("fetchCodes error:", e); }
  }, [headers]);

  const fetchPosts = useCallback(async (page = 1) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/posts?page=${page}&limit=20`, { headers: headers() });
      if (res.ok) { const d = await res.json(); setPosts(d.data || []); setPostTotal(d.total || 0); }
    } catch (e) { console.log("fetchPosts error:", e); }
  }, [headers]);

  const fetchBills = useCallback(async (page = 1, type = "") => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (type) params.set("type", type);
      const res = await fetch(`${API_BASE}/api/v1/admin/billing?${params}`, { headers: headers() });
      if (res.ok) { const d = await res.json(); setBills(d.data || []); setBillTotal(d.total || 0); }
    } catch (e) { console.log("fetchBills error:", e); }
  }, [headers]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/settings`, { headers: headers() });
      if (res.ok) setSettings((await res.json()).data || []);
    } catch (e) { console.log("fetchSettings error:", e); }
  }, [headers]);

  const fetchRedeemLogs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/redeem/logs?page=1&limit=50`, { headers: headers() });
      if (res.ok) setRedeemLogs((await res.json()).data || []);
    } catch (e) { console.log("fetchRedeemLogs error:", e); }
  }, [headers]);

  // ==================== Lifecycle ====================

  // token 加载完成后自动拉取数据
  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      await Promise.all([fetchDashboard(), fetchUsers(1), fetchCodes(1), fetchPosts(1), fetchBills(1), fetchSettings()]);
      setLoading(false);
    })();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // 页面聚焦时刷新（token 就绪后）
  useFocusEffect(
    useCallback(() => {
      if (token) {
        fetchDashboard();
        fetchUsers(userPage, userSearch);
        fetchCodes(codePage);
        fetchPosts(postPage);
        fetchBills(billPage, billType);
        fetchSettings();
      }
    }, [token, fetchDashboard, fetchUsers, fetchCodes, fetchPosts, fetchBills, fetchSettings])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchDashboard(), fetchUsers(userPage, userSearch), fetchCodes(codePage),
      fetchPosts(postPage), fetchBills(billPage, billType), fetchSettings(),
    ]);
    setRefreshing(false);
  }, [fetchDashboard, fetchUsers, fetchCodes, fetchPosts, fetchBills, fetchSettings,
      userPage, userSearch, codePage, postPage, billPage, billType]);

  // ==================== Actions ====================

  const handleBanUser = async (userId: string, banned: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/users/${userId}/ban`, {
        method: "PATCH", headers: headers(),
        body: JSON.stringify({ banned: !banned }),
      });
      if (res.ok) { Alert.alert("成功", banned ? "已解封" : "已封禁"); fetchUsers(userPage, userSearch); }
      else { const d = await res.json(); Alert.alert("错误", d.error || "操作失败"); }
    } catch { Alert.alert("错误", "请求失败"); }
  };

  const handleSetVip = async (userId: string, months: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/users/${userId}/vip`, {
        method: "PATCH", headers: headers(),
        body: JSON.stringify({ months }),
      });
      if (res.ok) { Alert.alert("成功", `已设置VIP ${months} 个月`); fetchUsers(userPage, userSearch); }
      else { const d = await res.json(); Alert.alert("错误", d.error || "操作失败"); }
    } catch { Alert.alert("错误", "请求失败"); }
  };

  const handleToggleCode = async (codeId: string, active: boolean) => {
    try {
      await fetch(`${API_BASE}/api/v1/admin/redeem/${codeId}/toggle`, {
        method: "PATCH", headers: headers(),
        body: JSON.stringify({ active: !active }),
      });
      fetchCodes(codePage);
    } catch (e) { console.log("toggle error:", e); }
  };

  const handleGenerateCodes = async () => {
    if (!genValue || parseInt(genValue) <= 0) { Alert.alert("错误", "请输入有效数值"); return; }
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/redeem/generate`, {
        method: "POST", headers: headers(),
        body: JSON.stringify({ type: genType, value: parseInt(genValue), count: parseInt(genCount) || 1 }),
      });
      if (res.ok) { Alert.alert("成功", "兑换码已生成"); setShowGenModal(false); fetchCodes(1); }
      else { const d = await res.json(); Alert.alert("错误", d.error || "生成失败"); }
    } catch { Alert.alert("错误", "请求失败"); }
    finally { setGenerating(false); }
  };

  const handleDeletePost = (postId: string) => {
    Alert.alert("确认删除", "确定要删除这条帖子吗？", [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: async () => {
        setDeletingPost(postId);
        try {
          const res = await fetch(`${API_BASE}/api/v1/admin/posts/${postId}`, { method: "DELETE", headers: headers() });
          if (res.ok) { Alert.alert("已删除"); fetchPosts(postPage); }
          else Alert.alert("错误", "删除失败");
        } catch { Alert.alert("错误", "请求失败"); }
        finally { setDeletingPost(null); }
      }},
    ]);
  };

  const handleSaveSetting = async () => {
    if (!editSettingKey) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/settings/${editSettingKey}`, {
        method: "PATCH", headers: headers(),
        body: JSON.stringify({ value: editSettingValue }),
      });
      if (res.ok) { Alert.alert("成功", "已更新"); setEditSettingKey(null); fetchSettings(); }
      else Alert.alert("错误", "更新失败");
    } catch { Alert.alert("错误", "请求失败"); }
  };

  const handleManualRedeem = () => {
    Alert.prompt ? Alert.prompt(
      "手动发放资源", "输入: 用户手机号,类型(token/vip/call),数值\n如: 13800138000,token,5000",
      [
        { text: "取消", style: "cancel" },
        { text: "发放", onPress: async (text?: string) => {
          if (!text || text.split(",").length < 3) { Alert.alert("格式错误", "请按格式输入"); return; }
          const [phone, type, value] = text.split(",");
          try {
            const res = await fetch(`${API_BASE}/api/v1/admin/redeem/manual`, {
              method: "POST", headers: headers(),
              body: JSON.stringify({ phone: phone.trim(), type: type.trim(), value: parseInt(value.trim()) }),
            });
            if (res.ok) Alert.alert("成功", "发放成功");
            else { const d = await res.json(); Alert.alert("错误", d.error || "失败"); }
          } catch { Alert.alert("错误", "请求失败"); }
        }},
      ],
      "plain-text"
    ) : Alert.alert("手动发放", "请通过后端接口直接操作");
  };

  // ==================== Tabs Config ====================

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: "dashboard", label: "数据概览", icon: "chart-simple" },
    { key: "users", label: "用户管理", icon: "users" },
    { key: "redeem", label: "兑换码", icon: "ticket" },
    { key: "posts", label: "帖子管理", icon: "file-lines" },
    { key: "billing", label: "账单记录", icon: "receipt" },
    { key: "settings", label: "系统设置", icon: "gear" },
  ];

  // ==================== Render: Dashboard ====================

  const renderDashboard = () => (
    <View className="px-4 pt-4">
      <Text className="text-lg font-bold text-gray-900 dark:text-white mb-4">运营总览</Text>
      <View className="flex-row gap-3 mb-3">
        <StatCard icon="user" label="用户总数" value={dashboard?.totalUsers ?? "-"} color="#4F46E5" />
        <StatCard icon="user-plus" label="今日新增" value={dashboard?.todayNewUsers ?? "-"} color="#10B981" />
      </View>
      <View className="flex-row gap-3 mb-3">
        <StatCard icon="file-lines" label="帖子总数" value={dashboard?.totalPosts ?? "-"} color="#F59E0B" />
        <StatCard icon="crown" label="VIP用户" value={dashboard?.vipUsers ?? "-"} color="#8B5CF6" />
      </View>
      <View className="flex-row gap-3 mb-4">
        <StatCard icon="ticket" label="有效兑换码" value={dashboard?.activeCodes ?? "-"} color="#EC4899" />
        <StatCard icon="check" label="已使用" value={dashboard?.usedCodes ?? "-"} color="#06B6D4" />
      </View>

      <View className="bg-white dark:bg-gray-800 rounded-2xl p-5 mb-4"
        style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
      >
        <Text className="text-base font-semibold text-gray-900 dark:text-white mb-3">快速导航</Text>
        {[
          { icon: "users", label: "用户管理", color: "#4F46E5", tab: "users" as TabType },
          { icon: "ticket", label: "兑换码管理", color: "#EC4899", tab: "redeem" as TabType },
          { icon: "file-lines", label: "帖子管理", color: "#F59E0B", tab: "posts" as TabType },
          { icon: "receipt", label: "账单记录", color: "#06B6D4", tab: "billing" as TabType },
        ].map((item) => (
          <TouchableOpacity
            key={item.tab}
            className="flex-row items-center py-3 border-b border-gray-50 dark:border-gray-700"
            onPress={() => setActiveTab(item.tab)}
          >
            <FontAwesome6 name={item.icon} size={14} color={item.color} />
            <Text className="ml-3 text-sm text-gray-700 dark:text-gray-300">{item.label}</Text>
            <FontAwesome6 name="chevron-right" size={12} color="#9CA3AF" style={{ marginLeft: "auto" }} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // ==================== Render: Users ====================

  const renderUsers = () => (
    <View className="px-4 pt-4 flex-1">
      <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">用户管理</Text>

      <View className="flex-row items-center bg-gray-100 dark:bg-gray-700 rounded-xl px-3 mb-2">
        <FontAwesome6 name="magnifying-glass" size={14} color="#9CA3AF" />
        <TextInput
          className="flex-1 py-2.5 px-2 text-sm text-gray-900 dark:text-white"
          placeholder="搜索手机号/昵称..." placeholderTextColor="#9CA3AF"
          value={userSearch} onChangeText={setUserSearch}
          onSubmitEditing={() => { setUserPage(1); fetchUsers(1, userSearch); }}
          returnKeyType="search"
        />
        {userSearch ? (
          <TouchableOpacity onPress={() => { setUserSearch(""); setUserPage(1); fetchUsers(1, ""); }}>
            <FontAwesome6 name="xmark" size={14} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
      </View>

      <Text className="text-xs text-gray-500 dark:text-gray-400 mb-3">共 {userTotal} 个用户</Text>

      {users.length === 0 ? (
        <View className="items-center py-10">
          <FontAwesome6 name="users" size={40} color="#D1D5DB" />
          <Text className="text-gray-400 mt-2">暂无数据</Text>
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {users.map((user) => (
            <TouchableOpacity key={user.id}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-3"
              style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}
              activeOpacity={0.7} onPress={() => { setDetailUser(user); setShowUserDetail(true); }}
            >
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center flex-1">
                  <View className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900 items-center justify-center">
                    <FontAwesome6 name="user" size={14} color="#4F46E5" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-sm font-semibold text-gray-900 dark:text-white" numberOfLines={1}>
                      {user.nickname || "未设置昵称"}
                    </Text>
                    <Text className="text-xs text-gray-500">{user.phone || user.email || "-"}</Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-1">
                  <FontAwesome6 name="chevron-right" size={12} color="#D1D5DB" />
                </View>
              </View>

              <View className="flex-row gap-2 mt-2">
                {user.isVip && (
                  <View className="bg-purple-100 dark:bg-purple-900 px-2 py-0.5 rounded-full">
                    <Text className="text-xs text-purple-600 dark:text-purple-300 font-medium">VIP</Text>
                  </View>
                )}
                {user.role === 'banned' && (
                  <View className="bg-red-100 dark:bg-red-900 px-2 py-0.5 rounded-full">
                    <Text className="text-xs text-red-600 dark:text-red-300 font-medium">封禁</Text>
                  </View>
                )}
              </View>

              <View className="flex-row justify-between mt-2">
                <View><Text className="text-xs text-gray-400">字数</Text><Text className="text-sm font-semibold text-gray-900 dark:text-white">{user.tokenBalance ?? 0}</Text></View>
                <View><Text className="text-xs text-gray-400">今日调用</Text><Text className="text-sm font-semibold text-gray-900 dark:text-white">{user.dailyCalls ?? 0}</Text></View>
                <View><Text className="text-xs text-gray-400">注册时间</Text><Text className="text-sm font-semibold text-gray-900 dark:text-white">{formatDate(user.createdAt)}</Text></View>
              </View>

              <View className="flex-row gap-2 mt-2">
                <TouchableOpacity
                  className={`flex-1 py-2 rounded-xl ${user.role === 'banned' ? "bg-emerald-500" : "bg-red-500"}`}
                  onPress={() => handleBanUser(user.id, user.role === 'banned')}
                >
                  <Text className="text-white text-center text-xs font-medium">{user.role === 'banned' ? "解封" : "封禁"}</Text>
                </TouchableOpacity>
                {!user.isVip && (
                  <>
                    <TouchableOpacity className="flex-1 py-2 rounded-xl bg-indigo-500" onPress={() => handleSetVip(user.id, 1)}>
                      <Text className="text-white text-center text-xs font-medium">月VIP</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="flex-1 py-2 rounded-xl bg-purple-500" onPress={() => handleSetVip(user.id, 12)}>
                      <Text className="text-white text-center text-xs font-medium">年VIP</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </TouchableOpacity>
          ))}
          <Pagination page={userPage} hasMore={users.length >= 20} onPrev={() => { const p = userPage - 1; setUserPage(p); fetchUsers(p, userSearch); }} onNext={() => { const p = userPage + 1; setUserPage(p); fetchUsers(p, userSearch); }} />
        </ScrollView>
      )}
    </View>
  );

  // ==================== Render: Redeem ====================

  const renderRedeem = () => (
    <View className="px-4 pt-4 flex-1">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-lg font-bold text-gray-900 dark:text-white">兑换码管理</Text>
        <View className="flex-row gap-2">
          <TouchableOpacity className="bg-gray-500 px-3 py-2 rounded-xl flex-row items-center" onPress={() => { setShowRedeemLogs(true); fetchRedeemLogs(); }}>
            <FontAwesome6 name="clock-rotate-left" size={12} color="#fff" />
            <Text className="text-white text-xs font-medium ml-1.5">记录</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-indigo-500 px-4 py-2 rounded-xl flex-row items-center" onPress={() => setShowGenModal(true)}>
            <FontAwesome6 name="plus" size={12} color="#fff" />
            <Text className="text-white text-sm font-medium ml-2">生成</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text className="text-xs text-gray-500 dark:text-gray-400 mb-3">共 {codeTotal} 个兑换码</Text>

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
                <View className={`px-3 py-1.5 rounded-lg ${code.isActive ? "bg-emerald-100 dark:bg-emerald-900" : "bg-gray-100 dark:bg-gray-700"}`}>
                  <Text className={`text-xs font-mono font-bold tracking-wider ${code.isActive ? "text-emerald-600 dark:text-emerald-300" : "text-gray-400"}`}>
                    {code.code}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleToggleCode(code.id, code.isActive)}>
                  <FontAwesome6 name={code.isActive ? "toggle-on" : "toggle-off"} size={24} color={code.isActive ? "#10B981" : "#9CA3AF"} />
                </TouchableOpacity>
              </View>
              <View className="flex-row gap-4">
                <View><Text className="text-xs text-gray-400">类型</Text><Text className="text-sm font-medium text-gray-900 dark:text-white capitalize">{code.type === "token" ? "字数" : "VIP"}</Text></View>
                <View><Text className="text-xs text-gray-400">价值</Text><Text className="text-sm font-medium text-gray-900 dark:text-white">{code.value}{code.type === "vip" ? "天" : ""}</Text></View>
                <View><Text className="text-xs text-gray-400">剩余</Text><Text className="text-sm font-medium text-gray-900 dark:text-white">{code.usesLeft}/{code.usesTotal}</Text></View>
                <View><Text className="text-xs text-gray-400">过期</Text><Text className="text-sm font-medium text-gray-900 dark:text-white">{code.expiresAt ? formatDate(code.expiresAt) : "永久"}</Text></View>
              </View>
            </View>
          ))}
          <Pagination page={codePage} hasMore={codes.length >= 20} onPrev={() => { const p = codePage - 1; setCodePage(p); fetchCodes(p); }} onNext={() => { const p = codePage + 1; setCodePage(p); fetchCodes(p); }} />
        </ScrollView>
      )}

      {/* Generate Modal */}
      <Modal visible={showGenModal} transparent animationType="fade">
        <View className="flex-1 items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-white dark:bg-gray-800 rounded-3xl w-[85%] p-6">
            <View className="flex-row items-center justify-between mb-5">
              <Text className="text-lg font-bold text-gray-900 dark:text-white">生成兑换码</Text>
              <TouchableOpacity onPress={() => setShowGenModal(false)}><FontAwesome6 name="xmark" size={18} color="#6B7280" /></TouchableOpacity>
            </View>
            <Text className="text-sm text-gray-500 mb-2">类型</Text>
            <View className="flex-row gap-3 mb-4">
              <TouchableOpacity className={`flex-1 py-3 rounded-xl ${genType === "token" ? "bg-indigo-500" : "bg-gray-100 dark:bg-gray-700"}`} onPress={() => setGenType("token")}>
                <Text className={`text-center text-sm font-medium ${genType === "token" ? "text-white" : "text-gray-700 dark:text-gray-300"}`}>字数</Text>
              </TouchableOpacity>
              <TouchableOpacity className={`flex-1 py-3 rounded-xl ${genType === "vip" ? "bg-indigo-500" : "bg-gray-100 dark:bg-gray-700"}`} onPress={() => setGenType("vip")}>
                <Text className={`text-center text-sm font-medium ${genType === "vip" ? "text-white" : "text-gray-700 dark:text-gray-300"}`}>VIP天数</Text>
              </TouchableOpacity>
            </View>
            <Text className="text-sm text-gray-500 mb-2">数值</Text>
            <TextInput className="bg-gray-100 dark:bg-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white mb-4" value={genValue} onChangeText={setGenValue} keyboardType="number-pad" placeholder="5000" placeholderTextColor="#9CA3AF" />
            <Text className="text-sm text-gray-500 mb-2">数量</Text>
            <TextInput className="bg-gray-100 dark:bg-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white mb-6" value={genCount} onChangeText={setGenCount} keyboardType="number-pad" placeholder="1" placeholderTextColor="#9CA3AF" />
            <TouchableOpacity className="bg-indigo-500 py-3.5 rounded-xl items-center" onPress={handleGenerateCodes} disabled={generating}>
              {generating ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">生成兑换码</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Redeem Logs Modal */}
      <Modal visible={showRedeemLogs} transparent animationType="slide">
        <View className="flex-1 mt-20" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="flex-1 bg-white dark:bg-gray-800 rounded-t-3xl mt-10">
            <View className="flex-row items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 dark:border-gray-700">
              <Text className="text-lg font-bold text-gray-900 dark:text-white">兑换记录</Text>
              <TouchableOpacity onPress={() => setShowRedeemLogs(false)}><FontAwesome6 name="xmark" size={18} color="#6B7280" /></TouchableOpacity>
            </View>
            <ScrollView className="flex-1 px-4 pt-3">
              {redeemLogs.length === 0 ? (
                <View className="items-center py-10"><Text className="text-gray-400">暂无记录</Text></View>
              ) : (
                redeemLogs.map((log, idx) => (
                  <View key={log.id || idx} className="flex-row items-center py-3 border-b border-gray-50 dark:border-gray-700">
                    <View className="flex-1">
                      <Text className="text-xs font-mono text-indigo-500">{log.code}</Text>
                      <Text className="text-xs text-gray-500 mt-0.5">{log.userPhone || log.userName || "未知用户"} 兑换了 {log.type === "token" ? `${log.value}字数` : `VIP${log.value}天`}</Text>
                    </View>
                    <Text className="text-xs text-gray-400">{formatDateTime(log.createdAt)}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );

  // ==================== Render: Posts ====================

  const renderPosts = () => (
    <View className="px-4 pt-4 flex-1">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-lg font-bold text-gray-900 dark:text-white">帖子管理</Text>
      </View>
      <Text className="text-xs text-gray-500 dark:text-gray-400 mb-3">共 {postTotal} 个帖子</Text>

      {posts.length === 0 ? (
        <View className="items-center py-10">
          <FontAwesome6 name="file-lines" size={40} color="#D1D5DB" />
          <Text className="text-gray-400 mt-2">暂无帖子</Text>
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {posts.map((post) => (
            <View key={post.id}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-3"
              style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}
            >
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-semibold text-gray-900 dark:text-white flex-1" numberOfLines={1}>
                  {post.title || "无标题"}
                </Text>
                <View className="flex-row items-center gap-3">
                  <View className="flex-row items-center"><FontAwesome6 name="heart" size={11} color="#EC4899" /><Text className="text-xs text-gray-500 ml-1">{post.likesCount || 0}</Text></View>
                  <View className="flex-row items-center"><FontAwesome6 name="comment" size={11} color="#6B7280" /><Text className="text-xs text-gray-500 ml-1">{post.commentsCount || 0}</Text></View>
                </View>
              </View>
              <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2" numberOfLines={2}>{post.content}</Text>
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-gray-400">{formatDateTime(post.createdAt)}</Text>
                <TouchableOpacity
                  className="bg-red-500 px-3 py-1.5 rounded-xl"
                  onPress={() => handleDeletePost(post.id)}
                  disabled={deletingPost === post.id}
                >
                  {deletingPost === post.id ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-white text-xs font-medium">删除</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <Pagination page={postPage} hasMore={posts.length >= 20} onPrev={() => { const p = postPage - 1; setPostPage(p); fetchPosts(p); }} onNext={() => { const p = postPage + 1; setPostPage(p); fetchPosts(p); }} />
        </ScrollView>
      )}
    </View>
  );

  // ==================== Render: Billing ====================

  const renderBilling = () => (
    <View className="px-4 pt-4 flex-1">
      <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">账单记录</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
        <View className="flex-row gap-2">
          {[{ key: "", label: "全部" }, { key: "deduction", label: "消费" }, { key: "recharge", label: "充值" }, { key: "reward", label: "奖励" }].map((item) => (
            <TouchableOpacity
              key={item.key}
              className={`px-4 py-2 rounded-xl ${billType === item.key ? "bg-indigo-500" : "bg-gray-100 dark:bg-gray-700"}`}
              onPress={() => { setBillType(item.key); setBillPage(1); fetchBills(1, item.key); }}
            >
              <Text className={`text-xs font-medium ${billType === item.key ? "text-white" : "text-gray-600 dark:text-gray-300"}`}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Text className="text-xs text-gray-500 dark:text-gray-400 mb-3">共 {billTotal} 条记录</Text>

      {bills.length === 0 ? (
        <View className="items-center py-10">
          <FontAwesome6 name="receipt" size={40} color="#D1D5DB" />
          <Text className="text-gray-400 mt-2">暂无记录</Text>
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {bills.map((bill) => (
            <View key={bill.id}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-3"
              style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}
            >
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center">
                  <View className={`w-8 h-8 rounded-xl items-center justify-center ${bill.type === "deduction" ? "bg-red-100 dark:bg-red-900" : bill.type === "recharge" ? "bg-green-100 dark:bg-green-900" : "bg-amber-100 dark:bg-amber-900"}`}>
                    <FontAwesome6 name={bill.type === "deduction" ? "minus" : bill.type === "recharge" ? "plus" : "gift"} size={13} color={bill.type === "deduction" ? "#EF4444" : bill.type === "recharge" ? "#10B981" : "#F59E0B"} />
                  </View>
                  <View className="ml-2.5">
                    <Text className="text-sm font-semibold text-gray-900 dark:text-white">{bill.title}</Text>
                    <Text className="text-xs text-gray-500">{bill.userPhone || bill.userName || "未知用户"}</Text>
                  </View>
                </View>
                <Text className={`text-sm font-bold ${bill.amount >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {bill.amount >= 0 ? "+" : ""}{bill.amount}
                </Text>
              </View>
              <Text className="text-xs text-gray-400">{formatDateTime(bill.createdAt)}</Text>
              {bill.detail && <Text className="text-xs text-gray-400 mt-1">{bill.detail}</Text>}
            </View>
          ))}
          <Pagination page={billPage} hasMore={bills.length >= 20} onPrev={() => { const p = billPage - 1; setBillPage(p); fetchBills(p, billType); }} onNext={() => { const p = billPage + 1; setBillPage(p); fetchBills(p, billType); }} />
        </ScrollView>
      )}
    </View>
  );

  // ==================== Render: Settings ====================

  const renderSettings = () => (
    <View className="px-4 pt-4 flex-1">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-lg font-bold text-gray-900 dark:text-white">系统设置</Text>
      </View>

      <View className="bg-white dark:bg-gray-800 rounded-2xl p-5 mb-4"
        style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}
      >
        <Text className="text-sm font-semibold text-gray-900 dark:text-white mb-3">快捷操作</Text>
        <TouchableOpacity className="flex-row items-center py-3 border-b border-gray-50 dark:border-gray-700" onPress={handleManualRedeem}>
          <FontAwesome6 name="gift" size={14} color="#8B5CF6" />
          <Text className="ml-3 text-sm text-gray-700 dark:text-gray-300">手动发放资源</Text>
          <FontAwesome6 name="chevron-right" size={12} color="#9CA3AF" style={{ marginLeft: "auto" }} />
        </TouchableOpacity>
        <TouchableOpacity className="flex-row items-center py-3" onPress={() => {
          Alert.prompt ? Alert.prompt("统计数据", "手动触发统计更新", [{ text: "取消", style: "cancel" }, { text: "确定" }]) : Alert.alert("提示", "统计数据会自动更新");
        }}>
          <FontAwesome6 name="arrows-rotate" size={14} color="#06B6D4" />
          <Text className="ml-3 text-sm text-gray-700 dark:text-gray-300">刷新统计数据</Text>
          <FontAwesome6 name="chevron-right" size={12} color="#9CA3AF" style={{ marginLeft: "auto" }} />
        </TouchableOpacity>
      </View>

      <Text className="text-sm font-semibold text-gray-900 dark:text-white mb-3">所有配置项</Text>

      {settings.length === 0 ? (
        <View className="items-center py-10">
          <FontAwesome6 name="gear" size={40} color="#D1D5DB" />
          <Text className="text-gray-400 mt-2">暂无配置项</Text>
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {settings.map((setting) => (
            <View key={setting.key}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-3"
              style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}
            >
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-sm font-semibold text-gray-900 dark:text-white font-mono">{setting.key}</Text>
                <TouchableOpacity onPress={() => {
                  try { setEditSettingValue(JSON.parse(setting.value)); } catch { setEditSettingValue(setting.value); }
                  setEditSettingKey(setting.key);
                }}>
                  <FontAwesome6 name="pen-to-square" size={14} color="#4F46E5" />
                </TouchableOpacity>
              </View>
              <Text className="text-xs text-gray-500 dark:text-gray-400" numberOfLines={2}>{setting.value}</Text>
              <Text className="text-xs text-gray-400 mt-1">更新于 {formatDateTime(setting.updatedAt)}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Edit Setting Modal */}
      <Modal visible={!!editSettingKey} transparent animationType="fade">
        <View className="flex-1 items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-white dark:bg-gray-800 rounded-3xl w-[85%] p-6">
            <Text className="text-lg font-bold text-gray-900 dark:text-white mb-1">编辑设置</Text>
            <Text className="text-xs text-gray-500 mb-4 font-mono">{editSettingKey}</Text>
            <TextInput
              className="bg-gray-100 dark:bg-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white mb-4"
              value={editSettingValue} onChangeText={setEditSettingValue}
              multiline numberOfLines={3}
              placeholder="输入值" placeholderTextColor="#9CA3AF"
            />
            <View className="flex-row gap-3">
              <TouchableOpacity className="flex-1 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 items-center" onPress={() => setEditSettingKey(null)}>
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">取消</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 py-3 rounded-xl bg-indigo-500 items-center" onPress={handleSaveSetting}>
                <Text className="text-sm font-medium text-white">保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

  // ==================== Main Render ====================

  return (
    <Screen safeAreaEdges={["left", "right", "bottom"]}>
      <View className="flex-1 bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <View style={{ paddingTop: insets.top + 12 }} className="px-4 pb-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-700 items-center justify-center">
              <FontAwesome6 name="arrow-left" size={16} color="#374151" />
            </TouchableOpacity>
            <View>
              <Text className="text-lg font-bold text-gray-900 dark:text-white">管理中心</Text>
              <Text className="text-xs text-gray-500">管理员后台 · 6个功能模块</Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              className={`py-3 px-4 flex-row items-center ${activeTab === tab.key ? "border-b-2 border-indigo-500" : ""}`}
              onPress={() => setActiveTab(tab.key)}
            >
              <FontAwesome6 name={tab.icon} size={13} color={activeTab === tab.key ? "#4F46E5" : "#9CA3AF"} />
              <Text className={`ml-2 text-sm ${activeTab === tab.key ? "text-indigo-500 font-semibold" : "text-gray-500"}`}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Content */}
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text className="text-gray-400 text-sm mt-3">加载中...</Text>
          </View>
        ) : (
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />}
          >
            {activeTab === "dashboard" && renderDashboard()}
            {activeTab === "users" && renderUsers()}
            {activeTab === "redeem" && renderRedeem()}
            {activeTab === "posts" && renderPosts()}
            {activeTab === "billing" && renderBilling()}
            {activeTab === "settings" && renderSettings()}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>

      {/* 用户详情弹窗 */}
      <Modal visible={showUserDetail} transparent animationType="slide" onRequestClose={() => setShowUserDetail(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' }}>
            {detailUser && (
              <ScrollView>
                {/* 头部 */}
                <View className="flex-row justify-between items-center mb-6">
                  <Text className="text-xl font-bold text-gray-900">用户详情</Text>
                  <TouchableOpacity onPress={() => setShowUserDetail(false)}>
                    <FontAwesome6 name="xmark" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                {/* 基本信息 */}
                <View className="bg-indigo-50 rounded-2xl p-5 mb-4">
                  <View className="flex-row items-center mb-3">
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: detailUser.avatar ? 'transparent' : '#4F46E5', alignItems: 'center', justifyContent: 'center' }}>
                      {detailUser.avatar ? (
                        <Image source={{ uri: detailUser.avatar }} style={{ width: 48, height: 48, borderRadius: 24 }} />
                      ) : (
                        <Text className="text-white text-lg font-bold">{detailUser.nickname?.[0] || '?'}</Text>
                      )}
                    </View>
                    <View className="ml-4 flex-1">
                      <Text className="text-lg font-bold text-gray-900">{detailUser.nickname || '未设置'}</Text>
                      <View className="flex-row items-center mt-1">
                        {detailUser.isVip && <View className="bg-amber-100 px-2 py-0.5 rounded-full mr-2"><Text className="text-amber-600 text-xs font-medium">VIP</Text></View>}
                        {detailUser.role === 'banned' && <View className="bg-red-100 px-2 py-0.5 rounded-full"><Text className="text-red-600 text-xs font-medium">已封禁</Text></View>}
                      </View>
                    </View>
                  </View>
                </View>

                {/* 详细数据 */}
                <View className="bg-gray-50 rounded-2xl p-5 mb-4">
                  <Text className="text-sm font-semibold text-gray-500 mb-3">账号信息</Text>
                  <View className="space-y-3">
                    <InfoRow label="用户ID" value={detailUser.id?.substring(0, 12) + '...'} />
                    <InfoRow label="手机号" value={detailUser.phone || '-'} />
                    <InfoRow label="邮箱" value={detailUser.email || '-'} />
                    <InfoRow label="昵称" value={detailUser.nickname || '-'} />
                    <InfoRow label="角色" value={detailUser.role || 'user'} />
                  </View>
                </View>

                <View className="bg-gray-50 rounded-2xl p-5 mb-4">
                  <Text className="text-sm font-semibold text-gray-500 mb-3">资源与权限</Text>
                  <View className="space-y-3">
                    <InfoRow label="字数余额" value={formatToken(detailUser.tokenBalance || 0)} />
                    <InfoRow label="今日调用" value={`${detailUser.dailyCalls || 0} 次`} />
                    <InfoRow label="VIP状态" value={detailUser.isVip ? '已开通' : '未开通'} />
                    <InfoRow label="VIP到期" value={detailUser.vipExpiresAt ? formatDateTime(detailUser.vipExpiresAt) : '-'} />
                  </View>
                </View>

                <View className="bg-gray-50 rounded-2xl p-5 mb-6">
                  <Text className="text-sm font-semibold text-gray-500 mb-3">时间信息</Text>
                  <View className="space-y-3">
                    <InfoRow label="注册时间" value={formatDateTime(detailUser.createdAt)} />
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}