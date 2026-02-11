import { useEffect } from 'react';
import { Headphones, BookOpen, Crown, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { usePodcasts } from '@/context/PodcastContext.jsx';
import PropTypes from 'prop-types';

function formatRuntime(totalMinutes) {
  const m = Number(totalMinutes);
  if (!Number.isFinite(m) || m <= 0) return '';
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

function getChapterCount(podcast) {
  const n = podcast?.total_episodes ?? podcast?.episodes_count ?? podcast?.episode_count ?? null;
  if (typeof n === 'number' && !Number.isNaN(n) && n > 0) return n;
  const eps = Array.isArray(podcast?.episodes) ? podcast.episodes.length : 0;
  return eps || null;
}

export default function BookCard({ podcast }) {
  const navigate = useNavigate();
  const { ensureDetail } = usePodcasts();
  const isMembersOnly = !!podcast?.is_exclusive;
  const chapters = getChapterCount(podcast);
  const runtime = formatRuntime(podcast?.total_duration);

  useEffect(() => {
    if (podcast?.id && !podcast?.description) {
      ensureDetail(podcast.id).catch(() => {});
    }
  }, [podcast?.id, podcast?.description, ensureDetail]);

  const handleClick = () => {
    if (podcast?.id) {
      navigate(`${createPageUrl('Episodes')}?id=${encodeURIComponent(podcast.id)}`);
    }
  };

  return (
    <div
      className="group cursor-pointer relative overflow-hidden rounded-xl bg-eeriecast-surface-lighter border border-white/[0.04] hover:border-white/[0.08] transition-all duration-500 hover:-translate-y-0.5"
      onClick={handleClick}
    >
      {/* Cover image */}
      <div className="relative aspect-[2/3] overflow-hidden">
        {podcast?.cover_image ? (
          <img
            src={podcast.cover_image}
            alt={podcast.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-eeriecast-surface-light to-eeriecast-surface">
            <BookOpen className="w-8 h-8 text-zinc-600" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        {/* Members badge */}
        {isMembersOnly && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-gradient-to-r from-amber-500/90 to-amber-600/90 backdrop-blur-sm text-white text-[8px] sm:text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full">
            <Crown className="w-2.5 h-2.5" />
            <span>Members</span>
          </div>
        )}

        {/* Listen icon — bottom-right hover reveal */}
        <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-300">
          <Headphones className="w-3.5 h-3.5 text-white" />
        </div>

        {/* Bottom meta overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-3">
          {/* Meta row */}
          <div className="flex items-center gap-1.5 mb-1">
            {chapters && (
              <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-medium text-white/60">
                <BookOpen className="w-2.5 h-2.5" />
                {chapters} Ch.
              </span>
            )}
            {chapters && runtime && <span className="text-white/20 text-[9px]">&middot;</span>}
            {runtime && (
              <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-medium text-white/60">
                <Clock className="w-2.5 h-2.5" />
                {runtime}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-white font-semibold text-xs sm:text-sm leading-snug line-clamp-2">
            {podcast?.title}
          </h3>
        </div>
      </div>
    </div>
  );
}

BookCard.propTypes = {
  podcast: PropTypes.object.isRequired,
};
