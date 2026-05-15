import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { getContentRating } from "./showRatings";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Normalize a single category-like value (string or object) to lowercase comparable string.
 */
export function normalizeCategory(value) {
  if (!value) return "";
  if (typeof value === "string") return value.toLowerCase();
  if (typeof value === "object") {
    return (value.slug || value.name || "").toLowerCase();
  }
  return "";
}

/**
 * Build a Set of normalized category identifiers for a podcast, supporting both
 * legacy single `category` and new `categories` array shapes. When a category
 * object has both slug and name, include both forms to support name-based lookups.
 */
export function getPodcastCategorySet(podcast) {
  const set = new Set();
  if (!podcast) return set;

  const addFromValue = (val) => {
    if (!val) return;
    if (typeof val === "string") {
      const norm = val.toLowerCase();
      if (norm) set.add(norm);
    } else if (typeof val === "object") {
      const slug = (val.slug || "").toLowerCase();
      const name = (val.name || "").toLowerCase();
      if (slug) set.add(slug);
      if (name) set.add(name);
    }
  };

  // New API shape: array of category objects
  if (Array.isArray(podcast.categories)) {
    for (const c of podcast.categories) {
      addFromValue(c);
    }
  }

  // Legacy: single category string/object
  if (podcast.category) {
    addFromValue(podcast.category);
  }

  return set;
}

/**
 * Returns true if the podcast has a category matching the provided name (case-insensitive).
 * Matches against either category slug or name.
 */
export function hasCategory(podcast, categoryName) {
  const target = (categoryName || "").toLowerCase();
  if (!target) return false;
  const set = getPodcastCategorySet(podcast);
  if (set.has(target)) return true;
  // Be resilient to singular/plural variations for audiobook(s)
  if (target === "audiobook" && set.has("audiobooks")) return true;
  if (target === "audiobooks" && set.has("audiobook")) return true;
  return false;
}

/** Determine if a podcast object is an audiobook (case-insensitive).
 * We consider it an audiobook if it has the `audiobook` category regardless of other categories.
 */
export function isAudiobook(podcast) {
  try {
    return hasCategory(podcast, "audiobook");
  } catch {
    return false;
  }
}

/** Category slug used to flag podcasts whose episodes are music tracks. */
export const MUSIC_CATEGORY = "music";

/** Determine if a podcast object is a music artist (case-insensitive).
 * Music shows are surfaced on their own Music landing page and excluded from
 * mixed podcast feeds so listeners never encounter a track in a line-up they
 * expect to be spoken-word.
 */
export function isMusic(podcast) {
  try {
    return hasCategory(podcast, MUSIC_CATEGORY);
  } catch {
    return false;
  }
}

/** True for any show that should be kept out of the standard
 *  "podcasts & episodes" mixed feeds — currently audiobooks and music. */
export function isNonPodcastShow(podcast) {
  return isAudiobook(podcast) || isMusic(podcast);
}

/**
 * Returns true if this show requires the explicit-language / mature gate.
 *
 * A show is "mature" when either:
 *   • its frontend content rating (see lib/showRatings.js) is 'R'; or
 *   • it carries the backend `mature` category.
 *
 * The rating table is the primary source — an admin who assigns a show
 * the 'R' rating shouldn't also have to tag it with the mature category
 * for gating to kick in. The category check is kept as a belt-and-
 * suspenders fallback for anything ingested via RSS before a rating is
 * assigned.
 */
export function isMaturePodcast(podcast) {
  try {
    if (getContentRating(podcast) === 'R') return true;
    if (hasCategory(podcast, 'mature')) return true;
    return false;
  } catch { return false; }
}

/**
 * Build the one-line subtitle shown under a show/podcast card.
 *
 * The platform deliberately does *not* attribute shows to a creator on
 * browsing surfaces — listeners think in terms of "shows", not "studios",
 * and the creator concept exists purely for the creator-portal / royalty
 * side of the system. So the card subtext is a content-volume hint tuned
 * to the show type:
 *
 *   • Audiobook → "N Chapters"
 *   • Music     → "N Tracks"
 *   • Podcast   → "N Episodes"
 *
 * Returns an empty string when we don't have a count yet so callers can
 * still render the card without a dangling "0 Episodes" line.
 */
export function getShowSubtext(podcast) {
  if (!podcast) return '';
  const n = Number(
    podcast.episode_count ?? podcast.episodes_count ?? podcast.total_episodes ?? 0,
  );
  if (!Number.isFinite(n) || n <= 0) return '';
  if (isAudiobook(podcast)) return `${n} Chapter${n === 1 ? '' : 's'}`;
  if (isMusic(podcast)) return `${n} Track${n === 1 ? '' : 's'}`;
  return `${n} Episode${n === 1 ? '' : 's'}`;
}

/**
 * Shows/episodes with the "mature" category (now surfaced as "explicit
 * language" in the UI) stay visible across browsing surfaces regardless
 * of the viewer's toggle state. Playback and show pages perform their
 * own gate via the explicit-language modal. These helpers intentionally
 * pass through the list so callers can keep their existing signatures
 * without changing every call site.
 */
// eslint-disable-next-line no-unused-vars
export function filterMaturePodcasts(list, _canViewMature) {
  return list || [];
}

// eslint-disable-next-line no-unused-vars
export function filterMatureEpisodes(episodes, _canViewMature, _maturePodcastIds, _getPodcast) {
  return episodes || [];
}

/** Prefer ad-free audio, fallback to ad-supported, then default. */
export function getEpisodeAudioUrl(ep) {
  if (!ep) return "";
  return (
    ep.ad_free_audio_url ||
    ep.ad_supported_audio_url ||
    ep.audio_url ||
    ""
  );
}

/**
 * Return an array of normalized category strings for display / search.
 *
 * Unlike `getPodcastCategorySet` (which intentionally retains both the
 * slug and the name of each category so `hasCategory()` lookups are
 * resilient to either form), this helper is aimed at the UI: it prefers
 * the human-readable `name` over the slug and collapses punctuation
 * variants so that e.g. `{slug: "talk-show", name: "Talk Show"}` renders
 * as a single chip instead of two ("Talk-Show" and "Talk Show").
 */
export function getPodcastCategoriesLower(podcast) {
  if (!podcast) return [];
  const out = [];
  const seen = new Set();

  const add = (val) => {
    if (!val) return;
    let display = null;
    if (typeof val === "string") {
      display = val.toLowerCase();
    } else if (typeof val === "object") {
      display = (val.name || val.slug || "").toLowerCase();
    }
    if (!display) return;
    // Collapse slug/name/whitespace variants (e.g. "talk-show",
    // "talk_show", "talk show") to a single dedup key so the same
    // category never renders as two adjacent chips.
    const key = display.replace(/[\s_-]+/g, " ").trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(display);
  };

  if (Array.isArray(podcast.categories)) {
    for (const c of podcast.categories) add(c);
  }
  if (podcast.category) add(podcast.category);
  return out;
}

/** Format a date string to a human-readable format like "Jul 31, 2021". */
export function formatDate(dateString) {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

// Short, scannable relative date for card metadata rows. Mirrors the
// social-media convention ("5m ago", "3h ago", "Yesterday", "4d ago",
// "2w ago") so listeners read freshness at a glance instead of parsing
// a full "May 13, 2026" string. Falls back to an absolute date for
// anything older than ~12 weeks, and includes the year for content
// that crossed a year boundary so we never show "Jan 5" when it
// actually means "Jan 5, 2024".
export function formatRelativeDate(dateString) {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 45) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return "Yesterday";
    if (diffDay < 7) return `${diffDay}d ago`;
    const diffWeek = Math.floor(diffDay / 7);
    if (diffWeek < 12) return `${diffWeek}w ago`;
    // Older content — fall back to an absolute date, including the
    // year if it's not the current calendar year.
    const opts = d.getFullYear() === now.getFullYear()
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };
    return d.toLocaleDateString("en-US", opts);
  } catch {
    return "";
  }
}
