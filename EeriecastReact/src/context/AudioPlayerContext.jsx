/* eslint-disable no-undef, no-unused-vars */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import MobilePlayer from '@/components/podcasts/MobilePlayer';
import ExpandedPlayer from '@/components/podcasts/ExpandedPlayer';

const AudioPlayerContext = createContext();

export const AudioPlayerProvider = ({ children }) => {
  const [showPlayer, setShowPlayer] = useState(false);
  const [showExpandedPlayer, setShowExpandedPlayer] = useState(false);
  // New: global queue across podcasts (array of { podcast, episode, resume })
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  // New: playback modes
  const [isShuffling, setIsShuffling] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off'); // 'off' | 'all' | 'one'

  // Audio player hook
  const audioPlayer = useAudioPlayer({ onEnd: () => {} });
  const {
    audioRef,
    episode,
    podcast,
    isPlaying,
    currentTime,
    duration,
    volume,
    setVolume,
    loadAndPlay,
    toggle,
    play,
    pause,
    seek,
    skip,
    setEpisode,
    setPodcast,
  } = audioPlayer;

  // Mark state setters as referenced for ESLint in environments where closures confuse the analyzer
  useEffect(() => { /* no-op to reference setQueue */ }, [setQueue]);

  // Queue helpers
  const playQueueIndex = useCallback(async (index) => {
    if (!Array.isArray(queue) || index < 0 || index >= queue.length) return;
    const item = queue[index];
    if (!item || !item.episode) return;
    setQueueIndex(index);
    await loadAndPlay({ podcast: item.podcast, episode: item.episode, resume: item.resume });
  }, [queue, loadAndPlay]);

  const setPlaybackQueue = useCallback(async (items, startIndex = 0) => {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    setQueue(list);
    if (list.length) {
      const idx = Math.min(Math.max(0, startIndex), list.length - 1);
      await playQueueIndex(idx);
      setShowPlayer(true);
    } else {
      setQueueIndex(-1);
    }
  }, [playQueueIndex]);

  // Refs for latest state/functions used in onEnded
  const queueRef = useRef(queue);
  const idxRef = useRef(queueIndex);
  const shuffleRef = useRef(isShuffling);
  const repeatRef = useRef(repeatMode);
  const loadAndPlayRef = useRef(loadAndPlay);
  // Keep refs in sync
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { idxRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { shuffleRef.current = isShuffling; }, [isShuffling]);
  useEffect(() => { repeatRef.current = repeatMode; }, [repeatMode]);
  useEffect(() => { loadAndPlayRef.current = loadAndPlay; }, [loadAndPlay]);

  const onEndedFn = useCallback(async () => {
    const list = queueRef.current || [];
    const idx = idxRef.current ?? -1;
    const shuffle = !!shuffleRef.current;
    const repeat = repeatRef.current || 'off';
    const loader = loadAndPlayRef.current;

    // Repeat current item
    if (repeat === 'one') {
      await seek(0);
      await play();
      return;
    }

    const total = list.length;
    if (total <= 0 || idx < 0) return;

    let nextIndex = -1;
    if (shuffle) {
      if (total === 1) {
        if (repeat === 'all') nextIndex = 0;
      } else {
        nextIndex = Math.floor(Math.random() * total);
        if (nextIndex === idx) nextIndex = (idx + 1) % total;
      }
    } else {
      if (idx < total - 1) nextIndex = idx + 1; else if (repeat === 'all') nextIndex = 0;
    }

    if (nextIndex >= 0 && nextIndex < total) {
      const item = list[nextIndex];
      if (item && item.episode) {
        setQueueIndex(nextIndex);
        await loader({ podcast: item.podcast, episode: item.episode, resume: item.resume });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Attach ended listener using stable onEndedFn
  useEffect(() => {
    const audio = audioRef?.current;
    if (!audio) return;
    const handler = () => { onEndedFn(); };
    audio.addEventListener('ended', handler);
    return () => {
      audio.removeEventListener('ended', handler);
    };
  }, [audioRef, onEndedFn]);

  // Show player when episode is loaded
  useEffect(() => {
    if (episode && podcast) {
      setShowPlayer(true);
    } else if (!episode) {
      setShowPlayer(false);
      setShowExpandedPlayer(false);
    }
  }, [episode, podcast]);

  const handleClosePlayer = () => {
    setShowPlayer(false);
    setShowExpandedPlayer(false);
  };

  const handleExpandPlayer = () => {
    setShowExpandedPlayer(true);
  };

  const handleCollapsePlayer = () => {
    setShowExpandedPlayer(false);
  };

  // Handlers to expose to UI
  const toggleShuffle = useCallback(() => {
    setIsShuffling((s) => !s);
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'));
  }, []);

  return (
    <AudioPlayerContext.Provider
      value={{
        episode,
        podcast,
        isPlaying,
        currentTime,
        duration,
        volume,
        setVolume,
        loadAndPlay,
        toggle,
        play,
        pause,
        seek,
        skip,
        setEpisode,
        setPodcast,
        showPlayer,
        setShowPlayer,
        showExpandedPlayer,
        setShowExpandedPlayer,
        // queue api
        queue,
        queueIndex,
        setPlaybackQueue,
        playQueueIndex,
        // playback mode api
        isShuffling,
        repeatMode,
        toggleShuffle,
        cycleRepeat,
      }}
    >
      {children}

      {/* Expanded Player - shows when user expands */}
      {showExpandedPlayer && episode && podcast && (
        <ExpandedPlayer
          podcast={podcast}
          episode={episode}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          onToggle={toggle}
          onCollapse={handleCollapsePlayer}
          onClose={handleClosePlayer}
          onSeek={seek}
          onSkip={skip}
          onPlay={play}
          onPause={pause}
          // shuffle/repeat props
          isShuffling={isShuffling}
          repeatMode={repeatMode}
          onShuffleToggle={toggleShuffle}
          onRepeatToggle={cycleRepeat}
          // queue props
          queue={queue}
          queueIndex={queueIndex}
          playQueueIndex={playQueueIndex}
          loadAndPlay={loadAndPlay}
        />
      )}

      {/* Mobile Player - shows when audio is playing and not expanded */}
      {showPlayer && !showExpandedPlayer && episode && podcast && (
        <MobilePlayer
          podcast={podcast}
          episode={episode}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          onToggle={toggle}
          onExpand={handleExpandPlayer}
          onSkip={skip}
          onSeek={seek}
          onClose={handleClosePlayer}
          onVolumeChange={setVolume}
          // queue props
          queue={queue}
          queueIndex={queueIndex}
          // playback mode props
          isShuffling={isShuffling}
          repeatMode={repeatMode}
          onShuffleToggle={toggleShuffle}
          onRepeatToggle={cycleRepeat}
        />
      )}
    </AudioPlayerContext.Provider>
  );
};

AudioPlayerProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useAudioPlayerContext = () => {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    if (typeof console !== 'undefined') {
      console.warn('useAudioPlayerContext accessed before provider mounted; returning no-op context');
    }
    const noop = () => {};
    const noopAsync = async () => {};
    return {
      episode: null,
      podcast: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 1,
      setVolume: noop,
      loadAndPlay: noopAsync,
      toggle: noop,
      play: noop,
      pause: noop,
      seek: noop,
      skip: noop,
      setEpisode: noop,
      setPodcast: noop,
      showPlayer: false,
      setShowPlayer: noop,
      showExpandedPlayer: false,
      setShowExpandedPlayer: noop,
      queue: [],
      queueIndex: -1,
      setPlaybackQueue: noopAsync,
      playQueueIndex: noopAsync,
      isShuffling: false,
      repeatMode: 'off',
      toggleShuffle: noop,
      cycleRepeat: noop,
    };
  }
  return context;
};
