import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useUser } from '@/context/UserContext.jsx';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';

export default function UserMenu({ isOpen, onClose }) {
  const { user, logout } = useUser();

  if (!isOpen) return null;

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  const displayName = user?.full_name || user?.name || user?.username || 'Guest User';
  const email = user?.email || '';
  const isPremium = !!user?.is_premium;
  const accountType = isPremium ? 'Premium Member' : 'Free Account';

  return (
    <motion.div
      className="absolute top-full right-0 mt-2 w-56 rounded-md bg-[#181d24] text-white shadow-xl shadow-black/40 ring-1 ring-black/60 overflow-hidden z-50"
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div className="px-4 pt-3 pb-2">
        <h3 className="font-semibold text-[13px] leading-tight truncate">{displayName}</h3>
        {email && <p className="text-[11px] text-gray-400 truncate">{email}</p>}
        <p className="text-[11px] text-gray-500 mt-1">{accountType}</p>
      </div>
      <div className="h-px bg-white/5" />
      <nav className="py-1 text-[13px]">
        <Link
          to={createPageUrl('Profile')}
          onClick={onClose}
          className="block px-4 py-2 hover:bg-white/5 transition-colors"
        >
          Profile
        </Link>
        <Link
          to={createPageUrl('Settings')}
          onClick={onClose}
          className="block px-4 py-2 hover:bg-white/5 transition-colors"
        >
          Settings
        </Link>
        {!isPremium && (
          <Link
            to={createPageUrl('Premium')}
            onClick={onClose}
            className="block px-4 py-2 font-semibold text-yellow-400 hover:bg-white/5 transition-colors"
          >
            Go Premium
          </Link>
        )}
      </nav>
      <div className="h-px bg-white/5" />
      <button
        onClick={handleLogout}
        className="w-full text-left px-4 py-2 text-[13px] hover:bg-white/5 transition-colors"
      >
        Log out
      </button>
    </motion.div>
  );
}

UserMenu.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
