import React from "react";
import { Tabs, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ui } from "../../../../theme";
import { useTrips } from "../../../../store";
import { Redirect } from "expo-router";
export default function TripTabs() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const router = useRouter();
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
            accessibilityLabel="여행 목록으로"
            onPress={() => router.dismissTo("/chapters")}
            style={{
              paddingHorizontal: 16,
              minHeight: 44,
              justifyContent: "center",
            }}
          >
            <Text style={{ color: ui.accent, fontSize: 15 }}>‹ 여행 목록</Text>
          </Pressable>
        ),
        headerStyle: { backgroundColor: ui.bg },
        headerTitleStyle: { fontWeight: "700" },
        tabBarActiveTintColor: ui.ink,
        tabBarInactiveTintColor: ui.muted,
        tabBarStyle: {
          backgroundColor: ui.surface,
          borderTopColor: ui.line,
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
