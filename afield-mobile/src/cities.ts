export type City = { name: string; country: string; aliases: string[] };
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
export const cities: City[] = rows.map(([name, country, aliases]) => ({
  name,
  country,
  aliases,
}));
export function searchCities(query: string): City[] {
  const q = query.trim().toLocaleLowerCase();
  return q
    ? cities
        .filter((c) =>
          [c.name, c.country, ...c.aliases].some((v) =>
            v.toLocaleLowerCase().includes(q),
          ),
        )
        .slice(0, 8)
    : [];
}
export function findCity(query: string): City | undefined {
  const q = query.trim().toLocaleLowerCase();
  return cities.find(
    (c) =>
      c.name.toLocaleLowerCase() === q ||
      c.aliases.some((a) => a.toLocaleLowerCase() === q),
  );
}
