import PropTypes from "prop-types";
import { Clock, Play, Share2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { shareEpisode, shareEpisodeAtTimestamp } from "@/lib/share";

/**
 * ShareEpisodeDialog
 *
 * Asks the sharer which entry point the recipient should land on:
 *   • "At <current time>"   → deep-link with ?t=<seconds>, so the
 *                              recipient jumps straight into the moment
 *                              the sharer wants to highlight.
 *   • "From the beginning"  → clean episode link, no timestamp.
 *
 * Rendered on top of the ExpandedPlayer. We deliberately use the shared
 * Radix dialog primitive (z-[10200]) so we always float above the
 * expanded player chrome rather than getting visually buried by it.
 *
 * The dialog ONLY appears when it actually adds value — i.e. the
 * listener has progressed past a few seconds into the episode. The
 * ExpandedPlayer's share button calls `shareEpisode(podcast, episode)`
 * directly when currentTime is effectively zero, so we never pop an
 * extra modal just to confirm "yes, share from the start."
 */
function formatTimestamp(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function ShareEpisodeDialog({
  isOpen,
  onClose,
  podcast,
  episode,
  timestampSeconds,
}) {
  const ts = Math.max(0, Math.floor(timestampSeconds || 0));
  const timeLabel = formatTimestamp(ts);

  const handleShareAtTime = async () => {
    try { await shareEpisodeAtTimestamp(podcast, episode, ts); }
    finally { onClose?.(); }
  };

  const handleShareFromStart = async () => {
    try { await shareEpisode(podcast, episode); }
    finally { onClose?.(); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent className="max-w-md bg-[#14141c] border-white/[0.08] text-white">
        <DialogHeader>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Share2 className="w-4 h-4 text-red-400" />
            </div>
            <DialogTitle className="text-white text-base font-semibold">
              Share this episode
            </DialogTitle>
          </div>
          <DialogDescription className="text-zinc-400 text-[13px] leading-relaxed">
            Pick how your link should open for whoever you send it to.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 mt-1">
          {/* Share at current timestamp. The primary action — that's
              what "share while listening" is mostly for. Amber accent
              matches the "bookmarked moment" feel. */}
          <button
            type="button"
            onClick={handleShareAtTime}
            className="group flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] hover:bg-amber-500/[0.12] hover:border-amber-400/50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-amber-500/15 border border-amber-400/30 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-amber-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-amber-100">
                Start at {timeLabel}
              </p>
              <p className="text-[11px] text-amber-200/70 mt-0.5">
                They'll jump straight into the moment you're on.
              </p>
            </div>
          </button>

          {/* Share from beginning */}
          <button
            type="button"
            onClick={handleShareFromStart}
            className="group flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.15] transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center flex-shrink-0">
              <Play className="w-4 h-4 text-zinc-200 fill-zinc-200" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-white">
                Start from the beginning
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                A clean link without a timestamp.
              </p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

ShareEpisodeDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  podcast: PropTypes.object,
  episode: PropTypes.object,
  timestampSeconds: PropTypes.number,
};
