import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Field, P } from "./ui";
import { ui } from "./theme";
import { searchAirports } from "./airports";
export function AirportField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hits = searchAirports(value);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text
        style={{
          color: ui.ink,
          fontSize: 15,
          fontWeight: "600",
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      <Field
        accessibilityLabel={label}
        value={value}
        placeholder="도시·공항 이름·코드 (도쿄 / Tokyo / HND)"
        onChangeText={(v) => {
          onChange(v);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        maxLength={160}
      />
      {open &&
        hits.map((a) => (
          <Pressable
            key={a[0]}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${a[2]} ${a[0]}`}
            onPress={() => {
              onChange(`${a[2]} · ${a[0]} · ${a[1]}`);
              setOpen(false);
            }}
            style={{
              minHeight: 48,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: ui.line,
            }}
          >
            <Text style={{ fontSize: 16, color: ui.ink }}>
              {a[2]} · {a[0]}
            </Text>
            <Text style={{ fontSize: 13, color: ui.muted }}>
              {a[1]} · {a[3]}
            </Text>
          </Pressable>
        ))}
      {open && !!value.trim() && !hits.length && (
        <P>목록에 없으면 공항 이름과 도시를 직접 입력해도 돼요.</P>
      )}
    </View>
  );
}
