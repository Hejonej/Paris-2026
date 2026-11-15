// Reuse the web app's existing calculation endpoint; it does not persist a trip.
const { readConfig } = require("./maps-dev.cjs");
async function webGeography(input, fetcher = fetch, key = readConfig().apiKey) {
  if (
    !input ||
    !Array.isArray(input.places) ||
    input.places.length < 1 ||
    input.places.length > 12 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.end)
  )
    throw Error("동선 구성 입력을 확인해 주세요.");
  if (
    input.places.some(
      (p) =>
        !p ||
        typeof p.id !== "string" ||
        typeof p.name !== "string" ||
        typeof p.query !== "string" ||
        !p.query.trim() ||
        p.query.length > 400,
    )
  )
    throw Error("동선에 사용할 장소 주소를 확인해 주세요.");
  const unique = [...new Set(input.places.map((p) => p.query))];
  if (unique.length === 1)
    return {
      source: "web_geographic_grouping",
      groups: [{ date: input.start, placeIds: input.places.map((p) => p.id) }],
    };
  const resolved = new Map();
  for (let i = 0; i < unique.length; i += 2) {
    const a = unique[i],
      b = unique[i + 1] || unique[0];
    const r = await fetcher(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask":
            "geocodingResults,routes.legs.startLocation,routes.legs.endLocation",
        },
        body: JSON.stringify({
          origin: { address: a },
          destination: { address: b },
          travelMode: "WALK",
        }),
        signal: AbortSignal.timeout(20000),
      },
    );
    const d = await r.json();
    const leg = d.routes?.[0]?.legs?.[0];
    if (!r.ok || !leg) throw Error("동선 구성용 위치를 확인하지 못했어요.");
    for (const [query, g, loc] of [
      [a, d.geocodingResults?.origin, leg.startLocation],
      [b, d.geocodingResults?.destination, leg.endLocation],
    ]) {
      const lat = loc?.latLng?.latitude,
        lng = loc?.latLng?.longitude;
      if (
        !g?.placeId ||
        g.partialMatch ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      )
        throw Error("주소가 정확한 장소로 연결되는지 확인해 주세요.");
      resolved.set(query, { placeId: g.placeId, lat, lng });
    }
  }
  const places = input.places.map((p) => ({
    ...resolved.get(p.query),
    name: p.name,
    address: p.query,
    category: p.category || "Other",
  }));
  let result;
  try {
    const response = await fetcher(
      "https://travel-ai.luckyjungheywon.workers.dev/optimize-trip",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          city: String(input.city || ""),
          country: String(input.country || ""),
          start: input.start,
          end: input.end,
          places,
          stays: [],
          transports: [],
        }),
        signal: AbortSignal.timeout(30000),
      },
    );
    result = await response.json();
    if (!response.ok || !Array.isArray(result.plan?.days))
      throw Error("웹 동선 엔진을 완료하지 못했어요.");
  } catch {
    return localGrouping(input, resolved);
  }
  const groups = [];
  const used = new Set();
  for (const day of result.plan.days) {
    if (
      typeof day.date !== "string" ||
      day.date < input.start ||
      day.date > input.end
    )
      continue;
    const ids = [];
    for (const p of day.items || []) {
      const matches = input.places.filter(
        (local) => resolved.get(local.query)?.placeId === p.placeId,
      );
      for (const match of matches)
        if (!used.has(match.id)) {
          ids.push(match.id);
          used.add(match.id);
        }
    }
    groups.push({ date: day.date, placeIds: ids });
  }
  return { source: "web_geographic_grouping", groups };
}
// Port of app-core.html hkm/enrichPlanLayers: cluster nearby saved places, then order neighbors.
function localGrouping(input, resolved) {
  const start = Date.parse(input.start + "T00:00:00Z"),
    end = Date.parse(input.end + "T00:00:00Z");
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end < start ||
    end - start > 365 * 86400000
  )
    throw Error("동선 구성 기간을 확인해 주세요.");
  const dates = Array.from(
    { length: Math.round((end - start) / 86400000) + 1 },
    (_, i) => new Date(start + i * 86400000).toISOString().slice(0, 10),
  );
  const remaining = [...input.places];
  const groups = [];
  const distance = (a, b) => {
    const x = resolved.get(a.query),
      y = resolved.get(b.query);
    if (!x || !y) return Infinity;
    const rad = (n) => (n * Math.PI) / 180;
    const q =
      Math.sin(rad(y.lat - x.lat) / 2) ** 2 +
      Math.cos(rad(x.lat)) *
        Math.cos(rad(y.lat)) *
        Math.sin(rad(y.lng - x.lng) / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(q));
  };
  dates.forEach((date, i) => {
    const count = Math.ceil(remaining.length / (dates.length - i));
    const group = [];
    while (group.length < count && remaining.length) {
      let best = 0,
        cost = Infinity;
      if (group.length)
        remaining.forEach((p, index) => {
          const d = Math.min(...group.map((a) => distance(p, a)));
          if (d < cost) {
            cost = d;
            best = index;
          }
        });
      group.push(remaining.splice(best, 1)[0]);
    }
    const ordered = [];
    while (group.length) {
      let best = 0,
        cost = Infinity;
      if (ordered.length)
        group.forEach((p, index) => {
          const d = distance(p, ordered[ordered.length - 1]);
          if (d < cost) {
            cost = d;
            best = index;
          }
        });
      ordered.push(group.splice(best, 1)[0]);
    }
    groups.push({ date, placeIds: ordered.map((p) => p.id) });
  });
  return {
    source: "web_local_geographic_grouping",
    groups,
    warning:
      "확인된 위치를 기준으로 가까운 장소를 묶고 방문 순서를 구성했어요. 영업시간과 미확인 교통시간은 별도로 확인해야 해요.",
  };
}
module.exports = { webGeography, localGrouping };
