import React from "react";
import { Pressable, Text } from "react-native";
import { useGlobalSearchParams, useRouter } from "expo-router";
import { routeValue } from "./route";
import { ui } from "./theme";
export function DetailBack() {
  const router = useRouter();
  const params = useGlobalSearchParams<{ tripId?: string | string[]; returnTo?: string | string[]; date?: string | string[] }>();
  const tripId = routeValue(params.tripId);
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      accessibilityLabel="뒤로"
      onPress={() => {
        if (router.canGoBack()) router.back();
        else if (tripId && routeValue(params.returnTo) === "itinerary")
          router.replace({ pathname: "/trip/[tripId]/itinerary", params: { tripId, date: routeValue(params.date) } });
        else if (tripId)
          router.replace({ pathname: "/trip/[tripId]", params: { tripId } });
        else router.replace("/chapters");
      }}
      style={{
        minHeight: 48,
        minWidth: 80,
        justifyContent: "center",
        paddingHorizontal: 16,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "600", color: ui.accent }}>
        ‹ 뒤로
      </Text>
    </Pressable>
  );
}
