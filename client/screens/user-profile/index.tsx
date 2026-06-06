/**
 * 用户个人资料页面
 *
 * 展示和编辑用户个人资料，包含头像、昵称、笔名等字段
 * 支持查看其他用户个人资料（通过userId参数）
 * 底部包含三个Tab：我关注的、关注我的、动态
 *
 * @file /client/screens/user-profile/index.tsx
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
  Platform,
  Modal,
  Switch,
} from "react-native";
import { useSafeRouter, useSafeSearchParams } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";
import * as ImagePicker from "expo-image-picker";
import { FontAwesome6 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

interface UserProfile {
  id: string;
  nickname: string;
  penName: string;
  avatar: string;
  gender: "male" | "female" | "other" | "";
  phone: string;
  email: string;
  realName: string;
  bio: string;
  createdAt: string;
}

interface Follower {
  id: string;
  nickname: string;
  avatar: string;
  penName: string;
  followedAt: string;
}

interface Activity {
  id: string;
  type: "create" | "update" | "publish" | "comment" | "like";
  content: string;
  createdAt: string;
  targetId?: string;
  targetTitle?: string;
}

const genderOptions = [
  { value: "male", label: "男", icon: "mars" },
  { value: "female", label: "女", icon: "venus" },
  { value: "other", label: "其他", icon: "genderless" },
] as const;

export default function UserProfilePage() {
  const router = useSafeRouter();
  const params = useSafeSearchParams<{ userId?: string }>();
  const targetUserId = params.userId;

  // 是否为查看他人资料模式
  const isViewingOther = !!targetUserId;

  // 加载状态
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 用户资料
  const [profile, setProfile] = useState<UserProfile>({
    id: "",
    nickname: "",
    penName: "",
    avatar: "",
    gender: "",
    phone: "",
    email: "",
    realName: "",
    bio: "",
    createdAt: "",
  });

  // 编辑中的值（仅编辑模式使用）
  const [editPenName, setEditPenName] = useState("");
  const [editGender, setEditGender] = useState<"male" | "female" | "other" | "">("");
  const [editPhone, setEditPhone] = useState("");
  const [editBio, setEditBio] = useState("");

  // Tab切换
  const [activeTab, setActiveTab] = useState<"following" | "followers" | "activities">(
    "following"
  );

  // Tab数据
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [following, setFollowing] = useState<Follower[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  // 性别选择器
  const [showGenderPicker, setShowGenderPicker] = useState(false);

  // 头像上传中
  const [avatarUploading, setAvatarUploading] = useState(false);

  // 获取用户资料
  const fetchProfile = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("auth_token");
      if (!token) {
        setLoading(false);
        return;
      }
      // 构建URL：如果查看他人资料则带userId参数
      const url = targetUserId
        ? `${API_BASE}/api/v1/users/profile?userId=${targetUserId}`
        : `${API_BASE}/api/v1/users/profile`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.user) {
        const data = json.user;
        setProfile(data);
        setEditPenName(data.pen_name || "");
        setEditGender(data.gender || "");
        setEditPhone(data.phone || "");
        setEditBio(data.bio || "");
      }
    } catch (e) {
      console.error("获取用户资料失败", e);
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // 获取关注数据
  const fetchTabData = useCallback(async (tab: string) => {
    try {
      setTabLoading(true);
      const token = await AsyncStorage.getItem("auth_token");
      if (!token) return;

      const baseUrl = targetUserId
        ? `${API_BASE}/api/v1/users`
        : `${API_BASE}/api/v1/users`;

      if (tab === "followers") {
        const res = await fetch(
          `${baseUrl}/followers${targetUserId ? `?userId=${targetUserId}` : ""}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const json = await res.json();
        if (json.data !== undefined) setFollowers(json.data || []);
      } else if (tab === "following") {
        const res = await fetch(
          `${baseUrl}/following${targetUserId ? `?userId=${targetUserId}` : ""}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const json = await res.json();
        if (json.data !== undefined) setFollowing(json.data || []);
      } else if (tab === "activities") {
        const res = await fetch(
          `${baseUrl}/activities${targetUserId ? `?userId=${targetUserId}` : ""}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const json = await res.json();
        if (json.data !== undefined) setActivities(json.data || []);
      }
    } catch (e) {
      console.error("获取Tab数据失败", e);
    } finally {
      setTabLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab, fetchTabData]);

  // 更换头像
  const handleAvatarChange = () => {
    if (isViewingOther) return;
    Alert.alert("更换头像", "请选择更换方式", [
      {
        text: "从相册选择",
        onPress: async () => {
          try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
              Alert.alert("提示", "需要相册权限才能选择头像");
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (result.canceled || !result.assets?.[0]) return;

            setAvatarUploading(true);
            const token = await AsyncStorage.getItem("auth_token");
            if (!token) {
              Alert.alert("提示", "请先登录");
              return;
            }

            const localUri = result.assets[0].uri;
            const filename = localUri.split("/").pop() || "avatar.jpg";
            const match = /\.(\w+)$/.exec(filename);
            const ext = match ? match[1] : "jpg";
            const formData = new FormData();
            formData.append("avatar", {
              uri: localUri,
              type: `image/${ext}`,
              name: filename,
            } as any);

            const res = await fetch(`${API_BASE}/api/v1/users/avatar`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
              },
              body: formData,
            });
            const json = await res.json();
            if (json.success && json.url) {
              setProfile((prev) => ({ ...prev, avatar: json.url }));
              Alert.alert("成功", "头像已更新");
            } else {
              Alert.alert("上传失败", json.message || "请稍后重试");
            }
          } catch (e) {
            console.error("上传头像失败", e);
            Alert.alert("上传失败", "网络异常，请检查连接");
          } finally {
            setAvatarUploading(false);
          }
        },
      },
      {
        text: "拍照",
        onPress: async () => {
          try {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
              Alert.alert("提示", "需要相机权限才能拍照");
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (result.canceled || !result.assets?.[0]) return;

            setAvatarUploading(true);
            const token = await AsyncStorage.getItem("auth_token");
            if (!token) {
              Alert.alert("提示", "请先登录");
              return;
            }

            const localUri = result.assets[0].uri;
            const filename = localUri.split("/").pop() || "avatar.jpg";
            const match = /\.(\w+)$/.exec(filename);
            const ext = match ? match[1] : "jpg";
            const formData = new FormData();
            formData.append("avatar", {
              uri: localUri,
              type: `image/${ext}`,
              name: filename,
            } as any);

            const res = await fetch(`${API_BASE}/api/v1/users/avatar`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              body: formData,
            });
            const json = await res.json();
            if (json.success && json.url) {
              setProfile((prev) => ({ ...prev, avatar: json.url }));
              Alert.alert("成功", "头像已更新");
            } else {
              Alert.alert("上传失败", json.message || "请稍后重试");
            }
          } catch (e) {
            console.error("拍照上传失败", e);
            Alert.alert("上传失败", "网络异常，请检查连接");
          } finally {
            setAvatarUploading(false);
          }
        },
      },
      { text: "取消", style: "cancel" },
    ]);
  };

  // 保存资料
  const saveProfile = async () => {
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("auth_token");
      if (!token) {
        Alert.alert("提示", "请先登录");
        return;
      }
      const res = await fetch(`${API_BASE}/api/v1/users/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          penName: editPenName.trim(),
          gender: editGender,
          phone: editPhone.trim(),
          bio: editBio.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setProfile((prev) => ({
          ...prev,
          penName: editPenName.trim(),
          gender: editGender,
          phone: editPhone.trim(),
          bio: editBio.trim(),
        }));
        Alert.alert("保存成功", "个人资料已更新");
      } else {
        Alert.alert("保存失败", json.message || "请稍后重试");
      }
    } catch (e) {
      console.error("保存资料失败", e);
      Alert.alert("保存失败", "网络异常，请检查连接后重试");
    } finally {
      setSaving(false);
    }
  };

  // 获取活动图标
  const getActivityIcon = (type: string): string => {
    const icons: Record<string, string> = {
      create: "plus-circle",
      update: "pen-to-square",
      publish: "upload",
      comment: "comment",
      like: "heart",
    };
    return icons[type] || "circle";
  };

  // 获取活动图标颜色
  const getActivityColor = (type: string): string => {
    const colors: Record<string, string> = {
      create: "#10B981",
      update: "#3B82F6",
      publish: "#8B5CF6",
      comment: "#F59E0B",
      like: "#EF4444",
    };
    return colors[type] || "#9CA3AF";
  };

  // 获取活动描述
  const getActivityLabel = (type: string): string => {
    const labels: Record<string, string> = {
      create: "创建了",
      update: "更新了",
      publish: "发布了",
      comment: "评论了",
      like: "赞了",
    };
    return labels[type] || "操作了";
  };

  if (loading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text className="text-sm text-gray-400 mt-3">加载中...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-3">
        <TouchableOpacity
          className="w-9 h-9 rounded-xl items-center justify-center"
          style={{ backgroundColor: "#F3F4F6" }}
          onPress={() => router.back()}
        >
          <FontAwesome6 name="arrow-left" size={16} color="#374151" />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-bold text-gray-800 text-center mr-9">
          {isViewingOther ? "用户资料" : "个人资料"}
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ===== 个人信息卡片 ===== */}
        <View
          className="mx-4 rounded-3xl p-6 mb-5"
          style={{
            backgroundColor: "#4F46E5",
            shadowColor: "#4F46E5",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 16,
            elevation: 10,
          }}
        >
          {/* 头像和基本信息 */}
          <View className="flex-row items-center gap-4 mb-5">
            {/* 头像 */}
            <TouchableOpacity
              onPress={handleAvatarChange}
              disabled={isViewingOther}
              activeOpacity={0.7}
            >
              <View className="relative">
                {profile.avatar ? (
                  <Image
                    source={{ uri: profile.avatar }}
                    className="w-16 h-16 rounded-2xl"
                  />
                ) : (
                  <View className="w-16 h-16 rounded-2xl bg-white/20 items-center justify-center">
                    <FontAwesome6 name="user" size={28} color="#fff" />
                  </View>
                )}
                {!isViewingOther && (
                  <View className="absolute -right-1 -bottom-1 w-6 h-6 rounded-full bg-white items-center justify-center">
                    <FontAwesome6 name="camera" size={10} color="#4F46E5" />
                  </View>
                )}
                {avatarUploading && (
                  <View className="absolute inset-0 rounded-2xl bg-black/40 items-center justify-center">
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
              </View>
            </TouchableOpacity>

            <View className="flex-1">
              <Text className="text-xl font-bold text-white">
                {profile.nickname || "用户"}
              </Text>
              <Text className="text-sm text-white/70 mt-0.5">
                {profile.penName || "未设置笔名"}
              </Text>
            </View>
          </View>

          {/* 统计 */}
          <View className="flex-row justify-between bg-white/10 rounded-2xl p-4">
            <View className="items-center flex-1">
              <Text className="text-lg font-bold text-white">{following.length}</Text>
              <Text className="text-xs text-white/70 mt-1">关注</Text>
            </View>
            <View className="w-px bg-white/15" />
            <View className="items-center flex-1">
              <Text className="text-lg font-bold text-white">{followers.length}</Text>
              <Text className="text-xs text-white/70 mt-1">粉丝</Text>
            </View>
            <View className="w-px bg-white/15" />
            <View className="items-center flex-1">
              <Text className="text-lg font-bold text-white">{activities.length}</Text>
              <Text className="text-xs text-white/70 mt-1">动态</Text>
            </View>
          </View>
        </View>

        {/* ===== 编辑表单 ===== */}
        <View className="mx-4 mb-5">
          <Text className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2.5 ml-1">
            {isViewingOther ? "基本信息" : "编辑资料"}
          </Text>

          <View className="bg-white rounded-2xl overflow-hidden border border-gray-100">
            {/* 笔名 */}
            <View className="px-4 py-3.5 border-b border-gray-50">
              <Text className="text-xs font-medium text-gray-400 mb-1">笔名</Text>
              {isViewingOther ? (
                <Text className="text-sm text-gray-800">{profile.penName || "未设置"}</Text>
              ) : (
                <TextInput
                  className="text-sm text-gray-800 py-1"
                  placeholder="输入笔名"
                  placeholderTextColor="#CBD5E1"
                  value={editPenName}
                  onChangeText={setEditPenName}
                />
              )}
            </View>

            {/* 性别 */}
            <View className="px-4 py-3.5 border-b border-gray-50">
              <Text className="text-xs font-medium text-gray-400 mb-1">性别</Text>
              {isViewingOther ? (
                <Text className="text-sm text-gray-800">
                  {genderOptions.find((g) => g.value === profile.gender)?.label || "未设置"}
                </Text>
              ) : (
                <TouchableOpacity
                  className="flex-row items-center"
                  onPress={() => setShowGenderPicker(true)}
                >
                  <Text className="text-sm text-gray-800 flex-1">
                    {genderOptions.find((g) => g.value === editGender)?.label || "选择性别"}
                  </Text>
                  <FontAwesome6 name="chevron-down" size={12} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {/* 联系电话 */}
            <View className="px-4 py-3.5 border-b border-gray-50">
              <Text className="text-xs font-medium text-gray-400 mb-1">联系电话</Text>
              {isViewingOther ? (
                <Text className="text-sm text-gray-800">{profile.phone || "未设置"}</Text>
              ) : (
                <TextInput
                  className="text-sm text-gray-800 py-1"
                  placeholder="输入手机号"
                  placeholderTextColor="#CBD5E1"
                  value={editPhone}
                  onChangeText={setEditPhone}
                  keyboardType="phone-pad"
                />
              )}
            </View>

            {/* 邮箱（只读） */}
            <View className="px-4 py-3.5 border-b border-gray-50">
              <Text className="text-xs font-medium text-gray-400 mb-1">邮箱</Text>
              <View className="flex-row items-center">
                <Text className="text-sm text-gray-800 flex-1">{profile.email || "未设置"}</Text>
                <View className="bg-gray-100 rounded-full px-2 py-0.5">
                  <Text className="text-[10px] text-gray-500">只读</Text>
                </View>
              </View>
            </View>

            {/* 真实姓名（仅查看） */}
            <View className="px-4 py-3.5">
              <Text className="text-xs font-medium text-gray-400 mb-1">真实姓名</Text>
              <View className="flex-row items-center">
                <Text className="text-sm text-gray-800 flex-1">
                  {profile.realName || "未填写（仅后台可见）"}
                </Text>
                <View className="bg-gray-100 rounded-full px-2 py-0.5">
                  <Text className="text-[10px] text-gray-500">仅查看</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 个人简介（编辑模式下显示） */}
          {!isViewingOther && (
            <View className="bg-white rounded-2xl p-4 mt-3 border border-gray-100">
              <Text className="text-xs font-medium text-gray-400 mb-2">个人简介</Text>
              <TextInput
                className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-800 border border-gray-200 min-h-[80px]"
                placeholder="介绍一下自己..."
                placeholderTextColor="#CBD5E1"
                value={editBio}
                onChangeText={setEditBio}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          )}

          {/* 保存按钮（编辑模式） */}
          {!isViewingOther && (
            <TouchableOpacity
              className={`mt-4 py-3.5 rounded-xl items-center flex-row justify-center gap-2 ${
                saving ? "bg-gray-300" : "bg-indigo-500"
              }`}
              onPress={saveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <FontAwesome6 name="floppy-disk" size={14} color="#fff" />
              )}
              <Text className="text-sm font-semibold text-white">
                {saving ? "保存中..." : "保存资料"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ===== Tab 切换区 ===== */}
        <View className="mx-4 mb-5">
          <View className="flex-row bg-gray-100 rounded-xl p-1 mb-4">
            {[
              { key: "following" as const, label: "我关注的", icon: "user-plus" },
              { key: "followers" as const, label: "关注我的", icon: "user-group" },
              { key: "activities" as const, label: "动态", icon: "clock-rotate-left" },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg gap-1.5 ${
                  activeTab === tab.key ? "bg-white shadow-sm" : ""
                }`}
                onPress={() => setActiveTab(tab.key)}
              >
                <FontAwesome6
                  name={tab.icon as any}
                  size={11}
                  color={activeTab === tab.key ? "#4F46E5" : "#9CA3AF"}
                />
                <Text
                  className={`text-xs font-medium ${
                    activeTab === tab.key ? "text-indigo-600" : "text-gray-500"
                  }`}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab内容 */}
          {tabLoading ? (
            <View className="py-10 items-center">
              <ActivityIndicator size="small" color="#4F46E5" />
            </View>
          ) : activeTab === "following" ? (
            <View className="gap-2">
              {following.length === 0 ? (
                <View className="items-center py-10">
                  <View className="w-14 h-14 rounded-2xl items-center justify-center mb-3 bg-gray-50">
                    <FontAwesome6 name="user-plus" size={22} color="#CBD5E1" />
                  </View>
                  <Text className="text-sm text-gray-400">暂无关注</Text>
                </View>
              ) : (
                following.map((user) => (
                  <View
                    key={user.id}
                    className="flex-row items-center bg-white rounded-xl p-3.5 border border-gray-100"
                  >
                    {user.avatar ? (
                      <Image
                        source={{ uri: user.avatar }}
                        className="w-10 h-10 rounded-xl"
                      />
                    ) : (
                      <View className="w-10 h-10 rounded-xl bg-indigo-50 items-center justify-center">
                        <FontAwesome6 name="user" size={16} color="#4F46E5" />
                      </View>
                    )}
                    <View className="flex-1 ml-3">
                      <Text className="text-sm font-semibold text-gray-800">
                        {user.nickname}
                      </Text>
                      <Text className="text-xs text-gray-400 mt-0.5">
                        {user.penName || "笔名未设置"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      className="px-3 py-1.5 rounded-full bg-indigo-50"
                      onPress={() =>
                        router.push("/user-profile", { userId: user.id })
                      }
                    >
                      <Text className="text-xs font-medium text-indigo-600">查看</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          ) : activeTab === "followers" ? (
            <View className="gap-2">
              {followers.length === 0 ? (
                <View className="items-center py-10">
                  <View className="w-14 h-14 rounded-2xl items-center justify-center mb-3 bg-gray-50">
                    <FontAwesome6 name="user-group" size={22} color="#CBD5E1" />
                  </View>
                  <Text className="text-sm text-gray-400">暂无粉丝</Text>
                </View>
              ) : (
                followers.map((user) => (
                  <View
                    key={user.id}
                    className="flex-row items-center bg-white rounded-xl p-3.5 border border-gray-100"
                  >
                    {user.avatar ? (
                      <Image
                        source={{ uri: user.avatar }}
                        className="w-10 h-10 rounded-xl"
                      />
                    ) : (
                      <View className="w-10 h-10 rounded-xl bg-emerald-50 items-center justify-center">
                        <FontAwesome6 name="user" size={16} color="#10B981" />
                      </View>
                    )}
                    <View className="flex-1 ml-3">
                      <Text className="text-sm font-semibold text-gray-800">
                        {user.nickname}
                      </Text>
                      <Text className="text-xs text-gray-400 mt-0.5">
                        {user.penName || "笔名未设置"} · 关注于 {user.followedAt}
                      </Text>
                    </View>
                    <TouchableOpacity
                      className="px-3 py-1.5 rounded-full bg-emerald-50"
                      onPress={() =>
                        router.push("/user-profile", { userId: user.id })
                      }
                    >
                      <Text className="text-xs font-medium text-emerald-600">查看</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          ) : (
            <View className="gap-2">
              {activities.length === 0 ? (
                <View className="items-center py-10">
                  <View className="w-14 h-14 rounded-2xl items-center justify-center mb-3 bg-gray-50">
                    <FontAwesome6 name="clock-rotate-left" size={22} color="#CBD5E1" />
                  </View>
                  <Text className="text-sm text-gray-400">暂无动态</Text>
                </View>
              ) : (
                activities.map((activity) => (
                  <View
                    key={activity.id}
                    className="flex-row items-start bg-white rounded-xl p-3.5 border border-gray-100"
                  >
                    <View
                      className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                      style={{ backgroundColor: getActivityColor(activity.type) + "15" }}
                    >
                      <FontAwesome6
                        name={getActivityIcon(activity.type) as any}
                        size={14}
                        color={getActivityColor(activity.type)}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm text-gray-800 leading-5">
                        <Text className="font-semibold">{getActivityLabel(activity.type)}</Text>{" "}
                        {activity.content}
                      </Text>
                      {activity.targetTitle && (
                        <Text className="text-xs text-indigo-500 mt-1">
                          {activity.targetTitle}
                        </Text>
                      )}
                      <Text className="text-[10px] text-gray-400 mt-1">
                        {activity.createdAt}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* 性别选择弹出层 */}
      <Modal visible={showGenderPicker} transparent animationType="fade">
        <TouchableOpacity
          className="flex-1 justify-center items-center"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          activeOpacity={1}
          onPress={() => setShowGenderPicker(false)}
        >
          <TouchableOpacity
            className="bg-white rounded-2xl w-72 overflow-hidden"
            activeOpacity={1}
            onPress={() => undefined}
          >
            <View className="px-5 py-4 border-b border-gray-100">
              <Text className="text-base font-bold text-gray-800 text-center">选择性别</Text>
            </View>
            {genderOptions.map((option, index) => (
              <TouchableOpacity
                key={option.value}
                className={`flex-row items-center px-5 py-3.5 ${
                  index !== genderOptions.length - 1 ? "border-b border-gray-50" : ""
                }`}
                onPress={() => {
                  setEditGender(option.value);
                  setShowGenderPicker(false);
                }}
              >
                <FontAwesome6
                  name={option.icon as any}
                  size={16}
                  color={editGender === option.value ? "#4F46E5" : "#9CA3AF"}
                />
                <Text
                  className={`flex-1 text-sm ml-3 ${
                    editGender === option.value
                      ? "font-semibold text-indigo-600"
                      : "text-gray-700"
                  }`}
                >
                  {option.label}
                </Text>
                {editGender === option.value && (
                  <FontAwesome6 name="check" size={14} color="#4F46E5" />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              className="py-3 border-t border-gray-100"
              onPress={() => setShowGenderPicker(false)}
            >
              <Text className="text-sm text-gray-500 text-center">取消</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}