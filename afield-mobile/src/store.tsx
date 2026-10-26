import {
  savePlanning,
  applyDraft,
  validConditions,
  validDraft,
  planningSnapshot,
} from "./planner";
import type { PlanningConditions, PlanDraft } from "./planner";
import { setEntryTag } from "./activities";
import type { ActivityTag } from "./data";
import {
  importPosts,
  confirmCandidates,
  updateImportedPlace,
  addManualCandidate,
} from "./instagram";
import type { InspirationPost } from "./data";
import { bindEntryLocation, setLegMode } from "./routing";
import type { EntryLocation, TravelMode } from "./data";
import { editTrip, TripDetails } from "./tripEditing";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { addCandidate, addToPlan } from "./planning";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Trip, trips, makeDays, places, tripPlaces } from "./data";
type Result = {
  ok: boolean;
  message: string;
  placeIds?: string[];
  candidateId?: string;
};
type Store = {
  trips: Trip[];
  deletedTrips: Trip[];
  deleteTrip: (id: string) => Result;
  deleteTrips: (ids: string[]) => Result;
  restoreTrip: (id: string) => Result;
  savePlanning: (id: string, conditions: PlanningConditions) => Result;
  saveDraft: (id: string, draft: PlanDraft) => Result;
  applyDraft: (id: string, selected: string[]) => Result;
  addManualPlace: (
    id: string,
    name: string,
    query: string,
    category: string,
  ) => Result;
  ready: boolean;
  loadFailed: boolean;
  error: string;
  create: (
    name: string,
    city: string,
    start: string,
    end: string,
    country?: string,
  ) => string;
  importInstagram: (tripId: string, posts: InspirationPost[]) => Result;
  addInspirationCandidate: (
    tripId: string,
    postId: string,
    name: string,
  ) => Result;
  confirmInstagram: (
    tripId: string,
    selections: { postId: string; candidateId: string }[],
  ) => Result;
  confirmPlace: (
    tripId: string,
    placeId: string,
    update: {
      name: string;
      query: string;
      address: string;
      googlePlaceId?: string;
    },
  ) => Result;
  edit: (tripId: string, details: TripDetails) => Result;
  setTag: (
    tripId: string,
    date: string,
    entryId: string,
    tag: ActivityTag,
    customTag?: string,
  ) => Result;
  bindLocation: (
    tripId: string,
    date: string,
    entryId: string,
    location: EntryLocation,
  ) => Result;
  setMode: (
    tripId: string,
    date: string,
    fromId: string,
    toId: string,
    mode: TravelMode,
  ) => Result;
  saveCandidate: (tripId: string, placeId: string) => Result;
  place: (
    tripId: string,
    placeId: string,
    name: string,
    date: string,
    time: string,
  ) => Result;
};
const Context = createContext<Store | null>(null);
const KEY = "afield:sprint2:trips:v1";
export function TripProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Trip[]>(trips);
  const current = useRef(list);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (
            !Array.isArray(parsed) ||
            !parsed.every(
              (t) =>
                typeof t.id === "string" &&
                typeof t.name === "string" &&
                typeof t.city === "string" &&
                (t.planning === undefined || validConditions(t.planning)) &&
                (t.planDraft === undefined || validDraft(t.planDraft)) &&
                (t.deletedAt === undefined ||
                  typeof t.deletedAt === "string") &&
                typeof t.start === "string" &&
                typeof t.end === "string" &&
                (t.country === undefined || typeof t.country === "string") &&
                (t.inspirations === undefined ||
                  (Array.isArray(t.inspirations) &&
                    t.inspirations.every(
                      (p: any) =>
                        p &&
                        typeof p.id === "string" &&
                        typeof p.name === "string" &&
                        typeof p.url === "string" &&
                        typeof p.caption === "string" &&
                        typeof p.category === "string" &&
                        typeof p.collection === "string" &&
                        typeof p.owner === "string" &&
                        typeof p.username === "string" &&
                        Array.isArray(p.candidates) &&
                        p.candidates.every(
                          (c: any) =>
                            c &&
                            typeof c.id === "string" &&
                            typeof c.name === "string" &&
                            ["mention", "caption", "manual"].includes(c.kind) &&
                            ["high", "medium"].includes(c.confidence),
                        ),
                    ))) &&
                (t.importedPlaces === undefined ||
                  (Array.isArray(t.importedPlaces) &&
                    t.importedPlaces.every(
                      (p: any) =>
                        p &&
                        typeof p.id === "string" &&
                        typeof p.name === "string" &&
                        typeof p.query === "string" &&
                        typeof p.image === "string" &&
                        typeof p.area === "string" &&
                        typeof p.category === "string" &&
                        typeof p.description === "string" &&
                        ["needs_confirmation", "confirmed"].includes(
                          p.matchStatus,
                        ) &&
                        Array.isArray(p.sourcePostIds) &&
                        p.sourcePostIds.every(
                          (id: any) => typeof id === "string",
                        ),
                    ))) &&
                Array.isArray(t.candidates) &&
                t.candidates.every((x: unknown) => typeof x === "string") &&
                Array.isArray(t.days) &&
                t.days.every(
                  (d: any) =>
                    typeof d.date === "string" &&
                    (d.travelModes === undefined ||
                      (d.travelModes &&
                        typeof d.travelModes === "object" &&
                        !Array.isArray(d.travelModes) &&
                        Object.values(d.travelModes).every((m) =>
                          ["walking", "transit", "driving"].includes(String(m)),
                        ))) &&
                    Array.isArray(d.items) &&
                    d.items.every(
                      (x: any) =>
                        typeof x.id === "string" &&
                        typeof x.name === "string" &&
                        typeof x.time === "string" &&
                        (x.origin === undefined || x.origin === "ai") &&
                        (x.anchorKey === undefined ||
                          typeof x.anchorKey === "string") &&
                        (x.durationMinutes === undefined ||
                          (Number.isInteger(x.durationMinutes) &&
                            x.durationMinutes > 0 &&
                            x.durationMinutes <= 1440)) &&
                        (x.customTag === undefined ||
                          (typeof x.customTag === "string" &&
                            x.customTag.trim().length > 0 &&
                            x.customTag.length <= 20)) &&
                        (x.tag === undefined ||
                          [
                            "shopping",
                            "sightseeing",
                            "meal",
                            "cafe",
                            "stay",
                            "transport",
                            "other",
                          ].includes(x.tag)) &&
                        (x.location === undefined ||
                          (x.location &&
                            typeof x.location.label === "string" &&
                            typeof x.location.query === "string" &&
                            typeof x.location.description === "string" &&
                            (x.location.placeId === undefined ||
                              typeof x.location.placeId === "string"))),
                    ),
                ),
            )
          )
            throw Error("invalid");
          current.current = parsed;
          setList(parsed);
        }
      })
      .catch(() => {
        setLoadFailed(true);
        setError(
          "저장된 여행을 불러오지 못했어요. 기존 데이터를 보호하기 위해 변경을 멈췄어요. 앱을 완전히 닫았다가 다시 열어 주세요.",
        );
      })
      .finally(() => setReady(true));
  }, []);
  function update(next: Trip[]) {
    current.current = next;
    setList(next);
    queue.current = queue.current
      .then(() => AsyncStorage.setItem(KEY, JSON.stringify(next)))
      .then(() => setError(""))
      .catch(() =>
        setError(
          "기기에 저장하지 못했어요. 현재 화면의 변경은 앱을 닫으면 사라질 수 있어요.",
        ),
      );
  }
  function trash(ids: string[]): Result {
    const selected = new Set(ids);
    if (
      !selected.size ||
      [...selected].some(
        (id) => !current.current.some((t) => t.id === id && !t.deletedAt),
      )
    )
      return { ok: false, message: "삭제할 챕터를 다시 선택해 주세요." };
    const deletedAt = new Date().toISOString();
    update(
      current.current.map((t) =>
        selected.has(t.id) ? { ...t, deletedAt } : t,
      ),
    );
    return {
      ok: true,
      message: `${selected.size}개 챕터를 삭제했어요. ‘삭제한 챕터’에서 복원할 수 있어요.`,
    };
  }
  const value: Store = {
    trips: list.filter((t) => !t.deletedAt),
    deletedTrips: list.filter((t) => !!t.deletedAt),
    deleteTrip: (id) => trash([id]),
    deleteTrips: trash,
    restoreTrip: (id) => {
      if (!current.current.some((t) => t.id === id && t.deletedAt))
        return { ok: false, message: "복원할 챕터를 찾을 수 없어요." };
      update(
        current.current.map((t) =>
          t.id === id ? { ...t, deletedAt: undefined } : t,
        ),
      );
      return { ok: true, message: "챕터를 복원했어요." };
    },
    savePlanning: (id, c) => {
      const r = savePlanning(current.current, id, c);
      if (r.ok) update(r.trips);
      return { ok: r.ok, message: r.message };
    },
    saveDraft: (id, draft) => {
      const t = current.current.find((t) => t.id === id && !t.deletedAt);
      if (
        !t ||
        !validDraft(draft) ||
        planningSnapshot(t) !== draft.baseSnapshot
      )
        return {
          ok: false,
          message:
            "일정이나 조건이 바뀌었어요. 최신 조건으로 다시 제안받아 주세요.",
        };
      update(
        current.current.map((t) =>
          t.id === id ? { ...t, planDraft: draft } : t,
        ),
      );
      return { ok: true, message: "검토할 제안을 저장했어요." };
    },
    applyDraft: (id, selected) => {
      const r = applyDraft(current.current, id, selected);
      if (r.ok) update(r.trips);
      return { ok: r.ok, message: r.message };
    },
    addManualPlace: (id, name, query, category) => {
      const t = current.current.find((t) => t.id === id && !t.deletedAt);
      if (
        !t ||
        name.trim().length < 2 ||
        name.trim().length > 80 ||
        !query.trim() ||
        query.length > 300 ||
        category.length > 40
      )
        return {
          ok: false,
          message: "장소 이름과 확인한 주소를 입력해 주세요.",
        };
      if (
        tripPlaces(t).some(
          (p) =>
            t.candidates.includes(p.id) &&
            p.name.trim().toLowerCase() === name.trim().toLowerCase(),
        )
      )
        return {
          ok: false,
          message: "이미 저장한 이름이에요. 저장한 장소에서 확인해 주세요.",
        };
      const placeId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      update(
        current.current.map((t) =>
          t.id === id
            ? {
                ...t,
                candidates: [...t.candidates, placeId],
                importedPlaces: [
                  ...(t.importedPlaces || []),
                  {
                    id: placeId,
                    name: name.trim(),
                    query: query.trim(),
                    address: query.trim(),
                    category,
                    area: t.city,
                    description: "직접 입력하고 위치를 확인한 장소",
                    image: "",
                    sourcePostIds: [],
                    matchStatus: "confirmed",
                  },
                ],
              }
            : t,
        ),
      );
      return { ok: true, message: "장소를 저장했어요.", placeIds: [placeId] };
    },
    ready,
    loadFailed,
    error,
    create: (name, city, start, end, country) => {
      const id =
        "trip-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
      update([
        ...current.current,
        {
          id,
          name,
          city,
          country,
          start,
          end,
          days: makeDays(start, end),
          candidates: [],
        },
      ]);
      return id;
    },
    importInstagram: (id, posts) => {
      const result = importPosts(current.current, id, posts);
      if (result.ok) update(result.trips);
      return { ok: result.ok, message: result.message };
    },
    addInspirationCandidate: (id, postId, name) => {
      const result = addManualCandidate(current.current, id, postId, name);
      if (result.ok) update(result.trips);
      return {
        ok: result.ok,
        message: result.message,
        candidateId: "candidateId" in result ? result.candidateId : undefined,
      };
    },
    confirmInstagram: (id, selections) => {
      const result = confirmCandidates(current.current, id, selections);
      if (result.ok) update(result.trips);
      return {
        ok: result.ok,
        message: result.message,
        placeIds: "placeIds" in result ? result.placeIds : undefined,
      };
    },
    confirmPlace: (id, p, details) => {
      const result = updateImportedPlace(current.current, id, p, details);
      if (result.ok) update(result.trips);
      return { ok: result.ok, message: result.message };
    },
    edit: (id, details) => {
      const result = editTrip(current.current, id, details);
      if (result.ok) update(result.trips);
      return { ok: result.ok, message: result.message };
    },
    setTag: (id, date, entryId, tag, customTag) => {
      const result = setEntryTag(
        current.current,
        id,
        date,
        entryId,
        tag,
        customTag,
      );
      if (result.ok) update(result.trips);
      return { ok: result.ok, message: result.message };
    },
    bindLocation: (id, date, entryId, location) => {
      const result = bindEntryLocation(
        current.current,
        id,
        date,
        entryId,
        location,
      );
      if (result.ok) update(result.trips);
      return { ok: result.ok, message: result.message };
    },
    setMode: (id, date, fromId, toId, mode) => {
      const result = setLegMode(current.current, id, date, fromId, toId, mode);
      if (result.ok) update(result.trips);
      return { ok: result.ok, message: result.message };
    },
    saveCandidate: (id, p) => {
      if (!current.current.some((t) => t.id === id))
        return {
          ok: false,
          message:
            "여행 정보를 찾을 수 없어요. 여행 목록에서 다시 열어 주세요.",
        };
      if (
        !tripPlaces(current.current.find((t) => t.id === id)).some(
          (place) => place.id === p,
        )
      )
        return { ok: false, message: "저장할 장소 정보를 찾을 수 없어요." };
      update(addCandidate(current.current, id, p));
      return {
        ok: true,
        message:
          "가고 싶은 곳에 저장했어요. 하단 ‘가고 싶은 곳’에서 볼 수 있어요. 일정 추가는 별도로 선택해 주세요.",
      };
    },
    place: (id, p, name, date, time) => {
      const trip = current.current.find((t) => t.id === id);
      const target = tripPlaces(trip).find((place) => place.id === p);
      if (!target) return { ok: false, message: "장소를 찾을 수 없어요." };
      if ("matchStatus" in target && target.matchStatus !== "confirmed")
        return { ok: false, message: "실제 장소 위치를 먼저 확인해 주세요." };
      const result = addToPlan(current.current, id, p, target.name, date, time);
      if (result.ok && "matchStatus" in target) {
        result.trips = result.trips.map((t) =>
          t.id === id
            ? {
                ...t,
                days: t.days.map((d) =>
                  d.date === date
                    ? {
                        ...d,
                        items: d.items.map((e) =>
                          e.placeId === p
                            ? {
                                ...e,
                                location: {
                                  label: target.name,
                                  query: target.query,
                                  description: target.description,
                                  placeId: p,
                                },
                              }
                            : e,
                        ),
                      }
                    : d,
                ),
              }
            : t,
        );
      }
      if (result.ok) update(result.trips);
      return { ok: result.ok, message: result.message };
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useTrips() {
  const value = useContext(Context);
  if (!value) throw Error("Missing TripProvider");
  return value;
}
