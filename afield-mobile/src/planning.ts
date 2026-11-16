import { reservedMinutes } from "./visitTiming";
import type { Trip } from "./data";
export function addCandidate(
  trips: Trip[],
  id: string,
  placeId: string,
): Trip[] {
  return trips.map((t) =>
    t.id === id
      ? { ...t, candidates: Array.from(new Set([...t.candidates, placeId])) }
      : t,
  );
}
export function addToPlan(
  trips: Trip[],
  id: string,
  placeId: string,
  name: string,
  date: string,
  time: string,
): { trips: Trip[]; ok: boolean; message: string } {
  const trip = trips.find((t) => t.id === id);
  const day = trip?.days.find((d) => d.date === date);
  const fail = (message: string) => ({ trips, ok: false, message });
  if (!day) return fail("배치할 여행 날짜를 선택해 주세요.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    return fail("시간은 09:30처럼 입력해 주세요.");
  if (day.items.some((x) => x.placeId === placeId))
    return fail("이 날짜에 이미 추가한 장소예요.");
  if (day.items.some((x) => x.time === time))
    return fail("이미 일정이 있는 시간이에요. 다른 시간을 선택해 주세요.");
  return {
    ok: true,
    message: "일정에 추가했어요.",
    trips: trips.map((t) =>
      t.id === id
        ? {
            ...t,
            days: t.days.map((d) =>
              d.date === date
                ? {
                    ...d,
                    items: [
                      ...d.items,
                      {
                        id:
                          "entry-" +
                          Date.now() +
                          "-" +
                          Math.random().toString(36).slice(2, 7),
                        placeId,
                        name,
                        time,
                      },
                    ].sort((a, b) => a.time.localeCompare(b.time)),
                  }
                : d,
            ),
          }
        : t,
    ),
  };
}

// Suggest an editable start time, never add a visit or change an existing entry.
export function suggestedVisitTime(day?: Trip["days"][number]): string {
  const toMinute = (time: string) =>
    Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const blocks = (day?.items || []).map((e) => ({
    start: toMinute(e.time),
    end: toMinute(e.time) + reservedMinutes(e),
  }));
  for (let t = 11 * 60; t <= 23 * 60; t += 30) {
    if (!blocks.some((b) => t === b.start || (t < b.end && t >= b.start)))
      return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  }
  return "";
}
