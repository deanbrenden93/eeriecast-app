import { useRef, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import { useQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { ChevronLeft, ChevronRight, Play, Lock } from "lucide-react";
import { Episode as EpisodeApi } from "@/api/entities";
import { usePodcasts } from "@/context/PodcastContext.jsx";
import { isAudiobook, isMusic, formatDate } from "@/lib/utils";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";
import { useUser } from "@/context/UserContext.jsx";
import { toast } from "@/components/ui/use-toast";
import EpisodeMenu from "@/components/podcasts/EpisodeMenu";
import ScrollingTitle from "@/components/common/ScrollingTitle";
import { qk } from "@/lib/queryClient";

function formatDuration(raw) {
  if (!raw && raw !== 0) return null;
  let totalSeconds;
  if (typeof raw === "number") {
    totalSeconds = Math.floor(raw);
  } else if (typeof raw === "string") {
    const parts = raw.split(":").map(Number);
    if (parts.some(isNaN)) return raw;
    if (parts.length === 3) totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) totalSeconds = parts[0] * 60 + parts[1];
    else totalSeconds = parts[0];
  } else {
    return String(raw);
  }
  if (totalSeconds < 0) return "0:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function NewReleasesRow({
  title,
  viewAllTo,
  categoryFilter,
  ordering = "-published_at",
  feedType = "latest",
  trendWindowHours = 48,
  maxItems = 20,
  onAddToPlaylist,
  numbered = feedType === "trending",
}) {
  const scrollRef = useRef(null);
  const navigate = useNavigate();
  const { podcasts, getById } = usePodcasts();
  const { loadAndPlay } = useAudioPlayerContext();
  const { episodeProgressMap, isAuthenticated } = useUser() || {};

  // The trending / recommended endpoints already exclude audiobooks
  // and music server-side, so a small over-fetch is plenty. The plain
  // `-published_at` feed does NOT — chapters and tracks come back mixed
  // in with real podcast episodes. A single recent audiobook (which
  // can publish 40+ chapters at once) will push every regular episode
  // off the top and leave this row blank after client-side exclusion,
  // which is what makes the home-screen "Newest Episodes" row appear
  // to randomly disappear. Pull a much bigger window for "latest" so
  // there's always enough left over to fill the row.
  //
  // For "recommended" we pull a deliberately oversized pool (4× the
  // visible row) so the per-mount shuffle below can present a
  // genuinely different lineup of personalized picks across visits
  // — the backend score is deterministic, so without a wider pool
  // the For You row would always show the same top-N on every mount.
  const fetchLimit =
    feedType === "latest"
      ? Math.max(150, maxItems * 8)
      : feedType === "recommended"
        ? Math.max(80, maxItems * 4)
        : Math.max(40, maxItems * 2);

  // Per-mount seed so the "recommended" row reshuffles on every visit
  // (homescreen → episode → back) but stays stable while the user is
  // looking at it. Keeping it in `useState` (not `useRef` + Math.random
  // inline) means the value is computed exactly once per component
  // instance and is included in the `episodes` `useMemo` dependency
  // array, which keeps React's exhaustive-deps lint quiet.
  const [shuffleSeed] = useState(() => Math.random());

  // Primary feed — cached by feedType+params across the whole app, so all
  // three rows on the home screen plus Discover pull from the same cache and
  // only refetch when stale.
  const { data: primaryRaw = [], isLoading: primaryLoading } = useQuery({
    queryKey: qk.episodes.feed(feedType, { ordering, trendWindowHours, fetchLimit }),
    queryFn: async () => {
      let resp;
      if (feedType === "trending") resp = await EpisodeApi.trending(fetchLimit, trendWindowHours);
      else if (feedType === "recommended") resp = await EpisodeApi.recommended(fetchLimit);
      else resp = await EpisodeApi.list(ordering, fetchLimit);
      return Array.isArray(resp) ? resp : (resp?.results || []);
    },
  });

  // Backfill with newest releases when the primary feed is thin. Cached
  // under a single key so every trending/recommended row shares one request.
  const needsBackfillFeed = feedType === "trending" || feedType === "recommended";
  const { data: backfillRaw = [] } = useQuery({
    queryKey: qk.episodes.feed("latest", { ordering: "-published_at", fetchLimit }),
    queryFn: async () => {
      const resp = await EpisodeApi.list("-published_at", fetchLimit);
      return Array.isArray(resp) ? resp : (resp?.results || []);
    },
    enabled: needsBackfillFeed,
  });

  // Enrich + filter on the client. Cheap, runs off cached data.
  const episodes = useMemo(() => {
    // Keep audiobooks and music out of the mixed podcast feeds; each lives on
    // its own dedicated landing page and has its own "latest" row there.
    const excludedIds = new Set(
      podcasts.filter((p) => isAudiobook(p) || isMusic(p)).map((p) => p.id),
    );
    const enrichOne = (ep) => {
      const podId = typeof ep.podcast === "object" ? ep.podcast?.id : ep.podcast;
      const podcastData = getById(podId);
      return {
        ...ep,
        podcast_id: podId,
        podcast_data: podcastData || (typeof ep.podcast === "object" ? ep.podcast : null),
        cover_image: ep.cover_image || podcastData?.cover_image || "",
      };
    };
    const applyFilters = (list) => {
      let out = list
        .filter((ep) => {
          const podId = typeof ep.podcast === "object" ? ep.podcast?.id : ep.podcast;
          return !excludedIds.has(podId);
        })
        .map(enrichOne);
      if (categoryFilter) {
        const lower = categoryFilter.toLowerCase();
        out = out.filter((ep) => {
          const pd = ep.podcast_data;
          if (!pd) return true;
          const cats = Array.isArray(pd.categories)
            ? pd.categories.map((c) => (typeof c === "string" ? c : c?.name || "").toLowerCase())
            : [];
          return cats.some((c) => c.includes(lower));
        });
      }
      return out;
    };

    let primary = applyFilters(primaryRaw);
    if (primary.length < maxItems && needsBackfillFeed && backfillRaw.length) {
      const existing = new Set(primary.map((ep) => ep.id));
      const extras = applyFilters(backfillRaw).filter((ep) => !existing.has(ep.id));
      primary = [...primary, ...extras];
    }

    // For "recommended" only: shuffle a wider candidate pool so the
    // For You row feels alive across visits instead of presenting the
    // same scored top-N every time. The shuffle is intentionally
    // weighted toward the top of the backend's relevance ordering — a
    // simple uniform shuffle would give the bottom-of-pool picks the
    // same odds as the user's strongest matches, which dilutes the
    // personalization. The weighting works by giving each candidate a
    // priority score proportional to its rank, then sampling without
    // replacement.
    if (feedType === "recommended" && primary.length > maxItems) {
      // Reference the seed so React's lint sees we depend on it.
      void shuffleSeed;
      const weighted = primary.map((ep, idx) => ({
        ep,
        // Higher weight = more likely to be picked. Linear decay
        // keeps the top picks ~2× as likely as the bottom of the
        // pool, which is enough variation to feel fresh without
        // burying strong matches.
        weight: (primary.length - idx) + Math.random() * primary.length * 0.5,
      }));
      weighted.sort((a, b) => b.weight - a.weight);
      primary = weighted.map((w) => w.ep);
    }

    return primary.slice(0, maxItems);
  }, [primaryRaw, backfillRaw, podcasts, getById, categoryFilter, maxItems, needsBackfillFeed, feedType, shuffleSeed]);

  // We treat "loading" as "no data yet". Once the cache has data, the row
  // renders immediately on subsequent mounts (no skeleton flicker).
  const loading = primaryLoading && episodes.length === 0;

  const scroll = (direction) => {
    const { current } = scrollRef;
    if (current) {
      const scrollAmount = current.offsetWidth * 0.8;
      current.scrollBy({ left: direction * scrollAmount, behavior: "smooth" });
    }
  };

  const handleEpisodePlay = async (ep) => {
    const podcastData = ep.podcast_data || getById(ep.podcast_id);
    if (podcastData) {
      // loadAndPlay will resolve audio URL via history endpoint if needed
      const played = await loadAndPlay({ podcast: podcastData, episode: ep, resume: { progress: 0 } });
      if (played === false) {
        toast({
          title: "Unable to play",
          description: isAuthenticated
            ? "This episode doesn't have audio available yet."
            : "Please sign in to play episodes.",
          variant: "destructive",
        });
      }
    } else if (ep.podcast_id) {
      navigate(`${createPageUrl("Episodes")}?id=${encodeURIComponent(ep.podcast_id)}`);
    }
  };

  const handleShowClick = (ep) => {
    if (ep.podcast_id) {
      navigate(`${createPageUrl("Episodes")}?id=${encodeURIComponent(ep.podcast_id)}`);
    }
  };

  if (loading) return null;
  if (episodes.length === 0) return null;

  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-5">
        {title}
        <Link
          to={viewAllTo || createPageUrl("Discover")}
          className="text-sm text-zinc-500 hover:text-red-400 transition-colors duration-300"
        >
          View all
        </Link>
      </div>

      <div className="absolute top-1/2 -left-3 -translate-y-1/2 z-10 hidden md:block">
        <button
          onClick={() => scroll(-1)}
          className="p-2 bg-eeriecast-surface-light/80 hover:bg-eeriecast-surface-lighter border border-white/[0.06] rounded-full transition-all shadow-lg hover:shadow-xl backdrop-blur-sm"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
      </div>
      <div className="absolute top-1/2 -right-3 -translate-y-1/2 z-10 hidden md:block">
        <button
          onClick={() => scroll(1)}
          className="p-2 bg-eeriecast-surface-light/80 hover:bg-eeriecast-surface-lighter border border-white/[0.06] rounded-full transition-all shadow-lg hover:shadow-xl backdrop-blur-sm"
        >
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex space-x-3 overflow-x-auto pb-4 scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {episodes.map((ep, idx) => {
          const podName = ep.podcast_data?.title || "";
          const dur = formatDuration(ep.duration);
          const prog = episodeProgressMap?.get(Number(ep.id));
          const progPct = prog && prog.duration > 0 ? Math.min(100, Math.max(0, (prog.progress / prog.duration) * 100)) : 0;
          const isCompleted = prog?.completed || progPct >= 95;
          const hasProgress = progPct > 0;
          // Trending rank — #1 is the most popular, so it sits on the
          // far left as the row's first card and the numbers ascend as
          // the user scrolls right. Reads naturally as "Top 1, 2, 3…".
          const rank = numbered ? idx + 1 : null;

          return (
            <div key={ep.id} className="flex-shrink-0 w-44">
              <div className="eeriecast-card group cursor-pointer h-full flex flex-col overflow-hidden">
                {/* Cover */}
                <div
                  className="relative aspect-square bg-eeriecast-surface-light overflow-hidden rounded-t-lg"
                  onClick={() => handleEpisodePlay(ep)}
                >
                  {ep.cover_image ? (
                    <img
                      src={ep.cover_image}
                      alt={ep.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105 group-hover:brightness-110"
                    />
                  ) : (
                    <div className="w-full h-full cover-shimmer" />
                  )}

                  {/* Completed overlay */}
                  {isCompleted && (
                    <div className="absolute top-2 left-2">
                      <div className="w-5 h-5 rounded-full bg-green-500/90 flex items-center justify-center shadow-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    </div>
                  )}

                  {/* Hover play overlay */}
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500">
                    <button
                      className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-500 transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:scale-105"
                      onClick={(e) => { e.stopPropagation(); handleEpisodePlay(ep); }}
                    >
                      <Play className="w-4 h-4 text-white ml-0.5 fill-white" />
                    </button>
                  </div>

                  {/* Countdown rank — Netflix-style stamped numeral at the
                      bottom-left of the cover. Counts DOWN to #1 from left
                      to right so listeners scroll *toward* the apex of the
                      chart. The closer to #1 the bigger the gold flourish. */}
                  {rank != null && (
                    <div className="pointer-events-none absolute bottom-0 left-0 z-[4] flex items-end leading-none select-none">
                      <span
                        className={`font-black tabular-nums leading-[0.78] tracking-tighter
                          ${rank <= 3 ? 'text-amber-300/95' : 'text-white/85'}
                          ${rank >= 100 ? 'text-[3.25rem]' : rank >= 10 ? 'text-[4rem]' : 'text-[5rem]'}
                        `}
                        style={{
                          WebkitTextStroke: rank <= 3 ? '2px rgba(0,0,0,0.55)' : '2px rgba(0,0,0,0.7)',
                          textShadow: rank <= 3
                            ? '0 4px 18px rgba(251,191,36,0.55), 0 2px 6px rgba(0,0,0,0.6)'
                            : '0 4px 14px rgba(0,0,0,0.55)',
                          paddingLeft: '0.15rem',
                          paddingBottom: '0.05rem',
                        }}
                      >
                        {rank}
                      </span>
                    </div>
                  )}

                  {/* Three-dot menu — top-right on hover (below badge if present) */}
                  <div className="absolute bottom-1.5 right-1.5 z-[5]" onClick={(e) => e.stopPropagation()}>
                    <EpisodeMenu episode={ep} podcast={ep.podcast_data} onAddToPlaylist={onAddToPlaylist} className="bg-black/60 backdrop-blur-sm" side="right" />
                  </div>

                  {/* Members-only / Premium badge */}
                  {(ep.podcast_data?.is_exclusive || ep.is_premium) && (
                    <div className="absolute top-2 right-2">
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-black/70 backdrop-blur-sm border border-yellow-500/30 rounded-full text-[9px] font-semibold text-yellow-400 shadow-lg">
                        <Lock className="w-2.5 h-2.5" />
                        <span>Members</span>
                      </div>
                    </div>
                  )}

                  {/* Progress bar at bottom of artwork */}
                  {hasProgress && !isCompleted && (
                    <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/[0.06]">
                      <div
                        className="h-full bg-gradient-to-r from-red-600 to-red-500 transition-all duration-300 shadow-[0_0_6px_rgba(220,38,38,0.3)]"
                        style={{ width: `${Math.round(progPct)}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 space-y-1 mt-auto min-h-[4rem] flex flex-col justify-end">
                  <ScrollingTitle
                    as="h3"
                    text={ep.title}
                    className="text-white/90 font-semibold text-xs leading-tight group-hover:text-red-400 transition-colors duration-300"
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleShowClick(ep); }}
                    className="text-zinc-500 hover:text-zinc-300 text-[10px] leading-tight text-left truncate transition-colors"
                  >
                    {podName}
                  </button>
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                    {ep.published_at && <span>{formatDate(ep.published_at)}</span>}
                    {dur && (
                      <>
                        <span>•</span>
                        <span>{dur}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

NewReleasesRow.propTypes = {
  title: PropTypes.node,
  viewAllTo: PropTypes.string,
  categoryFilter: PropTypes.string,
  ordering: PropTypes.string,
  feedType: PropTypes.oneOf(["latest", "trending", "recommended"]),
  trendWindowHours: PropTypes.number,
  maxItems: PropTypes.number,
  onAddToPlaylist: PropTypes.func,
  numbered: PropTypes.bool,
};
