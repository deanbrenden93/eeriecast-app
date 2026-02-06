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

function extractBrief(description) {
  if (!description) return '';
  // Strip leading promo lines like "*Exclusive to..." and URLs
  let clean = description
    .replace(/^\*Exclusive[^\n]*\n*/i, '')
    .replace(/https?:\/\/[^\s]+/g, '')
    .trim();
  // Take first ~160 chars at a word boundary
  if (clean.length > 160) {
    clean = clean.slice(0, 160).replace(/\s+\S*$/, '') + '...';
  }
  return clean;
}

export default function BookCard({ podcast }) {
  const navigate = useNavigate();
  const { ensureDetail } = usePodcasts();
  const isMembersOnly = !!podcast?.is_exclusive;
  const chapters = getChapterCount(podcast);
  const runtime = formatRuntime(podcast?.total_duration);
  const brief = extractBrief(podcast?.description);

  // The list endpoint doesn't include description — fetch full detail lazily
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
      className="group cursor-pointer relative overflow-hidden rounded-2xl bg-eeriecast-surface-lighter border border-white/[0.04] hover:border-white/[0.08] transition-all duration-700 hover:-translate-y-1 hover:shadow-[0_20px_60px_-12px_rgba(0,0,0,0.6)]"
      onClick={handleClick}
    >
      {/* Cover image — tall book ratio */}
      <div className="relative aspect-[3/4] overflow-hidden">
        {podcast?.cover_image ? (
          <img
            src={podcast.cover_image}
            alt={podcast.title}
            className="w-full h-full object-cover transition-all duration-1000 group-hover:scale-[1.04] group-hover:brightness-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-eeriecast-surface-light to-eeriecast-surface">
            <BookOpen className="w-12 h-12 text-zinc-600" />
          </div>
        )}

        {/* Atmospheric gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-80 group-hover:opacity-70 transition-opacity duration-700" />

        {/* Members badge */}
        {isMembersOnly && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-gradient-to-r from-amber-500/90 to-amber-600/90 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full shadow-lg">
            <Crown className="w-3 h-3" />
            <span>Members</span>
          </div>
        )}

        {/* Bottom content overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
          {/* Meta pills */}
          <div className="flex items-center gap-2 mb-2.5 flex-wrap">
            {chapters && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white/70 bg-white/[0.08] backdrop-blur-sm px-2 py-0.5 rounded-full">
                <BookOpen className="w-3 h-3" />
                {chapters} {chapters === 1 ? 'Chapter' : 'Chapters'}
              </span>
            )}
            {runtime && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white/70 bg-white/[0.08] backdrop-blur-sm px-2 py-0.5 rounded-full">
                <Clock className="w-3 h-3" />
                {runtime}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-white font-bold text-base sm:text-lg leading-tight mb-1 line-clamp-2 group-hover:text-zinc-100 transition-colors duration-500">
            {podcast?.title}
          </h3>

          {/* Brief description */}
          {brief && (
            <p className="text-zinc-400 text-xs sm:text-[13px] leading-relaxed line-clamp-2 mb-3 group-hover:text-zinc-300 transition-colors duration-500">
              {brief}
            </p>
          )}

          {/* CTA button */}
          <button
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.06] backdrop-blur-md border border-white/[0.08] text-sm font-medium text-white hover:bg-white/[0.12] hover:border-white/[0.15] group-hover:bg-white/[0.10] transition-all duration-500"
            onClick={(e) => { e.stopPropagation(); handleClick(); }}
          >
            <Headphones className="w-4 h-4" />
            Start Listening
          </button>
        </div>
      </div>
    </div>
  );
}

BookCard.propTypes = {
  podcast: PropTypes.object.isRequired,
};
