import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const categories = [
  { name: 'PARANORMAL', icon: '👻', id: 'paranormal', glowColor: 'rgba(238, 242, 255, 0.5)' },
  { name: 'TRUE CRIME', icon: '🔍', id: 'true_crime', glowColor: 'rgba(251, 113, 133, 0.5)' },
  { name: 'HISTORY', icon: '📜', id: 'history', glowColor: 'rgba(252, 211, 77, 0.5)' },
  { name: 'FOLKLORE', icon: '🧙‍♂️', id: 'folklore', glowColor: 'rgba(100, 150, 255, 0.5)' },
  { name: 'NON-FICTION', icon: '📖', id: 'non-fiction', glowColor: 'rgba(200, 220, 255, 0.5)' },
  { name: 'FICTION', icon: '📚', id: 'fiction', glowColor: 'rgba(220, 100, 255, 0.5)' },
  { name: 'COMEDY', icon: '😂', id: 'comedy', glowColor: 'rgba(255, 180, 50, 0.6)' },
  { name: 'AUDIOBOOKS', icon: '🎧', id: 'audiobooks', glowColor: 'rgba(200, 220, 255, 0.5)' },
  { name: 'EBOOKS', icon: '📓', id: 'ebooks', glowColor: 'rgba(150, 255, 150, 0.5)' },
  { name: 'FREE', icon: '🎁', id: 'free', glowColor: 'rgba(255, 80, 80, 0.5)' },
  { name: 'MEMBERS-ONLY', icon: '⭐', id: 'members-only', glowColor: 'rgba(255, 215, 0, 0.6)' },
];

export default function CategoryExplorer() {
  return (
    <div>
      <h2 className="text-3xl font-bold text-white mb-6">Explore Categories</h2>
      {/* Horizontal scroll container */}
      <div
        className="overflow-x-auto overflow-y-hidden -mx-1 px-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        aria-label="Categories"
      >
        <div className="flex gap-4 snap-x snap-mandatory">
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`${createPageUrl("Category")}?category=${encodeURIComponent(category.name.toLowerCase())}`}
              className="group flex-shrink-0 snap-start"
            >
              <div className="w-36 sm:w-40 md:w-44 bg-slate-800 hover:bg-slate-700 transition-colors duration-300 rounded-xl p-4 h-32 flex flex-col items-center justify-center text-center space-y-3">
                <span
                  className="text-4xl"
                  style={{ filter: `drop-shadow(0 0 10px ${category.glowColor})` }}
                >
                  {category.icon}
                </span>
                <span className="text-white text-xs font-bold uppercase tracking-wider leading-tight">
                  {category.name}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}