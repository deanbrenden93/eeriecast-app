
import React, { useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

const SettingsCard = ({ title, children }) => (
  <div className="bg-[#1C1C1E] rounded-2xl p-6 mb-8">
    <h2 className="text-xl font-bold mb-6">{title}</h2>
    {children}
  </div>
);

const SettingsToggle = ({ label, checked, onCheckedChange }) => (
  <div className="flex items-center justify-between py-3 border-b border-gray-700/50 last:border-b-0">
    <label htmlFor={label} className="text-gray-200">
      {label}
    </label>
    <Checkbox 
      id={label}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="border-white bg-transparent data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
    />
  </div>
);

const PlaybackSpeedControl = ({ speed, setSpeed }) => {
  const speeds = ["0.5x", "0.75x", "1x", "1.25x", "1.5x", "2x"];
  return (
    <div className="flex items-center space-x-2 bg-gray-900/80 p-1 rounded-lg">
      {speeds.map(s => (
        <button
          key={s}
          onClick={() => setSpeed(s)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            speed === s
              ? 'bg-red-600 text-white'
              : 'text-gray-300 hover:bg-gray-700/50'
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
};

export default function Settings() {
  const [settings, setSettings] = useState({
    streamingQuality: '320kbps',
    downloadQuality: '320kbps',
    playbackSpeed: '1x',
    autoplay: true,
    skipSilence: false,
    rememberPosition: true,
    newEpisodeNotifications: true,
    recommendedContent: false,
    weeklyDigest: true,
    publicProfile: false,
    showActivity: false,
  });

  const handleToggle = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-black text-white py-10">
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex items-center gap-4 mb-10">
          <SettingsIcon className="w-8 h-8 text-gray-400" />
          <h1 className="text-4xl font-bold tracking-wider">Settings</h1>
        </div>

        <SettingsCard title="Audio Settings">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Streaming Quality</label>
              <Select defaultValue={settings.streamingQuality} onValueChange={value => setSettings(s => ({ ...s, streamingQuality: value }))}>
                <SelectTrigger className="w-full bg-black/50 border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="320kbps">High Quality (320kbps)</SelectItem>
                  <SelectItem value="128kbps">Standard Quality (128kbps)</SelectItem>
                  <SelectItem value="64kbps">Low Quality (64kbps)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Download Quality</label>
              <Select defaultValue={settings.downloadQuality} onValueChange={value => setSettings(s => ({ ...s, downloadQuality: value }))}>
                <SelectTrigger className="w-full bg-black/50 border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="320kbps">High Quality (320kbps)</SelectItem>
                  <SelectItem value="128kbps">Standard Quality (128kbps)</SelectItem>
                  <SelectItem value="64kbps">Low Quality (64kbps)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Playback Speed</label>
              <PlaybackSpeedControl speed={settings.playbackSpeed} setSpeed={value => setSettings(s => ({ ...s, playbackSpeed: value }))} />
            </div>
          </div>
        </SettingsCard>

        <SettingsCard title="Playback">
          <SettingsToggle label="Autoplay next episode" checked={settings.autoplay} onCheckedChange={() => handleToggle('autoplay')} />
          <SettingsToggle label="Skip silence" checked={settings.skipSilence} onCheckedChange={() => handleToggle('skipSilence')} />
          <SettingsToggle label="Remember playback position" checked={settings.rememberPosition} onCheckedChange={() => handleToggle('rememberPosition')} />
        </SettingsCard>

        <SettingsCard title="Notifications">
          <SettingsToggle label="New episode notifications" checked={settings.newEpisodeNotifications} onCheckedChange={() => handleToggle('newEpisodeNotifications')} />
          <SettingsToggle label="Recommended content" checked={settings.recommendedContent} onCheckedChange={() => handleToggle('recommendedContent')} />
          <SettingsToggle label="Weekly digest email" checked={settings.weeklyDigest} onCheckedChange={() => handleToggle('weeklyDigest')} />
        </SettingsCard>

        <SettingsCard title="Privacy">
          <SettingsToggle label="Make profile public" checked={settings.publicProfile} onCheckedChange={() => handleToggle('publicProfile')} />
          <SettingsToggle label="Show listening activity" checked={settings.showActivity} onCheckedChange={() => handleToggle('showActivity')} />
          <div className="mt-6">
            <Button variant="outline" className="border-red-800/70 text-red-500 hover:bg-red-900/30 hover:text-red-400 w-full sm:w-auto">
              Clear Listening History
            </Button>
          </div>
        </SettingsCard>

        <SettingsCard title="About">
          <div className="text-gray-400 text-sm space-y-2">
            <p>Version: 1.0.0</p>
            <p>© 2024 EerieCast. All rights reserved.</p>
            <div className="flex space-x-4 pt-2">
              <a href="#" className="text-red-500 hover:underline">Terms of Service</a>
              <a href="#" className="text-red-500 hover:underline">Privacy Policy</a>
              <a href="#" className="text-red-500 hover:underline">Contact Support</a>
            </div>
          </div>
        </SettingsCard>
      </div>
    </div>
  );
}
