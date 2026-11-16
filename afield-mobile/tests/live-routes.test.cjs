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
    if (r.from === "a" && r.to === "hotel") r.durationSeconds = 43200;
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

test("mixed walking/transit never silently substitutes a 193-minute walk when transit is unavailable", () => {
  const f = {
    provider: "Google Maps",
    retrievedAt: time,
    routes: [
      {
        from: "a",
        to: "b",
        mode: "walking",
        durationSeconds: 193 * 60,
        distanceMeters: 14000,
        retrievedAt: time,
      },
    ],
  };
  assert.equal(
    load("src/routeFacts.ts").assessRoute(f, "a", "b", ["walking", "transit"])
      .kind,
    "missing",
  );
  assert.equal(bestRoute(f, "a", "b", ["walking"]).durationSeconds, 193 * 60);
  f.routes.push({
    from: "a",
    to: "b",
    mode: "transit",
    durationSeconds: 26 * 60,
    distanceMeters: 14000,
    retrievedAt: time,
  });
  assert.equal(bestRoute(f, "a", "b", ["walking", "transit"]).mode, "transit");
});

test("a missing route between two unrelated protected entries does not block every insertion", () => {
  const { fillRouteSlots } = load("src/routeScheduling.ts");
  const t = fixture();
  t.planning.stays = [];
  t.planning.selectedIds = ["a"];
  t.planning.rangeStart = "2027-02-01";
  t.planning.rangeEnd = "2027-02-01";
  t.planning.pace = "active";
  t.days[1].items = [
    ["x", "08:00"],
    ["y", "11:00"],
    ["z", "17:00"],
  ].map(([name, time]) => ({
    id: name,
    name,
    time,
    must: true,
    durationMinutes: 60,
    location: { label: name, query: name, description: "" },
  }));
  const f = {
    provider: "Google Maps",
    retrievedAt: time,
    routes: [
      ["x", "a"],
      ["a", "y"],
    ].map(([from, to]) => ({
      from,
      to,
      mode: "walking",
      durationSeconds: 600,
      distanceMeters: 600,
      retrievedAt: time,
    })),
  };
  const before = JSON.stringify(t.days),
    filled = fillRouteSlots(t, ai.decodePlan(t, { suggestions: [] }, f), f);
  assert.equal(filled.length, 1);
  assert.ok(filled[0].time >= "09:00" && filled[0].time < "11:00");
  assert.equal(JSON.stringify(t.days), before);
});

test("failed full search reports all considered days, not one failed provisional edge as the whole explanation", () => {
  const { fillRouteSlots } = load("src/routeScheduling.ts");
  const t = fixture();
  t.planning.selectedIds = ["a"];
  t.planning.rangeStart = "2027-02-01";
  t.planning.rangeEnd = "2027-02-01";
  const f = facts();
  f.routes = f.routes.filter((r) => r.mode === "walking");
  for (const r of f.routes) r.durationSeconds = 193 * 60;
  const report = new Map();
  const rows = fillRouteSlots(
    t,
    ai.decodePlan(t, { suggestions: [] }, f),
    f,
    report,
  );
  assert.equal(rows.length, 0);
  assert.match(report.get("a"), /후보 시간 \d+개/);
  assert.match(report.get("a"), /대중교통 시간이 확인되지/);
  assert.equal(report.get("a").includes("193분"), false);
});

test("geographic proposal marks unavailable transit pending and cannot apply without explicit acknowledgement", () => {
  const t = fixture();
  t.planning.selectedIds = ["a"];
  t.planning.stays = [];
  t.planning.rangeStart = t.planning.rangeEnd = "2027-02-01";
  t.days[1].items = [
    {
      id: "reserved-b",
      name: "b",
      time: "18:00",
      durationMinutes: 60,
      must: true,
      location: { label: "b", query: "b", description: "" },
    },
  ];
  const f = facts();
  f.allowUnverifiedTransit = true;
  f.routes = f.routes.filter((r) => r.mode === "walking");
  for (const r of f.routes) r.durationSeconds = 193 * 60;
  const d = ai.decodePlan(t, { suggestions: [suggestion("a", "15:00")] }, f);
  assert.equal(d.rows.length, 1);
  assert.equal(d.pendingTransfers.length, 1);
  assert.equal(d.pendingTransfers[0].planSlotMinutes, 30);
  assert.match(d.rows[0].reason, /미확인/);
  assert.equal(d.rows[0].reason.includes("193분"), false);
  t.planDraft = d;
  const before = JSON.stringify(t.days);
  assert.equal(p.applyDraft([t], t.id, [d.rows[0].id]).ok, false);
  assert.equal(JSON.stringify(t.days), before);
  const approved = p.applyDraft([t], t.id, [d.rows[0].id], true);
  assert.equal(approved.ok, true);
  assert.equal(
    approved.trips[0].days[1].items.find((e) => e.placeId === "a")
      .needsTransitCheck,
    true,
  );
  assert.equal(
    approved.trips[0].days[1].items.find((e) => e.id === "reserved-b").time,
    "18:00",
  );
});
const { webGeography } = require("../scripts/web-geography.cjs");
test("web optimization receives resolved Google IDs and maps only supplied places back to mobile IDs", async () => {
  let calls = 0;
  const result = await webGeography(
    {
      city: "Tokyo",
      country: "Japan",
      start: "2027-02-01",
      end: "2027-02-01",
      places: [
        { id: "local-a", name: "A", query: "Address A" },
        { id: "local-b", name: "B", query: "Address B" },
      ],
    },
    async (url, options) => {
      calls++;
      if (calls === 1) {
        assert.match(url, /computeRoutes/);
        return {
          ok: true,
          json: async () => ({
            geocodingResults: {
              origin: { placeId: "google-a" },
              destination: { placeId: "google-b" },
            },
            routes: [
              {
                legs: [
                  {
                    startLocation: { latLng: { latitude: 35, longitude: 139 } },
                    endLocation: {
                      latLng: { latitude: 35.1, longitude: 139.1 },
                    },
                  },
                ],
              },
            ],
          }),
        };
      }
      assert.match(url, /optimize-trip/);
      const body = JSON.parse(options.body);
      assert.equal(body.places[0].placeId, "google-a");
      assert.equal(body.places[0].lat, 35);
      return {
        ok: true,
        json: async () => ({
          plan: {
            days: [
              {
                date: "2027-02-01",
                items: [
                  { placeId: "google-b" },
                  { placeId: "invented" },
                  { placeId: "google-a" },
                  { placeId: "google-b" },
                ],
              },
            ],
          },
        }),
      };
    },
    "test-only-key",
  );
  assert.equal(calls, 2);
  assert.deepEqual(result.groups[0].placeIds, ["local-b", "local-a"]);
  assert.equal(JSON.stringify(result).includes("test-only-key"), false);
});
test("ambiguous resolution never fabricates coordinates or calls the web optimizer", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      webGeography(
        {
          start: "2027-02-01",
          end: "2027-02-01",
          places: [
            { id: "a", name: "A", query: "A" },
            { id: "b", name: "B", query: "B" },
          ],
        },
        async () => {
          calls++;
          return {
            ok: true,
            json: async () => ({
              geocodingResults: {
                origin: { placeId: "a", partialMatch: true },
              },
              routes: [
                {
                  legs: [
                    {
                      startLocation: {
                        latLng: { latitude: 35, longitude: 139 },
                      },
                    },
                  ],
                },
              ],
            }),
          };
        },
        "test-only-key",
      ),
    /주소/,
  );
  assert.equal(calls, 1);
});

test("ported web grouping keeps nearby places together when the legacy calculation endpoint fails", () => {
  const { localGrouping } = require("../scripts/web-geography.cjs");
  const input = {
    start: "2027-02-01",
    end: "2027-02-02",
    places: ["a", "b", "c", "d"].map((id) => ({ id, query: id })),
  };
  const points = new Map([
    ["a", { lat: 35.67, lng: 139.76 }],
    ["b", { lat: 35.66, lng: 139.7 }],
    ["c", { lat: 35.671, lng: 139.761 }],
    ["d", { lat: 35.661, lng: 139.701 }],
  ]);
  const grouped = localGrouping(input, points);
  assert.deepEqual(
    grouped.groups.map((g) => g.placeIds),
    [
      ["a", "c"],
      ["b", "d"],
    ],
  );
  assert.equal(grouped.source, "web_local_geographic_grouping");
  assert.equal(new Set(grouped.groups.flatMap((g) => g.placeIds)).size, 4);
});

test("18 legacy entries do not reserve fixed visit durations when inserting an undecided place", () => {
  const { fillRouteSlots } = load("src/routeScheduling.ts");
  const t = fixture();
  t.start = "2027-02-01";
  t.end = "2027-02-03";
  t.days = ["2027-02-01", "2027-02-02", "2027-02-03"].map((date, day) => ({
    date,
    items: [
      ...["10:00", "13:00", "16:00"].map((time, i) => ({
        id: `visit-${day}-${i}`,
        name: `Existing ${i}`,
        time,
        placeId: `old-${day}-${i}`,
        durationMinutes: 60,
        location: { label: `Existing ${i}`, query: "b", description: "" },
      })),
      ...[
        ["점심", "12:30", 60, "meal"],
        ["휴식", "16:30", 30, "cafe"],
        ["저녁", "18:30", 60, "meal"],
      ].map(([name, time, durationMinutes, tag]) => ({
        id: `${name}-${day}`,
        name,
        time,
        durationMinutes,
        tag,
        origin: "ai",
        anchorKey: `${name}-${date}`,
      })),
    ].sort((a, b) => a.time.localeCompare(b.time)),
  }));
  t.planning = p.defaultConditions(t);
  t.planning.selectedIds = ["a"];
  t.planning.durations = { a: 240 };
  const f = facts();
  f.allowUnverifiedTransit = true;
  f.routes = f.routes.filter((r) => r.mode === "walking");
  for (const r of f.routes) r.durationSeconds = 193 * 60;
  const before = JSON.stringify(t.days);
  assert.equal(t.days.flatMap((d) => d.items).length, 18);
  const filled = fillRouteSlots(t, ai.decodePlan(t, { suggestions: [] }, f), f);
  assert.equal(filled.length, 1);
  assert.equal(filled[0].duration, 0);
  const d = ai.decodePlan(
    t,
    { suggestions: filled.map((r) => suggestion(r.placeId, r.time, r.date)) },
    f,
  );
  assert.equal(d.rows.length, 1);
  t.planDraft = d;
  const applied = p.applyDraft(
    [t],
    t.id,
    d.rows.map((r) => r.id),
    true,
  );
  assert.equal(applied.ok, true);
  assert.equal(JSON.stringify(t.days), before);
  assert.equal(
    applied.trips[0].days.flatMap((d) => d.items).find((e) => e.placeId === "a")
      .durationMinutes,
    undefined,
  );
});
test("ordinary visits ignore legacy dwell settings while real reservation intervals still block arrival", () => {
  const t = fixture();
  t.planning.stays = [];
  t.planning.selectedIds = ["a"];
  t.planning.rangeStart = t.planning.rangeEnd = "2027-02-01";
  t.days[1].items = [
    {
      id: "ordinary",
      name: "Ordinary",
      time: "09:00",
      durationMinutes: 240,
      must: true,
    },
  ];
  let d = ai.decodePlan(t, { suggestions: [suggestion("a", "09:30")] });
  assert.equal(d.rows.length, 1);
  assert.equal(d.rows[0].duration, 0);
  t.planning.fixed = [
    {
      id: "booking",
      name: "Reserved",
      date: "2027-02-01",
      time: "10:00",
      duration: 120,
      query: "b",
    },
  ];
  d = ai.decodePlan(t, { suggestions: [suggestion("a", "11:00")] });
  assert.equal(d.rows.length, 0);
  t.planning.durations = { a: 240 };
  const body = ai.buildPlanRequest(t);
  assert.equal("durationMinutes" in body.places[0], false);
  assert.equal(Object.keys(body.conditions.durations).length, 0);
  assert.match(body.request, /NO fixed stay duration/);
  assert.equal(
    ai.decodePlan(t, { suggestions: [suggestion("a", t.planning.end)] }).rows
      .length,
    0,
  );
});

test("verified walking versus transit always uses the shortest allowed duration even over 30 minutes", () => {
  const f = facts();
  for (const r of f.routes)
    if (r.from === "a" && r.to === "b")
      r.durationSeconds = r.mode === "walking" ? 35 * 60 : 45 * 60;
  assert.equal(bestRoute(f, "a", "b", ["walking", "transit"]).mode, "walking");
  assert.equal(
    load("src/routeFacts.ts").assessRoute(f, "a", "b", ["walking", "transit"])
      .minutes,
    35,
  );
  for (const r of f.routes)
    if (r.from === "a" && r.to === "b" && r.mode === "transit")
      r.durationSeconds = 20 * 60;
  assert.equal(bestRoute(f, "a", "b", ["walking", "transit"]).mode, "transit");
  assert.equal(bestRoute(f, "a", "b", ["walking"]).mode, "walking");
});
test("wizard navigation metadata does not invalidate a reviewed plan or change the scheduling snapshot", () => {
  const t = fixture();
  t.planDraft = ai.decodePlan(t, { suggestions: [suggestion("a", "10:00")] });
  const before = p.planningSnapshot(t);
  const saved = p.savePlanning([t], t.id, { ...t.planning, wizardStep: 1 });
  assert.equal(saved.ok, true);
  assert.equal(saved.trips[0].planDraft.id, t.planDraft.id);
  assert.equal(p.planningSnapshot(saved.trips[0]), before);
});
