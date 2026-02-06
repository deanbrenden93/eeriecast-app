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
import { AnimatePresence, motion } from "framer-motion";

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

// Page transition variants
const pageVariants = {
    initial: {
        opacity: 0,
        y: 12,
    },
    animate: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.35,
            ease: [0.25, 0.1, 0.25, 1],
        },
    },
    exit: {
        opacity: 0,
        y: -8,
        transition: {
            duration: 0.2,
            ease: [0.25, 0.1, 0.25, 1],
        },
    },
};

// Animated route wrapper
function AnimatedPage({ children }) {
    return (
        <motion.div
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ width: '100%' }}
        >
            {children}
        </motion.div>
    );
}

function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    const { showPlayer } = useAudioPlayerContext();
    
    return (
        <Layout currentPageName={currentPage} hasPlayer={showPlayer}>
            <AnimatePresence mode="wait">
                <Routes location={location} key={location.pathname}>
                    <Route path="/" element={<AnimatedPage><Home /></AnimatedPage>} />
                    
                    <Route path="/Home" element={<AnimatedPage><Home /></AnimatedPage>} />
                    <Route path="/home" element={<AnimatedPage><Home /></AnimatedPage>} />
                    
                    <Route path="/Podcasts" element={<AnimatedPage><Podcasts /></AnimatedPage>} />
                    <Route path="/podcasts" element={<AnimatedPage><Podcasts /></AnimatedPage>} />
                    
                    <Route path="/Discover" element={<AnimatedPage><Discover /></AnimatedPage>} />
                    <Route path="/discover" element={<AnimatedPage><Discover /></AnimatedPage>} />
                    
                    <Route path="/Audiobooks" element={<AnimatedPage><Audiobooks /></AnimatedPage>} />
                    <Route path="/audiobooks" element={<AnimatedPage><Audiobooks /></AnimatedPage>} />
                    
                    <Route path="/Library" element={<AnimatedPage><Library /></AnimatedPage>} />
                    <Route path="/library" element={<AnimatedPage><Library /></AnimatedPage>} />
                    
                    <Route path="/Search" element={<AnimatedPage><Search /></AnimatedPage>} />
                    <Route path="/search" element={<AnimatedPage><Search /></AnimatedPage>} />
                    
                    <Route path="/Profile" element={<AnimatedPage><Profile /></AnimatedPage>} />
                    <Route path="/profile" element={<AnimatedPage><Profile /></AnimatedPage>} />
                    
                    <Route path="/Settings" element={<AnimatedPage><Settings /></AnimatedPage>} />
                    <Route path="/settings" element={<AnimatedPage><Settings /></AnimatedPage>} />
                    
                    <Route path="/Premium" element={<AnimatedPage><Premium /></AnimatedPage>} />
                    <Route path="/premium" element={<AnimatedPage><Premium /></AnimatedPage>} />
                    
                    <Route path="/CreatorEpisodes" element={<AnimatedPage><CreatorEpisodes /></AnimatedPage>} />
                    <Route path="/creatorepisodes" element={<AnimatedPage><CreatorEpisodes /></AnimatedPage>} />

                    <Route path="/Category" element={<AnimatedPage><Category /></AnimatedPage>} />
                    <Route path="/category" element={<AnimatedPage><Category /></AnimatedPage>} />

                    <Route path="/Episodes" element={<AnimatedPage><Episodes /></AnimatedPage>} />
                    <Route path="/episodes" element={<AnimatedPage><Episodes /></AnimatedPage>} />

                    <Route path="/Playlist" element={<AnimatedPage><Playlist /></AnimatedPage>} />
                    <Route path="/playlist" element={<AnimatedPage><Playlist /></AnimatedPage>} />
                </Routes>
            </AnimatePresence>
        </Layout>
    );
}

export default function Pages() {
    return (
        <PagesContent />
    );
}
