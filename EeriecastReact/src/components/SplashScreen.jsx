import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import logo from '@/assets/logo.png';

/* ───────────────────────────────────────────────
   Eeriecast — "Rising from the Deep" Splash
   ─────────────────────────────────────────────── */

/** Time (ms) after mount when the exit fade begins. */
const EXIT_AT_MS = 4300;

function makeBubbles(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: 5 + Math.random() * 90,
    size: 1.5 + Math.random() * 4.5,
    delay: Math.random() * 3,
    duration: 4 + Math.random() * 5,
    opacity: 0.06 + Math.random() * 0.18,
    drift: -20 + Math.random() * 40,
  }));
}

/** Quintic ease-out — very long, gentle tail so distortion never "snaps" off. */
function easeOutQuint(t) {
  return 1 - Math.pow(1 - t, 5);
}

export default function SplashScreen({ onComplete }) {
  const cbRef = useRef(onComplete);
  cbRef.current = onComplete;
  const skippedRef = useRef(false);

  const [logoFailed, setLogoFailed] = useState(false);
  const bubbles = useMemo(() => makeBubbles(30), []);

  /** Click / tap anywhere to skip to the end of the splash */
  const handleSkip = () => {
    if (skippedRef.current) return;
    skippedRef.current = true;
    cbRef.current?.();
  };

  // Direct refs to SVG filter primitives for 60 fps updates
  const displacementRef = useRef(null);
  const blurRef = useRef(null);
  const offsetRef = useRef(null);
  const logoWrapRef = useRef(null);
  const filterClearedRef = useRef(false);

  /* ── Smooth rAF animation for water flow + displacement + blur ── */
  useEffect(() => {
    const DELAY = 500;       // ms of full distortion before clearing begins
    const DURATION = 3500;   // ms for clearing (long tail via easeOutQuint)
    const MAX_DISP = 22;     // peak displacement scale
    const MAX_BLUR = 2.5;    // peak Gaussian blur
    const start = performance.now();
    let raf;

    const tick = (now) => {
      const elapsed = now - start;
      const dispNode = displacementRef.current;
      const blurNode = blurRef.current;
      const offNode = offsetRef.current;

      // ── Flowing water: offset the noise pattern with dual sine waves ──
      const t = elapsed < DELAY
        ? 0
        : Math.min((elapsed - DELAY) / DURATION, 1);
      const eased = easeOutQuint(t);

      // Flow amplitude diminishes as distortion clears (water calms)
      const flowAmp = 1 - eased * 0.85;
      const flowX =
        Math.sin(elapsed * 0.0007) * 30 * flowAmp +
        Math.sin(elapsed * 0.0012) * 15 * flowAmp;
      const flowY =
        Math.cos(elapsed * 0.0005) * 20 * flowAmp +
        Math.cos(elapsed * 0.0009) * 10 * flowAmp;

      if (offNode) {
        offNode.setAttribute('dx', String(flowX));
        offNode.setAttribute('dy', String(flowY));
      }

      // ── Distortion + blur: clear smoothly with quintic ease-out ──
      if (elapsed < DELAY) {
        const breath = Math.sin(elapsed * 0.004) * 0.05;
        if (dispNode) dispNode.setAttribute('scale', String(MAX_DISP * (1 + breath)));
        if (blurNode) blurNode.setAttribute('stdDeviation', String(MAX_BLUR));
      } else {
        const disp = MAX_DISP * (1 - eased);
        const blur = MAX_BLUR * (1 - eased);
        if (dispNode) dispNode.setAttribute('scale', String(Math.max(0, disp)));
        if (blurNode) blurNode.setAttribute('stdDeviation', String(Math.max(0, blur).toFixed(2)));

        // Once distortion is sub-pixel, remove the filter via direct DOM
        // manipulation (no React re-render → no main-thread jank).
        if (eased > 0.997 && !filterClearedRef.current) {
          filterClearedRef.current = true;
          if (logoWrapRef.current) {
            logoWrapRef.current.style.filter = 'none';
          }
        }
      }

      if (elapsed < EXIT_AT_MS) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ── Exit timer ── */
  useEffect(() => {
    const timer = setTimeout(() => cbRef.current?.(), EXIT_AT_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[100] overflow-hidden select-none cursor-pointer"
      style={{ backgroundColor: '#000' }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
      onClick={handleSkip}
    >
      {/* ── SVG filter: turbulence → flowing offset → displacement → blur ── */}
      <svg className="absolute" width="0" height="0" aria-hidden="true">
        <defs>
          <filter id="splash-water" x="-40%" y="-40%" width="180%" height="180%">
            {/* Static noise pattern — the "shape" of the water distortion */}
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.01 0.018"
              numOctaves="3"
              seed="3"
              result="noise"
            />
            {/* Offset pans the noise to create flowing water movement */}
            <feOffset
              ref={offsetRef}
              in="noise"
              dx="0"
              dy="0"
              result="flowingNoise"
            />
            {/* Displacement warps the logo using the flowing noise */}
            <feDisplacementMap
              ref={displacementRef}
              in="SourceGraphic"
              in2="flowingNoise"
              scale="22"
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />
            {/* Underwater blur that clears as the logo surfaces */}
            <feGaussianBlur
              ref={blurRef}
              in="displaced"
              stdDeviation="2.5"
            />
          </filter>
        </defs>
      </svg>

      {/* ── Underwater caustic light patterns ── */}
      <div className="splash-caustic splash-caustic-a" />
      <div className="splash-caustic splash-caustic-b" />

      {/* ── Faint light rays filtering down from above ── */}
      <div className="splash-ray splash-ray-1" />
      <div className="splash-ray splash-ray-2" />

      {/* ── Deep red glow pulsing from the abyss ── */}
      <div className="splash-depth-glow" />

      {/* ── Bubble particles ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {bubbles.map((b) => (
          <div
            key={b.id}
            className="splash-bubble absolute rounded-full"
            style={{
              left: `${b.left}%`,
              bottom: '-8px',
              width: b.size,
              height: b.size,
              background: `rgba(160, 190, 210, ${b.opacity})`,
              boxShadow: `0 0 ${b.size + 2}px rgba(160, 190, 210, ${b.opacity * 0.4})`,
              '--b-delay': `${b.delay}s`,
              '--b-dur': `${b.duration}s`,
              '--b-o': b.opacity,
              '--b-dx': `${b.drift}px`,
            }}
          />
        ))}
      </div>

      {/* ── Vignette (darkened edges for depth) ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      {/* ── Logo & tagline ── */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative flex flex-col items-center">
          {/* Logo — surfaces toward the viewer (top-down into dark water) */}
          <motion.div
            ref={logoWrapRef}
            style={{ filter: 'url(#splash-water)', willChange: 'transform, opacity' }}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              scale: { duration: 3.5, delay: 0.5, ease: [0.25, 0.1, 0.25, 1] },
              opacity: { duration: 2.2, delay: 0.4, ease: 'easeOut' },
            }}
          >
            {logoFailed ? (
              <span className="text-white text-3xl sm:text-4xl md:text-5xl font-display tracking-[0.15em] opacity-95">
                EERIECAST
              </span>
            ) : (
              <img
                src={logo}
                alt="EERIECAST"
                className="h-14 md:h-18 filter invert"
                draggable={false}
                onError={() => setLogoFailed(true)}
              />
            )}
          </motion.div>

          {/* Surface-break glow — flares outward when the logo arrives */}
          <motion.div
            className="absolute top-1/2 left-1/2 pointer-events-none"
            style={{
              width: 'min(500px, 90vw)',
              height: 80,
              borderRadius: '50%',
              background:
                'radial-gradient(ellipse at center, rgba(220,38,38,0.22) 0%, rgba(220,38,38,0.06) 50%, transparent 72%)',
            }}
            initial={{ opacity: 0, x: '-50%', y: '-50%', scaleX: 0.4 }}
            animate={{
              opacity: [0, 0, 0, 0.9, 0.35],
              x: '-50%',
              y: '-50%',
              scaleX: [0.4, 0.4, 0.4, 1.4, 1],
            }}
            transition={{
              duration: 4.5,
              times: [0, 0.25, 0.72, 0.88, 1],
              ease: 'easeOut',
            }}
          />

          {/* Tagline fades in once the logo has settled */}
          <motion.p
            className="mt-4 sm:mt-5 md:mt-6 text-zinc-600 tracking-[0.25em] text-[8px] sm:text-[10px] md:text-[11px] uppercase font-light whitespace-nowrap"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 3.3, ease: 'easeOut' }}
          >
            Horror Podcasts &middot; Supernatural Stories &middot; Audiobooks
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}
