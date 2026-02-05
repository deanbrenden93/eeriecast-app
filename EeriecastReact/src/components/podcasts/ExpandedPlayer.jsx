import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { Heart, X, Plus } from "lucide-react";
import { useUser } from "@/context/UserContext.jsx";
import { useAuthModal } from "@/context/AuthModalContext.jsx";
import { Podcast, Episode, UserLibrary, Playlist } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

// Custom SVG icons matching the MobilePlayer exactly
const PlayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z"/>
  </svg>
);
const PauseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
  </svg>
);
const NextIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M5 18l10-6L5 6v12zm11-12v12h2V6h-2z"/></svg>
);
const PrevIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z"/>
  </svg>
);
// Stroke icons from original code
const ShuffleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>
);
const RepeatIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
);
const InfoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
);
const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);
const ListMusicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15V6"/><path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/><path d="M12 12H3"/><path d="M16 6H3"/><path d="M12 18H3"/></svg>
);
const Backward10Icon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <text x="50%" y="50%" textAnchor="middle" dy=".35em" fontSize="12" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif">-10</text>
  </svg>
);
const Forward10Icon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <text x="50%" y="50%" textAnchor="middle" dy=".35em" fontSize="12" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif">+10</text>
  </svg>
);

function formatTime(s) {
  if (!s && s !== 0) return "0:00";
  const sec = Math.floor(s);
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

// Inline modal that overlays within the ExpandedPlayer container (no portals)
function InlineAddToPlaylistModal({ open, episode, onClose, playlists = [], onAdded, resolving = false }) {
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setSelectedId(null);
      setCreating(false);
      setNewName("");
      setError(null);
      setSubmitting(false);
    }
  }, [open, episode?.id]);

  const canSubmit = (() => {
    if (submitting) return false;
    if (resolving) return false;
    if (!episode?.id) return false;
    if (creating) return !!newName.trim();
    return !!selectedId;
  })();

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
        const pl = await Playlist.get(id);
        const currentRaw = Array.isArray(pl.episodes) ? pl.episodes : [];
        const currentIds = currentRaw.map((x) => (x && typeof x === 'object' ? x.id : x)).filter(Boolean);
        if (currentIds.includes(episode.id)) {
          onAdded && onAdded({ playlist: pl, action: 'no-op' });
          onClose && onClose();
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[3500] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={() => !submitting && onClose && onClose()} />
      {/* Panel */}
      <div className="relative z-[1] w-[92vw] max-w-[560px] bg-gradient-to-br from-black via-[#121316] to-[#1f2128] text-white border border-red-600/40 shadow-2xl shadow-red-900/40 rounded-lg overflow-hidden">
        <div className="relative p-6 md:p-8">
          <button
            type="button"
            onClick={() => !submitting && onClose && onClose()}
            className="absolute right-4 top-4 text-white/70 hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />

          <div className="mb-6">
            <h2 className="text-xl font-semibold tracking-wide">Add to Playlist</h2>
            <p className="text-sm text-gray-400 mt-1">{episode?.title ? `Choose a playlist for “${episode.title}”.` : 'Choose a playlist.'}</p>
          </div>

          {resolving && (
            <div className="mb-3 text-sm text-gray-300">Preparing episode…</div>
          )}

          {/* Mode toggle */}
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => setCreating(false)}
              disabled={submitting || resolving}
              className={`px-3 py-1.5 rounded-full text-xs border ${!creating ? 'bg-red-600 border-red-600 text-white' : 'border-gray-700 text-gray-300 hover:text-white'} ${submitting || resolving ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              Select Existing
            </button>
            <button
              type="button"
              onClick={() => setCreating(true)}
              disabled={submitting || resolving}
              className={`px-3 py-1.5 rounded-full text-xs border ${creating ? 'bg-red-600 border-red-600 text-white' : 'border-gray-700 text-gray-300 hover:text-white'} ${submitting || resolving ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              Create New
            </button>
          </div>

          {!episode?.id && !resolving && (
            <p className="text-xs text-yellow-400 mb-2">Episode data is still loading; playlist selection is disabled until it’s ready.</p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!creating ? (
              <div className={`max-h-56 overflow-y-auto rounded-md border border-gray-800 divide-y divide-gray-800 ${resolving ? 'opacity-60 pointer-events-none' : ''}`}>
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
                        onChange={() => setSelectedId(pl.id)}
                        className="accent-red-600"
                        disabled={submitting || resolving || !episode?.id}
                      />
                      <div className="flex-1">
                        <div className="text-sm text-white font-medium">{pl.name}</div>
                        <div className="text-xs text-gray-400">{Array.isArray(pl.episodes) ? pl.episodes.length : 0} items{typeof pl.approximate_length_minutes === 'number' ? ` \u2022 ~${pl.approximate_length_minutes}m` : ''}</div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            ) : (
              <div className={`space-y-3 ${resolving ? 'opacity-60 pointer-events-none' : ''}`}>
                <div>
                  <label className="text-xs uppercase tracking-wider font-medium text-gray-400 mb-1 block">Playlist Name</label>
                  <Input
                    autoFocus
                    placeholder="My Queue"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="bg-[#1b1d23] border-gray-700 focus-visible:ring-red-600"
                    disabled={submitting || resolving}
                  />
                </div>
                <p className="text-xs text-gray-400">We’ll create the playlist and add this episode to it.</p>
              </div>
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
      </div>
    </div>
  );
}

InlineAddToPlaylistModal.propTypes = {
  open: PropTypes.bool.isRequired,
  episode: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  playlists: PropTypes.array,
  onAdded: PropTypes.func,
  resolving: PropTypes.bool,
};

export default function ExpandedPlayer({ 
  podcast, 
  episode, 
  isPlaying, 
  currentTime = 0, 
  duration = 0, 
  onToggle, 
  onCollapse, 
  onSeek, 
  onSkip, 
  isShuffling, 
  repeatMode, 
  onShuffleToggle, 
  onRepeatToggle,
  queue = [],
  queueIndex = -1,
  playQueueIndex,
  loadAndPlay
}) {
  const [isLiked, setIsLiked] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentFocused, setCommentFocused] = useState(false);
  const [submitHover, setSubmitHover] = useState(false);
  const [submitActive, setSubmitActive] = useState(false);
  const [comments, setComments] = useState([]);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const { isAuthenticated, user, refreshFavorites, favoriteEpisodeIds, isPremium } = useUser();
  const { openAuth } = useAuthModal();
  const [favLoading, setFavLoading] = useState(false);

  // New: Queue sheet state
  const [showQueue, setShowQueue] = useState(false);

  // Derive a lightweight Up Next list: prefer global queue if provided
  const {
    currentItem,
    upNext,
  } = useMemo(() => {
    if (Array.isArray(queue) && queue.length > 0 && queueIndex >= 0 && queueIndex < queue.length) {
      const current = queue[queueIndex];
      return {
        currentItem: current,
        upNext: queue.slice(queueIndex + 1),
      };
    }
    // Fallback: use episodes from current podcast
    const allEps = Array.isArray(podcast?.episodes) ? podcast.episodes : [];
    const currentId = episode?.id ?? episode?.slug;
    const idx = allEps.findIndex((e) => (e?.id ?? e?.slug) === currentId);
    
    // Limit fallback to 5 items to avoid "ton of items"
    const nextList = idx >= 0 ? allEps.slice(idx + 1, idx + 6).map((ep) => ({ podcast, episode: ep })) : [];
    return { currentItem: { podcast, episode }, upNext: nextList };
  }, [queue, queueIndex, podcast, episode]);

  const handlePlayFromQueue = async (item, indexInQueue) => {
    if (!item) return;
    if (typeof playQueueIndex === 'function' && typeof indexInQueue === 'number') {
      await playQueueIndex(indexInQueue);
      setShowQueue(false);
      return;
    }
    // Fallback: directly load and play the episode if queue controls not available
    if (typeof loadAndPlay === 'function') {
      await loadAndPlay({ podcast: item.podcast, episode: item.episode, resume: item.resume || { progress: 0 } });
      setShowQueue(false);
    }
  };

  const handleDownload = () => {
    if (!isPremium) {
      // setShowSubscribeModal(true); // Need to pass this or use local state
      alert("Downloads are a premium feature. Please subscribe to unlock.");
      return;
    }
    // Placeholder for actual download logic
    const audioUrl = episode?.audio_url || episode?.ad_free_audio_url;
    if (audioUrl) {
      const link = document.createElement('a');
      link.href = audioUrl;
      link.download = `${episode.title}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      alert("Audio URL not available for download.");
    }
  };

  useEffect(() => {
    const eid = episode?.id;
    if (!eid) { setIsLiked(false); return; }
    setIsLiked(!!favoriteEpisodeIds && favoriteEpisodeIds.has(Number(eid)));
  }, [episode?.id, favoriteEpisodeIds]);

  useEffect(() => {
    const fetchComments = async () => {
      if (!episode?.id) {
        setComments([]);
        return;
      }
      try {
        setComments([]); // Clear old comments immediately
        setIsCommentsLoading(true);
        const detail = await Episode.get(episode.id);
        setComments(detail.comments || []);
      } catch (err) {
        console.debug('Failed to fetch comments', err);
      } finally {
        setIsCommentsLoading(false);
      }
    };
    fetchComments();
  }, [episode?.id]);

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !episode?.id) return;
    if (!isAuthenticated) {
      openAuth('login');
      return;
    }

    const newCommentContent = commentText.trim();
    
    // Optimistic UI update
    const tempId = Date.now();
    const optimisticComment = {
      id: tempId,
      user: {
        id: user?.id || user?.user?.id || user?.pk,
        username: user?.username || user?.user?.username || 'You',
        avatar: user?.avatar || user?.user?.avatar
      },
      content: newCommentContent,
      created_at: new Date().toISOString(),
      isOptimistic: true
    };

    setComments(prev => [optimisticComment, ...prev]);
    setCommentText("");

    try {
      setIsPostingComment(true);
      const savedComment = await Episode.postComment(episode.id, newCommentContent);
      // Replace optimistic comment with actual one from server
      setComments(prev => prev.map(c => c.id === tempId ? savedComment : c));
    } catch (err) {
      console.debug('Failed to post comment', err);
      // Remove optimistic comment on failure
      setComments(prev => prev.filter(c => c.id !== tempId));
      // Restore comment text so user can try again
      setCommentText(newCommentContent);
      alert("Failed to post comment. Please try again.");
    } finally {
      setIsPostingComment(false);
    }
  };

  // Local fallbacks if parent doesn't control shuffle/repeat
  const [localShuffle, setLocalShuffle] = useState(false);
  const [localRepeatMode, setLocalRepeatMode] = useState('off');

  const shuffleActive = onShuffleToggle ? !!isShuffling : localShuffle;
  const effectiveRepeat = onRepeatToggle ? (repeatMode || 'off') : localRepeatMode;

  const handleShuffle = () => {
    if (onShuffleToggle) return onShuffleToggle();
    setLocalShuffle((s) => !s);
  };

  const handleRepeat = () => {
    if (onRepeatToggle) return onRepeatToggle();
    setLocalRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'));
  };

  useEffect(() => {
    // Prevent background page from scrolling when expanded player is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const cover = episode?.cover_image || podcast?.cover_image;
  const pct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const onBarClick = (e) => {
    if (!onSeek || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(ratio * duration);
  };

  // Add favorite for the current episode (not the whole podcast)
  const handleFavoriteClick = async () => {
    const eid = episode?.id;
    if (!eid || favLoading) return;
    const userId = user?.id || user?.user?.id || user?.pk;
    if (!userId || !isAuthenticated) {
      openAuth('login');
      return;
    }
    try {
      setFavLoading(true);
      // Optimistic like state
      setIsLiked(true);
      await UserLibrary.addFavorite('episode', eid);
      await refreshFavorites();
    } catch (err) {
      if (typeof console !== 'undefined') console.debug('episode favorite failed', err);
    } finally {
      setFavLoading(false);
    }
  };

  // New state for managing Add to Playlist modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [episodeToAdd, setEpisodeToAdd] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [openingAdd, setOpeningAdd] = useState(false);
  const [resolvingAdd, setResolvingAdd] = useState(false);
  // New: About modal state
  const [showAbout, setShowAbout] = useState(false);

  // Fetch user's playlists on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await Playlist.list();
        if (!mounted) return;
        const list = Array.isArray(resp) ? resp : (resp?.results || []);
        setPlaylists(list);
      } catch {
        if (mounted) setPlaylists([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Resolve an episode just like EpisodeCard/Show flows before opening modal
  const handleOpenAddToPlaylist = async () => {
    if (!isAuthenticated) { openAuth('login'); return; }
    if (openingAdd) return;
    setOpeningAdd(true);
    setShowAddModal(true);
    setResolvingAdd(true);
    setEpisodeToAdd(null);
    try {
      let ep = episode;
      let pd = podcast;

      // If episode missing, try to resolve from podcast detail and resume
      if (!ep?.id && pd?.id) {
        // ensure episodes
        try {
          const detail = await Podcast.get(pd.id);
          if (detail) pd = { ...pd, ...detail };
        } catch {/* ignore */}
        let eps = Array.isArray(pd?.episodes) ? pd.episodes : (pd?.episodes?.results || []);
        if (!eps.length) {
          try {
            const detail2 = await Podcast.get(pd.id);
            eps = Array.isArray(detail2?.episodes) ? detail2.episodes : (detail2?.episodes?.results || []);
            if (detail2) pd = { ...pd, ...detail2 };
          } catch {/* ignore */}
        }
        // prefer resume
        try {
          const resume = await UserLibrary.resumeForPodcast(pd.id);
          if (resume?.episode_detail) {
            const found = eps.find((e) => e.id === resume.episode_detail.id);
            ep = found || resume.episode_detail;
          }
        } catch {/* ignore */}
        if (!ep && eps.length) ep = eps[0];
      }

      // Verify episode exists; fallback to latest by podcast
      if (ep?.id) {
        try {
          const fetched = await Episode.get(ep.id);
          if (fetched?.id) ep = fetched;
        } catch {
          if (pd?.id) {
            try {
              const res = await Episode.filter({ podcast: pd.id }, '-created_date', 1);
              const arr = Array.isArray(res) ? res : (res?.results || []);
              if (arr[0]?.id) ep = arr[0];
            } catch {/* ignore */}
          }
        }
      } else if (pd?.id) {
        try {
          const res = await Episode.filter({ podcast: pd.id }, '-created_date', 1);
          const arr = Array.isArray(res) ? res : (res?.results || []);
          if (arr[0]?.id) ep = arr[0];
        } catch {/* ignore */}
      }

      if (!ep?.id) { setResolvingAdd(false); setOpeningAdd(false); return; }
      setEpisodeToAdd(ep);
    } finally {
      setResolvingAdd(false);
      setOpeningAdd(false);
    }
  };

  // Simple formatter / sanitizer for podcast description
  const getFormattedDescription = () => {
    let raw = podcast?.description || podcast?.summary || '';
    if (!raw || typeof raw !== 'string') return '<p>No description available.</p>';
    // Remove <script> blocks
    raw = raw.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
    // Strip on* event handler attributes (very naive)
    raw = raw.replace(/on\w+\s*=\s*"[^"]*"/gi, '').replace(/on\w+\s*=\s*'[^']*'/gi, '');
    // If it looks like plain text (no tags), convert double newlines to paragraphs
    if (!/[<][a-zA-Z!/]/.test(raw)) {
      const parts = raw.trim().split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
      raw = parts.map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');
    }
    return raw;
  };

  return (
    <div className="fixed inset-0 bg-[#141414] z-[3000] flex flex-col overflow-y-auto overscroll-contain touch-pan-y">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5">
        <button 
          onClick={onCollapse} 
          className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-white/70 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <span className="text-white font-medium text-xs tracking-[0.2em]">NOW PLAYING</span>
        <div className="relative">
          <button 
            onClick={() => setShowQueue(true)} 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-white/70 hover:text-white transition-colors"
            aria-label="View Queue"
          >
            <ListMusicIcon />
            {upNext.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#ff0040] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-lg">
                {upNext.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 pb-8">
        {/* Album Art */}
        <div className="relative w-[340px] h-[340px] mx-auto mb-6 rounded-lg overflow-hidden shadow-2xl">
          {cover ? (
            <img
              src={cover}
              alt={episode?.title || 'Episode cover'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
              <span className="text-8xl">🎧</span>
            </div>
          )}
          {/* Floating action buttons */}
          <button
            onClick={handleFavoriteClick}
            className="absolute top-4 right-4 p-3 bg-black/60 backdrop-blur-sm rounded-full hover:bg-black/80 transition-colors disabled:opacity-60"
            title={isLiked ? 'Favorited' : 'Add to favorites'}
            aria-pressed={isLiked}
            disabled={favLoading}
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'text-red-500 fill-red-500' : 'text-white'}`} />
          </button>
          <button
            className="absolute top-[60px] right-4 p-3 bg-black/60 backdrop-blur-sm rounded-full hover:bg-black/80 transition-colors"
            onClick={handleOpenAddToPlaylist}
            title="Add to playlist"
          >
            <Plus className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Track Info */}
        <div className="mb-6 text-center max-w-md">
          <h2 className="text-gray-400 text-sm mb-2">{podcast?.title || ''}</h2>
          <h1 className="text-white text-2xl font-bold mb-4 line-clamp-2">{episode?.title || ''}</h1>
        </div>

        {/* Action buttons + Controls (exact original look) */}
        <div className="player-controls-section">
          <div className="player-action-buttons">
            <button className="rating-badge rating-pg-13">
              <span className="icon" style={{ fontSize: 16 }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
              </span>
              <span className="rating-text">PG-13</span>
            </button>

            <button className="episode-description-toggle-btn" onClick={() => setShowAbout(true)} aria-haspopup="dialog" aria-expanded={showAbout}>
              <span className="icon" style={{ fontSize: 16 }}><InfoIcon /></span>
              <span>About</span>
            </button>

            <button className="episode-download-btn" onClick={handleDownload}>
              <span className="icon" style={{ fontSize: 16 }}><DownloadIcon /></span>
              <span>Download</span>
            </button>

            <button className="sleep-timer-indicator" style={{ display: 'none' }}>
              <span className="icon" style={{ fontSize: 16 }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </span>
              <span className="sleep-timer-remaining">15:00</span>
            </button>
          </div>

          <div className="player-controls-large">
            <button
              className={`player-control-large shuffle-btn ${shuffleActive ? 'active' : ''}`}
              title="Shuffle"
              aria-pressed={!!shuffleActive}
              onClick={handleShuffle}
            >
              <span className="icon"><ShuffleIcon /></span>
            </button>
            <button className="player-control-large seek-btn backward-btn" title="Back 10" onClick={() => onSkip && onSkip(-10)}>
              <span className="icon"><Backward10Icon /></span>
            </button>
            <button className="player-control-large prev-btn" title="Previous" onClick={() => onSkip && onSkip(-30)}>
              <span className="icon"><PrevIcon /></span>
            </button>
            <button
              className="player-control-large play-pause"
              title={isPlaying ? 'Pause' : 'Play'}
              aria-pressed={!!isPlaying}
              onClick={onToggle}
            >
              <span className="icon">{isPlaying ? <PauseIcon /> : <PlayIcon />}</span>
            </button>
            <button className="player-control-large next-btn" title="Next" onClick={() => onSkip && onSkip(30)}>
              <span className="icon"><NextIcon /></span>
            </button>
            <button className="player-control-large seek-btn forward-btn" title="Forward 10" onClick={() => onSkip && onSkip(10)}>
              <span className="icon"><Forward10Icon /></span>
            </button>
            <button
              className={`player-control-large repeat-btn ${effectiveRepeat !== 'off' ? 'active' : ''} ${effectiveRepeat === 'one' ? 'repeat-one' : ''}`}
              title="Repeat"
              aria-pressed={effectiveRepeat !== 'off'}
              onClick={handleRepeat}
            >
              <span className="icon"><RepeatIcon /></span>
            </button>
          </div>
        </div>

        {/* Waveform + Progress (CSS-driven, matches provided original) */}
        <div className="w-full max-w-2xl">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          <div className="player-waveform-section">
            <div className="waveform-container" onClick={onBarClick}>
              <div className={`waveform-wave ${isPlaying ? 'playing' : ''}`} />
              <div className="waveform-played" style={{ ['--progress'] : `${pct}%` }} />
              <div className="progress-indicator" style={{ left: `${pct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Comments Section (inline styles matching original) */}
      <div
        style={{
          width: '100%',
          maxWidth: 800,
          margin: '40px auto 0',
          padding: '30px 20px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: 20,
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 22, margin: 0 }}>Comments</h3>
          <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{comments.length} comment{comments.length === 1 ? '' : 's'}</span>
        </div>

        <form
          style={{ marginBottom: 28 }}
          onSubmit={handlePostComment}
        >
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onFocus={() => setCommentFocused(true)}
            onBlur={() => setCommentFocused(false)}
            placeholder="Share your thoughts about this episode..."
            style={{
              width: '100%',
              padding: '16px 18px',
              background: commentFocused ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.05)',
              border: `2px solid ${commentFocused ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.08)'}`,
              borderRadius: 14,
              color: '#ffffff',
              fontSize: 15,
              fontFamily: 'inherit',
              resize: 'vertical',
              minHeight: 100,
              transition: 'all 0.2s ease',
              outline: 'none',
              boxShadow: commentFocused ? '0 0 0 4px rgba(255, 0, 64, 0.1)' : 'none'
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={!commentText.trim() || isPostingComment}
              onMouseEnter={() => setSubmitHover(true)}
              onMouseLeave={() => { setSubmitHover(false); setSubmitActive(false); }}
              onMouseDown={() => setSubmitActive(true)}
              onMouseUp={() => setSubmitActive(false)}
              style={{
                marginTop: 12,
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #ff0040, #9d00ff)',
                border: 'none',
                borderRadius: 24,
                color: '#ffffff',
                fontSize: 15,
                fontWeight: 600,
                cursor: (commentText.trim() && !isPostingComment) ? 'pointer' : 'not-allowed',
                opacity: (commentText.trim() && !isPostingComment) ? 1 : 0.5,
                transition: 'all 0.2s ease',
                boxShadow: submitHover ? '0 6px 20px rgba(255, 0, 64, 0.4)' : '0 4px 15px rgba(255, 0, 64, 0.3)',
                transform: submitActive ? 'translateY(0)' : (submitHover ? 'translateY(-2px)' : 'translateY(0)')
              }}
            >
              {isPostingComment ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </form>

        {/* Comments list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {isCommentsLoading && comments.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '20px 0' }}>Loading comments...</div>
          ) : comments.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '20px 0' }}>No comments yet. Be the first to share your thoughts!</div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} style={{ display: 'flex', gap: 16, opacity: comment.isOptimistic ? 0.7 : 1 }}>
                <div style={{ flexShrink: 0 }}>
                  {comment.user?.avatar ? (
                    <img 
                      src={comment.user.avatar} 
                      alt={comment.user.username} 
                      style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)' }}
                    />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #333, #111)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, border: '2px solid rgba(255,255,255,0.1)' }}>
                      👤
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>{comment.user?.username || 'Anonymous'}</span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{formatDate(comment.created_at)}</span>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 1.6, margin: 0, wordWrap: 'break-word' }}>
                    {comment.content}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* About Modal Overlay */}
      {showAbout && (
        <div className="fixed inset-0 z-[3400] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowAbout(false)} />
          <div className="relative w-[92vw] max-w-[720px] max-h-[80vh] bg-gradient-to-br from-black via-[#121316] to-[#1f2128] text-white border border-red-600/40 rounded-xl shadow-2xl shadow-red-900/40 overflow-hidden flex flex-col">
            <button
              type="button"
              onClick={() => setShowAbout(false)}
              className="absolute right-4 top-4 text-white/70 hover:text-white"
              aria-label="Close About"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="p-6 md:p-8 pb-4 overflow-y-auto custom-scrollbar">
              <h2 className="text-2xl font-bold tracking-wide mb-4">About this Podcast</h2>
              <div className="prose prose-invert max-w-none text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: getFormattedDescription() }} />
            </div>
          </div>
        </div>
      )}

      {/* Add to Playlist Modal (inline) */}
      <InlineAddToPlaylistModal
        open={showAddModal}
        episode={episodeToAdd}
        playlists={playlists}
        resolving={resolvingAdd}
        onClose={() => { setShowAddModal(false); setEpisodeToAdd(null); }}
        onAdded={({ playlist: pl, action }) => {
          if (action === 'created') setPlaylists((prev) => [pl, ...prev]);
          if (action === 'updated') setPlaylists((prev) => prev.map((p) => p.id === pl.id ? pl : p));
        }}
      />

      {/* Queue Overlay (Drawer) */}
      {showQueue && (
        <div className="fixed inset-0 z-[4000] flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" 
            onClick={() => setShowQueue(false)} 
          />
          
          {/* Drawer Content */}
          <div className="relative bg-[#141414] border-l border-white/10 w-full max-w-[400px] h-full overflow-hidden flex flex-col rounded-l-[32px] animate-in slide-in-from-right duration-300">
            <div className="w-full flex justify-between items-center p-6 pb-0">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">Playing from</span>
                <h2 className="text-white text-lg font-bold truncate max-w-[240px]">{podcast?.title || 'Podcast'}</h2>
              </div>
              <button 
                onClick={() => setShowQueue(false)}
                className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="px-6 py-8 pb-12">
                <div className="space-y-8">
                  {/* Now Playing Section */}
                  <div>
                    <h3 className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase mb-4">Now Playing</h3>
                    {currentItem?.episode && (
                      <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/5">
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 shadow-lg">
                          <img 
                            src={currentItem.episode?.cover_image || currentItem.podcast?.cover_image || cover} 
                            alt={currentItem.episode?.title || episode.title} 
                            className="w-full h-full object-cover" 
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-base font-bold truncate mb-1">{currentItem.episode?.title || episode.title}</div>
                          <div className="text-white/60 text-sm truncate">{currentItem.podcast?.title || podcast.title}</div>
                        </div>
                        <div className="pr-2">
                          <div className="w-5 h-5 flex items-center justify-center">
                            <div className="flex gap-1 items-end h-3">
                              <div className="w-0.5 bg-[#ff0040] animate-[music-bar_0.8s_ease-in-out_infinite] h-full" />
                              <div className="w-0.5 bg-[#ff0040] animate-[music-bar_1.1s_ease-in-out_infinite] h-[70%]" />
                              <div className="w-0.5 bg-[#ff0040] animate-[music-bar_0.9s_ease-in-out_infinite] h-[85%]" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Up Next Section */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">Up Next</h3>
                    </div>
                    
                    <div className="space-y-2">
                      {(!upNext || upNext.length === 0) ? (
                        <div className="text-white/40 text-sm py-8 text-center bg-white/[0.02] rounded-2xl border border-dashed border-white/5">
                          No upcoming episodes
                        </div>
                      ) : (
                        upNext.map((item, idx) => {
                          const absoluteIndex = (Array.isArray(queue) && queue.length > 0 && queueIndex >= 0) ? (queueIndex + 1 + idx) : undefined;
                          const ep = item.episode || item;
                          const pd = item.podcast || podcast;
                          const key = (ep?.id ?? ep?.slug ?? idx);
                          return (
                            <button 
                              key={key} 
                              onClick={() => handlePlayFromQueue(item, absoluteIndex)} 
                              className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 transition-all group text-left"
                            >
                              <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 group-hover:shadow-lg transition-shadow">
                                {ep?.cover_image || pd?.cover_image ? (
                                  <img src={ep?.cover_image || pd?.cover_image} alt={ep?.title || 'Episode'} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-white/20 text-[10px] font-bold">EP</div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-white text-sm font-semibold truncate mb-0.5 group-hover:text-[#ff0040] transition-colors">{ep?.title || 'Episode'}</div>
                                <div className="text-white/40 text-xs truncate uppercase tracking-wider">{pd?.title || ''}</div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ExpandedPlayer.propTypes = {
  podcast: PropTypes.object,
  episode: PropTypes.object,
  isPlaying: PropTypes.bool,
  currentTime: PropTypes.number,
  duration: PropTypes.number,
  onToggle: PropTypes.func,
  onCollapse: PropTypes.func,
  onSeek: PropTypes.func,
  onSkip: PropTypes.func,
  isShuffling: PropTypes.bool,
  repeatMode: PropTypes.oneOf(['off', 'all', 'one']),
  onShuffleToggle: PropTypes.func,
  onRepeatToggle: PropTypes.func,
  queue: PropTypes.array,
  queueIndex: PropTypes.number,
  playQueueIndex: PropTypes.func,
  loadAndPlay: PropTypes.func,
};
