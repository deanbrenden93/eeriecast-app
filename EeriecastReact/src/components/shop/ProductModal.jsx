import { useState, useRef, useEffect } from 'react';
import { X, ShoppingBag, Check, Crown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext.jsx';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { AnimatePresence, motion } from 'framer-motion';

function formatPrice(amount, currency = 'USD') {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

const selectTriggerClass = "h-8 w-auto min-w-[6rem] gap-1.5 rounded-lg border-white/[0.08] bg-white/[0.05] px-3 text-xs font-medium text-zinc-300 hover:bg-white/[0.08] hover:border-white/[0.12] focus:ring-0 focus:ring-offset-0 transition-all duration-200 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-zinc-500";
const selectContentClass = "border-white/[0.08] bg-[#18181f] shadow-xl shadow-black/40 rounded-lg z-[6010]";
const selectItemClass = "text-xs text-zinc-400 focus:bg-white/[0.06] focus:text-white rounded-md cursor-pointer";

export default function ProductModal({ product, isOpen, onClose }) {
  const { addItem, isLoading } = useCart();
  const { isPremium } = useUser();
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [justAdded, setJustAdded] = useState(false);
  const [imageIdx, setImageIdx] = useState(0);

  // Keep a ref to the last valid product so the exit animation has data to render
  const lastProductRef = useRef(product);
  useEffect(() => {
    if (product) {
      lastProductRef.current = product;
      setSelectedVariantIdx(0);
      setImageIdx(0);
      setJustAdded(false);
    }
  }, [product]);

  const displayProduct = product || lastProductRef.current;
  if (!displayProduct) return null;

  const variants = displayProduct.variants || [];
  const variant = variants[selectedVariantIdx] || variants[0];

  // Deduplicate images by URL so the carousel only shows truly unique photos
  const uniqueImages = (() => {
    const seen = new Set();
    const result = [];
    for (const img of (displayProduct.images || [])) {
      if (img?.url && !seen.has(img.url)) {
        seen.add(img.url);
        result.push(img);
      }
    }
    return result;
  })();

  const hasGallery = uniqueImages.length > 1;
  const safeImageIdx = imageIdx < uniqueImages.length ? imageIdx : 0;
  const currentImage = uniqueImages[safeImageIdx]?.url || variant?.image?.url;

  const price = Number(variant?.price?.amount || 0);
  const currency = variant?.price?.currencyCode || 'USD';
  const memberPrice = price * 0.8;
  const hasMultipleVariants = variants.length > 1;

  const optionGroups = {};
  if (hasMultipleVariants) {
    for (const v of variants) {
      for (const opt of (v.selectedOptions || [])) {
        if (!optionGroups[opt.name]) optionGroups[opt.name] = new Set();
        optionGroups[opt.name].add(opt.value);
      }
    }
  }

  const handleAdd = async () => {
    if (!variant?.availableForSale || justAdded) return;
    await addItem(variant.id);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  };

  const findVariantByOptions = (optionName, optionValue) => {
    const currentOptions = variant?.selectedOptions?.reduce((acc, o) => {
      acc[o.name] = o.value;
      return acc;
    }, {}) || {};
    currentOptions[optionName] = optionValue;

    const idx = variants.findIndex(v =>
      v.selectedOptions?.every(o => currentOptions[o.name] === o.value)
    );
    if (idx >= 0) setSelectedVariantIdx(idx);
  };

  const currentOptionValue = (name) => {
    return variant?.selectedOptions?.find(o => o.name === name)?.value || '';
  };

  const prevImage = () => setImageIdx(i => (i - 1 + uniqueImages.length) % uniqueImages.length);
  const nextImage = () => setImageIdx(i => (i + 1) % uniqueImages.length);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[6000] bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-[6001] flex items-center justify-center p-4 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
            <motion.div
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0f0f17] border border-white/[0.06] rounded-2xl shadow-2xl shadow-black/60"
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.93, y: 30, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-zinc-400 hover:text-white hover:bg-black/60 transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col md:flex-row">
                {/* Image gallery */}
                <div className="relative md:w-1/2 flex-shrink-0 bg-zinc-900">
                  <div className="aspect-square relative overflow-hidden">
                    {currentImage ? (
                      <img
                        src={currentImage}
                        alt={displayProduct.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-12 h-12 text-zinc-700" />
                      </div>
                    )}

                    {/* Image nav arrows + counter */}
                    {hasGallery && (
                      <>
                        <button
                          onClick={prevImage}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-all"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={nextImage}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-all"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        {/* Image counter */}
                        <span className="absolute bottom-2 right-2 text-[10px] font-medium text-white/70 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full">
                          {safeImageIdx + 1} / {uniqueImages.length}
                        </span>
                      </>
                    )}

                    {/* Member badge */}
                    {isPremium && (
                      <div className="absolute top-3 left-3 flex items-center gap-1 bg-gradient-to-r from-amber-500/90 to-amber-600/90 backdrop-blur-sm text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                        <Crown className="w-2.5 h-2.5" />
                        20% Off
                      </div>
                    )}

                    {!variant?.availableForSale && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white/80 text-sm font-semibold uppercase tracking-wider">Sold Out</span>
                      </div>
                    )}
                  </div>

                  {/* Image dots */}
                  {hasGallery && (
                    <div className="flex justify-center gap-1.5 py-3 bg-zinc-900">
                      {uniqueImages.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setImageIdx(i)}
                          className={`h-1.5 rounded-full transition-all duration-200 ${
                            i === safeImageIdx ? 'bg-white w-4' : 'bg-zinc-600 hover:bg-zinc-400 w-1.5'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Product details */}
                <div className="flex-1 p-5 sm:p-6 flex flex-col">
                  <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight mb-2">
                    {displayProduct.title}
                  </h2>

                  {displayProduct.productType && (
                    <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium mb-3">
                      {displayProduct.productType}
                    </span>
                  )}

                  {/* Price */}
                  <div className="flex items-baseline gap-2.5 mb-4">
                    {isPremium ? (
                      <>
                        <span className="text-white font-bold text-xl">{formatPrice(memberPrice, currency)}</span>
                        <span className="text-zinc-600 text-sm line-through">{formatPrice(price, currency)}</span>
                        <span className="text-amber-400 text-xs font-semibold">Member Price</span>
                      </>
                    ) : (
                      <span className="text-white font-bold text-xl">{formatPrice(price, currency)}</span>
                    )}
                  </div>

                  {/* Description */}
                  {displayProduct.description && (
                    <p className="text-zinc-400 text-sm leading-relaxed mb-5">
                      {displayProduct.description}
                    </p>
                  )}

                  {/* Variant selectors */}
                  {hasMultipleVariants && (
                    <div className="space-y-3 mb-5">
                      {Object.entries(optionGroups).map(([name, values]) => (
                        <div key={name}>
                          <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5 block">{name}</label>
                          <Select
                            value={currentOptionValue(name)}
                            onValueChange={(val) => findVariantByOptions(name, val)}
                          >
                            <SelectTrigger className={selectTriggerClass}>
                              <SelectValue placeholder={name} />
                            </SelectTrigger>
                            <SelectContent className={selectContentClass}>
                              {[...values].map(val => (
                                <SelectItem key={val} value={val} className={selectItemClass}>
                                  {val}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tags */}
                  {displayProduct.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {displayProduct.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 text-[10px] font-medium text-zinc-500 bg-white/[0.04] border border-white/[0.06] rounded-md">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto pt-4">
                    {/* Add to cart */}
                    <button
                      onClick={handleAdd}
                      disabled={!variant?.availableForSale || isLoading}
                      className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                        justAdded
                          ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                          : variant?.availableForSale
                            ? 'bg-white text-black hover:bg-zinc-200'
                            : 'bg-white/[0.04] border border-white/[0.06] text-zinc-600 cursor-not-allowed'
                      }`}
                    >
                      {justAdded ? (
                        <>
                          <Check className="w-4 h-4" />
                          Added to Cart
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="w-4 h-4" />
                          {variant?.availableForSale ? 'Add to Cart' : 'Sold Out'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
