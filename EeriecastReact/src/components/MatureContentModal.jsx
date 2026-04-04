import PropTypes from 'prop-types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ShieldAlert, X } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { User as UserAPI } from '@/api/entities';

export default function MatureContentModal({ isOpen, onClose, onContinue }) {
  const { user, userAge, refreshUser } = useUser();
  const enabled = !!user?.allow_mature_content;
  const canToggle = userAge !== null && userAge >= 18;

  const handleToggle = async () => {
    if (!canToggle || !user) return;
    try {
      await UserAPI.updateMe({ allow_mature_content: !enabled });
      await refreshUser();
    } catch (err) {
      console.error('Failed to update mature content preference:', err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        hideClose
        className="max-w-[420px] bg-gradient-to-br from-[#1a0a0a] via-[#121316] to-[#1a1012] text-white border border-red-600/30 shadow-2xl shadow-red-900/30 p-0 overflow-hidden rounded-2xl"
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-1 text-zinc-500 hover:text-white hover:bg-white/10 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top accent */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[120px] bg-[radial-gradient(ellipse_at_center,_rgba(220,38,38,0.12),_transparent_70%)] pointer-events-none" />

        <div className="relative px-6 pt-8 pb-7 flex flex-col items-center text-center">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-red-600/10 border border-red-600/20 flex items-center justify-center mb-5 shadow-lg shadow-red-900/20">
            <ShieldAlert className="w-7 h-7 text-red-500" />
          </div>

          {/* Heading */}
          <h2 className="text-xl font-bold tracking-tight text-white mb-1">
            WARNING: Mature Content
          </h2>

          <div className="w-12 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent my-4" />

          {/* Body */}
          <p className="text-sm text-zinc-400 leading-relaxed mb-2">
            The content you are trying to play requires the user to be 18+ years of age
            or older and may contain offensive language, visceral depictions, and
            controversial topics.
          </p>

          <p className="text-sm text-zinc-300 leading-relaxed font-semibold italic mb-6">
            To enable listening to Mature content, please toggle the option below.
          </p>

          {/* Inline toggle */}
          {canToggle ? (
            <button
              type="button"
              onClick={handleToggle}
              className="w-full flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 transition-colors hover:bg-white/[0.05]"
            >
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                <div className="text-left">
                  <span className="text-sm font-medium text-zinc-200">Mature Content</span>
                  <p className="text-[11px] text-zinc-600 mt-0.5">I confirm I am 18 years or older</p>
                </div>
              </div>
              <div
                className={`relative w-9 h-[18px] rounded-full transition-all duration-300 flex-shrink-0 ${
                  enabled ? 'bg-red-600' : 'bg-zinc-700'
                }`}
              >
                <div
                  className={`absolute top-[3px] w-3 h-3 rounded-full bg-white transition-all duration-300 ${
                    enabled ? 'left-[21px]' : 'left-[3px]'
                  }`}
                />
              </div>
            </button>
          ) : (
            <div className="w-full rounded-xl border border-red-900/30 bg-red-950/20 px-4 py-3 text-xs text-red-400/80">
              Mature content is unavailable for users under 18.
            </div>
          )}

          {/* Confirm / Cancel */}
          <div className="w-full mt-4 flex flex-col gap-2">
            {enabled && (
              <button
                type="button"
                onClick={onContinue}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-red-900/30 transition-all duration-200 text-sm"
              >
                Continue Listening
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`text-xs text-zinc-600 hover:text-zinc-400 transition-colors ${enabled ? '' : 'mt-2'}`}
            >
              {enabled ? 'Dismiss' : 'Cancel'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

MatureContentModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onContinue: PropTypes.func.isRequired,
};
