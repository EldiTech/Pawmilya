import React, { useReducer, useCallback, useMemo, memo, useState, useEffect } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import HomeScreen from './src/screens/guest/HomeScreen';
import PetsScreen from './src/screens/guest/PetsScreen';
import RescueScreen from './src/screens/guest/RescueScreen';
import MissionScreen from './src/screens/guest/MissionScreen';
import LoginScreen from './src/screens/guest/LoginScreen';
import SignUpScreen from './src/screens/guest/SignUpScreen';
import TwoFactorScreen from './src/screens/guest/TwoFactorScreen';
import { UserMainScreen } from './src/screens/user';
import BottomTabBar from './src/components/BottomTabBar';
import OnboardingScreen from './src/screens/OnboardingScreen';
import SplashScreenComponent from './src/screens/SplashScreen';

// Admin Screens
import {
  AdminDashboard,
  AdminPetsScreen,
  AdminAddPetScreen,
  AdminRescuesScreen,
  AdminAdoptionsScreen,
  AdminUsersScreen,
  AdminRescuerApplicationsScreen,
  AdminShelterApplicationsScreen,
  AdminSheltersScreen,
  AdminShelterTransfersScreen,
  AdminDeliveriesScreen,
  AdminSettingsScreen,
} from './src/screens/admin';

// Consolidated state management with useReducer for better performance
const initialState = {
  activeTab: 'home',
  authScreen: 'login',
  isLoggedIn: false,
  isAdmin: false,
  adminScreen: 'dashboard',
  adminToken: null,
  twoFA: null, // { tempToken, maskedEmail }
};

function appReducer(state, action) {
  switch (action.type) {
    case 'ADMIN_LOGIN':
      return { ...state, adminToken: action.token, isAdmin: true, adminScreen: 'dashboard' };
    case 'USER_LOGIN':
      return { ...state, isLoggedIn: true, activeTab: 'home', authScreen: 'login', twoFA: null };
    case 'ADMIN_LOGOUT':
      return { ...state, isAdmin: false, adminToken: null, adminScreen: 'dashboard', activeTab: 'home' };
    case 'USER_LOGOUT':
      return { ...state, isLoggedIn: false, activeTab: 'home', authScreen: 'login', twoFA: null };
    case 'SET_ADMIN_SCREEN':
      return { ...state, adminScreen: action.screen };
    case 'SET_TAB':
      return { ...state, activeTab: action.tab, authScreen: 'login', twoFA: null };
    case 'SET_AUTH_SCREEN':
      return { ...state, authScreen: action.screen };
    case 'REQUIRE_2FA':
      return { ...state, authScreen: '2fa', twoFA: action.payload };
    case 'CANCEL_2FA':
      return { ...state, authScreen: 'login', twoFA: null };
    default:
      return state;
  }
}

const ONBOARDING_KEY = '@pawmilya_onboarding_complete';

// Keep splash screen visible while we check onboarding state
SplashScreen.preventAutoHideAsync();

// Wrapper for TwoFactorScreen that connects to AuthContext
const TwoFactorScreenWrapper = memo(function TwoFactorScreenWrapper({ tempToken, maskedEmail, onVerifySuccess, onGoBack }) {
  const { verifyOtp, resendOtp } = useAuth();

  const handleVerifySuccess = useCallback((result) => {
    onVerifySuccess && onVerifySuccess(result);
  }, [onVerifySuccess]);

  return (
    <TwoFactorScreen
      tempToken={tempToken}
      maskedEmail={maskedEmail}
      onVerifySuccess={handleVerifySuccess}
      onGoBack={onGoBack}
      verifyOtp={verifyOtp}
      resendOtp={resendOtp}
    />
  );
});

const AppContent = memo(function AppContent() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [showOnboarding, setShowOnboarding] = useState(null); // null = loading
  const [showSplash, setShowSplash] = useState(true);
  const { activeTab, authScreen, isLoggedIn, isAdmin, adminScreen, adminToken, twoFA } = state;

  // Check if onboarding was already completed
  useEffect(() => {
    let resolved = false;
    
    const checkOnboarding = async () => {
      try {
        const value = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (!resolved) {
          resolved = true;
          setShowOnboarding(value !== 'true');
        }
      } catch (e) {
        if (!resolved) {
          resolved = true;
          setShowOnboarding(true);
        }
      }
    };

    checkOnboarding();

    // Fallback: if AsyncStorage doesn't respond within 2s, show the app
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setShowOnboarding(false);
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, []);

  // Hide the native splash screen once we know whether to show onboarding
  useEffect(() => {
    if (showOnboarding !== null) {
      SplashScreen.hideAsync();
    }
  }, [showOnboarding]);

  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
  }, []);

  const handleOnboardingComplete = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch (_) {}
    setShowOnboarding(false);
  }, []);

  // Stable callbacks via useCallback — no new function refs on each render
  const handleAdminLogin = useCallback((token) => {
    dispatch({ type: 'ADMIN_LOGIN', token });
  }, []);

  const handleUserLogin = useCallback(() => {
    dispatch({ type: 'USER_LOGIN' });
  }, []);

  const handleAdminLogout = useCallback(() => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: () => dispatch({ type: 'ADMIN_LOGOUT' }) },
    ]);
  }, []);

  const handleAdminNavigate = useCallback((screen) => {
    dispatch({ type: 'SET_ADMIN_SCREEN', screen });
  }, []);

  const handleAdminGoBack = useCallback(() => {
    dispatch({ type: 'SET_ADMIN_SCREEN', screen: 'dashboard' });
  }, []);

  const handleAdminGoBackToPets = useCallback(() => {
    dispatch({ type: 'SET_ADMIN_SCREEN', screen: 'pets' });
  }, []);

  const handleUserLogout = useCallback(() => {
    dispatch({ type: 'USER_LOGOUT' });
  }, []);

  const handleTabChange = useCallback((tab) => {
    dispatch({ type: 'SET_TAB', tab });
  }, []);

  const handleNavigateToSignUp = useCallback(() => {
    dispatch({ type: 'SET_AUTH_SCREEN', screen: 'signup' });
  }, []);

  const handleNavigateToLogin = useCallback(() => {
    dispatch({ type: 'SET_AUTH_SCREEN', screen: 'login' });
  }, []);

  const handleSignUpSuccess = useCallback(() => {
    dispatch({ type: 'USER_LOGIN' });
  }, []);

  const handleGoBackFromLogin = useCallback(() => {
    dispatch({ type: 'SET_TAB', tab: 'home' });
  }, []);

  const handleRequire2FA = useCallback((payload) => {
    dispatch({ type: 'REQUIRE_2FA', payload });
  }, []);

  const handleCancel2FA = useCallback(() => {
    dispatch({ type: 'CANCEL_2FA' });
  }, []);

  const handle2FASuccess = useCallback(() => {
    dispatch({ type: 'USER_LOGIN' });
  }, []);

  const handleNavigateToRescue = useCallback(() => {
    dispatch({ type: 'SET_TAB', tab: 'rescue' });
  }, []);

  // Show animated splash screen on app launch
  if (showSplash || showOnboarding === null) {
    return <SplashScreenComponent onFinish={handleSplashFinish} />;
  }

  // Show onboarding on first launch
  if (showOnboarding) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  // Render Admin Screens
  if (isAdmin) {
    switch (adminScreen) {
      case 'pets':
      case 'editPet':
        return <AdminPetsScreen onGoBack={handleAdminGoBack} onNavigate={handleAdminNavigate} adminToken={adminToken} />;
      case 'addPet':
        return <AdminAddPetScreen onGoBack={handleAdminGoBackToPets} adminToken={adminToken} />;
      case 'rescues':
        return <AdminRescuesScreen onGoBack={handleAdminGoBack} adminToken={adminToken} />;
      case 'adoptions':
        return <AdminAdoptionsScreen onGoBack={handleAdminGoBack} adminToken={adminToken} />;
      case 'deliveries':
        return <AdminDeliveriesScreen onGoBack={handleAdminGoBack} adminToken={adminToken} />;
      case 'rescuerApplications':
        return <AdminRescuerApplicationsScreen onGoBack={handleAdminGoBack} adminToken={adminToken} />;
      case 'users':
        return <AdminUsersScreen onGoBack={handleAdminGoBack} adminToken={adminToken} />;
      case 'shelterApplications':
        return <AdminShelterApplicationsScreen onGoBack={handleAdminGoBack} adminToken={adminToken} />;
      case 'shelters':
        return <AdminSheltersScreen onGoBack={handleAdminGoBack} adminToken={adminToken} />;
      case 'shelterTransfers':
        return <AdminShelterTransfersScreen onGoBack={handleAdminGoBack} adminToken={adminToken} />;
      case 'settings':
        return <AdminSettingsScreen onGoBack={handleAdminGoBack} adminToken={adminToken} />;
      default:
        return <AdminDashboard onNavigate={handleAdminNavigate} onLogout={handleAdminLogout} adminToken={adminToken} />;
    }
  }

  // Render User Main Screen when logged in
  if (isLoggedIn) {
    return <UserMainScreen onLogout={handleUserLogout} />;
  }

  // Guest screen rendering
  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return <HomeScreen onNavigateToRescue={handleNavigateToRescue} />;
      case 'pets':
        return <PetsScreen onNavigateToLogin={handleNavigateToLogin} />;
      case 'rescue':
        return <RescueScreen onNavigateToLogin={handleNavigateToLogin} />;
      case 'mission':
        return <MissionScreen />;
      case 'login':
        if (authScreen === '2fa' && twoFA) {
          return (
            <TwoFactorScreenWrapper
              tempToken={twoFA.tempToken}
              maskedEmail={twoFA.maskedEmail}
              onVerifySuccess={handle2FASuccess}
              onGoBack={handleCancel2FA}
            />
          );
        }
        if (authScreen === 'signup') {
          return (
            <SignUpScreen 
              onNavigateToLogin={handleNavigateToLogin}
              onSignUpSuccess={handleSignUpSuccess}
              onRequire2FA={handleRequire2FA}
            />
          );
        }
        return (
          <LoginScreen 
            onNavigateToSignUp={handleNavigateToSignUp} 
            onGoBack={handleGoBackFromLogin}
            onLoginSuccess={handleUserLogin}
            onAdminLogin={handleAdminLogin}
            onRequire2FA={handleRequire2FA}
          />
        );
      default:
        return <HomeScreen />;
    }
  };

  return (
    <View style={styles.container}>
      {renderScreen()}
      {activeTab !== 'login' && (
        <BottomTabBar activeTab={activeTab} onTabChange={handleTabChange} />
      )}
    </View>
  );
});

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F3',
  },
  splashContainer: {
    flex: 1,
    backgroundColor: '#FFF8F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
