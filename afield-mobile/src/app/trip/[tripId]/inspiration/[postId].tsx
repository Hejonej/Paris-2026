import React, { useState } from "react";
import { View, Text, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { Page, H, P, Label, Action, Field, s } from "../../../../ui";
import { useTripParams } from "../../../../route";
import { useTrips } from "../../../../store";
import { instagramUrl } from "../../../../instagram";
import { ui } from "../../../../theme";
export default function Inspiration() {
  const { tripId, postId } = useTripParams();
  const { trips, confirmInstagram, addInspirationCandidate } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const post = trip?.inspirations?.find((p) => p.id === postId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const router = useRouter();
  if (!post)
    return (
      <Page>
        <H>게시물을 찾을 수 없어요</H>
      </Page>
    );
  const alreadySaved =
    trip?.importedPlaces?.filter((p) => p.sourcePostIds.includes(postId)) || [];
  function savePlaces(candidateIds: string[]) {
    const result = confirmInstagram(
      tripId,
      candidateIds.map((candidateId) => ({ postId, candidateId })),
    );
    setMessage(result.message);
    if (result.ok) {
      setSelected(new Set());
      const ids = result.placeIds || [];
      setSavedIds(ids);
      if (ids.length === 1)
        router.push({
          pathname: "/trip/[tripId]/place/[placeId]",
          params: { tripId, placeId: ids[0] },
        });
    }
  }
  return (
    <Page>
      <Label>1 · 게시물에서 장소 고르기</Label>
      <P>
        가고 싶은 장소를 고르면 다음 화면에서 위치를 확인해요. 일정에는 아직
        추가하지 않아요.
      </P>
      <Label>
        {post.collection} · {post.category}
      </Label>
      <H>{post.name}</H>
      {!!alreadySaved.length && (
        <View style={{ marginBottom: 14 }}>
          <Text style={s.title}>이 게시물에서 저장한 장소</Text>
          {alreadySaved.map((p) => (
            <Action
              key={p.id}
              title={`${p.name} · ${p.matchStatus === "confirmed" ? "일정에 추가" : "위치 확인"} →`}
              onPress={() =>
                router.push({
                  pathname: "/trip/[tripId]/place/[placeId]",
                  params: { tripId, placeId: p.id },
                })
              }
            />
          ))}
        </View>
      )}
      <Action
        title="Instagram 원본 보기 ↗"
        secondary
        onPress={() => {
          const url = instagramUrl(post.url);
          if (url)
            Linking.openURL(url).catch(() =>
              setMessage("원본 링크를 열지 못했어요."),
            );
        }}
      />
      <P>{post.username ? "@" + post.username : ""}</P>
      <Text
        selectable
        style={{
          fontSize: 15,
          lineHeight: 24,
          color: ui.ink,
          marginBottom: 24,
        }}
      >
        {post.caption ||
          "내보내기 파일에 캡션이 없어요. 원본을 확인하고 장소 후보를 직접 추가할 수 있어요."}
      </Text>
      <Text style={s.title}>어디에 가고 싶나요?</Text>
      <P>
        아래 이름은 캡션에서 찾은 제안이에요. 실제 장소 이름만 고르세요. 없는
        장소는 아래에 직접 적을 수 있어요.
      </P>
      {post.candidates.map((c) => (
        <Pressable
          key={c.id}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected.has(c.id) }}
          onPress={() =>
            setSelected((current) => {
              const next = new Set(current);
              if (next.has(c.id)) next.delete(c.id);
              else next.add(c.id);
              return next;
            })
          }
          style={{
            minHeight: 54,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderColor: ui.line,
          }}
        >
          <Text style={{ fontSize: 16, color: ui.ink }}>
            {selected.has(c.id) ? "☑" : "□"} {c.name}
          </Text>
          <Text style={{ fontSize: 13, color: ui.muted, marginTop: 5 }}>
            {c.kind === "manual"
              ? "직접 추가"
              : c.kind === "mention"
                ? "@mention에서 발견"
                : "캡션에서 발견"}{" "}
            · 위치 확인 필요
          </Text>
        </Pressable>
      ))}
      <View style={{ marginVertical: 20 }}>
        <Label>누락된 장소 직접 추가</Label>
        <Field
          accessibilityLabel="게시물의 장소 이름"
          value={manual}
          onChangeText={setManual}
          maxLength={90}
          placeholder="원본에서 확인한 장소 이름"
        />
        <Action
          title="이 이름으로 저장하고 위치 확인"
          secondary
          disabled={!manual.trim()}
          onPress={() => {
            const result = addInspirationCandidate(tripId, postId, manual);
            setMessage(result.message);
            if (result.ok && result.candidateId) {
              setManual("");
              savePlaces([result.candidateId]);
            }
          }}
        />
      </View>
      {selected.size > 0 && (
        <Action
          title={
            selected.size === 1
              ? "저장하고 위치 확인 →"
              : `선택한 ${selected.size}곳 저장하고 위치 확인`
          }
          disabled={!selected.size}
          onPress={() => {
            savePlaces([...selected]);
          }}
        />
      )}
      {!!message && (
        <Text
          accessibilityRole="alert"
          style={{
            fontSize: 14,
            lineHeight: 22,
            color: ui.accent,
            marginTop: 12,
          }}
        >
          {message}
        </Text>
      )}
      {!!savedIds.length && (
        <View style={{ marginTop: 16 }}>
          <Text style={s.title}>
            저장했어요. 위치를 확인할 장소를 골라 주세요.
          </Text>
          {savedIds.map((id) => (
            <Action
              key={id}
              title={`${trip?.importedPlaces?.find((p) => p.id === id)?.name || "저장한 장소"} · 위치 확인 →`}
              onPress={() =>
                router.push({
                  pathname: "/trip/[tripId]/place/[placeId]",
                  params: { tripId, placeId: id },
                })
              }
            />
          ))}
        </View>
      )}
      <Action
        title="저장한 장소 목록 보기"
        secondary
        onPress={() =>
          router.dismissTo({
            pathname: "/trip/[tripId]/(tabs)/candidates",
            params: { tripId, section: "places" },
          })
        }
      />
    </Page>
  );
}
