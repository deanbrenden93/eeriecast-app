import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Play, Crown } from "lucide-react";
import AnimatedBackground from "../components/home/AnimatedBackground";

export default function Home() {
  return (
    <div className="relative h-screen bg-eeriecast-surface overflow-hidden">
      <AnimatedBackground />

      {/* Multi-layered atmospheric overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_30%,_rgba(5,5,8,0.8)_70%,_rgba(5,5,8,1)_100%)] z-10" />
      <div className="absolute inset-0 bg-gradient-to-t from-eeriecast-surface via-transparent to-eeriecast-surface/60 z-10" />
      
      {/* Subtle red atmospheric glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse_at_center,_rgba(220,38,38,0.06)_0%,_transparent_70%)] z-10 pointer-events-none" />

      {/* Content */}
      <div className="relative z-20 flex flex-col items-center justify-between h-full text-center text-white p-6">
        {/* Logo and Tagline */}
        <div className="pt-20 md:pt-28 animate-fade-in">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/e37bc9c15_logo.png"
            alt="EERIECAST"
            className="h-14 md:h-18 filter invert mb-6 mx-auto opacity-95"
          />
          <p className="text-zinc-500 tracking-[0.3em] text-xs md:text-sm uppercase font-light">
            Horror Podcasts &middot; Supernatural Stories &middot; Audiobooks
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-12 w-full sm:w-auto animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <Link to={createPageUrl("Podcasts")} className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full border-white/10 bg-white/[0.03] text-white hover:bg-white hover:text-eeriecast-surface px-8 py-6 rounded-xl text-sm font-semibold transition-all duration-500 backdrop-blur-sm hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              START LISTENING
            </Button>
          </Link>
          <Link to={createPageUrl("Premium")} className="w-full sm:w-auto">
            <Button
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-8 py-6 rounded-xl text-sm font-semibold transition-all duration-500 shadow-[0_0_20px_rgba(220,38,38,0.15)] hover:shadow-[0_0_30px_rgba(220,38,38,0.3)] flex items-center justify-center gap-2"
            >
              <Crown className="w-4 h-4" />
              GO PREMIUM
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
