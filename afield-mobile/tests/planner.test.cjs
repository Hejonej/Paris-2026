const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  ts = require("typescript");
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const m = { exports: {} };
  cache.set(file, m.exports);
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
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
          ? load(path.resolve(path.dirname(file), n + ".ts"))
          : require(n),
      URL,
      AbortController,
      setTimeout,
      clearTimeout,
      Date,
      Math,
      Set,
      Map,
    },
  );
  return m.exports;
}
const planner = load("src/planner.ts"),
  ai = load("src/aiPlanner.ts");
function trip() {
  const t = {
    id: "test",
    name: "Test",
    city: "Sydney",
    country: "Australia",
    start: "2027-02-01",
    end: "2027-02-02",
    days: [
      { date: "2027-02-01", items: [] },
      { date: "2027-02-02", items: [] },
    ],
    candidates: ["p1", "p2", "meal"],
    inspirations: [
      {
        caption: "PRIVATE CAPTION DO NOT SEND",
        url: "https://instagram.com/p/PRIVATE/",
      },
    ],
    importedPlaces: [
      ["p1", "Test Gallery", "관광"],
      ["p2", "Test Shop", "쇼핑"],
      ["meal", "Test Restaurant", "식사"],
    ].map(([id, name, category]) => ({
      id,
      name,
      query: name + ", Test Street, Sydney",
      category,
      area: "Sydney",
      description: "PRIVATE DESCRIPTION",
      image: "",
      sourcePostIds: [],
      matchStatus: "confirmed",
    })),
  };
  t.planning = planner.defaultConditions(t);
  return t;
}
const suggestion = (placeId, time = "10:00", date = "2027-02-01") => ({
  type: "ADD",
  placeId,
  date,
  time,
  reason: "입력 조건을 고려한 제안",
});
test("request uses only confirmed selected locations, lodging origins and minimal data, never captions", () => {
  const t = trip();
  t.planning.stays = [
    {
      id: "hotel",
      name: "Test Hotel",
      query: "Test Street Sydney",
      checkIn: t.start,
      checkOut: t.end,
      inTime: "15:00",
      outTime: "11:00",
    },
  ];
  const r = ai.buildPlanRequest(t);
  assert.equal(r.dayConstraints[1].origin.name, "Test Hotel");
  assert.equal(JSON.stringify(r).includes("PRIVATE"), false);
  assert.equal(r.places.length, 3);
  assert.equal(r.preserveExistingPlan, true);
  t.importedPlaces[0].matchStatus = "needs_confirmation";
  assert.throws(() => ai.buildPlanRequest(t), /위치가 확인/);
});
test("invalid daily rhythm, dates, overlapping stays and unknown must selections fail before generation", () => {
  const t = trip();
  let c = { ...t.planning, start: "20:00", end: "09:00" };
  assert.match(planner.conditionsError(t, c), /종료/);
  c = { ...t.planning, mustIds: ["unknown"] };
  assert.match(planner.conditionsError(t, c), /필수/);
  c = {
    ...t.planning,
    stays: [
      {
        id: "a",
        name: "A",
        query: "A",
        checkIn: t.start,
        checkOut: t.end,
        inTime: "15:00",
        outTime: "11:00",
      },
      {
        id: "b",
        name: "B",
        query: "B",
        checkIn: t.start,
        checkOut: t.end,
        inTime: "15:00",
        outTime: "11:00",
      },
    ],
  };
  assert.match(planner.conditionsError(t, c), /겹쳐/);
});
test("late arrival shifts hotel check-in and an early departure shifts checkout before airport preparation", () => {
  const t = trip();
  t.planning.stays = [
    {
      id: "hotel",
      name: "Test Hotel",
      query: "Test Street",
      checkIn: t.start,
      checkOut: t.end,
      inTime: "15:00",
      outTime: "11:00",
    },
  ];
  t.planning.flights = [
    {
      id: "arrival",
      kind: "arrival",
      date: t.start,
      time: "18:00",
      query: "Airport",
      buffer: 120,
    },
    {
      id: "departure",
      kind: "departure",
      date: t.end,
      time: "08:00",
      query: "Airport",
      buffer: 120,
    },
  ];
  const first = planner.dayBase(t, t.planning, t.start),
    last = planner.dayBase(t, t.planning, t.end);
  assert.equal(
    first.anchors.find((r) => r.name.startsWith("체크인")).time,
    "20:30",
  );
  assert.equal(
    last.anchors.find((r) => r.name.startsWith("체크아웃")).time,
    "05:00",
  );
  assert.equal(last.end, 360);
});
test("airport buffers crossing midnight reserve the previous evening and the following morning", () => {
  const t = trip();
  t.planning.end = "23:30";
  t.planning.start = "00:00";
  t.planning.flights = [
    {
      id: "out",
      kind: "departure",
      date: t.end,
      time: "00:30",
      query: "Airport",
      buffer: 180,
    },
  ];
  const first = planner.dayBase(t, t.planning, t.start);
  assert.equal(first.end, 21 * 60 + 30);
  assert.equal(first.anchors.find((r) => r.kind === "flight").time, "21:30");
  t.planning.flights = [
    {
      id: "in",
      kind: "arrival",
      date: t.start,
      time: "23:00",
      query: "Airport",
      buffer: 180,
    },
  ];
  const second = planner.dayBase(t, t.planning, t.end);
  assert.equal(second.start, 120);
  assert.equal(second.anchors.find((r) => r.kind === "flight").duration, 120);
});
test("malicious unknown place, move operations, duplicates, bad dates and conflicts are filtered", () => {
  const t = trip();
  t.days[0].items = [
    {
      id: "must",
      time: "09:00",
      durationMinutes: 60,
      name: "User fixed",
      must: true,
    },
  ];
  const d = ai.decodePlan(t, {
    suggestions: [
      { type: "DROP", placeId: "p1", date: t.start, time: "11:00" },
      suggestion("unknown"),
      suggestion("p1", "09:30"),
      suggestion("p1", "11:00"),
      suggestion("p1", "14:00"),
      suggestion("p2", "25:00"),
      suggestion("p2", "10:00", "2027-03-01"),
    ],
  });
  assert.equal(d.rows.length, 1);
  assert.equal(d.rows[0].time, "11:00");
  assert.ok(d.issues.length >= 6);
  assert.equal(t.days[0].items[0].must, true);
});
test("restaurant replaces a meal slot only after explicit apply and source trips stay untouched", () => {
  const t = trip();
  const before = JSON.stringify(t.days);
  const d = ai.decodePlan(t, { suggestions: [suggestion("meal", "12:30")] });
  assert.equal(d.rows.length, 1);
  assert.equal(JSON.stringify(t.days), before);
  t.planDraft = d;
  const other = trip();
  other.id = "other";
  const r = planner.applyDraft([t, other], "test", [d.rows[0].id]);
  assert.equal(r.ok, true);
  assert.equal(r.trips[1], other);
  assert.equal(
    r.trips[0].days[0].items.filter((e) => e.time === "12:30").length,
    1,
  );
  assert.equal(
    r.trips[0].days[0].items.find((e) => e.time === "12:30").placeId,
    "meal",
  );
  assert.equal(t.planDraft, d);
  assert.equal(planner.applyDraft(r.trips, "test", [d.rows[0].id]).ok, false);
});
test("missing MUST, stale snapshots and selecting unknown rows reject the entire apply", () => {
  const t = trip();
  t.planning.mustIds = ["p2"];
  const d = ai.decodePlan(t, { suggestions: [suggestion("p1")] });
  t.planDraft = d;
  let r = planner.applyDraft([t], "test", [d.rows[0].id]);
  assert.equal(r.ok, false);
  assert.match(r.message, /꼭/);
  assert.equal(r.trips[0], t);
  t.planning.mustIds = [];
  r = planner.applyDraft([t], "test", [d.rows[0].id]);
  assert.match(r.message, /바뀌/);
  t.planDraft = ai.decodePlan(t, { suggestions: [suggestion("p1")] });
  assert.equal(planner.applyDraft([t], "test", ["unknown"]).ok, false);
});
test("all original entries including user tags, route preferences and MUST remain byte-identical on apply", () => {
  const t = trip();
  const original = {
    id: "existing",
    name: "Manual stop",
    time: "09:00",
    must: true,
    customTag: "내 태그",
    location: {
      label: "Known place",
      query: "Known Address",
      description: "User note",
    },
  };
  t.days[0].items = [original];
  t.days[0].travelModes = { '["existing","next"]': "transit" };
  t.planDraft = ai.decodePlan(t, { suggestions: [suggestion("p1", "11:00")] });
  const r = planner.applyDraft([t], "test", [t.planDraft.rows[0].id]);
  assert.equal(r.ok, true);
  assert.equal(
    r.trips[0].days[0].items.find((e) => e.id === "existing"),
    original,
  );
  assert.equal(
    r.trips[0].days[0].travelModes['["existing","next"]'],
    "transit",
  );
});
test("regeneration preserves previously applied anchors without duplicating them", () => {
  const t = trip();
  t.planDraft = ai.decodePlan(t, { suggestions: [suggestion("p1")] });
  const first = planner.applyDraft([t], "test", [t.planDraft.rows[0].id]);
  assert.equal(first.ok, true);
  const next = first.trips[0];
  next.planDraft = ai.decodePlan(next, {
    suggestions: [suggestion("p2", "14:00", "2027-02-02")],
  });
  assert.equal(next.planDraft.rows.length, 1);
  const second = planner.applyDraft([next], "test", [
    next.planDraft.rows[0].id,
  ]);
  assert.equal(second.ok, true);
  for (const day of second.trips[0].days)
    assert.equal(day.items.filter((e) => e.name === "점심").length, 1);
});
test("AI errors, malformed responses and cancellation do not mutate schedules", async () => {
  const t = trip(),
    before = JSON.stringify(t);
  await assert.rejects(
    () => ai.generatePlan(t, undefined, async () => ({ ok: false })),
    /AI 서비스/,
  );
  await assert.rejects(
    () =>
      ai.generatePlan(t, undefined, async () => ({
        ok: true,
        json: async () => ({ unexpected: [] }),
      })),
    /응답 형식/,
  );
  const ctrl = new AbortController();
  ctrl.abort();
  await assert.rejects(
    () =>
      ai.generatePlan(t, ctrl.signal, async () => ({
        ok: true,
        json: async () => ({ suggestions: [suggestion("p1")] }),
      })),
    /취소/,
  );
  assert.equal(JSON.stringify(t), before);
});
test("unknown facts in model output never become verified opening hours or real journey times", () => {
  const t = trip();
  const d = ai.decodePlan(t, {
    suggestions: [
      {
        ...suggestion("p1"),
        reason: "영업 중이며 도보 5분입니다",
        hours_status: "verified",
        hours_note: "guessed",
      },
    ],
  });
  assert.equal(d.rows.length, 1);
  assert.equal(JSON.stringify(d.rows).includes("verified"), false);
  assert.match(d.rows[0].reason, /별도 확인/);
  assert.ok(d.issues.some((s) => s.includes("자동 확인하지")));
});

test("legacy server prose is accepted only with one exact selected venue, date and time", () => {
  const t = trip();
  const d = ai.decodePlan(t, {
    suggestions: [
      {
        type: "ADD",
        action: "2027-02-01 10:00에 Test Gallery 추가",
        reason: "입력한 조건 기준",
      },
    ],
  });
  assert.equal(d.rows[0].placeId, "p1");
  for (const action of [
    "2027-02-01 10:00에 Test Gallery Annex 추가",
    "2027-02-01 10:00 Test Gallery 대신 Unknown Shop 추가",
    "2027-02-01 10:00~11:00 Test Gallery 추가",
    "2027-02-01 10:00 Test Gallery 추가 (placeId: p1000)",
  ])
    assert.equal(
      ai.decodePlan(t, { suggestions: [{ type: "ADD", action }] }).rows.length,
      0,
    );
  assert.equal(
    ai.decodePlan(t, {
      suggestions: [{ type: "ADD", action: "ADD|2027-02-01|10:00|p1" }],
    }).rows.length,
    1,
  );
  assert.equal(
    ai.decodePlan(t, {
      suggestions: [{ type: "DROP", action: "ADD|2027-02-01|10:00|p1" }],
    }).rows.length,
    0,
  );
});
test("a selected generation range never adds anchors or places to excluded days", () => {
  const t = trip();
  t.planning.rangeStart = "2027-02-02";
  t.planning.rangeEnd = "2027-02-02";
  const d = ai.decodePlan(t, {
    suggestions: [
      suggestion("p1", "10:00", "2027-02-01"),
      suggestion("p2", "10:00", "2027-02-02"),
    ],
  });
  assert.equal(d.rows.length, 1);
  assert.equal(d.rows[0].date, "2027-02-02");
  t.planDraft = d;
  const r = planner.applyDraft([t], "test", [d.rows[0].id]);
  assert.equal(r.ok, true);
  assert.equal(r.trips[0].days[0].items.length, 0);
});

test("more than 100 available venues require an explicit subset rather than silently taking the first 100", () => {
  const t = trip();
  t.importedPlaces = Array.from({ length: 101 }, (_, i) => ({
    ...t.importedPlaces[0],
    id: `many${i}`,
    name: `Test venue ${i}`,
  }));
  t.candidates = t.importedPlaces.map((p) => p.id);
  assert.equal(planner.defaultConditions(t).selectedIds.length, 0);
});
