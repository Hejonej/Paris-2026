import type { Trip } from "./data";
// Completion means a source post has at least one linked place in this trip's schedule.
// Saving a candidate or confirming its address alone never completes a post.
export function inspirationProgress(trip?: Trip) {
  const posts = trip?.inspirations || [];
  const scheduledPlaces = new Set(
    trip?.days.flatMap((d) =>
      d.items.flatMap((e) =>
        e.placeId
          ? [e.placeId]
          : e.location?.placeId
            ? [e.location.placeId]
            : [],
      ),
    ) || [],
  );
  const completedPostIds = new Set(
    trip?.importedPlaces
      ?.filter(
        (p) => p.matchStatus === "confirmed" && scheduledPlaces.has(p.id),
      )
      .flatMap((p) => p.sourcePostIds) || [],
  );
  return {
    posts,
    completedPostIds,
    pendingPosts: posts.filter((p) => !completedPostIds.has(p.id)),
  };
}
