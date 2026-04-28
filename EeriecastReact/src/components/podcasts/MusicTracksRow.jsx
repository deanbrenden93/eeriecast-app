import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import { ChevronLeft, ChevronRight, Play, Pause, Crown, Music } from "lucide-react";
import { createPageUrl } from "@/utils";
import { usePodcasts } from "@/context/PodcastContext.jsx";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";
import { useUser } from "@/context/UserContext.jsx";
import { isMusic, getEpisodeAudioUrl } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import EpisodeMenu from "@/components/podcasts/EpisodeMenu";
import ScrollingTitle from "@/components/common/ScrollingTitle";

/**
 * Format a seconds (or mm:ss) duration into compact "m:ss" / "h:mm:ss".
 *
 * Tracks are usually minutes, so this prioritizes a short, readable
 * label over an exhaustive one. Returns null when the value is missing
 * / unparseable so callers can hide the slot instead of rendering "0:00".
 */
function formatDuration(raw) {
  if (raw == null || raw === "") return null;
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
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return null;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Music Tracks row — replaces the old "artists as cards" row on the
 * home screen.
 *
 * Product intent:
 *   • Break up the monotony of square "show" thumbnails with tall,
 *     chip-style track cards (artwork on the left, metadata on the
 *     right). Cards are rectangular and intentionally look different
 *     from every other row above them.
 *   • Each track is playable directly, so a listener doesn't have to
 *     enter an artist page to start a song.
 *   • Members-only tracks are visually called out with a crown pill.
 *   • Resumes in progress get an ambient progress bar below the title,
 *     mirroring the Keep Listening row and every episode table.
 *
 * Data: pulled from the already-cached `usePodcasts` list. Music
 * podcasts come with their episodes embedded in the list serializer,
 * so we flatten + sort + slice without any extra network round-trip.
 */
export default function MusicTracksRow({
  title,
  viewAllTo,
  maxItems = 40,
  onAddToPlaylist,
}) {
  const scrollRef = useRef(null);
  const navigate = useNavigate();
  const { podcasts } = usePodcasts();
  const { loadAndPlay, episode: currentEpisode, isPlaying, toggle } = useAudioPlayerContext();
  const { isAuthenticated, episodeProgressMap } = useUser() || {};

  // Per-mount seed so the row re-shuffles whenever the user revisits
  // the home screen (different lineup every time) but stays stable
  // while they're scrolling through it. Without this, a stable
  // `useMemo` over the podcast list would lock the same random ordering
  // for the whole session.
  const [shuffleSeed] = useState(() => Math.random());

  const tracks = useMemo(() => {
    const out = [];
    for (const p of podcasts || []) {
      if (!isMusic(p)) continue;
      const eps = Array.isArray(p.episodes) ? p.episodes : p.episodes?.results;
      if (!Array.isArray(eps) || eps.length === 0) continue;
      for (const ep of eps) {
        if (!ep?.id) continue;
        out.push({
          id: ep.id,
          title: ep.title || "Untitled",
          artist: p.title || p.name || "",
          cover_image: ep.cover_image || p.cover_image || "",
          duration: ep.duration,
          is_members: !!(ep.is_premium || p.is_exclusive),
          is_premium_ep: !!ep.is_premium,
          episode: ep,
          podcast: p,
        });
      }
    }
    // Random selection rather than newest-first. Music is
    // discovery-oriented on the home screen — "what should I listen to
    // right now?" — so a fresh sample of the catalog every visit beats
    // an unchanging chronological list. Reference the seed so React's
    // lint sees we depend on it.
    void shuffleSeed;
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out.slice(0, maxItems);
  }, [podcasts, maxItems, shuffleSeed]);

  const scroll = useCallback((direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.offsetWidth * 0.8;
    el.scrollBy({ left: direction * amount, behavior: "smooth" });
  }, []);

  const handlePlay = useCallback(
    async (track) => {
      if (!track) return;
      // If the user taps the currently playing track, toggle pause/play
      // instead of restarting it — consistent with music-app expectations.
      if (currentEpisode?.id === track.episode?.id) {
        toggle?.();
        return;
      }
      const played = await loadAndPlay({
        podcast: track.podcast,
        episode: track.episode,
        resume: { progress: 0 },
      });
      if (played === false) {
        toast({
          title: "Unable to play",
          description: isAuthenticated
            ? getEpisodeAudioUrl(track.episode)
              ? "We couldn't start this track. Please try again."
              : "This track doesn't have audio available yet."
            : "Please sign in to play tracks.",
          variant: "destructive",
        });
      }
    },
    [loadAndPlay, toggle, currentEpisode, isAuthenticated],
  );

  if (!tracks.length) return null;

  return (
    <div className="relative">
      <style>{`
        @keyframes mt-bar-1 { 0%,100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }
        @keyframes mt-bar-2 { 0%,100% { transform: scaleY(0.8); }  50% { transform: scaleY(0.4); } }
        @keyframes mt-bar-3 { 0%,100% { transform: scaleY(0.55); } 50% { transform: scaleY(0.9); } }
      `}</style>

      <div className="flex justify-between items-center mb-5">
        {title}
        {viewAllTo && (
          <Link
            to={viewAllTo}
            className="text-sm text-zinc-500 hover:text-fuchsia-400 transition-colors duration-300"
          >
            View all
          </Link>
        )}
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

      {/* Two-row staggered grid on desktop so the list feels dense
          without forcing an enormous horizontal scroll. Mobile falls
          back to a single row. */}
      <div
        ref={scrollRef}
        className="overflow-x-auto pb-4 scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div
          className="grid grid-flow-col gap-3 auto-cols-[minmax(280px,320px)]"
          style={{ gridTemplateRows: "repeat(2, minmax(0, 1fr))" }}
        >
          {tracks.map((track) => {
            const isCurrent = currentEpisode?.id === track.episode?.id;
            const prog = episodeProgressMap?.get?.(Number(track.id));
            const pct =
              prog && prog.duration > 0
                ? Math.min(100, Math.max(0, (prog.progress / prog.duration) * 100))
                : 0;
            const durationLabel = formatDuration(track.duration);

            return (
              <TrackCard
                key={track.id}
                track={track}
                durationLabel={durationLabel}
                progressPct={pct}
                isCurrent={isCurrent}
                isPlaying={isCurrent && !!isPlaying}
                onPlay={() => handlePlay(track)}
                onOpenArtist={() => {
                  if (track.podcast?.id) {
                    navigate(`${createPageUrl("Episodes")}?id=${encodeURIComponent(track.podcast.id)}`);
                  }
                }}
                onAddToPlaylist={onAddToPlaylist}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

MusicTracksRow.propTypes = {
  title: PropTypes.node,
  viewAllTo: PropTypes.string,
  maxItems: PropTypes.number,
  onAddToPlaylist: PropTypes.func,
};

/* ───────────────────────────────────────────────────────────────
   Individual track chip
   ─────────────────────────────────────────────────────────────── */

function TrackCard({
  track,
  durationLabel,
  progressPct,
  isCurrent,
  isPlaying,
  onPlay,
  onOpenArtist,
  onAddToPlaylist,
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border transition-all duration-300 group cursor-pointer flex items-center gap-3 p-2.5 h-20 ${
        isCurrent
          ? "bg-fuchsia-500/10 border-fuchsia-400/20 shadow-[0_0_20px_-6px_rgba(217,70,239,0.35)]"
          : "bg-white/[0.03] border-white/[0.05] hover:bg-white/[0.06] hover:border-white/[0.1]"
      }`}
      onClick={onPlay}
    >
      {/* Ambient color-wash using the cover art — gives each card a
          subtle unique tint without requiring designed backgrounds. */}
      {track.cover_image && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12] blur-2xl scale-110"
          style={{ backgroundImage: `url(${track.cover_image})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
      )}

      {/* Cover + play overlay */}
      <div className="relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden ring-1 ring-white/[0.08]">
        {track.cover_image ? (
          <img src={track.cover_image} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-fuchsia-500/30 to-purple-900/40 flex items-center justify-center">
            <Music className="w-5 h-5 text-white/80" />
          </div>
        )}

        {/* When this track is currently playing, render an animated
            equalizer bar pattern over the cover so the listener can
            visually track which row is active at a glance. */}
        {isCurrent && isPlaying ? (
          <div className="absolute inset-0 bg-black/55 flex items-end justify-center gap-[3px] pb-2">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="w-[3px] bg-fuchsia-300/90 rounded-sm origin-bottom"
                style={{
                  height: "18px",
                  animation: `${i % 3 === 0 ? "mt-bar-1" : i % 3 === 1 ? "mt-bar-2" : "mt-bar-3"} ${
                    0.9 + (i % 3) * 0.15
                  }s ease-in-out infinite`,
                  animationDelay: `${i * 0.08}s`,
                }}
              />
            ))}
          </div>
        ) : (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            {isCurrent && !isPlaying ? (
              <Pause className="w-5 h-5 fill-white text-white" />
            ) : (
              <Play className="w-5 h-5 fill-white text-white ml-0.5" />
            )}
          </div>
        )}
      </div>

      {/* Text column */}
      <div className="relative flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <ScrollingTitle
            as="p"
            text={track.title}
            className={`text-[13px] font-semibold leading-tight ${
              isCurrent ? "text-fuchsia-100" : "text-white"
            }`}
          />
          {track.is_members && (
            // Icon-only members indicator — the full "Members" pill was
            // eating ~60px on a 280px card and truncating track titles.
            // Keep the semantic via aria-label + native tooltip so it's
            // still discoverable to assistive tech and on hover.
            <span
              aria-label="Members-only track"
              title="Members-only"
              className="inline-flex items-center justify-center w-4 h-4 rounded-full text-amber-300/90 bg-amber-500/10 border border-amber-400/20 flex-shrink-0"
            >
              <Crown className="w-2.5 h-2.5" />
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenArtist?.();
          }}
          className="block max-w-full text-[11px] text-zinc-400 hover:text-fuchsia-300 truncate transition-colors mt-0.5 text-left"
        >
          {track.artist}
        </button>

        {/* Bottom meta row: progress bar (or neutral runtime bar as a
            placeholder when the user hasn't played yet) + duration label. */}
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 h-[3px] bg-white/[0.07] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progressPct > 0
                  ? "bg-gradient-to-r from-fuchsia-400 to-purple-400"
                  : isCurrent
                    ? "bg-fuchsia-400/40"
                    : "bg-white/[0.08]"
              }`}
              style={{
                width: progressPct > 0 ? `${progressPct}%` : isCurrent ? "100%" : "100%",
              }}
            />
          </div>
          {durationLabel && (
            <span className="text-[10px] text-zinc-500 tabular-nums flex-shrink-0">
              {durationLabel}
            </span>
          )}
        </div>
      </div>

      {/* Episode menu — add to queue / playlist / etc. */}
      <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
        <EpisodeMenu
          episode={track.episode}
          podcast={track.podcast}
          onAddToPlaylist={onAddToPlaylist}
          className="bg-black/30 backdrop-blur-sm"
          side="bottom"
        />
      </div>
    </div>
  );
}

TrackCard.propTypes = {
  track: PropTypes.object.isRequired,
  durationLabel: PropTypes.string,
  progressPct: PropTypes.number,
  isCurrent: PropTypes.bool,
  isPlaying: PropTypes.bool,
  onPlay: PropTypes.func.isRequired,
  onOpenArtist: PropTypes.func,
  onAddToPlaylist: PropTypes.func,
};
