/**
 * Free-tier gating configuration for audiobooks/ebooks and members-only shows.
 *
 * Controls how many chapters/episodes non-premium / non-authenticated users
 * can access before being prompted to subscribe.
 *
 * These defaults are intended to be overridden by a backend admin
 * setting in the future. For now they are hard-coded constants.
 */

/** Maximum number of chapters a free user may listen to (audiobook). */
export const FREE_LISTEN_CHAPTER_LIMIT = 7;

/** Maximum number of chapters a free user may read (e-reader). */
export const FREE_READ_CHAPTER_LIMIT = 7;

/** Maximum number of episodes a free user may access on a members-only show. */
export const FREE_EXCLUSIVE_EPISODE_LIMIT = 3;

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
 * For members-only (exclusive) shows, the **newest** N episodes are free.
 * Check whether a specific episode can be accessed.
 * @param {Object} episode — the episode to check (must have id and a date field)
 * @param {Array} allEpisodes — all episodes of the show
 * @param {boolean} isPremium — whether user has an active subscription
 * @param {number} [limit] — how many newest episodes are free (default: FREE_EXCLUSIVE_EPISODE_LIMIT)
 * @returns {boolean}
 */
export function canAccessExclusiveEpisode(episode, allEpisodes, isPremium, limit = FREE_EXCLUSIVE_EPISODE_LIMIT) {
  if (isPremium) return true;
  if (!episode || !allEpisodes || allEpisodes.length <= limit) return true;
  const getDate = (ep) => new Date(ep.created_date || ep.published_at || ep.release_date || 0).getTime();
  // Sort newest-first
  const sorted = [...allEpisodes].sort((a, b) => getDate(b) - getDate(a));
  // The first `limit` episodes (newest) are free
  const freeIds = new Set(sorted.slice(0, limit).map(ep => ep.id));
  return freeIds.has(episode.id);
}
