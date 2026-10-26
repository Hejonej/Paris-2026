import { ActivityBadge } from "../../../../activityUI";
import { inferActivity } from "../../../../activities";
import { navigationUrl } from "../../../../routing";
import { matchPlace } from "../../../../matching";
import type { GoogleMatch } from "../../../../matching";
import { instagramUrl } from "../../../../instagram";
import { useTripParams } from "../../../../route";
import React, { useEffect, useState } from "react";
import { Text, View, FlatList, Pressable, Alert, Linking } from "react-native";
import { useRouter } from "expo-router";
import { Page, H, P, Label, Photo, Action, Field, s } from "../../../../ui";
import { places, dateLabel, tripPlaces } from "../../../../data";
import { useTrips } from "../../../../store";
import { ui } from "../../../../theme";
export default function Place() {
  const { tripId, placeId, date: initialDate } = useTripParams();
  const router = useRouter();
  const { trips, saveCandidate, place, confirmPlace } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const info = tripPlaces(trip).find((p) => p.id === placeId);
  const [date, setDate] = useState(initialDate || "");
  const [time, setTime] = useState("11:00");
  const [message, setMessage] = useState("");
  const [matches, setMatches] = useState<GoogleMatch[]>([]);
  const [loading, setLoading] = useState(false);
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
  const selected = trip.days.some((d) => d.date === date)
    ? date
    : trip.days[0]?.date;
  const saved = trip.candidates.includes(placeId);
  const imported = "matchStatus" in info;
  const confirmed = !imported || info.matchStatus === "confirmed";
  const sources = imported
    ? trip.inspirations?.filter((p) => info.sourcePostIds.includes(p.id)) || []
    : [];
  async function match() {
    if (loading) return;
    setLoading(true);
    setMessage("");
    setMatches([]);
    try {
      const results = await matchPlace(
        trip!.city,
        trip!.country || "",
        manualName,
      );
      setMatches(results);
      if (!results.length)
        setMessage(
          "확실한 장소를 찾지 못했어요. 이름을 고치거나 지도에서 직접 확인해 주세요.",
        );
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "장소 확인 서비스에 연결하지 못했어요.",
      );
    } finally {
      setLoading(false);
    }
  }
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
      setMatches([]);
    }
  }

  function add() {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      setMessage("시간은 09:30처럼 입력해 주세요.");
      return;
    }
    const result = place(tripId, placeId, info!.name, selected || "", time);
    setMessage(result.message);
    if (result.ok)
      Alert.alert("일정에 추가했어요", `${dateLabel(selected!)} ${time}`, [
        { text: "계속 둘러보기" },
        {
          text: "일정 보기",
          onPress: () =>
            router.dismissTo({
              pathname: "/trip/[tripId]/itinerary",
              params: { tripId, date: selected },
            }),
        },
      ]);
  }
  return (
    <Page>
      {!!info.image && <Photo uri={info.image} height={190} />}
      <Label>
        {info.category} · {info.area}
      </Label>
      <ActivityBadge value={inferActivity(info.name, info.category)} />
      <H>{info.name}</H>
      <P>{info.description}</P>
      {!!info.image && <P>사진은 분위기 참고용이에요.</P>}
      {imported && (
        <View style={{ marginBottom: 18 }}>
          <Label>{confirmed ? "위치 확인됨" : "실제 위치 확인 필요"}</Label>
          <Text style={s.title}>어떤 장소인가요?</Text>
          <P>
            게시물에서 발견한 이름이므로 정확한 위치를 확인해 주세요. 이름과
            도시만 기존 장소 확인 서비스로 보내고, 원본 캡션과 파일은 보내지
            않아요.
          </P>
          <Field
            accessibilityLabel="확인할 장소 이름"
            value={manualName}
            onChangeText={setManualName}
            maxLength={80}
          />
          <Action
            title={loading ? "장소 확인 중…" : "Google 장소 후보 확인"}
            disabled={loading || !manualName.trim()}
            onPress={match}
          />
          {matches.map((m) => (
            <View
              key={m.googlePlaceId}
              style={{
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderColor: ui.line,
              }}
            >
              <Text style={s.title}>{m.name}</Text>
              <P>{m.address}</P>
              <Action
                title="이 장소가 맞아요"
                secondary
                onPress={() => accept(m)}
              />
            </View>
          ))}
          <Label>또는 지도에서 직접 확인</Label>
          <Field
            accessibilityLabel="확인할 지도 검색어"
            value={manualQuery}
            onChangeText={setManualQuery}
            maxLength={300}
          />
          <Action
            title="입력한 위치를 지도에서 보기 ↗"
            secondary
            onPress={() =>
              Linking.openURL(
                "https://www.google.com/maps/search/?api=1&query=" +
                  encodeURIComponent(manualQuery),
              ).catch(() => setMessage("지도를 열지 못했어요."))
            }
            disabled={!manualQuery.trim()}
          />
          <Action
            title="위치를 확인했어요 · 저장한 장소에 반영"
            secondary
            disabled={!manualName.trim() || !manualQuery.trim()}
            onPress={() =>
              accept({
                name: manualName,
                query: manualQuery,
                address: manualQuery,
              })
            }
          />
        </View>
      )}
      {!!sources.length && (
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

      <Action
        title={saved ? "✓ 가고 싶은 곳에 저장됨" : "가고 싶은 곳에 저장"}
        disabled={saved}
        secondary
        onPress={() => {
          const result = saveCandidate(tripId, placeId);
          setMessage(result.message);
        }}
      />
      {saved && (
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
      {confirmed && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${info.name} 현재 위치에서 경로 찾기`}
          style={{
            minHeight: 44,
            padding: 10,
            marginVertical: 12,
            backgroundColor: "#E7EBE2",
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
      <View style={{ borderTopWidth: 1, borderColor: ui.line, paddingTop: 20 }}>
        <Text style={s.title}>일정에 배치</Text>
        <P>기존 일정과 MUST는 그대로 두고, 선택한 시간에 추가해요.</P>
        {!confirmed ? (
          <P>위에서 장소 위치를 확인한 후 일정에 추가할 수 있어요.</P>
        ) : trip.days.length ? (
          <>
            <FlatList
              data={trip.days}
              keyExtractor={(d) => d.date}
              extraData={selected}
              horizontal
              contentContainerStyle={{ gap: 8, paddingBottom: 14 }}
              renderItem={({ item: d }) => (
                <Pressable
                  key={d.date}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selected === d.date }}
                  onPress={() => {
                    setDate(d.date);
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
            <Field
              accessibilityLabel="일정 시간"
              value={time}
              onChangeText={setTime}
              placeholder="HH:MM"
              maxLength={5}
              keyboardType="numbers-and-punctuation"
            />
            <Action title="선택한 날짜에 추가" onPress={add} />
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
        {!!message && (
          <Text
            accessibilityRole="alert"
            style={{ color: ui.accent, marginTop: 12 }}
          >
            {message}
          </Text>
        )}
      </View>
    </Page>
  );
}
