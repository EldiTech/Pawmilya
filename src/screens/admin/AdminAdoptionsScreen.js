import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Alert,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Modal,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import CONFIG from '../../config/config';
import {
  ADMIN_COLORS,
  ADOPTION_STATUS_CONFIG,
  formatDate as formatDateUtil,
  useFadeAnimation,
  getCountByField,
  getImageUrl as getImageUrlUtil,
} from './shared';

const STATUS_CONFIG = ADOPTION_STATUS_CONFIG;

// Wrapper for image URL helper
const getImageUrl = (imagePath) => getImageUrlUtil(imagePath, CONFIG.API_URL);

const formatDate = (dateString) => formatDateUtil(dateString, { fallback: '' });

const AdminAdoptionsScreen = ({ onGoBack, adminToken }) => {
  const [filter, setFilter] = useState('all');
  const [applications, setApplications] = useState([]);
  const [rescuerAdoptions, setRescuerAdoptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { fadeAnim } = useFadeAnimation();
  
  // Modal states for new functionality
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  // Combine regular adoptions and rescuer adoptions for unified view
  const allAdoptions = useMemo(() => {
    const regularMapped = applications.map(app => ({ ...app, type: 'regular' }));
    const rescuerMapped = rescuerAdoptions.map(app => ({ ...app, type: 'rescuer' }));
    return [...regularMapped, ...rescuerMapped];
  }, [applications, rescuerAdoptions]);

  // Memoized filtered list
  const filtered = useMemo(() => {
    if (filter === 'rescuer') {
      return allAdoptions.filter(a => a.type === 'rescuer');
    }
    return allAdoptions.filter(a => filter === 'all' || a.status === filter);
  }, [allAdoptions, filter]);

  // Memoized status counts
  const getStatusCount = useCallback((status) => {
    if (status === 'rescuer') {
      return rescuerAdoptions.length;
    }
    return getCountByField(allAdoptions, 'status', status);
  }, [allAdoptions, rescuerAdoptions]);


  useEffect(() => {
    fetchApplications();
    fetchRescuerAdoptions();
  }, [filter]);

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      
      let url = `${CONFIG.API_URL}/admin/adoptions?limit=50`;
      if (filter !== 'all' && filter !== 'rescuer') {
        url += `&status=${filter}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch applications');
      }
      
      const data = await response.json();

      if (Array.isArray(data)) {
        setApplications(data.map(app => ({
          id: app.id,
          pet: app.pet,
          petImg: app.pet_image,
          petBreed: app.pet_breed,
          petGender: app.pet_gender,
          petAgeYears: app.pet_age_years,
          petAgeMonths: app.pet_age_months,
          petSpecies: app.pet_species,
          applicant: app.applicant,
          applicantEmail: app.applicant_email,
          applicantPhone: app.applicant_phone,
          status: app.status,
          date: formatDate(app.submitted_at),
          approvedAt: app.approved_at ? formatDate(app.approved_at) : null,
          // Living Situation
          livingSituation: app.living_situation,
          hasYard: app.has_yard,
          yardFenced: app.yard_fenced,
          rentalAllowsPets: app.rental_allows_pets,
          // Household
          householdMembers: app.household_members,
          hasChildren: app.has_children,
          childrenAges: app.children_ages,
          // Other Pets
          hasOtherPets: app.has_other_pets,
          otherPetsDetails: app.other_pets_details,
          // Experience
          previousPetExperience: app.previous_pet_experience,
          reasonForAdoption: app.reason_for_adoption,
          workSchedule: app.work_schedule,
          // Emergency Contact
          emergencyContactName: app.emergency_contact_name,
          emergencyContactPhone: app.emergency_contact_phone,
          // Veterinarian
          veterinarianName: app.veterinarian_name,
          veterinarianPhone: app.veterinarian_phone,
          // Notes
          additionalNotes: app.additional_notes,
          reviewNotes: app.review_notes,
          rejectionReason: app.rejection_reason,
        })));
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
      Alert.alert('Error', 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [filter, adminToken]);

  // Fetch rescuer adoption requests from rescue_reports
  const fetchRescuerAdoptions = useCallback(async () => {
    try {
      const response = await fetch(`${CONFIG.API_URL}/admin/rescues?limit=100`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch rescuer adoptions');
      }
      
      const data = await response.json();

      if (Array.isArray(data)) {
        // Filter only rescues with adoption requests
        const adoptionRequests = data
          .filter(rescue => rescue.rescuer_adoption_status)
          .map(rescue => ({
            id: `rescuer-${rescue.id}`,
            rescueId: rescue.id,
            pet: rescue.title || `Rescued ${rescue.animal_type || 'Animal'}`,
            petImg: rescue.images && rescue.images.length > 0 ? rescue.images[0] : null,
            petBreed: rescue.animal_type || 'Unknown',
            petGender: 'Unknown',
            petSpecies: rescue.animal_type || 'Unknown',
            applicant: rescue.rescuer_name || 'Rescuer',
            applicantEmail: rescue.rescuer_email || '',
            applicantPhone: rescue.rescuer_phone || '',
            status: rescue.rescuer_adoption_status === 'requested' ? 'pending' : rescue.rescuer_adoption_status,
            rescuerAdoptionStatus: rescue.rescuer_adoption_status,
            date: formatDate(rescue.rescuer_adopted_at || rescue.created_at),
            rescuedAt: formatDate(rescue.rescued_at || rescue.verified_at || rescue.created_at),
            locationDescription: rescue.location_description,
            city: rescue.city,
            reasonForAdoption: rescue.rescuer_adoption_notes || 'Rescuer wishes to adopt this rescued animal.',
            isRescuerAdoption: true,
          }));
        
        setRescuerAdoptions(adoptionRequests);
      }
    } catch (error) {
      console.error('Error fetching rescuer adoptions:', error);
    }
  }, [adminToken]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchApplications(), fetchRescuerAdoptions()]);
    setRefreshing(false);
  }, [fetchApplications, fetchRescuerAdoptions]);

  // Handle rescuer adoption action (approve/reject)
  const handleRescuerAdoptionAction = useCallback(async (app, action) => {
    const rescueId = app.rescueId;
    const actionText = action === 'approve' ? 'Approve' : 'Reject';
    
    Alert.alert(
      `${actionText} Rescuer Adoption`,
      `${actionText} adoption for "${app.pet}" by ${app.applicant}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm',
          style: action === 'reject' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const response = await fetch(`${CONFIG.API_URL}/admin/rescues/${rescueId}/adoption-status`, {
                method: 'PUT',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${adminToken}`,
                },
                body: JSON.stringify({ action }),
              });
              
              const data = await response.json();
              
              if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to update');
              }
              
              // Update local state
              setRescuerAdoptions(prev => prev.map(a => 
                a.rescueId === rescueId 
                  ? { ...a, status: action === 'approve' ? 'approved' : 'rejected', rescuerAdoptionStatus: action === 'approve' ? 'approved' : 'rejected' } 
                  : a
              ));
              
              Alert.alert(
                'Success',
                action === 'approve' 
                  ? `Rescuer adoption for "${app.pet}" has been approved!` 
                  : `Rescuer adoption request rejected.`
              );
            } catch (error) {
              console.error('Rescuer adoption action error:', error);
              Alert.alert('Error', 'Failed to update rescuer adoption');
            }
          }
        },
      ]
    );
  }, [adminToken]);

  const handleAction = useCallback(async (id, action, newStatus) => {
    const app = applications.find(a => a.id === id);
    
    Alert.alert(
      `${action} Application`,
      `${action} adoption for ${app.pet} by ${app.applicant}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm',
          onPress: async () => {
            try {
              const response = await fetch(`${CONFIG.API_URL}/admin/adoptions/${id}/status`, {
                method: 'PUT',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${adminToken}`,
                },
                body: JSON.stringify({ status: newStatus }),
              });
              
              if (!response.ok) {
                throw new Error('Failed to update');
              }
              
              setApplications(applications.map(a => 
                a.id === id ? { ...a, status: newStatus } : a
              ));
              Alert.alert(
                'Success',
                action === 'Approve' 
                  ? `${app.pet} adoption has been approved` 
                  : `Application ${action.toLowerCase()}d`
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to update application');
            }
          }
        },
      ]
    );
  }, [applications, adminToken]);

  // View application details
  const handleViewDetails = useCallback((app) => {
    setSelectedApp(app);
    setDetailModalVisible(true);
  }, []);

  // Open rejection modal with reason input
  const handleRejectWithReason = useCallback((app) => {
    setSelectedApp(app);
    setRejectionReason('');
    setRejectModalVisible(true);
  }, []);

  // Submit rejection with reason
  const submitRejection = useCallback(async () => {
    if (!selectedApp) return;
    
    setProcessing(true);
    try {
      const response = await fetch(`${CONFIG.API_URL}/admin/adoptions/${selectedApp.id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ 
          status: 'rejected',
          rejection_reason: rejectionReason || 'Application not approved',
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to reject');
      }
      
      setApplications(applications.map(a => 
        a.id === selectedApp.id ? { ...a, status: 'rejected' } : a
      ));
      setRejectModalVisible(false);
      Alert.alert('Done', 'Application rejected');
    } catch (error) {
      Alert.alert('Error', 'Failed to reject application');
    } finally {
      setProcessing(false);
    }
  }, [selectedApp, rejectionReason, applications, adminToken]);

  // Delete application
  const handleDelete = useCallback((app) => {
    Alert.alert(
      'Delete Application',
      `Are you sure you want to delete the application from ${app.applicant} for ${app.pet}?\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${CONFIG.API_URL}/admin/adoptions/${app.id}`, {
                method: 'DELETE',
                headers: { 
                  'Authorization': `Bearer ${adminToken}`,
                },
              });
              
              if (!response.ok) {
                throw new Error('Failed to delete');
              }
              
              setApplications(applications.filter(a => a.id !== app.id));
              Alert.alert('Deleted', 'Application has been removed');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete application');
            }
          }
        },
      ]
    );
  }, [applications, adminToken]);

  const filters = [
    { key: 'all', label: 'All', icon: 'apps' },
    { key: 'rescuer', label: 'Rescuer', icon: 'shield-checkmark', color: '#8B5CF6' },
    { key: 'pending', label: 'Pending', icon: 'time' },
    { key: 'approved', label: 'Approved', icon: 'checkmark-circle' },
    { key: 'rejected', label: 'Rejected', icon: 'close-circle' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={ADMIN_COLORS.primary} />

      {/* Enhanced Header */}
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
            <Text style={styles.headerTitle}>Adoption Applications</Text>
            <Text style={styles.headerSubtitle}>Manage adoption requests</Text>
          </View>
          <View style={styles.headerBadge}>
            <LinearGradient
              colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.15)']}
              style={styles.headerBadgeGradient}
            >
              <Text style={styles.headerBadgeText}>{applications.length}</Text>
            </LinearGradient>
          </View>
        </View>
      </LinearGradient>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <LinearGradient
            colors={['#FFF8E1', '#FFECB3']}
            style={styles.statCardGradient}
          >
            <Ionicons name="time-outline" size={20} color="#F59E0B" style={{marginBottom: 6}} />
            <Text style={styles.statNum}>{getStatusCount('pending')}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </LinearGradient>
        </View>
        <View style={styles.statCard}>
          <LinearGradient
            colors={['#F3E8FF', '#E9D5FF']}
            style={styles.statCardGradient}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color="#8B5CF6" style={{marginBottom: 6}} />
            <Text style={styles.statNum}>{rescuerAdoptions.length}</Text>
            <Text style={styles.statLabel}>Rescuer</Text>
          </LinearGradient>
        </View>
        <View style={styles.statCard}>
          <LinearGradient
            colors={['#E8FFF3', '#D4F5E7']}
            style={styles.statCardGradient}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#00B894" style={{marginBottom: 6}} />
            <Text style={styles.statNum}>{getStatusCount('approved')}</Text>
            <Text style={styles.statLabel}>Approved</Text>
          </LinearGradient>
        </View>
      </View>

      {/* Filter Section */}
      <View style={styles.filterSection}>
        <View style={styles.filterHeader}>
          <Text style={styles.filterTitle}>Filter by Status</Text>
          <Text style={styles.filterSubtitle}>{filtered.length} results</Text>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.filterRow} 
          contentContainerStyle={styles.filterContent}
        >
          {filters.map(f => {
            const isActive = filter === f.key;
            const count = getStatusCount(f.key);
            
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.7}
              >
                <View style={[styles.chipIconWrap, isActive && styles.chipIconWrapActive]}>
                  <Ionicons 
                    name={f.icon} 
                    size={14} 
                    color={isActive ? '#FFF' : ADMIN_COLORS.textLight} 
                  />
                </View>
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {f.label}
                </Text>
                {count > 0 && (
                  <View style={[styles.chipCount, isActive && styles.chipCountActive]}>
                    <Text style={[styles.chipCountText, isActive && styles.chipCountTextActive]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Applications List */}
      <ScrollView 
        style={styles.list} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={[ADMIN_COLORS.primary]}
            tintColor={ADMIN_COLORS.primary}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <View style={styles.loadingIconWrap}>
              <ActivityIndicator size="large" color={ADMIN_COLORS.primary} />
            </View>
            <Text style={styles.loadingText}>Loading applications...</Text>
          </View>
        ) : filtered.length > 0 ? (
          <Animated.View style={{ opacity: fadeAnim }}>
            {filtered.map((app, index) => (
              <View key={app.id} style={[styles.card, app.isRescuerAdoption && styles.rescuerCard]}>
                {/* Rescuer Badge */}
                {app.isRescuerAdoption && (
                  <View style={styles.rescuerBadgeRow}>
                    <LinearGradient
                      colors={['#8B5CF6', '#7C3AED']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.rescuerBadge}
                    >
                      <Ionicons name="shield-checkmark" size={12} color="#FFF" />
                      <Text style={styles.rescuerBadgeText}>Rescuer Adoption</Text>
                    </LinearGradient>
                  </View>
                )}
                
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.petInfoWrap}>
                    <Image source={{ uri: getImageUrl(app.petImg) || 'https://via.placeholder.com/60?text=Pet' }} style={styles.petImg} />
                    <View style={styles.petDetails}>
                      <View style={styles.petNameRow}>
                        <Text style={styles.petName}>{app.pet}</Text>
                      </View>
                      <View style={styles.applicantRow}>
                        <Ionicons name={app.isRescuerAdoption ? "shield" : "person-outline"} size={14} color={app.isRescuerAdoption ? "#8B5CF6" : ADMIN_COLORS.textLight} />
                        <Text style={[styles.applicant, app.isRescuerAdoption && { color: '#8B5CF6', fontWeight: '600' }]}>{app.applicant}</Text>
                      </View>
                      <View style={styles.dateRow}>
                        <Ionicons name="calendar-outline" size={14} color={ADMIN_COLORS.textMuted} />
                        <Text style={styles.dateText}>{app.date}</Text>
                      </View>
                    </View>
                  </View>
                  
                  {/* Status Badge */}
                  <View style={[
                    styles.statusBadge, 
                    { backgroundColor: STATUS_CONFIG[app.status]?.bg || '#F5F5F5' }
                  ]}>
                    <Ionicons 
                      name={STATUS_CONFIG[app.status]?.icon || 'ellipse'} 
                      size={14} 
                      color={STATUS_CONFIG[app.status]?.color || '#999'} 
                    />
                    <Text style={[
                      styles.statusText, 
                      { color: STATUS_CONFIG[app.status]?.color || '#999' }
                    ]}>
                      {STATUS_CONFIG[app.status]?.label || app.status}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons - only for pending */}
                {app.status === 'pending' && !app.isRescuerAdoption && (
                  <View style={styles.actionBtns}>
                    <TouchableOpacity 
                      style={styles.viewBtn}
                      onPress={() => handleViewDetails(app)}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#3B82F6', '#2563EB']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.smallActionBtn}
                      >
                        <Ionicons name="eye" size={18} color="#FFF" />
                      </LinearGradient>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.rejectBtn}
                      onPress={() => handleRejectWithReason(app)}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#FF7675', '#E17055']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.actionBtnGradient}
                      >
                        <Ionicons name="close" size={18} color="#FFF" />
                        <Text style={styles.actionBtnText}>Reject</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.approveBtn}
                      onPress={() => handleAction(app.id, 'Approve', 'approved')}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#00B894', '#00A885']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.actionBtnGradient}
                      >
                        <Ionicons name="checkmark" size={18} color="#FFF" />
                        <Text style={styles.actionBtnText}>Approve</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Rescuer Adoption Actions - pending */}
                {app.status === 'pending' && app.isRescuerAdoption && (
                  <View style={styles.actionBtns}>
                    <View style={styles.rescuerInfoRow}>
                      <Ionicons name="location-outline" size={14} color={ADMIN_COLORS.textMuted} />
                      <Text style={styles.rescuerInfoText} numberOfLines={1}>{app.locationDescription || app.city || 'Rescue location'}</Text>
                    </View>
                    
                    <TouchableOpacity 
                      style={styles.rejectBtn}
                      onPress={() => handleRescuerAdoptionAction(app, 'reject')}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#FF7675', '#E17055']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.actionBtnGradient}
                      >
                        <Ionicons name="close" size={18} color="#FFF" />
                        <Text style={styles.actionBtnText}>Reject</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.approveBtn}
                      onPress={() => handleRescuerAdoptionAction(app, 'approve')}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#8B5CF6', '#7C3AED']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.actionBtnGradient}
                      >
                        <Ionicons name="checkmark" size={18} color="#FFF" />
                        <Text style={styles.actionBtnText}>Approve</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Approved message with view/delete */}
                {app.status === 'approved' && !app.isRescuerAdoption && (
                  <View style={styles.approvedRow}>
                    <View style={styles.successMessage}>
                      <Ionicons name="checkmark-circle" size={18} color="#00B894" />
                      <Text style={styles.successText}>This pet found a loving home!</Text>
                    </View>
                    <View style={styles.approvedActions}>
                      <TouchableOpacity 
                        onPress={() => handleViewDetails(app)}
                        style={styles.iconBtn}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="eye-outline" size={18} color={ADMIN_COLORS.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => handleDelete(app)}
                        style={[styles.iconBtn, styles.deleteIconBtn]}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Rescuer Approved message */}
                {app.status === 'approved' && app.isRescuerAdoption && (
                  <View style={styles.approvedRow}>
                    <View style={styles.successMessage}>
                      <Ionicons name="shield-checkmark" size={18} color="#8B5CF6" />
                      <Text style={[styles.successText, { color: '#8B5CF6' }]}>
                        Rescuer adopted this animal! 🏠
                      </Text>
                    </View>
                  </View>
                )}

                {/* Rejected - show view and delete */}
                {app.status === 'rejected' && !app.isRescuerAdoption && (
                  <View style={styles.rejectedRow}>
                    <View style={styles.rejectedMessage}>
                      <Ionicons name="close-circle" size={18} color="#EF4444" />
                      <Text style={styles.rejectedText}>Application rejected</Text>
                    </View>
                    <View style={styles.approvedActions}>
                      <TouchableOpacity 
                        onPress={() => handleViewDetails(app)}
                        style={styles.iconBtn}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="eye-outline" size={18} color={ADMIN_COLORS.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => handleDelete(app)}
                        style={[styles.iconBtn, styles.deleteIconBtn]}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Rescuer Rejected */}
                {app.status === 'rejected' && app.isRescuerAdoption && (
                  <View style={styles.rejectedRow}>
                    <View style={styles.rejectedMessage}>
                      <Ionicons name="close-circle" size={18} color="#EF4444" />
                      <Text style={styles.rejectedText}>Rescuer adoption rejected</Text>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </Animated.View>
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="document-text-outline" size={48} color={ADMIN_COLORS.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No applications found</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'all' 
                ? 'Adoption applications will appear here'
                : `No ${filter} applications at the moment`}
            </Text>
            {filter !== 'all' && (
              <TouchableOpacity 
                style={styles.emptyButton}
                onPress={() => setFilter('all')}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyButtonText}>View All</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {/* Footer message */}
        {!loading && filtered.length > 0 && (
          <View style={styles.footer}>
            <Text style={styles.footerText}>Every pet deserves a loving home</Text>
          </View>
        )}
        
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* View Details Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Application Details</Text>
              <TouchableOpacity 
                onPress={() => setDetailModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={24} color={ADMIN_COLORS.textLight} />
              </TouchableOpacity>
            </View>
            
            {selectedApp && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Pet Info Card */}
                <View style={styles.detailSection}>
                  <View style={styles.detailSectionHeader}>
                    <View style={[styles.sectionIconWrap, { backgroundColor: '#EEF2FF' }]}>
                      <Ionicons name="paw" size={16} color="#6366F1" />
                    </View>
                    <Text style={styles.detailSectionTitle}>Pet Information</Text>
                  </View>
                  <View style={styles.petInfoCard}>
                    <Image 
                      source={{ uri: getImageUrl(selectedApp.petImg) || 'https://via.placeholder.com/80?text=Pet' }} 
                      style={styles.detailPetImg} 
                    />
                    <View style={styles.detailPetInfo}>
                      <Text style={styles.detailPetName}>{selectedApp.pet}</Text>
                      <View style={styles.petMetaRow}>
                        {selectedApp.petSpecies && (
                          <View style={styles.petMetaChip}>
                            <Text style={styles.petMetaChipText}>{selectedApp.petSpecies}</Text>
                          </View>
                        )}
                        {selectedApp.petBreed && (
                          <View style={styles.petMetaChip}>
                            <Text style={styles.petMetaChipText}>{selectedApp.petBreed}</Text>
                          </View>
                        )}
                      </View>
                      <View style={[
                        styles.detailStatusBadge,
                        { backgroundColor: STATUS_CONFIG[selectedApp.status]?.bg || '#F5F5F5' }
                      ]}>
                        <Ionicons 
                          name={STATUS_CONFIG[selectedApp.status]?.icon || 'ellipse'} 
                          size={12} 
                          color={STATUS_CONFIG[selectedApp.status]?.color || '#999'} 
                        />
                        <Text style={[
                          styles.detailStatusText,
                          { color: STATUS_CONFIG[selectedApp.status]?.color || '#999' }
                        ]}>
                          {STATUS_CONFIG[selectedApp.status]?.label || selectedApp.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Applicant Info */}
                <View style={styles.detailSection}>
                  <View style={styles.detailSectionHeader}>
                    <View style={[styles.sectionIconWrap, { backgroundColor: '#FEF3C7' }]}>
                      <Ionicons name="person" size={16} color="#D97706" />
                    </View>
                    <Text style={styles.detailSectionTitle}>Applicant Information</Text>
                  </View>
                  <View style={styles.detailGrid}>
                    <View style={styles.detailItem}>
                      <Ionicons name="person-outline" size={16} color={ADMIN_COLORS.textMuted} />
                      <View style={styles.detailItemContent}>
                        <Text style={styles.detailLabel}>Full Name</Text>
                        <Text style={styles.detailValue}>{selectedApp.applicant}</Text>
                      </View>
                    </View>
                    <View style={styles.detailItem}>
                      <Ionicons name="mail-outline" size={16} color={ADMIN_COLORS.textMuted} />
                      <View style={styles.detailItemContent}>
                        <Text style={styles.detailLabel}>Email</Text>
                        <Text style={styles.detailValue}>{selectedApp.applicantEmail || 'Not provided'}</Text>
                      </View>
                    </View>
                    {selectedApp.applicantPhone && (
                      <View style={styles.detailItem}>
                        <Ionicons name="call-outline" size={16} color={ADMIN_COLORS.textMuted} />
                        <View style={styles.detailItemContent}>
                          <Text style={styles.detailLabel}>Phone</Text>
                          <Text style={styles.detailValue}>{selectedApp.applicantPhone}</Text>
                        </View>
                      </View>
                    )}
                    <View style={styles.detailItem}>
                      <Ionicons name="calendar-outline" size={16} color={ADMIN_COLORS.textMuted} />
                      <View style={styles.detailItemContent}>
                        <Text style={styles.detailLabel}>Applied On</Text>
                        <Text style={styles.detailValue}>{selectedApp.date}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Living Situation */}
                <View style={styles.detailSection}>
                  <View style={styles.detailSectionHeader}>
                    <View style={[styles.sectionIconWrap, { backgroundColor: '#DBEAFE' }]}>
                      <Ionicons name="home" size={16} color="#3B82F6" />
                    </View>
                    <Text style={styles.detailSectionTitle}>Living Situation</Text>
                  </View>
                  <View style={styles.detailGrid}>
                    <View style={styles.detailItem}>
                      <Ionicons name="home-outline" size={16} color="#3B82F6" />
                      <View style={styles.detailItemContent}>
                        <Text style={styles.detailLabel}>Housing Type</Text>
                        <Text style={styles.detailValue}>{selectedApp.livingSituation || 'Not specified'}</Text>
                      </View>
                    </View>
                    <View style={styles.detailItem}>
                      <Ionicons name="leaf-outline" size={16} color="#10B981" />
                      <View style={styles.detailItemContent}>
                        <Text style={styles.detailLabel}>Has Yard</Text>
                        <Text style={[styles.detailValue, selectedApp.hasYard ? styles.valueYes : styles.valueNo]}>
                          {selectedApp.hasYard ? 'Yes' : 'No'}
                        </Text>
                      </View>
                    </View>
                    {selectedApp.hasYard && (
                      <View style={styles.detailItem}>
                        <Ionicons name="shield-outline" size={16} color="#6366F1" />
                        <View style={styles.detailItemContent}>
                          <Text style={styles.detailLabel}>Yard Fenced</Text>
                          <Text style={[styles.detailValue, selectedApp.yardFenced ? styles.valueYes : styles.valueNo]}>
                            {selectedApp.yardFenced ? 'Yes' : 'No'}
                          </Text>
                        </View>
                      </View>
                    )}
                    {selectedApp.livingSituation?.toLowerCase().includes('rent') && (
                      <View style={styles.detailItem}>
                        <Ionicons name="document-text-outline" size={16} color="#F59E0B" />
                        <View style={styles.detailItemContent}>
                          <Text style={styles.detailLabel}>Landlord Allows Pets</Text>
                          <Text style={[styles.detailValue, selectedApp.rentalAllowsPets ? styles.valueYes : styles.valueNo]}>
                            {selectedApp.rentalAllowsPets ? 'Yes' : 'No'}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>

                {/* Household */}
                <View style={styles.detailSection}>
                  <View style={styles.detailSectionHeader}>
                    <View style={[styles.sectionIconWrap, { backgroundColor: '#FCE7F3' }]}>
                      <Ionicons name="people" size={16} color="#EC4899" />
                    </View>
                    <Text style={styles.detailSectionTitle}>Household</Text>
                  </View>
                  <View style={styles.detailGrid}>
                    <View style={styles.detailItem}>
                      <Ionicons name="people-outline" size={16} color="#EC4899" />
                      <View style={styles.detailItemContent}>
                        <Text style={styles.detailLabel}>Household Members</Text>
                        <Text style={styles.detailValue}>{selectedApp.householdMembers || 'Not specified'}</Text>
                      </View>
                    </View>
                    <View style={styles.detailItem}>
                      <Ionicons name="happy-outline" size={16} color="#8B5CF6" />
                      <View style={styles.detailItemContent}>
                        <Text style={styles.detailLabel}>Has Children</Text>
                        <Text style={[styles.detailValue, selectedApp.hasChildren ? styles.valueYes : styles.valueNo]}>
                          {selectedApp.hasChildren ? 'Yes' : 'No'}
                        </Text>
                      </View>
                    </View>
                    {selectedApp.hasChildren && selectedApp.childrenAges && (
                      <View style={styles.detailItem}>
                        <Ionicons name="calendar-outline" size={16} color="#F59E0B" />
                        <View style={styles.detailItemContent}>
                          <Text style={styles.detailLabel}>Children Ages</Text>
                          <Text style={styles.detailValue}>{selectedApp.childrenAges}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>

                {/* Other Pets */}
                <View style={styles.detailSection}>
                  <View style={styles.detailSectionHeader}>
                    <View style={[styles.sectionIconWrap, { backgroundColor: '#D1FAE5' }]}>
                      <Ionicons name="paw" size={16} color="#059669" />
                    </View>
                    <Text style={styles.detailSectionTitle}>Other Pets</Text>
                  </View>
                  <View style={styles.detailGrid}>
                    <View style={styles.detailItem}>
                      <Ionicons name="paw-outline" size={16} color="#059669" />
                      <View style={styles.detailItemContent}>
                        <Text style={styles.detailLabel}>Has Other Pets</Text>
                        <Text style={[styles.detailValue, selectedApp.hasOtherPets ? styles.valueYes : styles.valueNo]}>
                          {selectedApp.hasOtherPets ? 'Yes' : 'No'}
                        </Text>
                      </View>
                    </View>
                    {selectedApp.hasOtherPets && selectedApp.otherPetsDetails && (
                      <View style={styles.detailItemFull}>
                        <Ionicons name="list-outline" size={16} color="#14B8A6" />
                        <View style={styles.detailItemContent}>
                          <Text style={styles.detailLabel}>Pet Details</Text>
                          <Text style={styles.detailValue}>{selectedApp.otherPetsDetails}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>

                {/* Experience & Motivation */}
                <View style={styles.detailSection}>
                  <View style={styles.detailSectionHeader}>
                    <View style={[styles.sectionIconWrap, { backgroundColor: '#FEE2E2' }]}>
                      <Ionicons name="star" size={16} color="#EF4444" />
                    </View>
                    <Text style={styles.detailSectionTitle}>Experience & Motivation</Text>
                  </View>
                  <View style={styles.detailGrid}>
                    {selectedApp.workSchedule && (
                      <View style={styles.detailItem}>
                        <Ionicons name="briefcase-outline" size={16} color="#6366F1" />
                        <View style={styles.detailItemContent}>
                          <Text style={styles.detailLabel}>Work Schedule</Text>
                          <Text style={styles.detailValue}>{selectedApp.workSchedule}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                  {selectedApp.previousPetExperience && (
                    <View style={styles.textBox}>
                      <Text style={styles.textBoxLabel}>Previous Pet Experience</Text>
                      <Text style={styles.textBoxContent}>{selectedApp.previousPetExperience}</Text>
                    </View>
                  )}
                  {selectedApp.reasonForAdoption && (
                    <View style={styles.textBox}>
                      <Text style={styles.textBoxLabel}>Reason for Adoption</Text>
                      <Text style={styles.textBoxContent}>{selectedApp.reasonForAdoption}</Text>
                    </View>
                  )}
                </View>

                {/* Emergency Contact */}
                {(selectedApp.emergencyContactName || selectedApp.emergencyContactPhone) && (
                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHeader}>
                      <View style={[styles.sectionIconWrap, { backgroundColor: '#FED7AA' }]}>
                        <Ionicons name="call" size={16} color="#EA580C" />
                      </View>
                      <Text style={styles.detailSectionTitle}>Emergency Contact</Text>
                    </View>
                    <View style={styles.detailGrid}>
                      {selectedApp.emergencyContactName && (
                        <View style={styles.detailItem}>
                          <Ionicons name="person-outline" size={16} color="#EA580C" />
                          <View style={styles.detailItemContent}>
                            <Text style={styles.detailLabel}>Contact Name</Text>
                            <Text style={styles.detailValue}>{selectedApp.emergencyContactName}</Text>
                          </View>
                        </View>
                      )}
                      {selectedApp.emergencyContactPhone && (
                        <View style={styles.detailItem}>
                          <Ionicons name="call-outline" size={16} color="#EA580C" />
                          <View style={styles.detailItemContent}>
                            <Text style={styles.detailLabel}>Contact Phone</Text>
                            <Text style={styles.detailValue}>{selectedApp.emergencyContactPhone}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Veterinarian */}
                {(selectedApp.veterinarianName || selectedApp.veterinarianPhone) && (
                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHeader}>
                      <View style={[styles.sectionIconWrap, { backgroundColor: '#CFFAFE' }]}>
                        <Ionicons name="medkit" size={16} color="#06B6D4" />
                      </View>
                      <Text style={styles.detailSectionTitle}>Veterinarian</Text>
                    </View>
                    <View style={styles.detailGrid}>
                      {selectedApp.veterinarianName && (
                        <View style={styles.detailItem}>
                          <Ionicons name="medical-outline" size={16} color="#06B6D4" />
                          <View style={styles.detailItemContent}>
                            <Text style={styles.detailLabel}>Vet Name</Text>
                            <Text style={styles.detailValue}>{selectedApp.veterinarianName}</Text>
                          </View>
                        </View>
                      )}
                      {selectedApp.veterinarianPhone && (
                        <View style={styles.detailItem}>
                          <Ionicons name="call-outline" size={16} color="#0EA5E9" />
                          <View style={styles.detailItemContent}>
                            <Text style={styles.detailLabel}>Vet Phone</Text>
                            <Text style={styles.detailValue}>{selectedApp.veterinarianPhone}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Additional Notes */}
                {selectedApp.additionalNotes && (
                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHeader}>
                      <View style={[styles.sectionIconWrap, { backgroundColor: '#E0E7FF' }]}>
                        <Ionicons name="chatbubble-ellipses" size={16} color="#6366F1" />
                      </View>
                      <Text style={styles.detailSectionTitle}>Additional Notes</Text>
                    </View>
                    <View style={styles.notesBox}>
                      <Text style={styles.notesText}>{selectedApp.additionalNotes}</Text>
                    </View>
                  </View>
                )}

                {/* Rejection Reason (if rejected) */}
                {selectedApp.status === 'rejected' && selectedApp.rejectionReason && (
                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionHeader}>
                      <View style={[styles.sectionIconWrap, { backgroundColor: '#FEE2E2' }]}>
                        <Ionicons name="alert-circle" size={16} color="#DC2626" />
                      </View>
                      <Text style={styles.detailSectionTitle}>Rejection Reason</Text>
                    </View>
                    <View style={styles.rejectionBox}>
                      <Text style={styles.rejectionText}>{selectedApp.rejectionReason}</Text>
                    </View>
                  </View>
                )}

                <View style={{ height: 20 }} />
              </ScrollView>
            )}
            
            <View style={styles.modalFooter}>
              {selectedApp?.status === 'pending' && (
                <>
                  <TouchableOpacity 
                    style={styles.modalRejectBtn}
                    onPress={() => {
                      setDetailModalVisible(false);
                      handleRejectWithReason(selectedApp);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalRejectBtnText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.modalApproveBtn}
                    onPress={() => {
                      setDetailModalVisible(false);
                      handleAction(selectedApp.id, 'Approve', 'approved');
                    }}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#00B894', '#00A885']}
                      style={styles.modalApproveBtnGradient}
                    >
                      <Text style={styles.modalApproveBtnText}>Approve</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
              {selectedApp?.status !== 'pending' && (
                <TouchableOpacity 
                  style={styles.modalDeleteBtn}
                  onPress={() => {
                    setDetailModalVisible(false);
                    handleDelete(selectedApp);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalDeleteBtnText}>Delete Application</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Rejection Reason Modal */}
      <Modal
        visible={rejectModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reject Application</Text>
              <TouchableOpacity 
                onPress={() => setRejectModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={24} color={ADMIN_COLORS.textLight} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              {selectedApp && (
                <View style={styles.rejectAppInfo}>
                  <Text style={styles.rejectAppText}>
                    Rejecting application from <Text style={styles.rejectAppBold}>{selectedApp.applicant}</Text> for <Text style={styles.rejectAppBold}>{selectedApp.pet}</Text>
                  </Text>
                </View>
              )}
              
              <Text style={styles.rejectInputLabel}>Reason for Rejection (Optional)</Text>
              <TextInput
                style={styles.rejectInput}
                placeholder="Enter reason for rejection..."
                placeholderTextColor={ADMIN_COLORS.textMuted}
                value={rejectionReason}
                onChangeText={setRejectionReason}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.modalCancelBtn}
                onPress={() => setRejectModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalConfirmRejectBtn, processing && styles.modalBtnDisabled]}
                onPress={submitRejection}
                disabled={processing}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={processing ? ['#9CA3AF', '#9CA3AF'] : ['#EF4444', '#DC2626']}
                  style={styles.modalConfirmRejectBtnGradient}
                >
                  {processing ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.modalConfirmRejectBtnText}>Reject Application</Text>
                  )}
                </LinearGradient>
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
    backgroundColor: ADMIN_COLORS.background,
  },
  headerGradient: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 12 : 56,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerDecor: {
    position: 'absolute',
    top: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 54,
    right: 70,
    opacity: 0.15,
  },
  headerDecor2: {
    top: Platform.OS === 'android' ? StatusBar.currentHeight + 40 : 84,
    right: 30,
  },
  decorEmoji: {
    fontSize: 36,
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
    fontSize: 20, 
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
  headerBadge: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  headerBadgeGradient: {
    minWidth: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statCardGradient: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  statEmoji: {
    fontSize: 20,
    marginBottom: 6,
  },
  statNum: { 
    fontSize: 22, 
    fontWeight: '800', 
    color: ADMIN_COLORS.text,
  },
  statLabel: { 
    fontSize: 11, 
    color: ADMIN_COLORS.textLight, 
    fontWeight: '600',
    marginTop: 2,
  },
  filterSection: {
    backgroundColor: ADMIN_COLORS.card,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    paddingTop: 14,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
  },
  filterSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: ADMIN_COLORS.textMuted,
  },
  filterRow: { 
    paddingLeft: 12,
    maxHeight: 46,
  },
  filterContent: {
    paddingRight: 12,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 6,
    backgroundColor: ADMIN_COLORS.background,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipActive: { 
    backgroundColor: ADMIN_COLORS.primary,
    borderColor: ADMIN_COLORS.primaryDark,
  },
  chipIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: ADMIN_COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  chipIconWrapActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  chipText: { 
    fontSize: 13, 
    color: ADMIN_COLORS.textLight,
    fontWeight: '600',
  },
  chipTextActive: { 
    color: '#FFFFFF',
    fontWeight: '700',
  },
  chipCount: {
    marginLeft: 6,
    backgroundColor: ADMIN_COLORS.card,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  chipCountActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderColor: 'rgba(255,255,255,0.4)',
  },
  chipCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: ADMIN_COLORS.textLight,
  },
  chipCountTextActive: {
    color: '#FFFFFF',
  },
  list: { 
    flex: 1, 
    paddingHorizontal: 16, 
    paddingTop: 14,
  },
  listContent: {
    paddingBottom: 10,
  },
  card: {
    backgroundColor: ADMIN_COLORS.card,
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  rescuerCard: {
    borderColor: '#8B5CF6',
    borderWidth: 2,
    backgroundColor: '#FAF5FF',
  },
  rescuerBadgeRow: {
    marginBottom: 12,
  },
  rescuerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  rescuerBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  rescuerInfoRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 8,
  },
  rescuerInfoText: {
    fontSize: 12,
    color: ADMIN_COLORS.textMuted,
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  petInfoWrap: {
    flexDirection: 'row',
    flex: 1,
  },
  petImg: { 
    width: 64, 
    height: 64, 
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
  },
  petDetails: { 
    flex: 1, 
    marginLeft: 12,
  },
  petNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  petName: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: ADMIN_COLORS.text,
  },
  petEmoji: {
    fontSize: 14,
    marginLeft: 6,
  },
  applicantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  applicant: { 
    fontSize: 14, 
    color: ADMIN_COLORS.textLight, 
    marginLeft: 6,
    fontWeight: '500',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dateText: { 
    fontSize: 12, 
    color: ADMIN_COLORS.textMuted, 
    marginLeft: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: { 
    fontSize: 12, 
    fontWeight: '600',
    marginLeft: 5,
  },
  actionBtns: { 
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: ADMIN_COLORS.border,
    gap: 10,
  },
  rejectBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#FF7675',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  approveBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#00B894',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionBtnGradient: {
    flexDirection: 'row',
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  successEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  successText: {
    fontSize: 14,
    color: '#00B894',
    fontWeight: '600',
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 24,
  },
  loadingIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF5EE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    color: ADMIN_COLORS.textLight,
    fontWeight: '600',
  },
  loadingEmoji: {
    fontSize: 28,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 24,
  },
  emptyIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFF5EE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: ADMIN_COLORS.textLight,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: ADMIN_COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: ADMIN_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
  },
  footerEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  footerText: {
    fontSize: 13,
    color: ADMIN_COLORS.textMuted,
    textAlign: 'center',
    fontWeight: '500',
  },
  // New styles for view/delete buttons
  viewBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  smallActionBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  approvedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: ADMIN_COLORS.border,
    gap: 12,
  },
  rejectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: ADMIN_COLORS.border,
    gap: 12,
  },
  rejectedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  rejectedText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
    flex: 1,
  },
  approvedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: ADMIN_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: ADMIN_COLORS.border,
  },
  deleteIconBtn: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: ADMIN_COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ADMIN_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    padding: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: ADMIN_COLORS.border,
  },
  // Detail Modal styles
  detailSection: {
    marginBottom: 20,
  },
  detailSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  petInfoCard: {
    flexDirection: 'row',
    backgroundColor: ADMIN_COLORS.background,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailPetImg: {
    width: 80,
    height: 80,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
  },
  detailPetInfo: {
    flex: 1,
    marginLeft: 14,
  },
  detailPetName: {
    fontSize: 18,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
    marginBottom: 6,
  },
  petMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  petMetaChip: {
    backgroundColor: '#EEF2FF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  petMetaChipText: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '600',
  },
  detailStatusBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  detailStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailGrid: {
    gap: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ADMIN_COLORS.background,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  detailItemFull: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: ADMIN_COLORS.background,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  detailItemContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: ADMIN_COLORS.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  detailValue: {
    fontSize: 14,
    color: ADMIN_COLORS.text,
    fontWeight: '500',
  },
  valueYes: {
    color: '#059669',
    fontWeight: '600',
  },
  valueNo: {
    color: '#94A3B8',
  },
  textBox: {
    backgroundColor: ADMIN_COLORS.background,
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  textBoxLabel: {
    fontSize: 11,
    color: ADMIN_COLORS.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  textBoxContent: {
    fontSize: 14,
    color: ADMIN_COLORS.text,
    lineHeight: 22,
  },
  notesBox: {
    backgroundColor: '#F0F4FF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  notesText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
  },
  rejectionBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  rejectionText: {
    fontSize: 14,
    color: '#991B1B',
    lineHeight: 22,
  },
  modalRejectBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalRejectBtnText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
  },
  modalApproveBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  modalApproveBtnGradient: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalApproveBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalDeleteBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDeleteBtnText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
  },
  // Rejection Modal styles
  rejectAppInfo: {
    backgroundColor: ADMIN_COLORS.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  rejectAppText: {
    fontSize: 14,
    color: ADMIN_COLORS.textLight,
    lineHeight: 20,
  },
  rejectAppBold: {
    fontWeight: '700',
    color: ADMIN_COLORS.text,
  },
  rejectInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: ADMIN_COLORS.text,
    marginBottom: 10,
  },
  rejectInput: {
    backgroundColor: ADMIN_COLORS.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: ADMIN_COLORS.text,
    minHeight: 100,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: ADMIN_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  modalCancelBtnText: {
    color: ADMIN_COLORS.textLight,
    fontSize: 15,
    fontWeight: '600',
  },
  modalConfirmRejectBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  modalConfirmRejectBtnGradient: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalConfirmRejectBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalBtnDisabled: {
    opacity: 0.6,
  },
});

export default memo(AdminAdoptionsScreen);
