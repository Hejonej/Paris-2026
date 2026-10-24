import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, Pressable, View, Image } from "react-native";
import { Page, H, P, Action, Label, s } from "../../../../ui";
import { places } from "../../../../data";
import { useTrips } from "../../../../store";
import { ui } from "../../../../theme";
export default function Candidates() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const router = useRouter();
  const { trips } = useTrips();
  const trip = trips.find((t) => t.id === tripId);
  const list = places.filter((p) => trip?.candidates.includes(p.id));
  return (
    <Page>
      <Label>PLACES TO KEEP</Label>
      <H>여행 후보</H>
      <P>마음에 둔 장소들. 저장만으로 일정에 추가되지 않아요.</P>
      {list.length ? (
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
              source={{ uri: p.image }}
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
