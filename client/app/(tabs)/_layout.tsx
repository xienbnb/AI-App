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

  const bottomPad = Platform.OS === "ios" ? Math.max(insets.bottom - 4, 2) : 2;

  let tabBarStyle = {
    backgroundColor: background || "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: border || "#F3F4F6",
    paddingBottom: bottomPad,
    height: Platform.OS === "ios" ? 56 + bottomPad : 56,
    elevation: 0,
    shadowOpacity: 0,
  };

  if (Platform.OS === "web") {
    tabBarStyle = {
      ...tabBarStyle,
      height: 56,
      paddingBottom: 6,
    };
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: accent || "#6366F1",
        tabBarInactiveTintColor: muted || "#9CA3AF",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarItemStyle: { paddingVertical: 4 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "首页",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome6 name="house" size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="works"
        options={{
          title: "作品",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome6 name="book-open" size={18} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: "社区",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome6 name="comment" size={18} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: "AI工坊",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome6 name="brain" size={18} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: "我的",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome6 name="circle-user" size={18} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}