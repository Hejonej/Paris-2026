import React from "react";
import { useRouter } from "expo-router";
import { View, Text, Pressable, Image } from "react-native";
import { Page, H, P, Label, Action, s } from "../ui";
import { cover, tripDates, tripState } from "../data";
import { useTrips } from "../store";
import { ui } from "../theme";
export default function Chapters() {
  const router = useRouter();
  const { trips } = useTrips();
  return (
    <Page>
      <Label>YOUR TRAVEL JOURNAL</Label>
      <H>Chapters</H>
      <P>다음 장면을 준비하고, 지난 여행을 간직해요.</P>
      {trips.map((t, i) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t.name} 여행 열기`}
          key={t.id}
          onPress={() =>
            router.push({
              pathname: "/trip/[tripId]",
              params: { tripId: t.id },
            })
          }
          style={({ pressed }) => ({
            flexDirection: "row",
            backgroundColor: ui.surface,
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 12,
            opacity: pressed ? 0.7 : 1,
            borderWidth: 1,
            borderColor: ui.line,
          })}
        >
          <Image
            source={{ uri: cover(t.city) }}
            style={{ width: 112, height: 142, backgroundColor: ui.line }}
          />
          <View style={{ flex: 1, padding: 15, justifyContent: "center" }}>
            <Label>
              CHAPTER {String(i + 1).padStart(2, "0")} · {tripState(t)}
            </Label>
            <Text style={s.title}>{t.name} ↗</Text>
            <Text style={{ color: ui.muted, fontSize: 12, marginTop: 10 }}>
              {tripDates(t)}
            </Text>
            <Text style={{ color: ui.muted, fontSize: 12, marginTop: 6 }}>
              {t.days.reduce((n, d) => n + d.items.length, 0)}개의 일정 · 후보{" "}
              {t.candidates.length}
            </Text>
          </View>
        </Pressable>
      ))}
      <Action
        title="＋ 새로운 여행"
        secondary
        onPress={() => router.push("/new-trip")}
      />
    </Page>
  );
}
