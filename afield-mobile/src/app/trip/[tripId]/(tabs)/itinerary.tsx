import { RouteTime } from "../../../../routeTimeUI";
import { dayBase, planningModes } from "../../../../planner";
import { editHaptic } from "../../../../haptics";
import { placeText } from "../../../../placeText";
import { Ionicons } from "@expo/vector-icons";
import { routeMode } from "../../../../planner";
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
  useWindowDimensions,
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
  const { tripId, date, updatedEntry, addedPlace, planApplied, manualEdited } =
    useTripParams();
  const { trips, setMode, setTag, undoManualEdit, canUndoManualEdit } =
    useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const { pendingPosts } = inspirationProgress(trip);
  const [selection, setSelection] = useState(date || "");
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(
    new Set(),
  );
  const [editNotice, setEditNotice] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { width } = useWindowDimensions();
  const dateWidth = Math.max(
    52,
    (width - 40) / Math.min(trip?.days.length || 1, 7),
  );
  useEffect(() => {
    if (date) setSelection(date);
    setError("");
  }, [date, tripId]);
  const day = trip?.days.find((d) => d.date === selection) || trip?.days[0];
  const base =
    trip?.planning && day ? dayBase(trip, trip.planning, day.date) : undefined;
  const locatedStops =
    trip && day
      ? day.items
          .map((_, i) => journeyStop(trip, day, i))
          .filter((stop) => !!stop.location)
      : [];
  const firstStop = locatedStops[0]?.location;
  const lastStop = locatedStops[locatedStops.length - 1]?.location;
  const updatedIndex = day?.items.findIndex((e) => e.id === updatedEntry) ?? -1;
  const updatedWalk =
    trip && day && updatedIndex > 0
      ? journeyStop(trip, day, updatedIndex - 1).suggestion
      : undefined;
  const manualEdit = (entryId?: string) => {
    editHaptic();
    router.push({
      pathname: "/trip/[tripId]/edit-itinerary",
      params: { tripId, date: day?.date, ...(entryId ? { entryId } : {}) },
    });
  };
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
    <Page stickyHeaderIndices={[1]}>
      <View style={{ paddingBottom: 12 }}>
        <Label>
          {trip?.city} · {trip?.days.length || 0}일의 여행
        </Label>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <H>일정</H>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="일정 수동 편집"
              onPress={() => manualEdit()}
              style={{
                minHeight: 44,
                paddingHorizontal: 8,
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: ui.blue }}>
                편집
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="여행 조건 입력 · AI 일정 짜기"
              onPress={() =>
                router.push({
                  pathname: "/trip/[tripId]/plan",
                  params: { tripId },
                })
              }
              style={{
                flexDirection: "row",
                gap: 8,
                minHeight: 44,
                alignItems: "center",
                paddingHorizontal: 8,
              }}
            >
              <Ionicons name="options-outline" size={18} color={ui.blue} />
              <Text style={{ color: ui.blue, fontSize: 15, fontWeight: "600" }}>
                AI 계획
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
      <View
        style={{
          backgroundColor: ui.bg,
          paddingTop: 8,
          borderBottomWidth: 1,
          borderColor: ui.line,
          marginBottom: 20,
        }}
      >
        <FlatList
          data={trip?.days || []}
          keyExtractor={(d) => d.date}
          extraData={day?.date}
          horizontal
          style={{ flexGrow: 0, flexShrink: 0, height: 78, marginTop: 0 }}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 0, paddingBottom: 10 }}
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
                  backgroundColor:
                    day?.date === d.date ? ui.ink : "transparent",
                  alignItems: "center",
                  width: dateWidth,
                  paddingHorizontal: 6,
                  paddingVertical: 8,
                  borderRadius: 8,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: day?.date === d.date ? "white" : ui.muted,
                }}
              >
                {
                  ["일", "월", "화", "수", "목", "금", "토"][
                    new Date(d.date + "T12:00:00").getDay()
                  ]
                }
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
      </View>
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={{ color: "#A23C2B", marginBottom: 12 }}
        >
          {error}
        </Text>
      )}
      {manualEdited === "1" && (
        <View
          style={{
            padding: 12,
            backgroundColor: ui.subtle,
            marginBottom: 16,
            borderRadius: 8,
          }}
        >
          <Text style={{ fontSize: 14, color: ui.ink }}>
            {editNotice || "수동 편집을 저장했어요."}
          </Text>
          {canUndoManualEdit(tripId) && (
            <Action
              title="방금 편집 되돌리기"
              tone="link"
              onPress={() => {
                const r = undoManualEdit(tripId);
                if (r.ok) setEditNotice(r.message);
                else setError(r.message);
              }}
            />
          )}
        </View>
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
                backgroundColor: "#F1F1F1",
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
          {base?.origin && firstStop && (
            <View
              style={{
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderColor: ui.line,
                marginBottom: 12,
              }}
            >
              <Text style={styles.legTitle}>{base.origin.name} → 첫 장소</Text>
              <RouteTime
                key={base.origin.query + firstStop.query}
                from={base.origin.query}
                to={firstStop.query}
                mode={
                  day.travelModes?.[
                    legKey("origin", locatedStops[0].entry.id)
                  ] ||
                  (locatedStops[0]?.entry.needsTransitCheck
                    ? "transit"
                    : planningModes(trip?.planning)[0])
                }
                pendingTransit={!!locatedStops[0]?.entry.needsTransitCheck}
              />
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
            const laterLocated =
              trip && next && !nextStop?.location
                ? day.items
                    .slice(index + 2)
                    .map((_, i) => journeyStop(trip, day, index + 2 + i))
                    .find((s) => !!s.location)
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
                        accessibilityLabel={`${placeText(item.name)} 장소 ${location?.placeId ? "상세" : "지정"}`}
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
                        <Text style={styles.title}>{placeText(item.name)}</Text>
                      </Pressable>
                      <ActivityButton
                        name={placeText(item.name)}
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
                    {item.needsTransitCheck && (
                      <Text
                        style={{
                          fontSize: 13,
                          lineHeight: 20,
                          color: ui.blue,
                          marginBottom: 4,
                        }}
                      >
                        대중교통 시간 확인 필요 · 임시 배치
                      </Text>
                    )}
                    <Text style={styles.description} numberOfLines={2}>
                      {entryDescription(stop.suggestion ? stop.entry : item)}
                    </Text>
                    {location && (
                      <Text style={styles.location} numberOfLines={1}>
                        {stop.suggestion ? "추천 시작점 · " : ""}
                        {location.label}
                      </Text>
                    )}
                    {stop.suggestion && (
                      <>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${placeText(item.name)} 시작점 추천 이유`}
                          accessibilityState={{
                            expanded: expandedReasons.has(item.id),
                          }}
                          onPress={() =>
                            setExpandedReasons((old) => {
                              const next = new Set(old);
                              next.has(item.id)
                                ? next.delete(item.id)
                                : next.add(item.id);
                              return next;
                            })
                          }
                          style={{ minHeight: 44, justifyContent: "center" }}
                        >
                          <Text style={{ fontSize: 13, color: ui.blue }}>
                            시작점 추천 이유{" "}
                            {expandedReasons.has(item.id) ? "−" : "＋"}
                          </Text>
                        </Pressable>
                        {expandedReasons.has(item.id) && (
                          <Text
                            style={{
                              fontSize: 13,
                              lineHeight: 20,
                              color: ui.muted,
                              marginBottom: 8,
                            }}
                          >
                            {stop.suggestion.reason}
                          </Text>
                        )}
                      </>
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
                        accessibilityLabel={`${placeText(item.name)} ${location ? "현재 위치에서 경로 찾기" : "방문할 곳 선택"}`}
                        onPress={() =>
                          location
                            ? open(
                                navigationUrl(
                                  location,
                                  routeMode(trip?.planning),
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
                          accessibilityLabel={`${placeText(item.name)} 연결 장소 변경`}
                          onPress={() => editLocation(item)}
                          hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                          style={styles.textButton}
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
                {location && laterLocated?.location && (
                  <View style={styles.leg}>
                    <Text style={styles.legTitle}>
                      다음 주소가 정해진 장소 ·{" "}
                      {placeText(laterLocated.entry.name)}
                    </Text>
                    <RouteTime
                      key={location.query + laterLocated.location.query}
                      from={location.query}
                      to={laterLocated.location.query}
                      mode={
                        day.travelModes?.[
                          legKey(item.id, laterLocated.entry.id)
                        ] ||
                        (item.needsTransitCheck
                          ? "transit"
                          : planningModes(trip?.planning)[0])
                      }
                      pendingTransit={!!item.needsTransitCheck}
                    />
                    <Text
                      style={{ fontSize: 12, lineHeight: 18, color: ui.muted }}
                    >
                      사이의 식사·휴식 장소가 정해지면 동선이 달라질 수 있어요.
                    </Text>
                  </View>
                )}
                {next && (
                  <View style={styles.leg}>
                    <Text style={styles.legTitle}>다음 장소까지</Text>
                    {sameStart ? (
                      <Text style={styles.duration}>
                        관람을 마친 곳에서 바로 산책을 이어가요. 별도 이동 없이
                        시작할 수 있어요.
                      </Text>
                    ) : (
                      <>
                        <View
                          accessibilityLabel={`${placeText(item.name)}에서 ${next.name}까지 이동수단`}
                          style={styles.modes}
                        >
                          {travelModes.map((option) => (
                            <Pressable
                              key={option}
                              accessibilityRole="button"
                              accessibilityLabel={`${placeText(item.name)}에서 ${next.name}까지 ${modeLabels[option]}`}
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
                            <RouteTime
                              key={JSON.stringify([
                                location?.query,
                                nextStop?.location?.query,
                                mode,
                              ])}
                              from={location!.query}
                              to={nextStop!.location!.query}
                              mode={mode}
                              pendingTransit={
                                !!item.needsTransitCheck && mode === "transit"
                              }
                            />
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`${placeText(item.name)}에서 ${next.name}까지 ${modeLabels[mode]} 경로 찾기`}
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
                                  accessibilityLabel={`${placeText(item.name)} 방문할 곳 선택`}
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
                                    {placeText(item.name)} · 장소 선택 →
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
          {base?.destination && lastStop && (
            <View
              style={{
                paddingVertical: 12,
                borderTopWidth: 1,
                borderColor: ui.line,
                marginTop: 12,
              }}
            >
              <Text style={styles.legTitle}>
                마지막 장소 → {base.destination.name}
              </Text>
              <RouteTime
                key={lastStop.query + base.destination.query}
                from={lastStop.query}
                to={base.destination.query}
                mode={
                  day.travelModes?.[
                    legKey(
                      locatedStops[locatedStops.length - 1].entry.id,
                      "destination",
                    )
                  ] ||
                  (locatedStops[locatedStops.length - 1]?.entry
                    .needsTransitCheck
                    ? "transit"
                    : planningModes(trip?.planning)[0])
                }
                pendingTransit={
                  !!locatedStops[locatedStops.length - 1]?.entry
                    .needsTransitCheck
                }
              />
            </View>
          )}
          {!day.items.length && (
            <P>
              아직 정해둔 일정이 없어요. 장소를 직접 추가하거나 AI로 계획해
              보세요.
            </P>
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
      {!!pendingPosts.length && (
        <Action
          title={`남은 게시물 ${pendingPosts.length}개 계속 보기 →`}
          tone="link"
          onPress={() =>
            router.navigate({
              pathname: "/trip/[tripId]/candidates",
              params: {
                tripId,
                section: "inspiration",
                postFilter: "pending",
                returnTo: "itinerary",
                date: day?.date,
              },
            })
          }
        />
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
  entry: { flexDirection: "row", gap: 12, paddingTop: 12, paddingBottom: 12 },
  time: {
    width: 44,
    color: ui.accent,
    fontSize: 14,
    fontWeight: "600",
    paddingTop: 13,
    fontVariant: ["tabular-nums"],
  },
  content: {
    flex: 1,
    minWidth: 0,
    borderLeftWidth: 1,
    borderColor: ui.line,
    paddingLeft: 14,
  },
  title: { fontSize: 18, fontWeight: "700", color: ui.ink },
  description: { fontSize: 14, color: ui.muted, lineHeight: 20, marginTop: 3 },
  location: { fontSize: 13, color: ui.accent, marginTop: 5 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  must: {
    fontSize: 12,
    fontWeight: "700",
    color: ui.accent,
    backgroundColor: "#F1F1F1",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 5,
  },
  smallButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 11,
    backgroundColor: ui.surface,
    borderWidth: 1,
    borderColor: ui.line,
    borderRadius: 8,
  },
  textButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
  link: { fontSize: 14, fontWeight: "600", color: ui.blue },
  mutedLink: { fontSize: 13, color: ui.muted },
  leg: {
    marginLeft: 56,
    borderLeftWidth: 1,
    borderColor: ui.line,
    paddingLeft: 14,
    paddingVertical: 8,
    backgroundColor: "transparent",
    paddingRight: 12,
  },
  legTitle: { fontSize: 13, color: ui.muted, marginBottom: 8 },
  modes: { flexDirection: "row", gap: 2, flexWrap: "wrap" },
  mode: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: 9,
  },
  duration: { fontSize: 12, lineHeight: 18, color: ui.muted, marginTop: 6 },
  routeButton: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 11,
    marginTop: 8,
    borderWidth: 1,
    borderColor: ui.line,
    borderRadius: 8,
    backgroundColor: "#F1F1F1",
  },
});
