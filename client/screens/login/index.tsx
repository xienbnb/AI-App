/**
 * 登录/注册页面
 *
 * 功能：邮箱密码登录、注册（双视图切换）
 * 基于后端 Auth API 实现，遵循 Supabase Auth 规范
 *
 * @file /client/screens/login/index.tsx
 */
import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Animated,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

const ICON_URL =
  "https://coze-coding-project.tos.coze.site/gen_project_icon/2026-06-02/7646488958477664296_1780350054.png?sign=4902578837-3c5f038ebf-0-b5c907b1c96f905e7836aca6356e3085505dc98152badec5f9730017f28296e6";
const APP_NAME = "AI写作App";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useSafeRouter();
  const { login: authLogin } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");

  // 表单状态
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  // 交互状态
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Password strength indicator for register
  const passwordStrength = useCallback((pwd: string) => {
    if (!pwd) return { level: 0, label: "", color: "#D1D5DB" };
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
    const score = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
    if (pwd.length >= 8 && score >= 3) return { level: 3, label: "强", color: "#10B981" };
    if (pwd.length >= 6 && score >= 2) return { level: 2, label: "中", color: "#F59E0B" };
    return { level: 1, label: "弱", color: "#EF4444" };
  }, []);

  const strength = passwordStrength(password);

  // 登录
  const handleLogin = useCallback(async () => {
    Keyboard.dismiss();
    setError("");
    setSuccess("");

    if (!email.trim()) { setError("请输入邮箱"); return; }
    if (!password) { setError("请输入密码"); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "登录失败");
        return;
      }

      await authLogin(data.token);
      setSuccess("登录成功");
      setTimeout(() => router.replace("/"), 300);
    } catch (err: any) {
      setError(err.message || "网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }, [email, password, authLogin, router]);

  // 注册
  const handleRegister = useCallback(async () => {
    Keyboard.dismiss();
    setError("");
    setSuccess("");

    if (!email.trim()) { setError("请输入邮箱"); return; }
    if (!password) { setError("请输入密码"); return; }
    if (password.length < 6) { setError("密码至少6位"); return; }
    if (password !== confirmPassword) { setError("两次密码不一致"); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, nickname: email.trim().split("@")[0] }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "注册失败");
        return;
      }

      // 注册成功后自动登录
      const loginRes = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const loginData = await loginRes.json();

      if (!loginRes.ok) {
        setError(loginData.error || "自动登录失败");
        return;
      }

      await authLogin(loginData.token);
      setSuccess("注册成功");
      setTimeout(() => router.replace("/"), 300);
    } catch (err: any) {
      setError(err.message || "网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }, [email, password, confirmPassword, authLogin, router]);

  const toggleMode = () => {
    setError("");
    setSuccess("");
    setMode(mode === "login" ? "register" : "login");
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} disabled={Platform.OS === "web"}>
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="px-6" style={{ paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }}>
              {/* 应用图标 */}
              <View className="items-center mb-4">
                <View className="w-[72px] h-[72px] rounded-2xl overflow-hidden bg-amber-100 items-center justify-center">
                  <FontAwesome6 name="pen-fancy" size={28} color="#D97706" />
                </View>
              </View>

              {/* 应用名称 */}
              <Text className="text-2xl font-bold text-center text-gray-800 mb-8">
                {APP_NAME}
              </Text>

              {/* 模式切换 Tab */}
              <View className="flex-row bg-amber-50 rounded-2xl p-1 mb-6 mx-2">
                <TouchableOpacity
                  className={`flex-1 py-3 rounded-xl ${mode === "login" ? "bg-white shadow-sm" : ""}`}
                  onPress={() => mode !== "login" && toggleMode()}
                >
                  <Text className={`text-center font-semibold text-sm ${mode === "login" ? "text-amber-700" : "text-gray-400"}`}>
                    登录
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 py-3 rounded-xl ${mode === "register" ? "bg-white shadow-sm" : ""}`}
                  onPress={() => mode !== "register" && toggleMode()}
                >
                  <Text className={`text-center font-semibold text-sm ${mode === "register" ? "text-amber-700" : "text-gray-400"}`}>
                    注册
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 错误提示 */}
              {error ? (
                <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 mx-2">
                  <Text className="text-red-600 text-sm text-center">{error}</Text>
                </View>
              ) : null}

              {/* 成功提示 */}
              {success ? (
                <View className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 mx-2">
                  <Text className="text-green-600 text-sm text-center">{success}</Text>
                </View>
              ) : null}

              {/* 邮箱输入 */}
              <View className="mx-2 mb-3">
                <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">邮箱</Text>
                <View className="flex-row items-center bg-amber-50/80 border border-amber-200/60 rounded-2xl px-4 h-[52px]">
                  <FontAwesome6 name="envelope" size={16} color="#D97706" />
                  <TextInput
                    className="flex-1 ml-3 text-base text-gray-800"
                    placeholder="请输入邮箱"
                    placeholderTextColor="#B8A58C"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* 密码输入 */}
              <View className="mx-2 mb-3">
                <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">密码</Text>
                <View className="flex-row items-center bg-amber-50/80 border border-amber-200/60 rounded-2xl px-4 h-[52px]">
                  <FontAwesome6 name="lock" size={16} color="#D97706" />
                  <TextInput
                    className="flex-1 ml-3 text-base text-gray-800"
                    placeholder={mode === "register" ? "至少6位密码" : "请输入密码"}
                    placeholderTextColor="#B8A58C"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-2">
                    <FontAwesome6 name={showPassword ? "eye" : "eye-slash"} size={16} color="#B8A58C" />
                  </TouchableOpacity>
                </View>
                {/* 密码强度指示（注册模式） */}
                {mode === "register" && password.length > 0 ? (
                  <View className="flex-row items-center mt-2 ml-1">
                    <View className="flex-row gap-1 flex-1">
                      {[1, 2, 3].map((level) => (
                        <View
                          key={level}
                          className="flex-1 h-1 rounded-full"
                          style={{
                            backgroundColor: strength.level >= level ? strength.color : "#E5E7EB",
                          }}
                        />
                      ))}
                    </View>
                    <Text className="text-xs ml-2" style={{ color: strength.color }}>
                      {strength.label}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* 确认密码（注册模式） */}
              {mode === "register" ? (
                <View className="mx-2 mb-4">
                  <Text className="text-xs font-medium text-gray-500 mb-1.5 ml-1">确认密码</Text>
                  <View className="flex-row items-center bg-amber-50/80 border border-amber-200/60 rounded-2xl px-4 h-[52px]">
                    <FontAwesome6 name="lock" size={16} color="#D97706" />
                    <TextInput
                      className="flex-1 ml-3 text-base text-gray-800"
                      placeholder="再次输入密码"
                      placeholderTextColor="#B8A58C"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPwd}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPwd(!showConfirmPwd)} className="p-2">
                      <FontAwesome6 name={showConfirmPwd ? "eye" : "eye-slash"} size={16} color="#B8A58C" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {/* 提交按钮 */}
              <View className="mx-2 mt-2">
                <TouchableOpacity
                  className="h-[52px] rounded-2xl items-center justify-center"
                  style={{ backgroundColor: loading ? "#9CA3AF" : "#D97706" }}
                  onPress={mode === "login" ? handleLogin : handleRegister}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-bold text-base">
                      {mode === "login" ? "登录" : "注册"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* 切换模式 */}
              <View className="items-center mt-6">
                <TouchableOpacity onPress={toggleMode} activeOpacity={0.7}>
                  <Text className="text-amber-600 text-sm">
                    {mode === "login" ? "还没有账号？去注册" : "已有账号？去登录"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Screen>
  );
}