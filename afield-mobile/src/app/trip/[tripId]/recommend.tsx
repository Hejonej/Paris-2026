import React, { useState } from "react";
import { Text, Pressable, Image, View, Linking } from "react-native";
import { useRouter } from "expo-router";
import { Page, H, P, Label, Field, Action, s } from "../../../ui";
import { places, tripPlaces, dateLabel } from "../../../data";
import { imageSource } from "../../../images";
import { useTrips } from "../../../store";
import { useTripParams } from "../../../route";
import { ui } from "../../../theme";
export default function Recommend() {
  const { tripId, date } = useTripParams();
  const router = useRouter();
  const store = useTrips();
  const trip = store.trips.find((t) => t.id === tripId);
  const [tab, setTab] = useState("saved");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [category, setCategory] = useState("관광");
  const [error, setError] = useState("");
  const saved = tripPlaces(trip).filter((p) => trip?.candidates.includes(p.id));
  const paris = !!trip && /paris|파리/i.test(trip.city);
  const open = (placeId: string) =>
    router.push({
      pathname: "/trip/[tripId]/place/[placeId]",
      params: { tripId, placeId, ...(date ? { date, addToDay: "1" } : {}) },
    });
  const row = (p: (typeof places)[number]) => (
    <Pressable
      key={p.id}
      accessibilityRole="button"
      accessibilityLabel={`${p.name} 선택`}
      onPress={() => open(p.id)}
      style={{
        flexDirection: "row",
        gap: 14,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderColor: ui.line,
        minHeight: 64,
      }}
    >
      {!!p.image && (
        <Image
          source={imageSource(p.image)}
          style={{ width: 64, height: 76, borderRadius: 8 }}
        />
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.title}>{p.name}</Text>
        <Text style={{ fontSize: 13, color: ui.muted, marginTop: 6 }}>
          {p.category} ·{" "}
          {"matchStatus" in p && p.matchStatus !== "confirmed"
            ? "주소 확인 필요"
            : "장소 열고 시간 확인"}
        </Text>
      </View>
      <Text style={{ fontSize: 22, color: ui.muted, alignSelf: "center" }}>
        ›
      </Text>
    </Pressable>
  );
  return (
    <Page>
      <Label>
        {trip?.city || "여행"} · {date ? dateLabel(date) : "장소 모으기"}
      </Label>
      <H>{date ? "이 날짜에 추가할 장소" : "장소 찾아 추가하기"}</H>
      <P>
        저장한 곳을 고르거나 직접 장소를 추가하세요. 마지막 확인 전에는 일정이
        바뀌지 않아요.
      </P>
      <View
        style={{
          flexDirection: "row",
          borderBottomWidth: 1,
          borderColor: ui.line,
          marginBottom: 16,
        }}
      >
        {[
          { id: "saved", label: `저장한 장소 ${saved.length}` },
          { id: "manual", label: "직접 추가" },
          ...(paris ? [{ id: "example", label: "Paris 예시" }] : []),
        ].map((t) => (
          <Pressable
            key={t.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.id }}
            onPress={() => setTab(t.id)}
            style={{
              flex: 1,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              borderBottomWidth: 2,
              borderColor: tab === t.id ? ui.ink : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 14,
                color: ui.ink,
                fontWeight: tab === t.id ? "700" : "400",
              }}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {tab === "saved" && (
        <>
          {saved.map(row)}
          {!saved.length && (
            <>
              <Text style={s.title}>저장한 장소가 없어요</Text>
              <P>
                아래에서 장소를 직접 추가하거나 Instagram 게시물에서 골라
                주세요.
              </P>
            </>
          )}
          <Action
            title="장소 직접 추가하기"
            tone="secondary"
            onPress={() => setTab("manual")}
          />
          <Action
            title="게시물에서 장소 고르기"
            tone="link"
            onPress={() =>
              router.navigate({
                pathname: "/trip/[tripId]/candidates",
                params: {
                  tripId,
                  section: "inspiration",
                  returnTo: "itinerary",
                  date,
                },
              })
            }
          />
        </>
      )}
      {tab === "manual" && (
        <>
          <Label>장소 이름</Label>
          <Field
            accessibilityLabel="추가할 장소 이름"
            value={name}
            onChangeText={setName}
            maxLength={80}
            placeholder="호텔·가게·방문할 곳 이름"
          />
          <Action
            title="Google Maps에서 주소 확인 ↗"
            tone="link"
            disabled={!name.trim()}
            onPress={() =>
              Linking.openURL(
                "https://www.google.com/maps/search/?api=1&query=" +
                  encodeURIComponent(`${name}, ${trip?.city || ""}`),
              ).catch(() => setError("지도를 열지 못했어요."))
            }
          />
          <Label>지도에서 확인한 주소</Label>
          <Field
            accessibilityLabel="추가할 장소 주소"
            value={address}
            onChangeText={setAddress}
            maxLength={300}
            placeholder="확인한 주소 붙여넣기"
            multiline
          />
          <Label>분류</Label>
          <Field
            accessibilityLabel="추가할 장소 분류"
            value={category}
            onChangeText={setCategory}
            maxLength={40}
            placeholder="쇼핑·관광·식사·카페/디저트"
          />
          <P>
            지점과 도시가 맞는지 직접 확인한 주소를 저장해요. Google Maps 주소
            자동 가져오기는 아직 제공하지 않아요.
          </P>
          {!!error && (
            <Text
              accessibilityRole="alert"
              style={{ color: ui.danger, marginBottom: 12 }}
            >
              {error}
            </Text>
          )}
          <Action
            title="확인한 주소로 저장하고 계속"
            tone="primary"
            disabled={!name.trim() || !address.trim()}
            onPress={() => {
              const r = store.addManualPlace(tripId, name, address, category);
              if (!r.ok) setError(r.message);
              else if (r.placeIds?.[0]) open(r.placeIds[0]);
            }}
          />
        </>
      )}
      {tab === "example" && (
        <>
          <P>
            실시간 AI 추천이 아닌 Paris 예시 목록이에요. 다른 도시의 여행에는
            섞지 않아요.
          </P>
          {places.map(row)}
          <Label>사진은 분위기 참고용이에요.</Label>
        </>
      )}
    </Page>
  );
}
