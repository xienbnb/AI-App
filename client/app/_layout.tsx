import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import Toast from 'react-native-toast-message';
import { Provider } from '@/components/Provider';

import '../global.css';

LogBox.ignoreLogs([
  "TurboModuleRegistry.getEnforcing(...): 'RNMapsAirModule' could not be found",
  // 添加其它想暂时忽略的错误或警告信息
]);

export default function RootLayout() {
  return (
    <Provider>
      <Stack
        screenOptions={{
          animation: 'slide_from_right',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          headerShown: false
        }}
      >
        <Stack.Screen name="(tabs)" options={{ title: "" }} />
        <Stack.Screen name="detail" options={{ title: "" }} />
        <Stack.Screen name="editor" options={{ title: "", animation: 'slide_from_right' }} />
        <Stack.Screen name="report" options={{ title: "", animation: 'slide_from_right' }} />
        <Stack.Screen name="post-detail" options={{ title: "", animation: 'slide_from_right' }} />
        <Stack.Screen name="ai-character" options={{ title: "AI角色库", animation: 'slide_from_right' }} />
        <Stack.Screen name="ai-outline" options={{ title: "大纲助手", animation: 'slide_from_right' }} />
        <Stack.Screen name="ai-cover" options={{ title: "封面生成器", animation: 'slide_from_right' }} />
        <Stack.Screen name="ai-detect" options={{ title: "AI检测", animation: 'slide_from_right' }} />
        <Stack.Screen name="ai-map" options={{ title: "地图生成器", animation: 'slide_from_right' }} />
        <Stack.Screen name="ai-image-gen" options={{ title: "图片生成", animation: 'slide_from_right' }} />
        <Stack.Screen name="ai-relationship" options={{ title: "人物关系网", animation: 'slide_from_right' }} />
      </Stack>
      <Toast />
    </Provider>
  );
}
