import { useLocalSearchParams } from "expo-router";
export function routeValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) || "";
}
export function useTripParams() {
  const params = useLocalSearchParams<{
    tripId?: string | string[];
    placeId?: string | string[];
    entryId?: string | string[];
    postId?: string | string[];
    section?: string | string[];
    addedPlace?: string | string[];
    updatedEntry?: string | string[];
    date?: string | string[];
  }>();
  return {
    addedPlace: routeValue(params.addedPlace),
    updatedEntry: routeValue(params.updatedEntry),
    tripId: routeValue(params.tripId),
    entryId: routeValue(params.entryId),
    postId: routeValue(params.postId),
    section: routeValue(params.section),
    placeId: routeValue(params.placeId),
    date: routeValue(params.date),
  };
}
