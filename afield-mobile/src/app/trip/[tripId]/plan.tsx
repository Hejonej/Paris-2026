import { Ionicons } from "@expo/vector-icons";
import { collectPendingTransfers } from "../../../routeChecks";
import { planningRoutes } from "../../../liveRoutes";
import { placeText } from "../../../placeText";
import { Sheet } from "../../../sheet";
import { AirportField } from "../../../airportField";
import { PlaceSearch } from "../../../placeSearch";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { Page, H, P, Label, Field, Action, s } from "../../../ui";
import { DateField } from "../../../tripFields";
import { useTripParams } from "../../../route";
import { useTrips } from "../../../store";
import {
  defaultConditions,
  readyPlaces,
  planningSnapshot,
  planningModes,
  syncPlanningPlaces,
  validateRows,
} from "../../../planner";
import type { PlanRow, PlanningConditions } from "../../../planner";
import { generatePlan } from "../../../aiPlanner";
import { dateLabel } from "../../../data";
import { ui } from "../../../theme";
function TimeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Label>{label}</Label>
      <Field
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        maxLength={5}
        placeholder="09:00"
        keyboardType="numbers-and-punctuation"
      />
    </View>
  );
}
export default function Plan() {
  const { tripId } = useTripParams();
  const navigation = useNavigation();
  const router = useRouter();
  const store = useTrips();
  const trip = store.trips.find((t) => t.id === tripId);
  const [c, setC] = useState<PlanningConditions>(
    () =>
      trip?.planning ||
      defaultConditions(
        trip || {
          id: "",
          name: "",
          city: "",
          start: "",
          end: "",
          days: [],
          candidates: [],
        },
      ),
  );
  const [section, setSection] = useState("stays");
  const [step, setStep] = useState<0 | 1 | 2>(trip?.planning?.wizardStep || 0);
  const [review, setReview] = useState(!!trip?.planDraft);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(trip?.planDraft?.rows.map((r) => r.id) || []),
  );
  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft:
        step > 0 || review
          ? () => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  review ? "여행 조건으로 돌아가기" : "이전 단계로 돌아가기"
                }
                hitSlop={8}
                onPress={() => {
                  if (review) setReview(false);
                  else setStep((step - 1) as 0 | 1);
                  setError("");
                }}
                style={{
                  minHeight: 48,
                  paddingHorizontal: 16,
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{ fontSize: 18, fontWeight: "600", color: ui.ink }}
                >
                  ‹ 뒤로
                </Text>
              </Pressable>
            )
          : undefined,
    });
    return () => navigation.setOptions({ headerLeft: undefined });
  }, [step, review, navigation]);
  const [busy, setBusy] = useState(false);
  const [feedbackKey, setFeedbackKey] = useState(0);
  const [error, setError] = useState("");
  const [reasonRow, setReasonRow] = useState<PlanRow | null>(null);
  const [showFailureNotes, setShowFailureNotes] = useState(false);
  const [pendingConsent, setPendingConsent] = useState(false);
  useEffect(
    () => setPendingConsent(false),
    [trip?.planDraft?.id, [...selected].sort().join("|")],
  );
  const [message, setMessage] = useState("");
  const [manual, setManual] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualQuery, setManualQuery] = useState("");
  const [manualCategory, setManualCategory] = useState("관광");
  const controller = useRef<AbortController | null>(null);
  const running = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (store.ready && trip) {
      setC(syncPlanningPlaces(trip, trip.planning || defaultConditions(trip)));
      setStep(trip.planning?.wizardStep || 0);
    }
  }, [store.ready, tripId]);
  const readyKey = trip
    ? readyPlaces(trip)
        .map((p) => p.id)
        .join("|")
    : "";
  useEffect(() => {
    if (store.ready && trip)
      setC((previous) => syncPlanningPlaces(trip, previous));
  }, [readyKey]);
  useEffect(() => {
    if (trip?.planDraft) {
      setSelected(new Set(trip.planDraft.rows.map((r) => r.id)));
      setReview(true);
    }
  }, [trip?.planDraft?.id]);
  if (!trip)
    return (
      <Page>
        <H>여행을 찾을 수 없어요</H>
      </Page>
    );
  const draft = trip.planDraft;
  const used = new Set(
    trip.days.flatMap((d) =>
      d.items.map((e) => e.placeId || e.location?.placeId),
    ),
  );
  const eligible = readyPlaces(trip).filter((p) => !used.has(p.id));
  const active = c.selectedIds.filter((id) =>
    eligible.some((p) => p.id === id),
  );
  function update<K extends keyof PlanningConditions>(
    key: K,
    value: PlanningConditions[K],
  ) {
    setC((prev) => ({ ...prev, [key]: value }));
    setError("");
  }
  async function generate() {
    if (running.current) return;
    setFeedbackKey((v) => v + 1);
    setShowFailureNotes(false);
    const result = store.savePlanning(tripId, c);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    running.current = true;
    setBusy(true);
    setError("");
    controller.current = new AbortController();
    try {
      const workingTrip = { ...trip!, planning: c, planDraft: undefined };
      const routes = await planningRoutes(
        workingTrip,
        controller.current.signal,
      );
      const proposal = await generatePlan(
        { ...trip!, planning: c, planDraft: undefined },
        controller.current.signal,
        fetch,
        routes,
      );
      const saved = store.saveDraft(tripId, proposal);
      if (!saved.ok) setError(saved.message);
      else {
        setSelected(new Set(proposal.rows.map((r) => r.id)));
        setReview(true);
      }
    } catch (e) {
      setError(
        e && typeof e === "object" && "message" in e
          ? String(e.message)
          : "제안을 만들지 못했어요. 연결을 확인해 주세요.",
      );
    } finally {
      running.current = false;
      setBusy(false);
      setFeedbackKey((v) => v + 1);
    }
  }
  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const panel = (key: string, title: string, children: React.ReactNode) => {
    const required = key === "places" ? 1 : key === "rhythm" ? 2 : 0;
    if (step !== required) return null;
    return (
      <View
        style={{
          borderBottomWidth: 1,
          borderColor: ui.line,
          paddingVertical: 16,
          marginBottom: 8,
        }}
      >
        <Text style={s.title}>{title}</Text>
        <View style={{ paddingTop: 16 }}>{children}</View>
      </View>
    );
  };
  function openPlaces(instagram: boolean) {
    const saved = { ...c, wizardStep: 1 as const };
    const result = store.savePlanning(tripId, saved);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setC(saved);
    router.push({
      pathname: instagram
        ? "/trip/[tripId]/instagram"
        : "/trip/[tripId]/candidates",
      params: { tripId, section: "places", returnTo: "plan" },
    });
  }
  function nextStep() {
    const next = Math.min(2, step + 1) as 0 | 1 | 2;
    const updated = { ...c, wizardStep: next };
    const result = store.savePlanning(tripId, updated);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setC(updated);
    setStep(next);
    setError("");
    setMessage("저장했어요.");
    setFeedbackKey((v) => v + 1);
  }
  if (review && draft) {
    const stale = planningSnapshot(trip) !== draft.baseSnapshot;
    const chosen = draft.rows.filter((r) => selected.has(r.id));
    const anchors = draft.anchors.filter(
      (a) =>
        !chosen.some(
          (r) =>
            r.date === a.date &&
            r.time === a.time &&
            ((a.kind === "meal" && r.tag === "meal") ||
              (a.kind === "rest" && r.tag === "cafe")),
        ),
    );
    const chosenPending =
      draft.routeContext && trip.planning
        ? collectPendingTransfers(
            trip,
            trip.planning,
            chosen,
            validateRows(trip, trip.planning, chosen, draft.routeContext).bases,
            draft.routeContext,
          )
        : [];
    const mustIds = trip.planning?.mustIds || [];
    const missingMust = draft.unplaced.some((p) => mustIds.includes(p.id));
    const legacyRouting =
      draft.visitTiming !== "flexible" ||
      (!!draft.routeContext && draft.routeContext.policyVersion !== 3);
    const context = (
      <View
        style={{
          paddingVertical: 16,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: ui.line,
          marginBottom: 20,
        }}
      >
        <Text style={{ fontSize: 14, lineHeight: 22, color: ui.ink }}>
          {trip.city} · {trip.planning?.rangeStart || trip.start} —{" "}
          {trip.planning?.rangeEnd || trip.end}
        </Text>
        <Text
          style={{
            fontSize: 13,
            lineHeight: 22,
            color: ui.muted,
            marginTop: 4,
          }}
        >
          선택 장소 {trip.planning?.selectedIds.length || 0}곳 · 숙소{" "}
          {trip.planning?.stays.length || 0} · 항공편{" "}
          {trip.planning?.flights.filter((f) => !f.pending).length || 0} · 예약{" "}
          {trip.planning?.fixed.length || 0}
        </Text>
        <Text style={{ fontSize: 13, lineHeight: 22, color: ui.muted }}>
          기존 일정 {trip.days.reduce((n, d) => n + d.items.length, 0)}개 유지 ·
          선택한 제안만 적용
        </Text>
        <Text style={{ fontSize: 13, lineHeight: 22, color: ui.muted }}>
          {draft?.routeContext
            ? "확인된 이동 시간 + 여행 조건을 참고한 초안"
            : "시간·주소를 참고한 이전 초안 · 새 제안은 Google 이동 시간을 조회해요"}
        </Text>
        {draft.routeContext?.geography && (
          <Text
            style={{
              fontSize: 14,
              lineHeight: 21,
              color: ui.ink,
              marginTop: 8,
            }}
          >
            가까운 장소를 같은 날로 묶고 방문 순서를 정했어요.
          </Text>
        )}
        {legacyRouting && (
          <Text
            style={{
              fontSize: 14,
              lineHeight: 21,
              color: ui.blue,
              marginTop: 10,
            }}
          >
            이전 기준으로 만든 결과예요. 방문 시간을 유동적으로 계획하도록
            바뀌었으니 같은 조건으로 새로 만들어 주세요.
          </Text>
        )}
        {draft?.routeContext?.warnings?.map((warning, i) => (
          <Text
            key={i}
            style={{
              fontSize: 14,
              lineHeight: 21,
              color: ui.blue,
              marginTop: 10,
            }}
          >
            {warning}
          </Text>
        ))}
      </View>
    );
    if (!draft.rows.length)
      return (
        <Page resetKey={`empty-${draft.id}`}>
          <Label>AI 일정 생성</Label>
          <H>아직 일정을 완성하지 못했어요</H>
          <P>
            최근 시도 ·{" "}
            {new Date(draft.generatedAt).toLocaleString("ko-KR", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </P>
          <P>
            선택한 {trip.planning?.selectedIds.length || 0}곳은 그대로 보관돼요.
            기존 일정도 변경하지 않았어요.
          </P>
          {context}
          <View style={{ marginVertical: 12 }}>
            {draft.unplaced.map((p) => (
              <View
                key={p.id}
                style={{
                  paddingVertical: 16,
                  borderBottomWidth: 1,
                  borderColor: ui.line,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    lineHeight: 24,
                    fontWeight: "600",
                    color: ui.ink,
                  }}
                >
                  {placeText(p.name)}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    lineHeight: 22,
                    color: ui.muted,
                    marginTop: 8,
                  }}
                >
                  {legacyRouting
                    ? "이전 검토 결과예요. 수정된 이동 기준으로 다시 검토해 주세요."
                    : /자동 배치를 완료하지 못했어요|유효한 날짜.*제안이 없/.test(
                          p.reason,
                        )
                      ? "이전에 저장된 결과에는 구체적인 실패 원인이 남아 있지 않아요. 같은 조건으로 새로 요청할 수 있어요."
                      : p.reason}
                </Text>
              </View>
            ))}
          </View>
          <Action
            title="같은 조건으로 다시 만들기"
            tone="primary"
            onPress={() => {
              setReview(false);
              setShowFailureNotes(false);
              void generate();
            }}
          />
          <Action
            title="입력한 조건 보기"
            tone="link"
            onPress={() => {
              setReview(false);
              setSection("places");
              setFeedbackKey((v) => v + 1);
            }}
          />
          <Action
            title={
              showFailureNotes ? "참고 사항 접기" : "그 밖의 참고 사항 보기"
            }
            tone="link"
            onPress={() => setShowFailureNotes(!showFailureNotes)}
          />
          {showFailureNotes &&
            draft.issues.map((issue, index) => <P key={index}>{issue}</P>)}
        </Page>
      );
    return (
      <Page resetKey={`review-${draft.id}`}>
        <Label>2 · AI 제안 검토</Label>
        <H>이렇게 여행해 볼까요?</H>
        <P>
          기존 일정과 MUST는 그대로예요. 체크한 장소와 아래 식사·휴식·고정
          일정만 추가합니다.
        </P>
        {context}
        {missingMust && (
          <Text
            accessibilityRole="alert"
            style={{
              fontSize: 14,
              lineHeight: 22,
              color: ui.danger,
              marginBottom: 16,
            }}
          >
            꼭 가기로 선택한 장소가 일부 빠졌어요. 조건을 확인해 다시 제안받아야
            적용할 수 있어요.
          </Text>
        )}
        {stale && (
          <P>
            기존 일정이나 조건이 바뀌었어요. 최신 조건으로 다시 제안받아 주세요.
          </P>
        )}
        {trip.days
          .filter(
            (d) =>
              draft.rows.some((r) => r.date === d.date) ||
              anchors.some((r) => r.date === d.date),
          )
          .map((day) => (
            <View key={day.date} style={{ marginBottom: 20 }}>
              <Text style={s.title}>{dateLabel(day.date)}</Text>
              <P>기존 일정 {day.items.length}개 유지</P>
              {[...draft.rows, ...anchors]
                .filter((r) => r.date === day.date)
                .sort((a, b) => a.time.localeCompare(b.time))
                .map((row) =>
                  row.kind === "place" ? (
                    <View
                      key={row.id}
                      style={{ borderBottomWidth: 1, borderColor: ui.line }}
                    >
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityLabel={`${placeText(row.name)} 제안 선택`}
                        accessibilityState={{
                          checked: selected.has(row.id),
                          disabled: mustIds.includes(row.placeId!),
                        }}
                        disabled={mustIds.includes(row.placeId!)}
                        key={row.id}
                        onPress={() => {
                          if (mustIds.includes(row.placeId!)) return;
                          setSelected((current) => {
                            const next = new Set(current);
                            next.has(row.id)
                              ? next.delete(row.id)
                              : next.add(row.id);
                            return next;
                          });
                        }}
                        style={{
                          paddingVertical: 14,
                          borderBottomWidth: 1,
                          borderColor: ui.line,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 18,
                            fontWeight: "600",
                            color: ui.ink,
                          }}
                        >
                          {selected.has(row.id) ? "☑" : "□"} {row.time} ·{" "}
                          {placeText(row.name)}
                        </Text>
                        <Text
                          style={{
                            fontSize: 15,
                            lineHeight: 23,
                            color: ui.muted,
                            marginTop: 6,
                          }}
                        >
                          {mustIds.includes(row.placeId!) ? "꼭 가기 · " : ""}
                          {row.reason}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={{
                          minHeight: 44,
                          justifyContent: "center",
                          alignSelf: "flex-start",
                        }}
                        onPress={() => setReasonRow(row)}
                        accessibilityRole="button"
                        accessibilityLabel={`${placeText(row.name)} 제안 이유 자세히`}
                      >
                        <Text style={{ fontSize: 13, color: ui.blue }}>
                          제안 이유 자세히
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View key={row.id} style={{ paddingVertical: 10 }}>
                      <Text style={{ fontSize: 16, color: ui.accent }}>
                        {row.time} · {placeText(row.name)}
                      </Text>
                      <Text
                        style={{
                          fontSize: 14,
                          lineHeight: 21,
                          color: ui.muted,
                        }}
                      >
                        {row.reason}
                      </Text>
                    </View>
                  ),
                )}
            </View>
          ))}
        {!!draft.unplaced.length && (
          <View style={{ marginVertical: 12 }}>
            <Text style={s.title}>이번에 넣지 못한 장소</Text>
            {draft.unplaced.map((p) => (
              <View
                key={p.id}
                style={{
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderColor: ui.line,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    lineHeight: 24,
                    fontWeight: "600",
                    color: ui.ink,
                  }}
                >
                  {placeText(p.name)}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    lineHeight: 22,
                    color: ui.muted,
                    marginTop: 6,
                  }}
                >
                  {legacyRouting
                    ? "이전 검토 결과예요. 수정된 이동 기준으로 다시 검토해 주세요."
                    : p.reason}
                </Text>
              </View>
            ))}
          </View>
        )}
        <P>영업시간·날씨와 여행 날짜의 교통 시간표는 확인이 필요해요.</P>
        <Action
          title={
            showFailureNotes
              ? "적용 전 참고 사항 접기"
              : "적용 전 참고 사항 보기"
          }
          tone="link"
          onPress={() => setShowFailureNotes(!showFailureNotes)}
        />
        {showFailureNotes &&
          draft.issues.map((message, index) => <P key={index}>{message}</P>)}
        <Sheet
          visible={!!reasonRow}
          title="이 장소를 제안한 이유"
          onClose={() => setReasonRow(null)}
        >
          {reasonRow && (
            <>
              <Label>
                {dateLabel(reasonRow.date)} · {reasonRow.time}
              </Label>
              <Text style={s.title}>{reasonRow.name}</Text>
              <View style={{ marginTop: 16 }}>
                <P>{reasonRow.reason}</P>
              </View>
              <P>
                입력한 여행 조건을 참고한 제안이에요. 영업시간·예약·여행 날짜의
                교통 시간표는 별도 확인이 필요해요.
              </P>
            </>
          )}
        </Sheet>
        {!!error && (
          <Text
            accessibilityRole="alert"
            style={{ color: "#A23C2B", fontSize: 16, marginVertical: 12 }}
          >
            {error}
          </Text>
        )}
        {!!chosenPending.length && (
          <View
            style={{
              paddingVertical: 16,
              borderTopWidth: 1,
              borderColor: ui.line,
              marginBottom: 12,
            }}
          >
            <Text style={s.title}>대중교통 시간 확인이 필요한 배치안</Text>
            <P>
              아래 구간은 위치를 기준으로 배치했어요. 이동 공간 30분은
              검토용으로 비워둔 자리이며 실제 소요시간이 아니에요. 경로를 확인한
              뒤 임시 일정으로 추가할 수 있어요.
            </P>
            {chosenPending.map((leg, i) => (
              <View key={i} style={{ paddingVertical: 8 }}>
                <Text style={{ fontSize: 14, lineHeight: 21, color: ui.ink }}>
                  {placeText(leg.fromName)} → {placeText(leg.toName)}
                </Text>
                <Action
                  title="대중교통 경로 확인 ↗"
                  tone="link"
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
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel="대중교통 시간 미확인 구간을 확인하고 임시 일정으로 추가"
              accessibilityState={{ checked: pendingConsent }}
              onPress={() => setPendingConsent((v) => !v)}
              style={{
                flexDirection: "row",
                gap: 10,
                minHeight: 48,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 20, color: ui.blue }}>
                {pendingConsent ? "☑" : "☐"}
              </Text>
              <Text
                style={{ flex: 1, fontSize: 14, lineHeight: 21, color: ui.ink }}
              >
                이동 시간이 미확인임을 확인했고 임시 일정으로 추가할게요.
              </Text>
            </Pressable>
          </View>
        )}
        <Action
          title={
            chosenPending.length
              ? `선택한 ${chosen.length}곳 임시 일정으로 추가`
              : `선택한 ${chosen.length}곳과 고정 일정 적용`
          }
          disabled={
            stale ||
            !chosen.length ||
            missingMust ||
            (!!chosenPending.length && !pendingConsent)
          }
          onPress={() => {
            const r = store.applyDraft(tripId, [...selected], pendingConsent);
            if (!r.ok) setError(r.message);
            else
              router.dismissTo({
                pathname: "/trip/[tripId]/itinerary",
                params: {
                  tripId,
                  date: chosen[0]?.date,
                  planApplied: String(chosen.length),
                },
              });
          }}
        />
        <Action
          title="조건 수정하고 다시 제안받기"
          secondary
          onPress={() => {
            setReview(false);
            setError("");
          }}
        />
      </Page>
    );
  }
  return (
    <Page resetKey={`form-${step}-${feedbackKey}`}>
      <Label>
        {step + 1} / 3 ·{" "}
        {["숙소·항공편·예약", "장소 모으기", "하루 리듬과 취향"][step]}
      </Label>
      <H>
        {
          [
            "먼저 정해진 시간을 알려주세요",
            "가고 싶은 곳을 모아보세요",
            "어떤 하루를 보내고 싶나요?",
          ][step]
        }
      </H>
      <P>
        {
          [
            "숙소·항공편·예약을 먼저 저장해요. 아직 미정인 항목은 건너뛸 수 있어요.",
            "Instagram에서 가져오거나 직접 저장한 장소 중 이번에 계획할 곳을 골라요.",
            "하루의 속도와 식사, 이동수단과 추가 요청을 간단히 알려주세요.",
          ][step]
        }
      </P>
      {step === 1 && (
        <>
          <View
            style={{
              borderLeftWidth: 2,
              borderColor: ui.ink,
              paddingLeft: 14,
              paddingVertical: 8,
              marginBottom: 20,
            }}
          >
            <Text style={s.title}>
              주소 확인 {eligible.length}곳 · 이번 계획에 {active.length}곳
            </Text>
            <P>
              {eligible.length - active.length > 0
                ? `저장한 곳 중 ${eligible.length - active.length}곳은 아직 선택되지 않았어요.`
                : "선택한 장소를 바탕으로 날짜와 시간을 제안해요. Google에서 실제 거리와 이동 시간을 조회해 반영해요."}
            </P>
            {!!eligible.length && (
              <Action
                title="미배치 장소 모두 선택"
                tone="secondary"
                onPress={() => {
                  setC((prev) => ({
                    ...prev,
                    selectedIds: eligible.slice(0, 100).map((p) => p.id),
                    knownPlaceIds: eligible.map((p) => p.id),
                  }));
                  setSection("places");
                }}
              />
            )}
          </View>
        </>
      )}
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={{
            color: ui.danger,
            backgroundColor: ui.dangerSoft,
            padding: 14,
            borderRadius: 12,
            marginBottom: 16,
          }}
        >
          {error}
        </Text>
      )}
      {step === 2 && (
        <P>
          일반 장소는 방문 순서와 도착 시각만 제안해요. 머무는 시간은 자유롭게
          조절하고, 예약·항공편처럼 시간이 정해진 일정만 보호해요.
        </P>
      )}
      {busy && (
        <View
          style={{
            padding: 16,
            backgroundColor: ui.blueSoft,
            borderRadius: 12,
            marginBottom: 16,
          }}
        >
          <ActivityIndicator />
          <P>
            Google에서 이동 시간을 조회하고 {active.length}곳의 방문 날짜와
            시간을 정하고 있어요. 기존 일정은 그대로 유지해요.
          </P>
          <Action
            title="제안 생성 취소"
            tone="link"
            onPress={() => controller.current?.abort()}
          />
        </View>
      )}
      {!trip.days.length && (
        <Action
          title="먼저 여행 날짜 정하기"
          onPress={() =>
            router.push({
              pathname: "/trip/[tripId]/edit",
              params: { tripId },
            })
          }
        />
      )}
      <View
        pointerEvents={busy ? "none" : "auto"}
        style={{ opacity: busy ? 0.6 : 1 }}
      >
        {panel(
          "places",
          `새로 넣을 장소 ${active.length}곳`,
          <>
            <P>
              한 번에 최대 100곳을 제안받을 수 있어요. 위치가 확인된 저장 장소
              중에서 골라 주세요. 이미 일정에 들어간 곳은 유지합니다. ‘꼭
              가기’로 표시한 장소가 빠지면 적용을 막아요.
            </P>
            {eligible.map((place) => (
              <View
                key={place.id}
                style={{
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderColor: ui.line,
                }}
              >
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${place.name} 계획에 선택`}
                  accessibilityState={{
                    checked: c.selectedIds.includes(place.id),
                  }}
                  onPress={() => {
                    const chosen = c.selectedIds.includes(place.id);
                    setC((prev) => ({
                      ...prev,
                      selectedIds: chosen
                        ? prev.selectedIds.filter((id) => id !== place.id)
                        : [
                            ...prev.selectedIds.filter((id) => !used.has(id)),
                            place.id,
                          ],
                      mustIds: chosen
                        ? prev.mustIds.filter((id) => id !== place.id)
                        : prev.mustIds.filter((id) => !used.has(id)),
                    }));
                  }}
                  style={{ minHeight: 44, justifyContent: "center" }}
                >
                  <Text style={{ fontSize: 18, color: ui.ink }}>
                    {c.selectedIds.includes(place.id) ? "☑" : "□"} {place.name}
                  </Text>
                </Pressable>
                {c.selectedIds.includes(place.id) && (
                  <>
                    <Action
                      title={`${c.mustIds.includes(place.id) ? "✓ 꼭 가기" : "꼭 가기로 표시"} · ${place.name}`}
                      secondary
                      onPress={() =>
                        update(
                          "mustIds",
                          c.mustIds.includes(place.id)
                            ? c.mustIds.filter((id) => id !== place.id)
                            : [...c.mustIds, place.id],
                        )
                      }
                    />
                  </>
                )}
              </View>
            ))}
            {!eligible.length && (
              <P>
                먼저 가고 싶은 곳에서 위치를 확인하거나 아래에서 장소를 직접
                추가해 주세요.
              </P>
            )}
            <Action
              title="Instagram JSON에서 장소 가져오기"
              secondary
              onPress={() => openPlaces(true)}
            />
            <Action
              title="가고 싶은 곳에서 위치 확인"
              secondary
              onPress={() => openPlaces(false)}
            />
            <Action
              title="장소 직접 추가"
              secondary
              onPress={() => setManual(!manual)}
            />
            {manual && (
              <>
                <Field
                  accessibilityLabel="직접 추가할 장소 이름"
                  value={manualName}
                  onChangeText={setManualName}
                  placeholder="장소 이름"
                  maxLength={80}
                />
                <Field
                  accessibilityLabel="직접 추가할 장소 주소"
                  value={manualQuery}
                  onChangeText={setManualQuery}
                  placeholder="지도에서 확인한 주소 · 도시 포함"
                  maxLength={300}
                />
                <Field
                  accessibilityLabel="직접 추가할 장소 분류"
                  value={manualCategory}
                  onChangeText={setManualCategory}
                  placeholder="관광 · 식사 · 카페/디저트"
                  maxLength={40}
                />
                <Action
                  title="확인한 주소로 장소 저장"
                  onPress={() => {
                    const r = store.addManualPlace(
                      tripId,
                      manualName,
                      manualQuery,
                      manualCategory,
                    );
                    if (!r.ok) setError(r.message);
                    else {
                      setC((prev) => ({
                        ...prev,
                        selectedIds: [
                          ...prev.selectedIds.filter((id) => !used.has(id)),
                          ...(r.placeIds || []),
                        ],
                        mustIds: prev.mustIds.filter((id) => !used.has(id)),
                      }));
                      setManualName("");
                      setManualQuery("");
                      setManual(false);
                    }
                  }}
                />
              </>
            )}
          </>,
        )}
        {panel(
          "rhythm",
          "하루의 속도와 식사",
          <>
            <Label>이번에 제안받을 기간</Label>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <DateField
                label="제안 시작일"
                value={c.rangeStart || trip.start}
                minimum={trip.start}
                onChange={(v) => update("rangeStart", v)}
              />
              <DateField
                label="제안 종료일"
                value={c.rangeEnd || trip.end}
                minimum={c.rangeStart || trip.start}
                onChange={(v) => update("rangeEnd", v)}
              />
            </View>
            <Label>여행 속도</Label>
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                marginTop: 6,
                marginBottom: 24,
              }}
            >
              {[
                { id: "relaxed" as const, name: "여유롭게" },
                { id: "balanced" as const, name: "적당히" },
                { id: "active" as const, name: "알차게" },
              ].map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: c.pace === p.id }}
                  onPress={() => update("pace", p.id)}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: c.pace === p.id ? "#E8E8E8" : ui.line,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ fontSize: 16, color: ui.ink }}>
                    {placeText(p.name)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TimeInput
                label="하루 시작"
                value={c.start}
                onChange={(v) => update("start", v)}
              />
              <TimeInput
                label="하루 마무리"
                value={c.end}
                onChange={(v) => update("end", v)}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TimeInput
                label="점심"
                value={c.lunch}
                onChange={(v) => update("lunch", v)}
              />
              <TimeInput
                label="저녁"
                value={c.dinner}
                onChange={(v) => update("dinner", v)}
              />
              <TimeInput
                label="휴식"
                value={c.rest}
                onChange={(v) => update("rest", v)}
              />
            </View>
            <P>
              식사·휴식은 희망 시각만 참고해요. 머무는 시간은 고정하지 않아요.
            </P>
            <Label>이동 방식 · 여러 개 선택 가능</Label>
            <P>
              선택한 수단 중 실제 조회 시간이 더 짧은 수단으로 구간을 계획해요.
              미확인 시간은 더 빠르다고 가정하지 않아요.
            </P>
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                marginTop: 4,
                marginBottom: 24,
              }}
            >
              {(
                [
                  { id: "walking", name: "도보" },
                  { id: "transit", name: "대중교통" },
                  { id: "driving", name: "차" },
                ] as const
              ).map((m) => {
                const checked = planningModes(c).includes(m.id);
                return (
                  <Pressable
                    key={m.id}
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${m.name} 이용`}
                    accessibilityState={{ checked }}
                    onPress={() => {
                      const previous = planningModes(c);
                      if (checked && previous.length === 1) {
                        setError("이동 방식은 하나 이상 선택해 주세요.");
                        setFeedbackKey((v) => v + 1);
                        return;
                      }
                      const modes = checked
                        ? previous.filter((id) => id !== m.id)
                        : [...previous, m.id];
                      setC((p) => ({
                        ...p,
                        modes,
                        mode: modes.length === 1 ? modes[0] : "mixed",
                      }));
                      setError("");
                    }}
                    style={{
                      flex: 1,
                      minHeight: 48,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: checked ? ui.blue : ui.line,
                      backgroundColor: checked ? ui.blueSoft : ui.surface,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: checked ? ui.blue : ui.ink,
                        fontSize: 16,
                        fontWeight: "600",
                      }}
                    >
                      {checked ? "✓ " : ""}
                      {m.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Label>일정 사이에 비워둘 시간 · 분</Label>
            <Field
              accessibilityLabel="이동 여유 시간"
              value={String(c.buffer)}
              onChangeText={(v) => update("buffer", Number(v))}
              keyboardType="number-pad"
              maxLength={3}
            />
            <P>
              장소를 옮기고 잠깐 쉬도록 비워두는 간격이에요. 실제 이동 시간은
              경로 찾기에서 확인해 주세요.
            </P>
          </>,
        )}
        {panel(
          "stays",
          `숙소 ${c.stays.length}곳`,
          <>
            <P>
              날짜별 숙소를 하루 출발·귀가 기준으로 참고해요. 체크인/아웃은 현지
              시각입니다. 짐 보관 장소가 따로 있으면 요청에 적어 주세요.
            </P>
            {c.stays.map((stay, index) => {
              const change = (field: string, value: string) =>
                update(
                  "stays",
                  c.stays.map((s, i) =>
                    i === index ? { ...s, [field]: value } : s,
                  ),
                );
              return (
                <View key={stay.id} style={{ paddingVertical: 14 }}>
                  <Label>숙소 {index + 1}</Label>
                  <PlaceSearch
                    city={trip.city}
                    country={trip.country}
                    name={stay.name}
                    onNameChange={(value) => change("name", value)}
                    onSelect={(m) =>
                      update(
                        "stays",
                        c.stays.map((s) =>
                          s.id === stay.id
                            ? { ...s, name: m.name, query: m.address }
                            : s,
                        ),
                      )
                    }
                  />
                  <Field
                    accessibilityLabel={`숙소 ${index + 1} 이름`}
                    value={stay.name}
                    onChangeText={(v) => change("name", v)}
                    placeholder="숙소 이름"
                    maxLength={80}
                  />
                  <Field
                    accessibilityLabel={`숙소 ${index + 1} 주소`}
                    value={stay.query}
                    onChangeText={(v) => change("query", v)}
                    placeholder="확인한 주소 · 도시 포함"
                    maxLength={300}
                  />
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <DateField
                      label={`숙소 ${index + 1} 체크인 날짜`}
                      value={stay.checkIn}
                      onChange={(v) => change("checkIn", v)}
                    />
                    <DateField
                      label={`숙소 ${index + 1} 체크아웃 날짜`}
                      value={stay.checkOut}
                      minimum={stay.checkIn}
                      onChange={(v) => change("checkOut", v)}
                    />
                  </View>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <TimeInput
                      label={`숙소 ${index + 1} 체크인 가능 시각`}
                      value={stay.inTime}
                      onChange={(v) => change("inTime", v)}
                    />
                    <TimeInput
                      label={`숙소 ${index + 1} 체크아웃 마감`}
                      value={stay.outTime}
                      onChange={(v) => change("outTime", v)}
                    />
                  </View>
                  <Label>도착일 동선</Label>
                  {(
                    [
                      ["auto", "체크인 가능하면 숙소 먼저"],
                      ["later", "관광 후 숙소 방문"],
                    ] as const
                  ).map(([value, label]) => (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityLabel={label}
                      accessibilityState={{
                        checked: (stay.arrivalPreference || "auto") === value,
                      }}
                      onPress={() => change("arrivalPreference", value)}
                      style={{
                        minHeight: 44,
                        flexDirection: "row",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <Ionicons
                        name={
                          (stay.arrivalPreference || "auto") === value
                            ? "radio-button-on"
                            : "radio-button-off"
                        }
                        size={22}
                        color={
                          (stay.arrivalPreference || "auto") === value
                            ? ui.blue
                            : ui.muted
                        }
                      />
                      <Text style={{ fontSize: 15, color: ui.ink, flex: 1 }}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                  {stay.arrivalPreference !== "later" && (
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel="체크인 전 짐 보관 가능 여부 확인"
                      accessibilityState={{
                        checked: !!stay.luggageDropConfirmed,
                      }}
                      onPress={() =>
                        update(
                          "stays",
                          c.stays.map((s) =>
                            s.id === stay.id
                              ? {
                                  ...s,
                                  luggageDropConfirmed: !s.luggageDropConfirmed,
                                }
                              : s,
                          ),
                        )
                      }
                      style={{ minHeight: 48, paddingVertical: 8 }}
                    >
                      <Text
                        style={{ fontSize: 15, lineHeight: 22, color: ui.ink }}
                      >
                        <Ionicons
                          name={
                            stay.luggageDropConfirmed
                              ? "checkbox"
                              : "square-outline"
                          }
                          size={24}
                          color={stay.luggageDropConfirmed ? ui.blue : ui.muted}
                        />{" "}
                        체크인 전 짐 보관이 가능한 숙소예요
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          lineHeight: 20,
                          color: ui.muted,
                          marginTop: 4,
                        }}
                      >
                        숙소에 확인한 경우에만 선택해 주세요.
                      </Text>
                    </Pressable>
                  )}
                  <Action
                    title={`숙소 ${index + 1} 입력 삭제`}
                    secondary
                    onPress={() =>
                      update(
                        "stays",
                        c.stays.filter((_, i) => i !== index),
                      )
                    }
                  />
                </View>
              );
            })}
            <Action
              title="＋ 숙소 추가"
              secondary
              onPress={() =>
                update("stays", [
                  ...c.stays,
                  {
                    id: uid(),
                    name: "",
                    query: "",
                    checkIn: trip.start,
                    checkOut: trip.end,
                    inTime: "15:00",
                    outTime: "11:00",
                  },
                ])
              }
            />
          </>,
        )}
        {panel(
          "flights",
          `항공편 ${c.flights.length}개`,
          <>
            <P>
              아직 예약하지 않았다면 입력하지 않고 다음으로 넘어가세요. 입력
              중인 항공편은 보관만 하고, ‘이 항공편 사용’을 눌러야 계획에
              반영해요.
            </P>
            {c.flights.map((flight, index) => {
              const change = (field: string, value: string) =>
                update(
                  "flights",
                  c.flights.map((f) =>
                    f.id === flight.id
                      ? { ...f, [field]: value, pending: true }
                      : f,
                  ),
                );
              return (
                <View key={flight.id} style={{ paddingVertical: 14 }}>
                  <Label>
                    {flight.kind === "arrival"
                      ? "가는 항공편 · 여행지 도착"
                      : "돌아오는 항공편 · 여행지 출발"}{" "}
                    {flight.pending ? "· 입력 중" : "· 계획에 사용"}
                  </Label>
                  <AirportField
                    label={`항공편 ${index + 1} 출발 공항`}
                    value={flight.fromAirport || ""}
                    onChange={(v) => change("fromAirport", v)}
                  />
                  <AirportField
                    label={`항공편 ${index + 1} 도착 공항`}
                    value={flight.toAirport || ""}
                    onChange={(v) => change("toAirport", v)}
                  />
                  <Field
                    accessibilityLabel={`항공편 ${index + 1} 항공사`}
                    placeholder="항공사 (선택)"
                    value={flight.airline || ""}
                    onChangeText={(v) => change("airline", v)}
                    maxLength={80}
                  />
                  <Field
                    accessibilityLabel={`항공편 ${index + 1} 편명`}
                    placeholder="항공편 번호 (선택 · KE2101)"
                    value={flight.number || ""}
                    onChangeText={(v) => change("number", v)}
                    maxLength={20}
                  />
                  <DateField
                    label={`항공편 ${index + 1} 출발 날짜 · 출발지 현지 기준`}
                    value={flight.departDate || flight.date}
                    onChange={(v) => change("departDate", v)}
                  />
                  <TimeInput
                    label={`항공편 ${index + 1} 출발 시각`}
                    value={flight.departTime || flight.time}
                    onChange={(v) => change("departTime", v)}
                  />
                  <DateField
                    label={`항공편 ${index + 1} 도착 날짜 · 도착지 현지 기준`}
                    value={flight.arriveDate || flight.date}
                    onChange={(v) => change("arriveDate", v)}
                  />
                  <TimeInput
                    label={`항공편 ${index + 1} 도착 시각`}
                    value={flight.arriveTime || flight.time}
                    onChange={(v) => change("arriveTime", v)}
                  />
                  {!flight.fromAirport &&
                    !flight.toAirport &&
                    !!flight.query && (
                      <P>
                        기존 공항: {flight.query}. 수정하려면 출발·도착 공항을
                        입력하세요.
                      </P>
                    )}
                  <Action
                    title="항공편 웹에서 확인 ↗"
                    secondary
                    onPress={() =>
                      Linking.openURL(
                        "https://www.google.com/search?q=" +
                          encodeURIComponent(
                            [
                              flight.airline,
                              flight.number,
                              flight.fromAirport,
                              flight.toAirport,
                              flight.departDate || flight.date,
                              "flight",
                            ]
                              .filter(Boolean)
                              .join(" "),
                          ),
                      ).catch(() => setError("항공편 검색을 열지 못했어요."))
                    }
                  />
                  <P>
                    공항은 앱 안에서 검색해요. 실제 운항편 자동 조회는 아직
                    연결되지 않았어요. 예약 내역을 보고 현지 날짜와 시각을
                    입력해 주세요.
                  </P>
                  <Action
                    title="이 항공편 사용"
                    onPress={() => {
                      if (
                        !flight.fromAirport?.trim() ||
                        !flight.toAirport?.trim()
                      ) {
                        setError(
                          "출발 공항과 도착 공항을 입력해 주세요. 미정이면 입력 중 상태로 두고 다음으로 넘어갈 수 있어요.",
                        );
                        return;
                      }
                      update(
                        "flights",
                        c.flights.map((f) =>
                          f.id === flight.id
                            ? {
                                ...f,
                                pending: false,
                                query:
                                  f.kind === "arrival"
                                    ? f.toAirport!
                                    : f.fromAirport!,
                                date:
                                  (f.kind === "arrival"
                                    ? f.arriveDate
                                    : f.departDate) || f.date,
                                time:
                                  (f.kind === "arrival"
                                    ? f.arriveTime
                                    : f.departTime) || f.time,
                              }
                            : f,
                        ),
                      );
                      setError("");
                      setMessage(
                        "항공편을 계획에 사용해요. 아래에서 저장하고 다음으로 이동하세요.",
                      );
                    }}
                  />
                  <P>
                    입국·수하물 수령 또는 탑승 준비 시간은 관광 일정과 겹치지
                    않도록 확보해요. 실제 공항 이동 시간은 별도로 고려해요.
                  </P>
                  <Action
                    title={`항공편 ${index + 1} 입력 삭제`}
                    secondary
                    onPress={() =>
                      update(
                        "flights",
                        c.flights.filter((f) => f.id !== flight.id),
                      )
                    }
                  />
                </View>
              );
            })}
            {(["arrival", "departure"] as const).map((kind) => (
              <Action
                key={kind}
                title={
                  kind === "arrival"
                    ? "＋ 가는 항공편 추가"
                    : "＋ 돌아오는 항공편 추가"
                }
                secondary
                onPress={() =>
                  update("flights", [
                    ...c.flights,
                    {
                      id: uid(),
                      kind,
                      date: kind === "arrival" ? trip.start : trip.end,
                      time: "10:00",
                      query: "",
                      buffer: 120,
                      pending: true,
                    },
                  ])
                }
              />
            ))}
          </>,
        )}
        {panel(
          "fixed",
          `예약·고정 일정 ${c.fixed.length}개`,
          <>
            {c.fixed.map((event, index) => {
              const change = (field: string, value: string | number) =>
                update(
                  "fixed",
                  c.fixed.map((f, i) =>
                    i === index ? { ...f, [field]: value } : f,
                  ),
                );
              return (
                <View key={event.id} style={{ paddingVertical: 14 }}>
                  <Field
                    accessibilityLabel={`고정 일정 ${index + 1} 이름`}
                    value={event.name}
                    onChangeText={(v) => change("name", v)}
                    placeholder="예약한 전시 · 식사 · 투어"
                    maxLength={80}
                  />
                  <DateField
                    label={`고정 일정 ${index + 1} 날짜`}
                    value={event.date}
                    onChange={(v) => change("date", v)}
                  />
                  <TimeInput
                    label={`고정 일정 ${index + 1} 시각`}
                    value={event.time}
                    onChange={(v) => change("time", v)}
                  />
                  <Label>예약으로 고정할 시간 · 분</Label>
                  <Field
                    accessibilityLabel={`고정 일정 ${index + 1} 예약 시간 구간`}
                    value={String(event.duration)}
                    keyboardType="number-pad"
                    onChangeText={(v) => change("duration", Number(v))}
                  />
                  <Field
                    accessibilityLabel={`고정 일정 ${index + 1} 주소`}
                    value={event.query}
                    onChangeText={(v) => change("query", v)}
                    placeholder="장소 주소 · 선택"
                    maxLength={300}
                  />
                  <Action
                    title={`고정 일정 ${index + 1} 입력 삭제`}
                    secondary
                    onPress={() =>
                      update(
                        "fixed",
                        c.fixed.filter((_, i) => i !== index),
                      )
                    }
                  />
                </View>
              );
            })}
            <Action
              title="＋ 예약·고정 일정 추가"
              secondary
              onPress={() =>
                update("fixed", [
                  ...c.fixed,
                  {
                    id: uid(),
                    name: "",
                    date: trip.start,
                    time: "14:00",
                    duration: 60,
                    query: "",
                  },
                ])
              }
            />
          </>,
        )}
        {step === 2 && (
          <View style={{ marginTop: 18 }}>
            <Label>여행 취향·짐 보관·추가 요청 · 선택</Label>
            <Field
              accessibilityLabel="AI에게 전할 여행 요청"
              value={c.notes}
              onChangeText={(v) => update("notes", v)}
              multiline
              style={{ minHeight: 100 }}
              maxLength={1000}
              placeholder="많이 걷지 않기, 마지막 날 짐 보관 장소 등"
            />
          </View>
        )}
      </View>
      {step === 2 && (
        <P>
          선택한 장소·주소·여행 조건·기존 일정만 AI에 보내요. 영업시간·날씨·실제
          이동은 별도 확인이 필요해요. 제안을 검토한 뒤 적용합니다.
        </P>
      )}
      {step === 1 && !active.length && (
        <P>
          제안할 장소가 없어요. ‘새로 넣을 장소’에서 위치가 확인된 곳을
          선택하거나 직접 추가해 주세요.
        </P>
      )}
      {!!message && (
        <Text
          accessibilityRole="alert"
          style={{ fontSize: 16, color: ui.accent, marginVertical: 12 }}
        >
          {message}
        </Text>
      )}
      {busy ? (
        <P>제안을 생성하고 있어요. 위에서 취소할 수 있어요.</P>
      ) : (
        <>
          {step < 2 ? (
            <Action
              title={
                step === 0
                  ? "저장하고 장소 모으기"
                  : "저장하고 여행 리듬 정하기"
              }
              onPress={nextStep}
            />
          ) : (
            <Action
              title="조건 저장하고 AI 제안받기"
              tone="primary"
              disabled={!trip.days.length || !active.length}
              onPress={generate}
            />
          )}
          {step > 0 && (
            <Action
              title="이전 단계"
              secondary
              onPress={() => {
                setStep((step - 1) as 0 | 1);
                setError("");
                setMessage("");
              }}
            />
          )}
          <Action
            title="조건만 저장"
            secondary
            onPress={() => {
              setFeedbackKey((v) => v + 1);
              const r = store.savePlanning(tripId, { ...c, wizardStep: step });
              if (r.ok) {
                setError("");
                setMessage(r.message);
              } else setError(r.message);
            }}
          />
        </>
      )}
      {draft && (
        <Action
          title="저장한 제안 검토"
          secondary
          onPress={() => setReview(true)}
        />
      )}
    </Page>
  );
}
