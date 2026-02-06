import { useState, useEffect, useMemo } from "react";
import BookCard from "@/components/discover/BookCard";
import { isAudiobook, hasCategory } from "@/lib/utils";
import { usePodcasts } from "@/context/PodcastContext.jsx";
import { Category } from "@/api/entities";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { X } from "lucide-react";

const selectTriggerClass = "h-8 w-auto min-w-[7rem] gap-1.5 rounded-full border-white/[0.06] bg-white/[0.03] px-3.5 text-xs font-medium text-zinc-300 hover:bg-white/[0.06] hover:border-white/[0.1] hover:text-white focus:ring-0 focus:ring-offset-0 transition-all duration-300 data-[placeholder]:text-zinc-500 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-zinc-500";
const selectContentClass = "border-white/[0.08] bg-[#18181f] shadow-xl shadow-black/40 rounded-lg";
const selectItemClass = "text-xs text-zinc-400 focus:bg-white/[0.06] focus:text-white rounded-md cursor-pointer";

export default function Audiobooks() {
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
    <div className="min-h-screen bg-eeriecast-surface text-white px-2.5 lg:px-10 py-8">
      {/* Unified header */}
      <div className="mb-8">
        <div className="flex items-baseline gap-3 mb-1">
          <h1 className="text-4xl md:text-5xl font-bold text-white">Audiobooks</h1>
          <span className="text-xs text-zinc-600 font-medium tabular-nums">{books.length} {books.length === 1 ? 'title' : 'titles'}</span>
        </div>
        <p className="text-zinc-500 text-lg mb-4">Original horror novels, narrated for your ears</p>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
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
      </div>

      {/* Content */}
      <div className="pb-32">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="aspect-[3/4] bg-eeriecast-surface-light/50 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">No audiobooks available yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {books.map(book => (
              <BookCard key={book.id} podcast={book} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
