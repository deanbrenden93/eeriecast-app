// filepath: src/components/auth/SubscribeModal.jsx
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';

export default function SubscribeModal({ open, onOpenChange, title = 'Subscribe to listen', message = 'This content is available to members only. Subscribe to unlock all premium shows and episodes.', itemLabel }) {
  const navigate = useNavigate();
  const goPremium = () => {
    onOpenChange?.(false);
    navigate(createPageUrl('Premium'));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111] text-white border-white/10">
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription className="text-gray-300">
            {itemLabel ? (<span className="block mb-2 text-white/80">{itemLabel}</span>) : null}
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" className="text-gray-300 hover:text-white" onClick={() => onOpenChange?.(false)}>
            Not now
          </Button>
          <Button className="bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700" onClick={goPremium}>
            See plans
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

SubscribeModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  title: PropTypes.string,
  message: PropTypes.string,
  itemLabel: PropTypes.string,
};

