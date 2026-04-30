import { useState, useEffect, useCallback } from 'react';

const SETTINGS_KEY = 'eeriecast_settings';

const DEFAULTS = {
  autoplay: true,
  rememberPosition: true,
  streamingQuality: '320kbps',
  downloadQuality: '320kbps',
  newEpisodeNotifications: true,
  // Seconds to skip forward/backward when the player's skip buttons are used.
  // Defaults to the classic podcast 10s increment.
  skipBackwardSeconds: 10,
  skipForwardSeconds: 10,
  // ─── End-of-queue autoplay fallbacks ──────────────────────────────
  // What to play when the user reaches the end of the current playback
  // queue (e.g. they finished a single-episode launch from history, or
  // they listened through every queued episode of a show). The master
  // `autoplay` toggle above is still respected — flipping it off
  // disables both within-queue advancement AND these fallbacks.
  //
  // Allowed values:
  //   podcastAutoplay / musicAutoplay:
  //     'none'                    — stop, do nothing
  //     'next_newest_same_show'   — play the episode/track just newer
  //                                 than the one that ended
  //     'next_oldest_same_show'   — play the episode/track just older
  //                                 than the one that ended (default
  //                                 for podcasts: continues a typical
  //                                 newest-first browse forward)
  //     'random_same_show'        — pick a random other episode/track
  //                                 from the same show (default for
  //                                 music: shuffle-within-artist)
  //     'random_any'              — pick a random episode/track from
  //                                 any matching show in the catalog
  //   audiobookAutoplay:
  //     'none'                    — stop at the end of a chapter
  //     'next_chapter'            — play the next chapter of the same
  //                                 audiobook (default; never rolls
  //                                 into a different book)
  podcastAutoplay: 'next_oldest_same_show',
  musicAutoplay: 'random_same_show',
  audiobookAutoplay: 'next_chapter',
};

/** Read all settings from localStorage (plain function, no React needed) */
export function getSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Read a single setting (plain function for use outside React components) */
export function getSetting(key) {
  return getSettings()[key] ?? DEFAULTS[key];
}

/** Write a single setting and broadcast a change event */
export function writeSetting(key, value) {
  const current = getSettings();
  current[key] = value;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(current));
  } catch { /* storage full */ }
  window.dispatchEvent(new CustomEvent('eeriecast-settings-change', { detail: { key, value } }));
  return current;
}

/** React hook — returns reactive settings + an update function */
export function useSettings() {
  const [settings, setSettings] = useState(getSettings);

  useEffect(() => {
    const handler = () => setSettings(getSettings());
    window.addEventListener('eeriecast-settings-change', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('eeriecast-settings-change', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const updateSetting = useCallback((key, value) => {
    const next = writeSetting(key, value);
    setSettings({ ...next });
  }, []);

  return { settings, updateSetting };
}
