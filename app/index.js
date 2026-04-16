import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isAdminLogin } from '../config/adminCredentials';
import { COLORS } from '../constants/theme';
import { AuthProvider, useAuth } from '../context/AuthContext';
import '../firebaseConfig';
import { otpService, userService } from '../services';
import AdminScreen from './Admin';
import CafeSplashScreen from './CafeSplashScreen';
import HomeScreen from './Guest/HomeScreen';
import MissionScreen from './Guest/MissionScreen';
import PetsScreen from './Guest/PetsScreen';
import RescueScreen from './Guest/RescueScreen';
import LoginScreen from './Log In/LoginScreen';
import SignUpScreen from './Log In/SignUpScreen';
import TwoFactorScreen from './Log In/TwoFactorScreen';
import OnboardingScreen from './OnboardingScreen';
import SplashScreen from './SplashScreen';
import UserScreen from './User';

const TABS = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'pets', label: 'Pets', icon: 'paw' },
  { key: 'rescue', label: 'Rescue', icon: 'alert-circle' },
  { key: 'mission', label: 'Mission', icon: 'heart' },
  { key: 'login', label: 'Log In', icon: 'log-in' },
];

const ONBOARDING_DONE_KEY = 'pawmilya_onboarding_done';

export default function Index() {
  return (
    <AuthProvider>
      <RootApp />
    </AuthProvider>
  );
}

function RootApp() {
  const { isAuthenticated, isLoading: authLoading, login, register, logout, user } = useAuth();
  const [phase, setPhase] = useState('splash');
  const [activeTab, setActiveTab] = useState('home');
  const [authScreen, setAuthScreen] = useState('login');
  const [pendingLogin, setPendingLogin] = useState(null);
  const [maskedOtpEmail, setMaskedOtpEmail] = useState('');    const [isCheckingTwoFactor, setIsCheckingTwoFactor] = useState(false);  const [isFinalizingTwoFactor, setIsFinalizingTwoFactor] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [isStorageReady, setIsStorageReady] = useState(false);
  const didAutoLogoutRef = useRef(false);
  const contentTransition = useRef(new Animated.Value(1)).current;
  const isUserArea = isAuthenticated && (activeTab === 'home' || activeTab === 'login');
  const isAuthFlowScreen = activeTab === 'login' && !isAuthenticated;
  const isTwoFactorScreen = activeTab === 'login' && authScreen === 'twofactor';
  const transitionKey = `${activeTab}:${authScreen}:${isAuthenticated ? 'auth' : 'guest'}:${user?.role || 'none'}`;

  useEffect(() => {
    contentTransition.setValue(0);
    Animated.timing(contentTransition, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [contentTransition, transitionKey]);

  useEffect(() => {
    let mounted = true;

    const loadOnboardingState = async () => {
      try {
        const onboardingDone = await AsyncStorage.getItem(ONBOARDING_DONE_KEY);
        if (mounted) {
          setHasSeenOnboarding(onboardingDone === 'true');
        }
      } catch (error) {
        console.error('Failed to read onboarding state:', error);
      } finally {
        if (mounted) {
          setIsStorageReady(true);
        }
      }
    };

    loadOnboardingState();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading || !isStorageReady || didAutoLogoutRef.current) {
      return;
    }

    if (!isAuthenticated) {
      didAutoLogoutRef.current = true;
      return;
    }

    didAutoLogoutRef.current = true;

    const signOutOnStart = async () => {
      try {
        await logout();
      } catch (error) {
        console.error('Auto logout on app start failed:', error);
      } finally {
        setAuthScreen('login');
        setActiveTab('home');
        setPendingLogin(null);
        setMaskedOtpEmail('');
      }
    };

    signOutOnStart();
  }, [authLoading, isAuthenticated, isStorageReady, logout]);

  useEffect(() => {
    if (!isFinalizingTwoFactor || !isAuthenticated) {
      return;
    }

    setAuthScreen('login');
    setActiveTab('login');
    setPendingLogin(null);
    setMaskedOtpEmail('');
    setIsFinalizingTwoFactor(false);
  }, [isAuthenticated, isFinalizingTwoFactor]);

  const handlePrimarySplashFinish = useCallback(() => {
    setPhase('splash-cafe');
  }, []);

  const handleCafeSplashFinish = useCallback(() => {
    setPhase(hasSeenOnboarding ? 'app' : 'onboarding');
  }, [hasSeenOnboarding]);

  const handleOnboardingComplete = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true');
      setHasSeenOnboarding(true);
    } catch (error) {
      console.error('Failed to persist onboarding state:', error);
    } finally {
      setPhase('app');
    }
  }, []);

  const handleLoginSuccess = useCallback(async ({ email, password }) => {
      setIsCheckingTwoFactor(true);
      // Perform login first to bypass Firestore read restrictions for unauthenticated users
      const directLoginResult = await login(email, password);

      if (!directLoginResult?.success) {
        setIsCheckingTwoFactor(false);
        return directLoginResult;
      }

      // Fetch the 2FA preference; it will succeed now because the user is authenticated in FIREBASE
      let twoFactorPreference = null;
      try {
        twoFactorPreference = await userService.getTwoFactorPreferenceByEmail(email);
      } catch (err) {
        console.error('Failed to fetch 2FA preferences', err);
      }
      
      const hardCodedAdminCheck = await isAdminLogin(email, password);
      const isHardcodedAdmin = hardCodedAdminCheck.success;
      const isAdmin = twoFactorPreference?.isAdmin === true || isHardcodedAdmin;
      const isTwoFactorEnabled = !isAdmin && (twoFactorPreference?.enabled !== false);

      if (!isTwoFactorEnabled || isAdmin) {
        setAuthScreen('login');
        setActiveTab('login');
        setPendingLogin(null);
        setMaskedOtpEmail('');
        setIsCheckingTwoFactor(false);
        return directLoginResult;
      }

      // Move UI to 2FA immediately to avoid briefly rendering the authenticated dashboard.
      setPendingLogin({ email, password });
      setMaskedOtpEmail(otpService.maskEmail(email));
      setAuthScreen('twofactor');

      // Log the user back out immediately. We keep credentials in memory and complete login after OTP verification.
      await logout();
      
      setIsCheckingTwoFactor(false);
    const otpResult = await otpService.sendOtp(email);

    if (!otpResult?.success) {
      setAuthScreen('login');
      setPendingLogin(null);
      setMaskedOtpEmail('');
      return otpResult;
    }

    setMaskedOtpEmail(otpResult.maskedEmail || otpService.maskEmail(email));

    return { success: true };
  }, [login, logout]);

  const handleTwoFactorVerify = useCallback(async ({ code }) => {
    if (!pendingLogin?.email || !pendingLogin?.password) {
      return { success: false, message: 'Login session expired. Please sign in again.' };
    }

    const verifyResult = await otpService.verifyOtp(pendingLogin.email, code);

    if (!verifyResult?.success) {
      return verifyResult;
    }

    const result = await login(pendingLogin.email, pendingLogin.password);

    if (result?.success) {
      setIsFinalizingTwoFactor(true);
      return { success: true };
    }

    setIsFinalizingTwoFactor(false);

    return result;
  }, [login, pendingLogin]);

  const handleResendTwoFactorCode = useCallback(async () => {
    if (!pendingLogin?.email) {
      return { success: false, message: 'No active login session. Please go back and sign in again.' };
    }

    const resendResult = await otpService.sendOtp(pendingLogin.email);
    if (resendResult?.success) {
      setMaskedOtpEmail(resendResult.maskedEmail || otpService.maskEmail(pendingLogin.email));
    }

    return resendResult;
  }, [pendingLogin]);

  const handleSignUpSuccess = useCallback(async (payload) => {
    const result = await register(payload);

    if (!result?.success) {
      return result;
    }

    // Show 2FA first and clear authenticated UI state before OTP network calls.
    setPendingLogin({ email: payload.email, password: payload.password });
    setMaskedOtpEmail(otpService.maskEmail(payload.email));
    setAuthScreen('twofactor');
    setActiveTab('login');

    try {
      await logout();
    } catch (error) {
      console.error('Failed to sign out after sign up pre-2FA:', error);
    }

    const otpResult = await otpService.sendOtp(payload?.email);
    if (!otpResult?.success) {
      setAuthScreen('login');
      setPendingLogin(null);
      setMaskedOtpEmail('');
      return {
        success: false,
        message: `Account created, but OTP could not be sent. ${otpResult?.message || 'Please try logging in to request a new code.'}`,
      };
    }
    setMaskedOtpEmail(otpResult.maskedEmail || otpService.maskEmail(payload.email));

    return {
      success: true,
      message: 'Account created. Enter the OTP sent to your email to continue.',
    };
  }, [logout, register]);

  const renderContent = () => {
    if (activeTab === 'pets') {
      return (
        <PetsScreen
          onNavigateToLogin={() => {
            setAuthScreen('login');
            setActiveTab('login');
          }}
        />
      );
    }

    if (activeTab === 'rescue') {
      return <RescueScreen />;
    }

    if (activeTab === 'mission') {
      return <MissionScreen />;
    }

    if (activeTab === 'login') {
      if (isCheckingTwoFactor) {
        return (
          <View style={{ flex: 1, backgroundColor: COLORS.backgroundWhite, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        );
      }

      if (authScreen === 'twofactor') {
        return (
          <TwoFactorScreen
            maskedEmail={maskedOtpEmail || otpService.maskEmail(pendingLogin?.email || '')}
            onVerifySuccess={handleTwoFactorVerify}
            onResend={handleResendTwoFactorCode}
            isTransitionLoading={isFinalizingTwoFactor || authLoading}
            onGoBack={() => {
              setAuthScreen('login');
              setPendingLogin(null);
              setMaskedOtpEmail('');
            }}
          />
        );
      }

      if (isAuthenticated) {
        if (user && user.role === 'admin') {
          return <AdminScreen onLogout={logout} />;
        }
        return <UserScreen />;
      }

      if (authScreen === 'signup') {
        return (
          <SignUpScreen
            onNavigateToLogin={() => setAuthScreen('login')}
            onSignUpSuccess={handleSignUpSuccess}
          />
        );
      }

      return (
        <LoginScreen
          onNavigateToSignUp={() => setAuthScreen('signup')}
          onGoBack={() => {
            setAuthScreen('login');
            setActiveTab('home');
          }}
          onLoginSuccess={handleLoginSuccess}
        />
      );
    }

    if (activeTab === 'home' && isAuthenticated) {
      if (user && user.role === 'admin') {
        return <AdminScreen onLogout={logout} />;
      }
      return <UserScreen />;
    }

    return (
      <HomeScreen
        onNavigateToRescue={() => setActiveTab('rescue')}
        onNavigateToLogin={() => {
          setAuthScreen('login');
          setActiveTab('login');
        }}
      />
    );
  };

  if (!isStorageReady || authLoading) {
    return <SafeAreaView style={styles.container} />;
  }

  if (phase === 'splash') {
    return <SplashScreen onFinish={handlePrimarySplashFinish} />;
  }

  if (phase === 'splash-cafe') {
    return <CafeSplashScreen onFinish={handleCafeSplashFinish} />;
  }

  if (phase === 'onboarding') {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  const animatedContentStyle = {
    opacity: contentTransition,
    transform: [
      {
        translateY: contentTransition.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
      {
        scale: contentTransition.interpolate({
          inputRange: [0, 1],
          outputRange: [0.985, 1],
        }),
      },
    ],
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.content, animatedContentStyle]}>{renderContent()}</Animated.View>
      {!isUserArea && !isAuthFlowScreen && !isTwoFactorScreen && (
        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.tabButton}
                onPress={() => {
                  if (tab.key === 'login') {
                    setAuthScreen('login');
                  }
                  setActiveTab(tab.key);
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={active ? tab.icon : `${tab.icon}-outline`}
                  size={22}
                  color={active ? COLORS.primary : COLORS.textMedium}
                />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E6DDD4',
    backgroundColor: COLORS.backgroundWhite,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 22 : 10,
    paddingHorizontal: 12,
    elevation: 20,
    shadowColor: COLORS.brown,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 2,
  },
  tabLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});
