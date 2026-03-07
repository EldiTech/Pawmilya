/**
 * Shared Admin Utility Functions
 * Common helper functions used across admin screens
 */

/**
 * Format a date to a readable string
 * @param {string} dateString - The date string to format
 * @param {object} options - Optional formatting options
 * @returns {string} Formatted date string
 */
export const formatDate = (dateString, options = {}) => {
  if (!dateString) return options.fallback || 'N/A';
  
  const date = new Date(dateString);
  
  if (options.includeTime) {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Format time ago from a date
 * @param {string} dateString - The date string
 * @returns {string} Relative time string (e.g., "5m ago", "2h ago")
 */
export const formatTimeAgo = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
};

/**
 * Format a number with k/m suffix for large numbers
 * @param {number} num - The number to format
 * @returns {string} Formatted number string
 */
export const formatNumber = (num) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'm';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return String(num);
};

/**
 * Create a debounced function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Debounce wait time in ms
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait = 300) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
};

/**
 * Filter items based on search query and filter key
 * @param {Array} items - Array of items to filter
 * @param {object} options - Filter options
 * @returns {Array} Filtered items
 */
export const filterItems = (items, { searchQuery = '', searchFields = [], filterKey = 'all', filterField = 'status' }) => {
  return items.filter(item => {
    // Search filtering
    const matchSearch = !searchQuery || searchFields.some(field => 
      item[field]?.toLowerCase?.().includes(searchQuery.toLowerCase())
    );
    
    // Status/type filtering
    const matchFilter = filterKey === 'all' || item[filterField] === filterKey;
    
    return matchSearch && matchFilter;
  });
};

/**
 * Get count of items by a specific field value
 * @param {Array} items - Array of items
 * @param {string} field - Field to count by
 * @param {string} value - Value to match
 * @returns {number} Count of matching items
 */
export const getCountByField = (items, field, value) => {
  if (value === 'all') return items.length;
  return items.filter(item => item[field] === value).length;
};

/**
 * Generate avatar URL from name
 * @param {string} name - User's name
 * @param {string} bgColor - Background color (hex without #)
 * @returns {string} Avatar URL
 */
export const generateAvatarUrl = (name, bgColor = 'FF8C42') => {
  const encodedName = encodeURIComponent(name || 'User');
  return `https://ui-avatars.com/api/?name=${encodedName}&background=${bgColor}&color=fff&size=128`;
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Whether email is valid
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} Whether phone is valid
 */
export const isValidPhone = (phone) => {
  if (!phone) return true; // Phone is optional
  const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

/**
 * Truncate text to a maximum length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Create API request headers
 * @param {string} token - Authorization token
 * @returns {object} Headers object
 */
export const createHeaders = (token) => ({
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
});

/**
 * Handle API response
 * @param {Response} response - Fetch response
 * @returns {Promise<object>} Parsed response data
 */
export const handleApiResponse = async (response) => {
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Request failed');
  }
  
  return data;
};

/**
 * Sort items by a field
 * @param {Array} items - Items to sort
 * @param {string} field - Field to sort by
 * @param {string} order - Sort order ('asc' or 'desc')
 * @returns {Array} Sorted items
 */
export const sortItems = (items, field, order = 'desc') => {
  return [...items].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];
    
    // Handle dates
    if (field.includes('date') || field.includes('_at')) {
      const aDate = new Date(aVal || 0);
      const bDate = new Date(bVal || 0);
      return order === 'asc' ? aDate - bDate : bDate - aDate;
    }
    
    // Handle strings
    if (typeof aVal === 'string') {
      return order === 'asc' 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    }
    
    // Handle numbers
    return order === 'asc' ? aVal - bVal : bVal - aVal;
  });
};

/**
 * Group items by a field
 * @param {Array} items - Items to group
 * @param {string} field - Field to group by
 * @returns {object} Grouped items
 */
export const groupBy = (items, field) => {
  return items.reduce((groups, item) => {
    const key = item[field] || 'unknown';
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {});
};

/**
 * Get image URL - supports base64 and legacy file paths
 * @param {string} imagePath - The image path or URL
 * @param {string} apiUrl - The API base URL
 * @returns {string|null} The full image URL or null
 */
export const getImageUrl = (imagePath, apiUrl) => {
  if (!imagePath) return null;
  
  // If it's a base64 data URL, use it directly
  if (typeof imagePath === 'string' && imagePath.startsWith('data:image')) {
    return imagePath;
  }
  
  // If it's already a full URL, extract the path and rebuild with current base URL
  if (typeof imagePath === 'string' && imagePath.startsWith('http')) {
    try {
      const url = new URL(imagePath);
      const path = url.pathname;
      const baseUrl = apiUrl.replace('/api', '');
      return `${baseUrl}${path}`;
    } catch {
      return imagePath;
    }
  }
  
  // Build URL from relative path
  if (typeof imagePath === 'string') {
    const baseUrl = apiUrl.replace('/api', '');
    return `${baseUrl}${imagePath}`;
  }
  
  return null;
};