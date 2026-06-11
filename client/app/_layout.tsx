import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import Toast from 'react-native-toast-message';
import { Provider } from '@/components/Provider';
import { AuthGuard } from '@/components/AuthGuard';

import '../global.css';

LogBox.ignoreLogs([
  "TurboModuleRegistry.getEnforcing(...): 'RNMapsAirModule' could not be found",
  // 添加其它想暂时忽略的错误或警告信息
]);

export default function RootLayout() {
  return (
    <Provider>
      <AuthGuard>
        <Stack
          screenOptions={{
            animation: 'slide_from_right',
            gestureEnabled: true,
            gestureDirection: 'horizontal',
            headerShown: false
          }}
        >
          <Stack.Screen name="login" options={{ title: "" }} />
          <Stack.Screen name="(tabs)" options={{ title: "" }} />
          <Stack.Screen name="detail" options={{ title: "" }} />
          <Stack.Screen name="outline-create" options={{ title: "", animation: 'slide_from_right' }} />
          <Stack.Screen name="content-editor" options={{ title: "", animation: 'slide_from_right' }} />
          <Stack.Screen name="editor" options={{ title: "", animation: 'slide_from_right' }} />
          <Stack.Screen name="report" options={{ title: "", animation: 'slide_from_right' }} />
          <Stack.Screen name="post-detail" options={{ title: "", animation: 'slide_from_right' }} />
          <Stack.Screen name="ai-skills" options={{ title: "创作技能", animation: 'slide_from_right' }} />
          <Stack.Screen name="ai-knowledge" options={{ title: "知识库", animation: 'slide_from_right' }} />
          <Stack.Screen name="ai-character" options={{ title: "AI角色库", animation: 'slide_from_right' }} />
          <Stack.Screen name="ai-outline" options={{ title: "大纲助手", animation: 'slide_from_right' }} />
          <Stack.Screen name="ai-cover" options={{ title: "封面生成", animation: 'slide_from_right' }} />
          <Stack.Screen name="ai-detect" options={{ title: "AI检测", animation: 'slide_from_right' }} />
          <Stack.Screen name="ai-map" options={{ title: "地图生成", animation: 'slide_from_right' }} />
          <Stack.Screen name="ai-image-gen" options={{ title: "图片生成", animation: 'slide_from_right' }} />
          <Stack.Screen name="ai-relationship" options={{ title: "人物关系", animation: 'slide_from_right' }} />
          <Stack.Screen name="settings" options={{ title: "设置", animation: 'slide_from_right' }} />
          <Stack.Screen name="tos" options={{ title: "", animation: 'slide_from_right' }} />
          <Stack.Screen name="privacy" options={{ title: "", animation: 'slide_from_right' }} />
          <Stack.Screen name="my-ai-settings" options={{ title: "", animation: 'slide_from_right' }} />
          <Stack.Screen name="help-feedback" options={{ title: "", animation: 'slide_from_right' }} />
          <Stack.Screen name="about" options={{ title: "", animation: 'slide_from_right' }} />
          <Stack.Screen name="user-profile" options={{ title: "", animation: 'slide_from_right' }} />
          <Stack.Screen name="vip" options={{ title: "", animation: 'slide_from_right' }} />
          <Stack.Screen name="vip-packages" options={{ title: "", animation: 'slide_from_right' }} />
          <Stack.Screen name="recharge" options={{ title: "", animation: 'slide_from_right' }} />
          <Stack.Screen name="account-security" options={{ title: "", animation: 'slide_from_right' }} />
          <Stack.Screen name="billing" options={{ title: "扣费明细", animation: 'slide_from_right' }} />
          <Stack.Screen name="community-manage" options={{ title: "社区管理", animation: 'slide_from_right' }} />
          <Stack.Screen name="community" options={{ title: "社区", animation: 'slide_from_right' }} />
          <Stack.Screen name="tutorial" options={{ title: "操作教程", animation: 'slide_from_right' }} />
          <Stack.Screen name="welfare" options={{ title: "福利中心", animation: 'slide_from_right' }} />
          <Stack.Screen name="admin" options={{ title: "管理中心", animation: 'slide_from_right' }} />
        </Stack>
        <Toast />
      </AuthGuard>
    </Provider>
  );
}
