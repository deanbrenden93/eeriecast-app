import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Episode as EpisodeApi } from "@/api/entities";
import { usePodcasts } from "@/context/PodcastContext.jsx";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";
import { useUser } from "@/context/UserContext.jsx";
import { hasCategory, isAudiobook, isMusic } from "@/lib/utils";
import { canAccessExclusiveEpisode } from "@/lib/freeTier";
import { toast } from "@/components/ui/use-toast";
import { qk } from "@/lib/queryClient";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Dices,
  Laugh,
  Trees,
  Fingerprint,
  Rocket,
  Ghost,
} from "lucide-react";

/**
 * The curated themes for the "Episode Clouds" row.
 *
 * Each theme maps a playful display title to an underlying podcast
 * category + a visual identity (accent color, gradient, icon). Themes
 * are stable; the episodes inside each cloud are rolled at render time
 * so the home screen feels alive on every visit.
 *
 * Adding a new theme is just another object in this array — the row
 * will automatically render + data-bind it as long as a category with
 * that slug exists on one or more podcasts.
 */
const THEMES = [
  {
    id: "explicitly-hilarious",
    title: "Explicitly Hilarious",
    subtitle: "from Comedy",
    category: "comedy",
    Icon: Laugh,
    gradientClass: "from-amber-500/30 via-yellow-500/10 to-orange-500/5",
    accent: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.25)",
  },
  {
    id: "lost-in-the-woods",
    title: "Lost in the Woods",
    subtitle: "from Outdoors",
    category: "outdoors",
    Icon: Trees,
    gradientClass: "from-emerald-500/30 via-green-500/10 to-teal-500/5",
    accent: "#10b981",
    glow: "rgba(16, 185, 129, 0.22)",
  },
  {
    id: "true-crime",
    title: "True Crime",
    subtitle: "from True Crime",
    category: "true crime",
    Icon: Fingerprint,
    gradientClass: "from-rose-600/30 via-red-500/10 to-orange-500/5",
    accent: "#e11d48",
    glow: "rgba(225, 29, 72, 0.25)",
  },
  {
    id: "sci-fi",
    title: "Sci-Fi",
    subtitle: "from Sci-Fi",
    category: "sci-fi",
    Icon: Rocket,
    gradientClass: "from-indigo-500/30 via-blue-500/10 to-cyan-500/5",
    accent: "#6366f1",
    glow: "rgba(99, 102, 241, 0.25)",
  },
  {
    id: "monsters-abound",
    title: "Monsters Abound",
    subtitle: "from Monsters",
    category: "monsters",
    Icon: Ghost,
    gradientClass: "from-fuchsia-500/30 via-purple-500/10 to-violet-500/5",
    accent: "#a855f7",
    glow: "rgba(168, 85, 247, 0.25)",
  },
];

/**
 * Cluster layout used for the 5 thumbnails inside every cloud.
 *
 * Positions are intentionally asymmetric so the cluster reads as a
 * hand-scattered group rather than a grid. The first entry is the
 * "featured" slot — it's the largest and its title is what the cloud
 * card labels itself with at the bottom.
 *
 * Fields:
 *   cx/cy : center point as a percentage of the cluster box. We resolve
 *           the actual top/left at render time by subtracting half the
 *           bubble's size in px — this keeps the outer element's
 *           `transform` free for framer-motion to animate enter/exit.
 *   size  : diameter in px.
 *   z     : stacking order so the featured cover sits in front.
 *   delay : animation-delay for the floating keyframe so each
 *           thumbnail drifts on its own rhythm.
 */
const CLUSTER_LAYOUT = [
  { cx: 50, cy: 52, size: 92, z: 5, delay: "0s" },
  { cx: 22, cy: 22, size: 58, z: 2, delay: "0.6s" },
  { cx: 78, cy: 24, size: 64, z: 3, delay: "1.2s" },
  { cx: 26, cy: 78, size: 52, z: 2, delay: "0.3s" },
  { cx: 76, cy: 80, size: 56, z: 3, delay: "0.9s" },
];

const CLOUD_SIZE = 5;

/** Unbiased Fisher-Yates shuffle, in place. */
function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Roll a fresh cluster of 5 episodes for a single cloud.
 *
 * The picker has three passes so that "feeling a reroll" is guaranteed
 * whenever the pool is large enough, while still gracefully handling
 * sparse categories:
 *
 *   1. Pick one *random* episode from each distinct podcast, skipping
 *      any episode that was shown in the previous roll. This is the
 *      ideal case — every slot is from a different show and none
 *      repeat. The earlier implementation always grabbed the latest
 *      episode per podcast, which is why clicking the dice felt like a
 *      reorder rather than a reroll.
 *
 *   2. If we still don't have 5 picks (small pool, or almost every
 *      available episode was in the last roll), relax the "avoid last
 *      roll" rule — one-random-per-podcast without the exclusion.
 *
 *   3. If we still can't fill 5 (a category with <5 podcasts total),
 *      relax the unique-podcast rule and allow additional episodes
 *      from podcasts already represented. This way a cluster always
 *      renders with a full 5 bubbles when the raw pool has at least
 *      5 episodes, even if they come from the same show.
 *
 * `previousIds` is a Set of episode IDs from the previous roll and is
 * what makes successive clicks actually change the picks instead of
 * reshuffling the same handful.
 */
function pickCloudEpisodes(episodeMatches, previousIds) {
  if (!Array.isArray(episodeMatches) || episodeMatches.length === 0) return [];

  // Group episodes by podcast so we can pick a random one per show.
  const byPod = new Map();
  for (const ep of episodeMatches) {
    const pid = ep.podcast_id;
    if (pid == null) continue;
    if (!byPod.has(pid)) byPod.set(pid, []);
    byPod.get(pid).push(ep);
  }

  const pickOnePerPodcast = (excludeIds) => {
    const pods = shuffleInPlace([...byPod.keys()]);
    const out = [];
    for (const pid of pods) {
      if (out.length >= CLOUD_SIZE) break;
      const eps = byPod.get(pid) || [];
      const candidates = excludeIds ? eps.filter((e) => !excludeIds.has(e.id)) : eps;
      if (candidates.length === 0) continue;
      out.push(candidates[Math.floor(Math.random() * candidates.length)]);
    }
    return out;
  };

  // Pass 1: one random episode per podcast, none from the prior roll.
  let picks = pickOnePerPodcast(previousIds);

  // Pass 2: still short? Drop the "avoid previous" rule.
  if (picks.length < CLOUD_SIZE) {
    const existing = new Set(picks.map((p) => p.id));
    const extras = pickOnePerPodcast(null).filter((p) => !existing.has(p.id));
    picks = picks.concat(extras.slice(0, CLOUD_SIZE - picks.length));
  }

  // Pass 3: still short? Allow same-show duplicates.
  if (picks.length < CLOUD_SIZE) {
    const existing = new Set(picks.map((p) => p.id));
    const rest = shuffleInPlace(episodeMatches.filter((e) => !existing.has(e.id)));
    picks = picks.concat(rest.slice(0, CLOUD_SIZE - picks.length));
  }

  return picks.slice(0, CLOUD_SIZE);
}

export default function EpisodeCloudsRow({ onAddToPlaylist: _unused }) {
  const scrollRef = useRef(null);
  const { podcasts, getById } = usePodcasts();
  const { loadAndPlay } = useAudioPlayerContext();
  const { isAuthenticated } = useUser() || {};

  // Content filter: "all" (default) vs "free" (hide members-only items
  // and unexclusive-show episodes that aren't free samples). Lives
  // right next to the section header so a logged-out / non-member
  // listener can quickly prune down to playable picks.
  const [contentFilter, setContentFilter] = useState("all");

  // Reroll state is owned by each CloudCard — keeping a shared
  // parent-level shuffleTokens object here was the bug that caused
  // clicking one cloud's dice to re-roll every cloud (any key change
  // invalidated the shared clouds memo, which then ran Math.random for
  // all 5 themes). Now each card manages its own seed in isolation.

  // One shared fetch (100 newest episodes) powers every cloud. Anything
  // more per-theme would hammer the API at mount. We de-dupe by podcast
  // inside each theme so a single show can't dominate its cloud.
  const { data: pool = [], isLoading } = useQuery({
    queryKey: qk.episodes.feed("latest", {
      ordering: "-published_at",
      fetchLimit: 100,
      variant: "clouds-pool",
    }),
    queryFn: async () => {
      const resp = await EpisodeApi.list("-published_at", 100);
      return Array.isArray(resp) ? resp : resp?.results || [];
    },
  });

  /**
   * Full episode pool — the recent-feed items merged with every episode
   * already hydrated on the cached podcast list.
   *
   * We combine both sources because:
   *   1. The /episodes/?ordering=-published_at feed gives us the very
   *      latest releases but stops at 100.
   *   2. The podcast list serializer ships each show's full episode
   *      catalog, so a sparser category (e.g. "outdoors") can still be
   *      populated from its library even when nothing recent landed.
   *
   * This replaces the old "podcast-as-item" backfill so every bubble in
   * a cloud is always a real, playable episode — never a show stand-in.
   */
  const enrichedPool = useMemo(() => {
    const byId = new Map();
    const add = (ep, podcastData) => {
      if (!ep?.id || !podcastData) return;
      if (isAudiobook(podcastData) || isMusic(podcastData)) return;
      if (byId.has(ep.id)) return;
      byId.set(ep.id, {
        ...ep,
        podcast_id: podcastData.id,
        podcast_data: podcastData,
        cover_image: ep.cover_image || podcastData?.cover_image || "",
      });
    };

    // Primary source: recent-feed episodes.
    for (const ep of pool || []) {
      const podId = typeof ep.podcast === "object" ? ep.podcast?.id : ep.podcast;
      const podcastData = getById(podId) || (typeof ep.podcast === "object" ? ep.podcast : null);
      add(ep, podcastData);
    }

    // Backfill: every episode already embedded in cached podcast data.
    for (const p of podcasts || []) {
      if (!p || isAudiobook(p) || isMusic(p)) continue;
      const eps = Array.isArray(p.episodes) ? p.episodes : p.episodes?.results;
      if (!Array.isArray(eps)) continue;
      for (const ep of eps) add(ep, p);
    }

    return Array.from(byId.values());
  }, [pool, podcasts, getById]);

  /**
   * "Free content" predicate.
   *
   * An episode counts as free when:
   *   • its show isn't member-exclusive AND it isn't itself flagged as
   *     premium;
   *   • OR the show is exclusive but this episode is one of the free
   *     samples (delegated to canAccessExclusiveEpisode with
   *     isPremium=false so the check is identical to playback-gating).
   *
   * Premium members get the same view regardless of the toggle — they
   * can play everything — but we still honor "free" as a visual intent
   * if they chose it manually.
   */
  const isEpisodeFree = useCallback((ep) => {
    if (!ep) return false;
    const pod = ep.podcast_data;
    if (!pod) return !ep.is_premium;
    if (pod.is_exclusive) {
      return canAccessExclusiveEpisode(ep, pod, /* isPremium */ false);
    }
    return !ep.is_premium;
  }, []);

  /**
   * Which themes have at least one matching episode under the current
   * content filter? We only use this to decide which CloudCards to
   * render — the actual picks live inside each card so that clicking
   * one dice doesn't leak randomness into its siblings.
   */
  const visibleThemes = useMemo(() => {
    return THEMES.filter((theme) => {
      const matches = enrichedPool.filter((ep) =>
        hasCategory(ep.podcast_data, theme.category),
      );
      const filtered =
        contentFilter === "free" ? matches.filter(isEpisodeFree) : matches;
      return filtered.length > 0;
    });
  }, [enrichedPool, contentFilter, isEpisodeFree]);

  const anyData = visibleThemes.length > 0;

  const scroll = useCallback((direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.offsetWidth * 0.8;
    el.scrollBy({ left: direction * amount, behavior: "smooth" });
  }, []);

  /**
   * Play the selected episode. loadAndPlay routes through
   * loadAndPlaySmart, which already enforces mature / premium /
   * membership gates, so we don't need to re-check here.
   */
  const handleItemClick = useCallback(
    async (item) => {
      if (!item || !item.episode || !item.podcast) return;
      const played = await loadAndPlay({
        podcast: item.podcast,
        episode: item.episode,
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
    },
    [loadAndPlay, isAuthenticated],
  );

  if (isLoading && !anyData) return null;
  if (!anyData) return null;

  return (
    <div className="relative">
      {/* Inline keyframes — scoped via a unique animation name so they
          don't collide with anything else in the app. We keep them
          inside the component to avoid having to touch tailwind.config.
          The extra `ec-pulse` and `ec-conic` keyframes power the
          ambient glow and slow-rotating conic wash on each cloud card
          so the backgrounds feel alive without distracting. */}
      <style>{`
        @keyframes ec-float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        @keyframes ec-drift {
          0%   { transform: translate(0, 0); }
          50%  { transform: translate(-8px, 6px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes ec-pulse {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50%      { opacity: 0.75; transform: scale(1.08); }
        }
        @keyframes ec-conic {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes ec-shimmer {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>

      <div className="flex items-end justify-between mb-5 gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-fuchsia-200 via-white to-amber-200 bg-clip-text text-transparent">
            Random Cravings
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            What are you in the mood for? Grab bags of five, rolled fresh every visit.
          </p>
        </div>

        {/* All / Free content toggle — lets non-members quickly narrow
            each cluster to episodes they can actually play. */}
        <div
          role="tablist"
          aria-label="Filter Random Cravings content"
          className="inline-flex items-center p-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm"
        >
          <FilterPill
            active={contentFilter === "all"}
            onClick={() => setContentFilter("all")}
            label="All content"
          />
          <FilterPill
            active={contentFilter === "free"}
            onClick={() => setContentFilter("free")}
            label="Free content"
          />
        </div>
      </div>

      <div className="absolute top-1/2 -left-3 -translate-y-1/2 z-10 hidden md:block">
        <button
          onClick={() => scroll(-1)}
          className="p-2 bg-eeriecast-surface-light/80 hover:bg-eeriecast-surface-lighter border border-white/[0.06] rounded-full transition-all shadow-lg backdrop-blur-sm"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
      </div>
      <div className="absolute top-1/2 -right-3 -translate-y-1/2 z-10 hidden md:block">
        <button
          onClick={() => scroll(1)}
          className="p-2 bg-eeriecast-surface-light/80 hover:bg-eeriecast-surface-lighter border border-white/[0.06] rounded-full transition-all shadow-lg backdrop-blur-sm"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {visibleThemes.map((theme) => (
          <CloudCard
            key={theme.id}
            theme={theme}
            pool={enrichedPool}
            contentFilter={contentFilter}
            isEpisodeFree={isEpisodeFree}
            onItemClick={handleItemClick}
          />
        ))}
      </div>
    </div>
  );
}

EpisodeCloudsRow.propTypes = {
  onAddToPlaylist: PropTypes.func,
};

/* ───────────────────────────────────────────────────────────────
   Content filter pill (All / Free)
   ─────────────────────────────────────────────────────────────── */

function FilterPill({ active, onClick, label }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-3 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-full transition-all duration-300 ${
        active
          ? "bg-white text-black shadow-[0_2px_10px_-2px_rgba(255,255,255,0.35)]"
          : "text-zinc-400 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

FilterPill.propTypes = {
  active: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  label: PropTypes.string.isRequired,
};

/* ───────────────────────────────────────────────────────────────
   Single cloud card
   ─────────────────────────────────────────────────────────────── */

function CloudCard({ theme, pool, contentFilter, isEpisodeFree, onItemClick }) {
  const { Icon } = theme;
  const [hoverIdx, setHoverIdx] = useState(null);

  // Each card owns its own dice state — this is what makes a dice click
  // affect only its card. Tokens are monotonic so the dice icon can just
  // animate `rotate: rollCount * 360` and keep spinning forward.
  const [rollCount, setRollCount] = useState(0);

  // Keep the previous roll's episode IDs so the next roll actively
  // avoids repeating them. Using a ref instead of state so updating it
  // during item computation doesn't kick off another render pass.
  const lastPicksRef = useRef(new Set());

  // Every candidate episode for this theme, filtered by content mode.
  // Memoized separately from the pick so we don't recompute the filter
  // on every dice roll.
  const episodeMatches = useMemo(() => {
    let list = pool.filter((ep) => hasCategory(ep.podcast_data, theme.category));
    if (contentFilter === "free") list = list.filter(isEpisodeFree);
    return list;
  }, [pool, theme.category, contentFilter, isEpisodeFree]);

  // The actual 5-item cluster. Recomputes when the pool/filter changes
  // OR when this specific card's rollCount ticks up. Sibling cards'
  // rollCounts are irrelevant here, which is exactly what fixes the
  // "click one dice, all clouds reshuffle" bug.
  const items = useMemo(() => {
    const picks = pickCloudEpisodes(episodeMatches, lastPicksRef.current);
    // Remember this roll's IDs for the *next* pickCloudEpisodes call.
    lastPicksRef.current = new Set(picks.map((p) => p.id));
    return picks.map((ep) => ({
      kind: "episode",
      id: `ep-${ep.id}`,
      title: ep.title,
      cover_image: ep.cover_image,
      episode: ep,
      podcast: ep.podcast_data,
      is_free: isEpisodeFree(ep),
    }));
    // rollCount is an intentional dependency even though it's not used
    // inside — it's the "roll me again" trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeMatches, rollCount, isEpisodeFree]);

  const featured = items[0];
  const active = hoverIdx != null ? items[hoverIdx] : featured;

  // Whenever a reshuffle happens the item set changes under our feet;
  // clearing the hover index prevents a stale footer label from
  // pointing at an item that's mid-exit animation.
  useEffect(() => {
    setHoverIdx(null);
  }, [rollCount]);

  const handleRoll = useCallback(() => {
    setRollCount((n) => n + 1);
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      className="relative flex-shrink-0 w-[270px] sm:w-[290px] h-[340px] rounded-2xl overflow-hidden group"
      style={{
        // Deep base so the themed gradient reads like vapor over void.
        background:
          "linear-gradient(160deg, rgba(23,23,27,0.95) 0%, rgba(10,10,14,0.98) 100%)",
      }}
    >
      {/* Layered ambient background:
          1. Static themed gradient wash for base color identity.
          2. Slowly shimmering diagonal gradient for a subtle sheen.
          3. A slow-rotating conic sweep that casts faint theme light
             around the edges — this is what gives the card its
             "alive" feeling without being distracting.
          4. Two drifting, pulsing blurred blobs in the theme color.
          5. A faint vignette so text reads cleanly over everything. */}
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${theme.gradientClass} opacity-90`}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-screen"
        style={{
          backgroundImage: `linear-gradient(115deg, transparent 0%, ${theme.accent}33 40%, transparent 80%)`,
          backgroundSize: "300% 300%",
          animation: "ec-shimmer 14s ease-in-out infinite",
        }}
      />
      <div
        className="pointer-events-none absolute -inset-1/4 opacity-[0.22]"
        style={{
          background: `conic-gradient(from 0deg at 50% 50%, transparent 0deg, ${theme.accent}55 90deg, transparent 180deg, ${theme.accent}33 270deg, transparent 360deg)`,
          animation: "ec-conic 28s linear infinite",
        }}
      />
      <div
        className="pointer-events-none absolute -top-10 -right-10 w-56 h-56 rounded-full blur-3xl"
        style={{
          background: theme.glow,
          animation: "ec-drift 9s ease-in-out infinite, ec-pulse 7s ease-in-out infinite",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-10 w-64 h-64 rounded-full blur-3xl"
        style={{
          background: theme.glow,
          animation: "ec-drift 11s ease-in-out infinite reverse, ec-pulse 9s ease-in-out infinite",
          opacity: 0.55,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 120%, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 60%)",
        }}
      />

      {/* thin hover border accent in the theme's color */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl border border-white/[0.06] group-hover:border-white/[0.12] transition-colors duration-500"
      />

      {/* Header */}
      <div className="relative px-4 pt-4 flex items-start justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}55)`,
              boxShadow: `0 4px 14px -4px ${theme.glow}`,
            }}
          >
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[13px] font-bold text-white leading-tight truncate">
              {theme.title}
            </h3>
            <p className="text-[10px] text-zinc-400/80 uppercase tracking-wider truncate">
              {theme.subtitle}
            </p>
          </div>
        </div>
        {/* Dice roll button. The icon spins a full 360° per click (we
            drive it off the cumulative rollCount so successive clicks
            keep rolling in the same direction rather than snapping
            back). whileTap gives it a satisfying little squish. The
            handler ONLY touches this card's local rollCount — sibling
            clouds are unaffected. */}
        <motion.button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleRoll();
          }}
          aria-label="Roll new picks"
          whileTap={{ scale: 0.82 }}
          whileHover={{ scale: 1.08 }}
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.16] border border-white/[0.05] text-zinc-300 hover:text-white transition-colors duration-300"
          style={{
            boxShadow:
              rollCount > 0
                ? `0 0 0 1px ${theme.accent}44, 0 4px 12px -4px ${theme.glow}`
                : "none",
          }}
        >
          <motion.span
            className="inline-flex"
            animate={{ rotate: rollCount * 360 }}
            transition={{ type: "spring", stiffness: 180, damping: 14, mass: 0.6 }}
          >
            <Dices className="w-3.5 h-3.5" />
          </motion.span>
        </motion.button>
      </div>

      {/* Cluster — the "cloud" itself.
          Each bubble is wrapped in a motion element inside AnimatePresence
          so a reshuffle feels like a physical handful being tossed: the
          old picks tumble out (reverse-staggered, slight spin) and the
          new ones spring in (forward-staggered from a tiny scale). We
          intentionally keep the gentle float on an *inner* wrapper so
          its CSS transform can't collide with framer's transform. */}
      <div className="relative mx-auto mt-2 w-full h-[190px]">
        <AnimatePresence mode="popLayout" initial={false}>
          {items.slice(0, CLUSTER_LAYOUT.length).map((item, idx) => {
            const pos = CLUSTER_LAYOUT[idx];
            const isActive = hoverIdx === idx;
            const isFeatured = idx === 0;
            // Alternate tumble direction by index so the exit doesn't
            // look mechanical — odd bubbles spin one way, even the other.
            const tumble = (idx % 2 === 0 ? 1 : -1) * (isFeatured ? 25 : 55);
            const incomingTilt = (idx % 2 === 0 ? -1 : 1) * (isFeatured ? 15 : 45);
            const exitCount = Math.max(1, CLUSTER_LAYOUT.length);
            return (
              <motion.div
                key={item.id}
                layout
                initial={{
                  opacity: 0,
                  scale: 0.15,
                  rotate: incomingTilt,
                  y: isFeatured ? 14 : -10,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  rotate: 0,
                  y: 0,
                  transition: {
                    type: "spring",
                    stiffness: isFeatured ? 240 : 300,
                    damping: isFeatured ? 16 : 18,
                    mass: 0.9,
                    // Forward stagger so the featured cover lands first
                    // and the smaller ones pop in around it like spray.
                    delay: idx * 0.07,
                  },
                }}
                exit={{
                  opacity: 0,
                  scale: 0.1,
                  rotate: tumble,
                  y: 18,
                  transition: {
                    duration: 0.28,
                    ease: [0.4, 0, 1, 0.4],
                    // Reverse stagger on the way out — outer bubbles
                    // leave first, featured last — which reads as
                    // "clearing the deck" before the reroll lands.
                    delay: (exitCount - 1 - idx) * 0.04,
                  },
                }}
                className="absolute"
                style={{
                  top: `calc(${pos.cy}% - ${pos.size / 2}px)`,
                  left: `calc(${pos.cx}% - ${pos.size / 2}px)`,
                  width: pos.size,
                  height: pos.size,
                  zIndex: pos.z + (isActive ? 10 : 0),
                }}
              >
                {/* Floating inner wrapper: gentle vertical bob on its
                    own independent rhythm. Kept separate so framer
                    owns the outer element's transform exclusively. */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    animation: "ec-float 5.5s ease-in-out infinite",
                    animationDelay: pos.delay,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onItemClick(item)}
                    onMouseEnter={() => setHoverIdx(idx)}
                    onMouseLeave={() => setHoverIdx(null)}
                    onFocus={() => setHoverIdx(idx)}
                    onBlur={() => setHoverIdx(null)}
                    aria-label={item.title}
                    className="absolute inset-0 rounded-full overflow-hidden focus:outline-none transition-[box-shadow,transform] duration-300 hover:scale-[1.06]"
                    style={{
                      boxShadow: isFeatured
                        ? `0 10px 30px -10px ${theme.glow}, 0 0 0 2px ${theme.accent}44`
                        : `0 6px 18px -8px rgba(0,0,0,0.6)`,
                    }}
                  >
                    {/* Cover */}
                    {item.cover_image ? (
                      <img
                        src={item.cover_image}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{
                          background: `linear-gradient(135deg, ${theme.accent}88, ${theme.accent}22)`,
                        }}
                      >
                        <Icon className="w-5 h-5 text-white/80" />
                      </div>
                    )}

                    {/* Hover scrim + play glyph on the active / featured cover */}
                    <div
                      className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
                      style={{
                        background:
                          "radial-gradient(circle at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 70%)",
                        opacity: isActive || isFeatured ? 1 : 0,
                      }}
                    >
                      <Play
                        className="fill-white text-white drop-shadow"
                        style={{ width: pos.size * 0.28, height: pos.size * 0.28 }}
                      />
                    </div>

                    {/* Themed ring that only shows on hover/focus for
                        non-featured thumbnails — makes it feel responsive
                        without clutter. */}
                    {!isFeatured && isActive && (
                      <div
                        className="absolute inset-0 rounded-full pointer-events-none"
                        style={{ boxShadow: `0 0 0 2px ${theme.accent}88` }}
                      />
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Footer — shows whichever cover is currently hovered (or the
          featured one by default) so there's always a readable label. */}
      <div className="absolute bottom-0 inset-x-0 px-4 pb-4 pt-8 pointer-events-none bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <p
          className="text-[11px] font-medium uppercase tracking-wider truncate"
          style={{ color: theme.accent }}
        >
          {active?.podcast?.title || active?.podcast?.name || ""}
        </p>
        <p className="text-sm font-semibold text-white leading-tight line-clamp-2 mt-0.5">
          {active?.title || ""}
        </p>
      </div>
    </div>
  );
}

CloudCard.propTypes = {
  theme: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    subtitle: PropTypes.string,
    category: PropTypes.string.isRequired,
    Icon: PropTypes.elementType.isRequired,
    gradientClass: PropTypes.string,
    accent: PropTypes.string,
    glow: PropTypes.string,
  }).isRequired,
  pool: PropTypes.array.isRequired,
  contentFilter: PropTypes.string,
  isEpisodeFree: PropTypes.func.isRequired,
  onItemClick: PropTypes.func.isRequired,
};
