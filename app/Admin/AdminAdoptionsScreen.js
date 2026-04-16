import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, doc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { db } from '../../firebaseConfig';
import { normalizeAdoptionStatus } from '../../utils/status';
import { ADMIN_COLORS } from './shared';

const RESCUER_ADOPTION_STATUSES = ['requested', 'approved', 'rejected'];

const RESCUER_FILTER_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'requested', label: 'Requested' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

const SHELTER_FILTER_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'requested', label: 'Requested' },
  { id: 'approved', label: 'Approved' },
  { id: 'in_transit', label: 'In Transit' },
  { id: 'delivered_pending_confirmation', label: 'Awaiting Confirm' },
  { id: 'completed', label: 'Completed' },
  { id: 'return_requested', label: 'Return Requested' },
  { id: 'return_approved', label: 'Return Approved' },
  { id: 'return_in_transit', label: 'Return In Transit' },
  { id: 'return_completed', label: 'Return Completed' },
  { id: 'return_rejected', label: 'Return Rejected' },
  { id: 'rejected', label: 'Rejected' },
];

const ADOPTION_STATUS_COLORS = {
  requested: { bg: '#FFF8E1', text: '#F59E0B' },
  pending: { bg: '#FFF8E1', text: '#F59E0B' },
  approved: { bg: '#E8FFF3', text: '#10B981' },
  in_transit: { bg: '#DBEAFE', text: '#1D4ED8' },
  delivered_pending_confirmation: { bg: '#E0E7FF', text: '#4338CA' },
  completed: { bg: '#DCFCE7', text: '#166534' },
  return_requested: { bg: '#FEF3C7', text: '#92400E' },
  return_approved: { bg: '#DBEAFE', text: '#1D4ED8' },
  return_in_transit: { bg: '#EDE9FE', text: '#6D28D9' },
  return_completed: { bg: '#DCFCE7', text: '#166534' },
  return_rejected: { bg: '#FEE2E2', text: '#B91C1C' },
  rejected: { bg: '#FFEBEE', text: '#EF4444' },
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
};

const toTimestamp = (value) => {
  if (!value) return 0;
  const date = value?.toDate ? value.toDate() : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
};

const formatStatusLabel = (value) => String(value || 'pending')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (char) => char.toUpperCase());

const AdminAdoptionsScreen = ({ onGoBack }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('rescuer');
  const [rescuerFilter, setRescuerFilter] = useState('all');
  const [shelterFilter, setShelterFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [rescuerAdoptions, setRescuerAdoptions] = useState([]);
  const [shelterAdoptions, setShelterAdoptions] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [petsById, setPetsById] = useState({});
  const [processingId, setProcessingId] = useState(null);
  const [logModalPayload, setLogModalPayload] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [rescueReportsSnap, adoptionsSnap, usersSnap, petsSnap] = await Promise.all([
        getDocs(collection(db, 'rescue_reports')),
        getDocs(collection(db, 'adoptions')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'pets')),
      ]);

      const userMap = {};
      usersSnap.forEach((userDoc) => {
        userMap[userDoc.id] = userDoc.data() || {};
      });

      const petMap = {};
      petsSnap.forEach((petDoc) => {
        petMap[petDoc.id] = petDoc.data() || {};
      });

      const rescuerRows = [];
      rescueReportsSnap.forEach((reportDoc) => {
        const reportData = reportDoc.data() || {};
        const status = normalizeAdoptionStatus(reportData.rescuer_adoption_status);

        if (!RESCUER_ADOPTION_STATUSES.includes(status)) {
          return;
        }

        rescuerRows.push({
          id: reportDoc.id,
          ...reportData,
          rescuer_adoption_status: status,
        });
      });

      rescuerRows.sort((a, b) => {
        const aDate = a.rescuer_adoption_requested_at?.toDate
          ? a.rescuer_adoption_requested_at.toDate()
          : (a.updated_at?.toDate ? a.updated_at.toDate() : new Date(0));
        const bDate = b.rescuer_adoption_requested_at?.toDate
          ? b.rescuer_adoption_requested_at.toDate()
          : (b.updated_at?.toDate ? b.updated_at.toDate() : new Date(0));
        return bDate - aDate;
      });

      const shelterRows = adoptionsSnap.docs.map((adoptionDoc) => ({
        id: adoptionDoc.id,
        ...adoptionDoc.data(),
        status: String(adoptionDoc.data()?.status || '').trim(),
      }));

      shelterRows.sort((a, b) => {
        const aDate = a.created_at?.toDate ? a.created_at.toDate() : new Date(0);
        const bDate = b.created_at?.toDate ? b.created_at.toDate() : new Date(0);
        return bDate - aDate;
      });

      setUsersById(userMap);
      setPetsById(petMap);
      setRescuerAdoptions(rescuerRows);
      setShelterAdoptions(shelterRows);
    } catch (error) {
      console.error('Error loading admin adoptions:', error);
      setRescuerAdoptions([]);
      setShelterAdoptions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const filteredRescuerAdoptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rescuerAdoptions.filter((item) => {
      const status = normalizeAdoptionStatus(item.rescuer_adoption_status);
      const matchesFilter = rescuerFilter === 'all' ? true : status === rescuerFilter;
      if (!matchesFilter) return false;
      if (!q) return true;

      const rescuerId = item.rescuer_adoption_requested_by || item.rescuer_id;
      const rescuer = usersById[rescuerId] || {};
      const haystack = [
        item.title,
        item.location_description,
        item.location,
        status,
        rescuer.full_name,
        rescuer.email,
      ].map((value) => String(value || '').toLowerCase()).join(' ');

      return haystack.includes(q);
    });
  }, [rescuerAdoptions, rescuerFilter, searchQuery, usersById]);

  const filteredShelterAdoptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return shelterAdoptions.filter((item) => {
      const status = normalizeAdoptionStatus(item.status);
      const matchesFilter = shelterFilter === 'all' ? true : status === shelterFilter;
      if (!matchesFilter) return false;
      if (!q) return true;

      const user = usersById[item.user_id] || {};
      const pet = petsById[item.pet_id] || {};
      const haystack = [
        pet.name,
        user.full_name,
        user.email,
        item.user_email,
        item.shelter_id,
        status,
      ].map((value) => String(value || '').toLowerCase()).join(' ');

      return haystack.includes(q);
    });
  }, [shelterAdoptions, shelterFilter, searchQuery, usersById, petsById]);

  const updateRescuerAdoptionLocally = useCallback((reportId, patch) => {
    setRescuerAdoptions((prev) => prev.map((item) => (
      String(item.id) === String(reportId)
        ? { ...item, ...patch }
        : item
    )));
  }, []);

  const sendRescuerDecisionNotification = useCallback(async (report, nextStatus) => {
    const userId = String(report?.rescuer_adoption_requested_by || report?.rescuer_id || '').trim();
    if (!userId) {
      return;
    }

    const reportLabel = report?.title || `Report #${report?.id}`;
    const isApproved = nextStatus === 'approved';

    const notificationRef = doc(collection(db, 'notifications'));
    await setDoc(notificationRef, {
      user_id: userId,
      title: isApproved ? 'Rescuer Adoption Approved' : 'Rescuer Adoption Rejected',
      message: isApproved
        ? `Your request to adopt "${reportLabel}" has been approved by admin.`
        : `Your request to adopt "${reportLabel}" was rejected by admin.`,
      type: isApproved ? 'rescuer_adoption_approved' : 'rescuer_adoption_rejected',
      rescue_report_id: String(report?.id || ''),
      read: false,
      created_at: serverTimestamp(),
    });
  }, []);

  const submitRescuerDecision = useCallback(async (report, nextStatus) => {
    if (!report?.id) {
      return;
    }

    const safeStatus = normalizeAdoptionStatus(nextStatus);
    if (!['approved', 'rejected'].includes(safeStatus)) {
      return;
    }

    try {
      setProcessingId(String(report.id));

      const reportRef = doc(db, 'rescue_reports', String(report.id));
      const patch = {
        rescuer_adoption_status: safeStatus,
        rescuer_adoption_processed_at: serverTimestamp(),
        rescuer_adoption_processed_by: 'admin',
        updated_at: serverTimestamp(),
      };

      await updateDoc(reportRef, patch);
      await sendRescuerDecisionNotification(report, safeStatus);
      updateRescuerAdoptionLocally(report.id, { ...patch, rescuer_adoption_status: safeStatus });

      Alert.alert(
        'Decision Saved',
        safeStatus === 'approved'
          ? 'Rescuer adoption request approved.'
          : 'Rescuer adoption request rejected.'
      );
    } catch (error) {
      console.error('Error processing rescuer adoption decision:', error);
      Alert.alert('Error', 'Failed to update adoption decision. Please try again.');
    } finally {
      setProcessingId(null);
    }
  }, [sendRescuerDecisionNotification, updateRescuerAdoptionLocally]);

  const handleRescuerDecision = useCallback((report, nextStatus) => {
    const isApprove = nextStatus === 'approved';
    Alert.alert(
      isApprove ? 'Approve Request' : 'Reject Request',
      isApprove
        ? 'Approve this rescuer adoption request?'
        : 'Reject this rescuer adoption request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isApprove ? 'Approve' : 'Reject',
          style: isApprove ? 'default' : 'destructive',
          onPress: () => submitRescuerDecision(report, nextStatus),
        },
      ]
    );
  }, [submitRescuerDecision]);

  const buildShelterAdoptionLogs = useCallback((item) => {
    if (!item) return [];

    const entries = [
      { key: 'submitted', label: 'Submitted', value: item.created_at },
      { key: 'approved', label: 'Approved', value: item.approved_at },
      { key: 'in_transit', label: 'In Transit', value: item.in_transit_at },
      { key: 'delivered', label: 'Delivered', value: item.delivered_at },
      { key: 'completed', label: 'Completed', value: item.completed_at },
      { key: 'return_requested', label: 'Return Requested', value: item.return_requested_at },
      { key: 'return_reviewed', label: 'Return Reviewed', value: item.return_reviewed_at },
      { key: 'return_in_transit', label: 'Return In Transit', value: item.return_in_transit_at },
      { key: 'return_completed', label: 'Return Completed', value: item.return_completed_at },
    ];

    return entries.filter((entry) => !!entry.value);
  }, []);

  const buildRescuerAdoptionLogs = useCallback((item) => {
    if (!item) return [];

    const entries = [
      { key: 'requested', label: 'Requested', value: item.rescuer_adoption_requested_at || item.created_at },
      { key: 'processed', label: 'Reviewed', value: item.rescuer_adoption_processed_at },
      { key: 'updated', label: 'Updated', value: item.updated_at },
    ];

    return entries.filter((entry) => !!entry.value);
  }, []);

  const buildRescuerFullFlowLogs = useCallback((item) => {
    if (!item) return [];

    const rescuerLogs = buildRescuerAdoptionLogs(item).map((entry, index) => ({
      ...entry,
      key: `rescuer_${entry.key}_${index}`,
    }));

    const reportId = String(item.id || '').trim();
    const linkedPetIds = new Set();

    const directPetId = String(item?.pet_id || item?.adopted_pet_id || '').trim();
    if (directPetId) {
      linkedPetIds.add(directPetId);
    }

    if (reportId) {
      Object.entries(petsById).forEach(([petId, petData]) => {
        if (String(petData?.rescue_report_id || '').trim() === reportId) {
          linkedPetIds.add(String(petId));
        }
      });
    }

    const adoptionLogs = [];
    shelterAdoptions
      .filter((adoption) => linkedPetIds.has(String(adoption?.pet_id || '').trim()))
      .forEach((adoption) => {
        const petId = String(adoption?.pet_id || '').trim();
        const petName = String(petsById[petId]?.name || adoption?.pet_name || `Pet ${petId || ''}`).trim();

        buildShelterAdoptionLogs(adoption).forEach((entry, index) => {
          adoptionLogs.push({
            ...entry,
            key: `adoption_${adoption.id}_${entry.key}_${index}`,
            label: `${entry.label} (${petName})`,
          });
        });
      });

    return [...rescuerLogs, ...adoptionLogs]
      .filter((entry) => !!entry.value)
      .sort((a, b) => toTimestamp(a.value) - toTimestamp(b.value));
  }, [buildRescuerAdoptionLogs, buildShelterAdoptionLogs, petsById, shelterAdoptions]);

  const modalLogs = useMemo(() => {
    if (!logModalPayload?.item) return [];
    if (logModalPayload.type === 'rescuer') {
      return buildRescuerFullFlowLogs(logModalPayload.item);
    }
    return buildShelterAdoptionLogs(logModalPayload.item);
  }, [buildRescuerFullFlowLogs, buildShelterAdoptionLogs, logModalPayload]);

  const renderRescuerCard = (item) => {
    const rescuerId = item.rescuer_adoption_requested_by || item.rescuer_id;
    const rescuer = usersById[rescuerId] || {};
    const status = normalizeAdoptionStatus(item.rescuer_adoption_status);
    const statusStyle = ADOPTION_STATUS_COLORS[status] || ADOPTION_STATUS_COLORS.requested;

    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.title || `Rescue #${item.id}`}</Text>
          <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.badgeText, { color: statusStyle.text }]} numberOfLines={1}>{formatStatusLabel(status)}</Text>
          </View>
        </View>
        <Text style={styles.cardMeta}>Rescuer: {rescuer.full_name || rescuer.email || rescuerId || 'Unknown'}</Text>
        <Text style={styles.cardMeta}>Requested: {formatDate(item.rescuer_adoption_requested_at || item.updated_at)}</Text>
        <Text style={styles.cardMeta}>Location: {item.location_description || item.location || 'N/A'}</Text>
        <TouchableOpacity style={styles.logsButton} onPress={() => setLogModalPayload({ type: 'rescuer', item })}>
          <Ionicons name="list-outline" size={14} color={ADMIN_COLORS.primary} />
          <Text style={styles.logsButtonText}>View Logs</Text>
        </TouchableOpacity>
        {item.rescuer_adoption_notes ? (
          <Text style={styles.cardNotes}>Notes: {item.rescuer_adoption_notes}</Text>
        ) : null}
        {normalizeAdoptionStatus(item.rescuer_adoption_status) === 'requested' && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleRescuerDecision(item, 'rejected')}
              disabled={processingId === String(item.id)}
            >
              <Text style={styles.rejectButtonText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleRescuerDecision(item, 'approved')}
              disabled={processingId === String(item.id)}
            >
              {processingId === String(item.id) ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.approveButtonText}>Approve</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderShelterCard = (item) => {
    const user = usersById[item.user_id] || {};
    const pet = petsById[item.pet_id] || {};
    const status = normalizeAdoptionStatus(item.status);
    const statusStyle = ADOPTION_STATUS_COLORS[status] || ADOPTION_STATUS_COLORS.pending;

    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{pet.name || `Pet #${item.pet_id || 'N/A'}`}</Text>
          <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.badgeText, { color: statusStyle.text }]} numberOfLines={1}>{formatStatusLabel(status)}</Text>
          </View>
        </View>
        <Text style={styles.cardMeta}>Applicant: {user.full_name || item.user_email || item.user_id || 'Unknown'}</Text>
        <Text style={styles.cardMeta}>Submitted: {formatDate(item.created_at)}</Text>
        <Text style={styles.cardMeta}>Delivery Status: {String(item.delivery_status || status || 'N/A').replace(/_/g, ' ')}</Text>
        <Text style={styles.cardMeta}>Return Status: {String(item.return_status || 'none').replace(/_/g, ' ')}</Text>
        <Text style={styles.cardMeta}>Shelter: {item.shelter_id || pet.shelter_id || 'N/A'}</Text>
        <TouchableOpacity style={styles.logsButton} onPress={() => setLogModalPayload({ type: 'shelter', item })}>
          <Ionicons name="list-outline" size={14} color={ADMIN_COLORS.primary} />
          <Text style={styles.logsButtonText}>View Logs</Text>
        </TouchableOpacity>
        {item.reason_for_adoption ? (
          <Text style={styles.cardNotes}>Reason: {item.reason_for_adoption}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={ADMIN_COLORS.surface} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
          <Ionicons name="arrow-back" size={24} color={ADMIN_COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Adoptions</Text>
          <Text style={styles.headerSubtitle}>Rescuer and shelter adoption tracking</Text>
        </View>
      </View>

      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'rescuer' && styles.tabButtonActive]}
          onPress={() => setTab('rescuer')}
        >
          <MaterialCommunityIcons name="account-heart" size={18} color={tab === 'rescuer' ? '#FFF' : ADMIN_COLORS.textSecondary} />
          <Text style={[styles.tabText, tab === 'rescuer' && styles.tabTextActive]}>Rescuer Requests</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'shelter' && styles.tabButtonActive]}
          onPress={() => setTab('shelter')}
        >
          <Ionicons name="home" size={18} color={tab === 'shelter' ? '#FFF' : ADMIN_COLORS.textSecondary} />
          <Text style={[styles.tabText, tab === 'shelter' && styles.tabTextActive]}>Shelter</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={ADMIN_COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={tab === 'rescuer' ? 'Search rescuer requests...' : 'Search shelter adoptions...'}
          placeholderTextColor={ADMIN_COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={ADMIN_COLORS.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ADMIN_COLORS.primary]} />}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={ADMIN_COLORS.primary} />
            <Text style={styles.loadingText}>Loading adoptions...</Text>
          </View>
        ) : (
          <>
            {tab === 'rescuer' ? (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  {RESCUER_FILTER_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={[styles.filterChip, rescuerFilter === option.id && styles.filterChipActive]}
                      onPress={() => setRescuerFilter(option.id)}
                    >
                      <Text style={[styles.filterText, rescuerFilter === option.id && styles.filterTextActive]}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {filteredRescuerAdoptions.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <MaterialCommunityIcons name="account-heart-outline" size={48} color={ADMIN_COLORS.textMuted} />
                    <Text style={styles.emptyTitle}>{searchQuery ? 'No matching rescuer requests' : 'No rescuer adoption requests'}</Text>
                  </View>
                ) : (
                  filteredRescuerAdoptions.map(renderRescuerCard)
                )}
              </>
            ) : (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  {SHELTER_FILTER_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={[styles.filterChip, shelterFilter === option.id && styles.filterChipActive]}
                      onPress={() => setShelterFilter(option.id)}
                    >
                      <Text style={[styles.filterText, shelterFilter === option.id && styles.filterTextActive]}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {filteredShelterAdoptions.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <Ionicons name="home-outline" size={48} color={ADMIN_COLORS.textMuted} />
                    <Text style={styles.emptyTitle}>{searchQuery ? 'No matching shelter adoptions' : 'No shelter/member adoptions'}</Text>
                  </View>
                ) : (
                  filteredShelterAdoptions.map(renderShelterCard)
                )}
              </>
            )}
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal
        visible={!!logModalPayload}
        transparent
        animationType="slide"
        onRequestClose={() => setLogModalPayload(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adoption Logs</Text>
              <TouchableOpacity onPress={() => setLogModalPayload(null)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={20} color={ADMIN_COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubTitle}>
              {logModalPayload?.type === 'rescuer'
                ? 'Full Flow Timeline'
                : formatStatusLabel(logModalPayload?.item?.status || 'pending')}
            </Text>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              {modalLogs.length === 0 ? (
                <Text style={styles.modalEmptyText}>No lifecycle logs recorded yet.</Text>
              ) : (
                modalLogs.map((entry) => (
                  <View key={entry.key} style={styles.logRow}>
                    <Text style={styles.logLabel}>{entry.label}</Text>
                    <Text style={styles.logValue}>{formatDate(entry.value)}</Text>
                  </View>
                ))
              )}
            </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ADMIN_COLORS.surface,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 56,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ADMIN_COLORS.background,
    marginRight: 8,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: ADMIN_COLORS.textPrimary,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: ADMIN_COLORS.textSecondary,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: ADMIN_COLORS.surface,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: ADMIN_COLORS.text,
    fontSize: 14,
  },
  tabButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    backgroundColor: ADMIN_COLORS.surface,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabButtonActive: {
    borderColor: ADMIN_COLORS.primary,
    backgroundColor: ADMIN_COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: ADMIN_COLORS.textSecondary,
  },
  tabTextActive: {
    color: '#FFF',
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  loadingWrap: {
    paddingTop: 80,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: ADMIN_COLORS.textSecondary,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    paddingRight: 8,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    backgroundColor: ADMIN_COLORS.surface,
  },
  filterChipActive: {
    backgroundColor: ADMIN_COLORS.primary,
    borderColor: ADMIN_COLORS.primary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
    color: ADMIN_COLORS.textSecondary,
  },
  filterTextActive: {
    color: '#FFF',
  },
  card: {
    backgroundColor: ADMIN_COLORS.surface,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: ADMIN_COLORS.textPrimary,
    marginRight: 10,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '48%',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cardMeta: {
    fontSize: 13,
    color: ADMIN_COLORS.textSecondary,
    marginTop: 2,
  },
  cardNotes: {
    marginTop: 8,
    fontSize: 13,
    color: ADMIN_COLORS.textPrimary,
  },
  logsButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: `${ADMIN_COLORS.primary}55`,
    backgroundColor: `${ADMIN_COLORS.primary}14`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  logsButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: ADMIN_COLORS.primary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveButton: {
    backgroundColor: '#16A34A',
  },
  rejectButton: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  approveButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  rejectButtonText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '800',
  },
  emptyWrap: {
    marginTop: 80,
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '700',
    color: ADMIN_COLORS.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '70%',
    backgroundColor: ADMIN_COLORS.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: ADMIN_COLORS.textPrimary,
  },
  modalSubTitle: {
    marginTop: 2,
    marginBottom: 10,
    fontSize: 13,
    color: ADMIN_COLORS.textSecondary,
  },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ADMIN_COLORS.background,
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalScrollContent: {
    paddingBottom: 12,
    gap: 8,
  },
  modalEmptyText: {
    color: ADMIN_COLORS.textSecondary,
    fontSize: 13,
  },
  logRow: {
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: ADMIN_COLORS.background,
  },
  logLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: ADMIN_COLORS.textPrimary,
  },
  logValue: {
    marginTop: 2,
    fontSize: 12,
    color: ADMIN_COLORS.textSecondary,
  },
});

export default AdminAdoptionsScreen;
