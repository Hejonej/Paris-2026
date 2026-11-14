import React, { useEffect, useState } from "react";
import { Text, View, FlatList, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { Page, H, P, Label, Photo, Action, Field, s } from "../../../../ui";
import { Sheet, StatusLine } from "../../../../sheet";
import { PlaceSearch } from "../../../../placeSearch";
import { ActivityBadge } from "../../../../activityUI";
import { inferActivity } from "../../../../activities";
import { suggestedVisitTime } from "../../../../planning";
import { navigationUrl } from "../../../../routing";
import { instagramUrl } from "../../../../instagram";
import { useTripParams } from "../../../../route";
import { dateLabel, tripPlaces } from "../../../../data";
import { useTrips } from "../../../../store";
import { ui } from "../../../../theme";
export default function Place() {
  const {
    tripId,
    placeId,
    date: initialDate,
    returnTo,
    addToDay,
  } = useTripParams();
  const router = useRouter();
  const { trips, saveCandidate, place, confirmPlace } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const info = tripPlaces(trip).find((p) => p.id === placeId);
  const [timing, setTiming] = useState<"ai" | "fixed">(
    addToDay === "1" ? "fixed" : "ai",
  );
  const [date, setDate] = useState(initialDate || "");
  const [time, setTime] = useState("");
  const [timeEdited, setTimeEdited] = useState(false);
  const [message, setMessage] = useState("");
  const [addOpen, setAddOpen] = useState(addToDay === "1");
  const [addressOpen, setAddressOpen] = useState(false);
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
  if (!info || !trip)
    return (
      <Page>
        <H>장소를 찾을 수 없어요</H>
      </Page>
    );
  const saved = trip.candidates.includes(placeId);
  const imported = "matchStatus" in info;
  const confirmed = !imported || info.matchStatus === "confirmed";
  const selectedDay = trip.days.find((d) => d.date === date) || trip.days[0];
  const selected = selectedDay?.date;
  const visitTime = timeEdited ? time : suggestedVisitTime(selectedDay);
  const scheduled = trip.days.filter((d) =>
    d.items.some((e) => (e.placeId || e.location?.placeId) === placeId),
  );
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
      setAddressOpen(false);
      setShowSearch(false);
    }
  }
  const list = () =>
    router.dismissTo({
      pathname: "/trip/[tripId]/(tabs)/candidates",
      params: { tripId, returnTo, date: initialDate },
    });
  function add() {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(visitTime)) {
      setMessage("시간은 09:30처럼 입력해 주세요.");
      return;
    }
    const result = place(
      tripId,
      placeId,
      info!.name,
      selected || "",
      visitTime,
    );
    setMessage(result.message);
    if (result.ok) {
      setAddOpen(false);
      router.dismissTo({
        pathname: "/trip/[tripId]/itinerary",
        params: { tripId, date: selected, addedPlace: placeId },
      });
    }
  }
  const editor = (
    <View>
      <P>
        Google Maps에서 주소를 복사해 붙여넣어 주세요. 주소를 저장해도 일정에는
        추가하지 않아요.
      </P>
      <Action
        title="Google Maps에서 주소 확인 ↗"
        tone="secondary"
        onPress={() =>
          Linking.openURL(
            "https://www.google.com/maps/search/?api=1&query=" +
              encodeURIComponent(`${manualName}, ${trip.city}`),
          ).catch(() => setMessage("지도를 열지 못했어요."))
        }
      />
      <Label>장소 이름</Label>
      <Field
        accessibilityLabel="확인할 장소 이름"
        value={manualName}
        onChangeText={setManualName}
        maxLength={80}
      />
      <Label>주소 붙여넣기</Label>
      <Field
        accessibilityLabel="확인할 지도 검색어"
        placeholder="확인한 주소 · 도시 포함"
        value={manualQuery}
        onChangeText={setManualQuery}
        maxLength={300}
        multiline
        scrollEnabled={false}
      />
      {!!message && (
        <Text
          accessibilityRole="alert"
          style={{ color: ui.danger, marginVertical: 12 }}
        >
          {message}
        </Text>
      )}
      <Action
        title="이 주소로 가고 싶은 곳에 저장"
        tone="primary"
        disabled={!manualName.trim() || !manualQuery.trim()}
        onPress={() =>
          accept({ name: manualName, query: manualQuery, address: manualQuery })
        }
      />
      <Action
        title="다른 방법으로 주소 검색"
        tone="link"
        onPress={() => setShowSearch(!showSearch)}
      />
      {showSearch && (
        <PlaceSearch
          city={trip.city}
          country={trip.country}
          name={manualName}
          onSelect={accept}
        />
      )}
      <P>
        외부 지도에서 본 주소는 자동으로 전달되지 않아요. 같은 이름의 다른
        지점이 아닌지 확인하세요.
      </P>
    </View>
  );
  return (
    <Page>
      {!!info.image && <Photo uri={info.image} height={220} />}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <Label>{info.area || trip.city}</Label>
        <ActivityBadge value={inferActivity(info.name, info.category)} />
      </View>
      <Text
        style={{
          fontSize: 27,
          lineHeight: 35,
          fontWeight: "700",
          letterSpacing: -0.6,
          color: ui.ink,
          marginBottom: 16,
        }}
      >
        {info.name}
      </Text>
      {confirmed ? (
        <View
          style={{
            paddingBottom: 20,
            borderBottomWidth: 1,
            borderColor: ui.line,
          }}
        >
          <Label>주소</Label>
          <Text
            selectable
            style={{ fontSize: 15, lineHeight: 24, color: ui.ink }}
          >
            {info.query}
          </Text>
          <StatusLine label="주소 확인됨" verified />
          <View style={{ flexDirection: "row", gap: 20 }}>
            <Action
              title="경로 찾기 ↗"
              tone="link"
              onPress={() =>
                Linking.openURL(
                  navigationUrl({
                    label: info.name,
                    query: info.query,
                    description: info.description,
                  }),
                ).catch(() => setMessage("경로를 열지 못했어요."))
              }
            />
            {imported && (
              <Action
                title="주소 수정"
                tone="link"
                onPress={() => {
                  setMessage("");
                  setAddressOpen(true);
                }}
              />
            )}
          </View>
        </View>
      ) : (
        <View
          style={{
            paddingBottom: 20,
            borderBottomWidth: 1,
            borderColor: ui.line,
          }}
        >
          <StatusLine label="저장됨 · 주소 확인 필요" />
          <Text style={[s.title, { marginVertical: 16 }]}>
            주소를 확인해 저장하세요
          </Text>
          {editor}
        </View>
      )}
      {!!info.description && !imported && (
        <View style={{ paddingVertical: 20 }}>
          <P>{info.description}</P>
          {!!info.image && <Label>사진은 분위기 참고용이에요.</Label>}
        </View>
      )}
      <View
        style={{
          paddingVertical: 20,
          borderBottomWidth: 1,
          borderColor: ui.line,
        }}
      >
        <Text style={s.title}>여행에 모아두기</Text>
        <StatusLine
          label={saved ? "가고 싶은 곳에 저장됨" : "아직 저장하지 않은 장소"}
          verified={saved}
        />
        {!saved && (
          <Action
            title="가고 싶은 곳에 저장"
            tone="primary"
            onPress={() => {
              const r = saveCandidate(tripId, placeId);
              setMessage(r.message);
              if (r.ok) setJustSaved(true);
            }}
          />
        )}
        {justSaved && (
          <Action title="가고 싶은 곳 보기 →" tone="link" onPress={list} />
        )}
        <Text
          style={{
            fontSize: 13,
            lineHeight: 20,
            color: ui.muted,
            marginTop: 8,
          }}
        >
          저장은 여행 목록에 보관하는 동작이에요. 방문 날짜는 아직 정하지 않아도
          돼요.
        </Text>
      </View>
      {confirmed && (
        <View style={{ paddingVertical: 20 }}>
          <Text style={s.title}>일정에 배치하기</Text>
          <P>
            {scheduled.length
              ? `배치된 날짜 · ${scheduled.map((d) => dateLabel(d.date)).join(", ")}`
              : "일정 미배치 · 날짜와 시간이 미정이면 AI가 정해요."}
          </P>
          <Action
            title="일정에 추가"
            tone={saved ? "primary" : "secondary"}
            onPress={() => {
              setMessage("");
              setAddOpen(true);
            }}
          />
        </View>
      )}
      {!!sources.length && (
        <View
          style={{ paddingTop: 20, borderTopWidth: 1, borderColor: ui.line }}
        >
          <Label>발견한 출처 · Instagram {sources.length}개</Label>
          {sources.map((post) => (
            <Pressable
              key={post.id}
              accessibilityRole="link"
              onPress={() => {
                const url = instagramUrl(post.url);
                if (url)
                  Linking.openURL(url).catch(() =>
                    setMessage("원본 링크를 열지 못했어요."),
                  );
              }}
              style={{ minHeight: 48, paddingVertical: 12 }}
            >
              <Text style={{ fontSize: 14, lineHeight: 22, color: ui.blue }}>
                {post.name} ↗
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {!!message && !addOpen && !addressOpen && confirmed && (
        <Text
          accessibilityRole="alert"
          style={{ color: ui.muted, marginTop: 12 }}
        >
          {message}
        </Text>
      )}
      <Sheet
        visible={addressOpen && confirmed}
        title="주소 수정"
        onClose={() => setAddressOpen(false)}
      >
        {editor}
      </Sheet>
      <Sheet
        visible={addOpen && confirmed}
        title="언제 방문할까요?"
        onClose={() => setAddOpen(false)}
      >
        <P>저장한 장소는 그대로 두고, 방문 시점만 선택해요.</P>
        {(
          [
            {
              id: "ai",
              label: "아직 미정 · AI가 배치",
              description: "방문 날짜와 시간은 AI가 자동으로 정해요",
            },
            {
              id: "fixed",
              label: "날짜와 시간이 정해졌어요",
              description: "예약한 시간에 직접 추가해요",
            },
          ] as const
        ).map((option) => (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: timing === option.id }}
            onPress={() => {
              setTiming(option.id);
              setMessage("");
            }}
            style={{
              minHeight: 76,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderColor: ui.line,
              flexDirection: "row",
              gap: 12,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 19,
                color: timing === option.id ? ui.blue : ui.muted,
              }}
            >
              {timing === option.id ? "●" : "○"}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: ui.ink }}>
                {option.label}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  lineHeight: 20,
                  color: ui.muted,
                  marginTop: 4,
                }}
              >
                {option.description}
              </Text>
            </View>
          </Pressable>
        ))}
        {timing === "ai" ? (
          <View style={{ marginTop: 20 }}>
            <P>
              주소가 확인된 가고 싶은 곳을 모아 AI 계획에서 제안받아요. 지금은
              일정에 추가하지 않아요.
            </P>
            <Action
              title="여행 조건 입력 · AI 일정 짜기 →"
              tone="primary"
              onPress={() => {
                if (!saved) {
                  const r = saveCandidate(tripId, placeId);
                  if (!r.ok) {
                    setMessage(r.message);
                    return;
                  }
                }
                setAddOpen(false);
                router.push({
                  pathname: "/trip/[tripId]/plan",
                  params: { tripId },
                });
              }}
            />
            <Action
              title="가고 싶은 곳으로 돌아가기"
              tone="link"
              onPress={() => {
                setAddOpen(false);
                list();
              }}
            />
          </View>
        ) : trip.days.length ? (
          <View style={{ marginTop: 20 }}>
            <FlatList
              data={trip.days}
              keyExtractor={(d) => d.date}
              horizontal
              style={{ flexGrow: 0, flexShrink: 0 }}
              contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
              renderItem={({ item: d }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={dateLabel(d.date)}
                  accessibilityState={{ selected: selected === d.date }}
                  onPress={() => {
                    setDate(d.date);
                    setMessage("");
                  }}
                  style={[
                    s.chip,
                    {
                      backgroundColor: selected === d.date ? ui.ink : ui.subtle,
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
              onChangeText={(v) => {
                setTime(v);
                setTimeEdited(true);
                setMessage("");
              }}
              placeholder="HH:MM"
              maxLength={5}
              keyboardType="numbers-and-punctuation"
            />
            <P>
              {selected ? dateLabel(selected) : "날짜 미정"} ·{" "}
              {visitTime || "방문 시간을 입력하세요"}
            </P>
            {!!message && (
              <Text
                accessibilityRole="alert"
                style={{
                  color: ui.danger,
                  backgroundColor: ui.dangerSoft,
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                {message}
              </Text>
            )}
            <Action
              title="이 날짜와 시간에 일정 추가"
              tone="primary"
              onPress={add}
            />
          </View>
        ) : (
          <View style={{ marginTop: 20 }}>
            <P>먼저 여행 날짜를 정해 주세요.</P>
            <Action
              title="여행 날짜 정하기"
              onPress={() => {
                setAddOpen(false);
                router.push({
                  pathname: "/trip/[tripId]/edit",
                  params: { tripId },
                });
              }}
            />
          </View>
        )}
      </Sheet>
    </Page>
  );
}
