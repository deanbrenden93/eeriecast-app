import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Podcast, Episode, UserLibrary } from "@/api/entities";
import ShowCard from "../components/discover/ShowCard";
import { hasCategory, isAudiobook, isMusic, getEpisodeAudioUrl } from "@/lib/utils";
import { createPageUrl } from "@/utils";
import { useUser } from "@/context/UserContext.jsx";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";

export default function CategoryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const categoryParam = (params.get("category") || "").toLowerCase();
  const { isPremium } = useUser();
  const { loadAndPlay } = useAudioPlayerContext();

  const [allPodcasts, setAllPodcasts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const resp = await Podcast.list("-created_date");
      const list = Array.isArray(resp) ? resp : (resp?.results || []);
      setAllPodcasts(list);
      setIsLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const sel = categoryParam;
    if (!sel) return allPodcasts;
    if (sel === "audiobook" || sel === "audiobooks") return allPodcasts.filter(p => isAudiobook(p));
    if (sel === "music") return allPodcasts.filter(p => isMusic(p));
    if (sel === "free") return allPodcasts.filter(p => !p.is_exclusive);
    if (sel === "members-only" || sel === "members only" || sel === "members_only") return allPodcasts.filter(p => p.is_exclusive);
    return allPodcasts.filter(p => hasCategory(p, sel));
  }, [allPodcasts, categoryParam]);

  const displayName = useMemo(() => {
    if (!categoryParam) return "All";
    return categoryParam.toUpperCase();
  }, [categoryParam]);

  const handlePodcastPlay = async (podcast) => {
    try {
      if (!podcast?.id) return;
      // Audiobooks and members-only shows for non-premium users: route to show page.
      if (isAudiobook(podcast) || isMusic(podcast) || (podcast?.is_exclusive && !isPremium)) {
        navigate(`${createPageUrl('Episodes')}?id=${encodeURIComponent(podcast.id)}`);
        return;
      }
      let episodes = Array.isArray(podcast.episodes) ? podcast.episodes : [];
      if (!episodes.length) {
        const detail = await Podcast.get(podcast.id);
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
      if (!getEpisodeAudioUrl(ep) && ep?.id) {
        try { const fullEp = await Episode.get(ep.id); ep = fullEp || ep; } catch { /* ignore */ }
      }
      if (ep?.is_premium && !isPremium) {
        navigate(createPageUrl('Premium'));
        return;
      }
      await loadAndPlay({ podcast, episode: ep, resume });
    } catch (e) {
      if (typeof console !== 'undefined') console.debug('category play failed', e);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white px-2.5 lg:px-10 py-8">
      {/* Header - match Discover styling */}
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-white via-pink-400 to-purple-500 bg-clip-text text-transparent">
          {displayName}
        </h1>
        <p className="text-gray-400 text-lg">Explore our collection for this category</p>
      </div>

      {/* Content */}
      <div className="pb-32">
        {isLoading ? (
          <div className="text-white text-center py-10">Loading content...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400">No podcasts found in this category.</div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">{displayName} Podcasts</h2>
              <span className="text-sm text-gray-400">{filtered.length} shows</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4">
              {filtered.map((podcast) => {
                const n = podcast?.episodes_count ?? podcast?.episode_count ?? 0;
                const subtext = n > 0 ? `${n} Episode${n === 1 ? '' : 's'}` : '';
                return (
                  <ShowCard
                    key={podcast.id}
                    podcast={podcast}
                    onPlay={handlePodcastPlay}
                    subtext={subtext}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
