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
import { Trip, trips, makeDays, places } from "./data";
type Result = { ok: boolean; message: string };
type Store = {
  trips: Trip[];
  ready: boolean;
  loadFailed: boolean;
  error: string;
  create: (name: string, city: string, start: string, end: string) => string;
  edit: (tripId: string, details: TripDetails) => Result;
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
                typeof t.start === "string" &&
                typeof t.end === "string" &&
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
  const value: Store = {
    trips: list,
    ready,
    loadFailed,
    error,
    create: (name, city, start, end) => {
      const id =
        "trip-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
      update([
        ...current.current,
        {
          id,
          name,
          city,
          start,
          end,
          days: makeDays(start, end),
          candidates: [],
        },
      ]);
      return id;
    },
    edit: (id, details) => {
      const result = editTrip(current.current, id, details);
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
      if (!places.some((place) => place.id === p))
        return { ok: false, message: "저장할 장소 정보를 찾을 수 없어요." };
      update(addCandidate(current.current, id, p));
      return {
        ok: true,
        message: "여행 후보에 담았어요. 후보 탭에서 확인할 수 있어요.",
      };
    },
    place: (id, p, name, date, time) => {
      const result = addToPlan(current.current, id, p, name, date, time);
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
