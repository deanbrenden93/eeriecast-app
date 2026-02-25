// Django API Client
class DjangoAPIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'DjangoAPIError';
    this.status = status;
    this.data = data;
  }
}

class DjangoAPIClient {
  constructor(baseURL, options = {}) {
    this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash
    this.token = null;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers
    };
  }

  setToken(token) {
    this.token = token;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem('django_access_token', token);
      } catch (error) {
        console.error('Failed to save token to localStorage:', error);
      }
    }
  }

  getToken() {
    if (this.token) return this.token;

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        this.token = window.localStorage.getItem('django_access_token');
        return this.token;
      } catch (error) {
        console.error('Failed to retrieve token from localStorage:', error);
      }
    }
    return null;
  }

  removeToken() {
    this.token = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem('django_access_token');
      } catch (error) {
        console.error('Failed to remove token from localStorage:', error);
      }
    }
  }

  getHeaders(customHeaders = {}) {
    const headers = { ...this.defaultHeaders, ...customHeaders };
    const token = this.getToken();

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      method: 'GET',
      ...options,
      headers: this.getHeaders(options.headers)
    };

    // Handle FormData (for file uploads)
    if (config.body instanceof FormData) {
      delete config.headers['Content-Type']; // Let browser set it for FormData
    } else if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: response.statusText };
        }

        throw new DjangoAPIError(
          errorData.message || errorData.detail || `HTTP ${response.status}`,
          response.status,
          errorData
        );
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return null;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof DjangoAPIError) {
        throw error;
      }
      throw new DjangoAPIError(error.message, 0, null);
    }
  }

  // HTTP method helpers
  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url);
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: data
    });
  }

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data
    });
  }

  async patch(endpoint, data) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: data
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE'
    });
  }
}

// Create and configure the Django API client
//const API_BASE_URL = 'http://localhost:8012/api';
const API_BASE_URL = 'https://backend.eeriecasts.bitbenders.com/api';


export const djangoClient = new DjangoAPIClient(API_BASE_URL);

// Auto-load token on initialization
if (typeof window !== 'undefined') {
  const token = djangoClient.getToken();
  if (token) {
    djangoClient.setToken(token);
  }
}

export { DjangoAPIError };
