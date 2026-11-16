import type { TravelMode } from "./data";
export type RouteFact = {
  from: string;
  to: string;
  mode: TravelMode;
  durationSeconds: number;
  distanceMeters: number;
  retrievedAt: string;
};
export type PendingTransfer = {
  date: string;
  from: string;
  to: string;
  fromName: string;
  toName: string;
  planSlotMinutes: number;
  rowIds: string[];
};
export type RouteContext = {
  allowUnverifiedTransit?: boolean;
  geography?: {
    source: "web_geographic_grouping" | "web_local_geographic_grouping";
    warning?: string;
    groups: { date: string; placeIds: string[] }[];
  };
  warnings?: string[];
  policyVersion?: 2 | 3;
  provider: "Google Maps";
  retrievedAt: string;
  routes: RouteFact[];
};
export function validRouteContext(value: unknown): value is RouteContext {
  const v = value as RouteContext;
  return (
    !!v &&
    v.provider === "Google Maps" &&
    (v.allowUnverifiedTransit === undefined ||
      typeof v.allowUnverifiedTransit === "boolean") &&
    (v.geography === undefined ||
      (["web_geographic_grouping", "web_local_geographic_grouping"].includes(
        v.geography.source,
      ) &&
        Array.isArray(v.geography.groups) &&
        v.geography.groups.length <= 366 &&
        v.geography.groups.every(
          (g) =>
            typeof g.date === "string" &&
            Array.isArray(g.placeIds) &&
            g.placeIds.every((id) => typeof id === "string"),
        ))) &&
    (v.policyVersion === undefined ||
      v.policyVersion === 2 ||
      v.policyVersion === 3) &&
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
    .filter((r) => r.from === from && r.to === to && modes.includes(r.mode))
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
        (!modes.includes("walking") ||
          r.durationSeconds > MAX_AUTO_WALK_MINUTES * 60),
    )
  );
}

export function assessRoute(
  facts: RouteContext,
  from: string,
  to: string,
  modes: TravelMode[],
) {
  if (from === to) return { kind: "known" as const, minutes: 0 };
  const route = bestRoute(facts, from, to, modes);
  if (
    route &&
    !(route.mode === "walking" && transitUnavailable(facts, from, to, modes))
  )
    return {
      kind: "known" as const,
      minutes: Math.ceil(route.durationSeconds / 60),
      route,
    };
  if (
    facts.allowUnverifiedTransit &&
    transitUnavailable(facts, from, to, modes)
  )
    return { kind: "pending" as const, minutes: 30 };
  return { kind: "missing" as const, minutes: NaN };
}
