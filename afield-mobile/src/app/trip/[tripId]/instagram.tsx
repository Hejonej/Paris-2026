import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { H, P, Label, Action, s } from "../../../ui";
import { ui } from "../../../theme";
import { useTripParams } from "../../../route";
import { useTrips } from "../../../store";
import { pickInstagramFile } from "../../../importFile";
import { categories } from "../../../instagram";
import type { ImportCollection } from "../../../instagram";
export default function InstagramImport() {
  const { tripId } = useTripParams();
  const { trips, importInstagram } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const router = useRouter();
  const [collections, setCollections] = useState<ImportCollection[]>([]);
  const [collection, setCollection] = useState<ImportCollection>();
  const [fileName, setFileName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const existing = new Set(trip?.inspirations?.map((p) => p.url) || []);
  const posts = collection?.posts || [];
  const fresh = posts.filter((p) => !existing.has(p.url));
  const count = posts.filter(
    (p) => selected.has(p.id) && !existing.has(p.url),
  ).length;
  function choose(c: ImportCollection) {
    setCollection(c);
    setSelected(
      new Set(c.posts.filter((p) => !existing.has(p.url)).map((p) => p.id)),
    );
    setCategory({});
    setError("");
  }
  async function pick() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const file = await pickInstagramFile();
      if (file) {
        setFileName(file.name);
        setCollections(file.collections);
        setCollection(undefined);
        setSelected(new Set());
        if (file.collections.length === 1) choose(file.collections[0]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "파일을 읽지 못했어요.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function save() {
    if (locked.current) return;
    locked.current = true;
    const result = importInstagram(
      tripId,
      posts
        .filter((p) => selected.has(p.id) && !existing.has(p.url))
        .map((p) => ({ ...p, category: category[p.id] || p.category })),
    );
    if (result.ok)
      router.dismissTo({
        pathname: "/trip/[tripId]/(tabs)/candidates",
        params: { tripId, section: "inspiration" },
      });
    else setError(result.message);
    locked.current = false;
  }
  const header = (
    <View>
      <Label>{trip?.name || "여행"} · Instagram</Label>
      <H>모아 둔 여행의 영감</H>
      <P>
        Instagram에서 내려받은 저장 컬렉션 JSON을 선택해 주세요. 파일은 이
        기기에서 읽으며, 가져오기 전에는 여행에 저장하지 않아요.
      </P>
      <Action
        title={collections.length ? "다른 JSON 파일 선택" : "JSON 파일 선택"}
        onPress={pick}
        disabled={busy}
      />
      {busy && (
        <ActivityIndicator
          accessibilityLabel="JSON 파일 읽는 중"
          style={{ margin: 18 }}
        />
      )}
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={{ color: "#A23C2B", marginVertical: 12 }}
        >
          {error}
        </Text>
      )}
      {!!fileName && <P>{fileName}</P>}
      {collection ? (
        <>
          <View style={s.row}>
            <Text style={s.title}>{collection.name}</Text>
            {collections.length > 1 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setCollection(undefined)}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text style={{ color: ui.accent }}>컬렉션 변경</Text>
              </Pressable>
            )}
          </View>
          <P>
            {posts.length}개 발견 · 새 항목 {fresh.length}개 · 선택 {count}개
          </P>
          <View style={{ flexDirection: "row", gap: 14 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelected(new Set(fresh.map((p) => p.id)))}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text style={{ color: ui.accent, fontWeight: "600" }}>
                전체 선택
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelected(new Set())}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text style={{ color: ui.muted }}>전체 해제</Text>
            </Pressable>
          </View>
          <Action
            title={`선택한 ${count}개 게시물 가져오기`}
            onPress={save}
            disabled={!count || busy}
          />
          <P>
            게시물은 원본으로 보관해요. 장소 확인과 일정 배치는 다음 단계에서
            따로 선택해요.
          </P>
        </>
      ) : (
        !!collections.length && (
          <>
            <Text style={s.title}>어떤 컬렉션을 가져올까요?</Text>
            {collections.map((c) => (
              <Pressable
                key={c.name}
                accessibilityRole="button"
                onPress={() => choose(c)}
                style={{
                  paddingVertical: 18,
                  borderBottomWidth: 1,
                  borderColor: ui.line,
                }}
              >
                <Text style={s.title}>{c.name} ›</Text>
                <P>{c.posts.length}개 게시물</P>
              </Pressable>
            ))}
          </>
        )
      )}
    </View>
  );
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: ui.bg }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      data={posts}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={header}
      renderItem={({ item: p }) => {
        const duplicate = existing.has(p.url);
        return (
          <View
            style={{
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderColor: ui.line,
              opacity: duplicate ? 0.55 : 1,
            }}
          >
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{
                checked: selected.has(p.id),
                disabled: duplicate,
              }}
              disabled={duplicate}
              onPress={() =>
                setSelected((current) => {
                  const next = new Set(current);
                  if (next.has(p.id)) next.delete(p.id);
                  else next.add(p.id);
                  return next;
                })
              }
              style={{ flexDirection: "row", gap: 12, minHeight: 44 }}
            >
              <Text style={{ fontSize: 20, color: ui.accent }}>
                {selected.has(p.id) ? "☑" : "□"}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{p.name}</Text>
                <Text style={{ fontSize: 13, color: ui.muted, marginTop: 6 }}>
                  {duplicate
                    ? "이미 이 여행에 가져온 게시물"
                    : p.username
                      ? "@" + p.username
                      : "원본 게시물 링크 보관"}
                </Text>
              </View>
            </Pressable>
            {!!p.caption && (
              <Text
                numberOfLines={4}
                style={{
                  fontSize: 14,
                  lineHeight: 22,
                  color: ui.muted,
                  marginVertical: 8,
                }}
              >
                {p.caption}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={duplicate}
              onPress={() => {
                const current = category[p.id] || p.category;
                setCategory({
                  ...category,
                  [p.id]:
                    categories[
                      (categories.indexOf(current) + 1) % categories.length
                    ],
                });
              }}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text style={{ color: ui.accent }}>
                분류 · {category[p.id] || p.category} 변경
              </Text>
            </Pressable>
          </View>
        );
      }}
    />
  );
}
