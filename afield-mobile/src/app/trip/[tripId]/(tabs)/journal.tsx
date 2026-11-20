import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Image, Alert } from "react-native";
import { Page, H, P, Label, Action, Field, s } from "../../../../ui";
import { Sheet } from "../../../../sheet";
import { useTripParams } from "../../../../route";
import { useTrips } from "../../../../store";
import { dateLabel } from "../../../../data";
import type { JournalEntry } from "../../../../data";
import { chooseTripPhoto } from "../../../../tripPhoto";
import { ui } from "../../../../theme";
export default function Journal() {
  const {
    tripId,
    entryId: requestedEntryId,
    date: requestedDate,
    writeRecord,
  } = useTripParams();
  const openedRecord = useRef("");
  const store = useTrips();
  const trip = store.trips.find((t) => t.id === tripId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [entryId, setEntryId] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [photoUri, setPhotoUri] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const picking = useRef(false);
  const saving = useRef(false);
  const photoSession = useRef(0);
  const records = [...(trip?.journal || [])].sort(
    (a, b) =>
      b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );
  const locations =
    trip?.days
      .flatMap((day) =>
        day.items
          .filter((e) => !e.anchorKey || !!e.location)
          .map((entry) => ({ date: day.date, entry })),
      )
      .sort(
        (a, b) =>
          Number(!!b.entry.visitedOn) - Number(!!a.entry.visitedOn) ||
          b.date.localeCompare(a.date),
      ) || [];
  function start(record?: JournalEntry) {
    photoSession.current++;
    saving.current = false;
    setEditing(record || null);
    setNote(record?.note || "");
    setPhotoUri(record?.photoUri || "");
    setDate(record?.date || "");
    setEntryId(record?.entryId || "");
    setError("");
    setConfirmDelete(false);
    setOpen(true);
  }
  useEffect(() => {
    if (
      !store.ready ||
      !trip ||
      !writeRecord ||
      openedRecord.current === writeRecord
    )
      return;
    const requested = trip.days
      .find((d) => d.date === requestedDate)
      ?.items.find((e) => e.id === requestedEntryId);
    if (!requested) return;
    openedRecord.current = writeRecord;
    const record = trip.journal?.find(
      (r) => r.entryId === requestedEntryId && r.date === requestedDate,
    );
    start(record);
    if (!record) {
      setEntryId(requestedEntryId);
      setDate(requestedDate);
    }
  }, [store.ready, tripId, writeRecord]);
  function close() {
    photoSession.current++;
    setOpen(false);
  }
  function requestClose() {
    if (
      note !== (editing?.note || "") ||
      photoUri !== (editing?.photoUri || "")
    ) {
      Alert.alert(
        "작성 중인 기록을 닫을까요?",
        "저장하지 않은 내용은 사라져요.",
        [
          { text: "계속 쓰기", style: "cancel" },
          { text: "저장하지 않고 닫기", style: "destructive", onPress: close },
        ],
      );
    } else close();
  }
  async function photo() {
    if (picking.current) return;
    const session = photoSession.current;
    picking.current = true;
    setBusy(true);
    setError("");
    try {
      const uri = await chooseTripPhoto("journal-photos");
      if (uri && session === photoSession.current) setPhotoUri(uri);
    } catch {
      if (session === photoSession.current)
        setError("사진을 가져오지 못했어요. 다른 사진을 선택해 주세요.");
    } finally {
      picking.current = false;
      setBusy(false);
    }
  }
  function save() {
    if (saving.current || picking.current) return;
    const r = store.saveJournal(tripId, {
      id: editing?.id,
      date,
      entryId,
      note,
      photoUri: photoUri || undefined,
    });
    if (!r.ok) {
      setError(r.message);
      return;
    }
    saving.current = true;
    close();
  }
  return (
    <Page>
      <Label>{trip?.city || "여행"} · 나의 방문 기록</Label>
      <H>기록</H>
      <P>방문한 장소에 사진 한 장, 짧은 기억을 남겨요.</P>
      <Action
        title="＋ 방문 기록 남기기"
        tone="primary"
        onPress={() => start()}
      />
      {!records.length && (
        <View
          style={{
            paddingVertical: 40,
            borderBottomWidth: 1,
            borderColor: ui.line,
          }}
        >
          <Text style={s.title}>아직 기록이 없어요</Text>
          <P>
            일정에서 방문한 곳을 선택해 남겨 주세요. 기록을 써도 일정이
            이동하거나 완료 처리되지는 않아요.
          </P>
        </View>
      )}
      {records.map((record, index) => (
        <View
          key={record.id}
          style={{
            paddingTop: 24,
            paddingBottom: 20,
            borderBottomWidth: 1,
            borderColor: ui.line,
          }}
        >
          {(index === 0 || records[index - 1].date !== record.date) && (
            <Label>{dateLabel(record.date)}</Label>
          )}
          <View
            style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}
          >
            {!!record.photoUri && (
              <Image
                source={{ uri: record.photoUri }}
                accessibilityLabel={`${record.placeName} 기록 사진`}
                style={{
                  width: 96,
                  height: 120,
                  borderRadius: 8,
                  backgroundColor: ui.line,
                }}
              />
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontSize: 17,
                  lineHeight: 25,
                  fontWeight: "600",
                  color: ui.ink,
                }}
              >
                {record.placeName}
              </Text>
              {!!record.note && (
                <Text
                  style={{
                    fontSize: 15,
                    lineHeight: 24,
                    color: ui.muted,
                    marginTop: 8,
                  }}
                >
                  {record.note}
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${record.placeName} 기록 수정`}
                onPress={() => start(record)}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text style={{ fontSize: 13, color: ui.blue }}>기록 수정</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ))}
      <Sheet
        visible={open}
        title={editing ? "기록 수정" : "방문 기록 남기기"}
        onClose={requestClose}
      >
        {editing ? (
          <>
            <Label>{dateLabel(editing.date)}</Label>
            <Text style={s.title}>{editing.placeName}</Text>
          </>
        ) : writeRecord && requestedEntryId === entryId && !!entryId ? (
          <>
            <Label>{dateLabel(date)}</Label>
            <Text style={s.title}>
              {
                locations.find((x) => x.entry.id === entryId && x.date === date)
                  ?.entry.name
              }
            </Text>
            <Action
              title="다른 장소 선택"
              tone="link"
              onPress={() => setEntryId("")}
            />
          </>
        ) : (
          <>
            <Label>방문한 장소 선택</Label>
            {!locations.length && (
              <P>
                먼저 일정에 장소를 추가해 주세요. 기록은 선택한 일정의 장소에
                연결해요.
              </P>
            )}
            {locations.map(({ entry, date: d }) => (
              <Pressable
                key={d + entry.id}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: entryId === entry.id && date === d,
                }}
                onPress={() => {
                  setEntryId(entry.id);
                  setDate(d);
                  setError("");
                }}
                style={{
                  minHeight: 52,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderColor: ui.line,
                  flexDirection: "row",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color:
                      entryId === entry.id && date === d ? ui.blue : ui.muted,
                  }}
                >
                  {entryId === entry.id && date === d ? "●" : "○"}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, color: ui.ink }}>
                    {entry.visitedOn ? "✓ " : ""}
                    {entry.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: ui.muted, marginTop: 4 }}>
                    {dateLabel(d)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        )}
        <View style={{ marginTop: 20 }}>
          <Label>사진 · 선택</Label>
          {!!photoUri && (
            <Image
              source={{ uri: photoUri }}
              accessibilityLabel="기록 사진 미리보기"
              style={{
                width: "100%",
                height: 180,
                borderRadius: 8,
                marginBottom: 12,
              }}
            />
          )}
          <Action
            title={busy ? "사진 불러오는 중…" : "사진 선택"}
            tone="secondary"
            disabled={busy}
            onPress={photo}
          />
          {!!photoUri && (
            <Action
              title="사진 빼기"
              tone="link"
              disabled={busy}
              onPress={() => setPhotoUri("")}
            />
          )}
        </View>
        <View style={{ marginTop: 20 }}>
          <Label>짧은 메모 · {note.length}/280</Label>
          <Field
            accessibilityLabel="기록 메모"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={280}
            placeholder="직접 보고 느낀 것, 다음에도 기억하고 싶은 것"
            style={{ minHeight: 100 }}
          />
        </View>
        {!!error && (
          <Text
            accessibilityRole="alert"
            style={{ color: ui.danger, marginVertical: 12 }}
          >
            {error}
          </Text>
        )}
        <Action
          title="기록 저장"
          tone="primary"
          disabled={busy || !entryId || (!note.trim() && !photoUri)}
          onPress={save}
        />
        {editing && (
          <Action
            title="이 기록 삭제"
            tone="link"
            onPress={() => setConfirmDelete(true)}
          />
        )}
        {confirmDelete && editing && (
          <View
            style={{
              padding: 14,
              backgroundColor: ui.dangerSoft,
              marginTop: 12,
              borderRadius: 8,
            }}
          >
            <P>
              이 기록의 사진과 메모를 목록에서 삭제할까요? 일정은 그대로예요.
            </P>
            <Action
              title="기록 삭제 확인"
              onPress={() => {
                const r = store.deleteJournal(tripId, editing.id);
                if (r.ok) close();
                else setError(r.message);
              }}
            />
            <Action
              title="삭제 취소"
              tone="link"
              onPress={() => setConfirmDelete(false)}
            />
          </View>
        )}
        <P>
          사진과 메모는 이 기기에 저장해요. AI에 보내거나 자동으로 공유하지
          않아요.
        </P>
      </Sheet>
    </Page>
  );
}
