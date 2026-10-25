import React, { useState } from "react";
import { View, Text, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { Page, H, P, Label, Action, Field, s } from "../../../../ui";
import { useTripParams } from "../../../../route";
import { useTrips } from "../../../../store";
import { instagramUrl, stableId } from "../../../../instagram";
import { ui } from "../../../../theme";
export default function Inspiration() {
  const { tripId, postId } = useTripParams();
  const { trips, confirmInstagram, addInspirationCandidate } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const post = trip?.inspirations?.find((p) => p.id === postId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();
  if (!post)
    return (
      <Page>
        <H>게시물을 찾을 수 없어요</H>
      </Page>
    );
  return (
    <Page>
      <Label>
        {post.collection} · {post.category}
      </Label>
      <H>{post.name}</H>
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
      <Text style={s.title}>게시물 속 장소 후보</Text>
      <P>
        문구와 @mention에서 분리한 후보라 실제 장소가 아닐 수도 있어요. 확인한
        이름만 골라 주세요.
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
          title="후보 이름 추가"
          secondary
          disabled={!manual.trim()}
          onPress={() => {
            const result = addInspirationCandidate(tripId, postId, manual);
            setMessage(result.message);
            if (result.ok) setManual("");
          }}
        />
      </View>
      <Action
        title={`선택한 ${selected.size}개를 여행 후보로`}
        disabled={!selected.size}
        onPress={() => {
          const result = confirmInstagram(
            tripId,
            [...selected].map((candidateId) => ({ postId, candidateId })),
          );
          setMessage(result.message);
          if (result.ok) setSelected(new Set());
        }}
      />
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
        title="여행 후보에서 장소 확인하기 →"
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
