import React, { useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import CONFIG from '../../config/config';
import { ADMIN_COLORS } from './shared';

const AdminSettingsScreen = ({ onGoBack, adminToken }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // App Settings State
  const [appSettings, setAppSettings] = useState({
    enableAdoptions: true,
    enableRescues: true,
    enableNewRegistrations: true,
    maintenanceMode: false,
    emailNotifications: true,
    autoApproveRescuers: false,
  });

  const handleToggleSetting = useCallback((key) => {
    if (key === 'maintenanceMode') {
      Alert.alert(
        'Maintenance Mode',
        appSettings.maintenanceMode 
          ? 'Are you sure you want to disable maintenance mode? Users will be able to access the app again.'
          : 'Are you sure you want to enable maintenance mode? Users will see a maintenance message.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: () => {
              setAppSettings(prev => ({ ...prev, [key]: !prev[key] }));
              Alert.alert('Success', `Maintenance mode ${!appSettings.maintenanceMode ? 'enabled' : 'disabled'}`);
            },
          },
        ]
      );
    } else {
      setAppSettings(prev => ({ ...prev, [key]: !prev[key] }));
    }
  }, [appSettings.maintenanceMode]);

  const handleExportData = useCallback(() => {
    Alert.alert(
      'Export Data',
      'What data would you like to export?',
      [
        {
          text: 'Users',
          onPress: () => Alert.alert('Export Started', 'User data export has been initiated. You will receive an email when ready.'),
        },
        {
          text: 'Pets',
          onPress: () => Alert.alert('Export Started', 'Pet data export has been initiated. You will receive an email when ready.'),
        },
        {
          text: 'All Data',
          onPress: () => Alert.alert('Export Started', 'Full data export has been initiated. You will receive an email when ready.'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, []);

  const handleClearCache = useCallback(() => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => Alert.alert('Success', 'Cache has been cleared successfully.'),
        },
      ]
    );
  }, []);

  const handleContactSupport = useCallback(() => {
    Linking.openURL('mailto:admin-support@pawmilya.com?subject=Admin Support Request');
  }, []);

  const handleViewDocs = useCallback(() => {
    Alert.alert('Documentation', 'Admin documentation is available at docs.pawmilya.com');
  }, []);

  const validateForm = () => {
    if (!currentPassword.trim()) {
      Alert.alert('Validation Error', 'Please enter your current password');
      return false;
    }

    if (!newPassword.trim()) {
      Alert.alert('Validation Error', 'Please enter a new password');
      return false;
    }

    if (newPassword.length < 6) {
      Alert.alert('Validation Error', 'New password must be at least 6 characters long');
      return false;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'New passwords do not match');
      return false;
    }

    if (currentPassword === newPassword) {
      Alert.alert('Validation Error', 'New password must be different from current password');
      return false;
    }

    return true;
  };

  const handleChangePassword = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      const response = await fetch(`${CONFIG.API_URL}/admin/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        Alert.alert(
          'Success',
          'Password changed successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', data.message || 'Failed to change password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      Alert.alert('Error', 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={ADMIN_COLORS.primary} />

      {/* Header */}
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
            <Text style={styles.headerTitle}>Settings</Text>
            <Text style={styles.headerSubtitle}>Manage your account</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Change Password Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="lock-closed" size={20} color={ADMIN_COLORS.primary} />
              </View>
              <Text style={styles.sectionTitle}>Change Password</Text>
            </View>

            <View style={styles.form}>
              {/* Current Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Current Password</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={20} color={ADMIN_COLORS.textMuted} />
                  <TextInput
                    style={styles.input}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Enter current password"
                    placeholderTextColor={ADMIN_COLORS.textMuted}
                    secureTextEntry={!showCurrentPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showCurrentPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color={ADMIN_COLORS.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* New Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>New Password</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="key-outline" size={20} color={ADMIN_COLORS.textMuted} />
                  <TextInput
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter new password"
                    placeholderTextColor={ADMIN_COLORS.textMuted}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showNewPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color={ADMIN_COLORS.textMuted}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.inputHint}>Must be at least 6 characters</Text>
              </View>

              {/* Confirm Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={ADMIN_COLORS.textMuted} />
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm new password"
                    placeholderTextColor={ADMIN_COLORS.textMuted}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color={ADMIN_COLORS.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleChangePassword}
                activeOpacity={0.8}
                disabled={loading}
              >
                <LinearGradient
                  colors={[ADMIN_COLORS.primary, ADMIN_COLORS.primaryDark]}
                  style={styles.submitGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="shield-checkmark" size={20} color="#FFF" />
                      <Text style={styles.submitText}>Update Password</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Security Tips */}
          <View style={styles.tipsSection}>
            <View style={styles.tipItem}>
              <Ionicons name="information-circle" size={18} color={ADMIN_COLORS.primary} />
              <Text style={styles.tipText}>Use a strong, unique password</Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="information-circle" size={18} color={ADMIN_COLORS.primary} />
              <Text style={styles.tipText}>Never share your password with anyone</Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="information-circle" size={18} color={ADMIN_COLORS.primary} />
              <Text style={styles.tipText}>Change your password regularly</Text>
            </View>
          </View>

          {/* App Configuration Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="settings" size={20} color={ADMIN_COLORS.primary} />
              </View>
              <Text style={styles.sectionTitle}>App Configuration</Text>
            </View>

            <View style={styles.settingsList}>
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Ionicons name="heart" size={20} color={ADMIN_COLORS.primary} />
                  <View style={styles.settingTextWrap}>
                    <Text style={styles.settingLabel}>Enable Adoptions</Text>
                    <Text style={styles.settingDesc}>Allow users to submit adoption requests</Text>
                  </View>
                </View>
                <Switch
                  value={appSettings.enableAdoptions}
                  onValueChange={() => handleToggleSetting('enableAdoptions')}
                  trackColor={{ false: '#E0E0E0', true: ADMIN_COLORS.primary + '60' }}
                  thumbColor={appSettings.enableAdoptions ? ADMIN_COLORS.primary : '#BDBDBD'}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <MaterialCommunityIcons name="ambulance" size={20} color={ADMIN_COLORS.primary} />
                  <View style={styles.settingTextWrap}>
                    <Text style={styles.settingLabel}>Enable Rescues</Text>
                    <Text style={styles.settingDesc}>Allow users to submit rescue reports</Text>
                  </View>
                </View>
                <Switch
                  value={appSettings.enableRescues}
                  onValueChange={() => handleToggleSetting('enableRescues')}
                  trackColor={{ false: '#E0E0E0', true: ADMIN_COLORS.primary + '60' }}
                  thumbColor={appSettings.enableRescues ? ADMIN_COLORS.primary : '#BDBDBD'}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Ionicons name="person-add" size={20} color={ADMIN_COLORS.primary} />
                  <View style={styles.settingTextWrap}>
                    <Text style={styles.settingLabel}>New Registrations</Text>
                    <Text style={styles.settingDesc}>Allow new users to sign up</Text>
                  </View>
                </View>
                <Switch
                  value={appSettings.enableNewRegistrations}
                  onValueChange={() => handleToggleSetting('enableNewRegistrations')}
                  trackColor={{ false: '#E0E0E0', true: ADMIN_COLORS.primary + '60' }}
                  thumbColor={appSettings.enableNewRegistrations ? ADMIN_COLORS.primary : '#BDBDBD'}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Ionicons name="shield-checkmark" size={20} color={ADMIN_COLORS.primary} />
                  <View style={styles.settingTextWrap}>
                    <Text style={styles.settingLabel}>Auto-Approve Rescuers</Text>
                    <Text style={styles.settingDesc}>Automatically approve rescuer applications</Text>
                  </View>
                </View>
                <Switch
                  value={appSettings.autoApproveRescuers}
                  onValueChange={() => handleToggleSetting('autoApproveRescuers')}
                  trackColor={{ false: '#E0E0E0', true: ADMIN_COLORS.primary + '60' }}
                  thumbColor={appSettings.autoApproveRescuers ? ADMIN_COLORS.primary : '#BDBDBD'}
                />
              </View>

              <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
                <View style={styles.settingInfo}>
                  <Ionicons name="construct" size={20} color="#FF9800" />
                  <View style={styles.settingTextWrap}>
                    <Text style={styles.settingLabel}>Maintenance Mode</Text>
                    <Text style={styles.settingDesc}>Temporarily disable app access</Text>
                  </View>
                </View>
                <Switch
                  value={appSettings.maintenanceMode}
                  onValueChange={() => handleToggleSetting('maintenanceMode')}
                  trackColor={{ false: '#E0E0E0', true: '#FF9800' + '60' }}
                  thumbColor={appSettings.maintenanceMode ? '#FF9800' : '#BDBDBD'}
                />
              </View>
            </View>
          </View>

          {/* Notifications Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="notifications" size={20} color={ADMIN_COLORS.primary} />
              </View>
              <Text style={styles.sectionTitle}>Notifications</Text>
            </View>

            <View style={styles.settingsList}>
              <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
                <View style={styles.settingInfo}>
                  <Ionicons name="mail" size={20} color={ADMIN_COLORS.primary} />
                  <View style={styles.settingTextWrap}>
                    <Text style={styles.settingLabel}>Email Notifications</Text>
                    <Text style={styles.settingDesc}>Receive email alerts for important events</Text>
                  </View>
                </View>
                <Switch
                  value={appSettings.emailNotifications}
                  onValueChange={() => handleToggleSetting('emailNotifications')}
                  trackColor={{ false: '#E0E0E0', true: ADMIN_COLORS.primary + '60' }}
                  thumbColor={appSettings.emailNotifications ? ADMIN_COLORS.primary : '#BDBDBD'}
                />
              </View>
            </View>
          </View>

          {/* System Actions Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="build" size={20} color={ADMIN_COLORS.primary} />
              </View>
              <Text style={styles.sectionTitle}>System Actions</Text>
            </View>

            <View style={styles.actionsList}>
              <TouchableOpacity style={styles.actionItem} onPress={handleExportData} activeOpacity={0.7}>
                <View style={styles.actionInfo}>
                  <View style={[styles.actionIconWrap, { backgroundColor: '#E3F2FD' }]}>
                    <Ionicons name="download" size={18} color="#2196F3" />
                  </View>
                  <View style={styles.actionTextWrap}>
                    <Text style={styles.actionLabel}>Export Data</Text>
                    <Text style={styles.actionDesc}>Download user, pet, or all data</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={ADMIN_COLORS.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionItem} onPress={handleClearCache} activeOpacity={0.7}>
                <View style={styles.actionInfo}>
                  <View style={[styles.actionIconWrap, { backgroundColor: '#FFF3E0' }]}>
                    <Ionicons name="trash" size={18} color="#FF9800" />
                  </View>
                  <View style={styles.actionTextWrap}>
                    <Text style={styles.actionLabel}>Clear Cache</Text>
                    <Text style={styles.actionDesc}>Clear all cached data</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={ADMIN_COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Support Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="help-circle" size={20} color={ADMIN_COLORS.primary} />
              </View>
              <Text style={styles.sectionTitle}>Support & Help</Text>
            </View>

            <View style={styles.actionsList}>
              <TouchableOpacity style={styles.actionItem} onPress={handleContactSupport} activeOpacity={0.7}>
                <View style={styles.actionInfo}>
                  <View style={[styles.actionIconWrap, { backgroundColor: '#E8F5E9' }]}>
                    <Ionicons name="chatbubbles" size={18} color="#4CAF50" />
                  </View>
                  <View style={styles.actionTextWrap}>
                    <Text style={styles.actionLabel}>Contact Support</Text>
                    <Text style={styles.actionDesc}>Get help from the support team</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={ADMIN_COLORS.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionItem} onPress={handleViewDocs} activeOpacity={0.7}>
                <View style={styles.actionInfo}>
                  <View style={[styles.actionIconWrap, { backgroundColor: '#F3E5F5' }]}>
                    <Ionicons name="document-text" size={18} color="#9C27B0" />
                  </View>
                  <View style={styles.actionTextWrap}>
                    <Text style={styles.actionLabel}>Documentation</Text>
                    <Text style={styles.actionDesc}>View admin user guide</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={ADMIN_COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* App Version */}
          <View style={styles.versionSection}>
            <MaterialCommunityIcons name="paw" size={24} color={ADMIN_COLORS.textMuted} />
            <Text style={styles.versionText}>Pawmilya Admin v1.0.0</Text>
            <Text style={styles.versionSubtext}>© 2026 Pawmilya. All rights reserved.</Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ADMIN_COLORS.background,
  },
  headerGradient: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 50,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
    color: '#FFF',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },
  headerSpacer: {
    width: 40,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  section: {
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF5EE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: ADMIN_COLORS.text,
    marginBottom: 4,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ADMIN_COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: ADMIN_COLORS.border,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: ADMIN_COLORS.text,
    marginLeft: 10,
    fontWeight: '500',
  },
  eyeButton: {
    padding: 8,
  },
  inputHint: {
    fontSize: 12,
    color: ADMIN_COLORS.textMuted,
    marginTop: 4,
    marginLeft: 4,
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  submitText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  tipsSection: {
    backgroundColor: '#E8F5FF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: ADMIN_COLORS.text,
    lineHeight: 18,
    fontWeight: '500',
  },
  // Settings items
  settingsList: {
    gap: 0,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.border,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  settingTextWrap: {
    marginLeft: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: ADMIN_COLORS.text,
    marginBottom: 2,
  },
  settingDesc: {
    fontSize: 12,
    color: ADMIN_COLORS.textMuted,
  },
  // Actions list
  actionsList: {
    gap: 0,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.border,
  },
  actionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTextWrap: {
    marginLeft: 12,
    flex: 1,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: ADMIN_COLORS.text,
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 12,
    color: ADMIN_COLORS.textMuted,
  },
  // Version section
  versionSection: {
    alignItems: 'center',
    paddingVertical: 24,
    marginTop: 8,
  },
  versionText: {
    fontSize: 14,
    fontWeight: '600',
    color: ADMIN_COLORS.textMuted,
    marginTop: 8,
  },
  versionSubtext: {
    fontSize: 12,
    color: ADMIN_COLORS.textMuted,
    marginTop: 4,
  },
});

export default memo(AdminSettingsScreen);
