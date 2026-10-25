import { CitySearch, TripDates } from "../tripFields";
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
  const [country, setCountry] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function submit(importNow = false) {
    if (busy) return;
    const validation = validateTripDetails({ name, city, country, start, end });
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    const id = create(name.trim(), city.trim(), start, end, country);
    router.replace({
      pathname: importNow ? "/trip/[tripId]/instagram" : "/trip/[tripId]",
      params: { tripId: id },
    });
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
        {!!error && (
          <Text
            accessibilityRole="alert"
            style={{ color: "#A23C2B", marginBottom: 12 }}
          >
            {error}
          </Text>
        )}
        <Action
          title="여행 시작하기"
          disabled={busy}
          onPress={() => submit()}
        />
        <Action
          title="만들고 Instagram 가져오기"
          secondary
          disabled={busy}
          onPress={() => submit(true)}
        />
      </Page>
    </KeyboardAvoidingView>
  );
}
