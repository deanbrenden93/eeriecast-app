import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Pencil, X, Check } from 'lucide-react';
import { Playlist } from '@/api/entities';

// ── PlaylistRenameModal ───────────────────────────────────────────
//
// Visual + interaction parity with `AddToPlaylistModal` and
// `PlaylistCreateModal`. The previous version still used the older
// red identity + default Radix close button, which made the rename
// flow feel disconnected from the rest of the playlist surfaces.
// This pass wires it into the same violet panel + spring entrance
// (`ec-pop-modal`) and uses a custom X close button so the header
// matches the rest of the modal family.

function extractErrorMessage(e) {
  const data = e?.data || e?.response?.data;
  if (data) {
    if (typeof data.detail === 'string') return data.detail;
    if (typeof data.message === 'string') return data.message;
    // DRF field-level errors: { "name": ["playlist with this name already exists."] }
    if (typeof data === 'object') {
      for (const [, msgs] of Object.entries(data)) {
        const msg = Array.isArray(msgs) ? msgs[0] : msgs;
        if (typeof msg === 'string') {
          if (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('unique'))
            return 'A playlist with this name already exists. Please choose a different name.';
          return msg;
        }
      }
    }
  }
  return e?.message || 'Failed to rename playlist. Please try again.';
}

export default function PlaylistRenameModal({ isOpen, playlist, onClose, onRenamed }) {
  const [name, setName] = useState(playlist?.name || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setName(playlist?.name || '');
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen, playlist?.id, playlist?.name]);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    const trimmed = (name || '').trim();
    if (!trimmed) {
      setError('Please enter a playlist name');
      return;
    }
    if (trimmed === (playlist?.name || '')) {
      onClose && onClose();
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      const updated = await Playlist.update(playlist.id, { name: trimmed });
      onRenamed && onRenamed(updated);
      onClose && onClose();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const isUnchanged =
    !!playlist?.name && (name || '').trim() === (playlist?.name || '').trim();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !submitting) onClose && onClose(); }}>
      <DialogContent
        hideClose
        className="ec-pop-modal w-[94vw] max-w-[520px] bg-gradient-to-br from-[#0c0d12] via-[#11121a] to-[#1a1726] text-white border border-violet-500/30 shadow-2xl shadow-violet-900/40 p-0 overflow-hidden z-[10200]"
      >
        <div className="relative max-w-full">
          {/* Atmospheric glow — identity-matched with the rest of the
              playlist modal family. */}
          <div className="absolute -top-32 -right-24 w-72 h-72 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-20 w-64 h-64 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

          {/* ── Header ─────────────────────────────────────────── */}
          <div className="relative px-4 pt-5 pb-3 sm:px-6 sm:pt-6 sm:pb-4 md:px-8 md:pt-7">
            <div className="flex items-start justify-between gap-2 sm:gap-3 mb-1">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-full bg-violet-500/15 ring-1 ring-violet-400/30 flex items-center justify-center flex-shrink-0">
                  <Pencil className="w-4 h-4 text-violet-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base sm:text-lg font-semibold tracking-wide truncate">Rename Playlist</h2>
                  <p className="text-xs text-zinc-500 mt-0.5 truncate">
                    {playlist?.name ? `Currently "${playlist.name}"` : 'Update the name of your playlist.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                disabled={submitting}
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 focus-visible:ring-offset-0 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Form ───────────────────────────────────────────── */}
          <form onSubmit={handleSubmit}>
            <div className="relative px-4 sm:px-6 md:px-8 pb-5 sm:pb-6 md:pb-7">
              <label className="text-[10px] uppercase tracking-widest font-semibold text-violet-300/80 mb-1.5 block">
                New name
              </label>
              <Input
                autoFocus
                placeholder="Playlist name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-black/30 border-white/[0.08] focus-visible:ring-violet-500 h-10 text-sm"
                disabled={submitting}
                maxLength={120}
              />

              {error && (
                <p className="mt-3 text-xs text-rose-300 bg-rose-500/10 border border-rose-400/20 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              {/* ── Footer actions ───────────────────────────── */}
              <div className="flex items-center justify-end gap-2 pt-5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="h-9 px-3.5 rounded-md text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.04] transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !name.trim() || isUnchanged}
                  className="h-9 px-4 rounded-md text-xs font-bold inline-flex items-center gap-1.5 bg-violet-500 hover:bg-violet-400 text-white shadow-[0_4px_18px_-4px_rgba(139,92,246,0.7)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60 whitespace-nowrap"
                >
                  <Check className="w-3.5 h-3.5" />
                  {submitting ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

PlaylistRenameModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  playlist: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onRenamed: PropTypes.func,
};
