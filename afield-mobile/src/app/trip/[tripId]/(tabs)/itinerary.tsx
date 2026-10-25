import React, { useEffect, useState } from "react";
import { Text, View, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Page, H, P, Action, Label, s } from "../../../../ui";
import { dateLabel } from "../../../../data";
import { useTrips } from "../../../../store";
import { ui } from "../../../../theme";
export default function Itinerary() {
  const { tripId, date } = useLocalSearchParams<{
    tripId: string;
    date?: string;
  }>();
  const { trips } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const [selection, setSelection] = useState(date || "");
  useEffect(() => {
    if (date) setSelection(date);
  }, [date, tripId]);
  const router = useRouter();
  const day = trip?.days.find((d) => d.date === selection) || trip?.days[0];
  return (
    <Page>
      <Label>하루의 동선</Label>
      <H>일정</H>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingBottom: 20 }}
      >
        {trip?.days.map((d, i) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: day?.date === d.date }}
            accessibilityLabel={dateLabel(d.date)}
            key={d.date}
            onPress={() => setSelection(d.date)}
            style={[
              s.chip,
              {
                backgroundColor: day?.date === d.date ? ui.accent : ui.line,
                alignItems: "center",
                minWidth: 58,
              },
            ]}
          >
            <Text
              style={{
                fontSize: 11,
                color: day?.date === d.date ? "white" : ui.muted,
              }}
            >
              DAY {i + 1}
            </Text>
            <Text
              style={{
                fontSize: 19,
                fontWeight: "700",
                color: day?.date === d.date ? "white" : ui.ink,
                marginTop: 4,
              }}
            >
              {d.date.slice(8)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {day ? (
        <>
          <Text style={s.title}>{dateLabel(day.date)}</Text>
          <P>{day.items.length}개의 일정 · 나만의 속도로</P>
          {day.items.map((item) => (
            <Pressable
              key={item.id}
              disabled={!item.placeId}
              accessibilityRole={item.placeId ? "button" : undefined}
              onPress={() =>
                router.push({
                  pathname: "/trip/[tripId]/place/[placeId]",
                  params: { tripId, placeId: item.placeId! },
                })
              }
              style={{ flexDirection: "row", gap: 12, minHeight: 80 }}
            >
              <Text
                style={{
                  width: 47,
                  color: ui.muted,
                  fontSize: 13,
                  paddingTop: 18,
                }}
              >
                {item.time}
              </Text>
              <View style={{ width: 12, alignItems: "center" }}>
                <View
                  style={{
                    width: 1,
                    backgroundColor: ui.line,
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                  }}
                />
                <View
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 5,
                    backgroundColor: ui.accent,
                    marginTop: 22,
                  }}
                />
              </View>
              <View
                style={{
                  flex: 1,
                  borderBottomWidth: 1,
                  borderColor: ui.line,
                  paddingVertical: 16,
                }}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "600", color: ui.ink }}
                >
                  {item.name}
                  {item.placeId ? "  ›" : ""}
                </Text>
                <Text style={{ color: ui.muted, fontSize: 12, marginTop: 6 }}>
                  {item.must ? "MUST · 지켜둘 일정" : "내 일정"}
                </Text>
              </View>
            </Pressable>
          ))}
          {!day.items.length && (
            <P>아직 정해둔 일정이 없어요. 여백도 여행의 일부예요.</P>
          )}
        </>
      ) : (
        <>
          <P>여행 날짜를 정하면 하루씩 일정을 만들 수 있어요.</P>
          <Action
            title="여행 날짜 정하기"
            onPress={() =>
              router.push({
                pathname: "/trip/[tripId]/edit",
                params: { tripId },
              })
            }
          />
        </>
      )}
      <View style={{ marginTop: 24 }}>
        <Action
          title={day ? "이 날짜에 갈 장소 찾기" : "여행 후보 찾기"}
          secondary
          onPress={() =>
            router.push({
              pathname: "/trip/[tripId]/recommend",
              params: { tripId, ...(day ? { date: day.date } : {}) },
            })
          }
        />
      </View>
    </Page>
  );
}
