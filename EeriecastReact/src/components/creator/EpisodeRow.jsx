import { useState } from 'react';
import PropTypes from 'prop-types';
import { Play, Plus, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/context/UserContext.jsx';
import { useAuthModal } from '@/context/AuthModalContext.jsx';

export default function EpisodeRow({ podcast, onPlay, onAddToPlaylist }) {
  const [isFavorited, setIsFavorited] = useState(false);
  const { isAuthenticated } = useUser();
  const { openAuth } = useAuthModal();

  // Safely format the date
  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Invalid Date';
    }
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/50 transition-colors group">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0">
          {podcast.cover_image ? (
            <img src={podcast.cover_image} alt={podcast.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-2xl">🎧</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-base truncate mb-1">{podcast.title}</h3>
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <span className="text-purple-400 font-medium">{podcast.author}</span>
            <span>•</span>
            <span>{podcast.duration || "00:58:08"}</span>
            <span>•</span>
            <span>{formatDate(podcast.created_date)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-gray-400">
        <button className="p-2 hover:text-white transition-colors" onClick={() => { if (!isAuthenticated) { openAuth('login'); return; } if (onAddToPlaylist) onAddToPlaylist(podcast); }} title="Add to playlist">
          <Plus className="w-5 h-5" />
        </button>
        <button 
          onClick={() => { if (!isAuthenticated) { openAuth('login'); return; } setIsFavorited(!isFavorited); }}
          className="p-2 hover:text-white transition-colors"
        >
          <Heart className={`w-5 h-5 ${isFavorited ? 'text-red-500 fill-current' : ''}`} />
        </button>
        <Button
          size="icon"
          onClick={() => onPlay(podcast)}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white w-9 h-9 rounded-lg"
        >
          <Play className="w-4 h-4 fill-white ml-0.5" />
        </Button>
      </div>
    </div>
  );
}

EpisodeRow.propTypes = {
  podcast: PropTypes.object.isRequired,
  onPlay: PropTypes.func,
  onAddToPlaylist: PropTypes.func,
};
