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
      <div className="relative aspect-square rounded-lg overflow-hidden mb-3 bg-gray-800">
        {podcast.cover_image ? (
          <img
            src={podcast.cover_image}
            alt={podcast.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
            <span className="text-4xl">🎧</span>
          </div>
        )}
        
        {/* Overlay */}
        <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity duration-300 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}>
          <button className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors shadow-2xl">
            <Play className="w-6 h-6 text-white ml-1 fill-white" />
          </button>
        </div>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-2">
          {podcast.is_exclusive && (
            <div className="px-2 py-1 bg-pink-600 rounded text-xs font-bold text-white uppercase tracking-wider">
              Exclusive
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="space-y-1">
        <h3 className="text-white font-semibold text-sm line-clamp-2 group-hover:text-red-400 transition-colors">
          {podcast.title}
        </h3>
        <p className="text-gray-400 text-xs">
          {podcast.author}
        </p>
        {podcast.duration && (
          <div className="flex items-center gap-1 text-gray-500 text-xs">
            <Clock className="w-3 h-3" />
            {podcast.duration}
          </div>
        )}
      </div>
    </div>
  );
}