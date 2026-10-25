import React from "react";
import { Pressable, Text } from "react-native";
import { useGlobalSearchParams, useRouter } from "expo-router";
import { routeValue } from "./route";
import { ui } from "./theme";
export function DetailBack() {
  const router = useRouter();
  const params = useGlobalSearchParams<{ tripId?: string | string[] }>();
  const tripId = routeValue(params.tripId);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="뒤로"
      onPress={() => {
        if (router.canGoBack()) router.back();
        else if (tripId)
          router.replace({ pathname: "/trip/[tripId]", params: { tripId } });
        else router.replace("/chapters");
      }}
      style={{
        minHeight: 44,
        minWidth: 44,
        justifyContent: "center",
        paddingRight: 12,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "600", color: ui.accent }}>
        ‹ 뒤로
      </Text>
    </Pressable>
  );
}
