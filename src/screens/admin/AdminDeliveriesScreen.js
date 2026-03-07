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
  Modal,
  TextInput,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import CONFIG from '../../config/config';
import {
  ADMIN_COLORS,
  formatDate as formatDateUtil,
  useFadeAnimation,
  getImageUrl as getImageUrlUtil,
} from './shared';

// Delivery Status Configuration
const DELIVERY_STATUS_CONFIG = {
  processing: { 
    color: '#F59E0B', 
    bg: '#FFFBEB', 
    icon: 'receipt-outline', 
    label: 'Processing',
    nextStatus: 'preparing',
    nextLabel: 'Mark as Preparing',
  },
  preparing: { 
    color: '#6366F1', 
    bg: '#EEF2FF', 
    icon: 'cube-outline', 
    label: 'Preparing',
    nextStatus: 'out_for_delivery',
    nextLabel: 'Mark as Out for Delivery',
  },
  out_for_delivery: { 
    color: '#3B82F6', 
    bg: '#EFF6FF', 
    icon: 'car-outline', 
    label: 'Out for Delivery',
    nextStatus: 'delivered',
    nextLabel: 'Mark as Delivered',
  },
  delivered: { 
    color: '#10B981', 
    bg: '#ECFDF5', 
    icon: 'checkmark-done', 
    label: 'Delivered',
    nextStatus: null,
    nextLabel: null,
  },
  cancelled: { 
    color: '#EF4444', 
    bg: '#FEF2F2', 
    icon: 'close-circle-outline', 
    label: 'Cancelled',
    nextStatus: null,
    nextLabel: null,
  },
};

const getImageUrl = (imagePath) => getImageUrlUtil(imagePath, CONFIG.API_URL);
const formatDate = (dateString) => formatDateUtil(dateString, { fallback: '' });

// Delivery Update Modal
const DeliveryUpdateModal = ({ visible, onClose, delivery, onUpdate, adminToken }) => {
  const [selectedStatus, setSelectedStatus] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [trackingNotes, setTrackingNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (delivery) {
      setSelectedStatus(delivery.delivery_status || 'processing');
      setScheduledDate(delivery.delivery_scheduled_date || '');
      setTrackingNotes(delivery.delivery_tracking_notes || '');
    }
  }, [delivery]);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${CONFIG.API_URL}/admin/deliveries/${delivery.id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          delivery_status: selectedStatus,
          delivery_scheduled_date: scheduledDate || null,
          delivery_tracking_notes: trackingNotes || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update delivery');
      }

      Alert.alert('Success', `Delivery status updated to ${DELIVERY_STATUS_CONFIG[selectedStatus]?.label}`);
      onUpdate();
      onClose();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle cancel delivery with confirmation
  const handleCancelDelivery = () => {
    Alert.alert(
      'Cancel Delivery',
      'Are you sure you want to cancel this delivery? This action cannot be undone easily.',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const response = await fetch(`${CONFIG.API_URL}/admin/deliveries/${delivery.id}/status`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${adminToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  delivery_status: 'cancelled',
                  delivery_tracking_notes: trackingNotes || 'Delivery cancelled by admin',
                }),
              });

              const data = await response.json();

              if (!response.ok) {
                throw new Error(data.error || 'Failed to cancel delivery');
              }

              Alert.alert('Cancelled', 'Delivery has been cancelled');
              onUpdate();
              onClose();
            } catch (error) {
              Alert.alert('Error', error.message);
            } finally {
              setLoading(false);
            }
          }
        },
      ]
    );
  };

  const statusOptions = Object.entries(DELIVERY_STATUS_CONFIG).filter(([key]) => key !== 'cancelled');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Update Delivery</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color={ADMIN_COLORS.textLight} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Pet & Customer Info */}
            <View style={styles.deliveryInfoBox}>
              <Text style={styles.deliveryInfoLabel}>Pet</Text>
              <Text style={styles.deliveryInfoValue}>{delivery?.pet_name}</Text>
              <Text style={styles.deliveryInfoLabel}>Customer</Text>
              <Text style={styles.deliveryInfoValue}>{delivery?.delivery_full_name}</Text>
              <Text style={styles.deliveryInfoLabel}>Address</Text>
              <Text style={styles.deliveryInfoValue}>
                {delivery?.delivery_address}, {delivery?.delivery_city}
              </Text>
            </View>

            {/* Status Selection */}
            <Text style={styles.sectionLabel}>Delivery Status</Text>
            <View style={styles.statusOptions}>
              {statusOptions.map(([key, config]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.statusOption,
                    selectedStatus === key && { borderColor: config.color, backgroundColor: config.bg },
                  ]}
                  onPress={() => setSelectedStatus(key)}
                >
                  <Ionicons name={config.icon} size={20} color={selectedStatus === key ? config.color : ADMIN_COLORS.textLight} />
                  <Text style={[
                    styles.statusOptionText,
                    selectedStatus === key && { color: config.color, fontWeight: '600' },
                  ]}>
                    {config.label}
                  </Text>
                  {selectedStatus === key && (
                    <Ionicons name="checkmark-circle" size={18} color={config.color} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Scheduled Date */}
            <Text style={styles.sectionLabel}>Scheduled Date (Optional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9CA3AF"
              value={scheduledDate}
              onChangeText={setScheduledDate}
            />

            {/* Tracking Notes */}
            <Text style={styles.sectionLabel}>Tracking Notes (Optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Add notes about the delivery..."
              placeholderTextColor="#9CA3AF"
              value={trackingNotes}
              onChangeText={setTrackingNotes}
              multiline
              numberOfLines={3}
            />

            {/* Cancel Delivery Option - only show if not delivered or cancelled */}
            {delivery?.delivery_status !== 'delivered' && delivery?.delivery_status !== 'cancelled' && (
              <TouchableOpacity
                style={styles.cancelDeliveryBtn}
                onPress={handleCancelDelivery}
                disabled={loading}
              >
                <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                <Text style={styles.cancelDeliveryText}>Cancel This Delivery</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.updateButton, loading && styles.updateButtonDisabled]}
              onPress={handleUpdate}
              disabled={loading}
            >
              <LinearGradient
                colors={loading ? ['#9CA3AF', '#9CA3AF'] : [ADMIN_COLORS.primary, ADMIN_COLORS.primaryDark]}
                style={styles.updateButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#FFF" />
                    <Text style={styles.updateButtonText}>Update Status</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Delivery Card Component
const DeliveryCard = ({ delivery, onPress, onQuickUpdate, adminToken }) => {
  const [imageError, setImageError] = useState(false);
  const statusConfig = DELIVERY_STATUS_CONFIG[delivery.delivery_status] || DELIVERY_STATUS_CONFIG.processing;
  const petImageUrl = getImageUrl(delivery.pet_image);

  const handleQuickAdvance = async () => {
    if (!statusConfig.nextStatus) return;

    Alert.alert(
      'Update Status',
      `${statusConfig.nextLabel}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const response = await fetch(`${CONFIG.API_URL}/admin/deliveries/${delivery.id}/status`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${adminToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  delivery_status: statusConfig.nextStatus,
                }),
              });

              if (!response.ok) throw new Error('Failed to update');
              
              Alert.alert('Success', `Status updated to ${DELIVERY_STATUS_CONFIG[statusConfig.nextStatus]?.label}`);
              onQuickUpdate();
            } catch (error) {
              Alert.alert('Error', 'Failed to update delivery status');
            }
          },
        },
      ]
    );
  };

  return (
    <TouchableOpacity style={styles.deliveryCard} onPress={onPress} activeOpacity={0.7}>
      {/* Status Bar */}
      <View style={[styles.statusBar, { backgroundColor: statusConfig.color }]} />

      <View style={styles.cardContent}>
        {/* Pet Image */}
        <View style={styles.imageContainer}>
          {petImageUrl && !imageError ? (
            <Image
              source={{ uri: petImageUrl }}
              style={styles.petImage}
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={[styles.petImage, styles.petImagePlaceholder]}>
              <Ionicons name="paw" size={28} color={ADMIN_COLORS.textLight} />
            </View>
          )}
        </View>

        {/* Delivery Info */}
        <View style={styles.deliveryInfo}>
          <View style={styles.headerRow}>
            <Text style={styles.petName} numberOfLines={1}>{delivery.pet_name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <Ionicons name={statusConfig.icon} size={12} color={statusConfig.color} />
              <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>

          <View style={styles.customerRow}>
            <Ionicons name="person-outline" size={14} color={ADMIN_COLORS.textLight} />
            <Text style={styles.customerName} numberOfLines={1}>{delivery.delivery_full_name}</Text>
          </View>

          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={14} color={ADMIN_COLORS.textLight} />
            <Text style={styles.addressText} numberOfLines={1}>
              {delivery.delivery_city}
            </Text>
          </View>

          <View style={styles.paymentRow}>
            <Ionicons name="card-outline" size={14} color="#10B981" />
            <Text style={styles.paymentText}>₱{Number(delivery.payment_amount || 0).toLocaleString()}</Text>
            <Text style={styles.paymentDate}>• {formatDate(delivery.payment_date)}</Text>
          </View>
        </View>

        {/* Quick Action Button */}
        {statusConfig.nextStatus && (
          <TouchableOpacity 
            style={[styles.quickActionBtn, { backgroundColor: DELIVERY_STATUS_CONFIG[statusConfig.nextStatus]?.bg }]}
            onPress={handleQuickAdvance}
          >
            <Ionicons 
              name="arrow-forward" 
              size={18} 
              color={DELIVERY_STATUS_CONFIG[statusConfig.nextStatus]?.color} 
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Contact Info */}
      <View style={styles.contactRow}>
        <View style={styles.contactItem}>
          <Ionicons name="call-outline" size={14} color={ADMIN_COLORS.textLight} />
          <Text style={styles.contactText}>{delivery.delivery_phone}</Text>
        </View>
        <View style={styles.contactItem}>
          <Ionicons name="home-outline" size={14} color={ADMIN_COLORS.textLight} />
          <Text style={styles.contactText} numberOfLines={1}>{delivery.delivery_address}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const AdminDeliveriesScreen = ({ onGoBack, adminToken }) => {
  const [filter, setFilter] = useState('all');
  const [deliveries, setDeliveries] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const { fadeAnim } = useFadeAnimation();

  const filtered = useMemo(() =>
    deliveries.filter(d => filter === 'all' || d.delivery_status === filter),
    [deliveries, filter]
  );

  useEffect(() => {
    fetchDeliveries();
    fetchStats();
  }, []);

  const fetchDeliveries = useCallback(async () => {
    try {
      setLoading(true);
      let url = `${CONFIG.API_URL}/admin/deliveries?limit=100`;
      if (filter !== 'all') {
        url += `&status=${filter}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch deliveries');

      const data = await response.json();
      if (Array.isArray(data)) {
        setDeliveries(data);
      }
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      Alert.alert('Error', 'Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  }, [filter, adminToken]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${CONFIG.API_URL}/admin/deliveries/stats`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch stats');

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [adminToken]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchDeliveries(), fetchStats()]);
    setRefreshing(false);
  }, [fetchDeliveries, fetchStats]);

  const handleDeliveryPress = (delivery) => {
    setSelectedDelivery(delivery);
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setSelectedDelivery(null);
  };

  const handleUpdate = () => {
    fetchDeliveries();
    fetchStats();
  };

  const filterTabs = [
    { id: 'all', label: 'All', count: stats.total_deliveries || 0 },
    { id: 'processing', label: 'Processing', count: stats.processing || 0 },
    { id: 'preparing', label: 'Preparing', count: stats.preparing || 0 },
    { id: 'out_for_delivery', label: 'On Way', count: stats.out_for_delivery || 0 },
    { id: 'delivered', label: 'Delivered', count: stats.delivered || 0 },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={ADMIN_COLORS.primary} />

      {/* Header */}
      <LinearGradient colors={[ADMIN_COLORS.primary, ADMIN_COLORS.primaryDark]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={onGoBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Deliveries</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
              <Ionicons name="refresh" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.total_deliveries || 0}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{(stats.processing || 0) + (stats.preparing || 0)}</Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>₱{Number(stats.total_revenue || 0).toLocaleString()}</Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {filterTabs.map((tab) => {
            const isActive = filter === tab.id;
            const config = DELIVERY_STATUS_CONFIG[tab.id];
            
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                onPress={() => setFilter(tab.id)}
              >
                {config && <Ionicons name={config.icon} size={16} color={isActive ? '#FFF' : ADMIN_COLORS.textLight} />}
                <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                  {tab.label}
                </Text>
                <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
                  <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ADMIN_COLORS.primary} />
          <Text style={styles.loadingText}>Loading deliveries...</Text>
        </View>
      ) : (
        <Animated.ScrollView
          style={[styles.content, { opacity: fadeAnim }]}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ADMIN_COLORS.primary]} />
          }
        >
          {filtered.length > 0 ? (
            <>
              <Text style={styles.resultCount}>
                {filtered.length} {filtered.length === 1 ? 'Delivery' : 'Deliveries'}
              </Text>
              {filtered.map((delivery) => (
                <DeliveryCard
                  key={delivery.id}
                  delivery={delivery}
                  onPress={() => handleDeliveryPress(delivery)}
                  onQuickUpdate={handleUpdate}
                  adminToken={adminToken}
                />
              ))}
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="car-outline" size={64} color="#E2E8F0" />
              <Text style={styles.emptyTitle}>No Deliveries</Text>
              <Text style={styles.emptySubtitle}>
                {filter === 'all' 
                  ? 'No paid adoptions requiring delivery yet.'
                  : `No ${DELIVERY_STATUS_CONFIG[filter]?.label.toLowerCase()} deliveries.`}
              </Text>
            </View>
          )}

          <View style={{ height: 100 }} />
        </Animated.ScrollView>
      )}

      {/* Update Modal */}
      <DeliveryUpdateModal
        visible={modalVisible}
        onClose={handleModalClose}
        delivery={selectedDelivery}
        onUpdate={handleUpdate}
        adminToken={adminToken}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : StatusBar.currentHeight + 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
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
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 16,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  filterContainer: {
    backgroundColor: '#FFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: ADMIN_COLORS.primary,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: ADMIN_COLORS.textLight,
  },
  filterTabTextActive: {
    color: '#FFF',
  },
  filterBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: ADMIN_COLORS.textLight,
  },
  filterBadgeTextActive: {
    color: '#FFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: ADMIN_COLORS.textLight,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  resultCount: {
    fontSize: 14,
    fontWeight: '600',
    color: ADMIN_COLORS.textDark,
    marginBottom: 12,
  },
  deliveryCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  statusBar: {
    height: 4,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  imageContainer: {
    marginRight: 12,
  },
  petImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  petImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryInfo: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  petName: {
    fontSize: 16,
    fontWeight: '700',
    color: ADMIN_COLORS.textDark,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  customerName: {
    fontSize: 13,
    color: ADMIN_COLORS.textDark,
    fontWeight: '500',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 12,
    color: ADMIN_COLORS.textLight,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  paymentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  paymentDate: {
    fontSize: 11,
    color: ADMIN_COLORS.textLight,
  },
  quickActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  contactRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  contactText: {
    fontSize: 12,
    color: ADMIN_COLORS.textLight,
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: ADMIN_COLORS.textDark,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: ADMIN_COLORS.textLight,
    marginTop: 8,
    textAlign: 'center',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: ADMIN_COLORS.textDark,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    padding: 20,
  },
  deliveryInfoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  deliveryInfoLabel: {
    fontSize: 11,
    color: ADMIN_COLORS.textLight,
    marginBottom: 2,
    marginTop: 8,
  },
  deliveryInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: ADMIN_COLORS.textDark,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: ADMIN_COLORS.textDark,
    marginBottom: 10,
    marginTop: 4,
  },
  statusOptions: {
    marginBottom: 16,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    gap: 10,
  },
  statusOptionText: {
    flex: 1,
    fontSize: 14,
    color: ADMIN_COLORS.textDark,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: ADMIN_COLORS.textDark,
    marginBottom: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: ADMIN_COLORS.textDark,
  },
  updateButton: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  updateButtonDisabled: {
    opacity: 0.7,
  },
  updateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  updateButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  cancelDeliveryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  cancelDeliveryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
});

export default memo(AdminDeliveriesScreen);
