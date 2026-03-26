import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
  Switch,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import JemoyIcon from '../../components/JemoyIcon';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { userService, shelterService } from '../../services';
import { getAvatarUrl } from './shared';

// Extracted outside component to prevent recreation
const SETTINGS_SECTIONS = [
  {
    title: 'Account',
    items: [
      { id: 'profile', icon: 'person', label: 'Edit Profile', type: 'link' },
      { id: 'password', icon: 'lock-closed', label: 'Change Password', type: 'link' },
      { id: 'twoFactor', icon: 'key', label: 'Two-Factor Authentication', type: 'toggle' },
    ],
  },
  {
    title: 'Activity',
    items: [
      { id: 'myAdoptions', icon: 'heart', label: 'My Adoptions', type: 'link' },
      { id: 'notifications', icon: 'notifications', label: 'Notifications', type: 'link' },
      { id: 'becomeRescuer', icon: 'shield-checkmark', label: 'Become a Rescuer', type: 'link' },
      { id: 'shelter', icon: 'home', label: 'Register a Shelter', type: 'link' },
    ],
  },
  {
    title: 'Support',
    items: [
      { id: 'feedback', icon: 'chatbubble-ellipses', label: 'Send Feedback', type: 'link' },
      { id: 'report', icon: 'flag', label: 'Report a Problem', type: 'link' },
    ],
  },
  {
    title: 'About',
    items: [
      { id: 'terms', icon: 'document-text', label: 'Terms of Service', type: 'link' },
      { id: 'privacy', icon: 'shield-checkmark', label: 'Privacy Policy', type: 'link' },
      { id: 'version', icon: 'information-circle', label: 'App Version', type: 'info', value: '1.0.0' },
    ],
  },
  {
    title: 'Danger Zone',
    items: [
      { id: 'deleteAccount', icon: 'trash', label: 'Delete Account', type: 'link', danger: true },
    ],
  },
];

const UserSettingsScreen = ({ onLogout, onNavigateToRescuerRegistration, onNavigateToAdoptions, onOpenFeedback, onOpenReportProblem, onNavigateToJemoy, onNavigateToShelterApplication, onNavigateToShelterManager, onNavigateToNotifications }) => {
  const { user, logout, updateUser } = useAuth();
  const [isShelterManager, setIsShelterManager] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.two_factor_enabled !== false);
  const [userName, setUserName] = useState(user?.full_name || user?.name || 'User');
  const [userEmail, setUserEmail] = useState(user?.email || 'user@example.com');
  const [userAvatar, setUserAvatar] = useState(user?.avatar_url || null);
  const [userPhone, setUserPhone] = useState(user?.phone || '');
  const [userBio, setUserBio] = useState(user?.bio || '');
  const [userAddress, setUserAddress] = useState(user?.address || '');
  const [userCity, setUserCity] = useState(user?.city || '');
  
  // Modal states
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Edit profile form states
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [tempAvatar, setTempAvatar] = useState(null);
  const [tempAvatarUrlInput, setTempAvatarUrlInput] = useState('');
  
  // Change password form states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Memoized avatar URI
  const avatarUri = useMemo(() => getAvatarUrl(userAvatar), [userAvatar]);

  // Sync user data immediately when user context changes
  useEffect(() => {
    if (user?.full_name || user?.name) {
      setUserName(user.full_name || user.name);
    }
    if (user?.email) {
      setUserEmail(user.email);
    }
    if (user?.avatar_url) {
      setUserAvatar(user.avatar_url);
    }
    if (user?.phone) {
      setUserPhone(user.phone);
    }
    if (user?.bio) {
      setUserBio(user.bio);
    }
    if (user?.address) {
      setUserAddress(user.address);
    }
    if (user?.city) {
      setUserCity(user.city);
    }
  }, [user]);

  // Check shelter manager status
  useEffect(() => {
    const checkManagerStatus = async () => {
      try {
        const result = await shelterService.getShelterManagerStatus();
        setIsShelterManager(result?.isManager || false);
      } catch (e) {
        setIsShelterManager(false);
      }
    };
    if (user?.id) checkManagerStatus();
  }, [user?.id]);

  // Dynamically update shelter settings item based on manager status
  const settingsSections = useMemo(() => {
    return SETTINGS_SECTIONS.map(section => {
      if (section.title === 'Activity') {
        return {
          ...section,
          items: section.items.map(item => {
            if (item.id === 'shelter') {
              return isShelterManager
                ? { ...item, icon: 'home', label: 'Manage My Shelter' }
                : item;
            }
            return item;
          }),
        };
      }
      return section;
    });
  }, [isShelterManager]);

  useEffect(() => {
    if (user?.id) {
      fetchUserProfile();
    }
  }, [user?.id]);

  const fetchUserProfile = useCallback(async () => {
    try {
      const profileResponse = await userService.getProfile();
      const data = profileResponse.data || profileResponse;
      if (data) {
        setUserName(data.full_name || data.name || 'User');
        setUserEmail(data.email || 'user@example.com');
        setUserPhone(data.phone || '');
        setUserBio(data.bio || '');
        setUserAddress(data.address || '');
        setUserCity(data.city || '');
        setTwoFactorEnabled(data.two_factor_enabled !== false);
        if (data.avatar_url) {
          setUserAvatar(data.avatar_url);
        }
      }
    } catch (error) {
      // Silently fail
    }
  }, []);

  const handleToggle2FA = useCallback(async () => {
    const previousValue = twoFactorEnabled;
    try {
      const newValue = !twoFactorEnabled;
      setTwoFactorEnabled(newValue);
      const response = await userService.toggle2FA();
      const enabled = response.data.two_factor_enabled;
      setTwoFactorEnabled(enabled);
      Alert.alert(
        'Two-Factor Authentication',
        enabled
          ? 'OTP verification is now required when you log in.'
          : 'OTP verification has been turned off. You will log in directly with your password.'
      );
    } catch (error) {
      setTwoFactorEnabled(previousValue);
      Alert.alert('Error', 'Failed to update 2FA setting');
    }
  }, [twoFactorEnabled]);

  const handleDeleteAccount = useCallback(async () => {
    try {
      setLoading(true);
      await userService.deleteAccount();
      await logout();
      if (onLogout) {
        onLogout();
      }
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to delete account. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [logout, onLogout]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              if (onLogout) {
                onLogout();
              }
            } catch (error) {
              console.error('Logout error:', error);
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [logout, onLogout]);

  // Edit Profile Functions
  const openEditProfileModal = useCallback(() => {
    setEditName(userName);
    setEditPhone(userPhone);
    setEditBio(userBio);
    setEditAddress(userAddress);
    setEditCity(userCity);
    setTempAvatar(null);
    setTempAvatarUrlInput('');
    setEditProfileModalVisible(true);
  }, [userName, userPhone, userBio, userAddress, userCity]);

  const handleSettingPress = useCallback((item) => {
    if (item.id === 'profile') {
      openEditProfileModal();
    } else if (item.id === 'password') {
      openChangePasswordModal();
    } else if (item.id === 'myAdoptions') {
      if (onNavigateToAdoptions) {
        onNavigateToAdoptions();
      }
    } else if (item.id === 'notifications') {
      if (onNavigateToNotifications) {
        onNavigateToNotifications();
      }
    } else if (item.id === 'becomeRescuer') {
      if (onNavigateToRescuerRegistration) {
        onNavigateToRescuerRegistration();
      }
    } else if (item.id === 'shelter') {
      if (isShelterManager) {
        if (onNavigateToShelterManager) {
          onNavigateToShelterManager();
        }
      } else {
        if (onNavigateToShelterApplication) {
          onNavigateToShelterApplication();
        }
      }
    } else if (item.id === 'feedback') {
      if (onOpenFeedback) {
        onOpenFeedback();
      } else {
        Linking.openURL('mailto:support@pawmilya.com?subject=App Feedback');
      }
    } else if (item.id === 'report') {
      if (onOpenReportProblem) {
        onOpenReportProblem();
      } else {
        Linking.openURL('mailto:support@pawmilya.com?subject=Report a Problem');
      }
    } else if (item.id === 'terms') {
      setTermsModalVisible(true);
    } else if (item.id === 'privacy') {
      setPrivacyModalVisible(true);
    } else if (item.id === 'deleteAccount') {
      Alert.alert(
        'Delete Account',
        'Are you sure you want to permanently delete your account? This action cannot be undone. All your data, adoption history, and pet records will be deleted.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete Account', 
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                'Confirm Deletion',
                'This is irreversible. Are you absolutely sure?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'I understand, delete my account', 
                    style: 'destructive',
                    onPress: handleDeleteAccount,
                  },
                ]
              );
            }
          },
        ]
      );
    }
  }, [onNavigateToRescuerRegistration, onNavigateToAdoptions, onNavigateToNotifications, onOpenFeedback, onOpenReportProblem, onNavigateToShelterApplication, onNavigateToShelterManager, isShelterManager, openEditProfileModal, handleDeleteAccount]);

  const pickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to change your profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setTempAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  }, []);

  const takePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera permissions to take a profile picture.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setTempAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  }, []);

  const showImageOptions = useCallback(() => {
    Alert.alert(
      'Change Profile Picture',
      'Choose an option',
      [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Library', onPress: pickImage },
        {
          text: 'Use Image URL',
          onPress: () => {
            setTempAvatarUrlInput(tempAvatar || '');
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [pickImage, takePhoto, tempAvatar]);

  const setAvatarFromUrl = useCallback(() => {
    const trimmedUrl = tempAvatarUrlInput.trim();
    if (!trimmedUrl) {
      Alert.alert('Validation Error', 'Please enter an image URL.');
      return;
    }

    if (!/^https?:\/\//i.test(trimmedUrl)) {
      Alert.alert('Invalid URL', 'Image URL must start with http:// or https://');
      return;
    }

    setTempAvatar(trimmedUrl);
    setTempAvatarUrlInput('');
  }, [tempAvatarUrlInput]);

  const handleSaveProfile = useCallback(async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setLoading(true);
    let newAvatarUrl = userAvatar;
    
    try {
      // Upload avatar if changed
      if (tempAvatar) {
        if (tempAvatar.startsWith('http://') || tempAvatar.startsWith('https://')) {
          newAvatarUrl = tempAvatar;
          setUserAvatar(newAvatarUrl);
        } else {
          setUploadingAvatar(true);
          try {
            const avatarResponse = await userService.uploadAvatar(tempAvatar);
            if (avatarResponse.avatar_url) {
              newAvatarUrl = avatarResponse.avatar_url;
              setUserAvatar(newAvatarUrl);
            }
          } catch (avatarError) {
            console.error('Avatar upload error:', avatarError);
            Alert.alert('Warning', 'Profile updated but avatar upload failed');
          }
          setUploadingAvatar(false);
        }
      }

      // Update profile data
      const profileData = {
        full_name: editName.trim(),
        phone: editPhone.trim(),
        bio: editBio.trim(),
        address: editAddress.trim(),
        city: editCity.trim(),
      };

      const response = await userService.updateProfile(profileData);
      
      if (response.user || response.success) {
        setUserName(editName.trim());
        setUserPhone(editPhone.trim());
        setUserBio(editBio.trim());
        setUserAddress(editAddress.trim());
        setUserCity(editCity.trim());
        
        // Update auth context if available
        if (updateUser) {
          updateUser({ 
            ...user, 
            full_name: editName.trim(),
            avatar_url: newAvatarUrl,
            phone: editPhone.trim(),
            bio: editBio.trim(),
            address: editAddress.trim(),
            city: editCity.trim(),
          });
        }
        
        Alert.alert('Success', 'Profile updated successfully');
        setEditProfileModalVisible(false);
      } else {
        Alert.alert('Error', response.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Update profile error:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  }, [editName, editPhone, editBio, editAddress, editCity, tempAvatar, userAvatar, user, updateUser]);

  // Change Password Functions
  const openChangePasswordModal = useCallback(() => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setChangePasswordModalVisible(true);
  }, []);

  const handleChangePassword = useCallback(async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'All fields are required');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Error', 'New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await userService.changePassword(currentPassword, newPassword);
      
      if (response.message || response.success) {
        Alert.alert('Success', 'Password changed successfully');
        setChangePasswordModalVisible(false);
      } else {
        Alert.alert('Error', response.error || 'Failed to change password');
      }
    } catch (error) {
      console.error('Change password error:', error);
      Alert.alert('Error', error.message || 'Current password is incorrect');
    } finally {
      setLoading(false);
    }
  }, [currentPassword, newPassword, confirmPassword]);

  const renderSettingItem = useCallback((item) => {
    const isDisabled = item.disabled;
    const isDanger = item.danger;
    const iconColor = isDanger ? '#F44336' : (isDisabled ? COLORS.textMedium : COLORS.primary);

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.settingItem, isDisabled && styles.settingItemDisabled]}
        onPress={() => {
          if (item.type === 'link') {
            handleSettingPress(item);
          } else if (item.type === 'toggle' && item.id === 'twoFactor') {
            handleToggle2FA();
          }
        }}
        disabled={isDisabled}
        activeOpacity={0.7}
        accessibilityLabel={item.label}
        accessibilityRole={item.type === 'toggle' ? 'switch' : 'button'}
        accessibilityState={item.type === 'toggle' ? { checked: twoFactorEnabled } : undefined}
      >
        <View style={styles.settingLeft}>
          <View style={[styles.settingIcon, isDanger && { backgroundColor: '#FFEBEE' }]}>
            <Ionicons name={item.icon} size={20} color={iconColor} />
          </View>
          <Text style={[
            styles.settingLabel, 
            isDisabled && styles.settingLabelDisabled,
            isDanger && { color: '#F44336' }
          ]}>
            {item.label}
          </Text>
        </View>
        <View style={styles.settingRight}>
          {item.type === 'toggle' && item.id === 'twoFactor' && (
            <Switch
              value={twoFactorEnabled}
              onValueChange={handleToggle2FA}
              trackColor={{ false: COLORS.borderLight, true: COLORS.primary + '80' }}
              thumbColor={twoFactorEnabled ? COLORS.primary : COLORS.textMedium}
            />
          )}
          {item.type === 'link' && !item.value && (
            <Ionicons name="chevron-forward" size={20} color={isDanger ? '#F44336' : COLORS.textMedium} />
          )}
          {item.type === 'info' && (
            <Text style={styles.settingValue}>{item.value}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [handleSettingPress, handleToggle2FA, twoFactorEnabled]);

  // Edit Profile Modal
  const renderEditProfileModal = () => (
    <Modal
      visible={editProfileModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setEditProfileModalVisible(false)}
    >
      <KeyboardAvoidingView 
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditProfileModalVisible(false)}>
              <Ionicons name="close" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={handleSaveProfile} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Text style={styles.saveButton}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <TouchableOpacity onPress={showImageOptions} style={styles.avatarContainer}>
                {tempAvatar || avatarUri ? (
                  <Image 
                    source={{ uri: tempAvatar || avatarUri }} 
                    style={styles.editAvatar} 
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={50} color={COLORS.textMedium} />
                  </View>
                )}
                <View style={styles.cameraIconContainer}>
                  <Ionicons name="camera" size={18} color={COLORS.textWhite} />
                </View>
                {uploadingAvatar && (
                  <View style={styles.avatarLoadingOverlay}>
                    <ActivityIndicator size="small" color={COLORS.textWhite} />
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.changePhotoText}>Tap to change photo</Text>
              <View style={styles.avatarUrlRow}>
                <TextInput
                  style={styles.avatarUrlInput}
                  placeholder="Paste avatar URL (https://...)"
                  placeholderTextColor={COLORS.textMedium}
                  value={tempAvatarUrlInput}
                  onChangeText={setTempAvatarUrlInput}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <TouchableOpacity style={styles.avatarUrlButton} onPress={setAvatarFromUrl}>
                  <Ionicons name="link" size={18} color={COLORS.textWhite} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Form Fields */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Full Name</Text>
              <TextInput
                style={styles.formInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter your full name"
                placeholderTextColor={COLORS.textMedium}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Phone Number</Text>
              <TextInput
                style={styles.formInput}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="Enter your phone number"
                placeholderTextColor={COLORS.textMedium}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Bio</Text>
              <TextInput
                style={[styles.formInput, styles.formTextarea]}
                value={editBio}
                onChangeText={setEditBio}
                placeholder="Tell us about yourself"
                placeholderTextColor={COLORS.textMedium}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Address</Text>
              <TextInput
                style={styles.formInput}
                value={editAddress}
                onChangeText={setEditAddress}
                placeholder="Enter your address"
                placeholderTextColor={COLORS.textMedium}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>City</Text>
              <TextInput
                style={styles.formInput}
                value={editCity}
                onChangeText={setEditCity}
                placeholder="Enter your city"
                placeholderTextColor={COLORS.textMedium}
              />
            </View>

            <View style={styles.bottomSpacing} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // Change Password Modal
  const renderChangePasswordModal = () => (
    <Modal
      visible={changePasswordModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setChangePasswordModalVisible(false)}
    >
      <KeyboardAvoidingView 
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setChangePasswordModalVisible(false)}>
              <Ionicons name="close" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Change Password</Text>
            <TouchableOpacity onPress={handleChangePassword} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Text style={styles.saveButton}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Current Password</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor={COLORS.textMedium}
                  secureTextEntry={!showCurrentPassword}
                />
                <TouchableOpacity 
                  style={styles.eyeIcon}
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  <Ionicons 
                    name={showCurrentPassword ? "eye-off" : "eye"} 
                    size={20} 
                    color={COLORS.textMedium} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>New Password</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password (min 8 characters)"
                  placeholderTextColor={COLORS.textMedium}
                  secureTextEntry={!showNewPassword}
                />
                <TouchableOpacity 
                  style={styles.eyeIcon}
                  onPress={() => setShowNewPassword(!showNewPassword)}
                >
                  <Ionicons 
                    name={showNewPassword ? "eye-off" : "eye"} 
                    size={20} 
                    color={COLORS.textMedium} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Confirm New Password</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor={COLORS.textMedium}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity 
                  style={styles.eyeIcon}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons 
                    name={showConfirmPassword ? "eye-off" : "eye"} 
                    size={20} 
                    color={COLORS.textMedium} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.passwordHint}>
              <Ionicons name="information-circle" size={16} color={COLORS.textMedium} />
              <Text style={styles.passwordHintText}>
                Password must be at least 8 characters long
              </Text>
            </View>

            <View style={styles.bottomSpacing} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.profileAvatar} />
          ) : (
            <View style={[styles.profileAvatar, styles.avatarPlaceholderSmall]}>
              <Ionicons name="person" size={30} color={COLORS.textMedium} />
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userName}</Text>
            <Text style={styles.profileEmail}>{userEmail}</Text>
          </View>
          <TouchableOpacity 
            style={styles.editProfileBtn} 
            activeOpacity={0.7}
            onPress={openEditProfileModal}
          >
            <Ionicons name="create-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Settings Sections */}
        {settingsSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionContent}>
              {section.items.map(renderSettingItem)}
            </View>
          </View>
        ))}

        {/* Jemoy AI Assistant Button */}
        <TouchableOpacity
          style={styles.jemoyButton}
          activeOpacity={0.85}
          onPress={() => {
            if (onNavigateToJemoy) {
              onNavigateToJemoy();
            } else {
              Alert.alert('Jemoy', 'AI Assistant is not available right now.');
            }
          }}
        >
          <LinearGradient
            colors={['#FF9554', '#E67D3C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.jemoyGradient}
          >
            <View style={styles.jemoyIconWrap}>
              <JemoyIcon size={42} />
            </View>
            <View style={styles.jemoyTextWrap}>
              <Text style={styles.jemoyTitle}>Ask Jemoy</Text>
              <Text style={styles.jemoySubtitle}>Your AI Pet Assistant</Text>
            </View>
            <View style={styles.jemoyArrow}>
              <Ionicons name="chatbubble-ellipses" size={22} color="#FFFFFF" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <MaterialCommunityIcons name="paw" size={24} color={COLORS.textMedium} />
          <Text style={styles.footerText}>Pawmilya v1.0.0</Text>
          <Text style={styles.footerSubtext}>Made with ❤️ for animals</Text>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Modals */}
      {renderEditProfileModal()}
      {renderChangePasswordModal()}
      
      {/* Terms of Service Modal */}
      <Modal
        visible={termsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTermsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.legalModalContent}>
            <View style={styles.legalModalHeader}>
              <View style={styles.legalModalIconWrap}>
                <Ionicons name="document-text" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.legalModalTitle}>Terms of Service</Text>
              <TouchableOpacity 
                style={styles.legalModalCloseBtn} 
                onPress={() => setTermsModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.legalModalBody} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.legalModalBodyContent}
            >
              <Text style={styles.legalLastUpdated}>Last Updated: February 2, 2026</Text>
              
              <View style={styles.legalSection}>
                <Text style={styles.legalSectionTitle}>1. Acceptance of Terms</Text>
                <Text style={styles.legalText}>
                  By accessing and using the Pawmilya application, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
                </Text>
              </View>
              
              <View style={styles.legalSection}>
                <Text style={styles.legalSectionTitle}>2. User Responsibilities</Text>
                <Text style={styles.legalText}>As a user of Pawmilya, you agree to:</Text>
                <View style={styles.legalBulletList}>
                  <Text style={styles.legalBullet}>• Provide accurate and truthful information during registration and adoption applications</Text>
                  <Text style={styles.legalBullet}>• Treat all animals with care, respect, and compassion</Text>
                  <Text style={styles.legalBullet}>• Complete the adoption process responsibly and in good faith</Text>
                  <Text style={styles.legalBullet}>• Follow all local, state, and federal pet ownership laws</Text>
                  <Text style={styles.legalBullet}>• Report any concerns about animal welfare to appropriate authorities</Text>
                  <Text style={styles.legalBullet}>• Not use the platform for any illegal or unauthorized purpose</Text>
                </View>
              </View>
              
              <View style={styles.legalSection}>
                <Text style={styles.legalSectionTitle}>3. Adoption Process</Text>
                <Text style={styles.legalText}>
                  The adoption process through Pawmilya involves application submission, review by shelter staff, and approval. We reserve the right to reject any application that does not meet our criteria for responsible pet ownership. Adoption fees are non-refundable once the pet has been delivered.
                </Text>
              </View>
              
              <View style={styles.legalSection}>
                <Text style={styles.legalSectionTitle}>4. Rescuer Guidelines</Text>
                <Text style={styles.legalText}>
                  Users who register as rescuers must provide accurate location information for rescue operations. False rescue reports may result in account suspension or termination.
                </Text>
              </View>
              
              <View style={styles.legalSection}>
                <Text style={styles.legalSectionTitle}>5. Account Termination</Text>
                <Text style={styles.legalText}>
                  We reserve the right to suspend or terminate accounts that violate these terms, engage in fraudulent activity, or misuse the platform in any way.
                </Text>
              </View>
              
              <View style={styles.legalSection}>
                <Text style={styles.legalSectionTitle}>6. Contact Us</Text>
                <Text style={styles.legalText}>
                  If you have any questions about these Terms of Service, please contact us at support@pawmilya.com
                </Text>
              </View>
              
              <View style={{ height: 40 }} />
            </ScrollView>
            
            <View style={styles.legalModalFooter}>
              <TouchableOpacity 
                style={styles.legalAcceptButton}
                onPress={() => setTermsModalVisible(false)}
              >
                <Text style={styles.legalAcceptButtonText}>I Understand</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Privacy Policy Modal */}
      <Modal
        visible={privacyModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPrivacyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.legalModalContent}>
            <View style={styles.legalModalHeader}>
              <View style={[styles.legalModalIconWrap, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="shield-checkmark" size={24} color="#059669" />
              </View>
              <Text style={styles.legalModalTitle}>Privacy Policy</Text>
              <TouchableOpacity 
                style={styles.legalModalCloseBtn} 
                onPress={() => setPrivacyModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.legalModalBody} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.legalModalBodyContent}
            >
              <Text style={styles.legalLastUpdated}>Last Updated: February 2, 2026</Text>
              
              <View style={styles.legalSection}>
                <Text style={styles.legalSectionTitle}>1. Information We Collect</Text>
                <Text style={styles.legalText}>We collect information you provide directly to us, including:</Text>
                <View style={styles.legalBulletList}>
                  <Text style={styles.legalBullet}>• Personal information (name, email, phone number)</Text>
                  <Text style={styles.legalBullet}>• Profile information (address, city, bio)</Text>
                  <Text style={styles.legalBullet}>• Adoption application details</Text>
                  <Text style={styles.legalBullet}>• Location data (for rescue operations only)</Text>
                  <Text style={styles.legalBullet}>• Device and usage information</Text>
                </View>
              </View>
              
              <View style={styles.legalSection}>
                <Text style={styles.legalSectionTitle}>2. How We Use Your Information</Text>
                <Text style={styles.legalText}>Your information is used to:</Text>
                <View style={styles.legalBulletList}>
                  <Text style={styles.legalBullet}>• Process adoption applications</Text>
                  <Text style={styles.legalBullet}>• Coordinate rescue operations</Text>
                  <Text style={styles.legalBullet}>• Send important notifications about your applications</Text>
                  <Text style={styles.legalBullet}>• Improve our services and user experience</Text>
                  <Text style={styles.legalBullet}>• Ensure platform safety and prevent fraud</Text>
                </View>
              </View>
              
              <View style={styles.legalSection}>
                <Text style={styles.legalSectionTitle}>3. Data Security</Text>
                <Text style={styles.legalText}>
                  Your data is encrypted and stored securely. We implement industry-standard security measures to protect your personal information from unauthorized access, alteration, or disclosure.
                </Text>
              </View>
              
              <View style={styles.legalSection}>
                <Text style={styles.legalSectionTitle}>4. Data Sharing</Text>
                <Text style={styles.legalText}>
                  We do not sell your personal information to third parties. Your information may be shared with partner shelters for adoption processing purposes only.
                </Text>
              </View>
              
              <View style={styles.legalSection}>
                <Text style={styles.legalSectionTitle}>5. Your Rights</Text>
                <Text style={styles.legalText}>You have the right to:</Text>
                <View style={styles.legalBulletList}>
                  <Text style={styles.legalBullet}>• Access your personal data</Text>
                  <Text style={styles.legalBullet}>• Request correction of inaccurate data</Text>
                  <Text style={styles.legalBullet}>• Request deletion of your account and data</Text>
                  <Text style={styles.legalBullet}>• Opt-out of promotional communications</Text>
                  <Text style={styles.legalBullet}>• Withdraw consent for location tracking</Text>
                </View>
              </View>
              
              <View style={styles.legalSection}>
                <Text style={styles.legalSectionTitle}>6. Cookies and Tracking</Text>
                <Text style={styles.legalText}>
                  We use minimal tracking technologies to improve app performance and user experience. You can manage your preferences in the app settings.
                </Text>
              </View>
              
              <View style={styles.legalSection}>
                <Text style={styles.legalSectionTitle}>7. Contact Us</Text>
                <Text style={styles.legalText}>
                  For privacy-related inquiries or to exercise your data rights, please contact us at privacy@pawmilya.com
                </Text>
              </View>
              
              <View style={{ height: 40 }} />
            </ScrollView>
            
            <View style={styles.legalModalFooter}>
              <TouchableOpacity 
                style={[styles.legalAcceptButton, { backgroundColor: '#059669' }]}
                onPress={() => setPrivacyModalVisible(false)}
              >
                <Text style={styles.legalAcceptButtonText}>I Understand</Text>
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
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },

  // Profile Card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.xl,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: SPACING.xxl,
  },
  profileAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  avatarPlaceholderSmall: {
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: SPACING.lg,
  },
  profileName: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  profileEmail: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: 4,
  },
  editProfileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Sections
  section: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textMedium,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    elevation: 2,
  },

  // Setting Item
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  settingItemDisabled: {
    opacity: 0.5,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  settingLabel: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark,
    fontWeight: FONTS.weights.medium,
  },
  settingLabelDisabled: {
    color: COLORS.textMedium,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
  },

  // Jemoy AI Button
  jemoyButton: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#FF9554',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  jemoyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.xl,
  },
  jemoyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  jemoyTextWrap: {
    flex: 1,
  },
  jemoyTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: '#FFFFFF',
  },
  jemoySubtitle: {
    fontSize: FONTS.sizes.sm,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  jemoyArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Logout Button
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.xl,
    backgroundColor: COLORS.errorBackground,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.xxl,
  },
  logoutText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.error,
    marginLeft: SPACING.sm,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  footerText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: SPACING.sm,
  },
  footerSubtext: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textLight,
    marginTop: 4,
  },

  bottomSpacing: {
    height: 100,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.backgroundWhite,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  modalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  saveButton: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
  },
  modalBody: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
  },

  // Avatar Section
  avatarSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  avatarContainer: {
    position: 'relative',
  },
  editAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: COLORS.primary,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: COLORS.primary,
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.backgroundWhite,
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 60,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    marginTop: SPACING.sm,
  },
  avatarUrlRow: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  avatarUrlInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    color: COLORS.textDark,
    marginRight: SPACING.sm,
  },
  avatarUrlButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },

  // Form Styles
  formGroup: {
    marginBottom: SPACING.lg,
  },
  formLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
    marginBottom: SPACING.xs,
  },
  formInput: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  formTextarea: {
    height: 100,
    textAlignVertical: 'top',
  },

  // Password Input
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark,
  },
  eyeIcon: {
    paddingHorizontal: SPACING.md,
  },

  // Password Hint
  passwordHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundLight,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
  passwordHintText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginLeft: SPACING.xs,
  },

  // Legal Modal Styles (Terms & Privacy)
  legalModalContent: {
    backgroundColor: COLORS.backgroundWhite,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    maxHeight: '92%',
    flex: 1,
  },
  legalModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  legalModalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  legalModalTitle: {
    flex: 1,
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  legalModalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legalModalBody: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
  },
  legalModalBodyContent: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  legalLastUpdated: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    fontStyle: 'italic',
    marginBottom: SPACING.xl,
  },
  legalSection: {
    marginBottom: SPACING.xl,
  },
  legalSectionTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.sm,
  },
  legalText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    lineHeight: 24,
  },
  legalBulletList: {
    marginTop: SPACING.sm,
    paddingLeft: SPACING.sm,
  },
  legalBullet: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    lineHeight: 26,
    marginBottom: 4,
  },
  legalModalFooter: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? SPACING.xxl : SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    backgroundColor: COLORS.backgroundWhite,
  },
  legalAcceptButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legalAcceptButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: '#FFFFFF',
  },
});

export default memo(UserSettingsScreen);
