import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import authService from '../services/authService';
import CONFIG from '../config/config';

// Create Auth Context
const AuthContext = createContext(null);

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeMission, setActiveMission] = useState(null);
  const [missionLoading, setMissionLoading] = useState(false);

  // Check authentication status on app load
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Check for active mission when user changes
  useEffect(() => {
    if (user?.id) {
      checkActiveMission();
    } else {
      setActiveMission(null);
    }
  }, [user?.id]);

  const checkAuthStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const isAuth = await authService.isAuthenticated();
      
      if (isAuth) {
        const storedUser = await authService.getStoredUser();
        const storedToken = await authService.getStoredToken();
        // Include token in user object for API calls
        const userWithToken = storedUser ? { ...storedUser, token: storedToken } : null;
        setUser(userWithToken);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);
  const checkActiveMission = useCallback(async () => {
    if (!user?.id || !user?.token) return null;
    
    try {
      setMissionLoading(true);
      const response = await fetch(`${CONFIG.API_URL}/rescue-reports/my-active-mission`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.mission) {
          setActiveMission(data.mission);
          return data.mission;
        } else {
          setActiveMission(null);
          return null;
        }
      } else {
        setActiveMission(null);
        return null;
      }
    } catch (error) {
      console.error('Error checking active mission:', error);
      setActiveMission(null);
      return null;
    } finally {
      setMissionLoading(false);
    }
  }, [user?.id, user?.token]);

  // Clear active mission (after completion)
  const clearActiveMission = useCallback(() => {
    setActiveMission(null);
  }, []);

  // Set active mission (when accepting a new rescue)
  const setMission = useCallback((mission) => {
    setActiveMission(mission);
  }, []);

  // Login
  const login = useCallback(async (email, password) => {
    try {
      setIsLoading(true);
      const response = await authService.login({ email, password });
      
      // 2FA required — return tempToken and maskedEmail to caller
      if (response.requires2FA) {
        return {
          success: true,
          requires2FA: true,
          tempToken: response.tempToken,
          maskedEmail: response.maskedEmail,
        };
      }

      if (response.success) {
        const userData = {
          ...response.data.user,
          token: response.data.token,
        };
        setUser(userData);
        setIsAuthenticated(true);
        return { success: true };
      }
      
      return { success: false, message: 'Login failed' };
    } catch (error) {
      return { 
        success: false, 
        message: error.message || 'Login failed' 
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Register
  const register = useCallback(async (userData) => {
    try {
      setIsLoading(true);
      const response = await authService.register(userData);
      
      // 2FA required — return tempToken and maskedEmail to caller
      if (response.requires2FA) {
        return {
          success: true,
          requires2FA: true,
          tempToken: response.tempToken,
          maskedEmail: response.maskedEmail,
        };
      }

      if (response.success) {
        const userObj = {
          ...response.data.user,
          token: response.data.token,
        };
        setUser(userObj);
        setIsAuthenticated(true);
        return { success: true };
      }
      
      return { success: false, message: 'Registration failed' };
    } catch (error) {
      return { 
        success: false, 
        message: error.message || 'Registration failed',
        errors: error.errors || [],
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Verify OTP (2FA)
  const verifyOtp = useCallback(async (tempToken, otp) => {
    try {
      setIsLoading(true);
      const response = await authService.verifyOtp(tempToken, otp);

      if (response.success) {
        const userData = {
          ...response.user,
          token: response.token,
        };
        setUser(userData);
        setIsAuthenticated(true);
        return { success: true, user: userData };
      }

      return { success: false, message: response.error || 'Verification failed' };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Verification failed',
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Resend OTP
  const resendOtp = useCallback(async (tempToken) => {
    try {
      return await authService.resendOtp(tempToken);
    } catch (error) {
      throw error;
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await authService.logout();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update user data
  const updateUser = useCallback((userData) => {
    setUser(prev => ({ ...prev, ...userData }));
  }, []);

  // Memoize context value to prevent unnecessary re-renders of all consumers
  const value = useMemo(() => ({
    user,
    isLoading,
    isAuthenticated,
    activeMission,
    missionLoading,
    login,
    register,
    verifyOtp,
    resendOtp,
    logout,
    updateUser,
    checkAuthStatus,
    checkActiveMission,
    setMission,
    clearActiveMission,
  }), [user, isLoading, isAuthenticated, activeMission, missionLoading, login, register, verifyOtp, resendOtp, logout, updateUser, checkAuthStatus, checkActiveMission, setMission, clearActiveMission]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

export default AuthContext;
