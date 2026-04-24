import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronLeft, ChevronRight, Play, Headphones, BookOpen } from "lucide-react";
import { usePodcasts } from "@/context/PodcastContext";
import { isAudiobook, isMusic } from "@/lib/utils";

export default function FeaturedCreatorsSection() {
  const scrollRef = useRef(null);
  const navigate = useNavigate();
  const { podcasts } = usePodcasts();

  const shows = Array.isArray(podcasts) ? podcasts : [];
  if (shows.length === 0) return null;

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

  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-2xl font-bold text-white">All Shows</h2>
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
        className="flex space-x-4 overflow-x-auto pb-4 scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {shows.map((podcast) => {
          const book = isAudiobook(podcast);
          const music = isMusic(podcast);
          const count = podcast.episodes_count ?? podcast.episode_count ?? podcast.total_episodes ?? 0;
          const unit = book
            ? (count === 1 ? 'Chapter' : 'Chapters')
            : music
              ? (count === 1 ? 'Track' : 'Tracks')
              : (count === 1 ? 'Episode' : 'Episodes');
          const countLabel = count > 0 ? `${count} ${unit}` : null;
          // Replace the generic "Eeriecast" byline with a type pill
          // so listeners can tell at a glance whether a circle on the
          // shelf is a podcast, an audiobook, or a music artist.
          const typeLabel = book ? 'Audiobook' : music ? 'Music' : 'Podcast';

          return (
            <div
              key={podcast.id}
              className="flex-shrink-0 w-36 md:w-40"
            >
              <div
                className="group cursor-pointer flex flex-col items-center text-center"
                onClick={() => handleCardClick(podcast)}
              >
                {/* Circular cover with ring + glow */}
                <div className="relative mb-3">
                  <div className="w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden ring-2 ring-white/[0.08] group-hover:ring-red-500/40 transition-all duration-500 shadow-lg group-hover:shadow-red-900/20">
                    {podcast.cover_image ? (
                      <img
                        src={podcast.cover_image}
                        alt={podcast.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.06] to-white/[0.02]">
                        {book
                          ? <BookOpen className="w-8 h-8 text-zinc-600" />
                          : <Headphones className="w-8 h-8 text-zinc-600" />}
                      </div>
                    )}

                    {/* Play overlay */}
                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-400">
                      <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_16px_rgba(220,38,38,0.4)]">
                        <Play className="w-4 h-4 text-white ml-0.5 fill-white" />
                      </div>
                    </div>
                  </div>

                  {/* Exclusive badge */}
                  {podcast.is_exclusive && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                      <div className="px-2 py-0.5 bg-gradient-to-r from-red-600 to-red-700 rounded-full text-[8px] font-bold text-white uppercase tracking-wider shadow-lg whitespace-nowrap">
                        Exclusive
                      </div>
                    </div>
                  )}
                </div>

                {/* Text */}
                <h3 className="text-white/90 font-semibold text-[13px] leading-tight line-clamp-2 mb-0.5 group-hover:text-red-400 transition-colors duration-300 px-1">
                  {podcast.title}
                </h3>
                <p className="text-zinc-500 text-[11px] leading-tight mb-0.5">{typeLabel}</p>
                {countLabel && (
                  <p className="text-zinc-600 text-[10px] tracking-wide">{countLabel}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
