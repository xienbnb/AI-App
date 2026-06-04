import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard } from "react-native";
import { useSafeRouter } from "@/hooks/useSafeRouter";
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

const TAGS = ["B 全部", "W 写作技巧", "N 素材分享", "Hand 互推互评", "Q 求助提问"];

export default function CommunityScreen() {
  const router = useSafeRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState("B 全部");
  const [searchText, setSearchText] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newTag, setNewTag] = useState("W 写作技巧");

  const fetchPosts = useCallback(async (tag?: string) => {
    try {
      setLoading(true);
      const url = tag && tag !== "B 全部"
        ? `${API_BASE}/api/v1/community?tag=${encodeURIComponent(tag)}`
        : `${API_BASE}/api/v1/community`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) setPosts(json.data);
    } catch (e) {
      console.error("获取帖子失败", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPosts(activeTag);
    }, [activeTag, fetchPosts])
  );

  const handleSearch = async () => {
    if (!searchText.trim()) {
      fetchPosts(activeTag);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/v1/community/search?q=${encodeURIComponent(searchText.trim())}`);
      const json = await res.json();
      if (json.success) setPosts(json.data);
    } catch (e) {
      console.error("搜索失败", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/community`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: "用户", title: newTitle.trim(), content: newContent.trim(), tag: newTag }),
      });
      const json = await res.json();
      if (json.success) {
        setShowCreate(false);
        setNewTitle("");
        setNewContent("");
        fetchPosts(activeTag);
      }
    } catch (e) {
      console.error("创建失败", e);
    }
  };

  const handleLike = async (postId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/community/${postId}/like`, { method: "PUT" });
      const json = await res.json();
      if (json.success) {
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, likes: json.data.likes } : p))
        );
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

  const renderPost = (post: Post) => (
    <TouchableOpacity
      key={post.id}
      onPress={() => router.push("/post-detail", { id: post.id })}
      className="bg-white rounded-2xl p-4"
      style={{
        shadowColor: "#6366F1",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
      }}
    >
      <View className="flex-row items-start gap-3 mb-3">
        <TouchableOpacity
          onPress={() => router.push("/post-detail", { id: post.id, userName: post.userName })}
          className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 items-center justify-center"
        >
          <Text className="text-white font-bold text-sm">{post.userName[0]}</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-sm font-medium text-gray-800">{post.userName}</Text>
            {post.featured === 1 && (
              <Text className="px-1.5 py-0.5 bg-yellow-100 text-yellow-600 text-[10px] rounded-full">精华</Text>
            )}
          </View>
          <Text className="text-xs text-gray-400">{formatTime(post.createdAt)}</Text>
        </View>
      </View>
      <Text className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-600 mb-2 overflow-hidden">
        {post.tag}
      </Text>
      <Text className="font-semibold text-gray-800 mb-2" numberOfLines={2}>{post.title}</Text>
      <View className="flex-row items-center gap-4">
        <TouchableOpacity className="flex-row items-center gap-1" onPress={() => handleLike(post.id)}>
          <FontAwesome6 name="heart" size={12} color="#9CA3AF" />
          <Text className="text-xs text-gray-500">{post.likes}</Text>
        </TouchableOpacity>
        <View className="flex-row items-center gap-1">
          <FontAwesome6 name="comment" size={12} color="#9CA3AF" />
          <Text className="text-xs text-gray-500">{post.comments}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <Screen>
      <ScrollView className="flex-1">
        {/* 顶部搜索 & 发帖 */}
        <View className="px-4 pt-2 pb-2">
          <View className="flex-row items-center gap-3 mb-4">
            <View className="flex-1 relative">
              <FontAwesome6
                name="magnifying-glass"
                size={14}
                color="#9CA3AF"
                style={{ position: "absolute", left: 14, top: 14, zIndex: 1 }}
              />
              <TextInput
                placeholder="搜索话题..."
                value={searchText}
                onChangeText={setSearchText}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
                className="w-full px-4 py-3 rounded-xl text-sm bg-gray-100 text-gray-700 pl-10"
              />
            </View>
            <TouchableOpacity
              className="w-12 h-12 rounded-xl items-center justify-center"
              style={{ backgroundColor: "#6366F1" }}
              onPress={() => setShowCreate(true)}
            >
              <FontAwesome6 name="pen" size={16} color="white" />
            </TouchableOpacity>
          </View>

          {/* 标签页 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 -mx-4 px-4">
            <View className="flex-row gap-2">
              {TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  onPress={() => { setActiveTag(tag); setSearchText(""); }}
                  className={`px-4 py-2 rounded-full ${activeTag === tag ? "bg-primary-500" : "bg-gray-100"}`}
                >
                  <Text className={`text-xs font-medium ${activeTag === tag ? "text-white" : "text-gray-700"}`}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* 帖子列表 */}
        <View className="px-4 gap-4 pb-8">
          {loading ? (
            <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 40 }} />
          ) : posts.length === 0 ? (
            <View className="items-center py-12">
              <FontAwesome6 name="comments" size={40} color="#D1D5DB" />
              <Text className="text-gray-400 mt-3">暂无帖子</Text>
              <TouchableOpacity
                className="mt-4 px-6 py-2 rounded-full"
                style={{ backgroundColor: "#6366F1" }}
                onPress={() => setShowCreate(true)}
              >
                <Text className="text-white text-sm font-medium">发起讨论</Text>
              </TouchableOpacity>
            </View>
          ) : (
            posts.map(renderPost)
          )}
        </View>
      </ScrollView>

      {/* 创建帖子弹窗 */}
      <Modal visible={showCreate} transparent animationType="slide">
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => Keyboard.dismiss()}
        >
          <KeyboardAvoidingView
            style={{ flex: 1, justifyContent: "flex-end" }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View className="bg-white rounded-t-3xl p-6" style={{ maxHeight: "85%" }}>
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-lg font-bold text-gray-800">发布帖子</Text>
                <TouchableOpacity onPress={() => setShowCreate(false)}>
                  <FontAwesome6 name="xmark" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              <TextInput
                placeholder="标题"
                value={newTitle}
                onChangeText={setNewTitle}
                className="w-full px-4 py-3 rounded-xl text-sm bg-gray-100 text-gray-700 mb-3"
              />
              <TextInput
                placeholder="内容（可选）"
                value={newContent}
                onChangeText={setNewContent}
                multiline
                numberOfLines={5}
                className="w-full px-4 py-3 rounded-xl text-sm bg-gray-100 text-gray-700 mb-3 min-h-[120px] textAlignVertical-top"
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                <View className="flex-row gap-2">
                  {["W 写作技巧", "N 素材分享", "Hand 互推互评", "Q 求助提问"].map((t) => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setNewTag(t)}
                      className={`px-3 py-1.5 rounded-full ${newTag === t ? "bg-primary-500" : "bg-gray-100"}`}
                    >
                      <Text className={`text-xs ${newTag === t ? "text-white" : "text-gray-600"}`}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <TouchableOpacity
                className="w-full py-3 rounded-xl items-center"
                style={{ backgroundColor: newTitle.trim() ? "#6366F1" : "#D1D5DB" }}
                onPress={handleCreatePost}
                disabled={!newTitle.trim()}
              >
                <Text className="text-white font-medium">发布</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
}