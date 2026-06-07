import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome6, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

const TASKS = {
  daily: [
    { id: "check_in", title: "每日签到", desc: "每天签到领取", icon: "calendar-check", color: "#4F46E5", bg: "#EEF2FF", reward: "1000 Token" },
    { id: "daily_write", title: "日写5000字", desc: "今日完成5000字创作", icon: "pen-nib", color: "#3B82F6", bg: "#EFF6FF", reward: "2000 Token" },
  ],
  achievement: [
    { id: "new_user", title: "新人福利", desc: "新用户注册登录", icon: "gift", color: "#EC4899", bg: "#FDF2F8", reward: "3000 Token" },
    { id: "share", title: "分享给别人", desc: "分享作品给好友", icon: "share-nodes", color: "#8B5CF6", bg: "#F5F3FF", reward: "1000 Token" },
    { id: "bind_phone", title: "绑定手机号", desc: "在设置中绑定手机号", icon: "mobile-button", color: "#059669", bg: "#ECFDF5", reward: "5000 Token" },
    { id: "invite", title: "邀请好友注册", desc: "邀请好友注册成功", icon: "user-plus", color: "#EF4444", bg: "#FEF2F2", reward: "6000 Token" },
  ],
  calls: [
    { id: "watch_ad", title: "看广告", desc: "观看视频广告获取次数", icon: "play-circle", color: "#F59E0B", bg: "#FFFBEB", reward: "+10次 +1000 Token" },
    { id: "publish_skill", title: "发布技能/帖子", desc: "在社区发布内容", icon: "bullhorn", color: "#06B6D4", bg: "#ECFEFF", reward: "1000 Token" },
  ],
};

export default function WelfareScreen() {
  const router = useSafeRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await AsyncStorage.getItem("auth_token");
    return token ? { "x-session": token, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCompletedTasks();
    }, [])
  );

  const fetchCompletedTasks = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/v1/welfare/tasks`, { headers: headers as any });
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, boolean> = {};
        (data.tasks || []).forEach((t: any) => { map[t.taskType] = t.completed || t.rewardClaimed; });
        setCompletedTasks(map);
      }
    } catch { /* ignore */ }
  };

  const handleClaim = async (taskId: string) => {
    if (loading) return;
    setLoading(taskId);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/v1/welfare/claim`, {
        method: "POST",
        headers: headers as any,
        body: JSON.stringify({ taskType: taskId }),
      });
      const data = await res.json();
      if (res.ok) {
        setCompletedTasks((prev) => ({ ...prev, [taskId]: true }));
        Alert.alert("领取成功", `恭喜获得 ${data.reward || ""}！`);
      } else {
        Alert.alert("提示", data.error || "领取失败");
      }
    } catch {
      Alert.alert("提示", "网络错误，请重试");
    } finally {
      setLoading(null);
    }
  };

  const renderTasks = (tasks: typeof TASKS.daily, sectionTitle: string, icon: string, accentColor: string) => (
    <View className="mb-5">
      <View className="flex-row items-center mb-3 ml-1">
        <FontAwesome6 name={icon} size={14} color={accentColor} />
        <Text className="text-sm font-semibold text-gray-700 ml-2">{sectionTitle}</Text>
      </View>
      {tasks.map((task) => {
        const done = completedTasks[task.id];
        return (
          <TouchableOpacity
            key={task.id}
            className="bg-white rounded-2xl p-4 mb-2.5 border border-gray-100"
            activeOpacity={0.7}
            onPress={() => handleClaim(task.id)}
          >
            <View className="flex-row items-center">
              <View className="w-11 h-11 rounded-2xl items-center justify-center mr-4" style={{ backgroundColor: task.bg }}>
                <FontAwesome6 name={task.icon as any} size={18} color={task.color} />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-semibold text-gray-900">{task.title}</Text>
                  {done && (
                    <View className="px-2 py-0.5 rounded-full bg-green-50">
                      <Text className="text-[10px] font-medium text-green-600">已领取</Text>
                    </View>
                  )}
                </View>
                <Text className="text-xs text-gray-400 mt-0.5">{task.desc}</Text>
              </View>
              <View className="items-end ml-2">
                <Text className="text-xs font-bold" style={{ color: task.color }}>{task.reward}</Text>
                <TouchableOpacity
                  className={`mt-1 px-3 py-1.5 rounded-lg ${done ? "bg-gray-100" : "bg-indigo-50"}`}
                  onPress={() => handleClaim(task.id)}
                >
                  {loading === task.id ? (
                    <ActivityIndicator size={12} color="#4F46E5" />
                  ) : (
                    <Text className={`text-[11px] font-medium ${done ? "text-gray-400" : "text-indigo-600"}`}>
                      {done ? "已领取" : "去领取"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50">
      <SafeAreaView edges={["top"]} className="bg-white">
        <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
          <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center rounded-full bg-gray-100">
            <FontAwesome6 name="arrow-left" size={18} color="#374151" />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-lg font-bold text-gray-900 mr-10">福利中心</Text>
        </View>
      </SafeAreaView>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 16, paddingBottom: 40 }}>
        {/* 横幅 */}
        <View className="p-5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 mb-4">
          <View className="flex-row items-center">
            <FontAwesome6 name="gift" size={24} color="#fff" />
            <Text className="text-lg font-bold text-white ml-3">福利中心</Text>
          </View>
          <Text className="text-sm text-indigo-100 mt-2 leading-5">
            完成每日任务和成就挑战，赢取海量免费字数和调用次数！
          </Text>
        </View>

        {/* 每日任务 */}
        {renderTasks(TASKS.daily, "每日任务", "calendar-day", "#4F46E5")}

        {/* 成就任务 */}
        {renderTasks(TASKS.achievement, "成就任务", "trophy", "#F59E0B")}

        {/* 次数获取 */}
        {renderTasks(TASKS.calls, "次数获取", "chart-simple", "#10B981")}
      </ScrollView>
    </View>
  );
}