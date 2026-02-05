// player.js - Enhanced Audio Player System for EerieCast
// Version 1.6 - Fixed race conditions and audio loading issues

class EerieCastPlayer {
  constructor() {
    this.audio = new Audio();
    this.currentTrack = null;
    this.queue = [];
    this.currentIndex = 0;
    this.isPlaying = false;
    this.isShuffle = false;
    this.repeatMode = 'none'; // none, one, all
    this.volume = 0.7;
    this.sleepTimer = null;
    this.sleepTimerDuration = 0;
    this.sleepTimerEndTime = null;
    this.sleepTimerInterval = null;
    this.comments = [];
    this.favorites = new Set();
    this.trackPositions = new Map(); // Store playback positions
    this.showDescription = false;
    this.networkRatings = {}; // Store network ratings
    this.showRatingsPopup = false;

    // Track readiness state
    this.trackReady = false;
    this.currentLoadHandler = null;
    this.currentErrorHandler = null;

    // Playlist management
    this.playlists = [];
    this.currentEpisodeToAdd = null;
    this.selectedPlaylists = new Set();

    // Swipe animation state
    this.swipeState = {
      isSwping: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      deltaX: 0,
      deltaY: 0,
      threshold: 75,
      verticalThreshold: 100,
      animating: false,
      swipeableContainer: null,
      trackContentWrapper: null,
      currentTrackContent: null,
      nextTrackContent: null,
      prevTrackContent: null,
    };

    // User data persistence
    this.USER_DATA_KEY = 'eeriecast_user_data';
    this.TRACK_POSITIONS_KEY = 'eeriecast_track_positions';
    this.FAVORITES_KEY = 'eeriecast_favorites';
    this.FAVORITES_DATA_KEY = 'eeriecast_favorites_data';

    // R2 base URL for cover art fallbacks
    this.R2_BASE_URL = 'https://pub-2e6cf8f453bb4686ba256e6a8cc76b07.r2.dev';

    // Initialize mini player
    this.miniPlayer = new MiniPlayer();

    // Define icon SVGs
    this.iconSVGs = {
      play: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
      pause:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>',
      next: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M5 18l10-6L5 6v12zm11-12v12h2V6h-2z"/></svg>',
      prev: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z"/></svg>',
      shuffle:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
      repeat:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
      heart:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
      heartFilled:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
      queue:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h10"/></svg>',
      close:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>',
      chevronDown:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>',
      headphones:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>',
      user: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      moreVertical:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
      info: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
      clock:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      volumeLow:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/></svg>',
      volumeHigh:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
      rating:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="15" x2="15" y2="15"/></svg>',
      forward10:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><text x="12" y="12" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="600" font-family="system-ui, -apple-system, sans-serif">+10</text></svg>',
      backward10:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><text x="12" y="12" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="600" font-family="system-ui, -apple-system, sans-serif">-10</text></svg>',
      download:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    };

    this.init();
  }

  async init() {
    // Load persisted data FIRST before anything else
    this.loadPersistedData();

    // Ensure window.userData is available globally
    if (!window.userData) {
      window.userData = {
        listeningHistory: {},
        episodesPlayed: 0,
        timeListened: 0,
        favoriteShow: null,
        favoritedEpisodes: [],
        playlists: [],
        userId: null,
      };
    }

    // Generate or retrieve user ID
    if (!window.userData.userId) {
      // Generate anonymous user ID
      window.userData.userId =
        'user-' + Math.random().toString(36).substr(2, 9);
      this.saveUserData();
    }

    // Load playlists
    this.loadPlaylists();

    // Fetch network ratings on startup
    await this.fetchNetworkRatings();

    this.injectStyles();
    this.createPlayerElements(); // Create elements FIRST
    this.setupEventListeners();
    this.setupMiniPlayerCallbacks();

    // Start with mini player hidden
    this.miniPlayer.hide();

    // Set initial volume
    this.audio.volume = this.volume;

    // Initialize with empty queue - no demo data
    this.updateQueueDisplay();
    this.updatePlayerDisplay();

    // Try to restore last playing track AFTER elements exist
    try {
      const lastPlayingTrack = localStorage.getItem('eeriecast_last_playing');
      if (lastPlayingTrack) {
        const track = JSON.parse(lastPlayingTrack);

        // Restore the track but don't auto-play
        this.queue = [track];
        this.currentIndex = 0;
        this.currentTrack = track;

        // Ensure ID is string
        if (this.currentTrack) {
          this.currentTrack.id = String(this.currentTrack.id);
        }

        // Actually load the track into the audio element
        if (track.src) {
          this.audio.src = track.src;

          // Set up load handler to restore position
          const loadHandler = () => {
            const trackId = String(track.id);
            const savedPosition = this.trackPositions.get(trackId);
            if (
              savedPosition &&
              savedPosition > 0 &&
              savedPosition < this.audio.duration
            ) {
              this.audio.currentTime = savedPosition;
              console.log('Restored position:', savedPosition);
            }
            this.audio.removeEventListener('loadeddata', loadHandler);
          };

          this.audio.addEventListener('loadeddata', loadHandler);

          // Load the audio
          this.audio.load();
        }

        // Update displays
        this.updatePlayerDisplay();
        this.updateQueueDisplay();
        this.updateLikeButton();
        this.updateCoverArt();
        this.updateRatingDisplay();
        this.updateSwipeableUI();

        // Show mini player in paused state
        setTimeout(() => {
          this.showMiniPlayer();
          console.log('Restored last playing track:', track.title);
        }, 500);
      }
    } catch (e) {
      console.error('Failed to restore last playing track:', e);
      localStorage.removeItem('eeriecast_last_playing');
    }
  }

  // Add this after the init() method, around line 140
  async trackEpisodePlay() {
    if (!this.currentTrack) return;

    try {
      await fetch(
        `${
          window.API_BASE_URL || 'https://eeriecast-api.brenden-6ce.workers.dev'
        }/api/track/play`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            episodeId: this.currentTrack.id,
            userId: window.userData?.userId || null,
            timestamp: Math.floor(Date.now() / 1000),
          }),
        }
      );
    } catch (error) {
      console.error('Failed to track play:', error);
    }
  }

  async trackProgress() {
    if (!this.currentTrack || !this.audio.duration) return;

    const progress = (this.audio.currentTime / this.audio.duration) * 100;

    try {
      await fetch(
        `${
          window.API_BASE_URL || 'https://eeriecast-api.brenden-6ce.workers.dev'
        }/api/track/progress`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            episodeId: this.currentTrack.id,
            userId: window.userData?.userId || null,
            progress: progress,
            duration: Math.floor(this.audio.currentTime),
          }),
        }
      );
    } catch (error) {
      console.error('Failed to track progress:', error);
    }
  }

  async trackComplete() {
    if (!this.currentTrack) return;

    try {
      await fetch(
        `${
          window.API_BASE_URL || 'https://eeriecast-api.brenden-6ce.workers.dev'
        }/api/track/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            episodeId: this.currentTrack.id,
            userId: window.userData?.userId || null,
          }),
        }
      );
    } catch (error) {
      console.error('Failed to track completion:', error);
    }
  }

  async fetchNetworkRatings() {
    try {
      const response = await fetch(
        `${
          window.API_BASE_URL || 'https://eeriecast-api.brenden-6ce.workers.dev'
        }/api/ratings`
      );
      if (response.ok) {
        const data = await response.json();
        this.networkRatings = data.ratings || {};
        console.log('Loaded network ratings:', this.networkRatings);
      } else {
        console.error('Failed to fetch network ratings:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch network ratings:', error);
    }
  }

  // Load persisted user data
  loadPersistedData() {
    try {
      // Load user data
      const savedUserData = localStorage.getItem(this.USER_DATA_KEY);
      if (savedUserData) {
        window.userData = JSON.parse(savedUserData);
      } else {
        // Initialize if not exists
        window.userData = {
          listeningHistory: {},
          episodesPlayed: 0,
          timeListened: 0,
          favoriteShow: null,
          favoritedEpisodes: [],
          playlists: [],
        };
      }

      // Load track positions
      const savedPositions = localStorage.getItem(this.TRACK_POSITIONS_KEY);
      if (savedPositions) {
        const positions = JSON.parse(savedPositions);
        this.trackPositions = new Map();
        // Ensure all keys are strings
        Object.entries(positions).forEach(([key, value]) => {
          this.trackPositions.set(String(key), value);
        });
      }

      // Load favorites IDs
      const savedFavorites = localStorage.getItem(this.FAVORITES_KEY);
      if (savedFavorites) {
        const favArray = JSON.parse(savedFavorites);
        // Ensure all IDs are strings
        this.favorites = new Set(favArray.map(id => String(id)));
      }

      // Load full favorites data
      const savedFavoritesData = localStorage.getItem(this.FAVORITES_DATA_KEY);
      if (savedFavoritesData) {
        window.userData.favoritedEpisodes = JSON.parse(savedFavoritesData);
      } else if (window.userData.favoritedEpisodes) {
        // Ensure it's an array
        if (!Array.isArray(window.userData.favoritedEpisodes)) {
          window.userData.favoritedEpisodes = [];
        }
      }
    } catch (error) {
      console.error('Error loading persisted data:', error);
    }
  }

  loadPlaylists() {
    this.playlists = window.userData?.playlists || [];

    // Ensure all playlists have necessary properties
    this.playlists.forEach(playlist => {
      if (!playlist.episodes) playlist.episodes = [];
      if (!playlist.color)
        playlist.color = [
          '#ff0040',
          '#9d00ff',
          '#60a5fa',
          '#10b981',
          '#f59e0b',
        ][Math.floor(Math.random() * 5)];
    });

    // Sort playlists alphabetically
    this.playlists.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Save user data to localStorage
  saveUserData() {
    try {
      localStorage.setItem(this.USER_DATA_KEY, JSON.stringify(window.userData));
    } catch (error) {
      console.error('Error saving user data:', error);
    }
  }

  // Save track positions to localStorage
  saveTrackPositions() {
    try {
      const positions = {};
      this.trackPositions.forEach((value, key) => {
        positions[String(key)] = value;
      });
      localStorage.setItem(this.TRACK_POSITIONS_KEY, JSON.stringify(positions));
    } catch (error) {
      console.error('Error saving track positions:', error);
    }
  }

  // Save favorites to localStorage
  saveFavorites() {
    try {
      const favoritesArray = Array.from(this.favorites);
      localStorage.setItem(this.FAVORITES_KEY, JSON.stringify(favoritesArray));

      // Also save the full favorites data
      localStorage.setItem(
        this.FAVORITES_DATA_KEY,
        JSON.stringify(window.userData.favoritedEpisodes)
      );

      // Save userData
      this.saveUserData();

      // Dispatch event for other components
      window.dispatchEvent(
        new CustomEvent('favoritesUpdated', {
          detail: { favorites: favoritesArray },
        })
      );
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  }

  injectStyles() {
    // Load the external CSS file
    if (!document.getElementById('player-styles')) {
      const link = document.createElement('link');
      link.id = 'player-styles';
      link.rel = 'stylesheet';
      link.href = '/styles/player.css';
      document.head.appendChild(link);
    }
  }

  createPlayerElements() {
    // Create expanded player with new swipeable structure
    const expandedPlayer = document.createElement('div');
    expandedPlayer.className = 'player-expanded';
    expandedPlayer.innerHTML = `
            <div class="player-expanded-header">
                <button class="player-close"><span class="icon">${this.iconSVGs.close}</span></button>
                <div style="font-size: 16px; font-weight: 600; letter-spacing: 1px; opacity: 0.8;">NOW PLAYING</div>
                <button class="player-queue-button">
                    <span class="icon">${this.iconSVGs.queue}</span>
                    <span class="queue-count">0</span>
                </button>
            </div>
            <div class="player-expanded-content">
                <div class="swipeable-track-container">
                    <div class="track-content-wrapper">
                        <!-- Current track content -->
                        <div class="track-content current" data-track-state="current">
                            <div class="player-cover-large">
                                <button class="player-like-overlay"><span class="icon">${this.iconSVGs.heart}</span></button>
                                <button class="player-playlist-overlay">+</button>
                                <div class="player-cover-gradient"><span class="icon" style="font-size: 80px;">${this.iconSVGs.headphones}</span></div>
                            </div>
                            <div class="player-info-large">
                                <div class="player-show-name">Select a podcast to start</div>
                                <div class="player-episode-title">No track playing</div>
                            </div>
                        </div>
                        <!-- Next track content (pre-loaded for smooth animation) -->
                        <div class="track-content next" data-track-state="next">
                            <div class="player-cover-large">
                                <button class="player-like-overlay"><span class="icon">${this.iconSVGs.heart}</span></button>
                                <button class="player-playlist-overlay">+</button>
                                <div class="player-cover-gradient"><span class="icon" style="font-size: 80px;">${this.iconSVGs.headphones}</span></div>
                            </div>
                            <div class="player-info-large">
                                <div class="player-show-name">--</div>
                                <div class="player-episode-title">--</div>
                            </div>
                        </div>
                        <!-- Previous track content (pre-loaded for smooth animation) -->
                        <div class="track-content prev" data-track-state="prev">
                            <div class="player-cover-large">
                                <button class="player-like-overlay"><span class="icon">${this.iconSVGs.heart}</span></button>
                                <button class="player-playlist-overlay">+</button>
                                <div class="player-cover-gradient"><span class="icon" style="font-size: 80px;">${this.iconSVGs.headphones}</span></div>
                            </div>
                            <div class="player-info-large">
                                <div class="player-show-name">--</div>
                                <div class="player-episode-title">--</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="player-controls-section">
                    <div class="player-action-buttons">
                        <button class="rating-badge" style="display: none;">
                            <span class="icon" style="font-size: 16px;">${this.iconSVGs.rating}</span>
                            <span class="rating-text">--</span>
                        </button>
                        <button class="episode-description-toggle-btn">
                            <span class="icon" style="font-size: 16px;">${this.iconSVGs.info}</span>
                            <span>About</span>
                        </button>
                        <button class="episode-download-btn">
                            <span class="icon" style="font-size: 16px;">${this.iconSVGs.download}</span>
                            <span>Download</span>
                        </button>
                        <button class="sleep-timer-indicator" style="display: none;">
                            <span class="icon" style="font-size: 16px;">${this.iconSVGs.clock}</span>
                            <span class="sleep-timer-remaining">15:00</span>
                        </button>
                        <button class="more-options-btn">
                            <span class="icon">${this.iconSVGs.moreVertical}</span>
                        </button>
                    </div>
                    <div class="player-controls-large">
                        <button class="player-control-large shuffle-btn"><span class="icon">${this.iconSVGs.shuffle}</span></button>
                        <button class="player-control-large seek-btn backward-btn">
                            <span class="icon">${this.iconSVGs.backward10}</span>
                        </button>
                        <button class="player-control-large prev-btn"><span class="icon">${this.iconSVGs.prev}</span></button>
                        <button class="player-control-large play-pause play-btn"><span class="icon">${this.iconSVGs.play}</span></button>
                        <button class="player-control-large next-btn"><span class="icon">${this.iconSVGs.next}</span></button>
                        <button class="player-control-large seek-btn forward-btn">
                            <span class="icon">${this.iconSVGs.forward10}</span>
                        </button>
                        <button class="player-control-large repeat-btn"><span class="icon">${this.iconSVGs.repeat}</span></button>
                    </div>
                    <div class="player-waveform-section">
                        <div class="player-time-large">
                            <span class="time-current">0:00</span>
                            <span class="time-total">0:00</span>
                        </div>
                        <div class="waveform-container" id="waveform-container">
                            <div class="waveform-wave" id="waveform-wave"></div>
                            <div class="waveform-played" id="waveform-played"></div>
                            <div class="progress-indicator" id="progress-indicator"></div>
                        </div>
                    </div>
                </div>
                <div class="comments-section">
                    <div class="comments-header">
                        <h2 class="comments-title">Comments</h2>
                        <span class="comments-count">0 comments</span>
                    </div>
                    <div class="comment-form">
                        <textarea class="comment-input" placeholder="Share your thoughts about this episode..."></textarea>
                        <button class="comment-submit">Post Comment</button>
                    </div>
                    <div class="comments-list"></div>
                </div>
            </div>
        `;
    document.body.appendChild(expandedPlayer);

    // Create episode description modal
    const episodeDescriptionModal = document.createElement('div');
    episodeDescriptionModal.className = 'episode-description-modal';
    episodeDescriptionModal.innerHTML = `
            <div class="episode-description">
                <div class="episode-description-header">
                    <h3>About This Episode</h3>
                    <button class="episode-description-close"><span class="icon">${this.iconSVGs.close}</span></button>
                </div>
                <div class="episode-description-content">
                    <p>No description available for this episode.</p>
                </div>
            </div>
        `;
    document.body.appendChild(episodeDescriptionModal);

    // Create ratings popup
    const ratingsPopup = document.createElement('div');
    ratingsPopup.className = 'ratings-popup';
    ratingsPopup.innerHTML = `
            <div class="ratings-content">
                <div class="ratings-header">
                    <h3 class="ratings-title">Content Rating</h3>
                    <button class="ratings-close"><span class="icon">${this.iconSVGs.close}</span></button>
                </div>
                <div class="rating-display">
                    <div class="rating-large">--</div>
                    <div class="rating-description">Not Rated</div>
                </div>
                <div class="content-warnings"></div>
            </div>
        `;
    document.body.appendChild(ratingsPopup);

    // Create additional controls popup
    const additionalControlsPopup = document.createElement('div');
    additionalControlsPopup.className = 'additional-controls-popup';
    additionalControlsPopup.innerHTML = `
            <div class="additional-controls-content">
                <div class="additional-controls-header">
                    <h3 class="additional-controls-title">Playback Options</h3>
                    <button class="additional-controls-close"><span class="icon">${this.iconSVGs.close}</span></button>
                </div>
                <div class="additional-controls-grid">
                    <div class="control-group">
                        <div class="control-group-label">Speed</div>
                        <div class="speed-control">
                            <button class="speed-button speed-down">−</button>
                            <div class="speed-display">1.0x</div>
                            <button class="speed-button speed-up">+</button>
                        </div>
                    </div>
                    <div class="control-group">
                        <div class="control-group-label">Sleep Timer</div>
                        <div class="control-group-buttons">
                            <button class="control-button sleep-15">15m</button>
                            <button class="control-button sleep-30">30m</button>
                            <button class="control-button sleep-60">1h</button>
                            <button class="control-button sleep-off active">Off</button>
                        </div>
                    </div>
                    <div class="control-group">
                        <div class="control-group-label">Volume</div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="volume-icon icon">${this.iconSVGs.volumeLow}</span>
                            <div class="volume-slider" style="width: 150px; height: 6px; background: rgba(255,255,255,0.1); border-radius: 10px; cursor: pointer;">
                                <div class="volume-fill" style="width: 70%; height: 100%; background: linear-gradient(90deg, var(--accent-primary), var(--accent-purple)); border-radius: 10px;"></div>
                            </div>
                            <span class="volume-icon icon">${this.iconSVGs.volumeHigh}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    document.body.appendChild(additionalControlsPopup);

    // Create queue panel
    const queuePanel = document.createElement('div');
    queuePanel.className = 'queue-panel';
    queuePanel.innerHTML = `
            <div class="queue-header">
                <h2 class="queue-title">Up Next</h2>
                <button class="queue-close"><span class="icon">${this.iconSVGs.close}</span></button>
            </div>
            <div class="queue-list"></div>
        `;
    document.body.appendChild(queuePanel);

    // Create Add to Playlist Popup
    const addPlaylistPopup = document.createElement('div');
    addPlaylistPopup.className = 'add-to-playlist-popup';
    addPlaylistPopup.id = 'add-to-playlist-popup';
    addPlaylistPopup.innerHTML = `
            <div class="add-to-playlist-content">
                <div class="add-to-playlist-header">
                    <h3 class="add-to-playlist-title">Add to Playlist</h3>
                    <button class="add-to-playlist-close" id="close-playlist-popup">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                
                <div class="playlist-selection-list" id="playlist-selection-list">
                    <!-- Playlists will be dynamically inserted here -->
                </div>
                
                <button class="create-new-playlist-btn" id="create-playlist-from-popup">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Create New Playlist
                </button>
                
                <div class="add-to-playlist-actions">
                    <button class="add-to-playlist-cancel" id="cancel-playlist-add">Cancel</button>
                    <button class="add-to-playlist-confirm" id="confirm-playlist-add" disabled>Add to Playlist</button>
                </div>
            </div>
        `;
    document.body.appendChild(addPlaylistPopup);

    // Store references
    this.expandedPlayer = expandedPlayer;
    this.episodeDescriptionModal = episodeDescriptionModal;
    this.ratingsPopup = ratingsPopup;
    this.additionalControlsPopup = additionalControlsPopup;
    this.queuePanel = queuePanel;
    this.addPlaylistPopup = addPlaylistPopup;

    // Store waveform references
    this.waveformContainer = this.expandedPlayer.querySelector(
      '#waveform-container'
    );
    this.waveformWave = this.expandedPlayer.querySelector('#waveform-wave');
    this.waveformPlayed = this.expandedPlayer.querySelector('#waveform-played');
    this.progressIndicator = this.expandedPlayer.querySelector(
      '#progress-indicator'
    );

    // Store swipeable container references
    this.swipeState.swipeableContainer = this.expandedPlayer.querySelector(
      '.swipeable-track-container'
    );
    this.swipeState.trackContentWrapper = this.expandedPlayer.querySelector(
      '.track-content-wrapper'
    );
    this.swipeState.currentTrackContent = this.expandedPlayer.querySelector(
      '.track-content.current'
    );
    this.swipeState.nextTrackContent = this.expandedPlayer.querySelector(
      '.track-content.next'
    );
    this.swipeState.prevTrackContent = this.expandedPlayer.querySelector(
      '.track-content.prev'
    );
  }

  setupMiniPlayerCallbacks() {
    // Set up callbacks for mini player
    this.miniPlayer.onPlayPause = () => this.togglePlay();
    this.miniPlayer.onNext = () => this.playNext();
    this.miniPlayer.onPrev = () => this.playPrevious();
    this.miniPlayer.onShuffle = () => this.toggleShuffle();
    this.miniPlayer.onRepeat = () => this.toggleRepeat();
    this.miniPlayer.onSeek = percent => {
      const time = percent * this.audio.duration;
      if (!isNaN(time)) {
        this.audio.currentTime = time;
        this.saveTrackPosition();
      }
    };
    this.miniPlayer.onVolumeChange = percent => this.setVolume(percent);
    this.miniPlayer.onExpand = () => this.openExpandedPlayer();
    this.miniPlayer.onClose = () => this.hideMiniPlayer();
    this.miniPlayer.onQueueClick = () => {
      this.openExpandedPlayer();
      setTimeout(() => this.toggleQueue(), 300);
    };
  }

  setupEventListeners() {
    // Expanded player controls
    const expandedPlayBtn = this.expandedPlayer.querySelector('.play-btn');
    const expandedPrevBtn = this.expandedPlayer.querySelector('.prev-btn');
    const expandedNextBtn = this.expandedPlayer.querySelector('.next-btn');
    const expandedShuffleBtn =
      this.expandedPlayer.querySelector('.shuffle-btn');
    const expandedRepeatBtn = this.expandedPlayer.querySelector('.repeat-btn');
    const expandedCloseBtn = this.expandedPlayer.querySelector('.player-close');
    const expandedQueueBtn = this.expandedPlayer.querySelector(
      '.player-queue-button'
    );
    const descriptionToggleBtn = this.expandedPlayer.querySelector(
      '.episode-description-toggle-btn'
    );
    const descriptionCloseBtn = this.episodeDescriptionModal.querySelector(
      '.episode-description-close'
    );
    const moreOptionsBtn =
      this.expandedPlayer.querySelector('.more-options-btn');
    const sleepTimerIndicator = this.expandedPlayer.querySelector(
      '.sleep-timer-indicator'
    );
    const additionalControlsClose = this.additionalControlsPopup.querySelector(
      '.additional-controls-close'
    );
    const ratingBadge = this.expandedPlayer.querySelector('.rating-badge');
    const ratingsClose = this.ratingsPopup.querySelector('.ratings-close');
    const downloadBtn = this.expandedPlayer.querySelector(
      '.episode-download-btn'
    );

    // Seek buttons
    const backwardBtn = this.expandedPlayer.querySelector('.backward-btn');
    const forwardBtn = this.expandedPlayer.querySelector('.forward-btn');

    expandedPlayBtn.addEventListener('click', () => this.togglePlay());
    expandedPrevBtn.addEventListener('click', () => this.playPrevious());
    expandedNextBtn.addEventListener('click', () => this.playNext());
    expandedShuffleBtn.addEventListener('click', () => this.toggleShuffle());
    expandedRepeatBtn.addEventListener('click', () => this.toggleRepeat());
    expandedCloseBtn.addEventListener('click', () =>
      this.closeExpandedPlayer()
    );
    expandedQueueBtn.addEventListener('click', () => this.toggleQueue());

    // Seek controls
    backwardBtn.addEventListener('click', () => this.seekRelative(-10));
    forwardBtn.addEventListener('click', () => this.seekRelative(10));

    // Download button (placeholder functionality)
    downloadBtn.addEventListener('click', () => this.handleDownload());

    // New popup controls
    descriptionToggleBtn.addEventListener('click', () =>
      this.toggleDescription()
    );
    descriptionCloseBtn.addEventListener('click', () =>
      this.closeDescription()
    );
    moreOptionsBtn.addEventListener('click', () =>
      this.openAdditionalControls()
    );
    sleepTimerIndicator.addEventListener('click', () =>
      this.openAdditionalControls()
    );
    additionalControlsClose.addEventListener('click', () =>
      this.closeAdditionalControls()
    );
    ratingBadge.addEventListener('click', () => this.toggleRatingsPopup());
    ratingsClose.addEventListener('click', () => this.closeRatingsPopup());

    // Click outside to close popups
    this.additionalControlsPopup.addEventListener('click', e => {
      if (e.target === this.additionalControlsPopup) {
        this.closeAdditionalControls();
      }
    });

    this.episodeDescriptionModal.addEventListener('click', e => {
      if (e.target === this.episodeDescriptionModal) {
        this.closeDescription();
      }
    });

    this.ratingsPopup.addEventListener('click', e => {
      if (e.target === this.ratingsPopup) {
        this.closeRatingsPopup();
      }
    });

    // Waveform interaction (replacing old progress bar)
    if (this.waveformContainer) {
      this.waveformContainer.addEventListener('click', e =>
        this.seekFromWaveformClick(e)
      );
    }

    // Speed controls
    const speedDown = this.additionalControlsPopup.querySelector('.speed-down');
    const speedUp = this.additionalControlsPopup.querySelector('.speed-up');
    speedDown.addEventListener('click', () => this.changeSpeed(-0.25));
    speedUp.addEventListener('click', () => this.changeSpeed(0.25));

    // Sleep timer
    const sleep15 = this.additionalControlsPopup.querySelector('.sleep-15');
    const sleep30 = this.additionalControlsPopup.querySelector('.sleep-30');
    const sleep60 = this.additionalControlsPopup.querySelector('.sleep-60');
    const sleepOff = this.additionalControlsPopup.querySelector('.sleep-off');

    sleep15.addEventListener('click', () => this.setSleepTimer(15));
    sleep30.addEventListener('click', () => this.setSleepTimer(30));
    sleep60.addEventListener('click', () => this.setSleepTimer(60));
    sleepOff.addEventListener('click', () => this.cancelSleepTimer());

    // Volume control in popup
    const expandedVolumeSlider =
      this.additionalControlsPopup.querySelector('.volume-slider');
    expandedVolumeSlider.addEventListener('click', e =>
      this.setVolumeFromClick(e, expandedVolumeSlider)
    );

    // Comments
    const commentSubmit = this.expandedPlayer.querySelector('.comment-submit');
    const commentInput = this.expandedPlayer.querySelector('.comment-input');
    commentSubmit.addEventListener('click', () => {
      const text = commentInput.value.trim();
      if (text) {
        this.addComment(text);
        commentInput.value = '';
      }
    });

    // Queue panel
    const queueClose = this.queuePanel.querySelector('.queue-close');
    queueClose.addEventListener('click', () => this.closeQueue());

    // Setup playlist popup listeners
    this.setupPlaylistPopupListeners();

    // Add enhanced swipe gesture support
    this.setupEnhancedSwipeGestures();

    // Setup delegated event listeners for dynamic elements
    this.setupDelegatedListeners();

    // Audio events
    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
    this.audio.addEventListener('ended', () => this.handleTrackEnd());
    this.audio.addEventListener('play', () => {
      this.updatePlayState(true);
      // Start tracking progress immediately
      this.saveTrackPosition();
    });
    this.audio.addEventListener('pause', () => this.updatePlayState(false));

    // Save position periodically
    setInterval(() => {
      if (
        this.currentTrack &&
        !this.audio.paused &&
        !isNaN(this.audio.duration)
      ) {
        this.saveTrackPosition();
      }
    }, 5000);

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')
        return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          this.togglePlay();
          break;
        case 'ArrowLeft':
          this.seekRelative(-10);
          break;
        case 'ArrowRight':
          this.seekRelative(10);
          break;
        case 'ArrowUp':
          this.changeVolume(0.1);
          break;
        case 'ArrowDown':
          this.changeVolume(-0.1);
          break;
        case 'l':
          this.toggleLike();
          break;
        case 'm':
          // Toggle mini player visibility
          if (this.miniPlayer.miniPlayer.classList.contains('hidden')) {
            this.showMiniPlayer();
          } else {
            this.hideMiniPlayer();
          }
          break;
      }
    });
  }

  setupDelegatedListeners() {
    // Setup delegated event listeners for dynamically created elements
    this.expandedPlayer.addEventListener('click', e => {
      // Handle like button clicks
      if (e.target.closest('.player-like-overlay')) {
        this.toggleLike();
      }
      // Handle playlist button clicks
      else if (e.target.closest('.player-playlist-overlay')) {
        this.openAddToPlaylistPopup();
      }
    });
  }

  setupEnhancedSwipeGestures() {
    const container = this.swipeState.swipeableContainer;
    if (!container) return;

    // Touch event handlers
    container.addEventListener('touchstart', e => this.handleTouchStart(e), {
      passive: true,
    });
    container.addEventListener('touchmove', e => this.handleTouchMove(e), {
      passive: true,
    });
    container.addEventListener('touchend', e => this.handleTouchEnd(e), {
      passive: true,
    });
    container.addEventListener('touchcancel', e => this.handleTouchCancel(e), {
      passive: true,
    });
  }

  handleTouchStart(e) {
    if (this.swipeState.animating || this.queue.length <= 1) return;

    this.swipeState.isSwping = true;
    this.swipeState.startX = e.touches[0].clientX;
    this.swipeState.startY = e.touches[0].clientY;
    this.swipeState.currentX = this.swipeState.startX;
    this.swipeState.currentY = this.swipeState.startY;
    this.swipeState.deltaX = 0;
    this.swipeState.deltaY = 0;

    // Remove transitions for immediate response
    this.swipeState.trackContentWrapper.style.transition = 'none';
    this.swipeState.currentTrackContent.style.transition = 'none';
    this.swipeState.nextTrackContent.style.transition = 'none';
    this.swipeState.prevTrackContent.style.transition = 'none';

    // Preload adjacent tracks
    this.preloadAdjacentTracks();
  }

  handleTouchMove(e) {
    if (!this.swipeState.isSwping || this.swipeState.animating) return;

    this.swipeState.currentX = e.touches[0].clientX;
    this.swipeState.currentY = e.touches[0].clientY;
    this.swipeState.deltaX = this.swipeState.currentX - this.swipeState.startX;
    this.swipeState.deltaY = this.swipeState.currentY - this.swipeState.startY;

    // Check if this is a horizontal swipe
    if (
      Math.abs(this.swipeState.deltaY) >
      Math.abs(this.swipeState.deltaX) * 0.5
    ) {
      // More vertical than horizontal, cancel swipe
      this.handleTouchCancel();
      return;
    }

    // Prevent default to stop vertical scrolling during horizontal swipe
    if (Math.abs(this.swipeState.deltaX) > 10) {
      e.preventDefault();
    }

    // Update UI based on swipe progress
    this.updateSwipeUI(this.swipeState.deltaX);
  }

  handleTouchEnd(e) {
    if (!this.swipeState.isSwping || this.swipeState.animating) return;

    this.swipeState.isSwping = false;

    const absX = Math.abs(this.swipeState.deltaX);
    const absY = Math.abs(this.swipeState.deltaY);

    // Check if swipe was primarily horizontal and exceeded threshold
    if (
      absX > this.swipeState.threshold &&
      absY < this.swipeState.verticalThreshold
    ) {
      // Complete the swipe
      if (this.swipeState.deltaX > 0) {
        // Swiped right - go to previous
        if (this.currentIndex > 0) {
          this.animateToTrack('prev');
        } else {
          this.snapBack();
        }
      } else {
        // Swiped left - go to next
        if (this.currentIndex < this.queue.length - 1) {
          this.animateToTrack('next');
        } else {
          this.snapBack();
        }
      }
    } else {
      // Snap back
      this.snapBack();
    }
  }

  handleTouchCancel(e) {
    if (this.swipeState.isSwping) {
      this.swipeState.isSwping = false;
      this.snapBack();
    }
  }

  updateSwipeUI(deltaX) {
    const containerWidth = this.swipeState.swipeableContainer.offsetWidth;
    const progress = Math.min(Math.max(deltaX / containerWidth, -1), 1);

    // Update transforms and opacity
    const absProgress = Math.abs(progress);

    // Current track fades out as we swipe
    this.swipeState.currentTrackContent.style.opacity = 1 - absProgress * 0.5;
    this.swipeState.currentTrackContent.style.transform = `translateX(${
      deltaX * 0.3
    }px)`;

    if (deltaX > 0 && this.currentIndex > 0) {
      // Swiping right - show previous track
      this.swipeState.prevTrackContent.style.opacity = absProgress;
      this.swipeState.prevTrackContent.style.transform = `translateX(${
        -100 + progress * 100
      }%)`;
    } else if (deltaX < 0 && this.currentIndex < this.queue.length - 1) {
      // Swiping left - show next track
      this.swipeState.nextTrackContent.style.opacity = absProgress;
      this.swipeState.nextTrackContent.style.transform = `translateX(${
        100 + progress * 100
      }%)`;
    }
  }

  preloadAdjacentTracks() {
    // Preload previous track info
    if (this.currentIndex > 0) {
      const prevTrack = this.queue[this.currentIndex - 1];
      this.updateTrackContent(this.swipeState.prevTrackContent, prevTrack);
    }

    // Preload next track info
    if (this.currentIndex < this.queue.length - 1) {
      const nextTrack = this.queue[this.currentIndex + 1];
      this.updateTrackContent(this.swipeState.nextTrackContent, nextTrack);
    }
  }

  updateTrackContent(contentElement, track) {
    if (!track || !contentElement) return;

    const showName = contentElement.querySelector('.player-show-name');
    const episodeTitle = contentElement.querySelector('.player-episode-title');
    const coverContainer = contentElement.querySelector('.player-cover-large');
    const likeButton = contentElement.querySelector('.player-like-overlay');

    // Update text content
    if (showName) showName.textContent = track.artist || track.showName || '--';
    if (episodeTitle) {
      episodeTitle.textContent = track.title || '--';
      episodeTitle.classList.remove('scrolling'); // Reset scrolling
    }

    // Update cover art
    this.updateCoverArtForElement(coverContainer, track);

    // Update like button state
    if (likeButton) {
      const isLiked = this.favorites.has(String(track.id));
      const iconSpan = likeButton.querySelector('.icon');
      if (iconSpan) {
        iconSpan.innerHTML = isLiked
          ? this.iconSVGs.heartFilled
          : this.iconSVGs.heart;
      }
      likeButton.classList.toggle('liked', isLiked);
    }
  }

  updateCoverArtForElement(coverContainer, track) {
    if (!coverContainer || !track) return;

    const existingImage = coverContainer.querySelector('.player-cover-image');
    const existingGradient = coverContainer.querySelector(
      '.player-cover-gradient'
    );

    // Get the appropriate cover art URL
    const coverArtUrl = this.getTrackCoverArtForTrack(track);

    if (coverArtUrl) {
      // Remove gradient if it exists
      if (existingGradient) {
        existingGradient.remove();
      }

      // Create or update image
      if (!existingImage) {
        const img = document.createElement('img');
        img.className = 'player-cover-image';
        img.alt = track.title;
        img.onerror = () => {
          img.remove();
          const gradient = document.createElement('div');
          gradient.className = 'player-cover-gradient';
          gradient.innerHTML = `<span class="icon" style="font-size: 80px;">${this.iconSVGs.headphones}</span>`;
          coverContainer.appendChild(gradient);
        };
        img.src = coverArtUrl;
        coverContainer.appendChild(img);
      } else {
        existingImage.src = coverArtUrl;
        existingImage.alt = track.title;
      }
    } else {
      // Use gradient
      if (existingImage) {
        existingImage.remove();
      }

      if (!existingGradient) {
        const gradient = document.createElement('div');
        gradient.className = 'player-cover-gradient';
        gradient.innerHTML = `<span class="icon" style="font-size: 80px;">${this.iconSVGs.headphones}</span>`;
        coverContainer.appendChild(gradient);
      }
    }
  }

  getTrackCoverArtForTrack(track) {
    if (track.coverArt) {
      return track.coverArt;
    }

    const effectivePath = track.showPath;

    if (effectivePath) {
      const pathParts = effectivePath.split('/');
      const encodedPath = pathParts
        .map(part => encodeURIComponent(part))
        .join('/');
      return `${this.R2_BASE_URL}/${encodedPath}/folder.jpg`;
    } else if (track.showName) {
      return `${this.R2_BASE_URL}/${encodeURIComponent(
        track.showName
      )}/folder.jpg`;
    }

    return null;
  }

  animateToTrack(direction) {
    if (this.swipeState.animating) return;

    this.swipeState.animating = true;

    // Add transitions
    this.swipeState.currentTrackContent.style.transition = 'all 0.3s ease-out';
    this.swipeState.nextTrackContent.style.transition = 'all 0.3s ease-out';
    this.swipeState.prevTrackContent.style.transition = 'all 0.3s ease-out';

    if (direction === 'next') {
      // Animate current out to left
      this.swipeState.currentTrackContent.style.opacity = '0';
      this.swipeState.currentTrackContent.style.transform = 'translateX(-30%)';

      // Animate next in from right
      this.swipeState.nextTrackContent.style.opacity = '1';
      this.swipeState.nextTrackContent.style.transform = 'translateX(0)';

      setTimeout(() => {
        this.playNext();
        this.resetSwipeUI();
      }, 300);
    } else {
      // Animate current out to right
      this.swipeState.currentTrackContent.style.opacity = '0';
      this.swipeState.currentTrackContent.style.transform = 'translateX(30%)';

      // Animate prev in from left
      this.swipeState.prevTrackContent.style.opacity = '1';
      this.swipeState.prevTrackContent.style.transform = 'translateX(0)';

      setTimeout(() => {
        this.playPrevious(true); // Pass true to indicate it's from swipe
        this.resetSwipeUI();
      }, 300);
    }
  }

  snapBack() {
    // Add transitions
    this.swipeState.currentTrackContent.style.transition = 'all 0.2s ease-out';
    this.swipeState.nextTrackContent.style.transition = 'all 0.2s ease-out';
    this.swipeState.prevTrackContent.style.transition = 'all 0.2s ease-out';

    // Reset positions
    this.swipeState.currentTrackContent.style.opacity = '1';
    this.swipeState.currentTrackContent.style.transform = 'translateX(0)';
    this.swipeState.nextTrackContent.style.opacity = '0';
    this.swipeState.nextTrackContent.style.transform = 'translateX(100%)';
    this.swipeState.prevTrackContent.style.opacity = '0';
    this.swipeState.prevTrackContent.style.transform = 'translateX(-100%)';

    setTimeout(() => {
      this.resetSwipeUI();
    }, 200);
  }

  resetSwipeUI() {
    this.swipeState.animating = false;

    // Remove transitions
    this.swipeState.trackContentWrapper.style.transition = '';
    this.swipeState.currentTrackContent.style.transition = '';
    this.swipeState.nextTrackContent.style.transition = '';
    this.swipeState.prevTrackContent.style.transition = '';

    // Reset positions
    this.swipeState.currentTrackContent.style.opacity = '1';
    this.swipeState.currentTrackContent.style.transform = '';
    this.swipeState.nextTrackContent.style.opacity = '0';
    this.swipeState.nextTrackContent.style.transform = 'translateX(100%)';
    this.swipeState.prevTrackContent.style.opacity = '0';
    this.swipeState.prevTrackContent.style.transform = 'translateX(-100%)';
  }

  updateSwipeableUI() {
    const container = this.swipeState.swipeableContainer;
    if (!container) return;

    // Update swipeable state
    if (this.queue.length > 1) {
      container.classList.add('has-multiple-tracks');
    } else {
      container.classList.remove('has-multiple-tracks');
    }

    // Update old swipeable indicator too
    const playerContent = this.expandedPlayer.querySelector(
      '.player-expanded-content'
    );
    if (playerContent) {
      if (this.queue.length > 1) {
        playerContent.classList.add('swipeable');
      } else {
        playerContent.classList.remove('swipeable');
      }
    }
  }

  setupPlaylistPopupListeners() {
    // Close button
    const closeBtn = document.getElementById('close-playlist-popup');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeAddToPlaylistPopup());
    }

    // Cancel button
    const cancelBtn = document.getElementById('cancel-playlist-add');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.closeAddToPlaylistPopup());
    }

    // Confirm button
    const confirmBtn = document.getElementById('confirm-playlist-add');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => this.addEpisodeToPlaylists());
    }

    // Create new playlist button
    const createBtn = document.getElementById('create-playlist-from-popup');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        const name = prompt('Enter playlist name:');
        if (name) {
          const newPlaylist = {
            id: Date.now().toString(),
            name: name,
            count: 0,
            duration: '0m',
            color: ['#ff0040', '#9d00ff', '#60a5fa', '#10b981', '#f59e0b'][
              Math.floor(Math.random() * 5)
              ],
            episodes: [],
          };

          this.playlists.push(newPlaylist);

          // Sort playlists alphabetically
          this.playlists.sort((a, b) => a.name.localeCompare(b.name));

          this.savePlaylistsToUserData();

          // Re-render the popup content
          this.openAddToPlaylistPopup();
        }
      });
    }

    // Click outside to close
    const addPlaylistPopup = document.getElementById('add-to-playlist-popup');
    if (addPlaylistPopup) {
      addPlaylistPopup.addEventListener('click', e => {
        if (e.target === addPlaylistPopup) {
          this.closeAddToPlaylistPopup();
        }
      });
    }
  }

  // NEW: Handle waveform click for seeking
  seekFromWaveformClick(e) {
    const rect = this.waveformContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    const time = percent * this.audio.duration;

    console.log('Waveform click:', { x, width: rect.width, percent, time }); // Debug log

    if (!isNaN(time)) {
      this.audio.currentTime = time;
      this.saveTrackPosition();
    }
  }

  // Handle download button click
  handleDownload() {
    if (!this.currentTrack) {
      alert('No track is currently playing');
      return;
    }

    // For now, just show a message
    // In the future, this would trigger an actual download
    alert('Download functionality coming soon!');
    console.log(
      'Would download:',
      this.currentTrack.title,
      this.currentTrack.src
    );
  }

  openAddToPlaylistPopup() {
    if (!this.currentTrack) return;

    this.currentEpisodeToAdd = {
      id: this.currentTrack.id,
      title: this.currentTrack.title,
      artist: this.currentTrack.artist,
      showName: this.currentTrack.showName,
      showId: this.currentTrack.showId,
      showPath: this.currentTrack.showPath,
      duration: this.currentTrack.duration,
      src: this.currentTrack.src,
      description: this.currentTrack.description,
      coverArt: this.currentTrack.coverArt,
    };

    this.selectedPlaylists = new Set();

    const popup = document.getElementById('add-to-playlist-popup');
    const playlistList = document.getElementById('playlist-selection-list');

    if (!popup || !playlistList) return;

    // Sort playlists alphabetically for display
    const sortedPlaylists = [...this.playlists].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    // Render playlists
    if (sortedPlaylists.length === 0) {
      playlistList.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
                    <p>No playlists yet. Create your first playlist!</p>
                </div>
            `;
    } else {
      playlistList.innerHTML = sortedPlaylists
        .map(
          playlist => `
                <div class="playlist-selection-item" data-playlist-id="${
            playlist.id
          }">
                    <div class="playlist-checkbox">
                        <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                            <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                        </svg>
                    </div>
                    <div class="playlist-color-indicator" style="background: ${
            playlist.color
          };">
                        ${(playlist.name || 'P').charAt(0).toUpperCase()}
                    </div>
                    <div class="playlist-selection-info">
                        <div class="playlist-selection-name">${this.escapeHtml(
            playlist.name
          )}</div>
                        <div class="playlist-selection-count">${
            playlist.count || 0
          } episodes</div>
                    </div>
                </div>
            `
        )
        .join('');

      // Add click listeners to playlist items
      playlistList
        .querySelectorAll('.playlist-selection-item')
        .forEach(item => {
          item.addEventListener('click', () => {
            const playlistId = item.dataset.playlistId;

            if (this.selectedPlaylists.has(playlistId)) {
              this.selectedPlaylists.delete(playlistId);
              item.classList.remove('selected');
            } else {
              this.selectedPlaylists.add(playlistId);
              item.classList.add('selected');
            }

            // Update confirm button state
            const confirmBtn = document.getElementById('confirm-playlist-add');
            if (confirmBtn) {
              confirmBtn.disabled = this.selectedPlaylists.size === 0;
            }
          });
        });
    }

    // Show popup
    popup.classList.add('active');
    document.body.classList.add('modal-open');
  }

  closeAddToPlaylistPopup() {
    const popup = document.getElementById('add-to-playlist-popup');
    if (popup) {
      popup.classList.remove('active');
      document.body.classList.remove('modal-open');
    }

    this.currentEpisodeToAdd = null;
    this.selectedPlaylists = new Set();
  }

  addEpisodeToPlaylists() {
    if (!this.currentEpisodeToAdd || this.selectedPlaylists.size === 0) return;

    // Add to selected playlists
    this.selectedPlaylists.forEach(playlistId => {
      const playlist = this.playlists.find(p => p.id === playlistId);
      if (playlist) {
        if (!playlist.episodes) playlist.episodes = [];

        // Check if episode already exists in playlist
        if (
          !playlist.episodes.find(ep => ep.id === this.currentEpisodeToAdd.id)
        ) {
          playlist.episodes.push({
            ...this.currentEpisodeToAdd,
            dateAdded: new Date().toISOString(),
          });

          // Update count and duration
          playlist.count = playlist.episodes.length;

          // Calculate total duration (simplified)
          const totalMinutes = playlist.episodes.length * 45; // Assuming 45 min average
          const hours = Math.floor(totalMinutes / 60);
          const minutes = totalMinutes % 60;
          playlist.duration =
            hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        }
      }
    });

    // Save to user data
    this.savePlaylistsToUserData();

    // Show success message (you could add a toast notification here)
    const playlistNames = Array.from(this.selectedPlaylists)
      .map(id => {
        const playlist = this.playlists.find(p => p.id === id);
        return playlist ? playlist.name : '';
      })
      .filter(name => name)
      .join(', ');

    console.log(
      `Added "${this.currentEpisodeToAdd.title}" to: ${playlistNames}`
    );

    // Close popup
    this.closeAddToPlaylistPopup();
  }

  savePlaylistsToUserData() {
    if (window.userData) {
      window.userData.playlists = this.playlists;

      // Save to localStorage
      try {
        localStorage.setItem(
          this.USER_DATA_KEY,
          JSON.stringify(window.userData)
        );
      } catch (error) {
        console.error('Error saving playlists:', error);
      }
    }
  }

  async loadTrack(index, skipAnimation = false) {
    if (index < 0 || index >= this.queue.length) return;

    // Save current track position before switching
    if (this.currentTrack) {
      this.saveTrackPosition();
    }

    // Store playing state
    const wasPlaying = !this.audio.paused;

    // Remove any existing event handlers first
    if (this.currentLoadHandler) {
      this.audio.removeEventListener('loadeddata', this.currentLoadHandler);
    }
    if (this.currentErrorHandler) {
      this.audio.removeEventListener('error', this.currentErrorHandler);
    }

    // Completely stop and reset the audio element
    this.audio.pause();

    // Update current track
    this.currentIndex = index;
    this.currentTrack = this.queue[index];

    // Ensure ID is string
    if (this.currentTrack) {
      this.currentTrack.id = String(this.currentTrack.id);

      // Save current track to localStorage
      try {
        localStorage.setItem(
          'eeriecast_last_playing',
          JSON.stringify({
            id: this.currentTrack.id,
            title: this.currentTrack.title,
            artist: this.currentTrack.artist,
            episode: this.currentTrack.episode,
            duration: this.currentTrack.duration,
            src: this.currentTrack.src,
            description: this.currentTrack.description,
            coverArt: this.currentTrack.coverArt,
            showName: this.currentTrack.showName,
            showId: this.currentTrack.showId,
            showPath: this.currentTrack.showPath,
          })
        );
      } catch (e) {
        console.error('Failed to save last playing track:', e);
      }
    }

    // Validate the new source URL
    if (!this.currentTrack.src) {
      console.error('Invalid track source:', this.currentTrack);
      return;
    }

    // Update listening history
    this.updateListeningHistory();

    // Track play event
    this.trackEpisodePlay();

    // Create new handlers
    this.currentLoadHandler = () => {
      // Only restore position after audio is ready
      const trackId = String(this.currentTrack.id);
      const savedPosition = this.trackPositions.get(trackId);
      if (
        savedPosition &&
        savedPosition > 0 &&
        savedPosition < this.audio.duration
      ) {
        this.audio.currentTime = savedPosition;
      }

      // Resume playing if it was playing before
      if (wasPlaying && this.audio.paused) {
        this.audio.play().catch(err => {
          console.log('Autoplay blocked:', err);
        });
      }

      // Signal that track is ready
      this.trackReady = true;
    };

    this.currentErrorHandler = e => {
      console.error('Audio load error:', e);
      console.error('Failed to load:', this.currentTrack.src);
      this.trackReady = false;
    };

    // Add event listeners
    this.audio.addEventListener('loadeddata', this.currentLoadHandler, {
      once: true,
    });
    this.audio.addEventListener('error', this.currentErrorHandler, {
      once: true,
    });

    // Set source and load
    this.trackReady = false;
    this.audio.src = this.currentTrack.src;
    this.audio.load();

    // Update UI
    this.updatePlayerDisplay();
    this.updateQueueDisplay();
    this.updateLikeButton();
    this.updateCoverArt();
    this.updateRatingDisplay();
    this.updateSwipeableUI();

    // Reset swipe UI state if not animating
    if (!skipAnimation && !this.swipeState.animating) {
      this.resetSwipeUI();
    }
  }

  updateListeningHistory() {
    if (!this.currentTrack || !window.userData) return;

    const now = new Date().toISOString();
    const trackId = String(this.currentTrack.id);

    // Initialize listening history if it doesn't exist
    if (!window.userData.listeningHistory) {
      window.userData.listeningHistory = {};
    }

    // Get saved position for this track
    const savedPosition = this.trackPositions.get(trackId) || 0;
    const savedProgress =
      this.audio.duration > 0
        ? Math.round((savedPosition / this.audio.duration) * 100)
        : 0;

    // Check if this is a new track being played
    const existingHistoryItem = window.userData.listeningHistory[trackId];
    const isNewTrack =
      !existingHistoryItem || existingHistoryItem.progress === 0;

    // Update or create history entry with initial progress
    window.userData.listeningHistory[trackId] = {
      id: trackId,
      title: this.currentTrack.title,
      subtitle:
        this.currentTrack.episode || `${this.currentTrack.artist} • Episode`,
      showName: this.currentTrack.showName || this.currentTrack.artist,
      showPath: this.currentTrack.showPath || null,
      showId: this.currentTrack.showId || trackId,
      coverArt: this.currentTrack.coverArt || this.getTrackCoverArt(),
      duration: this.currentTrack.duration,
      audioUrl: this.currentTrack.src,
      lastPlayed: now,
      progress: savedProgress || 1, // Start with 1% to show it's been started
      artist: this.currentTrack.artist,
      description: this.currentTrack.description,
    };

    // Update episodes played count only if this is a new track
    if (isNewTrack) {
      window.userData.episodesPlayed =
        (window.userData.episodesPlayed || 0) + 1;
    }

    // Save to localStorage
    this.saveUserData();

    // Dispatch event for other components
    window.dispatchEvent(
      new CustomEvent('listeningHistoryUpdated', {
        detail: { trackId: trackId },
      })
    );

    // FIXED: Dispatch episode played event with ALL necessary data including audio sources
    window.dispatchEvent(
      new CustomEvent('episodePlayed', {
        detail: {
          id: this.currentTrack.id,
          title: this.currentTrack.title,
          artist: this.currentTrack.artist,
          showName: this.currentTrack.showName || this.currentTrack.artist,
          showPath: this.currentTrack.showPath || null,
          subtitle: this.currentTrack.episode || this.currentTrack.subtitle,
          duration: this.currentTrack.duration,
          src: this.currentTrack.src, // CRITICAL: Always include the audio source
          audioUrl: this.currentTrack.src, // Include for compatibility
          audioURL: this.currentTrack.src, // Include for compatibility
          url: this.currentTrack.src, // Include for compatibility
          description: this.currentTrack.description,
          coverArt: this.currentTrack.coverArt || this.getTrackCoverArt(),
          image: this.currentTrack.coverArt || this.getTrackCoverArt(), // Include for compatibility
          showId: this.currentTrack.showId,
          episode: this.currentTrack.episode || this.currentTrack.subtitle,
        },
      })
    );
  }

  getTrackCoverArt() {
    if (this.currentTrack.coverArt) {
      return this.currentTrack.coverArt;
    }

    // Use showPath which should already have the full path
    const effectivePath = this.currentTrack.showPath;

    if (effectivePath) {
      // The path already includes everything (e.g., "Audiobooks/BookName")
      const pathParts = effectivePath.split('/');
      const encodedPath = pathParts
        .map(part => encodeURIComponent(part))
        .join('/');
      return `${this.R2_BASE_URL}/${encodedPath}/folder.jpg`;
    } else if (this.currentTrack.showName) {
      // Fallback - just use show name at root
      return `${this.R2_BASE_URL}/${encodeURIComponent(
        this.currentTrack.showName
      )}/folder.jpg`;
    }

    return null;
  }

  updateCoverArt() {
    if (!this.currentTrack) return;

    // Update current track content
    const currentCoverContainer =
      this.swipeState.currentTrackContent.querySelector('.player-cover-large');
    this.updateCoverArtForElement(currentCoverContainer, this.currentTrack);

    // Also ensure like/playlist buttons are present
    this.ensureOverlayButtons(currentCoverContainer);

    // Update mini player cover art too
    this.miniPlayer.updateTrackInfo(this.currentTrack);
  }

  ensureOverlayButtons(coverContainer) {
    if (!coverContainer || !this.currentTrack) return;

    // Ensure like button exists
    let likeButton = coverContainer.querySelector('.player-like-overlay');
    if (!likeButton) {
      likeButton = document.createElement('button');
      likeButton.className = 'player-like-overlay';
      likeButton.innerHTML = `<span class="icon">${
        this.favorites.has(String(this.currentTrack.id))
          ? this.iconSVGs.heartFilled
          : this.iconSVGs.heart
      }</span>`;
      coverContainer.insertBefore(likeButton, coverContainer.firstChild);
    }

    // Ensure playlist button exists
    let playlistButton = coverContainer.querySelector(
      '.player-playlist-overlay'
    );
    if (!playlistButton) {
      playlistButton = document.createElement('button');
      playlistButton.className = 'player-playlist-overlay';
      playlistButton.innerHTML = '+';
      coverContainer.insertBefore(playlistButton, likeButton.nextSibling);
    }
  }

  saveTrackPosition() {
    if (
      this.currentTrack &&
      this.audio.currentTime > 0 &&
      !isNaN(this.audio.duration)
    ) {
      const trackId = String(this.currentTrack.id);
      this.trackPositions.set(trackId, this.audio.currentTime);
      this.saveTrackPositions();

      // Update progress in listening history
      if (window.userData && window.userData.listeningHistory) {
        const historyItem = window.userData.listeningHistory[trackId];
        if (historyItem) {
          const progress = (this.audio.currentTime / this.audio.duration) * 100;
          historyItem.progress = Math.min(95, Math.round(progress)); // Cap at 95% to avoid marking as complete too early
          historyItem.lastPlayed = new Date().toISOString();
          this.saveUserData();

          // Dispatch event to update UI
          window.dispatchEvent(
            new CustomEvent('listeningHistoryUpdated', {
              detail: { trackId: trackId },
            })
          );
        }
      }
    }
  }

  togglePlay() {
    if (this.audio.paused) {
      this.audio.play().catch(err => {
        console.log('Play was prevented:', err);
      });
    } else {
      this.audio.pause();
    }
  }

  toggleLike() {
    if (!this.currentTrack) return;

    const trackId = String(this.currentTrack.id);

    if (this.favorites.has(trackId)) {
      // Remove from favorites
      this.favorites.delete(trackId);

      // Remove from favoritedEpisodes array
      if (window.userData.favoritedEpisodes) {
        window.userData.favoritedEpisodes =
          window.userData.favoritedEpisodes.filter(
            ep => String(ep.id) !== trackId
          );
      }
    } else {
      // Add to favorites
      this.favorites.add(trackId);

      // Add full track data to favorites in userData
      if (!window.userData.favoritedEpisodes) {
        window.userData.favoritedEpisodes = [];
      }

      // Store the complete track data for the favorites page
      const favoriteData = {
        id: trackId,
        title: this.currentTrack.title,
        artist: this.currentTrack.artist,
        showName: this.currentTrack.showName || this.currentTrack.artist,
        showPath: this.currentTrack.showPath || null,
        coverArt: this.currentTrack.coverArt || this.getTrackCoverArt(),
        duration: this.currentTrack.duration,
        src: this.currentTrack.src,
        description: this.currentTrack.description,
        dateAdded: new Date().toISOString(),
      };

      // Check if already exists and update or add
      const existingIndex = window.userData.favoritedEpisodes.findIndex(
        ep => String(ep.id) === trackId
      );

      if (existingIndex === -1) {
        window.userData.favoritedEpisodes.push(favoriteData);
      } else {
        // Update existing entry
        window.userData.favoritedEpisodes[existingIndex] = favoriteData;
      }
    }

    this.saveFavorites();
    this.updateLikeButton();
  }

  updateLikeButton() {
    const isLiked =
      this.currentTrack && this.favorites.has(String(this.currentTrack.id));

    // Update all like buttons (current, next, prev)
    const allLikeButtons = this.expandedPlayer.querySelectorAll(
      '.player-like-overlay'
    );
    allLikeButtons.forEach(button => {
      const trackContent = button.closest('.track-content');
      if (trackContent && trackContent.classList.contains('current')) {
        const iconSpan = button.querySelector('.icon');
        if (iconSpan) {
          iconSpan.innerHTML = isLiked
            ? this.iconSVGs.heartFilled
            : this.iconSVGs.heart;
        }
        button.classList.toggle('liked', isLiked);
      }
    });
  }

  toggleDescription() {
    this.episodeDescriptionModal.classList.toggle('active');
    this.showDescription = !this.showDescription;

    if (this.showDescription) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
  }

  closeDescription() {
    this.episodeDescriptionModal.classList.remove('active');
    this.showDescription = false;
    document.body.classList.remove('modal-open');
  }

  toggleRatingsPopup() {
    this.ratingsPopup.classList.toggle('active');
    this.showRatingsPopup = !this.showRatingsPopup;

    if (this.showRatingsPopup) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
  }

  closeRatingsPopup() {
    this.ratingsPopup.classList.remove('active');
    this.showRatingsPopup = false;
    document.body.classList.remove('modal-open');
  }

  updateRatingDisplay() {
    if (!this.currentTrack) return;

    const showName = this.currentTrack.showName || this.currentTrack.artist;
    const rating = this.networkRatings[showName];

    console.log('Looking for rating for show:', showName);
    console.log('Available ratings:', this.networkRatings);
    console.log('Found rating:', rating);

    const ratingBadge = this.expandedPlayer.querySelector('.rating-badge');
    const ratingText = ratingBadge.querySelector('.rating-text');

    if (rating) {
      // Update badge
      ratingBadge.style.display = 'inline-flex';
      ratingText.textContent = rating.rating;

      // Remove old rating classes
      ratingBadge.className = 'rating-badge';

      // Add appropriate class
      const ratingClass = `rating-${rating.rating
        .toLowerCase()
        .replace('-', '')}`;
      ratingBadge.classList.add(ratingClass);

      // Update popup content
      const ratingLarge = this.ratingsPopup.querySelector('.rating-large');
      const ratingDescription = this.ratingsPopup.querySelector(
        '.rating-description'
      );
      const contentWarnings =
        this.ratingsPopup.querySelector('.content-warnings');

      ratingLarge.textContent = rating.rating;
      ratingLarge.className = 'rating-large';
      ratingLarge.classList.add(ratingClass);

      // Set description based on rating
      const descriptions = {
        G: 'General Audiences - All ages admitted',
        PG: 'Parental Guidance Suggested',
        'PG-13': 'Parents Strongly Cautioned',
        R: 'Restricted - Adult Content',
      };
      ratingDescription.textContent =
        descriptions[rating.rating] || 'Not Rated';

      // Display content warnings
      contentWarnings.innerHTML =
        rating.content && rating.content.length > 0
          ? rating.content
            .map(
              warning =>
                `<div class="content-warning-bubble">${warning}</div>`
            )
            .join('')
          : '<div class="content-warning-bubble">No specific content warnings</div>';
    } else {
      // Hide rating badge if no rating
      ratingBadge.style.display = 'none';
    }
  }

  openAdditionalControls() {
    this.additionalControlsPopup.classList.add('active');
    document.body.classList.add('modal-open');
  }

  closeAdditionalControls() {
    this.additionalControlsPopup.classList.remove('active');
    document.body.classList.remove('modal-open');
  }

  playNext() {
    // Store playing state before switching
    const wasPlaying = !this.audio.paused;

    if (this.isShuffle) {
      const randomIndex = Math.floor(Math.random() * this.queue.length);
      this.loadTrack(randomIndex, true);
    } else {
      const nextIndex = (this.currentIndex + 1) % this.queue.length;
      this.loadTrack(nextIndex, true);
    }

    // loadTrack will handle resuming playback if needed
  }

  playPrevious(fromSwipe = false) {
    // For swipe gestures, always go to previous track
    // For button clicks, restart current track if past 3 seconds
    if (!fromSwipe && this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
    } else {
      // Store playing state before switching
      const wasPlaying = !this.audio.paused;

      const prevIndex =
        this.currentIndex === 0 ? this.queue.length - 1 : this.currentIndex - 1;
      this.loadTrack(prevIndex, true);

      // loadTrack will handle resuming playback if needed
    }
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;

    // Update UI
    this.miniPlayer.updateShuffleState(this.isShuffle);

    const expandedShuffleBtn =
      this.expandedPlayer.querySelector('.shuffle-btn');
    if (expandedShuffleBtn)
      expandedShuffleBtn.classList.toggle('active', this.isShuffle);
  }

  toggleRepeat() {
    const modes = ['none', 'one', 'all'];
    const currentModeIndex = modes.indexOf(this.repeatMode);
    this.repeatMode = modes[(currentModeIndex + 1) % modes.length];

    // Update UI
    this.miniPlayer.updateRepeatState(this.repeatMode);

    const expandedRepeatBtn = this.expandedPlayer.querySelector('.repeat-btn');
    if (expandedRepeatBtn) {
      expandedRepeatBtn.classList.remove('active', 'repeat-one');

      if (this.repeatMode === 'one') {
        expandedRepeatBtn.classList.add('active', 'repeat-one');
      } else if (this.repeatMode === 'all') {
        expandedRepeatBtn.classList.add('active');
      }
    }
  }

  seekRelative(seconds) {
    this.audio.currentTime = Math.max(
      0,
      Math.min(this.audio.duration, this.audio.currentTime + seconds)
    );
    this.saveTrackPosition();
  }

  setVolumeFromClick(e, volumeSlider) {
    const rect = volumeSlider.getBoundingClientRect();
    const percent = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width)
    );
    this.setVolume(percent);
  }

  setVolume(value) {
    this.volume = value;
    this.audio.volume = value;

    // Update mini player
    this.miniPlayer.updateVolume(value);

    // Update expanded player
    const expandedVolumeFill =
      this.additionalControlsPopup.querySelector('.volume-fill');
    if (expandedVolumeFill) {
      expandedVolumeFill.style.width = `${value * 100}%`;
    }
  }

  changeVolume(delta) {
    this.setVolume(Math.max(0, Math.min(1, this.volume + delta)));
  }

  changeSpeed(delta) {
    const newSpeed = Math.max(
      0.5,
      Math.min(2, this.audio.playbackRate + delta)
    );
    this.audio.playbackRate = newSpeed;

    const speedDisplay =
      this.additionalControlsPopup.querySelector('.speed-display');
    if (speedDisplay) speedDisplay.textContent = `${newSpeed}x`;
  }

  setSleepTimer(minutes) {
    this.cancelSleepTimer();

    this.sleepTimerDuration = minutes * 60 * 1000;
    this.sleepTimerEndTime = Date.now() + this.sleepTimerDuration;

    this.sleepTimer = setTimeout(() => {
      this.audio.pause();
      this.cancelSleepTimer();
      alert(`Sleep timer finished. Playback paused.`);
    }, this.sleepTimerDuration);

    // Show sleep timer indicator
    const sleepTimerIndicator = this.expandedPlayer.querySelector(
      '.sleep-timer-indicator'
    );
    if (sleepTimerIndicator) {
      sleepTimerIndicator.style.display = 'inline-flex';
    }

    // Update remaining time immediately
    this.updateSleepTimerDisplay();

    // Start interval to update remaining time
    this.sleepTimerInterval = setInterval(() => {
      this.updateSleepTimerDisplay();
    }, 1000);

    // Update UI
    const controlButtons =
      this.additionalControlsPopup.querySelectorAll('.control-button');
    controlButtons.forEach(btn => {
      if (btn) btn.classList.remove('active');
    });

    const activeButton = this.additionalControlsPopup.querySelector(
      `.sleep-${minutes}`
    );
    if (activeButton) {
      activeButton.classList.add('active');
    }
  }

  cancelSleepTimer() {
    if (this.sleepTimer) {
      clearTimeout(this.sleepTimer);
      this.sleepTimer = null;
      this.sleepTimerDuration = 0;
      this.sleepTimerEndTime = null;
    }

    if (this.sleepTimerInterval) {
      clearInterval(this.sleepTimerInterval);
      this.sleepTimerInterval = null;
    }

    // Hide sleep timer indicator
    const sleepTimerIndicator = this.expandedPlayer.querySelector(
      '.sleep-timer-indicator'
    );
    if (sleepTimerIndicator) {
      sleepTimerIndicator.style.display = 'none';
    }

    // Update UI
    const controlButtons =
      this.additionalControlsPopup.querySelectorAll('.control-button');
    controlButtons.forEach(btn => {
      if (btn) btn.classList.remove('active');
    });

    const offButton = this.additionalControlsPopup.querySelector('.sleep-off');
    if (offButton) {
      offButton.classList.add('active');
    }
  }

  updateSleepTimerDisplay() {
    if (!this.sleepTimerEndTime) return;

    const remainingTime = Math.max(0, this.sleepTimerEndTime - Date.now());

    if (remainingTime === 0) {
      return;
    }

    const minutes = Math.floor(remainingTime / 60000);
    const seconds = Math.floor((remainingTime % 60000) / 1000);

    const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const sleepTimerRemaining = this.expandedPlayer.querySelector(
      '.sleep-timer-remaining'
    );
    if (sleepTimerRemaining) {
      sleepTimerRemaining.textContent = display;
    }
  }

  // UPDATED: Waveform progress update method
  updateProgress() {
    if (!this.audio.duration || isNaN(this.audio.duration)) return;

    const percent = (this.audio.currentTime / this.audio.duration) * 100;

    // Update mini player
    this.miniPlayer.updateProgress(percent);

    // Update waveform progress
    if (this.waveformPlayed && this.progressIndicator) {
      this.waveformPlayed.style.setProperty('--progress', `${percent}%`);
      this.progressIndicator.style.left = `${percent}%`;
    }

    // Update time displays
    const currentTime = this.formatTime(this.audio.currentTime);
    document.querySelectorAll('.time-current').forEach(el => {
      if (el) el.textContent = currentTime;
    });

    // Update time listened in userData
    if (window.userData && this.isPlaying) {
      window.userData.timeListened = (window.userData.timeListened || 0) + 0.1; // Add 0.1 seconds
    }

    // Track progress periodically (every 30 seconds)
    if (this.isPlaying && Math.floor(this.audio.currentTime) % 30 === 0) {
      this.trackProgress();
    }

    // Dispatch progress update event
    if (this.currentTrack) {
      window.dispatchEvent(
        new CustomEvent('progressUpdate', {
          detail: {
            episodeId: String(this.currentTrack.id),
            progress: percent,
          },
        })
      );
    }
  }

  updateDuration() {
    const duration = this.formatTime(this.audio.duration);
    document.querySelectorAll('.time-total').forEach(el => {
      if (el) el.textContent = duration;
    });
  }

  updatePlayState(playing) {
    this.isPlaying = playing;

    // Update mini player
    this.miniPlayer.updatePlayState(playing);

    // Update expanded player
    const expandedPlayBtn =
      this.expandedPlayer.querySelector('.play-pause .icon');
    if (expandedPlayBtn) {
      expandedPlayBtn.innerHTML = playing
        ? this.iconSVGs.pause
        : this.iconSVGs.play;
    }

    // Update waveform animation state
    if (this.waveformWave) {
      if (playing) {
        this.waveformWave.classList.add('playing');
      } else {
        this.waveformWave.classList.remove('playing');
      }
    }
  }

  handleTrackEnd() {
    this.saveTrackPosition();

    // Mark episode as completed in history
    if (
      window.userData &&
      window.userData.listeningHistory &&
      this.currentTrack
    ) {
      const trackId = String(this.currentTrack.id);
      const historyItem = window.userData.listeningHistory[trackId];
      if (historyItem) {
        historyItem.progress = 100;
        historyItem.lastPlayed = new Date().toISOString();
        this.saveUserData();
      }
    }

    // Track completion
    this.trackComplete();

    if (this.repeatMode === 'one') {
      this.audio.currentTime = 0;
      this.audio.play();
    } else if (
      this.repeatMode === 'all' ||
      this.currentIndex < this.queue.length - 1
    ) {
      this.playNext();
    } else {
      this.updatePlayState(false);
    }
  }

  updatePlayerDisplay() {
    if (!this.currentTrack) {
      // Show empty state
      const currentShowName =
        this.swipeState.currentTrackContent.querySelector('.player-show-name');
      const currentEpisodeTitle =
        this.swipeState.currentTrackContent.querySelector(
          '.player-episode-title'
        );

      if (currentShowName)
        currentShowName.textContent = 'Select a podcast to start';
      if (currentEpisodeTitle)
        currentEpisodeTitle.textContent = 'No track playing';

      return;
    }

    // Update mini player
    this.miniPlayer.updateTrackInfo(this.currentTrack);

    // Update current track content
    this.updateTrackContent(
      this.swipeState.currentTrackContent,
      this.currentTrack
    );

    // Update description in the modal
    const descriptionContent = this.episodeDescriptionModal.querySelector(
      '.episode-description-content'
    );
    if (descriptionContent) {
      const description = this.currentTrack.description;
      if (
        description &&
        description !== 'No description available' &&
        description !== 'No description available.'
      ) {
        descriptionContent.innerHTML = `<p>${description}</p>`;
      } else {
        descriptionContent.innerHTML = `<p>No description available for this episode.</p>`;
      }
    }

    // Update queue count
    const queueCount = this.expandedPlayer.querySelector('.queue-count');
    if (queueCount) queueCount.textContent = this.queue.length;

    // Check for scrolling title after a delay to ensure proper rendering
    setTimeout(() => {
      const episodeTitle = this.swipeState.currentTrackContent.querySelector(
        '.player-episode-title'
      );
      if (episodeTitle && episodeTitle.scrollWidth > episodeTitle.clientWidth) {
        const titleText = this.currentTrack.title;
        const escapedTitle = this.escapeHtml(titleText);
        episodeTitle.innerHTML = `<span class="title-text">${escapedTitle} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; </span><span class="title-text">${escapedTitle} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; </span>`;
        episodeTitle.classList.add('scrolling');
      }
    }, 100);
  }

  updateQueueDisplay() {
    const queueList = this.queuePanel.querySelector('.queue-list');
    if (!queueList) return;

    // Update swipeable indicator and dots
    this.updateSwipeableUI();

    if (this.queue.length === 0) {
      queueList.innerHTML = `
                <div class="empty-queue-message">
                    <div class="icon">${this.iconSVGs.headphones}</div>
                    <p>Your queue is empty</p>
                </div>
            `;
      return;
    }

    queueList.innerHTML = this.queue
      .map((track, index) => {
        let coverArt = track.coverArt;

        // If no cover art, use showPath to get folder image
        if (!coverArt) {
          const effectivePath = track.showPath;

          if (effectivePath) {
            // The path already includes everything (e.g., "Audiobooks/BookName")
            const pathParts = effectivePath.split('/');
            const encodedPath = pathParts
              .map(part => encodeURIComponent(part))
              .join('/');
            coverArt = `${this.R2_BASE_URL}/${encodedPath}/folder.jpg`;
          } else if (track.showName) {
            // Fallback - just use show name at root
            coverArt = `${this.R2_BASE_URL}/${encodeURIComponent(
              track.showName
            )}/folder.jpg`;
          }
        }

        return `
                <div class="queue-item ${
          index === this.currentIndex ? 'active' : ''
        }" data-index="${index}">
                    <div class="queue-item-cover">
                        ${
          coverArt
            ? `<img src="${coverArt}" alt="${track.title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                             <span class="icon" style="display:none;">${this.iconSVGs.headphones}</span>`
            : `<span class="icon">${this.iconSVGs.headphones}</span>`
        }
                    </div>
                    <div class="queue-item-info">
                        <div class="queue-item-title">${track.title}</div>
                        <div class="queue-item-artist">${track.artist}</div>
                    </div>
                    <div class="queue-item-duration">${track.duration}</div>
                </div>
            `;
      })
      .join('');

    // Add click listeners
    queueList.querySelectorAll('.queue-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index);
        this.loadTrack(index);
        if (this.isPlaying) {
          this.audio.play();
        }
      });
    });
  }

  openExpandedPlayer() {
    this.expandedPlayer.classList.add('active');
    this.miniPlayer.setExpandedOpen(true);
    document.body.style.overflow = 'hidden';
  }

  closeExpandedPlayer() {
    this.expandedPlayer.classList.remove('active');
    this.miniPlayer.setExpandedOpen(false);
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open');
    this.closeQueue();
    this.closeDescription();
    this.closeAdditionalControls();
    this.closeRatingsPopup();
    this.closeAddToPlaylistPopup();
  }

  toggleQueue() {
    this.queuePanel.classList.toggle('active');
  }

  closeQueue() {
    this.queuePanel.classList.remove('active');
  }

  addComment(text) {
    const comment = {
      id: Date.now(),
      author: 'Guest User',
      text: text,
      time: new Date(),
    };

    this.comments.unshift(comment);
    this.renderComments();
  }

  renderComments() {
    const commentsList = this.expandedPlayer.querySelector('.comments-list');
    const commentsCount = this.expandedPlayer.querySelector('.comments-count');

    if (commentsCount)
      commentsCount.textContent = `${this.comments.length} comments`;

    if (commentsList) {
      commentsList.innerHTML = this.comments
        .map(
          comment => `
                <div class="comment">
                    <div class="comment-avatar"><span class="icon">${
            this.iconSVGs.user
          }</span></div>
                    <div class="comment-content">
                        <div class="comment-header">
                            <span class="comment-author">${
            comment.author
          }</span>
                            <span class="comment-time">${this.getRelativeTime(
            comment.time
          )}</span>
                        </div>
                        <div class="comment-text">${comment.text}</div>
                    </div>
                </div>
            `
        )
        .join('');
    }
  }

  // Public methods
  showMiniPlayer() {
    this.miniPlayer.show();
  }

  hideMiniPlayer() {
    this.miniPlayer.hide();
  }

  // Add track to queue and play it
  async addToQueueAndPlay(track) {
    // Ensure track has a proper ID
    if (!track.id) {
      console.error('Track missing ID:', track);
      track.id = `${track.title}_${track.artist}_${Date.now()}`;
    }

    // Convert ID to string for consistency
    track.id = String(track.id);

    // Ensure showPath is included if available
    if (!track.showPath && track.src) {
      console.log('Track missing showPath, will use from src if available');
    }

    // Ensure coverArt uses fallback if needed
    if (!track.coverArt && track.showPath) {
      track.coverArt = `${this.R2_BASE_URL}/${encodeURIComponent(
        track.showPath
      )}/folder.jpg`;
    } else if (!track.coverArt && track.showName) {
      track.coverArt = `${this.R2_BASE_URL}/${encodeURIComponent(
        track.showName
      )}/folder.jpg`;
    }

    // Check if track already exists in queue
    const existingIndex = this.queue.findIndex(t => String(t.id) === track.id);

    if (existingIndex === -1) {
      // Add new track to queue
      this.queue.push(track);
      await this.loadTrack(this.queue.length - 1);
    } else {
      // Track already in queue, just play it
      await this.loadTrack(existingIndex);
    }

    // Wait for track to be ready before playing
    if (this.trackReady) {
      this.audio.play().catch(err => {
        console.log('Play was prevented:', err);
        // Fallback: try playing after user interaction
        document.addEventListener(
          'click',
          () => {
            if (this.audio.paused && this.currentTrack) {
              this.audio.play().catch(e => console.log('Still blocked:', e));
            }
          },
          { once: true }
        );
      });
    } else {
      // Wait for loadeddata event
      this.audio.addEventListener(
        'loadeddata',
        () => {
          this.audio.play().catch(err => {
            console.log('Play was prevented after load:', err);
          });
        },
        { once: true }
      );
    }

    this.updateQueueDisplay();
    this.showMiniPlayer();
  }

  formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  getRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Add getter for audio player
  get audioPlayer() {
    return this.audio;
  }
}

// Expose player class globally for manual initialization
window.EerieCastPlayer = EerieCastPlayer;
