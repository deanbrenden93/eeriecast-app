import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Play, Plus, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { UserLibrary } from '@/api/entities';
import { useUser } from '@/context/UserContext.jsx';
import { useAuthModal } from '@/context/AuthModalContext.jsx';
import { formatDate } from '@/lib/utils';

// Format a total number of seconds as human-friendly hours/minutes (no seconds)
function formatDurationHM(totalSeconds) {
  const s = Number(totalSeconds);
  if (!Number.isFinite(s) || s <= 0) return '';
  let totalMins = Math.round(s / 60); // round to the nearest minute
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) return `${hours} hr${hours === 1 ? '' : 's'} ${mins} min`;
  return `${mins} min`;
}

// Sum episode durations (in seconds)
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

  // Compute aggregated duration once per render
  const totalSeconds = sumEpisodesDurationSeconds(podcast);
  const totalDurationText = formatDurationHM(totalSeconds);

  const toggleFavorite = async () => {
    if (!canFavorite) return;
    if (!podcast?.id || favLoading) return;
    const userId = user?.id || user?.user?.id || user?.pk;
    if (!isFavorited && !userId) {
      // Require login to add a favorite
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
        onClick: (e) => {
          e.stopPropagation();
          onFavoriteClick(podcast);
        },
        disabled: false,
        title: 'Click to favorite this podcast',
      };
    }
    return {
      onClick: undefined,
      disabled: true,
      title: 'Favorited when all episodes are favorited',
    };
  })();

  return (
    <div className="group relative rounded-xl border border-white/10 bg-[#1b1a1e] overflow-hidden">
      {/* subtle hover lift */}
      <div className="relative p-4 transition-transform duration-700 ease-out group-hover:-translate-y-[1px] group-hover:shadow-[0_2px_28px_-12px_rgba(0,0,0,0.6)]">
        <div className="flex items-start gap-4">
          {/* cover */}
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
            {podcast.cover_image ? (
              <img src={podcast.cover_image} alt={podcast.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-2xl">🎧</span>
              </div>
            )}
          </div>

          {/* text */}
          <div className="flex-1 min-w-0">
            <p className="text-purple-400 text-[13px] sm:text-sm font-bold uppercase mb-1 line-clamp-1">{podcast.author}</p>
            <h3 className="text-white font-semibold text-[16px] sm:text-lg leading-snug truncate">
              <Link
                to={`${createPageUrl('Episodes')}?id=${encodeURIComponent(podcast.id)}`}
                className="hover:text-purple-300 transition-colors"
                title={podcast.title}
              >
                {podcast.title}
              </Link>
            </h3>
            <div className="mt-1 text-[12px] sm:text-[13px] text-gray-400 flex items-center gap-2">
              {totalDurationText && (
                <>
                  <span>{totalDurationText}</span>
                  <span className="text-gray-600">•</span>
                </>
              )}
              <span>{formatDate(podcast.created_date || podcast.published_at)}</span>
            </div>

            {/* controls row matching mock */}
            <div className="mt-3 sm:mt-4">
              <div className="relative grid grid-cols-3 items-center gap-3 sm:gap-4">
                {/* decorative divider that doesn't take space (between Follow and Favorite) */}
                <div className="hidden sm:block pointer-events-none absolute top-1/2 left-[33.333%] -translate-x-1/2 -translate-y-1/2 h-6 w-px bg-white/10" aria-hidden="true" />

                {/* Follow (plus) */}
                <div className="flex items-center justify-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); onAddToPlaylist && onAddToPlaylist(podcast); }}
                    className="p-2 rounded-full text-gray-300 hover:text-white hover:bg-white/5 transition-colors duration-500"
                    title="Follow"
                    aria-label="Follow"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>

                {/* Favorite */}
                <div className="flex items-center justify-center">
                  <button
                    {...heartProps}
                    className={`p-2 rounded-full transition-colors ${isFavorited ? 'text-red-500' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
                    aria-pressed={isFavorited}
                    aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Heart className={`w-6 h-6 ${isFavorited ? 'fill-current' : ''}`} />
                  </button>
                </div>

                {/* Play pill occupies exactly 1/3 (third column) */}
                <div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onPlay && onPlay(podcast); }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-600 via-indigo-500 to-blue-500 text-white py-2.5 sm:py-3 px-3 shadow-[inset_0_-2px_0_rgba(255,255,255,0.15)] transition-all duration-700 ease-out hover:brightness-110 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06),inset_0_-2px_0_rgba(255,255,255,0.2)]"
                    title="Play"
                    aria-label="Play"
                  >
                    <Play className="w-6 h-6 fill-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* soft outline */}
      <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-white/10" />
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
