import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Cake, Lock, CheckCircle, Loader2, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { User as UserAPI } from '@/api/entities';
import { useUser } from '@/context/UserContext';
import { toast } from '@/components/ui/use-toast';
import DateOfBirthPicker from '@/components/common/DateOfBirthPicker';

/*
 * DateOfBirthEditModal
 *
 * Two-step flow for editing a user's date of birth from the profile page.
 *
 * - If the user has no DOB on file yet (e.g. they skipped the field at
 *   signup), we SKIP the password step and let them set their DOB
 *   directly. This unblocks older users who couldn't navigate the
 *   original date input.
 * - If the user already has a DOB on file, we first require them to
 *   re-enter their current password (step-up auth), then reveal the
 *   picker. This prevents a bypass of our 18+ content gate.
 *
 * On successful save, refreshes the user context so the mature-content
 * gates (ExpandedPlayer, MatureContentModal, etc.) re-evaluate with the
 * new age immediately — no reload required.
 */

const STEP = {
  VERIFY: 'verify',
  EDIT: 'edit',
  DONE: 'done',
};

function computeAgeYears(iso) {
  if (!iso) return null;
  const birth = new Date(iso);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export default function DateOfBirthEditModal({ isOpen, onClose }) {
  const { user, refreshUser } = useUser();
  const existingDob = user?.date_of_birth || null;
  const isFirstTime = !existingDob;

  // Start on the EDIT step for first-time users; otherwise make them
  // pass the password step first.
  const [step, setStep] = useState(isFirstTime ? STEP.EDIT : STEP.VERIFY);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [newDob, setNewDob] = useState(existingDob || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Reset whenever the modal opens/closes or the underlying user changes.
  useEffect(() => {
    if (!isOpen) return;
    setStep(isFirstTime ? STEP.EDIT : STEP.VERIFY);
    setPassword('');
    setShowPassword(false);
    setPasswordVerified(false);
    setNewDob(existingDob || '');
    setSubmitting(false);
    setError(null);
  }, [isOpen, existingDob, isFirstTime]);

  const age = useMemo(() => computeAgeYears(newDob), [newDob]);
  const dobChanged = newDob !== (existingDob || '');
  const canSubmit =
    !!newDob &&
    !submitting &&
    dobChanged &&
    (isFirstTime || passwordVerified) &&
    (age === null || age >= 13);

  const handleVerify = async (e) => {
    e?.preventDefault?.();
    if (!password) {
      setError('Please enter your current password.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await UserAPI.verifyPassword(password);
      setPasswordVerified(true);
      setStep(STEP.EDIT);
    } catch (err) {
      // Surface the most specific error we can. The generic fallback used
      // to say "Current password is incorrect." for any failure mode, which
      // masked real problems like a 404 (server not reloaded with the new
      // /auth/verify-password/ route) or a 403 (expired session). Now we
      // distinguish between an actual mismatch and everything else.
      const status = err?.status ?? err?.response?.status;
      const data = err?.data || err?.response?.data || {};
      const serverMsg = Array.isArray(data?.password)
        ? data.password.join(' ')
        : typeof data?.password === 'string'
          ? data.password
          : typeof data?.detail === 'string'
            ? data.detail
            : null;

      if (status === 400 && data?.password) {
        // Real password mismatch from the backend.
        setError(serverMsg || 'Current password is incorrect.');
      } else if (status === 401 || status === 403) {
        setError(
          serverMsg ||
            'Your session has expired. Please sign out and sign back in, then try again.'
        );
      } else if (status === 404) {
        setError(
          'The password-verification endpoint was not found. The API server may need to be restarted to pick up the new routes.'
        );
      } else if (!status) {
        setError(
          'Could not reach the server. Check your connection and try again.'
        );
      } else {
        setError(
          serverMsg || `Couldn't verify password (server error ${status}).`
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await UserAPI.updateDateOfBirth(newDob, { passwordVerified: !isFirstTime });
      await refreshUser();
      setStep(STEP.DONE);
      toast({
        title: isFirstTime ? 'Date of birth saved' : 'Date of birth updated',
        description:
          age !== null && age >= 18
            ? 'Mature content can now be enabled from Settings.'
            : 'Your profile has been updated.',
      });
      setTimeout(() => onClose(), 1400);
    } catch (err) {
      const data = err?.data || err?.response?.data;
      if (data?.date_of_birth) {
        setError(Array.isArray(data.date_of_birth) ? data.date_of_birth.join(' ') : data.date_of_birth);
      } else if (data?.detail) {
        setError(data.detail);
      } else {
        setError('Failed to save your date of birth. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-[440px] bg-gradient-to-br from-black via-[#121316] to-[#1f2128] text-white border border-red-600/40 shadow-2xl shadow-red-900/40 p-0 overflow-hidden">
        <div className="p-5 sm:p-6">
          {/* Header */}
          <div className="flex flex-col items-center mb-5">
            <div className="w-12 h-12 rounded-full bg-red-600/10 flex items-center justify-center mb-3 ring-1 ring-red-600/20">
              {step === STEP.VERIFY ? (
                <Lock className="w-6 h-6 text-red-500" />
              ) : step === STEP.DONE ? (
                <CheckCircle className="w-6 h-6 text-green-500" />
              ) : (
                <Cake className="w-6 h-6 text-red-500" />
              )}
            </div>
            <h2 className="text-lg font-semibold tracking-wide">
              {step === STEP.VERIFY && 'Confirm your password'}
              {step === STEP.EDIT && (isFirstTime ? 'Add your date of birth' : 'Update date of birth')}
              {step === STEP.DONE && 'Date of birth saved'}
            </h2>
            <p className="text-xs text-gray-400 mt-1 text-center max-w-[320px]">
              {step === STEP.VERIFY &&
                'For your security, please re-enter your current password before changing your date of birth.'}
              {step === STEP.EDIT && isFirstTime &&
                'You can provide this once without a password. Any future changes will require your password.'}
              {step === STEP.EDIT && !isFirstTime &&
                'Choose the correct month, day, and year below.'}
              {step === STEP.DONE &&
                'Your profile has been updated.'}
            </p>
          </div>

          {step === STEP.VERIFY && (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider font-medium text-gray-400 mb-1 block">
                  Current Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-[#1b1d23] border-gray-700 focus-visible:ring-red-600 text-sm pr-10"
                    placeholder="Enter your current password"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-500 hover:text-gray-200 hover:bg-white/[0.04] transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-xs sm:text-sm bg-red-950/30 border border-red-800/40 rounded px-3 py-2 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 text-sm"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-sm"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Checking...
                    </span>
                  ) : 'Continue'}
                </Button>
              </div>
            </form>
          )}

          {step === STEP.EDIT && (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider font-medium text-gray-400 mb-1.5 block">
                  Date of birth
                </label>
                <DateOfBirthPicker
                  value={newDob}
                  onChange={(iso) => setNewDob(iso || '')}
                  required
                />
                {age !== null && age < 13 && (
                  <p className="text-amber-400 text-xs mt-2">
                    You must be at least 13 to use Eeriecast.
                  </p>
                )}
                {age !== null && age >= 13 && age < 18 && (
                  <p className="text-amber-400/80 text-xs mt-2">
                    Users under 18 can&apos;t enable mature-content shows.
                  </p>
                )}
              </div>

              {error && (
                <p className="text-red-400 text-xs sm:text-sm bg-red-950/30 border border-red-800/40 rounded px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 text-sm"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </span>
                  ) : isFirstTime ? 'Save date of birth' : 'Update date of birth'}
                </Button>
              </div>
            </form>
          )}

          {step === STEP.DONE && (
            <div className="flex flex-col items-center py-4">
              <p className="text-sm text-gray-200 font-medium">
                {isFirstTime ? 'Your date of birth has been saved.' : 'Your date of birth has been updated.'}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

DateOfBirthEditModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
