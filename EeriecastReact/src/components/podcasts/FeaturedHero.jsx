import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Play, ChevronRight, BookOpen, Crown } from "lucide-react";
import { usePodcasts } from "@/context/PodcastContext.jsx";
import { useUser } from "@/context/UserContext.jsx";

/* ═══════════════════════════════════════════════════════════════════
   HERO SLIDES CONFIG
   ─────────────────────────────────────────────────────────────────
   Update this array to change what rotates on the home screen.
   Set  type: 'promo'  for non-podcast promotional slides.
   ═══════════════════════════════════════════════════════════════════ */

const HERO_SLIDES = [
  {
    id: 'premium-promo',
    type: 'promo',
    badge: 'Membership',
    title: 'Unlock\nEverything',
    description:
      'Exclusive shows, every audiobook chapter, unlimited playlists, ad-free listening, and more. Support the creators behind the stories you love.',
    ctaText: 'Become a Member',
    ctaIcon: 'crown',
    ctaTo: '/Premium',
    secondaryCta: null,
    accent: '#f59e0b',
    accentAlt: '#dc2626',
    // No artwork — uses ambient background only
  },
  {
    slug: 'night-watchers',
    // Night Watchers is tagged Mature on the backend — flag the slide so we
    // skip it entirely for users who have mature content turned off.
    mature: true,
    badge: 'Fan Favorite',
    title: 'Night\nWatchers',
    description:
      'The creepy, the weird, and the downright hilarious. Scary stories, pop culture, and deliciously laughable tales centering around all things weird.',
    ctaText: 'Listen Now',
    secondaryCta: { text: 'View Show' },
    accent: '#a855f7',
    accentAlt: '#7e22ce',
  },
  {
    slug: 'dogwood-a-southern-gothic-body-horror-novel',
    badge: 'New Audiobook',
    title: 'Dogwood',
    description:
      '1940s Georgia. Two girls vanish from Dogwood Plantation. A private eye and a professor must untangle secrets and murder — and discover the true monsters are terrifyingly human.',
    ctaText: 'Start Reading',
    ctaIcon: 'book',
    secondaryCta: { text: 'View Book' },
    accent: '#c2455a',
    accentAlt: '#8b2040',
    isBook: true,
  },
];

const DEFAULT_INTERVAL = 8000;

/* ═══════════════════════════════════════════════════════════════════ */

function showUrl(podcast) {
  if (!podcast?.id) return '/Discover';
  return `/Episodes?id=${encodeURIComponent(podcast.id)}`;
}

/* ─── Slide text + CTAs ───────────────────────────────────────── */

function SlideContent({ slide, podcast, onPlay, navigate }) {
  const accent = slide.accent || '#dc2626';
  const isPromo = slide.type === 'promo';

  const CtaIconMap = { book: BookOpen, crown: Crown, play: Play };
  const CtaIcon = CtaIconMap[slide.ctaIcon] || Play;

  const handlePrimary = () => {
    if (isPromo && slide.ctaTo) {
      navigate(slide.ctaTo);
    } else if (onPlay && podcast) {
      onPlay(podcast);
    }
  };

  const handleSecondary = () => {
    if (slide.secondaryCta?.to) {
      navigate(slide.secondaryCta.to);
    } else if (podcast) {
      navigate(showUrl(podcast));
    }
  };

  return (
    <motion.div
      key={slide.id || slide.slug}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
      className="w-full"
    >
      {/* Badge */}
      {slide.badge && (
        <div
          className="inline-flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.08] text-xs font-bold uppercase tracking-[0.15em] px-3.5 py-1.5 rounded-full mb-5 backdrop-blur-sm"
          style={{ color: accent }}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-pulse-glow absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: accent }} />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: accent }} />
          </span>
          {slide.badge}
        </div>
      )}

      {/* Title */}
      <h1
        className="font-display font-extrabold italic text-white mb-4"
        style={{ fontSize: 'clamp(30px, 5.5vw, 50px)', lineHeight: 1.08, letterSpacing: '-0.025em' }}
      >
        {(slide.title || '').split('\n').map((line, i, arr) => (
          <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
        ))}
      </h1>

      {/* Description */}
      {slide.description && (
        <p className="text-sm text-zinc-400 leading-relaxed max-w-sm mb-7">{slide.description}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          onClick={handlePrimary}
          className="text-white pl-5 pr-6 py-3 rounded-xl text-sm font-semibold flex items-center gap-2.5 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl border border-white/[0.08]"
          style={{
            background: `linear-gradient(135deg, ${accent}, ${slide.accentAlt || accent})`,
            boxShadow: `0 8px 30px ${accent}33`,
          }}
        >
          <CtaIcon className={`w-4 h-4 ${slide.ctaIcon === 'book' || slide.ctaIcon === 'crown' ? '' : 'fill-white'}`} />
          {slide.ctaText || 'Start Listening'}
        </Button>

        {slide.secondaryCta && (
          <button type="button" onClick={handleSecondary} className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 hover:text-white transition-colors px-4 py-3 rounded-xl hover:bg-white/[0.04]">
            {slide.secondaryCta.text}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Progress dots ───────────────────────────────────────────── */

function SlideDots({ count, active, onDotClick, slides }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onDotClick(i)}
          aria-label={`Slide ${i + 1}`}
          className="relative h-1.5 rounded-full overflow-hidden transition-all duration-300 cursor-pointer"
          style={{ width: i === active ? 28 : 8, backgroundColor: i === active ? 'transparent' : 'rgba(255,255,255,0.15)' }}
        >
          {i === active && (
            <>
              <div className="absolute inset-0 rounded-full" style={{ backgroundColor: `${slides[i]?.accent || '#dc2626'}44` }} />
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ backgroundColor: slides[i]?.accent || '#dc2626' }}
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: (slides[i]?.interval || DEFAULT_INTERVAL) / 1000, ease: 'linear' }}
                key={`progress-${active}`}
              />
            </>
          )}
        </button>
      ))}
    </div>
  );
}

/* ─── Gold sparkle particles (promo slide only) ───────────────── */

const SPARK_COUNT = 26;

function GoldParticles() {
  const sparks = useMemo(() =>
    Array.from({ length: SPARK_COUNT }, (_, i) => ({
      id: i,
      // Cluster origin toward bottom-right, with some spread
      right: `${-5 + Math.random() * 40}%`,
      bottom: `${-5 + Math.random() * 15}%`,
      size: 1.5 + Math.random() * 2.5,
      duration: 5 + Math.random() * 6,
      delay: -(Math.random() * 11),
      // How far left it drifts (always negative = leftward)
      driftX: -(30 + Math.random() * 50),
      // Twirl radius — slight sine wobble
      wobble: 8 + Math.random() * 18,
      // Spin speed for the twirl (rotations)
      spins: 1 + Math.random() * 2,
      bright: Math.random() > 0.55,
    })),
  []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {sparks.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full"
          style={{
            right: s.right,
            bottom: s.bottom,
            width: s.size,
            height: s.size,
            background: s.bright
              ? 'radial-gradient(circle, #fde68a, #f59e0b 60%, transparent 100%)'
              : 'radial-gradient(circle, #fbbf24cc, #d97706 70%, transparent 100%)',
            boxShadow: s.bright
              ? '0 0 6px 2px rgba(251,191,36,0.45), 0 0 12px 3px rgba(245,158,11,0.12)'
              : '0 0 3px 1px rgba(251,191,36,0.2)',
            '--spark-drift-x': `${s.driftX}vw`,
            '--spark-wobble': `${s.wobble}px`,
            '--spark-spins': `${Math.round(s.spins * 360)}deg`,
            animation: `hero-spark-rise ${s.duration}s ${s.delay}s linear infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

export default function FeaturedHero({ onPlay }) {
  const navigate = useNavigate();
  const { podcasts } = usePodcasts();
  const { canViewMature } = useUser() || {};
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  /* Resolve slide podcasts from the API data — strict slug match only. Also
     drops any slides explicitly tagged as mature when the viewer can't see
     mature content; otherwise the text/CTAs render even though the resolved
     podcast was filtered out, effectively advertising a hidden show. */
  const slides = useMemo(() => {
    const source = canViewMature
      ? HERO_SLIDES
      : HERO_SLIDES.filter((s) => !s.mature);
    return source.map((slide) => {
      if (slide.type === 'promo') return { ...slide, podcast: null };
      if (!podcasts || podcasts.length === 0) return { ...slide, podcast: null };
      const found = podcasts.find((p) => p.slug === slide.slug);
      return { ...slide, podcast: found || null };
    });
  }, [podcasts, canViewMature]);

  // Clamp active index when the slide set shrinks (e.g. mature toggled off).
  useEffect(() => {
    if (activeIndex >= slides.length && slides.length > 0) {
      setActiveIndex(0);
    }
  }, [slides.length, activeIndex]);

  const currentSlide = slides[activeIndex % slides.length] || slides[0];
  const currentPodcast = currentSlide?.podcast;
  const isPromo = currentSlide?.type === 'promo';
  const accent = currentSlide?.accent || '#dc2626';
  const accentAlt = currentSlide?.accentAlt || '#7c3aed';
  const coverImage = currentPodcast?.cover_image;

  /* Auto-rotate */
  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const ms = currentSlide?.interval || DEFAULT_INTERVAL;
    const timer = setTimeout(() => setActiveIndex((prev) => (prev + 1) % slides.length), ms);
    return () => clearTimeout(timer);
  }, [activeIndex, paused, slides, currentSlide]);

  const goToSlide = useCallback((i) => setActiveIndex(i), []);

  /* Swipe navigation */
  const touchRef = useRef({ startX: 0, startY: 0 });
  const SWIPE_THRESHOLD = 50;

  const handleTouchStart = useCallback((e) => {
    setPaused(true);
    const touch = e.touches[0];
    touchRef.current = { startX: touch.clientX, startY: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((e) => {
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchRef.current.startX;
    const deltaY = touch.clientY - touchRef.current.startY;

    // Only trigger if horizontal swipe is dominant
    if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      if (deltaX < 0) {
        // Swipe left → next slide
        setActiveIndex((prev) => (prev + 1) % slides.length);
      } else {
        // Swipe right → previous slide
        setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
      }
    }
    setPaused(false);
  }, [slides.length]);

  // Use minHeight (not a fixed height) so slides with tall content — long
  // titles or a wrapping description on narrow-but-short viewports — can
  // grow past the clamp baseline instead of clipping the badge at the top.
  const heroMinHeight = 'clamp(360px, 46vh, 460px)';

  return (
    <section
      className="relative w-full overflow-hidden flex flex-col justify-end"
      style={{ minHeight: heroMinHeight }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Background ── */}
      <div className="absolute inset-0 bg-[#08080e]">
        {/* Blurred cover art wash */}
        <AnimatePresence mode="sync">
          {coverImage && (
            <motion.div
              key={coverImage}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2 }}
              className="absolute inset-0"
            >
              <img
                src={coverImage}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ filter: 'blur(70px) saturate(1.4) brightness(0.3)', transform: 'scale(1.3)' }}
                draggable={false}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Crisp full-bleed cover (sm+): promotes the artwork from a
            right-side thumbnail into the hero's dominant visual, with a
            slight clockwise tilt. Scale compensates for rotation so the
            rotated corners never expose the backdrop. */}
        {coverImage && (
          <AnimatePresence mode="sync">
            <motion.div
              key={`bg-cover-${coverImage}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 hidden sm:block overflow-hidden pointer-events-none"
              aria-hidden="true"
            >
              <img
                src={coverImage}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{
                  transform: 'rotate(2.5deg) scale(1.12)',
                  transformOrigin: 'center',
                  filter: 'saturate(1.1) brightness(0.85)',
                }}
                draggable={false}
              />
            </motion.div>
          </AnimatePresence>
        )}

        {/* Readability overlays — lighter on mobile (where the stylized
            right-side artwork does most of the work). On sm+ the full-bleed
            cover takes over, so the left half stays deeply dark for text
            readability while the right bleeds to near-transparent. */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#08080e]/95 via-[#08080e]/50 to-transparent sm:from-[#08080e]/95 sm:via-[#08080e]/70 sm:to-[#08080e]/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#08080e] via-transparent to-[#08080e]/40" />

        {/* Accent orbs */}
        <div className="absolute w-[40rem] h-[40rem] rounded-full blur-[200px] opacity-[0.06]" style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)`, top: '-25%', left: '-10%' }} />
        <div className="absolute w-[30rem] h-[30rem] rounded-full blur-[160px] opacity-[0.04]" style={{ background: `radial-gradient(circle, ${accentAlt}, transparent 70%)`, bottom: '-15%', right: '-5%' }} />

        {/* Grain */}
        <div className="absolute inset-0 opacity-[0.018]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '128px 128px' }} />

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-eeriecast-surface to-transparent" />
      </div>

      {/* ── Gold sparkle particles (promo slide) ── */}
      <AnimatePresence>
        {isPromo && (
          <motion.div
            key="gold-particles"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 z-[1]"
          >
            <GoldParticles />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mobile artwork (behind text, stylized) ── */}
      {coverImage && (
        <div className="absolute inset-0 z-[1] sm:hidden pointer-events-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={`mobile-art-${coverImage}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 flex items-center justify-end"
            >
              <div
                className={`relative ${currentSlide.isBook ? 'w-[55%]' : 'w-[60%]'} max-w-[240px] mr-[-8%]`}
                style={{ aspectRatio: currentSlide.isBook ? '2 / 3' : '1 / 1' }}
              >
                {/* Accent glow */}
                <div className="absolute -inset-6 rounded-3xl blur-[50px] opacity-30" style={{ background: accent }} />
                <img
                  src={coverImage}
                  alt=""
                  className="w-full h-full object-cover rounded-2xl opacity-[0.45]"
                  style={{ filter: 'saturate(1.2)', maskImage: 'linear-gradient(to left, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)' }}
                  draggable={false}
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* ── Content ── */}
      <div className="relative z-10 w-full px-5 sm:px-6 lg:px-10 pt-6 sm:pt-8 pb-8 sm:pb-10">
        <div className="w-full flex items-end justify-between gap-6 lg:gap-12">

          {/* Left: text */}
          <div className="flex-1 min-w-0 max-w-lg">
            <AnimatePresence mode="wait">
              <SlideContent
                key={currentSlide.id || currentSlide.slug}
                slide={currentSlide}
                podcast={currentPodcast}
                onPlay={onPlay}
                navigate={navigate}
              />
            </AnimatePresence>

            {/* Dots */}
            {slides.length > 1 && (
              <div className="mt-6">
                <SlideDots count={slides.length} active={activeIndex} onDotClick={goToSlide} slides={slides} />
              </div>
            )}
          </div>

          {/* On sm+ the crisp cover becomes the full-bleed hero background
              (rendered in the background layer above), so no right-side
              thumbnail is needed here. Mobile keeps its stylized artwork
              rendered behind the text in the Mobile Artwork block. */}
        </div>
      </div>
    </section>
  );
}
