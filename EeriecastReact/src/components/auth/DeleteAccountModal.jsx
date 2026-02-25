import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { User as UserAPI } from '@/api/entities';
import { AlertTriangle } from 'lucide-react';

export default function DeleteAccountModal({ isOpen, onClose, onDeleted, userEmail }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSubmitting(false);
      setError(null);
    }
  }, [isOpen]);

  const handleDelete = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await UserAPI.deleteAccount();
      onClose && onClose();
      if (onDeleted) {
        await onDeleted();
      }
    } catch (e) {
      const msg = e?.data?.message || e?.data?.detail || e?.message || 'Failed to delete account.';
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose && onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-[520px] bg-gradient-to-br from-black via-[#121316] to-[#1f2128] text-white border border-red-600/40 shadow-2xl shadow-red-900/40 p-0 overflow-hidden">
        <div className="p-6 sm:p-7">
          <div className="flex flex-col items-center mb-5 text-center">
            <div className="w-12 h-12 rounded-full bg-red-600/10 flex items-center justify-center mb-3 ring-1 ring-red-600/20">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold tracking-wide">Delete Account</h2>
            <p className="text-xs text-gray-400 mt-1">
              This permanently deletes your account and logs you out. A confirmation email will be sent to{' '}
              <span className="text-gray-200 font-medium">{userEmail || 'your email address'}</span>.
            </p>
          </div>

          <div className="text-sm text-gray-300 bg-black/30 border border-white/[0.08] rounded-md px-3 py-2 mb-4">
            This action cannot be undone.
          </div>

          {error && (
            <p className="text-red-400 text-xs sm:text-sm bg-red-950/30 border border-red-800/40 rounded px-3 py-2 mb-3">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 text-sm"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="flex-1 bg-red-600 hover:bg-red-500 text-sm"
            >
              {submitting ? 'Deleting...' : 'Delete Account'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

DeleteAccountModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onDeleted: PropTypes.func,
  userEmail: PropTypes.string,
};
