const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("fs"),
  path = require("path"),
  vm = require("vm"),
  ts = require("typescript");
const cache = new Map();
function load(f) {
  f = path.resolve(f);
  if (cache.has(f)) return cache.get(f);
  const m = { exports: {} };
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
      Math,
      Map,
      Set,
      URL,
    },
  );
  cache.set(f, m.exports);
  return m.exports;
}
const edit = load("src/manualEditing.ts"),
  { placeText } = load("src/placeText.ts");
function trip() {
  return {
    id: "t",
    name: "Trip",
    city: "Tokyo",
    start: "2027-02-01",
    end: "2027-02-02",
    candidates: ["a", "b"],
    days: [
      {
        date: "2027-02-01",
        items: [
          {
            id: "a",
            name: "A",
            time: "09:00",
            placeId: "a",
            customTag: "design",
          },
          {
            id: "fixed",
            name: "Booking",
            time: "12:00",
            anchorKey: "reservation",
          },
          { id: "b", name: "B", time: "15:00", placeId: "b", tag: "shopping" },
        ],
        travelModes: { '["a","fixed"]': "walking" },
      },
      { date: "2027-02-02", items: [] },
    ],
  };
}
test("slot reordering preserves every entry and pinned time; edits apply only after explicit commit", () => {
  const t = trip(),
    before = JSON.stringify(t);
  const r = edit.reorderSlots(t, t.days, t.start, "b", "a");
  assert.equal(r.ok, true);
  assert.equal(r.days[0].items[0].id, "b");
  assert.equal(r.days[0].items[0].time, "09:00");
  assert.equal(r.days[0].items.find((e) => e.id === "fixed").time, "12:00");
  assert.equal(JSON.stringify(t), before);
  const saved = edit.applyManualEdit([t], t.id, r.days, edit.editSnapshot(t));
  assert.equal(saved.ok, true);
  assert.equal(
    saved.trips[0].days[0].items.find((e) => e.id === "a").customTag,
    "design",
  );
  assert.equal(saved.trips[0].days[0].travelModes, undefined);
});
test("moving a date keeps identity and metadata, rejects duplicate destinations and conflicts", () => {
  const t = trip();
  const r = edit.moveToDate(t, t.days, "a", t.end);
  assert.equal(r.ok, true);
  assert.equal(
    r.days[0].items.some((e) => e.id === "a"),
    false,
  );
  assert.equal(r.days[1].items[0].id, "a");
  assert.equal(r.days[1].items[0].customTag, "design");
  assert.equal(edit.validateEdit(t, r.days), "");
  const overlap = edit.moveToDate(t, t.days, "a", t.start, "12:30");
  assert.match(edit.validateEdit(t, overlap.days), /겹쳐/);
  t.days[1].items = [
    { id: "copy", name: "A again", time: "17:00", placeId: "a" },
  ];
  const duplicate = edit.moveToDate(t, t.days, "a", t.end, "09:00");
  assert.match(edit.validateEdit(t, duplicate.days), /두 번/);
});
test("MUST, reservations, linked records, stale snapshots and unexpected metadata mutations are protected", () => {
  const t = trip();
  t.days[0].items[0].must = true;
  t.journal = [
    {
      id: "record",
      entryId: "b",
      date: t.start,
      note: "memo",
      placeName: "B",
      createdAt: new Date().toISOString(),
    },
  ];
  for (const id of ["a", "b", "fixed"])
    assert.equal(edit.moveToDate(t, t.days, id, t.end).ok, false);
  const clone = JSON.parse(JSON.stringify(t.days));
  clone[0].items[1].name = "Changed booking";
  assert.match(edit.validateEdit(t, clone), /보존/);
  assert.equal(edit.applyManualEdit([t], t.id, t.days, "stale").ok, false);
  const missing = JSON.parse(JSON.stringify(t.days));
  missing[0].items.pop();
  assert.match(edit.validateEdit(t, missing), /빠지거나/);
});
test("emoji cleanup preserves names, Japanese text, numbers and meaningful marks", () => {
  assert.equal(placeText("♟️ : IFUJI TOKYO"), "IFUJI TOKYO");
  assert.equal(placeText("🇯🇵 🫧 陶器店 2号店"), "陶器店 2号店");
  assert.equal(placeText("👨‍👩‍👧‍👦 A.P.C. & 2nd Street™"), "A.P.C. & 2nd Street™");
  assert.equal(placeText("1️⃣ 101 Store"), "1 101 Store");
});
