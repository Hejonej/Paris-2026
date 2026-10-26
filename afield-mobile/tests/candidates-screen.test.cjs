const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { create, act } = require("react-test-renderer");
global.IS_REACT_ACT_ENVIRONMENT = true;
function harness(params, initialRaw = null, options = {}) {
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
  native.Modal = ({ visible, children, ...props }) =>
    visible ? React.createElement("Modal", props, children) : null;
  native.ActivityIndicator = "ActivityIndicator";
  native.FlatList = ({
    data = [],
    renderItem,
    ListHeaderComponent,
    ListFooterComponent,
    ...props
  }) =>
    React.createElement(
      "FlatList",
      props,
      ListHeaderComponent,
      ListFooterComponent,
      ...data.map((item, index) =>
        React.createElement(
          React.Fragment,
          { key: item.id || index },
          renderItem({ item, index }),
        ),
      ),
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
    navigate: (x) => navigation.push(x),
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
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText;
    const resolver = (name) => {
      if (name === "expo-document-picker")
        return {
          getDocumentAsync: async () =>
            options.pickerResult || { canceled: true },
        };
      if (name === "expo-file-system/legacy")
        return {
          readAsStringAsync: async () => {
            if (options.legacyError) throw Error("legacy read error");
            return options.fileText || "";
          },
        };
      if (name === "expo-file-system")
        return {
          File: class {
            size = (options.fileText || "").length;
            async text() {
              if (options.readError) throw Error("read error");
              return options.fileText || "";
            }
          },
        };
      if (name === "@expo/vector-icons") return { Ionicons: "Icon" };
      if (name === "react-native") return native;
      if (name === "expo-router")
        return {
          useLocalSearchParams: () => params,
          useGlobalSearchParams: () => params,
          useRouter: () => router,
          useFocusEffect: (callback) => React.useEffect(callback, [callback]),
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
      URL,
      fetch:
        options.fetcher ||
        (async () => {
          throw Error("No test network configured");
        }),
      AbortController,
      setTimeout,
      clearTimeout,
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
    assert.ok(words(view.tree).includes("아직 저장한 장소가 없어요"));
    const save = view.tree.root.findAll(
      (x) => x.type === "Text" && x.children.includes("가고 싶은 곳에 저장"),
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
      (x) => x.type === "Text" && x.children.includes("가고 싶은 곳 보기 →"),
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
      .findAll(
        (n) => typeof n.type === "function" && n.type.name === "DateField",
      )
      .find((n) => n.props.label === "시작일")
      .props.onChange("2026-12-01");
    view.tree.root
      .findAll(
        (n) => typeof n.type === "function" && n.type.name === "DateField",
      )
      .find((n) => n.props.label === "종료일")
      .props.onChange("2026-12-03");
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
      .findAll(
        (n) => typeof n.type === "function" && n.type.name === "DateField",
      )
      .find((n) => n.props.label === "시작일")
      .props.onChange("2026-11-14");
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
  assert.ok(
    words(view.tree).includes("독립서점 방문에서 방문할 곳을 선택해 주세요."),
  );
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
  assert.equal(h.navigation[0].params.updatedEntry, "original-1");
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

test("calendar modal returns an actual selected day and leaves cancel unchanged", async () => {
  const h = harness({});
  const DateField = h.load("src/tripFields.tsx").DateField;
  const selected = [];
  let tree;
  await act(async () => {
    tree = create(
      React.createElement(DateField, {
        label: "시작일",
        value: "2026-11-12",
        onChange: (v) => selected.push(v),
      }),
    );
  });
  assert.equal(tree.root.findAllByType("Modal").length, 0);
  await act(async () =>
    tree.root
      .findAll(
        (n) =>
          n.type === "Pressable" &&
          n.props.accessibilityLabel === "시작일 달력 열기",
      )[0]
      .props.onPress(),
  );
  assert.equal(tree.root.findAllByType("Modal").length, 1);
  await act(async () =>
    tree.root
      .findAll(
        (n) =>
          n.type === "Pressable" && n.props.accessibilityLabel === "2026-11-15",
      )[0]
      .props.onPress(),
  );
  assert.deepEqual(selected, ["2026-11-15"]);
  assert.equal(tree.root.findAllByType("Modal").length, 0);
  await act(async () => tree.unmount());
});
test("new trip supports Korean city search, auto country and a calendar period over 31 days", async () => {
  const h = harness({});
  const view = await mountScreen(h, "src/app/new-trip.tsx");
  await act(async () => {
    view.tree.root
      .findAllByType("TextInput")
      .find((n) => n.props.accessibilityLabel === "여행 이름")
      .props.onChangeText("긴 여행");
    view.tree.root
      .findAllByType("TextInput")
      .find((n) => n.props.accessibilityLabel === "도시")
      .props.onChangeText("파리");
  });
  const city = view.tree.root.findAll(
    (n) =>
      n.type === "Pressable" &&
      n.props.accessibilityLabel === "Paris, France 선택",
  )[0];
  assert.ok(city);
  await act(async () => city.props.onPress());
  await act(async () => {
    const fields = view.tree.root.findAll(
      (n) => typeof n.type === "function" && n.type.name === "DateField",
    );
    fields.find((n) => n.props.label === "시작일").props.onChange("2026-12-01");
    fields.find((n) => n.props.label === "종료일").props.onChange("2027-02-01");
  });
  const submit = view.tree.root.findAll(
    (n) => n.type === "Text" && n.children.includes("챕터 만들기"),
  )[0].parent;
  await act(async () => submit.props.onPress());
  const trip = view.store.trips.find((t) => t.name === "긴 여행");
  assert.equal(trip.city, "Paris");
  assert.equal(trip.country, "France");
  assert.equal(trip.days.length, 63);
  await act(async () => view.tree.unmount());
});
test("cancelled and malformed JSON picking do not mutate existing trips", async () => {
  for (const options of [
    { pickerResult: { canceled: true } },
    {
      pickerResult: {
        canceled: false,
        assets: [{ name: "bad.json", uri: "file://mock" }],
      },
      fileText: "{broken",
    },
  ]) {
    const h = harness({ tripId: "paris" }, null, options);
    const view = await mountScreen(h, "src/app/trip/[tripId]/instagram.tsx");
    const before = JSON.stringify(view.store.trips);
    await act(async () =>
      view.tree.root
        .findAll(
          (n) => n.type === "Text" && n.children.includes("JSON 파일 선택"),
        )[0]
        .parent.props.onPress(),
    );
    assert.equal(JSON.stringify(view.store.trips), before);
    assert.equal(h.navigation.length, 0);
    await act(async () => view.tree.unmount());
  }
});
test("JSON screen imports only on approval and exposes imported posts after restart", async () => {
  const options = {
    pickerResult: {
      canceled: false,
      assets: [{ name: "saved.json", uri: "file://mock" }],
    },
    fileText: JSON.stringify([
      {
        name: "서점 저장",
        url: "https://instagram.com/p/TestImport01/",
        caption: "Ofr. Paris",
      },
    ]),
  };
  const h = harness({ tripId: "paris" }, null, options);
  const view = await mountScreen(h, "src/app/trip/[tripId]/instagram.tsx");
  const before = JSON.stringify(view.store.trips[0].days);
  await act(async () =>
    view.tree.root
      .findAll(
        (n) => n.type === "Text" && n.children.includes("JSON 파일 선택"),
      )[0]
      .parent.props.onPress(),
  );
  assert.ok(words(view.tree).includes("서점 저장"));
  assert.equal(view.store.trips[0].inspirations, undefined);
  const apply = view.tree.root.findAll(
    (n) =>
      n.type === "Text" && n.children.includes("선택한 1개 게시물 가져오기"),
  )[0].parent;
  await act(async () => apply.props.onPress());
  assert.equal(view.store.trips[0].inspirations.length, 1);
  assert.equal(view.store.trips[0].candidates.length, 0);
  assert.equal(JSON.stringify(view.store.trips[0].days), before);
  const postId = view.store.trips[0].inspirations[0].id;
  await act(async () => view.tree.unmount());
  const next = harness({ tripId: "paris", postId }, h.raw);
  const reviewed = await mountScreen(
    next,
    "src/app/trip/[tripId]/inspiration/[postId].tsx",
  );
  const checkbox = reviewed.tree.root.findAll(
    (n) => n.type === "Pressable" && n.props.accessibilityRole === "checkbox",
  )[0];
  await act(async () => checkbox.props.onPress());
  await act(async () =>
    reviewed.tree.root
      .findAll(
        (n) => n.type === "Text" && n.children.includes("저장하고 위치 확인 →"),
      )[0]
      .parent.props.onPress(),
  );
  const trip = reviewed.store.trips[0];
  assert.equal(trip.importedPlaces.length, 1);
  assert.equal(trip.importedPlaces[0].matchStatus, "needs_confirmation");
  assert.equal(trip.importedPlaces[0].sourcePostIds[0], postId);
  assert.equal(JSON.stringify(trip.days), before);
  await act(async () => reviewed.tree.unmount());
  const candidates = await mountScreen(
    harness({ tripId: "paris", section: "inspiration" }, next.raw),
    "src/app/trip/[tripId]/(tabs)/candidates.tsx",
  );
  assert.ok(words(candidates.tree).includes("서점 저장"));
  await act(async () =>
    candidates.tree.root
      .findAll((n) => n.type === "Text" && n.children.includes("장소 1"))[0]
      .parent.props.onPress(),
  );
  assert.ok(words(candidates.tree).includes("Ofr. Paris"));
  await act(async () => candidates.tree.unmount());
});

test("an imported candidate requires explicit location confirmation before scheduling", async () => {
  const h = harness({ tripId: "paris", placeId: "pending-import" });
  const view = await mountScreen(
    h,
    "src/app/trip/[tripId]/place/[placeId].tsx",
  );
  await act(async () => {
    view.store.importInstagram("paris", [
      {
        id: "source",
        name: "원본",
        url: "https://instagram.com/p/ManualPlaceTest/",
        caption: "Cafe Example",
        owner: "",
        username: "",
        collection: "Paris",
        category: "맛집·카페",
        candidates: [
          {
            id: "cafe",
            name: "Cafe Example",
            kind: "caption",
            confidence: "medium",
          },
        ],
      },
    ]);
  });
  const post = view.store.trips[0].inspirations[0];
  await act(async () =>
    view.store.confirmInstagram("paris", [
      { postId: post.id, candidateId: "cafe" },
    ]),
  );
  const target = view.store.trips[0].importedPlaces[0];
  const raw = h.raw;
  await act(async () => view.tree.unmount());
  const detail = await mountScreen(
    harness({ tripId: "paris", placeId: target.id }, raw),
    "src/app/trip/[tripId]/place/[placeId].tsx",
  );
  assert.equal(
    detail.tree.root.findAll(
      (n) =>
        n.type === "Text" && n.children.includes("이 날짜와 시간에 일정 추가"),
    ).length,
    0,
  );
  await act(async () =>
    detail.tree.root
      .findAllByType("TextInput")
      .find((n) => n.props.accessibilityLabel === "확인할 지도 검색어")
      .props.onChangeText("Exact Street, Paris"),
  );
  await act(async () =>
    detail.tree.root
      .findAll(
        (n) =>
          n.type === "Text" &&
          n.children.includes("이 위치가 맞아요 · 날짜 선택 →"),
      )[0]
      .parent.props.onPress(),
  );
  assert.equal(
    detail.store.trips[0].importedPlaces[0].matchStatus,
    "confirmed",
  );
  await act(async () =>
    detail.tree.root
      .findAll(
        (n) =>
          n.type === "Text" &&
          n.children.includes("이 날짜와 시간에 일정 추가"),
      )[0]
      .parent.props.onPress(),
  );
  const day = detail.store.trips[0].days[0];
  assert.equal(day.items.length, 3);
  assert.equal(day.items[0].must, true);
  assert.equal(
    day.items.find((i) => i.placeId === target.id).location.query,
    "Exact Street, Paris",
  );
  await act(async () => detail.tree.unmount());
});

test("13th museum offers current-location directions and the following walk starts there without an ambiguous prompt", async () => {
  const h = harness({ tripId: "paris", date: "2026-11-13" });
  const view = await mountScreen(
    h,
    "src/app/trip/[tripId]/(tabs)/itinerary.tsx",
  );
  const nakedText = [];
  function checkText(node, inText = false) {
    if (Array.isArray(node)) return node.forEach((n) => checkText(n, inText));
    if (node === null || node === undefined) return;
    if (typeof node === "string" || typeof node === "number") {
      if (!inText) nakedText.push(node);
      return;
    }
    (node.children || []).forEach((n) =>
      checkText(n, inText || node.type === "Text"),
    );
  }
  checkText(view.tree.toJSON());
  assert.deepEqual(nakedText, [], "native layout must wrap all text in Text");
  assert.equal(words(view.tree).includes("장소 지정하기"), false);
  assert.ok(words(view.tree).includes("별도 이동 없이 시작할 수 있어요"));
  const route = view.tree.root.findAll(
    (n) =>
      n.type === "Pressable" &&
      n.props.accessibilityLabel === "Musée Carnavalet 현재 위치에서 경로 찾기",
  )[0];
  assert.ok(route);
  await act(async () => route.props.onPress());
  const url = new URL(h.openedUrls[0]);
  assert.equal(url.searchParams.get("origin"), null);
  assert.equal(url.searchParams.get("destination"), "Musee Carnavalet Paris");
  assert.equal(view.store.trips[0].days[1].items[1].location, undefined);
  await act(async () => view.tree.unmount());
});
test("changing a next stop updates the walk-start recommendation while leaving original MUST untouched", async () => {
  const h = harness({ tripId: "paris" });
  const view = await mountScreen(
    h,
    "src/app/trip/[tripId]/(tabs)/itinerary.tsx",
  );
  assert.ok(words(view.tree).includes("Place des Vosges"));
  await act(async () =>
    view.store.bindLocation("paris", "2026-11-12", "original-2", {
      label: "Ofr. Paris",
      query: "Ofr Paris bookstore",
      description: "서점",
      placeId: "ofr",
    }),
  );
  assert.ok(words(view.tree).includes("Square du Temple"));
  const route = view.tree.root.findAll(
    (n) =>
      n.type === "Pressable" &&
      n.props.accessibilityLabel === "Le Marais 탐색 현재 위치에서 경로 찾기",
  )[0];
  await act(async () => route.props.onPress());
  assert.ok(
    new URL(h.openedUrls[0]).searchParams
      .get("destination")
      .includes("64 Rue de Bretagne"),
  );
  const entry = view.store.trips[0].days[0].items[0];
  assert.equal(entry.name, "Le Marais 탐색");
  assert.equal(entry.must, true);
  assert.equal(entry.location, undefined);
  await act(async () => view.tree.unmount());
});
test("activity badge opens choices and persists the user selection in the schedule", async () => {
  const h = harness({ tripId: "paris" });
  const view = await mountScreen(
    h,
    "src/app/trip/[tripId]/(tabs)/itinerary.tsx",
  );
  const badge = view.tree.root.findAll(
    (n) =>
      n.type === "Pressable" &&
      n.props.accessibilityLabel === "Le Marais 탐색 분류: 관광",
  )[0];
  await act(async () => badge.props.onPress());
  const choice = view.tree.root
    .findByType("Modal")
    .findAll(
      (n) => n.type === "Text" && n.children.includes("카페/디저트"),
    )[0].parent;
  await act(async () => choice.props.onPress());
  assert.equal(view.store.trips[0].days[0].items[0].tag, "cafe");
  assert.equal(view.tree.root.findAllByType("Modal").length, 0);
  assert.ok(
    view.tree.root.findAll(
      (n) =>
        n.type === "Pressable" &&
        n.props.accessibilityLabel === "Le Marais 탐색 분류: 카페/디저트",
    ).length,
  );
  await act(async () => view.tree.unmount());
});

test("custom tag entry updates the schedule and returns to its larger button", async () => {
  const view = await mountScreen(
    harness({ tripId: "paris" }),
    "src/app/trip/[tripId]/(tabs)/itinerary.tsx",
  );
  const badge = view.tree.root.findAll(
    (n) =>
      n.type === "Pressable" &&
      n.props.accessibilityLabel === "Le Marais 탐색 분류: 관광",
  )[0];
  assert.ok(
    badge.props.style.minHeight +
      badge.props.hitSlop.top +
      badge.props.hitSlop.bottom >=
      44,
  );
  await act(async () => badge.props.onPress());
  const input = view.tree.root
    .findAllByType("TextInput")
    .find((n) => n.props.accessibilityLabel === "직접 입력할 태그");
  await act(async () => input.props.onChangeText("  빈티지  "));
  await act(async () =>
    view.tree.root
      .findAll(
        (n) => n.type === "Text" && n.children.includes("내 태그 저장"),
      )[0]
      .parent.props.onPress(),
  );
  assert.equal(view.store.trips[0].days[0].items[0].customTag, "빈티지");
  assert.ok(
    view.tree.root.findAll(
      (n) =>
        n.type === "Pressable" &&
        n.props.accessibilityLabel === "Le Marais 탐색 분류: 빈티지",
    ).length,
  );
  await act(async () => view.tree.unmount());
});
test("home focuses on saved places and keeps examples and import off a populated home", async () => {
  const view = await mountScreen(
    harness({ tripId: "paris" }),
    "src/app/trip/[tripId]/(tabs)/index.tsx",
  );
  assert.ok(words(view.tree).includes("Instagram 저장 목록에서 가져오기"));
  await act(async () => view.store.saveCandidate("paris", "ofr"));
  assert.ok(words(view.tree).includes("가고 싶은 곳"));
  assert.equal(words(view.tree).includes("이번 여행의 발견"), false);
  assert.equal(
    words(view.tree).includes("Instagram 저장 목록에서 가져오기"),
    false,
  );
  await act(async () => view.tree.unmount());
});
test("selected next stop explains the actual preceding recommended start", async () => {
  const h = harness({
    tripId: "paris",
    date: "2026-11-12",
    updatedEntry: "original-2",
  });
  const view = await mountScreen(
    h,
    "src/app/trip/[tripId]/(tabs)/itinerary.tsx",
  );
  await act(async () =>
    view.store.bindLocation("paris", "2026-11-12", "original-2", {
      label: "Ofr.",
      query: "Ofr Paris",
      description: "서점",
      placeId: "ofr",
    }),
  );
  assert.ok(words(view.tree).includes("앞 산책은 Square du Temple"));
  await act(async () => view.tree.unmount());
});

test("new chapter offers Sydney with one creation action and a separate visual guide", async () => {
  const h = harness({});
  const view = await mountScreen(h, "src/app/new-trip.tsx");
  await act(async () =>
    view.tree.root
      .findAllByType("TextInput")
      .find((n) => n.props.accessibilityLabel === "도시")
      .props.onChangeText("시드니"),
  );
  const city = view.tree.root.findAll(
    (n) =>
      n.type === "Pressable" &&
      n.props.accessibilityLabel === "Sydney, Australia 선택",
  )[0];
  assert.ok(city);
  await act(async () => city.props.onPress());
  assert.ok(words(view.tree).includes("Australia"));
  assert.equal(words(view.tree).includes("만들고 Instagram 가져오기"), false);
  await act(async () =>
    view.tree.root
      .findAll(
        (n) =>
          n.type === "Text" && n.children.includes("Instagram 가져오기 가이드"),
      )[0]
      .parent.props.onPress(),
  );
  assert.equal(view.tree.root.findAllByType("Modal").length, 1);
  for (let i = 0; i < 3; i++)
    await act(async () =>
      view.tree.root
        .findAll((n) => n.type === "Text" && n.children.includes("다음"))[0]
        .parent.props.onPress(),
    );
  assert.ok(words(view.tree).includes("압축을 풀고 JSON"));
  await act(async () =>
    view.tree.root
      .findAll(
        (n) => n.type === "Text" && n.children.includes("가이드 닫기"),
      )[0]
      .parent.props.onPress(),
  );
  assert.equal(view.tree.root.findAllByType("Modal").length, 0);
  await act(async () => view.tree.unmount());
});
test("list edit mode selects without opening, confirms bulk delete, and restores chapters", async () => {
  const h = harness({});
  const view = await mountScreen(h, "src/app/chapters.tsx");
  const trips = [...view.store.trips];
  const pressText = async (text) =>
    act(async () =>
      view.tree.root
        .findAll((n) => n.type === "Text" && n.children.includes(text))[0]
        .parent.props.onPress(),
    );
  await pressText("편집");
  const select = async (trip) =>
    act(async () =>
      view.tree.root
        .findAll(
          (n) =>
            n.type === "Pressable" &&
            n.props.accessibilityLabel === `${trip.name} 선택`,
        )[0]
        .props.onPress(),
    );
  await select(trips[0]);
  await select(trips[1]);
  assert.equal(h.navigation.length, 0);
  const remove = view.tree.root.findAll(
    (n) =>
      n.type === "Pressable" &&
      n.props.accessibilityLabel === "선택한 2개 챕터 삭제",
  )[0];
  await act(async () => remove.props.onPress());
  await pressText("취소");
  assert.equal(view.store.trips.length, trips.length);
  await act(async () => remove.props.onPress());
  await pressText("선택한 챕터 삭제");
  assert.equal(view.store.trips.length, trips.length - 2);
  assert.equal(view.store.deletedTrips.length, 2);
  await pressText("삭제한 챕터 2개 보기");
  await pressText(`${trips[0].name} 복원`);
  assert.ok(view.store.trips.some((t) => t.id === trips[0].id));
  await act(async () => view.tree.unmount());
});
test("list edit mode supports select all, clears selection on done, and edits only one chapter", async () => {
  const h = harness({});
  const view = await mountScreen(h, "src/app/chapters.tsx");
  const trip = view.store.trips[0];
  const press = async (text) =>
    act(async () =>
      view.tree.root
        .findAll((n) => n.type === "Text" && n.children.includes(text))[0]
        .parent.props.onPress(),
    );
  await press("편집");
  await press("전체 선택");
  assert.equal(
    view.tree.root
      .findAll(
        (n) =>
          n.type === "Pressable" && n.props.accessibilityRole === "checkbox",
      )
      .every((n) => n.props.accessibilityState.checked),
    true,
  );
  assert.equal(
    view.tree.root.findAll(
      (n) => n.type === "Text" && n.children.includes("정보 수정"),
    )[0].parent.props.disabled,
    true,
  );
  await press("완료");
  await press("편집");
  assert.equal(
    view.tree.root
      .findAll(
        (n) =>
          n.type === "Pressable" && n.props.accessibilityRole === "checkbox",
      )
      .some((n) => n.props.accessibilityState.checked),
    false,
  );
  await act(async () =>
    view.tree.root
      .findAll(
        (n) =>
          n.type === "Pressable" &&
          n.props.accessibilityLabel === `${trip.name} 선택`,
      )[0]
      .props.onPress(),
  );
  await press("정보 수정");
  assert.equal(h.navigation.at(-1).params.tripId, trip.id);
  await act(async () => view.tree.unmount());
});
test("file import recovers from native reading failure and explains unsupported export files", async () => {
  for (const options of [
    {
      pickerResult: {
        canceled: false,
        assets: [{ name: "saved.json", uri: "file://mock" }],
      },
      readError: true,
      fileText: JSON.stringify([
        { url: "https://instagram.com/p/Fallback01/" },
      ]),
    },
    {
      pickerResult: {
        canceled: false,
        assets: [{ name: "download.zip", uri: "file://mock" }],
      },
      expected: "ZIP 압축 파일",
    },
    {
      pickerResult: {
        canceled: false,
        assets: [{ name: "saved.html", uri: "file://mock" }],
      },
      expected: "HTML 형식",
    },
    {
      pickerResult: {
        canceled: false,
        assets: [{ name: "saved.json", uri: "file://mock" }],
      },
      readError: true,
      legacyError: true,
      expected: "기기에서 읽지 못했어요",
    },
    {
      pickerResult: {
        canceled: false,
        assets: [{ name: "collections.json", uri: "file://mock" }],
      },
      fileText: JSON.stringify({ collections: [{ name: "Sydney" }] }),
      expected: "컬렉션 이름만 든 목록",
    },
  ]) {
    const h = harness({ tripId: "paris" }, null, options);
    const view = await mountScreen(h, "src/app/trip/[tripId]/instagram.tsx");
    const before = JSON.stringify(view.store.trips);
    await act(async () =>
      view.tree.root
        .findAll(
          (n) => n.type === "Text" && n.children.includes("JSON 파일 선택"),
        )[0]
        .parent.props.onPress(),
    );
    assert.ok(
      words(view.tree).includes(options.expected || "개 발견"),
      words(view.tree),
    );
    assert.equal(JSON.stringify(view.store.trips), before);
    await act(async () => view.tree.unmount());
  }
});

test("manual place entry goes directly to location confirmation without silently scheduling", async () => {
  const seed = harness({ tripId: "paris" });
  const base = await mountScreen(
    seed,
    "src/app/trip/[tripId]/(tabs)/candidates.tsx",
  );
  await act(async () =>
    base.store.importInstagram("paris", [
      {
        id: "manual-source",
        url: "https://www.instagram.com/p/ManualFlow01/",
        name: "A saved post",
        caption: "",
        owner: "",
        username: "",
        collection: "Test",
        category: "기타",
        candidates: [],
      },
    ]),
  );
  const postId = base.store.trips[0].inspirations[0].id;
  const raw = seed.raw;
  await act(async () => base.tree.unmount());
  const h = harness({ tripId: "paris", postId }, raw);
  const view = await mountScreen(
    h,
    "src/app/trip/[tripId]/inspiration/[postId].tsx",
  );
  const before = JSON.stringify(view.store.trips[0].days);
  await act(async () =>
    view.tree.root
      .findAllByType("TextInput")
      .find((n) => n.props.accessibilityLabel === "게시물의 장소 이름")
      .props.onChangeText("Test Cafe"),
  );
  await act(async () =>
    view.tree.root
      .findAll(
        (n) =>
          n.type === "Text" &&
          n.children.includes("이 이름으로 저장하고 위치 확인"),
      )[0]
      .parent.props.onPress(),
  );
  const p = view.store.trips[0].importedPlaces[0];
  assert.equal(p.name, "Test Cafe");
  assert.equal(p.matchStatus, "needs_confirmation");
  assert.equal(h.navigation.at(-1).params.placeId, p.id);
  assert.equal(JSON.stringify(view.store.trips[0].days), before);
  await act(async () => view.tree.unmount());
  const detail = await mountScreen(
    harness({ tripId: "paris", placeId: p.id }, h.raw),
    "src/app/trip/[tripId]/place/[placeId].tsx",
  );
  assert.ok(words(detail.tree).includes("Google Maps에서 장소 확인"));
  assert.equal(words(detail.tree).includes("언제 방문할까요?"), false);
  await act(async () =>
    detail.tree.root
      .findAllByType("TextInput")
      .find((n) => n.props.accessibilityLabel === "확인할 지도 검색어")
      .props.onChangeText("Test Cafe, Test Street, Paris"),
  );
  await act(async () =>
    detail.tree.root
      .findAll(
        (n) =>
          n.type === "Text" &&
          n.children.includes("이 위치가 맞아요 · 날짜 선택 →"),
      )[0]
      .parent.props.onPress(),
  );
  assert.equal(words(detail.tree).includes("언제 방문할까요?"), true);
  assert.equal(
    detail.tree.root
      .findAllByType("TextInput")
      .some((n) => n.props.accessibilityLabel === "확인할 지도 검색어"),
    false,
  );
  assert.equal(JSON.stringify(detail.store.trips[0].days), before);
  await act(async () => detail.tree.unmount());
});

test("imported-post landing makes choosing a place primary and skips already reviewed posts", async () => {
  const seed = harness({ tripId: "paris" });
  const base = await mountScreen(
    seed,
    "src/app/trip/[tripId]/(tabs)/candidates.tsx",
  );
  await act(async () =>
    base.store.importInstagram("paris", [
      {
        id: "first",
        url: "https://instagram.com/p/OldLanding01/",
        name: "Old reviewed post",
        caption: "Old Cafe",
        owner: "",
        username: "",
        collection: "Test",
        category: "기타",
        candidates: [
          {
            id: "old-place",
            name: "Old Cafe",
            kind: "manual",
            confidence: "medium",
          },
        ],
      },
      {
        id: "second",
        url: "https://instagram.com/p/NewLanding01/",
        name: "New post to review",
        caption: "",
        owner: "",
        username: "",
        collection: "Test",
        category: "기타",
        candidates: [],
      },
    ]),
  );
  const [oldPost, newPost] = base.store.trips[0].inspirations;
  await act(async () =>
    base.store.confirmInstagram("paris", [
      { postId: oldPost.id, candidateId: "old-place" },
    ]),
  );
  const placeId = base.store.trips[0].importedPlaces[0].id;
  await act(async () => {
    base.store.confirmPlace("paris", placeId, {
      name: "Old Cafe",
      query: "Old Cafe, Paris",
      address: "Test Address",
    });
    base.store.place("paris", placeId, "Old Cafe", "2026-11-14", "11:00");
  });
  const raw = seed.raw;
  await act(async () => base.tree.unmount());
  const h = harness(
    { tripId: "paris", section: "inspiration", startPost: oldPost.id },
    raw,
  );
  const view = await mountScreen(
    h,
    "src/app/trip/[tripId]/(tabs)/candidates.tsx",
  );
  assert.ok(words(view.tree).includes("게시물을 가져왔어요"));
  const primary = view.tree.root.findAll(
    (n) =>
      n.type === "Text" && n.children.includes("게시물 열고 장소 고르기 →"),
  )[0];
  assert.ok(primary);
  await act(async () => primary.parent.props.onPress());
  assert.equal(h.navigation.at(-1).params.postId, newPost.id);
  assert.ok(
    words(view.tree).indexOf("게시물 열고 장소 고르기") <
      words(view.tree).indexOf("다른 Instagram JSON 가져오기"),
  );
  await act(async () => view.tree.unmount());
});

test("ten imported posts resume as nine remaining after one is scheduled, while all stays available", async () => {
  const seed = harness({ tripId: "paris" });
  const base = await mountScreen(
    seed,
    "src/app/trip/[tripId]/(tabs)/candidates.tsx",
  );
  await act(async () =>
    base.store.importInstagram(
      "paris",
      Array.from({ length: 10 }, (_, i) => ({
        id: `source${i}`,
        url: `https://instagram.com/p/Progress${i}/`,
        name: `Test post ${i}`,
        caption: `Test Cafe ${i}`,
        owner: "",
        username: "",
        collection: "Test",
        category: "카페",
        candidates: [
          {
            id: `candidate${i}`,
            name: `Test Cafe ${i}`,
            kind: "manual",
            confidence: "medium",
          },
        ],
      })),
    ),
  );
  const post = base.store.trips[0].inspirations[0];
  await act(async () =>
    base.store.confirmInstagram("paris", [
      { postId: post.id, candidateId: post.candidates[0].id },
    ]),
  );
  const place = base.store.trips[0].importedPlaces[0];
  // Saving alone leaves all ten posts pending.
  const progress = seed.load("src/inspirationProgress.ts").inspirationProgress;
  assert.equal(progress(base.store.trips[0]).pendingPosts.length, 10);
  await act(async () =>
    base.store.confirmPlace("paris", place.id, {
      name: place.name,
      query: "Test Cafe, Paris",
      address: "Test Street",
    }),
  );
  assert.equal(progress(base.store.trips[0]).pendingPosts.length, 10);
  await act(async () =>
    base.store.place("paris", place.id, place.name, "2026-11-14", "11:00"),
  );
  assert.equal(progress(base.store.trips[0]).pendingPosts.length, 9);
  const raw = seed.raw;
  await act(async () => base.tree.unmount());
  const h = harness(
    { tripId: "paris", date: "2026-11-14", addedPlace: place.id },
    raw,
  );
  const itinerary = await mountScreen(
    h,
    "src/app/trip/[tripId]/(tabs)/itinerary.tsx",
  );
  await act(async () =>
    itinerary.tree.root
      .findAll(
        (n) =>
          n.type === "Text" &&
          n.children.includes("남은 게시물 9개 계속 보기 →"),
      )[0]
      .parent.props.onPress(),
  );
  assert.equal(h.navigation.at(-1).params.postFilter, "pending");
  await act(async () => itinerary.tree.unmount());
  const list = await mountScreen(
    harness(h.navigation.at(-1).params, raw),
    "src/app/trip/[tripId]/(tabs)/candidates.tsx",
  );
  assert.equal(
    list.tree.root.findByType("FlatList").parent.props.data.length,
    9,
  );
  assert.equal(
    list.tree.root
      .findByType("FlatList")
      .parent.props.data.some((r) => r.id === post.id),
    false,
  );
  await act(async () =>
    list.tree.root
      .findAll((n) => n.type === "Text" && n.children.includes("전체 10"))[0]
      .parent.props.onPress(),
  );
  assert.equal(
    list.tree.root.findByType("FlatList").parent.props.data.length,
    10,
  );
  assert.ok(words(list.tree).includes("일정에 연결됨"));
  await act(async () => list.tree.unmount());
});
test("activity pill is compact beside the place title with a separate larger touch target", async () => {
  const view = await mountScreen(
    harness({ tripId: "paris" }),
    "src/app/trip/[tripId]/(tabs)/itinerary.tsx",
  );
  const component = view.tree.root.findAll(
    (n) => typeof n.type === "function" && n.type.name === "ActivityButton",
  )[0];
  assert.equal(component.parent.props.style.flexDirection, "row");
  const touch = component.findAll((n) => n.type === "Pressable")[0];
  assert.equal(touch.props.style.minHeight, 44);
  assert.equal(touch.props.style.backgroundColor, undefined);
  const pill = touch.findAll(
    (n) => n.type === "View" && n.props.style.backgroundColor === "#E7EBE2",
  )[0];
  assert.equal(pill.props.style.minHeight, 26);
  assert.equal(pill.findByType("Text").props.style.fontSize, 13);
  await act(async () => view.tree.unmount());
});

test("native planning flows from a manual saved place to review, then explicit application and the correct day", async () => {
  let sent;
  const h = harness({ tripId: "paris" }, null, {
    fetcher: async (url, options) => {
      sent = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          suggestions: [
            {
              type: "ADD",
              placeId: sent.places[0].id,
              date: sent.itinerary.find((d) => !d.existing.length).date,
              time: "10:00",
              reason: "입력 조건을 참고",
            },
          ],
        }),
      };
    },
  });
  const view = await mountScreen(h, "src/app/trip/[tripId]/plan.tsx");
  const before = JSON.stringify(view.store.trips[0].days);
  const press = async (text) =>
    act(async () =>
      view.tree.root
        .findAll((n) => n.type === "Text" && n.children.includes(text))[0]
        .parent.props.onPress(),
    );
  await press("새로 넣을 장소 0곳");
  await press("장소 직접 추가");
  await act(async () => {
    view.tree.root
      .findAllByType("TextInput")
      .find((n) => n.props.accessibilityLabel === "직접 추가할 장소 이름")
      .props.onChangeText("Test Gallery");
    view.tree.root
      .findAllByType("TextInput")
      .find((n) => n.props.accessibilityLabel === "직접 추가할 장소 주소")
      .props.onChangeText("Test Gallery, Paris");
  });
  await press("확인한 주소로 장소 저장");
  assert.equal(JSON.stringify(view.store.trips[0].days), before);
  await press("조건 저장하고 AI 제안받기");
  assert.ok(words(view.tree).includes("이렇게 여행해 볼까요?"));
  assert.equal(JSON.stringify(view.store.trips[0].days), before);
  assert.equal(sent.mode, "mobile_itinerary_draft");
  assert.equal(sent.places.length, 1);
  assert.equal(JSON.stringify(sent).includes("sourcePostIds"), false);
  await press("선택한 1곳과 고정 일정 적용");
  assert.equal(h.navigation.at(-1).params.date, "2026-11-14");
  assert.equal(h.navigation.at(-1).params.planApplied, "1");
  assert.equal(view.store.trips[0].days[0].items[0].must, true);
  assert.equal(
    view.store.trips[0].days[2].items.some((e) => e.name === "Test Gallery"),
    true,
  );
  await act(async () => view.tree.unmount());
});
test("native planning reports AI connection failure without touching any existing days", async () => {
  const h = harness({ tripId: "paris" }, null, {
    fetcher: async () => ({ ok: false }),
  });
  const view = await mountScreen(h, "src/app/trip/[tripId]/plan.tsx");
  await act(async () => {
    const r = view.store.addManualPlace(
      "paris",
      "Test Museum",
      "Test Address Paris",
      "관광",
    );
  });
  const defaults = h
    .load("src/planner.ts")
    .defaultConditions(view.store.trips[0]);
  await act(async () => view.store.savePlanning("paris", defaults));
  // Reopen the form so it reads the persisted conditions, as a real navigation would.
  const raw = h.raw;
  await act(async () => view.tree.unmount());
  const next = harness({ tripId: "paris" }, raw, {
    fetcher: async () => ({ ok: false }),
  });
  const form = await mountScreen(next, "src/app/trip/[tripId]/plan.tsx");
  const before = JSON.stringify(form.store.trips[0].days);
  await act(async () =>
    form.tree.root
      .findAll(
        (n) =>
          n.type === "Text" && n.children.includes("조건 저장하고 AI 제안받기"),
      )[0]
      .parent.props.onPress(),
  );
  assert.ok(words(form.tree).includes("AI 서비스가 응답하지"));
  assert.equal(JSON.stringify(form.store.trips[0].days), before);
  await act(async () => form.tree.unmount());
});
