import React, { useState } from "react";
import { useRouter } from "expo-router";
import {
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";
import { Page, H, P, Label, Field, Action, s } from "../../../../ui";
import { useTripParams } from "../../../../route";
import { useTrips } from "../../../../store";
import { places } from "../../../../data";
import { entryLocation, locationUrl } from "../../../../routing";
import { ui } from "../../../../theme";
export default function EntryPlace() {
  const { tripId, entryId, date } = useTripParams();
  const router = useRouter();
  const { trips, bindLocation } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const entry = trip?.days
    .find((d) => d.date === date)
    ?.items.find((e) => e.id === entryId);
  const location = entry && entryLocation(entry);
  const [label, setLabel] = useState(location?.label || "");
  const [query, setQuery] = useState(location?.query || "");
  const [description, setDescription] = useState(location?.description || "");
  const [placeId, setPlaceId] = useState(location?.placeId);
  const [error, setError] = useState("");
  if (!entry)
    return (
      <Page>
        <H>일정을 찾을 수 없어요</H>
      </Page>
    );
  function save() {
    const result = bindLocation(tripId, date, entryId, {
      label,
      query,
      description,
      placeId,
    });
    if (result.ok) router.back();
    else setError(result.message);
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Page>
        <Label>
          {entry.time} · {entry.must ? "MUST" : "내 일정"}
        </Label>
        <H>{entry.name}</H>
        <P>
          실제로 찾아갈 장소나 산책 시작 지점을 정해 주세요. 일정 이름과 시간은
          그대로 유지돼요.
        </P>
        {(trip?.city.toLowerCase().includes("paris") ||
          trip?.city.includes("파리")) && (
          <View style={{ marginBottom: 18 }}>
            <Label>등록된 장소에서 선택</Label>
            {places.map((p) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: placeId === p.id }}
                key={p.id}
                onPress={() => {
                  setLabel(p.name);
                  setQuery(p.query);
                  setDescription(p.description.slice(0, 160));
                  setPlaceId(p.id);
                }}
                style={{
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderColor: ui.line,
                }}
              >
                <Text style={s.title}>
                  {placeId === p.id ? "✓ " : ""}
                  {p.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        <Label>장소 이름</Label>
        <Field
          accessibilityLabel="장소 이름"
          value={label}
          maxLength={80}
          onChangeText={(v) => {
            setLabel(v);
            setPlaceId(undefined);
          }}
          placeholder="예: 산책을 시작할 광장"
        />
        <Label>주소 또는 Google Maps 검색어</Label>
        <Field
          accessibilityLabel="지도 검색어"
          value={query}
          maxLength={300}
          onChangeText={(v) => {
            setQuery(v);
            setPlaceId(undefined);
          }}
          placeholder="장소 이름, 도로명, 도시를 구체적으로 입력"
        />
        <P>직접 입력한 위치는 지도에서 원하는 지점이 맞는지 확인해 주세요.</P>
        <Action
          title="지도에서 위치 확인"
          secondary
          disabled={!query.trim()}
          onPress={() =>
            Linking.openURL(locationUrl({ label, query, description })).catch(
              () => setError("지도를 열지 못했어요. 다시 시도해 주세요."),
            )
          }
        />
        <View style={{ marginTop: 18 }}>
          <Label>한 줄 설명 · 선택</Label>
          <Field
            accessibilityLabel="장소 설명"
            value={description}
            onChangeText={setDescription}
            maxLength={160}
            multiline
            placeholder="이 장소에서 하고 싶은 일"
          />
        </View>
        {!!error && (
          <Text
            accessibilityRole="alert"
            style={{ color: "#A23C2B", marginBottom: 12 }}
          >
            {error}
          </Text>
        )}
        <Action title="이 일정에 장소 연결" onPress={save} />
      </Page>
    </KeyboardAvoidingView>
  );
}
