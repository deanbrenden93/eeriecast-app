/* eslint-disable react/prop-types */
import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { X, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart, Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext.jsx";
import { useAuthModal } from "@/context/AuthModalContext.jsx";
import { motion } from "framer-motion";

const updateRecentlyPlayed = (podcastId) => {
  try {
    const recentlyPlayed = JSON.parse(localStorage.getItem('recentlyPlayed') || '[]');
    const newRecentlyPlayed = [podcastId, ...recentlyPlayed.filter(id => id !== podcastId)].slice(0, 10); // Keep last 10
    localStorage.setItem('recentlyPlayed', JSON.stringify(newRecentlyPlayed));
  } catch (error) {
    console.error("Failed to update recently played list:", error);
  }
};

export default function PodcastModal({ podcast, onClose }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime] = useState("0:13");
  const [totalTime] = useState(podcast.duration || "59:09");
  const [isLiked, setIsLiked] = useState(false);
  const { isAuthenticated } = useUser();
  const { openAuth } = useAuthModal();

  useEffect(() => {
    // When modal opens, assume play starts for simplicity and update history
    updateRecentlyPlayed(podcast.id);
    setIsPlaying(true); // Auto-play on open
  }, [podcast.id]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <motion.div
      className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <span className="text-white font-medium">NOW PLAYING</span>
          <div className="flex items-center gap-4">
            <button className="p-2 text-gray-400 hover:text-white transition-colors">
              <Share className="w-5 h-5" />
            </button>
            <button 
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Podcast Info */}
        <div className="p-6 text-center">
          <div className="relative w-64 h-64 mx-auto mb-6 rounded-lg overflow-hidden">
            {podcast.cover_image ? (
              <img
                src={podcast.cover_image}
                alt={podcast.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                <span className="text-6xl">🎧</span>
              </div>
            )}
            <button
              onClick={() => { if (!isAuthenticated) { openAuth('login'); return; } setIsLiked(!isLiked); }}
              className="absolute top-4 right-4 p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'text-red-500 fill-red-500' : 'text-white'}`} />
            </button>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">{podcast.author}</h2>
            <h1 className="text-lg text-gray-300 mb-4">[{podcast.title}]</h1>
            
            <div className="flex items-center justify-center gap-4 text-sm">
              <button className="px-4 py-2 bg-orange-600 rounded text-white font-medium" onClick={() => { if (!isAuthenticated) { openAuth('login'); } }}>
                FOLLOW
              </button>
              <button className="text-gray-300 hover:text-white transition-colors">
                About
              </button>
              <button className="flex items-center gap-1 text-gray-300 hover:text-white transition-colors">
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>

          {/* Player Controls */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-center gap-6">
              <button className="p-2 text-gray-400 hover:text-white transition-colors">
                <Shuffle className="w-5 h-5" />
              </button>
              <button className="p-3 text-gray-400 hover:text-white transition-colors">
                <SkipBack className="w-6 h-6" />
              </button>
              <button 
                onClick={handlePlayPause}
                className="w-16 h-16 bg-white rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8 text-black fill-black" />
                ) : (
                  <Play className="w-8 h-8 text-black ml-1 fill-black" />
                )}
              </button>
              <button className="p-3 text-gray-400 hover:text-white transition-colors">
                <SkipForward className="w-6 h-6" />
              </button>
              <button className="p-2 text-gray-400 hover:text-white transition-colors">
                <Repeat className="w-5 h-5" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="px-4">
              <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                <span>{currentTime}</span>
                <span>{totalTime}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1">
                <div 
                  className="bg-red-500 h-1 rounded-full transition-all duration-300"
                  style={{ width: '15%' }}
                />
              </div>
            </div>
          </div>
        </div>

      </motion.div>
    </motion.div>
  );
}

PodcastModal.propTypes = {
  podcast: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    duration: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    title: PropTypes.string,
    author: PropTypes.string,
    cover_image: PropTypes.string,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
};
