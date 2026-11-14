import React from "react";
import { Tabs, useLocalSearchParams, useRouter, usePathname } from "expo-router";
import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ui } from "../../../../theme";
import { useTrips } from "../../../../store";
import { Redirect } from "expo-router";
export default function TripTabs() {
  const { tripId, returnTo, date } = useLocalSearchParams<{ tripId: string; returnTo?: string; date?: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const returning = returnTo === "itinerary" && pathname.endsWith("/candidates");
  const insets = useSafeAreaInsets();
  const { trips } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const icon =
    (name: React.ComponentProps<typeof Ionicons>["name"]) =>
    ({ color, size }: { color: string; size: number }) => (
      <Ionicons name={name} color={color} size={size} />
    );
  if (!trip) return <Redirect href="/chapters" />;
  return (
    <Tabs
      screenOptions={{
        freezeOnBlur: false,
        headerLeft: () => (
          <Pressable
            accessibilityRole="button"
      hitSlop={8}
            accessibilityLabel={returning ? "일정으로 돌아가기" : "여행 목록으로"}
            onPress={() => returning ? router.navigate({ pathname: "/trip/[tripId]/itinerary", params: { tripId, date, returnTo: "" } }) : router.dismissTo("/chapters")}
            style={{
              paddingHorizontal: 16,
              minHeight: 48,
              justifyContent: "center",
            }}
          >
            <Text style={{ color: ui.accent, fontSize: 18, fontWeight: "600" }}>{returning ? "‹ 일정" : "‹ 여행 목록"}</Text>
          </Pressable>
        ),
        headerStyle: { backgroundColor: ui.bg },
        headerTitleAlign: "center",
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, marginTop: 2, fontWeight: "500" },
        tabBarIconStyle: { width: 24, height: 24 },
        tabBarItemStyle: { minHeight: 44 },
        headerTitleStyle: { fontWeight: "700" },
        tabBarActiveTintColor: ui.ink,
        tabBarInactiveTintColor: ui.muted,
        tabBarStyle: {
          backgroundColor: ui.surface,
          borderTopColor: ui.line,
          height: 60 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          headerTitle: trip.name,
          tabBarIcon: icon("home-outline"),
        }}
      />
      <Tabs.Screen
        name="itinerary"
        options={{ title: "일정", tabBarIcon: icon("calendar-outline") }}
      />
      <Tabs.Screen
        name="candidates"
        options={{
          title: "가고 싶은 곳",
          tabBarIcon: icon("bookmark-outline"),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{ title: "기록", tabBarIcon: icon("book-outline") }}
      />
    </Tabs>
  );
}
