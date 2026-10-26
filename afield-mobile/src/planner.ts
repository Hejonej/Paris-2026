import { legKey } from "./routing";
import { tripPlaces } from "./data";
import type { Trip, Entry, ActivityTag } from "./data";
import { inferActivity } from "./activities";
import { validDate } from "./tripEditing";
export type Stay = {
  id: string;
  name: string;
  query: string;
  checkIn: string;
  checkOut: string;
  inTime: string;
  outTime: string;
};
export type Flight = {
  id: string;
  kind: "arrival" | "departure";
  date: string;
  time: string;
  query: string;
  buffer: number;
};
export type FixedEvent = {
  id: string;
  name: string;
  date: string;
  time: string;
  duration: number;
  query: string;
};
export type PlanningConditions = {
  rangeStart?: string;
  rangeEnd?: string;
  pace: "relaxed" | "balanced" | "active";
  mode: "walking" | "transit" | "driving";
  start: string;
  end: string;
  lunch: string;
  dinner: string;
  rest: string;
  buffer: number;
  selectedIds: string[];
  mustIds: string[];
  durations: Record<string, number>;
  stays: Stay[];
  flights: Flight[];
  fixed: FixedEvent[];
  notes: string;
};
export type PlanRow = {
  id: string;
  date: string;
  time: string;
  duration: number;
  kind: "place" | "meal" | "rest" | "stay" | "flight" | "fixed";
  name: string;
  query?: string;
  placeId?: string;
  reason: string;
  tag: ActivityTag;
};
export type PlanDraft = {
  id: string;
  generatedAt: string;
  baseSnapshot: string;
  rows: PlanRow[];
  anchors: PlanRow[];
  issues: string[];
  unplaced: { id: string; name: string; reason: string }[];
};
export const minutes = (time: string) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
    ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
    : NaN;
export const clock = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
export function readyPlaces(trip: Trip) {
  return tripPlaces(trip).filter(
    (p) =>
      trip.candidates.includes(p.id) &&
      ("matchStatus" in p
        ? p.matchStatus === "confirmed"
        : /paris|파리/i.test(trip.city)),
  );
}
export function defaultConditions(trip: Trip): PlanningConditions {
  const available = readyPlaces(trip).filter(
    (p) =>
      !trip.days.some((d) =>
        d.items.some((e) => (e.placeId || e.location?.placeId) === p.id),
      ),
  );
  return {
    rangeStart: trip.start,
    rangeEnd: trip.end,
    pace: "balanced",
    mode: "walking",
    start: "09:00",
    end: "20:00",
    lunch: "12:30",
    dinner: "18:30",
    rest: "16:30",
    buffer: 30,
    selectedIds: available.length > 100 ? [] : available.map((p) => p.id),
    mustIds: [],
    durations: {},
    stays: [],
    flights: [],
    fixed: [],
    notes: "",
  };
}
export function validConditions(c: unknown): c is PlanningConditions {
  if (!c || typeof c !== "object") return false;
  const x = c as PlanningConditions;
  return (
    (x.rangeStart === undefined ||
      (typeof x.rangeStart === "string" && validDate(x.rangeStart))) &&
    (x.rangeEnd === undefined ||
      (typeof x.rangeEnd === "string" && validDate(x.rangeEnd))) &&
    ["relaxed", "balanced", "active"].includes(x.pace) &&
    ["walking", "transit", "driving"].includes(x.mode) &&
    [x.start, x.end, x.lunch, x.dinner, x.rest].every(
      (t) => typeof t === "string" && Number.isFinite(minutes(t)),
    ) &&
    Number.isInteger(x.buffer) &&
    x.buffer >= 0 &&
    x.buffer <= 180 &&
    [x.selectedIds, x.mustIds].every(
      (a) =>
        Array.isArray(a) &&
        a.length <= 100 &&
        a.every((v) => typeof v === "string"),
    ) &&
    typeof x.notes === "string" &&
    x.notes.length <= 1000 &&
    !!x.durations &&
    typeof x.durations === "object" &&
    !Array.isArray(x.durations) &&
    Object.entries(x.durations).every(
      ([k, v]) => k.length <= 200 && Number.isInteger(v) && v >= 15 && v <= 240,
    ) &&
    Array.isArray(x.stays) &&
    x.stays.length <= 30 &&
    x.stays.every(
      (s) =>
        s &&
        [
          s.id,
          s.name,
          s.query,
          s.checkIn,
          s.checkOut,
          s.inTime,
          s.outTime,
        ].every((v) => typeof v === "string" && v.length <= 300) &&
        validDate(s.checkIn) &&
        validDate(s.checkOut) &&
        Number.isFinite(minutes(s.inTime)) &&
        Number.isFinite(minutes(s.outTime)),
    ) &&
    Array.isArray(x.flights) &&
    x.flights.length <= 30 &&
    x.flights.every(
      (f) =>
        f &&
        [f.id, f.date, f.time, f.query].every(
          (v) => typeof v === "string" && v.length <= 300,
        ) &&
        ["arrival", "departure"].includes(f.kind) &&
        validDate(f.date) &&
        Number.isFinite(minutes(f.time)) &&
        Number.isInteger(f.buffer) &&
        f.buffer >= 30 &&
        f.buffer <= 360,
    ) &&
    Array.isArray(x.fixed) &&
    x.fixed.length <= 100 &&
    x.fixed.every(
      (f) =>
        f &&
        [f.id, f.name, f.date, f.time, f.query].every(
          (v) => typeof v === "string" && v.length <= 300,
        ) &&
        validDate(f.date) &&
        Number.isFinite(minutes(f.time)) &&
        Number.isInteger(f.duration) &&
        f.duration >= 15 &&
        f.duration <= 600,
    )
  );
}
export function conditionsError(trip: Trip, c: PlanningConditions) {
  if (!validConditions(c))
    return "입력한 시간과 여행 조건을 다시 확인해 주세요.";
  if (minutes(c.start) >= minutes(c.end))
    return "하루 종료 시간은 시작 시간보다 늦어야 해요.";
  const dates = new Set(trip.days.map((d) => d.date));
  if (!dates.size) return "먼저 여행 날짜를 정해 주세요.";
  if (
    !dates.has(c.rangeStart || trip.start) ||
    !dates.has(c.rangeEnd || trip.end) ||
    (c.rangeStart || trip.start) > (c.rangeEnd || trip.end)
  )
    return "제안받을 기간은 여행 날짜 안에서 선택해 주세요.";
  if (
    new Set(c.selectedIds).size !== c.selectedIds.length ||
    new Set(c.mustIds).size !== c.mustIds.length
  )
    return "같은 장소를 중복 선택할 수 없어요.";
  if (c.mustIds.some((id) => !c.selectedIds.includes(id)))
    return "필수 장소는 제안할 장소 목록에도 선택해 주세요.";
  const ready = new Set(readyPlaces(trip).map((p) => p.id));
  if (c.selectedIds.some((id) => !ready.has(id)))
    return "위치가 확인된 저장 장소만 선택할 수 있어요.";
  if (
    c.stays.some(
      (s) =>
        !s.name.trim() ||
        !s.query.trim() ||
        !dates.has(s.checkIn) ||
        !dates.has(s.checkOut) ||
        s.checkIn >= s.checkOut,
    )
  )
    return "숙소 이름·주소와 체크인/체크아웃 날짜를 확인해 주세요. 숙박 기간은 여행 날짜 안이어야 해요.";
  const stays = [...c.stays].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  if (stays.some((s, i) => i > 0 && s.checkIn < stays[i - 1].checkOut))
    return "숙소의 숙박 날짜가 겹쳐요. 체크아웃 날짜와 다음 체크인 날짜를 확인해 주세요.";
  if (c.flights.some((f) => !dates.has(f.date) || !f.query.trim()))
    return "항공편의 현지 날짜와 공항을 입력해 주세요.";
  if (
    c.fixed.some(
      (f) =>
        !dates.has(f.date) ||
        !f.name.trim() ||
        minutes(f.time) + f.duration > 1440,
    )
  )
    return "예약 일정의 날짜·이름·시간을 확인해 주세요.";
  const ids = [...c.stays, ...c.flights, ...c.fixed].map((x) => x.id);
  if (new Set(ids).size !== ids.length)
    return "같은 고정 일정을 중복 입력할 수 없어요.";
  return "";
}
export const planningSnapshot = (trip: Trip) =>
  JSON.stringify({
    city: trip.city,
    country: trip.country,
    start: trip.start,
    end: trip.end,
    days: trip.days,
    conditions: trip.planning,
    places: readyPlaces(trip).map((p) => ({
      id: p.id,
      name: p.name,
      query: p.query,
      category: p.category,
    })),
  });
const overlaps = (a: number, b: number, c: number, d: number) => a < d && c < b;
export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function dayBase(trip: Trip, c: PlanningConditions, date: string) {
  const issues: string[] = [];
  const anchors: PlanRow[] = [];
  if (date < localToday())
    return {
      date,
      start: 0,
      end: 0,
      anchors,
      issues,
      hardIssues: [] as string[],
      origin: undefined as { name: string; query: string } | undefined,
      destination: undefined as { name: string; query: string } | undefined,
    };
  let start = minutes(c.start),
    end = minutes(c.end);
  const existing = trip.days.find((d) => d.date === date)?.items || [];
  const add = (row: PlanRow, soft = false) => {
    const t = minutes(row.time);
    if (
      existing.some(
        (e) =>
          e.anchorKey === row.id &&
          e.time === row.time &&
          e.durationMinutes === row.duration,
      )
    )
      return;
    const pad = soft ? c.buffer : 0;
    const conflict =
      existing.some((e) =>
        overlaps(
          t,
          t + row.duration,
          minutes(e.time) - pad,
          minutes(e.time) + (e.durationMinutes || 60) + pad,
        ),
      ) ||
      anchors.some((e) =>
        overlaps(
          t,
          t + row.duration,
          minutes(e.time) - pad,
          minutes(e.time) + e.duration + pad,
        ),
      );
    if (conflict) {
      issues.push(
        `${date} ${row.name}: ${soft ? "고정 일정과 겹쳐 시간을 비워 두었어요." : "기존 일정 또는 다른 고정 조건과 겹쳐요."}`,
      );
      if (soft) return;
    }
    anchors.push(row);
  };
  const epoch = (d: string) => Date.parse(d + "T00:00:00Z") / 60000;
  const stamp = (d: string, t: string) => epoch(d) + minutes(t);
  const addAt = (
    row: Omit<PlanRow, "time" | "duration">,
    absolute: number,
    duration: number,
  ) => {
    const t = absolute - epoch(date);
    if (t < 1440 && t + duration > 0)
      add({
        ...row,
        id: `${row.id}-${date}`,
        time: clock(Math.max(0, t)),
        duration: Math.min(1440, t + duration) - Math.max(0, t),
      });
  };
  const arrivalDates = c.flights
    .filter((f) => f.kind === "arrival")
    .map((f) => f.date)
    .sort();
  const departureDates = c.flights
    .filter((f) => f.kind === "departure")
    .map((f) => f.date)
    .sort();
  if (arrivalDates.length && date < arrivalDates[0]) end = 0;
  if (departureDates.length && date > departureDates[departureDates.length - 1])
    end = 0;
  c.flights.forEach((f) => {
    const absolute = stamp(f.date, f.time);
    const t = absolute - epoch(date);
    const a = f.kind === "arrival" ? t : t - f.buffer;
    const b = f.kind === "arrival" ? t + f.buffer : t + 30;
    if (f.kind === "arrival" && f.date === date) start = Math.max(start, b);
    if (f.kind === "departure" && f.date === date) end = Math.min(end, a);
    if (a < 1440 && b > 0) {
      if (f.kind === "arrival" && f.date < date) start = Math.max(start, b);
      if (f.kind === "departure" && f.date > date) end = Math.min(end, a);
      addAt(
        {
          id: `flight-${f.id}`,
          date,
          kind: "flight",
          name:
            f.kind === "arrival"
              ? `도착 · ${f.time} 항공편`
              : `출발 준비 · ${f.time} 항공편`,
          query: f.query,
          reason: `입력한 현지 시각 · ${f.buffer}분 여유 (실제 이동 시간 아님)`,
          tag: "transport",
        },
        f.kind === "arrival" ? absolute : absolute - f.buffer,
        f.kind === "arrival" ? f.buffer : f.buffer + 30,
      );
    }
  });
  c.stays.forEach((stay) => {
    let checkIn = stamp(stay.checkIn, stay.inTime);
    let checkOut = stamp(stay.checkOut, stay.outTime);
    const arrival = c.flights
      .filter(
        (f) =>
          f.kind === "arrival" &&
          f.date >= stay.checkIn &&
          f.date < stay.checkOut,
      )
      .sort((a, b) => stamp(a.date, a.time) - stamp(b.date, b.time))[0];
    const departure = c.flights
      .filter((f) => f.kind === "departure" && f.date === stay.checkOut)
      .sort((a, b) => stamp(a.date, a.time) - stamp(b.date, b.time))[0];
    if (arrival)
      checkIn = Math.max(
        checkIn,
        stamp(arrival.date, arrival.time) + arrival.buffer + c.buffer,
      );
    if (departure)
      checkOut = Math.min(
        checkOut,
        stamp(departure.date, departure.time) -
          departure.buffer -
          c.buffer -
          30,
      );
    if (checkOut < checkIn + 30) {
      if (date === stay.checkIn)
        issues.push(
          `${date} ${stay.name}: 항공편과 숙박 시간 사이에 체크인·아웃할 여유가 없어요.`,
        );
      return;
    }
    addAt(
      {
        id: `in-${stay.id}`,
        date,
        kind: "stay",
        name: `체크인 · ${stay.name}`,
        query: stay.query,
        reason: `체크인 가능 ${stay.inTime} 이후 · 도착편 여유 반영, 수속 30분 가정`,
        tag: "stay",
      },
      checkIn,
      30,
    );
    addAt(
      {
        id: `out-${stay.id}`,
        date,
        kind: "stay",
        name: `체크아웃 · ${stay.name}`,
        query: stay.query,
        reason: `마감 ${stay.outTime} 이내 · 출발편 여유 반영, 짐 보관은 별도 확인`,
        tag: "stay",
      },
      checkOut,
      30,
    );
  });
  c.fixed
    .filter((f) => f.date === date)
    .forEach((f) =>
      add({
        id: `fixed-${f.id}`,
        date,
        time: f.time,
        duration: f.duration,
        kind: "fixed",
        name: f.name,
        query: f.query || undefined,
        reason: "직접 입력한 예약·고정 일정",
        tag: "other",
      }),
    );
  const hardIssues = [...issues];
  [
    {
      name: "점심",
      time: c.lunch,
      duration: 60,
      kind: "meal" as const,
      tag: "meal" as const,
    },
    {
      name: "저녁",
      time: c.dinner,
      duration: 60,
      kind: "meal" as const,
      tag: "meal" as const,
    },
    {
      name: "휴식",
      time: c.rest,
      duration: 30,
      kind: "rest" as const,
      tag: "cafe" as const,
    },
  ].forEach((a) => {
    const t = minutes(a.time);
    if (t < start || t + a.duration > end) {
      issues.push(
        `${date} ${a.name}: 하루 활동/항공편 시간 밖이라 배치하지 않았어요.`,
      );
      return;
    }
    add(
      {
        ...a,
        id: `${a.name}-${date}`,
        date,
        reason: "선호 시간에 확보한 자리 · 실제 장소는 아직 미정",
      },
      true,
    );
  });
  const origin = c.stays.find((s) => s.checkIn < date && s.checkOut >= date);
  const destination = c.stays.find(
    (s) => s.checkIn <= date && s.checkOut > date,
  );
  return {
    date,
    start,
    end,
    anchors,
    issues,
    hardIssues,
    origin: c.flights.some((f) => f.kind === "arrival" && f.date === date)
      ? {
          name: "도착 공항",
          query: c.flights.find((f) => f.kind === "arrival" && f.date === date)!
            .query,
        }
      : origin
        ? { name: origin.name, query: origin.query }
        : undefined,
    destination: c.flights.some(
      (f) =>
        f.kind === "departure" &&
        stamp(f.date, f.time) - f.buffer < epoch(date) + 1440 &&
        stamp(f.date, f.time) + 30 > epoch(date),
    )
      ? {
          name: "출발 공항",
          query: c.flights.find(
            (f) =>
              f.kind === "departure" &&
              stamp(f.date, f.time) - f.buffer < epoch(date) + 1440 &&
              stamp(f.date, f.time) + 30 > epoch(date),
          )!.query,
        }
      : destination
        ? { name: destination.name, query: destination.query }
        : undefined,
  };
}
export function validateRows(
  trip: Trip,
  c: PlanningConditions,
  rows: PlanRow[],
) {
  const accepted: PlanRow[] = [];
  const issues: string[] = [];
  const bases = trip.days
    .filter(
      (d) =>
        d.date >= (c.rangeStart || trip.start) &&
        d.date <= (c.rangeEnd || trip.end),
    )
    .map((d) => dayBase(trip, c, d.date));
  const used = new Set(
    trip.days.flatMap((d) =>
      d.items.flatMap((e) =>
        e.placeId || e.location?.placeId
          ? [e.placeId || e.location!.placeId!]
          : [],
      ),
    ),
  );
  const pool = new Map(readyPlaces(trip).map((p) => [p.id, p]));
  for (const row of rows) {
    const p = pool.get(row.placeId || "");
    const base = bases.find((b) => b.date === row.date);
    const t = minutes(row.time);
    let reason = "";
    if (row.kind !== "place" || !p || !c.selectedIds.includes(p.id))
      reason = "선택하지 않았거나 위치가 확인되지 않은 장소";
    else if (
      !base ||
      !Number.isFinite(t) ||
      !Number.isInteger(row.duration) ||
      row.duration < 15 ||
      row.duration > 240 ||
      row.duration !== (c.durations[row.placeId!] || 60)
    )
      reason = "날짜·시간·체류 시간 오류";
    else if (t < base.start || t + row.duration > base.end)
      reason = "하루 활동/항공편 가능 시간 밖";
    else if (used.has(p.id)) reason = "이미 일정에 있거나 중복된 장소";
    else {
      const tag = inferActivity(p.name, p.category);
      const replaceable = base.anchors.find(
        (a) =>
          a.time === row.time &&
          ((a.kind === "meal" && tag === "meal") ||
            (a.kind === "rest" && tag === "cafe")) &&
          row.duration <= a.duration,
      );
      const busy = [
        ...(trip.days.find((d) => d.date === row.date)?.items || []).map(
          (e) => ({ time: e.time, duration: e.durationMinutes || 60 }),
        ),
        ...base.anchors.filter((a) => a.id !== replaceable?.id),
        ...accepted.filter((a) => a.date === row.date),
      ];
      const count =
        (trip.days
          .find((d) => d.date === row.date)
          ?.items.filter(
            (e) =>
              !e.anchorKey &&
              !["stay", "transport"].includes(e.tag || inferActivity(e.name)),
          ).length || 0) + accepted.filter((a) => a.date === row.date).length;
      if (tag === "meal" && !replaceable)
        reason = "식사 장소는 확보한 점심/저녁 시간에 배치해 주세요";
      else if (count >= { relaxed: 3, balanced: 5, active: 7 }[c.pace])
        reason = "선택한 여행 속도의 하루 방문 수 초과";
      else if (
        busy.some((b) =>
          overlaps(
            t,
            t + row.duration,
            minutes(b.time) - c.buffer,
            minutes(b.time) + b.duration + c.buffer,
          ),
        )
      )
        reason = "기존 일정·고정 조건·이동 여유 시간과 겹침";
    }
    if (reason) issues.push(`${row.name}: ${reason}`);
    else {
      accepted.push({
        ...row,
        name: p!.name,
        query: p!.query,
        tag: inferActivity(p!.name, p!.category),
      });
      used.add(p!.id);
    }
  }
  return { accepted, issues, bases };
}
export function savePlanning(trips: Trip[], id: string, c: PlanningConditions) {
  const trip = trips.find((t) => t.id === id && !t.deletedAt);
  const error = trip ? conditionsError(trip, c) : "여행을 찾을 수 없어요.";
  if (error) return { trips, ok: false, message: error };
  return {
    trips: trips.map((t) =>
      t.id === id
        ? {
            ...t,
            planning: c,
            planDraft:
              JSON.stringify(t.planning) === JSON.stringify(c)
                ? t.planDraft
                : undefined,
          }
        : t,
    ),
    ok: true,
    message: "여행 조건을 저장했어요.",
  };
}
export function applyDraft(trips: Trip[], id: string, selected: string[]) {
  const trip = trips.find((t) => t.id === id && !t.deletedAt);
  const draft = trip?.planDraft;
  const c = trip?.planning;
  const fail = (message: string) => ({ trips, ok: false, message });
  if (!trip || !draft || !c)
    return fail("적용할 제안이 없어요. 새 제안을 받아 주세요.");
  if (planningSnapshot(trip) !== draft.baseSnapshot)
    return fail(
      "일정·장소·여행 조건이 바뀌었어요. 최신 조건으로 제안을 다시 받아 주세요.",
    );
  if (
    !selected.length ||
    selected.some((id) => !draft.rows.some((r) => r.id === id)) ||
    new Set(selected).size !== selected.length
  )
    return fail("적용할 장소를 다시 선택해 주세요.");
  let rows = draft.rows.filter((r) => selected.includes(r.id));
  const checked = validateRows(trip, c, rows);
  if (
    checked.accepted.length !== rows.length ||
    checked.bases.some((b) => b.hardIssues.length)
  )
    return fail(
      "고정 조건과 충돌하는 제안이 있어요. 조건을 수정하고 다시 받아 주세요.",
    );
  rows = checked.accepted;
  const plannedIds = new Set(
    trip.days.flatMap((d) =>
      d.items.map((e) => e.placeId || e.location?.placeId),
    ),
  );
  if (
    c.mustIds.some(
      (id) => !plannedIds.has(id) && !rows.some((r) => r.placeId === id),
    )
  )
    return fail(
      "꼭 가고 싶은 장소가 제안에 빠져 있어요. 조건을 조정해 다시 제안받아 주세요.",
    );
  const anchors = checked.bases
    .flatMap((b) => b.anchors)
    .filter(
      (a) =>
        !rows.some(
          (r) =>
            r.date === a.date &&
            r.time === a.time &&
            ((a.kind === "meal" && r.tag === "meal") ||
              (a.kind === "rest" && r.tag === "cafe")),
        ),
    );
  const all = [...rows, ...anchors];
  const next = {
    ...trip,
    planDraft: undefined,
    days: trip.days.map((d) => ({
      ...d,
      items: [
        ...d.items,
        ...all
          .filter((r) => r.date === d.date)
          .map(
            (r): Entry => ({
              id: `ai-${draft.id}-${r.id}`,
              name: r.name,
              time: r.time,
              durationMinutes: r.duration,
              origin: "ai",
              anchorKey: r.kind !== "place" ? r.id : undefined,
              placeId: r.placeId,
              tag: r.tag,
              must: !!r.placeId && c.mustIds.includes(r.placeId),
              location: r.query
                ? {
                    label: r.name,
                    query: r.query,
                    description: r.reason,
                    ...(r.placeId ? { placeId: r.placeId } : {}),
                  }
                : undefined,
            }),
          ),
      ].sort((a, b) => a.time.localeCompare(b.time)),
    })),
  };
  const addedIds = new Set(all.map((r) => `ai-${draft.id}-${r.id}`));
  next.days = next.days.map((day) => {
    const modes = { ...day.travelModes };
    day.items.slice(0, -1).forEach((entry, index) => {
      const after = day.items[index + 1];
      const key = legKey(entry.id, after.id);
      if (
        (addedIds.has(entry.id) || addedIds.has(after.id)) &&
        modes[key] === undefined
      )
        modes[key] = c.mode;
    });
    return {
      ...day,
      travelModes: Object.keys(modes).length ? modes : day.travelModes,
    };
  });
  return {
    trips: trips.map((t) => (t.id === id ? next : t)),
    ok: true,
    message: `${rows.length}곳과 식사·고정 일정을 추가했어요.`,
  };
}
export function validDraft(x: unknown): x is PlanDraft {
  if (!x || typeof x !== "object") return false;
  const d = x as PlanDraft;
  return (
    [d.id, d.generatedAt, d.baseSnapshot].every((v) => typeof v === "string") &&
    Array.isArray(d.rows) &&
    d.rows.length <= 100 &&
    new Set(d.rows.map((r) => r?.id)).size === d.rows.length &&
    d.rows.every((r) => r?.kind === "place") &&
    Array.isArray(d.anchors) &&
    [...d.rows, ...d.anchors].every(
      (r) =>
        r &&
        [r.id, r.date, r.time, r.name, r.reason].every(
          (v) => typeof v === "string",
        ) &&
        Number.isInteger(r.duration) &&
        r.duration > 0 &&
        r.duration <= 1440 &&
        validDate(r.date) &&
        Number.isFinite(minutes(r.time)) &&
        [
          "shopping",
          "sightseeing",
          "meal",
          "cafe",
          "stay",
          "transport",
          "other",
        ].includes(r.tag) &&
        ["place", "meal", "rest", "stay", "flight", "fixed"].includes(r.kind) &&
        (!r.placeId || typeof r.placeId === "string") &&
        (!r.query || typeof r.query === "string"),
    ) &&
    Array.isArray(d.issues) &&
    d.issues.every((v) => typeof v === "string") &&
    Array.isArray(d.unplaced) &&
    d.unplaced.every(
      (r) => r && [r.id, r.name, r.reason].every((v) => typeof v === "string"),
    )
  );
}
