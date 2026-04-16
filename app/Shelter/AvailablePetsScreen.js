import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
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

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
};

const isCancelledListing = (item) => {
  const status = String(item?.status || '').toLowerCase();
  const adoptionListingStatus = String(item?.adoption_listing_status || '').toLowerCase();
  return status === 'unavailable' || status === 'inactive' || adoptionListingStatus === 'cancelled';
};

const chunkArray = (input = [], size = 10) => {
  const chunks = [];
  for (let index = 0; index < input.length; index += size) {
    chunks.push(input.slice(index, index + size));
  }
  return chunks;
};

const isAdoptedPet = (item = {}) => {
  const normalizedStatus = String(item?.status || '').toLowerCase();
  const normalizedListing = String(item?.adoption_listing_status || '').toLowerCase();
  return Boolean(
    item?._adopter_id
    || item?.adopted_by_user_id
    || item?.adopted_at
    || normalizedStatus === 'adopted'
    || (normalizedStatus === 'unavailable' && normalizedListing === 'cancelled' && item?._adoption_completed_at)
  );
};

const EDIT_TOTAL_STEPS = 3;
const MAX_INLINE_IMAGE_LENGTH = 150000;

const sanitizePetImagesForFirestore = (input = []) => {
  if (!Array.isArray(input)) return [];

  const seen = new Set();
  const output = [];

  input.forEach((rawValue) => {
    if (typeof rawValue !== 'string') return;
    const value = rawValue.trim();
    if (!value) return;

    const isNetworkImage = value.startsWith('http://') || value.startsWith('https://');
    const isLocalFileImage = value.startsWith('file://') || value.startsWith('/');
    const isInlineImage = value.startsWith('data:image/');

    // Keep inline images only when they are small enough to avoid Firestore size limit issues.
    if (isInlineImage && value.length > MAX_INLINE_IMAGE_LENGTH) {
      return;
    }

    if (!isNetworkImage && !isLocalFileImage && !isInlineImage) {
      return;
    }

    if (seen.has(value)) return;
    seen.add(value);
    output.push(value);
  });

  return output.slice(0, 6);
};

const AvailablePetsScreen = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [managedShelter, setManagedShelter] = useState(null);
  const [pets, setPets] = useState([]);
  const [activeTab, setActiveTab] = useState('listed');
  const [editingPet, setEditingPet] = useState(null);
  const [viewingAdoptedPet, setViewingAdoptedPet] = useState(null);
  const [editStep, setEditStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    breed_name: '',
    description: '',
    location: '',
    adoption_fee: '',
    age_years: '',
    gender: '',
    images: [],
  });

  const loadPets = useCallback(async () => {
    try {
      setLoading(true);

      const currentUser = auth.currentUser;
      if (!currentUser?.uid) {
        setManagedShelter(null);
        setPets([]);
        return;
      }

      const shelterByManager = await getDocs(query(
        collection(db, 'shelters'),
        where('manager_id', '==', currentUser.uid)
      ));

      if (shelterByManager.empty) {
        setManagedShelter(null);
        setPets([]);
        return;
      }

      const shelterDoc = shelterByManager.docs[0];
      const shelter = { id: shelterDoc.id, ...shelterDoc.data() };
      setManagedShelter(shelter);

      const petsSnap = await getDocs(query(
        collection(db, 'pets'),
        where('shelter_id', '==', shelter.id)
      ));

      const rows = petsSnap.docs
        .map((petDoc) => ({ id: petDoc.id, ...petDoc.data() }))
        .sort((a, b) => {
          const aDate = a?.updated_at?.toDate ? a.updated_at.toDate() : new Date(a?.createdAt || 0);
          const bDate = b?.updated_at?.toDate ? b.updated_at.toDate() : new Date(b?.createdAt || 0);
          return bDate - aDate;
        });

      const petIds = rows.map((item) => String(item.id || '')).filter(Boolean);
      const petIdChunks = chunkArray(petIds, 10);
      const adoptionChunkSnaps = await Promise.all(
        petIdChunks.map((chunk) => getDocs(query(collection(db, 'adoptions'), where('pet_id', 'in', chunk))))
      );

      const completedAdoptions = adoptionChunkSnaps
        .flatMap((snap) => snap.docs.map((adoptionDoc) => ({ id: adoptionDoc.id, ...adoptionDoc.data() })))
        .filter((item) => String(item?.status || '').toLowerCase() === 'completed');

      const latestCompletedByPet = new Map();
      completedAdoptions.forEach((item) => {
        const petId = String(item?.pet_id || '').trim();
        if (!petId) return;

        const existing = latestCompletedByPet.get(petId);
        const currentMs = item?.completed_at?.toDate
          ? item.completed_at.toDate().getTime()
          : new Date(item?.completed_at || item?.updated_at || item?.created_at || 0).getTime();
        const existingMs = existing?.completed_at?.toDate
          ? existing.completed_at.toDate().getTime()
          : new Date(existing?.completed_at || existing?.updated_at || existing?.created_at || 0).getTime();

        if (!existing || currentMs >= existingMs) {
          latestCompletedByPet.set(petId, item);
        }
      });

      const adopterIds = Array.from(new Set(
        Array.from(latestCompletedByPet.values())
          .map((item) => String(item?.user_id || '').trim())
          .filter(Boolean)
      ));

      const adopterEntries = await Promise.all(adopterIds.map(async (userId) => {
        try {
          const userSnap = await getDoc(doc(db, 'users', userId));
          return [userId, userSnap.exists() ? (userSnap.data() || {}) : {}];
        } catch {
          return [userId, {}];
        }
      }));

      const adopterMap = Object.fromEntries(adopterEntries);

      const enrichedRows = rows.map((pet) => {
        const adoption = latestCompletedByPet.get(String(pet.id || '')) || null;
        const adopterId = String(adoption?.user_id || pet?.adopted_by_user_id || '').trim();
        const adopter = adopterMap[adopterId] || {};
        const addressLine = [adopter.address, adopter.city].filter(Boolean).join(', ');

        return {
          ...pet,
          _adopter_id: adopterId || null,
          _adopter_name: adopter.full_name || adopter.name || adoption?.user_email || null,
          _adopter_email: adopter.email || adoption?.user_email || null,
          _adopter_address: addressLine || null,
          _adoption_completed_at: adoption?.completed_at || pet?.adopted_at || null,
          _adoption_id: adoption?.id || null,
        };
      });

      setPets(enrichedRows);
    } catch (error) {
      console.error('Error loading shelter pets:', error);
      setPets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPets();
  }, [loadPets]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPets();
  }, [loadPets]);

  const adoptedPets = useMemo(() => pets.filter((item) => isAdoptedPet(item)), [pets]);
  const listedPets = useMemo(() => pets.filter((item) => !isCancelledListing(item) && !isAdoptedPet(item)), [pets]);
  const cancelledPets = useMemo(() => pets.filter((item) => isCancelledListing(item) && !isAdoptedPet(item)), [pets]);
  const visiblePets = useMemo(() => {
    if (activeTab === 'cancelled') return cancelledPets;
    if (activeTab === 'adopted') return adoptedPets;
    return listedPets;
  }, [activeTab, adoptedPets, cancelledPets, listedPets]);

  const openEdit = useCallback((pet) => {
    const initialImages = Array.isArray(pet?.images) && pet.images.length > 0
      ? pet.images
      : (pet?.image || pet?.image_url ? [pet.image || pet.image_url] : []);

    setEditingPet(pet);
    setEditStep(1);
    setEditForm({
      name: pet?.name || '',
      breed_name: pet?.breed_name || '',
      description: pet?.description || '',
      location: pet?.location || '',
      adoption_fee: String(pet?.adoption_fee ?? '0'),
      age_years: String(pet?.age_years ?? '0'),
      gender: pet?.gender || 'Unknown',
      images: initialImages,
    });
  }, []);

  const closeEdit = useCallback(() => {
    setEditingPet(null);
    setEditStep(1);
  }, []);

  const closeAdoptedView = useCallback(() => {
    setViewingAdoptedPet(null);
  }, []);

  const updateEditField = useCallback((field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const removeEditImage = useCallback((indexToRemove) => {
    setEditForm((prev) => ({
      ...prev,
      images: (prev.images || []).filter((_, index) => index !== indexToRemove),
    }));
  }, []);

  const appendEditImageAsset = useCallback((asset) => {
    if (!asset) return;

    setEditForm((prev) => {
      if (asset.uri) {
        return { ...prev, images: [...(prev.images || []), asset.uri] };
      }

      return prev;
    });
  }, []);

  const pickEditImage = useCallback(async (fromCamera = false) => {
    try {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert(
          'Permission Required',
          fromCamera
            ? 'Please allow camera access to take a pet photo.'
            : 'Please allow photo library access to choose a pet photo.'
        );
        return;
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        })
        : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });

      if (!result.canceled && result.assets?.[0]) {
        appendEditImageAsset(result.assets[0]);
      }
    } catch (error) {
      console.error('Error selecting edit image:', error);
      Alert.alert('Error', 'Failed to update pet picture. Please try again.');
    }
  }, [appendEditImageAsset]);

  const nextEditStep = useCallback(() => {
    if (editStep === 1) {
      const trimmedName = String(editForm.name || '').trim();
      const trimmedBreed = String(editForm.breed_name || '').trim();
      if (!trimmedName || !trimmedBreed) {
        Alert.alert('Missing Information', 'Please complete Name and Breed first.');
        return;
      }
    }

    if (editStep === 2) {
      const trimmedDescription = String(editForm.description || '').trim();
      const trimmedLocation = String(editForm.location || '').trim();
      if (!trimmedDescription || !trimmedLocation) {
        Alert.alert('Missing Information', 'Please complete Description and Location first.');
        return;
      }
    }

    setEditStep((prev) => Math.min(prev + 1, EDIT_TOTAL_STEPS));
  }, [editForm.breed_name, editForm.description, editForm.location, editForm.name, editStep]);

  const prevEditStep = useCallback(() => {
    setEditStep((prev) => Math.max(prev - 1, 1));
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingPet?.id) return;

    const trimmedName = String(editForm.name || '').trim();
    const trimmedBreed = String(editForm.breed_name || '').trim();
    const trimmedDescription = String(editForm.description || '').trim();
    const trimmedLocation = String(editForm.location || '').trim();

    if (!trimmedName || !trimmedBreed || !trimmedDescription || !trimmedLocation) {
      Alert.alert('Missing Information', 'Please complete Name, Breed, Description, and Location.');
      return;
    }

    try {
      setSaving(true);
      const adoptionFee = Number.parseFloat(editForm.adoption_fee);
      const ageYears = Number.parseInt(editForm.age_years, 10);
      const sanitizedImages = sanitizePetImagesForFirestore(editForm.images);

      const patch = {
        name: trimmedName,
        breed_name: trimmedBreed,
        description: trimmedDescription,
        location: trimmedLocation,
        adoption_fee: Number.isNaN(adoptionFee) ? 0 : adoptionFee,
        age_years: Number.isNaN(ageYears) ? 0 : ageYears,
        gender: String(editForm.gender || 'Unknown').trim() || 'Unknown',
        images: sanitizedImages,
        image: sanitizedImages.length > 0 ? sanitizedImages[0] : null,
        image_url: sanitizedImages.length > 0 ? sanitizedImages[0] : null,
        updated_at: serverTimestamp(),
      };

      await updateDoc(doc(db, 'pets', String(editingPet.id)), patch);

      setPets((prev) => prev.map((item) => (
        String(item.id) === String(editingPet.id)
          ? { ...item, ...patch, updated_at: new Date().toISOString() }
          : item
      )));

      Alert.alert('Updated', 'Pet information updated successfully.');
      closeEdit();
    } catch (error) {
      console.error('Error updating pet info:', error);
      Alert.alert('Error', 'Failed to update pet information. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [closeEdit, editForm, editingPet?.id]);

  const renderEditStepIndicator = () => (
    <View style={styles.editStepIndicatorContainer}>
      {[1, 2, 3].map((stepNumber) => (
        <View key={stepNumber} style={styles.editStepWrapper}>
          <View style={[styles.editStepCircle, editStep >= stepNumber && styles.editStepCircleActive]}>
            <Text style={[styles.editStepCircleText, editStep >= stepNumber && styles.editStepCircleTextActive]}>{stepNumber}</Text>
          </View>
          {stepNumber < EDIT_TOTAL_STEPS ? (
            <View style={[styles.editStepLine, editStep > stepNumber && styles.editStepLineActive]} />
          ) : null}
        </View>
      ))}
    </View>
  );

  const renderEditStepContent = () => {
    if (editStep === 1) {
      return (
        <View>
          <Text style={styles.inputLabel}>Pet Name</Text>
          <TextInput style={styles.input} value={editForm.name} onChangeText={(t) => updateEditField('name', t)} />

          <Text style={styles.inputLabel}>Breed</Text>
          <TextInput style={styles.input} value={editForm.breed_name} onChangeText={(t) => updateEditField('breed_name', t)} />

          <Text style={styles.inputLabel}>Age (Years)</Text>
          <TextInput style={styles.input} value={editForm.age_years} onChangeText={(t) => updateEditField('age_years', t)} keyboardType="number-pad" />

          <Text style={styles.inputLabel}>Gender</Text>
          <TextInput style={styles.input} value={editForm.gender} onChangeText={(t) => updateEditField('gender', t)} />

          <Text style={styles.inputLabel}>Adoption Fee</Text>
          <TextInput style={styles.input} value={editForm.adoption_fee} onChangeText={(t) => updateEditField('adoption_fee', t)} keyboardType="decimal-pad" />
        </View>
      );
    }

    if (editStep === 2) {
      return (
        <View>
          <Text style={styles.inputLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={editForm.description}
            onChangeText={(t) => updateEditField('description', t)}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Text style={styles.inputLabel}>Location</Text>
          <TextInput style={styles.input} value={editForm.location} onChangeText={(t) => updateEditField('location', t)} />
        </View>
      );
    }

    const images = Array.isArray(editForm.images) ? editForm.images : [];

    return (
      <View>
        <Text style={styles.inputLabel}>Pet Pictures</Text>
        <Text style={styles.imageHelpText}>Add or remove photos, then save to update the listing pictures.</Text>

        <View style={styles.imageActionsRow}>
          <TouchableOpacity style={styles.imageActionButton} onPress={() => pickEditImage(false)}>
            <Ionicons name="images-outline" size={16} color={COLORS.primary} />
            <Text style={styles.imageActionButtonText}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.imageActionButton} onPress={() => pickEditImage(true)}>
            <Ionicons name="camera-outline" size={16} color={COLORS.primary} />
            <Text style={styles.imageActionButtonText}>Camera</Text>
          </TouchableOpacity>
        </View>

        {images.length === 0 ? (
          <View style={styles.noImagesBox}>
            <Ionicons name="image-outline" size={28} color={COLORS.textLight} />
            <Text style={styles.noImagesText}>No picture selected yet.</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageListRow}>
            {images.map((uri, index) => (
              <View key={`${uri}-${index}`} style={styles.editImageCard}>
                <Image source={{ uri }} style={styles.editImage} />
                <TouchableOpacity style={styles.removeImageBtn} onPress={() => removeEditImage(index)}>
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    );
  };

  const cancelListing = useCallback((pet) => {
    Alert.alert(
      'Cancel Listing',
      `Cancel ${pet?.name || 'this pet'} from adoption listing?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'pets', String(pet.id)), {
                status: 'unavailable',
                adoption_listing_status: 'cancelled',
                updated_at: serverTimestamp(),
              });

              setPets((prev) => prev.map((item) => (
                String(item.id) === String(pet.id)
                  ? { ...item, status: 'unavailable', adoption_listing_status: 'cancelled', updated_at: new Date().toISOString() }
                  : item
              )));
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel listing. Please try again.');
            }
          },
        },
      ]
    );
  }, []);

  const relistPet = useCallback(async (pet) => {
    try {
      await updateDoc(doc(db, 'pets', String(pet.id)), {
        status: 'available',
        adoption_listing_status: 'listed',
        updated_at: serverTimestamp(),
      });

      setPets((prev) => prev.map((item) => (
        String(item.id) === String(pet.id)
          ? { ...item, status: 'available', adoption_listing_status: 'listed', updated_at: new Date().toISOString() }
          : item
      )));
    } catch (error) {
      Alert.alert('Error', 'Failed to relist pet. Please try again.');
    }
  }, []);

  const renderPetCard = (item) => {
    const isCancelled = isCancelledListing(item);
    const isAdopted = isAdoptedPet(item);
    const petImage = Array.isArray(item?.images) && item.images.length > 0 ? item.images[0] : null;

    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.cardTitle}>{item.name || 'Unnamed Pet'}</Text>
            <Text style={styles.cardSubTitle}>{item.breed_name || 'Mixed Breed'}</Text>
          </View>
          <View style={[styles.statusBadge, isAdopted ? styles.adoptedBadge : (isCancelled ? styles.cancelledBadge : styles.listedBadge)]}>
            <Text style={[styles.statusText, isAdopted ? styles.adoptedText : (isCancelled ? styles.cancelledText : styles.listedText)]}>
              {isAdopted ? 'Adopted' : (isCancelled ? 'Cancelled' : 'Listed')}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          {petImage ? (
            <Image source={{ uri: petImage }} style={styles.petImage} />
          ) : (
            <View style={styles.petImagePlaceholder}>
              <Ionicons name="paw" size={20} color={COLORS.textLight} />
            </View>
          )}
          <View style={styles.infoCol}>
            <Text style={styles.metaText}>Gender: {item.gender || 'Unknown'}</Text>
            <Text style={styles.metaText}>Age: {item.age_years || 0} year(s)</Text>
            <Text style={styles.metaText}>Adoption Fee: P{Number(item.adoption_fee || 0)}</Text>
            <Text style={styles.metaText}>Updated: {formatDate(item.updated_at || item.createdAt)}</Text>
            {isAdopted ? <Text style={styles.metaText}>Adopted by: {item._adopter_name || 'Unknown Adopter'}</Text> : null}
          </View>
        </View>

        <Text style={styles.metaText}>Location: {item.location || 'N/A'}</Text>

        <View style={styles.actionsRow}>
          {isAdopted ? (
            <TouchableOpacity style={styles.viewAdoptedButton} onPress={() => setViewingAdoptedPet(item)}>
              <Text style={styles.viewAdoptedButtonText}>View Adoption</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.editButton} onPress={() => openEdit(item)}>
                <Text style={styles.editButtonText}>Edit Info</Text>
              </TouchableOpacity>

              {isCancelled ? (
                <TouchableOpacity style={styles.relistButton} onPress={() => relistPet(item)}>
                  <Text style={styles.relistButtonText}>Relist</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.cancelButton} onPress={() => cancelListing(item)}>
                  <Text style={styles.cancelButtonText}>Cancel Listing</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Available Pets</Text>
          <Text style={styles.headerSubtitle}>{listedPets.length} listed, {cancelledPets.length} cancelled, {adoptedPets.length} adopted</Text>
        </View>
      </View>

      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'listed' && styles.tabButtonActive]}
          onPress={() => setActiveTab('listed')}
        >
          <Text style={[styles.tabText, activeTab === 'listed' && styles.tabTextActive]}>Listed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'cancelled' && styles.tabButtonActive]}
          onPress={() => setActiveTab('cancelled')}
        >
          <Text style={[styles.tabText, activeTab === 'cancelled' && styles.tabTextActive]}>Cancelled</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'adopted' && styles.tabButtonActive]}
          onPress={() => setActiveTab('adopted')}
        >
          <Text style={[styles.tabText, activeTab === 'adopted' && styles.tabTextActive]}>Adopted</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading shelter pets...</Text>
          </View>
        ) : visiblePets.length === 0 ? (
          <View style={styles.centerBox}>
            <Ionicons name="paw-outline" size={56} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>No Pets In This List</Text>
            <Text style={styles.emptyText}>
              {activeTab === 'listed'
                ? 'Pets listed for adoption will appear here.'
                : (activeTab === 'cancelled'
                  ? 'Cancelled adoption listings will appear here.'
                  : 'Adopted pets will appear here once adoptions are completed.')} 
            </Text>
          </View>
        ) : (
          <View style={styles.listWrap}>{visiblePets.map(renderPetCard)}</View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal visible={!!editingPet} transparent animationType="fade" onRequestClose={closeEdit}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Pet Information</Text>
              <TouchableOpacity onPress={closeEdit}>
                <Ionicons name="close" size={22} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            {renderEditStepIndicator()}

            <ScrollView style={styles.modalBody}>
              {renderEditStepContent()}
            </ScrollView>

            <View style={styles.modalFooterActions}>
              {editStep > 1 ? (
                <TouchableOpacity style={styles.wizardBackButton} onPress={prevEditStep} disabled={saving}>
                  <Text style={styles.wizardBackButtonText}>Back</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.wizardSpacer} />
              )}

              {editStep < EDIT_TOTAL_STEPS ? (
                <TouchableOpacity style={styles.wizardNextButton} onPress={nextEditStep} disabled={saving}>
                  <Text style={styles.wizardNextButtonText}>Next</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.saveButton} onPress={saveEdit} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!viewingAdoptedPet} transparent animationType="fade" onRequestClose={closeAdoptedView}>
        <View style={styles.modalOverlay}>
          <View style={styles.adoptedModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adoption Details</Text>
              <TouchableOpacity onPress={closeAdoptedView}>
                <Ionicons name="close" size={22} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {viewingAdoptedPet?.images?.[0] ? (
                <Image source={{ uri: viewingAdoptedPet.images[0] }} style={styles.adoptedPreviewImage} />
              ) : null}

              <View style={styles.adoptedInfoBox}>
                <Text style={styles.adoptedInfoTitle}>{viewingAdoptedPet?.name || 'Unnamed Pet'}</Text>
                <Text style={styles.adoptedInfoLine}>Breed: {viewingAdoptedPet?.breed_name || viewingAdoptedPet?.breed || 'N/A'}</Text>
                <Text style={styles.adoptedInfoLine}>Gender: {viewingAdoptedPet?.gender || 'Unknown'}</Text>
                <Text style={styles.adoptedInfoLine}>Age: {viewingAdoptedPet?.age_years ?? 0} year(s)</Text>
                <Text style={styles.adoptedInfoLine}>Original Shelter Location: {viewingAdoptedPet?.location || 'N/A'}</Text>
                <Text style={styles.adoptedInfoLine}>Adopted By: {viewingAdoptedPet?._adopter_name || 'Unknown Adopter'}</Text>
                <Text style={styles.adoptedInfoLine}>Adopter Email: {viewingAdoptedPet?._adopter_email || 'Not provided'}</Text>
                <Text style={styles.adoptedInfoLine}>Current Home Address: {viewingAdoptedPet?._adopter_address || 'Not provided'}</Text>
                <Text style={styles.adoptedInfoLine}>Adopted On: {formatDate(viewingAdoptedPet?._adoption_completed_at || viewingAdoptedPet?.adopted_at)}</Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooterActions}>
              <TouchableOpacity style={styles.saveButton} onPress={closeAdoptedView}>
                <Text style={styles.saveButtonText}>Close</Text>
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
  tabsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  tabButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: RADIUS.round,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.backgroundWhite,
  },
  tabButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}1A`,
  },
  tabText: {
    color: COLORS.textMedium,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  tabTextActive: {
    color: COLORS.primary,
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
    alignItems: 'center',
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
  listedBadge: {
    backgroundColor: '#DCFCE7',
  },
  cancelledBadge: {
    backgroundColor: '#FEE2E2',
  },
  adoptedBadge: {
    backgroundColor: '#E0ECFF',
  },
  statusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
  listedText: {
    color: '#166534',
  },
  cancelledText: {
    color: '#B91C1C',
  },
  adoptedText: {
    color: '#1D4ED8',
  },
  infoRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  infoCol: {
    flex: 1,
  },
  petImage: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
  },
  petImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  metaText: {
    marginTop: 2,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  editButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: `${COLORS.primary}44`,
    backgroundColor: `${COLORS.primary}14`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  cancelButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: RADIUS.md,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#B91C1C',
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  relistButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: RADIUS.md,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  relistButtonText: {
    color: '#166534',
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  viewAdoptedButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: RADIUS.md,
    backgroundColor: '#E0ECFF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewAdoptedButtonText: {
    color: '#1D4ED8',
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  modalCard: {
    maxHeight: '85%',
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.backgroundWhite,
    overflow: 'hidden',
  },
  adoptedModalCard: {
    maxHeight: '85%',
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.backgroundWhite,
    overflow: 'hidden',
  },
  adoptedPreviewImage: {
    width: '100%',
    height: 180,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    marginBottom: SPACING.sm,
  },
  adoptedInfoBox: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: 4,
  },
  adoptedInfoTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  adoptedInfoLine: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  modalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  editStepIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    gap: SPACING.xs,
  },
  editStepWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editStepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  editStepCircleActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  editStepCircleText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textMedium,
  },
  editStepCircleTextActive: {
    color: '#FFFFFF',
  },
  editStepLine: {
    width: 26,
    height: 2,
    backgroundColor: COLORS.borderLight,
    marginHorizontal: 4,
  },
  editStepLineActive: {
    backgroundColor: COLORS.primary,
  },
  modalBody: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  inputLabel: {
    marginTop: SPACING.sm,
    marginBottom: 4,
    color: COLORS.textMedium,
    fontSize: FONTS.sizes.sm,
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
    minHeight: 90,
  },
  imageHelpText: {
    marginTop: 4,
    color: COLORS.textMedium,
    fontSize: FONTS.sizes.xs,
  },
  imageActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  imageActionButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: `${COLORS.primary}44`,
    backgroundColor: `${COLORS.primary}14`,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  imageActionButtonText: {
    color: COLORS.primary,
    fontWeight: FONTS.weights.bold,
    fontSize: FONTS.sizes.sm,
  },
  noImagesBox: {
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderStyle: 'dashed',
    borderRadius: RADIUS.md,
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  noImagesText: {
    marginTop: 4,
    color: COLORS.textMedium,
    fontSize: FONTS.sizes.sm,
  },
  imageListRow: {
    marginTop: SPACING.sm,
    paddingRight: SPACING.md,
    gap: SPACING.sm,
  },
  editImageCard: {
    width: 96,
    height: 96,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  editImage: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.sm,
  },
  wizardSpacer: {
    flex: 1,
  },
  wizardBackButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.background,
  },
  wizardBackButtonText: {
    color: COLORS.textMedium,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  wizardNextButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  wizardNextButtonText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  saveButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
});

export default AvailablePetsScreen;
