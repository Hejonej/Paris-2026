export type GoogleMatch = {
  name: string;
  address: string;
  googlePlaceId: string;
  query: string;
};
// Same read-only matching endpoint used by the existing web client. No captions or JSON file contents are sent.
const ENDPOINT = "https://travel-ai.luckyjungheywon.workers.dev/places-match";
export async function matchPlace(
  city: string,
  country: string,
  name: string,
  fetcher: typeof fetch = fetch,
): Promise<GoogleMatch[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetcher(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        city,
        country,
        places: [{ clientIndex: 0, name, category: "Other", sourcePost: "" }],
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (
        response.status === 403 ||
        String(data?.detail || "")
          .toLowerCase()
          .includes("permission")
      )
        throw Error(
          "장소 확인 서비스의 Google 접근 권한에 문제가 있어요. 아래 지도에서 직접 위치를 확인해 주세요.",
        );
      throw Error(
        "장소 확인 서비스가 응답하지 않아요. 지도에서 직접 위치를 확인하거나 나중에 다시 시도해 주세요.",
      );
    }
    const result = Array.isArray(data?.results)
      ? data.results.find((r: any) => r?.clientIndex === 0)
      : undefined;
    if (!result) throw Error("장소 확인 결과를 받지 못했어요.");
    const rows = result.match
      ? [result.match]
      : Array.isArray(result.candidates)
        ? result.candidates
        : [];
    const matches: GoogleMatch[] = [];
    for (const row of rows) {
      const display =
        typeof row?.displayName === "string"
          ? row.displayName
          : row?.displayName?.text;
      const address = row?.formattedAddress;
      const id = row?.placeId;
      if (
        typeof display !== "string" ||
        typeof address !== "string" ||
        typeof id !== "string" ||
        !display ||
        !address ||
        !id
      )
        continue;
      if (matches.some((m) => m.googlePlaceId === id)) continue;
      matches.push({
        name: display,
        address,
        googlePlaceId: id,
        query: display + ", " + address,
      });
    }
    return matches.slice(0, 3);
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError")
      throw Error(
        "장소 확인이 지연되고 있어요. 다시 시도하거나 지도에서 직접 확인해 주세요.",
      );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
