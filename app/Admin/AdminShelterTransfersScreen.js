import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
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
import { normalizeAdoptionStatus, normalizeTransferStatus } from '../../utils/status';
import { ADMIN_COLORS } from './shared';

const STATUS_COLORS = {
  pending: { bg: '#FFF3E0', text: '#C26A00' },
  requested: { bg: '#FFF3E0', text: '#C26A00' },
  approved: { bg: '#DCFCE7', text: '#166534' },
  rejected: { bg: '#FEE2E2', text: '#B91C1C' },
  in_transit: { bg: '#E0F2FE', text: '#0C4A6E' },
  delivered_pending_confirmation: { bg: '#E0E7FF', text: '#4338CA' },
  arrived_at_shelter: { bg: '#F3E8FF', text: '#6B21A8' },
  completed: { bg: '#CCFBF1', text: '#115E59' },
  return_requested: { bg: '#FEF3C7', text: '#92400E' },
  return_approved: { bg: '#DBEAFE', text: '#1D4ED8' },
  return_in_transit: { bg: '#EDE9FE', text: '#5B21B6' },
  return_completed: { bg: '#DCFCE7', text: '#166534' },
  return_rejected: { bg: '#FEE2E2', text: '#B91C1C' },
};

const STATUS_FILTER_OPTIONS = ['all', 'pending', 'approved', 'in_transit', 'arrived_at_shelter', 'completed', 'rejected'];
const DELIVERY_STATUS_FILTER_OPTIONS = ['all', 'approved', 'in_transit', 'delivered_pending_confirmation', 'completed', 'return_requested', 'return_approved', 'return_in_transit', 'return_completed', 'return_rejected'];
const TYPE_FILTER_OPTIONS = [
  { key: 'all', label: 'All Types' },
  { key: 'shelter_to_user', label: 'Shelter to User' },
  { key: 'return_cases', label: 'Return Cases' },
  { key: 'shelter_to_shelter', label: 'Shelter to Shelter' },
  { key: 'rescuer_to_shelter', label: 'Rescuer to Shelter' },
];

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
};

const resolveImageUri = (value) => {
  const uri = String(value || '').trim();
  if (!uri) return '';
  if (uri.startsWith('http') || uri.startsWith('data:')) return uri;
  return `data:image/jpeg;base64,${uri}`;
};

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
};

const getUserDisplayName = (userData = {}, fallbackId = '') => {
  return userData.full_name || userData.name || userData.email || fallbackId || 'Unknown rescuer';
};

const getShelterDisplayName = (shelterData = {}, fallbackName = '', fallbackId = '') => {
  return shelterData.name || fallbackName || fallbackId || 'Unknown shelter';
};

const getPrimaryShelterId = (item = {}) => {
  return String(item.to_shelter_id || item.shelter_id || item.from_shelter_id || 'N/A');
};

const shortenId = (value = '', head = 10, tail = 6) => {
  const text = String(value || '').trim();
  if (!text || text.length <= head + tail + 3) return text || 'N/A';
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
};

const STATUS_ORDER = {
  pending: 1,
  approved: 2,
  in_transit: 3,
  arrived_at_shelter: 4,
  completed: 5,
  rejected: 99,
};

const hasReachedStatus = (currentStatus, targetStatus) => {
  const current = STATUS_ORDER[normalizeTransferStatus(currentStatus)] || 0;
  const target = STATUS_ORDER[targetStatus] || 0;
  return current >= target;
};

const getTransferTimelineItems = (item = {}) => {
  const status = normalizeTransferStatus(item.status || 'pending');
  return [
    {
      key: 'submitted',
      label: 'Submitted',
      date: item.created_at,
      complete: true,
    },
    {
      key: 'reviewed',
      label: 'Reviewed',
      date: item.reviewed_at,
      complete: status !== 'pending',
    },
    {
      key: 'in_transit',
      label: 'In Transit',
      date: item.in_transit_at,
      complete: hasReachedStatus(status, 'in_transit'),
    },
    {
      key: 'arrived',
      label: 'Arrived',
      date: item.arrived_at_shelter_at,
      complete: hasReachedStatus(status, 'arrived_at_shelter'),
    },
    {
      key: 'completed',
      label: 'Completed',
      date: item.completed_at,
      complete: status === 'completed',
    },
  ];
};

const getDeliveryTimelineItems = (item = {}) => {
  const status = normalizeAdoptionStatus(item.status || 'pending');
  const hasReturnFlow = String(status).startsWith('return_');

  const steps = [
    {
      key: 'submitted',
      label: 'Submitted',
      date: item.created_at,
      complete: true,
    },
    {
      key: 'approved',
      label: 'Approved',
      date: item.approved_at,
      complete: ['approved', 'in_transit', 'delivered_pending_confirmation', 'completed', 'return_requested', 'return_approved', 'return_in_transit', 'return_completed', 'return_rejected'].includes(status),
    },
    {
      key: 'in_transit',
      label: 'In Transit',
      date: item.in_transit_at,
      complete: ['in_transit', 'delivered_pending_confirmation', 'completed', 'return_requested', 'return_approved', 'return_in_transit', 'return_completed', 'return_rejected'].includes(status),
    },
    {
      key: 'delivered',
      label: 'Delivered',
      date: item.delivered_at,
      complete: ['delivered_pending_confirmation', 'completed', 'return_requested', 'return_approved', 'return_in_transit', 'return_completed', 'return_rejected'].includes(status),
    },
    {
      key: 'completed',
      label: 'Completed',
      date: item.completed_at,
      complete: ['completed', 'return_requested', 'return_approved', 'return_in_transit', 'return_completed', 'return_rejected'].includes(status),
    },
  ];

  if (!hasReturnFlow) {
    return steps;
  }

  return [
    ...steps,
    {
      key: 'return_requested',
      label: 'Return Requested',
      date: item.return_requested_at,
      complete: ['return_requested', 'return_approved', 'return_in_transit', 'return_completed', 'return_rejected'].includes(status),
    },
    {
      key: 'return_approved',
      label: 'Return Approved',
      date: item.return_reviewed_at,
      complete: ['return_approved', 'return_in_transit', 'return_completed'].includes(status),
    },
    {
      key: 'return_in_transit',
      label: 'Return In Transit',
      date: item.return_in_transit_at,
      complete: ['return_in_transit', 'return_completed'].includes(status),
    },
    {
      key: 'return_completed',
      label: status === 'return_rejected' ? 'Return Rejected' : 'Return Completed',
      date: status === 'return_rejected' ? item.return_reviewed_at : item.return_completed_at,
      complete: ['return_completed', 'return_rejected'].includes(status),
    },
  ];
};

const AdminShelterTransfersScreen = ({ onGoBack, mode = 'transfers' }) => {
  const isDeliveriesMode = mode === 'deliveries';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState([]);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [detailReportedImages, setDetailReportedImages] = useState([]);
  const [detailRescuedImages, setDetailRescuedImages] = useState([]);
  const [loadingDetailImages, setLoadingDetailImages] = useState(false);

  const fetchTransfers = useCallback(async () => {
    try {
      setLoading(true);

      const [usersSnap, sheltersSnap, transferSnap, adoptionsSnap, petsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'shelters')),
        isDeliveriesMode ? Promise.resolve(null) : getDocs(collection(db, 'transfers')),
        isDeliveriesMode ? getDocs(collection(db, 'adoptions')) : Promise.resolve(null),
        isDeliveriesMode ? getDocs(collection(db, 'pets')) : Promise.resolve(null),
      ]);

      const usersById = {};
      usersSnap.forEach((userDoc) => {
        usersById[userDoc.id] = userDoc.data() || {};
      });

      const sheltersById = {};
      sheltersSnap.forEach((shelterDoc) => {
        sheltersById[shelterDoc.id] = shelterDoc.data() || {};
      });

      const petById = {};
      if (petsSnap) {
        petsSnap.forEach((petDoc) => {
          petById[petDoc.id] = petDoc.data() || {};
        });
      }

      const transferRows = isDeliveriesMode
        ? (adoptionsSnap?.docs || []).map((adoptionDoc) => {
            const item = adoptionDoc.data() || {};
            const normalizedAdoptionStatus = normalizeAdoptionStatus(item.status || 'pending');
            const status = normalizedAdoptionStatus === 'requested' ? 'pending' : normalizedAdoptionStatus;

            const userId = String(item.user_id || '').trim();
            const petId = String(item.pet_id || '').trim();
            const petData = petById[petId] || {};
            const shelterId = String(item.shelter_id || petData.shelter_id || '').trim();

            return {
              id: adoptionDoc.id,
              ...item,
              status,
              transaction_type: 'shelter_to_user',
              shelter_id: shelterId,
              from_shelter_id: shelterId,
              user_id: userId,
              to_user_id: userId,
              pet_name: item.pet_name || petData.name || 'Unknown Pet',
              from_party: getShelterDisplayName(sheltersById[shelterId] || {}, item.shelter_name || '', shelterId),
              to_party: getUserDisplayName(usersById[userId] || {}, userId || item.user_email || ''),
            };
          }).filter((item) => ['approved', 'in_transit', 'delivered_pending_confirmation', 'completed', 'return_requested', 'return_approved', 'return_in_transit', 'return_completed', 'return_rejected'].includes(item.status))
        : transferSnap.docs.map((transferDoc) => {
            const item = transferDoc.data() || {};
            const status = normalizeTransferStatus(item.status || 'pending');

            const rescuerId = String(item.rescuer_id || item.requested_by || '').trim();
            const fromShelterId = String(item.from_shelter_id || '').trim();
            const toShelterId = String(item.to_shelter_id || item.shelter_id || '').trim();

            const isShelterToShelter = Boolean(fromShelterId || item.requested_by_shelter_id);

            const fromParty = isShelterToShelter
              ? getShelterDisplayName(
                  sheltersById[fromShelterId] || {},
                  item.from_shelter_name || item.requested_by_shelter_name || '',
                  fromShelterId || item.requested_by_shelter_id || ''
                )
              : getUserDisplayName(usersById[rescuerId] || {}, rescuerId);

            const toParty = isShelterToShelter
              ? getShelterDisplayName(
                  sheltersById[toShelterId] || {},
                  item.to_shelter_name || item.shelter_name || '',
                  toShelterId
                )
              : getShelterDisplayName(
                  sheltersById[toShelterId] || {},
                  item.shelter_name || '',
                  toShelterId
                );

            return {
              id: transferDoc.id,
              ...item,
              status,
              transaction_type: isShelterToShelter ? 'shelter_to_shelter' : 'rescuer_to_shelter',
              from_party: fromParty,
              to_party: toParty,
            };
          });

      transferRows.sort((a, b) => {
        const aDate = a.updated_at?.toDate ? a.updated_at.toDate() : new Date(a.updated_at || a.created_at || 0);
        const bDate = b.updated_at?.toDate ? b.updated_at.toDate() : new Date(b.updated_at || b.created_at || 0);
        return bDate - aDate;
      });

      setRows(transferRows);
    } catch (error) {
      console.error('Error loading shelter transfers for admin:', error);
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isDeliveriesMode]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTransfers();
  }, [fetchTransfers]);

  const stats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let completed = 0;
    let returns = 0;

    rows.forEach((item) => {
      if (item.status === 'pending') pending += 1;
      if (item.status === 'approved' || item.status === 'in_transit' || item.status === 'arrived_at_shelter' || item.status === 'delivered_pending_confirmation' || item.status === 'return_requested' || item.status === 'return_approved' || item.status === 'return_in_transit') approved += 1;
      if (item.status === 'completed' || item.status === 'return_completed') completed += 1;
      if (String(item.status || '').startsWith('return_')) returns += 1;
    });

    return {
      total: rows.length,
      pending,
      approved,
      completed,
      returns,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const needle = String(searchText || '').trim().toLowerCase();

    return rows.filter((item) => {
      const matchesStatus = statusFilter === 'all' ? true : item.status === statusFilter;
      const matchesType = typeFilter === 'all'
        ? true
        : typeFilter === 'return_cases'
          ? item.transaction_type === 'shelter_to_user' && String(item.status || '').startsWith('return_')
          : item.transaction_type === typeFilter;

      if (!matchesStatus || !matchesType) return false;
      if (!needle) return true;

      const searchHaystack = [
        item.id,
        item.from_party,
        item.to_party,
        item.rescue_report_id,
        item.user_id,
        item.to_user_id,
        item.pet_name,
        item.to_shelter_id,
        item.from_shelter_id,
        item.shelter_id,
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

      return searchHaystack.includes(needle);
    });
  }, [rows, searchText, statusFilter, typeFilter]);

  const applySearch = useCallback(() => {
    setSearchText(searchDraft.trim());
  }, [searchDraft]);

  const resetFilters = useCallback(() => {
    setSearchDraft('');
    setSearchText('');
    setStatusFilter('all');
    setTypeFilter('all');
  }, []);

  const loadSelectedTransferImages = useCallback(async (transfer) => {
    const target = transfer || null;
    if (!target) {
      setDetailReportedImages([]);
      setDetailRescuedImages([]);
      setLoadingDetailImages(false);
      return;
    }

    const transferReportedCandidates = [
      ...toArray(target?.reported_images),
      ...toArray(target?.report_images),
      ...toArray(target?.source_pet_images),
      ...toArray(target?.pet_images),
      ...toArray(target?.image_url),
    ];

    const transferRescuedCandidates = [
      ...toArray(target?.rescued_images),
      ...toArray(target?.rescued_photo),
      ...toArray(target?.completion_photo),
      ...toArray(target?.completion_photos),
      ...toArray(target?.source_pet_images),
      ...toArray(target?.pet_images),
    ];

    const normalizedTransferReported = Array.from(new Set(
      transferReportedCandidates.map(resolveImageUri).filter(Boolean)
    ));
    const normalizedTransferRescued = Array.from(new Set(
      transferRescuedCandidates.map(resolveImageUri).filter(Boolean)
    ));

    let sourcePetFallbackImages = [];
    const needsSourcePetFallback = normalizedTransferReported.length === 0 || normalizedTransferRescued.length === 0;
    const sourcePetId = String(target?.pet_id || '').trim();
    if (needsSourcePetFallback && sourcePetId) {
      try {
        const sourcePetSnap = await getDoc(doc(db, 'pets', sourcePetId));
        if (sourcePetSnap.exists()) {
          const sourcePetData = sourcePetSnap.data() || {};
          sourcePetFallbackImages = [
            ...toArray(sourcePetData.images),
            ...toArray(sourcePetData.image),
            ...toArray(sourcePetData.image_url),
          ]
            .map(resolveImageUri)
            .filter(Boolean);
        }
      } catch {
        sourcePetFallbackImages = [];
      }
    }

    const transferReportedWithPetFallback = [
      ...transferReportedCandidates,
      ...sourcePetFallbackImages,
    ];
    const transferRescuedWithPetFallback = [
      ...transferRescuedCandidates,
      ...sourcePetFallbackImages,
    ];

    const normalizedTransferReportedWithPet = Array.from(new Set(
      transferReportedWithPetFallback.map(resolveImageUri).filter(Boolean)
    ));
    const normalizedTransferRescuedWithPet = Array.from(new Set(
      transferRescuedWithPetFallback.map(resolveImageUri).filter(Boolean)
    ));

    const rescueReportId = String(target?.rescue_report_id || '').trim();
    if (!rescueReportId) {
      setDetailReportedImages(normalizedTransferReportedWithPet);
      setDetailRescuedImages(normalizedTransferRescuedWithPet);
      setLoadingDetailImages(false);
      return;
    }

    try {
      setLoadingDetailImages(true);
      const reportSnap = await getDoc(doc(db, 'rescue_reports', rescueReportId));
      if (!reportSnap.exists()) {
        setDetailReportedImages(normalizedTransferReportedWithPet);
        setDetailRescuedImages(normalizedTransferRescuedWithPet);
        return;
      }

      const reportData = reportSnap.data() || {};
      const reportedCandidates = [
        ...toArray(reportData.images),
        ...toArray(reportData.reported_images),
        ...toArray(reportData.report_image),
        ...toArray(reportData.image_url),
        ...transferReportedWithPetFallback,
      ];

      const rescuedCandidates = [
        ...toArray(reportData.completion_photo),
        ...toArray(reportData.completion_photos),
        ...toArray(reportData.rescued_photo),
        ...toArray(reportData.rescued_images),
        ...toArray(reportData.proof_photo),
        ...toArray(reportData.proof_images),
        ...transferRescuedWithPetFallback,
      ];

      setDetailReportedImages(Array.from(new Set(reportedCandidates.map(resolveImageUri).filter(Boolean))));
      setDetailRescuedImages(Array.from(new Set(rescuedCandidates.map(resolveImageUri).filter(Boolean))));
    } catch {
      setDetailReportedImages(normalizedTransferReportedWithPet);
      setDetailRescuedImages(normalizedTransferRescuedWithPet);
    } finally {
      setLoadingDetailImages(false);
    }
  }, []);

  useEffect(() => {
    loadSelectedTransferImages(selectedTransfer);
  }, [loadSelectedTransferImages, selectedTransfer]);

  const visibleTypeOptions = useMemo(() => {
    if (isDeliveriesMode) {
      return TYPE_FILTER_OPTIONS.filter((option) => option.key === 'all' || option.key === 'shelter_to_user' || option.key === 'return_cases');
    }
    return TYPE_FILTER_OPTIONS.filter((option) => option.key !== 'shelter_to_user' && option.key !== 'return_cases');
  }, [isDeliveriesMode]);

  const quickTypeOptions = useMemo(() => {
    if (isDeliveriesMode) {
      return [
        { key: 'all', label: 'All Deliveries' },
        { key: 'shelter_to_user', label: 'Shelter to User' },
        { key: 'return_cases', label: 'Return Cases' },
      ];
    }

    return [
      { key: 'all', label: 'All Transfers' },
      { key: 'rescuer_to_shelter', label: 'Rescuer Requests' },
      { key: 'shelter_to_shelter', label: 'Shelter to Shelter' },
    ];
  }, [isDeliveriesMode]);

  const visibleStatusOptions = useMemo(() => {
    return isDeliveriesMode ? DELIVERY_STATUS_FILTER_OPTIONS : STATUS_FILTER_OPTIONS;
  }, [isDeliveriesMode]);

  const isReturnStatusSelected = useMemo(() => (
    isDeliveriesMode && String(statusFilter || '').startsWith('return_')
  ), [isDeliveriesMode, statusFilter]);

  const renderCard = (item) => {
    const statusPalette = STATUS_COLORS[item.status] || { bg: '#F3F4F6', text: '#4B5563' };
    const transactionLabel = item.transaction_type === 'shelter_to_user'
      ? 'Shelter to User'
      : (item.transaction_type === 'shelter_to_shelter' ? 'Shelter to Shelter' : 'Rescuer to Shelter');
    const shelterId = getPrimaryShelterId(item);

    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardTopTextWrap}>
            <Text style={styles.shelterIdLabel}>Shelter ID</Text>
            <Text style={styles.shelterIdValue}>{shortenId(shelterId)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusPalette.bg }]}>
            <Text style={[styles.statusText, { color: statusPalette.text }]}>{item.status.replace(/_/g, ' ')}</Text>
          </View>
        </View>

        <View style={styles.cardSubRow}>
          <Text style={styles.transferRef} numberOfLines={1} ellipsizeMode="tail">Transfer #{item.id.slice(0, 8)}</Text>
          <View style={styles.typePill}>
            <Text style={styles.typePillText} numberOfLines={1}>{transactionLabel}</Text>
          </View>
        </View>

        <Text numberOfLines={1} style={styles.cardMeta}><Text style={styles.metaLabel}>From:</Text> {item.from_party}</Text>
        <Text numberOfLines={1} style={styles.cardMeta}><Text style={styles.metaLabel}>To:</Text> {item.to_party}</Text>
        {item.pet_name ? <Text numberOfLines={1} style={styles.cardMeta}><Text style={styles.metaLabel}>Pet:</Text> {item.pet_name}</Text> : null}

        <View style={styles.cardActionRow}>
          <TouchableOpacity style={styles.viewButton} onPress={() => setSelectedTransfer(item)}>
            <Ionicons name="eye-outline" size={16} color="#FFFFFF" />
            <Text style={styles.viewButtonText}>View</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderDetailRow = (label, value) => (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{String(value || 'N/A')}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={ADMIN_COLORS.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={onGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={ADMIN_COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>{isDeliveriesMode ? 'Adoption Deliveries' : 'Shelter Transfers'}</Text>
          <Text style={styles.headerSubtitle}>{isDeliveriesMode ? 'Shelters delivering approved pets to adopters' : 'Rescuer and shelter-to-shelter transfer transactions'}</Text>
        </View>
      </View>

      <View style={styles.toolsWrap}>
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <TextInput
              style={styles.searchInput}
              placeholder={isDeliveriesMode ? 'Search shelter, adopter, pet' : 'Search shelter ID, transfer, report'}
              placeholderTextColor={ADMIN_COLORS.textMuted}
              value={searchDraft}
              onChangeText={setSearchDraft}
              onSubmitEditing={applySearch}
              returnKeyType="search"
            />
            {searchDraft ? (
              <TouchableOpacity
                onPress={() => {
                  setSearchDraft('');
                  setSearchText('');
                }}
              >
                <Ionicons name="close-circle" size={18} color={ADMIN_COLORS.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity style={styles.searchButton} onPress={applySearch}>
            <Ionicons name="search" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, showFilters && styles.filterButtonActive]}
            onPress={() => setShowFilters((prev) => !prev)}
          >
            <Ionicons name="options-outline" size={18} color={showFilters ? '#FFFFFF' : ADMIN_COLORS.text} />
          </TouchableOpacity>
        </View>

        {showFilters ? (
          <View style={styles.filtersPanel}>
            <Text style={styles.filterTitle}>Status</Text>
            <View style={styles.filterChipRow}>
              {visibleStatusOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.filterChip, statusFilter === option && styles.filterChipActive]}
                  onPress={() => setStatusFilter(option)}
                >
                  <Text style={[styles.filterChipText, statusFilter === option && styles.filterChipTextActive]}>
                    {option.replace(/_/g, ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterTitle}>{isDeliveriesMode ? 'Delivery Type' : 'Transfer Type'}</Text>
            <View style={styles.filterChipRow}>
              {visibleTypeOptions.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.filterChip, typeFilter === option.key && styles.filterChipActive]}
                  onPress={() => setTypeFilter(option.key)}
                >
                  <Text style={[styles.filterChipText, typeFilter === option.key && styles.filterChipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.clearFiltersButton} onPress={resetFilters}>
              <Text style={styles.clearFiltersText}>Clear Search & Filters</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.approved}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      {isDeliveriesMode ? (
        <View style={styles.returnSummaryBanner}>
          <Ionicons name="refresh-circle-outline" size={16} color="#92400E" />
          <Text style={styles.returnSummaryText}>Return Cases: {stats.returns}</Text>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickTypeFilterScroll}
        contentContainerStyle={styles.quickTypeFilterRow}
      >
        {quickTypeOptions.map((option) => {
          const active = typeFilter === option.key || (option.key === 'return_cases' && isReturnStatusSelected);
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.quickTypeChip, active && styles.quickTypeChipActive]}
              onPress={() => setTypeFilter(option.key)}
            >
              <Text style={[styles.quickTypeChipText, active && styles.quickTypeChipTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ADMIN_COLORS.primary]} />}
      >
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={ADMIN_COLORS.primary} />
            <Text style={styles.centerText}>{isDeliveriesMode ? 'Loading delivery transactions...' : 'Loading transfer transactions...'}</Text>
          </View>
        ) : filteredRows.length === 0 ? (
          <View style={styles.centerState}>
            <Ionicons name="swap-horizontal-outline" size={52} color={ADMIN_COLORS.textMuted} />
            <Text style={styles.emptyTitle}>{isDeliveriesMode ? 'No Matching Deliveries' : 'No Matching Transfers'}</Text>
            <Text style={styles.centerText}>Try another search term or adjust your filters.</Text>
          </View>
        ) : (
          filteredRows.map(renderCard)
        )}
      </ScrollView>

      <Modal visible={!!selectedTransfer} transparent animationType="slide" onRequestClose={() => setSelectedTransfer(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandleWrap}>
              <View style={styles.modalHandle} />
            </View>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isDeliveriesMode ? 'Delivery Details' : 'Transfer Details'}</Text>
              <TouchableOpacity
                onPress={() => {
                  setSelectedTransfer(null);
                  setDetailReportedImages([]);
                  setDetailRescuedImages([]);
                  setLoadingDetailImages(false);
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={20} color={ADMIN_COLORS.text} />
              </TouchableOpacity>
            </View>

            {selectedTransfer ? (
              <ScrollView
                style={styles.modalBody}
                contentContainerStyle={styles.modalBodyContent}
                showsVerticalScrollIndicator={false}
                overScrollMode="never"
              >
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Overview</Text>
                  {renderDetailRow('Shelter ID', getPrimaryShelterId(selectedTransfer))}
                  {renderDetailRow(selectedTransfer.transaction_type === 'shelter_to_user' ? 'Adoption ID' : 'Transfer ID', selectedTransfer.id)}
                  {renderDetailRow('Status', selectedTransfer.status.replace(/_/g, ' '))}
                  {renderDetailRow('Type', selectedTransfer.transaction_type === 'shelter_to_user' ? 'Shelter to User' : (selectedTransfer.transaction_type === 'shelter_to_shelter' ? 'Shelter to Shelter' : 'Rescuer to Shelter'))}
                  {renderDetailRow('Urgency', selectedTransfer.urgency || 'normal')}
                </View>

                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Transfer Parties</Text>
                  {renderDetailRow('From', selectedTransfer.from_party)}
                  {renderDetailRow('To', selectedTransfer.to_party)}
                  {renderDetailRow('From Shelter ID', selectedTransfer.from_shelter_id)}
                  {renderDetailRow(selectedTransfer.transaction_type === 'shelter_to_user' ? 'To User ID' : 'To Shelter ID', selectedTransfer.to_user_id || selectedTransfer.user_id || selectedTransfer.to_shelter_id || selectedTransfer.shelter_id)}
                  {selectedTransfer.transaction_type === 'shelter_to_user'
                    ? renderDetailRow('Pet', selectedTransfer.pet_name)
                    : renderDetailRow('Rescue Report', selectedTransfer.rescue_report_id)}
                </View>

                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Activity</Text>
                  {renderDetailRow('Submitted', formatDate(selectedTransfer.created_at))}
                  {renderDetailRow('Reviewed', formatDate(selectedTransfer.reviewed_at))}
                  {renderDetailRow('Updated', formatDate(selectedTransfer.updated_at))}
                  {renderDetailRow('Notes', selectedTransfer.notes || 'None')}
                </View>

                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Reported Picture</Text>
                  {loadingDetailImages ? (
                    <View style={styles.imagesLoadingWrap}>
                      <ActivityIndicator size="small" color={ADMIN_COLORS.primary} />
                      <Text style={styles.timelineDate}>Loading photos...</Text>
                    </View>
                  ) : detailReportedImages.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imagesRow}>
                      {detailReportedImages.map((imageUri, index) => (
                        <Image key={`${imageUri}_${index}`} source={{ uri: imageUri }} style={styles.detailImage} />
                      ))}
                    </ScrollView>
                  ) : (
                    <Text style={styles.timelineDate}>No reported picture found.</Text>
                  )}
                </View>

                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Rescued Picture</Text>
                  {loadingDetailImages ? (
                    <View style={styles.imagesLoadingWrap}>
                      <ActivityIndicator size="small" color={ADMIN_COLORS.primary} />
                      <Text style={styles.timelineDate}>Loading photos...</Text>
                    </View>
                  ) : detailRescuedImages.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imagesRow}>
                      {detailRescuedImages.map((imageUri, index) => (
                        <Image key={`${imageUri}_${index}`} source={{ uri: imageUri }} style={styles.detailImage} />
                      ))}
                    </ScrollView>
                  ) : (
                    <Text style={styles.timelineDate}>No rescued picture found.</Text>
                  )}
                </View>

                {selectedTransfer.transaction_type === 'shelter_to_shelter' ? (
                  <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Transfer Timeline</Text>
                    {getTransferTimelineItems(selectedTransfer).map((step) => (
                      <View key={step.key} style={styles.timelineRow}>
                        <View style={[styles.timelineDot, step.complete ? styles.timelineDotComplete : null]} />
                        <View style={styles.timelineTextWrap}>
                          <Text style={styles.timelineLabel}>{step.label}</Text>
                          <Text style={styles.timelineDate}>{step.date ? formatDate(step.date) : 'Not recorded'}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}

                {selectedTransfer.transaction_type === 'shelter_to_user' ? (
                  <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Delivery Timeline</Text>
                    {getDeliveryTimelineItems(selectedTransfer).map((step) => (
                      <View key={step.key} style={styles.timelineRow}>
                        <View style={[styles.timelineDot, step.complete ? styles.timelineDotComplete : null]} />
                        <View style={styles.timelineTextWrap}>
                          <Text style={styles.timelineLabel}>{step.label}</Text>
                          <Text style={styles.timelineDate}>{step.date ? formatDate(step.date) : 'Not recorded'}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </ScrollView>
            ) : null}
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
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: ADMIN_COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: ADMIN_COLORS.background,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: ADMIN_COLORS.textSecondary,
  },
  toolsWrap: {
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    backgroundColor: ADMIN_COLORS.surface,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: ADMIN_COLORS.text,
  },
  searchButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ADMIN_COLORS.primary,
  },
  filterButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    backgroundColor: ADMIN_COLORS.surface,
  },
  filterButtonActive: {
    backgroundColor: ADMIN_COLORS.primary,
    borderColor: ADMIN_COLORS.primary,
  },
  filtersPanel: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    backgroundColor: ADMIN_COLORS.surface,
    padding: 10,
  },
  filterTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
    marginBottom: 6,
    marginTop: 2,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: ADMIN_COLORS.background,
  },
  filterChipActive: {
    borderColor: ADMIN_COLORS.primary,
    backgroundColor: `${ADMIN_COLORS.primary}1A`,
  },
  filterChipText: {
    fontSize: 12,
    color: ADMIN_COLORS.textSecondary,
    textTransform: 'capitalize',
  },
  filterChipTextActive: {
    color: ADMIN_COLORS.primary,
    fontWeight: '700',
  },
  clearFiltersButton: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingVertical: 4,
  },
  clearFiltersText: {
    fontSize: 12,
    color: ADMIN_COLORS.primary,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: ADMIN_COLORS.surface,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
  },
  statLabel: {
    marginTop: 2,
    fontSize: 11,
    color: ADMIN_COLORS.textSecondary,
  },
  returnSummaryBanner: {
    marginHorizontal: 14,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  returnSummaryText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '700',
  },
  quickTypeFilterScroll: {
    maxHeight: 46,
    marginTop: 8,
  },
  quickTypeFilterRow: {
    paddingHorizontal: 14,
    gap: 8,
    alignItems: 'center',
  },
  quickTypeChip: {
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: ADMIN_COLORS.surface,
  },
  quickTypeChipActive: {
    borderColor: ADMIN_COLORS.primary,
    backgroundColor: `${ADMIN_COLORS.primary}1A`,
  },
  quickTypeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: ADMIN_COLORS.textSecondary,
  },
  quickTypeChipTextActive: {
    color: ADMIN_COLORS.primary,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingTop: 10,
    paddingBottom: 22,
  },
  centerState: {
    marginTop: 80,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  centerText: {
    marginTop: 8,
    textAlign: 'center',
    color: ADMIN_COLORS.textSecondary,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
  },
  card: {
    backgroundColor: ADMIN_COLORS.surface,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTopTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  shelterIdLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    color: ADMIN_COLORS.textMuted,
    letterSpacing: 0.4,
  },
  shelterIdValue: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: '800',
    color: ADMIN_COLORS.text,
    letterSpacing: 0.2,
  },
  transferRef: {
    fontSize: 12,
    color: ADMIN_COLORS.textSecondary,
    flexShrink: 1,
  },
  cardSubRow: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  typePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: ADMIN_COLORS.background,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    maxWidth: '100%',
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: ADMIN_COLORS.textSecondary,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  cardMeta: {
    marginTop: 2,
    fontSize: 13,
    color: ADMIN_COLORS.textSecondary,
    lineHeight: 21,
  },
  metaLabel: {
    color: ADMIN_COLORS.text,
    fontWeight: '700',
  },
  cardActionRow: {
    marginTop: 12,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: ADMIN_COLORS.border,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    backgroundColor: ADMIN_COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 114,
  },
  viewButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    width: '100%',
    height: '85%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: ADMIN_COLORS.surface,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    overflow: 'hidden',
  },
  modalHandleWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  modalHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
  },
  modalCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ADMIN_COLORS.background,
  },
  modalBody: {
    flex: 1,
    backgroundColor: ADMIN_COLORS.surface,
    paddingTop: 8,
  },
  modalBodyContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 28,
  },
  sectionContainer: {
    marginBottom: 12,
    backgroundColor: ADMIN_COLORS.background,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: ADMIN_COLORS.primary,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.border,
  },
  detailRow: {
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.3,
    color: ADMIN_COLORS.textMuted,
  },
  detailValue: {
    marginTop: 3,
    fontSize: 14,
    color: ADMIN_COLORS.text,
    lineHeight: 20,
  },
  timelineSection: {
    marginTop: 0,
    paddingTop: 0,
  },
  timelineTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: ADMIN_COLORS.textMuted,
    marginBottom: 8,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.border,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
    marginRight: 10,
    backgroundColor: '#D1D5DB',
  },
  timelineDotComplete: {
    backgroundColor: ADMIN_COLORS.primary,
  },
  timelineTextWrap: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
  },
  timelineDate: {
    marginTop: 2,
    fontSize: 12,
    color: ADMIN_COLORS.textSecondary,
  },
  imagesLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  imagesRow: {
    paddingVertical: 6,
    gap: 8,
  },
  detailImage: {
    width: 110,
    height: 82,
    borderRadius: 8,
    backgroundColor: ADMIN_COLORS.border,
    marginRight: 8,
  },
});

export default AdminShelterTransfersScreen;
