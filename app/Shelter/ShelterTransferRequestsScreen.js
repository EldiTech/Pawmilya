import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import { auth, db } from '../../firebaseConfig';
import { normalizeTransferStatus } from '../../utils/status';

const STATUS_COLORS = {
  pending: '#F59E0B',
  approved: '#10B981',
  accepted: '#10B981',
  rejected: '#EF4444',
  cancelled: '#6B7280',
  in_transit: '#3B82F6',
  arrived_at_shelter: '#8B5CF6',
  completed: '#059669',
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
};

const formatReviewedDate = (transfer) => {
  const reviewedValue = transfer?.reviewed_at || transfer?.reviewedAt || transfer?.review_date || null;
  if (reviewedValue) {
    return formatDate(reviewedValue);
  }

  const normalizedStatus = normalizeTransferStatus(transfer?.status);
  if (normalizedStatus === 'pending') {
    return 'Pending review';
  }

  return 'Not recorded';
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

const parseCoordinate = (...values) => {
  for (const value of values) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const buildAddressText = (record = {}) => {
  return [
    record?.address,
    record?.city,
    record?.province,
    record?.country,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ');
};

const isShelterToShelterTransfer = (transfer) => Boolean(
  transfer?.from_shelter_id ||
  transfer?.to_shelter_id ||
  transfer?.requested_by_shelter_id ||
  transfer?.requested_by_shelter_name
);

const isEligibleShelterPetForTransfer = (pet = {}) => {
  const status = String(pet?.status || '').toLowerCase();
  const listingStatus = String(pet?.adoption_listing_status || '').toLowerCase();
  return !(
    pet?._adopter_id
    || pet?.adopted_by_user_id
    || pet?.adopted_at
    || status === 'adopted'
    || status === 'unavailable'
    || status === 'inactive'
    || listingStatus === 'cancelled'
  );
};

const TRANSFER_FLOW = {
  pending: ['approved', 'rejected'],
  approved: ['in_transit'],
  in_transit: ['arrived_at_shelter'],
  arrived_at_shelter: ['completed'],
};

const ShelterTransferRequestsScreen = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transfers, setTransfers] = useState([]);
  const [transferTypeFilter, setTransferTypeFilter] = useState('all');
  const [managedShelter, setManagedShelter] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [reportedImages, setReportedImages] = useState([]);
  const [rescuedImages, setRescuedImages] = useState([]);
  const [loadingInfoImages, setLoadingInfoImages] = useState(false);
  const [availableShelters, setAvailableShelters] = useState([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creatingTransfer, setCreatingTransfer] = useState(false);
  const [selectedTargetShelterId, setSelectedTargetShelterId] = useState('');
  const [selectedPetId, setSelectedPetId] = useState('');
  const [createUrgency, setCreateUrgency] = useState('normal');
  const [createNotes, setCreateNotes] = useState('');
  const [availablePets, setAvailablePets] = useState([]);

  const loadTransfers = useCallback(async () => {
    try {
      setLoading(true);

      const currentUser = auth.currentUser;
      if (!currentUser?.uid) {
        setTransfers([]);
        setAvailableShelters([]);
        setAvailablePets([]);
        return;
      }

      const shelterByManager = await getDocs(query(
        collection(db, 'shelters'),
        where('manager_id', '==', currentUser.uid)
      ));

      if (shelterByManager.empty) {
        setManagedShelter(null);
        setTransfers([]);
        setAvailableShelters([]);
        setAvailablePets([]);
        return;
      }

      const shelterDoc = shelterByManager.docs[0];
      const shelter = { id: shelterDoc.id, ...shelterDoc.data() };
      setManagedShelter(shelter);

      const sheltersSnap = await getDocs(collection(db, 'shelters'));
      const nextShelterOptions = sheltersSnap.docs
        .map((shelterSnap) => ({ id: shelterSnap.id, ...(shelterSnap.data() || {}) }))
        .filter((item) => String(item.id) !== String(shelter.id))
        .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
      setAvailableShelters(nextShelterOptions);

      const petsSnap = await getDocs(query(
        collection(db, 'pets'),
        where('shelter_id', '==', shelter.id)
      ));
      const transferEligiblePets = petsSnap.docs
        .map((petDoc) => ({ id: petDoc.id, ...(petDoc.data() || {}) }))
        .filter((pet) => isEligibleShelterPetForTransfer(pet))
        .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
      setAvailablePets(transferEligiblePets);

      const [byShelterId, byToShelterId, byFromShelterId] = await Promise.all([
        getDocs(query(collection(db, 'transfers'), where('shelter_id', '==', shelter.id))),
        getDocs(query(collection(db, 'transfers'), where('to_shelter_id', '==', shelter.id))),
        getDocs(query(collection(db, 'transfers'), where('from_shelter_id', '==', shelter.id))),
      ]);

      const merged = new Map();
      byShelterId.forEach((docSnap) => merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
      byToShelterId.forEach((docSnap) => merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
      byFromShelterId.forEach((docSnap) => merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));

      const rows = Array.from(merged.values()).sort((a, b) => {
        const aDate = a?.created_at?.toDate ? a.created_at.toDate() : new Date(a?.created_at || 0);
        const bDate = b?.created_at?.toDate ? b.created_at.toDate() : new Date(b?.created_at || 0);
        return bDate - aDate;
      });

      const rescuerIds = Array.from(new Set(
        rows
          .map((item) => String(item?.rescuer_id || item?.requested_by || '').trim())
          .filter(Boolean)
      ));

      const fromShelterIds = Array.from(new Set(
        rows
          .map((item) => String(item?.from_shelter_id || '').trim())
          .filter(Boolean)
      ));

      const [rescuerNames, fromShelterNames] = await Promise.all([
        Promise.all(rescuerIds.map(async (userId) => {
          try {
            const userSnap = await getDoc(doc(db, 'users', userId));
            const userData = userSnap.exists() ? (userSnap.data() || {}) : {};
            return [userId, userData.full_name || userData.name || userData.email || null];
          } catch {
            return [userId, null];
          }
        })),
        Promise.all(fromShelterIds.map(async (shelterId) => {
          try {
            const shelterSnap = await getDoc(doc(db, 'shelters', shelterId));
            const shelterData = shelterSnap.exists() ? (shelterSnap.data() || {}) : {};
            return [shelterId, shelterData.name || null];
          } catch {
            return [shelterId, null];
          }
        })),
      ]);

      const rescuerNameMap = Object.fromEntries(rescuerNames);
      const fromShelterNameMap = Object.fromEntries(fromShelterNames);

      const enrichedRows = rows.map((item) => ({
        ...item,
        _rescuer_name: rescuerNameMap[String(item?.rescuer_id || item?.requested_by || '').trim()] || null,
        _from_shelter_name: fromShelterNameMap[String(item?.from_shelter_id || '').trim()] || null,
      }));

      setTransfers(enrichedRows);
    } catch (error) {
      console.error('Error loading shelter transfers:', error);
      setTransfers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTransfers();
  }, [loadTransfers]);

  const transferTypeCounts = useMemo(() => {
    let rescuer = 0;
    let shelter = 0;

    transfers.forEach((item) => {
      if (isShelterToShelterTransfer(item)) {
        shelter += 1;
      } else {
        rescuer += 1;
      }
    });

    return {
      all: transfers.length,
      rescuer,
      shelter,
    };
  }, [transfers]);

  const filteredTransfers = useMemo(() => {
    if (transferTypeFilter === 'rescuer') {
      return transfers.filter((item) => !isShelterToShelterTransfer(item));
    }
    if (transferTypeFilter === 'shelter') {
      return transfers.filter((item) => isShelterToShelterTransfer(item));
    }
    return transfers;
  }, [transferTypeFilter, transfers]);

  const pendingCount = useMemo(() => (
    filteredTransfers.filter((item) => normalizeTransferStatus(item.status) === 'pending').length
  ), [filteredTransfers]);

  const filterOptions = useMemo(() => ([
    { key: 'all', label: 'All Transfers', count: transferTypeCounts.all },
    { key: 'rescuer', label: 'Rescuer Requests', count: transferTypeCounts.rescuer },
    { key: 'shelter', label: 'Shelter to Shelter', count: transferTypeCounts.shelter },
  ]), [transferTypeCounts.all, transferTypeCounts.rescuer, transferTypeCounts.shelter]);

  const applyTransferPatchLocally = useCallback((transferId, patch) => {
    setTransfers((prev) => prev.map((item) => (
      String(item.id) === String(transferId)
        ? { ...item, ...patch }
        : item
    )));
  }, []);

  const notifyTransferDecision = useCallback(async (transfer, nextStatus) => {
    const recipientUserId = String(transfer?.rescuer_id || transfer?.requested_by || '').trim();
    if (!recipientUserId) {
      return;
    }

    const isApproved = nextStatus === 'approved';
    const notificationRef = doc(collection(db, 'notifications'));
    await setDoc(notificationRef, {
      user_id: recipientUserId,
      title: isApproved ? 'Shelter Transfer Approved' : 'Shelter Transfer Rejected',
      message: isApproved
        ? `Your transfer request to ${transfer?.shelter_name || managedShelter?.name || 'the shelter'} has been approved.`
        : `Your transfer request to ${transfer?.shelter_name || managedShelter?.name || 'the shelter'} was rejected by the shelter.`,
      type: isApproved ? 'shelter_transfer_approved' : 'shelter_transfer_rejected',
      transfer_request_id: String(transfer?.id || ''),
      rescue_report_id: String(transfer?.rescue_report_id || ''),
      read: false,
      created_at: serverTimestamp(),
    });
  }, [managedShelter?.name]);

  const logTransferDecisionAudit = useCallback(async (transfer, nextStatus) => {
    const rescuerId = String(transfer?.rescuer_id || transfer?.requested_by || '').trim();
    if (!rescuerId) return;

    const normalizedStatus = normalizeTransferStatus(nextStatus);
    const shelterName = transfer?.shelter_name || managedShelter?.name || 'Shelter';
    const title = normalizedStatus === 'approved' ? 'Shelter Transfer Approved' : 'Shelter Transfer Rejected';
    const description = normalizedStatus === 'approved'
      ? `${shelterName} approved the transfer request.`
      : `${shelterName} rejected the transfer request.`;

    const auditRef = doc(collection(db, 'rescuer_audit_logs'));
    await setDoc(auditRef, {
      user_id: rescuerId,
      rescuer_id: rescuerId,
      rescuer_name: transfer?.rescuer_name || 'Rescuer',
      title,
      description,
      rescue_report_id: String(transfer?.rescue_report_id || ''),
      transfer_request_id: String(transfer?.id || ''),
      shelter_id: String(transfer?.shelter_id || managedShelter?.id || ''),
      workflow_type: 'shelter_transfer',
      event_type: normalizedStatus === 'approved' ? 'transfer_approved' : 'transfer_rejected',
      status: normalizedStatus,
      created_at: serverTimestamp(),
    });
  }, [managedShelter?.id, managedShelter?.name]);

  const createRescuedPetIdentification = useCallback(async (transfer, rescueReportData = {}) => {
    const rescuedPetRef = doc(db, 'rescued_pets', String(transfer.id));
    await setDoc(rescuedPetRef, {
      transfer_request_id: String(transfer.id),
      rescue_report_id: String(transfer.rescue_report_id || ''),
      shelter_id: String(transfer.shelter_id || managedShelter?.id || ''),
      shelter_name: transfer.shelter_name || managedShelter?.name || '',
      rescuer_id: transfer.rescuer_id || null,
      intake_status: 'awaiting_arrival',
      animal_type: rescueReportData?.animal_type || rescueReportData?.animalType || null,
      title: rescueReportData?.title || `Rescued Pet ${transfer.rescue_report_id || ''}`,
      description: rescueReportData?.description || '',
      location_description: rescueReportData?.location_description || rescueReportData?.location || '',
      urgency: rescueReportData?.urgency || transfer?.urgency || 'normal',
      images: Array.isArray(rescueReportData?.images) ? rescueReportData.images : [],
      source: 'shelter_transfer',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    }, { merge: true });
  }, [managedShelter?.id, managedShelter?.name]);

  const processTransferDecision = useCallback(async (transfer, nextStatus) => {
    const normalizedNextStatus = normalizeTransferStatus(nextStatus);

    if (!transfer?.id || !['approved', 'rejected'].includes(normalizedNextStatus)) {
      return;
    }

    try {
      setProcessingId(String(transfer.id));

      const transferRef = doc(db, 'transfers', String(transfer.id));
      await updateDoc(transferRef, {
        status: normalizedNextStatus,
        reviewed_at: serverTimestamp(),
        reviewed_by_shelter_id: String(managedShelter?.id || transfer?.shelter_id || ''),
        updated_at: serverTimestamp(),
      });

      let rescueReportData = null;
      const rescueReportId = String(transfer?.rescue_report_id || '').trim();
      if (rescueReportId) {
        const reportRef = doc(db, 'rescue_reports', rescueReportId);
        const reportSnap = await getDoc(reportRef);
        rescueReportData = reportSnap.exists() ? (reportSnap.data() || {}) : null;

        await updateDoc(reportRef, {
          shelter_transfer_status: normalizedNextStatus,
          updated_at: serverTimestamp(),
        });
      }

      if (normalizedNextStatus === 'approved') {
        await createRescuedPetIdentification(transfer, rescueReportData || {});
      }

      await notifyTransferDecision(transfer, normalizedNextStatus);
      await logTransferDecisionAudit(transfer, normalizedNextStatus);
      applyTransferPatchLocally(transfer.id, { status: normalizedNextStatus, updated_at: new Date().toISOString() });

      Alert.alert(
        normalizedNextStatus === 'approved' ? 'Transfer Approved' : 'Transfer Rejected',
        normalizedNextStatus === 'approved'
          ? 'Transfer request approved. A rescued pet record was created for identification.'
          : 'Transfer request rejected. The rescuer has been notified.'
      );
    } catch (error) {
      console.error('Error processing transfer decision:', error);
      Alert.alert('Error', 'Failed to process transfer request. Please try again.');
    } finally {
      setProcessingId(null);
    }
  }, [applyTransferPatchLocally, createRescuedPetIdentification, logTransferDecisionAudit, managedShelter?.id, notifyTransferDecision]);

  const handleTransferDecision = useCallback((transfer, nextStatus) => {
    const isApprove = nextStatus === 'approved';
    Alert.alert(
      isApprove ? 'Approve Transfer' : 'Reject Transfer',
      isApprove
        ? 'Approve this transfer request and register rescued pet for shelter identification?'
        : 'Reject this transfer request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isApprove ? 'Approve' : 'Reject',
          style: isApprove ? 'default' : 'destructive',
          onPress: () => processTransferDecision(transfer, nextStatus),
        },
      ]
    );
  }, [processTransferDecision]);

  const handleViewInformation = useCallback(async (transfer) => {
    const target = transfer || null;
    setSelectedTransfer(target);
    setReportedImages([]);
    setRescuedImages([]);
    setInfoModalVisible(true);

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
      transferReportedCandidates
        .map(resolveImageUri)
        .filter(Boolean)
    ));

    const normalizedTransferRescued = Array.from(new Set(
      transferRescuedCandidates
        .map(resolveImageUri)
        .filter(Boolean)
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
      transferReportedWithPetFallback
        .map(resolveImageUri)
        .filter(Boolean)
    ));

    const normalizedTransferRescuedWithPet = Array.from(new Set(
      transferRescuedWithPetFallback
        .map(resolveImageUri)
        .filter(Boolean)
    ));

    const rescueReportId = String(target?.rescue_report_id || '').trim();
    if (!rescueReportId) {
      setReportedImages(normalizedTransferReportedWithPet);
      setRescuedImages(normalizedTransferRescuedWithPet);
      return;
    }

    try {
      setLoadingInfoImages(true);
      const reportSnap = await getDoc(doc(db, 'rescue_reports', rescueReportId));
      if (!reportSnap.exists()) {
        setReportedImages(normalizedTransferReportedWithPet);
        setRescuedImages(normalizedTransferRescuedWithPet);
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

      const normalizedReported = Array.from(new Set(
        reportedCandidates
          .map(resolveImageUri)
          .filter(Boolean)
      ));

      const normalizedRescued = Array.from(new Set(
        rescuedCandidates
          .map(resolveImageUri)
          .filter(Boolean)
      ));

      setReportedImages(normalizedReported);
      setRescuedImages(normalizedRescued);
    } catch (error) {
      console.error('Error loading transfer images:', error);
      setReportedImages(normalizedTransferReportedWithPet);
      setRescuedImages(normalizedTransferRescuedWithPet);
    } finally {
      setLoadingInfoImages(false);
    }
  }, []);

  const closeInfoModal = useCallback(() => {
    setInfoModalVisible(false);
    setReportedImages([]);
    setRescuedImages([]);
    setLoadingInfoImages(false);
  }, []);

  const openCreateTransferModal = useCallback(() => {
    setSelectedTargetShelterId('');
    setSelectedPetId('');
    setCreateUrgency('normal');
    setCreateNotes('');
    setCreateModalVisible(true);
  }, []);

  const closeCreateTransferModal = useCallback(() => {
    if (creatingTransfer) return;
    setCreateModalVisible(false);
  }, [creatingTransfer]);

  const handleCreateTransfer = useCallback(async () => {
    const fromShelterId = String(managedShelter?.id || '').trim();
    const fromShelterName = String(managedShelter?.name || '').trim();

    if (!fromShelterId) {
      Alert.alert('Unavailable', 'Your managed shelter profile is required before creating transfers.');
      return;
    }

    if (!selectedTargetShelterId) {
      Alert.alert('Destination Required', 'Please choose a destination shelter.');
      return;
    }

    if (!selectedPetId) {
      Alert.alert('Pet Required', 'Please choose a pet to transfer.');
      return;
    }

    const targetShelter = availableShelters.find((item) => String(item.id) === String(selectedTargetShelterId));
    const selectedPet = availablePets.find((item) => String(item.id) === String(selectedPetId));
    if (!targetShelter) {
      Alert.alert('Invalid Destination', 'Selected destination shelter could not be found.');
      return;
    }

    if (!selectedPet) {
      Alert.alert('Invalid Pet', 'Selected pet could not be found.');
      return;
    }

    try {
      setCreatingTransfer(true);

      const sourcePetImages = [
        ...toArray(selectedPet?.images),
        ...toArray(selectedPet?.image),
        ...toArray(selectedPet?.image_url),
      ]
        .map((item) => String(item || '').trim())
        .filter((item) => /^https?:\/\//i.test(item))
        .slice(0, 6);
      const fromLatitude = parseCoordinate(managedShelter?.latitude, managedShelter?.lat);
      const fromLongitude = parseCoordinate(managedShelter?.longitude, managedShelter?.lng);
      const toLatitude = parseCoordinate(targetShelter?.latitude, targetShelter?.lat);
      const toLongitude = parseCoordinate(targetShelter?.longitude, targetShelter?.lng);
      const fromAddress = buildAddressText(managedShelter);
      const toAddress = buildAddressText(targetShelter);

      const petStatus = String(selectedPet?.status || '').toLowerCase();
      const listingStatus = String(selectedPet?.adoption_listing_status || '').toLowerCase();
      if (petStatus === 'available' || listingStatus === 'listed') {
        const petRef = doc(db, 'pets', String(selectedPet.id));
        await updateDoc(petRef, {
          status: 'unavailable',
          adoption_listing_status: 'cancelled',
          transfer_request_pending: true,
          updated_at: serverTimestamp(),
        });
      }

      const transferRef = doc(collection(db, 'transfers'));
      await setDoc(transferRef, {
        transaction_type: 'shelter_to_shelter',
        status: 'pending',
        from_shelter_id: fromShelterId,
        from_shelter_name: fromShelterName || 'Source Shelter',
        requested_by_shelter_id: fromShelterId,
        requested_by_shelter_name: fromShelterName || 'Source Shelter',
        to_shelter_id: String(targetShelter.id),
        to_shelter_name: String(targetShelter.name || 'Destination Shelter'),
        shelter_id: String(targetShelter.id),
        shelter_name: String(targetShelter.name || 'Destination Shelter'),
        pet_id: String(selectedPet.id),
        pet_name: String(selectedPet.name || selectedPet.title || 'Unknown Pet'),
        animal_type: selectedPet.animal_type || selectedPet.type || selectedPet.category || null,
        source_pet_images: sourcePetImages,
        reported_images: sourcePetImages,
        rescued_images: sourcePetImages,
        from_shelter_latitude: fromLatitude,
        from_shelter_longitude: fromLongitude,
        to_shelter_latitude: toLatitude,
        to_shelter_longitude: toLongitude,
        from_shelter_address: fromAddress,
        to_shelter_address: toAddress,
        urgency: String(createUrgency || 'normal').trim() || 'normal',
        notes: String(createNotes || '').trim(),
        source: 'shelter_transfer',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      const destinationManagerUserId = String(targetShelter?.manager_id || '').trim();
      if (destinationManagerUserId) {
        const notificationRef = doc(collection(db, 'notifications'));
        await setDoc(notificationRef, {
          user_id: destinationManagerUserId,
          title: 'New Shelter Transfer Request',
          message: `${fromShelterName || 'A shelter'} sent a transfer request for ${selectedPet.name || 'a pet'} to ${targetShelter.name || 'your shelter'}.`,
          type: 'shelter_to_shelter_transfer_request',
          transfer_request_id: String(transferRef.id),
          read: false,
          created_at: serverTimestamp(),
        });
      }

      setCreateModalVisible(false);
      await loadTransfers();
      Alert.alert('Transfer Requested', 'Shelter transfer request submitted. Pet listing was cancelled before transfer.');
    } catch (error) {
      console.error('Error creating shelter transfer request:', error);
      Alert.alert('Error', 'Failed to create shelter transfer request. Please try again.');
    } finally {
      setCreatingTransfer(false);
    }
  }, [availablePets, availableShelters, createNotes, createUrgency, loadTransfers, managedShelter?.id, managedShelter?.name, selectedPetId, selectedTargetShelterId]);

  const openTransitTracker = useCallback(async (transfer) => {
    const fromLat = parseCoordinate(transfer?.from_shelter_latitude, transfer?.from_latitude);
    const fromLng = parseCoordinate(transfer?.from_shelter_longitude, transfer?.from_longitude);
    const toLat = parseCoordinate(transfer?.to_shelter_latitude, transfer?.to_latitude, transfer?.shelter_latitude);
    const toLng = parseCoordinate(transfer?.to_shelter_longitude, transfer?.to_longitude, transfer?.shelter_longitude);

    const originAddress = String(
      transfer?.from_shelter_address
      || transfer?.from_address
      || transfer?.from_shelter_name
      || transfer?.requested_by_shelter_name
      || ''
    ).trim();
    const destinationAddress = String(
      transfer?.to_shelter_address
      || transfer?.to_address
      || transfer?.to_shelter_name
      || transfer?.shelter_name
      || ''
    ).trim();

    const origin = fromLat !== null && fromLng !== null ? `${fromLat},${fromLng}` : originAddress;
    const destination = toLat !== null && toLng !== null ? `${toLat},${toLng}` : destinationAddress;

    if (!origin || !destination) {
      Alert.alert('Tracker Unavailable', 'Route coordinates or addresses are missing for this transfer.');
      return;
    }

    const routeUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
    try {
      await Linking.openURL(routeUrl);
    } catch {
      Alert.alert('Unable to Open Maps', 'Could not open Google Maps tracker on this device.');
    }
  }, []);

  const resolveTransferContext = useCallback((transfer) => {
    const record = transfer || {};
    const isShelterTransfer = isShelterToShelterTransfer(record);

    const destinationShelter =
      record?.to_shelter_name ||
      record?.shelter_name ||
      managedShelter?.name ||
      'Destination Shelter';

    if (isShelterTransfer) {
      const sourceShelter =
        record?.from_shelter_name ||
        record?._from_shelter_name ||
        record?.requested_by_shelter_name ||
        record?.requested_by_name ||
        'Source Shelter';

      return {
        kind: 'shelter',
        requesterLabel: 'Shelter',
        requesterValue: sourceShelter,
        sourceLabel: 'From Shelter',
        sourceValue: sourceShelter,
        destinationLabel: 'To Shelter',
        destinationValue: destinationShelter,
        title: `${sourceShelter} to ${destinationShelter}`,
      };
    }

    const requesterName =
      record?.rescuer_name ||
      record?.requested_by_name ||
      record?._rescuer_name ||
      record?.rescuer_id ||
      record?.requested_by ||
      'N/A';

    return {
      kind: 'rescuer',
      requesterLabel: 'Rescuer',
      requesterValue: requesterName,
      sourceLabel: '',
      sourceValue: '',
      destinationLabel: 'Destination Shelter',
      destinationValue: destinationShelter,
      title: `Rescuer to ${destinationShelter}`,
    };
  }, [managedShelter?.name]);

  const getTransferTypeInfo = useCallback((transfer) => {
    const isShelterTransfer = isShelterToShelterTransfer(transfer);

    if (isShelterTransfer) {
      return {
        type: 'shelter',
        label: 'Shelter Transfer',
        icon: 'business-outline',
        color: '#4F46E5',
        bg: '#EEF2FF',
        border: '#C7D2FE',
      };
    }

    return {
      type: 'rescuer',
      label: 'Rescuer Transfer',
      icon: 'person-outline',
      color: '#0F766E',
      bg: '#CCFBF1',
      border: '#99F6E4',
    };
  }, []);

  const selectedTransferTypeInfo = useMemo(() => (
    getTransferTypeInfo(selectedTransfer || {})
  ), [getTransferTypeInfo, selectedTransfer]);

  const selectedTransferContext = useMemo(() => (
    resolveTransferContext(selectedTransfer || {})
  ), [resolveTransferContext, selectedTransfer]);

  const getShelterRoleForTransfer = useCallback((transfer) => {
    const managedShelterId = String(managedShelter?.id || '').trim();
    if (!managedShelterId) return 'unknown';

    const record = transfer || {};
    const fromShelterId = String(record?.from_shelter_id || record?.requested_by_shelter_id || '').trim();
    const toShelterId = String(record?.to_shelter_id || record?.shelter_id || '').trim();

    if (managedShelterId && managedShelterId === fromShelterId) return 'sender';
    if (managedShelterId && managedShelterId === toShelterId) return 'receiver';
    return 'unknown';
  }, [managedShelter?.id]);

  const processTransferStatusProgress = useCallback(async (transfer, nextStatus) => {
    const currentStatus = normalizeTransferStatus(transfer?.status || 'pending');
    const normalizedNextStatus = normalizeTransferStatus(nextStatus);

    if (!transfer?.id || !TRANSFER_FLOW[currentStatus]?.includes(normalizedNextStatus)) {
      return;
    }

    try {
      setProcessingId(String(transfer.id));

      const extraPatch = {};
      if (normalizedNextStatus === 'in_transit') {
        extraPatch.in_transit_at = serverTimestamp();
      } else if (normalizedNextStatus === 'arrived_at_shelter') {
        extraPatch.arrived_at_shelter_at = serverTimestamp();
      } else if (normalizedNextStatus === 'completed') {
        extraPatch.completed_at = serverTimestamp();
      }

      const transferRef = doc(db, 'transfers', String(transfer.id));
      await updateDoc(transferRef, {
        status: normalizedNextStatus,
        ...extraPatch,
        updated_at: serverTimestamp(),
      });

      const rescueReportId = String(transfer?.rescue_report_id || '').trim();
      if (rescueReportId) {
        const reportRef = doc(db, 'rescue_reports', rescueReportId);
        await updateDoc(reportRef, {
          shelter_transfer_status: normalizedNextStatus,
          updated_at: serverTimestamp(),
        });
      }

      applyTransferPatchLocally(transfer.id, {
        status: normalizedNextStatus,
        updated_at: new Date().toISOString(),
      });

      if (normalizedNextStatus === 'in_transit') {
        Alert.alert(
          'Transfer In Transit',
          'Transfer marked in transit. Open Google Maps route tracker now?',
          [
            { text: 'Not Now', style: 'cancel' },
            { text: 'Open Tracker', onPress: () => openTransitTracker(transfer) },
          ]
        );
      } else {
        Alert.alert('Transfer Updated', `Transfer marked as ${normalizedNextStatus.replace(/_/g, ' ')}.`);
      }
    } catch (error) {
      console.error('Error updating transfer progress:', error);
      Alert.alert('Error', 'Failed to update transfer status. Please try again.');
    } finally {
      setProcessingId(null);
    }
  }, [applyTransferPatchLocally, openTransitTracker]);

  const handleTransferProgress = useCallback((transfer, nextStatus) => {
    const statusLabel = normalizeTransferStatus(nextStatus).replace(/_/g, ' ');
    Alert.alert(
      'Update Transfer Status',
      `Mark this transfer as ${statusLabel}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => processTransferStatusProgress(transfer, nextStatus),
        },
      ]
    );
  }, [processTransferStatusProgress]);

  const handleCancelTransferRequest = useCallback((transfer) => {
    const status = normalizeTransferStatus(transfer?.status || 'pending');
    const role = getShelterRoleForTransfer(transfer);
    if (status !== 'pending' || role !== 'sender') {
      Alert.alert('Cannot Cancel', 'Only pending requests can be cancelled by the sender shelter.');
      return;
    }

    Alert.alert(
      'Cancel Transfer Request',
      'Cancel this pending transfer request?',
      [
        { text: 'Keep Request', style: 'cancel' },
        {
          text: 'Cancel Request',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessingId(String(transfer.id));

              const transferRef = doc(db, 'transfers', String(transfer.id));
              await updateDoc(transferRef, {
                status: 'cancelled',
                cancelled_at: serverTimestamp(),
                cancelled_by_shelter_id: String(managedShelter?.id || ''),
                updated_at: serverTimestamp(),
              });

              const petId = String(transfer?.pet_id || '').trim();
              if (petId) {
                const petRef = doc(db, 'pets', petId);
                await updateDoc(petRef, {
                  status: 'available',
                  adoption_listing_status: 'listed',
                  transfer_request_pending: false,
                  updated_at: serverTimestamp(),
                });
              }

              applyTransferPatchLocally(transfer.id, {
                status: 'cancelled',
                updated_at: new Date().toISOString(),
              });

              Alert.alert('Transfer Cancelled', 'Transfer request cancelled and pet listing was restored.');
            } catch (error) {
              console.error('Error cancelling transfer request:', error);
              Alert.alert('Error', 'Failed to cancel transfer request. Please try again.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  }, [applyTransferPatchLocally, getShelterRoleForTransfer, managedShelter?.id]);

  const getTransferActions = useCallback((transfer) => {
    const status = normalizeTransferStatus(transfer?.status || 'pending');
    const isShelterTransfer = isShelterToShelterTransfer(transfer);
    const role = getShelterRoleForTransfer(transfer);

    if (status === 'pending' && role === 'receiver') {
      return [
        { key: 'rejected', label: 'Reject', variant: 'reject' },
        { key: 'approved', label: 'Accept', variant: 'approve' },
      ];
    }

    if (status === 'pending' && role === 'sender' && isShelterTransfer) {
      return [
        { key: 'cancel_request', label: 'Cancel Request', variant: 'reject' },
      ];
    }

    if (!isShelterTransfer) {
      return [];
    }

    if (status === 'approved' && role === 'sender') {
      return [{ key: 'in_transit', label: 'Mark In Transit', variant: 'approve' }];
    }

    if (status === 'in_transit' && role === 'receiver') {
      return [{ key: 'arrived_at_shelter', label: 'Mark Arrived', variant: 'approve' }];
    }

    if (status === 'arrived_at_shelter' && role === 'receiver') {
      return [{ key: 'completed', label: 'Mark Completed', variant: 'approve' }];
    }

    return [];
  }, [getShelterRoleForTransfer]);

  const renderTransferCard = (item) => {
    const status = normalizeTransferStatus(item.status) || 'pending';
    const statusColor = STATUS_COLORS[status] || COLORS.textMedium;
    const transferType = getTransferTypeInfo(item);
    const context = resolveTransferContext(item);
    const actions = getTransferActions(item);

    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{context.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{status.replace(/_/g, ' ')}</Text>
          </View>
        </View>

        <View style={[styles.typeBadge, { backgroundColor: transferType.bg, borderColor: transferType.border }]}>
          <Ionicons name={transferType.icon} size={14} color={transferType.color} />
          <Text style={[styles.typeBadgeText, { color: transferType.color }]}>{transferType.label}</Text>
        </View>

        <Text style={styles.metaText}>{context.requesterLabel}: {context.requesterValue}</Text>
        {context.sourceLabel ? <Text style={styles.metaText}>{context.sourceLabel}: {context.sourceValue}</Text> : null}
        <Text style={styles.metaText}>{context.destinationLabel}: {context.destinationValue}</Text>
        <Text style={styles.metaText}>Pet: {item?.pet_name || item?.pet_id || 'N/A'}</Text>
        <Text style={styles.metaText}>Submitted: {formatDate(item.created_at)}</Text>
        <Text style={styles.previewHintText}>Tap View Information for full details.</Text>

        {item.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Rescuer Notes</Text>
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.infoButton}
          onPress={() => handleViewInformation(item)}
          disabled={processingId === String(item.id)}
        >
          <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
          <Text style={styles.infoButtonText}>View Information</Text>
        </TouchableOpacity>

        {isShelterToShelterTransfer(item) && status === 'in_transit' ? (
          <TouchableOpacity style={styles.trackButton} onPress={() => openTransitTracker(item)}>
            <Ionicons name="navigate-outline" size={16} color="#075985" />
            <Text style={styles.trackButtonText}>Track Route</Text>
          </TouchableOpacity>
        ) : null}

        {actions.length > 0 && (
          <View style={styles.actionsRow}>
            {actions.map((action) => {
              const isApproveAction = action.variant === 'approve';
              const isBusy = processingId === String(item.id);
              const onPress = action.key === 'cancel_request'
                ? () => handleCancelTransferRequest(item)
                : (action.key === 'approved' || action.key === 'rejected'
                  ? () => handleTransferDecision(item, action.key)
                  : () => handleTransferProgress(item, action.key));

              return (
                <TouchableOpacity
                  key={action.key}
                  style={[styles.actionButton, isApproveAction ? styles.approveButton : styles.rejectButton]}
                  onPress={onPress}
                  disabled={isBusy}
                >
                  {isBusy && isApproveAction ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={isApproveAction ? styles.approveButtonText : styles.rejectButtonText}>{action.label}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <Modal
        visible={infoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeInfoModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeInfoModal}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Transfer Information</Text>
              <TouchableOpacity onPress={closeInfoModal} style={styles.modalCloseButton}>
                <Ionicons name="close" size={20} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Request ID</Text>
                <Text style={styles.infoValue}>{selectedTransfer?.id || 'N/A'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Transfer Type</Text>
                <View style={[styles.modalTypeBadge, { backgroundColor: selectedTransferTypeInfo.bg, borderColor: selectedTransferTypeInfo.border }]}> 
                  <Ionicons name={selectedTransferTypeInfo.icon} size={14} color={selectedTransferTypeInfo.color} />
                  <Text style={[styles.modalTypeBadgeText, { color: selectedTransferTypeInfo.color }]}>{selectedTransferTypeInfo.label}</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status</Text>
                <Text style={styles.infoValue}>
                  {(normalizeTransferStatus(selectedTransfer?.status) || 'pending').replace(/_/g, ' ')}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Rescue Report ID</Text>
                <Text style={styles.infoValue}>{selectedTransfer?.rescue_report_id || 'N/A'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Pet</Text>
                <Text style={styles.infoValue}>{selectedTransfer?.pet_name || selectedTransfer?.pet_id || 'N/A'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{selectedTransferContext.requesterLabel}</Text>
                <Text style={styles.infoValue}>{selectedTransferContext.requesterValue}</Text>
              </View>
              {selectedTransferContext.sourceLabel ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{selectedTransferContext.sourceLabel}</Text>
                  <Text style={styles.infoValue}>{selectedTransferContext.sourceValue}</Text>
                </View>
              ) : null}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{selectedTransferContext.destinationLabel}</Text>
                <Text style={styles.infoValue}>{selectedTransferContext.destinationValue}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Urgency</Text>
                <Text style={styles.infoValue}>{String(selectedTransfer?.urgency || 'normal')}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Submitted</Text>
                <Text style={styles.infoValue}>{formatDate(selectedTransfer?.created_at)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Reviewed</Text>
                <Text style={styles.infoValue}>{formatReviewedDate(selectedTransfer)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Updated</Text>
                <Text style={styles.infoValue}>{formatDate(selectedTransfer?.updated_at)}</Text>
              </View>

              <View style={styles.infoNotesBox}>
                <Text style={styles.infoLabel}>Reported Picture</Text>
                {loadingInfoImages ? (
                  <View style={styles.imagesLoadingWrap}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.imagesLoadingText}>Loading photos...</Text>
                  </View>
                ) : reportedImages.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imagesRow}>
                    {reportedImages.map((imageUri, index) => (
                      <Image key={`${imageUri}_${index}`} source={{ uri: imageUri }} style={styles.infoImage} />
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.infoValue}>No reported picture found.</Text>
                )}
              </View>

              <View style={styles.infoNotesBox}>
                <Text style={styles.infoLabel}>Rescued Picture</Text>
                {loadingInfoImages ? (
                  <View style={styles.imagesLoadingWrap}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.imagesLoadingText}>Loading photos...</Text>
                  </View>
                ) : rescuedImages.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imagesRow}>
                    {rescuedImages.map((imageUri, index) => (
                      <Image key={`${imageUri}_${index}`} source={{ uri: imageUri }} style={styles.infoImage} />
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.infoValue}>No rescued picture found yet.</Text>
                )}
              </View>

              <View style={styles.infoNotesBox}>
                <Text style={styles.infoLabel}>Notes</Text>
                <Text style={styles.infoValue}>{selectedTransfer?.notes || 'None'}</Text>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.modalDoneButton} onPress={closeInfoModal}>
              <Text style={styles.modalDoneButtonText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={createModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeCreateTransferModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeCreateTransferModal}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Shelter Transfer</Text>
              <TouchableOpacity onPress={closeCreateTransferModal} style={styles.modalCloseButton}>
                <Ionicons name="close" size={20} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
              <View style={styles.infoNotesBox}>
                <Text style={styles.infoLabel}>Pet to Transfer</Text>
                {availablePets.length === 0 ? (
                  <Text style={styles.infoValue}>No eligible pets available for transfer.</Text>
                ) : (
                  <View style={styles.selectionWrap}>
                    {availablePets.map((item) => {
                      const active = String(selectedPetId) === String(item.id);
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.selectionChip, active ? styles.selectionChipActive : null]}
                          onPress={() => setSelectedPetId(String(item.id))}
                        >
                          <Text style={[styles.selectionChipText, active ? styles.selectionChipTextActive : null]}>
                            {String(item?.name || item.id)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              <View style={styles.infoNotesBox}>
                <Text style={styles.infoLabel}>Destination Shelter</Text>
                {availableShelters.length === 0 ? (
                  <Text style={styles.infoValue}>No destination shelters are available.</Text>
                ) : (
                  <View style={styles.selectionWrap}>
                    {availableShelters.map((item) => {
                      const active = String(selectedTargetShelterId) === String(item.id);
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.selectionChip, active ? styles.selectionChipActive : null]}
                          onPress={() => setSelectedTargetShelterId(String(item.id))}
                        >
                          <Text style={[styles.selectionChipText, active ? styles.selectionChipTextActive : null]}>
                            {String(item?.name || item.id)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              <View style={styles.infoNotesBox}>
                <Text style={styles.infoLabel}>Urgency</Text>
                <View style={styles.selectionWrap}>
                  {['low', 'normal', 'high', 'critical'].map((level) => {
                    const active = createUrgency === level;
                    return (
                      <TouchableOpacity
                        key={level}
                        style={[styles.selectionChip, active ? styles.selectionChipActive : null]}
                        onPress={() => setCreateUrgency(level)}
                      >
                        <Text style={[styles.selectionChipText, active ? styles.selectionChipTextActive : null]}>{level}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.infoNotesBox}>
                <Text style={styles.infoLabel}>Notes</Text>
                <TextInput
                  style={styles.notesInput}
                  multiline
                  numberOfLines={4}
                  value={createNotes}
                  onChangeText={setCreateNotes}
                  placeholder="Add transfer details for the destination shelter"
                  placeholderTextColor={COLORS.textLight}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.modalSecondaryButton, creatingTransfer ? styles.modalSecondaryButtonDisabled : null]}
                onPress={closeCreateTransferModal}
                disabled={creatingTransfer}
              >
                <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalDoneButton, creatingTransfer ? styles.modalDoneButtonDisabled : null]}
                onPress={handleCreateTransfer}
                disabled={creatingTransfer}
              >
                {creatingTransfer ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalDoneButtonText}>Create Transfer</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Transfer Requests</Text>
          <Text style={styles.headerSubtitle}>{pendingCount} pending request{pendingCount === 1 ? '' : 's'}</Text>
        </View>
        <TouchableOpacity style={styles.createTransferButton} onPress={openCreateTransferModal}>
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text style={styles.createTransferButtonText}>New Transfer</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        style={styles.filterScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {filterOptions.map((option) => {
          const isActive = transferTypeFilter === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.filterChip, isActive ? styles.filterChipActive : null]}
              onPress={() => setTransferTypeFilter(option.key)}
            >
              <Text style={[styles.filterChipText, isActive ? styles.filterChipTextActive : null]}>
                {option.label}
              </Text>
              <View style={[styles.filterCountBadge, isActive ? styles.filterCountBadgeActive : null]}>
                <Text style={[styles.filterCountText, isActive ? styles.filterCountTextActive : null]}>{option.count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading transfer requests...</Text>
          </View>
        ) : filteredTransfers.length === 0 ? (
          <View style={styles.centerBox}>
            <Ionicons name="swap-horizontal-outline" size={56} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>No Matching Transfers</Text>
            <Text style={styles.emptyText}>
              {transferTypeFilter === 'all'
                ? 'Incoming rescued-animal transfer requests will appear here.'
                : transferTypeFilter === 'rescuer'
                  ? 'No rescuer request transfers found.'
                  : 'No shelter to shelter transfers found.'}
            </Text>
          </View>
        ) : (
          <View style={styles.listWrap}>{filteredTransfers.map(renderTransferCard)}</View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 44,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  backButton: {
    marginRight: SPACING.sm,
    padding: SPACING.xs,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
  },
  createTransferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
  },
  createTransferButtonText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  filterScroll: {
    maxHeight: 56,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  filterChip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
  },
  filterChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}14`,
  },
  filterChipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    fontWeight: FONTS.weights.bold,
  },
  filterChipTextActive: {
    color: COLORS.primary,
  },
  filterCountBadge: {
    minWidth: 24,
    paddingHorizontal: 6,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountBadgeActive: {
    backgroundColor: COLORS.primary,
  },
  filterCountText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
    fontWeight: FONTS.weights.bold,
  },
  filterCountTextActive: {
    color: '#FFFFFF',
  },
  centerBox: {
    marginTop: 72,
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  loadingText: {
    marginTop: SPACING.sm,
    color: COLORS.textMedium,
  },
  emptyTitle: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  emptyText: {
    marginTop: SPACING.xs,
    textAlign: 'center',
    color: COLORS.textMedium,
  },
  listWrap: {
    paddingTop: SPACING.xs,
  },
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  typeBadge: {
    marginBottom: SPACING.xs,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  typeBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
  cardTitle: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.round,
  },
  statusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    textTransform: 'capitalize',
  },
  metaText: {
    marginTop: 2,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
  },
  previewHintText: {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textLight,
    fontStyle: 'italic',
  },
  notesBox: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
  },
  notesLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textMedium,
    marginBottom: 2,
  },
  notesText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textDark,
  },
  infoButton: {
    marginTop: SPACING.md,
    minHeight: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: `${COLORS.primary}33`,
    backgroundColor: `${COLORS.primary}12`,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  infoButtonText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  trackButton: {
    marginTop: SPACING.xs,
    minHeight: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    backgroundColor: '#E0F2FE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  trackButtonText: {
    color: '#075985',
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  actionButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: RADIUS.md,
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
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  rejectButtonText: {
    color: '#B91C1C',
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  modalCard: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  modalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    maxHeight: 420,
  },
  modalBodyContent: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  infoRow: {
    gap: 2,
    paddingBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  infoLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  infoValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textDark,
  },
  modalTypeBadge: {
    marginTop: 2,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  modalTypeBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
  infoNotesBox: {
    marginTop: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    gap: 4,
  },
  imagesLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  imagesLoadingText: {
    color: COLORS.textMedium,
    fontSize: FONTS.sizes.sm,
  },
  imagesRow: {
    paddingVertical: SPACING.xs,
    gap: SPACING.xs,
  },
  infoImage: {
    width: 110,
    height: 82,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.borderLight,
    marginRight: SPACING.xs,
  },
  modalDoneButton: {
    margin: SPACING.md,
    flex: 1,
    minHeight: 42,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDoneButtonDisabled: {
    opacity: 0.7,
  },
  modalDoneButtonText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  modalSecondaryButtonDisabled: {
    opacity: 0.7,
  },
  modalSecondaryButtonText: {
    color: COLORS.textMedium,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  selectionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: 2,
  },
  selectionChip: {
    borderRadius: RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.backgroundWhite,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  selectionChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}14`,
  },
  selectionChipText: {
    color: COLORS.textMedium,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.medium,
    textTransform: 'capitalize',
  },
  selectionChipTextActive: {
    color: COLORS.primary,
    fontWeight: FONTS.weights.bold,
  },
  notesInput: {
    marginTop: 4,
    minHeight: 96,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.backgroundWhite,
    color: COLORS.textDark,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    fontSize: FONTS.sizes.sm,
  },
});

export default ShelterTransferRequestsScreen;
