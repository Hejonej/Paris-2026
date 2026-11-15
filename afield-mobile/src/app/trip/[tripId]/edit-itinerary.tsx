import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Animated,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Action, Field, Label, P, s } from "../../../ui";
import { Sheet } from "../../../sheet";
import { useTripParams } from "../../../route";
import { useTrips } from "../../../store";
import type { Day, Entry } from "../../../data";
import { dateLabel } from "../../../data";
import {
  editSnapshot,
  lockReason,
  reorderSlots,
  moveToDate,
  validateEdit,
} from "../../../manualEditing";
import { placeText } from "../../../placeText";
import { editHaptic } from "../../../haptics";
import { ui } from "../../../theme";
const HEIGHT = 88;
type DragEvent = PanResponderGestureState;
function DragRow({
  entry,
  index,
  locked,
  active,
  dy,
  offset,
  start,
  move,
  end,
  cancel,
  onTime,
  onMoveDate,
  onUp,
  onDown,
}: {
  entry: Entry;
  index: number;
  locked: string;
  active: boolean;
  dy: Animated.Value;
  offset: number;
  start: () => void;
  move: (g: DragEvent) => void;
  end: (g: DragEvent) => void;
  cancel: () => void;
  onTime: () => void;
  onMoveDate: () => void;
  onUp: () => void;
  onDown: () => void;
}) {
  const live = useRef({ start, move, end, cancel, locked });
  live.current = { start, move, end, cancel, locked };
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !live.current.locked,
      onMoveShouldSetPanResponder: () => !live.current.locked,
      onPanResponderGrant: () => live.current.start(),
      onPanResponderMove: (_, g) => live.current.move(g),
      onPanResponderRelease: (_, g) => live.current.end(g),
      onPanResponderTerminate: () => live.current.cancel(),
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;
  return (
    <Animated.View
      style={{
        height: HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderColor: ui.line,
        backgroundColor: active ? ui.blueSoft : ui.surface,
        zIndex: active ? 20 : 0,
        transform: active ? [{ translateY: Animated.add(dy, offset) }] : [],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${entry.name} 시간 수정`}
        disabled={!!locked}
        onPress={onTime}
        style={{ width: 52, minHeight: 44, justifyContent: "center" }}
      >
        <Text
          style={{
            fontSize: 15,
            fontWeight: "600",
            color: locked ? ui.muted : ui.blue,
            fontVariant: ["tabular-nums"],
          }}
        >
          {entry.time}
        </Text>
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={2}
          style={{
            fontSize: 15,
            lineHeight: 21,
            fontWeight: "600",
            color: ui.ink,
          }}
        >
          {placeText(entry.name)}
        </Text>
        {!!locked && (
          <Text style={{ fontSize: 11, color: ui.muted, marginTop: 3 }}>
            잠금 · {locked}
          </Text>
        )}
      </View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${entry.name} 순서 이동`}
        accessibilityState={{ disabled: !!locked }}
        accessibilityHint={
          locked || "위아래로 드래그. 날짜로 끌어 놓으면 날짜를 이동해요."
        }
        accessibilityActions={[
          { name: "increment", label: "다음 순서로" },
          { name: "decrement", label: "앞 순서로" },
        ]}
        onAccessibilityAction={(e) => {
          if (locked) return;
          e.nativeEvent.actionName === "increment" ? onDown() : onUp();
        }}
        {...responder.panHandlers}
        style={{
          width: 44,
          minHeight: 52,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 24, color: locked ? ui.line : ui.muted }}>
          {locked ? "▪" : "≡"}
        </Text>
      </View>
      {!locked && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${entry.name} 날짜 이동`}
          onPress={onMoveDate}
          style={{
            width: 44,
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 20, color: ui.muted }}>↗</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}
export default function EditItinerary() {
  const { tripId, date: initialDate, entryId: initialEntry } = useTripParams();
  const router = useRouter();
  const store = useTrips();
  const insets = useSafeAreaInsets();
  const trip = store.trips.find((t) => t.id === tripId);
  const [days, setDays] = useState<Day[]>(() => trip?.days || []);
  const [date, setDate] = useState(initialDate || trip?.days[0]?.date || "");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [active, setActive] = useState("");
  const [hoverDate, setHoverDate] = useState("");
  const [target, setTarget] = useState<{
    id: string;
    date: string;
    time: string;
  } | null>(null);
  const [review, setReview] = useState(false);
  const snapshot = useRef(trip ? editSnapshot(trip) : "");
  const initialized = useRef("");
  const focused = useRef(false);
  const saving = useRef(false);
  const dy = useRef(new Animated.Value(0)).current;
  const scroll = useRef<ScrollView>(null);
  const viewport = useRef<View>(null);
  const offset = useRef(0);
  const geometry = useRef({ top: 0, height: 0 });
  const dateViews = useRef<Record<string, View | null>>({});
  const rects = useRef<
    Record<string, { x: number; y: number; width: number; height: number }>
  >({});
  const drag = useRef<{
    id: string;
    origin: number;
    scrollStart: number;
    before: Day[];
    gesture?: DragEvent;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const model = useRef({ trip, days, date });
  model.current = { trip, days, date };
  useEffect(() => {
    if (store.ready && trip && initialized.current !== tripId) {
      initialized.current = tripId;
      snapshot.current = editSnapshot(trip);
      setDays(trip.days);
      setDate(
        trip.days.some((d) => d.date === initialDate)
          ? initialDate
          : trip.days[0]?.date || "",
      );
    }
  }, [store.ready, tripId]);
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );
  const day = days.find((d) => d.date === date);
  const activeIndex = day?.items.findIndex((e) => e.id === active) || 0;
  const original = (entry: Entry) => {
    const d = trip?.days.find((d) => d.items.some((e) => e.id === entry.id));
    return d
      ? lockReason(
          trip!,
          d.date,
          d.items.find((e) => e.id === entry.id)!,
        )
      : "";
  };
  function feedback(r: { ok: boolean; days: Day[]; message: string }) {
    if (r.ok) {
      setDays(r.days);
      model.current.days = r.days;
      setNotice(r.message);
      setError("");
    } else setError(r.message);
  }
  const hit = (g: DragEvent) =>
    Object.entries(rects.current).find(
      ([, r]) =>
        g.moveX >= r.x &&
        g.moveX <= r.x + r.width &&
        g.moveY >= r.y &&
        g.moveY <= r.y + r.height,
    )?.[0] || "";
  function updateDrag(g: DragEvent) {
    const d = drag.current,
      m = model.current;
    if (!d || !m.trip) return;
    d.gesture = g;
    dy.setValue(g.dy + offset.current - d.scrollStart);
    const over = hit(g);
    setHoverDate(over);
    if (over) return;
    const list = m.days.find((day) => day.date === m.date)?.items || [];
    const index = Math.max(
      0,
      Math.min(
        list.length - 1,
        Math.floor(
          d.origin + (g.dy + offset.current - d.scrollStart) / HEIGHT + 0.5,
        ),
      ),
    );
    const to = list[index];
    if (!to || to.id === d.id) return;
    const r = reorderSlots(m.trip, m.days, m.date, d.id, to.id);
    if (r.ok) {
      setDays(r.days);
      model.current.days = r.days;
    }
  }
  function begin(id: string, index: number) {
    editHaptic();
    setError("");
    setActive(id);
    dy.setValue(0);
    drag.current = {
      id,
      origin: index,
      scrollStart: offset.current,
      before: model.current.days,
    };
    Object.entries(dateViews.current).forEach(([d, v]) =>
      v?.measureInWindow((x, y, width, height) => {
        rects.current[d] = { x, y, width, height };
      }),
    );
    viewport.current?.measureInWindow((_, y, __, height) => {
      geometry.current = { top: y, height };
    });
    timer.current = setInterval(() => {
      const d = drag.current,
        g = d?.gesture,
        m = model.current;
      if (!d || !g) return;
      const { top, height } = geometry.current;
      if (!height || hit(g)) return;
      const direction =
        g.moveY < top + 48 ? -1 : g.moveY > top + height - 48 ? 1 : 0;
      if (!direction) return;
      const max = Math.max(
        0,
        (m.days.find((d) => d.date === m.date)?.items.length || 0) * HEIGHT -
          height,
      );
      const next = Math.max(0, Math.min(max, offset.current + direction * 10));
      if (next === offset.current) return;
      offset.current = next;
      scroll.current?.scrollTo({ y: next, animated: false });
      updateDrag(g);
    }, 32);
  }
  function finish(g?: DragEvent, cancel = false) {
    const d = drag.current,
      m = model.current;
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    if (d) {
      if (cancel) {
        setDays(d.before);
        model.current.days = d.before;
      } else if (g) {
        const to = hit(g);
        if (to && to !== m.date && m.trip) {
          const r = moveToDate(m.trip, d.before, d.id, to);
          feedback(r);
          if (r.ok) {
            setDate(to);
            offset.current = 0;
            scroll.current?.scrollTo({ y: 0, animated: false });
          } else {
            setDays(d.before);
            model.current.days = d.before;
            setTarget({ id: d.id, date: to, time: "" });
          }
        } else if (to === m.date) {
          setDays(d.before);
          model.current.days = d.before;
        }
      }
    }
    drag.current = null;
    setActive("");
    setHoverDate("");
    dy.setValue(0);
    if (!cancel) editHaptic();
  }
  const changes = days.flatMap((d) =>
    d.items.flatMap((e) => {
      const old = trip?.days.flatMap((day) =>
        day.items
          .filter((o) => o.id === e.id)
          .map((entry) => ({ date: day.date, entry })),
      )[0];
      return old && (old.date !== d.date || old.entry.time !== e.time)
        ? [
            {
              entry: e,
              from: old.date + " " + old.entry.time,
              to: d.date + " " + e.time,
            },
          ]
        : [];
    }),
  );
  const validation = trip
    ? validateEdit(trip, days)
    : "여행을 불러오는 중이에요.";
  if (!trip || !store.ready)
    return (
      <View style={{ padding: 20 }}>
        <P>일정을 불러오는 중이에요.</P>
      </View>
    );
  function measureDates() {
    Object.entries(dateViews.current).forEach(([d, v]) =>
      v?.measureInWindow((x, y, width, height) => {
        rects.current[d] = { x, y, width, height };
      }),
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: ui.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
        <Label>수동 편집 · 저장 전까지 원래 일정 유지</Label>
        <P>
          ≡를 끌어 순서를 바꾸거나 위 날짜에 놓으세요. 시간을 눌러 직접 수정할
          수도 있어요.
        </P>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={measureDates}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
        >
          {days.map((d) => (
            <Pressable
              key={d.date}
              ref={(v) => {
                dateViews.current[d.date] = v;
              }}
              onLayout={measureDates}
              accessibilityRole="button"
              accessibilityState={{ selected: d.date === date }}
              accessibilityLabel={dateLabel(d.date)}
              onPress={() => {
                setDate(d.date);
                offset.current = 0;
                scroll.current?.scrollTo({ y: 0, animated: false });
              }}
              style={{
                minHeight: 56,
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: hoverDate === d.date ? ui.blue : ui.line,
                backgroundColor: date === d.date ? ui.ink : ui.surface,
              }}
            >
              <Text
                style={{
                  color: date === d.date ? "white" : ui.ink,
                  fontSize: 14,
                }}
              >
                {d.date.slice(5).replace("-", "/")}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        {!!error && (
          <Text
            accessibilityRole="alert"
            style={{ color: ui.danger, lineHeight: 21, marginBottom: 8 }}
          >
            {error}
          </Text>
        )}
        {!!notice && (
          <Text
            accessibilityLiveRegion="polite"
            style={{
              color: ui.muted,
              fontSize: 13,
              lineHeight: 20,
              marginBottom: 8,
            }}
          >
            {notice}
          </Text>
        )}
      </View>
      <View
        ref={viewport}
        style={{ flex: 1 }}
        onLayout={() =>
          viewport.current?.measureInWindow((_, top, __, height) => {
            geometry.current = { top, height };
            if (initialEntry && !active && !focused.current) {
              const i =
                day?.items.findIndex((e) => e.id === initialEntry) ?? -1;
              if (i >= 0) {
                scroll.current?.scrollTo({ y: i * HEIGHT, animated: false });
                focused.current = true;
              }
            }
          })
        }
      >
        <ScrollView
          ref={scroll}
          scrollEnabled={!active}
          onScroll={(e) => {
            offset.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          {day?.items.map((entry, index) => (
            <DragRow
              key={entry.id}
              entry={entry}
              index={index}
              locked={original(entry)}
              active={active === entry.id}
              dy={dy}
              offset={
                (drag.current?.origin || 0) * HEIGHT - activeIndex * HEIGHT
              }
              start={() => begin(entry.id, index)}
              move={updateDrag}
              end={(g) => finish(g)}
              cancel={() => finish(undefined, true)}
              onTime={() => setTarget({ id: entry.id, date, time: entry.time })}
              onMoveDate={() =>
                setTarget({ id: entry.id, date, time: entry.time })
              }
              onUp={() => {
                const prev = day.items
                  .slice(0, index)
                  .reverse()
                  .find((e) => !original(e));
                if (prev)
                  feedback(reorderSlots(trip, days, date, entry.id, prev.id));
              }}
              onDown={() => {
                const next = day.items
                  .slice(index + 1)
                  .find((e) => !original(e));
                if (next)
                  feedback(reorderSlots(trip, days, date, entry.id, next.id));
              }}
            />
          ))}
          {!day?.items.length && (
            <View style={{ padding: 20 }}>
              <P>
                이 날짜에 옮겨올 장소를 다른 날짜에서 끌어 놓거나 날짜 이동
                버튼으로 선택해 주세요.
              </P>
            </View>
          )}
        </ScrollView>
      </View>
      <View
        style={{
          padding: 16,
          paddingBottom: Math.max(insets.bottom, 16),
          borderTopWidth: 1,
          borderColor: ui.line,
          backgroundColor: ui.surface,
        }}
      >
        {!!validation && (
          <Text style={{ color: ui.danger, fontSize: 13, lineHeight: 20 }}>
            {validation}
          </Text>
        )}
        <Action
          title={`변경 ${changes.length}개 확인`}
          tone="primary"
          disabled={!changes.length || !!active || !!validation}
          onPress={() => setReview(true)}
        />
        <Action
          title="취소하고 일정으로"
          tone="link"
          onPress={() =>
            router.dismissTo({
              pathname: "/trip/[tripId]/itinerary",
              params: { tripId, date: initialDate },
            })
          }
        />
      </View>
      <Sheet
        visible={!!target}
        title="날짜와 시간 이동"
        onClose={() => setTarget(null)}
      >
        {target && (
          <>
            <Label>옮길 날짜</Label>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {days.map((d) => (
                <Pressable
                  key={d.date}
                  accessibilityRole="button"
                  accessibilityState={{ selected: d.date === target.date }}
                  onPress={() =>
                    setTarget({ ...target, date: d.date, time: "" })
                  }
                  style={{
                    minHeight: 44,
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor:
                      d.date === target.date ? ui.blueSoft : ui.subtle,
                  }}
                >
                  <Text>{dateLabel(d.date)}</Text>
                </Pressable>
              ))}
            </View>
            <Label>시간 · 비우면 빈 시간 제안</Label>
            <Field
              accessibilityLabel="옮길 방문 시간"
              value={target.time}
              onChangeText={(time) => setTarget({ ...target, time })}
              placeholder="HH:MM"
              maxLength={5}
              keyboardType="numbers-and-punctuation"
            />
            <Action
              title="편집안에 반영"
              tone="primary"
              onPress={() => {
                const r = moveToDate(
                  trip,
                  days,
                  target.id,
                  target.date,
                  target.time || undefined,
                );
                feedback(r);
                if (r.ok) {
                  setDate(target.date);
                  setTarget(null);
                }
              }}
            />
          </>
        )}
      </Sheet>
      <Sheet
        visible={review}
        title="바뀌는 일정 확인"
        onClose={() => setReview(false)}
      >
        <P>아래 날짜·시간만 변경해요. 장소 정보·태그·출처·기록은 그대로예요.</P>
        {changes.map((c) => (
          <View
            key={c.entry.id}
            style={{
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderColor: ui.line,
            }}
          >
            <Text style={s.title}>{placeText(c.entry.name)}</Text>
            <Text
              style={{
                fontSize: 13,
                lineHeight: 21,
                color: ui.muted,
                marginTop: 8,
              }}
            >
              {c.from} → {c.to}
            </Text>
          </View>
        ))}
        <P>
          실제 이동 시간은 계산하지 않았어요. 저장 후 구간 경로를 확인하세요.
        </P>
        <Action
          title="변경사항 저장"
          tone="primary"
          disabled={saving.current || !!validation}
          onPress={() => {
            if (saving.current) return;
            const r = store.applyManualEdit(tripId, days, snapshot.current);
            if (!r.ok) {
              setError(r.message);
              setReview(false);
              return;
            }
            saving.current = true;
            router.dismissTo({
              pathname: "/trip/[tripId]/itinerary",
              params: { tripId, date, manualEdited: "1" },
            });
          }}
        />
      </Sheet>
    </View>
  );
}
