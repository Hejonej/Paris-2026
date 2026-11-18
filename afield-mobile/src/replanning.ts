import type { Trip, Entry } from "./data";
import {
  defaultConditions,
  applyDraft,
  localToday,
  planningSnapshot,
} from "./planner";
import type { PlanDraft } from "./planner";
import { lockReason, validateEdit } from "./manualEditing";
import { visitEligible } from "./visits";
import { entryLocation, legKey } from "./routing";
import { entryActivity, activityLabels } from "./activities";
export type ReplanWork = {
  base: string;
  sourceDate: string;
  trip: Trip;
  originals: Record<string, Entry>;
};
export type ReplanProposal = ReplanWork & { draft: PlanDraft };
export function prepareReplan(
  trip: Trip,
  sourceDate: string,
  ids: string[],
  today = localToday(),
): ReplanWork {
  const source = trip.days.find((d) => d.date === sourceDate);
  if (!source || !ids.length || new Set(ids).size !== ids.length)
    throw Error("옮길 장소를 선택해 주세요.");
  const targets = trip.days.filter(
    (d) => d.date > sourceDate && d.date > today,
  );
  if (!targets.length)
    throw Error(
      "남은 여행 날짜가 없어요. 장소를 지우지 않고 현재 일정에 남겨둘게요.",
    );
  const originals: Record<string, Entry> = {};
  for (const id of ids) {
    const e = source.items.find((e) => e.id === id);
    if (
      !e ||
      !visitEligible(e, trip) ||
      lockReason(trip, sourceDate, e) ||
      !entryLocation(e)
    )
      throw Error(
        "완료·꼭 갈 곳·예약·기록은 보호해요. 위치가 확인된 미방문 장소를 선택해 주세요.",
      );
    originals["replan-" + id] = e;
  }
  const places = Object.entries(originals).map(([id, e]) => ({
    id,
    name: e.name,
    address: entryLocation(e)!.query,
    query: entryLocation(e)!.query,
    category: activityLabels[entryActivity(e, trip)],
    area: trip.city,
    image: "",
    description: "",
    sourcePostIds: [],
    matchStatus: "confirmed" as const,
  }));
  const idsSet = new Set(ids),
    c = trip.planning || defaultConditions(trip);
  const working: Trip = {
    ...trip,
    planDraft: undefined,
    days: trip.days.map((d) =>
      d.date === sourceDate
        ? { ...d, items: d.items.filter((e) => !idsSet.has(e.id)) }
        : d,
    ),
    importedPlaces: [...(trip.importedPlaces || []), ...places],
    candidates: [...trip.candidates, ...places.map((p) => p.id)],
    planning: {
      ...c,
      rangeStart: targets[0].date,
      rangeEnd: targets[targets.length - 1].date,
      selectedIds: places.map((p) => p.id),
      mustIds: [],
      notes: [
        "하루 정리에서 사용자가 선택한 미방문 장소만 남은 날짜에 재배치합니다. 기존 일정은 그대로 유지하고 날짜별 방문 수와 지역을 고려해 분산하세요.",
        c.notes,
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 1000),
    },
  };
  return { base: JSON.stringify(trip), sourceDate, trip: working, originals };
}
export function applyReplan(
  trips: Trip[],
  tripId: string,
  proposal: ReplanProposal,
  selected: string[],
  acceptPending = false,
) {
  const fail = (message: string) => ({ ok: false, message, trips });
  const original = trips.find((t) => t.id === tripId && !t.deletedAt);
  if (!original || JSON.stringify(original) !== proposal.base)
    return fail(
      "일정이나 방문 상태가 바뀌었어요. 최신 일정에서 다시 제안받아 주세요.",
    );
  if (
    proposal.trip.id !== tripId ||
    planningSnapshot(proposal.trip) !== proposal.draft.baseSnapshot
  )
    return fail("재배치 제안을 다시 확인해 주세요.");
  const rows = proposal.draft.rows.filter((r) => selected.includes(r.id));
  if (rows.some((r) => !r.placeId || !proposal.originals[r.placeId]))
    return fail("선택한 원래 장소를 찾지 못했어요.");
  const applied = applyDraft(
    [{ ...proposal.trip, planDraft: proposal.draft }],
    tripId,
    selected,
    acceptPending,
  );
  if (!applied.ok) return fail(applied.message);
  const result = applied.trips[0];
  const moves = new Map(
    rows.map((r) => [proposal.originals[r.placeId!].id, r]),
  );
  const idMap = new Map(
    rows.map((r) => [
      `ai-${proposal.draft.id}-${r.id}`,
      proposal.originals[r.placeId!].id,
    ]),
  );
  let days = original.days.map((d) => {
    const additions = rows
      .filter((r) => r.date === d.date)
      .map((r) => ({ ...proposal.originals[r.placeId!], time: r.time }));
    const modes = { ...d.travelModes };
    for (const [key, mode] of Object.entries(
      result.days.find((x) => x.date === d.date)?.travelModes || {},
    )) {
      try {
        const [a, b] = JSON.parse(key);
        modes[legKey(idMap.get(a) || a, idMap.get(b) || b)] = mode;
      } catch {}
    }
    return {
      ...d,
      items: [...d.items.filter((e) => !moves.has(e.id)), ...additions].sort(
        (a, b) => a.time.localeCompare(b.time),
      ),
      travelModes: Object.keys(modes).length ? modes : d.travelModes,
    };
  });
  const error = validateEdit(original, days);
  if (error) return fail(error);
  days = days.map((d) => ({
    ...d,
    items: d.items.map((e) => {
      const row = moves.get(e.id);
      const added =
        row &&
        result.days
          .flatMap((d) => d.items)
          .find((x) => x.id === `ai-${proposal.draft.id}-${row.id}`);
      return added?.needsTransitCheck ? { ...e, needsTransitCheck: true } : e;
    }),
  }));
  return {
    ok: true,
    message: `선택한 ${rows.length}곳의 날짜와 시간을 바꿨어요.`,
    trips: trips.map((t) =>
      t.id === tripId
        ? {
            ...t,
            days,
            planDraft: undefined,
            replanHistory: [
              ...(t.replanHistory || []),
              {
                id: proposal.draft.id,
                createdAt: new Date().toISOString(),
                changes: rows.map((r) => ({
                  entryId: proposal.originals[r.placeId!].id,
                  name: proposal.originals[r.placeId!].name,
                  fromDate: proposal.sourceDate,
                  fromTime: proposal.originals[r.placeId!].time,
                  toDate: r.date,
                  toTime: r.time,
                })),
              },
            ].slice(-100),
          }
        : t,
    ),
  };
}

export function validMoveHistory(
  value: unknown,
): value is import("./data").MoveHistory {
  if (!value || typeof value !== "object") return false;
  const h = value as import("./data").MoveHistory;
  return (
    typeof h.id === "string" &&
    typeof h.createdAt === "string" &&
    Number.isFinite(Date.parse(h.createdAt)) &&
    Array.isArray(h.changes) &&
    h.changes.length <= 100 &&
    h.changes.every(
      (c) =>
        c &&
        [c.entryId, c.name, c.fromDate, c.fromTime, c.toDate, c.toTime].every(
          (v) => typeof v === "string" && v.length <= 300,
        ) &&
        /^\d{4}-\d{2}-\d{2}$/.test(c.fromDate) &&
        /^\d{4}-\d{2}-\d{2}$/.test(c.toDate) &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(c.fromTime) &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(c.toTime),
    )
  );
}
