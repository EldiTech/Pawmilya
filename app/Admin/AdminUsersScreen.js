import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import CONFIG from '../../config/config';
import { db } from '../../firebaseConfig';
import {
  ADMIN_COLORS,
  USER_STATUS_CONFIG,
  filterItems,
  formatDate,
  generateAvatarUrl,
  getCountByField,
  getImageUrl as getImageUrlUtil,
  useFadeAnimation,
} from './shared';

const STATUS_CONFIG = USER_STATUS_CONFIG;

// Wrapper for image URL helper
const getImageUrl = (imagePath) => getImageUrlUtil(imagePath, CONFIG.API_URL);

const AdminUsersScreen = ({ onGoBack, adminToken }) => {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { fadeAnim } = useFadeAnimation();
  
  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    status: 'active',
  });

  // Memoized filtered list
  const filtered = useMemo(() => 
    filterItems(users, {
      searchQuery: search,
      searchFields: ['name', 'email'],
      filterKey: 'all',
      filterField: 'status',
    }),
    [users, search]
  );

  // Memoized status counts
  const getStatusCount = useCallback((status) => 
    getCountByField(users, 'status', status),
    [users]
  );

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, 'users'));
      
      const formattedUsers = snapshot.docs.map(doc => {
        const user = doc.data();
        return {
          id: doc.id,
          name: user.full_name || user.name || 'Unknown',
          email: user.email || '',
          phone: user.phone || '',
          avatar: user.avatar_url || '',
          status: user.status || 'active',
          role: user.role || 'user',
          createdAt: user.created_at || user.createdAt,
        };
      }).filter(user => user.role !== 'admin');
      
      setUsers(formattedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  }, [fetchUsers]);

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      password: '',
      status: 'active',
    });
    setEditingUser(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      full_name: user.name,
      email: user.email,
      phone: user.phone || '',
      password: '',
      status: user.status,
    });
    setModalVisible(true);
  };

  const openDetailModal = (user) => {
    setSelectedUser(user);
    setDetailModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    resetForm();
  };

  const handleSave = async () => {
    if (!formData.full_name || !formData.email) {
      Alert.alert('Validation Error', 'Name and email are required');
      return;
    }

    if (!editingUser && !formData.password) {
      Alert.alert('Validation Error', 'Password is required for new users');
      return;
    }

    try {
      setSaving(true);
      
      if (editingUser) {
        const userRef = doc(db, 'users', editingUser.id);
        const updateData = {
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          status: formData.status,
        };
        await updateDoc(userRef, updateData);
        
        setUsers(users.map(u => 
          u.id === editingUser.id 
            ? { ...u, name: formData.full_name, email: formData.email, phone: formData.phone, status: formData.status }
            : u
        ));
        Alert.alert('Success', 'User updated successfully');
      } else {
        // Without cloud functions, we can't reliably create Firebase Auth users from the client SDK (as it logs out the admin).
        // For frontend prototyping, we will simulate user creation by writing to Firestore.
        // It won't create a functional auth user unless a cloud function or proper backend exists.
        const addData = {
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          status: formData.status,
          role: 'user',
          created_at: new Date().toISOString()
        };
        const importAddDoc = require('firebase/firestore').addDoc;
        const newDocRef = await importAddDoc(collection(db, 'users'), addData);
        
        const newUser = {
          id: newDocRef.id,
          name: addData.full_name,
          email: addData.email,
          phone: addData.phone || '',
          avatar: '',
          status: addData.status,
          role: 'user',
          createdAt: addData.created_at,
        };
        setUsers([newUser, ...users]);
        Alert.alert('Success', 'User created successfully');
      }
      
      closeModal();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (user) => {
    Alert.alert(
      'Remove User',
      `Are you sure you want to remove ${user.name}?\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'users', user.id));
              setUsers(users.filter(u => u.id !== user.id));
              Alert.alert('Success', `${user.name} has been removed`);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete user');
            }
          }
        },
      ]
    );
  };

  const handleToggleStatus = (user) => {
    const action = user.status === 'active' ? 'Suspend' : 'Activate';
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    
    Alert.alert(
      `${action} User`,
      `Are you sure you want to ${action.toLowerCase()} ${user.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: action,
          style: user.status === 'active' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'users', user.id), { status: newStatus });
              setUsers(users.map(u => 
                u.id === user.id ? { ...u, status: newStatus } : u
              ));
              Alert.alert('Success', `${user.name} has been ${action.toLowerCase()}${action === 'Suspend' ? 'ed' : 'd'}`);
            } catch (error) {
              Alert.alert('Error', 'Failed to update user status');
            }
          }
        },
      ]
    );
  };

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
            <Text style={styles.headerTitle}>User Management</Text>
            <Text style={styles.headerSubtitle}>Manage all user accounts</Text>
          </View>
          <TouchableOpacity onPress={openAddModal} style={styles.addBtn} activeOpacity={0.8}>
            <LinearGradient
              colors={['#FFFFFF', '#F8F9FE']}
              style={styles.addBtnGradient}
            >
              <Ionicons name="person-add" size={24} color={ADMIN_COLORS.primary} />
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
            placeholder="Search by name or email..."
            placeholderTextColor={ADMIN_COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={22} color={ADMIN_COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <LinearGradient
            colors={['#E8F4FD', '#D6EAF8']}
            style={styles.statCardGradient}
          >
            <Ionicons name="people" size={22} color="#0984E3" style={styles.statIcon} />
            <Text style={styles.statNum}>{users.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </LinearGradient>
        </View>
        <View style={styles.statCard}>
          <LinearGradient
            colors={['#E8FFF3', '#D4F5E7']}
            style={styles.statCardGradient}
          >
            <Ionicons name="checkmark-circle" size={22} color="#00B894" style={styles.statIcon} />
            <Text style={styles.statNum}>{getStatusCount('active')}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </LinearGradient>
        </View>
        <View style={styles.statCard}>
          <LinearGradient
            colors={['#FFF0E8', '#FFE4D4']}
            style={styles.statCardGradient}
          >
            <Ionicons name="ban" size={22} color="#E17055" style={styles.statIcon} />
            <Text style={styles.statNum}>{getStatusCount('suspended')}</Text>
            <Text style={styles.statLabel}>Suspended</Text>
          </LinearGradient>
        </View>
      </View>

      {/* Users List */}
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
            <Text style={styles.loadingText}>Loading users...</Text>
          </View>
        ) : filtered.length > 0 ? (
          <Animated.View style={{ opacity: fadeAnim }}>
            {filtered.map((user, index) => (
              <TouchableOpacity 
                key={user.id} 
                style={styles.card}
                onPress={() => openDetailModal(user)}
                activeOpacity={0.7}
              >
                <View style={styles.cardContent}>
                  <View style={styles.cardLeft}>
                    <View style={styles.avatarWrap}>
                      <Image source={{ uri: getImageUrl(user.avatar) || generateAvatarUrl(user.name) }} style={styles.avatar} />
                      <View style={[
                        styles.statusIndicator, 
                        { backgroundColor: STATUS_CONFIG[user.status]?.color || '#999' }
                      ]} />
                    </View>
                    
                    <View style={styles.userInfo}>
                      <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
                      <View style={styles.emailRow}>
                        <Ionicons name="mail-outline" size={14} color={ADMIN_COLORS.textMuted} />
                        <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
                      </View>
                      <View style={[
                        styles.statusBadge, 
                        { backgroundColor: STATUS_CONFIG[user.status]?.bg || '#F5F5F5' }
                      ]}>
                        <Ionicons 
                          name={STATUS_CONFIG[user.status]?.icon || 'ellipse'} 
                          size={12} 
                          color={STATUS_CONFIG[user.status]?.color || '#999'} 
                        />
                        <Text style={[
                          styles.statusText, 
                          { color: STATUS_CONFIG[user.status]?.color || '#999' }
                        ]}>
                          {STATUS_CONFIG[user.status]?.label || user.status}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.actionBtns}>
                    <TouchableOpacity 
                      style={styles.actionBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        openEditModal(user);
                      }}
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={['#E8F4FD', '#D6EAF8']}
                        style={styles.actionBtnGradient}
                      >
                        <Ionicons name="create-outline" size={18} color="#0984E3" />
                      </LinearGradient>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.actionBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleToggleStatus(user);
                      }}
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={user.status === 'active' ? ['#FFF3E0', '#FFE4B3'] : ['#E8FFF3', '#D4F5E7']}
                        style={styles.actionBtnGradient}
                      >
                        <Ionicons 
                          name={user.status === 'active' ? 'ban' : 'play'} 
                          size={18} 
                          color={user.status === 'active' ? '#FB8C00' : '#00B894'} 
                        />
                      </LinearGradient>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.actionBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDelete(user);
                      }}
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={['#FFE8E8', '#FFCDD2']}
                        style={styles.actionBtnGradient}
                      >
                        <Ionicons name="trash-outline" size={18} color="#E53935" />
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </Animated.View>
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="people-outline" size={48} color={ADMIN_COLORS.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No users found</Text>
            <Text style={styles.emptySubtitle}>Try adjusting your search</Text>
            <TouchableOpacity 
              style={styles.emptyButton}
              onPress={() => setSearch('')}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyButtonText}>Clear Search</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* User Detail Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.detailModalOverlay}>
          <View style={styles.detailModalContent}>
            {selectedUser ? (
              <>
                {/* Header with Avatar */}
                <LinearGradient
                  colors={[ADMIN_COLORS.primary, ADMIN_COLORS.primaryDark]}
                  style={styles.detailModalHeader}
                >
                  <TouchableOpacity 
                    onPress={() => setDetailModalVisible(false)} 
                    style={styles.detailCloseBtn}
                  >
                    <Ionicons name="close" size={24} color="#FFF" />
                  </TouchableOpacity>
                  
                  <View style={styles.detailHeaderContent}>
                    <Image source={{ uri: getImageUrl(selectedUser.avatar) || generateAvatarUrl(selectedUser.name) }} style={styles.detailAvatar} />
                    <Text style={styles.detailName}>{selectedUser.name}</Text>
                    <View style={[
                      styles.detailStatusBadge,
                      { backgroundColor: STATUS_CONFIG[selectedUser.status]?.bg || '#F5F5F5' }
                    ]}>
                      <Ionicons 
                        name={STATUS_CONFIG[selectedUser.status]?.icon} 
                        size={14} 
                        color={STATUS_CONFIG[selectedUser.status]?.color} 
                      />
                      <Text style={[
                        styles.detailStatusText,
                        { color: STATUS_CONFIG[selectedUser.status]?.color }
                      ]}>
                        {STATUS_CONFIG[selectedUser.status]?.label}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>

                {/* Body Content */}
                <View style={styles.detailBody}>
                  <View style={styles.detailInfoRow}>
                    <View style={styles.detailInfoItem}>
                      <Ionicons name="mail-outline" size={18} color={ADMIN_COLORS.primary} />
                      <View style={styles.detailInfoTextWrap}>
                        <Text style={styles.detailInfoLabel}>Email</Text>
                        <Text style={styles.detailInfoValue} numberOfLines={1}>{selectedUser.email}</Text>
                      </View>
                    </View>

                    <View style={styles.detailInfoItem}>
                      <Ionicons name="call-outline" size={18} color={ADMIN_COLORS.primary} />
                      <View style={styles.detailInfoTextWrap}>
                        <Text style={styles.detailInfoLabel}>Phone</Text>
                        <Text style={styles.detailInfoValue}>{selectedUser.phone || 'N/A'}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.detailInfoRow}>
                    <View style={styles.detailInfoItem}>
                      <Ionicons name="calendar-outline" size={18} color={ADMIN_COLORS.primary} />
                      <View style={styles.detailInfoTextWrap}>
                        <Text style={styles.detailInfoLabel}>Joined</Text>
                        <Text style={styles.detailInfoValue}>{formatDate(selectedUser.createdAt)}</Text>
                      </View>
                    </View>

                    <View style={styles.detailInfoItem}>
                      <Ionicons name="shield-checkmark-outline" size={18} color={ADMIN_COLORS.primary} />
                      <View style={styles.detailInfoTextWrap}>
                        <Text style={styles.detailInfoLabel}>Role</Text>
                        <Text style={styles.detailInfoValue}>{selectedUser.role?.charAt(0).toUpperCase() + selectedUser.role?.slice(1) || 'User'}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.detailActionButtons}>
                    <TouchableOpacity 
                      style={styles.detailActionBtnCompact}
                      onPress={() => {
                        setDetailModalVisible(false);
                        openEditModal(selectedUser);
                      }}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#E8F4FD', '#D6EAF8']}
                        style={styles.detailActionBtnGradient}
                      >
                        <Ionicons name="create-outline" size={20} color="#0984E3" />
                        <Text style={[styles.detailActionBtnText, { color: '#0984E3' }]}>Edit</Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.detailActionBtnCompact}
                      onPress={() => {
                        setDetailModalVisible(false);
                        handleToggleStatus(selectedUser);
                      }}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={selectedUser.status === 'active' ? ['#FFF3E0', '#FFE4B3'] : ['#E8FFF3', '#D4F5E7']}
                        style={styles.detailActionBtnGradient}
                      >
                        <Ionicons 
                          name={selectedUser.status === 'active' ? 'ban' : 'play-circle'} 
                          size={20} 
                          color={selectedUser.status === 'active' ? '#FB8C00' : '#00B894'} 
                        />
                        <Text style={[
                          styles.detailActionBtnText, 
                          { color: selectedUser.status === 'active' ? '#FB8C00' : '#00B894' }
                        ]}>
                          {selectedUser.status === 'active' ? 'Suspend' : 'Activate'}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.detailActionBtnCompact}
                      onPress={() => {
                        setDetailModalVisible(false);
                        handleDelete(selectedUser);
                      }}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#FFE8E8', '#FFCDD2']}
                        style={styles.detailActionBtnGradient}
                      >
                        <Ionicons name="trash-outline" size={20} color="#E53935" />
                        <Text style={[styles.detailActionBtnText, { color: '#E53935' }]}>Delete</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={[ADMIN_COLORS.primary, ADMIN_COLORS.primaryDark]}
              style={styles.modalHeaderGradient}
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <View style={styles.modalIconWrap}>
                    <Ionicons name={editingUser ? "create" : "person-add"} size={24} color="#FFF" />
                  </View>
                  <View style={styles.modalHeaderTextWrap}>
                    <Text style={styles.modalTitle}>
                      {editingUser ? 'Edit User' : 'Add New User'}
                    </Text>
                    <Text style={styles.modalSubtitle}>
                      {editingUser ? 'Update user information' : 'Create a new user account'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={closeModal} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={22} color="#FFF" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name *</Text>
                <View style={styles.inputWrap}>
                  <View style={styles.inputIconWrap}>
                    <Ionicons name="person-outline" size={20} color={ADMIN_COLORS.primary} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter full name"
                    placeholderTextColor={ADMIN_COLORS.textMuted}
                    value={formData.full_name}
                    onChangeText={(text) => setFormData({ ...formData, full_name: text })}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email Address *</Text>
                <View style={styles.inputWrap}>
                  <View style={styles.inputIconWrap}>
                    <Ionicons name="mail-outline" size={20} color={ADMIN_COLORS.primary} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter email address"
                    placeholderTextColor={ADMIN_COLORS.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={formData.email}
                    onChangeText={(text) => setFormData({ ...formData, email: text })}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <View style={styles.inputWrap}>
                  <View style={styles.inputIconWrap}>
                    <Ionicons name="call-outline" size={20} color={ADMIN_COLORS.primary} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter phone number (optional)"
                    placeholderTextColor={ADMIN_COLORS.textMuted}
                    keyboardType="phone-pad"
                    value={formData.phone}
                    onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  />
                </View>
              </View>

              {!editingUser && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Password *</Text>
                  <View style={styles.inputWrap}>
                    <View style={styles.inputIconWrap}>
                      <Ionicons name="lock-closed-outline" size={20} color={ADMIN_COLORS.primary} />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter secure password"
                      placeholderTextColor={ADMIN_COLORS.textMuted}
                      secureTextEntry
                      value={formData.password}
                      onChangeText={(text) => setFormData({ ...formData, password: text })}
                    />
                  </View>
                  <Text style={styles.inputHint}>Minimum 6 characters required</Text>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Account Status</Text>
                <View style={styles.statusToggle}>
                    <TouchableOpacity
                      style={[
                        styles.statusOption, 
                        formData.status === 'active' && styles.statusOptionActive
                      ]}
                      onPress={() => setFormData({ ...formData, status: 'active' })}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.statusIconWrap,
                        formData.status === 'active' && styles.statusIconWrapActive
                      ]}>
                        <Ionicons 
                          name="checkmark-circle" 
                          size={20} 
                          color="#00B894"
                        />
                      </View>
                      <Text style={[
                        styles.statusOptionText, 
                        formData.status === 'active' && styles.statusOptionTextActive
                      ]}>
                        Active
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.statusOption, 
                        formData.status === 'suspended' && styles.statusOptionSuspended
                      ]}
                      onPress={() => setFormData({ ...formData, status: 'suspended' })}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.statusIconWrap,
                        formData.status === 'suspended' && styles.statusIconWrapSuspended
                      ]}>
                        <Ionicons 
                          name="ban" 
                          size={20} 
                          color="#E17055"
                        />
                      </View>
                      <Text style={[
                        styles.statusOptionText, 
                        formData.status === 'suspended' && { color: '#E17055' }
                      ]}>
                        Suspended
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={closeModal} 
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle-outline" size={20} color={ADMIN_COLORS.textLight} />
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]} 
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[ADMIN_COLORS.primary, ADMIN_COLORS.primaryDark]}
                  style={styles.saveBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                      <Text style={styles.saveBtnText}>
                        {editingUser ? 'Update User' : 'Create User'}
                      </Text>
                    </>
                  )}
                </LinearGradient>
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
  headerGradient: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 12 : 56,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
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
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statCardGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  statIcon: {
    marginBottom: 8,
  },
  statNum: { 
    fontSize: 24, 
    fontWeight: '800', 
    color: ADMIN_COLORS.text,
  },
  statLabel: { 
    fontSize: 11, 
    color: ADMIN_COLORS.textLight, 
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterSection: {
    marginTop: 20,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
  },
  filterSubtitle: {
    fontSize: 13,
    color: ADMIN_COLORS.textMuted,
    fontWeight: '500',
  },
  filterScroll: {
    paddingLeft: 20,
  },
  filterContent: {
    paddingRight: 20,
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1.5,
    borderColor: ADMIN_COLORS.border,
    marginRight: 10,
  },
  chipActive: { 
    backgroundColor: ADMIN_COLORS.primary,
    borderColor: ADMIN_COLORS.primary,
    shadowColor: ADMIN_COLORS.primary,
    shadowOpacity: 0.3,
  },
  chipIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ADMIN_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  chipIconWrapActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
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
    paddingVertical: 3,
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
    padding: 16,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: { 
    width: 60, 
    height: 60, 
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
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
  userInfo: { 
    flex: 1, 
    marginLeft: 14,
  },
  userName: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: ADMIN_COLORS.text,
    marginBottom: 4,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  userEmail: { 
    fontSize: 13, 
    color: ADMIN_COLORS.textMuted, 
    marginLeft: 6,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusText: { 
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  actionBtns: { 
    flexDirection: 'column',
    gap: 8,
  },
  actionBtn: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionBtnGradient: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
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
  
  // Detail Modal styles
  detailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  detailModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  detailModalHeader: {
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  detailCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  detailHeaderContent: {
    alignItems: 'center',
    width: '100%',
  },
  detailAvatar: {
    width: 90,
    height: 90,
    borderRadius: 25,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
    marginBottom: 16,
    backgroundColor: '#F5F5F5',
  },
  detailName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  detailStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  detailStatusText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailBody: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
  },
  detailInfoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  detailInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ADMIN_COLORS.card,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    gap: 10,
  },
  detailInfoTextWrap: {
    flex: 1,
  },
  detailInfoLabel: {
    fontSize: 10,
    color: ADMIN_COLORS.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  detailInfoValue: {
    fontSize: 13,
    color: ADMIN_COLORS.text,
    fontWeight: '600',
  },
  detailActionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  detailActionBtnCompact: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ADMIN_COLORS.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  detailItemIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFF5EE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  detailItemContent: {
    flex: 1,
  },
  detailItemLabel: {
    fontSize: 11,
    color: ADMIN_COLORS.textMuted,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailItemValue: {
    fontSize: 15,
    color: ADMIN_COLORS.text,
    fontWeight: '600',
  },
  detailActions: {
    gap: 12,
    marginBottom: 10,
  },
  detailActionBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  detailActionBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  detailActionBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Form Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeaderGradient: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
  },
  modalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderTextWrap: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  modalSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    fontWeight: '500',
  },
  modalCloseBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 10,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 10,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFF5EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: ADMIN_COLORS.text,
    letterSpacing: 0.3,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 14,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: ADMIN_COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  inputIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#FFF5EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: ADMIN_COLORS.text,
    fontWeight: '500',
  },
  inputHint: {
    fontSize: 11,
    color: ADMIN_COLORS.textMuted,
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '500',
  },
  statusToggle: {
    flexDirection: 'row',
    gap: 12,
  },
  statusOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: ADMIN_COLORS.card,
    borderWidth: 2,
    borderColor: ADMIN_COLORS.border,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  statusOptionActive: {
    backgroundColor: '#E8FFF3',
    borderColor: '#00B894',
    shadowColor: '#00B894',
    shadowOpacity: 0.15,
  },
  statusOptionSuspended: {
    backgroundColor: '#FFF0E8',
    borderColor: '#E17055',
    shadowColor: '#E17055',
    shadowOpacity: 0.15,
  },
  statusIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: ADMIN_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIconWrapActive: {
    backgroundColor: 'rgba(0, 184, 148, 0.15)',
  },
  statusIconWrapSuspended: {
    backgroundColor: 'rgba(225, 112, 85, 0.15)',
  },
  statusOptionText: {
    fontSize: 15,
    fontWeight: '700',
    color: ADMIN_COLORS.textLight,
  },
  statusOptionTextActive: {
    color: '#00B894',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 18,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: ADMIN_COLORS.border,
    backgroundColor: '#FFFFFF',
  },
  cancelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: ADMIN_COLORS.background,
    borderWidth: 1.5,
    borderColor: ADMIN_COLORS.border,
    gap: 8,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: ADMIN_COLORS.textLight,
  },
  saveBtn: {
    flex: 1.5,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: ADMIN_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.3,
  },
});

export default memo(AdminUsersScreen);
