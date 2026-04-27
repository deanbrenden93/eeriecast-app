import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, Check, ListMusic, Headphones, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Playlist } from '@/api/entities';
import { usePlaylistContext, getEpisodesBatch } from '@/context/PlaylistContext.jsx';
import { toast } from '@/components/ui/use-toast';

// ── AddToPlaylistModal ────────────────────────────────────────────
//
// Polished, multi-select Add-to-Playlist surface used everywhere an
// episode can be added to one or more playlists.
//
// What changed vs. the old modal:
//
//  • Multi-select: tap as many playlists as you want, submit once.
//    Underlying mutations run in parallel through the optimistic
//    `addEpisodeToPlaylist` helper in `PlaylistContext`, so the
//    Library cards and Playlist screens flip to their final state
//    instantly while the PATCHes settle.
//  • Already-in indicator: rendered synchronously from each
//    playlist's own `episodes` ID array — no pre-fetch, no
//    server round trip. The row is greyed and shows a check.
//  • Mosaic thumbnails: each row gets a small cover thumb derived
//    from the playlist's first episode's artwork via the shared
//    `getEpisodesBatch` cache (so the same images we already
//    fetched for the Library cards / detail pages are reused
//    without a re-request).
//  • Inline search: type-to-filter by playlist name.
//  • Success animation + toast: a centred violet check briefly
//    overlays the modal, then it auto-closes; a toast confirms in
//    the corner so the action is acknowledged in two places.
//  • Empty state CTA: when the user has zero playlists, the modal
//    auto-flips to Create mode and pre-fills nothing — a single
//    smooth path from "no playlists" to "this episode is in your
//    first playlist".
//  • Identity: violet/purple gradient matching the Playlist detail
//    screen and Library cards. The modal previously fought between
//    two accent colours.
//  • Backward compatibility: still accepts and fires `onAdded({
//    playlist, action })` for each affected playlist so existing
//    callers (`Library.jsx`, `Playlist.jsx`, `ExpandedPlayer.jsx`)
//    keep working.

function formatRuntime(approxMinutes) {
  if (typeof approxMinutes !== 'number' || !Number.isFinite(approxMinutes) || approxMinutes <= 0) return '';
  const total = Math.round(approxMinutes);
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function PlaylistRowThumb({ firstEpisodeId }) {
  const [art, setArt] = useState(null);

  useEffect(() => {
    let mounted = true;
    if (!firstEpisodeId) { setArt(null); return undefined; }
    (async () => {
      const fetched = await getEpisodesBatch([firstEpisodeId]);
      const ep = fetched[0];
      const next = ep?.image_url || ep?.artwork || ep?.cover_image || ep?.podcast?.cover_image || null;
      if (mounted) setArt(next);
    })();
    return () => { mounted = false; };
  }, [firstEpisodeId]);

  return (
    <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-violet-900/30 to-purple-900/20 ring-1 ring-white/[0.06] flex items-center justify-center">
      {art ? (
        <img src={art} alt="" className="w-full h-full object-cover" />
      ) : (
        <ListMusic className="w-5 h-5 text-violet-400/50" />
      )}
    </div>
  );
}
PlaylistRowThumb.propTypes = {
  firstEpisodeId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

function extractErrorMessage(e) {
  const data = e?.data || e?.response?.data;
  if (data) {
    if (typeof data.detail === 'string') return data.detail;
    if (typeof data.message === 'string') return data.message;
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
  return e?.message || 'Something went wrong. Please try again.';
}

export default function AddToPlaylistModal({ isOpen, episode, onClose, playlists = [], onAdded }) {
  const { addPlaylist, addEpisodeToPlaylist } = usePlaylistContext();

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const epId = Number(episode?.id);
  const isAlreadyIn = (pl) => Array.isArray(pl?.episodes) && pl.episodes.map(Number).includes(epId);

  // Reset state when modal opens or the target episode changes.
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set());
      // If the user has no playlists yet, jump straight to Create
      // mode — the previous modal showed a "you don't have any
      // playlists" line and made the user click an extra button.
      setCreating(playlists.length === 0);
      setNewName('');
      setSearch('');
      setError(null);
      setSuccess(false);
      setSubmitting(false);
    }
  }, [isOpen, episode?.id, playlists.length]);

  const filteredPlaylists = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return playlists;
    return playlists.filter((p) => (p.name || '').toLowerCase().includes(q));
  }, [playlists, search]);

  const togglePlaylist = (pl) => {
    if (isAlreadyIn(pl)) return; // can't re-add
    setError(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pl.id)) next.delete(pl.id);
      else next.add(pl.id);
      return next;
    });
  };

  const canSubmit = (() => {
    if (submitting) return false;
    if (creating) return newName.trim().length > 0;
    return selectedIds.size > 0;
  })();

  const submitLabel = (() => {
    if (submitting) return 'Saving…';
    if (creating) return 'Create and add';
    if (selectedIds.size === 0) return 'Add to playlist';
    if (selectedIds.size === 1) return 'Add to playlist';
    return `Add to ${selectedIds.size} playlists`;
  })();

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!episode?.id) return;

    try {
      setSubmitting(true);
      setError(null);

      if (creating) {
        const created = await Playlist.create({ name: newName.trim(), episodes: [episode.id] });
        addPlaylist(created);
        if (onAdded) onAdded({ playlist: created, action: 'created' });
        setSuccess(true);
        toast({
          title: 'Playlist created',
          description: episode?.title
            ? `"${episode.title}" added to "${created.name}".`
            : `Added to "${created.name}".`,
        });
        setTimeout(() => { onClose && onClose(); }, 650);
      } else {
        const ids = Array.from(selectedIds);
        // Run in parallel so adding to 5 playlists isn't 5× the wait
        // of adding to 1. PlaylistContext's optimistic helper makes
        // each one snap to its updated state instantly anyway.
        const results = await Promise.allSettled(ids.map((id) => addEpisodeToPlaylist(id, episode.id)));
        const successful = results
          .map((r, i) => (r.status === 'fulfilled' && r.value ? { value: r.value, sourceId: ids[i] } : null))
          .filter(Boolean)
          .map((entry) => entry.value);
        const failed = results.length - successful.length;

        successful.forEach((pl) => {
          if (onAdded) onAdded({ playlist: pl, action: 'updated' });
        });

        if (successful.length > 0) {
          setSuccess(true);
          const names = successful.slice(0, 2).map((p) => `"${p.name}"`).join(', ');
          const more = successful.length > 2 ? ` and ${successful.length - 2} more` : '';
          toast({
            title: successful.length === 1 ? 'Added to playlist' : `Added to ${successful.length} playlists`,
            description: `${episode?.title ? `"${episode.title}" ` : ''}is now in ${names}${more}.`,
          });
          setTimeout(() => { onClose && onClose(); }, 650);
        }

        if (failed > 0) {
          setError(`Could not add to ${failed} playlist${failed === 1 ? '' : 's'}. Please try again.`);
        }
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !submitting) onClose && onClose(); }}>
      {/* `hideClose` suppresses Radix's built-in close button — we
          render our own in the header (top-right, next to the
          title) so we don't end up with two stacked X icons.
          The `ec-pop-modal` class swaps Radix's default fade-zoom
          for a spring-y back-out entrance + a snappy collapse
          exit (see `index.css`). */}
      <DialogContent
        hideClose
        className="ec-pop-modal w-[94vw] max-w-[560px] bg-gradient-to-br from-[#0c0d12] via-[#11121a] to-[#1a1726] text-white border border-violet-500/30 shadow-2xl shadow-violet-900/40 p-0 overflow-hidden z-[10200]"
      >
        <div className="relative">
          {/* Atmospheric glow — same identity color as the Playlist
              detail screen and Library cards. */}
          <div className="absolute -top-32 -right-24 w-72 h-72 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-20 w-64 h-64 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

          {/* ── Header ─────────────────────────────────────────── */}
          <div className="relative px-6 pt-6 pb-4 md:px-8 md:pt-7">
            <div className="flex items-start justify-between gap-3 mb-1">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-violet-500/15 ring-1 ring-violet-400/30 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-violet-300" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-wide">Add to Playlist</h2>
                  <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[20rem]">
                    {episode?.title ? `"${episode.title}"` : 'Pick playlists for this episode.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                disabled={submitting}
                // `focus:outline-none` kills the chunky default
                // browser ring that lingered after a mouse click and
                // looked like a stray circle around the X.
                // `focus-visible` (keyboard only) keeps a clean,
                // on-brand violet ring for accessibility.
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 focus-visible:ring-offset-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Content ────────────────────────────────────────── */}
          <form onSubmit={handleSubmit}>
            <div className="relative px-6 md:px-8">
              {/* Mode toggle / search row */}
              {!creating ? (
                <div className="flex items-center gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search playlists"
                      className="bg-white/[0.03] border-white/[0.06] focus-visible:ring-violet-500 pl-8 h-9 text-sm"
                      disabled={submitting || playlists.length === 0}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => { setCreating(true); setError(null); }}
                    disabled={submitting}
                    className="flex-shrink-0 h-9 px-3.5 rounded-md text-xs font-semibold bg-violet-500/[0.08] text-violet-200 border border-violet-400/[0.18] hover:bg-violet-500/[0.14] hover:text-white transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New
                  </button>
                </div>
              ) : null}

              {/* Existing playlists list */}
              {!creating && (
                <div className="rounded-xl border border-white/[0.05] bg-black/20 overflow-hidden">
                  <div className="max-h-[280px] overflow-y-auto divide-y divide-white/[0.04]">
                    {filteredPlaylists.length === 0 ? (
                      <div className="py-10 px-6 text-center">
                        <div className="w-12 h-12 mx-auto rounded-full bg-violet-500/10 flex items-center justify-center mb-3 ring-1 ring-violet-400/15">
                          <Headphones className="w-5 h-5 text-violet-300/70" />
                        </div>
                        <p className="text-sm text-zinc-400 mb-3">
                          {search.trim()
                            ? `No playlists match "${search.trim()}".`
                            : "You don't have any playlists yet."}
                        </p>
                        <button
                          type="button"
                          onClick={() => { setCreating(true); setSearch(''); setError(null); }}
                          className="text-xs font-semibold text-violet-300 hover:text-violet-200 inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Create one now
                        </button>
                      </div>
                    ) : (
                      filteredPlaylists.map((pl) => {
                        const already = isAlreadyIn(pl);
                        const checked = selectedIds.has(pl.id);
                        const count = Array.isArray(pl.episodes) ? pl.episodes.length : 0;
                        const runtime = formatRuntime(pl.approximate_length_minutes);
                        const firstEpId = Array.isArray(pl.episodes) && pl.episodes.length ? pl.episodes[0] : null;
                        return (
                          <button
                            type="button"
                            key={pl.id}
                            onClick={() => togglePlaylist(pl)}
                            disabled={already || submitting}
                            aria-pressed={checked}
                            className={`group w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 ${
                              already
                                ? 'opacity-55 cursor-not-allowed bg-white/[0.01]'
                                : checked
                                  ? 'bg-violet-500/[0.10]'
                                  : 'hover:bg-white/[0.03]'
                            }`}
                          >
                            <PlaylistRowThumb firstEpisodeId={firstEpId} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-white font-medium truncate">{pl.name}</span>
                                {already && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-violet-300 bg-violet-500/15 px-1.5 py-0.5 rounded">
                                    <Check className="w-2.5 h-2.5" />
                                    Added
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-zinc-500 truncate">
                                {count} {count === 1 ? 'episode' : 'episodes'}
                                {runtime ? ` · ${runtime}` : ''}
                              </div>
                            </div>
                            {/* Custom checkbox dot — sits where a system
                                checkbox would but matches the violet identity. */}
                            <span
                              className={`w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center transition-all duration-150 ${
                                already
                                  ? 'bg-violet-500/20 border-violet-400/40 text-violet-200'
                                  : checked
                                    ? 'bg-violet-500 border-violet-400 text-white shadow-[0_0_0_3px_rgba(139,92,246,0.15)]'
                                    : 'border-white/[0.12] group-hover:border-white/30'
                              }`}
                              aria-hidden="true"
                            >
                              {(checked || already) && <Check className="w-3 h-3" />}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Create-new inline form */}
              {creating && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-violet-400/[0.18] bg-violet-500/[0.04] p-4"
                >
                  <label className="text-[10px] uppercase tracking-widest font-semibold text-violet-300/80 mb-1.5 block">
                    New playlist name
                  </label>
                  <Input
                    autoFocus
                    placeholder="e.g. Late Night Listens"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="bg-black/30 border-white/[0.08] focus-visible:ring-violet-500 h-10 text-sm"
                    disabled={submitting}
                  />
                  <p className="text-xs text-zinc-500 mt-2">
                    {episode?.title
                      ? <>We'll create the playlist with <span className="text-zinc-300">"{episode.title}"</span> as its first episode.</>
                      : "We'll create the playlist with this episode as the first one."}
                  </p>
                  {playlists.length > 0 && (
                    <button
                      type="button"
                      onClick={() => { setCreating(false); setError(null); }}
                      disabled={submitting}
                      className="text-[11px] text-violet-300 hover:text-violet-200 mt-3 inline-flex items-center gap-1"
                    >
                      ← Back to existing playlists
                    </button>
                  )}
                </motion.div>
              )}

              {/* Error region */}
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 text-red-300 text-sm bg-red-950/30 border border-red-800/40 rounded-md px-3 py-2"
                >
                  {error}
                </motion.p>
              )}
            </div>

            {/* ── Footer ───────────────────────────────────────── */}
            <div className="relative flex items-center justify-between gap-3 px-6 md:px-8 py-4 mt-4 border-t border-white/[0.04] bg-black/20">
              <div className="text-[11px] text-zinc-500">
                {creating
                  ? 'A new playlist is one tap away.'
                  : selectedIds.size === 0
                    ? 'Pick one or more playlists.'
                    : `${selectedIds.size} selected`}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  className="text-zinc-300 hover:text-white"
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-900/30 px-5 disabled:opacity-50"
                  disabled={!canSubmit}
                >
                  {submitLabel}
                </Button>
              </div>
            </div>
          </form>

          {/* ── Success overlay ──────────────────────────────────
              Brief check animation that gives the action a real
              "completed" beat before the modal dismisses. Pairs
              with the toast for two-place confirmation. */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center pointer-events-none"
              >
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 20 }}
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-violet-500/40 ring-2 ring-violet-300/40"
                >
                  <Check className="w-9 h-9 text-white" strokeWidth={3} />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
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
