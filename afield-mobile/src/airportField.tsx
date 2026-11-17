import React, { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, Keyboard } from "react-native";
import { Field, P } from "./ui";
import { ui } from "./theme";
import { airports, searchAirports } from "./airports";
import {
  SearchDropdown,
  searchStyles,
  useSearchVisibility,
} from "./searchDropdown";
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
  const anchor = useRef<View>(null);
  const reveal = useSearchVisibility();
  const blur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chosen = airports.find(
    (a) =>
      value === `${a[2]} · ${a[0]}` || value === `${a[2]} · ${a[0]} · ${a[1]}`,
  );
  const hits = chosen ? [chosen] : searchAirports(value);
  useEffect(() => {
    if (open && hits.length)
      reveal(anchor, Math.min(hits.length * 72, 200) + 36);
  }, [open, value]);
  useEffect(
    () => () => {
      if (blur.current) clearTimeout(blur.current);
    },
    [],
  );
  return (
    <View style={{ marginBottom: 16, zIndex: open ? 100 : 0 }}>
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
      <View ref={anchor} collapsable={false} style={{ zIndex: 100 }}>
        <Field
          accessibilityLabel={label}
          value={chosen && !open ? `${chosen[2]} · ${chosen[0]}` : value}
          placeholder="도시·공항 이름·코드 (도쿄 / Tokyo / HND)"
          style={
            open
              ? { borderColor: ui.blue, borderWidth: 2, marginBottom: 0 }
              : { marginBottom: 0 }
          }
          onChangeText={(v) => {
            onChange(v);
            setOpen(true);
          }}
          onFocus={() => {
            if (blur.current) clearTimeout(blur.current);
            setOpen(true);
          }}
          onBlur={() => {
            blur.current = setTimeout(() => setOpen(false), 150);
          }}
          maxLength={160}
        />
        {open && !!hits.length && (
          <SearchDropdown count={hits.length}>
            {hits.map((a) => (
              <Pressable
                key={a[0]}
                accessibilityRole="button"
                accessibilityLabel={`${label}: ${a[2]} ${a[0]}`}
                onPress={() => {
                  onChange(`${a[2]} · ${a[0]}`);
                  setOpen(false);
                  Keyboard?.dismiss();
                }}
                style={({ pressed }) => [
                  searchStyles.row,
                  pressed && { backgroundColor: ui.blueSoft },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={searchStyles.name}>{a[2]}</Text>
                  <Text style={searchStyles.detail}>
                    {a[3]} · {a[5]}
                  </Text>
                </View>
                <Text style={searchStyles.code}>{a[0]}</Text>
                <Text style={searchStyles.chevron}>›</Text>
              </Pressable>
            ))}
          </SearchDropdown>
        )}
      </View>
      {open && !!value.trim() && !hits.length && (
        <P>목록에 없으면 공항 이름과 도시를 직접 입력해도 돼요.</P>
      )}
    </View>
  );
}
