import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Play, ChevronRight } from "lucide-react";
import { createPageUrl } from "@/utils";

/* ═══════════════════════════════════════════════════════════════════
   FEATURED HERO CONFIG
   ─────────────────────────────────────────────────────────────────
   Update this object whenever you want to change the home‑screen hero.
   Every field is optional — sensible defaults kick in for anything omitted.
   ═══════════════════════════════════════════════════════════════════ */
const HERO_CONFIG = {
  // The badge text shown above the title (small uppercase label)
  badge: 'Featured Collection',

  // Main headline — supports line breaks with \n
  title: 'Stories That\nHaunt You',

  // Subtitle paragraph below the headline
  description:
    'Immerse yourself in spine-chilling podcasts, from terrifying true stories to supernatural fiction. Discover narratives that will keep you awake at night.',

  // Primary CTA button text
  ctaText: 'Start Listening',

  // Secondary CTA — set to null to hide
  secondaryCta: { text: 'Browse Shows', to: '/Discover?tab=podcasts' },

  // Accent colour used for the badge dot, gradient tints, and glow
  // Accepts any CSS colour value
  accentColor: '#dc2626',

  // Optional secondary accent for gradient depth
  accentColorAlt: '#7c3aed',
};

/* ═══════════════════════════════════════════════════════════════════ */

export default function FeaturedHero({ podcast, onPlay }) {
  const navigate = useNavigate();
  const cfg = HERO_CONFIG;
  const accent = cfg.accentColor || '#dc2626';
  const accentAlt = cfg.accentColorAlt || '#7c3aed';

  return (
    <section className="relative w-full overflow-hidden" style={{ minHeight: 'clamp(380px, 50vh, 520px)' }}>
      {/* ── Layered atmospheric background ── */}
      <div className="absolute inset-0 bg-[#08080e]">
        {/* Primary accent orb — top‑left */}
        <div
          className="absolute w-[50rem] h-[50rem] rounded-full blur-[200px] opacity-[0.07]"
          style={{
            background: `radial-gradient(circle, ${accent}, transparent 70%)`,
            top: '-30%',
            left: '-15%',
            animation: 'hero-orb-1 20s ease-in-out infinite alternate',
          }}
        />
        {/* Secondary accent orb — bottom‑right */}
        <div
          className="absolute w-[40rem] h-[40rem] rounded-full blur-[180px] opacity-[0.05]"
          style={{
            background: `radial-gradient(circle, ${accentAlt}, transparent 70%)`,
            bottom: '-20%',
            right: '-10%',
            animation: 'hero-orb-2 25s ease-in-out infinite alternate',
          }}
        />
        {/* Centre warm glow */}
        <div
          className="absolute w-[30rem] h-[20rem] rounded-full blur-[120px] opacity-[0.03]"
          style={{
            background: `radial-gradient(circle, ${accent}, transparent 70%)`,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
        {/* Subtle grain / noise texture */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
            backgroundSize: '128px 128px',
          }}
        />
        {/* Bottom fade into page surface */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-eeriecast-surface to-transparent" />
      </div>

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes hero-orb-1 {
          0%   { transform: translate(0, 0) scale(1); }
          100% { transform: translate(50px, 30px) scale(1.12); }
        }
        @keyframes hero-orb-2 {
          0%   { transform: translate(0, 0) scale(1); }
          100% { transform: translate(-40px, -25px) scale(1.1); }
        }
      `}</style>

      {/* ── Content ── */}
      <div className="relative z-10 w-full h-full flex items-end px-5 sm:px-6 lg:px-10 pb-10 sm:pb-12" style={{ minHeight: 'clamp(380px, 50vh, 520px)' }}>
        <div className="max-w-2xl w-full">
          {/* Badge */}
          {cfg.badge && (
            <div className="inline-flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.08] text-xs font-bold uppercase tracking-[0.15em] px-3.5 py-1.5 rounded-full mb-5 backdrop-blur-sm" style={{ color: accent }}>
              <span className="relative flex h-1.5 w-1.5">
                <span
                  className="animate-pulse-glow absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: accent }}
                />
                <span
                  className="relative inline-flex rounded-full h-1.5 w-1.5"
                  style={{ backgroundColor: accent }}
                />
              </span>
              {cfg.badge}
            </div>
          )}

          {/* Title */}
          <h1
            className="font-display font-extrabold italic text-white mb-4 pr-2"
            style={{
              fontSize: 'clamp(32px, 6vw, 56px)',
              lineHeight: 1.08,
              letterSpacing: '-0.025em',
            }}
          >
            {(cfg.title || '').split('\n').map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </span>
            ))}
          </h1>

          {/* Description */}
          {cfg.description && (
            <p className="text-sm sm:text-[15px] text-zinc-400 leading-relaxed max-w-lg mb-8">
              {cfg.description}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={() => onPlay && onPlay(podcast)}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white pl-5 pr-6 py-3 rounded-xl text-sm font-semibold flex items-center gap-2.5 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-red-600/20 hover:shadow-xl hover:shadow-red-600/25 border border-red-500/20"
            >
              <Play className="w-4 h-4 fill-white" />
              {cfg.ctaText || 'Start Listening'}
            </Button>

            {cfg.secondaryCta && (
              <button
                type="button"
                onClick={() => navigate(cfg.secondaryCta.to || '/Discover')}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 hover:text-white transition-colors px-4 py-3 rounded-xl hover:bg-white/[0.04]"
              >
                {cfg.secondaryCta.text}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
