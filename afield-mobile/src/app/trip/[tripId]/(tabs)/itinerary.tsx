import { inspirationProgress } from "../../../../inspirationProgress";
import { ActivityButton } from "../../../../activityUI";
import { entryActivity } from "../../../../activities";
import {
  journeyStop,
  missingPlacePrompt,
  isMaraisWalk,
} from "../../../../journey";
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
  navigationUrl,
  directionsUrl,
  legKey,
  modeLabels,
  travelModes,
} from "../../../../routing";
import { ui } from "../../../../theme";
export default function Itinerary() {
  const { tripId, date, updatedEntry, addedPlace, planApplied } =
    useTripParams();
  const { trips, setMode, setTag } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const { pendingPosts } = inspirationProgress(trip);
  const [selection, setSelection] = useState(date || "");
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
    if (date) setSelection(date);
    setError("");
  }, [date, tripId]);
  const day = trip?.days.find((d) => d.date === selection) || trip?.days[0];
  const updatedIndex = day?.items.findIndex((e) => e.id === updatedEntry) ?? -1;
  const updatedWalk =
    trip && day && updatedIndex > 0
      ? journeyStop(trip, day, updatedIndex - 1).suggestion
      : undefined;
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
      <Action
        title="AI로 빈 시간 계획하기"
        secondary
        onPress={() =>
          router.push({ pathname: "/trip/[tripId]/plan", params: { tripId } })
        }
      />
      {!!pendingPosts.length && (
        <Action
          title={`남은 게시물 ${pendingPosts.length}개 계속 보기 →`}
          secondary
          onPress={() =>
            router.navigate({
              pathname: "/trip/[tripId]/candidates",
              params: { tripId, section: "inspiration", postFilter: "pending" },
            })
          }
        />
      )}
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
          {!!planApplied && /^\d+$/.test(planApplied) && (
            <Text
              accessibilityRole="alert"
              style={{
                fontSize: 16,
                lineHeight: 24,
                color: ui.accent,
                marginBottom: 12,
              }}
            >
              AI 제안 {planApplied}곳과 식사·고정 일정을 추가했어요.
            </Text>
          )}
          <Text style={s.title}>{dateLabel(day.date)}</Text>
          <P>
            {day.items.length}개의 일정 · 경로 찾기는 현재 위치에서 출발해요.
          </P>
          {!!addedPlace && day.items.some((e) => e.placeId === addedPlace) && (
            <Text
              accessibilityRole="alert"
              style={{
                fontSize: 16,
                lineHeight: 24,
                color: ui.accent,
                marginBottom: 12,
              }}
            >
              선택한 장소를 이 날짜의 일정에 추가했어요.
            </Text>
          )}
          {!!updatedEntry && day.items.some((e) => e.id === updatedEntry) && (
            <View
              accessibilityRole="alert"
              style={{
                padding: 14,
                backgroundColor: "#E7EBE2",
                borderRadius: 12,
                marginBottom: 12,
              }}
            >
              <Text style={{ color: ui.accent, fontSize: 15, lineHeight: 23 }}>
                {updatedWalk?.linkedEntryId === updatedEntry
                  ? `방문할 장소를 연결했어요. 앞 산책은 ${updatedWalk.location.label}에서 시작하도록 추천했어요.`
                  : "방문할 장소를 연결했어요. 이제 경로 찾기로 이동할 수 있어요."}
              </Text>
            </View>
          )}
          {day.items.map((item, index) => {
            const stop = journeyStop(trip!, day, index);
            const location = stop.location;
            const next = day.items[index + 1];
            const storedMode =
              next && day.travelModes?.[legKey(item.id, next.id)];
            const mode =
              storedMode && travelModes.includes(storedMode)
                ? storedMode
                : "walking";
            const nextStop = next
              ? journeyStop(trip!, day, index + 1)
              : undefined;
            const sameStart =
              !!nextStop?.suggestion &&
              nextStop.suggestion.basis === "previous" &&
              nextStop.suggestion.linkedEntryId === item.id;
            const route =
              nextStop &&
              !sameStart &&
              directionsUrl(stop.entry, nextStop.entry, mode);
            return (
              <View key={item.id}>
                <View style={styles.entry}>
                  <Text style={styles.time}>{item.time}</Text>
                  <View style={styles.content}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Pressable
                        style={{
                          flex: 1,
                          minWidth: 0,
                          minHeight: 44,
                          justifyContent: "center",
                        }}
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
                      <ActivityButton
                        name={item.name}
                        value={entryActivity(item, trip)}
                        customValue={item.customTag}
                        onChange={(tag, customTag) => {
                          const result = setTag(
                            tripId,
                            day.date,
                            item.id,
                            tag,
                            customTag,
                          );
                          if (!result.ok) setError(result.message);
                        }}
                      />
                    </View>
                    <Text style={styles.description}>
                      {entryDescription(stop.suggestion ? stop.entry : item)}
                    </Text>
                    {location && (
                      <Text style={styles.location} numberOfLines={1}>
                        {stop.suggestion ? "추천 시작점 · " : ""}
                        {location.label}
                      </Text>
                    )}
                    {stop.suggestion && (
                      <Text
                        style={{
                          fontSize: 13,
                          lineHeight: 20,
                          color: ui.muted,
                          marginTop: 6,
                        }}
                      >
                        {stop.suggestion.reason}
                      </Text>
                    )}
                    {!location && (
                      <Text style={styles.description}>
                        {item.origin === "ai"
                          ? "식사·휴식 시간을 비워 둔 자리예요. 원하면 장소를 연결할 수 있어요."
                          : "방문할 곳 미정 · 활동 이름만 정해 둔 상태예요. 실제 장소를 고르면 길을 찾을 수 있어요."}
                      </Text>
                    )}
                    <View style={styles.actions}>
                      {item.must && <Text style={styles.must}>MUST</Text>}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${item.name} ${location ? "현재 위치에서 경로 찾기" : "방문할 곳 선택"}`}
                        onPress={() =>
                          location
                            ? open(
                                navigationUrl(
                                  location,
                                  trip?.planning?.mode || "walking",
                                ),
                              )
                            : editLocation(item)
                        }
                        hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                        style={styles.smallButton}
                      >
                        <Text style={styles.link}>
                          {location
                            ? "경로 찾기 ↗"
                            : /서점/.test(item.name)
                              ? "서점 고르기 ＋"
                              : "방문할 곳 고르기 ＋"}
                        </Text>
                      </Pressable>
                      {location && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${item.name} 연결 장소 변경`}
                          onPress={() => editLocation(item)}
                          hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                          style={styles.smallButton}
                        >
                          <Text style={styles.mutedLink}>
                            {isMaraisWalk(item, trip!)
                              ? "시작점 바꾸기"
                              : "장소 변경"}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
                {next && (
                  <View style={styles.leg}>
                    <Text style={styles.legTitle}>
                      {item.name} → {next.name}
                    </Text>
                    {sameStart ? (
                      <Text style={styles.duration}>
                        관람을 마친 곳에서 바로 산책을 이어가요. 별도 이동 없이
                        시작할 수 있어요.
                      </Text>
                    ) : (
                      <>
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
                              hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                              style={styles.routeButton}
                            >
                              <Text style={styles.link}>
                                이 구간 경로 찾기 ↗
                              </Text>
                            </Pressable>
                          </View>
                        ) : (
                          <View>
                            {!location && (
                              <>
                                <Text style={styles.duration}>
                                  {missingPlacePrompt(item, trip!)}
                                </Text>
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel={`${item.name} 방문할 곳 선택`}
                                  onPress={() => editLocation(item)}
                                  hitSlop={{
                                    top: 4,
                                    bottom: 4,
                                    left: 2,
                                    right: 2,
                                  }}
                                  style={styles.routeButton}
                                >
                                  <Text style={styles.link}>
                                    {item.name} · 장소 선택 →
                                  </Text>
                                </Pressable>
                              </>
                            )}
                            {!nextStop?.location && (
                              <>
                                <Text style={styles.duration}>
                                  {missingPlacePrompt(next, trip!)}
                                </Text>
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel={`${next.name} 방문할 곳 선택`}
                                  onPress={() => editLocation(next)}
                                  hitSlop={{
                                    top: 4,
                                    bottom: 4,
                                    left: 2,
                                    right: 2,
                                  }}
                                  style={styles.routeButton}
                                >
                                  <Text style={styles.link}>
                                    {next.name} · 장소 선택 →
                                  </Text>
                                </Pressable>
                              </>
                            )}
                          </View>
                        )}
                      </>
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
          title={day ? "이 날짜에 갈 장소 찾기" : "예시 장소 둘러보기"}
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
  title: { fontSize: 20, fontWeight: "700", color: ui.ink },
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
  smallButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 11,
    backgroundColor: "#E7EBE2",
    borderWidth: 1,
    borderColor: "#CFD8C8",
    borderRadius: 18,
  },
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
  routeButton: {
    minHeight: 36,
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 11,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#B8C6B4",
    borderRadius: 18,
    backgroundColor: "#E2E8DB",
  },
});
