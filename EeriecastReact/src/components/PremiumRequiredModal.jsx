import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown, X, Star, BookOpen, ListMusic, Heart,
  CircleSlash, Headphones, ShoppingBag, Check,
  BadgePercent,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/context/UserContext';
import { useAuthModal } from '@/context/AuthModalContext';
import { PaymentFormModal } from '@/pages/Premium';

const MONTHLY_PRICE = 7.99;
const YEARLY_PRICE = 69.96;
const SAVINGS_PER_YEAR = 12 * MONTHLY_PRICE - YEARLY_PRICE;
const FREE_MONTHS_EQUIVALENT = Math.floor(SAVINGS_PER_YEAR / MONTHLY_PRICE);

const features = [
  { icon: Star,        title: 'Exclusive Members-Only Shows',       desc: 'Full access to all premium horror content' },
  { icon: BookOpen,    title: 'Complete Audiobooks & E-Reader',     desc: 'Listen to and read entire horror novels' },
  { icon: ListMusic,   title: 'Unlimited Playlists',                desc: 'Create and manage your own custom collections' },
  { icon: Heart,       title: 'Unlimited Favorites',                desc: 'Save as many episodes as you want' },
  { icon: CircleSlash, title: 'Ad-Free Listening',                  desc: 'Pure, uninterrupted horror on every episode' },
  { icon: Headphones,  title: 'All 1,300+ Episodes',                desc: 'Every show in the Eeriecast catalog' },
  { icon: ShoppingBag, title: '20% Off the Eeriecast Store',        desc: 'Exclusive member discount on merch' },
];

export default function PremiumRequiredModal({ isOpen, onClose }) {
  const { isAuthenticated, user } = useUser();
  const { openAuth } = useAuthModal();
  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [showPayment, setShowPayment] = useState(false);

  const handleStartTrial = useCallback(() => {
    if (!isAuthenticated) {
      onClose();
      openAuth('register', () => setShowPayment(true), 'Create an account to start your free trial.');
      return;
    }
    if (user?.is_premium) return;
    setShowPayment(true);
  }, [isAuthenticated, openAuth, user, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[4000] flex items-end sm:items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, y: 80, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.96 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-gradient-to-b from-[#111118] to-[#0c0c12] border border-white/[0.06] shadow-2xl shadow-black/50"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-40 rounded-full blur-[100px] opacity-[0.06] bg-gradient-to-br from-red-500 to-amber-500 pointer-events-none" />

          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.04] border border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-all"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative px-5 pt-8 pb-6">
            {/* Crown */}
            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/20 via-amber-500/15 to-red-600/10 border border-red-500/[0.08] flex items-center justify-center shadow-lg shadow-red-900/10">
                <Crown className="w-7 h-7 text-amber-400" />
              </div>
            </div>

            {/* Heading */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-display italic font-bold mb-2 tracking-tight text-white">
                Unlock Everything
              </h2>
              <p className="text-sm text-zinc-500 max-w-xs mx-auto leading-relaxed">
                This content is available exclusively to Eeriecast Premium members.
              </p>
            </div>

            {/* Pricing cards */}
            <div className="grid grid-cols-2 gap-2.5 mb-5">
              {/* Annual */}
              <button
                type="button"
                onClick={() => setSelectedPlan('yearly')}
                className={`relative rounded-xl p-3.5 text-left transition-all duration-200 overflow-hidden border-2 ${
                  selectedPlan === 'yearly'
                    ? 'bg-white/[0.06] border-amber-400/60 ring-1 ring-amber-400/25'
                    : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                <div className="relative">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-400/90 bg-amber-500/10 border border-amber-400/[0.12] px-2 py-0.5 rounded-full">
                      <BadgePercent className="w-2.5 h-2.5" />
                      Best Value
                    </span>
                  </div>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-2xl font-bold tracking-tight text-white">${(YEARLY_PRICE / 12).toFixed(2)}</span>
                    <span className="text-[11px] text-zinc-400">/mo</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-0.5">${YEARLY_PRICE.toFixed(2)}/yr</p>
                  <div className="mt-2 px-2 py-1 rounded bg-emerald-500/[0.08] border border-emerald-500/[0.12]">
                    <p className="text-[10px] font-semibold text-emerald-400">{FREE_MONTHS_EQUIVALENT} months free</p>
                  </div>
                  <div className={`absolute top-0 right-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedPlan === 'yearly' ? 'border-amber-400 bg-amber-400' : 'border-zinc-600'
                  }`}>
                    {selectedPlan === 'yearly' && <Check className="w-2.5 h-2.5 text-black" />}
                  </div>
                </div>
              </button>

              {/* Monthly */}
              <button
                type="button"
                onClick={() => setSelectedPlan('monthly')}
                className={`relative rounded-xl p-3.5 text-left transition-all duration-200 overflow-hidden border-2 ${
                  selectedPlan === 'monthly'
                    ? 'bg-white/[0.06] border-slate-400/50 ring-1 ring-slate-400/20'
                    : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                <div className="relative">
                  <div className="mb-2">
                    <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">Monthly</span>
                  </div>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-2xl font-bold tracking-tight text-white">${MONTHLY_PRICE}</span>
                    <span className="text-[11px] text-zinc-500">/mo</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Billed monthly</p>
                  <div className={`absolute top-0 right-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedPlan === 'monthly' ? 'border-slate-400 bg-slate-400' : 'border-zinc-600'
                  }`}>
                    {selectedPlan === 'monthly' && <Check className="w-2.5 h-2.5 text-slate-900" />}
                  </div>
                </div>
              </button>
            </div>

            {/* CTA */}
            <Button
              onClick={handleStartTrial}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold text-sm shadow-lg shadow-red-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] border border-red-500/20 mb-1"
            >
              Start Free Trial
            </Button>
            <p className="text-[10px] text-zinc-600 text-center mb-5">
              7 days free, then {selectedPlan === 'yearly' ? `$${YEARLY_PRICE}/year` : `$${MONTHLY_PRICE}/month`}. Cancel anytime.
            </p>

            {/* Features */}
            <div className="space-y-1.5">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600 mb-2 text-center">
                What you get
              </h3>
              {features.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.03]"
                >
                  <div className="w-7 h-7 rounded-md bg-white/[0.04] border border-white/[0.04] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-amber-400/80" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-200">{title}</p>
                    <p className="text-[10px] text-zinc-500">{desc}</p>
                  </div>
                  <Check className="w-3.5 h-3.5 text-red-500/60 flex-shrink-0" />
                </div>
              ))}
            </div>

            {/* Dismiss */}
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                Maybe later
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Payment form (layered on top) */}
      <AnimatePresence>
        {showPayment && (
          <PaymentFormModal
            open={showPayment}
            onClose={() => setShowPayment(false)}
            onSuccess={() => {
              setShowPayment(false);
              onClose();
            }}
            mode="trial"
            plan={selectedPlan}
          />
        )}
      </AnimatePresence>
    </>
  );
}

PremiumRequiredModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
