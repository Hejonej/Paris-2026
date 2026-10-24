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
        headerStyle: { backgroundColor: ui.bg },
        headerTitleStyle: { fontWeight: "700" },
        tabBarActiveTintColor: ui.ink,
        tabBarInactiveTintColor: ui.muted,
        tabBarStyle: {
          backgroundColor: ui.surface,
          borderTopColor: ui.line,
          paddingTop: 6,
        },
        headerRight: () => (
          <Pressable
            onPress={() => router.dismissTo("/chapters")}
            style={{ padding: 10 }}
          >
            <Text style={{ color: ui.muted }}>여행 변경 ▾</Text>
          </Pressable>
        ),
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
        options={{ title: "후보", tabBarIcon: icon("bookmark-outline") }}
      />
      <Tabs.Screen
        name="journal"
        options={{ title: "기록", tabBarIcon: icon("book-outline") }}
      />
    </Tabs>
  );
}
