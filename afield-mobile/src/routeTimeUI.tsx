import { formatSeconds } from "./duration";
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Linking } from "react-native";
import type { TravelMode } from "./data";
import type { RouteFact } from "./routeFacts";
import { liveLeg } from "./liveRoutes";
import { modeLabels } from "./routing";
import { ui } from "./theme";
export function RouteTime({
  from,
  to,
  mode,
  pendingTransit = false,
  unavailableTransit = false,
}: {
  from: string;
  to: string;
  mode: TravelMode;
  pendingTransit?: boolean;
  unavailableTransit?: boolean;
}) {
  const [fact, setFact] = useState<RouteFact>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const needsMap = mode === "transit" && (pendingTransit || unavailableTransit);
  useEffect(() => {
    setFact(undefined);
    setError("");
    if (needsMap) {
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    liveLeg(from, to, mode, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setFact(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e && typeof e.message === "string"
              ? e.message
              : "이동 시간을 불러오지 못했어요.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [from, to, mode, needsMap, retry]);
  if (needsMap)
    return (
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 14, lineHeight: 21, color: ui.blue }}>
          대중교통 소요시간 미확인
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            Linking.openURL(
              "https://www.google.com/maps/dir/?api=1&origin=" +
                encodeURIComponent(from) +
                "&destination=" +
                encodeURIComponent(to) +
                "&travelmode=transit",
            ).catch(() => setError("지도를 열지 못했어요."))
          }
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: ui.blue }}>
            Google Maps에서 전철·버스 확인 ↗
          </Text>
        </Pressable>
        {!!error && <Text>{error}</Text>}
      </View>
    );
  return (
    <View style={{ gap: 4 }}>
      {fact ? (
        <>
          <Text style={{ fontSize: 16, fontWeight: "600", color: ui.ink }}>
            {modeLabels[mode]} · {formatSeconds(fact.durationSeconds)} ·{" "}
            {(fact.distanceMeters / 1000).toFixed(2)}km
          </Text>
          <Text style={{ fontSize: 13, lineHeight: 20, color: ui.muted }}>
            Google Maps · 조회 시점 기준 ·{" "}
            {new Date(fact.retrievedAt).toLocaleTimeString("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => setRetry((v) => v + 1)}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={{ fontSize: 14, color: ui.blue, fontWeight: "600" }}>
            {busy
              ? `${modeLabels[mode]} 시간 불러오는 중…`
              : `${modeLabels[mode]} 시간 다시 불러오기`}
          </Text>
        </Pressable>
      )}
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={{ fontSize: 13, lineHeight: 20, color: ui.muted }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
