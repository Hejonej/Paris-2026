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
  warnings?: string[];
  policyVersion?: 2;
  provider: "Google Maps";
  retrievedAt: string;
  routes: RouteFact[];
};
export function validRouteContext(value: unknown): value is RouteContext {
  const v = value as RouteContext;
  return (
    !!v &&
    v.provider === "Google Maps" &&
    (v.policyVersion === undefined || v.policyVersion === 2) &&
    (v.warnings === undefined ||
      (Array.isArray(v.warnings) &&
        v.warnings.length <= 10 &&
        v.warnings.every((w) => typeof w === "string" && w.length <= 1000))) &&
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
export const MAX_AUTO_WALK_MINUTES = 30;
export function bestRoute(
  facts: RouteContext,
  from: string,
  to: string,
  modes: TravelMode[],
) {
  return facts.routes
    .filter(
      (r) =>
        r.from === from &&
        r.to === to &&
        modes.includes(r.mode) &&
        !(
          r.mode === "walking" &&
          modes.includes("transit") &&
          r.durationSeconds > MAX_AUTO_WALK_MINUTES * 60
        ),
    )
    .sort((a, b) => a.durationSeconds - b.durationSeconds)[0];
}

export function transitUnavailable(
  facts: RouteContext,
  from: string,
  to: string,
  modes: TravelMode[],
) {
  return (
    modes.includes("transit") &&
    !facts.routes.some(
      (r) => r.from === from && r.to === to && r.mode === "transit",
    ) &&
    facts.routes.some(
      (r) =>
        r.from === from &&
        r.to === to &&
        r.mode === "walking" &&
        r.durationSeconds > MAX_AUTO_WALK_MINUTES * 60,
    )
  );
}
