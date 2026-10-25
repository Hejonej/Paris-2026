import type { Day, Entry, EntryLocation, Trip } from "./data";
import { entryLocation } from "./routing";
export type WalkStart = {
  location: EntryLocation;
  reason: string;
  basis: "next" | "previous" | "default";
  linkedEntryId?: string;
  source: string;
};
// Curated public meeting points. This is a local suggestion, not a live route optimization result.
const vosges: EntryLocation = {
  label: "Place des Vosges · 보주 광장",
  query: "Place des Vosges, 75004 Paris, France",
  description: "보주 광장 바깥 회랑에서 마레 골목 산책을 시작해요.",
};
const temple: EntryLocation = {
  label: "Square du Temple · rue de Bretagne 입구 앞",
  query: "64 Rue de Bretagne, 75003 Paris, France",
  description:
    "공원 안이 아니라 rue de Bretagne 쪽 입구 앞에서 마레 산책을 시작해요.",
};
export const walkStartSources = {
  vosges: "https://parisjetaime.com/eng/transport/place-des-vosges-p1907",
  temple: "https://www.paris.fr/lieux/square-du-temple-elie-wiesel-2425",
};
export function isMaraisWalk(entry: Entry, trip: Trip): boolean {
  return (
    /paris|파리/i.test(trip.city) &&
    /le\s*marais|마레/i.test(entry.name) &&
    /탐색|산책|walk|stroll/i.test(entry.name)
  );
}
export function suggestWalkStart(
  trip: Trip,
  day: Day,
  index: number,
): WalkStart | undefined {
  const item = day.items[index];
  if (!item || entryLocation(item) || !isMaraisWalk(item, trip))
    return undefined;
  const next = day.items[index + 1];
  const nextLocation = next && entryLocation(next);
  if (nextLocation) {
    const text = nextLocation.query + " " + nextLocation.label;
    if (/ofr|dupetit|rue de bretagne|square du temple/i.test(text))
      return {
        location: temple,
        basis: "next",
        linkedEntryId: next.id,
        reason: `다음 ${next.name} 일정과 북마레 쪽에서 이어가도록 입구 앞을 시작점으로 잡았어요.`,
        source: walkStartSources.temple,
      };
    if (/carnavalet|s[eé]vign[eé]|vosges/i.test(text))
      return {
        location: vosges,
        basis: "next",
        linkedEntryId: next.id,
        reason: `다음 ${next.name} 방문으로 이어가도록 보주 광장에서 산책을 시작해요.`,
        source: walkStartSources.vosges,
      };
  }
  const previous = day.items[index - 1];
  const previousLocation = previous && entryLocation(previous);
  if (
    !next &&
    previousLocation &&
    /carnavalet|ofr|le\s*marais|마레|s[eé]vign[eé]|vosges|dupetit|rue de bretagne/i.test(
      previousLocation.query + " " + previousLocation.label,
    )
  )
    return {
      location: {
        label: previousLocation.label + " 앞 · 산책 시작",
        query: previousLocation.query,
        description: "앞 일정을 마친 곳의 바깥에서 골목 산책을 이어가요.",
      },
      basis: "previous",
      linkedEntryId: previous.id,
      reason: `${previous.name} 방문을 마친 곳에서 바로 산책을 이어가도록 시작점을 잡았어요.`,
      source: "",
    };
  return {
    location: vosges,
    basis: "default",
    reason: nextLocation
      ? `다음 ${next!.name}까지의 실제 경로는 지도에서 확인할 수 있어요. 우선 마레 산책의 기준점인 보주 광장에서 시작해요.`
      : next
        ? `다음 ${next.name}의 정확한 장소는 아직 정해지지 않았어요. 산책은 보주 광장에서 시작하고, 다음 장소가 정해지면 시작점을 다시 맞춰요.`
        : "마레 골목을 둘러보는 출발점으로 보주 광장을 잡았어요.",
    source: walkStartSources.vosges,
  };
}
export function journeyStop(
  trip: Trip,
  day: Day,
  index: number,
): { entry: Entry; location?: EntryLocation; suggestion?: WalkStart } {
  const item = day.items[index];
  const suggestion = suggestWalkStart(trip, day, index);
  const location = entryLocation(item) || suggestion?.location;
  return {
    entry: location ? { ...item, location } : item,
    location,
    suggestion,
  };
}
export function missingPlacePrompt(entry: Entry, trip: Trip): string {
  return isMaraisWalk(entry, trip)
    ? `${entry.name}의 산책 시작 지점을 선택해 주세요.`
    : `${entry.name}에서 방문할 곳을 선택해 주세요.`;
}
