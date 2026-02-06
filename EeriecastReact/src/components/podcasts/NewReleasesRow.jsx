import { useRef, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import { createPageUrl } from "@/utils";
import { ChevronLeft, ChevronRight, Play, Lock } from "lucide-react";
import { Episode as EpisodeApi } from "@/api/entities";
import { usePodcasts } from "@/context/PodcastContext.jsx";
import { isAudiobook, formatDate } from "@/lib/utils";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";
import { toast } from "@/components/ui/use-toast";

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

export default function NewReleasesRow({ title, viewAllTo, categoryFilter }) {
  const scrollRef = useRef(null);
  const navigate = useNavigate();
  const { podcasts, getById } = usePodcasts();
  const { loadAndPlay } = useAudioPlayerContext();
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Build a set of audiobook podcast IDs for filtering
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const resp = await EpisodeApi.list("-published_at", 40);
        const allEps = Array.isArray(resp) ? resp : (resp?.results || []);

        // Filter out audiobook episodes and enrich with podcast data
        const audiobookIds = new Set(
          podcasts.filter((p) => isAudiobook(p)).map((p) => p.id)
        );

        let enriched = allEps
          .filter((ep) => {
            const podId = typeof ep.podcast === "object" ? ep.podcast?.id : ep.podcast;
            return !audiobookIds.has(podId);
          })
          .map((ep) => {
            const podId = typeof ep.podcast === "object" ? ep.podcast?.id : ep.podcast;
            const podcastData = getById(podId);
            return {
              ...ep,
              podcast_id: podId,
              podcast_data: podcastData || (typeof ep.podcast === "object" ? ep.podcast : null),
              cover_image: ep.cover_image || podcastData?.cover_image || "",
            };
          });

        // Optional category filter
        if (categoryFilter) {
          const lower = categoryFilter.toLowerCase();
          enriched = enriched.filter((ep) => {
            const pd = ep.podcast_data;
            if (!pd) return true;
            const cats = Array.isArray(pd.categories)
              ? pd.categories.map((c) => (typeof c === "string" ? c : c?.name || "").toLowerCase())
              : [];
            return cats.some((c) => c.includes(lower));
          });
        }

        if (!cancelled) {
          setEpisodes(enriched.slice(0, 20));
        }
      } catch (err) {
        console.error("Failed to load new releases:", err);
        if (!cancelled) setEpisodes([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [podcasts, getById, categoryFilter]);

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
        toast({ title: "Unable to play", description: "Please sign in to play episodes.", variant: "destructive" });
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
        {episodes.map((ep) => {
          const podName = ep.podcast_data?.title || "";
          const dur = formatDuration(ep.duration);

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
                      className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105 group-hover:brightness-110"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-eeriecast-surface-light to-eeriecast-surface">
                      <span className="text-3xl opacity-40">🎧</span>
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

                  {/* Members-only / Premium badge */}
                  {(ep.podcast_data?.is_exclusive || ep.is_premium) && (
                    <div className="absolute top-2 right-2">
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-black/70 backdrop-blur-sm border border-yellow-500/30 rounded-full text-[9px] font-semibold text-yellow-400 shadow-lg">
                        <Lock className="w-2.5 h-2.5" />
                        <span>Members</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 space-y-1 mt-auto min-h-[4rem] flex flex-col justify-end">
                  <h3 className="text-white/90 font-semibold text-xs line-clamp-2 leading-tight group-hover:text-red-400 transition-colors duration-300">
                    {ep.title}
                  </h3>
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
};
