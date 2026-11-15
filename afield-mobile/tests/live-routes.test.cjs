const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  ts = require("typescript");
const cache = new Map();
function load(f) {
  f = path.resolve(f);
  if (cache.has(f)) return cache.get(f);
  const m = { exports: {} };
  cache.set(f, m.exports);
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(f, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      module: m,
      exports: m.exports,
      require: (n) =>
        n.startsWith(".")
          ? load(path.resolve(path.dirname(f), n + ".ts"))
          : require(n),
      Date,
      Map,
      Set,
      URL,
      AbortController,
      setTimeout,
      clearTimeout,
    },
  );
  return m.exports;
}
const p = load("src/planner.ts"),
  ai = load("src/aiPlanner.ts"),
  { bestRoute } = load("src/routeFacts.ts");
function fixture() {
  const t = {
    id: "t",
    city: "Tokyo",
    name: "Trip",
    start: "2027-01-31",
    end: "2027-02-02",
    days: p.makeDays
      ? p.makeDays("2027-01-31", "2027-02-02")
      : [
          { date: "2027-01-31", items: [] },
          { date: "2027-02-01", items: [] },
          { date: "2027-02-02", items: [] },
        ],
    candidates: ["a", "b"],
    importedPlaces: ["a", "b"].map((id) => ({
      id,
      name: id,
      query: id,
      category: "관광",
      area: "Tokyo",
      description: "",
      image: "",
      sourcePostIds: [],
      matchStatus: "confirmed",
    })),
  };
  t.planning = p.defaultConditions(t);
  t.planning.buffer = 10;
  t.planning.stays = [
    {
      id: "hotel",
      name: "Hotel",
      query: "hotel",
      checkIn: "2027-01-31",
      checkOut: "2027-02-02",
      inTime: "15:00",
      outTime: "11:00",
    },
  ];
  return t;
}
const time = "2026-11-15T00:00:00Z";
function facts() {
  return {
    provider: "Google Maps",
    retrievedAt: time,
    routes: ["hotel", "a", "b"].flatMap((from) =>
      ["hotel", "a", "b"].flatMap((to) =>
        ["walking", "transit"].map((mode) => ({
          from,
          to,
          mode,
          durationSeconds: mode === "walking" ? 3600 : 1200,
          distanceMeters: 2000,
          retrievedAt: time,
        })),
      ),
    ),
  };
}
function suggestion(placeId, time) {
  return {
    type: "ADD",
    placeId,
    date: "2027-02-01",
    time,
    reason: "동선 제안",
  };
}
test("directional times reach the AI wire; lodging travel plus buffer rejects impossible start", () => {
  const t = fixture(),
    f = facts(),
    body = ai.encodePlanRequest(ai.buildPlanRequest(t, f)).payload;
  assert.equal(body.routeContext.routes.length, 18);
  assert.match(body.request, /LIVE ROUTE DATA/);
  assert.match(body.request, /durationSeconds/);
  const d = ai.decodePlan(t, { suggestions: [suggestion("a", "09:10")] }, f);
  assert.equal(d.rows.length, 0);
  assert.match(d.unplaced[0].reason, /이동 20분.*여유 10분/);
  assert.equal(t.days[0].items.length, 0);
});
test("selected-only apply rechecks direct edge after deselecting an intermediate stop", () => {
  const t = fixture(),
    f = facts();
  for (const r of f.routes)
    if (r.from === "a" && r.to === "hotel") r.durationSeconds = 36000;
  const d = ai.decodePlan(
    t,
    { suggestions: [suggestion("a", "09:30"), suggestion("b", "11:00")] },
    f,
  );
  assert.equal(d.rows.length, 2);
  t.planDraft = d;
  const unchanged = JSON.stringify(t.days);
  const result = p.applyDraft([t], t.id, [d.rows[0].id]);
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(t.days), unchanged);
  const both = p.applyDraft(
    [t],
    t.id,
    d.rows.map((r) => r.id),
  );
  assert.equal(both.ok, true);
  assert.equal(both.trips[0].days[1].items.filter((e) => e.placeId).length, 2);
});
test("missing route fails closed and fastest allowed mode is directional", () => {
  const t = fixture(),
    f = facts();
  f.routes = f.routes.filter((r) => r.from !== "hotel" || r.to !== "a");
  const d = ai.decodePlan(t, { suggestions: [suggestion("a", "10:00")] }, f);
  assert.equal(d.rows.length, 0);
  assert.match(d.unplaced[0].reason, /경로를 확인하지 못/);
  assert.equal(bestRoute(f, "a", "hotel", ["walking"]).durationSeconds, 3600);
  assert.equal(
    bestRoute(f, "a", "hotel", ["walking", "transit"]).mode,
    "transit",
  );
});
const { matrix } = require("../scripts/maps-bridge.cjs");
test("matrix maps out-of-order indices and excludes unavailable elements rather than inventing zero times", async () => {
  let body;
  const result = await matrix(
    ["address-a", "address-b"],
    ["walking"],
    async (url, o) => {
      body = JSON.parse(o.body);
      assert.match(url, /computeRouteMatrix/);
      assert.match(o.headers["X-Goog-FieldMask"], /status/);
      return {
        ok: true,
        json: async () => [
          {
            originIndex: 1,
            destinationIndex: 0,
            condition: "ROUTE_EXISTS",
            duration: "100s",
            distanceMeters: 80,
          },
          {
            originIndex: 0,
            destinationIndex: 1,
            status: { code: 5 },
            condition: "ROUTE_NOT_FOUND",
          },
        ],
      };
    },
    "fixture-only",
  );
  assert.equal(body.origins[0].waypoint.address, "address-a");
  assert.equal(result.routes.length, 1);
  assert.equal(result.routes[0].from, "address-b");
  assert.equal(result.routes[0].to, "address-a");
  assert.equal(result.routes[0].durationSeconds, 100);
});

test("constraint scheduling fills undecided places with measured routes without changing existing entries", () => {
  const { fillRouteSlots } = load("src/routeScheduling.ts");
  const t = fixture(),
    f = facts();
  t.planning.rangeStart = "2027-02-01";
  t.planning.rangeEnd = "2027-02-01";
  t.days[1].items = [
    {
      id: "locked",
      name: "Reserved",
      time: "15:00",
      durationMinutes: 60,
      must: true,
      location: { label: "Reserved", query: "b", description: "" },
    },
  ];
  const before = JSON.stringify(t.days);
  const draft = ai.decodePlan(t, { suggestions: [] }, f);
  const filled = fillRouteSlots(t, draft, f);
  assert.equal(filled.length, 2);
  assert.equal(p.validateRows(t, t.planning, filled, f).accepted.length, 2);
  assert.equal(JSON.stringify(t.days), before);
  assert.ok(filled.every((r) => r.reason.includes("Google 이동 시간")));
});
