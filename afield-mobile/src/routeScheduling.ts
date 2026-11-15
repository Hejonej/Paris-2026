import type { Trip } from "./data";
import type { PlanRow, PlanDraft } from "./planner";
import {
  dayBase,
  validateRows,
  readyPlaces,
  planningModes,
  minutes,
  clock,
  localToday,
} from "./planner";
import { entryLocation } from "./routing";
import { inferActivity } from "./activities";
import { bestRoute } from "./routeFacts";
import type { RouteContext } from "./routeFacts";
// A constraint-based scheduling pass, not another AI response. It never moves an existing stop.
export function fillRouteSlots(
  trip: Trip,
  draft: PlanDraft,
  facts: RouteContext,
): PlanRow[] {
  const c = trip.planning!;
  const rows = [...draft.rows];
  const modes = planningModes(c);
  const assigned = new Set([
    ...rows.map((r) => r.placeId),
    ...trip.days.flatMap((d) =>
      d.items.map((e) => e.placeId || e.location?.placeId),
    ),
  ]);
  const bases = trip.days
    .filter(
      (d) =>
        d.date >= localToday() &&
        d.date >= (c.rangeStart || trip.start) &&
        d.date <= (c.rangeEnd || trip.end),
    )
    .map((d) => dayBase(trip, c, d.date))
    .filter((b) => !b.hardIssues.length);
  const routeCost = (base: (typeof bases)[number], visits: PlanRow[]) => {
    const physical = [
      ...(trip.days.find((d) => d.date === base.date)?.items || []).map(
        (e) => ({ time: e.time, query: entryLocation(e)?.query }),
      ),
      ...base.anchors.map((a) => ({ time: a.time, query: a.query })),
      ...visits
        .filter((r) => r.date === base.date)
        .map((r) => ({ time: r.time, query: r.query })),
    ]
      .filter((s) => !!s.query)
      .sort((a, b) => a.time.localeCompare(b.time));
    const addresses = [
      ...(base.origin ? [base.origin.query] : []),
      ...physical.map((s) => s.query!),
      ...(base.destination ? [base.destination.query] : []),
    ];
    let cost = 0;
    for (let i = 1; i < addresses.length; i++) {
      if (addresses[i] === addresses[i - 1]) continue;
      const r = bestRoute(facts, addresses[i - 1], addresses[i], modes);
      if (!r) return Infinity;
      cost += r.durationSeconds;
    }
    return cost;
  };
  const pool = readyPlaces(trip).filter(
    (p) => c.selectedIds.includes(p.id) && !assigned.has(p.id),
  );
  pool.sort(
    (a, b) =>
      Number(c.mustIds.includes(b.id)) - Number(c.mustIds.includes(a.id)),
  );
  // Bound work independently of the trip length. All accepted times still pass the same strict validator.
  let attempts = 0;
  for (const p of pool) {
    let best: { row: PlanRow; score: number } | undefined;
    const tag = inferActivity(p.name, p.category);
    for (const base of bases) {
      const before = routeCost(base, rows);
      const count = rows.filter((r) => r.date === base.date).length;
      const times =
        tag === "meal"
          ? base.anchors
              .filter((a) => a.kind === "meal")
              .map((a) => minutes(a.time))
          : Array.from(
              {
                length: Math.max(
                  0,
                  Math.floor((base.end - base.start) / 5) + 1,
                ),
              },
              (_, i) => Math.ceil(base.start / 5) * 5 + i * 5,
            );
      for (const t of times) {
        if (++attempts > 120000) return rows;
        const row: PlanRow = {
          id: `route-slot-${p.id}`,
          date: base.date,
          time: clock(t),
          duration: c.durations[p.id] || 60,
          kind: "place",
          name: p.name,
          query: p.query,
          placeId: p.id,
          tag,
          reason:
            "Google 이동 시간과 숙소·고정 일정·식사 사이의 빈 시간을 계산해 방문 시각을 정했어요. 영업시간은 확인해 주세요.",
        };
        const trial = [...rows, row];
        if (
          validateRows(trip, c, trial, facts).accepted.length !== trial.length
        )
          continue;
        const after = routeCost(base, trial);
        const score =
          (Number.isFinite(before) ? after - before : after) +
          count * 300 +
          t * 0.001;
        if (Number.isFinite(score) && (!best || score < best.score))
          best = { row, score };
      }
    }
    if (best) {
      rows.push(best.row);
      assigned.add(p.id);
    }
  }
  return rows;
}
