import { useState } from 'react';
import { ShoppingBag, Check, Crown } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext.jsx';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

function formatPrice(amount, currency = 'USD') {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

const selectTriggerClass = "h-7 w-auto min-w-[5rem] gap-1 rounded-lg border-white/[0.08] bg-white/[0.04] px-2.5 text-[11px] font-medium text-zinc-300 hover:bg-white/[0.08] hover:border-white/[0.12] focus:ring-0 focus:ring-offset-0 transition-all duration-200 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-zinc-500";
const selectContentClass = "border-white/[0.08] bg-[#18181f] shadow-xl shadow-black/40 rounded-lg";
const selectItemClass = "text-[11px] text-zinc-400 focus:bg-white/[0.06] focus:text-white rounded-md cursor-pointer";

export default function ProductCard({ product, onOpenDetail }) {
  const { addItem, isLoading } = useCart();
  const { isPremium } = useUser();
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [justAdded, setJustAdded] = useState(false);

  const variants = product.variants || [];
  const variant = variants[selectedVariantIdx] || variants[0];
  if (!variant) return null;

  const price = Number(variant.price?.amount || 0);
  const currency = variant.price?.currencyCode || 'USD';
  const memberPrice = price * 0.8;
  const hasMultipleVariants = variants.length > 1;
  const mainImage = variant.image?.url || product.images?.[0]?.url;

  // Group options by name (e.g. Size, Color)
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
    if (!variant.availableForSale || justAdded) return;
    await addItem(variant.id);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  };

  const findVariantByOptions = (optionName, optionValue) => {
    const currentOptions = variant.selectedOptions?.reduce((acc, o) => {
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
    return variant.selectedOptions?.find(o => o.name === name)?.value || '';
  };

  return (
    <div className="group relative overflow-hidden rounded-xl bg-eeriecast-surface-lighter border border-white/[0.04] hover:border-white/[0.08] transition-all duration-500 flex flex-row">
      {/* Product image — left side */}
      <div
        className="relative w-28 sm:w-36 md:w-40 flex-shrink-0 overflow-hidden bg-zinc-900 cursor-pointer"
        onClick={onOpenDetail}
      >
        {mainImage ? (
          <img
            src={mainImage}
            alt={product.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-8 h-8 text-zinc-700" />
          </div>
        )}

        {/* Member discount badge */}
        {isPremium && (
          <div className="absolute top-2 left-2 flex items-center gap-0.5 bg-gradient-to-r from-amber-500/90 to-amber-600/90 backdrop-blur-sm text-white text-[8px] sm:text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full">
            <Crown className="w-2.5 h-2.5" />
            20% Off
          </div>
        )}

        {/* Out of stock overlay */}
        {!variant.availableForSale && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-white/70 text-[10px] font-semibold uppercase tracking-wider">Sold Out</span>
          </div>
        )}
      </div>

      {/* Details — right side */}
      <div className="flex-1 min-w-0 p-3 sm:p-4 flex flex-col justify-between">
        <div>
          {/* Title */}
          <h3
            className="text-white font-semibold text-sm sm:text-base leading-snug line-clamp-2 mb-1.5 cursor-pointer hover:text-zinc-300 transition-colors duration-200"
            onClick={onOpenDetail}
          >
            {product.title}
          </h3>

          {/* Description snippet */}
          {product.description && (
            <p className="text-zinc-500 text-[11px] sm:text-xs leading-relaxed line-clamp-2 mb-2.5">
              {product.description}
            </p>
          )}

          {/* Variant dropdowns */}
          {hasMultipleVariants && (
            <div className="flex items-center gap-2 flex-wrap mb-2.5">
              {Object.entries(optionGroups).map(([name, values]) => (
                <Select
                  key={name}
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
              ))}
            </div>
          )}
        </div>

        {/* Bottom row: price + add button */}
        <div className="flex items-center justify-between gap-3">
          {/* Price */}
          <div className="flex items-baseline gap-2">
            {isPremium ? (
              <>
                <span className="text-white font-bold text-sm sm:text-base">{formatPrice(memberPrice, currency)}</span>
                <span className="text-zinc-600 text-xs line-through">{formatPrice(price, currency)}</span>
              </>
            ) : (
              <span className="text-white font-bold text-sm sm:text-base">{formatPrice(price, currency)}</span>
            )}
          </div>

          {/* Add to cart */}
          <button
            onClick={handleAdd}
            disabled={!variant.availableForSale || isLoading}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-300 ${
              justAdded
                ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                : variant.availableForSale
                  ? 'bg-white/[0.06] border border-white/[0.08] text-white hover:bg-white/[0.12] hover:border-white/[0.15]'
                  : 'bg-white/[0.03] border border-white/[0.04] text-zinc-600 cursor-not-allowed'
            }`}
          >
            {justAdded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Added
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" />
                {variant.availableForSale ? 'Add to Cart' : 'Sold Out'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
