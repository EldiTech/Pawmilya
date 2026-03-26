import AsyncStorage from '@react-native-async-storage/async-storage';
import CONFIG from '../config/config';

// Base API class for making HTTP requests
class ApiService {
  constructor() {
    this.baseURL = CONFIG.API_URL;
    this.timeout = CONFIG.TIMEOUT;
    // In-memory token cache to avoid hitting AsyncStorage on every request
    this._tokenCache = null;
    this._refreshTokenCache = null;
  }

  // Get auth token — uses in-memory cache first, falls back to AsyncStorage
  async getAuthToken() {
    if (this._tokenCache) return this._tokenCache;
    try {
      const token = await AsyncStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      this._tokenCache = token;
      return token;
    } catch (error) {
      return null;
    }
  }

  // Set auth token in storage and update cache
  async setAuthToken(token) {
    this._tokenCache = token;
    try {
      await AsyncStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, token);
    } catch (error) {
      // Silent fail
    }
  }

  // Remove auth token from storage and clear cache
  async removeAuthToken() {
    this._tokenCache = null;
    try {
      await AsyncStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    } catch (error) {
      // Silent fail
    }
  }

  // Build headers for requests
  async buildHeaders(customHeaders = {}) {
    const token = await this.getAuthToken();
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...customHeaders,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  // Get refresh token — uses in-memory cache first
  async getRefreshToken() {
    if (this._refreshTokenCache) return this._refreshTokenCache;
    try {
      const token = await AsyncStorage.getItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
      this._refreshTokenCache = token;
      return token;
    } catch (error) {
      return null;
    }
  }

  // Set refresh token in storage and update cache
  async setRefreshToken(token) {
    this._refreshTokenCache = token;
    try {
      await AsyncStorage.setItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN, token);
    } catch (error) {
      // Silent fail
    }
  }

  // Remove refresh token from storage and clear cache
  async removeRefreshToken() {
    this._refreshTokenCache = null;
    try {
      await AsyncStorage.removeItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
    } catch (error) {
      // Silent fail
    }
  }

  // Attempt to refresh the access token
  async refreshAccessToken() {
    try {
      const refreshToken = await this.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      
      if (data.token) {
        await this.setAuthToken(data.token);
      }
      if (data.refreshToken) {
        await this.setRefreshToken(data.refreshToken);
      }

      return data.token;
    } catch (error) {
      // Clear tokens on refresh failure
      this._tokenCache = null;
      this._refreshTokenCache = null;
      await this.removeAuthToken();
      await AsyncStorage.removeItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
      throw error;
    }
  }

  // Generic request method with automatic token refresh
  async request(endpoint, options = {}, retryCount = 0) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = await this.buildHeaders(options.headers);

    const config = {
      ...options,
      headers,
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      // Handle token expiration - attempt refresh once
      if (response.status === 401 && retryCount === 0 && !endpoint.includes('/auth/')) {
        try {
          await this.refreshAccessToken();
          // Retry the original request with new token
          return this.request(endpoint, options, 1);
        } catch (refreshError) {
          // Refresh failed, throw original error
          throw {
            status: 401,
            message: 'Session expired. Please login again.',
            errors: [],
          };
        }
      }

      if (!response.ok) {
        throw {
          status: response.status,
          message: data.message || data.error || 'An error occurred',
          errors: data.errors || data.details || [],
        };
      }

      return { success: true, data };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw { status: 408, message: 'Request timeout' };
      }
      throw error;
    }
  }

  // GET request
  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  // POST request
  async post(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // PUT request
  async put(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  // PATCH request
  async patch(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  // DELETE request
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Upload file (multipart/form-data)
  async upload(endpoint, formData) {
    const token = await this.getAuthToken();
    const headers = {
      'Accept': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${this.baseURL}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw {
          status: response.status,
          message: data.message || 'Upload failed',
        };
      }

      return { success: true, data };
    } catch (error) {
      throw error;
    }
  }
}

export const api = new ApiService();
export default api;
