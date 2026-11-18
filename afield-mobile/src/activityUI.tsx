import React, { useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import type { ActivityTag } from "./data";
import { activityLabels, activityTags } from "./activities";
import { Sheet } from "./sheet";
import { ui } from "./theme";
export function ActivityButton({
  value,
  onChange,
  name,
  customValue,
}: {
  value: ActivityTag;
  onChange: (tag: ActivityTag, customTag?: string) => void;
  customValue?: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(customValue || "");
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name} 분류: ${customValue || activityLabels[value]}`}
        onPress={() => {
          setCustom(customValue || "");
          setOpen(true);
        }}
        style={{
          minHeight: 44,
          maxWidth: 128,
          flexShrink: 0,
          justifyContent: "center",
          alignSelf: "center",
        }}
        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      >
        <View
          style={{
            minHeight: 26,
            justifyContent: "center",
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 7,
            backgroundColor: "#F1F1F1",
          }}
        >
          <Text
            numberOfLines={2}
            style={{ fontSize: 13, fontWeight: "500", color: ui.accent }}
          >
            {customValue || activityLabels[value]} ▾
          </Text>
        </View>
      </Pressable>
      <Sheet
        visible={open}
        title="이 일정은 어떤 시간인가요?"
        onClose={() => setOpen(false)}
      >
        <Text style={{ fontSize: 14, color: ui.muted, marginBottom: 14 }}>
          {name}
        </Text>
        <Text style={{ fontSize: 15, color: ui.ink, marginBottom: 8 }}>
          나만의 태그 · 직접 입력
        </Text>
        <TextInput
          accessibilityLabel="직접 입력할 태그"
          placeholder="예: 빈티지, 야경"
          value={custom}
          onChangeText={setCustom}
          maxLength={20}
          style={{
            minHeight: 48,
            borderWidth: 1,
            borderColor: ui.line,
            padding: 12,
            borderRadius: 10,
            fontSize: 16,
            color: ui.ink,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !custom.trim() }}
          disabled={!custom.trim()}
          onPress={() => {
            onChange(value, custom.trim());
            setOpen(false);
          }}
          style={{
            minHeight: 48,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: custom.trim() ? ui.accent : ui.line,
            borderRadius: 10,
            marginVertical: 10,
          }}
        >
          <Text
            style={{
              color: custom.trim() ? "white" : ui.muted,
              fontSize: 16,
            }}
          >
            내 태그 저장
          </Text>
        </Pressable>
        {activityTags.map((tag) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              selected: !customValue && tag === value,
            }}
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
                color: !customValue && tag === value ? ui.accent : ui.ink,
              }}
            >
              {!customValue && tag === value ? "✓ " : ""}
              {tag === "other" ? "기타" : activityLabels[tag]}
            </Text>
          </Pressable>
        ))}
      </Sheet>
    </>
  );
}

export function ActivityBadge({ value }: { value: ActivityTag }) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: "#F1F1F1",
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 7,
        marginVertical: 5,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: "500", color: ui.accent }}>
        {activityLabels[value]}
      </Text>
    </View>
  );
}
