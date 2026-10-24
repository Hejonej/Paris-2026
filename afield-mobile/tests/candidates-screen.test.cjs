const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { create, act } = require("react-test-renderer");
global.IS_REACT_ACT_ENVIRONMENT = true;
function harness(params, initialRaw = null) {
  const cache = new Map();
  let raw = initialRaw;
  const navigation = [];
  const storage = {
    getItem: async () => raw,
    setItem: async (k, v) => {
      raw = v;
    },
  };
  const native = Object.fromEntries(
    ["View", "Text", "ScrollView", "Pressable", "Image", "TextInput"].map(
      (name) => [name, name],
    ),
  );
  native.StyleSheet = { create: (x) => x };
  native.Alert = { alert: () => {} };
  native.Linking = { openURL: async () => {} };
  const router = {
    push: (x) => navigation.push(x),
    dismissTo: (x) => navigation.push(x),
  };
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} };
    cache.set(file, mod);
    const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText;
    const resolver = (name) => {
      if (name === "react-native") return native;
      if (name === "expo-router")
        return { useLocalSearchParams: () => params, useRouter: () => router };
      if (name === "@react-native-async-storage/async-storage") return storage;
      if (name.endsWith(".jpg")) return 1;
      if (name.startsWith(".")) {
        const base = path.resolve(path.dirname(file), name);
        return load(
          [".ts", ".tsx"]
            .map((ext) => base + ext)
            .find((f) => fs.existsSync(f)),
        );
      }
      return require(name);
    };
    vm.runInNewContext(source, {
      module: mod,
      exports: mod.exports,
      require: resolver,
      Date,
      Math,
      Set,
    });
    return mod.exports;
  }
  return {
    load,
    get raw() {
      return raw;
    },
    navigation,
  };
}
function words(tree) {
  return JSON.stringify(tree.toJSON());
}
async function mount(h) {
  const { TripProvider, useTrips } = h.load("src/store.tsx");
  const Candidate = h.load(
    "src/app/trip/[tripId]/(tabs)/candidates.tsx",
  ).default;
  const Detail = h.load("src/app/trip/[tripId]/place/[placeId].tsx").default;
  let store;
  let tree;
  function Watch() {
    store = useTrips();
    return null;
  }
  await act(async () => {
    tree = create(
      React.createElement(
        TripProvider,
        null,
        React.createElement(Watch),
        React.createElement(
          "CandidateScreen",
          null,
          React.createElement(Candidate),
        ),
        React.createElement("DetailScreen", null, React.createElement(Detail)),
      ),
    );
  });
  return {
    tree,
    get store() {
      return store;
    },
  };
}
for (const arrayParams of [false, true])
  test(`detail save refreshes a mounted candidate tab; array params=${arrayParams}`, async () => {
    const h = harness(
      arrayParams
        ? { tripId: ["paris"], placeId: ["ofr"] }
        : { tripId: "paris", placeId: "ofr" },
    );
    const view = await mount(h);
    const before = JSON.stringify(view.store.trips[0].days);
    assert.ok(words(view.tree).includes("아직 후보가 없어요"));
    const save = view.tree.root.findAll(
      (x) => x.type === "Text" && x.children.includes("후보에 저장"),
    )[0].parent;
    await act(async () => save.props.onPress());
    const candidate = view.tree.root.findByType("CandidateScreen");
    assert.ok(
      JSON.stringify(
        candidate.findAllByType("Text").map((n) => n.children),
      ).includes("Ofr. Paris"),
    );
    assert.equal(view.store.trips[0].candidates.length, 1);
    assert.equal(JSON.stringify(view.store.trips[0].days), before);
    assert.equal(view.store.trips[1].candidates.length, 0);
    const go = view.tree.root.findAll(
      (x) => x.type === "Text" && x.children.includes("저장한 후보 보기 →"),
    )[0].parent;
    await act(async () => go.props.onPress());
    assert.equal(h.navigation[0].params.tripId, "paris");
    assert.ok(h.navigation[0].pathname.endsWith("/(tabs)/candidates"));
    await act(async () => view.tree.unmount());
    const restored = await mount(
      harness({ tripId: "paris", placeId: "ofr" }, h.raw),
    );
    assert.ok(
      JSON.stringify(
        restored.tree.root
          .findByType("CandidateScreen")
          .findAllByType("Text")
          .map((n) => n.children),
      ).includes("Ofr. Paris"),
    );
    await act(async () => restored.tree.unmount());
  });
test("an unknown trip cannot report a successful candidate save", async () => {
  const h = harness({ tripId: "paris", placeId: "ofr" });
  const view = await mount(h);
  let result;
  await act(async () => {
    result = view.store.saveCandidate("missing-trip", "ofr");
  });
  assert.equal(result.ok, false);
  assert.equal(view.store.trips[0].candidates.length, 0);
  await act(async () => view.tree.unmount());
});
