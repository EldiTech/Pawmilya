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
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import CONFIG from '../../config/config';
import {
  ADMIN_COLORS,
  SCREEN_WIDTH,
  useFadeAnimation,
  formatDate,
} from './shared';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Status Configuration
const STATUS_CONFIG = {
  pending: { 
    color: '#F59E0B', 
    bg: '#FEF3C7', 
    label: 'Pending', 
    icon: 'time-outline' 
  },
  approved: { 
    color: '#3B82F6', 
    bg: '#DBEAFE', 
    label: 'Approved', 
    icon: 'checkmark-circle' 
  },
  rejected: { 
    color: '#EF4444', 
    bg: '#FEE2E2', 
    label: 'Rejected', 
    icon: 'close-circle' 
  },
  completed: { 
    color: '#10B981', 
    bg: '#D1FAE5', 
    label: 'Completed', 
    icon: 'shield-checkmark' 
  },
  cancelled: { 
    color: '#6B7280', 
    bg: '#F3F4F6', 
    label: 'Cancelled', 
    icon: 'ban' 
  },
};

// Urgency Configuration
const URGENCY_CONFIG = {
  critical: { color: '#DC2626', label: 'Critical', bg: '#FEE2E2' },
  high: { color: '#F97316', label: 'High', bg: '#FFEDD5' },
  normal: { color: '#3B82F6', label: 'Normal', bg: '#DBEAFE' },
  low: { color: '#6B7280', label: 'Low', bg: '#F3F4F6' },
};

const AdminShelterTransfersScreen = ({ onGoBack, adminToken }) => {
  const [transfers, setTransfers] = useState([]);
  const [counts, setCounts] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    completed: 0,
    cancelled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionType, setActionType] = useState(null); // 'approve', 'reject', 'complete'
  const [actionNotes, setActionNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const { fadeAnim } = useFadeAnimation();

  // Filtered transfers
  const filteredTransfers = useMemo(() => {
    let result = transfers;
    
    // Filter by status
    if (activeFilter !== 'all') {
      result = result.filter(t => t.status === activeFilter);
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.shelter_name?.toLowerCase().includes(query) ||
        t.requester_name?.toLowerCase().includes(query) ||
        t.rescue_title?.toLowerCase().includes(query) ||
        t.animal_type?.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [transfers, activeFilter, searchQuery]);

  useEffect(() => {
    fetchTransfers();
  }, []);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${CONFIG.API_URL}/shelter-transfers/admin/all`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      
      if (data.requests) {
        setTransfers(data.requests);
        setCounts(data.counts || {});
      } else {
        setTransfers([]);
      }
    } catch (error) {
      console.error('Error fetching transfers:', error);
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTransfers();
    setRefreshing(false);
  }, []);

  const handleViewDetails = async (transfer) => {
    try {
      const response = await fetch(
        `${CONFIG.API_URL}/shelter-transfers/admin/${transfer.id}`,
        {
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const data = await response.json();
      
      if (data && !data.error) {
        setSelectedTransfer(data);
        setDetailModalVisible(true);
      } else {
        setSelectedTransfer(transfer);
        setDetailModalVisible(true);
      }
    } catch (error) {
      console.error('Error fetching transfer details:', error);
      setSelectedTransfer(transfer);
      setDetailModalVisible(true);
    }
  };

  const openActionModal = (type) => {
    setActionType(type);
    setActionNotes('');
    setActionModalVisible(true);
  };

  // Delete transfer request
  const handleDelete = (transfer) => {
    Alert.alert(
      'Delete Transfer Request',
      `Are you sure you want to delete this transfer request?\n\nRequester: ${transfer.requester_name || 'Unknown'}\nShelter: ${transfer.shelter_name || 'Unknown'}\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessing(true);
              const response = await fetch(
                `${CONFIG.API_URL}/shelter-transfers/admin/${transfer.id}`,
                {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                  },
                }
              );

              const data = await response.json();

              if (data.success) {
                Alert.alert('Deleted', 'Transfer request has been deleted');
                setDetailModalVisible(false);
                fetchTransfers();
              } else {
                throw new Error(data.error || 'Failed to delete');
              }
            } catch (error) {
              console.error('Error deleting transfer:', error);
              Alert.alert('Error', error.message || 'Failed to delete transfer request');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleAction = async () => {
    if (actionType === 'reject' && !actionNotes.trim()) {
      Alert.alert('Required', 'Please provide a reason for rejection');
      return;
    }

    try {
      setProcessing(true);
      
      let endpoint = '';
      let body = {};
      
      switch (actionType) {
        case 'approve':
          endpoint = `${CONFIG.API_URL}/shelter-transfers/admin/${selectedTransfer.id}/approve`;
          body = { review_notes: actionNotes };
          break;
        case 'reject':
          endpoint = `${CONFIG.API_URL}/shelter-transfers/admin/${selectedTransfer.id}/reject`;
          body = { rejection_reason: actionNotes, review_notes: '' };
          break;
        case 'complete':
          endpoint = `${CONFIG.API_URL}/shelter-transfers/admin/${selectedTransfer.id}/complete`;
          body = { completion_notes: actionNotes };
          break;
        default:
          return;
      }

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        const actionLabels = {
          approve: 'approved',
          reject: 'rejected',
          complete: 'completed',
        };
        Alert.alert('Success', `Transfer request ${actionLabels[actionType]} successfully`);
        setActionModalVisible(false);
        setDetailModalVisible(false);
        fetchTransfers();
      } else {
        throw new Error(data.error || 'Action failed');
      }
    } catch (error) {
      console.error('Error performing action:', error);
      Alert.alert('Error', error.message || 'Failed to perform action');
    } finally {
      setProcessing(false);
    }
  };

  const renderFilterTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterContainer}
      contentContainerStyle={styles.filterContent}
    >
      {[
        { key: 'all', label: 'All', count: counts.total },
        { key: 'pending', label: 'Pending', count: counts.pending },
        { key: 'approved', label: 'Approved', count: counts.approved },
        { key: 'completed', label: 'Completed', count: counts.completed },
        { key: 'rejected', label: 'Rejected', count: counts.rejected },
      ].map((filter) => (
        <TouchableOpacity
          key={filter.key}
          style={[
            styles.filterTab,
            activeFilter === filter.key && styles.filterTabActive,
          ]}
          onPress={() => setActiveFilter(filter.key)}
        >
          <Text
            style={[
              styles.filterTabText,
              activeFilter === filter.key && styles.filterTabTextActive,
            ]}
          >
            {filter.label} ({filter.count || 0})
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderTransferCard = (transfer) => {
    const status = STATUS_CONFIG[transfer.status] || STATUS_CONFIG.pending;
    const urgency = URGENCY_CONFIG[transfer.urgency] || URGENCY_CONFIG.normal;
    
    return (
      <TouchableOpacity
        key={transfer.id}
        style={styles.card}
        onPress={() => handleViewDetails(transfer)}
        activeOpacity={0.8}
      >
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <Ionicons name={status.icon} size={14} color={status.color} />
              <Text style={[styles.statusText, { color: status.color }]}>
                {status.label}
              </Text>
            </View>
            <View style={[styles.urgencyBadge, { backgroundColor: urgency.bg }]}>
              <Text style={[styles.urgencyText, { color: urgency.color }]}>
                {urgency.label}
              </Text>
            </View>
          </View>
          <Text style={styles.cardDate}>
            {formatDate(transfer.created_at)}
          </Text>
        </View>

        {/* Animal Info */}
        <View style={styles.cardBody}>
          <View style={styles.animalRow}>
            {transfer.images && transfer.images[0] ? (
              <Image
                source={{ uri: transfer.images[0] }}
                style={styles.animalImage}
              />
            ) : (
              <View style={[styles.animalImage, styles.animalImagePlaceholder]}>
                <MaterialCommunityIcons name="paw" size={24} color={ADMIN_COLORS.textSecondary} />
              </View>
            )}
            <View style={styles.animalInfo}>
              <Text style={styles.rescueTitle} numberOfLines={1}>
                {transfer.rescue_title || `Rescue #${transfer.rescue_report_id}`}
              </Text>
              <Text style={styles.animalType}>
                {transfer.animal_type || 'Animal'} • {transfer.animal_condition || 'Unknown condition'}
              </Text>
            </View>
          </View>
        </View>

        {/* Shelter & Requester Info */}
        <View style={styles.cardFooter}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="home-city" size={16} color={ADMIN_COLORS.primary} />
            <Text style={styles.infoText} numberOfLines={1}>
              {transfer.shelter_name || 'Unknown Shelter'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="person" size={16} color={ADMIN_COLORS.textSecondary} />
            <Text style={styles.infoText} numberOfLines={1}>
              {transfer.requester_name || 'Unknown Rescuer'}
            </Text>
          </View>
        </View>

        {/* Quick Actions for Pending */}
        {transfer.status === 'pending' && (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickActionBtn, styles.approveQuickBtn]}
              onPress={(e) => {
                e.stopPropagation();
                setSelectedTransfer(transfer);
                openActionModal('approve');
              }}
            >
              <Ionicons name="checkmark" size={18} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickActionBtn, styles.rejectQuickBtn]}
              onPress={(e) => {
                e.stopPropagation();
                setSelectedTransfer(transfer);
                openActionModal('reject');
              }}
            >
              <Ionicons name="close" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={ADMIN_COLORS.primary} />

      {/* Header */}
      <LinearGradient
        colors={[ADMIN_COLORS.primary, ADMIN_COLORS.primaryDark]}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <Text style={styles.headerTitleText}>Shelter Transfers</Text>
            <Text style={styles.headerSubtitle}>
              {counts.pending || 0} pending requests
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={ADMIN_COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by shelter, rescuer, or animal..."
            placeholderTextColor={ADMIN_COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={ADMIN_COLORS.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </LinearGradient>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#F59E0B' }]}>{counts.pending || 0}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#3B82F6' }]}>{counts.approved || 0}</Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#10B981' }]}>{counts.completed || 0}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#EF4444' }]}>{counts.rejected || 0}</Text>
          <Text style={styles.statLabel}>Rejected</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      {renderFilterTabs()}

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ADMIN_COLORS.primary} />
          <Text style={styles.loadingText}>Loading transfer requests...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[ADMIN_COLORS.primary]}
            />
          }
        >
          {filteredTransfers.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="transfer" size={64} color={ADMIN_COLORS.textSecondary} />
              <Text style={styles.emptyTitle}>No Transfer Requests</Text>
              <Text style={styles.emptySubtitle}>
                {activeFilter !== 'all'
                  ? `No ${activeFilter} transfer requests found`
                  : 'Transfer requests will appear here'}
              </Text>
            </View>
          ) : (
            filteredTransfers.map(renderTransferCard)
          )}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {/* Detail Modal */}
      <Modal
        visible={detailModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <LinearGradient
              colors={[ADMIN_COLORS.primary, ADMIN_COLORS.primaryDark]}
              style={styles.modalHeader}
            >
              <View>
                <Text style={styles.modalTitle}>Transfer Request Details</Text>
                {selectedTransfer && (
                  <Text style={styles.modalSubtitle}>
                    ID: #{selectedTransfer.id}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setDetailModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {selectedTransfer && (
                <>
                  {/* Status & Urgency */}
                  <View style={styles.detailSection}>
                    <View style={styles.statusRow}>
                      <View style={[
                        styles.detailStatusBadge,
                        { backgroundColor: STATUS_CONFIG[selectedTransfer.status]?.bg }
                      ]}>
                        <Ionicons
                          name={STATUS_CONFIG[selectedTransfer.status]?.icon}
                          size={16}
                          color={STATUS_CONFIG[selectedTransfer.status]?.color}
                        />
                        <Text style={[
                          styles.detailStatusText,
                          { color: STATUS_CONFIG[selectedTransfer.status]?.color }
                        ]}>
                          {STATUS_CONFIG[selectedTransfer.status]?.label}
                        </Text>
                      </View>
                      <View style={[
                        styles.detailUrgencyBadge,
                        { backgroundColor: URGENCY_CONFIG[selectedTransfer.urgency]?.bg }
                      ]}>
                        <Text style={[
                          styles.detailUrgencyText,
                          { color: URGENCY_CONFIG[selectedTransfer.urgency]?.color }
                        ]}>
                          {URGENCY_CONFIG[selectedTransfer.urgency]?.label} Priority
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Animal Info */}
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Rescued Animal</Text>
                    <View style={styles.detailCard}>
                      {(selectedTransfer.images?.[0] || selectedTransfer.rescue_images?.[0]) && (
                        <Image
                          source={{ uri: selectedTransfer.images?.[0] || selectedTransfer.rescue_images?.[0] }}
                          style={styles.detailImage}
                        />
                      )}
                      <View style={styles.detailRow}>
                        <Ionicons name="document-text" size={18} color={ADMIN_COLORS.textSecondary} />
                        <Text style={styles.detailLabel}>Title:</Text>
                        <Text style={styles.detailValue}>
                          {selectedTransfer.rescue_title || `Rescue #${selectedTransfer.rescue_report_id}`}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <MaterialCommunityIcons name="paw" size={18} color={ADMIN_COLORS.textSecondary} />
                        <Text style={styles.detailLabel}>Type:</Text>
                        <Text style={styles.detailValue}>
                          {selectedTransfer.animal_type || 'Not specified'}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Ionicons name="fitness" size={18} color={ADMIN_COLORS.textSecondary} />
                        <Text style={styles.detailLabel}>Condition:</Text>
                        <Text style={styles.detailValue}>
                          {selectedTransfer.animal_condition || 'Unknown'}
                        </Text>
                      </View>
                      {selectedTransfer.animal_description && (
                        <View style={styles.descriptionBox}>
                          <Text style={styles.descriptionText}>
                            {selectedTransfer.animal_description}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Shelter Info */}
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Destination Shelter</Text>
                    <View style={styles.detailCard}>
                      <View style={styles.detailRow}>
                        <MaterialCommunityIcons name="home-city" size={18} color={ADMIN_COLORS.primary} />
                        <Text style={styles.detailLabel}>Name:</Text>
                        <Text style={[styles.detailValue, { color: ADMIN_COLORS.primary, fontWeight: '600' }]}>
                          {selectedTransfer.shelter_name}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Ionicons name="location" size={18} color={ADMIN_COLORS.textSecondary} />
                        <Text style={styles.detailLabel}>Address:</Text>
                        <Text style={styles.detailValue}>
                          {selectedTransfer.shelter_address || 'Not provided'}
                        </Text>
                      </View>
                      {selectedTransfer.shelter_phone && (
                        <View style={styles.detailRow}>
                          <Ionicons name="call" size={18} color={ADMIN_COLORS.textSecondary} />
                          <Text style={styles.detailLabel}>Phone:</Text>
                          <Text style={styles.detailValue}>
                            {selectedTransfer.shelter_phone}
                          </Text>
                        </View>
                      )}
                      {selectedTransfer.shelter_hours && (
                        <View style={styles.detailRow}>
                          <Ionicons name="time" size={18} color={ADMIN_COLORS.textSecondary} />
                          <Text style={styles.detailLabel}>Hours:</Text>
                          <Text style={styles.detailValue}>
                            {selectedTransfer.shelter_hours}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Requester Info */}
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Rescuer / Requester</Text>
                    <View style={styles.detailCard}>
                      <View style={styles.detailRow}>
                        <Ionicons name="person" size={18} color={ADMIN_COLORS.textSecondary} />
                        <Text style={styles.detailLabel}>Name:</Text>
                        <Text style={styles.detailValue}>
                          {selectedTransfer.requester_name || 'Unknown'}
                        </Text>
                      </View>
                      {selectedTransfer.requester_phone && (
                        <View style={styles.detailRow}>
                          <Ionicons name="call" size={18} color={ADMIN_COLORS.textSecondary} />
                          <Text style={styles.detailLabel}>Phone:</Text>
                          <Text style={styles.detailValue}>
                            {selectedTransfer.requester_phone}
                          </Text>
                        </View>
                      )}
                      {selectedTransfer.requester_email && (
                        <View style={styles.detailRow}>
                          <Ionicons name="mail" size={18} color={ADMIN_COLORS.textSecondary} />
                          <Text style={styles.detailLabel}>Email:</Text>
                          <Text style={styles.detailValue}>
                            {selectedTransfer.requester_email}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Notes */}
                  {selectedTransfer.notes && (
                    <View style={styles.detailSection}>
                      <Text style={styles.sectionTitle}>Transfer Notes</Text>
                      <View style={styles.notesBox}>
                        <Text style={styles.notesText}>{selectedTransfer.notes}</Text>
                      </View>
                    </View>
                  )}

                  {/* Review Info (if reviewed) */}
                  {selectedTransfer.reviewed_at && (
                    <View style={styles.detailSection}>
                      <Text style={styles.sectionTitle}>Review Information</Text>
                      <View style={styles.detailCard}>
                        <View style={styles.detailRow}>
                          <Ionicons name="person-circle" size={18} color={ADMIN_COLORS.textSecondary} />
                          <Text style={styles.detailLabel}>Reviewed By:</Text>
                          <Text style={styles.detailValue}>
                            {selectedTransfer.reviewer_name || 'Admin'}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Ionicons name="calendar" size={18} color={ADMIN_COLORS.textSecondary} />
                          <Text style={styles.detailLabel}>Reviewed At:</Text>
                          <Text style={styles.detailValue}>
                            {formatDate(selectedTransfer.reviewed_at)}
                          </Text>
                        </View>
                        {selectedTransfer.review_notes && (
                          <View style={styles.notesBox}>
                            <Text style={styles.notesLabel}>Review Notes:</Text>
                            <Text style={styles.notesText}>{selectedTransfer.review_notes}</Text>
                          </View>
                        )}
                        {selectedTransfer.rejection_reason && (
                          <View style={[styles.notesBox, { backgroundColor: '#FEE2E2' }]}>
                            <Text style={[styles.notesLabel, { color: '#DC2626' }]}>Rejection Reason:</Text>
                            <Text style={[styles.notesText, { color: '#7F1D1D' }]}>
                              {selectedTransfer.rejection_reason}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Timestamps */}
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Timeline</Text>
                    <View style={styles.detailCard}>
                      <View style={styles.detailRow}>
                        <Ionicons name="create" size={18} color={ADMIN_COLORS.textSecondary} />
                        <Text style={styles.detailLabel}>Requested:</Text>
                        <Text style={styles.detailValue}>
                          {formatDate(selectedTransfer.created_at)}
                        </Text>
                      </View>
                      {selectedTransfer.completed_at && (
                        <View style={styles.detailRow}>
                          <Ionicons name="checkmark-done" size={18} color="#10B981" />
                          <Text style={styles.detailLabel}>Completed:</Text>
                          <Text style={[styles.detailValue, { color: '#10B981' }]}>
                            {formatDate(selectedTransfer.completed_at)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={{ height: 100 }} />
                </>
              )}
            </ScrollView>

            {/* Action Buttons */}
            {selectedTransfer && (
              <View style={styles.modalFooter}>
                {selectedTransfer.status === 'pending' && (
                  <>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.rejectBtn]}
                      onPress={() => openActionModal('reject')}
                    >
                      <Ionicons name="close-circle" size={18} color="#FFF" />
                      <Text style={styles.actionBtnText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.approveBtn]}
                      onPress={() => openActionModal('approve')}
                    >
                      <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                      <Text style={styles.actionBtnText}>Approve</Text>
                    </TouchableOpacity>
                  </>
                )}
                {selectedTransfer.status === 'approved' && (
                  <>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.completeBtn]}
                      onPress={() => openActionModal('complete')}
                    >
                      <Ionicons name="shield-checkmark" size={18} color="#FFF" />
                      <Text style={styles.actionBtnText}>Mark as Completed</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.deleteBtn]}
                      onPress={() => handleDelete(selectedTransfer)}
                      disabled={processing}
                    >
                      <Ionicons name="trash" size={18} color="#FFF" />
                    </TouchableOpacity>
                  </>
                )}
                {(selectedTransfer.status === 'completed' || 
                  selectedTransfer.status === 'rejected' ||
                  selectedTransfer.status === 'cancelled') && (
                  <>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.deleteBtn]}
                      onPress={() => handleDelete(selectedTransfer)}
                      disabled={processing}
                    >
                      <Ionicons name="trash" size={18} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: ADMIN_COLORS.textSecondary, flex: 1 }]}
                      onPress={() => setDetailModalVisible(false)}
                    >
                      <Text style={styles.actionBtnText}>Close</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Action Modal */}
      <Modal
        visible={actionModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActionModalVisible(false)}
      >
        <View style={styles.actionModalOverlay}>
          <View style={styles.actionModalContainer}>
            <Text style={styles.actionModalTitle}>
              {actionType === 'approve' && 'Approve Transfer Request'}
              {actionType === 'reject' && 'Reject Transfer Request'}
              {actionType === 'complete' && 'Complete Transfer'}
            </Text>
            
            <Text style={styles.actionModalSubtitle}>
              {actionType === 'approve' && 'The rescuer will be notified and can proceed to bring the animal to the shelter.'}
              {actionType === 'reject' && 'Please provide a reason for rejection. The rescuer will be notified.'}
              {actionType === 'complete' && 'Confirm that the animal has been successfully transferred to the shelter.'}
            </Text>

            <TextInput
              style={styles.actionModalInput}
              placeholder={
                actionType === 'reject' 
                  ? 'Reason for rejection (required)...' 
                  : 'Additional notes (optional)...'
              }
              placeholderTextColor={ADMIN_COLORS.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={actionNotes}
              onChangeText={setActionNotes}
            />

            <View style={styles.actionModalButtons}>
              <TouchableOpacity
                style={styles.actionModalCancel}
                onPress={() => setActionModalVisible(false)}
                disabled={processing}
              >
                <Text style={styles.actionModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.actionModalConfirm,
                  actionType === 'approve' && { backgroundColor: '#3B82F6' },
                  actionType === 'reject' && { backgroundColor: '#EF4444' },
                  actionType === 'complete' && { backgroundColor: '#10B981' },
                ]}
                onPress={handleAction}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.actionModalConfirmText}>
                    {actionType === 'approve' && 'Approve'}
                    {actionType === 'reject' && 'Reject'}
                    {actionType === 'complete' && 'Complete'}
                  </Text>
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
  header: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 12 : 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitleText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: ADMIN_COLORS.text,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: -8,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    color: ADMIN_COLORS.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: ADMIN_COLORS.border,
    marginHorizontal: 8,
  },
  filterContainer: {
    maxHeight: 44,
    marginBottom: 12,
  },
  filterContent: {
    paddingHorizontal: 16,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: ADMIN_COLORS.primary,
    borderColor: ADMIN_COLORS.primary,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: ADMIN_COLORS.textSecondary,
  },
  filterTabTextActive: {
    color: '#FFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: ADMIN_COLORS.textSecondary,
    fontSize: 14,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: ADMIN_COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardDate: {
    fontSize: 11,
    color: ADMIN_COLORS.textSecondary,
  },
  cardBody: {
    marginBottom: 12,
  },
  animalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  animalImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  animalImagePlaceholder: {
    backgroundColor: ADMIN_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  animalInfo: {
    flex: 1,
    marginLeft: 12,
  },
  rescueTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
  },
  animalType: {
    fontSize: 13,
    color: ADMIN_COLORS.textSecondary,
    marginTop: 2,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: ADMIN_COLORS.border,
    paddingTop: 12,
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    color: ADMIN_COLORS.text,
    flex: 1,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: ADMIN_COLORS.border,
  },
  quickActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  approveQuickBtn: {
    backgroundColor: '#3B82F6',
  },
  rejectQuickBtn: {
    backgroundColor: '#EF4444',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: ADMIN_COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.9,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  modalSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 10,
  },
  detailStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  detailStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailUrgencyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  detailUrgencyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
  },
  detailImage: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  detailLabel: {
    fontSize: 13,
    color: ADMIN_COLORS.textSecondary,
    minWidth: 80,
  },
  detailValue: {
    fontSize: 14,
    color: ADMIN_COLORS.text,
    flex: 1,
  },
  descriptionBox: {
    backgroundColor: ADMIN_COLORS.background,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  descriptionText: {
    fontSize: 13,
    color: ADMIN_COLORS.textSecondary,
    lineHeight: 20,
  },
  notesBox: {
    backgroundColor: ADMIN_COLORS.background,
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: ADMIN_COLORS.textSecondary,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 13,
    color: ADMIN_COLORS.text,
    lineHeight: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 30,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: ADMIN_COLORS.border,
    backgroundColor: '#FFF',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  approveBtn: {
    backgroundColor: '#3B82F6',
  },
  rejectBtn: {
    backgroundColor: '#EF4444',
  },
  completeBtn: {
    backgroundColor: '#10B981',
  },
  deleteBtn: {
    backgroundColor: '#DC2626',
    width: 48,
    paddingHorizontal: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  // Action Modal
  actionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  actionModalContainer: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  actionModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
    marginBottom: 8,
  },
  actionModalSubtitle: {
    fontSize: 14,
    color: ADMIN_COLORS.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  actionModalInput: {
    backgroundColor: ADMIN_COLORS.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: ADMIN_COLORS.text,
    minHeight: 100,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    marginBottom: 16,
  },
  actionModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionModalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: ADMIN_COLORS.background,
    alignItems: 'center',
  },
  actionModalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: ADMIN_COLORS.textSecondary,
  },
  actionModalConfirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionModalConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});

export default memo(AdminShelterTransfersScreen);
