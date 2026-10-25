import { DetailBack } from "../back";
import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View, Text } from "react-native";
import { ui } from "../theme";
import { TripProvider, useTrips } from "../store";
function Shell() {
  const { ready, loadFailed, error } = useTrips();
  if (!ready)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator accessibilityLabel="여행 불러오는 중" />
      </View>
    );
  if (loadFailed)
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Text accessibilityRole="alert">{error}</Text>
      </View>
    );
  return (
    <>
      <StatusBar style="dark" />
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={{ padding: 16, paddingTop: 52, backgroundColor: "#FBE8CB" }}
        >
          {error}
        </Text>
      )}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: ui.bg },
          headerTintColor: ui.ink,
          headerLeft: () => <DetailBack />,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: ui.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="chapters"
          options={{ title: "Afield", headerLeft: () => null }}
        />
        <Stack.Screen
          name="new-trip"
          options={{ title: "새로운 여행", presentation: "modal" }}
        />
        <Stack.Screen
          name="trip/[tripId]/(tabs)"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="trip/[tripId]/edit"
          options={{ title: "여행 정보", presentation: "modal" }}
        />
        <Stack.Screen
          name="trip/[tripId]/entry/[entryId]"
          options={{ title: "일정 장소", presentation: "modal" }}
        />
        <Stack.Screen
          name="trip/[tripId]/recommend"
          options={{ title: "장소 발견" }}
        />
        <Stack.Screen
          name="trip/[tripId]/place/[placeId]"
          options={{ title: "장소", presentation: "modal" }}
        />
      </Stack>
    </>
  );
}
export default function Root() {
  return (
    <TripProvider>
      <Shell />
    </TripProvider>
  );
}
