const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path"),
  ts = require("typescript");
function load(file) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (n) =>
        n.startsWith(".")
          ? load(path.join(path.dirname(file), n + ".ts"))
          : require(n),
      URL,
      Date,
      Math,
      Set,
      Map,
    },
  );
  return module.exports;
}
const { trips } = load("src/data.ts"),
  { navigationUrl, entryLocation } = load("src/routing.ts"),
  { entryActivity, inferActivity, setEntryTag } = load("src/activities.ts"),
  { journeyStop, suggestWalkStart } = load("src/journey.ts");
test("place directions use the destination and omit origin for Maps current-location handling", () => {
  const url = new URL(
    navigationUrl({
      label: "박물관",
      query: "Musée Carnavalet, Paris",
      description: "",
    }),
  );
  assert.equal(url.pathname, "/maps/dir/");
  assert.equal(url.searchParams.get("destination"), "Musée Carnavalet, Paris");
  assert.equal(url.searchParams.has("origin"), false);
  assert.equal(url.searchParams.get("travelmode"), "walking");
  assert.equal(url.searchParams.get("dir_action"), "navigate");
});
test("activity labels distinguish shops, sights, meals, cafe breaks and accommodation", () => {
  for (const [name, tag] of [
    ["독립서점 방문", "shopping"],
    ["Le Marais 탐색", "sightseeing"],
    ["Musée Carnavalet", "sightseeing"],
    ["점심 식사", "meal"],
    ["Coffee break", "cafe"],
    ["호텔 체크인", "stay"],
    ["커피 원두 쇼핑", "shopping"],
    ["공항 이동", "transport"],
  ])
    assert.equal(inferActivity(name), tag);
  assert.equal(
    entryActivity({ id: "x", name: "카페 방문", time: "10:00", tag: "meal" }),
    "meal",
  );
  assert.equal(inferActivity("모호한 장소", "맛집·카페"), "other");
});
test("a Marais walk gets a usable suggested start without mutating saved schedules or MUST", () => {
  const trip = trips[0],
    day = trip.days[0],
    before = JSON.stringify(trip);
  const stop = journeyStop(trip, day, 0);
  assert.ok(stop.location.query.includes("Place des Vosges"));
  assert.equal(stop.suggestion.basis, "default");
  assert.equal(stop.entry.must, true);
  assert.equal(stop.entry.time, "10:00");
  assert.equal(JSON.stringify(trip), before);
  assert.equal(day.items[0].location, undefined);
});
test("known next stops change the suggested start by north/south Marais context", () => {
  const trip = trips[0];
  const day = {
    date: "2026-11-12",
    items: [
      trip.days[0].items[0],
      { id: "book", name: "Ofr", time: "14:00", placeId: "ofr" },
    ],
  };
  assert.ok(
    suggestWalkStart(trip, day, 0).location.query.includes("Rue de Bretagne"),
  );
  assert.equal(suggestWalkStart(trip, day, 0).basis, "next");
  day.items[1] = {
    id: "museum",
    name: "Carnavalet",
    time: "14:00",
    placeId: "carnavalet",
  };
  assert.ok(
    suggestWalkStart(trip, day, 0).location.query.includes("Place des Vosges"),
  );
});
test("the final Marais walk continues outside the preceding museum instead of asking for its place", () => {
  const trip = trips[0],
    day = trip.days[1];
  const previous = entryLocation(day.items[0]);
  const stop = journeyStop(trip, day, 1);
  assert.equal(stop.suggestion.basis, "previous");
  assert.equal(stop.suggestion.linkedEntryId, day.items[0].id);
  assert.equal(stop.location.query, previous.query);
  assert.equal(stop.location.placeId, undefined);
});
test("explicit user locations win and unrelated cities/previous airports are never used as Marais starts", () => {
  const trip = trips[0];
  const explicit = {
    label: "내 시작점",
    query: "My exact address",
    description: "유지",
  };
  const day = {
    date: "2026-11-12",
    items: [{ ...trip.days[0].items[0], location: explicit }],
  };
  assert.equal(suggestWalkStart(trip, day, 0), undefined);
  assert.equal(journeyStop(trip, day, 0).location, explicit);
  assert.equal(
    suggestWalkStart(
      { ...trip, city: "Berlin" },
      { date: "2026-11-12", items: [trip.days[0].items[0]] },
      0,
    ),
    undefined,
  );
  const airport = {
    date: "2026-11-12",
    items: [
      {
        id: "airport",
        name: "공항",
        time: "10:00",
        location: {
          label: "CDG",
          query: "Charles de Gaulle Airport",
          description: "",
        },
      },
      trip.days[1].items[1],
    ],
  };
  assert.equal(suggestWalkStart(trip, airport, 1).basis, "default");
});
test("manual activity changes preserve all times, locations, MUST and other trips", () => {
  const before = JSON.stringify(trips);
  const result = setEntryTag(
    trips,
    "paris",
    "2026-11-12",
    "original-1",
    "shopping",
  );
  assert.equal(result.ok, true);
  assert.equal(result.trips[0].days[0].items[0].tag, "shopping");
  assert.equal(result.trips[0].days[0].items[0].must, true);
  assert.equal(result.trips[0].days[0].items[0].time, "10:00");
  assert.equal(result.trips[1], trips[1]);
  assert.equal(JSON.stringify(trips), before);
  assert.equal(
    setEntryTag(trips, "paris", "2026-11-12", "original-1", "invalid").ok,
    false,
  );
});
