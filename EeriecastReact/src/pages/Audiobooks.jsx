import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import BookCard from "@/components/discover/BookCard";
import { isAudiobook, hasCategory } from "@/lib/utils";
import { usePodcasts } from "@/context/PodcastContext.jsx";
import { useUser } from "@/context/UserContext.jsx";
import { Category } from "@/api/entities";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { X, BookOpen, Image, Crown, Lock } from "lucide-react";
import COMIC_CATALOG from "@/data/comics";
import ComicReader from "@/components/podcasts/ComicReader";
import { createPageUrl } from "@/utils";

const selectTriggerClass = "h-8 w-auto min-w-[7rem] gap-1.5 rounded-full border-white/[0.06] bg-white/[0.03] px-3.5 text-xs font-medium text-zinc-300 hover:bg-white/[0.06] hover:border-white/[0.1] hover:text-white focus:ring-0 focus:ring-offset-0 transition-all duration-300 data-[placeholder]:text-zinc-500 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-zinc-500";
const selectContentClass = "border-white/[0.08] bg-[#18181f] shadow-xl shadow-black/40 rounded-lg";
const selectItemClass = "text-xs text-zinc-400 focus:bg-white/[0.06] focus:text-white rounded-md cursor-pointer";

const TABS = [
  { id: "audiobooks", label: "Audiobooks", icon: BookOpen },
  { id: "comics", label: "Comics", icon: Image },
];

// ─── Comics Tab ──────────────────────────────────────────────────────────────
function ComicsTab() {
  const { isPremium } = useUser();
  const navigate = useNavigate();
  const [activeComic, setActiveComic] = useState(null);

  const handleComicClick = (comic) => {
    if (!isPremium) {
      navigate(createPageUrl("Premium"));
      return;
    }
    setActiveComic(comic);
  };

  return (
    <>
      {COMIC_CATALOG.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">No comics available yet.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {COMIC_CATALOG.map((comic) => (
            <button
              key={comic.id}
              type="button"
              onClick={() => handleComicClick(comic)}
              className="group text-left transition-all duration-300"
            >
              <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-eeriecast-surface-light mb-2">
                {comic.coverImage ? (
                  <img
                    src={comic.coverImage}
                    alt={comic.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-eeriecast-surface-light to-eeriecast-surface-lighter">
                    <Image className="w-8 h-8 text-zinc-700 mb-2" />
                    <span className="text-[10px] text-zinc-700 font-medium uppercase tracking-wider">Coming Soon</span>
                  </div>
                )}

                {!isPremium && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-amber-500/20">
                    <Crown className="w-3 h-3 text-amber-400" />
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>

              <h3 className="text-sm font-semibold text-zinc-200 truncate group-hover:text-white transition-colors">
                {comic.title}
              </h3>
              {comic.subtitle && (
                <p className="text-xs text-zinc-600 truncate">{comic.subtitle}</p>
              )}
              <p className="text-[11px] text-zinc-600 mt-0.5">
                {comic.chapters?.length || 0} {(comic.chapters?.length || 0) === 1 ? "chapter" : "chapters"}
                {!isPremium && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-500/70">
                    <Lock className="w-2.5 h-2.5" /> Members
                  </span>
                )}
              </p>
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {activeComic && (
          <ComicReader
            key="comicreader"
            comic={activeComic}
            isPremium={isPremium}
            onClose={() => setActiveComic(null)}
            onSubscribe={() => {
              setActiveComic(null);
              navigate(createPageUrl("Premium"));
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Audiobooks Tab ──────────────────────────────────────────────────────────
function AudiobooksTab() {
  const { podcasts: allPodcasts, isLoading } = usePodcasts();
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ category: "all", sort: "newest" });

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

  return (
    <>
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
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
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function Audiobooks() {
  const [activeTab, setActiveTab] = useState("audiobooks");

  return (
    <div className="min-h-screen bg-eeriecast-surface text-white px-2.5 lg:px-10 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-1">Books</h1>
        <p className="text-zinc-500 text-lg">Original horror novels and comics</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-white/[0.04] pb-px">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-300 rounded-t-lg ${
                isActive
                  ? "text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="books-tab-indicator"
                  className="absolute bottom-0 left-2 right-2 h-[2px] bg-red-500 rounded-full"
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="pb-32">
        <AnimatePresence mode="wait">
          {activeTab === "audiobooks" && (
            <motion.div
              key="audiobooks"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <AudiobooksTab />
            </motion.div>
          )}
          {activeTab === "comics" && (
            <motion.div
              key="comics"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <ComicsTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
