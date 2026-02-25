import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User as UserAPI } from '@/api/entities';
import { MailCheck } from 'lucide-react';

export default function ChangeEmailModal({ isOpen, onClose, currentEmail }) {
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const resetForm = () => {
    setNewEmail('');
    setConfirmEmail('');
    setCurrentPassword('');
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validate = () => {
    const next = (newEmail || '').trim().toLowerCase();
    const confirm = (confirmEmail || '').trim().toLowerCase();
    const current = (currentEmail || '').trim().toLowerCase();
    if (!next) return 'Please enter your new email.';
    if (!/\S+@\S+\.\S+/.test(next)) return 'Please enter a valid email address.';
    if (next === current) return 'That is already your current email.';
    if (!confirm) return 'Please confirm your new email.';
    if (next !== confirm) return 'Email addresses do not match.';
    if (!currentPassword) return 'Please enter your current password.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await UserAPI.requestEmailChange(newEmail, currentPassword);
      setSuccess(true);
    } catch (err) {
      const data = err?.data || err?.response?.data;
      const msg = data?.email?.[0]
        || data?.current_password?.[0]
        || data?.detail
        || err?.message
        || 'Failed to request email change.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSubmitting(false);
    setSuccess(false);
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-[440px] bg-gradient-to-br from-black via-[#121316] to-[#1f2128] text-white border border-red-600/40 shadow-2xl shadow-red-900/40 p-0 overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col items-center mb-5">
            <div className="w-12 h-12 rounded-full bg-red-600/10 flex items-center justify-center mb-3 ring-1 ring-red-600/20">
              <MailCheck className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold tracking-wide">Change Email</h2>
            <p className="text-xs text-gray-400 mt-1 text-center">
              We will send a confirmation link to your new email.
            </p>
          </div>

          {success ? (
            <div className="text-sm text-gray-200 text-center py-4">
              We sent a confirmation link to your new email. Please check your inbox to complete the change.
              <div className="mt-4">
                <Button type="button" onClick={handleClose} className="bg-red-600 hover:bg-red-500 text-sm">
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider font-medium text-gray-400 mb-1 block">
                  New Email
                </label>
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="bg-[#1b1d23] border-gray-700 focus-visible:ring-red-600 text-sm"
                  placeholder="new@email.com"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider font-medium text-gray-400 mb-1 block">
                  Confirm New Email
                </label>
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  className="bg-[#1b1d23] border-gray-700 focus-visible:ring-red-600 text-sm"
                  placeholder="re-enter new email"
                />
              </div>
              <div className="h-px bg-white/[0.06]" />
              <div>
                <label className="text-xs uppercase tracking-wider font-medium text-gray-400 mb-1 block">
                  Current Password
                </label>
                <Input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="bg-[#1b1d23] border-gray-700 focus-visible:ring-red-600 text-sm"
                  placeholder="Enter your current password"
                />
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
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-sm"
                >
                  {submitting ? 'Sending...' : 'Send Confirmation'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

ChangeEmailModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  currentEmail: PropTypes.string,
};
