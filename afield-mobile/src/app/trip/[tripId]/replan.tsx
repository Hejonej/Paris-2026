import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { Page, H, P, Label, Action, s } from "../../../ui";
import { useTripParams } from "../../../route";
import { useTrips } from "../../../store";
import { dayVisits } from "../../../visits";
import { lockReason } from "../../../manualEditing";
import { prepareReplan, type ReplanProposal } from "../../../replanning";
import { planningRoutes } from "../../../liveRoutes";
import { generatePlan } from "../../../aiPlanner";
import { collectPendingTransfers } from "../../../routeChecks";
import { localToday, validateRows } from "../../../planner";
import { dateLabel } from "../../../data";
import { placeText } from "../../../placeText";
import { ui } from "../../../theme";
export default function Replan() {
  const { tripId, date } = useTripParams(),
    store = useTrips(),
    router = useRouter();
  const trip = store.trips.find((t) => t.id === tripId),
    day = trip?.days.find((d) => d.date === date);
  const remaining = trip && day ? dayVisits(trip, day).remaining : [];
  const eligible = remaining.filter((e) => !lockReason(trip!, date, e));
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [proposal, setProposal] = useState<ReplanProposal | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [consent, setConsent] = useState(false);
  const controller = useRef<AbortController | null>(null),
    running = useRef(false),
    applying = useRef(false);
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );
  const future =
    trip?.days.filter((d) => d.date > date && d.date > localToday()) || [];
  async function generate() {
    if (!trip || running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    controller.current = new AbortController();
    try {
      const work = prepareReplan(trip, date, [...ids]);
      const routes = await planningRoutes(work.trip, controller.current.signal);
      const draft = await generatePlan(
        work.trip,
        controller.current.signal,
        fetch,
        routes,
      );
      if (controller.current.signal.aborted) return;
      setProposal({ ...work, draft });
      setSelected(new Set(draft.rows.map((r) => r.id)));
      setConsent(false);
    } catch (e) {
      if (!controller.current?.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : String(
                (e as Error)?.message ||
                  "제안을 만들지 못했어요. 원래 일정은 그대로예요.",
              ),
        );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  const chosen = proposal?.draft.rows.filter((r) => selected.has(r.id)) || [];
  const legs =
    proposal?.draft.routeContext && proposal.trip.planning
      ? collectPendingTransfers(
          proposal.trip,
          proposal.trip.planning,
          chosen,
          validateRows(
            proposal.trip,
            proposal.trip.planning,
            chosen,
            proposal.draft.routeContext,
          ).bases,
          proposal.draft.routeContext,
        )
      : [];
  const pending = !!legs.length;
  return (
    <Page resetKey={proposal?.draft.id || "select"}>
      <Label>{trip?.city} · 하루 정리</Label>
      <H>{proposal ? "이렇게 옮겨볼까요?" : "못 간 곳, 다음 여정으로"}</H>
      <P>
        다녀온 곳·예약·꼭 갈 곳은 그대로 두고, 선택한 장소만 다음 날부터 남은
        날짜에 제안해요. 확인 전에는 일정이 바뀌지 않아요.
      </P>
      {!!error && (
        <Text accessibilityRole="alert" style={{ ...s.p, color: ui.danger }}>
          {error}
        </Text>
      )}
      {proposal ? (
        <>
          {JSON.stringify(trip) !== proposal.base && (
            <P>
              일정이나 방문 상태가 바뀌었어요. 이 제안은 적용하지 않고 다시
              만들어야 해요.
            </P>
          )}
          {!proposal.draft.rows.length && (
            <P>
              배치 가능한 시간을 찾지 못했어요. 장소는 원래 일정에 그대로 남아
              있어요.
            </P>
          )}
          {proposal.draft.rows.map((row) => {
            const original = proposal.originals[row.placeId!];
            return (
              <Pressable
                key={row.id}
                accessibilityRole="checkbox"
                accessibilityLabel={`${placeText(row.name)} 이동 제안 선택`}
                accessibilityState={{ checked: selected.has(row.id) }}
                onPress={() => {
                  setSelected((prev) => {
                    const n = new Set(prev);
                    n.has(row.id) ? n.delete(row.id) : n.add(row.id);
                    return n;
                  });
                  setConsent(false);
                }}
                style={{
                  paddingVertical: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: ui.line,
                }}
              >
                <Text
                  style={{ fontSize: 17, fontWeight: "600", color: ui.ink }}
                >
                  <Ionicons
                    name={selected.has(row.id) ? "checkbox" : "square-outline"}
                    size={24}
                    color={selected.has(row.id) ? ui.blue : ui.muted}
                  />{" "}
                  {placeText(row.name)}
                </Text>
                <P>
                  {dateLabel(proposal.sourceDate)} {original?.time} →{" "}
                  {dateLabel(row.date)} {row.time}
                </P>
                <Text style={{ fontSize: 14, lineHeight: 21, color: ui.muted }}>
                  {row.reason}
                </Text>
              </Pressable>
            );
          })}
          {proposal.draft.unplaced.map((e) => (
            <View key={e.id} style={{ paddingVertical: 12 }}>
              <Text style={s.title}>{placeText(e.name)}</Text>
              <P>{e.reason} · 원래 일정에 남겨두었어요.</P>
            </View>
          ))}
          {legs.map((leg, i) => (
            <View key={i} style={{ paddingVertical: 10 }}>
              <Text style={s.title}>
                {placeText(leg.fromName)} → {placeText(leg.toName)}
              </Text>
              <P>검토용 이동 공간 30분은 실제 소요시간이 아니에요.</P>
              <Action
                title="대중교통 경로 확인 ↗"
                secondary
                onPress={() =>
                  Linking.openURL(
                    "https://www.google.com/maps/dir/?api=1&origin=" +
                      encodeURIComponent(leg.from) +
                      "&destination=" +
                      encodeURIComponent(leg.to) +
                      "&travelmode=transit",
                  ).catch(() => setError("지도를 열지 못했어요."))
                }
              />
            </View>
          ))}
          {pending && (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel="교통 시간 미확인 구간을 확인하고 임시 이동 적용"
              accessibilityState={{ checked: consent }}
              onPress={() => setConsent(!consent)}
              style={{ minHeight: 48, paddingVertical: 16 }}
            >
              <Text style={{ fontSize: 15, lineHeight: 23, color: ui.blue }}>
                <Ionicons
                  name={consent ? "checkbox" : "square-outline"}
                  size={24}
                  color={ui.blue}
                />{" "}
                대중교통 시간이 확인되지 않은 구간이 있어요. 임시 배치임을
                확인하고 적용해요.
              </Text>
            </Pressable>
          )}
          <P>
            선택하지 않은 장소는 옮기지 않아요. 적용 직후 일정 화면에서 되돌릴
            수 있어요.
          </P>
          <Action
            title={`선택한 ${selected.size}곳 이동 적용`}
            disabled={
              !selected.size ||
              (pending && !consent) ||
              JSON.stringify(trip) !== proposal.base
            }
            onPress={() => {
              if (applying.current) return;
              applying.current = true;
              const r = store.applyReplan(
                tripId,
                proposal,
                [...selected],
                consent,
              );
              if (!r.ok) {
                setError(r.message);
                applying.current = false;
                return;
              }
              const first = proposal.draft.rows.find((r) => selected.has(r.id));
              router.replace({
                pathname: "/trip/[tripId]/itinerary",
                params: {
                  tripId,
                  date: first?.date || date,
                  manualEdited: "1",
                },
              });
            }}
          />
          <Action
            title="장소 다시 선택"
            secondary
            onPress={() => {
              setProposal(null);
              setError("");
            }}
          />
        </>
      ) : (
        <>
          <Text style={s.title}>
            {day ? dateLabel(day.date) : "날짜를 확인해 주세요."}
          </Text>
          {!future.length && (
            <P>
              남은 여행 날짜가 없어요. 지금 일정을 지우거나 여행 기간을 늘리지
              않고 남겨둘게요. 여행 기간을 바꾸면 다시 제안받을 수 있어요.
            </P>
          )}
          {!future.length && (
            <>
              <Action
                title="여행 기간 수정"
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/trip/[tripId]/edit",
                    params: { tripId },
                  })
                }
              />
              <Action
                title="현재 일정에 남겨두기"
                secondary
                onPress={() =>
                  router.replace({
                    pathname: "/trip/[tripId]/itinerary",
                    params: { tripId, date },
                  })
                }
              />
            </>
          )}
          {!remaining.length && <P>아직 체크하지 않은 장소가 없어요.</P>}
          {remaining.map((e) => {
            const locked = lockReason(trip!, date, e);
            return (
              <Pressable
                key={e.id}
                accessibilityRole="checkbox"
                accessibilityLabel={`${placeText(e.name)} 재배치할 장소`}
                accessibilityState={{
                  checked: ids.has(e.id),
                  disabled: !!locked || busy,
                }}
                disabled={!!locked || busy}
                onPress={() =>
                  setIds((prev) => {
                    const n = new Set(prev);
                    n.has(e.id) ? n.delete(e.id) : n.add(e.id);
                    return n;
                  })
                }
                style={{
                  minHeight: 64,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: ui.line,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons
                      name={ids.has(e.id) ? "checkbox" : "square-outline"}
                      size={24}
                      color={
                        locked ? ui.line : ids.has(e.id) ? ui.blue : ui.muted
                      }
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: locked ? ui.muted : ui.ink,
                      }}
                    >
                      {placeText(e.name)}
                    </Text>
                    <Text
                      style={{ fontSize: 13, color: ui.muted, marginTop: 5 }}
                    >
                      {locked ||
                        `${e.time} · 날짜와 시간을 AI가 다시 제안해요.`}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
          {!!eligible.length && (
            <P>
              최대 {future.length}일의 남은 일정과 숙소·예약·이동 조건을 함께
              확인해요.
            </P>
          )}
          {busy ? (
            <>
              <ActivityIndicator />
              <P>원래 일정은 유지한 채 남은 날짜를 확인하고 있어요.</P>
              <Action
                title="제안 생성 취소"
                secondary
                onPress={() => {
                  controller.current?.abort();
                  setError("취소했어요. 원래 일정은 그대로예요.");
                }}
              />
            </>
          ) : (
            <Action
              title={`선택한 ${ids.size}곳, 남은 날짜에 제안받기`}
              disabled={!ids.size || !future.length}
              onPress={generate}
            />
          )}
        </>
      )}
    </Page>
  );
}
