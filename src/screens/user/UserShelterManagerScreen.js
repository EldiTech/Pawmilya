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
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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
  { id: 'transfers', label: 'Transfers', icon: 'swap-horizontal' },
];

// Transfer status colors
const TRANSFER_STATUS = {
  pending: { label: 'Pending', color: '#F59E0B', bg: '#FEF3C7' },
  accepted: { label: 'Accepted', color: '#22C55E', bg: '#D1FAE5' },
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

// Stat card component
const StatCard = memo(({ icon, iconColor, label, value, bgColor }) => (
  <View style={[styles.statCard, { backgroundColor: bgColor || COLORS.backgroundWhite }]}>
    <View style={[styles.statIconWrap, { backgroundColor: iconColor + '15' }]}>
      <Ionicons name={icon} size={22} color={iconColor} />
    </View>
    <Text style={styles.statValue}>{value ?? 0}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
));

// Pet card component
const PetCard = memo(({ pet }) => {
  const statusConfig = PET_STATUS[pet.status] || PET_STATUS.available;
  const imageUrl = pet.image ? getImageUrl(pet.image) : null;

  return (
    <View style={styles.petCard}>
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
              <Ionicons name={pet.gender === 'male' ? 'male' : 'female'} size={12} color={COLORS.primary} />
              <Text style={styles.petMetaText}>{pet.gender}</Text>
            </View>
          )}
          {pet.adoption_fee != null && (
            <Text style={styles.petFee}>₱{pet.adoption_fee}</Text>
          )}
        </View>
      </View>
      <View style={[styles.petStatusBadge, { backgroundColor: statusConfig.bg }]}>
        <Text style={[styles.petStatusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
      </View>
    </View>
  );
});

// Transfer card component
const TransferCard = memo(({ transfer, onRespond }) => {
  const statusConfig = TRANSFER_STATUS[transfer.status] || TRANSFER_STATUS.pending;

  return (
    <View style={styles.transferCard}>
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
          <Ionicons name="person-circle-outline" size={16} color={COLORS.textMedium} />
          <Text style={styles.transferRequesterText}>Requested by {transfer.requester_name}</Text>
        </View>
      )}

      {transfer.status === 'pending' && onRespond && (
        <View style={styles.transferActions}>
          <TouchableOpacity
            style={[styles.transferActionBtn, styles.acceptBtn]}
            onPress={() => onRespond(transfer.id, 'accepted')}
          >
            <Ionicons name="checkmark" size={18} color="#FFF" />
            <Text style={styles.transferActionText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.transferActionBtn, styles.rejectBtn]}
            onPress={() => onRespond(transfer.id, 'rejected')}
          >
            <Ionicons name="close" size={18} color="#FFF" />
            <Text style={styles.transferActionText}>Reject</Text>
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
        aspect: imagePickerTarget === 'logo' ? [1, 1] : [16, 9],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        handleImagePicked(result.assets[0].uri);
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

  // Fetch all data
  const fetchData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      else setRefreshing(true);

      const [shelterData, petsData, transfersData] = await Promise.all([
        shelterService.getManagedShelter().catch(() => null),
        shelterService.getManagedShelterPets().catch(() => ({ data: [] })),
        shelterService.getManagedShelterTransfers().catch(() => ({ data: [] })),
      ]);

      if (shelterData) setShelter(shelterData);
      setPets(petsData?.data || petsData || []);
      setTransfers(transfersData?.data || transfersData || []);
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

  // Handle transfer response
  const handleTransferResponse = useCallback(async (transferId, status) => {
    const action = status === 'accepted' ? 'accept' : 'reject';
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
              Alert.alert('Error', `Failed to ${action} transfer request.`);
            }
          },
        },
      ]
    );
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

  // Compute stats
  const stats = {
    totalPets: Array.isArray(pets) ? pets.length : 0,
    availablePets: Array.isArray(pets) ? pets.filter(p => p.status === 'available').length : 0,
    adoptedPets: Array.isArray(pets) ? pets.filter(p => p.status === 'adopted').length : 0,
    pendingTransfers: Array.isArray(transfers) ? transfers.filter(t => t.status === 'pending').length : 0,
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

  // Render overview tab
  const renderOverview = () => {
    const coverImg = shelter ? getImageUrl(shelter.cover_image || shelter.cover_image_data || shelter.cover_image_url) : null;
    const logoImg = shelter ? getImageUrl(shelter.logo_image || shelter.logo_image_data || shelter.logo_url) : null;

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
        pets.map((pet) => <PetCard key={pet.id} pet={pet} />)
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Shelter Manager</Text>
          <Text style={styles.headerSubtitle}>{shelter?.name || 'My Shelter'}</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={() => fetchData(false)}>
          <Ionicons name="refresh" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon}
              size={18}
              color={activeTab === tab.id ? COLORS.primary : COLORS.textMedium}
            />
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {tab.id === 'transfers' && stats.pendingTransfers > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{stats.pendingTransfers}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'pets' && renderPets()}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.backgroundLight || '#F0F0F0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.backgroundWhite || '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textMedium,
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: 8,
    backgroundColor: COLORS.background,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.backgroundWhite || '#FFF',
    gap: 6,
  },
  tabActive: {
    backgroundColor: COLORS.primary + '15',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMedium,
  },
  tabLabelActive: {
    color: COLORS.primary,
  },
  tabBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
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
    backgroundColor: COLORS.backgroundWhite || '#FFF',
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
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
    color: COLORS.textDark,
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
    color: COLORS.textMedium,
    lineHeight: 22,
    marginTop: SPACING.md,
  },
  editShelterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
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
    fontWeight: '700',
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
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  statIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textMedium,
    fontWeight: '500',
    marginTop: 4,
  },

  // Capacity
  capacityCard: {
    backgroundColor: COLORS.backgroundWhite || '#FFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  capacityTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textDark,
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
    color: COLORS.textDark,
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
    backgroundColor: COLORS.backgroundWhite || '#FFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
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
    fontWeight: '700',
    color: COLORS.textDark,
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
  petStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'center',
  },
  petStatusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },

  // Transfer card
  transferCard: {
    backgroundColor: COLORS.backgroundWhite || '#FFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
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
  transferActionText: {
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
    color: COLORS.textDark,
    marginTop: SPACING.lg,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMedium,
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
});

export default memo(UserShelterManagerScreen);
