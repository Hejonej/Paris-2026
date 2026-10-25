import { tripPlaces } from "./data";
import type { ActivityTag, Entry, Place, Trip } from "./data";
export const activityTags: ActivityTag[] = [
  "shopping",
  "sightseeing",
  "meal",
  "cafe",
  "stay",
  "transport",
  "other",
];
export const activityLabels: Record<ActivityTag, string> = {
  shopping: "쇼핑",
  sightseeing: "관광",
  meal: "식사",
  cafe: "카페(휴식)",
  stay: "숙소",
  transport: "이동",
  other: "기타",
};
export function inferActivity(name: string, category = ""): ActivityTag {
  const classify = (text: string): ActivityTag | undefined => {
    if (/쇼핑|구매|shopping/i.test(text)) return "shopping";
    if (
      /숙소|호텔|체크인|체크아웃|check.?in|check.?out|hotel|hostel|lodging|airbnb/i.test(
        text,
      )
    )
      return "stay";
    if (/카페|커피|caf[eé]|coffee|tea.?room/i.test(text)) return "cafe";
    if (
      /식사|점심|저녁|아침 ?식사|브런치|레스토랑|식당|restaurant|lunch|dinner|breakfast|brunch/i.test(
        text,
      )
    )
      return "meal";
    if (
      /서점|쇼핑|편집숍|빈티지|bookstore|bookshop|boutique|shopping|\bshop\b|\bstore\b/i.test(
        text,
      )
    )
      return "shopping";
    if (
      /박물관|미술관|관광|산책|탐색|광장|전시|museum|musée|gallery|sight.?seeing|carnavalet|walk|stroll|square|monument/i.test(
        text,
      )
    )
      return "sightseeing";
    if (/공항|항공|기차|택시|이동|airport|flight|train|transfer/i.test(text))
      return "transport";
  };
  const named = classify(name);
  if (named) return named;
  if (/맛집.*카페|food.*cafe/i.test(category)) return "other";
  return classify(category) || (/맛집|food/i.test(category) ? "meal" : "other");
}
export function entryActivity(entry: Entry, trip?: Trip): ActivityTag {
  if (entry.tag && activityTags.includes(entry.tag)) return entry.tag;
  const place = tripPlaces(trip).find(
    (p) => p.id === (entry.location?.placeId || entry.placeId),
  );
  return inferActivity(
    entry.name + " " + (entry.location?.label || ""),
    place?.category || "",
  );
}
export function setEntryTag(
  trips: Trip[],
  tripId: string,
  date: string,
  entryId: string,
  tag: ActivityTag,
) {
  const fail = (message: string) => ({ trips, ok: false, message });
  const day = trips
    .find((t) => t.id === tripId)
    ?.days.find((d) => d.date === date);
  if (!day?.items.some((e) => e.id === entryId))
    return fail("분류할 일정을 찾을 수 없어요.");
  if (!activityTags.includes(tag)) return fail("분류를 다시 선택해 주세요.");
  return {
    ok: true,
    message: "일정 분류를 저장했어요.",
    trips: trips.map((t) =>
      t.id === tripId
        ? {
            ...t,
            days: t.days.map((d) =>
              d.date === date
                ? {
                    ...d,
                    items: d.items.map((e) =>
                      e.id === entryId ? { ...e, tag } : e,
                    ),
                  }
                : d,
            ),
          }
        : t,
    ),
  };
}
