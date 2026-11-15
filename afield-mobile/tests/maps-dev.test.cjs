const test = require("node:test"),
  assert = require("node:assert/strict");
const { computeRoute } = require("../scripts/maps-dev.cjs");
test("development route service sends addresses directly to Google and returns only provider facts", async () => {
  let request;
  const r = await computeRoute(
    { from: " Hotel Address ", to: " Place Address ", mode: "walking" },
    async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        json: async () => ({
          routes: [{ duration: "125.5s", distanceMeters: 150 }],
        }),
      };
    },
    "private-test-key-not-real",
  );
  assert.equal(
    request.url,
    "https://routes.googleapis.com/directions/v2:computeRoutes",
  );
  const body = JSON.parse(request.options.body);
  assert.equal(body.origin.address, "Hotel Address");
  assert.equal(body.destination.address, "Place Address");
  assert.equal(body.travelMode, "WALK");
  assert.equal(r.durationSeconds, 125.5);
  assert.equal(r.distanceMeters, 150);
  assert.equal(JSON.stringify(r).includes("private-test-key"), false);
});
test("missing permissions, malformed durations and invalid input never become made-up travel times", async () => {
  let calls = 0;
  const fake = async () => {
    calls++;
    return { ok: true, json: async () => ({ routes: [] }) };
  };
  await assert.rejects(
    () => computeRoute({ from: "A", to: "B", mode: "walking" }, fake, ""),
    /키/,
  );
  assert.equal(calls, 0);
  await assert.rejects(
    () => computeRoute({ from: "A", to: "B", mode: "flying" }, fake, "test"),
    /이동 방식/,
  );
  assert.equal(calls, 0);
  await assert.rejects(
    () =>
      computeRoute(
        { from: "A", to: "B", mode: "transit" },
        async () => ({
          ok: false,
          json: async () => ({
            error: {
              status: "PERMISSION_DENIED",
              message: "private-credential",
            },
          }),
        }),
        "test",
      ),
    /Google 권한/,
  );
  await assert.rejects(
    () => computeRoute({ from: "A", to: "B", mode: "walking" }, fake, "test"),
    /찾지 못/,
  );
  await assert.rejects(
    () =>
      computeRoute(
        { from: "A", to: "B", mode: "walking" },
        async () => ({
          ok: true,
          json: async () => ({
            routes: [{ duration: "-1s", distanceMeters: 100 }],
          }),
        }),
        "test",
      ),
    /찾지 못/,
  );
});
