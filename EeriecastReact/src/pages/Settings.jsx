import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Volume2,
  Play,
  Bell,
  Shield,
  Info,
  ChevronRight,
  Headphones,
  Gauge,
  ListEnd,
  BookmarkCheck,
  Trash2,
  Maximize,
  FlaskConical,
  Home,
  RefreshCw,
  Crown,
  Lock,
  UserX,
  Mail,
} from 'lucide-react';
import ChangePasswordModal from '@/components/auth/ChangePasswordModal';
import DeleteAccountModal from '@/components/auth/DeleteAccountModal';
import ChangeEmailModal from '@/components/auth/ChangeEmailModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useSettings } from '@/hooks/use-settings';
import { useAudioPlayerContext } from '@/context/AudioPlayerContext';
import { useUser } from '@/context/UserContext';
import { User as UserAPI } from '@/api/entities';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

/* ─── Reusable components ──────────────────────────────────────────── */

const SettingsCard = ({ icon: Icon, title, description, children }) => (
  <div className="relative rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent backdrop-blur-sm overflow-hidden mb-6">
    {/* Subtle top-edge glow */}
    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />
    <div className="p-6">
      <div className="flex items-center gap-3 mb-1">
        {Icon && <Icon className="w-5 h-5 text-red-500/80 flex-shrink-0" />}
        <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
      </div>
      {description && (
        <p className="text-sm text-zinc-500 ml-8 mb-5">{description}</p>
      )}
      {!description && <div className="mb-5" />}
      {children}
    </div>
  </div>
);

const SettingsToggle = ({ icon: Icon, label, description, checked, onCheckedChange }) => (
  <button
    type="button"
    onClick={() => onCheckedChange(!checked)}
    className="flex items-center gap-4 w-full py-3.5 px-1 border-b border-white/[0.04] last:border-b-0 group transition-colors hover:bg-white/[0.02] rounded-lg -mx-1 px-3"
  >
    {Icon && <Icon className="w-4 h-4 text-zinc-500 group-hover:text-zinc-400 flex-shrink-0 transition-colors" />}
    <div className="flex-1 text-left">
      <span className="text-sm text-zinc-200 group-hover:text-white transition-colors">{label}</span>
      {description && <p className="text-xs text-zinc-600 mt-0.5">{description}</p>}
    </div>
    {/* Toggle switch */}
    <div
      className={`relative w-9 h-[18px] rounded-full transition-all duration-300 flex-shrink-0 ${
        checked
          ? 'bg-red-600'
          : 'bg-zinc-700'
      }`}
    >
      <div
        className={`absolute top-[3px] w-3 h-3 rounded-full bg-white transition-all duration-300 ${
          checked ? 'left-[21px]' : 'left-[3px]'
        }`}
      />
    </div>
  </button>
);

const PlaybackSpeedControl = ({ speed, setSpeed }) => {
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
  return (
    <div className="flex items-center gap-1.5 bg-black/40 border border-white/[0.06] p-1 rounded-xl">
      {speeds.map(s => (
        <button
          key={s}
          onClick={() => setSpeed(s)}
          className={`flex-1 px-2 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            speed === s
              ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
          }`}
        >
          {s}x
        </button>
      ))}
    </div>
  );
};

/* ─── Main Settings Page ───────────────────────────────────────────── */

export default function Settings() {
  const { settings, updateSetting } = useSettings();
  const { playbackRate, setPlaybackRate } = useAudioPlayerContext();
  const { user, setUser, isAuthenticated, isPremium, logout } = useUser();
  const [togglingPremium, setTogglingPremium] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showChangeEmail, setShowChangeEmail] = useState(false);

  const userEmail = user?.email || user?.user?.email || '';

  return (
    <div className="min-h-screen bg-eeriecast-surface text-white">
      {/* Header */}
      <div className="relative pt-10 pb-8 px-6 max-w-2xl mx-auto">
        {/* Background accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[radial-gradient(ellipse_at_center,_rgba(220,38,38,0.06),_transparent_70%)] pointer-events-none" />

        <div className="relative flex items-center gap-4 mb-2">
          <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-600/20 flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm text-zinc-600 mt-0.5">Customize your listening experience</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 pb-32">

        {/* Audio Quality */}
        <SettingsCard
          icon={Volume2}
          title="Audio Quality"
          description="Controls quality for streaming and downloads"
        >
          <div className="space-y-5">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-400 mb-2">
                <Headphones className="w-3.5 h-3.5" />
                Streaming Quality
              </label>
              <Select
                value={settings.streamingQuality}
                onValueChange={value => updateSetting('streamingQuality', value)}
              >
                <SelectTrigger className="w-full bg-black/40 border-white/[0.08] hover:border-white/[0.15] transition-colors text-zinc-200">
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
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-400 mb-2">
                <Headphones className="w-3.5 h-3.5" />
                Download Quality
              </label>
              <Select
                value={settings.downloadQuality}
                onValueChange={value => updateSetting('downloadQuality', value)}
              >
                <SelectTrigger className="w-full bg-black/40 border-white/[0.08] hover:border-white/[0.15] transition-colors text-zinc-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="320kbps">High Quality (320kbps)</SelectItem>
                  <SelectItem value="128kbps">Standard Quality (128kbps)</SelectItem>
                  <SelectItem value="64kbps">Low Quality (64kbps)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SettingsCard>

        {/* Playback */}
        <SettingsCard
          icon={Play}
          title="Playback"
          description="Player behavior and speed preferences"
        >
          <div className="mb-5">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-400 mb-3">
              <Gauge className="w-3.5 h-3.5" />
              Default Playback Speed
            </label>
            <PlaybackSpeedControl
              speed={playbackRate}
              setSpeed={setPlaybackRate}
            />
          </div>
          <SettingsToggle
            icon={ListEnd}
            label="Autoplay next episode"
            description="Automatically play the next episode when one finishes"
            checked={settings.autoplay}
            onCheckedChange={val => updateSetting('autoplay', val)}
          />
          <SettingsToggle
            icon={BookmarkCheck}
            label="Remember playback position"
            description="Resume episodes from where you left off"
            checked={settings.rememberPosition}
            onCheckedChange={val => updateSetting('rememberPosition', val)}
          />
        </SettingsCard>

        {/* Notifications */}
        <SettingsCard
          icon={Bell}
          title="Notifications"
        >
          <SettingsToggle
            icon={Bell}
            label="New episode notifications"
            description="Get notified when shows you follow release new episodes"
            checked={settings.newEpisodeNotifications}
            onCheckedChange={val => updateSetting('newEpisodeNotifications', val)}
          />
        </SettingsCard>

        {/* Account & Privacy */}
        <SettingsCard
          icon={Shield}
          title="Account & Privacy"
        >
          <div className="flex flex-wrap items-center gap-3">
            {isAuthenticated && (
              <Button
                variant="outline"
                className="border-white/[0.08] text-zinc-300 hover:bg-white/[0.06] hover:text-white hover:border-white/[0.15] transition-all"
                onClick={() => setShowChangePassword(true)}
              >
                <Lock className="w-4 h-4 mr-2" />
                Change Password
              </Button>
            )}
            {isAuthenticated && (
              <Button
                variant="outline"
                className="border-white/[0.08] text-zinc-300 hover:bg-white/[0.06] hover:text-white hover:border-white/[0.15] transition-all"
                onClick={() => setShowChangeEmail(true)}
              >
                <Mail className="w-4 h-4 mr-2" />
                Change Email
              </Button>
            )}
            <Button
              variant="outline"
              className="border-red-900/50 text-red-400 hover:bg-red-950/40 hover:text-red-300 hover:border-red-800/60 transition-all"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Listening History
            </Button>
            {isAuthenticated && (
              <Button
                variant="outline"
                className="border-red-900/50 text-red-400 hover:bg-red-950/40 hover:text-red-300 hover:border-red-800/60 transition-all"
                onClick={() => setShowDeleteAccount(true)}
              >
                <UserX className="w-4 h-4 mr-2" />
                Delete Account
              </Button>
            )}
          </div>
        </SettingsCard>

        {/* Testing */}
        <SettingsCard
          icon={FlaskConical}
          title="Testing"
          description="Developer and testing tools"
        >
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="border-white/[0.08] text-zinc-300 hover:bg-white/[0.06] hover:text-white hover:border-white/[0.15] transition-all"
              onClick={() => {
                const el = document.documentElement;
                if (!document.fullscreenElement) {
                  (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen)?.call(el);
                } else {
                  (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen)?.call(document);
                }
              }}
            >
              <Maximize className="w-4 h-4 mr-2" />
              Fullscreen
            </Button>
            <Button
              variant="outline"
              className="border-white/[0.08] text-zinc-300 hover:bg-white/[0.06] hover:text-white hover:border-white/[0.15] transition-all"
              onClick={() => {
                sessionStorage.removeItem('eeriecast_splash_shown');
                window.location.href = createPageUrl('Home');
              }}
            >
              <Home className="w-4 h-4 mr-2" />
              Landing Screen
            </Button>
            <Button
              variant="outline"
              className="border-white/[0.08] text-zinc-300 hover:bg-white/[0.06] hover:text-white hover:border-white/[0.15] transition-all"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            {isAuthenticated && (
              <Button
                variant="outline"
                className={`transition-all ${
                  isPremium
                    ? 'border-amber-400/20 text-amber-400 hover:bg-amber-400/10 hover:border-amber-400/30'
                    : 'border-white/[0.08] text-zinc-300 hover:bg-white/[0.06] hover:text-white hover:border-white/[0.15]'
                }`}
                disabled={togglingPremium}
                onClick={async () => {
                  setTogglingPremium(true);
                  try {
                    const updated = await UserAPI.updateMe({ is_premium: !isPremium });
                    setUser(prev => ({ ...prev, ...updated }));
                  } catch (err) {
                    console.error('Failed to toggle premium:', err);
                  }
                  setTogglingPremium(false);
                }}
              >
                <Crown className="w-4 h-4 mr-2" />
                {togglingPremium ? 'Updating…' : isPremium ? 'Make Free User' : 'Make Premium'}
              </Button>
            )}
          </div>
        </SettingsCard>

        {/* About */}
        <SettingsCard icon={Info} title="About">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Version</span>
              <span className="text-zinc-300 font-mono text-xs bg-white/[0.04] px-2.5 py-1 rounded-md">1.0.0</span>
            </div>
            <div className="border-t border-white/[0.04] pt-3">
              <p className="text-xs text-zinc-600 mb-3">&copy; 2026 Eeriecast. All rights reserved.</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {['Terms of Service', 'Privacy Policy'].map(link => (
                  <a
                    key={link}
                    href="#"
                    className="text-sm text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1 group"
                  >
                    {link}
                    <ChevronRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </a>
                ))}
                <Link
                  to={createPageUrl('Help')}
                  className="text-sm text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1 group"
                >
                  Help Center
                  <ChevronRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </Link>
              </div>
            </div>
          </div>
        </SettingsCard>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />

      <ChangeEmailModal
        isOpen={showChangeEmail}
        onClose={() => setShowChangeEmail(false)}
        currentEmail={userEmail}
      />

      <DeleteAccountModal
        isOpen={showDeleteAccount}
        onClose={() => setShowDeleteAccount(false)}
        userEmail={userEmail}
        onDeleted={async () => {
          await logout();
          window.location.href = createPageUrl('Home');
        }}
      />
    </div>
  );
}
