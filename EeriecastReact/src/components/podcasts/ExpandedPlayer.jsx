import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { Heart, X, Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useUser } from "@/context/UserContext.jsx";
import { usePlaylistContext } from "@/context/PlaylistContext.jsx";
import { useAuthModal } from "@/context/AuthModalContext.jsx";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext.jsx";
import { Podcast, Episode, UserLibrary, Playlist } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { FREE_FAVORITE_LIMIT } from "@/lib/freeTier";
import { toast } from "@/components/ui/use-toast";

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

function formatTimerDisplay(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '0:00';
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

// Inline modal that overlays within the ExpandedPlayer container (no portals)
function InlineAddToPlaylistModal({ open, episode, onClose, playlists = [], onAdded, resolving = false }) {
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [duplicateInfo, setDuplicateInfo] = useState(null);

  useEffect(() => {
    if (open) {
      setSelectedId(null);
      setCreating(false);
      setNewName("");
      setError(null);
      setSubmitting(false);
      setDuplicateInfo(null);
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
                        onChange={() => { setSelectedId(pl.id); setDuplicateInfo(null); }}
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
  const { playlists, addPlaylist, updatePlaylist } = usePlaylistContext();
  const { openAuth } = useAuthModal();

  // Sleep timer & playback speed from context
  const { sleepTimerRemaining, setSleepTimer, cancelSleepTimer, playbackRate, setPlaybackRate } = useAudioPlayerContext();
  const sleepTimerActive = sleepTimerRemaining > 0;
  const [showOptionsModal, setShowOptionsModal] = useState(false);
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
    // Free users can have up to FREE_FAVORITE_LIMIT favorites; premium is unlimited
    if (!isPremium && favoriteEpisodeIds.size >= FREE_FAVORITE_LIMIT) {
      toast({
        title: "Favorite limit reached",
        description: `Free accounts can save up to ${FREE_FAVORITE_LIMIT} favorites. Upgrade to premium for unlimited.`,
        variant: "destructive",
      });
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
  const [openingAdd, setOpeningAdd] = useState(false);
  const [resolvingAdd, setResolvingAdd] = useState(false);
  // New: About modal state
  const [showAbout, setShowAbout] = useState(false);


  // Resolve an episode just like EpisodeCard/Show flows before opening modal
  const handleOpenAddToPlaylist = async () => {
    if (!isAuthenticated) { openAuth('login'); return; }
    // Playlists are a premium feature
    if (!isPremium) { window.location.assign('/Premium'); return; }
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
    <div className="fixed inset-0 z-[3000] flex flex-col overflow-y-auto overscroll-contain touch-pan-y" style={{ background: '#0a0a0f' }}>
      {/* Animated atmospheric background */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Slow-drifting gradient orbs */}
        <div className="absolute w-[40rem] h-[40rem] rounded-full blur-[160px] opacity-[0.07]"
          style={{
            background: 'radial-gradient(circle, #dc2626, transparent 70%)',
            top: '-10%', left: '-15%',
            animation: 'ep-drift-1 25s ease-in-out infinite alternate',
          }}
        />
        <div className="absolute w-[35rem] h-[35rem] rounded-full blur-[140px] opacity-[0.05]"
          style={{
            background: 'radial-gradient(circle, #7c3aed, transparent 70%)',
            bottom: '-10%', right: '-10%',
            animation: 'ep-drift-2 30s ease-in-out infinite alternate',
          }}
        />
        <div className="absolute w-[25rem] h-[25rem] rounded-full blur-[120px] opacity-[0.04]"
          style={{
            background: 'radial-gradient(circle, #0ea5e9, transparent 70%)',
            top: '40%', left: '50%',
            animation: 'ep-drift-3 20s ease-in-out infinite alternate',
          }}
        />
        {/* Subtle noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '128px 128px' }} />
      </div>

      {/* Keyframes for background animation */}
      <style>{`
        @keyframes ep-drift-1 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(60px, 40px) scale(1.15); }
        }
        @keyframes ep-drift-2 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(-50px, -30px) scale(1.1); }
        }
        @keyframes ep-drift-3 {
          0% { transform: translate(-50%, -50%) scale(1); }
          100% { transform: translate(calc(-50% + 40px), calc(-50% - 30px)) scale(1.2); }
        }
      `}</style>

      {/* Header */}
      <div className="relative z-[1] flex items-center justify-between px-6 py-5">
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
      <div className="relative z-[1] flex-1 flex flex-col justify-center items-center px-6 pb-8">
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

            <button
              className={`player-options-btn ${sleepTimerActive || playbackRate !== 1 ? 'has-indicators' : ''}`}
              onClick={() => setShowOptionsModal(true)}
              aria-haspopup="dialog"
              aria-expanded={showOptionsModal}
            >
              {/* Show active indicators inline */}
              {sleepTimerActive && (
                <span className="inline-flex items-center gap-1 text-amber-400">
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" /></span>
                  <span className="text-[11px] font-mono font-semibold tabular-nums">{formatTimerDisplay(sleepTimerRemaining)}</span>
                </span>
              )}
              {playbackRate !== 1 && (
                <span className="text-[11px] font-semibold text-indigo-400 tabular-nums">{playbackRate}x</span>
              )}
              {!sleepTimerActive && playbackRate === 1 && (
                <span className="icon" style={{ fontSize: 16 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                </span>
              )}
              {!sleepTimerActive && playbackRate === 1 && <span>More</span>}
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
          position: 'relative',
          zIndex: 1,
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

      {/* Player Options Modal (Sleep Timer + Playback Speed) */}
      <AnimatePresence>
        {showOptionsModal && (
          <div className="fixed inset-0 z-[3500] flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowOptionsModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative w-[92vw] max-w-[400px] max-h-[85vh] bg-gradient-to-br from-[#0d0d12] via-[#141418] to-[#1a1a22] text-white border border-white/[0.06] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
            >
              {/* Subtle glows */}
              <div className="absolute -top-20 -right-20 w-56 h-56 bg-amber-500/8 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-56 h-56 bg-indigo-500/6 rounded-full blur-3xl pointer-events-none" />

              <div className="relative p-6 overflow-y-auto max-h-[85vh]" style={{ scrollbarWidth: 'none' }}>
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold tracking-tight">Player Options</h2>
                  <button
                    type="button"
                    onClick={() => setShowOptionsModal(false)}
                    className="p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                    aria-label="Close options"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* ── Sleep Timer Section ── */}
                <div className="mb-6">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
                      <ClockIcon />
                    </div>
                    <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wider">Sleep Timer</h3>
                  </div>

                  {sleepTimerActive && (
                    <div className="mb-3 p-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/[0.12] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
                        </span>
                        <span className="text-sm text-white/80">Timer active</span>
                      </div>
                      <span className="text-sm font-mono font-semibold text-amber-400 tabular-nums">{formatTimerDisplay(sleepTimerRemaining)}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: '15m', minutes: 15 },
                      { label: '30m', minutes: 30 },
                      { label: '45m', minutes: 45 },
                      { label: '60m', minutes: 60 },
                      { label: 'End of ep', minutes: null },
                      ...(sleepTimerActive ? [{ label: 'Off', minutes: -1 }] : []),
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => {
                          if (opt.minutes === null) {
                            const remaining = duration - currentTime;
                            if (remaining > 0) setSleepTimer(remaining / 60);
                          } else if (opt.minutes === -1) {
                            cancelSleepTimer();
                          } else {
                            setSleepTimer(opt.minutes);
                          }
                          setShowOptionsModal(false);
                        }}
                        className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 ${
                          opt.minutes === -1
                            ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                            : 'bg-white/[0.04] border-white/[0.06] text-white/90 hover:bg-white/[0.08] hover:border-white/[0.1]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/[0.06] mb-6" />

                {/* ── Playback Speed Section ── */}
                <div>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-7 h-7 rounded-full bg-indigo-500/10 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    </div>
                    <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wider">Playback Speed</h3>
                    {playbackRate !== 1 && <span className="text-xs font-semibold text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded-full">{playbackRate}x</span>}
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => { setPlaybackRate(rate); setShowOptionsModal(false); }}
                        className={`px-2 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 ${
                          playbackRate === rate
                            ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                            : 'bg-white/[0.03] border-white/[0.06] text-white/70 hover:bg-white/[0.08] hover:border-white/[0.1]'
                        }`}
                      >
                        {rate === 1 ? '1x' : `${rate}x`}
                      </button>
                    ))}
                  </div>

                  {playbackRate !== 1 && (
                    <button
                      onClick={() => { setPlaybackRate(1); setShowOptionsModal(false); }}
                      className="w-full mt-2.5 px-4 py-2 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-all text-white/60"
                    >
                      Reset to Normal
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add to Playlist Modal (inline) */}
      <InlineAddToPlaylistModal
        open={showAddModal}
        episode={episodeToAdd}
        playlists={playlists}
        resolving={resolvingAdd}
        onClose={() => { setShowAddModal(false); setEpisodeToAdd(null); }}
        onAdded={({ playlist: pl, action }) => {
          if (action === 'created') addPlaylist(pl);
          if (action === 'updated') updatePlaylist(pl);
        }}
      />

      {/* Queue Overlay (Drawer) — animated enter/exit */}
      <AnimatePresence>
        {showQueue && (
          <div className="fixed inset-0 z-[4000] flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowQueue(false)}
            />
            
            {/* Drawer Content */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="relative bg-[#141414] border-l border-white/10 w-full max-w-[400px] h-full overflow-hidden flex flex-col rounded-l-[32px]"
            >
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
