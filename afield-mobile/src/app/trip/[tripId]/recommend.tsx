import { imageSource } from "../../../images";
import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, Pressable, Image, View } from "react-native";
import { Page, H, P, Label, s } from "../../../ui";
import { places } from "../../../data";
import { useTrips } from "../../../store";
import { ui } from "../../../theme";
export default function Recommend() {
  const { tripId, date } = useLocalSearchParams<{
    tripId: string;
    date?: string;
  }>();
  const router = useRouter();
  const { trips } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const paris =
    trip &&
    (trip.city.toLowerCase().includes("paris") || trip.city.includes("파리"));
  return (
    <Page>
      <Label>취향을 따라 발견하는 장소</Label>
      <H>이번 여행의 발견</H>
      <P>
        직접 고른 예시 장소예요. 후보 저장과 일정 추가는 각각 선택할 수 있어요.
      </P>
      {paris ? (
        places.map((p) => (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: "/trip/[tripId]/place/[placeId]",
                params: { tripId, placeId: p.id, ...(date ? { date } : {}) },
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
            <Image
              source={imageSource(p.image)}
              style={{
                width: 90,
                height: 94,
                borderRadius: 12,
                backgroundColor: ui.line,
              }}
            />
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Label>{p.category}</Label>
              <Text style={s.title}>{p.name} ›</Text>
              <Text style={{ fontSize: 12, color: ui.muted, marginTop: 7 }}>
                {p.area} ·{" "}
                {trip.candidates.includes(p.id) ? "후보에 저장됨" : "둘러보기"}
              </Text>
            </View>
          </Pressable>
        ))
      ) : (
        <P>
          아직 {trip?.city || "이 도시"}의 추천을 준비하고 있어요. Paris 예시
          장소는 다른 여행에 섞지 않아요.
        </P>
      )}
      <P>사진은 분위기를 전달하는 참고 이미지예요.</P>
    </Page>
  );
}
