import { placeText } from "../../../../placeText";
import React, { useCallback, useState } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { Text, Pressable, View, Image, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { inspirationProgress } from "../../../../inspirationProgress";
import { H, P, Action, Label, Field, s } from "../../../../ui";
import { StatusLine } from "../../../../sheet";
import { tripPlaces, dateLabel } from "../../../../data";
import { imageSource } from "../../../../images";
import { useTripParams } from "../../../../route";
import { useTrips } from "../../../../store";
import { ui } from "../../../../theme";
export default function Candidates() {
  const { tripId, section, startPost, postFilter, returnTo, date } =
    useTripParams();
  const router = useRouter();
  const { trips } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const list = tripPlaces(trip).filter((p) => trip?.candidates.includes(p.id));
  const { posts, pendingPosts, completedPostIds } = inspirationProgress(trip);
  const [filter, setFilter] = useState(
    postFilter === "all" ? "all" : "pending",
  );
  const [tab, setTab] = useState(
    section === "inspiration" ? "posts" : "places",
  );
  const [placeFilter, setPlaceFilter] = useState("all");
  const [query, setQuery] = useState("");
  useFocusEffect(
    useCallback(() => {
      if (section === "inspiration") {
        setTab("posts");
        setFilter(postFilter === "all" ? "all" : "pending");
      } else if (section === "places") setTab("places");
    }, [section, postFilter]),
  );
  const scheduled = (id: string) =>
    trip?.days.filter((d) =>
      d.items.some((e) => (e.placeId || e.location?.placeId) === id),
    ) || [];
  const confirmed = (p: (typeof list)[number]) =>
    !("matchStatus" in p) || p.matchStatus === "confirmed";
  const ready = list.filter(confirmed).filter((p) => !scheduled(p.id).length);
  const openPost = (postId: string) =>
    router.push({
      pathname: "/trip/[tripId]/inspiration/[postId]",
      params: { tripId, postId, returnTo, date },
    });
  type Row =
    | { kind: "place"; id: string; place: (typeof list)[number] }
    | { kind: "post"; id: string; post: (typeof posts)[number] };
  const q = query.trim().toLocaleLowerCase();
  const rows: Row[] =
    tab === "posts"
      ? (filter === "pending" ? pendingPosts : posts)
          .filter((p) =>
            `${placeText(p.name)} ${p.collection} ${p.caption}`
              .toLocaleLowerCase()
              .includes(q),
          )
          .map((post) => ({ kind: "post", id: post.id, post }))
      : list
          .filter(
            (p) =>
              `${placeText(p.name)} ${p.query}`
                .toLocaleLowerCase()
                .includes(q) &&
              (placeFilter === "all" ||
                (placeFilter === "verify"
                  ? !confirmed(p)
                  : placeFilter === "scheduled"
                    ? scheduled(p.id).length > 0
                    : confirmed(p) && !scheduled(p.id).length)),
          )
          .map((place) => ({ kind: "place", id: place.id, place }));
  const nextPost =
    pendingPosts.find((p) => p.id === startPost) || pendingPosts[0];
  const importMore = (
    <Action
      title={
        posts.length
          ? "다른 Instagram JSON 가져오기"
          : "Instagram JSON 가져오기"
      }
      tone="secondary"
      onPress={() =>
        router.push({
          pathname: "/trip/[tripId]/instagram",
          params: { tripId, returnTo, date },
        })
      }
    />
  );
  return (
    <FlatList
      style={{ backgroundColor: ui.bg, flex: 1 }}
      contentContainerStyle={{ padding: 20, paddingBottom: 80 }}
      data={rows}
      keyExtractor={(r) => r.kind + r.id}
      ListHeaderComponent={
        <View>
          <Label>{trip?.city || "여행"} · 저장과 계획</Label>
          <H>
            {tab === "posts"
              ? startPost
                ? "게시물을 가져왔어요"
                : "게시물에서 장소 고르기"
              : "가고 싶은 곳"}
          </H>
          <P>
            {tab === "posts"
              ? "게시물은 발견의 출처예요. 방문할 장소를 따로 골라 주세요."
              : "주소가 확인된 장소는 AI가 날짜와 시간을 제안할 수 있어요. 저장만으로 일정에 추가되지는 않아요."}
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
              { id: "places", label: `장소 ${list.length}` },
              { id: "posts", label: `가져온 게시물 ${posts.length}` },
            ].map((t) => (
              <Pressable
                key={t.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === t.id }}
                onPress={() => {
                  setTab(t.id);
                  setQuery("");
                }}
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
                    fontSize: 16,
                    color: tab === t.id ? ui.ink : ui.muted,
                    fontWeight: tab === t.id ? "700" : "500",
                  }}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Field
            accessibilityLabel={
              tab === "posts" ? "게시물 검색" : "저장 장소 검색"
            }
            placeholder={
              tab === "posts" ? "게시물·컬렉션 검색" : "장소·주소 검색"
            }
            value={query}
            onChangeText={setQuery}
            clearButtonMode="while-editing"
          />
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 16,
            }}
          >
            {(tab === "posts"
              ? [
                  {
                    id: "pending",
                    label: `남은 게시물 ${pendingPosts.length}`,
                  },
                  { id: "all", label: `전체 ${posts.length}` },
                ]
              : [
                  { id: "all", label: "전체" },
                  { id: "verify", label: "주소 확인 필요" },
                  { id: "ready", label: "AI 배치 준비" },
                  { id: "scheduled", label: "일정에 배치" },
                ]
            ).map((f) => (
              <Pressable
                key={f.id}
                accessibilityRole="button"
                accessibilityState={{
                  selected: (tab === "posts" ? filter : placeFilter) === f.id,
                }}
                onPress={() =>
                  tab === "posts" ? setFilter(f.id) : setPlaceFilter(f.id)
                }
                style={{
                  minHeight: 44,
                  paddingHorizontal: 10,
                  justifyContent: "center",
                  backgroundColor:
                    (tab === "posts" ? filter : placeFilter) === f.id
                      ? ui.subtle
                      : "transparent",
                  borderRadius: 6,
                }}
              >
                <Text style={{ fontSize: 13, color: ui.ink }}>{f.label}</Text>
              </Pressable>
            ))}
          </View>
          {tab === "posts" && nextPost && !q && (
            <View
              style={{
                borderLeftWidth: 2,
                borderColor: ui.ink,
                paddingLeft: 14,
                marginBottom: 16,
              }}
            >
              <Label>다음 게시물</Label>
              <Text style={s.title} numberOfLines={2}>
                {nextPost.name}
              </Text>
              <Action
                title="게시물 열고 장소 고르기 →"
                tone="link"
                onPress={() => openPost(nextPost.id)}
              />
            </View>
          )}
          {tab === "places" && ready.length > 0 && (
            <View
              style={{
                backgroundColor: ui.subtle,
                padding: 14,
                marginBottom: 12,
                borderRadius: 8,
              }}
            >
              <Text style={{ fontSize: 15, color: ui.ink }}>
                미배치 장소 {ready.length}곳 · 방문 날짜는 AI가 정해요
              </Text>
              <Action
                title="이 장소들로 AI 계획하기 →"
                tone="link"
                onPress={() =>
                  router.push({
                    pathname: "/trip/[tripId]/plan",
                    params: { tripId },
                  })
                }
              />
            </View>
          )}
          {!trip ? (
            <P>여행 정보를 불러올 수 없어요.</P>
          ) : (
            !rows.length && (
              <P>
                {q || (tab === "places" && placeFilter !== "all")
                  ? "조건에 맞는 장소가 없어요. 검색어나 필터를 바꿔 보세요."
                  : tab === "posts"
                    ? posts.length
                      ? "모든 게시물의 장소를 일정에 연결했어요. 전체 목록에서 다시 볼 수 있어요."
                      : "가져온 게시물이 없어요. 저장 컬렉션 JSON을 선택해 주세요."
                    : "아직 저장한 장소가 없어요. Instagram 저장 목록을 가져오거나 장소를 직접 추가하세요."}
              </P>
            )
          )}
        </View>
      }
      ListFooterComponent={
        <View style={{ marginTop: 20 }}>
          {importMore}
          {tab === "places" && (
            <Action
              title="장소 찾아 추가하기"
              tone="link"
              onPress={() =>
                router.push({
                  pathname: "/trip/[tripId]/recommend",
                  params: { tripId },
                })
              }
            />
          )}
        </View>
      }
      renderItem={({ item: r }) =>
        r.kind === "post" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${r.post.name} 게시물에서 장소 고르기`}
            onPress={() => openPost(r.post.id)}
            style={{
              paddingVertical: 18,
              borderBottomWidth: 1,
              borderColor: ui.line,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <Ionicons name="logo-instagram" size={16} color={ui.muted} />
              <Text style={{ fontSize: 12, color: ui.muted }}>
                출처 · {r.post.collection}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 17,
                lineHeight: 25,
                fontWeight: "600",
                color: ui.ink,
              }}
              numberOfLines={2}
            >
              {r.post.name}
            </Text>
            <Text
              style={{
                fontSize: 13,
                lineHeight: 20,
                color: ui.muted,
                marginTop: 6,
              }}
            >
              추출된 이름 {r.post.candidates.length}개 · 저장한 장소{" "}
              {trip?.importedPlaces?.filter((p) =>
                p.sourcePostIds.includes(r.post.id),
              ).length || 0}
              곳
            </Text>
            <StatusLine
              label={
                completedPostIds.has(r.post.id)
                  ? "일정에 연결됨 · 장소 더 고르기 가능"
                  : "장소 선택 가능 · 게시물 자체는 일정에 들어가지 않아요"
              }
              verified={completedPostIds.has(r.post.id)}
            />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${placeText(r.place.name)} 저장 장소 열기`}
            onPress={() =>
              router.push({
                pathname: "/trip/[tripId]/place/[placeId]",
                params: { tripId, placeId: r.place.id, returnTo, date },
              })
            }
            style={{
              flexDirection: "row",
              gap: 14,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderColor: ui.line,
            }}
          >
            {!!r.place.image && (
              <Image
                source={imageSource(r.place.image)}
                style={{
                  width: 64,
                  height: 80,
                  borderRadius: 8,
                  backgroundColor: ui.line,
                }}
              />
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontSize: 17,
                  lineHeight: 24,
                  fontWeight: "600",
                  color: ui.ink,
                }}
                numberOfLines={2}
              >
                {placeText(r.place.name)}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  lineHeight: 20,
                  color: ui.muted,
                  marginTop: 4,
                }}
              >
                {r.place.category} ·{" "}
                {"sourcePostIds" in r.place && r.place.sourcePostIds.length
                  ? `Instagram 출처 ${r.place.sourcePostIds.length}개`
                  : "직접 저장"}
              </Text>
              <StatusLine
                label={confirmed(r.place) ? "주소 확인됨" : "주소 확인 필요"}
                verified={confirmed(r.place)}
              />
              <Text
                style={{
                  color: ui.muted,
                  fontSize: 13,
                  lineHeight: 20,
                  marginTop: 4,
                }}
              >
                {scheduled(r.place.id).length
                  ? `일정에 배치 · ${scheduled(r.place.id)
                      .map((d) => dateLabel(d.date))
                      .join(", ")}`
                  : "일정 미배치 · 날짜 미정"}
              </Text>
            </View>
            <Text
              style={{ alignSelf: "center", color: ui.muted, fontSize: 22 }}
            >
              ›
            </Text>
          </Pressable>
        )
      }
    />
  );
}
