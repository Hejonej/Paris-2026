import type { Trip, JournalEntry } from "./data";
export function validJournalEntry(value: unknown): value is JournalEntry {
  if (!value || typeof value !== "object") return false;
  const r = value as JournalEntry;
  return (
    typeof r.id === "string" &&
    typeof r.entryId === "string" &&
    typeof r.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
    typeof r.placeName === "string" &&
    r.placeName.length > 0 &&
    r.placeName.length <= 300 &&
    typeof r.note === "string" &&
    r.note.length <= 280 &&
    typeof r.createdAt === "string" &&
    Number.isFinite(Date.parse(r.createdAt)) &&
    (r.photoUri === undefined ||
      (typeof r.photoUri === "string" &&
        r.photoUri.length <= 2000 &&
        /^file:\/\//.test(r.photoUri))) &&
    (!!r.note.trim() || !!r.photoUri)
  );
}
export function saveJournal(
  trips: Trip[],
  tripId: string,
  input: {
    id?: string;
    date: string;
    entryId: string;
    note: string;
    photoUri?: string;
  },
) {
  const fail = (message: string) => ({ trips, ok: false, message });
  const trip = trips.find((t) => t.id === tripId && !t.deletedAt);
  if (!trip) return fail("여행을 찾을 수 없어요.");
  const existing = input.id
    ? trip.journal?.find((r) => r.id === input.id)
    : undefined;
  if (input.id && !existing) return fail("수정할 기록을 찾을 수 없어요.");
  const entry = trip.days
    .find((d) => d.date === input.date)
    ?.items.find((e) => e.id === input.entryId);
  if (!entry && !existing) return fail("기록할 일정의 장소를 선택해 주세요.");
  if (
    existing &&
    (existing.entryId !== input.entryId || existing.date !== input.date)
  )
    return fail("기록의 연결 장소는 바꾸지 않아요. 새 기록을 추가해 주세요.");
  const record: JournalEntry = {
    id:
      existing?.id ||
      `journal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    entryId: input.entryId,
    date: input.date,
    placeName: existing?.placeName || entry!.name,
    note: input.note.trim(),
    photoUri: input.photoUri || undefined,
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
  if (!validJournalEntry(record))
    return fail("사진 또는 280자 이내의 짧은 메모를 남겨 주세요.");
  return {
    ok: true,
    message: "기록을 저장했어요.",
    trips: trips.map((t) =>
      t.id === tripId
        ? {
            ...t,
            journal: existing
              ? (t.journal || []).map((r) =>
                  r.id === existing.id ? record : r,
                )
              : [...(t.journal || []), record],
          }
        : t,
    ),
  };
}
export function deleteJournal(trips: Trip[], tripId: string, recordId: string) {
  if (
    !trips.some(
      (t) =>
        t.id === tripId &&
        !t.deletedAt &&
        t.journal?.some((r) => r.id === recordId),
    )
  )
    return { trips, ok: false, message: "삭제할 기록을 찾을 수 없어요." };
  return {
    ok: true,
    message: "기록을 삭제했어요.",
    trips: trips.map((t) =>
      t.id === tripId
        ? { ...t, journal: t.journal?.filter((r) => r.id !== recordId) }
        : t,
    ),
  };
}
