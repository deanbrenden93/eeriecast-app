import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const categories = [
  { id: 'paranormal', name: 'PARANORMAL', icon: '👻', color: 'from-purple-600 to-purple-800' },
  { id: 'true_crime', name: 'TRUE CRIME', icon: '🔍', color: 'from-red-600 to-red-800' },
  { id: 'history', name: 'HISTORY', icon: '📜', color: 'from-amber-600 to-amber-800' },
  { id: 'folklore', name: 'FOLKLORE', icon: '🌙', color: 'from-blue-600 to-blue-800' },
  { id: 'fiction', name: 'FICTION', icon: '📚', color: 'from-green-600 to-green-800' },
  { id: 'comedy', name: 'COMEDY', icon: '😂', color: 'from-yellow-600 to-yellow-800' },
  { id: 'members_only', name: 'MEMBERS ONLY', icon: '⭐', color: 'from-indigo-600 to-indigo-800' },
];

export default function CategoryGrid() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-8">Explore Categories</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {categories.map((category) => (
          <Link
            key={category.id}
            to={`${createPageUrl("Podcasts")}?category=${category.id}`}
            className="group"
          >
            <div className={`bg-gradient-to-br ${category.color} rounded-xl p-6 aspect-square flex flex-col items-center justify-center transition-all duration-300 hover:scale-105 hover:shadow-2xl cursor-pointer`}>
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-300">
                {category.icon}
              </div>
              <span className="text-white text-xs font-bold text-center leading-tight">
                {category.name}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}