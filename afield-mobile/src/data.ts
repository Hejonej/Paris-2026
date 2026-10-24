export type Entry = {
  id: string;
  time: string;
  name: string;
  placeId?: string;
  must?: boolean;
};
export type Day = { date: string; items: Entry[] };
export type Trip = {
  id: string;
  name: string;
  city: string;
  start: string;
  end: string;
  days: Day[];
  candidates: string[];
};
export const cover = (city: string) =>
  city.toLowerCase().includes("paris") || city.includes("파리")
    ? "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1000&q=80"
    : city.toLowerCase().includes("berlin") || city.includes("베를린")
      ? "https://images.unsplash.com/photo-1560969184-10fe8719e047?w=1000&q=80"
      : "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1000&q=80";
export const places = [
  {
    id: "ofr",
    name: "Ofr. Paris",
    category: "아트북 · 독립서점",
    area: "Le Marais",
    description:
      "작은 책장 사이에서 만나는 아트북과 독립출판물. 마레 산책 중 천천히 들르기 좋은 발견이에요.",
    image:
      "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=900&q=80",
    query: "Ofr Paris bookstore",
  },
  {
    id: "carnavalet",
    name: "Musée Carnavalet",
    category: "박물관 · 도시의 역사",
    area: "Le Marais",
    description:
      "파리의 시간을 따라 걷는 공간. 전시 관람 시간과 운영 여부는 방문 전에 지도에서 확인해 주세요.",
    image:
      "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=900&q=80",
    query: "Musee Carnavalet Paris",
  },
];
export function makeDays(start: string, end: string): Day[] {
  const result: Day[] = [];
  const first = Date.parse(start + "T00:00:00Z");
  const last = Date.parse(end + "T00:00:00Z");
  if (
    !Number.isFinite(first) ||
    !Number.isFinite(last) ||
    last < first ||
    last - first > 30 * 86400000
  )
    return result;
  for (let d = first; d <= last; d += 86400000)
    result.push({ date: new Date(d).toISOString().slice(0, 10), items: [] });
  return result;
}
export const trips: Trip[] = [
  {
    id: "paris",
    name: "Paris",
    city: "Paris",
    start: "2026-11-12",
    end: "2026-11-16",
    candidates: [],
    days: makeDays("2026-11-12", "2026-11-16").map((d, i) => ({
      ...d,
      items:
        i === 0
          ? [
              {
                id: "original-1",
                time: "10:00",
                name: "Le Marais 탐색",
                must: true,
              },
              { id: "original-2", time: "14:00", name: "독립서점 방문" },
            ]
          : i === 1
            ? [
                {
                  id: "original-3",
                  time: "10:00",
                  name: "Musée Carnavalet",
                  placeId: "carnavalet",
                },
                { id: "original-4", time: "13:00", name: "Le Marais 산책" },
              ]
            : [],
    })),
  },
  {
    id: "berlin",
    name: "Berlin",
    city: "Berlin",
    start: "",
    end: "",
    days: [],
    candidates: [],
  },
];
export const dateLabel = (date: string) =>
  new Date(date + "T00:00:00").toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
export const tripDates = (t: Trip) =>
  t.start
    ? `${t.start.replaceAll("-", ".")} — ${t.end.replaceAll("-", ".")}`
    : "날짜 미정";
export function tripState(t: Trip) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return !t.start
    ? "구상 중"
    : today < t.start
      ? "준비 중"
      : today > t.end
        ? "다녀온 여행"
        : "여행 중";
}
