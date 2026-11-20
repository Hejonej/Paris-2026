import { formatMinutes } from "./duration";
import { reservedMinutes } from "./visitTiming";
import type { Trip, TravelMode } from "./data";
import type { PlanRow, PlanningConditions } from "./planner";
import { entryLocation } from "./routing";
import { assessRoute, transitUnavailable } from "./routeFacts";
import type { RouteContext, PendingTransfer } from "./routeFacts";
const minute = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
type Base = {
  arrivalTransfer?: PendingTransfer;
  date: string;
  start: number;
  end: number;
  anchors: PlanRow[];
  origin?: { name: string; query: string };
  destination?: { name: string; query: string };
};
type Stop = {
  id: string;
  name: string;
  time: number;
  duration: number;
  query?: string;
  proposal: boolean;
};
function modes(c: PlanningConditions): TravelMode[] {
  return c.modes?.length
    ? c.modes
    : c.mode === "mixed"
      ? ["walking", "transit"]
      : [c.mode];
}
function edgesFor(trip: Trip, base: Base, rows: PlanRow[]): [Stop, Stop][] {
  const existing = trip.days.find((d) => d.date === base.date)?.items || [];
  const stops: Stop[] = [
    ...existing.map((e) => ({
      id: e.id,
      name: e.name,
      time: minute(e.time),
      duration: reservedMinutes(e, trip, base.date),
      query: entryLocation(e)?.query,
      proposal: false,
    })),
    ...base.anchors
      .filter((a) => !existing.some((e) => e.anchorKey === a.id))
      .map((a) => ({
        id: a.id,
        name: a.name,
        time: minute(a.time),
        duration: a.duration,
        query: a.query,
        proposal: false,
      })),
    ...rows
      .filter((r) => r.date === base.date)
      .map((r) => ({
        id: r.id,
        name: r.name,
        time: minute(r.time),
        duration: 0,
        query: r.query,
        proposal: true,
      })),
  ]
    .filter((s) => !!s.query)
    .sort((a, b) => a.time - b.time);
  const nodes: Stop[] = [
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
  return nodes
    .slice(1)
    .map((b, i) => [nodes[i], b] as [Stop, Stop])
    .filter(([a, b]) => a.proposal || b.proposal);
}
export function collectPendingTransfers(
  trip: Trip,
  c: PlanningConditions,
  rows: PlanRow[],
  bases: Base[],
  facts: RouteContext,
): PendingTransfer[] {
  return bases.flatMap((base) => [
    ...(base.arrivalTransfer ? [base.arrivalTransfer] : []),
    ...edgesFor(trip, base, rows).flatMap(([a, b]) =>
      assessRoute(facts, a.query!, b.query!, modes(c)).kind === "pending"
        ? [
            {
              date: base.date,
              from: a.query!,
              to: b.query!,
              fromName: a.name,
              toName: b.name,
              planSlotMinutes: 30,
              rowIds: [
                ...(a.proposal ? [a.id] : []),
                ...(b.proposal ? [b.id] : []),
              ],
            },
          ]
        : [],
    ),
  ]);
}
export function routeConflicts(
  trip: Trip,
  c: PlanningConditions,
  rows: PlanRow[],
  bases: Base[],
  facts: RouteContext,
) {
  const errors = new Map<string, string>();
  for (const base of bases)
    for (const [a, b] of edgesFor(trip, base, rows)) {
      const assessment = assessRoute(facts, a.query!, b.query!, modes(c));
      const gap = b.time - a.time - a.duration;
      const message =
        assessment.kind === "missing"
          ? transitUnavailable(facts, a.query!, b.query!, modes(c))
            ? `${a.name} → ${b.name}: 대중교통 시간을 조회하지 못했어요. 긴 도보 시간으로 대신 배치하지 않아요.`
            : `${a.name} → ${b.name}: 선택한 이동수단의 경로를 확인하지 못했어요. 주소나 이동수단을 확인해 주세요.`
          : gap < assessment.minutes + c.buffer
            ? `${a.name} → ${b.name}: ${assessment.kind === "pending" ? "검토용 이동 공간" : "이동"} ${formatMinutes(assessment.minutes)}과 여유 ${c.buffer}분이 필요하지만 ${formatMinutes(Math.max(0, gap))}밖에 없어요.`
            : "";
      if (message) {
        if (a.proposal) errors.set(a.id, message);
        if (b.proposal) errors.set(b.id, message);
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
) {
  const pending = collectPendingTransfers(trip, c, rows, bases, facts).find(
    (p) => p.rowIds.includes(row.id),
  );
  if (pending)
    return `${pending.fromName} → ${pending.toName}: 대중교통 소요시간 미확인인 배치안이에요. 검토용 이동 공간 30분과 여유 ${c.buffer}분은 임시로 확보했으며 실제 교통시간이 아니에요.`;
  const base = bases.find((b) => b.date === row.date);
  const incoming =
    base && edgesFor(trip, base, rows).find(([, b]) => b.id === row.id);
  if (!incoming)
    return "숙소·고정 일정·식사와 겹치지 않는 빈 시간에 배치했어요. 출발 위치가 미정인 구간의 이동은 확인이 필요해요.";
  const [a, b] = incoming;
  const assessment = assessRoute(facts, a.query!, b.query!, modes(c));
  if (assessment.kind === "pending")
    return `${a.name}에서 대중교통으로 이동할 배치안이에요. 소요시간은 미확인이며, 검토용 이동 공간 30분과 여유 ${c.buffer}분을 임시로 확보했어요.`;
  if (assessment.kind === "missing")
    return "선택한 이동수단의 경로를 확인해 주세요.";
  if (!assessment.route)
    return `${a.name}와 같은 주소에서 이어지는 일정이에요.`;
  const label = { walking: "도보", transit: "대중교통", driving: "차" }[
    assessment.route.mode
  ];
  return `${a.name}에서 ${label} ${formatMinutes(assessment.minutes)}과 여유 ${c.buffer}분을 확보했어요. 숙소·고정 일정·식사 사이의 빈 시간에 배치했어요.`;
}
