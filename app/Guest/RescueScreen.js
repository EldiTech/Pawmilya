import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { collection, getDocs, query, where } from 'firebase/firestore';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
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
  View
} from 'react-native';
import { WebView } from 'react-native-webview';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebaseConfig';
import { rescueService } from '../../services';
import { normalizeImageUrl } from '../../utils/imageUrl';

// Helper to get image URL - supports base64 and legacy file paths
const getImageUrl = (imagePath) => {
  return normalizeImageUrl(imagePath, null);
};

// Animal type options
const ANIMAL_TYPES = [
  { id: 'dog', label: 'Dog', icon: 'dog' },
  { id: 'cat', label: 'Cat', icon: 'cat' },
];

// Urgency levels
const URGENCY_LEVELS = [
  { value: 'low', label: 'Low', color: '#10B981', icon: 'leaf', description: 'Animal is safe but needs help' },
  { value: 'normal', label: 'Normal', color: '#F59E0B', icon: 'alert-circle', description: 'Requires attention soon' },
  { value: 'high', label: 'High', color: '#EA580C', icon: 'warning', description: 'Animal in distress' },
  { value: 'critical', label: 'Critical', color: '#DC2626', icon: 'flash', description: 'Life-threatening emergency' },
];

// Form steps for guest report
const GUEST_FORM_STEPS = [
  { id: 1, title: 'Basic Info', icon: 'document-text' },
  { id: 2, title: 'Location', icon: 'location' },
  { id: 3, title: 'Details', icon: 'list' },
  { id: 4, title: 'Photos', icon: 'camera' },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Move the map HTML outside the component to prevent re-creation
const getMapHtml = (apiKey) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #map { width: 100%; height: 100%; background: #f0f0f0; }
    /* Search Box Styles */
    .search-container { position: absolute; top: 12px; left: 12px; right: 12px; z-index: 1000; }
    .search-box { display: flex; gap: 10px; background: white; padding: 8px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); }
    .search-input { flex: 1; padding: 12px 16px; border: 2px solid #E8E8E8; border-radius: 8px; font-size: 15px; outline: none; }
    .search-input:focus { border-color: #8B4513; }
    /* Bottom Info Bar */
    .info-bar { position: absolute; bottom: 0; left: 0; right: 0; background: white; padding: 16px 20px; padding-bottom: max(16px, env(safe-area-inset-bottom)); box-shadow: 0 -4px 15px rgba(0,0,0,0.1); z-index: 1000; border-radius: 20px 20px 0 0; }
    .info-bar-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .info-icon { width: 40px; height: 40px; background: linear-gradient(135deg, #8B4513 0%, #A0522D 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .info-icon svg { width: 20px; height: 20px; fill: white; }
    .info-title { font-size: 12px; color: #888; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-address { font-size: 15px; color: #333; font-weight: 500; line-height: 1.4; margin-top: 4px; max-height: 60px; overflow-y: auto; }
    .info-placeholder { color: #999; font-style: italic; }
  </style>
</head>
<body>
  <div class="search-container" id="searchContainer">
    <div class="search-box">
      <input type="text" id="searchInput" class="search-input" placeholder="Search for a place or address..." autocomplete="off" />
    </div>
  </div>
  <div id="map"></div>
  <div class="info-bar" id="infoBar">
    <div class="info-bar-header">
      <div class="info-icon">
        <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
      </div>
      <div>
        <div class="info-title">Selected Location</div>
        <div class="info-address" id="addressDisplay"><span class="info-placeholder">Tap on the map to select a location</span></div>
      </div>
    </div>
  </div>

  <script>
    let map, marker, geocoder, searchBox;
    window.__pendingCurrentLocation = null;

    function sendLocationToApp(lat, lng, address) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'locationSelected',
        latitude: lat,
        longitude: lng,
        address: address
      }));
    }

    function updateInfoBar(address, lat, lng) {
      const display = document.getElementById('addressDisplay');
      if(address) {
        display.innerHTML = address;
      } else {
        display.innerHTML = '<span class="info-placeholder">Location at ' + lat.toFixed(6) + ', ' + lng.toFixed(6) + '</span>';
      }
    }

    function placeMarker(latLng, skipGeocode) {
      if (!marker) {
        marker = new google.maps.Marker({ position: latLng, map: map, animation: google.maps.Animation.DROP });
      } else {
        marker.setPosition(latLng);
      }
      
      const lat = latLng.lat();
      const lng = latLng.lng();

      if (skipGeocode) return;

      updateInfoBar('Finding address...', lat, lng);
      sendLocationToApp(lat, lng, 'Finding address...');

      geocoder.geocode({ location: latLng }, (results, status) => {
        if (status === "OK" && results[0]) {
          updateInfoBar(results[0].formatted_address, lat, lng);
          sendLocationToApp(lat, lng, results[0].formatted_address);
        } else {
          const fallback = 'Location at ' + lat.toFixed(6) + ', ' + lng.toFixed(6);
          updateInfoBar(null, lat, lng);
          sendLocationToApp(lat, lng, fallback);
        }
      });
    }

    function initMap() {
      const defaultPos = { lat: 14.5995, lng: 120.9842 };
      map = new google.maps.Map(document.getElementById("map"), {
        zoom: 18, // Zoom in closer to trigger 3D/45-degree imagery
        center: defaultPos,
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeId: 'hybrid', // Combines satellite imagery with labels
        tilt: 45, // Angles the camera for a 3D perspective
      });
      geocoder = new google.maps.Geocoder();

      const input = document.getElementById("searchInput");
      searchBox = new google.maps.places.SearchBox(input);
      map.controls[google.maps.ControlPosition.TOP_LEFT].push(document.getElementById('searchContainer'));

      map.addListener("bounds_changed", () => {
        searchBox.setBounds(map.getBounds());
      });

      searchBox.addListener("places_changed", () => {
        const places = searchBox.getPlaces();
        if (places.length === 0) return;
        
        const place = places[0];
        if (!place.geometry || !place.geometry.location) return;

        map.setCenter(place.geometry.location);
        map.setZoom(18); // Zoom in to keep it 3D
        map.setTilt(45);
        placeMarker(place.geometry.location, true);

        const addr = place.formatted_address || place.name;
        updateInfoBar(addr, place.geometry.location.lat(), place.geometry.location.lng());
        sendLocationToApp(place.geometry.location.lat(), place.geometry.location.lng(), addr);
      });

      map.addListener("click", (e) => {
        placeMarker(e.latLng, false);
      });

      if (window.__pendingCurrentLocation) {
        const pending = window.__pendingCurrentLocation;
        window.__pendingCurrentLocation = null;
        setCurrentLocation(pending.lat, pending.lng, pending.address || '');
      }
    }

    function setCurrentLocation(lat, lng, existingAddress) {
      const safeLat = parseFloat(lat);
      const safeLng = parseFloat(lng);

      if (Number.isNaN(safeLat) || Number.isNaN(safeLng)) return;

      if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
        window.__pendingCurrentLocation = { lat: safeLat, lng: safeLng, address: existingAddress || '' };
        return;
      }

      if (!map) initMap();

      const pos = new google.maps.LatLng(safeLat, safeLng);
      map.setCenter(pos);
      map.setZoom(18);
      map.setTilt(45);
      placeMarker(pos, true);

      if (existingAddress && existingAddress !== 'Selected Location' && existingAddress !== 'Finding address...') {
        updateInfoBar(existingAddress, safeLat, safeLng);
        sendLocationToApp(safeLat, safeLng, existingAddress);
        return;
      }

      updateInfoBar('Detecting your current address...', safeLat, safeLng);
      sendLocationToApp(safeLat, safeLng, 'Detecting your current address...');

      geocoder.geocode({ location: pos }, (results, status) => {
        if (status === "OK" && results[0]) {
          updateInfoBar(results[0].formatted_address, safeLat, safeLng);
          sendLocationToApp(safeLat, safeLng, results[0].formatted_address);
        } else {
          const fallback = 'Location at ' + safeLat.toFixed(6) + ', ' + safeLng.toFixed(6);
          updateInfoBar(null, safeLat, safeLng);
          sendLocationToApp(safeLat, safeLng, fallback);
        }
      });
    }

    function initWithLocation(lat, lng, existingAddress) {
      if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
        setTimeout(() => initWithLocation(lat, lng, existingAddress), 200);
        return;
      }
      
      const pos = { lat: parseFloat(lat), lng: parseFloat(lng) };
      if (!map) initMap();
      
      map.setCenter(pos);
      map.setZoom(18); // Use 18 here too so 3D/tilt stays active
      map.setTilt(45);
      placeMarker(pos, true);
      
      if (existingAddress && existingAddress !== 'Selected Location' && existingAddress !== 'Finding address...') {
        updateInfoBar(existingAddress, pos.lat, pos.lng);
      } else {
        placeMarker(pos, false); // force geocode update
      }
    }

    window.onload = () => {
      if (typeof google !== 'undefined' && google.maps) {
        initMap();
      }
    };

    window.setCurrentLocation = setCurrentLocation;
    window.initWithLocation = initWithLocation;
  </script>
</body>
</html>`;

const getStatusColor = (status) => {
  switch (status) {
    case 'critical': 
    case 'new': return COLORS.error;
    case 'high':
    case 'in_progress': return COLORS.warning;
    case 'normal':
    case 'pending': return COLORS.brownLight;
    default: return COLORS.success;
  }
};

const getUrgencyColor = (urgency) => {
  switch (urgency?.toLowerCase()) {
    case 'critical': return '#DC2626';
    case 'high': return '#EA580C';
    case 'normal': case 'medium': return '#F59E0B';
    case 'low': return '#10B981';
    default: return '#F59E0B';
  }
};

const parseReportDate = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value?.toDate === 'function') {
    const converted = value.toDate();
    return Number.isNaN(converted?.getTime?.()) ? null : converted;
  }

  if (typeof value === 'number') {
    const millis = value > 1e12 ? value : value * 1000;
    const fromNumber = new Date(millis);
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
  }

  if (typeof value === 'string') {
    const fromString = new Date(value);
    return Number.isNaN(fromString.getTime()) ? null : fromString;
  }

  if (typeof value === 'object') {
    const seconds = value.seconds ?? value._seconds;
    if (typeof seconds === 'number') {
      const nanos = value.nanoseconds ?? value._nanoseconds ?? 0;
      const millis = seconds * 1000 + Math.floor(nanos / 1e6);
      const fromTimestampObj = new Date(millis);
      return Number.isNaN(fromTimestampObj.getTime()) ? null : fromTimestampObj;
    }
  }

  return null;
};

const getReportDate = (report = {}) => {
  return (
    parseReportDate(report.created_at) ||
    parseReportDate(report.createdAt) ||
    parseReportDate(report.reported_at) ||
    parseReportDate(report.updated_at) ||
    null
  );
};

const getReportAnimalType = (report = {}) => {
  const rawType =
    report.animal_type ||
    report.animalType ||
    report.animal ||
    report.type ||
    report.animal_kind ||
    '';

  if (!rawType) return 'Unknown';

  const normalized = String(rawType).trim();
  if (!normalized) return 'Unknown';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
};

const formatTimeAgo = (dateValue) => {
  const date = parseReportDate(dateValue);
  if (!date) return 'Unknown time';

  const now = new Date();
  const diffMs = now - date;
  if (diffMs < 0) return 'Just now';

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
};

// Check if requester is guest or registered
const isGuestRequester = (report = {}) => {
  const reporterId = String(
    report.reporter_id || report.reporter_uid || report.user_id || report.created_by || ''
  ).trim();
  const reporterType = String(report.reporter_type || '').trim().toLowerCase();

  if (reporterType) {
    return reporterType !== 'member' && reporterType !== 'registered';
  }

  return !reporterId;
};

const RescueCard = ({ request, onVolunteer, onView }) => {
  return (
    <TouchableOpacity style={styles.rescueCard} activeOpacity={0.8} onPress={() => onView(request)}>
      {/* Card Header with Urgency and Status Badges */}
      <View style={styles.rescueCardHeader}>
        <View style={styles.urgencyBadge}>
          <View style={[styles.urgencyDot, { backgroundColor: getUrgencyColor(request.urgency) }]} />
          <Text style={[styles.urgencyBadgeText, { color: getUrgencyColor(request.urgency) }]}>
            {(request.urgency || 'Normal').toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerBadges}>
          {/* Requester Type Badge */}
          <View style={[styles.requesterBadge, isGuestRequester(request) ? styles.guestBadge : styles.registeredBadge]}>
            <Ionicons 
              name={isGuestRequester(request) ? 'person-outline' : 'person'} 
              size={10} 
              color={isGuestRequester(request) ? '#9CA3AF' : '#059669'} 
            />
            <Text style={[styles.requesterText, isGuestRequester(request) ? styles.guestText : styles.registeredText]}>
              {isGuestRequester(request) ? 'Guest' : 'Member'}
            </Text>
          </View>
          <View style={[styles.cardStatusBadge, { backgroundColor: getStatusColor(request.status) + '20' }]}>
            <Text style={[styles.cardStatusText, { color: getStatusColor(request.status) }]}>
              {request.status?.replace(/_/g, ' ') || 'New'}
            </Text>
          </View>
        </View>
      </View>

      {/* Card Body with Image and Details */}
      <View style={styles.rescueCardBody}>
        {request.images && request.images[0] ? (
          <Image source={{ uri: getImageUrl(request.images[0]) }} style={styles.rescueCardImage} />
        ) : (
          <View style={styles.rescueCardImagePlaceholder}>
            <Ionicons name="paw" size={32} color={COLORS.textMedium} />
          </View>
        )}
        <View style={styles.rescueCardDetails}>
          <Text style={styles.rescueCardTitle} numberOfLines={2}>
            {request.title || request.description?.substring(0, 50) || `Rescue Report #${request.id}`}
          </Text>
          <View style={styles.rescueCardMeta}>
            <Ionicons name="location" size={14} color={COLORS.textMedium} />
            <Text style={styles.rescueCardMetaText} numberOfLines={1}>
              {request.location || request.location_description || request.city || 'Location not specified'}
            </Text>
          </View>
          <View style={styles.rescueCardMeta}>
            <Ionicons name="time" size={14} color={COLORS.textMedium} />
            <Text style={styles.rescueCardMetaText}>
              {formatTimeAgo(getReportDate(request))}
            </Text>
          </View>
          {getReportAnimalType(request) !== 'Unknown' && (
            <View style={styles.rescueCardMeta}>
              <Ionicons name="paw" size={14} color={COLORS.textMedium} />
              <Text style={styles.rescueCardMetaText}>{getReportAnimalType(request)}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Action Button */}
      {request.status !== 'rescued' && request.status !== 'closed' && (
        <TouchableOpacity style={styles.helpButton} onPress={() => onView(request)}>
          <FontAwesome5 name="hand-holding-heart" size={14} color={COLORS.textWhite} />
          <Text style={styles.helpButtonText}>View Details</Text>
        </TouchableOpacity>
      )}
      {request.status === 'rescued' && (
        <View style={[styles.helpButton, { backgroundColor: COLORS.success }]}>
          <Ionicons name="checkmark-circle" size={16} color={COLORS.textWhite} />
          <Text style={styles.helpButtonText}>Successfully Rescued!</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const RescueScreen = ({ onNavigateToLogin, onNavigateToRescuerDashboard, prefills = {} }) => {
  const { user } = useAuth();
  const currentUserId = String(user?.uid || user?.id || '').trim();
  const reporterRoleLabel = currentUserId ? 'Registered User' : 'Guest Reporter';
  const [activeTab, setActiveTab] = useState('requests');
  const [rescueRequests, setRescueRequests] = useState([]);
  const [stats, setStats] = useState({ active: 0, volunteers: 0, rescued: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Location picker state
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const webViewRef = useRef(null);
  const screenAnim = useRef(new Animated.Value(0)).current;
  const primaryActionScale = useRef(new Animated.Value(1)).current;
  
  // Multi-step form state
  const [currentStep, setCurrentStep] = useState(1);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    animalType: '',
    urgency: 'normal',
    latitude: null,
    longitude: null,
    reporter_name: prefills.name || '',
    reporter_phone: prefills.phone || '',
    reporter_email: prefills.email || '',
    condition: '',
    estimatedCount: '1',
  });

  const formatAddressFromReverseGeocode = (parts = {}) => {
    const street = [parts.name, parts.street].filter(Boolean).join(' ').trim();
    const city = parts.city || parts.subregion || parts.region || '';
    const country = parts.country || '';
    const composed = [street, city, country].filter(Boolean).join(', ');
    return composed || '';
  };

  const escapeForSingleQuotedJs = (value = '') =>
    String(value)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, ' ');

  useEffect(() => {
    const fallbackName = user?.full_name || user?.name || user?.displayName || '';
    const fallbackPhone = user?.phone_number || user?.phone || user?.phoneNumber || '';
    const fallbackEmail = user?.email || '';

    const prefillName = prefills?.name || '';
    const prefillPhone = prefills?.phone || '';
    const prefillEmail = prefills?.email || '';

    const nextName = prefillName || fallbackName;
    const nextPhone = prefillPhone || fallbackPhone;
    const nextEmail = prefillEmail || fallbackEmail;

    setFormData((prev) => ({
      ...prev,
      reporter_name: prev.reporter_name || nextName,
      reporter_phone: prev.reporter_phone || nextPhone,
      reporter_email: prev.reporter_email || nextEmail,
    }));
  }, [prefills?.email, prefills?.name, prefills?.phone, user?.displayName, user?.email, user?.full_name, user?.name, user?.phone, user?.phoneNumber, user?.phone_number]);

  // Form navigation
  const goToNextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const goToPrevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1:
        if (!formData.title.trim()) {
          Alert.alert('Required', 'Please enter a title for your report.');
          return false;
        }
        if (!formData.animalType) {
          Alert.alert('Required', 'Please select the type of animal.');
          return false;
        }
        return true;
      case 2:
        if (!formData.location.trim()) {
          Alert.alert('Required', 'Please enter the location or pin it on the map.');
          return false;
        }
        return true;
      case 3:
        if (!formData.description.trim()) {
          Alert.alert('Required', 'Please provide a description of the situation.');
          return false;
        }
        return true;
      case 4:
        return true;
      default:
        return true;
    }
  };

  const updateFormData = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    fetchData();
    requestPermissions();

    Animated.timing(screenAnim, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, []);

  const onPrimaryPressIn = useCallback(() => {
    Animated.spring(primaryActionScale, {
      toValue: 0.97,
      friction: 6,
      tension: 220,
      useNativeDriver: true,
    }).start();
  }, [primaryActionScale]);

  const onPrimaryPressOut = useCallback(() => {
    Animated.spring(primaryActionScale, {
      toValue: 1,
      friction: 6,
      tension: 220,
      useNativeDriver: true,
    }).start();
  }, [primaryActionScale]);

  const screenAnimatedStyle = {
    opacity: screenAnim,
    transform: [
      {
        translateY: screenAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  };

  const requestPermissions = async () => {
    // Request camera permissions
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraPermission.status !== 'granted' || mediaPermission.status !== 'granted') {
      // Camera or media library permissions not granted - features may be limited
    }

    // Request location permissions
    const locationPermission = await Location.requestForegroundPermissionsAsync();
    if (locationPermission.status !== 'granted') {
      // Location permission not granted - features may be limited
    }
  };

  const getCurrentLocation = async () => {
    try {
      setIsLoadingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location permissions to use this feature.');
        return;
      }

      const lastKnown = await Location.getLastKnownPositionAsync({});
      const location = lastKnown ||
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          mayShowUserSettingsDialog: true,
        }));

      if (!location?.coords) {
        Alert.alert('Location Unavailable', 'Unable to detect your location right now. Please try again.');
        return;
      }

      const { latitude, longitude } = location.coords;

      let resolvedAddress = '';
      try {
        const reverseResult = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (Array.isArray(reverseResult) && reverseResult[0]) {
          resolvedAddress = formatAddressFromReverseGeocode(reverseResult[0]);
        }
      } catch (reverseError) {
        console.warn('Reverse geocode failed:', reverseError);
      }

      setSelectedCoordinates({ latitude, longitude });
      setFormData((prev) => ({
        ...prev,
        latitude,
        longitude,
        location: resolvedAddress || prev.location,
      }));

      const safeAddress = escapeForSingleQuotedJs(resolvedAddress);

      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(
          `if (typeof setCurrentLocation === 'function') { setCurrentLocation(${latitude}, ${longitude}, '${safeAddress}'); } else { window.__pendingCurrentLocation = { lat: ${latitude}, lng: ${longitude}, address: '${safeAddress}' }; } true;`
        );
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get your current location. Please try again.');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleMapMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'locationSelected') {
        // Always update coordinates
        setSelectedCoordinates({
          latitude: data.latitude,
          longitude: data.longitude,
        });
        
        // Only update address if it's not a loading placeholder
        const isLoadingAddress = data.address === 'Finding address...' || 
                                  data.address === 'Loading address...' ||
                                  data.address === 'Selected Location';
        
        setFormData(prev => ({
          ...prev,
          // Keep previous location if new one is just a loading state
          location: isLoadingAddress ? prev.location : data.address,
          latitude: data.latitude,
          longitude: data.longitude,
        }));
      }
    } catch (error) {
      console.error('Error parsing map message:', error);
    }
  };

  const confirmLocationSelection = () => {
    if (!selectedCoordinates) {
      Alert.alert('No Location', 'Please tap on the map to select a location.');
      return;
    }
    setShowLocationPicker(false);
  };

  const openLocationPicker = () => {
    setShowLocationPicker(true);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch rescue reports and stats in parallel
      const [reportsResponse, statsResponse] = await Promise.all([
        rescueService.getRescueReports({ limit: 20 }),
        rescueService.getRescueStats(),
      ]);

      // Handle reports
      if (reportsResponse.success && Array.isArray(reportsResponse.data)) {
        setRescueRequests(reportsResponse.data);
      } else if (Array.isArray(reportsResponse.data)) {
        setRescueRequests(reportsResponse.data);
      } else if (Array.isArray(reportsResponse)) {
        setRescueRequests(reportsResponse);
      }

      // Handle stats
      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      } else if (statsResponse.data) {
        setStats(statsResponse.data);
      } else if (statsResponse.active !== undefined) {
        setStats(statsResponse);
      }
    } catch (error) {
      console.error('Error fetching rescue data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const handleVolunteer = async (reportId) => {
    if (!user) {
      Alert.alert(
        'Login Required',
        'Please log in first so we can verify your identity before you volunteer for a rescue.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Login',
            onPress: () => onNavigateToLogin && onNavigateToLogin(),
          },
        ]
      );
      return;
    }

    try {
      const currentUserId = user?.uid || user?.id;
      if (!currentUserId) {
        Alert.alert('Unable to Verify', 'Please sign in again before volunteering.');
        return;
      }

      const applicationsQuery = query(
        collection(db, 'rescuer_applications'),
        where('user_id', '==', currentUserId)
      );
      const snapshot = await getDocs(applicationsQuery);

      if (snapshot.empty) {
        Alert.alert(
          'Rescuer Account Required',
          'You are not a verified rescuer yet. Please apply for rescuer verification in Settings before helping on rescue missions.'
        );
        return;
      }

      const applications = snapshot.docs.map((applicationDoc) => ({
        id: applicationDoc.id,
        ...applicationDoc.data(),
      }));

      applications.sort((a, b) => {
        const aMillis = a.created_at?.toDate ? a.created_at.toDate().getTime() : 0;
        const bMillis = b.created_at?.toDate ? b.created_at.toDate().getTime() : 0;
        return bMillis - aMillis;
      });

      const latestStatus = String(applications[0]?.status || '').toLowerCase();
      if (latestStatus !== 'approved') {
        const statusMessage =
          latestStatus === 'pending'
            ? 'Your rescuer application is still pending approval. Please wait for admin verification.'
            : latestStatus === 'rejected'
            ? 'Your rescuer application was rejected. Please re-apply in Settings to help with rescue missions.'
            : latestStatus === 'revoked'
            ? 'Your rescuer access has been revoked. Please contact admin for assistance.'
            : 'You need an approved rescuer account to help with this report.';

        Alert.alert('Rescuer Verification Needed', statusMessage);
        return;
      }

      Alert.alert(
        'Verified Rescuer',
        'Opening your rescuer dashboard so you can respond to this report.',
        [{ text: 'Go to Dashboard', onPress: () => onNavigateToRescuerDashboard && onNavigateToRescuerDashboard() }]
      );
    } catch (error) {
      console.error('Volunteer eligibility check error:', error);
      Alert.alert('Error', 'Failed to verify rescuer account. Please try again.');
    }
  };

  const handleViewReport = (report) => {
    setSelectedReport(report);
    setCurrentImageIndex(0);
    setViewModalVisible(true);
  };

  const convertImageToBase64 = async (imageUri) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const extension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error('Error converting image:', error);
      return null;
    }
  };

  const handleSubmitReport = async () => {
    if (!formData.title || !formData.description || !formData.location) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    if (!formData.reporter_name?.trim()) {
      Alert.alert('Missing Information', 'Please enter your name so rescuers can contact you.');
      return;
    }

    const cleanedReporterPhone = formData.reporter_phone?.replace(/[\s\-\(\)]/g, '') || '';
    const phoneRegex = /^(09|\+639)\d{9}$/;
    if (!phoneRegex.test(cleanedReporterPhone)) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number (e.g., 09171234567 or +639171234567).');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.reporter_email || '')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    try {
      setSubmitting(true);
      
      // Convert selected images to base64
      const base64Images = [];
      for (const img of selectedImages) {
        const base64 = await convertImageToBase64(img.uri);
        if (base64) {
          base64Images.push(base64);
        }
      }
      
      // Prepare the complete data to send
      const reportData = {
        ...formData,
        reporter_phone: cleanedReporterPhone,
        images: base64Images.length > 0 ? base64Images : undefined,
      };
      
      // Use the regular createRescueReport with base64 images
      const response = await rescueService.createRescueReport(reportData);
      
      if (response.success || response.data || response.message) {
        Alert.alert('Success', 'Your rescue report has been submitted successfully! Rescuers will be notified.');
        setFormData({ 
          title: '', 
          description: '', 
          location: '', 
          animalType: '', 
          urgency: 'normal', 
          latitude: null, 
          longitude: null,
          reporter_name: prefills?.name || '',
          reporter_phone: prefills?.phone || '',
          reporter_email: prefills?.email || '',
          condition: '',
          estimatedCount: '1',
        });
        setSelectedImages([]);
        setSelectedCoordinates(null);
        setCurrentStep(1);
        setActiveTab('requests');
        fetchData();
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const MAX_IMAGES = 5;
  const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

  const validateImageSize = async (uri) => {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.size && info.size > MAX_IMAGE_SIZE_BYTES) {
        return false;
      }
      return true;
    } catch {
      return true; // allow if we can't check
    }
  };

  const pickImageFromCamera = async () => {
    setShowImagePickerModal(false);
    
    if (selectedImages.length >= MAX_IMAGES) {
      Alert.alert('Limit Reached', `You can only add up to ${MAX_IMAGES} photos.`);
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const sizeOk = await validateImageSize(asset.uri);
        if (!sizeOk) {
          Alert.alert('Image Too Large', 'Each image must be under 5 MB.');
          return;
        }
        const newImage = {
          uri: asset.uri,
          type: asset.mimeType || 'image/jpeg',
          fileName: asset.fileName || `photo_${Date.now()}.jpg`,
        };
        setSelectedImages(prev => [...prev, newImage]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const pickImageFromGallery = async () => {
    setShowImagePickerModal(false);
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES - selectedImages.length,
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const validAssets = [];
        for (const asset of result.assets) {
          const sizeOk = await validateImageSize(asset.uri);
          if (!sizeOk) continue;
          validAssets.push({
            uri: asset.uri,
            type: asset.mimeType || 'image/jpeg',
            fileName: asset.fileName || `photo_${Date.now()}.jpg`,
          });
        }
        if (validAssets.length < result.assets.length) {
          Alert.alert('Some Images Skipped', 'Images over 5 MB were excluded.');
        }
        setSelectedImages(prev => [...prev, ...validAssets].slice(0, MAX_IMAGES));
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    }
  };

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddPhoto = () => {
    if (selectedImages.length >= 5) {
      Alert.alert('Limit Reached', 'You can only add up to 5 photos.');
      return;
    }
    setShowImagePickerModal(true);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      <Animated.View style={[styles.screenAnimatedWrap, screenAnimatedStyle]}>
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
        >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Rescue & Help</Text>
          <View style={styles.headerSubtitleRow}>
            <Text style={styles.headerSubtitle}>Be a hero today </Text>
            <FontAwesome5 name="hand-holding-heart" size={16} color={COLORS.primary} />
          </View>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
            onPress={() => setActiveTab('requests')}
          >
            <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
              Rescue Requests
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'report' && styles.tabActive]}
            onPress={() => setActiveTab('report')}
          >
            <Text style={[styles.tabText, activeTab === 'report' && styles.tabTextActive]}>
              Report a Stray
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'requests' ? (
          <>
            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{stats.active || 0}</Text>
                <Text style={styles.statLabel}>Active</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{stats.volunteers || 0}</Text>
                <Text style={styles.statLabel}>Volunteers</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{stats.rescued || 0}</Text>
                <Text style={styles.statLabel}>Saved</Text>
              </View>
            </View>

            {/* Rescue Requests */}
            <View style={styles.requestsContainer}>
              <Text style={styles.sectionTitle}>Active Requests</Text>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.loadingText}>Loading rescue reports...</Text>
                </View>
              ) : rescueRequests.length > 0 ? (
                rescueRequests.map((request) => (
                  <RescueCard key={request.id} request={request} onVolunteer={handleVolunteer} onView={handleViewReport} />
                ))
              ) : (
                <View style={styles.emptyContainer}>
                  <FontAwesome5 name="hand-holding-heart" size={48} color={COLORS.textMedium} />
                  <Text style={styles.emptyText}>No active rescue requests</Text>
                  <Text style={styles.emptySubtext}>Check back later or report a stray</Text>
                </View>
              )}
            </View>
          </>
        ) : (
          /* Multi-step Report Form for Guests */
          <View style={styles.reportFormContainer}>
            {/* Form Header */}
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Report a Stray</Text>
              <Text style={styles.formSubtitle}>Step {currentStep} of 4 • Help us save lives</Text>
            </View>

            {/* Step Indicator */}
            <View style={styles.stepIndicator}>
              {GUEST_FORM_STEPS.map((step, index) => (
                <React.Fragment key={step.id}>
                  <TouchableOpacity
                    style={[
                      styles.stepDot,
                      currentStep >= step.id && styles.stepDotActive,
                      currentStep === step.id && styles.stepDotCurrent,
                    ]}
                    onPress={() => {
                      if (step.id < currentStep) setCurrentStep(step.id);
                    }}
                  >
                    <Ionicons
                      name={step.icon}
                      size={16}
                      color={currentStep >= step.id ? COLORS.textWhite : COLORS.textMedium}
                    />
                  </TouchableOpacity>
                  {index < GUEST_FORM_STEPS.length - 1 && (
                    <View style={[styles.stepLine, currentStep > step.id && styles.stepLineActive]} />
                  )}
                </React.Fragment>
              ))}
            </View>

            {/* Step Content */}
            <View style={styles.stepContent}>
              {currentStep === 1 && (
                <>
                  <Text style={styles.stepTitle}>What did you find?</Text>
                  <Text style={styles.stepSubtitle}>Tell us about the animal that needs help</Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Report Title *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., Injured dog near park"
                      placeholderTextColor={COLORS.textMedium}
                      value={formData.title}
                      onChangeText={(text) => updateFormData('title', text)}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Animal Type *</Text>
                    <View style={styles.animalTypeGrid}>
                      {ANIMAL_TYPES.map((type) => (
                        <TouchableOpacity
                          key={type.id}
                          style={[
                            styles.animalTypeCard,
                            formData.animalType === type.id && styles.animalTypeCardActive,
                          ]}
                          onPress={() => updateFormData('animalType', type.id)}
                        >
                          <MaterialCommunityIcons
                            name={type.icon}
                            size={32}
                            color={formData.animalType === type.id ? COLORS.textWhite : COLORS.primary}
                          />
                          <Text style={[
                            styles.animalTypeLabel,
                            formData.animalType === type.id && styles.animalTypeLabelActive,
                          ]}>
                            {type.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Urgency Level</Text>
                    <View style={styles.urgencyList}>
                      {URGENCY_LEVELS.map((level) => (
                        <TouchableOpacity
                          key={level.value}
                          style={[
                            styles.urgencyCard,
                            formData.urgency === level.value && { borderColor: level.color, backgroundColor: level.color + '15' },
                          ]}
                          onPress={() => updateFormData('urgency', level.value)}
                        >
                          <View style={[styles.urgencyIcon, { backgroundColor: level.color + '20' }]}>
                            <Ionicons name={level.icon} size={20} color={level.color} />
                          </View>
                          <View style={styles.urgencyInfo}>
                            <Text style={[
                              styles.urgencyLabel,
                              formData.urgency === level.value && { color: level.color, fontWeight: '700' },
                            ]}>
                              {level.label}
                            </Text>
                            <Text style={styles.urgencyDesc}>{level.description}</Text>
                          </View>
                          {formData.urgency === level.value && (
                            <Ionicons name="checkmark-circle" size={22} color={level.color} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              )}

              {currentStep === 2 && (
                <>
                  <Text style={styles.stepTitle}>Where is the animal?</Text>
                  <Text style={styles.stepSubtitle}>Provide accurate location for quick response</Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Location Address *</Text>
                    <TextInput
                      style={[styles.input, styles.locationInputField]}
                      placeholder="Enter the address or landmark"
                      placeholderTextColor={COLORS.textMedium}
                      value={formData.location}
                      onChangeText={(text) => updateFormData('location', text)}
                      multiline
                    />
                  </View>

                  {formData.latitude && formData.longitude && (
                    <View style={styles.locationPinned}>
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                      <Text style={styles.locationPinnedText}>Location pinned on map</Text>
                    </View>
                  )}

                  <Animated.View style={{ transform: [{ scale: primaryActionScale }] }}>
                    <TouchableOpacity
                      style={styles.mapButton}
                      onPress={openLocationPicker}
                      onPressIn={onPrimaryPressIn}
                      onPressOut={onPrimaryPressOut}
                    >
                      <View style={styles.mapButtonIcon}>
                        <Ionicons name="map" size={24} color={COLORS.textWhite} />
                      </View>
                      <View style={styles.mapButtonText}>
                        <Text style={styles.mapButtonTitle}>
                          {formData.latitude ? 'Change Location on Map' : 'Pin Location on Map'}
                        </Text>
                        <Text style={styles.mapButtonSubtitle}>Tap to open interactive map</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={24} color={COLORS.textMedium} />
                    </TouchableOpacity>
                  </Animated.View>
                </>
              )}

              {currentStep === 3 && (
                <>
                  <Text style={styles.stepTitle}>More Details</Text>
                  <Text style={styles.stepSubtitle}>Help rescuers understand the situation</Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Description *</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="Describe the animal's condition, behavior, and any other relevant details..."
                      placeholderTextColor={COLORS.textMedium}
                      value={formData.description}
                      onChangeText={(text) => updateFormData('description', text)}
                      multiline
                      numberOfLines={5}
                      textAlignVertical="top"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Animal Condition</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., Injured, Malnourished, Healthy"
                      placeholderTextColor={COLORS.textMedium}
                      value={formData.condition}
                      onChangeText={(text) => updateFormData('condition', text)}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Number of Animals</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="1"
                      placeholderTextColor={COLORS.textMedium}
                      value={formData.estimatedCount}
                      onChangeText={(text) => updateFormData('estimatedCount', text.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                    />
                  </View>
                </>
              )}

              {currentStep === 4 && (
                <>
                  <Text style={styles.stepTitle}>Add Photos & Contact</Text>
                  <Text style={styles.stepSubtitle}>Photos help rescuers identify the animal</Text>

                  <TouchableOpacity style={styles.photoUploadCard} onPress={handleAddPhoto}>
                    <View style={styles.photoUploadIcon}>
                      <Ionicons name="camera" size={40} color={COLORS.primary} />
                    </View>
                    <Text style={styles.photoUploadTitle}>
                      {selectedImages.length > 0 ? `Add More Photos (${selectedImages.length}/5)` : 'Add Photos'}
                    </Text>
                    <Text style={styles.photoUploadSubtitle}>Take a photo or choose from gallery</Text>
                  </TouchableOpacity>

                  {selectedImages.length > 0 && (
                    <View style={styles.imageGrid}>
                      {selectedImages.map((image, index) => (
                        <View key={index} style={styles.imageGridItem}>
                          <Image source={{ uri: image.uri }} style={styles.imageGridImage} />
                          <TouchableOpacity
                            style={styles.imageRemoveButton}
                            onPress={() => removeImage(index)}
                          >
                            <Ionicons name="close-circle" size={26} color={COLORS.error} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Guest Contact Info */}
                  <View style={styles.guestContactSection}>
                    <View style={styles.guestContactHeader}>
                      <Ionicons name="person-circle-outline" size={22} color={COLORS.primary} />
                      <Text style={styles.guestContactTitle}>Your Contact Info </Text>
                    </View>
                    <Text style={styles.guestContactSubtitle}>
                      Provide your details so rescuers can contact you for updates
                    </Text>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Your Name</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your name"
                        placeholderTextColor={COLORS.textMedium}
                        value={formData.reporter_name}
                        onChangeText={(text) => updateFormData('reporter_name', text)}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Phone Number</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your phone number"
                        placeholderTextColor={COLORS.textMedium}
                        keyboardType="phone-pad"
                        value={formData.reporter_phone}
                        onChangeText={(text) => updateFormData('reporter_phone', text)}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Email</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your email"
                        placeholderTextColor={COLORS.textMedium}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={formData.reporter_email}
                        onChangeText={(text) => updateFormData('reporter_email', text)}
                      />
                    </View>
                  </View>

                  {/* Guest Reporting Info */}
                  <View style={styles.guestReporterPreview}>
                    <Text style={styles.guestReporterTitle}>Reporting as:</Text>
                    <View style={styles.guestReporterCard}>
                      <View style={styles.guestReporterAvatar}>
                        <Ionicons name="person" size={24} color={COLORS.primary} />
                      </View>
                      <View style={styles.guestReporterInfo}>
                        <Text style={styles.guestReporterName}>
                          {formData.reporter_name || 'Anonymous Guest'}
                        </Text>
                        <Text style={styles.guestReporterEmail}>
                          {formData.reporter_email || 'No email provided'}
                        </Text>
                        <Text style={styles.guestReporterRole}>{reporterRoleLabel}</Text>
                      </View>
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Navigation Buttons */}
            <View style={styles.navigationButtons}>
              {currentStep > 1 && (
                <TouchableOpacity style={styles.prevButton} onPress={goToPrevStep} activeOpacity={0.7}>
                  <Ionicons name="arrow-back" size={20} color={COLORS.textDark} />
                  <Text style={styles.prevButtonText}>Back</Text>
                </TouchableOpacity>
              )}
              
              {currentStep < 4 ? (
                <Animated.View style={{ flex: 1, transform: [{ scale: primaryActionScale }] }}>
                  <TouchableOpacity
                    style={[styles.nextButton, currentStep === 1 && styles.nextButtonFull]}
                    onPress={goToNextStep}
                    onPressIn={onPrimaryPressIn}
                    onPressOut={onPrimaryPressOut}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.nextButtonText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={20} color={COLORS.textWhite} />
                  </TouchableOpacity>
                </Animated.View>
              ) : (
                <Animated.View style={{ flex: 1, transform: [{ scale: primaryActionScale }] }}>
                  <TouchableOpacity
                    style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                    onPress={handleSubmitReport}
                    onPressIn={onPrimaryPressIn}
                    onPressOut={onPrimaryPressOut}
                    disabled={submitting}
                    activeOpacity={0.9}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color={COLORS.textWhite} />
                    ) : (
                      <>
                        <Ionicons name="send" size={20} color={COLORS.textWhite} />
                        <Text style={styles.submitBtnText}>Submit Report</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>
          </View>
        )}

        <View style={styles.bottomSpacing} />
        </ScrollView>
      </Animated.View>

      {/* Image Picker Modal */}
      <Modal
        visible={showImagePickerModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowImagePickerModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowImagePickerModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Photo</Text>
            <Text style={styles.modalSubtitle}>Choose how you want to add a photo</Text>
            
            <TouchableOpacity style={styles.modalOption} onPress={pickImageFromCamera}>
              <View style={styles.modalOptionIcon}>
                <Ionicons name="camera" size={28} color={COLORS.primary} />
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>Take Photo</Text>
                <Text style={styles.modalOptionDesc}>Use your camera to take a new photo</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={COLORS.textMedium} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalOption} onPress={pickImageFromGallery}>
              <View style={styles.modalOptionIcon}>
                <Ionicons name="images" size={28} color={COLORS.primary} />
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.modalOptionDesc}>Select photos from your device</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={COLORS.textMedium} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalCancelBtn} 
              onPress={() => setShowImagePickerModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* View Report Modal */}
      <Modal
        visible={viewModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setViewModalVisible(false)}
      >
        <View style={styles.viewModalOverlay}>
          <View style={styles.viewModalContent}>
            {/* Modal Header */}
            <View style={styles.viewModalHeader}>
              <Text style={styles.viewModalTitle}>Report Details</Text>
              <TouchableOpacity onPress={() => setViewModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            {selectedReport && (
              <ScrollView style={styles.viewModalScroll} showsVerticalScrollIndicator={false}>
                {/* Images */}
                {selectedReport.images && selectedReport.images.length > 0 && (
                  <View style={styles.viewImageContainer}>
                    <Image
                      source={{ uri: getImageUrl(selectedReport.images[currentImageIndex]) }}
                      style={styles.viewMainImage}
                      resizeMode="cover"
                    />
                    {selectedReport.images.length > 1 && (
                      <View style={styles.viewImageNavigation}>
                        <TouchableOpacity
                          style={[styles.viewImageNavBtn, currentImageIndex === 0 && styles.viewImageNavBtnDisabled]}
                          onPress={() => setCurrentImageIndex(Math.max(0, currentImageIndex - 1))}
                          disabled={currentImageIndex === 0}
                        >
                          <Ionicons name="chevron-back" size={24} color={currentImageIndex === 0 ? COLORS.textLight : COLORS.textDark} />
                        </TouchableOpacity>
                        <Text style={styles.viewImageCounter}>
                          {currentImageIndex + 1} / {selectedReport.images.length}
                        </Text>
                        <TouchableOpacity
                          style={[styles.viewImageNavBtn, currentImageIndex === selectedReport.images.length - 1 && styles.viewImageNavBtnDisabled]}
                          onPress={() => setCurrentImageIndex(Math.min(selectedReport.images.length - 1, currentImageIndex + 1))}
                          disabled={currentImageIndex === selectedReport.images.length - 1}
                        >
                          <Ionicons name="chevron-forward" size={24} color={currentImageIndex === selectedReport.images.length - 1 ? COLORS.textLight : COLORS.textDark} />
                        </TouchableOpacity>
                      </View>
                    )}
                    {/* Image Thumbnails */}
                    {selectedReport.images.length > 1 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.viewThumbnailScroll}>
                        {selectedReport.images.map((img, index) => (
                          <TouchableOpacity
                            key={index}
                            onPress={() => setCurrentImageIndex(index)}
                            style={[styles.viewThumbnail, currentImageIndex === index && styles.viewThumbnailActive]}
                          >
                            <Image source={{ uri: getImageUrl(img) }} style={styles.viewThumbnailImage} />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                )}

                {/* Status & Urgency Badges */}
                <View style={styles.viewBadgeRow}>
                  <View style={[styles.viewBadge, { backgroundColor: getStatusColor(selectedReport.status) + '20' }]}>
                    <View style={[styles.viewBadgeDot, { backgroundColor: getStatusColor(selectedReport.status) }]} />
                    <Text style={[styles.viewBadgeText, { color: getStatusColor(selectedReport.status) }]}>
                      {selectedReport.status?.replace('_', ' ').toUpperCase() || 'NEW'}
                    </Text>
                  </View>
                  <View style={[styles.viewBadge, { backgroundColor: getStatusColor(selectedReport.urgency) + '20' }]}>
                    <Text style={[styles.viewBadgeText, { color: getStatusColor(selectedReport.urgency) }]}>
                      {selectedReport.urgency?.toUpperCase() || 'NORMAL'} URGENCY
                    </Text>
                  </View>
                </View>

                {/* Title */}
                <Text style={styles.viewReportTitle}>{selectedReport.title}</Text>

                {/* Info Cards */}
                <View style={styles.viewInfoCard}>
                  <View style={styles.viewInfoRow}>
                    <Ionicons name="paw" size={20} color={COLORS.primary} />
                    <View style={styles.viewInfoContent}>
                      <Text style={styles.viewInfoLabel}>Animal Type</Text>
                      <Text style={styles.viewInfoValue}>{getReportAnimalType(selectedReport)}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.viewInfoCard}>
                  <View style={styles.viewInfoRow}>
                    <Ionicons name="location" size={20} color={COLORS.primary} />
                    <View style={styles.viewInfoContent}>
                      <Text style={styles.viewInfoLabel}>Location</Text>
                      <Text style={styles.viewInfoValue}>{selectedReport.location || selectedReport.city || selectedReport.location_description || 'Unknown location'}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.viewInfoCard}>
                  <View style={styles.viewInfoRow}>
                    <Ionicons name="time" size={20} color={COLORS.primary} />
                    <View style={styles.viewInfoContent}>
                      <Text style={styles.viewInfoLabel}>Reported</Text>
                      <Text style={styles.viewInfoValue}>{formatTimeAgo(getReportDate(selectedReport))}</Text>
                    </View>
                  </View>
                </View>

                {/* Reporter Contact Information */}
                {(selectedReport.reporter_name || selectedReport.reporter_phone || selectedReport.reporter_email) && (
                  <View style={styles.viewDescriptionCard}>
                    <View style={styles.contactHeader}>
                      <Ionicons name="person" size={18} color={COLORS.primary} />
                      <Text style={styles.viewDescriptionLabel}>Reporter Contact Information</Text>
                    </View>
                    {selectedReport.reporter_name && (
                      <View style={styles.viewInfoRow}>
                        <Ionicons name="person-outline" size={18} color={COLORS.textMedium} />
                        <View style={styles.viewInfoContent}>
                          <Text style={styles.viewInfoLabel}>Name</Text>
                          <Text style={styles.viewInfoValue}>{selectedReport.reporter_name}</Text>
                        </View>
                      </View>
                    )}
                    {selectedReport.reporter_phone && (
                      <View style={[styles.viewInfoRow, { marginTop: 12 }]}>
                        <Ionicons name="call-outline" size={18} color={COLORS.textMedium} />
                        <View style={styles.viewInfoContent}>
                          <Text style={styles.viewInfoLabel}>Phone</Text>
                          <Text style={styles.viewInfoValue}>{selectedReport.reporter_phone}</Text>
                        </View>
                      </View>
                    )}
                    {selectedReport.reporter_email && (
                      <View style={[styles.viewInfoRow, { marginTop: 12 }]}>
                        <Ionicons name="mail-outline" size={18} color={COLORS.textMedium} />
                        <View style={styles.viewInfoContent}>
                          <Text style={styles.viewInfoLabel}>Email</Text>
                          <Text style={styles.viewInfoValue}>{selectedReport.reporter_email}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* Description */}
                <View style={styles.viewDescriptionCard}>
                  <Text style={styles.viewDescriptionLabel}>Description</Text>
                  <Text style={styles.viewDescriptionText}>{selectedReport.description}</Text>
                </View>

                {/* Action Button */}
                {selectedReport.status !== 'rescued' && selectedReport.status !== 'closed' && (
                  user ? (
                    <TouchableOpacity
                      style={styles.viewHelpButton}
                      onPress={() => {
                        setViewModalVisible(false);
                        handleVolunteer(selectedReport.id);
                      }}
                    >
                      <FontAwesome5 name="hand-holding-heart" size={18} color={COLORS.textWhite} />
                      <Text style={styles.viewHelpButtonText}>I Can Help</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.viewHelpButton, { backgroundColor: COLORS.textMedium }]}
                      onPress={() => {
                        setViewModalVisible(false);
                        if (onNavigateToLogin) onNavigateToLogin();
                      }}
                    >
                      <Ionicons name="log-in-outline" size={18} color={COLORS.textWhite} />
                      <Text style={styles.viewHelpButtonText}>Log in to Volunteer</Text>
                    </TouchableOpacity>
                  )
                )}

                <View style={{ height: 30 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Location Picker Modal */}
      <Modal
        visible={showLocationPicker}
        animationType="slide"
        onRequestClose={() => setShowLocationPicker(false)}
      >
        <View style={styles.locationPickerContainer}>
          {/* Header */}
          <View style={styles.locationPickerHeader}>
            <TouchableOpacity onPress={() => setShowLocationPicker(false)} style={styles.locationPickerCloseBtn}>
              <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
            <View style={styles.locationPickerTitleContainer}>
              <Text style={styles.locationPickerTitle}>Pin Location</Text>
              <Text style={styles.locationPickerSubtitle}>Tap on map or search</Text>
            </View>
            <TouchableOpacity 
              style={styles.currentLocationHeaderBtn} 
              onPress={getCurrentLocation}
              disabled={isLoadingLocation}
            >
              {isLoadingLocation ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Ionicons name="locate" size={22} color={COLORS.primary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.confirmHeaderBtn, !selectedCoordinates && styles.confirmHeaderBtnDisabled]} 
              onPress={confirmLocationSelection}
              disabled={!selectedCoordinates}
            >
              <Ionicons name="checkmark" size={24} color={COLORS.textWhite} />
            </TouchableOpacity>
          </View>

          {/* Map WebView */}
          <View style={styles.mapContainer}>
            <WebView
              ref={webViewRef}
              source={{ html: getMapHtml(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '') }}
              style={styles.mapWebView}
              onMessage={handleMapMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              onLoad={() => {
                // If there are existing coordinates, initialize the map with them
                if (selectedCoordinates && webViewRef.current) {
                  const existingAddress = formData.location || '';
                  webViewRef.current.injectJavaScript(
                    `initWithLocation(${selectedCoordinates.latitude}, ${selectedCoordinates.longitude}, '${escapeForSingleQuotedJs(existingAddress)}'); true;`
                  );
                }
              }}
              renderLoading={() => (
                <View style={styles.mapLoading}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.mapLoadingText}>Loading map...</Text>
                </View>
              )}
            />
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
  screenAnimatedWrap: {
    flex: 1,
  },

  // Header
  header: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textMedium,
  },

  // Emergency Banner
  emergencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.errorBackground,
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.errorLight,
  },
  emergencyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.backgroundWhite,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  emergencyContent: {
    flex: 1,
  },
  emergencyTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.error,
    marginBottom: 4,
  },
  emergencyPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emergencyNumber: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
    marginLeft: 6,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.round,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: RADIUS.round - 2,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textMedium,
  },
  tabTextActive: {
    color: COLORS.textWhite,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.backgroundWhite,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statNumber: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
    marginTop: 4,
  },

  // Requests
  requestsContainer: {
    paddingHorizontal: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.lg,
  },
  rescueCard: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  
  // New Rescue Card Styles (matching UserRescuerDashboardScreen)
  rescueCardHeader: {
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
  urgencyBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
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
  cardStatusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  cardStatusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    textTransform: 'capitalize',
  },
  rescueCardBody: {
    flexDirection: 'row',
  },
  rescueCardImage: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
  },
  rescueCardImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rescueCardDetails: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  rescueCardTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
    marginBottom: SPACING.xs,
  },
  rescueCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  rescueCardMetaText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginLeft: 6,
    flex: 1,
  },
  
  // Legacy styles (keeping for backward compatibility)
  rescueImage: {
    width: '100%',
    height: 160,
  },
  statusBadge: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  statusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },
  rescueDetails: {
    padding: SPACING.lg,
  },
  rescueTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: 6,
  },
  rescueDescription: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  locationText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginLeft: 6,
  },
  rescueFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  reporterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reporterName: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textLight,
    marginLeft: 6,
  },
  timeAgo: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textLight,
  },
  helpButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.round,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  helpButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },

  // Report Form
  reportForm: {
    paddingHorizontal: SPACING.xl,
  },
  formTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    marginBottom: SPACING.xxl,
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  locationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  inputFlex: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark,
  },
  locationBtn: {
    paddingHorizontal: SPACING.lg,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  uploadText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.primary,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.round,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  submitButtonText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },

  bottomSpacing: {
    height: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },

  // Image Preview Styles
  imagePreviewContainer: {
    marginBottom: SPACING.lg,
  },
  imagePreviewTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
    marginBottom: SPACING.sm,
  },
  imagePreviewScroll: {
    flexDirection: 'row',
  },
  imagePreviewWrapper: {
    position: 'relative',
    marginRight: SPACING.md,
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.backgroundWhite,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 12,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.backgroundWhite,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : SPACING.xl,
  },
  modalTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  modalSubtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
  },
  modalOptionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  modalOptionText: {
    flex: 1,
  },
  modalOptionTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
  },
  modalOptionDesc: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: 2,
  },
  modalCancelBtn: {
    marginTop: SPACING.md,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.error,
  },

  submitButtonDisabled: {
    opacity: 0.7,
  },

  // View Modal Styles
  viewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  viewModalContent: {
    backgroundColor: COLORS.backgroundWhite,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '90%',
    minHeight: '70%',
  },
  viewModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  viewModalTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  viewModalScroll: {
    flex: 1,
    padding: SPACING.xl,
  },
  viewImageContainer: {
    marginBottom: SPACING.xl,
  },
  viewMainImage: {
    width: '100%',
    height: 220,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.background,
  },
  viewImageNavigation: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
    gap: SPACING.lg,
  },
  viewImageNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewImageNavBtnDisabled: {
    opacity: 0.5,
  },
  viewImageCounter: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    fontWeight: FONTS.weights.medium,
  },
  viewThumbnailScroll: {
    marginTop: SPACING.md,
  },
  viewThumbnail: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.md,
    marginRight: SPACING.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  viewThumbnailActive: {
    borderColor: COLORS.primary,
  },
  viewThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  viewBadgeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  viewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    gap: 6,
  },
  viewBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  viewBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
  viewReportTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.xl,
  },
  viewInfoCard: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  viewInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewInfoContent: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  viewInfoLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
    marginBottom: 2,
  },
  viewInfoValue: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.medium,
    color: COLORS.textDark,
  },
  viewDescriptionCard: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
  },
  viewDescriptionLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textMedium,
    marginBottom: SPACING.sm,
  },
  viewDescriptionText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark,
    lineHeight: 22,
  },
  viewHelpButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.round,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  viewHelpButtonText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },

  // Location Picker Styles
  coordinatesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    gap: 6,
  },
  coordinatesText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.success,
  },
  mapPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  mapPickerBtnText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textWhite,
  },
  locationPickerContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  locationPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + SPACING.sm : 50,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.backgroundWhite,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  locationPickerCloseBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  locationPickerTitleContainer: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  locationPickerTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  locationPickerSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: 2,
  },
  currentLocationHeaderBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: COLORS.accent,
    marginRight: SPACING.sm,
  },
  confirmHeaderBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  confirmHeaderBtnDisabled: {
    backgroundColor: COLORS.textMedium,
    opacity: 0.5,
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: 0,
    borderRadius: 0,
    overflow: 'hidden',
    marginBottom: 0,
  },
  mapWebView: {
    flex: 1,
  },
  mapLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  mapLoadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
  },

  // Urgency Selector Styles
  urgencyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  urgencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.backgroundWhite,
    gap: 6,
  },
  urgencyText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.medium,
    color: COLORS.textMedium,
  },

  // Contact Section Styles
  contactSection: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  contactTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  contactSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginBottom: SPACING.lg,
    lineHeight: 18,
  },

  // Multi-step Form Styles
  reportFormContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  formHeader: {
    marginBottom: SPACING.lg,
  },

  // Step Indicator
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.xl,
  },
  stepDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.borderLight,
  },
  stepDotActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  stepDotCurrent: {
    transform: [{ scale: 1.1 }],
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  stepLine: {
    flex: 1,
    height: 3,
    backgroundColor: COLORS.borderLight,
    marginHorizontal: SPACING.xs,
  },
  stepLineActive: {
    backgroundColor: COLORS.primary,
  },

  // Step Content
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.xs,
  },
  stepSubtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    marginBottom: SPACING.xl,
  },

  // Animal Type Grid
  animalTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  animalTypeCard: {
    width: (SCREEN_WIDTH - SPACING.lg * 2 - SPACING.sm * 3) / 4,
    aspectRatio: 1,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.borderLight,
  },
  animalTypeCardActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  animalTypeLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.medium,
    color: COLORS.textDark,
    marginTop: SPACING.xs,
  },
  animalTypeLabelActive: {
    color: COLORS.textWhite,
  },

  // Urgency List (vertical cards)
  urgencyList: {
    gap: SPACING.sm,
  },
  urgencyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.borderLight,
  },
  urgencyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  urgencyInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  urgencyLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
  },
  urgencyDesc: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
    marginTop: 2,
  },

  // Location Step
  locationInputField: {
    minHeight: 60,
  },
  locationPinned: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '15',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  locationPinnedText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.success,
    fontWeight: FONTS.weights.medium,
    marginLeft: SPACING.xs,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  mapButtonIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapButtonText: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  mapButtonTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
  },
  mapButtonSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: 2,
  },

  // Photo Step
  photoUploadCard: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    marginBottom: SPACING.xl,
  },
  photoUploadIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  photoUploadTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  photoUploadSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: SPACING.xs,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  imageGridItem: {
    width: (SCREEN_WIDTH - SPACING.lg * 2 - SPACING.sm * 2) / 3,
    aspectRatio: 1,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  imageGridImage: {
    width: '100%',
    height: '100%',
  },
  imageRemoveButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 13,
  },

  // Guest Contact Section
  guestContactSection: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  guestContactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  guestContactTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  guestContactSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginBottom: SPACING.lg,
    lineHeight: 18,
  },

  // Guest Reporter Preview
  guestReporterPreview: {
    marginTop: SPACING.md,
  },
  guestReporterTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textMedium,
    marginBottom: SPACING.sm,
  },
  guestReporterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  guestReporterAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestReporterInfo: {
    marginLeft: SPACING.md,
  },
  guestReporterName: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
  },
  guestReporterEmail: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: 2,
  },
  guestReporterRole: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.warning,
    fontWeight: FONTS.weights.semiBold,
    marginTop: 4,
  },

  // Navigation Buttons
  navigationButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xl,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  prevButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  prevButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
    marginLeft: SPACING.xs,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.primary,
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
    marginRight: SPACING.xs,
  },
  submitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.success,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
    marginLeft: SPACING.xs,
  },
});

export default memo(RescueScreen);
