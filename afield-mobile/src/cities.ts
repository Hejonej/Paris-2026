import { worldRows } from "./worldCities";
export type City = {
  id: string;
  name: string;
  country: string;
  aliases: string[];
};
const rows: [string, string, string[]][] = [
  ["Paris", "France", ["파리", "프랑스"]],
  ["Berlin", "Germany", ["베를린", "독일"]],
  ["Copenhagen", "Denmark", ["코펜하겐", "덴마크"]],
  ["Tokyo", "Japan", ["도쿄", "동경", "일본"]],
  ["Rome", "Italy", ["로마", "이탈리아"]],
  ["Barcelona", "Spain", ["바르셀로나", "스페인"]],
  ["Lisbon", "Portugal", ["리스본", "포르투갈"]],
  ["London", "United Kingdom", ["런던", "영국"]],
  ["Seoul", "South Korea", ["서울", "대한민국", "한국"]],
  ["New York", "United States", ["뉴욕", "미국"]],
  ["Marseille", "France", ["마르세유", "프랑스"]],
  ["Aix-en-Provence", "France", ["엑상프로방스", "엑상", "프랑스"]],
  ["Frankfurt", "Germany", ["프랑크푸르트", "독일"]],
  ["Munich", "Germany", ["뮌헨", "독일"]],
  ["Vienna", "Austria", ["빈", "비엔나", "오스트리아"]],
  ["Prague", "Czech Republic", ["프라하", "체코"]],
  ["Amsterdam", "Netherlands", ["암스테르담", "네덜란드"]],
  ["Brussels", "Belgium", ["브뤼셀", "벨기에"]],
  ["Zurich", "Switzerland", ["취리히", "스위스"]],
  ["Milan", "Italy", ["밀라노", "이탈리아"]],
  ["Florence", "Italy", ["피렌체", "이탈리아"]],
  ["Venice", "Italy", ["베네치아", "베니스", "이탈리아"]],
  ["Madrid", "Spain", ["마드리드", "스페인"]],
  ["Nice", "France", ["니스", "프랑스"]],
];
const normalize = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
export const cities: City[] = worldRows.map(([id, name, country, aliases]) => {
  const curated = rows.find((r) => r[0] === name && r[1] === country);
  return {
    id,
    name,
    country,
    aliases: [...new Set([...(curated?.[2] || []), ...aliases])],
  };
});
const index = cities.map((city) => ({
  city,
  keys: [city.name, ...city.aliases].map(normalize),
  country: normalize(city.country),
}));
export function searchCities(query: string): City[] {
  const q = normalize(query);
  if (!q) return [];
  const ranked: { city: City; rank: number; order: number }[] = [];
  index.forEach((x, order) => {
    const rank = x.keys.some((k) => k === q)
      ? 0
      : x.keys.some((k) => k.startsWith(q))
        ? 1
        : x.keys.some((k) => k.includes(q))
          ? 2
          : x.country.includes(q)
            ? 3
            : 4;
    if (rank < 4) ranked.push({ city: x.city, rank, order });
  });
  return ranked
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .slice(0, 8)
    .map((x) => x.city);
}
export function findCity(query: string): City | undefined {
  const q = normalize(query);
  return index.find((x) => x.keys.includes(q))?.city;
}
