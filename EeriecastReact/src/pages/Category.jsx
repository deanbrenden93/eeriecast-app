import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Podcast } from "@/api/entities";
import ShowCard from "../components/discover/ShowCard";
import { hasCategory, isAudiobook } from "@/lib/utils";

export default function CategoryPage() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const categoryParam = (params.get("category") || "").toLowerCase();

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
    if (sel === "free") return allPodcasts.filter(p => !p.is_exclusive);
    if (sel === "members-only" || sel === "members only" || sel === "members_only") return allPodcasts.filter(p => p.is_exclusive);
    return allPodcasts.filter(p => hasCategory(p, sel));
  }, [allPodcasts, categoryParam]);

  const displayName = useMemo(() => {
    if (!categoryParam) return "All";
    return categoryParam.toUpperCase();
  }, [categoryParam]);

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
                    onPlay={() => {}}
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
