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
import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
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
  Library as LibraryIcon,
  Search,
  ChevronRight,
  Music,
  BookOpen,
  Mic2,
  ArrowUp,
  ArrowDown,
  Search as SearchIcon,
  X as XIcon,
  Clock,
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
  { key: "all", label: "All time" },
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

/**
 * "Active in last 24h" panel — a Steam-style live-activity counter
 * that sits at the top of the Snapshot tab. The big number is total
 * unique visitors in the rolling 24-hour window; the four pills
 * below break that into logged-in (paid + free) and anonymous so
 * an admin can tell at a glance who's actually using the platform
 * right now.
 *
 * The breakdown bar is intentionally proportional rather than
 * absolute — when the platform is small the four numbers fit on a
 * single line; when it's large the bar still shows the mix at a
 * glance without each segment needing its own label.
 */
function ActiveUsersCard({ kpis }) {
  const total = Number(kpis?.active_24h_total) || 0;
  const paid = Number(kpis?.active_24h_paid) || 0;
  const free = Number(kpis?.active_24h_free) || 0;
  const loggedIn = Number(kpis?.active_24h_logged_in) || paid + free;
  const anon = Number(kpis?.active_24h_anonymous) || 0;

  // Build proportional bar segments. Show a hairline of empty rail
  // even when total is zero so the panel doesn't render an awkwardly
  // empty slot on a brand-new install.
  const seg = (n) => (total > 0 ? (n / total) * 100 : 0);

  return (
    <div className="relative rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.06] via-white/[0.02] to-transparent p-5 md:p-6 overflow-hidden">
      {/* Pulse dot — purely cosmetic, signals "live" the way Steam's
          counter does. */}
      <div className="absolute top-5 right-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400/80">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
        Live · 24h
      </div>

      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
        Active visitors
      </p>
      <p className="mt-1 text-3xl md:text-4xl font-bold tabular-nums text-white tracking-tight">
        {formatNumber(total)}
      </p>
      <p className="mt-0.5 text-xs text-zinc-500">
        Unique visitors in the last 24 hours
      </p>

      {/* Proportional breakdown bar */}
      <div className="mt-5 h-2 w-full rounded-full overflow-hidden bg-white/[0.04] flex">
        <div
          className="h-full bg-amber-400/90"
          style={{ width: `${seg(paid)}%` }}
          title={`${formatNumber(paid)} paid`}
        />
        <div
          className="h-full bg-sky-400/80"
          style={{ width: `${seg(free)}%` }}
          title={`${formatNumber(free)} free`}
        />
        <div
          className="h-full bg-zinc-500/70"
          style={{ width: `${seg(anon)}%` }}
          title={`${formatNumber(anon)} not signed in`}
        />
      </div>

      {/* Numeric breakdown — one row per visitor type */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <ActiveSegment
          color="bg-amber-400/90"
          label="Paid"
          value={paid}
          hint="signed in · subscribed"
        />
        <ActiveSegment
          color="bg-sky-400/80"
          label="Free"
          value={free}
          hint="signed in · free tier"
        />
        <ActiveSegment
          color="bg-emerald-400/80"
          label="Logged in"
          value={loggedIn}
          hint={`${formatNumber(paid)} paid + ${formatNumber(free)} free`}
        />
        <ActiveSegment
          color="bg-zinc-500/70"
          label="Not signed in"
          value={anon}
          hint="anonymous browsers"
        />
      </div>
    </div>
  );
}

function ActiveSegment({ color, label, value, hint }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className={`mt-1.5 inline-block w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          {label}
        </p>
        <p className="text-lg font-bold tabular-nums text-white leading-tight mt-0.5">
          {formatNumber(value)}
        </p>
        {hint && <p className="text-[10px] text-zinc-600 truncate">{hint}</p>}
      </div>
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

  // Top-level dashboard tab. Each tab corresponds to one of the
  // dashboard's purposes — Snapshot is the always-current state of
  // the platform, Trends is everything driven by the date picker,
  // Demographics is composition of the user base, Leaderboards is
  // the top-N rankings (now range-aware), and Per-show is the
  // single-show drill-down. The choice persists across reloads so
  // admins who deep-link into one view don't get bumped back to
  // Snapshot every time.
  const VIEW_KEY = "eeriecast.adminAnalytics.view.v2";
  const TABS = useMemo(
    () => [
      { id: "snapshot", label: "Snapshot", icon: Activity },
      { id: "trends", label: "Trends", icon: TrendingUp },
      { id: "demographics", label: "Demographics", icon: Users },
      { id: "leaderboards", label: "Leaderboards", icon: Crown },
      { id: "audiobooks", label: "Audiobooks", icon: BookOpen },
      { id: "show", label: "Per-show", icon: LibraryIcon },
    ],
    []
  );
  const VALID_VIEWS = useMemo(() => new Set(TABS.map((t) => t.id)), [TABS]);
  const [view, setView] = useState(() => {
    try {
      const v = window.localStorage.getItem(VIEW_KEY);
      return v && VALID_VIEWS.has(v) ? v : "snapshot";
    } catch {
      return "snapshot";
    }
  });
  const [selectedShowId, setSelectedShowId] = useState(() => {
    try {
      return window.localStorage.getItem(`${VIEW_KEY}.show`) || null;
    } catch {
      return null;
    }
  });

  // Episode detail modal — set to an episode id when an episode row
  // is clicked from any of the surfaces (Per-show catalogue,
  // Per-show "top" lists, Leaderboards Episodes table). Cleared
  // back to null on close.
  const [episodeDetailId, setEpisodeDetailId] = useState(null);
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

  // The Leaderboards tab now fetches its own paginated data from
  // /analytics/shows/ + /analytics/episodes/, so we no longer
  // destructure the summary's top-10 lists here. The per-show
  // drill-down still consumes them, but it reads directly off the
  // `breakdowns` prop it's passed.

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
      all: "all time",
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
        {/* Header — back link, page title, date picker. The subtitle
            that used to sit under the title was pure flavor and has
            been removed; the tabs and date picker carry the weight. */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
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
          </div>
          {/* Date picker is hidden on tabs that don't respect a range
              (Snapshot is always-current; Demographics is composition;
              Audiobooks is always-all-time; Per-show drives its own
              scope) so admins aren't fooled into thinking changing
              it would do something. */}
          {(view === "trends" || view === "leaderboards") && (
            <DateRangeBar
              range={range}
              setRange={setRange}
              customStart={customStart}
              customEnd={customEnd}
              setCustomStart={setCustomStart}
              setCustomEnd={setCustomEnd}
            />
          )}
        </div>

        {/* Top-level dashboard tabs — flat by design so the dashboard's
            five surfaces sit at the same level, instead of one nested
            inside the others. */}
        <div className="mb-6">
          <DashboardTabs tabs={TABS} active={view} onChange={setView} />
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
            queryArgs={queryArgs}
            rangeLabel={rangeLabel}
            selectedShowId={selectedShowId}
            setSelectedShowId={setSelectedShowId}
            onPickEpisode={(id) => setEpisodeDetailId(String(id))}
          />
        ) : view === "snapshot" ? (
          <div className="space-y-6">
            {/* Active in last 24h — Steam-style live-activity snapshot.
                Always-current rolling window; doesn't respect the date
                picker. The component itself paints a single emphasized
                card with the breakdown rendered as a horizontal bar so
                paid-vs-free-vs-anonymous reads at a glance. */}
            <ActiveUsersCard kpis={kpis} />

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
              />
              <KpiCard
                icon={Headphones}
                label="Total shows"
                value={formatNumber(kpis.total_shows)}
              />
              <KpiCard
                icon={Heart}
                label="Total follows"
                value={formatNumber(kpis.total_follows)}
              />
              <KpiCard
                icon={Activity}
                label="Listened"
                value={formatMinutes(kpis.total_minutes_listened)}
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
          </div>
        ) : view === "trends" ? (
          // ─────────────────────────────────────────────────────────
          // TRENDS — everything that respects the date picker.
          <div className="space-y-6">
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
                  tone="good"
                />
                <KpiCard
                  icon={CheckCircle2}
                  label="Completions"
                  value={formatNumber(kpis.completions_in_range)}
                />
                <KpiCard
                  icon={Heart}
                  label="New follows"
                  value={formatNumber(kpis.new_follows_in_range)}
                  sub={`${formatNumber(kpis.total_follows)} all-time`}
                />
              </div>

              {/* Primary chart — Free vs Paid growth over time */}
              <ChartCard title="User growth">
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
                <ChartCard title="New signups">
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

                <ChartCard title="Subscription flow">
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
                <ChartCard title="Plays vs. completions">
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

                <ChartCard title="Listen minutes">
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
                <ChartCard title="New follows">
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
          </div>
        ) : view === "demographics" ? (
          // ─────────────────────────────────────────────────────────
          // DEMOGRAPHICS — composition of the current user base.
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Plan mix">
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

              <ChartCard title="Age distribution">
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
          </div>
        ) : view === "leaderboards" ? (
          // ─────────────────────────────────────────────────────────
          // LEADERBOARDS — full sortable tables of every show and
          // every episode. Range-aware. Replaces the previous
          // "top 10 of each ranking" panels so admins can see the
          // long tail, sort by any column, and search by title.
          <LeaderboardsView
            queryArgs={queryArgs}
            onPickShow={(id) => {
              setSelectedShowId(String(id));
              setView("show");
            }}
            onPickEpisode={(id) => setEpisodeDetailId(String(id))}
          />
        ) : view === "audiobooks" ? (
          // ─────────────────────────────────────────────────────────
          // AUDIOBOOKS — per-book retention curves. Always all-time
          // (the question "how far do listeners get?" only makes
          // sense as a long-window aggregate; a 30-day slice is
          // dominated by whoever happened to be reading that month).
          <AudiobooksView />
        ) : null}

        {/* Global "updating…" indicator shown while React Query is
            re-fetching in the background after a range change. Lives
            outside the tab content so it doesn't shift around as the
            user moves between tabs. */}
        {!isLoading && !error && isFetching && (
          <p className="mt-4 text-[11px] text-zinc-600 text-right">Updating…</p>
        )}
      </div>

      {/* Episode detail modal — opens whenever any episode row is
          clicked, regardless of which surface the click came from
          (Per-show catalogue, Per-show top lists, Leaderboards
          Episodes table). Mounted at the page root so it overlays
          the entire dashboard. */}
      <EpisodeDetailModal
        episodeId={episodeDetailId}
        queryArgs={queryArgs}
        rangeLabel={rangeLabel}
        onClose={() => setEpisodeDetailId(null)}
      />
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
function LeaderboardList({ rows = [], valueKey, valueLabel = "", valueFormatter, empty, onPick }) {
  if (!rows.length) return <EmptyChart message={empty || "No data"} />;
  return (
    <ul className="divide-y divide-white/[0.04]">
      {rows.map((row, idx) => {
        const raw = row?.[valueKey] ?? 0;
        const label = valueFormatter
          ? valueFormatter(raw)
          : `${formatNumber(raw)}${valueLabel ? ` ${valueLabel}` : ""}`;
        const pickable = !!onPick;
        return (
          <li
            key={row.id ?? `${idx}-${row.title}`}
            onClick={pickable ? () => onPick(row.id) : undefined}
            className={`flex items-center gap-3 py-2.5 ${
              pickable
                ? "cursor-pointer hover:bg-white/[0.03] -mx-2 px-2 rounded-md transition-colors"
                : ""
            }`}
            title={pickable ? "View detail" : undefined}
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

/* ─── Leaderboards tab ─────────────────────────────────────────────
 *
 * Two side-by-side sections:
 *   • Shows table   — every show in the catalogue
 *   • Episodes table — every episode, paginated server-side
 *
 * Each table is sortable by any numeric column. The Shows table
 * also offers a free-text search filtered locally; the Episodes
 * table forwards its query string to the server because the
 * episode catalogue is too large to ship in one payload.
 *
 * Both tables are range-aware: switching the date picker at the
 * top of the page swaps in fresh data without rerendering the
 * surrounding chrome.
 */
function LeaderboardsView({ queryArgs, onPickShow, onPickEpisode }) {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <ShowsLeaderboard queryArgs={queryArgs} onPickShow={onPickShow} navigate={navigate} />
      <EpisodesLeaderboard queryArgs={queryArgs} onPickEpisode={onPickEpisode} />
    </div>
  );
}

LeaderboardsView.propTypes = {
  queryArgs: PropTypes.object.isRequired,
  onPickShow: PropTypes.func.isRequired,
  onPickEpisode: PropTypes.func.isRequired,
};

const SHOW_KIND_BADGES = {
  audiobook: { label: "Book",     icon: BookOpen, className: "text-cyan-300/90 bg-cyan-500/10 border-cyan-400/[0.12]" },
  music:     { label: "Music",    icon: Music,    className: "text-fuchsia-300/90 bg-fuchsia-500/10 border-fuchsia-400/[0.12]" },
  podcast:   { label: "Podcast",  icon: Mic2,     className: "text-amber-300/90 bg-amber-500/10 border-amber-400/[0.12]" },
};

function ShowsLeaderboard({ queryArgs, onPickShow, navigate }) {
  const [sortKey, setSortKey] = useState("plays");
  const [sortDir, setSortDir] = useState("desc");
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "shows", queryArgs],
    queryFn: () => Analytics.shows(queryArgs),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const shows = data?.shows || [];

  const visibleShows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = q ? shows.filter((s) => (s.title || "").toLowerCase().includes(q)) : shows.slice();
    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" || typeof bv === "string") {
        const cmp = String(av || "").localeCompare(String(bv || ""));
        return sortDir === "desc" ? -cmp : cmp;
      }
      const diff = (Number(av) || 0) - (Number(bv) || 0);
      return sortDir === "desc" ? -diff : diff;
    });
    return rows;
  }, [shows, search, sortKey, sortDir]);

  const handleHeader = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      // Numeric columns default to desc (biggest first); title
      // defaults to asc (alphabetical).
      setSortDir(key === "title" ? "asc" : "desc");
    }
  };

  return (
    <ChartCard title="Shows">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          {formatNumber(visibleShows.length)}
          {search.trim() ? ` of ${formatNumber(shows.length)}` : ""} shows
        </p>
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="search"
            placeholder="Search shows…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-black/40 border border-white/[0.08] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-white/20 w-44 sm:w-56"
          />
        </div>
      </div>

      {error ? (
        <EmptyChart message="Couldn't load shows." />
      ) : isLoading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      ) : visibleShows.length === 0 ? (
        <EmptyChart message={search.trim() ? "No shows match that search." : "No shows yet."} />
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 border-b border-white/[0.04]">
                <SortableHeader label="Title" col="title" sortKey={sortKey} sortDir={sortDir} onClick={handleHeader} align="left" />
                <SortableHeader label="Followers" col="followers" sortKey={sortKey} sortDir={sortDir} onClick={handleHeader} />
                <SortableHeader label="Plays" col="plays" sortKey={sortKey} sortDir={sortDir} onClick={handleHeader} />
                <SortableHeader label="Listen time" col="listen_minutes" sortKey={sortKey} sortDir={sortDir} onClick={handleHeader} />
                <SortableHeader label="Episodes" col="episode_count" sortKey={sortKey} sortDir={sortDir} onClick={handleHeader} />
              </tr>
            </thead>
            <tbody>
              {visibleShows.map((s) => {
                const badge = SHOW_KIND_BADGES[s.kind] || SHOW_KIND_BADGES.podcast;
                const BadgeIcon = badge.icon;
                return (
                  <tr
                    key={s.id}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest border px-1.5 py-0.5 rounded-full flex-shrink-0 ${badge.className}`}
                        >
                          <BadgeIcon className="w-2.5 h-2.5" />
                          {badge.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => onPickShow(s.id)}
                          className="flex-1 min-w-0 truncate text-left text-zinc-200 hover:text-white transition-colors"
                          title="Per-show analytics"
                        >
                          {s.title}
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-zinc-300 whitespace-nowrap">
                      {formatNumber(s.followers)}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-zinc-300 whitespace-nowrap">
                      {formatNumber(s.plays)}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-zinc-300 whitespace-nowrap">
                      {formatMinutes(s.listen_minutes)}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-zinc-500 whitespace-nowrap">
                      {formatNumber(s.episode_count)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}

ShowsLeaderboard.propTypes = {
  queryArgs: PropTypes.object.isRequired,
  onPickShow: PropTypes.func.isRequired,
  navigate: PropTypes.func.isRequired,
};

function EpisodesLeaderboard({ queryArgs, onPickEpisode }) {
  const PAGE_SIZE = 50;
  const [sort, setSort] = useState("plays");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  // Reset to page 1 whenever sort, search, or range changes — paging
  // forward into a now-different result set would land on stale data.
  useEffect(() => {
    setPage(1);
  }, [sort, search, queryArgs]);

  const apiArgs = useMemo(() => ({
    ...queryArgs,
    page,
    page_size: PAGE_SIZE,
    sort,
    q: search.trim() || undefined,
  }), [queryArgs, page, sort, search]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "episodes", apiArgs],
    queryFn: () => Analytics.episodes(apiArgs),
    keepPreviousData: true,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const rows = data?.episodes || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleHeader = (key) => {
    // Backend supports a fixed set of sort keys; we only flip
    // direction when the user clicks the already-active column.
    // Direction isn't sent to the server (it always sorts desc on
    // numeric columns, asc on text), so we mirror that here.
    if (key === sort) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSort(key);
      setSortDir(key === "title" || key === "show" ? "asc" : "desc");
    }
  };

  // Numeric sorts on the server are descending; if the user has
  // toggled to ascending, reverse the page locally. This is fine
  // because we're only reversing the visible 50 rows — the server
  // pagination still drives the global ordering.
  const visibleRows = useMemo(() => {
    if (sortDir === "asc" && (sort === "plays" || sort === "listen" || sort === "completions")) {
      return rows.slice().reverse();
    }
    return rows;
  }, [rows, sort, sortDir]);

  return (
    <ChartCard title="Episodes">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          {formatNumber(total)} episodes
          {data && totalPages > 1 ? ` · page ${page} of ${formatNumber(totalPages)}` : ""}
        </p>
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="search"
            placeholder="Search episodes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-black/40 border border-white/[0.08] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-white/20 w-44 sm:w-56"
          />
        </div>
      </div>

      {error ? (
        <EmptyChart message="Couldn't load episodes." />
      ) : isLoading && !data ? (
        <div className="space-y-1.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyChart message={search.trim() ? "No episodes match that search." : "No episodes yet."} />
      ) : (
        <>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 border-b border-white/[0.04]">
                  <SortableHeader label="Title" col="title" sortKey={sort} sortDir={sortDir} onClick={handleHeader} align="left" />
                  <SortableHeader label="Show" col="show" sortKey={sort} sortDir={sortDir} onClick={handleHeader} align="left" />
                  <SortableHeader label="Plays" col="plays" sortKey={sort} sortDir={sortDir} onClick={handleHeader} />
                  <SortableHeader label="Listen time" col="listen" sortKey={sort} sortDir={sortDir} onClick={handleHeader} />
                  <SortableHeader label="Completions" col="completions" sortKey={sort} sortDir={sortDir} onClick={handleHeader} />
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((ep) => (
                  <tr
                    key={ep.id}
                    onClick={() => onPickEpisode?.(ep.id)}
                    className="border-b border-white/[0.03] hover:bg-white/[0.04] transition-colors cursor-pointer"
                    title="View episode detail"
                  >
                    <td className="py-2.5 px-2 text-zinc-200 truncate max-w-[24rem]">
                      {ep.title}
                    </td>
                    <td className="py-2.5 px-2 text-zinc-500 truncate max-w-[14rem]">
                      {ep.podcast_title}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-zinc-300 whitespace-nowrap">
                      {formatNumber(ep.plays)}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-zinc-300 whitespace-nowrap">
                      {formatMinutes(ep.listen_minutes)}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-zinc-500 whitespace-nowrap">
                      {formatNumber(ep.completions)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="text-xs text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed border border-white/[0.06] transition-colors"
              >
                ← Previous
              </button>
              <span className="text-xs text-zinc-500 tabular-nums">
                Page {page} / {formatNumber(totalPages)}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="text-xs text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed border border-white/[0.06] transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </ChartCard>
  );
}

EpisodesLeaderboard.propTypes = {
  queryArgs: PropTypes.object.isRequired,
  onPickEpisode: PropTypes.func,
};

function SortableHeader({ label, col, sortKey, sortDir, onClick, align = "right" }) {
  const isActive = sortKey === col;
  const ArrowIcon = sortDir === "desc" ? ArrowDown : ArrowUp;
  return (
    <th
      className={`py-2 px-2 ${align === "right" ? "text-right" : "text-left"} cursor-pointer select-none hover:text-zinc-300 transition-colors`}
      onClick={() => onClick(col)}
    >
      <span className={`inline-flex items-center gap-1 ${isActive ? "text-zinc-300" : ""}`}>
        {label}
        {isActive && <ArrowIcon className="w-3 h-3" />}
      </span>
    </th>
  );
}

SortableHeader.propTypes = {
  label: PropTypes.string.isRequired,
  col: PropTypes.string.isRequired,
  sortKey: PropTypes.string.isRequired,
  sortDir: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  align: PropTypes.oneOf(["left", "right"]),
};

/* ─── Audiobooks tab ───────────────────────────────────────────────
 *
 * Per-audiobook completion view. Each row is a card showing the
 * book's cover, headline stats (listener count, completion rate,
 * average chapter reached), and a smooth drop-off curve drawn as
 * an AreaChart. The curve makes it instantly visible where in the
 * book listeners abandon — a cliff at chapter 4 means chapter 4
 * is what's killing the audience.
 */
function AudiobooksView() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "audiobooks"],
    queryFn: () => Analytics.audiobooks(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.05] p-5 text-sm text-rose-200">
        Couldn't load audiobook completion data.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] h-44 animate-pulse"
          />
        ))}
      </div>
    );
  }

  const books = data?.audiobooks || [];
  if (books.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-10 text-center text-sm text-zinc-500">
        No audiobooks in the catalogue yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {books.map((book) => (
        <AudiobookCard key={book.id} book={book} />
      ))}
    </div>
  );
}

function AudiobookCard({ book }) {
  // Build chart data with 1-indexed chapter labels — admins think
  // in "chapter 1, chapter 2" not "index 0, index 1".
  const chartData = useMemo(
    () =>
      (book.drop_off || []).map((retention, i) => ({
        chapter: i + 1,
        retention: Math.round(retention * 1000) / 10, // 0–100 with one decimal
      })),
    [book.drop_off]
  );

  const completionPct = Math.round((book.completion_rate || 0) * 100);
  // Tone the completion-rate badge from rose → amber → emerald so the
  // colour at a glance signals whether this book is healthy.
  const completionTone =
    completionPct >= 50
      ? "text-emerald-300 bg-emerald-500/10 border-emerald-400/[0.15]"
      : completionPct >= 25
        ? "text-amber-300 bg-amber-500/10 border-amber-400/[0.15]"
        : "text-rose-300 bg-rose-500/10 border-rose-400/[0.15]";

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.025] to-white/[0.005] p-4 md:p-5 overflow-hidden">
      <div className="flex items-start gap-4 mb-4">
        {book.cover_image ? (
          <img
            src={book.cover_image}
            alt=""
            className="w-16 h-20 md:w-20 md:h-24 rounded-lg object-cover flex-shrink-0 ring-1 ring-white/[0.06]"
          />
        ) : (
          <div className="w-16 h-20 md:w-20 md:h-24 rounded-lg flex items-center justify-center bg-white/[0.04] ring-1 ring-white/[0.06] flex-shrink-0">
            <BookOpen className="w-6 h-6 text-zinc-600" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-display italic text-base md:text-lg font-semibold text-white tracking-tight leading-tight line-clamp-2">
            {book.title}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/[0.04]">
              {formatNumber(book.total_chapters)} chapters
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/[0.04]">
              {formatNumber(book.listener_count)} listeners
            </span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${completionTone}`}>
              {completionPct}% finished
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-500 tabular-nums">
            Avg. chapter <span className="text-zinc-300">{book.avg_chapter_reached}</span>
          </p>
        </div>
      </div>

      {/* Drop-off curve — stacked area, accent fades with retention */}
      <div className="w-full h-[140px]">
        <ResponsiveContainer>
          <AreaChart data={chartData} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-book-${book.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.55} />
                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis
              dataKey="chapter"
              {...axisProps}
              tickFormatter={(n) => `Ch ${n}`}
              interval="preserveStartEnd"
            />
            <YAxis
              {...axisProps}
              tickFormatter={(v) => `${v}%`}
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
            />
            <Tooltip
              {...TOOLTIP_PROPS}
              labelFormatter={(label) => `Chapter ${label}`}
              formatter={(value) => [`${value}% reached`, "Retention"]}
            />
            <Area
              type="monotone"
              dataKey="retention"
              stroke="#22d3ee"
              strokeWidth={1.5}
              fill={`url(#grad-book-${book.id})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

AudiobookCard.propTypes = {
  book: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    title: PropTypes.string.isRequired,
    cover_image: PropTypes.string,
    total_chapters: PropTypes.number.isRequired,
    listener_count: PropTypes.number.isRequired,
    completion_rate: PropTypes.number.isRequired,
    avg_chapter_reached: PropTypes.number.isRequired,
    drop_off: PropTypes.arrayOf(PropTypes.number).isRequired,
  }).isRequired,
};

/* ─── Episode detail modal ─────────────────────────────────────────
 *
 * Opens whenever any episode row is clicked from any surface in the
 * dashboard. Fetches /analytics/episodes/<id>/ on open and renders:
 *
 *   • header — title, show, runtime, release date, close button
 *   • six KPI cards — plays / listen / completions / completion rate /
 *     listeners (in-range), with all-time totals as the sub-text
 *   • plays-over-time bar chart (range-aware)
 *   • position-retention curve (always all-time) — shows where in
 *     the episode listeners drop off
 *
 * Mounted at the page root and controlled by `episodeId`: a string
 * id opens it with that episode's data; null/undefined means closed.
 * Closes on backdrop click, the X button, or the Escape key.
 */
function EpisodeDetailModal({ episodeId, queryArgs, rangeLabel, onClose }) {
  const isOpen = !!episodeId;

  // Allow Escape to dismiss — modal-grade UX expectation. Only
  // attaches when the modal is actually open so we don't intercept
  // the key while admins are scrolling the dashboard.
  useEffect(() => {
    if (!isOpen) return undefined;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", "episode-detail", episodeId, queryArgs],
    queryFn: () => Analytics.episodeDetail(episodeId, queryArgs),
    enabled: isOpen,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="relative w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-gradient-to-b from-[#101018] to-[#0a0a12] border border-white/[0.06] shadow-2xl shadow-black/60">
        {/* Sticky header so the close button + title stay visible
            while admins scroll the long-tail content below. */}
        <div className="sticky top-0 z-10 px-5 sm:px-6 py-4 bg-gradient-to-b from-[#101018] to-[#101018cc] backdrop-blur-md border-b border-white/[0.06] flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {data ? (
              <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight leading-tight line-clamp-2">
                {data.title}
              </h2>
            ) : (
              <div className="h-6 w-2/3 rounded bg-white/[0.05] animate-pulse" />
            )}
            {data && (
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                {data.podcast_title && (
                  <span className="truncate">{data.podcast_title}</span>
                )}
                {data.duration > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatMinutes(Math.round(data.duration / 60))}
                  </span>
                )}
                {data.created_date && (
                  <span>
                    {new Date(data.created_date).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.04] border border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6">
          {error ? (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.05] p-4 text-sm text-rose-200">
              Couldn't load this episode. {error?.message || "Try again."}
            </div>
          ) : isLoading || !data ? (
            <EpisodeDetailSkeleton />
          ) : (
            <EpisodeDetailContent data={data} rangeLabel={rangeLabel} />
          )}
        </div>
      </div>
    </div>
  );
}

EpisodeDetailModal.propTypes = {
  episodeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  queryArgs: PropTypes.object.isRequired,
  rangeLabel: PropTypes.string,
  onClose: PropTypes.func.isRequired,
};

function EpisodeDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-xl bg-white/[0.02] animate-pulse"
          />
        ))}
      </div>
      <div className="h-[260px] rounded-2xl bg-white/[0.02] animate-pulse" />
      <div className="h-[200px] rounded-2xl bg-white/[0.02] animate-pulse" />
    </div>
  );
}

function EpisodeDetailContent({ data, rangeLabel }) {
  const playsSeriesData = useMemo(
    () =>
      (data.series?.labels || []).map((label, i) => ({
        date: label,
        Plays: data.series?.plays?.[i] ?? 0,
      })),
    [data.series]
  );

  const retentionData = useMemo(() => {
    const arr = data.position_retention || [];
    if (arr.length === 0) return [];
    return arr.map((retention, i) => ({
      // The curve is sampled at boundary i / N — express that as
      // "% through the episode" (0%, 5%, 10%, …) for axis labels.
      pct: Math.round((i / arr.length) * 100),
      retention: Math.round(retention * 1000) / 10,
    }));
  }, [data.position_retention]);

  const inRange = data.in_range || {};
  const allTime = data.all_time || {};
  const completionPct = Math.round((inRange.completion_rate || 0) * 100);

  const noPlaysInRange =
    playsSeriesData.length === 0 ||
    playsSeriesData.every((d) => d.Plays === 0);

  return (
    <div className="space-y-5">
      {/* KPI grid — five tiles, range-scoped value with all-time
          total in the sub line so admins always know both. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <KpiCard
          icon={Play}
          label="Plays"
          value={formatNumber(inRange.plays)}
          sub={`${formatNumber(allTime.plays)} all-time`}
          tone="accent"
        />
        <KpiCard
          icon={Headphones}
          label="Listen time"
          value={formatMinutes(inRange.listen_minutes)}
          sub={`${formatMinutes(allTime.listen_minutes)} all-time`}
          tone="good"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Completions"
          value={formatNumber(inRange.completions)}
          sub={`${formatNumber(allTime.completions)} all-time`}
        />
        <KpiCard
          icon={Activity}
          label="Completion rate"
          value={`${completionPct}%`}
          sub={`of ${formatNumber(inRange.listeners)} listeners`}
          tone={completionPct >= 50 ? "good" : completionPct >= 25 ? "default" : "bad"}
        />
        <KpiCard
          icon={Users}
          label="Listeners"
          value={formatNumber(inRange.listeners)}
          sub={`${formatNumber(allTime.listeners)} all-time`}
        />
      </div>

      {/* Plays over time — range-scoped */}
      <ChartCard title="Plays over time">
        <div className="w-full h-[220px]">
          {noPlaysInRange ? (
            <EmptyChart message="No plays recorded in this range" />
          ) : (
            <ResponsiveContainer>
              <BarChart
                data={playsSeriesData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid {...gridProps} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateTick}
                  {...axisProps}
                />
                <YAxis {...axisProps} />
                <Tooltip
                  {...TOOLTIP_PROPS}
                  labelFormatter={formatDateTick}
                />
                <Bar dataKey="Plays" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>

      {/* Position retention — always all-time. Hidden entirely
          when there's nothing to plot (no duration on the episode
          or zero listeners). */}
      {retentionData.length > 0 && (
        <ChartCard title="Where listeners drop off">
          <div className="w-full h-[200px]">
            <ResponsiveContainer>
              <AreaChart
                data={retentionData}
                margin={{ top: 6, right: 6, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="grad-ep-retention" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis
                  dataKey="pct"
                  {...axisProps}
                  tickFormatter={(n) => `${n}%`}
                />
                <YAxis
                  {...axisProps}
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                />
                <Tooltip
                  {...TOOLTIP_PROPS}
                  labelFormatter={(label) => `${label}% through`}
                  formatter={(value) => [`${value}% retained`, "Listeners"]}
                />
                <Area
                  type="monotone"
                  dataKey="retention"
                  stroke="#22d3ee"
                  strokeWidth={1.5}
                  fill="url(#grad-ep-retention)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}
    </div>
  );
}

EpisodeDetailContent.propTypes = {
  data: PropTypes.object.isRequired,
  rangeLabel: PropTypes.string,
};

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
  // Auto-scroll the active tab into view on phones — without this,
  // tapping a tab off-screen would change the view but the tap
  // target itself would stay clipped, which feels like nothing
  // happened. Behaviour is a no-op on desktop because the strip
  // fits inside its container.
  const scrollerRef = useRef(null);
  const activeRef = useRef(null);
  useEffect(() => {
    const el = activeRef.current;
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [active]);

  return (
    <div
      ref={scrollerRef}
      className="-mx-4 lg:-mx-10 px-4 lg:px-10 overflow-x-auto scrollbar-none"
    >
      <div className="inline-flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              ref={isActive ? activeRef : null}
              type="button"
              onClick={() => onChange(t.id)}
              aria-pressed={isActive}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all ${
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
// detail view for the selected show. The detail view fetches its own
// per-episode stats from /analytics/episodes/?show_id=… so every
// episode of the selected show shows real plays / listen time /
// completion numbers (range-aware), not just the ones that placed in
// the platform-wide top-10. The summary payload is still used for the
// hero card's headline metrics.

function PerShowView({
  podcasts,
  breakdowns,
  queryArgs,
  rangeLabel,
  selectedShowId,
  setSelectedShowId,
  onPickEpisode,
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
  // Per-episode stats are now fetched inside PerShowDetail itself
  // via /analytics/episodes/?show_id=…, so we no longer pre-build
  // platform-wide top-10 lookup tables here. The hero card's
  // "showPlays" / "showListen" still come from the summary
  // breakdowns above because they're show-level totals.

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
      queryArgs={queryArgs}
      rangeLabel={rangeLabel}
      onPickEpisode={onPickEpisode}
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
  queryArgs,
  rangeLabel,
  onPickEpisode,
}) {
  // Episodes can live under .episodes (array) or .episodes.results
  // depending on which serializer ran. Normalise once.
  const episodes = useMemo(() => {
    if (Array.isArray(show?.episodes)) return show.episodes;
    if (Array.isArray(show?.episodes?.results)) return show.episodes.results;
    return [];
  }, [show]);

  // Pull per-episode stats for THIS show via the new analytics
  // endpoint. Range-aware via the shared queryArgs prop. We ask
  // for a generous page size (the largest the backend allows) so
  // most shows fit in a single request — episode counts above 200
  // are extremely rare for a single show in this catalogue.
  const episodeStatsArgs = useMemo(
    () => ({ ...queryArgs, show_id: show?.id, page: 1, page_size: 200 }),
    [queryArgs, show?.id]
  );
  const { data: episodeStatsData } = useQuery({
    queryKey: ["analytics", "episodes", "for-show", episodeStatsArgs],
    queryFn: () => Analytics.episodes(episodeStatsArgs),
    enabled: !!show?.id,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Index the fetched stats by episode id for quick lookup. These
  // numbers replace the platform-wide top-10 lookups the previous
  // version of this component used — every episode of every show
  // now gets accurate plays / listen / completions in the active
  // range, not just the lucky ones that hit the global leaderboard.
  const statsById = useMemo(() => {
    const out = {};
    for (const row of episodeStatsData?.episodes || []) {
      out[String(row.id)] = row;
    }
    return out;
  }, [episodeStatsData]);

  // Sort newest first by published_at; fall back to original order so
  // shows that don't ship publish dates still render predictably.
  const episodesSorted = useMemo(() => {
    return [...episodes].sort((a, b) => {
      const ta = Date.parse(a?.published_at || a?.publishedAt || "") || 0;
      const tb = Date.parse(b?.published_at || b?.publishedAt || "") || 0;
      return tb - ta;
    });
  }, [episodes]);

  // "This show's episodes ranked by plays" / "by listen time".
  // Now driven by real per-episode stats for every episode of
  // this show, not just the platform-wide top 10.
  const topEpisodesForShowByPlays = useMemo(() => {
    return episodesSorted
      .map((e) => {
        const stats = statsById[String(e.id)];
        return stats
          ? { id: e.id, title: e.title, plays: stats.plays || 0 }
          : null;
      })
      .filter((r) => r && r.plays > 0)
      .sort((a, b) => (b.plays || 0) - (a.plays || 0))
      .slice(0, 10);
  }, [episodesSorted, statsById]);

  const topEpisodesForShowByListen = useMemo(() => {
    return episodesSorted
      .map((e) => {
        const stats = statsById[String(e.id)];
        return stats
          ? { id: e.id, title: e.title, minutes: stats.listen_minutes || 0 }
          : null;
      })
      .filter((r) => r && r.minutes > 0)
      .sort((a, b) => (b.minutes || 0) - (a.minutes || 0))
      .slice(0, 10);
  }, [episodesSorted, statsById]);

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
              />
              <MiniStat
                label="Followers"
                value={
                  followerCount != null
                    ? formatNumber(followerCount)
                    : "—"
                }
              />
              <MiniStat
                label="Plays"
                value={showPlays != null ? formatNumber(showPlays) : "—"}
                tone="accent"
              />
              <MiniStat
                label="Listen time"
                value={
                  showListen != null ? formatMinutes(showListen) : "—"
                }
                tone="good"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Per-show top episodes — ranked across every episode of
          this show (no longer filtered to the platform top-10). */}
      <DashboardSection title="This show's top episodes">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="By plays">
            <LeaderboardList
              rows={topEpisodesForShowByPlays}
              empty="No plays recorded for this show in this range."
              valueKey="plays"
              valueLabel="plays"
              onPick={onPickEpisode}
            />
          </ChartCard>
          <ChartCard title="By listen time">
            <LeaderboardList
              rows={topEpisodesForShowByListen}
              empty="No listen time recorded for this show in this range."
              valueKey="minutes"
              valueFormatter={formatMinutes}
              onPick={onPickEpisode}
            />
          </ChartCard>
        </div>
      </DashboardSection>

      {/* Full episode catalogue */}
      <DashboardSection title="Episode catalogue">
        {episodesSorted.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-10 text-center text-sm text-zinc-500">
            No episodes available for this show.
          </div>
        ) : (
          <EpisodeCatalogueTable
            episodes={episodesSorted}
            statsById={statsById}
            onPickEpisode={onPickEpisode}
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

function EpisodeCatalogueTable({ episodes, statsById, onPickEpisode }) {
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
      <div className="hidden md:grid grid-cols-[minmax(0,1fr)_110px_90px_110px_110px] gap-4 px-4 py-2.5 text-[10px] uppercase tracking-wide text-zinc-500 border-b border-white/[0.05] bg-white/[0.01]">
        <span>Episode</span>
        <span className="text-right">Published</span>
        <span className="text-right">Plays</span>
        <span className="text-right">Listen time</span>
        <span className="text-right">Completions</span>
      </div>
      <ul className="divide-y divide-white/[0.04]">
        {episodes.map((e) => {
          const stats = statsById?.[String(e.id)];
          const plays = stats?.plays ?? 0;
          const minutes = stats?.listen_minutes ?? 0;
          const completions = stats?.completions ?? 0;
          const cover = e.cover_image_url || e.cover_url || e.image_url;
          return (
            <li
              key={e.id}
              onClick={() => onPickEpisode?.(e.id)}
              className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_110px_90px_110px_110px] gap-2 md:gap-4 px-4 py-3 hover:bg-white/[0.04] transition-colors cursor-pointer"
              title="View episode detail"
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
                  plays > 0 ? "text-amber-200" : "text-zinc-600"
                }`}
              >
                {plays > 0 ? formatNumber(plays) : "—"}
              </span>
              <span
                className={`text-right text-sm tabular-nums self-center ${
                  minutes > 0 ? "text-emerald-200" : "text-zinc-600"
                }`}
              >
                {minutes > 0 ? formatMinutes(minutes) : "—"}
              </span>
              <span
                className={`text-right text-sm tabular-nums self-center ${
                  completions > 0 ? "text-zinc-300" : "text-zinc-600"
                }`}
              >
                {completions > 0 ? formatNumber(completions) : "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
