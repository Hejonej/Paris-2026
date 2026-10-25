const test = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");
const fs = require("node:fs");
const vm = require("node:vm");
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
const { editTrip, validateTripDetails } = load("src/tripEditing.ts");
const details = (trip) => ({
  name: trip.name,
  city: trip.city,
  start: trip.start,
  end: trip.end,
});
test("undated trip gets its own empty dates without Paris entries", () => {
  const result = editTrip(trips, "berlin", {
    ...details(trips[1]),
    start: "2026-12-30",
    end: "2027-01-02",
  });
  assert.equal(result.ok, true);
  assert.equal(result.trips[1].days.length, 4);
  assert.ok(result.trips[1].days.every((d) => d.items.length === 0));
  assert.equal(result.trips[0], trips[0]);
});
test("range extension preserves every original entry, MUST and candidates", () => {
  const source = trips.map((t) => ({ ...t, candidates: ["ofr"] }));
  const before = JSON.stringify(source);
  const result = editTrip(source, "paris", {
    ...details(source[0]),
    name: "  Autumn Paris  ",
    start: "2026-11-11",
    end: "2026-11-17",
  });
  assert.equal(result.ok, true);
  const trip = result.trips[0];
  assert.equal(trip.name, "Autumn Paris");
  assert.equal(trip.days[1], source[0].days[0]);
  assert.equal(trip.days[1].items[0].must, true);
  assert.equal(trip.candidates, source[0].candidates);
  assert.equal(trip.days[0].items.length, 0);
  assert.equal(JSON.stringify(source), before);
});
test("shrinking away an occupied day or clearing its dates rejects atomically", () => {
  for (const dates of [
    { start: "2026-11-13", end: "2026-11-16" },
    { start: "", end: "" },
  ]) {
    const result = editTrip(trips, "paris", {
      ...details(trips[0]),
      name: "changed",
      ...dates,
    });
    assert.equal(result.ok, false);
    assert.equal(result.trips, trips);
    assert.match(result.message, /2026.11.12/);
  }
});
test("empty edge days may be removed, and empty trip can return to undated", () => {
  const shrunk = editTrip(trips, "paris", {
    ...details(trips[0]),
    end: "2026-11-13",
  });
  assert.equal(shrunk.ok, true);
  assert.equal(shrunk.trips[0].days.length, 2);
  const dated = editTrip(trips, "berlin", {
    ...details(trips[1]),
    start: "2026-11-12",
    end: "2026-11-14",
  });
  const undated = editTrip(dated.trips, "berlin", {
    ...details(trips[1]),
    start: "",
    end: "",
  });
  assert.equal(undated.ok, true);
  assert.equal(undated.trips[1].days.length, 0);
});
test("invalid dates, reversed ranges, one-sided dates and missing names are rejected", () => {
  for (const patch of [
    { start: "2026-02-30", end: "2026-03-01" },
    { start: "2026-11-14", end: "2026-11-12" },
    { start: "2026-11-12", end: "" },
    { start: "2026-11-01", end: "2026-12-02" },
    { name: "  " },
    { city: "  " },
  ])
    assert.ok(validateTripDetails({ ...details(trips[0]), ...patch }));
  assert.equal(
    validateTripDetails({
      ...details(trips[1]),
      start: "2028-02-29",
      end: "2028-03-01",
    }),
    "",
  );
  assert.equal(editTrip(trips, "missing", details(trips[0])).ok, false);
});
