/**
 * 登录/注册页面
 *
 * 支持 5 种登录方式：
 * - 邮箱登录/注册（邮箱+密码，独立注册入口）
 * - 手机号验证码登录（+86 区号 + 验证码）
 * - 微信登录（第三方 OAuth，暂未开放）
 * - QQ 登录（第三方 OAuth，暂未开放）
 * - 游客登录（一键体验）
 *
 * @file /client/screens/login/index.tsx
 */
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { Screen } from "@/components/Screen";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { useAuth } from "@/contexts/AuthContext";
import { FontAwesome6 } from "@expo/vector-icons";

type LoginMethod = "email" | "phone" | "social" | "guest";

interface LoginScreenProps {}

export default function LoginScreen(_props: LoginScreenProps) {
  const router = useSafeRouter();
  const { login } = useAuth();

  // 当前选中的登录方式
  const [method, setMethod] = useState<LoginMethod>("email");

  // 邮箱登录
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");

  // 手机号登录
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // 通用
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "";

  // ============ 邮箱登录 ============
  const handleEmailAuth = useCallback(async () => {
    if (!email.trim()) { Alert.alert("提示", "请输入邮箱"); return; }
    if (!password.trim()) { Alert.alert("提示", "请输入密码"); return; }
    if (password.length < 6) { Alert.alert("提示", "密码至少6位"); return; }
    if (isRegister && password !== confirmPassword) {
      Alert.alert("提示", "两次密码不一致"); return;
    }
    setLoading(true);
    try {
      const endpoint = isRegister ? "register" : "login";
      const body = isRegister
        ? { email: email.trim(), password, nickname: email.split("@")[0] }
        : { email: email.trim(), password };

      const res = await fetch(`${API_BASE}/api/v1/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { Alert.alert("错误", data.error || "操作失败"); return; }
      await login(data.token);
      router.replace("/");
    } catch (err: any) {
      Alert.alert("错误", err.message || "操作失败");
    } finally {
      setLoading(false);
    }
  }, [email, password, confirmPassword, isRegister, API_BASE, login, router]);

  // ============ 手机号登录 ============
  const handleSendOtp = useCallback(async () => {
    if (!phone.trim() || phone.length < 11) {
      Alert.alert("提示", "请输入正确的手机号");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { Alert.alert("错误", data.error); return; }
      setOtpSent(true);
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { clearInterval(timer); return 0; }
          return c - 1;
        });
      }, 1000);
      Alert.alert("提示", "演示模式，验证码为 123456");
    } catch (err: any) {
      Alert.alert("错误", err.message || "发送失败");
    } finally {
      setLoading(false);
    }
  }, [phone, API_BASE]);

  const handlePhoneLogin = useCallback(async () => {
    if (!otpCode.trim()) { Alert.alert("提示", "请输入验证码"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), code: otpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { Alert.alert("错误", data.error); return; }
      await login(data.token);
      router.replace("/");
    } catch (err: any) {
      Alert.alert("错误", err.message || "登录失败");
    } finally {
      setLoading(false);
    }
  }, [phone, otpCode, API_BASE, login, router]);

  // ============ 游客登录 ============
  const handleGuestLogin = useCallback(async () => {
    setGuestLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/guest`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) { Alert.alert("错误", data.error); return; }
      await login(data.token);
      router.replace("/");
    } catch (err: any) {
      Alert.alert("错误", err.message || "游客登录失败");
    } finally {
      setGuestLoading(false);
    }
  }, [API_BASE, login, router]);

  // ============ 登录方式按钮配置 ============
  const methodButtons: { key: LoginMethod; label: string; icon: string; color: string }[] = [
    { key: "email", label: "邮箱", icon: "envelope", color: "#6366F1" },
    { key: "phone", label: "手机", icon: "mobile-screen", color: "#059669" },
    { key: "social", label: "社交", icon: "share-nodes", color: "#EC4899" },
    { key: "guest", label: "游客", icon: "user-astronaut", color: "#F59E0B" },
  ];

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ====== 顶部品牌区 - 柔和卡片风 ====== */}
          <View className="items-center pt-10 pb-6 px-6 mb-4 mx-4 rounded-3xl"
            style={{
              backgroundColor: "#F8F6FF",
              shadowColor: "#6366F1",
              shadowOpacity: 0.08,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 6 },
              elevation: 4,
            }}>
            <View className="w-20 h-20 rounded-2xl items-center justify-center mb-4"
              style={{
                backgroundColor: "#6366F1",
                shadowColor: "#6366F1",
                shadowOpacity: 0.35,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
                elevation: 10,
              }}>
              <FontAwesome6 name="feather" size={36} color="white" />
            </View>
            <Text className="text-2xl font-bold text-gray-900 dark:text-white">
              AI 写作助手
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 mb-2">
              让创作更简单
            </Text>
            <View className="flex-row items-center gap-1.5">
              <View className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <Text className="text-xs text-gray-400">AI 驱动 · 沉浸创作 · 随时同步</Text>
            </View>
          </View>

          {/* ====== 登录方式选择 - 卡片式按钮 ====== */}
          <View className="flex-row justify-center gap-4 mb-6 px-4">
            {methodButtons.map((btn) => {
              const active = method === btn.key;
              return (
                <TouchableOpacity
                  key={btn.key}
                  onPress={() => { setMethod(btn.key as LoginMethod); setOtpSent(false); setOtpCode(""); }}
                  className="items-center py-3.5 px-5 rounded-2xl"
                  style={{
                    backgroundColor: active ? "#FFFFFF" : "transparent",
                    shadowColor: active ? btn.color : "transparent",
                    shadowOpacity: active ? 0.2 : 0,
                    shadowRadius: active ? 10 : 0,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: active ? 6 : 0,
                    borderWidth: active ? 1 : 0,
                    borderColor: active ? btn.color + "25" : "transparent",
                  }}
                >
                  <View className="w-10 h-10 rounded-xl items-center justify-center mb-1.5"
                    style={{ backgroundColor: active ? btn.color + "12" : "#F3F4F6" }}>
                    <FontAwesome6
                      name={btn.icon as any}
                      size={20}
                      color={active ? btn.color : "#9CA3AF"}
                    />
                  </View>
                  <Text className="text-xs font-medium"
                    style={{ color: active ? btn.color : "#9CA3AF" }}>
                    {btn.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ====== 表单卡片容器 ====== */}
          <View className="mx-4 p-5 rounded-3xl mb-4"
            style={{
              backgroundColor: "#FFFFFF",
              shadowColor: "#6366F1",
              shadowOpacity: 0.06,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 4 },
              elevation: 3,
            }}>
            {/* ====== 邮箱登录 ====== */}
            {method === "email" && (
              <View>
                <View className="mb-3.5">
                  <Text className="text-xs font-medium text-gray-500 mb-2 ml-1">邮箱地址</Text>
                  <View className="flex-row items-center rounded-2xl px-4 h-12"
                    style={{ backgroundColor: "#F8F9FC" }}>
                    <FontAwesome6 name="envelope" size={14} color="#9CA3AF" />
                    <TextInput
                      className="flex-1 ml-3 text-base text-gray-900"
                      placeholder="请输入邮箱"
                      placeholderTextColor="#B0B7C3"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    {email ? (
                      <TouchableOpacity onPress={() => setEmail("")}>
                        <FontAwesome6 name="circle-xmark" size={14} color="#D1D5DB" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
                <View className="mb-3.5">
                  <Text className="text-xs font-medium text-gray-500 mb-2 ml-1">
                    {isRegister ? "设置密码" : "密码"}
                  </Text>
                  <View className="flex-row items-center rounded-2xl px-4 h-12"
                    style={{ backgroundColor: "#F8F9FC" }}>
                    <FontAwesome6 name="lock" size={14} color="#9CA3AF" />
                    <TextInput
                      className="flex-1 ml-3 text-base text-gray-900"
                      placeholder={isRegister ? "至少6位密码" : "请输入密码"}
                      placeholderTextColor="#B0B7C3"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <FontAwesome6 name={showPassword ? "eye" : "eye-slash"} size={14} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>
                </View>
                {isRegister && (
                  <View className="mb-3.5">
                    <Text className="text-xs font-medium text-gray-500 mb-2 ml-1">确认密码</Text>
                    <View className="flex-row items-center rounded-2xl px-4 h-12"
                      style={{ backgroundColor: "#F8F9FC" }}>
                      <FontAwesome6 name="check-double" size={14} color="#9CA3AF" />
                      <TextInput
                        className="flex-1 ml-3 text-base text-gray-900"
                        placeholder="再次输入密码"
                        placeholderTextColor="#B0B7C3"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                      />
                    </View>
                  </View>
                )}
                <TouchableOpacity
                  onPress={handleEmailAuth}
                  disabled={loading}
                  className="w-full h-12 rounded-2xl items-center justify-center mt-2 mb-3"
                  style={{
                    backgroundColor: loading ? "#B0B7C3" : "#6366F1",
                    shadowColor: "#6366F1",
                    shadowOpacity: loading ? 0 : 0.3,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 5 },
                    elevation: loading ? 0 : 6,
                  }}
                >
                  <Text className="text-white text-base font-semibold tracking-wide">
                    {loading ? "处理中..." : isRegister ? "注册并登录" : "登录"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setIsRegister(!isRegister); setConfirmPassword(""); }} className="items-center py-1">
                  <Text className="text-sm font-medium" style={{ color: "#6366F1" }}>
                    {isRegister ? "已有账号？去登录" : "没有账号？去注册"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ====== 手机号登录 ====== */}
            {method === "phone" && (
              <View>
                <View className="mb-3.5">
                  <Text className="text-xs font-medium text-gray-500 mb-2 ml-1">手机号码</Text>
                  <View className="flex-row items-center rounded-2xl px-4 h-12"
                    style={{ backgroundColor: "#F8F9FC" }}>
                    <Text className="text-base font-semibold text-gray-700 mr-2">+86</Text>
                    <View className="w-px h-5 mr-3" style={{ backgroundColor: "#E5E7EB" }} />
                    <TextInput
                      className="flex-1 text-base text-gray-900"
                      placeholder="请输入手机号"
                      placeholderTextColor="#B0B7C3"
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      maxLength={11}
                    />
                  </View>
                </View>
                {otpSent && (
                  <View className="mb-3.5">
                    <Text className="text-xs font-medium text-gray-500 mb-2 ml-1">验证码</Text>
                    <View className="flex-row items-center rounded-2xl px-4 h-12"
                      style={{ backgroundColor: "#F8F9FC" }}>
                      <FontAwesome6 name="shield-halved" size={14} color="#9CA3AF" />
                      <TextInput
                        className="flex-1 ml-3 text-base tracking-widest text-gray-900 dark:text-white"
                        placeholder="输入验证码"
                        placeholderTextColor="#B0B7C3"
                        value={otpCode}
                        onChangeText={setOtpCode}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                      {loading ? (
                        <Text className="text-xs text-gray-400">发送中</Text>
                      ) : (
                        <TouchableOpacity onPress={handleSendOtp} disabled={countdown > 0}>
                          <Text className="text-xs font-medium"
                            style={{ color: countdown > 0 ? "#D1D5DB" : "#6366F1" }}>
                            {countdown > 0 ? `${countdown}s` : "重新发送"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
                {!otpSent ? (
                  <TouchableOpacity
                    onPress={handleSendOtp}
                    disabled={loading}
                    className="w-full h-12 rounded-2xl items-center justify-center mt-2"
                    style={{
                      backgroundColor: loading ? "#B0B7C3" : "#6366F1",
                      shadowColor: "#6366F1",
                      shadowOpacity: loading ? 0 : 0.3,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 5 },
                      elevation: loading ? 0 : 6,
                    }}
                  >
                    <Text className="text-white text-base font-semibold tracking-wide">
                      {loading ? "发送中..." : "获取验证码"}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={handlePhoneLogin}
                    disabled={loading || otpCode.length < 4}
                    className="w-full h-12 rounded-2xl items-center justify-center mt-2"
                    style={{
                      backgroundColor: loading || otpCode.length < 4 ? "#B0B7C3" : "#6366F1",
                      shadowColor: "#6366F1",
                      shadowOpacity: loading || otpCode.length < 4 ? 0 : 0.3,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 5 },
                      elevation: loading || otpCode.length < 4 ? 0 : 6,
                    }}
                  >
                    <Text className="text-white text-base font-semibold tracking-wide">
                      {loading ? "验证中..." : "登录"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ====== 游客模式 ====== */}
            {method === "guest" && (
              <View className="items-center py-4">
                <View className="w-20 h-20 rounded-full items-center justify-center mb-4"
                  style={{
                    backgroundColor: "#FEF3C7",
                    shadowColor: "#F59E0B",
                    shadowOpacity: 0.1,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 4,
                  }}>
                  <FontAwesome6 name="user-astronaut" size={34} color="#F59E0B" />
                </View>
                <Text className="text-lg font-bold text-gray-900 mb-2">游客模式</Text>
                <Text className="text-sm text-gray-500 text-center leading-5 mb-6 px-2">
                  无需注册，快速体验全部功能{"\n"}数据仅保存在本地设备
                </Text>
                <TouchableOpacity
                  onPress={handleGuestLogin}
                  disabled={guestLoading}
                  className="w-full h-12 rounded-2xl items-center justify-center"
                  style={{
                    backgroundColor: guestLoading ? "#B0B7C3" : "#F59E0B",
                    shadowColor: "#F59E0B",
                    shadowOpacity: guestLoading ? 0 : 0.3,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 5 },
                    elevation: guestLoading ? 0 : 6,
                  }}
                >
                  <Text className="text-white text-base font-semibold tracking-wide">
                    {guestLoading ? "处理中..." : "立即体验"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ====== 社交登录 (微信/QQ) ====== */}
            {method === "social" && (
              <View className="items-center py-4">
                <View className="flex-row justify-center gap-10 mb-6">
                  <View className="items-center">
                    <View className="w-16 h-16 rounded-2xl items-center justify-center mb-2.5 opacity-50"
                      style={{ backgroundColor: "#E8F5E9" }}>
                      <FontAwesome6 name="weixin" size={28} color="#22C55E" />
                    </View>
                    <Text className="text-xs text-gray-400 font-medium">微信</Text>
                  </View>
                  <View className="items-center">
                    <View className="w-16 h-16 rounded-2xl items-center justify-center mb-2.5 opacity-50"
                      style={{ backgroundColor: "#E3F2FD" }}>
                      <FontAwesome6 name="qq" size={28} color="#3B82F6" />
                    </View>
                    <Text className="text-xs text-gray-400 font-medium">QQ</Text>
                  </View>
                </View>
                <View className="w-full rounded-2xl py-3 px-4"
                  style={{ backgroundColor: "#F8F9FC" }}>
                  <Text className="text-center text-xs text-gray-400">
                    第三方登录功能开发中，敬请期待
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* ====== 底部信息 ====== */}
          <View className="items-center pb-8 pt-2">
            <Text className="text-xs text-gray-400">
              登录即表示同意
              <Text className="font-medium" style={{ color: "#6366F1" }}> 服务条款 </Text>
              和
              <Text className="font-medium" style={{ color: "#6366F1" }}> 隐私政策</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
