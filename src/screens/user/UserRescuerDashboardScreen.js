import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
  Dimensions,
  Modal,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { rescueService, userService, shelterService } from '../../services';
import CONFIG from '../../config/config';
import { getImageUrl, getTimeAgo } from './shared';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Map HTML for rescuer view
const RESCUER_MAP_HTML = `
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
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.3);
      border: 3px solid white;
    }
    .marker-pending { background: #FFA726; }
    .marker-critical { background: #DC2626; }
    .marker-in_progress { background: #2196F3; }
    
    .popup-content {
      padding: 8px;
      min-width: 200px;
    }
    .popup-title {
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 4px;
      color: #333;
    }
    .popup-location {
      font-size: 12px;
      color: #666;
      margin-bottom: 8px;
    }
    .popup-status {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .status-pending { background: #FFF3E0; color: #E65100; }
    .status-critical { background: #FFEBEE; color: #C62828; }
    .status-in_progress { background: #E3F2FD; color: #1565C0; }
    
    .popup-btn {
      display: block;
      width: 100%;
      margin-top: 10px;
      padding: 8px;
      background: linear-gradient(135deg, #8B4513 0%, #A0522D 100%);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([14.5995, 120.9842], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);
    
    var markers = [];
    
    function clearMarkers() {
      markers.forEach(function(m) { map.removeLayer(m); });
      markers = [];
    }
    
    function getMarkerClass(status, urgency) {
      if (urgency === 'critical') return 'marker-critical';
      if (status === 'in_progress') return 'marker-in_progress';
      return 'marker-pending';
    }
    
    function getStatusClass(status) {
      if (status === 'in_progress') return 'status-in_progress';
      return 'status-pending';
    }
    
    function addRescueMarkers(rescues) {
      clearMarkers();
      var bounds = [];
      
      rescues.forEach(function(rescue) {
        if (!rescue.latitude || !rescue.longitude) return;
        
        var lat = parseFloat(rescue.latitude);
        var lng = parseFloat(rescue.longitude);
        
        var icon = L.divIcon({
          className: 'rescue-marker ' + getMarkerClass(rescue.status, rescue.urgency),
          html: '🐾',
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });
        
        var marker = L.marker([lat, lng], { icon: icon }).addTo(map);
        
        var popupContent = '<div class="popup-content">' +
          '<div class="popup-title">' + (rescue.title || 'Rescue Report #' + rescue.id) + '</div>' +
          '<div class="popup-location">📍 ' + (rescue.location || 'Unknown location') + '</div>' +
          '<span class="popup-status ' + getStatusClass(rescue.status) + '">' + (rescue.status || 'pending') + '</span>' +
          '<button class="popup-btn" onclick="respondToRescue(' + rescue.id + ')">Respond to Rescue</button>' +
          '</div>';
        
        marker.bindPopup(popupContent);
        markers.push(marker);
        bounds.push([lat, lng]);
      });
      
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }
    }
    
    function respondToRescue(id) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'respond', rescueId: id }));
    }
    
    // Listen for rescue data from React Native
    window.addEventListener('message', function(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'rescues') {
          addRescueMarkers(data.rescues);
        }
      } catch (e) {}
    });
  </script>
</body>
</html>
`;

// Constants extracted outside component for performance
const EMERGENCY_HOTLINE = '0917-123-4567';

// Workflow steps configuration
const WORKFLOW_STEPS = [
  { status: 'in_progress', label: 'Accepted', icon: 'checkmark-circle', color: '#10B981' },
  { status: 'on_the_way', label: 'On the Way', icon: 'car', color: '#3B82F6' },
  { status: 'arrived', label: 'Arrived', icon: 'location', color: '#8B5CF6' },
  { status: 'pending_verification', label: 'Submitted', icon: 'cloud-upload', color: '#F59E0B' },
  { status: 'rescued', label: 'Verified', icon: 'shield-checkmark', color: '#10B981' },
];

const UserRescuerDashboardScreen = ({ onGoBack, onCheckRescuerStatus, onStartMission }) => {
  const { user, activeMission } = useAuth();
  const [rescueReports, setRescueReports] = useState([]);
  const [myRescues, setMyRescues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('Rescuer');
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'myRescues'
  const [reportFilter, setReportFilter] = useState('all'); // 'all', 'active', 'critical', 'completed'
  const [selectedReport, setSelectedReport] = useState(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusNotes, setStatusNotes] = useState('');
  const webViewRef = useRef(null);
  
  // Guided workflow states
  const [workflowModalVisible, setWorkflowModalVisible] = useState(false);
  const [workflowReport, setWorkflowReport] = useState(null);
  const [completionPhoto, setCompletionPhoto] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [submittingWorkflow, setSubmittingWorkflow] = useState(false);
  
  // Shelter transfer modal states
  const [shelterModalVisible, setShelterModalVisible] = useState(false);
  const [selectedRescueForShelter, setSelectedRescueForShelter] = useState(null);
  const [availableShelters, setAvailableShelters] = useState([]);
  const [loadingShelters, setLoadingShelters] = useState(false);
  const [selectedShelter, setSelectedShelter] = useState(null);
  const [shelterTransferNotes, setShelterTransferNotes] = useState('');
  const [submittingTransfer, setSubmittingTransfer] = useState(false);

  useEffect(() => {
    // Check rescuer status first to ensure user is still verified
    checkRescuerStatusOnMount();
    fetchUserProfile();
    fetchRescueReports();
    fetchMyRescues();
  }, []);

  // Check if user is still a verified rescuer on mount
  const checkRescuerStatusOnMount = async () => {
    if (!user?.id) {
      Alert.alert(
        'Access Denied',
        'You must be logged in to access the rescuer dashboard.',
        [{ text: 'OK', onPress: onGoBack }],
        { cancelable: false }
      );
      return;
    }

    try {
      const timestamp = new Date().getTime();
      // Get auth token from AsyncStorage
      const token = await AsyncStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      
      const response = await fetch(
        `${CONFIG.API_URL}/rescuer-applications/my-application?t=${timestamp}`,
        {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Authorization': token ? `Bearer ${token}` : '',
          }
        }
      );
      const data = await response.json();
      
      // If user is not approved, deny access immediately
      if (!data.hasApplication || data.application?.status !== 'approved') {
        const statusMessage = data.application?.status === 'revoked' 
          ? 'Your rescuer verification has been revoked. You no longer have access to the rescuer dashboard.'
          : data.application?.status === 'rejected'
          ? 'Your rescuer application has been rejected. You do not have access to the rescuer dashboard.'
          : 'You do not have an approved rescuer application. Access denied.';
        
        Alert.alert(
          'Access Denied',
          statusMessage,
          [{ text: 'OK', onPress: onGoBack }],
          { cancelable: false }
        );
        return;
      }
    } catch (error) {
      console.error('Error checking rescuer status:', error);
      // On error, still allow access but log it
    }
  };

  const fetchUserProfile = async () => {
    try {
      const profileResponse = await userService.getProfile();
      if (profileResponse.success && profileResponse.data) {
        setUserName(profileResponse.data.full_name || 'Rescuer');
      } else if (profileResponse.data) {
        setUserName(profileResponse.data.full_name || 'Rescuer');
      }
    } catch (error) {
      // Silently ignore 403 errors (user suspended)
      if (error?.status !== 403) {
        console.error('Error fetching user profile:', error);
      }
    }
  };

  const fetchRescueReports = async () => {
    try {
      setLoading(true);
      const response = await rescueService.getRescueReports();
      if (response.success && Array.isArray(response.data)) {
        setRescueReports(response.data);
      } else if (Array.isArray(response.data)) {
        setRescueReports(response.data);
      } else if (Array.isArray(response)) {
        setRescueReports(response);
      }
    } catch (error) {
      // Silently ignore 403 errors (user suspended)
      if (error?.status !== 403) {
        console.error('Error fetching rescue reports:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    
    // Re-check rescuer status first
    if (onCheckRescuerStatus) {
      try {
        // Verify current rescuer status
        const timestamp = new Date().getTime();
        // Get auth token from AsyncStorage
        const token = await AsyncStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
        
        const response = await fetch(
          `${CONFIG.API_URL}/rescuer-applications/my-application?t=${timestamp}`,
          {
            cache: 'no-cache',
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache',
              'Authorization': token ? `Bearer ${token}` : '',
            }
          }
        );
        const data = await response.json();
        
        // If user is no longer a verified rescuer, show alert and go back
        if (data.hasApplication && data.application?.status !== 'approved') {
          setRefreshing(false);
          Alert.alert(
            'Access Revoked',
            'Your rescuer verification has been revoked. You no longer have access to the rescuer dashboard.',
            [{ text: 'OK', onPress: onGoBack }],
            { cancelable: false }
          );
          return;
        }
      } catch (error) {
        // Silently ignore 403 errors (user suspended)
        if (error?.status !== 403) {
          console.error('Error checking rescuer status:', error);
        }
      }
    }
    
    // Continue with normal refresh
    await Promise.all([fetchUserProfile(), fetchRescueReports(), fetchMyRescues()]);
    
    setRefreshing(false);
  }, [onCheckRescuerStatus, user?.id, onGoBack]);

  const handleEmergencyCall = useCallback(() => {
    Alert.alert(
      'Emergency Hotline',
      `Call ${EMERGENCY_HOTLINE} for urgent animal rescue emergencies?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call Now', onPress: () => Linking.openURL(`tel:${EMERGENCY_HOTLINE.replace(/-/g, '')}`) },
      ]
    );
  }, []);

  // ========== GUIDED WORKFLOW FUNCTIONS ==========
  
  // Open the guided workflow modal for a rescue
  const openWorkflowModal = useCallback((report) => {
    setWorkflowReport(report);
    setCompletionPhoto(null);
    setCompletionNotes('');
    setWorkflowModalVisible(true);
  }, []);

  // Get current step index based on status
  const getCurrentStepIndex = useCallback((status) => {
    const statusMap = {
      'in_progress': 0,
      'on_the_way': 1,
      'arrived': 2,
      'pending_verification': 3,
      'rescued': 4,
    };
    return statusMap[status] ?? 0;
  }, []);

  // Get next status in the workflow
  const getNextStatus = useCallback((currentStatus) => {
    const flow = {
      'in_progress': 'on_the_way',
      'on_the_way': 'arrived',
      'arrived': 'pending_verification', // This requires photo upload
    };
    return flow[currentStatus];
  }, []);

  // Update workflow status (step-by-step)
  const updateWorkflowStatus = async (newStatus) => {
    if (!workflowReport) return;
    
    setSubmittingWorkflow(true);
    try {
      const response = await fetch(`${CONFIG.API_URL}/rescue-reports/${workflowReport.id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();
      
      Alert.alert('Status Updated', data.message || `Status updated to ${newStatus.replace(/_/g, ' ')}`);
      
      // Update the workflow report locally
      setWorkflowReport(prev => ({ ...prev, status: newStatus }));
      
      // Refresh data
      fetchRescueReports();
      fetchMyRescues();
    } catch (error) {
      console.error('Workflow status update error:', error);
      Alert.alert('Error', 'Failed to update status. Please try again.');
    } finally {
      setSubmittingWorkflow(false);
    }
  };

  // Pick image for completion proof
  const pickCompletionPhoto = useCallback(async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photos to upload proof.');
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
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  }, []);

  // Take photo with camera for completion proof
  const takeCompletionPhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow camera access to take a photo.');
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
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  }, []);

  // Submit rescue for verification with photo proof
  const submitForVerification = async () => {
    if (!workflowReport) return;
    
    if (!completionPhoto) {
      Alert.alert('Photo Required', 'Please upload or take a photo as proof of the rescued pet.');
      return;
    }

    setSubmittingWorkflow(true);
    try {
      // Convert image to base64
      const base64 = await FileSystem.readAsStringAsync(completionPhoto, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const extension = completionPhoto.split('.').pop()?.toLowerCase() || 'jpeg';
      const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
      const base64Photo = `data:${mimeType};base64,${base64}`;

      const uploadResponse = await fetch(`${CONFIG.API_URL}/rescue-reports/${workflowReport.id}/completion-photo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photo: base64Photo,
          notes: completionNotes || '',
        }),
      });

      const uploadData = await uploadResponse.json();

      if (uploadData.success) {
        Alert.alert(
          'Submitted for Verification',
          'Your rescue has been submitted for admin verification. You will be notified once it is approved.',
          [{ text: 'OK', onPress: () => setWorkflowModalVisible(false) }]
        );
        
        setWorkflowReport(prev => ({ ...prev, status: 'pending_verification' }));
        fetchRescueReports();
        fetchMyRescues();
      } else {
        // Fallback: update status with photo URL via regular endpoint
        const statusResponse = await fetch(`${CONFIG.API_URL}/rescue-reports/${workflowReport.id}/status`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user?.token}`
          },
          body: JSON.stringify({ 
            status: 'pending_verification',
            notes: completionNotes,
            completion_photo: base64Photo
          }),
        });

        const statusData = await statusResponse.json();
        
        Alert.alert(
          'Submitted for Verification',
          statusData.message || 'Your rescue has been submitted for admin verification.',
          [{ text: 'OK', onPress: () => setWorkflowModalVisible(false) }]
        );
        
        fetchRescueReports();
        fetchMyRescues();
      }
    } catch (error) {
      console.error('Submit verification error:', error);
      Alert.alert('Error', 'Failed to submit for verification. Please try again.');
    } finally {
      setSubmittingWorkflow(false);
    }
  };

  // Handle cannot complete from workflow
  const handleCannotCompleteWorkflow = () => {
    Alert.alert(
      'Cannot Complete Rescue',
      'Please select a reason:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Pet Not Found',
          onPress: () => submitCannotComplete('Pet was not found at the location')
        },
        { 
          text: 'Pet Already Rescued',
          onPress: () => submitCannotComplete('Pet was already rescued by someone else')
        },
        { 
          text: 'Unsafe Situation',
          onPress: () => submitCannotComplete('Situation was unsafe to proceed')
        },
        { 
          text: 'Other Reason',
          onPress: () => {
            setWorkflowModalVisible(false);
            setSelectedReport(workflowReport);
            setStatusModalVisible(true);
          }
        },
      ]
    );
  };

  const submitCannotComplete = async (reason) => {
    if (!workflowReport) return;
    
    setSubmittingWorkflow(true);
    try {
      await fetch(`${CONFIG.API_URL}/rescue-reports/${workflowReport.id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify({ 
          status: 'cannot_complete',
          notes: reason
        }),
      });

      Alert.alert('Status Updated', 'Rescue marked as cannot complete.');
      setWorkflowModalVisible(false);
      fetchRescueReports();
      fetchMyRescues();
    } catch (error) {
      console.error('Cannot complete error:', error);
      Alert.alert('Error', 'Failed to update status.');
    } finally {
      setSubmittingWorkflow(false);
    }
  };

  // ========== END GUIDED WORKFLOW FUNCTIONS ==========

  // ========== RESCUED ANIMAL ACTIONS ==========

  // Handle adopting a rescued animal
  const handleAdoptRescuedAnimal = (report) => {
    Alert.alert(
      'Adopt This Animal',
      `Would you like to adopt this rescued animal? You will be responsible for providing a loving home.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Adopt!',
          onPress: () => processAdoption(report),
        },
      ]
    );
  };

  const processAdoption = async (report) => {
    try {
      // Check if already has pending/approved adoption
      if (report.rescuer_adoption_status === 'approved') {
        Alert.alert('Already Adopted', 'This animal has already been adopted by you.');
        return;
      }
      
      if (report.rescuer_adoption_status === 'requested') {
        Alert.alert('Pending Request', 'You already have a pending adoption request for this animal. Please wait for admin approval.');
        return;
      }

      // Call the rescuer adoption API
      const result = await rescueService.requestRescuerAdoption(report.id, 'Rescuer wishes to adopt this rescued animal.');
      
      if (result.success) {
        Alert.alert(
          'Adoption Request Submitted! 🏠',
          `Thank you for choosing to adopt! Our admin team will review your request and contact you shortly to complete the adoption process.`,
          [{ text: 'OK' }]
        );
        
        // Refresh the rescued animals list
        fetchRescuedAnimals();
      } else {
        Alert.alert('Error', result.error || 'Failed to submit adoption request. Please try again.');
      }
    } catch (error) {
      console.error('Adoption error:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to submit adoption request. Please try again.';
      Alert.alert('Error', errorMessage);
    }
  };

  // Handle dropping rescued animal to nearest shelter
  const handleDropToShelter = async (report) => {
    setSelectedRescueForShelter(report);
    setSelectedShelter(null);
    setShelterTransferNotes('');
    setLoadingShelters(true);
    setShelterModalVisible(true);
    
    try {
      const shelters = await shelterService.getAvailableShelters();
      setAvailableShelters(shelters || []);
    } catch (error) {
      console.error('Fetch shelters error:', error);
      Alert.alert('Error', 'Failed to fetch available shelters. Please try again.');
    } finally {
      setLoadingShelters(false);
    }
  };

  const handleSelectShelter = (shelter) => {
    setSelectedShelter(shelter);
  };

  const handleConfirmShelterTransfer = async () => {
    if (!selectedShelter || !selectedRescueForShelter) {
      Alert.alert('Error', 'Please select a shelter to continue.');
      return;
    }

    Alert.alert(
      'Confirm Transfer Request',
      `Are you sure you want to request admission for this rescued animal to ${selectedShelter.name}?\n\nThe shelter administrator will review and approve your request.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setSubmittingTransfer(true);
            try {
              const response = await shelterService.createTransferRequest(
                selectedRescueForShelter.id,
                selectedShelter.id,
                shelterTransferNotes,
                selectedRescueForShelter.urgency || 'normal'
              );

              if (response.success) {
                setShelterModalVisible(false);
                setSelectedRescueForShelter(null);
                setSelectedShelter(null);
                setShelterTransferNotes('');

                Alert.alert(
                  'Transfer Request Submitted! 🏛️',
                  `Your request to transfer the rescued animal to ${selectedShelter.name} has been submitted.\n\nThe shelter administrator will review your request and notify you once approved. Please wait for confirmation before bringing the animal.`,
                  [{ text: 'OK' }]
                );
              } else {
                throw new Error(response.error || 'Failed to submit transfer request');
              }
            } catch (error) {
              console.error('Shelter transfer error:', error);
              Alert.alert(
                'Error',
                error.message || 'Failed to submit transfer request. Please try again.'
              );
            } finally {
              setSubmittingTransfer(false);
            }
          },
        },
      ]
    );
  };

  const closeShelterModal = () => {
    setShelterModalVisible(false);
    setSelectedRescueForShelter(null);
    setSelectedShelter(null);
    setShelterTransferNotes('');
  };

  // Helper to get shelter capacity status display
  const getShelterCapacityDisplay = (shelter) => {
    if (!shelter.shelter_capacity || shelter.shelter_capacity === 0) {
      return { text: 'Open Capacity', color: COLORS.success };
    }
    const available = shelter.available_slots || (shelter.shelter_capacity - (shelter.current_count || 0));
    if (available > 5) {
      return { text: `${available} slots available`, color: COLORS.success };
    } else if (available > 0) {
      return { text: `${available} slots left`, color: '#F59E0B' };
    }
    return { text: 'Full', color: COLORS.danger };
  };

  // ========== END RESCUED ANIMAL ACTIONS ==========

  // Accept rescue - proceed to confirmation
  const handleAcceptRescue = async (report) => {
    // Check if user already has an active mission
    if (activeMission) {
      Alert.alert(
        'Active Mission',
        'You already have an active rescue mission. Please complete it before accepting a new rescue.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const response = await fetch(`${CONFIG.API_URL}/rescue-reports/${report.id}/respond`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify({ 
          rescuer_id: user?.id,
          action: 'accept'
        }),
      });
      
      const data = await response.json();
      
      // Close the view modal first
      setViewModalVisible(false);
      
      // Refresh data
      await fetchRescueReports();
      await fetchMyRescues();
      
      // Update the report with the new status for the mission screen
      const updatedReport = { 
        ...report, 
        status: 'in_progress', 
        rescuer_id: user?.id,
        location: report.location || report.location_description || report.city,
        image_url: report.images?.[0] || report.image_url,
      };
      
      if (data.requesterType === 'guest' && data.contactInfo) {
        // Guest requester - show contact info then start mission
        Alert.alert(
          'Rescue Accepted!',
          `${data.message}\n\nContact Information:\n${data.contactInfo.name ? `Name: ${data.contactInfo.name}` : ''}\n${data.contactInfo.phone ? `Phone: ${data.contactInfo.phone}` : ''}\n${data.contactInfo.email ? `Email: ${data.contactInfo.email}` : ''}`.trim(),
          [
            { 
              text: 'Start Rescue Mission', 
              onPress: () => {
                if (onStartMission) {
                  onStartMission(updatedReport);
                } else {
                  openWorkflowModal(updatedReport);
                }
              }
            },
          ]
        );
      } else {
        // Registered user - show success and start mission
        Alert.alert(
          'Rescue Accepted!', 
          data.message || 'The requester has been notified! Ready to start the rescue mission?',
          [
            { 
              text: 'Start Rescue Mission', 
              onPress: () => {
                if (onStartMission) {
                  onStartMission(updatedReport);
                } else {
                  openWorkflowModal(updatedReport);
                }
              }
            },
          ]
        );
      }
    } catch (error) {
      // Silently ignore 403 errors (user suspended)
      if (error?.status !== 403) {
        console.error('Accept rescue error:', error);
      }
      // Still start mission even on error
      const updatedReport = { 
        ...report, 
        status: 'in_progress', 
        rescuer_id: user?.id,
        location: report.location || report.location_description || report.city,
        image_url: report.images?.[0] || report.image_url,
      };
      Alert.alert(
        'Rescue Accepted!', 
        'You have accepted this rescue request!',
        [
          { 
            text: 'Start Rescue Mission', 
            onPress: () => {
              if (onStartMission) {
                onStartMission(updatedReport);
              } else {
                openWorkflowModal(updatedReport);
              }
            }
          },
        ]
      );
      fetchRescueReports();
      fetchMyRescues();
    }
  };

  // Decline rescue with optional feedback
  const handleDeclineRescue = (report) => {
    Alert.alert(
      'Decline Rescue',
      'Please select a reason for declining:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Currently Busy', 
          onPress: () => submitDecline(report, 'Currently busy with another rescue')
        },
        { 
          text: 'Too Far', 
          onPress: () => submitDecline(report, 'Location is too far')
        },
        { 
          text: 'Cannot Assist', 
          onPress: () => submitDecline(report, 'Unable to assist at this time')
        },
      ]
    );
  };

  const submitDecline = async (report, reason) => {
    try {
      await fetch(`${CONFIG.API_URL}/rescue-reports/${report.id}/respond`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify({ 
          rescuer_id: user?.id,
          action: 'decline',
          decline_reason: reason
        }),
      });
      setViewModalVisible(false);
    } catch (error) {
      // Silently ignore 403 errors (user suspended)
      if (error?.status !== 403) {
        console.error('Decline error:', error);
      }
    }
  };

  // Show response options
  const handleRespondToRescue = (report) => {
    Alert.alert(
      'Respond to Rescue',
      `"${report.title || `Report #${report.id}`}"\n\nDo you want to accept this rescue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Decline',
          style: 'destructive',
          onPress: () => handleDeclineRescue(report)
        },
        { 
          text: 'Accept Rescue', 
          onPress: () => handleAcceptRescue(report)
        },
      ]
    );
  };

  // Update rescue status (Arrived, Completed, Cannot Complete)
  const handleUpdateStatus = (report, newStatus) => {
    if (newStatus === 'cannot_complete') {
      setSelectedReport(report);
      setStatusModalVisible(true);
    } else if (newStatus === 'rescued') {
      Alert.alert(
        'Complete Rescue',
        'Mark this rescue as successfully completed?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Complete',
            onPress: () => submitStatusUpdate(report, 'rescued', 'Rescue completed successfully')
          }
        ]
      );
    } else {
      submitStatusUpdate(report, newStatus);
    }
  };

  const submitStatusUpdate = async (report, status, notes = '') => {
    try {
      const response = await fetch(`${CONFIG.API_URL}/rescue-reports/${report.id}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify({ 
          status,
          notes: notes || statusNotes
        }),
      });

      const data = await response.json();
      Alert.alert('Status Updated', data.message || 'Status has been updated.');
      
      setStatusModalVisible(false);
      setStatusNotes('');
      setViewModalVisible(false);
      fetchRescueReports();
      fetchMyRescues();
    } catch (error) {
      // Silently ignore 403 errors (user suspended)
      if (error?.status !== 403) {
        console.error('Status update error:', error);
        Alert.alert('Error', 'Failed to update status. Please try again.');
      }
    }
  };

  // Fetch my assigned rescues
  const fetchMyRescues = async () => {
    try {
      const response = await fetch(`${CONFIG.API_URL}/rescue-reports/rescuer/my-rescues`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setMyRescues(data);
      }
    } catch (error) {
      // Silently ignore 403 errors (user suspended)
      if (error?.status !== 403) {
        console.error('Error fetching my rescues:', error);
      }
    }
  };

  const handleViewReport = (report) => {
    setSelectedReport(report);
    setViewModalVisible(true);
  };

  // Handle WebView messages
  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'respond') {
        const report = rescueReports.find(r => r.id === data.rescueId);
        if (report) {
          handleRespondToRescue(report);
        }
      }
    } catch (error) {
      // Silently ignore 403 errors (user suspended)
      if (error?.status !== 403) {
        console.error('WebView message error:', error);
      }
    }
  };

  // Send rescue data to map
  const sendRescuesToMap = () => {
    if (webViewRef.current && rescueReports.length > 0) {
      const activeRescues = rescueReports.filter(r => r.status !== 'resolved' && r.status !== 'rescued');
      webViewRef.current.postMessage(JSON.stringify({
        type: 'rescues',
        rescues: activeRescues
      }));
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
      case 'new':
        return '#FFA726';
      case 'in_progress':
      case 'in progress':
        return '#2196F3';
      case 'on_the_way':
        return '#3B82F6';
      case 'arrived':
        return '#8B5CF6';
      case 'pending_verification':
        return '#F59E0B';
      case 'resolved':
      case 'completed':
      case 'rescued':
        return '#4CAF50';
      case 'cannot_complete':
      case 'cancelled':
        return '#F44336';
      default:
        return COLORS.textMedium;
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency?.toLowerCase()) {
      case 'critical':
        return '#DC2626';
      case 'high':
        return '#EA580C';
      case 'medium':
        return '#F59E0B';
      case 'low':
        return '#10B981';
      default:
        return COLORS.textMedium;
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  // Memoized filtered reports for performance
  const activeReports = useMemo(() => 
    rescueReports.filter(r => r.status !== 'resolved' && r.status !== 'rescued' && r.rescuer_id !== user?.id),
    [rescueReports, user?.id]
  );
  const completedReports = useMemo(() => 
    rescueReports.filter(r => r.status === 'resolved' || r.status === 'rescued'),
    [rescueReports]
  );
  const criticalReports = useMemo(() => 
    rescueReports.filter(r => r.urgency?.toLowerCase() === 'critical' && r.status !== 'resolved' && r.status !== 'rescued'),
    [rescueReports]
  );
  const myActiveRescues = useMemo(() => 
    myRescues.filter(r => r.status !== 'resolved' && r.status !== 'rescued'),
    [myRescues]
  );
  const myCompletedRescues = useMemo(() => 
    myRescues.filter(r => r.status === 'resolved' || r.status === 'rescued'),
    [myRescues]
  );

  // Check if requester is guest or registered
  const isGuestRequester = (report) => !report.reporter_id;

  // Render report card
  const renderReportCard = (report, showStatusActions = false) => {
    const CardWrapper = showStatusActions ? TouchableOpacity : View;
    const cardProps = showStatusActions ? {
      activeOpacity: 0.8,
      onPress: () => openWorkflowModal(report)
    } : {};

    return (
      <CardWrapper 
        key={report.id} 
        style={styles.reportCard} 
        {...cardProps}
      >
        {/* Tappable area for viewing report details (only for non-assigned rescues) */}
        {!showStatusActions && (
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => handleViewReport(report)}
          >
            <View style={styles.reportCardHeader}>
              <View style={styles.urgencyBadge}>
                <View style={[styles.urgencyDot, { backgroundColor: getUrgencyColor(report.urgency || 'medium') }]} />
                <Text style={[styles.urgencyText, { color: getUrgencyColor(report.urgency || 'medium') }]}>
                  {(report.urgency || 'Medium').toUpperCase()}
                </Text>
              </View>
              <View style={styles.headerBadges}>
                <View style={[styles.requesterBadge, isGuestRequester(report) ? styles.guestBadge : styles.registeredBadge]}>
                  <Ionicons 
                    name={isGuestRequester(report) ? 'person-outline' : 'person'} 
                    size={10} 
                    color={isGuestRequester(report) ? '#9CA3AF' : '#059669'} 
                  />
                  <Text style={[styles.requesterText, isGuestRequester(report) ? styles.guestText : styles.registeredText]}>
                    {isGuestRequester(report) ? 'Guest' : 'Member'}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(report.status) }]}>
                    {report.status?.replace(/_/g, ' ') || 'New'}
                  </Text>
                </View>
              </View>
            </View>
            
            <View style={styles.reportCardBody}>
              {report.images && report.images[0] && (
                <Image source={{ uri: report.images[0] }} style={styles.reportImage} />
              )}
              <View style={styles.reportDetails}>
                <Text style={styles.reportTitle} numberOfLines={2}>
                  {report.title || report.description?.substring(0, 50) || `Rescue Report #${report.id}`}
                </Text>
                <View style={styles.reportMeta}>
                  <Ionicons name="location" size={14} color={COLORS.textMedium} />
                  <Text style={styles.reportMetaText} numberOfLines={1}>
                    {report.location_description || report.location || 'Location not specified'}
                  </Text>
                </View>
                <View style={styles.reportMeta}>
                  <Ionicons name="time" size={14} color={COLORS.textMedium} />
                  <Text style={styles.reportMetaText}>
                    {formatTimeAgo(report.created_at)}
                  </Text>
                </View>
                {report.animal_type && (
                  <View style={styles.reportMeta}>
                    <Ionicons name="paw" size={14} color={COLORS.textMedium} />
                    <Text style={styles.reportMetaText}>{report.animal_type}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* For assigned rescues - show content directly */}
        {showStatusActions && (
          <>
            <View style={styles.reportCardHeader}>
              <View style={styles.urgencyBadge}>
                <View style={[styles.urgencyDot, { backgroundColor: getUrgencyColor(report.urgency || 'medium') }]} />
                <Text style={[styles.urgencyText, { color: getUrgencyColor(report.urgency || 'medium') }]}>
                  {(report.urgency || 'Medium').toUpperCase()}
                </Text>
              </View>
              <View style={styles.headerBadges}>
                <View style={[styles.requesterBadge, isGuestRequester(report) ? styles.guestBadge : styles.registeredBadge]}>
                  <Ionicons 
                    name={isGuestRequester(report) ? 'person-outline' : 'person'} 
                    size={10} 
                    color={isGuestRequester(report) ? '#9CA3AF' : '#059669'} 
                  />
                  <Text style={[styles.requesterText, isGuestRequester(report) ? styles.guestText : styles.registeredText]}>
                    {isGuestRequester(report) ? 'Guest' : 'Member'}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(report.status) }]}>
                    {report.status?.replace(/_/g, ' ') || 'New'}
                  </Text>
                </View>
              </View>
            </View>
            
            <View style={styles.reportCardBody}>
              {report.images && report.images[0] && (
                <Image source={{ uri: report.images[0] }} style={styles.reportImage} />
              )}
              <View style={styles.reportDetails}>
                <Text style={styles.reportTitle} numberOfLines={2}>
                  {report.title || report.description?.substring(0, 50) || `Rescue Report #${report.id}`}
                </Text>
                <View style={styles.reportMeta}>
                  <Ionicons name="location" size={14} color={COLORS.textMedium} />
                  <Text style={styles.reportMetaText} numberOfLines={1}>
                    {report.location_description || report.location || 'Location not specified'}
                  </Text>
                </View>
                <View style={styles.reportMeta}>
                  <Ionicons name="time" size={14} color={COLORS.textMedium} />
                  <Text style={styles.reportMetaText}>
                    {formatTimeAgo(report.created_at)}
                  </Text>
                </View>
                {report.animal_type && (
                  <View style={styles.reportMeta}>
                    <Ionicons name="paw" size={14} color={COLORS.textMedium} />
                    <Text style={styles.reportMetaText}>{report.animal_type}</Text>
                  </View>
                )}
              </View>
            </View>
          </>
        )}
        
        {/* Workflow button for assigned rescues - opens guided workflow */}
        {showStatusActions && report.status !== 'resolved' && report.status !== 'rescued' && (
          <TouchableOpacity 
            style={styles.workflowButton}
            onPress={() => openWorkflowModal(report)}
          >
            <MaterialCommunityIcons name="progress-check" size={18} color={COLORS.textWhite} />
            <Text style={styles.workflowButtonText}>
              {report.status === 'pending_verification' ? 'View Status' : 'Continue Rescue'}
            </Text>
            <View style={styles.workflowProgressIndicator}>
              <Text style={styles.workflowProgressText}>
                {getCurrentStepIndex(report.status) + 1}/5
              </Text>
            </View>
          </TouchableOpacity>
        )}
        
        {/* Respond button for unassigned rescues */}
        {!showStatusActions && report.status !== 'resolved' && report.status !== 'rescued' && (
          <TouchableOpacity 
            style={styles.respondButton} 
            onPress={() => handleRespondToRescue(report)}
            activeOpacity={0.7}
          >
            <FontAwesome5 name="hand-holding-heart" size={16} color={COLORS.textWhite} />
            <Text style={styles.respondButtonText}>Respond to Rescue</Text>
          </TouchableOpacity>
        )}
      </CardWrapper>
    );
  };

  // Get filtered reports based on current filter
  const getFilteredReports = () => {
    switch (reportFilter) {
      case 'active':
        return activeReports;
      case 'critical':
        return criticalReports;
      case 'completed':
        return completedReports;
      default:
        return rescueReports.filter(r => r.rescuer_id !== user?.id);
    }
  };

  const filteredReports = getFilteredReports();

  // Render Dashboard Tab
  const renderDashboard = () => (
    <>
      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
          <TouchableOpacity
            style={[styles.filterChip, reportFilter === 'all' && styles.filterChipActive]}
            onPress={() => setReportFilter('all')}
          >
            <Ionicons name="apps" size={16} color={reportFilter === 'all' ? COLORS.textWhite : COLORS.textMedium} />
            <Text style={[styles.filterChipText, reportFilter === 'all' && styles.filterChipTextActive]}>
              All ({rescueReports.filter(r => r.rescuer_id !== user?.id).length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterChip, reportFilter === 'active' && styles.filterChipActive, reportFilter === 'active' && { backgroundColor: '#FFA726' }]}
            onPress={() => setReportFilter('active')}
          >
            <Ionicons name="alert-circle" size={16} color={reportFilter === 'active' ? COLORS.textWhite : '#FFA726'} />
            <Text style={[styles.filterChipText, reportFilter === 'active' && styles.filterChipTextActive]}>
              Active ({activeReports.length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterChip, reportFilter === 'critical' && styles.filterChipActive, reportFilter === 'critical' && { backgroundColor: '#DC2626' }]}
            onPress={() => setReportFilter('critical')}
          >
            <Ionicons name="warning" size={16} color={reportFilter === 'critical' ? COLORS.textWhite : '#DC2626'} />
            <Text style={[styles.filterChipText, reportFilter === 'critical' && styles.filterChipTextActive]}>
              Critical ({criticalReports.length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterChip, reportFilter === 'completed' && styles.filterChipActive, reportFilter === 'completed' && { backgroundColor: COLORS.success }]}
            onPress={() => setReportFilter('completed')}
          >
            <Ionicons name="checkmark-circle" size={16} color={reportFilter === 'completed' ? COLORS.textWhite : COLORS.success} />
            <Text style={[styles.filterChipText, reportFilter === 'completed' && styles.filterChipTextActive]}>
              Rescued ({completedReports.length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Reports Section */}
      <View style={styles.section}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading rescue reports...</Text>
          </View>
        ) : filteredReports.length > 0 ? (
          filteredReports.map(report => renderReportCard(report))
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="magnify" size={48} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>No Reports Found</Text>
            <Text style={styles.emptyText}>
              {reportFilter === 'all' ? 'No rescue reports available at the moment' :
               reportFilter === 'active' ? 'No active rescue reports' :
               reportFilter === 'critical' ? 'No critical rescues - great news!' :
               'No completed rescues yet'}
            </Text>
          </View>
        )}
      </View>
    </>
  );

  // Render My Rescued Animals Tab
  const renderMyRescuedAnimals = () => (
    <View style={styles.rescuedAnimalsContainer}>
      {/* Header Card */}
      <View style={styles.rescuedAnimalsHeader}>
        <View style={styles.rescuedAnimalsIconContainer}>
          <MaterialCommunityIcons name="heart-multiple" size={28} color={COLORS.textWhite} />
        </View>
        <View style={styles.rescuedAnimalsHeaderContent}>
          <Text style={styles.rescuedAnimalsHeaderTitle}>My Rescued Animals</Text>
          <Text style={styles.rescuedAnimalsHeaderSubtitle}>
            {myCompletedRescues.length} {myCompletedRescues.length === 1 ? 'animal' : 'animals'} rescued
          </Text>
        </View>
      </View>
      
      {myCompletedRescues.length === 0 ? (
        <View style={styles.rescuedEmptyState}>
          <View style={styles.rescuedEmptyIconContainer}>
            <MaterialCommunityIcons name="paw" size={48} color={COLORS.textLight} />
          </View>
          <Text style={styles.rescuedEmptyTitle}>No Rescued Animals Yet</Text>
          <Text style={styles.rescuedEmptySubtext}>
            Animals you successfully rescue will appear here. Keep up the great work!
          </Text>
          <View style={styles.rescuedEmptyTip}>
            <Ionicons name="bulb-outline" size={16} color={COLORS.primary} />
            <Text style={styles.rescuedEmptyTipText}>
              Accept rescue missions from the Reports tab to start saving lives
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.rescuedAnimalsList}>
          {myCompletedRescues.map((report, index) => (
            <View key={report.id} style={styles.rescuedAnimalCard}>
              {/* Animal Info Row */}
              <View style={styles.rescuedAnimalContent}>
                <View style={styles.rescuedAnimalImageContainer}>
                  {report.images && report.images[0] ? (
                    <Image
                      source={{ uri: report.images[0] }}
                      style={styles.rescuedAnimalImage}
                    />
                  ) : (
                    <View style={styles.rescuedAnimalPlaceholder}>
                      <MaterialCommunityIcons name="paw" size={32} color={COLORS.textLight} />
                    </View>
                  )}
                  <View style={styles.rescuedBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.textWhite} />
                  </View>
                </View>
                
                <View style={styles.rescuedAnimalInfo}>
                  <Text style={styles.rescuedAnimalTitle} numberOfLines={1}>
                    {report.title || `Rescue #${report.id}`}
                  </Text>
                  
                  <View style={styles.rescuedAnimalMeta}>
                    <Ionicons name="location-outline" size={14} color={COLORS.textMedium} />
                    <Text style={styles.rescuedAnimalMetaText} numberOfLines={1}>
                      {report.location_description || report.location || 'Location not specified'}
                    </Text>
                  </View>
                  
                  <View style={styles.rescuedAnimalMeta}>
                    <Ionicons name="calendar-outline" size={14} color={COLORS.success} />
                    <Text style={[styles.rescuedAnimalMetaText, { color: COLORS.success }]}>
                      Rescued {new Date(report.updated_at || report.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </Text>
                  </View>
                </View>
              </View>
              
              {/* Action Buttons */}
              <View style={styles.rescuedAnimalActions}>
                <TouchableOpacity
                  style={styles.viewActionBtn}
                  activeOpacity={0.8}
                  onPress={() => handleViewReport(report)}
                >
                  <Ionicons name="eye-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.viewActionText}>View</Text>
                </TouchableOpacity>
                
                {/* Handle Adoption Status */}
                {report.rescuer_adoption_status === 'approved' ? (
                  <View style={styles.adoptedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    <Text style={styles.adoptedBadgeText}>Adopted by You 🏠</Text>
                  </View>
                ) : report.rescuer_adoption_status === 'requested' ? (
                  <View style={styles.pendingAdoptionBadge}>
                    <Ionicons name="time" size={14} color="#F59E0B" />
                    <Text style={styles.pendingAdoptionText}>Adoption Pending...</Text>
                  </View>
                ) : report.rescuer_adoption_status === 'rejected' ? (
                  <>
                    <View style={styles.rejectedAdoptionBadge}>
                      <Ionicons name="close-circle" size={14} color="#EF4444" />
                      <Text style={styles.rejectedAdoptionText}>Adoption Rejected</Text>
                    </View>
                    {/* Show Shelter option after rejection */}
                    {report.shelter_transfer_status !== 'approved' && report.shelter_transfer_status !== 'completed' && (
                      <TouchableOpacity
                        style={styles.shelterActionBtn}
                        activeOpacity={0.8}
                        onPress={() => handleDropToShelter(report)}
                      >
                        <MaterialCommunityIcons name="home-city" size={16} color={COLORS.textWhite} />
                        <Text style={styles.shelterActionText}>Shelter</Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : report.shelter_transfer_status === 'approved' || report.shelter_transfer_status === 'completed' ? (
                  <View style={styles.transferredBadge}>
                    <MaterialCommunityIcons name="home-city" size={14} color="#6366F1" />
                    <Text style={styles.transferredBadgeText}>
                      {report.shelter_transfer_status === 'completed' ? 'At ' : 'Transferring to '}
                      {report.transferred_shelter_name || 'Shelter'}
                    </Text>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.adoptActionBtn}
                      activeOpacity={0.8}
                      onPress={() => handleAdoptRescuedAnimal(report)}
                    >
                      <Ionicons name="heart" size={16} color={COLORS.textWhite} />
                      <Text style={styles.adoptActionText}>Adopt</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.shelterActionBtn}
                      activeOpacity={0.8}
                      onPress={() => handleDropToShelter(report)}
                    >
                      <MaterialCommunityIcons name="home-city" size={16} color={COLORS.textWhite} />
                      <Text style={styles.shelterActionText}>Shelter</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))}
          
          {/* Summary Footer */}
          <View style={styles.rescuedSummaryFooter}>
            <MaterialCommunityIcons name="shield-star" size={20} color={COLORS.success} />
            <Text style={styles.rescuedSummaryText}>
              Thank you for making a difference! 🐾
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          {onGoBack && (
            <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
              <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
          )}
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Rescuer Dashboard</Text>
            <View style={styles.rescuerBadgeRow}>
              <MaterialCommunityIcons name="shield-check" size={16} color={COLORS.success} />
              <Text style={styles.rescuerBadgeText}>Verified Rescuer</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.emergencyHeaderBtn} onPress={handleEmergencyCall} activeOpacity={0.7}>
            <Ionicons name="call" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Welcome Card */}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeIcon}>
            <MaterialCommunityIcons name="shield-star" size={32} color={COLORS.textWhite} />
          </View>
          <View style={styles.welcomeContent}>
            <Text style={styles.welcomeTitle}>Welcome, {userName}!</Text>
            <Text style={styles.welcomeSubtitle}>Thank you for being a hero for animals</Text>
          </View>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'dashboard' && styles.tabActive]}
            onPress={() => setActiveTab('dashboard')}
          >
            <Ionicons 
              name="list" 
              size={18} 
              color={activeTab === 'dashboard' ? COLORS.textWhite : COLORS.textMedium} 
            />
            <Text style={[styles.tabText, activeTab === 'dashboard' && styles.tabTextActive]}>
              Reports
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'myRescues' && styles.tabActive]}
            onPress={() => setActiveTab('myRescues')}
          >
            <MaterialCommunityIcons 
              name="heart-multiple" 
              size={18} 
              color={activeTab === 'myRescues' ? COLORS.textWhite : COLORS.textMedium} 
            />
            <Text style={[styles.tabText, activeTab === 'myRescues' && styles.tabTextActive]}>
              My Rescued Animals
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'dashboard' ? renderDashboard() : renderMyRescuedAnimals()}

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* View Report Modal */}
      <Modal
        visible={viewModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setViewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Details</Text>
              <TouchableOpacity onPress={() => setViewModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            {selectedReport && (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {/* Images */}
                {selectedReport.images && selectedReport.images[0] && (
                  <Image
                    source={{ uri: selectedReport.images[0] }}
                    style={styles.modalImage}
                    resizeMode="cover"
                  />
                )}

                {/* Status Badges */}
                <View style={styles.modalBadgeRow}>
                  <View style={[styles.modalBadge, { backgroundColor: getStatusColor(selectedReport.status) + '20' }]}>
                    <Text style={[styles.modalBadgeText, { color: getStatusColor(selectedReport.status) }]}>
                      {selectedReport.status?.replace(/_/g, ' ').toUpperCase() || 'NEW'}
                    </Text>
                  </View>
                  <View style={[styles.modalBadge, { backgroundColor: getUrgencyColor(selectedReport.urgency) + '20' }]}>
                    <Text style={[styles.modalBadgeText, { color: getUrgencyColor(selectedReport.urgency) }]}>
                      {selectedReport.urgency?.toUpperCase() || 'NORMAL'} URGENCY
                    </Text>
                  </View>
                  {/* Requester Type Badge */}
                  <View style={[
                    styles.modalBadge, 
                    { backgroundColor: isGuestRequester(selectedReport) ? '#F3F4F6' : '#D1FAE5' }
                  ]}>
                    <Text style={[
                      styles.modalBadgeText, 
                      { color: isGuestRequester(selectedReport) ? '#6B7280' : '#059669' }
                    ]}>
                      {isGuestRequester(selectedReport) ? 'GUEST' : 'MEMBER'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.modalReportTitle}>{selectedReport.title}</Text>

                {/* Info Cards */}
                <View style={styles.infoCard}>
                  <Ionicons name="paw" size={20} color={COLORS.primary} />
                  <View style={styles.infoCardContent}>
                    <Text style={styles.infoCardLabel}>Animal Type</Text>
                    <Text style={styles.infoCardValue}>{selectedReport.animal_type || 'Unknown'}</Text>
                  </View>
                </View>

                <View style={styles.infoCard}>
                  <Ionicons name="location" size={20} color={COLORS.primary} />
                  <View style={styles.infoCardContent}>
                    <Text style={styles.infoCardLabel}>Location</Text>
                    <Text style={styles.infoCardValue}>{selectedReport.location_description || selectedReport.location || 'Unknown'}</Text>
                  </View>
                </View>

                {selectedReport.latitude && selectedReport.longitude && (
                  <View style={styles.infoCard}>
                    <Ionicons name="navigate" size={20} color={COLORS.primary} />
                    <View style={styles.infoCardContent}>
                      <Text style={styles.infoCardLabel}>Coordinates</Text>
                      <Text style={styles.infoCardValue}>
                        {parseFloat(selectedReport.latitude).toFixed(6)}, {parseFloat(selectedReport.longitude).toFixed(6)}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.navigateBtn}
                      onPress={() => {
                        const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedReport.latitude},${selectedReport.longitude}`;
                        Linking.openURL(url);
                      }}
                    >
                      <Ionicons name="navigate-circle" size={28} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.infoCard}>
                  <Ionicons name="time" size={20} color={COLORS.primary} />
                  <View style={styles.infoCardContent}>
                    <Text style={styles.infoCardLabel}>Reported</Text>
                    <Text style={styles.infoCardValue}>{formatTimeAgo(selectedReport.created_at)}</Text>
                  </View>
                </View>

                {/* Guest Contact Info */}
                {isGuestRequester(selectedReport) && (
                  <View style={styles.contactInfoCard}>
                    <View style={styles.contactInfoHeader}>
                      <Ionicons name="person-circle-outline" size={22} color={COLORS.textDark} />
                      <Text style={styles.contactInfoTitle}>Requester Contact (Guest)</Text>
                    </View>
                    {selectedReport.reporter_name && (
                      <View style={styles.contactInfoRow}>
                        <Text style={styles.contactInfoLabel}>Name:</Text>
                        <Text style={styles.contactInfoValue}>{selectedReport.reporter_name}</Text>
                      </View>
                    )}
                    {selectedReport.reporter_phone && (
                      <TouchableOpacity 
                        style={styles.contactInfoRow}
                        onPress={() => Linking.openURL(`tel:${selectedReport.reporter_phone.replace(/[^0-9]/g, '')}`)}
                      >
                        <Text style={styles.contactInfoLabel}>Phone:</Text>
                        <Text style={[styles.contactInfoValue, styles.contactInfoLink]}>{selectedReport.reporter_phone}</Text>
                        <Ionicons name="call" size={16} color={COLORS.primary} />
                      </TouchableOpacity>
                    )}
                    {selectedReport.reporter_email && (
                      <TouchableOpacity 
                        style={styles.contactInfoRow}
                        onPress={() => Linking.openURL(`mailto:${selectedReport.reporter_email}`)}
                      >
                        <Text style={styles.contactInfoLabel}>Email:</Text>
                        <Text style={[styles.contactInfoValue, styles.contactInfoLink]}>{selectedReport.reporter_email}</Text>
                        <Ionicons name="mail" size={16} color={COLORS.primary} />
                      </TouchableOpacity>
                    )}
                    {!selectedReport.reporter_name && !selectedReport.reporter_phone && !selectedReport.reporter_email && (
                      <Text style={styles.noContactText}>No contact information provided</Text>
                    )}
                  </View>
                )}

                {/* Member Contact Info */}
                {!isGuestRequester(selectedReport) && (
                  <View style={styles.contactInfoCard}>
                    <View style={styles.contactInfoHeader}>
                      <Ionicons name="person-circle" size={22} color="#059669" />
                      <Text style={styles.contactInfoTitle}>Reported by (Member)</Text>
                    </View>
                    {selectedReport.reporter_name && (
                      <View style={styles.contactInfoRow}>
                        <Text style={styles.contactInfoLabel}>Name:</Text>
                        <Text style={styles.contactInfoValue}>{selectedReport.reporter_name}</Text>
                      </View>
                    )}
                    {selectedReport.reporter_phone && (
                      <TouchableOpacity 
                        style={styles.contactInfoRow}
                        onPress={() => Linking.openURL(`tel:${selectedReport.reporter_phone.replace(/[^0-9]/g, '')}`)}
                      >
                        <Text style={styles.contactInfoLabel}>Phone:</Text>
                        <Text style={[styles.contactInfoValue, styles.contactInfoLink]}>{selectedReport.reporter_phone}</Text>
                        <Ionicons name="call" size={16} color={COLORS.primary} />
                      </TouchableOpacity>
                    )}
                    {selectedReport.reporter_email && (
                      <TouchableOpacity 
                        style={styles.contactInfoRow}
                        onPress={() => Linking.openURL(`mailto:${selectedReport.reporter_email}`)}
                      >
                        <Text style={styles.contactInfoLabel}>Email:</Text>
                        <Text style={[styles.contactInfoValue, styles.contactInfoLink]}>{selectedReport.reporter_email}</Text>
                        <Ionicons name="mail" size={16} color={COLORS.primary} />
                      </TouchableOpacity>
                    )}
                    <View style={styles.memberIdRow}>
                      <Text style={styles.contactInfoLabel}>User ID:</Text>
                      <Text style={styles.contactInfoValue}>#{selectedReport.reporter_id}</Text>
                    </View>
                  </View>
                )}

                {/* Description */}
                <View style={styles.descriptionCard}>
                  <Text style={styles.descriptionLabel}>Description</Text>
                  <Text style={styles.descriptionText}>{selectedReport.description}</Text>
                </View>

                {/* Action Buttons based on status */}
                {selectedReport.rescuer_id === user?.id ? (
                  // This is my rescue - show status update buttons
                  <View style={styles.myRescueActions}>
                    <Text style={styles.myRescueLabel}>Update Rescue Status:</Text>
                    {selectedReport.status === 'in_progress' && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.arrivedButton]}
                        onPress={() => {
                          setViewModalVisible(false);
                          handleUpdateStatus(selectedReport, 'arrived');
                        }}
                      >
                        <Ionicons name="flag" size={18} color={COLORS.textWhite} />
                        <Text style={styles.actionButtonText}>I've Arrived</Text>
                      </TouchableOpacity>
                    )}
                    {(selectedReport.status === 'in_progress' || selectedReport.status === 'arrived') && (
                      <>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.completeButton]}
                          onPress={() => {
                            setViewModalVisible(false);
                            handleUpdateStatus(selectedReport, 'rescued');
                          }}
                        >
                          <Ionicons name="checkmark-circle" size={18} color={COLORS.textWhite} />
                          <Text style={styles.actionButtonText}>Rescue Completed</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.cannotButton]}
                          onPress={() => {
                            setViewModalVisible(false);
                            handleUpdateStatus(selectedReport, 'cannot_complete');
                          }}
                        >
                          <Ionicons name="close-circle" size={18} color={COLORS.textWhite} />
                          <Text style={styles.actionButtonText}>Cannot Complete</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                ) : selectedReport.status !== 'resolved' && selectedReport.status !== 'rescued' && !selectedReport.rescuer_id ? (
                  // Available rescue - show accept/decline
                  <View style={styles.responseActions}>
                    <TouchableOpacity
                      style={[styles.responseButton, styles.declineButton]}
                      onPress={() => {
                        setViewModalVisible(false);
                        handleDeclineRescue(selectedReport);
                      }}
                    >
                      <Ionicons name="close" size={18} color="#DC2626" />
                      <Text style={styles.declineButtonText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.responseButton, styles.acceptButton]}
                      onPress={() => {
                        setViewModalVisible(false);
                        handleAcceptRescue(selectedReport);
                      }}
                    >
                      <FontAwesome5 name="hand-holding-heart" size={16} color={COLORS.textWhite} />
                      <Text style={styles.acceptButtonText}>Accept Rescue</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                <View style={{ height: 30 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Cannot Complete Modal */}
      <Modal
        visible={statusModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setStatusModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.statusModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cannot Complete Rescue</Text>
              <TouchableOpacity onPress={() => setStatusModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.statusModalBody}>
              <Text style={styles.statusModalLabel}>Please provide a reason:</Text>
              <TextInput
                style={styles.statusNotesInput}
                placeholder="Explain why you cannot complete this rescue..."
                placeholderTextColor={COLORS.textMedium}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={statusNotes}
                onChangeText={setStatusNotes}
              />
              
              <View style={styles.statusModalActions}>
                <TouchableOpacity
                  style={styles.statusCancelBtn}
                  onPress={() => {
                    setStatusModalVisible(false);
                    setStatusNotes('');
                  }}
                >
                  <Text style={styles.statusCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.statusSubmitBtn}
                  onPress={() => {
                    if (!statusNotes.trim()) {
                      Alert.alert('Required', 'Please provide a reason.');
                      return;
                    }
                    submitStatusUpdate(selectedReport, 'cannot_complete', statusNotes);
                  }}
                >
                  <Text style={styles.statusSubmitText}>Submit</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Guided Rescue Workflow Modal */}
      <Modal
        visible={workflowModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setWorkflowModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.workflowModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rescue Progress</Text>
              <TouchableOpacity onPress={() => setWorkflowModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            {workflowReport && (
              <ScrollView style={styles.workflowScroll} showsVerticalScrollIndicator={false}>
                {/* Report Summary */}
                <View style={styles.workflowSummary}>
                  <Text style={styles.workflowReportTitle}>
                    {workflowReport.title || `Rescue #${workflowReport.id}`}
                  </Text>
                  <View style={styles.workflowLocation}>
                    <Ionicons name="location" size={16} color={COLORS.textMedium} />
                    <Text style={styles.workflowLocationText} numberOfLines={2}>
                      {workflowReport.location_description || workflowReport.location || 'Unknown location'}
                    </Text>
                  </View>
                </View>

                {/* Progress Steps */}
                <View style={styles.workflowSteps}>
                  <Text style={styles.workflowStepsTitle}>Rescue Progress</Text>
                  {WORKFLOW_STEPS.map((step, index) => {
                    const currentIndex = getCurrentStepIndex(workflowReport.status);
                    const isCompleted = index < currentIndex;
                    const isCurrent = index === currentIndex;
                    const isPending = index > currentIndex;
                    
                    return (
                      <View key={step.status} style={styles.workflowStepRow}>
                        {/* Step indicator line */}
                        {index < WORKFLOW_STEPS.length - 1 && (
                          <View style={[
                            styles.stepLine,
                            isCompleted ? styles.stepLineCompleted : styles.stepLinePending
                          ]} />
                        )}
                        
                        {/* Step circle */}
                        <View style={[
                          styles.stepCircle,
                          isCompleted && { backgroundColor: '#10B981' },
                          isCurrent && { backgroundColor: step.color, borderWidth: 3, borderColor: step.color + '40' },
                          isPending && styles.stepCirclePending
                        ]}>
                          {isCompleted ? (
                            <Ionicons name="checkmark" size={16} color="#FFF" />
                          ) : (
                            <Ionicons name={step.icon} size={16} color={isCurrent ? '#FFF' : COLORS.textMedium} />
                          )}
                        </View>
                        
                        {/* Step label */}
                        <View style={styles.stepContent}>
                          <Text style={[
                            styles.stepLabel,
                            isCompleted && styles.stepLabelCompleted,
                            isCurrent && styles.stepLabelCurrent,
                            isPending && styles.stepLabelPending
                          ]}>
                            {step.label}
                          </Text>
                          {isCurrent && workflowReport.status !== 'rescued' && workflowReport.status !== 'pending_verification' && (
                            <Text style={styles.stepCurrentHint}>Current Step</Text>
                          )}
                          {workflowReport.status === 'pending_verification' && step.status === 'pending_verification' && (
                            <Text style={styles.stepPendingHint}>Awaiting Admin Approval</Text>
                          )}
                          {workflowReport.status === 'rescued' && step.status === 'rescued' && (
                            <Text style={styles.stepVerifiedHint}>✓ Verified by Admin</Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Action Area based on current status */}
                <View style={styles.workflowActions}>
                  {/* On the Way button */}
                  {workflowReport.status === 'in_progress' && (
                    <>
                      <Text style={styles.actionPrompt}>Ready to head to the rescue location?</Text>
                      <TouchableOpacity
                        style={[styles.workflowActionBtn, styles.onTheWayBtn]}
                        onPress={() => updateWorkflowStatus('on_the_way')}
                        disabled={submittingWorkflow}
                      >
                        {submittingWorkflow ? (
                          <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                          <>
                            <Ionicons name="car" size={20} color="#FFF" />
                            <Text style={styles.workflowActionText}>I'm On My Way</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </>
                  )}

                  {/* Arrived button */}
                  {workflowReport.status === 'on_the_way' && (
                    <>
                      <Text style={styles.actionPrompt}>Have you arrived at the rescue location?</Text>
                      <TouchableOpacity
                        style={[styles.workflowActionBtn, styles.arrivedWorkflowBtn]}
                        onPress={() => updateWorkflowStatus('arrived')}
                        disabled={submittingWorkflow}
                      >
                        {submittingWorkflow ? (
                          <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                          <>
                            <Ionicons name="location" size={20} color="#FFF" />
                            <Text style={styles.workflowActionText}>I've Arrived</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </>
                  )}

                  {/* Submit for Verification - with photo upload */}
                  {workflowReport.status === 'arrived' && (
                    <>
                      <Text style={styles.actionPrompt}>Pet rescued? Upload a photo as proof to submit for verification.</Text>
                      
                      {/* Photo Upload Section */}
                      <View style={styles.photoUploadSection}>
                        {completionPhoto ? (
                          <View style={styles.photoPreviewContainer}>
                            <Image source={{ uri: completionPhoto }} style={styles.photoPreview} />
                            <TouchableOpacity 
                              style={styles.removePhotoBtn}
                              onPress={() => setCompletionPhoto(null)}
                            >
                              <Ionicons name="close-circle" size={28} color="#DC2626" />
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
                              <Text style={styles.photoOptionText}>From Gallery</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>

                      {/* Optional Notes */}
                      <TextInput
                        style={styles.completionNotesInput}
                        placeholder="Add any notes about the rescue (optional)..."
                        placeholderTextColor={COLORS.textMedium}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        value={completionNotes}
                        onChangeText={setCompletionNotes}
                      />

                      <TouchableOpacity
                        style={[
                          styles.workflowActionBtn, 
                          styles.submitVerificationBtn,
                          !completionPhoto && styles.workflowBtnDisabled
                        ]}
                        onPress={submitForVerification}
                        disabled={submittingWorkflow || !completionPhoto}
                      >
                        {submittingWorkflow ? (
                          <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                          <>
                            <Ionicons name="cloud-upload" size={20} color="#FFF" />
                            <Text style={styles.workflowActionText}>Submit for Verification</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </>
                  )}

                  {/* Pending Verification Status */}
                  {workflowReport.status === 'pending_verification' && (
                    <View style={styles.pendingVerificationBox}>
                      <MaterialCommunityIcons name="clock-check-outline" size={48} color="#F59E0B" />
                      <Text style={styles.pendingVerificationTitle}>Awaiting Verification</Text>
                      <Text style={styles.pendingVerificationText}>
                        Your rescue submission is being reviewed by an admin. You will be notified once it's verified.
                      </Text>
                      {workflowReport.completion_photo && (
                        <View style={styles.submittedPhotoContainer}>
                          <Text style={styles.submittedPhotoLabel}>Submitted Photo:</Text>
                          <Image 
                            source={{ uri: workflowReport.completion_photo }} 
                            style={styles.submittedPhoto}
                            resizeMode="cover"
                          />
                        </View>
                      )}
                    </View>
                  )}

                  {/* Rescued/Verified Status */}
                  {workflowReport.status === 'rescued' && (
                    <View style={styles.rescuedBox}>
                      <MaterialCommunityIcons name="shield-check" size={48} color="#10B981" />
                      <Text style={styles.rescuedTitle}>Rescue Verified!</Text>
                      <Text style={styles.rescuedText}>
                        Congratulations! This rescue has been verified and officially marked as complete.
                      </Text>
                      {workflowReport.verification_notes && (
                        <Text style={styles.verificationNotes}>
                          Admin Notes: {workflowReport.verification_notes}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Cannot Complete Button */}
                  {['in_progress', 'on_the_way', 'arrived'].includes(workflowReport.status) && (
                    <TouchableOpacity
                      style={styles.cannotCompleteWorkflowBtn}
                      onPress={handleCannotCompleteWorkflow}
                      disabled={submittingWorkflow}
                    >
                      <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
                      <Text style={styles.cannotCompleteWorkflowText}>Cannot Complete Rescue</Text>
                    </TouchableOpacity>
                  )}

                  {/* Navigate to Location */}
                  {workflowReport.latitude && workflowReport.longitude && 
                   ['in_progress', 'on_the_way'].includes(workflowReport.status) && (
                    <TouchableOpacity
                      style={styles.navigateWorkflowBtn}
                      onPress={() => {
                        const url = `https://www.google.com/maps/dir/?api=1&destination=${workflowReport.latitude},${workflowReport.longitude}`;
                        Linking.openURL(url);
                      }}
                    >
                      <Ionicons name="navigate" size={18} color={COLORS.primary} />
                      <Text style={styles.navigateWorkflowText}>Open in Maps</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={{ height: 30 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Shelter Selection Modal */}
      <Modal
        visible={shelterModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeShelterModal}
      >
        <View style={styles.shelterModalOverlay}>
          <View style={styles.shelterModalContainer}>
            {/* Modal Handle Bar */}
            <View style={styles.shelterModalHandleBar}>
              <View style={styles.shelterModalHandle} />
            </View>

            {/* Modal Header */}
            <View style={styles.shelterModalHeader}>
              <View style={styles.shelterModalIconWrapper}>
                <MaterialCommunityIcons name="home-heart" size={26} color="#FFFFFF" />
              </View>
              <View style={styles.shelterModalHeaderText}>
                <Text style={styles.shelterModalTitle}>Transfer to Shelter</Text>
                <Text style={styles.shelterModalSubtitle}>
                  Select a verified shelter for your rescued animal
                </Text>
              </View>
              <TouchableOpacity style={styles.shelterModalClose} onPress={closeShelterModal}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Rescued Animal Info Card */}
            {selectedRescueForShelter && (
              <View style={styles.shelterAnimalInfo}>
                <View style={styles.shelterAnimalCardInner}>
                  <View style={styles.shelterAnimalImageWrapper}>
                    {selectedRescueForShelter.images && selectedRescueForShelter.images[0] ? (
                      <Image
                        source={{ uri: selectedRescueForShelter.images[0] }}
                        style={styles.shelterAnimalImage}
                      />
                    ) : (
                      <View style={[styles.shelterAnimalImage, styles.shelterAnimalImagePlaceholder]}>
                        <MaterialCommunityIcons name="paw" size={22} color="#94A3B8" />
                      </View>
                    )}
                    <View style={styles.shelterAnimalRescuedBadge}>
                      <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                    </View>
                  </View>
                  <View style={styles.shelterAnimalDetails}>
                    <Text style={styles.shelterAnimalLabel}>Transferring</Text>
                    <Text style={styles.shelterAnimalTitle} numberOfLines={1}>
                      {selectedRescueForShelter.title || `Rescue #${selectedRescueForShelter.id}`}
                    </Text>
                    <View style={styles.shelterAnimalLocationRow}>
                      <Ionicons name="location" size={12} color="#64748B" />
                      <Text style={styles.shelterAnimalMeta} numberOfLines={1}>
                        {selectedRescueForShelter.location || 'Location not specified'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Section Title */}
            {availableShelters && availableShelters.length > 0 && (
              <View style={styles.shelterSectionHeader}>
                <Text style={styles.shelterSectionTitle}>Available Shelters</Text>
                <View style={styles.shelterCountBadge}>
                  <Text style={styles.shelterCountText}>{availableShelters.length}</Text>
                </View>
              </View>
            )}

            {/* Shelters List */}
            <ScrollView 
              style={styles.sheltersList} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheltersListContent}
            >
              {loadingShelters ? (
                <View style={styles.sheltersLoading}>
                  <View style={styles.sheltersLoadingSpinner}>
                    <ActivityIndicator size="large" color="#6366F1" />
                  </View>
                  <Text style={styles.sheltersLoadingText}>Finding nearby shelters...</Text>
                  <Text style={styles.sheltersLoadingSubtext}>This won't take long</Text>
                </View>
              ) : !availableShelters || availableShelters.length === 0 ? (
                <View style={styles.noSheltersContainer}>
                  <View style={styles.noSheltersIconWrapper}>
                    <MaterialCommunityIcons name="home-search" size={40} color="#94A3B8" />
                  </View>
                  <Text style={styles.noSheltersTitle}>No Shelters Available</Text>
                  <Text style={styles.noSheltersText}>
                    All verified shelters are currently at full capacity. Please try again later.
                  </Text>
                </View>
              ) : (
                availableShelters.map((shelter, index) => {
                  const capacityInfo = getShelterCapacityDisplay(shelter);
                  const isSelected = selectedShelter?.id === shelter.id;
                  
                  return (
                    <TouchableOpacity
                      key={shelter.id}
                      style={[
                        styles.shelterCard,
                        isSelected && styles.shelterCardSelected
                      ]}
                      onPress={() => handleSelectShelter(shelter)}
                      activeOpacity={0.7}
                    >
                      {/* Selection Check */}
                      <View style={[
                        styles.shelterCheckbox,
                        isSelected && styles.shelterCheckboxSelected
                      ]}>
                        {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                      </View>

                      {/* Shelter Image */}
                      <View style={styles.shelterCardImageContainer}>
                        {(shelter.display_logo || shelter.display_cover) ? (
                          <Image
                            source={{ uri: shelter.display_logo || shelter.display_cover }}
                            style={styles.shelterCardImage}
                          />
                        ) : (
                          <View style={[styles.shelterCardImage, styles.shelterCardImagePlaceholder]}>
                            <MaterialCommunityIcons name="home-city" size={24} color="#94A3B8" />
                          </View>
                        )}
                        {shelter.is_verified && (
                          <View style={styles.shelterVerifiedImageBadge}>
                            <Ionicons name="shield-checkmark" size={12} color="#FFFFFF" />
                          </View>
                        )}
                      </View>

                      {/* Shelter Info */}
                      <View style={styles.shelterCardInfo}>
                        <Text style={[
                          styles.shelterCardName,
                          isSelected && styles.shelterCardNameSelected
                        ]} numberOfLines={1}>
                          {shelter.name}
                        </Text>
                        
                        <View style={styles.shelterCardMeta}>
                          <Ionicons name="location" size={12} color="#64748B" />
                          <Text style={styles.shelterCardLocation} numberOfLines={1}>
                            {shelter.address || shelter.city || 'Address not available'}
                          </Text>
                        </View>

                        <View style={styles.shelterCardTagsRow}>
                          <View style={[
                            styles.shelterCapacityTag,
                            { backgroundColor: capacityInfo.color + '15' }
                          ]}>
                            <MaterialCommunityIcons name="paw" size={11} color={capacityInfo.color} />
                            <Text style={[styles.shelterCapacityTagText, { color: capacityInfo.color }]}>
                              {capacityInfo.text}
                            </Text>
                          </View>

                          {shelter.phone && (
                            <View style={styles.shelterPhoneTag}>
                              <Ionicons name="call" size={10} color="#64748B" />
                              <Text style={styles.shelterPhoneTagText}>{shelter.phone}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}

              {/* Transfer Notes */}
              {availableShelters && availableShelters.length > 0 && (
                <View style={styles.transferNotesContainer}>
                  <View style={styles.transferNotesHeader}>
                    <Ionicons name="document-text" size={16} color="#64748B" />
                    <Text style={styles.transferNotesLabel}>Additional Notes</Text>
                    <Text style={styles.transferNotesOptional}>(Optional)</Text>
                  </View>
                  <TextInput
                    style={styles.transferNotesInput}
                    placeholder="Any special care instructions or notes for the shelter..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    value={shelterTransferNotes}
                    onChangeText={setShelterTransferNotes}
                  />
                </View>
              )}

              <View style={{ height: 20 }} />
            </ScrollView>

            {/* Modal Footer */}
            {availableShelters && availableShelters.length > 0 && (
              <View style={styles.shelterModalFooter}>
                <TouchableOpacity
                  style={styles.shelterCancelBtn}
                  onPress={closeShelterModal}
                >
                  <Text style={styles.shelterCancelText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.shelterConfirmBtn,
                    !selectedShelter && styles.shelterConfirmBtnDisabled
                  ]}
                  onPress={handleConfirmShelterTransfer}
                  disabled={!selectedShelter || submittingTransfer}
                >
                  {submittingTransfer ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
                      <Text style={styles.shelterConfirmText}>
                        {selectedShelter ? `Transfer to ${selectedShelter.name?.substring(0, 15)}${selectedShelter.name?.length > 15 ? '...' : ''}` : 'Select a Shelter'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  backButton: {
    marginRight: SPACING.md,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  rescuerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  rescuerBadgeText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.success,
    marginLeft: 4,
    fontWeight: FONTS.weights.medium,
  },
  welcomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  welcomeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  welcomeTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },
  welcomeSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    marginHorizontal: 4,
    elevation: 2,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  statNumber: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  statLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textMedium,
    marginLeft: 6,
  },
  tabTextActive: {
    color: COLORS.textWhite,
  },
  emergencyHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  // Filter Chips
  filterContainer: {
    marginBottom: SPACING.md,
  },
  filterScrollContent: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.backgroundWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.medium,
    color: COLORS.textMedium,
  },
  filterChipTextActive: {
    color: COLORS.textWhite,
  },
  section: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  countBadge: {
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    color: COLORS.textWhite,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  reportCard: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    elevation: 3,
  },
  reportCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  urgencyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  urgencyText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  statusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    textTransform: 'capitalize',
  },
  reportCardBody: {
    flexDirection: 'row',
  },
  reportImage: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
  },
  reportDetails: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  reportTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
    marginBottom: SPACING.xs,
  },
  reportMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  reportMetaText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginLeft: 6,
    flex: 1,
  },
  respondButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.md,
  },
  respondButtonText: {
    color: COLORS.textWhite,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    marginLeft: SPACING.xs,
  },
  workflowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  workflowButtonText: {
    color: COLORS.textWhite,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    flex: 1,
  },
  workflowProgressIndicator: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  workflowProgressText: {
    color: COLORS.textWhite,
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
  completedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  completedIcon: {
    marginRight: SPACING.md,
  },
  completedInfo: {
    flex: 1,
  },
  completedTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
  },
  completedDate: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
    marginTop: 2,
  },
  mapContainer: {
    marginHorizontal: SPACING.xl,
    height: 400,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    elevation: 3,
  },
  mapWebView: {
    flex: 1,
    borderRadius: RADIUS.lg,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: SPACING.xs,
  },
  bottomSpacing: {
    height: 100,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.backgroundWhite,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '90%',
    minHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  modalTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  modalScroll: {
    flex: 1,
    padding: SPACING.xl,
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
  },
  modalBadgeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  modalBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  modalBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
  modalReportTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.lg,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  infoCardContent: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  infoCardLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
  },
  infoCardValue: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.medium,
    color: COLORS.textDark,
  },
  descriptionCard: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  descriptionLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textMedium,
    marginBottom: SPACING.sm,
  },
  descriptionText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark,
    lineHeight: 22,
  },
  modalRespondButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.round,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  modalRespondButtonText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },
  // Report card header badges (requester type)
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  requesterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  guestBadge: {
    backgroundColor: '#F3F4F6',
  },
  registeredBadge: {
    backgroundColor: '#D1FAE5',
  },
  requesterText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    marginLeft: 4,
  },
  guestText: {
    color: '#6B7280',
  },
  registeredText: {
    color: '#059669',
  },
  // Status action buttons for assigned rescues
  statusActionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  statusActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    gap: 4,
    flex: 1,
    minWidth: 100,
  },
  arrivedBtn: {
    backgroundColor: '#2196F3',
  },
  completeBtn: {
    backgroundColor: COLORS.success,
  },
  cannotCompleteBtn: {
    backgroundColor: COLORS.error,
  },
  statusActionText: {
    color: COLORS.textWhite,
    fontWeight: FONTS.weights.bold,
    fontSize: FONTS.sizes.xs,
  },
  // Navigate button in info card
  navigateBtn: {
    padding: 4,
  },
  // Contact info card for guest requesters
  contactInfoCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  contactInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  contactInfoTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  contactInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
  },
  contactInfoLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    minWidth: 50,
  },
  contactInfoValue: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark,
    flex: 1,
  },
  contactInfoLink: {
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  noContactText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    fontStyle: 'italic',
  },
  memberIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    marginTop: SPACING.xs,
  },
  // My Rescue action buttons in modal
  myRescueActions: {
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  myRescueLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textMedium,
    marginBottom: SPACING.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
  },
  arrivedButton: {
    backgroundColor: '#2196F3',
  },
  completeButton: {
    backgroundColor: COLORS.success,
  },
  cannotButton: {
    backgroundColor: COLORS.error,
  },
  actionButtonText: {
    color: COLORS.textWhite,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
  },
  // Response actions in modal (accept/decline)
  responseActions: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  responseButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
  },
  acceptButton: {
    backgroundColor: COLORS.primary,
  },
  declineButton: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  acceptButtonText: {
    color: COLORS.textWhite,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
  },
  declineButtonText: {
    color: '#DC2626',
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
  },
  // Status Modal (Cannot Complete)
  statusModalContent: {
    backgroundColor: COLORS.backgroundWhite,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    minHeight: 300,
  },
  statusModalBody: {
    padding: SPACING.xl,
  },
  statusModalLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
    marginBottom: SPACING.md,
  },
  statusNotesInput: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark,
    minHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  statusModalActions: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  statusCancelBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCancelText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textMedium,
  },
  statusSubmitBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusSubmitText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },
  // My Active Rescues Section
  myRescuesSection: {
    marginBottom: SPACING.lg,
  },
  myRescuesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  myRescuesSectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  activeCountBadge: {
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  activeCountText: {
    color: COLORS.textWhite,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  // ========== MY RESCUED ANIMALS STYLES ==========
  rescuedAnimalsContainer: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  rescuedAnimalsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    elevation: 3,
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  rescuedAnimalsIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rescuedAnimalsHeaderContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  rescuedAnimalsHeaderTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },
  rescuedAnimalsHeaderSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  rescuedEmptyState: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.xxl,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  rescuedEmptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  rescuedEmptyTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.sm,
  },
  rescuedEmptySubtext: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  rescuedEmptyTip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '10',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
  },
  rescuedEmptyTipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    flex: 1,
  },
  rescuedAnimalsList: {
    gap: SPACING.md,
  },
  rescuedAnimalCard: {
    flexDirection: 'column',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
  },
  rescuedAnimalImageContainer: {
    position: 'relative',
  },
  rescuedAnimalImage: {
    width: 70,
    height: 70,
    borderRadius: RADIUS.md,
  },
  rescuedAnimalPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rescuedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.backgroundWhite,
  },
  rescuedAnimalInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  rescuedAnimalTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
    marginBottom: SPACING.xs,
  },
  rescuedAnimalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: 4,
  },
  rescuedAnimalMetaText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    flex: 1,
  },
  rescuedAnimalArrow: {
    padding: SPACING.xs,
  },
  rescuedAnimalContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    width: '100%',
  },
  rescuedAnimalActions: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    gap: SPACING.xs,
  },
  viewActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundWhite,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: 4,
  },
  viewActionText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
  },
  adoptActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  adoptActionText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },
  shelterActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  shelterActionText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },
  transferredBadge: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1' + '15',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    gap: 6,
    borderWidth: 1,
    borderColor: '#6366F1' + '30',
  },
  transferredBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    color: '#6366F1',
  },
  // Adoption Status Badges
  adoptedBadge: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981' + '15',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    gap: 6,
    borderWidth: 1,
    borderColor: '#10B981' + '30',
  },
  adoptedBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    color: '#10B981',
  },
  pendingAdoptionBadge: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B' + '15',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    gap: 6,
    borderWidth: 1,
    borderColor: '#F59E0B' + '30',
  },
  pendingAdoptionText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    color: '#F59E0B',
  },
  rejectedAdoptionBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444' + '15',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    gap: 6,
    borderWidth: 1,
    borderColor: '#EF4444' + '30',
  },
  rejectedAdoptionText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    color: '#EF4444',
  },
  rescuedSummaryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success + '15',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  rescuedSummaryText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.success,
    fontWeight: FONTS.weights.medium,
  },
  // ========== GUIDED WORKFLOW MODAL STYLES ==========
  workflowModalContent: {
    backgroundColor: COLORS.backgroundWhite,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '95%',
    minHeight: '70%',
  },
  workflowScroll: {
    flex: 1,
    padding: SPACING.xl,
  },
  workflowSummary: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  workflowReportTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.sm,
  },
  workflowLocation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  workflowLocationText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginLeft: SPACING.xs,
    flex: 1,
  },
  workflowSteps: {
    marginBottom: SPACING.xl,
  },
  workflowStepsTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.lg,
  },
  workflowStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    position: 'relative',
  },
  stepLine: {
    position: 'absolute',
    left: 15,
    top: 36,
    width: 2,
    height: 40,
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
  stepCurrentHint: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    marginTop: 2,
  },
  stepPendingHint: {
    fontSize: FONTS.sizes.xs,
    color: '#F59E0B',
    marginTop: 2,
  },
  stepVerifiedHint: {
    fontSize: FONTS.sizes.xs,
    color: '#10B981',
    fontWeight: FONTS.weights.semiBold,
    marginTop: 2,
  },
  workflowActions: {
    marginTop: SPACING.md,
  },
  actionPrompt: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  workflowActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  workflowActionText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },
  onTheWayBtn: {
    backgroundColor: '#3B82F6',
  },
  arrivedWorkflowBtn: {
    backgroundColor: '#8B5CF6',
  },
  submitVerificationBtn: {
    backgroundColor: '#10B981',
  },
  workflowBtnDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.7,
  },
  photoUploadSection: {
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
  completionNotesInput: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark,
    minHeight: 80,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.lg,
  },
  pendingVerificationBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  pendingVerificationTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: '#92400E',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  pendingVerificationText: {
    fontSize: FONTS.sizes.sm,
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
  rescuedBox: {
    backgroundColor: '#D1FAE5',
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  rescuedTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: '#065F46',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  rescuedText: {
    fontSize: FONTS.sizes.sm,
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
  cannotCompleteWorkflowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.lg,
    gap: SPACING.xs,
  },
  cannotCompleteWorkflowText: {
    fontSize: FONTS.sizes.sm,
    color: '#DC2626',
    fontWeight: FONTS.weights.medium,
  },
  navigateWorkflowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.primary + '10',
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
  },
  navigateWorkflowText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: FONTS.weights.medium,
  },
  
  // ========== SHELTER MODAL STYLES (Professional Design) ==========
  shelterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  shelterModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '85%',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
  },
  shelterModalHandleBar: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  shelterModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
  },
  shelterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  shelterModalIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  shelterModalHeaderText: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  shelterModalTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: '#1E293B',
    letterSpacing: -0.3,
  },
  shelterModalSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: '#64748B',
    marginTop: 2,
  },
  shelterModalClose: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shelterAnimalInfo: {
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
  },
  shelterAnimalCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shelterAnimalImageWrapper: {
    position: 'relative',
  },
  shelterAnimalImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  shelterAnimalImagePlaceholder: {
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shelterAnimalRescuedBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  shelterAnimalDetails: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  shelterAnimalLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    color: '#6366F1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  shelterAnimalTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: '#1E293B',
    marginTop: 2,
  },
  shelterAnimalLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  shelterAnimalMeta: {
    fontSize: FONTS.sizes.sm,
    color: '#64748B',
    flex: 1,
  },
  shelterSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  shelterSectionTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: '#1E293B',
  },
  shelterCountBadge: {
    marginLeft: SPACING.sm,
    backgroundColor: '#6366F1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  shelterCountText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    color: '#FFFFFF',
  },
  sheltersList: {
    flex: 1,
  },
  sheltersListContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
  },
  sheltersLoading: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  sheltersLoadingSpinner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sheltersLoadingText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: '#1E293B',
    marginTop: SPACING.sm,
  },
  sheltersLoadingSubtext: {
    fontSize: FONTS.sizes.sm,
    color: '#64748B',
    marginTop: 4,
  },
  noSheltersContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  noSheltersIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  noSheltersTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: '#1E293B',
  },
  noSheltersText: {
    fontSize: FONTS.sizes.sm,
    color: '#64748B',
    textAlign: 'center',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    lineHeight: 20,
  },
  shelterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  shelterCardSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
    shadowColor: '#6366F1',
    shadowOpacity: 0.15,
  },
  shelterCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  shelterCheckboxSelected: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  shelterCardImageContainer: {
    position: 'relative',
  },
  shelterCardImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
  shelterCardImagePlaceholder: {
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shelterVerifiedImageBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  shelterCardInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  shelterCardName: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: '#1E293B',
    marginBottom: 4,
  },
  shelterCardNameSelected: {
    color: '#4F46E5',
  },
  shelterCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  shelterCardLocation: {
    fontSize: FONTS.sizes.sm,
    color: '#64748B',
    flex: 1,
  },
  shelterCardTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  shelterCapacityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  shelterCapacityTagText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
  },
  shelterPhoneTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    gap: 4,
  },
  shelterPhoneTagText: {
    fontSize: FONTS.sizes.xs,
    color: '#64748B',
  },
  transferNotesContainer: {
    marginTop: SPACING.lg,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  transferNotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: 6,
  },
  transferNotesLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: '#1E293B',
  },
  transferNotesOptional: {
    fontSize: FONTS.sizes.xs,
    color: '#94A3B8',
  },
  transferNotesInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: '#1E293B',
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shelterModalFooter: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? 34 : SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: SPACING.md,
  },
  shelterCancelBtn: {
    flex: 1,
    paddingVertical: SPACING.md + 2,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shelterCancelText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: '#64748B',
  },
  shelterConfirmBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: SPACING.md + 2,
    borderRadius: 14,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  shelterConfirmBtnDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
  },
  shelterConfirmText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: '#FFFFFF',
  },
});

export default memo(UserRescuerDashboardScreen);
