import React, { useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { Field, Label, Action } from "./ui";
import { searchCities, findCity } from "./cities";
import { dayISO, monthCells } from "./calendar";
import { ui } from "./theme";
export function CitySearch({
  value,
  country,
  onChange,
}: {
  value: string;
  country: string;
  onChange: (city: string, country: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const results = focused ? searchCities(value) : [];
  return (
    <View>
      <Label>도시 검색</Label>
      <Field
        accessibilityLabel="도시"
        placeholder="도시 검색 · 파리, Paris, 도쿄…"
        value={value}
        maxLength={60}
        onFocus={() => setFocused(true)}
        onChangeText={(text) => {
          onChange(text, findCity(text)?.country || "");
          setFocused(true);
        }}
      />
      {!!results.length && (
        <View style={styles.results}>
          {results.map((city) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${city.name}, ${city.country} 선택`}
              key={city.id}
              onPress={() => {
                onChange(city.name, city.country);
                setFocused(false);
              }}
              style={styles.result}
            >
              <Text style={styles.main}>{city.name}</Text>
              <Text style={styles.small}>
                {city.country} · {city.aliases[0]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {focused && value.trim() && !results.length && (
        <Text style={styles.help}>
          검색 결과가 없어요. 도시 이름과 국가를 직접 입력해도 만들 수 있어요.
        </Text>
      )}
      {focused && value.trim() && !results.length && (
        <Field
          accessibilityLabel="국가 직접 입력"
          placeholder="국가 · 예: Australia"
          value={country}
          onChangeText={(text) => onChange(value, text)}
        />
      )}
      <Text style={styles.help}>
        {country
          ? `국가 · ${country}`
          : "한글·영문으로 검색하고 도시를 선택해 주세요."}
      </Text>
      <Text style={{ fontSize: 12, color: ui.muted, marginBottom: 12 }}>
        도시 데이터 · GeoNames (CC BY 4.0)
      </Text>
    </View>
  );
}
export function DateField({
  label,
  value,
  onChange,
  minimum,
  initial,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  minimum?: string;
  initial?: string;
}) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [month, setMonth] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  function show() {
    const seed = value || initial || minimum;
    const d = seed ? new Date(seed + "T12:00:00") : now;
    setMonth({ year: d.getFullYear(), month: d.getMonth() });
    setOpen(true);
  }
  function move(delta: number) {
    const d = new Date(month.year, month.month + delta, 1);
    if (d.getFullYear() < 100 || d.getFullYear() > 9999) return;
    setMonth({ year: d.getFullYear(), month: d.getMonth() });
  }
  return (
    <View style={{ flex: 1 }}>
      <Label>{label}</Label>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} 달력 열기`}
        onPress={show}
        style={styles.date}
      >
        <Text style={{ fontSize: 16, color: value ? ui.ink : ui.muted }}>
          {value ? value.replaceAll("-", ". ") : "날짜 선택"}
        </Text>
        <Text style={{ fontSize: 18, color: ui.accent }}>▦</Text>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.scrim}>
          <View accessibilityViewIsModal style={styles.sheet}>
            <View style={styles.header}>
              <Text style={{ fontSize: 20, fontWeight: "700", color: ui.ink }}>
                {label} 선택
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="달력 닫기"
                onPress={() => setOpen(false)}
                style={styles.nav}
              >
                <Text style={styles.main}>닫기</Text>
              </Pressable>
            </View>
            <View style={styles.header}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="이전 해"
                onPress={() => move(-12)}
                style={styles.nav}
              >
                <Text style={styles.main}>«</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="이전 달"
                onPress={() => move(-1)}
                style={styles.nav}
              >
                <Text style={styles.main}>‹</Text>
              </Pressable>
              <Text style={styles.month}>
                {month.year}년 {month.month + 1}월
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="다음 달"
                onPress={() => move(1)}
                style={styles.nav}
              >
                <Text style={styles.main}>›</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="다음 해"
                onPress={() => move(12)}
                style={styles.nav}
              >
                <Text style={styles.main}>»</Text>
              </Pressable>
            </View>
            <View style={styles.grid}>
              {["일", "월", "화", "수", "목", "금", "토"].map((x) => (
                <View key={x} style={styles.cell}>
                  <Text style={styles.small}>{x}</Text>
                </View>
              ))}
              {monthCells(month.year, month.month).map((date, i) =>
                date ? (
                  <Pressable
                    key={date}
                    accessibilityRole="button"
                    accessibilityLabel={date}
                    accessibilityState={{
                      selected: date === value,
                      disabled: !!minimum && date < minimum,
                    }}
                    disabled={!!minimum && date < minimum}
                    onPress={() => {
                      onChange(date);
                      setOpen(false);
                    }}
                    style={[
                      styles.cell,
                      date === value && {
                        backgroundColor: ui.accent,
                        borderRadius: 12,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 17,
                        fontWeight: "500",
                        color:
                          minimum && date < minimum
                            ? "#B5B9B0"
                            : date === value
                              ? "white"
                              : ui.ink,
                      }}
                    >
                      {Number(date.slice(8))}
                    </Text>
                  </Pressable>
                ) : (
                  <View key={"blank" + i} style={styles.cell} />
                ),
              )}
            </View>
            <Action
              title="오늘로 이동"
              secondary
              onPress={() => {
                const d = new Date();
                setMonth({ year: d.getFullYear(), month: d.getMonth() });
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
export function TripDates({
  start,
  end,
  onStart,
  onEnd,
}: {
  start: string;
  end: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
}) {
  return (
    <View style={{ marginVertical: 12 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <DateField
          label="시작일"
          value={start}
          initial={end}
          onChange={onStart}
        />
        <DateField
          label="종료일"
          value={end}
          initial={start}
          minimum={start}
          onChange={onEnd}
        />
      </View>
      {!!(start || end) && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onStart("");
            onEnd("");
          }}
          style={{
            minHeight: 44,
            justifyContent: "center",
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ fontSize: 14, color: ui.muted }}>
            날짜 미정으로 두기
          </Text>
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  results: {
    borderWidth: 1,
    borderColor: ui.line,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: ui.surface,
    marginBottom: 10,
  },
  result: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: ui.line,
    minHeight: 54,
  },
  main: { fontSize: 16, color: ui.ink, fontWeight: "600" },
  small: { fontSize: 15, color: ui.muted, marginTop: 3 },
  help: { fontSize: 15, lineHeight: 23, color: ui.muted, marginBottom: 10 },
  date: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 5,
    padding: 12,
    borderWidth: 1,
    borderColor: ui.line,
    borderRadius: 12,
    minHeight: 52,
    backgroundColor: ui.surface,
    alignItems: "center",
  },
  scrim: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: ui.bg,
    padding: 18,
    paddingBottom: 36,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 3,
    marginBottom: 12,
  },
  nav: {
    minHeight: 44,
    minWidth: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  month: { fontSize: 18, fontWeight: "600", color: ui.ink },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: "14.2857%",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 2,
  },
});
