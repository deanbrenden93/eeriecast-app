import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Playlist } from '@/api/entities';

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
    } catch (e) {
      const msg = e?.data?.message || e?.data?.detail || e?.message || 'Failed to create playlist';
      setError(msg);
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
            <h2 className="text-xl font-semibold tracking-wide">Create Playlist</h2>
            <p className="text-sm text-gray-400 mt-1">Name your playlist to get started. You can add episodes later.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider font-medium text-gray-400 mb-1 block">Playlist Name</label>
              <Input
                autoFocus
                placeholder="My Queue"
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
                {submitting ? 'Creating…' : 'Create'}
              </Button>
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

