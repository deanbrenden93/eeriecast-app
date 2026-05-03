// ── AdminEmailsTab ────────────────────────────────────────────────
//
// Exports verified user emails as a CSV that the admin can upload to
// Mailchimp (or any other marketing tool) to send broadcast emails.
//
// We deliberately do NOT send marketing email from Django itself:
//
//   1. Deliverability — Gmail SMTP (the project's transactional setup)
//      is not the right pipe for hundreds-of-recipients blasts. One
//      bad send can poison the domain's reputation and hurt password-
//      reset / receipt deliverability for weeks.
//   2. Compliance — Mailchimp handles unsubscribe headers, audience
//      hygiene, GDPR/CAN-SPAM consent records. Re-implementing that
//      correctly is a project, not a feature.
//   3. Analytics — open rates, click tracking, A/B tests are free in
//      Mailchimp and weeks of work to reproduce.
//
// So the professional split is: transactional email (welcomes, resets,
// receipts) stays in Django via `apps/emails/`. Marketing email lives
// in Mailchimp, fed by this CSV export.
//
// The recipient count is fetched separately and lazily — it's a cheap
// COUNT(*) on the server side and lets admins see "X recipients" before
// committing to a download. The verified-only toggle defaults on
// because sending marketing email to unverified addresses is the single
// fastest way to wreck a sender domain (bounces + spam-traps).
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Mail, Users, ShieldCheck, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { AdminEmails } from "@/api/entities";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";

function formatNumber(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat().format(v);
}

export default function AdminEmailsTab() {
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  // Recipient count — refetched whenever the verified-only toggle
  // flips so the chip never shows a stale number.
  const {
    data: audience,
    isLoading: audienceLoading,
    refetch: refetchAudience,
  } = useQuery({
    queryKey: ["admin", "emails", "audience", verifiedOnly],
    queryFn: () => AdminEmails.audience({ verifiedOnly }),
    staleTime: 30_000,
  });

  useEffect(() => { setError(null); }, [verifiedOnly]);

  const handleDownload = async () => {
    if (downloading) return;
    setError(null);
    try {
      setDownloading(true);
      const { blob, filename } = await AdminEmails.exportCsv({ verifiedOnly });
      // Browser-side file save: build an object URL, click a temporary
      // <a download>, then revoke. Works in every modern browser
      // including iOS/Android Capacitor webviews because the response
      // is a real Blob (not a same-origin redirect).
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `eeriecast-emails-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Defer revoke so Safari/iOS has time to start the download.
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast({
        title: "Export ready",
        description: `Downloaded ${a.download}.`,
      });
    } catch (e) {
      const msg = e?.message || "Could not export emails.";
      setError(msg);
      toast({ title: "Export failed", description: msg, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const count = audience?.count;

  return (
    <div className="space-y-6">
      {/* ── Hero card ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-violet-500/[0.06] via-white/[0.02] to-transparent p-5 lg:p-7">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-full bg-violet-500/15 ring-1 ring-violet-400/30 flex items-center justify-center flex-shrink-0">
            <Mail className="w-5 h-5 text-violet-300" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold tracking-tight">Email export</h2>
            <p className="mt-1 text-sm text-zinc-400 max-w-2xl">
              Download a CSV of your users' email addresses to import
              into Mailchimp (or any other marketing tool). Eeriecast
              never sends marketing email itself — keeping that traffic
              on a dedicated provider is what protects deliverability
              for password resets and receipts.
            </p>
          </div>
        </div>

        {/* Audience controls + count */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-stretch">
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4 flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <label htmlFor="verified-only" className="block text-sm font-medium text-white">
                Verified users only
              </label>
              <p className="text-xs text-zinc-500 mt-0.5">
                Strongly recommended. Unverified emails bounce, and bounces
                hurt your domain's sender reputation.
              </p>
            </div>
            <Switch
              id="verified-only"
              checked={verifiedOnly}
              onCheckedChange={setVerifiedOnly}
            />
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4 flex flex-col items-center justify-center min-w-[140px]">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
              <Users className="w-3 h-3" />
              Recipients
            </div>
            <div className="mt-1 text-2xl font-bold text-white tabular-nums">
              {audienceLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
              ) : (
                formatNumber(count)
              )}
            </div>
          </div>
        </div>

        {/* Action row */}
        <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading || audienceLoading || !count}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg text-sm font-semibold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60"
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Preparing CSV…
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download CSV
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => refetchAudience()}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Refresh count
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/[0.05] px-3 py-2 text-sm text-rose-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* ── How-to card ──────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 lg:p-7">
        <h3 className="text-sm font-semibold text-white">Importing into Mailchimp</h3>
        <ol className="mt-3 space-y-2 text-sm text-zinc-400 list-decimal pl-5 marker:text-zinc-600">
          <li>In Mailchimp, open <span className="text-zinc-200">Audience → All contacts → Add contacts → Import contacts</span>.</li>
          <li>Choose <span className="text-zinc-200">Upload a file</span> and pick the CSV you just downloaded.</li>
          <li>Map columns: <span className="text-zinc-200">email</span>, <span className="text-zinc-200">first_name</span>, <span className="text-zinc-200">last_name</span>. The other columns (signup date, plan) can be skipped or stored as Mailchimp tags.</li>
          <li>Set <span className="text-zinc-200">Marketing status: Subscribed</span> only for verified users — the export already filters them when the toggle is on.</li>
        </ol>
        <a
          href="https://mailchimp.com/help/import-contacts-mailchimp/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200"
        >
          Mailchimp's official import guide
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* ── CSV columns reference ────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 lg:p-7">
        <h3 className="text-sm font-semibold text-white">What's in the CSV</h3>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
          {[
            ["email", "Primary email address."],
            ["first_name", "Given name (may be blank)."],
            ["last_name", "Family name (may be blank)."],
            ["email_verified", "true / false — whether the user confirmed their email."],
            ["is_premium", "true / false — currently active subscription."],
            ["date_joined", "ISO-8601 signup date."],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-3">
              <code className="text-violet-300 font-mono text-[11px]">{k}</code>
              <span className="text-zinc-500">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
