import { djangoClient } from './djangoClient';

// Podcast entity service
export const Podcast = {
  // List podcasts with optional sorting and pagination
  async list(sort = null, limit = null, skip = null, fields = null) {
    const params = {};

    if (sort) params.ordering = sort;
    if (limit) params.limit = limit;
    if (skip) params.offset = skip;
    if (fields) params.fields = Array.isArray(fields) ? fields.join(',') : fields;

    return djangoClient.get('/podcasts/', params);
  },

  // Filter podcasts with query parameters
  async filter(query, sort = null, limit = null, skip = null, fields = null) {
    const params = { ...query };

    if (sort) params.ordering = sort;
    if (limit) params.limit = limit;
    if (skip) params.offset = skip;
    if (fields) params.fields = Array.isArray(fields) ? fields.join(',') : fields;

    return djangoClient.get('/podcasts/', params);
  },

  // Get a single podcast by ID
  async get(id) {
    return djangoClient.get(`/podcasts/${id}/`);
  },

  // Create a new podcast
  async create(data) {
    return djangoClient.post('/podcasts/', data);
  },

  // Update a podcast
  async update(id, data) {
    return djangoClient.patch(`/podcasts/${id}/`, data);
  },

  // Delete a podcast
  async delete(id) {
    return djangoClient.delete(`/podcasts/${id}/`);
  },

  // Bulk create podcasts
  async bulkCreate(data) {
    return djangoClient.post('/podcasts/bulk/', data);
  },

  // Delete multiple podcasts
  async deleteMany(ids) {
    return djangoClient.post('/podcasts/bulk-delete/', { ids });
  }
};

// Episode entity service
export const Episode = {
  async list(sort = null, limit = null, skip = null, fields = null) {
    const params = {};

    if (sort) params.ordering = sort;
    if (limit) params.limit = limit;
    if (skip) params.offset = skip;
    if (fields) params.fields = Array.isArray(fields) ? fields.join(',') : fields;

    return djangoClient.get('/episodes/', params);
  },

  async filter(query, sort = null, limit = null, skip = null, fields = null) {
    const params = { ...query };

    if (sort) params.ordering = sort;
    if (limit) params.limit = limit;
    if (skip) params.offset = skip;
    if (fields) params.fields = Array.isArray(fields) ? fields.join(',') : fields;

    return djangoClient.get('/episodes/', params);
  },

  async get(id) {
    return djangoClient.get(`/episodes/${id}/`);
  },

  async create(data) {
    return djangoClient.post('/episodes/', data);
  },

  async update(id, data) {
    return djangoClient.patch(`/episodes/${id}/`, data);
  },

  async delete(id) {
    return djangoClient.delete(`/episodes/${id}/`);
  },
};

// Creator entity service
export const Creator = {
  async list(sort = null, limit = null, skip = null, fields = null) {
    const params = {};

    if (sort) params.ordering = sort;
    if (limit) params.limit = limit;
    if (skip) params.offset = skip;
    if (fields) params.fields = Array.isArray(fields) ? fields.join(',') : fields;

    return djangoClient.get('/creators/', params);
  },

  async filter(query, sort = null, limit = null, skip = null, fields = null) {
    const params = { ...query };

    if (sort) params.ordering = sort;
    if (limit) params.limit = limit;
    if (skip) params.offset = skip;
    if (fields) params.fields = Array.isArray(fields) ? fields.join(',') : fields;

    return djangoClient.get('/creators/', params);
  },

  async get(id) {
    return djangoClient.get(`/creators/${id}/`);
  },

  // New: fetch featured creators (public)
  async featured(params = {}) {
    return djangoClient.get('/creators/featured/', params);
  },

  async create(data) {
    return djangoClient.post('/creators/', data);
  },

  async update(id, data) {
    return djangoClient.patch(`/creators/${id}/`, data);
  },

  async delete(id) {
    return djangoClient.delete(`/creators/${id}/`);
  }
};

// Category entity service
export const Category = {
  async list(sort = null, limit = null, skip = null, fields = null) {
    const params = {};

    if (sort) params.ordering = sort;
    if (limit) params.limit = limit;
    if (skip) params.offset = skip;
    if (fields) params.fields = Array.isArray(fields) ? fields.join(',') : fields;

    return djangoClient.get('/categories/', params);
  },

  async filter(query, sort = null, limit = null, skip = null, fields = null) {
    const params = { ...query };

    if (sort) params.ordering = sort;
    if (limit) params.limit = limit;
    if (skip) params.offset = skip;
    if (fields) params.fields = Array.isArray(fields) ? fields.join(',') : fields;

    return djangoClient.get('/categories/', params);
  },

  async get(id) {
    return djangoClient.get(`/categories/${id}/`);
  },

  async create(data) {
    return djangoClient.post('/categories/', data);
  },

  async update(id, data) {
    return djangoClient.patch(`/categories/${id}/`, data);
  },

  async delete(id) {
    return djangoClient.delete(`/categories/${id}/`);
  }
};

// User authentication service
export const User = {
  // Get current user profile
  async me() {
    return djangoClient.get('/auth/me/');
  },

  // Update current user profile
  async updateMe(data) {
    return djangoClient.patch('/auth/me/', data);
  },

  // Login user
  async login(credentials) {
    const response = await djangoClient.post('/auth/login/', credentials);
    if (response.access_token || response.token) {
      const token = response.access_token || response.token;
      djangoClient.setToken(token);
    }
    return response;
  },

  // Register new user
  async register(userData) {
    return djangoClient.post('/auth/register/', userData);
  },

  // Check if user is authenticated
  async isAuthenticated() {
    try {
      await this.me();
      return true;
    } catch {
      return false;
    }
  },

  // Set authentication token
  setToken(token) {
    djangoClient.setToken(token);
  },

  // Request password reset
  async requestPasswordReset(email) {
    return djangoClient.post('/auth/password-reset/', { email });
  },

  // Confirm password reset
  async confirmPasswordReset(token, newPassword) {
    return djangoClient.post('/auth/password-reset/confirm/', {
      token,
      new_password: newPassword
    });
  }
};

// Search service
export const Search = {
  // Search across all content types
  async search(query, filters = {}) {
    const params = { q: query, ...filters };
    return djangoClient.get('/search/', params);
  },

  // Search podcasts specifically
  async searchPodcasts(query, filters = {}) {
    const params = { q: query, ...filters };
    return djangoClient.get('/search/podcasts/', params);
  },

  // Search episodes specifically
  async searchEpisodes(query, filters = {}) {
    const params = { q: query, ...filters };
    return djangoClient.get('/search/episodes/', params);
  },

  // Search creators specifically
  async searchCreators(query, filters = {}) {
    const params = { q: query, ...filters };
    return djangoClient.get('/search/creators/', params);
  }
};

// Library/User interactions service
export const UserLibrary = {
  // Get user's favorites
  async getFavorites(type = null) {
    const params = type ? { type } : {};
    return djangoClient.get('/library/favorites/', params);
  },

  // Get favorites summary (episodes + podcasts with all episodes favorited)
  async getFavoritesSummary() {
    return djangoClient.get('/library/favorites/summary/');
  },

  // Add to favorites
  async addFavorite(contentType, contentId) {
    return djangoClient.post('/library/favorites/', {
      content_type: contentType,
      content_id: contentId
    });
  },

  // Remove from favorites
  async removeFavorite(contentType, contentId) {
    return djangoClient.delete(`/library/favorites/${contentType}/${contentId}/`);
  },

  // Get user's following list
  async getFollowing() {
    return djangoClient.get('/library/following/');
  },

  // Follow a creator
  async followCreator(creatorId) {
    return djangoClient.post('/library/following/', { creator_id: creatorId });
  },

  // Unfollow a creator
  async unfollowCreator(creatorId) {
    return djangoClient.delete(`/library/following/${creatorId}/`);
  },

  // Get followed podcasts
  async getFollowedPodcasts() {
    return djangoClient.get('/library/followings/podcasts/');
  },

  // Follow a podcast
  async followPodcast(podcastId) {
    return djangoClient.post('/library/followings/podcasts/', { podcast_id: podcastId });
  },

  // Check if following a podcast
  async getFollowedPodcast(podcastId) {
    return djangoClient.get(`/library/followings/podcasts/${podcastId}/`);
  },

  // Unfollow a podcast
  async unfollowPodcast(podcastId) {
    return djangoClient.delete(`/library/followings/podcasts/${podcastId}/`);
  },

  // List notifications for current user
  async getNotifications(params = {}) {
    return djangoClient.get('/library/notifications/', params);
  },

  // Mark a single notification as read
  async markNotificationRead(notificationId) {
    return djangoClient.post(`/library/notifications/${notificationId}/mark_read/`);
  },

  // Get listening history (request a generous page size to get all recent entries)
  async getHistory(limit = 100) {
    return djangoClient.get('/library/history/', { page_size: limit });
  },

  // Add to listening history (start or update an entry).
  // Uses PATCH which does get_or_create on the backend, avoiding
  // unique-constraint 400 errors when the entry already exists.
  async addToHistory(episodeId, progress = 0) {
    return djangoClient.patch(`/library/history/${episodeId}/`, {
      progress,
      event: 'play',
      source: 'web',
    });
  },

  // Update listening progress or send player event
  async updateProgress(episodeId, bodyOrProgress, duration = null) {
    // Backward compatible: allow updateProgress(id, progress, duration)
    const body =
      typeof bodyOrProgress === 'object'
        ? bodyOrProgress
        : { progress: bodyOrProgress, duration };
    return djangoClient.patch(`/library/history/${episodeId}/`, body);
  },

  // Resume latest across all podcasts
  async resumeLatest() {
    // Avoid calling if not authenticated
    if (!djangoClient.getToken()) return null;
    try {
      return await djangoClient.get('/library/history/resume/latest/');
    } catch (e) {
      // If unauthorized, treat as no resume data
      if (e && e.status === 401) return null;
      throw e;
    }
  },

  // Resume for a specific podcast
  async resumeForPodcast(podcastId) {
    // Avoid calling if not authenticated
    if (!djangoClient.getToken()) return null;
    try {
      return await djangoClient.get(`/library/history/resume/podcast/${podcastId}/`);
    } catch (e) {
      // If unauthorized, treat as no resume data
      if (e && e.status === 401) return null;
      throw e;
    }
  },

  // Optional: log player events
  async logEvent(eventBody) {
    return djangoClient.post('/library/history/events/', eventBody);
  }
};

// Playlists service
export const Playlist = {
  // List your playlists
  async list(params = {}) {
    // supports pagination or future filters
    return djangoClient.get('/library/playlists/', params);
  },

  // Create a new playlist
  async create(data) {
    // data: { name: string, episodes?: number[] }
    return djangoClient.post('/library/playlists/', data);
  },

  // Retrieve a single playlist
  async get(id) {
    return djangoClient.get(`/library/playlists/${id}/`);
  },

  // Replace a playlist (PUT)
  async replace(id, data) {
    return djangoClient.put(`/library/playlists/${id}/`, data);
  },

  // Update a playlist (PATCH)
  async update(id, data) {
    return djangoClient.patch(`/library/playlists/${id}/`, data);
  },

  // Delete a playlist
  async delete(id) {
    return djangoClient.delete(`/library/playlists/${id}/`);
  }
};
