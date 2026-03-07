/**
 * Geocoding Utility Module
 * Provides robust reverse geocoding with retry logic, fallbacks, and consistent address formatting
 */

// Geocoding configuration
export const GEOCODING_CONFIG = {
  // Primary provider: Nominatim (OpenStreetMap)
  NOMINATIM_URL: 'https://nominatim.openstreetmap.org',
  
  // App identification (required by Nominatim usage policy)
  USER_AGENT: 'PawmilyaApp/1.0 (Animal Rescue Application)',
  
  // Rate limiting (Nominatim requires max 1 request/second)
  MIN_REQUEST_INTERVAL: 1100, // ms between requests
  
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1500, // ms
  
  // Request timeout
  TIMEOUT: 10000, // 10 seconds
};

// Track last request time for rate limiting
let lastRequestTime = 0;

/**
 * Wait for rate limit if needed
 */
const waitForRateLimit = async () => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < GEOCODING_CONFIG.MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => 
      setTimeout(resolve, GEOCODING_CONFIG.MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }
  lastRequestTime = Date.now();
};

/**
 * Format address from Nominatim response for Philippine addresses
 * Prioritizes local address components for better readability
 */
export const formatAddress = (data) => {
  if (!data) return null;
  
  // If display_name exists and looks good, use it but clean it up
  if (data.display_name) {
    // For Philippine addresses, we want a cleaner format
    const addr = data.address;
    if (addr) {
      const parts = [];
      
      // Building/House details
      if (addr.building) parts.push(addr.building);
      if (addr.house_number) parts.push(addr.house_number);
      
      // Street
      if (addr.road || addr.street) parts.push(addr.road || addr.street);
      
      // Neighborhood/Subdivision
      if (addr.neighbourhood) parts.push(addr.neighbourhood);
      if (addr.subdivision) parts.push(addr.subdivision);
      
      // Barangay (common in Philippines)
      if (addr.suburb) parts.push(addr.suburb);
      if (addr.quarter) parts.push(addr.quarter);
      
      // City/Municipality
      if (addr.city || addr.town || addr.municipality || addr.village) {
        parts.push(addr.city || addr.town || addr.municipality || addr.village);
      }
      
      // Province/State
      if (addr.state || addr.province || addr.region) {
        parts.push(addr.state || addr.province || addr.region);
      }
      
      // Postal code
      if (addr.postcode) parts.push(addr.postcode);
      
      // Country (optional, usually Philippines)
      if (addr.country && addr.country !== 'Philippines') {
        parts.push(addr.country);
      }
      
      if (parts.length > 0) {
        return parts.join(', ');
      }
    }
    
    // Fallback to display_name
    return data.display_name;
  }
  
  return null;
};

/**
 * Extract city from Nominatim response
 */
export const extractCity = (data) => {
  if (!data || !data.address) return '';
  const addr = data.address;
  return addr.city || addr.town || addr.municipality || addr.village || addr.county || '';
};

/**
 * Extract barangay/suburb from Nominatim response
 */
export const extractBarangay = (data) => {
  if (!data || !data.address) return '';
  const addr = data.address;
  return addr.suburb || addr.neighbourhood || addr.quarter || '';
};

/**
 * Perform reverse geocoding with retry logic
 * @param {number} latitude 
 * @param {number} longitude 
 * @param {object} options - Optional configuration
 * @returns {Promise<{address: string, city: string, barangay: string, raw: object}>}
 */
export const reverseGeocode = async (latitude, longitude, options = {}) => {
  const { retries = GEOCODING_CONFIG.MAX_RETRIES } = options;
  
  // Input validation
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('Invalid coordinates');
  }
  
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error('Coordinates out of range');
  }
  
  await waitForRateLimit();
  
  const url = `${GEOCODING_CONFIG.NOMINATIM_URL}/reverse?` + 
    `format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&zoom=18&accept-language=en`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), GEOCODING_CONFIG.TIMEOUT);
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': GEOCODING_CONFIG.USER_AGENT,
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Check for Nominatim error response
      if (data.error) {
        console.warn('Nominatim error:', data.error);
        return {
          address: `Location at ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          city: '',
          barangay: '',
          raw: null,
        };
      }
      
      return {
        address: formatAddress(data) || `Location at ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        city: extractCity(data),
        barangay: extractBarangay(data),
        raw: data,
      };
      
    } catch (error) {
      console.warn(`Geocoding attempt ${attempt}/${retries} failed:`, error.message);
      
      if (attempt < retries) {
        await new Promise(resolve => 
          setTimeout(resolve, GEOCODING_CONFIG.RETRY_DELAY * attempt)
        );
      }
    }
  }
  
  // All retries exhausted - return coordinate-based fallback
  return {
    address: `Location at ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
    city: '',
    barangay: '',
    raw: null,
  };
};

/**
 * Perform forward geocoding (address to coordinates)
 * @param {string} query - Search query
 * @param {object} options - Optional configuration
 * @returns {Promise<Array<{lat: number, lon: number, display_name: string, address: object}>>}
 */
export const forwardGeocode = async (query, options = {}) => {
  const { limit = 5, retries = GEOCODING_CONFIG.MAX_RETRIES } = options;
  
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return [];
  }
  
  await waitForRateLimit();
  
  // Add Philippines context for better local results
  const searchQuery = query.includes('Philippines') ? query : `${query}, Philippines`;
  
  const url = `${GEOCODING_CONFIG.NOMINATIM_URL}/search?` +
    `format=json&q=${encodeURIComponent(searchQuery)}&limit=${limit}&addressdetails=1&accept-language=en`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), GEOCODING_CONFIG.TIMEOUT);
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': GEOCODING_CONFIG.USER_AGENT,
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return data.map(item => ({
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        display_name: formatAddress(item) || item.display_name,
        address: item.address,
        city: extractCity(item),
        raw: item,
      }));
      
    } catch (error) {
      console.warn(`Forward geocoding attempt ${attempt}/${retries} failed:`, error.message);
      
      if (attempt < retries) {
        await new Promise(resolve => 
          setTimeout(resolve, GEOCODING_CONFIG.RETRY_DELAY * attempt)
        );
      }
    }
  }
  
  return [];
};

/**
 * Generate the enhanced geocoding JavaScript for WebView maps
 * This provides a consistent, robust geocoding implementation across all map components
 */
export const getMapGeocodingScript = () => `
  // ============================================
  // Enhanced Geocoding Module for Pawmilya Maps
  // ============================================
  
  var GeocodingModule = (function() {
    var NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
    var USER_AGENT = 'PawmilyaApp/1.0 (Animal Rescue Application)';
    var MAX_RETRIES = 3;
    var RETRY_DELAY = 1500;
    var TIMEOUT = 10000;
    var MIN_REQUEST_INTERVAL = 1100;
    var lastRequestTime = 0;
    
    // Rate limiting
    function waitForRateLimit() {
      return new Promise(function(resolve) {
        var now = Date.now();
        var timeSinceLastRequest = now - lastRequestTime;
        if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
          setTimeout(function() {
            lastRequestTime = Date.now();
            resolve();
          }, MIN_REQUEST_INTERVAL - timeSinceLastRequest);
        } else {
          lastRequestTime = Date.now();
          resolve();
        }
      });
    }
    
    // Format address from Nominatim response
    function formatAddress(data) {
      if (!data) return null;
      
      var addr = data.address;
      if (addr) {
        var parts = [];
        
        // Building/House details
        if (addr.building) parts.push(addr.building);
        if (addr.house_number) parts.push(addr.house_number);
        
        // Street
        if (addr.road || addr.street) parts.push(addr.road || addr.street);
        
        // Neighborhood/Subdivision
        if (addr.neighbourhood) parts.push(addr.neighbourhood);
        if (addr.subdivision) parts.push(addr.subdivision);
        
        // Barangay (common in Philippines)
        if (addr.suburb) parts.push(addr.suburb);
        if (addr.quarter) parts.push(addr.quarter);
        
        // City/Municipality
        if (addr.city || addr.town || addr.municipality || addr.village) {
          parts.push(addr.city || addr.town || addr.municipality || addr.village);
        }
        
        // Province/State
        if (addr.state || addr.province || addr.region) {
          parts.push(addr.state || addr.province || addr.region);
        }
        
        // Postal code
        if (addr.postcode) parts.push(addr.postcode);
        
        if (parts.length > 0) {
          return parts.join(', ');
        }
      }
      
      return data.display_name || null;
    }
    
    // Extract city from response
    function extractCity(data) {
      if (!data || !data.address) return '';
      var addr = data.address;
      return addr.city || addr.town || addr.municipality || addr.village || addr.county || '';
    }
    
    // Extract barangay/suburb
    function extractBarangay(data) {
      if (!data || !data.address) return '';
      var addr = data.address;
      return addr.suburb || addr.neighbourhood || addr.quarter || '';
    }
    
    // Fetch with timeout
    function fetchWithTimeout(url, options, timeout) {
      return new Promise(function(resolve, reject) {
        var timer = setTimeout(function() {
          reject(new Error('Request timeout'));
        }, timeout);
        
        fetch(url, options)
          .then(function(response) {
            clearTimeout(timer);
            resolve(response);
          })
          .catch(function(error) {
            clearTimeout(timer);
            reject(error);
          });
      });
    }
    
    // Reverse geocode with retries
    function reverseGeocode(lat, lng, callback) {
      var retries = 0;
      
      function attemptGeocode() {
        waitForRateLimit().then(function() {
          var url = NOMINATIM_URL + '/reverse?format=json&lat=' + lat + '&lon=' + lng + '&addressdetails=1&zoom=18&accept-language=en';
          
          fetchWithTimeout(url, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': USER_AGENT
            }
          }, TIMEOUT)
          .then(function(response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
          })
          .then(function(data) {
            if (data.error) {
              console.warn('Nominatim error:', data.error);
              callback({
                address: 'Location at ' + lat.toFixed(6) + ', ' + lng.toFixed(6),
                city: '',
                barangay: '',
                raw: null
              });
              return;
            }
            
            callback({
              address: formatAddress(data) || 'Location at ' + lat.toFixed(6) + ', ' + lng.toFixed(6),
              city: extractCity(data),
              barangay: extractBarangay(data),
              raw: data
            });
          })
          .catch(function(error) {
            console.warn('Geocoding attempt ' + (retries + 1) + ' failed:', error.message);
            retries++;
            
            if (retries < MAX_RETRIES) {
              setTimeout(attemptGeocode, RETRY_DELAY * retries);
            } else {
              callback({
                address: 'Location at ' + lat.toFixed(6) + ', ' + lng.toFixed(6),
                city: '',
                barangay: '',
                raw: null
              });
            }
          });
        });
      }
      
      attemptGeocode();
    }
    
    // Forward geocode (search) with retries
    function forwardGeocode(query, callback, limit) {
      limit = limit || 5;
      var retries = 0;
      
      // Add Philippines context for better local results
      var searchQuery = query.indexOf('Philippines') > -1 ? query : query + ', Philippines';
      
      function attemptSearch() {
        waitForRateLimit().then(function() {
          var url = NOMINATIM_URL + '/search?format=json&q=' + encodeURIComponent(searchQuery) + '&limit=' + limit + '&addressdetails=1&accept-language=en';
          
          fetchWithTimeout(url, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': USER_AGENT
            }
          }, TIMEOUT)
          .then(function(response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
          })
          .then(function(data) {
            var results = data.map(function(item) {
              return {
                lat: parseFloat(item.lat),
                lon: parseFloat(item.lon),
                display_name: formatAddress(item) || item.display_name,
                city: extractCity(item),
                raw: item
              };
            });
            callback(results, null);
          })
          .catch(function(error) {
            console.warn('Search attempt ' + (retries + 1) + ' failed:', error.message);
            retries++;
            
            if (retries < MAX_RETRIES) {
              setTimeout(attemptSearch, RETRY_DELAY * retries);
            } else {
              callback([], error);
            }
          });
        });
      }
      
      attemptSearch();
    }
    
    // Public API
    return {
      reverseGeocode: reverseGeocode,
      forwardGeocode: forwardGeocode,
      formatAddress: formatAddress,
      extractCity: extractCity,
      extractBarangay: extractBarangay
    };
  })();
`;

export default {
  reverseGeocode,
  forwardGeocode,
  formatAddress,
  extractCity,
  extractBarangay,
  getMapGeocodingScript,
  GEOCODING_CONFIG,
};
