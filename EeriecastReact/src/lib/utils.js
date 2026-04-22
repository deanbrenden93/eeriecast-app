import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

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

/** Returns true if this podcast is in the "mature" category. */
export function isMaturePodcast(podcast) {
  try { return hasCategory(podcast, 'mature'); } catch { return false; }
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
