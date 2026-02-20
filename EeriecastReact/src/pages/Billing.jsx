import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PaymentFormModal } from "./Premium";
import {
  ChevronLeft,
  X,
  CreditCard,
  Calendar,
  ShieldCheck,
  ExternalLink,
  Crown,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  CreditCard as CardIcon,
  Trash2,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useUser } from "@/context/UserContext";
import { djangoClient } from "@/api/djangoClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Billing() {
  const navigate = useNavigate();
  const { user, isPremium, fetchUser } = useUser();
  const [loading, setLoading] = useState(true);
  const [billingData, setBillingData] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showUpdateCard, setShowUpdateCard] = useState(false);

  const fetchBillingStatus = async () => {
    try {
      const data = await djangoClient.get("/billing/me/");
      setBillingData(data);
    } catch (err) {
      console.error("Failed to fetch billing status:", err);
      toast({
        title: "Error",
        description: "Failed to load billing information.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingStatus();
  }, []);

  const handleCancelSubscription = async () => {
    if (!activeSub?.stripe_subscription_id) return;
    
    setCancelLoading(true);
    try {
      await djangoClient.post("/billing/cancel/", {
        subscription_id: activeSub.stripe_subscription_id
      });
      
      toast({
        title: "Subscription Canceled",
        description: "Your subscription will remain active until the end of the current period.",
      });
      
      await fetchBillingStatus();
      await fetchUser();
    } catch (err) {
      console.error("Failed to cancel subscription:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to cancel subscription.",
        variant: "destructive",
      });
    } finally {
      setCancelLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const activeSub = billingData?.active_subscription;
  const status = activeSub?.status || (isPremium ? "active" : "none");
  const paymentMethod = billingData?.payment_method || (activeSub?.card_brand ? {
    brand: activeSub.card_brand,
    last4: activeSub.card_last4,
    exp_month: activeSub.card_exp_month,
    exp_year: activeSub.card_exp_year,
  } : null);

  return (
    <div className="min-h-screen bg-[#0a0a10] text-white relative overflow-y-auto">
      {/* Ambient background effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[50rem] h-[40rem] rounded-full blur-[200px] opacity-[0.06] bg-gradient-to-br from-red-700 via-amber-600 to-transparent pointer-events-none" />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/[0.04] bg-[#0a0a10]/60 backdrop-blur-md sticky top-0">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Back</span>
        </button>
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
          Billing & Subscription
        </span>
        <div className="w-8" /> {/* Spacer */}
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-5 py-8 space-y-8">
        {/* Header */}
        <section className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-amber-500/10 border border-red-500/[0.08] mb-4">
            <CreditCard className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Manage Subscription</h1>
          <p className="text-zinc-500 text-sm">
            View your current plan, payment method, and billing history.
          </p>
        </section>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-zinc-500 text-xs animate-pulse">Loading your data...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Subscription Status Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 relative overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Current Plan</h3>
                    {isPremium && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-bold uppercase tracking-wider border border-amber-500/20">
                        <Crown className="w-3 h-3" />
                        Premium
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-400 text-sm">
                    {activeSub?.plan_nickname || (isPremium ? "Monthly Subscription" : "Free Plan")}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    status === 'trialing' ? 'bg-blue-500/10 text-blue-400' :
                    status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                    status === 'past_due' ? 'bg-red-500/10 text-red-400' :
                    'bg-white/5 text-zinc-500'
                  }`}>
                    {status === 'trialing' && <Clock className="w-3.5 h-3.5" />}
                    {status === 'active' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {status === 'past_due' && <AlertCircle className="w-3.5 h-3.5" />}
                    <span className="capitalize">{status}</span>
                  </div>
                  {activeSub?.current_period_end && (
                    <p className="text-[11px] text-zinc-500 mt-2">
                      {activeSub.cancel_at_period_end ? "Ends on" : "Renews on"} {formatDate(activeSub.current_period_end)}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Info Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl bg-white/[0.02] border border-white/[0.04] p-5 space-y-3"
              >
                <div className="flex items-center gap-2 text-zinc-400">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Member Since</span>
                </div>
                <p className="text-lg font-medium">{formatDate(user?.date_joined)}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl bg-white/[0.02] border border-white/[0.04] p-5 space-y-3"
              >
                <div className="flex items-center gap-2 text-zinc-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Payment Status</span>
                </div>
                <p className="text-lg font-medium">Verified via Stripe</p>
              </motion.div>
            </div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-4 pt-4"
            >
              <div className="space-y-4">
                {/* Payment Method Card */}
                {paymentMethod ? (
                  <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 flex items-center gap-4">
                    <div className="w-12 h-8 rounded bg-zinc-800 flex items-center justify-center border border-white/10">
                      <CardIcon className="w-5 h-5 text-zinc-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white capitalize">
                        {paymentMethod.brand} •••• {paymentMethod.last4}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        Expires {paymentMethod.exp_month}/{paymentMethod.exp_year}
                      </p>
                    </div>
                    <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
                      Default
                    </div>
                    <button 
                      onClick={() => setShowUpdateCard(true)}
                      className="p-2 text-zinc-500 hover:text-white transition-colors"
                      title="Update Card"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => setShowUpdateCard(true)}
                    className="w-full h-14 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] text-zinc-400 hover:text-white border border-white/5 transition-all"
                  >
                    <CreditCard className="w-4 h-4 mr-2 opacity-50" />
                    <span className="font-semibold">Add Payment Method</span>
                  </Button>
                )}

                {isPremium ? (
                  !activeSub?.cancel_at_period_end && activeSub?.status !== 'canceled' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full h-14 rounded-xl bg-white/[0.02] hover:bg-red-500/10 text-zinc-400 hover:text-red-500 border border-white/5 hover:border-red-500/20 group transition-all"
                        >
                          <Trash2 className="w-4 h-4 mr-2 opacity-50 group-hover:opacity-100" />
                          <span className="font-semibold">Cancel Subscription</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-[#121316] border-white/10 text-white">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription className="text-zinc-400">
                            Your premium benefits will remain active until the end of your current billing period on {formatDate(activeSub?.current_period_end)}.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-zinc-800 text-white border-white/10 hover:bg-zinc-700">Stay Premium</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleCancelSubscription}
                            className="bg-red-600 text-white hover:bg-red-700"
                            disabled={cancelLoading}
                          >
                            {cancelLoading ? "Canceling..." : "Yes, Cancel Subscription"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )
                ) : (
                  <Button
                    onClick={() => navigate("/premium")}
                    className="w-full h-14 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold border border-red-500/20 shadow-lg shadow-red-600/10 group transition-all"
                  >
                    <span className="flex-1 text-left font-semibold">Upgrade to Premium</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                )}
              </div>

              <p className="text-[11px] text-zinc-600 text-center px-8">
                Payments are processed securely by Stripe. We do not store your full credit card details on our servers.
              </p>
            </motion.div>

            {/* Billing History Placeholder or List */}
            {billingData?.all_subscriptions?.length > 1 && (
              <section className="pt-8">
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-600 mb-4 px-1">
                  Subscription History
                </h2>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04] overflow-hidden">
                  {billingData.all_subscriptions.map((sub) => (
                    <div key={sub.id} className="px-5 py-4 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                      <div>
                        <p className="text-sm font-medium text-zinc-200">{sub.plan_nickname || "Monthly Subscription"}</p>
                        <p className="text-[11px] text-zinc-500">{formatDate(sub.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          sub.status === 'canceled' ? 'text-zinc-600' : 'text-emerald-500/70'
                        }`}>
                          {sub.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showUpdateCard && (
          <PaymentFormModal
            open={showUpdateCard}
            onClose={() => setShowUpdateCard(false)}
            onSuccess={() => fetchBillingStatus()}
            mode="update"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
