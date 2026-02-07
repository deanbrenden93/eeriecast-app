import { useState, useEffect, useCallback } from 'react';

const SETTINGS_KEY = 'eeriecast_settings';

const DEFAULTS = {
  autoplay: true,
  rememberPosition: true,
  streamingQuality: '320kbps',
  downloadQuality: '320kbps',
  newEpisodeNotifications: true,
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
