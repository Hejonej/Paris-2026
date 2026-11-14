import React from "react";
import { useRouter } from "expo-router";
import { Text, Pressable, View, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Page, H, P, Action, s } from "../../../../ui";
import { cover, tripDates, tripState, dateLabel } from "../../../../data";
import { imageSource } from "../../../../images";
import { useTrips } from "../../../../store";
import { ui } from "../../../../theme";
import { useTripParams } from "../../../../route";
export default function Home() {
  const { tripId } = useTripParams();
  const router = useRouter();
  const { trips } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) return <Page><H>여행을 찾을 수 없어요</H><Action title="여행 목록" onPress={() => router.replace("/chapters")} /></Page>;
  const state = tripState(trip);
  const past = state === "다녀온 여행";
  const count = trip.days.reduce((n, d) => n + d.items.length, 0);
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const next = trip.days.find((d) => d.date === localDate) || trip.days.find((d) => d.date > localDate && d.items.length) || trip.days.find((d) => d.date > localDate) || trip.days[0];
  const go = (screen: "itinerary" | "candidates" | "journal") => router.navigate({ pathname: `/trip/[tripId]/${screen}`, params: { tripId, ...(screen === "itinerary" && next ? { date: next.date } : {}) } });
  const plan = () => router.push({ pathname: "/trip/[tripId]/plan", params: { tripId } });
  const edit = () => router.push({ pathname: "/trip/[tripId]/edit", params: { tripId } });
  const needsPlan = !count && trip.candidates.length > 0;
  const title = past ? "여행을 기록으로 남기기" : trip.planDraft ? "만들어진 AI 제안 검토" : count ? state === "여행 중" ? "오늘의 일정 확인" : "준비한 일정 확인" : needsPlan ? "모은 장소로 일정 만들기" : "가고 싶은 장소 모으기";
  const primary = () => past ? go("journal") : trip.planDraft || needsPlan ? plan() : count ? go("itinerary") : go("candidates");
  return <Page>
    <View style={styles.identity}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.kicker}>{trip.city} · {state}</Text>
        <H>{trip.name}</H>
        <Text style={styles.meta}>{tripDates(trip)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="여행 정보 수정" onPress={edit} style={styles.edit}><Text style={styles.textLink}>정보 수정 · 대표 사진 변경</Text></Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="대표 사진 변경" onPress={edit}>
        <Image source={imageSource(trip.coverUri || cover(trip.city))} style={styles.cover} />
      </Pressable>
    </View>
    <View style={styles.stats}>
      <Pressable accessibilityRole="button" accessibilityLabel={`일정 ${count}개 열기`} onPress={() => go("itinerary")} style={styles.stat}><Text style={styles.number}>{count}</Text><Text style={styles.meta}>일정</Text></Pressable>
      <View style={styles.divider} />
      <Pressable accessibilityRole="button" accessibilityLabel={`가고 싶은 곳 ${trip.candidates.length}곳 열기`} onPress={() => go("candidates")} style={styles.stat}><Text style={styles.number}>{trip.candidates.length}</Text><Text style={styles.meta}>가고 싶은 곳</Text></Pressable>
    </View>
    <View style={styles.next}>
      <Text style={styles.kicker}>지금 할 일</Text>
      <Text style={styles.actionTitle}>{title}</Text>
      <P>{past ? "방문한 장소와 사진, 짧은 메모를 모아보세요." : trip.planDraft ? "선택한 제안만 일정에 적용해요." : count && next ? `${dateLabel(next.date)} · ${next.items.length}개의 일정` : needsPlan ? "숙소와 이동 조건을 더하면 AI가 날짜와 시간을 제안해요." : "Instagram 저장 목록을 가져오거나 장소를 직접 저장하세요."}</P>
      <Action title={past ? "기록 열기" : trip.planDraft ? "AI 제안 이어서 검토" : needsPlan ? "여행 조건 입력하고 AI로 계획" : count ? "일정 펼치기" : "가고 싶은 곳 보기"} tone="primary" onPress={primary} />
    </View>
    {!!next && !past && <View style={styles.section}>
      <View style={styles.sectionHeading}><Text style={s.title}>{dateLabel(next.date)}</Text><Pressable accessibilityRole="button" onPress={() => go("itinerary")} style={styles.edit}><Text style={styles.textLink}>전체 일정 ↗</Text></Pressable></View>
      {!next.items.length && <P>이 날짜에는 아직 일정이 없어요. AI 계획이나 장소 추가로 채울 수 있어요.</P>}
      {next.items.slice(0,3).map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.time} ${item.name} 일정 열기`} onPress={() => go("itinerary")} style={styles.scheduleRow}><Text style={styles.time}>{item.time}</Text><View style={styles.dot} /><Text style={styles.itemName} numberOfLines={2}>{item.name}</Text><Ionicons name="chevron-forward" size={16} color={ui.muted} /></Pressable>)}
    </View>}
    {!past && !needsPlan && !trip.planDraft && <Pressable accessibilityRole="button" accessibilityLabel="여행 조건 입력하고 AI로 계획" onPress={plan} style={styles.utility}>
      <Ionicons name="options-outline" size={22} color={ui.ink} /><View style={{ flex: 1 }}><Text style={styles.utilityTitle}>여행 조건 · AI 계획</Text><Text style={styles.meta}>숙소, 항공편, 식사와 이동 방식</Text></View><Ionicons name="arrow-forward" size={20} color={ui.ink} />
    </Pressable>}
    {!trip.candidates.length && <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/trip/[tripId]/instagram", params: { tripId } })} style={styles.importRow}><Ionicons name="logo-instagram" size={20} color={ui.ink} /><Text style={styles.utilityTitle}>Instagram 저장 목록에서 가져오기</Text><Ionicons name="add" size={20} color={ui.muted} /></Pressable>}
  </Page>;
}
const styles = StyleSheet.create({
  identity: { flexDirection: "row", gap: 20, paddingBottom: 20, alignItems: "flex-start" },
  kicker: { color: ui.muted, fontSize: 13, fontWeight: "600", marginBottom: 10 },
  meta: { color: ui.muted, fontSize: 14, lineHeight: 21 },
  cover: { width: 96, height: 124, borderRadius: 8, resizeMode: "cover", backgroundColor: ui.line },
  edit: { minHeight: 44, justifyContent: "center" }, textLink: { color: ui.blue, fontSize: 14, fontWeight: "600" },
  stats: { flexDirection: "row", alignItems: "center", paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: ui.line },
  stat: { flex: 1, minHeight: 44, flexDirection: "row", gap: 10, alignItems: "center" }, number: { fontSize: 24, fontWeight: "600", color: ui.ink, fontVariant: ["tabular-nums"] }, divider: { height: 24, width: 1, backgroundColor: ui.line, marginRight: 20 },
  next: { paddingVertical: 24, borderBottomWidth: 1, borderColor: ui.line }, actionTitle: { fontSize: 24, lineHeight: 32, fontWeight: "700", color: ui.ink, marginBottom: 8, letterSpacing: -0.6 },
  section: { paddingTop: 24 }, sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  scheduleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, minHeight: 56, borderBottomWidth: 1, borderColor: ui.line }, time: { width: 44, fontSize: 13, fontWeight: "600", color: ui.ink, fontVariant: ["tabular-nums"] }, dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: ui.ink }, itemName: { flex: 1, fontSize: 16, lineHeight: 23, color: ui.ink },
  utility: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, marginTop: 24, backgroundColor: ui.subtle, borderRadius: 10 }, utilityTitle: { fontSize: 15, lineHeight: 23, fontWeight: "600", color: ui.ink },
  importRow: { flexDirection: "row", gap: 10, alignItems: "center", flexWrap: "wrap", minHeight: 56, marginTop: 12 },
});
