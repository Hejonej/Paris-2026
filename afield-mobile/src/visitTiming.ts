import type { Entry, Trip } from "./data";
// Ordinary visits have no fixed end. Historical duration fields are kept for compatibility only.
export function reservedMinutes(
  entry: Entry,
  trip?: Trip,
  date?: string,
): number {
  const key = entry.anchorKey || "";
  if (/^(점심|저녁|휴식)-\d{4}-/.test(key) || /^(meal|rest)[-:]/.test(key))
    return 0;
  if (key)
    return Number.isFinite(entry.durationMinutes)
      ? Math.max(0, entry.durationMinutes!)
      : 0;
  const fixed = trip?.planning?.fixed.find(
    (f) => f.date === date && f.time === entry.time && f.name === entry.name,
  );
  return fixed?.duration || 0;
}
