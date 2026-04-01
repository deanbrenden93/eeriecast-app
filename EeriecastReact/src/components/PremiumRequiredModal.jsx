import PropTypes from 'prop-types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Crown, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function PremiumRequiredModal({ isOpen, onClose }) {
  const navigate = useNavigate();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        hideClose
        className="max-w-[420px] bg-gradient-to-br from-[#1a1008] via-[#121316] to-[#18130a] text-white border border-amber-600/30 shadow-2xl shadow-amber-900/20 p-0 overflow-hidden rounded-2xl"
      >
        <div className="relative px-6 pt-7 pb-6">
          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-600 hover:text-zinc-400 transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Accent glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[120px] bg-[radial-gradient(ellipse_at_center,_rgba(217,119,6,0.08)_0%,_transparent_70%)] pointer-events-none" />

          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center">
              <Crown className="w-7 h-7 text-amber-400" />
            </div>
          </div>

          {/* Heading */}
          <h2 className="text-lg font-bold text-center text-white mb-2">
            Members-Only Content
          </h2>
          <p className="text-sm text-zinc-400 text-center leading-relaxed mb-6">
            This episode is available exclusively to Eeriecast Premium members. Start a free trial to unlock all episodes, ad-free listening, and more.
          </p>

          {/* CTA */}
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate(createPageUrl('Premium'));
            }}
            className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-amber-900/20 transition-all duration-200 text-sm"
          >
            View Membership
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors text-center py-1"
          >
            Dismiss
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

PremiumRequiredModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
