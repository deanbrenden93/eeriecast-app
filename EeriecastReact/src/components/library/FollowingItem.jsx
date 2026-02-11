import PropTypes from "prop-types";
import { UserCheck } from "lucide-react";
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
  const [isDismissed, setIsDismissed] = useState(false);
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
    if (isUnfollowing || isDismissed || !podcast?.id) return;
    if (!isAuthenticated) { openAuth('login'); return; }

    setIsUnfollowing(true);
    try {
      await UserLibrary.unfollowPodcast(podcast.id);
      // Trigger fade-out animation, then refresh list after it completes
      setIsDismissed(true);
      setTimeout(() => refreshFollowings(), 400);
    } catch (err) {
      console.error('Failed to unfollow:', err);
      setIsUnfollowing(false);
    }
  };

  const handleOpenEpisodes = () => {
    if (isDismissed) return;
    const pid = podcast?.id;
    if (!pid) return;
    navigate(`${createPageUrl('Episodes')}?id=${encodeURIComponent(pid)}`);
  };

  return (
    <div
      className={`flex-shrink-0 transition-all duration-300 ease-out ${
        isDismissed
          ? 'opacity-0 scale-90 max-w-0 overflow-hidden mx-0 pointer-events-none'
          : 'max-w-[140px] w-[140px]'
      }`}
    >
      {/* Tappable cover + info area → navigates to show */}
      <div className="cursor-pointer" onClick={handleOpenEpisodes}>
        {/* Cover art */}
        <div className="w-full aspect-square rounded-xl overflow-hidden bg-white/[0.04] ring-1 ring-white/[0.06] transition-all duration-200">
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

      {/* Always-visible "Following" pill — tapping unfollows */}
      <button
        className={`mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200
          ${isUnfollowing
            ? 'bg-white/[0.04] border border-white/[0.06] text-zinc-600 cursor-wait'
            : 'bg-white/[0.06] border border-white/[0.08] text-zinc-300 hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400 active:bg-red-500/20'
          }`}
        onClick={handleUnfollow}
        disabled={isUnfollowing || isDismissed}
      >
        {isUnfollowing ? (
          <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
        ) : (
          <UserCheck className="w-3 h-3" />
        )}
        {isUnfollowing ? 'Unfollowing...' : 'Following'}
      </button>
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
