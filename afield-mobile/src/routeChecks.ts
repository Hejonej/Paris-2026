import type { Trip, TravelMode } from "./data";
import type { PlanRow, PlanningConditions } from "./planner";
import { entryLocation } from "./routing";
import { bestRoute, transitUnavailable } from "./routeFacts";
import type { RouteContext } from "./routeFacts";
const minute = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
type Base = {
  date: string;
  start: number;
  end: number;
  anchors: PlanRow[];
  origin?: { name: string; query: string };
  destination?: { name: string; query: string };
};
export function routeConflicts(
  trip: Trip,
  c: PlanningConditions,
  rows: PlanRow[],
  bases: Base[],
  facts: RouteContext,
) {
  const errors = new Map<string, string>();
  const modes: TravelMode[] = c.modes?.length
    ? c.modes
    : c.mode === "mixed"
      ? ["walking", "transit"]
      : [c.mode];
  for (const base of bases) {
    const additions = rows.filter((r) => r.date === base.date);
    if (!additions.length) continue;
    const stops = [
      ...(trip.days.find((d) => d.date === base.date)?.items || []).map(
        (e) => ({
          id: e.id,
          name: e.name,
          time: minute(e.time),
          duration: e.durationMinutes || 60,
          query: entryLocation(e)?.query,
          proposal: false,
        }),
      ),
      ...base.anchors
        .filter(
          (a) =>
            !trip.days
              .find((d) => d.date === base.date)
              ?.items.some((e) => e.anchorKey === a.id),
        )
        .map((a) => ({
          id: a.id,
          name: a.name,
          time: minute(a.time),
          duration: a.duration,
          query: a.query,
          proposal: false,
        })),
      ...additions.map((r) => ({
        id: r.id,
        name: r.name,
        time: minute(r.time),
        duration: r.duration,
        query: r.query,
        proposal: true,
      })),
    ]
      .filter((s) => !!s.query)
      .sort((a, b) => a.time - b.time);
    const nodes = [
      ...(base.origin
        ? [
            {
              id: "origin",
              name: base.origin.name,
              time: base.start,
              duration: 0,
              query: base.origin.query,
              proposal: false,
            },
          ]
        : []),
      ...stops,
      ...(base.destination
        ? [
            {
              id: "destination",
              name: base.destination.name,
              time: base.end,
              duration: 0,
              query: base.destination.query,
              proposal: false,
            },
          ]
        : []),
    ];
    for (let i = 1; i < nodes.length; i++) {
      const a = nodes[i - 1],
        b = nodes[i];
      if (!a.proposal && !b.proposal) continue;
      const route = bestRoute(facts, a.query!, b.query!, modes);
      const duration =
        a.query === b.query
          ? 0
          : route
            ? Math.ceil(route.durationSeconds / 60)
            : NaN;
      const gap = b.time - a.time - a.duration;
      const message =
        !route && a.query !== b.query
          ? transitUnavailable(facts, a.query!, b.query!, modes)
            ? `${a.name} → ${b.name}: 대중교통 시간을 조회하지 못했어요. 긴 도보 시간으로 대신 배치하지 않아요.`
            : `${a.name} → ${b.name}: 선택한 이동수단의 경로를 확인하지 못했어요. 주소나 이동수단을 확인해 주세요.`
          : gap < duration + c.buffer
            ? `${a.name} → ${b.name}: 이동 ${duration}분과 여유 ${c.buffer}분이 필요하지만 ${gap}분밖에 없어요.`
            : "";
      if (message) {
        if (a.proposal) errors.set(a.id, message);
        if (b.proposal) errors.set(b.id, message);
      }
    }
  }
  return errors;
}

export function routeExplanation(
  trip: Trip,
  c: PlanningConditions,
  rows: PlanRow[],
  bases: Base[],
  facts: RouteContext,
  row: PlanRow,
): string {
  const base = bases.find((b) => b.date === row.date);
  if (!base) return "입력한 여행 조건의 빈 시간에 배치했어요.";
  const previous =
    [
      ...(trip.days.find((d) => d.date === row.date)?.items || []).map((e) => ({
        time: e.time,
        name: e.name,
        query: entryLocation(e)?.query,
      })),
      ...base.anchors.map((a) => ({
        time: a.time,
        name: a.name,
        query: a.query,
      })),
      ...rows
        .filter((r) => r.date === row.date && r.id !== row.id)
        .map((r) => ({ time: r.time, name: r.name, query: r.query })),
    ]
      .filter((s) => !!s.query && s.time < row.time)
      .sort((a, b) => b.time.localeCompare(a.time))[0] || base.origin;
  if (!previous?.query || !row.query)
    return "숙소·고정 일정·식사와 겹치지 않는 빈 시간에 배치했어요. 출발 위치가 미정인 구간의 이동은 확인이 필요해요.";
  const modes: TravelMode[] = c.modes?.length
    ? c.modes
    : c.mode === "mixed"
      ? ["walking", "transit"]
      : [c.mode];
  const r = bestRoute(facts, previous.query, row.query, modes);
  if (!r) return "선택한 이동수단의 경로를 확인해 주세요.";
  const label = { walking: "도보", transit: "대중교통", driving: "차" }[r.mode];
  return `${previous.name}에서 ${label} ${Math.ceil(r.durationSeconds / 60)}분과 여유 ${c.buffer}분을 확보했어요. 숙소·고정 일정·식사 사이의 빈 시간에 배치했어요.`;
}
