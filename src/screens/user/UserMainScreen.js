import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { View, StyleSheet, Alert, BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import CONFIG from '../../config/config';
import { SuspensionProvider } from './SuspendedAccountModal';
import { withCacheBusting } from './shared';

// Import user screens
import UserHomeScreen from './UserHomeScreen';
import UserPetsScreen from './UserPetsScreen';
import UserAdoptionsScreen from './UserAdoptionsScreen';
import UserRescueScreen from './UserRescueScreen';
import UserMissionScreen from './UserMissionScreen';
import UserSettingsScreen from './UserSettingsScreen';
import UserBottomTabBar from './UserBottomTabBar';
import UserRescuerRegistrationScreen from './UserRescuerRegistrationScreen';
import UserNotificationsScreen from './UserNotificationsScreen';
import UserReportRescueScreen from './UserReportRescueScreen';
import UserRescuerDashboardScreen from './UserRescuerDashboardScreen';
import UserRescueMissionScreen from './UserRescueMissionScreen';
import UserShelterScreen from './UserShelterScreen';
import UserShelterApplicationScreen from './UserShelterApplicationScreen';
import UserShelterManagerScreen from './UserShelterManagerScreen';
import JemoyScreen from './Jemoy';

// Mission statuses that indicate an active/locked mission
const ACTIVE_MISSION_STATUSES = ['in_progress', 'on_the_way', 'arrived', 'pending_verification'];

// Helper function to check if mission is active (user should be locked)
const isMissionActive = (mission) => mission && ACTIVE_MISSION_STATUSES.includes(mission.status);

// Alert messages
const MISSION_ALERT = {
  title: 'Mission In Progress',
  message: 'You cannot navigate to other screens while a rescue mission is active. Please complete or cancel the mission first.',
  backMessage: 'You cannot leave while a rescue mission is active. Please complete or cancel the mission first.',
};

const UserMainScreen = ({ onLogout }) => {
  const { user, activeMission, checkActiveMission, clearActiveMission, setMission } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [showRescuerRegistration, setShowRescuerRegistration] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showReportRescue, setShowReportRescue] = useState(false);
  const [showRescuerDashboard, setShowRescuerDashboard] = useState(false);
  const [showRescueMission, setShowRescueMission] = useState(false);
  const [showRescueScreen, setShowRescueScreen] = useState(false);
  const [showJemoy, setShowJemoy] = useState(false);
  const [showShelterApplication, setShowShelterApplication] = useState(false);
  const [showShelterManager, setShowShelterManager] = useState(false);
  const [isVerifiedRescuer, setIsVerifiedRescuer] = useState(false);
  const wasVerifiedRef = useRef(false); // Track if user was previously verified
  const previousUserIdRef = useRef(null); // Track previous user ID to detect user changes

  // Enforce active mission lock - prevent back button from escaping mission screen
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isMissionActive(activeMission)) {
        Alert.alert(
          'Mission In Progress',
          'You cannot leave while a rescue mission is active. Please complete or cancel the mission first.',
          [{ text: 'OK' }]
        );
        return true; // Prevent default back behavior
      }
      return false;
    });

    return () => backHandler.remove();
  }, [activeMission]);

  // Reset all state when user changes (e.g., when switching accounts)
  useEffect(() => {
    if (previousUserIdRef.current !== null && previousUserIdRef.current !== user?.id) {
      // User has changed - reset all state
      setActiveTab('home');
      setShowRescuerRegistration(false);
      setShowNotifications(false);
      setShowReportRescue(false);
      setShowRescuerDashboard(false);
      setShowRescueMission(false);
      setShowRescueScreen(false);
      setShowJemoy(false);
      setShowShelterApplication(false);
      setShowShelterManager(false);
      setIsVerifiedRescuer(false);
      wasVerifiedRef.current = false;
    }
    previousUserIdRef.current = user?.id;
  }, [user?.id]);

  // Check for active mission on mount and when user changes
  useEffect(() => {
    if (user?.id) {
      checkActiveMission();
    }
  }, [user?.id, checkActiveMission]);

  // Enforce mission lock - redirect to mission screen if there's an active mission
  // This runs on every render to ensure the user cannot escape
  useEffect(() => {
    if (isMissionActive(activeMission)) {
      // Force all navigation states to be reset when mission is active
      if (!showRescueMission) {
        setShowRescueMission(true);
      }
      // Close all other screens to ensure user is locked to mission
      if (showRescuerDashboard) setShowRescuerDashboard(false);
      if (showNotifications) setShowNotifications(false);
      if (showReportRescue) setShowReportRescue(false);
      if (showRescuerRegistration) setShowRescuerRegistration(false);
      if (showRescueScreen) setShowRescueScreen(false);
      if (showJemoy) setShowJemoy(false);
      if (showShelterApplication) setShowShelterApplication(false);
      if (showShelterManager) setShowShelterManager(false);
    }
  }, [activeMission, showRescueMission, showRescuerDashboard, showNotifications, showReportRescue, showRescuerRegistration, showRescueScreen, showJemoy, showShelterApplication, showShelterManager]);

  // Function to check rescuer status
  const checkRescuerStatus = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      // Get auth token from AsyncStorage
      const token = await AsyncStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      
      const response = await fetch(
        withCacheBusting(`${CONFIG.API_URL}/rescuer-applications/my-application`),
        {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Authorization': token ? `Bearer ${token}` : '',
          }
        }
      );
      const data = await response.json();
      
      // If there's an application record, prioritize its status
      if (data.hasApplication) {
        const isApproved = data.application?.status === 'approved';
        setIsVerifiedRescuer(isApproved);
      } else if (user?.role === 'rescuer') {
        setIsVerifiedRescuer(true);
      } else {
        setIsVerifiedRescuer(false);
      }
    } catch (error) {
      console.error('Error checking rescuer status:', error);
      setIsVerifiedRescuer(false);
    }
  }, [user?.id, user?.role]);

  // Check rescuer status on mount
  useEffect(() => {
    checkRescuerStatus();
  }, [user?.id, checkRescuerStatus]);

  // Watch for verification revocation - only trigger when transitioning from verified to not verified
  useEffect(() => {
    // If user WAS verified and now they're NOT, show the revoke message
    if (wasVerifiedRef.current && !isVerifiedRescuer) {
      Alert.alert(
        'Access Revoked',
        'Your rescuer verification has been revoked. You no longer have access to the rescuer dashboard.',
        [{ text: 'OK' }]
      );
    }
    
    // Update the ref to track current state for next comparison
    wasVerifiedRef.current = isVerifiedRescuer;
  }, [isVerifiedRescuer]);

  // Memoized handlers to prevent unnecessary re-renders
  const showMissionAlert = useCallback(() => {
    Alert.alert(MISSION_ALERT.title, MISSION_ALERT.message, [{ text: 'OK' }]);
  }, []);

  const handleTabChange = useCallback((tabId) => {
    if (isMissionActive(activeMission)) {
      showMissionAlert();
      return;
    }
    
    setActiveTab(tabId);
    setShowRescuerRegistration(false);
    setShowNotifications(false);
    setShowReportRescue(false);
    setShowRescuerDashboard(false);
    setShowJemoy(false);
    setShowShelterApplication(false);
    setShowShelterManager(false);
    
    // Re-check rescuer status when navigating to rescue tab
    if (tabId === 'rescue') {
      checkRescuerStatus();
    }
  }, [activeMission, showMissionAlert, checkRescuerStatus]);

  const handleNavigateToRescuerDashboard = useCallback(() => {
    if (isMissionActive(activeMission)) {
      showMissionAlert();
      return;
    }
    setShowRescuerDashboard(true);
    setShowRescuerRegistration(false);
    setShowNotifications(false);
    setShowReportRescue(false);
  }, [activeMission, showMissionAlert]);

  const handleGoBackFromRescuerDashboard = useCallback(() => {
    if (isMissionActive(activeMission)) return;
    setShowRescuerDashboard(false);
  }, [activeMission]);

  const handleNavigateToRescuerRegistration = useCallback(() => {
    if (isMissionActive(activeMission)) {
      showMissionAlert();
      return;
    }
    setShowRescuerRegistration(true);
    setShowNotifications(false);
    setShowReportRescue(false);
    setShowRescuerDashboard(false);
    setShowRescueScreen(false);
  }, [activeMission, showMissionAlert]);

  // Handler for "Become a Rescuer" button - shows rescue screen or dashboard based on status
  const handleNavigateToRescueFromSettings = useCallback(async () => {
    if (isMissionActive(activeMission)) {
      showMissionAlert();
      return;
    }
    
    // Re-check rescuer status fresh before navigating
    let currentlyVerified = false;
    try {
      // Get auth token from AsyncStorage
      const token = await AsyncStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      
      const response = await fetch(
        withCacheBusting(`${CONFIG.API_URL}/rescuer-applications/my-application`),
        {
          cache: 'no-cache',
          headers: { 
            'Cache-Control': 'no-cache', 
            'Pragma': 'no-cache',
            'Authorization': token ? `Bearer ${token}` : '',
          }
        }
      );
      const data = await response.json();
      
      if (data.hasApplication) {
        currentlyVerified = data.application?.status === 'approved';
      } else if (user?.role === 'rescuer') {
        currentlyVerified = true;
      }
      
      setIsVerifiedRescuer(currentlyVerified);
    } catch (error) {
      console.error('Error checking rescuer status:', error);
      setIsVerifiedRescuer(false);
    }
    
    if (currentlyVerified) {
      setShowRescuerDashboard(true);
      setShowRescueScreen(false);
    } else {
      setShowRescueScreen(true);
      setShowRescuerDashboard(false);
    }
    setShowRescuerRegistration(false);
    setShowNotifications(false);
    setShowReportRescue(false);
  }, [activeMission, showMissionAlert, user?.id, user?.role]);

  const handleGoBackFromRescueScreen = useCallback(() => {
    if (isMissionActive(activeMission)) return;
    setShowRescueScreen(false);
  }, [activeMission]);

  const handleGoBackFromRegistration = useCallback(() => {
    if (isMissionActive(activeMission)) return;
    setShowRescuerRegistration(false);
  }, [activeMission]);

  const handleNavigateToJemoy = useCallback(() => {
    if (isMissionActive(activeMission)) {
      showMissionAlert();
      return;
    }
    setShowJemoy(true);
    setShowRescuerRegistration(false);
    setShowNotifications(false);
    setShowReportRescue(false);
    setShowRescuerDashboard(false);
    setShowRescueScreen(false);
  }, [activeMission, showMissionAlert]);

  const handleGoBackFromJemoy = useCallback(() => {
    if (isMissionActive(activeMission)) return;
    setShowJemoy(false);
  }, [activeMission]);

  const handleNavigateToShelterApplication = useCallback(() => {
    if (isMissionActive(activeMission)) {
      showMissionAlert();
      return;
    }
    setShowShelterApplication(true);
    setShowShelterManager(false);
  }, [activeMission, showMissionAlert]);

  const handleGoBackFromShelterApplication = useCallback(() => {
    if (isMissionActive(activeMission)) return;
    setShowShelterApplication(false);
  }, [activeMission]);

  const handleNavigateToShelterManager = useCallback(() => {
    if (isMissionActive(activeMission)) {
      showMissionAlert();
      return;
    }
    setShowShelterManager(true);
    setShowShelterApplication(false);
  }, [activeMission, showMissionAlert]);

  const handleGoBackFromShelterManager = useCallback(() => {
    if (isMissionActive(activeMission)) return;
    setShowShelterManager(false);
  }, [activeMission]);

  // Deep-link navigation from Jemoy chat to app tabs
  const handleJemoyNavigateTo = useCallback((tabName) => {
    if (isMissionActive(activeMission)) {
      showMissionAlert();
      return;
    }
    setShowJemoy(false);
    if (tabName === 'notifications') {
      setShowNotifications(true);
    } else {
      setActiveTab(tabName);
    }
  }, [activeMission, showMissionAlert]);

  const handleNavigateToNotifications = useCallback(() => {
    if (isMissionActive(activeMission)) {
      showMissionAlert();
      return;
    }
    setShowNotifications(true);
    setShowRescuerRegistration(false);
    setShowReportRescue(false);
    setShowRescuerDashboard(false);
  }, [activeMission, showMissionAlert]);

  const handleGoBackFromNotifications = useCallback(() => {
    if (isMissionActive(activeMission)) return;
    setShowNotifications(false);
  }, [activeMission]);

  const handleNavigateToReportRescue = useCallback(() => {
    if (isMissionActive(activeMission)) {
      showMissionAlert();
      return;
    }
    setShowReportRescue(true);
    setShowRescuerRegistration(false);
    setShowNotifications(false);
    setShowRescuerDashboard(false);
  }, [activeMission, showMissionAlert]);

  const handleGoBackFromReportRescue = useCallback(() => {
    if (isMissionActive(activeMission)) return;
    setShowReportRescue(false);
  }, [activeMission]);

  // Handle mission start (from rescuer dashboard)
  const handleStartMission = useCallback((mission) => {
    setMission(mission);
    setShowRescueMission(true);
    setShowRescuerDashboard(false);
  }, [setMission]);

  // Handle mission completion
  const handleMissionComplete = useCallback(() => {
    clearActiveMission();
    setShowRescueMission(false);
    setShowRescuerDashboard(false);
    setActiveTab('rescue');
    checkActiveMission();
  }, [clearActiveMission, checkActiveMission]);

  // Show rescue mission screen if active mission exists (highest priority)
  if (isMissionActive(activeMission) || showRescueMission) {
    if (!isMissionActive(activeMission) && showRescueMission) {
      // Mission was completed or cancelled, allow the completion handler to run
    } else if (isMissionActive(activeMission)) {
      return (
        <SuspensionProvider onLogout={onLogout}>
          <UserRescueMissionScreen
            activeMission={activeMission}
            onMissionComplete={handleMissionComplete}
            onRefresh={checkActiveMission}
          />
        </SuspensionProvider>
      );
    }
  }

  // Show rescuer dashboard screen if active (for verified rescuers)
  if (showRescuerDashboard) {
    return (
      <UserRescuerDashboardScreen
        onGoBack={handleGoBackFromRescuerDashboard}
        onNavigateToReportRescue={handleNavigateToReportRescue}
        onCheckRescuerStatus={checkRescuerStatus}
        onStartMission={handleStartMission}
      />
    );
  }

  // Show report rescue screen if active
  if (showReportRescue) {
    return (
      <UserReportRescueScreen onGoBack={handleGoBackFromReportRescue} />
    );
  }

  // Show notifications screen if active
  if (showNotifications) {
    return (
      <UserNotificationsScreen onGoBack={handleGoBackFromNotifications} />
    );
  }

  // Show Jemoy AI Help Center if active
  if (showJemoy) {
    return (
      <JemoyScreen
        onGoBack={handleGoBackFromJemoy}
        onNavigateTo={handleJemoyNavigateTo}
      />
    );
  }

  // Show rescue screen if active (from settings Become a Rescuer button for non-rescuers)
  if (showRescueScreen) {
    return (
      <UserRescueScreen
        onGoBack={handleGoBackFromRescueScreen}
        onNavigateToRescuerRegistration={handleNavigateToRescuerRegistration}
        onNavigateToReportRescue={handleNavigateToReportRescue}
      />
    );
  }

  // Show shelter application screen if active
  if (showShelterApplication) {
    return (
      <UserShelterApplicationScreen onGoBack={handleGoBackFromShelterApplication} onNavigateToManager={() => { setShowShelterApplication(false); setShowShelterManager(true); }} />
    );
  }

  // Show shelter manager screen if active
  if (showShelterManager) {
    return (
      <UserShelterManagerScreen onGoBack={handleGoBackFromShelterManager} />
    );
  }

  // Show rescuer registration screen if active
  if (showRescuerRegistration) {
    return (
      <UserRescuerRegistrationScreen onGoBack={handleGoBackFromRegistration} />
    );
  }

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return (
          <UserHomeScreen
            onNavigateToRescue={() => setActiveTab('rescue')}
            onNavigateToPets={() => setActiveTab('pets')}
            onNavigateToNotifications={handleNavigateToNotifications}
            onNavigateToReportRescue={handleNavigateToReportRescue}
            activeTab={activeTab}
          />
        );
      case 'pets':
        return <UserPetsScreen />;
      case 'adoptions':
        return <UserAdoptionsScreen />;
      case 'shelter':
        return (
          <UserShelterScreen />
        );
      case 'rescue':
        // If verified rescuer, show dashboard directly
        if (isVerifiedRescuer) {
          return (
            <UserRescuerDashboardScreen
              onGoBack={() => setActiveTab('home')}
              onNavigateToReportRescue={handleNavigateToReportRescue}
              onCheckRescuerStatus={checkRescuerStatus}
              onStartMission={(mission) => {
                setMission(mission);
                setShowRescueMission(true);
              }}
            />
          );
        }
        // Otherwise show regular rescue screen
        return (
          <UserRescueScreen
            onGoBack={() => setActiveTab('home')}
            onNavigateToRescuerRegistration={handleNavigateToRescuerRegistration}
            onNavigateToReportRescue={handleNavigateToReportRescue}
          />
        );
      case 'mission':
        return <UserMissionScreen />;
      case 'settings':
        return <UserSettingsScreen onLogout={onLogout} onNavigateToRescuerRegistration={handleNavigateToRescueFromSettings} onNavigateToJemoy={handleNavigateToJemoy} onNavigateToShelterApplication={handleNavigateToShelterApplication} onNavigateToShelterManager={handleNavigateToShelterManager} />;
      default:
        return <UserHomeScreen />;
    }
  };

  return (
    <SuspensionProvider onLogout={onLogout}>
      <View style={styles.container}>
        {renderScreen()}
        <UserBottomTabBar activeTab={activeTab} onTabChange={handleTabChange} />
      </View>
    </SuspensionProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});

export default memo(UserMainScreen);
