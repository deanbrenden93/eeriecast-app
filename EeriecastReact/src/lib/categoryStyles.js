import {
  Ghost, Search, ScrollText, Wand2, BookOpen, Library,
  Headphones, Star, Sparkles, Mic, Globe, Podcast,
  Film, BookMarked, ShieldAlert, Skull, MessageSquareQuote,
  TreePine, Clapperboard, Video, Music, Laugh,
} from 'lucide-react';

/**
 * Per-category visual theming used by both the Podcasts-page CategoryExplorer
 * (horizontal pill row) and the Discover "Browse by Category" grid. Each entry
 * supplies:
 *   icon     — a lucide-react component
 *   accent   — a short color name (documentation only)
 *   gradient — Tailwind gradient utility (used as card background)
 *   iconBg   — Tailwind bg utility used behind the icon
 *   iconColor — Tailwind text color for the icon
 *   border   — Tailwind border color utility
 *   glow     — Tailwind hover shadow utility
 *
 * Keys are lowercase category slugs / names. Both "music" and "true-crime" are
 * represented here; the lookup helper also supports legacy hyphen/underscore
 * forms (e.g. "true_crime" → "true-crime").
 */
export const categoryStyles = {
  'anthology':    { icon: BookMarked,         accent: 'amber',   gradient: 'from-amber-600/30 via-amber-900/40 to-amber-950/60',        iconBg: 'bg-amber-500/15',   iconColor: 'text-amber-400',   border: 'border-amber-500/15',   glow: 'hover:shadow-amber-500/20' },
  'audiobooks':   { icon: Headphones,         accent: 'cyan',    gradient: 'from-cyan-600/30 via-cyan-900/40 to-cyan-950/60',           iconBg: 'bg-cyan-500/15',    iconColor: 'text-cyan-400',    border: 'border-cyan-500/15',    glow: 'hover:shadow-cyan-500/20' },
  'comedy':       { icon: Laugh,              accent: 'yellow',  gradient: 'from-yellow-500/30 via-yellow-800/40 to-yellow-950/60',    iconBg: 'bg-yellow-400/15',  iconColor: 'text-yellow-300',  border: 'border-yellow-400/15',  glow: 'hover:shadow-yellow-400/20' },
  'documentary':  { icon: Film,               accent: 'slate',   gradient: 'from-slate-500/30 via-slate-800/40 to-slate-950/60',        iconBg: 'bg-slate-400/15',   iconColor: 'text-slate-300',   border: 'border-slate-400/15',   glow: 'hover:shadow-slate-400/20' },
  'fiction':      { icon: Library,            accent: 'purple',  gradient: 'from-purple-600/30 via-purple-900/40 to-purple-950/60',     iconBg: 'bg-purple-500/15',  iconColor: 'text-purple-400',  border: 'border-purple-500/15',  glow: 'hover:shadow-purple-500/20' },
  'folklore':     { icon: Wand2,              accent: 'blue',    gradient: 'from-blue-600/30 via-blue-900/40 to-blue-950/60',           iconBg: 'bg-blue-500/15',    iconColor: 'text-blue-400',    border: 'border-blue-500/15',    glow: 'hover:shadow-blue-500/20' },
  'history':      { icon: ScrollText,         accent: 'amber',   gradient: 'from-yellow-700/30 via-amber-900/40 to-amber-950/60',      iconBg: 'bg-yellow-500/15',  iconColor: 'text-yellow-400',  border: 'border-yellow-500/15',  glow: 'hover:shadow-yellow-500/20' },
  'mature':       { icon: ShieldAlert,        accent: 'red',     gradient: 'from-red-700/30 via-red-900/40 to-red-950/60',             iconBg: 'bg-red-500/15',     iconColor: 'text-red-400',     border: 'border-red-500/15',     glow: 'hover:shadow-red-500/20' },
  'members':      { icon: Star,               accent: 'yellow',  gradient: 'from-yellow-600/30 via-yellow-900/40 to-yellow-950/60',    iconBg: 'bg-yellow-400/15',  iconColor: 'text-yellow-300',  border: 'border-yellow-400/15',  glow: 'hover:shadow-yellow-400/20' },
  'monsters':     { icon: Skull,              accent: 'emerald', gradient: 'from-emerald-600/30 via-emerald-900/40 to-emerald-950/60', iconBg: 'bg-emerald-500/15', iconColor: 'text-emerald-400', border: 'border-emerald-500/15', glow: 'hover:shadow-emerald-500/20' },
  'music':        { icon: Music,              accent: 'fuchsia', gradient: 'from-fuchsia-600/30 via-fuchsia-900/40 to-fuchsia-950/60', iconBg: 'bg-fuchsia-500/15', iconColor: 'text-fuchsia-400', border: 'border-fuchsia-500/15', glow: 'hover:shadow-fuchsia-500/20' },
  'narration':    { icon: MessageSquareQuote, accent: 'indigo',  gradient: 'from-indigo-600/30 via-indigo-900/40 to-indigo-950/60',    iconBg: 'bg-indigo-500/15',  iconColor: 'text-indigo-400',  border: 'border-indigo-500/15',  glow: 'hover:shadow-indigo-500/20' },
  'non-fiction':  { icon: BookOpen,           accent: 'zinc',    gradient: 'from-zinc-500/30 via-zinc-800/40 to-zinc-900/60',          iconBg: 'bg-zinc-400/15',    iconColor: 'text-zinc-300',    border: 'border-zinc-400/15',    glow: 'hover:shadow-zinc-400/20' },
  'outdoors':     { icon: TreePine,           accent: 'green',   gradient: 'from-green-600/30 via-green-900/40 to-green-950/60',       iconBg: 'bg-green-500/15',   iconColor: 'text-green-400',   border: 'border-green-500/15',   glow: 'hover:shadow-green-500/20' },
  'paranormal':   { icon: Ghost,              accent: 'violet',  gradient: 'from-violet-600/30 via-violet-900/40 to-violet-950/60',    iconBg: 'bg-violet-500/15',  iconColor: 'text-violet-400',  border: 'border-violet-500/15',  glow: 'hover:shadow-violet-500/20' },
  'podcast':      { icon: Podcast,            accent: 'orange',  gradient: 'from-orange-600/30 via-orange-900/40 to-orange-950/60',    iconBg: 'bg-orange-500/15',  iconColor: 'text-orange-400',  border: 'border-orange-500/15',  glow: 'hover:shadow-orange-500/20' },
  'sci-fi':       { icon: Sparkles,           accent: 'sky',     gradient: 'from-sky-600/30 via-sky-900/40 to-sky-950/60',             iconBg: 'bg-sky-500/15',     iconColor: 'text-sky-400',     border: 'border-sky-500/15',     glow: 'hover:shadow-sky-500/20' },
  'talk-show':    { icon: Mic,                accent: 'rose',    gradient: 'from-rose-600/30 via-rose-900/40 to-rose-950/60',          iconBg: 'bg-rose-500/15',    iconColor: 'text-rose-400',    border: 'border-rose-500/15',    glow: 'hover:shadow-rose-500/20' },
  'travel':       { icon: Globe,              accent: 'teal',    gradient: 'from-teal-600/30 via-teal-900/40 to-teal-950/60',          iconBg: 'bg-teal-500/15',    iconColor: 'text-teal-400',    border: 'border-teal-500/15',    glow: 'hover:shadow-teal-500/20' },
  'true-crime':   { icon: Search,             accent: 'red',     gradient: 'from-rose-700/30 via-red-900/40 to-red-950/60',            iconBg: 'bg-rose-500/15',    iconColor: 'text-rose-400',    border: 'border-rose-500/15',    glow: 'hover:shadow-rose-500/20' },
  'unscripted':   { icon: Video,              accent: 'pink',    gradient: 'from-pink-600/30 via-pink-900/40 to-pink-950/60',          iconBg: 'bg-pink-500/15',    iconColor: 'text-pink-400',    border: 'border-pink-500/15',    glow: 'hover:shadow-pink-500/20' },
};

export const fallbackCategoryStyle = {
  icon: Clapperboard,
  accent: 'zinc',
  gradient: 'from-zinc-600/30 via-zinc-800/40 to-zinc-950/60',
  iconBg: 'bg-zinc-500/15',
  iconColor: 'text-zinc-400',
  border: 'border-zinc-500/15',
  glow: 'hover:shadow-zinc-500/20',
};

/** Normalize a category key/slug/name so "True Crime", "true_crime", and
 *  "true-crime" all collapse to the same lookup key. */
export function normalizeCategoryKey(raw) {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/_/g, '-');
}

export function getCategoryStyle(categoryLike) {
  const slug = normalizeCategoryKey(categoryLike?.slug);
  const name = normalizeCategoryKey(categoryLike?.name);
  const raw = typeof categoryLike === 'string' ? normalizeCategoryKey(categoryLike) : '';
  return categoryStyles[slug] || categoryStyles[name] || categoryStyles[raw] || fallbackCategoryStyle;
}
