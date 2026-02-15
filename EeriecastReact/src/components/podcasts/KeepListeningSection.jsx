import { useRef } from "react";
import { Link } from "react-router-dom";
import PropTypes from 'prop-types';
import { createPageUrl } from "@/utils";
import { ChevronLeft, ChevronRight, Play, Lock } from "lucide-react";
import EpisodeMenu from "@/components/podcasts/EpisodeMenu";

export default function KeepListeningSection({
  items,
  onEpisodePlay,
  currentEpisodeId,
  currentTime = 0,
  currentDuration = 0,
  onAddToPlaylist,
}) {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    const { current } = scrollRef;
    if (current) {
      const scrollAmount = current.offsetWidth * 0.8;
      current.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
    }
  };

  const livePct = currentDuration > 0 ? Math.max(0, Math.min(100, (currentTime / currentDuration) * 100)) : null;

  if (!items || items.length === 0) return null;

  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-2xl font-bold text-white">Keep Listening</h2>
        <Link to={`${createPageUrl('Library')}?tab=History`} className="text-sm text-zinc-500 hover:text-red-400 transition-colors duration-300">
          View all
        </Link>
      </div>

      <div className="absolute top-1/2 -left-3 -translate-y-1/2 z-10 hidden md:block">
        <button onClick={() => scroll(-1)} className="p-2 bg-eeriecast-surface-light/80 hover:bg-eeriecast-surface-lighter border border-white/[0.06] rounded-full transition-all shadow-lg backdrop-blur-sm">
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
      </div>
      <div className="absolute top-1/2 -right-3 -translate-y-1/2 z-10 hidden md:block">
        <button onClick={() => scroll(1)} className="p-2 bg-eeriecast-surface-light/80 hover:bg-eeriecast-surface-lighter border border-white/[0.06] rounded-full transition-all shadow-lg backdrop-blur-sm">
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      </div>

      <div 
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-4 scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item) => {
          const { podcast, episode, progress = 0 } = item;
          const isCurrentlyPlaying = episode.id === currentEpisodeId;
          const pct = isCurrentlyPlaying && livePct !== null ? livePct : progress;
          const cover = episode.cover_image || podcast?.cover_image;

          return (
            <div
              key={episode.id}
              className="flex-shrink-0 cursor-pointer group w-36"
              onClick={() => onEpisodePlay(item)}
            >
              <div className="eeriecast-card h-full flex flex-col overflow-hidden">
                {/* Cover image with play overlay */}
                <div className="relative bg-eeriecast-surface-light">
                  <div className="aspect-square overflow-hidden rounded-t-lg">
                    {cover ? (
                      <img
                        src={cover}
                        alt={episode.title}
                        className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105 group-hover:brightness-110"
                      />
                    ) : (
                      <div className="w-full h-full cover-shimmer" />
                    )}
                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                        <Play className="w-5 h-5 text-black fill-black ml-0.5" />
                      </div>
                    </div>

                    {/* Three-dot menu */}
                    <div className="absolute bottom-1.5 right-1.5 z-[5]" onClick={(e) => e.stopPropagation()}>
                      <EpisodeMenu episode={episode} podcast={podcast} onAddToPlaylist={onAddToPlaylist} className="bg-black/60 backdrop-blur-sm" side="right" />
                    </div>

                    {/* Members-only badge */}
                    {(podcast?.is_exclusive || episode.is_premium) && (
                      <div className="absolute top-1.5 right-1.5">
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-black/70 backdrop-blur-sm border border-yellow-500/30 rounded-full text-[9px] font-semibold text-yellow-400 shadow-lg">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Members</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/[0.06]">
                    <div
                      className="h-full bg-gradient-to-r from-red-600 to-red-500 transition-all duration-300 shadow-[0_0_6px_rgba(220,38,38,0.3)]"
                      style={{ width: `${Math.round(pct)}%` }}
                    />
                  </div>
                </div>

                {/* Episode info */}
                <div className="p-2.5 space-y-0.5 min-h-[3rem] flex flex-col justify-start">
                  <h3 className="text-white/90 font-semibold text-xs line-clamp-2 leading-tight group-hover:text-red-400 transition-colors duration-300">
                    {episode.title}
                  </h3>
                  {podcast?.title ? (
                    <Link
                      to={`${createPageUrl('Episodes')}?id=${encodeURIComponent(podcast.id || podcast.slug)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-zinc-500 text-[10px] leading-tight line-clamp-1 hover:text-red-400 transition-colors duration-200"
                    >
                      {podcast.title}
                    </Link>
                  ) : (
                    <p className="text-zinc-500 text-[10px] leading-tight line-clamp-1">
                      {podcast?.author || ''}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

KeepListeningSection.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    podcast: PropTypes.object,
    episode: PropTypes.object.isRequired,
    progress: PropTypes.number,
  })),
  onEpisodePlay: PropTypes.func,
  currentEpisodeId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  currentTime: PropTypes.number,
  currentDuration: PropTypes.number,
  onAddToPlaylist: PropTypes.func,
};
