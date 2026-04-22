import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { Category } from "@/api/entities";
import { Loader2 } from "lucide-react";
import { getCategoryStyle } from "@/lib/categoryStyles";
import { useUser } from "@/context/UserContext.jsx";

export default function CategoryExplorer() {
  const { canViewMature } = useUser() || {};

  // Shares the ['categories', 'list'] cache with Discover, so navigating
  // between pages doesn't trigger a second fetch or a loading flash.
  const { data: categoriesData = [], isLoading } = useQuery({
    queryKey: ['categories', 'list'],
    queryFn: async () => {
      const resp = await Category.list();
      return Array.isArray(resp) ? resp : (resp?.results || []);
    },
  });

  // "Mature" is an admin grouping, not a browseable category for free /
  // mature-gated users — mature shows are filtered out upstream so the tile
  // would always open to an empty list.
  const categories = useMemo(() => {
    if (canViewMature) return categoriesData;
    return categoriesData.filter((c) => {
      const slug = (c?.slug || '').toLowerCase();
      const name = (c?.name || '').toLowerCase();
      return slug !== 'mature' && name !== 'mature';
    });
  }, [categoriesData, canViewMature]);

  if (isLoading) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Explore Categories</h2>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
        </div>
      </div>
    );
  }

  if (!categories.length) return null;

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Explore Categories</h2>
      <div
        className="overflow-x-auto overflow-y-hidden -mx-1 px-1 py-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        aria-label="Categories"
      >
        <div className="flex gap-3.5 snap-x snap-mandatory">
          {categories.map((category) => {
            const label = (category.name || category.title || category.slug || '').toString();
            const slug = (category.slug || category.name || '').toString().toLowerCase();
            const style = getCategoryStyle(category);
            const Icon = style.icon;

            return (
              <Link
                key={category.id || category.slug || label}
                to={`${createPageUrl("Discover")}?tab=Categories&category=${encodeURIComponent(slug)}`}
                className="group flex-shrink-0 snap-start"
              >
                <div className={`
                  relative overflow-hidden
                  w-[8.5rem] sm:w-[9.5rem] md:w-[10.5rem]
                  bg-gradient-to-br ${style.gradient}
                  border ${style.border}
                  rounded-2xl p-4 h-[7.5rem]
                  flex flex-col items-center justify-center text-center gap-2.5
                  hover:-translate-y-1 hover:scale-[1.02]
                  transition-all duration-500 ease-out
                  cursor-pointer
                `}>
                  {/* Ambient glow behind the icon */}
                  <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-20 h-20 rounded-full ${style.iconBg} blur-2xl opacity-60 group-hover:opacity-100 group-hover:scale-125 transition-all duration-700`} />

                  {/* Icon with pill background */}
                  <div className={`relative z-10 ${style.iconBg} rounded-xl p-2.5 group-hover:scale-110 transition-transform duration-500`}>
                    <Icon className={`w-5 h-5 ${style.iconColor} group-hover:brightness-125 transition-all duration-300`} strokeWidth={1.75} />
                  </div>

                  {/* Label */}
                  <span className="relative z-10 text-white/75 group-hover:text-white text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.08em] leading-tight transition-colors duration-300">
                    {label}
                  </span>

                  {/* Subtle shimmer on hover */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
