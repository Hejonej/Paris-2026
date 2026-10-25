const test = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");
const fs = require("node:fs");
const vm = require("node:vm");
function load(path) {
  const output = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    exports: module.exports,
    module,
    require,
    Date,
    Math,
    Set,
  });
  return module.exports;
}
const { trips, makeDays } = load("src/data.ts");
const { addCandidate, addToPlan } = load("src/planning.ts");
test("candidate saving is trip-scoped, idempotent and does not schedule", () => {
  const before = JSON.stringify(trips);
  const next = addCandidate(
    addCandidate(trips, "paris", "ofr"),
    "paris",
    "ofr",
  );
  assert.equal(next[0].candidates.length, 1);
  assert.equal(next[1], trips[1]);
  assert.equal(next[0].days, trips[0].days);
  assert.equal(JSON.stringify(trips), before);
});
test("occupied time protects existing MUST and all user entries", () => {
  const result = addToPlan(
    trips,
    "paris",
    "ofr",
    "Ofr. Paris",
    "2026-11-12",
    "10:00",
  );
  assert.equal(result.ok, false);
  assert.equal(result.trips, trips);
  assert.equal(trips[0].days[0].items[0].must, true);
});
test("explicit placement preserves originals, other dates, candidates and other trips", () => {
  const next = addToPlan(
    trips,
    "paris",
    "ofr",
    "Ofr. Paris",
    "2026-11-12",
    "11:00",
  );
  assert.equal(next.ok, true);
  const day = next.trips[0].days[0];
  assert.equal(day.items.length, 3);
  assert.equal(day.items[0], trips[0].days[0].items[0]);
  assert.equal(day.items[2], trips[0].days[0].items[1]);
  assert.equal(next.trips[0].days[1], trips[0].days[1]);
  assert.equal(next.trips[1], trips[1]);
  assert.equal(next.trips[0].candidates.length, 0);
  assert.equal(
    addToPlan(next.trips, "paris", "ofr", "Ofr. Paris", "2026-11-12", "12:00")
      .ok,
    false,
  );
});
test("undated trip and invalid time reject placement", () => {
  assert.equal(
    addToPlan(trips, "berlin", "ofr", "Ofr", "2026-11-12", "11:00").ok,
    false,
  );
  assert.equal(
    addToPlan(trips, "paris", "ofr", "Ofr", "2026-11-12", "25:00").ok,
    false,
  );
});
test("date range crosses month and year without leaking seed days", () => {
  assert.equal(makeDays("2026-12-31", "2027-01-02").length, 3);
  assert.equal(makeDays("2026-12-31", "2026-12-30").length, 0);
  assert.equal(makeDays("2026-01-01", "2026-03-01").length, 60);
  assert.equal(trips[1].days.length, 0);
});
