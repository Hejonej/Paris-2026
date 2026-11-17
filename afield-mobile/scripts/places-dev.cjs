// Server-only: the Google key stays on the Mac, never in the app bundle.
const { readConfig } = require("./maps-dev.cjs");
async function searchPlaces(
  { name, city, country = "" },
  fetcher = fetch,
  key = readConfig().apiKey,
) {
  if (!key) throw Error("맥북의 개발용 Google 키를 먼저 저장해 주세요.");
  if (
    [name, city, country].some(
      (v) => typeof v !== "string" || v.length > 160,
    ) ||
    !name.trim() ||
    !city.trim()
  )
    throw Error("장소 이름과 여행 도시를 확인해 주세요.");
  const r = await fetcher(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress",
      },
      body: JSON.stringify({
        textQuery: [name, city, country].filter(Boolean).join(", "),
        languageCode: "ko",
        pageSize: 3,
      }),
      signal: AbortSignal.timeout(15000),
    },
  );
  const data = await r.json();
  if (!r.ok) {
    if (r.status === 403)
      throw Error(
        "숙소 주소 검색 권한이 꺼져 있어요. Google Cloud의 Afield 프로젝트에서 Places API (New)를 사용 설정하고, 저장된 키의 API 제한사항에도 추가해 주세요. Routes API만으로는 주소 검색을 할 수 없어요.",
      );
    throw Error(
      "주소 검색 서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.",
    );
  }
  return {
    places: (data.places || [])
      .filter((p) => p.id && p.displayName?.text && p.formattedAddress)
      .slice(0, 3)
      .map((p) => ({
        name: p.displayName.text,
        address: p.formattedAddress,
        googlePlaceId: p.id,
        query: p.displayName.text + ", " + p.formattedAddress,
      })),
  };
}
module.exports = { searchPlaces };
