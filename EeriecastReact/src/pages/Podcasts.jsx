import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Podcast as PodcastApi, UserLibrary } from "@/api/entities";
import { isAudiobook, hasCategory } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import PodcastModal from "../components/podcasts/PodcastModal";
import FeaturedHero from "../components/podcasts/FeaturedHero";
import CategoryExplorer from "../components/podcasts/CategoryExplorer";
import PodcastRow from "../components/podcasts/PodcastRow";
import NewReleasesRow from "../components/podcasts/NewReleasesRow";
import KeepListeningSection from "../components/podcasts/KeepListeningSection";
import MembersOnlySection from "../components/podcasts/MembersOnlySection";
import FeaturedCreatorsSection from "../components/podcasts/FeaturedCreatorsSection";
import ExpandedPlayer from "../components/podcasts/ExpandedPlayer";
import SubscribeModal from "@/components/auth/SubscribeModal";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";
import { AnimatePresence, motion } from "framer-motion";
import { useUser } from "@/context/UserContext.jsx";
import { usePodcasts } from "@/context/PodcastContext.jsx";

export default function Podcasts() {
  const { podcasts, isLoading } = usePodcasts();
  const [keepListeningItems, setKeepListeningItems] = useState([]); // { podcast, episode, progress (0-100) }
  const [selectedPodcast, setSelectedPodcast] = useState(null);
  const [showExpandedPlayer, setShowExpandedPlayer] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [subscribeLabel, setSubscribeLabel] = useState("");

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

  const { isPremium } = useUser();

  // Build episode-level "keep listening" items from localStorage + resume API
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const recentlyPlayedIds = JSON.parse(localStorage.getItem('recentlyPlayed') || '[]');
      if (!recentlyPlayedIds.length || !podcasts.length) { setKeepListeningItems([]); return; }

      const podcastMap = new Map(podcasts.map(p => [p.id, p]));
      const recentPodcasts = recentlyPlayedIds.map(id => podcastMap.get(id)).filter(Boolean);

      const items = await Promise.all(
        recentPodcasts.map(async (p) => {
          try {
            // Try the resume API first (authenticated users with server-side history)
            let resume = null;
            try { resume = await UserLibrary.resumeForPodcast(p.id); } catch { /* no history or not logged in */ }

            if (resume?.episode_detail) {
              const ep = resume.episode_detail;
              const progressSec = Math.max(0, Number(resume?.progress || 0));
              const dur = Math.max(0, Number(ep?.duration || resume?.duration || 0));
              let percent = 0;
              if (dur > 0) percent = Math.min(100, (progressSec / dur) * 100);
              else if (resume?.percent_complete) percent = Math.min(100, Number(resume.percent_complete));

              return {
                podcast: ep.podcast && typeof ep.podcast === 'object' ? { ...p, ...ep.podcast } : p,
                episode: ep,
                progress: percent,
                resumeData: resume,
              };
            }

            // Fallback: fetch podcast detail to get its first episode
            let episodes = Array.isArray(p.episodes) ? p.episodes : [];
            if (!episodes.length) {
              try {
                const detail = await PodcastApi.get(p.id);
                episodes = Array.isArray(detail?.episodes) ? detail.episodes : (detail?.episodes?.results || []);
              } catch { /* ignore */ }
            }
            const firstEp = episodes[0];
            if (!firstEp) return null;

            return {
              podcast: p,
              episode: firstEp,
              progress: 0,
              resumeData: null,
            };
          } catch { return null; }
        })
      );

      if (!cancelled) {
        // Deduplicate by episode id (keep first occurrence)
        const seen = new Set();
        const unique = items.filter(Boolean).filter(item => {
          if (!item.episode?.id) return false;
          if (seen.has(item.episode.id)) return false;
          seen.add(item.episode.id);
          return true;
        });
        setKeepListeningItems(unique);
      }
    })();
    return () => { cancelled = true; };
  }, [podcasts]);

  const visiblePodcasts = useMemo(() => {
    const items = podcasts;
    const selected = selectedCategoryParam;
    if (!selected) return items;
    if (selected === 'audiobook' || selected === 'audiobooks') return items.filter(p => isAudiobook(p));
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
      if (isAudiobook(podcast)) {
        handleAudiobookNavigate(podcast);
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
        setSubscribeLabel(ep?.title || podcast?.title || 'Premium episode');
        setShowSubscribeModal(true);
        return;
      }
      await loadAndPlay({ podcast, episode: ep, resume });
      // Update localStorage recently played
      const recentlyPlayedIds = JSON.parse(localStorage.getItem('recentlyPlayed') || '[]');
      const newIds = [podcast.id, ...recentlyPlayedIds.filter(id => id !== podcast.id)].slice(0, 10);
      localStorage.setItem('recentlyPlayed', JSON.stringify(newIds));
      // Add this episode to the keep listening items immediately
      setKeepListeningItems(prev => {
        const newItem = { podcast, episode: ep, progress: 0, resumeData: resume };
        const filtered = prev.filter(item => item.episode?.id !== ep.id);
        return [newItem, ...filtered];
      });
    } catch (err) {
      console.error('Failed to start playback:', err);
    }
  };

  const handleAudiobookNavigate = (podcast) => {
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

  // Skeleton loading block
  const LoadingSkeleton = ({ height = "h-[200px]" }) => (
    <div className={`${height} w-full bg-eeriecast-surface-light/50 rounded-xl animate-pulse`} />
  );

  return (
    <div className="min-h-screen bg-eeriecast-surface w-full">
      {/* Hero */}
      {isLoading ? (
        <div className="h-[60vh] w-full bg-eeriecast-surface-light/30" />
      ) : (
        heroPodcast && <FeaturedHero podcast={heroPodcast} onPlay={handleStartListening} />
      )}

      {/* Keep Listening */}
      {isLoading ? (
        <div className="w-full px-2.5 lg:px-10 py-8">
          <LoadingSkeleton height="h-[180px]" />
        </div>
      ) : (
        keepListeningItems.length > 0 && (
          <div className="w-full px-2.5 lg:px-10 py-8">
            <KeepListeningSection
              items={keepListeningItems}
              onEpisodePlay={async (item) => {
                const played = await loadAndPlay({ podcast: item.podcast, episode: item.episode, resume: item.resumeData || { progress: 0 } });
                if (played === false) {
                  toast({ title: "Unable to play", description: "Please sign in to play episodes.", variant: "destructive" });
                }
              }}
              currentEpisodeId={currentEpisode?.id}
              currentTime={currentTime}
              currentDuration={duration}
            />
          </div>
        )
      )}

      {/* Categories */}
      <div className="w-full px-2.5 lg:px-10 py-12">
        {isLoading ? <LoadingSkeleton /> : <CategoryExplorer />}
      </div>
      
      {/* New Releases — latest episodes across all non-audiobook podcasts */}
      {isLoading ? (
        <div className="w-full px-2.5 lg:px-10 py-8">
          <LoadingSkeleton height="h-[300px]" />
        </div>
      ) : (
        <div className="w-full px-2.5 lg:px-10 py-8">
          <NewReleasesRow
            title={<h2 className="text-2xl font-bold text-white">New Releases{selectedCategoryParam ? ` — ${selectedCategoryParam}` : ''}</h2>}
            viewAllTo={`${createPageUrl('Discover')}?tab=Trending`}
            categoryFilter={selectedCategoryParam || null}
          />
        </div>
      )}

      {/* Audiobooks */}
      {isLoading ? (
        <div className="w-full px-2.5 lg:px-10 py-8">
          <LoadingSkeleton />
        </div>
      ) : (
        <div className="w-full px-2.5 lg:px-10 py-8">
          <PodcastRow
            title={
              <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-300 bg-clip-text text-transparent">
                Audiobooks
              </h2>
            }
            podcasts={podcasts.filter(p => isAudiobook(p))}
            onPodcastPlay={handleAudiobookNavigate}
            isCompact={true}
            showAudiobookPill={true}
            viewAllTo={`${createPageUrl('Discover')}?tab=Books`}
            subtext={(p) => {
              const n = p?.episodes_count ?? p?.episode_count ?? 0;
              return n > 0 ? `${n} Chapter${n === 1 ? '' : 's'}` : '';
            }}
          />
        </div>
      )}

      {/* Members Only */}
      {isLoading ? (
        <div className="w-full px-2.5 lg:px-10 py-8">
          <LoadingSkeleton height="h-[300px]" />
        </div>
      ) : (
        <div className="w-full px-2.5 lg:px-10 py-8">
          <MembersOnlySection
            podcasts={podcasts.filter(p => p.is_exclusive)}
            onPodcastPlay={handlePodcastPlay}
          />
        </div>
      )}

      {/* Trending */}
      {isLoading ? (
        <div className="w-full px-2.5 lg:px-10 py-8">
          <LoadingSkeleton height="h-[300px]" />
        </div>
      ) : (
        <div className="w-full px-2.5 lg:px-10 py-8">
          <PodcastRow
            title={<h2 className="text-2xl font-bold text-white">Trending Now</h2>}
            podcasts={podcasts.filter(p => p.is_trending)}
            onPodcastPlay={handlePodcastPlay}
            showPlayIcon={true}
            viewAllTo={`${createPageUrl('Discover')}?tab=Trending`}
          />
        </div>
      )}

      {/* Featured Creators */}
      {isLoading ? (
        <div className="w-full px-2.5 lg:px-10 py-8">
          <LoadingSkeleton height="h-[300px]" />
        </div>
      ) : (
        <div className="w-full px-2.5 lg:px-10 py-8 pb-32">
          <FeaturedCreatorsSection />
        </div>
      )}
      
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

      <SubscribeModal
        open={showSubscribeModal}
        onOpenChange={setShowSubscribeModal}
        itemLabel={subscribeLabel}
        title="Subscribe to listen"
        message="This content is available to members only. Subscribe to unlock all premium shows and episodes."
      />
    </div>
  );
}
