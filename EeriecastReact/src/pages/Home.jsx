
import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import AnimatedBackground from "../components/home/AnimatedBackground";

export default function Home() {
  return (
    <div className="relative h-screen bg-black overflow-hidden">
      <AnimatedBackground />

      {/* Vignette Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_60%,_black)] z-10" />

      {/* Content Overlay */}
      <div className="relative z-20 flex flex-col items-center justify-between h-full text-center text-white p-6">
        {/* Logo and Tagline (Top) */}
        <div className="pt-20 md:pt-24">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/e37bc9c15_logo.png"
            alt="EERIECAST"
            className="h-16 md:h-20 filter invert mb-4 mx-auto"
          />
          <p className="text-gray-400 tracking-widest text-xs md:text-sm uppercase">
            Scary Stories, Horror Podcasts and Audiobooks
          </p>
        </div>

        {/* Buttons (Bottom) */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8 w-full sm:w-auto">
          <Link to={createPageUrl("Podcasts")} className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full border-gray-600 bg-black/50 text-white hover:bg-white hover:text-black px-8 py-6 rounded-xl text-sm font-semibold transition-all duration-300"
            >
              START LISTENING
            </Button>
          </Link>
          <Link to={createPageUrl("Premium")} className="w-full sm:w-auto">
            <Button
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-black px-8 py-6 rounded-xl text-sm font-semibold transition-all duration-300"
            >
              GO PREMIUM
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
