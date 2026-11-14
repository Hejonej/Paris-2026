import { suggestedVisitTime } from "../../../../planning";
import { PlaceSearch } from "../../../../placeSearch";
import { ActivityBadge } from "../../../../activityUI";
import { inferActivity } from "../../../../activities";
import { navigationUrl } from "../../../../routing";
import { instagramUrl } from "../../../../instagram";
import { useTripParams } from "../../../../route";
import React, { useEffect, useState } from "react";
import { Text, View, FlatList, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { Page, H, P, Label, Photo, Action, Field, s } from "../../../../ui";
import { dateLabel, tripPlaces } from "../../../../data";
import { useTrips } from "../../../../store";
import { ui } from "../../../../theme";
export default function Place() {
  const { tripId, placeId, date: initialDate } = useTripParams();
  const router = useRouter();
  const { trips, saveCandidate, place, confirmPlace } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const info = tripPlaces(trip).find((p) => p.id === placeId);
  const [timing, setTiming] = useState<"ai" | "fixed">("ai");
  const [date, setDate] = useState(initialDate || "");
  const [time, setTime] = useState("");
  const [timeEdited, setTimeEdited] = useState(false);
  const [message, setMessage] = useState("");
  const [editingLocation, setEditingLocation] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [manualName, setManualName] = useState(info?.name || "");
  const [manualQuery, setManualQuery] = useState(info?.query || "");
  useEffect(() => {
    if (info) {
      setManualName(info.name);
      setManualQuery(info.query);
    }
  }, [info?.id]);
  const selectedDay = trip?.days.find((d) => d.date === date) || trip?.days[0];
  const visitTime = timeEdited ? time : suggestedVisitTime(selectedDay);
  if (!info || !trip)
    return (
      <Page>
        <H>장소를 찾을 수 없어요</H>
      </Page>
    );
  const selected = trip.days.some((d) => d.date === date)
    ? date
    : trip.days[0]?.date;
  const saved = trip.candidates.includes(placeId);
  const imported = "matchStatus" in info;
  const confirmed = !imported || info.matchStatus === "confirmed";
  const sources = imported
    ? trip.inspirations?.filter((p) => info.sourcePostIds.includes(p.id)) || []
    : [];
  function accept(details: {
    name: string;
    query: string;
    address: string;
    googlePlaceId?: string;
  }) {
    const result = confirmPlace(tripId, placeId, details);
    setMessage(result.message);
    if (result.ok) {
      setManualName(details.name);
      setManualQuery(details.query);
      setEditingLocation(false);
    }
  }

  function add() {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(visitTime)) {
      setMessage("시간은 09:30처럼 입력해 주세요.");
      return;
    }
    const result = place(tripId, placeId, info!.name, selected || "", visitTime);
    setMessage(result.message);
    if (result.ok)
      router.dismissTo({
        pathname: "/trip/[tripId]/itinerary",
        params: { tripId, date: selected, addedPlace: placeId },
      });
  }
  return (
    <Page>
      {!!info.image && <Photo uri={info.image} height={190} />}
      <Label>
        {info.category} · {info.area}
      </Label>
      <ActivityBadge value={inferActivity(info.name, info.category)} />
      <H>{info.name}</H>
      {!imported && <P>{info.description}</P>}
      {!!info.image && <P>사진은 분위기 참고용이에요.</P>}
      {imported &&
        (confirmed && !editingLocation ? (
          <View
            style={{
              padding: 14,
              backgroundColor: ui.successSoft,
              borderRadius: 12,
              marginBottom: 16,
            }}
          >
            <Text style={s.title}>가고 싶은 곳에 보관 중</Text>
            <P>{info.query}</P>
            <Action
              title="주소 수정"
              tone="link"
              onPress={() => setEditingLocation(true)}
            />
          </View>
        ) : (
          <View style={{ marginBottom: 18 }}>
            <Text style={s.title}>주소를 확인해 저장하세요</Text>
            <P>Google Maps에서 주소를 복사한 뒤 아래에 붙여넣어 주세요. 방문 날짜는 나중에 AI가 제안해요.</P>
            <Action title="Google Maps에서 주소 확인 ↗" tone="secondary" onPress={() => Linking.openURL("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(`${manualName}, ${trip.city}`)).catch(() => setMessage("지도를 열지 못했어요."))} />
            <P>지도를 확인한 뒤 Afield로 돌아와 주세요. 주소 자동 가져오기는 준비 중이에요.</P>
            <Label>장소 이름</Label>
            <Field accessibilityLabel="확인할 장소 이름" value={manualName}
              onChangeText={setManualName} maxLength={80} />
            <Label>주소 붙여넣기</Label>
            <Field
              accessibilityLabel="확인할 지도 검색어"
              placeholder="예: 장소 이름, 도로명 주소, 도시"
              value={manualQuery}
              multiline
              scrollEnabled={false}
              onChangeText={setManualQuery}
              maxLength={300}
            />
            {!!message && <Text accessibilityRole="alert" style={{ color: ui.danger, marginBottom: 12 }}>{message}</Text>}
            <P>같은 이름의 다른 지점이 아닌지 확인해 주세요.</P>
            <Action
              title="이 주소로 가고 싶은 곳에 저장"
              tone="primary"
              disabled={!manualName.trim() || !manualQuery.trim()}
              onPress={() =>
                accept({
                  name: manualName,
                  query: manualQuery,
                  address: manualQuery,
                })
              }
            />
            <Action title="다른 방법으로 주소 검색" tone="link" onPress={() => setShowSearch(!showSearch)} />
            {showSearch && <PlaceSearch city={trip.city} country={trip.country} name={manualName} onSelect={accept} />}
            {confirmed && (
              <Action
                title="주소 수정 취소"
                secondary
                onPress={() => {
                  setManualName(info.name);
                  setManualQuery(info.query);
                  setEditingLocation(false);
                  setMessage("");
                }}
              />
            )}
          </View>
        ))}
      {!saved && (
        <Action
          title="가고 싶은 곳에 저장"
          disabled={saved}
          secondary
          onPress={() => {
            const result = saveCandidate(tripId, placeId);
            setMessage(result.message);
            if (result.ok) setJustSaved(true);
          }}
        />
      )}
      {justSaved && (
        <Action
          title="가고 싶은 곳 보기 →"
          secondary
          onPress={() =>
            router.dismissTo({
              pathname: "/trip/[tripId]/(tabs)/candidates",
              params: { tripId },
            })
          }
        />
      )}
      {confirmed && !editingLocation && (
        <View
          style={{ borderTopWidth: 1, borderColor: ui.line, paddingTop: 20 }}
        >
          <Text style={s.title}>언제 방문할까요?</Text>
          <View style={{ flexDirection: "row", marginVertical: 12, gap: 8 }}>
            {([{ id: "ai", label: "아직 미정 · AI가 배치" }, { id: "fixed", label: "날짜와 시간이 정해졌어요" }] as const).map((option) => <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected: timing === option.id }} onPress={() => { setTiming(option.id); setMessage(""); }} style={{ flex: 1, padding: 12, minHeight: 56, borderWidth: 1, borderColor: timing === option.id ? ui.blue : ui.line, borderRadius: 12, backgroundColor: timing === option.id ? ui.blueSoft : ui.surface }}><Text style={{ color: timing === option.id ? ui.blue : ui.ink, fontSize: 16, fontWeight: "600" }}>{option.label}</Text></Pressable>)}
          </View>
          {timing === "ai" && <View style={{ backgroundColor: ui.blueSoft, padding: 16, borderRadius: 14, marginBottom: 16 }}>
            <P>지금은 장소만 모아두세요. 여행 조건을 입력하면 AI가 모은 장소의 날짜와 시간을 제안해요.</P>
            <Action title="가고 싶은 곳으로 돌아가기" tone="primary" onPress={() => router.dismissTo({ pathname: "/trip/[tripId]/(tabs)/candidates", params: { tripId } })} />
            <Action title="여행 조건 입력 · AI 일정 짜기 →" tone="link" onPress={() => router.push({ pathname: "/trip/[tripId]/plan", params: { tripId } })} />
          </View>}
          {timing === "fixed" && <>
          {!confirmed ? (
            <P>위에서 장소 위치를 확인한 후 일정에 추가할 수 있어요.</P>
          ) : trip.days.length ? (
            <>
              <FlatList
                data={trip.days}
                keyExtractor={(d) => d.date}
                extraData={selected}
                horizontal
                style={{ flexGrow: 0, flexShrink: 0, marginTop: 12 }}
                contentContainerStyle={{ gap: 8, paddingBottom: 14 }}
                renderItem={({ item: d }) => (
                  <Pressable
                    key={d.date}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selected === d.date }}
                    onPress={() => {
                      setDate(d.date);
                      if (!timeEdited) setTime("");
                      setMessage("");
                    }}
                    style={[
                      s.chip,
                      {
                        backgroundColor:
                          selected === d.date ? ui.accent : ui.line,
                      },
                    ]}
                  >
                    <Text
                      style={{ color: selected === d.date ? "white" : ui.ink }}
                    >
                      {dateLabel(d.date)}
                    </Text>
                  </Pressable>
                )}
              />
              <Label>방문 시간 · 24시간 기준</Label>
              <Field
                accessibilityLabel="일정 시간"
                value={visitTime}
                onChangeText={(v) => { setTime(v); setTimeEdited(true); setMessage(""); }}
                placeholder="HH:MM"
                maxLength={5}
                keyboardType="numbers-and-punctuation"
              />
              <P>{selected ? dateLabel(selected) : "날짜 미정"} · {visitTime || "방문 시간을 입력하세요"}</P>
              {!!message && <Text accessibilityRole="alert" style={{ color: ui.danger, backgroundColor: ui.dangerSoft, padding: 12, marginBottom: 12 }}>{message}</Text>}
              <Action title="이 날짜와 시간에 일정 추가" tone="primary" onPress={add} />
            </>
          ) : (
            <>
              <P>여행 날짜를 정하면 이 장소를 일정에 배치할 수 있어요.</P>
              <Action
                title="여행 날짜 정하기"
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/trip/[tripId]/edit",
                    params: { tripId },
                  })
                }
              />
            </>
          )}
          </>}
        </View>
      )}
      {confirmed && !editingLocation && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${info.name} 현재 위치에서 경로 찾기`}
          style={{
            minHeight: 44,
            padding: 10,
            marginVertical: 12,
            backgroundColor: ui.surface,
            borderWidth: 1,
            borderColor: ui.line,
            borderRadius: 16,
          }}
          onPress={() =>
            Linking.openURL(
              navigationUrl({
                label: info.name,
                query: info.query,
                description: info.description,
              }),
            ).catch(() =>
              setMessage("경로를 열지 못했어요. 다시 시도해 주세요."),
            )
          }
        >
          <Text style={{ color: ui.accent, fontWeight: "600" }}>
            경로 찾기 ↗
          </Text>
          <Text style={{ fontSize: 13, color: ui.muted, marginTop: 5 }}>
            현재 위치에서 {info.name}까지
          </Text>
        </Pressable>
      )}
      {!!sources.length && confirmed && !editingLocation && (
        <View style={{ marginBottom: 18 }}>
          <Label>이 장소를 발견한 원본</Label>
          {sources.map((post) => (
            <Pressable
              key={post.id}
              accessibilityRole="link"
              style={{ minHeight: 44, justifyContent: "center" }}
              onPress={() => {
                const url = instagramUrl(post.url);
                if (url)
                  Linking.openURL(url).catch(() =>
                    setMessage("원본 링크를 열지 못했어요."),
                  );
              }}
            >
              <Text style={{ fontSize: 15, color: ui.accent }}>
                {post.name} · Instagram ↗
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {!!message && confirmed && !editingLocation && timing !== "fixed" && (
        <Text
          accessibilityRole="alert"
          style={{ color: ui.accent, marginTop: 12 }}
        >
          {message}
        </Text>
      )}
    </Page>
  );
}
