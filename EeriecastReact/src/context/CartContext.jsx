import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import * as Shopify from '@/api/shopify';
import { useUser } from '@/context/UserContext.jsx';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

const CART_ID_KEY = 'eeriecast_cart_id';
const MEMBER_DISCOUNT_CODE = 'VNHGVJ57B867';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { isPremium } = useUser();

  // Restore cart from localStorage on mount
  useEffect(() => {
    const savedId = localStorage.getItem(CART_ID_KEY);
    if (savedId) {
      Shopify.getCart(savedId)
        .then(c => {
          if (c && c.lines.length > 0) {
            setCart(c);
          } else {
            // Cart is empty or expired
            localStorage.removeItem(CART_ID_KEY);
          }
        })
        .catch(() => {
          localStorage.removeItem(CART_ID_KEY);
        });
    }
  }, []);

  // Persist cart ID
  useEffect(() => {
    if (cart?.id) {
      localStorage.setItem(CART_ID_KEY, cart.id);
    }
  }, [cart?.id]);

  const ensureCart = useCallback(async () => {
    if (cart?.id) {
      // Validate it still exists
      try {
        const existing = await Shopify.getCart(cart.id);
        if (existing) return existing;
      } catch { /* cart expired, create new */ }
    }
    const newCart = await Shopify.createCart();
    setCart(newCart);
    return newCart;
  }, [cart?.id]);

  const addItem = useCallback(async (variantId, quantity = 1) => {
    setIsLoading(true);
    try {
      const currentCart = await ensureCart();
      const updated = await Shopify.addToCart(currentCart.id, variantId, quantity);
      setCart(updated);
      setIsCartOpen(true);
    } catch (err) {
      console.error('Failed to add to cart:', err);
    } finally {
      setIsLoading(false);
    }
  }, [ensureCart]);

  const updateQuantity = useCallback(async (lineId, quantity) => {
    if (!cart?.id) return;
    setIsLoading(true);
    try {
      if (quantity <= 0) {
        const updated = await Shopify.removeFromCart(cart.id, lineId);
        setCart(updated);
      } else {
        const updated = await Shopify.updateCartLine(cart.id, lineId, quantity);
        setCart(updated);
      }
    } catch (err) {
      console.error('Failed to update cart:', err);
    } finally {
      setIsLoading(false);
    }
  }, [cart?.id]);

  const removeItem = useCallback(async (lineId) => {
    if (!cart?.id) return;
    setIsLoading(true);
    try {
      const updated = await Shopify.removeFromCart(cart.id, lineId);
      setCart(updated);
    } catch (err) {
      console.error('Failed to remove from cart:', err);
    } finally {
      setIsLoading(false);
    }
  }, [cart?.id]);

  const checkout = useCallback(async () => {
    if (!cart?.id) return;
    setIsLoading(true);
    try {
      let finalCart = cart;
      // Auto-apply member discount for premium users
      if (isPremium) {
        const alreadyApplied = cart.discountCodes?.some(
          d => d.code === MEMBER_DISCOUNT_CODE && d.applicable
        );
        if (!alreadyApplied) {
          finalCart = await Shopify.applyDiscount(cart.id, MEMBER_DISCOUNT_CODE);
          setCart(finalCart);
        }
      }
      if (finalCart.checkoutUrl) {
        if (Capacitor.isNativePlatform()) {
          // Native: open in-app browser overlay (SFSafariViewController / Chrome Custom Tabs)
          await Browser.open({ url: finalCart.checkoutUrl });
        } else {
          // Web: open in a new tab so the app stays in the background
          window.open(finalCart.checkoutUrl, '_blank');
        }
      }
    } catch (err) {
      console.error('Checkout failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [cart, isPremium]);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  const cartCount = useMemo(() => cart?.totalQuantity || 0, [cart?.totalQuantity]);

  const value = useMemo(() => ({
    cart,
    cartCount,
    isCartOpen,
    isLoading,
    addItem,
    removeItem,
    updateQuantity,
    checkout,
    openCart,
    closeCart,
  }), [cart, cartCount, isCartOpen, isLoading, addItem, removeItem, updateQuantity, checkout, openCart, closeCart]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
