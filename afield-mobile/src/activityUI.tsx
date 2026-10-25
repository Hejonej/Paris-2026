import React, { useState } from "react";
import { Modal, View, Text, Pressable } from "react-native";
import type { ActivityTag } from "./data";
import { activityLabels, activityTags } from "./activities";
import { ui } from "./theme";
export function ActivityButton({
  value,
  onChange,
  name,
}: {
  value: ActivityTag;
  onChange: (tag: ActivityTag) => void;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name} 분류: ${activityLabels[value]}`}
        onPress={() => setOpen(true)}
        style={{
          minHeight: 36,
          justifyContent: "center",
          paddingHorizontal: 10,
          borderRadius: 8,
          backgroundColor: "#E7EBE2",
          alignSelf: "flex-start",
        }}
        hitSlop={4}
      >
        <Text style={{ fontSize: 13, fontWeight: "600", color: ui.accent }}>
          {activityLabels[value]} ▾
        </Text>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#00000066",
            justifyContent: "flex-end",
          }}
        >
          <View
            accessibilityViewIsModal
            style={{
              backgroundColor: ui.bg,
              padding: 20,
              paddingBottom: 36,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                color: ui.ink,
                marginBottom: 8,
              }}
            >
              이 일정은 어떤 시간인가요?
            </Text>
            <Text style={{ fontSize: 14, color: ui.muted, marginBottom: 14 }}>
              {name}
            </Text>
            {activityTags.map((tag) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: tag === value }}
                key={tag}
                onPress={() => {
                  onChange(tag);
                  setOpen(false);
                }}
                style={{
                  minHeight: 46,
                  justifyContent: "center",
                  borderBottomWidth: 1,
                  borderColor: ui.line,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color: tag === value ? ui.accent : ui.ink,
                  }}
                >
                  {tag === value ? "✓ " : ""}
                  {tag === "other" ? "기타" : activityLabels[tag]}
                </Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpen(false)}
              style={{
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 10,
              }}
            >
              <Text style={{ fontSize: 15, color: ui.muted }}>닫기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function ActivityBadge({ value }: { value: ActivityTag }) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: "#E7EBE2",
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 7,
        marginVertical: 5,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: "600", color: ui.accent }}>
        {activityLabels[value]}
      </Text>
    </View>
  );
}
