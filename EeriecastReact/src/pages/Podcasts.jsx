import { useState, useMemo, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Podcast as PodcastApi, UserLibrary } from "@/api/entities";
import { isAudiobook, isMusic, hasCategory } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/queryClient";

// `is_exclusive` is now sourced exclusively from the backend admin panel.
// (An earlier workaround hard-coded podcast IDs 10 and 4 as members-only
// here because the backend was returning the wrong value for them — those
// overrides have been removed now that the Django admin is the single
// source of truth.)

// Total runtime for an audiobook row card ("12h 42m" / "42m").
// `total_duration` is stored in minutes on the Podcast model.
function formatAudiobookRuntime(p) {
  const m = Number(p?.total_duration);
  if (!Number.isFinite(m) || m <= 0) {
    const n = p?.episodes_count ?? p?.episode_count ?? 0;
    return n > 0 ? `${n} chapter${n === 1 ? '' : 's'}` : '';
  }
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

// Episode count subtitle for a members-only show card.
function formatEpisodeCount(p) {
  const n = p?.episode_count ?? p?.episodes_count ?? p?.total_episodes ?? 0;
  if (!Number.isFinite(Number(n)) || Number(n) <= 0) return '';
  return `${n} episode${n === 1 ? '' : 's'}`;
}

import { Crown } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import PodcastModal from "../components/podcasts/PodcastModal";
import FeaturedHero from "../components/podcasts/FeaturedHero";
import CategoryExplorer from "../components/podcasts/CategoryExplorer";
import PodcastRow from "../components/podcasts/PodcastRow";
import NewReleasesRow from "../components/podcasts/NewReleasesRow";
import EpisodeCloudsRow from "../components/podcasts/EpisodeCloudsRow";
import MusicTracksRow from "../components/podcasts/MusicTracksRow";
import KeepListeningSection from "../components/podcasts/KeepListeningSection";
import MembersOnlySection from "../components/podcasts/MembersOnlySection";
import MembersOnlyEpisodesRow from "../components/podcasts/MembersOnlyEpisodesRow";
import FeaturedCreatorsSection from "../components/podcasts/FeaturedCreatorsSection";
import ExpandedPlayer from "../components/podcasts/ExpandedPlayer";
import {
  FeaturedHeroSkeleton,
  KeepListeningSkeleton,
  EpisodeRowSkeleton,
  EpisodeCloudsSkeleton,
  MusicTracksSkeleton,
  ShowRowSkeleton,
  CategoryExplorerSkeleton,
  FeaturedCreatorsSkeleton,
} from "@/components/skeletons/HomeSkeletons";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";
import { AnimatePresence, motion } from "framer-motion";
import { useUser } from "@/context/UserContext.jsx";
import { usePodcasts } from "@/context/PodcastContext.jsx";
import { usePlaylistContext } from "@/context/PlaylistContext.jsx";
import { useAuthModal } from "@/context/AuthModalContext.jsx";
import AddToPlaylistModal from "@/components/library/AddToPlaylistModal";

export default function Podcasts() {
  const { podcasts: rawPodcasts, isLoading, softRefreshIfStale } = usePodcasts();
  const podcasts = rawPodcasts;

  // Refresh on mount so creators' newly-uploaded shows/episodes show up
  // without requiring the listener to hard-reload the browser. Short
  // stale window because this is the home feed — freshness matters more
  // than API cost here.
  useEffect(() => { softRefreshIfStale(15_000); }, [softRefreshIfStale]);
  const queryClient = useQueryClient();
  const [selectedPodcast, setSelectedPodcast] = useState(null);
  const [showExpandedPlayer, setShowExpandedPlayer] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(location.search);
  const selectedCategoryParam = (urlParams.get('category') || '').toLowerCase();

  const {
    episode: currentEpisode,
    podcast: currentPodcast,
    isPlaying,
    currentTime,
    duration,
    loadAndPlay,
    toggle,
    seek,
    skip,
    pause,
    setPlaybackQueue,
  } = useAudioPlayerContext();

  const { isPremium, isAuthenticated } = useUser();
  const { playlists, addPlaylist, updatePlaylist } = usePlaylistContext();
  const { openAuth } = useAuthModal();

  // Add-to-Playlist state
  const [showAddModal, setShowAddModal] = useState(false);
  const [episodeToAdd, setEpisodeToAdd] = useState(null);

  const openAddToPlaylist = (episode) => {
    if (!isAuthenticated) { openAuth('login'); return; }
    if (!isPremium) { window.location.assign('/Premium'); return; }
    setEpisodeToAdd(episode);
    setShowAddModal(true);
  };

  // Keep Listening: fetch the 20 most recent history entries — same data
  // source as the Library → History tab, just capped and styled for the home screen.
  // Cached via React Query so navigating away and back doesn't flash skeletons.
  const { data: keepListeningRaw = [], isLoading: isHistoryLoading } = useQuery({
    queryKey: qk.library.history(20),
    queryFn: async () => {
      const resp = await UserLibrary.getHistory(20);
      const raw = Array.isArray(resp) ? resp : (resp?.results || []);
      const seen = new Set();
      const items = [];
      for (const entry of raw) {
        const ep = entry?.episode_detail;
        if (!ep?.id || seen.has(ep.id)) continue;
        seen.add(ep.id);
        const podcastData = ep.podcast && typeof ep.podcast === 'object' ? ep.podcast : null;
        const progressSec = Math.max(0, Number(entry.progress || 0));
        const dur = Math.max(0, Number(entry.duration || ep.duration || 0));
        const pct = entry.percent_complete ?? (dur > 0 ? Math.min(100, (progressSec / dur) * 100) : 0);
        items.push({
          podcast: podcastData || { id: ep.podcast_id || ep.podcast, title: ep.podcast_title || '' },
          episode: ep,
          progress: pct,
          resumeData: { progress: progressSec },
        });
      }
      return items;
    },
    enabled: isAuthenticated,
  });

  const keepListeningItems = useMemo(() => keepListeningRaw, [keepListeningRaw]);

  const visiblePodcasts = useMemo(() => {
    const items = podcasts;
    const selected = selectedCategoryParam;
    if (!selected) return items;
    if (selected === 'audiobook' || selected === 'audiobooks') return items.filter(p => isAudiobook(p));
    if (selected === 'music') return items.filter(p => isMusic(p));
    if (selected === 'free') return items.filter(p => !p.is_exclusive);
    if (selected === 'members-only' || selected === 'members only' || selected === 'members_only') return items.filter(p => p.is_exclusive);
    return items.filter(p => hasCategory(p, selected));
  }, [podcasts, selectedCategoryParam]);

  const heroPodcast = useMemo(() => {
    if (isLoading) return null;
    if (!selectedCategoryParam) return podcasts.find(p => p.is_featured) || podcasts[0] || null;
    return visiblePodcasts.find(p => p.is_featured) || visiblePodcasts[0] || podcasts[0] || null;
  }, [isLoading, podcasts, visiblePodcasts, selectedCategoryParam]);

  const handlePodcastPlay = async (podcast) => {
    try {
      // Audiobooks and music artists drive playback from their show page
      // (chapter/track ordering matters and they never auto-queue the
      // newest item).
      if (isAudiobook(podcast) || isMusic(podcast)) {
        handleNavigateToShow(podcast);
        return;
      }
      if (podcast?.is_exclusive && !isPremium) {
        if (podcast?.id) navigate(`${createPageUrl('Episodes')}?id=${encodeURIComponent(podcast.id)}`);
        return;
      }
      let episodes = podcast.episodes;
      if (!episodes || episodes.length === 0) {
        const detail = await PodcastApi.get(podcast.id);
        episodes = Array.isArray(detail?.episodes) ? detail.episodes : (detail?.episodes?.results || []);
      }
      let resume;
      try { resume = await UserLibrary.resumeForPodcast(podcast.id); } catch { resume = null; }
      let ep;
      const resumeEp = resume && resume.episode_detail;
      if (resumeEp) {
        const found = episodes.find(e => e.id === resumeEp.id);
        ep = found ? { ...found, ...resumeEp } : resumeEp;
      } else {
        ep = episodes[0];
      }
      if (!ep) return;
      if (ep?.is_premium && !isPremium) {
        navigate(createPageUrl('Premium'));
        return;
      }
      await loadAndPlay({ podcast, episode: ep, resume });
      // Update localStorage recently played
      const recentlyPlayedIds = JSON.parse(localStorage.getItem('recentlyPlayed') || '[]');
      const newIds = [podcast.id, ...recentlyPlayedIds.filter(id => id !== podcast.id)].slice(0, 10);
      localStorage.setItem('recentlyPlayed', JSON.stringify(newIds));
      // Optimistically prepend this episode to the Keep Listening cache so
      // the card appears instantly and persists across navigation.
      queryClient.setQueryData(qk.library.history(20), (prev) => {
        const newItem = { podcast, episode: ep, progress: 0, resumeData: resume };
        const list = Array.isArray(prev) ? prev.filter((item) => item.episode?.id !== ep.id) : [];
        return [newItem, ...list];
      });
    } catch (err) {
      console.error('Failed to start playback:', err);
    }
  };

  const handleNavigateToShow = (podcast) => {
    if (podcast?.id) {
      navigate(`${createPageUrl('Episodes')}?id=${encodeURIComponent(podcast.id)}`);
    }
  };

  const handleStartListening = async () => {
    try {
      if (!Array.isArray(keepListeningItems) || keepListeningItems.length === 0) {
        if (heroPodcast) await handlePodcastPlay(heroPodcast);
        return;
      }
      const filtered = keepListeningItems
        .filter(item => {
          if (item.podcast?.is_exclusive && !isPremium) return false;
          if (item.episode?.is_premium && !isPremium) return false;
          return true;
        })
        .map(item => ({ podcast: item.podcast, episode: item.episode, resume: item.resumeData }));

      if (!filtered.length) {
        if (heroPodcast) await handlePodcastPlay(heroPodcast);
        return;
      }
      await setPlaybackQueue(filtered, 0);
    } catch (e) {
      console.error('Failed to start listening queue', e);
    }
  };

  const handleCloseMobilePlayer = () => { pause(); };
  const handleCollapsePlayer = () => setShowExpandedPlayer(false);

  return (
    <div className="min-h-screen bg-eeriecast-surface w-full">
      {/* ─── Hero ───
          Pre-data: render a skeleton block sized exactly like the real
          hero (clamp(400px, 48vh, 500px)) so the page below it doesn't
          jump up when the catalog finishes loading. */}
      {isLoading ? <FeaturedHeroSkeleton /> : <FeaturedHero onPlay={handlePodcastPlay} />}

      {/* ─── Keep Listening ───
          Only authenticated users have a history feed; anonymous users
          skip this entire row. While the history fetch (or the catalog
          itself) is in flight we render a 2-row skeleton matching the
          real card grid, then either the real row or nothing once the
          fetch resolves. Users with no history never see a skeleton —
          the row is simply omitted, same as today. */}
      {isAuthenticated && (
        (isLoading || isHistoryLoading) ? (
          <div className="w-full px-2.5 lg:px-10 py-3">
            <KeepListeningSkeleton />
          </div>
        ) : keepListeningItems.length > 0 && (
          <div className="w-full px-2.5 lg:px-10 py-3">
            <KeepListeningSection
              items={keepListeningItems}
              onEpisodePlay={async (item) => {
                const played = await loadAndPlay({ podcast: item.podcast, episode: item.episode, resume: item.resumeData || { progress: 0 } });
                if (played === false) {
                  toast({
                    title: "Unable to play",
                    description: isAuthenticated
                      ? "This episode doesn't have audio available yet."
                      : "Please sign in to play episodes.",
                    variant: "destructive",
                  });
                }
              }}
              currentEpisodeId={currentEpisode?.id}
              currentTime={currentTime}
              currentDuration={duration}
              onAddToPlaylist={openAddToPlaylist}
            />
          </div>
        )
      )}

      {/* ─── For You ───
          NewReleasesRow renders its own skeleton internally during its
          fetch. The page just wraps it in the same padding it always
          has, so the real row drops in without a horizontal shift. */}
      <div className="w-full px-2.5 lg:px-10 py-3">
        {isLoading ? (
          <EpisodeRowSkeleton titleWidth="w-32" />
        ) : (
          <NewReleasesRow
            title={<h2 className="text-2xl font-bold text-white">For You</h2>}
            viewAllTo={`${createPageUrl('Discover')}?tab=Recommended`}
            feedType="recommended"
            onAddToPlaylist={openAddToPlaylist}
          />
        )}
      </div>

      {/* ─── Trending ───
          Sits directly after For You so the strongest social-proof
          surface gets first claim on the slot below the personalized
          row. The Pirata One rank numerals on these cards are a
          deliberate atmospheric flourish; they deserve above-the-fold
          placement on most laptops. */}
      <div className="w-full px-2.5 lg:px-10 py-3">
        {isLoading ? (
          <EpisodeRowSkeleton titleWidth="w-40" />
        ) : (
          <NewReleasesRow
            title={<h2 className="text-2xl font-bold text-white">Trending Now</h2>}
            viewAllTo={`${createPageUrl('Discover')}?tab=Trending`}
            feedType="trending"
            onAddToPlaylist={openAddToPlaylist}
          />
        )}
      </div>

      {/* ─── Newest ───
          Freshest episodes across the catalog, sitting just below
          Trending Now (personal → popular → recent). Same
          NewReleasesRow plumbing as the Discover → Newest tab so feeds
          stay in sync. */}
      <div className="w-full px-2.5 lg:px-10 py-3">
        {isLoading ? (
          <EpisodeRowSkeleton titleWidth="w-44" />
        ) : (
          <NewReleasesRow
            title={<h2 className="text-2xl font-bold text-white">Newest Episodes</h2>}
            viewAllTo={`${createPageUrl('Discover')}?tab=Newest`}
            feedType="latest"
            onAddToPlaylist={openAddToPlaylist}
          />
        )}
      </div>

      {/* ─── Random Cravings (Episode Clouds) ───
          Themed clusters that break the row-monotony with organic
          thumbnail clouds. The component owns its own loading state.
          Placed after three identical card-row shapes so the visual
          shift lands as a deliberate palate cleanser. */}
      <div className="w-full px-2.5 lg:px-10 py-3">
        {isLoading ? (
          <EpisodeCloudsSkeleton />
        ) : (
          <EpisodeCloudsRow onAddToPlaylist={openAddToPlaylist} />
        )}
      </div>

      {/* ─── Membership promo banner (non-premium users only) ───
          Positioned immediately *above* the Members-Only Episodes row
          so it reads as one beat — pitch + proof. Non-premium users
          see the claim ("Unlock the full experience") and then a row
          of the actual content they'd be unlocking. Premium users
          (where the banner is suppressed) instead see Members-Only
          Episodes as a direct content row, which is what they pay
          for. */}
      {!isLoading && !isPremium && (
        <div className="w-full px-2.5 lg:px-10 py-3">
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.05]">
            {/* Layered atmospheric background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1028] via-[#12101c] to-[#0d0f18]" />
            <div className="absolute top-0 right-0 w-[28rem] h-[28rem] bg-amber-500/[0.04] rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-600/[0.04] rounded-full blur-[80px] translate-y-1/3 -translate-x-1/4" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-32 bg-amber-400/[0.02] rounded-full blur-[60px] rotate-12" />

            {/* Content */}
            <div className="relative px-6 sm:px-10 lg:px-14 py-10 sm:py-14 flex flex-col sm:flex-row items-center gap-8 sm:gap-12">
              <div className="flex-1 text-center sm:text-left">
                {/* Badge */}
                <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500/15 to-amber-400/10 text-amber-400/90 text-[10px] font-bold uppercase tracking-[0.15em] px-3 py-1 rounded-full border border-amber-400/[0.08] mb-5">
                  <Crown className="w-3 h-3" />
                  <span>Membership</span>
                </div>

                <h2 className="text-2xl sm:text-3xl lg:text-[2rem] font-bold text-white leading-[1.2] mb-3 tracking-tight">
                  Unlock the full experience
                </h2>
                <p className="text-[15px] text-zinc-400 max-w-lg leading-relaxed">
                  Exclusive shows, after-hours episodes, and the complete audiobook library.
                  <span className="text-zinc-500"> Support the creators behind the stories you love.</span>
                </p>
              </div>

              {/* CTA */}
              <div className="flex-shrink-0">
                <Link
                  to={createPageUrl("Premium")}
                  className="group relative inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-sm font-semibold transition-all duration-500 overflow-hidden"
                >
                  {/* Button glow */}
                  <span className="absolute inset-0 bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-500 group-hover:from-amber-400 group-hover:to-amber-500" />
                  <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.15),transparent_70%)]" />
                  <span className="relative flex items-center gap-2.5 text-black">
                    <Crown className="w-4 h-4" />
                    Become a Member
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Members-Only Episodes ───
          The "proof" half of the pitch + proof unit with the promo
          banner above. Randomized mix of samples + gated content; the
          component renders its own skeleton during its internal
          fetches. For premium users the banner above is suppressed, so
          this row simply reads as direct paid-tier content. */}
      <div className="w-full px-2.5 lg:px-10 py-3">
        {isLoading ? (
          <EpisodeRowSkeleton titleWidth="w-56" />
        ) : (
          <MembersOnlyEpisodesRow onAddToPlaylist={openAddToPlaylist} />
        )}
      </div>

      {/* ─── Categories ───
          Lateral browsing pivot. By this point in the page the user
          has signaled they want to explore beyond the curated/popular
          rows; Categories is the natural "by topic" gateway. */}
      <div className="w-full px-2.5 lg:px-10 py-5">
        {isLoading ? <CategoryExplorerSkeleton /> : <CategoryExplorer />}
      </div>

      {/* ─── Audiobooks ─── */}
      <div className="w-full px-2.5 lg:px-10 py-3">
        {isLoading ? (
          <ShowRowSkeleton titleWidth="w-32" />
        ) : (
          <PodcastRow
            title={
              <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-300 bg-clip-text text-transparent">
                Audiobooks
              </h2>
            }
            podcasts={podcasts.filter(p => isAudiobook(p))}
            onPodcastPlay={handleNavigateToShow}
            isCompact={true}
            showAudiobookPill={true}
            viewAllTo={createPageUrl('Audiobooks')}
            subtext={(p) => formatAudiobookRuntime(p)}
          />
        )}
      </div>

      {/* ─── Music ───
          Two-row track-chip grid (not artist cards). Up to 40 tracks
          surfaced; "View all" lands in Discover → Music. Only renders
          if there's actually any music in the catalog. */}
      {(isLoading || podcasts.some(p => isMusic(p))) && (
        <div className="w-full px-2.5 lg:px-10 py-3">
          {isLoading ? (
            <MusicTracksSkeleton />
          ) : (
            <MusicTracksRow
              title={
                <h2 className="text-2xl font-bold bg-gradient-to-r from-fuchsia-400 to-fuchsia-300 bg-clip-text text-transparent">
                  Music
                </h2>
              }
              viewAllTo={`${createPageUrl('Discover')}?tab=Music`}
              maxItems={40}
              onAddToPlaylist={openAddToPlaylist}
            />
          )}
        </div>
      )}

      {/* ─── Members Only Shows ───
          Complements Members-Only Episodes above: episodes are for
          "what to listen to next," shows are for "what to subscribe to
          / save for later." The gap between the two members sections
          (filled with Categories + Audiobooks + Music) avoids a
          three-row "members members members" block while still giving
          paid content two distinct surfaces on the home screen. */}
      <div className="w-full px-2.5 lg:px-10 py-3">
        {isLoading ? (
          <ShowRowSkeleton titleWidth="w-36" />
        ) : (
          <MembersOnlySection
            podcasts={podcasts.filter(p => p.is_exclusive && !isMusic(p))}
            onPodcastPlay={handlePodcastPlay}
            subtext={(p) => formatEpisodeCount(p)}
          />
        )}
      </div>

      {/* ─── Featured Creators ─── */}
      <div className="w-full px-2.5 lg:px-10 py-3 pb-32">
        {isLoading ? (
          <FeaturedCreatorsSkeleton />
        ) : (
          <FeaturedCreatorsSection />
        )}
      </div>
      
      <AnimatePresence>
        {selectedPodcast && (
          <PodcastModal
            podcast={selectedPodcast}
            onClose={() => setSelectedPodcast(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExpandedPlayer && currentPodcast && currentEpisode && (
          <motion.div
            key="podcasts-expanded-player"
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{ position: 'fixed', inset: 0, zIndex: 3000 }}
          >
            <ExpandedPlayer
              podcast={currentPodcast}
              episode={currentEpisode}
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              onToggle={toggle}
              onCollapse={handleCollapsePlayer}
              onClose={handleCloseMobilePlayer}
              onSeek={seek}
              onSkip={skip}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add to Playlist Modal */}
      <AddToPlaylistModal
        isOpen={showAddModal}
        episode={episodeToAdd}
        playlists={playlists}
        onClose={() => { setShowAddModal(false); setEpisodeToAdd(null); }}
        onAdded={({ playlist: pl, action }) => {
          if (action === 'updated' && pl?.id) updatePlaylist(pl);
          // 'created' is already handled by PlaylistContext.addPlaylist
          // inside the modal; nothing more to do here.
        }}
      />

    </div>
  );
}
