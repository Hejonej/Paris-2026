const test = require("node:test"),
  assert = require("node:assert/strict");
const { searchPlaces } = require("../scripts/places-dev.cjs");
test("local place lookup normalizes actual names and addresses and limits fields", async () => {
  let body;
  const result = await searchPlaces(
    { name: "Daiichi Hotel", city: "Tokyo", country: "Japan" },
    async (url, options) => {
      body = JSON.parse(options.body);
      assert.equal(url, "https://places.googleapis.com/v1/places:searchText");
      assert.equal(
        options.headers["X-Goog-FieldMask"],
        "places.id,places.displayName,places.formattedAddress",
      );
      return {
        ok: true,
        json: async () => ({
          places: [
            {
              id: "test",
              displayName: { text: "第一ホテル東京" },
              formattedAddress: "Tokyo address",
            },
            { id: "incomplete" },
          ],
        }),
      };
    },
    "test-key",
  );
  assert.equal(body.textQuery, "Daiichi Hotel, Tokyo, Japan");
  assert.equal(result.places.length, 1);
  assert.equal(result.places[0].address, "Tokyo address");
  assert.equal(result.places[0].name, "第一ホテル東京");
});
test("missing Places permission is actionable and never treated as an empty search", async () => {
  await assert.rejects(
    () =>
      searchPlaces(
        { name: "Hotel", city: "Tokyo" },
        async () => ({ ok: false, status: 403, json: async () => ({}) }),
        "test-key",
      ),
    /Places API \(New\)/,
  );
});
