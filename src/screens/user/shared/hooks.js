/**
 * Custom hooks for user screens
 * Reusable logic patterns
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { parseApiResponse, handleApiError } from './utils';

/**
 * Hook for network/offline detection
 * Uses a simple fetch-based approach for network detection
 * @returns {Object} { isConnected, isInternetReachable, checkConnection }
 */
export const useNetworkStatus = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);
  const checkTimeoutRef = useRef(null);
  
  const checkConnection = useCallback(async () => {
    try {
      // Try to fetch a simple endpoint to check connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://clients3.google.com/generate_204', {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      const connected = response.status === 204;
      setIsConnected(connected);
      setIsInternetReachable(connected);
      return connected;
    } catch (error) {
      setIsConnected(false);
      setIsInternetReachable(false);
      return false;
    }
  }, []);
  
  useEffect(() => {
    // Initial check
    checkConnection();
    
    // Periodic check every 30 seconds
    const intervalId = setInterval(checkConnection, 30000);
    
    return () => {
      clearInterval(intervalId);
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, [checkConnection]);
  
  return { isConnected, isInternetReachable, checkConnection };
};

/**
 * Hook for managing loading state with data fetching
 * @param {Function} fetchFn - Async function to fetch data
 * @param {Array} deps - Dependencies to trigger refetch
 * @returns {Object} { data, loading, refreshing, error, refetch, onRefresh }
 */
export const useDataFetching = (fetchFn, deps = []) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      const response = await fetchFn();
      const parsedData = parseApiResponse(response);
      setData(parsedData);
    } catch (err) {
      handleApiError(err, 'useDataFetching');
      setError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchFn]);
  
  useEffect(() => {
    fetchData();
  }, deps);
  
  const onRefresh = useCallback(() => fetchData(true), [fetchData]);
  
  return { data, setData, loading, refreshing, error, refetch: fetchData, onRefresh };
};

/**
 * Hook for search/filter functionality
 * @param {Array} items - Items to filter
 * @param {Function} filterFn - Filter function (item, query) => boolean
 * @returns {Object} { filteredItems, searchQuery, setSearchQuery }
 */
export const useSearch = (items, filterFn) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredItems, setFilteredItems] = useState(items);
  
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredItems(items);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredItems(items.filter(item => filterFn(item, query)));
    }
  }, [items, searchQuery, filterFn]);
  
  return { filteredItems, searchQuery, setSearchQuery };
};

/**
 * Hook for category/tab filtering
 * @param {Array} items - Items to filter
 * @param {string} categoryKey - Key to use for category matching
 * @param {string} defaultCategory - Default category (e.g., 'all')
 * @returns {Object} { filteredItems, selectedCategory, setSelectedCategory }
 */
export const useCategoryFilter = (items, categoryKey, defaultCategory = 'all') => {
  const [selectedCategory, setSelectedCategory] = useState(defaultCategory);
  const [filteredItems, setFilteredItems] = useState(items);
  
  useEffect(() => {
    if (selectedCategory === 'all' || selectedCategory === defaultCategory) {
      setFilteredItems(items);
    } else {
      setFilteredItems(items.filter(
        item => item[categoryKey]?.toLowerCase() === selectedCategory.toLowerCase()
      ));
    }
  }, [items, selectedCategory, categoryKey, defaultCategory]);
  
  return { filteredItems, selectedCategory, setSelectedCategory };
};

/**
 * Hook combining search and category filtering
 * @param {Array} items - Items to filter
 * @param {Function} searchFilterFn - Search filter function
 * @param {string} categoryKey - Key for category matching
 * @param {string} defaultCategory - Default category
 * @returns {Object} Combined filter state and setters
 */
export const useCombinedFilters = (items, searchFilterFn, categoryKey, defaultCategory = 'all') => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(defaultCategory);
  const [filteredItems, setFilteredItems] = useState(items);
  
  useEffect(() => {
    let filtered = [...items];
    
    // Apply category filter
    if (selectedCategory !== 'all' && selectedCategory !== defaultCategory) {
      filtered = filtered.filter(
        item => item[categoryKey]?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => searchFilterFn(item, query));
    }
    
    setFilteredItems(filtered);
  }, [items, searchQuery, selectedCategory, searchFilterFn, categoryKey, defaultCategory]);
  
  return { 
    filteredItems, 
    searchQuery, 
    setSearchQuery, 
    selectedCategory, 
    setSelectedCategory 
  };
};

/**
 * Hook for polling/interval-based data fetching
 * @param {Function} fetchFn - Async function to fetch data
 * @param {number} interval - Polling interval in ms
 * @param {boolean} enabled - Whether polling is enabled
 * @returns {Object} { data, refetch }
 */
export const usePolling = (fetchFn, interval = 30000, enabled = true) => {
  const [data, setData] = useState(null);
  const intervalRef = useRef(null);
  
  const fetchData = useCallback(async () => {
    try {
      const response = await fetchFn();
      setData(response);
    } catch (err) {
      handleApiError(err, 'usePolling');
    }
  }, [fetchFn]);
  
  useEffect(() => {
    if (!enabled) return;
    
    // Initial fetch
    fetchData();
    
    // Set up interval
    intervalRef.current = setInterval(fetchData, interval);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, interval, enabled]);
  
  return { data, refetch: fetchData };
};

/**
 * Hook for debounced value
 * @param {any} value - Value to debounce
 * @param {number} delay - Delay in ms
 * @returns {any} Debounced value
 */
export const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
};

/**
 * Hook for previous value tracking
 * @param {any} value - Value to track
 * @returns {any} Previous value
 */
export const usePrevious = (value) => {
  const ref = useRef();
  
  useEffect(() => {
    ref.current = value;
  }, [value]);
  
  return ref.current;
};

/**
 * Hook for mounted state check
 * @returns {Object} Ref with current mounted state
 */
export const useIsMounted = () => {
  const isMounted = useRef(true);
  
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  return isMounted;
};
