import { reservedMinutes } from "./visitTiming";
import type { Trip, Day, Entry } from "./data";
import { minutes, clock } from "./planner";
import { legKey } from "./routing";
export const editSnapshot = (trip: Trip) =>
  JSON.stringify({
    days: trip.days,
    conditions: trip.planning,
    records: trip.journal?.map((r) => [r.entryId, r.date]),
  });
export function lockReason(trip: Trip, date: string, entry: Entry): string {
  if (entry.visitedOn) return "다녀온 장소 보호";
  if (entry.must) return "꼭 갈 곳 보호";
  if (entry.anchorKey) return "고정 시간 보호";
  if (trip.journal?.some((r) => r.entryId === entry.id)) return "기록 연결됨";
  if (
    trip.planning?.fixed.some(
      (r) => r.date === date && r.time === entry.time && r.name === entry.name,
    )
  )
    return "예약 보호";
  return "";
}
const locate = (days: Day[], id: string) =>
  days.flatMap((d) =>
    d.items
      .filter((e) => e.id === id)
      .map((entry) => ({ date: d.date, entry })),
  )[0];
export function reorderSlots(
  trip: Trip,
  days: Day[],
  date: string,
  fromId: string,
  toId: string,
) {
  const day = days.find((d) => d.date === date);
  if (!day) return { ok: false, days, message: "날짜를 찾을 수 없어요." };
  const movable = day.items.filter((e) => !lockReason(trip, date, e));
  const from = movable.findIndex((e) => e.id === fromId),
    to = movable.findIndex((e) => e.id === toId);
  if (from < 0 || to < 0)
    return {
      ok: false,
      days,
      message: "예약·꼭 갈 곳·기록 연결 일정은 이동하지 않아요.",
    };
  const slots = movable.map((e) => e.time);
  const order = [...movable];
  const [item] = order.splice(from, 1);
  order.splice(to, 0, item);
  const changed = new Map(
    order.map((e, i) => [e.id, { ...e, time: slots[i] }]),
  );
  return {
    ok: true,
    message: "방문 시간 자리를 교환했어요. 저장 전 시간을 확인하세요.",
    days: days.map((d) =>
      d.date === date
        ? {
            ...d,
            items: d.items
              .map((e) => changed.get(e.id) || e)
              .sort((a, b) => a.time.localeCompare(b.time)),
          }
        : d,
    ),
  };
}
export function moveToDate(
  trip: Trip,
  days: Day[],
  entryId: string,
  targetDate: string,
  time?: string,
) {
  const source = locate(days, entryId),
    target = days.find((d) => d.date === targetDate);
  if (!source || !target)
    return { ok: false, days, message: "이동할 장소와 날짜를 확인해 주세요." };
  if (lockReason(trip, source.date, source.entry))
    return {
      ok: false,
      days,
      message: "예약·꼭 갈 곳·기록 연결 일정은 이동하지 않아요.",
    };
  const duration = reservedMinutes(source.entry, trip, source.date);
  const blocks = target.items.filter((e) => e.id !== entryId);
  let chosen = time;
  if (chosen === undefined) {
    const start = minutes(trip.planning?.start || "09:00"),
      end = minutes(trip.planning?.end || "20:00");
    const buffer = trip.planning?.buffer || 0;
    for (let t = start; t + duration <= end; t += 15)
      if (
        !blocks.some(
          (e) =>
            t === minutes(e.time) ||
            (t <
              minutes(e.time) + reservedMinutes(e, trip, targetDate) + buffer &&
              t + duration > minutes(e.time) - buffer),
        )
      ) {
        chosen = clock(t);
        break;
      }
  }
  if (
    !chosen ||
    !Number.isFinite(minutes(chosen)) ||
    minutes(chosen) + duration > 1440
  )
    return {
      ok: false,
      days,
      message: "빈 시간 자리를 찾지 못했어요. 시간을 직접 정해 주세요.",
    };
  const moved = { ...source.entry, time: chosen };
  return {
    ok: true,
    message: `${targetDate} ${chosen}로 옮길 예정이에요.`,
    days: days.map((d) => ({
      ...d,
      items: [
        ...d.items.filter((e) => e.id !== entryId),
        ...(d.date === targetDate ? [moved] : []),
      ].sort((a, b) => a.time.localeCompare(b.time)),
    })),
  };
}
export function validateEdit(trip: Trip, days: Day[]): string {
  if (
    days.length !== trip.days.length ||
    new Set(days.map((d) => d.date)).size !== days.length ||
    days.some((d) => !trip.days.some((o) => o.date === d.date))
  )
    return "여행 날짜는 정보 수정에서 변경해 주세요.";
  const old = trip.days.flatMap((d) =>
    d.items.map((entry) => ({ date: d.date, entry })),
  );
  const all = days.flatMap((d) =>
    d.items.map((entry) => ({ date: d.date, entry })),
  );
  if (
    old.length !== all.length ||
    new Set(all.map((r) => r.entry.id)).size !== all.length ||
    all.some((r) => !old.some((o) => o.entry.id === r.entry.id))
  )
    return "장소가 빠지거나 중복됐어요. 다시 편집해 주세요.";
  const changed = new Set<string>();
  for (const r of all) {
    const original = old.find((o) => o.entry.id === r.entry.id)!;
    const { time: _, ...a } = original.entry,
      { time: __, ...b } = r.entry;
    if (JSON.stringify(a) !== JSON.stringify(b))
      return "장소 정보와 태그는 그대로 보존해야 해요.";
    if (
      !Number.isFinite(minutes(r.entry.time)) ||
      minutes(r.entry.time) + reservedMinutes(r.entry, trip, r.date) > 1440
    )
      return "방문 시간을 확인해 주세요.";
    if (original.date !== r.date || original.entry.time !== r.entry.time) {
      if (lockReason(trip, original.date, original.entry))
        return `${original.entry.name}: 잠긴 일정은 이동할 수 없어요.`;
      changed.add(r.entry.id);
    }
  }
  for (const day of days) {
    for (let i = 0; i < day.items.length; i++)
      for (let j = i + 1; j < day.items.length; j++) {
        const a = day.items[i],
          b = day.items[j];
        if (!changed.has(a.id) && !changed.has(b.id)) continue;
        if (
          (a.placeId || a.location?.placeId) &&
          (a.placeId || a.location?.placeId) ===
            (b.placeId || b.location?.placeId)
        )
          return `${day.date}: 같은 장소가 두 번 배치돼요.`;
        if (
          a.time === b.time ||
          (minutes(a.time) <
            minutes(b.time) + reservedMinutes(b, trip, day.date) &&
            minutes(a.time) + reservedMinutes(a, trip, day.date) >
              minutes(b.time))
        )
          return `${day.date}: ${a.name}와 ${b.name}의 시간이 겹쳐요.`;
      }
  }
  return "";
}
export function applyManualEdit(
  trips: Trip[],
  tripId: string,
  days: Day[],
  snapshot: string,
) {
  const trip = trips.find((t) => t.id === tripId && !t.deletedAt);
  const fail = (message: string) => ({ trips, ok: false, message });
  if (!trip || editSnapshot(trip) !== snapshot)
    return fail(
      "편집 중 일정이나 조건이 바뀌었어요. 최신 일정에서 다시 시작해 주세요.",
    );
  const error = validateEdit(trip, days);
  if (error) return fail(error);
  const knownModes = new Map(
    trip.days.flatMap((d) => Object.entries(d.travelModes || {})),
  );
  const next = days.map((d) => {
    const modes: NonNullable<Day["travelModes"]> = {};
    d.items.slice(0, -1).forEach((e, i) => {
      const key = legKey(e.id, d.items[i + 1].id);
      const mode = knownModes.get(key);
      if (mode) modes[key] = mode;
    });
    return { ...d, travelModes: Object.keys(modes).length ? modes : undefined };
  });
  return {
    ok: true,
    message: "수동 편집을 저장했어요.",
    trips: trips.map((t) =>
      t.id === tripId ? { ...t, days: next, planDraft: undefined } : t,
    ),
  };
}
