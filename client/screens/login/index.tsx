/**
 * @file 登录页面
 * @description 支持手机验证码登录和账号密码登录，新用户可通过验证码自动注册，
 *   包含用户协议和隐私政策勾选，以及找回密码功能
 */

import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { FontAwesome6, MaterialIcons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { useAuth } from "@/contexts/AuthContext";

const EXPO_PUBLIC_BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

type LoginMode = "main" | "otp" | "password";

export default function LoginScreen() {
  const router = useSafeRouter();
  const { login, savePhone, getStoredPhone } = useAuth();

  const [mode, setMode] = useState<LoginMode>("main");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [showAgreement, setShowAgreement] = useState<"tos" | "privacy" | null>(null);
  const [showFindAccount, setShowFindAccount] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetPhone, setResetPhone] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpModalCode, setOtpModalCode] = useState("");

  // Auto-detect stored phone
  useEffect(() => {
    (async () => {
      const stored = await getStoredPhone();
      if (stored) setPhone(stored);
    })();
  }, []);

  // OTP countdown timer
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  const handleSendOTP = useCallback(async (targetPhone?: string) => {
    const p = targetPhone || phone;
    if (!p || p.length < 11) {
      alert("请输入正确的手机号");
      return;
    }
    setOtpLoading(true);
    try {
      const res = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: p }),
      });
      const data = await res.json();
      if (res.ok) {
        setOtpCountdown(60);
        if (!targetPhone) setPhone(p);
        await savePhone(p);
        setOtpModalCode(data.code || "");
        setShowOtpModal(true);
      } else {
        alert(data.error || "发送失败");
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setOtpLoading(false);
    }
  }, [phone]);

  const handleOTPLogin = useCallback(async () => {
    if (!phone || otpCode.length < 6) {
      alert("请输入完整的验证码");
      return;
    }
    if (!agreeTerms) {
      alert("请先阅读并同意用户协议和隐私政策");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otpCode }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        await savePhone(phone);
        await login(data.token);
        router.replace("/");
      } else {
        alert(data.error || "验证失败");
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }, [phone, otpCode, agreeTerms]);

  const handlePasswordLogin = useCallback(async () => {
    if (!phone || !password) {
      alert("请输入手机号和密码");
      return;
    }
    if (!agreeTerms) {
      alert("请先阅读并同意用户协议和隐私政策");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/password-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        await savePhone(phone);
        await login(data.token);
        router.replace("/");
      } else {
        alert(data.error || "登录失败");
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }, [phone, password, agreeTerms]);

  // 游客登录
  const handleGuestLogin = useCallback(async () => {
    if (!agreeTerms) {
      alert("请先阅读并同意服务条款和隐私政策");
      return;
    }
    setLoading(true);
    try {
      const storedPhone = await getStoredPhone();
      const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: storedPhone || "" }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        await login(data.token);
        router.replace("/");
      } else {
        alert(data.error || "游客登录失败");
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }, [agreeTerms, getStoredPhone, login, router]);

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ====== MAIN MODE ====== */}
          {mode === "main" && (
            <View className="items-center">
              {/* Logo */}
              <View className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 items-center justify-center mb-4 shadow-lg shadow-amber-500/30">
                <FontAwesome6 name="pen-fancy" size={32} color="white" />
              </View>
              <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                AI 网文创作
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400 mb-8">
                让灵感流淌，一键成章
              </Text>

              {/* Phone + One-click login */}
              <View className="w-full mb-4">
                <View className="flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 mb-3">
                  <Text className="text-lg font-semibold text-gray-900 dark:text-white mr-2">+86</Text>
                  <TextInput
                    className="flex-1 text-lg text-gray-900 dark:text-white"
                    placeholder="手机号"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    maxLength={11}
                    value={phone}
                    onChangeText={setPhone}
                  />
                  {phone.length === 11 && (
                    <MaterialIcons name="check-circle" size={20} color="#10B981" />
                  )}
                </View>

                <TouchableOpacity
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl py-4 items-center shadow-lg shadow-amber-500/30"
                  onPress={() => handleSendOTP()}
                  disabled={otpLoading || phone.length < 11 || !agreeTerms}
                  activeOpacity={0.7}
                >
                  {otpLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white text-base font-bold">
                      {phone.length === 11 ? "本机号码一键登录" : "获取验证码"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Divider */}
              <View className="flex-row items-center w-full mb-6">
                <View className="flex-1 h-[1px] bg-gray-200 dark:bg-gray-700" />
                <Text className="mx-4 text-xs text-gray-400">或者</Text>
                <View className="flex-1 h-[1px] bg-gray-200 dark:bg-gray-700" />
              </View>

              {/* Password login */}
              <TouchableOpacity
                className="w-full flex-row items-center justify-center py-3 rounded-2xl border border-gray-200 dark:border-gray-700 mb-6"
                activeOpacity={0.6}
                onPress={() => {
                  setMode("password");
                  setPassword("");
                }}
              >
                <FontAwesome6 name="lock" size={16} color="#6B7280" />
                <Text className="text-sm text-gray-500 ml-2">使用账号密码登录</Text>
              </TouchableOpacity>

              {/* Agreement checkbox */}
              <TouchableOpacity
                className="flex-row items-center"
                onPress={() => setAgreeTerms(!agreeTerms)}
                activeOpacity={0.6}
              >
                <View
                  className={`w-5 h-5 rounded-md border-2 items-center justify-center mr-2 ${
                    agreeTerms
                      ? "bg-amber-500 border-amber-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {agreeTerms && <MaterialIcons name="check" size={14} color="white" />}
                </View>
                <Text className="text-xs text-gray-400">
                  已阅读并同意{" "}
                </Text>
                <TouchableOpacity onPress={() => setShowAgreement("tos")}>
                  <Text className="text-xs text-amber-500 font-medium">《用户协议》</Text>
                </TouchableOpacity>
                <Text className="text-xs text-gray-400"> 和 </Text>
                <TouchableOpacity onPress={() => setShowAgreement("privacy")}>
                  <Text className="text-xs text-amber-500 font-medium">《隐私政策》</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </View>
          )}

          {/* 游客模式入口 */}
          <TouchableOpacity
            className="mt-4 py-3 rounded-2xl border border-gray-200/60 items-center"
            onPress={handleGuestLogin}
            activeOpacity={0.6}
          >
            <View className="flex-row items-center justify-center">
              <FontAwesome6 name="user-astronaut" size={16} color="#6B7280" />
              <Text className="text-sm text-gray-500 ml-2">游客模式浏览</Text>
            </View>
          </TouchableOpacity>

          {/* ====== OTP MODE ====== */}
          {mode === "otp" && (
            <View>
              {/* Back */}
              <TouchableOpacity
                className="mb-6 flex-row items-center"
                onPress={() => setMode("main")}
                activeOpacity={0.6}
              >
                <MaterialIcons name="arrow-back" size={20} color="#6B7280" />
                <Text className="text-gray-500 ml-1">手机号登录</Text>
              </TouchableOpacity>

              <Text className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                输入验证码
              </Text>
              <Text className="text-sm text-gray-500 mb-6">
                验证码已发送至 {phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")}
              </Text>

              {/* OTP Input */}
              <View className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 mb-4">
                <TextInput
                  className="text-lg text-center tracking-[12px] text-gray-900 dark:text-white"
                  placeholder="_ _ _ _ _ _"
                  placeholderTextColor="#D1D5DB"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otpCode}
                  onChangeText={setOtpCode}
                />
              </View>

              {/* Agreement checkbox */}
              <TouchableOpacity
                className="flex-row items-center mb-4"
                onPress={() => setAgreeTerms(!agreeTerms)}
                activeOpacity={0.6}
              >
                <View
                  className={`w-5 h-5 rounded-md border-2 items-center justify-center mr-2 ${
                    agreeTerms
                      ? "bg-amber-500 border-amber-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {agreeTerms && <MaterialIcons name="check" size={14} color="white" />}
                </View>
                <Text className="text-xs text-gray-400">
                  已阅读并同意{" "}
                </Text>
                <TouchableOpacity onPress={() => setShowAgreement("tos")}>
                  <Text className="text-xs text-amber-500 font-medium">《用户协议》</Text>
                </TouchableOpacity>
                <Text className="text-xs text-gray-400"> 和 </Text>
                <TouchableOpacity onPress={() => setShowAgreement("privacy")}>
                  <Text className="text-xs text-amber-500 font-medium">《隐私政策》</Text>
                </TouchableOpacity>
              </TouchableOpacity>

              <TouchableOpacity
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl py-4 items-center shadow-lg shadow-amber-500/30 mb-4"
                onPress={handleOTPLogin}
                disabled={loading || otpCode.length < 6 || !agreeTerms}
                activeOpacity={0.7}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white text-base font-bold">登录</Text>
                )}
              </TouchableOpacity>

              {/* Resend */}
              <TouchableOpacity
                className="items-center mb-4"
                onPress={() => handleSendOTP()}
                disabled={otpCountdown > 0 || otpLoading}
                activeOpacity={0.6}
              >
                <Text className={`text-sm ${otpCountdown > 0 ? "text-gray-400" : "text-amber-500"}`}>
                  {otpCountdown > 0 ? `${otpCountdown}s 后重新发送` : "重新发送验证码"}
                </Text>
              </TouchableOpacity>

              {/* Back to main */}
              <TouchableOpacity
                className="items-center"
                onPress={() => setMode("main")}
                activeOpacity={0.6}
              >
                <Text className="text-sm text-amber-500">更换手机号</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ====== PASSWORD MODE ====== */}
          {mode === "password" && (
            <View>
              {/* Back */}
              <TouchableOpacity
                className="mb-6 flex-row items-center"
                onPress={() => setMode("main")}
                activeOpacity={0.6}
              >
                <MaterialIcons name="arrow-back" size={20} color="#6B7280" />
                <Text className="text-gray-500 ml-1">账号密码登录</Text>
              </TouchableOpacity>

              <Text className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                账号登录
              </Text>

              {/* Phone */}
              <View className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 mb-3">
                <TextInput
                  className="text-base text-gray-900 dark:text-white"
                  placeholder="手机号"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  maxLength={11}
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>

              {/* Password */}
              <View className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 mb-4 flex-row items-center">
                <TextInput
                  className="flex-1 text-base text-gray-900 dark:text-white"
                  placeholder="密码"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} activeOpacity={0.6}>
                  <MaterialIcons
                    name={showPassword ? "visibility-off" : "visibility"}
                    size={20}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>

              {/* Agreement checkbox */}
              <TouchableOpacity
                className="flex-row items-center mb-4"
                onPress={() => setAgreeTerms(!agreeTerms)}
                activeOpacity={0.6}
              >
                <View
                  className={`w-5 h-5 rounded-md border-2 items-center justify-center mr-2 ${
                    agreeTerms
                      ? "bg-amber-500 border-amber-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {agreeTerms && <MaterialIcons name="check" size={14} color="white" />}
                </View>
                <Text className="text-xs text-gray-400">
                  已阅读并同意{" "}
                </Text>
                <TouchableOpacity onPress={() => setShowAgreement("tos")}>
                  <Text className="text-xs text-amber-500 font-medium">《用户协议》</Text>
                </TouchableOpacity>
                <Text className="text-xs text-gray-400"> 和 </Text>
                <TouchableOpacity onPress={() => setShowAgreement("privacy")}>
                  <Text className="text-xs text-amber-500 font-medium">《隐私政策》</Text>
                </TouchableOpacity>
              </TouchableOpacity>

              <TouchableOpacity
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl py-4 items-center shadow-lg shadow-amber-500/30 mb-4"
                onPress={handlePasswordLogin}
                disabled={loading || !phone || !password || !agreeTerms}
                activeOpacity={0.7}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white text-base font-bold">登录</Text>
                )}
              </TouchableOpacity>

              {/* Registration */}
              <View className="flex-row justify-center items-center mt-3">
                <Text className="text-sm text-gray-400">还没有账号？</Text>
                <TouchableOpacity
                  onPress={() => {
                    setMode("main");
                    setPassword("");
                  }}
                  activeOpacity={0.6}
                >
                  <Text className="text-sm text-amber-500 font-medium ml-1">立即注册</Text>
                </TouchableOpacity>
              </View>

              {/* Forgot password */}
              <TouchableOpacity
                className="items-center mt-3"
                onPress={() => setShowResetPassword(true)}
                activeOpacity={0.6}
              >
                <Text className="text-sm text-amber-500">找回密码</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* ====== OTP CODE MODAL ====== */}
        <Modal visible={showOtpModal} transparent animationType="fade">
          <View className="flex-1 bg-black/50 items-center justify-center px-8">
            <View className="w-full bg-white dark:bg-gray-900 rounded-3xl p-8 items-center">
              {/* Close button */}
              <TouchableOpacity
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center z-10"
                onPress={() => { setShowOtpModal(false); setMode("otp"); }}
                activeOpacity={0.6}
              >
                <MaterialIcons name="close" size={18} color="#6B7280" />
              </TouchableOpacity>

              {/* Icon */}
              <View className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 items-center justify-center mb-4">
                <MaterialIcons name="email" size={28} color="#F59E0B" />
              </View>

              <Text className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                验证码已发送
              </Text>
              <Text className="text-sm text-gray-500 mb-6">
                已发送至 {phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")}
              </Text>

              {/* Code display */}
              <View className="flex-row gap-2 mb-6">
                {otpModalCode.split("").map((digit, i) => (
                  <View
                    key={i}
                    className="w-11 h-14 rounded-xl bg-gray-100 dark:bg-gray-800 items-center justify-center"
                  >
                    <Text className="text-2xl font-bold text-gray-900 dark:text-white">{digit}</Text>
                  </View>
                ))}
              </View>

              <Text className="text-xs text-gray-400 mb-6">
                验证码 5 分钟内有效，请勿泄露给他人
              </Text>

              <TouchableOpacity
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl py-4 items-center shadow-lg shadow-amber-500/30"
                onPress={() => { setShowOtpModal(false); setMode("otp"); }}
                activeOpacity={0.7}
              >
                <Text className="text-white text-base font-bold">我已记住，去输入</Text>
              </TouchableOpacity>

              {/* Resend */}
              <TouchableOpacity
                className="mt-4"
                onPress={async () => {
                  await handleSendOTP();
                }}
                disabled={otpCountdown > 0}
                activeOpacity={0.6}
              >
                <Text className={`text-sm ${otpCountdown > 0 ? "text-gray-400" : "text-amber-500"}`}>
                  {otpCountdown > 0 ? `${otpCountdown}s 后可重新发送` : "没收到？重新发送"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ====== AGREEMENT MODAL ====== */}
        <Modal visible={showAgreement !== null} transparent animationType="slide">
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white dark:bg-gray-900 rounded-t-3xl max-h-[80%]">
              <View className="flex-row items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
                <Text className="text-lg font-bold text-gray-900 dark:text-white">
                  {showAgreement === "tos" ? "用户协议" : "隐私政策"}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowAgreement(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center"
                  activeOpacity={0.6}
                >
                  <MaterialIcons name="close" size={18} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <ScrollView className="px-6 py-4" style={{ maxHeight: 500 }}>
                {showAgreement === "tos" ? (
                  <View>
                    <Text className="text-sm text-gray-600 dark:text-gray-400 leading-6 mb-3">
                      欢迎使用 AI 网文创作助手（以下简称「本应用」）。本应用由开发者提供。请您仔细阅读本协议的全部内容。如您不同意本协议的任何条款，请立即停止使用本应用。
                    </Text>
                    <Text className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-4 mb-2">一、服务说明</Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-400 leading-6">
                      本应用提供 AI 辅助网文创作服务，包括但不限于续写、扩写、润色、角色设定、大纲生成等功能。用户使用本服务需遵守相关法律法规。
                    </Text>
                    <Text className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-4 mb-2">二、用户责任</Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-400 leading-6">
                      用户不得利用本应用创作或传播违法内容，不得侵犯他人知识产权。用户对使用本账号进行的所有活动负责。用户应妥善保管账号和密码。
                    </Text>
                    <Text className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-4 mb-2">三、知识产权</Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-400 leading-6">
                      用户在本应用创作的作品著作权归用户所有。用户授予本应用在服务范围内展示、存储和备份作品的权限。
                    </Text>
                    <Text className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-4 mb-2">四、免责声明</Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-400 leading-6">
                      AI 生成内容仅供参考，用户应自行判断内容的准确性和合法性。因不可抗力或第三方原因导致的服务中断，本应用不承担责任。
                    </Text>
                    <Text className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-4 mb-2">五、协议变更</Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-400 leading-6 mb-4">
                      本应用有权根据需要修改本协议。修改后的协议一经发布即生效。如用户不同意修改内容，应停止使用本服务。
                    </Text>
                  </View>
                ) : (
                  <View>
                    <Text className="text-sm text-gray-600 dark:text-gray-400 leading-6 mb-3">
                      我们重视您的隐私。本隐私政策说明了我们如何收集、使用和保护您的个人信息。
                    </Text>
                    <Text className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-4 mb-2">一、信息收集</Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-400 leading-6">
                      我们收集的信息包括：手机号码（用于账号登录和身份验证）、创作内容（作品、大纲、角色设定等）、设备信息（用于优化服务）。
                    </Text>
                    <Text className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-4 mb-2">二、信息使用</Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-400 leading-6">
                      您的信息仅用于提供和改进本服务。我们不会将您的个人信息出售给第三方。AI 模型训练不会使用您的作品数据。
                    </Text>
                    <Text className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-4 mb-2">三、数据存储</Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-400 leading-6">
                      您的数据存储在安全的云服务器上。我们采取合理的安全措施保护您的数据。但请注意，没有任何网络传输是绝对安全的。
                    </Text>
                    <Text className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-4 mb-2">四、用户权利</Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-400 leading-6 mb-4">
                      您有权查阅、更正和删除您的个人信息。如需删除账号，请联系我们。账号删除后，您的所有作品和设置将被永久清除。
                    </Text>
                  </View>
                )}
              </ScrollView>
              <View className="px-6 py-4 border-t border-gray-100 dark:border-gray-800">
                <TouchableOpacity
                  className="bg-amber-500 rounded-2xl py-3 items-center"
                  onPress={() => setShowAgreement(null)}
                  activeOpacity={0.7}
                >
                  <Text className="text-white font-bold">我已了解</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ====== FIND ACCOUNT MODAL ====== */}
        <Modal visible={showFindAccount} transparent animationType="slide">
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white dark:bg-gray-900 rounded-t-3xl">
              <View className="flex-row items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
                <Text className="text-lg font-bold text-gray-900 dark:text-white">找回账号</Text>
                <TouchableOpacity
                  onPress={() => setShowFindAccount(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center"
                  activeOpacity={0.6}
                >
                  <MaterialIcons name="close" size={18} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <View className="px-6 py-6">
                <Text className="text-sm text-gray-500 mb-4">
                  请输入您的手机号，我们将发送验证码帮您找回账号
                </Text>
                <View className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 mb-4">
                  <TextInput
                    className="text-base text-gray-900 dark:text-white"
                    placeholder="输入手机号"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    maxLength={11}
                    value={resetPhone}
                    onChangeText={setResetPhone}
                  />
                </View>
                <TouchableOpacity
                  className="bg-amber-500 rounded-2xl py-3 items-center"
                  onPress={() => {
                    alert("已发送验证信息至您的手机，请查收短信");
                    setShowFindAccount(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text className="text-white font-bold">发送</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ====== RESET PASSWORD MODAL ====== */}
        <Modal visible={showResetPassword} transparent animationType="slide">
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white dark:bg-gray-900 rounded-t-3xl">
              <View className="flex-row items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
                <Text className="text-lg font-bold text-gray-900 dark:text-white">重置密码</Text>
                <TouchableOpacity
                  onPress={() => setShowResetPassword(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 items-center justify-center"
                  activeOpacity={0.6}
                >
                  <MaterialIcons name="close" size={18} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <View className="px-6 py-6">
                <Text className="text-sm text-gray-500 mb-4">
                  请先验证手机号，然后设置新密码
                </Text>
                <View className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 mb-3">
                  <TextInput
                    className="text-base text-gray-900 dark:text-white"
                    placeholder="手机号"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    maxLength={11}
                    value={resetPhone}
                    onChangeText={setResetPhone}
                  />
                </View>
                <View className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 mb-3 flex-row items-center">
                  <TextInput
                    className="flex-1 text-base text-gray-900 dark:text-white"
                    placeholder="验证码"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={resetOtp}
                    onChangeText={setResetOtp}
                  />
                  <TouchableOpacity onPress={() => handleSendOTP(resetPhone)} activeOpacity={0.6}>
                    <Text className="text-amber-500 text-sm font-medium">
                      {otpCountdown > 0 ? `${otpCountdown}s` : "获取"}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 mb-4">
                  <TextInput
                    className="text-base text-gray-900 dark:text-white"
                    placeholder="新密码"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                </View>
                <TouchableOpacity
                  className="bg-amber-500 rounded-2xl py-3 items-center"
                  onPress={async () => {
                    if (!resetPhone || !resetOtp || !newPassword) {
                      alert("请填写完整信息");
                      return;
                    }
                    try {
                      const res = await fetch(`${EXPO_PUBLIC_BACKEND_BASE_URL}/api/v1/auth/reset-password`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ phone: resetPhone, code: resetOtp, newPassword }),
                      });
                      const data = await res.json();
                      if (res.ok) {
                        alert("密码重置成功，请重新登录");
                        setShowResetPassword(false);
                        setPhone(resetPhone);
                        setMode("password");
                      } else {
                        alert(data.error || "重置失败");
                      }
                    } catch {
                      alert("网络错误");
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text className="text-white font-bold">确认重置</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Screen>
  );
}