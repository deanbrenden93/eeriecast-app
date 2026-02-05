import { useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import PropTypes from 'prop-types';
import { createPageUrl } from "@/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function KeepListeningSection({
  podcasts,
  onPodcastPlay,
  currentPodcastId,
  currentTime = 0,
  currentDuration = 0,
  progressMap = {},
}) {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    const { current } = scrollRef;
    if (current) {
      const scrollAmount = current.offsetWidth * 0.8;
      current.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
    }
  };

  const stablePercents = useMemo(() => {
    const map = {};
    (podcasts || []).forEach(p => {
      const id = Number(p.id) || 0;
      const seed = (id * 9301 + 49297) % 233280;
      const rand = seed / 233280;
      map[p.id] = 20 + Math.floor(rand * 70); // 20..90 placeholder
    });
    return map;
  }, [podcasts]);

  const livePct = currentDuration > 0 ? Math.max(0, Math.min(100, (currentTime / currentDuration) * 100)) : null;

  if (!podcasts || podcasts.length === 0) {
    return null; // nothing to render
  }

  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Keep Listening</h2>
        <Link to={`${createPageUrl('Library')}?tab=History`} className="text-sm text-gray-400 hover:text-white transition-colors">
          View all
        </Link>
      </div>

      <div className="absolute top-1/2 -left-4 -translate-y-1/2 z-10 hidden md:block">
        <button onClick={() => scroll(-1)} className="p-2 bg-black/50 hover:bg-black/80 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
      </div>
      <div className="absolute top-1/2 -right-4 -translate-y-1/2 z-10 hidden md:block">
        <button onClick={() => scroll(1)} className="p-2 bg-black/50 hover:bg-black/80 rounded-full transition-colors">
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      </div>

      <div 
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 scroll-smooth"
        style={{ scrollbarWidth: 'none', 'msOverflowStyle': 'none' }}
      >
        {podcasts.map((podcast) => {
          // Prefer live progress for the currently playing podcast
          let pct;
          if (podcast.id === currentPodcastId && livePct !== null) {
            pct = livePct;
          } else if (progressMap && Object.prototype.hasOwnProperty.call(progressMap, podcast.id)) {
            // Use actual resume percent if provided by parent
            pct = Math.max(0, Math.min(100, Number(progressMap[podcast.id] || 0)));
          } else {
            // Fallback to placeholder percent
            pct = stablePercents[podcast.id] ?? 0;
          }

          return (
            <div
              key={podcast.id}
              className="flex-shrink-0 cursor-pointer group w-32"
              onClick={() => onPodcastPlay(podcast)}
            >
              <div className="bg-gray-800/60 hover:bg-gray-700/80 border border-gray-700/50 rounded-lg transition-all duration-300 h-full flex flex-col overflow-hidden">
                <div className="relative bg-gray-800">
                  <div className="aspect-square">
                    {podcast.cover_image ? (
                      <img
                        src={podcast.cover_image}
                        alt={podcast.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
                        <span className="text-2xl">🎧</span>
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-600">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                      style={{ width: `${Math.round(pct)}%` }}
                    />
                  </div>
                </div>
                <div className="p-3 space-y-1 mt-auto min-h-[3rem] flex flex-col justify-end">
                  <h3 className="text-white font-semibold text-xs line-clamp-2 leading-tight group-hover:text-purple-400 transition-colors">
                    {podcast.title}
                  </h3>
                  <p className="text-gray-400 text-xs leading-tight">
                    {podcast.author}
                  </p>
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
  podcasts: PropTypes.arrayOf(PropTypes.object),
  onPodcastPlay: PropTypes.func,
  currentPodcastId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  currentTime: PropTypes.number,
  currentDuration: PropTypes.number,
  progressMap: PropTypes.object,
};
