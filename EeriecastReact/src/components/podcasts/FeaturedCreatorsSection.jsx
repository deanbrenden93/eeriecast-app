import { useRef } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { usePodcasts } from "@/context/PodcastContext";

export default function FeaturedCreatorsSection() {
  const scrollRef = useRef(null);
  const { featuredCreators } = usePodcasts();

  const creators = Array.isArray(featuredCreators) ? featuredCreators : [];
  if (!creators || creators.length === 0) return null;

  const scroll = (direction) => {
    const { current } = scrollRef;
    if (current) {
      const scrollAmount = current.offsetWidth * 0.8;
      current.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-2xl font-bold text-white">Featured Creators</h2>
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
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {creators.map((creator) => (
          <Link 
            key={creator.id}
            to={createPageUrl(`CreatorEpisodes?author=${encodeURIComponent(creator.display_name || '')}`)}
            className="flex-shrink-0 w-40"
          >
            <div 
              className="eeriecast-card group cursor-pointer flex flex-col items-center text-center h-full overflow-hidden"
            >
              <div className="relative w-24 h-24 mx-auto rounded-full overflow-hidden mt-4 bg-eeriecast-surface-light ring-2 ring-white/[0.06]">
                {(creator.avatar || creator.cover_image) ? (
                  <img
                    src={creator.avatar || creator.cover_image}
                    alt={creator.display_name || 'Creator'}
                    className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105 group-hover:brightness-110"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-eeriecast-surface-light to-eeriecast-surface">
                    <span className="text-2xl opacity-40">🎙️</span>
                  </div>
                )}
                {creator.is_verified && (
                  <div className="absolute -bottom-1 -right-1 bg-eeriecast-surface rounded-full p-0.5">
                    <CheckCircle2 className="w-4 h-4 text-red-400" />
                  </div>
                )}
              </div>
              <div className="p-3 flex flex-col flex-grow justify-center">
                <h3 className="text-white/90 font-semibold text-sm group-hover:text-red-400 transition-colors duration-300 line-clamp-2 mb-1 leading-tight">
                  {creator.display_name || 'Unknown Creator'}
                </h3>
                <p className="text-zinc-500 text-xs uppercase tracking-wider">Podcast</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
