import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { auth, db } from '../../firebaseConfig';

const formatDate = (value) => {
  if (!value) return 'N/A';
  const parsed = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleString();
};

const formatMoney = (value) => `PHP ${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const normalizeAdoptionStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'pending';
  if (normalized === 'pending_review') return 'pending';
  if (normalized === 'in transit') return 'in_transit';
  if (normalized === 'delivered pending confirmation') return 'delivered_pending_confirmation';
  if (normalized === 'delivered') return 'delivered_pending_confirmation';
  return normalized;
};

const chunkArray = (input = [], size = 10) => {
  const chunks = [];
  for (let index = 0; index < input.length; index += size) {
    chunks.push(input.slice(index, index + size));
  }
  return chunks;
};

const badgeStyle = (status) => {
  if (status === 'approved') return { bg: '#DCFCE7', text: '#166534' };
  if (status === 'in_transit') return { bg: '#DBEAFE', text: '#1D4ED8' };
  if (status === 'delivered_pending_confirmation') return { bg: '#E0E7FF', text: '#4338CA' };
  if (status === 'rejected') return { bg: '#FEE2E2', text: '#B91C1C' };
  if (status === 'completed') return { bg: '#DBEAFE', text: '#1D4ED8' };
  if (status === 'return_requested') return { bg: '#FEF3C7', text: '#92400E' };
  if (status === 'return_approved') return { bg: '#DBEAFE', text: '#1D4ED8' };
  if (status === 'return_in_transit') return { bg: '#E0E7FF', text: '#4338CA' };
  if (status === 'return_completed') return { bg: '#DCFCE7', text: '#166534' };
  if (status === 'return_rejected') return { bg: '#FEE2E2', text: '#B91C1C' };
  return { bg: '#FEF3C7', text: '#92400E' };
};

const statusLabel = (status) => {
  if (status === 'in_transit') return 'In Transit';
  if (status === 'delivered_pending_confirmation') return 'Awaiting Adopter Confirmation';
  if (status === 'completed') return 'Completed';
  if (status === 'return_requested') return 'Return Requested';
  if (status === 'return_approved') return 'Return Approved';
  if (status === 'return_in_transit') return 'Return In Transit';
  if (status === 'return_completed') return 'Return Completed';
  if (status === 'return_rejected') return 'Return Rejected';
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  return 'Pending';
};

const ShelterAdoptionRequestsScreen = ({ onBack, onOpenChat }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState([]);
  const [activeFilter, setActiveFilter] = useState('paid_pending');
  const [updatingId, setUpdatingId] = useState(null);
  const [managedShelter, setManagedShelter] = useState(null);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);

      const currentUser = auth.currentUser;
      if (!currentUser?.uid) {
        setRows([]);
        return;
      }

      const shelterSnap = await getDocs(query(collection(db, 'shelters'), where('manager_id', '==', currentUser.uid)));
      if (shelterSnap.empty) {
        setRows([]);
        return;
      }

      const shelterDoc = shelterSnap.docs[0];
      const shelterId = shelterDoc.id;
      const shelterData = shelterDoc.data() || {};
      setManagedShelter({ id: shelterId, ...shelterData });

      const petsSnap = await getDocs(query(collection(db, 'pets'), where('shelter_id', '==', shelterId)));
      const petMap = new Map();
      const petIds = new Set();
      petsSnap.forEach((petDoc) => {
        const data = petDoc.data() || {};
        petMap.set(petDoc.id, { id: petDoc.id, ...data });
        petIds.add(petDoc.id);
      });

      const petIdList = [...petIds];
      const petIdChunks = chunkArray(petIdList, 10);
      const adoptionChunkSnaps = await Promise.all(
        petIdChunks.map((chunk) => getDocs(query(collection(db, 'adoptions'), where('pet_id', 'in', chunk))))
      );

      const adoptions = adoptionChunkSnaps
        .flatMap((snap) => snap.docs.map((item) => ({ id: item.id, ...item.data() })))
        .filter((item) => petIds.has(String(item.pet_id || '')));

      const userIds = [...new Set(adoptions.map((item) => String(item.user_id || '')).filter(Boolean))];
      const userMap = new Map();
      await Promise.all(userIds.map(async (userId) => {
        try {
          const userSnap = await getDoc(doc(db, 'users', userId));
          if (userSnap.exists()) {
            const data = userSnap.data() || {};
            userMap.set(userId, data);
          }
        } catch {
          userMap.set(userId, null);
        }
      }));

      const mapped = adoptions
        .map((item) => {
          const pet = petMap.get(String(item.pet_id || '')) || {};
          const adopter = userMap.get(String(item.user_id || '')) || {};
          const status = normalizeAdoptionStatus(item.status);
          const paymentStatus = String(item.payment_status || '').toLowerCase() === 'paid' ? 'paid' : 'unpaid';
          const adopterAddress = [adopter.address, adopter.city].filter(Boolean).join(', ');

          return {
            ...item,
            pet_name: item.pet_name || pet.name || 'Unknown Pet',
            adopter_name: adopter.full_name || adopter.name || item.user_email || 'Unknown Adopter',
            adopter_email: item.user_email || adopter.email || 'N/A',
            delivery_address: item.delivery_address || adopterAddress || 'Not provided',
            status,
            payment_status: paymentStatus,
            payment_amount: Number(item.payment_amount || pet.adoption_fee || 0),
          };
        })
        .sort((a, b) => {
          const aMs = a.created_at?.toDate ? a.created_at.toDate().getTime() : 0;
          const bMs = b.created_at?.toDate ? b.created_at.toDate().getTime() : 0;
          return bMs - aMs;
        });

      setRows(mapped);
    } catch (error) {
      console.error('Error loading shelter adoption requests:', error);
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadRequests();
  }, [loadRequests]);

  const filteredRows = useMemo(() => {
    if (activeFilter === 'all') return rows;
    if (activeFilter === 'paid_pending') return rows.filter((item) => item.payment_status === 'paid' && item.status === 'pending');
    if (activeFilter === 'unpaid') return rows.filter((item) => item.payment_status !== 'paid');
    if (activeFilter === 'active_delivery') return rows.filter((item) => item.status === 'approved' || item.status === 'in_transit' || item.status === 'delivered_pending_confirmation' || item.status === 'return_requested' || item.status === 'return_approved' || item.status === 'return_in_transit');
    return rows.filter((item) => item.status === activeFilter);
  }, [activeFilter, rows]);

  const runAction = useCallback(async (item, action) => {
    if (!item?.id) return;

    const petId = String(item.pet_id || '');
    const adoptionId = String(item.id);

    try {
      setUpdatingId(adoptionId);

      if (action === 'approve') {
        if (item.payment_status !== 'paid') {
          Alert.alert('Payment Required', 'Only paid requests can be approved.');
          return;
        }

        await updateDoc(doc(db, 'adoptions', adoptionId), {
          status: 'Approved',
          delivery_status: 'approved',
          approved_at: serverTimestamp(),
          shelter_decision: 'approved',
          shelter_reviewed_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });

        if (petId) {
          await updateDoc(doc(db, 'pets', petId), {
            status: 'reserved',
            updated_at: serverTimestamp(),
          });
        }
      }

      if (action === 'reject') {
        await updateDoc(doc(db, 'adoptions', adoptionId), {
          status: 'Rejected',
          shelter_decision: 'rejected',
          shelter_reviewed_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });

        if (petId) {
          await updateDoc(doc(db, 'pets', petId), {
            status: 'available',
            adoption_listing_status: 'listed',
            updated_at: serverTimestamp(),
          });
        }
      }

      if (action === 'dispatch') {
        await updateDoc(doc(db, 'adoptions', adoptionId), {
          status: 'In_Transit',
          delivery_status: 'in_transit',
          in_transit_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      }

      if (action === 'handover') {
        await updateDoc(doc(db, 'adoptions', adoptionId), {
          status: 'Delivered',
          delivery_status: 'delivered_pending_confirmation',
          delivered_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      }

      if (action === 'complete') {
        await updateDoc(doc(db, 'adoptions', adoptionId), {
          status: 'Completed',
          delivery_status: 'completed',
          completed_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });

        if (petId) {
          await updateDoc(doc(db, 'pets', petId), {
            status: 'unavailable',
            adoption_listing_status: 'cancelled',
            adopted_at: serverTimestamp(),
            adopted_by_user_id: item.user_id || null,
            updated_at: serverTimestamp(),
          });
        }
      }

      if (action === 'approve_return') {
        await updateDoc(doc(db, 'adoptions', adoptionId), {
          status: 'Return_Approved',
          return_status: 'approved',
          return_reviewed_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      }

      if (action === 'reject_return') {
        await updateDoc(doc(db, 'adoptions', adoptionId), {
          status: 'Return_Rejected',
          return_status: 'rejected',
          return_reviewed_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      }

      if (action === 'return_in_transit') {
        await updateDoc(doc(db, 'adoptions', adoptionId), {
          status: 'Return_In_Transit',
          return_status: 'in_transit',
          return_in_transit_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      }

      if (action === 'return_complete') {
        await updateDoc(doc(db, 'adoptions', adoptionId), {
          status: 'Return_Completed',
          return_status: 'completed',
          return_completed_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });

        if (petId) {
          await updateDoc(doc(db, 'pets', petId), {
            status: 'available',
            adoption_listing_status: 'listed',
            adopted_by_user_id: null,
            adopted_at: null,
            updated_at: serverTimestamp(),
          });
        }
      }

      loadRequests();
    } catch (error) {
      Alert.alert('Update Failed', error?.message || 'Failed to update request.');
    } finally {
      setUpdatingId(null);
    }
  }, [loadRequests]);

  const confirmAction = useCallback((item, action) => {
    const labels = {
      approve: 'Approve Request',
      reject: 'Reject Request',
      dispatch: 'Mark In Transit',
      handover: 'Mark Handed Over',
      complete: 'Complete Adoption',
      approve_return: 'Approve Return Request',
      reject_return: 'Reject Return Request',
      return_in_transit: 'Mark Return In Transit',
      return_complete: 'Mark Return Completed',
    };

    Alert.alert(
      labels[action],
      `Proceed with ${labels[action].toLowerCase()} for ${item?.pet_name || 'this pet'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Proceed', onPress: () => runAction(item, action) },
      ]
    );
  }, [runAction]);

  const summary = useMemo(() => ({
    total: rows.length,
    paidPending: rows.filter((item) => item.payment_status === 'paid' && item.status === 'pending').length,
    approved: rows.filter((item) => item.status === 'approved' || item.status === 'in_transit' || item.status === 'delivered_pending_confirmation').length,
    completed: rows.filter((item) => item.status === 'completed').length,
  }), [rows]);

  const openChatFromRequest = useCallback(async (item) => {
    const currentUser = auth.currentUser;
    if (!currentUser?.uid || !item?.id) return;

    try {
      const chatId = `adoption_${item.id}`;
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);

      if (!chatSnap.exists()) {
        await setDoc(chatRef, {
          adoption_id: String(item.id),
          pet_id: String(item.pet_id || ''),
          pet_name: item.pet_name || 'Unknown Pet',
          shelter_id: managedShelter?.id || '',
          shelter_manager_id: currentUser.uid,
          shelter_name: managedShelter?.name || 'Shelter',
          adopter_id: String(item.user_id || ''),
          adopter_name: item.adopter_name || 'Adopter',
          adopter_email: item.adopter_email || null,
          participants: [currentUser.uid, String(item.user_id || '')].filter(Boolean),
          status: 'open',
          last_message: '',
          last_sender_id: null,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      }

      onOpenChat?.({ chatId, returnTab: 'shelterAdoptionRequests', role: 'shelter' });
    } catch (error) {
      Alert.alert('Chat Error', error?.message || 'Unable to open chat right now.');
    }
  }, [managedShelter?.id, managedShelter?.name, onOpenChat]);

  const openDeliveryAddressInMaps = useCallback(async (item) => {
    const address = String(item?.delivery_address || '').trim();
    if (!address || address.toLowerCase() === 'not provided') {
      Alert.alert('Address Missing', 'No transport address is available for this adoption request.');
      return;
    }

    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
    try {
      await Linking.openURL(mapsUrl);
    } catch {
      Alert.alert('Unable to Open Maps', 'Could not open Google Maps on this device.');
    }
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8EF" />

      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Adoption Requests</Text>
          <Text style={styles.headerSubtitle}>Review paid applicants and process adoptions</Text>
        </View>
      </View>

<View style={styles.summaryContainer}>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryCount}>{summary.total}</Text>
            <Text style={styles.summaryBoxLabel}>Total</Text>
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.summaryBox}>
            <Text style={styles.summaryCount}>{summary.paidPending}</Text>
            <Text style={styles.summaryBoxLabel}>Pending</Text>
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.summaryBox}>
            <Text style={[styles.summaryCount, {color: '#166534'}]}>{summary.approved}</Text>
            <Text style={styles.summaryBoxLabel}>Approved</Text>
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.summaryBox}>
            <Text style={[styles.summaryCount, {color: '#1D4ED8'}]}>{summary.completed}</Text>
            <Text style={styles.summaryBoxLabel}>Completed</Text>
          </View>
        </View>
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterScrollContent}
      >
        {[
          { id: 'paid_pending', label: 'Paid Pending' },
          { id: 'active_delivery', label: 'Active Delivery' },
          { id: 'completed', label: 'Completed' },
          { id: 'unpaid', label: 'Unpaid' },
          { id: 'all', label: 'All' },
        ].map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.filterChip, activeFilter === item.id && styles.filterChipActive]}
            onPress={() => setActiveFilter(item.id)}
          >
            <Text style={[styles.filterChipText, activeFilter === item.id && styles.filterChipTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.helperText}>Loading adoption requests...</Text>
          </View>
        ) : filteredRows.length === 0 ? (
          <View style={styles.centerBox}>
            <Ionicons name="document-text-outline" size={52} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>No Requests</Text>
            <Text style={styles.helperText}>No requests in this filter.</Text>
          </View>
        ) : (
          filteredRows.map((item) => {
            const badge = badgeStyle(item.status);
            const isUpdating = updatingId === item.id;

            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.petName}>{item.pet_name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.text }]}>{item.status}</Text>
                  </View>
                </View>

                <Text style={styles.metaText}>Adopter: {item.adopter_name}</Text>
                <Text style={styles.metaText}>Email: {item.adopter_email}</Text>
                <Text style={styles.metaText}>Transport Address: {item.delivery_address || 'Not provided'}</Text>
                <Text style={styles.metaText}>Applied: {formatDate(item.created_at)}</Text>
                <Text style={styles.metaText}>Payment: {String(item.payment_status || '').toUpperCase()}</Text>
                <Text style={styles.metaText}>Delivery: {statusLabel(item.status)}</Text>
                <Text style={styles.metaText}>Amount: {formatMoney(item.payment_amount)}</Text>

                {item.payment_reference ? (
                  <Text style={styles.metaText}>Payment Ref: {item.payment_reference}</Text>
                ) : null}

                {item.in_transit_at ? <Text style={styles.metaText}>In Transit: {formatDate(item.in_transit_at)}</Text> : null}
                {item.delivered_at ? <Text style={styles.metaText}>Handed Over: {formatDate(item.delivered_at)}</Text> : null}
                {item.completed_at ? <Text style={styles.metaText}>Completed: {formatDate(item.completed_at)}</Text> : null}

                {item.payment_status === 'paid' && ['pending', 'approved', 'in_transit', 'delivered_pending_confirmation'].includes(item.status) ? (
                  <TouchableOpacity style={styles.chatButton} onPress={() => openChatFromRequest(item)}>
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#7B4518" />
                    <Text style={styles.chatButtonText}>Open Chat</Text>
                  </TouchableOpacity>
                ) : null}

                {item.delivery_address && String(item.delivery_address).toLowerCase() !== 'not provided' ? (
                  <TouchableOpacity style={styles.mapsButton} onPress={() => openDeliveryAddressInMaps(item)}>
                    <Ionicons name="navigate-outline" size={16} color="#1D4ED8" />
                    <Text style={styles.mapsButtonText}>Open in Maps</Text>
                  </TouchableOpacity>
                ) : null}

                {item.status === 'pending' ? (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton, isUpdating && styles.actionButtonDisabled]}
                      onPress={() => confirmAction(item, 'reject')}
                      disabled={isUpdating}
                    >
                      <Text style={styles.rejectText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.approveButton, isUpdating && styles.actionButtonDisabled]}
                      onPress={() => confirmAction(item, 'approve')}
                      disabled={isUpdating}
                    >
                      {isUpdating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.approveText}>Approve</Text>}
                    </TouchableOpacity>
                  </View>
                ) : null}

                {item.status === 'approved' ? (
                  <TouchableOpacity
                    style={[styles.completeButton, isUpdating && styles.actionButtonDisabled]}
                    onPress={() => confirmAction(item, 'dispatch')}
                    disabled={isUpdating}
                  >
                    {isUpdating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.completeButtonText}>Mark as In Transit</Text>}
                  </TouchableOpacity>
                ) : null}

                {item.status === 'in_transit' ? (
                  <TouchableOpacity
                    style={[styles.handoverButton, isUpdating && styles.actionButtonDisabled]}
                    onPress={() => confirmAction(item, 'handover')}
                    disabled={isUpdating}
                  >
                    {isUpdating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.completeButtonText}>Mark as Handed Over</Text>}
                  </TouchableOpacity>
                ) : null}

                {item.status === 'delivered_pending_confirmation' ? (
                  <View style={styles.awaitingBanner}>
                    <Ionicons name="time-outline" size={16} color="#4338CA" />
                    <Text style={styles.awaitingBannerText}>Waiting for adopter confirmation to complete.</Text>
                  </View>
                ) : null}

                {item.status === 'return_requested' ? (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton, isUpdating && styles.actionButtonDisabled]}
                      onPress={() => confirmAction(item, 'reject_return')}
                      disabled={isUpdating}
                    >
                      <Text style={styles.rejectText}>Reject Return</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.approveButton, isUpdating && styles.actionButtonDisabled]}
                      onPress={() => confirmAction(item, 'approve_return')}
                      disabled={isUpdating}
                    >
                      {isUpdating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.approveText}>Approve Return</Text>}
                    </TouchableOpacity>
                  </View>
                ) : null}

                {item.status === 'return_approved' ? (
                  <TouchableOpacity
                    style={[styles.completeButton, isUpdating && styles.actionButtonDisabled]}
                    onPress={() => confirmAction(item, 'return_in_transit')}
                    disabled={isUpdating}
                  >
                    {isUpdating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.completeButtonText}>Mark Return In Transit</Text>}
                  </TouchableOpacity>
                ) : null}

                {item.status === 'return_in_transit' ? (
                  <TouchableOpacity
                    style={[styles.handoverButton, isUpdating && styles.actionButtonDisabled]}
                    onPress={() => confirmAction(item, 'return_complete')}
                    disabled={isUpdating}
                  >
                    {isUpdating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.completeButtonText}>Mark Return Completed</Text>}
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8EF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 50,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F2E7D8',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: SPACING.sm,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF2E5',
    borderWidth: 1,
    borderColor: '#F4DDC5',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#1E1A15',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#7D6851',
  },
  summaryContainer: {
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  summaryGrid: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0E6DA',
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    alignItems: 'center',
  },
  summaryBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#334155',
  },
  summaryBoxLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  verticalDivider: {
    width: 1,
    height: '70%',
    backgroundColor: '#F1F5F9',
  },
  filterScroll: {
    flexGrow: 0,
    marginBottom: SPACING.md,
  },
  filterScrollContent: {
    paddingHorizontal: SPACING.md,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    borderRadius: RADIUS.round,
    borderWidth: 1,
    borderColor: '#E5D5C3',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFDF8',
  },
  filterChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFECDC',
  },
  filterChipText: {
    fontSize: 12,
    color: '#7D6851',
  },
  filterChipTextActive: {
    color: '#9B5F23',
    fontWeight: '700',
  },
  list: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.xs,
  },
  listContent: {
    paddingBottom: 120,
  },
  centerBox: {
    marginTop: 72,
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: SPACING.sm,
    fontSize: 18,
    color: '#1E1A15',
    fontWeight: '700',
  },
  helperText: {
    marginTop: 4,
    color: '#7D6851',
    fontSize: 13,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEDFCF',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  petName: {
    flex: 1,
    fontSize: 17,
    color: '#2A1F14',
    fontWeight: '700',
  },
  statusBadge: {
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    marginLeft: SPACING.sm,
  },
  statusBadgeText: {
    fontSize: 11,
    textTransform: 'capitalize',
    fontWeight: '700',
  },
  metaText: {
    marginTop: 2,
    fontSize: 13,
    color: '#7D6851',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  rejectButton: {
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF1F1',
  },
  approveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  rejectText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
  },
  completeButton: {
    marginTop: SPACING.sm,
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  handoverButton: {
    marginTop: SPACING.sm,
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: '#4338CA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },
  awaitingBanner: {
    marginTop: SPACING.sm,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  awaitingBannerText: {
    color: '#4338CA',
    fontSize: 12,
    fontWeight: '700',
  },
  chatButton: {
    marginTop: SPACING.sm,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E9D8C5',
    backgroundColor: '#FFF4E8',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  chatButtonText: {
    color: '#7B4518',
    fontSize: 13,
    fontWeight: '700',
  },
  mapsButton: {
    marginTop: SPACING.xs,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  mapsButtonText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default ShelterAdoptionRequestsScreen;
