import { Link } from 'react-router-dom';
import { Ghost, Home as HomeIcon, Search as SearchIcon, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { useSafeBack } from '@/hooks/use-safe-back';

export default function NotFound() {
  const safeGoBack = useSafeBack(createPageUrl('Home'));

  return (
    <div className="min-h-[calc(100vh-140px)] bg-black text-white flex items-center justify-center px-6 py-16">
      <div className="max-w-lg w-full text-center">
        <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/15 to-red-500/15 border border-white/10 flex items-center justify-center text-purple-300">
          <Ghost className="w-10 h-10" />
        </div>

        <p className="text-[10px] font-bold tracking-[0.25em] text-white/40 uppercase mb-3">Error 404</p>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-pink-400 to-purple-500 bg-clip-text text-transparent">
          Lost in the static
        </h1>
        <p className="text-gray-400 text-base md:text-lg mb-8 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist — or perhaps it was never there to begin with.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={safeGoBack}
            variant="outline"
            className="bg-transparent border-gray-700 text-white hover:bg-gray-800 hover:text-white rounded-full px-6 py-2 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go back
          </Button>
          <Link to={createPageUrl('Home')}>
            <Button className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-full px-6 py-2 flex items-center gap-2 w-full sm:w-auto">
              <HomeIcon className="w-4 h-4" />
              Return home
            </Button>
          </Link>
          <Link to={createPageUrl('Discover')}>
            <Button
              variant="outline"
              className="bg-transparent border-gray-700 text-white hover:bg-gray-800 hover:text-white rounded-full px-6 py-2 flex items-center gap-2 w-full sm:w-auto"
            >
              <SearchIcon className="w-4 h-4" />
              Discover shows
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
