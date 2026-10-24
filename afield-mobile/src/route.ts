import { useLocalSearchParams } from "expo-router";
export function routeValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) || "";
}
export function useTripParams() {
  const params = useLocalSearchParams<{
    tripId?: string | string[];
    placeId?: string | string[];
    date?: string | string[];
  }>();
  return {
    tripId: routeValue(params.tripId),
    placeId: routeValue(params.placeId),
    date: routeValue(params.date),
  };
}
