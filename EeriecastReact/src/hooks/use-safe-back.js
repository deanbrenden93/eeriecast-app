// useSafeBack — a back/X handler that never kicks the user off the site.
//
// Why this exists:
//   `navigate(-1)` blindly walks the *browser* history stack. When a
//   visitor lands on one of our pages via a shared link, deep link,
//   email, or organic search result, the entry above ours in their
//   history is whatever site they came from (Google, Twitter, Gmail,
//   etc.). Hitting our in-app "X" or "Back" affordance in that case
//   yanks them right back off Eeriecast — terrible UX, especially on
//   pages like Premium where the X is the only obvious dismissal.
//
// What it does:
//   React Router seeds `window.history.state.idx` whenever it pushes /
//   replaces an entry. The first router entry has `idx === 0`. Any
//   value greater than zero means we have at least one prior in-app
//   page to fall back to, so `navigate(-1)` is safe. Otherwise we
//   redirect (with `replace: true`) to a sensible in-app fallback —
//   the Podcasts home by default — so users always stay on the site.
//
// Usage:
//   const safeGoBack = useSafeBack();
//   <button onClick={safeGoBack}>Back</button>
//
//   // Or with a custom fallback:
//   const close = useSafeBack(createPageUrl('Profile'));

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export function useSafeBack(fallbackUrl) {
  const navigate = useNavigate();

  return useCallback(() => {
    const idx = typeof window !== 'undefined'
      ? window.history.state?.idx
      : undefined;
    if (typeof idx === 'number' && idx > 0) {
      navigate(-1);
      return;
    }
    navigate(fallbackUrl || createPageUrl('Podcasts'), { replace: true });
  }, [navigate, fallbackUrl]);
}

export default useSafeBack;
