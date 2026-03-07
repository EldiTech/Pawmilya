import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
  Dimensions,
  Linking,
  TextInput,
  RefreshControl,
  BackHandler,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { WebView } from 'react-native-webview';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import CONFIG from '../../config/config';
import { getImageUrl, getTimeAgo } from './shared';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Map HTML for rescue location
const RESCUE_MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    #map { width: 100%; height: 100%; }
    .leaflet-control-attribution { display: none; }
    
    .rescue-marker {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      border: 4px solid white;
      background: #FF9554;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(255, 149, 84, 0.7); }
      70% { box-shadow: 0 0 0 20px rgba(255, 149, 84, 0); }
      100% { box-shadow: 0 0 0 0 rgba(255, 149, 84, 0); }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([14.5995, 120.9842], 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);
    
    var rescueMarker = null;
    
    function setRescueLocation(lat, lng, title) {
      if (rescueMarker) {
        map.removeLayer(rescueMarker);
      }
      
      var icon = L.divIcon({
        className: 'rescue-marker',
        html: '🐾',
        iconSize: [50, 50],
        iconAnchor: [25, 25]
      });
      
      rescueMarker = L.marker([lat, lng], { icon: icon }).addTo(map);
      rescueMarker.bindPopup('<b>' + title + '</b>').openPopup();
      map.setView([lat, lng], 16);
    }
    
    window.addEventListener('message', function(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'setLocation') {
          setRescueLocation(data.lat, data.lng, data.title);
        }
      } catch (e) {}
    });
  </script>
</body>
</html>
`;

// Workflow steps configuration
const WORKFLOW_STEPS = [
  { status: 'in_progress', label: 'Accepted', icon: 'checkmark-circle', color: '#10B981', description: 'Rescue request accepted' },
  { status: 'on_the_way', label: 'On the Way', icon: 'car', color: '#3B82F6', description: 'Heading to rescue location' },
  { status: 'arrived', label: 'Arrived', icon: 'location', color: '#8B5CF6', description: 'Arrived at rescue location' },
  { status: 'pending_verification', label: 'Submitted', icon: 'cloud-upload', color: '#F59E0B', description: 'Awaiting admin verification' },
  { status: 'rescued', label: 'Completed', icon: 'shield-checkmark', color: '#10B981', description: 'Rescue verified and complete' },
];

// Mission statuses that indicate an active/locked mission
const ACTIVE_MISSION_STATUSES = ['in_progress', 'on_the_way', 'arrived', 'pending_verification'];

// Helper function to check if mission is active (user should be locked)
const isMissionActive = (mission) => {
  return mission && ACTIVE_MISSION_STATUSES.includes(mission.status);
};

const UserRescueMissionScreen = ({ activeMission, onMissionComplete, onRefresh }) => {
  const { user } = useAuth();
  const [mission, setMission] = useState(activeMission);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [completionPhoto, setCompletionPhoto] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const webViewRef = React.useRef(null);

  // Prevent back button from leaving this screen while mission is active
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isMissionActive(mission)) {
        Alert.alert(
          'Mission In Progress',
          'You cannot leave while a rescue mission is active. Please complete or cancel the mission first.',
          [{ text: 'OK' }]
        );
        return true; // Prevent default back behavior
      }
      return false;
    });

    return () => backHandler.remove();
  }, [mission]);

  // Update mission when prop changes
  useEffect(() => {
    if (activeMission) {
      setMission(activeMission);
    }
  }, [activeMission]);

  // Refresh mission data
  const refreshMission = useCallback(async () => {
    if (!mission?.id) return;
    
    try {
      setRefreshing(true);
      const response = await fetch(`${CONFIG.API_URL}/rescue-reports/${mission.id}`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Process images array to get image_url (same as backend /my-active-mission does)
        let processedData = { ...data };
        
        // Parse images if stored as JSON string
        if (processedData.images && typeof processedData.images === 'string') {
          try {
            processedData.images = JSON.parse(processedData.images);
          } catch (e) {
            processedData.images = [];
          }
        }
        
        // Get first image as image_url for display (if not already set)
        if (!processedData.image_url && processedData.images && processedData.images.length > 0) {
          processedData.image_url = processedData.images[0];
        }
        
        // Use location_description as location if not present
        if (!processedData.location) {
          processedData.location = processedData.location_description || processedData.city;
        }
        
        // Update mission data
        setMission(processedData);
        
        // Only clear local photo if the server has a completion_photo AND status is not 'arrived'
        // This means the photo was successfully submitted
        // If status is still 'arrived', keep whatever local photo the user has selected
        if (processedData.completion_photo && processedData.status !== 'arrived') {
          // Photo was submitted and status changed, clear local state
          setCompletionPhoto(null);
          setCompletionNotes('');
        }
        // If status is 'arrived', we don't touch completionPhoto at all - it stays as is
        
        // Check if mission is now complete
        if (processedData.status === 'rescued') {
          Alert.alert(
            '🎉 Mission Complete!',
            'Your rescue has been verified and approved by the admin. Great work!',
            [{ text: 'Return to Dashboard', onPress: () => onMissionComplete?.() }]
          );
        }
      }
    } catch (error) {
      console.error('Error refreshing mission:', error);
    } finally {
      setRefreshing(false);
    }
  }, [mission?.id, user?.token, onMissionComplete]);

  // Auto-refresh every 30 seconds when pending verification
  useEffect(() => {
    let interval;
    if (mission?.status === 'pending_verification') {
      interval = setInterval(refreshMission, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mission?.status, refreshMission]);

  // Send location to map
  const sendLocationToMap = useCallback(() => {
    if (webViewRef.current && mission?.latitude && mission?.longitude) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'setLocation',
        lat: parseFloat(mission.latitude),
        lng: parseFloat(mission.longitude),
        title: mission.title || `Rescue #${mission.id}`,
      }));
    }
  }, [mission]);

  // Get current step index
  const getCurrentStepIndex = () => {
    const index = WORKFLOW_STEPS.findIndex(step => step.status === mission?.status);
    return index >= 0 ? index : 0;
  };

  // Get next status
  const getNextStatus = () => {
    const statusOrder = ['in_progress', 'on_the_way', 'arrived', 'pending_verification', 'rescued'];
    const currentIndex = statusOrder.indexOf(mission?.status);
    if (currentIndex < statusOrder.length - 1) {
      return statusOrder[currentIndex + 1];
    }
    return null;
  };

  // Update mission status
  const updateMissionStatus = async (newStatus) => {
    try {
      setLoading(true);
      
      const response = await fetch(`${CONFIG.API_URL}/rescue-reports/${mission.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (response.ok) {
        setMission(prev => ({ ...prev, status: newStatus }));
        
        const stepLabel = WORKFLOW_STEPS.find(s => s.status === newStatus)?.label || newStatus;
        Alert.alert('Status Updated', `Rescue status updated to: ${stepLabel}`);
      } else {
        const errorMessage = data?.error || data?.message || 'Failed to update status';
        Alert.alert('Error', errorMessage);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', `Failed to update status: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Pick image from gallery
  const pickCompletionPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCompletionPhoto(result.assets[0].uri);
    }
  }, []);

  // Take photo with camera
  const takeCompletionPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCompletionPhoto(result.assets[0].uri);
    }
  }, []);

  // Submit for verification
  const submitForVerification = async () => {
    if (!completionPhoto) {
      Alert.alert('Photo Required', 'Please take or select a photo as proof of rescue completion');
      return;
    }

    Alert.alert(
      'Submit for Verification',
      'Are you sure you want to submit this rescue for admin verification? Make sure the photo clearly shows the rescued pet.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            try {
              setSubmitting(true);

              // Convert image to base64
              const base64 = await FileSystem.readAsStringAsync(completionPhoto, {
                encoding: FileSystem.EncodingType.Base64,
              });
              const extension = completionPhoto.split('.').pop()?.toLowerCase() || 'jpeg';
              const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
              const base64Photo = `data:${mimeType};base64,${base64}`;

              const photoResponse = await fetch(`${CONFIG.API_URL}/rescue-reports/${mission.id}/completion-photo`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${user?.token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  photo: base64Photo,
                  notes: '',
                }),
              });

              const photoData = await photoResponse.json();

              if (!photoResponse.ok) {
                const errorMsg = photoData?.error || 'Failed to upload photo';
                throw new Error(errorMsg);
              }

              // Photo upload was successful and status is now pending_verification
              setMission(prev => ({ ...prev, status: 'pending_verification' }));
              Alert.alert(
                'Submitted Successfully!',
                'Your rescue has been submitted for admin verification. Please wait for approval.',
                [{ text: 'OK' }]
              );
            } catch (error) {
              console.error('Error submitting for verification:', error);
              Alert.alert('Error', error.message || 'Failed to submit for verification. Please try again.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  // Handle cannot complete
  const handleCannotComplete = useCallback(() => {
    Alert.alert(
      'Cannot Complete Rescue',
      'Please select a reason:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pet Not Found', onPress: () => submitCannotComplete('Pet not found at location') },
        { text: 'Location Inaccessible', onPress: () => submitCannotComplete('Location is inaccessible') },
        { text: 'Pet Already Rescued', onPress: () => submitCannotComplete('Pet was already rescued by someone else') },
        { text: 'Other Issue', onPress: () => submitCannotComplete('Other issue encountered') },
      ]
    );
  }, []);

  const submitCannotComplete = async (reason) => {
    try {
      setLoading(true);
      const response = await fetch(`${CONFIG.API_URL}/rescue-reports/${mission.id}/cancel`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          reason: reason,
        }),
      });

      if (response.ok) {
        // Clear local state immediately
        setMission(null);
        setCompletionPhoto(null);
        setCompletionNotes('');
        
        Alert.alert(
          'Rescue Cancelled',
          'The rescue has been released back to the available queue.',
          [{ text: 'OK', onPress: () => onMissionComplete?.() }]
        );
      } else {
        const data = await response.json();
        Alert.alert('Error', data.error || 'Failed to cancel rescue');
      }
    } catch (error) {
      console.error('Error cancelling rescue:', error);
      Alert.alert('Error', 'Failed to cancel rescue');
    } finally {
      setLoading(false);
    }
  };

  // Open Google Maps navigation with turn-by-turn directions
  const openNavigation = async () => {
    const lat = mission?.latitude;
    const lng = mission?.longitude;
    const label = encodeURIComponent(mission?.title || mission?.location || 'Rescue Location');
    
    if (lat && lng) {
      // Google Maps navigation URL - opens directly in navigation mode with directions
      const googleMapsNavigationUrl = Platform.select({
        // iOS: Try Google Maps app first, fallback to Apple Maps
        ios: `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving&zoom=15`,
        // Android: Use Google Maps navigation intent
        android: `google.navigation:q=${lat},${lng}&mode=d`,
      });
      
      // Web fallback URL for Google Maps with directions
      const googleMapsWebUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      
      try {
        // Check if Google Maps is installed
        const canOpenGoogleMaps = await Linking.canOpenURL(googleMapsNavigationUrl);
        
        if (canOpenGoogleMaps) {
          // Open Google Maps with navigation mode
          await Linking.openURL(googleMapsNavigationUrl);
        } else {
          // Fallback to Google Maps web URL (will open in browser or Google Maps if installed)
          await Linking.openURL(googleMapsWebUrl);
        }
      } catch (error) {
        console.error('Error opening navigation:', error);
        // Final fallback - try web URL
        try {
          await Linking.openURL(googleMapsWebUrl);
        } catch (fallbackError) {
          Alert.alert(
            'Navigation Error',
            'Unable to open Google Maps. Please make sure you have Google Maps installed.',
            [{ text: 'OK' }]
          );
        }
      }
    } else if (mission?.location) {
      // If no coordinates, use address-based navigation
      const address = encodeURIComponent(mission.location);
      const googleMapsWebUrl = `https://www.google.com/maps/dir/?api=1&destination=${address}&travelmode=driving`;
      
      try {
        await Linking.openURL(googleMapsWebUrl);
      } catch (error) {
        Alert.alert(
          'Navigation Error',
          'Unable to open Google Maps for navigation.',
          [{ text: 'OK' }]
        );
      }
    } else {
      Alert.alert(
        'Location Unavailable',
        'No location coordinates available for this rescue.',
        [{ text: 'OK' }]
      );
    }
  };

  // Format time ago
  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Get urgency color
  const getUrgencyColor = useCallback((urgency) => {
    switch (urgency?.toLowerCase()) {
      case 'critical': return '#DC2626';
      case 'high': return '#F59E0B';
      case 'medium': return '#3B82F6';
      default: return '#6B7280';
    }
  }, []);

  if (!mission) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading mission...</Text>
        </View>
      </View>
    );
  }

  const currentStepIndex = getCurrentStepIndex();
  const nextStatus = getNextStatus();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.missionBadge}>
            <Ionicons name="radio" size={16} color="#FFF" />
            <Text style={styles.missionBadgeText}>ACTIVE MISSION</Text>
          </View>
          <Text style={styles.headerTitle}>Rescue Mission</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={refreshMission} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshMission}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Mission Info Card */}
        <View style={styles.missionCard}>
          {mission.image_url && (
            <Image source={{ uri: getImageUrl(mission.image_url) }} style={styles.missionImage} />
          )}
          <View style={styles.missionInfo}>
            <View style={styles.missionHeader}>
              <Text style={styles.missionTitle}>
                {mission.title || `Rescue #${mission.id}`}
              </Text>
              <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor(mission.urgency) + '20' }]}>
                <View style={[styles.urgencyDot, { backgroundColor: getUrgencyColor(mission.urgency) }]} />
                <Text style={[styles.urgencyText, { color: getUrgencyColor(mission.urgency) }]}>
                  {mission.urgency || 'Normal'}
                </Text>
              </View>
            </View>
            
            <View style={styles.missionMeta}>
              <Ionicons name="time-outline" size={14} color={COLORS.textMedium} />
              <Text style={styles.missionMetaText}>
                Reported {formatTimeAgo(mission.created_at)}
              </Text>
            </View>

            {mission.description && (
              <Text style={styles.missionDescription} numberOfLines={3}>
                {mission.description}
              </Text>
            )}
          </View>
        </View>

        {/* Location Card with Map */}
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <Ionicons name="location" size={20} color={COLORS.primary} />
            <Text style={styles.locationTitle}>Rescue Location</Text>
            <TouchableOpacity onPress={openNavigation} style={styles.navigateBtn}>
              <Ionicons name="navigate" size={18} color={COLORS.primary} />
              <Text style={styles.navigateBtnText}>Navigate</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.locationAddress}>{mission.location || 'Location not specified'}</Text>
          
          {mission.latitude && mission.longitude && (
            <View style={styles.mapContainer}>
              <WebView
                ref={webViewRef}
                source={{ html: RESCUE_MAP_HTML }}
                style={styles.mapWebView}
                onLoad={sendLocationToMap}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                scrollEnabled={false}
              />
            </View>
          )}
        </View>

        {/* Requester Info */}
        {(mission.reporter_id || mission.guest_name) && (
          <View style={styles.requesterCard}>
            <View style={styles.requesterHeader}>
              <Ionicons name="person" size={20} color={COLORS.primary} />
              <Text style={styles.requesterTitle}>Requester Information</Text>
            </View>
            
            {mission.reporter_id ? (
              <View style={styles.requesterInfo}>
                <Text style={styles.requesterName}>
                  {mission.reporter_name || `User #${mission.reporter_id}`}
                </Text>
                <View style={styles.registeredBadge}>
                  <Ionicons name="checkmark-circle" size={12} color="#059669" />
                  <Text style={styles.registeredText}>Registered User</Text>
                </View>
              </View>
            ) : (
              <View style={styles.requesterInfo}>
                <Text style={styles.requesterName}>{mission.guest_name || 'Anonymous'}</Text>
                <View style={styles.guestBadge}>
                  <Ionicons name="person-outline" size={12} color="#6B7280" />
                  <Text style={styles.guestText}>Guest Reporter</Text>
                </View>
                {mission.guest_phone && (
                  <TouchableOpacity
                    style={styles.contactRow}
                    onPress={() => Linking.openURL(`tel:${mission.guest_phone}`)}
                  >
                    <Ionicons name="call" size={14} color={COLORS.primary} />
                    <Text style={styles.contactText}>{mission.guest_phone}</Text>
                  </TouchableOpacity>
                )}
                {mission.guest_email && (
                  <TouchableOpacity
                    style={styles.contactRow}
                    onPress={() => Linking.openURL(`mailto:${mission.guest_email}`)}
                  >
                    <Ionicons name="mail" size={14} color={COLORS.primary} />
                    <Text style={styles.contactText}>{mission.guest_email}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* Progress Tracker */}
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>Mission Progress</Text>
          
          <View style={styles.stepsContainer}>
            {WORKFLOW_STEPS.map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const isPending = index > currentStepIndex;
              
              return (
                <View key={step.status} style={styles.stepRow}>
                  {/* Step Line */}
                  {index < WORKFLOW_STEPS.length - 1 && (
                    <View style={[
                      styles.stepLine,
                      isCompleted ? styles.stepLineCompleted : styles.stepLinePending
                    ]} />
                  )}
                  
                  {/* Step Circle */}
                  <View style={[
                    styles.stepCircle,
                    isCompleted && { backgroundColor: step.color },
                    isCurrent && { backgroundColor: step.color, borderWidth: 3, borderColor: step.color + '40' },
                    isPending && styles.stepCirclePending,
                  ]}>
                    <Ionicons
                      name={isCompleted || isCurrent ? step.icon : 'ellipse-outline'}
                      size={16}
                      color={isCompleted || isCurrent ? '#FFF' : '#9CA3AF'}
                    />
                  </View>
                  
                  {/* Step Content */}
                  <View style={styles.stepContent}>
                    <Text style={[
                      styles.stepLabel,
                      isCompleted && styles.stepLabelCompleted,
                      isCurrent && styles.stepLabelCurrent,
                      isPending && styles.stepLabelPending,
                    ]}>
                      {step.label}
                    </Text>
                    <Text style={styles.stepDescription}>{step.description}</Text>
                    {isCurrent && mission.status !== 'pending_verification' && mission.status !== 'rescued' && (
                      <Text style={styles.stepCurrentHint}>← Current Step</Text>
                    )}
                    {mission.status === 'pending_verification' && step.status === 'pending_verification' && (
                      <Text style={styles.stepPendingHint}>⏳ Waiting for admin approval...</Text>
                    )}
                    {mission.status === 'rescued' && step.status === 'rescued' && (
                      <Text style={styles.stepVerifiedHint}>✓ Verified by admin</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Action Section */}
        <View style={styles.actionCard}>
          {/* Show appropriate action based on status */}
          {mission.status === 'in_progress' && (
            <>
              <Text style={styles.actionTitle}>Ready to head out?</Text>
              <Text style={styles.actionDescription}>
                Tap the button below when you start heading to the rescue location.
              </Text>
              <TouchableOpacity
                style={[styles.actionBtn, styles.onTheWayBtn]}
                onPress={() => updateMissionStatus('on_the_way')}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="car" size={24} color="#FFF" />
                    <Text style={styles.actionBtnText}>I'm On the Way</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          {mission.status === 'on_the_way' && (
            <>
              <Text style={styles.actionTitle}>Have you arrived?</Text>
              <Text style={styles.actionDescription}>
                Tap the button below when you arrive at the rescue location.
              </Text>
              <TouchableOpacity
                style={[styles.actionBtn, styles.arrivedBtn]}
                onPress={() => updateMissionStatus('arrived')}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="location" size={24} color="#FFF" />
                    <Text style={styles.actionBtnText}>I've Arrived</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          {mission.status === 'arrived' && (
            <>
              <Text style={styles.actionTitle}>Complete the Rescue</Text>
              <Text style={styles.actionDescription}>
                Take a photo of the rescued pet as proof, then submit for admin verification.
              </Text>
              
              {/* Photo Upload */}
              <View style={styles.photoSection}>
                {completionPhoto ? (
                  <View style={styles.photoPreviewContainer}>
                    <Image source={{ uri: completionPhoto }} style={styles.photoPreview} />
                    <TouchableOpacity
                      style={styles.removePhotoBtn}
                      onPress={() => setCompletionPhoto(null)}
                    >
                      <Ionicons name="close-circle" size={30} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.photoButtons}>
                    <TouchableOpacity style={styles.photoOptionBtn} onPress={takeCompletionPhoto}>
                      <Ionicons name="camera" size={32} color={COLORS.primary} />
                      <Text style={styles.photoOptionText}>Take Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.photoOptionBtn} onPress={pickCompletionPhoto}>
                      <Ionicons name="images" size={32} color={COLORS.primary} />
                      <Text style={styles.photoOptionText}>Gallery</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Notes */}
              <TextInput
                style={styles.notesInput}
                placeholder="Add any notes about the rescue (optional)"
                placeholderTextColor={COLORS.textMedium}
                value={completionNotes}
                onChangeText={setCompletionNotes}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  styles.submitBtn,
                  !completionPhoto && styles.actionBtnDisabled,
                ]}
                onPress={submitForVerification}
                disabled={!completionPhoto || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={24} color="#FFF" />
                    <Text style={styles.actionBtnText}>Submit for Verification</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          {mission.status === 'pending_verification' && (
            <View style={styles.pendingBox}>
              <Ionicons name="hourglass" size={48} color="#F59E0B" />
              <Text style={styles.pendingTitle}>Awaiting Admin Verification</Text>
              <Text style={styles.pendingText}>
                Your rescue submission is being reviewed by an admin. You'll be notified once it's approved.
              </Text>
              {mission.completion_photo && (
                <View style={styles.submittedPhotoContainer}>
                  <Text style={styles.submittedPhotoLabel}>Submitted Photo:</Text>
                  <Image
                    source={{ uri: getImageUrl(mission.completion_photo) }}
                    style={styles.submittedPhoto}
                  />
                </View>
              )}
              <TouchableOpacity style={styles.refreshStatusBtn} onPress={refreshMission}>
                <Ionicons name="refresh" size={18} color={COLORS.primary} />
                <Text style={styles.refreshStatusText}>Check Status</Text>
              </TouchableOpacity>
            </View>
          )}

          {mission.status === 'rescued' && (
            <View style={styles.completedBox}>
              <Ionicons name="checkmark-circle" size={64} color="#10B981" />
              <Text style={styles.completedTitle}>Mission Complete!</Text>
              <Text style={styles.completedText}>
                Your rescue has been verified and approved. Thank you for saving a life!
              </Text>
              {mission.verification_notes && (
                <Text style={styles.verificationNotes}>
                  Admin notes: {mission.verification_notes}
                </Text>
              )}
              <TouchableOpacity
                style={[styles.actionBtn, styles.returnBtn]}
                onPress={() => onMissionComplete?.()}
              >
                <Ionicons name="home" size={24} color="#FFF" />
                <Text style={styles.actionBtnText}>Return to Dashboard</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Cannot Complete - only show when not pending or rescued */}
          {mission.status !== 'pending_verification' && mission.status !== 'rescued' && (
            <TouchableOpacity style={styles.cannotCompleteBtn} onPress={handleCannotComplete}>
              <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
              <Text style={styles.cannotCompleteText}>Cannot Complete This Rescue</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.backgroundWhite,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  missionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
    gap: 4,
    marginBottom: SPACING.xs,
  },
  missionBadgeText: {
    color: '#FFF',
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  refreshBtn: {
    padding: SPACING.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
  },
  missionCard: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  missionImage: {
    width: '100%',
    height: 180,
  },
  missionInfo: {
    padding: SPACING.lg,
  },
  missionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  missionTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    flex: 1,
    marginRight: SPACING.sm,
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  urgencyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  urgencyText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    textTransform: 'uppercase',
  },
  missionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  missionMetaText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginLeft: 4,
  },
  missionDescription: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    lineHeight: 20,
  },
  locationCard: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  locationTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    flex: 1,
    marginLeft: SPACING.sm,
  },
  navigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  navigateBtnText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.primary,
  },
  locationAddress: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    marginBottom: SPACING.md,
  },
  mapContainer: {
    height: 200,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  mapWebView: {
    flex: 1,
  },
  requesterCard: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  requesterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  requesterTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginLeft: SPACING.sm,
  },
  requesterInfo: {
    gap: SPACING.sm,
  },
  requesterName: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
  },
  registeredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
    gap: 4,
  },
  registeredText: {
    fontSize: FONTS.sizes.xs,
    color: '#059669',
    fontWeight: FONTS.weights.medium,
  },
  guestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
    gap: 4,
  },
  guestText: {
    fontSize: FONTS.sizes.xs,
    color: '#6B7280',
    fontWeight: FONTS.weights.medium,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  contactText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.primary,
  },
  progressCard: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  progressTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.lg,
  },
  stepsContainer: {
    paddingLeft: SPACING.xs,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
    position: 'relative',
  },
  stepLine: {
    position: 'absolute',
    left: 15,
    top: 36,
    width: 2,
    height: 50,
  },
  stepLineCompleted: {
    backgroundColor: '#10B981',
  },
  stepLinePending: {
    backgroundColor: '#E5E7EB',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
  },
  stepCirclePending: {
    backgroundColor: '#F3F4F6',
  },
  stepContent: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  stepLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
  },
  stepLabelCompleted: {
    color: '#10B981',
  },
  stepLabelCurrent: {
    color: COLORS.textDark,
    fontWeight: FONTS.weights.bold,
  },
  stepLabelPending: {
    color: COLORS.textMedium,
  },
  stepDescription: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: 2,
  },
  stepCurrentHint: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    marginTop: 4,
    fontWeight: FONTS.weights.semiBold,
  },
  stepPendingHint: {
    fontSize: FONTS.sizes.xs,
    color: '#F59E0B',
    marginTop: 4,
  },
  stepVerifiedHint: {
    fontSize: FONTS.sizes.xs,
    color: '#10B981',
    fontWeight: FONTS.weights.semiBold,
    marginTop: 4,
  },
  actionCard: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  actionDescription: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  actionBtnText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: '#FFF',
  },
  actionBtnDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.7,
  },
  onTheWayBtn: {
    backgroundColor: '#3B82F6',
  },
  arrivedBtn: {
    backgroundColor: '#8B5CF6',
  },
  submitBtn: {
    backgroundColor: '#10B981',
  },
  returnBtn: {
    backgroundColor: COLORS.primary,
    marginTop: SPACING.lg,
  },
  photoSection: {
    marginBottom: SPACING.lg,
  },
  photoPreviewContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.lg,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 15,
  },
  photoButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.xl,
  },
  photoOptionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.primary + '30',
    borderStyle: 'dashed',
    width: 120,
    height: 100,
  },
  photoOptionText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    marginTop: SPACING.sm,
    fontWeight: FONTS.weights.medium,
  },
  notesInput: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark,
    minHeight: 80,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.lg,
    textAlignVertical: 'top',
  },
  pendingBox: {
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: '#FEF3C7',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  pendingTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: '#92400E',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  pendingText: {
    fontSize: FONTS.sizes.md,
    color: '#92400E',
    textAlign: 'center',
    lineHeight: 20,
  },
  submittedPhotoContainer: {
    marginTop: SPACING.lg,
    width: '100%',
  },
  submittedPhotoLabel: {
    fontSize: FONTS.sizes.sm,
    color: '#92400E',
    marginBottom: SPACING.sm,
    fontWeight: FONTS.weights.medium,
  },
  submittedPhoto: {
    width: '100%',
    height: 150,
    borderRadius: RADIUS.md,
  },
  refreshStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
  },
  refreshStatusText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.primary,
    fontWeight: FONTS.weights.medium,
  },
  completedBox: {
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: '#D1FAE5',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  completedTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: '#065F46',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  completedText: {
    fontSize: FONTS.sizes.md,
    color: '#065F46',
    textAlign: 'center',
    lineHeight: 20,
  },
  verificationNotes: {
    fontSize: FONTS.sizes.sm,
    color: '#065F46',
    marginTop: SPACING.md,
    fontStyle: 'italic',
  },
  cannotCompleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.lg,
    gap: SPACING.xs,
  },
  cannotCompleteText: {
    fontSize: FONTS.sizes.sm,
    color: '#DC2626',
    fontWeight: FONTS.weights.medium,
  },
  bottomSpacing: {
    height: 40,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default memo(UserRescueMissionScreen);
