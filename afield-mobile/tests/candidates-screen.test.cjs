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
  const headerOptions = {};
  const stackNavigation = {
    setOptions: (options) => Object.assign(headerOptions, options),
  };
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
  native.useWindowDimensions = () => ({
    width: 390,
    height: 844,
    scale: 2,
    fontScale: 1,
  });
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
      if (name === "expo-constants")
        return {
          default: {
            expoConfig: {
              hostUri: "localhost:8081",
              extra: { devRoutesToken: "test-bridge-token" },
            },
          },
          __esModule: true,
        };
      if (name === "expo-haptics")
        return {
          impactAsync: async () => {},
          ImpactFeedbackStyle: { Light: "light" },
        };
      if (name === "expo-image-picker")
        return {
          launchImageLibraryAsync: async () =>
            options.photoResult || { canceled: true },
        };
      if (name === "expo-document-picker")
        return {
          getDocumentAsync: async () =>
            options.pickerResult || { canceled: true },
        };
      if (name === "expo-file-system/legacy")
        return {
          documentDirectory: "file:///test-documents/",
          makeDirectoryAsync: async () => {},
          copyAsync: async () => {
            if (options.photoCopyError)
              throw Error("사진을 저장하지 못했어요.");
          },
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
      if (name === "react-native-safe-area-context")
        return {
          useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
        };
      if (name === "expo-router")
        return {
          usePathname: () => options.pathname || "",
          Tabs: Object.assign(
            (props) => React.createElement("Tabs", props, props.children),
            { Screen: (props) => React.createElement("TabScreen", props) },
          ),
          useLocalSearchParams: () => params,
          useGlobalSearchParams: () => params,
          useRouter: () => router,
          useNavigation: () => stackNavigation,
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
      fetch: async (url, config) => {
        if (String(url).endsWith("/afield-dev/routes")) {
          if (options.routeFetcher) return options.routeFetcher(url, config);
          const body = JSON.parse(config.body);
          return {
            ok: true,
            json: async () => ({
              provider: "Google Maps",
              retrievedAt: "2026-11-14T00:00:00Z",
              routes: (body.addresses || []).flatMap((from) =>
                body.addresses.flatMap((to) =>
                  body.modes.map((mode) => ({
                    from,
                    to,
                    mode,
                    durationSeconds: 0,
                    distanceMeters: 0,
                    retrievedAt: "2026-11-14T00:00:00Z",
                  })),
                ),
              ),
            }),
          };
        }
        if (options.fetcher) return options.fetcher(url, config);
        throw Error("No test network configured");
      },
      AbortController,
      setTimeout,
      clearTimeout,
      Date: class extends Date {
        constructor(...args) {
          super(...(args.length ? args : ["2026-11-14T00:00:00Z"]));
        }
      },
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
    headerOptions,
  };
}
function tapText(view, text) {
  let n = view.tree.root.findAll(
    (n) => n.type === "Text" && n.children.includes(text),
  )[0];
  while (n && typeof n.props.onPress !== "function") n = n.parent;
  if (!n) throw Error("No action for " + text);
  return n.props.onPress();
}
async function advancePlanner(view, target) {
  for (const [index, title] of [
    "저장하고 장소 모으기",
    "저장하고 여행 리듬 정하기",
  ].entries())
    if (index < target && words(view.tree).includes(title))
      await act(async () => tapText(view, title));
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
          n.children.includes("이 주소로 가고 싶은 곳에 저장"),
      )[0]
      .parent.props.onPress(),
  );
  assert.equal(
    detail.store.trips[0].importedPlaces[0].matchStatus,
    "confirmed",
  );
  assert.equal(detail.store.trips[0].days[0].items.length, 2);
  assert.equal(
    detail.tree.root.findAll(
      (n) =>
        n.type === "Text" && n.children.includes("이 날짜와 시간에 일정 추가"),
    ).length,
    0,
  );
  await act(async () => tapText(detail, "일정에 추가"));
  await act(async () => tapText(detail, "날짜와 시간이 정해졌어요"));
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
  assert.ok(words(detail.tree).includes("Google Maps에서 주소 확인"));
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
          n.children.includes("이 주소로 가고 싶은 곳에 저장"),
      )[0]
      .parent.props.onPress(),
  );
  assert.equal(words(detail.tree).includes("언제 방문할까요?"), false);
  await act(async () => tapText(detail, "일정에 추가"));
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
    (n) => n.type === "View" && n.props.style.backgroundColor === "#F1F1F1",
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
  await advancePlanner(view, 1);
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
  await advancePlanner(view, 2);
  await press("조건 저장하고 AI 제안받기");
  assert.ok(words(view.tree).includes("이렇게 여행해 볼까요?"));
  assert.equal(JSON.stringify(view.store.trips[0].days), before);
  assert.equal(sent.mode, "mobile_itinerary_draft");
  assert.equal(sent.places.length, 1);
  assert.equal(JSON.stringify(sent).includes("sourcePostIds"), false);
  const proposal = () =>
    view.tree.root.findAll(
      (n) =>
        n.type === "Pressable" &&
        n.props.accessibilityRole === "checkbox" &&
        String(n.props.accessibilityLabel).endsWith("제안 선택"),
    )[0];
  assert.equal(proposal().props.accessibilityState.checked, true);
  await act(async () =>
    view.tree.root
      .findAll(
        (n) =>
          n.type === "Pressable" &&
          String(n.props.accessibilityLabel).endsWith("제안 이유 자세히"),
      )[0]
      .props.onPress(),
  );
  assert.equal(proposal().props.accessibilityState.checked, true);
  await act(async () => tapText(view, "닫기"));
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
  await advancePlanner(form, 2);
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

test("in-app place search fills the selected address without creating a timed visit", async () => {
  const seed = harness({ tripId: "paris" });
  const v = await mount(seed);
  await act(async () =>
    v.store.importInstagram("paris", [
      {
        id: "search-post",
        name: "post",
        url: "https://instagram.com/p/SearchPlace1/",
        caption: "Test Museum",
        owner: "",
        username: "",
        collection: "Paris",
        category: "관광",
        candidates: [
          {
            id: "c",
            name: "Test Museum",
            kind: "caption",
            confidence: "medium",
          },
        ],
      },
    ]),
  );
  const post = v.store.trips[0].inspirations[0];
  await act(async () =>
    v.store.confirmInstagram("paris", [{ postId: post.id, candidateId: "c" }]),
  );
  const p = v.store.trips[0].importedPlaces[0];
  const before = JSON.stringify(v.store.trips[0].days);
  const h = harness({ tripId: "paris", placeId: p.id }, seed.raw, {
    fetcher: async () => ({
      ok: true,
      json: async () => ({
        results: [
          {
            clientIndex: 0,
            match: {
              displayName: "Exact Museum",
              formattedAddress: "10 Exact Road, Paris",
              placeId: "google-test",
            },
          },
        ],
      }),
    }),
  });
  await act(async () => v.tree.unmount());
  const detail = await mountScreen(
    h,
    "src/app/trip/[tripId]/place/[placeId].tsx",
  );
  await act(async () =>
    detail.tree.root
      .findAll(
        (n) =>
          n.type === "Text" && n.children.includes("다른 방법으로 주소 검색"),
      )[0]
      .parent.props.onPress(),
  );
  await act(async () =>
    detail.tree.root
      .findAll(
        (n) => n.type === "Text" && n.children.includes("이름으로 주소 검색"),
      )[0]
      .parent.props.onPress(),
  );
  await act(async () =>
    detail.tree.root
      .findAll(
        (n) =>
          n.type === "Text" &&
          n.children.includes("이 장소 선택 · 주소 가져오기"),
      )[0]
      .parent.props.onPress(),
  );
  assert.equal(
    detail.store.trips[0].importedPlaces[0].address,
    "10 Exact Road, Paris",
  );
  assert.equal(
    detail.store.trips[0].importedPlaces[0].matchStatus,
    "confirmed",
  );
  assert.equal(JSON.stringify(detail.store.trips[0].days), before);
  await act(async () => tapText(detail, "일정에 추가"));
  assert.ok(words(detail.tree).includes("아직 미정 · AI가 배치"));
  assert.equal(
    detail.tree.root.findAll(
      (n) =>
        n.type === "TextInput" && n.props.accessibilityLabel === "일정 시간",
    ).length,
    0,
  );
  await act(async () => detail.tree.unmount());
});

test("default date and suggested time add without editing; a conflict is visible beside the button", async () => {
  const plainHarness = harness({ tripId: "paris", placeId: "ofr" });
  const plain = await mountScreen(
    plainHarness,
    "src/app/trip/[tripId]/place/[placeId].tsx",
  );
  const count = plain.store.trips[0].days[0].items.length;
  await act(async () => tapText(plain, "일정에 추가"));
  await act(async () => tapText(plain, "날짜와 시간이 정해졌어요"));
  await act(async () =>
    plain.tree.root
      .findAll(
        (n) =>
          n.type === "Text" &&
          n.children.includes("이 날짜와 시간에 일정 추가"),
      )[0]
      .parent.props.onPress(),
  );
  assert.equal(plain.store.trips[0].days[0].items.length, count + 1);
  assert.equal(
    plainHarness.navigation.at(-1).params.date,
    plain.store.trips[0].days[0].date,
  );
  await act(async () => plain.tree.unmount());
  const h = harness({ tripId: "paris", placeId: "ofr" });
  const detail = await mountScreen(
    h,
    "src/app/trip/[tripId]/place/[placeId].tsx",
  );
  await act(async () => tapText(detail, "일정에 추가"));
  await act(async () => tapText(detail, "날짜와 시간이 정해졌어요"));
  const field = () =>
    detail.tree.root
      .findAllByType("TextInput")
      .find((n) => n.props.accessibilityLabel === "일정 시간");
  const day = detail.store.trips[0].days[0];
  const initialCount = day.items.length;
  const suggestion = field().props.value;
  assert.ok(suggestion);
  assert.equal(
    day.items.some((e) => e.time === suggestion),
    false,
  );
  const button = () =>
    detail.tree.root.findAll(
      (n) =>
        n.type === "Text" && n.children.includes("이 날짜와 시간에 일정 추가"),
    )[0].parent;
  await act(async () => field().props.onChangeText(day.items[0].time));
  await act(async () => button().props.onPress());
  assert.equal(detail.store.trips[0].days[0].items.length, initialCount);
  const visible = words(detail.tree);
  const errorIndex = visible.indexOf("이미 일정이 있는 시간");
  assert.ok(
    errorIndex >= 0 &&
      errorIndex < visible.indexOf("이 날짜와 시간에 일정 추가"),
  );
  await act(async () => field().props.onChangeText(suggestion));
  await act(async () => button().props.onPress());
  assert.equal(detail.store.trips[0].days[0].items.length, initialCount + 1);
  assert.equal(h.navigation.at(-1).params.date, day.date);
  await act(async () => detail.tree.unmount());
});

test("trip cover selection previews, saves persistently and can restore the default without altering itinerary", async () => {
  const h = harness({ tripId: "paris" }, null, {
    photoResult: {
      canceled: false,
      assets: [{ uri: "file:///cache/chosen.jpg", fileSize: 3000 }],
    },
  });
  const form = await mountScreen(h, "src/app/trip/[tripId]/edit.tsx");
  const before = JSON.stringify(form.store.trips[0].days);
  await advancePlanner(form, 2);
  const click = async (view, label) =>
    act(async () =>
      view.tree.root
        .findAll((n) => n.type === "Text" && n.children.includes(label))[0]
        .parent.props.onPress(),
    );
  await click(form, "사진 보관함에서 선택");
  assert.equal(form.store.trips[0].coverUri, undefined);
  await click(form, "변경사항 저장");
  assert.match(
    form.store.trips[0].coverUri,
    /^file:\/\/\/test-documents\/trip-covers\//,
  );
  const saved = form.store.trips[0].coverUri;
  assert.equal(h.load("src/images.ts").imageSource(saved).uri, saved);
  assert.equal(JSON.stringify(form.store.trips[0].days), before);
  const raw = h.raw;
  await act(async () => form.tree.unmount());
  const restarted = await mountScreen(
    harness({ tripId: "paris" }, raw),
    "src/app/trip/[tripId]/edit.tsx",
  );
  assert.equal(restarted.store.trips[0].coverUri, saved);
  await click(restarted, "기본 사진으로 되돌리기");
  await click(restarted, "변경사항 저장");
  assert.equal(restarted.store.trips[0].coverUri, "");
  assert.equal(JSON.stringify(restarted.store.trips[0].days), before);
  await act(async () => restarted.tree.unmount());
});

test("cancelling photo picker keeps the existing cover", async () => {
  const h = harness({ tripId: "paris" }, null, {
    photoResult: { canceled: true },
  });
  const form = await mountScreen(h, "src/app/trip/[tripId]/edit.tsx");
  await act(async () =>
    form.tree.root
      .findAll(
        (n) => n.type === "Text" && n.children.includes("사진 보관함에서 선택"),
      )[0]
      .parent.props.onPress(),
  );
  assert.equal(form.store.trips[0].coverUri, undefined);
  assert.equal(
    form.tree.root.findAll(
      (n) => n.type === "Text" && n.children.includes("변경사항 저장"),
    )[0].parent.props.disabled,
    true,
  );
  await act(async () => form.tree.unmount());
});

test("photo copy failure leaves saved cover unchanged and displays an error", async () => {
  const h = harness({ tripId: "paris" }, null, {
    photoResult: {
      canceled: false,
      assets: [{ uri: "file:///cache/photo.jpg" }],
    },
    photoCopyError: true,
  });
  const view = await mountScreen(h, "src/app/trip/[tripId]/edit.tsx");
  await act(async () =>
    view.tree.root
      .findAll(
        (n) => n.type === "Text" && n.children.includes("사진 보관함에서 선택"),
      )[0]
      .parent.props.onPress(),
  );
  assert.equal(view.store.trips[0].coverUri, undefined);
  assert.ok(words(view.tree).includes("사진을 가져오지 못했어요."));
  await act(async () => view.tree.unmount());
});

test("transport controls independently toggle and keep at least one mode", async () => {
  const view = await mountScreen(
    harness({ tripId: "paris" }),
    "src/app/trip/[tripId]/plan.tsx",
  );
  await advancePlanner(view, 2);
  const control = (mode) =>
    view.tree.root.findAll(
      (n) =>
        n.type === "Pressable" && n.props.accessibilityLabel === `${mode} 이용`,
    )[0];
  assert.equal(control("도보").props.accessibilityState.checked, true);
  assert.equal(control("대중교통").props.accessibilityState.checked, true);
  await act(async () => control("차").props.onPress());
  await act(async () => control("도보").props.onPress());
  await act(async () => control("대중교통").props.onPress());
  assert.equal(control("차").props.accessibilityState.checked, true);
  await act(async () => control("차").props.onPress());
  assert.equal(control("차").props.accessibilityState.checked, true);
  assert.ok(words(view.tree).includes("하나 이상"));
  await act(async () => view.tree.unmount());
});

test("legacy planning with unselected saved places exposes counts and explicit select-all recovery", async () => {
  const h = harness({ tripId: "paris" });
  const seed = await mount(h);
  await act(async () =>
    seed.store.addManualPlace("paris", "Saved Museum", "Street, Paris", "관광"),
  );
  const planner = h.load("src/planner.ts");
  const c = planner.defaultConditions(seed.store.trips[0]);
  c.selectedIds = [];
  delete c.knownPlaceIds;
  await act(async () => seed.store.savePlanning("paris", c));
  const raw = h.raw;
  await act(async () => seed.tree.unmount());
  const view = await mountScreen(
    harness({ tripId: "paris" }, raw),
    "src/app/trip/[tripId]/plan.tsx",
  );
  const proposalButton = () =>
    view.tree.root.findAll(
      (n) =>
        n.type === "Text" && n.children.includes("조건 저장하고 AI 제안받기"),
    )[0].parent;
  await advancePlanner(view, 1);
  assert.ok(words(view.tree).includes("아직 선택되지 않았어요"));
  await act(async () => tapText(view, "미배치 장소 모두 선택"));
  await advancePlanner(view, 2);
  assert.equal(proposalButton().props.disabled, false);
  await act(async () => view.tree.unmount());
});

test("modern travel home routes its next action by state without changing trip data", async () => {
  const source = harness({ tripId: "paris" }).load("src/data.ts").trips;
  for (const kind of ["discover", "plan", "record"]) {
    const data = JSON.parse(JSON.stringify(source));
    const t = data[0];
    t.days = [];
    t.start = "";
    t.end = "";
    t.candidates = [];
    if (kind === "plan") t.candidates = ["ofr"];
    if (kind === "record") {
      t.start = "2020-01-01";
      t.end = "2020-01-02";
      t.days = [
        { date: t.start, items: [] },
        { date: t.end, items: [] },
      ];
    }
    const raw = JSON.stringify(data);
    const h = harness({ tripId: "paris" }, raw);
    const view = await mountScreen(h, "src/app/trip/[tripId]/(tabs)/index.tsx");
    await act(async () =>
      tapText(
        view,
        kind === "discover"
          ? "가고 싶은 곳 보기"
          : kind === "plan"
            ? "여행 조건 입력하고 AI로 계획"
            : "기록 열기",
      ),
    );
    assert.equal(
      h.navigation.at(-1).pathname,
      kind === "discover"
        ? "/trip/[tripId]/candidates"
        : kind === "plan"
          ? "/trip/[tripId]/plan"
          : "/trip/[tripId]/journal",
    );
    assert.equal(JSON.stringify(view.store.trips), raw);
    await act(async () => view.tree.unmount());
  }
});

test("post list opened from itinerary returns to its date while direct tab access retains chapter navigation", async () => {
  for (const fromItinerary of [true, false]) {
    const h = harness(
      {
        tripId: "paris",
        date: "2026-11-13",
        returnTo: fromItinerary ? "itinerary" : "",
      },
      null,
      { pathname: "/trip/paris/candidates" },
    );
    const view = await mountScreen(
      h,
      "src/app/trip/[tripId]/(tabs)/_layout.tsx",
    );
    const header = view.tree.root
      .findByType("Tabs")
      .props.screenOptions.headerLeft();
    assert.equal(
      header.props.accessibilityLabel,
      fromItinerary ? "일정으로 돌아가기" : "여행 목록으로",
    );
    await act(async () => header.props.onPress());
    if (fromItinerary) {
      assert.equal(h.navigation.at(-1).pathname, "/trip/[tripId]/itinerary");
      assert.equal(h.navigation.at(-1).params.date, "2026-11-13");
    } else assert.equal(h.navigation.at(-1), "/chapters");
    await act(async () => view.tree.unmount());
  }
});

test("AI omissions are filled by the explicit constraint scheduling pass without applying anything", async () => {
  const source = JSON.parse(
    JSON.stringify(harness({}).load("src/data.ts").trips),
  );
  const t = source[0];
  t.start = "2027-02-01";
  t.end = "2027-02-02";
  t.days = [
    { date: t.start, items: [] },
    { date: t.end, items: [] },
  ];
  t.candidates = ["confirmed-shop"];
  t.importedPlaces = [
    {
      id: "confirmed-shop",
      name: "Shop",
      query: "Test Road",
      category: "쇼핑",
      area: "Tokyo",
      description: "",
      image: "",
      sourcePostIds: [],
      matchStatus: "confirmed",
    },
  ];
  let calls = 0;
  const requests = [];
  const h = harness({ tripId: "paris" }, JSON.stringify(source), {
    fetcher: async (_, o) => {
      const r = JSON.parse(o.body);
      requests.push(r);
      calls++;
      return {
        ok: true,
        json: async () => ({
          suggestions:
            calls <= 2
              ? []
              : [
                  {
                    type: "ADD",
                    placeId: r.places[0].id,
                    date: "2027-02-01",
                    time: "09:00",
                  },
                ],
        }),
      };
    },
  });
  const view = await mountScreen(h, "src/app/trip/[tripId]/plan.tsx");
  const before = JSON.stringify(view.store.trips[0].days);
  await advancePlanner(view, 2);
  await act(async () => tapText(view, "조건 저장하고 AI 제안받기"));
  assert.equal(calls, 2);
  assert.ok(words(view.tree).includes("이렇게 여행해 볼까요?"));
  assert.equal(view.store.trips[0].planDraft.rows.length, 1);
  assert.equal(words(view.tree).includes("선택한 0곳과 고정 일정 적용"), false);
  assert.ok(
    view.store.trips[0].planDraft.issues.some((v) =>
      v.includes("AI 응답에서 미배치된"),
    ),
  );
  assert.equal(JSON.stringify(view.store.trips[0].days), before);
  await act(async () => view.tree.unmount());
});

test("journal photo and short memo survive restart, edit and delete while itinerary stays unchanged", async () => {
  const h = harness({ tripId: "paris" }, null, {
    photoResult: {
      canceled: false,
      assets: [{ uri: "file:///cache/memory.jpg", fileSize: 1000 }],
    },
  });
  const view = await mountScreen(h, "src/app/trip/[tripId]/(tabs)/journal.tsx");
  const before = JSON.stringify(view.store.trips[0].days);
  await act(async () => tapText(view, "＋ 방문 기록 남기기"));
  const choice = view.tree.root.findAll(
    (n) => n.type === "Pressable" && n.props.accessibilityRole === "radio",
  )[0];
  await act(async () => choice.props.onPress());
  await act(async () =>
    view.tree.root
      .findAllByType("TextInput")
      .find((n) => n.props.accessibilityLabel === "기록 메모")
      .props.onChangeText("작은 서점의 기억"),
  );
  await act(async () => tapText(view, "사진 선택"));
  await act(async () => tapText(view, "기록 저장"));
  const record = view.store.trips[0].journal[0];
  assert.match(record.photoUri, /journal-photos/);
  assert.equal(record.note, "작은 서점의 기억");
  assert.equal(JSON.stringify(view.store.trips[0].days), before);
  const raw = h.raw;
  await act(async () => view.tree.unmount());
  const restarted = await mountScreen(
    harness({ tripId: "paris" }, raw),
    "src/app/trip/[tripId]/(tabs)/journal.tsx",
  );
  assert.ok(words(restarted.tree).includes("작은 서점의 기억"));
  await act(async () =>
    restarted.tree.root
      .findAll(
        (n) =>
          n.type === "Pressable" &&
          n.props.accessibilityLabel === `${record.placeName} 기록 수정`,
      )[0]
      .props.onPress(),
  );
  await act(async () =>
    restarted.tree.root
      .findAllByType("TextInput")
      .find((n) => n.props.accessibilityLabel === "기록 메모")
      .props.onChangeText("다시 가고 싶은 곳"),
  );
  await act(async () => tapText(restarted, "기록 저장"));
  assert.equal(restarted.store.trips[0].journal[0].id, record.id);
  await act(async () =>
    restarted.tree.root
      .findAll(
        (n) =>
          n.type === "Pressable" &&
          n.props.accessibilityLabel === `${record.placeName} 기록 수정`,
      )[0]
      .props.onPress(),
  );
  await act(async () => tapText(restarted, "이 기록 삭제"));
  await act(async () => tapText(restarted, "삭제 취소"));
  assert.equal(restarted.store.trips[0].journal.length, 1);
  await act(async () => tapText(restarted, "이 기록 삭제"));
  await act(async () => tapText(restarted, "기록 삭제 확인"));
  assert.equal(restarted.store.trips[0].journal.length, 0);
  assert.equal(JSON.stringify(restarted.store.trips[0].days), before);
  await act(async () => restarted.tree.unmount());
});

test("a non-Paris day offers saved places and manual add rather than an empty Paris example", async () => {
  const source = JSON.parse(
    JSON.stringify(harness({}).load("src/data.ts").trips),
  );
  source[0].city = "Tokyo";
  const h = harness(
    { tripId: "paris", date: source[0].start },
    JSON.stringify(source),
  );
  const view = await mountScreen(h, "src/app/trip/[tripId]/recommend.tsx");
  assert.equal(words(view.tree).includes("Paris 예시"), false);
  await act(async () => tapText(view, "장소 직접 추가하기"));
  const field = (label) =>
    view.tree.root
      .findAllByType("TextInput")
      .find((n) => n.props.accessibilityLabel === label);
  await act(async () =>
    field("추가할 장소 이름").props.onChangeText("Test Tokyo Shop"),
  );
  await act(async () =>
    field("추가할 장소 주소").props.onChangeText("Confirmed Street, Tokyo"),
  );
  const before = JSON.stringify(view.store.trips[0].days);
  await act(async () => tapText(view, "확인한 주소로 저장하고 계속"));
  assert.equal(h.navigation.at(-1).params.addToDay, "1");
  assert.equal(h.navigation.at(-1).params.date, source[0].start);
  assert.equal(JSON.stringify(view.store.trips[0].days), before);
  await act(async () => view.tree.unmount());
});

test("adding an unverified saved place to a day confirms its address before opening the time sheet", async () => {
  const source = JSON.parse(
    JSON.stringify(harness({}).load("src/data.ts").trips),
  );
  source[0].candidates = ["unverified"];
  source[0].importedPlaces = [
    {
      id: "unverified",
      name: "Test Shop",
      query: "Test Shop Tokyo",
      area: "Tokyo",
      category: "쇼핑",
      description: "",
      image: "",
      sourcePostIds: [],
      matchStatus: "needs_confirmation",
    },
  ];
  const h = harness(
    {
      tripId: "paris",
      placeId: "unverified",
      date: source[0].start,
      addToDay: "1",
    },
    JSON.stringify(source),
  );
  const view = await mountScreen(
    h,
    "src/app/trip/[tripId]/place/[placeId].tsx",
  );
  assert.equal(
    view.tree.root
      .findAllByType("TextInput")
      .some((n) => n.props.accessibilityLabel === "일정 시간"),
    false,
  );
  await act(async () =>
    view.tree.root
      .findAllByType("TextInput")
      .find((n) => n.props.accessibilityLabel === "확인할 지도 검색어")
      .props.onChangeText("Confirmed Road, Tokyo"),
  );
  await act(async () => tapText(view, "이 주소로 가고 싶은 곳에 저장"));
  assert.equal(
    view.tree.root
      .findAllByType("TextInput")
      .some((n) => n.props.accessibilityLabel === "일정 시간"),
    true,
  );
  assert.equal(
    view.store.trips[0].days[0].items.some((e) => e.placeId === "unverified"),
    false,
  );
  await act(async () => view.tree.unmount());
});

test("Tokyo can propose a geographic insertion with unknown transit, but requires explicit provisional acceptance", async () => {
  const seed = harness({}),
    source = JSON.parse(JSON.stringify(seed.load("src/data.ts").trips)),
    t = source[0];
  t.city = "Tokyo";
  t.country = "Japan";
  t.start = t.end = "2027-02-01";
  t.days = [
    {
      date: t.start,
      items: [
        {
          id: "protected-tsuchiya",
          name: "츠치야",
          time: "18:00",
          durationMinutes: 60,
          must: true,
          location: {
            label: "츠치야",
            query: "Existing Tokyo Address",
            description: "",
          },
        },
      ],
    },
  ];
  t.candidates = ["ozeki"];
  t.importedPlaces = [
    {
      id: "ozeki",
      name: "OZEKI TOKYO GALLERY",
      query: "Confirmed Gallery Address",
      address: "Confirmed Gallery Address",
      category: "관광",
      area: "Tokyo",
      description: "",
      image: "",
      sourcePostIds: [],
      matchStatus: "confirmed",
    },
  ];
  delete t.planning;
  delete t.planDraft;
  const h = harness({ tripId: t.id }, JSON.stringify(source), {
    routeFetcher: async (_, o) => {
      const b = JSON.parse(o.body);
      return {
        ok: true,
        json: async () => ({
          provider: "Google Maps",
          retrievedAt: "2026-11-15T12:00:00Z",
          routes: b.addresses.flatMap((from) =>
            b.addresses
              .filter((to) => to !== from)
              .map((to) => ({
                from,
                to,
                mode: "walking",
                durationSeconds: 193 * 60,
                distanceMeters: 14000,
                retrievedAt: "2026-11-15T12:00:00Z",
              })),
          ),
        }),
      };
    },
    fetcher: async (_, o) => ({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            type: "ADD",
            placeId: JSON.parse(o.body).places[0].id,
            date: t.start,
            time: "16:00",
          },
        ],
      }),
    }),
  });
  const view = await mountScreen(h, "src/app/trip/[tripId]/plan.tsx"),
    before = JSON.stringify(view.store.trips[0].days);
  await advancePlanner(view, 2);
  await act(async () => tapText(view, "조건 저장하고 AI 제안받기"));
  const visible = words(view.tree);
  assert.ok(
    visible.includes("Google API는 일본 대중교통 시간을 제공하지 않아요"),
  );
  assert.ok(visible.includes("대중교통 시간 확인이 필요한 배치안"));
  assert.ok(visible.includes("실제 소요시간이 아니에요"));
  assert.equal(visible.includes("193분"), false);
  assert.equal(JSON.stringify(view.store.trips[0].days), before);
  assert.equal(view.store.trips[0].planDraft.rows.length, 1);
  const selected = view.store.trips[0].planDraft.rows.map((r) => r.id);
  assert.equal(view.store.applyDraft(t.id, selected).ok, false);
  const action = view.tree.root.findAll(
    (n) =>
      n.type === "Text" && n.children.includes("선택한 1곳 임시 일정으로 추가"),
  )[0].parent;
  assert.equal(action.props.disabled, true);
  await act(async () =>
    view.tree.root
      .findAll(
        (n) =>
          n.type === "Pressable" &&
          n.props.accessibilityLabel ===
            "대중교통 시간 미확인 구간을 확인하고 임시 일정으로 추가",
      )[0]
      .props.onPress(),
  );
  await act(async () => tapText(view, "선택한 1곳 임시 일정으로 추가"));
  const stored = view.store.trips[0].days[0].items;
  assert.equal(stored.find((e) => e.id === "protected-tsuchiya").time, "18:00");
  assert.equal(
    stored.find((e) => e.placeId === "ozeki").needsTransitCheck,
    true,
  );
  await act(async () => view.tree.unmount());
});

test("planner wizard saves each stage, resumes after restart and keeps Instagram return in the place stage", async () => {
  const h = harness({ tripId: "paris" });
  const view = await mountScreen(h, "src/app/trip/[tripId]/plan.tsx");
  const before = JSON.stringify(view.store.trips[0].days);
  assert.ok(words(view.tree).includes("먼저 정해진 시간을 알려주세요"));
  assert.equal(words(view.tree).includes("하루의 속도와 식사"), false);
  assert.equal(words(view.tree).includes("조건 저장하고 AI 제안받기"), false);
  await advancePlanner(view, 1);
  assert.equal(view.store.trips[0].planning.wizardStep, 1);
  assert.ok(words(view.tree).includes("Instagram JSON에서 장소 가져오기"));
  assert.equal(words(view.tree).includes("하루의 속도와 식사"), false);
  await act(async () => h.headerOptions.headerLeft().props.onPress());
  assert.ok(words(view.tree).includes("먼저 정해진 시간을 알려주세요"));
  await advancePlanner(view, 1);
  await act(async () => tapText(view, "Instagram JSON에서 장소 가져오기"));
  assert.equal(h.navigation.at(-1).pathname, "/trip/[tripId]/instagram");
  assert.equal(h.navigation.at(-1).params.returnTo, "plan");
  const raw = h.raw;
  await act(async () => view.tree.unmount());
  const resumed = await mountScreen(
    harness({ tripId: "paris" }, raw),
    "src/app/trip/[tripId]/plan.tsx",
  );
  assert.ok(words(resumed.tree).includes("가고 싶은 곳을 모아보세요"));
  await advancePlanner(resumed, 2);
  assert.equal(resumed.store.trips[0].planning.wizardStep, 2);
  assert.ok(words(resumed.tree).includes("하루의 속도와 식사"));
  assert.equal(
    words(resumed.tree).includes("Instagram JSON에서 장소 가져오기"),
    false,
  );
  assert.equal(JSON.stringify(resumed.store.trips[0].days), before);
  await act(async () => tapText(resumed, "이전 단계"));
  assert.ok(words(resumed.tree).includes("가고 싶은 곳을 모아보세요"));
  await act(async () => resumed.tree.unmount());
});
test("candidate navigation launched from the wizard returns to AI planning instead of chapters", async () => {
  const h = harness({ tripId: "paris", returnTo: "plan" }, null, {
    pathname: "/trip/paris/candidates",
  });
  const view = await mountScreen(h, "src/app/trip/[tripId]/(tabs)/_layout.tsx");
  const back = view.tree.root
    .findByType("Tabs")
    .props.screenOptions.headerLeft();
  assert.equal(back.props.accessibilityLabel, "AI 계획으로 돌아가기");
  await act(async () => back.props.onPress());
  assert.equal(h.navigation.at(-1).pathname, "/trip/[tripId]/plan");
  await act(async () => view.tree.unmount());
});
