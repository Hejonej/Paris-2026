import React from "react";
import { Page, H, P, Card } from "../../../../ui";
import { Text } from "react-native";
export default function Journal() {
  return (
    <Page>
      <H>여행의 기록</H>
      <Card>
        <Text style={{ fontWeight: "700" }}>아직 기록이 없어요</Text>
        <P>
          방문한 장소와 메모를 간직할 공간이에요. 기록 작성 기능은 준비
          중이에요.
        </P>
      </Card>
    </Page>
  );
}
