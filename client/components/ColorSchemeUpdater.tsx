import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { ColorSchemeName, Platform } from 'react-native';
import { Uniwind } from 'uniwind'
import AsyncStorage from '@react-native-async-storage/async-storage';

// system: 跟随系统变化
// light: 固定为 light 主题
// dark: 固定为 dark 主题
const DEFAULT_THEME: 'system' | 'light' | 'dark' = 'system'
const THEME_KEY = 'user_theme';

// 将自定义主题映射到 Uniwind 支持的值
function mapToUniwindTheme(themeId: string): 'system' | 'light' | 'dark' {
  switch (themeId) {
    case 'dark': return 'dark';
    case 'sepia':
    case 'green':
    case 'light': return 'light';
    default: return 'system';
  }
}

const WebOnlyColorSchemeUpdater = function ({ children }: { children?: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 从 AsyncStorage 读取用户保存的主题
    AsyncStorage.getItem(THEME_KEY).then((savedTheme) => {
      const theme = savedTheme || DEFAULT_THEME;
      Uniwind.setTheme(mapToUniwindTheme(theme));
      setReady(true);
    });
  }, []);

  useEffect(() => {
    function handleMessage(e: MessageEvent<{ event: string; colorScheme: ColorSchemeName; } | undefined>) {
      if (e.data?.event === 'coze.workbench.colorScheme') {
        const cs = e.data.colorScheme;
        if (typeof cs === 'string') {
          Uniwind.setTheme(cs);
        }
      }
    }

    if (Platform.OS === 'web') {
      window.addEventListener('message', handleMessage, false);
    }

    return () => {
      if (Platform.OS === 'web') {
        window.removeEventListener('message', handleMessage, false);
      }
    }
  }, []);

  return <Fragment>
    {children}
  </Fragment>
};

export {
  WebOnlyColorSchemeUpdater,
}