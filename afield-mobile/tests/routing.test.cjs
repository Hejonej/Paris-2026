const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
function load(path) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    require: (name) =>
      name === "./data" ? load("src/data.ts") : require(name),
    Date,
    Math,
    Set,
  });
  return module.exports;
}
const { trips } = load("src/data.ts");
const { bindEntryLocation, setLegMode, legKey, entryLocation, directionsUrl } =
  load("src/routing.ts");
const address = {
  label: "산책 시작점",
  query: "Square du Temple, Paris, France",
  description: "산책을 시작해요",
};
test("unknown schedule locations never manufacture route endpoints", () => {
  assert.equal(entryLocation(trips[0].days[0].items[0]), undefined);
  assert.equal(
    directionsUrl(
      trips[0].days[0].items[0],
      trips[0].days[0].items[1],
      "walking",
    ),
    undefined,
  );
});
test("binding location preserves name, time, MUST, candidates and other trips", () => {
  const before = JSON.stringify(trips);
  const result = bindEntryLocation(
    trips,
    "paris",
    "2026-11-12",
    "original-1",
    address,
  );
  assert.equal(result.ok, true);
  const item = result.trips[0].days[0].items[0];
  assert.equal(item.name, "Le Marais 탐색");
  assert.equal(item.time, "10:00");
  assert.equal(item.must, true);
  assert.equal(item.location.query, address.query);
  assert.equal(result.trips[0].candidates, trips[0].candidates);
  assert.equal(result.trips[1], trips[1]);
  assert.equal(JSON.stringify(trips), before);
});
test("manual coordinates/search override an existing reference instead of keeping its old map", () => {
  const result = bindEntryLocation(
    trips,
    "paris",
    "2026-11-13",
    "original-3",
    address,
  );
  assert.equal(
    entryLocation(result.trips[0].days[1].items[0]).query,
    address.query,
  );
});
test("directions encode both fixed endpoints and every supported travel mode", () => {
  const from = {
    id: "a",
    time: "10:00",
    name: "A",
    location: { ...address, query: "公園 & Paris" },
  };
  const to = { id: "b", time: "11:00", name: "B", placeId: "ofr" };
  for (const mode of ["walking", "transit", "driving"]) {
    const url = new URL(directionsUrl(from, to, mode));
    assert.equal(url.searchParams.get("api"), "1");
    assert.equal(url.searchParams.get("origin"), "公園 & Paris");
    assert.equal(url.searchParams.get("destination"), "Ofr Paris bookstore");
    assert.equal(url.searchParams.get("travelmode"), mode);
  }
  assert.equal(directionsUrl(from, to, "flying"), undefined);
});
test("travel mode belongs to an adjacent directed pair and does not affect itinerary content", () => {
  const result = setLegMode(
    trips,
    "paris",
    "2026-11-12",
    "original-1",
    "original-2",
    "transit",
  );
  assert.equal(result.ok, true);
  assert.equal(
    result.trips[0].days[0].travelModes[legKey("original-1", "original-2")],
    "transit",
  );
  assert.equal(result.trips[0].days[0].items, trips[0].days[0].items);
  assert.equal(
    setLegMode(
      trips,
      "paris",
      "2026-11-12",
      "original-2",
      "original-1",
      "driving",
    ).ok,
    false,
  );
  assert.equal(
    setLegMode(
      trips,
      "paris",
      "2026-11-12",
      "original-1",
      "original-3",
      "walking",
    ).ok,
    false,
  );
  assert.equal(
    setLegMode(
      trips,
      "paris",
      "2026-11-12",
      "original-1",
      "original-2",
      "flying",
    ).ok,
    false,
  );
});
test("location input rejects missing or invalid targets without altering saved schedule", () => {
  for (const args of [
    ["missing", "2026-11-12", "original-1", address],
    ["paris", "2026-11-12", "missing", address],
    ["paris", "2026-11-12", "original-1", { ...address, query: " " }],
    ["paris", "2026-11-12", "original-1", { ...address, placeId: "missing" }],
  ]) {
    const result = bindEntryLocation(trips, ...args);
    assert.equal(result.ok, false);
    assert.equal(result.trips, trips);
  }
});
