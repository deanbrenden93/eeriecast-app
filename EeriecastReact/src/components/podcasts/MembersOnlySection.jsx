import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Star, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useRef } from "react";
import PropTypes from 'prop-types';

export default function MembersOnlySection({ podcasts, onPodcastPlay }) {
  const scrollRef = useRef(null);
  const navigate = useNavigate();

  if (!podcasts || podcasts.length === 0) return null;

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
        <div className="flex items-center gap-2.5 text-amber-400">
          <Star className="w-5 h-5 fill-amber-400" />
          <h2 className="text-2xl font-bold">Members Only</h2>
        </div>
        <Link to={`${createPageUrl('Discover')}?tab=Members-Only`} className="text-sm text-zinc-500 hover:text-red-400 transition-colors duration-300">
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
        className="flex space-x-3 overflow-x-auto pb-4 scroll-smooth"
        style={{ scrollbarWidth: 'none', 'msOverflowStyle': 'none' }}
      >
        {podcasts.map((podcast) => (
          <div key={podcast.id} className="flex-shrink-0 w-44">
            <div 
              className="eeriecast-card group cursor-pointer overflow-hidden"
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
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-eeriecast-surface-light to-eeriecast-surface">
                    <span className="text-4xl opacity-40">🎧</span>
                  </div>
                )}

                {/* Members badge */}
                <div className="absolute top-2 right-2 z-10">
                  <div className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[9px] font-bold uppercase tracking-wider shadow-[0_0_8px_rgba(245,158,11,0.3)]">
                    MEMBERS
                  </div>
                </div>
                
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500">
                  <button 
                    className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-500 transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:scale-105"
                    onClick={(e) => handlePlayClick(e, podcast)}
                  >
                    <Play className="w-4 h-4 text-white ml-0.5 fill-white" />
                  </button>
                </div>
              </div>

              <div className="p-3 space-y-1">
                <h3 className="text-white/90 font-semibold text-sm line-clamp-2 leading-tight group-hover:text-amber-400 transition-colors duration-300">
                  {podcast.title}
                </h3>
                <p className="text-zinc-500 text-xs leading-tight">{podcast.author}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

MembersOnlySection.propTypes = {
  podcasts: PropTypes.arrayOf(PropTypes.object),
  onPodcastPlay: PropTypes.func,
};
