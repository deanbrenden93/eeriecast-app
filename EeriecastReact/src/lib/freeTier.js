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
export const FREE_LISTEN_CHAPTER_LIMIT = 3;

/** Maximum number of chapters a free user may read (e-reader). */
export const FREE_READ_CHAPTER_LIMIT = 3;

/** Maximum number of episode favorites a free user may have. */
export const FREE_FAVORITE_LIMIT = 5;

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
 * For members-only (exclusive) shows, the admin assigns a single free sample
 * episode via the `free_sample_episode` field on the Podcast model.
 * Only that episode is accessible to non-premium users.
 *
 * @param {Object} episode — the episode to check (must have `id`)
 * @param {Object} podcast — the podcast/show object (must have `free_sample_episode`)
 * @param {boolean} isPremium — whether user has an active subscription
 * @returns {boolean}
 */
export function canAccessExclusiveEpisode(episode, podcast, isPremium) {
  if (isPremium) return true;
  if (!episode || !podcast) return false;
  const freeId = podcast.free_sample_episode?.id ?? podcast.free_sample_episode;
  if (freeId == null) return false;
  // Compare with loose equality to handle string vs number IDs
  return episode.id == freeId;
}
