import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from "react-native";
import { useSafeRouter, useSafeSearchParams } from "@/hooks/useSafeRouter";
import { Screen } from "@/components/Screen";
import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { FontAwesome6 } from "@expo/vector-icons";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

interface Post {
  id: string;
  userName: string;
  title: string;
  content: string;
  tag: string;
  likes: number;
  comments: number;
  featured: number;
  createdAt: string;
}

export default function PostDetailScreen() {
  const router = useSafeRouter();
  const { id } = useSafeSearchParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPost = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/v1/community/${id}`);
      const json = await res.json();
      if (json.success) setPost(json.data);
    } catch (e) {
      console.error("获取帖子失败", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchPost();
    }, [fetchPost])
  );

  const handleLike = async () => {
    if (!post) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/community/${post.id}/like`, { method: "PUT" });
      const json = await res.json();
      if (json.success) {
        setPost((prev) => prev ? { ...prev, likes: json.data.likes } : prev);
      }
    } catch (e) {
      console.error("点赞失败", e);
    }
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "刚刚";
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString("zh-CN");
  };

  if (loading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </Screen>
    );
  }

  if (!post) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <FontAwesome6 name="circle-exclamation" size={40} color="#D1D5DB" />
          <Text className="text-gray-400 mt-3">帖子不存在</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView className="flex-1">
        <View className="px-4 pt-2">
          {/* 用户信息 */}
          <View className="flex-row items-center gap-3 mb-4">
            <View className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 items-center justify-center">
              <Text className="text-white font-bold text-sm">{post.userName[0]}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-800">{post.userName}</Text>
              <Text className="text-xs text-gray-400">{formatTime(post.createdAt)}</Text>
            </View>
            <TouchableOpacity className="px-3 py-1 bg-primary-500/10 rounded-full">
              <Text className="text-primary-500 text-xs font-medium">+ 关注</Text>
            </TouchableOpacity>
          </View>

          <Text className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-600 mb-2 overflow-hidden">
            {post.tag}
          </Text>
          <Text className="text-lg font-bold text-gray-800 mb-3">{post.title}</Text>

          <View className="mb-4">
            <Text className="text-gray-600 leading-relaxed">{post.content}</Text>
          </View>
        </View>

        {/* 互动栏 */}
        <View className="flex-row items-center justify-around py-4 mx-4 border-y border-gray-100 mb-4">
          <TouchableOpacity className="items-center gap-1" onPress={handleLike}>
            <FontAwesome6 name="heart" size={18} color="#9CA3AF" />
            <Text className="text-xs text-gray-500">{post.likes}</Text>
          </TouchableOpacity>
          <TouchableOpacity className="items-center gap-1">
            <FontAwesome6 name="comment" size={18} color="#9CA3AF" />
            <Text className="text-xs text-gray-500">{post.comments}</Text>
          </TouchableOpacity>
          <TouchableOpacity className="items-center gap-1">
            <FontAwesome6 name="bookmark" size={18} color="#9CA3AF" />
            <Text className="text-xs text-gray-500">收藏</Text>
          </TouchableOpacity>
          <TouchableOpacity className="items-center gap-1">
            <FontAwesome6 name="share-nodes" size={18} color="#9CA3AF" />
            <Text className="text-xs text-gray-500">分享</Text>
          </TouchableOpacity>
        </View>

        {/* 评论输入 */}
        <View className="px-4 py-3 border-t border-gray-100 bg-white">
          <View className="flex-row items-center gap-2">
            <TextInput
              placeholder="写下你的评论..."
              className="flex-1 px-4 py-3 rounded-full text-sm bg-gray-100 text-gray-700"
            />
            <TouchableOpacity
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{ backgroundColor: "#6366F1" }}
            >
              <FontAwesome6 name="paper-plane" size={16} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        <View className="h-8" />
      </ScrollView>
    </Screen>
  );
}
