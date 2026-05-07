import { useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import { useQueries } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Lock,
  Sparkles,
  Star,
} from "lucide-react";
import { usePodcasts } from "@/context/PodcastContext.jsx";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";
import { useUser } from "@/context/UserContext.jsx";
import {
  isAudiobook,
  isMusic,
  formatDate,
  getEpisodeAudioUrl,
} from "@/lib/utils";
import { canAccessExclusiveEpisode } from "@/lib/freeTier";
import { toast } from "@/components/ui/use-toast";
import EpisodeMenu from "@/components/podcasts/EpisodeMenu";
import { qk } from "@/lib/queryClient";
import { EpisodeRowSkeleton } from "@/components/skeletons/HomeSkeletons";

/* ───────────────────────────── helpers ───────────────────────────── */

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

// Fisher-Yates shuffle (deterministic via a stable seed so cards don't reshuffle on each render)
function shuffleInPlace(list, seed = 1) {
  const arr = [...list];
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ───────────────────────── component ───────────────────────── */

/**
 * A randomized mixed feed of episodes from every members-only show (including
 * audiobooks). Each card is tagged as either:
 *   - "Sample"  → episode is free for all users (plays normally, menu enabled)
 *   - "Members" → episode is gated (clicking it routes to /Premium, no menu)
 *
 * Free / gated logic mirrors the show-page behavior:
 *   • Non-audiobook exclusive show: the oldest
 *     FREE_MEMBERS_ONLY_SAMPLE_COUNT episodes are Samples; everything
 *     else is Members.
 *   • Audiobook: the first FREE_LISTEN_CHAPTER_LIMIT chapters (oldest first)
 *     are Samples; the rest are Members.
 */
export default function MembersOnlyEpisodesRow({
  maxItems = 18,
  onAddToPlaylist,
  seed = 7,
}) {
  const scrollRef = useRef(null);
  const navigate = useNavigate();
  const { podcasts, ensureDetail } = usePodcasts();
  const { loadAndPlay } = useAudioPlayerContext();
  const {
    episodeProgressMap,
    isAuthenticated,
    isPremium,
  } = useUser() || {};

  // Exclusive (members-only) shows only — audiobooks have their own row
  // and their chapter-based gating would muddy this "episodes" feed.
  const exclusiveShows = useMemo(
    () =>
      (podcasts || []).filter((p) => {
        if (!p) return false;
        if (!p.is_exclusive) return false;
        if (isAudiobook(p)) return false;
        if (isMusic(p)) return false;
        return true;
      }),
    [podcasts]
  );

  // Fetch full details (episodes included) for every exclusive show. Each
  // show-detail lives in its own React Query cache entry, so remounting this
  // row on navigation reads straight from cache — no loading flash.
  const detailQueries = useQueries({
    queries: exclusiveShows.map((p) => ({
      queryKey: qk.podcast.detail(p.id),
      queryFn: () => ensureDetail(p.id),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const detailByShow = useMemo(() => {
    const map = {};
    detailQueries.forEach((q, idx) => {
      const show = exclusiveShows[idx];
      if (show && q.data) map[show.id] = q.data;
    });
    return map;
  }, [detailQueries, exclusiveShows]);

  const hasAnyDetail = detailQueries.some((q) => !!q.data);
  const anyLoading = detailQueries.some((q) => q.isLoading);
  // Only treat this row as loading if nothing has landed yet. Once any detail
  // is cached we render the row immediately on future mounts.
  const loading = anyLoading && !hasAnyDetail;

  // Build classified (sample / members) episode pool.
  // For exclusive shows: the oldest FREE_MEMBERS_ONLY_SAMPLE_COUNT episodes
  // are Samples; every other episode is Members-only. Pass the full detail
  // (which has `episodes`) so canAccessExclusiveEpisode can compute samples.
  const classified = useMemo(() => {
    const items = [];
    for (const show of exclusiveShows) {
      const detail = detailByShow[show.id];
      const episodes = Array.isArray(detail?.episodes) ? detail.episodes : [];
      if (episodes.length === 0) continue;
      for (const ep of episodes) {
        const unlocked = canAccessExclusiveEpisode(ep, detail || show, false);
        items.push({ ep, show, isSample: unlocked });
      }
    }
    return items;
  }, [exclusiveShows, detailByShow]);

  // Take a balanced, shuffled mix: roughly half samples + half members-only.
  const mixed = useMemo(() => {
    if (classified.length === 0) return [];
    const samples = shuffleInPlace(
      classified.filter((i) => i.isSample),
      seed
    );
    const gated = shuffleInPlace(
      classified.filter((i) => !i.isSample),
      seed + 1
    );

    // Samples are rarer → cap at ~40% of the row so they surface visibly
    // without dominating; gated episodes make up the remainder.
    const sampleTake = Math.min(samples.length, Math.max(3, Math.floor(maxItems * 0.4)));
    const gatedTake = Math.min(gated.length, maxItems - sampleTake);

    const interleaved = [];
    const s = samples.slice(0, sampleTake);
    const g = gated.slice(0, gatedTake);
    const total = s.length + g.length;
    let si = 0;
    let gi = 0;
    for (let i = 0; i < total; i++) {
      // Rough interleave: show a sample every ~2-3 gated items
      if (si < s.length && (i % 3 === 0 || gi >= g.length)) {
        interleaved.push(s[si++]);
      } else if (gi < g.length) {
        interleaved.push(g[gi++]);
      } else if (si < s.length) {
        interleaved.push(s[si++]);
      }
    }
    return interleaved;
  }, [classified, maxItems, seed]);

  const scroll = (direction) => {
    const { current } = scrollRef;
    if (current) {
      const scrollAmount = current.offsetWidth * 0.8;
      current.scrollBy({ left: direction * scrollAmount, behavior: "smooth" });
    }
  };

  const goToPremium = () => navigate(createPageUrl("Premium"));
  const goToShow = (showId) => {
    if (showId) navigate(`${createPageUrl("Episodes")}?id=${encodeURIComponent(showId)}`);
  };

  const handleCardPlay = async (item) => {
    if (!item) return;
    const { ep, show, isSample } = item;
    // Non-premium + gated → redirect to premium
    if (!isPremium && !isSample) {
      goToPremium();
      return;
    }
    // Navigate to show if we somehow don't have audio
    if (!getEpisodeAudioUrl(ep)) {
      goToShow(show.id);
      return;
    }
    const played = await loadAndPlay({
      podcast: show,
      episode: ep,
      resume: { progress: 0 },
    });
    if (played === false) {
      toast({
        title: "Unable to play",
        description: isAuthenticated
          ? "This episode doesn't have audio available yet."
          : "Please sign in to play episodes.",
        variant: "destructive",
      });
    }
  };

  // First load: nothing in cache yet → show a shape-matched skeleton so
  // the section keeps its footprint instead of vanishing and pushing
  // every row below it up the page.
  if (loading && mixed.length === 0)
    return <EpisodeRowSkeleton count={Math.min(maxItems, 6)} titleWidth="w-56" />;
  if (!loading && mixed.length === 0) return null;

  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/[0.18] to-amber-600/[0.08] border border-amber-400/20 flex items-center justify-center">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Members-Only Episodes</h2>
        </div>
        <Link
          to={`${createPageUrl("Discover")}?tab=Members-Only`}
          className="text-sm text-zinc-500 hover:text-amber-400 transition-colors duration-300"
        >
          View all
        </Link>
      </div>

      <div className="absolute top-1/2 -left-3 -translate-y-1/2 z-10 hidden md:block">
        <button
          onClick={() => scroll(-1)}
          className="p-2 bg-eeriecast-surface-light/80 hover:bg-eeriecast-surface-lighter border border-white/[0.06] rounded-full transition-all shadow-lg hover:shadow-xl backdrop-blur-sm"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
      </div>
      <div className="absolute top-1/2 -right-3 -translate-y-1/2 z-10 hidden md:block">
        <button
          onClick={() => scroll(1)}
          className="p-2 bg-eeriecast-surface-light/80 hover:bg-eeriecast-surface-lighter border border-white/[0.06] rounded-full transition-all shadow-lg hover:shadow-xl backdrop-blur-sm"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex space-x-3 overflow-x-auto pb-4 scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {mixed.map((item) => {
          const { ep, show, isSample } = item;
          const podName = show?.title || "";
          const dur = formatDuration(ep.duration);
          const prog = episodeProgressMap?.get(Number(ep.id));
          const progPct = prog && prog.duration > 0
            ? Math.min(100, Math.max(0, (prog.progress / prog.duration) * 100))
            : 0;
          const isCompleted = prog?.completed || progPct >= 95;
          const hasProgress = progPct > 0;
          const cover = ep.cover_image || show?.cover_image || "";

          // Free to play means: the user can actually start playback without
          // being blocked. Premium users always can; free users can only
          // for Sample-tagged items.
          const canPlay = isPremium || isSample;

          return (
            <div key={`${show.id}:${ep.id}`} className="flex-shrink-0 w-44">
              <div className="eeriecast-card group cursor-pointer h-full flex flex-col overflow-hidden">
                {/* Cover */}
                <div
                  className="relative aspect-square bg-eeriecast-surface-light overflow-hidden rounded-t-lg"
                  onClick={() => handleCardPlay(item)}
                >
                  {cover ? (
                    <img
                      src={cover}
                      alt={ep.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105 group-hover:brightness-110"
                    />
                  ) : (
                    <div className="w-full h-full cover-shimmer" />
                  )}

                  {/* Gated lock overlay for free users */}
                  {!canPlay && (
                    <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/55 to-black/80" />
                  )}

                  {/* Completed */}
                  {isCompleted && canPlay && (
                    <div className="absolute top-2 left-2">
                      <div className="w-5 h-5 rounded-full bg-green-500/90 flex items-center justify-center shadow-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    </div>
                  )}

                  {/* Hover play / lock overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 bg-black/45">
                    {canPlay ? (
                      <button
                        className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-500 transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:scale-105"
                        onClick={(e) => { e.stopPropagation(); handleCardPlay(item); }}
                        aria-label="Play episode"
                      >
                        <Play className="w-4 h-4 text-white ml-0.5 fill-white" />
                      </button>
                    ) : (
                      <button
                        className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/[0.95] hover:bg-amber-400 text-black rounded-full text-xs font-bold shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all hover:scale-105"
                        onClick={(e) => { e.stopPropagation(); goToPremium(); }}
                        aria-label="Upgrade to access"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Unlock
                      </button>
                    )}
                  </div>

                  {/* Triple-dot menu — only for playable episodes */}
                  {canPlay && (
                    <div
                      className="absolute bottom-1.5 right-1.5 z-[5]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <EpisodeMenu
                        episode={ep}
                        podcast={show}
                        onAddToPlaylist={onAddToPlaylist}
                        className="bg-black/60 backdrop-blur-sm"
                        side="right"
                      />
                    </div>
                  )}

                  {/* Tier pill — top-right */}
                  <div className="absolute top-2 right-2">
                    {isSample ? (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/90 backdrop-blur-sm text-white text-[9px] font-bold uppercase tracking-wider shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Sample</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[9px] font-bold uppercase tracking-wider shadow-[0_0_8px_rgba(245,158,11,0.3)]">
                        <Lock className="w-2.5 h-2.5" />
                        <span>Members</span>
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  {hasProgress && canPlay && !isCompleted && (
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
                  <h3
                    title={ep.title}
                    className="text-white/90 font-semibold text-xs leading-tight group-hover:text-amber-400 transition-colors duration-300 line-clamp-2 break-words"
                  >
                    {ep.title}
                  </h3>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); goToShow(show.id); }}
                    className="text-zinc-500 hover:text-zinc-300 text-[10px] leading-tight text-left truncate transition-colors"
                  >
                    {podName}
                  </button>
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                    {ep.published_at && <span>{formatDate(ep.published_at)}</span>}
                    {dur && (
                      <>
                        <span>&bull;</span>
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

MembersOnlyEpisodesRow.propTypes = {
  maxItems: PropTypes.number,
  onAddToPlaylist: PropTypes.func,
  seed: PropTypes.number,
};
