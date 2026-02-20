import React, { useState } from "react";
import { Play, Clock } from "lucide-react";

export default function PodcastCard({ podcast, onPlay }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="group cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onPlay}
    >
      <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-eeriecast-surface-light eeriecast-card">
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-eeriecast-surface-light to-eeriecast-surface">
          <span className="text-4xl opacity-40">🎧</span>
        </div>
        {podcast.cover_image && (
          <img
            src={podcast.cover_image}
            alt={podcast.title}
            className="relative w-full h-full object-cover transition-all duration-700 group-hover:scale-105 group-hover:brightness-110"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        )}
        
        {/* Hover overlay */}
        <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-all duration-500 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}>
          <button className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-500 transition-all shadow-[0_0_25px_rgba(220,38,38,0.3)] hover:scale-105">
            <Play className="w-6 h-6 text-white ml-1 fill-white" />
          </button>
        </div>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-2">
          {podcast.is_exclusive && (
            <div className="px-2 py-1 bg-gradient-to-r from-red-600 to-red-700 rounded-md text-xs font-bold text-white uppercase tracking-wider shadow-[0_0_10px_rgba(220,38,38,0.3)]">
              Exclusive
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="space-y-1.5">
        <h3 className="text-white/90 font-semibold text-sm line-clamp-2 group-hover:text-red-400 transition-colors duration-300">
          {podcast.title}
        </h3>
        <p className="text-zinc-500 text-xs">
          {podcast.author}
        </p>
        {podcast.duration && (
          <div className="flex items-center gap-1 text-zinc-600 text-xs">
            <Clock className="w-3 h-3" />
            {podcast.duration}
          </div>
        )}
      </div>
    </div>
  );
}
