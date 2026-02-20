import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchProducts, getCachedProducts, shopifyImageUrl } from '@/api/shopify';
import { createPageUrl } from '@/utils';
import ProductCard from '@/components/shop/ProductCard';
import ProductModal from '@/components/shop/ProductModal';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext.jsx';
import { ShoppingBag, Crown, Sparkles, ArrowRight, Star, Check } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

// ─── Featured product config ───
// Match by Shopify handle first, then fall back to title substring
const FEATURED_HANDLE = 'mourning-brew-coffee';
const FEATURED_TITLE_MATCH = 'mourning brew';

function findFeaturedProduct(products) {
  if (!products.length) return null;
  return (
    products.find(p => p.handle === FEATURED_HANDLE) ||
    products.find(p => p.title?.toLowerCase().includes(FEATURED_TITLE_MATCH)) ||
    null
  );
}

function formatPrice(amount, currency = 'USD') {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

const selectTriggerClass = "h-8 w-auto min-w-[7rem] gap-1.5 rounded-full border-white/[0.06] bg-white/[0.03] px-3.5 text-xs font-medium text-zinc-300 hover:bg-white/[0.06] hover:border-white/[0.1] hover:text-white focus:ring-0 focus:ring-offset-0 transition-all duration-300 data-[placeholder]:text-zinc-500 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-zinc-500";
const selectContentClass = "border-white/[0.08] bg-[#18181f] shadow-xl shadow-black/40 rounded-lg";
const selectItemClass = "text-xs text-zinc-400 focus:bg-white/[0.06] focus:text-white rounded-md cursor-pointer";

const sortOptions = [
  { value: 'popular-desc', label: 'Most Popular' },
  { value: 'popular-asc', label: 'Least Popular' },
  { value: 'date-desc', label: 'Newest First' },
  { value: 'date-asc', label: 'Oldest First' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
];

const availabilityOptions = [
  { value: 'all', label: 'All Products' },
  { value: 'in-stock', label: 'In Stock' },
  { value: 'sold-out', label: 'Sold Out' },
];

function isProductInStock(product) {
  return (product.variants || []).some(v => v.availableForSale);
}

function sortProducts(products, sortKey) {
  const sorted = [...products];
  switch (sortKey) {
    case 'popular-desc':
      sorted.sort((a, b) => (a.popularityRank ?? 999) - (b.popularityRank ?? 999));
      break;
    case 'popular-asc':
      sorted.sort((a, b) => (b.popularityRank ?? 0) - (a.popularityRank ?? 0));
      break;
    case 'date-desc':
      sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      break;
    case 'date-asc':
      sorted.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
      break;
    case 'price-asc':
      sorted.sort((a, b) => {
        const pa = Number(a.priceRange?.minVariantPrice?.amount || 0);
        const pb = Number(b.priceRange?.minVariantPrice?.amount || 0);
        return pa - pb;
      });
      break;
    case 'price-desc':
      sorted.sort((a, b) => {
        const pa = Number(a.priceRange?.minVariantPrice?.amount || 0);
        const pb = Number(b.priceRange?.minVariantPrice?.amount || 0);
        return pb - pa;
      });
      break;
    default:
      break;
  }
  return sorted;
}

export default function Shop() {
  // Use cached products (if available) so the page renders instantly on
  // subsequent visits. A background fetch still runs to refresh the data.
  const cached = getCachedProducts();
  const [products, setProducts] = useState(cached || []);
  const [isLoading, setIsLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [sort, setSort] = useState('popular-desc');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [featuredAdded, setFeaturedAdded] = useState(false);
  const { openCart, cartCount, addItem, isLoading: cartLoading } = useCart();
  const { isPremium } = useUser();

  useEffect(() => {
    (async () => {
      try {
        // If we have cached data, skip the loading state — products are already displayed
        if (!products.length) {
          setIsLoading(true);
        }
        setError(null);
        const data = await fetchProducts();
        setProducts(data);
      } catch (err) {
        console.error('Failed to fetch products:', err);
        // Only show the error if we have nothing to display
        if (!products.length) {
          setError('Unable to load products. Please try again later.');
        }
      } finally {
        setIsLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const productTypes = useMemo(() => {
    const types = new Set();
    for (const p of products) {
      if (p.productType) types.add(p.productType);
    }
    return [...types].sort();
  }, [products]);

  const filtered = useMemo(() => {
    let list = products;

    if (typeFilter !== 'all') {
      list = list.filter(p => p.productType === typeFilter);
    }

    if (availabilityFilter === 'in-stock') {
      list = list.filter(p => isProductInStock(p));
    } else if (availabilityFilter === 'sold-out') {
      list = list.filter(p => !isProductInStock(p));
    }

    return sortProducts(list, sort);
  }, [products, typeFilter, availabilityFilter, sort]);

  const typeOptions = useMemo(() => [
    { value: 'all', label: 'All Types' },
    ...productTypes.map(t => ({ value: t, label: t })),
  ], [productTypes]);

  const featuredProduct = useMemo(() => findFeaturedProduct(products), [products]);

  return (
    <div className="min-h-screen bg-eeriecast-surface text-white px-2.5 lg:px-10 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-baseline gap-3">
            <h1 className="text-4xl md:text-5xl font-bold text-white">Shop</h1>
            <span className="text-xs text-zinc-600 font-medium tabular-nums">
              {filtered.length} {filtered.length === 1 ? 'product' : 'products'}
            </span>
          </div>

          {/* Cart button */}
          <button
            onClick={openCart}
            className="relative flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-sm font-medium text-white hover:bg-white/[0.10] hover:border-white/[0.12] transition-all duration-300"
          >
            <ShoppingBag className="w-4 h-4" />
            Cart
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-black text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        <p className="text-zinc-500 text-lg mb-4">Official Eeriecast merchandise</p>

        {/* ── Premium Upsell Banner (non-premium users only) ── */}
        {!isPremium && (
          <Link
            to={createPageUrl('Premium')}
            className="group/promo relative flex items-center gap-4 mb-5 px-4 sm:px-5 py-3.5 rounded-2xl overflow-hidden border border-amber-400/10 hover:border-amber-400/20 transition-all duration-500 cursor-pointer"
          >
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/[0.07] via-amber-400/[0.04] to-transparent" />
            {/* Shimmer sweep on hover */}
            <div className="absolute inset-0 -translate-x-full group-hover/promo:translate-x-full transition-transform duration-1000 ease-out bg-gradient-to-r from-transparent via-amber-400/[0.06] to-transparent" />

            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-400/15 flex-shrink-0">
              <Crown className="w-5 h-5 text-amber-400" />
            </div>
            <div className="relative flex-1 min-w-0">
              <p className="text-white text-sm font-semibold leading-tight mb-0.5">
                Unlock <span className="text-amber-400">20% off</span> everything
              </p>
              <p className="text-zinc-500 text-xs leading-snug">
                Premium members save on every item in the store.
              </p>
            </div>
            <div className="relative flex items-center gap-1 text-amber-400/70 group-hover/promo:text-amber-400 transition-colors duration-300 flex-shrink-0">
              <span className="text-xs font-medium hidden sm:inline">Go Premium</span>
              <ArrowRight className="w-4 h-4 group-hover/promo:translate-x-0.5 transition-transform duration-300" />
            </div>
          </Link>
        )}

        {/* ── Member confirmation badge (premium users) ── */}
        {isPremium && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/10 to-amber-400/[0.06] border border-amber-400/15 mb-5">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-400/90 text-xs font-semibold tracking-wide">Members get 20% off everything</span>
          </div>
        )}

        {/* ── Featured Product Hero ── */}
        {featuredProduct && (() => {
          const featInStock = isProductInStock(featuredProduct);
          const featVariant = featuredProduct.variants?.[0];
          const featImgUrl = featuredProduct.images?.[0]?.url || featVariant?.image?.url;

          const handleFeaturedAdd = async (e) => {
            e.stopPropagation();
            if (!featInStock || !featVariant || featuredAdded || cartLoading) return;
            await addItem(featVariant.id);
            setFeaturedAdded(true);
            setTimeout(() => setFeaturedAdded(false), 1800);
          };

          return (
            <div
              className="group/feat relative mb-6 rounded-2xl overflow-hidden border border-white/[0.06] hover:border-white/[0.12] transition-all duration-500 cursor-pointer"
              onClick={() => setSelectedProduct(featuredProduct)}
            >
              {/* Background: blurred product image */}
              {featImgUrl && (
                <div className="absolute inset-0">
                  <img
                    src={shopifyImageUrl(featImgUrl, 600)}
                    alt=""
                    aria-hidden="true"
                    decoding="async"
                    className="w-full h-full object-cover scale-110 blur-2xl opacity-20"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f17]/95 via-[#0f0f17]/80 to-[#0f0f17]/60" />
                </div>
              )}

              <div className="relative flex flex-col sm:flex-row items-center gap-5 p-5 sm:p-6">
                {/* Product image */}
                <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-xl overflow-hidden flex-shrink-0 shadow-2xl shadow-black/50 ring-1 ring-white/[0.08] group-hover/feat:ring-white/[0.15] transition-all duration-500">
                  {featImgUrl ? (
                    <img
                      src={shopifyImageUrl(featImgUrl, 400)}
                      alt={featuredProduct.title}
                      decoding="async"
                      className={`w-full h-full object-cover group-hover/feat:scale-[1.04] transition-transform duration-700 ${!featInStock ? 'grayscale brightness-50' : ''}`}
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                      <ShoppingBag className="w-10 h-10 text-zinc-700" />
                    </div>
                  )}

                  {/* Sold Out overlay on image */}
                  {!featInStock && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <span className="text-white/90 text-lg font-extrabold uppercase tracking-widest drop-shadow-lg -rotate-12">
                        Sold Out
                      </span>
                    </div>
                  )}

                  {/* Featured badge over image */}
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-amber-400 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-amber-400/20">
                    <Star className="w-2.5 h-2.5 fill-amber-400" />
                    Featured
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400/60" />
                    <span className="text-[10px] text-amber-400/60 font-semibold uppercase tracking-[0.15em]">Featured Product</span>
                  </div>

                  <h2 className="text-white text-xl sm:text-2xl font-bold leading-tight mb-2 group-hover/feat:text-zinc-200 transition-colors duration-300">
                    {featuredProduct.title}
                  </h2>

                  {featuredProduct.description && (
                    <p className="text-zinc-400 text-sm leading-relaxed line-clamp-2 mb-3">
                      {featuredProduct.description}
                    </p>
                  )}

                  {/* Price row */}
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-3">
                    {(() => {
                      const p = Number(featVariant?.price?.amount || 0);
                      const cur = featVariant?.price?.currencyCode || 'USD';
                      return (
                        <span className={`font-bold text-lg ${featInStock ? 'text-white' : 'text-zinc-500'}`}>
                          {isPremium ? formatPrice(p * 0.8, cur) : formatPrice(p, cur)}
                        </span>
                      );
                    })()}
                    {isPremium && featInStock && (
                      <span className="text-zinc-600 text-xs line-through">
                        {formatPrice(Number(featVariant?.price?.amount || 0), featVariant?.price?.currencyCode || 'USD')}
                      </span>
                    )}
                    {!featInStock && (
                      <span className="text-red-400/80 text-xs font-semibold uppercase tracking-wide">Sold Out</span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-center sm:justify-start gap-2.5">
                    {/* Add to Cart / Sold Out button */}
                    <button
                      type="button"
                      onClick={handleFeaturedAdd}
                      disabled={!featInStock || cartLoading}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
                        featuredAdded
                          ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                          : featInStock
                            ? 'bg-white text-black hover:bg-zinc-200 active:scale-[0.97]'
                            : 'bg-white/[0.04] border border-white/[0.06] text-zinc-600 cursor-not-allowed'
                      }`}
                    >
                      {featuredAdded ? (
                        <>
                          <Check className="w-4 h-4" />
                          Added to Cart
                        </>
                      ) : featInStock ? (
                        <>
                          <ShoppingBag className="w-4 h-4" />
                          Add to Cart
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="w-4 h-4" />
                          Sold Out
                        </>
                      )}
                    </button>

                    {/* View Product (secondary) */}
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/70 text-xs font-medium hover:bg-white/[0.10] hover:text-white group-hover/feat:bg-white/[0.08] transition-all duration-300">
                      View Details
                      <ArrowRight className="w-3 h-3 group-hover/feat:translate-x-0.5 transition-transform duration-300" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Filters + Sort */}
        <div className="flex items-center gap-2 flex-wrap">
          {productTypes.length > 1 && (
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className={selectContentClass}>
                {typeOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className={selectItemClass}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue placeholder="Availability" />
            </SelectTrigger>
            <SelectContent className={selectContentClass}>
              {availabilityOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className={selectItemClass}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className={selectTriggerClass}>
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent className={selectContentClass}>
              {sortOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className={selectItemClass}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Products */}
      <div className="pb-32">
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-eeriecast-surface-light/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4 mx-auto">
              <ShoppingBag className="w-7 h-7 text-zinc-600" />
            </div>
            <p className="text-zinc-400 text-sm">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">No products found.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {filtered.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onOpenDetail={() => setSelectedProduct(product)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Product detail modal */}
      <ProductModal
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
}
