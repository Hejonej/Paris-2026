import type { TravelMode } from "./data";
export type RouteFact = {
  from: string;
  to: string;
  mode: TravelMode;
  durationSeconds: number;
  distanceMeters: number;
  retrievedAt: string;
};
export type RouteContext = {
  provider: "Google Maps";
  retrievedAt: string;
  routes: RouteFact[];
};
export function validRouteContext(value: unknown): value is RouteContext {
  const v = value as RouteContext;
  return (
    !!v &&
    v.provider === "Google Maps" &&
    Number.isFinite(Date.parse(v.retrievedAt)) &&
    Array.isArray(v.routes) &&
    v.routes.length <= 500 &&
    v.routes.every(
      (r) =>
        !!r &&
        typeof r.from === "string" &&
        typeof r.to === "string" &&
        r.from.length <= 400 &&
        r.to.length <= 400 &&
        ["walking", "transit", "driving"].includes(r.mode) &&
        Number.isFinite(r.durationSeconds) &&
        r.durationSeconds >= 0 &&
        Number.isFinite(r.distanceMeters) &&
        r.distanceMeters >= 0 &&
        Number.isFinite(Date.parse(r.retrievedAt)),
    )
  );
}
export function bestRoute(
  facts: RouteContext,
  from: string,
  to: string,
  modes: TravelMode[],
) {
  return facts.routes
    .filter((r) => r.from === from && r.to === to && modes.includes(r.mode))
    .sort((a, b) => a.durationSeconds - b.durationSeconds)[0];
}
