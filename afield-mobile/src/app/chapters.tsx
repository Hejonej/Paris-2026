import { imageSource } from "../images";
import React, { useState } from "react";
import { useRouter } from "expo-router";
import { View, Text, Pressable, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Page, Action } from "../ui";
import { cover, tripState } from "../data";
import { useTrips } from "../store";
import { ui } from "../theme";
export default function Chapters() {
  const router = useRouter();
  const { trips, deletedTrips, restoreTrip } = useTrips();
  const [showDeleted, setShowDeleted] = useState(false);
  const planned = trips.filter((t) => t.start).length;
  return (
    <Page>
      <View style={styles.heading}>
        <View>
          <Text style={styles.eyebrow}>떠나기 전부터, 돌아온 뒤까지</Text>
          <Text style={styles.headingTitle}>나의 여행</Text>
        </View>
        <View style={styles.count}>
          <Text style={styles.countText}>{trips.length}</Text>
        </View>
      </View>
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
            accessibilityRole="button"
            accessibilityLabel={`${t.name}, ${tripState(t)}, 여행 열기`}
            onPress={() =>
              router.push({
                pathname: "/trip/[tripId]",
                params: { tripId: t.id },
              })
            }
            style={({ pressed }) => [
              styles.card,
              { opacity: pressed ? 0.78 : 1 },
            ]}
          >
            <View style={styles.photoWrap}>
              <Image source={imageSource(cover(t.city))} style={styles.photo} />
              <View style={styles.number}>
                <Text style={styles.numberText}>
                  {String(i + 1).padStart(2, "0")}
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
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t.name} 수정 또는 삭제`}
                  onPress={(event) => {
                    event.stopPropagation();
                    router.push({
                      pathname: "/trip/[tripId]/edit",
                      params: { tripId: t.id },
                    });
                  }}
                  style={{
                    minHeight: 44,
                    justifyContent: "center",
                    paddingHorizontal: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      color: ui.accent,
                      fontWeight: "600",
                    }}
                  >
                    관리 ›
                  </Text>
                </Pressable>
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
      <Action
        title="＋ 새 여행 만들기"
        onPress={() => router.push("/new-trip")}
      />
      {!!deletedTrips.length && (
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
