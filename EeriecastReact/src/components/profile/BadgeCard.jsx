import React from "react";

export default function BadgeCard({ icon, name, minMinutes, unlocked }) {
  const requirementHours = Math.floor(minMinutes / 60);
  const requirementText = `${requirementHours}h listening`;

  return (
    <div
      className={`p-4 rounded-lg flex flex-col items-center justify-center text-center transition-all duration-300 aspect-square hover:transform hover:scale-105 hover:-translate-y-1 ${
        unlocked
          ? 'opacity-100 bg-gradient-to-br from-red-800/30 to-red-900/20 border border-red-500/20'
          : 'opacity-50 bg-black/50'
      }`}
    >
      <div className="w-12 h-12 flex items-center justify-center mb-2">
        {typeof icon === 'string' ? (
          <span className="text-3xl">{icon}</span>
        ) : (
          React.cloneElement(icon, { className: 'w-8 h-8 text-white' })
        )}
      </div>
      <p className="font-semibold text-sm text-white mb-1 line-clamp-2">{name}</p>
      <p className="text-xs text-gray-400">{requirementText}</p>
    </div>
  );
}