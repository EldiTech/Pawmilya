import React, { useState, useCallback, useEffect, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import CONFIG from '../../config/config';
import { ADMIN_COLORS } from './shared';

// Fixed categories - Dog and Cat only
const PET_CATEGORIES = [
  { id: 1, name: 'Dog', icon: 'paw' },
  { id: 2, name: 'Cat', icon: 'paw' },
];

const GENDER_OPTIONS = [
  { key: 'Male', label: 'Male', icon: 'male' },
  { key: 'Female', label: 'Female', icon: 'female' },
];

const SIZE_OPTIONS = [
  { key: 'small', label: 'Small' },
  { key: 'medium', label: 'Medium' },
  { key: 'large', label: 'Large' },
  { key: 'extra-large', label: 'Extra Large' },
];

const VACCINATION_OPTIONS = [
  { key: 'fully_vaccinated', label: 'Fully Vaccinated' },
  { key: 'partially_vaccinated', label: 'Partially Vaccinated' },
  { key: 'not_vaccinated', label: 'Not Vaccinated' },
];

const AdminAddPetScreen = ({ onGoBack, adminToken }) => {
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [categories] = useState(PET_CATEGORIES);
  
  // Location search state
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [locationResults, setLocationResults] = useState([]);
  const [searchingLocation, setSearchingLocation] = useState(false);
  
  // Form state - matches database schema exactly
  const [formData, setFormData] = useState({
    name: '',
    category_id: 1, // Default to Dog
    breed_name: '',
    age_years: '',
    age_months: '',
    gender: 'Male',
    size: 'medium',
    weight_kg: '',
    color: '',
    description: '',
    medical_history: '',
    vaccination_status: 'not_vaccinated',
    is_neutered: false,
    is_house_trained: false,
    is_good_with_kids: false,
    is_good_with_other_pets: false,
    special_needs: '',
    location: '',
    latitude: null,
    longitude: null,
    adoption_fee: '',
    is_featured: false,
  });

  // Search location using OpenStreetMap Nominatim API
  const searchLocation = async (query) => {
    if (!query || query.length < 3) {
      setLocationResults([]);
      return;
    }

    setSearchingLocation(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ph&limit=10`,
        {
          headers: {
            'User-Agent': 'PawmilyaApp/1.0',
          },
        }
      );
      const data = await response.json();
      setLocationResults(data);
    } catch (error) {
      console.error('Location search error:', error);
      setLocationResults([]);
    } finally {
      setSearchingLocation(false);
    }
  };

  // Debounced location search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (locationSearch) {
        searchLocation(locationSearch);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [locationSearch]);

  const selectLocation = (item) => {
    setFormData(prev => ({
      ...prev,
      location: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
    }));
    setLocationModalVisible(false);
    setLocationSearch('');
    setLocationResults([]);
  };

  const updateField = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library to add pet images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true, // Request base64 directly from picker
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        // Store both uri for preview and base64 for upload
        if (asset.base64) {
          const mimeType = asset.mimeType || 'image/jpeg';
          const base64Uri = `data:${mimeType};base64,${asset.base64}`;
          setImages(prev => [...prev, base64Uri]);
        } else {
          // Fallback to uri if base64 not available
          setImages(prev => [...prev, asset.uri]);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Please enter the pet name');
      return false;
    }
    if (!formData.breed_name.trim()) {
      Alert.alert('Validation Error', 'Please enter the breed');
      return false;
    }
    if (!formData.description.trim()) {
      Alert.alert('Validation Error', 'Please enter a description');
      return false;
    }
    if (!formData.location.trim()) {
      Alert.alert('Validation Error', 'Please enter the location');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Process images - they may already be base64 from picker or need conversion
      let uploadedImageUrls = [];
      if (images.length > 0) {
        try {
          console.log('Processing', images.length, 'images...');
          const base64Images = [];
          
          for (const uri of images) {
            try {
              // Check if already base64
              if (uri.startsWith('data:image')) {
                console.log('Image already base64, length:', uri.length);
                base64Images.push(uri);
              } else {
                // Need to convert file URI to base64
                console.log('Converting image from URI:', uri.substring(0, 50) + '...');
                const base64 = await FileSystem.readAsStringAsync(uri, {
                  encoding: FileSystem.EncodingType.Base64,
                });
                const extension = uri.split('.').pop()?.toLowerCase() || 'jpeg';
                const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
                const dataUrl = `data:${mimeType};base64,${base64}`;
                console.log('Image converted, length:', dataUrl.length);
                base64Images.push(dataUrl);
              }
            } catch (imgError) {
              console.error('Error processing image:', imgError);
            }
          }

          if (base64Images.length > 0) {
            console.log('Sending', base64Images.length, 'images to server...');
            // Send images directly with pet data instead of separate upload
            uploadedImageUrls = base64Images;
            console.log('Images ready for upload:', uploadedImageUrls.length);
          }
        } catch (uploadError) {
          console.error('Image processing failed:', uploadError);
        }
      }

      // Build pet data matching the database schema exactly
      const petData = {
        name: formData.name.trim(),
        category_id: formData.category_id, // Use the selected category ID from database
        breed_id: null, // Optional - can be null
        breed_name: formData.breed_name.trim(),
        age_years: parseInt(formData.age_years) || 0,
        age_months: parseInt(formData.age_months) || 0,
        gender: formData.gender,
        size: formData.size,
        weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : null,
        color: formData.color.trim() || null,
        description: formData.description.trim(),
        medical_history: formData.medical_history.trim() || null,
        vaccination_status: formData.vaccination_status,
        is_neutered: formData.is_neutered,
        is_house_trained: formData.is_house_trained,
        is_good_with_kids: formData.is_good_with_kids,
        is_good_with_other_pets: formData.is_good_with_other_pets,
        temperament: [], // Array of temperament traits
        special_needs: formData.special_needs.trim() || null,
        status: 'available',
        is_featured: formData.is_featured,
        shelter_id: null, // Optional - can be null
        location: formData.location.trim(),
        latitude: formData.latitude,
        longitude: formData.longitude,
        adoption_fee: formData.adoption_fee ? parseFloat(formData.adoption_fee) : 0,
        images: uploadedImageUrls.length > 0 ? uploadedImageUrls : null,
      };

      const response = await fetch(`${CONFIG.API_URL}/admin/pets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify(petData),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          'Success',
          `${formData.name} has been added successfully!`,
          [{ text: 'OK', onPress: onGoBack }]
        );
      } else {
        Alert.alert('Error', data.error || 'Failed to add pet');
      }
    } catch (error) {
      console.error('Error adding pet:', error);
      Alert.alert('Error', 'Failed to add pet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderSectionHeader = (title, icon) => (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={20} color={ADMIN_COLORS.primary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  const renderInput = (label, field, placeholder, options = {}) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, options.multiline && styles.textArea]}
        placeholder={placeholder}
        placeholderTextColor={ADMIN_COLORS.textMuted}
        value={formData[field]}
        onChangeText={(value) => updateField(field, value)}
        keyboardType={options.keyboardType || 'default'}
        multiline={options.multiline}
        numberOfLines={options.numberOfLines}
      />
    </View>
  );

  const renderOptionSelector = (label, field, options) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.optionsRow}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.optionButton,
              formData[field] === option.key && styles.optionButtonActive,
            ]}
            onPress={() => updateField(field, option.key)}
            activeOpacity={0.7}
          >
            {option.icon && (
              <Ionicons
                name={option.icon}
                size={16}
                color={formData[field] === option.key ? '#FFF' : ADMIN_COLORS.textLight}
                style={{ marginRight: 6 }}
              />
            )}
            <Text
              style={[
                styles.optionText,
                formData[field] === option.key && styles.optionTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderToggle = (label, field, description) => (
    <TouchableOpacity
      style={styles.toggleRow}
      onPress={() => updateField(field, !formData[field])}
      activeOpacity={0.7}
    >
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description && <Text style={styles.toggleDescription}>{description}</Text>}
      </View>
      <View style={[styles.toggle, formData[field] && styles.toggleActive]}>
        <View style={[styles.toggleDot, formData[field] && styles.toggleDotActive]} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={ADMIN_COLORS.primary} />

      {/* Header */}
      <LinearGradient
        colors={[ADMIN_COLORS.primary, ADMIN_COLORS.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onGoBack} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Add New Pet</Text>
            <Text style={styles.headerSubtitle}>Register a pet for adoption</Text>
          </View>
          <TouchableOpacity 
            style={styles.saveBtn} 
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#FFFFFF', '#F8F9FE']}
              style={styles.saveBtnGradient}
            >
              {loading ? (
                <ActivityIndicator size="small" color={ADMIN_COLORS.primary} />
              ) : (
                <Ionicons name="checkmark" size={26} color={ADMIN_COLORS.primary} />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Image Upload Section */}
          <View style={styles.section}>
            {renderSectionHeader('Pet Photos', 'camera')}
            <View style={styles.imageSection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.imageRow}>
                  {images.map((uri, index) => (
                    <View key={index} style={styles.imageContainer}>
                      <Image source={{ uri }} style={styles.petImage} />
                      <TouchableOpacity
                        style={styles.removeImageBtn}
                        onPress={() => removeImage(index)}
                      >
                        <Ionicons name="close-circle" size={24} color={ADMIN_COLORS.danger} />
                      </TouchableOpacity>
                      {index === 0 && (
                        <View style={styles.primaryBadge}>
                          <Text style={styles.primaryBadgeText}>Primary</Text>
                        </View>
                      )}
                    </View>
                  ))}
                  <TouchableOpacity style={styles.addImageBtn} onPress={pickImage}>
                    <Ionicons name="add-circle-outline" size={32} color={ADMIN_COLORS.primary} />
                    <Text style={styles.addImageText}>Add Photo</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>

          {/* Basic Information */}
          <View style={styles.section}>
            {renderSectionHeader('Basic Information', 'information-circle')}
            {renderInput('Pet Name *', 'name', 'Enter pet name')}
            
            {/* Category Selector - Dog and Cat only */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category *</Text>
              <View style={styles.optionsRow}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.optionButton,
                      formData.category_id === cat.id && styles.optionButtonActive,
                    ]}
                    onPress={() => updateField('category_id', cat.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="paw"
                      size={16}
                      color={formData.category_id === cat.id ? '#FFF' : ADMIN_COLORS.textLight}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.optionText,
                        formData.category_id === cat.id && styles.optionTextActive,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            {renderInput('Breed *', 'breed_name', 'Enter breed (e.g., Golden Retriever)')}
            
            <View style={styles.row}>
              <View style={styles.halfInput}>
                {renderInput('Age (Years)', 'age_years', '0', { keyboardType: 'numeric' })}
              </View>
              <View style={styles.halfInput}>
                {renderInput('Age (Months)', 'age_months', '0', { keyboardType: 'numeric' })}
              </View>
            </View>

            {renderOptionSelector('Gender *', 'gender', GENDER_OPTIONS)}
            {renderOptionSelector('Size *', 'size', SIZE_OPTIONS)}
            
            <View style={styles.row}>
              <View style={styles.halfInput}>
                {renderInput('Weight (kg)', 'weight_kg', '0.0', { keyboardType: 'decimal-pad' })}
              </View>
              <View style={styles.halfInput}>
                {renderInput('Color', 'color', 'e.g., Brown, White')}
              </View>
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            {renderSectionHeader('Description', 'document-text')}
            {renderInput('About this pet *', 'description', 'Describe the pet\'s personality, background, and what makes them special...', {
              multiline: true,
              numberOfLines: 4,
            })}
          </View>

          {/* Health Information */}
          <View style={styles.section}>
            {renderSectionHeader('Health Information', 'medkit')}
            {renderOptionSelector('Vaccination Status', 'vaccination_status', VACCINATION_OPTIONS)}
            {renderInput('Medical History', 'medical_history', 'Any medical conditions or history...', {
              multiline: true,
              numberOfLines: 3,
            })}
            {renderInput('Special Needs', 'special_needs', 'Any special care requirements...', {
              multiline: true,
              numberOfLines: 2,
            })}
          </View>

          {/* Behavior & Traits */}
          <View style={styles.section}>
            {renderSectionHeader('Behavior & Traits', 'heart')}
            {renderToggle('Neutered/Spayed', 'is_neutered', 'Has been neutered or spayed')}
            {renderToggle('House Trained', 'is_house_trained', 'Is trained for indoor living')}
            {renderToggle('Good with Kids', 'is_good_with_kids', 'Comfortable around children')}
            {renderToggle('Good with Other Pets', 'is_good_with_other_pets', 'Gets along with other animals')}
          </View>

          {/* Location & Pricing */}
          <View style={styles.section}>
            {renderSectionHeader('Location & Adoption', 'location')}
            
            {/* Location Search with OpenStreetMap */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Location *</Text>
              <TouchableOpacity 
                style={styles.locationPicker}
                onPress={() => setLocationModalVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="location" size={20} color={ADMIN_COLORS.primary} />
                <Text 
                  style={[
                    styles.locationText,
                    !formData.location && styles.locationPlaceholder
                  ]}
                  numberOfLines={2}
                >
                  {formData.location || 'Search for a location...'}
                </Text>
                <Ionicons name="search" size={20} color={ADMIN_COLORS.textMuted} />
              </TouchableOpacity>
              {formData.latitude && formData.longitude && (
                <View style={styles.coordsDisplay}>
                  <Ionicons name="navigate" size={14} color={ADMIN_COLORS.success} />
                  <Text style={styles.coordsText}>
                    Coordinates: {formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)}
                  </Text>
                </View>
              )}
            </View>

            {renderInput('Adoption Fee (₱)', 'adoption_fee', '0', { keyboardType: 'decimal-pad' })}
            {renderToggle('Featured Pet', 'is_featured', 'Show this pet on the featured section')}
          </View>

          {/* Submit Button */}
          <TouchableOpacity 
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[ADMIN_COLORS.primary, ADMIN_COLORS.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitGradient}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="paw" size={22} color="#FFF" style={{ marginRight: 10 }} />
                  <Text style={styles.submitText}>Add Pet</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Location Search Modal - Moved outside ScrollView to fix glitching */}
      <Modal
        visible={locationModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setLocationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Search Location</Text>
              <TouchableOpacity 
                onPress={() => {
                  setLocationModalVisible(false);
                  setLocationSearch('');
                  setLocationResults([]);
                }}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={24} color={ADMIN_COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchWrap}>
              <Ionicons name="search" size={20} color={ADMIN_COLORS.primary} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search city, barangay, or address..."
                placeholderTextColor={ADMIN_COLORS.textMuted}
                value={locationSearch}
                onChangeText={setLocationSearch}
                autoFocus={true}
              />
              {locationSearch.length > 0 && (
                <TouchableOpacity onPress={() => setLocationSearch('')}>
                  <Ionicons name="close-circle" size={20} color={ADMIN_COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.modalHint}>
              <Ionicons name="information-circle" size={14} color={ADMIN_COLORS.textMuted} /> Powered by OpenStreetMap
            </Text>

            {searchingLocation ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="small" color={ADMIN_COLORS.primary} />
                <Text style={styles.modalLoadingText}>Searching...</Text>
              </View>
            ) : locationResults.length > 0 ? (
              <FlatList
                data={locationResults}
                keyExtractor={(item) => item.place_id.toString()}
                style={styles.locationList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.locationItem}
                    onPress={() => selectLocation(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.locationItemIcon}>
                      <Ionicons name="location" size={20} color={ADMIN_COLORS.primary} />
                    </View>
                    <View style={styles.locationItemContent}>
                      <Text style={styles.locationItemName} numberOfLines={1}>
                        {item.display_name.split(',')[0]}
                      </Text>
                      <Text style={styles.locationItemAddress} numberOfLines={2}>
                        {item.display_name}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={ADMIN_COLORS.textMuted} />
                  </TouchableOpacity>
                )}
              />
            ) : locationSearch.length >= 3 ? (
              <View style={styles.noResults}>
                <Ionicons name="location-outline" size={48} color={ADMIN_COLORS.textMuted} />
                <Text style={styles.noResultsText}>No locations found</Text>
                <Text style={styles.noResultsHint}>Try a different search term</Text>
              </View>
            ) : (
              <View style={styles.noResults}>
                <Ionicons name="map-outline" size={48} color={ADMIN_COLORS.textMuted} />
                <Text style={styles.noResultsText}>Search for a location</Text>
                <Text style={styles.noResultsHint}>Enter at least 3 characters to search</Text>
              </View>
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
    backgroundColor: ADMIN_COLORS.background,
  },
  headerGradient: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 12 : 56,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
    fontWeight: '500',
  },
  saveBtn: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  saveBtnGradient: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
    marginLeft: 10,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: ADMIN_COLORS.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: ADMIN_COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: ADMIN_COLORS.text,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  row: {
    flexDirection: 'row',
    marginHorizontal: -8,
  },
  halfInput: {
    flex: 1,
    paddingHorizontal: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: ADMIN_COLORS.background,
    borderRadius: 10,
    margin: 4,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  optionButtonActive: {
    backgroundColor: ADMIN_COLORS.primary,
    borderColor: ADMIN_COLORS.primary,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: ADMIN_COLORS.textLight,
  },
  optionTextActive: {
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.border,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: ADMIN_COLORS.text,
  },
  toggleDescription: {
    fontSize: 13,
    color: ADMIN_COLORS.textMuted,
    marginTop: 2,
  },
  toggle: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: ADMIN_COLORS.border,
    padding: 3,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: ADMIN_COLORS.primary,
  },
  toggleDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleDotActive: {
    alignSelf: 'flex-end',
  },
  imageSection: {
    marginTop: 4,
  },
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  petImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: ADMIN_COLORS.background,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: ADMIN_COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addImageBtn: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: ADMIN_COLORS.primary,
    backgroundColor: 'rgba(255, 140, 66, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageText: {
    fontSize: 12,
    fontWeight: '600',
    color: ADMIN_COLORS.primary,
    marginTop: 4,
  },
  submitButton: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: ADMIN_COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  submitText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingCategoriesWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ADMIN_COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  loadingCategoriesText: {
    marginLeft: 10,
    fontSize: 14,
    color: ADMIN_COLORS.textMuted,
  },
  // Location Picker Styles
  locationPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ADMIN_COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  locationText: {
    flex: 1,
    fontSize: 15,
    color: ADMIN_COLORS.text,
    marginHorizontal: 12,
  },
  locationPlaceholder: {
    color: ADMIN_COLORS.textMuted,
  },
  coordsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  coordsText: {
    fontSize: 12,
    color: ADMIN_COLORS.success,
    marginLeft: 6,
    fontWeight: '500',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: ADMIN_COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ADMIN_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ADMIN_COLORS.background,
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 15,
    color: ADMIN_COLORS.text,
    marginLeft: 12,
    marginRight: 8,
  },
  modalHint: {
    fontSize: 12,
    color: ADMIN_COLORS.textMuted,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  modalLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  modalLoadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: ADMIN_COLORS.textMuted,
  },
  locationList: {
    flex: 1,
    paddingHorizontal: 12,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ADMIN_COLORS.background,
    marginHorizontal: 8,
    marginVertical: 6,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  locationItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 140, 66, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationItemContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  locationItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: ADMIN_COLORS.text,
  },
  locationItemAddress: {
    fontSize: 12,
    color: ADMIN_COLORS.textMuted,
    marginTop: 2,
  },
  noResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '600',
    color: ADMIN_COLORS.text,
    marginTop: 16,
  },
  noResultsHint: {
    fontSize: 13,
    color: ADMIN_COLORS.textMuted,
    marginTop: 4,
  },
});

export default memo(AdminAddPetScreen);
