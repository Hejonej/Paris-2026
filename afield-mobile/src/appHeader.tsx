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
      <View style={{ height: 56, justifyContent: "center" }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 17,
            fontWeight: "700",
            color: ui.ink,
            textAlign: "center",
            paddingHorizontal: 112,
          }}
        >
          {title}
        </Text>
        {back && (
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 4,
              bottom: 4,
              justifyContent: "center",
            }}
          >
            {backContent || <DetailBack />}
          </View>
        )}
      </View>
    </View>
  );
}
