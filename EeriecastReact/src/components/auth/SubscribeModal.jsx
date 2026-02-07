// filepath: src/components/auth/SubscribeModal.jsx
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { createPageUrl } from '@/utils';
import { X, Crown, Headphones, BookOpen, Sparkles } from 'lucide-react';

export default function SubscribeModal({
  open,
  onOpenChange,
  title = 'Unlock the full experience',
  message = 'This content is available exclusively to Eeriecast members. Subscribe to unlock all premium shows, audiobooks, and episodes.',
  itemLabel,
}) {
  const navigate = useNavigate();

  const goPremium = () => {
    onOpenChange?.(false);
    navigate(createPageUrl('Premium'));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#0e0e14]/95 text-white border border-white/[0.06] backdrop-blur-2xl shadow-2xl shadow-black/80 rounded-2xl max-w-md p-0 overflow-hidden"
        // Hide the default DialogContent close button — we render our own
        hideClose
      >
        {/* Visually hidden accessible title + description */}
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{message}</DialogDescription>

        {/* ── Ambient glow ── */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-40 rounded-full blur-[100px] opacity-[0.12] bg-gradient-to-br from-red-600 via-amber-500 to-transparent pointer-events-none" />

        {/* ── Close button (top-right) ── */}
        <button
          type="button"
          onClick={() => onOpenChange?.(false)}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.06] border border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.1] transition-all"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ── Top accent strip ── */}
        <div className="h-1 bg-gradient-to-r from-red-600 via-amber-500 to-red-600" />

        <div className="relative px-6 pt-7 pb-6">
          {/* ── Icon ── */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/20 to-amber-500/10 border border-red-500/[0.08] flex items-center justify-center mx-auto mb-5">
            <Crown className="w-7 h-7 text-amber-400" />
          </div>

          {/* ── Title ── */}
          <h2 className="text-xl font-display italic text-center text-white mb-2">
            {title}
          </h2>

          {/* ── Item label (e.g. episode title) ── */}
          {itemLabel && (
            <p className="text-center text-sm text-zinc-400 mb-3 truncate max-w-[90%] mx-auto">
              {itemLabel}
            </p>
          )}

          {/* ── Message ── */}
          <p className="text-center text-sm text-zinc-500 leading-relaxed mb-6 max-w-sm mx-auto">
            {message}
          </p>

          {/* ── Perks ── */}
          <div className="space-y-2.5 mb-7">
            {[
              { icon: Headphones, text: 'All premium podcasts & episodes' },
              { icon: BookOpen, text: 'Full audiobook & e-reader access' },
              { icon: Sparkles, text: 'Early access to new content' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div className="w-7 h-7 rounded-md bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-amber-400/80" />
                </div>
                <span className="text-sm text-zinc-300">{text}</span>
              </div>
            ))}
          </div>

          {/* ── Actions ── */}
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={goPremium}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold text-sm shadow-lg shadow-red-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] border border-red-500/20"
            >
              See Plans
            </button>
            <button
              type="button"
              onClick={() => onOpenChange?.(false)}
              className="w-full py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] text-sm font-medium transition-all"
            >
              Not now
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

SubscribeModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  title: PropTypes.string,
  message: PropTypes.string,
  itemLabel: PropTypes.string,
};
