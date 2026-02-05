import PropTypes from "prop-types";
import { UserCheck, Plus } from "lucide-react";
import { UserLibrary } from "@/api/entities";
import { useUser } from "@/context/UserContext";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useAuthModal } from "@/context/AuthModalContext.jsx";

const formatTotalDuration = (seconds) => {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (hrs <= 0 && mins <= 0) return '0 min';
  if (hrs <= 0) return `${mins} min`;
  if (mins <= 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
};

export default function FollowingItem({ episode, onAddToPlaylist }) {
  const podcast = episode; // Treat incoming prop as podcast
  const { refreshFollowings, isAuthenticated } = useUser();
  const { openAuth } = useAuthModal();
  const [isUnfollowing, setIsUnfollowing] = useState(false);
  const navigate = useNavigate();

  // Compute total duration from episodes (seconds -> hr/min)
  const { totalDurationLabel, episodesCount } = useMemo(() => {
    const eps = Array.isArray(podcast?.episodes) ? podcast.episodes : [];
    const totalSeconds = eps.reduce((acc, ep) => acc + (Number(ep?.duration) || 0), 0);
    return { totalDurationLabel: formatTotalDuration(totalSeconds), episodesCount: eps.length };
  }, [podcast?.episodes]);

  // Safely compute creator display name
  const creatorName = useMemo(() => {
    if (typeof podcast?.author === 'string' && podcast.author.trim()) return podcast.author;
    const c = podcast?.creator;
    if (!c) return 'Unknown Creator';
    if (typeof c === 'string' && c.trim()) return c;
    if (typeof c === 'object') return c.display_name || c.name || c.username || 'Unknown Creator';
    return 'Unknown Creator';
  }, [podcast?.author, podcast?.creator]);

  const handleUnfollow = async (e) => {
    e?.stopPropagation?.();
    if (isUnfollowing || !podcast?.id) return;
    if (!isAuthenticated) { openAuth('login'); return; }

    setIsUnfollowing(true);
    try {
      await UserLibrary.unfollowPodcast(podcast.id);
      await refreshFollowings();
    } catch (e) {
      console.error('Failed to unfollow:', e);
    } finally {
      setIsUnfollowing(false);
    }
  };

  const handleAddToPlaylistClick = (e) => {
    e?.stopPropagation?.();
    if (!isAuthenticated) { openAuth('login'); return; }
    if (onAddToPlaylist) onAddToPlaylist(podcast);
  };

  const handleOpenEpisodes = () => {
    const pid = podcast?.id;
    if (!pid) return;
    navigate(`${createPageUrl('Episodes')}?id=${encodeURIComponent(pid)}`);
  };

  return (
    <div 
      className="following-item bg-gray-800/60 rounded-lg p-3 flex flex-col cursor-pointer hover:bg-gray-800/80 transition-colors"
      data-following-id={podcast.id}
      data-action="following"
      onClick={handleOpenEpisodes}
    >
      <div className="flex items-start justify-between mb-3">
        <div 
          className="cover w-12 h-12 rounded-lg flex-shrink-0"
          style={{
            background: podcast.cover_image
              ? `url('${podcast.cover_image}') center/cover no-repeat`
              : 'linear-gradient(135deg, #ff0040, #9d00ff)'
          }}
        >
          {!podcast.cover_image && (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-lg">🎧</span>
            </div>
          )}
        </div>
        
        <div className="actions flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            className="p-1 text-gray-400 hover:text-white transition-colors"
            onClick={handleAddToPlaylistClick}
            data-action="add-to-playlist"
            data-episode-id={podcast.id}
            data-episode-title={podcast.title}
            title="Add to playlist"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            className={`p-1 transition-colors ${
              isUnfollowing 
                ? 'text-gray-500 cursor-not-allowed' 
                : 'text-blue-500 hover:text-blue-400'
            }`}
            onClick={handleUnfollow}
            disabled={isUnfollowing}
            data-action="unfollow"
            data-episode-id={podcast.id}
            title="Unfollow"
          >
            <UserCheck className="w-4 h-4 fill-current" />
          </button>
        </div>
      </div>
      
      <div className="info flex-1">
        <h3 className="text-white font-semibold text-sm line-clamp-2 leading-tight mb-1">
          {podcast.title}
        </h3>
        <p className="show-name text-blue-400 text-xs mb-2 line-clamp-1">
          {creatorName}
        </p>
        <p className="meta text-gray-400 text-xs">
          {episodesCount > 0 ? `${episodesCount} episode${episodesCount !== 1 ? 's' : ''} • ${totalDurationLabel}` : 'No episodes yet'}
        </p>
      </div>
    </div>
  );
}

FollowingItem.propTypes = {
  episode: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    title: PropTypes.string,
    author: PropTypes.string,
    creator: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    cover_image: PropTypes.string,
    episodes: PropTypes.array,
  }).isRequired,
  onAddToPlaylist: PropTypes.func,
};
