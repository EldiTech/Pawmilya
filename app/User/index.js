import { collection, getDocs, query, where } from 'firebase/firestore';
import { memo, useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { COLORS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebaseConfig';
import RescueScreen from '../Guest/RescueScreen';
import UserRescueMissionScreen from '../Rescuer/UserRescueMissionScreen';
import UserRescuerDashboardScreen from '../Rescuer/UserRescuerDashboardScreen';
import UserRescuerRegistrationScreen from '../Rescuer/UserRescuerRegistrationScreen';
import AvailablePetsScreen from '../Shelter/AvailablePetsScreen';
import ConfigureProfileScreen from '../Shelter/ConfigureProfileScreen';
import RescuedPetsScreen from '../Shelter/RescuedPetsScreen';
import ShelterAdoptionRequestsScreen from '../Shelter/ShelterAdoptionRequestsScreen';
import ShelterChatsScreen from '../Shelter/ShelterChatsScreen';
import ShelterDashboard from '../Shelter/ShelterDashboard';
import ShelterFundsScreen from '../Shelter/ShelterFundsScreen';
import ShelterTransferRequestsScreen from '../Shelter/ShelterTransferRequestsScreen';
import UserShelterApplicationScreen from '../Shelter/UserShelterApplicationScreen';
import AdoptionChatScreen from './AdoptionChatScreen';
import AvailableSheltersScreen from './AvailableSheltersScreen';
import JemoyScreen from './JemoyScreen';
import { SuspensionProvider } from './SuspendedAccountModal';
import UserAdoptionsScreen from './UserAdoptionsScreen';
import UserBottomTabBar from './UserBottomTabBar';
import UserHomeScreen from './UserHomeScreen';
import UserNotificationsScreen from './UserNotificationsScreen';
import UserPetsScreen from './UserPetsScreen';
import UserSettingsScreen from './UserSettingsScreen';

const LOCKED_RESCUE_MISSION_STATUSES = ['in_progress', 'on_the_way', 'arrived'];

function UserScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [checkingRescuerEntry, setCheckingRescuerEntry] = useState(false);
  const [activeRescueMission, setActiveRescueMission] = useState(null);
  const [activeChat, setActiveChat] = useState(null);

  const isRescueMissionLocked = useCallback(() => {
    if (activeTab !== 'rescueMission') {
      return false;
    }

    const missionStatus = String(activeRescueMission?.status || '').toLowerCase();

    // Default to locked while in mission screen if status is missing/unknown.
    if (!missionStatus) {
      return true;
    }

    return LOCKED_RESCUE_MISSION_STATUSES.includes(missionStatus);
  }, [activeRescueMission?.status, activeTab]);

  const handleTabChange = useCallback((tabId) => {
    const isMissionLocked = isRescueMissionLocked();

    if (isMissionLocked && tabId !== 'rescueMission') {
      Alert.alert(
        'Mission In Progress',
        'You cannot leave the rescue mission until it is submitted for admin verification.'
      );
      return;
    }

    setActiveTab(tabId);
  }, [isRescueMissionLocked]);

  const handleNotifications = useCallback(() => {
    setActiveTab('notifications');
  }, []);

  const handleStartRescueMission = useCallback((missionReport) => {
    if (!missionReport) {
      return;
    }

    setActiveRescueMission(missionReport);
    setActiveTab('rescueMission');
  }, []);

  const handleMissionComplete = useCallback(() => {
    setActiveRescueMission(null);
    setActiveTab('rescuerDashboard');
  }, []);

  const handleOpenChat = useCallback((chatMeta) => {
    if (!chatMeta?.chatId) return;
    setActiveChat(chatMeta);
    setActiveTab('adoptionChat');
  }, []);

  const handleCloseChat = useCallback(() => {
    const returnTab = activeChat?.returnTab || 'adoptions';
    setActiveTab(returnTab);
    setActiveChat(null);
  }, [activeChat?.returnTab]);

  const handleRescuerEntry = useCallback(async () => {
    if (checkingRescuerEntry) {
      return;
    }

    setCheckingRescuerEntry(true);
    const currentUserId = user?.uid || user?.id;

    if (!currentUserId) {
      setActiveTab('rescuerApplication');
      setCheckingRescuerEntry(false);
      return;
    }

    try {
      const applicationsQuery = query(
        collection(db, 'rescuer_applications'),
        where('user_id', '==', currentUserId)
      );
      const snapshot = await getDocs(applicationsQuery);

      if (snapshot.empty) {
        setActiveTab('rescuerApplication');
        return;
      }

      const applications = snapshot.docs.map((applicationDoc) => ({
        id: applicationDoc.id,
        ...applicationDoc.data(),
      }));

      applications.sort((a, b) => {
        const aMillis = a.created_at?.toDate ? a.created_at.toDate().getTime() : 0;
        const bMillis = b.created_at?.toDate ? b.created_at.toDate().getTime() : 0;
        return bMillis - aMillis;
      });

      const latestStatus = String(applications[0]?.status || '').toLowerCase();
      setActiveTab(latestStatus === 'approved' ? 'rescuerDashboard' : 'rescuerApplication');
    } catch (error) {
      setActiveTab('rescuerApplication');
    } finally {
      setCheckingRescuerEntry(false);
    }
  }, [checkingRescuerEntry, user?.id, user?.uid]);

  const handleShelterManagerEntry = useCallback(async () => {
    try {
      const { shelterService } = require('../../services');
      const managedShelter = await shelterService.getManagedShelter();
      const shelter = managedShelter?.success ? managedShelter.data : null;

      if (!shelter) {
        Alert.alert(
          'Shelter Profile Missing',
          'We could not find your shelter profile. Please complete your shelter application first.'
        );
        setActiveTab('shelterApplication');
        return;
      }

      const missingFields = [];
      if (!String(shelter?.shelterType || '').trim()) missingFields.push('Shelter Type');
      if (!String(shelter?.name || '').trim()) missingFields.push('Shelter Name');
      if (!String(shelter?.phone || '').trim()) missingFields.push('Phone Number');

      if (missingFields.length > 0) {
        Alert.alert(
          'Complete Profile Required',
          `Please complete your shelter profile (${missingFields.join(', ')}) before continuing operations.`,
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Complete Now', onPress: () => setActiveTab('shelterConfigureProfile') },
          ]
        );
        return;
      }

      setActiveTab('shelterManager');
    } catch (error) {
      Alert.alert('Error', 'Unable to verify shelter profile. Please try again.');
    }
  }, []);

  const renderContent = () => {
    if (activeTab === 'pets') {
      return <UserPetsScreen />;
    }

    if (activeTab === 'rescue') {
      return <RescueScreen prefills={{
         name: user?.full_name || user?.name || '',
         email: user?.email || '',
         phone: user?.phone_number || user?.phone || user?.phoneNumber || ''
      }} onNavigateToRescuerDashboard={() => setActiveTab('rescuerDashboard')} />;
    }

    if (activeTab === 'shelter') {
      return <AvailableSheltersScreen onOpenChat={handleOpenChat} />;
    }

    if (activeTab === 'adoptions') {
      return <UserAdoptionsScreen onOpenChat={handleOpenChat} />;
    }

    if (activeTab === 'adoptionChat') {
      return <AdoptionChatScreen chatId={activeChat?.chatId} viewerRole={activeChat?.role} onBack={handleCloseChat} />;
    }

    if (activeTab === 'settings') {
      return (
        <UserSettingsScreen 
          onNavigateToRescuerRegistration={handleRescuerEntry}
          onNavigateToShelterApplication={() => setActiveTab('shelterApplication')}
          onNavigateToShelterManager={handleShelterManagerEntry}
          onNavigateToJemoy={() => setActiveTab('jemoy')}
        />
      );
    }

    if (activeTab === 'jemoy') {
      return <JemoyScreen onBack={() => setActiveTab('settings')} />;
    }

    if (activeTab === 'rescuerApplication') {
      return <UserRescuerRegistrationScreen onGoBack={() => setActiveTab('settings')} />;
    }

    if (activeTab === 'rescuerDashboard') {
      return (
        <UserRescuerDashboardScreen
          onGoBack={() => setActiveTab('settings')}
          onStartMission={handleStartRescueMission}
        />
      );
    }

    if (activeTab === 'rescueMission') {
      return (
        <UserRescueMissionScreen
          activeMission={activeRescueMission}
          onMissionComplete={handleMissionComplete}
          onGoBack={() => setActiveTab('rescuerDashboard')}
          onRefresh={handleRescuerEntry}
          onMissionStateChange={setActiveRescueMission}
        />
      );
    }

    if (activeTab === 'shelterApplication') {
      return <UserShelterApplicationScreen onBack={() => setActiveTab('settings')} />;
    }

    if (activeTab === 'shelterManager') {
      return <ShelterDashboard 
        onBack={() => setActiveTab('settings')} 
        onNavigateToConfigureProfile={() => setActiveTab('shelterConfigureProfile')}
        onNavigateToTransfers={() => setActiveTab('shelterTransfers')}
        onNavigateToRescuedPets={() => setActiveTab('shelterRescuedPets')}
        onNavigateToAvailablePets={() => setActiveTab('shelterAvailablePets')}
        onNavigateToAdoptionRequests={() => setActiveTab('shelterAdoptionRequests')}
        onNavigateToChats={() => setActiveTab('shelterChats')}
        onNavigateToFunds={() => setActiveTab('shelterFunds')}
      />;
    }

    if (activeTab === 'shelterAdoptionRequests') {
      return <ShelterAdoptionRequestsScreen onBack={() => setActiveTab('shelterManager')} onOpenChat={handleOpenChat} />;
    }

    if (activeTab === 'shelterChats') {
      return <ShelterChatsScreen onBack={() => setActiveTab('shelterManager')} onOpenChat={handleOpenChat} />;
    }

    if (activeTab === 'shelterFunds') {
      return <ShelterFundsScreen onBack={() => setActiveTab('shelterManager')} />;
    }

    if (activeTab === 'shelterTransfers') {
      return <ShelterTransferRequestsScreen onBack={() => setActiveTab('shelterManager')} />;
    }

    if (activeTab === 'shelterConfigureProfile') {
      return <ConfigureProfileScreen onBack={() => setActiveTab('shelterManager')} />;
    }

    if (activeTab === 'shelterRescuedPets') {
      return <RescuedPetsScreen onBack={() => setActiveTab('shelterManager')} />;
    }

    if (activeTab === 'shelterAvailablePets') {
      return <AvailablePetsScreen onBack={() => setActiveTab('shelterManager')} />;
    }

    if (activeTab === 'notifications') {
      return <UserNotificationsScreen onGoBack={() => setActiveTab('home')} />;
    }

    console.log('Rendering UserHomeScreen with activeTab:', activeTab);
    return (
      <UserHomeScreen
        activeTab={activeTab}
        onNavigateToRescue={() => setActiveTab('rescue')}
        onNavigateToPets={() => setActiveTab('pets')}
        onNavigateToNotifications={handleNotifications}
        onNavigateToReportRescue={() => setActiveTab('rescue')}
        onNavigateToAdoptions={() => setActiveTab('adoptions')}
        onNavigateToRescuerRegistration={handleRescuerEntry}
        onNavigateToShelterApplication={() => setActiveTab('shelterApplication')}
        onNavigateToShelterManager={handleShelterManagerEntry}
      />
    );
  };

  return (
    <SuspensionProvider>
      <View style={styles.container}>
        <View style={styles.content}>{renderContent()}</View>
        {checkingRescuerEntry && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        )}
        {!isRescueMissionLocked() && 
         activeTab !== 'adoptionChat' && 
         activeTab !== 'jemoy' && 
         activeTab !== 'rescuerApplication' && 
         activeTab !== 'rescuerDashboard' &&
         activeTab !== 'rescueMission' &&
         !(activeTab.startsWith('shelter') && activeTab !== 'shelter') && (
          <UserBottomTabBar activeTab={activeTab} onTabChange={handleTabChange} />
        )}
      </View>
    </SuspensionProvider>
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
});

export default memo(UserScreen);
