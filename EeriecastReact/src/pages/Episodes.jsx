import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { UserLibrary } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Play, Crown, BookOpen, Clock, ChevronDown, ChevronUp, Headphones, Heart, Loader2 } from 'lucide-react';
import EpisodesTable from '@/components/podcasts/EpisodesTable';
import AddToPlaylistModal from '@/components/library/AddToPlaylistModal';
import { useAudioPlayerContext } from '@/context/AudioPlayerContext';
import { useUser } from '@/context/UserContext';
import { usePlaylistContext } from '@/context/PlaylistContext.jsx';
import { getPodcastCategoriesLower, isAudiobook, getEpisodeAudioUrl } from '@/lib/utils';
import { canAccessChapter, FREE_LISTEN_CHAPTER_LIMIT, FREE_READ_CHAPTER_LIMIT, FREE_EXCLUSIVE_EPISODE_LIMIT } from '@/lib/freeTier';
import { usePodcasts } from '@/context/PodcastContext.jsx';
import { useAuthModal } from '@/context/AuthModalContext.jsx';
import { useToast } from '@/components/ui/use-toast';
import { Episode } from '@/api/entities';
import { AnimatePresence } from 'framer-motion';
import EReader from '@/components/podcasts/EReader';
import { findBookForShow } from '@/data/books';
import { getShowDescription } from '@/data/show-descriptions';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function Episodes() {
  const query = useQuery();
  const idParam = query.get('id') || query.get('podcast') || query.get('podcastId');

  const navigate = useNavigate();
  const { ensureDetail } = usePodcasts();
  const [show, setShow] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('Newest');
  const [showAddModal, setShowAddModal] = useState(false);
  const [episodeToAdd, setEpisodeToAdd] = useState(null);
  const [isFollowingLoading, setIsFollowingLoading] = useState(false);
  const [followAnim, setFollowAnim] = useState(null); // 'followed' | 'unfollowed' | null
  const [showReader, setShowReader] = useState(false);

  const goToPremium = () => navigate(createPageUrl('Premium'));

  const { loadAndPlay, setPlaybackQueue } = useAudioPlayerContext();
  const { followedPodcastIds, refreshFollowings, isAuthenticated, isPremium, episodeProgressMap } = useUser();
  const { playlists, addPlaylist, updatePlaylist } = usePlaylistContext();
  const { openAuth } = useAuthModal();
  const { toast } = useToast();

  const isFollowing = useMemo(() => {
    if (!show?.id) return false;
    return followedPodcastIds.has(Number(show.id));
  }, [show?.id, followedPodcastIds]);

  useEffect(() => {
    let canceled = false;
    async function load() {
      if (!idParam) { setIsLoading(false); return; }
      setIsLoading(true);
      try {
        const detail = await ensureDetail(idParam);
        if (canceled) return;
        setShow(detail);
        const list = Array.isArray(detail?.episodes) ? detail.episodes : (detail?.episodes?.results || []);
        setEpisodes(list);
      } finally {
        if (!canceled) setIsLoading(false);
      }
    }
    load();
    return () => { canceled = true; };
  }, [idParam, ensureDetail]);

  useEffect(() => {
    if (show && isAudiobook(show)) {
      setSortOrder('Oldest');
    }
  }, [show]);


  const handleOpenAddToPlaylist = (ep) => {
    if (!isAuthenticated) { openAuth('login'); return; }
    // Playlists are a premium feature
    if (!isPremium) { goToPremium(); return; }
    setEpisodeToAdd(ep);
    setShowAddModal(true);
  };

  const handleFollowToggle = async () => {
    if (!show?.id) return;
    if (!isAuthenticated) { openAuth('login'); return; }
    const wasFollowing = isFollowing;
    setIsFollowingLoading(true);
    try {
      if (wasFollowing) {
        await UserLibrary.unfollowPodcast(show.id);
      } else {
        await UserLibrary.followPodcast(show.id);
      }
      await refreshFollowings();
      // Trigger completion animation
      setFollowAnim(wasFollowing ? 'unfollowed' : 'followed');
      setTimeout(() => setFollowAnim(null), 900);
    } catch (e) {
      console.error('Failed to toggle follow', e);
    } finally {
      setIsFollowingLoading(false);
    }
  };

  const isBook = show ? isAudiobook(show) : false;
  const isExclusive = !!show?.is_exclusive;

  // Episode order (oldest-first) for audiobooks and exclusive shows — needed for free-tier gating
  const episodeOrder = useMemo(() => {
    if ((!isBook && !isExclusive) || !episodes.length) return [];
    return [...episodes].sort((a, b) => {
      const da = new Date(a.created_date || a.published_at || a.release_date || 0).getTime();
      const db = new Date(b.created_date || b.published_at || b.release_date || 0).getTime();
      return da - db;
    });
  }, [isBook, isExclusive, episodes]);

  const getChapterIndex = (ep) => {
    if ((!isBook && !isExclusive) || !ep) return -1;
    return episodeOrder.findIndex(e => e.id === ep.id);
  };

  // Determine the free episode limit for this show
  const freeEpisodeLimit = isBook ? FREE_LISTEN_CHAPTER_LIMIT : (isExclusive ? FREE_EXCLUSIVE_EPISODE_LIMIT : Infinity);

  // Set of episode IDs that are locked behind the free-tier limit
  // Audiobooks: first N chapters (oldest) are free
  // Exclusive shows: newest N episodes are free
  const lockedEpisodeIds = useMemo(() => {
    if (isPremium || !episodeOrder.length) return new Set();
    const locked = new Set();
    if (isExclusive) {
      // Lock everything except the newest `freeEpisodeLimit` episodes
      // episodeOrder is sorted oldest-first, so the newest are at the end
      const lockUpTo = episodeOrder.length - freeEpisodeLimit;
      for (let i = 0; i < lockUpTo; i++) {
        if (episodeOrder[i]?.id) locked.add(episodeOrder[i].id);
      }
    } else {
      // Audiobooks: first N chapters are free
      for (let i = freeEpisodeLimit; i < episodeOrder.length; i++) {
        if (episodeOrder[i]?.id) locked.add(episodeOrder[i].id);
      }
    }
    return locked;
  }, [isPremium, episodeOrder, freeEpisodeLimit, isExclusive]);

  const doPlay = async (ep) => {
    if (!ep) return;
    // Free-tier gate: check locked episode set (covers audiobooks + members-only shows)
    if (lockedEpisodeIds.has(ep.id)) {
      goToPremium();
      return;
    }
    // Individual premium episode gate
    if (ep?.is_premium && !isPremium) {
      goToPremium();
      return;
    }
    try {
      // If episode lacks an audio URL, try fetching the full episode detail first
      let playEp = ep;
      if (!getEpisodeAudioUrl(playEp) && playEp.id) {
        try {
          const fullEp = await Episode.get(playEp.id);
          if (fullEp && getEpisodeAudioUrl(fullEp)) playEp = fullEp;
        } catch { /* ignore */ }
      }

      // Build a queue from all episodes so autoplay-next can advance
      // to the following episode when this one ends.
      const currentList = episodes;
      const queueItems = currentList.map(e => ({
        podcast: show,
        episode: e.id === playEp.id ? playEp : e, // use enriched version for the target
        resume: { progress: 0 },
      }));
      const startIdx = currentList.findIndex(e => e.id === playEp.id);

      if (queueItems.length > 0 && startIdx >= 0) {
        await setPlaybackQueue(queueItems, startIdx);
      } else {
        // Fallback: play directly if we can't build a queue
        const played = await loadAndPlay({ podcast: show, episode: playEp });
        if (played === false) {
          toast({ title: "Unable to play", description: "This episode doesn't have audio available yet.", variant: "destructive" });
          return;
        }
      }

      try { await UserLibrary.addToHistory(playEp.id, 0); } catch (e) { if (typeof console !== 'undefined') console.debug('history add failed', e); }
    } catch (e) {
      console.error('Failed to play', e);
      toast({ title: "Playback error", description: "Something went wrong. Please try again.", variant: "destructive" });
    }
  };

  // ── Audiobook resume detection ────────────────────────────────────
  // Find the chapter the user should resume from (the first non-completed
  // chapter that has progress, or the first chapter after all completed ones).
  const audiobookResume = useMemo(() => {
    if (!isBook || !episodes.length) return null;
    // Sort oldest-first (chapter order) regardless of the UI sort
    const ordered = [...episodes].sort((a, b) => {
      const da = new Date(a.created_date || a.published_at || a.release_date || 0).getTime();
      const db = new Date(b.created_date || b.published_at || b.release_date || 0).getTime();
      return da - db;
    });

    let hasAnyProgress = false;
    let resumeIndex = 0;
    let resumeProgress = 0;

    for (let i = 0; i < ordered.length; i++) {
      const eid = Number(ordered[i].id);
      const saved = episodeProgressMap?.get(eid);
      if (saved && saved.progress > 0) {
        hasAnyProgress = true;
        if (saved.completed) {
          // This chapter is done — the resume candidate is the NEXT one
          resumeIndex = Math.min(i + 1, ordered.length - 1);
          resumeProgress = 0;
        } else {
          // In-progress chapter — this is the resume target
          resumeIndex = i;
          resumeProgress = saved.progress;
          break; // First non-completed chapter with progress wins
        }
      }
    }

    if (!hasAnyProgress) return null;
    return { ordered, index: resumeIndex, progress: resumeProgress, chapter: ordered[resumeIndex] };
  }, [isBook, episodes, episodeProgressMap]);

  const doPlayAudiobook = async () => {
    // Sort oldest-first for chapter order
    const ordered = [...episodes].sort((a, b) => {
      const da = new Date(a.created_date || a.published_at || a.release_date || 0).getTime();
      const db = new Date(b.created_date || b.published_at || b.release_date || 0).getTime();
      return da - db;
    });

    // Enrich episodes that are missing audio URLs by fetching their full details
    const enriched = await Promise.all(ordered.map(async (ep) => {
      if (getEpisodeAudioUrl(ep)) return ep;
      try {
        const fullEp = await Episode.get(ep.id);
        return (fullEp && getEpisodeAudioUrl(fullEp)) ? fullEp : ep;
      } catch { return ep; }
    }));

    // Check if the start chapter has audio
    const startIdx = audiobookResume ? audiobookResume.index : 0;
    if (!getEpisodeAudioUrl(enriched[startIdx])) {
      toast({ title: "Unable to play", description: "This audiobook doesn't have audio available yet.", variant: "destructive" });
      return;
    }

    // Build queue items for every chapter
    const queueItems = enriched.map((ep) => ({
      podcast: show,
      episode: ep,
      resume: { progress: 0 },
    }));

    // Embed saved progress for the resume chapter
    if (audiobookResume && audiobookResume.progress > 0 && queueItems[startIdx]) {
      queueItems[startIdx].resume = { progress: audiobookResume.progress };
    }

    try {
      await setPlaybackQueue(queueItems, startIdx);
      try { await UserLibrary.addToHistory(enriched[startIdx].id, 0); } catch (e) { if (typeof console !== 'undefined') console.debug('history add failed', e); }
    } catch (e) {
      console.error('Failed to play audiobook', e);
      toast({ title: "Playback error", description: "Something went wrong starting the audiobook.", variant: "destructive" });
    }
  };

  const sortedEpisodes = useMemo(() => {
    const arr = [...episodes];
    const getDate = (e) => new Date(e.created_date || e.published_at || e.release_date || 0).getTime();
    if (sortOrder === 'Newest') arr.sort((a, b) => getDate(b) - getDate(a));
    else if (sortOrder === 'Oldest') arr.sort((a, b) => getDate(a) - getDate(b));
    return arr;
  }, [episodes, sortOrder]);

  // TODO [PRE-LAUNCH]: Categories are defined in the backend but not assigned to any podcast.
  // Assign categories to each podcast via Django admin before launch so these pills populate.
  const categories = useMemo(() => getPodcastCategoriesLower(show || {}).slice(0, 6), [show]);
  const totalEpisodes = show?.episode_count || show?.episodes_count || show?.total_episodes || episodes?.length || 0;
  const isMembersOnly = !!show?.is_exclusive;
  const [descExpanded, setDescExpanded] = useState(false);
  const descRef = useRef(null);

  // Build a clean description snippet — prefer curated copy, fall back to API
  const descriptionText = getShowDescription(show) || show?.description || '';
  const hasLongDesc = descriptionText.length > 200;

  // Format total duration nicely
  const formattedDuration = useMemo(() => {
    const m = Number(show?.total_duration);
    if (!Number.isFinite(m) || m <= 0) return null;
    const hours = Math.floor(m / 60);
    const mins = m % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  }, [show?.total_duration]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-eeriecast-surface text-white">
        <div className="h-[50vh] w-full bg-eeriecast-surface-light/20 animate-pulse" />
        <div className="px-2.5 lg:px-10 py-8">
          <div className="h-80 w-full bg-eeriecast-surface-light/20 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-eeriecast-surface text-white">

      {/* ═══════════════════════════════════════════════════════
          CINEMATIC HERO HEADER
          ═══════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden">
        {/* Full-bleed cover background — high opacity, dramatic */}
        {show?.cover_image && (
          <div
            className="absolute inset-0 bg-no-repeat bg-cover bg-center"
            style={{ backgroundImage: `url(${show.cover_image})`, opacity: 0.18 }}
          />
        )}

        {/* Multi-layer gradient fade */}
        <div className="absolute inset-0 bg-gradient-to-b from-eeriecast-surface/60 via-eeriecast-surface/80 to-eeriecast-surface" />
        <div className="absolute inset-0 bg-gradient-to-r from-eeriecast-surface/70 via-transparent to-eeriecast-surface/70" />

        {/* Atmospheric color glow */}
        <div className="absolute -bottom-20 left-1/4 w-[30rem] h-[30rem] rounded-full blur-[120px] opacity-[0.06]"
          style={{ background: isBook ? 'radial-gradient(circle, #06b6d4, transparent)' : 'radial-gradient(circle, #dc2626, transparent)' }}
        />

        {/* Content */}
        <div className="relative pt-10 md:pt-14 pb-10 md:pb-14 px-4 lg:px-10">
          <div className="flex flex-col md:flex-row items-start gap-6 md:gap-10 max-w-6xl">

            {/* Cover Art — with halo glow */}
            <div className="relative flex-shrink-0 self-center md:self-start">
              {/* Glow behind art */}
              <div className="absolute inset-0 scale-110 rounded-2xl blur-2xl opacity-30"
                style={{ background: show?.cover_image ? `url(${show.cover_image}) center/cover` : 'none' }}
              />
              <div className={`relative overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-white/[0.06] rounded-xl ${
                isBook ? 'w-36 sm:w-44 md:w-52 aspect-[3/4]' : 'w-36 sm:w-44 md:w-52 aspect-square'
              }`}>
                {show?.cover_image ? (
                  <img src={show.cover_image} alt={show?.title || 'Cover'} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-eeriecast-surface-light to-eeriecast-surface">
                    {isBook ? <BookOpen className="w-12 h-12 text-zinc-600" /> : <Headphones className="w-12 h-12 text-zinc-700" />}
                  </div>
                )}
              </div>
            </div>

            {/* Info + Actions */}
            <div className="flex-1 min-w-0">
              {/* Badges row */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {isBook ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-cyan-400/90 bg-cyan-500/10 border border-cyan-400/[0.08] px-2.5 py-1 rounded-full">
                    <BookOpen className="w-3 h-3" />
                    Audiobook
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-red-400/90 bg-red-500/10 border border-red-400/[0.08] px-2.5 py-1 rounded-full">
                    <Headphones className="w-3 h-3" />
                    Podcast
                  </span>
                )}
                {isMembersOnly && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-amber-400/90 bg-amber-500/10 border border-amber-400/[0.08] px-2.5 py-1 rounded-full">
                    <Crown className="w-3 h-3" />
                    Members
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className={`font-bold leading-[1.1] tracking-tight mb-3 text-3xl sm:text-4xl md:text-5xl ${
                isBook ? 'italic' : ''
              }`}>
                {show?.title || show?.name || 'Podcast'}
              </h1>

              {/* Meta pills */}
              <div className="flex items-center gap-2.5 mb-4 flex-wrap">
                {totalEpisodes > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 bg-white/[0.04] backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/[0.04]">
                    {isBook ? <BookOpen className="w-3 h-3" /> : <Headphones className="w-3 h-3" />}
                    {totalEpisodes} {isBook ? (totalEpisodes === 1 ? 'Chapter' : 'Chapters') : (totalEpisodes === 1 ? 'Episode' : 'Episodes')}
                  </span>
                )}
                {formattedDuration && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 bg-white/[0.04] backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/[0.04]">
                    <Clock className="w-3 h-3" />
                    {formattedDuration}
                  </span>
                )}
                {show?.rating != null && Number(show.rating) > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400 bg-white/[0.04] backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/[0.04]">
                    {show.rating}
                  </span>
                )}
              </div>

              {/* Categories */}
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {categories.map((c) => (
                    <span key={c} className="text-[11px] font-medium text-zinc-500 bg-white/[0.03] px-2.5 py-1 rounded-full capitalize border border-white/[0.04] hover:border-white/[0.08] hover:text-zinc-300 transition-all duration-300">
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {/* Description */}
              {descriptionText && (
                <div className="mb-5 max-w-2xl">
                  <div
                    className="relative overflow-hidden transition-all duration-500 ease-in-out"
                    style={{
                      maxHeight: descExpanded
                        ? `${descRef.current?.scrollHeight || 500}px`
                        : '4.5em',
                    }}
                  >
                    <p ref={descRef} className="text-[13px] sm:text-sm text-zinc-400 leading-relaxed whitespace-pre-line">
                      {descriptionText}
                    </p>
                    {/* Fade overlay when collapsed */}
                    {hasLongDesc && !descExpanded && (
                      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-eeriecast-surface to-transparent pointer-events-none" />
                    )}
                  </div>
                  {hasLongDesc && (
                    <button
                      type="button"
                      onClick={() => setDescExpanded(!descExpanded)}
                      className="inline-flex items-center gap-1 mt-2 text-xs text-zinc-600 hover:text-zinc-300 transition-colors duration-300"
                    >
                      <span className={`transition-transform duration-300 ${descExpanded ? 'rotate-180' : 'rotate-0'}`}>
                        <ChevronDown className="w-3 h-3" />
                      </span>
                      {descExpanded ? 'Show less' : 'Read more'}
                    </button>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  className={`px-7 py-2.5 rounded-full flex items-center gap-2.5 text-sm font-semibold shadow-lg transition-all duration-500 hover:scale-[1.02] ${
                    isBook
                      ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-cyan-500/20'
                      : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-red-600/20'
                  }`}
                  onClick={isBook ? doPlayAudiobook : () => doPlay(sortedEpisodes[0])}
                >
                  <Play className="w-4 h-4 fill-white" />
                  {isBook
                    ? (audiobookResume
                      ? `Continue · Ch. ${audiobookResume.chapter?.episode_number || audiobookResume.index + 1}`
                      : 'Start Listening')
                    : 'Play'}
                </Button>

                <Button
                  variant="outline"
                  className={`relative overflow-visible px-5 py-2.5 rounded-full bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-300 text-sm ${
                    isFollowing ? 'text-red-400 border-red-400/20' : 'text-zinc-300'
                  } ${isFollowingLoading ? 'animate-pulse pointer-events-none' : ''
                  } ${followAnim === 'followed' ? 'animate-follow-glow' : ''
                  } ${followAnim === 'unfollowed' ? 'animate-unfollow-dim' : ''}`}
                  onClick={handleFollowToggle}
                  disabled={isFollowingLoading}
                >
                  {/* Pill-shaped ripple ring on follow */}
                  {followAnim === 'followed' && (
                    <span className="absolute inset-0 rounded-full border border-red-400/50 animate-follow-ring pointer-events-none" />
                  )}
                  {isFollowingLoading
                    ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    : <Heart className={`w-3.5 h-3.5 mr-1.5 transition-colors duration-300 ${
                        isFollowing ? 'fill-red-400' : ''
                      } ${followAnim === 'followed' ? 'animate-heart-bloom' : ''
                      } ${followAnim === 'unfollowed' ? 'animate-heart-release' : ''}`}
                      />
                  }
                  {isFollowing ? 'Following' : 'Follow'}
                </Button>

                {/* Read Book — audiobooks only */}
                {isBook && (
                  <Button
                    className="px-6 py-2.5 rounded-full flex items-center gap-2 text-sm font-semibold bg-gradient-to-r from-cyan-600/80 to-teal-600/80 hover:from-cyan-500 hover:to-teal-500 text-white shadow-lg shadow-cyan-500/10 transition-all duration-500 hover:scale-[1.02] border border-cyan-400/10"
                    onClick={() => {
                      // TODO: restore auth gate before launch: if (!isAuthenticated) { openAuth('login'); return; }
                      setShowReader(true);
                    }}
                  >
                    <BookOpen className="w-4 h-4" />
                    Read Book
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          EPISODES LIST
          ═══════════════════════════════════════════════════════ */}
      <div className="px-4 lg:px-10 pt-6 pb-28 md:pt-8 md:pb-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 md:gap-0 mb-5 md:mb-7">
          <h2 className="text-2xl md:text-3xl font-bold">{isBook ? 'Chapters' : 'Episodes'}</h2>
          <div className="flex flex-wrap gap-1.5">
            {['Newest', 'Oldest', 'Popular'].map(order => (
              <Button
                key={order}
                variant="ghost"
                onClick={() => setSortOrder(order)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-300 ${
                  sortOrder === order
                    ? 'bg-white/[0.06] text-white border border-white/[0.08]'
                    : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300'
                }`}
              >
                {order}
              </Button>
            ))}
          </div>
        </div>

        <EpisodesTable episodes={sortedEpisodes} show={show} onPlay={doPlay} onAddToPlaylist={handleOpenAddToPlaylist} lockedEpisodeIds={lockedEpisodeIds} />
      </div>

      <AddToPlaylistModal
        isOpen={showAddModal}
        episode={episodeToAdd}
        playlists={playlists}
        onClose={() => { setShowAddModal(false); setEpisodeToAdd(null); }}
        onAdded={({ playlist: pl, action }) => {
          if (action === 'created') addPlaylist(pl);
          if (action === 'updated') updatePlaylist(pl);
        }}
      />

      {/* E-Reader overlay — audiobooks only */}
      <AnimatePresence>
        {showReader && isBook && findBookForShow(show) && (
          <EReader
            key="ereader"
            book={findBookForShow(show)}
            isPremium={isPremium}
            onClose={() => setShowReader(false)}
            onSubscribe={() => {
              setShowReader(false);
              goToPremium();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
