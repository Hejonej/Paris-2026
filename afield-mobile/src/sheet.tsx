import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ui } from "./theme";
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: "flex-end" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title} 닫기`}
          onPress={onClose}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#00000055",
          }}
        />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: "88%",
            backgroundColor: ui.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingBottom: Math.max(insets.bottom, 16),
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 8,
              borderBottomWidth: 1,
              borderColor: ui.line,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 19,
                fontWeight: "700",
                color: ui.ink,
              }}
            >
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${title} 닫기`}
              onPress={onClose}
              style={{
                minWidth: 44,
                minHeight: 44,
                justifyContent: "center",
                alignItems: "flex-end",
              }}
            >
              <Text style={{ fontSize: 16, color: ui.blue }}>닫기</Text>
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export function StatusLine({
  label,
  verified = false,
}: {
  label: string;
  verified?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: 6,
      }}
    >
      <View
        style={{
          width: 4,
          height: 4,
          borderRadius: 2,
          backgroundColor: verified ? ui.blue : ui.muted,
        }}
      />
      <Text
        style={{
          fontSize: 13,
          lineHeight: 20,
          color: verified ? ui.blue : ui.muted,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
