// filepath: src/components/podcasts/EpisodesTable.jsx
import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Heart, Play, Trash2, Lock } from 'lucide-react';
import { useUser } from '@/context/UserContext.jsx';
import { UserLibrary } from '@/api/entities';
import { useAuthModal } from '@/context/AuthModalContext.jsx';
import { formatDate } from '@/lib/utils';
import { FREE_FAVORITE_LIMIT } from '@/lib/freeTier';
import { toast } from '@/components/ui/use-toast';
import EpisodeMenu from '@/components/podcasts/EpisodeMenu';


function formatDuration(secondsOrString) {
  if (!secondsOrString && secondsOrString !== 0) return '';
  if (typeof secondsOrString === 'string') {
    // if already looks like 00:00:00 or 00:00, return
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(secondsOrString)) return secondsOrString;
    const num = Number(secondsOrString);
    if (!Number.isFinite(num)) return secondsOrString;
    secondsOrString = num;
  }
  const total = Math.max(0, Math.floor(secondsOrString));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function EpisodesTable({
  episodes,
  show,
  onPlay,
  onAddToPlaylist,
  onRemoveFromPlaylist, // new optional handler
  removingEpisodeId, // id currently being removed
  lockedEpisodeIds, // Set of episode IDs locked behind the free-tier chapter limit
  accentColor, // optional { primary, darker } for play button gradient
  freeSampleEpisodeId, // ID of the admin-assigned free sample episode
  dismissingIds, // optional Set of episode IDs being animated out (fade + slide)
  className = '',
}) {
  const { favoriteEpisodeIds, user, refreshFavorites, isAuthenticated, isPremium, episodeProgressMap } = useUser();
  const { openAuth } = useAuthModal();

  // Sort the free sample episode to the very top of the list
  const rows = useMemo(() => {
    const list = Array.isArray(episodes) ? episodes : [];
    if (!freeSampleEpisodeId || isPremium) return list;
    const sampleIdx = list.findIndex(ep => ep.id == freeSampleEpisodeId);
    if (sampleIdx <= 0) return list; // already first or not found
    const reordered = [...list];
    const [sample] = reordered.splice(sampleIdx, 1);
    reordered.unshift(sample);
    return reordered;
  }, [episodes, freeSampleEpisodeId, isPremium]);

  const getArtwork = (ep) => ep?.image_url || ep?.artwork || ep?.cover_image || ep?.podcast?.cover_image || show?.cover_image;
  const getShowName = (ep) => ep?.podcast?.title || ep?.podcast?.name || show?.title || show?.name || '';
  const getShowId = (ep) => ep?.podcast?.id || ep?.podcast_id || show?.id;

  const toggleFavorite = async (ep) => {
    const userId = user?.id || user?.user?.id || user?.pk;
    if (!userId || !isAuthenticated) {
      openAuth('login');
      return;
    }

    const isFavorited = favoriteEpisodeIds.has(ep.id);

    // Free users can have up to FREE_FAVORITE_LIMIT favorites; premium is unlimited
    if (!isFavorited && !isPremium && favoriteEpisodeIds.size >= FREE_FAVORITE_LIMIT) {
      toast({
        title: "Favorite limit reached",
        description: `Free accounts can save up to ${FREE_FAVORITE_LIMIT} favorites. Upgrade to premium for unlimited.`,
        variant: "destructive",
      });
      return;
    }

    try {
      if (isFavorited) {
        // Remove from favorites
        await UserLibrary.removeFavorite('episode', ep.id);
      } else {
        // Add to favorites
        await UserLibrary.addFavorite('episode', ep.id);
      }
      // Refresh favorites to update context
      await refreshFavorites();
    } catch (err) {
      if (typeof console !== 'undefined') console.debug('episode favorite toggle failed', err);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {rows.map((ep, idx) => {
        const fav = favoriteEpisodeIds.has(ep.id);
        const isRemoving = onRemoveFromPlaylist && removingEpisodeId === ep.id;
        const hasLockSet = lockedEpisodeIds instanceof Set;
        const isChapterLocked = hasLockSet && lockedEpisodeIds.has(ep.id);
        const isFreeSample = freeSampleEpisodeId != null && ep.id == freeSampleEpisodeId;
        // When the parent provides a lockedEpisodeIds set, trust it for exclusive gating.
        // Only fall back to the blanket is_exclusive check when no lock set is provided.
        // The free sample episode is never gated.
        const isGated = isFreeSample ? false : (
          isChapterLocked
          || ((!isPremium) && ep?.is_premium)
          || (!hasLockSet && (!isPremium) && (show?.is_exclusive || ep?.podcast?.is_exclusive))
        );
        const prog = episodeProgressMap?.get(Number(ep.id));
        const progPct = prog && prog.duration > 0 ? Math.min(100, Math.max(0, (prog.progress / prog.duration) * 100)) : 0;
        const isCompleted = prog?.completed || progPct >= 95;
        const hasProgress = progPct > 0;
        // Show a separator after the free sample row when there are more locked episodes below
        const showSeparatorAfter = isFreeSample && !isPremium && idx < rows.length - 1;
        const isDismissing = dismissingIds instanceof Set && dismissingIds.has(ep.id);
        return (
          <div
            key={ep.id || ep.slug || ep.title}
            className={`transition-all duration-300 ease-out origin-left ${isDismissing ? 'opacity-0 scale-y-0 -translate-x-3 pointer-events-none' : 'opacity-100 scale-y-100'}`}
            style={isDismissing ? { marginBlock: '-0.25rem' } : undefined}
          >
          <div
            className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg transition-colors group ${
              isChapterLocked
                ? 'opacity-50 hover:opacity-70'
                : 'hover:bg-gray-800/50'
            }`}
          >
            <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
              {/* Artwork with progress/lock overlay */}
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0">
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl">🎧</span>
                </div>
                {getArtwork(ep) && (
                  <img
                    src={getArtwork(ep)}
                    alt={ep.title}
                    loading="lazy"
                    width={64}
                    height={64}
                    className={`relative w-full h-full object-cover ${isChapterLocked ? 'grayscale' : ''}`}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                {isChapterLocked && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Lock className="w-4 h-4 text-zinc-400" />
                  </div>
                )}
                {isCompleted && !isChapterLocked && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                )}
                {hasProgress && !isCompleted && !isChapterLocked && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10">
                    <div className="h-full bg-red-500 transition-all" style={{ width: `${progPct}%` }} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3
                    className={`font-semibold text-base truncate cursor-pointer ${
                      isChapterLocked
                        ? 'text-zinc-500'
                        : 'text-white hover:text-blue-400'
                    }`}
                    onClick={() => onPlay && onPlay(ep)}
                  >
                    {ep.title}
                  </h3>
                  {isFreeSample && !isPremium && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-400/90 bg-emerald-500/10 border border-emerald-400/[0.08] px-1.5 py-0.5 rounded flex-shrink-0">
                      <Play className="w-2.5 h-2.5 fill-current" />
                      Free Preview
                    </span>
                  )}
                  {isChapterLocked && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-400/70 bg-amber-500/10 border border-amber-400/[0.06] px-1.5 py-0.5 rounded flex-shrink-0">
                      <Lock className="w-2.5 h-2.5" />
                      Premium
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-400">
                  {getShowId(ep) ? (
                    <Link
                      to={`${createPageUrl('Episodes')}?id=${encodeURIComponent(getShowId(ep))}`}
                      className="text-purple-400 font-medium truncate max-w-[60%] sm:max-w-[40%] hover:text-purple-300 transition-colors duration-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {getShowName(ep)}
                    </Link>
                  ) : (
                    <span className="text-purple-400 font-medium truncate max-w-[60%] sm:max-w-[40%]">{getShowName(ep)}</span>
                  )}
                  <span>•</span>
                  <span>{formatDuration(ep.duration || ep.length_seconds)}</span>
                  <span>•</span>
                  <span>{formatDate(ep.created_date || ep.published_at || ep.release_date)}</span>
                  {hasProgress && !isCompleted && !isChapterLocked && (
                    <>
                      <span>•</span>
                      <span className="text-red-400 text-xs">{Math.round(progPct)}% played</span>
                    </>
                  )}
                  {isCompleted && !isChapterLocked && (
                    <>
                      <span>•</span>
                      <span className="text-green-400 text-xs">Played</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-gray-400 mt-3 sm:mt-0 w-full sm:w-auto justify-end">
              {/* Remove from playlist (only in playlist context) */}
              {onRemoveFromPlaylist && (
                <button
                  className={`p-2 transition-colors ${isRemoving ? 'text-gray-500 cursor-wait' : 'hover:text-white'}`}
                  onClick={() => !isRemoving && onRemoveFromPlaylist(ep)}
                  title={isRemoving ? 'Removing...' : 'Remove from playlist'}
                  disabled={isRemoving}
                >
                  {isRemoving ? (
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                  ) : (
                    <Trash2 className="w-5 h-5" />
                  )}
                </button>
              )}
              {/* Triple dots → Favorite → Play */}
              {!isGated && (
                <EpisodeMenu episode={ep} podcast={show || ep?.podcast} onAddToPlaylist={onAddToPlaylist} />
              )}
              <button
                className={`p-2 transition-colors ${isGated ? 'text-gray-600 cursor-not-allowed' : 'hover:text-white'}`}
                onClick={() => { if (!isGated) toggleFavorite(ep); }}
                title={isGated ? 'Premium members only' : (fav ? 'Remove from favorites' : 'Add to favorites')}
                disabled={isGated}
              >
                <Heart className={`w-5 h-5 ${fav ? 'text-red-500 fill-current' : ''}`} />
              </button>
              {isChapterLocked ? (
                <Button
                  size="icon"
                  onClick={() => onPlay && onPlay(ep)}
                  className="bg-white/[0.04] border border-white/[0.06] text-zinc-500 w-9 h-9 rounded-lg hover:bg-white/[0.08]"
                >
                  <Lock className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  onClick={() => onPlay && onPlay(ep)}
                  className={`text-white w-9 h-9 rounded-lg hover:brightness-110 ${!accentColor ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700' : ''}`}
                  style={accentColor ? {
                    background: `linear-gradient(to right, ${accentColor.primary}, ${accentColor.darker})`,
                  } : undefined}
                >
                  <Play className="w-4 h-4 fill-white ml-0.5" />
                </Button>
              )}
            </div>
          </div>
          {showSeparatorAfter && (
            <div className="flex items-center gap-3 py-2 px-3">
              <div className="flex-1 h-px bg-gradient-to-r from-white/[0.06] via-white/[0.12] to-white/[0.06]" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Members Only</span>
              <div className="flex-1 h-px bg-gradient-to-r from-white/[0.06] via-white/[0.12] to-white/[0.06]" />
            </div>
          )}
          </div>
        );
      })}
    </div>
  );
}

EpisodesTable.propTypes = {
  episodes: PropTypes.array,
  show: PropTypes.object,
  onPlay: PropTypes.func,
  onAddToPlaylist: PropTypes.func,
  onRemoveFromPlaylist: PropTypes.func,
  removingEpisodeId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  lockedEpisodeIds: PropTypes.instanceOf(Set),
  accentColor: PropTypes.shape({
    primary: PropTypes.string,
    darker: PropTypes.string,
  }),
  freeSampleEpisodeId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  dismissingIds: PropTypes.instanceOf(Set),
  className: PropTypes.string,
};
