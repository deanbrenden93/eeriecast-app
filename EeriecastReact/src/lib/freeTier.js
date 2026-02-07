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
 * @param {number} chapterIndex — 0-based index
 * @param {boolean} isPremium — whether user has an active subscription
 * @param {number} [limit] — override the default limit
 * @returns {boolean}
 */
export function canAccessChapter(chapterIndex, isPremium, limit = FREE_LISTEN_CHAPTER_LIMIT) {
  if (isPremium) return true;
  return chapterIndex < limit;
}
