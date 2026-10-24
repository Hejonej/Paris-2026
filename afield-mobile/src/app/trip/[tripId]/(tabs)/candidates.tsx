import { imageSource } from "../../../../images";
import { useTripParams } from "../../../../route";
import React from "react";
import { useRouter } from "expo-router";
import { Text, Pressable, View, Image } from "react-native";
import { Page, H, P, Action, Label, s } from "../../../../ui";
import { places } from "../../../../data";
import { useTrips } from "../../../../store";
import { ui } from "../../../../theme";
export default function Candidates() {
  const { tripId } = useTripParams();
  const router = useRouter();
  const { trips } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const list = places.filter((p) => trip?.candidates.includes(p.id));
  return (
    <Page>
      <Label>
        {trip?.name || "여행"} · 저장한 장소 {list.length}
      </Label>
      <H>가보고 싶은 곳</H>
      <P>마음에 드는 곳을 모아 두고, 날짜는 나중에 정해요.</P>
      {!trip ? (
        <P>여행 정보를 불러올 수 없어요. 여행 목록에서 다시 선택해 주세요.</P>
      ) : list.length ? (
        list.map((p) => (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: "/trip/[tripId]/place/[placeId]",
                params: { tripId, placeId: p.id },
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
                width: 72,
                height: 72,
                borderRadius: 12,
                backgroundColor: ui.line,
              }}
            />
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text style={s.title}>{p.name} ›</Text>
              <P>{p.category}</P>
            </View>
          </Pressable>
        ))
      ) : (
        <P>아직 후보가 없어요. 여행에서 만나고 싶은 장소를 모아 보세요.</P>
      )}
      <Action
        title="장소 발견하기"
        secondary
        onPress={() =>
          router.push({
            pathname: "/trip/[tripId]/recommend",
            params: { tripId },
          })
        }
      />
    </Page>
  );
}
