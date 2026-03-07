import api from './api';
import CONFIG from '../config/config';

const { ENDPOINTS } = CONFIG;

// Helper function to convert image URI to base64
const imageUriToBase64 = async (uri) => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return null;
  }
};

class RescueService {
  // Get all rescue reports
  async getRescueReports(filters = {}) {
    try {
      const params = {};
      
      if (filters.status) params.status = filters.status;
      if (filters.urgency) params.urgency = filters.urgency;
      if (filters.location) params.location = filters.location;
      if (filters.page) params.page = filters.page;
      if (filters.limit) params.limit = filters.limit;

      return await api.get(ENDPOINTS.RESCUE_REPORTS, params);
    } catch (error) {
      throw error;
    }
  }

  // Get rescue statistics
  async getRescueStats() {
    try {
      return await api.get(ENDPOINTS.RESCUE_STATS);
    } catch (error) {
      throw error;
    }
  }

  // Get single rescue report
  async getRescueReportById(reportId) {
    try {
      const endpoint = ENDPOINTS.RESCUE_REPORT_BY_ID.replace(':id', reportId);
      return await api.get(endpoint);
    } catch (error) {
      throw error;
    }
  }

  // Create rescue report
  async createRescueReport(reportData) {
    try {
      const payload = {
        title: reportData.title,
        description: reportData.description,
        animal_type: reportData.animalType,
        estimated_count: reportData.estimatedCount || 1,
        condition: reportData.condition,
        urgency: reportData.urgency || 'normal',
        location_description: reportData.location,
        address: reportData.address,
        city: reportData.city,
        latitude: reportData.latitude,
        longitude: reportData.longitude,
        reporter_name: reportData.reporter_name || reportData.reporterName,
        reporter_phone: reportData.reporter_phone || reportData.reporterPhone,
        reporter_email: reportData.reporter_email || reportData.reporterEmail,
        images: reportData.images || [],
      };
      
      return await api.post(ENDPOINTS.CREATE_RESCUE_REPORT, payload);
    } catch (error) {
      throw error;
    }
  }

  // Volunteer for rescue
  async volunteerForRescue(reportId) {
    try {
      const endpoint = ENDPOINTS.VOLUNTEER_FOR_RESCUE.replace(':id', reportId);
      return await api.post(endpoint);
    } catch (error) {
      throw error;
    }
  }

  // Upload rescue report images - converts to base64 and stores in database
  async uploadRescueImages(reportId, images) {
    try {
      // Convert all images to base64
      const base64Images = await Promise.all(
        images.map(async (image) => {
          // If already base64, use directly
          if (typeof image === 'string' && image.startsWith('data:image')) {
            return image;
          }
          // Convert URI to base64
          return await imageUriToBase64(image.uri);
        })
      );

      // Filter out failed conversions
      const validImages = base64Images.filter(img => img !== null);

      const endpoint = `${ENDPOINTS.RESCUE_REPORTS}/${reportId}/images`;
      return await api.post(endpoint, { images: validImages });
    } catch (error) {
      throw error;
    }
  }

  // Create rescue report with images - converts to base64 and stores in database
  async createRescueReportWithImages(reportData, images = []) {
    try {
      // Convert all images to base64
      const base64Images = await Promise.all(
        images.map(async (image) => {
          // If already base64, use directly
          if (typeof image === 'string' && image.startsWith('data:image')) {
            return image;
          }
          // Convert URI to base64
          return await imageUriToBase64(image.uri);
        })
      );

      // Filter out failed conversions
      const validImages = base64Images.filter(img => img !== null);

      const payload = {
        title: reportData.title,
        description: reportData.description,
        location_description: reportData.location,
        animal_type: reportData.animalType,
        urgency: reportData.urgency,
        address: reportData.address,
        city: reportData.city,
        condition: reportData.condition,
        estimated_count: reportData.estimatedCount,
        reporter_name: reportData.reporterName,
        reporter_phone: reportData.reporterPhone,
        reporter_email: reportData.reporterEmail,
        images: validImages,
      };

      const endpoint = `${ENDPOINTS.RESCUE_REPORTS}/with-images`;
      return await api.post(endpoint, payload);
    } catch (error) {
      throw error;
    }
  }

  // Get nearby rescue reports
  async getNearbyRescueReports(latitude, longitude, radius = 10) {
    try {
      return await api.get(ENDPOINTS.RESCUE_REPORTS, {
        lat: latitude,
        lng: longitude,
        radius,
        status: 'active',
      });
    } catch (error) {
      throw error;
    }
  }

  // Respond to a rescue (accept/decline)
  async respondToRescue(reportId, rescuerId, action, declineReason = null) {
    try {
      const endpoint = `${ENDPOINTS.RESCUE_REPORTS}/${reportId}/respond`;
      return await api.put(endpoint, {
        rescuer_id: rescuerId,
        action,
        decline_reason: declineReason,
      });
    } catch (error) {
      throw error;
    }
  }

  // Update rescue status (arrived, rescued, cannot_complete)
  async updateRescueStatus(reportId, status, notes = null, completionPhoto = null) {
    try {
      const endpoint = `${ENDPOINTS.RESCUE_REPORTS}/${reportId}/status`;
      return await api.put(endpoint, {
        status,
        notes,
        completion_photo: completionPhoto,
      });
    } catch (error) {
      throw error;
    }
  }

  // Get rescuer's assigned rescues
  async getMyRescues() {
    try {
      const endpoint = `${ENDPOINTS.RESCUE_REPORTS}/rescuer/my-rescues`;
      return await api.get(endpoint);
    } catch (error) {
      throw error;
    }
  }

  // Rescuer requests to adopt a rescued animal
  async requestRescuerAdoption(reportId, notes = null) {
    try {
      const endpoint = `${ENDPOINTS.RESCUE_REPORTS}/${reportId}/rescuer-adopt`;
      return await api.post(endpoint, { notes });
    } catch (error) {
      throw error;
    }
  }
}

export const rescueService = new RescueService();
export default rescueService;
