import { places, tripPlaces } from "./data";
import type { Entry, EntryLocation, Trip, TravelMode } from "./data";
export const travelModes: TravelMode[] = ["walking", "transit", "driving"];
export const modeLabels: Record<TravelMode, string> = {
  walking: "도보",
  transit: "대중교통",
  driving: "차",
};
export const legKey = (fromId: string, toId: string) =>
  JSON.stringify([fromId, toId]);
export function entryLocation(entry: Entry): EntryLocation | undefined {
  if (entry.location) return entry.location;
  const place = places.find((p) => p.id === entry.placeId);
  return place
    ? {
        label: place.name,
        query: place.query,
        description: place.description,
        placeId: place.id,
      }
    : undefined;
}
export function entryDescription(entry: Entry): string {
  const linked = entryLocation(entry);
  if (linked) return linked.description;
  if (entry.id === "original-1" || entry.id === "original-4")
    return "골목과 작은 상점을 따라 천천히 둘러보는 동네 산책";
  if (entry.id === "original-2")
    return "마음에 드는 책과 독립출판물을 찾아보는 시간";
  return "방문할 장소와 짧은 메모를 정해 보세요.";
}
export function locationUrl(location: EntryLocation): string {
  return (
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(location.query)
  );
}
export function directionsUrl(
  from: Entry,
  to: Entry,
  mode: TravelMode,
): string | undefined {
  const origin = entryLocation(from);
  const destination = entryLocation(to);
  if (!origin || !destination || !travelModes.includes(mode)) return undefined;
  return (
    "https://www.google.com/maps/dir/?api=1&origin=" +
    encodeURIComponent(origin.query) +
    "&destination=" +
    encodeURIComponent(destination.query) +
    "&travelmode=" +
    mode
  );
}
export function bindEntryLocation(
  trips: Trip[],
  tripId: string,
  date: string,
  entryId: string,
  location: EntryLocation,
) {
  const fail = (message: string) => ({ trips, ok: false, message });
  const trip = trips.find((t) => t.id === tripId);
  const day = trip?.days.find((d) => d.date === date);
  if (!day?.items.some((e) => e.id === entryId))
    return fail("일정을 찾을 수 없어요. 일정 화면에서 다시 열어 주세요.");
  if (!location.label.trim() || !location.query.trim())
    return fail("장소 이름과 주소 또는 지도 검색어를 입력해 주세요.");
  if (
    location.label.length > 80 ||
    location.query.length > 300 ||
    location.description.length > 160
  )
    return fail(
      "장소 이름은 80자, 주소는 300자, 설명은 160자 이내로 입력해 주세요.",
    );
  const linked = location.placeId
    ? tripPlaces(trip).find((p) => p.id === location.placeId)
    : undefined;
  if (linked && "matchStatus" in linked && linked.matchStatus !== "confirmed")
    return fail("장소 위치를 먼저 확인해 주세요.");
  if (location.placeId && !linked) return fail("선택한 장소를 찾을 수 없어요.");
  const next: EntryLocation = linked
    ? {
        label: linked.name,
        query: linked.query,
        description: location.description.trim(),
        placeId: linked.id,
      }
    : {
        label: location.label.trim(),
        query: location.query.trim(),
        description: location.description.trim(),
      };
  return {
    ok: true,
    message: "장소를 연결했어요.",
    trips: trips.map((t) =>
      t.id === tripId
        ? {
            ...t,
            days: t.days.map((d) =>
              d.date === date
                ? {
                    ...d,
                    items: d.items.map((e) =>
                      e.id === entryId ? { ...e, location: next } : e,
                    ),
                  }
                : d,
            ),
          }
        : t,
    ),
  };
}
export function setLegMode(
  trips: Trip[],
  tripId: string,
  date: string,
  fromId: string,
  toId: string,
  mode: TravelMode,
) {
  const fail = (message: string) => ({ trips, ok: false, message });
  const day = trips
    .find((t) => t.id === tripId)
    ?.days.find((d) => d.date === date);
  const index = day?.items.findIndex((e) => e.id === fromId) ?? -1;
  if (!day || index < 0 || day.items[index + 1]?.id !== toId)
    return fail("이어지는 두 일정의 이동수단만 변경할 수 있어요.");
  if (!travelModes.includes(mode))
    return fail("이동수단을 다시 선택해 주세요.");
  return {
    ok: true,
    message: "이동수단을 저장했어요.",
    trips: trips.map((t) =>
      t.id === tripId
        ? {
            ...t,
            days: t.days.map((d) =>
              d.date === date
                ? {
                    ...d,
                    travelModes: {
                      ...d.travelModes,
                      [legKey(fromId, toId)]: mode,
                    },
                  }
                : d,
            ),
          }
        : t,
    ),
  };
}
