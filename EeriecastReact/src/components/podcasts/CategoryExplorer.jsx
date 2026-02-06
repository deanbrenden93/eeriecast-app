import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Ghost, Search, ScrollText, Wand2, BookOpen, Library, Laugh, Headphones, BookText, Gift, Star } from "lucide-react";

const categories = [
  { name: 'PARANORMAL', icon: Ghost, id: 'paranormal', color: 'from-violet-900/40 to-violet-950/60', borderColor: 'border-violet-500/20', hoverGlow: 'hover:shadow-violet-500/10' },
  { name: 'TRUE CRIME', icon: Search, id: 'true_crime', color: 'from-red-900/40 to-red-950/60', borderColor: 'border-red-500/20', hoverGlow: 'hover:shadow-red-500/10' },
  { name: 'HISTORY', icon: ScrollText, id: 'history', color: 'from-amber-900/40 to-amber-950/60', borderColor: 'border-amber-500/20', hoverGlow: 'hover:shadow-amber-500/10' },
  { name: 'FOLKLORE', icon: Wand2, id: 'folklore', color: 'from-blue-900/40 to-blue-950/60', borderColor: 'border-blue-500/20', hoverGlow: 'hover:shadow-blue-500/10' },
  { name: 'NON-FICTION', icon: BookOpen, id: 'non-fiction', color: 'from-slate-800/40 to-slate-900/60', borderColor: 'border-slate-500/20', hoverGlow: 'hover:shadow-slate-500/10' },
  { name: 'FICTION', icon: Library, id: 'fiction', color: 'from-purple-900/40 to-purple-950/60', borderColor: 'border-purple-500/20', hoverGlow: 'hover:shadow-purple-500/10' },
  { name: 'COMEDY', icon: Laugh, id: 'comedy', color: 'from-orange-900/40 to-orange-950/60', borderColor: 'border-orange-500/20', hoverGlow: 'hover:shadow-orange-500/10' },
  { name: 'AUDIOBOOKS', icon: Headphones, id: 'audiobooks', color: 'from-cyan-900/40 to-cyan-950/60', borderColor: 'border-cyan-500/20', hoverGlow: 'hover:shadow-cyan-500/10' },
  { name: 'EBOOKS', icon: BookText, id: 'ebooks', color: 'from-emerald-900/40 to-emerald-950/60', borderColor: 'border-emerald-500/20', hoverGlow: 'hover:shadow-emerald-500/10' },
  { name: 'FREE', icon: Gift, id: 'free', color: 'from-rose-900/40 to-rose-950/60', borderColor: 'border-rose-500/20', hoverGlow: 'hover:shadow-rose-500/10' },
  { name: 'MEMBERS-ONLY', icon: Star, id: 'members-only', color: 'from-yellow-900/40 to-yellow-950/60', borderColor: 'border-yellow-500/20', hoverGlow: 'hover:shadow-yellow-500/10' },
];

export default function CategoryExplorer() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Explore Categories</h2>
      <div
        className="overflow-x-auto overflow-y-hidden -mx-1 px-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        aria-label="Categories"
      >
        <div className="flex gap-3 snap-x snap-mandatory">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Link
                key={category.id}
                to={`${createPageUrl("Category")}?category=${encodeURIComponent(category.name.toLowerCase())}`}
                className="group flex-shrink-0 snap-start"
              >
                <div className={`w-32 sm:w-36 md:w-40 bg-gradient-to-br ${category.color} border ${category.borderColor} hover:border-white/10 transition-all duration-500 rounded-xl p-4 h-28 flex flex-col items-center justify-center text-center space-y-2.5 ${category.hoverGlow} hover:shadow-xl hover:-translate-y-0.5`}>
                  <Icon className="w-7 h-7 text-white/70 group-hover:text-white/90 transition-colors" />
                  <span className="text-white/80 group-hover:text-white text-[11px] font-bold uppercase tracking-wider leading-tight transition-colors">
                    {category.name}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
