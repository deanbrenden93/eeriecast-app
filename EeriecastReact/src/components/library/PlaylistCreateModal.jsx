import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ListMusic, Plus, X } from 'lucide-react';
import { Playlist } from '@/api/entities';

// ── PlaylistCreateModal ───────────────────────────────────────────
//
// Visual + interaction parity with `AddToPlaylistModal`:
//   • Same violet identity (gradient panel, atmospheric glows,
//     violet border + shadow) so creating a playlist feels like
//     part of the same surface family.
//   • Shares the `ec-pop-modal` spring entrance / snappy exit
//     animation defined in `index.css`.
//   • Same header pattern: round violet icon chip on the left,
//     title + subtitle, custom X close button on the right
//     (Radix's default close is suppressed via `hideClose` so we
//     don't render two stacked X icons).
//   • Cancel / Create buttons styled as ghost + solid-violet to
//     match the primary actions used elsewhere in the playlist
//     surfaces.

export default function PlaylistCreateModal({ isOpen, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!name || !name.trim()) {
      setError('Please enter a playlist name');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      const created = await Playlist.create({ name: name.trim() });
      onCreated && onCreated(created);
      onClose && onClose();
    } catch (err) {
      const msg =
        err?.data?.message ||
        err?.data?.detail ||
        err?.message ||
        'Failed to create playlist';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !submitting) onClose && onClose(); }}>
      <DialogContent
        hideClose
        className="ec-pop-modal w-[94vw] max-w-[520px] bg-gradient-to-br from-[#0c0d12] via-[#11121a] to-[#1a1726] text-white border border-violet-500/30 shadow-2xl shadow-violet-900/40 p-0 overflow-hidden z-[10200]"
      >
        <div className="relative">
          {/* Atmospheric glow — identity-matched with AddToPlaylistModal */}
          <div className="absolute -top-32 -right-24 w-72 h-72 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-20 w-64 h-64 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

          {/* ── Header ─────────────────────────────────────────── */}
          <div className="relative px-6 pt-6 pb-4 md:px-8 md:pt-7">
            <div className="flex items-start justify-between gap-3 mb-1">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-violet-500/15 ring-1 ring-violet-400/30 flex items-center justify-center">
                  <ListMusic className="w-4 h-4 text-violet-300" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-wide">New Playlist</h2>
                  <p className="text-xs text-zinc-500 mt-0.5 max-w-[20rem]">
                    Name your playlist to get started. You can add episodes later.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                disabled={submitting}
                // Suppresses the chunky default browser focus ring
                // that otherwise lingers as a circle around the X
                // after a mouse click; keyboard users still get a
                // clean violet ring via `focus-visible`.
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 focus-visible:ring-offset-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Form ───────────────────────────────────────────── */}
          <form onSubmit={handleSubmit}>
            <div className="relative px-6 md:px-8 pb-6 md:pb-7">
              <label className="text-[10px] uppercase tracking-widest font-semibold text-violet-300/80 mb-1.5 block">
                Playlist name
              </label>
              <Input
                autoFocus
                placeholder="e.g. Late Night Listens"
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
                  disabled={submitting || !name.trim()}
                  className="h-9 px-4 rounded-md text-xs font-bold inline-flex items-center gap-1.5 bg-violet-500 hover:bg-violet-400 text-white shadow-[0_4px_18px_-4px_rgba(139,92,246,0.7)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {submitting ? 'Creating…' : 'Create Playlist'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

PlaylistCreateModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCreated: PropTypes.func,
};
