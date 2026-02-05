import React, { useState, useEffect } from "react";
import { User as UserEntity } from '@/api/entities';
import { Button } from "@/components/ui/button";
import { User, Ghost, Skull, Moon, Headphones } from "lucide-react";
import AvatarOption from "../components/profile/AvatarOption";
import BadgeCard from "../components/profile/BadgeCard";

// Mock data for avatars and badges
const avatars = [
  { id: 'user', icon: <User className="w-8 h-8" />, unlocked: true },
  { id: 'ghost', icon: <Ghost className="w-8 h-8" />, unlocked: true },
  { id: 'skull', icon: <Skull className="w-8 h-8" />, unlocked: true },
  { id: 'demon', icon: '😈', unlocked: false },
  { id: 'alien', icon: '👽', unlocked: false },
  { id: 'clown', icon: '🤡', unlocked: false },
];

const badges = [
  { id: 'novice', icon: <Headphones className="w-8 h-8" />, name: 'Novice Listener', minMinutes: 0, unlocked: true },
  { id: 'enthusiast', icon: '👻', name: 'Horror Enthusiast', minMinutes: 600, unlocked: true },
  { id: 'seeker', icon: '😱', name: 'Fear Seeker', minMinutes: 1800, unlocked: true },
  { id: 'walker', icon: <Moon className="w-8 h-8" />, name: 'Nightmare Walker', minMinutes: 3600, unlocked: false },
  { id: 'master', icon: <Skull className="w-8 h-8" />, name: 'Terror Master', minMinutes: 7200, unlocked: false },
  { id: 'incarnate', icon: '🔥', name: 'Darkness Incarnate', minMinutes: 14400, unlocked: false },
];

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAvatar, setSelectedAvatar] = useState(avatars[0]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const me = await UserEntity.me();
        setUser(me);
      } catch {
        setUser({ full_name: 'Guest User' }); // Guest user fallback
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleAvatarSelect = (avatar) => {
    setSelectedAvatar(avatar);
    // Update global state here if needed
  };

  if (loading) {
    return <div className="text-white text-center py-10">Loading profile...</div>;
  }

  const currentBadge = badges.find(b => b.unlocked) || badges[0];

  return (
    <div className="min-h-screen bg-black text-white py-6 md:py-10">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-2xl md:text-4xl font-bold mb-6 md:mb-10 tracking-wider">PROFILE</h1>

        {/* User Info Card */}
        <div className="bg-[#2A2A2E] rounded-2xl p-4 md:p-8 flex flex-col md:flex-row items-center md:items-center gap-4 md:gap-8 mb-6 md:mb-8">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            {typeof selectedAvatar.icon === 'string' ? (
              <span className="text-4xl md:text-6xl">{selectedAvatar.icon}</span>
            ) : (
              React.cloneElement(selectedAvatar.icon, { className: 'w-12 h-12 md:w-16 md:h-16 text-white' })
            )}
          </div>
          <div className="flex-1 text-center md:text-left w-full">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-1 md:mb-2">{user.full_name}</h2>
            <p className="text-gray-300 text-base md:text-lg mb-4 md:mb-6">{currentBadge.name}</p>
            <Button className="bg-red-600 hover:bg-red-700 text-white px-6 md:px-8 py-2 md:py-3 rounded-full font-semibold text-base md:text-lg w-full md:w-auto">
              Edit Profile
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
          <div className="bg-[#2A2A2E] rounded-2xl p-4 md:p-6 text-center">
            <p className="text-2xl md:text-4xl font-bold text-red-500 mb-1">0h 57m</p>
            <p className="text-xs md:text-sm text-gray-400 tracking-widest">TOTAL LISTENING TIME</p>
          </div>
          <div className="bg-[#2A2A2E] rounded-2xl p-4 md:p-6 text-center">
            <p className="text-2xl md:text-4xl font-bold text-red-500 mb-1">6</p>
            <p className="text-xs md:text-sm text-gray-400 tracking-widest">EPISODES PLAYED</p>
          </div>
          <div className="bg-[#2A2A2E] rounded-2xl p-4 md:p-6 text-center">
            <p className="text-2xl md:text-4xl font-bold text-red-500 mb-1">None Yet</p>
            <p className="text-xs md:text-sm text-gray-400 tracking-widest">FAVORITE SHOW</p>
          </div>
        </div>

        {/* Choose Your Avatar */}
        <div className="bg-[#2A2A2E] rounded-2xl p-4 md:p-6 mb-6 md:mb-8">
          <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4">Choose Your Avatar</h3>
          <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-3 md:mb-4">
            {avatars.map(avatar => (
              <AvatarOption
                key={avatar.id}
                icon={avatar.icon}
                unlocked={avatar.unlocked}
                selected={selectedAvatar.id === avatar.id}
                onSelect={() => handleAvatarSelect(avatar)}
              />
            ))}
          </div>
          <p className="text-xs md:text-sm text-gray-400">Unlock more avatars by earning badges through listening time.</p>
        </div>

        {/* Your Badges */}
        <div className="bg-[#2A2A2E] rounded-2xl p-4 md:p-6 mb-6 md:mb-8">
          <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4">Your Badges</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
            {badges.map(badge => (
              <BadgeCard
                key={badge.id}
                icon={badge.icon}
                name={badge.name}
                minMinutes={badge.minMinutes}
                unlocked={badge.unlocked}
              />
            ))}
          </div>
        </div>
        
        <div className="text-center">
          <Button variant="outline" className="border-red-600 text-red-500 hover:bg-red-600 hover:text-white rounded-full px-6 md:px-8 py-2 md:py-3 font-semibold text-sm md:text-base transition-colors w-full sm:w-auto">
            View All Your Comments
          </Button>
        </div>

      </div>
    </div>
  );
}