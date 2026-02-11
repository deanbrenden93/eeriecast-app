import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Playlist } from '@/api/entities';

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
    // No change; just close silently
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
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose && onClose(); }}>
      <DialogContent className="w-[92vw] max-w-[520px] bg-gradient-to-br from-black via-[#121316] to-[#1f2128] text-white border border-red-600/40 shadow-2xl shadow-red-900/40 p-0 overflow-hidden">
        <div className="relative p-6 md:p-8">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="mb-6">
            <h2 className="text-xl font-semibold tracking-wide">Rename Playlist</h2>
            <p className="text-sm text-gray-400 mt-1">Update the name of your playlist.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider font-medium text-gray-400 mb-1 block">New Name</label>
              <Input
                autoFocus
                placeholder="Playlist name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-[#1b1d23] border-gray-700 focus-visible:ring-red-600"
                disabled={submitting}
              />
            </div>
            {error && (
              <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded px-3 py-2">{error}</p>
            )}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={onClose} className="text-gray-300 hover:text-white" disabled={submitting}>Cancel</Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-500" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save'}
              </Button>
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
