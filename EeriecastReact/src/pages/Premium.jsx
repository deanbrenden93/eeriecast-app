import { useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  X,
  Crown,
  Headphones,
  BookOpen,
  ArrowDownToLine,
  Star,
  CircleSlash,
  Sparkles,
  ChevronLeft,
  Check,
} from 'lucide-react';

const features = [
  {
    icon: Headphones,
    title: 'All 1,300+ Episodes',
    desc: 'Every show, every episode, no limits',
  },
  {
    icon: BookOpen,
    title: 'Full Audiobooks & E-Reader',
    desc: 'Listen and read complete horror novels',
  },
  {
    icon: Star,
    title: 'Exclusive Shows',
    desc: 'Members-only horror content',
  },
  {
    icon: ArrowDownToLine,
    title: 'Offline Downloads',
    desc: 'Listen anywhere without internet',
  },
  {
    icon: Sparkles,
    title: 'Early Access',
    desc: 'New episodes before everyone else',
  },
  {
    icon: CircleSlash,
    title: 'No Ads Ever',
    desc: 'Pure, uninterrupted horror',
  },
];

export default function Premium() {
  const navigate = useNavigate();
  const topRef = useRef(null);

  // Scroll to top when the page mounts — use layoutEffect so it fires before
  // the browser paints, and hit every possible scroll target to guarantee it.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    topRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }, []);

  return (
    <div ref={topRef} className="min-h-screen bg-[#0a0a10] text-white relative overflow-hidden">
      {/* ── Ambient background effects ── */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[50rem] h-[40rem] rounded-full blur-[200px] opacity-[0.06] bg-gradient-to-br from-red-700 via-amber-600 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[30rem] h-[30rem] rounded-full blur-[160px] opacity-[0.04] bg-gradient-to-tl from-red-900 to-transparent pointer-events-none" />

      {/* ── Top bar with exit ── */}
      <div className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/[0.04] bg-[#0a0a10]/60 backdrop-blur-md">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Back</span>
        </button>
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
          Membership
        </span>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.04] border border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-all"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Main content ── */}
      <div className="relative z-10 max-w-lg mx-auto px-5 py-10 sm:py-14">
        {/* Crown icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 via-amber-500/15 to-red-600/10 border border-red-500/[0.08] flex items-center justify-center shadow-lg shadow-red-900/10">
            <Crown className="w-8 h-8 text-amber-400" />
          </div>
        </div>

        {/* Heading */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-display italic font-bold mb-3 tracking-tight">
            Unlock Everything
          </h1>
          <p className="text-sm sm:text-base text-zinc-500 max-w-xs mx-auto leading-relaxed">
            Unlimited access to every show, audiobook, and feature Eeriecast has to offer.
          </p>
        </div>

        {/* ── Pricing card ── */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 sm:p-8 mb-8 relative overflow-hidden">
          {/* Card glow */}
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-60 h-32 rounded-full blur-[80px] opacity-[0.08] bg-gradient-to-br from-red-500 to-amber-500 pointer-events-none" />

          <div className="relative">
            {/* Badge */}
            <div className="flex justify-center mb-5">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-amber-400/90 bg-amber-500/10 border border-amber-400/[0.08] px-3 py-1 rounded-full">
                <Sparkles className="w-3 h-3" />
                Most Popular
              </span>
            </div>

            {/* Price */}
            <div className="text-center mb-6">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl sm:text-6xl font-bold tracking-tight text-white">$7.99</span>
                <span className="text-lg text-zinc-500 font-medium">/mo</span>
              </div>
              <p className="text-xs text-zinc-600 mt-2">7 days free, then $7.99/month. Cancel anytime.</p>
            </div>

            {/* CTA */}
            <Button
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold text-base shadow-lg shadow-red-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] border border-red-500/20"
            >
              Start Free Trial
            </Button>
          </div>
        </div>

        {/* ── Features grid ── */}
        <div className="mb-10">
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-600 mb-4 text-center">
            What you get
          </h2>
          <div className="space-y-2">
            {features.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.06] transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.04] flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-amber-400/80" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200">{title}</p>
                  <p className="text-xs text-zinc-500">{desc}</p>
                </div>
                <Check className="w-4 h-4 text-red-500/60 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom secondary CTA ── */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
