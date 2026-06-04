import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Keyboard } from "react-native";
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

interface Comment {
  id: string;
  userName: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  replies: Comment[];
}

export default function PostDetailScreen() {
  const router = useSafeRouter();
  const { id, userName: fromUserName } = useSafeSearchParams<{ id: string; userName?: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; userName: string } | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [myName] = useState("用户");

  const fetchPost = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [postRes, commentsRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/community/${id}`),
        fetch(`${API_BASE}/api/v1/community/${id}/comments`),
      ]);
      const postJson = await postRes.json();
      const commentsJson = await commentsRes.json();
      if (postJson.success) setPost(postJson.data);
      if (commentsJson.success) setComments(commentsJson.data);
    } catch (e) {
      console.error("获取详情失败", e);
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

  const handleSendComment = async () => {
    if (!commentText.trim() || !post) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/community/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName: myName,
          content: commentText.trim(),
          parentId: replyTo?.id || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCommentText("");
        setReplyTo(null);
        fetchPost();
      }
    } catch (e) {
      console.error("评论失败", e);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/community/comments/${commentId}`, { method: "DELETE" });
      if (res.ok) fetchPost();
    } catch (e) {
      console.error("删除评论失败", e);
    }
  };

  const fetchUserProfile = async (name: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/community/user/${encodeURIComponent(name)}`);
      const json = await res.json();
      if (json.success) setUserData(json.data);
      setShowUserModal(true);
    } catch (e) {
      console.error("获取用户信息失败", e);
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

  const renderComment = (comment: Comment, depth = 0) => (
    <View key={comment.id} className={depth > 0 ? "ml-8 mt-2" : "mt-4"}>
      <View className="flex-row gap-2">
        <TouchableOpacity onPress={() => fetchUserProfile(comment.userName)}>
          <View className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 items-center justify-center">
            <Text className="text-white font-bold text-xs">{comment.userName[0]}</Text>
          </View>
        </TouchableOpacity>
        <View className="flex-1 bg-gray-50 rounded-2xl px-3 py-2">
          <View className="flex-row items-center gap-2">
            <TouchableOpacity onPress={() => fetchUserProfile(comment.userName)}>
              <Text className="text-xs font-medium text-gray-800">{comment.userName}</Text>
            </TouchableOpacity>
            <Text className="text-[10px] text-gray-400">{formatTime(comment.createdAt)}</Text>
          </View>
          <Text className="text-sm text-gray-700 mt-1 leading-relaxed">{comment.content}</Text>
          <View className="flex-row items-center gap-3 mt-1">
            <TouchableOpacity onPress={() => setReplyTo({ id: comment.id, userName: comment.userName })}>
              <Text className="text-[11px] text-primary-500 font-medium">回复</Text>
            </TouchableOpacity>
            {comment.userName === myName && (
              <TouchableOpacity onPress={() => handleDeleteComment(comment.id)}>
                <Text className="text-[11px] text-red-400">删除</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
      {comment.replies?.map((reply) => renderComment(reply, depth + 1))}
    </View>
  );

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
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        {/* 帖子内容 */}
        <View className="px-4 pt-2">
          <View className="flex-row items-center gap-3 mb-4">
            <TouchableOpacity onPress={() => fetchUserProfile(post.userName)}>
              <View className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 items-center justify-center">
                <Text className="text-white font-bold text-sm">{post.userName[0]}</Text>
              </View>
            </TouchableOpacity>
            <View className="flex-1">
              <TouchableOpacity onPress={() => fetchUserProfile(post.userName)}>
                <Text className="text-sm font-medium text-gray-800">{post.userName}</Text>
              </TouchableOpacity>
              <Text className="text-xs text-gray-400">{formatTime(post.createdAt)}</Text>
            </View>
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
          <View className="items-center gap-1">
            <FontAwesome6 name="comment" size={18} color="#9CA3AF" />
            <Text className="text-xs text-gray-500">{post.comments}</Text>
          </View>
        </View>

        {/* 评论区域 */}
        <View className="px-4 pb-4">
          <Text className="text-base font-bold text-gray-800 mb-4">
            评论 ({comments.length})
          </Text>

          {/* 评论列表 */}
          {comments.length === 0 ? (
            <View className="items-center py-8">
              <FontAwesome6 name="message" size={24} color="#D1D5DB" />
              <Text className="text-gray-400 mt-2 text-sm">暂无评论，来写第一条吧</Text>
            </View>
          ) : (
            comments.map((c) => renderComment(c))
          )}

          <View className="h-24" />
        </View>
      </ScrollView>

      {/* 底部评论输入框 */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View className="px-4 py-3 border-t border-gray-100 bg-white">
          {replyTo && (
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xs text-primary-500 font-medium">
                回复 @{replyTo.userName}
              </Text>
              <TouchableOpacity onPress={() => setReplyTo(null)}>
                <FontAwesome6 name="xmark" size={14} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          )}
          <View className="flex-row items-center gap-2">
            <TextInput
              placeholder={replyTo ? `回复 ${replyTo.userName}...` : "写下你的评论..."}
              value={commentText}
              onChangeText={setCommentText}
              className="flex-1 px-4 py-3 rounded-full text-sm bg-gray-100 text-gray-700"
            />
            <TouchableOpacity
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{ backgroundColor: commentText.trim() ? "#6366F1" : "#D1D5DB" }}
              onPress={handleSendComment}
              disabled={!commentText.trim()}
            >
              <FontAwesome6 name="paper-plane" size={16} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* 用户信息弹窗 */}
      <Modal visible={showUserModal} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" }}
          activeOpacity={1}
          onPress={() => setShowUserModal(false)}
        >
          <TouchableOpacity activeOpacity={1} className="bg-white rounded-3xl p-6 mx-8 w-[85%]" style={{ maxWidth: 400 }}>
            {userData ? (
              <>
                <View className="items-center mb-4">
                  <View className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 items-center justify-center mb-2">
                    <Text className="text-white font-bold text-xl">{userData.userName[0]}</Text>
                  </View>
                  <Text className="text-lg font-bold text-gray-800">{userData.userName}</Text>
                  <View className="flex-row gap-6 mt-2">
                    <View className="items-center">
                      <Text className="text-lg font-bold text-gray-800">{userData.posts?.length || 0}</Text>
                      <Text className="text-xs text-gray-400">帖子</Text>
                    </View>
                    <View className="items-center">
                      <Text className="text-lg font-bold text-gray-800">{userData.followers}</Text>
                      <Text className="text-xs text-gray-400">粉丝</Text>
                    </View>
                    <View className="items-center">
                      <Text className="text-lg font-bold text-gray-800">{userData.following}</Text>
                      <Text className="text-xs text-gray-400">关注</Text>
                    </View>
                  </View>
                </View>
                {userData.posts?.length > 0 && (
                  <>
                    <Text className="text-sm font-semibold text-gray-700 mb-2">最近帖子</Text>
                    {userData.posts.slice(0, 3).map((p: any) => (
                      <TouchableOpacity
                        key={p.id}
                        className="py-2 border-b border-gray-50"
                        onPress={() => {
                          setShowUserModal(false);
                          router.push("/post-detail", { id: p.id });
                        }}
                      >
                        <Text className="text-sm text-primary-500 font-medium" numberOfLines={1}>{p.title}</Text>
                        <Text className="text-xs text-gray-400">{p.tag} · {formatTime(p.createdAt)}</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
                <TouchableOpacity
                  className="mt-4 w-full py-2.5 rounded-xl items-center"
                  style={{ backgroundColor: "#6366F1" }}
                  onPress={() => setShowUserModal(false)}
                >
                  <Text className="text-white font-medium text-sm">关闭</Text>
                </TouchableOpacity>
              </>
            ) : (
              <ActivityIndicator size="small" color="#6366F1" />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}