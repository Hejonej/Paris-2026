import { imageSource } from "../images";
import React, { useState } from "react";
import { useRouter } from "expo-router";
import { View, Text, Pressable, Image, StyleSheet, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Page, Action, H, P } from "../ui";
import { cover, tripState } from "../data";
import { useTrips } from "../store";
import { ui } from "../theme";
export default function Chapters() {
  const router = useRouter();
  const { trips, deletedTrips, restoreTrip, deleteTrips } = useTrips();
  const [showDeleted, setShowDeleted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState("");
  const selected = trips.filter((t) => selection.has(t.id));
  const allSelected = trips.length > 0 && selected.length === trips.length;
  function toggleEdit() {
    setEditing(!editing);
    setSelection(new Set());
    setConfirmDelete(false);
    setShowDeleted(false);
    setMessage("");
  }
  const planned = trips.filter((t) => t.start).length;
  return (
    <View style={{ flex: 1, backgroundColor: ui.bg }}>
      <Page>
        <View style={styles.heading}>
          <View>
            <Text style={styles.eyebrow}>떠나기 전부터, 돌아온 뒤까지</Text>
            <Text style={styles.headingTitle}>나의 여행</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editing ? "챕터 편집 완료" : "챕터 목록 편집"}
            disabled={!trips.length && !editing}
            onPress={toggleEdit}
            style={{
              minHeight: 44,
              minWidth: 56,
              alignItems: "center",
              justifyContent: "center",
              opacity: trips.length || editing ? 1 : 0.4,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: "600", color: ui.accent }}>
              {editing ? "완료" : "편집"}
            </Text>
          </Pressable>
        </View>
        {editing && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <Text
              accessibilityLiveRegion="polite"
              style={{ fontSize: 16, color: ui.ink }}
            >
              {selected.length}개 선택
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setSelection(
                  allSelected ? new Set() : new Set(trips.map((t) => t.id)),
                )
              }
              style={{
                minHeight: 44,
                justifyContent: "center",
                paddingHorizontal: 8,
              }}
            >
              <Text style={{ fontSize: 16, color: ui.accent }}>
                {allSelected ? "선택 해제" : "전체 선택"}
              </Text>
            </Pressable>
          </View>
        )}
        {!!message && (
          <Text
            accessibilityRole="alert"
            style={{
              fontSize: 16,
              lineHeight: 24,
              color: ui.accent,
              marginBottom: 12,
            }}
          >
            {message}
          </Text>
        )}
        <View style={styles.summary}>
          <Ionicons name="compass-outline" size={20} color={ui.accent} />
          <Text style={styles.summaryText}>
            날짜가 정해진 여행 {planned} · 가고 싶은 곳{" "}
            {trips.reduce((n, t) => n + t.candidates.length, 0)}
          </Text>
        </View>
        {trips.map((t, i) => {
          const count = t.days.reduce((n, d) => n + d.items.length, 0);
          const first = t.days.flatMap((d) => d.items)[0];
          return (
            <Pressable
              key={t.id}
              accessibilityRole={editing ? "checkbox" : "button"}
              accessibilityState={
                editing ? { checked: selection.has(t.id) } : undefined
              }
              accessibilityLabel={
                editing
                  ? `${t.name} 선택`
                  : `${t.name}, ${tripState(t)}, 여행 열기`
              }
              onPress={() => {
                if (editing) {
                  setSelection((current) => {
                    const next = new Set(current);
                    next.has(t.id) ? next.delete(t.id) : next.add(t.id);
                    return next;
                  });
                } else
                  router.push({
                    pathname: "/trip/[tripId]",
                    params: { tripId: t.id },
                  });
              }}
              style={({ pressed }) => [
                styles.card,
                editing &&
                  selection.has(t.id) && {
                    borderColor: ui.accent,
                    backgroundColor: "#E7EBE2",
                  },
                { opacity: pressed ? 0.78 : 1 },
              ]}
            >
              <View style={styles.photoWrap}>
                <Image
                  source={imageSource(cover(t.city))}
                  style={styles.photo}
                />
                <View style={styles.number}>
                  <Text style={styles.numberText}>
                    {editing
                      ? selection.has(t.id)
                        ? "✓"
                        : "○"
                      : String(i + 1).padStart(2, "0")}
                  </Text>
                </View>
              </View>
              <View style={styles.body}>
                <View style={styles.row}>
                  <Text style={styles.city}>{t.city}</Text>
                  <View style={styles.status}>
                    <View style={styles.dot} />
                    <Text style={styles.statusText}>{tripState(t)}</Text>
                  </View>
                </View>
                <Text style={styles.title}>{t.name}</Text>
                <Text style={styles.dates}>
                  {t.start
                    ? `${t.start.replaceAll("-", ".")} — ${t.end.slice(5).replace("-", ".")}`
                    : "날짜는 천천히 정해도 괜찮아요"}
                </Text>
                <View style={styles.footer}>
                  <Text style={styles.meta}>
                    일정 {count} · 저장 {t.candidates.length}
                  </Text>
                  {!editing && (
                    <Ionicons
                      name="arrow-forward"
                      size={20}
                      color={ui.accent}
                    />
                  )}
                </View>
                {first && (
                  <View style={styles.preview}>
                    <Ionicons
                      name="location-outline"
                      size={15}
                      color={ui.accent}
                    />
                    <Text numberOfLines={1} style={styles.previewText}>
                      {first.name}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
        {!trips.length && (
          <Text
            style={{
              fontSize: 17,
              lineHeight: 26,
              color: ui.muted,
              marginVertical: 16,
            }}
          >
            첫 챕터를 만들어 여행을 시작해 보세요.
          </Text>
        )}
        {!editing && (
          <Action
            title="＋ 새 여행 만들기"
            onPress={() => router.push("/new-trip")}
          />
        )}
        {!editing && !!deletedTrips.length && (
          <>
            <Action
              title={`삭제한 챕터 ${deletedTrips.length}개 ${showDeleted ? "접기" : "보기"}`}
              secondary
              onPress={() => setShowDeleted(!showDeleted)}
            />
            {showDeleted &&
              deletedTrips.map((t) => (
                <View
                  key={t.id}
                  style={{
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderColor: ui.line,
                  }}
                >
                  <Text
                    style={{ fontSize: 18, fontWeight: "600", color: ui.ink }}
                  >
                    {t.name}
                  </Text>
                  <Text style={{ fontSize: 15, color: ui.muted }}>
                    {t.city} · 일정과 저장한 장소 보관 중
                  </Text>
                  <Action
                    title={`${t.name} 복원`}
                    secondary
                    onPress={() => restoreTrip(t.id)}
                  />
                </View>
              ))}
          </>
        )}
      </Page>
      {editing && (
        <View
          style={{
            padding: 16,
            paddingBottom: 34,
            borderTopWidth: 1,
            borderColor: ui.line,
            backgroundColor: ui.bg,
          }}
        >
          <P>하나를 선택하면 정보를 수정할 수 있어요.</P>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Action
                title="정보 수정"
                secondary
                disabled={selected.length !== 1}
                onPress={() => {
                  const trip = selected[0];
                  if (trip) {
                    setEditing(false);
                    setSelection(new Set());
                    router.push({
                      pathname: "/trip/[tripId]/edit",
                      params: { tripId: trip.id },
                    });
                  }
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`선택한 ${selected.length}개 챕터 삭제`}
                accessibilityState={{ disabled: !selected.length }}
                disabled={!selected.length}
                onPress={() => setConfirmDelete(true)}
                style={{
                  minHeight: 48,
                  marginTop: 6,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: selected.length ? "#A23C2B" : ui.line,
                }}
              >
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "600",
                    color: selected.length ? "white" : ui.muted,
                  }}
                >
                  {selected.length}개 삭제
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
      {confirmDelete && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setConfirmDelete(false)}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              backgroundColor: "#00000066",
              padding: 24,
            }}
          >
            <View
              accessibilityViewIsModal
              style={{ backgroundColor: ui.bg, borderRadius: 18, padding: 22 }}
            >
              <H>{selected.length}개 챕터를 삭제할까요?</H>
              <P>
                일정과 저장한 장소도 목록에서 함께 숨겨져요. ‘삭제한 챕터’에서
                복원할 수 있어요.
              </P>
              <Action
                title="선택한 챕터 삭제"
                onPress={() => {
                  const result = deleteTrips(selected.map((t) => t.id));
                  setConfirmDelete(false);
                  setMessage(result.message);
                  if (result.ok) {
                    setEditing(false);
                    setSelection(new Set());
                  }
                }}
              />
              <Action
                title="취소"
                secondary
                onPress={() => setConfirmDelete(false)}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  heading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  eyebrow: { fontSize: 15, color: ui.muted, marginBottom: 7 },
  headingTitle: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -1,
    color: ui.ink,
  },
  count: {
    borderRadius: 22,
    backgroundColor: "#E1E8DB",
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  countText: { fontSize: 20, fontWeight: "600", color: ui.accent },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: ui.line,
    paddingVertical: 13,
    marginBottom: 18,
  },
  summaryText: { fontSize: 14, color: ui.accent, flex: 1 },
  card: {
    backgroundColor: ui.surface,
    borderWidth: 1,
    borderColor: ui.line,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 16,
    flexDirection: "row",
  },
  photoWrap: { width: 112, minHeight: 190 },
  photo: {
    position: "absolute",
    width: "100%",
    height: "100%",
    backgroundColor: "#C9D3C0",
  },
  number: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: ui.surface,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  numberText: { fontSize: 14, fontWeight: "700", color: ui.accent },
  body: { flex: 1, padding: 15 },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  city: { fontSize: 14, color: ui.muted },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EBEFE6",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: ui.accent },
  statusText: { fontSize: 13, fontWeight: "600", color: ui.accent },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: ui.ink,
    letterSpacing: -0.6,
    marginTop: 10,
  },
  dates: { fontSize: 14, color: ui.muted, lineHeight: 21, marginTop: 5 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 13,
  },
  meta: { fontSize: 14, color: ui.ink, fontWeight: "500" },
  preview: {
    borderTopWidth: 1,
    borderColor: ui.line,
    marginTop: 12,
    paddingTop: 9,
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  previewText: { flex: 1, fontSize: 13, color: ui.muted },
});
