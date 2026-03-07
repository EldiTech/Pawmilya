import React, { useMemo, useCallback, memo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
  Linking,
  Modal,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { shelterService, petService } from '../../services';
import { useAuth } from '../../context/AuthContext';

// Import shared utilities
import {
  getShelterImage,
  getImageUrl,
  handleApiError,
  ScreenHeader,
  SearchBar,
  LoadingState,
  EmptyState,
  BottomSpacing,
  RefreshControl,
  useDataFetching,
  useSearch,
  containerStyles,
} from './shared';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Shelter type configuration
const SHELTER_TYPES = {
  government: { label: 'Government', icon: 'business', color: '#6366F1' },
  private: { label: 'Private', icon: 'home', color: '#EC4899' },
  ngo: { label: 'NGO', icon: 'people', color: '#14B8A6' },
  rescue_group: { label: 'Rescue Group', icon: 'heart', color: '#F97316' },
};

// Services configuration
const SERVICES_CONFIG = {
  adoption: { label: 'Adoption', icon: 'heart' },
  rescue: { label: 'Rescue', icon: 'medkit' },
  foster_care: { label: 'Foster Care', icon: 'home' },
  veterinary_care: { label: 'Vet Care', icon: 'medical' },
  spay_neuter: { label: 'Spay/Neuter', icon: 'cut' },
  vaccination: { label: 'Vaccination', icon: 'fitness' },
  rehabilitation: { label: 'Rehab', icon: 'pulse' },
};

// Animal types configuration
const ANIMAL_TYPES = {
  dogs: { label: 'Dogs', emoji: '🐕' },
  cats: { label: 'Cats', emoji: '🐈' },
  birds: { label: 'Birds', emoji: '🐦' },
  rabbits: { label: 'Rabbits', emoji: '🐰' },
  others: { label: 'Others', emoji: '🐾' },
};

// Helper function to get the best available image (with proper URL normalization)
const getShelterDisplayImage = (shelter, type = 'cover') => {
  if (!shelter) return null;
  
  let imageUrl = null;
  
  if (type === 'logo') {
    // Priority for logo - prefer pre-processed displayLogoImage first
    imageUrl = shelter.displayLogoImage || 
               shelter.logo_image || 
               shelter.logo_image_data || 
               shelter.logo_url || null;
  } else {
    // Priority for cover/main image - prefer pre-processed displayCoverImage first
    imageUrl = shelter.displayCoverImage ||
               shelter.cover_image || 
               shelter.cover_image_data ||
               shelter.cover_image_url || 
               shelter.displayLogoImage ||
               shelter.logo_image || 
               shelter.logo_image_data ||
               shelter.logo_url || null;
  }
  
  // Normalize the URL (handles base64, full URLs, and relative paths)
  return imageUrl ? getImageUrl(imageUrl) : null;
};

// Verification status configuration
const VERIFICATION_STATUS = {
  verified: { label: 'Verified', color: '#22C55E', icon: 'checkmark-circle' },
  pending: { label: 'Pending', color: '#F59E0B', icon: 'time' },
  rejected: { label: 'Rejected', color: '#EF4444', icon: 'close-circle' },
};

// Simple shelter card with logo and view button
const ShelterCard = memo(({ shelter, onView }) => {
  const logoImage = getShelterDisplayImage(shelter, 'logo') || getShelterDisplayImage(shelter, 'cover');
  const shelterTypeConfig = SHELTER_TYPES[shelter.shelter_type] || SHELTER_TYPES.private;
  const isVerified = shelter.verification_status === 'verified' || shelter.is_verified === true;
  const verificationStatus = isVerified ? 'verified' : (shelter.verification_status || 'pending');
  const verificationConfig = VERIFICATION_STATUS[verificationStatus] || VERIFICATION_STATUS.pending;
  
  return (
    <View style={styles.shelterCard}>
      {/* Top Row: Logo + Name + Actions */}
      <View style={styles.cardTopRow}>
        {/* Logo */}
        <View style={styles.logoWrapper}>
          {logoImage ? (
            <Image source={{ uri: logoImage }} style={styles.logoImage} />
          ) : (
            <View style={[styles.logoImage, styles.logoPlaceholder]}>
              <MaterialCommunityIcons name="home-heart" size={28} color={COLORS.primary} />
            </View>
          )}
        </View>
        
        {/* Name & Location */}
        <View style={styles.cardInfo}>
          <Text style={styles.shelterName} numberOfLines={1}>{shelter.name}</Text>
          {shelter.city && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color={COLORS.textMedium} />
              <Text style={styles.locationText} numberOfLines={1}>{shelter.city}</Text>
            </View>
          )}
        </View>
        
        {/* Action Button */}
        <TouchableOpacity style={styles.viewButton} onPress={() => onView(shelter)}>
          <Ionicons name="eye-outline" size={16} color="#FFF" />
        </TouchableOpacity>
      </View>
      
      {/* Bottom Row: Badges */}
      <View style={styles.cardBadgesRow}>
        <View style={[styles.typeBadge, { backgroundColor: shelterTypeConfig.color + '15' }]}>
          <Ionicons name={shelterTypeConfig.icon} size={12} color={shelterTypeConfig.color} />
          <Text style={[styles.typeText, { color: shelterTypeConfig.color }]}>{shelterTypeConfig.label}</Text>
        </View>
        <View style={[styles.typeBadge, { backgroundColor: verificationConfig.color + '15' }]}>
          <Ionicons name={verificationConfig.icon} size={12} color={verificationConfig.color} />
          <Text style={[styles.typeText, { color: verificationConfig.color }]}>{verificationConfig.label}</Text>
        </View>
      </View>
    </View>
  );
});

ShelterCard.displayName = 'ShelterCard';

// Helper function to parse PostgreSQL arrays that may come in various formats
const parseArrayField = (field) => {
  if (!field) return [];
  
  // Already an array
  if (Array.isArray(field)) {
    return field.filter(item => item); // Filter out null/empty items
  }
  
  // PostgreSQL array format: {item1,item2,item3}
  if (typeof field === 'string') {
    // Handle PostgreSQL array format
    if (field.startsWith('{') && field.endsWith('}')) {
      const content = field.slice(1, -1);
      if (!content) return [];
      return content.split(',').map(item => item.trim().replace(/"/g, '')).filter(item => item);
    }
    
    // Try JSON parse
    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // Not JSON, might be comma-separated
      if (field.includes(',')) {
        return field.split(',').map(item => item.trim()).filter(item => item);
      }
    }
    
    // Single value
    if (field.trim()) return [field.trim()];
  }
  
  return [];
};

// Detail Modal Component
const ShelterDetailModal = ({ visible, shelter, onClose, onCall, onEmail, onDirections, onViewPets, isLoading }) => {
  if (!shelter) return null;
  
  const coverImage = getShelterDisplayImage(shelter, 'cover');
  const logoImage = getShelterDisplayImage(shelter, 'logo');
  const shelterTypeConfig = SHELTER_TYPES[shelter.shelter_type] || SHELTER_TYPES.private;
  const isVerified = shelter.verification_status === 'verified' || shelter.is_verified === true;
  const verificationStatus = isVerified ? 'verified' : (shelter.verification_status || 'pending');
  const verificationConfig = VERIFICATION_STATUS[verificationStatus] || VERIFICATION_STATUS.pending;
  
  // Parse arrays using the helper function
  const animalsAccepted = parseArrayField(shelter.animals_accepted);
  const servicesOffered = parseArrayField(shelter.services_offered);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header with Cover */}
          <View style={styles.modalHeader}>
            {coverImage ? (
              <Image source={{ uri: coverImage }} style={styles.modalCover} resizeMode="cover" />
            ) : (
              <View style={[styles.modalCover, styles.modalCoverPlaceholder]}>
                <MaterialCommunityIcons name="home-heart" size={50} color={COLORS.textLight} />
              </View>
            )}
            <View style={styles.modalCoverOverlay} />
            
            {/* Close Button */}
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={22} color="#FFF" />
            </TouchableOpacity>
            
            {/* Header Content */}
            <View style={styles.modalHeaderContent}>
              {/* Logo */}
              <View style={styles.modalLogoWrapper}>
                {logoImage ? (
                  <Image source={{ uri: logoImage }} style={styles.modalLogo} />
                ) : (
                  <View style={[styles.modalLogo, styles.modalLogoPlaceholder]}>
                    <MaterialCommunityIcons name="home-heart" size={28} color={COLORS.primary} />
                  </View>
                )}
                <View style={[styles.modalVerifiedBadge, { backgroundColor: verificationConfig.color }]}>
                  <Ionicons name={verificationConfig.icon} size={12} color="#FFF" />
                </View>
              </View>
              
              {/* Title & Type */}
              <View style={styles.modalTitleWrap}>
                <Text style={styles.modalTitle} numberOfLines={2}>{shelter.name}</Text>
                <View style={styles.modalBadgesRow}>
                  <View style={[styles.modalTypeBadge, { backgroundColor: shelterTypeConfig.color }]}>
                    <Ionicons name={shelterTypeConfig.icon} size={12} color="#FFF" />
                    <Text style={styles.modalTypeText}>{shelterTypeConfig.label}</Text>
                  </View>
                  <View style={[styles.modalTypeBadge, { backgroundColor: verificationConfig.color }]}>
                    <Ionicons name={verificationConfig.icon} size={12} color="#FFF" />
                    <Text style={styles.modalTypeText}>{verificationConfig.label}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
          
          {/* Content */}
          <ScrollView 
            style={styles.modalBody} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalBodyContent}
          >
            {/* Loading indicator */}
            {isLoading && (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading details...</Text>
              </View>
            )}
            
            {/* Quick Stats - Always show */}
            <View style={styles.quickStats}>
              <View style={styles.quickStatItem}>
                <View style={[styles.quickStatIcon, { backgroundColor: COLORS.primary + '15' }]}>
                  <Ionicons name="paw" size={20} color={COLORS.primary} />
                </View>
                <Text style={styles.quickStatValue}>{shelter.current_count ?? 0}</Text>
                <Text style={styles.quickStatLabel}>Current Animals</Text>
              </View>
              <View style={styles.quickStatDivider} />
              <View style={styles.quickStatItem}>
                <View style={[styles.quickStatIcon, { backgroundColor: '#22C55E15' }]}>
                  <Ionicons name="resize" size={20} color="#22C55E" />
                </View>
                <Text style={styles.quickStatValue}>{shelter.shelter_capacity ?? 0}</Text>
                <Text style={styles.quickStatLabel}>Max Capacity</Text>
              </View>
              <View style={styles.quickStatDivider} />
              <View style={styles.quickStatItem}>
                <View style={[styles.quickStatIcon, { backgroundColor: '#F59E0B15' }]}>
                  <Ionicons name="layers" size={20} color="#F59E0B" />
                </View>
                <Text style={styles.quickStatValue}>{servicesOffered.length}</Text>
                <Text style={styles.quickStatLabel}>Services</Text>
              </View>
            </View>
            
            {/* Description */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconWrapper}>
                  <Ionicons name="information-circle" size={16} color={COLORS.primary} />
                </View>
                <Text style={styles.sectionTitle}>About This Shelter</Text>
              </View>
              <View style={styles.sectionCard}>
                <Text style={styles.descriptionText}>
                  {shelter.description || 'No description available for this shelter.'}
                </Text>
              </View>
            </View>
            
            {/* Animals Accepted - Always show */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconWrapper}>
                  <Ionicons name="paw" size={16} color={COLORS.primary} />
                </View>
                <Text style={styles.sectionTitle}>Animals Accepted</Text>
              </View>
              <View style={styles.sectionCard}>
                {animalsAccepted.length > 0 ? (
                  <View style={styles.chipsRow}>
                    {animalsAccepted.map((animal, index) => (
                      <View key={`${animal}-${index}`} style={styles.animalChip}>
                        <Text style={styles.animalEmoji}>{ANIMAL_TYPES[animal]?.emoji || '🐾'}</Text>
                        <Text style={styles.animalLabel}>{ANIMAL_TYPES[animal]?.label || animal}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.noDataRow}>
                    <Ionicons name="paw-outline" size={20} color={COLORS.textLight} />
                    <Text style={styles.noDataText}>No animals specified</Text>
                  </View>
                )}
              </View>
            </View>
            
            {/* Contact Information - Always show */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconWrapper}>
                  <Ionicons name="call" size={16} color={COLORS.primary} />
                </View>
                <Text style={styles.sectionTitle}>Contact Information</Text>
              </View>
              <View style={styles.sectionCard}>
                {/* Contact Person */}
                <View style={styles.contactRow}>
                  <View style={[styles.contactIcon, { backgroundColor: '#6366F115' }]}>
                    <Ionicons name="person" size={16} color="#6366F1" />
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactLabel}>Contact Person</Text>
                    <Text style={styles.contactValue}>
                      {shelter.contact_person_name || 'Not specified'}
                    </Text>
                  </View>
                </View>
                
                {/* Phone */}
                <TouchableOpacity 
                  style={styles.contactRow} 
                  onPress={() => shelter.phone && onCall(shelter.phone)}
                  disabled={!shelter.phone}
                >
                  <View style={[styles.contactIcon, { backgroundColor: '#22C55E15' }]}>
                    <Ionicons name="call" size={16} color="#22C55E" />
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactLabel}>Phone</Text>
                    <Text style={[styles.contactValue, shelter.phone && styles.contactLink]}>
                      {shelter.phone || 'Not specified'}
                    </Text>
                  </View>
                  {shelter.phone && <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />}
                </TouchableOpacity>
                
                {/* Email */}
                <TouchableOpacity 
                  style={styles.contactRow} 
                  onPress={() => shelter.email && onEmail(shelter.email)}
                  disabled={!shelter.email}
                >
                  <View style={[styles.contactIcon, { backgroundColor: COLORS.primary + '15' }]}>
                    <Ionicons name="mail" size={16} color={COLORS.primary} />
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactLabel}>Email</Text>
                    <Text style={[styles.contactValue, shelter.email && styles.contactLink]} numberOfLines={1}>
                      {shelter.email || 'Not specified'}
                    </Text>
                  </View>
                  {shelter.email && <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />}
                </TouchableOpacity>
                
                {/* Address */}
                <TouchableOpacity 
                  style={styles.contactRow} 
                  onPress={() => shelter.address && onDirections(`${shelter.address} ${shelter.city || ''}`)}
                  disabled={!shelter.address}
                >
                  <View style={[styles.contactIcon, { backgroundColor: '#F59E0B15' }]}>
                    <Ionicons name="location" size={16} color="#F59E0B" />
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactLabel}>Address</Text>
                    <Text style={[styles.contactValue, shelter.address && styles.contactLink]} numberOfLines={2}>
                      {shelter.address ? `${shelter.address}${shelter.city ? `, ${shelter.city}` : ''}` : 'Not specified'}
                    </Text>
                  </View>
                  {shelter.address && <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />}
                </TouchableOpacity>
                
                {/* Operating Hours */}
                <View style={[styles.contactRow, { borderBottomWidth: 0 }]}>
                  <View style={[styles.contactIcon, { backgroundColor: '#8B5CF615' }]}>
                    <Ionicons name="time" size={16} color="#8B5CF6" />
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactLabel}>Operating Hours</Text>
                    <Text style={styles.contactValue}>
                      {shelter.operating_hours || 'Not specified'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            
            {/* Services Offered - Always show */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconWrapper}>
                  <Ionicons name="medical" size={16} color={COLORS.primary} />
                </View>
                <Text style={styles.sectionTitle}>Services Offered</Text>
              </View>
              <View style={styles.sectionCard}>
                {servicesOffered.length > 0 ? (
                  <View style={styles.chipsRow}>
                    {servicesOffered.map((service, index) => (
                      <View key={`${service}-${index}`} style={styles.serviceChip}>
                        <Ionicons 
                          name={SERVICES_CONFIG[service]?.icon || 'ellipse'} 
                          size={14} 
                          color="#22C55E" 
                        />
                        <Text style={styles.serviceLabel}>
                          {SERVICES_CONFIG[service]?.label || service}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.noDataRow}>
                    <Ionicons name="medical-outline" size={20} color={COLORS.textLight} />
                    <Text style={styles.noDataText}>No services specified</Text>
                  </View>
                )}
              </View>
            </View>
            
            <View style={{ height: 20 }} />
          </ScrollView>
          
          {/* Action Buttons */}
          <View style={styles.modalFooter}>
            {/* View Pets Button - Always show */}
            <TouchableOpacity 
              style={[styles.actionButton, styles.viewPetsButton]} 
              onPress={() => onViewPets && onViewPets(shelter)}
            >
              <Ionicons name="paw" size={20} color="#FFF" />
              <Text style={styles.actionButtonText}>View Pets</Text>
            </TouchableOpacity>
            {shelter.phone && (
              <TouchableOpacity style={[styles.actionButton, styles.callButton]} onPress={() => onCall(shelter.phone)}>
                <Ionicons name="call" size={20} color="#FFF" />
                <Text style={styles.actionButtonText}>Call</Text>
              </TouchableOpacity>
            )}
            {shelter.email && (
              <TouchableOpacity style={[styles.actionButton, styles.emailButton]} onPress={() => onEmail(shelter.email)}>
                <Ionicons name="mail" size={20} color="#FFF" />
                <Text style={styles.actionButtonText}>Email</Text>
              </TouchableOpacity>
            )}
            {shelter.address && (
              <TouchableOpacity style={[styles.actionButton, styles.directionsButton]} onPress={() => onDirections(`${shelter.address} ${shelter.city || ''}`)}>
                <Ionicons name="navigate" size={20} color="#FFF" />
                <Text style={styles.actionButtonText}>Directions</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const UserShelterScreen = () => {
  const { user } = useAuth();
  const [selectedShelter, setSelectedShelter] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Shelter pets modal state
  const [shelterPets, setShelterPets] = useState([]);
  const [petsModalVisible, setPetsModalVisible] = useState(false);
  const [loadingPets, setLoadingPets] = useState(false);

  // Use custom hooks for data fetching and search
  const { data: shelters, loading, refreshing, onRefresh } = useDataFetching(
    useCallback(() => shelterService.getShelters(), [])
  );

  // Search filter function
  const searchFilter = useCallback((shelter, query) => 
    shelter.name?.toLowerCase().includes(query) ||
    shelter.address?.toLowerCase().includes(query) ||
    shelter.city?.toLowerCase().includes(query),
  []);

  const { filteredItems: filteredShelters, searchQuery, setSearchQuery } = useSearch(
    shelters,
    searchFilter
  );

  // Handlers
  const handleView = useCallback(async (shelter) => {
    // Show modal immediately with basic info
    setSelectedShelter(shelter);
    setModalVisible(true);
    
    // Fetch full details
    try {
      setLoadingDetails(true);
      const fullDetails = await shelterService.getShelterById(shelter.id);
      if (fullDetails) {
        // Merge with original shelter data to ensure we have all fields
        setSelectedShelter({ ...shelter, ...fullDetails });
      }
    } catch (error) {
      // Keep using the original shelter data from the list
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setSelectedShelter(null);
  }, []);

  // View shelter pets
  const handleViewShelterPets = useCallback(async (shelter) => {
    setLoadingPets(true);
    setPetsModalVisible(true);
    
    try {
      const response = await shelterService.getShelterPets(shelter.id);
      if (response.success && Array.isArray(response.data)) {
        setShelterPets(response.data);
      } else if (Array.isArray(response.data)) {
        setShelterPets(response.data);
      } else if (Array.isArray(response)) {
        setShelterPets(response);
      } else {
        setShelterPets([]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load shelter pets');
      setShelterPets([]);
    } finally {
      setLoadingPets(false);
    }
  }, []);

  const handleClosePetsModal = useCallback(() => {
    setPetsModalVisible(false);
    setShelterPets([]);
  }, []);

  const handleCall = useCallback((phone) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  }, []);

  const handleEmail = useCallback((email) => {
    if (email) Linking.openURL(`mailto:${email}`);
  }, []);

  const handleDirections = useCallback((address) => {
    if (address) {
      const encodedAddress = encodeURIComponent(address);
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`);
    }
  }, []);

  // Render content based on loading state
  const renderContent = useMemo(() => {
    if (loading) {
      return <LoadingState message="Loading shelters..." />;
    }

    if (filteredShelters.length === 0) {
      return (
        <EmptyState
          icon="home-heart"
          iconSet="material"
          title="No Shelters Found"
          subtitle={searchQuery ? 'Try a different search term' : 'No shelters available at the moment'}
        />
      );
    }

    return (
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.sheltersList}>
          {filteredShelters.map((shelter) => (
            <ShelterCard
              key={shelter.id}
              shelter={shelter}
              onView={handleView}
            />
          ))}
        </View>
        <BottomSpacing />
      </ScrollView>
    );
  }, [loading, filteredShelters, refreshing, onRefresh, searchQuery, handleView]);

  return (
    <View style={containerStyles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      <ScreenHeader title="Shelters" subtitle="Find animal shelters near you" />
      
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search shelters..."
      />

      {renderContent}
      
      <ShelterDetailModal
        visible={modalVisible}
        shelter={selectedShelter}
        onClose={handleCloseModal}
        onCall={handleCall}
        onEmail={handleEmail}
        onDirections={handleDirections}
        onViewPets={handleViewShelterPets}
        isLoading={loadingDetails}
      />
      
      {/* Shelter Pets Modal */}
      <Modal
        visible={petsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleClosePetsModal}
      >
        <View style={styles.petsModalOverlay}>
          <View style={styles.petsModalContent}>
            <View style={styles.petsModalHeader}>
              <View>
                <Text style={styles.petsModalTitle}>
                  {selectedShelter?.name || 'Shelter'} Pets
                </Text>
                <Text style={styles.petsModalSubtitle}>
                  {shelterPets.length} pet{shelterPets.length !== 1 ? 's' : ''} available
                </Text>
              </View>
              <TouchableOpacity onPress={handleClosePetsModal} style={styles.petsModalCloseBtn}>
                <Ionicons name="close" size={24} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>
            
            {loadingPets ? (
              <View style={styles.petsLoadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.petsLoadingText}>Loading pets...</Text>
              </View>
            ) : shelterPets.length > 0 ? (
              <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.petsListContainer}
              >
                {shelterPets.map((pet) => (
                  <View key={pet.id} style={styles.petCard}>
                    <Image 
                      source={{ uri: getImageUrl(pet.image) || 'https://via.placeholder.com/80?text=Pet' }} 
                      style={styles.petCardImage} 
                    />
                    <View style={styles.petCardInfo}>
                      <Text style={styles.petCardName}>{pet.name}</Text>
                      <Text style={styles.petCardBreed}>{pet.breed || 'Unknown breed'}</Text>
                      <View style={styles.petCardMeta}>
                        <View style={styles.petCardMetaItem}>
                          <Ionicons name="paw" size={12} color={COLORS.primary} />
                          <Text style={styles.petCardMetaText}>{pet.species || 'Unknown'}</Text>
                        </View>
                        <View style={styles.petCardMetaItem}>
                          <Ionicons name="calendar" size={12} color={COLORS.primary} />
                          <Text style={styles.petCardMetaText}>{pet.age || 'Unknown age'}</Text>
                        </View>
                      </View>
                      {pet.adoption_fee && (
                        <Text style={styles.petCardFee}>₱{pet.adoption_fee}</Text>
                      )}
                    </View>
                    <View style={styles.petCardStatus}>
                      <View style={[
                        styles.petStatusBadge, 
                        { backgroundColor: pet.status === 'available' ? '#D1FAE5' : '#FEF3C7' }
                      ]}>
                        <Text style={[
                          styles.petStatusText,
                          { color: pet.status === 'available' ? '#059669' : '#D97706' }
                        ]}>
                          {pet.status || 'Available'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.petsEmptyContainer}>
                <MaterialCommunityIcons name="paw-off" size={64} color={COLORS.textLight} />
                <Text style={styles.petsEmptyTitle}>No Pets Available</Text>
                <Text style={styles.petsEmptyText}>
                  This shelter doesn't have any pets listed at the moment.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  sheltersList: {
    paddingHorizontal: SPACING.lg,
  },
  // Card Styles
  shelterCard: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  logoWrapper: {
    marginRight: SPACING.md,
  },
  logoImage: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.backgroundLight,
  },
  logoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '12',
  },
  cardInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  shelterName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    color: COLORS.textMedium,
  },
  cardBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.backgroundLight,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 5,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  viewButton: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '94%',
    overflow: 'hidden',
  },
  modalHeader: {
    height: 200,
    position: 'relative',
  },
  modalCover: {
    width: '100%',
    height: '100%',
  },
  modalCoverPlaceholder: {
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: SPACING.lg,
  },
  modalLogoWrapper: {
    position: 'relative',
  },
  modalLogo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#FFF',
    backgroundColor: COLORS.backgroundWhite,
  },
  modalLogoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
  },
  modalVerifiedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  modalTitleWrap: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 6,
  },
  modalBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modalTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  modalTypeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    alignItems: 'center',
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  quickStatDivider: {
    width: 1,
    height: 50,
    backgroundColor: COLORS.backgroundLight,
    marginHorizontal: SPACING.sm,
  },
  quickStatIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textDark,
    letterSpacing: -0.5,
  },
  quickStatLabel: {
    fontSize: 11,
    color: COLORS.textMedium,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  sectionIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textDark,
    letterSpacing: -0.3,
  },
  sectionCard: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: COLORS.textMedium,
    lineHeight: 24,
    letterSpacing: 0.1,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: SPACING.xs,
  },
  animalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '08',
    borderWidth: 1,
    borderColor: COLORS.primary + '20',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  animalEmoji: {
    fontSize: 18,
  },
  animalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.backgroundLight,
  },
  contactIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  contactInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  contactLabel: {
    fontSize: 11,
    color: COLORS.textMedium,
    marginBottom: 3,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contactValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textDark,
    lineHeight: 20,
  },
  contactLink: {
    color: COLORS.primary,
  },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C55E10',
    borderWidth: 1,
    borderColor: '#22C55E30',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  serviceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16A34A',
  },
  modalFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? SPACING.xl : SPACING.lg,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.backgroundLight,
    backgroundColor: COLORS.backgroundWhite,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    minWidth: '45%',
    flexGrow: 1,
  },
  callButton: {
    backgroundColor: '#22C55E',
  },
  emailButton: {
    backgroundColor: COLORS.primary,
  },
  directionsButton: {
    backgroundColor: '#3B82F6',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.2,
  },
  loadingContainer: {
    backgroundColor: COLORS.primary + '08',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
  noDetailsContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  noDetailsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textDark,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  noDetailsText: {
    fontSize: 14,
    color: COLORS.textMedium,
    textAlign: 'center',
  },
  noDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: 10,
  },
  noDataCard: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  noDataText: {
    fontSize: 14,
    color: COLORS.textLight,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  
  // View Pets Button Style
  viewPetsButton: {
    backgroundColor: COLORS.primary,
  },
  
  // Pets Modal Styles
  petsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  petsModalContent: {
    backgroundColor: COLORS.backgroundWhite,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    maxHeight: '85%',
    minHeight: '50%',
  },
  petsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  petsModalTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  petsModalSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: 2,
  },
  petsModalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  petsListContainer: {
    padding: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  petCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  petCardImage: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.backgroundLight,
  },
  petCardInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    justifyContent: 'center',
  },
  petCardName: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  petCardBreed: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: 2,
  },
  petCardMeta: {
    flexDirection: 'row',
    marginTop: SPACING.xs,
    gap: SPACING.md,
  },
  petCardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  petCardMetaText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
  },
  petCardFee: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
    marginTop: SPACING.xs,
  },
  petCardStatus: {
    justifyContent: 'center',
  },
  petStatusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  petStatusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    textTransform: 'capitalize',
  },
  petsLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  petsLoadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
  },
  petsEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
    paddingHorizontal: SPACING.xl,
  },
  petsEmptyTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginTop: SPACING.lg,
  },
  petsEmptyText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
});

export default memo(UserShelterScreen);
