import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome6 } from "@expo/vector-icons";
import { useCSSVariable } from "uniwind";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [background, muted, accent, border] = useCSSVariable([
    "--color-background",
    "--color-muted",
    "--color-accent",
    "--color-border",
  ]) as string[];

  let tabBarStyle = {
    backgroundColor: background || "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: border || "#F3F4F6",
    paddingBottom: Platform.OS === "ios" ? insets.bottom : 4,
    height: Platform.OS === "ios" ? 85 : 64,
  };

  if (Platform.OS === "web") {
    tabBarStyle = {
      ...tabBarStyle,
      height: "auto" as unknown as number,
      paddingBottom: 8,
    };
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: accent || "#6366F1",
        tabBarInactiveTintColor: muted || "#9CA3AF",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginTop: -2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "首页",
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="house" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="works"
        options={{
          title: "作品",
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="book" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: "社区",
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="comments" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: "AI工坊",
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="wand-magic-sparkles" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: "我的",
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="user" size={20} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}