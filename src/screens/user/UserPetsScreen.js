import React, { useState, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Switch,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { petService, adoptionService, userService } from '../../services';
import { useAuth } from '../../context/AuthContext';

// Import shared utilities
import {
  getImageUrl,
  ScreenHeader,
  SearchBar,
  LoadingState,
  EmptyState,
  BottomSpacing,
  RefreshControl,
  useDataFetching,
  useCombinedFilters,
  containerStyles,
} from './shared';

const CATEGORIES = [
  { id: 'all', label: 'All', icon: 'apps' },
  { id: 'dog', label: 'Dogs', icon: 'dog' },
  { id: 'cat', label: 'Cats', icon: 'cat' },
];

// Memoized Pet Card component
const PetCard = memo(({ pet, onView, onAdopt, onFavorite, isFavorite, favoriteLoading }) => (
  <View style={styles.petCard}>
    <TouchableOpacity activeOpacity={0.9} onPress={() => onView(pet)}>
      <Image
        source={{ uri: getImageUrl(pet.image) || 'https://via.placeholder.com/150?text=No+Image' }}
        style={styles.petImage}
      />
      <TouchableOpacity 
        style={styles.favoriteBtn} 
        onPress={() => onFavorite(pet.id)}
        disabled={favoriteLoading}
      >
        {favoriteLoading ? (
          <ActivityIndicator size="small" color={COLORS.error} />
        ) : (
          <Ionicons 
            name={isFavorite ? "heart" : "heart-outline"} 
            size={20} 
            color={COLORS.error} 
          />
        )}
      </TouchableOpacity>
      <View style={styles.petInfo}>
        <View style={styles.petNameRow}>
          <Text style={styles.petName}>{pet.name}</Text>
          <View style={[styles.genderBadge, { backgroundColor: pet.gender === 'Male' ? '#EFF6FF' : '#FDF2F8' }]}>
            <Ionicons 
              name={pet.gender === 'Male' ? 'male' : 'female'} 
              size={12} 
              color={pet.gender === 'Male' ? '#3B82F6' : '#EC4899'} 
            />
          </View>
        </View>
        <Text style={styles.petBreed}>{pet.breed}</Text>
        <View style={styles.petFeeContainer}>
          <Ionicons name="cash-outline" size={14} color={COLORS.primary} />
          <Text style={styles.petFee}>₱{pet.adoption_fee || '0'}</Text>
        </View>
      </View>
    </TouchableOpacity>
    <View style={styles.cardActions}>
      <TouchableOpacity 
        style={styles.viewBtn} 
        onPress={() => onView(pet)}
        activeOpacity={0.8}
      >
        <Ionicons name="eye-outline" size={16} color={COLORS.primary} />
        <Text style={styles.viewBtnText}>View</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.adoptBtn} 
        onPress={() => onAdopt(pet)}
        activeOpacity={0.8}
      >
        <Ionicons name="heart" size={16} color={COLORS.textWhite} />
        <Text style={styles.adoptBtnText}>Adopt</Text>
      </TouchableOpacity>
    </View>
  </View>
));

PetCard.displayName = 'PetCard';

// Memoized Category Button
const CategoryButton = memo(({ category, isActive, onPress }) => (
  <TouchableOpacity
    style={[styles.categoryBtn, isActive && styles.categoryBtnActive]}
    onPress={() => onPress(category.id)}
  >
    <MaterialCommunityIcons
      name={category.icon}
      size={20}
      color={isActive ? COLORS.textWhite : COLORS.primary}
    />
    <Text style={[styles.categoryLabel, isActive && styles.categoryLabelActive]}>
      {category.label}
    </Text>
  </TouchableOpacity>
));

CategoryButton.displayName = 'CategoryButton';

// Adoption form steps configuration
const ADOPTION_STEPS = [
  { id: 1, title: 'Living Situation', icon: 'home' },
  { id: 2, title: 'Household Info', icon: 'people' },
  { id: 3, title: 'Pet Experience', icon: 'paw' },
  { id: 4, title: 'Final Details', icon: 'checkmark-circle' },
];

// Form option buttons component
const OptionButton = memo(({ label, selected, onPress, icon }) => (
  <TouchableOpacity
    style={[styles.optionBtn, selected && styles.optionBtnActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    {icon && (
      <Ionicons
        name={icon}
        size={18}
        color={selected ? '#FFF' : COLORS.textMedium}
        style={{ marginRight: 6 }}
      />
    )}
    <Text style={[styles.optionBtnText, selected && styles.optionBtnTextActive]}>
      {label}
    </Text>
  </TouchableOpacity>
));

OptionButton.displayName = 'OptionButton';

const UserPetsScreen = () => {
  const { user } = useAuth();
  const [selectedPet, setSelectedPet] = useState(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  
  // Favorites state
  const [favorites, setFavorites] = useState([]);
  const [favoriteLoading, setFavoriteLoading] = useState({});
  
  // Adoption form state
  const [adoptionModalVisible, setAdoptionModalVisible] = useState(false);
  const [adoptionStep, setAdoptionStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [adoptionForm, setAdoptionForm] = useState({
    // Step 1: Living Situation
    living_situation: '',
    has_yard: false,
    yard_fenced: false,
    rental_allows_pets: true,
    // Step 2: Household Info
    household_members: '',
    has_children: false,
    children_ages: '',
    has_other_pets: false,
    other_pets_details: '',
    // Step 3: Pet Experience
    previous_pet_experience: '',
    work_schedule: '',
    // Step 4: Final Details
    reason_for_adoption: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    veterinarian_name: '',
    veterinarian_phone: '',
    additional_notes: '',
  });

  // Use custom hook for data fetching
  const { data: pets, loading, refreshing, onRefresh } = useDataFetching(
    useCallback(() => petService.getPets(), [])
  );

  // Fetch favorites on mount
  const fetchFavorites = useCallback(async () => {
    if (!user) return;
    try {
      const response = await userService.getFavorites();
      if (response.success && Array.isArray(response.data)) {
        setFavorites(response.data.map(fav => fav.pet_id || fav.id));
      } else if (Array.isArray(response.data)) {
        setFavorites(response.data.map(fav => fav.pet_id || fav.id));
      } else if (Array.isArray(response)) {
        setFavorites(response.map(fav => fav.pet_id || fav.id));
      }
    } catch (error) {
      // Silently fail - favorites are optional
    }
  }, [user]);

  // Fetch favorites when user changes
  React.useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // Handle favorite toggle
  const handleFavoriteToggle = useCallback(async (petId) => {
    if (!user) {
      Alert.alert(
        'Login Required',
        'Please login to save pets to your favorites.',
        [{ text: 'OK' }]
      );
      return;
    }

    setFavoriteLoading(prev => ({ ...prev, [petId]: true }));
    
    try {
      const isFavorite = favorites.includes(petId);
      if (isFavorite) {
        await userService.removeFavorite(petId);
        setFavorites(prev => prev.filter(id => id !== petId));
      } else {
        await userService.addFavorite(petId);
        setFavorites(prev => [...prev, petId]);
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update favorites');
    } finally {
      setFavoriteLoading(prev => ({ ...prev, [petId]: false }));
    }
  }, [user, favorites]);

  // Search filter function
  const searchFilter = useCallback((pet, query) =>
    pet.name?.toLowerCase().includes(query) ||
    pet.breed?.toLowerCase().includes(query),
  []);

  // Use combined filters hook
  const {
    filteredItems: filteredPets,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
  } = useCombinedFilters(pets, searchFilter, 'species', 'all');

  // Memoized handlers
  const handleViewPet = useCallback((pet) => {
    setSelectedPet(pet);
    setViewModalVisible(true);
  }, []);

  // Reset adoption form
  const resetAdoptionForm = useCallback(() => {
    setAdoptionForm({
      living_situation: '',
      has_yard: false,
      yard_fenced: false,
      rental_allows_pets: true,
      household_members: '',
      has_children: false,
      children_ages: '',
      has_other_pets: false,
      other_pets_details: '',
      previous_pet_experience: '',
      work_schedule: '',
      reason_for_adoption: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      veterinarian_name: '',
      veterinarian_phone: '',
      additional_notes: '',
    });
    setAdoptionStep(1);
  }, []);

  // Open adoption modal
  const handleAdoptPet = useCallback(async (pet) => {
    if (!user) {
      Alert.alert(
        'Login Required',
        'Please login to submit an adoption application.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Check if pet is available
    if (pet.status?.toLowerCase() !== 'available') {
      Alert.alert(
        'Not Available',
        'This pet is not currently available for adoption.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Check for existing application
    try {
      const existing = await adoptionService.checkExistingApplication(pet.id);
      if (existing) {
        Alert.alert(
          'Application Exists',
          'You already have an active application for this pet. Check your adoptions page for updates.',
          [{ text: 'OK' }]
        );
        return;
      }
    } catch (error) {
      // Continue anyway if check fails
    }

    setSelectedPet(pet);
    setViewModalVisible(false);
    resetAdoptionForm();
    setAdoptionModalVisible(true);
  }, [user, resetAdoptionForm]);

  // Handle form field update
  const updateFormField = useCallback((field, value) => {
    setAdoptionForm(prev => ({ ...prev, [field]: value }));
  }, []);

  // Validate current step
  const validateStep = useCallback(() => {
    switch (adoptionStep) {
      case 1:
        if (!adoptionForm.living_situation) {
          Alert.alert('Required', 'Please select your living situation.');
          return false;
        }
        break;
      case 2:
        if (!adoptionForm.household_members) {
          Alert.alert('Required', 'Please enter the number of household members.');
          return false;
        }
        break;
      case 3:
        if (!adoptionForm.work_schedule) {
          Alert.alert('Required', 'Please describe your work schedule.');
          return false;
        }
        break;
      case 4:
        if (!adoptionForm.reason_for_adoption) {
          Alert.alert('Required', 'Please tell us why you want to adopt.');
          return false;
        }
        if (!adoptionForm.emergency_contact_name || !adoptionForm.emergency_contact_phone) {
          Alert.alert('Required', 'Please provide emergency contact information.');
          return false;
        }
        // Validate phone number format (Philippine format)
        const phoneRegex = /^(\+63|0)?[0-9]{10,11}$/;
        const cleanedEmergencyPhone = adoptionForm.emergency_contact_phone.replace(/[\s\-\(\)]/g, '');
        if (!phoneRegex.test(cleanedEmergencyPhone)) {
          Alert.alert('Invalid Phone', 'Please enter a valid phone number (e.g., 09171234567 or +639171234567).');
          return false;
        }
        // Validate veterinarian phone if provided
        const cleanedVetPhone = adoptionForm.veterinarian_phone.replace(/[\s\-\(\)]/g, '');
        if (adoptionForm.veterinarian_phone && !phoneRegex.test(cleanedVetPhone)) {
          Alert.alert('Invalid Phone', 'Please enter a valid veterinarian phone number.');
          return false;
        }
        break;
    }
    return true;
  }, [adoptionStep, adoptionForm]);

  // Handle next step
  const handleNextStep = useCallback(() => {
    if (validateStep()) {
      setAdoptionStep(prev => Math.min(prev + 1, 4));
    }
  }, [validateStep]);

  // Handle previous step
  const handlePrevStep = useCallback(() => {
    setAdoptionStep(prev => Math.max(prev - 1, 1));
  }, []);

  // Submit adoption application
  const handleSubmitAdoption = useCallback(async () => {
    if (!validateStep()) return;

    setSubmitting(true);
    try {
      // Convert form data to proper types for backend validation
      // Clean phone numbers by removing spaces and dashes
      const cleanPhone = (phone) => phone ? phone.replace(/[\s\-\(\)]/g, '') : undefined;
      
      const applicationData = {
        pet_id: selectedPet.id,
        living_situation: adoptionForm.living_situation,
        has_yard: Boolean(adoptionForm.has_yard),
        yard_fenced: Boolean(adoptionForm.yard_fenced),
        rental_allows_pets: Boolean(adoptionForm.rental_allows_pets),
        household_members: adoptionForm.household_members ? parseInt(adoptionForm.household_members, 10) : undefined,
        has_children: Boolean(adoptionForm.has_children),
        children_ages: adoptionForm.children_ages || undefined,
        has_other_pets: Boolean(adoptionForm.has_other_pets),
        other_pets_details: adoptionForm.other_pets_details || undefined,
        previous_pet_experience: adoptionForm.previous_pet_experience || undefined,
        reason_for_adoption: adoptionForm.reason_for_adoption,
        work_schedule: adoptionForm.work_schedule || undefined,
        emergency_contact_name: adoptionForm.emergency_contact_name,
        emergency_contact_phone: cleanPhone(adoptionForm.emergency_contact_phone),
        veterinarian_name: adoptionForm.veterinarian_name || undefined,
        veterinarian_phone: cleanPhone(adoptionForm.veterinarian_phone),
        additional_notes: adoptionForm.additional_notes || undefined,
      };

      const response = await adoptionService.createApplication(applicationData);

      if (response.success) {
        setAdoptionModalVisible(false);
        Alert.alert(
          '🎉 Application Submitted!',
          `Your adoption application for ${selectedPet.name} has been submitted successfully!\n\nWe'll review your application and get back to you soon. You can track your application status in the "My Adoptions" section.`,
          [{ text: 'Great!' }]
        );
        resetAdoptionForm();
        onRefresh(); // Refresh pet list to update status
      }
    } catch (error) {
      // Build detailed error message if validation details are available
      let errorMessage = error.message || 'Failed to submit application. Please try again.';
      if (error.errors && Array.isArray(error.errors) && error.errors.length > 0) {
        const fieldErrors = error.errors.map(e => `• ${e.field}: ${e.message}`).join('\n');
        errorMessage = `Please fix the following:\n${fieldErrors}`;
      }
      Alert.alert(
        'Submission Failed',
        errorMessage,
        [{ text: 'OK' }]
      );
    } finally {
      setSubmitting(false);
    }
  }, [validateStep, selectedPet, adoptionForm, resetAdoptionForm, onRefresh]);

  // Close adoption modal
  const handleCloseAdoptionModal = useCallback(() => {
    Alert.alert(
      'Discard Application?',
      'Are you sure you want to cancel? Your progress will be lost.',
      [
        { text: 'Keep Editing', style: 'cancel' },
        { 
          text: 'Discard', 
          style: 'destructive',
          onPress: () => {
            setAdoptionModalVisible(false);
            resetAdoptionForm();
          }
        },
      ]
    );
  }, [resetAdoptionForm]);

  const handleCloseModal = useCallback(() => {
    setViewModalVisible(false);
  }, []);

  // Memoized categories render
  const categoriesRender = useMemo(() => (
    <View style={styles.categoriesContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesScroll}
      >
        {CATEGORIES.map((category) => (
          <CategoryButton
            key={category.id}
            category={category}
            isActive={selectedCategory === category.id}
            onPress={setSelectedCategory}
          />
        ))}
      </ScrollView>
    </View>
  ), [selectedCategory, setSelectedCategory]);

  // Memoized pets list render
  const petsListRender = useMemo(() => {
    if (loading) {
      return <LoadingState message="Loading pets..." />;
    }
    
    if (filteredPets.length === 0) {
      return (
        <EmptyState
          icon="paw-off"
          iconSet="material"
          title="No pets found"
          subtitle={searchQuery || selectedCategory !== 'all'
            ? 'Try adjusting your filters'
            : 'Check back later for new pets'}
        />
      );
    }
    
    return (
      <View style={styles.petsGrid}>
        {filteredPets.map((pet) => (
          <PetCard
            key={pet.id}
            pet={pet}
            onView={handleViewPet}
            onAdopt={handleAdoptPet}
            onFavorite={handleFavoriteToggle}
            isFavorite={favorites.includes(pet.id)}
            favoriteLoading={favoriteLoading[pet.id]}
          />
        ))}
      </View>
    );
  }, [loading, filteredPets, searchQuery, selectedCategory, handleViewPet, handleAdoptPet, handleFavoriteToggle, favorites, favoriteLoading]);

  return (
    <View style={containerStyles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <ScreenHeader 
        title="Find Your Pet" 
        subtitle="Discover your perfect companion" 
      />

      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search by name or breed..."
      />

      {categoriesRender}

      {/* Pets List */}
      <ScrollView
        style={styles.petsContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {petsListRender}
        <BottomSpacing />
      </ScrollView>

      {/* Pet Detail Modal */}
      <Modal
        visible={viewModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedPet?.name}</Text>
              <TouchableOpacity 
                onPress={handleCloseModal}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={24} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {selectedPet && (
                <>
                  <Image 
                    source={{ uri: getImageUrl(selectedPet.image) || 'https://via.placeholder.com/300?text=No+Image' }} 
                    style={styles.modalPetImage} 
                  />

                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Basic Information</Text>
                    <View style={styles.detailRow}>
                      <View style={styles.detailItem}>
                        <Ionicons name="paw" size={16} color={COLORS.primary} />
                        <Text style={styles.detailLabel}>Species</Text>
                        <Text style={styles.detailValue}>{selectedPet.species || 'Unknown'}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Ionicons name="fitness" size={16} color={COLORS.primary} />
                        <Text style={styles.detailLabel}>Breed</Text>
                        <Text style={styles.detailValue}>{selectedPet.breed || 'Unknown'}</Text>
                      </View>
                    </View>
                    <View style={styles.detailRow}>
                      <View style={styles.detailItem}>
                        <Ionicons name="resize" size={16} color={COLORS.primary} />
                        <Text style={styles.detailLabel}>Size</Text>
                        <Text style={styles.detailValue}>{selectedPet.size || 'Unknown'}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Ionicons name="color-palette" size={16} color={COLORS.primary} />
                        <Text style={styles.detailLabel}>Color</Text>
                        <Text style={styles.detailValue}>{selectedPet.color || 'Unknown'}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Health Information</Text>
                    <View style={styles.detailRow}>
                      <View style={styles.detailItem}>
                        <Ionicons name="medical" size={16} color={COLORS.primary} />
                        <Text style={styles.detailLabel}>Vaccination</Text>
                        <Text style={styles.detailValue}>{selectedPet.vaccination_status?.replace(/_/g, ' ') || 'Unknown'}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Ionicons name="cut" size={16} color={COLORS.primary} />
                        <Text style={styles.detailLabel}>Neutered</Text>
                        <Text style={styles.detailValue}>{selectedPet.is_neutered ? 'Yes' : 'No'}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Behavior</Text>
                    <View style={styles.tagsRow}>
                      <View style={[styles.tag, selectedPet.is_house_trained && styles.tagActive]}>
                        <Ionicons name="home" size={14} color={selectedPet.is_house_trained ? '#FFF' : COLORS.textMedium} />
                        <Text style={[styles.tagText, selectedPet.is_house_trained && styles.tagTextActive]}>House Trained</Text>
                      </View>
                      <View style={[styles.tag, selectedPet.is_good_with_kids && styles.tagActive]}>
                        <Ionicons name="people" size={14} color={selectedPet.is_good_with_kids ? '#FFF' : COLORS.textMedium} />
                        <Text style={[styles.tagText, selectedPet.is_good_with_kids && styles.tagTextActive]}>Good with Kids</Text>
                      </View>
                      <View style={[styles.tag, selectedPet.is_good_with_other_pets && styles.tagActive]}>
                        <Ionicons name="paw" size={14} color={selectedPet.is_good_with_other_pets ? '#FFF' : COLORS.textMedium} />
                        <Text style={[styles.tagText, selectedPet.is_good_with_other_pets && styles.tagTextActive]}>Good with Pets</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Location & Pricing</Text>
                    <View style={styles.detailRow}>
                      <View style={styles.detailItemFull}>
                        <Ionicons name="location" size={16} color={COLORS.primary} />
                        <Text style={styles.detailLabel}>Location</Text>
                        <Text style={styles.detailValue}>{selectedPet.location || 'Not specified'}</Text>
                      </View>
                    </View>
                    <View style={styles.detailRow}>
                      <View style={styles.detailItem}>
                        <Ionicons name="cash" size={16} color={COLORS.primary} />
                        <Text style={styles.detailLabel}>Adoption Fee</Text>
                        <Text style={styles.detailValue}>₱{selectedPet.adoption_fee || '0'}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
                        <Text style={styles.detailLabel}>Status</Text>
                        <Text style={styles.detailValue}>{selectedPet.status || 'Available'}</Text>
                      </View>
                    </View>
                  </View>

                  {selectedPet.description && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Description</Text>
                      <Text style={styles.descriptionText}>{selectedPet.description}</Text>
                    </View>
                  )}

                  {selectedPet.special_needs && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Special Needs</Text>
                      <Text style={styles.descriptionText}>{selectedPet.special_needs}</Text>
                    </View>
                  )}

                  {/* Adopt Button in Modal */}
                  {selectedPet.status?.toLowerCase() === 'available' && (
                    <TouchableOpacity 
                      style={styles.modalAdoptBtn}
                      onPress={() => handleAdoptPet(selectedPet)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="heart" size={20} color={COLORS.textWhite} />
                      <Text style={styles.modalAdoptBtnText}>Adopt {selectedPet.name}</Text>
                    </TouchableOpacity>
                  )}

                  {selectedPet.status?.toLowerCase() !== 'available' && (
                    <View style={styles.unavailableBadge}>
                      <Ionicons name="time" size={18} color="#F59E0B" />
                      <Text style={styles.unavailableText}>
                        {selectedPet.status === 'pending' ? 'Adoption Pending' : 'Not Available'}
                      </Text>
                    </View>
                  )}

                  <View style={{ height: 30 }} />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Adoption Application Modal */}
      <Modal
        visible={adoptionModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseAdoptionModal}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.adoptionModalOverlay}
        >
          <View style={styles.adoptionModalContent}>
            {/* Header */}
            <View style={styles.adoptionModalHeader}>
              <View style={styles.adoptionHeaderInfo}>
                <Image
                  source={{ uri: getImageUrl(selectedPet?.image) || 'https://via.placeholder.com/50' }}
                  style={styles.adoptionPetThumb}
                />
                <View style={styles.adoptionHeaderText}>
                  <Text style={styles.adoptionModalTitle}>Adopt {selectedPet?.name}</Text>
                  <Text style={styles.adoptionModalSubtitle}>Step {adoptionStep} of 4</Text>
                </View>
              </View>
              <TouchableOpacity 
                onPress={handleCloseAdoptionModal}
                style={styles.adoptionCloseBtn}
              >
                <Ionicons name="close" size={24} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            {/* Progress Steps */}
            <View style={styles.stepsContainer}>
              {ADOPTION_STEPS.map((step, index) => (
                <View key={step.id} style={styles.stepWrapper}>
                  <View style={[
                    styles.stepCircle,
                    adoptionStep >= step.id && styles.stepCircleActive,
                    adoptionStep > step.id && styles.stepCircleCompleted,
                  ]}>
                    {adoptionStep > step.id ? (
                      <Ionicons name="checkmark" size={16} color="#FFF" />
                    ) : (
                      <Ionicons 
                        name={step.icon} 
                        size={16} 
                        color={adoptionStep >= step.id ? '#FFF' : COLORS.textLight} 
                      />
                    )}
                  </View>
                  {index < ADOPTION_STEPS.length - 1 && (
                    <View style={[
                      styles.stepLine,
                      adoptionStep > step.id && styles.stepLineActive,
                    ]} />
                  )}
                </View>
              ))}
            </View>

            {/* Form Content */}
            <ScrollView 
              style={styles.adoptionFormScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Step 1: Living Situation */}
              {adoptionStep === 1 && (
                <View style={styles.formStep}>
                  <Text style={styles.formStepTitle}>🏠 Tell us about your home</Text>
                  <Text style={styles.formStepDesc}>Help us understand your living situation</Text>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Living Situation *</Text>
                    <View style={styles.optionGrid}>
                      {['House', 'Apartment', 'Condo', 'Townhouse'].map(option => (
                        <OptionButton
                          key={option}
                          label={option}
                          selected={adoptionForm.living_situation === option.toLowerCase()}
                          onPress={() => updateFormField('living_situation', option.toLowerCase())}
                        />
                      ))}
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <View style={styles.switchRow}>
                      <View style={styles.switchInfo}>
                        <Ionicons name="leaf" size={20} color={COLORS.primary} />
                        <Text style={styles.switchLabel}>Do you have a yard?</Text>
                      </View>
                      <Switch
                        value={adoptionForm.has_yard}
                        onValueChange={(val) => updateFormField('has_yard', val)}
                        trackColor={{ false: '#E5E7EB', true: COLORS.primary + '60' }}
                        thumbColor={adoptionForm.has_yard ? COLORS.primary : '#F4F4F5'}
                      />
                    </View>
                  </View>

                  {adoptionForm.has_yard && (
                    <View style={styles.formGroup}>
                      <View style={styles.switchRow}>
                        <View style={styles.switchInfo}>
                          <Ionicons name="grid" size={20} color={COLORS.primary} />
                          <Text style={styles.switchLabel}>Is the yard fenced?</Text>
                        </View>
                        <Switch
                          value={adoptionForm.yard_fenced}
                          onValueChange={(val) => updateFormField('yard_fenced', val)}
                          trackColor={{ false: '#E5E7EB', true: COLORS.primary + '60' }}
                          thumbColor={adoptionForm.yard_fenced ? COLORS.primary : '#F4F4F5'}
                        />
                      </View>
                    </View>
                  )}

                  {adoptionForm.living_situation && adoptionForm.living_situation !== 'house' && (
                    <View style={styles.formGroup}>
                      <View style={styles.switchRow}>
                        <View style={styles.switchInfo}>
                          <Ionicons name="document-text" size={20} color={COLORS.primary} />
                          <Text style={styles.switchLabel}>Does your rental allow pets?</Text>
                        </View>
                        <Switch
                          value={adoptionForm.rental_allows_pets}
                          onValueChange={(val) => updateFormField('rental_allows_pets', val)}
                          trackColor={{ false: '#E5E7EB', true: COLORS.primary + '60' }}
                          thumbColor={adoptionForm.rental_allows_pets ? COLORS.primary : '#F4F4F5'}
                        />
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Step 2: Household Info */}
              {adoptionStep === 2 && (
                <View style={styles.formStep}>
                  <Text style={styles.formStepTitle}>👨‍👩‍👧‍👦 Household Information</Text>
                  <Text style={styles.formStepDesc}>Tell us about who lives with you</Text>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Number of household members *</Text>
                    <TextInput
                      style={styles.formInput}
                      value={adoptionForm.household_members}
                      onChangeText={(val) => updateFormField('household_members', val)}
                      placeholder="e.g., 4"
                      keyboardType="numeric"
                      placeholderTextColor={COLORS.textLight}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <View style={styles.switchRow}>
                      <View style={styles.switchInfo}>
                        <Ionicons name="happy" size={20} color={COLORS.primary} />
                        <Text style={styles.switchLabel}>Are there children in the home?</Text>
                      </View>
                      <Switch
                        value={adoptionForm.has_children}
                        onValueChange={(val) => updateFormField('has_children', val)}
                        trackColor={{ false: '#E5E7EB', true: COLORS.primary + '60' }}
                        thumbColor={adoptionForm.has_children ? COLORS.primary : '#F4F4F5'}
                      />
                    </View>
                  </View>

                  {adoptionForm.has_children && (
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>Ages of children</Text>
                      <TextInput
                        style={styles.formInput}
                        value={adoptionForm.children_ages}
                        onChangeText={(val) => updateFormField('children_ages', val)}
                        placeholder="e.g., 5, 8, 12"
                        placeholderTextColor={COLORS.textLight}
                      />
                    </View>
                  )}

                  <View style={styles.formGroup}>
                    <View style={styles.switchRow}>
                      <View style={styles.switchInfo}>
                        <Ionicons name="paw" size={20} color={COLORS.primary} />
                        <Text style={styles.switchLabel}>Do you have other pets?</Text>
                      </View>
                      <Switch
                        value={adoptionForm.has_other_pets}
                        onValueChange={(val) => updateFormField('has_other_pets', val)}
                        trackColor={{ false: '#E5E7EB', true: COLORS.primary + '60' }}
                        thumbColor={adoptionForm.has_other_pets ? COLORS.primary : '#F4F4F5'}
                      />
                    </View>
                  </View>

                  {adoptionForm.has_other_pets && (
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>Tell us about your other pets</Text>
                      <TextInput
                        style={[styles.formInput, styles.formTextArea]}
                        value={adoptionForm.other_pets_details}
                        onChangeText={(val) => updateFormField('other_pets_details', val)}
                        placeholder="Species, breed, age, temperament..."
                        placeholderTextColor={COLORS.textLight}
                        multiline
                        numberOfLines={3}
                      />
                    </View>
                  )}
                </View>
              )}

              {/* Step 3: Pet Experience */}
              {adoptionStep === 3 && (
                <View style={styles.formStep}>
                  <Text style={styles.formStepTitle}>🐾 Your Pet Experience</Text>
                  <Text style={styles.formStepDesc}>Share your experience with pets</Text>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Previous pet experience</Text>
                    <TextInput
                      style={[styles.formInput, styles.formTextArea]}
                      value={adoptionForm.previous_pet_experience}
                      onChangeText={(val) => updateFormField('previous_pet_experience', val)}
                      placeholder="Tell us about pets you've owned or cared for..."
                      placeholderTextColor={COLORS.textLight}
                      multiline
                      numberOfLines={4}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Your work schedule *</Text>
                    <TextInput
                      style={[styles.formInput, styles.formTextArea]}
                      value={adoptionForm.work_schedule}
                      onChangeText={(val) => updateFormField('work_schedule', val)}
                      placeholder="How many hours are you away from home daily?"
                      placeholderTextColor={COLORS.textLight}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </View>
              )}

              {/* Step 4: Final Details */}
              {adoptionStep === 4 && (
                <View style={styles.formStep}>
                  <Text style={styles.formStepTitle}>📝 Final Details</Text>
                  <Text style={styles.formStepDesc}>Almost there! Just a few more questions</Text>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Why do you want to adopt {selectedPet?.name}? *</Text>
                    <TextInput
                      style={[styles.formInput, styles.formTextArea]}
                      value={adoptionForm.reason_for_adoption}
                      onChangeText={(val) => updateFormField('reason_for_adoption', val)}
                      placeholder="Share your reasons for wanting to adopt..."
                      placeholderTextColor={COLORS.textLight}
                      multiline
                      numberOfLines={4}
                    />
                  </View>

                  <View style={styles.formSectionHeader}>
                    <Ionicons name="call" size={18} color={COLORS.primary} />
                    <Text style={styles.formSectionTitle}>Emergency Contact *</Text>
                  </View>

                  <View style={styles.formRow}>
                    <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                      <Text style={styles.formLabel}>Name</Text>
                      <TextInput
                        style={styles.formInput}
                        value={adoptionForm.emergency_contact_name}
                        onChangeText={(val) => updateFormField('emergency_contact_name', val)}
                        placeholder="Contact name"
                        placeholderTextColor={COLORS.textLight}
                      />
                    </View>
                    <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                      <Text style={styles.formLabel}>Phone</Text>
                      <TextInput
                        style={styles.formInput}
                        value={adoptionForm.emergency_contact_phone}
                        onChangeText={(val) => updateFormField('emergency_contact_phone', val)}
                        placeholder="Phone number"
                        keyboardType="phone-pad"
                        placeholderTextColor={COLORS.textLight}
                      />
                    </View>
                  </View>

                  <View style={styles.formSectionHeader}>
                    <Ionicons name="medical" size={18} color={COLORS.primary} />
                    <Text style={styles.formSectionTitle}>Veterinarian (Optional)</Text>
                  </View>

                  <View style={styles.formRow}>
                    <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                      <Text style={styles.formLabel}>Vet Name</Text>
                      <TextInput
                        style={styles.formInput}
                        value={adoptionForm.veterinarian_name}
                        onChangeText={(val) => updateFormField('veterinarian_name', val)}
                        placeholder="Vet clinic name"
                        placeholderTextColor={COLORS.textLight}
                      />
                    </View>
                    <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                      <Text style={styles.formLabel}>Vet Phone</Text>
                      <TextInput
                        style={styles.formInput}
                        value={adoptionForm.veterinarian_phone}
                        onChangeText={(val) => updateFormField('veterinarian_phone', val)}
                        placeholder="Phone number"
                        keyboardType="phone-pad"
                        placeholderTextColor={COLORS.textLight}
                      />
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Additional notes</Text>
                    <TextInput
                      style={[styles.formInput, styles.formTextArea]}
                      value={adoptionForm.additional_notes}
                      onChangeText={(val) => updateFormField('additional_notes', val)}
                      placeholder="Anything else you'd like us to know..."
                      placeholderTextColor={COLORS.textLight}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </View>
              )}

              <View style={{ height: 100 }} />
            </ScrollView>

            {/* Footer Buttons */}
            <View style={styles.adoptionFooter}>
              {adoptionStep > 1 && (
                <TouchableOpacity 
                  style={styles.prevButton}
                  onPress={handlePrevStep}
                  activeOpacity={0.8}
                >
                  <Ionicons name="arrow-back" size={20} color={COLORS.textDark} />
                  <Text style={styles.prevButtonText}>Back</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                style={[
                  styles.nextButton,
                  adoptionStep === 1 && { flex: 1 },
                  submitting && styles.buttonDisabled,
                ]}
                onPress={adoptionStep === 4 ? handleSubmitAdoption : handleNextStep}
                activeOpacity={0.8}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Text style={styles.nextButtonText}>
                      {adoptionStep === 4 ? 'Submit Application' : 'Continue'}
                    </Text>
                    {adoptionStep < 4 && (
                      <Ionicons name="arrow-forward" size={20} color="#FFF" />
                    )}
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  header: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  headerSubtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    marginTop: SPACING.xs,
  },
  searchContainer: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  searchInput: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark,
  },
  categoriesContainer: {
    marginBottom: SPACING.lg,
  },
  categoriesScroll: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.backgroundWhite,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginRight: SPACING.sm,
  },
  categoryBtnActive: {
    backgroundColor: COLORS.primary,
  },
  categoryLabel: {
    marginLeft: SPACING.xs,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.primary,
  },
  categoryLabelActive: {
    color: COLORS.textWhite,
  },
  petsContainer: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
  },
  petsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  petCard: {
    width: '48%',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  petImage: {
    width: '100%',
    height: 140,
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
    elevation: 2,
  },
  petInfo: {
    padding: SPACING.md,
  },
  petNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  petName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    flex: 1,
  },
  genderBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.xs,
  },
  petBreed: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: 2,
  },
  petFeeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  petFee: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
  },
  petDetails: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
    gap: SPACING.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxxl * 2,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxxl * 2,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginTop: SPACING.lg,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  bottomSpacing: {
    height: 100,
  },
  cardActions: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  viewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: 4,
  },
  viewBtnText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.primary,
  },
  adoptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    gap: 4,
  },
  adoptBtnText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textWhite,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.backgroundWhite,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
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
  modalBody: {
    paddingHorizontal: SPACING.xl,
  },
  modalPetImage: {
    width: '100%',
    height: 220,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.md,
    backgroundColor: COLORS.background,
  },
  detailSection: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
  },
  detailSectionTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
  },
  detailItemFull: {
    flex: 1,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
    marginTop: 4,
  },
  detailValue: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.backgroundWhite,
    borderWidth: 1,
    borderColor: COLORS.background,
    gap: 6,
  },
  tagActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tagText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textMedium,
  },
  tagTextActive: {
    color: COLORS.textWhite,
  },
  descriptionText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    lineHeight: 22,
  },
  modalAdoptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.xl,
    gap: SPACING.sm,
  },
  modalAdoptBtnText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },
  unavailableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFBEB',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.xl,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  unavailableText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: '#B45309',
  },
  // Adoption Modal Styles
  adoptionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  adoptionModalContent: {
    backgroundColor: COLORS.backgroundWhite,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '95%',
    minHeight: '80%',
  },
  adoptionModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  adoptionHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  adoptionPetThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.background,
  },
  adoptionHeaderText: {
    marginLeft: SPACING.md,
  },
  adoptionModalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  adoptionModalSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: 2,
  },
  adoptionCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    backgroundColor: COLORS.background,
  },
  stepWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: COLORS.primary,
  },
  stepCircleCompleted: {
    backgroundColor: '#10B981',
  },
  stepLine: {
    width: 40,
    height: 3,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: '#10B981',
  },
  adoptionFormScroll: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
  },
  formStep: {
    paddingTop: SPACING.lg,
  },
  formStepTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.xs,
  },
  formStepDesc: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    marginBottom: SPACING.xl,
  },
  formGroup: {
    marginBottom: SPACING.lg,
  },
  formLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
    marginBottom: SPACING.sm,
  },
  formInput: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  formTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: SPACING.md,
  },
  formRow: {
    flexDirection: 'row',
  },
  formSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  formSectionTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  optionBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  optionBtnText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textMedium,
  },
  optionBtnTextActive: {
    color: '#FFF',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  switchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  switchLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.medium,
    color: COLORS.textDark,
    flex: 1,
  },
  adoptionFooter: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.backgroundWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.background,
    gap: SPACING.md,
  },
  prevButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    gap: SPACING.xs,
  },
  prevButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    gap: SPACING.sm,
  },
  nextButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: '#FFF',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});

export default memo(UserPetsScreen);
