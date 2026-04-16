import { useState } from 'react';

import AdminAddPetScreen from './AdminAddPetScreen';
import AdminAdoptionsScreen from './AdminAdoptionsScreen';
import AdminDashboard from './AdminDashboard';
import AdminPetsScreen from './AdminPetsScreen';
import AdminRescueReportsScreen from './AdminRescueReportsScreen';
import AdminRescuerApplicationsScreen from './AdminRescuerApplicationsScreen';
import AdminSettingsScreen from './AdminSettingsScreen';
import AdminShelterApplicationsScreen from './AdminShelterApplicationsScreen';
import AdminShelterManagementScreen from './AdminShelterManagementScreen';
import AdminShelterTransfersScreen from './AdminShelterTransfersScreen';
import AdminUsersScreen from './AdminUsersScreen';

export { default as AdminAddPetScreen } from './AdminAddPetScreen';
export { default as AdminAdoptionsScreen } from './AdminAdoptionsScreen';
export { default as AdminDashboard } from './AdminDashboard';
export { default as AdminPetsScreen } from './AdminPetsScreen';
export { default as AdminRescueReportsScreen } from './AdminRescueReportsScreen';
export { default as AdminRescuerApplicationsScreen } from './AdminRescuerApplicationsScreen';
export { default as AdminSettingsScreen } from './AdminSettingsScreen';
export { default as AdminShelterApplicationsScreen } from './AdminShelterApplicationsScreen';
export { default as AdminShelterManagementScreen } from './AdminShelterManagementScreen';
export { default as AdminShelterTransfersScreen } from './AdminShelterTransfersScreen';
export { default as AdminUsersScreen } from './AdminUsersScreen';

// Export shared utilities for potential use in other parts of the app
export * from './shared';

export default function AdminIndexRoute({ onLogout, adminToken }) {
  const [currentScreen, setCurrentScreen] = useState('dashboard');

  const navigateTo = (screenName) => {
    setCurrentScreen(screenName);
  };

  const handleGoBack = () => {
    setCurrentScreen('dashboard');
  };

  if (currentScreen === 'users') {
    return <AdminUsersScreen onGoBack={handleGoBack} adminToken={adminToken} />;
  }

  if (currentScreen === 'pets') {
    return <AdminPetsScreen onGoBack={handleGoBack} adminToken={adminToken} />;
  }

  if (currentScreen === 'rescues') {
    return <AdminRescueReportsScreen onGoBack={handleGoBack} adminToken={adminToken} />;
  }

  if (currentScreen === 'adoptions') {
    return <AdminAdoptionsScreen onGoBack={handleGoBack} adminToken={adminToken} />;
  }

  if (currentScreen === 'addPet') {
    return <AdminAddPetScreen onGoBack={handleGoBack} adminToken={adminToken} />;
  }

  if (currentScreen === 'settings') {
    return <AdminSettingsScreen onGoBack={handleGoBack} adminToken={adminToken} />;
  }

  if (currentScreen === 'shelterApplications') {
    return <AdminShelterApplicationsScreen onGoBack={handleGoBack} adminToken={adminToken} />;
  }

  if (currentScreen === 'shelters') {
    return <AdminShelterManagementScreen onGoBack={handleGoBack} adminToken={adminToken} />;
  }

  if (currentScreen === 'rescuerApplications') {
    return <AdminRescuerApplicationsScreen onGoBack={handleGoBack} adminToken={adminToken} />;
  }

  if (currentScreen === 'shelterTransfers') {
    return <AdminShelterTransfersScreen onGoBack={handleGoBack} adminToken={adminToken} />;
  }

  if (currentScreen === 'deliveries') {
    return <AdminShelterTransfersScreen onGoBack={handleGoBack} adminToken={adminToken} mode="deliveries" />;
  }

  return (
    <AdminDashboard
      onNavigate={navigateTo}
      onLogout={onLogout}
      adminToken={adminToken}
    />
  );
}

