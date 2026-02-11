import { useState } from 'react';
import PropTypes from 'prop-types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User as UserAPI } from '@/api/entities';
import { Lock, CheckCircle } from 'lucide-react';

export default function ChangePasswordModal({ isOpen, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await UserAPI.changePassword(newPassword);
      setSuccess(true);
      // Auto-close after a moment
      setTimeout(() => handleClose(), 1800);
    } catch (err) {
      // Try to extract a useful message from the error
      const data = err?.data || err?.response?.data;
      if (data) {
        if (typeof data === 'string') {
          setError(data);
        } else if (data.password) {
          setError(Array.isArray(data.password) ? data.password.join(' ') : data.password);
        } else if (data.detail) {
          setError(data.detail);
        } else {
          setError('Failed to change password. Please try again.');
        }
      } else {
        setError('Failed to change password. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-[420px] bg-gradient-to-br from-black via-[#121316] to-[#1f2128] text-white border border-red-600/40 shadow-2xl shadow-red-900/40 p-0 overflow-hidden">
        <div className="p-5 sm:p-6">
          {/* Header */}
          <div className="flex flex-col items-center mb-5">
            <div className="w-12 h-12 rounded-full bg-red-600/10 flex items-center justify-center mb-3 ring-1 ring-red-600/20">
              <Lock className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold tracking-wide">Change Password</h2>
            <p className="text-xs text-gray-400 mt-1 text-center">
              Enter a new password for your account.
            </p>
          </div>

          {success ? (
            <div className="flex flex-col items-center py-6">
              <CheckCircle className="w-10 h-10 text-green-500 mb-3" />
              <p className="text-sm text-gray-200 font-medium">Password changed successfully!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider font-medium text-gray-400 mb-1 block">
                  New Password
                </label>
                <Input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-[#1b1d23] border-gray-700 focus-visible:ring-red-600 text-sm"
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider font-medium text-gray-400 mb-1 block">
                  Confirm New Password
                </label>
                <Input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-[#1b1d23] border-gray-700 focus-visible:ring-red-600 text-sm"
                  placeholder="Re-enter new password"
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
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-sm"
                >
                  {submitting ? 'Saving...' : 'Change Password'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

ChangePasswordModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
