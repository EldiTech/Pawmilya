import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import CONFIG from '../../config/config';
import {
  ADMIN_COLORS,
  PET_STATUS_CONFIG,
  useFadeAnimation,
  filterItems,
  getCountByField,
  getImageUrl as getImageUrlUtil,
} from './shared';

const STATUS_COLORS = PET_STATUS_CONFIG;

// Wrapper for image URL helper with placeholder fallback
const getImageUrl = (imagePath) => 
  getImageUrlUtil(imagePath, CONFIG.API_URL) || 'https://via.placeholder.com/80?text=🐾';

const AdminPetsScreen = ({ onGoBack, onNavigate, adminToken }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPet, setSelectedPet] = useState(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const { fadeAnim } = useFadeAnimation();

  // Memoized filtered list
  const filtered = useMemo(() => {
    let result = pets;
    
    // Search filter
    if (search) {
      result = result.filter(pet => 
        pet.name?.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    // Type/status filter
    if (filter === 'dog' || filter === 'cat') {
      result = result.filter(p => p.type?.toLowerCase() === filter);
    } else if (filter === 'adopted') {
      result = result.filter(p => p.status === 'adopted');
    }
    
    return result;
  }, [pets, search, filter]);

  // Memoized status counts
  const getStatusCount = useCallback((filterKey) => {
    if (filterKey === 'all') return pets.length;
    if (filterKey === 'dog' || filterKey === 'cat') {
      return pets.filter(p => p.type?.toLowerCase() === filterKey).length;
    }
    return pets.filter(p => p.status === filterKey).length;
  }, [pets]);

  useEffect(() => {
    fetchPets();
  }, [filter]);

  const fetchPets = useCallback(async () => {
    try {
      setLoading(true);
      let url = `${CONFIG.API_URL}/admin/pets?limit=50`;
      if (filter !== 'all') {
        url += `&status=${filter}`;
      }
      if (search) {
        url += `&search=${encodeURIComponent(search)}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();

      if (Array.isArray(data)) {
        setPets(data);
      }
    } catch (error) {
      console.error('Error fetching pets:', error);
      Alert.alert('Error', 'Failed to load pets');
    } finally {
      setLoading(false);
    }
  }, [filter, search, adminToken]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPets();
    setRefreshing(false);
  }, [fetchPets]);

  const handleSearch = useCallback(() => {
    fetchPets();
  }, [fetchPets]);

  const handleView = (pet) => {
    setSelectedPet(pet);
    setViewModalVisible(true);
  };

  const handleEdit = (pet) => {
    setSelectedPet(pet);
    setEditFormData({
      name: pet.name || '',
      breed_name: pet.breed || pet.breed_name || '',
      category_id: pet.category_id || (pet.type?.toLowerCase() === 'cat' ? 2 : 1),
      age_years: pet.age_years?.toString() || '',
      age_months: pet.age_months?.toString() || '',
      gender: pet.gender || '',
      size: pet.size || '',
      color: pet.color || '',
      description: pet.description || '',
      location: pet.location || '',
      adoption_fee: pet.adoption_fee?.toString() || '0',
      vaccination_status: pet.vaccination_status || 'not_vaccinated',
      is_neutered: pet.is_neutered || false,
      is_house_trained: pet.is_house_trained || false,
      is_good_with_kids: pet.is_good_with_kids || false,
      is_good_with_other_pets: pet.is_good_with_other_pets || false,
      special_needs: pet.special_needs || '',
      status: pet.status || 'available',
      is_featured: pet.is_featured || false,
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editFormData.name.trim()) {
      Alert.alert('Error', 'Pet name is required');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${CONFIG.API_URL}/admin/pets/${selectedPet.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editFormData.name.trim(),
          category_id: editFormData.category_id,
          breed_name: editFormData.breed_name.trim(),
          age_years: parseInt(editFormData.age_years) || 0,
          age_months: parseInt(editFormData.age_months) || 0,
          gender: editFormData.gender,
          size: editFormData.size?.trim() || '',
          color: editFormData.color?.trim() || '',
          description: editFormData.description?.trim() || '',
          location: editFormData.location?.trim() || '',
          adoption_fee: parseFloat(editFormData.adoption_fee) || 0,
          vaccination_status: editFormData.vaccination_status,
          is_neutered: editFormData.is_neutered,
          is_house_trained: editFormData.is_house_trained,
          is_good_with_kids: editFormData.is_good_with_kids,
          is_good_with_other_pets: editFormData.is_good_with_other_pets,
          special_needs: editFormData.special_needs?.trim() || '',
          status: editFormData.status,
          is_featured: editFormData.is_featured,
        }),
      });

      if (response.ok) {
        // Update local state
        setPets(pets.map(p => 
          p.id === selectedPet.id 
            ? { ...p, ...editFormData, adoption_fee: parseFloat(editFormData.adoption_fee) }
            : p
        ));
        setEditModalVisible(false);
        Alert.alert('Success', 'Pet information updated successfully');
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to update pet');
      }
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to update pet. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    Alert.alert(
      'Remove Pet',
      `Are you sure you want to remove ${name} from listings?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${CONFIG.API_URL}/admin/pets/${id}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${adminToken}`,
                  'Content-Type': 'application/json',
                },
              });
              if (!response.ok) {
                throw new Error('Failed to delete');
              }
              setPets(pets.filter(p => p.id !== id));
              Alert.alert('Removed', `${name} has been removed from listings`);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete pet');
            }
          }
        },
      ]
    );
  };

  const filters = [
    { key: 'all', label: 'All Pets', icon: 'apps' },
    { key: 'dog', label: 'Dog', icon: 'paw' },
    { key: 'cat', label: 'Cat', icon: 'paw' },
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
            <Text style={styles.headerTitle}>Pet Management</Text>
            <Text style={styles.headerSubtitle}>{pets.length} pets</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => onNavigate('addPet')} activeOpacity={0.8}>
            <LinearGradient
              colors={['#FFFFFF', '#F8F9FE']}
              style={styles.addBtnGradient}
            >
              <Ionicons name="add" size={26} color={ADMIN_COLORS.primary} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrap}>
          <View style={styles.searchIconWrap}>
            <Ionicons name="search" size={20} color={ADMIN_COLORS.primary} />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search pets by name..."
            placeholderTextColor={ADMIN_COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={22} color={ADMIN_COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {filters.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.chip, 
              filter === f.key && styles.chipActive
            ]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
              {f.label}
            </Text>
            <View style={[styles.chipCount, filter === f.key && styles.chipCountActive]}>
              <Text style={[styles.chipCountText, filter === f.key && styles.chipCountTextActive]}>
                {getStatusCount(f.key)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Pet List */}
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
            <Text style={styles.loadingText}>Loading pets...</Text>
          </View>
        ) : filtered.length > 0 ? (
          <Animated.View style={{ opacity: fadeAnim }}>
            {filtered.map((pet, index) => (
              <View key={pet.id} style={styles.card}>
                <View style={styles.cardContent}>
                  <View style={styles.cardImageWrap}>
                    <Image 
                      source={{ uri: getImageUrl(pet.image) }} 
                      style={styles.petImage} 
                    />
                    <View style={[
                      styles.statusIndicator, 
                      { backgroundColor: STATUS_COLORS[pet.status]?.text || '#999' }
                    ]} />
                  </View>
                  
                  <View style={styles.petInfo}>
                    <View style={styles.petNameRow}>
                      <Text style={styles.petName}>{pet.name}</Text>
                    </View>
                    <Text style={styles.petBreed}>{pet.breed || 'Unknown breed'}</Text>
                    
                    <View style={[
                      styles.statusBadge, 
                      { backgroundColor: STATUS_COLORS[pet.status]?.bg || '#F5F5F5' }
                    ]}>
                      <Ionicons 
                        name={STATUS_COLORS[pet.status]?.icon || 'ellipse'} 
                        size={14} 
                        color={STATUS_COLORS[pet.status]?.text || '#666'} 
                      />
                      <Text style={[
                        styles.statusText, 
                        { color: STATUS_COLORS[pet.status]?.text || '#666' }
                      ]}>
                        {STATUS_COLORS[pet.status]?.label || pet.status}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.actions}>
                  <TouchableOpacity 
                    style={styles.actionBtn} 
                    onPress={() => handleView(pet)} 
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={['#E8F5E9', '#C8E6C9']}
                      style={styles.actionBtnGradient}
                    >
                      <Ionicons name="eye-outline" size={18} color="#43A047" />
                      <Text style={[styles.actionBtnText, { color: '#43A047' }]}>View</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.actionBtn} 
                    onPress={() => handleEdit(pet)} 
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={['#E8F4FD', '#D6EAF8']}
                      style={styles.actionBtnGradient}
                    >
                      <Ionicons name="create-outline" size={18} color="#0984E3" />
                      <Text style={[styles.actionBtnText, { color: '#0984E3' }]}>Edit</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.actionBtn} 
                    onPress={() => handleDelete(pet.id, pet.name)} 
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={['#FFE8E8', '#FFCDD2']}
                      style={styles.actionBtnGradient}
                    >
                      <Ionicons name="trash-outline" size={18} color="#E53935" />
                      <Text style={[styles.actionBtnText, { color: '#E53935' }]}>Delete</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </Animated.View>
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="paw-outline" size={48} color={ADMIN_COLORS.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No pets found</Text>
            <Text style={styles.emptySubtitle}>Try adjusting your search or filters</Text>
            <TouchableOpacity 
              style={styles.emptyButton}
              onPress={() => {
                setSearch('');
                setFilter('all');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyButtonText}>Clear Filters</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Pet Detail Modal */}
      <Modal
        visible={viewModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setViewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedPet?.name}</Text>
              <TouchableOpacity 
                onPress={() => setViewModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={24} color={ADMIN_COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {selectedPet && (
                <>
                  <Image 
                    source={{ uri: getImageUrl(selectedPet.image) }} 
                    style={styles.modalPetImage} 
                  />

                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Basic Information</Text>
                    <View style={styles.detailRow}>
                      <View style={styles.detailItem}>
                        <Ionicons name="paw" size={16} color={ADMIN_COLORS.primary} />
                        <Text style={styles.detailLabel}>Type</Text>
                        <Text style={styles.detailValue}>{selectedPet.type || 'Unknown'}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Ionicons name="fitness" size={16} color={ADMIN_COLORS.primary} />
                        <Text style={styles.detailLabel}>Breed</Text>
                        <Text style={styles.detailValue}>{selectedPet.breed || 'Unknown'}</Text>
                      </View>
                    </View>
                    <View style={styles.detailRow}>
                      <View style={styles.detailItem}>
                        <Ionicons name={selectedPet.gender === 'Male' ? 'male' : 'female'} size={16} color={ADMIN_COLORS.primary} />
                        <Text style={styles.detailLabel}>Gender</Text>
                        <Text style={styles.detailValue}>{selectedPet.gender || 'Unknown'}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Ionicons name="calendar" size={16} color={ADMIN_COLORS.primary} />
                        <Text style={styles.detailLabel}>Age</Text>
                        <Text style={styles.detailValue}>{selectedPet.age || 'Unknown'}</Text>
                      </View>
                    </View>
                    <View style={styles.detailRow}>
                      <View style={styles.detailItem}>
                        <Ionicons name="resize" size={16} color={ADMIN_COLORS.primary} />
                        <Text style={styles.detailLabel}>Size</Text>
                        <Text style={styles.detailValue}>{selectedPet.size || 'Unknown'}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Ionicons name="color-palette" size={16} color={ADMIN_COLORS.primary} />
                        <Text style={styles.detailLabel}>Color</Text>
                        <Text style={styles.detailValue}>{selectedPet.color || 'Unknown'}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Health Information</Text>
                    <View style={styles.detailRow}>
                      <View style={styles.detailItem}>
                        <Ionicons name="medical" size={16} color={ADMIN_COLORS.primary} />
                        <Text style={styles.detailLabel}>Vaccination</Text>
                        <Text style={styles.detailValue}>{selectedPet.vaccination_status?.replace(/_/g, ' ') || 'Unknown'}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Ionicons name="cut" size={16} color={ADMIN_COLORS.primary} />
                        <Text style={styles.detailLabel}>Neutered</Text>
                        <Text style={styles.detailValue}>{selectedPet.is_neutered ? 'Yes' : 'No'}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Behavior</Text>
                    <View style={styles.tagsRow}>
                      <View style={[styles.tag, selectedPet.is_house_trained && styles.tagActive]}>
                        <Ionicons name="home" size={14} color={selectedPet.is_house_trained ? '#FFF' : ADMIN_COLORS.textMuted} />
                        <Text style={[styles.tagText, selectedPet.is_house_trained && styles.tagTextActive]}>House Trained</Text>
                      </View>
                      <View style={[styles.tag, selectedPet.is_good_with_kids && styles.tagActive]}>
                        <Ionicons name="people" size={14} color={selectedPet.is_good_with_kids ? '#FFF' : ADMIN_COLORS.textMuted} />
                        <Text style={[styles.tagText, selectedPet.is_good_with_kids && styles.tagTextActive]}>Good with Kids</Text>
                      </View>
                      <View style={[styles.tag, selectedPet.is_good_with_other_pets && styles.tagActive]}>
                        <Ionicons name="paw" size={14} color={selectedPet.is_good_with_other_pets ? '#FFF' : ADMIN_COLORS.textMuted} />
                        <Text style={[styles.tagText, selectedPet.is_good_with_other_pets && styles.tagTextActive]}>Good with Pets</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Location & Pricing</Text>
                    <View style={styles.detailRow}>
                      <View style={styles.detailItemFull}>
                        <Ionicons name="location" size={16} color={ADMIN_COLORS.primary} />
                        <Text style={styles.detailLabel}>Location</Text>
                        <Text style={styles.detailValue}>{selectedPet.location || 'Not specified'}</Text>
                      </View>
                    </View>
                    <View style={styles.detailRow}>
                      <View style={styles.detailItem}>
                        <Ionicons name="cash" size={16} color={ADMIN_COLORS.primary} />
                        <Text style={styles.detailLabel}>Adoption Fee</Text>
                        <Text style={styles.detailValue}>₱{selectedPet.adoption_fee || '0'}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Ionicons name="checkmark-circle" size={16} color={ADMIN_COLORS.primary} />
                        <Text style={styles.detailLabel}>Status</Text>
                        <Text style={styles.detailValue}>{selectedPet.status || 'Available'}</Text>
                      </View>
                    </View>
                  </View>

                  {selectedPet.description && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Description</Text>
                      <Text style={styles.descriptionText}>{selectedPet.description}</Text>
                    </View>
                  )}

                  {selectedPet.special_needs && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Special Needs</Text>
                      <Text style={styles.descriptionText}>{selectedPet.special_needs}</Text>
                    </View>
                  )}

                  <View style={{ height: 20 }} />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Pet Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit {selectedPet?.name}</Text>
              <TouchableOpacity 
                onPress={() => setEditModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={24} color={ADMIN_COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.editForm}>
                <Text style={styles.editSectionTitle}>Basic Information</Text>
                
                <View style={styles.editFormGroup}>
                  <Text style={styles.editLabel}>Pet Name *</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editFormData.name}
                    onChangeText={(text) => setEditFormData({ ...editFormData, name: text })}
                    placeholder="Enter pet name"
                    placeholderTextColor={ADMIN_COLORS.textMuted}
                  />
                </View>

                <View style={styles.editFormGroup}>
                  <Text style={styles.editLabel}>Category</Text>
                  <View style={styles.statusButtons}>
                    {[{ id: 1, name: 'Dog' }, { id: 2, name: 'Cat' }].map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.statusButton,
                          editFormData.category_id === cat.id && styles.statusButtonActive
                        ]}
                        onPress={() => setEditFormData({ ...editFormData, category_id: cat.id })}
                      >
                        <Text style={[
                          styles.statusButtonText,
                          editFormData.category_id === cat.id && styles.statusButtonTextActive
                        ]}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.editFormGroup}>
                  <Text style={styles.editLabel}>Breed</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editFormData.breed_name}
                    onChangeText={(text) => setEditFormData({ ...editFormData, breed_name: text })}
                    placeholder="Enter breed"
                    placeholderTextColor={ADMIN_COLORS.textMuted}
                  />
                </View>

                <View style={styles.editFormRow}>
                  <View style={[styles.editFormGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.editLabel}>Age (Years)</Text>
                    <TextInput
                      style={styles.editInput}
                      value={editFormData.age_years}
                      onChangeText={(text) => setEditFormData({ ...editFormData, age_years: text })}
                      placeholder="0"
                      placeholderTextColor={ADMIN_COLORS.textMuted}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.editFormGroup, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.editLabel}>Age (Months)</Text>
                    <TextInput
                      style={styles.editInput}
                      value={editFormData.age_months}
                      onChangeText={(text) => setEditFormData({ ...editFormData, age_months: text })}
                      placeholder="0"
                      placeholderTextColor={ADMIN_COLORS.textMuted}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.editFormRow}>
                  <View style={[styles.editFormGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.editLabel}>Gender</Text>
                    <View style={styles.genderButtons}>
                      {['Male', 'Female'].map((gender) => (
                        <TouchableOpacity
                          key={gender}
                          style={[
                            styles.genderButton,
                            editFormData.gender === gender && styles.statusButtonActive
                          ]}
                          onPress={() => setEditFormData({ ...editFormData, gender })}
                        >
                          <Text style={[
                            styles.statusButtonText,
                            editFormData.gender === gender && styles.statusButtonTextActive
                          ]}>
                            {gender}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.editFormRow}>
                  <View style={[styles.editFormGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.editLabel}>Size</Text>
                    <TextInput
                      style={styles.editInput}
                      value={editFormData.size}
                      onChangeText={(text) => setEditFormData({ ...editFormData, size: text })}
                      placeholder="e.g., Small, Medium, Large"
                      placeholderTextColor={ADMIN_COLORS.textMuted}
                    />
                  </View>
                  <View style={[styles.editFormGroup, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.editLabel}>Color</Text>
                    <TextInput
                      style={styles.editInput}
                      value={editFormData.color}
                      onChangeText={(text) => setEditFormData({ ...editFormData, color: text })}
                      placeholder="Enter color"
                      placeholderTextColor={ADMIN_COLORS.textMuted}
                    />
                  </View>
                </View>

                <View style={styles.editFormGroup}>
                  <Text style={styles.editLabel}>Description</Text>
                  <TextInput
                    style={[styles.editInput, styles.editTextArea]}
                    value={editFormData.description}
                    onChangeText={(text) => setEditFormData({ ...editFormData, description: text })}
                    placeholder="Enter description"
                    placeholderTextColor={ADMIN_COLORS.textMuted}
                    multiline
                    numberOfLines={4}
                  />
                </View>

                <Text style={styles.editSectionTitle}>Health Information</Text>

                <View style={styles.editFormGroup}>
                  <Text style={styles.editLabel}>Vaccination Status</Text>
                  <View style={styles.statusButtons}>
                    {['fully_vaccinated', 'partially_vaccinated', 'not_vaccinated', 'unknown'].map((status) => (
                      <TouchableOpacity
                        key={status}
                        style={[
                          styles.vaccinationButton,
                          editFormData.vaccination_status === status && styles.statusButtonActive
                        ]}
                        onPress={() => setEditFormData({ ...editFormData, vaccination_status: status })}
                      >
                        <Text style={[
                          styles.statusButtonText,
                          editFormData.vaccination_status === status && styles.statusButtonTextActive
                        ]}>
                          {status.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.editFormGroup}>
                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setEditFormData({ ...editFormData, is_neutered: !editFormData.is_neutered })}
                  >
                    <Ionicons
                      name={editFormData.is_neutered ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={editFormData.is_neutered ? ADMIN_COLORS.primary : ADMIN_COLORS.textMuted}
                    />
                    <Text style={styles.checkboxLabel}>Neutered/Spayed</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.editSectionTitle}>Behavior & Temperament</Text>

                <View style={styles.editFormGroup}>
                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setEditFormData({ ...editFormData, is_house_trained: !editFormData.is_house_trained })}
                  >
                    <Ionicons
                      name={editFormData.is_house_trained ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={editFormData.is_house_trained ? ADMIN_COLORS.primary : ADMIN_COLORS.textMuted}
                    />
                    <Text style={styles.checkboxLabel}>House Trained</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.editFormGroup}>
                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setEditFormData({ ...editFormData, is_good_with_kids: !editFormData.is_good_with_kids })}
                  >
                    <Ionicons
                      name={editFormData.is_good_with_kids ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={editFormData.is_good_with_kids ? ADMIN_COLORS.primary : ADMIN_COLORS.textMuted}
                    />
                    <Text style={styles.checkboxLabel}>Good with Kids</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.editFormGroup}>
                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setEditFormData({ ...editFormData, is_good_with_other_pets: !editFormData.is_good_with_other_pets })}
                  >
                    <Ionicons
                      name={editFormData.is_good_with_other_pets ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={editFormData.is_good_with_other_pets ? ADMIN_COLORS.primary : ADMIN_COLORS.textMuted}
                    />
                    <Text style={styles.checkboxLabel}>Good with Other Pets</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.editFormGroup}>
                  <Text style={styles.editLabel}>Special Needs</Text>
                  <TextInput
                    style={[styles.editInput, styles.editTextArea]}
                    value={editFormData.special_needs}
                    onChangeText={(text) => setEditFormData({ ...editFormData, special_needs: text })}
                    placeholder="Any special needs or medical conditions"
                    placeholderTextColor={ADMIN_COLORS.textMuted}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <Text style={styles.editSectionTitle}>Location & Adoption</Text>

                <View style={styles.editFormGroup}>
                  <Text style={styles.editLabel}>Location</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editFormData.location}
                    onChangeText={(text) => setEditFormData({ ...editFormData, location: text })}
                    placeholder="Enter location"
                    placeholderTextColor={ADMIN_COLORS.textMuted}
                  />
                </View>

                <View style={styles.editFormGroup}>
                  <Text style={styles.editLabel}>Adoption Fee (₱)</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editFormData.adoption_fee}
                    onChangeText={(text) => setEditFormData({ ...editFormData, adoption_fee: text })}
                    placeholder="0"
                    placeholderTextColor={ADMIN_COLORS.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.editFormGroup}>
                  <Text style={styles.editLabel}>Adoption Status</Text>
                  <View style={styles.statusButtons}>
                    {['available', 'pending', 'adopted'].map((status) => (
                      <TouchableOpacity
                        key={status}
                        style={[
                          styles.statusButton,
                          editFormData.status === status && styles.statusButtonActive
                        ]}
                        onPress={() => setEditFormData({ ...editFormData, status })}
                      >
                        <Text style={[
                          styles.statusButtonText,
                          editFormData.status === status && styles.statusButtonTextActive
                        ]}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.editFormGroup}>
                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setEditFormData({ ...editFormData, is_featured: !editFormData.is_featured })}
                  >
                    <Ionicons
                      name={editFormData.is_featured ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={editFormData.is_featured ? ADMIN_COLORS.primary : ADMIN_COLORS.textMuted}
                    />
                    <Text style={styles.checkboxLabel}>Featured Pet</Text>
                  </TouchableOpacity>
                  <Text style={styles.toggleDescription}>Show this pet on the featured section</Text>
                </View>

                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveEdit}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[ADMIN_COLORS.primary, ADMIN_COLORS.primaryDark]}
                    style={styles.saveButtonGradient}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={{ height: 30 }} />
              </View>
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
  headerGradient: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 12 : 56,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
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
  decorEmoji: {
    fontSize: 36,
  },
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
  headerTitleWrap: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: { 
    fontSize: 22, 
    fontWeight: '800', 
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
    fontWeight: '500',
  },
  addBtn: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  addBtnGradient: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ADMIN_COLORS.card,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  searchIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFF5EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInput: { 
    flex: 1, 
    fontSize: 15, 
    color: ADMIN_COLORS.text, 
    marginLeft: 12,
    marginRight: 8,
    fontWeight: '500',
  },
  clearBtn: {
    padding: 8,
  },
  filterRow: { 
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginTop: 16, 
    marginBottom: 12,
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1.5,
    borderColor: ADMIN_COLORS.border,
  },
  chipActive: { 
    backgroundColor: ADMIN_COLORS.primary,
    borderColor: ADMIN_COLORS.primary,
    shadowColor: ADMIN_COLORS.primary,
    shadowOpacity: 0.3,
  },
  chipEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  chipText: { 
    fontSize: 14, 
    color: ADMIN_COLORS.textLight,
    fontWeight: '600',
  },
  chipTextActive: { 
    color: '#FFFFFF',
  },
  chipCount: {
    marginLeft: 8,
    backgroundColor: ADMIN_COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  chipCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  chipCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: ADMIN_COLORS.textLight,
  },
  chipCountTextActive: {
    color: '#FFFFFF',
  },
  list: { 
    flex: 1, 
    paddingHorizontal: 20, 
    paddingTop: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: ADMIN_COLORS.card,
    padding: 16,
    borderRadius: 20,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardImageWrap: {
    position: 'relative',
  },
  petImage: { 
    width: 72, 
    height: 72, 
    borderRadius: 18,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: ADMIN_COLORS.card,
  },
  petInfo: { 
    flex: 1, 
    marginLeft: 16,
  },
  petNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  petName: { 
    fontSize: 17, 
    fontWeight: '700', 
    color: ADMIN_COLORS.text,
  },
  petEmoji: {
    fontSize: 14,
    marginLeft: 6,
  },
  petBreed: { 
    fontSize: 13, 
    color: ADMIN_COLORS.textLight, 
    marginTop: 4,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 10,
  },
  statusText: { 
    fontSize: 12, 
    fontWeight: '600',
    marginLeft: 5,
  },
  actions: { 
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 24,
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
  loadingText: {
    fontSize: 16,
    color: ADMIN_COLORS.textLight,
    fontWeight: '600',
  },
  loadingEmoji: {
    fontSize: 28,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 24,
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
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: ADMIN_COLORS.textLight,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: ADMIN_COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: ADMIN_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: ADMIN_COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ADMIN_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    paddingHorizontal: 20,
  },
  modalPetImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginTop: 16,
    backgroundColor: ADMIN_COLORS.background,
  },
  detailSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: ADMIN_COLORS.background,
    borderRadius: 16,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
  },
  detailItemFull: {
    flex: 1,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: ADMIN_COLORS.textMuted,
    marginTop: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: ADMIN_COLORS.text,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: ADMIN_COLORS.card,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    gap: 6,
  },
  tagActive: {
    backgroundColor: ADMIN_COLORS.primary,
    borderColor: ADMIN_COLORS.primary,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: ADMIN_COLORS.textMuted,
  },
  tagTextActive: {
    color: '#FFFFFF',
  },
  descriptionText: {
    fontSize: 14,
    color: ADMIN_COLORS.textLight,
    lineHeight: 22,
  },
  // Edit Modal Styles
  editForm: {
    paddingVertical: 16,
  },
  editFormGroup: {
    marginBottom: 20,
  },
  editFormRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  editSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
    marginTop: 16,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: ADMIN_COLORS.primary,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: ADMIN_COLORS.text,
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: ADMIN_COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: ADMIN_COLORS.text,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  editTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: ADMIN_COLORS.background,
    borderWidth: 1.5,
    borderColor: ADMIN_COLORS.border,
    alignItems: 'center',
  },
  genderButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: ADMIN_COLORS.background,
    borderWidth: 1.5,
    borderColor: ADMIN_COLORS.border,
    alignItems: 'center',
  },
  statusButtonActive: {
    backgroundColor: ADMIN_COLORS.primary,
    borderColor: ADMIN_COLORS.primary,
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: ADMIN_COLORS.textLight,
  },
  statusButtonTextActive: {
    color: '#FFFFFF',
  },
  vaccinationButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: ADMIN_COLORS.background,
    borderWidth: 1.5,
    borderColor: ADMIN_COLORS.border,
    alignItems: 'center',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  checkboxLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: ADMIN_COLORS.text,
  },
  toggleDescription: {
    fontSize: 13,
    color: ADMIN_COLORS.textMuted,
    marginTop: 4,
    marginLeft: 36,
  },
  saveButton: {
    marginTop: 10,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: ADMIN_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default memo(AdminPetsScreen);
