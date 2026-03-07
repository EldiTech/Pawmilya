import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
  TextInput,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import CONFIG from '../../config/config';
import {
  ADMIN_COLORS,
  SCREEN_WIDTH,
  URGENCY_CONFIG,
  RESCUE_STATUS_CONFIG,
  RESCUE_ACTION_LABELS,
  formatTimeAgo,
  formatDate as formatDateUtil,
  useFadeAnimation,
  getCountByField,
  getImageUrl as getImageUrlUtil,
} from './shared';

const STATUS_CONFIG = RESCUE_STATUS_CONFIG;
const ACTION_LABELS = RESCUE_ACTION_LABELS;

// Wrapper for image URL helper
const getImageUrl = (imagePath) => getImageUrlUtil(imagePath, CONFIG.API_URL);

const formatDate = (dateString) => formatDateUtil(dateString, { includeTime: true, fallback: '' });

const AdminRescuesScreen = ({ onGoBack, adminToken }) => {
  const [filter, setFilter] = useState('all');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { fadeAnim } = useFadeAnimation();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [statusDropdownVisible, setStatusDropdownVisible] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    animal_type: '',
    location_description: '',
    urgency: 'normal',
  });
  const [verificationModalVisible, setVerificationModalVisible] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [verifyingReport, setVerifyingReport] = useState(null);
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyReportId, setHistoryReportId] = useState(null);

  // Memoized filtered list
  const filtered = useMemo(() => 
    reports.filter(r => filter === 'all' || r.status === filter),
    [reports, filter]
  );

  // Memoized status counts
  const getStatusCount = useCallback((status) => 
    getCountByField(reports, 'status', status),
    [reports]
  );

  useEffect(() => {
    fetchReports();
  }, [filter, adminToken]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      let url = `${CONFIG.API_URL}/admin/rescues?limit=50`;
      if (filter !== 'all') {
        url += `&status=${filter}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();

      if (Array.isArray(data)) {
        setReports(data.map(report => ({
          id: report.id,
          type: report.animal_type || 'Unknown',
          title: report.title,
          description: report.description,
          location: report.location_description || report.city || 'Unknown location',
          urgency: report.urgency || 'normal',
          status: report.status || 'new',
          images: report.images || [],
          time: formatTimeAgo(report.created_at),
          date: formatDate(report.created_at),
          reporter_id: report.reporter_id,
          reporter_name: report.reporter_name,
          reporter_phone: report.reporter_phone,
          reporter_email: report.reporter_email,
          rescuer_id: report.rescuer_id,
          rescuer_name: report.rescuer_name,
          completion_photo: report.completion_photo,
          submitted_for_verification_at: report.submitted_for_verification_at,
          resolution_notes: report.resolution_notes,
        })));
      }
    } catch (error) {
      console.error('Error fetching rescue reports:', error);
      Alert.alert('Error', 'Failed to load rescue reports');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchReports();
    setRefreshing(false);
  }, [filter]);

  const fetchHistory = async (reportId) => {
    try {
      setHistoryLoading(true);
      setHistoryReportId(reportId);
      const response = await fetch(`${CONFIG.API_URL}/admin/rescues/${reportId}/history`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setHistoryData(data);
      } else {
        setHistoryData([]);
      }
      setHistoryModalVisible(true);
    } catch (error) {
      console.error('Error fetching history:', error);
      Alert.alert('Error', 'Failed to load mission history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const response = await fetch(`${CONFIG.API_URL}/admin/rescues/${id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setReports(reports.map(r => 
          r.id === id ? { ...r, status: newStatus } : r
        ));
        setStatusDropdownVisible(null);
        Alert.alert('Success', `Status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
      } else {
        Alert.alert('Error', data.error || 'Failed to update status');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const handleView = (report) => {
    setSelectedReport(report);
    setCurrentImageIndex(0);
    setViewModalVisible(true);
  };

  const handleEdit = (report) => {
    setSelectedReport(report);
    setEditForm({
      title: report.title,
      description: report.description,
      animal_type: report.type,
      location_description: report.location,
      urgency: report.urgency,
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`${CONFIG.API_URL}/admin/rescues/${selectedReport.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      });

      const data = await response.json();

      if (response.ok) {
        await fetchReports();
        setEditModalVisible(false);
        Alert.alert('Success', 'Report updated successfully');
      } else {
        Alert.alert('Error', data.error || 'Failed to update report');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update report');
    }
  };

  const handleDelete = (id, title) => {
    Alert.alert(
      'Delete Report',
      `Are you sure you want to delete "${title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${CONFIG.API_URL}/admin/rescues/${id}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${adminToken}`,
                },
              });

              if (response.ok) {
                setReports(reports.filter(r => r.id !== id));
                Alert.alert('Deleted', 'Report deleted successfully');
              } else {
                Alert.alert('Error', 'Failed to delete report');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete report');
            }
          }
        },
      ]
    );
  };

  // Handle rescuer adoption request approve/reject
  const handleAdoptionAction = (report, action) => {
    const actionText = action === 'approve' ? 'approve' : 'reject';
    const title = action === 'approve' 
      ? 'Approve Adoption' 
      : 'Reject Adoption';
    const message = action === 'approve'
      ? `Approve ${report.rescuer_name || 'the rescuer'} to adopt this rescued animal?`
      : `Reject ${report.rescuer_name || 'the rescuer'}'s adoption request?`;

    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'approve' ? 'Approve' : 'Reject',
          style: action === 'approve' ? 'default' : 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${CONFIG.API_URL}/admin/rescues/${report.id}/adoption-status`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${adminToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action }),
              });

              const data = await response.json();

              if (response.ok && data.success) {
                // Update the report in the list
                setReports(reports.map(r => 
                  r.id === report.id 
                    ? { ...r, rescuer_adoption_status: action === 'approve' ? 'approved' : 'rejected' } 
                    : r
                ));
                Alert.alert(
                  'Success', 
                  action === 'approve' 
                    ? `Adoption approved for ${report.rescuer_name || 'rescuer'}!`
                    : 'Adoption request rejected.'
                );
              } else {
                Alert.alert('Error', data.error || `Failed to ${actionText} adoption`);
              }
            } catch (error) {
              console.error('Adoption action error:', error);
              Alert.alert('Error', `Failed to ${actionText} adoption`);
            }
          }
        },
      ]
    );
  };

  const openVerificationModal = (report) => {
    setVerifyingReport(report);
    setVerificationNotes('');
    setVerificationModalVisible(true);
  };

  const handleVerifyApprove = async () => {
    if (!verifyingReport) return;
    
    setSubmittingVerification(true);
    try {
      const response = await fetch(`${CONFIG.API_URL}/admin/rescues/${verifyingReport.id}/verify`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'approve',
          notes: verificationNotes || 'Verified and approved'
        }),
      });

      const data = await response.json();

      if (data.success) {
        setReports(reports.map(r => 
          r.id === verifyingReport.id ? { ...r, status: 'rescued' } : r
        ));
        setVerificationModalVisible(false);
        Alert.alert('Success', 'Rescue verified and approved!');
      } else {
        Alert.alert('Error', data.error || 'Failed to verify rescue');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to verify rescue');
    } finally {
      setSubmittingVerification(false);
    }
  };

  const handleVerifyReject = async () => {
    if (!verifyingReport) return;
    
    if (!verificationNotes.trim()) {
      Alert.alert('Notes Required', 'Please provide a reason for rejection.');
      return;
    }
    
    setSubmittingVerification(true);
    try {
      const response = await fetch(`${CONFIG.API_URL}/admin/rescues/${verifyingReport.id}/verify`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'reject',
          notes: verificationNotes
        }),
      });

      const data = await response.json();

      if (data.success) {
        setReports(reports.map(r => 
          r.id === verifyingReport.id ? { ...r, status: 'arrived' } : r
        ));
        setVerificationModalVisible(false);
        Alert.alert('Rejected', 'Verification rejected. Rescuer will be notified.');
      } else {
        Alert.alert('Error', data.error || 'Failed to reject verification');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to reject verification');
    } finally {
      setSubmittingVerification(false);
    }
  };

  const filters = [
    { key: 'all', label: 'All', icon: 'apps' },
    { key: 'new', label: 'New', icon: 'add-circle' },
    { key: 'pending_verification', label: 'Verify', icon: 'shield-checkmark' },
    { key: 'in_progress', label: 'Active', icon: 'sync' },
    { key: 'rescued', label: 'Rescued', icon: 'checkmark-circle' },
    { key: 'closed', label: 'Closed', icon: 'lock-closed' },
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
            <Text style={styles.headerTitle}>Rescue Reports</Text>
            <Text style={styles.headerSubtitle}>Manage rescue operations</Text>
          </View>
          <View style={styles.headerBadge}>
            <LinearGradient
              colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.15)']}
              style={styles.headerBadgeGradient}
            >
              <Text style={styles.headerBadgeText}>{reports.length}</Text>
            </LinearGradient>
          </View>
        </View>
      </LinearGradient>

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
            const isVerify = f.key === 'pending_verification';
            
            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.chip,
                  isActive && styles.chipActive,
                  isActive && isVerify && styles.chipVerification
                ]}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.chipIconWrap,
                  isActive && styles.chipIconWrapActive,
                  isActive && isVerify && styles.chipIconWrapVerification
                ]}>
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
                  <View style={[
                    styles.chipCount,
                    isActive && styles.chipCountActive,
                    isActive && isVerify && styles.chipCountVerification
                  ]}>
                    <Text style={[
                      styles.chipCountText,
                      isActive && styles.chipCountTextActive
                    ]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Reports List */}
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
            <Text style={styles.loadingText}>Loading rescue reports...</Text>
          </View>
        ) : filtered.length > 0 ? (
          <Animated.View style={{ opacity: fadeAnim }}>
            {filtered.map((report, index) => (
              <View key={report.id} style={styles.card}>
                {/* Report Image */}
                {report.images && report.images.length > 0 && (
                  <Image 
                    source={{ uri: getImageUrl(report.images[0]) }} 
                    style={styles.reportImage}
                    resizeMode="cover"
                  />
                )}
                
                <View style={styles.cardContent}>
                  {/* Header Row - Pet Type, Urgency, and Status */}
                  <View style={styles.cardHeader}>
                    <View style={styles.typeWrap}>
                      <View style={styles.typeIconWrap}>
                        <Ionicons name="paw" size={16} color={ADMIN_COLORS.primary} />
                      </View>
                      <Text style={styles.typeText}>{report.type}</Text>
                    </View>
                    <View style={styles.badgesRow}>
                      <View style={[
                        styles.urgencyBadge, 
                        { backgroundColor: URGENCY_CONFIG[report.urgency]?.bg || '#F5F5F5' }
                      ]}>
                        <Ionicons 
                          name={URGENCY_CONFIG[report.urgency]?.icon || 'document-text'} 
                          size={12} 
                          color={URGENCY_CONFIG[report.urgency]?.color || '#999'} 
                        />
                        <Text style={[
                          styles.urgencyText, 
                          { color: URGENCY_CONFIG[report.urgency]?.color || '#999' }
                        ]}>
                          {URGENCY_CONFIG[report.urgency]?.label || 'Normal'}
                        </Text>
                      </View>
                      <View style={[
                        styles.statusBadgeCompact, 
                        { backgroundColor: STATUS_CONFIG[report.status]?.bg || '#F5F5F5' }
                      ]}>
                        <Ionicons 
                          name={STATUS_CONFIG[report.status]?.icon || 'ellipse'} 
                          size={12} 
                          color={STATUS_CONFIG[report.status]?.color || '#999'} 
                        />
                        <Text style={[
                          styles.statusTextCompact, 
                          { color: STATUS_CONFIG[report.status]?.color || '#999' }
                        ]}>
                          {STATUS_CONFIG[report.status]?.label || report.status}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Title */}
                  {report.title && (
                    <Text style={styles.titleText} numberOfLines={2}>{report.title}</Text>
                  )}

                  {/* Rescuer Adoption Request Badge */}
                  {report.rescuer_adoption_status && (
                    <View style={[
                      styles.adoptionBadgeRow,
                      report.rescuer_adoption_status === 'requested' && styles.adoptionBadgeRequested,
                      report.rescuer_adoption_status === 'approved' && styles.adoptionBadgeApproved,
                      report.rescuer_adoption_status === 'rejected' && styles.adoptionBadgeRejected,
                    ]}>
                      <Ionicons 
                        name={
                          report.rescuer_adoption_status === 'approved' ? 'checkmark-circle' :
                          report.rescuer_adoption_status === 'rejected' ? 'close-circle' :
                          'heart'
                        } 
                        size={14} 
                        color={
                          report.rescuer_adoption_status === 'approved' ? '#10B981' :
                          report.rescuer_adoption_status === 'rejected' ? '#EF4444' :
                          '#EC4899'
                        } 
                      />
                      <Text style={[
                        styles.adoptionBadgeText,
                        report.rescuer_adoption_status === 'approved' && { color: '#10B981' },
                        report.rescuer_adoption_status === 'rejected' && { color: '#EF4444' },
                        report.rescuer_adoption_status === 'requested' && { color: '#EC4899' },
                      ]}>
                        {report.rescuer_adoption_status === 'requested' 
                          ? `🏠 ${report.rescuer_name || 'Rescuer'} wants to adopt`
                          : report.rescuer_adoption_status === 'approved'
                          ? `✅ Adopted by ${report.rescuer_name || 'Rescuer'}`
                          : `❌ Adoption rejected`
                        }
                      </Text>
                    </View>
                  )}

                  {/* Adoption Action Button */}
                  {report.rescuer_adoption_status === 'requested' && (
                    <View style={styles.adoptionActionRow}>
                      <TouchableOpacity
                        style={styles.adoptionApproveBtn}
                        onPress={() => handleAdoptionAction(report, 'approve')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="checkmark" size={16} color="#FFF" />
                        <Text style={styles.adoptionBtnText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.adoptionRejectBtn}
                        onPress={() => handleAdoptionAction(report, 'reject')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close" size={16} color="#FFF" />
                        <Text style={styles.adoptionBtnText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.actionSection}>
                    {/* Verify Button - Full Width */}
                    {report.status === 'pending_verification' && (
                      <TouchableOpacity 
                        style={styles.verifyButton}
                        onPress={() => openVerificationModal(report)}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={['#10B981', '#059669']}
                          style={styles.verifyBtnGradient}
                        >
                          <Ionicons name="checkmark-done" size={18} color="#FFF" />
                          <Text style={styles.verifyBtnText}>Verify Completion</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}

                    {/* Action Buttons Row */}
                    <View style={styles.actionButtonsRow}>
                      <TouchableOpacity 
                        style={styles.actionBtn}
                        onPress={() => handleView(report)}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={['#0984E3', '#0769C0']}
                          style={styles.actionBtnGradient}
                        >
                          <Ionicons name="eye" size={18} color="#FFF" />
                        </LinearGradient>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.actionBtn}
                        onPress={() => setStatusDropdownVisible(statusDropdownVisible === report.id ? null : report.id)}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={['#6C5CE7', '#5B4CD6']}
                          style={styles.actionBtnGradient}
                        >
                          <Ionicons name="flag" size={18} color="#FFF" />
                        </LinearGradient>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.actionBtn}
                        onPress={() => handleEdit(report)}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={['#F39C12', '#E67E22']}
                          style={styles.actionBtnGradient}
                        >
                          <Ionicons name="create-outline" size={18} color="#FFF" />
                        </LinearGradient>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.actionBtn}
                        onPress={() => fetchHistory(report.id)}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={['#9B59B6', '#8E44AD']}
                          style={styles.actionBtnGradient}
                        >
                          <Ionicons name="time" size={18} color="#FFF" />
                        </LinearGradient>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.actionBtn}
                        onPress={() => handleDelete(report.id, report.title)}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={['#E74C3C', '#C0392B']}
                          style={styles.actionBtnGradient}
                        >
                          <Ionicons name="trash" size={18} color="#FFF" />
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Status Dropdown */}
                  {statusDropdownVisible === report.id && (
                    <View style={styles.dropdownMenu}>
                      <Text style={styles.dropdownTitle}>Change Status</Text>
                      {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <TouchableOpacity
                          key={key}
                          style={[
                            styles.dropdownItem,
                            report.status === key && styles.dropdownItemActive
                          ]}
                          onPress={() => handleStatusChange(report.id, key)}
                        >
                          <Ionicons 
                            name={config.icon || 'ellipse'} 
                            size={16} 
                            color={config.color} 
                            style={{marginRight: 8}}
                          />
                          <Text style={[
                            styles.dropdownText,
                            report.status === key && { color: config.color, fontWeight: '700' }
                          ]}>
                            {config.label}
                          </Text>
                          {report.status === key && (
                            <Ionicons name="checkmark" size={18} color={config.color} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ))}
          </Animated.View>
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="medical-outline" size={48} color={ADMIN_COLORS.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No rescue reports found</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'all' 
                ? 'Rescue reports will appear here'
                : `No ${filter.replace('_', ' ')} reports at the moment`}
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
        
        {!loading && filtered.length > 0 && (
          <View style={styles.footer}>
            <Text style={styles.footerText}>Every rescue matters</Text>
          </View>
        )}
        
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={[ADMIN_COLORS.primary, ADMIN_COLORS.primaryDark]}
              style={styles.modalHeaderGradient}
            >
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Edit Report</Text>
                  <Text style={styles.modalSubtitle}>Update rescue details</Text>
                </View>
                <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Title</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="document-text-outline" size={20} color={ADMIN_COLORS.textMuted} />
                  <TextInput
                    style={styles.input}
                    value={editForm.title}
                    onChangeText={(text) => setEditForm({ ...editForm, title: text })}
                    placeholder="Report title"
                    placeholderTextColor={ADMIN_COLORS.textMuted}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Animal Type</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="paw-outline" size={20} color={ADMIN_COLORS.textMuted} />
                  <TextInput
                    style={styles.input}
                    value={editForm.animal_type}
                    onChangeText={(text) => setEditForm({ ...editForm, animal_type: text })}
                    placeholder="e.g., Dog, Cat"
                    placeholderTextColor={ADMIN_COLORS.textMuted}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <View style={[styles.inputWrap, styles.textAreaWrap]}>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={editForm.description}
                    onChangeText={(text) => setEditForm({ ...editForm, description: text })}
                    placeholder="Describe the situation"
                    placeholderTextColor={ADMIN_COLORS.textMuted}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Location</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="location-outline" size={20} color={ADMIN_COLORS.textMuted} />
                  <TextInput
                    style={styles.input}
                    value={editForm.location_description}
                    onChangeText={(text) => setEditForm({ ...editForm, location_description: text })}
                    placeholder="Location description"
                    placeholderTextColor={ADMIN_COLORS.textMuted}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Urgency</Text>
                <View style={styles.urgencyButtons}>
                  {Object.entries(URGENCY_CONFIG).map(([key, config]) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.urgencyBtn,
                        { backgroundColor: editForm.urgency === key ? config.color : config.bg }
                      ]}
                      onPress={() => setEditForm({ ...editForm, urgency: key })}
                    >
                      <Text style={styles.urgencyBtnEmoji}>{config.emoji}</Text>
                      <Text style={[
                        styles.urgencyBtnText,
                        { color: editForm.urgency === key ? '#FFF' : config.color }
                      ]}>
                        {config.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit} activeOpacity={0.8}>
                <LinearGradient
                  colors={[ADMIN_COLORS.primary, ADMIN_COLORS.primaryDark]}
                  style={styles.saveBtnGradient}
                >
                  <Ionicons name="checkmark" size={20} color="#FFF" />
                  <Text style={styles.saveBtnText}>Save</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* View Modal */}
      <Modal
        visible={viewModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setViewModalVisible(false)}
      >
        <View style={styles.viewModalOverlay}>
          <View style={styles.viewModalContent}>
            <LinearGradient
              colors={[ADMIN_COLORS.primary, ADMIN_COLORS.primaryDark]}
              style={styles.viewModalHeaderGradient}
            >
              <View style={styles.viewModalHeader}>
                <Text style={styles.viewModalTitle}>Report Details 📋</Text>
                <TouchableOpacity onPress={() => setViewModalVisible(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {selectedReport && (
              <ScrollView style={styles.viewModalScroll} showsVerticalScrollIndicator={false}>
                {/* Images */}
                {selectedReport.images && selectedReport.images.length > 0 && (
                  <View style={styles.viewImageContainer}>
                    <Image
                      source={{ uri: getImageUrl(selectedReport.images[currentImageIndex]) }}
                      style={styles.viewMainImage}
                      resizeMode="cover"
                    />
                    {selectedReport.images.length > 1 && (
                      <View style={styles.viewImageNav}>
                        <TouchableOpacity
                          style={[styles.viewImageNavBtn, currentImageIndex === 0 && styles.viewImageNavBtnDisabled]}
                          onPress={() => setCurrentImageIndex(Math.max(0, currentImageIndex - 1))}
                          disabled={currentImageIndex === 0}
                        >
                          <Ionicons name="chevron-back" size={24} color={currentImageIndex === 0 ? '#CCC' : '#333'} />
                        </TouchableOpacity>
                        <Text style={styles.viewImageCounter}>
                          {currentImageIndex + 1} / {selectedReport.images.length}
                        </Text>
                        <TouchableOpacity
                          style={[styles.viewImageNavBtn, currentImageIndex === selectedReport.images.length - 1 && styles.viewImageNavBtnDisabled]}
                          onPress={() => setCurrentImageIndex(Math.min(selectedReport.images.length - 1, currentImageIndex + 1))}
                          disabled={currentImageIndex === selectedReport.images.length - 1}
                        >
                          <Ionicons name="chevron-forward" size={24} color={currentImageIndex === selectedReport.images.length - 1 ? '#CCC' : '#333'} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}

                {/* Status Badges */}
                <View style={styles.viewBadgeRow}>
                  <View style={[styles.viewBadge, { backgroundColor: STATUS_CONFIG[selectedReport.status]?.bg }]}>
                    <Text>{STATUS_CONFIG[selectedReport.status]?.emoji}</Text>
                    <Text style={[styles.viewBadgeText, { color: STATUS_CONFIG[selectedReport.status]?.color }]}>
                      {STATUS_CONFIG[selectedReport.status]?.label}
                    </Text>
                  </View>
                  <View style={[styles.viewBadge, { backgroundColor: URGENCY_CONFIG[selectedReport.urgency]?.bg }]}>
                    <Text>{URGENCY_CONFIG[selectedReport.urgency]?.emoji}</Text>
                    <Text style={[styles.viewBadgeText, { color: URGENCY_CONFIG[selectedReport.urgency]?.color }]}>
                      {URGENCY_CONFIG[selectedReport.urgency]?.label}
                    </Text>
                  </View>
                </View>

                <Text style={styles.viewReportTitle}>{selectedReport.title}</Text>

                {/* Info Cards */}
                <View style={styles.viewInfoCard}>
                  <Ionicons name="paw" size={20} color={ADMIN_COLORS.primary} />
                  <View style={styles.viewInfoContent}>
                    <Text style={styles.viewInfoLabel}>Animal Type</Text>
                    <Text style={styles.viewInfoValue}>{selectedReport.type}</Text>
                  </View>
                </View>

                <View style={styles.viewInfoCard}>
                  <Ionicons name="location" size={20} color={ADMIN_COLORS.primary} />
                  <View style={styles.viewInfoContent}>
                    <Text style={styles.viewInfoLabel}>Location</Text>
                    <Text style={styles.viewInfoValue}>{selectedReport.location}</Text>
                  </View>
                </View>

                <View style={styles.viewInfoCard}>
                  <Ionicons name="calendar" size={20} color={ADMIN_COLORS.primary} />
                  <View style={styles.viewInfoContent}>
                    <Text style={styles.viewInfoLabel}>Reported</Text>
                    <Text style={styles.viewInfoValue}>{selectedReport.date}</Text>
                  </View>
                </View>

                {selectedReport.description && (
                  <View style={styles.viewDescriptionCard}>
                    <Text style={styles.viewDescriptionLabel}>📝 Description</Text>
                    <Text style={styles.viewDescriptionText}>{selectedReport.description}</Text>
                  </View>
                )}

                {/* Reporter Info */}
                {selectedReport.reporter_name && (
                  <View style={styles.viewReporterCard}>
                    <Text style={styles.viewReporterTitle}>👤 Reporter Info</Text>
                    <Text style={styles.viewReporterText}>Name: {selectedReport.reporter_name}</Text>
                    {selectedReport.reporter_phone && (
                      <Text style={styles.viewReporterText}>Phone: {selectedReport.reporter_phone}</Text>
                    )}
                    {selectedReport.reporter_email && (
                      <Text style={styles.viewReporterText}>Email: {selectedReport.reporter_email}</Text>
                    )}
                  </View>
                )}

                {/* Rescuer Info */}
                {selectedReport.rescuer_name && (
                  <View style={[styles.viewReporterCard, { backgroundColor: '#E8FFF3', borderLeftColor: '#00B894' }]}>
                    <Text style={styles.viewReporterTitle}>🦸 Rescuer</Text>
                    <Text style={styles.viewReporterText}>Name: {selectedReport.rescuer_name}</Text>
                  </View>
                )}

                <View style={{ height: 30 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Verification Modal */}
      <Modal
        visible={verificationModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setVerificationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.verificationModalContent}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.modalHeaderGradient}
            >
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Verify Rescue ✅</Text>
                  <Text style={styles.modalSubtitle}>Review completion proof</Text>
                </View>
                <TouchableOpacity onPress={() => setVerificationModalVisible(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {verifyingReport && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.verificationInfo}>
                  <Text style={styles.verificationTitle}>{verifyingReport.title}</Text>
                  <View style={styles.verificationMeta}>
                    <Ionicons name="location" size={14} color={ADMIN_COLORS.textLight} />
                    <Text style={styles.verificationMetaText}>{verifyingReport.location}</Text>
                  </View>
                </View>

                {verifyingReport.completion_photo ? (
                  <View style={styles.verificationPhotoSection}>
                    <Text style={styles.verificationLabel}>📸 Proof Photo</Text>
                    <Image 
                      source={{ uri: getImageUrl(verifyingReport.completion_photo) }} 
                      style={styles.verificationPhoto}
                      resizeMode="cover"
                    />
                  </View>
                ) : (
                  <View style={styles.noPhotoPlaceholder}>
                    <Ionicons name="image-outline" size={48} color={ADMIN_COLORS.textMuted} />
                    <Text style={styles.noPhotoText}>No photo uploaded</Text>
                  </View>
                )}

                {verifyingReport.resolution_notes && (
                  <View style={styles.verificationNotesSection}>
                    <Text style={styles.verificationLabel}>📝 Rescuer Notes</Text>
                    <Text style={styles.verificationNotesText}>{verifyingReport.resolution_notes}</Text>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Admin Notes (optional for approval)</Text>
                  <View style={[styles.inputWrap, styles.textAreaWrap]}>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="Add notes..."
                      placeholderTextColor={ADMIN_COLORS.textMuted}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                      value={verificationNotes}
                      onChangeText={setVerificationNotes}
                    />
                  </View>
                </View>

                <View style={styles.verificationActions}>
                  <TouchableOpacity
                    style={styles.rejectVerifyBtn}
                    onPress={handleVerifyReject}
                    disabled={submittingVerification}
                    activeOpacity={0.8}
                  >
                    {submittingVerification ? (
                      <ActivityIndicator color="#E74C3C" size="small" />
                    ) : (
                      <>
                        <Ionicons name="close-circle" size={20} color="#E74C3C" />
                        <Text style={styles.rejectVerifyText}>Reject</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.approveVerifyBtn}
                    onPress={handleVerifyApprove}
                    disabled={submittingVerification}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#10B981', '#059669']}
                      style={styles.approveVerifyGradient}
                    >
                      {submittingVerification ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                          <Text style={styles.approveVerifyText}>Approve</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                <View style={{ height: 30 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* History Modal */}
      <Modal
        visible={historyModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <View style={styles.viewModalOverlay}>
          <View style={styles.historyModalContent}>
            <LinearGradient
              colors={['#9B59B6', '#8E44AD']}
              style={styles.viewModalHeaderGradient}
            >
              <View style={styles.viewModalHeader}>
                <Text style={styles.viewModalTitle}>Mission History 📜</Text>
                <TouchableOpacity onPress={() => setHistoryModalVisible(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {historyLoading ? (
              <View style={styles.historyLoadingContainer}>
                <ActivityIndicator size="large" color="#9B59B6" />
                <Text style={styles.loadingText}>Loading history...</Text>
              </View>
            ) : historyData.length > 0 ? (
              <ScrollView style={styles.historyScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.historySubtitle}>
                  Rescue #{historyReportId} • {historyData.length} events
                </Text>
                
                <View style={styles.timelineContainer}>
                  {historyData.map((event, index) => {
                    const actionConfig = ACTION_LABELS[event.action] || { 
                      label: event.action?.replace(/_/g, ' ') || 'Unknown', 
                      icon: 'ellipse', 
                      color: '#6B7280' 
                    };
                    const eventDate = new Date(event.created_at);
                    
                    return (
                      <View key={`history-${index}`} style={styles.timelineItem}>
                        {index < historyData.length - 1 && (
                          <View style={styles.timelineLine} />
                        )}
                        
                        <View style={[styles.timelineDot, { backgroundColor: actionConfig.color }]}>
                          <Ionicons name={actionConfig.icon} size={14} color="#FFF" />
                        </View>
                        
                        <View style={styles.timelineContent}>
                          <Text style={[styles.timelineAction, { color: actionConfig.color }]}>
                            {actionConfig.label}
                          </Text>
                          <Text style={styles.timelineTime}>
                            {eventDate.toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </Text>
                          {event.performed_by_name && (
                            <Text style={styles.timelinePerformer}>
                              By: {event.performed_by_name}
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
                
                <View style={{ height: 30 }} />
              </ScrollView>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>📜</Text>
                <Text style={styles.emptyTitle}>No history found</Text>
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
  filterSection: {
    backgroundColor: ADMIN_COLORS.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    paddingTop: 14,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
    letterSpacing: 0.2,
  },
  filterSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: ADMIN_COLORS.textMuted,
  },
  filterRow: { 
    paddingLeft: 14,
    maxHeight: 48,
  },
  filterContent: { 
    paddingRight: 14,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 6,
    backgroundColor: ADMIN_COLORS.background,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipActive: { 
    backgroundColor: ADMIN_COLORS.primary,
    borderColor: ADMIN_COLORS.primaryDark,
  },
  chipVerification: { 
    backgroundColor: '#F59E0B', 
    borderColor: '#D97706',
  },
  chipIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ADMIN_COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  chipIconWrapActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  chipIconWrapVerification: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  chipText: { 
    fontSize: 13, 
    color: ADMIN_COLORS.textLight, 
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  chipTextActive: { 
    color: '#FFF',
    fontWeight: '700',
  },
  chipCount: {
    marginLeft: 8,
    backgroundColor: ADMIN_COLORS.card,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  chipCountActive: { 
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderColor: 'rgba(255,255,255,0.4)',
  },
  chipCountVerification: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderColor: 'rgba(255,255,255,0.4)',
  },
  chipCountText: { 
    fontSize: 11, 
    fontWeight: '800', 
    color: ADMIN_COLORS.textLight,
  },
  chipCountTextActive: { 
    color: '#FFF',
  },
  list: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  listContent: { paddingBottom: 10 },
  card: {
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 20,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    overflow: 'hidden',
  },
  reportImage: { width: '100%', height: 160, backgroundColor: '#F0F0F0' },
  cardContent: { padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  typeWrap: { flexDirection: 'row', alignItems: 'center' },
  typeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFF5EE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  typeText: { fontSize: 14, fontWeight: '600', color: ADMIN_COLORS.text },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 3,
  },
  urgencyEmoji: { fontSize: 12 },
  urgencyText: { fontSize: 10, fontWeight: '700' },
  statusBadgeCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 3,
  },
  statusTextCompact: { fontSize: 10, fontWeight: '700' },
  titleText: { fontSize: 15, fontWeight: '700', color: ADMIN_COLORS.text, marginBottom: 14, lineHeight: 21 },
  
  // Rescuer Adoption Badge Styles
  adoptionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
    backgroundColor: '#FDF2F8',
    borderWidth: 1,
    borderColor: '#FBCFE8',
  },
  adoptionBadgeRequested: {
    backgroundColor: '#FDF2F8',
    borderColor: '#FBCFE8',
  },
  adoptionBadgeApproved: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  adoptionBadgeRejected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  adoptionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EC4899',
    flex: 1,
  },
  adoptionActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  adoptionApproveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  adoptionRejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  adoptionBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  locationRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  locationText: { fontSize: 13, color: ADMIN_COLORS.textLight, marginLeft: 6, flex: 1 },
  timeText: { fontSize: 12, color: ADMIN_COLORS.textMuted, fontWeight: '500' },
  cardFooter: { marginBottom: 14 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusEmoji: { fontSize: 12 },
  statusText: { fontSize: 12, fontWeight: '700' },
  actionSection: {
    gap: 10,
  },
  verifyButton: { 
    borderRadius: 12, 
    overflow: 'hidden',
    marginBottom: 2,
  },
  verifyBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  verifyBtnText: { 
    color: '#FFF', 
    fontSize: 14, 
    fontWeight: '700',
  },
  actionButtonsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    gap: 8,
  },
  actionBtn: { 
    flex: 1,
    borderRadius: 12, 
    overflow: 'hidden',
  },
  actionBtnGradient: {
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    marginTop: 12,
    backgroundColor: ADMIN_COLORS.background,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  dropdownTitle: { fontSize: 12, fontWeight: '700', color: ADMIN_COLORS.textMuted, marginBottom: 10, textTransform: 'uppercase' },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  dropdownItemActive: { backgroundColor: ADMIN_COLORS.card },
  dropdownEmoji: { fontSize: 14, marginRight: 10 },
  dropdownText: { flex: 1, fontSize: 14, color: ADMIN_COLORS.text, fontWeight: '500' },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
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
  modalContent: { backgroundColor: ADMIN_COLORS.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '90%' },
  modalHeaderGradient: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 24, paddingBottom: 20, paddingHorizontal: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  modalSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4, fontWeight: '500' },
  modalCloseBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  modalBody: { padding: 24 },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: ADMIN_COLORS.textLight, marginBottom: 10 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: ADMIN_COLORS.border,
  },
  textAreaWrap: { alignItems: 'flex-start', paddingTop: 16 },
  input: { flex: 1, paddingVertical: 16, fontSize: 15, color: ADMIN_COLORS.text, marginLeft: 12, fontWeight: '500' },
  textArea: { minHeight: 100, textAlignVertical: 'top', marginLeft: 0 },
  urgencyButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  urgencyBtn: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 6,
  },
  urgencyBtnEmoji: { fontSize: 14 },
  urgencyBtnText: { fontSize: 13, fontWeight: '700' },
  modalFooter: { flexDirection: 'row', padding: 24, paddingTop: 16, gap: 12, borderTopWidth: 1, borderTopColor: ADMIN_COLORS.border, backgroundColor: ADMIN_COLORS.card },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: ADMIN_COLORS.background, alignItems: 'center', borderWidth: 1.5, borderColor: ADMIN_COLORS.border },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: ADMIN_COLORS.textLight },
  saveBtn: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  saveBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  // View Modal
  viewModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  viewModalContent: { backgroundColor: ADMIN_COLORS.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '90%' },
  viewModalHeaderGradient: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingVertical: 20, paddingHorizontal: 24 },
  viewModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  viewModalTitle: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  viewModalScroll: { padding: 20 },
  viewImageContainer: { marginBottom: 20 },
  viewMainImage: { width: '100%', height: 220, borderRadius: 20, backgroundColor: '#F0F0F0' },
  viewImageNav: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 14, gap: 20 },
  viewImageNavBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  viewImageNavBtnDisabled: { opacity: 0.4 },
  viewImageCounter: { fontSize: 15, color: ADMIN_COLORS.textLight, fontWeight: '600' },
  viewBadgeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  viewBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, gap: 6 },
  viewBadgeText: { fontSize: 12, fontWeight: '700' },
  viewReportTitle: { fontSize: 22, fontWeight: '800', color: ADMIN_COLORS.text, marginBottom: 20, lineHeight: 30 },
  viewInfoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: ADMIN_COLORS.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: ADMIN_COLORS.border },
  viewInfoContent: { marginLeft: 14, flex: 1 },
  viewInfoLabel: { fontSize: 12, color: ADMIN_COLORS.textMuted, marginBottom: 3, fontWeight: '500' },
  viewInfoValue: { fontSize: 15, fontWeight: '600', color: ADMIN_COLORS.text },
  viewDescriptionCard: { backgroundColor: ADMIN_COLORS.card, borderRadius: 16, padding: 16, marginTop: 8, marginBottom: 16, borderWidth: 1, borderColor: ADMIN_COLORS.border },
  viewDescriptionLabel: { fontSize: 14, fontWeight: '700', color: ADMIN_COLORS.text, marginBottom: 10 },
  viewDescriptionText: { fontSize: 15, color: ADMIN_COLORS.textLight, lineHeight: 24 },
  viewReporterCard: { backgroundColor: '#FFF5EE', borderRadius: 16, padding: 16, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: ADMIN_COLORS.primary },
  viewReporterTitle: { fontSize: 14, fontWeight: '700', color: ADMIN_COLORS.text, marginBottom: 10 },
  viewReporterText: { fontSize: 14, color: ADMIN_COLORS.textLight, marginBottom: 4, fontWeight: '500' },
  // Verification Modal
  verificationModalContent: { backgroundColor: ADMIN_COLORS.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '90%' },
  verificationInfo: { backgroundColor: ADMIN_COLORS.card, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: ADMIN_COLORS.border },
  verificationTitle: { fontSize: 18, fontWeight: '700', color: ADMIN_COLORS.text, marginBottom: 8 },
  verificationMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  verificationMetaText: { fontSize: 14, color: ADMIN_COLORS.textLight, marginLeft: 6, fontWeight: '500' },
  verificationPhotoSection: { marginBottom: 20 },
  verificationLabel: { fontSize: 14, fontWeight: '700', color: ADMIN_COLORS.text, marginBottom: 12 },
  verificationPhoto: { width: '100%', height: 240, borderRadius: 16, backgroundColor: '#F0F0F0' },
  noPhotoPlaceholder: { width: '100%', height: 160, backgroundColor: ADMIN_COLORS.card, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: ADMIN_COLORS.border, borderStyle: 'dashed', marginBottom: 20 },
  noPhotoText: { fontSize: 15, color: ADMIN_COLORS.textMuted, marginTop: 10, fontWeight: '500' },
  verificationNotesSection: { backgroundColor: ADMIN_COLORS.card, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: ADMIN_COLORS.border },
  verificationNotesText: { fontSize: 15, color: ADMIN_COLORS.textLight, lineHeight: 22 },
  verificationActions: { flexDirection: 'row', gap: 12 },
  rejectVerifyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, backgroundColor: '#FEE2E2', borderWidth: 1.5, borderColor: '#FECACA', gap: 8 },
  rejectVerifyText: { fontSize: 16, fontWeight: '700', color: '#E74C3C' },
  approveVerifyBtn: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  approveVerifyGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  approveVerifyText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  // History Modal
  historyModalContent: { backgroundColor: ADMIN_COLORS.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '85%', minHeight: '50%' },
  historyLoadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 70 },
  historyScroll: { flex: 1, padding: 20 },
  historySubtitle: { fontSize: 15, color: ADMIN_COLORS.textLight, marginBottom: 20, fontWeight: '600' },
  timelineContainer: { paddingLeft: 10 },
  timelineItem: { flexDirection: 'row', marginBottom: 20, position: 'relative' },
  timelineLine: { position: 'absolute', left: 15, top: 32, bottom: -20, width: 2.5, backgroundColor: ADMIN_COLORS.border },
  timelineDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 14, zIndex: 1 },
  timelineContent: { flex: 1, backgroundColor: ADMIN_COLORS.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: ADMIN_COLORS.border },
  timelineAction: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  timelineTime: { fontSize: 12, color: ADMIN_COLORS.textMuted, fontWeight: '500' },
  timelinePerformer: { fontSize: 12, color: ADMIN_COLORS.textLight, marginTop: 4, fontWeight: '500' },
});

export default memo(AdminRescuesScreen);
