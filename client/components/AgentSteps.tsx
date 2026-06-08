import { useEffect, useRef } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, Easing } from "react-native-reanimated";

/**
 * Agent 思考链步骤展示组件
 * 实时展示 AI 正在执行的操作步骤
 */

export interface AgentStep {
  status: "pending" | "processing" | "completed" | "error";
  label: string;
  detail?: string;
  tool?: string;
}

interface AgentStepsProps {
  steps: AgentStep[];
  compact?: boolean;
}

function StepIcon({ status, index }: { status: AgentStep["status"]; index: number }) {
  if (status === "completed") {
    return <FontAwesome6 name="check-circle" size={16} color="#10B981" />;
  }
  if (status === "error") {
    return <FontAwesome6 name="circle-exclamation" size={16} color="#EF4444" />;
  }
  if (status === "processing") {
    return <ActivityIndicator size={14} color="#6366F1" />;
  }
  // pending
  return (
    <View className="w-4 h-4 rounded-full border-2 items-center justify-center" style={{ borderColor: "#D1D5DB" }}>
      <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#D1D5DB" }} />
    </View>
  );
}

function StepItem({ step, index, compact }: { step: AgentStep; index: number; compact: boolean }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    translateY.value = withSpring(0, { damping: 15, stiffness: 100 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const statusColors: Record<string, string> = {
    completed: "#10B981",
    processing: "#6366F1",
    error: "#EF4444",
    pending: "#9CA3AF",
  };

  return (
    <Animated.View
      style={animatedStyle}
      className={`flex-row items-start ${compact ? "py-1.5" : "py-2.5"} px-3 rounded-xl mb-1.5`}
    >
      {/* 连接线 */}
      {index > 0 && (
        <View
          className="absolute left-[19px] top-0 w-0.5"
          style={{
            height: compact ? 8 : 12,
            backgroundColor: step.status === "completed" ? "#10B981" : "#E5E7EB",
          }}
        />
      )}
      {/* 图标 */}
      <View className="mr-3 mt-0.5">
        <StepIcon status={step.status} index={index} />
      </View>
      {/* 内容 */}
      <View className="flex-1">
        <Text
          className={`font-medium ${compact ? "text-xs" : "text-sm"}`}
          style={{ color: statusColors[step.status] || "#374151" }}
        >
          {step.label}
        </Text>
        {step.detail && !compact && (
          <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={2}>
            {step.detail}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

export function AgentSteps({ steps, compact = false }: AgentStepsProps) {
  if (!steps.length) return null;

  return (
    <View className="mb-2">
      {steps.map((step, i) => (
        <StepItem key={i} step={step} index={i} compact={compact} />
      ))}
    </View>
  );
}