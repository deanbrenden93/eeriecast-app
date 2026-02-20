import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import App from '@/App.jsx'
import '@/index.css'
import { UserProvider } from '@/context/UserContext.jsx'
import { PodcastProvider } from '@/context/PodcastContext.jsx'
import { PlaylistProvider } from '@/context/PlaylistContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <PodcastProvider>
          <PlaylistProvider>
            <App />
          </PlaylistProvider>
        </PodcastProvider>
      </UserProvider>
    </QueryClientProvider>
)
