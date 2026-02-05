import React from "react";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

export default function FeaturedHero({ podcast, onPlay }) {
  return (
    <section className="hero-section relative py-20 md:py-32 min-h-[60vh] flex items-center text-left overflow-hidden w-full">
      {/* Background Gradients - Full Width */}
      <div className="absolute inset-0 bg-black z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(124,58,237,0.15),_transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(236,72,153,0.15),_transparent_50%)]"></div>
      </div>

      <div className="hero-container relative z-10 w-full px-10">
        <div className="hero-content flex flex-col items-start">
          {/* Overline */}
          <div className="hero-overline inline-flex items-center gap-3 bg-gray-800/50 border border-gray-700 text-purple-300 text-sm font-medium tracking-wide px-4 py-2 rounded-full mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-pulse-glow absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
            </span>
            FEATURED COLLECTION
          </div>

          {/* Title */}
          <h1 className="hero-title font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white via-violet-400 to-pink-500"
              style={{
                fontSize: 'clamp(48px, 8vw, 72px)',
                animation: 'gradient-shift 8s ease infinite',
                backgroundSize: '200% 200%',
              }}
          >
            Stories That Move You
          </h1>

          {/* Description */}
          <p className="hero-description text-lg md:text-xl text-gray-300 mb-12 leading-relaxed max-w-2xl">
            Immerse yourself in award-winning podcasts, from gripping mysteries 
            to profound documentaries. Discover narratives that challenge, inspire, 
            and transform.
          </p>

          {/* Actions */}
          <div className="hero-actions">
            <Button 
              onClick={() => onPlay(podcast)}
              className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-white px-8 py-6 rounded-xl text-lg font-semibold flex items-center gap-3 transition-all duration-300 hover:scale-105 transform-gpu hover:-translate-y-1 shadow-2xl shadow-purple-600/20"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>START LISTENING</span>
            </Button>
          </div>
        </div>
      </div>
      
      {/* Keyframes for animations */}
      <style>{`
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes pulse-glow {
          0%, 100% {
            transform: scale(1);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.75);
            opacity: 0;
          }
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </section>
  );
}