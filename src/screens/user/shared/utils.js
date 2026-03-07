/**
 * Shared utility functions for user screens
 * Centralized helpers to eliminate code duplication
 */

import CONFIG from '../../../config/config';

/**
 * Get the base URL for static assets (without /api suffix)
 * @returns {string} Base URL for uploads/images
 */
export const getBaseUrl = () => CONFIG.API_URL.replace('/api', '');

/**
 * Get image URL - supports base64, full URLs, and legacy file paths
 * @param {string} imagePath - The image path or data URL
 * @param {string} placeholder - Optional placeholder URL
 * @returns {string} Fully qualified image URL
 */
export const getImageUrl = (imagePath, placeholder = null) => {
  if (!imagePath) return placeholder;
  
  // If it's a base64 data URL, use it directly
  if (imagePath.startsWith('data:image')) {
    return imagePath;
  }
  
  // If it's already a full URL, extract the path and rebuild with current base URL
  // This handles cases where the stored URL has a different host
  if (imagePath.startsWith('http')) {
    try {
      const url = new URL(imagePath);
      const path = url.pathname; // e.g., /uploads/pets/filename.jpg
      return `${getBaseUrl()}${path}`;
    } catch {
      return imagePath;
    }
  }
  
  // Remove /api from API_URL and append the image path
  const baseUrl = getBaseUrl();
  return `${baseUrl}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
};

/**
 * Get avatar URL with fallback handling
 * @param {string} avatar - Avatar path or URL
 * @param {string} placeholder - Optional placeholder URL
 * @returns {string} Fully qualified avatar URL
 */
export const getAvatarUrl = (avatar, placeholder = 'https://via.placeholder.com/200') => {
  return getImageUrl(avatar, placeholder);
};

/**
 * Get pet image URL with default placeholder
 * @param {string} imagePath - Pet image path
 * @returns {string} Fully qualified pet image URL
 */
export const getPetImageUrl = (imagePath) => {
  return getImageUrl(imagePath, 'https://via.placeholder.com/180x160?text=No+Image');
};

/**
 * Get shelter image with priority handling for different image fields
 * @param {Object} shelter - Shelter object with various image fields
 * @returns {string|null} Image URL or null if no image available
 */
export const getShelterImage = (shelter) => {
  if (!shelter) return null;
  
  // Priority: displayCoverImage (pre-processed) > cover_image (base64) > cover_image_url > cover_image_data > displayLogoImage > logo_image > logo_url > logo_image_data
  const imageUrl = shelter.displayCoverImage ||
                   shelter.cover_image || 
                   shelter.cover_image_url || 
                   shelter.cover_image_data ||
                   shelter.displayLogoImage ||
                   shelter.logo_image || 
                   shelter.logo_url ||
                   shelter.logo_image_data;
  
  if (!imageUrl) return null;
  
  return getImageUrl(imageUrl);
};

/**
 * Format date to localized string
 * @param {string} dateString - ISO date string
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatDate = (dateString, options = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', options);
  } catch {
    return '';
  }
};

/**
 * Get relative time ago string
 * @param {string} dateString - ISO date string
 * @returns {string} Relative time string (e.g., "2 days ago")
 */
export const getTimeAgo = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(dateString);
  } catch {
    return '';
  }
};

/**
 * Parse API response and extract data array
 * @param {Object|Array} response - API response
 * @returns {Array} Extracted data array
 */
export const parseApiResponse = (response) => {
  if (response?.success && Array.isArray(response.data)) {
    return response.data;
  }
  if (Array.isArray(response?.data)) {
    return response.data;
  }
  if (Array.isArray(response)) {
    return response;
  }
  return [];
};

/**
 * Check if error should be silently ignored (e.g., 403 suspension)
 * @param {Object} error - Error object
 * @returns {boolean} True if error should be ignored
 */
export const shouldIgnoreError = (error) => {
  return error?.status === 403;
};

/**
 * Handle API errors with optional console logging
 * @param {Object} error - Error object
 * @param {string} context - Context string for logging
 */
export const handleApiError = (error, context = '') => {
  if (!shouldIgnoreError(error)) {
    console.error(`[${context}] Error:`, error);
  }
};

/**
 * Create a cache-busting timestamp query parameter
 * @returns {number} Current timestamp
 */
export const getCacheBustingTimestamp = () => new Date().getTime();

/**
 * Build URL with cache-busting query parameter
 * @param {string} url - Base URL
 * @returns {string} URL with timestamp parameter
 */
export const withCacheBusting = (url) => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${getCacheBustingTimestamp()}`;
};

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) return text || '';
  return `${text.substring(0, maxLength)}...`;
};
