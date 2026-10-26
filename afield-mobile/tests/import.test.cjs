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
      AbortController,
      setTimeout,
      clearTimeout,
    },
  );
  return module.exports;
}
const ig = load("src/instagram.ts"),
  { trips, tripPlaces, makeDays } = load("src/data.ts"),
  { findCity, searchCities } = load("src/cities.ts"),
  { monthCells } = load("src/calendar.ts"),
  { validateTripDetails } = load("src/tripEditing.ts"),
  { matchPlace } = load("src/matching.ts");
const sample = {
  collections: [
    {
      name: "파리",
      posts: [
        {
          name: "책 구경",
          url: "https://www.instagram.com/p/ABC_123/?utm_source=test",
          caption: "@ofrparis\nOfr. Paris",
          owner: "여행자",
        },
        { name: "캡션 없는 원본", url: "https://instagram.com/reel/DEF456/" },
      ],
    },
    {
      name: "베를린",
      posts: [
        {
          name: "카페",
          url: "https://instagram.com/p/GHI789/",
          caption: "Berlin Coffee",
        },
      ],
    },
  ],
};
test("city aliases restore Korean/English search and country selection", () => {
  assert.equal(findCity("파리").name, "Paris");
  assert.equal(searchCities("도쿄")[0].country, "Japan");
  assert.equal(searchCities("ber")[0].name, "Berlin");
  assert.equal(searchCities("없는도시").length, 0);
});
test("calendar leap days and trips longer than 31 days work across year boundaries", () => {
  assert.ok(monthCells(2028, 1).includes("2028-02-29"));
  assert.equal(monthCells(2026, 1).filter(Boolean).length, 28);
  assert.equal(makeDays("2026-12-01", "2027-02-01").length, 63);
  assert.equal(
    validateTripDetails({
      name: "긴 여행",
      city: "Paris",
      start: "2026-12-01",
      end: "2027-02-01",
    }),
    "",
  );
});
test("collections preserve source URLs, caption text and captionless posts", () => {
  const parsed = ig.parseInstagram(JSON.stringify(sample));
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].name, "파리");
  assert.equal(parsed[0].posts.length, 2);
  assert.equal(parsed[0].posts[0].url, "https://www.instagram.com/p/ABC_123/");
  assert.ok(parsed[0].posts[0].caption.includes("@ofrparis"));
  assert.equal(parsed[0].posts[1].candidates.length, 0);
  assert.equal(parsed[1].posts[0].collection, "베를린");
});
test("legacy label_values/dict collections and Korean encoding remain readable", () => {
  const raw = {
    label_values: [
      { label: "이름", value: "Paris collection" },
      {
        label: "게시물",
        vec: [
          {
            dict: [
              { label: "이름", value: "작성자" },
              {
                label: "캡션",
                value: Buffer.from("카페 방문\n@coffeeshop", "utf8").toString(
                  "latin1",
                ),
              },
              {
                label: "링크",
                value: "https://www.instagram.com/reel/Korean01/",
              },
            ],
          },
        ],
      },
    ],
  };
  const parsed = ig.parseInstagram(JSON.stringify(raw));
  assert.equal(parsed[0].name, "Paris collection");
  assert.equal(parsed[0].posts.length, 1);
  assert.ok(parsed[0].posts[0].caption.includes("카페 방문"));
  assert.ok(parsed[0].posts[0].candidates.some((c) => c.name === "coffeeshop"));
});
test("Meta string_list_data and string_map_data formats do not invent captions", () => {
  for (const raw of [
    {
      saved_saved_media: [
        {
          title: "Saved owner",
          string_list_data: [
            { href: "https://www.instagram.com/p/Meta01/", value: "username" },
          ],
        },
      ],
    },
    {
      saved_saved_media: [
        {
          title: "Saved owner",
          string_map_data: {
            "Saved on": {
              href: "https://www.instagram.com/p/Meta02/",
              timestamp: 123,
            },
          },
        },
      ],
    },
  ]) {
    const p = ig.parseInstagram(JSON.stringify(raw))[0].posts;
    assert.equal(p.length, 1);
    assert.equal(p[0].caption, "");
    assert.equal(p[0].name, "Saved owner");
  }
});
test("bad JSON, unrelated data and deceptive source domains are rejected", () => {
  assert.throws(() => ig.parseInstagram("{bad"));
  assert.throws(() => ig.parseInstagram("{}"));
  assert.throws(() =>
    ig.parseInstagram(
      JSON.stringify([
        { name: "fake", url: "https://instagram.com.evil.example/p/FAKE/" },
      ]),
    ),
  );
  assert.equal(ig.instagramUrl("javascript:alert(1)"), "");
});
test("import and candidate confirmation preserve all existing itinerary objects and MUST", () => {
  const posts = ig.parseInstagram(JSON.stringify(sample))[0].posts;
  const before = JSON.stringify(trips);
  const imported = ig.importPosts(trips, "paris", posts);
  assert.equal(imported.ok, true);
  assert.equal(imported.trips[0].days, trips[0].days);
  assert.equal(imported.trips[1], trips[1]);
  assert.equal(imported.trips[0].candidates.length, 0);
  assert.equal(ig.importPosts(imported.trips, "paris", posts).ok, false);
  const c = posts[0].candidates.find((c) => c.name === "Ofr. Paris");
  assert.ok(c);
  const result = ig.confirmCandidates(imported.trips, "paris", [
    { postId: posts[0].id, candidateId: c.id },
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.trips[0].days, trips[0].days);
  assert.equal(result.trips[0].days[0].items[0].must, true);
  assert.equal(result.trips[0].importedPlaces[0].sourcePostIds[0], posts[0].id);
  assert.equal(
    result.trips[0].importedPlaces[0].matchStatus,
    "needs_confirmation",
  );
  assert.equal(result.trips[0].inspirations[0].caption, posts[0].caption);
  assert.equal(JSON.stringify(trips), before);
  assert.equal(
    tripPlaces(result.trips[0]).filter((p) => p.id === "ofr").length,
    1,
  );
});
test("duplicate place candidates merge only their explicit source references", () => {
  const posts = ig.parseInstagram(
    JSON.stringify([
      {
        name: "one",
        url: "https://instagram.com/p/one/",
        caption: "Cafe Example",
      },
      {
        name: "two",
        url: "https://instagram.com/p/two/",
        caption: "Cafe Example",
      },
    ]),
  )[0].posts;
  const imported = ig.importPosts(trips, "paris", posts);
  const selected = posts.map((p) => ({
    postId: p.id,
    candidateId: p.candidates[0].id,
  }));
  const result = ig.confirmCandidates(imported.trips, "paris", selected);
  assert.equal(result.trips[0].importedPlaces.length, 1);
  assert.equal(result.trips[0].importedPlaces[0].sourcePostIds.length, 2);
  assert.equal(ig.confirmCandidates(result.trips, "paris", selected).ok, false);
  const place = result.trips[0].importedPlaces[0];
  const verified = ig.updateImportedPlace(result.trips, "paris", place.id, {
    name: "Cafe Example",
    query: "Exact Street, Paris",
    address: "Exact Street",
  });
  assert.equal(verified.trips[0].importedPlaces[0].matchStatus, "confirmed");
  assert.equal(verified.trips[0].days, trips[0].days);
});
test("manual candidates preserve captionless original posts and reject duplicates", () => {
  const post = ig.parseInstagram(JSON.stringify(sample))[0].posts[1];
  const imported = ig.importPosts(trips, "paris", [post]);
  const result = ig.addManualCandidate(
    imported.trips,
    "paris",
    post.id,
    "원본에서 확인한 서점",
  );
  assert.equal(result.ok, true);
  const saved = result.trips[0].inspirations[0];
  assert.equal(saved.caption, "");
  assert.equal(saved.url, post.url);
  assert.equal(saved.candidates[0].kind, "manual");
  assert.equal(
    ig.addManualCandidate(
      result.trips,
      "paris",
      post.id,
      "원본에서 확인한 서점",
    ).ok,
    false,
  );
});
test("existing Google matching contract sends no captions and normalizes complete results", async () => {
  let body;
  const matches = await matchPlace(
    "Paris",
    "France",
    "Ofr",
    async (url, options) => {
      body = JSON.parse(options.body);
      assert.ok(url.endsWith("/places-match"));
      return {
        ok: true,
        json: async () => ({
          results: [
            {
              clientIndex: 0,
              match: {
                displayName: "Ofr. Paris",
                formattedAddress: "20 Rue, Paris",
                placeId: "google-1",
              },
            },
          ],
        }),
      };
    },
  );
  assert.equal(body.places[0].sourcePost, "");
  assert.equal(matches[0].googlePlaceId, "google-1");
  assert.equal(matches[0].query, "Ofr. Paris, 20 Rue, Paris");
});
test("Google service errors and unusable results remain recoverable", async () => {
  await assert.rejects(
    matchPlace("Paris", "France", "Ofr", async () => ({
      ok: false,
      json: async () => ({ error: "service unavailable" }),
    })),
    /장소 확인 서비스/,
  );
  assert.equal(
    (
      await matchPlace("Paris", "France", "Ofr", async () => ({
        ok: true,
        json: async () => ({
          results: [
            {
              clientIndex: 0,
              candidates: [{ displayName: "Missing address" }],
            },
          ],
        }),
      }))
    ).length,
    0,
  );
});

test("Google permission failures explain the manual-location fallback", async () => {
  await assert.rejects(
    matchPlace("Paris", "France", "Ofr", async () => ({
      ok: false,
      status: 502,
      json: async () => ({
        error: "google_places_error",
        detail: "The caller does not have permission",
      }),
    })),
    /Google 접근 권한/,
  );
});

test("global offline city search includes Sydney, Melbourne, Bangkok and Korean aliases", () => {
  assert.equal(searchCities("시드니")[0].name, "Sydney");
  assert.equal(searchCities("Sydney")[0].country, "Australia");
  assert.equal(findCity("멜버른").country, "Australia");
  assert.equal(searchCities("방콕")[0].country, "Thailand");
  assert.ok(searchCities("syd").some((c) => c.name === "Sydney"));
  assert.equal(searchCities("   ").length, 0);
  assert.equal(searchCities("없는도시가나다").length, 0);
});
test("alternate post URL fields and username-prefixed URLs import without remote resolution", () => {
  for (const field of ["post_url", "permalink", "uri", "value"]) {
    const result = ig.parseInstagram(
      JSON.stringify([
        {
          title: "Saved post",
          [field]: "https://www.instagram.com/author/p/AbC123/?igsh=test",
        },
      ]),
    );
    assert.equal(result[0].posts[0].url, "https://www.instagram.com/p/AbC123/");
  }
});
test("a collection-only index explains the missing posts rather than claiming file read failure", () => {
  assert.throws(
    () =>
      ig.parseInstagram(JSON.stringify({ collections: [{ name: "Sydney" }] })),
    /컬렉션 이름만 든 목록/,
  );
  assert.throws(
    () =>
      ig.parseInstagram(JSON.stringify({ collections: [{ name: "Sydney" }] })),
    /진단 정보: collections/,
  );
});
