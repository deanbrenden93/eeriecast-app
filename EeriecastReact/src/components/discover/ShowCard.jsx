import { Play } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import PropTypes from 'prop-types';

export default function ShowCard({ podcast, onPlay, subtext = "" }) {
  const navigate = useNavigate();
  const handleCardClick = () => {
    // ALWAYS navigate to Episodes page on card click per client request
    if (podcast?.id) navigate(`${createPageUrl('Episodes')}?id=${encodeURIComponent(podcast.id)}`);
  };

  const handlePlayClick = (e) => {
    e.stopPropagation(); // prevent card click navigation
    if (typeof onPlay === 'function') onPlay(podcast);
  };

  return (
    <div 
      className="group cursor-pointer bg-gray-800/60 hover:bg-gray-700/80 border border-gray-700/50 rounded-lg transition-all duration-300 h-full flex flex-col overflow-hidden"
      onClick={handleCardClick}
    >
      <div className="relative aspect-square bg-gray-800 rounded-t-lg overflow-hidden">
        {podcast.cover_image ? (
          <img
            src={podcast.cover_image}
            alt={podcast.title}
            className="block w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
            <span className="text-4xl">🎧</span>
          </div>
        )}

        <div className="absolute inset-0 rounded-[inherit] bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button 
            className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors shadow-xl"
            onClick={handlePlayClick}
          >
            <Play className="w-4 h-4 text-black ml-0.5 fill-black" />
          </button>
        </div>
      </div>
      <div className="p-3 mt-auto">
        <h3 className="text-purple-400 font-semibold text-sm line-clamp-2 leading-tight uppercase mb-1">
          <Link
            to={`${createPageUrl('Episodes')}?id=${encodeURIComponent(podcast.id)}`}
            onClick={(e) => e.stopPropagation()}
            className="hover:text-blue-400 transition-colors"
            title={podcast.title}
          >
            {podcast.title}
          </Link>
        </h3>
        <p className="text-white text-xs leading-tight">
          {subtext}
        </p>
      </div>
    </div>
  );
}

ShowCard.propTypes = {
  podcast: PropTypes.object.isRequired,
  onPlay: PropTypes.func,
  subtext: PropTypes.string,
};
