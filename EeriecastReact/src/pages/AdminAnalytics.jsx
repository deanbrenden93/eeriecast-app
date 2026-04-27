/**
 * Admin analytics dashboard.
 *
 * Gated to `user.is_staff && user.is_superuser` on both the frontend
 * (this page short-circuits to a 404-style message) AND the backend
 * (IsStaffSuperuser on /api/analytics/summary/). Frontend gating keeps
 * the page URL from leaking metric shapes or loading spinners to the
 * wrong audience; backend gating is what actually matters.
 *
 * All charts and cards read from a single summary payload, so the page
 * makes exactly one API call per range-change. Recharts handles the
 * rendering — no extra chart library needed.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  ArrowLeft,
  Users,
  UserPlus,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Crown,
  AlertCircle,
  Calendar,
  CalendarRange,
  Play,
  Headphones,
  CheckCircle2,
  Heart,
  LayoutDashboard,
  Library as LibraryIcon,
  Search,
  ChevronRight,
  Music,
  BookOpen,
  Mic2,
} from "lucide-react";

import { useUser } from "@/context/UserContext";
import { usePodcasts } from "@/context/PodcastContext.jsx";
import { Analytics } from "@/api/entities";
import { createPageUrl } from "@/utils";
import { isAudiobook, isMusic } from "@/lib/utils";

// ── helpers ───────────────────────────────────────────────────────────

const RANGE_OPTIONS = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "1y", label: "1y" },
  { key: "custom", label: "Custom" },
];

function formatCurrency(cents, currency = "USD") {
  const n = Number(cents) || 0;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n / 100);
}

function formatNumber(n) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat().format(Number(n) || 0);
}

function formatPercent(value, { withSign = false, digits = 1 } = {}) {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  const sign = withSign ? (n > 0 ? "+" : "") : "";
  return `${sign}${n.toFixed(digits)}%`;
}

function formatDateTick(iso) {
  try {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

// ── small reusable components ─────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, delta, tone = "default" }) {
  const toneClasses = {
    default: "from-white/[0.04] to-white/[0.01] border-white/[0.06]",
    accent:
      "from-amber-500/[0.08] to-amber-500/[0.02] border-amber-500/20",
    good:
      "from-emerald-500/[0.08] to-emerald-500/[0.02] border-emerald-500/20",
    bad: "from-rose-500/[0.08] to-rose-500/[0.02] border-rose-500/20",
  }[tone];

  const deltaValue = delta === null || delta === undefined ? null : Number(delta);
  const deltaGood = deltaValue !== null && deltaValue >= 0;
  const DeltaIcon = deltaGood ? TrendingUp : TrendingDown;

  return (
    <div
      className={`relative rounded-2xl border bg-gradient-to-br ${toneClasses} p-4 md:p-5 overflow-hidden`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
            {label}
          </p>
          <p className="mt-1.5 text-2xl md:text-3xl font-bold tabular-nums text-white tracking-tight">
            {value}
          </p>
          {sub && (
            <p className="mt-0.5 text-xs text-zinc-500 truncate">{sub}</p>
          )}
        </div>
        {Icon && (
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.05] flex items-center justify-center">
            <Icon className="w-5 h-5 text-zinc-400" />
          </div>
        )}
      </div>
      {deltaValue !== null && (
        <div
          className={`mt-3 inline-flex items-center gap-1 text-xs font-medium ${
            deltaGood ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          <DeltaIcon className="w-3.5 h-3.5" />
          <span>{formatPercent(Math.abs(deltaValue))} vs prev period</span>
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, subtitle, children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 md:p-5 ${className}`}
    >
      <div className="mb-3 md:mb-4">
        <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
        {subtitle && (
          <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

const PLAN_COLORS = {
  monthly: "#a78bfa",
  yearly: "#f59e0b",
  other: "#64748b",
  unknown: "#475569",
};

const AGE_COLOR = "#a78bfa";

function DateRangeBar({ range, setRange, customStart, customEnd, setCustomStart, setCustomEnd }) {
  const isCustom = range === "custom";
  return (
    <div className="space-y-3">
      <div className="inline-flex flex-wrap gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setRange(opt.key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              range === opt.key
                ? "bg-white/[0.08] text-white border border-white/[0.1] shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {isCustom && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>Start</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/20"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <CalendarRange className="w-3.5 h-3.5" />
            <span>End</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/20"
            />
          </label>
        </div>
      )}
    </div>
  );
}

const axisProps = {
  tick: { fill: "#71717a", fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: "rgba(255,255,255,0.06)" },
};

const gridProps = {
  stroke: "rgba(255,255,255,0.04)",
  vertical: false,
};

// Recharts' default <Tooltip> renders three separate inline-styled
// elements: the outer wrapper, the label line ("Jan 5"), and each
// name/value row. Styling only the outer wrapper via `contentStyle`
// left the inner text with Recharts' defaults — near-black labels on
// our near-black popup, which is why the Plan-mix pie (and every
// other chart here) showed unreadable tooltips. We now expose a full
// set of props so each tooltip call-site gets the same treatment.
const tooltipStyle = {
  background: "rgba(17, 17, 23, 0.96)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  padding: "8px 12px",
  color: "#e4e4e7",
  fontSize: 12,
  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
  outline: "none",
};

const tooltipItemStyle = {
  color: "#e4e4e7",
  fontSize: 12,
  padding: 0,
};

const tooltipLabelStyle = {
  color: "#a1a1aa",
  fontSize: 11,
  marginBottom: 4,
  fontWeight: 500,
};

// Props spread on every <Tooltip> so we only have one place to tweak
// chart tooltip styling. Also disables the gray hover-highlight that
// Recharts paints under bar tooltips on dark backgrounds (it reads as
// a rendering glitch here).
const TOOLTIP_PROPS = {
  contentStyle: tooltipStyle,
  itemStyle: tooltipItemStyle,
  labelStyle: tooltipLabelStyle,
  cursor: { fill: "rgba(255,255,255,0.04)" },
};

function formatMinutes(mins) {
  const n = Number(mins) || 0;
  if (n >= 60) {
    const h = Math.floor(n / 60);
    const m = Math.round(n % 60);
    return m ? `${formatNumber(h)}h ${m}m` : `${formatNumber(h)}h`;
  }
  return `${formatNumber(n)} min`;
}

// ── page ──────────────────────────────────────────────────────────────

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const { isAdmin, loading: userLoading } = useUser();

  // Persist the range / custom-range selection across reloads. Stored
  // per-device under a single key. Wrapped in try/catch because Safari
  // private mode and embedded WebViews can throw on `localStorage`
  // access — we silently fall back to in-memory defaults.
  const STORAGE_KEY = "eeriecast.adminAnalytics.range.v1";
  const VALID_RANGES = useMemo(
    () => new Set(RANGE_OPTIONS.map((o) => o.key)),
    []
  );

  const persisted = useMemo(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const r = typeof parsed.range === "string" ? parsed.range : null;
      if (r && !VALID_RANGES.has(r)) return null;
      return {
        range: r || "30d",
        customStart: typeof parsed.customStart === "string" ? parsed.customStart : "",
        customEnd: typeof parsed.customEnd === "string" ? parsed.customEnd : "",
      };
    } catch {
      return null;
    }
  }, [VALID_RANGES]);

  const [range, setRange] = useState(persisted?.range || "30d");
  const [customStart, setCustomStart] = useState(persisted?.customStart || "");
  const [customEnd, setCustomEnd] = useState(persisted?.customEnd || "");

  // Top-level dashboard tab. We persist the choice so admins who deep-link
  // back into the per-show drill-down don't get bumped to Overview every
  // time. Stored separately from the range to avoid confusing the two.
  const VIEW_KEY = "eeriecast.adminAnalytics.view.v1";
  const [view, setView] = useState(() => {
    try {
      const v = window.localStorage.getItem(VIEW_KEY);
      return v === "show" ? "show" : "overview";
    } catch {
      return "overview";
    }
  });
  const [selectedShowId, setSelectedShowId] = useState(() => {
    try {
      return window.localStorage.getItem(`${VIEW_KEY}.show`) || null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);
  useEffect(() => {
    try {
      if (selectedShowId) {
        window.localStorage.setItem(`${VIEW_KEY}.show`, String(selectedShowId));
      } else {
        window.localStorage.removeItem(`${VIEW_KEY}.show`);
      }
    } catch {
      /* ignore */
    }
  }, [selectedShowId]);

  // Catalogue used by the per-show picker. Already cached app-wide so this
  // is essentially free.
  const { podcasts: allPodcasts } = usePodcasts();

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ range, customStart, customEnd })
      );
    } catch {
      /* ignore — storage may be unavailable */
    }
  }, [range, customStart, customEnd]);

  const queryArgs = useMemo(() => {
    if (range === "custom") {
      if (!customStart || !customEnd) return { range: "30d" };
      return { start: customStart, end: customEnd };
    }
    return { range };
  }, [range, customStart, customEnd]);

  const {
    data: summary,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["analytics", "summary", queryArgs],
    queryFn: () => Analytics.summary(queryArgs),
    enabled: !!isAdmin,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // IMPORTANT: every hook below must be called on every render regardless
  // of `isAdmin`, or React throws "Rendered fewer hooks than expected"
  // when the user state hydrates between renders. That's why the
  // not-admin early return lives *after* all hooks.
  const kpis = summary?.kpis || {};
  const series = summary?.series || {};
  const breakdowns = summary?.breakdowns || {};
  const currency = kpis.currency || "USD";

  // Shape chart-friendly arrays from the series payload ------------------
  const usersStackedData = useMemo(() => {
    const labels = series.labels || [];
    return labels.map((label, i) => ({
      date: label,
      Free: series.free_users?.[i] ?? 0,
      Paid: series.paid_users?.[i] ?? 0,
    }));
  }, [series]);

  const signupsData = useMemo(() => {
    const labels = series.labels || [];
    return labels.map((label, i) => ({
      date: label,
      New: series.new_users?.[i] ?? 0,
    }));
  }, [series]);

  const subsData = useMemo(() => {
    const labels = series.labels || [];
    return labels.map((label, i) => ({
      date: label,
      New: series.new_subs?.[i] ?? 0,
      Canceled: -(series.canceled_subs?.[i] ?? 0),
    }));
  }, [series]);

  const planMixData = useMemo(() => {
    const mix = breakdowns.plan_mix || {};
    return Object.entries(mix).map(([name, value]) => ({ name, value }));
  }, [breakdowns]);

  const ageData = useMemo(() => {
    const dist = breakdowns.age_distribution || {};
    return Object.entries(dist).map(([name, value]) => ({ name, value }));
  }, [breakdowns]);

  const topShows = breakdowns.top_followed_podcasts || [];
  const topEpisodesByPlays = breakdowns.top_episodes_by_plays || [];
  const topEpisodesByListen = breakdowns.top_episodes_by_listen_time || [];
  const topShowsByPlays = breakdowns.top_shows_by_plays || [];
  const topShowsByListen = breakdowns.top_shows_by_listen_time || [];

  // Engagement series — same shape as the growth charts so the same
  // ResponsiveContainer + CartesianGrid props work across the board.
  const playsData = useMemo(() => {
    const labels = series.labels || [];
    return labels.map((label, i) => ({
      date: label,
      Plays: series.plays?.[i] ?? 0,
      Completions: series.completions?.[i] ?? 0,
    }));
  }, [series]);

  const listenMinutesData = useMemo(() => {
    const labels = series.labels || [];
    return labels.map((label, i) => ({
      date: label,
      Minutes: series.listen_minutes?.[i] ?? 0,
    }));
  }, [series]);

  const followsSeriesData = useMemo(() => {
    const labels = series.labels || [];
    return labels.map((label, i) => ({
      date: label,
      Follows: series.new_follows?.[i] ?? 0,
    }));
  }, [series]);

  // Human-readable label for the active range — used in section subtitles
  // so admins always know the temporal scope of the data they're looking
  // at without having to scroll back up to the date picker.
  const rangeLabel = useMemo(() => {
    if (range === "custom" && customStart && customEnd) {
      const fmt = (s) => {
        try {
          return new Date(s).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });
        } catch {
          return s;
        }
      };
      return `${fmt(customStart)} – ${fmt(customEnd)}`;
    }
    const map = {
      "24h": "the last 24 hours",
      "7d": "the last 7 days",
      "30d": "the last 30 days",
      "90d": "the last 90 days",
      "1y": "the last year",
    };
    return map[range] || "the selected range";
  }, [range, customStart, customEnd]);

  // Gate render *after* all hooks have run. We still show a spinner-ish
  // placeholder while the user payload is hydrating so non-admins never
  // momentarily see the dashboard chrome.
  if (userLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-xs text-zinc-600">
        Loading…
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-center px-6">
        <div className="max-w-md">
          <AlertCircle className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white">
            Not available
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            This page is only visible to admin accounts. If you think this is
            a mistake, check that you're signed into the right account.
          </p>
          <button
            type="button"
            onClick={() => navigate(createPageUrl("Profile"))}
            className="mt-5 inline-flex items-center gap-2 text-sm text-zinc-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to profile
          </button>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-eeriecast-surface text-white pb-24">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-10 pt-6 lg:pt-10">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <button
              type="button"
              onClick={() => navigate(createPageUrl("Profile"))}
              className="inline-flex items-center gap-1.5 mb-3 text-xs text-zinc-500 hover:text-zinc-300"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to profile
            </button>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Analytics
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Growth, subscriptions and revenue — admin view.
            </p>
          </div>
          <DateRangeBar
            range={range}
            setRange={setRange}
            customStart={customStart}
            customEnd={customEnd}
            setCustomStart={setCustomStart}
            setCustomEnd={setCustomEnd}
          />
        </div>

        {/* View tabs — splits the dashboard into a high-level Overview and
            a per-show drill-down so admins can investigate one show at a
            time without losing the global picture. */}
        <div className="mb-6">
          <DashboardTabs
            tabs={[
              { id: "overview", label: "Overview", icon: LayoutDashboard },
              { id: "show", label: "Per-show", icon: LibraryIcon },
            ]}
            active={view}
            onChange={setView}
          />
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.05] p-5 text-sm text-rose-200">
            <p className="font-medium">Couldn't load analytics.</p>
            <p className="mt-1 text-rose-300/70">
              {error?.status === 403
                ? "Your account is not permitted to view admin analytics."
                : error?.message || "Try again in a moment."}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 text-xs text-rose-200 underline"
            >
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <DashboardSkeleton />
        ) : view === "show" ? (
          <PerShowView
            podcasts={allPodcasts}
            breakdowns={breakdowns}
            rangeLabel={rangeLabel}
            selectedShowId={selectedShowId}
            setSelectedShowId={setSelectedShowId}
          />
        ) : (
          <div className="space-y-10">
            {/* ────────────────────────────────────────────────────────
                SECTION 1 — RIGHT NOW
                Snapshots that don't depend on the date picker. Always
                reflect the current state of the platform. */}
            <DashboardSection
              title="Right now"
              subtitle="Snapshots of the platform's current state — these don't change with the date range above."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <KpiCard
                  icon={Users}
                  label="Total users"
                  value={formatNumber(kpis.total_users)}
                  sub={`${formatNumber(kpis.free_users_now)} free · ${formatNumber(kpis.paying_users_now)} paid`}
                />
                <KpiCard
                  icon={Crown}
                  label="Active subscribers"
                  value={formatNumber(kpis.paying_users_now)}
                  sub={`${formatNumber(kpis.trialing_now)} on trial`}
                  tone="accent"
                />
                <KpiCard
                  icon={DollarSign}
                  label="MRR"
                  value={formatCurrency(kpis.mrr_cents, currency)}
                  sub={`${formatCurrency(kpis.arr_cents, currency)} ARR`}
                  tone="good"
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard
                  icon={DollarSign}
                  label="ARPU"
                  value={formatCurrency(kpis.arpu_cents, currency)}
                  sub="per paying user / mo"
                />
                <KpiCard
                  icon={Headphones}
                  label="Total shows"
                  value={formatNumber(kpis.total_shows)}
                  sub="catalogue size"
                />
                <KpiCard
                  icon={Heart}
                  label="Total follows"
                  value={formatNumber(kpis.total_follows)}
                  sub="all-time"
                />
                <KpiCard
                  icon={Activity}
                  label="Listened"
                  value={formatMinutes(kpis.total_minutes_listened)}
                  sub="all-time"
                />
                <KpiCard
                  icon={Users}
                  label="Email verified"
                  value={
                    kpis.total_users
                      ? formatPercent(
                          (kpis.email_verified_count / kpis.total_users) * 100,
                        )
                      : "—"
                  }
                  sub={`${formatNumber(kpis.email_verified_count)} of ${formatNumber(kpis.total_users)}`}
                />
                <KpiCard
                  icon={Activity}
                  label="Onboarded"
                  value={
                    kpis.total_users
                      ? formatPercent(
                          (kpis.onboarding_completed_count / kpis.total_users) * 100,
                        )
                      : "—"
                  }
                  sub={`${formatNumber(kpis.onboarding_completed_count)} of ${formatNumber(kpis.total_users)}`}
                />
              </div>
            </DashboardSection>

            {/* ────────────────────────────────────────────────────────
                SECTION 2 — IN SELECTED RANGE
                Everything that respects the date picker — both the
                growth + revenue indicators *and* the engagement
                indicators (which used to live in their own section,
                inconsistent with how the rest of the dashboard was
                framed). */}
            <DashboardSection
              title="In selected range"
              subtitle={`Activity inside ${rangeLabel} — these numbers all respect the date picker above.`}
            >
              {/* Growth + revenue, range-scoped */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard
                  icon={UserPlus}
                  label="New users"
                  value={formatNumber(kpis.new_users_in_range)}
                  delta={kpis.new_users_delta_pct}
                />
                <KpiCard
                  icon={CreditCard}
                  label="New subs"
                  value={formatNumber(kpis.new_subs_in_range)}
                  delta={kpis.new_subs_delta_pct}
                />
                <KpiCard
                  icon={TrendingDown}
                  label="Cancellations"
                  value={formatNumber(kpis.canceled_in_range)}
                  delta={kpis.canceled_delta_pct !== null ? -kpis.canceled_delta_pct : null}
                />
                <KpiCard
                  icon={Activity}
                  label="Churn rate"
                  value={formatPercent(
                    // Defensive clamp to [0, 100]. Backend already
                    // guarantees 0 ≤ churn_rate ≤ 1 by scoping the
                    // numerator to the at-start cohort, but cached
                    // responses from before that fix could still
                    // produce > 100% — clamp here so the dashboard
                    // never displays a nonsensical retention figure.
                    Math.max(0, Math.min(100, (kpis.churn_rate || 0) * 100)),
                    { digits: 2 },
                  )}
                  sub="of at-start cohort"
                  tone={kpis.churn_rate && kpis.churn_rate > 0.05 ? "bad" : "default"}
                />
              </div>

              {/* Engagement, range-scoped */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard
                  icon={Play}
                  label="Plays"
                  value={formatNumber(kpis.plays_in_range)}
                  sub={`${formatNumber(kpis.total_plays)} all-time`}
                  delta={kpis.plays_delta_pct}
                  tone="accent"
                />
                <KpiCard
                  icon={Headphones}
                  label="Listen time"
                  value={formatMinutes(kpis.listen_minutes_in_range)}
                  sub="approx. from heartbeats"
                  tone="good"
                />
                <KpiCard
                  icon={CheckCircle2}
                  label="Completions"
                  value={formatNumber(kpis.completions_in_range)}
                  sub="episodes finished"
                />
                <KpiCard
                  icon={Heart}
                  label="New follows"
                  value={formatNumber(kpis.new_follows_in_range)}
                  sub={`${formatNumber(kpis.total_follows)} all-time`}
                />
              </div>

              {/* Primary chart — Free vs Paid growth over time */}
              <ChartCard
                title="User growth"
                subtitle="Free and paid users by day"
              >
                <div className="w-full h-[320px]">
                  <ResponsiveContainer>
                    <AreaChart
                      data={usersStackedData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="gradFree" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#64748b" stopOpacity={0.55} />
                          <stop offset="95%" stopColor="#64748b" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="gradPaid" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.75} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="date" tickFormatter={formatDateTick} {...axisProps} />
                      <YAxis {...axisProps} />
                      <Tooltip {...TOOLTIP_PROPS} labelFormatter={formatDateTick} />
                      <Legend
                        wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }}
                        iconType="circle"
                      />
                      <Area
                        type="monotone"
                        dataKey="Free"
                        stackId="1"
                        stroke="#94a3b8"
                        strokeWidth={1.5}
                        fill="url(#gradFree)"
                      />
                      <Area
                        type="monotone"
                        dataKey="Paid"
                        stackId="1"
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        fill="url(#gradPaid)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              {/* Row — signups + subscription flow */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard
                  title="New signups"
                  subtitle="Daily signup count"
                >
                <div className="w-full h-[260px]">
                  <ResponsiveContainer>
                    <BarChart
                      data={signupsData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="date" tickFormatter={formatDateTick} {...axisProps} />
                      <YAxis {...axisProps} />
                      <Tooltip {...TOOLTIP_PROPS} labelFormatter={formatDateTick} />
                      <Bar
                        dataKey="New"
                        fill="#a78bfa"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

                <ChartCard
                  title="Subscription flow"
                  subtitle="New vs. canceled per day"
                >
                  <div className="w-full h-[260px]">
                    <ResponsiveContainer>
                      <BarChart
                        data={subsData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        stackOffset="sign"
                      >
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="date" tickFormatter={formatDateTick} {...axisProps} />
                        <YAxis {...axisProps} />
                        <Tooltip
                          {...TOOLTIP_PROPS}
                          labelFormatter={formatDateTick}
                          formatter={(value, name) => [Math.abs(value), name]}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }}
                          iconType="circle"
                        />
                        <Bar dataKey="New" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar
                          dataKey="Canceled"
                          fill="#f43f5e"
                          radius={[0, 0, 4, 4]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
              </div>

              {/* Row — plays vs completions + listen minutes (engagement
                  time-series, both range-scoped) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard
                  title="Plays vs. completions"
                  subtitle="Daily playback events"
                >
                  <div className="w-full h-[260px]">
                    {(series.plays || []).every((n) => n === 0)
                    && (series.completions || []).every((n) => n === 0) ? (
                      <EmptyChart message="No plays recorded in this range" />
                    ) : (
                      <ResponsiveContainer>
                        <BarChart
                          data={playsData}
                          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid {...gridProps} />
                          <XAxis dataKey="date" tickFormatter={formatDateTick} {...axisProps} />
                          <YAxis {...axisProps} />
                          <Tooltip {...TOOLTIP_PROPS} labelFormatter={formatDateTick} />
                          <Legend
                            wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }}
                            iconType="circle"
                          />
                          <Bar dataKey="Plays" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Completions" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </ChartCard>

                <ChartCard
                  title="Listen minutes"
                  subtitle="Approx. minutes listened per day"
                >
                  <div className="w-full h-[260px]">
                    {(series.listen_minutes || []).every((n) => n === 0) ? (
                      <EmptyChart message="No listen time recorded in this range" />
                    ) : (
                      <ResponsiveContainer>
                        <AreaChart
                          data={listenMinutesData}
                          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="gradListen" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.6} />
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid {...gridProps} />
                          <XAxis dataKey="date" tickFormatter={formatDateTick} {...axisProps} />
                          <YAxis {...axisProps} />
                          <Tooltip
                            {...TOOLTIP_PROPS}
                            labelFormatter={formatDateTick}
                            formatter={(value) => [`${formatNumber(value)} min`, "Listened"]}
                          />
                          <Area
                            type="monotone"
                            dataKey="Minutes"
                            stroke="#ef4444"
                            strokeWidth={1.5}
                            fill="url(#gradListen)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </ChartCard>
              </div>

              {followsSeriesData.some((d) => d.Follows > 0) && (
                <ChartCard
                  title="New follows"
                  subtitle="Daily follow activity"
                >
                  <div className="w-full h-[220px]">
                    <ResponsiveContainer>
                      <LineChart
                        data={followsSeriesData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="date" tickFormatter={formatDateTick} {...axisProps} />
                        <YAxis {...axisProps} />
                        <Tooltip {...TOOLTIP_PROPS} labelFormatter={formatDateTick} />
                        <Line
                          type="monotone"
                          dataKey="Follows"
                          stroke="#ec4899"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
              )}
            </DashboardSection>

            {/* ────────────────────────────────────────────────────────
                SECTION 3 — DEMOGRAPHICS & MIX
                Composition of the *current* user base — shape of the
                pie, not the size. Doesn't move with the date picker. */}
            <DashboardSection
              title="Demographics & mix"
              subtitle="Composition of your current user base — independent of the date range above."
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard
                  title="Plan mix"
                  subtitle="Active subscriptions by plan"
                >
                  <div className="w-full h-[260px]">
                    {planMixData.length === 0 ? (
                      <EmptyChart message="No active subscriptions yet" />
                    ) : (
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={planMixData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={2}
                            stroke="none"
                          >
                            {planMixData.map((entry) => (
                              <Cell
                                key={entry.name}
                                fill={PLAN_COLORS[entry.name] || "#64748b"}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            {...TOOLTIP_PROPS}
                            formatter={(value, name) => [formatNumber(value), name]}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }}
                            iconType="circle"
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </ChartCard>

                <ChartCard
                  title="Age distribution"
                  subtitle="Only users who've provided date of birth"
                >
                  <div className="w-full h-[260px]">
                    {ageData.every((d) => d.value === 0) ? (
                      <EmptyChart message="No DOB data yet" />
                    ) : (
                      <ResponsiveContainer>
                        <BarChart
                          data={ageData}
                          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid {...gridProps} />
                          <XAxis dataKey="name" {...axisProps} />
                          <YAxis {...axisProps} />
                          <Tooltip {...TOOLTIP_PROPS} />
                          <Bar
                            dataKey="value"
                            fill={AGE_COLOR}
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </ChartCard>
              </div>
            </DashboardSection>

            {/* ────────────────────────────────────────────────────────
                SECTION 4 — ALL-TIME LEADERBOARDS
                Who's winning across the platform's full lifetime.
                These intentionally ignore the date picker so admins
                can use them as a steady "north star" reference. */}
            <DashboardSection
              title="All-time leaderboards"
              subtitle="Top performers across the platform's full lifetime — these aren't affected by the date range above."
            >
              <ChartCard
                title="Top followed shows"
                subtitle="By follower count"
              >
                {topShows.length === 0 ? (
                  <EmptyChart message="No follows yet" />
                ) : (
                  <ul className="divide-y divide-white/[0.04]">
                    {topShows.map((s, idx) => (
                      <li
                        key={s.id}
                        className="flex items-center gap-3 py-2.5"
                      >
                        <span className="w-6 text-xs font-mono text-zinc-500">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedShowId(String(s.id));
                            setView("show");
                          }}
                          className="flex-1 min-w-0 truncate text-left text-sm text-zinc-200 hover:text-white transition-colors"
                          title="View per-show analytics"
                        >
                          {s.title}
                        </button>
                        <span className="text-xs tabular-nums text-zinc-400">
                          {formatNumber(s.follower_count)} followers
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </ChartCard>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard
                  title="Top episodes by plays"
                  subtitle="All time"
                >
                  <LeaderboardList
                    rows={topEpisodesByPlays}
                    empty="No plays recorded yet"
                    valueKey="plays"
                    valueLabel="plays"
                  />
                </ChartCard>

                <ChartCard
                  title="Top episodes by listen time"
                  subtitle="All time"
                >
                  <LeaderboardList
                    rows={topEpisodesByListen}
                    empty="No listen time recorded yet"
                    valueKey="minutes"
                    valueFormatter={formatMinutes}
                  />
                </ChartCard>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard
                  title="Top shows by plays"
                  subtitle="All time"
                >
                  <LeaderboardList
                    rows={topShowsByPlays}
                    empty="No plays recorded yet"
                    valueKey="plays"
                    valueLabel="plays"
                  />
                </ChartCard>

                <ChartCard
                  title="Top shows by listen time"
                  subtitle="All time"
                >
                  <LeaderboardList
                    rows={topShowsByListen}
                    empty="No listen time recorded yet"
                    valueKey="minutes"
                    valueFormatter={formatMinutes}
                  />
                </ChartCard>
              </div>
            </DashboardSection>

            {isFetching && (
              <p className="text-[11px] text-zinc-600 text-right">Updating…</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A small ranked list used by the engagement section for "top episodes
 * by plays", "top shows by listen time", and similar leaderboards. Each
 * row renders as "01. Title · show (optional) ······ 1,234 plays".
 *
 * Props:
 *   rows            – array of { id, title, podcast_title?, [valueKey] }
 *   valueKey        – key on each row holding the numeric value
 *   valueLabel      – suffix (e.g. "plays"). Ignored when valueFormatter
 *                     is provided.
 *   valueFormatter  – optional override; receives the raw value and
 *                     returns the fully-formatted string (used for
 *                     minute totals where we want "2h 15m" instead of
 *                     "135 min").
 *   empty           – message to show when rows is empty
 */
function LeaderboardList({ rows = [], valueKey, valueLabel = "", valueFormatter, empty }) {
  if (!rows.length) return <EmptyChart message={empty || "No data"} />;
  return (
    <ul className="divide-y divide-white/[0.04]">
      {rows.map((row, idx) => {
        const raw = row?.[valueKey] ?? 0;
        const label = valueFormatter
          ? valueFormatter(raw)
          : `${formatNumber(raw)}${valueLabel ? ` ${valueLabel}` : ""}`;
        return (
          <li
            key={row.id ?? `${idx}-${row.title}`}
            className="flex items-center gap-3 py-2.5"
          >
            <span className="w-6 text-xs font-mono text-zinc-500">
              {String(idx + 1).padStart(2, "0")}
            </span>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm text-zinc-200">{row.title}</p>
              {row.podcast_title && (
                <p className="truncate text-[11px] text-zinc-500">
                  {row.podcast_title}
                </p>
              )}
            </div>
            <span className="text-xs tabular-nums text-zinc-300 flex-shrink-0">
              {label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="w-full h-full flex items-center justify-center text-xs text-zinc-600">
      {message}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] h-[120px] animate-pulse"
          />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] h-[100px] animate-pulse"
          />
        ))}
      </div>
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] h-[320px] animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] h-[280px] animate-pulse" />
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] h-[280px] animate-pulse" />
      </div>
    </div>
  );
}

/**
 * High-level tab strip used to swap between the platform-wide Overview
 * and the per-show drill-down. Kept inline (rather than a generic UI
 * primitive) because it's only used in this one place and the styling
 * is intentionally tuned to feel like the rest of the analytics chrome
 * — soft pill, low contrast for the inactive state, a bit of warmth on
 * the active state to suggest you're "drilled in".
 */
function DashboardTabs({ tabs, active, onChange }) {
  return (
    <div className="inline-flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-pressed={isActive}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isActive
                ? "bg-white/[0.08] text-white border border-white/[0.1] shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent"
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Visual section wrapper with a header band. Used to make the temporal
 * scope of each group of cards/charts blindingly obvious — "Right now"
 * never gets confused with "In selected range" again, even at a glance.
 */
function DashboardSection({ title, subtitle, children, action }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.05] pb-3">
        <div className="min-w-0">
          <h2 className="text-base md:text-lg font-semibold text-white tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[11px] md:text-xs text-zinc-500 mt-1 max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

// ─── Per-show drill-down ─────────────────────────────────────────────
//
// Renders either a searchable picker (when nothing's selected) or the
// detail view for the selected show. All numbers come from the existing
// summary payload — no new endpoints needed. Where a metric isn't in
// the platform-wide top-10 we tell the admin so explicitly rather than
// silently rendering "0".

function PerShowView({
  podcasts,
  breakdowns,
  rangeLabel,
  selectedShowId,
  setSelectedShowId,
}) {
  // Stable, alphabetised list — admins jumping in fresh shouldn't have
  // to figure out the discovery ranking just to find a show.
  const podcastList = useMemo(
    () =>
      [...(podcasts || [])]
        .filter(Boolean)
        .sort((a, b) =>
          String(a.title || "").localeCompare(String(b.title || ""))
        ),
    [podcasts]
  );

  const followerById = useMemo(
    () =>
      Object.fromEntries(
        (breakdowns?.top_followed_podcasts || []).map((s) => [
          String(s.id),
          s.follower_count || 0,
        ])
      ),
    [breakdowns]
  );
  const showPlaysById = useMemo(
    () =>
      Object.fromEntries(
        (breakdowns?.top_shows_by_plays || []).map((s) => [
          String(s.id),
          s.plays || 0,
        ])
      ),
    [breakdowns]
  );
  const showListenById = useMemo(
    () =>
      Object.fromEntries(
        (breakdowns?.top_shows_by_listen_time || []).map((s) => [
          String(s.id),
          s.minutes || 0,
        ])
      ),
    [breakdowns]
  );
  const epPlaysById = useMemo(
    () =>
      Object.fromEntries(
        (breakdowns?.top_episodes_by_plays || []).map((e) => [
          String(e.id),
          e.plays || 0,
        ])
      ),
    [breakdowns]
  );
  const epListenById = useMemo(
    () =>
      Object.fromEntries(
        (breakdowns?.top_episodes_by_listen_time || []).map((e) => [
          String(e.id),
          e.minutes || 0,
        ])
      ),
    [breakdowns]
  );

  const selected = useMemo(() => {
    if (!selectedShowId) return null;
    return (
      podcastList.find((p) => String(p.id) === String(selectedShowId)) || null
    );
  }, [selectedShowId, podcastList]);

  if (!selected) {
    return (
      <ShowPickerPanel
        podcasts={podcastList}
        followerById={followerById}
        playsById={showPlaysById}
        onPick={(id) => setSelectedShowId(String(id))}
      />
    );
  }

  return (
    <PerShowDetail
      show={selected}
      onChangeShow={() => setSelectedShowId(null)}
      followerCount={followerById[String(selected.id)] ?? null}
      showPlays={
        Object.prototype.hasOwnProperty.call(
          showPlaysById,
          String(selected.id)
        )
          ? showPlaysById[String(selected.id)]
          : null
      }
      showListen={
        Object.prototype.hasOwnProperty.call(
          showListenById,
          String(selected.id)
        )
          ? showListenById[String(selected.id)]
          : null
      }
      epPlaysById={epPlaysById}
      epListenById={epListenById}
      rangeLabel={rangeLabel}
    />
  );
}

// Picks the appropriate "type" icon for a show card. Falls back to a
// microphone for everything that isn't explicitly an audiobook or
// album so the UI never shows a missing icon.
function showTypeIcon(podcast) {
  if (isAudiobook(podcast)) return BookOpen;
  if (isMusic(podcast)) return Music;
  return Mic2;
}

function ShowPickerPanel({ podcasts, followerById, playsById, onPick }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return podcasts;
    return podcasts.filter((p) =>
      String(p.title || "")
        .toLowerCase()
        .includes(q)
    );
  }, [podcasts, query]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base md:text-lg font-semibold text-white tracking-tight">
              Pick a show to drill into
            </h2>
            <p className="text-xs text-zinc-500 mt-1 max-w-xl leading-relaxed">
              Choose any show in the catalogue to see its episode list and any
              engagement data we have for it. Plays / listen-time figures come
              from the platform-wide top-10 leaderboards — shows or episodes
              outside the top 10 are marked accordingly.
            </p>
          </div>
          <div className="relative flex-shrink-0 w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search shows…"
              className="w-full pl-9 pr-3 h-9 rounded-full bg-black/40 border border-white/[0.08] text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/[0.18]"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-10 text-center text-sm text-zinc-500">
          {query
            ? `No shows matching "${query}".`
            : "No shows in the catalogue yet."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => {
            const Icon = showTypeIcon(p);
            const followers = followerById[String(p.id)];
            const plays = playsById[String(p.id)];
            const cover = p.cover_image_url || p.cover_url || p.image_url;
            const epCount = Array.isArray(p.episodes)
              ? p.episodes.length
              : Array.isArray(p.episodes?.results)
              ? p.episodes.results.length
              : null;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onPick(p.id)}
                className="group flex items-center gap-3 p-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04] transition-colors text-left"
              >
                <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-white/[0.04] flex items-center justify-center">
                  {cover ? (
                    <img
                      src={cover}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <Icon className="w-5 h-5 text-zinc-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-100 group-hover:text-white">
                    {p.title}
                  </p>
                  <p className="truncate text-[11px] text-zinc-500 mt-0.5">
                    {epCount != null && (
                      <span>{formatNumber(epCount)} episodes</span>
                    )}
                    {followers != null && (
                      <span>
                        {epCount != null ? " · " : ""}
                        {formatNumber(followers)} followers
                      </span>
                    )}
                    {plays != null && (
                      <span>
                        {epCount != null || followers != null ? " · " : ""}
                        {formatNumber(plays)} plays
                      </span>
                    )}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PerShowDetail({
  show,
  onChangeShow,
  followerCount,
  showPlays,
  showListen,
  epPlaysById,
  epListenById,
  rangeLabel,
}) {
  // Episodes can live under .episodes (array) or .episodes.results
  // depending on which serializer ran. Normalise once.
  const episodes = useMemo(() => {
    if (Array.isArray(show?.episodes)) return show.episodes;
    if (Array.isArray(show?.episodes?.results)) return show.episodes.results;
    return [];
  }, [show]);

  // Sort newest first by published_at; fall back to original order so
  // shows that don't ship publish dates still render predictably.
  const episodesSorted = useMemo(() => {
    return [...episodes].sort((a, b) => {
      const ta = Date.parse(a?.published_at || a?.publishedAt || "") || 0;
      const tb = Date.parse(b?.published_at || b?.publishedAt || "") || 0;
      return tb - ta;
    });
  }, [episodes]);

  // Episode IDs that belong to this show — used to filter the platform
  // wide top-10 leaderboards down to just this show's contributions.
  const ownEpisodeIds = useMemo(
    () => new Set(episodes.map((e) => String(e.id))),
    [episodes]
  );

  // "This show's episodes that placed in the platform-wide top 10"
  const topEpisodesForShowByPlays = useMemo(
    () =>
      episodesSorted
        .filter((e) =>
          Object.prototype.hasOwnProperty.call(epPlaysById, String(e.id))
        )
        .map((e) => ({
          id: e.id,
          title: e.title,
          plays: epPlaysById[String(e.id)],
        }))
        .sort((a, b) => (b.plays || 0) - (a.plays || 0)),
    [episodesSorted, epPlaysById]
  );

  const topEpisodesForShowByListen = useMemo(
    () =>
      episodesSorted
        .filter((e) =>
          Object.prototype.hasOwnProperty.call(epListenById, String(e.id))
        )
        .map((e) => ({
          id: e.id,
          title: e.title,
          minutes: epListenById[String(e.id)],
        }))
        .sort((a, b) => (b.minutes || 0) - (a.minutes || 0)),
    [episodesSorted, epListenById]
  );

  const cover =
    show.cover_image_url || show.cover_url || show.image_url || null;
  const Icon = showTypeIcon(show);
  const typeLabel = isAudiobook(show)
    ? "Audiobook"
    : isMusic(show)
    ? "Album"
    : "Podcast";

  return (
    <div className="space-y-8">
      {/* Hero card — show identity + headline metrics */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <div className="p-5 md:p-6 flex flex-col md:flex-row gap-5">
          <div className="w-32 h-32 md:w-40 md:h-40 flex-shrink-0 rounded-xl overflow-hidden bg-white/[0.04] flex items-center justify-center">
            {cover ? (
              <img
                src={cover}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <Icon className="w-10 h-10 text-zinc-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-zinc-500">
                  <Icon className="w-3 h-3" /> {typeLabel}
                </p>
                <h2 className="mt-1 text-xl md:text-2xl font-semibold text-white tracking-tight truncate">
                  {show.title}
                </h2>
                {show.author && (
                  <p className="text-sm text-zinc-400 mt-0.5 truncate">
                    by {show.author}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onChangeShow}
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                Change show
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MiniStat
                label="Episodes"
                value={formatNumber(episodes.length)}
                sub="in catalogue"
              />
              <MiniStat
                label="Followers"
                value={
                  followerCount != null
                    ? formatNumber(followerCount)
                    : "—"
                }
                sub={followerCount != null ? "all-time" : "outside top-10"}
              />
              <MiniStat
                label="Plays"
                value={showPlays != null ? formatNumber(showPlays) : "—"}
                sub={
                  showPlays != null ? `in ${rangeLabel}` : "outside top-10"
                }
                tone="accent"
              />
              <MiniStat
                label="Listen time"
                value={
                  showListen != null ? formatMinutes(showListen) : "—"
                }
                sub={
                  showListen != null
                    ? `in ${rangeLabel}`
                    : "outside top-10"
                }
                tone="good"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Per-show top episodes (filtered from platform top-10) */}
      <DashboardSection
        title="This show's top episodes"
        subtitle={`Episodes from this show that placed in the platform-wide top 10 for ${rangeLabel}. Episodes outside the top 10 won't appear here.`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="By plays"
            subtitle={`Within ${rangeLabel}`}
          >
            <LeaderboardList
              rows={topEpisodesForShowByPlays}
              empty="None of this show's episodes placed in the platform top 10 for plays in this range."
              valueKey="plays"
              valueLabel="plays"
            />
          </ChartCard>
          <ChartCard
            title="By listen time"
            subtitle={`Within ${rangeLabel}`}
          >
            <LeaderboardList
              rows={topEpisodesForShowByListen}
              empty="None of this show's episodes placed in the platform top 10 for listen time in this range."
              valueKey="minutes"
              valueFormatter={formatMinutes}
            />
          </ChartCard>
        </div>
      </DashboardSection>

      {/* Full episode catalogue */}
      <DashboardSection
        title="Episode catalogue"
        subtitle={`Every episode for this show. Plays and listen-time columns are filled in only when an episode placed in the platform-wide top 10 for ${rangeLabel}.`}
      >
        {episodesSorted.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-10 text-center text-sm text-zinc-500">
            No episodes available for this show.
          </div>
        ) : (
          <EpisodeCatalogueTable
            episodes={episodesSorted}
            epPlaysById={epPlaysById}
            epListenById={epListenById}
          />
        )}
      </DashboardSection>
    </div>
  );
}

function MiniStat({ label, value, sub, tone = "default" }) {
  const valueClass =
    tone === "accent"
      ? "text-amber-300"
      : tone === "good"
      ? "text-emerald-300"
      : "text-white";
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${valueClass}`}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function EpisodeCatalogueTable({ episodes, epPlaysById, epListenById }) {
  const fmtDate = (iso) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "—";
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      {/* Header — desktop only */}
      <div className="hidden md:grid grid-cols-[minmax(0,1fr)_120px_120px_120px] gap-4 px-4 py-2.5 text-[10px] uppercase tracking-wide text-zinc-500 border-b border-white/[0.05] bg-white/[0.01]">
        <span>Episode</span>
        <span className="text-right">Published</span>
        <span className="text-right">Plays</span>
        <span className="text-right">Listen time</span>
      </div>
      <ul className="divide-y divide-white/[0.04]">
        {episodes.map((e) => {
          const plays = epPlaysById[String(e.id)];
          const minutes = epListenById[String(e.id)];
          const cover = e.cover_image_url || e.cover_url || e.image_url;
          return (
            <li
              key={e.id}
              className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_120px_120px_120px] gap-2 md:gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 flex-shrink-0 rounded-md overflow-hidden bg-white/[0.04]">
                  {cover ? (
                    <img
                      src={cover}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm text-zinc-100">{e.title}</p>
                  <p className="md:hidden truncate text-[11px] text-zinc-500 mt-0.5">
                    {fmtDate(e.published_at || e.publishedAt)}
                  </p>
                </div>
              </div>
              <span className="hidden md:block text-right text-xs text-zinc-400 self-center tabular-nums">
                {fmtDate(e.published_at || e.publishedAt)}
              </span>
              <span
                className={`text-right text-sm tabular-nums self-center ${
                  plays != null ? "text-amber-200" : "text-zinc-600"
                }`}
              >
                {plays != null ? formatNumber(plays) : "—"}
              </span>
              <span
                className={`text-right text-sm tabular-nums self-center ${
                  minutes != null ? "text-emerald-200" : "text-zinc-600"
                }`}
              >
                {minutes != null ? formatMinutes(minutes) : "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
