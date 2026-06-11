/**
 * 认证守卫组件
 *
 * 不再强制登录！所有用户可直接进入使用本地功能。
 * 仅在使用 AI 功能时通过 requireAuth 弹窗提示登录。
 *
 * @file /client/components/AuthGuard.tsx
 */
import { ReactNode } from "react";
import { Alert } from "react-native";
import { useRouter, useRootNavigationState } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  children: ReactNode;
}

/**
 * 检查当前是否已登录，未登录则弹窗引导用户前往登录页
 * @returns true=已登录可继续, false=未登录已弹窗
 */
export function useRequireAuth(): () => boolean {
  const router = useRouter();
  const rootState = useRootNavigationState();
  const { isAuthenticated, isLoading } = useAuth();

  return () => {
    if (!rootState?.key || isLoading) return false;
    if (isAuthenticated) return true;

    Alert.alert(
      "需要登录",
      "该功能需要登录账号后才能使用，是否前往登录？",
      [
        { text: "取消", style: "cancel" },
        { text: "确定", onPress: () => router.push("/login") },
      ],
    );
    return false;
  };
}

export function AuthGuard({ children }: Props) {
  return <>{children}</>;
}