/**
 * Music landing page.
 *
 * Phase 1: a small, curated surface for exclusive music artists. The catalog
 * is expected to start at 1–3 artists with ~100 tracks between them, so the
 * page is intentionally simple:
 *   1. Hero band with artist count + disc icon.
 *   2. Grid of artist cards (ShowCard-style), each linking to the artist
 *      detail page (/Episodes?id=...) where users pick a track to play.
 *   3. "Latest Tracks" row — episodes from every music show, newest first.
 *
 * When the music category outgrows a single landing page (~5+ artists or
 * dozens of albums), this is the natural place to introduce tabs/filters
 * mirroring the Audiobooks page.
 */
import { useMemo, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Music as MusicIcon, Play, Disc3 } from "lucide-react";
import { createPageUrl } from "@/utils";
import { usePodcasts } from "@/context/PodcastContext.jsx";
import { useUser } from "@/context/UserContext.jsx";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";
import { useToast } from "@/components/ui/use-toast";
import ShowCard from "@/components/discover/ShowCard";
import ShowGrid from "@/components/ui/ShowGrid";
import { Episode as EpisodeApi } from "@/api/entities";
import { qk } from "@/lib/queryClient";
import { isMusic, formatDate } from "@/lib/utils";

function formatDuration(raw) {
  if (raw == null) return "";
  let totalSeconds;
  if (typeof raw === "number") {
    totalSeconds = Math.floor(raw);
  } else if (typeof raw === "string") {
    const parts = raw.split(":").map(Number);
    if (parts.some(Number.isNaN)) return raw;
    if (parts.length === 3) totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) totalSeconds = parts[0] * 60 + parts[1];
    else totalSeconds = parts[0];
  } else {
    return String(raw);
  }
  if (totalSeconds < 0) return "0:00";
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function trackCountLabel(p) {
  const n = p?.episode_count ?? p?.episodes_count ?? p?.total_episodes ?? 0;
  if (!Number.isFinite(Number(n)) || Number(n) <= 0) return "";
  return `${n} track${n === 1 ? "" : "s"}`;
}

export default function Music() {
  const navigate = useNavigate();
  const { podcasts, isLoading: podcastsLoading, getById, softRefreshIfStale } = usePodcasts();
  const { isAuthenticated } = useUser() || {};
  const { loadAndPlay } = useAudioPlayerContext();
  const { toast } = useToast();

  // New artists / newly-uploaded tracks have to appear here without a
  // full page reload, so kick a soft refresh on mount.
  useEffect(() => { softRefreshIfStale(15_000); }, [softRefreshIfStale]);

  const artists = useMemo(
    () => (podcasts || []).filter((p) => isMusic(p)),
    [podcasts],
  );
  const artistIds = useMemo(() => new Set(artists.map((a) => a.id)), [artists]);

  // Reuse the app-wide "latest episodes" cache (same key as the Podcasts
  // homepage's New Releases row) and filter to music-only client-side. No
  // extra request, no stale-while-revalidate flicker when navigating back.
  const fetchLimit = 60;
  const { data: latestRaw = [], isLoading: latestLoading } = useQuery({
    queryKey: qk.episodes.feed("latest", {
      ordering: "-published_at",
      fetchLimit,
    }),
    queryFn: async () => {
      const resp = await EpisodeApi.list("-published_at", fetchLimit);
      return Array.isArray(resp) ? resp : resp?.results || [];
    },
  });

  const latestTracks = useMemo(() => {
    if (!artistIds.size) return [];
    return latestRaw
      .filter((ep) => {
        const podId = typeof ep.podcast === "object" ? ep.podcast?.id : ep.podcast;
        return artistIds.has(podId);
      })
      .map((ep) => {
        const podId = typeof ep.podcast === "object" ? ep.podcast?.id : ep.podcast;
        const pod = getById(podId);
        return {
          ...ep,
          podcast_id: podId,
          podcast_data: pod || (typeof ep.podcast === "object" ? ep.podcast : null),
          cover_image: ep.cover_image || pod?.cover_image || "",
        };
      })
      .slice(0, 20);
  }, [latestRaw, artistIds, getById]);

  const handleArtistOpen = (podcast) => {
    if (podcast?.id) {
      navigate(`${createPageUrl("Episodes")}?id=${encodeURIComponent(podcast.id)}`);
    }
  };

  const handleTrackPlay = async (ep) => {
    const pod = ep.podcast_data || getById(ep.podcast_id);
    if (!pod) {
      if (ep.podcast_id) {
        navigate(`${createPageUrl("Episodes")}?id=${encodeURIComponent(ep.podcast_id)}`);
      }
      return;
    }
    const played = await loadAndPlay({ podcast: pod, episode: ep, resume: { progress: 0 } });
    if (played === false) {
      toast({
        title: "Unable to play",
        description: isAuthenticated
          ? "This track doesn't have audio available yet."
          : "Please sign in to play tracks.",
        variant: "destructive",
      });
    }
  };

  const isLoading = podcastsLoading;

  return (
    <div className="min-h-screen bg-eeriecast-surface text-white px-2.5 lg:px-10 py-8">
      {/* Header */}
      <div className="mb-8 relative overflow-hidden rounded-2xl border border-white/[0.05] p-6 md:p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-900/30 via-[#12101c] to-[#0d0f18]" />
        <div className="absolute -top-16 -right-10 w-72 h-72 rounded-full bg-fuchsia-500/10 blur-[100px]" />
        <div className="absolute -bottom-20 -left-10 w-60 h-60 rounded-full bg-purple-600/10 blur-[90px]" />
        <div className="relative flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-fuchsia-500/15 border border-fuchsia-500/20 flex items-center justify-center">
            <MusicIcon className="w-6 h-6 md:w-7 md:h-7 text-fuchsia-300" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.2em] text-fuchsia-300/70 uppercase mb-1">
              Exclusive
            </p>
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-1">Music</h1>
            <p className="text-zinc-400 text-sm md:text-base max-w-xl">
              Original music from Eeriecast artists — full tracks for members, samples for
              everyone.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="aspect-square bg-eeriecast-surface-light/50 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : artists.length === 0 ? (
        <div className="text-center py-24">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/15 mb-4">
            <Disc3 className="w-7 h-7 text-fuchsia-300/80" />
          </div>
          <p className="text-zinc-400 text-lg mb-1">No music available yet.</p>
          <p className="text-zinc-600 text-sm">Check back soon — artists are coming.</p>
        </div>
      ) : (
        <>
          {/* Artists */}
          <section className="mb-10">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="text-xl md:text-2xl font-bold text-white">
                Artists{" "}
                <span className="text-sm text-zinc-600 font-normal">
                  ({artists.length})
                </span>
              </h2>
            </div>
            <ShowGrid>
              {artists.map((artist) => (
                <ShowCard
                  key={artist.id}
                  podcast={artist}
                  onPlay={handleArtistOpen}
                  subtext={trackCountLabel(artist)}
                />
              ))}
            </ShowGrid>
          </section>

          {/* Latest Tracks */}
          {latestTracks.length > 0 && (
            <section className="mb-10">
              <div className="flex items-baseline justify-between mb-5">
                <h2 className="text-xl md:text-2xl font-bold text-white">Latest Tracks</h2>
                {latestLoading && (
                  <span className="text-xs text-zinc-600">Loading...</span>
                )}
              </div>
              <ul className="divide-y divide-white/[0.04] border border-white/[0.04] rounded-xl overflow-hidden bg-white/[0.02]">
                {latestTracks.map((ep, idx) => {
                  const artistName = ep.podcast_data?.title || "";
                  const dur = formatDuration(ep.duration);
                  return (
                    <li
                      key={ep.id}
                      className="group flex items-center gap-3 px-3 md:px-4 py-3 hover:bg-white/[0.03] transition-colors"
                    >
                      <span className="w-6 text-right text-xs font-semibold text-zinc-600 tabular-nums">
                        {idx + 1}
                      </span>
                      <div className="relative flex-shrink-0 w-11 h-11 rounded-md overflow-hidden bg-eeriecast-surface-light">
                        {ep.cover_image ? (
                          <img
                            src={ep.cover_image}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <MusicIcon className="w-4 h-4 text-zinc-600" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleTrackPlay(ep)}
                          aria-label={`Play ${ep.title}`}
                          className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Play className="w-4 h-4 text-white fill-white" />
                        </button>
                      </div>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => handleTrackPlay(ep)}
                          className="block w-full text-left text-sm font-medium text-white/90 hover:text-white truncate"
                        >
                          {ep.title}
                        </button>
                        <Link
                          to={
                            ep.podcast_id
                              ? `${createPageUrl("Episodes")}?id=${encodeURIComponent(ep.podcast_id)}`
                              : "#"
                          }
                          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors truncate block"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {artistName}
                        </Link>
                      </div>
                      <div className="hidden sm:block text-xs text-zinc-600 min-w-[5rem] text-right">
                        {formatDate(ep.published_at)}
                      </div>
                      {dur && (
                        <div className="text-xs text-zinc-600 tabular-nums min-w-[3rem] text-right">
                          {dur}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}

      <div className="pb-24" />
    </div>
  );
}
