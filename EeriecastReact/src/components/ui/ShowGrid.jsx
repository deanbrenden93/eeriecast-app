/**
 * ShowGrid - A consistent grid layout component for displaying podcasts/shows
 * Used across Discover page tabs (Podcasts, Books, Members-Only, Free)
 */
export default function ShowGrid({ children, className = "" }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4 ${className}`}>
      {children}
    </div>
  );
}

