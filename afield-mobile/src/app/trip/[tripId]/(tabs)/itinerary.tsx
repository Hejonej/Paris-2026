import React, { useEffect, useState } from "react";
import {
  Text,
  View,
  Pressable,
  FlatList,
  Linking,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { Page, H, P, Action, Label, s } from "../../../../ui";
import { dateLabel } from "../../../../data";
import type { Entry } from "../../../../data";
import { useTrips } from "../../../../store";
import { useTripParams } from "../../../../route";
import {
  entryLocation,
  entryDescription,
  locationUrl,
  directionsUrl,
  legKey,
  modeLabels,
  travelModes,
} from "../../../../routing";
import { ui } from "../../../../theme";
export default function Itinerary() {
  const { tripId, date } = useTripParams();
  const { trips, setMode } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const [selection, setSelection] = useState(date || "");
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
    if (date) setSelection(date);
    setError("");
  }, [date, tripId]);
  const day = trip?.days.find((d) => d.date === selection) || trip?.days[0];
  const editLocation = (item: Entry) =>
    router.push({
      pathname: "/trip/[tripId]/entry/[entryId]",
      params: { tripId, date: day!.date, entryId: item.id },
    });
  const open = (url: string) =>
    Linking.openURL(url).catch(() =>
      setError("지도를 열지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요."),
    );
  return (
    <Page>
      <Label>하루의 동선</Label>
      <H>일정</H>
      <FlatList
        data={trip?.days || []}
        keyExtractor={(d) => d.date}
        extraData={day?.date}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingBottom: 18 }}
        renderItem={({ item: d, index: i }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: day?.date === d.date }}
            accessibilityLabel={dateLabel(d.date)}
            key={d.date}
            onPress={() => {
              setSelection(d.date);
              setError("");
            }}
            style={[
              s.chip,
              {
                backgroundColor: day?.date === d.date ? ui.accent : ui.line,
                alignItems: "center",
                width: 64,
              },
            ]}
          >
            <Text
              style={{
                fontSize: 13,
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
        )}
      />
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={{ color: "#A23C2B", marginBottom: 12 }}
        >
          {error}
        </Text>
      )}
      {day ? (
        <>
          <Text style={s.title}>{dateLabel(day.date)}</Text>
          <P>{day.items.length}개의 일정 · 장소 사이의 이동까지</P>
          {day.items.map((item, index) => {
            const location = entryLocation(item);
            const next = day.items[index + 1];
            const storedMode =
              next && day.travelModes?.[legKey(item.id, next.id)];
            const mode =
              storedMode && travelModes.includes(storedMode)
                ? storedMode
                : "walking";
            const route = next && directionsUrl(item, next, mode);
            return (
              <View key={item.id}>
                <View style={styles.entry}>
                  <Text style={styles.time}>{item.time}</Text>
                  <View style={styles.content}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${item.name} 장소 ${location?.placeId ? "상세" : "지정"}`}
                      onPress={() =>
                        location?.placeId
                          ? router.push({
                              pathname: "/trip/[tripId]/place/[placeId]",
                              params: {
                                tripId,
                                placeId: location.placeId,
                                date: day.date,
                              },
                            })
                          : editLocation(item)
                      }
                    >
                      <Text style={styles.title}>{item.name} ›</Text>
                    </Pressable>
                    <Text style={styles.description} numberOfLines={2}>
                      {entryDescription(item)}
                    </Text>
                    {location && (
                      <Text style={styles.location} numberOfLines={1}>
                        {location.label}
                      </Text>
                    )}
                    <View style={styles.actions}>
                      {item.must && <Text style={styles.must}>MUST</Text>}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${item.name} ${location ? "위치 보기" : "장소 지정"}`}
                        onPress={() =>
                          location
                            ? open(locationUrl(location))
                            : editLocation(item)
                        }
                        style={styles.smallButton}
                      >
                        <Text style={styles.link}>
                          {location ? "위치 보기 ↗" : "장소 지정 ＋"}
                        </Text>
                      </Pressable>
                      {location && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${item.name} 연결 장소 변경`}
                          onPress={() => editLocation(item)}
                          style={styles.smallButton}
                        >
                          <Text style={styles.mutedLink}>장소 변경</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
                {next && (
                  <View style={styles.leg}>
                    <Text style={styles.legTitle}>↓ {next.name}까지</Text>
                    <View
                      accessibilityLabel={`${item.name}에서 ${next.name}까지 이동수단`}
                      style={styles.modes}
                    >
                      {travelModes.map((option) => (
                        <Pressable
                          key={option}
                          accessibilityRole="button"
                          accessibilityLabel={`${item.name}에서 ${next.name}까지 ${modeLabels[option]}`}
                          accessibilityState={{ selected: option === mode }}
                          onPress={() => {
                            const result = setMode(
                              tripId,
                              day.date,
                              item.id,
                              next.id,
                              option,
                            );
                            if (!result.ok) setError(result.message);
                          }}
                          style={[
                            styles.mode,
                            {
                              backgroundColor:
                                option === mode ? ui.accent : "transparent",
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color: option === mode ? "white" : ui.muted,
                              fontSize: 14,
                              fontWeight: "600",
                            }}
                          >
                            {modeLabels[option]}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    {route ? (
                      <View>
                        <Text style={styles.duration}>
                          소요 시간은 Google Maps에서 확인
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${item.name}에서 ${next.name}까지 ${modeLabels[mode]} 경로 찾기`}
                          onPress={() => open(route)}
                          style={styles.routeButton}
                        >
                          <Text style={styles.link}>경로 찾기 ↗</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View>
                        <Text style={styles.duration}>
                          출발지와 도착 장소를 지정해 주세요.
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => editLocation(location ? next : item)}
                          style={styles.routeButton}
                        >
                          <Text style={styles.link}>장소 지정하기 →</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
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
      <View style={{ marginTop: 20 }}>
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
const styles = StyleSheet.create({
  entry: { flexDirection: "row", gap: 12, paddingVertical: 16 },
  time: {
    width: 46,
    color: ui.accent,
    fontSize: 14,
    fontWeight: "600",
    paddingTop: 3,
  },
  content: { flex: 1 },
  title: { fontSize: 17, fontWeight: "700", color: ui.ink },
  description: { fontSize: 14, color: ui.muted, lineHeight: 21, marginTop: 6 },
  location: { fontSize: 13, color: ui.accent, marginTop: 5 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  must: {
    fontSize: 12,
    fontWeight: "700",
    color: ui.accent,
    backgroundColor: "#E7EBE2",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 5,
  },
  smallButton: { minHeight: 44, justifyContent: "center" },
  link: { fontSize: 14, fontWeight: "600", color: ui.accent },
  mutedLink: { fontSize: 13, color: ui.muted },
  leg: {
    marginLeft: 58,
    borderLeftWidth: 2,
    borderColor: "#CFD8C8",
    paddingLeft: 14,
    paddingVertical: 12,
    backgroundColor: "#EEF0E8",
    paddingRight: 12,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  legTitle: { fontSize: 13, color: ui.muted, marginBottom: 8 },
  modes: { flexDirection: "row", gap: 2, flexWrap: "wrap" },
  mode: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: 9,
  },
  duration: { fontSize: 13, lineHeight: 20, color: ui.muted, marginTop: 10 },
  routeButton: { minHeight: 44, justifyContent: "center" },
});
