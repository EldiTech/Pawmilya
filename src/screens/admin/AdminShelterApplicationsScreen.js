import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import CONFIG from '../../config/config';
import {
  ADMIN_COLORS,
  SCREEN_WIDTH,
  useFadeAnimation,
  getCountByField,
  formatDate,
} from './shared';

const STATUS_CONFIG = {
  pending: { color: '#F59E0B', label: 'Pending', icon: 'time', bg: '#FEF3C7' },
  approved: { color: '#10B981', label: 'Approved', icon: 'checkmark-circle', bg: '#D1FAE5' },
  rejected: { color: '#EF4444', label: 'Rejected', icon: 'close-circle', bg: '#FEE2E2' },
  revoked: { color: '#6B7280', label: 'Revoked', icon: 'ban', bg: '#F3F4F6' },
};

const SHELTER_TYPE_CONFIG = {
  private: { label: 'Private', icon: 'home', color: '#EC4899' },
  ngo: { label: 'NGO', icon: 'people', color: '#14B8A6' },
  government: { label: 'Government', icon: 'business', color: '#6366F1' },
  rescue_group: { label: 'Rescue Group', icon: 'heart', color: '#F97316' },
};

const AdminShelterApplicationsScreen = ({ onGoBack, adminToken }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedApp, setSelectedApp] = useState(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [revokeModalVisible, setRevokeModalVisible] = useState(false);
  const [viewingApp, setViewingApp] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [revocationReason, setRevocationReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const { fadeAnim } = useFadeAnimation();

  // Filtered applications
  const filteredApps = useMemo(() => {
    let result = applications;
    
    if (activeFilter !== 'all') {
      result = result.filter(app => app.status === activeFilter);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(app =>
        app.shelter_name?.toLowerCase().includes(query) ||
        app.applicant_name?.toLowerCase().includes(query) ||
        app.applicant_email?.toLowerCase().includes(query) ||
        app.city?.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [applications, searchQuery, activeFilter]);

  // Status counts
  const getStatusCount = useCallback((status) =>
    getCountByField(applications, 'status', status),
    [applications]
  );

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${CONFIG.API_URL}/shelter-applications`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setApplications(data);
      } else {
        setApplications([]);
      }
    } catch (error) {
      console.error('Error fetching shelter applications:', error);
      setApplications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchApplications();
    setRefreshing(false);
  }, []);

  const handleApprove = async (applicationId) => {
    Alert.alert(
      'Approve Shelter Application',
      'Are you sure you want to approve this shelter? A new shelter will be created and the applicant will become its manager.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              setProcessing(true);
              const response = await fetch(
                `${CONFIG.API_URL}/shelter-applications/${applicationId}/status`,
                {
                  method: 'PATCH',
                  headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ status: 'approved' }),
                }
              );

              if (response.ok) {
                Alert.alert('Success', 'Shelter application approved and shelter created!');
                fetchApplications();
              } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to approve');
              }
            } catch (error) {
              console.error('Error approving application:', error);
              Alert.alert('Error', error.message || 'Failed to approve application');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleReject = (application) => {
    setSelectedApp(application);
    setRejectionReason('');
    setRejectModalVisible(true);
  };

  const submitRejection = async () => {
    if (!rejectionReason.trim()) {
      Alert.alert('Required', 'Please provide a reason for rejection');
      return;
    }

    try {
      setProcessing(true);
      const response = await fetch(
        `${CONFIG.API_URL}/shelter-applications/${selectedApp.id}/status`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'rejected', admin_feedback: rejectionReason }),
        }
      );

      if (response.ok) {
        Alert.alert('Done', 'Application rejected');
        setRejectModalVisible(false);
        fetchApplications();
      } else {
        throw new Error('Failed to reject');
      }
    } catch (error) {
      console.error('Error rejecting application:', error);
      Alert.alert('Error', 'Failed to reject application');
    } finally {
      setProcessing(false);
    }
  };

  const handleRevoke = (application) => {
    setSelectedApp(application);
    setRevocationReason('');
    setRevokeModalVisible(true);
  };

  const submitRevocation = async () => {
    if (!revocationReason.trim()) {
      Alert.alert('Required', 'Please provide a reason for revocation');
      return;
    }

    try {
      setProcessing(true);
      const response = await fetch(
        `${CONFIG.API_URL}/shelter-applications/${selectedApp.id}/status`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'revoked', admin_feedback: revocationReason }),
        }
      );

      if (response.ok) {
        Alert.alert('Done', 'Shelter registration revoked');
        setRevokeModalVisible(false);
        fetchApplications();
      } else {
        throw new Error('Failed to revoke');
      }
    } catch (error) {
      console.error('Error revoking shelter:', error);
      Alert.alert('Error', 'Failed to revoke shelter');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = (application) => {
    const warningMsg = application.status === 'approved'
      ? 'This application was approved and has a shelter created. Deleting it will also deactivate the associated shelter. This action cannot be undone.'
      : 'Are you sure you want to permanently delete this shelter application? This action cannot be undone.';

    Alert.alert(
      'Delete Application',
      warningMsg,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessing(true);
              const response = await fetch(
                `${CONFIG.API_URL}/shelter-applications/${application.id}`,
                {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                  },
                }
              );

              if (response.ok) {
                Alert.alert('Deleted', 'Shelter application has been deleted.');
                fetchApplications();
              } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete');
              }
            } catch (error) {
              console.error('Error deleting application:', error);
              Alert.alert('Error', error.message || 'Failed to delete application');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleViewDetails = (application) => {
    setViewingApp(application);
    setDetailModalVisible(true);
  };

  const parseArray = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        // Handle PostgreSQL array format {a,b,c}
        if (val.startsWith('{') && val.endsWith('}')) {
          return val.slice(1, -1).split(',').map(s => s.trim().replace(/"/g, ''));
        }
        return JSON.parse(val);
      } catch {
        return val.split(',').map(s => s.trim());
      }
    }
    return [];
  };

  const filters = [
    { key: 'all', label: 'All', icon: 'apps' },
    { key: 'pending', label: 'Pending', icon: 'time' },
    { key: 'approved', label: 'Approved', icon: 'checkmark-circle' },
    { key: 'rejected', label: 'Rejected', icon: 'close-circle' },
    { key: 'revoked', label: 'Revoked', icon: 'ban' },
  ];

  const renderApplication = (app) => {
    const statusConfig = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending;
    const typeConfig = SHELTER_TYPE_CONFIG[app.shelter_type] || SHELTER_TYPE_CONFIG.private;

    return (
      <View key={app.id} style={styles.card}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.shelterIconWrap}>
            <LinearGradient
              colors={[typeConfig.color + '30', typeConfig.color + '15']}
              style={styles.shelterIconBg}
            >
              <Ionicons name={typeConfig.icon} size={24} color={typeConfig.color} />
            </LinearGradient>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.shelterName} numberOfLines={1}>{app.shelter_name}</Text>
            <View style={styles.subInfoRow}>
              <Ionicons name="person-outline" size={12} color={ADMIN_COLORS.textMuted} />
              <Text style={styles.applicantName} numberOfLines={1}>{app.applicant_name || app.contact_person_name}</Text>
            </View>
            <View style={styles.subInfoRow}>
              <Ionicons name="location-outline" size={12} color={ADMIN_COLORS.textMuted} />
              <Text style={styles.locationText} numberOfLines={1}>
                {[app.city, app.state].filter(Boolean).join(', ') || app.address || 'No location'}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Ionicons name={statusConfig.icon} size={12} color={statusConfig.color} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        {/* Type & Date Row */}
        <View style={styles.metaRow}>
          <View style={[styles.typeBadge, { backgroundColor: typeConfig.color + '15' }]}>
            <Ionicons name={typeConfig.icon} size={12} color={typeConfig.color} />
            <Text style={[styles.typeText, { color: typeConfig.color }]}>{typeConfig.label}</Text>
          </View>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={12} color={ADMIN_COLORS.textMuted} />
            <Text style={styles.dateText}>{formatDate(app.created_at)}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.viewBtn}
            onPress={() => handleViewDetails(app)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#3B82F6', '#2563EB']}
              style={styles.actionBtnGradient}
            >
              <Ionicons name="eye" size={16} color="#FFF" />
              <Text style={styles.actionBtnText}>View</Text>
            </LinearGradient>
          </TouchableOpacity>

          {app.status === 'pending' && (
            <>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleReject(app)}
                disabled={processing}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#EF4444', '#DC2626']}
                  style={styles.smallActionBtnGradient}
                >
                  <Ionicons name="close" size={18} color="#FFF" />
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.approveBtn}
                onPress={() => handleApprove(app.id)}
                disabled={processing}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  style={styles.actionBtnGradient}
                >
                  <Ionicons name="checkmark" size={18} color="#FFF" />
                  <Text style={styles.actionBtnText}>Approve</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {app.status === 'approved' && (
            <TouchableOpacity
              style={styles.revokeBtn}
              onPress={() => handleRevoke(app)}
              disabled={processing}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                style={styles.actionBtnGradient}
              >
                <Ionicons name="shield-outline" size={16} color="#FFF" />
                <Text style={styles.actionBtnText}>Revoke</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {(app.status === 'rejected' || app.status === 'revoked') && (
            <View style={styles.feedbackHint}>
              <Ionicons name="information-circle-outline" size={14} color={ADMIN_COLORS.textMuted} />
              <Text style={styles.feedbackHintText}>
                {app.admin_feedback ? 'Feedback sent' : 'No feedback'}
              </Text>
            </View>
          )}

          {/* Delete button - always visible */}
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(app)}
            disabled={processing}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#6B7280', '#4B5563']}
              style={styles.smallActionBtnGradient}
            >
              <Ionicons name="trash-outline" size={16} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

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
            <Text style={styles.headerTitle}>Shelter Applications</Text>
            <Text style={styles.headerSubtitle}>Review & manage shelter registrations</Text>
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
        <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
          <Ionicons name="time-outline" size={20} color="#F59E0B" />
          <Text style={[styles.statValue, { color: '#F59E0B' }]}>{getStatusCount('pending')}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#D1FAE5' }]}>
          <Ionicons name="checkmark-circle-outline" size={20} color="#10B981" />
          <Text style={[styles.statValue, { color: '#10B981' }]}>{getStatusCount('approved')}</Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#FEE2E2' }]}>
          <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
          <Text style={[styles.statValue, { color: '#EF4444' }]}>{getStatusCount('rejected')}</Text>
          <Text style={styles.statLabel}>Rejected</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search" size={18} color={ADMIN_COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by shelter name, applicant, city..."
            placeholderTextColor={ADMIN_COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={18} color={ADMIN_COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {filters.map((filter) => {
          const isActive = activeFilter === filter.key;
          const count = filter.key === 'all' ? applications.length : getStatusCount(filter.key);
          return (
            <TouchableOpacity
              key={filter.key}
              style={[styles.filterTab, isActive && styles.filterTabActive]}
              onPress={() => setActiveFilter(filter.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={filter.icon}
                size={14}
                color={isActive ? '#FFF' : ADMIN_COLORS.textMuted}
              />
              <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                {filter.label} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ADMIN_COLORS.primary} />
          <Text style={styles.loadingText}>Loading applications...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[ADMIN_COLORS.primary]}
              tintColor={ADMIN_COLORS.primary}
            />
          }
        >
          {filteredApps.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Text style={styles.emptyEmoji}>🏠</Text>
              </View>
              <Text style={styles.emptyTitle}>No applications found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'No shelter applications match your search' : 'Shelter applications will appear here'}
              </Text>
            </View>
          ) : (
            <Animated.View style={{ opacity: fadeAnim }}>
              {filteredApps.map(renderApplication)}
            </Animated.View>
          )}

          {!loading && filteredApps.length > 0 && (
            <View style={styles.footer}>
              <Text style={styles.footerEmoji}>🏠🐾✨</Text>
              <Text style={styles.footerText}>Building safe havens for animals!</Text>
            </View>
          )}

          <View style={{ height: 30 }} />
        </ScrollView>
      )}

      {/* Detail View Modal */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailModalContent}>
            <View style={styles.detailModalHeader}>
              <View style={styles.detailModalDragIndicator} />
              <TouchableOpacity
                onPress={() => setDetailModalVisible(false)}
                style={styles.detailModalCloseBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={ADMIN_COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.detailModalBody}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.detailModalScrollContent}
            >
              {viewingApp && (
                <>
                  {/* Shelter Header */}
                  <View style={styles.profileHeaderCard}>
                    <View style={styles.shelterDetailIcon}>
                      <LinearGradient
                        colors={[
                          (SHELTER_TYPE_CONFIG[viewingApp.shelter_type]?.color || '#6366F1') + '30',
                          (SHELTER_TYPE_CONFIG[viewingApp.shelter_type]?.color || '#6366F1') + '15',
                        ]}
                        style={styles.shelterDetailIconBg}
                      >
                        <Ionicons
                          name={SHELTER_TYPE_CONFIG[viewingApp.shelter_type]?.icon || 'home'}
                          size={40}
                          color={SHELTER_TYPE_CONFIG[viewingApp.shelter_type]?.color || '#6366F1'}
                        />
                      </LinearGradient>
                    </View>
                    <Text style={styles.profileName}>{viewingApp.shelter_name}</Text>
                    <Text style={styles.profileEmail}>
                      {SHELTER_TYPE_CONFIG[viewingApp.shelter_type]?.label || viewingApp.shelter_type} Shelter
                    </Text>

                    {/* Status Badge */}
                    <View style={[
                      styles.profileStatusBadge,
                      { backgroundColor: STATUS_CONFIG[viewingApp.status]?.bg }
                    ]}>
                      <Ionicons
                        name={STATUS_CONFIG[viewingApp.status]?.icon}
                        size={14}
                        color={STATUS_CONFIG[viewingApp.status]?.color}
                      />
                      <Text style={[
                        styles.profileStatusText,
                        { color: STATUS_CONFIG[viewingApp.status]?.color }
                      ]}>
                        {STATUS_CONFIG[viewingApp.status]?.label}
                      </Text>
                    </View>

                    {/* Quick Stats */}
                    <View style={styles.profileQuickStats}>
                      <View style={styles.profileQuickStat}>
                        <View style={[styles.quickStatIcon, { backgroundColor: '#EEF2FF' }]}>
                          <Ionicons name="calendar-outline" size={16} color="#6366F1" />
                        </View>
                        <View style={styles.quickStatTextWrap}>
                          <Text style={styles.quickStatLabel}>Applied</Text>
                          <Text style={styles.quickStatValue}>{formatDate(viewingApp.created_at)}</Text>
                        </View>
                      </View>
                      <View style={styles.profileQuickStatDivider} />
                      <View style={styles.profileQuickStat}>
                        <View style={[styles.quickStatIcon, { backgroundColor: '#F0FDF4' }]}>
                          <Ionicons name="people-outline" size={16} color="#22C55E" />
                        </View>
                        <View style={styles.quickStatTextWrap}>
                          <Text style={styles.quickStatLabel}>Capacity</Text>
                          <Text style={styles.quickStatValue}>
                            {viewingApp.shelter_capacity || 'N/A'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Applicant Info */}
                  <View style={styles.detailSectionPro}>
                    <View style={styles.detailSectionHeaderPro}>
                      <View style={[styles.sectionIconBg, { backgroundColor: '#EEF2FF' }]}>
                        <Ionicons name="person-circle-outline" size={18} color="#6366F1" />
                      </View>
                      <Text style={styles.detailSectionTitlePro}>Applicant Information</Text>
                    </View>
                    <View style={styles.detailCardPro}>
                      <View style={styles.detailItemPro}>
                        <View style={styles.detailItemIconWrap}>
                          <Ionicons name="person" size={16} color={ADMIN_COLORS.primary} />
                        </View>
                        <View style={styles.detailItemContent}>
                          <Text style={styles.detailItemLabel}>Contact Person</Text>
                          <Text style={styles.detailItemValue}>
                            {viewingApp.contact_person_name || viewingApp.applicant_name || 'N/A'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.detailItemDivider} />
                      <View style={styles.detailItemPro}>
                        <View style={styles.detailItemIconWrap}>
                          <Ionicons name="mail" size={16} color={ADMIN_COLORS.primary} />
                        </View>
                        <View style={styles.detailItemContent}>
                          <Text style={styles.detailItemLabel}>Email</Text>
                          <Text style={styles.detailItemValue}>
                            {viewingApp.email || viewingApp.applicant_email || 'N/A'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.detailItemDivider} />
                      <View style={styles.detailItemPro}>
                        <View style={styles.detailItemIconWrap}>
                          <Ionicons name="call" size={16} color={ADMIN_COLORS.primary} />
                        </View>
                        <View style={styles.detailItemContent}>
                          <Text style={styles.detailItemLabel}>Phone</Text>
                          <Text style={styles.detailItemValue}>
                            {viewingApp.phone || viewingApp.applicant_phone || 'N/A'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Location Info */}
                  <View style={styles.detailSectionPro}>
                    <View style={styles.detailSectionHeaderPro}>
                      <View style={[styles.sectionIconBg, { backgroundColor: '#FEF3C7' }]}>
                        <Ionicons name="location-outline" size={18} color="#F59E0B" />
                      </View>
                      <Text style={styles.detailSectionTitlePro}>Location</Text>
                    </View>
                    <View style={styles.detailCardPro}>
                      <View style={styles.detailItemPro}>
                        <View style={styles.detailItemIconWrap}>
                          <Ionicons name="location" size={16} color={ADMIN_COLORS.primary} />
                        </View>
                        <View style={styles.detailItemContent}>
                          <Text style={styles.detailItemLabel}>Address</Text>
                          <Text style={styles.detailItemValue}>{viewingApp.address || 'N/A'}</Text>
                        </View>
                      </View>
                      {viewingApp.city && (
                        <>
                          <View style={styles.detailItemDivider} />
                          <View style={styles.detailItemPro}>
                            <View style={styles.detailItemIconWrap}>
                              <Ionicons name="business" size={16} color={ADMIN_COLORS.primary} />
                            </View>
                            <View style={styles.detailItemContent}>
                              <Text style={styles.detailItemLabel}>City / State</Text>
                              <Text style={styles.detailItemValue}>
                                {[viewingApp.city, viewingApp.state].filter(Boolean).join(', ')}
                              </Text>
                            </View>
                          </View>
                        </>
                      )}
                      {(viewingApp.latitude && viewingApp.longitude) && (
                        <>
                          <View style={styles.detailItemDivider} />
                          <View style={styles.detailItemPro}>
                            <View style={styles.detailItemIconWrap}>
                              <Ionicons name="navigate" size={16} color={ADMIN_COLORS.primary} />
                            </View>
                            <View style={styles.detailItemContent}>
                              <Text style={styles.detailItemLabel}>GPS Coordinates</Text>
                              <Text style={styles.detailItemValueMono}>
                                {parseFloat(viewingApp.latitude).toFixed(6)}, {parseFloat(viewingApp.longitude).toFixed(6)}
                              </Text>
                            </View>
                          </View>
                        </>
                      )}
                    </View>
                  </View>

                  {/* Description */}
                  {viewingApp.description && (
                    <View style={styles.detailSectionPro}>
                      <View style={styles.detailSectionHeaderPro}>
                        <View style={[styles.sectionIconBg, { backgroundColor: '#F0FDF4' }]}>
                          <Ionicons name="document-text-outline" size={18} color="#22C55E" />
                        </View>
                        <Text style={styles.detailSectionTitlePro}>Description</Text>
                      </View>
                      <View style={styles.detailCardPro}>
                        <Text style={styles.descriptionText}>{viewingApp.description}</Text>
                      </View>
                    </View>
                  )}

                  {/* Animals & Services */}
                  <View style={styles.detailSectionPro}>
                    <View style={styles.detailSectionHeaderPro}>
                      <View style={[styles.sectionIconBg, { backgroundColor: '#FFF1F2' }]}>
                        <Ionicons name="paw-outline" size={18} color="#F43F5E" />
                      </View>
                      <Text style={styles.detailSectionTitlePro}>Animals & Services</Text>
                    </View>
                    <View style={styles.detailCardPro}>
                      <Text style={styles.chipSectionLabel}>Animals Accepted</Text>
                      <View style={styles.chipRow}>
                        {parseArray(viewingApp.animals_accepted).length > 0 ? (
                          parseArray(viewingApp.animals_accepted).map((animal, idx) => (
                            <View key={idx} style={[styles.chip, { backgroundColor: '#FFF1F2' }]}>
                              <Text style={[styles.chipText, { color: '#F43F5E' }]}>
                                {animal.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </Text>
                            </View>
                          ))
                        ) : (
                          <Text style={styles.noDataText}>Not specified</Text>
                        )}
                      </View>

                      <View style={styles.chipDivider} />

                      <Text style={styles.chipSectionLabel}>Services Offered</Text>
                      <View style={styles.chipRow}>
                        {parseArray(viewingApp.services_offered).length > 0 ? (
                          parseArray(viewingApp.services_offered).map((service, idx) => (
                            <View key={idx} style={[styles.chip, { backgroundColor: '#EEF2FF' }]}>
                              <Text style={[styles.chipText, { color: '#6366F1' }]}>
                                {service.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </Text>
                            </View>
                          ))
                        ) : (
                          <Text style={styles.noDataText}>Not specified</Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Operating Hours */}
                  {viewingApp.operating_hours && (
                    <View style={styles.detailSectionPro}>
                      <View style={styles.detailSectionHeaderPro}>
                        <View style={[styles.sectionIconBg, { backgroundColor: '#DCFCE7' }]}>
                          <Ionicons name="time-outline" size={18} color="#22C55E" />
                        </View>
                        <Text style={styles.detailSectionTitlePro}>Operating Hours</Text>
                      </View>
                      <View style={styles.detailCardPro}>
                        <Text style={styles.descriptionText}>{viewingApp.operating_hours}</Text>
                      </View>
                    </View>
                  )}

                  {/* Timeline */}
                  <View style={styles.detailSectionPro}>
                    <View style={styles.detailSectionHeaderPro}>
                      <View style={[styles.sectionIconBg, { backgroundColor: '#E0E7FF' }]}>
                        <Ionicons name="git-branch-outline" size={18} color="#4F46E5" />
                      </View>
                      <Text style={styles.detailSectionTitlePro}>Application Timeline</Text>
                    </View>
                    <View style={styles.timelineCard}>
                      <View style={styles.timelineItem}>
                        <View style={styles.timelineDot} />
                        <View style={styles.timelineContent}>
                          <Text style={styles.timelineLabel}>Application Submitted</Text>
                          <Text style={styles.timelineDate}>{formatDate(viewingApp.created_at)}</Text>
                        </View>
                      </View>
                      {viewingApp.reviewed_at && (
                        <View style={styles.timelineItem}>
                          <View style={[styles.timelineDot, { backgroundColor: STATUS_CONFIG[viewingApp.status]?.color }]} />
                          <View style={styles.timelineContent}>
                            <Text style={styles.timelineLabel}>
                              {viewingApp.status === 'approved' ? 'Application Approved' :
                               viewingApp.status === 'rejected' ? 'Application Rejected' :
                               viewingApp.status === 'revoked' ? 'Registration Revoked' : 'Status Updated'}
                            </Text>
                            <Text style={styles.timelineDate}>{formatDate(viewingApp.reviewed_at)}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Admin Feedback */}
                  {viewingApp.admin_feedback && (
                    <View style={styles.detailSectionPro}>
                      <View style={styles.detailSectionHeaderPro}>
                        <View style={[styles.sectionIconBg, { backgroundColor: '#FEE2E2' }]}>
                          <Ionicons name="chatbubble-outline" size={18} color="#EF4444" />
                        </View>
                        <Text style={styles.detailSectionTitlePro}>Admin Feedback</Text>
                      </View>
                      <View style={styles.detailCardPro}>
                        <Text style={styles.descriptionText}>{viewingApp.admin_feedback}</Text>
                      </View>
                    </View>
                  )}

                  {/* Action Buttons in Detail Modal */}
                  {viewingApp.status === 'pending' && (
                    <View style={styles.detailActionButtons}>
                      <TouchableOpacity
                        style={styles.detailRejectBtn}
                        onPress={() => {
                          setDetailModalVisible(false);
                          handleReject(viewingApp);
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close-circle" size={20} color="#EF4444" />
                        <Text style={styles.detailRejectBtnText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.detailApproveBtn}
                        onPress={() => {
                          setDetailModalVisible(false);
                          handleApprove(viewingApp.id);
                        }}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={['#10B981', '#059669']}
                          style={styles.detailApproveBtnGradient}
                        >
                          <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                          <Text style={styles.detailApproveBtnText}>Approve Shelter</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={{ height: 30 }} />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Rejection Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reasonModalContent}>
            <Text style={styles.reasonModalTitle}>Reject Application</Text>
            <Text style={styles.reasonModalSubtitle}>
              Please provide a reason for rejecting {selectedApp?.shelter_name}'s application
            </Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Enter rejection reason..."
              placeholderTextColor={ADMIN_COLORS.textMuted}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.reasonModalActions}>
              <TouchableOpacity
                style={styles.reasonCancelBtn}
                onPress={() => setRejectModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.reasonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reasonSubmitBtn, { backgroundColor: '#EF4444' }]}
                onPress={submitRejection}
                disabled={processing}
                activeOpacity={0.8}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.reasonSubmitText}>Reject</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Revocation Modal */}
      <Modal
        visible={revokeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRevokeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reasonModalContent}>
            <Text style={styles.reasonModalTitle}>Revoke Shelter</Text>
            <Text style={styles.reasonModalSubtitle}>
              Please provide a reason for revoking {selectedApp?.shelter_name}'s registration
            </Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Enter revocation reason..."
              placeholderTextColor={ADMIN_COLORS.textMuted}
              value={revocationReason}
              onChangeText={setRevocationReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.reasonModalActions}>
              <TouchableOpacity
                style={styles.reasonCancelBtn}
                onPress={() => setRevokeModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.reasonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reasonSubmitBtn, { backgroundColor: '#F59E0B' }]}
                onPress={submitRevocation}
                disabled={processing}
                activeOpacity={0.8}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.reasonSubmitText}>Revoke</Text>
                )}
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
  // Header
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 10,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  headerBadge: {
    marginLeft: 10,
  },
  headerBadgeGradient: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  headerBadgeText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: ADMIN_COLORS.textMuted,
    marginTop: 2,
  },
  // Search
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: ADMIN_COLORS.text,
  },
  // Filter Tabs
  filterScroll: {
    maxHeight: 44,
    marginBottom: 4,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: ADMIN_COLORS.primary,
    borderColor: ADMIN_COLORS.primary,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: ADMIN_COLORS.textMuted,
  },
  filterTabTextActive: {
    color: '#FFF',
  },
  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: ADMIN_COLORS.textMuted,
  },
  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
  },
  // Card
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  shelterIconWrap: {
    marginRight: 12,
  },
  shelterIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    marginRight: 8,
  },
  shelterName: {
    fontSize: 16,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
    marginBottom: 4,
  },
  subInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  applicantName: {
    fontSize: 12,
    color: ADMIN_COLORS.textSecondary,
    flex: 1,
  },
  locationText: {
    fontSize: 12,
    color: ADMIN_COLORS.textMuted,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: ADMIN_COLORS.border,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    color: ADMIN_COLORS.textMuted,
  },
  // Actions
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: ADMIN_COLORS.border,
    gap: 8,
  },
  viewBtn: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  actionBtn: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  approveBtn: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  revokeBtn: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  deleteBtn: {
    borderRadius: 10,
    overflow: 'hidden',
    marginLeft: 'auto',
  },
  actionBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  smallActionBtnGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  feedbackHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  feedbackHintText: {
    fontSize: 11,
    color: ADMIN_COLORS.textMuted,
  },
  // Empty
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: ADMIN_COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: ADMIN_COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  footerText: {
    fontSize: 13,
    color: ADMIN_COLORS.textMuted,
    fontWeight: '500',
  },
  // Modal Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  // Detail Modal
  detailModalContent: {
    backgroundColor: ADMIN_COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    minHeight: '50%',
  },
  detailModalHeader: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 20,
  },
  detailModalDragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: ADMIN_COLORS.border,
    marginBottom: 8,
  },
  detailModalCloseBtn: {
    position: 'absolute',
    right: 20,
    top: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ADMIN_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailModalBody: {
    flex: 1,
  },
  detailModalScrollContent: {
    padding: 20,
    paddingTop: 8,
  },
  // Profile Header Card
  profileHeaderCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  shelterDetailIcon: {
    marginBottom: 16,
  },
  shelterDetailIconBg: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
    textAlign: 'center',
  },
  profileEmail: {
    fontSize: 13,
    color: ADMIN_COLORS.textSecondary,
    marginTop: 4,
  },
  profileStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginTop: 12,
  },
  profileStatusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  profileQuickStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: ADMIN_COLORS.border,
    width: '100%',
  },
  profileQuickStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
  },
  profileQuickStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: ADMIN_COLORS.border,
  },
  quickStatIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStatTextWrap: {
    gap: 2,
  },
  quickStatLabel: {
    fontSize: 11,
    color: ADMIN_COLORS.textMuted,
  },
  quickStatValue: {
    fontSize: 13,
    fontWeight: '600',
    color: ADMIN_COLORS.text,
  },
  // Detail Section
  detailSectionPro: {
    marginBottom: 16,
  },
  detailSectionHeaderPro: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  sectionIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailSectionTitlePro: {
    fontSize: 15,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
  },
  detailCardPro: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  detailItemPro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailItemIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: ADMIN_COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailItemContent: {
    flex: 1,
  },
  detailItemLabel: {
    fontSize: 11,
    color: ADMIN_COLORS.textMuted,
    marginBottom: 2,
  },
  detailItemValue: {
    fontSize: 14,
    fontWeight: '500',
    color: ADMIN_COLORS.text,
  },
  detailItemValueMono: {
    fontSize: 13,
    fontWeight: '500',
    color: ADMIN_COLORS.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  detailItemDivider: {
    height: 1,
    backgroundColor: ADMIN_COLORS.border,
    marginVertical: 12,
    marginLeft: 48,
  },
  // Description
  descriptionText: {
    fontSize: 14,
    color: ADMIN_COLORS.textSecondary,
    lineHeight: 20,
  },
  // Chips
  chipSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: ADMIN_COLORS.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipDivider: {
    height: 1,
    backgroundColor: ADMIN_COLORS.border,
    marginVertical: 14,
  },
  noDataText: {
    fontSize: 13,
    color: ADMIN_COLORS.textMuted,
    fontStyle: 'italic',
  },
  // Timeline
  timelineCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ADMIN_COLORS.primary,
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: ADMIN_COLORS.text,
  },
  timelineDate: {
    fontSize: 11,
    color: ADMIN_COLORS.textMuted,
    marginTop: 2,
  },
  // Detail Action Buttons
  detailActionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  detailRejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FEE2E2',
    backgroundColor: '#FFF',
    gap: 6,
  },
  detailRejectBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
  detailApproveBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  detailApproveBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  detailApproveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  // Reason Modal
  reasonModalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  reasonModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
    marginBottom: 6,
  },
  reasonModalSubtitle: {
    fontSize: 13,
    color: ADMIN_COLORS.textSecondary,
    marginBottom: 20,
    lineHeight: 18,
  },
  reasonInput: {
    backgroundColor: ADMIN_COLORS.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: ADMIN_COLORS.text,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    minHeight: 100,
    marginBottom: 20,
  },
  reasonModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  reasonCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  reasonCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: ADMIN_COLORS.textSecondary,
  },
  reasonSubmitBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  reasonSubmitText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});

export default memo(AdminShelterApplicationsScreen);
