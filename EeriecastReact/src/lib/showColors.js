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
  // Unexplained Encounters AFTER HOURS — toxic green glow
  '10':                     { primary: '#4ade80', darker: '#16a34a', shadow: '#4ade8033' },
  // Delete After Reading — vivid crimson / blood red
  'delete-after-reading':   { primary: '#ef4444', darker: '#b91c1c', shadow: '#ef444433' },
  // Unexplained Encounters — deep moody red / maroon
  'unexplained-encounters': { primary: '#dc2626', darker: '#991b1b', shadow: '#dc262633' },
  // Tales from the Break Room — warm amber / rust
  'tales-from-the-break-room': { primary: '#d97706', darker: '#92400e', shadow: '#d9770633' },
  // Redwood Bureau — deep teal / forest blue
  'redwood-bureau':            { primary: '#0d9488', darker: '#115e59', shadow: '#0d948833' },
  // Night Watchers — vibrant purple (background glow)
  'night-watchers':            { primary: '#a855f7', darker: '#7e22ce', shadow: '#a855f733' },
  // Manmade Monsters — amaranth pink-red ("Manmade" title text)
  'manmade-monsters':          { primary: '#e11d48', darker: '#9f1239', shadow: '#e11d4833' },
  // Freaky Folklore — eerie teal-cyan (misty swamp atmosphere)
  'freaky-folklore':           { primary: '#2dd4bf', darker: '#0f766e', shadow: '#2dd4bf33' },
  // Freaky Folklore: Lost Lore — moonlit indigo / blue-violet, echoing
  // the spinoff cover's nighttime forest + silvery moon palette. Cool
  // tone keeps it sibling-related to the parent show's teal without
  // collapsing into the same color.
  'freaky-folklore-lost-lore': { primary: '#818cf8', darker: '#3730a3', shadow: '#818cf833' },
  // Destination Terror — icy steel blue (cold snowy atmosphere)
  'destination-terror':        { primary: '#94a3b8', darker: '#475569', shadow: '#94a3b833' },
  // Alone in the Woods — muted forest green / olive
  'alone-in-the-woods':        { primary: '#6b8e6b', darker: '#3d5c3d', shadow: '#6b8e6b33' },
  // Drakenblud: The Malformed King — ember orange / fire glow
  'drakenblud-the-malformed-king': { primary: '#f97316', darker: '#c2410c', shadow: '#f9731633' },
  // Westfall — dusty amber sunset glow through misty pines (cover's
  // central horizon light). Stays distinct from Drakenblud's vivid
  // ember orange and Break Room's rust amber by leaning gold-warm.
  'westfall':                      { primary: '#e8a44a', darker: '#a86419', shadow: '#e8a44a33' },
  // LORE – A Folklore Horror Novel — dark desaturated teal / ancient wood
  'lore-a-folklore-horror-novel':  { primary: '#5eaaa8', darker: '#2d6a6a', shadow: '#5eaaa833' },
  // Dogwood — dusty crimson rose (flower petals)
  'dogwood-a-southern-gothic-body-horror-novel': { primary: '#c2455a', darker: '#8b2040', shadow: '#c2455a33' },
  // Fractured Reality — icy electric cyan (glitch/lightning over stormy night)
  'fractured-reality':         { primary: '#22d3ee', darker: '#0891b2', shadow: '#22d3ee33' },
  // Lazuray — deep electric azure (leans into the name; contrasts the cover's red slash)
  'lazuray':                   { primary: '#2563eb', darker: '#1e3a8a', shadow: '#2563eb33' },
  // GIMU (musician) — clean white. `darker` shifts to a soft off-white so
  // hover/gradient transitions still read as a state change instead of
  // looking flat, and the shadow stays a low-alpha white glow.
  'gimu':                      { primary: '#ffffff', darker: '#d4d4d8', shadow: '#ffffff33' },
};

/* ── Defaults ────────────────────────────────────────────────────────────── */

const DEFAULTS = {
  podcast:   { primary: '#dc2626', darker: '#b91c1c', shadow: '#dc262633' },  // red
  audiobook: { primary: '#06b6d4', darker: '#0891b2', shadow: '#06b6d433' },  // cyan
  row:       { primary: '#9333ea', darker: '#2563eb', shadow: '#9333ea33' },  // purple→blue
};

/**
 * Pick a readable foreground (text/icon) color to render on top of the
 * given accent. Uses WCAG relative luminance with a single threshold —
 * pale primaries (white, off-white, light yellow) get near-black text
 * so labels and play glyphs don't disappear, everything else keeps the
 * standard white foreground that all our other accents were designed
 * around. Returns plain hex so it works in both inline styles and SVG
 * `fill` / `stroke` attributes.
 */
function pickFg(hex) {
  const h = (hex || '').replace('#', '');
  if (h.length !== 6 && h.length !== 3) return '#ffffff';
  const v = h.length === 3
    ? h.split('').map((c) => c + c).join('')
    : h;
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  // 0.6 chosen empirically: keeps every existing show on white text,
  // flips only on truly pale accents like GIMU's #ffffff.
  return L > 0.6 ? '#0a0a0a' : '#ffffff';
}

function withFg(palette) {
  return { ...palette, fg: pickFg(palette.primary) };
}

/**
 * Look up the accent colors for a given show.
 * @param {Object} show — the podcast/book object (needs id and/or slug)
 * @param {boolean} isBook — whether the show is an audiobook
 * @returns {{
 *   hero: { primary: string, darker: string, shadow: string, fg: string },
 *   row:  { primary: string, darker: string, shadow: string, fg: string },
 * }}
 *   `fg` is the recommended text/icon color to render on top of
 *   `primary` / `darker` — defaults to white but flips to near-black
 *   when the accent is pale (e.g. GIMU). Consumers should prefer it
 *   over hard-coded `text-white` / `fill-white`.
 */
export function getShowColors(show, isBook = false) {
  const slug = show?.slug;
  const id = show?.id != null ? String(show.id) : null;
  const custom = (slug && SHOW_COLORS[slug]) || (id && SHOW_COLORS[id]) || null;

  const defaultHero = isBook ? DEFAULTS.audiobook : DEFAULTS.podcast;

  if (!custom) {
    return { hero: withFg(defaultHero), row: withFg(DEFAULTS.row) };
  }

  return {
    hero: withFg({ ...defaultHero, ...custom }),
    row:  withFg({ ...DEFAULTS.row, ...custom }),
  };
}
