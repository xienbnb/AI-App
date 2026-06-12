import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Keyboard,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome6 } from "@expo/vector-icons";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { useAuth } from "@/contexts/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Uniwind } from 'uniwind';

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

// ---- 配额卡片组件 ----
function QuotaCard() {
  const router = useSafeRouter();
  const [quota, setQuota] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const API = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("auth_token");
        const headers: Record<string, string> = {};
        if (token) headers["x-session"] = token;
        const res = await fetch(`${API}/api/v1/vip/quota`, { headers });
        const json = await res.json();
        if (json.success) setQuota(json.data);
      } catch (e) {
        console.error("获取配额失败", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return null;
  if (!quota) {
    return (
      <View className="mx-4 mt-3">
        <TouchableOpacity
          className="bg-white rounded-2xl p-4 border border-gray-100 items-center"
          onPress={() => router.push("/recharge")}
        >
          <Text className="text-sm text-indigo-500 font-medium">查看字数额度</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isUnlimited = quota.isUnlimited || false;
  const monthlyRemaining = quota.monthly?.remaining ?? 0;
  const monthlyTotal = quota.monthly?.total ?? 100;
  const callPercent = monthlyTotal > 0 ? Math.min((1 - monthlyRemaining / monthlyTotal) * 100, 100) : 0;

  return (
    <View className="mx-4 mt-3">
      <TouchableOpacity
        className="bg-white rounded-2xl p-5 border border-gray-100"
        onPress={() => router.push("/recharge")}
        activeOpacity={0.7}
      >
        {/* 字数额度（余额制） */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-sm font-semibold text-gray-900">字数额度（余额）</Text>
          <View className="flex-row items-center">
            <Text className="text-lg font-bold text-indigo-600">
              {quota.tokenBalance?.toLocaleString() || 0}
            </Text>
            <Text className="text-xs text-gray-400 ml-1">字</Text>
            <FontAwesome6 name="chevron-right" size={12} color="#D1D5DB" style={{ marginLeft: 8 }} />
          </View>
        </View>
        <Text className="text-xs text-gray-400 mb-3">字数长期有效，用完需购买</Text>

        {/* AI调用次数（月度制） */}
        <View className="flex-row items-center justify-between pt-3 border-t border-gray-50">
          <View className="flex-row items-center">
            <FontAwesome6 name="microchip" size={12} color="#9CA3AF" />
            <Text className="text-xs text-gray-400 ml-2">AI调用次数（月度）</Text>
          </View>
          <Text className="text-xs font-medium text-gray-600">
            {isUnlimited ? (
              <Text className="text-green-500 font-bold">不限次数</Text>
            ) : (
              `${monthlyRemaining}/${monthlyTotal} 次`
            )}
          </Text>
        </View>
        {!isUnlimited && (
          <View className="h-2 rounded-full bg-gray-100 overflow-hidden mt-2">
            <View className="h-full rounded-full bg-green-400" style={{ width: `${Math.max(0, 100 - callPercent)}%` }} />
          </View>
        )}

        {/* 会员标识 */}
        {quota?.isVip && (
          <View className="mt-3 pt-3 border-t border-gray-50 flex-row items-center">
            <FontAwesome6 name="crown" size={12} color="#F59E0B" />
            <Text className="text-xs text-amber-500 font-medium ml-1.5">
              {quota.planName} · 无限字数 · 无限调用
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useSafeRouter();
  const { user, logout } = useAuth();
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [customKey, setCustomKey] = useState<{ hasKey: boolean; masked: string }>({ hasKey: false, masked: '' });
  const [keyInput, setKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [quota, setQuota] = useState<any>(null);
  const [loadingQuota, setLoadingQuota] = useState(true);

  useEffect(() => {
    fetchQuota();
    fetchCustomKey();
  }, []);

  const fetchQuota = async () => {
    try {
      setLoadingQuota(true);
      const token = await AsyncStorage.getItem("auth_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["x-session"] = token;
      const res = await fetch(`${API_BASE}/api/v1/vip/quota`, { headers });
      const json = await res.json();
      if (json.success && json.data) {
        setQuota(json.data);
      }
    } catch (e) {
      console.error("获取配额失败", e);
    } finally {
      setLoadingQuota(false);
    }
  };

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

  // --- 主题设置 ---
  const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";
  const THEME_KEY = "user_theme";
  const [currentTheme, setCurrentTheme] = useState("system");
  const [themeSaving, setThemeSaving] = useState(false);

  const fetchCustomKey = async () => {
    try {
      const token = await AsyncStorage.getItem("auth_token");
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/v1/auth/custom-key`, {
        headers: { "x-session": token },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.hasKey) {
          setCustomKey({ hasKey: true, masked: data.maskedKey });
          setKeyInput(data.maskedKey || '');
        }
      }
    } catch {}
  };

  const handleSaveKey = async () => {
    if (!keyInput.trim()) return;
    setSavingKey(true);
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE}/api/v1/auth/custom-key`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-session": token || "" },
        body: JSON.stringify({ key: keyInput.trim() }),
      });
      if (res.ok) {
        setCustomKey({ hasKey: true, masked: keyInput.trim().slice(0, 8) + '...' });
        Alert.alert("保存成功", "自定义 API Key 已设置");
        setShowKeyModal(false);
      } else {
        Alert.alert("保存失败", "请检查 Key 格式后重试");
      }
    } catch {
      Alert.alert("网络错误", "请检查网络后重试");
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteKey = async () => {
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE}/api/v1/auth/custom-key`, {
        method: "DELETE",
        headers: { "x-session": token || "" },
      });
      if (res.ok) {
        setCustomKey({ hasKey: false, masked: '' });
        setKeyInput('');
        Alert.alert("已删除", "自定义 API Key 已移除，将使用平台 Key");
        setShowKeyModal(false);
      }
    } catch {}
  };

  const themeOptions = [
    { id: "system", label: "跟随系统", desc: "自动根据系统设置切换", icon: "mobile-screen-button", primary: "#4F46E5", bg: "#F9FAFB", surface: "#FFFFFF", text: "#111827" },
    { id: "light", label: "亮色模式", desc: "明亮清晰的界面", icon: "sun", primary: "#4F46E5", bg: "#FFFFFF", surface: "#F3F4F6", text: "#111827" },
    { id: "dark", label: "深色模式", desc: "暗色背景，适合夜间", icon: "moon", primary: "#818CF8", bg: "#0F172A", surface: "#1E293B", text: "#F1F5F9" },
    { id: "sepia", label: "护眼模式", desc: "暖色纸张质感", icon: "book", primary: "#8B6914", bg: "#FBF0D9", surface: "#F5E6C8", text: "#5B4636" },
    { id: "green", label: "绿色模式", desc: "淡绿色背景，舒缓疲劳", icon: "leaf", primary: "#059669", bg: "#ECFDF5", surface: "#D1FAE5", text: "#064E3B" },
  ];

  function mapToUniwindTheme(themeId: string): "system" | "light" | "dark" {
    switch (themeId) {
      case "dark": return "dark";
      case "sepia":
      case "green":
      case "light": return "light";
      default: return "system";
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_KEY);
        if (saved) setCurrentTheme(saved);
      } catch (e) { console.error("读取主题缓存失败", e); }
    })();
  }, []);

  const selectTheme = useCallback(async (themeId: string) => {
    try {
      setThemeSaving(true);
      await AsyncStorage.setItem(THEME_KEY, themeId);
      setCurrentTheme(themeId);
      Uniwind.setTheme(mapToUniwindTheme(themeId));
      const token = await AsyncStorage.getItem("auth_token");
      if (token) {
        fetch(`${API_BASE}/api/v1/users/theme`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ theme: themeId }),
        }).catch((e) => console.error("主题持久化失败", e));
      }
      setShowThemeModal(false);
    } catch (e) {
      console.error("保存主题失败", e);
    } finally {
      setThemeSaving(false);
    }
  }, []);

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
        {/* 用户信息摘要 - 未登录状态 */}
        {!user ? (
          <View className="mx-4 mt-4 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 items-center">
            <View className="w-16 h-16 rounded-full bg-gray-200 items-center justify-center mb-3">
              <FontAwesome6 name="user" size={28} color="#9CA3AF" />
            </View>
            <Text className="text-lg font-bold text-gray-400 mb-1">未登录</Text>
            <Text className="text-sm text-gray-400 text-center mb-4 leading-5">
              登录后可同步数据到云端，{'\n'}避免设备更换导致数据丢失
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/login")}
              className="px-8 py-3 rounded-full bg-indigo-500"
            >
              <Text className="text-base font-semibold text-white">登录 / 注册</Text>
            </TouchableOpacity>
          </View>
        ) : (
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
        )}

        {/* 字数额度 - 未登录时提示 */}
        {!user ? (
          <View className="mx-4 mt-3 bg-white rounded-2xl p-5 shadow-sm border border-gray-100 items-center">
            <FontAwesome6 name="lock" size={20} color="#D1D5DB" />
            <Text className="text-sm text-gray-400 mt-2">登录后可查看字数额度</Text>
          </View>
        ) : (
          <QuotaCard />
        )}

        {/* AI配置：自定义Key - 仅登录可见 */}
        {user && (
        <View className="mx-4 mt-6">
          <Text className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-1">
            AI 配置
          </Text>
          <View className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <SettingsItem
              icon="key"
              label="自定义 API Key"
              description={customKey?.hasKey ? "已设置，使用自己的 Key 消耗" : "未设置，使用平台 Key"}
              onPress={() => setShowKeyModal(true)}
            />
          </View>
        </View>
        )}

        {/* 账号与安全 - 仅登录可见 */}
        {user && (
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
              description="密码、手机号、邮箱、社交账号绑定"
              onPress={() => {
                router.push("/account-security");
              }}
            />
          </View>
        </View>
        )}

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
              onPress={() => setShowThemeModal(true)}
            />
          </View>
        </View>

        {/* 其他 - 仅登录可见 */}
        {user && (
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
        )}

        {/* 版本信息 */}
        <Text className="text-center text-xs text-gray-300 mt-8">
          App Version 1.0.0
        </Text>
      </ScrollView>

      {/* 主题设置 Modal */}
      <Modal visible={showThemeModal} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setShowThemeModal(false)}>
          <View className="flex-1 bg-black/40 justify-end">
            <TouchableWithoutFeedback>
              <View className="bg-white rounded-t-3xl pb-8 max-h-[70%]">
                {/* Handle */}
                <View className="items-center pt-3 pb-1">
                  <View className="w-10 h-1 rounded-full bg-gray-300" />
                </View>
                {/* Header */}
                <View className="px-6 py-3 flex-row items-center">
                  <View className="w-10 h-10 rounded-2xl bg-indigo-50 items-center justify-center mr-3">
                    <FontAwesome6 name="palette" size={18} color="#4F46E5" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-gray-900">选择主题</Text>
                    <Text className="text-xs text-gray-400">自定义应用外观风格</Text>
                  </View>
                  <TouchableOpacity
                    className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                    onPress={() => setShowThemeModal(false)}
                  >
                    <FontAwesome6 name="xmark" size={14} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                <ScrollView className="px-6" showsVerticalScrollIndicator={false}>
                  {themeOptions.map((t) => {
                    const isActive = currentTheme === t.id;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        className={`flex-row items-center p-4 mb-3 rounded-2xl border-2 ${
                          isActive ? "border-indigo-500" : "border-gray-100"
                        }`}
                        onPress={() => selectTheme(t.id)}
                        disabled={themeSaving}
                      >
                        <View
                          className="w-12 h-12 rounded-xl items-center justify-center mr-3"
                          style={{ backgroundColor: t.surface }}
                        >
                          <FontAwesome6 name={t.icon as any} size={18} color={t.primary} />
                        </View>
                        <View className="flex-1">
                          <Text className="text-base font-semibold text-gray-900">{t.label}</Text>
                          <Text className="text-xs text-gray-400 mt-0.5">{t.desc}</Text>
                        </View>
                        {/* 颜色样本 */}
                        <View className="flex-row gap-1 mr-2">
                          <View className="w-5 h-5 rounded-full" style={{ backgroundColor: t.primary }} />
                          <View className="w-5 h-5 rounded-full" style={{ backgroundColor: t.bg }} />
                          <View className="w-5 h-5 rounded-full" style={{ backgroundColor: t.text }} />
                        </View>
                        {isActive && (
                          <View className="w-6 h-6 rounded-full bg-indigo-500 items-center justify-center">
                            <FontAwesome6 name="check" size={10} color="#fff" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                  {themeSaving && (
                    <View className="items-center py-4">
                      <Text className="text-sm text-gray-400">保存中...</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* 自定义 API Key Modal */}
      <Modal visible={showKeyModal} transparent animationType="slide" onRequestClose={() => setShowKeyModal(false)}>
        <TouchableWithoutFeedback onPress={() => setShowKeyModal(false)}>
          <View className="flex-1 bg-black/40 justify-end">
            <TouchableWithoutFeedback>
              <View className="bg-white rounded-t-3xl pb-8">
                <View className="items-center pt-3 pb-1">
                  <View className="w-10 h-1 rounded-full bg-gray-300" />
                </View>
                <View className="px-6 py-3 flex-row items-center">
                  <View className="w-10 h-10 rounded-2xl bg-emerald-50 items-center justify-center mr-3">
                    <FontAwesome6 name="key" size={18} color="#059669" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-gray-900">自定义 API Key</Text>
                    <Text className="text-xs text-gray-400">使用自己的 Key 不计字数消耗，仅计调用次数</Text>
                  </View>
                  <TouchableOpacity
                    className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                    onPress={() => setShowKeyModal(false)}
                  >
                    <FontAwesome6 name="xmark" size={14} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                <View className="px-6 py-4">
                  <Text className="text-sm font-medium text-gray-700 mb-1.5">API Key</Text>
                  <TextInput
                    className="w-full px-4 py-3 bg-gray-50 rounded-xl text-gray-900 border border-gray-200"
                    placeholder="输入您的 API Key"
                    placeholderTextColor="#9CA3AF"
                    value={keyInput}
                    onChangeText={setKeyInput}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {customKey.hasKey && (
                    <Text className="text-xs text-amber-500 mt-1.5">
                      当前已设置 Key：{customKey.masked}，修改后原 Key 将失效
                    </Text>
                  )}
                </View>
                <View className="px-6 flex-row gap-3">
                  {customKey.hasKey && (
                    <TouchableOpacity
                      className="flex-1 py-3.5 rounded-xl bg-red-50 items-center"
                      onPress={handleDeleteKey}
                    >
                      <Text className="text-sm font-semibold text-red-500">删除 Key</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    className={`flex-1 py-3.5 rounded-xl items-center ${savingKey ? 'bg-emerald-300' : 'bg-emerald-500'}`}
                    onPress={handleSaveKey}
                    disabled={savingKey || !keyInput.trim()}
                  >
                    <Text className="text-sm font-semibold text-white">
                      {savingKey ? '保存中...' : '保存'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}