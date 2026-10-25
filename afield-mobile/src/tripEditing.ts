import { makeDays } from "./data";
import type { Trip } from "./data";
export type TripDetails = Pick<Trip, "name" | "city" | "start" | "end">;
export const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value + "T00:00:00Z")) &&
  new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
export function validateTripDetails(details: TripDetails): string {
  if (!details.name.trim() || !details.city.trim())
    return "여행 이름과 도시를 입력해 주세요.";
  if (details.name.trim().length > 60 || details.city.trim().length > 60)
    return "이름과 도시는 60자 이내로 입력해 주세요.";
  if (
    (details.start || details.end) &&
    (!validDate(details.start) ||
      !validDate(details.end) ||
      !makeDays(details.start, details.end).length)
  )
    return "날짜는 YYYY-MM-DD로, 시작일부터 최대 31일 이내로 입력해 주세요.";
  return "";
}
export function editTrip(
  trips: Trip[],
  id: string,
  details: TripDetails,
): { trips: Trip[]; ok: boolean; message: string } {
  const fail = (message: string) => ({ trips, ok: false, message });
  const trip = trips.find((t) => t.id === id);
  if (!trip) return fail("여행 정보를 찾을 수 없어요.");
  const error = validateTripDetails(details);
  if (error) return fail(error);
  const days = makeDays(details.start, details.end);
  const dates = new Set(days.map((d) => d.date));
  const excluded = trip.days.filter(
    (d) => d.items.length && !dates.has(d.date),
  );
  if (excluded.length)
    return fail(
      `${excluded.map((d) => d.date.replaceAll("-", ".")).join(", ")}에 기존 일정이 있어요. 이 날짜를 포함하도록 여행 기간을 정해 주세요.`,
    );
  const next = {
    ...trip,
    ...details,
    name: details.name.trim(),
    city: details.city.trim(),
    days: days.map((day) => trip.days.find((d) => d.date === day.date) || day),
  };
  return {
    ok: true,
    message: "여행 정보를 저장했어요.",
    trips: trips.map((t) => (t.id === id ? next : t)),
  };
}
