/**
 * Per-show accent color configuration.
 *
 * Maps show slugs (or IDs as strings) to accent color definitions used
 * for play buttons on the Episodes page and episode rows.
 *
 * Colors are plain CSS values (hex, rgb, etc.) so they work with inline
 * styles and avoid Tailwind's static-analysis limitation.
 *
 * Format:
 *   'show-slug': {
 *     primary: '#hex',   // main gradient start / solid button color
 *     darker:  '#hex',   // gradient end / hover color
 *     shadow:  '#hex33', // box-shadow color (optional, with alpha)
 *   }
 *
 * To add a new show, just add another entry.  Use the show's slug from
 * the Django admin (e.g. "delete-after-reading") or its numeric ID as
 * a string (e.g. "42").
 */

const SHOW_COLORS = {
  // ── Fill in your shows below ──────────────────────────────────────────
  // 'delete-after-reading': { primary: '#f59e0b', darker: '#d97706', shadow: '#f59e0b33' },
  // 'riscotto':             { primary: '#10b981', darker: '#059669', shadow: '#10b98133' },
};

/* ── Defaults ────────────────────────────────────────────────────────────── */

const DEFAULTS = {
  podcast:   { primary: '#dc2626', darker: '#b91c1c', shadow: '#dc262633' },  // red
  audiobook: { primary: '#06b6d4', darker: '#0891b2', shadow: '#06b6d433' },  // cyan
  row:       { primary: '#9333ea', darker: '#2563eb', shadow: '#9333ea33' },  // purple→blue
};

/**
 * Look up the accent colors for a given show.
 * @param {Object} show — the podcast/book object (needs id and/or slug)
 * @param {boolean} isBook — whether the show is an audiobook
 * @returns {{ hero: {primary,darker,shadow}, row: {primary,darker,shadow} }}
 */
export function getShowColors(show, isBook = false) {
  const slug = show?.slug;
  const id = show?.id != null ? String(show.id) : null;
  const custom = (slug && SHOW_COLORS[slug]) || (id && SHOW_COLORS[id]) || null;

  const defaultHero = isBook ? DEFAULTS.audiobook : DEFAULTS.podcast;

  if (!custom) {
    return { hero: defaultHero, row: DEFAULTS.row };
  }

  return {
    hero: { ...defaultHero, ...custom },
    row:  { ...DEFAULTS.row, ...custom },
  };
}
