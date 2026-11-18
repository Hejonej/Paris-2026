// Display only; planning math remains in minutes/seconds.
export function formatMinutes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "시간 미확인";
  const total = Math.ceil(value),
    hours = Math.floor(total / 60),
    minutes = total % 60;
  return hours
    ? `${hours}시간${minutes ? ` ${minutes}분` : ""}`
    : `${minutes}분`;
}
export function formatSeconds(value: number): string {
  return formatMinutes(value / 60);
}
