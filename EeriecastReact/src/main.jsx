import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { UserProvider } from '@/context/UserContext.jsx'
import { PodcastProvider } from '@/context/PodcastContext.jsx'
import { PlaylistProvider } from '@/context/PlaylistContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
    <UserProvider>
      <PodcastProvider>
        <PlaylistProvider>
          <App />
        </PlaylistProvider>
      </PodcastProvider>
    </UserProvider>
)
