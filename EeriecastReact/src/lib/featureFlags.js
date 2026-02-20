import { useUser } from '@/context/UserContext.jsx';

/**
 * Feature flag registry.
 *
 * Each key is a flag name, and its value is a config object:
 *   - staffOnly (boolean): if true, only staff/admin users can see this feature.
 *   - authOnly  (boolean): if true, any logged-in user can see this feature.
 *
 * To add a new secret feature:
 *   1. Add an entry here:  'my-feature': { staffOnly: true }
 *   2. Gate the UI with <FeatureGate flag="my-feature"> or useFeatureFlag('my-feature')
 *   3. When ready to ship to everyone, remove the gate and delete the entry.
 */
export const FEATURE_FLAGS = {
  // Test flag — shows a small "Staff Mode" indicator in the side menu.
  // Remove this once you've confirmed the system works end-to-end.
  'staff-indicator': { staffOnly: true },

  // Comic / manga reader — available to all logged-in users for testing.
  'comic-reader': { authOnly: true },
};

/**
 * Hook: returns true if the given flag should be visible to the current user.
 *
 * - If the flag doesn't exist in FEATURE_FLAGS, it's treated as disabled (false).
 * - If staffOnly is true, the user must have is_staff from the backend.
 *
 * @param {string} flagName
 * @returns {boolean}
 */
export function useFeatureFlag(flagName) {
  const { isStaff, isAuthenticated } = useUser();
  const config = FEATURE_FLAGS[flagName];
  if (!config) return false;
  if (config.staffOnly) return !!isStaff;
  if (config.authOnly) return !!isAuthenticated;
  return true;
}

/**
 * Component: conditionally renders children only when the flag is enabled
 * for the current user.
 *
 * Usage:
 *   <FeatureGate flag="my-feature">
 *     <SecretComponent />
 *   </FeatureGate>
 *
 * @param {{ flag: string, children: React.ReactNode }} props
 */
export function FeatureGate({ flag, children }) {
  const enabled = useFeatureFlag(flag);
  if (!enabled) return null;
  return children;
}
