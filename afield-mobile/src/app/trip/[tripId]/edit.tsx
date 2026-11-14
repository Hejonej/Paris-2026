import { chooseTripPhoto } from "../../../tripPhoto";
import { cover } from "../../../data";
import { CitySearch, TripDates } from "../../../tripFields";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { Page, H, P, Label, Field, Action, Photo } from "../../../ui";
import { useTripParams } from "../../../route";
import { useTrips } from "../../../store";
import { editTrip } from "../../../tripEditing";
import { ui } from "../../../theme";
export default function EditTrip() {
  const { tripId } = useTripParams();
  const router = useRouter();
  const { trips, edit, ready } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const [name, setName] = useState(trip?.name || "");
  const [city, setCity] = useState(trip?.city || "");
  const [country, setCountry] = useState(trip?.country || "");
  const [start, setStart] = useState(trip?.start || "");
  const [end, setEnd] = useState(trip?.end || "");
  const [coverUri, setCoverUri] = useState(trip?.coverUri || "");
  const [picking, setPicking] = useState(false);
  const pickingRef = useRef(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const initialized = useRef(false);
  useEffect(() => {
    if (!ready || !trip || initialized.current) return;
    initialized.current = true;
    setName(trip.name); setCity(trip.city); setCountry(trip.country || "");
    setStart(trip.start); setEnd(trip.end); setCoverUri(trip.coverUri || "");
  }, [ready, trip]);
  if (!trip)
    return (
      <Page>
        <H>여행을 찾을 수 없어요</H>
        <Action
          title="여행 목록"
          onPress={() => router.dismissTo("/chapters")}
        />
      </Page>
    );
  const details = { name, city, country, start, end, coverUri };
  const changed =
    coverUri !== (trip.coverUri || "") ||
    name !== trip.name ||
    city !== trip.city ||
    country !== (trip.country || "") ||
    start !== trip.start ||
    end !== trip.end;
  const preview = editTrip(trips, tripId, details);
  function save() {
    if (submitting.current || pickingRef.current) return;
    const result = edit(tripId, details);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    submitting.current = true;
    router.back();
  }
  return (
      <Page>
        <H>챕터 수정</H>
        <P>날짜가 정해졌거나 여행 계획이 바뀌었나요?</P>
        <Label>대표 사진</Label>
        <Photo uri={coverUri || cover(city)} height={180} />
        <Action title={picking ? "사진 불러오는 중…" : "사진 보관함에서 선택"} tone="secondary" disabled={picking} onPress={async () => {
          if (pickingRef.current) return;
          pickingRef.current = true; setPicking(true); setError("");
          try { const uri = await chooseTripPhoto(); if (uri) setCoverUri(uri); }
          catch (e) { setError(e instanceof Error ? e.message : "사진을 가져오지 못했어요. 사진 접근 설정을 확인하거나 다른 사진을 선택해 주세요."); }
          finally { pickingRef.current = false; setPicking(false); }
        }} />
        {!!coverUri && <Action title="기본 사진으로 되돌리기" tone="link" disabled={picking} onPress={() => setCoverUri("")} />}
        <P>여행 목록과 여행 홈에 표시해요. 변경사항을 저장하면 적용돼요.</P>
        <Label>여행 이름</Label>
        <Field
          accessibilityLabel="여행 이름"
          value={name}
          onChangeText={setName}
          maxLength={60}
        />
        <CitySearch
          value={city}
          country={country}
          onChange={(city, country) => {
            setCity(city);
            setCountry(country);
          }}
        />
        <Label>여행 날짜 · 선택</Label>
        <TripDates start={start} end={end} onStart={setStart} onEnd={setEnd} />
        <View
          style={{
            backgroundColor: "#E7EBE2",
            borderRadius: 14,
            padding: 16,
            marginBottom: 14,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: ui.ink }}>
            기존 일정은 같은 날짜에 남아요
          </Text>
          <Text
            style={{
              fontSize: 14,
              lineHeight: 22,
              color: ui.accent,
              marginTop: 6,
            }}
          >
            일정이 있는 날짜를 여행 기간에서 빼면 저장하지 않아요. 후보와 MUST도
            그대로 유지돼요.
          </Text>
          {changed && (
            <Text
              accessibilityLiveRegion="polite"
              style={{
                fontSize: 14,
                lineHeight: 22,
                color: ui.ink,
                marginTop: 10,
              }}
            >
              {preview.ok
                ? `${start ? `${preview.trips.find((t) => t.id === tripId)!.days.length}일의 여행` : "날짜 미정"} · 기존 일정 ${trip.days.reduce((n, d) => n + d.items.length, 0)}개 유지`
                : preview.message}
            </Text>
          )}
        </View>
        {!!error && (
          <Text
            accessibilityRole="alert"
            style={{ color: "#A23C2B", marginBottom: 12 }}
          >
            {error}
          </Text>
        )}
        <Action title="변경사항 저장" disabled={!changed || picking} onPress={save} />
      </Page>
  );
}
