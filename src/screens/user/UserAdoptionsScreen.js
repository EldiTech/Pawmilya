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
  RefreshControl,
  Dimensions,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { adoptionService } from '../../services';
import { formatDate, getTimeAgo, getPetImageUrl } from './shared';

const { width } = Dimensions.get('window');

const STATUS_FILTERS = [
  { id: 'all', label: 'All', icon: 'layers-outline', count: 0 },
  { id: 'pending', label: 'Pending', icon: 'hourglass-outline', count: 0 },
  { id: 'approved', label: 'Approved', icon: 'checkmark-done-outline', count: 0 },
  { id: 'rejected', label: 'Rejected', icon: 'close-outline', count: 0 },
];

const STATUS_CONFIGS = {
  approved: {
    color: '#059669',
    bgColor: '#D1FAE5',
    lightBg: '#ECFDF5',
    icon: 'checkmark-circle',
    label: 'Approved',
    gradient: ['#10B981', '#059669'],
    emoji: '🎉',
  },
  rejected: {
    color: '#DC2626',
    bgColor: '#FEE2E2',
    lightBg: '#FEF2F2',
    icon: 'close-circle',
    label: 'Rejected',
    gradient: ['#EF4444', '#DC2626'],
    emoji: '😔',
  },
  pending: {
    color: '#D97706',
    bgColor: '#FEF3C7',
    lightBg: '#FFFBEB',
    icon: 'time',
    label: 'Pending',
    gradient: ['#F59E0B', '#D97706'],
    emoji: '⏳',
  },
};

const getStatusConfig = (status) => STATUS_CONFIGS[status?.toLowerCase()] || STATUS_CONFIGS.pending;

// Delivery Status Configuration
const DELIVERY_STATUSES = [
  { id: 'processing', label: 'Processing', icon: 'receipt-outline', description: 'Order received' },
  { id: 'preparing', label: 'Preparing', icon: 'cube-outline', description: 'Pet being prepared' },
  { id: 'out_for_delivery', label: 'On The Way', icon: 'car-outline', description: 'Out for delivery' },
  { id: 'delivered', label: 'Delivered', icon: 'checkmark-done', description: 'Delivered successfully' },
];

const getDeliveryStatusIndex = (status) => {
  const index = DELIVERY_STATUSES.findIndex(s => s.id === status);
  return index === -1 ? 0 : index;
};

// Delivery Timeline Component
const DeliveryTimeline = memo(({ adoption }) => {
  const currentIndex = getDeliveryStatusIndex(adoption.delivery_status);
  const isDelivered = adoption.delivery_status === 'delivered';

  return (
    <View style={styles.timelineContainer}>
      <View style={styles.timelineHeader}>
        <View style={styles.timelineHeaderLeft}>
          <View style={styles.timelineIconWrapper}>
            <Ionicons name="navigate" size={16} color="#FFF" />
          </View>
          <Text style={styles.timelineTitle}>Delivery Status</Text>
        </View>
        {adoption.delivery_scheduled_date && (
          <View style={styles.scheduledDateBadge}>
            <Ionicons name="calendar" size={12} color="#6366F1" />
            <Text style={styles.scheduledDate}>
              {new Date(adoption.delivery_scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.timeline}>
        {DELIVERY_STATUSES.map((status, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          const isLast = index === DELIVERY_STATUSES.length - 1;

          return (
            <View key={status.id} style={styles.timelineStep}>
              {/* Connector Line */}
              {!isLast && (
                <View style={[
                  styles.timelineConnector,
                  isCompleted && index < currentIndex && styles.timelineConnectorCompleted,
                ]} />
              )}

              {/* Step Indicator */}
              <View style={[
                styles.timelineIndicator,
                isCompleted && styles.timelineIndicatorCompleted,
                isCurrent && styles.timelineIndicatorCurrent,
              ]}>
                {isCompleted ? (
                  <Ionicons 
                    name={isCurrent ? status.icon : 'checkmark'} 
                    size={isCurrent ? 16 : 12} 
                    color="#FFF" 
                  />
                ) : (
                  <View style={styles.timelineIndicatorDot} />
                )}
              </View>

              {/* Step Content */}
              <View style={styles.timelineContent}>
                <Text style={[
                  styles.timelineLabel,
                  isCompleted && styles.timelineLabelCompleted,
                  isCurrent && styles.timelineLabelCurrent,
                ]}>
                  {status.label}
                </Text>
                <Text style={[
                  styles.timelineDescription,
                  isCurrent && styles.timelineDescriptionCurrent,
                ]}>
                  {status.description}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Delivery Address Summary */}
      <View style={styles.deliveryAddressBox}>
        <View style={styles.deliveryAddressIcon}>
          <Ionicons name="location" size={14} color="#6366F1" />
        </View>
        <View style={styles.deliveryAddressContent}>
          <Text style={styles.deliveryAddressLabel}>Delivery Address</Text>
          <Text style={styles.deliveryAddressText}>
            {adoption.delivery_full_name} • {adoption.delivery_address}, {adoption.delivery_city}
          </Text>
        </View>
      </View>

      {/* Tracking Notes if any */}
      {adoption.delivery_tracking_notes && (
        <View style={styles.trackingNotesBox}>
          <Ionicons name="chatbubble-ellipses" size={14} color="#8B5CF6" />
          <Text style={styles.trackingNotesText}>{adoption.delivery_tracking_notes}</Text>
        </View>
      )}

      {/* Delivered Success Message */}
      {isDelivered && (
        <View style={styles.deliveredSuccessBox}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.deliveredSuccessGradient}
          >
            <View style={styles.deliveredSuccessIcon}>
              <Ionicons name="heart" size={18} color="#10B981" />
            </View>
            <View style={styles.deliveredSuccessContent}>
              <Text style={styles.deliveredSuccessTitle}>Pet Delivered! 🎉</Text>
              <Text style={styles.deliveredSuccessSubtitle}>
                Welcome your new family member home
              </Text>
            </View>
          </LinearGradient>
        </View>
      )}
    </View>
  );
});

// Payment & Delivery Modal Component
const PaymentDeliveryModal = memo(({ visible, onClose, adoption, onSubmit }) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const adoptionFee = adoption?.adoption_fee || 500;

  const handleSubmit = async () => {
    if (!fullName.trim() || !phone.trim() || !address.trim() || !city.trim()) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        adoptionId: adoption.id,
        deliveryDetails: {
          fullName: fullName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          city: city.trim(),
          postalCode: postalCode.trim(),
          notes: notes.trim(),
        },
        paymentAmount: adoptionFee,
      });
      onClose();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to process payment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          {/* Modal Handle */}
          <View style={styles.modalHandle} />
          
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderContent}>
              <LinearGradient
                colors={[COLORS.primary, COLORS.primary + 'CC']}
                style={styles.modalIconContainer}
              >
                <Ionicons name="paw" size={22} color="#FFF" />
              </LinearGradient>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>Complete Adoption</Text>
                <Text style={styles.modalSubtitle}>Almost there! Just a few more steps</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Pet Info Card */}
            <View style={styles.petInfoCard}>
              <View style={styles.petInfoLeft}>
                <MaterialCommunityIcons name="dog" size={24} color={COLORS.primary} />
                <View>
                  <Text style={styles.petInfoName}>{adoption?.pet_name}</Text>
                  <Text style={styles.petInfoLabel}>Your new companion</Text>
                </View>
              </View>
              <View style={styles.petInfoFee}>
                <Text style={styles.petInfoFeeLabel}>Adoption Fee</Text>
                <Text style={styles.petInfoFeeAmount}>₱{adoptionFee.toLocaleString()}</Text>
              </View>
            </View>

            {/* Delivery Section */}
            <View style={styles.formSection}>
              <View style={styles.formSectionHeader}>
                <View style={styles.formSectionIcon}>
                  <Ionicons name="location" size={16} color="#6366F1" />
                </View>
                <Text style={styles.formSectionTitle}>Delivery Details</Text>
              </View>
              
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter your full name"
                    placeholderTextColor="#94A3B8"
                    value={fullName}
                    onChangeText={setFullName}
                  />
                </View>
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="call-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="09XX XXX XXXX"
                    placeholderTextColor="#94A3B8"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Complete Address</Text>
                <View style={[styles.inputContainer, styles.inputContainerMultiline]}>
                  <Ionicons name="home-outline" size={18} color="#94A3B8" style={[styles.inputIcon, { marginTop: 12 }]} />
                  <TextInput
                    style={[styles.textInput, styles.textInputMultiline]}
                    placeholder="House/Unit No., Street, Barangay"
                    placeholderTextColor="#94A3B8"
                    value={address}
                    onChangeText={setAddress}
                    multiline
                    numberOfLines={2}
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputWrapper, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>City</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.textInput, { paddingLeft: 14 }]}
                      placeholder="City"
                      placeholderTextColor="#94A3B8"
                      value={city}
                      onChangeText={setCity}
                    />
                  </View>
                </View>
                <View style={[styles.inputWrapper, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.inputLabel}>Postal Code</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.textInput, { paddingLeft: 14 }]}
                      placeholder="0000"
                      placeholderTextColor="#94A3B8"
                      value={postalCode}
                      onChangeText={setPostalCode}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Delivery Notes <Text style={styles.inputLabelOptional}>(Optional)</Text></Text>
                <View style={[styles.inputContainer, styles.inputContainerMultiline]}>
                  <Ionicons name="chatbubble-outline" size={18} color="#94A3B8" style={[styles.inputIcon, { marginTop: 12 }]} />
                  <TextInput
                    style={[styles.textInput, styles.textInputMultiline]}
                    placeholder="Landmarks, gate code, special instructions..."
                    placeholderTextColor="#94A3B8"
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={2}
                  />
                </View>
              </View>
            </View>

            {/* Payment Method */}
            <View style={styles.formSection}>
              <View style={styles.formSectionHeader}>
                <View style={[styles.formSectionIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="wallet" size={16} color="#D97706" />
                </View>
                <Text style={styles.formSectionTitle}>Payment Method</Text>
              </View>

              <TouchableOpacity style={styles.paymentOption} activeOpacity={0.8}>
                <View style={styles.paymentOptionLeft}>
                  <View style={styles.paymentOptionIcon}>
                    <Ionicons name="cash" size={20} color="#10B981" />
                  </View>
                  <View>
                    <Text style={styles.paymentOptionTitle}>Cash on Delivery</Text>
                    <Text style={styles.paymentOptionDesc}>Pay when pet arrives</Text>
                  </View>
                </View>
                <View style={styles.paymentOptionCheck}>
                  <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                </View>
              </TouchableOpacity>

              <View style={styles.paymentNote}>
                <Ionicons name="shield-checkmark" size={16} color="#059669" />
                <Text style={styles.paymentNoteText}>
                  Safe & secure. Pay only when you receive your pet.
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            <View style={styles.totalSection}>
              <Text style={styles.totalLabel}>Total Payment</Text>
              <Text style={styles.totalAmount}>₱{adoptionFee.toLocaleString()}</Text>
            </View>
            <TouchableOpacity
              style={[styles.confirmButton, loading && styles.confirmButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={loading ? ['#94A3B8', '#94A3B8'] : [COLORS.primary, '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.confirmButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.confirmButtonText}>Confirm Adoption</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFF" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

// Application Details Modal Component
const ApplicationDetailsModal = memo(({ visible, onClose, adoption }) => {
  const [imageError, setImageError] = useState(false);
  
  if (!adoption) return null;
  
  const statusConfig = getStatusConfig(adoption.status);
  const petImageUrl = getPetImageUrl(adoption.pet_image);
  
  const DetailRow = ({ icon, label, value, iconColor = '#64748B' }) => (
    <View style={styles.detailRow}>
      <View style={[styles.detailIconWrap, { backgroundColor: iconColor + '15' }]}>
        <Ionicons name={icon} size={14} color={iconColor} />
      </View>
      <View style={styles.detailRowContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value || 'Not provided'}</Text>
      </View>
    </View>
  );
  
  const SectionHeader = ({ icon, title, iconBg = '#EEF2FF', iconColor = '#6366F1' }) => (
    <View style={styles.detailSectionHeader}>
      <View style={[styles.detailSectionIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <Text style={styles.detailSectionTitle}>{title}</Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { maxHeight: '95%' }]}>
          <View style={styles.modalHandle} />
          
          {/* Header */}
          <View style={styles.detailModalHeader}>
            <Text style={styles.detailModalTitle}>Application Details</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Pet Card */}
            <View style={styles.detailPetCard}>
              <View style={styles.detailPetImageWrap}>
                {petImageUrl && !imageError ? (
                  <Image
                    source={{ uri: petImageUrl }}
                    style={styles.detailPetImage}
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <View style={[styles.detailPetImage, styles.detailPetImagePlaceholder]}>
                    <MaterialCommunityIcons name="dog" size={40} color="#CBD5E1" />
                  </View>
                )}
                <LinearGradient
                  colors={statusConfig.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.detailStatusBadge}
                >
                  <Ionicons name={statusConfig.icon} size={12} color="#FFF" />
                  <Text style={styles.detailStatusText}>{statusConfig.label}</Text>
                </LinearGradient>
              </View>
              <View style={styles.detailPetInfo}>
                <Text style={styles.detailPetName}>{adoption.pet_name}</Text>
                <View style={styles.detailPetMeta}>
                  <Text style={styles.detailPetMetaText}>{adoption.species}</Text>
                  <View style={styles.detailPetMetaDot} />
                  <Text style={styles.detailPetMetaText}>{adoption.breed}</Text>
                </View>
                {adoption.shelter_name && (
                  <View style={styles.detailPetShelter}>
                    <Ionicons name="business-outline" size={12} color="#94A3B8" />
                    <Text style={styles.detailPetShelterText}>{adoption.shelter_name}</Text>
                  </View>
                )}
                <View style={styles.detailPetDateRow}>
                  <Ionicons name="calendar-outline" size={12} color="#94A3B8" />
                  <Text style={styles.detailPetDateText}>Applied {formatDate(adoption.applied_at)}</Text>
                </View>
              </View>
            </View>

            {/* Rejection Reason if rejected */}
            {adoption.status?.toLowerCase() === 'rejected' && adoption.review_notes && (
              <View style={styles.rejectionBox}>
                <View style={styles.rejectionHeader}>
                  <Ionicons name="alert-circle" size={18} color="#DC2626" />
                  <Text style={styles.rejectionTitle}>Application Not Approved</Text>
                </View>
                <Text style={styles.rejectionReason}>{adoption.review_notes}</Text>
              </View>
            )}

            {/* Living Situation Section */}
            <View style={styles.detailSection}>
              <SectionHeader icon="home" title="Living Situation" iconBg="#DBEAFE" iconColor="#3B82F6" />
              <View style={styles.detailGrid}>
                <DetailRow icon="home-outline" label="Housing Type" value={adoption.living_situation} iconColor="#3B82F6" />
                <DetailRow icon="leaf-outline" label="Has Yard" value={adoption.has_yard ? 'Yes' : 'No'} iconColor="#10B981" />
                {adoption.has_yard && (
                  <DetailRow icon="shield-outline" label="Yard Fenced" value={adoption.yard_fenced ? 'Yes' : 'No'} iconColor="#6366F1" />
                )}
                {adoption.living_situation === 'renting' && (
                  <DetailRow icon="document-text-outline" label="Landlord Allows Pets" value={adoption.rental_allows_pets ? 'Yes' : 'No'} iconColor="#F59E0B" />
                )}
              </View>
            </View>

            {/* Household Section */}
            <View style={styles.detailSection}>
              <SectionHeader icon="people" title="Household" iconBg="#FEF3C7" iconColor="#D97706" />
              <View style={styles.detailGrid}>
                <DetailRow icon="people-outline" label="Household Members" value={adoption.household_members} iconColor="#D97706" />
                <DetailRow icon="happy-outline" label="Has Children" value={adoption.has_children ? 'Yes' : 'No'} iconColor="#EC4899" />
                {adoption.has_children && adoption.children_ages && (
                  <DetailRow icon="calendar-outline" label="Children Ages" value={adoption.children_ages} iconColor="#8B5CF6" />
                )}
              </View>
            </View>

            {/* Other Pets Section */}
            <View style={styles.detailSection}>
              <SectionHeader icon="paw" title="Other Pets" iconBg="#D1FAE5" iconColor="#059669" />
              <View style={styles.detailGrid}>
                <DetailRow icon="paw-outline" label="Has Other Pets" value={adoption.has_other_pets ? 'Yes' : 'No'} iconColor="#059669" />
                {adoption.has_other_pets && adoption.other_pets_details && (
                  <DetailRow icon="list-outline" label="Pet Details" value={adoption.other_pets_details} iconColor="#14B8A6" />
                )}
              </View>
            </View>

            {/* Experience Section */}
            <View style={styles.detailSection}>
              <SectionHeader icon="star" title="Experience & Motivation" iconBg="#FEE2E2" iconColor="#EF4444" />
              {adoption.previous_pet_experience && (
                <View style={styles.experienceBox}>
                  <Text style={styles.experienceLabel}>Previous Pet Experience</Text>
                  <Text style={styles.experienceText}>{adoption.previous_pet_experience}</Text>
                </View>
              )}
              {adoption.reason_for_adoption && (
                <View style={styles.experienceBox}>
                  <Text style={styles.experienceLabel}>Reason for Adoption</Text>
                  <Text style={styles.experienceText}>{adoption.reason_for_adoption}</Text>
                </View>
              )}
              <DetailRow icon="briefcase-outline" label="Work Schedule" value={adoption.work_schedule} iconColor="#6366F1" />
            </View>

            {/* Emergency Contact Section */}
            <View style={styles.detailSection}>
              <SectionHeader icon="call" title="Emergency Contact" iconBg="#FCE7F3" iconColor="#EC4899" />
              <View style={styles.detailGrid}>
                <DetailRow icon="person-outline" label="Contact Name" value={adoption.emergency_contact_name} iconColor="#EC4899" />
                <DetailRow icon="call-outline" label="Contact Phone" value={adoption.emergency_contact_phone} iconColor="#8B5CF6" />
              </View>
            </View>

            {/* Veterinarian Section */}
            {(adoption.veterinarian_name || adoption.veterinarian_phone) && (
              <View style={styles.detailSection}>
                <SectionHeader icon="medkit" title="Veterinarian" iconBg="#CFFAFE" iconColor="#06B6D4" />
                <View style={styles.detailGrid}>
                  <DetailRow icon="medical-outline" label="Vet Name" value={adoption.veterinarian_name} iconColor="#06B6D4" />
                  <DetailRow icon="call-outline" label="Vet Phone" value={adoption.veterinarian_phone} iconColor="#0EA5E9" />
                </View>
              </View>
            )}

            {/* Additional Notes */}
            {adoption.additional_notes && (
              <View style={styles.detailSection}>
                <SectionHeader icon="chatbubble-ellipses" title="Additional Notes" iconBg="#E0E7FF" iconColor="#6366F1" />
                <View style={styles.notesBox}>
                  <Text style={styles.notesText}>{adoption.additional_notes}</Text>
                </View>
              </View>
            )}

            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

// Separate component for adoption card to properly use useState for image error handling
const AdoptionCard = memo(({ adoption, onCancel, onPayment, onViewDetails }) => {
  const [imageError, setImageError] = useState(false);
  const statusConfig = getStatusConfig(adoption.status);
  const canCancel = ['pending', 'reviewing'].includes(adoption.status?.toLowerCase());
  const petImageUrl = getPetImageUrl(adoption.pet_image);
  const isApproved = adoption.status?.toLowerCase() === 'approved';
  const isRejected = adoption.status?.toLowerCase() === 'rejected';
  const isPending = adoption.status?.toLowerCase() === 'pending';
  
  return (
    <TouchableOpacity 
      style={styles.adoptionCard} 
      activeOpacity={0.97}
      onPress={() => onViewDetails(adoption)}
    >
      {/* Card Header with Status */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.statusIndicator, { backgroundColor: statusConfig.color }]} />
          <Text style={[styles.statusLabel, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
        <View style={styles.cardHeaderRight}>
          {adoption.adoption_fee && (
            <View style={styles.feeTag}>
              <Text style={styles.feeTagAmount}>₱{adoption.adoption_fee.toLocaleString()}</Text>
            </View>
          )}
          <Text style={styles.applicationDate}>{getTimeAgo(adoption.applied_at)}</Text>
        </View>
      </View>

      {/* Main Card Content */}
      <View style={styles.cardBody}>
        {/* Pet Image */}
        <View style={styles.imageWrapper}>
          {petImageUrl && !imageError ? (
            <Image
              source={{ uri: petImageUrl }}
              style={styles.petImage}
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={[styles.petImage, styles.petImagePlaceholder]}>
              <MaterialCommunityIcons name="dog" size={32} color="#94A3B8" />
            </View>
          )}
          {/* Status Badge on Image */}
          <LinearGradient
            colors={statusConfig.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.imageStatusBadge}
          >
            <Ionicons name={statusConfig.icon} size={10} color="#FFF" />
          </LinearGradient>
        </View>

        {/* Pet Info */}
        <View style={styles.petInfoContainer}>
          <Text style={styles.petName} numberOfLines={1}>{adoption.pet_name}</Text>
          
          <View style={styles.petAttributesRow}>
            <View style={styles.petAttribute}>
              <Ionicons name="paw" size={12} color="#6366F1" />
              <Text style={styles.petAttributeText}>{adoption.species}</Text>
            </View>
            <View style={styles.attributeDivider} />
            <View style={styles.petAttribute}>
              <Feather name="tag" size={12} color="#EC4899" />
              <Text style={styles.petAttributeText} numberOfLines={1}>{adoption.breed}</Text>
            </View>
          </View>

          {adoption.shelter_name && (
            <View style={styles.shelterInfo}>
              <Ionicons name="location-outline" size={13} color="#64748B" />
              <Text style={styles.shelterName} numberOfLines={1}>{adoption.shelter_name}</Text>
            </View>
          )}
        </View>

        {/* Action Area */}
        <View style={styles.actionArea}>
          <TouchableOpacity
            style={styles.detailsButton}
            onPress={() => onViewDetails(adoption)}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
          </TouchableOpacity>
          {canCancel && (
            <TouchableOpacity
              style={styles.withdrawButton}
              onPress={() => onCancel(adoption)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={18} color="#DC2626" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Rejected Message */}
      {isRejected && adoption.review_notes && (
        <View style={styles.rejectionNotice}>
          <View style={styles.rejectionNoticeHeader}>
            <View style={styles.rejectionIconWrap}>
              <Ionicons name="information-circle" size={16} color="#DC2626" />
            </View>
            <Text style={styles.rejectionNoticeTitle}>Application Declined</Text>
          </View>
          <Text style={styles.rejectionNoticeText} numberOfLines={2}>{adoption.review_notes}</Text>
        </View>
      )}

      {/* Approved Section */}
      {isApproved && (
        <View style={styles.approvalSection}>
          {!adoption.payment_completed ? (
            <View style={styles.approvalContent}>
              <View style={styles.approvalMessage}>
                <View style={styles.approvalIconWrap}>
                  <Ionicons name="checkmark-circle" size={20} color="#059669" />
                </View>
                <View style={styles.approvalTextWrap}>
                  <Text style={styles.approvalTitle}>Application Approved!</Text>
                  <Text style={styles.approvalSubtitle}>Complete payment to finalize adoption</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.proceedButton}
                onPress={() => onPayment(adoption)}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#059669', '#047857']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.proceedButtonGradient}
                >
                  <Text style={styles.proceedButtonText}>Proceed to Payment</Text>
                  <View style={styles.proceedButtonIcon}>
                    <Ionicons name="arrow-forward" size={16} color="#059669" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <DeliveryTimeline adoption={adoption} />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
});

const UserAdoptionsScreen = () => {
  const { user } = useAuth();
  const [adoptions, setAdoptions] = useState([]);
  const [filteredAdoptions, setFilteredAdoptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [statusCounts, setStatusCounts] = useState({
    all: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedAdoption, setSelectedAdoption] = useState(null);

  useEffect(() => {
    fetchAdoptions();
  }, []);

  useEffect(() => {
    filterAdoptions();
    calculateStatusCounts();
  }, [adoptions, selectedFilter]);

  const fetchAdoptions = async () => {
    try {
      setLoading(true);
      const response = await adoptionService.getMyApplications();
      
      if (response.success && response.data) {
        const transformedAdoptions = response.data.map(app => ({
          id: app.id,
          pet_id: app.pet_id,
          pet_name: app.pet_name,
          pet_image: app.pet_image,
          species: app.species || 'Unknown',
          breed: app.breed || 'Unknown',
          status: app.status,
          applied_at: app.submitted_at,
          shelter_name: app.shelter_name,
          review_notes: app.review_notes,
          adoption_fee: app.adoption_fee,
          payment_completed: app.payment_completed,
          delivery_status: app.delivery_status,
          delivery_full_name: app.delivery_full_name,
          delivery_phone: app.delivery_phone,
          delivery_address: app.delivery_address,
          delivery_city: app.delivery_city,
          delivery_postal_code: app.delivery_postal_code,
          delivery_notes: app.delivery_notes,
          delivery_scheduled_date: app.delivery_scheduled_date,
          delivery_actual_date: app.delivery_actual_date,
          delivery_tracking_notes: app.delivery_tracking_notes,
          // Application form fields
          living_situation: app.living_situation,
          has_yard: app.has_yard,
          yard_fenced: app.yard_fenced,
          rental_allows_pets: app.rental_allows_pets,
          household_members: app.household_members,
          has_children: app.has_children,
          children_ages: app.children_ages,
          has_other_pets: app.has_other_pets,
          other_pets_details: app.other_pets_details,
          previous_pet_experience: app.previous_pet_experience,
          reason_for_adoption: app.reason_for_adoption,
          work_schedule: app.work_schedule,
          emergency_contact_name: app.emergency_contact_name,
          emergency_contact_phone: app.emergency_contact_phone,
          veterinarian_name: app.veterinarian_name,
          veterinarian_phone: app.veterinarian_phone,
          additional_notes: app.additional_notes,
        }));
        setAdoptions(transformedAdoptions);
      } else {
        setAdoptions([]);
      }
    } catch (error) {
      if (error?.status !== 403) {
        console.error('Error fetching adoptions:', error);
      }
      setAdoptions([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateStatusCounts = () => {
    const counts = {
      all: adoptions.length,
      pending: adoptions.filter(a => a.status?.toLowerCase() === 'pending').length,
      approved: adoptions.filter(a => a.status?.toLowerCase() === 'approved').length,
      rejected: adoptions.filter(a => a.status?.toLowerCase() === 'rejected').length,
    };
    setStatusCounts(counts);
  };

  const filterAdoptions = () => {
    let filtered = [...adoptions];
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(
        (adoption) => adoption.status?.toLowerCase() === selectedFilter.toLowerCase()
      );
    }
    setFilteredAdoptions(filtered);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAdoptions();
    setRefreshing(false);
  }, []);

  const handleCancelApplication = useCallback(async (adoption) => {
    Alert.alert(
      'Cancel Application',
      `Are you sure you want to withdraw your application for ${adoption.pet_name}?`,
      [
        { text: 'Keep It', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await adoptionService.cancelApplication(adoption.id);
              if (response.success) {
                Alert.alert('Done', 'Your application has been withdrawn.');
                fetchAdoptions();
              }
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to cancel application.');
            }
          },
        },
      ]
    );
  }, [fetchAdoptions]);

  const handlePaymentDelivery = useCallback((adoption) => {
    setSelectedAdoption(adoption);
    setPaymentModalVisible(true);
  }, []);

  const handlePaymentSubmit = useCallback(async (paymentData) => {
    try {
      const response = await adoptionService.submitPaymentAndDelivery(paymentData);
      if (response.success) {
        Alert.alert(
          'Success! 🎉',
          'Payment confirmed! Your new furry friend will be on their way soon.',
          [{ text: 'Awesome!' }]
        );
        fetchAdoptions();
      }
    } catch (error) {
      throw error;
    }
  }, [fetchAdoptions]);

  const handleFilterChange = useCallback((filterId) => {
    setSelectedFilter(filterId);
  }, []);

  const handleViewDetails = useCallback((adoption) => {
    setSelectedAdoption(adoption);
    setDetailModalVisible(true);
  }, []);

  // Render stat card
  const renderStatCard = useCallback((title, value, icon, colors, isActive) => (
    <TouchableOpacity
      key={title}
      activeOpacity={0.8}
      onPress={() => handleFilterChange(title.toLowerCase() === 'total' ? 'all' : title.toLowerCase())}
    >
      <LinearGradient
        colors={isActive ? colors : ['#F1F5F9', '#F8FAFC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.statCard, isActive && styles.statCardActive]}
      >
        <View style={[styles.statIconBg, { backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : colors[0] + '20' }]}>
          <Ionicons name={icon} size={18} color={isActive ? '#FFF' : colors[0]} />
        </View>
        <Text style={[styles.statValue, !isActive && { color: '#1E293B' }]}>{value}</Text>
        <Text style={[styles.statTitle, !isActive && { color: '#64748B' }]}>{title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  ), [handleFilterChange]);

  // Render filter chip
  const renderFilterChip = useCallback((filter) => {
    const isActive = selectedFilter === filter.id;
    const count = statusCounts[filter.id] || 0;
    
    return (
      <TouchableOpacity
        key={filter.id}
        style={[styles.filterChip, isActive && styles.filterChipActive]}
        onPress={() => handleFilterChange(filter.id)}
        activeOpacity={0.8}
      >
        <Ionicons
          name={filter.icon}
          size={16}
          color={isActive ? '#FFF' : '#64748B'}
        />
        <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
          {filter.label}
        </Text>
        {count > 0 && (
          <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
            <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>
              {count}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [selectedFilter, statusCounts, handleFilterChange]);

  // Empty state
  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIllustration}>
        <LinearGradient
          colors={[COLORS.primary + '15', COLORS.primary + '05']}
          style={styles.emptyIllustrationBg}
        >
          <MaterialCommunityIcons name="heart-plus-outline" size={64} color={COLORS.primary} />
        </LinearGradient>
      </View>
      <Text style={styles.emptyTitle}>
        {selectedFilter === 'all' ? 'No Applications Yet' : `No ${selectedFilter.charAt(0).toUpperCase() + selectedFilter.slice(1)} Applications`}
      </Text>
      <Text style={styles.emptySubtitle}>
        {selectedFilter === 'all'
          ? "Your adoption journey starts here! Find your perfect furry companion."
          : `You don't have any ${selectedFilter} applications.`}
      </Text>
      {selectedFilter === 'all' && (
        <TouchableOpacity style={styles.emptyButton} activeOpacity={0.9}>
          <LinearGradient
            colors={[COLORS.primary, '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.emptyButtonGradient}
          >
            <Ionicons name="search" size={18} color="#FFF" />
            <Text style={styles.emptyButtonText}>Browse Pets</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  ), [selectedFilter]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTitleSection}>
            <Text style={styles.headerTitle}>My Adoptions</Text>
            <Text style={styles.headerSubtitle}>Track your adoption journey</Text>
          </View>
        </View>

        {/* Stats Cards */}
        {adoptions.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsRow}
          >
            {renderStatCard('Total', statusCounts.all, 'layers', [COLORS.primary, '#7C3AED'], selectedFilter === 'all')}
            {renderStatCard('Pending', statusCounts.pending, 'hourglass', ['#F59E0B', '#D97706'], selectedFilter === 'pending')}
            {renderStatCard('Approved', statusCounts.approved, 'checkmark-done', ['#10B981', '#059669'], selectedFilter === 'approved')}
            {renderStatCard('Rejected', statusCounts.rejected, 'close', ['#EF4444', '#DC2626'], selectedFilter === 'rejected')}
          </ScrollView>
        )}
      </View>

      {/* Filter Pills */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {STATUS_FILTERS.map(renderFilterChip)}
        </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingSpinner}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
          <Text style={styles.loadingText}>Loading applications...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        >
          {/* Results Header */}
          {filteredAdoptions.length > 0 && (
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsCount}>
                {filteredAdoptions.length} {filteredAdoptions.length === 1 ? 'application' : 'applications'}
              </Text>
            </View>
          )}

          {/* Cards */}
          {filteredAdoptions.length > 0 ? (
            filteredAdoptions.map((adoption) => (
              <AdoptionCard 
                key={adoption.id} 
                adoption={adoption} 
                onCancel={handleCancelApplication}
                onPayment={handlePaymentDelivery}
                onViewDetails={handleViewDetails}
              />
            ))
          ) : (
            renderEmptyState()
          )}
          
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Application Details Modal */}
      <ApplicationDetailsModal
        visible={detailModalVisible}
        onClose={() => {
          setDetailModalVisible(false);
          setSelectedAdoption(null);
        }}
        adoption={selectedAdoption}
      />

      {/* Payment Modal */}
      <PaymentDeliveryModal
        visible={paymentModalVisible}
        onClose={() => {
          setPaymentModalVisible(false);
          setSelectedAdoption(null);
        }}
        adoption={selectedAdoption}
        onSubmit={handlePaymentSubmit}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  
  // Header Styles
  header: {
    backgroundColor: '#FFF',
    paddingTop: Platform.OS === 'ios' ? 60 : StatusBar.currentHeight + 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerTitleSection: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  headerAction: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Stats Styles
  statsRow: {
    paddingHorizontal: 20,
    gap: 10,
  },
  statCard: {
    width: 95,
    height: 100,
    borderRadius: 16,
    padding: 12,
    marginRight: 10,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statCardActive: {
    shadowOpacity: 0.15,
    elevation: 4,
  },
  statIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
  },
  statTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  
  // Filter Styles
  filterSection: {
    backgroundColor: '#FFF',
    paddingVertical: 12,
  },
  filterRow: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    gap: 6,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  filterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  filterBadgeTextActive: {
    color: '#FFF',
  },
  
  // Content Styles
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  resultsHeader: {
    marginBottom: 12,
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  
  // Loading Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingSpinner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  
  // Adoption Card Styles
  adoptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FAFBFC',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  feeTag: {
    backgroundColor: '#ECFDF5',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  feeTagAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  applicationDate: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  imageWrapper: {
    position: 'relative',
  },
  petImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  petImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageStatusBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  petInfoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  petName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  petAttributesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  petAttribute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  petAttributeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  attributeDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 10,
  },
  shelterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  shelterName: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    flex: 1,
  },
  actionArea: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'center',
  },
  detailsButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary + '20',
  },
  withdrawButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  
  // Rejection Notice Styles
  rejectionNotice: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#FECACA',
  },
  rejectionNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  rejectionIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectionNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B91C1C',
  },
  rejectionNoticeText: {
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 19,
    paddingLeft: 32,
  },
  
  // Approval Section Styles
  approvalSection: {
    backgroundColor: '#F0FDF4',
    borderTopWidth: 1,
    borderTopColor: '#BBF7D0',
  },
  approvalContent: {
    padding: 16,
  },
  approvalMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  approvalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  approvalTextWrap: {
    flex: 1,
  },
  approvalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 2,
  },
  approvalSubtitle: {
    fontSize: 12,
    color: '#15803D',
    fontWeight: '500',
  },
  proceedButton: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  proceedButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 10,
  },
  proceedButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  proceedButtonIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Timeline Styles
  timelineContainer: {
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#D1FAE5',
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  timelineHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timelineIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  scheduledDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
  },
  scheduledDate: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6366F1',
  },
  timeline: {
    paddingLeft: 2,
  },
  timelineStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    position: 'relative',
  },
  timelineConnector: {
    position: 'absolute',
    left: 13,
    top: 28,
    width: 2,
    height: 20,
    backgroundColor: '#E2E8F0',
    borderRadius: 1,
  },
  timelineConnectorCompleted: {
    backgroundColor: '#10B981',
  },
  timelineIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  timelineIndicatorCompleted: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  timelineIndicatorCurrent: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    transform: [{ scale: 1.08 }],
  },
  timelineIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  timelineContent: {
    flex: 1,
    paddingTop: 3,
  },
  timelineLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  timelineLabelCompleted: {
    color: '#10B981',
  },
  timelineLabelCurrent: {
    color: COLORS.primary,
  },
  timelineDescription: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  timelineDescriptionCurrent: {
    color: '#64748B',
  },
  deliveryAddressBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deliveryAddressIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryAddressContent: {
    flex: 1,
  },
  deliveryAddressLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  deliveryAddressText: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 16,
  },
  trackingNotesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F5F3FF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
    marginTop: 8,
  },
  trackingNotesText: {
    flex: 1,
    fontSize: 12,
    color: '#6D28D9',
    lineHeight: 16,
    fontWeight: '500',
  },
  deliveredSuccessBox: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  deliveredSuccessGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  deliveredSuccessIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveredSuccessContent: {
    flex: 1,
  },
  deliveredSuccessTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  deliveredSuccessSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  
  // Empty State Styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIllustration: {
    marginBottom: 24,
  },
  emptyIllustrationBg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  modalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modalIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderText: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    paddingHorizontal: 20,
  },
  
  // Pet Info Card
  petInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  petInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  petInfoName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  petInfoLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  petInfoFee: {
    alignItems: 'flex-end',
  },
  petInfoFeeLabel: {
    fontSize: 10,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  petInfoFeeAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  
  // Form Section Styles
  formSection: {
    marginBottom: 20,
  },
  formSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  formSectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  inputWrapper: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  inputLabelOptional: {
    color: '#94A3B8',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  inputContainerMultiline: {
    alignItems: 'flex-start',
  },
  inputIcon: {
    marginLeft: 12,
  },
  textInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  textInputMultiline: {
    minHeight: 56,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  inputRow: {
    flexDirection: 'row',
  },
  
  // Payment Styles
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary + '08',
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  paymentOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentOptionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  paymentOptionDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  paymentOptionCheck: {},
  paymentNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
    marginBottom: 20,
  },
  paymentNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#065F46',
    lineHeight: 16,
  },
  
  // Modal Footer
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFF',
  },
  totalSection: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 11,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  confirmButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },

  // Application Details Modal Styles
  detailModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  detailPetCard: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailPetImageWrap: {
    position: 'relative',
  },
  detailPetImage: {
    width: 90,
    height: 90,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
  },
  detailPetImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailStatusBadge: {
    position: 'absolute',
    bottom: -6,
    left: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  detailStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
    textTransform: 'uppercase',
  },
  detailPetInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  detailPetName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  detailPetMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailPetMetaText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  detailPetMetaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 8,
  },
  detailPetShelter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  detailPetShelterText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  detailPetDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailPetDateText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  rejectionBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  rejectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  rejectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  rejectionReason: {
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 20,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  detailSectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  detailGrid: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  detailIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailRowContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  experienceBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  experienceLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  experienceText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
  },
  notesBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notesText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
  },
});

export default memo(UserAdoptionsScreen);
