import { Platform } from "react-native";
import Constants from "expo-constants";
import type { TravelMode, Trip } from "./data";
import { entryLocation } from "./routing";
import { dayBase, planningModes, readyPlaces, localToday } from "./planner";
import { validRouteContext } from "./routeFacts";
import type { RouteContext, RouteFact } from "./routeFacts";
async function connection(signal?: AbortSignal) {
  let token = Constants.expoConfig?.extra?.devRoutesToken;
  let host = Constants.expoConfig?.hostUri;
  let url = "";
  if (Platform.OS === "web" && typeof window !== "undefined") {
    url = window.location.origin;
    if (!token) {
      const response = await fetch(url + "/", {
        headers: { accept: "application/expo+json", "expo-platform": "ios" },
        signal,
      });
      const manifest = await response.json();
      token = manifest.extra?.expoClient?.extra?.devRoutesToken;
    }
  } else if (host) {
    url = (
      /^(https?:)?\/\//.test(host)
        ? host
        : `${host.includes("exp.direct") ? "https" : "http"}://${host}`
    ).replace(/\/$/, "");
  }
  if (typeof token !== "string" || !token || !url)
    throw Error(
      "개발용 지도 연결이 꺼져 있어요. 맥북의 Expo를 다시 실행해 주세요.",
    );
  return { token, url };
}
async function call(body: object, signal?: AbortSignal) {
  const { token, url } = await connection(signal);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort);
  if (signal?.aborted) abort();
  const timer = setTimeout(abort, 90000);
  try {
    const r = await fetch(url + "/afield-dev/routes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "1",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await r.json();
    if (!r.ok) throw Error(data.message || "이동 시간 조회에 실패했어요.");
    return data;
  } catch (e) {
    if (controller.signal.aborted)
      throw Error(
        signal?.aborted
          ? "지도 조회를 취소했어요."
          : "지도 조회 시간이 초과됐어요. 다시 시도해 주세요.",
      );
    throw e;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
export async function planningRoutes(
  trip: Trip,
  signal?: AbortSignal,
): Promise<RouteContext> {
  const c = trip.planning!;
  const used = new Set(
    trip.days.flatMap((d) =>
      d.items.map((e) => e.placeId || e.location?.placeId),
    ),
  );
  const addresses = new Set(
    readyPlaces(trip)
      .filter((p) => c.selectedIds.includes(p.id) && !used.has(p.id))
      .map((p) => p.query),
  );
  for (const d of trip.days.filter(
    (d) =>
      d.date >= localToday() &&
      d.date >= (c.rangeStart || trip.start) &&
      d.date <= (c.rangeEnd || trip.end),
  )) {
    const b = dayBase(trip, c, d.date);
    if (b.origin?.query) addresses.add(b.origin.query);
    if (b.destination?.query) addresses.add(b.destination.query);
    for (const e of d.items) {
      const l = entryLocation(e);
      if (l?.query) addresses.add(l.query);
    }
    for (const a of b.anchors) if (a.query) addresses.add(a.query);
  }
  if (addresses.size > 12)
    throw Error(
      "개발 단계에서는 한 번에 주소 12개까지 동선을 비교해요. 제안 기간이나 선택한 장소를 줄여 주세요.",
    );
  const data = await call(
    { addresses: [...addresses], modes: planningModes(c) },
    signal,
  );
  if (!validRouteContext(data))
    throw Error("지도 응답 형식을 확인하지 못했어요.");
  data.policyVersion = 2;
  if (
    planningModes(c).includes("transit") &&
    /japan|일본|日本|東京|tokyo|도쿄|osaka|오사카|kyoto|교토|fukuoka|후쿠오카|sapporo|삿포로|nagoya|나고야|yokohama|요코하마/i.test(
      (trip.country || "") + " " + trip.city,
    )
  ) {
    data.warnings = [
      "Google API는 일본 대중교통 시간을 제공하지 않아요. 긴 도보 시간으로 대신 배치하지 않으며, 전철·버스 시간은 Google Maps 앱에서 확인해야 해요.",
    ];
  }
  return data;
}
const legCache = new Map<string, RouteFact>();
export async function liveLeg(
  from: string,
  to: string,
  mode: TravelMode,
  signal?: AbortSignal,
): Promise<RouteFact> {
  const k = JSON.stringify([from, to, mode]);
  const old = legCache.get(k);
  if (old && Date.now() - Date.parse(old.retrievedAt) < 3600000) return old;
  const r = await call({ kind: "leg", from, to, mode }, signal);
  const fact = { ...r, from, to };
  if (
    !validRouteContext({
      provider: "Google Maps",
      retrievedAt: r.retrievedAt,
      routes: [fact],
    })
  )
    throw Error("지도 응답을 확인하지 못했어요.");
  legCache.set(k, fact);
  return fact;
}
