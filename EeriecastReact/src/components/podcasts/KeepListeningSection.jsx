import { useRef } from "react";
import { Link } from "react-router-dom";
import PropTypes from 'prop-types';
import { createPageUrl } from "@/utils";
import { ChevronLeft, ChevronRight, Play, Lock } from "lucide-react";
import EpisodeMenu from "@/components/podcasts/EpisodeMenu";

function formatTimeLeft(seconds) {
  if (!seconds || seconds <= 0) return null;
  if (seconds < 60) return `${Math.round(seconds)}s left`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m left`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m left` : `${hrs}h left`;
}

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
        className="grid grid-flow-col auto-cols-[240px] gap-3 overflow-x-auto pb-4 scroll-smooth"
        style={{ gridTemplateRows: 'repeat(2, 1fr)', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item) => {
          const { podcast, episode, progress = 0 } = item;
          const isCurrentlyPlaying = episode.id === currentEpisodeId;
          const pct = isCurrentlyPlaying && livePct !== null ? livePct : progress;
          const cover = episode.cover_image || podcast?.cover_image;

          const totalSec = isCurrentlyPlaying ? currentDuration : Number(episode.duration || 0);
          const playedSec = isCurrentlyPlaying ? currentTime : Number(item.resumeData?.progress || 0);
          const timeLeft = totalSec > 0 ? formatTimeLeft(Math.max(0, totalSec - playedSec)) : null;

          return (
            <div
              key={episode.id}
              className="cursor-pointer group"
              onClick={() => onEpisodePlay(item)}
            >
              <div className="flex gap-3 bg-white/[0.02] border border-white/[0.04] rounded-xl p-3.5 h-full transition-all duration-300 hover:border-white/[0.08] hover:bg-white/[0.03]">
                {/* Thumbnail */}
                <div className="relative flex-shrink-0 w-[58px] h-[58px] rounded-lg overflow-hidden">
                  {cover ? (
                    <img src={cover} alt={episode.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-eeriecast-surface-light cover-shimmer" />
                  )}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <Play className="w-4 h-4 text-white fill-white" />
                  </div>
                  {(podcast?.is_exclusive || episode.is_premium) && (
                    <div className="absolute top-0.5 right-0.5">
                      <Lock className="w-2.5 h-2.5 text-yellow-400 drop-shadow-md" />
                    </div>
                  )}
                </div>

                {/* Info + progress */}
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                  <h3 className="text-white/90 font-semibold text-xs leading-tight truncate group-hover:text-red-400 transition-colors duration-300">
                    {episode.title}
                  </h3>
                  <div className="flex items-center gap-1.5 min-w-0">
                    {podcast?.title ? (
                      <Link
                        to={`${createPageUrl('Episodes')}?id=${encodeURIComponent(podcast.id || podcast.slug)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-zinc-500 text-[10px] leading-tight truncate hover:text-red-400 transition-colors duration-200"
                      >
                        {podcast.title}
                      </Link>
                    ) : (
                      <span className="text-zinc-500 text-[10px] leading-tight truncate">
                        {podcast?.author || ''}
                      </span>
                    )}
                    <div className="ml-auto flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <EpisodeMenu episode={episode} podcast={podcast} onAddToPlaylist={onAddToPlaylist} side="right" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-[3px] bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-600 to-red-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.round(pct)}%` }}
                      />
                    </div>
                    {timeLeft && (
                      <span className="flex-shrink-0 text-[9px] text-zinc-600 tabular-nums">{timeLeft}</span>
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
