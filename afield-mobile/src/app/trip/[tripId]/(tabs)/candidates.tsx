import { inspirationProgress } from "../../../../inspirationProgress";
import { ActivityBadge } from "../../../../activityUI";
import { inferActivity } from "../../../../activities";
import React, { useCallback, useState } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { Text, Pressable, View, Image, FlatList } from "react-native";
import { H, P, Action, Label, s } from "../../../../ui";
import { tripPlaces } from "../../../../data";
import { imageSource } from "../../../../images";
import { useTripParams } from "../../../../route";
import { useTrips } from "../../../../store";
import { ui } from "../../../../theme";
export default function Candidates() {
  const { tripId, section, startPost, postFilter } = useTripParams();
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
  useFocusEffect(
    useCallback(() => {
      if (section === "inspiration") {
        setTab("posts");
        setFilter(postFilter === "all" ? "all" : "pending");
      } else if (section === "places") setTab("places");
    }, [section, postFilter]),
  );
  type Row =
    | { kind: "place"; id: string; place: (typeof list)[number] }
    | { kind: "post"; id: string; post: (typeof posts)[number] };
  const rows: Row[] =
    tab === "posts"
      ? (filter === "pending" ? pendingPosts : posts).map((post) => ({
          kind: "post",
          id: post.id,
          post,
        }))
      : list.map((place) => ({ kind: "place", id: place.id, place }));
  const nextPost =
    pendingPosts.find((p) => p.id === startPost) || pendingPosts[0];
  const openPost = (postId: string) =>
    router.push({
      pathname: "/trip/[tripId]/inspiration/[postId]",
      params: { tripId, postId },
    });
  const importMore = (
    <Action
      title={
        posts.length
          ? "다른 Instagram JSON 가져오기"
          : "Instagram JSON 가져오기"
      }
      secondary={!!posts.length}
      onPress={() =>
        router.push({
          pathname: "/trip/[tripId]/instagram",
          params: { tripId },
        })
      }
    />
  );
  const header = (
    <View>
      <Label>
        {trip?.name || "여행"} · 저장한 장소 {list.length}
      </Label>
      <H>
        {tab === "posts"
          ? startPost
            ? "게시물을 가져왔어요"
            : "게시물에서 장소 고르기"
          : "가고 싶은 곳"}
      </H>
      <P>
        {tab === "posts"
          ? "가져오기는 끝났어요. 이제 게시물을 열어 가고 싶은 장소를 골라 주세요. 게시물 가져오기만으로 일정이 만들어지지는 않아요."
          : "가고 싶은 장소를 모아 두는 목록이에요. 장소를 열어 위치를 확인하고 날짜와 시간을 골라 일정에 넣으세요."}
      </P>
      {tab === "posts" && nextPost && (
        <View
          style={{
            padding: 14,
            borderRadius: 12,
            backgroundColor: "#E7EBE2",
            marginBottom: 8,
          }}
        >
          <Label>다음 단계 · 장소 고르기</Label>
          <Text numberOfLines={2} style={s.title}>
            {nextPost.name}
          </Text>
          <Text
            style={{
              fontSize: 15,
              lineHeight: 23,
              color: ui.muted,
              marginVertical: 8,
            }}
          >
            게시물 열기 → 장소 선택 → 지도에서 위치 확인 → 일정에 추가
          </Text>
          <Action
            title="게시물 열고 장소 고르기 →"
            onPress={() => openPost(nextPost.id)}
          />
        </View>
      )}
      {(tab === "places" || !posts.length) && importMore}
      <View style={{ flexDirection: "row", gap: 8, marginVertical: 18 }}>
        {[
          { id: "places", label: `장소 ${list.length}` },
          { id: "posts", label: `가져온 게시물 ${posts.length}` },
        ].map((t) => (
          <Pressable
            key={t.id}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === t.id }}
            onPress={() => setTab(t.id)}
            style={{
              flex: 1,
              minHeight: 46,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              backgroundColor: tab === t.id ? ui.accent : ui.line,
            }}
          >
            <Text
              style={{
                color: tab === t.id ? "white" : ui.ink,
                fontWeight: "600",
                fontSize: 15,
              }}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {tab === "posts" && !!posts.length && (
        <View style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              { id: "pending", title: `남은 게시물 ${pendingPosts.length}` },
              { id: "all", title: `전체 ${posts.length}` },
            ].map((option) => (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === option.id }}
                onPress={() => setFilter(option.id)}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  backgroundColor:
                    filter === option.id ? "#E7EBE2" : "transparent",
                }}
              >
                <Text style={{ fontSize: 15, color: ui.accent }}>
                  {option.title}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text
            style={{
              fontSize: 14,
              lineHeight: 21,
              color: ui.muted,
              marginTop: 6,
            }}
          >
            장소를 일정에 넣은 게시물은 전체 목록에 남아요. 한 게시물에서 다른
            장소를 더 고를 수도 있어요.
          </Text>
        </View>
      )}
      {!trip ? (
        <P>여행 정보를 불러올 수 없어요. 여행 목록에서 다시 선택해 주세요.</P>
      ) : !rows.length ? (
        <P>
          {tab === "posts"
            ? posts.length
              ? "모든 게시물의 장소를 일정에 연결했어요. 전체 목록에서 다시 볼 수 있어요."
              : "가져온 게시물이 없어요. 저장 컬렉션 JSON을 선택해 주세요."
            : "아직 저장한 장소가 없어요. Instagram 저장 목록을 가져오거나 아래 예시 장소를 둘러보고 저장해 보세요."}
        </P>
      ) : null}
    </View>
  );
  return (
    <FlatList
      style={{ backgroundColor: ui.bg, flex: 1 }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      data={rows}
      keyExtractor={(r) => r.kind + r.id}
      ListHeaderComponent={header}
      ListFooterComponent={
        tab === "places" ? (
          <Action
            title="예시 장소 둘러보기"
            secondary
            onPress={() =>
              router.push({
                pathname: "/trip/[tripId]/recommend",
                params: { tripId },
              })
            }
          />
        ) : (
          importMore
        )
      }
      renderItem={({ item: r }) =>
        r.kind === "post" ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: "/trip/[tripId]/inspiration/[postId]",
                params: { tripId, postId: r.post.id },
              })
            }
            style={{
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderColor: ui.line,
            }}
          >
            <Text style={s.title}>{r.post.name}</Text>
            {completedPostIds.has(r.post.id) && (
              <Text style={{ fontSize: 14, color: ui.accent, marginTop: 6 }}>
                ✓ 일정에 연결됨 · 장소 더 고르기 가능
              </Text>
            )}
            <Text style={{ fontSize: 13, color: ui.muted, marginTop: 6 }}>
              {r.post.collection} · 장소 후보 {r.post.candidates.length}
            </Text>
            <Text
              numberOfLines={2}
              style={{
                fontSize: 14,
                lineHeight: 21,
                color: ui.muted,
                marginTop: 7,
              }}
            >
              {r.post.caption ||
                "원본 게시물을 보고 장소 이름을 직접 적을 수 있어요."}
            </Text>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: ui.accent,
                marginTop: 10,
              }}
            >
              장소 고르기 ›
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: "/trip/[tripId]/place/[placeId]",
                params: { tripId, placeId: r.place.id },
              })
            }
            style={{
              flexDirection: "row",
              gap: 14,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderColor: ui.line,
            }}
          >
            {!!r.place.image && (
              <Image
                source={imageSource(r.place.image)}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 12,
                  backgroundColor: ui.line,
                }}
              />
            )}
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text style={s.title}>{r.place.name} ›</Text>
              <ActivityBadge
                value={inferActivity(r.place.name, r.place.category)}
              />
              <P>
                {r.place.category}
                {"matchStatus" in r.place
                  ? r.place.matchStatus === "confirmed"
                    ? " · 날짜를 골라 일정에 추가 →"
                    : " · 다음: 위치 확인 →"
                  : ""}
              </P>
            </View>
          </Pressable>
        )
      }
    />
  );
}
