import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebaseConfig';

const formatMoney = (amount) => `PHP ${Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value) => {
  if (!value) return 'N/A';
  const parsed = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleString();
};

const statusColor = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'approved') return { bg: '#DCFCE7', text: '#166534' };
  if (normalized === 'in_transit') return { bg: '#DBEAFE', text: '#1D4ED8' };
  if (normalized === 'delivered_pending_confirmation' || normalized === 'delivered') return { bg: '#E0E7FF', text: '#4338CA' };
  if (normalized === 'rejected') return { bg: '#FEE2E2', text: '#B91C1C' };
  if (normalized === 'completed') return { bg: '#DCFCE7', text: '#166534' };
  if (normalized === 'return_requested') return { bg: '#FEF3C7', text: '#92400E' };
  if (normalized === 'return_approved') return { bg: '#DBEAFE', text: '#1D4ED8' };
  if (normalized === 'return_in_transit') return { bg: '#E0E7FF', text: '#4338CA' };
  if (normalized === 'return_completed') return { bg: '#DCFCE7', text: '#166534' };
  if (normalized === 'return_rejected') return { bg: '#FEE2E2', text: '#B91C1C' };
  return { bg: '#FEF3C7', text: '#92400E' };
};

const normalizeAdoptionStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'pending';
  if (normalized === 'in transit') return 'in_transit';
  if (normalized === 'delivered' || normalized === 'delivered pending confirmation') return 'delivered_pending_confirmation';
  return normalized;
};

const deliveryStageLabel = (status) => {
  if (status === 'approved') return 'Preparing handover';
  if (status === 'in_transit') return 'In transit';
  if (status === 'delivered_pending_confirmation') return 'Waiting for your confirmation';
  if (status === 'completed') return 'Adoption completed';
  if (status === 'return_requested') return 'Return request sent';
  if (status === 'return_approved') return 'Return approved by shelter';
  if (status === 'return_in_transit') return 'Pet return in transit';
  if (status === 'return_completed') return 'Pet return completed';
  if (status === 'return_rejected') return 'Return request rejected';
  if (status === 'rejected') return 'Request rejected';
  return 'Under review';
};

const UserAdoptionsScreen = ({ onOpenChat }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [records, setRecords] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [simulatingPaymentId, setSimulatingPaymentId] = useState(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [checkoutStep, setCheckoutStep] = useState('details');
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    gcashNumber: '',
    accountName: '',
    receiptEmail: '',
  });

  const splitIntoChunks = useCallback((items, chunkSize = 10) => {
    const chunks = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
  }, []);

  const loadAdoptions = useCallback(async () => {
    if (!user?.uid) {
      setRecords([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      const adoptionsSnap = await getDocs(query(
        collection(db, 'adoptions'),
        where('user_id', '==', user.uid),
        orderBy('created_at', 'desc')
      ));
      const adopterAdoptions = adoptionsSnap.docs.map((item) => ({ id: item.id, ...item.data(), role_context: 'as_user' }));

      const rescueReportsQueryTargets = [
        query(collection(db, 'rescue_reports'), where('rescuer_id', '==', user.uid)),
        query(collection(db, 'rescue_reports'), where('rescuer_uid', '==', user.uid)),
      ];

      const rescueReportSnapshots = await Promise.all(rescueReportsQueryTargets.map((target) => getDocs(target)));
      const rescueReportIds = Array.from(new Set(
        rescueReportSnapshots
          .flatMap((snap) => snap.docs.map((item) => String(item.id || '').trim()))
          .filter(Boolean)
      ));

      const rescuerPets = [];
      if (rescueReportIds.length > 0) {
        const rescueReportIdChunks = splitIntoChunks(rescueReportIds);
        await Promise.all(rescueReportIdChunks.map(async (chunk) => {
          const petsSnap = await getDocs(query(collection(db, 'pets'), where('rescue_report_id', 'in', chunk)));
          petsSnap.docs.forEach((item) => {
            rescuerPets.push({ id: item.id, ...item.data() });
          });
        }));
      }

      const rescuerPetIds = Array.from(new Set(rescuerPets.map((item) => String(item.id || '').trim()).filter(Boolean)));
      const rescuerAdoptions = [];
      if (rescuerPetIds.length > 0) {
        const rescuerPetIdChunks = splitIntoChunks(rescuerPetIds);
        await Promise.all(rescuerPetIdChunks.map(async (chunk) => {
          const rescuerAdoptionSnap = await getDocs(query(collection(db, 'adoptions'), where('pet_id', 'in', chunk)));
          rescuerAdoptionSnap.docs.forEach((item) => {
            rescuerAdoptions.push({ id: item.id, ...item.data(), role_context: 'as_rescuer' });
          });
        }));
      }

      const adoptionsById = new Map();
      [...adopterAdoptions, ...rescuerAdoptions].forEach((item) => {
        const existing = adoptionsById.get(item.id);
        if (!existing) {
          adoptionsById.set(item.id, item);
          return;
        }

        const contexts = new Set([String(existing.role_context || ''), String(item.role_context || '')]);
        const mergedContext = contexts.has('as_user') && contexts.has('as_rescuer') ? 'both' : item.role_context;
        adoptionsById.set(item.id, {
          ...existing,
          ...item,
          role_context: mergedContext,
        });
      });

      const combinedAdoptions = Array.from(adoptionsById.values());
      const petIds = [...new Set(combinedAdoptions.map((item) => item.pet_id).filter(Boolean))];
      const petNameMap = new Map();
      const petFeeMap = new Map();

      await Promise.all(
        petIds.map(async (petId) => {
          try {
            const petSnap = await getDoc(doc(db, 'pets', String(petId)));
            if (petSnap.exists()) {
              const data = petSnap.data() || {};
              petNameMap.set(String(petId), data.name || 'Unnamed Pet');
              petFeeMap.set(String(petId), Number(data.adoption_fee || 0));
            }
          } catch (error) {
            petNameMap.set(String(petId), 'Unknown Pet');
          }
        })
      );

      const rows = combinedAdoptions
        .map((item) => {
          const petId = String(item.pet_id || '');
          const savedPaymentStatus = String(item.payment_status || '').toLowerCase();
          const savedPaymentMethod = String(item.payment_method || '').toLowerCase();
          const savedPaymentSource = String(item.payment_source || '').toLowerCase();
          const savedReference = String(item.payment_reference || '').toUpperCase();
          const isSimulatedPaid = savedPaymentStatus === 'paid'
            && savedPaymentSource === 'paymongo_simulation'
            && savedPaymentMethod === 'gcash'
            && savedReference.startsWith('SIM-');
          const paymentStatus = isSimulatedPaid ? 'paid' : 'unpaid';
          const amount = Number(item.payment_amount ?? petFeeMap.get(petId) ?? 0);

          return {
            ...item,
            pet_name: item.pet_name || petNameMap.get(petId) || 'Unknown Pet',
            status: normalizeAdoptionStatus(item.status),
            payment_status: paymentStatus,
            payment_method: isSimulatedPaid ? savedPaymentMethod : '',
            payment_reference: isSimulatedPaid ? item.payment_reference : '',
            payment_amount: amount,
          };
        })
        .sort((a, b) => (b.created_at?.toMillis?.() || 0) - (a.created_at?.toMillis?.() || 0));

      setRecords(rows);
    } catch (error) {
      console.error('Error loading user adoptions:', error);
      setRecords([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [splitIntoChunks, user?.uid]);

  useEffect(() => {
    loadAdoptions();
  }, [loadAdoptions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAdoptions();
  }, [loadAdoptions]);

  const filteredRecords = useMemo(() => {
    const roleFiltered = records.filter((item) => {
      if (roleFilter === 'as_user') return item.role_context === 'as_user' || item.role_context === 'both';
      if (roleFilter === 'as_rescuer') return item.role_context === 'as_rescuer' || item.role_context === 'both';
      return true;
    });

    if (activeFilter === 'paid') return roleFiltered.filter((item) => item.payment_status === 'paid');
    if (activeFilter === 'unpaid') return roleFiltered.filter((item) => item.payment_status !== 'paid');
    return roleFiltered;
  }, [activeFilter, records, roleFilter]);

  const openSimulatePaymentModal = useCallback((record) => {
    if (!record?.id) return;
    setPaymentTarget(record);
    setCheckoutStep('details');
    setOtpCode('');
    setGeneratedOtp('');
    setSendingOtp(false);
    setPaymentForm({
      gcashNumber: '',
      accountName: String(user?.full_name || user?.name || '').trim(),
      receiptEmail: String(user?.email || '').trim(),
    });
    setPaymentModalVisible(true);
  }, [user?.email, user?.full_name, user?.name]);

  const closePaymentModal = useCallback(() => {
    setPaymentModalVisible(false);
    setPaymentTarget(null);
    setCheckoutStep('details');
    setOtpCode('');
    setGeneratedOtp('');
    setSendingOtp(false);
    setPaymentForm({ gcashNumber: '', accountName: '', receiptEmail: '' });
  }, []);

  const validatePaymentForm = useCallback(() => {
    const cleanedNumber = String(paymentForm.gcashNumber || '').replace(/\D/g, '');
    const accountName = String(paymentForm.accountName || '').trim();
    const receiptEmail = String(paymentForm.receiptEmail || '').trim();

    if (!/^09\d{9}$/.test(cleanedNumber)) {
      Alert.alert('Invalid GCash Number', 'Enter a valid 11-digit GCash number starting with 09.');
      return null;
    }

    if (accountName.length < 2) {
      Alert.alert('Invalid Account Name', 'Enter the GCash account name.');
      return null;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiptEmail)) {
      Alert.alert('Invalid Email', 'Enter a valid email address for the receipt.');
      return null;
    }

    return { cleanedNumber, accountName, receiptEmail };
  }, [paymentForm.accountName, paymentForm.gcashNumber, paymentForm.receiptEmail]);

  const sendReceiptEmail = useCallback(async ({ petName, amount, reference, receiptEmail, gcashNumber }) => {
    const serviceId = process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID;
    const templateId = process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EXPO_PUBLIC_EMAILJS_PRIVATE_KEY;

    if (!serviceId || !templateId || !publicKey || !receiptEmail) {
      return { sent: false, reason: 'Receipt email config is incomplete.' };
    }

    const maskedGcash = gcashNumber.length >= 4
      ? `****${gcashNumber.slice(-4)}`
      : gcashNumber;

    try {
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          accessToken: privateKey,
          template_params: {
            to_email: receiptEmail,
            email: receiptEmail,
            recipient: receiptEmail,
            user_name: paymentForm.accountName || 'Pawmilya User',
            pet_name: petName,
            amount: formatMoney(amount),
            payment_reference: reference,
            payment_method: 'GCash',
            gcash_number: maskedGcash,
            app_name: 'Pawmilya',
            company_name: 'Pawmilya',
          },
        }),
      });

      if (!response.ok) {
        return { sent: false, reason: 'Email provider rejected receipt request.' };
      }

      return { sent: true };
    } catch (error) {
      return { sent: false, reason: error?.message || 'Receipt email send failed.' };
    }
  }, [paymentForm.accountName]);

  const startOtpFlow = useCallback(async () => {
    const validData = validatePaymentForm();
    if (!validData) return;

    try {
      setSendingOtp(true);
      await new Promise((resolve) => setTimeout(resolve, 900));
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      setGeneratedOtp(otp);
      setOtpCode('');
      setCheckoutStep('otp');
      Alert.alert('OTP Sent', `A verification code was sent to your GCash mobile.\n\nSimulation OTP: ${otp}`);
    } finally {
      setSendingOtp(false);
    }
  }, [validatePaymentForm]);

  const simulatePayment = useCallback(async () => {
    const record = paymentTarget;
    if (!user?.uid || !record?.id) return;

    const validData = validatePaymentForm();
    if (!validData) return;

    if (checkoutStep !== 'otp') {
      Alert.alert('OTP Required', 'Please continue to OTP verification first.');
      return;
    }

    if (!generatedOtp || String(otpCode || '').trim() !== generatedOtp) {
      Alert.alert('Invalid OTP', 'Please enter the correct 6-digit OTP code.');
      return;
    }

    const { cleanedNumber, accountName, receiptEmail } = validData;

    try {
      setCheckoutStep('processing');
      setSimulatingPaymentId(record.id);
      const reference = `SIM-${Date.now()}`;
      const amount = Number(record.payment_amount || 0);

      // Simulate checkout processing delay to feel like a real payment gateway handoff.
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const paymentRef = await addDoc(collection(db, 'payments'), {
        pet_id: record.pet_id,
        pet_name: record.pet_name || 'Unknown Pet',
        payer_user_id: user.uid,
        payer_email: user.email || null,
        amount,
        currency: 'PHP',
        method: 'gcash',
        payer_name: accountName,
        payer_gcash_number_masked: `****${cleanedNumber.slice(-4)}`,
        reference,
        provider: 'PayMongo',
        source: 'paymongo_simulation',
        status: 'paid',
        created_at: serverTimestamp(),
      });

      await updateDoc(doc(db, 'adoptions', record.id), {
        payment_id: paymentRef.id,
        payment_reference: reference,
        payment_status: 'paid',
        payment_method: 'gcash',
        payment_source: 'paymongo_simulation',
        payment_amount: amount,
        payment_receipt_email: receiptEmail,
        updated_at: serverTimestamp(),
      });

      const receiptResult = await sendReceiptEmail({
        petName: record.pet_name || 'Unknown Pet',
        amount,
        reference,
        receiptEmail,
        gcashNumber: cleanedNumber,
      });

      await loadAdoptions();
      setCheckoutStep('success');
      if (!receiptResult.sent) {
        Alert.alert('Receipt Notice', `Payment succeeded, but receipt email was not sent (${receiptResult.reason}).`);
      }
    } catch (error) {
      setCheckoutStep('otp');
      Alert.alert('Payment Failed', error?.message || 'Unable to simulate payment right now.');
    } finally {
      setSimulatingPaymentId(null);
    }
  }, [checkoutStep, generatedOtp, loadAdoptions, otpCode, paymentTarget, sendReceiptEmail, user?.email, user?.uid, validatePaymentForm]);

  const openAdoptionChat = useCallback(async (record) => {
    if (!user?.uid || !record?.id) return;

    try {
      const petSnap = await getDoc(doc(db, 'pets', String(record.pet_id || '')));
      const petData = petSnap.exists() ? (petSnap.data() || {}) : {};
      const shelterId = String(petData.shelter_id || '');

      if (!shelterId) {
        Alert.alert('Chat Unavailable', 'No shelter is assigned to this adoption yet.');
        return;
      }

      const shelterSnap = await getDoc(doc(db, 'shelters', shelterId));
      const shelterData = shelterSnap.exists() ? (shelterSnap.data() || {}) : {};
      const shelterManagerId = String(shelterData.manager_id || '');

      if (!shelterManagerId) {
        Alert.alert('Chat Unavailable', 'Shelter manager account is not set.');
        return;
      }

      const chatId = `adoption_${record.id}`;
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);

      if (!chatSnap.exists()) {
        await setDoc(chatRef, {
          adoption_id: String(record.id),
          pet_id: String(record.pet_id || ''),
          pet_name: record.pet_name || 'Unknown Pet',
          shelter_id: shelterId,
          shelter_manager_id: shelterManagerId,
          shelter_name: shelterData.name || 'Shelter',
          adopter_id: user.uid,
          adopter_name: user.full_name || user.name || user.email || 'Adopter',
          adopter_email: user.email || null,
          participants: [user.uid, shelterManagerId],
          status: 'open',
          last_message: '',
          last_sender_id: null,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      }

      onOpenChat?.({ chatId, returnTab: 'adoptions', role: 'adopter' });
    } catch (error) {
      Alert.alert('Chat Error', error?.message || 'Unable to open chat right now.');
    }
  }, [onOpenChat, user?.email, user?.full_name, user?.name, user?.uid]);

  const confirmReceipt = useCallback(async (record) => {
    if (!user?.uid || !record?.id) return;

    Alert.alert(
      'Confirm Pet Receipt',
      `Confirm that you have received ${record.pet_name || 'the pet'} and want to finalize this adoption?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setSimulatingPaymentId(record.id);
              await updateDoc(doc(db, 'adoptions', String(record.id)), {
                status: 'Completed',
                delivery_status: 'completed',
                adopter_confirmed_at: serverTimestamp(),
                completed_at: serverTimestamp(),
                updated_at: serverTimestamp(),
              });

              if (record.pet_id) {
                await updateDoc(doc(db, 'pets', String(record.pet_id)), {
                  status: 'unavailable',
                  adoption_listing_status: 'cancelled',
                  adopted_at: serverTimestamp(),
                  adopted_by_user_id: user.uid,
                  updated_at: serverTimestamp(),
                });
              }

              await loadAdoptions();
              Alert.alert('Adoption Completed', 'Thank you for confirming delivery.');
            } catch (error) {
              Alert.alert('Confirmation Failed', error?.message || 'Unable to confirm receipt right now.');
            } finally {
              setSimulatingPaymentId(null);
            }
          },
        },
      ]
    );
  }, [loadAdoptions, user?.uid]);

  const requestPetReturn = useCallback(async (record) => {
    if (!user?.uid || !record?.id) return;

    Alert.alert(
      'Request Pet Return',
      `Send a return request for ${record.pet_name || 'this pet'} to the shelter?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Return',
          onPress: async () => {
            try {
              setSimulatingPaymentId(record.id);
              await updateDoc(doc(db, 'adoptions', String(record.id)), {
                status: 'Return_Requested',
                return_status: 'requested',
                return_requested_by: user.uid,
                return_requested_at: serverTimestamp(),
                updated_at: serverTimestamp(),
              });
              await loadAdoptions();
              Alert.alert('Request Sent', 'Your return request was sent to the shelter for review.');
            } catch (error) {
              Alert.alert('Request Failed', error?.message || 'Unable to send return request right now.');
            } finally {
              setSimulatingPaymentId(null);
            }
          },
        },
      ]
    );
  }, [loadAdoptions, user?.uid]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Adoptions</Text>
        <Text style={styles.headerSubtitle}>Track adoptions as adopter and rescuer</Text>
      </View>

      <View style={styles.filterRow}>
        {[
          { id: 'all', label: 'All Roles' },
          { id: 'as_user', label: 'As User' },
          { id: 'as_rescuer', label: 'As Rescuer' },
        ].map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[styles.filterChip, roleFilter === filter.id && styles.filterChipActive]}
            onPress={() => setRoleFilter(filter.id)}
          >
            <Text style={[styles.filterChipText, roleFilter === filter.id && styles.filterChipTextActive]}>{filter.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.filterRow}>
        {[
          { id: 'all', label: 'All' },
          { id: 'unpaid', label: 'Unpaid' },
          { id: 'paid', label: 'Paid' },
        ].map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[styles.filterChip, activeFilter === filter.id && styles.filterChipActive]}
            onPress={() => setActiveFilter(filter.id)}
          >
            <Text style={[styles.filterChipText, activeFilter === filter.id && styles.filterChipTextActive]}>{filter.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading adoption requests...</Text>
          </View>
        ) : filteredRecords.length === 0 ? (
          <View style={styles.centerBox}>
            <Ionicons name="document-text-outline" size={56} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>No Requests Found</Text>
            <Text style={styles.emptySubtitle}>Your adoption requests will appear here.</Text>
          </View>
        ) : (
          filteredRecords.map((item) => {
            const adoptionStatusStyle = statusColor(item.status);
            const isPaid = item.payment_status === 'paid';
            const isSimulating = simulatingPaymentId === item.id;
            const canManagePayment = item.role_context === 'as_user' || item.role_context === 'both';
            const normalizedStatus = normalizeAdoptionStatus(item.status);
            const roleLabel = item.role_context === 'both'
              ? 'As User & Rescuer'
              : item.role_context === 'as_rescuer'
                ? 'As Rescuer'
                : 'As User';

            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.petName}>{item.pet_name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: adoptionStatusStyle.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: adoptionStatusStyle.text }]}>{String(item.status || 'pending')}</Text>
                  </View>
                </View>

                <View style={styles.rolePillRow}>
                  <View style={styles.rolePill}>
                    <Text style={styles.rolePillText}>{roleLabel}</Text>
                  </View>
                </View>

                <Text style={styles.metaText}>Applied: {formatDate(item.created_at)}</Text>
                <Text style={styles.metaText}>Amount: {formatMoney(item.payment_amount)}</Text>
                <Text style={styles.metaText}>Payment: {isPaid ? 'PAID' : 'UNPAID'}</Text>
                <Text style={styles.metaText}>Delivery: {deliveryStageLabel(normalizedStatus)}</Text>
                {item.user_email ? <Text style={styles.metaText}>Adopter: {item.user_email}</Text> : null}
                {item.payment_reference ? <Text style={styles.metaText}>Ref: {item.payment_reference}</Text> : null}
                {item.in_transit_at ? <Text style={styles.metaText}>In Transit: {formatDate(item.in_transit_at)}</Text> : null}
                {item.delivered_at ? <Text style={styles.metaText}>Handed Over: {formatDate(item.delivered_at)}</Text> : null}
                {item.completed_at ? <Text style={styles.metaText}>Completed: {formatDate(item.completed_at)}</Text> : null}

                {canManagePayment && item.payment_status === 'paid' && ['pending', 'approved', 'in_transit', 'delivered_pending_confirmation'].includes(normalizedStatus) ? (
                  <TouchableOpacity style={styles.chatButton} onPress={() => openAdoptionChat(item)}>
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#7B4518" />
                    <Text style={styles.chatButtonText}>Chat with Shelter</Text>
                  </TouchableOpacity>
                ) : null}

                {canManagePayment && isPaid && normalizedStatus === 'completed' ? (
                  <TouchableOpacity
                    style={[styles.requestReturnButton, isSimulating && styles.payButtonDisabled]}
                    onPress={() => requestPetReturn(item)}
                    disabled={isSimulating}
                  >
                    {isSimulating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.requestReturnButtonText}>Request Pet Return</Text>}
                  </TouchableOpacity>
                ) : null}

                {canManagePayment && isPaid && normalizedStatus === 'delivered_pending_confirmation' ? (
                  <TouchableOpacity
                    style={[styles.confirmReceiptButton, isSimulating && styles.payButtonDisabled]}
                    onPress={() => confirmReceipt(item)}
                    disabled={isSimulating}
                  >
                    {isSimulating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.confirmReceiptButtonText}>Confirm Receipt</Text>}
                  </TouchableOpacity>
                ) : null}

                {!isPaid && canManagePayment ? (
                  <TouchableOpacity
                    style={[styles.payButton, isSimulating && styles.payButtonDisabled]}
                    onPress={() => openSimulatePaymentModal(item)}
                    disabled={isSimulating}
                  >
                    {isSimulating ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.payButtonText}>Simulate Payment</Text>}
                  </TouchableOpacity>
                ) : isPaid ? (
                  <View style={[styles.paidBanner, normalizedStatus === 'in_transit' && styles.deliveryInfoBanner, normalizedStatus === 'delivered_pending_confirmation' && styles.deliveryAwaitingBanner]}>
                    <Ionicons
                      name={normalizedStatus === 'in_transit' ? 'car-outline' : normalizedStatus === 'delivered_pending_confirmation' ? 'time-outline' : 'checkmark-circle'}
                      size={16}
                      color={normalizedStatus === 'in_transit' ? '#1D4ED8' : normalizedStatus === 'delivered_pending_confirmation' ? '#4338CA' : '#166534'}
                    />
                    <Text style={[styles.paidBannerText, normalizedStatus === 'in_transit' && styles.deliveryInfoBannerText, normalizedStatus === 'delivered_pending_confirmation' && styles.deliveryAwaitingBannerText]}>
                      {normalizedStatus === 'in_transit'
                        ? 'Pet is currently in transit'
                        : normalizedStatus === 'delivered_pending_confirmation'
                          ? 'Please confirm receipt to complete adoption'
                          : normalizedStatus === 'return_requested'
                            ? 'Return request is waiting for shelter review'
                            : normalizedStatus === 'return_approved'
                              ? 'Return approved. Coordinate handover with shelter'
                              : normalizedStatus === 'return_in_transit'
                                ? 'Returned pet is in transit to shelter'
                                : normalizedStatus === 'return_completed'
                                  ? 'Pet return has been completed'
                                  : normalizedStatus === 'return_rejected'
                                    ? 'Shelter rejected the return request'
                          : 'Payment completed'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.rescuerInfoBanner}>
                    <Ionicons name="information-circle" size={16} color="#1E40AF" />
                    <Text style={styles.rescuerInfoBannerText}>Rescuer view only. Payment is handled by the adopter.</Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={paymentModalVisible} transparent animationType="fade" onRequestClose={closePaymentModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {checkoutStep === 'details' ? (
              <>
                <Text style={styles.modalTitle}>PayMongo Test Payment</Text>
                <Text style={styles.modalSubtitle}>Pet: {paymentTarget?.pet_name || 'Unknown Pet'}</Text>
                <Text style={styles.modalSubtitle}>Amount: {formatMoney(paymentTarget?.payment_amount || 0)}</Text>
                <Text style={styles.modalSubtitle}>Method: GCash</Text>

                <Text style={styles.inputLabel}>GCash Number</Text>
                <TextInput
                  style={styles.input}
                  value={paymentForm.gcashNumber}
                  onChangeText={(value) => setPaymentForm((prev) => ({ ...prev, gcashNumber: value }))}
                  keyboardType="phone-pad"
                  placeholder="09XXXXXXXXX"
                  placeholderTextColor={COLORS.textLight}
                  editable={!sendingOtp}
                  maxLength={11}
                />

                <Text style={styles.inputLabel}>Account Name</Text>
                <TextInput
                  style={styles.input}
                  value={paymentForm.accountName}
                  onChangeText={(value) => setPaymentForm((prev) => ({ ...prev, accountName: value }))}
                  placeholder="GCash registered name"
                  placeholderTextColor={COLORS.textLight}
                  editable={!sendingOtp}
                />

                <Text style={styles.inputLabel}>Receipt Email</Text>
                <TextInput
                  style={styles.input}
                  value={paymentForm.receiptEmail}
                  onChangeText={(value) => setPaymentForm((prev) => ({ ...prev, receiptEmail: value }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="you@example.com"
                  placeholderTextColor={COLORS.textLight}
                  editable={!sendingOtp}
                />

                <Text style={styles.formHelperText}>A receipt will be sent after successful simulation.</Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelModalButton} onPress={closePaymentModal} disabled={sendingOtp}>
                    <Text style={styles.cancelModalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmModalButton} onPress={startOtpFlow} disabled={sendingOtp}>
                    {sendingOtp ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.confirmModalButtonText}>Continue to OTP</Text>}
                  </TouchableOpacity>
                </View>
              </>
            ) : null}

            {checkoutStep === 'otp' ? (
              <>
                <Text style={styles.modalTitle}>GCash OTP Verification</Text>
                <Text style={styles.modalSubtitle}>We sent a 6-digit code to {paymentForm.gcashNumber || 'your number'}.</Text>
                <Text style={styles.modalSubtitle}>Amount: {formatMoney(paymentTarget?.payment_amount || 0)}</Text>

                <Text style={styles.inputLabel}>OTP Code</Text>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="number-pad"
                  placeholder="Enter 6-digit OTP"
                  placeholderTextColor={COLORS.textLight}
                  maxLength={6}
                  editable={!simulatingPaymentId}
                />
                <Text style={styles.formHelperText}>Simulation OTP: {generatedOtp || '------'}</Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelModalButton}
                    onPress={() => {
                      setCheckoutStep('details');
                      setOtpCode('');
                    }}
                    disabled={!!simulatingPaymentId}
                  >
                    <Text style={styles.cancelModalButtonText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmModalButton} onPress={simulatePayment} disabled={!!simulatingPaymentId}>
                    {simulatingPaymentId ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.confirmModalButtonText}>Verify and Pay</Text>}
                  </TouchableOpacity>
                </View>
              </>
            ) : null}

            {checkoutStep === 'processing' ? (
              <View style={styles.processingWrap}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.processingTitle}>Processing Payment...</Text>
                <Text style={styles.processingText}>Please wait while we confirm your GCash payment with PayMongo.</Text>
              </View>
            ) : null}

            {checkoutStep === 'success' ? (
              <View style={styles.processingWrap}>
                <Ionicons name="checkmark-circle" size={56} color="#16A34A" />
                <Text style={styles.processingTitle}>Payment Successful</Text>
                <Text style={styles.processingText}>Your adoption payment was completed and receipt has been queued for email.</Text>
                <TouchableOpacity style={styles.successDoneButton} onPress={closePaymentModal}>
                  <Text style={styles.successDoneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
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
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 8 : 56,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
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
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.backgroundWhite,
  },
  filterChipActive: {
    backgroundColor: `${COLORS.primary}1A`,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    fontWeight: FONTS.weights.semiBold,
  },
  filterChipTextActive: {
    color: COLORS.primary,
  },
  list: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  listContent: {
    paddingBottom: 120,
    paddingTop: SPACING.xs,
  },
  centerBox: {
    marginTop: 64,
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
  emptySubtitle: {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  petName: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  statusBadge: {
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    textTransform: 'capitalize',
  },
  metaText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: 3,
  },
  rolePillRow: {
    marginTop: 2,
    marginBottom: 4,
  },
  rolePill: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.round,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  rolePillText: {
    fontSize: FONTS.sizes.xs,
    color: '#075985',
    fontWeight: FONTS.weights.bold,
  },
  payButton: {
    marginTop: SPACING.md,
    minHeight: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonDisabled: {
    opacity: 0.75,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  confirmReceiptButton: {
    marginTop: SPACING.sm,
    minHeight: 40,
    borderRadius: RADIUS.md,
    backgroundColor: '#4338CA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmReceiptButtonText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  requestReturnButton: {
    marginTop: SPACING.sm,
    minHeight: 40,
    borderRadius: RADIUS.md,
    backgroundColor: '#B45309',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestReturnButtonText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  paidBanner: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderRadius: RADIUS.md,
    backgroundColor: '#DCFCE7',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  paidBannerText: {
    color: '#166534',
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
  },
  deliveryInfoBanner: {
    backgroundColor: '#DBEAFE',
  },
  deliveryInfoBannerText: {
    color: '#1D4ED8',
  },
  deliveryAwaitingBanner: {
    backgroundColor: '#EEF2FF',
  },
  deliveryAwaitingBannerText: {
    color: '#4338CA',
  },
  rescuerInfoBanner: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderRadius: RADIUS.md,
    backgroundColor: '#DBEAFE',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  rescuerInfoBannerText: {
    color: '#1E3A8A',
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    flex: 1,
  },
  chatButton: {
    marginTop: SPACING.sm,
    minHeight: 38,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E9D8C5',
    backgroundColor: '#FFF4E8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  chatButtonText: {
    fontSize: FONTS.sizes.sm,
    color: '#7B4518',
    fontWeight: FONTS.weights.semiBold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  modalCard: {
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.backgroundWhite,
    padding: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.xs,
  },
  modalSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginBottom: 2,
  },
  inputLabel: {
    marginTop: SPACING.md,
    marginBottom: 4,
    color: COLORS.textDark,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
  },
  input: {
    minHeight: 42,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.sm,
    color: COLORS.textDark,
  },
  otpInput: {
    letterSpacing: 2,
    textAlign: 'center',
    fontWeight: FONTS.weights.bold,
  },
  formHelperText: {
    marginTop: SPACING.sm,
    color: COLORS.textMedium,
    fontSize: FONTS.sizes.xs,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  cancelModalButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  cancelModalButtonText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    fontWeight: FONTS.weights.semiBold,
  },
  confirmModalButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  confirmModalButtonText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  processingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
  },
  processingTitle: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  processingText: {
    marginTop: SPACING.xs,
    textAlign: 'center',
    color: COLORS.textMedium,
    fontSize: FONTS.sizes.sm,
  },
  successDoneButton: {
    marginTop: SPACING.lg,
    minHeight: 42,
    borderRadius: RADIUS.md,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  successDoneButtonText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
});

export default UserAdoptionsScreen;
