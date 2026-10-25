export function dayISO(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
export function monthCells(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const length = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array.from(
    { length: first.getDay() },
    () => null,
  );
  for (let d = 1; d <= length; d++) cells.push(dayISO(year, month, d));
  return cells;
}
