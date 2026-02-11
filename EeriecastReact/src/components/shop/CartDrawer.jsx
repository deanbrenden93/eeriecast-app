import { X, Minus, Plus, Trash2, ShoppingBag, Crown, Loader2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext.jsx';
import { AnimatePresence, motion } from 'framer-motion';

function formatPrice(amount, currency = 'USD') {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

export default function CartDrawer() {
  const { cart, isCartOpen, closeCart, removeItem, updateQuantity, checkout, isLoading } = useCart();
  const { isPremium } = useUser();

  const lines = cart?.lines || [];
  const subtotal = Number(cart?.cost?.subtotal?.amount || 0);
  const total = Number(cart?.cost?.total?.amount || 0);
  const currency = cart?.cost?.total?.currencyCode || 'USD';
  const hasDiscount = total < subtotal && subtotal > 0;

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[5000] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeCart}
          />

          {/* Drawer */}
          <motion.div
            className="fixed top-0 right-0 bottom-0 z-[5001] w-full max-w-md bg-[#0c0c14] border-l border-white/[0.06] flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-5 h-5 text-white" />
                <h2 className="text-lg font-bold text-white">Your Cart</h2>
                {lines.length > 0 && (
                  <span className="text-[11px] text-zinc-500 font-medium">
                    {cart?.totalQuantity || 0} {(cart?.totalQuantity || 0) === 1 ? 'item' : 'items'}
                  </span>
                )}
              </div>
              <button
                onClick={closeCart}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto">
              {lines.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
                    <ShoppingBag className="w-7 h-7 text-zinc-600" />
                  </div>
                  <p className="text-zinc-400 text-sm font-medium mb-1">Your cart is empty</p>
                  <p className="text-zinc-600 text-xs">Browse the shop to find something you like</p>
                </div>
              ) : (
                <ul className="divide-y divide-white/[0.04]">
                  {lines.map((line) => {
                    const v = line.variant;
                    const image = v?.image?.url;
                    const productTitle = v?.product?.title || '';
                    const variantTitle = v?.title && v.title !== 'Default Title' ? v.title : '';
                    const linePrice = Number(line.cost?.amount || 0);

                    return (
                      <li key={line.id} className="px-5 py-4 flex gap-3.5">
                        {/* Thumbnail */}
                        <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-900 border border-white/[0.04]">
                          {image ? (
                            <img src={image} alt={productTitle} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ShoppingBag className="w-5 h-5 text-zinc-700" />
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-white leading-snug line-clamp-1">{productTitle}</h4>
                          {variantTitle && (
                            <p className="text-[11px] text-zinc-500 mt-0.5">{variantTitle}</p>
                          )}
                          <p className="text-sm font-semibold text-white mt-1">{formatPrice(linePrice, currency)}</p>

                          {/* Quantity controls */}
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => updateQuantity(line.id, line.quantity - 1)}
                              disabled={isLoading}
                              className="w-6 h-6 rounded-md bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.12] transition-all duration-200 disabled:opacity-40"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-medium text-white tabular-nums w-5 text-center">{line.quantity}</span>
                            <button
                              onClick={() => updateQuantity(line.id, line.quantity + 1)}
                              disabled={isLoading}
                              className="w-6 h-6 rounded-md bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.12] transition-all duration-200 disabled:opacity-40"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => removeItem(line.id)}
                              disabled={isLoading}
                              className="ml-auto p-1 text-zinc-600 hover:text-red-400 transition-colors duration-200 disabled:opacity-40"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Footer — totals + checkout */}
            {lines.length > 0 && (
              <div className="border-t border-white/[0.06] px-5 py-4 space-y-3">
                {/* Subtotal */}
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Subtotal</span>
                  <span className="text-white font-medium">{formatPrice(subtotal, currency)}</span>
                </div>

                {/* Member discount preview */}
                {isPremium && !hasDiscount && (
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-amber-400/80">
                      <Crown className="w-3.5 h-3.5" />
                      Member discount (20%)
                    </span>
                    <span className="text-amber-400/80 font-medium">-{formatPrice(subtotal * 0.2, currency)}</span>
                  </div>
                )}

                {/* Applied discount */}
                {hasDiscount && (
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <Crown className="w-3.5 h-3.5" />
                      Discount applied
                    </span>
                    <span className="text-emerald-400 font-medium">-{formatPrice(subtotal - total, currency)}</span>
                  </div>
                )}

                {/* Estimated total */}
                {isPremium && (
                  <div className="flex justify-between text-sm pt-2 border-t border-white/[0.04]">
                    <span className="text-zinc-300 font-medium">Estimated total</span>
                    <span className="text-white font-bold">
                      {hasDiscount ? formatPrice(total, currency) : formatPrice(subtotal * 0.8, currency)}
                    </span>
                  </div>
                )}

                <p className="text-[10px] text-zinc-600 leading-relaxed">
                  {isPremium
                    ? 'Your member discount will be applied at checkout.'
                    : 'Shipping and taxes calculated at checkout.'}
                </p>

                {/* Checkout button */}
                <button
                  onClick={checkout}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition-all duration-300 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      Checkout
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
