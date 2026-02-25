/* eslint-disable react/prop-types */
import { useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import PropTypes from 'prop-types';

export default function PodcastRow({ title, podcasts: podcastList = [], onPodcastPlay, showPlayIcon = false, showAudiobookPill = false, viewAllTo }) {
  const scrollRef = useRef(null);
  const navigate = useNavigate();

  const scroll = (direction) => {
    const { current } = scrollRef;
    if (current) {
      const scrollAmount = current.offsetWidth * 0.8;
      current.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
    }
  };

  const handleCardClick = (podcast) => {
    if (podcast?.id) {
      navigate(`${createPageUrl('Episodes')}?id=${encodeURIComponent(podcast.id)}`);
    }
  };

  const handlePlayClick = (e, podcast) => {
    e.stopPropagation();
    if (typeof onPodcastPlay === 'function') {
      onPodcastPlay(podcast);
    }
  };

  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-5">
        {title}
        <Link to={viewAllTo || createPageUrl("Podcasts")} className="text-sm text-zinc-500 hover:text-red-400 transition-colors duration-300">
          View all
        </Link>
      </div>

      <div className="absolute top-1/2 -left-3 -translate-y-1/2 z-10 hidden md:block">
        <button onClick={() => scroll(-1)} className="p-2 bg-eeriecast-surface-light/80 hover:bg-eeriecast-surface-lighter border border-white/[0.06] rounded-full transition-all shadow-lg hover:shadow-xl backdrop-blur-sm">
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
      </div>
      <div className="absolute top-1/2 -right-3 -translate-y-1/2 z-10 hidden md:block">
        <button onClick={() => scroll(1)} className="p-2 bg-eeriecast-surface-light/80 hover:bg-eeriecast-surface-lighter border border-white/[0.06] rounded-full transition-all shadow-lg hover:shadow-xl backdrop-blur-sm">
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex space-x-3 overflow-x-auto pb-4 scroll-smooth"
        style={{ scrollbarWidth: 'none', 'msOverflowStyle': 'none' }}
      >
        {Array.isArray(podcastList) && podcastList.map((podcast) => (
          <div key={podcast.id} className="flex-shrink-0 w-44">
            <div 
              className="eeriecast-card group cursor-pointer h-full flex flex-col overflow-hidden"
              onClick={() => handleCardClick(podcast)}
            >
              <div className="relative aspect-square bg-eeriecast-surface-light overflow-hidden rounded-t-lg">
                {podcast.cover_image ? (
                  <img
                    src={podcast.cover_image}
                    alt={podcast.title}
                    className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105 group-hover:brightness-110"
                  />
                ) : (
                  <div className="w-full h-full cover-shimmer" />
                )}
                
                {/* Play overlay */}
                {showPlayIcon && (
                  <div className="absolute top-2 left-2 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(220,38,38,0.3)]">
                    <Play className="w-3 h-3 text-white fill-white ml-0.5" />
                  </div>
                )}
                
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500">
                  <button 
                    className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-500 transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:scale-105"
                    onClick={(e) => handlePlayClick(e, podcast)}
                  >
                    <Play className="w-4 h-4 text-white ml-0.5 fill-white" />
                  </button>
                </div>

                {/* Badges */}
                <div className="absolute top-2 right-2 flex gap-1 items-start">
                  {showAudiobookPill && (
                    <div className="px-2 py-0.5 rounded-full bg-cyan-500/80 text-white text-[9px] font-bold uppercase tracking-wider shadow backdrop-blur-sm">AUDIOBOOK</div>
                  )}
                  {podcast.is_exclusive && (
                    <div className="px-1.5 py-0.5 bg-gradient-to-r from-red-600 to-red-700 rounded text-[9px] font-bold text-white uppercase tracking-wider shadow-[0_0_8px_rgba(220,38,38,0.3)]">
                      Exclusive
                    </div>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="p-3 space-y-1 mt-auto min-h-[3.5rem] flex flex-col justify-end">
                <h3 className="text-white/90 font-semibold text-sm line-clamp-2 leading-tight group-hover:text-red-400 transition-colors duration-300">
                  {podcast.title}
                </h3>
                <p className="text-zinc-500 text-xs leading-tight">
                  {podcast.author}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

PodcastRow.propTypes = {
  title: PropTypes.node,
  podcasts: PropTypes.arrayOf(PropTypes.object),
  onPodcastPlay: PropTypes.func,
  showPlayIcon: PropTypes.bool,
  showAudiobookPill: PropTypes.bool,
  viewAllTo: PropTypes.string,
};
