import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services';
import api from '../../services/api';
import CONFIG from '../../config/config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Map HTML for location picker
const LOCATION_MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #map { width: 100%; height: 100%; }
    .leaflet-control-attribution { display: none; }
    
    .marker-container {
      position: relative;
      width: 40px;
      height: 50px;
    }
    .marker-pin {
      width: 36px;
      height: 36px;
      border-radius: 50% 50% 50% 0;
      background: linear-gradient(135deg, #8B4513 0%, #A0522D 100%);
      position: absolute;
      transform: rotate(-45deg);
      left: 50%;
      top: 50%;
      margin: -18px 0 0 -18px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.3);
      border: 3px solid white;
    }
    .marker-pin::after {
      content: '';
      width: 16px;
      height: 16px;
      margin: 10px 0 0 10px;
      background: white;
      position: absolute;
      border-radius: 50%;
    }
    .marker-pulse {
      width: 14px;
      height: 14px;
      background: rgba(139, 69, 19, 0.3);
      border-radius: 50%;
      position: absolute;
      left: 50%;
      bottom: -5px;
      margin-left: -7px;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(3); opacity: 0; }
    }
    
    .search-container {
      position: absolute;
      top: 12px;
      left: 12px;
      right: 12px;
      z-index: 1000;
    }
    .search-box {
      display: flex;
      gap: 10px;
      background: white;
      padding: 8px;
      border-radius: 12px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.15);
    }
    .search-input {
      flex: 1;
      padding: 12px 16px;
      border: 2px solid #E8E8E8;
      border-radius: 8px;
      font-size: 15px;
      outline: none;
      -webkit-appearance: none;
    }
    .search-input:focus {
      border-color: #8B4513;
    }
    .search-btn {
      padding: 12px 20px;
      background: linear-gradient(135deg, #8B4513 0%, #A0522D 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    
    .search-results {
      display: none;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.15);
      max-height: 250px;
      overflow-y: auto;
      margin-top: 8px;
    }
    .search-result-item {
      padding: 14px 16px;
      border-bottom: 1px solid #F0F0F0;
      cursor: pointer;
      font-size: 14px;
      color: #333;
    }
    .search-result-item:last-child {
      border-bottom: none;
    }
    .search-loading {
      display: none;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.15);
      padding: 20px;
      margin-top: 8px;
      text-align: center;
      color: #666;
    }
    
    .info-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: white;
      padding: 16px 20px;
      box-shadow: 0 -4px 15px rgba(0,0,0,0.1);
      z-index: 1000;
      border-radius: 20px 20px 0 0;
    }
    .info-title {
      font-size: 12px;
      color: #888;
      font-weight: 500;
      text-transform: uppercase;
    }
    .info-address {
      font-size: 15px;
      color: #333;
      font-weight: 500;
      margin-top: 4px;
    }
    .info-coords {
      font-size: 12px;
      color: #888;
      margin-top: 6px;
    }
    
    .floating-hint {
      position: absolute;
      top: 90px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.75);
      color: white;
      padding: 10px 20px;
      border-radius: 25px;
      font-size: 13px;
      font-weight: 500;
      z-index: 999;
      pointer-events: none;
      white-space: nowrap;
    }
    .floating-hint.hidden {
      opacity: 0;
    }
  </style>
</head>
<body>
  <div class="search-container">
    <div class="search-box">
      <input type="text" id="searchInput" class="search-input" placeholder="Search for your location..." autocomplete="off" />
      <button class="search-btn" id="searchBtn">Search</button>
    </div>
    <div class="search-loading" id="searchLoading">Searching...</div>
    <div class="search-results" id="searchResults"></div>
  </div>
  
  <div id="map"></div>
  <div class="floating-hint" id="floatingHint">Tap on map to pin your location</div>
  
  <div class="info-bar" id="infoBar">
    <div class="info-title">Your Location</div>
    <div class="info-address" id="addressDisplay">Tap on the map to select</div>
    <div class="info-coords" id="coordsDisplay"></div>
  </div>
  
  <script>
    // ============================================
    // Enhanced Geocoding Module for Pawmilya Maps
    // ============================================
    
    var GeocodingModule = (function() {
      var NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
      var USER_AGENT = 'PawmilyaApp/1.0 (Animal Rescue Application)';
      var MAX_RETRIES = 3;
      var RETRY_DELAY = 1500;
      var TIMEOUT = 10000;
      var MIN_REQUEST_INTERVAL = 1100;
      var lastRequestTime = 0;
      
      function waitForRateLimit() {
        return new Promise(function(resolve) {
          var now = Date.now();
          var timeSinceLastRequest = now - lastRequestTime;
          if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
            setTimeout(function() {
              lastRequestTime = Date.now();
              resolve();
            }, MIN_REQUEST_INTERVAL - timeSinceLastRequest);
          } else {
            lastRequestTime = Date.now();
            resolve();
          }
        });
      }
      
      function formatAddress(data) {
        if (!data) return null;
        var addr = data.address;
        if (addr) {
          var parts = [];
          if (addr.building) parts.push(addr.building);
          if (addr.house_number) parts.push(addr.house_number);
          if (addr.road || addr.street) parts.push(addr.road || addr.street);
          if (addr.neighbourhood) parts.push(addr.neighbourhood);
          if (addr.subdivision) parts.push(addr.subdivision);
          if (addr.suburb) parts.push(addr.suburb);
          if (addr.quarter) parts.push(addr.quarter);
          if (addr.city || addr.town || addr.municipality || addr.village) {
            parts.push(addr.city || addr.town || addr.municipality || addr.village);
          }
          if (addr.state || addr.province || addr.region) {
            parts.push(addr.state || addr.province || addr.region);
          }
          if (addr.postcode) parts.push(addr.postcode);
          if (parts.length > 0) return parts.join(', ');
        }
        return data.display_name || null;
      }
      
      function extractCity(data) {
        if (!data || !data.address) return '';
        var addr = data.address;
        return addr.city || addr.town || addr.municipality || addr.village || addr.county || '';
      }
      
      function fetchWithTimeout(url, options, timeout) {
        return new Promise(function(resolve, reject) {
          var timer = setTimeout(function() { reject(new Error('Request timeout')); }, timeout);
          fetch(url, options)
            .then(function(response) { clearTimeout(timer); resolve(response); })
            .catch(function(error) { clearTimeout(timer); reject(error); });
        });
      }
      
      function reverseGeocode(lat, lng, callback) {
        var retries = 0;
        function attemptGeocode() {
          waitForRateLimit().then(function() {
            var url = NOMINATIM_URL + '/reverse?format=json&lat=' + lat + '&lon=' + lng + '&addressdetails=1&zoom=18&accept-language=en';
            fetchWithTimeout(url, {
              headers: { 'Accept': 'application/json', 'User-Agent': USER_AGENT }
            }, TIMEOUT)
            .then(function(response) {
              if (!response.ok) throw new Error('HTTP ' + response.status);
              return response.json();
            })
            .then(function(data) {
              if (data.error) {
                callback({ address: 'Location at ' + lat.toFixed(6) + ', ' + lng.toFixed(6), city: '', raw: null });
                return;
              }
              callback({
                address: formatAddress(data) || 'Location at ' + lat.toFixed(6) + ', ' + lng.toFixed(6),
                city: extractCity(data),
                raw: data
              });
            })
            .catch(function(error) {
              console.warn('Geocoding attempt ' + (retries + 1) + ' failed:', error.message);
              retries++;
              if (retries < MAX_RETRIES) {
                setTimeout(attemptGeocode, RETRY_DELAY * retries);
              } else {
                callback({ address: 'Location at ' + lat.toFixed(6) + ', ' + lng.toFixed(6), city: '', raw: null });
              }
            });
          });
        }
        attemptGeocode();
      }
      
      function forwardGeocode(query, callback, limit) {
        limit = limit || 5;
        var retries = 0;
        var searchQuery = query.indexOf('Philippines') > -1 ? query : query + ', Philippines';
        function attemptSearch() {
          waitForRateLimit().then(function() {
            var url = NOMINATIM_URL + '/search?format=json&q=' + encodeURIComponent(searchQuery) + '&limit=' + limit + '&addressdetails=1&accept-language=en';
            fetchWithTimeout(url, {
              headers: { 'Accept': 'application/json', 'User-Agent': USER_AGENT }
            }, TIMEOUT)
            .then(function(response) {
              if (!response.ok) throw new Error('HTTP ' + response.status);
              return response.json();
            })
            .then(function(data) {
              var results = data.map(function(item) {
                return {
                  lat: parseFloat(item.lat),
                  lon: parseFloat(item.lon),
                  display_name: formatAddress(item) || item.display_name,
                  city: extractCity(item),
                  raw: item
                };
              });
              callback(results, null);
            })
            .catch(function(error) {
              console.warn('Search attempt ' + (retries + 1) + ' failed:', error.message);
              retries++;
              if (retries < MAX_RETRIES) {
                setTimeout(attemptSearch, RETRY_DELAY * retries);
              } else {
                callback([], error);
              }
            });
          });
        }
        attemptSearch();
      }
      
      return {
        reverseGeocode: reverseGeocode,
        forwardGeocode: forwardGeocode,
        formatAddress: formatAddress,
        extractCity: extractCity
      };
    })();
    
    // ============================================
    // Map Initialization
    // ============================================
    
    var map = L.map('map', { zoomControl: false }).setView([14.5995, 120.9842], 13);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);
    
    var marker = null;
    var customIcon = L.divIcon({
      className: 'marker-container',
      html: '<div class="marker-pin"></div><div class="marker-pulse"></div>',
      iconSize: [40, 50],
      iconAnchor: [20, 45]
    });
    
    var searchInput = document.getElementById('searchInput');
    var searchBtn = document.getElementById('searchBtn');
    var searchResults = document.getElementById('searchResults');
    var searchLoading = document.getElementById('searchLoading');
    var floatingHint = document.getElementById('floatingHint');
    var addressDisplay = document.getElementById('addressDisplay');
    var coordsDisplay = document.getElementById('coordsDisplay');
    
    function hideSearchResults() {
      searchResults.style.display = 'none';
      searchLoading.style.display = 'none';
    }
    
    function updateInfoBar(address, lat, lng, city) {
      addressDisplay.textContent = address || 'Tap on the map to select';
      if (lat && lng) {
        coordsDisplay.textContent = 'Coordinates: ' + lat.toFixed(6) + ', ' + lng.toFixed(6);
      } else {
        coordsDisplay.textContent = '';
      }
    }
    
    function sendLocationToApp(lat, lng, address, city) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'locationSelected',
        latitude: lat,
        longitude: lng,
        address: address,
        city: city || ''
      }));
    }
    
    function placeMarker(lat, lng, skipGeocode) {
      if (marker) map.removeLayer(marker);
      marker = L.marker([lat, lng], {icon: customIcon}).addTo(map);
      floatingHint.classList.add('hidden');
      
      if (skipGeocode) return;
      
      updateInfoBar('Finding address...', lat, lng, '');
      sendLocationToApp(lat, lng, 'Finding address...', '');
      
      GeocodingModule.reverseGeocode(lat, lng, function(result) {
        updateInfoBar(result.address, lat, lng, result.city);
        sendLocationToApp(lat, lng, result.address, result.city);
      });
    }
    
    map.on('click', function(e) {
      hideSearchResults();
      placeMarker(e.latlng.lat, e.latlng.lng, false);
    });
    
    function searchLocation() {
      var query = searchInput.value.trim();
      if (!query) return;
      
      searchResults.style.display = 'none';
      searchLoading.style.display = 'block';
      
      GeocodingModule.forwardGeocode(query, function(results, error) {
        searchLoading.style.display = 'none';
        
        if (error) {
          searchResults.innerHTML = '<div class="search-result-item">Search failed. Please try again.</div>';
          searchResults.style.display = 'block';
          return;
        }
        
        if (results && results.length > 0) {
          searchResults.innerHTML = '';
          results.forEach(function(item) {
            var div = document.createElement('div');
            div.className = 'search-result-item';
            div.textContent = item.display_name;
            div.onclick = function() {
              map.setView([item.lat, item.lon], 17);
              placeMarker(item.lat, item.lon, true);
              updateInfoBar(item.display_name, item.lat, item.lon, item.city);
              sendLocationToApp(item.lat, item.lon, item.display_name, item.city);
              hideSearchResults();
              searchInput.value = '';
            };
            searchResults.appendChild(div);
          });
          searchResults.style.display = 'block';
        } else {
          searchResults.innerHTML = '<div class="search-result-item">No results found</div>';
          searchResults.style.display = 'block';
        }
      }, 5);
    }
    
    searchBtn.addEventListener('click', searchLocation);
    searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') searchLocation();
    });
    
    function setCurrentLocation(lat, lng) {
      map.setView([lat, lng], 17);
      placeMarker(lat, lng, false);
    }
  </script>
</body>
</html>
`;

const UserRescuerRegistrationScreen = ({ onGoBack }) => {
  const { user } = useAuth();
  const webViewRef = useRef(null);
  
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    latitude: null,
    longitude: null,
    experience: '',
    motivation: '',
    availability: [],
    transportationType: '',
    agreedToTerms: false,
  });
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [existingApplication, setExistingApplication] = useState(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  // Fetch user profile and populate form on mount
  useEffect(() => {
    fetchUserProfile();
  }, []);

  // Also update form when user context changes
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        fullName: prev.fullName || user.full_name || user.name || '',
        phone: prev.phone || user.phone || '',
        email: prev.email || user.email || '',
      }));
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const response = await userService.getProfile();
      if (response.success && response.data) {
        const profile = response.data;
        setFormData(prev => ({
          ...prev,
          fullName: profile.full_name || profile.name || prev.fullName || '',
          phone: profile.phone || prev.phone || '',
          email: profile.email || prev.email || '',
        }));
      } else if (response.data) {
        const profile = response.data;
        setFormData(prev => ({
          ...prev,
          fullName: profile.full_name || profile.name || prev.fullName || '',
          phone: profile.phone || prev.phone || '',
          email: profile.email || prev.email || '',
        }));
      }
    } catch (error) {
      // Silently fail - use data from auth context if available
      // Fall back to user context data
      if (user) {
        setFormData(prev => ({
          ...prev,
          fullName: prev.fullName || user.full_name || user.name || '',
          phone: prev.phone || user.phone || '',
          email: prev.email || user.email || '',
        }));
      }
    }
  };

  // Check if user already has an application on mount
  useEffect(() => {
    checkExistingApplication();
  }, [user?.id]);

  const checkExistingApplication = async () => {
    if (!user?.id) {
      setCheckingStatus(false);
      return;
    }

    try {
      setCheckingStatus(true);
      const response = await api.get('/rescuer-applications/my-application');
      const data = response.data || response;
      
      if (data.hasApplication && data.application) {
        setExistingApplication(data.application);
      } else {
        setExistingApplication(null);
      }
    } catch (error) {
      // Silently ignore 403 errors (user suspended)
      if (error?.status !== 403) {
        console.error('Error checking application status:', error);
      }
      setExistingApplication(null);
    } finally {
      setCheckingStatus(false);
    }
  };

  const availabilityOptions = [
    { id: 'weekday_morning', label: 'Weekday Mornings' },
    { id: 'weekday_afternoon', label: 'Weekday Afternoons' },
    { id: 'weekday_evening', label: 'Weekday Evenings' },
    { id: 'weekend_morning', label: 'Weekend Mornings' },
    { id: 'weekend_afternoon', label: 'Weekend Afternoons' },
    { id: 'weekend_evening', label: 'Weekend Evenings' },
    { id: 'emergency', label: '24/7 Emergency' },
  ];

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleAvailability = (id) => {
    setFormData((prev) => ({
      ...prev,
      availability: prev.availability.includes(id)
        ? prev.availability.filter((a) => a !== id)
        : [...prev.availability, id],
    }));
  };

  // Location picker functions
  const getCurrentLocation = async () => {
    try {
      setIsLoadingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location services to use this feature.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const { latitude, longitude } = location.coords;
      
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`setCurrentLocation(${latitude}, ${longitude}); true;`);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not get your current location. Please enable location services.');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleMapMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'locationSelected') {
        setFormData(prev => ({
          ...prev,
          address: data.address,
          city: data.city || '',
          latitude: data.latitude,
          longitude: data.longitude,
        }));
      }
    } catch (error) {
      console.error('Map message error:', error);
    }
  };

  const confirmLocationSelection = () => {
    if (!formData.latitude || !formData.longitude) {
      Alert.alert('Select Location', 'Please tap on the map to select your location');
      return;
    }
    setShowLocationPicker(false);
  };

  const handleSubmit = async () => {
    // Check if user is logged in
    if (!user?.id) {
      try {
        const profileResponse = await userService.getProfile();
        if (profileResponse.success && profileResponse.data?.id) {
          // Continue with the profile user ID
          await submitApplication(profileResponse.data.id);
          return;
        }
      } catch (error) {
        // Profile fetch failed
      }
      Alert.alert('Error', 'Please log in again and try submitting your application.');
      return;
    }
    
    await submitApplication(user.id);
  };
  
  const submitApplication = async (userId) => {
    // Validation
    if (!formData.fullName.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return;
    }
    if (!formData.phone.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }
    if (!formData.address.trim() || !formData.latitude) {
      Alert.alert('Error', 'Please select your location on the map');
      return;
    }
    if (!formData.motivation.trim()) {
      Alert.alert('Error', 'Please tell us why you want to become a rescuer');
      return;
    }
    if (formData.availability.length === 0) {
      Alert.alert('Error', 'Please select at least one availability option');
      return;
    }
    if (!formData.transportationType) {
      Alert.alert('Error', 'Please select your transportation type');
      return;
    }
    if (!formData.agreedToTerms) {
      Alert.alert('Error', 'Please agree to the terms and conditions');
      return;
    }

    setLoading(true);
    try {
      const applicationData = {
        user_id: userId,
        full_name: formData.fullName,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        city: formData.city || '',
        latitude: formData.latitude,
        longitude: formData.longitude,
        experience: formData.experience,
        reason: formData.motivation,
        availability: formData.availability.join(','),
        transportation_type: formData.transportationType,
      };

      const response = await api.post('/rescuer-applications', applicationData);

      // Refresh application status to show pending message
      await checkExistingApplication();
      
      Alert.alert(
        'Application Submitted!',
        'Thank you for applying to become a rescuer. We will review your application and contact you soon.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      // Silently ignore 403 errors (user suspended)
      if (error?.status !== 403) {
        console.error('Error submitting application:', error);
      }
      
      // Check if it's a network error
      if (error.message === 'Network request failed' || error.message.includes('Network')) {
        Alert.alert(
          'Network Error', 
          'Unable to connect to the server. Please check your internet connection and try again.'
        );
      } else {
        Alert.alert('Error', error.message || 'Failed to submit application. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Get status display info
  const getStatusInfo = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return {
          color: '#F59E0B',
          bgColor: '#FEF3C7',
          icon: 'time',
          title: 'Application Pending',
          message: 'Your application is currently being reviewed by our team. We will notify you once a decision has been made.',
        };
      case 'approved':
        return {
          color: '#10B981',
          bgColor: '#D1FAE5',
          icon: 'checkmark-circle',
          title: 'Application Approved!',
          message: 'Congratulations! You are now a registered rescuer. Go back to access your rescuer dashboard.',
        };
      case 'rejected':
        return {
          color: '#EF4444',
          bgColor: '#FEE2E2',
          icon: 'close-circle',
          title: 'Application Not Approved',
          message: 'Unfortunately, your application was not approved at this time. You may reapply below after addressing the issues mentioned.',
        };
      case 'revoked':
        return {
          color: '#FF9800',
          bgColor: '#FFF3E0',
          icon: 'shield-outline',
          title: 'Rescuer Verification Revoked',
          message: 'Your rescuer verification has been revoked. Please review the reason below and reapply after addressing the issues.',
        };
      default:
        return null;
    }
  };

  // Loading state while checking application status
  if (checkingStatus) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Checking application status...</Text>
      </View>
    );
  }

  // Show existing application status
  if (existingApplication && existingApplication.status !== 'rejected' && existingApplication.status !== 'revoked') {
    const statusInfo = getStatusInfo(existingApplication.status);
    
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Application Status</Text>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.statusContent}>
          {/* Status Card */}
          <View style={[styles.statusCard, { backgroundColor: statusInfo?.bgColor || COLORS.backgroundWhite }]}>
            <View style={[styles.statusIconContainer, { backgroundColor: statusInfo?.color + '20' }]}>
              <Ionicons name={statusInfo?.icon || 'document'} size={48} color={statusInfo?.color || COLORS.primary} />
            </View>
            <Text style={[styles.statusTitle, { color: statusInfo?.color || COLORS.textDark }]}>
              {statusInfo?.title || 'Application Submitted'}
            </Text>
            <Text style={styles.statusMessage}>
              {statusInfo?.message || 'Your application has been submitted.'}
            </Text>
          </View>

          {/* Application Details */}
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Application Details</Text>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Submitted On</Text>
              <Text style={styles.detailValue}>
                {existingApplication.created_at 
                  ? new Date(existingApplication.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : 'N/A'
                }
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Full Name</Text>
              <Text style={styles.detailValue}>{existingApplication.full_name || 'N/A'}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Phone</Text>
              <Text style={styles.detailValue}>{existingApplication.phone || 'N/A'}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusInfo?.color + '20' }]}>
                <Text style={[styles.statusBadgeText, { color: statusInfo?.color }]}>
                  {existingApplication.status?.toUpperCase() || 'PENDING'}
                </Text>
              </View>
            </View>
          </View>

          {/* Info Note */}
          <View style={styles.infoNote}>
            <Ionicons name="information-circle" size={20} color={COLORS.primary} />
            <Text style={styles.infoNoteText}>
              If you have any questions about your application, please contact our support team.
            </Text>
          </View>

          {/* Go Back Button */}
          <TouchableOpacity style={styles.goBackButton} onPress={onGoBack} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textWhite} />
            <Text style={styles.goBackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // If application was rejected or revoked, show reason and allow reapply
  const showRejectionNotice = existingApplication && (existingApplication.status === 'rejected' || existingApplication.status === 'revoked');
  const statusInfo = existingApplication ? getStatusInfo(existingApplication.status) : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
              <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Become a Rescuer</Text>
          </View>

          {/* Rejection/Revocation Notice */}
          {showRejectionNotice && (
            <View style={[styles.rejectionNotice, { backgroundColor: statusInfo?.bgColor }]}>
              <View style={styles.rejectionHeader}>
                <Ionicons name={statusInfo?.icon || 'alert-circle'} size={24} color={statusInfo?.color} />
                <Text style={[styles.rejectionTitle, { color: statusInfo?.color }]}>
                  {statusInfo?.title}
                </Text>
              </View>
              {existingApplication.rejection_reason && (
                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>Reason:</Text>
                  <Text style={styles.reasonText}>{existingApplication.rejection_reason}</Text>
                </View>
              )}
              <Text style={styles.rejectionMessage}>
                You can submit a new application below. Please address the issues mentioned above.
              </Text>
            </View>
          )}

          {/* Intro */}
          <View style={styles.introCard}>
            <MaterialCommunityIcons name="shield-star" size={40} color={COLORS.primary} />
            <Text style={styles.introTitle}>Join Our Rescue Team</Text>
            <Text style={styles.introText}>
              As a registered rescuer, you'll be notified of rescue reports in your area 
              and can help save animal lives.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Personal Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.fullName}
                onChangeText={(value) => handleInputChange('fullName', value)}
                placeholder="Enter your full name"
                placeholderTextColor={COLORS.textMedium}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number *</Text>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(value) => handleInputChange('phone', value)}
                placeholder="Enter your phone number"
                placeholderTextColor={COLORS.textMedium}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={formData.email}
                editable={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Your Location *</Text>
              <TouchableOpacity
                style={styles.locationPickerButton}
                onPress={() => setShowLocationPicker(true)}
              >
                <View style={styles.locationPickerContent}>
                  <View style={styles.locationIconContainer}>
                    <Ionicons 
                      name={formData.latitude ? "location" : "location-outline"} 
                      size={24} 
                      color={formData.latitude ? COLORS.primary : COLORS.textMedium} 
                    />
                  </View>
                  <View style={styles.locationTextContainer}>
                    {formData.latitude ? (
                      <>
                        <Text style={styles.locationAddressText} numberOfLines={2}>
                          {formData.address}
                        </Text>
                        {formData.city && (
                          <Text style={styles.locationCityText}>{formData.city}</Text>
                        )}
                      </>
                    ) : (
                      <Text style={styles.locationPlaceholder}>Tap to select your location on the map</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.textMedium} />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Experience & Motivation</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Previous Experience (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.experience}
                onChangeText={(value) => handleInputChange('experience', value)}
                placeholder="Describe any previous experience with animal rescue..."
                placeholderTextColor={COLORS.textMedium}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Why do you want to become a rescuer? *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.motivation}
                onChangeText={(value) => handleInputChange('motivation', value)}
                placeholder="Tell us what motivates you to help animals..."
                placeholderTextColor={COLORS.textMedium}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Availability *</Text>
            <Text style={styles.sectionSubtitle}>Select when you're available for rescues</Text>

            <View style={styles.availabilityGrid}>
              {availabilityOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.availabilityChip,
                    formData.availability.includes(option.id) && styles.availabilityChipActive,
                  ]}
                  onPress={() => toggleAvailability(option.id)}
                >
                  <Text
                    style={[
                      styles.availabilityChipText,
                      formData.availability.includes(option.id) && styles.availabilityChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Transportation *</Text>
            <Text style={styles.sectionSubtitle}>Select your primary mode of transportation for rescues</Text>

            <View style={styles.transportationGrid}>
              {[
                { id: 'car', label: 'Car', icon: 'car' },
                { id: 'motorcycle', label: 'Motorcycle', icon: 'bicycle' },
                { id: 'bicycle', label: 'Bicycle', icon: 'bicycle-outline' },
                { id: 'public_transport', label: 'Public Transport', icon: 'bus' },
                { id: 'on_foot', label: 'On Foot', icon: 'walk' },
                { id: 'none', label: 'No Transport', icon: 'close-circle-outline' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.transportationCard,
                    formData.transportationType === option.id && styles.transportationCardActive,
                  ]}
                  onPress={() => handleInputChange('transportationType', option.id)}
                >
                  <Ionicons
                    name={option.icon}
                    size={32}
                    color={formData.transportationType === option.id ? COLORS.primary : COLORS.textMedium}
                  />
                  <Text
                    style={[
                      styles.transportationLabel,
                      formData.transportationType === option.id && styles.transportationLabelActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Terms & Conditions</Text>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => handleInputChange('agreedToTerms', !formData.agreedToTerms)}
            >
              <View style={[styles.checkbox, formData.agreedToTerms && styles.checkboxActive]}>
                {formData.agreedToTerms && <Ionicons name="checkmark" size={16} color={COLORS.textWhite} />}
              </View>
              <Text style={styles.checkboxLabel}>
                I agree to the terms and conditions and commit to responding to rescue alerts when available *
              </Text>
            </TouchableOpacity>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <Text style={styles.submitButtonText}>Submitting...</Text>
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={20} color={COLORS.textWhite} />
                <Text style={styles.submitButtonText}>Submit Application</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.bottomSpacing} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Location Picker Modal */}
      <Modal
        visible={showLocationPicker}
        animationType="slide"
        onRequestClose={() => setShowLocationPicker(false)}
      >
        <View style={styles.locationPickerContainer}>
          <View style={styles.locationPickerHeader}>
            <TouchableOpacity
              onPress={() => setShowLocationPicker(false)}
              style={styles.locationCloseButton}
            >
              <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
            <View style={styles.locationHeaderCenter}>
              <Text style={styles.locationPickerTitle}>Select Your Location</Text>
              <Text style={styles.locationPickerSubtitle}>Tap on map to pin</Text>
            </View>
            <TouchableOpacity
              style={styles.currentLocationButton}
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
              style={[
                styles.confirmButton,
                (!formData.latitude || !formData.longitude) && styles.confirmButtonDisabled,
              ]}
              onPress={confirmLocationSelection}
              disabled={!formData.latitude || !formData.longitude}
            >
              <Ionicons name="checkmark" size={24} color={COLORS.textWhite} />
            </TouchableOpacity>
          </View>

          <View style={styles.mapContainer}>
            <WebView
              ref={webViewRef}
              source={{ html: LOCATION_MAP_HTML }}
              style={styles.mapWebView}
              onMessage={handleMapMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
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
  keyboardView: {
    flex: 1,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.backgroundWhite,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },

  // Intro
  introCard: {
    marginHorizontal: SPACING.xl,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    elevation: 3,
    marginBottom: SPACING.xxl,
  },
  introTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  introText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Form
  formSection: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.sm,
  },
  sectionSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginBottom: SPACING.md,
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
    marginBottom: SPACING.xs,
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
  inputDisabled: {
    backgroundColor: COLORS.backgroundLight,
    color: COLORS.textMedium,
  },
  textArea: {
    minHeight: 100,
    paddingTop: SPACING.md,
  },

  // Availability
  availabilityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  availabilityChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.backgroundWhite,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  availabilityChipActive: {
    backgroundColor: COLORS.primary,
  },
  availabilityChipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: FONTS.weights.medium,
  },
  availabilityChipTextActive: {
    color: COLORS.textWhite,
  },
  transportationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.sm,
    marginHorizontal: -4,
  },
  transportationCard: {
    width: '31%',
    aspectRatio: 1,
    margin: 4,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.sm,
  },
  transportationCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.accent,
  },
  transportationLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.medium,
    color: COLORS.textMedium,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  transportationLabelActive: {
    color: COLORS.primary,
    fontWeight: FONTS.weights.bold,
  },

  // Checkbox
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  checkboxActive: {
    backgroundColor: COLORS.primary,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textDark,
    lineHeight: 20,
  },

  // Submit
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.xl,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.round,
    elevation: 3,
    marginTop: SPACING.lg,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: COLORS.textWhite,
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    marginLeft: SPACING.sm,
  },

  bottomSpacing: {
    height: 40,
  },

  // Loading & Center Content
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
  },

  // Status Content
  statusContent: {
    padding: SPACING.xl,
    paddingBottom: 100,
  },
  statusCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  statusIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  statusTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  statusMessage: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Details Card
  detailsCard: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  detailsTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  detailLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
  },
  detailValue: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.round,
  },
  statusBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },

  // Info Note
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.primary + '10',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.xl,
  },
  infoNoteText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginLeft: SPACING.sm,
    lineHeight: 20,
  },

  // Go Back Button
  goBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.round,
    elevation: 3,
  },
  goBackButtonText: {
    color: COLORS.textWhite,
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    marginLeft: SPACING.sm,
  },

  // Rejection Notice Styles
  rejectionNotice: {
    margin: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  rejectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  rejectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  reasonBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  reasonLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: '#374151',
    marginBottom: 4,
  },
  reasonText: {
    fontSize: FONTS.sizes.md,
    color: '#1F2937',
    lineHeight: 20,
  },
  rejectionMessage: {
    fontSize: FONTS.sizes.md,
    color: '#374151',
    lineHeight: 20,
  },

  // Location Picker Button
  locationPickerButton: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    overflow: 'hidden',
  },
  locationPickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  locationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationAddressText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.medium,
    color: COLORS.textDark,
    lineHeight: 20,
  },
  locationCityText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: 2,
  },
  locationPlaceholder: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
  },

  // Location Picker Modal
  locationPickerContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 44,
  },
  locationPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.backgroundWhite,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  locationCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  locationPickerTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  locationPickerSubtitle: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
  },
  currentLocationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  confirmButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: COLORS.textMedium,
    opacity: 0.5,
  },
  mapContainer: {
    flex: 1,
  },
  mapWebView: {
    flex: 1,
  },
});

export default memo(UserRescuerRegistrationScreen);
