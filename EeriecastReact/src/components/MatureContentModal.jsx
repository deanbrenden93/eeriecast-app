import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ShieldAlert, X, Lock } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { User as UserAPI } from '@/api/entities';

export default function MatureContentModal({ isOpen, onClose, onContinue, contentClassName, overlayClassName }) {
  const {
    user,
    userAge,
    isAuthenticated,
    refreshUser,
    guestAllowMature,
    setGuestAllowMature,
  } = useUser();

  // Matches the Settings / Profile rules so this modal behaves identically
  // to those surfaces:
  //   • logged-in + DOB ≥ 18        → flips `allow_mature_content` directly
  //   • logged-in + no DOB on file  → self-attestation required first
  //   • guest                       → self-attestation required first
  //   • logged-in + DOB < 18        → toggle is locked
  const underEighteen = isAuthenticated && userAge !== null && userAge < 18;
  const needsAttestation =
    (!isAuthenticated) ||
    (isAuthenticated && userAge === null);

  const enabled = isAuthenticated
    ? !!user?.allow_mature_content
    : !!guestAllowMature;

  const [attesting, setAttesting] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Reset the nested attestation view whenever the modal re-opens, so
    // dismiss + re-entry starts from the main toggle instead of a stale
    // confirmation screen.
    if (!isOpen) setAttesting(false);
  }, [isOpen]);

  const setEnabled = async (next) => {
    setBusy(true);
    try {
      if (isAuthenticated) {
        await UserAPI.updateMe({ allow_mature_content: next });
        await refreshUser();
      } else {
        setGuestAllowMature(next);
      }
    } catch (err) {
      console.error('Failed to update explicit language preference:', err);
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async () => {
    if (underEighteen || busy) return;
    const next = !enabled;
    if (next && needsAttestation) {
      setAttesting(true);
      return;
    }
    await setEnabled(next);
  };

  const handleAttestConfirm = async () => {
    await setEnabled(true);
    setAttesting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        hideClose
        // ``contentClassName`` / ``overlayClassName`` allow callers to bump
        // the modal above a higher-z layer (e.g. the onboarding overlay at
        // z-[10300]) without affecting the default behavior. Passed last so
        // tailwind-merge resolves the z-index conflict in favor of the
        // override.
        className={`max-w-[420px] bg-gradient-to-br from-[#1a0a0a] via-[#121316] to-[#1a1012] text-white border border-red-600/30 shadow-2xl shadow-red-900/30 p-0 overflow-hidden rounded-2xl ${contentClassName || ''}`}
        overlayClassName={overlayClassName}
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
            Heads-up: Explicit Language
          </h2>

          <div className="w-12 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent my-4" />

          {/* Body */}
          <p className="text-sm text-zinc-400 leading-relaxed mb-2">
            Some shows contain language not suitable for younger audiences.
            To keep listening, allow explicit-language shows on your account below.
          </p>

          <p className="text-xs text-zinc-500 leading-relaxed mb-6">
            You can turn this off any time from your profile or settings.
          </p>

          {/* Inline toggle — summarized version of the Settings/Profile
              toggle. Same wiring: guests + users without a DOB pass through
              an 18+ attestation sub-view, everyone else toggles directly. */}
          {underEighteen ? (
            <div className="w-full rounded-xl border border-red-900/30 bg-red-950/20 px-4 py-3 flex items-center gap-3 text-xs text-red-400/80">
              <Lock className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-left leading-snug">
                Explicit-language shows aren&apos;t available on accounts under 18.
              </span>
            </div>
          ) : attesting ? (
            <div className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4 flex flex-col gap-3 text-left">
              <div className="flex items-start gap-3">
                <Lock className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Confirm you are <span className="font-semibold text-white">18 years or older</span> to enable
                  explicit-language shows on this account.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAttesting(false)}
                  className="flex-1 rounded-lg border border-white/[0.08] text-zinc-300 hover:bg-white/[0.04] hover:text-white text-xs py-2 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAttestConfirm}
                  disabled={busy}
                  className="flex-1 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs py-2 font-semibold"
                >
                  I am 18+
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleToggle}
              disabled={busy}
              className="w-full flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 transition-colors hover:bg-white/[0.05] disabled:opacity-60 disabled:cursor-not-allowed"
              aria-pressed={enabled}
            >
              <div className="flex items-center gap-3 min-w-0">
                <ShieldAlert className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                <div className="text-left min-w-0">
                  <span className="text-sm font-medium text-zinc-200 block">
                    Allow Shows with Explicit Language
                  </span>
                  <p className="text-[11px] text-zinc-600 mt-0.5 leading-snug">
                    Required to play shows marked explicit.
                  </p>
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
          )}

          {/* Confirm / Cancel */}
          <div className="w-full mt-4 flex flex-col gap-2">
            {enabled && !attesting && !underEighteen && (
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
              className={`text-xs text-zinc-600 hover:text-zinc-400 transition-colors ${enabled && !attesting && !underEighteen ? '' : 'mt-2'}`}
            >
              {enabled && !attesting && !underEighteen ? 'Dismiss' : 'Cancel'}
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
  contentClassName: PropTypes.string,
  overlayClassName: PropTypes.string,
};
