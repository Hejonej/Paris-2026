import React from "react";
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DetailBack } from "./back";
import { ui } from "./theme";
export function AppHeader({
  title,
  back = true,
  backContent,
}: {
  title: string;
  back?: boolean;
  backContent?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: ui.bg,
        borderBottomWidth: 1,
        borderColor: ui.line,
      }}
    >
      <View
        style={{
          minHeight: 56,
          paddingVertical: 4,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {back && (
          <View style={{ maxWidth: "44%", flexShrink: 1 }}>
            {backContent || <DetailBack />}
          </View>
        )}
        <Text
          accessibilityRole="header"
          numberOfLines={2}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 17,
            fontWeight: "700",
            color: ui.ink,
            textAlign: back ? "left" : "center",
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          {title}
        </Text>
      </View>
    </View>
  );
}
