import { ActivityBadge } from "../../../../activityUI";
import { inferActivity } from "../../../../activities";
import React, { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Text, Pressable, View, Image, FlatList } from "react-native";
import { H, P, Action, Label, s } from "../../../../ui";
import { tripPlaces } from "../../../../data";
import { imageSource } from "../../../../images";
import { useTripParams } from "../../../../route";
import { useTrips } from "../../../../store";
import { ui } from "../../../../theme";
export default function Candidates() {
  const { tripId, section } = useTripParams();
  const router = useRouter();
  const { trips } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const list = tripPlaces(trip).filter((p) => trip?.candidates.includes(p.id));
  const posts = trip?.inspirations || [];
  const [tab, setTab] = useState(
    section === "inspiration" ? "posts" : "places",
  );
  useEffect(() => {
    if (section === "inspiration") setTab("posts");
    else if (section === "places") setTab("places");
  }, [section]);
  type Row =
    | { kind: "place"; id: string; place: (typeof list)[number] }
    | { kind: "post"; id: string; post: (typeof posts)[number] };
  const rows: Row[] =
    tab === "posts"
      ? posts.map((post) => ({ kind: "post", id: post.id, post }))
      : list.map((place) => ({ kind: "place", id: place.id, place }));
  const header = (
    <View>
      <Label>
        {trip?.name || "여행"} · 저장한 장소 {list.length}
      </Label>
      <H>가고 싶은 곳</H>
      <P>
        가고 싶은 장소를 모아 두는 목록이에요. 저장만으로 일정에 들어가지는
        않아요. 장소를 열어 ‘일정에 추가’를 눌러 주세요.
      </P>
      <P>
        {tab === "posts"
          ? "다음: 게시물을 열고 가고 싶은 장소를 골라 주세요."
          : "다음: 장소를 열어 위치를 확인하고, 날짜와 시간을 골라 일정에 넣으세요."}
      </P>
      <Action
        title="Instagram JSON 가져오기"
        onPress={() =>
          router.push({
            pathname: "/trip/[tripId]/instagram",
            params: { tripId },
          })
        }
      />
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
      {!trip ? (
        <P>여행 정보를 불러올 수 없어요. 여행 목록에서 다시 선택해 주세요.</P>
      ) : !rows.length ? (
        <P>
          {tab === "posts"
            ? "가져온 게시물이 없어요. 저장 컬렉션 JSON을 선택해 주세요."
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
        ) : undefined
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
            <Text style={s.title}>{r.post.name} ›</Text>
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
              {r.post.caption || "캡션 없음 · 원본 링크 보관"}
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
