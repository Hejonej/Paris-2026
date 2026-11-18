import type { Trip, Day, Entry } from "./data";
import { entryActivity } from "./activities";
import { entryLocation } from "./routing";
export function visitEligible(entry: Entry, trip: Trip) {
  const tag = entryActivity(entry, trip);
  return (
    !["stay", "transport"].includes(tag) &&
    !/^((meal|rest|flight|stay)-|(?:점심|저녁|휴식)-\d{4})/.test(
      entry.anchorKey || "",
    ) &&
    !!(entryLocation(entry) || entry.placeId)
  );
}
export function dayVisits(trip: Trip, day: Day) {
  const places = day.items.filter((e) => visitEligible(e, trip));
  return {
    places,
    done: places.filter((e) => e.visitedOn === day.date),
    remaining: places.filter((e) => e.visitedOn !== day.date),
  };
}
export function setVisit(
  trips: Trip[],
  tripId: string,
  date: string,
  entryId: string,
  visited: boolean,
  _today?: string,
) {
  const fail = (message: string) => ({ ok: false, message, trips });
  const trip = trips.find((t) => t.id === tripId && !t.deletedAt),
    day = trip?.days.find((d) => d.date === date),
    entry = day?.items.find((e) => e.id === entryId);
  if (!trip || !day || !entry)
    return fail("방문할 일정의 장소를 찾지 못했어요.");
  if (!visitEligible(entry, trip))
    return fail("주소가 정해진 방문 장소만 체크할 수 있어요.");
  return {
    ok: true,
    message: visited ? "다녀온 곳으로 표시했어요." : "방문 표시를 취소했어요.",
    trips: trips.map((t) =>
      t.id !== tripId
        ? t
        : {
            ...t,
            days: t.days.map((d) =>
              d.date !== date
                ? d
                : {
                    ...d,
                    items: d.items.map((e) => {
                      if (e.id !== entryId) return e;
                      const { visitedOn, ...rest } = e;
                      return visited ? { ...rest, visitedOn: date } : rest;
                    }),
                  },
            ),
          },
    ),
  };
}
