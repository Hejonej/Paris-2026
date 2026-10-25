import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, Pressable, View } from "react-native";
import { Page, H, P, Card, Action, Label, Photo, s } from "../../../../ui";
import {
  cover,
  tripDates,
  tripState,
  dateLabel,
  places,
  tripPlaces,
} from "../../../../data";
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
    router.navigate({
      pathname: `/trip/[tripId]/${screen}`,
      params: { tripId },
    });
  return (
    <Page>
      <Label>
        {state} · {trip.city}
      </Label>
      <H>{trip.name}</H>
      <View style={s.row}>
        <P>{tripDates(trip)}</P>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="여행 정보 수정"
          onPress={() =>
            router.push({ pathname: "/trip/[tripId]/edit", params: { tripId } })
          }
          style={{
            minHeight: 44,
            paddingHorizontal: 8,
            justifyContent: "center",
            marginBottom: 8,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#315746" }}>
            정보 수정
          </Text>
        </Pressable>
      </View>
      <Photo uri={cover(trip.city)} height={172} />
      <Card>
        <Label>다음 여정</Label>
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
      {next && (
        <View style={{ marginTop: 8, marginBottom: 16 }}>
          <View style={s.row}>
            <Text style={s.title}>{dateLabel(next.date)}</Text>
            <Text style={{ color: "#73786F", fontSize: 14 }}>
              {next.items.length}개의 일정
            </Text>
          </View>
          {next.items.slice(0, 3).map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/trip/[tripId]/itinerary",
                  params: { tripId, date: next.date },
                })
              }
              style={{
                flexDirection: "row",
                gap: 14,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderColor: "#E1E3D9",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  color: "#315746",
                  fontWeight: "600",
                  width: 44,
                }}
              >
                {item.time}
              </Text>
              <Text style={{ flex: 1, fontSize: 16, color: "#252D28" }}>
                {item.name}
              </Text>
              <Text style={{ color: "#73786F" }}>›</Text>
            </Pressable>
          ))}
        </View>
      )}
      {trip.candidates.length > 0 && (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: "/trip/[tripId]/candidates",
              params: { tripId },
            })
          }
          style={{
            backgroundColor: "#E7EBE2",
            padding: 16,
            borderRadius: 14,
            marginBottom: 12,
          }}
        >
          <Text style={s.title}>저장한 장소 {trip.candidates.length} →</Text>
          <Text
            style={{
              fontSize: 15,
              color: "#315746",
              lineHeight: 23,
              marginTop: 6,
            }}
          >
            {trip.candidates
              .map((id) => tripPlaces(trip).find((p) => p.id === id)?.name)
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </Pressable>
      )}
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
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: "/trip/[tripId]/instagram",
            params: { tripId },
          })
        }
        style={{
          paddingVertical: 16,
          borderTopWidth: 1,
          borderColor: "#E1E3D9",
        }}
      >
        <Text style={s.title}>Instagram에 모아 둔 곳 가져오기 →</Text>
        <P>저장 컬렉션 JSON에서 여행의 영감을 이어가요.</P>
      </Pressable>
      <Label>
        {count}개의 일정 · {trip.candidates.length}개의 후보
      </Label>
    </Page>
  );
}
