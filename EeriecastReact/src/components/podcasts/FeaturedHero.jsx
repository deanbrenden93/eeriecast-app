import React from "react";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

export default function FeaturedHero({ podcast, onPlay }) {
  return (
    <section className="hero-section relative py-24 md:py-36 min-h-[60vh] flex items-center text-left overflow-hidden w-full eeriecast-fog">
      {/* Background */}
      <div className="absolute inset-0 bg-eeriecast-surface z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(220,38,38,0.08),_transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(124,58,237,0.06),_transparent_50%)]" />
        {/* Subtle noise texture feel via gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,_rgba(220,38,38,0.04),_transparent_40%)]" />
      </div>

      <div className="hero-container relative z-10 w-full px-6 lg:px-10">
        <div className="hero-content flex flex-col items-start max-w-3xl">
          {/* Overline Badge */}
          <div className="inline-flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] text-red-400 text-xs font-semibold tracking-widest px-4 py-2 rounded-full mb-8 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-pulse-glow absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            FEATURED COLLECTION
          </div>

          {/* Title */}
          <h1
            className="hero-title font-display font-extrabold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white via-red-200 to-red-400 italic pr-3"
            style={{
              fontSize: 'clamp(40px, 7vw, 68px)',
              animation: 'gradient-shift 8s ease infinite',
              backgroundSize: '200% 200%',
              lineHeight: '1.05',
              letterSpacing: '-0.02em',
            }}
          >
            Stories That<br />Haunt You
          </h1>

          {/* Description */}
          <p className="hero-description text-base md:text-lg text-zinc-400 mb-12 leading-relaxed max-w-xl">
            Immerse yourself in spine-chilling podcasts, from terrifying true stories
            to supernatural fiction. Discover narratives that will keep you awake
            at night.
          </p>

          {/* Actions */}
          <div className="hero-actions">
            <Button 
              onClick={() => onPlay(podcast)}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-8 py-6 rounded-xl text-base font-semibold flex items-center gap-3 transition-all duration-500 hover:scale-[1.02] transform-gpu shadow-[0_8px_32px_rgba(220,38,38,0.2)] hover:shadow-[0_12px_40px_rgba(220,38,38,0.3)]"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>START LISTENING</span>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
