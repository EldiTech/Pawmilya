import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import { auth, db } from '../../firebaseConfig';
import { normalizeTransferStatus } from '../../utils/status';

const ACCEPTED_TRANSFER_STATUSES = new Set([
  'approved',
  'accepted',
  'in_transit',
  'arrived_at_shelter',
  'completed',
]);

const STATUS_COLORS = {
  approved: '#10B981',
  accepted: '#10B981',
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

const RescuedPetsScreen = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [managedShelter, setManagedShelter] = useState(null);
  const [acceptedTransfers, setAcceptedTransfers] = useState([]);
  const [registeringId, setRegisteringId] = useState(null);
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [registerStep, setRegisterStep] = useState(1);
  const [petImages, setPetImages] = useState([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [registrationForm, setRegistrationForm] = useState({
    name: '',
    breed_name: '',
    age_years: '',
    gender: 'Unknown',
    description: '',
    location: '',
    adoption_fee: '',
  });

  const loadAcceptedTransfers = useCallback(async () => {
    try {
      setLoading(true);

      const currentUser = auth.currentUser;
      if (!currentUser?.uid) {
        setManagedShelter(null);
        setAcceptedTransfers([]);
        return;
      }

      const shelterByManager = await getDocs(query(
        collection(db, 'shelters'),
        where('manager_id', '==', currentUser.uid)
      ));

      if (shelterByManager.empty) {
        setManagedShelter(null);
        setAcceptedTransfers([]);
        return;
      }

      const shelterDoc = shelterByManager.docs[0];
      const shelter = { id: shelterDoc.id, ...shelterDoc.data() };
      setManagedShelter(shelter);

      const [byShelterId, byToShelterId] = await Promise.all([
        getDocs(query(collection(db, 'transfers'), where('shelter_id', '==', shelter.id))),
        getDocs(query(collection(db, 'transfers'), where('to_shelter_id', '==', shelter.id))),
      ]);

      const merged = new Map();
      byShelterId.forEach((docSnap) => merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
      byToShelterId.forEach((docSnap) => merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));

      const acceptedRows = Array.from(merged.values()).filter((item) => {
        const status = normalizeTransferStatus(item?.status);
        return ACCEPTED_TRANSFER_STATUSES.has(status);
      });

      const reportIds = Array.from(new Set(
        acceptedRows
          .map((item) => String(item?.rescue_report_id || '').trim())
          .filter(Boolean)
      ));

      const reportEntries = await Promise.all(reportIds.map(async (reportId) => {
        try {
          const reportSnap = await getDoc(doc(db, 'rescue_reports', reportId));
          return [reportId, reportSnap.exists() ? (reportSnap.data() || {}) : null];
        } catch {
          return [reportId, null];
        }
      }));

      const reportMap = Object.fromEntries(reportEntries);

      const sourcePetIds = Array.from(new Set(
        acceptedRows
          .map((item) => String(item?.pet_id || '').trim())
          .filter(Boolean)
      ));

      const sourcePetEntries = await Promise.all(sourcePetIds.map(async (petId) => {
        try {
          const petSnap = await getDoc(doc(db, 'pets', petId));
          return [petId, petSnap.exists() ? (petSnap.data() || {}) : null];
        } catch {
          return [petId, null];
        }
      }));

      const sourcePetMap = Object.fromEntries(sourcePetEntries);

      const petsSnap = await getDocs(query(
        collection(db, 'pets'),
        where('shelter_id', '==', shelter.id)
      ));

      const petByTransferId = new Map();
      petsSnap.forEach((petDoc) => {
        const petData = petDoc.data() || {};
        const transferId = String(petData.transfer_request_id || '').trim();
        if (transferId) {
          petByTransferId.set(transferId, petDoc.id);
        }
      });

      const rows = acceptedRows
        .map((item) => {
          const reportId = String(item?.rescue_report_id || '').trim();
          const report = reportMap[reportId] || {};
          const sourcePetId = String(item?.pet_id || '').trim();
          const sourcePet = sourcePetMap[sourcePetId] || {};
          const sourceImages = Array.isArray(sourcePet?.images)
            ? sourcePet.images
            : (sourcePet?.image || sourcePet?.image_url ? [sourcePet.image || sourcePet.image_url] : []);

          return {
            ...item,
            report_title:
              report?.title
              || item?.pet_name
              || sourcePet?.name
              || null,
            report_animal_type:
              report?.animal_type
              || report?.animalType
              || item?.animal_type
              || sourcePet?.breed_name
              || null,
            report_location:
              report?.location_description
              || report?.location
              || sourcePet?.location
              || null,
            report_description:
              report?.description
              || sourcePet?.description
              || item?.notes
              || null,
            report_images: Array.isArray(report?.images) && report.images.length > 0 ? report.images : sourceImages,
            source_pet_id: sourcePetId || null,
            source_pet_name: sourcePet?.name || item?.pet_name || null,
            source_pet_breed: sourcePet?.breed_name || null,
            source_shelter_name: item?.from_shelter_name || item?._from_shelter_name || item?.requested_by_shelter_name || null,
            registered_pet_id: petByTransferId.get(String(item?.id || '')) || null,
          };
        })
        .sort((a, b) => {
          const aDate = a?.updated_at?.toDate ? a.updated_at.toDate() : new Date(a?.updated_at || a?.created_at || 0);
          const bDate = b?.updated_at?.toDate ? b.updated_at.toDate() : new Date(b?.updated_at || b?.created_at || 0);
          return bDate - aDate;
        });

      setAcceptedTransfers(rows);
    } catch (error) {
      console.error('Error loading rescued pets from transfers:', error);
      setAcceptedTransfers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAcceptedTransfers();
  }, [loadAcceptedTransfers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAcceptedTransfers();
  }, [loadAcceptedTransfers]);

  const acceptedCount = useMemo(() => acceptedTransfers.length, [acceptedTransfers]);

  const closeRegisterModal = useCallback(() => {
    setRegisterModalVisible(false);
    setRegisterStep(1);
    setSelectedTransfer(null);
    setPetImages([]);
    setImageUrlInput('');
    setRegistrationForm({
      name: '',
      breed_name: '',
      age_years: '',
      gender: 'Unknown',
      description: '',
      location: '',
      adoption_fee: '',
    });
  }, []);

  const openRegisterModal = useCallback((transfer) => {
    const animalType = String(transfer?.report_animal_type || '').toLowerCase();
    const suggestedName = String(transfer?.report_title || '').trim() || `Rescued ${animalType || 'Pet'}`;
    const shelterLocation = [managedShelter?.address, managedShelter?.city]
      .filter((value) => String(value || '').trim().length > 0)
      .join(', ');

    setSelectedTransfer(transfer);
    setRegisterStep(1);
    setPetImages(Array.isArray(transfer?.report_images) ? transfer.report_images.slice(0, 3) : []);
    setImageUrlInput('');
    setRegistrationForm({
      name: suggestedName,
      breed_name: transfer?.source_pet_breed || transfer?.report_animal_type || 'Mixed Breed',
      age_years: '',
      gender: 'Unknown',
      description: transfer?.report_description || transfer?.notes || 'Rescued via shelter transfer.',
      location: shelterLocation || transfer?.report_location || '',
      adoption_fee: '',
    });
    setRegisterModalVisible(true);
  }, [managedShelter?.address, managedShelter?.city]);

  const updateRegistrationField = useCallback((field, value) => {
    setRegistrationForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const appendImageAsset = useCallback((asset) => {
    if (!asset) {
      return;
    }

    if (asset.base64) {
      const mimeType = asset.mimeType || 'image/jpeg';
      const base64Image = `data:${mimeType};base64,${asset.base64}`;
      setPetImages((prev) => [...prev, base64Image]);
      return;
    }

    if (asset.uri) {
      setPetImages((prev) => [...prev, asset.uri]);
    }
  }, []);

  const pickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your gallery to upload a pet picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        appendImageAsset(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  }, [appendImageAsset]);

  const takePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow camera access to upload a pet picture.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        appendImageAsset(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  }, [appendImageAsset]);

  const addImageFromUrl = useCallback(() => {
    const trimmedUrl = String(imageUrlInput || '').trim();
    if (!trimmedUrl) {
      Alert.alert('Missing URL', 'Please enter an image URL.');
      return;
    }

    if (!/^https?:\/\//i.test(trimmedUrl)) {
      Alert.alert('Invalid URL', 'Image URL must start with http:// or https://');
      return;
    }

    setPetImages((prev) => [...prev, trimmedUrl]);
    setImageUrlInput('');
  }, [imageUrlInput]);

  const removeImage = useCallback((index) => {
    setPetImages((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  const validateWizardStep = useCallback((step) => {
    if (step === 1) {
      if (!String(registrationForm.name || '').trim() || !String(registrationForm.breed_name || '').trim()) {
        Alert.alert('Missing Information', 'Please complete Pet Name and Breed before continuing.');
        return false;
      }
    }

    if (step === 2) {
      if (!String(registrationForm.description || '').trim() || !String(registrationForm.location || '').trim()) {
        Alert.alert('Missing Information', 'Please complete Description and Location before continuing.');
        return false;
      }
    }

    if (step === 3) {
      if (!Array.isArray(petImages) || petImages.length === 0) {
        Alert.alert('Picture Required', 'Please upload at least one pet picture before listing for adoption.');
        return false;
      }
    }

    return true;
  }, [petImages, registrationForm.breed_name, registrationForm.description, registrationForm.location, registrationForm.name]);

  const goNextStep = useCallback(() => {
    if (!validateWizardStep(registerStep)) {
      return;
    }

    setRegisterStep((prev) => Math.min(prev + 1, 3));
  }, [registerStep, validateWizardStep]);

  const goPreviousStep = useCallback(() => {
    setRegisterStep((prev) => Math.max(prev - 1, 1));
  }, []);

  const registerForAdoption = useCallback(async () => {
    if (!selectedTransfer?.id || !managedShelter?.id) {
      return;
    }

    const trimmedName = String(registrationForm.name || '').trim();
    const trimmedBreed = String(registrationForm.breed_name || '').trim();
    const trimmedDescription = String(registrationForm.description || '').trim();
    const trimmedLocation = String(registrationForm.location || '').trim();

    if (!trimmedName || !trimmedBreed || !trimmedDescription || !trimmedLocation) {
      Alert.alert('Missing Information', 'Please complete Name, Breed, Description, and Location before listing for adoption.');
      return;
    }

    if (!Array.isArray(petImages) || petImages.length === 0) {
      Alert.alert('Picture Required', 'Please upload at least one pet picture before listing for adoption.');
      return;
    }

    try {
      setRegisteringId(String(selectedTransfer.id));

      const duplicateSnap = await getDocs(query(
        collection(db, 'pets'),
        where('transfer_request_id', '==', String(selectedTransfer.id))
      ));

      if (!duplicateSnap.empty) {
        const existingPetId = duplicateSnap.docs[0].id;
        setAcceptedTransfers((prev) => prev.map((item) => (
          String(item.id) === String(selectedTransfer.id)
            ? { ...item, registered_pet_id: existingPetId }
            : item
        )));
        Alert.alert('Already Listed', 'This delivered transfer is already registered for adoption.');
        closeRegisterModal();
        return;
      }

      const categoryName = String(selectedTransfer?.report_animal_type || '').toLowerCase();
      const categoryId = categoryName.includes('cat') ? 2 : 1;
      const ageYears = Number.parseInt(registrationForm.age_years, 10);
      const adoptionFee = Number.parseFloat(registrationForm.adoption_fee);

      const petPayload = {
        name: trimmedName,
        category_id: categoryId,
        breed_id: null,
        breed_name: trimmedBreed,
        age_years: Number.isNaN(ageYears) ? 0 : ageYears,
        age_months: 0,
        gender: registrationForm.gender || 'Unknown',
        size: 'medium',
        weight_kg: null,
        color: null,
        description: trimmedDescription,
        medical_history: null,
        vaccination_status: 'not_vaccinated',
        is_neutered: false,
        is_house_trained: false,
        is_good_with_kids: false,
        is_good_with_other_pets: false,
        temperament: [],
        special_needs: null,
        status: 'available',
        adoption_listing_status: 'listed',
        is_featured: false,
        shelter_id: String(managedShelter.id),
        location: trimmedLocation,
        latitude: selectedTransfer?.shelter_latitude ?? null,
        longitude: selectedTransfer?.shelter_longitude ?? null,
        adoption_fee: Number.isNaN(adoptionFee) ? 0 : adoptionFee,
        images: petImages,
        transfer_request_id: String(selectedTransfer.id),
        rescue_report_id: String(selectedTransfer.rescue_report_id || ''),
        source: 'shelter_transfer',
        createdAt: new Date().toISOString(),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      };

      const petRef = await addDoc(collection(db, 'pets'), petPayload);

      await updateDoc(doc(db, 'transfers', String(selectedTransfer.id)), {
        registered_pet_id: String(petRef.id),
        adoption_listing_status: 'listed',
        adoption_listed_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      setAcceptedTransfers((prev) => prev.map((item) => (
        String(item.id) === String(selectedTransfer.id)
          ? { ...item, registered_pet_id: String(petRef.id) }
          : item
      )));

      Alert.alert('Listed For Adoption', `${trimmedName} has been registered and is now available for adoption.`);
      closeRegisterModal();
    } catch (error) {
      console.error('Error registering rescued pet for adoption:', error);
      Alert.alert('Error', 'Failed to register rescued pet. Please try again.');
    } finally {
      setRegisteringId(null);
    }
  }, [closeRegisterModal, managedShelter?.id, petImages, registrationForm, selectedTransfer]);

  const renderPetCard = (item) => {
    const status = normalizeTransferStatus(item?.status) || 'accepted';
    const statusColor = STATUS_COLORS[status] || COLORS.textMedium;

    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.cardTitle}>{item.report_title || `Rescued Pet #${item.id}`}</Text>
            <Text style={styles.cardSubTitle}>{item.report_animal_type || 'Animal type not specified'}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{status.replace(/_/g, ' ')}</Text>
          </View>
        </View>

        <Text style={styles.metaText}>Transfer ID: {item.id}</Text>
        <Text style={styles.metaText}>From Shelter: {item.source_shelter_name || 'N/A'}</Text>
        <Text style={styles.metaText}>Rescue Report: {item.rescue_report_id || 'N/A'}</Text>
        <Text style={styles.metaText}>Assigned Shelter: {item.shelter_name || managedShelter?.name || 'N/A'}</Text>
        <Text style={styles.metaText}>Urgency: {String(item.urgency || 'normal')}</Text>
        <Text style={styles.metaText}>Location: {item.report_location || 'N/A'}</Text>
        <Text style={styles.metaText}>Accepted/Updated: {formatDate(item.updated_at || item.created_at)}</Text>

        {status === 'completed' && !item.registered_pet_id && (
          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => openRegisterModal(item)}
            disabled={registeringId === String(item.id)}
          >
            {registeringId === String(item.id) ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.registerButtonText}>Register & List For Adoption</Text>
            )}
          </TouchableOpacity>
        )}

        {item.registered_pet_id ? (
          <View style={styles.listedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#047857" />
            <Text style={styles.listedBadgeText}>Listed for adoption</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <Modal
        visible={registerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeRegisterModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register Rescued Pet</Text>
              <TouchableOpacity onPress={closeRegisterModal}>
                <Ionicons name="close" size={22} color={COLORS.textMedium} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.wizardStepRow}>
                <View style={[styles.wizardStepChip, registerStep >= 1 && styles.wizardStepChipActive]}>
                  <Text style={[styles.wizardStepText, registerStep >= 1 && styles.wizardStepTextActive]}>1. Basic</Text>
                </View>
                <View style={[styles.wizardStepChip, registerStep >= 2 && styles.wizardStepChipActive]}>
                  <Text style={[styles.wizardStepText, registerStep >= 2 && styles.wizardStepTextActive]}>2. Details</Text>
                </View>
                <View style={[styles.wizardStepChip, registerStep >= 3 && styles.wizardStepChipActive]}>
                  <Text style={[styles.wizardStepText, registerStep >= 3 && styles.wizardStepTextActive]}>3. Photos</Text>
                </View>
              </View>

              {registerStep === 1 && (
                <>
                  <Text style={styles.inputLabel}>Pet Name</Text>
                  <TextInput
                    style={styles.input}
                    value={registrationForm.name}
                    onChangeText={(text) => updateRegistrationField('name', text)}
                    placeholder="Enter pet name"
                    placeholderTextColor={COLORS.textLight}
                  />

                  <Text style={styles.inputLabel}>Breed</Text>
                  <TextInput
                    style={styles.input}
                    value={registrationForm.breed_name}
                    onChangeText={(text) => updateRegistrationField('breed_name', text)}
                    placeholder="Mixed Breed"
                    placeholderTextColor={COLORS.textLight}
                  />

                  <Text style={styles.inputLabel}>Age (Years)</Text>
                  <TextInput
                    style={styles.input}
                    value={registrationForm.age_years}
                    onChangeText={(text) => updateRegistrationField('age_years', text)}
                    placeholder="0"
                    keyboardType="number-pad"
                    placeholderTextColor={COLORS.textLight}
                  />

                  <Text style={styles.inputLabel}>Gender (Male/Female/Unknown)</Text>
                  <TextInput
                    style={styles.input}
                    value={registrationForm.gender}
                    onChangeText={(text) => updateRegistrationField('gender', text)}
                    placeholder="Unknown"
                    placeholderTextColor={COLORS.textLight}
                  />
                </>
              )}

              {registerStep === 2 && (
                <>
                  <Text style={styles.inputLabel}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    value={registrationForm.description}
                    onChangeText={(text) => updateRegistrationField('description', text)}
                    placeholder="Write pet details and condition"
                    placeholderTextColor={COLORS.textLight}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />

                  <Text style={styles.inputLabel}>Location</Text>
                  <TextInput
                    style={styles.input}
                    value={registrationForm.location}
                    onChangeText={(text) => updateRegistrationField('location', text)}
                    placeholder="Shelter location"
                    placeholderTextColor={COLORS.textLight}
                  />

                  <Text style={styles.inputLabel}>Adoption Fee (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={registrationForm.adoption_fee}
                    onChangeText={(text) => updateRegistrationField('adoption_fee', text)}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    placeholderTextColor={COLORS.textLight}
                  />
                </>
              )}

              {registerStep === 3 && (
                <>
                  <Text style={styles.inputLabel}>Upload Pictures</Text>
                  <View style={styles.imageActionsRow}>
                    <TouchableOpacity style={styles.imageActionButton} onPress={pickImage}>
                      <Ionicons name="images-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.imageActionText}>Gallery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.imageActionButton} onPress={takePhoto}>
                      <Ionicons name="camera-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.imageActionText}>Camera</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.imageUrlRow}>
                    <TextInput
                      style={[styles.input, styles.imageUrlInput]}
                      value={imageUrlInput}
                      onChangeText={setImageUrlInput}
                      placeholder="Paste image URL (https://...)"
                      placeholderTextColor={COLORS.textLight}
                    />
                    <TouchableOpacity style={styles.addUrlButton} onPress={addImageFromUrl}>
                      <Text style={styles.addUrlButtonText}>Add</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.imageHintText}>At least one picture is required before listing.</Text>

                  <View style={styles.previewGrid}>
                    {petImages.map((uri, index) => (
                      <View key={`${uri}_${index}`} style={styles.previewItem}>
                        <Image source={{ uri }} style={styles.previewImage} />
                        <TouchableOpacity style={styles.removeImageButton} onPress={() => removeImage(index)}>
                          <Ionicons name="close" size={12} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.wizardFooter}>
              {registerStep > 1 && (
                <TouchableOpacity style={styles.backStepButton} onPress={goPreviousStep}>
                  <Text style={styles.backStepButtonText}>Back</Text>
                </TouchableOpacity>
              )}

              {registerStep < 3 ? (
                <TouchableOpacity style={styles.nextStepButton} onPress={goNextStep}>
                  <Text style={styles.nextStepButtonText}>Next</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={registerForAdoption}
                  disabled={registeringId === String(selectedTransfer?.id || '')}
                >
                  {registeringId === String(selectedTransfer?.id || '') ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>Save & List For Adoption</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Rescued Pets</Text>
          <Text style={styles.headerSubtitle}>{acceptedCount} accepted from transfer requests</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading rescued pets...</Text>
          </View>
        ) : acceptedTransfers.length === 0 ? (
          <View style={styles.centerBox}>
            <Ionicons name="heart-outline" size={56} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>No Accepted Transfers Yet</Text>
            <Text style={styles.emptyText}>Pets from approved or accepted transfer requests will appear here.</Text>
          </View>
        ) : (
          <View style={styles.listWrap}>{acceptedTransfers.map(renderPetCard)}</View>
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
  scrollView: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cardTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  cardSubTitle: {
    marginTop: 2,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
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
  registerButton: {
    marginTop: SPACING.sm,
    minHeight: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  listedBadge: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#D1FAE5',
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  listedBadgeText: {
    color: '#047857',
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  modalCard: {
    maxHeight: '85%',
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
  modalBody: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  wizardStepRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  wizardStepChip: {
    flex: 1,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingVertical: 6,
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  wizardStepChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}1A`,
  },
  wizardStepText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
    fontWeight: FONTS.weights.bold,
  },
  wizardStepTextActive: {
    color: COLORS.primary,
  },
  inputLabel: {
    marginTop: SPACING.sm,
    marginBottom: 4,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    fontWeight: FONTS.weights.bold,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 10,
    color: COLORS.textDark,
    backgroundColor: COLORS.background,
  },
  multilineInput: {
    minHeight: 92,
  },
  imageActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  imageActionButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: `${COLORS.primary}33`,
    backgroundColor: `${COLORS.primary}12`,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  imageActionText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  imageUrlRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
  },
  imageUrlInput: {
    flex: 1,
  },
  addUrlButton: {
    minHeight: 40,
    minWidth: 58,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
  },
  addUrlButtonText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  imageHintText: {
    marginTop: SPACING.xs,
    color: COLORS.textMedium,
    fontSize: FONTS.sizes.xs,
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  previewItem: {
    width: 76,
    height: 76,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.background,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  wizardFooter: {
    margin: SPACING.md,
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  backStepButton: {
    minHeight: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.lg,
  },
  backStepButtonText: {
    color: COLORS.textMedium,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  nextStepButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  nextStepButtonText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  submitButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
});

export default RescuedPetsScreen;
