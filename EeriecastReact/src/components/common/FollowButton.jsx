import { useState, useRef } from "react";
import PropTypes from "prop-types";
import { Plus, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { UserLibrary } from "@/api/entities";
import { useUser } from "@/context/UserContext";
import { useAuthModal } from "@/context/AuthModalContext.jsx";

/**
 * App-wide follow/unfollow button for show cards.
 *
 * Styled as a small, regal pill that sits on top of cover art without
 * obscuring the imagery — translucent glass when unfollowed, with a
 * brief gold-burst animation on follow and a soft fade on unfollow.
 *
 * The pill auto-positions in the top-right corner of its parent
 * (which must be `position: relative`); pass `className` to override.
 */
export default function FollowButton({
  podcast,
  className = "",
  size = "sm",
  stopPropagation = true,
}) {
  const { followedPodcastIds, refreshFollowings, isAuthenticated } = useUser();
  const { openAuth } = useAuthModal();
  const [busy, setBusy] = useState(false);
  // Keyed animation triggers — each click bumps the key so AnimatePresence
  // re-runs the regal-burst overlay even on repeat clicks.
  const [burstKey, setBurstKey] = useState(0);
  const [burstKind, setBurstKind] = useState(null);
  const lastClickRef = useRef(0);

  const podcastId = Number(podcast?.id);
  const isFollowing = Number.isFinite(podcastId) && followedPodcastIds?.has(podcastId);

  const handleClick = async (e) => {
    if (stopPropagation) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (busy || !Number.isFinite(podcastId)) return;
    if (!isAuthenticated) { openAuth('login'); return; }
    // Debounce double-taps.
    const now = Date.now();
    if (now - lastClickRef.current < 350) return;
    lastClickRef.current = now;

    const wasFollowing = isFollowing;
    setBusy(true);
    setBurstKind(wasFollowing ? 'unfollow' : 'follow');
    setBurstKey((k) => k + 1);
    try {
      if (wasFollowing) {
        await UserLibrary.unfollowPodcast(podcastId);
      } else {
        await UserLibrary.followPodcast(podcastId);
      }
      await refreshFollowings();
    } catch (err) {
      console.error('Follow toggle failed', err);
    } finally {
      setBusy(false);
    }
  };

  // The two states render at deliberately different visual weights:
  //
  //   • Unfollowed → a full "+ Follow" pill. This is a CTA — we want
  //     the listener to notice it and act.
  //   • Followed → a tiny circular check badge. The work is done; it
  //     just needs to confirm "you're in" without crowding the cover
  //     art. Earlier iterations rendered a bold amber "Following" pill
  //     here, which on a 5-up Members Only row visibly competed with
  //     the artwork. Shrinking the affirmative state to a coin-sized
  //     glyph keeps it elegant and unmistakable.
  //
  // The followed state is square (`aspect-square`, no horizontal
  // padding) so the icon centers cleanly; both states share the same
  // height so the row alignment is identical regardless of state.
  const heightClass =
    size === "lg" ? "h-9" : size === "md" ? "h-8" : "h-7";
  const padClass =
    size === "lg" ? "px-3.5 text-[12px]" : size === "md" ? "px-3 text-[11px]" : "px-2.5 text-[10.5px]";
  const iconSize =
    size === "lg" ? "w-4 h-4" : size === "md" ? "w-3.5 h-3.5" : "w-3 h-3";

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-pressed={isFollowing}
      aria-label={isFollowing ? `Unfollow ${podcast?.title || 'show'}` : `Follow ${podcast?.title || 'show'}`}
      title={isFollowing ? 'Following — tap to unfollow' : 'Follow show'}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.06 }}
      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
      className={`relative inline-flex items-center justify-center gap-1 rounded-full font-semibold tracking-wide
        backdrop-blur-md border shadow-[0_2px_10px_rgba(0,0,0,0.35)]
        transition-colors duration-300
        ${heightClass}
        ${isFollowing
          ? `aspect-square p-0 bg-black/55 border-amber-300/55 text-amber-200 hover:bg-black/70 hover:border-amber-200/80 hover:text-amber-100`
          : `${padClass} bg-black/55 border-white/[0.18] text-white hover:bg-black/70 hover:border-white/30`
        }
        ${className}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {isFollowing ? (
          <motion.span
            key="following"
            initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
            transition={{ type: 'spring', stiffness: 520, damping: 22 }}
            className="inline-flex items-center justify-center"
          >
            <Check className={iconSize} strokeWidth={3} />
            {/* Visually-hidden label so screen readers still announce
                the state even though the glyph stands on its own. */}
            <span className="sr-only">Following</span>
          </motion.span>
        ) : (
          <motion.span
            key="follow"
            initial={{ opacity: 0, scale: 0.6, rotate: 45 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.6, rotate: -45 }}
            transition={{ type: 'spring', stiffness: 520, damping: 22 }}
            className="inline-flex items-center gap-1"
          >
            <Plus className={iconSize} strokeWidth={2.6} />
            <span>Follow</span>
          </motion.span>
        )}
      </AnimatePresence>

      {/* Regal burst — radiates a soft halo on every state change. Pointer
          events disabled so the burst never blocks repeated clicks. */}
      <AnimatePresence>
        {burstKind && (
          <motion.span
            key={burstKey}
            initial={{ opacity: 0.65, scale: 0.4 }}
            animate={{ opacity: 0, scale: 1.9 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={() => setBurstKind(null)}
            className={`pointer-events-none absolute inset-0 rounded-full ${
              burstKind === 'follow'
                ? 'bg-amber-300/60 shadow-[0_0_22px_rgba(251,191,36,0.65)]'
                : 'bg-white/15'
            }`}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}

FollowButton.propTypes = {
  podcast: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    title: PropTypes.string,
  }).isRequired,
  className: PropTypes.string,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  stopPropagation: PropTypes.bool,
};
