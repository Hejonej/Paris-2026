import React, { useEffect, useRef, useState } from "react";
import { View, Text, Linking } from "react-native";
import { Action, Field, P, s } from "./ui";
import { matchPlace } from "./matching";
import type { GoogleMatch } from "./matching";

// Search explicitly, never send captions or follow an external Maps page as if it returned a selection.
export function PlaceSearch({ city, country = "", name, onSelect }: {
  city: string; country?: string; name: string; onSelect: (place: GoogleMatch) => void;
}) {
  const [query, setQuery] = useState(name);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<GoogleMatch[]>([]);
  const [message, setMessage] = useState("");
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  async function search() {
    const token = ++request.current;
    setBusy(true); setMessage(""); setResults([]);
    try {
      const rows = await matchPlace(city, country, query.trim());
      if (token !== request.current) return;
      setResults(rows);
      if (!rows.length) setMessage("검색 결과가 없어요. 이름이나 지점을 바꿔 검색하거나 아래에서 주소를 직접 입력해 주세요.");
    } catch (e) {
      if (token === request.current) setMessage(e instanceof Error ? e.message : "장소를 검색하지 못했어요.");
    } finally { if (token === request.current) setBusy(false); }
  }
  return <View style={{ marginBottom: 12 }}>
    <Field accessibilityLabel="장소 검색어" placeholder="호텔·장소 이름으로 검색" value={query}
      onChangeText={(v) => { request.current++; setBusy(false); setQuery(v); setResults([]); setMessage(""); }}
      maxLength={120} returnKeyType="search" onSubmitEditing={() => { if (query.trim() && !busy) void search(); }} />
    <Action title={busy ? "주소 찾는 중…" : "이름으로 주소 검색"} disabled={busy || !query.trim()} onPress={search} />
    <P>이름과 여행 도시만 검색 서비스에 보내요. 결과를 선택하면 이름과 주소가 자동으로 채워져요.</P>
    {results.map((r) => <View key={r.googlePlaceId} style={{ paddingVertical: 10 }}>
      <Text style={s.title}>{r.name}</Text><P>{r.address}</P>
      <Action title="이 장소 선택 · 주소 가져오기" onPress={() => { onSelect(r); setResults([]); setMessage("선택한 장소의 주소를 가져왔어요."); }} />
    </View>)}
    {!!message && <Text accessibilityRole="alert" style={s.p}>{message}</Text>}
    <Action title="직접 확인: Google Maps 열기 ↗" secondary onPress={() => {
      Linking.openURL("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(`${query || name}, ${city}`))
        .catch(() => setMessage("지도를 열지 못했어요."));
    }} />
    <P>외부 지도에서 본 장소는 자동으로 전달되지 않아요. 검색이 안 되면 Google Maps의 주소를 복사해 아래 주소 칸에 붙여넣어 주세요.</P>
  </View>;
}
