import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { memo, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { auth, db } from '../../firebaseConfig';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_STEPS = 4;
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const STEP_META = {
  1: { title: 'Personal Information', subtitle: 'Tell us who you are and how we can contact you.' },
  2: { title: 'Location', subtitle: 'Pin your exact location for nearby rescue assignment.' },
  3: { title: 'Rescuer Profile', subtitle: 'Share your experience, motivation, and availability.' },
  4: { title: 'Review & Submit', subtitle: 'Confirm all details and agree to the rescuer terms.' },
};

// Google Maps HTML for location picker
const getGoogleMapHtml = (apiKey) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #map { width: 100%; height: 100%; }
    .error-banner {
      display: none;
      position: absolute;
      top: 64px;
      left: 12px;
      right: 12px;
      z-index: 1002;
      background: #FFE4E6;
      color: #9F1239;
      border: 1px solid #FB7185;
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 12px;
      font-weight: 600;
    }
    
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

    .gm-style-cc {
      display: none;
    }
  </style>
</head>
<body>
  <div class="error-banner" id="errorBanner"></div>
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
    var map;
    var marker;
    var geocoder;
    var pendingCurrentLocation = null;
    var defaultCenter = { lat: 14.5995, lng: 120.9842 };
    
    var searchInput = document.getElementById('searchInput');
    var searchBtn = document.getElementById('searchBtn');
    var searchResults = document.getElementById('searchResults');
    var searchLoading = document.getElementById('searchLoading');
    var floatingHint = document.getElementById('floatingHint');
    var addressDisplay = document.getElementById('addressDisplay');
    var coordsDisplay = document.getElementById('coordsDisplay');
    var errorBanner = document.getElementById('errorBanner');

    function showError(message) {
      errorBanner.textContent = message;
      errorBanner.style.display = 'block';
    }
    
    function hideSearchResults() {
      searchResults.style.display = 'none';
      searchLoading.style.display = 'none';
    }
    
    function updateInfoBar(address, lat, lng, city) {
      addressDisplay.textContent = address || 'Tap on the map to select';
      if (typeof lat === 'number' && typeof lng === 'number') {
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

    function parseCityFromComponents(components) {
      if (!components || !components.length) return '';
      var priority = ['locality', 'administrative_area_level_2', 'administrative_area_level_1'];
      for (var i = 0; i < priority.length; i++) {
        var type = priority[i];
        for (var j = 0; j < components.length; j++) {
          if (components[j].types && components[j].types.indexOf(type) !== -1) {
            return components[j].long_name || '';
          }
        }
      }
      return '';
    }

    function reverseGeocode(lat, lng, callback) {
      if (!geocoder) {
        callback({
          address: 'Location at ' + lat.toFixed(6) + ', ' + lng.toFixed(6),
          city: '',
        });
        return;
      }

      geocoder.geocode({ location: { lat: lat, lng: lng } }, function(results, status) {
        if (status === 'OK' && results && results[0]) {
          callback({
            address: results[0].formatted_address,
            city: parseCityFromComponents(results[0].address_components),
          });
          return;
        }

        callback({
          address: 'Location at ' + lat.toFixed(6) + ', ' + lng.toFixed(6),
          city: '',
        });
      });
    }

    function placeMarker(lat, lng, shouldReverseGeocode) {
      if (!map) return;

      if (!marker) {
        marker = new google.maps.Marker({
          map: map,
          position: { lat: lat, lng: lng },
          draggable: false,
          animation: google.maps.Animation.DROP,
        });
      } else {
        marker.setPosition({ lat: lat, lng: lng });
      }

      map.panTo({ lat: lat, lng: lng });
      if ((map.getZoom() || 0) >= 18) {
        map.setTilt(45);
      }
      floatingHint.classList.add('hidden');

      if (!shouldReverseGeocode) {
        return;
      }

      updateInfoBar('Finding address...', lat, lng, '');
      sendLocationToApp(lat, lng, 'Finding address...', '');

      reverseGeocode(lat, lng, function(result) {
        updateInfoBar(result.address, lat, lng, result.city);
        sendLocationToApp(lat, lng, result.address, result.city);
      });
    }
    
    function searchLocation() {
      var query = searchInput.value.trim();
      if (!query) return;

      if (!geocoder) {
        showError('Map is not ready yet. Please try again in a moment.');
        return;
      }

      searchResults.style.display = 'none';
      searchLoading.style.display = 'block';

      var searchQuery = query.toLowerCase().indexOf('philippines') > -1 ? query : query + ', Philippines';
      geocoder.geocode({ address: searchQuery }, function(results, status) {
        searchLoading.style.display = 'none';

        if (status !== 'OK' || !results || !results.length) {
          searchResults.innerHTML = '<div class="search-result-item">No results found</div>';
          searchResults.style.display = 'block';
          return;
        }

        searchResults.innerHTML = '';
        results.slice(0, 5).forEach(function(item) {
          var lat = item.geometry.location.lat();
          var lng = item.geometry.location.lng();
          var city = parseCityFromComponents(item.address_components);
          var div = document.createElement('div');
          div.className = 'search-result-item';
          div.textContent = item.formatted_address;
          div.onclick = function() {
            map.setCenter({ lat: lat, lng: lng });
            map.setZoom(18);
            map.setHeading(20);
            map.setTilt(45);
            placeMarker(lat, lng, false);
            updateInfoBar(item.formatted_address, lat, lng, city);
            sendLocationToApp(lat, lng, item.formatted_address, city);
            hideSearchResults();
            searchInput.value = '';
          };
          searchResults.appendChild(div);
        });

        searchResults.style.display = 'block';
      });
    }
    
    searchBtn.addEventListener('click', searchLocation);
    searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') searchLocation();
    });

    function initMap() {
      if (!window.google || !window.google.maps) {
        showError('Google Maps failed to load. Please check your API key and network.');
        return;
      }

      geocoder = new google.maps.Geocoder();
      map = new google.maps.Map(document.getElementById('map'), {
        center: defaultCenter,
        zoom: 18,
        disableDefaultUI: false,
        mapTypeId: 'hybrid',
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: false,
        rotateControl: true,
        gestureHandling: 'greedy',
      });

      map.setHeading(20);
      map.setTilt(45);

      map.addListener('zoom_changed', function() {
        if ((map.getZoom() || 0) >= 18) {
          map.setTilt(45);
        } else {
          map.setTilt(0);
        }
      });

      map.addListener('click', function(event) {
        hideSearchResults();
        placeMarker(event.latLng.lat(), event.latLng.lng(), true);
      });

      if (pendingCurrentLocation) {
        setCurrentLocation(pendingCurrentLocation.lat, pendingCurrentLocation.lng);
        pendingCurrentLocation = null;
      }
    }

    function setCurrentLocation(lat, lng) {
      if (!map) {
        pendingCurrentLocation = { lat: lat, lng: lng };
        return;
      }
      map.setCenter({ lat: lat, lng: lng });
      map.setZoom(18);
      map.setHeading(20);
      map.setTilt(45);
      placeMarker(lat, lng, true);
    }

    window.setCurrentLocation = setCurrentLocation;
    window.initMap = initMap;

    if (!'${apiKey}'.trim()) {
      showError('Google Maps API key is missing. Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in your environment.');
    }

    window.addEventListener('load', function() {
      initMap();
    });
  </script>
</body>
</html>
`;

const UserRescuerRegistrationScreen = ({ onGoBack }) => {
  const { user } = useAuth();
  const webViewRef = useRef(null);
  const pendingCoordsRef = useRef(null);

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
  const [step, setStep] = useState(1);
  const [validationErrors, setValidationErrors] = useState({});
  const [validationWarning, setValidationWarning] = useState('');

  const availabilityOptions = [
    { id: 'weekday_morning', label: 'Weekday Mornings' },
    { id: 'weekday_afternoon', label: 'Weekday Afternoons' },
    { id: 'weekday_evening', label: 'Weekday Evenings' },
    { id: 'weekend_morning', label: 'Weekend Mornings' },
    { id: 'weekend_afternoon', label: 'Weekend Afternoons' },
    { id: 'weekend_evening', label: 'Weekend Evenings' },
    { id: 'emergency', label: '24/7 Emergency' },
  ];

  const transportationOptions = [
    { id: 'car', label: 'Car', icon: 'car' },
    { id: 'motorcycle', label: 'Motorcycle', icon: 'bicycle' },
    { id: 'bicycle', label: 'Bicycle', icon: 'bicycle-outline' },
    { id: 'public_transport', label: 'Public Transport', icon: 'bus' },
    { id: 'on_foot', label: 'On Foot', icon: 'walk' },
    { id: 'none', label: 'No Transport', icon: 'close-circle-outline' },
  ];

  const currentUserId = user?.uid || user?.id || auth.currentUser?.uid || null;

  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        fullName: prev.fullName || user.full_name || user.name || '',
        phone: prev.phone || user.phone || user.phone_number || '',
        email: prev.email || user.email || '',
      }));
    }
  }, [user]);

  useEffect(() => {
    const fetchUserProfileFromFirestore = async () => {
      if (!currentUserId) {
        return;
      }

      try {
        const userRef = doc(db, 'users', currentUserId);
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
          return;
        }

        const profile = userDoc.data();
        setFormData((prev) => ({
          ...prev,
          fullName: profile.full_name || profile.name || prev.fullName || '',
          phone: profile.phone || profile.phone_number || prev.phone || '',
          email: profile.email || prev.email || '',
        }));
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfileFromFirestore();
  }, [currentUserId]);

  useEffect(() => {
    checkExistingApplication();
  }, [currentUserId]);

  const checkExistingApplication = async () => {
    if (!currentUserId) {
      setCheckingStatus(false);
      setExistingApplication(null);
      return;
    }

    try {
      setCheckingStatus(true);
      const applicationsRef = collection(db, 'rescuer_applications');
      const q = query(applicationsRef, where('user_id', '==', currentUserId));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setExistingApplication(null);
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

      setExistingApplication(applications[0]);
    } catch (error) {
      console.error('Error checking application status:', error);
      setExistingApplication(null);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setValidationErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setValidationWarning('');
  };

  const toggleAvailability = (id) => {
    setFormData((prev) => ({
      ...prev,
      availability: prev.availability.includes(id)
        ? prev.availability.filter((a) => a !== id)
        : [...prev.availability, id],
    }));
    setValidationErrors((prev) => {
      if (!prev.availability) return prev;
      const next = { ...prev };
      delete next.availability;
      return next;
    });
    setValidationWarning('');
  };

  // Location picker functions
  const pushLocationToMap = (latitude, longitude) => {
    if (!webViewRef.current) {
      pendingCoordsRef.current = { latitude, longitude };
      return;
    }

    webViewRef.current.injectJavaScript(
      `window.setCurrentLocation(${latitude}, ${longitude}); true;`
    );
  };

  const getCurrentLocation = async () => {
    try {
      setIsLoadingLocation(true);
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert('Location Disabled', 'Please enable your device location service and try again.');
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location services to use this feature.');
        return;
      }

      let location = await Location.getCurrentPositionAsync({
        accuracy: Platform.OS === 'android' ? Location.Accuracy.Balanced : Location.Accuracy.High,
      });

      if (!location?.coords) {
        location = await Location.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 100 });
      }

      if (!location?.coords) {
        throw new Error('Unable to retrieve location coordinates');
      }
      
      const { latitude, longitude } = location.coords;

      pushLocationToMap(latitude, longitude);
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
      setValidationErrors((prev) => ({
        ...prev,
        locationPin: 'Please pin your exact location on the map.',
      }));
      setValidationWarning('Please complete the required fields before continuing.');
      return;
    }
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next.locationPin;
      delete next.address;
      return next;
    });
    setValidationWarning('');
    setShowLocationPicker(false);
  };

  const validateStep = (stepToValidate) => {
    const stepFieldMap = {
      1: ['fullName', 'phone', 'email'],
      2: ['address', 'locationPin'],
      3: ['experience', 'motivation', 'availability', 'transportationType'],
      4: ['agreedToTerms'],
    };
    const stepErrors = {};

    if (stepToValidate === 1) {
      if (!formData.fullName.trim()) {
        stepErrors.fullName = 'Full name is required.';
      }

      const cleanedPhone = formData.phone?.replace(/[\s\-\(\)]/g, '') || '';
      if (!cleanedPhone) {
        stepErrors.phone = 'Phone number is required.';
      } else {
        const phoneRegex = /^(09|\+639)\d{9}$/;
        if (!phoneRegex.test(cleanedPhone)) {
          stepErrors.phone = 'Use 09171234567 or +639171234567 format.';
        }
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!formData.email?.trim() || !emailRegex.test(formData.email.trim())) {
        stepErrors.email = 'A valid email is required.';
      }
    }

    if (stepToValidate === 2) {
      if (!formData.address.trim() || !formData.latitude || !formData.longitude) {
        stepErrors.address = 'Please select your address using the map pin.';
        stepErrors.locationPin = 'Pin your exact location before continuing.';
      }
    }

    if (stepToValidate === 3) {
      if (!formData.experience.trim()) {
        stepErrors.experience = 'Please describe your rescue or animal-care experience.';
      }
      if (!formData.motivation.trim()) {
        stepErrors.motivation = 'Please tell us why you want to become a rescuer.';
      }
      if (formData.availability.length === 0) {
        stepErrors.availability = 'Select at least one availability option.';
      }
      if (!formData.transportationType) {
        stepErrors.transportationType = 'Select your transportation type.';
      }
    }

    if (stepToValidate === 4 && !formData.agreedToTerms) {
      stepErrors.agreedToTerms = 'You must agree to the terms and conditions.';
    }

    setValidationErrors((prev) => {
      const next = { ...prev };
      (stepFieldMap[stepToValidate] || []).forEach((field) => {
        delete next[field];
      });
      return { ...next, ...stepErrors };
    });

    if (Object.keys(stepErrors).length > 0) {
      setValidationWarning('Please complete the required fields before continuing.');
      Alert.alert('Incomplete Form', 'Please complete all required fields correctly.');
      return false;
    }

    setValidationWarning('');
    return true;
  };

  const handleNextStep = () => {
    if (!validateStep(step)) {
      return;
    }

    setStep((previous) => Math.min(previous + 1, TOTAL_STEPS));
  };

  const handlePreviousStep = () => {
    setStep((previous) => Math.max(previous - 1, 1));
  };

  const handleSubmit = async () => {
    const userId = auth.currentUser?.uid || currentUserId;

    if (!userId) {
      Alert.alert('Error', 'Please log in again and try submitting your application.');
      return;
    }

    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) {
      return;
    }

    await submitApplication(userId);
  };

  const submitApplication = async (userId) => {
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
        availability: formData.availability,
        transportation_type: formData.transportationType,
        status: 'pending',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      };

      await addDoc(collection(db, 'rescuer_applications'), applicationData);

      await checkExistingApplication();

      Alert.alert(
        'Application Submitted!',
        'Thank you for applying to become a rescuer. We will review your application and contact you soon.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error submitting application:', error);
      Alert.alert('Error', error?.message || 'Failed to submit application. Please try again.');
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
  const normalizedStatus = String(existingApplication?.status || '').toLowerCase();

  if (existingApplication && normalizedStatus !== 'rejected' && normalizedStatus !== 'revoked') {
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
                    ? (existingApplication.created_at?.toDate ? existingApplication.created_at.toDate() : new Date(existingApplication.created_at)).toLocaleDateString('en-US', {
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
  const showRejectionNotice = existingApplication && (normalizedStatus === 'rejected' || normalizedStatus === 'revoked');
  const statusInfo = existingApplication ? getStatusInfo(existingApplication.status) : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
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

          <View style={styles.stepIndicatorContainer}>
            {[1, 2, 3, 4].map((currentStep, index) => (
              <View key={currentStep} style={styles.stepItem}>
                <View style={[styles.stepCircle, step >= currentStep && styles.stepCircleActive]}>
                  <Text style={[styles.stepCircleText, step >= currentStep && styles.stepCircleTextActive]}>{currentStep}</Text>
                </View>
                {index < TOTAL_STEPS - 1 && <View style={[styles.stepLine, step > currentStep && styles.stepLineActive]} />}
              </View>
            ))}
          </View>

          <View style={styles.stepMetaCard}>
            <Text style={styles.stepMetaTitle}>{STEP_META[step]?.title || 'Application Step'}</Text>
            <Text style={styles.stepMetaSubtitle}>{STEP_META[step]?.subtitle || ''}</Text>
            <Text style={styles.stepMetaCount}>Step {step} of {TOTAL_STEPS}</Text>
          </View>

          {validationWarning ? (
            <View style={styles.warningBanner}>
              <Ionicons name="warning" size={18} color="#B45309" />
              <Text style={styles.warningBannerText}>{validationWarning}</Text>
            </View>
          ) : null}

          {step === 1 && (
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Personal Information</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name *</Text>
                <TextInput
                  style={[styles.input, validationErrors.fullName && styles.inputError]}
                  value={formData.fullName}
                  onChangeText={(value) => handleInputChange('fullName', value)}
                  placeholder="Enter your full name"
                  placeholderTextColor={COLORS.textMedium}
                />
                {validationErrors.fullName ? <Text style={styles.fieldErrorText}>{validationErrors.fullName}</Text> : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number *</Text>
                <TextInput
                  style={[styles.input, validationErrors.phone && styles.inputError]}
                  value={formData.phone}
                  onChangeText={(value) => handleInputChange('phone', value)}
                  placeholder="Enter your phone number"
                  placeholderTextColor={COLORS.textMedium}
                  keyboardType="phone-pad"
                />
                {validationErrors.phone ? <Text style={styles.fieldErrorText}>{validationErrors.phone}</Text> : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email *</Text>
                <TextInput style={[styles.input, styles.inputDisabled, validationErrors.email && styles.inputError]} value={formData.email} editable={false} />
                {validationErrors.email ? <Text style={styles.fieldErrorText}>{validationErrors.email}</Text> : null}
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Your Location</Text>
              <Text style={styles.sectionSubtitle}>Pin your exact location so nearby rescue alerts can be assigned to you</Text>

              <View style={styles.inputGroup}>
                <TouchableOpacity style={[styles.locationPickerButton, (validationErrors.address || validationErrors.locationPin) && styles.inputError]} onPress={() => setShowLocationPicker(true)}>
                  <View style={styles.locationPickerContent}>
                    <View style={styles.locationIconContainer}>
                      <Ionicons
                        name={formData.latitude ? 'location' : 'location-outline'}
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
                          {formData.city ? <Text style={styles.locationCityText}>{formData.city}</Text> : null}
                        </>
                      ) : (
                        <Text style={styles.locationPlaceholder}>Tap to select your location on the map</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.textMedium} />
                  </View>
                </TouchableOpacity>
                {validationErrors.address ? <Text style={styles.fieldErrorText}>{validationErrors.address}</Text> : null}
                {validationErrors.locationPin ? <Text style={styles.fieldErrorText}>{validationErrors.locationPin}</Text> : null}
              </View>
            </View>
          )}

          {step === 3 && (
            <>
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Experience & Motivation</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Previous Experience *</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, validationErrors.experience && styles.inputError]}
                    value={formData.experience}
                    onChangeText={(value) => handleInputChange('experience', value)}
                    placeholder="Describe any previous experience with animal rescue..."
                    placeholderTextColor={COLORS.textMedium}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                  {validationErrors.experience ? <Text style={styles.fieldErrorText}>{validationErrors.experience}</Text> : null}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Why do you want to become a rescuer? *</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, validationErrors.motivation && styles.inputError]}
                    value={formData.motivation}
                    onChangeText={(value) => handleInputChange('motivation', value)}
                    placeholder="Tell us what motivates you to help animals..."
                    placeholderTextColor={COLORS.textMedium}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                  {validationErrors.motivation ? <Text style={styles.fieldErrorText}>{validationErrors.motivation}</Text> : null}
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
                {validationErrors.availability ? <Text style={styles.fieldErrorText}>{validationErrors.availability}</Text> : null}
              </View>

              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Transportation *</Text>
                <Text style={styles.sectionSubtitle}>Select your primary mode of transportation for rescues</Text>

                <View style={[styles.transportationGrid, validationErrors.transportationType && styles.choiceGroupError]}>
                  {transportationOptions.map((option) => (
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
                {validationErrors.transportationType ? <Text style={styles.fieldErrorText}>{validationErrors.transportationType}</Text> : null}
              </View>
            </>
          )}

          {step === 4 && (
            <>
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Review & Confirm</Text>
                <View style={styles.detailsCard}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Name</Text>
                    <Text style={styles.detailValue}>{formData.fullName || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Phone</Text>
                    <Text style={styles.detailValue}>{formData.phone || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>City</Text>
                    <Text style={styles.detailValue}>{formData.city || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Availability</Text>
                    <Text style={styles.detailValue}>{formData.availability.length} selected</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Transportation</Text>
                    <Text style={styles.detailValue}>{formData.transportationType || 'N/A'}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Terms & Conditions</Text>

                <TouchableOpacity
                  style={[styles.checkboxRow, validationErrors.agreedToTerms && styles.choiceGroupErrorBox]}
                  onPress={() => handleInputChange('agreedToTerms', !formData.agreedToTerms)}
                >
                  <View style={[styles.checkbox, formData.agreedToTerms && styles.checkboxActive]}>
                    {formData.agreedToTerms ? <Ionicons name="checkmark" size={16} color={COLORS.textWhite} /> : null}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    I agree to the terms and conditions and commit to responding to rescue alerts when available *
                  </Text>
                </TouchableOpacity>
                {validationErrors.agreedToTerms ? <Text style={styles.fieldErrorText}>{validationErrors.agreedToTerms}</Text> : null}
              </View>
            </>
          )}

          <View style={styles.bottomSpacing} />
        </ScrollView>

        <View style={styles.wizardActionsFooter}>
          <View style={styles.wizardActions}>
            {step > 1 ? (
              <TouchableOpacity style={styles.backStepButton} onPress={handlePreviousStep} activeOpacity={0.8}>
                <Ionicons name="arrow-back" size={18} color={COLORS.textDark} />
                <Text style={styles.backStepButtonText}>Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.backStepButtonPlaceholder} />
            )}

            {step < TOTAL_STEPS ? (
              <TouchableOpacity style={styles.nextStepButton} onPress={handleNextStep} activeOpacity={0.8}>
                <Text style={styles.nextStepButtonText}>Next</Text>
                <Ionicons name="arrow-forward" size={18} color={COLORS.textWhite} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.submitButton, styles.submitButtonInline, loading && styles.submitButtonDisabled]}
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
            )}
          </View>
        </View>
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
              source={{ html: getGoogleMapHtml(GOOGLE_MAPS_API_KEY) }}
              style={styles.mapWebView}
              onMessage={handleMapMessage}
              onLoadEnd={() => {
                if (pendingCoordsRef.current?.latitude && pendingCoordsRef.current?.longitude) {
                  const { latitude, longitude } = pendingCoordsRef.current;
                  webViewRef.current?.injectJavaScript(
                    `window.setCurrentLocation(${latitude}, ${longitude}); true;`
                  );
                  pendingCoordsRef.current = null;
                }
              }}
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
  scrollContent: {
    paddingBottom: 120,
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

  // Wizard
  stepIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  stepMetaCard: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: SPACING.md,
  },
  stepMetaTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  stepMetaSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: 2,
  },
  stepMetaCount: {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: FONTS.weights.semiBold,
  },
  warningBanner: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
    backgroundColor: '#FFEDD5',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  warningBannerText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: '#9A3412',
    fontWeight: FONTS.weights.semiBold,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.backgroundWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  stepCircleText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    fontWeight: FONTS.weights.bold,
  },
  stepCircleTextActive: {
    color: COLORS.textWhite,
  },
  stepLine: {
    width: Math.max(24, SCREEN_WIDTH * 0.14),
    height: 2,
    backgroundColor: COLORS.borderLight,
    marginHorizontal: SPACING.xs,
  },
  stepLineActive: {
    backgroundColor: COLORS.primary,
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
  inputError: {
    borderColor: COLORS.error,
    borderWidth: 1.5,
  },
  fieldErrorText: {
    marginTop: SPACING.xs,
    fontSize: FONTS.sizes.xs,
    color: COLORS.error,
    fontWeight: FONTS.weights.medium,
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
  choiceGroupError: {
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: RADIUS.md,
    padding: SPACING.xs,
    marginHorizontal: 0,
  },
  choiceGroupErrorBox: {
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
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
  submitButtonInline: {
    marginHorizontal: 0,
    marginTop: 0,
    minWidth: 190,
  },
  submitButtonText: {
    color: COLORS.textWhite,
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    marginLeft: SPACING.sm,
  },

  wizardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  wizardActionsFooter: {
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingBottom: 86,
  },
  backStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.round,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    minWidth: 110,
  },
  backStepButtonText: {
    color: COLORS.textDark,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    marginLeft: SPACING.xs,
  },
  backStepButtonPlaceholder: {
    minWidth: 110,
  },
  nextStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.round,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    minWidth: 140,
  },
  nextStepButtonText: {
    color: COLORS.textWhite,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    marginRight: SPACING.xs,
  },

  bottomSpacing: {
    height: 20,
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
