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
  const openedUrls = [];
  const storage = {
    getItem: async () => raw,
    setItem: async (k, v) => {
      raw = v;
    },
  };
  const native = Object.fromEntries(
    [
      "View",
      "Text",
      "ScrollView",
      "Pressable",
      "Image",
      "TextInput",
      "KeyboardAvoidingView",
    ].map((name) => [name, name]),
  );
  native.Platform = { OS: "ios" };
  native.StyleSheet = { create: (x) => x };
  native.Alert = { alert: () => {} };
  native.Linking = {
    openURL: async (url) => {
      openedUrls.push(url);
    },
  };
  const router = {
    canGoBack: () => false,
    replace: (target) => navigation.push(target),
    back: () => navigation.push({ back: true }),
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
        return {
          useLocalSearchParams: () => params,
          useGlobalSearchParams: () => params,
          useRouter: () => router,
        };
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
    openedUrls,
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

async function mountEditor(h) {
  const { TripProvider, useTrips } = h.load("src/store.tsx");
  const Editor = h.load("src/app/trip/[tripId]/edit.tsx").default;
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
        React.createElement(Editor),
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
test("edit form saves new dates for an undated trip and returns to its source", async () => {
  const h = harness({ tripId: "berlin" });
  const view = await mountEditor(h);
  await act(async () => {
    view.tree.root
      .findAllByType("TextInput")
      .find((n) => n.props.accessibilityLabel === "시작일")
      .props.onChangeText("2026-12-01");
    view.tree.root
      .findAllByType("TextInput")
      .find((n) => n.props.accessibilityLabel === "종료일")
      .props.onChangeText("2026-12-03");
  });
  const button = view.tree.root.findAll(
    (n) => n.type === "Text" && n.children.includes("변경사항 저장"),
  )[0].parent;
  assert.equal(button.props.disabled, false);
  await act(async () => button.props.onPress());
  assert.equal(view.store.trips[1].days.length, 3);
  assert.equal(h.navigation[0].back, true);
  await act(async () => view.tree.unmount());
});
test("edit form blocks removing scheduled dates and stays open", async () => {
  const h = harness({ tripId: "paris" });
  const view = await mountEditor(h);
  const before = JSON.stringify(view.store.trips);
  await act(async () => {
    view.tree.root
      .findAllByType("TextInput")
      .find((n) => n.props.accessibilityLabel === "시작일")
      .props.onChangeText("2026-11-14");
  });
  const button = view.tree.root.findAll(
    (n) => n.type === "Text" && n.children.includes("변경사항 저장"),
  )[0].parent;
  await act(async () => button.props.onPress());
  assert.equal(JSON.stringify(view.store.trips), before);
  assert.equal(h.navigation.length, 0);
  assert.ok(words(view.tree).includes("기존 일정이 있어요"));
  await act(async () => view.tree.unmount());
});

async function mountScreen(h, file) {
  const { TripProvider, useTrips } = h.load("src/store.tsx");
  const Screen = h.load(file).default;
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
        React.createElement(Screen),
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
test("timeline defaults to walking and opens a selected mode with fixed endpoints", async () => {
  const h = harness({ tripId: "paris" });
  const view = await mountScreen(
    h,
    "src/app/trip/[tripId]/(tabs)/itinerary.tsx",
  );
  assert.ok(words(view.tree).includes("출발지와 도착 장소를 지정해 주세요."));
  assert.equal(h.openedUrls.length, 0);
  await act(async () => {
    view.store.bindLocation("paris", "2026-11-12", "original-1", {
      label: "시작점",
      query: "Square du Temple, Paris",
      description: "산책 시작",
    });
    view.store.bindLocation("paris", "2026-11-12", "original-2", {
      label: "Ofr",
      query: "Ofr Paris bookstore",
      description: "책 구경",
    });
  });
  let route = view.tree.root.findAll(
    (n) =>
      n.type === "Pressable" &&
      n.props.accessibilityLabel ===
        "Le Marais 탐색에서 독립서점 방문까지 도보 경로 찾기",
  )[0];
  assert.ok(route);
  const transit = view.tree.root.findAll(
    (n) =>
      n.type === "Pressable" &&
      n.props.accessibilityLabel ===
        "Le Marais 탐색에서 독립서점 방문까지 대중교통",
  )[0];
  await act(async () => transit.props.onPress());
  route = view.tree.root.findAll(
    (n) =>
      n.type === "Pressable" &&
      n.props.accessibilityLabel ===
        "Le Marais 탐색에서 독립서점 방문까지 대중교통 경로 찾기",
  )[0];
  await act(async () => route.props.onPress());
  const url = new URL(h.openedUrls[0]);
  assert.equal(url.searchParams.get("origin"), "Square du Temple, Paris");
  assert.equal(url.searchParams.get("destination"), "Ofr Paris bookstore");
  assert.equal(url.searchParams.get("travelmode"), "transit");
  assert.equal(view.store.trips[0].days[0].items[0].must, true);
  await act(async () => view.tree.unmount());
});
test("entry editor binds a selected place without replacing the user schedule name", async () => {
  const h = harness({
    tripId: "paris",
    date: "2026-11-12",
    entryId: "original-1",
  });
  const view = await mountScreen(
    h,
    "src/app/trip/[tripId]/entry/[entryId].tsx",
  );
  const place = view.tree.root.findAll(
    (n) =>
      n.type === "Pressable" &&
      n.findAll(
        (x) => x.type === "Text" && x.children.join("").includes("Ofr. Paris"),
      ).length,
  )[0];
  await act(async () => place.props.onPress());
  const save = view.tree.root.findAll(
    (n) => n.type === "Text" && n.children.includes("이 일정에 장소 연결"),
  )[0].parent;
  await act(async () => save.props.onPress());
  const entry = view.store.trips[0].days[0].items[0];
  assert.equal(entry.name, "Le Marais 탐색");
  assert.equal(entry.must, true);
  assert.equal(entry.location.placeId, "ofr");
  assert.equal(h.navigation[0].back, true);
  await act(async () => view.tree.unmount());
});
test("detail back button has a trip-home fallback when opened without history", async () => {
  const h = harness({ tripId: "paris" });
  const Back = h.load("src/back.tsx").DetailBack;
  let tree;
  await act(async () => {
    tree = create(React.createElement(Back));
  });
  await act(async () => tree.root.findByType("Pressable").props.onPress());
  assert.equal(h.navigation[0].pathname, "/trip/[tripId]");
  assert.equal(h.navigation[0].params.tripId, "paris");
  await act(async () => tree.unmount());
});
