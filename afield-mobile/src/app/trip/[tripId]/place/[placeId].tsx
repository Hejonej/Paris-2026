import { useTripParams } from "../../../../route";
import React, { useState } from "react";
import {
  Text,
  View,
  ScrollView,
  Pressable,
  Alert,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { Page, H, P, Label, Photo, Action, Field, s } from "../../../../ui";
import { places, dateLabel } from "../../../../data";
import { useTrips } from "../../../../store";
import { ui } from "../../../../theme";
export default function Place() {
  const { tripId, placeId, date: initialDate } = useTripParams();
  const router = useRouter();
  const { trips, saveCandidate, place } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const info = places.find((p) => p.id === placeId);
  const [date, setDate] = useState(initialDate || "");
  const [time, setTime] = useState("11:00");
  const [message, setMessage] = useState("");
  if (!info || !trip)
    return (
      <Page>
        <H>장소를 찾을 수 없어요</H>
      </Page>
    );
  const selected = trip.days.some((d) => d.date === date)
    ? date
    : trip.days[0]?.date;
  const saved = trip.candidates.includes(placeId);
  function add() {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      setMessage("시간은 09:30처럼 입력해 주세요.");
      return;
    }
    const result = place(tripId, placeId, info!.name, selected || "", time);
    setMessage(result.message);
    if (result.ok)
      Alert.alert("일정에 추가했어요", `${dateLabel(selected!)} ${time}`, [
        { text: "계속 둘러보기" },
        {
          text: "일정 보기",
          onPress: () =>
            router.dismissTo({
              pathname: "/trip/[tripId]/itinerary",
              params: { tripId, date: selected },
            }),
        },
      ]);
  }
  return (
    <Page>
      <Photo uri={info.image} height={190} />
      <Label>
        {info.category} · {info.area}
      </Label>
      <H>{info.name}</H>
      <P>{info.description}</P>
      <P>사진은 분위기 참고용이에요.</P>
      <Action
        title={saved ? "✓ 여행 후보에 저장됨" : "후보에 저장"}
        disabled={saved}
        secondary
        onPress={() => {
          const result = saveCandidate(tripId, placeId);
          setMessage(result.message);
        }}
      />
      {saved && (
        <Action
          title="저장한 후보 보기 →"
          secondary
          onPress={() =>
            router.dismissTo({
              pathname: "/trip/[tripId]/(tabs)/candidates",
              params: { tripId },
            })
          }
        />
      )}
      <Pressable
        accessibilityRole="link"
        style={{ paddingVertical: 18 }}
        onPress={() =>
          Linking.openURL(
            "https://www.google.com/maps/search/?api=1&query=" +
              encodeURIComponent(info.query),
          ).catch(() =>
            setMessage("지도를 열 수 없어요. 잠시 후 다시 시도해 주세요."),
          )
        }
      >
        <Text style={{ color: ui.accent, fontWeight: "600" }}>
          지도에서 위치 확인 ↗
        </Text>
      </Pressable>
      <View style={{ borderTopWidth: 1, borderColor: ui.line, paddingTop: 20 }}>
        <Text style={s.title}>일정에 배치</Text>
        <P>기존 일정과 MUST는 그대로 두고, 선택한 시간에 추가해요.</P>
        {trip.days.length ? (
          <>
            <ScrollView
              horizontal
              contentContainerStyle={{ gap: 8, paddingBottom: 14 }}
            >
              {trip.days.map((d) => (
                <Pressable
                  key={d.date}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selected === d.date }}
                  onPress={() => {
                    setDate(d.date);
                    setMessage("");
                  }}
                  style={[
                    s.chip,
                    {
                      backgroundColor:
                        selected === d.date ? ui.accent : ui.line,
                    },
                  ]}
                >
                  <Text
                    style={{ color: selected === d.date ? "white" : ui.ink }}
                  >
                    {dateLabel(d.date)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Field
              accessibilityLabel="일정 시간"
              value={time}
              onChangeText={setTime}
              placeholder="HH:MM"
              maxLength={5}
              keyboardType="numbers-and-punctuation"
            />
            <Action title="선택한 날짜에 추가" onPress={add} />
          </>
        ) : (
          <>
            <P>여행 날짜를 정하면 이 장소를 일정에 배치할 수 있어요.</P>
            <Action
              title="여행 날짜 정하기"
              secondary
              onPress={() =>
                router.push({
                  pathname: "/trip/[tripId]/edit",
                  params: { tripId },
                })
              }
            />
          </>
        )}
        {!!message && (
          <Text
            accessibilityRole="alert"
            style={{ color: ui.accent, marginTop: 12 }}
          >
            {message}
          </Text>
        )}
      </View>
    </Page>
  );
}
