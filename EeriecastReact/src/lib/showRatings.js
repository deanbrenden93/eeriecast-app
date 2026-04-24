/**
 * Per-show content ratings.
 *
 * The backend currently only has a numeric `rating` field on Podcast
 * (that's the 0.0–5.0 popularity score), and categories only carry a
 * single "mature" tag. Neither is enough to express the full ladder
 * we actually care about — G / PG / PG-13 / R — so we keep the
 * mapping in the frontend as a single source of truth.
 *
 * How lookups work:
 *   • We key primarily by podcast `slug` because slugs are stable and
 *     unique.
 *   • We also key by lowercase title as a fallback for records whose
 *     slug drifted (or that were created before slug conventions were
 *     stable).
 *
 * Behavior tied to each rating:
 *   • 'R'      → triggers the explicit-language / mature gate on play
 *                and on the show page. Same flow as the old "mature"
 *                category.
 *   • 'PG-13'  → visual badge only (listener signal, no gate).
 *   • 'PG'     → visual badge only.
 *   • 'G'      → visual badge only.
 *
 * When a show isn't listed here we return null — callers treat that as
 * "unrated" and fall back to the existing `mature` category check.
 *
 * To assign a new show, add it to either map below. Prefer the slug
 * map — titles can be adjusted from the admin panel without warning.
 */

export const RATING_LEVELS = ['G', 'PG', 'PG-13', 'R'];

const BY_SLUG = {
  // ── R ──────────────────────────────────────────────────────────────
  'darkness-plays': 'R',
  'night-watchers': 'R',

  // ── PG-13 ──────────────────────────────────────────────────────────
  'manmade-monsters': 'PG-13',
  'redwood-bureau': 'PG-13',
  'unexplained-encounters': 'PG-13',
  'tales-from-the-break-room': 'PG-13',
  'delete-after-reading': 'PG-13',
  'dogwood-a-southern-gothic-body-horror-novel': 'PG-13',
  'lore-a-folklore-horror-novel': 'PG-13',
  'drakenblud-the-malformed-king': 'PG-13',
  // "Unexplained Encounters AFTER HOURS" — the spinoff inherits the
  // parent show's rating. If a dedicated slug gets created later, it
  // should still land here.
  'unexplained-encounters-after-hours': 'PG-13',
  'after-hours': 'PG-13',

  // ── PG ─────────────────────────────────────────────────────────────
  'fractured-reality': 'PG',
  'destination-terror': 'PG',
  'alone-in-the-woods': 'PG',
  'freaky-folklore': 'PG',

  // ── G ──────────────────────────────────────────────────────────────
  'lazuray': 'G',
};

// Fallback keyed by lowercased title. Keep every "sensible" variant a
// show's title might appear as in the wild — e.g. an RSS feed coming in
// with "LORE" all caps would still lowercase to 'lore'.
const BY_TITLE = {
  // R
  'darkness plays': 'R',
  'night watchers': 'R',

  // PG-13
  'manmade monsters': 'PG-13',
  'redwood bureau': 'PG-13',
  'unexplained encounters': 'PG-13',
  'tales from the break room': 'PG-13',
  'delete after reading': 'PG-13',
  'dogwood': 'PG-13',
  'dogwood: a southern gothic body horror novel': 'PG-13',
  'lore': 'PG-13',
  'lore – a folklore horror novel': 'PG-13',
  'lore - a folklore horror novel': 'PG-13',
  'drakenblud': 'PG-13',
  'drakenblud: the malformed king': 'PG-13',
  // After Hours spinoff carries the parent rating; include every
  // reasonable casing/variant we've seen in catalog data so a
  // slug-less feed still resolves correctly.
  'unexplained encounters after hours': 'PG-13',
  'unexplained encounters: after hours': 'PG-13',
  'after hours': 'PG-13',

  // PG
  'fractured reality': 'PG',
  'destination terror': 'PG',
  'alone in the woods': 'PG',
  'freaky folklore': 'PG',

  // G
  'lazuray': 'G',
  'lazurvy': 'G', // common spelling variant seen in catalog UI
};

/**
 * Look up the content rating for a show.
 *
 * @param {Object} podcast — any podcast/show-shaped object with a
 *   `slug` and/or `title`.
 * @returns {'G' | 'PG' | 'PG-13' | 'R' | null}
 */
export function getContentRating(podcast) {
  if (!podcast) return null;
  const slug = typeof podcast.slug === 'string' ? podcast.slug.trim().toLowerCase() : '';
  if (slug && BY_SLUG[slug]) return BY_SLUG[slug];

  const title = (podcast.title || podcast.name || '').toString().trim().toLowerCase();
  if (title && BY_TITLE[title]) return BY_TITLE[title];

  return null;
}

/**
 * Numeric strictness so callers can do ordered comparisons
 * ("show anything PG-13 or softer"). Lower == more permissive.
 */
const RATING_ORDER = { G: 0, PG: 1, 'PG-13': 2, R: 3 };

/** True if `rating` is at or stricter than `threshold`. */
export function isRatingAtLeast(rating, threshold) {
  if (!rating || !threshold) return false;
  return (RATING_ORDER[rating] ?? -1) >= (RATING_ORDER[threshold] ?? 999);
}
