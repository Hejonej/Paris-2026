import { CitySearch, TripDates } from "../../../tripFields";
import React, { useRef, useState } from "react";
import { useRouter } from "expo-router";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Page, H, P, Label, Field, Action } from "../../../ui";
import { useTripParams } from "../../../route";
import { useTrips } from "../../../store";
import { editTrip } from "../../../tripEditing";
import { ui } from "../../../theme";
export default function EditTrip() {
  const { tripId } = useTripParams();
  const router = useRouter();
  const { trips, edit } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const [name, setName] = useState(trip?.name || "");
  const [city, setCity] = useState(trip?.city || "");
  const [country, setCountry] = useState(trip?.country || "");
  const [start, setStart] = useState(trip?.start || "");
  const [end, setEnd] = useState(trip?.end || "");
  const [error, setError] = useState("");
  const submitting = useRef(false);
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
  const details = { name, city, country, start, end };
  const changed =
    name !== trip.name ||
    city !== trip.city ||
    country !== (trip.country || "") ||
    start !== trip.start ||
    end !== trip.end;
  const preview = editTrip(trips, tripId, details);
  function save() {
    if (submitting.current) return;
    const result = edit(tripId, details);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    submitting.current = true;
    router.back();
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Page>
        <H>여행 정보 수정</H>
        <P>날짜가 정해졌거나 여행 계획이 바뀌었나요?</P>
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
        <Action title="변경사항 저장" disabled={!changed} onPress={save} />
      </Page>
    </KeyboardAvoidingView>
  );
}
