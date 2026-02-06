import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Play, Plus, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { UserLibrary } from '@/api/entities';
import { useUser } from '@/context/UserContext.jsx';
import { useAuthModal } from '@/context/AuthModalContext.jsx';
import { formatDate } from '@/lib/utils';

function formatDurationHM(totalSeconds) {
  const s = Number(totalSeconds);
  if (!Number.isFinite(s) || s <= 0) return '';
  let totalMins = Math.round(s / 60);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) return `${hours} hr${hours === 1 ? '' : 's'} ${mins} min`;
  return `${mins} min`;
}

function sumEpisodesDurationSeconds(podcast) {
  const list = Array.isArray(podcast?.episodes) ? podcast.episodes : [];
  return list.reduce((acc, ep) => acc + (Number(ep?.duration) || 0), 0);
}

export default function EpisodeCard({ podcast, onPlay, onAddToPlaylist, initialFavorited = false, onFavoriteChange, canFavorite = true, onFavoriteClick }) {
  const [isFavorited, setIsFavorited] = useState(!!initialFavorited);
  const [favLoading, setFavLoading] = useState(false);
  const { user } = useUser();
  const { openAuth } = useAuthModal();

  useEffect(() => {
    setIsFavorited(!!initialFavorited);
  }, [initialFavorited]);

  const totalSeconds = sumEpisodesDurationSeconds(podcast);
  const totalDurationText = formatDurationHM(totalSeconds);

  const toggleFavorite = async () => {
    if (!canFavorite) return;
    if (!podcast?.id || favLoading) return;
    const userId = user?.id || user?.user?.id || user?.pk;
    if (!isFavorited && !userId) {
      openAuth('login');
      return;
    }

    const next = !isFavorited;
    setIsFavorited(next);
    setFavLoading(true);
    try {
      if (next) {
        await UserLibrary.addFavorite('podcast', podcast.id);
      } else {
        await UserLibrary.removeFavorite('podcast', podcast.id);
      }
      onFavoriteChange && onFavoriteChange(podcast.id, next);
    } catch (e) {
      setIsFavorited(!next);
      if (typeof console !== 'undefined') console.debug('favorite toggle failed', e);
    } finally {
      setFavLoading(false);
    }
  };

  const heartProps = (() => {
    if (canFavorite) {
      return {
        onClick: (e) => { e.stopPropagation(); toggleFavorite(); },
        disabled: favLoading,
        title: isFavorited ? 'Remove from favorites' : 'Add to favorites',
      };
    }
    if (onFavoriteClick) {
      return {
        onClick: (e) => { e.stopPropagation(); onFavoriteClick(podcast); },
        disabled: false,
        title: 'Click to favorite this podcast',
      };
    }
    return { onClick: undefined, disabled: true, title: 'Favorited when all episodes are favorited' };
  })();

  return (
    <div className="eeriecast-card group relative overflow-hidden">
      <div className="relative p-4 transition-transform duration-500 ease-out group-hover:-translate-y-[1px]">
        <div className="flex items-start gap-4">
          {/* Cover */}
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-eeriecast-surface-light flex-shrink-0 ring-1 ring-white/[0.06]">
            {podcast.cover_image ? (
              <img src={podcast.cover_image} alt={podcast.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-2xl opacity-40">🎧</span>
              </div>
            )}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-zinc-400 text-[13px] sm:text-sm font-medium mb-1 line-clamp-1">{podcast.author}</p>
            <h3 className="text-white font-semibold text-[16px] sm:text-lg leading-snug truncate">
              <Link
                to={`${createPageUrl('Episodes')}?id=${encodeURIComponent(podcast.id)}`}
                className="hover:text-red-300 transition-colors duration-300"
                title={podcast.title}
              >
                {podcast.title}
              </Link>
            </h3>
            <div className="mt-1 text-[12px] sm:text-[13px] text-zinc-500 flex items-center gap-2">
              {totalDurationText && (
                <>
                  <span>{totalDurationText}</span>
                  <span className="text-zinc-700">·</span>
                </>
              )}
              <span>{formatDate(podcast.created_date || podcast.published_at)}</span>
            </div>

            {/* Controls */}
            <div className="mt-3 sm:mt-4">
              <div className="relative grid grid-cols-3 items-center gap-3 sm:gap-4">
                <div className="hidden sm:block pointer-events-none absolute top-1/2 left-[33.333%] -translate-x-1/2 -translate-y-1/2 h-6 w-px bg-white/[0.06]" aria-hidden="true" />

                {/* Add to playlist */}
                <div className="flex items-center justify-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); onAddToPlaylist && onAddToPlaylist(podcast); }}
                    className="p-2 rounded-full text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-all duration-300"
                    title="Add to Playlist"
                    aria-label="Add to Playlist"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {/* Favorite */}
                <div className="flex items-center justify-center">
                  <button
                    {...heartProps}
                    className={`p-2 rounded-full transition-all duration-300 ${isFavorited ? 'text-red-500 hover:text-red-400' : 'text-zinc-500 hover:text-white hover:bg-white/[0.04]'}`}
                    aria-pressed={isFavorited}
                    aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Heart className={`w-5 h-5 ${isFavorited ? 'fill-current drop-shadow-[0_0_6px_rgba(220,38,38,0.4)]' : ''}`} />
                  </button>
                </div>

                {/* Play */}
                <div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onPlay && onPlay(podcast); }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white py-2.5 sm:py-3 px-3 shadow-[0_4px_16px_rgba(220,38,38,0.2)] hover:shadow-[0_6px_24px_rgba(220,38,38,0.3)] transition-all duration-500"
                    title="Play"
                    aria-label="Play"
                  >
                    <Play className="w-5 h-5 fill-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

EpisodeCard.propTypes = {
  podcast: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    title: PropTypes.string,
    author: PropTypes.string,
    cover_image: PropTypes.string,
    duration: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }).isRequired,
  onPlay: PropTypes.func,
  onAddToPlaylist: PropTypes.func,
  initialFavorited: PropTypes.bool,
  onFavoriteChange: PropTypes.func,
  canFavorite: PropTypes.bool,
  onFavoriteClick: PropTypes.func,
};
