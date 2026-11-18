import { formatSeconds } from "./duration";
import React, { useEffect, useRef, useState } from "react";
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
}: {
  from: string;
  to: string;
  mode: TravelMode;
  pendingTransit?: boolean;
}) {
  const [fact, setFact] = useState<RouteFact>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    setFact(undefined);
    setError("");
    setBusy(false);
    return () => request.current?.abort();
  }, [from, to, mode]);
  async function load() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      const value = await liveLeg(from, to, mode, controller.signal);
      if (!controller.signal.aborted) setFact(value);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "이동 시간 조회 실패");
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  }
  if (pendingTransit)
    return (
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 14, lineHeight: 21, color: ui.blue }}>
          대중교통 소요시간 미확인
        </Text>
        <Text style={{ fontSize: 12, lineHeight: 18, color: ui.muted }}>
          현재 연결에서 전철·버스 시간이 확인되지 않았어요. Google Maps에서
          경로를 확인해 주세요.
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
          <Text style={{ fontSize: 14, fontWeight: "600", color: ui.ink }}>
            Google Maps · {modeLabels[mode]}{" "}
            {formatSeconds(fact.durationSeconds)} ·{" "}
            {(fact.distanceMeters / 1000).toFixed(2)}km
          </Text>
          <Text style={{ fontSize: 12, lineHeight: 18, color: ui.muted }}>
            조회 시점 기준 ·{" "}
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
          onPress={load}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={{ fontSize: 14, color: ui.blue, fontWeight: "600" }}>
            {busy
              ? "Google 이동 시간 조회 중…"
              : `${modeLabels[mode]} 이동 시간 확인`}
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
