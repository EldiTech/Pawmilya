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
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import CONFIG from '../../config/config';
import {
  ADMIN_COLORS,
  SCREEN_WIDTH,
  RESCUER_STATUS_CONFIG,
  TRANSPORT_ICONS,
  useFadeAnimation,
  getCountByField,
  formatDate,
  getImageUrl as getImageUrlUtil,
  generateAvatarUrl,
} from './shared';

// Helper to get image URL with API base
const getImageUrl = (imagePath) => getImageUrlUtil(imagePath, CONFIG.API_URL);

const STATUS_CONFIG = RESCUER_STATUS_CONFIG;

const AdminRescuerApplicationsScreen = ({ onGoBack, adminToken }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApp, setSelectedApp] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [revokeModalVisible, setRevokeModalVisible] = useState(false);
  const [viewingApp, setViewingApp] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [revocationReason, setRevocationReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const { fadeAnim } = useFadeAnimation();

  // Memoized filtered list
  const filteredApps = useMemo(() => {
    if (!searchQuery) return applications;
    const query = searchQuery.toLowerCase();
    return applications.filter(app => 
      app.full_name?.toLowerCase().includes(query) ||
      app.email?.toLowerCase().includes(query)
    );
  }, [applications, searchQuery]);

  // Memoized status counts
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
      const response = await fetch(`${CONFIG.API_URL}/admin/rescuer-applications`, {
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
      console.error('Error fetching applications:', error);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchApplications();
    setRefreshing(false);
  }, []);

  const handleApprove = async (applicationId) => {
    Alert.alert(
      'Approve Application 🎉',
      'Are you sure you want to approve this rescuer application? They will be able to respond to rescue alerts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              setProcessing(true);
              const response = await fetch(
                `${CONFIG.API_URL}/admin/rescuer-applications/${applicationId}/approve`,
                {
                  method: 'PUT',
                  headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                  },
                }
              );

              if (response.ok) {
                const app = applications.find(a => a.id === applicationId);
                
                try {
                  await fetch(`${CONFIG.API_URL}/notifications`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      user_id: app?.user_id,
                      type: 'rescuer_approved',
                      title: 'Rescuer Application Approved!',
                      message: 'Congratulations! Your rescuer application has been approved. You can now respond to rescue alerts in your area.',
                    }),
                  });
                } catch (notifError) {
                  // Notification creation failed - non-critical
                }
                
                Alert.alert('Success', 'Application approved successfully');
                fetchApplications();
              } else {
                throw new Error('Failed to approve');
              }
            } catch (error) {
              console.error('Error approving application:', error);
              Alert.alert('Error', 'Failed to approve application');
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
    setModalVisible(true);
  };

  const handleViewDetails = (application) => {
    setViewingApp(application);
    setDetailModalVisible(true);
  };

  const handleRevokeVerification = (application) => {
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
        `${CONFIG.API_URL}/admin/rescuer-applications/${selectedApp.id}/revoke`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: revocationReason }),
        }
      );

      if (response.ok) {
        try {
          await fetch(`${CONFIG.API_URL}/notifications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: selectedApp.user_id,
              type: 'rescuer_revoked',
              title: 'Rescuer Verification Removed',
              message: `Your rescuer verification has been revoked. Reason: ${revocationReason}. You may reapply after addressing the issues.`,
            }),
          });
        } catch (notifError) {
          // Notification creation failed - non-critical
        }
        
        Alert.alert('Done', 'Rescuer verification removed');
        setRevokeModalVisible(false);
        fetchApplications();
      } else {
        throw new Error('Failed to revoke verification');
      }
    } catch (error) {
      console.error('Error revoking verification:', error);
      Alert.alert('Error', 'Failed to remove rescuer verification');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteApplication = (application) => {
    Alert.alert(
      'Delete Application',
      `Are you sure you want to permanently delete the application from ${application.full_name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessing(true);
              const response = await fetch(
                `${CONFIG.API_URL}/admin/rescuer-applications/${application.id}`,
                {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                  },
                }
              );

              if (response.ok) {
                Alert.alert('Deleted', 'Application deleted successfully');
                fetchApplications();
              } else {
                throw new Error('Failed to delete application');
              }
            } catch (error) {
              console.error('Error deleting application:', error);
              Alert.alert('Error', 'Failed to delete application');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleReactivateRescuer = (application) => {
    Alert.alert(
      'Reactivate Rescuer 🦸',
      `Are you sure you want to reactivate ${application.full_name}'s rescuer verification? They will immediately regain access to rescue reports.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reactivate',
          onPress: async () => {
            try {
              setProcessing(true);
              const response = await fetch(
                `${CONFIG.API_URL}/admin/rescuer-applications/${application.id}/reactivate`,
                {
                  method: 'PUT',
                  headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                  },
                }
              );

              if (response.ok) {
                try {
                  await fetch(`${CONFIG.API_URL}/notifications`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      user_id: application.user_id,
                      type: 'rescuer_reactivated',
                      title: 'Rescuer Verification Restored!',
                      message: 'Great news! Your rescuer verification has been restored. You can now respond to rescue alerts again.',
                    }),
                  });
                } catch (notifError) {
                  // Notification creation failed - non-critical
                }
                
                Alert.alert('Success', 'Rescuer verification reactivated');
                fetchApplications();
              } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to reactivate rescuer');
              }
            } catch (error) {
              console.error('Error reactivating rescuer:', error);
              Alert.alert('Error', 'Failed to reactivate rescuer verification');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const submitRejection = async () => {
    if (!rejectionReason.trim()) {
      Alert.alert('Required', 'Please provide a reason for rejection');
      return;
    }

    try {
      setProcessing(true);
      const response = await fetch(
        `${CONFIG.API_URL}/admin/rescuer-applications/${selectedApp.id}/reject`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: rejectionReason }),
        }
      );

      if (response.ok) {
        try {
          await fetch(`${CONFIG.API_URL}/notifications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: selectedApp.user_id,
              type: 'rescuer_rejected',
              title: 'Rescuer Application Update',
              message: `We're sorry, but your rescuer application was not approved at this time. Reason: ${rejectionReason}`,
            }),
          });
        } catch (notifError) {
          // Notification creation failed - non-critical
        }
        
        Alert.alert('Done', 'Application rejected');
        setModalVisible(false);
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

  const filters = [
    { key: 'all', label: 'All', icon: 'apps' },
    { key: 'pending', label: 'Pending', icon: 'time' },
    { key: 'approved', label: 'Approved', icon: 'checkmark-circle' },
    { key: 'rejected', label: 'Rejected', icon: 'close-circle' },
    { key: 'revoked', label: 'Revoked', icon: 'ban' },
  ];

  const renderApplication = (app) => {
    const statusConfig = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending;
    
    return (
      <View key={app.id} style={styles.card}>
        {/* Card Content - Name, Date, Status */}
        <View style={styles.cardHeader}>
          <View style={styles.avatarWrap}>
            <Image 
              source={{ uri: getImageUrl(app.avatar_url) || generateAvatarUrl(app.full_name) }} 
              style={styles.avatar}
            />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.applicantName} numberOfLines={1}>{app.full_name}</Text>
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={12} color={ADMIN_COLORS.textMuted} />
              <Text style={styles.applicantDate}>{formatDate(app.created_at)}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Ionicons name={statusConfig.icon} size={12} color={statusConfig.color} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
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
              onPress={() => handleRevokeVerification(app)}
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
          
          {app.status === 'revoked' && (
            <>
              <TouchableOpacity
                style={styles.reactivateBtn}
                onPress={() => handleReactivateRescuer(app)}
                disabled={processing}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  style={styles.actionBtnGradient}
                >
                  <Ionicons name="shield-checkmark" size={16} color="#FFF" />
                  <Text style={styles.actionBtnText}>Reactivate</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleDeleteApplication(app)}
                disabled={processing}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#6B7280', '#4B5563']}
                  style={styles.smallActionBtnGradient}
                >
                  <Ionicons name="trash" size={16} color="#FFF" />
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
          
          {app.status === 'rejected' && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleDeleteApplication(app)}
              disabled={processing}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#6B7280', '#4B5563']}
                style={styles.smallActionBtnGradient}
              >
                <Ionicons name="trash" size={16} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

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
            <Text style={styles.headerTitle}>Rescuer Applications</Text>
            <Text style={styles.headerSubtitle}>Manage rescuer verifications</Text>
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
            placeholder="Search by name, email, or phone..."
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

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIconWrap}>
            <ActivityIndicator size="large" color={ADMIN_COLORS.primary} />
          </View>
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
                <Text style={styles.emptyEmoji}>🦸</Text>
              </View>
              <Text style={styles.emptyTitle}>No applications found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'No rescuer applications match your search' : 'Rescuer applications will appear here'}
              </Text>
            </View>
          ) : (
            <Animated.View style={{ opacity: fadeAnim }}>
              {filteredApps.map(renderApplication)}
            </Animated.View>
          )}
          
          {!loading && filteredApps.length > 0 && (
            <View style={styles.footer}>
              <Text style={styles.footerEmoji}>🦸🐾💪</Text>
              <Text style={styles.footerText}>Building a community of heroes!</Text>
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
            {/* Minimal Header Bar */}
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
                  {/* Profile Header Card */}
                  <View style={styles.profileHeaderCard}>
                    <View style={styles.profileAvatarContainer}>
                      <Image 
                        source={{ uri: getImageUrl(viewingApp.avatar_url) || generateAvatarUrl(viewingApp.full_name) }} 
                        style={styles.profileAvatar}
                      />
                      <View style={[
                        styles.profileStatusIndicator, 
                        { backgroundColor: STATUS_CONFIG[viewingApp.status]?.color }
                      ]} />
                    </View>
                    <Text style={styles.profileName}>{viewingApp.full_name}</Text>
                    <Text style={styles.profileEmail}>{viewingApp.email}</Text>
                    
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
                          <Ionicons name="car-outline" size={16} color="#22C55E" />
                        </View>
                        <View style={styles.quickStatTextWrap}>
                          <Text style={styles.quickStatLabel}>Transport</Text>
                          <Text style={styles.quickStatValue} numberOfLines={1}>
                            {viewingApp.transportation_type ? viewingApp.transportation_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Contact Information */}
                  <View style={styles.detailSectionPro}>
                    <View style={styles.detailSectionHeaderPro}>
                      <View style={[styles.sectionIconBg, { backgroundColor: '#EEF2FF' }]}>
                        <Ionicons name="person-circle-outline" size={18} color="#6366F1" />
                      </View>
                      <Text style={styles.detailSectionTitlePro}>Contact Information</Text>
                    </View>
                    
                    <View style={styles.detailCardPro}>
                      <View style={styles.detailItemPro}>
                        <View style={styles.detailItemIconWrap}>
                          <Ionicons name="call" size={16} color={ADMIN_COLORS.primary} />
                        </View>
                        <View style={styles.detailItemContent}>
                          <Text style={styles.detailItemLabel}>Phone Number</Text>
                          <Text style={styles.detailItemValue}>{viewingApp.phone || 'Not provided'}</Text>
                        </View>
                      </View>

                      <View style={styles.detailItemDivider} />

                      <View style={styles.detailItemPro}>
                        <View style={styles.detailItemIconWrap}>
                          <Ionicons name="location" size={16} color={ADMIN_COLORS.primary} />
                        </View>
                        <View style={styles.detailItemContent}>
                          <Text style={styles.detailItemLabel}>Address</Text>
                          <Text style={styles.detailItemValue}>
                            {viewingApp.address}
                            {viewingApp.city ? `, ${viewingApp.city}` : ''}
                          </Text>
                        </View>
                      </View>

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

                  {/* Experience & Motivation */}
                  <View style={styles.detailSectionPro}>
                    <View style={styles.detailSectionHeaderPro}>
                      <View style={[styles.sectionIconBg, { backgroundColor: '#FEF3C7' }]}>
                        <Ionicons name="document-text-outline" size={18} color="#F59E0B" />
                      </View>
                      <Text style={styles.detailSectionTitlePro}>Experience & Motivation</Text>
                    </View>
                    
                    <View style={styles.detailCardPro}>
                      <View style={styles.textBlockPro}>
                        <Text style={styles.textBlockLabel}>Previous Experience</Text>
                        <Text style={styles.textBlockValue}>
                          {viewingApp.experience || 'No prior experience with animal rescue provided.'}
                        </Text>
                      </View>

                      <View style={styles.textBlockDivider} />

                      <View style={styles.textBlockPro}>
                        <Text style={styles.textBlockLabel}>Motivation for Applying</Text>
                        <Text style={styles.textBlockValue}>
                          {viewingApp.reason || 'No motivation statement provided.'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Availability */}
                  {viewingApp.availability && (
                    <View style={styles.detailSectionPro}>
                      <View style={styles.detailSectionHeaderPro}>
                        <View style={[styles.sectionIconBg, { backgroundColor: '#DCFCE7' }]}>
                          <Ionicons name="time-outline" size={18} color="#22C55E" />
                        </View>
                        <Text style={styles.detailSectionTitlePro}>Availability Schedule</Text>
                      </View>
                      
                      <View style={styles.availabilityGridPro}>
                        {viewingApp.availability.split(',').map((slot, index) => {
                          const slotName = slot.trim();
                          const isEmergency = slotName === 'emergency';
                          return (
                            <View 
                              key={index} 
                              style={[
                                styles.availabilityChipPro,
                                isEmergency && styles.availabilityChipEmergency
                              ]}
                            >
                              <Ionicons 
                                name={isEmergency ? 'alert-circle' : 'checkmark-circle'} 
                                size={14} 
                                color={isEmergency ? '#EF4444' : '#22C55E'} 
                              />
                              <Text style={[
                                styles.availabilityChipTextPro,
                                isEmergency && styles.availabilityChipTextEmergency
                              ]}>
                                {slotName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </Text>
                            </View>
                          );
                        })}
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
                      
                      {viewingApp.updated_at && viewingApp.updated_at !== viewingApp.created_at && (
                        <View style={styles.timelineItem}>
                          <View style={[styles.timelineDot, { backgroundColor: STATUS_CONFIG[viewingApp.status]?.color }]} />
                          <View style={styles.timelineContent}>
                            <Text style={styles.timelineLabel}>
                              {viewingApp.status === 'approved' ? 'Application Approved' : 
                               viewingApp.status === 'rejected' ? 'Application Rejected' :
                               viewingApp.status === 'revoked' ? 'Verification Revoked' : 'Status Updated'}
                            </Text>
                            <Text style={styles.timelineDate}>{formatDate(viewingApp.updated_at)}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Rejection/Revocation Reason */}
                  {(viewingApp.status === 'rejected' || viewingApp.status === 'revoked') && viewingApp.rejection_reason && (
                    <View style={styles.detailSectionPro}>
                      <View style={styles.detailSectionHeaderPro}>
                        <View style={[styles.sectionIconBg, { backgroundColor: '#FEE2E2' }]}>
                          <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
                        </View>
                        <Text style={styles.detailSectionTitlePro}>
                          {viewingApp.status === 'rejected' ? 'Rejection Reason' : 'Revocation Reason'}
                        </Text>
                      </View>
                      
                      <View style={styles.reasonCardPro}>
                        <Text style={styles.reasonTextPro}>{viewingApp.rejection_reason}</Text>
                      </View>
                    </View>
                  )}

                  <View style={{ height: 100 }} />
                </>
              )}
            </ScrollView>

            {/* Action Buttons at Bottom */}
            {viewingApp && (
              <View style={styles.detailModalActions}>
                {viewingApp.status === 'pending' && (
                  <>
                    <TouchableOpacity
                      style={styles.detailRejectBtn}
                      onPress={() => {
                        setDetailModalVisible(false);
                        handleReject(viewingApp);
                      }}
                      disabled={processing}
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
                      disabled={processing}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#10B981', '#059669']}
                        style={styles.detailApproveBtnGradient}
                      >
                        <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                        <Text style={styles.detailApproveBtnText}>Approve Application</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                )}
                
                {viewingApp.status === 'approved' && (
                  <TouchableOpacity
                    style={styles.detailRevokeFullBtn}
                    onPress={() => {
                      setDetailModalVisible(false);
                      handleRevokeVerification(viewingApp);
                    }}
                    disabled={processing}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#F59E0B', '#D97706']}
                      style={styles.detailRevokeBtnGradient}
                    >
                      <Ionicons name="shield-outline" size={20} color="#FFF" />
                      <Text style={styles.detailRevokeBtnText}>Revoke Verification</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
                
                {viewingApp.status === 'revoked' && (
                  <>
                    <TouchableOpacity
                      style={styles.detailDeleteBtn}
                      onPress={() => {
                        setDetailModalVisible(false);
                        handleDeleteApplication(viewingApp);
                      }}
                      disabled={processing}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="trash-outline" size={20} color="#6B7280" />
                      <Text style={styles.detailDeleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.detailReactivateBtn}
                      onPress={() => {
                        setDetailModalVisible(false);
                        handleReactivateRescuer(viewingApp);
                      }}
                      disabled={processing}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#10B981', '#059669']}
                        style={styles.detailReactivateBtnGradient}
                      >
                        <Ionicons name="shield-checkmark" size={20} color="#FFF" />
                        <Text style={styles.detailReactivateBtnText}>Reactivate Rescuer</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                )}
                
                {viewingApp.status === 'rejected' && (
                  <TouchableOpacity
                    style={styles.detailDeleteFullBtn}
                    onPress={() => {
                      setDetailModalVisible(false);
                      handleDeleteApplication(viewingApp);
                    }}
                    disabled={processing}
                    activeOpacity={0.8}
                  >
                    <View style={styles.detailDeleteFullBtnInner}>
                      <Ionicons name="trash-outline" size={20} color="#6B7280" />
                      <Text style={styles.detailDeleteFullBtnText}>Delete Application</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Rejection Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.actionModalContent}>
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              style={styles.modalHeaderGradient}
            >
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Reject Application</Text>
                  <Text style={styles.modalSubtitle}>Provide feedback to applicant</Text>
                </View>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            <View style={styles.modalBody}>
              <View style={styles.applicantInfoCard}>
                <Text style={styles.applicantInfoLabel}>Applicant</Text>
                <Text style={styles.applicantInfoName}>{selectedApp?.full_name}</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Reason for Rejection *</Text>
                <View style={[styles.inputWrap, styles.textAreaWrap]}>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={rejectionReason}
                    onChangeText={setRejectionReason}
                    placeholder="Provide a detailed reason for rejection..."
                    placeholderTextColor={ADMIN_COLORS.textMuted}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={submitRejection}
                  disabled={processing}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#EF4444', '#DC2626']}
                    style={styles.submitBtnGradient}
                  >
                    {processing ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="close-circle" size={18} color="#FFF" />
                        <Text style={styles.submitBtnText}>Reject</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Revocation Modal */}
      <Modal
        visible={revokeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRevokeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.actionModalContent}>
            <LinearGradient
              colors={['#F59E0B', '#D97706']}
              style={styles.modalHeaderGradient}
            >
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Revoke Verification</Text>
                  <Text style={styles.modalSubtitle}>Remove rescuer access</Text>
                </View>
                <TouchableOpacity onPress={() => setRevokeModalVisible(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            <View style={styles.modalBody}>
              <View style={styles.applicantInfoCard}>
                <Text style={styles.applicantInfoLabel}>Rescuer</Text>
                <Text style={styles.applicantInfoName}>{selectedApp?.full_name}</Text>
              </View>

              <View style={styles.warningCard}>
                <Ionicons name="warning" size={24} color="#F59E0B" />
                <Text style={styles.warningText}>
                  This rescuer will lose access to rescue reports. They can reapply after addressing the issues.
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Reason for Revocation *</Text>
                <View style={[styles.inputWrap, styles.textAreaWrap]}>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={revocationReason}
                    onChangeText={setRevocationReason}
                    placeholder="Provide a detailed reason for revocation..."
                    placeholderTextColor={ADMIN_COLORS.textMuted}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setRevokeModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={submitRevocation}
                  disabled={processing}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#D97706']}
                    style={styles.submitBtnGradient}
                  >
                    {processing ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="shield-outline" size={18} color="#FFF" />
                        <Text style={styles.submitBtnText}>Revoke Access</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
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
  decorEmoji: { fontSize: 36 },
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
  headerTitleWrap: { flex: 1, marginLeft: 16 },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
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
  headerBadgeText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 14,
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statEmoji: { fontSize: 18, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, color: ADMIN_COLORS.textLight, fontWeight: '600', marginTop: 2 },
  filterRow: { 
    paddingLeft: 16, 
    marginTop: 14,
    marginBottom: 6,
    maxHeight: 48,
  },
  filterContent: { paddingRight: 16, gap: 8 },
  searchContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: ADMIN_COLORS.text,
    fontWeight: '500',
    paddingVertical: 0,
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 8 },
  card: {
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarWrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: ADMIN_COLORS.background,
  },
  avatarGradient: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  headerInfo: { flex: 1, marginLeft: 12 },
  applicantName: { fontSize: 15, fontWeight: '700', color: ADMIN_COLORS.text },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  applicantDate: { fontSize: 11, color: ADMIN_COLORS.textMuted, marginLeft: 4, fontWeight: '500' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  statusEmoji: { fontSize: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },
  contactSection: { marginBottom: 14 },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactText: { flex: 1, fontSize: 14, color: ADMIN_COLORS.textLight, fontWeight: '500' },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ADMIN_COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  pillEmoji: { fontSize: 14 },
  pillText: { fontSize: 12, color: ADMIN_COLORS.textLight, fontWeight: '600' },
  previewSection: {
    backgroundColor: ADMIN_COLORS.background,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  previewLabel: { fontSize: 12, fontWeight: '700', color: ADMIN_COLORS.text, marginBottom: 6 },
  previewText: { fontSize: 13, color: ADMIN_COLORS.textLight, lineHeight: 20 },
  actionsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  viewBtn: { borderRadius: 10, overflow: 'hidden' },
  actionBtn: { borderRadius: 10, overflow: 'hidden' },
  approveBtn: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  revokeBtn: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  reactivateBtn: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  actionBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 5,
  },
  smallActionBtnGradient: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  loadingText: { fontSize: 16, color: ADMIN_COLORS.textLight, fontWeight: '600' },
  loadingEmoji: { fontSize: 28, marginTop: 12 },
  emptyContainer: {
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
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: ADMIN_COLORS.text, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: ADMIN_COLORS.textLight, textAlign: 'center', paddingHorizontal: 40, marginBottom: 20 },
  emptyButton: {
    backgroundColor: ADMIN_COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  footer: { alignItems: 'center', marginTop: 24, paddingHorizontal: 20 },
  footerEmoji: { fontSize: 24, marginBottom: 8 },
  footerText: { fontSize: 13, color: ADMIN_COLORS.textMuted, fontWeight: '500' },
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  detailModalContent: { 
    backgroundColor: ADMIN_COLORS.background, 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    height: '94%',
    overflow: 'hidden',
  },
  actionModalContent: { backgroundColor: ADMIN_COLORS.background, borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  modalHeaderGradient: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 24, paddingBottom: 20, paddingHorizontal: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  modalSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4, fontWeight: '500' },
  modalCloseBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  modalBody: { padding: 24 },
  detailStatusRow: { alignItems: 'center', marginBottom: 20 },
  detailStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  detailStatusEmoji: { fontSize: 16 },
  detailStatusText: { fontSize: 14, fontWeight: '700' },
  detailSection: { marginBottom: 24 },
  detailSectionTitle: { fontSize: 16, fontWeight: '700', color: ADMIN_COLORS.text, marginBottom: 14 },
  detailCard: {
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.border,
  },
  detailRowContent: { flex: 1, marginLeft: 14 },
  detailRowLabel: { fontSize: 12, color: ADMIN_COLORS.textMuted, fontWeight: '500', marginBottom: 2 },
  detailRowValue: { fontSize: 15, color: ADMIN_COLORS.text, fontWeight: '600', lineHeight: 22 },
  detailTextBlock: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: ADMIN_COLORS.border },
  detailBlockLabel: { fontSize: 13, fontWeight: '700', color: ADMIN_COLORS.text, marginBottom: 8 },
  detailBlockText: { fontSize: 14, color: ADMIN_COLORS.textLight, lineHeight: 22 },
  availabilityChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  availabilityChip: {
    backgroundColor: ADMIN_COLORS.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.primary + '30',
  },
  availabilityChipText: {
    fontSize: 12,
    color: ADMIN_COLORS.primary,
    fontWeight: '600',
  },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  reasonText: { flex: 1, fontSize: 14, color: ADMIN_COLORS.text, lineHeight: 22, marginLeft: 12 },
  applicantInfoCard: {
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  applicantInfoLabel: { fontSize: 12, color: ADMIN_COLORS.textMuted, fontWeight: '500', marginBottom: 4 },
  applicantInfoName: { fontSize: 18, fontWeight: '700', color: ADMIN_COLORS.text },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  warningText: { flex: 1, fontSize: 14, color: '#92400E', marginLeft: 12, lineHeight: 22 },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: ADMIN_COLORS.textLight, marginBottom: 10 },
  inputWrap: {
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: ADMIN_COLORS.border,
  },
  textAreaWrap: { padding: 16 },
  input: { fontSize: 15, color: ADMIN_COLORS.text, fontWeight: '500' },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: ADMIN_COLORS.card,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: ADMIN_COLORS.border,
  },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: ADMIN_COLORS.textLight },
  submitBtn: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  submitBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  
  // Professional Detail Modal Styles
  detailModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 20,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.border,
    backgroundColor: ADMIN_COLORS.card,
  },
  detailModalDragIndicator: {
    width: 36,
    height: 5,
    backgroundColor: ADMIN_COLORS.border,
    borderRadius: 3,
  },
  detailModalCloseBtn: {
    position: 'absolute',
    right: 16,
    top: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ADMIN_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  detailModalBody: {
    flex: 1,
    minHeight: 0,
  },
  detailModalScrollContent: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  detailModalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: ADMIN_COLORS.border,
    backgroundColor: ADMIN_COLORS.card,
  },
  detailRejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 8,
  },
  detailRejectBtnText: {
    fontSize: 15,
    fontWeight: '700',
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
    paddingHorizontal: 20,
    gap: 8,
  },
  detailApproveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  detailRevokeFullBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  detailRevokeBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
  },
  detailRevokeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  detailDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: ADMIN_COLORS.background,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    gap: 8,
  },
  detailDeleteBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  detailReactivateBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  detailReactivateBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
  },
  detailReactivateBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  detailDeleteFullBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  detailDeleteFullBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: ADMIN_COLORS.background,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    borderRadius: 14,
    gap: 8,
  },
  detailDeleteFullBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  
  // Profile Header Card
  profileHeaderCard: {
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  profileAvatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: ADMIN_COLORS.background,
    borderWidth: 3,
    borderColor: ADMIN_COLORS.card,
  },
  profileStatusIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: ADMIN_COLORS.card,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: ADMIN_COLORS.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  profileEmail: {
    fontSize: 14,
    color: ADMIN_COLORS.textMuted,
    marginBottom: 12,
  },
  profileStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 20,
  },
  profileStatusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  profileQuickStats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: ADMIN_COLORS.border,
  },
  profileQuickStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 8,
  },
  profileQuickStatDivider: {
    width: 1,
    height: '100%',
    backgroundColor: ADMIN_COLORS.border,
    alignSelf: 'center',
  },
  quickStatIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickStatTextWrap: {
    flex: 1,
  },
  quickStatLabel: {
    fontSize: 11,
    color: ADMIN_COLORS.textMuted,
    fontWeight: '500',
    marginBottom: 2,
  },
  quickStatValue: {
    fontSize: 12,
    color: ADMIN_COLORS.text,
    fontWeight: '700',
  },
  
  // Professional Section Styles
  detailSectionPro: {
    marginBottom: 20,
  },
  detailSectionHeaderPro: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  sectionIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailSectionTitlePro: {
    fontSize: 15,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
  },
  detailCardPro: {
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  detailItemPro: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  detailItemIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: ADMIN_COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailItemContent: {
    flex: 1,
  },
  detailItemLabel: {
    fontSize: 11,
    color: ADMIN_COLORS.textMuted,
    fontWeight: '500',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailItemValue: {
    fontSize: 15,
    color: ADMIN_COLORS.text,
    fontWeight: '600',
    lineHeight: 20,
  },
  detailItemValueMono: {
    fontSize: 13,
    color: ADMIN_COLORS.text,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  detailItemDivider: {
    height: 1,
    backgroundColor: ADMIN_COLORS.border,
    marginLeft: 62,
  },
  
  // Text Block Styles
  textBlockPro: {
    padding: 16,
  },
  textBlockLabel: {
    fontSize: 12,
    color: ADMIN_COLORS.textMuted,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textBlockValue: {
    fontSize: 14,
    color: ADMIN_COLORS.textLight,
    lineHeight: 22,
  },
  textBlockDivider: {
    height: 1,
    backgroundColor: ADMIN_COLORS.border,
  },
  
  // Availability Grid
  availabilityGridPro: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  availabilityChipPro: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  availabilityChipEmergency: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  availabilityChipTextPro: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
  },
  availabilityChipTextEmergency: {
    color: '#DC2626',
  },
  
  // Timeline Styles
  timelineCard: {
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: ADMIN_COLORS.primary,
    marginTop: 4,
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 14,
    color: ADMIN_COLORS.text,
    fontWeight: '600',
    marginBottom: 2,
  },
  timelineDate: {
    fontSize: 12,
    color: ADMIN_COLORS.textMuted,
    fontWeight: '500',
  },
  
  // Reason Card Pro
  reasonCardPro: {
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  reasonTextPro: {
    fontSize: 14,
    color: '#991B1B',
    lineHeight: 22,
  },
});

export default memo(AdminRescuerApplicationsScreen);
