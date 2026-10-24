import React from "react";
import {
  ScrollView,
  Text,
  View,
  Pressable,
  StyleSheet,
  Image,
  TextInput,
  TextInputProps,
} from "react-native";
import { ui } from "./theme";
export function Page({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: ui.bg, flex: 1 }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
    >
      {children}
    </ScrollView>
  );
}
export function H({ children }: { children: React.ReactNode }) {
  return <Text style={s.h}>{children}</Text>;
}
export function P({ children }: { children: React.ReactNode }) {
  return <Text style={s.p}>{children}</Text>;
}
export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}
export function Card({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>;
}
export function Action({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && { backgroundColor: "#E7EBE2" },
        { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={{ color: secondary ? ui.ink : "white", fontWeight: "700" }}>
        {title}
      </Text>
    </Pressable>
  );
}
export function Photo({ uri, height = 160 }: { uri: string; height?: number }) {
  return (
    <Image
      source={{ uri }}
      accessibilityLabel="여행 분위기 참고 이미지"
      style={{
        height,
        width: "100%",
        borderRadius: 14,
        backgroundColor: ui.line,
        marginBottom: 14,
      }}
    />
  );
}
export function Field(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={ui.muted}
      {...props}
      style={[s.field, props.style]}
    />
  );
}
export const s = StyleSheet.create({
  h: {
    fontSize: 30,
    fontWeight: "700",
    color: ui.ink,
    letterSpacing: -0.7,
    marginBottom: 12,
  },
  p: { color: ui.muted, fontSize: 14, lineHeight: 22, marginBottom: 12 },
  label: {
    color: ui.accent,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: ui.surface,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: ui.line,
    gap: 6,
  },
  button: {
    backgroundColor: ui.accent,
    alignItems: "center",
    justifyContent: "center",
    padding: 13,
    borderRadius: 12,
    minHeight: 48,
    marginTop: 6,
  },
  field: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: ui.line,
    borderRadius: 12,
    padding: 12,
    backgroundColor: ui.surface,
    fontSize: 16,
    color: ui.ink,
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "700", color: ui.ink },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: ui.line,
    minHeight: 46,
  },
});
