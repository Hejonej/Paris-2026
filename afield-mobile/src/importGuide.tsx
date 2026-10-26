import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  Linking,
} from "react-native";
import { Action, H, P } from "./ui";
import { ui } from "./theme";
const steps = [
  {
    title: "Instagram의 계정 센터 열기",
    body: "프로필 오른쪽 위 메뉴(☰)에서 계정 센터 → 내 정보 및 권한으로 들어가세요.",
    rows: ["프로필   ☰", "계정 센터", "내 정보 및 권한"],
    focus: 2,
  },
  {
    title: "내 정보를 기기로 내보내기",
    body: "내 정보 내보내기(또는 정보 다운로드)를 선택하고 Instagram 계정을 고른 뒤 기기로 내보내기를 선택하세요.",
    rows: [
      "내 정보 내보내기 / 다운로드",
      "Instagram 계정 선택",
      "기기로 내보내기",
    ],
    focus: 2,
  },
  {
    title: "저장 항목 · JSON 선택",
    body: "정보를 선택할 수 있으면 저장 항목(저장한 게시물·컬렉션)을 포함하세요. 기간은 전체 기간, 파일 형식은 반드시 JSON으로 요청하세요.",
    rows: ["☑ 저장 항목", "기간   전체 기간", "파일 형식   JSON ✓"],
    focus: 2,
  },
  {
    title: "ZIP 압축을 풀고 JSON 가져오기",
    body: "Instagram에서 준비 완료 알림을 받으면 파일을 내려받으세요. iPhone ‘파일’ 앱에서 ZIP을 눌러 압축을 풀고, 저장 항목 폴더의 .json 파일을 이 앱에서 선택하세요. 파일 이름은 내보내기 버전에 따라 달라요.",
    rows: [
      "다운로드한 파일.zip",
      "파일 앱에서 압축 풀기 ↓",
      "저장 항목의 파일.json",
    ],
    focus: 2,
  },
];
export function ImportGuide() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const item = steps[step];
  return (
    <>
      <Action
        title="Instagram 가져오기 가이드"
        secondary
        onPress={() => {
          setStep(0);
          setError("");
          setOpen(true);
        }}
      />
      {open && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setOpen(false)}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "flex-end",
              backgroundColor: "#00000066",
            }}
          >
            <ScrollView
              accessibilityViewIsModal
              style={{
                maxHeight: "92%",
                flexGrow: 0,
                backgroundColor: ui.bg,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
              }}
              contentContainerStyle={{ padding: 22, paddingBottom: 36 }}
            >
              <Text style={{ fontSize: 15, color: ui.accent, marginBottom: 8 }}>
                Instagram 가져오기 · {step + 1} / {steps.length}
              </Text>
              <H>{item.title}</H>
              <View
                accessibilityLabel={`설명용 화면: ${item.rows.join(" → ")}`}
                style={{
                  borderWidth: 2,
                  borderColor: ui.line,
                  backgroundColor: ui.surface,
                  borderRadius: 22,
                  padding: 18,
                  marginVertical: 12,
                }}
              >
                <View
                  style={{
                    width: 50,
                    height: 5,
                    backgroundColor: ui.line,
                    alignSelf: "center",
                    borderRadius: 8,
                    marginBottom: 16,
                  }}
                />
                {item.rows.map((row, index) => (
                  <View
                    key={row}
                    style={{
                      padding: 15,
                      marginBottom: 8,
                      borderRadius: 12,
                      backgroundColor: index === item.focus ? "#E1E8DB" : ui.bg,
                      borderWidth: 1,
                      borderColor: index === item.focus ? ui.accent : ui.line,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 17,
                        fontWeight: index === item.focus ? "700" : "400",
                        color: ui.ink,
                      }}
                    >
                      {row}
                    </Text>
                  </View>
                ))}
                <Text
                  style={{
                    fontSize: 13,
                    color: ui.muted,
                    textAlign: "center",
                    marginTop: 4,
                  }}
                >
                  설명용 그림 · 실제 Instagram 화면과 다를 수 있어요
                </Text>
              </View>
              <P>{item.body}</P>
              <P>
                메뉴 이름은 Instagram 버전과 언어에 따라 조금 달라질 수 있어요.
              </P>
              {!!error && (
                <Text accessibilityRole="alert" style={{ color: "#A23C2B" }}>
                  {error}
                </Text>
              )}
              <View style={{ flexDirection: "row", gap: 12 }}>
                {step > 0 && (
                  <View style={{ flex: 1 }}>
                    <Action
                      title="이전"
                      secondary
                      onPress={() => setStep(step - 1)}
                    />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Action
                    title={step === steps.length - 1 ? "가이드 닫기" : "다음"}
                    onPress={() =>
                      step === steps.length - 1
                        ? setOpen(false)
                        : setStep(step + 1)
                    }
                  />
                </View>
              </View>
              <Pressable
                accessibilityRole="link"
                onPress={() =>
                  Linking.openURL(
                    "https://help.instagram.com/181231772500920",
                  ).catch(() =>
                    setError(
                      "안내 페이지를 열지 못했어요. 연결을 확인해 주세요.",
                    ),
                  )
                }
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text style={{ fontSize: 15, color: ui.accent }}>
                  Instagram 공식 도움말 ↗
                </Text>
              </Pressable>
              {step < steps.length - 1 && (
                <Action title="닫기" secondary onPress={() => setOpen(false)} />
              )}
            </ScrollView>
          </View>
        </Modal>
      )}
    </>
  );
}
