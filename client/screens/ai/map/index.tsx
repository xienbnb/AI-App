import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView, Image } from "react-native";
import { useState } from "react";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import { useRequireAuth } from "@/components/AuthGuard";
import { Screen } from "@/components/Screen";
import { FontAwesome6 } from "@expo/vector-icons";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

export default function MapGenPage() {
  const router = useSafeRouter();
  const requireAuth = useRequireAuth();
  const [worldName, setWorldName] = useState("");
  const [genre, setGenre] = useState("");
  const [features, setFeatures] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!requireAuth()) return;
    setLoading(true); setError(""); setImageUrl("");
    try {
      const res = await fetch(`${API_BASE}/api/v1/ai/map`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldName, genre, features }),
      });
      const json = await res.json();
      if (json.success) setImageUrl(json.imageUrl);
      else setError(json.errors?.[0] || "生成失败");
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
          <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center mr-2">
            <FontAwesome6 name="arrow-left" size={18} color="#374151" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-800">地图生成器</Text>
            <Text className="text-xs text-gray-400">生成奇幻/科幻世界地图</Text>
          </View>
          <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: "#EEF2FF" }}>
            <FontAwesome6 name="map" size={16} color="#6366F1" />
          </View>
        </View>

        <ScrollView className="flex-1 px-4">
          <View className="mt-3">
            <Text className="text-sm font-medium text-gray-700 mb-1">世界名称</Text>
            <TextInput className="bg-gray-50 rounded-xl px-4 py-3 text-gray-800" placeholder="例：玄天大陆、艾泽拉斯..." placeholderTextColor="#9CA3AF" value={worldName} onChangeText={setWorldName} />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-medium text-gray-700 mb-1">世界观风格</Text>
            <TextInput className="bg-gray-50 rounded-xl px-4 py-3 text-gray-800" placeholder="例：东方玄幻、西方魔幻、科幻..." placeholderTextColor="#9CA3AF" value={genre} onChangeText={setGenre} />
          </View>
          <View className="mt-3">
            <Text className="text-sm font-medium text-gray-700 mb-1">地图特色</Text>
            <TextInput className="bg-gray-50 rounded-xl px-4 py-3 text-gray-800 min-h-[80px]" placeholder="描述地图上需要包含的地形、国家、城市等" placeholderTextColor="#9CA3AF" value={features} onChangeText={setFeatures} multiline textAlignVertical="top" />
          </View>

          <TouchableOpacity onPress={handleGenerate} disabled={loading}
            className="mt-5 py-3.5 rounded-xl items-center flex-row justify-center"
            style={{ backgroundColor: loading ? "#9CA3AF" : "#6366F1" }}>
            {loading ? <ActivityIndicator size="small" color="white" /> : <><FontAwesome6 name="wand-magic-sparkles" size={16} color="white" /><Text className="text-white font-semibold ml-2">生成地图</Text></>}
          </TouchableOpacity>

          {error ? <View className="mt-4 p-3 bg-red-50 rounded-xl"><Text className="text-sm text-red-600">{error}</Text></View> : null}
          {loading ? <View className="mt-8 items-center py-10"><ActivityIndicator size="large" color="#6366F1" /><Text className="text-sm text-gray-400 mt-3">正在生成地图...</Text></View> : null}
          {imageUrl ? (
            <View className="mt-5 mb-8">
              <View className="flex-row items-center mb-3">
                <FontAwesome6 name="circle-check" size={14} color="#22C55E" />
                <Text className="text-sm font-semibold text-gray-700 ml-2">地图已生成</Text>
              </View>
              <Image source={{ uri: imageUrl }} className="w-full h-[350px] rounded-2xl" resizeMode="contain" style={{ backgroundColor: "#F3F4F6" }} />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}