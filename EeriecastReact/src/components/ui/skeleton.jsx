import { cn } from "@/lib/utils";

/**
 * Skeleton — placeholder block used for loading states.
 *
 * Renders the project's shimmer-sweep style by default (matches the
 * `cover-shimmer` family used elsewhere). Pass `variant="pulse"` to
 * fall back to the original opacity-pulse if a particular surface
 * looks better with that.
 *
 * The shimmer respects `prefers-reduced-motion` automatically (the
 * underlying CSS class drops the animation to a static block).
 */
function Skeleton({ className, variant = "shimmer", ...props }) {
  const base =
    variant === "pulse"
      ? "animate-pulse rounded-md bg-white/[0.04]"
      : "eeriecast-skeleton";
  return <div className={cn(base, className)} {...props} />;
}

export { Skeleton };
