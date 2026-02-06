import { Play } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import PropTypes from 'prop-types';

export default function ShowCard({ podcast, onPlay, subtext = "" }) {
  const navigate = useNavigate();
  const handleCardClick = () => {
    if (podcast?.id) navigate(`${createPageUrl('Episodes')}?id=${encodeURIComponent(podcast.id)}`);
  };

  const handlePlayClick = (e) => {
    e.stopPropagation();
    if (typeof onPlay === 'function') onPlay(podcast);
  };

  return (
    <div 
      className="eeriecast-card group cursor-pointer h-full flex flex-col overflow-hidden"
      onClick={handleCardClick}
    >
      <div className="relative aspect-square bg-eeriecast-surface-light rounded-t-lg overflow-hidden">
        {podcast.cover_image ? (
          <img
            src={podcast.cover_image}
            alt={podcast.title}
            className="block w-full h-full object-cover transition-all duration-700 group-hover:scale-105 group-hover:brightness-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-eeriecast-surface-light to-eeriecast-surface">
            <span className="text-4xl opacity-40">🎧</span>
          </div>
        )}

        {/* Hover play overlay */}
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500">
          <button 
            className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-500 transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:scale-105"
            onClick={handlePlayClick}
          >
            <Play className="w-4 h-4 text-white ml-0.5 fill-white" />
          </button>
        </div>
      </div>
      <div className="p-3 mt-auto">
        <h3 className="text-red-400/90 font-semibold text-sm line-clamp-2 leading-tight uppercase mb-1 group-hover:text-red-300 transition-colors duration-300">
          <Link
            to={`${createPageUrl('Episodes')}?id=${encodeURIComponent(podcast.id)}`}
            onClick={(e) => e.stopPropagation()}
            className="hover:text-red-300 transition-colors"
            title={podcast.title}
          >
            {podcast.title}
          </Link>
        </h3>
        <p className="text-zinc-500 text-xs leading-tight">
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
