// Development-only middleware. Never import from the React Native bundle.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { webGeography } = require("./web-geography.cjs");
const { readConfig, computeRoute } = require("./maps-dev.cjs");
const { searchPlaces } = require("./places-dev.cjs");
const sessionPath = path.join(__dirname, "..", ".afield-bridge.local.json");
function session() {
  if (!readConfig().apiKey) return "";
  try {
    const c = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
    if (/^[a-f0-9]{64}$/.test(c.token)) return c.token;
  } catch {}
  const token = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(sessionPath, JSON.stringify({ token }), { mode: 0o600 });
  return token;
}
const cache = new Map();
let elements = 0,
  active = false;
const modeMap = { walking: "WALK", transit: "TRANSIT", driving: "DRIVE" };
async function matrix(
  addresses,
  modes,
  fetcher = fetch,
  key = readConfig().apiKey,
) {
  if (!key) throw Error("맥북에서 개발용 지도 키를 먼저 저장해 주세요.");
  if (
    !Array.isArray(addresses) ||
    addresses.length < 1 ||
    addresses.length > 12 ||
    new Set(addresses).size !== addresses.length ||
    addresses.some(
      (a) => typeof a !== "string" || !a.trim() || a.length > 400,
    ) ||
    !Array.isArray(modes) ||
    !modes.length ||
    modes.length > 3 ||
    new Set(modes).size !== modes.length ||
    modes.some((m) => !modeMap[m])
  )
    throw Error(
      "한 번에 비교할 주소는 최대 12개예요. 제안받을 기간이나 장소를 줄여 주세요.",
    );
  const cacheKey = JSON.stringify([addresses, modes]);
  const old = cache.get(cacheKey);
  if (old && Date.now() - old.at < 3600000) return old.value;
  const count = addresses.length ** 2 * modes.length;
  if (elements + count > 2400)
    throw Error(
      "개발용 지도 조회 한도에 도달했어요. 이번 서버 세션은 2,400개 구간까지 조회해요.",
    );
  elements += count;
  const routes = [];
  const retrievedAt = new Date().toISOString();
  for (const mode of modes)
    for (let i = 0; i < addresses.length; i += 8)
      for (let j = 0; j < addresses.length; j += 8) {
        const origins = addresses.slice(i, i + 8),
          destinations = addresses.slice(j, j + 8);
        const response = await fetcher(
          "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": key,
              "X-Goog-FieldMask":
                "originIndex,destinationIndex,status,condition,distanceMeters,duration",
            },
            body: JSON.stringify({
              origins: origins.map((address) => ({ waypoint: { address } })),
              destinations: destinations.map((address) => ({
                waypoint: { address },
              })),
              travelMode: modeMap[mode],
              ...(mode === "driving"
                ? { routingPreference: "TRAFFIC_UNAWARE" }
                : {}),
            }),
            signal: AbortSignal.timeout(25000),
          },
        );
        const data = await response.json();
        if (!response.ok || !Array.isArray(data))
          throw Error(
            "Google 이동 시간 조회를 완료하지 못했어요. 지도 권한·결제·사용량 한도를 확인해 주세요.",
          );
        for (const r of data) {
          const oi = r.originIndex ?? 0,
            di = r.destinationIndex ?? 0;
          if (
            !Number.isInteger(oi) ||
            !Number.isInteger(di) ||
            !origins[oi] ||
            !destinations[di] ||
            r.status?.code ||
            r.condition !== "ROUTE_EXISTS" ||
            !/^\d+(?:\.\d+)?s$/.test(r.duration) ||
            !Number.isFinite(r.distanceMeters) ||
            r.distanceMeters < 0
          )
            continue;
          routes.push({
            from: origins[oi],
            to: destinations[di],
            mode,
            durationSeconds: Number(r.duration.slice(0, -1)),
            distanceMeters: r.distanceMeters,
            retrievedAt,
          });
        }
      }
  const value = { provider: "Google Maps", retrievedAt, routes };
  cache.set(cacheKey, { at: Date.now(), value });
  if (cache.size > 30) cache.delete(cache.keys().next().value);
  return value;
}
function middleware(token = session()) {
  return async (req, res, next) => {
    if (req.url?.split("?")[0] !== "/afield-dev/routes") return next();
    const send = (status, data) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(data));
    };
    if (!token || req.headers.authorization !== `Bearer ${token}`)
      return send(401, { message: "개발용 지도 연결을 다시 시작해 주세요." });
    if (req.method !== "POST") return send(405, { message: "POST only" });
    if (active)
      return send(429, {
        message: "다른 지도 조회가 진행 중이에요. 잠시 후 다시 시도해 주세요.",
      });
    try {
      let raw = "";
      for await (const c of req) {
        raw += c;
        if (raw.length > 12000) throw Error("지도 요청이 너무 커요.");
      }
      const data = JSON.parse(raw);
      if (active)
        return send(429, { message: "다른 지도 조회가 진행 중이에요." });
      active = true;
      if (["leg", "place-search"].includes(data.kind) && ++elements > 2400)
        throw Error("개발용 지도 조회 한도에 도달했어요.");
      let result =
        data.kind === "place-search"
          ? await searchPlaces(data)
          : data.kind === "leg"
            ? await computeRoute(data)
            : await matrix(data.addresses, data.modes);
      result = { ...result };
      if (data.kind !== "leg" && data.geography) {
        if (elements + data.geography.places?.length > 2400)
          throw Error("개발용 지도 조회 한도예요.");
        elements += data.geography.places?.length || 0;
        try {
          result.geography = await webGeography(data.geography);
          if (result.geography.warning)
            result.warnings = [
              ...(result.warnings || []),
              result.geography.warning,
            ];
        } catch {
          result.warnings = [
            ...(result.warnings || []),
            "웹 동선 그룹을 확인하지 못해 확인된 위치 사이의 이동 비용으로 순서를 비교했어요.",
          ];
        }
      }
      return send(200, result);
    } catch (e) {
      return send(400, {
        message:
          e.name === "TimeoutError"
            ? "지도 조회 시간이 초과됐어요. 다시 시도해 주세요."
            : e.message || "지도 조회 실패",
      });
    } finally {
      active = false;
    }
  };
}
module.exports = { session, middleware, matrix };
