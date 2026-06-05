/**
 * 认证守卫组件
 *
 * 在应用加载时检查登录状态，未登录时重定向到登录页
 * 支持首帧导航就绪检测，防止崩溃和死循环
 *
 * @file /client/components/AuthGuard.tsx
 */
import { useEffect, ReactNode } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter, useSegments, useRootNavigationState } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  children: ReactNode;
}

export function AuthGuard({ children }: Props) {
  const router = useRouter();
  const segments = useSegments();
  const rootState = useRootNavigationState();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // 待机检测：导航未挂载或认证正在加载
    if (!rootState?.key || isLoading) return;

    const inLoginRoute = segments[0] === "login";

    if (!isAuthenticated && !inLoginRoute) {
      // 未登录且不在登录页 → 跳转登录
      router.replace("/login");
    } else if (isAuthenticated && inLoginRoute) {
      // 已登录但在登录页 → 跳转首页
      router.replace("/");
    }
  }, [rootState?.key, isAuthenticated, isLoading, segments]);

  // 加载中或未登录时避免闪烁白屏
  if (isLoading || (!isAuthenticated && segments[0] !== "login")) {
    return (
      <View className="flex-1 bg-amber-50 items-center justify-center">
        <ActivityIndicator size="large" color="#D97706" />
      </View>
    );
  }

  return <>{children}</>;
}