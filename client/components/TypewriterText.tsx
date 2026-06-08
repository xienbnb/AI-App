import { useState, useEffect, useRef, useCallback } from "react";
import { Text, type TextProps, View } from "react-native";

/**
 * 打字机效果组件
 * 让文本逐字显示，模拟打字效果
 */
interface TypewriterTextProps extends Omit<TextProps, "children"> {
  text: string;
  speed?: number;
  enabled?: boolean;
  onComplete?: () => void;
  showCursor?: boolean;
  cursorColor?: string;
  className?: string;
}

export function TypewriterText({
  text,
  speed = 25,
  enabled = true,
  onComplete,
  showCursor = false,
  cursorColor = "#6366F1",
  style,
  className,
  ...textProps
}: TypewriterTextProps) {
  const [displayed, setDisplayed] = useState("");
  const completedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 打字效果动画
  useEffect(() => {
    // 重置
    setDisplayed("");
    completedRef.current = false;

    if (!enabled || !text) {
      setDisplayed(text || "");
      return;
    }

    // 长文本直接显示（超 3000 字符）
    if (text.length > 3000) {
      setDisplayed(text);
      return;
    }

    let index = 0;
    const chars = text;

    const typeNext = () => {
      if (index >= chars.length) {
        completedRef.current = true;
        onComplete?.();
        return;
      }
      index++;
      setDisplayed(chars.slice(0, index));
      // 根据位置自适应速度：前100字保持原速，后续逐渐加速
      const adjustedSpeed = index < 100 ? speed : Math.max(speed * 0.3, 5);
      timerRef.current = setTimeout(typeNext, adjustedSpeed);
    };

    timerRef.current = setTimeout(typeNext, speed);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, enabled, speed, onComplete]);

  if (!text) return null;

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end" }}>
      <Text style={style} className={className} {...textProps}>
        {displayed}
      </Text>
      {showCursor && !completedRef.current && (
        <View
          style={{
            width: 2,
            height: 16,
            backgroundColor: cursorColor,
            marginLeft: 1,
            borderRadius: 1,
            opacity: 1,
          }}
        />
      )}
    </View>
  );
}