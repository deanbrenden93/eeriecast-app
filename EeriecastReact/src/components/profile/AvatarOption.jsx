import React from "react";
import { Lock } from "lucide-react";

export default function AvatarOption({ icon, unlocked, selected, onSelect }) {
  return (
    <button
      onClick={unlocked ? onSelect : undefined}
      className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 ${
        unlocked ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
      } ${
        selected && unlocked 
          ? 'ring-2 ring-red-500 shadow-lg shadow-red-500/30 bg-gradient-to-br from-gray-600 to-gray-700' 
          : unlocked
          ? 'bg-gradient-to-br from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700'
          : 'bg-black/50'
      }`}
      disabled={!unlocked}
    >
      {unlocked ? (
        typeof icon === 'string' ? (
          <span className="text-3xl">{icon}</span>
        ) : (
          React.cloneElement(icon, { className: 'w-8 h-8 text-white' })
        )
      ) : (
        <div className="absolute inset-0 bg-black/70 rounded-full flex items-center justify-center">
          <Lock className="w-6 h-6 text-gray-500" />
        </div>
      )}
    </button>
  );
}