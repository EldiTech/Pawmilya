import React, { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { rescueService, userService } from '../../services';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Map HTML for location picker
const MAP_HTML = `
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
      <input type="text" id="searchInput" class="search-input" placeholder="Search for a place..." autocomplete="off" />
      <button class="search-btn" id="searchBtn">Search</button>
    </div>
    <div class="search-loading" id="searchLoading">Searching...</div>
    <div class="search-results" id="searchResults"></div>
  </div>
  
  <div id="map"></div>
  <div class="floating-hint" id="floatingHint">Tap on map to pin location</div>
  
  <div class="info-bar" id="infoBar">
    <div class="info-title">Selected Location</div>
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
    
    function updateInfoBar(address, lat, lng) {
      addressDisplay.textContent = address || 'Tap on the map to select';
      if (lat && lng) {
        coordsDisplay.textContent = 'Coordinates: ' + lat.toFixed(6) + ', ' + lng.toFixed(6);
      } else {
        coordsDisplay.textContent = '';
      }
    }
    
    function sendLocationToApp(lat, lng, address) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'locationSelected',
        latitude: lat,
        longitude: lng,
        address: address
      }));
    }
    
    function placeMarker(lat, lng, skipGeocode) {
      if (marker) map.removeLayer(marker);
      marker = L.marker([lat, lng], {icon: customIcon}).addTo(map);
      floatingHint.classList.add('hidden');
      
      if (skipGeocode) return;
      
      updateInfoBar('Finding address...', lat, lng);
      sendLocationToApp(lat, lng, 'Finding address...');
      
      GeocodingModule.reverseGeocode(lat, lng, function(result) {
        updateInfoBar(result.address, lat, lng);
        sendLocationToApp(lat, lng, result.address);
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
              updateInfoBar(item.display_name, item.lat, item.lon);
              sendLocationToApp(item.lat, item.lon, item.display_name);
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

// Form steps
const STEPS = [
  { id: 1, title: 'Basic Info', icon: 'document-text' },
  { id: 2, title: 'Location', icon: 'location' },
  { id: 3, title: 'Details', icon: 'list' },
  { id: 4, title: 'Photos', icon: 'camera' },
];

const UserReportRescueScreen = ({ onGoBack }) => {
  const { user } = useAuth();
  const webViewRef = useRef(null);
  
  // Current step in the form
  const [currentStep, setCurrentStep] = useState(1);
  
  // User profile data from database
  const [userProfile, setUserProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  
  // Form data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    animalType: '',
    urgency: 'normal',
    location: '',
    latitude: null,
    longitude: null,
    condition: '',
    estimatedCount: '1',
  });
  
  // UI states
  const [selectedImages, setSelectedImages] = useState([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  // Fetch user profile from database on mount
  useEffect(() => {
    fetchUserProfile();
    requestPermissions();
  }, []);

  const fetchUserProfile = async () => {
    try {
      setLoadingProfile(true);
      const response = await userService.getProfile();
      
      if (response.success && response.data) {
        setUserProfile(response.data);
      } else if (response.data) {
        setUserProfile(response.data);
      }
    } catch (error) {
      // Silently ignore 403 errors (user suspended)
      if (error?.status !== 403) {
        console.error('Error fetching user profile:', error);
      }
      // Use fallback from auth context
      if (user) {
        setUserProfile({
          id: user.id,
          full_name: user.full_name || user.name || 'User',
          email: user.email,
          phone: user.phone || '',
        });
      }
    } finally {
      setLoadingProfile(false);
    }
  };

  const requestPermissions = async () => {
    await ImagePicker.requestCameraPermissionsAsync();
    await ImagePicker.requestMediaLibraryPermissionsAsync();
    await Location.requestForegroundPermissionsAsync();
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Navigation between steps
  const goToNextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    }
  };

  const goToPrevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1:
        if (!formData.title.trim()) {
          Alert.alert('Required', 'Please enter a title for your report');
          return false;
        }
        if (!formData.animalType) {
          Alert.alert('Required', 'Please select an animal type');
          return false;
        }
        return true;
      case 2:
        if (!formData.location.trim()) {
          Alert.alert('Required', 'Please provide a location');
          return false;
        }
        return true;
      case 3:
        if (!formData.description.trim()) {
          Alert.alert('Required', 'Please provide a description');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  // Location functions
  const getCurrentLocation = async () => {
    try {
      setIsLoadingLocation(true);
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
          location: data.address,
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
      Alert.alert('Select Location', 'Please tap on the map to select a location');
      return;
    }
    setShowLocationPicker(false);
  };

  // Image functions
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
      return true;
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
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const sizeOk = await validateImageSize(asset.uri);
        if (!sizeOk) {
          Alert.alert('Image Too Large', 'Each image must be under 5 MB.');
          return;
        }
        setSelectedImages(prev => [...prev, asset]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const pickImageFromGallery = async () => {
    setShowImagePickerModal(false);
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES - selectedImages.length,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const validAssets = [];
        for (const asset of result.assets) {
          const sizeOk = await validateImageSize(asset.uri);
          if (sizeOk) validAssets.push(asset);
        }
        if (validAssets.length < result.assets.length) {
          Alert.alert('Some Images Skipped', 'Images over 5 MB were excluded.');
        }
        setSelectedImages(prev => [...prev, ...validAssets].slice(0, MAX_IMAGES));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select images');
    }
  };

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddPhoto = () => {
    if (selectedImages.length >= 5) {
      Alert.alert('Limit Reached', 'You can only add up to 5 photos');
      return;
    }
    setShowImagePickerModal(true);
  };

  const addImageFromUrl = () => {
    const trimmedUrl = imageUrlInput.trim();

    if (!trimmedUrl) {
      Alert.alert('Validation Error', 'Please enter an image URL.');
      return;
    }

    if (!/^https?:\/\//i.test(trimmedUrl)) {
      Alert.alert('Invalid URL', 'Image URL must start with http:// or https://');
      return;
    }

    if (selectedImages.length >= MAX_IMAGES) {
      Alert.alert('Limit Reached', `You can only add up to ${MAX_IMAGES} photos.`);
      return;
    }

    setSelectedImages(prev => [...prev, { uri: trimmedUrl, source: 'url' }]);
    setImageUrlInput('');
    setShowImagePickerModal(false);
  };

  const convertImageToBase64 = async (imageUri) => {
    try {
      if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
        return imageUri;
      }

      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const extension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      // Silently ignore 403 errors (user suspended)
      if (error?.status !== 403) {
        console.error('Error converting image:', error);
      }
      return null;
    }
  };

  // Submit report to database
  const handleSubmitReport = async () => {
    if (!validateCurrentStep()) return;

    // Check if user is authenticated
    if (!user || !user.id) {
      Alert.alert(
        'Authentication Required',
        'You must be logged in to submit a rescue report. Please log in and try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setSubmitting(true);

      // Convert images to base64 for database storage
      const imagePromises = selectedImages.map(img => convertImageToBase64(img.uri));
      const base64Images = await Promise.all(imagePromises);
      const validImages = base64Images.filter(img => img !== null);

      // Prepare report data for database with explicit user ID
      const reportData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        animalType: formData.animalType,
        urgency: formData.urgency,
        location: formData.location.trim(),
        latitude: formData.latitude,
        longitude: formData.longitude,
        condition: formData.condition || 'unknown',
        estimatedCount: parseInt(formData.estimatedCount) || 1,
        images: validImages,
        // Use profile data from database - ensure we use authenticated user info
        userId: user.id, // Explicitly send user ID
        reporterName: userProfile?.full_name || user?.full_name || user?.name || 'User',
        reporterPhone: userProfile?.phone || user?.phone || '',
        reporterEmail: userProfile?.email || user?.email || '',
      };

      const response = await rescueService.createRescueReport(reportData);

      if (response.success || response.data || response.report) {
        Alert.alert(
          '✅ Report Submitted',
          `Thank you, ${userProfile?.full_name || user?.name || 'friend'}! Your rescue report has been submitted successfully. Our rescuers will respond as soon as possible.`,
          [{ text: 'Done', onPress: onGoBack }]
        );
      } else {
        throw new Error(response.error || 'Failed to submit report');
      }
    } catch (error) {
      // Silently ignore 403 errors (user suspended)
      if (error?.status !== 403) {
        console.error('❌ Submit error:', error);
        Alert.alert(
          'Submission Failed',
          'Failed to submit your report. Please check your connection and try again.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Render step indicator
  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((step, index) => (
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
          {index < STEPS.length - 1 && (
            <View style={[styles.stepLine, currentStep > step.id && styles.stepLineActive]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  // Step 1: Basic Info
  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>What did you find?</Text>
      <Text style={styles.stepSubtitle}>Tell us about the animal that needs help</Text>

      {/* Title Input */}
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

      {/* Animal Type Selection */}
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

      {/* Urgency Level */}
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
    </View>
  );

  // Step 2: Location
  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Where is the animal?</Text>
      <Text style={styles.stepSubtitle}>Provide accurate location for quick response</Text>

      {/* Location Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Location Address *</Text>
        <TextInput
          style={[styles.input, styles.locationInput]}
          placeholder="Enter the address or landmark"
          placeholderTextColor={COLORS.textMedium}
          value={formData.location}
          onChangeText={(text) => updateFormData('location', text)}
          multiline
        />
      </View>

      {/* Map Pin Status */}
      {formData.latitude && formData.longitude && (
        <View style={styles.locationPinned}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
          <Text style={styles.locationPinnedText}>Location pinned on map</Text>
        </View>
      )}

      {/* Pick on Map Button */}
      <TouchableOpacity
        style={styles.mapButton}
        onPress={() => setShowLocationPicker(true)}
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
    </View>
  );

  // Step 3: Details
  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>More Details</Text>
      <Text style={styles.stepSubtitle}>Help rescuers understand the situation</Text>

      {/* Description */}
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

      {/* Condition */}
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

      {/* Estimated Count */}
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
    </View>
  );

  // Step 4: Photos
  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Add Photos</Text>
      <Text style={styles.stepSubtitle}>Photos help rescuers identify and locate the animal</Text>

      {/* Photo Upload */}
      <TouchableOpacity style={styles.photoUploadCard} onPress={handleAddPhoto}>
        <View style={styles.photoUploadIcon}>
          <Ionicons name="camera" size={40} color={COLORS.primary} />
        </View>
        <Text style={styles.photoUploadTitle}>
          {selectedImages.length > 0 ? `Add More Photos (${selectedImages.length}/5)` : 'Add Photos'}
        </Text>
        <Text style={styles.photoUploadSubtitle}>Take a photo or choose from gallery</Text>
      </TouchableOpacity>

      {/* Image Preview Grid */}
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

      {/* Reporter Info Preview */}
      <View style={styles.reporterPreview}>
        <Text style={styles.reporterPreviewTitle}>Reporting as:</Text>
        <View style={styles.reporterPreviewCard}>
          <View style={styles.reporterAvatar}>
            <Ionicons name="person" size={24} color={COLORS.primary} />
          </View>
          <View style={styles.reporterInfo}>
            <Text style={styles.reporterName}>
              {userProfile?.full_name || user?.full_name || user?.name || 'User'}
            </Text>
            <Text style={styles.reporterEmail}>
              {userProfile?.email || user?.email || 'No email'}
            </Text>
            {user?.id && (
              <Text style={styles.reporterRole}>Registered User</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );

  // Render current step content
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      default:
        return null;
    }
  };

  // Loading state
  if (loadingProfile) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Report a Rescue</Text>
          <Text style={styles.headerSubtitle}>Step {currentStep} of 4</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Step Indicator */}
      {renderStepIndicator()}

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {renderCurrentStep()}
        </ScrollView>

        {/* Navigation Buttons */}
        <View style={styles.navigationButtons}>
          {currentStep > 1 && (
            <TouchableOpacity style={styles.prevButton} onPress={goToPrevStep} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={20} color={COLORS.textDark} />
              <Text style={styles.prevButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          
          {currentStep < 4 ? (
            <TouchableOpacity
              style={[styles.nextButton, currentStep === 1 && styles.nextButtonFull]}
              onPress={goToNextStep}
              activeOpacity={0.7}
            >
              <Text style={styles.nextButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color={COLORS.textWhite} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmitReport}
              disabled={submitting}
              activeOpacity={0.7}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={COLORS.textWhite} />
              ) : (
                <>
                  <Ionicons name="send" size={20} color={COLORS.textWhite} />
                  <Text style={styles.submitButtonText}>Submit Report</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

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
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Photo</Text>

            <TouchableOpacity style={styles.modalOption} onPress={pickImageFromCamera}>
              <View style={[styles.modalOptionIcon, { backgroundColor: COLORS.primary + '15' }]}>
                <Ionicons name="camera" size={28} color={COLORS.primary} />
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>Take Photo</Text>
                <Text style={styles.modalOptionDesc}>Use your camera</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={COLORS.textMedium} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalOption} onPress={pickImageFromGallery}>
              <View style={[styles.modalOptionIcon, { backgroundColor: '#10B981' + '15' }]}>
                <Ionicons name="images" size={28} color="#10B981" />
              </View>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.modalOptionDesc}>Select from your photos</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={COLORS.textMedium} />
            </TouchableOpacity>

            <View style={styles.modalUrlRow}>
              <TextInput
                style={styles.modalUrlInput}
                placeholder="Paste image URL (https://...)"
                placeholderTextColor={COLORS.textMedium}
                value={imageUrlInput}
                onChangeText={setImageUrlInput}
                autoCapitalize="none"
                keyboardType="url"
              />
              <TouchableOpacity style={styles.modalUrlAddBtn} onPress={addImageFromUrl}>
                <Ionicons name="link" size={20} color={COLORS.textWhite} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowImagePickerModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
              <Text style={styles.locationPickerTitle}>Pin Location</Text>
              <Text style={styles.locationPickerSubtitle}>Tap on map to select</Text>
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
              source={{ html: MAP_HTML }}
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
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
  },
  keyboardView: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.backgroundWhite,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  headerSubtitle: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
    marginTop: 2,
  },

  // Step Indicator
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    backgroundColor: COLORS.backgroundWhite,
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

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 100,
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

  // Input Group
  inputGroup: {
    marginBottom: SPACING.xl,
  },
  inputLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
  },
  locationInput: {
    minHeight: 60,
  },
  textArea: {
    minHeight: 120,
    paddingTop: SPACING.md,
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

  // Urgency List
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

  // Location Pinned
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

  // Map Button
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

  // Photo Upload
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

  // Image Grid
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

  // Reporter Preview
  reporterPreview: {
    marginTop: SPACING.md,
  },
  reporterPreviewTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textMedium,
    marginBottom: SPACING.sm,
  },
  reporterPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  reporterAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reporterInfo: {
    marginLeft: SPACING.md,
  },
  reporterName: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
  },
  reporterEmail: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: 2,
  },
  reporterRole: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.success,
    fontWeight: FONTS.weights.semiBold,
    marginTop: 4,
  },

  // Navigation Buttons
  navigationButtons: {
    flexDirection: 'row',
    padding: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? SPACING.xxl : SPACING.lg,
    backgroundColor: COLORS.backgroundWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    gap: SPACING.md,
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
  submitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.success,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
    marginLeft: SPACING.xs,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.backgroundWhite,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    padding: SPACING.xl,
    paddingBottom: Platform.OS === 'ios' ? SPACING.xxxl : SPACING.xl,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.borderLight,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.lg,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  modalOptionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOptionText: {
    flex: 1,
    marginLeft: SPACING.md,
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
  modalUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  modalUrlInput: {
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
  modalUrlAddBtn: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  modalCancelButton: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.background,
  },
  modalCancelText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textMedium,
  },

  // Location Picker
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

export default memo(UserReportRescueScreen);
