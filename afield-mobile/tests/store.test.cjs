const test = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");
const fs = require("node:fs");
const vm = require("node:vm");
const React = require("react");
const { create, act } = require("react-test-renderer");
global.IS_REACT_ACT_ENVIRONMENT = true;
function moduleFor(path, storage) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const resolver = (name) =>
    name === "@react-native-async-storage/async-storage"
      ? storage
      : name === "./data"
        ? moduleFor("src/data.ts", storage)
        : name === "./routing"
          ? moduleFor("src/routing.ts", storage)
          : name === "./tripEditing"
            ? moduleFor("src/tripEditing.ts", storage)
            : name === "./planning"
              ? moduleFor("src/planning.ts", storage)
              : require(name);
  vm.runInNewContext(source, {
    exports: module.exports,
    module,
    require: resolver,
    Date,
    Math,
    Set,
  });
  return module.exports;
}
async function mount(storage) {
  const { TripProvider, useTrips } = moduleFor("src/store.tsx", storage);
  let current;
  let tree;
  function Consumer() {
    current = useTrips();
    return null;
  }
  await act(async () => {
    tree = create(
      React.createElement(TripProvider, null, React.createElement(Consumer)),
    );
  });
  return {
    get current() {
      return current;
    },
    close: async () => act(async () => tree.unmount()),
  };
}
test("new trip, candidate and explicit plan persist and restore across a provider restart", async () => {
  let raw = null;
  const storage = {
    getItem: async () => raw,
    setItem: async (key, value) => {
      raw = value;
    },
  };
  const first = await mount(storage);
  assert.equal(first.current.ready, true);
  let id;
  await act(async () => {
    id = first.current.create("가을 파리", "Paris", "2026-11-12", "2026-11-13");
    first.current.saveCandidate(id, "ofr");
    first.current.saveCandidate(id, "ofr");
  });
  await act(async () => {
    assert.equal(
      first.current.place(id, "ofr", "Ofr. Paris", "2026-11-13", "11:00").ok,
      true,
    );
  });
  await first.close();
  const restored = await mount(storage);
  const trip = restored.current.trips.find((t) => t.id === id);
  assert.equal(trip.name, "가을 파리");
  assert.equal(trip.candidates.length, 1);
  assert.equal(trip.days[0].items.length, 0);
  assert.equal(trip.days[1].items.length, 1);
  assert.equal(restored.current.trips[0].days[0].items[0].must, true);
  await restored.close();
});
test("failed or corrupt reads do not overwrite saved data", async () => {
  for (const raw of ["{bad json}", JSON.stringify([{ id: "bad" }])]) {
    let writes = 0;
    const view = await mount({
      getItem: async () => raw,
      setItem: async () => {
        writes++;
      },
    });
    assert.equal(view.current.loadFailed, true);
    assert.equal(writes, 0);
    assert.ok(view.current.error);
    await view.close();
  }
});
test("write failures are visible and a later write can recover", async () => {
  let failed = true;
  const view = await mount({
    getItem: async () => null,
    setItem: async () => {
      if (failed) throw Error("disk");
    },
  });
  await act(async () => view.current.saveCandidate("paris", "ofr"));
  assert.ok(view.current.error);
  failed = false;
  await act(async () => view.current.saveCandidate("paris", "carnavalet"));
  assert.equal(view.current.error, "");
  assert.equal(view.current.trips[0].candidates.length, 2);
  await view.close();
});

test("editing trip dates persists without changing candidates or schedules", async () => {
  let raw = null;
  const storage = {
    getItem: async () => raw,
    setItem: async (k, v) => {
      raw = v;
    },
  };
  const view = await mount(storage);
  await act(async () => view.current.saveCandidate("paris", "ofr"));
  await act(async () => {
    const result = view.current.edit("paris", {
      name: "가을 파리",
      city: "Paris",
      start: "2026-11-11",
      end: "2026-11-17",
    });
    assert.equal(result.ok, true);
  });
  await act(async () => {
    assert.equal(
      view.current.edit("paris", {
        name: "bad",
        city: "Paris",
        start: "",
        end: "",
      }).ok,
      false,
    );
  });
  await view.close();
  const restored = await mount(storage);
  const trip = restored.current.trips.find((t) => t.id === "paris");
  assert.equal(trip.name, "가을 파리");
  assert.equal(trip.start, "2026-11-11");
  assert.equal(trip.days[1].items[0].must, true);
  assert.equal(trip.candidates[0], "ofr");
  await restored.close();
});

test("location links and per-leg travel modes survive restart without moving entries", async () => {
  let raw = null;
  const storage = {
    getItem: async () => raw,
    setItem: async (k, v) => {
      raw = v;
    },
  };
  const view = await mount(storage);
  await act(async () => {
    assert.equal(
      view.current.bindLocation("paris", "2026-11-12", "original-1", {
        label: "출발지",
        query: "Square du Temple, Paris",
        description: "산책 출발",
      }).ok,
      true,
    );
    assert.equal(
      view.current.setMode(
        "paris",
        "2026-11-12",
        "original-1",
        "original-2",
        "transit",
      ).ok,
      true,
    );
  });
  await view.close();
  const restored = await mount(storage);
  const day = restored.current.trips[0].days[0];
  assert.equal(day.items[0].location.query, "Square du Temple, Paris");
  assert.equal(day.items[0].must, true);
  assert.equal(day.items[1].time, "14:00");
  assert.equal(
    day.travelModes[JSON.stringify(["original-1", "original-2"])],
    "transit",
  );
  await restored.close();
});
