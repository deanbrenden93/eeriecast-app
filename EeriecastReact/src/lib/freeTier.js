/**
 * Free-tier gating configuration for audiobooks/ebooks and members-only shows.
 *
 * Controls how many chapters/episodes non-premium / non-authenticated users
 * can access before being prompted to subscribe.
 *
 * These defaults are intended to be overridden by a backend admin
 * setting in the future. For now they are hard-coded constants.
 */

import { isAudiobook } from "@/lib/utils";

/** Maximum number of chapters a free user may listen to (audiobook). */
export const FREE_LISTEN_CHAPTER_LIMIT = 3;

/** Maximum number of chapters a free user may read (e-reader). */
export const FREE_READ_CHAPTER_LIMIT = 3;

/** Maximum number of episode favorites a free user may have. */
export const FREE_FAVORITE_LIMIT = 5;

/**
 * How many of a members-only show's oldest episodes are free samples
 * for non-premium users. Does NOT apply to audiobooks (those use
 * chapter-based gating, see FREE_LISTEN_CHAPTER_LIMIT).
 */
export const FREE_MEMBERS_ONLY_SAMPLE_COUNT = 3;

/**
 * Check whether a user can access a given chapter/episode by index.
 * Used for audiobooks/ebooks where the first N chapters are free.
 * @param {number} chapterIndex — 0-based index
 * @param {boolean} isPremium — whether user has an active subscription
 * @param {number} [limit] — override the default limit
 * @returns {boolean}
 */
export function canAccessChapter(chapterIndex, isPremium, limit = FREE_LISTEN_CHAPTER_LIMIT) {
  if (isPremium) return true;
  return chapterIndex < limit;
}

/**
 * For a members-only (exclusive) non-audiobook show, returns the Set of
 * episode IDs that are free samples — i.e. the oldest
 * FREE_MEMBERS_ONLY_SAMPLE_COUNT episodes.
 *
 * Requires `podcast.episodes` to be populated. If it isn't (e.g. a list
 * serializer without episodes), the set is empty and callers should fall
 * back to legacy per-episode checks.
 *
 * Returns an empty set for audiobooks (they use chapter gating) or for
 * non-exclusive shows.
 *
 * @param {Object} podcast
 * @param {number} [count]
 * @returns {Set<number|string>}
 */
export function getExclusiveSampleEpisodeIds(podcast, count = FREE_MEMBERS_ONLY_SAMPLE_COUNT) {
  const ids = new Set();
  if (!podcast?.is_exclusive) return ids;
  if (isAudiobook(podcast)) return ids;

  // Accept both shapes the detail endpoint can return:
  //   { episodes: [...] }                 (fully hydrated)
  //   { episodes: { results: [...] } }    (paginated list serializer)
  // Older code paths only handled the array form, which meant members-only
  // shows coming off a list endpoint silently lost their free samples and
  // gated everything.
  const rawEpisodes = podcast.episodes;
  const episodes = Array.isArray(rawEpisodes)
    ? rawEpisodes
    : Array.isArray(rawEpisodes?.results)
      ? rawEpisodes.results
      : [];
  if (episodes.length === 0) return ids;

  const getDate = (e) =>
    new Date(e?.created_date || e?.published_at || e?.release_date || 0).getTime();

  const sorted = [...episodes].sort((a, b) => getDate(a) - getDate(b));
  const limit = Math.min(sorted.length, Math.max(0, count));
  for (let i = 0; i < limit; i++) {
    const id = sorted[i]?.id;
    if (id != null) ids.add(id);
  }
  return ids;
}

/**
 * For members-only (exclusive) shows, determine whether a given episode
 * is accessible to a non-premium user.
 *
 * Rules:
 *   • Audiobooks: always false here — audiobook gating is per-chapter
 *     (see canAccessChapter); callers should use that instead.
 *   • Non-audiobook exclusive shows: the oldest
 *     FREE_MEMBERS_ONLY_SAMPLE_COUNT episodes are free samples.
 *   • Legacy fallback: if the podcast has no episodes loaded but a single
 *     `free_sample_episode` is assigned, that one episode is considered a
 *     sample. Preserves behavior for older data / list views that don't
 *     hydrate episodes.
 *
 * @param {Object} episode
 * @param {Object} podcast
 * @param {boolean} isPremium
 * @returns {boolean}
 */
export function canAccessExclusiveEpisode(episode, podcast, isPremium) {
  if (isPremium) return true;
  if (!episode || !podcast) return false;

  const sampleIds = getExclusiveSampleEpisodeIds(podcast);
  if (sampleIds.size > 0) {
    return sampleIds.has(episode.id);
  }

  // Fallback for callers that didn't load `podcast.episodes`:
  // honor the legacy single admin-assigned free_sample_episode field.
  const freeId = podcast.free_sample_episode?.id ?? podcast.free_sample_episode;
  if (freeId == null) return false;
  return episode.id == freeId;
}
