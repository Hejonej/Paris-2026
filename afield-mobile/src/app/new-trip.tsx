import React, { useState } from "react";
import { useRouter } from "expo-router";
import { KeyboardAvoidingView, Platform, Text } from "react-native";
import { Page, H, P, Label, Field, Action } from "../ui";
import { validateTripDetails } from "../tripEditing";
import { useTrips } from "../store";
export default function NewTrip() {
  const router = useRouter();
  const { create } = useTrips();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function submit() {
    if (busy) return;
    const validation = validateTripDetails({ name, city, start, end });
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    const id = create(name.trim(), city.trim(), start, end);
    router.replace({ pathname: "/trip/[tripId]", params: { tripId: id } });
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Page>
        <Label>A NEW CHAPTER</Label>
        <H>어디로 떠날까요?</H>
        <P>날짜는 비워 두어도 좋아요. 이 기기에 여행이 저장돼요.</P>
        <Field
          accessibilityLabel="여행 이름"
          placeholder="여행 이름 · 가을의 파리"
          value={name}
          onChangeText={setName}
          maxLength={60}
        />
        <Field
          accessibilityLabel="도시"
          placeholder="도시 · Paris"
          value={city}
          onChangeText={setCity}
          maxLength={60}
        />
        <Label>여행 날짜 · 선택</Label>
        <Field
          accessibilityLabel="시작일"
          placeholder="시작일 YYYY-MM-DD"
          value={start}
          onChangeText={setStart}
          maxLength={10}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />
        <Field
          accessibilityLabel="종료일"
          placeholder="종료일 YYYY-MM-DD"
          value={end}
          onChangeText={setEnd}
          maxLength={10}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />
        {!!error && (
          <Text
            accessibilityRole="alert"
            style={{ color: "#A23C2B", marginBottom: 12 }}
          >
            {error}
          </Text>
        )}
        <Action title="여행 시작하기" disabled={busy} onPress={submit} />
      </Page>
    </KeyboardAvoidingView>
  );
}
