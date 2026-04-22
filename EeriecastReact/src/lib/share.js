/**
 * Share utilities — Web Share API with clipboard fallback.
 *
 * Exposed helpers build a nice URL + title/text payload for a show,
 * an episode, or an in-progress episode (with a timestamp) and try to
 * invoke the native share sheet. If navigator.share is unavailable or
 * the user dismisses the sheet, the link is copied to the clipboard.
 */
import { toast } from '@/components/ui/use-toast';

// Base URL used in copied share links. In the browser we derive this
// from window.location so links work in local dev, staging, and prod.
// On native (Capacitor), window.location points at capacitor://, so we
// fall back to the canonical marketing domain.
function getShareBase() {
  if (typeof window !== 'undefined' && window.location) {
    const { origin, protocol } = window.location;
    if (origin && protocol && /^https?:$/.test(protocol)) return origin;
  }
  return 'https://eeriecast.com';
}

function buildPodcastUrl(podcast) {
  if (!podcast) return getShareBase();
  const id = podcast.id ?? podcast.slug ?? '';
  return `${getShareBase()}/Episodes?id=${encodeURIComponent(id)}`;
}

function buildEpisodeUrl(podcast, episode, timestampSeconds) {
  const base = buildPodcastUrl(podcast);
  const params = [];
  if (episode?.id) params.push(`ep=${encodeURIComponent(episode.id)}`);
  if (Number.isFinite(timestampSeconds) && timestampSeconds > 0) {
    params.push(`t=${Math.floor(timestampSeconds)}`);
  }
  return params.length ? `${base}&${params.join('&')}` : base;
}

function formatTimestamp(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

async function copyToClipboard(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to textarea fallback */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return !!ok;
  } catch {
    return false;
  }
}

/**
 * Core share primitive. Attempts navigator.share first, then copies to clipboard.
 *
 * @param {{ title?: string, text?: string, url: string }} payload
 * @param {{ successMessage?: string }} [opts]
 */
export async function shareOrCopy(payload, opts = {}) {
  const { title, text, url } = payload;
  const successMessage = opts.successMessage || 'Link copied to clipboard';

  // Prefer native share sheet when available. Some browsers expose
  // navigator.share but reject the payload; we fall back in that case.
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return { method: 'share' };
    } catch (err) {
      // User dismissed – no-op. Any other error → fall through to copy.
      if (err && err.name === 'AbortError') return { method: 'cancelled' };
    }
  }

  const copied = await copyToClipboard(url);
  if (copied) {
    toast({ title: successMessage, description: url, duration: 2500 });
    return { method: 'copy' };
  }

  toast({
    title: 'Unable to share',
    description: 'Copy the link from your browser address bar.',
    variant: 'destructive',
    duration: 3000,
  });
  return { method: 'failed' };
}

export async function sharePodcast(podcast) {
  if (!podcast) return;
  const url = buildPodcastUrl(podcast);
  const title = podcast.title || 'Eeriecast';
  const text = `Check out ${podcast.title || 'this show'} on Eeriecast`;
  return shareOrCopy({ title, text, url });
}

export async function shareEpisode(podcast, episode) {
  if (!episode) return;
  const url = buildEpisodeUrl(podcast, episode);
  const title = episode.title || 'Eeriecast Episode';
  const showName = podcast?.title ? ` · ${podcast.title}` : '';
  const text = `Listen to "${episode.title || 'this episode'}"${showName} on Eeriecast`;
  return shareOrCopy({ title, text, url });
}

/**
 * Share an episode with a deep-link timestamp (share-at-current-time).
 * Pass the current playback position in seconds.
 */
export async function shareEpisodeAtTimestamp(podcast, episode, timestampSeconds) {
  if (!episode) return;
  const url = buildEpisodeUrl(podcast, episode, timestampSeconds);
  const title = episode.title || 'Eeriecast Episode';
  const showName = podcast?.title ? ` · ${podcast.title}` : '';
  const ts = formatTimestamp(timestampSeconds);
  const text = `Listen to "${episode.title || 'this episode'}"${showName} on Eeriecast — starts at ${ts}`;
  return shareOrCopy({ title, text, url });
}
