import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Podcast as PodcastApi, UserLibrary, Episode } from "@/api/entities";
import { getEpisodeAudioUrl, isAudiobook, hasCategory } from "@/lib/utils";
import PodcastModal from "../components/podcasts/PodcastModal";
import FeaturedHero from "../components/podcasts/FeaturedHero";
import CategoryExplorer from "../components/podcasts/CategoryExplorer";
import PodcastRow from "../components/podcasts/PodcastRow";
import KeepListeningSection from "../components/podcasts/KeepListeningSection";
import MembersOnlySection from "../components/podcasts/MembersOnlySection";
import FeaturedCreatorsSection from "../components/podcasts/FeaturedCreatorsSection";
import ExpandedPlayer from "../components/podcasts/ExpandedPlayer";
import SubscribeModal from "@/components/auth/SubscribeModal";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";
import { useUser } from "@/context/UserContext.jsx";
import { usePodcasts } from "@/context/PodcastContext.jsx";

export default function Podcasts() {
  const { podcasts, isLoading } = usePodcasts();
  const [keepListening, setKeepListening] = useState([]);
  const [selectedPodcast, setSelectedPodcast] = useState(null);
  const [showExpandedPlayer, setShowExpandedPlayer] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [subscribeLabel, setSubscribeLabel] = useState("");
  const [keepListeningProgress, setKeepListeningProgress] = useState({});

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
    // new: queue api
    setPlaybackQueue,
  } = useAudioPlayerContext();

  const { isPremium } = useUser();

  // Compute Keep Listening from localStorage when podcasts change
  useEffect(() => {
    const recentlyPlayedIds = JSON.parse(localStorage.getItem('recentlyPlayed') || '[]');
    if (!recentlyPlayedIds.length) { setKeepListening([]); return; }
    const map = new Map(podcasts.map(p => [p.id, p]));
    const list = recentlyPlayedIds.map(id => map.get(id)).filter(Boolean);
    setKeepListening(list);
  }, [podcasts]);

  // Compute real progress percentages for Keep Listening podcasts using resumeForPodcast
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!keepListening.length) { setKeepListeningProgress({}); return; }
      const entries = await Promise.all(
        keepListening.map(async (p) => {
          try {
            const resume = await UserLibrary.resumeForPodcast(p.id);
            const progress = Math.max(0, Number(resume?.progress || resume?.percent_complete || 0));
            const dur = Math.max(0, Number(resume?.episode_detail?.duration || resume?.duration || 0));
            let percent = 0;
            if (dur > 0) percent = Math.min(100, (progress / dur) * 100);
            else if (resume?.percent_complete) percent = Math.min(100, Number(resume.percent_complete));
            return [p.id, percent];
          } catch { return [p.id, 0]; }
        })
      );
      if (!cancelled) {
        const map = Object.fromEntries(entries);
        setKeepListeningProgress(map);
      }
    })();
    return () => { cancelled = true; };
  }, [keepListening]);

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
      // For audiobooks: ALWAYS navigate to the show's page per client request
      if (isAudiobook(podcast)) {
        handleAudiobookNavigate(podcast);
        return;
      }

      // For members-only shows: allow browsing by navigating to Episodes page for non-premium users
      if (podcast?.is_exclusive && !isPremium) {
        if (podcast?.id) navigate(`${createPageUrl('Episodes')}?id=${encodeURIComponent(podcast.id)}`);
        return;
      }

      // Ensure we have episodes: prefer embedded, optionally fetch detail (fallback)
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
        // Prefer the full episode object to include audio URLs and metadata
        const found = episodes.find(e => e.id === resumeEp.id);
        ep = found ? { ...found, ...resumeEp } : resumeEp;
      } else {
        ep = episodes[0];
      }

      if (!ep) return;

      // If audio URL is missing, hydrate from episode detail API
      if (!getEpisodeAudioUrl(ep) && ep?.id) {
        try {
          const fullEp = await Episode.get(ep.id);
          ep = fullEp || ep;
        } catch { /* ignore */ }
      }

      if (ep?.is_premium && !isPremium) {
        setSubscribeLabel(ep?.title || podcast?.title || 'Premium episode');
        setShowSubscribeModal(true);
        return;
      }

      // Start playback; loadAndPlay will set podcast/episode state atomically
      await loadAndPlay({ podcast, episode: ep, resume });

      // Update Keep Listening order
      const recentlyPlayedIds = JSON.parse(localStorage.getItem('recentlyPlayed') || '[]');
      const newIds = [podcast.id, ...recentlyPlayedIds.filter(id => id !== podcast.id)].slice(0, 10);
      localStorage.setItem('recentlyPlayed', JSON.stringify(newIds));
      const map = new Map(podcasts.map(p => [p.id, p]));
      setKeepListening(newIds.map(id => map.get(id)).filter(Boolean));
    } catch (err) {
      console.error('Failed to start playback:', err);
    }
  };

  // Minimal: for Audiobooks section, clicking a card should navigate to Episodes page (no autoplay)
  const handleAudiobookNavigate = (podcast) => {
    if (podcast?.id) {
      navigate(`${createPageUrl('Episodes')}?id=${encodeURIComponent(podcast.id)}`);
    }
  };

  // New: build a global queue from Keep Listening and start playing from the first item
  const handleStartListening = async () => {
    try {
      if (!Array.isArray(keepListening) || keepListening.length === 0) {
        // Fallback to hero podcast if Keep Listening is empty
        if (heroPodcast) {
          await handlePodcastPlay(heroPodcast);
        }
        return;
      }

      // Build queue items in parallel (respect gating)
      const items = await Promise.all(
        keepListening.map(async (p) => {
          try {
            if (p?.is_exclusive && !isPremium) return null; // skip gated podcast
            // ensure episodes available
            let episodes = Array.isArray(p.episodes) ? p.episodes : [];
            if (!episodes.length) {
              const detail = await PodcastApi.get(p.id);
              episodes = Array.isArray(detail?.episodes) ? detail.episodes : [];
            }
            // resume preferred
            let resume;
            try { resume = await UserLibrary.resumeForPodcast(p.id); } catch { resume = null; }
            let ep;
            const resumeEp = resume && resume.episode_detail;
            if (resumeEp) {
              const found = episodes.find(e => e.id === resumeEp.id);
              ep = found ? { ...found, ...resumeEp } : resumeEp;
            } else {
              ep = episodes[0] || null;
            }
            if (!ep) return null;
            // hydrate missing audio URL
            if (!getEpisodeAudioUrl(ep) && ep?.id) {
              try {
                const fullEp = await Episode.get(ep.id);
                ep = fullEp || ep;
              } catch { /* ignore */ }
            }
            // gate premium episodes for non-premium users
            if (ep?.is_premium && !isPremium) return null;
            return { podcast: p, episode: ep, resume };
          } catch {
            return null;
          }
        })
      );

      const filtered = items.filter(Boolean);
      if (!filtered.length) {
        // Fallback: nothing playable in Keep Listening, try hero podcast
        if (heroPodcast) {
          await handlePodcastPlay(heroPodcast);
        }
        return;
      }

      // Set global queue and start at 0
      await setPlaybackQueue(filtered, 0);
    } catch (e) {
      console.error('Failed to start listening queue', e);
    }
  };

  const handleCloseMobilePlayer = () => { pause(); };
  const handleCollapsePlayer = () => setShowExpandedPlayer(false);

  return (
    <div className="min-h-screen bg-black w-full">
      {/* Hero Section - Full Width */}
      {isLoading ? (
        <div className="h-[60vh] w-full bg-gray-900/50" />
      ) : (
        heroPodcast && <FeaturedHero podcast={heroPodcast} onPlay={handleStartListening} />
      )}

      {/* Keep Listening Section - Small Cards */}
      {isLoading ? (
        <div className="w-full bg-black px-2.5 lg:px-10 py-8">
          <div className="h-[180px] w-full bg-gray-900/50 rounded-lg" />
        </div>
      ) : (
        keepListening.length > 0 && (
          <div className="w-full bg-black px-2.5 lg:px-10 py-8">
            <KeepListeningSection
              podcasts={keepListening}
              onPodcastPlay={handlePodcastPlay}
              currentPodcastId={currentPodcast?.id}
              currentTime={currentTime}
              currentDuration={duration}
              progressMap={keepListeningProgress}
            />
          </div>
        )
      )}

      {/* Categories Section - Full Width Background with 40px Padding */}
      <div className="w-full bg-black px-2.5 lg:px-10 py-16">
        {isLoading ? (
          <div className="h-[200px] w-full bg-gray-900/50 rounded-lg" />
        ) : (
          <CategoryExplorer />
        )}
      </div>
      
      {/* New Releases Section - Large Cards */}
      {isLoading ? (
        <div className="w-full bg-black px-2.5 lg:px-10 py-8">
          <div className="h-[300px] w-full bg-gray-900/50 rounded-lg" />
        </div>
      ) : (
        <div className="w-full bg-black px-2.5 lg:px-10 py-8">
          <PodcastRow
            title={<h2 className="text-2xl font-bold text-white">New Releases{selectedCategoryParam ? ` — ${selectedCategoryParam}` : ''}</h2>}
            podcasts={visiblePodcasts}
            onPodcastPlay={handlePodcastPlay}
            viewAllTo={`${createPageUrl('Discover')}?tab=Trending`}
          />
        </div>
      )}

      {/* Audiobooks Section */}
      {isLoading ? (
        <div className="w-full bg-black px-2.5 lg:px-10 py-8">
          <div className="h-[200px] w-full bg-gray-900/50 rounded-lg" />
        </div>
      ) : (
        <div className="w-full bg-black px-2.5 lg:px-10 py-8">
          <PodcastRow
            title={
              <h2 className="text-2xl font-bold bg-gradient-to-br from-blue-500 to-blue-400 bg-clip-text text-transparent">
                📚 Audiobooks
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

      {/* Members Only Section */}
      {isLoading ? (
        <div className="w-full bg-black px-2.5 lg:px-10 py-8">
          <div className="h-[300px] w-full bg-gray-900/50 rounded-lg" />
        </div>
      ) : (
        <div className="w-full bg-black px-2.5 lg:px-10 py-8">
          <MembersOnlySection
            podcasts={podcasts.filter(p => p.is_exclusive)}
            onPodcastPlay={handlePodcastPlay}
          />
        </div>
      )}

      {/* Trending Now Section */}
      {isLoading ? (
        <div className="w-full bg-black px-2.5 lg:px-10 py-8">
          <div className="h-[300px] w-full bg-gray-900/50 rounded-lg" />
        </div>
      ) : (
        <div className="w-full bg-black px-2.5 lg:px-10 py-8">
          <PodcastRow
            title={<h2 className="text-2xl font-bold text-white">Trending Now</h2>}
            podcasts={podcasts.filter(p => p.is_trending)}
            onPodcastPlay={handlePodcastPlay}
            showPlayIcon={true}
            viewAllTo={`${createPageUrl('Discover')}?tab=Trending`}
          />
        </div>
      )}

      {/* Featured Creators Section */}
      {isLoading ? (
        <div className="w-full bg-black px-2.5 lg:px-10 py-8">
          <div className="h-[300px] w-full bg-gray-900/50 rounded-lg" />
        </div>
      ) : (
        <div className="w-full bg-black px-2.5 lg:px-10 py-8 pb-32">
          <FeaturedCreatorsSection />
        </div>
      )}
      
      {selectedPodcast && (
        <PodcastModal
          podcast={selectedPodcast}
          onClose={() => setSelectedPodcast(null)}
        />
      )}

      {/* Expanded Player */}
      {showExpandedPlayer && currentPodcast && currentEpisode && (
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
      )}

      {/* Subscribe / Premium gating modal */}
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
