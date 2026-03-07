import api from './api';
import CONFIG from '../config/config';

const { ENDPOINTS } = CONFIG;

class UserService {
  // Check user suspension status
  async checkStatus() {
    try {
      return await api.get(ENDPOINTS.USER_STATUS);
    } catch (error) {
      throw error;
    }
  }

  // Get current user profile
  async getProfile() {
    try {
      return await api.get(ENDPOINTS.USER_PROFILE);
    } catch (error) {
      throw error;
    }
  }

  // Update user profile
  async updateProfile(profileData) {
    try {
      return await api.put(ENDPOINTS.UPDATE_PROFILE, profileData);
    } catch (error) {
      throw error;
    }
  }

  // Upload avatar - converts to base64 and stores in database
  async uploadAvatar(imageUri) {
    try {
      // Convert image URI to base64
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64data = reader.result;
            const result = await api.post(ENDPOINTS.UPLOAD_AVATAR, { avatar: base64data });
            resolve(result);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      throw error;
    }
  }

  // Change password
  async changePassword(currentPassword, newPassword) {
    try {
      return await api.put(ENDPOINTS.CHANGE_PASSWORD, { 
        current_password: currentPassword, 
        new_password: newPassword 
      });
    } catch (error) {
      throw error;
    }
  }

  // Get user's favorite pets
  async getFavorites() {
    try {
      return await api.get(ENDPOINTS.USER_FAVORITES);
    } catch (error) {
      throw error;
    }
  }

  // Add pet to favorites
  async addFavorite(petId) {
    try {
      return await api.post(ENDPOINTS.ADD_FAVORITE, { pet_id: petId });
    } catch (error) {
      throw error;
    }
  }

  // Remove pet from favorites
  async removeFavorite(petId) {
    try {
      const endpoint = ENDPOINTS.REMOVE_FAVORITE.replace(':id', petId);
      return await api.delete(endpoint);
    } catch (error) {
      throw error;
    }
  }

  // Get user's adoption applications
  async getApplications() {
    try {
      return await api.get(ENDPOINTS.MY_APPLICATIONS);
    } catch (error) {
      throw error;
    }
  }

  // Get single adoption application
  async getApplicationById(applicationId) {
    try {
      const endpoint = ENDPOINTS.ADOPTION_BY_ID.replace(':id', applicationId);
      return await api.get(endpoint);
    } catch (error) {
      throw error;
    }
  }

  // Create adoption application
  async createAdoption(adoptionData) {
    try {
      return await api.post(ENDPOINTS.CREATE_ADOPTION, adoptionData);
    } catch (error) {
      throw error;
    }
  }

  // Cancel adoption application
  async cancelAdoption(applicationId) {
    try {
      const endpoint = ENDPOINTS.CANCEL_ADOPTION.replace(':id', applicationId);
      return await api.put(endpoint);
    } catch (error) {
      throw error;
    }
  }

  // Get all users (for admin - temporary without auth)
  async getAllUsers() {
    try {
      return await api.get(ENDPOINTS.ALL_USERS);
    } catch (error) {
      throw error;
    }
  }

  // Get user's notifications
  async getNotifications() {
    try {
      return await api.get(ENDPOINTS.USER_NOTIFICATIONS);
    } catch (error) {
      throw error;
    }
  }

  // Get unread notifications count
  async getUnreadNotificationsCount() {
    try {
      return await api.get(ENDPOINTS.UNREAD_NOTIFICATIONS_COUNT);
    } catch (error) {
      throw error;
    }
  }

  // Mark notification as read
  async markNotificationAsRead(notificationId) {
    try {
      const endpoint = ENDPOINTS.MARK_NOTIFICATION_READ.replace(':id', notificationId);
      return await api.put(endpoint);
    } catch (error) {
      throw error;
    }
  }

  // Mark all notifications as read
  async markAllNotificationsAsRead() {
    try {
      return await api.put(ENDPOINTS.MARK_ALL_NOTIFICATIONS_READ);
    } catch (error) {
      throw error;
    }
  }
}

export const userService = new UserService();
export default userService;
