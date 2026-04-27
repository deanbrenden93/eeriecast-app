import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useUser } from "@/context/UserContext";
import { getShowSubtext } from "@/lib/utils";
import FollowButton from "@/components/common/FollowButton";

/**
 * "Your Shows" tile in the Library → Following tab.
 *
 * Earlier this tile carried its own dedicated "Following" pill below
 * the cover that doubled as an unfollow control. Now that every show
 * card across the app uses the overlayed FollowButton (top-right of
 * cover), the bottom pill is redundant — and worse, it took up
 * permanent vertical real estate just to express a state the cover
 * already implies (it's literally in the Following list). We drop it
 * in favor of the same overlay used everywhere else: tap the gold
 * check on the cover to unfollow.
 *
 * The card still animates out cleanly when the user unfollows: we
 * watch the global `followedPodcastIds` set and slide+fade ourselves
 * to zero width once we leave it, so the row collapses gracefully
 * without a jarring layout shift.
 */
export default function FollowingItem({ podcast }) {
  const { followedPodcastIds } = useUser();
  const navigate = useNavigate();
  const [isDismissed, setIsDismissed] = useState(false);

  const subtitle = getShowSubtext(podcast);
  const isFollowing = followedPodcastIds?.has(Number(podcast?.id));

  // When the global followed set drops this podcast (the user tapped
  // the overlay's check, or unfollowed from a different surface), play
  // a quick exit animation before the parent list re-renders without
  // us. The 380ms here matches the CSS transition duration below.
  useEffect(() => {
    if (!isFollowing && !isDismissed) {
      setIsDismissed(true);
    }
  }, [isFollowing, isDismissed]);

  const handleOpenEpisodes = () => {
    if (isDismissed) return;
    const pid = podcast?.id;
    if (!pid) return;
    navigate(`${createPageUrl('Episodes')}?id=${encodeURIComponent(pid)}`);
  };

  return (
    <div
      className={`flex-shrink-0 transition-all duration-[380ms] ease-out ${
        isDismissed
          ? 'opacity-0 scale-90 max-w-0 overflow-hidden mx-0 pointer-events-none'
          : 'max-w-[140px] w-[140px]'
      }`}
    >
      {/* Tappable cover + info area → navigates to show */}
      <div className="cursor-pointer" onClick={handleOpenEpisodes}>
        {/* Cover art with overlayed follow / unfollow button */}
        <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-white/[0.04] ring-1 ring-white/[0.06] transition-all duration-200">
          {podcast.cover_image ? (
            <img
              src={podcast.cover_image}
              alt={podcast.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-red-900/30">
              <span className="text-2xl">🎧</span>
            </div>
          )}

          {/* Overlayed follow control — top-right corner. Mirrors the
              placement used on Discover / Music ShowCard so the
              gesture is identical wherever a card appears. */}
          <div className="absolute top-2 right-2 z-[5]">
            <FollowButton podcast={podcast} />
          </div>
        </div>

        {/* Title + subtitle */}
        <div className="mt-2 px-0.5">
          <p className="text-white text-xs font-medium line-clamp-1 leading-tight">
            {podcast.title}
          </p>
          {subtitle && (
            <p className="text-zinc-500 text-[11px] line-clamp-1 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
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
