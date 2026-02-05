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
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Featured Creators</h2>
        {/* Removed View all button per request */}
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
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {creators.map((creator) => (
          <Link 
            key={creator.id}
            to={createPageUrl(`CreatorEpisodes?author=${encodeURIComponent(creator.display_name || '')}`)}
            className="flex-shrink-0 w-40"
          >
            <div 
              className="group cursor-pointer bg-gray-800/60 hover:bg-gray-700/80 border border-gray-700/50 rounded-lg flex flex-col items-center text-center transition-all duration-300 h-full overflow-hidden"
            >
              <div className="relative w-24 h-24 mx-auto rounded-full overflow-hidden mt-3 bg-gray-700">
                {(creator.avatar || creator.cover_image) ? (
                  <img
                    src={creator.avatar || creator.cover_image}
                    alt={creator.display_name || 'Creator'}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
                    <span className="text-2xl">🎙️</span>
                  </div>
                )}
                {creator.is_verified && (
                  <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-0.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  </div>
                )}
              </div>
              <div className="p-3 flex flex-col flex-grow justify-center">
                <h3 className="text-white font-semibold text-sm group-hover:text-purple-400 transition-colors line-clamp-2 mb-1 leading-tight">
                  {creator.display_name || 'Unknown Creator'}
                </h3>
                  <p className="text-gray-400 text-xs">PODCAST</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}