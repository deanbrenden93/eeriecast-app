import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Playlist as PlaylistApi, Episode } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Play, Clock, ListMusic, Headphones } from 'lucide-react';
import EpisodesTable from '@/components/podcasts/EpisodesTable';
import { useAudioPlayerContext } from '@/context/AudioPlayerContext';
import { useUser } from '@/context/UserContext.jsx';
import { useAuthModal } from '@/context/AuthModalContext.jsx';
import { usePodcasts } from '@/context/PodcastContext.jsx';
import { usePlaylistContext } from '@/context/PlaylistContext.jsx';
import AddToPlaylistModal from '@/components/library/AddToPlaylistModal';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

// ── Mosaic thumbnail component ────────────────────────────────────
function PlaylistMosaic({ images = [], size = 'lg', className = '' }) {
  const imgs = images.filter(Boolean).slice(0, 3);
  const sizeClasses = size === 'lg'
    ? 'w-36 sm:w-44 md:w-52 aspect-square'
    : 'w-20 h-20';

  const fallback = (
    <div className={`${sizeClasses} rounded-xl bg-gradient-to-br from-violet-900/40 to-eeriecast-deep-violet/30 flex items-center justify-center ring-1 ring-white/[0.06] ${className}`}>
      <Headphones className={size === 'lg' ? 'w-12 h-12 text-violet-400/40' : 'w-6 h-6 text-violet-400/40'} />
    </div>
  );

  if (imgs.length === 0) return fallback;

  if (imgs.length === 1) {
    return (
      <div className={`${sizeClasses} rounded-xl overflow-hidden ring-1 ring-white/[0.06] shadow-2xl shadow-black/60 ${className}`}>
        <img src={imgs[0]} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  if (imgs.length === 2) {
    return (
      <div className={`${sizeClasses} rounded-xl overflow-hidden ring-1 ring-white/[0.06] shadow-2xl shadow-black/60 grid grid-cols-2 ${className}`}>
        <img src={imgs[0]} alt="" className="w-full h-full object-cover" />
        <img src={imgs[1]} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  // 3 images: one large left, two stacked right
  return (
    <div className={`${sizeClasses} rounded-xl overflow-hidden ring-1 ring-white/[0.06] shadow-2xl shadow-black/60 grid grid-cols-2 ${className}`}>
      <img src={imgs[0]} alt="" className="w-full h-full object-cover row-span-2" />
      <div className="flex flex-col h-full">
        <img src={imgs[1]} alt="" className="w-full flex-1 object-cover" />
        <img src={imgs[2]} alt="" className="w-full flex-1 object-cover" />
      </div>
    </div>
  );
}

export { PlaylistMosaic };

export default function Playlist() {
  const query = useQuery();
  const idParam = query.get('id');
  const navigate = useNavigate();

  const [playlist, setPlaylist] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingEpisodeId, setRemovingEpisodeId] = useState(null);
  const [sortOrder, setSortOrder] = useState('Custom');

  const { loadAndPlay, setPlaybackQueue } = useAudioPlayerContext();
  const { isAuthenticated, isPremium, removeEpisodeFromPlaylist } = useUser();
  const { openAuth } = useAuthModal();
  const { getById: getPodcastById } = usePodcasts();
  const { playlists, updatePlaylist } = usePlaylistContext();

  // Add-to-Playlist modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [episodeToAdd, setEpisodeToAdd] = useState(null);

  const handleOpenAddToPlaylist = (episode) => {
    if (!isAuthenticated) { openAuth('login'); return; }
    if (!isPremium) { window.location.assign('/Premium'); return; }
    setEpisodeToAdd(episode);
    setShowAddModal(true);
  };

  // ── Fetch playlist + episodes ───────────────────────────────────
  useEffect(() => {
    let canceled = false;
    async function load() {
      if (!idParam) { setIsLoading(false); return; }
      setIsLoading(true);
      try {
        const pl = await PlaylistApi.get(idParam);
        if (canceled) return;
        setPlaylist(pl);

        const ids = Array.isArray(pl?.episodes) ? pl.episodes : [];
        if (ids.length === 0) { setEpisodes([]); return; }

        // Fetch episodes and enrich with podcast cover art
        const eps = [];
        for (const id of ids) {
          try {
            const ep = await Episode.get(id);
            if (!ep) continue;
            // Enrich: if ep.podcast is just an ID, attach the full podcast object for cover_image fallback
            if (ep.podcast && typeof ep.podcast !== 'object') {
              const podcastObj = getPodcastById(ep.podcast);
              if (podcastObj) {
                ep.podcast = podcastObj;
              }
            }
            eps.push(ep);
          } catch {
            // skip failures
          }
        }
        if (!canceled) setEpisodes(eps);
      } finally {
        if (!canceled) setIsLoading(false);
      }
    }
    load();
    return () => { canceled = true; };
  }, [idParam, getPodcastById]);

  // ── Sorting ─────────────────────────────────────────────────────
  const sortedEpisodes = useMemo(() => {
    if (sortOrder === 'Custom') return episodes;
    const arr = [...episodes];
    const getDate = (e) => new Date(e.created_date || e.published_at || e.release_date || 0).getTime();
    if (sortOrder === 'Newest') arr.sort((a, b) => getDate(b) - getDate(a));
    else if (sortOrder === 'Oldest') arr.sort((a, b) => getDate(a) - getDate(b));
    return arr;
  }, [episodes, sortOrder]);

  // ── Cover art helper ────────────────────────────────────────────
  const getEpArtwork = (ep) => ep?.image_url || ep?.artwork || ep?.cover_image || ep?.podcast?.cover_image || null;

  // Collect unique cover images for the mosaic
  const mosaicImages = useMemo(() => {
    const seen = new Set();
    const imgs = [];
    for (const ep of episodes) {
      const art = getEpArtwork(ep);
      if (art && !seen.has(art)) {
        seen.add(art);
        imgs.push(art);
      }
      if (imgs.length >= 3) break;
    }
    return imgs;
  }, [episodes]);

  // Hero background image (first available artwork)
  const heroImage = mosaicImages[0] || null;

  // ── Build pseudo-podcast for player context ─────────────────────
  const buildPseudoPodcast = (ep) => ({
    id: `playlist-${playlist?.id}`,
    title: playlist?.name || playlist?.title || 'Playlist',
    cover_image: getEpArtwork(ep) || null,
  });

  // ── Play All: queue entire playlist in current sort order ───────
  const handlePlayAll = async () => {
    if (!sortedEpisodes.length) return;
    const pseudoPodcast = buildPseudoPodcast(sortedEpisodes[0]);
    const queueItems = sortedEpisodes.map(ep => ({
      podcast: { ...pseudoPodcast, cover_image: getEpArtwork(ep) || pseudoPodcast.cover_image },
      episode: ep,
      resume: { progress: 0 },
    }));
    await setPlaybackQueue(queueItems, 0);
  };

  // ── Play from here: queue from clicked episode onward ───────────
  const doPlay = async (ep) => {
    if (!ep) return;
    const idx = sortedEpisodes.findIndex(e => e.id === ep.id);
    const startIdx = idx >= 0 ? idx : 0;
    const pseudoPodcast = buildPseudoPodcast(ep);
    const queueItems = sortedEpisodes.map(e => ({
      podcast: { ...pseudoPodcast, cover_image: getEpArtwork(e) || pseudoPodcast.cover_image },
      episode: e,
      resume: { progress: 0 },
    }));
    await setPlaybackQueue(queueItems, startIdx);
  };

  // ── Remove from playlist ────────────────────────────────────────
  const handleRemoveFromPlaylist = async (ep) => {
    if (!ep?.id) return;
    if (!isAuthenticated) { openAuth('login'); return; }
    if (!playlist?.id) return;
    if (removingEpisodeId === ep.id) return;
    setRemovingEpisodeId(ep.id);
    const ok = await removeEpisodeFromPlaylist(playlist.id, ep.id);
    if (ok) {
      setEpisodes(prev => prev.filter(e => e.id !== ep.id));
      setPlaylist(p => {
        const updated = { ...p, episodes: (Array.isArray(p?.episodes) ? p.episodes.filter(id => id !== ep.id) : []) };
        // Sync the global playlist context so Library cards update immediately
        updatePlaylist(updated);
        return updated;
      });
    }
    setRemovingEpisodeId(null);
  };

  // ── Loading state ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-eeriecast-surface text-white">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-violet-950/20 to-eeriecast-surface" />
          <div className="relative pt-10 md:pt-14 pb-10 md:pb-14 px-4 lg:px-10">
            <div className="flex flex-col md:flex-row items-start gap-6 md:gap-10 max-w-6xl animate-pulse">
              <div className="w-36 sm:w-44 md:w-52 aspect-square rounded-xl bg-white/[0.04]" />
              <div className="flex-1 space-y-4 py-4">
                <div className="h-4 w-20 bg-white/[0.04] rounded-full" />
                <div className="h-8 w-64 bg-white/[0.04] rounded-lg" />
                <div className="h-4 w-40 bg-white/[0.04] rounded-full" />
              </div>
            </div>
          </div>
        </div>
        <div className="px-4 lg:px-10 py-8">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-white/[0.02] rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Not found ───────────────────────────────────────────────────
  if (!playlist) {
    return (
      <div className="min-h-screen bg-eeriecast-surface text-white">
        <div className="px-4 lg:px-10 py-8">
          <Button variant="ghost" className="mb-4 text-zinc-400 hover:text-white" onClick={() => navigate(-1)}>Back</Button>
          <div className="text-gray-400">Playlist not found.</div>
        </div>
      </div>
    );
  }

  const episodeCount = episodes.length;
  const approx = playlist?.approximate_length_minutes;

  return (
    <div className="min-h-screen bg-eeriecast-surface text-white">

      {/* ═══════════════════════════════════════════════════════
          CINEMATIC HERO HEADER
          ═══════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden">
        {/* Full-bleed background from first episode artwork */}
        {heroImage && (
          <div
            className="absolute inset-0 bg-no-repeat bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImage})`, opacity: 0.14 }}
          />
        )}

        {/* Multi-layer gradient fade */}
        <div className="absolute inset-0 bg-gradient-to-b from-eeriecast-surface/60 via-eeriecast-surface/80 to-eeriecast-surface" />
        <div className="absolute inset-0 bg-gradient-to-r from-eeriecast-surface/70 via-transparent to-eeriecast-surface/70" />

        {/* Atmospheric violet glow — playlist identity color */}
        <div className="absolute -bottom-20 left-1/4 w-[30rem] h-[30rem] rounded-full blur-[120px] opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #7c3aed, transparent)' }}
        />

        {/* Content */}
        <div className="relative pt-10 md:pt-14 pb-10 md:pb-14 px-4 lg:px-10">
          <div className="flex flex-col md:flex-row items-start gap-6 md:gap-10 max-w-6xl">

            {/* Mosaic thumbnail — with halo glow */}
            <div className="relative flex-shrink-0 self-center md:self-start">
              {heroImage && (
                <div className="absolute inset-0 scale-110 rounded-2xl blur-2xl opacity-25"
                  style={{ background: `url(${heroImage}) center/cover` }}
                />
              )}
              <PlaylistMosaic images={mosaicImages} size="lg" />
            </div>

            {/* Info + Actions */}
            <div className="flex-1 min-w-0">
              {/* Badge */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-violet-400/90 bg-violet-500/10 border border-violet-400/[0.08] px-2.5 py-1 rounded-full">
                  <ListMusic className="w-3 h-3" />
                  Playlist
                </span>
              </div>

              {/* Title */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-3 leading-tight">
                {playlist?.name || playlist?.title || 'Playlist'}
              </h1>

              {/* Meta pills */}
              <div className="flex items-center gap-3 flex-wrap mb-5">
                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400 bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 rounded-full">
                  <Headphones className="w-3 h-3" />
                  {episodeCount} {episodeCount === 1 ? 'episode' : 'episodes'}
                </span>
                {typeof approx === 'number' && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400 bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 rounded-full">
                    <Clock className="w-3 h-3" />
                    ~{approx}m
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <Button
                  className="px-6 py-2.5 rounded-full flex items-center gap-2 text-sm font-semibold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-500/15 transition-all duration-500 hover:scale-[1.02] border border-violet-400/10"
                  onClick={handlePlayAll}
                  disabled={!episodes.length}
                >
                  <Play className="w-4 h-4 fill-white" />
                  Play All
                </Button>
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
          <h2 className="text-2xl md:text-3xl font-bold">Your Episodes</h2>
          <div className="flex flex-wrap gap-1.5">
            {['Custom', 'Newest', 'Oldest'].map(order => (
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

        {episodes.length === 0 ? (
          <div className="text-center py-16">
            <Headphones className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500 text-sm">This playlist is empty. Add episodes from any show to get started.</p>
          </div>
        ) : (
          <EpisodesTable
            episodes={sortedEpisodes}
            onPlay={doPlay}
            onRemoveFromPlaylist={handleRemoveFromPlaylist}
            removingEpisodeId={removingEpisodeId}
            onAddToPlaylist={handleOpenAddToPlaylist}
          />
        )}
      </div>

      {/* Add to Playlist Modal */}
      <AddToPlaylistModal
        isOpen={showAddModal}
        episode={episodeToAdd}
        playlists={playlists}
        onClose={() => { setShowAddModal(false); setEpisodeToAdd(null); }}
        onAdded={(pl) => {
          updatePlaylist(pl);
          setShowAddModal(false);
          setEpisodeToAdd(null);
        }}
      />
    </div>
  );
}
