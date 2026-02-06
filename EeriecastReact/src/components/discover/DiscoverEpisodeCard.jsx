import { Play, Plus, Crown, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import PropTypes from 'prop-types';
import { formatDate } from '@/lib/utils';

function formatDuration(totalSeconds) {
  const s = Number(totalSeconds);
  if (!Number.isFinite(s) || s <= 0) return '';
  const hours = Math.floor(s / 3600);
  const mins = Math.round((s % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export default function DiscoverEpisodeCard({ episode, podcast, onPlay, onAddToPlaylist }) {
  const isMembersOnly = !!(podcast?.is_exclusive || episode?.is_premium);
  const coverImage = episode?.cover_image || podcast?.cover_image;
  const showTitle = podcast?.title || '';
  const durationText = formatDuration(episode?.duration);
  const dateText = formatDate(episode?.published_at || episode?.created_at);

  return (
    <div className="eeriecast-card group relative overflow-hidden rounded-xl">
      <div className="relative p-3 sm:p-4 transition-transform duration-500 ease-out group-hover:-translate-y-[1px]">
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Cover */}
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-eeriecast-surface-light flex-shrink-0 ring-1 ring-white/[0.06] relative">
            {coverImage ? (
              <img src={coverImage} alt={episode?.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-2xl opacity-40">🎧</span>
              </div>
            )}
            {isMembersOnly && (
              <div className="absolute top-0.5 left-0.5 bg-gradient-to-r from-amber-600/90 to-amber-700/90 backdrop-blur-sm rounded-full p-0.5">
                <Crown className="w-2.5 h-2.5 text-white" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Show name */}
            <Link
              to={`${createPageUrl('Episodes')}?id=${encodeURIComponent(podcast?.id || '')}`}
              className="text-zinc-400 text-xs font-medium hover:text-zinc-300 transition-colors duration-300 line-clamp-1"
              onClick={(e) => e.stopPropagation()}
            >
              {showTitle}
              {isMembersOnly && (
                <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-400/80 text-[10px] font-semibold uppercase tracking-wider">
                  <Crown className="w-2.5 h-2.5 inline" />
                  Members
                </span>
              )}
            </Link>

            {/* Episode title */}
            <h3 className="text-white font-semibold text-sm sm:text-[15px] leading-snug mt-0.5 line-clamp-2 group-hover:text-zinc-200 transition-colors duration-300">
              {episode?.title}
            </h3>

            {/* Meta row */}
            <div className="mt-1.5 flex items-center gap-2 text-[11px] sm:text-xs text-zinc-500">
              {durationText && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {durationText}
                </span>
              )}
              {durationText && dateText && <span className="text-zinc-700">·</span>}
              {dateText && <span>{dateText}</span>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0 self-center">
            {onAddToPlaylist && (
              <button
                onClick={(e) => { e.stopPropagation(); onAddToPlaylist(episode); }}
                className="p-2 rounded-full text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-all duration-300"
                title="Add to Playlist"
                aria-label="Add to Playlist"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onPlay && onPlay(episode, podcast); }}
              className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 rounded-full flex items-center justify-center text-white shadow-[0_2px_12px_rgba(220,38,38,0.2)] hover:shadow-[0_4px_20px_rgba(220,38,38,0.3)] transition-all duration-500 hover:scale-105"
              title="Play"
              aria-label="Play"
            >
              <Play className="w-4 h-4 fill-white ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

DiscoverEpisodeCard.propTypes = {
  episode: PropTypes.object.isRequired,
  podcast: PropTypes.object,
  onPlay: PropTypes.func,
  onAddToPlaylist: PropTypes.func,
};
