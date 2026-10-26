import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Page, H, P, Label, Field, Action, s } from "../../../ui";
import { DateField } from "../../../tripFields";
import { useTripParams } from "../../../route";
import { useTrips } from "../../../store";
import {
  defaultConditions,
  readyPlaces,
  planningSnapshot,
} from "../../../planner";
import type { PlanningConditions } from "../../../planner";
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
  const [section, setSection] = useState("rhythm");
  const [review, setReview] = useState(!!trip?.planDraft);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(trip?.planDraft?.rows.map((r) => r.id) || []),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [manual, setManual] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualQuery, setManualQuery] = useState("");
  const [manualCategory, setManualCategory] = useState("관광");
  const controller = useRef<AbortController | null>(null);
  const running = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (store.ready && trip) setC(trip.planning || defaultConditions(trip));
  }, [store.ready, tripId]);
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
      const proposal = await generatePlan(
        { ...trip!, planning: c, planDraft: undefined },
        controller.current.signal,
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
    }
  }
  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const panel = (key: string, title: string, children: React.ReactNode) => (
    <View
      style={{
        borderBottomWidth: 1,
        borderColor: ui.line,
        paddingVertical: 12,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: section === key }}
        onPress={() => setSection(section === key ? "" : key)}
        style={{ minHeight: 48, justifyContent: "center" }}
      >
        <Text style={s.title}>
          {title} {section === key ? "−" : "＋"}
        </Text>
      </Pressable>
      {section === key && children}
    </View>
  );
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
    const mustIds = trip.planning?.mustIds || [];
    const missingMust = draft.unplaced.some((p) => mustIds.includes(p.id));
    return (
      <Page>
        <Label>2 · AI 제안 검토</Label>
        <H>이렇게 여행해 볼까요?</H>
        <P>
          기존 일정과 MUST는 그대로예요. 체크한 장소와 아래 식사·휴식·고정
          일정만 추가합니다.
        </P>
        {stale && (
          <P>
            기존 일정이나 조건이 바뀌었어요. 최신 조건으로 다시 제안받아 주세요.
          </P>
        )}
        {!draft.rows.length && (
          <P>
            조건에 맞춰 추가할 장소가 없어요. 아래 제외 이유를 확인하고 시간이나
            장소 선택을 조정해 주세요.
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
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel={`${row.name} 제안 선택`}
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
                        {row.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: 15,
                          lineHeight: 23,
                          color: ui.muted,
                          marginTop: 6,
                        }}
                      >
                        {row.duration}분 체류 가정{" "}
                        {mustIds.includes(row.placeId!) ? "· 꼭 가기" : ""}
                        {"\n"}
                        {row.reason}
                      </Text>
                    </Pressable>
                  ) : (
                    <View key={row.id} style={{ paddingVertical: 10 }}>
                      <Text style={{ fontSize: 16, color: ui.accent }}>
                        {row.time} · {row.name}
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
              <P key={p.id}>
                {p.name} · {p.reason}
              </P>
            ))}
          </View>
        )}
        <Text style={s.title}>적용 전에 확인해 주세요</Text>
        {draft.issues.map((message, index) => (
          <P key={index}>{message}</P>
        ))}
        {!!error && (
          <Text
            accessibilityRole="alert"
            style={{ color: "#A23C2B", fontSize: 16, marginVertical: 12 }}
          >
            {error}
          </Text>
        )}
        <Action
          title={`선택한 ${chosen.length}곳과 고정 일정 적용`}
          disabled={stale || !chosen.length || missingMust}
          onPress={() => {
            const r = store.applyDraft(tripId, [...selected]);
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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Page>
        <Label>1 · 여행 조건</Label>
        <H>여행의 틀을 잡아요</H>
        <P>
          숙소·항공편·식사 시간을 고려해 빈 시간에 장소를 제안해요. 기존 일정과
          MUST는 옮기거나 지우지 않습니다.
        </P>
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
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
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
                      backgroundColor: c.pace === p.id ? "#DCE6D6" : ui.line,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ fontSize: 16, color: ui.ink }}>
                      {p.name}
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
                점심·저녁은 60분, 휴식은 30분을 비워요. 고정 일정과 겹치면
                제안에서 알려드려요.
              </P>
              <Label>주로 이용할 이동수단</Label>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[
                  { id: "walking" as const, name: "도보" },
                  { id: "transit" as const, name: "대중교통" },
                  { id: "driving" as const, name: "차" },
                ].map((m) => (
                  <Action
                    key={m.id}
                    title={`${c.mode === m.id ? "✓ " : ""}${m.name}`}
                    secondary
                    onPress={() => update("mode", m.id)}
                  />
                ))}
              </View>
              <Label>장소 사이 여유 · 분</Label>
              <Field
                accessibilityLabel="이동 여유 시간"
                value={String(c.buffer)}
                onChangeText={(v) => update("buffer", Number(v))}
                keyboardType="number-pad"
                maxLength={3}
              />
              <P>
                실제 이동 시간 계산값은 아니에요. 주소를 참고해 배치하고, 이동
                경로는 Google Maps에서 확인합니다.
              </P>
            </>,
          )}
          {panel(
            "stays",
            `숙소 ${c.stays.length}곳`,
            <>
              <P>
                날짜별 숙소를 하루 출발·귀가 기준으로 참고해요. 체크인/아웃은
                현지 시각입니다. 짐 보관 장소가 따로 있으면 요청에 적어 주세요.
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
                이 여행지의 현지 날짜·시각으로 입력하세요. 도착 후와 출발 전
                준비 시간을 비워 둡니다.
              </P>
              {c.flights.map((flight, index) => {
                const change = (field: string, value: string | number) =>
                  update(
                    "flights",
                    c.flights.map((f, i) =>
                      i === index ? { ...f, [field]: value } : f,
                    ),
                  );
                return (
                  <View key={flight.id} style={{ paddingVertical: 14 }}>
                    <Label>항공편 {index + 1}</Label>
                    <Action
                      title={
                        flight.kind === "arrival"
                          ? "여행지 도착편 · 눌러 출발편으로 변경"
                          : "여행지 출발편 · 눌러 도착편으로 변경"
                      }
                      secondary
                      onPress={() =>
                        change(
                          "kind",
                          flight.kind === "arrival" ? "departure" : "arrival",
                        )
                      }
                    />
                    <DateField
                      label={`항공편 ${index + 1} 날짜`}
                      value={flight.date}
                      onChange={(v) => change("date", v)}
                    />
                    <TimeInput
                      label={`항공편 ${index + 1} 시각`}
                      value={flight.time}
                      onChange={(v) => change("time", v)}
                    />
                    <Field
                      accessibilityLabel={`항공편 ${index + 1} 공항`}
                      placeholder="공항 이름 · 터미널 또는 주소"
                      value={flight.query}
                      onChangeText={(v) => change("query", v)}
                      maxLength={300}
                    />
                    <Label>도착 후 / 출발 전 여유 · 분</Label>
                    <Field
                      accessibilityLabel={`항공편 ${index + 1} 여유`}
                      value={String(flight.buffer)}
                      keyboardType="number-pad"
                      onChangeText={(v) => change("buffer", Number(v))}
                      maxLength={3}
                    />
                    <Action
                      title={`항공편 ${index + 1} 입력 삭제`}
                      secondary
                      onPress={() =>
                        update(
                          "flights",
                          c.flights.filter((_, i) => i !== index),
                        )
                      }
                    />
                  </View>
                );
              })}
              <Action
                title="＋ 항공편 추가"
                secondary
                onPress={() =>
                  update("flights", [
                    ...c.flights,
                    {
                      id: uid(),
                      kind: "arrival",
                      date: trip.start,
                      time: "10:00",
                      query: "",
                      buffer: 120,
                    },
                  ])
                }
              />
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
                    <Label>머무를 시간 · 분</Label>
                    <Field
                      accessibilityLabel={`고정 일정 ${index + 1} 체류`}
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
                      {c.selectedIds.includes(place.id) ? "☑" : "□"}{" "}
                      {place.name}
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
                      <Label>예상 체류 · 분</Label>
                      <Field
                        accessibilityLabel={`${place.name} 체류 시간`}
                        value={String(c.durations[place.id] || 60)}
                        keyboardType="number-pad"
                        onChangeText={(v) =>
                          update("durations", {
                            ...c.durations,
                            [place.id]: Number(v),
                          })
                        }
                        maxLength={3}
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
                title="가고 싶은 곳에서 위치 확인"
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/trip/[tripId]/candidates",
                    params: { tripId, section: "places" },
                  })
                }
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
        </View>
        <P>
          제안받기를 누르면 선택한 장소 이름·주소, 여행 조건과 기존 일정만 기존
          AI 서비스에 보내요. Instagram 원본 파일·캡션은 보내지 않습니다.
        </P>
        <P>
          영업시간·예약·날씨와 실제 이동 시간은 자동 확인하지 않아요. 제안을
          검토한 뒤에만 일정에 적용됩니다.
        </P>
        {!!error && (
          <Text
            accessibilityRole="alert"
            style={{
              color: "#A23C2B",
              fontSize: 16,
              lineHeight: 24,
              marginVertical: 12,
            }}
          >
            {error}
          </Text>
        )}
        {!active.length && (
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
          <>
            <ActivityIndicator accessibilityLabel="AI 일정 제안 생성 중" />
            <P>조건을 비교하고 있어요. 기존 일정은 아직 바뀌지 않았어요.</P>
            <Action
              title="제안 생성 취소"
              secondary
              onPress={() => controller.current?.abort()}
            />
          </>
        ) : (
          <>
            <Action
              title="조건 저장하고 AI 제안받기"
              disabled={!trip.days.length || !active.length}
              onPress={generate}
            />
            <Action
              title="조건만 저장"
              secondary
              onPress={() => {
                const r = store.savePlanning(tripId, c);
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
    </KeyboardAvoidingView>
  );
}
