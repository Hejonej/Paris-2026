const fs = require("node:fs");
const path = require("node:path");
const configPath =
  process.env.AFIELD_MAPS_CONFIG_PATH ||
  path.join(__dirname, "..", ".afield-maps.local.json");
function readConfig() {
  try {
    const c = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return { apiKey: typeof c.googleApiKey === "string" ? c.googleApiKey : "" };
  } catch {
    return { apiKey: "" };
  }
}
function saveKey(apiKey) {
  if (typeof apiKey !== "string" || !/^[A-Za-z0-9_-]{20,200}$/.test(apiKey))
    throw Error("키 형식을 확인해 주세요.");
  fs.writeFileSync(
    configPath,
    JSON.stringify({ googleApiKey: apiKey }, null, 2),
    { mode: 0o600 },
  );
  fs.chmodSync(configPath, 0o600);
}
async function computeRoute(
  { from, to, mode },
  fetcher = fetch,
  key = readConfig().apiKey,
) {
  if (!key) throw Error("개발용 Google Routes API 키를 먼저 저장해 주세요.");
  if (
    typeof from !== "string" ||
    typeof to !== "string" ||
    !from.trim() ||
    !to.trim() ||
    from.length > 400 ||
    to.length > 400
  )
    throw Error("출발·도착 주소를 확인해 주세요.");
  const modes = { walking: "WALK", transit: "TRANSIT", driving: "DRIVE" };
  if (!modes[mode]) throw Error("이동 방식을 선택해 주세요.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetcher(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
        },
        body: JSON.stringify({
          origin: { address: from.trim() },
          destination: { address: to.trim() },
          travelMode: modes[mode],
          ...(mode === "driving"
            ? { routingPreference: "TRAFFIC_UNAWARE" }
            : {}),
        }),
        signal: controller.signal,
      },
    );
    const result = await response.json();
    if (!response.ok) {
      const status = String(result?.error?.status || "PROVIDER_ERROR").replace(
        /[^A-Z_]/g,
        "",
      );
      throw Error(
        status === "PERMISSION_DENIED"
          ? "Google 권한 오류예요. Routes API 사용 설정·결제 계정·API 키 제한을 확인해 주세요."
          : `Google 경로 조회를 완료하지 못했어요 (${status}).`,
      );
    }
    const route = result?.routes?.[0];
    const duration =
      typeof route?.duration === "string" &&
      /^\d+(?:\.\d+)?s$/.test(route.duration)
        ? Number(route.duration.slice(0, -1))
        : NaN;
    if (
      !Number.isFinite(duration) ||
      duration < 0 ||
      !Number.isFinite(route?.distanceMeters) ||
      route.distanceMeters < 0
    )
      throw Error(
        "이 이동 방식의 경로를 찾지 못했어요. 다른 방식이나 주소를 확인해 주세요.",
      );
    return {
      provider: "Google Maps",
      mode,
      durationSeconds: duration,
      distanceMeters: route.distanceMeters,
      retrievedAt: new Date().toISOString(),
      timeBasis: "조회 시점 참고 · 여행 날짜의 시간표 확정 아님",
    };
  } catch (e) {
    if (controller.signal.aborted)
      throw Error("지도 연결이 지연돼요. 다시 시도해 주세요.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
module.exports = { readConfig, saveKey, computeRoute, configPath };
