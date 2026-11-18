import React, { useEffect, useRef, useState } from "react";
import { View, Text, Linking, Pressable, Keyboard } from "react-native";
import { ui } from "./theme";
import {
  SearchDropdown,
  searchStyles,
  useSearchVisibility,
} from "./searchDropdown";
import { Action, Field, P, s } from "./ui";
import { searchPlaceAddress } from "./liveRoutes";
import { matchPlace } from "./matching";
import type { GoogleMatch } from "./matching";

// Search explicitly, never send captions or follow an external Maps page as if it returned a selection.
export function PlaceSearch({
  city,
  country = "",
  name,
  onNameChange,
  onSelect,
}: {
  city: string;
  country?: string;
  name: string;
  onNameChange?: (name: string) => void;
  onSelect: (place: GoogleMatch) => void;
}) {
  const [query, setQuery] = useState(name);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<GoogleMatch[]>([]);
  const [message, setMessage] = useState("");
  const request = useRef(0);
  const anchor = useRef<View>(null);
  const reveal = useSearchVisibility();
  useEffect(() => {
    if (results.length) reveal(anchor, Math.min(results.length * 88, 200) + 36);
    else reveal(anchor, 0);
    return () => reveal(anchor, 0);
  }, [results]);
  useEffect(() => {
    setQuery(name);
    setResults([]);
    setMessage("");
    request.current++;
    setBusy(false);
  }, [name]);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  async function search() {
    const token = ++request.current;
    setBusy(true);
    setMessage("");
    setResults([]);
    try {
      let rows: GoogleMatch[];
      try {
        rows = await matchPlace(city, country, query.trim());
      } catch (original) {
        try {
          rows = await searchPlaceAddress(city, country, query.trim());
        } catch (local) {
          throw local &&
            typeof (local as Error).message === "string" &&
            (local as Error).message.includes("Places API")
            ? local
            : original;
        }
      }
      if (token !== request.current) return;
      setResults(rows);
      if (!rows.length)
        setMessage(
          "검색 결과가 없어요. 이름이나 지점을 바꿔 검색하거나 아래에서 주소를 직접 입력해 주세요.",
        );
    } catch (e) {
      if (token === request.current)
        setMessage(
          e && typeof (e as Error).message === "string"
            ? (e as Error).message
            : "장소를 검색하지 못했어요.",
        );
    } finally {
      if (token === request.current) setBusy(false);
    }
  }
  return (
    <View style={{ marginBottom: 12, zIndex: results.length ? 100 : 0 }}>
      <View ref={anchor} collapsable={false} style={{ zIndex: 100 }}>
        <Field
          accessibilityLabel="장소 검색어"
          placeholder="호텔·장소 이름으로 검색"
          value={query}
          style={{
            marginBottom: 0,
            ...(results.length ? { borderColor: ui.blue } : {}),
          }}
          onChangeText={(v) => {
            request.current++;
            setBusy(false);
            setQuery(v);
            onNameChange?.(v);
            setResults([]);
            setMessage("");
          }}
          maxLength={120}
          returnKeyType="search"
          onSubmitEditing={() => {
            if (query.trim() && !busy) void search();
          }}
        />
        {!!results.length && (
          <SearchDropdown
            anchor={anchor}
            count={results.length}
            label="Google Maps · 검색 결과"
          >
            {results.map((r) => (
              <Pressable
                key={r.googlePlaceId}
                accessibilityRole="button"
                accessibilityLabel={`이 장소 선택 · 주소 가져오기: ${r.name}`}
                onPress={() => {
                  onSelect(r);
                  setResults([]);
                  setMessage("선택한 장소의 주소를 가져왔어요.");
                  Keyboard?.dismiss();
                }}
                style={({ pressed }) => [
                  searchStyles.row,
                  pressed && { backgroundColor: ui.blueSoft },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={searchStyles.name}>{r.name}</Text>
                  <Text style={searchStyles.detail}>{r.address}</Text>
                </View>
                <Text style={searchStyles.chevron}>›</Text>
              </Pressable>
            ))}
          </SearchDropdown>
        )}
      </View>
      <Action
        title={busy ? "주소 찾는 중…" : "이름으로 주소 검색"}
        disabled={busy || !query.trim()}
        onPress={search}
      />
      <P>
        이름과 여행 도시만 검색 서비스에 보내요. 결과를 선택하면 이름과 주소가
        자동으로 채워져요.
      </P>
      {!!message && (
        <Text accessibilityRole="alert" style={s.p}>
          {message}
        </Text>
      )}
      <Action
        title="직접 확인: Google Maps 열기 ↗"
        secondary
        onPress={() => {
          Linking.openURL(
            "https://www.google.com/maps/search/?api=1&query=" +
              encodeURIComponent(`${query || name}, ${city}`),
          ).catch(() => setMessage("지도를 열지 못했어요."));
        }}
      />
      <P>
        외부 지도에서 본 장소는 자동으로 전달되지 않아요. 검색이 안 되면 Google
        Maps의 주소를 복사해 아래 주소 칸에 붙여넣어 주세요.
      </P>
    </View>
  );
}
