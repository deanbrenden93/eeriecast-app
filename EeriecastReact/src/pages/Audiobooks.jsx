import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import BookCard from "@/components/discover/BookCard";
import { isAudiobook, hasCategory } from "@/lib/utils";
import { usePodcasts } from "@/context/PodcastContext.jsx";
import { Category } from "@/api/entities";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { X, ImageIcon } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useFeatureFlag } from "@/lib/featureFlags";
import COMIC_CATALOG from "@/data/comics";
import ComicReader from "@/components/podcasts/ComicReader";
import { useUser } from "@/context/UserContext.jsx";

const selectTriggerClass = "h-8 w-auto min-w-[7rem] gap-1.5 rounded-full border-white/[0.06] bg-white/[0.03] px-3.5 text-xs font-medium text-zinc-300 hover:bg-white/[0.06] hover:border-white/[0.1] hover:text-white focus:ring-0 focus:ring-offset-0 transition-all duration-300 data-[placeholder]:text-zinc-500 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-zinc-500";
const selectContentClass = "border-white/[0.08] bg-[#18181f] shadow-xl shadow-black/40 rounded-lg";
const selectItemClass = "text-xs text-zinc-400 focus:bg-white/[0.06] focus:text-white rounded-md cursor-pointer";

export default function Audiobooks() {
  const location = useLocation();
  const { podcasts: allPodcasts, isLoading } = usePodcasts();
  const { isPremium } = useUser();
  const showComics = useFeatureFlag("comic-reader");
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ category: "all", sort: "newest" });

  // Tab state — only show Comics tab for staff
  const tabs = useMemo(() => {
    const base = ["Audiobooks"];
    if (showComics) base.push("Comics");
    return base;
  }, [showComics]);

  const queryTab = useMemo(() => {
    try {
      const params = new URLSearchParams(location.search);
      const raw = params.get("tab");
      if (!raw) return null;
      return tabs.find((t) => t.toLowerCase() === raw.toLowerCase()) || null;
    } catch {
      return null;
    }
  }, [location.search, tabs]);

  const [activeTab, setActiveTab] = useState(queryTab || "Audiobooks");

  // Comic reader overlay
  const [selectedComic, setSelectedComic] = useState(null);

  // Reset filters when switching tabs
  useEffect(() => {
    setFilters({ category: "all", sort: "newest" });
  }, [activeTab]);

  useEffect(() => {
    (async () => {
      try {
        const resp = await Category.list();
        setCategories(Array.isArray(resp) ? resp : (resp?.results || []));
      } catch { setCategories([]); }
    })();
  }, []);

  const books = useMemo(() => {
    let filtered = allPodcasts.filter(p => isAudiobook(p));

    if (filters.category !== "all") {
      filtered = filtered.filter(p => hasCategory(p, filters.category));
    }

    const copy = [...filtered];
    if (filters.sort === "oldest") {
      copy.sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0));
    } else {
      copy.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
    }
    return copy;
  }, [allPodcasts, filters]);

  const categoryOptions = useMemo(() => [
    { value: "all", label: "All Categories" },
    ...categories.map(c => ({ value: c.slug || c.name, label: c.name })),
  ], [categories]);

  const sortOptions = [
    { value: "newest", label: "Newest" },
    { value: "oldest", label: "Oldest" },
  ];

  /* ─── Audiobooks tab ─────────────────────────────────────── */
  const renderAudiobooksTab = () => (
    <>
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap mb-8">
        <Select value={filters.category} onValueChange={(v) => setFilters(prev => ({ ...prev, category: v }))}>
          <SelectTrigger className={selectTriggerClass}>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className={selectContentClass}>
            {categoryOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className={selectItemClass}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.sort} onValueChange={(v) => setFilters(prev => ({ ...prev, sort: v }))}>
          <SelectTrigger className={selectTriggerClass}>
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent className={selectContentClass}>
            {sortOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className={selectItemClass}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filters.category !== "all" && (
          <button
            onClick={() => setFilters(prev => ({ ...prev, category: "all" }))}
            className="inline-flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            <X className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="aspect-[2/3] bg-eeriecast-surface-light/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">No audiobooks available yet.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {books.map(book => (
            <BookCard key={book.id} podcast={book} />
          ))}
        </div>
      )}
    </>
  );

  /* ─── Comics tab ─────────────────────────────────────────── */
  const renderComicsTab = () => {
    if (COMIC_CATALOG.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-6">
            <ImageIcon className="w-9 h-9 text-zinc-700" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Comics Coming Soon</h2>
          <p className="text-zinc-500 max-w-sm leading-relaxed">
            Horror comics and manga are being crafted. Check back soon.
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
        {COMIC_CATALOG.map((comic) => (
          <button
            key={comic.id}
            type="button"
            onClick={() => setSelectedComic(comic)}
            className="group text-left"
          >
            {/* Cover image or placeholder */}
            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-800/50 to-red-950/30 border border-white/[0.06] mb-2.5 relative">
              {comic.coverImage ? (
                <img
                  src={comic.coverImage}
                  alt={comic.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                  <ImageIcon className="w-10 h-10 text-zinc-700" />
                  <span className="text-[10px] uppercase tracking-widest text-zinc-700 font-semibold">
                    Coming Soon
                  </span>
                </div>
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 rounded-xl" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-200 truncate group-hover:text-white transition-colors">
              {comic.title}
            </h3>
            {comic.subtitle && (
              <p className="text-[11px] text-zinc-600 truncate">{comic.subtitle}</p>
            )}
            {comic.artist && comic.artist !== "TBD" && (
              <p className="text-[11px] text-zinc-600 truncate mt-0.5">
                Art by {comic.artist}
              </p>
            )}
          </button>
        ))}
      </div>
    );
  };

  /* ─── Tab content switch ─────────────────────────────────── */
  const renderContent = () => {
    switch (activeTab) {
      case "Audiobooks":
        return renderAudiobooksTab();
      case "Comics":
        return renderComicsTab();
      default:
        return null;
    }
  };

  /* ─── Header title + subtitle per tab ────────────────────── */
  const headerTitle = activeTab === "Comics" ? "Comics" : "Audiobooks";
  const headerSubtitle =
    activeTab === "Comics"
      ? "Horror comics and manga for paid members"
      : "Listen to or read original horror novels";
  const headerCount =
    activeTab === "Comics" ? COMIC_CATALOG.length : books.length;
  const headerCountLabel =
    activeTab === "Comics"
      ? headerCount === 1
        ? "title"
        : "titles"
      : headerCount === 1
        ? "title"
        : "titles";

  return (
    <div className="min-h-screen bg-eeriecast-surface text-white px-2.5 lg:px-10 py-8">
      {/* Header */}
      <div className="mb-2">
        <div className="flex items-baseline gap-3 mb-1">
          <h1 className="text-4xl md:text-5xl font-bold text-white">{headerTitle}</h1>
          <span className="text-xs text-zinc-600 font-medium tabular-nums">
            {headerCount} {headerCountLabel}
          </span>
        </div>
        <p className="text-zinc-500 text-lg">{headerSubtitle}</p>
      </div>

      {/* Tabs — only render tab bar if there are multiple tabs */}
      {tabs.length > 1 && (
        <div className="mb-8 border-b border-white/[0.06]">
          <div
            className="flex space-x-4 sm:space-x-8 overflow-x-auto pb-px"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-shrink-0 pb-3 text-sm font-medium transition-all duration-300 border-b-2 ${
                  activeTab === tab
                    ? "text-white border-white"
                    : "text-zinc-500 hover:text-white border-transparent"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* When single tab, add spacing where tabs would be */}
      {tabs.length <= 1 && <div className="mb-4" />}

      {/* Content */}
      <div className="pb-32">{renderContent()}</div>

      {/* Comic Reader overlay */}
      <AnimatePresence>
        {selectedComic && (
          <ComicReader
            key="comic-reader"
            comic={selectedComic}
            isPremium={isPremium}
            onClose={() => setSelectedComic(null)}
            onSubscribe={() => setSelectedComic(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
