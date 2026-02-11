import PropTypes from "prop-types";
import { X } from "lucide-react";
import { UserLibrary } from "@/api/entities";
import { useUser } from "@/context/UserContext";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useAuthModal } from "@/context/AuthModalContext.jsx";

export default function FollowingItem({ podcast }) {
  const { refreshFollowings, isAuthenticated } = useUser();
  const { openAuth } = useAuthModal();
  const [isUnfollowing, setIsUnfollowing] = useState(false);
  const navigate = useNavigate();

  const creatorName = useMemo(() => {
    if (typeof podcast?.author === 'string' && podcast.author.trim()) return podcast.author;
    const c = podcast?.creator;
    if (!c) return '';
    if (typeof c === 'string' && c.trim()) return c;
    if (typeof c === 'object') return c.display_name || c.name || c.username || '';
    return '';
  }, [podcast?.author, podcast?.creator]);

  const handleUnfollow = async (e) => {
    e?.stopPropagation?.();
    if (isUnfollowing || !podcast?.id) return;
    if (!isAuthenticated) { openAuth('login'); return; }

    setIsUnfollowing(true);
    try {
      await UserLibrary.unfollowPodcast(podcast.id);
      await refreshFollowings();
    } catch (err) {
      console.error('Failed to unfollow:', err);
    } finally {
      setIsUnfollowing(false);
    }
  };

  const handleOpenEpisodes = () => {
    const pid = podcast?.id;
    if (!pid) return;
    navigate(`${createPageUrl('Episodes')}?id=${encodeURIComponent(pid)}`);
  };

  return (
    <div
      className="relative group flex-shrink-0 w-[140px] cursor-pointer"
      onClick={handleOpenEpisodes}
    >
      {/* Unfollow button — visible on hover */}
      <button
        className={`absolute -top-1.5 -right-1.5 z-10 w-6 h-6 rounded-full flex items-center justify-center
          bg-black/80 border border-white/10 text-zinc-400 hover:text-white hover:bg-red-600 hover:border-red-500
          opacity-0 group-hover:opacity-100 transition-all duration-200 ${isUnfollowing ? 'opacity-100 cursor-wait' : ''}`}
        onClick={handleUnfollow}
        disabled={isUnfollowing}
        title="Unfollow"
      >
        {isUnfollowing ? (
          <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
        ) : (
          <X className="w-3 h-3" />
        )}
      </button>

      {/* Cover art */}
      <div className="w-full aspect-square rounded-xl overflow-hidden bg-white/[0.04] ring-1 ring-white/[0.06] group-hover:ring-white/[0.12] transition-all duration-200">
        {podcast.cover_image ? (
          <img
            src={podcast.cover_image}
            alt={podcast.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-red-900/30">
            <span className="text-2xl">🎧</span>
          </div>
        )}
      </div>

      {/* Title + Creator */}
      <div className="mt-2 px-0.5">
        <p className="text-white text-xs font-medium line-clamp-1 leading-tight">
          {podcast.title}
        </p>
        {creatorName && (
          <p className="text-zinc-500 text-[11px] line-clamp-1 mt-0.5">
            {creatorName}
          </p>
        )}
      </div>
    </div>
  );
}

FollowingItem.propTypes = {
  podcast: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    title: PropTypes.string,
    author: PropTypes.string,
    creator: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    cover_image: PropTypes.string,
  }).isRequired,
};
