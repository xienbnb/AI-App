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

type LoginMethod = "email" | "phone" | "wechat" | "qq" | "guest";

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
    { key: "wechat", label: "微信", icon: "weixin", color: "#07C160" },
    { key: "qq", label: "QQ", icon: "qq", color: "#12B7F5" },
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
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ====== 顶部品牌区 ====== */}
          <View className="items-center mb-8">
            <View className="w-20 h-20 rounded-2xl bg-indigo-500 items-center justify-center mb-4"
              style={{ shadowColor: "#6366F1", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}>
              <FontAwesome6 name="feather" size={36} color="white" />
            </View>
            <Text className="text-2xl font-bold text-gray-900 dark:text-white">
              AI 写作助手
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              让创作更简单
            </Text>
          </View>

          {/* ====== 登录方式选择 ====== */}
          <View className="flex-row justify-center gap-3 mb-8 px-6">
            {methodButtons.map((btn) => {
              const active = method === btn.key;
              return (
                <TouchableOpacity
                  key={btn.key}
                  onPress={() => { setMethod(btn.key); setOtpSent(false); setOtpCode(""); }}
                  className={`items-center py-3 px-4 rounded-xl ${
                    active ? "bg-white dark:bg-gray-800" : ""
                  }`}
                  style={active ? {
                    shadowColor: btn.color,
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 4,
                    borderWidth: 1,
                    borderColor: btn.color + "30",
                  } : {}}
                >
                  <FontAwesome6
                    name={btn.icon as any}
                    size={22}
                    color={active ? btn.color : "#9CA3AF"}
                  />
                  <Text className={`text-xs mt-1.5 ${
                    active ? "text-gray-900 dark:text-white font-medium" : "text-gray-400"
                  }`}>
                    {btn.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ====== 邮箱登录区域 ====== */}
          {method === "email" && (
            <View className="px-6">
              {/* Tab: 登录 / 注册 */}
              <View className="flex-row mb-6 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                <TouchableOpacity
                  onPress={() => setIsRegister(false)}
                  className={`flex-1 py-2.5 rounded-lg items-center ${
                    !isRegister ? "bg-white dark:bg-gray-700 shadow-sm" : ""
                  }`}
                >
                  <Text className={`text-sm font-medium ${
                    !isRegister ? "text-indigo-500" : "text-gray-500"
                  }`}>登录</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsRegister(true)}
                  className={`flex-1 py-2.5 rounded-lg items-center ${
                    isRegister ? "bg-white dark:bg-gray-700 shadow-sm" : ""
                  }`}
                >
                  <Text className={`text-sm font-medium ${
                    isRegister ? "text-indigo-500" : "text-gray-500"
                  }`}>注册</Text>
                </TouchableOpacity>
              </View>

              {/* 邮箱 */}
              <View className="flex-row items-center bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 mb-3 border border-gray-200 dark:border-gray-700">
                <FontAwesome6 name="envelope" size={16} color="#9CA3AF" />
                <TextInput
                  className="flex-1 py-3.5 px-3 text-gray-900 dark:text-white text-base"
                  placeholder="请输入邮箱"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              {/* 密码 */}
              <View className="flex-row items-center bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 mb-3 border border-gray-200 dark:border-gray-700">
                <FontAwesome6 name="lock" size={16} color="#9CA3AF" />
                <TextInput
                  className="flex-1 py-3.5 px-3 text-gray-900 dark:text-white text-base"
                  placeholder="请输入密码"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              {/* 确认密码（注册时） */}
              {isRegister && (
                <View className="flex-row items-center bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 mb-3 border border-gray-200 dark:border-gray-700">
                  <FontAwesome6 name="lock" size={16} color="#9CA3AF" />
                  <TextInput
                    className="flex-1 py-3.5 px-3 text-gray-900 dark:text-white text-base"
                    placeholder="确认密码"
                    placeholderTextColor="#9CA3AF"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                </View>
              )}

              {/* 登录/注册 按钮 */}
              <TouchableOpacity
                onPress={handleEmailAuth}
                disabled={loading}
                className="py-3.5 rounded-xl items-center mt-2"
                style={{ backgroundColor: loading ? "#9CA3AF" : "#6366F1" }}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold text-base">
                    {isRegister ? "注册并登录" : "登录"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ====== 手机号登录区域 ====== */}
          {method === "phone" && (
            <View className="px-6">
              {/* 手机号输入 */}
              <View className="flex-row items-center bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 mb-3 border border-gray-200 dark:border-gray-700">
                <Text className="text-gray-500 font-medium mr-1">+86</Text>
                <View className="w-px h-5 bg-gray-300 dark:bg-gray-600 mr-3" />
                <TextInput
                  className="flex-1 py-3.5 text-gray-900 dark:text-white text-base"
                  placeholder="请输入手机号"
                  placeholderTextColor="#9CA3AF"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={11}
                />
              </View>

              {!otpSent ? (
                /* 发送验证码 */
                <TouchableOpacity
                  onPress={handleSendOtp}
                  disabled={loading}
                  className="py-3.5 rounded-xl items-center mt-2"
                  style={{ backgroundColor: loading ? "#9CA3AF" : "#059669" }}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-semibold text-base">获取验证码</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <>
                  {/* 验证码输入 */}
                  <View className="flex-row items-center bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 mb-3 border border-gray-200 dark:border-gray-700">
                    <FontAwesome6 name="shield-halved" size={16} color="#9CA3AF" />
                    <TextInput
                      className="flex-1 py-3.5 px-3 text-gray-900 dark:text-white text-base"
                      placeholder="请输入验证码"
                      placeholderTextColor="#9CA3AF"
                      value={otpCode}
                      onChangeText={setOtpCode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    <TouchableOpacity
                      onPress={handleSendOtp}
                      disabled={countdown > 0 || loading}
                    >
                      <Text className={`text-sm ${
                        countdown > 0 ? "text-gray-400" : "text-emerald-500"
                      }`}>
                        {countdown > 0 ? `${countdown}s` : "重新发送"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* 验证并登录 */}
                  <TouchableOpacity
                    onPress={handlePhoneLogin}
                    disabled={loading}
                    className="py-3.5 rounded-xl items-center mt-2"
                    style={{ backgroundColor: loading ? "#9CA3AF" : "#059669" }}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text className="text-white font-semibold text-base">登录</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* ====== 微信/QQ 登录 ====== */}
          {(method === "wechat" || method === "qq") && (
            <View className="px-6 items-center py-8">
              <View className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center mb-4">
                <FontAwesome6
                  name={method === "wechat" ? "weixin" : "qq"}
                  size={40}
                  color={method === "wechat" ? "#07C160" : "#12B7F5"}
                />
              </View>
              <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {method === "wechat" ? "微信登录" : "QQ 登录"}
              </Text>
              <Text className="text-sm text-gray-500 text-center mb-6">
                第三方登录功能正在接入中{'\n'}请先使用邮箱或手机号登录
              </Text>
              <View className="bg-amber-50 dark:bg-amber-900/20 rounded-xl px-6 py-3 border border-amber-200 dark:border-amber-800">
                <Text className="text-xs text-amber-600 dark:text-amber-400 text-center">
                  暂未开放，敬请期待
                </Text>
              </View>
            </View>
          )}

          {/* ====== 游客登录 ====== */}
          {method === "guest" && (
            <View className="px-6 items-center py-8">
              <View className="w-24 h-24 rounded-full bg-amber-50 dark:bg-amber-900/20 items-center justify-center mb-4 border-2 border-amber-200 dark:border-amber-700/50 border-dashed">
                <FontAwesome6 name="user-astronaut" size={40} color="#F59E0B" />
              </View>
              <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                游客模式
              </Text>
              <Text className="text-sm text-gray-500 text-center mb-6">
                无需注册，一键体验完整功能{'\n'}数据仅在本地保存
              </Text>
              <TouchableOpacity
                onPress={handleGuestLogin}
                disabled={guestLoading}
                className="py-3.5 px-10 rounded-xl items-center"
                style={{ backgroundColor: guestLoading ? "#9CA3AF" : "#F59E0B" }}
              >
                {guestLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold text-base">立即体验</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ====== 底部安全区 ====== */}
          <View className="h-12" />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}