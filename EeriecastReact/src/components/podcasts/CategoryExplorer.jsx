import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Category } from "@/api/entities";
import {
  Loader2, Ghost, Search, ScrollText, Wand2, BookOpen, Library,
  Headphones, Star, Sparkles, Mic, Globe, Podcast,
  Film, BookMarked, ShieldAlert, Skull, MessageSquareQuote,
  TreePine, Clapperboard, Video
} from "lucide-react";

// Each category gets a unique icon + color theme
const categoryStyles = {
  'anthology':    { icon: BookMarked,         accent: 'amber',   gradient: 'from-amber-600/30 via-amber-900/40 to-amber-950/60',        iconBg: 'bg-amber-500/15',   iconColor: 'text-amber-400',   border: 'border-amber-500/15',   glow: 'hover:shadow-amber-500/20' },
  'audiobooks':   { icon: Headphones,         accent: 'cyan',    gradient: 'from-cyan-600/30 via-cyan-900/40 to-cyan-950/60',            iconBg: 'bg-cyan-500/15',    iconColor: 'text-cyan-400',    border: 'border-cyan-500/15',    glow: 'hover:shadow-cyan-500/20' },
  'documentary':  { icon: Film,               accent: 'slate',   gradient: 'from-slate-500/30 via-slate-800/40 to-slate-950/60',         iconBg: 'bg-slate-400/15',   iconColor: 'text-slate-300',   border: 'border-slate-400/15',   glow: 'hover:shadow-slate-400/20' },
  'fiction':      { icon: Library,            accent: 'purple',  gradient: 'from-purple-600/30 via-purple-900/40 to-purple-950/60',      iconBg: 'bg-purple-500/15',  iconColor: 'text-purple-400',  border: 'border-purple-500/15',  glow: 'hover:shadow-purple-500/20' },
  'folklore':     { icon: Wand2,              accent: 'blue',    gradient: 'from-blue-600/30 via-blue-900/40 to-blue-950/60',            iconBg: 'bg-blue-500/15',    iconColor: 'text-blue-400',    border: 'border-blue-500/15',    glow: 'hover:shadow-blue-500/20' },
  'history':      { icon: ScrollText,         accent: 'amber',   gradient: 'from-yellow-700/30 via-amber-900/40 to-amber-950/60',       iconBg: 'bg-yellow-500/15',  iconColor: 'text-yellow-400',  border: 'border-yellow-500/15',  glow: 'hover:shadow-yellow-500/20' },
  'mature':       { icon: ShieldAlert,        accent: 'red',     gradient: 'from-red-700/30 via-red-900/40 to-red-950/60',              iconBg: 'bg-red-500/15',     iconColor: 'text-red-400',     border: 'border-red-500/15',     glow: 'hover:shadow-red-500/20' },
  'members':      { icon: Star,               accent: 'yellow',  gradient: 'from-yellow-600/30 via-yellow-900/40 to-yellow-950/60',     iconBg: 'bg-yellow-400/15',  iconColor: 'text-yellow-300',  border: 'border-yellow-400/15',  glow: 'hover:shadow-yellow-400/20' },
  'monsters':     { icon: Skull,               accent: 'emerald', gradient: 'from-emerald-600/30 via-emerald-900/40 to-emerald-950/60',  iconBg: 'bg-emerald-500/15', iconColor: 'text-emerald-400', border: 'border-emerald-500/15', glow: 'hover:shadow-emerald-500/20' },
  'narration':    { icon: MessageSquareQuote,  accent: 'indigo',  gradient: 'from-indigo-600/30 via-indigo-900/40 to-indigo-950/60',     iconBg: 'bg-indigo-500/15',  iconColor: 'text-indigo-400',  border: 'border-indigo-500/15',  glow: 'hover:shadow-indigo-500/20' },
  'non-fiction':  { icon: BookOpen,           accent: 'zinc',    gradient: 'from-zinc-500/30 via-zinc-800/40 to-zinc-900/60',            iconBg: 'bg-zinc-400/15',    iconColor: 'text-zinc-300',    border: 'border-zinc-400/15',    glow: 'hover:shadow-zinc-400/20' },
  'outdoors':     { icon: TreePine,           accent: 'green',   gradient: 'from-green-600/30 via-green-900/40 to-green-950/60',         iconBg: 'bg-green-500/15',   iconColor: 'text-green-400',   border: 'border-green-500/15',   glow: 'hover:shadow-green-500/20' },
  'paranormal':   { icon: Ghost,              accent: 'violet',  gradient: 'from-violet-600/30 via-violet-900/40 to-violet-950/60',      iconBg: 'bg-violet-500/15',  iconColor: 'text-violet-400',  border: 'border-violet-500/15',  glow: 'hover:shadow-violet-500/20' },
  'podcast':      { icon: Podcast,            accent: 'orange',  gradient: 'from-orange-600/30 via-orange-900/40 to-orange-950/60',      iconBg: 'bg-orange-500/15',  iconColor: 'text-orange-400',  border: 'border-orange-500/15',  glow: 'hover:shadow-orange-500/20' },
  'sci-fi':       { icon: Sparkles,           accent: 'sky',     gradient: 'from-sky-600/30 via-sky-900/40 to-sky-950/60',               iconBg: 'bg-sky-500/15',     iconColor: 'text-sky-400',     border: 'border-sky-500/15',     glow: 'hover:shadow-sky-500/20' },
  'talk-show':    { icon: Mic,                accent: 'rose',    gradient: 'from-rose-600/30 via-rose-900/40 to-rose-950/60',            iconBg: 'bg-rose-500/15',    iconColor: 'text-rose-400',    border: 'border-rose-500/15',    glow: 'hover:shadow-rose-500/20' },
  'travel':       { icon: Globe,              accent: 'teal',    gradient: 'from-teal-600/30 via-teal-900/40 to-teal-950/60',            iconBg: 'bg-teal-500/15',    iconColor: 'text-teal-400',    border: 'border-teal-500/15',    glow: 'hover:shadow-teal-500/20' },
  'true-crime':   { icon: Search,             accent: 'red',     gradient: 'from-rose-700/30 via-red-900/40 to-red-950/60',              iconBg: 'bg-rose-500/15',    iconColor: 'text-rose-400',    border: 'border-rose-500/15',    glow: 'hover:shadow-rose-500/20' },
  'unscripted':   { icon: Video,              accent: 'pink',    gradient: 'from-pink-600/30 via-pink-900/40 to-pink-950/60',            iconBg: 'bg-pink-500/15',    iconColor: 'text-pink-400',    border: 'border-pink-500/15',    glow: 'hover:shadow-pink-500/20' },
};

const fallbackStyle = { icon: Clapperboard, gradient: 'from-zinc-600/30 via-zinc-800/40 to-zinc-950/60', iconBg: 'bg-zinc-500/15', iconColor: 'text-zinc-400', border: 'border-zinc-500/15', glow: 'hover:shadow-zinc-500/20' };

function getStyle(category) {
  const slug = (category.slug || '').toLowerCase();
  const name = (category.name || '').toLowerCase();
  return categoryStyles[slug] || categoryStyles[name] || fallbackStyle;
}

export default function CategoryExplorer() {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        const resp = await Category.list();
        setCategories(Array.isArray(resp) ? resp : (resp?.results || []));
      } catch {
        setCategories([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Explore Categories</h2>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
        </div>
      </div>
    );
  }

  if (!categories.length) return null;

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Explore Categories</h2>
      <div
        className="overflow-x-auto overflow-y-hidden -mx-1 px-1 py-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        aria-label="Categories"
      >
        <div className="flex gap-3.5 snap-x snap-mandatory">
          {categories.map((category) => {
            const label = (category.name || category.title || category.slug || '').toString();
            const slug = (category.slug || category.name || '').toString().toLowerCase();
            const style = getStyle(category);
            const Icon = style.icon;

            return (
              <Link
                key={category.id || category.slug || label}
                to={`${createPageUrl("Discover")}?tab=Categories&category=${encodeURIComponent(slug)}`}
                className="group flex-shrink-0 snap-start"
              >
                <div className={`
                  relative overflow-hidden
                  w-[8.5rem] sm:w-[9.5rem] md:w-[10.5rem]
                  bg-gradient-to-br ${style.gradient}
                  border ${style.border}
                  rounded-2xl p-4 h-[7.5rem]
                  flex flex-col items-center justify-center text-center gap-2.5
                  hover:-translate-y-1 hover:scale-[1.02]
                  transition-all duration-500 ease-out
                  cursor-pointer
                `}>
                  {/* Ambient glow behind the icon */}
                  <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-20 h-20 rounded-full ${style.iconBg} blur-2xl opacity-60 group-hover:opacity-100 group-hover:scale-125 transition-all duration-700`} />

                  {/* Icon with pill background */}
                  <div className={`relative z-10 ${style.iconBg} rounded-xl p-2.5 group-hover:scale-110 transition-transform duration-500`}>
                    <Icon className={`w-5 h-5 ${style.iconColor} group-hover:brightness-125 transition-all duration-300`} strokeWidth={1.75} />
                  </div>

                  {/* Label */}
                  <span className="relative z-10 text-white/75 group-hover:text-white text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.08em] leading-tight transition-colors duration-300">
                    {label}
                  </span>

                  {/* Subtle shimmer on hover */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
