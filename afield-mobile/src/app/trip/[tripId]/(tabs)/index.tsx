import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, Pressable } from "react-native";
import { Page, H, P, Card, Action, Label, Photo, s } from "../../../../ui";
import { cover, tripDates, tripState, dateLabel } from "../../../../data";
import { useTrips } from "../../../../store";
export default function Home() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const router = useRouter();
  const { trips } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  if (!trip)
    return (
      <Page>
        <H>여행을 찾을 수 없어요</H>
        <Action title="여행 목록" onPress={() => router.replace("/chapters")} />
      </Page>
    );
  const state = tripState(trip);
  const count = trip.days.reduce((n, d) => n + d.items.length, 0);
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const next =
    trip.days.find((d) => d.date >= localDate && d.items.length) ||
    trip.days.find((d) => d.items.length);
  const go = (screen: "itinerary" | "recommend" | "journal") =>
    router.push({ pathname: `/trip/[tripId]/${screen}`, params: { tripId } });
  return (
    <Page>
      <Label>
        {state} · {trip.city}
      </Label>
      <H>{trip.name}</H>
      <P>{tripDates(trip)}</P>
      <Photo uri={cover(trip.city)} height={172} />
      <Card>
        <Label>YOUR NEXT STEP</Label>
        <Text style={s.title}>
          {state === "다녀온 여행"
            ? "여행의 여운을 기록해요"
            : count
              ? state === "여행 중"
                ? "오늘의 여행을 펼쳐요"
                : "다가올 장면을 살펴봐요"
              : "첫 번째 장소를 찾아봐요"}
        </Text>
        <P>
          {state === "다녀온 여행"
            ? "다녀온 장소와 기억을 돌아볼 시간이에요."
            : next
              ? `${dateLabel(next.date)} · ${next.items[0].time} ${next.items[0].name}`
              : "마음에 드는 장소를 후보에 담고, 원하는 날짜에 직접 배치해요."}
        </P>
        <Action
          title={
            state === "다녀온 여행"
              ? "기록 열기"
              : count
                ? "일정 펼치기"
                : "장소 발견하기"
          }
          onPress={() =>
            go(
              state === "다녀온 여행"
                ? "journal"
                : count
                  ? "itinerary"
                  : "recommend",
            )
          }
        />
      </Card>
      {(count > 0 || state === "다녀온 여행") && (
        <Pressable
          accessibilityRole="button"
          onPress={() => go("recommend")}
          style={{ paddingVertical: 16 }}
        >
          <Text style={s.title}>이번 여행의 발견 ↗</Text>
          <P>{trip.city}에서 취향에 맞는 장면을 찾아요.</P>
        </Pressable>
      )}
      <Label>
        {count}개의 일정 · {trip.candidates.length}개의 후보
      </Label>
    </Page>
  );
}
