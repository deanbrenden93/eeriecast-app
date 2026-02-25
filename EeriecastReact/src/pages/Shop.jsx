import { useState, useEffect, useMemo } from 'react';
import { fetchProducts } from '@/api/shopify';
import ProductCard from '@/components/shop/ProductCard';
import ProductModal from '@/components/shop/ProductModal';
import { useCart } from '@/context/CartContext';
import { useUser } from '@/context/UserContext.jsx';
import { ShoppingBag, Crown } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

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
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [sort, setSort] = useState('popular-desc');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const { openCart, cartCount } = useCart();
  const { isPremium } = useUser();

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchProducts();
        setProducts(data);
      } catch (err) {
        console.error('Failed to fetch products:', err);
        setError('Unable to load products. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    })();
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

        {/* Member perk banner */}
        {isPremium && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/10 to-amber-400/[0.06] border border-amber-400/15 mb-4">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-400/90 text-xs font-semibold tracking-wide">Members get 20% off everything</span>
          </div>
        )}

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
