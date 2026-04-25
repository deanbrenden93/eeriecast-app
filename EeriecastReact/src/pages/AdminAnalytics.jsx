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
} from "lucide-react";

import { useUser } from "@/context/UserContext";
import { Analytics } from "@/api/entities";
import { createPageUrl } from "@/utils";

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
        ) : (
          <div className="space-y-6">
            {/* Featured KPI row — the four numbers you glance at first */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <KpiCard
                icon={Activity}
                label="Churn (in range)"
                value={formatPercent((kpis.churn_rate || 0) * 100, { digits: 2 })}
                sub={`${formatNumber(kpis.canceled_in_range)} canceled`}
                tone={kpis.churn_rate && kpis.churn_rate > 0.05 ? "bad" : "default"}
              />
            </div>

            {/* Secondary KPI row — range-scoped growth indicators */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
                icon={DollarSign}
                label="ARPU"
                value={formatCurrency(kpis.arpu_cents, currency)}
                sub="per paying user / mo"
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

            {/* Row — plan mix + age distribution */}
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

            {/* Row — content totals + top followed shows */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <ChartCard title="Content totals" className="lg:col-span-1">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <StatRow label="Total shows" value={formatNumber(kpis.total_shows)} />
                  <StatRow label="Total follows" value={formatNumber(kpis.total_follows)} />
                  <StatRow
                    label="New follows"
                    value={formatNumber(kpis.new_follows_in_range)}
                    sub="in range"
                  />
                  <StatRow
                    label="Listened"
                    value={formatMinutes(kpis.total_minutes_listened)}
                    sub="all time"
                  />
                </dl>
              </ChartCard>

              <ChartCard
                title="Top followed shows"
                className="lg:col-span-2"
                subtitle="Global, all-time"
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
                        <span className="flex-1 min-w-0 truncate text-sm text-zinc-200">
                          {s.title}
                        </span>
                        <span className="text-xs tabular-nums text-zinc-400">
                          {formatNumber(s.follower_count)} followers
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </ChartCard>
            </div>

            {/* ── ENGAGEMENT SECTION ─────────────────────────────────
                The most valuable metric for a streaming product —
                listens and listen time on episodes and shows — used to
                be completely absent from this dashboard. We now build
                it out with:
                  • 4 range-scoped KPIs (plays / listen time /
                    completions / new follows)
                  • 2 daily time-series charts (plays+completions,
                    listen minutes)
                  • 4 top-N leaderboards (episodes by plays, episodes
                    by listen time, shows by plays, shows by listen
                    time)
                All numbers respect the range picker at the top. */}
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-5 rounded-full bg-gradient-to-b from-red-500 to-amber-500" />
                <h2 className="text-base font-semibold text-white">Listening engagement</h2>
              </div>
              <p className="text-xs text-zinc-500 -mt-1 mb-4">
                Plays, completions and listen time across the catalogue — range-scoped.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
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
                  sub={`${formatNumber(kpis.total_follows)} total`}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
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

              {followsSeriesData.some((d) => d.Follows > 0) && (
                <ChartCard
                  title="New follows"
                  subtitle="Daily follow activity"
                  className="mt-4"
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
            </div>

            {isFetching && (
              <p className="text-[11px] text-zinc-600 text-right">Updating…</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatRow({ label, value, sub }) {
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">{value}</p>
      {sub && <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>}
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
