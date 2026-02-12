import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserLibrary, User as UserAPI, Billing } from "@/api/entities";
import { useUser } from "@/context/UserContext";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";
import { createPageUrl } from "@/utils";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Crown,
  Headphones,
  Radio,
  Heart,
  BookOpen,
  Clock,
  Settings,
  HelpCircle,
  ChevronRight,
  Play,
  Lock,
  LogOut,
  CreditCard,
  Pencil,
  Check,
  X,
  ExternalLink,
  Trash2,
  Calendar,
  Sparkles,
} from "lucide-react";
import ChangePasswordModal from "@/components/auth/ChangePasswordModal";

/* ─── helpers ────────────────────────────────────────────────────── */

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmtDuration(totalSec) {
  if (!totalSec || totalSec <= 0) return "0 min";
  const h = Math.floor(totalSec / 3600);
  const m = Math.round((totalSec % 3600) / 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtMemberSince(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

function fmtDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

/** Days remaining from now until an ISO date. */
function daysUntil(iso) {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/* ──────────────────────────────────────────────────────────────── */

export default function Profile() {
  const navigate = useNavigate();
  const {
    user,
    isPremium,
    favoriteEpisodeIds,
    logout,
    fetchUser,
  } = useUser();
  const { loadAndPlay } = useAudioPlayerContext();

  // ── Change password modal ──
  const [showChangePassword, setShowChangePassword] = useState(false);

  // ── Billing status ──
  const [billingStatus, setBillingStatus] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setBillingLoading(true);
      try {
        const resp = await Billing.status();
        if (!cancelled) setBillingStatus(resp);
      } catch {
        if (!cancelled) setBillingStatus(null);
      } finally {
        if (!cancelled) setBillingLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const handleManageSubscription = useCallback(async () => {
    setPortalLoading(true);
    try {
      const resp = await Billing.createPortalSession();
      if (resp?.url) {
        window.location.href = resp.url;
      } else {
        toast({ title: "Unable to open billing portal", variant: "destructive" });
      }
    } catch (err) {
      toast({
        title: "Billing Portal Error",
        description: err?.message || "Could not open the billing portal.",
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  }, []);

  // ── Editable account fields ──
  const [editingName, setEditingName] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  const handleSaveName = useCallback(async () => {
    const trimmed = nameValue.trim();
    if (!trimmed) return;
    setSavingName(true);
    try {
      await UserAPI.updateMe({ full_name: trimmed });
      await fetchUser();
      setEditingName(false);
      toast({ title: "Name updated" });
    } catch {
      toast({ title: "Failed to update name", variant: "destructive" });
    } finally {
      setSavingName(false);
    }
  }, [nameValue, fetchUser]);

  const handleSaveEmail = useCallback(async () => {
    const trimmed = emailValue.trim();
    if (!trimmed || !/\S+@\S+\.\S+/.test(trimmed)) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
    }
    setSavingEmail(true);
    try {
      await UserAPI.updateMe({ email: trimmed });
      await fetchUser();
      setEditingEmail(false);
      toast({ title: "Email updated" });
    } catch {
      toast({ title: "Failed to update email", variant: "destructive" });
    } finally {
      setSavingEmail(false);
    }
  }, [emailValue, fetchUser]);

  // ── History (local fetch) ──
  const [historyEpisodes, setHistoryEpisodes] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await UserLibrary.getHistory(100);
        const raw = Array.isArray(resp) ? resp : resp?.results || [];
        const list = raw
          .map((item) => {
            if (!item?.episode_detail) return null;
            return {
              ...item.episode_detail,
              _history_last_played: item.last_played,
              _history_progress: item.progress,
              _history_duration: item.duration,
              _history_completed: item.completed,
              _history_percent: item.percent_complete,
            };
          })
          .filter(Boolean);

        const seen = new Set();
        const unique = [];
        for (const ep of list) {
          const id = ep?.id || ep?.slug;
          if (!id || seen.has(id)) continue;
          seen.add(id);
          unique.push(ep);
        }
        if (!cancelled) setHistoryEpisodes(unique);
      } catch {
        if (!cancelled) setHistoryEpisodes([]);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // ── Computed stats ──
  const stats = useMemo(() => {
    const episodesPlayed = historyEpisodes.length;
    const showIds = new Set();
    for (const ep of historyEpisodes) {
      const pid = ep.podcast?.id || ep.podcast_id;
      if (pid) showIds.add(pid);
    }
    let totalSec = 0;
    for (const ep of historyEpisodes) {
      totalSec += ep._history_progress || 0;
    }
    return {
      episodesPlayed,
      showsExplored: showIds.size,
      favorites: favoriteEpisodeIds?.size || 0,
      totalListeningTime: totalSec,
    };
  }, [historyEpisodes, favoriteEpisodeIds]);

  // ── Top shows ──
  const topShows = useMemo(() => {
    const countMap = new Map();
    for (const ep of historyEpisodes) {
      const podcast = ep.podcast && typeof ep.podcast === "object" ? ep.podcast : null;
      const pid = podcast?.id || ep.podcast_id;
      if (!pid || !podcast) continue;
      const existing = countMap.get(pid);
      if (existing) existing.count += 1;
      else countMap.set(pid, { podcast, count: 1 });
    }
    return Array.from(countMap.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [historyEpisodes]);

  // ── Recent activity ──
  const recentActivity = useMemo(() => historyEpisodes.slice(0, 5), [historyEpisodes]);

  const handlePlayRecent = async (ep) => {
    if (!ep) return;
    const podcastObj = ep.podcast && typeof ep.podcast === "object"
      ? ep.podcast
      : ep.podcast ? { id: ep.podcast } : null;
    try {
      await loadAndPlay({
        podcast: podcastObj || { id: ep.podcast_id || `ep-${ep.id}`, title: ep.podcast_title || ep.title || "Podcast" },
        episode: ep,
      });
    } catch { /* ignore */ }
  };

  // ── Sign out ──
  const handleSignOut = useCallback(() => {
    logout();
    navigate(createPageUrl("Home"));
  }, [logout, navigate]);

  // ── Loading / guest guard ──
  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
        <Headphones className="w-12 h-12 text-zinc-600 mb-4" />
        <p className="text-gray-400 mb-2 text-center">Sign in to see your profile.</p>
        <Link to={createPageUrl("Home")} className="text-red-500 hover:text-red-400 text-sm mt-2">
          Go home
        </Link>
      </div>
    );
  }

  const displayName = user.full_name || user.name || user.username || "Eeriecast Listener";
  const email = user.email || "";
  const memberSince = fmtMemberSince(user.date_joined);

  // Derive subscription info from billing status
  const activeSub = billingStatus?.active_subscription || billingStatus?.subscription || null;
  const subStatus = activeSub?.status || (isPremium ? "active" : null);
  const isTrialing = subStatus === "trialing";
  const isCanceling = activeSub?.cancel_at_period_end === true;
  const trialDaysLeft = isTrialing ? daysUntil(user.subscription_expires || activeSub?.current_period_end) : null;
  const nextBillingDate = fmtDate(user.subscription_expires || activeSub?.current_period_end);

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      {/* ── Header gradient ── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/40 via-black/80 to-black pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-4 pt-10 pb-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center shadow-lg shadow-red-900/30 ring-2 ring-white/10">
                <span className="text-4xl sm:text-5xl font-bold text-white/90 select-none">
                  {getInitials(displayName)}
                </span>
              </div>
              {isPremium && (
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center ring-2 ring-black">
                  <Crown className="w-4 h-4 text-black" />
                </div>
              )}
            </div>

            <div className="text-center sm:text-left flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold truncate">{displayName}</h1>
              {email && <p className="text-sm text-gray-400 truncate mt-0.5">{email}</p>}
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  isPremium
                    ? "bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30"
                    : "bg-white/5 text-gray-400 ring-1 ring-white/10"
                }`}>
                  {isPremium && <Crown className="w-3 h-3" />}
                  {isPremium ? "Premium Member" : "Free Account"}
                </span>
                {memberSince && <span className="text-xs text-gray-500">Since {memberSince}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 space-y-6">

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  SECTION 1: Subscription & Billing                         */}
        {/* ════════════════════════════════════════════════════════════ */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Subscription & Billing
          </h2>

          {isPremium ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              {/* Plan summary */}
              <div className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border border-yellow-500/[0.12] flex items-center justify-center">
                      <Crown className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Eeriecast Premium</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {isTrialing ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-400/[0.12] px-2 py-0.5 rounded-full">
                            <Sparkles className="w-3 h-3" />
                            Trial{trialDaysLeft != null ? ` \u2014 ${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} left` : ""}
                          </span>
                        ) : isCanceling ? (
                          <span className="inline-flex items-center text-[11px] font-semibold text-orange-400 bg-orange-500/10 border border-orange-400/[0.12] px-2 py-0.5 rounded-full">
                            Cancels at period end
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-400/[0.12] px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Billing details */}
                {nextBillingDate && (
                  <div className="flex items-center gap-2 mt-4 text-xs text-gray-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {isCanceling ? "Access until" : isTrialing ? "First charge" : "Next billing date"}:{" "}
                      <span className="text-gray-300">{nextBillingDate}</span>
                    </span>
                  </div>
                )}
              </div>

              {/* Manage button */}
              <div className="border-t border-white/[0.06] px-5 sm:px-6 py-4">
                <Button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  variant="outline"
                  className="w-full sm:w-auto bg-white/[0.04] border-white/[0.08] text-gray-300 hover:text-white hover:bg-white/[0.08] transition-all"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {portalLoading ? "Opening..." : "Manage Subscription"}
                  <ExternalLink className="w-3 h-3 ml-2 opacity-50" />
                </Button>
                <p className="text-[11px] text-gray-600 mt-2">
                  Update payment method, view invoices, or cancel your subscription.
                </p>
              </div>
            </div>
          ) : (
            /* Free user upsell */
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                  <Crown className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Free Account</p>
                  <p className="text-xs text-gray-500">Upgrade for unlimited access to everything.</p>
                </div>
              </div>
              <Button
                onClick={() => navigate(createPageUrl("Premium"))}
                className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold shadow-lg shadow-red-600/20 border border-red-500/20"
              >
                <Crown className="w-4 h-4 mr-2" />
                Go Premium
              </Button>
            </div>
          )}
        </section>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  SECTION 2: Account Info (Editable)                        */}
        {/* ════════════════════════════════════════════════════════════ */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Account
          </h2>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04] overflow-hidden">
            {/* Display name */}
            <div className="px-5 py-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-1">Display Name</p>
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      className="bg-white/[0.04] border-white/[0.1] text-white text-sm h-8 max-w-xs"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                    />
                    <button onClick={handleSaveName} disabled={savingName} className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditingName(false)} className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/[0.08] transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-200 truncate">{displayName}</p>
                )}
              </div>
              {!editingName && (
                <button
                  onClick={() => { setNameValue(displayName === "Eeriecast Listener" ? "" : displayName); setEditingName(true); setEditingEmail(false); }}
                  className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/[0.08] transition-colors flex-shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Email */}
            <div className="px-5 py-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-1">Email</p>
                {editingEmail ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="email"
                      value={emailValue}
                      onChange={(e) => setEmailValue(e.target.value)}
                      className="bg-white/[0.04] border-white/[0.1] text-white text-sm h-8 max-w-xs"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveEmail(); if (e.key === "Escape") setEditingEmail(false); }}
                    />
                    <button onClick={handleSaveEmail} disabled={savingEmail} className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditingEmail(false)} className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/[0.08] transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-200 truncate">{email || "Not set"}</p>
                )}
              </div>
              {!editingEmail && (
                <button
                  onClick={() => { setEmailValue(email); setEditingEmail(true); setEditingName(false); }}
                  className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/[0.08] transition-colors flex-shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Member since (read-only) */}
            {memberSince && (
              <div className="px-5 py-4">
                <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium mb-1">Member Since</p>
                <p className="text-sm text-gray-200">{memberSince}</p>
              </div>
            )}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  SECTION 3: Account Actions                                */}
        {/* ════════════════════════════════════════════════════════════ */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Account Actions
          </h2>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04] overflow-hidden">
            {/* Change Password */}
            <button
              onClick={() => setShowChangePassword(true)}
              className="flex items-center gap-3 px-5 py-4 hover:bg-white/[0.03] transition-colors group w-full text-left"
            >
              <Lock className="w-5 h-5 text-gray-500 group-hover:text-gray-300 transition-colors" />
              <span className="text-sm flex-1 text-gray-300 group-hover:text-white transition-colors">Change Password</span>
              <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
            </button>

            {/* Settings */}
            <Link
              to={createPageUrl("Settings")}
              className="flex items-center gap-3 px-5 py-4 hover:bg-white/[0.03] transition-colors group"
            >
              <Settings className="w-5 h-5 text-gray-500 group-hover:text-gray-300 transition-colors" />
              <span className="text-sm flex-1 text-gray-300 group-hover:text-white transition-colors">Settings</span>
              <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
            </Link>

            {/* Help */}
            <Link
              to={createPageUrl("Help")}
              className="flex items-center gap-3 px-5 py-4 hover:bg-white/[0.03] transition-colors group"
            >
              <HelpCircle className="w-5 h-5 text-gray-500 group-hover:text-gray-300 transition-colors" />
              <span className="text-sm flex-1 text-gray-300 group-hover:text-white transition-colors">Help & Support</span>
              <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
            </Link>

            {/* Delete Account */}
            <button
              onClick={() => toast({ title: "Contact Support", description: "Please email support@eeriecasts.com to request account deletion." })}
              className="flex items-center gap-3 px-5 py-4 hover:bg-white/[0.03] transition-colors group w-full text-left"
            >
              <Trash2 className="w-5 h-5 text-gray-600 group-hover:text-red-400 transition-colors" />
              <span className="text-sm flex-1 text-gray-500 group-hover:text-red-400 transition-colors">Delete Account</span>
              <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
            </button>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-5 py-4 hover:bg-white/[0.03] transition-colors group w-full text-left"
            >
              <LogOut className="w-5 h-5 text-gray-500 group-hover:text-red-400 transition-colors" />
              <span className="text-sm flex-1 text-gray-300 group-hover:text-red-400 transition-colors">Sign Out</span>
            </button>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  SECTION 4: Listening Stats                                */}
        {/* ════════════════════════════════════════════════════════════ */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Your Stats
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={Clock} value={fmtDuration(stats.totalListeningTime)} label="Listened" loading={historyLoading} />
            <StatCard icon={Headphones} value={stats.episodesPlayed} label="Episodes" loading={historyLoading} />
            <StatCard icon={Radio} value={stats.showsExplored} label="Shows" loading={historyLoading} />
            <StatCard icon={Heart} value={stats.favorites} label="Favorites" />
          </div>
        </section>

        {/* ── Recent activity ── */}
        {!historyLoading && recentActivity.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Recent Activity</h2>
              <Link to={`${createPageUrl("Library")}?tab=history`} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                View all
              </Link>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04] overflow-hidden">
              {recentActivity.map((ep) => (
                <RecentEpisodeRow key={ep.id || ep.slug} episode={ep} onPlay={() => handlePlayRecent(ep)} />
              ))}
            </div>
          </section>
        )}

        {/* ── Top shows ── */}
        {!historyLoading && topShows.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">Your Top Shows</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {topShows.map(({ podcast, count }) => (
                <button
                  key={podcast.id}
                  onClick={() => navigate(`${createPageUrl("Episodes")}?id=${encodeURIComponent(podcast.id)}`)}
                  className="flex-shrink-0 w-28 sm:w-32 group text-left"
                >
                  <div className="aspect-square rounded-xl overflow-hidden bg-white/5 mb-2 ring-1 ring-white/[0.06] group-hover:ring-red-500/30 transition-all">
                    {podcast.cover_image ? (
                      <img src={podcast.cover_image} alt={podcast.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-900/40 to-zinc-900">
                        <BookOpen className="w-8 h-8 text-zinc-600" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-medium text-gray-200 truncate group-hover:text-white transition-colors">{podcast.title}</p>
                  <p className="text-[11px] text-gray-500">{count} episode{count !== 1 ? "s" : ""} played</p>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────── */

function StatCard({ icon: Icon, value, label, loading = false }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
      <Icon className="w-5 h-5 text-red-500 mx-auto mb-2" />
      {loading ? (
        <div className="h-7 w-12 mx-auto rounded bg-white/5 animate-pulse mb-1" />
      ) : (
        <p className="text-xl sm:text-2xl font-bold text-white">{value}</p>
      )}
      <p className="text-[11px] text-gray-500 uppercase tracking-widest mt-0.5">{label}</p>
    </div>
  );
}

function RecentEpisodeRow({ episode, onPlay }) {
  const podcast = episode.podcast && typeof episode.podcast === "object" ? episode.podcast : null;
  const cover = episode.cover_image || podcast?.cover_image;
  const showTitle = podcast?.title || "";
  const pct = episode._history_percent ?? 0;

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors group">
      <button onClick={onPlay} className="relative flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-white/5">
        {cover ? (
          <img src={cover} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-900/40 to-zinc-900">
            <Headphones className="w-5 h-5 text-zinc-600" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Play className="w-5 h-5 text-white fill-white" />
        </div>
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-200 truncate">{episode.title}</p>
        {showTitle && <p className="text-xs text-gray-500 truncate">{showTitle}</p>}
      </div>
      {pct > 0 && pct < 100 && (
        <div className="w-16 flex-shrink-0">
          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <p className="text-[10px] text-gray-500 text-right mt-0.5">{Math.round(pct)}%</p>
        </div>
      )}
      {pct >= 100 && <span className="text-[10px] text-green-500 font-medium flex-shrink-0">Done</span>}
    </div>
  );
}
