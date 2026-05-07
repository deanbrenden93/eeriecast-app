import PropTypes from "prop-types";
import { Skeleton } from "@/components/ui/skeleton";

/* ═══════════════════════════════════════════════════════════════════
   Skeleton placeholders for the home screen and the surfaces that
   share its layout primitives (Discover tabs, etc).
   ─────────────────────────────────────────────────────────────────
   Each skeleton MIRRORS the exact dimensions of the loaded component
   so swapping skeleton ↔ real content doesn't shift the page. The
   numbers here are the same ones used in the matching real component
   (cards/rows widths, aspect ratios, padding, fixed heights), kept in
   sync by hand — if you tweak a card size in the real component,
   tweak it here too.

   Keep these dumb: no data, no queries, no context. Just visual
   placeholders. They're used by:
     - Podcasts.jsx (home screen)
     - Episodes.jsx (show-detail page)
     - Discover.jsx (feed tabs)
     - Each row component renders its own corresponding skeleton when
       its private data fetch is loading.
   ═══════════════════════════════════════════════════════════════════ */

/* ── tiny shared building blocks ──────────────────────────────── */

function HLine({ className = "" }) {
  return <Skeleton className={`h-3 rounded ${className}`} />;
}
function Bar({ className = "" }) {
  return <Skeleton className={`rounded ${className}`} />;
}

/* ─────────────────────────────────────────────────────────────────
   FeaturedHero skeleton — matches the home-screen hero block.
   See FeaturedHero.jsx for the live dimensions; we copy:
     - same `min-height: clamp(400px, 48vh, 500px)`
     - same horizontal padding + bottom offset
     - same text column width on the left
   ───────────────────────────────────────────────────────────────── */
export function FeaturedHeroSkeleton() {
  return (
    <section
      aria-hidden="true"
      className="relative w-full overflow-hidden flex flex-col justify-end"
      style={{ minHeight: "clamp(400px, 48vh, 500px)" }}
    >
      {/* Background tone — solid + subtle vignette so the skeleton
          doesn't read as a single flat gray block. */}
      <div className="absolute inset-0 bg-[#08080e]" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#08080e]/95 via-[#08080e]/70 to-[#08080e]/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#08080e] via-transparent to-[#08080e]/40" />

      <div className="relative z-10 w-full px-5 sm:px-6 lg:px-10 pt-6 sm:pt-8 pb-8 sm:pb-10">
        <div className="w-full flex items-end justify-between gap-6 lg:gap-12">
          <div className="flex-1 min-w-0 max-w-lg">
            {/* Badge pill */}
            <Bar className="h-6 w-44 rounded-full mb-5" />
            {/* Title — reserves two-line height like the real hero */}
            <div
              className="mb-4 flex flex-col justify-end gap-2"
              style={{ minHeight: "calc(2 * 1.08 * clamp(30px, 5.5vw, 50px))" }}
            >
              <Bar className="h-10 w-2/3 rounded-md" />
              <Bar className="h-10 w-1/2 rounded-md" />
            </div>
            {/* Description — three lines, matches min-h-[6.5rem] reservation */}
            <div className="space-y-2 mb-7 min-h-[6.5rem]">
              <HLine className="w-full" />
              <HLine className="w-[92%]" />
              <HLine className="w-[78%]" />
            </div>
            {/* CTA + secondary */}
            <div className="flex items-center gap-3 flex-wrap">
              <Bar className="h-11 w-36 rounded-xl" />
              <Bar className="h-9 w-24 rounded-xl" />
            </div>
            {/* Slide dots */}
            <div className="mt-6 flex items-center gap-2">
              <Bar className="h-1.5 w-7 rounded-full" />
              <Bar className="h-1.5 w-2 rounded-full" />
              <Bar className="h-1.5 w-2 rounded-full" />
              <Bar className="h-1.5 w-2 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Section header skeleton — the "Title […] View all" row that sits
   above every horizontal carousel on the home screen.
   ───────────────────────────────────────────────────────────────── */
function SectionHeaderSkeleton({ titleWidth = "w-44" }) {
  return (
    <div className="flex justify-between items-center mb-5">
      <Bar className={`h-7 ${titleWidth} rounded-md`} />
      <Bar className="h-4 w-14 rounded-md" />
    </div>
  );
}
SectionHeaderSkeleton.propTypes = { titleWidth: PropTypes.string };

/* ─────────────────────────────────────────────────────────────────
   Episode card skeleton — matches NewReleasesRow / MembersOnlyEpisodesRow
   shape (w-44, aspect-square cover, ~64px text strip).
   ───────────────────────────────────────────────────────────────── */
function EpisodeCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-44">
      <div className="eeriecast-card h-full flex flex-col overflow-hidden">
        {/* Cover */}
        <Bar className="aspect-square w-full rounded-none rounded-t-lg" />
        {/* Info — same min-h as real card so cards line up vertically */}
        <div className="p-3 space-y-1.5 mt-auto min-h-[4rem] flex flex-col justify-end">
          <HLine className="w-[90%]" />
          <HLine className="w-[60%] h-2.5" />
          <HLine className="w-[40%] h-2" />
        </div>
      </div>
    </div>
  );
}

/* Row of episode cards — used by NewReleasesRow / MembersOnlyEpisodesRow. */
export function EpisodeRowSkeleton({ count = 6, titleWidth = "w-44" }) {
  return (
    <div className="relative">
      <SectionHeaderSkeleton titleWidth={titleWidth} />
      <div
        className="flex space-x-3 overflow-hidden pb-4"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        aria-hidden="true"
      >
        {Array.from({ length: count }).map((_, i) => (
          <EpisodeCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
EpisodeRowSkeleton.propTypes = {
  count: PropTypes.number,
  titleWidth: PropTypes.string,
};

/* Row of show cards — used by MembersOnlySection and audiobook row.
   Same w-44 / aspect-square shape as EpisodeCardSkeleton; kept as its
   own export for legibility at the call site. */
export function ShowRowSkeleton({ count = 6, titleWidth = "w-40" }) {
  return <EpisodeRowSkeleton count={count} titleWidth={titleWidth} />;
}
ShowRowSkeleton.propTypes = {
  count: PropTypes.number,
  titleWidth: PropTypes.string,
};

/* ─────────────────────────────────────────────────────────────────
   Keep Listening skeleton — 240px-wide horizontal cards in a 2-row grid.
   Mirrors KeepListeningSection.jsx layout exactly.
   ───────────────────────────────────────────────────────────────── */
function KeepListeningCardSkeleton() {
  return (
    <div className="flex gap-3 bg-white/[0.02] border border-white/[0.04] rounded-xl p-3.5">
      <Bar className="flex-shrink-0 w-[58px] h-[58px] rounded-lg" />
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
        <HLine className="w-[88%]" />
        <HLine className="w-[55%] h-2.5" />
        <Bar className="h-[3px] w-full rounded-full mt-1" />
      </div>
    </div>
  );
}

export function KeepListeningSkeleton({ count = 8 }) {
  return (
    <div className="relative">
      <SectionHeaderSkeleton titleWidth="w-40" />
      <div
        className="grid grid-flow-col auto-cols-[240px] gap-3 overflow-hidden pb-4"
        style={{ gridTemplateRows: "repeat(2, 1fr)", scrollbarWidth: "none" }}
        aria-hidden="true"
      >
        {Array.from({ length: count }).map((_, i) => (
          <KeepListeningCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
KeepListeningSkeleton.propTypes = { count: PropTypes.number };

/* ─────────────────────────────────────────────────────────────────
   Episode Clouds skeleton — mirrors EpisodeCloudsRow layout.
   Each cloud card is a fixed 290×340 box with a roughly clustered
   bubble pattern. We just sketch a header strip + 5 circle placeholders
   in the same CLUSTER_LAYOUT positions the real card uses.
   ───────────────────────────────────────────────────────────────── */
const CLOUD_BUBBLES = [
  { cx: 50, cy: 52, size: 92 },
  { cx: 22, cy: 22, size: 58 },
  { cx: 78, cy: 24, size: 64 },
  { cx: 26, cy: 78, size: 52 },
  { cx: 76, cy: 80, size: 56 },
];

function CloudCardSkeleton() {
  return (
    <div
      className="relative flex-shrink-0 w-[270px] sm:w-[290px] h-[340px] rounded-2xl overflow-hidden border border-white/[0.05]"
      style={{
        background:
          "linear-gradient(160deg, rgba(23,23,27,0.95) 0%, rgba(10,10,14,0.98) 100%)",
      }}
    >
      <div className="relative px-4 pt-4 flex items-start justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Bar className="w-8 h-8 rounded-lg" />
          <div className="space-y-1.5 min-w-0">
            <HLine className="h-3 w-28" />
            <HLine className="h-2 w-20" />
          </div>
        </div>
        <Bar className="w-7 h-7 rounded-full" />
      </div>
      <div className="relative mx-auto mt-2 w-full h-[190px]">
        {CLOUD_BUBBLES.map((pos, i) => (
          <Bar
            key={i}
            className="absolute rounded-full"
            style={{
              top: `calc(${pos.cy}% - ${pos.size / 2}px)`,
              left: `calc(${pos.cx}% - ${pos.size / 2}px)`,
              width: pos.size,
              height: pos.size,
            }}
          />
        ))}
      </div>
      <div className="absolute bottom-0 inset-x-0 px-4 pb-4 pt-8 space-y-1.5">
        <HLine className="h-2.5 w-[40%]" />
        <HLine className="w-[80%]" />
      </div>
    </div>
  );
}

export function EpisodeCloudsSkeleton({ count = 4 }) {
  return (
    <div className="relative">
      <div className="flex items-end justify-between mb-5 gap-3 flex-wrap">
        <div className="space-y-2 min-w-0">
          <Bar className="h-7 w-44 rounded-md" />
          <HLine className="w-64 h-2.5" />
        </div>
        <Bar className="h-7 w-44 rounded-full" />
      </div>
      <div className="flex gap-4 overflow-hidden pb-4" aria-hidden="true">
        {Array.from({ length: count }).map((_, i) => (
          <CloudCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
EpisodeCloudsSkeleton.propTypes = { count: PropTypes.number };

/* ─────────────────────────────────────────────────────────────────
   Music Tracks row skeleton — 280-320px-wide chips in a 2-row grid,
   each chip 80px tall. Matches MusicTracksRow.jsx.
   ───────────────────────────────────────────────────────────────── */
function TrackChipSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.03] flex items-center gap-3 p-2.5 h-20">
      <Bar className="w-14 h-14 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <HLine className="w-[85%]" />
        <HLine className="w-[40%] h-2.5" />
        <Bar className="h-[3px] w-full rounded-full mt-1" />
      </div>
    </div>
  );
}

export function MusicTracksSkeleton({ count = 8 }) {
  return (
    <div className="relative">
      <SectionHeaderSkeleton titleWidth="w-24" />
      <div className="overflow-hidden pb-4" aria-hidden="true">
        <div
          className="grid grid-flow-col gap-3 auto-cols-[minmax(280px,320px)]"
          style={{ gridTemplateRows: "repeat(2, minmax(0, 1fr))" }}
        >
          {Array.from({ length: count }).map((_, i) => (
            <TrackChipSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
MusicTracksSkeleton.propTypes = { count: PropTypes.number };

/* ─────────────────────────────────────────────────────────────────
   Category Explorer skeleton — pill-style cards 8.5-10.5rem wide,
   7.5rem tall, with an icon block + label underneath.
   Mirrors CategoryExplorer.jsx.
   ───────────────────────────────────────────────────────────────── */
function CategoryPillSkeleton() {
  return (
    <div className="flex-shrink-0 w-[8.5rem] sm:w-[9.5rem] md:w-[10.5rem] h-[7.5rem] rounded-2xl border border-white/[0.05] bg-white/[0.02] flex flex-col items-center justify-center gap-2.5 p-4">
      <Bar className="w-10 h-10 rounded-xl" />
      <HLine className="h-2.5 w-20" />
    </div>
  );
}

export function CategoryExplorerSkeleton({ count = 7 }) {
  return (
    <div>
      <Bar className="h-7 w-52 rounded-md mb-6" />
      <div className="flex gap-3.5 overflow-hidden" aria-hidden="true">
        {Array.from({ length: count }).map((_, i) => (
          <CategoryPillSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
CategoryExplorerSkeleton.propTypes = { count: PropTypes.number };

/* ─────────────────────────────────────────────────────────────────
   Featured Creators skeleton — matches the FeaturedCreatorsSection
   layout (a row of larger creator cards, ~280px wide).
   We don't have intimate knowledge of every dimension here so we
   render a generic two-tone "card with image + caption" pattern.
   ───────────────────────────────────────────────────────────────── */
export function FeaturedCreatorsSkeleton({ count = 4 }) {
  return (
    <div className="relative">
      <SectionHeaderSkeleton titleWidth="w-56" />
      <div className="flex gap-4 overflow-hidden pb-4" aria-hidden="true">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex-shrink-0 w-[280px] rounded-2xl border border-white/[0.05] bg-white/[0.02] overflow-hidden"
          >
            <Bar className="aspect-[16/9] w-full rounded-none" />
            <div className="p-4 space-y-2">
              <HLine className="w-[75%]" />
              <HLine className="w-[55%] h-2.5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
FeaturedCreatorsSkeleton.propTypes = { count: PropTypes.number };

/* ─────────────────────────────────────────────────────────────────
   Show grid skeleton — used by the Discover page's grid surfaces
   (Podcasts, Music, Members-Only, Free, Categories detail).
   Same square-card shape as ShowCard.
   ───────────────────────────────────────────────────────────────── */
function GridShowCardSkeleton() {
  return (
    <div className="eeriecast-card h-full flex flex-col overflow-hidden">
      <Bar className="aspect-square w-full rounded-none rounded-t-lg" />
      <div className="p-3 mt-auto space-y-1.5">
        <HLine className="w-[85%]" />
        <HLine className="w-[55%] h-2.5" />
      </div>
    </div>
  );
}

export function ShowGridSkeleton({ count = 12 }) {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <GridShowCardSkeleton key={i} />
      ))}
    </div>
  );
}
ShowGridSkeleton.propTypes = { count: PropTypes.number };

/* ─────────────────────────────────────────────────────────────────
   Episodes table skeleton — used by the Discover episode tabs
   (Recommended / Newest / Trending) and anywhere EpisodesTable is
   wrapped in a loading guard.
   ───────────────────────────────────────────────────────────────── */
export function EpisodesTableSkeleton({ rows = 8 }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-lg border border-white/[0.04] bg-white/[0.02]"
        >
          <Bar className="w-12 h-12 rounded-md flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <HLine className="w-[75%]" />
            <HLine className="w-[40%] h-2.5" />
          </div>
          <Bar className="hidden md:block h-4 w-16 rounded" />
          <Bar className="h-8 w-8 rounded-full flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}
EpisodesTableSkeleton.propTypes = { rows: PropTypes.number };

/* ─────────────────────────────────────────────────────────────────
   Show-detail skeleton (Episodes.jsx).
   Mirrors the hero header on a show page: full-bleed dim background,
   back chip, square cover, badges + title + description + CTAs, and
   an episodes-table preview underneath.
   ───────────────────────────────────────────────────────────────── */
export function ShowDetailSkeleton({ isBook = false, rows = 8 }) {
  return (
    <div className="min-h-screen bg-eeriecast-surface text-white">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-eeriecast-surface/60 via-eeriecast-surface/80 to-eeriecast-surface" />
        <div className="absolute inset-0 bg-gradient-to-r from-eeriecast-surface/70 via-transparent to-eeriecast-surface/70" />

        <div className="relative pt-4 md:pt-6 pb-10 md:pb-12 px-4 lg:px-10">
          {/* Back chip */}
          <Bar className="h-7 w-20 rounded-full mb-4 md:mb-5" />

          <div className="flex flex-col md:flex-row items-start gap-6 md:gap-10 max-w-6xl">
            {/* Cover — match the real hero (square for podcasts/music,
                3:4 for audiobooks). */}
            <div
              className={`relative flex-shrink-0 self-center md:self-start w-36 sm:w-44 md:w-52 ${
                isBook ? "aspect-[3/4]" : "aspect-square"
              }`}
            >
              <Bar className="absolute inset-0 rounded-xl" />
            </div>

            {/* Info column */}
            <div className="flex-1 min-w-0 w-full">
              {/* Badges */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Bar className="h-6 w-24 rounded-full" />
                <Bar className="h-6 w-20 rounded-full" />
              </div>
              {/* Title — big, two-line reservation */}
              <div className="space-y-2 mb-4">
                <Bar className="h-9 sm:h-10 md:h-12 w-3/4 rounded-md" />
                <Bar className="h-9 sm:h-10 md:h-12 w-1/2 rounded-md" />
              </div>
              {/* Meta pills */}
              <div className="flex items-center gap-2.5 mb-4 flex-wrap">
                <Bar className="h-6 w-24 rounded-full" />
                <Bar className="h-6 w-20 rounded-full" />
                <Bar className="h-6 w-12 rounded-full" />
              </div>
              {/* Categories */}
              <div className="flex flex-wrap gap-1.5 mb-5">
                <Bar className="h-5 w-16 rounded-full" />
                <Bar className="h-5 w-20 rounded-full" />
                <Bar className="h-5 w-14 rounded-full" />
              </div>
              {/* Description — three lines */}
              <div className="mb-5 max-w-2xl space-y-2">
                <HLine className="w-full" />
                <HLine className="w-[95%]" />
                <HLine className="w-[60%]" />
              </div>
              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <Bar className="h-10 w-32 rounded-full" />
                <Bar className="h-10 w-28 rounded-full" />
                <Bar className="h-10 w-20 rounded-full" />
                {isBook && <Bar className="h-10 w-32 rounded-full" />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Episodes list */}
      <div className="px-4 lg:px-10 py-6">
        <div className="flex items-center justify-between mb-4">
          <Bar className="h-6 w-32 rounded-md" />
          <Bar className="h-7 w-24 rounded-full" />
        </div>
        <EpisodesTableSkeleton rows={rows} />
      </div>
    </div>
  );
}
ShowDetailSkeleton.propTypes = {
  isBook: PropTypes.bool,
  rows: PropTypes.number,
};
