import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { petService, userService } from '../../services';
import { useAuth } from '../../context/AuthContext';

// Import shared utilities
import {
  getAvatarUrl,
  getPetImageUrl,
  parseApiResponse,
  handleApiError,
  RefreshControl,
  BottomSpacing,
} from './shared';

const UserHomeScreen = ({ onNavigateToRescue, onNavigateToPets, onNavigateToNotifications, onNavigateToReportRescue, onNavigateToAdoptions, activeTab, notificationRefreshKey = 0 }) => {
  const { user } = useAuth();
  const [userData, setUserData] = useState({
    name: '',
    avatar: '',
    savedPets: 0,
    applications: 0,
    adopted: 0,
  });
  const [featuredPets, setFeaturedPets] = useState([]);
  const [applications, setApplications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Pet detail modal state
  const [selectedPet, setSelectedPet] = useState(null);
  const [petModalVisible, setPetModalVisible] = useState(false);

  // Memoized avatar URI
  const avatarUri = useMemo(() => getAvatarUrl(userData.avatar), [userData.avatar]);

  // Fetch notification count - separate function for reusability
  const fetchNotificationCount = useCallback(async () => {
    try {
      const response = await userService.getUnreadNotificationsCount();
      
      // Handle the response - api.js wraps it as { success: true, data: { count: X } }
      if (response?.success && response.data) {
        setNotificationCount(response.data.count || 0);
      } else if (typeof response?.count === 'number') {
        setNotificationCount(response.count);
      } else if (typeof response?.data === 'number') {
        setNotificationCount(response.data);
      } else {
        setNotificationCount(0);
      }
    } catch (error) {
      setNotificationCount(0);
    }
  }, []);

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch featured pets
      const petsResponse = await petService.getFeaturedPets(6);
      const petsData = parseApiResponse(petsResponse);
      setFeaturedPets(petsData);

      // Try to fetch user profile
      try {
        const profileResponse = await userService.getProfile();
        const profile = profileResponse?.data || profileResponse;
        if (profile) {
          setUserData(prev => ({
            ...prev,
            name: profile.full_name || 'User',
            avatar: profile.avatar_url || '',
          }));
        }
      } catch (err) {
        // Not logged in or profile fetch failed
      }

      // Try to fetch favorites count
      try {
        const favoritesResponse = await userService.getFavorites();
        const favorites = parseApiResponse(favoritesResponse);
        setUserData(prev => ({ ...prev, savedPets: favorites.length }));
      } catch (err) {
        // Favorites fetch failed
      }

      // Try to fetch applications
      try {
        const appsResponse = await userService.getApplications();
        const apps = parseApiResponse(appsResponse);
        setApplications(apps);
        setUserData(prev => ({
          ...prev,
          applications: apps.filter(a => a.status === 'pending' || a.status === 'reviewing').length,
          adopted: apps.filter(a => a.status === 'approved').length,
        }));
      } catch (err) {
        // Applications fetch failed
      }

      // Fetch notification count
      await fetchNotificationCount();

    } catch (error) {
      handleApiError(error, 'UserHomeScreen');
    } finally {
      setLoading(false);
    }
  }, [fetchNotificationCount]);

  // Initial data fetch - re-fetch when user changes
  useEffect(() => {
    // Reset state when user changes to clear stale data
    setUserData({
      name: '',
      avatar: '',
      savedPets: 0,
      applications: 0,
      adopted: 0,
    });
    setFeaturedPets([]);
    setApplications([]);
    setNotificationCount(0);
    
    if (user?.id) {
      fetchData();
    }
  }, [user?.id, fetchData]);

  // Sync avatar when user avatar changes
  useEffect(() => {
    if (user?.avatar_url) {
      setUserData(prev => ({ ...prev, avatar: user.avatar_url }));
    }
  }, [user?.avatar_url]);

  // Refresh notification count when activeTab changes to 'home'
  useEffect(() => {
    if (activeTab === 'home') {
      fetchNotificationCount();
    }
  }, [activeTab, fetchNotificationCount]);

  // Force immediate badge refresh after notification actions complete.
  useEffect(() => {
    if (activeTab === 'home') {
      fetchNotificationCount();
    }
  }, [notificationRefreshKey, activeTab, fetchNotificationCount]);

  // Set up interval to poll for notifications every 30 seconds
  useEffect(() => {
    const intervalId = setInterval(fetchNotificationCount, 30000);
    return () => clearInterval(intervalId);
  }, [fetchNotificationCount]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // Handle pet card press - show pet detail modal
  const handlePetPress = useCallback((pet) => {
    setSelectedPet(pet);
    setPetModalVisible(true);
  }, []);

  // Handle application press - navigate to adoptions screen
  const handleApplicationPress = useCallback(() => {
    if (onNavigateToAdoptions) {
      onNavigateToAdoptions();
    }
  }, [onNavigateToAdoptions]);

  // Close pet modal
  const handleClosePetModal = useCallback(() => {
    setPetModalVisible(false);
    setSelectedPet(null);
  }, []);

  // Memoized pending applications
  const pendingApplications = useMemo(() => 
    applications.filter(a => a.status === 'pending' || a.status === 'reviewing'),
  [applications]);
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
            <View style={styles.headerText}>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.userName} numberOfLines={1} ellipsizeMode="tail">{userData.name || 'User'}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.notificationBtn} onPress={onNavigateToNotifications}>
            <Ionicons name="notifications-outline" size={24} color={COLORS.brown} />
            {notificationCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {notificationCount > 99 ? '99+' : notificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* User Stats Card */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Your Activity</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <View style={[styles.statIconContainer, { backgroundColor: COLORS.primary + '15' }]}>
                <Ionicons name="heart" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.statNumber}>{userData.savedPets}</Text>
              <Text style={styles.statLabel}>Saved Pets</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statIconContainer, { backgroundColor: '#FF9800' + '15' }]}>
                <Ionicons name="document-text" size={24} color="#FF9800" />
              </View>
              <Text style={styles.statNumber}>{userData.applications}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statIconContainer, { backgroundColor: COLORS.success + '15' }]}>
                <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
              </View>
              <Text style={styles.statNumber}>{userData.adopted}</Text>
              <Text style={styles.statLabel}>Adopted</Text>
            </View>
          </View>
        </View>

        {/* Main Actions */}
        <View style={styles.mainActionsSection}>
          <TouchableOpacity style={styles.primaryActionCard} activeOpacity={0.8} onPress={onNavigateToPets}>
            <View style={styles.actionCardContent}>
              <View style={styles.actionCardLeft}>
                <View style={styles.actionCardIconContainer}>
                  <Ionicons name="paw" size={32} color={COLORS.textWhite} />
                </View>
                <View style={styles.actionCardText}>
                  <Text style={styles.actionCardTitle}>Find Your Pet</Text>
                  <Text style={styles.actionCardSubtitle}>Browse available pets</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color={COLORS.textWhite} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryActionCard} activeOpacity={0.8} onPress={onNavigateToReportRescue}>
            <View style={styles.actionCardContent}>
              <View style={styles.actionCardLeft}>
                <View style={[styles.actionCardIconContainer, styles.rescueIconContainer]}>
                  <Ionicons name="alert-circle" size={32} color={COLORS.error} />
                </View>
                <View style={styles.actionCardText}>
                  <Text style={styles.secondaryActionCardTitle}>Report a Stray</Text>
                  <Text style={styles.secondaryActionCardSubtitle}>Help animals in need</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color={COLORS.textDark} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Pending Applications */}
        {pendingApplications.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Applications</Text>
            {pendingApplications.slice(0, 3).map((app) => (
              <TouchableOpacity 
                key={app.id} 
                style={styles.applicationCard}
                onPress={handleApplicationPress}
                activeOpacity={0.8}
              >
                <Image 
                  source={{ uri: app.pet_image || 'https://via.placeholder.com/60?text=Pet' }} 
                  style={styles.applicationImage} 
                />
                <View style={styles.applicationInfo}>
                  <Text style={styles.applicationPetName}>{app.pet_name}</Text>
                  <Text style={styles.applicationBreed}>Application #{app.id}</Text>
                  <View style={styles.applicationStatus}>
                    <View style={styles.statusBadge}>
                      <View style={styles.statusDot} />
                      <Text style={styles.statusText}>
                        {app.status === 'pending' ? 'Pending Review' : 'Under Review'}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.viewBtn}>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recommended Pets */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recommended for You</Text>
            <TouchableOpacity onPress={onNavigateToPets}>
              <Text style={styles.seeAll}>View All</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : featuredPets.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.petsScroll}
            >
              {featuredPets.map((pet) => (
                <TouchableOpacity 
                  key={pet.id} 
                  style={styles.petCard} 
                  activeOpacity={0.8}
                  onPress={() => handlePetPress(pet)}
                >
                  <Image 
                    source={{ uri: getPetImageUrl(pet.image) }} 
                    style={styles.petImage} 
                  />
                  <View style={styles.petInfo}>
                    <Text style={styles.petName}>{pet.name}</Text>
                    <Text style={styles.petBreed}>{pet.breed || 'Mixed Breed'}</Text>
                    <View style={styles.petMetaRow}>
                      <View style={styles.petMeta}>
                        <Ionicons name="calendar-outline" size={14} color={COLORS.textMedium} />
                        <Text style={styles.petMetaText}>{pet.age || 'Unknown age'}</Text>
                      </View>
                      {pet.location && (
                        <View style={styles.petMeta}>
                          <Ionicons name="location-outline" size={14} color={COLORS.textMedium} />
                          <Text style={styles.petMetaText}>{pet.location}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="paw-outline" size={48} color={COLORS.textMedium} />
              <Text style={styles.emptyText}>No pets available at the moment</Text>
              <Text style={styles.emptySubtext}>Check back later for new arrivals!</Text>
            </View>
          )}
        </View>

        <BottomSpacing />
      </ScrollView>

      {/* Pet Detail Modal */}
      <Modal
        visible={petModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleClosePetModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedPet?.name}</Text>
              <TouchableOpacity onPress={handleClosePetModal} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>
            
            {selectedPet && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Image 
                  source={{ uri: getPetImageUrl(selectedPet.image) }} 
                  style={styles.modalPetImage} 
                />
                
                <View style={styles.modalPetInfo}>
                  <View style={styles.modalInfoRow}>
                    <View style={styles.modalInfoItem}>
                      <Ionicons name="paw" size={20} color={COLORS.primary} />
                      <Text style={styles.modalInfoLabel}>Species</Text>
                      <Text style={styles.modalInfoValue}>{selectedPet.species || 'Unknown'}</Text>
                    </View>
                    <View style={styles.modalInfoItem}>
                      <Ionicons name="male-female" size={20} color={COLORS.primary} />
                      <Text style={styles.modalInfoLabel}>Gender</Text>
                      <Text style={styles.modalInfoValue}>{selectedPet.gender || 'Unknown'}</Text>
                    </View>
                    <View style={styles.modalInfoItem}>
                      <Ionicons name="calendar" size={20} color={COLORS.primary} />
                      <Text style={styles.modalInfoLabel}>Age</Text>
                      <Text style={styles.modalInfoValue}>{selectedPet.age || 'Unknown'}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Breed</Text>
                    <Text style={styles.modalSectionText}>{selectedPet.breed || 'Mixed Breed'}</Text>
                  </View>
                  
                  {selectedPet.description && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>About</Text>
                      <Text style={styles.modalSectionText}>{selectedPet.description}</Text>
                    </View>
                  )}
                  
                  {selectedPet.location && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Location</Text>
                      <View style={styles.modalLocationRow}>
                        <Ionicons name="location" size={16} color={COLORS.primary} />
                        <Text style={styles.modalSectionText}>{selectedPet.location}</Text>
                      </View>
                    </View>
                  )}
                  
                  {selectedPet.adoption_fee && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Adoption Fee</Text>
                      <Text style={styles.modalFeeText}>₱{selectedPet.adoption_fee}</Text>
                    </View>
                  )}
                </View>
                
                <TouchableOpacity 
                  style={styles.modalAdoptBtn}
                  onPress={() => {
                    handleClosePetModal();
                    onNavigateToPets();
                  }}
                >
                  <Text style={styles.modalAdoptBtnText}>View in Pets Section</Text>
                  <Ionicons name="arrow-forward" size={20} color={COLORS.textWhite} />
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 44,
  },
  scrollView: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.md,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  headerText: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  greeting: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
  },
  userName: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.backgroundWhite,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },

  // Stats Card
  statsCard: {
    marginHorizontal: SPACING.xl,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statsTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.lg,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statNumber: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginTop: SPACING.xs,
  },
  statLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
    marginTop: 4,
  },

  // Main Actions
  mainActionsSection: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  primaryActionCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  secondaryActionCard: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 2,
    borderColor: COLORS.borderLight,
  },
  actionCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionCardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  rescueIconContainer: {
    backgroundColor: COLORS.error + '15',
  },
  actionCardText: {
    flex: 1,
  },
  actionCardTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
    marginBottom: 4,
  },
  actionCardSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textWhite,
    opacity: 0.9,
  },
  secondaryActionCardTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  secondaryActionCardSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
  },

  // Sections
  section: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.lg,
  },
  seeAll: {
    fontSize: FONTS.sizes.md,
    color: COLORS.primary,
    fontWeight: FONTS.weights.semiBold,
  },

  // Pets
  petsScroll: {
    paddingRight: SPACING.xl,
  },
  petCard: {
    width: 180,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.xl,
    marginRight: SPACING.md,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  petImage: {
    width: '100%',
    height: 160,
    backgroundColor: COLORS.borderLight,
  },
  petInfo: {
    padding: SPACING.md,
  },
  petName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  petBreed: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginBottom: SPACING.xs,
  },
  petMetaRow: {
    marginTop: SPACING.xs,
  },
  petMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  petMetaText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
    marginLeft: 4,
  },

  // Application Card
  applicationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  applicationImage: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.borderLight,
  },
  applicationInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  applicationPetName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  applicationBreed: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
    marginBottom: SPACING.xs,
  },
  applicationStatus: {
    marginTop: SPACING.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF9800',
    marginRight: 6,
  },
  statusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    color: '#FF9800',
  },
  viewBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty & Loading States
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.xl,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },

  // Pet Detail Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.backgroundWhite,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  modalTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalPetImage: {
    width: '100%',
    height: 250,
    backgroundColor: COLORS.background,
  },
  modalPetInfo: {
    padding: SPACING.lg,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  modalInfoItem: {
    alignItems: 'center',
  },
  modalInfoLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
    marginTop: SPACING.xs,
  },
  modalInfoValue: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
    marginTop: 2,
  },
  modalSection: {
    marginBottom: SPACING.lg,
  },
  modalSectionTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textMedium,
    marginBottom: SPACING.xs,
  },
  modalSectionText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark,
    lineHeight: 22,
  },
  modalLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  modalFeeText: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
  },
  modalAdoptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  modalAdoptBtnText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },
});

export default memo(UserHomeScreen);
