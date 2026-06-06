/**
 * 认证上下文
 *
 * 管理用户登录状态、Token 持久化（AsyncStorage）、自动恢复会话
 * 遵循 Supabase Auth 规范，Token 通过 x-session Header 传递
 *
 * @file /client/contexts/AuthContext.tsx
 */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";
const PHONE_KEY = "last_phone";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

interface UserInfo {
  id: string;
  email: string;
  nickname: string;
  avatar: string;
  bio: string;
}

interface AuthContextType {
  user: UserInfo | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<UserInfo>) => void;
  refreshUser: () => Promise<void>;
  getStoredPhone: () => Promise<string | null>;
  savePhone: (phone: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 从 AsyncStorage 恢复会话
  useEffect(() => {
    (async () => {
      try {
        const savedToken = await AsyncStorage.getItem(TOKEN_KEY);
        if (savedToken) {
          setToken(savedToken);
          // 验证 token 并获取用户信息
          const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
            headers: { "x-session": savedToken },
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
          } else {
            // Token 过期，清除
            await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
            setToken(null);
          }
        }
      } catch {
        // 静默失败，保持未登录状态
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const fetchUser = useCallback(async (tok: string): Promise<UserInfo | null> => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
        headers: { "x-session": tok },
      });
      if (res.ok) {
        const data = await res.json();
        return data.user;
      }
    } catch {
      // ignore
    }
    return null;
  }, []);

  const login = useCallback(async (tok: string, phone?: string) => {
    setToken(tok);
    await AsyncStorage.setItem(TOKEN_KEY, tok);
    if (phone) {
      await AsyncStorage.setItem(PHONE_KEY, phone);
    }
    const userInfo = await fetchUser(tok);
    if (userInfo) {
      setUser(userInfo);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(userInfo));
    }
  }, [fetchUser]);

  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  }, []);

  const updateUser = useCallback((userData: Partial<UserInfo>) => {

  const getStoredPhone = useCallback(async () => {
    return AsyncStorage.getItem(PHONE_KEY);
  }, []);

  const savePhone = useCallback(async (phone: string) => {
    await AsyncStorage.setItem(PHONE_KEY, phone);
  }, []);
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...userData };
      AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    const userInfo = await fetchUser(token);
    if (userInfo) {
      setUser(userInfo);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(userInfo));
    }
  }, [token, fetchUser]);

  const getStoredPhone = useCallback(async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(PHONE_KEY);
    } catch {
      return null;
    }
  }, []);

  const savePhone = useCallback(async (phone: string) => {
    try {
      await AsyncStorage.setItem(PHONE_KEY, phone);
    } catch {}
  }, []);

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token,
    isLoading,
    login,
    logout,
    updateUser,
    refreshUser,
    getStoredPhone,
    savePhone,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
