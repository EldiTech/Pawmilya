import api from './api';
import CONFIG from '../config/config';

const { ENDPOINTS } = CONFIG;

class AdminService {
  // ==================== DASHBOARD ====================
  
  // Get dashboard statistics
  async getDashboardStats() {
    try {
      return await api.get(ENDPOINTS.ADMIN_DASHBOARD_STATS);
    } catch (error) {
      throw error;
    }
  }

  // ==================== PETS MANAGEMENT ====================
  
  // Get all pets for admin
  async getPets(filters = {}) {
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      if (filters.limit) params.limit = filters.limit;
      if (filters.offset) params.offset = filters.offset;

      return await api.get(ENDPOINTS.ADMIN_PETS, params);
    } catch (error) {
      throw error;
    }
  }

  // Create new pet
  async createPet(petData) {
    try {
      return await api.post(ENDPOINTS.ADMIN_PETS, petData);
    } catch (error) {
      throw error;
    }
  }

  // Update pet
  async updatePet(petId, petData) {
    try {
      const endpoint = ENDPOINTS.ADMIN_PET_BY_ID.replace(':id', petId);
      return await api.put(endpoint, petData);
    } catch (error) {
      throw error;
    }
  }

  // Delete pet
  async deletePet(petId) {
    try {
      const endpoint = ENDPOINTS.ADMIN_PET_BY_ID.replace(':id', petId);
      return await api.delete(endpoint);
    } catch (error) {
      throw error;
    }
  }

  // ==================== USERS MANAGEMENT ====================
  
  // Get all users
  async getUsers(filters = {}) {
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      if (filters.limit) params.limit = filters.limit;
      if (filters.offset) params.offset = filters.offset;

      return await api.get(ENDPOINTS.ADMIN_USERS, params);
    } catch (error) {
      throw error;
    }
  }

  // Update user status (suspend/activate)
  async updateUserStatus(userId, status, reason = null) {
    try {
      const endpoint = ENDPOINTS.ADMIN_USER_STATUS.replace(':id', userId);
      return await api.put(endpoint, { status, reason });
    } catch (error) {
      throw error;
    }
  }

  // ==================== ADOPTIONS MANAGEMENT ====================
  
  // Get all adoption applications
  async getAdoptions(filters = {}) {
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.limit) params.limit = filters.limit;
      if (filters.offset) params.offset = filters.offset;

      return await api.get(ENDPOINTS.ADMIN_ADOPTIONS, params);
    } catch (error) {
      throw error;
    }
  }

  // Update adoption application status
  async updateAdoptionStatus(applicationId, status, reviewNotes = null, rejectionReason = null) {
    try {
      const endpoint = ENDPOINTS.ADMIN_ADOPTION_STATUS.replace(':id', applicationId);
      return await api.put(endpoint, { 
        status, 
        review_notes: reviewNotes,
        rejection_reason: rejectionReason 
      });
    } catch (error) {
      throw error;
    }
  }

  // ==================== RESCUES MANAGEMENT ====================
  
  // Get all rescue reports
  async getRescues(filters = {}) {
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.limit) params.limit = filters.limit;
      if (filters.offset) params.offset = filters.offset;

      return await api.get(ENDPOINTS.ADMIN_RESCUES, params);
    } catch (error) {
      throw error;
    }
  }

  // Update rescue report status
  async updateRescueStatus(reportId, status, resolutionNotes = null) {
    try {
      const endpoint = ENDPOINTS.ADMIN_RESCUE_STATUS.replace(':id', reportId);
      return await api.put(endpoint, { status, resolution_notes: resolutionNotes });
    } catch (error) {
      throw error;
    }
  }
}

export const adminService = new AdminService();
export default adminService;
