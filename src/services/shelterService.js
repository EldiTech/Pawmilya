import api from './api';
import CONFIG from '../config/config';

const { ENDPOINTS } = CONFIG;

class ShelterService {
  // Helper function to get the best available image URL
  getShelterImageUrl(shelter, type = 'cover') {
    if (!shelter) return null;
    
    if (type === 'cover') {
      // Priority: cover_image (base64) > cover_image_url > logo_image > logo_url
      const imageUrl = shelter.cover_image || shelter.cover_image_url || 
                       shelter.cover_image_data || shelter.logo_image || 
                       shelter.logo_url || shelter.logo_image_data;
      return this.normalizeImageUrl(imageUrl);
    } else if (type === 'logo') {
      // Priority: logo_image (base64) > logo_url > logo_image_data
      const imageUrl = shelter.logo_image || shelter.logo_url || shelter.logo_image_data;
      return this.normalizeImageUrl(imageUrl);
    }
    return null;
  }

  // Normalize image URL (handle base64 and regular URLs)
  normalizeImageUrl(imageUrl) {
    if (!imageUrl) return null;
    
    // If it's already a base64 image or a full URL, return as is
    if (imageUrl.startsWith('data:image') || imageUrl.startsWith('http')) {
      return imageUrl;
    }
    
    // If it's a relative path, prepend the base URL
    const baseUrl = CONFIG.API_URL.replace('/api', '');
    return `${baseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
  }

  // Process shelter data to include proper image URLs
  processShelterData(shelter) {
    if (!shelter) return null;
    
    return {
      ...shelter,
      displayCoverImage: this.getShelterImageUrl(shelter, 'cover'),
      displayLogoImage: this.getShelterImageUrl(shelter, 'logo'),
    };
  }

  // Get all shelters
  async getShelters(filters = {}) {
    try {
      const params = {};
      
      if (filters.search) params.search = filters.search;
      if (filters.city) params.city = filters.city;
      if (filters.page) params.page = filters.page;
      if (filters.limit) params.limit = filters.limit;

      const response = await api.get(ENDPOINTS.SHELTERS, params);
      
      // Process shelters to include proper image URLs
      if (Array.isArray(response)) {
        return response.map(shelter => this.processShelterData(shelter));
      } else if (response.data && Array.isArray(response.data)) {
        return {
          ...response,
          data: response.data.map(shelter => this.processShelterData(shelter))
        };
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Get single shelter by ID
  async getShelterById(shelterId) {
    try {
      const endpoint = ENDPOINTS.SHELTER_BY_ID.replace(':id', shelterId);
      const response = await api.get(endpoint);
      return this.processShelterData(response);
    } catch (error) {
      throw error;
    }
  }

  // Get nearby shelters
  async getNearbyShelters(latitude, longitude, radius = 20) {
    try {
      const response = await api.get(ENDPOINTS.NEARBY_SHELTERS, {
        lat: latitude,
        lng: longitude,
        radius,
      });
      
      // Process shelters to include proper image URLs
      if (Array.isArray(response)) {
        return response.map(shelter => this.processShelterData(shelter));
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Get pets from a specific shelter
  async getShelterPets(shelterId, filters = {}) {
    try {
      const endpoint = `${ENDPOINTS.SHELTERS}/${shelterId}/pets`;
      return await api.get(endpoint, filters);
    } catch (error) {
      throw error;
    }
  }

  // =====================================================
  // SHELTER TRANSFER METHODS
  // =====================================================

  // Get available shelters for transfer (active, verified, with capacity)
  async getAvailableShelters() {
    try {
      const response = await api.get(ENDPOINTS.AVAILABLE_SHELTERS);
      
      // API returns { success: true, data: [...] }
      const shelters = response.data || response;
      
      // Process shelters to include proper image URLs
      if (Array.isArray(shelters)) {
        return shelters.map(shelter => this.processShelterData(shelter));
      }
      
      // If response is not an array, return empty array
      console.log('getAvailableShelters - unexpected response:', response);
      return [];
    } catch (error) {
      console.error('getAvailableShelters error:', error);
      throw error;
    }
  }

  // Create a shelter transfer request
  async createTransferRequest(rescueReportId, shelterId, notes = '', urgency = 'normal') {
    try {
      const response = await api.post(ENDPOINTS.SHELTER_TRANSFER_REQUEST, {
        rescue_report_id: rescueReportId,
        shelter_id: shelterId,
        notes,
        urgency
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Get user's transfer requests
  async getMyTransferRequests() {
    try {
      return await api.get(ENDPOINTS.MY_TRANSFER_REQUESTS);
    } catch (error) {
      throw error;
    }
  }

  // Cancel a pending transfer request
  async cancelTransferRequest(requestId) {
    try {
      const endpoint = ENDPOINTS.CANCEL_TRANSFER_REQUEST.replace(':id', requestId);
      return await api.put(endpoint);
    } catch (error) {
      throw error;
    }
  }

  // =====================================================
  // SHELTER APPLICATION METHODS
  // =====================================================

  // Submit a shelter application
  async submitShelterApplication(applicationData) {
    try {
      return await api.post(ENDPOINTS.SHELTER_APPLICATIONS, applicationData);
    } catch (error) {
      throw error;
    }
  }

  // Get current user's shelter application
  async getMyShelterApplication() {
    try {
      return await api.get(ENDPOINTS.MY_SHELTER_APPLICATION);
    } catch (error) {
      throw error;
    }
  }

  // =====================================================
  // SHELTER MANAGER METHODS
  // =====================================================

  // Check if current user is a shelter manager
  async getShelterManagerStatus() {
    try {
      return await api.get(ENDPOINTS.SHELTER_MANAGER_STATUS);
    } catch (error) {
      throw error;
    }
  }

  // Get managed shelter details
  async getManagedShelter() {
    try {
      return await api.get(ENDPOINTS.SHELTER_MANAGER_MY_SHELTER);
    } catch (error) {
      throw error;
    }
  }

  // Update managed shelter
  async updateManagedShelter(data) {
    try {
      return await api.put(ENDPOINTS.SHELTER_MANAGER_MY_SHELTER, data);
    } catch (error) {
      throw error;
    }
  }

  // Get pets in managed shelter
  async getManagedShelterPets() {
    try {
      return await api.get(ENDPOINTS.SHELTER_MANAGER_PETS);
    } catch (error) {
      throw error;
    }
  }

  // Get transfer requests for managed shelter
  async getManagedShelterTransfers() {
    try {
      return await api.get(ENDPOINTS.SHELTER_MANAGER_TRANSFERS);
    } catch (error) {
      throw error;
    }
  }

  // Respond to a transfer request
  async respondToTransferRequest(requestId, status, notes = '') {
    try {
      const endpoint = `${ENDPOINTS.SHELTER_MANAGER_TRANSFERS}/${requestId}`;
      return await api.patch(endpoint, { status, notes });
    } catch (error) {
      throw error;
    }
  }
}

export const shelterService = new ShelterService();
export default shelterService;
