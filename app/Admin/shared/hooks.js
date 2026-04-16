/**
 * Shared Admin Hooks
 * Custom hooks for common admin functionality
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated } from 'react-native';

export default function DummyHooksRoute() { return null; }

/**
 * Hook for managing fade animations
 */
export const useFadeAnimation = (duration = 500) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  
  return { fadeAnim, slideAnim };
};

/**
 * Hook for managing list data with loading and refresh states
 */
export const useListData = (fetchFn, dependencies = []) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  const fetchData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(err.message);
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, dependencies);
  
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  return {
    data,
    setData,
    loading,
    refreshing,
    error,
    onRefresh,
    refetch: fetchData,
  };
};

/**
 * Hook for managing search state
 */
export const useSearch = (initialValue = '') => {
  const [search, setSearch] = useState(initialValue);
  
  const clearSearch = useCallback(() => setSearch(''), []);
  
  return {
    search,
    setSearch,
    clearSearch,
  };
};

/**
 * Hook for managing filter state
 */
export const useFilter = (initialValue = 'all') => {
  const [filter, setFilter] = useState(initialValue);
  
  const resetFilter = useCallback(() => setFilter('all'), []);
  
  return {
    filter,
    setFilter,
    resetFilter,
  };
};

/**
 * Hook for managing modal state
 */
export const useModal = () => {
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState(null);
  
  const open = useCallback((modalData = null) => {
    setData(modalData);
    setVisible(true);
  }, []);
  
  const close = useCallback(() => {
    setVisible(false);
    setData(null);
  }, []);
  
  return {
    visible,
    data,
    open,
    close,
  };
};

/**
 * Hook for managing form state
 */
export const useForm = (initialValues = {}) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  
  const setValue = useCallback((field, value) => {
    setValues(prev => ({ ...prev, [field]: value }));
  }, []);
  
  const setFieldTouched = useCallback((field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);
  
  const setFieldError = useCallback((field, error) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);
  
  const reset = useCallback((newValues = initialValues) => {
    setValues(newValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);
  
  return {
    values,
    errors,
    touched,
    setValue,
    setFieldTouched,
    setFieldError,
    reset,
    setValues,
  };
};

/**
 * Hook for API mutations (create, update, delete)
 */
export const useMutation = (mutationFn) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const mutate = useCallback(async (...args) => {
    try {
      setLoading(true);
      setError(null);
      const result = await mutationFn(...args);
      return { success: true, data: result };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [mutationFn]);
  
  return {
    mutate,
    loading,
    error,
  };
};

/**
 * Hook for confirmation dialogs
 */
export const useConfirmation = () => {
  const confirm = useCallback((title, message, onConfirm, options = {}) => {
    Alert.alert(
      title,
      message,
      [
        { 
          text: options.cancelText || 'Cancel', 
          style: 'cancel',
          onPress: options.onCancel,
        },
        { 
          text: options.confirmText || 'Confirm',
          style: options.destructive ? 'destructive' : 'default',
          onPress: onConfirm,
        },
      ],
      { cancelable: true }
    );
  }, []);
  
  return confirm;
};

/**
 * Hook for debounced value
 */
export const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
};
