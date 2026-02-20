/**
 * Sample comic — placeholder entry to exercise the data structure end-to-end.
 * Replace with real comic data once pages/artwork are ready.
 *
 * ── Page Spec ──────────────────────────────────────────────────────
 * Canonical page size : 1600 × 2400 px  (2:3 aspect ratio)
 * Format              : JPEG or WebP, ≤ 300 KB per page recommended
 * Bleed (print-ready) : add 0.125″ (≈ 30 px) per side for physical trim
 *
 * 2:3 matches standard US comic trim (6.625″ × 10.25″) and manga
 * digest (5″ × 7.5″). Cover images share the same 2:3 ratio used by
 * the grid tiles in Audiobooks.jsx (`aspect-[2/3]`).
 * ───────────────────────────────────────────────────────────────────
 */
const sampleComic = {
  id: "dark-harvest-1",
  title: "Dark Harvest",
  subtitle: "Issue #1",
  author: "Eeriecast Studios",
  artist: "TBD",
  coverImage: null,
  description:
    "A small farming town harbors a terrifying secret beneath the autumn harvest festival. When the crops start whispering back, no one is safe.",
  readingDirection: "ltr",
  soundtrackPodcastId: null,
  chapters: [
    {
      number: 1,
      title: "The First Reaping",
      pages: [],
    },
  ],
};

export default sampleComic;
