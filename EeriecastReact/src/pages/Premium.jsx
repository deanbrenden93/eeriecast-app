import React from 'react';
import { Button } from '@/components/ui/button';
import { Infinity, ArrowDownToLine, Star, BookOpen, CircleSlash } from 'lucide-react';

const FeatureCard = ({ icon, title, description }) => (
  <div className="bg-[#1C1C1E] rounded-lg p-4 flex items-center space-x-4">
    <div className="bg-yellow-900/40 p-3 rounded-md">
      {icon}
    </div>
    <div>
      <h3 className="text-white font-semibold">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  </div>
);

const features = [
  {
    icon: <Infinity className="w-6 h-6 text-yellow-300" />,
    title: 'All 1,300+ Episodes',
    description: 'Every show, every episode, no limits',
  },
  {
    icon: <ArrowDownToLine className="w-6 h-6 text-yellow-300" />,
    title: 'Offline Downloads',
    description: 'Listen anywhere without internet',
  },
  {
    icon: <Star className="w-6 h-6 text-yellow-300" />,
    title: 'Exclusive Shows',
    description: 'Members-only horror content',
  },
  {
    icon: <BookOpen className="w-6 h-6 text-yellow-300" />,
    title: 'Horror Novels',
    description: 'Full audiobooks + eBook reader',
  },
  {
    icon: <CircleSlash className="w-6 h-6 text-yellow-300" />,
    title: 'No Ads Ever',
    description: 'Pure, uninterrupted horror',
  },
];

export default function Premium() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center py-12 px-4">
      <div className="w-full max-w-sm mx-auto">
        <div className="text-center mb-8">
          <p className="text-yellow-400 font-semibold tracking-widest text-sm mb-6">PREMIUM</p>
          <div className="inline-block bg-yellow-900/50 text-yellow-300 text-xs font-bold px-4 py-1.5 rounded-full mb-4">
            UNLIMITED ACCESS
          </div>
          <div className="flex items-baseline justify-center text-yellow-400">
            <span className="text-6xl font-bold tracking-tight">$7.99</span>
            <span className="text-xl font-medium text-yellow-500/80">/mo</span>
          </div>
        </div>

        <div className="space-y-3 mb-8">
          {features.map((feature, index) => (
            <FeatureCard key={index} {...feature} />
          ))}
        </div>
        
        <div className="text-center">
            <Button className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-6 text-lg rounded-xl transition-transform hover:scale-105">
                START FREE TRIAL
            </Button>
            <p className="text-gray-500 text-sm mt-4">7 days free • Cancel anytime</p>
        </div>
      </div>
    </div>
  );
}