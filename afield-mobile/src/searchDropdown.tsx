import React, { createContext, useContext } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { ui } from "./theme";
export type SearchAnchor = React.RefObject<View | null>;
export const SearchVisibility = createContext<
  (anchor: SearchAnchor, height: number) => void
>(() => {});
export function useSearchVisibility() {
  return useContext(SearchVisibility);
}
export function SearchDropdown({
  children,
  count,
  label = "검색 결과",
  maxHeight = 200,
  anchor,
}: {
  children: React.ReactNode;
  count: number;
  label?: string;
  maxHeight?: number;
  anchor?: SearchAnchor;
}) {
  const reveal = useSearchVisibility();
  return (
    <View
      testID="inline-search-dropdown"
      style={styles.panel}
      onLayout={(e) => {
        if (anchor) reveal(anchor, e.nativeEvent.layout.height);
      }}
    >
      <Text style={styles.caption}>
        {label} {count}
      </Text>
      <ScrollView
        nestedScrollEnabled
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        style={{ maxHeight }}
      >
        {children}
      </ScrollView>
    </View>
  );
}
export const searchStyles = StyleSheet.create({
  row: {
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.line,
  },
  name: { fontSize: 16, lineHeight: 22, fontWeight: "600", color: ui.ink },
  detail: { fontSize: 13, lineHeight: 19, color: ui.muted, marginTop: 3 },
  code: { fontSize: 16, fontWeight: "700", color: ui.ink },
  chevron: { fontSize: 24, color: ui.muted },
});
const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 12,
    backgroundColor: ui.surface,
    borderColor: "#D5D8DE",
    borderWidth: 1,
    borderRadius: 12,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    overflow: "hidden",
  },
  caption: {
    fontSize: 12,
    fontWeight: "500",
    color: ui.muted,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
});
