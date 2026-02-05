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
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2 text-yellow-500">
          <Star className="w-5 h-5 fill-yellow-500" />
          <h2 className="text-2xl font-bold">Members Only</h2>
        </div>
        <Link to={`${createPageUrl('Discover')}?tab=Members-Only`} className="text-sm text-gray-400 hover:text-white transition-colors">
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
        className="flex space-x-4 overflow-x-auto pb-4 scroll-smooth"
        style={{ scrollbarWidth: 'none', 'msOverflowStyle': 'none' }}
      >
        {podcasts.map((podcast) => (
          <div key={podcast.id} className="flex-shrink-0 w-44">
            <div 
              className="group cursor-pointer bg-gray-800/60 hover:bg-gray-700/80 border border-gray-700/50 rounded-lg transition-all duration-300 overflow-hidden"
              onClick={() => handleCardClick(podcast)}
            >
              <div className="relative aspect-square bg-gray-800">
                {podcast.cover_image ? (
                  <img
                    src={podcast.cover_image}
                    alt={podcast.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
                    <span className="text-4xl">🎧</span>
                  </div>
                )}

                {/* Members pill (top-right) */}
                <div className="absolute top-2 right-2 z-10">
                  <div className="px-2 py-0.5 rounded-full bg-yellow-500 text-white text-[10px] font-bold uppercase tracking-wider shadow">
                    MEMBERS
                  </div>
                </div>
                
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <button 
                    className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors shadow-xl"
                    onClick={(e) => handlePlayClick(e, podcast)}
                  >
                    <Play className="w-4 h-4 text-black ml-0.5 fill-black" />
                  </button>
                </div>
              </div>

              <div className="p-3 space-y-1">
                <h3 className="text-white font-semibold text-sm line-clamp-2 leading-tight group-hover:text-yellow-400 transition-colors">
                  {podcast.title}
                </h3>
                <p className="text-gray-400 text-xs leading-tight">{podcast.author}</p>
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
