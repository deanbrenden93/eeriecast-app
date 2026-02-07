import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Podcast as PodcastApi, UserLibrary } from "@/api/entities";
import { isAudiobook, hasCategory } from "@/lib/utils";

// TODO [PRE-LAUNCH]: These frontend overrides for is_exclusive must be migrated to the
// Django backend (set is_exclusive=True on podcast IDs 10 & 4 in the admin panel) and
// this client-side workaround removed. The backend currently returns is_exclusive=false
// for these podcasts despite them being members-only content.
const MEMBERS_ONLY_OVERRIDES = new Set([10, 4]); // After Hours, Manmade Monsters
function applyExclusiveOverrides(list) {
  return list.map(p => (p && MEMBERS_ONLY_OVERRIDES.has(p.id) && !p.is_exclusive) ? { ...p, is_exclusive: true } : p);
}
import { Crown } from "lucide-react";
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
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";
import { AnimatePresence, motion } from "framer-motion";
import { useUser } from "@/context/UserContext.jsx";
import { usePodcasts } from "@/context/PodcastContext.jsx";

export default function Podcasts() {
  const { podcasts: rawPodcasts, isLoading } = usePodcasts();
  const podcasts = useMemo(() => applyExclusiveOverrides(rawPodcasts), [rawPodcasts]);
  const [keepListeningItems, setKeepListeningItems] = useState([]); // { podcast, episode, progress (0-100) }
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

  const { isPremium, episodeProgressMap } = useUser();

  // Build "Keep Listening" items from the real-time episodeProgressMap.
  // This picks up both server-side history and current-session plays.
  useEffect(() => {
    if (!podcasts.length) { setKeepListeningItems([]); return; }
    const podcastMap = new Map(podcasts.map(p => [p.id, p]));

    // Also merge with localStorage recentlyPlayed for ordering
    const recentPodcastIds = JSON.parse(localStorage.getItem('recentlyPlayed') || '[]');

    // Build items from episodeProgressMap (partially played episodes)
    const items = [];
    if (episodeProgressMap && episodeProgressMap.size > 0) {
      // We need episode details, but the map only has IDs + progress.
      // Scan podcast episodes to find matches.
      for (const p of podcasts) {
        const eps = Array.isArray(p.episodes) ? p.episodes : [];
        for (const ep of eps) {
          const prog = episodeProgressMap.get(Number(ep.id));
          if (prog && prog.progress > 0 && !prog.completed) {
            const pct = prog.duration > 0 ? Math.min(100, (prog.progress / prog.duration) * 100) : 0;
            if (pct > 0 && pct < 95) {
              items.push({
                podcast: p,
                episode: ep,
                progress: pct,
                resumeData: { progress: prog.progress },
              });
            }
          }
        }
      }
    }

    // Also fetch from resume API for episodes not in local podcasts data
    let cancelled = false;
    (async () => {
      const apiItems = [];
      for (const pid of recentPodcastIds.slice(0, 8)) {
        const p = podcastMap.get(pid);
        if (!p) continue;
        // Check if we already have a progress item for this podcast
        if (items.some(item => item.podcast.id === pid)) continue;
        try {
          const resume = await UserLibrary.resumeForPodcast(p.id);
          if (resume?.episode_detail) {
            const ep = resume.episode_detail;
            const progressSec = Math.max(0, Number(resume?.progress || 0));
            const dur = Math.max(0, Number(ep?.duration || resume?.duration || 0));
            let pct = 0;
            if (dur > 0) pct = Math.min(100, (progressSec / dur) * 100);
            if (pct > 0 && pct < 95) {
              apiItems.push({
                podcast: ep.podcast && typeof ep.podcast === 'object' ? { ...p, ...ep.podcast } : p,
                episode: ep,
                progress: pct,
                resumeData: resume,
              });
            }
          }
        } catch { /* not authenticated or not available */ }
      }

      if (!cancelled) {
        const all = [...items, ...apiItems];
        // Deduplicate by episode id
        const seen = new Set();
        const unique = all.filter(item => {
          if (!item.episode?.id) return false;
          if (seen.has(item.episode.id)) return false;
          seen.add(item.episode.id);
          return true;
        });
        // Sort: most recently played first (higher progress = more recent activity)
        unique.sort((a, b) => (b.progress || 0) - (a.progress || 0));
        setKeepListeningItems(unique.slice(0, 15));
      }
    })();
    return () => { cancelled = true; };
  }, [podcasts, episodeProgressMap]);

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
        navigate(createPageUrl('Premium'));
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
        <div className="w-full px-2.5 lg:px-10 py-3">
          <LoadingSkeleton height="h-[180px]" />
        </div>
      ) : (
        keepListeningItems.length > 0 && (
          <div className="w-full px-2.5 lg:px-10 py-3">
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

      {/* For You — episodes from podcasts the user has listened to */}
      {!isLoading && keepListeningItems.length > 0 && (
        <div className="w-full px-2.5 lg:px-10 py-3">
          <NewReleasesRow
            title={<h2 className="text-2xl font-bold text-white">For You</h2>}
            viewAllTo={`${createPageUrl('Discover')}?tab=Recommended`}
            categoryFilter={null}
          />
        </div>
      )}

      {/* Trending — episodes sorted by popularity */}
      {isLoading ? (
        <div className="w-full px-2.5 lg:px-10 py-3">
          <LoadingSkeleton height="h-[300px]" />
        </div>
      ) : (
        <div className="w-full px-2.5 lg:px-10 py-3">
          <NewReleasesRow
            title={<h2 className="text-2xl font-bold text-white">Trending Now</h2>}
            viewAllTo={`${createPageUrl('Discover')}?tab=Trending`}
            ordering="-play_count"
          />
        </div>
      )}

      {/* New Releases — latest episodes across all non-audiobook podcasts */}
      {isLoading ? (
        <div className="w-full px-2.5 lg:px-10 py-3">
          <LoadingSkeleton height="h-[300px]" />
        </div>
      ) : (
        <div className="w-full px-2.5 lg:px-10 py-3">
          <NewReleasesRow
            title={<h2 className="text-2xl font-bold text-white">New Releases{selectedCategoryParam ? ` — ${selectedCategoryParam}` : ''}</h2>}
            viewAllTo={`${createPageUrl('Discover')}?tab=Newest`}
            categoryFilter={selectedCategoryParam || null}
          />
        </div>
      )}

      {/* Categories */}
      <div className="w-full px-2.5 lg:px-10 py-5">
        {isLoading ? <LoadingSkeleton /> : <CategoryExplorer />}
      </div>

      {/* Audiobooks */}
      {isLoading ? (
        <div className="w-full px-2.5 lg:px-10 py-3">
          <LoadingSkeleton />
        </div>
      ) : (
        <div className="w-full px-2.5 lg:px-10 py-3">
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
        <div className="w-full px-2.5 lg:px-10 py-3">
          <LoadingSkeleton height="h-[300px]" />
        </div>
      ) : (
        <div className="w-full px-2.5 lg:px-10 py-3">
          <MembersOnlySection
            podcasts={podcasts.filter(p => p.is_exclusive)}
            onPodcastPlay={handlePodcastPlay}
          />
        </div>
      )}

      {/* ─── Membership promo banner (non-premium users only) ─── */}
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

      {/* All Shows */}
      {isLoading ? (
        <div className="w-full px-2.5 lg:px-10 py-3">
          <LoadingSkeleton height="h-[300px]" />
        </div>
      ) : (
        <div className="w-full px-2.5 lg:px-10 py-3 pb-32">
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

    </div>
  );
}
