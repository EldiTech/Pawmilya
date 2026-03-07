import api from './api';
import CONFIG from '../config/config';

const { ENDPOINTS } = CONFIG;

class AdoptionService {
  // Create a new adoption application
  async createApplication(applicationData) {
    try {
      return await api.post(ENDPOINTS.CREATE_ADOPTION, applicationData);
    } catch (error) {
      throw error;
    }
  }

  // Get user's adoption applications
  async getMyApplications() {
    try {
      return await api.get(ENDPOINTS.MY_APPLICATIONS);
    } catch (error) {
      throw error;
    }
  }

  // Get single application by ID
  async getApplicationById(id) {
    try {
      const endpoint = ENDPOINTS.ADOPTION_BY_ID.replace(':id', id);
      return await api.get(endpoint);
    } catch (error) {
      throw error;
    }
  }

  // Cancel an adoption application
  async cancelApplication(id) {
    try {
      const endpoint = ENDPOINTS.CANCEL_ADOPTION.replace(':id', id);
      return await api.put(endpoint);
    } catch (error) {
      throw error;
    }
  }

  // Check if user has existing application for a pet
  async checkExistingApplication(petId) {
    try {
      const applications = await this.getMyApplications();
      if (applications.success && applications.data) {
        return applications.data.find(
          app => app.pet_id === petId && !['rejected', 'cancelled'].includes(app.status?.toLowerCase())
        );
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // Submit payment and delivery details for approved adoption
  async submitPaymentAndDelivery(paymentData) {
    try {
      const endpoint = ENDPOINTS.ADOPTION_PAYMENT.replace(':id', paymentData.adoptionId);
      return await api.post(endpoint, {
        deliveryDetails: paymentData.deliveryDetails,
        paymentAmount: paymentData.paymentAmount,
      });
    } catch (error) {
      throw error;
    }
  }
}

export const adoptionService = new AdoptionService();
export default adoptionService;
