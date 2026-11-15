import { placeText } from "../../../../placeText";
import React, { useState } from "react";
import { View, Text, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { Page, H, P, Label, Action, Field, s } from "../../../../ui";
import { useTripParams } from "../../../../route";
import { useTrips } from "../../../../store";
import { instagramUrl } from "../../../../instagram";
import { ui } from "../../../../theme";
export default function Inspiration() {
  const { tripId, postId, returnTo, date } = useTripParams();
  const { trips, confirmInstagram, addInspirationCandidate } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const post = trip?.inspirations?.find((p) => p.id === postId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
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
  const availableCandidates = post.candidates.filter(
    (c) => !alreadySaved.some((p) => p.name === c.name),
  );
  function savePlaces(candidateIds: string[]) {
    const result = confirmInstagram(
      tripId,
      candidateIds.map((candidateId) => ({ postId, candidateId })),
    );
    setMessage(result.message);
    if (result.ok) {
      setSelected(new Set());
      const ids = result.placeIds || [];
      if (ids.length === 1)
        router.push({
          pathname: "/trip/[tripId]/place/[placeId]",
          params: { tripId, returnTo, date, placeId: ids[0] },
        });
    }
  }
  return (
    <Page>
      <Label>Instagram에서 발견</Label>
      <Label>
        {post.collection} · {post.category}
      </Label>
      <Text
        style={{
          fontSize: 25,
          lineHeight: 34,
          fontWeight: "700",
          color: ui.ink,
          marginBottom: 12,
        }}
      >
        {post.name}
      </Text>
      <P>장소를 골라 주소를 확인하세요. 일정은 나중에 AI가 제안해요.</P>
      {!!alreadySaved.length && (
        <View style={{ marginBottom: 14 }}>
          <Text style={s.title}>이 게시물에서 저장한 장소</Text>
          {alreadySaved.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={`${placeText(p.name)} 위치 확인`}
              onPress={() =>
                router.push({
                  pathname: "/trip/[tripId]/place/[placeId]",
                  params: { tripId, placeId: p.id, returnTo, date },
                })
              }
              style={{
                flexDirection: "row",
                gap: 12,
                alignItems: "center",
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderColor: ui.line,
                minHeight: 64,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 16,
                    lineHeight: 23,
                    color: ui.ink,
                    fontWeight: "600",
                  }}
                >
                  {placeText(p.name)}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: p.matchStatus === "confirmed" ? ui.blue : ui.muted,
                    marginTop: 5,
                  }}
                >
                  {p.matchStatus === "confirmed"
                    ? "주소 확인됨 · AI 배치 준비"
                    : "저장됨 · 주소 확인 필요"}
                </Text>
              </View>
              <Text style={{ fontSize: 22, color: ui.muted }}>›</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Action
        title="Instagram 원본 보기 ↗"
        tone="link"
        onPress={() => {
          const url = instagramUrl(post.url);
          if (url)
            Linking.openURL(url).catch(() =>
              setMessage("원본 링크를 열지 못했어요."),
            );
        }}
      />
      <P>{post.username ? "@" + post.username : ""}</P>
      <Action
        title={showOriginal ? "원본 내용 접기" : "원본 내용 펼쳐보기"}
        tone="link"
        onPress={() => setShowOriginal(!showOriginal)}
      />
      {showOriginal && (
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
      )}
      {!!availableCandidates.length && (
        <>
          <Text style={s.title}>어디에 가고 싶나요?</Text>
          <P>
            아래 이름은 캡션에서 찾은 제안이에요. 실제 장소 이름만 고르세요.
            없는 장소는 아래에 직접 적을 수 있어요.
          </P>
        </>
      )}
      {availableCandidates.map((c) => (
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
      <Action
        title="저장한 장소 목록 보기"
        secondary
        onPress={() =>
          router.dismissTo({
            pathname: "/trip/[tripId]/(tabs)/candidates",
            params: { tripId, section: "places", returnTo, date },
          })
        }
      />
    </Page>
  );
}
