import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import {
  X,
  Crown,
  Headphones,
  BookOpen,
  Star,
  CircleSlash,
  Sparkles,
  ChevronLeft,
  Check,
  CreditCard,
  Lock,
  ShieldCheck,
  ListMusic,
  Heart,
} from 'lucide-react';

const features = [
  {
    icon: Star,
    title: 'Exclusive Members-Only Shows',
    desc: 'Full access to all premium horror content',
  },
  {
    icon: BookOpen,
    title: 'Complete Audiobooks & E-Reader',
    desc: 'Listen to and read entire horror novels — every chapter',
  },
  {
    icon: ListMusic,
    title: 'Unlimited Playlists',
    desc: 'Create and manage your own custom collections',
  },
  {
    icon: Heart,
    title: 'Unlimited Favorites',
    desc: 'Save as many episodes as you want',
  },
  {
    icon: CircleSlash,
    title: 'Ad-Free Listening',
    desc: 'Pure, uninterrupted horror on every episode',
  },
  {
    icon: Headphones,
    title: 'All 1,300+ Episodes',
    desc: 'Every show in the Eeriecast catalog, no restrictions',
  },
];

/* ─── Helpers ─────────────────────────────────────────────────────── */

/** Format a raw card number string into groups of 4 */
function formatCardNumber(value) {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

/** Format expiry as MM/YY */
function formatExpiry(value) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/** Detect card brand from leading digits */
function getCardBrand(number) {
  const d = number.replace(/\D/g, '');
  if (/^4/.test(d)) return 'visa';
  if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) return 'mastercard';
  if (/^3[47]/.test(d)) return 'amex';
  if (/^6(?:011|5)/.test(d)) return 'discover';
  return null;
}

const brandColors = {
  visa: '#1a1f71',
  mastercard: '#eb001b',
  amex: '#006fcf',
  discover: '#ff6600',
};

/* ─── Floating‑label input field ──────────────────────────────────── */

function PaymentField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  autoComplete,
  inputMode,
  maxLength,
  error,
  icon: Icon,
  className = '',
}) {
  const [focused, setFocused] = useState(false);
  const hasValue = value && value.length > 0;
  const active = focused || hasValue;

  return (
    <div className={`relative ${className}`}>
      <div
        className={`relative rounded-xl border transition-all duration-200 ${
          error
            ? 'border-red-500/50 bg-red-500/[0.04]'
            : focused
              ? 'border-white/20 bg-white/[0.06]'
              : 'border-white/[0.06] bg-white/[0.03]'
        }`}
      >
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <Icon className={`w-4 h-4 transition-colors duration-200 ${focused ? 'text-white/60' : 'text-white/20'}`} />
          </div>
        )}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          className={`peer w-full bg-transparent text-white text-sm font-medium outline-none pt-5 pb-2 ${
            Icon ? 'pl-10 pr-4' : 'pl-4 pr-4'
          } placeholder-transparent`}
          placeholder={label}
        />
        {/* Floating label */}
        <label
          className={`absolute transition-all duration-200 pointer-events-none ${
            Icon ? 'left-10' : 'left-4'
          } ${
            active
              ? 'top-1.5 text-[10px] font-semibold tracking-wider uppercase'
              : 'top-1/2 -translate-y-1/2 text-sm'
          } ${
            error ? 'text-red-400' : focused ? 'text-white/50' : 'text-white/30'
          }`}
        >
          {label}
        </label>
      </div>
      {error && (
        <p className="text-[11px] text-red-400 mt-1 ml-1">{error}</p>
      )}
    </div>
  );
}

/* ─── Card brand indicator ────────────────────────────────────────── */

function CardBrandBadge({ number }) {
  const brand = getCardBrand(number);
  if (!brand) return null;

  const labels = { visa: 'VISA', mastercard: 'MC', amex: 'AMEX', discover: 'DISC' };

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
      style={{ backgroundColor: `${brandColors[brand]}22`, color: brandColors[brand] === '#1a1f71' ? '#6b7fff' : brandColors[brand], border: `1px solid ${brandColors[brand]}33` }}
    >
      {labels[brand]}
    </motion.span>
  );
}

/* ─── Payment form modal ──────────────────────────────────────────── */

function PaymentFormModal({ open, onClose }) {
  const [form, setForm] = useState({
    cardholderName: '',
    cardNumber: '',
    expiry: '',
    cvc: '',
    zip: '',
    email: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'processing' | 'success'

  const formRef = useRef(null);

  /** Focus the next field by name inside the form */
  const focusField = useCallback((name) => {
    setTimeout(() => {
      formRef.current?.querySelector(`input[name="${name}"]`)?.focus();
    }, 50);
  }, []);

  const handleChange = useCallback((field) => (e) => {
    let value = e.target.value;

    if (field === 'cardNumber') {
      value = formatCardNumber(value);
    } else if (field === 'expiry') {
      value = formatExpiry(value);
      // Auto-advance to CVC when expiry is complete
      if (value.length === 5) focusField('cvc');
    } else if (field === 'cvc') {
      value = value.replace(/\D/g, '').slice(0, 4);
      // Auto-advance to ZIP when CVC is complete
      if (value.length >= 3) focusField('zip');
    } else if (field === 'zip') {
      value = value.replace(/\D/g, '').slice(0, 5);
    }

    setForm(prev => ({ ...prev, [field]: value }));
    // Clear error for this field on change
    if (errors[field]) {
      setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }
  }, [errors, focusField]);

  const validate = () => {
    const errs = {};
    if (!form.cardholderName.trim()) errs.cardholderName = 'Name is required';
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Valid email required';
    const digits = form.cardNumber.replace(/\D/g, '');
    if (digits.length < 15) errs.cardNumber = 'Enter a valid card number';
    if (!/^\d{2}\/\d{2}$/.test(form.expiry)) {
      errs.expiry = 'Use MM/YY';
    } else {
      const [mm, yy] = form.expiry.split('/').map(Number);
      if (mm < 1 || mm > 12) errs.expiry = 'Invalid month';
      const now = new Date();
      const expDate = new Date(2000 + yy, mm);
      if (expDate < now) errs.expiry = 'Card expired';
    }
    if (form.cvc.length < 3) errs.cvc = 'Enter CVC';
    if (form.zip.length < 5) errs.zip = 'Enter ZIP';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    setStep('processing');

    // Simulate payment processing
    await new Promise(r => setTimeout(r, 2200));

    setStep('success');
    setSubmitting(false);

    // Close after success animation
    setTimeout(() => {
      onClose?.();
      toast({ title: 'Welcome to Eeriecast Premium', description: 'Your free trial has started', duration: 4000 });
    }, 1800);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[5000] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => !submitting && onClose?.()}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: 100, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 80, scale: 0.95 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-gradient-to-b from-[#111118] to-[#0c0c12] border border-white/[0.06] shadow-2xl shadow-black/50"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Decorative glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-40 rounded-full blur-[100px] opacity-[0.06] bg-gradient-to-br from-red-500 to-amber-500 pointer-events-none" />

        {/* Close button */}
        <button
          type="button"
          onClick={() => !submitting && onClose?.()}
          className="absolute right-4 top-4 z-10 w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.04] border border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-all"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <AnimatePresence mode="wait">
          {step === 'form' && (
            <motion.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              ref={formRef}
              onSubmit={handleSubmit}
              className="relative p-6 sm:p-8"
              autoComplete="on"
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-amber-500/10 border border-red-500/[0.08] flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Payment Details</h2>
                  <p className="text-xs text-zinc-500">7 days free, then $7.99/month</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Email */}
                <PaymentField
                  label="Email address"
                  name="email"
                  value={form.email}
                  onChange={handleChange('email')}
                  type="email"
                  autoComplete="email"
                  error={errors.email}
                />

                {/* Cardholder name */}
                <PaymentField
                  label="Name on card"
                  name="cardholderName"
                  value={form.cardholderName}
                  onChange={handleChange('cardholderName')}
                  autoComplete="cc-name"
                  error={errors.cardholderName}
                />

                {/* Card number */}
                <div className="relative">
                  <PaymentField
                    label="Card number"
                    name="cardNumber"
                    value={form.cardNumber}
                    onChange={handleChange('cardNumber')}
                    autoComplete="cc-number"
                    inputMode="numeric"
                    maxLength={19}
                    icon={CreditCard}
                    error={errors.cardNumber}
                  />
                  <div className="absolute right-3.5 top-3.5">
                    <CardBrandBadge number={form.cardNumber} />
                  </div>
                </div>

                {/* Row: Expiry / CVC / ZIP */}
                <div className="grid grid-cols-3 gap-3">
                  <PaymentField
                    label="MM/YY"
                    name="expiry"
                    value={form.expiry}
                    onChange={handleChange('expiry')}
                    autoComplete="cc-exp"
                    inputMode="numeric"
                    maxLength={5}
                    error={errors.expiry}
                  />
                  <PaymentField
                    label="CVC"
                    name="cvc"
                    value={form.cvc}
                    onChange={handleChange('cvc')}
                    autoComplete="cc-csc"
                    inputMode="numeric"
                    maxLength={4}
                    error={errors.cvc}
                  />
                  <PaymentField
                    label="ZIP"
                    name="zip"
                    value={form.zip}
                    onChange={handleChange('zip')}
                    autoComplete="postal-code"
                    inputMode="numeric"
                    maxLength={5}
                    error={errors.zip}
                  />
                </div>
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full mt-6 py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold text-base shadow-lg shadow-red-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] border border-red-500/20 disabled:opacity-60"
              >
                <Lock className="w-4 h-4 mr-2" />
                Start Free Trial
              </Button>

              {/* Security note */}
              <div className="flex items-center justify-center gap-1.5 mt-4">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/60" />
                <p className="text-[11px] text-zinc-600">
                  256-bit SSL encrypted. We never store your full card number.
                </p>
              </div>
            </motion.form>
          )}

          {step === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="relative p-8 sm:p-12 flex flex-col items-center justify-center min-h-[320px]"
            >
              <div className="relative w-16 h-16 mb-6">
                <div className="absolute inset-0 rounded-full border-2 border-white/[0.06]" />
                <div className="absolute inset-0 rounded-full border-2 border-t-red-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                <div className="absolute inset-2 rounded-full bg-white/[0.03] flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-white/40" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">Processing Payment</h3>
              <p className="text-sm text-zinc-500">Securely verifying your card...</p>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, type: 'spring', damping: 20 }}
              className="relative p-8 sm:p-12 flex flex-col items-center justify-center min-h-[320px]"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', damping: 15, stiffness: 200 }}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center mb-6"
              >
                <Check className="w-8 h-8 text-emerald-400" />
              </motion.div>
              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="text-xl font-bold text-white mb-1"
              >
                Welcome to Premium
              </motion.h3>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-sm text-zinc-500"
              >
                Your 7-day free trial has started
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/* ─── Premium page ────────────────────────────────────────────────── */

export default function Premium() {
  const navigate = useNavigate();
  const [showPayment, setShowPayment] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a10] text-white relative overflow-hidden">
      {/* ── Ambient background effects ── */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[50rem] h-[40rem] rounded-full blur-[200px] opacity-[0.06] bg-gradient-to-br from-red-700 via-amber-600 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[30rem] h-[30rem] rounded-full blur-[160px] opacity-[0.04] bg-gradient-to-tl from-red-900 to-transparent pointer-events-none" />

      {/* ── Top bar with exit ── */}
      <div className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/[0.04] bg-[#0a0a10]/60 backdrop-blur-md">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Back</span>
        </button>
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
          Membership
        </span>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.04] border border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-all"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Main content ── */}
      <div className="relative z-10 max-w-lg mx-auto px-5 py-10 sm:py-14">
        {/* Crown icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 via-amber-500/15 to-red-600/10 border border-red-500/[0.08] flex items-center justify-center shadow-lg shadow-red-900/10">
            <Crown className="w-8 h-8 text-amber-400" />
          </div>
        </div>

        {/* Heading */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-display italic font-bold mb-3 tracking-tight">
            Unlock Everything
          </h1>
          <p className="text-sm sm:text-base text-zinc-500 max-w-xs mx-auto leading-relaxed">
            Unlimited access to every show, audiobook, and feature Eeriecast has to offer.
          </p>
        </div>

        {/* ── Pricing card ── */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 sm:p-8 mb-8 relative overflow-hidden">
          {/* Card glow */}
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-60 h-32 rounded-full blur-[80px] opacity-[0.08] bg-gradient-to-br from-red-500 to-amber-500 pointer-events-none" />

          <div className="relative">
            {/* Badge */}
            <div className="flex justify-center mb-5">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-amber-400/90 bg-amber-500/10 border border-amber-400/[0.08] px-3 py-1 rounded-full">
                <Sparkles className="w-3 h-3" />
                Most Popular
              </span>
            </div>

            {/* Price */}
            <div className="text-center mb-6">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl sm:text-6xl font-bold tracking-tight text-white">$7.99</span>
                <span className="text-lg text-zinc-500 font-medium">/mo</span>
              </div>
              <p className="text-xs text-zinc-600 mt-2">7 days free, then $7.99/month. Cancel anytime.</p>
            </div>

            {/* CTA */}
            <Button
              onClick={() => setShowPayment(true)}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold text-base shadow-lg shadow-red-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] border border-red-500/20"
            >
              Start Free Trial
            </Button>
          </div>
        </div>

        {/* ── Features grid ── */}
        <div className="mb-10">
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-600 mb-4 text-center">
            What you get
          </h2>
          <div className="space-y-2">
            {features.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.06] transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.04] flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-amber-400/80" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200">{title}</p>
                  <p className="text-xs text-zinc-500">{desc}</p>
                </div>
                <Check className="w-4 h-4 text-red-500/60 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom secondary CTA ── */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>

      {/* ── Payment form modal ── */}
      <AnimatePresence>
        {showPayment && (
          <PaymentFormModal
            open={showPayment}
            onClose={() => setShowPayment(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
