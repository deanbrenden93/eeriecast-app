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
 * Helper to return an array of normalized category strings for free-form usage (search, display, etc.).
 */
export function getPodcastCategoriesLower(podcast) {
  return Array.from(getPodcastCategorySet(podcast));
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
