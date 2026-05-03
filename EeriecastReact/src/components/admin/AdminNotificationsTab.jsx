// ── AdminNotificationsTab ─────────────────────────────────────────
//
// Composes a one-shot in-app notification (title, body, optional URL)
// and broadcasts it to every active user. The fan-out happens in a
// Celery task on the backend so this request returns within the same
// HTTP cycle even for a six-figure user count — the task creates one
// `Notification` row per recipient via `bulk_create()`.
//
// Three things make this a bit more careful than a typical form:
//
//   1. It's irreversible at the user-facing level. Once a notification
//      is in someone's popover, you can't pull it back. So we surface
//      a confirm dialog with the literal recipient count and a live
//      preview before the request fires.
//   2. The "URL" field intentionally accepts both internal paths
//      (e.g. `/Episodes?id=42&ep=99`) and external links
//      (`https://eeriecast.com/lore`). The popover's link resolver
//      passes them straight to react-router's navigate, which handles
//      both — so admins don't have to think about which kind they're
//      typing.
//   3. We disable the form completely while the request is in flight
//      to avoid a double-tap creating two broadcasts.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell, Send, Loader2, AlertCircle, Users, Link2, Type,
  AlignLeft, ExternalLink,
} from "lucide-react";
import { AdminNotifications } from "@/api/entities";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TITLE_MAX = 80;
const BODY_MAX = 280;

function formatNumber(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat().format(v);
}

// Mirror of the backend's URL validator (apps/admin_tools/serializers.py).
// Accepts:
//   • absolute http(s) URLs
//   • internal paths starting with `/`
// Anything else is rejected client-side so admins get instant feedback.
function isValidNotificationUrl(raw) {
  const v = (raw || "").trim();
  if (!v) return true; // optional
  if (v.startsWith("/")) return true;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function AdminNotificationsTab() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const { data: audience, isLoading: audienceLoading } = useQuery({
    queryKey: ["admin", "notifications", "audience"],
    queryFn: () => AdminNotifications.audience(),
    staleTime: 60_000,
  });
  const recipientCount = audience?.count;

  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  const trimmedUrl = url.trim();
  const urlValid = isValidNotificationUrl(trimmedUrl);

  const canSend = useMemo(() => {
    if (submitting) return false;
    if (!trimmedTitle && !trimmedBody) return false;
    if (trimmedTitle.length > TITLE_MAX) return false;
    if (trimmedBody.length > BODY_MAX) return false;
    if (!urlValid) return false;
    return true;
  }, [submitting, trimmedTitle, trimmedBody, urlValid]);

  const reset = () => {
    setTitle("");
    setBody("");
    setUrl("");
    setError(null);
  };

  const handleSend = async () => {
    if (!canSend) return;
    setError(null);
    try {
      setSubmitting(true);
      const res = await AdminNotifications.broadcast({
        title: trimmedTitle,
        body: trimmedBody,
        url: trimmedUrl || undefined,
      });
      const queued = res?.queued_recipients ?? recipientCount ?? 0;
      toast({
        title: "Broadcast queued",
        description: `Sending to ${formatNumber(queued)} ${queued === 1 ? "user" : "users"}.`,
      });
      reset();
      setConfirmOpen(false);
    } catch (e) {
      const msg = e?.message || "Could not send broadcast.";
      setError(msg);
      toast({ title: "Broadcast failed", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Hero / form ──────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-violet-500/[0.06] via-white/[0.02] to-transparent p-5 lg:p-7">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-full bg-violet-500/15 ring-1 ring-violet-400/30 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-violet-300" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold tracking-tight">Send notification</h2>
            <p className="mt-1 text-sm text-zinc-400 max-w-2xl">
              Broadcast a short in-app notification to every active user.
              Recipients see it in their bell-icon popover; tapping it
              opens the URL you set below, if any.
            </p>
          </div>
          <div className="hidden md:flex flex-col items-end flex-shrink-0">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
              <Users className="w-3 h-3" />
              Recipients
            </div>
            <div className="mt-0.5 text-2xl font-bold text-white tabular-nums">
              {audienceLoading ? <Loader2 className="w-5 h-5 animate-spin text-zinc-500" /> : formatNumber(recipientCount)}
            </div>
          </div>
        </div>

        {/* Form grid */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          <div className="space-y-4">
            <Field
              icon={Type}
              label="Title"
              hint="Optional but recommended. Shown bold above the message."
              counter={`${trimmedTitle.length}/${TITLE_MAX}`}
              counterTone={trimmedTitle.length > TITLE_MAX ? "error" : "muted"}
            >
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. New episode live: The Old Water Station"
                maxLength={TITLE_MAX + 20 /* allow soft over so the counter goes red */}
                disabled={submitting}
                className="bg-black/30 border-white/[0.08] focus-visible:ring-violet-500"
              />
            </Field>

            <Field
              icon={AlignLeft}
              label="Message"
              hint="The body of the notification."
              counter={`${trimmedBody.length}/${BODY_MAX}`}
              counterTone={trimmedBody.length > BODY_MAX ? "error" : "muted"}
            >
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Tell listeners what's new, what to do next, or what to expect."
                rows={4}
                maxLength={BODY_MAX + 40}
                disabled={submitting}
                className="bg-black/30 border-white/[0.08] focus-visible:ring-violet-500 resize-none"
              />
            </Field>

            <Field
              icon={Link2}
              label="Link"
              hint="Optional. Tapping the notification opens this URL. Use a path like /Library or a full https:// URL."
            >
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="/Library  or  https://eeriecast.com/lore"
                disabled={submitting}
                className="bg-black/30 border-white/[0.08] focus-visible:ring-violet-500"
              />
              {!urlValid && (
                <p className="mt-1 text-xs text-rose-300 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Must be an internal path (starts with /) or an https:// URL.
                </p>
              )}
            </Field>

            {error && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.05] px-3 py-2 text-sm text-rose-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={!canSend || audienceLoading || !recipientCount}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg text-sm font-semibold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60"
              >
                <Send className="w-4 h-4" />
                Send to {audienceLoading ? "…" : formatNumber(recipientCount)} {recipientCount === 1 ? "user" : "users"}
              </button>
              <button
                type="button"
                onClick={reset}
                disabled={submitting || (!title && !body && !url)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-30"
              >
                Clear
              </button>
            </div>
          </div>

          {/* ── Live preview ──────────────────────────────────── */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-2 flex items-center gap-1.5">
              <Bell className="w-3 h-3" />
              Preview
            </div>
            <NotificationPreview
              title={trimmedTitle}
              body={trimmedBody}
              url={trimmedUrl}
            />
          </div>
        </div>
      </div>

      {/* ── Audience explainer ───────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 lg:p-7">
        <h3 className="text-sm font-semibold text-white">Who receives this</h3>
        <p className="mt-2 text-sm text-zinc-400">
          Every user with an active, non-deleted account gets a row in
          their notifications popover. Email verification is{" "}
          <span className="text-zinc-200">not</span> required — notifications
          are an in-app channel, separate from marketing email. Users
          can mark notifications as read or dismiss them, but they can't
          unsubscribe from the channel itself.
        </p>
      </div>

      {/* ── Confirmation dialog ──────────────────────────────── */}
      <AlertDialog open={confirmOpen} onOpenChange={(o) => !submitting && setConfirmOpen(o)}>
        <AlertDialogContent className="bg-[#11121a] border-violet-500/30 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Send to {formatNumber(recipientCount)} users?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This delivers the notification to every active user
              immediately. There's no way to recall a notification once
              it's been sent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3">
            <NotificationPreview
              title={trimmedTitle}
              body={trimmedBody}
              url={trimmedUrl}
              compact
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleSend(); }}
              disabled={submitting}
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  Send now
                </span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ icon: Icon, label, hint, counter, counterTone, children }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <label className="text-[11px] uppercase tracking-widest font-semibold text-zinc-300 flex items-center gap-1.5">
          {Icon && <Icon className="w-3 h-3 text-violet-300" />}
          {label}
        </label>
        {counter != null && (
          <span className={`text-[10px] tabular-nums ${counterTone === "error" ? "text-rose-300" : "text-zinc-600"}`}>
            {counter}
          </span>
        )}
      </div>
      {children}
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

// Mirrors the visual shape of a row in `NotificationsPopover` so
// admins see exactly what their broadcast will look like before it
// fires. Compact mode is for the confirm dialog where space is tight.
function NotificationPreview({ title, body, url, compact = false }) {
  const hasContent = !!(title || body);
  return (
    <div className={`rounded-xl bg-[#12121a] ring-1 ring-white/[0.06] ${compact ? "" : "p-1"}`}>
      <div className={`px-4 ${compact ? "py-2" : "py-3"}`}>
        <div className="flex items-start gap-3">
          <span className="mt-1.5 inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 bg-red-500" />
          <div className="flex-1 min-w-0">
            {!hasContent ? (
              <p className="text-sm text-zinc-600 italic">Your notification preview will appear here.</p>
            ) : (
              <>
                {title && (
                  <p className="text-sm font-semibold text-white leading-snug break-words">
                    {title}
                  </p>
                )}
                {body && (
                  <p className={`text-sm leading-snug break-words text-zinc-300 ${title ? "mt-0.5" : ""}`}>
                    {body}
                  </p>
                )}
                {url && (
                  <p className="text-[11px] text-violet-300 mt-1 inline-flex items-center gap-1 truncate max-w-full">
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{url}</span>
                  </p>
                )}
                <p className="text-[11px] text-zinc-600 mt-1">just now</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
