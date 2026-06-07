import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
  const token = await AsyncStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { "x-session": token } : {}),
  };
}

/* ───── 绑定信息类型 ───── */
interface BindingsData {
  phone: string;
  email: string;
  emailVerified: boolean;
  hasPassword: boolean;
  wechat: { bound: boolean; nickname: string };
  qq: { bound: boolean; nickname: string };
}

/* ───── 弹窗类型 ───── */
type ModalType =
  | null
  | "changePassword"
  | "changePhone"
  | "bindEmail"
  | "bindWechat"
  | "bindQQ";

/* ───── 安全区项组件 ───── */
function SecurityItem({
  icon,
  label,
  status,
  statusColor,
  onPress,
}: {
  icon: string;
  label: string;
  status: string;
  statusColor?: string;
  onPress: () => void;
}) {
  const [bg, txt, muted, card, borderT] = useCSSVariable([
    "--color-background",
    "--color-foreground",
    "--color-muted",
    "--color-card",
    "--color-border",
  ]) as string[];
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      className="flex-row items-center justify-between px-5 py-4 rounded-2xl mb-3"
      style={{ backgroundColor: card || "#fff" }}
    >
      <View className="flex-row items-center gap-3">
        <View
          className="w-10 h-10 rounded-xl items-center justify-center"
          style={{ backgroundColor: `${bg || "#F3F4F6"}88` }}
        >
          <FontAwesome6 name={icon as any} size={18} color={txt || "#1F2937"} />
        </View>
        <Text className="text-base font-medium" style={{ color: txt || "#1F2937" }}>
          {label}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <Text className="text-sm" style={{ color: statusColor || muted || "#9CA3AF" }}>
          {status}
        </Text>
        <FontAwesome6 name="chevron-right" size={12} color={muted || "#9CA3AF"} />
      </View>
    </TouchableOpacity>
  );
}

/* ───── 主页面 ───── */
export default function AccountSecurityScreen() {
  const router = useSafeRouter();
  const [bg, txt, muted, card, accent, border] = useCSSVariable([
    "--color-background",
    "--color-foreground",
    "--color-muted",
    "--color-card",
    "--color-accent",
    "--color-border",
  ]) as string[];

  const [bindings, setBindings] = useState<BindingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── 弹窗表单状态 ──
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 手机号修改
  const [oldPhone, setOldPhone] = useState("");
  const [oldPhoneCode, setOldPhoneCode] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPhoneCode, setNewPhoneCode] = useState("");

  // 邮箱绑定
  const [bindEmail, setBindEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");

  // 社交绑定
  const [socialNickname, setSocialNickname] = useState("");

  // ── 获取绑定信息 ──
  const fetchBindings = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/bindings`, { headers });
      const data = await res.json();
      if (res.ok) {
        setBindings(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBindings();
  }, [fetchBindings]);

  // ── 发送验证码 ──
  const handleSendCode = async (target: string) => {
    const headers = await getAuthHeaders();
    const body = target.includes("@") ? { email: target } : { phone: target };
    const res = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/send-otp`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      Alert.alert("验证码已发送", `验证码：${data.code}（开发环境）`);
    } else {
      Alert.alert("发送失败", data.error || "请稍后重试");
    }
  };

  // ── 修改密码 ──
  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert("提示", "请填写完整");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("提示", "新密码至少6位");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("提示", "两次输入的新密码不一致");
      return;
    }
    setSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/change-password`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert("成功", "密码已修改");
        setModalType(null);
        resetPasswordForm();
        fetchBindings();
      } else {
        Alert.alert("失败", data.error || "修改密码失败");
      }
    } catch {
      Alert.alert("错误", "网络异常");
    } finally {
      setSubmitting(false);
    }
  };

  // ── 修改手机号 ──
  const handleChangePhone = async () => {
    if (!oldPhone || !oldPhoneCode || !newPhone || !newPhoneCode) {
      Alert.alert("提示", "请填写完整");
      return;
    }
    setSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/change-phone`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ oldPhone, oldCode: oldPhoneCode, newPhone, newCode: newPhoneCode }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert("成功", "手机号已修改");
        setModalType(null);
        resetPhoneForm();
        fetchBindings();
      } else {
        Alert.alert("失败", data.error || "修改手机号失败");
      }
    } catch {
      Alert.alert("错误", "网络异常");
    } finally {
      setSubmitting(false);
    }
  };

  // ── 绑定邮箱 ──
  const handleBindEmail = async () => {
    if (!bindEmail || !emailCode) {
      Alert.alert("提示", "请填写完整");
      return;
    }
    setSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/bind-email`, {
        method: "POST",
        headers,
        body: JSON.stringify({ email: bindEmail, code: emailCode }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert("成功", "邮箱已绑定");
        setModalType(null);
        setBindEmail("");
        setEmailCode("");
        fetchBindings();
      } else {
        Alert.alert("失败", data.error || "绑定邮箱失败");
      }
    } catch {
      Alert.alert("错误", "网络异常");
    } finally {
      setSubmitting(false);
    }
  };

  // ── 绑定社交账号 ──
  const handleBindSocial = async (platform: "wechat" | "qq") => {
    const openid = `${platform}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/bind-social`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          platform,
          openid,
          nickname: socialNickname || (platform === "wechat" ? "微信用户" : "QQ用户"),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert("成功", `${platform === "wechat" ? "微信" : "QQ"}绑定成功`);
        setModalType(null);
        setSocialNickname("");
        fetchBindings();
      } else {
        Alert.alert("失败", data.error || "绑定失败");
      }
    } catch {
      Alert.alert("错误", "网络异常");
    } finally {
      setSubmitting(false);
    }
  };

  const resetPasswordForm = () => {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };
  const resetPhoneForm = () => {
    setOldPhone("");
    setOldPhoneCode("");
    setNewPhone("");
    setNewPhoneCode("");
  };

  /* ──── 渲染各种 Modal ──── */
  const renderModal = () => {
    if (!modalType) return null;

    const titleMap: Record<string, string> = {
      changePassword: "修改密码",
      changePhone: "修改手机号",
      bindEmail: "绑定邮箱",
      bindWechat: "绑定微信",
      bindQQ: "绑定QQ",
    };

    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setModalType(null)}>
        <TouchableOpacity
          activeOpacity={1}
          className="flex-1 justify-end"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onPress={() => setModalType(null)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <TouchableOpacity activeOpacity={1}>
              <View
                className="rounded-t-3xl px-6 pt-6 pb-10"
                style={{ backgroundColor: bg || "#F9FAFB" }}
              >
                <View className="flex-row items-center justify-between mb-6">
                  <Text className="text-xl font-bold" style={{ color: txt || "#1F2937" }}>
                    {titleMap[modalType]}
                  </Text>
                  <TouchableOpacity onPress={() => setModalType(null)}>
                    <FontAwesome6 name="xmark" size={20} color={muted || "#9CA3AF"} />
                  </TouchableOpacity>
                </View>

                <ScrollView className="max-h-96" showsVerticalScrollIndicator={false}>
                  {/* ── 修改密码 ── */}
                  {modalType === "changePassword" && (
                    <>
                      <TextInput
                        className="w-full h-12 px-4 rounded-xl mb-3"
                        style={{ backgroundColor: card || "#fff", color: txt || "#1F2937" }}
                        placeholder="当前密码"
                        placeholderTextColor={muted || "#9CA3AF"}
                        secureTextEntry
                        value={oldPassword}
                        onChangeText={setOldPassword}
                      />
                      <TextInput
                        className="w-full h-12 px-4 rounded-xl mb-3"
                        style={{ backgroundColor: card || "#fff", color: txt || "#1F2937" }}
                        placeholder="新密码（至少6位）"
                        placeholderTextColor={muted || "#9CA3AF"}
                        secureTextEntry
                        value={newPassword}
                        onChangeText={setNewPassword}
                      />
                      <TextInput
                        className="w-full h-12 px-4 rounded-xl mb-6"
                        style={{ backgroundColor: card || "#fff", color: txt || "#1F2937" }}
                        placeholder="确认新密码"
                        placeholderTextColor={muted || "#9CA3AF"}
                        secureTextEntry
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                      />
                    </>
                  )}

                  {/* ── 修改手机号 ── */}
                  {modalType === "changePhone" && (
                    <>
                      <Text className="text-sm mb-2 font-medium" style={{ color: muted || "#6B7280" }}>
                        第一步：验证旧手机号
                      </Text>
                      <View className="flex-row gap-2 mb-3">
                        <TextInput
                          className="flex-1 h-12 px-4 rounded-xl"
                          style={{ backgroundColor: card || "#fff", color: txt || "#1F2937" }}
                          placeholder="旧手机号"
                          placeholderTextColor={muted || "#9CA3AF"}
                          keyboardType="phone-pad"
                          value={oldPhone}
                          onChangeText={setOldPhone}
                        />
                        <TouchableOpacity
                          className="h-12 px-4 rounded-xl items-center justify-center"
                          style={{ backgroundColor: accent || "#4F46E5" }}
                          onPress={() => oldPhone && handleSendCode(oldPhone)}
                        >
                          <Text className="text-white text-sm font-medium">获取验证码</Text>
                        </TouchableOpacity>
                      </View>
                      <TextInput
                        className="w-full h-12 px-4 rounded-xl mb-5"
                        style={{ backgroundColor: card || "#fff", color: txt || "#1F2937" }}
                        placeholder="旧手机号验证码"
                        placeholderTextColor={muted || "#9CA3AF"}
                        keyboardType="number-pad"
                        value={oldPhoneCode}
                        onChangeText={setOldPhoneCode}
                      />

                      <Text className="text-sm mb-2 font-medium" style={{ color: muted || "#6B7280" }}>
                        第二步：绑定新手机号
                      </Text>
                      <View className="flex-row gap-2 mb-3">
                        <TextInput
                          className="flex-1 h-12 px-4 rounded-xl"
                          style={{ backgroundColor: card || "#fff", color: txt || "#1F2937" }}
                          placeholder="新手机号"
                          placeholderTextColor={muted || "#9CA3AF"}
                          keyboardType="phone-pad"
                          value={newPhone}
                          onChangeText={setNewPhone}
                        />
                        <TouchableOpacity
                          className="h-12 px-4 rounded-xl items-center justify-center"
                          style={{ backgroundColor: accent || "#4F46E5" }}
                          onPress={() => newPhone && handleSendCode(newPhone)}
                        >
                          <Text className="text-white text-sm font-medium">获取验证码</Text>
                        </TouchableOpacity>
                      </View>
                      <TextInput
                        className="w-full h-12 px-4 rounded-xl mb-2"
                        style={{ backgroundColor: card || "#fff", color: txt || "#1F2937" }}
                        placeholder="新手机号验证码"
                        placeholderTextColor={muted || "#9CA3AF"}
                        keyboardType="number-pad"
                        value={newPhoneCode}
                        onChangeText={setNewPhoneCode}
                      />
                    </>
                  )}

                  {/* ── 绑定邮箱 ── */}
                  {modalType === "bindEmail" && (
                    <>
                      <View className="flex-row gap-2 mb-3">
                        <TextInput
                          className="flex-1 h-12 px-4 rounded-xl"
                          style={{ backgroundColor: card || "#fff", color: txt || "#1F2937" }}
                          placeholder="输入邮箱地址"
                          placeholderTextColor={muted || "#9CA3AF"}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          value={bindEmail}
                          onChangeText={setBindEmail}
                        />
                        <TouchableOpacity
                          className="h-12 px-4 rounded-xl items-center justify-center"
                          style={{ backgroundColor: accent || "#4F46E5" }}
                          onPress={() => bindEmail && handleSendCode(bindEmail)}
                        >
                          <Text className="text-white text-sm font-medium">获取验证码</Text>
                        </TouchableOpacity>
                      </View>
                      <TextInput
                        className="w-full h-12 px-4 rounded-xl mb-2"
                        style={{ backgroundColor: card || "#fff", color: txt || "#1F2937" }}
                        placeholder="邮箱验证码"
                        placeholderTextColor={muted || "#9CA3AF"}
                        keyboardType="number-pad"
                        value={emailCode}
                        onChangeText={setEmailCode}
                      />
                    </>
                  )}

                  {/* ── 绑定微信/QQ ── */}
                  {(modalType === "bindWechat" || modalType === "bindQQ") && (
                    <>
                      <View className="items-center py-4 mb-4">
                        <View
                          className="w-20 h-20 rounded-full items-center justify-center mb-3"
                          style={{ backgroundColor: modalType === "bindWechat" ? "#07C16030" : "#12B7F530" }}
                        >
                          <FontAwesome6
                            name={modalType === "bindWechat" ? "weixin" : "qq"}
                            size={36}
                            color={modalType === "bindWechat" ? "#07C160" : "#12B7F5"}
                          />
                        </View>
                        <Text className="text-base" style={{ color: muted || "#6B7280" }}>
                          点击下方按钮授权绑定
                        </Text>
                      </View>
                      <TextInput
                        className="w-full h-12 px-4 rounded-xl mb-4"
                        style={{ backgroundColor: card || "#fff", color: txt || "#1F2937" }}
                        placeholder="社交账号昵称（选填）"
                        placeholderTextColor={muted || "#9CA3AF"}
                        value={socialNickname}
                        onChangeText={setSocialNickname}
                      />
                    </>
                  )}
                </ScrollView>

                {/* 提交按钮 */}
                <TouchableOpacity
                  className="w-full h-12 rounded-xl items-center justify-center mt-4"
                  style={{ backgroundColor: accent || "#4F46E5", opacity: submitting ? 0.6 : 1 }}
                  disabled={submitting}
                  onPress={() => {
                    if (modalType === "changePassword") handleChangePassword();
                    else if (modalType === "changePhone") handleChangePhone();
                    else if (modalType === "bindEmail") handleBindEmail();
                    else if (modalType === "bindWechat") handleBindSocial("wechat");
                    else if (modalType === "bindQQ") handleBindSocial("qq");
                  }}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white text-base font-semibold">确认</Text>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    );
  };

  if (loading) {
    return (
      <Screen safeAreaEdges={["top", "left", "right"]}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={accent || "#4F46E5"} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen safeAreaEdges={["top", "left", "right"]}>
      <View className="flex-1" style={{ backgroundColor: bg || "#F9FAFB" }}>
        {/* 顶部导航 */}
        <View
          className="flex-row items-center px-4 py-3"
          style={{ borderBottomWidth: 1, borderBottomColor: border || "#E5E7EB", backgroundColor: card || "#fff" }}
        >
          <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
            <FontAwesome6 name="arrow-left" size={18} color={txt || "#1F2937"} />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-lg font-bold mr-10" style={{ color: txt || "#1F2937" }}>
            账号与安全
          </Text>
        </View>

        <ScrollView className="flex-1 px-4 pt-6" showsVerticalScrollIndicator={false}>
          {/* ── 账号信息卡片 ── */}
          <View className="rounded-2xl p-5 mb-6" style={{ backgroundColor: card || "#fff" }}>
            <View className="flex-row items-center gap-3 mb-4">
              <View
                className="w-14 h-14 rounded-full items-center justify-center"
                style={{ backgroundColor: `${accent || "#4F46E5"}15` }}
              >
                <FontAwesome6 name="user" size={22} color={accent || "#4F46E5"} />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-bold" style={{ color: txt || "#1F2937" }}>
                  账号安全
                </Text>
                <Text className="text-sm mt-1" style={{ color: muted || "#9CA3AF" }}>
                  保护账号安全，及时更新绑定信息
                </Text>
              </View>
            </View>
            <View className="flex-row items-center gap-2">
              {bindings?.hasPassword ? (
                <View className="flex-row items-center gap-1 px-3 py-1 rounded-full" style={{ backgroundColor: "#05966920" }}>
                  <FontAwesome6 name="lock" size={10} color="#059669" />
                  <Text className="text-xs text-green-700">已设置密码</Text>
                </View>
              ) : (
                <View className="flex-row items-center gap-1 px-3 py-1 rounded-full" style={{ backgroundColor: "#DC262620" }}>
                  <FontAwesome6 name="unlock" size={10} color="#DC2626" />
                  <Text className="text-xs text-red-600">未设置密码</Text>
                </View>
              )}
              {bindings?.email && (
                <View className="flex-row items-center gap-1 px-3 py-1 rounded-full" style={{ backgroundColor: "#2563EB20" }}>
                  <FontAwesome6 name="envelope" size={10} color="#2563EB" />
                  <Text className="text-xs text-blue-600">
                    {bindings.emailVerified ? "已验证" : "未验证"}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* ── 手机绑定 ── */}
          <SecurityItem
            icon="mobile-screen"
            label="手机号"
            status={bindings?.phone ? `已绑定 ${bindings.phone.slice(0, 3)}****${bindings.phone.slice(-4)}` : "未绑定"}
            statusColor={bindings?.phone ? "#059669" : "#DC2626"}
            onPress={() => {
              setOldPhone("");
              setOldPhoneCode("");
              setNewPhone("");
              setNewPhoneCode("");
              setModalType("changePhone");
            }}
          />

          {/* ── 邮箱绑定 ── */}
          <SecurityItem
            icon="envelope"
            label="邮箱"
            status={
              bindings?.email
                ? `${bindings.email}${bindings.emailVerified ? " (已验证)" : " (未验证)"}`
                : "未绑定"
            }
            statusColor={bindings?.emailVerified ? "#059669" : bindings?.email ? "#DC2626" : "#9CA3AF"}
            onPress={() => {
              setBindEmail(bindings?.email || "");
              setEmailCode("");
              setModalType("bindEmail");
            }}
          />

          {/* ── 社交账号 ── */}
          <Text className="text-xs font-medium uppercase tracking-wider mb-3 mt-2 px-1" style={{ color: muted || "#9CA3AF" }}>
            社交账号绑定
          </Text>

          <SecurityItem
            icon="weixin"
            label="微信"
            status={bindings?.wechat?.bound ? (bindings.wechat.nickname || "已绑定") : "未绑定"}
            statusColor={bindings?.wechat?.bound ? "#059669" : "#9CA3AF"}
            onPress={() => {
              setSocialNickname("");
              setModalType("bindWechat");
            }}
          />

          <SecurityItem
            icon="qq"
            label="QQ"
            status={bindings?.qq?.bound ? (bindings.qq.nickname || "已绑定") : "未绑定"}
            statusColor={bindings?.qq?.bound ? "#059669" : "#9CA3AF"}
            onPress={() => {
              setSocialNickname("");
              setModalType("bindQQ");
            }}
          />

          {/* ── 密码管理 ── */}
          <Text className="text-xs font-medium uppercase tracking-wider mb-3 mt-2 px-1" style={{ color: muted || "#9CA3AF" }}>
            密码管理
          </Text>

          <SecurityItem
            icon="key"
            label="登录密码"
            status={bindings?.hasPassword ? "已设置" : "未设置"}
            statusColor={bindings?.hasPassword ? "#059669" : "#DC2626"}
            onPress={() => {
              resetPasswordForm();
              setModalType("changePassword");
            }}
          />

          <View className="h-10" />
        </ScrollView>

        {renderModal()}
      </View>
    </Screen>
  );
}