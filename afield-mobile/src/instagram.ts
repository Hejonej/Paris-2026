import { places } from "./data";
import type {
  Trip,
  InspirationPost,
  ExtractedCandidate,
  ImportedPlace,
} from "./data";
export type ImportCollection = { name: string; posts: InspirationPost[] };
export const categories = [
  "맛집·카페",
  "쇼핑",
  "전시·공연",
  "숙소",
  "동네",
  "영감",
  "기타",
];
const clean = (x: unknown) =>
  typeof x === "string" ? repairText(x).trim() : "";
export function repairText(v: string): string {
  return v.replace(
    /(?:[\u00c2-\u00df][\u0080-\u00bf]|[\u00e0-\u00ef][\u0080-\u00bf]{2}|[\u00f0-\u00f4][\u0080-\u00bf]{3})+/g,
    (fragment) => {
      try {
        return decodeURIComponent(
          [...fragment]
            .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
            .join(""),
        );
      } catch {
        return fragment;
      }
    },
  );
}
export function instagramUrl(v: unknown): string {
  if (typeof v !== "string") return "";
  try {
    const u = new URL(
      v
        .trim()
        .replace(/^www\.instagram\.com\//i, "https://www.instagram.com/")
        .replace(/^instagram\.com\//i, "https://instagram.com/"),
    );
    if (
      !["www.instagram.com", "instagram.com", "m.instagram.com"].includes(
        u.hostname.toLowerCase(),
      ) ||
      !["http:", "https:"].includes(u.protocol)
    )
      return "";
    const match = u.pathname.match(
      /^\/(?:[A-Za-z0-9._]+\/)?(p|reel|tv)\/([A-Za-z0-9_-]+)\/?$/,
    );
    return match ? `https://www.instagram.com/${match[1]}/${match[2]}/` : "";
  } catch {
    return "";
  }
}
export function stableId(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
const key = (s: string) =>
  s
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
export function guessCategory(text: string): string {
  if (/hotel|airbnb|숙소|호텔|hostel/i.test(text)) return "숙소";
  if (/museum|gallery|exhibition|concert|미술관|박물관|전시|공연/i.test(text))
    return "전시·공연";
  if (/restaurant|caf[eé]|coffee|bakery|food|맛집|카페|빵|식당/i.test(text))
    return "맛집·카페";
  if (/shop|store|vintage|쇼핑|빈티지|서점/i.test(text)) return "쇼핑";
  if (/marais|district|neighborhood|quartier|동네|지역|거리/i.test(text))
    return "동네";
  return "영감";
}
export function extractCandidates(caption: string): ExtractedCandidate[] {
  const out: ExtractedCandidate[] = [];
  const seen = new Set<string>();
  const add = (name: string, kind: ExtractedCandidate["kind"]) => {
    name = name
      .replace(/https?:\/\/\S+|#[^\s]+/g, " ")
      .replace(/^[\s•·→>\-\d.)]+|[\s•·→>\-]+$/g, "")
      .trim();
    const k = key(name);
    if (
      k.length < 2 ||
      name.length > 90 ||
      /^(follow|save|saved|저장|공유|광고|협찬|여행코스|추천|day\s*\d)/i.test(
        name,
      )
    )
      return;
    if (seen.has(k)) {
      const old = out.find((c) => key(c.name) === k);
      if (old && old.kind === "mention" && kind === "caption") {
        old.name = name;
        old.kind = "caption";
        old.confidence = "medium";
      }
      return;
    }
    seen.add(k);
    out.push({
      id: "candidate-" + stableId(k),
      name,
      kind,
      confidence: kind === "mention" ? "high" : "medium",
    });
  };
  for (const mention of caption.match(/@[A-Za-z0-9._]{3,}/g) || [])
    add(mention.slice(1), "mention");
  for (const line of caption.split(/\n|→|->|[•]/))
    if (!/^https?:\/\//.test(line.trim()))
      add(line.replace(/@[A-Za-z0-9._]+/g, ""), "caption");
  return out;
}
type Obj = Record<string, any>;
function objects(raw: unknown): { value: Obj; ancestors: Obj[] }[] {
  const result: { value: Obj; ancestors: Obj[] }[] = [];
  const pending: { v: unknown; a: Obj[]; depth: number }[] = [
    { v: raw, a: [], depth: 0 },
  ];
  let visited = 0;
  while (pending.length) {
    const { v, a, depth } = pending.pop()!;
    if (++visited > 250000 || depth > 80)
      throw Error(
        "파일 구조가 너무 커요. 컬렉션별 JSON 파일로 나누어 가져와 주세요.",
      );
    if (Array.isArray(v)) {
      for (let i = v.length - 1; i >= 0; i--)
        pending.push({ v: v[i], a, depth: depth + 1 });
    } else if (v && typeof v === "object") {
      const value = v as Obj;
      result.push({ value, ancestors: a });
      const entries = Object.values(value);
      for (let i = entries.length - 1; i >= 0; i--)
        if (entries[i] && typeof entries[i] === "object")
          pending.push({ v: entries[i], a: [...a, value], depth: depth + 1 });
    }
  }
  return result;
}
function lv(node: Obj, labels: string[]): string {
  const list = Array.isArray(node.label_values)
    ? node.label_values
    : Array.isArray(node.dict)
      ? node.dict
      : [];
  for (const x of list)
    if (x && labels.includes(clean(x.label).toLowerCase()))
      return clean(x.value) || clean(x.href);
  return "";
}
function collectionName(n: Obj): string {
  return (
    clean(n.collection_name) ||
    clean(n.collectionName) ||
    lv(n, ["이름", "name"]) ||
    (Array.isArray(n.posts) || Array.isArray(n.items) || Array.isArray(n.saved)
      ? clean(n.title) || clean(n.name)
      : "")
  );
}
export function parseInstagram(text: string): ImportCollection[] {
  if (text.length > 25 * 1024 * 1024)
    throw Error(
      "25MB 이하 JSON 파일을 선택해 주세요. 큰 파일은 컬렉션별로 나누어 주세요.",
    );
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw Error(
      "JSON 파일을 읽지 못했어요. Instagram에서 받은 JSON 파일인지 확인해 주세요.",
    );
  }
  const nodes = objects(raw);
  const groups = new Map<string, Map<string, InspirationPost>>();
  for (const { value: n, ancestors } of nodes) {
    const directLists = [
      ...(Array.isArray(n.string_list_data) ? n.string_list_data : []),
      ...(Array.isArray(n.label_values) ? n.label_values : []),
      ...(Array.isArray(n.dict) ? n.dict : []),
    ].filter((x) => x && typeof x === "object");
    const strings = [
      n.source,
      n.value,
      n.text,
      n.uri,
      n.post_url,
      n.permalink,
      n.url,
      n.href,
      n.link,
      ...directLists.flatMap((x) => [x.href, x.value]),
    ];
    let url = strings.map(instagramUrl).find(Boolean) || "";
    const sm =
      n.string_map_data && typeof n.string_map_data === "object"
        ? n.string_map_data
        : {};
    if (!url)
      url =
        Object.values(sm)
          .map((v: any) => instagramUrl(v?.href) || instagramUrl(v?.value))
          .find(Boolean) || "";
    if (!url) continue;
    // Bare URL child nodes are handled by their post container, preserving its caption and collection.
    if (
      !Array.isArray(n.dict) &&
      !Array.isArray(n.label_values) &&
      !Array.isArray(n.string_list_data) &&
      !n.string_map_data &&
      ancestors.some(
        (a) =>
          (Array.isArray(a.string_list_data) &&
            a.string_list_data.includes(n)) ||
          (Array.isArray(a.label_values) && a.label_values.includes(n)) ||
          (Array.isArray(a.dict) && a.dict.includes(n)) ||
          (a.string_map_data && Object.values(a.string_map_data).includes(n)),
      )
    )
      continue;
    const caption =
      clean(n.caption) ||
      clean(n.why) ||
      clean(n.reason) ||
      clean(n.note) ||
      lv(n, ["캡션", "caption", "설명", "description"]) ||
      clean(sm.Caption?.value) ||
      clean(sm["캡션"]?.value);
    const owner = clean(n.owner) || lv(n, ["이름", "name"]);
    const username = clean(n.username) || lv(n, ["사용자 이름", "username"]);
    const name =
      lv(n, ["제목", "title"]) ||
      clean(n.title) ||
      clean(n.name) ||
      owner ||
      (username ? "@" + username : "") ||
      caption.split("\n")[0]?.slice(0, 80) ||
      "Instagram 저장 게시물";
    const collection =
      clean(n.collection) ||
      clean(n.collection_name) ||
      [...ancestors].reverse().map(collectionName).find(Boolean) ||
      "저장한 게시물";
    const post: InspirationPost = {
      id:
        "ig-" +
        stableId(url) +
        "-" +
        url.split("/").filter(Boolean).slice(-2).join("-"),
      name: name.slice(0, 200),
      url,
      caption,
      owner,
      username,
      collection,
      category: guessCategory(name + " " + caption),
      candidates: extractCandidates(caption),
    };
    if (!groups.has(collection)) groups.set(collection, new Map());
    const group = groups.get(collection)!;
    const previous = group.get(url);
    if (!previous || post.caption.length > previous.caption.length)
      group.set(url, post);
  }
  const result = [...groups].map(([name, posts]) => ({
    name,
    posts: [...posts.values()],
  }));
  if (!result.length) {
    const keys =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? Object.keys(raw)
            .slice(0, 6)
            .map((k) => k.slice(0, 40))
            .join(", ")
        : Array.isArray(raw)
          ? "배열"
          : typeof raw;
    const hasInstagram = nodes.some(({ value }) =>
      Object.values(value).some(
        (v) => typeof v === "string" && /instagram\.com/i.test(v),
      ),
    );
    throw Error(
      (hasInstagram
        ? "Instagram 관련 내용은 있지만 가져올 수 있는 게시물 링크 형식을 찾지 못했어요."
        : "이 파일에서 Instagram 게시물 링크를 찾지 못했어요. 컬렉션 이름만 든 목록이거나 저장 항목이 아닌 파일일 수 있어요.") +
        " 압축을 푼 폴더에서 저장한 게시물 JSON(예: saved_posts.json, saved_collections.json)을 선택해 주세요. 파일 이름은 버전에 따라 달라요. 가이드에서 저장 항목을 포함해 JSON으로 다시 요청하는 방법을 확인할 수 있어요. 진단 정보: " +
        keys,
    );
  }
  return result;
}
export function importPosts(
  trips: Trip[],
  tripId: string,
  posts: InspirationPost[],
) {
  const trip = trips.find((t) => t.id === tripId);
  const fail = (message: string) => ({ trips, ok: false, message });
  if (!trip) return fail("여행을 찾을 수 없어요.");
  const old = trip.inspirations || [];
  const seen = new Set(old.map((p) => p.url));
  const added: InspirationPost[] = [];
  for (const p of posts) {
    const url = instagramUrl(p.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    added.push({
      ...p,
      id:
        "ig-" +
        stableId(url) +
        "-" +
        url.split("/").filter(Boolean).slice(-2).join("-"),
      url,
    });
  }
  if (!added.length)
    return fail(
      "새로 가져올 게시물이 없어요. 이미 저장한 항목인지 확인해 주세요.",
    );
  return {
    ok: true,
    message: `${added.length}개 게시물을 가져왔어요.`,
    trips: trips.map((t) =>
      t.id === tripId ? { ...t, inspirations: [...old, ...added] } : t,
    ),
  };
}
export function confirmCandidates(
  trips: Trip[],
  tripId: string,
  selections: { postId: string; candidateId: string }[],
) {
  const trip = trips.find((t) => t.id === tripId);
  const fail = (message: string) => ({ trips, ok: false, message });
  if (!trip) return fail("여행을 찾을 수 없어요.");
  const custom = [...(trip.importedPlaces || [])];
  const ids = [...trip.candidates];
  let added = 0;
  let linked = 0;
  const placeIds: string[] = [];
  for (const selection of selections) {
    const post = trip.inspirations?.find((p) => p.id === selection.postId);
    const candidate = post?.candidates.find(
      (c) => c.id === selection.candidateId,
    );
    if (!post || !candidate) continue;
    const existing = custom.find((p) => key(p.name) === key(candidate.name));
    if (existing) {
      if (!placeIds.includes(existing.id)) placeIds.push(existing.id);
      if (!existing.sourcePostIds.includes(post.id)) {
        custom[custom.indexOf(existing)] = {
          ...existing,
          sourcePostIds: [...existing.sourcePostIds, post.id],
        };
        linked++;
      }
      continue;
    }
    let id =
      places.find((p) => key(p.name) === key(candidate.name))?.id ||
      "imported-" + stableId(tripId + "|" + key(candidate.name));
    while (custom.some((p) => p.id === id)) id += "x";
    const place: ImportedPlace = {
      id,
      name: candidate.name,
      category: post.category,
      area: trip.city,
      description:
        "게시물에서 고른 장소예요. 지도에서 방문할 지점이 맞는지 확인해 주세요.",
      image: "",
      query: candidate.name + " " + trip.city,
      sourcePostIds: [post.id],
      matchStatus: "needs_confirmation",
    };
    custom.push(place);
    placeIds.push(id);
    if (!ids.includes(id)) ids.push(id);
    added++;
  }
  if (!added && !linked) return fail("추가할 새 장소 후보가 없어요.");
  return {
    ok: true,
    placeIds,
    message: `${added}개 장소 후보를 추가했어요.${linked ? ` ${linked}개 출처를 연결했어요.` : ""}`,
    trips: trips.map((t) =>
      t.id === tripId ? { ...t, importedPlaces: custom, candidates: ids } : t,
    ),
  };
}
export function updateImportedPlace(
  trips: Trip[],
  tripId: string,
  placeId: string,
  update: {
    name: string;
    query: string;
    address: string;
    googlePlaceId?: string;
  },
) {
  const trip = trips.find((t) => t.id === tripId);
  const place = trip?.importedPlaces?.find((p) => p.id === placeId);
  if (!trip || !place)
    return { trips, ok: false, message: "장소를 찾을 수 없어요." };
  if (
    update.name.length > 300 ||
    update.query.length > 1000 ||
    update.address.length > 1000
  )
    return { trips, ok: false, message: "장소 이름이나 주소가 너무 길어요." };
  if (!update.name.trim() || !update.query.trim())
    return { trips, ok: false, message: "장소 이름과 위치를 입력해 주세요." };
  return {
    ok: true,
    message: "장소 위치를 확인했어요. 일정 배치는 별도로 선택해 주세요.",
    trips: trips.map((t) =>
      t.id === tripId
        ? {
            ...t,
            importedPlaces: t.importedPlaces!.map((p) =>
              p.id === placeId
                ? {
                    ...p,
                    ...update,
                    name: update.name.trim(),
                    query: update.query.trim(),
                    matchStatus: "confirmed" as const,
                  }
                : p,
            ),
          }
        : t,
    ),
  };
}
export function addManualCandidate(
  trips: Trip[],
  tripId: string,
  postId: string,
  name: string,
) {
  name = name.trim();
  const trip = trips.find((t) => t.id === tripId);
  const post = trip?.inspirations?.find((p) => p.id === postId);
  const fail = (message: string) => ({ trips, ok: false, message });
  if (!post) return fail("게시물을 찾을 수 없어요.");
  if (name.length < 2 || name.length > 90)
    return fail("장소 이름은 2~90자로 입력해 주세요.");
  if (post.candidates.some((c) => key(c.name) === key(name)))
    return fail("이미 있는 장소 후보예요.");
  const candidate: ExtractedCandidate = {
    id: "candidate-" + stableId(key(name)),
    name,
    kind: "manual",
    confidence: "medium",
  };
  return {
    ok: true,
    candidateId: candidate.id,
    message: "게시물에 장소 후보를 추가했어요.",
    trips: trips.map((t) =>
      t.id === tripId
        ? {
            ...t,
            inspirations: t.inspirations!.map((p) =>
              p.id === postId
                ? { ...p, candidates: [...p.candidates, candidate] }
                : p,
            ),
          }
        : t,
    ),
  };
}
