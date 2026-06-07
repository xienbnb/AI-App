import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome6 } from "@expo/vector-icons";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

interface Post {
  id: string;
  title: string;
  status: "published" | "draft" | "archived";
  createdAt: string;
  views: number;
  likes: number;
  summary: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

export default function CommunityManageScreen() {
  const router = useSafeRouter();
  const [activeTab, setActiveTab] = useState<"published" | "draft" | "all">("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("auth_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["x-session"] = token;

      const res = await fetch(`${API_BASE}/api/v1/community/my-posts`, { headers });
      const json = await res.json();
      if (json.success) {
        setPosts(json.data || []);
      }
    } catch (e) {
      console.error("获取社区文章失败", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPosts();
    }, [fetchPosts])
  );

  const filteredPosts = activeTab === "all" ? posts : posts.filter((p) => p.status === activeTab);

  const handleDelete = (post: Post) => {
    Alert.alert("删除确认", `确定删除「${post.title}」吗？此操作不可恢复。`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: () => performDelete(post.id) },
    ]);
  };

  const performDelete = async (postId: string) => {
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["x-session"] = token;

      const res = await fetch(`${API_BASE}/api/v1/community/my-posts/${postId}`, {
        method: "DELETE",
        headers,
      });
      const json = await res.json();
      if (json.success) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        Alert.alert("删除成功");
      } else {
        Alert.alert("删除失败", json.error || "请稍后重试");
      }
    } catch (e) {
      Alert.alert("删除失败", "网络异常，请检查连接");
    }
  };

  const tabs = [
    { key: "all" as const, label: "全部", icon: "layer-group" },
    { key: "published" as const, label: "已发布", icon: "check-circle" },
    { key: "draft" as const, label: "草稿", icon: "pen-to-square" },
  ];

  return (
    <View className="flex-1 bg-gray-50">
      <SafeAreaView edges={["top"]} className="bg-white">
        <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center rounded-full bg-gray-100"
          >
            <FontAwesome6 name="arrow-left" size={18} color="#374151" />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-lg font-bold text-gray-900 mr-10">社区管理</Text>
        </View>

        {/* Tab筛选 */}
        <View className="flex-row px-4 py-3 gap-2">
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              className={`flex-row items-center px-4 py-2 rounded-full ${
                activeTab === tab.key ? "bg-indigo-500" : "bg-gray-100"
              }`}
              onPress={() => setActiveTab(tab.key)}
            >
              <FontAwesome6 name={tab.icon as any} size={12} color={activeTab === tab.key ? "#fff" : "#6B7280"} />
              <Text className={`text-xs font-medium ml-1.5 ${activeTab === tab.key ? "text-white" : "text-gray-600"}`}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-gray-400">加载中...</Text>
        </View>
      ) : filteredPosts.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <FontAwesome6 name="newspaper" size={48} color="#D1D5DB" />
          <Text className="text-sm text-gray-400 mt-3">暂无{activeTab === "all" ? "" : activeTab === "published" ? "已发布" : "草稿"}内容</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-4 mt-4" contentContainerStyle={{ paddingBottom: 20 }}>
          {filteredPosts.map((post) => (
            <TouchableOpacity
              key={post.id}
              className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 active:bg-gray-50"
              onPress={() => Alert.alert("查看文章", "查看详情功能开发中")}
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1 mr-3">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>{post.title || "未命名"}</Text>
                    <View className={`px-2 py-0.5 rounded-full ${
                      post.status === "published" ? "bg-emerald-50" :
                      post.status === "draft" ? "bg-gray-100" : "bg-amber-50"
                    }`}>
                      <Text className={`text-[10px] font-medium ${
                        post.status === "published" ? "text-emerald-600" :
                        post.status === "draft" ? "text-gray-500" : "text-amber-600"
                      }`}>
                        {post.status === "published" ? "已发布" : post.status === "draft" ? "草稿" : "已归档"}
                      </Text>
                    </View>
                  </View>
                  {post.summary && (
                    <Text className="text-xs text-gray-400 mt-1" numberOfLines={2}>{post.summary}</Text>
                  )}
                  <View className="flex-row items-center mt-2 gap-4">
                    <Text className="text-[10px] text-gray-300">{formatDate(post.createdAt)}</Text>
                    <View className="flex-row items-center gap-1">
                      <FontAwesome6 name="eye" size={10} color="#D1D5DB" />
                      <Text className="text-[10px] text-gray-300">{post.views || 0}</Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <FontAwesome6 name="heart" size={10} color="#D1D5DB" />
                      <Text className="text-[10px] text-gray-300">{post.likes || 0}</Text>
                    </View>
                  </View>
                </View>
                <View className="gap-2">
                  <TouchableOpacity className="w-8 h-8 rounded-lg bg-gray-50 items-center justify-center">
                    <FontAwesome6 name="pen" size={12} color="#6B7280" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="w-8 h-8 rounded-lg bg-red-50 items-center justify-center"
                    onPress={() => handleDelete(post)}
                  >
                    <FontAwesome6 name="trash-can" size={12} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}