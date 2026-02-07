import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Playlist, UserLibrary } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Play, Crown, BookOpen, Clock, ChevronDown, ChevronUp, Headphones, Heart } from 'lucide-react';
import EpisodesTable from '@/components/podcasts/EpisodesTable';
import AddToPlaylistModal from '@/components/library/AddToPlaylistModal';
import { useAudioPlayerContext } from '@/context/AudioPlayerContext';
import { useUser } from '@/context/UserContext';
import { getPodcastCategoriesLower, isAudiobook } from '@/lib/utils';
import SubscribeModal from '@/components/auth/SubscribeModal';
import { usePodcasts } from '@/context/PodcastContext.jsx';
import { useAuthModal } from '@/context/AuthModalContext.jsx';
import EReader from '@/components/podcasts/EReader';
import callOfCthulhu from '@/data/books/call-of-cthulhu';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function Episodes() {
  const query = useQuery();
  const idParam = query.get('id') || query.get('podcast') || query.get('podcastId');

  const { ensureDetail } = usePodcasts();
  const [show, setShow] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('Newest');
  const [playlists, setPlaylists] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [episodeToAdd, setEpisodeToAdd] = useState(null);
  const [isFollowingLoading, setIsFollowingLoading] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [subscribeLabel, setSubscribeLabel] = useState('');
  const [showReader, setShowReader] = useState(false);

  const { loadAndPlay } = useAudioPlayerContext();
  const { followedPodcastIds, refreshFollowings, isAuthenticated, isPremium } = useUser();
  const { openAuth } = useAuthModal();

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

  useEffect(() => {
    async function loadPlaylists() {
      try {
        const resp = await Playlist.list();
        const list = Array.isArray(resp) ? resp : (resp?.results || []);
        setPlaylists(list);
      } catch (e) {
        if (typeof console !== 'undefined') console.debug('playlists load failed', e);
        setPlaylists([]);
      }
    }
    loadPlaylists();
  }, []);

  const handleOpenAddToPlaylist = (ep) => {
    if (!isAuthenticated) { openAuth('login'); return; }
    setEpisodeToAdd(ep);
    setShowAddModal(true);
  };

  const handleFollowToggle = async () => {
    if (!show?.id) return;
    if (!isAuthenticated) { openAuth('login'); return; }
    setIsFollowingLoading(true);
    try {
      if (isFollowing) {
        await UserLibrary.unfollowPodcast(show.id);
      } else {
        await UserLibrary.followPodcast(show.id);
      }
      await refreshFollowings();
    } catch (e) {
      console.error('Failed to toggle follow', e);
    } finally {
      setIsFollowingLoading(false);
    }
  };

  const doPlay = async (ep) => {
    if (!ep) return;
    if (show?.is_exclusive && !isPremium) {
      setSubscribeLabel(show?.title || show?.name || 'Members-only podcast');
      setShowSubscribeModal(true);
      return;
    }
    if (ep?.is_premium && !isPremium) {
      setSubscribeLabel(ep?.title || 'Premium episode');
      setShowSubscribeModal(true);
      return;
    }
    try {
      await loadAndPlay({ podcast: show, episode: ep });
      try { await UserLibrary.addToHistory(ep.id, 0); } catch (e) { if (typeof console !== 'undefined') console.debug('history add failed', e); }
    } catch (e) {
      console.error('Failed to play', e);
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
  const isBook = show ? isAudiobook(show) : false;
  const isMembersOnly = !!show?.is_exclusive;
  const [descExpanded, setDescExpanded] = useState(false);

  // Build a clean description snippet
  const descriptionText = show?.description || '';
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
              <div className={`relative overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-white/[0.06] ${
                isBook ? 'w-36 sm:w-44 md:w-52 rounded-xl aspect-[3/4]' : 'w-32 sm:w-40 md:w-48 rounded-xl aspect-square'
              }`}>
                {show?.cover_image ? (
                  <img src={show.cover_image} alt={show?.title || 'Cover'} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-eeriecast-surface-light to-eeriecast-surface">
                    {isBook ? <BookOpen className="w-12 h-12 text-zinc-600" /> : <Headphones className="w-12 h-12 text-zinc-600" />}
                  </div>
                )}
              </div>
            </div>

            {/* Info + Actions */}
            <div className="flex-1 min-w-0">
              {/* Badges row */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {isBook && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-cyan-400/90 bg-cyan-500/10 border border-cyan-400/[0.08] px-2.5 py-1 rounded-full">
                    <BookOpen className="w-3 h-3" />
                    Audiobook
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
              <h1 className={`font-bold leading-[1.1] tracking-tight mb-3 ${
                isBook ? 'text-3xl sm:text-4xl md:text-5xl italic' : 'text-2xl sm:text-3xl md:text-5xl'
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
                  <p className={`text-[13px] sm:text-sm text-zinc-400 leading-relaxed whitespace-pre-line ${!descExpanded && hasLongDesc ? 'line-clamp-3' : ''}`}>
                    {descriptionText}
                  </p>
                  {hasLongDesc && (
                    <button
                      type="button"
                      onClick={() => setDescExpanded(!descExpanded)}
                      className="inline-flex items-center gap-1 mt-1.5 text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
                    >
                      {descExpanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Read more</>}
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
                  onClick={() => doPlay(sortedEpisodes[0])}
                >
                  <Play className="w-4 h-4 fill-white" />
                  {isBook ? 'Start Listening' : 'Play'}
                </Button>

                <Button
                  variant="outline"
                  className={`px-5 py-2.5 rounded-full bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-300 text-sm ${
                    isFollowing ? 'text-red-400 border-red-400/20' : 'text-zinc-300'
                  }`}
                  onClick={handleFollowToggle}
                  disabled={isFollowingLoading}
                >
                  <Heart className={`w-3.5 h-3.5 mr-1.5 ${isFollowing ? 'fill-red-400' : ''}`} />
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

        <EpisodesTable episodes={sortedEpisodes} show={show} onPlay={doPlay} onAddToPlaylist={handleOpenAddToPlaylist} />
      </div>

      <AddToPlaylistModal
        isOpen={showAddModal}
        episode={episodeToAdd}
        playlists={playlists}
        onClose={() => { setShowAddModal(false); setEpisodeToAdd(null); }}
        onAdded={({ playlist: pl, action }) => {
          if (action === 'created') setPlaylists(prev => [pl, ...prev]);
          if (action === 'updated') setPlaylists(prev => prev.map(p => p.id === pl.id ? pl : p));
        }}
      />

      <SubscribeModal
        open={showSubscribeModal}
        onOpenChange={setShowSubscribeModal}
        itemLabel={subscribeLabel}
        title="Subscribe to listen"
        message="This content is available to members only. Subscribe to unlock all premium shows and episodes."
      />

      {/* E-Reader overlay — audiobooks only */}
      {showReader && isBook && (
        <EReader
          book={callOfCthulhu}
          isPremium={true /* TODO: revert to isPremium before launch */}
          onClose={() => setShowReader(false)}
          onSubscribe={() => {
            setShowReader(false);
            setSubscribeLabel(show?.title || 'this audiobook');
            setShowSubscribeModal(true);
          }}
        />
      )}
    </div>
  );
}
