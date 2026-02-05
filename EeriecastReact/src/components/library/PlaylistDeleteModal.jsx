import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Playlist } from '@/api/entities';

export default function PlaylistDeleteModal({ isOpen, playlist, onClose, onDeleted }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSubmitting(false);
      setError(null);
    }
  }, [isOpen, playlist?.id]);

  const handleDelete = async () => {
    if (!playlist?.id) return;
    try {
      setSubmitting(true);
      setError(null);
      await Playlist.delete(playlist.id);
      onDeleted && onDeleted(playlist);
      onClose && onClose();
    } catch (e) {
      const msg = e?.data?.message || e?.data?.detail || e?.message || 'Failed to delete playlist';
      setError(msg);
      setSubmitting(false);
    }
  };

  const name = playlist?.name || 'this playlist';
  const count = Array.isArray(playlist?.episodes) ? playlist.episodes.length : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose && onClose(); }}>
      <DialogContent className="w-[92vw] max-w-[520px] bg-gradient-to-br from-black via-[#121316] to-[#1f2128] text-white border border-red-600/40 shadow-2xl shadow-red-900/40 p-0 overflow-hidden">
        <div className="relative p-6 md:p-8">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="mb-5">
            <h2 className="text-xl font-semibold tracking-wide">Delete Playlist</h2>
            <p className="text-sm text-gray-400 mt-1">
              Are you sure you want to permanently delete <span className="text-gray-200 font-medium">&quot;{name}&quot;</span>?{' '}
              {typeof count === 'number' ? `It contains ${count} ${count === 1 ? 'episode' : 'episodes'}. ` : ''}
              This action cannot be undone.
            </p>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded px-3 py-2 mb-3">{error}</p>
          )}

          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose} className="text-gray-300 hover:text-white" disabled={submitting}>
              Cancel
            </Button>
            <Button type="button" onClick={handleDelete} className="bg-red-600 hover:bg-red-500" disabled={submitting}>
              {submitting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

PlaylistDeleteModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  playlist: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onDeleted: PropTypes.func,
};
