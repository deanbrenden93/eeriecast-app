import Layout from "./Layout.jsx";

import Home from "./Home";

import Podcasts from "./Podcasts";

import Discover from "./Discover";

import Audiobooks from "./Audiobooks";

import Library from "./Library";

import Search from "./Search";

import Profile from "./Profile";

import Settings from "./Settings";

import Premium from "./Premium";

import CreatorEpisodes from "./CreatorEpisodes";

import Category from "./Category";

import Episodes from "./Episodes";
import Playlist from "./Playlist";

import { Route, Routes, useLocation } from 'react-router-dom';
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";

const PAGES = {
    
    Home: Home,
    
    Podcasts: Podcasts,
    
    Discover: Discover,
    
    Audiobooks: Audiobooks,
    
    Library: Library,
    
    Search: Search,
    
    Profile: Profile,
    
    Settings: Settings,
    
    Premium: Premium,
    
    CreatorEpisodes: CreatorEpisodes,

    Category: Category,

    Episodes: Episodes,

    Playlist: Playlist,

}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    const { showPlayer } = useAudioPlayerContext();
    
    return (
        <Layout currentPageName={currentPage} hasPlayer={showPlayer}>
            <Routes>
                
                    <Route path="/" element={<Home />} />
                
                
                <Route path="/Home" element={<Home />} />
                <Route path="/home" element={<Home />} />
                
                <Route path="/Podcasts" element={<Podcasts />} />
                <Route path="/podcasts" element={<Podcasts />} />
                
                <Route path="/Discover" element={<Discover />} />
                <Route path="/discover" element={<Discover />} />
                
                <Route path="/Audiobooks" element={<Audiobooks />} />
                <Route path="/audiobooks" element={<Audiobooks />} />
                
                <Route path="/Library" element={<Library />} />
                <Route path="/library" element={<Library />} />
                
                <Route path="/Search" element={<Search />} />
                <Route path="/search" element={<Search />} />
                
                <Route path="/Profile" element={<Profile />} />
                <Route path="/profile" element={<Profile />} />
                
                <Route path="/Settings" element={<Settings />} />
                <Route path="/settings" element={<Settings />} />
                
                <Route path="/Premium" element={<Premium />} />
                <Route path="/premium" element={<Premium />} />
                
                <Route path="/CreatorEpisodes" element={<CreatorEpisodes />} />
                <Route path="/creatorepisodes" element={<CreatorEpisodes />} />

                <Route path="/Category" element={<Category />} />
                <Route path="/category" element={<Category />} />

                <Route path="/Episodes" element={<Episodes />} />
                <Route path="/episodes" element={<Episodes />} />

                <Route path="/Playlist" element={<Playlist />} />
                <Route path="/playlist" element={<Playlist />} />

            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <PagesContent />
    );
}