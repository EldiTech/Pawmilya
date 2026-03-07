import api from './api';
import CONFIG from '../config/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { ENDPOINTS, STORAGE_KEYS } = CONFIG;

class AuthService {
  // Register a new user
  async register(userData) {
    try {
      const response = await api.post(ENDPOINTS.REGISTER, {
        full_name: userData.fullName,
        email: userData.email,
        phone: userData.phoneNumber,
        password: userData.password,
      });

      if (response.success && response.data.token) {
        await this.saveAuthData(response.data);
      }

      return response;
    } catch (error) {
      throw error;
    }
  }

  // Login user
  async login(credentials) {
    try {
      const response = await api.post(ENDPOINTS.LOGIN, {
        email: credentials.email,
        password: credentials.password,
      });

      if (response.success && response.data.token) {
        await this.saveAuthData(response.data);
      }

      return response;
    } catch (error) {
      throw error;
    }
  }

  // Logout user
  async logout() {
    try {
      await api.post(ENDPOINTS.LOGOUT);
    } catch (error) {
      // Continue with local logout even if server request fails
    } finally {
      await this.clearAuthData();
    }
  }

  // Save authentication data to storage
  async saveAuthData(data) {
    try {
      if (data.token) {
        await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, data.token);
      }
      if (data.refreshToken) {
        await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
      }
      if (data.user) {
        await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));
      }
    } catch (error) {
      // Silent fail for storage errors
    }
  }

  // Clear authentication data from storage
  async clearAuthData() {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER_DATA,
      ]);
    } catch (error) {
      // Silent fail
    }
  }

  // Get stored user data
  async getStoredUser() {
    try {
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      return null;
    }
  }

  // Get stored token
  async getStoredToken() {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      return token || null;
    } catch (error) {
      return null;
    }
  }

  // Check if user is authenticated
  async isAuthenticated() {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      return !!token;
    } catch (error) {
      return false;
    }
  }

  // Refresh access token
  async refreshToken() {
    try {
      const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      
      if (!refreshToken) {
        throw { message: 'No refresh token available' };
      }

      const response = await api.post(ENDPOINTS.REFRESH_TOKEN, { refreshToken });

      if (response.success && response.data.token) {
        await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, response.data.token);
      }

      return response;
    } catch (error) {
      await this.clearAuthData();
      throw error;
    }
  }

  // Forgot password
  async forgotPassword(email) {
    try {
      return await api.post(ENDPOINTS.FORGOT_PASSWORD, { email });
    } catch (error) {
      throw error;
    }
  }

  // Reset password
  async resetPassword(token, newPassword) {
    try {
      return await api.post(ENDPOINTS.RESET_PASSWORD, { token, newPassword });
    } catch (error) {
      throw error;
    }
  }
}

export const authService = new AuthService();
export default authService;
