import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
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
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { userService, shelterService } from '../../services';
import api from '../../services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Shelter type options (with colors matching admin)
const SHELTER_TYPES = [
  { id: 'private', label: 'Private', icon: 'home', color: '#EC4899', description: 'Privately owned shelter' },
  { id: 'ngo', label: 'NGO', icon: 'people', color: '#14B8A6', description: 'Non-profit organization' },
  { id: 'government', label: 'Government', icon: 'business', color: '#6366F1', description: 'Government-run facility' },
  { id: 'rescue_group', label: 'Rescue Group', icon: 'heart', color: '#F97316', description: 'Volunteer rescue group' },
];

// Animal type options
const ANIMAL_OPTIONS = [
  { id: 'dogs', label: 'Dogs', emoji: '🐕' },
  { id: 'cats', label: 'Cats', emoji: '🐈' },
  { id: 'birds', label: 'Birds', emoji: '🐦' },
  { id: 'rabbits', label: 'Rabbits', emoji: '🐰' },
  { id: 'others', label: 'Others', emoji: '🐾' },
];

// Services options
const SERVICE_OPTIONS = [
  { id: 'adoption', label: 'Adoption', icon: 'heart' },
  { id: 'rescue', label: 'Rescue', icon: 'medkit' },
  { id: 'foster_care', label: 'Foster Care', icon: 'home' },
  { id: 'veterinary_care', label: 'Vet Care', icon: 'medical' },
  { id: 'spay_neuter', label: 'Spay/Neuter', icon: 'cut' },
  { id: 'vaccination', label: 'Vaccination', icon: 'fitness' },
  { id: 'rehabilitation', label: 'Rehab', icon: 'pulse' },
];

// Days of the week
const DAYS_OF_WEEK = [
  { id: 'mon', label: 'Mon', fullLabel: 'Monday' },
  { id: 'tue', label: 'Tue', fullLabel: 'Tuesday' },
  { id: 'wed', label: 'Wed', fullLabel: 'Wednesday' },
  { id: 'thu', label: 'Thu', fullLabel: 'Thursday' },
  { id: 'fri', label: 'Fri', fullLabel: 'Friday' },
  { id: 'sat', label: 'Sat', fullLabel: 'Saturday' },
  { id: 'sun', label: 'Sun', fullLabel: 'Sunday' },
];

// Form steps
const FORM_STEPS = [
  { title: 'Basic Info', icon: 'information-circle' },
  { title: 'Location', icon: 'location' },
  { title: 'Details', icon: 'list' },
];

// Location map HTML (same as rescuer registration)
const LOCATION_MAP_HTML = `
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
    .marker-pin { width: 36px; height: 36px; border-radius: 50% 50% 50% 0; background: linear-gradient(135deg, #8B4513 0%, #A0522D 100%); position: absolute; transform: rotate(-45deg); left: 50%; top: 50%; margin: -18px 0 0 -18px; box-shadow: 0 3px 10px rgba(0,0,0,0.3); border: 3px solid white; }
    .marker-pin::after { content: ''; width: 16px; height: 16px; margin: 10px 0 0 10px; background: white; position: absolute; border-radius: 50%; }
    .marker-pulse { width: 14px; height: 14px; background: rgba(139,69,19,0.3); border-radius: 50%; position: absolute; left: 50%; bottom: -5px; margin-left: -7px; animation: pulse 2s infinite; }
    @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(3); opacity: 0; } }
    .search-container { position: absolute; top: 12px; left: 12px; right: 12px; z-index: 1000; }
    .search-box { display: flex; gap: 10px; background: white; padding: 8px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); }
    .search-input { flex: 1; padding: 12px 16px; border: 2px solid #E8E8E8; border-radius: 8px; font-size: 15px; outline: none; }
    .search-input:focus { border-color: #8B4513; }
    .search-btn { padding: 12px 20px; background: linear-gradient(135deg, #8B4513 0%, #A0522D 100%); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .search-results { display: none; background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); max-height: 250px; overflow-y: auto; margin-top: 8px; }
    .search-result-item { padding: 14px 16px; border-bottom: 1px solid #F0F0F0; cursor: pointer; font-size: 14px; color: #333; }
    .search-loading { display: none; background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); padding: 20px; margin-top: 8px; text-align: center; color: #666; }
    .info-bar { position: absolute; bottom: 0; left: 0; right: 0; background: white; padding: 16px 20px; box-shadow: 0 -4px 15px rgba(0,0,0,0.1); z-index: 1000; border-radius: 20px 20px 0 0; }
    .info-title { font-size: 12px; color: #888; font-weight: 500; text-transform: uppercase; }
    .info-address { font-size: 15px; color: #333; font-weight: 500; margin-top: 4px; }
    .info-coords { font-size: 12px; color: #888; margin-top: 6px; }
    .floating-hint { position: absolute; top: 90px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.75); color: white; padding: 10px 20px; border-radius: 25px; font-size: 13px; font-weight: 500; z-index: 999; pointer-events: none; white-space: nowrap; }
    .floating-hint.hidden { opacity: 0; }
  </style>
</head>
<body>
  <div class="search-container">
    <div class="search-box">
      <input type="text" id="searchInput" class="search-input" placeholder="Search for shelter location..." autocomplete="off" />
      <button class="search-btn" id="searchBtn">Search</button>
    </div>
    <div class="search-loading" id="searchLoading">Searching...</div>
    <div class="search-results" id="searchResults"></div>
  </div>
  <div id="map"></div>
  <div class="floating-hint" id="floatingHint">Tap on map to pin shelter location</div>
  <div class="info-bar" id="infoBar">
    <div class="info-title">Shelter Location</div>
    <div class="info-address" id="addressDisplay">Tap on the map to select</div>
    <div class="info-coords" id="coordsDisplay"></div>
  </div>
  <script>
    var NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
    var lastRequestTime = 0;
    function waitForRateLimit() {
      return new Promise(function(resolve) {
        var now = Date.now();
        var diff = now - lastRequestTime;
        if (diff < 1100) { setTimeout(function() { lastRequestTime = Date.now(); resolve(); }, 1100 - diff); }
        else { lastRequestTime = Date.now(); resolve(); }
      });
    }
    function extractCity(data) {
      if (!data || !data.address) return '';
      var a = data.address;
      return a.city || a.town || a.municipality || a.village || a.county || '';
    }
    function formatAddr(data) {
      if (!data) return null;
      var a = data.address; if (!a) return data.display_name;
      var p = [];
      if (a.road) p.push(a.road); if (a.suburb) p.push(a.suburb);
      if (a.city||a.town||a.municipality) p.push(a.city||a.town||a.municipality);
      if (a.state||a.province) p.push(a.state||a.province);
      return p.length > 0 ? p.join(', ') : data.display_name;
    }
    var map = L.map('map', {zoomControl:false}).setView([14.5995,120.9842],13);
    L.control.zoom({position:'bottomright'}).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
    var marker = null;
    var customIcon = L.divIcon({className:'marker-container',html:'<div class="marker-pin"></div><div class="marker-pulse"></div>',iconSize:[40,50],iconAnchor:[20,45]});
    var addressDisplay = document.getElementById('addressDisplay');
    var coordsDisplay = document.getElementById('coordsDisplay');
    var floatingHint = document.getElementById('floatingHint');
    function sendLoc(lat,lng,addr,city) { window.ReactNativeWebView.postMessage(JSON.stringify({type:'locationSelected',latitude:lat,longitude:lng,address:addr,city:city||''})); }
    function placeMarker(lat,lng,skip) {
      if(marker) map.removeLayer(marker);
      marker = L.marker([lat,lng],{icon:customIcon}).addTo(map);
      floatingHint.classList.add('hidden');
      if(skip) return;
      addressDisplay.textContent = 'Finding address...';
      sendLoc(lat,lng,'Finding address...','');
      waitForRateLimit().then(function(){
        fetch(NOMINATIM_URL+'/reverse?format=json&lat='+lat+'&lon='+lng+'&addressdetails=1&accept-language=en',{headers:{'User-Agent':'PawmilyaApp/1.0'}})
        .then(function(r){return r.json();})
        .then(function(d){
          var addr = formatAddr(d)||'Location at '+lat.toFixed(6)+', '+lng.toFixed(6);
          var city = extractCity(d);
          addressDisplay.textContent = addr;
          coordsDisplay.textContent = lat.toFixed(6)+', '+lng.toFixed(6);
          sendLoc(lat,lng,addr,city);
        }).catch(function(){
          var a = 'Location at '+lat.toFixed(6)+', '+lng.toFixed(6);
          addressDisplay.textContent = a; sendLoc(lat,lng,a,'');
        });
      });
    }
    map.on('click',function(e){ placeMarker(e.latlng.lat,e.latlng.lng,false); });
    var searchInput = document.getElementById('searchInput');
    var searchBtn = document.getElementById('searchBtn');
    var searchResults = document.getElementById('searchResults');
    var searchLoading = document.getElementById('searchLoading');
    function doSearch(){
      var q = searchInput.value.trim(); if(!q) return;
      searchResults.style.display='none'; searchLoading.style.display='block';
      var sq = q.indexOf('Philippines')>-1?q:q+', Philippines';
      waitForRateLimit().then(function(){
        fetch(NOMINATIM_URL+'/search?format=json&q='+encodeURIComponent(sq)+'&limit=5&addressdetails=1&accept-language=en',{headers:{'User-Agent':'PawmilyaApp/1.0'}})
        .then(function(r){return r.json();})
        .then(function(data){
          searchLoading.style.display='none';
          if(data.length>0){
            searchResults.innerHTML='';
            data.forEach(function(item){
              var div=document.createElement('div'); div.className='search-result-item';
              div.textContent=item.display_name;
              div.onclick=function(){
                map.setView([parseFloat(item.lat),parseFloat(item.lon)],17);
                placeMarker(parseFloat(item.lat),parseFloat(item.lon),true);
                var addr=formatAddr(item)||item.display_name;
                addressDisplay.textContent=addr;
                coordsDisplay.textContent=parseFloat(item.lat).toFixed(6)+', '+parseFloat(item.lon).toFixed(6);
                sendLoc(parseFloat(item.lat),parseFloat(item.lon),addr,extractCity(item));
                searchResults.style.display='none'; searchInput.value='';
              };
              searchResults.appendChild(div);
            });
            searchResults.style.display='block';
          } else {
            searchResults.innerHTML='<div class="search-result-item">No results found</div>';
            searchResults.style.display='block';
          }
        }).catch(function(){ searchLoading.style.display='none'; });
      });
    }
    searchBtn.addEventListener('click',doSearch);
    searchInput.addEventListener('keypress',function(e){ if(e.key==='Enter') doSearch(); });
    function setCurrentLocation(lat,lng){ map.setView([lat,lng],17); placeMarker(lat,lng,false); }
  </script>
</body>
</html>
`;

const UserShelterApplicationScreen = ({ onGoBack, onNavigateToManager }) => {
  const { user } = useAuth();
  const webViewRef = useRef(null);

  // Multi-step form
  const [currentStep, setCurrentStep] = useState(0);

  const [formData, setFormData] = useState({
    shelterName: '',
    shelterType: '',
    description: '',
    address: '',
    city: '',
    state: '',
    latitude: null,
    longitude: null,
    contactPersonName: '',
    phone: '',
    email: '',
    animalsAccepted: [],
    shelterCapacity: '',
    servicesOffered: [],
    operatingHours: '',
    agreedToTerms: false,
  });
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [existingApplication, setExistingApplication] = useState(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  // Operating Hours Picker States
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerType, setTimePickerType] = useState('open');
  const [selectedDays, setSelectedDays] = useState(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [openTime, setOpenTime] = useState({ hour: 9, minute: 0 });
  const [closeTime, setCloseTime] = useState({ hour: 17, minute: 0 });

  // Format time to display string
  const formatTime = (time) => {
    const hour = time.hour;
    const minute = time.minute;
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  // Generate operating hours string from selections
  const generateOperatingHoursString = () => {
    if (selectedDays.length === 0) return '';
    
    const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const sortedDays = [...selectedDays].sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
    
    let dayString = '';
    if (sortedDays.length === 7) {
      dayString = 'Daily';
    } else if (sortedDays.length === 5 && 
               sortedDays.includes('mon') && sortedDays.includes('tue') && 
               sortedDays.includes('wed') && sortedDays.includes('thu') && 
               sortedDays.includes('fri') &&
               !sortedDays.includes('sat') && !sortedDays.includes('sun')) {
      dayString = 'Mon-Fri';
    } else if (sortedDays.length === 2 && 
               sortedDays.includes('sat') && sortedDays.includes('sun')) {
      dayString = 'Sat-Sun';
    } else {
      let groups = [];
      let currentGroup = [sortedDays[0]];
      
      for (let i = 1; i < sortedDays.length; i++) {
        const prevIndex = dayOrder.indexOf(sortedDays[i - 1]);
        const currIndex = dayOrder.indexOf(sortedDays[i]);
        
        if (currIndex === prevIndex + 1) {
          currentGroup.push(sortedDays[i]);
        } else {
          groups.push(currentGroup);
          currentGroup = [sortedDays[i]];
        }
      }
      groups.push(currentGroup);
      
      dayString = groups.map(group => {
        if (group.length >= 3) {
          const first = DAYS_OF_WEEK.find(d => d.id === group[0])?.label;
          const last = DAYS_OF_WEEK.find(d => d.id === group[group.length - 1])?.label;
          return `${first}-${last}`;
        } else {
          return group.map(d => DAYS_OF_WEEK.find(day => day.id === d)?.label).join(', ');
        }
      }).join(', ');
    }
    
    return `${dayString} ${formatTime(openTime)} - ${formatTime(closeTime)}`;
  };

  // Update operating hours when selections change
  useEffect(() => {
    const hoursString = generateOperatingHoursString();
    setFormData(prev => ({ ...prev, operatingHours: hoursString }));
  }, [selectedDays, openTime, closeTime]);

  // Fetch user profile and populate contact info
  useEffect(() => {
    fetchUserProfile();
  }, []);

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        contactPersonName: prev.contactPersonName || user.full_name || '',
        phone: prev.phone || user.phone || '',
        email: prev.email || user.email || '',
      }));
    }
  }, [user]);

  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await userService.getProfile();
      if (response.success && response.data) {
        const profile = response.data;
        setFormData(prev => ({
          ...prev,
          contactPersonName: profile.full_name || prev.contactPersonName || '',
          phone: profile.phone || prev.phone || '',
          email: profile.email || prev.email || '',
        }));
      }
    } catch (error) {
      // Use auth context data as fallback
    }
  }, []);

  // Check existing application
  useEffect(() => {
    checkExistingApplication();
  }, [user?.id]);

  const checkExistingApplication = useCallback(async () => {
    if (!user?.id) {
      setCheckingStatus(false);
      return;
    }
    try {
      setCheckingStatus(true);
      const response = await shelterService.getMyShelterApplication();
      const data = response.data || response;
      if (data.hasApplication && data.application) {
        setExistingApplication(data.application);
      } else {
        setExistingApplication(null);
      }
    } catch (error) {
      if (error?.status !== 403 && error?.status !== 401) {
        console.error('Error checking shelter application:', error);
      }
      setExistingApplication(null);
    } finally {
      setCheckingStatus(false);
    }
  }, [user?.id]);

  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const toggleAnimal = useCallback((id) => {
    setFormData(prev => ({
      ...prev,
      animalsAccepted: prev.animalsAccepted.includes(id)
        ? prev.animalsAccepted.filter(a => a !== id)
        : [...prev.animalsAccepted, id],
    }));
  }, []);

  const toggleService = useCallback((id) => {
    setFormData(prev => ({
      ...prev,
      servicesOffered: prev.servicesOffered.includes(id)
        ? prev.servicesOffered.filter(s => s !== id)
        : [...prev.servicesOffered, id],
    }));
  }, []);

  // Location picker
  const getCurrentLocation = useCallback(async () => {
    try {
      setIsLoadingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location services.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(
          `setCurrentLocation(${location.coords.latitude}, ${location.coords.longitude}); true;`
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Could not get your current location.');
    } finally {
      setIsLoadingLocation(false);
    }
  }, []);

  const handleMapMessage = useCallback((event) => {
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
  }, []);

  const confirmLocationSelection = useCallback(() => {
    if (!formData.latitude || !formData.longitude) {
      Alert.alert('Select Location', 'Please tap on the map to select your shelter location');
      return;
    }
    setShowLocationPicker(false);
  }, [formData.latitude, formData.longitude]);

  // Step validation
  const validateStep = (step) => {
    switch (step) {
      case 0:
        if (!formData.shelterName.trim()) {
          Alert.alert('Error', 'Please enter the shelter name');
          return false;
        }
        if (!formData.shelterType) {
          Alert.alert('Error', 'Please select a shelter type');
          return false;
        }
        return true;
      case 1:
        if (!formData.address.trim() || !formData.latitude) {
          Alert.alert('Error', 'Please select the shelter location on the map');
          return false;
        }
        if (!formData.contactPersonName.trim()) {
          Alert.alert('Error', 'Please enter a contact person name');
          return false;
        }
        if (!formData.phone.trim()) {
          Alert.alert('Error', 'Please enter a contact phone number');
          return false;
        }
        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          Alert.alert('Error', 'Please enter a valid contact email address');
          return false;
        }
        return true;
      case 2:
        if (formData.animalsAccepted.length === 0) {
          Alert.alert('Error', 'Please select at least one type of animal accepted');
          return false;
        }
        if (!formData.agreedToTerms) {
          Alert.alert('Error', 'Please agree to the terms and conditions');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(2)) return;

    setLoading(true);
    try {
      const applicationData = {
        shelter_name: formData.shelterName,
        shelter_type: formData.shelterType,
        description: formData.description,
        address: formData.address,
        city: formData.city || '',
        state: formData.state || '',
        latitude: formData.latitude,
        longitude: formData.longitude,
        contact_person_name: formData.contactPersonName,
        phone: formData.phone,
        email: formData.email,
        animals_accepted: formData.animalsAccepted,
        shelter_capacity: parseInt(formData.shelterCapacity) || 0,
        services_offered: formData.servicesOffered,
        operating_hours: formData.operatingHours,
      };

      await shelterService.submitShelterApplication(applicationData);
      await checkExistingApplication();

      Alert.alert(
        'Application Submitted!',
        'Thank you for registering your shelter. We will review your application and contact you soon.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      if (error?.status !== 403) {
        console.error('Error submitting application:', error);
      }
      if (error.message?.includes('Network')) {
        Alert.alert('Network Error', 'Unable to connect to the server. Please check your internet connection.');
      } else {
        Alert.alert('Error', error.message || 'Failed to submit application. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = useCallback((status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return {
          color: '#F59E0B', bgColor: '#FEF3C7', icon: 'time',
          title: 'Application Pending',
          message: 'Your shelter registration is being reviewed by our team. We will notify you once a decision has been made.',
        };
      case 'approved':
        return {
          color: '#10B981', bgColor: '#D1FAE5', icon: 'checkmark-circle',
          title: 'Shelter Approved!',
          message: 'Congratulations! Your shelter has been approved. You can now manage your shelter from the dashboard.',
        };
      case 'rejected':
        return {
          color: '#EF4444', bgColor: '#FEE2E2', icon: 'close-circle',
          title: 'Application Not Approved',
          message: 'Unfortunately, your application was not approved. You may reapply below after addressing the feedback.',
        };
      case 'revoked':
        return {
          color: '#FF9800', bgColor: '#FFF3E0', icon: 'shield-outline',
          title: 'Shelter Registration Revoked',
          message: 'Your shelter registration has been revoked. Please review the reason below and reapply.',
        };
      default:
        return null;
    }
  }, []);

  // Render step content (admin-style)
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Basic Information</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Shelter Name *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="business-outline" size={20} color={COLORS.textLight} />
                <TextInput
                  style={styles.input}
                  value={formData.shelterName}
                  onChangeText={(t) => handleInputChange('shelterName', t)}
                  placeholder="Enter shelter name"
                  placeholderTextColor={COLORS.textLight}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Shelter Type *</Text>
              <View style={styles.typeGrid}>
                {SHELTER_TYPES.map(type => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.typeCard,
                      formData.shelterType === type.id && { borderColor: type.color, backgroundColor: type.color + '15' }
                    ]}
                    onPress={() => handleInputChange('shelterType', type.id)}
                  >
                    <View style={[styles.typeIcon, { backgroundColor: type.color + '20' }]}>
                      <Ionicons name={type.icon} size={20} color={type.color} />
                    </View>
                    <Text style={[
                      styles.typeLabel,
                      formData.shelterType === type.id && { color: type.color, fontWeight: '700' }
                    ]}>{type.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Description</Text>
              <View style={[styles.inputContainer, styles.textareaContainer]}>
                <TextInput
                  style={[styles.input, styles.textareaInput]}
                  value={formData.description}
                  onChangeText={(t) => handleInputChange('description', t)}
                  placeholder="Describe your shelter, its mission, and what makes it special..."
                  placeholderTextColor={COLORS.textLight}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </View>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Location & Contact</Text>

            <TouchableOpacity
              style={styles.mapButton}
              onPress={() => setShowLocationPicker(true)}
            >
              <LinearGradient colors={['#10B981', '#059669']} style={styles.mapButtonGradient}>
                <Ionicons name="map" size={24} color="#FFF" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.mapButtonText}>Pick Location on Map *</Text>
                  {formData.latitude && formData.longitude ? (
                    <Text style={styles.mapButtonCoords}>
                      {parseFloat(formData.latitude).toFixed(4)}, {parseFloat(formData.longitude).toFixed(4)}
                    </Text>
                  ) : (
                    <Text style={styles.mapButtonCoords}>Tap to select shelter location</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>

            {formData.address ? (
              <View style={styles.addressPreview}>
                <Ionicons name="location" size={16} color={COLORS.primary} />
                <Text style={styles.addressPreviewText} numberOfLines={2}>{formData.address}</Text>
              </View>
            ) : null}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Address *</Text>
              <View style={[styles.inputContainer, styles.multilineContainer]}>
                <View style={styles.inputIconWrap}>
                  <Ionicons name="location-outline" size={20} color={COLORS.textLight} />
                </View>
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={formData.address}
                  onChangeText={(t) => handleInputChange('address', t)}
                  placeholder="Full address"
                  placeholderTextColor={COLORS.textLight}
                  multiline
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Contact Person *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={COLORS.textLight} />
                <TextInput
                  style={styles.input}
                  value={formData.contactPersonName}
                  onChangeText={(t) => handleInputChange('contactPersonName', t)}
                  placeholder="Contact person name"
                  placeholderTextColor={COLORS.textLight}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Phone *</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="call-outline" size={18} color={COLORS.textLight} />
                  <TextInput
                    style={styles.input}
                    value={formData.phone}
                    onChangeText={(t) => handleInputChange('phone', t)}
                    placeholder="Phone"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={18} color={COLORS.textLight} />
                  <TextInput
                    style={styles.input}
                    value={formData.email}
                    onChangeText={(t) => handleInputChange('email', t.toLowerCase())}
                    placeholder="Email"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Operations & Services</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Animals Accepted *</Text>
              <View style={styles.animalGrid}>
                {ANIMAL_OPTIONS.map(animal => (
                  <TouchableOpacity
                    key={animal.id}
                    style={[
                      styles.animalChip,
                      formData.animalsAccepted.includes(animal.id) && styles.animalChipActive
                    ]}
                    onPress={() => toggleAnimal(animal.id)}
                  >
                    <Text style={styles.animalEmoji}>{animal.emoji}</Text>
                    <Text style={[
                      styles.animalLabel,
                      formData.animalsAccepted.includes(animal.id) && styles.animalLabelActive
                    ]}>{animal.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Capacity</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="home-outline" size={20} color={COLORS.textLight} />
                <TextInput
                  style={styles.input}
                  value={formData.shelterCapacity}
                  onChangeText={(t) => handleInputChange('shelterCapacity', t)}
                  placeholder="Maximum number of animals"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Services Offered</Text>
              <View style={styles.servicesWrap}>
                {SERVICE_OPTIONS.map(service => (
                  <TouchableOpacity
                    key={service.id}
                    style={[
                      styles.serviceChip,
                      formData.servicesOffered.includes(service.id) && styles.serviceChipActive
                    ]}
                    onPress={() => toggleService(service.id)}
                  >
                    <Ionicons
                      name={service.icon}
                      size={14}
                      color={formData.servicesOffered.includes(service.id) ? '#FFF' : COLORS.textMedium}
                    />
                    <Text style={[
                      styles.serviceLabel,
                      formData.servicesOffered.includes(service.id) && styles.serviceLabelActive
                    ]}>{service.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Operating Hours</Text>

              {/* Days Selection */}
              <View style={styles.daysContainer}>
                {DAYS_OF_WEEK.map(day => (
                  <TouchableOpacity
                    key={day.id}
                    style={[
                      styles.dayChip,
                      selectedDays.includes(day.id) && styles.dayChipActive
                    ]}
                    onPress={() => {
                      setSelectedDays(prev =>
                        prev.includes(day.id)
                          ? prev.filter(d => d !== day.id)
                          : [...prev, day.id]
                      );
                    }}
                  >
                    <Text style={[
                      styles.dayChipText,
                      selectedDays.includes(day.id) && styles.dayChipTextActive
                    ]}>{day.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Quick Select Buttons */}
              <View style={styles.quickSelectRow}>
                <TouchableOpacity
                  style={styles.quickSelectBtn}
                  onPress={() => setSelectedDays(['mon', 'tue', 'wed', 'thu', 'fri'])}
                >
                  <Text style={styles.quickSelectText}>Weekdays</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickSelectBtn}
                  onPress={() => setSelectedDays(['sat', 'sun'])}
                >
                  <Text style={styles.quickSelectText}>Weekend</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickSelectBtn}
                  onPress={() => setSelectedDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])}
                >
                  <Text style={styles.quickSelectText}>Daily</Text>
                </TouchableOpacity>
              </View>

              {/* Time Selection */}
              <View style={styles.timeRow}>
                <TouchableOpacity
                  style={styles.timePickerBtn}
                  onPress={() => {
                    setTimePickerType('open');
                    setShowTimePicker(true);
                  }}
                >
                  <View style={styles.timePickerIcon}>
                    <Ionicons name="sunny-outline" size={18} color="#10B981" />
                  </View>
                  <View style={styles.timePickerInfo}>
                    <Text style={styles.timePickerLabel}>Opens</Text>
                    <Text style={styles.timePickerValue}>{formatTime(openTime)}</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.timeDivider}>
                  <Ionicons name="arrow-forward" size={16} color={COLORS.textLight} />
                </View>

                <TouchableOpacity
                  style={styles.timePickerBtn}
                  onPress={() => {
                    setTimePickerType('close');
                    setShowTimePicker(true);
                  }}
                >
                  <View style={[styles.timePickerIcon, { backgroundColor: '#F59E0B' + '15' }]}>
                    <Ionicons name="moon-outline" size={18} color="#F59E0B" />
                  </View>
                  <View style={styles.timePickerInfo}>
                    <Text style={styles.timePickerLabel}>Closes</Text>
                    <Text style={styles.timePickerValue}>{formatTime(closeTime)}</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Preview */}
              {formData.operatingHours ? (
                <View style={styles.hoursPreview}>
                  <Ionicons name="time" size={16} color={COLORS.primary} />
                  <Text style={styles.hoursPreviewText}>{formData.operatingHours}</Text>
                </View>
              ) : null}
            </View>

            {/* Terms */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => handleInputChange('agreedToTerms', !formData.agreedToTerms)}
            >
              <View style={[styles.checkbox, formData.agreedToTerms && styles.checkboxChecked]}>
                {formData.agreedToTerms && <Ionicons name="checkmark" size={16} color="#FFF" />}
              </View>
              <Text style={styles.termsText}>
                I agree to the terms and conditions and confirm that the information provided is accurate.
              </Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  // Loading state
  if (checkingStatus) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Checking application status...</Text>
      </View>
    );
  }

  // Show existing application status (non-rejected/non-revoked)
  if (existingApplication && existingApplication.status !== 'rejected' && existingApplication.status !== 'revoked') {
    const statusInfo = getStatusInfo(existingApplication.status);
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Application Status</Text>
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.statusContent}>
          <View style={[styles.statusCard, { backgroundColor: statusInfo?.bgColor }]}>
            <View style={[styles.statusIconContainer, { backgroundColor: statusInfo?.color + '20' }]}>
              <Ionicons name={statusInfo?.icon} size={48} color={statusInfo?.color} />
            </View>
            <Text style={[styles.statusTitle, { color: statusInfo?.color }]}>{statusInfo?.title}</Text>
            <Text style={styles.statusMessage}>{statusInfo?.message}</Text>
          </View>
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Application Details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Shelter Name</Text>
              <Text style={styles.detailValue}>{existingApplication.shelter_name || 'N/A'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Type</Text>
              <Text style={styles.detailValue}>{existingApplication.shelter_type || 'N/A'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailValue}>{existingApplication.city || existingApplication.address || 'N/A'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Submitted</Text>
              <Text style={styles.detailValue}>
                {existingApplication.created_at
                  ? new Date(existingApplication.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                  : 'N/A'}
              </Text>
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
          {existingApplication.status === 'approved' && onNavigateToManager ? (
            <TouchableOpacity
              style={styles.manageButton}
              onPress={() => {
                onNavigateToManager();
              }}
            >
              <LinearGradient colors={['#10B981', '#059669']} style={styles.manageButtonGradient}>
                <Ionicons name="home" size={22} color="#FFF" />
                <Text style={styles.manageButtonText}>Manage My Shelter</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View style={styles.infoNote}>
              <Ionicons name="information-circle" size={20} color={COLORS.primary} />
              <Text style={styles.infoNoteText}>
                You will receive a notification once your application has been reviewed.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // Show rejection notice if rejected/revoked
  const rejectionInfo = existingApplication ? getStatusInfo(existingApplication.status) : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Gradient Header */}
      <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.gradientHeader}>
        <View style={styles.gradientHeaderTop}>
          <TouchableOpacity style={styles.gradientBackButton} onPress={onGoBack}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.gradientHeaderTitle}>
            <Text style={styles.gradientHeaderTitleText}>Register Shelter</Text>
            <Text style={styles.gradientHeaderSubtitle}>{FORM_STEPS[currentStep].title}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Step Indicator */}
      <View style={styles.stepIndicator}>
        {FORM_STEPS.map((step, index) => (
          <TouchableOpacity
            key={index}
            style={styles.stepItem}
            onPress={() => {
              if (index <= currentStep) setCurrentStep(index);
            }}
          >
            <View style={[
              styles.stepCircle,
              currentStep === index && styles.stepCircleActive,
              currentStep > index && styles.stepCircleCompleted,
            ]}>
              {currentStep > index ? (
                <Ionicons name="checkmark" size={14} color="#FFF" />
              ) : (
                <Ionicons name={step.icon} size={14} color={currentStep === index ? '#FFF' : COLORS.textLight} />
              )}
            </View>
            <Text style={[
              styles.stepLabel,
              currentStep === index && styles.stepLabelActive
            ]}>{step.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Rejection Notice */}
      {rejectionInfo && existingApplication && (
        <View style={[styles.rejectionNotice, { backgroundColor: rejectionInfo.bgColor }]}>
          <Ionicons name={rejectionInfo.icon} size={24} color={rejectionInfo.color} />
          <View style={styles.rejectionTextWrap}>
            <Text style={[styles.rejectionTitle, { color: rejectionInfo.color }]}>{rejectionInfo.title}</Text>
            {existingApplication.admin_feedback && (
              <Text style={styles.rejectionReason}>Feedback: {existingApplication.admin_feedback}</Text>
            )}
            <Text style={styles.rejectionHint}>You can update and resubmit your application below.</Text>
          </View>
        </View>
      )}

      {/* Scrollable Form Body */}
      <ScrollView style={styles.formBody} showsVerticalScrollIndicator={false}>
        {renderStepContent()}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Footer Navigation */}
      <View style={styles.footerNav}>
        {currentStep > 0 && (
          <TouchableOpacity
            style={styles.prevButton}
            onPress={() => setCurrentStep(p => p - 1)}
          >
            <Ionicons name="arrow-back" size={18} color={COLORS.textMedium} />
            <Text style={styles.prevButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        {currentStep < FORM_STEPS.length - 1 ? (
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
          >
            <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.nextButtonGradient}>
              <Text style={styles.nextButtonText}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleSubmit}
            disabled={loading}
          >
            <LinearGradient colors={['#10B981', '#059669']} style={styles.nextButtonGradient}>
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons name="home-heart" size={18} color="#FFF" />
                  <Text style={styles.nextButtonText}>
                    {existingApplication ? 'Resubmit' : 'Submit'}
                  </Text>
                  <Ionicons name="checkmark" size={18} color="#FFF" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* Location Picker Modal */}
      <Modal visible={showLocationPicker} animationType="slide" onRequestClose={() => setShowLocationPicker(false)}>
        <View style={styles.mapContainer}>
          <View style={styles.mapHeader}>
            <TouchableOpacity onPress={() => setShowLocationPicker(false)} style={styles.mapBackButton}>
              <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
            <Text style={styles.mapHeaderTitle}>Select Shelter Location</Text>
            <TouchableOpacity
              onPress={getCurrentLocation}
              style={styles.mapMyLocationBtn}
              disabled={isLoadingLocation}
            >
              {isLoadingLocation ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Ionicons name="locate" size={22} color={COLORS.primary} />
              )}
            </TouchableOpacity>
          </View>

          <WebView
            ref={webViewRef}
            source={{ html: LOCATION_MAP_HTML }}
            style={styles.webView}
            onMessage={handleMapMessage}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
          />

          <TouchableOpacity style={styles.confirmLocationBtn} onPress={confirmLocationSelection}>
            <Ionicons name="checkmark-circle" size={22} color="#FFF" />
            <Text style={styles.confirmLocationText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      <Modal visible={showTimePicker} animationType="fade" transparent>
        <View style={styles.timePickerOverlay}>
          <View style={styles.timePickerModal}>
            <View style={styles.timePickerHeader}>
              <Text style={styles.timePickerTitle}>
                Select {timePickerType === 'open' ? 'Opening' : 'Closing'} Time
              </Text>
              <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                <Ionicons name="close" size={24} color={COLORS.textMedium} />
              </TouchableOpacity>
            </View>

            <View style={styles.timePickerBody}>
              {/* Hour Picker */}
              <View style={styles.timeColumn}>
                <Text style={styles.timeColumnLabel}>Hour</Text>
                <ScrollView
                  style={styles.timeScroll}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.timeScrollContent}
                >
                  {Array.from({ length: 24 }, (_, i) => i).map(hour => {
                    const currentTime = timePickerType === 'open' ? openTime : closeTime;
                    const isSelected = currentTime.hour === hour;
                    return (
                      <TouchableOpacity
                        key={hour}
                        style={[styles.timeOption, isSelected && styles.timeOptionActive]}
                        onPress={() => {
                          if (timePickerType === 'open') {
                            setOpenTime(prev => ({ ...prev, hour }));
                          } else {
                            setCloseTime(prev => ({ ...prev, hour }));
                          }
                        }}
                      >
                        <Text style={[styles.timeOptionText, isSelected && styles.timeOptionTextActive]}>
                          {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Minute Picker */}
              <View style={styles.timeColumn}>
                <Text style={styles.timeColumnLabel}>Minute</Text>
                <ScrollView
                  style={styles.timeScroll}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.timeScrollContent}
                >
                  {[0, 15, 30, 45].map(minute => {
                    const currentTime = timePickerType === 'open' ? openTime : closeTime;
                    const isSelected = currentTime.minute === minute;
                    return (
                      <TouchableOpacity
                        key={minute}
                        style={[styles.timeOption, isSelected && styles.timeOptionActive]}
                        onPress={() => {
                          if (timePickerType === 'open') {
                            setOpenTime(prev => ({ ...prev, minute }));
                          } else {
                            setCloseTime(prev => ({ ...prev, minute }));
                          }
                        }}
                      >
                        <Text style={[styles.timeOptionText, isSelected && styles.timeOptionTextActive]}>
                          :{minute.toString().padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            <View style={styles.timePickerPreview}>
              <Ionicons
                name={timePickerType === 'open' ? 'sunny' : 'moon'}
                size={20}
                color={timePickerType === 'open' ? '#10B981' : '#F59E0B'}
              />
              <Text style={styles.timePickerPreviewText}>
                {formatTime(timePickerType === 'open' ? openTime : closeTime)}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.timePickerConfirm}
              onPress={() => setShowTimePicker(false)}
            >
              <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.timePickerConfirmGradient}>
                <Text style={styles.timePickerConfirmText}>Confirm</Text>
              </LinearGradient>
            </TouchableOpacity>
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
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Gradient Header (admin-style)
  gradientHeader: {
    paddingTop: Platform.OS === 'ios' ? 56 : StatusBar.currentHeight + 12,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  gradientHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gradientBackButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  gradientHeaderTitle: {
    flex: 1,
  },
  gradientHeaderTitleText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  gradientHeaderSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },

  // Old plain header (for status screens)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : StatusBar.currentHeight + 12,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.backgroundLight || '#F0F0F0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.backgroundWhite || '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textDark,
  },

  // Step Indicator
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: COLORS.backgroundWhite,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepCircleActive: {
    backgroundColor: COLORS.primary,
  },
  stepCircleCompleted: {
    backgroundColor: '#10B981',
  },
  stepLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  stepLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Form Body
  formBody: {
    flex: 1,
    padding: 20,
  },
  stepContent: {},
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: 20,
  },

  // Form Group
  formGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMedium,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.textDark,
    marginLeft: 10,
  },
  textareaContainer: {
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  textareaInput: {
    marginLeft: 0,
    textAlignVertical: 'top',
    minHeight: 80,
    paddingVertical: 0,
  },
  multilineContainer: {
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  inputIconWrap: {
    marginTop: 14,
    alignSelf: 'flex-start',
  },
  multilineInput: {
    textAlignVertical: 'top',
    minHeight: 60,
  },
  row: {
    flexDirection: 'row',
  },

  // Type Grid (admin-style with colors)
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeCard: {
    width: (SCREEN_WIDTH - 60) / 2 - 5,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.backgroundWhite,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
  },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMedium,
  },

  // Map Button (admin-style gradient)
  mapButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  },
  mapButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  mapButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  mapButtonCoords: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },

  // Address Preview
  addressPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '10',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  addressPreviewText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textDark,
    fontWeight: '500',
  },

  // Animal Grid (admin-style chips)
  animalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  animalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.backgroundWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: 6,
  },
  animalChipActive: {
    backgroundColor: COLORS.primary + '15',
    borderColor: COLORS.primary,
  },
  animalEmoji: {
    fontSize: 16,
  },
  animalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMedium,
  },
  animalLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Services (admin-style chips)
  servicesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: COLORS.backgroundWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: 4,
  },
  serviceChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  serviceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMedium,
  },
  serviceLabelActive: {
    color: '#FFF',
  },

  // Days Picker
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.backgroundWhite,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    minWidth: 44,
    alignItems: 'center',
  },
  dayChipActive: {
    backgroundColor: COLORS.primary + '15',
    borderColor: COLORS.primary,
  },
  dayChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMedium,
  },
  dayChipTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Quick Select
  quickSelectRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickSelectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.backgroundLight,
  },
  quickSelectText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textLight,
  },

  // Time Row
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timePickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLORS.backgroundWhite,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  timePickerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#10B981' + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  timePickerInfo: {
    flex: 1,
  },
  timePickerLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    marginBottom: 2,
  },
  timePickerValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  timeDivider: {
    paddingHorizontal: 4,
  },

  // Hours Preview
  hoursPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: COLORS.primary + '10',
    gap: 8,
  },
  hoursPreviewText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    flex: 1,
  },

  // Terms
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textMedium,
    lineHeight: 20,
  },

  // Footer Navigation (admin-style)
  footerNav: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    backgroundColor: COLORS.backgroundWhite,
  },
  prevButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: COLORS.backgroundLight,
    gap: 6,
  },
  prevButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textMedium,
  },
  nextButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },

  // Time Picker Modal
  timePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  timePickerModal: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 20,
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
  },
  timePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  timePickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  timePickerBody: {
    flexDirection: 'row',
    padding: 20,
    gap: 16,
  },
  timeColumn: {
    flex: 1,
  },
  timeColumnLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeScroll: {
    maxHeight: 200,
  },
  timeScrollContent: {
    paddingVertical: 4,
  },
  timeOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 4,
    alignItems: 'center',
  },
  timeOptionActive: {
    backgroundColor: COLORS.primary,
  },
  timeOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textMedium,
  },
  timeOptionTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  timePickerPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: COLORS.backgroundLight,
    gap: 10,
  },
  timePickerPreviewText: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  timePickerConfirm: {
    margin: 16,
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  timePickerConfirmGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  timePickerConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },

  // Scrolling & Content
  scrollView: {
    flex: 1,
  },
  statusContent: {
    padding: SPACING.lg,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 14,
    color: COLORS.textMedium,
  },

  // Status card styles
  statusCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  statusIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  statusMessage: {
    fontSize: 14,
    color: COLORS.textMedium,
    textAlign: 'center',
    lineHeight: 22,
  },
  detailsCard: {
    backgroundColor: COLORS.backgroundWhite || '#FFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textDark,
    marginBottom: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 13,
    color: COLORS.textMedium,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.textDark,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '10',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: 10,
  },
  infoNoteText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textMedium,
    lineHeight: 20,
  },
  manageButton: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  manageButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 10,
  },
  manageButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
  },

  // Rejection notice
  rejectionNotice: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: 12,
    marginHorizontal: 20,
    marginTop: 12,
  },
  rejectionTextWrap: {
    flex: 1,
  },
  rejectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  rejectionReason: {
    fontSize: 13,
    color: COLORS.textMedium,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  rejectionHint: {
    fontSize: 12,
    color: COLORS.textLight,
  },

  // Map modal
  mapContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : StatusBar.currentHeight + 12,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.backgroundWhite || '#FFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mapBackButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapHeaderTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textDark,
    marginLeft: SPACING.sm,
  },
  mapMyLocationBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webView: {
    flex: 1,
  },
  confirmLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.lg,
    marginBottom: Platform.OS === 'ios' ? 34 : SPACING.lg,
    marginTop: SPACING.md,
    paddingVertical: 16,
    borderRadius: RADIUS.lg,
    gap: 8,
    elevation: 3,
  },
  confirmLocationText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});

export default memo(UserShelterApplicationScreen);
