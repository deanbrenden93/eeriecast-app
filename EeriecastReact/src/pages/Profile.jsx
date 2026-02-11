import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserLibrary } from "@/api/entities";
import { useUser } from "@/context/UserContext";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";
import { createPageUrl } from "@/utils";
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
} from "lucide-react";

/* ─── helpers ────────────────────────────────────────────────────── */

/** Initials from a full name (max 2 chars). */
function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Human-readable duration from total seconds. */
function fmtDuration(totalSec) {
  if (!totalSec || totalSec <= 0) return "0 min";
  const h = Math.floor(totalSec / 3600);
  const m = Math.round((totalSec % 3600) / 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Human-readable "Member since" from ISO date string. */
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

/* ──────────────────────────────────────────────────────────────── */

export default function Profile() {
  const navigate = useNavigate();
  const {
    user,
    isPremium,
    favoriteEpisodeIds,
    followedPodcastIds,
  } = useUser();
  const { loadAndPlay } = useAudioPlayerContext();

  // ── History (local fetch) ──
  const [historyEpisodes, setHistoryEpisodes] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
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

        // Deduplicate
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
  }, []);

  // ── Computed stats ──
  const stats = useMemo(() => {
    const episodesPlayed = historyEpisodes.length;

    // Unique shows explored
    const showIds = new Set();
    for (const ep of historyEpisodes) {
      const pid = ep.podcast?.id || ep.podcast_id;
      if (pid) showIds.add(pid);
    }

    // Total listening time (sum progress seconds from history)
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

  // ── Top shows (by episode count in history) ──
  const topShows = useMemo(() => {
    const countMap = new Map(); // podcastId -> { podcast, count }
    for (const ep of historyEpisodes) {
      const podcast =
        ep.podcast && typeof ep.podcast === "object" ? ep.podcast : null;
      const pid = podcast?.id || ep.podcast_id;
      if (!pid || !podcast) continue;
      const existing = countMap.get(pid);
      if (existing) {
        existing.count += 1;
      } else {
        countMap.set(pid, { podcast, count: 1 });
      }
    }
    return Array.from(countMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [historyEpisodes]);

  // ── Recent activity (last 5 from history) ──
  const recentActivity = useMemo(
    () => historyEpisodes.slice(0, 5),
    [historyEpisodes]
  );

  // ── Play episode from recent activity ──
  const handlePlayRecent = async (ep) => {
    if (!ep) return;
    const podcastObj =
      ep.podcast && typeof ep.podcast === "object"
        ? ep.podcast
        : ep.podcast
          ? { id: ep.podcast }
          : null;
    try {
      await loadAndPlay({
        podcast: podcastObj || {
          id: ep.podcast_id || `ep-${ep.id}`,
          title: ep.podcast_title || ep.title || "Podcast",
        },
        episode: ep,
      });
    } catch {
      /* ignore */
    }
  };

  // ── Loading / guest guard ──
  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
        <Headphones className="w-12 h-12 text-zinc-600 mb-4" />
        <p className="text-gray-400 mb-2 text-center">
          Sign in to see your profile.
        </p>
        <Link
          to={createPageUrl("Home")}
          className="text-red-500 hover:text-red-400 text-sm mt-2"
        >
          Go home
        </Link>
      </div>
    );
  }

  const displayName =
    user.full_name || user.name || user.username || "Eeriecast Listener";
  const email = user.email || "";
  const memberSince = fmtMemberSince(user.date_joined);

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      {/* ── Header gradient ── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/40 via-black/80 to-black pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-4 pt-10 pb-8">
          {/* ── User card ── */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5">
            {/* Avatar circle with initials */}
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
              <h1 className="text-2xl sm:text-3xl font-bold truncate">
                {displayName}
              </h1>
              {email && (
                <p className="text-sm text-gray-400 truncate mt-0.5">
                  {email}
                </p>
              )}
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    isPremium
                      ? "bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30"
                      : "bg-white/5 text-gray-400 ring-1 ring-white/10"
                  }`}
                >
                  {isPremium && <Crown className="w-3 h-3" />}
                  {isPremium ? "Premium Member" : "Free Account"}
                </span>
                {memberSince && (
                  <span className="text-xs text-gray-500">
                    Since {memberSince}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 space-y-6">
        {/* ── Listening stats ── */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Your Stats
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={Clock}
              value={fmtDuration(stats.totalListeningTime)}
              label="Listened"
              loading={historyLoading}
            />
            <StatCard
              icon={Headphones}
              value={stats.episodesPlayed}
              label="Episodes"
              loading={historyLoading}
            />
            <StatCard
              icon={Radio}
              value={stats.showsExplored}
              label="Shows"
              loading={historyLoading}
            />
            <StatCard
              icon={Heart}
              value={stats.favorites}
              label="Favorites"
            />
          </div>
        </section>

        {/* ── Recent activity ── */}
        {!historyLoading && recentActivity.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                Recent Activity
              </h2>
              <Link
                to={createPageUrl("Library")}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                View all
              </Link>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04] overflow-hidden">
              {recentActivity.map((ep) => (
                <RecentEpisodeRow
                  key={ep.id || ep.slug}
                  episode={ep}
                  onPlay={() => handlePlayRecent(ep)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Top shows ── */}
        {!historyLoading && topShows.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
              Your Top Shows
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {topShows.map(({ podcast, count }) => (
                <button
                  key={podcast.id}
                  onClick={() =>
                    navigate(
                      `${createPageUrl("Episodes")}?id=${encodeURIComponent(
                        podcast.id
                      )}`
                    )
                  }
                  className="flex-shrink-0 w-28 sm:w-32 group text-left"
                >
                  <div className="aspect-square rounded-xl overflow-hidden bg-white/5 mb-2 ring-1 ring-white/[0.06] group-hover:ring-red-500/30 transition-all">
                    {podcast.cover_image ? (
                      <img
                        src={podcast.cover_image}
                        alt={podcast.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-900/40 to-zinc-900">
                        <BookOpen className="w-8 h-8 text-zinc-600" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-medium text-gray-200 truncate group-hover:text-white transition-colors">
                    {podcast.title}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {count} episode{count !== 1 ? "s" : ""} played
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Quick links ── */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Quick Links
          </h2>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04] overflow-hidden">
            <QuickLink
              to={createPageUrl("Library")}
              icon={BookOpen}
              label="Your Library"
            />
            {!isPremium && (
              <QuickLink
                to={createPageUrl("Premium")}
                icon={Crown}
                label="Go Premium"
                accent
              />
            )}
            <QuickLink
              to={createPageUrl("Settings")}
              icon={Settings}
              label="Settings"
            />
            <QuickLink
              to={createPageUrl("Help")}
              icon={HelpCircle}
              label="Help & Support"
            />
          </div>
        </section>
      </div>
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
      <p className="text-[11px] text-gray-500 uppercase tracking-widest mt-0.5">
        {label}
      </p>
    </div>
  );
}

function RecentEpisodeRow({ episode, onPlay }) {
  const podcast =
    episode.podcast && typeof episode.podcast === "object"
      ? episode.podcast
      : null;
  const cover = episode.cover_image || podcast?.cover_image;
  const showTitle = podcast?.title || "";
  const pct = episode._history_percent ?? 0;

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors group">
      {/* Cover */}
      <button onClick={onPlay} className="relative flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-white/5">
        {cover ? (
          <img
            src={cover}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-900/40 to-zinc-900">
            <Headphones className="w-5 h-5 text-zinc-600" />
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Play className="w-5 h-5 text-white fill-white" />
        </div>
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-200 truncate">
          {episode.title}
        </p>
        {showTitle && (
          <p className="text-xs text-gray-500 truncate">{showTitle}</p>
        )}
      </div>

      {/* Progress bar */}
      {pct > 0 && pct < 100 && (
        <div className="w-16 flex-shrink-0">
          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-red-500"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-500 text-right mt-0.5">
            {Math.round(pct)}%
          </p>
        </div>
      )}
      {pct >= 100 && (
        <span className="text-[10px] text-green-500 font-medium flex-shrink-0">
          Done
        </span>
      )}
    </div>
  );
}

function QuickLink({ to, icon: Icon, label, accent = false }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.03] transition-colors group"
    >
      <Icon
        className={`w-5 h-5 ${
          accent ? "text-yellow-400" : "text-gray-500 group-hover:text-gray-300"
        } transition-colors`}
      />
      <span
        className={`text-sm flex-1 ${
          accent
            ? "font-semibold text-yellow-400"
            : "text-gray-300 group-hover:text-white"
        } transition-colors`}
      >
        {label}
      </span>
      <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
    </Link>
  );
}
