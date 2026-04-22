import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Settings as SettingsIcon,
  Play,
  Bell,
  Shield,
  Info,
  ChevronRight,
  Gauge,
  ListEnd,
  BookmarkCheck,
  Trash2,
  ShieldAlert,
  Rewind,
  FastForward,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useSettings } from '@/hooks/use-settings';
import { useAudioPlayerContext } from '@/context/AudioPlayerContext';
import { useUser } from '@/context/UserContext';
import { User as UserAPI, UserLibrary } from '@/api/entities';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useToast } from '@/components/ui/use-toast';
import TermsOfServiceModal from '@/components/legal/TermsOfServiceModal';
import PrivacyPolicyModal from '@/components/legal/PrivacyPolicyModal';

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

const SkipIntervalControl = ({ value, onChange }) => {
  const options = [10, 15, 30, 45];
  return (
    <div className="flex items-center gap-1.5 bg-black/40 border border-white/[0.06] p-1 rounded-xl">
      {options.map(s => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`flex-1 px-2 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            value === s
              ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
          }`}
        >
          {s}s
        </button>
      ))}
    </div>
  );
};

/* ─── Main Settings Page ───────────────────────────────────────────── */

export default function Settings() {
  const { settings, updateSetting } = useSettings();
  const { playbackRate, setPlaybackRate } = useAudioPlayerContext();
  const {
    user,
    userAge,
    refreshUser,
    isAuthenticated,
    guestAllowMature,
    setGuestAllowMature,
  } = useUser();
  const [clearingHistory, setClearingHistory] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showMatureConfirm, setShowMatureConfirm] = useState(false);
  const location = useLocation();
  const { toast } = useToast();

  // Show the toggle for everyone EXCEPT logged-in users whose DOB proves
  // they're under 18. If the DOB is missing (or they're a guest) we fall
  // back to the same self-attestation modal the guest flow uses.
  const canShowMatureToggle = isAuthenticated
    ? !(userAge !== null && userAge < 18)
    : true;
  // For logged-in users without a DOB on file, we require the same 18+
  // self-attestation as guests before turning the flag on.
  const needsAttestation = isAuthenticated && userAge === null;
  const matureChecked = isAuthenticated
    ? !!user?.allow_mature_content
    : !!guestAllowMature;

  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear your listening history? This cannot be undone.')) {
      return;
    }

    setClearingHistory(true);
    try {
      const result = await UserLibrary.clearHistory();
      toast({
        title: 'History cleared',
        description: `${result.deleted || 0} entries removed from your listening history.`,
      });
    } catch (err) {
      console.error('Failed to clear history:', err);
      toast({
        title: 'Error',
        description: 'Failed to clear listening history. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setClearingHistory(false);
    }
  };

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      // Delay must exceed the router's scroll-to-top safety-net (500ms)
      const timer = setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-1', 'ring-red-500/40', 'rounded-lg');
          setTimeout(() => el.classList.remove('ring-1', 'ring-red-500/40', 'rounded-lg'), 2000);
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [location.hash]);

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
          <div className="mb-5">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-400 mb-3">
              <Rewind className="w-3.5 h-3.5" />
              Skip Backward
            </label>
            <SkipIntervalControl
              value={settings.skipBackwardSeconds}
              onChange={(val) => updateSetting('skipBackwardSeconds', val)}
            />
          </div>
          <div className="mb-5">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-400 mb-3">
              <FastForward className="w-3.5 h-3.5" />
              Skip Forward
            </label>
            <SkipIntervalControl
              value={settings.skipForwardSeconds}
              onChange={(val) => updateSetting('skipForwardSeconds', val)}
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

        {/* Privacy & Content */}
        <SettingsCard
          icon={Shield}
          title="Privacy & Content"
        >
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="outline"
              onClick={handleClearHistory}
              disabled={clearingHistory}
              className="border-red-900/50 text-red-400 hover:bg-red-950/40 hover:text-red-300 hover:border-red-800/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {clearingHistory ? 'Clearing...' : 'Clear Listening History'}
            </Button>
          </div>
          {/* Logged-in users: gated by age. Guests: always shown, turning
              it on prompts a 18+ self-attestation. */}
          {canShowMatureToggle && (
            <div id="mature-content">
              <SettingsToggle
                icon={ShieldAlert}
                label="Allow Shows with Explicit Language"
                description="Some shows contain language viewers may not find suitable for younger audiences. Enabling this toggle will allow shows marked explicit to be played."
                checked={matureChecked}
                onCheckedChange={async (val) => {
                  if (!isAuthenticated) {
                    if (val) {
                      setShowMatureConfirm(true);
                    } else {
                      setGuestAllowMature(false);
                    }
                    return;
                  }
                  // Logged-in user with no DOB on file: require the same
                  // self-attestation we ask guests for before flipping on.
                  if (val && needsAttestation) {
                    setShowMatureConfirm(true);
                    return;
                  }
                  try {
                    await UserAPI.updateMe({ allow_mature_content: val });
                    await refreshUser();
                  } catch (err) {
                    console.error('Failed to update explicit language setting:', err);
                  }
                }}
              />
            </div>
          )}
        </SettingsCard>

        {/* About */}
        <SettingsCard icon={Info} title="About">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Version</span>
              <span className="text-zinc-300 font-mono text-xs bg-white/[0.04] px-2.5 py-1 rounded-md">1.0.0</span>
            </div>
            <div className="border-t border-white/[0.04] pt-3">
              <p className="text-xs text-zinc-600 mb-3">&copy; 2026 Eeriecast, LLC. All rights reserved.</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <button
                  type="button"
                  onClick={() => setShowTerms(true)}
                  className="text-sm text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1 group"
                >
                  Terms of Service
                  <ChevronRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrivacy(true)}
                  className="text-sm text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1 group"
                >
                  Privacy Policy
                  <ChevronRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </button>
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

      <TermsOfServiceModal open={showTerms} onOpenChange={setShowTerms} />
      <PrivacyPolicyModal open={showPrivacy} onOpenChange={setShowPrivacy} />

      {showMatureConfirm && (
        <MatureAgeConfirmModal
          onConfirm={async () => {
            try {
              if (isAuthenticated) {
                await UserAPI.updateMe({ allow_mature_content: true });
                await refreshUser();
              } else {
                setGuestAllowMature(true);
              }
              setShowMatureConfirm(false);
              toast({
                title: 'Explicit language enabled',
                description: 'Shows with strong language will now play without interruption.',
              });
            } catch (err) {
              console.error('Failed to update explicit language setting:', err);
              setShowMatureConfirm(false);
              toast({
                title: 'Error',
                description: 'Could not update setting. Please try again.',
                variant: 'destructive',
              });
            }
          }}
          onCancel={() => setShowMatureConfirm(false)}
        />
      )}
    </div>
  );
}

/* ─── Age confirmation modal (guest-only) ──────────────────────────── */

function MatureAgeConfirmModal({ onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[5000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mature-confirm-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onCancel}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#141018] to-[#0c0b11] shadow-2xl overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-600/20 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-5 h-5 text-red-500" />
            </div>
            <h2 id="mature-confirm-title" className="text-lg font-semibold text-zinc-100">
              Confirm you are 18 or older
            </h2>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed mb-2">
            Some shows contain language not suitable for younger audiences.
          </p>
          <p className="text-sm text-zinc-500 leading-relaxed mb-6">
            By continuing, you confirm that you are at least 18 years old. You can turn this off any time in Settings.
          </p>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={onCancel}
              className="border-white/[0.08] text-zinc-300 hover:bg-white/[0.04] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              I am 18 or older
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

MatureAgeConfirmModal.propTypes = {
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
