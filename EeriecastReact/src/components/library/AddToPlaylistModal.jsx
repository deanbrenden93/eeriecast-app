import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Playlist } from '@/api/entities';

export default function AddToPlaylistModal({ isOpen, episode, onClose, playlists = [], onAdded }) {
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [duplicateInfo, setDuplicateInfo] = useState(null); // playlist name when episode already exists

  useEffect(() => {
    if (isOpen) {
      setSelectedId(null);
      setCreating(false);
      setNewName('');
      setError(null);
      setSubmitting(false);
      setDuplicateInfo(null);
    }
  }, [isOpen, episode?.id]);

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (creating) return !!newName.trim();
    return !!selectedId;
  }, [creating, newName, selectedId, submitting]);

  const extractErrorMessage = (e) => {
    const data = e?.data || e?.response?.data;
    if (data) {
      if (typeof data.detail === 'string') return data.detail;
      if (typeof data.message === 'string') return data.message;
      if (data.episodes && Array.isArray(data.episodes)) return data.episodes.join(' ');
    }
    return e?.message || 'Failed to save changes';
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!episode?.id) return;

    try {
      setSubmitting(true);
      setError(null);

      if (creating) {
        const created = await Playlist.create({ name: newName.trim(), episodes: [episode.id] });
        onAdded && onAdded({ playlist: created, action: 'created' });
        onClose && onClose();
      } else {
        const id = selectedId;
        if (!id) return;
        // Get current playlist to merge episodes safely
        const pl = await Playlist.get(id);
        const currentRaw = Array.isArray(pl.episodes) ? pl.episodes : [];
        const currentIds = currentRaw.map((x) => (x && typeof x === 'object' ? x.id : x)).filter(Boolean);
        if (currentIds.includes(episode.id)) {
          setDuplicateInfo(pl.name || 'this playlist');
          setSubmitting(false);
          return;
        }
        const nextIds = Array.from(new Set([...currentIds, episode.id]));
        const updated = await Playlist.update(id, { episodes: nextIds });
        onAdded && onAdded({ playlist: updated, action: 'updated' });
        onClose && onClose();
      }
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose && onClose(); }}>
      <DialogContent className="w-[92vw] max-w-[560px] bg-gradient-to-br from-black via-[#121316] to-[#1f2128] text-white border border-red-600/40 shadow-2xl shadow-red-900/40 p-0 overflow-hidden z-[10200]">
        <div className="relative p-6 md:p-8">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />

          <div className="mb-6">
            <h2 className="text-xl font-semibold tracking-wide">Add to Playlist</h2>
            <p className="text-sm text-gray-400 mt-1">{episode?.title ? `Choose a playlist for “${episode.title}”.` : 'Choose a playlist.'}</p>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className={`px-3 py-1.5 rounded-full text-xs border ${!creating ? 'bg-red-600 border-red-600 text-white' : 'border-gray-700 text-gray-300 hover:text-white'}`}
            >
              Select Existing
            </button>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className={`px-3 py-1.5 rounded-full text-xs border ${creating ? 'bg-red-600 border-red-600 text-white' : 'border-gray-700 text-gray-300 hover:text-white'}`}
            >
              Create New
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!creating ? (
              <div className="max-h-56 overflow-y-auto rounded-md border border-gray-800 divide-y divide-gray-800">
                {playlists.length === 0 ? (
                  <div className="p-4 text-sm text-gray-400">You don’t have any playlists yet. Create one instead.</div>
                ) : (
                  playlists.map(pl => (
                    <label key={pl.id} className="flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer">
                      <input
                        type="radio"
                        name="playlist"
                        value={pl.id}
                        checked={selectedId === pl.id}
                        onChange={() => { setSelectedId(pl.id); setDuplicateInfo(null); }}
                        className="accent-red-600"
                      />
                      <div className="flex-1">
                        <div className="text-sm text-white font-medium">{pl.name}</div>
                        <div className="text-xs text-gray-400">{Array.isArray(pl.episodes) ? pl.episodes.length : 0} items{typeof pl.approximate_length_minutes === 'number' ? ` • ~${pl.approximate_length_minutes}m` : ''}</div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs uppercase tracking-wider font-medium text-gray-400 mb-1 block">Playlist Name</label>
                  <Input
                    autoFocus
                    placeholder="My Queue"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="bg-[#1b1d23] border-gray-700 focus-visible:ring-red-600"
                    disabled={submitting}
                  />
                </div>
                <p className="text-xs text-gray-400">We’ll create the playlist and add this episode to it.</p>
              </div>
            )}

            {duplicateInfo && (
              <p className="text-amber-300 text-sm bg-amber-950/30 border border-amber-700/40 rounded px-3 py-2">
                This episode is already in <span className="font-semibold text-amber-200">&quot;{duplicateInfo}&quot;</span>. Choose a different playlist or close.
              </p>
            )}

            {error && (
              <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded px-3 py-2">{error}</p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={onClose} className="text-gray-300 hover:text-white" disabled={submitting}>Cancel</Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-500" disabled={!canSubmit}>
                {submitting ? 'Saving…' : (creating ? 'Create and Add' : 'Add to Playlist')}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

AddToPlaylistModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  episode: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  playlists: PropTypes.array,
  onAdded: PropTypes.func,
};
