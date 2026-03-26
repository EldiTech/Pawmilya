import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { petService } from '../../services';
import { normalizeImageUrl } from '../../utils/imageUrl';

const FILTERS = ['All', 'Dogs', 'Cats', 'Birds', 'Rabbits', 'Others'];
const SORT_MODES = ['name_asc', 'newest', 'oldest'];
const SORT_LABELS = {
  name_asc: 'Name A-Z',
  newest: 'Newest First',
  oldest: 'Oldest First',
};

// Helper to get image URL - supports base64 and legacy file paths
const getImageUrl = (imagePath) => {
  return normalizeImageUrl(imagePath, 'https://via.placeholder.com/150?text=No+Image');
};

const PetCard = ({ pet, onPress, onFavoritePress }) => (
  <TouchableOpacity style={styles.petCard} activeOpacity={0.8} onPress={() => onPress(pet)}>
    <Image 
      source={{ uri: getImageUrl(pet.image) }} 
      style={styles.petImage} 
    />
    <View style={styles.petBadge}>
      <Text style={styles.petBadgeText}>Available</Text>
    </View>
    <TouchableOpacity style={styles.favoriteBtn} onPress={() => onFavoritePress(pet)}>
      <Ionicons name="heart-outline" size={20} color={COLORS.error} />
    </TouchableOpacity>
    <View style={styles.petInfo}>
      <View style={styles.petHeader}>
        <Text style={styles.petName}>{pet.name}</Text>
        <Text style={styles.petGender}>{pet.gender === 'Male' ? '♂' : '♀'}</Text>
      </View>
      <Text style={styles.petBreed}>{pet.breed || 'Unknown breed'}</Text>
      <Text style={styles.petAge}>{pet.age}</Text>
      <View style={styles.petLocation}>
        <Ionicons name="location" size={12} color={COLORS.primary} />
        <Text style={styles.petLocationText}>{pet.location || 'Location not specified'}</Text>
      </View>
    </View>
  </TouchableOpacity>
);

const PetsScreen = ({ onNavigateToLogin }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [petsData, setPetsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortMode, setSortMode] = useState('name_asc');
  
  // Pet detail modal state
  const [selectedPet, setSelectedPet] = useState(null);
  const [petModalVisible, setPetModalVisible] = useState(false);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    fetchPets();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [selectedFilter]);

  const fetchPets = async () => {
    // Abort any in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      const filters = {};
      
      // Map filter to category
      if (selectedFilter !== 'All') {
        filters.category = selectedFilter.slice(0, -1); // Remove 's' from Dogs, Cats, etc.
      }
      
      if (searchQuery) {
        filters.search = searchQuery;
      }

      const response = await petService.getPets(filters);
      
      if (controller.signal.aborted) return;

      if (response.success && Array.isArray(response.data)) {
        setPetsData(response.data);
      } else if (Array.isArray(response.data)) {
        setPetsData(response.data);
      } else if (Array.isArray(response)) {
        setPetsData(response);
      } else {
        setPetsData([]);
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('Error fetching pets:', error);
      Alert.alert('Error', 'Failed to load pets. Please try again.');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPets();
    setRefreshing(false);
  }, [selectedFilter, searchQuery]);

  const handleSearch = () => {
    fetchPets();
  };

  const handleSortToggle = useCallback(() => {
    setSortMode((prev) => {
      const currentIndex = SORT_MODES.indexOf(prev);
      const nextIndex = (currentIndex + 1) % SORT_MODES.length;
      return SORT_MODES[nextIndex];
    });
  }, []);

  const sortedPets = useMemo(() => {
    const items = [...petsData];

    if (sortMode === 'name_asc') {
      items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortMode === 'newest') {
      items.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (sortMode === 'oldest') {
      items.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    }

    return items;
  }, [petsData, sortMode]);

  const handleFilterPress = () => {
    Alert.alert(
      'Advanced Filters',
      'Age range, size, temperament, and more filters coming soon!',
      [{ text: 'OK', style: 'default' }]
    );
  };

  // Handle pet card press - show detail modal
  const handlePetPress = useCallback((pet) => {
    setSelectedPet(pet);
    setPetModalVisible(true);
  }, []);

  // Handle favorite press - requires login
  const handleFavoritePress = useCallback((pet) => {
    Alert.alert(
      'Account Required',
      'Please create an account to save pets to your favorites.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Up', onPress: () => onNavigateToLogin?.() },
      ]
    );
  }, [onNavigateToLogin]);

  // Close pet modal
  const handleClosePetModal = useCallback(() => {
    setPetModalVisible(false);
    setSelectedPet(null);
  }, []);

  // Handle adopt button - requires login
  const handleAdoptPress = useCallback(() => {
    Alert.alert(
      'Account Required',
      'Please create an account to submit an adoption application.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Up', onPress: () => onNavigateToLogin?.() },
      ]
    );
  }, [onNavigateToLogin]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Find Your Friend</Text>
            <View style={styles.headerSubtitleRow}>
              <Text style={styles.headerSubtitle}>Adopt, don't shop </Text>
              <MaterialCommunityIcons name="paw" size={16} color={COLORS.primary} />
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={COLORS.textMedium} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, breed, location..."
            placeholderTextColor={COLORS.textMedium}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.filterButton} onPress={handleFilterPress}>
            <Ionicons name="options" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}
          contentContainerStyle={styles.filtersContent}
        >
          {FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterChip, selectedFilter === filter && styles.filterChipActive]}
              onPress={() => setSelectedFilter(filter)}
            >
              <Text style={[styles.filterText, selectedFilter === filter && styles.filterTextActive]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Results Count */}
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>{sortedPets.length} pets available</Text>
          <TouchableOpacity style={styles.sortButton} onPress={handleSortToggle}>
            <Text style={styles.sortText}>{SORT_LABELS[sortMode]}</Text>
            <Ionicons name="chevron-down" size={16} color={COLORS.textMedium} />
          </TouchableOpacity>
        </View>

        {/* Pets Grid */}
        <View style={styles.petsGrid}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading pets...</Text>
            </View>
          ) : sortedPets.length > 0 ? (
            sortedPets.map((pet) => (
              <PetCard 
                key={pet.id} 
                pet={pet} 
                onPress={handlePetPress}
                onFavoritePress={handleFavoritePress}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="paw-off" size={64} color={COLORS.textMedium} />
              <Text style={styles.emptyText}>No pets found</Text>
              <Text style={styles.emptySubtext}>Try adjusting your search or filters</Text>
            </View>
          )}
        </View>

        <View style={styles.bottomSpacing} />
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
                  source={{ uri: getImageUrl(selectedPet.image) }} 
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
                  onPress={handleAdoptPress}
                >
                  <Ionicons name="heart" size={20} color={COLORS.textWhite} />
                  <Text style={styles.modalAdoptBtnText}>Adopt {selectedPet.name}</Text>
                </TouchableOpacity>
                
                <Text style={styles.modalLoginHint}>
                  Create an account to adopt this pet
                </Text>
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
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textMedium,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.round,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark,
    marginLeft: SPACING.md,
  },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Filters
  filtersContainer: {
    marginBottom: SPACING.lg,
  },
  filtersContent: {
    paddingHorizontal: SPACING.xl,
  },
  filterChip: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.round,
    marginRight: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.medium,
    color: COLORS.textMedium,
  },
  filterTextActive: {
    color: COLORS.textWhite,
  },

  // Results
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  resultsCount: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    marginRight: 4,
  },

  // Pets Grid
  petsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  emptyState: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl,
  },
  emptyText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
    marginTop: SPACING.lg,
  },
  emptySubtext: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    marginTop: SPACING.xs,
  },
  petCard: {
    width: '47%',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  petImage: {
    width: '100%',
    height: 150,
  },
  petBadge: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  petBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textWhite,
  },
  favoriteBtn: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.backgroundWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  petInfo: {
    padding: SPACING.md,
  },
  petHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  petName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  petGender: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.primary,
  },
  petBreed: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: 2,
  },
  petAge: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textLight,
    marginTop: 2,
  },
  petLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  petLocationText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
    marginLeft: 4,
  },

  bottomSpacing: {
    height: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
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
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  modalAdoptBtnText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },
  modalLoginHint: {
    textAlign: 'center',
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginBottom: SPACING.lg,
  },
});

export default memo(PetsScreen);
