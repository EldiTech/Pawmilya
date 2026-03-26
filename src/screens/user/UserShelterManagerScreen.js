import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
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
  Alert,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  AppState,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { shelterService } from '../../services';
import { getImageUrl, getTimeAgo } from './shared';

// Helper to convert image URI to base64
const imageUriToBase64 = async (uri) => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return null;
  }
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Tab configuration
const TABS = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'pets', label: 'Pets', icon: 'paw' },
  { id: 'adoptions', label: 'Adoptions', icon: 'heart' },
  { id: 'transfers', label: 'Transfers', icon: 'swap-horizontal' },
];

// Transfer status colors
const TRANSFER_STATUS = {
  pending: { label: 'Pending', color: '#F59E0B', bg: '#FEF3C7' },
  approved: { label: 'Approved', color: '#22C55E', bg: '#D1FAE5' },
  accepted: { label: 'Approved', color: '#22C55E', bg: '#D1FAE5' }, // legacy fallback
  rejected: { label: 'Rejected', color: '#EF4444', bg: '#FEE2E2' },
  cancelled: { label: 'Cancelled', color: '#6B7280', bg: '#F3F4F6' },
  completed: { label: 'Completed', color: '#3B82F6', bg: '#DBEAFE' },
};

// Pet status colors
const PET_STATUS = {
  available: { label: 'Available', color: '#22C55E', bg: '#D1FAE5' },
  adopted: { label: 'Adopted', color: '#3B82F6', bg: '#DBEAFE' },
  pending: { label: 'Pending', color: '#F59E0B', bg: '#FEF3C7' },
  fostered: { label: 'Fostered', color: '#8B5CF6', bg: '#EDE9FE' },
};

// Adoption status config
const ADOPTION_STATUS = {
  pending: { label: 'Pending', color: '#F59E0B', bg: '#FEF3C7', icon: 'time' },
  reviewing: { label: 'Reviewing', color: '#3B82F6', bg: '#DBEAFE', icon: 'eye' },
  approved: { label: 'Approved', color: '#22C55E', bg: '#D1FAE5', icon: 'checkmark-circle' },
  rejected: { label: 'Rejected', color: '#EF4444', bg: '#FEE2E2', icon: 'close-circle' },
};

// Stat card component
const StatCard = memo(({ icon, iconColor, label, value }) => (
  <View style={[styles.statCard, { borderLeftColor: iconColor }]}>
    <View style={[styles.statIconWrap, { backgroundColor: iconColor + '10' }]}>
      <Ionicons name={icon} size={18} color={iconColor} />
    </View>
    <View style={styles.statTextWrap}>
      <Text style={styles.statValue}>{value ?? 0}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  </View>
));

// Pet card component
const PetCard = memo(({ pet, onPress }) => {
  const statusConfig = PET_STATUS[pet.status] || PET_STATUS.available;
  const imageUrl = pet.image ? getImageUrl(pet.image) : null;

  return (
    <TouchableOpacity style={styles.petCard} onPress={() => onPress?.(pet)} activeOpacity={0.7}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.petImage} />
      ) : (
        <View style={[styles.petImage, styles.petImagePlaceholder]}>
          <Ionicons name="paw" size={24} color={COLORS.textLight} />
        </View>
      )}
      <View style={styles.petInfo}>
        <Text style={styles.petName} numberOfLines={1}>{pet.name}</Text>
        <Text style={styles.petBreed} numberOfLines={1}>{pet.breed_name || pet.breed || 'Unknown breed'}</Text>
        <View style={styles.petMeta}>
          {pet.gender && (
            <View style={styles.petMetaItem}>
              <Ionicons name={pet.gender === 'male' ? 'male' : 'female'} size={12} color={pet.gender === 'male' ? '#3B82F6' : '#EC4899'} />
              <Text style={styles.petMetaText}>{pet.gender}</Text>
            </View>
          )}
          {pet.adoption_fee != null && (
            <Text style={styles.petFee}>₱{Number(pet.adoption_fee).toLocaleString()}</Text>
          )}
        </View>
      </View>
      <View style={styles.petCardRight}>
        <View style={[styles.petStatusBadge, { backgroundColor: statusConfig.bg }]}>
          <View style={[styles.petStatusDot, { backgroundColor: statusConfig.color }]} />
          <Text style={[styles.petStatusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
      </View>
    </TouchableOpacity>
  );
});

// Transfer card component
const TransferCard = memo(({ transfer, onRespond }) => {
  const statusConfig = TRANSFER_STATUS[transfer.status] || TRANSFER_STATUS.pending;

  return (
    <View style={[styles.transferCard, { borderLeftColor: statusConfig.color }]}>
      <View style={styles.transferHeader}>
        <View style={styles.transferTitleWrap}>
          <Text style={styles.transferTitle} numberOfLines={1}>{transfer.rescue_title || 'Transfer Request'}</Text>
          <Text style={styles.transferTime}>{getTimeAgo(transfer.created_at)}</Text>
        </View>
        <View style={[styles.transferStatusBadge, { backgroundColor: statusConfig.bg }]}>
          <Text style={[styles.transferStatusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
        </View>
      </View>

      {transfer.rescue_description && (
        <Text style={styles.transferDescription} numberOfLines={2}>{transfer.rescue_description}</Text>
      )}

      {transfer.requester_name && (
        <View style={styles.transferRequester}>
          <View style={styles.requesterAvatar}>
            <Ionicons name="person" size={11} color={COLORS.textMedium} />
          </View>
          <Text style={styles.transferRequesterText}>Requested by {transfer.requester_name}</Text>
        </View>
      )}

      {transfer.status === 'pending' && onRespond && (
        <View style={styles.transferActions}>
          <TouchableOpacity
            style={[styles.transferActionBtn, styles.rejectBtn]}
            onPress={() => onRespond(transfer.id, 'rejected')}
          >
            <Ionicons name="close" size={16} color="#EF4444" />
            <Text style={[styles.transferActionBtnLabel, { color: '#EF4444' }]}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.transferActionBtn, styles.acceptBtn]}
            onPress={() => onRespond(transfer.id, 'approved')}
          >
            <Ionicons name="checkmark" size={16} color="#FFF" />
            <Text style={styles.transferActionBtnLabel}>Accept</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

// =====================================================
// Image Picker Modal
// =====================================================
const ImagePickerModal = memo(({ visible, onClose, onCamera, onGallery }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <TouchableOpacity style={styles.imagePickerOverlay} activeOpacity={1} onPress={onClose}>
      <View style={styles.imagePickerSheet}>
        <View style={styles.imagePickerHandle} />
        <Text style={styles.imagePickerTitle}>Choose Photo</Text>
        <TouchableOpacity style={styles.imagePickerOption} onPress={onCamera}>
          <View style={[styles.imagePickerIconWrap, { backgroundColor: '#3B82F615' }]}>
            <Ionicons name="camera" size={22} color="#3B82F6" />
          </View>
          <View style={styles.imagePickerOptionText}>
            <Text style={styles.imagePickerOptionLabel}>Take Photo</Text>
            <Text style={styles.imagePickerOptionDesc}>Use your camera</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.imagePickerOption} onPress={onGallery}>
          <View style={[styles.imagePickerIconWrap, { backgroundColor: '#8B5CF615' }]}>
            <Ionicons name="images" size={22} color="#8B5CF6" />
          </View>
          <View style={styles.imagePickerOptionText}>
            <Text style={styles.imagePickerOptionLabel}>Choose from Gallery</Text>
            <Text style={styles.imagePickerOptionDesc}>Select an existing photo</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.imagePickerCancel} onPress={onClose}>
          <Text style={styles.imagePickerCancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  </Modal>
));

// =====================================================
// Edit Shelter Modal
// =====================================================
const EditShelterModal = memo(({ visible, shelter, onClose, onSave, saving }) => {
  const [form, setForm] = useState({});
  const [coverPreview, setCoverPreview] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [imagePickerTarget, setImagePickerTarget] = useState(null); // 'cover' | 'logo' | null

  // Reset form when shelter changes or modal opens
  useEffect(() => {
    if (visible && shelter) {
      setForm({
        name: shelter.name || '',
        description: shelter.description || '',
        phone: shelter.phone || '',
        email: shelter.email || '',
        operating_hours: shelter.operating_hours || '',
        address: shelter.address || '',
        city: shelter.city || '',
        contact_person_name: shelter.contact_person_name || '',
        shelter_capacity: shelter.shelter_capacity ? String(shelter.shelter_capacity) : '',
      });
      setCoverPreview(null);
      setLogoPreview(null);
    }
  }, [visible, shelter]);

  const updateField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const getCoverDisplay = () => {
    if (coverPreview) return coverPreview;
    const img = shelter?.cover_image || shelter?.cover_image_data || shelter?.cover_image_url;
    return img ? getImageUrl(img) : null;
  };

  const getLogoDisplay = () => {
    if (logoPreview) return logoPreview;
    const img = shelter?.logo_image || shelter?.logo_image_data || shelter?.logo_url;
    return img ? getImageUrl(img) : null;
  };

  const pickFromCamera = async () => {
    const target = imagePickerTarget;
    setImagePickerTarget(null);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: target === 'logo' ? [1, 1] : [16, 9],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        handleImagePicked(result.assets[0].uri, target);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const pickFromGallery = async () => {
    const target = imagePickerTarget;
    setImagePickerTarget(null);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Gallery permission is needed to select photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: target === 'logo' ? [1, 1] : [16, 9],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        handleImagePicked(result.assets[0].uri, target);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const handleImagePicked = (uri, target) => {
    const actualTarget = target || imagePickerTarget || 'cover';
    if (actualTarget === 'logo') {
      setLogoPreview(uri);
      updateField('_logoUri', uri);
    } else {
      setCoverPreview(uri);
      updateField('_coverUri', uri);
    }
  };

  const handleSave = async () => {
    if (!form.name?.trim()) {
      Alert.alert('Required', 'Shelter name is required.');
      return;
    }

    const data = { ...form };

    // Convert picked images to base64
    try {
      if (form._coverUri) {
        const base64 = await imageUriToBase64(form._coverUri);
        if (base64) data.cover_image = base64;
      }
      if (form._logoUri) {
        const base64 = await imageUriToBase64(form._logoUri);
        if (base64) data.logo_image = base64;
      }
    } catch (err) {
      console.error('Image conversion error:', err);
    }

    // Clean up internal keys
    delete data._coverUri;
    delete data._logoUri;

    // Convert capacity to number
    if (data.shelter_capacity) {
      data.shelter_capacity = parseInt(data.shelter_capacity) || 0;
    }

    onSave(data);
  };

  const coverDisplay = getCoverDisplay();
  const logoDisplay = getLogoDisplay();

  const renderField = (label, key, options = {}) => (
    <View style={styles.editFieldWrap}>
      <Text style={styles.editFieldLabel}>{label}</Text>
      <TextInput
        style={[
          styles.editFieldInput,
          options.multiline && styles.editFieldMultiline,
        ]}
        value={form[key] || ''}
        onChangeText={(v) => updateField(key, v)}
        placeholder={options.placeholder || `Enter ${label.toLowerCase()}`}
        placeholderTextColor={COLORS.textLight}
        multiline={options.multiline}
        numberOfLines={options.multiline ? 4 : 1}
        textAlignVertical={options.multiline ? 'top' : 'center'}
        keyboardType={options.keyboardType || 'default'}
        autoCapitalize={options.autoCapitalize || 'sentences'}
        maxLength={options.maxLength}
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.editModalContainer}>
        {/* Header */}
        <View style={styles.editModalHeader}>
          <TouchableOpacity style={styles.editModalCloseBtn} onPress={onClose} disabled={saving}>
            <Ionicons name="close" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.editModalTitle}>Edit Shelter</Text>
          <TouchableOpacity
            style={[styles.editModalSaveBtn, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.editModalSaveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Form Content */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.editFormContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Cover Image */}
            <View style={styles.editSectionWrap}>
              <Text style={styles.editSectionTitle}>Cover Image</Text>
              <TouchableOpacity
                style={styles.editCoverWrap}
                onPress={() => setImagePickerTarget('cover')}
                activeOpacity={0.8}
              >
                {coverDisplay ? (
                  <Image source={{ uri: coverDisplay }} style={styles.editCoverImage} />
                ) : (
                  <View style={[styles.editCoverImage, styles.editCoverPlaceholder]}>
                    <Ionicons name="image-outline" size={40} color={COLORS.textLight} />
                    <Text style={styles.editCoverPlaceholderText}>Tap to add cover photo</Text>
                  </View>
                )}
                <View style={styles.editCoverOverlay}>
                  <View style={styles.editCoverBadge}>
                    <Ionicons name="camera" size={16} color="#FFF" />
                    <Text style={styles.editCoverBadgeText}>Change</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* Logo Image */}
            <View style={styles.editSectionWrap}>
              <Text style={styles.editSectionTitle}>Logo</Text>
              <View style={styles.editLogoRow}>
                <TouchableOpacity
                  style={styles.editLogoWrap}
                  onPress={() => setImagePickerTarget('logo')}
                  activeOpacity={0.8}
                >
                  {logoDisplay ? (
                    <Image source={{ uri: logoDisplay }} style={styles.editLogoImage} />
                  ) : (
                    <View style={[styles.editLogoImage, styles.editLogoPlaceholder]}>
                      <MaterialCommunityIcons name="home-heart" size={32} color={COLORS.textLight} />
                    </View>
                  )}
                  <View style={styles.editLogoCameraBadge}>
                    <Ionicons name="camera" size={12} color="#FFF" />
                  </View>
                </TouchableOpacity>
                <View style={styles.editLogoHint}>
                  <Text style={styles.editLogoHintTitle}>Shelter Logo</Text>
                  <Text style={styles.editLogoHintText}>
                    Square image recommended.{'\n'}This appears on shelter cards.
                  </Text>
                </View>
              </View>
            </View>

            {/* Basic Info */}
            <View style={styles.editSectionWrap}>
              <Text style={styles.editSectionTitle}>Basic Information</Text>
              {renderField('Shelter Name', 'name', { maxLength: 200 })}
              {renderField('Description', 'description', { multiline: true, maxLength: 2000 })}
              {renderField('Contact Person', 'contact_person_name', { maxLength: 100 })}
              {renderField('Capacity', 'shelter_capacity', { keyboardType: 'number-pad', placeholder: 'Max number of animals' })}
            </View>

            {/* Contact Info */}
            <View style={styles.editSectionWrap}>
              <Text style={styles.editSectionTitle}>Contact & Location</Text>
              {renderField('Phone', 'phone', { keyboardType: 'phone-pad', maxLength: 20 })}
              {renderField('Email', 'email', { keyboardType: 'email-address', autoCapitalize: 'none', maxLength: 255 })}
              {renderField('Address', 'address', { maxLength: 500 })}
              {renderField('City', 'city', { maxLength: 100 })}
              {renderField('Operating Hours', 'operating_hours', { placeholder: 'e.g. Mon-Fri 9AM-5PM', maxLength: 500 })}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* Image Picker Modal */}
      <ImagePickerModal
        visible={imagePickerTarget !== null}
        onClose={() => setImagePickerTarget(null)}
        onCamera={pickFromCamera}
        onGallery={pickFromGallery}
      />
    </Modal>
  );
});

// =====================================================
// Default categories for pet type selection
// =====================================================
const DEFAULT_PET_CATEGORIES = [
  { id: 1, name: 'Dog' },
  { id: 2, name: 'Cat' },
  { id: 3, name: 'Bird' },
  { id: 4, name: 'Rabbit' },
  { id: 5, name: 'Other' },
];

const GENDER_OPTIONS = ['Male', 'Female', 'Unknown'];
const SIZE_OPTIONS = ['Small', 'Medium', 'Large', 'Extra-Large'];
const VACCINATION_OPTIONS = [
  { value: 'fully_vaccinated', label: 'Fully Vaccinated' },
  { value: 'partially_vaccinated', label: 'Partially' },
  { value: 'not_vaccinated', label: 'Not Vaccinated' },
];

// =====================================================
// Edit Pet Modal
// =====================================================
const EditPetModal = memo(({ visible, pet, onClose, onSave, saving }) => {
  const [form, setForm] = useState({});
  const [petImagePreview, setPetImagePreview] = useState(null);
  const [showImagePicker, setShowImagePicker] = useState(false);

  useEffect(() => {
    if (visible && pet) {
      setForm({
        name: pet.name || '',
        category_id: pet.category_id || null,
        breed_name: pet.breed_name || pet.breed || '',
        age_years: pet.age_years != null ? String(pet.age_years) : '',
        age_months: pet.age_months != null ? String(pet.age_months) : '',
        gender: pet.gender || '',
        size: pet.size || '',
        color: pet.color || '',
        description: pet.description || '',
        medical_history: pet.medical_history || '',
        vaccination_status: pet.vaccination_status || '',
        is_neutered: !!pet.is_neutered,
        is_house_trained: !!pet.is_house_trained,
        is_good_with_kids: !!pet.is_good_with_kids,
        is_good_with_other_pets: !!pet.is_good_with_other_pets,
        special_needs: pet.special_needs || '',
        adoption_fee: pet.adoption_fee != null ? String(pet.adoption_fee) : '0',
        status: pet.status || 'available',
      });
      setPetImagePreview(null);
    }
  }, [visible, pet]);

  const updateField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const getCurrentImage = () => {
    if (petImagePreview) return petImagePreview;
    if (pet?.image) return getImageUrl(pet.image);
    return null;
  };

  const pickFromCamera = async () => {
    setShowImagePicker(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        setPetImagePreview(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const pickFromGallery = async () => {
    setShowImagePicker(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Gallery permission is needed to select photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        setPetImagePreview(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const handleSave = async () => {
    if (!form.name?.trim()) {
      Alert.alert('Required', 'Pet name is required.');
      return;
    }

    const data = { ...form };

    // Convert numeric fields
    data.age_years = data.age_years ? parseInt(data.age_years) || 0 : 0;
    data.age_months = data.age_months ? parseInt(data.age_months) || 0 : 0;
    data.adoption_fee = data.adoption_fee ? parseFloat(data.adoption_fee) || 0 : 0;

    // Handle image
    if (petImagePreview) {
      try {
        const base64 = await imageUriToBase64(petImagePreview);
        if (base64) {
          data.images = [base64];
        }
      } catch (err) {
        console.error('Image conversion error:', err);
      }
    }

    onSave(pet.id, data);
  };

  const currentImage = getCurrentImage();

  const renderField = (label, key, options = {}) => (
    <View style={styles.editFieldWrap}>
      <Text style={styles.editFieldLabel}>{label}</Text>
      <TextInput
        style={[
          styles.editFieldInput,
          options.multiline && styles.editFieldMultiline,
        ]}
        value={form[key] || ''}
        onChangeText={(v) => updateField(key, v)}
        placeholder={options.placeholder || `Enter ${label.toLowerCase()}`}
        placeholderTextColor={COLORS.textLight}
        multiline={options.multiline}
        numberOfLines={options.multiline ? 4 : 1}
        textAlignVertical={options.multiline ? 'top' : 'center'}
        keyboardType={options.keyboardType || 'default'}
        autoCapitalize={options.autoCapitalize || 'sentences'}
        maxLength={options.maxLength}
      />
    </View>
  );

  const renderButtonGroup = (label, key, options) => (
    <View style={styles.editFieldWrap}>
      <Text style={styles.editFieldLabel}>{label}</Text>
      <View style={styles.epButtonGroup}>
        {options.map((opt) => {
          const value = typeof opt === 'object' ? opt.value : opt;
          const optLabel = typeof opt === 'object' ? opt.label : opt;
          const isSelected = form[key] === value || (typeof form[key] === 'number' && form[key] === value);
          return (
            <TouchableOpacity
              key={`${key}-${String(value)}-${String(optLabel)}`}
              style={[styles.epButtonOption, isSelected && styles.epButtonOptionActive]}
              onPress={() => updateField(key, value)}
            >
              <Text style={[styles.epButtonOptionText, isSelected && styles.epButtonOptionTextActive]}>
                {optLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderToggle = (label, key) => (
    <TouchableOpacity
      style={styles.epToggleRow}
      onPress={() => updateField(key, !form[key])}
      activeOpacity={0.7}
    >
      <Text style={styles.epToggleLabel}>{label}</Text>
      <View style={[styles.epToggleTrack, form[key] && styles.epToggleTrackActive]}>
        <View style={[styles.epToggleThumb, form[key] && styles.epToggleThumbActive]} />
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.editModalContainer}>
        {/* Header */}
        <View style={styles.editModalHeader}>
          <TouchableOpacity style={styles.editModalCloseBtn} onPress={onClose} disabled={saving}>
            <Ionicons name="close" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.editModalTitle}>Edit Pet Details</Text>
          <TouchableOpacity
            style={[styles.editModalSaveBtn, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.editModalSaveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.editFormContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Pet Photo */}
            <View style={styles.editSectionWrap}>
              <Text style={styles.editSectionTitle}>Pet Photo</Text>
              <TouchableOpacity
                style={styles.epPhotoWrap}
                onPress={() => setShowImagePicker(true)}
                activeOpacity={0.8}
              >
                {currentImage ? (
                  <Image source={{ uri: currentImage }} style={styles.epPhotoImage} />
                ) : (
                  <View style={[styles.epPhotoImage, styles.epPhotoPlaceholder]}>
                    <Ionicons name="camera-outline" size={40} color={COLORS.textLight} />
                    <Text style={styles.editCoverPlaceholderText}>Tap to add photo</Text>
                  </View>
                )}
                <View style={styles.editCoverOverlay}>
                  <View style={styles.editCoverBadge}>
                    <Ionicons name="camera" size={16} color="#FFF" />
                    <Text style={styles.editCoverBadgeText}>{currentImage ? 'Change' : 'Add'}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* Basic Info */}
            <View style={styles.editSectionWrap}>
              <Text style={styles.editSectionTitle}>Basic Information</Text>
              {renderField('Pet Name *', 'name', { maxLength: 100 })}
              {renderButtonGroup('Category', 'category_id', DEFAULT_PET_CATEGORIES.map(c => ({ value: c.id, label: c.name })))}
              {renderField('Breed', 'breed_name', { placeholder: 'e.g. Golden Retriever, Persian', maxLength: 100 })}
              <View style={styles.epRow}>
                <View style={styles.epHalf}>
                  {renderField('Age (Years)', 'age_years', { keyboardType: 'number-pad' })}
                </View>
                <View style={styles.epHalf}>
                  {renderField('Age (Months)', 'age_months', { keyboardType: 'number-pad' })}
                </View>
              </View>
              {renderButtonGroup('Gender', 'gender', GENDER_OPTIONS)}
              {renderButtonGroup('Size', 'size', SIZE_OPTIONS.map(s => ({ value: s.toLowerCase(), label: s })))}
              {renderField('Color', 'color', { placeholder: 'e.g. Brown, Black & White', maxLength: 100 })}
            </View>

            {/* Description */}
            <View style={styles.editSectionWrap}>
              <Text style={styles.editSectionTitle}>Description</Text>
              {renderField('Description', 'description', { multiline: true, maxLength: 2000, placeholder: 'Describe the pet\'s personality, background...' })}
              {renderField('Medical History', 'medical_history', { multiline: true, maxLen: 2000, placeholder: 'Any known medical conditions, treatments...' })}
            </View>

            {/* Health */}
            <View style={styles.editSectionWrap}>
              <Text style={styles.editSectionTitle}>Health & Behavior</Text>
              {renderButtonGroup('Vaccination Status', 'vaccination_status', VACCINATION_OPTIONS)}
              {renderToggle('Neutered / Spayed', 'is_neutered')}
              {renderToggle('House Trained', 'is_house_trained')}
              {renderToggle('Good with Kids', 'is_good_with_kids')}
              {renderToggle('Good with Other Pets', 'is_good_with_other_pets')}
              {renderField('Special Needs', 'special_needs', { multiline: true, maxLength: 2000, placeholder: 'Any special care requirements...' })}
            </View>

            {/* Adoption */}
            <View style={styles.editSectionWrap}>
              <Text style={styles.editSectionTitle}>Adoption Details</Text>
              {renderField('Adoption Fee (PHP)', 'adoption_fee', { keyboardType: 'decimal-pad', placeholder: '0' })}
              {renderButtonGroup('Status', 'status', [
                { value: 'available', label: 'Available' },
                { value: 'pending', label: 'Pending' },
                { value: 'adopted', label: 'Adopted' },
              ])}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* Image Picker Modal */}
      <ImagePickerModal
        visible={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        onCamera={pickFromCamera}
        onGallery={pickFromGallery}
      />
    </Modal>
  );
});

const UserShelterManagerScreen = ({ onGoBack }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [shelter, setShelter] = useState(null);
  const [pets, setPets] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [savingShelter, setSavingShelter] = useState(false);
  const [editPetModalVisible, setEditPetModalVisible] = useState(false);
  const [selectedPet, setSelectedPet] = useState(null);
  const [savingPet, setSavingPet] = useState(false);

  // Adoption states
  const [adoptions, setAdoptions] = useState([]);
  const [adoptionFilter, setAdoptionFilter] = useState('all');
  const [adoptionLoading, setAdoptionLoading] = useState(false);
  const [adoptionDetailVisible, setAdoptionDetailVisible] = useState(false);
  const [adoptionRejectVisible, setAdoptionRejectVisible] = useState(false);
  const [selectedAdoption, setSelectedAdoption] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [adoptionProcessing, setAdoptionProcessing] = useState(false);
  const [verifyingPaymentId, setVerifyingPaymentId] = useState(null);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [paymentsOverview, setPaymentsOverview] = useState({ summary: null, recentPayments: [] });

  // Fetch all data
  const fetchData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      else setRefreshing(true);

      const [shelterData, petsData, transfersData, adoptionsData, paymentsData] = await Promise.all([
        shelterService.getManagedShelter().catch(() => null),
        shelterService.getManagedShelterPets().catch(() => ({ data: [] })),
        shelterService.getManagedShelterTransfers().catch(() => ({ data: [] })),
        shelterService.getShelterAdoptions().catch(() => []),
        shelterService.getManagedShelterPaymentsOverview().catch(() => ({ summary: null, recentPayments: [] })),
      ]);

      if (shelterData) setShelter(shelterData);
      setPets(petsData?.data || petsData || []);
      setTransfers(transfersData?.data || transfersData || []);
      setAdoptions(Array.isArray(adoptionsData) ? adoptionsData : []);
      setPaymentsOverview({
        summary: paymentsData?.summary || null,
        recentPayments: Array.isArray(paymentsData?.recentPayments) ? paymentsData.recentPayments : [],
      });
    } catch (error) {
      console.error('Error fetching shelter data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab !== 'overview' && activeTab !== 'adoptions') return;

    const intervalId = setInterval(() => {
      fetchData(false);
    }, 12000);

    return () => clearInterval(intervalId);
  }, [activeTab, fetchData]);

  // Keep manager adoptions in sync while adopter payment is still being verified.
  useEffect(() => {
    const hasPendingVerification = adoptions.some(
      (a) => a.status === 'approved' && !a.payment_completed && a.paymongo_checkout_id
    );

    if (activeTab !== 'adoptions' || !hasPendingVerification) {
      return;
    }

    const verifyPendingPayments = async () => {
      const pending = adoptions.filter(
        (a) => a.status === 'approved' && !a.payment_completed && a.paymongo_checkout_id
      );

      if (pending.length === 0) return;

      await Promise.all(
        pending.map((a) => shelterService.verifyAdoptionPayment(a.id).catch(() => null))
      );

      fetchData(false);
    };

    const intervalId = setInterval(() => {
      verifyPendingPayments();
    }, 5000);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        verifyPendingPayments();
      }
    });

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [activeTab, adoptions, fetchData]);

  // Handle transfer response
  const handleTransferResponse = useCallback(async (transferId, status) => {
    const action = status === 'approved' ? 'approve' : 'reject';
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Transfer`,
      `Are you sure you want to ${action} this transfer request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          onPress: async () => {
            try {
              await shelterService.respondToTransferRequest(transferId, status);
              Alert.alert('Success', `Transfer request ${status} successfully.`);
              fetchData(false);
            } catch (error) {
              Alert.alert('Error', error?.message || `Failed to ${action} transfer request.`);
            }
          },
        },
      ]
    );
  }, [fetchData]);

  // Handle pet edit
  const handleEditPet = useCallback((pet) => {
    setSelectedPet(pet);
    setEditPetModalVisible(true);
  }, []);

  // Handle pet save
  const handleSavePet = useCallback(async (petId, data) => {
    try {
      setSavingPet(true);
      await shelterService.updateManagedShelterPet(petId, data);
      setEditPetModalVisible(false);
      setSelectedPet(null);
      Alert.alert('Success', 'Pet details updated successfully!');
      fetchData(false);
    } catch (error) {
      const msg = error?.response?.data?.error || error?.message || 'Failed to update pet.';
      Alert.alert('Error', msg);
    } finally {
      setSavingPet(false);
    }
  }, [fetchData]);

  // Handle shelter edit save
  const handleSaveShelter = useCallback(async (data) => {
    try {
      setSavingShelter(true);
      const updated = await shelterService.updateManagedShelter(data);
      if (updated) setShelter(updated);
      setEditModalVisible(false);
      Alert.alert('Success', 'Shelter details updated successfully!');
      fetchData(false);
    } catch (error) {
      const msg = error?.response?.data?.error || error?.message || 'Failed to update shelter.';
      Alert.alert('Error', msg);
    } finally {
      setSavingShelter(false);
    }
  }, [fetchData]);

  // Render overview tab
  const renderOverview = () => {
    const coverImg = shelter ? getImageUrl(shelter.cover_image || shelter.cover_image_data || shelter.cover_image_url) : null;
    const logoImg = shelter ? getImageUrl(shelter.logo_image || shelter.logo_image_data || shelter.logo_url) : null;
    const paymentSummary = paymentsOverview?.summary;
    const recentPayments = Array.isArray(paymentsOverview?.recentPayments)
      ? paymentsOverview.recentPayments.slice(0, 5)
      : [];

    return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      {/* Shelter Info */}
      {shelter && (
        <View style={styles.shelterInfoCard}>
          {/* Cover Image */}
          {coverImg ? (
            <Image source={{ uri: coverImg }} style={styles.shelterCoverImage} />
          ) : (
            <View style={[styles.shelterCoverImage, styles.shelterCoverPlaceholder]}>
              <Ionicons name="image-outline" size={32} color={COLORS.textLight} />
              <Text style={styles.shelterCoverPlaceholderText}>No cover image</Text>
            </View>
          )}

          <View style={styles.shelterInfoBody}>
            <View style={styles.shelterInfoHeader}>
              {/* Logo */}
              {logoImg ? (
                <Image source={{ uri: logoImg }} style={styles.shelterLogoImage} />
              ) : (
                <View style={[styles.shelterLogoImage, styles.shelterLogoPlaceholder]}>
                  <MaterialCommunityIcons name="home-heart" size={28} color={COLORS.primary} />
                </View>
              )}
              <View style={styles.shelterInfoText}>
                <Text style={styles.shelterInfoName}>{shelter.name}</Text>
                {shelter.city && (
                  <View style={styles.shelterInfoLocation}>
                    <Ionicons name="location-outline" size={14} color={COLORS.textMedium} />
                    <Text style={styles.shelterInfoCity}>{shelter.city}</Text>
                  </View>
                )}
              </View>
            </View>
            {shelter.description && (
              <Text style={styles.shelterInfoDesc} numberOfLines={3}>{shelter.description}</Text>
            )}

            {/* Edit Button */}
            <TouchableOpacity
              style={styles.editShelterBtn}
              onPress={() => setEditModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={18} color="#FFF" />
              <Text style={styles.editShelterBtnText}>Edit Shelter Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard icon="paw" iconColor={COLORS.primary} label="Total Pets" value={stats.totalPets} />
        <StatCard icon="heart" iconColor="#22C55E" label="Available" value={stats.availablePets} />
        <StatCard icon="checkmark-circle" iconColor="#3B82F6" label="Adopted" value={stats.adoptedPets} />
        <StatCard icon="swap-horizontal" iconColor="#F59E0B" label="Pending Transfers" value={stats.pendingTransfers} />
        <StatCard icon="document-text" iconColor="#8B5CF6" label="Pending Adoptions" value={stats.pendingAdoptions} />
      </View>

      {/* Manager-only Payment Overview */}
      <View style={styles.paymentsCard}>
        <View style={styles.paymentsHeaderRow}>
          <Text style={styles.paymentsTitle}>Payment Overview</Text>
          <View style={styles.paymentsBadge}>
            <Text style={styles.paymentsBadgeText}>Manager Only</Text>
          </View>
        </View>

        <Text style={styles.paymentsTotalLabel}>Total Collected</Text>
        <Text style={styles.paymentsTotalValue}>{formatCurrency(paymentSummary?.total_revenue || 0)}</Text>

        <View style={styles.paymentsMetricsGrid}>
          <View style={styles.paymentsMetricBox}>
            <Text style={styles.paymentsMetricValue}>{paymentSummary?.paid_adoptions || 0}</Text>
            <Text style={styles.paymentsMetricLabel}>Paid Adoptions</Text>
          </View>
          <View style={styles.paymentsMetricBox}>
            <Text style={styles.paymentsMetricValue}>{paymentSummary?.adopted_pets || 0}</Text>
            <Text style={styles.paymentsMetricLabel}>Pets Adopted</Text>
          </View>
          <View style={styles.paymentsMetricBox}>
            <Text style={styles.paymentsMetricValue}>{formatCurrency(paymentSummary?.online_revenue || 0)}</Text>
            <Text style={styles.paymentsMetricLabel}>Online</Text>
          </View>
          <View style={styles.paymentsMetricBox}>
            <Text style={styles.paymentsMetricValue}>{formatCurrency(paymentSummary?.manual_revenue || 0)}</Text>
            <Text style={styles.paymentsMetricLabel}>Manual/COD</Text>
          </View>
        </View>

        {recentPayments.length > 0 ? (
          <View style={styles.paymentsRecentWrap}>
            <Text style={styles.paymentsRecentTitle}>Recent Payments</Text>
            {recentPayments.map((payment, index) => (
              <View key={`${payment.transaction_id || payment.adoption_id || 'payment'}-${index}`} style={styles.paymentsRecentItem}>
                <View style={styles.paymentsRecentLeft}>
                  <Text style={styles.paymentsRecentPet} numberOfLines={1}>{payment.pet_name || 'Adopted Pet'}</Text>
                  <Text style={styles.paymentsRecentMeta} numberOfLines={1}>
                    {payment.customer_name || 'Adopter'} • {getPaymentMethodLabel(payment.payment_method)}
                  </Text>
                  {(payment.provider_reference || payment.transaction_id || payment.paymongo_checkout_id) && (
                    <Text style={styles.paymentsRecentRef} numberOfLines={1}>
                      Receipt: {payment.provider_reference || payment.transaction_id || payment.paymongo_checkout_id}
                    </Text>
                  )}
                </View>
                <View style={styles.paymentsRecentRight}>
                  <Text style={styles.paymentsRecentAmount}>{formatCurrency(payment.amount)}</Text>
                  <Text style={styles.paymentsRecentDate}>{formatAdoptionDate(payment.paid_at)}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.paymentsEmptyText}>No paid adoption records yet.</Text>
        )}
      </View>

      {/* Capacity */}
      {shelter && shelter.shelter_capacity > 0 && (
        <View style={styles.capacityCard}>
          <Text style={styles.capacityTitle}>Shelter Capacity</Text>
          <View style={styles.capacityBar}>
            <View
              style={[
                styles.capacityFill,
                {
                  width: `${Math.min((stats.totalPets / shelter.shelter_capacity) * 100, 100)}%`,
                  backgroundColor: stats.totalPets >= shelter.shelter_capacity ? '#EF4444' : COLORS.primary,
                },
              ]}
            />
          </View>
          <Text style={styles.capacityText}>
            {stats.totalPets} / {shelter.shelter_capacity} animals
          </Text>
        </View>
      )}

      {/* Recent Transfers */}
      {transfers.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={styles.recentTitle}>Recent Transfers</Text>
          {transfers.slice(0, 3).map((transfer) => (
            <TransferCard
              key={transfer.id}
              transfer={transfer}
              onRespond={transfer.status === 'pending' ? handleTransferResponse : null}
            />
          ))}
          {transfers.length > 3 && (
            <TouchableOpacity style={styles.viewAllBtn} onPress={() => setActiveTab('transfers')}>
              <Text style={styles.viewAllText}>View All Transfers</Text>
              <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
  };

  // Render pets tab
  const renderPets = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      {Array.isArray(pets) && pets.length > 0 ? (
        pets.map((pet) => <PetCard key={pet.id} pet={pet} onPress={handleEditPet} />)
      ) : (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="paw-off" size={64} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>No Pets Yet</Text>
          <Text style={styles.emptyText}>Your shelter doesn't have any listed pets yet.</Text>
        </View>
      )}
    </ScrollView>
  );

  // Render transfers tab
  const renderTransfers = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      {Array.isArray(transfers) && transfers.length > 0 ? (
        transfers.map((transfer) => (
          <TransferCard
            key={transfer.id}
            transfer={transfer}
            onRespond={transfer.status === 'pending' ? handleTransferResponse : null}
          />
        ))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="swap-horizontal" size={64} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>No Transfers</Text>
          <Text style={styles.emptyText}>No transfer requests for your shelter yet.</Text>
        </View>
      )}
    </ScrollView>
  );

  // =====================================================
  // ADOPTION MANAGEMENT
  // =====================================================

  const filteredAdoptions = adoptions.filter(a => adoptionFilter === 'all' || a.status === adoptionFilter);

  const getAdoptionCount = (status) => {
    if (status === 'all') return adoptions.length;
    return adoptions.filter(a => a.status === status).length;
  };

  const formatAdoptionDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return ''; }
  };

  const formatCurrency = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return 'P0.00';
    return `P${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getDeliveryStatusLabel = (status) => {
    if (!status) return 'Processing';
    const map = {
      pending: 'Processing',
      processing: 'Processing',
      preparing: 'Preparing',
      out_for_delivery: 'On the way',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
    };
    return map[status] || String(status).replace(/_/g, ' ');
  };

  const getNormalizedDeliveryStatus = (status) => {
    if (!status || status === 'pending') return 'processing';
    return status;
  };

  const getPaymentMethodLabel = (method) => {
    if (!method) return 'Manual';
    const normalized = String(method).toLowerCase();
    if (normalized === 'paymongo') return 'PayMongo';
    if (normalized === 'cod') return 'Cash on Delivery';
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  const handleOpenReceipt = useCallback((app) => {
    setSelectedReceipt({
      reference: app.provider_reference || app.transaction_id || app.paymongo_checkout_id || 'N/A',
      method: getPaymentMethodLabel(app.payment_method || (app.paymongo_checkout_id ? 'paymongo' : 'manual')),
      amount: formatCurrency(app.payment_amount || app.adoption_fee || 0),
      paidAt: formatAdoptionDate(app.transaction_paid_at || app.payment_date),
      provider: app.payment_provider || (app.paymongo_checkout_id ? 'paymongo' : 'internal'),
      appId: app.id,
      pet: app.pet,
      applicant: app.applicant,
    });
    setReceiptModalVisible(true);
  }, [formatCurrency]);

  const handleCopyReceiptReference = useCallback(async () => {
    if (!selectedReceipt?.reference || selectedReceipt.reference === 'N/A') {
      Alert.alert('Receipt', 'No receipt reference available to copy.');
      return;
    }

    try {
      await Clipboard.setStringAsync(String(selectedReceipt.reference));
      Alert.alert('Copied', 'Receipt reference copied to clipboard.');
    } catch (error) {
      Alert.alert('Copy Failed', 'Unable to copy receipt reference right now.');
    }
  }, [selectedReceipt]);

  // Approve adoption
  const handleApproveAdoption = useCallback((app) => {
    Alert.alert(
      'Approve Application',
      `Approve adoption for ${app.pet} by ${app.applicant}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              await shelterService.updateAdoptionStatus(app.id, 'approved');
              setAdoptions(prev => prev.map(a => a.id === app.id ? { ...a, status: 'approved', approved_at: new Date().toISOString() } : a));
              Alert.alert('Success', `${app.pet} adoption has been approved! The applicant will be notified.`);
            } catch (error) {
              Alert.alert('Error', error?.message || 'Failed to approve application');
            }
          },
        },
      ]
    );
  }, []);

  // Open reject modal
  const handleRejectAdoption = useCallback((app) => {
    setSelectedAdoption(app);
    setRejectionReason('');
    setAdoptionRejectVisible(true);
  }, []);

  // Submit rejection
  const submitAdoptionRejection = useCallback(async () => {
    if (!selectedAdoption) return;
    setAdoptionProcessing(true);
    try {
      await shelterService.updateAdoptionStatus(selectedAdoption.id, 'rejected', null, rejectionReason || 'Application not approved');
      setAdoptions(prev => prev.map(a => a.id === selectedAdoption.id ? { ...a, status: 'rejected' } : a));
      setAdoptionRejectVisible(false);
      Alert.alert('Done', 'Application rejected');
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to reject application');
    } finally {
      setAdoptionProcessing(false);
    }
  }, [selectedAdoption, rejectionReason]);

  // View adoption details
  const handleViewAdoptionDetails = useCallback((app) => {
    setSelectedAdoption(app);
    setAdoptionDetailVisible(true);
  }, []);

  // Confirm payment
  const handleConfirmAdoptionPayment = useCallback((app) => {
    Alert.alert(
      'Confirm Payment',
      `Mark payment as completed for ${app.pet}'s adoption by ${app.applicant}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await shelterService.confirmAdoptionPayment(app.id);
              setAdoptions(prev => prev.map(a => a.id === app.id ? {
                ...a,
                payment_completed: true,
                delivery_status: getNormalizedDeliveryStatus(a.delivery_status),
              } : a));
              fetchData(false);
              Alert.alert('Success', 'Payment has been confirmed!');
            } catch (error) {
              Alert.alert('Error', error?.message || 'Failed to confirm payment');
            }
          },
        },
      ]
    );
  }, [fetchData]);

  const handleVerifyOnlinePayment = useCallback(async (app) => {
    try {
      setVerifyingPaymentId(app.id);
      const result = await shelterService.verifyAdoptionPayment(app.id);
      if (result?.success === false) {
        Alert.alert('Not Yet Paid', result?.message || 'Payment is still pending. Please check again shortly.');
      } else {
        Alert.alert('Success', 'Payment status checked successfully.');
      }
      fetchData(false);
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to verify payment status');
    } finally {
      setVerifyingPaymentId(null);
    }
  }, [fetchData]);

  // Update delivery status
  const handleUpdateDelivery = useCallback((app, newStatus) => {
    const statusLabels = {
      processing: 'Processing',
      preparing: 'Preparing',
      out_for_delivery: 'Out for Delivery',
      delivered: 'Delivered',
    };
    Alert.alert(
      'Update Delivery',
      `Set delivery status to "${statusLabels[newStatus]}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            try {
              await shelterService.updateDeliveryStatus(app.id, newStatus);
              setAdoptions(prev => prev.map(a => a.id === app.id ? { ...a, delivery_status: newStatus } : a));
              fetchData(false);
              Alert.alert('Success', `Delivery status updated to ${statusLabels[newStatus]}`);
            } catch (error) {
              Alert.alert('Error', error?.message || 'Failed to update delivery');
            }
          },
        },
      ]
    );
  }, [fetchData]);

  // Compute stats
  const stats = {
    totalPets: Array.isArray(pets) ? pets.length : 0,
    availablePets: Array.isArray(pets) ? pets.filter(p => p.status === 'available').length : 0,
    adoptedPets: Array.isArray(pets) ? pets.filter(p => p.status === 'adopted').length : 0,
    pendingTransfers: Array.isArray(transfers) ? transfers.filter(t => t.status === 'pending').length : 0,
    pendingAdoptions: Array.isArray(adoptions) ? adoptions.filter(a => a.status === 'pending').length : 0,
  };

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading shelter dashboard...</Text>
      </View>
    );
  }

  // Render adoptions tab
  const renderAdoptions = () => {
    const adoptionFilters = [
      { key: 'all', label: 'All', icon: 'apps' },
      { key: 'pending', label: 'Pending', icon: 'time' },
      { key: 'approved', label: 'Approved', icon: 'checkmark-circle' },
      { key: 'rejected', label: 'Rejected', icon: 'close-circle' },
    ];

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.adFilterRow} contentContainerStyle={styles.adFilterContent}>
          {adoptionFilters.map(f => {
            const isActive = adoptionFilter === f.key;
            const count = getAdoptionCount(f.key);
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.adChip, isActive && styles.adChipActive]}
                onPress={() => setAdoptionFilter(f.key)}
                activeOpacity={0.7}
              >
                <Ionicons name={f.icon} size={14} color={isActive ? '#FFF' : COLORS.textMedium} />
                <Text style={[styles.adChipText, isActive && styles.adChipTextActive]}>{f.label}</Text>
                {count > 0 && (
                  <View style={[styles.adChipCount, isActive && styles.adChipCountActive]}>
                    <Text style={[styles.adChipCountText, isActive && styles.adChipCountTextActive]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Results count */}
        <Text style={styles.adResultsText}>{filteredAdoptions.length} application{filteredAdoptions.length !== 1 ? 's' : ''}</Text>

        {/* Application cards */}
        {filteredAdoptions.length > 0 ? (
          filteredAdoptions.map((app, index) => {
            const statusConfig = ADOPTION_STATUS[app.status] || ADOPTION_STATUS.pending;
            const petImg = app.pet_image ? getImageUrl(app.pet_image) : null;
            const deliveryStatus = getNormalizedDeliveryStatus(app.delivery_status);

            return (
              <View key={`${app.id}-${index}`} style={styles.adCard}>
                {/* Card Header */}
                <View style={styles.adCardHeader}>
                  {petImg ? (
                    <Image source={{ uri: petImg }} style={styles.adPetImg} />
                  ) : (
                    <View style={[styles.adPetImg, styles.adPetImgPlaceholder]}>
                      <Ionicons name="paw" size={20} color={COLORS.textLight} />
                    </View>
                  )}
                  <View style={styles.adPetInfo}>
                    <Text style={styles.adPetName} numberOfLines={1}>{app.pet}</Text>
                    <View style={styles.adApplicantRow}>
                      <Ionicons name="person-outline" size={13} color={COLORS.textMedium} />
                      <Text style={styles.adApplicantName} numberOfLines={1}>{app.applicant}</Text>
                    </View>
                    <View style={styles.adApplicantRow}>
                      <Ionicons name="calendar-outline" size={13} color={COLORS.textLight} />
                      <Text style={styles.adDateText}>{formatAdoptionDate(app.submitted_at)}</Text>
                    </View>
                  </View>
                  <View style={[styles.adStatusBadge, { backgroundColor: statusConfig.bg }]}>
                    <Ionicons name={statusConfig.icon} size={13} color={statusConfig.color} />
                    <Text style={[styles.adStatusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                  </View>
                </View>

                {/* Pending: Action buttons */}
                {app.status === 'pending' && (
                  <View style={styles.adActions}>
                    <TouchableOpacity style={styles.adViewBtn} onPress={() => handleViewAdoptionDetails(app)} activeOpacity={0.7}>
                      <Ionicons name="eye" size={16} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.adRejectBtn} onPress={() => handleRejectAdoption(app)} activeOpacity={0.7}>
                      <Ionicons name="close" size={16} color="#FFF" />
                      <Text style={styles.adActionBtnText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.adApproveBtn} onPress={() => handleApproveAdoption(app)} activeOpacity={0.7}>
                      <Ionicons name="checkmark" size={16} color="#FFF" />
                      <Text style={styles.adActionBtnText}>Approve</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Approved: Payment & delivery management */}
                {app.status === 'approved' && (
                  <View style={styles.adApprovedSection}>
                    {app.payment_completed ? (
                      <View style={styles.adPaymentDone}>
                        <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                        <Text style={styles.adPaymentDoneText}>Payment Confirmed</Text>
                        <View style={[styles.adDeliveryBadge, { backgroundColor: deliveryStatus === 'delivered' ? '#D1FAE5' : '#FEF3C7' }]}>
                          <Text style={[styles.adDeliveryBadgeText, { color: deliveryStatus === 'delivered' ? '#22C55E' : '#F59E0B' }]}>
                            {getDeliveryStatusLabel(deliveryStatus)}
                          </Text>
                        </View>
                      </View>
                    ) : app.paymongo_checkout_id ? (
                      <View style={styles.adPaymentVerifying}>
                        <ActivityIndicator size="small" color="#2563EB" />
                        <View style={styles.adPaymentVerifyingTextWrap}>
                          <Text style={styles.adPaymentVerifyingText}>Payment Verifying</Text>
                          <Text style={styles.adPaymentVerifyingSubtext}>User completed online checkout. Waiting for final confirmation.</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.adPaymentPending}>
                        <Ionicons name="hourglass-outline" size={16} color="#F59E0B" />
                        <Text style={styles.adPaymentPendingText}>Awaiting Payment</Text>
                      </View>
                    )}

                    {/* Payment confirmation button */}
                    {!app.payment_completed && !app.paymongo_checkout_id && (
                      <TouchableOpacity style={styles.adConfirmPayBtn} onPress={() => handleConfirmAdoptionPayment(app)} activeOpacity={0.7}>
                        <Ionicons name="card" size={16} color="#FFF" />
                        <Text style={styles.adConfirmPayBtnText}>Confirm Payment</Text>
                      </TouchableOpacity>
                    )}

                    {!app.payment_completed && app.paymongo_checkout_id && (
                      <TouchableOpacity
                        style={[styles.adConfirmPayBtn, verifyingPaymentId === app.id && { opacity: 0.7 }]}
                        onPress={() => handleVerifyOnlinePayment(app)}
                        activeOpacity={0.7}
                        disabled={verifyingPaymentId === app.id}
                      >
                        {verifyingPaymentId === app.id ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <>
                            <Ionicons name="refresh" size={16} color="#FFF" />
                            <Text style={styles.adConfirmPayBtnText}>Check Payment Status</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}

                    {/* Delivery status buttons */}
                    {app.payment_completed && deliveryStatus !== 'delivered' && (
                      <View style={styles.adDeliveryActions}>
                        {deliveryStatus === 'processing' && (
                          <TouchableOpacity style={styles.adDeliveryBtn} onPress={() => handleUpdateDelivery(app, 'preparing')} activeOpacity={0.7}>
                            <Ionicons name="cube-outline" size={14} color="#FFF" />
                            <Text style={styles.adDeliveryBtnText}>Mark Preparing</Text>
                          </TouchableOpacity>
                        )}
                        {deliveryStatus === 'preparing' && (
                          <TouchableOpacity style={styles.adDeliveryBtn} onPress={() => handleUpdateDelivery(app, 'out_for_delivery')} activeOpacity={0.7}>
                            <Ionicons name="car-outline" size={14} color="#FFF" />
                            <Text style={styles.adDeliveryBtnText}>Out for Delivery</Text>
                          </TouchableOpacity>
                        )}
                        {deliveryStatus === 'out_for_delivery' && (
                          <TouchableOpacity style={[styles.adDeliveryBtn, { backgroundColor: '#22C55E' }]} onPress={() => handleUpdateDelivery(app, 'delivered')} activeOpacity={0.7}>
                            <Ionicons name="checkmark-done" size={14} color="#FFF" />
                            <Text style={styles.adDeliveryBtnText}>Mark Delivered</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {/* View details + delivery address */}
                    <View style={styles.adApprovedFooter}>
                      <TouchableOpacity style={styles.adViewBtn} onPress={() => handleViewAdoptionDetails(app)} activeOpacity={0.7}>
                        <Ionicons name="eye-outline" size={16} color="#3B82F6" />
                      </TouchableOpacity>
                      {(app.provider_reference || app.transaction_id || app.paymongo_checkout_id) && (
                        <View style={styles.adReceiptInfo}>
                          <Ionicons name="receipt-outline" size={13} color={COLORS.textLight} />
                          <Text style={styles.adReceiptInfoText} numberOfLines={1}>
                            Receipt: {app.provider_reference || app.transaction_id || app.paymongo_checkout_id}
                          </Text>
                          <TouchableOpacity style={styles.adReceiptViewBtn} onPress={() => handleOpenReceipt(app)}>
                            <Text style={styles.adReceiptViewBtnText}>View</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      {app.delivery_full_name && (
                        <View style={styles.adDeliveryInfo}>
                          <Ionicons name="location-outline" size={13} color={COLORS.textLight} />
                          <Text style={styles.adDeliveryInfoText} numberOfLines={1}>
                            {app.delivery_address || app.delivery_city || 'Delivery address set'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Rejected message */}
                {app.status === 'rejected' && (
                  <View style={styles.adRejectedRow}>
                    <View style={styles.adRejectedMsg}>
                      <Ionicons name="close-circle" size={16} color="#EF4444" />
                      <Text style={styles.adRejectedText}>Application rejected</Text>
                    </View>
                    <TouchableOpacity style={styles.adViewBtn} onPress={() => handleViewAdoptionDetails(app)} activeOpacity={0.7}>
                      <Ionicons name="eye-outline" size={16} color="#3B82F6" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="heart-outline" size={64} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>No Applications</Text>
            <Text style={styles.emptyText}>
              {adoptionFilter === 'all'
                ? 'No adoption applications for your shelter pets yet.'
                : `No ${adoptionFilter} applications.`}
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.bgDecorWrap}>
        <View style={[styles.bgOrb, styles.bgOrbOne]} />
        <View style={[styles.bgOrb, styles.bgOrbTwo]} />
      </View>

      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onGoBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textDark} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Shelter Manager</Text>
          {shelter?.name && <Text style={styles.headerSubtitle}>{shelter.name}</Text>}
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={() => fetchData(false)} activeOpacity={0.7}>
          {refreshing ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons name="sync-outline" size={18} color={COLORS.primary} />
          )}
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const badgeCount = tab.id === 'transfers' ? stats.pendingTransfers : tab.id === 'adoptions' ? stats.pendingAdoptions : 0;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {badgeCount > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
                </View>
              )}
              {isActive && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'pets' && renderPets()}
        {activeTab === 'adoptions' && renderAdoptions()}
        {activeTab === 'transfers' && renderTransfers()}
      </View>

      {/* Edit Shelter Modal */}
      <EditShelterModal
        visible={editModalVisible}
        shelter={shelter}
        onClose={() => setEditModalVisible(false)}
        onSave={handleSaveShelter}
        saving={savingShelter}
      />

      {/* Edit Pet Modal */}
      <EditPetModal
        visible={editPetModalVisible}
        pet={selectedPet}
        onClose={() => { setEditPetModalVisible(false); setSelectedPet(null); }}
        onSave={handleSavePet}
        saving={savingPet}
      />

      {/* Adoption Detail Modal */}
      <Modal visible={adoptionDetailVisible} animationType="slide" onRequestClose={() => setAdoptionDetailVisible(false)}>
        <View style={styles.editModalContainer}>
          <View style={styles.editModalHeader}>
            <TouchableOpacity style={styles.editModalCloseBtn} onPress={() => setAdoptionDetailVisible(false)}>
              <Ionicons name="close" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
            <Text style={styles.editModalTitle}>Application Details</Text>
            <View style={{ width: 70 }} />
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.editFormContent}>
            {selectedAdoption && (
              <>
                {/* Pet & Applicant Info */}
                <View style={styles.editSectionWrap}>
                  <Text style={styles.editSectionTitle}>Pet Information</Text>
                  <View style={styles.adDetailRow}>
                    <Text style={styles.adDetailLabel}>Pet Name</Text>
                    <Text style={styles.adDetailValue}>{selectedAdoption.pet}</Text>
                  </View>
                  <View style={styles.adDetailRow}>
                    <Text style={styles.adDetailLabel}>Breed</Text>
                    <Text style={styles.adDetailValue}>{selectedAdoption.pet_breed || 'N/A'}</Text>
                  </View>
                  {selectedAdoption.adoption_fee != null && (
                    <View style={styles.adDetailRow}>
                      <Text style={styles.adDetailLabel}>Adoption Fee</Text>
                      <Text style={[styles.adDetailValue, { color: COLORS.primary, fontWeight: '700' }]}>
                        ₱{Number(selectedAdoption.adoption_fee).toLocaleString()}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.editSectionWrap}>
                  <Text style={styles.editSectionTitle}>Applicant</Text>
                  <View style={styles.adDetailRow}>
                    <Text style={styles.adDetailLabel}>Name</Text>
                    <Text style={styles.adDetailValue}>{selectedAdoption.applicant}</Text>
                  </View>
                  <View style={styles.adDetailRow}>
                    <Text style={styles.adDetailLabel}>Email</Text>
                    <Text style={styles.adDetailValue}>{selectedAdoption.applicant_email || 'N/A'}</Text>
                  </View>
                  <View style={styles.adDetailRow}>
                    <Text style={styles.adDetailLabel}>Phone</Text>
                    <Text style={styles.adDetailValue}>{selectedAdoption.applicant_phone || 'N/A'}</Text>
                  </View>
                </View>

                {(selectedAdoption.payment_completed || selectedAdoption.payment_amount != null) && (
                  <View style={styles.editSectionWrap}>
                    <Text style={styles.editSectionTitle}>Payment & Receipt</Text>
                    <View style={styles.adDetailRow}>
                      <Text style={styles.adDetailLabel}>Payment Status</Text>
                      <Text style={styles.adDetailValue}>{selectedAdoption.payment_completed ? 'Confirmed' : 'Pending'}</Text>
                    </View>
                    <View style={styles.adDetailRow}>
                      <Text style={styles.adDetailLabel}>Amount</Text>
                      <Text style={styles.adDetailValue}>{formatCurrency(selectedAdoption.payment_amount || selectedAdoption.adoption_fee || 0)}</Text>
                    </View>
                    <View style={styles.adDetailRow}>
                      <Text style={styles.adDetailLabel}>Method</Text>
                      <Text style={styles.adDetailValue}>{getPaymentMethodLabel(selectedAdoption.payment_method || (selectedAdoption.paymongo_checkout_id ? 'paymongo' : 'manual'))}</Text>
                    </View>
                    <View style={styles.adDetailRow}>
                      <Text style={styles.adDetailLabel}>Receipt Reference</Text>
                      <Text style={styles.adDetailValue}>
                        {selectedAdoption.provider_reference || selectedAdoption.transaction_id || selectedAdoption.paymongo_checkout_id || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.adDetailRow}>
                      <Text style={styles.adDetailLabel}>Paid At</Text>
                      <Text style={styles.adDetailValue}>
                        {formatAdoptionDate(selectedAdoption.transaction_paid_at || selectedAdoption.payment_date)}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Living Situation */}
                <View style={styles.editSectionWrap}>
                  <Text style={styles.editSectionTitle}>Living Situation</Text>
                  <View style={styles.adDetailRow}>
                    <Text style={styles.adDetailLabel}>Living Situation</Text>
                    <Text style={styles.adDetailValue}>{selectedAdoption.living_situation || 'N/A'}</Text>
                  </View>
                  <View style={styles.adDetailRow}>
                    <Text style={styles.adDetailLabel}>Has Yard</Text>
                    <Text style={styles.adDetailValue}>{selectedAdoption.has_yard ? 'Yes' : 'No'}</Text>
                  </View>
                  {selectedAdoption.has_yard && (
                    <View style={styles.adDetailRow}>
                      <Text style={styles.adDetailLabel}>Yard Fenced</Text>
                      <Text style={styles.adDetailValue}>{selectedAdoption.yard_fenced ? 'Yes' : 'No'}</Text>
                    </View>
                  )}
                  <View style={styles.adDetailRow}>
                    <Text style={styles.adDetailLabel}>Rental Allows Pets</Text>
                    <Text style={styles.adDetailValue}>{selectedAdoption.rental_allows_pets ? 'Yes' : 'No'}</Text>
                  </View>
                </View>

                {/* Household */}
                <View style={styles.editSectionWrap}>
                  <Text style={styles.editSectionTitle}>Household</Text>
                  <View style={styles.adDetailRow}>
                    <Text style={styles.adDetailLabel}>Members</Text>
                    <Text style={styles.adDetailValue}>{selectedAdoption.household_members || 'N/A'}</Text>
                  </View>
                  <View style={styles.adDetailRow}>
                    <Text style={styles.adDetailLabel}>Has Children</Text>
                    <Text style={styles.adDetailValue}>{selectedAdoption.has_children ? 'Yes' : 'No'}</Text>
                  </View>
                  {selectedAdoption.has_children && selectedAdoption.children_ages && (
                    <View style={styles.adDetailRow}>
                      <Text style={styles.adDetailLabel}>Children Ages</Text>
                      <Text style={styles.adDetailValue}>{selectedAdoption.children_ages}</Text>
                    </View>
                  )}
                  <View style={styles.adDetailRow}>
                    <Text style={styles.adDetailLabel}>Has Other Pets</Text>
                    <Text style={styles.adDetailValue}>{selectedAdoption.has_other_pets ? 'Yes' : 'No'}</Text>
                  </View>
                  {selectedAdoption.has_other_pets && selectedAdoption.other_pets_details && (
                    <View style={styles.adDetailRow}>
                      <Text style={styles.adDetailLabel}>Other Pets Details</Text>
                      <Text style={styles.adDetailValue}>{selectedAdoption.other_pets_details}</Text>
                    </View>
                  )}
                </View>

                {/* Experience */}
                <View style={styles.editSectionWrap}>
                  <Text style={styles.editSectionTitle}>Experience & Motivation</Text>
                  <View style={styles.adDetailRow}>
                    <Text style={styles.adDetailLabel}>Pet Experience</Text>
                    <Text style={styles.adDetailValue}>{selectedAdoption.previous_pet_experience || 'N/A'}</Text>
                  </View>
                  <View style={styles.adDetailRow}>
                    <Text style={styles.adDetailLabel}>Work Schedule</Text>
                    <Text style={styles.adDetailValue}>{selectedAdoption.work_schedule || 'N/A'}</Text>
                  </View>
                  <View style={styles.adDetailRow}>
                    <Text style={styles.adDetailLabel}>Reason for Adoption</Text>
                    <Text style={styles.adDetailValue}>{selectedAdoption.reason_for_adoption || 'N/A'}</Text>
                  </View>
                </View>

                {/* Emergency Contact */}
                <View style={styles.editSectionWrap}>
                  <Text style={styles.editSectionTitle}>Emergency Contact</Text>
                  <View style={styles.adDetailRow}>
                    <Text style={styles.adDetailLabel}>Name</Text>
                    <Text style={styles.adDetailValue}>{selectedAdoption.emergency_contact_name || 'N/A'}</Text>
                  </View>
                  <View style={styles.adDetailRow}>
                    <Text style={styles.adDetailLabel}>Phone</Text>
                    <Text style={styles.adDetailValue}>{selectedAdoption.emergency_contact_phone || 'N/A'}</Text>
                  </View>
                </View>

                {/* Vet Info */}
                {(selectedAdoption.veterinarian_name || selectedAdoption.veterinarian_phone) && (
                  <View style={styles.editSectionWrap}>
                    <Text style={styles.editSectionTitle}>Veterinarian</Text>
                    <View style={styles.adDetailRow}>
                      <Text style={styles.adDetailLabel}>Name</Text>
                      <Text style={styles.adDetailValue}>{selectedAdoption.veterinarian_name || 'N/A'}</Text>
                    </View>
                    <View style={styles.adDetailRow}>
                      <Text style={styles.adDetailLabel}>Phone</Text>
                      <Text style={styles.adDetailValue}>{selectedAdoption.veterinarian_phone || 'N/A'}</Text>
                    </View>
                  </View>
                )}

                {/* Additional Notes */}
                {selectedAdoption.additional_notes && (
                  <View style={styles.editSectionWrap}>
                    <Text style={styles.editSectionTitle}>Additional Notes</Text>
                    <Text style={styles.adDetailValue}>{selectedAdoption.additional_notes}</Text>
                  </View>
                )}

                <View style={{ height: 40 }} />
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Adoption Rejection Modal */}
      <Modal visible={adoptionRejectVisible} transparent animationType="fade" onRequestClose={() => setAdoptionRejectVisible(false)}>
        <View style={styles.adRejectOverlay}>
          <View style={styles.adRejectSheet}>
            <Text style={styles.adRejectTitle}>Reject Application</Text>
            <Text style={styles.adRejectSubtitle}>
              {selectedAdoption ? `Rejecting ${selectedAdoption.applicant}'s application for ${selectedAdoption.pet}` : ''}
            </Text>
            <TextInput
              style={styles.adRejectInput}
              placeholder="Reason for rejection (optional)"
              placeholderTextColor={COLORS.textLight}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={styles.adRejectButtons}>
              <TouchableOpacity
                style={styles.adRejectCancelBtn}
                onPress={() => setAdoptionRejectVisible(false)}
                disabled={adoptionProcessing}
              >
                <Text style={styles.adRejectCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.adRejectSubmitBtn, adoptionProcessing && { opacity: 0.5 }]}
                onPress={submitAdoptionRejection}
                disabled={adoptionProcessing}
              >
                {adoptionProcessing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.adRejectSubmitText}>Reject</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Receipt Modal */}
      <Modal visible={receiptModalVisible} transparent animationType="fade" onRequestClose={() => setReceiptModalVisible(false)}>
        <View style={styles.adRejectOverlay}>
          <View style={styles.receiptSheet}>
            <Text style={styles.adRejectTitle}>Payment Receipt</Text>
            {!!selectedReceipt?.pet && (
              <Text style={styles.adRejectSubtitle}>
                {selectedReceipt.pet} • {selectedReceipt.applicant || 'Adopter'}
              </Text>
            )}

            <View style={styles.adDetailRow}>
              <Text style={styles.adDetailLabel}>Reference</Text>
              <Text style={styles.adDetailValue}>{selectedReceipt?.reference || 'N/A'}</Text>
            </View>
            <View style={styles.adDetailRow}>
              <Text style={styles.adDetailLabel}>Method</Text>
              <Text style={styles.adDetailValue}>{selectedReceipt?.method || 'N/A'}</Text>
            </View>
            <View style={styles.adDetailRow}>
              <Text style={styles.adDetailLabel}>Provider</Text>
              <Text style={styles.adDetailValue}>{selectedReceipt?.provider || 'N/A'}</Text>
            </View>
            <View style={styles.adDetailRow}>
              <Text style={styles.adDetailLabel}>Amount</Text>
              <Text style={styles.adDetailValue}>{selectedReceipt?.amount || 'N/A'}</Text>
            </View>
            <View style={styles.adDetailRow}>
              <Text style={styles.adDetailLabel}>Paid At</Text>
              <Text style={styles.adDetailValue}>{selectedReceipt?.paidAt || 'N/A'}</Text>
            </View>

            <View style={styles.adRejectButtons}>
              <TouchableOpacity style={styles.adRejectCancelBtn} onPress={() => setReceiptModalVisible(false)}>
                <Text style={styles.adRejectCancelText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.receiptCopyBtn} onPress={handleCopyReceiptReference}>
                <Ionicons name="copy-outline" size={15} color="#FFF" />
                <Text style={styles.receiptCopyBtnText}>Copy Ref</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F8F4',
  },
  bgDecorWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  bgOrb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.4,
  },
  bgOrbOne: {
    width: 250,
    height: 250,
    top: -110,
    right: -90,
    backgroundColor: '#CAEED7',
  },
  bgOrbTwo: {
    width: 220,
    height: 220,
    bottom: -90,
    left: -90,
    backgroundColor: '#FFE8BE',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 14,
    color: COLORS.textMedium,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : StatusBar.currentHeight + 12,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: 'transparent',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5ECE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F2518',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#5D7262',
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E8F6EE',
    borderWidth: 1,
    borderColor: '#D2E8DA',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 6,
    gap: 8,
    backgroundColor: 'transparent',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4ECE4',
    position: 'relative',
    overflow: 'hidden',
  },
  tabActive: {
    backgroundColor: '#EAF7EF',
    borderColor: '#CBE7D5',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5D7262',
  },
  tabLabelActive: {
    color: '#138A4A',
  },
  tabBadge: {
    position: 'absolute',
    top: 4,
    right: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    minWidth: 18,
    maxWidth: 28,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFF',
  },
  tabIndicator: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 0,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: '#169C53',
  },

  // Content
  contentContainer: {
    flex: 1,
  },
  tabContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },

  // Shelter info card
  shelterInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E5EDE5',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  shelterCoverImage: {
    width: '100%',
    height: 140,
    backgroundColor: COLORS.backgroundLight || '#F0F0F0',
  },
  shelterCoverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  shelterCoverPlaceholderText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 4,
  },
  shelterInfoBody: {
    padding: SPACING.lg,
  },
  shelterInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shelterLogoImage: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.backgroundLight || '#F0F0F0',
  },
  shelterLogoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '12',
  },
  shelterInfoText: {
    flex: 1,
  },
  shelterInfoName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F2518',
  },
  shelterInfoLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  shelterInfoCity: {
    fontSize: 13,
    color: COLORS.textMedium,
  },
  shelterInfoDesc: {
    fontSize: 14,
    color: '#4B6051',
    lineHeight: 22,
    marginTop: SPACING.md,
  },
  editShelterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#169C53',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    marginTop: SPACING.lg,
    gap: 8,
    elevation: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  editShelterBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: SPACING.lg,
  },
  statCard: {
    width: (SCREEN_WIDTH - SPACING.lg * 2 - 10) / 2,
    borderRadius: 16,
    padding: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5EDE5',
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statTextWrap: {
    marginLeft: 10,
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F2518',
  },
  statLabel: {
    fontSize: 12,
    color: '#5D7262',
    fontWeight: '700',
    marginTop: 2,
  },

  // Capacity
  capacityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E5EDE5',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  capacityTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F2518',
    marginBottom: SPACING.sm,
  },
  capacityBar: {
    height: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },
  capacityFill: {
    height: '100%',
    borderRadius: 5,
  },
  capacityText: {
    fontSize: 12,
    color: COLORS.textMedium,
    fontWeight: '500',
  },

  // Recent section
  recentSection: {
    marginBottom: SPACING.lg,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F2518',
    marginBottom: SPACING.md,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    gap: 6,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Pet card
  petCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#E5EDE5',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  petImage: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.backgroundLight || '#F0F0F0',
  },
  petImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  petInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    justifyContent: 'center',
  },
  petName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F2518',
  },
  petBreed: {
    fontSize: 13,
    color: COLORS.textMedium,
    marginTop: 2,
  },
  petMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: 4,
  },
  petMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  petMetaText: {
    fontSize: 12,
    color: COLORS.textMedium,
    textTransform: 'capitalize',
  },
  petFee: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  petCardRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginLeft: SPACING.sm,
  },
  petStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'center',
  },
  petStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  petStatusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },

  // Transfer card
  transferCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#E5EDE5',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  transferHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  transferTitleWrap: {
    flex: 1,
  },
  transferTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  transferTime: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  transferStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  transferStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  transferDescription: {
    fontSize: 13,
    color: COLORS.textMedium,
    marginTop: SPACING.sm,
    lineHeight: 20,
  },
  transferRequester: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
  },
  requesterAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EFF4EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transferRequesterText: {
    fontSize: 12,
    color: COLORS.textMedium,
  },
  transferActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  transferActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  acceptBtn: {
    backgroundColor: '#22C55E',
  },
  rejectBtn: {
    backgroundColor: '#EF4444',
  },
  transferActionBtnLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F2518',
    marginTop: SPACING.lg,
  },
  emptyText: {
    fontSize: 14,
    color: '#5D7262',
    textAlign: 'center',
    marginTop: SPACING.sm,
  },

  // =====================================================
  // Image Picker Modal Styles
  // =====================================================
  imagePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  imagePickerSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? 34 : SPACING.xl,
  },
  imagePickerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  imagePickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: SPACING.lg,
  },
  imagePickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  imagePickerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  imagePickerOptionText: {
    flex: 1,
  },
  imagePickerOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  imagePickerOptionDesc: {
    fontSize: 12,
    color: COLORS.textMedium,
    marginTop: 2,
  },
  imagePickerCancel: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    marginTop: SPACING.sm,
  },
  imagePickerCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textMedium,
  },

  // =====================================================
  // Edit Shelter Modal Styles
  // =====================================================
  editModalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : StatusBar.currentHeight + 12,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.backgroundWhite || '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.backgroundLight || '#F0F0F0',
  },
  editModalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  editModalSaveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    minWidth: 70,
    alignItems: 'center',
  },
  editModalSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  editFormContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl * 3,
  },
  editSectionWrap: {
    marginBottom: SPACING.xl,
  },
  editSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: SPACING.md,
    letterSpacing: -0.3,
  },
  editCoverWrap: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  editCoverImage: {
    width: '100%',
    height: 180,
    backgroundColor: COLORS.backgroundLight || '#F0F0F0',
    borderRadius: RADIUS.lg,
  },
  editCoverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  editCoverPlaceholderText: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: SPACING.sm,
  },
  editCoverOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.md,
    alignItems: 'flex-end',
  },
  editCoverBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  editCoverBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  editLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  editLogoWrap: {
    position: 'relative',
  },
  editLogoImage: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: COLORS.backgroundLight || '#F0F0F0',
  },
  editLogoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  editLogoCameraBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  editLogoHint: {
    flex: 1,
  },
  editLogoHintTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  editLogoHintText: {
    fontSize: 12,
    color: COLORS.textMedium,
    lineHeight: 18,
  },
  editFieldWrap: {
    marginBottom: SPACING.md,
  },
  editFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMedium,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editFieldInput: {
    backgroundColor: COLORS.backgroundWhite || '#FFF',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 15,
    color: COLORS.textDark,
  },
  editFieldMultiline: {
    minHeight: 100,
    paddingTop: SPACING.md,
  },

  // =====================================================
  // Edit Pet Modal Styles
  // =====================================================
  epPhotoWrap: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  epPhotoImage: {
    width: '100%',
    height: 200,
    backgroundColor: COLORS.backgroundLight || '#F0F0F0',
    borderRadius: RADIUS.lg,
  },
  epPhotoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  epButtonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  epButtonOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.backgroundWhite || '#FFF',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  epButtonOptionActive: {
    backgroundColor: COLORS.primary + '15',
    borderColor: COLORS.primary,
  },
  epButtonOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMedium,
  },
  epButtonOptionTextActive: {
    color: COLORS.primary,
  },
  epToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  epToggleLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textDark,
  },
  epToggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  epToggleTrackActive: {
    backgroundColor: COLORS.primary,
  },
  epToggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  epToggleThumbActive: {
    alignSelf: 'flex-end',
  },
  epRow: {
    flexDirection: 'row',
    gap: 12,
  },
  epHalf: {
    flex: 1,
  },

  // =====================================================
  // Adoption Tab Styles
  // =====================================================
  adFilterRow: {
    marginBottom: SPACING.sm,
    marginHorizontal: -4,
  },
  adFilterContent: {
    gap: 8,
    paddingHorizontal: 4,
  },
  adChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5EDE5',
    gap: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  adChipActive: {
    backgroundColor: '#169C53',
    borderColor: '#169C53',
  },
  adChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMedium,
  },
  adChipTextActive: {
    color: '#FFF',
  },
  adChipCount: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  adChipCountActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  adChipCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMedium,
  },
  adChipCountTextActive: {
    color: '#FFF',
  },
  adResultsText: {
    fontSize: 12,
    color: '#5D7262',
    marginBottom: SPACING.md,
    fontWeight: '600',
  },
  adCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#E5EDE5',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  adCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  adPetImg: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.backgroundLight || '#F0F0F0',
  },
  adPetImgPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  adPetInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  adPetName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F2518',
  },
  adApplicantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  adApplicantName: {
    fontSize: 13,
    color: COLORS.textMedium,
  },
  adDateText: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  adStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  adStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  adActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  adViewBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EAF3FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adRejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: '#EF4444',
    gap: 4,
  },
  adApproveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: '#169C53',
    gap: 4,
  },
  adActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  adApprovedSection: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  adPaymentDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  adPaymentDoneText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#22C55E',
    flex: 1,
  },
  adDeliveryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  adDeliveryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  adPaymentPending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 8,
  },
  adPaymentPendingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  adPaymentVerifying: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  adPaymentVerifyingTextWrap: {
    flex: 1,
  },
  adPaymentVerifyingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  adPaymentVerifyingSubtext: {
    fontSize: 11,
    color: '#2563EB',
    marginTop: 1,
  },
  adConfirmPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    marginBottom: 8,
  },
  adConfirmPayBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  adDeliveryActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  adDeliveryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 9,
    borderRadius: 10,
    gap: 4,
  },
  adDeliveryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  adApprovedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adDeliveryInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  adReceiptInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  adReceiptInfoText: {
    fontSize: 12,
    color: COLORS.textLight,
    flex: 1,
  },
  adReceiptViewBtn: {
    marginLeft: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#EAF3FF',
  },
  adReceiptViewBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  adDeliveryInfoText: {
    fontSize: 12,
    color: COLORS.textLight,
    flex: 1,
  },
  adRejectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 8,
  },
  adRejectedMsg: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adRejectedText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },

  // Adoption Detail Modal
  adDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  adDetailLabel: {
    fontSize: 13,
    color: '#5D7262',
    fontWeight: '500',
    flex: 1,
  },
  adDetailValue: {
    fontSize: 13,
    color: '#0F2518',
    fontWeight: '600',
    flex: 1.5,
    textAlign: 'right',
  },

  // Rejection Modal
  adRejectOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  adRejectSheet: {
    backgroundColor: '#FFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 400,
  },
  receiptSheet: {
    backgroundColor: '#FFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 440,
  },
  adRejectTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  adRejectSubtitle: {
    fontSize: 13,
    color: COLORS.textMedium,
    marginBottom: SPACING.lg,
  },
  adRejectInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: 14,
    color: COLORS.textDark,
    minHeight: 80,
    marginBottom: SPACING.lg,
  },
  adRejectButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  adRejectCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  adRejectCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMedium,
  },
  adRejectSubmitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  adRejectSubmitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  receiptCopyBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  receiptCopyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },

  // Manager payment overview
  paymentsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E5EDE5',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  paymentsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  paymentsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F2518',
  },
  paymentsBadge: {
    backgroundColor: '#EAF7EF',
    borderWidth: 1,
    borderColor: '#CBE7D5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  paymentsBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#138A4A',
    textTransform: 'uppercase',
  },
  paymentsTotalLabel: {
    fontSize: 12,
    color: '#5D7262',
    marginTop: 4,
  },
  paymentsTotalValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F2518',
    marginTop: 2,
    marginBottom: SPACING.md,
  },
  paymentsMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  paymentsMetricBox: {
    width: (SCREEN_WIDTH - SPACING.lg * 2 - 10 - 32) / 2,
    borderWidth: 1,
    borderColor: '#E7EFE7',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#F9FCF9',
  },
  paymentsMetricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F2518',
  },
  paymentsMetricLabel: {
    fontSize: 11,
    color: '#5D7262',
    marginTop: 3,
    fontWeight: '600',
  },
  paymentsRecentWrap: {
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#EEF3EE',
    paddingTop: SPACING.md,
  },
  paymentsRecentTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F2518',
    marginBottom: 8,
  },
  paymentsRecentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F5F2',
  },
  paymentsRecentLeft: {
    flex: 1,
    marginRight: 8,
  },
  paymentsRecentPet: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F2518',
  },
  paymentsRecentMeta: {
    marginTop: 2,
    fontSize: 11,
    color: '#6D7F71',
  },
  paymentsRecentRef: {
    marginTop: 2,
    fontSize: 11,
    color: '#8A9A8E',
  },
  paymentsRecentRight: {
    alignItems: 'flex-end',
  },
  paymentsRecentAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#169C53',
  },
  paymentsRecentDate: {
    marginTop: 2,
    fontSize: 11,
    color: '#8A9A8E',
  },
  paymentsEmptyText: {
    marginTop: SPACING.md,
    fontSize: 13,
    color: '#6D7F71',
  },
});

export default memo(UserShelterManagerScreen);
