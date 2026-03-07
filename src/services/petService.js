import api from './api';
import CONFIG from '../config/config';

const { ENDPOINTS } = CONFIG;

class PetService {
  // Get all pets with optional filters
  async getPets(filters = {}) {
    try {
      const params = {};
      
      if (filters.search) params.search = filters.search;
      if (filters.category) params.category = filters.category;
      if (filters.breed) params.breed = filters.breed;
      if (filters.age) params.age = filters.age;
      if (filters.gender) params.gender = filters.gender;
      if (filters.size) params.size = filters.size;
      if (filters.location) params.location = filters.location;
      if (filters.page) params.page = filters.page;
      if (filters.limit) params.limit = filters.limit;
      if (filters.sortBy) params.sortBy = filters.sortBy;
      if (filters.sortOrder) params.sortOrder = filters.sortOrder;
      if (filters.offset) params.offset = filters.offset;

      return await api.get(ENDPOINTS.PETS, params);
    } catch (error) {
      throw error;
    }
  }

  // Get featured pets for homepage
  async getFeaturedPets(limit = 6) {
    try {
      return await api.get(ENDPOINTS.FEATURED_PETS, { limit });
    } catch (error) {
      throw error;
    }
  }

  // Get pet categories
  async getCategories() {
    try {
      return await api.get(ENDPOINTS.PET_CATEGORIES);
    } catch (error) {
      throw error;
    }
  }

  // Get breeds by category
  async getBreeds(categoryId) {
    try {
      const endpoint = ENDPOINTS.PET_BREEDS.replace(':categoryId', categoryId);
      return await api.get(endpoint);
    } catch (error) {
      throw error;
    }
  }

  // Get single pet by ID
  async getPetById(petId) {
    try {
      const endpoint = ENDPOINTS.PET_BY_ID.replace(':id', petId);
      return await api.get(endpoint);
    } catch (error) {
      throw error;
    }
  }

  // Search pets
  async searchPets(query, filters = {}) {
    try {
      return await api.get(ENDPOINTS.PETS, {
        search: query,
        ...filters,
      });
    } catch (error) {
      throw error;
    }
  }

  // Get pets by category (dogs, cats, etc.)
  async getPetsByCategory(category, page = 1, limit = 10) {
    try {
      return await api.get(ENDPOINTS.PETS, { category, page, limit });
    } catch (error) {
      throw error;
    }
  }

  // Get nearby pets based on location
  async getNearbyPets(latitude, longitude, radius = 10) {
    try {
      return await api.get(ENDPOINTS.PETS, {
        lat: latitude,
        lng: longitude,
        radius,
      });
    } catch (error) {
      throw error;
    }
  }
}

export const petService = new PetService();
export default petService;
