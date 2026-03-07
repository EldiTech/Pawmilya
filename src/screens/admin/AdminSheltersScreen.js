import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Animated,
  Linking,
  Dimensions,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import CONFIG from '../../config/config';
import { ADMIN_COLORS, formatDate, useFadeAnimation } from './shared';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Theme Colors - Modern Orange Theme
const THEME = {
  primary: '#FF6B35',
  primaryDark: '#E55A2B',
  primaryLight: '#FF8F6B',
  secondary: '#1E293B',
  accent: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  text: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  success: '#22C55E',
};

// Shelter Types
const SHELTER_TYPES = [
  { id: 'government', label: 'Government', icon: 'business', color: '#6366F1' },
  { id: 'private', label: 'Private', icon: 'home', color: '#EC4899' },
  { id: 'ngo', label: 'NGO', icon: 'people', color: '#14B8A6' },
  { id: 'rescue_group', label: 'Rescue Group', icon: 'heart', color: '#F97316' },
];

// Animal Types
const ANIMAL_TYPES = [
  { id: 'dogs', label: 'Dogs', emoji: '🐕' },
  { id: 'cats', label: 'Cats', emoji: '🐈' },
  { id: 'birds', label: 'Birds', emoji: '🐦' },
  { id: 'rabbits', label: 'Rabbits', emoji: '🐰' },
  { id: 'others', label: 'Others', emoji: '🐾' },
];

// Services
const SERVICES = [
  { id: 'adoption', label: 'Adoption', icon: 'heart' },
  { id: 'rescue', label: 'Rescue', icon: 'medkit' },
  { id: 'foster_care', label: 'Foster Care', icon: 'home' },
  { id: 'veterinary_care', label: 'Vet Care', icon: 'medical' },
  { id: 'spay_neuter', label: 'Spay/Neuter', icon: 'cut' },
  { id: 'vaccination', label: 'Vaccination', icon: 'fitness' },
  { id: 'rehabilitation', label: 'Rehab', icon: 'pulse' },
];

// Status Config
const STATUS_CONFIG = {
  pending: { color: '#F59E0B', bg: '#FEF3C7', label: 'Pending', icon: 'time-outline' },
  verified: { color: '#22C55E', bg: '#DCFCE7', label: 'Verified', icon: 'checkmark-circle' },
  rejected: { color: '#EF4444', bg: '#FEE2E2', label: 'Rejected', icon: 'close-circle' },
};

const AdminSheltersScreen = ({ onGoBack, adminToken }) => {
  // Core States
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const { fadeAnim } = useFadeAnimation();

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showPetsModal, setShowPetsModal] = useState(false);
  const [selectedShelter, setSelectedShelter] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Shelter Pets States
  const [shelterPets, setShelterPets] = useState([]);
  const [loadingPets, setLoadingPets] = useState(false);

  // Form State
  const initialFormState = {
    name: '',
    shelter_type: 'private',
    description: '',
    address: '',
    latitude: '',
    longitude: '',
    contact_person_name: '',
    phone: '',
    email: '',
    animals_accepted: ['dogs', 'cats'],
    shelter_capacity: '',
    current_count: '',
    services_offered: ['adoption'],
    operating_hours: '',
    logo_url: '',
    cover_image_url: '',
    proof_document_url: '',
    is_active: true,
    verification_status: 'pending',
  };
  
  const [formData, setFormData] = useState(initialFormState);
  const [uploadingImage, setUploadingImage] = useState(null);
  const webViewRef = useRef(null);

  // Operating Hours Picker States
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerType, setTimePickerType] = useState('open'); // 'open' or 'close'
  const [selectedDays, setSelectedDays] = useState(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [openTime, setOpenTime] = useState({ hour: 9, minute: 0 });
  const [closeTime, setCloseTime] = useState({ hour: 17, minute: 0 });

  // Days of the week configuration
  const DAYS_OF_WEEK = [
    { id: 'mon', label: 'Mon', fullLabel: 'Monday' },
    { id: 'tue', label: 'Tue', fullLabel: 'Tuesday' },
    { id: 'wed', label: 'Wed', fullLabel: 'Wednesday' },
    { id: 'thu', label: 'Thu', fullLabel: 'Thursday' },
    { id: 'fri', label: 'Fri', fullLabel: 'Friday' },
    { id: 'sat', label: 'Sat', fullLabel: 'Saturday' },
    { id: 'sun', label: 'Sun', fullLabel: 'Sunday' },
  ];

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
    
    // Group consecutive days
    const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const sortedDays = selectedDays.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
    
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
      // Check for consecutive days
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
    setFormData(prev => ({ ...prev, operating_hours: hoursString }));
  }, [selectedDays, openTime, closeTime]);

  // Fetch Shelters
  const fetchShelters = useCallback(async () => {
    try {
      const response = await fetch(`${CONFIG.API_URL}/admin/shelters`, {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setShelters(data.shelters || data || []);
      }
    } catch (error) {
      console.error('Error fetching shelters:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [adminToken]);

  useEffect(() => {
    fetchShelters();
  }, [fetchShelters]);

  // Fetch pets for a specific shelter
  const fetchShelterPets = useCallback(async (shelterId) => {
    try {
      setLoadingPets(true);
      const response = await fetch(`${CONFIG.API_URL}/admin/shelters/${shelterId}/pets`, {
        headers: { 'Authorization': `Bearer ${adminToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setShelterPets(data.pets || []);
      } else {
        setShelterPets([]);
      }
    } catch (error) {
      console.error('Error fetching shelter pets:', error);
      setShelterPets([]);
    } finally {
      setLoadingPets(false);
    }
  }, [adminToken]);

  // Open pets modal for a shelter
  const openPetsModal = useCallback((shelter) => {
    setSelectedShelter(shelter);
    setShelterPets([]);
    setShowPetsModal(true);
    fetchShelterPets(shelter.id);
  }, [fetchShelterPets]);

  // Filter shelters
  const filteredShelters = useMemo(() => {
    let result = shelters;
    
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(s => 
        s.name?.toLowerCase().includes(query) ||
        s.address?.toLowerCase().includes(query)
      );
    }
    
    if (activeFilter !== 'all') {
      if (activeFilter === 'active') result = result.filter(s => s.is_active);
      else if (activeFilter === 'inactive') result = result.filter(s => !s.is_active);
      else result = result.filter(s => s.verification_status === activeFilter);
    }
    
    return result;
  }, [shelters, search, activeFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: shelters.length,
    verified: shelters.filter(s => s.verification_status === 'verified').length,
    pending: shelters.filter(s => s.verification_status === 'pending').length,
    active: shelters.filter(s => s.is_active).length,
  }), [shelters]);

  // Parse operating hours string to extract days and times
  const parseOperatingHours = (hoursString) => {
    if (!hoursString) {
      return {
        days: ['mon', 'tue', 'wed', 'thu', 'fri'],
        open: { hour: 9, minute: 0 },
        close: { hour: 17, minute: 0 }
      };
    }

    // Default values
    let days = ['mon', 'tue', 'wed', 'thu', 'fri'];
    let open = { hour: 9, minute: 0 };
    let close = { hour: 17, minute: 0 };

    // Try to parse time pattern like "9:00 AM - 5:00 PM" or "9AM-5PM"
    const timePattern = /(\d{1,2}):?(\d{2})?\s*(AM|PM)?\s*[-–]\s*(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i;
    const timeMatch = hoursString.match(timePattern);
    
    if (timeMatch) {
      let openHour = parseInt(timeMatch[1]);
      const openMinute = parseInt(timeMatch[2] || '0');
      const openPeriod = (timeMatch[3] || '').toUpperCase();
      
      let closeHour = parseInt(timeMatch[4]);
      const closeMinute = parseInt(timeMatch[5] || '0');
      const closePeriod = (timeMatch[6] || '').toUpperCase();

      // Convert to 24-hour format
      if (openPeriod === 'PM' && openHour !== 12) openHour += 12;
      if (openPeriod === 'AM' && openHour === 12) openHour = 0;
      if (closePeriod === 'PM' && closeHour !== 12) closeHour += 12;
      if (closePeriod === 'AM' && closeHour === 12) closeHour = 0;

      open = { hour: openHour, minute: openMinute };
      close = { hour: closeHour, minute: closeMinute };
    }

    // Try to parse days
    const lowerHours = hoursString.toLowerCase();
    if (lowerHours.includes('daily') || lowerHours.includes('everyday')) {
      days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    } else if (lowerHours.includes('mon-fri') || lowerHours.includes('weekday')) {
      days = ['mon', 'tue', 'wed', 'thu', 'fri'];
    } else if (lowerHours.includes('sat-sun') || lowerHours.includes('weekend')) {
      days = ['sat', 'sun'];
    } else {
      // Try to find individual days
      const foundDays = [];
      if (lowerHours.includes('mon')) foundDays.push('mon');
      if (lowerHours.includes('tue')) foundDays.push('tue');
      if (lowerHours.includes('wed')) foundDays.push('wed');
      if (lowerHours.includes('thu')) foundDays.push('thu');
      if (lowerHours.includes('fri')) foundDays.push('fri');
      if (lowerHours.includes('sat')) foundDays.push('sat');
      if (lowerHours.includes('sun')) foundDays.push('sun');
      if (foundDays.length > 0) days = foundDays;
    }

    return { days, open, close };
  };

  // Reset form
  const resetForm = () => {
    setFormData(initialFormState);
    setCurrentStep(0);
    setEditMode(false);
    setSelectedShelter(null);
    // Reset day/time picker to defaults
    setSelectedDays(['mon', 'tue', 'wed', 'thu', 'fri']);
    setOpenTime({ hour: 9, minute: 0 });
    setCloseTime({ hour: 17, minute: 0 });
  };

  // Open add modal
  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  // Open edit modal
  const openEditModal = (shelter) => {
    // Parse existing operating hours
    const parsedHours = parseOperatingHours(shelter.operating_hours);
    setSelectedDays(parsedHours.days);
    setOpenTime(parsedHours.open);
    setCloseTime(parsedHours.close);

    setFormData({
      name: shelter.name || '',
      shelter_type: shelter.shelter_type || 'private',
      description: shelter.description || '',
      address: shelter.address || '',
      latitude: shelter.latitude?.toString() || '',
      longitude: shelter.longitude?.toString() || '',
      contact_person_name: shelter.contact_person_name || '',
      phone: shelter.phone || '',
      email: shelter.email || '',
      animals_accepted: shelter.animals_accepted || ['dogs', 'cats'],
      shelter_capacity: shelter.shelter_capacity?.toString() || '',
      current_count: shelter.current_count?.toString() || '',
      services_offered: shelter.services_offered || ['adoption'],
      operating_hours: shelter.operating_hours || '',
      logo_url: shelter.logo_image || shelter.logo_url || shelter.logo_image_data || '',
      cover_image_url: shelter.cover_image || shelter.cover_image_url || shelter.cover_image_data || '',
      proof_document_url: shelter.proof_document_image || shelter.proof_document_url || '',
      is_active: shelter.is_active ?? true,
      verification_status: shelter.verification_status || 'pending',
    });
    setSelectedShelter(shelter);
    setEditMode(true);
    setCurrentStep(0);
    setShowAddModal(true);
  };

  // Helper function to get best shelter image
  const getShelterDisplayImage = (shelter, type = 'cover') => {
    if (!shelter) return null;
    if (type === 'cover') {
      return shelter.cover_image || shelter.cover_image_url || shelter.cover_image_data ||
             shelter.logo_image || shelter.logo_url || shelter.logo_image_data || null;
    } else if (type === 'logo') {
      return shelter.logo_image || shelter.logo_url || shelter.logo_image_data || null;
    }
    return null;
  };

  // Save shelter
  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter shelter name');
      return;
    }
    if (!formData.address.trim()) {
      Alert.alert('Error', 'Please enter address');
      return;
    }

    setSaving(true);
    try {
      const url = editMode 
        ? `${CONFIG.API_URL}/admin/shelters/${selectedShelter.id}`
        : `${CONFIG.API_URL}/admin/shelters`;
      
      // Prepare data with proper image fields
      const shelterData = {
        ...formData,
        shelter_capacity: formData.shelter_capacity ? parseInt(formData.shelter_capacity) : 0,
        current_count: formData.current_count ? parseInt(formData.current_count) : 0,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        // Send base64 images directly if they are base64
        logo_image: formData.logo_url?.startsWith('data:image') ? formData.logo_url : null,
        cover_image: formData.cover_image_url?.startsWith('data:image') ? formData.cover_image_url : null,
        proof_document_image: formData.proof_document_url?.startsWith('data:image') ? formData.proof_document_url : null,
      };

      console.log('Saving shelter with logo:', shelterData.logo_image ? 'base64 image' : 'none');
      console.log('Saving shelter with cover:', shelterData.cover_image ? 'base64 image' : 'none');

      const response = await fetch(url, {
        method: editMode ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify(shelterData),
      });

      if (response.ok) {
        Alert.alert('Success', editMode ? 'Shelter updated!' : 'Shelter created!');
        setShowAddModal(false);
        resetForm();
        fetchShelters();
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Save shelter error:', response.status, errorData);
        throw new Error(errorData.error || 'Failed to save');
      }
    } catch (error) {
      console.error('Save shelter exception:', error);
      Alert.alert('Error', error.message || 'Failed to save shelter');
    } finally {
      setSaving(false);
    }
  };

  // Delete shelter
  const handleDelete = (shelter) => {
    Alert.alert(
      'Delete Shelter',
      `Are you sure you want to delete "${shelter.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${CONFIG.API_URL}/admin/shelters/${shelter.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${adminToken}` },
              });
              if (response.ok) {
                Alert.alert('Success', 'Shelter deleted');
                fetchShelters();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete shelter');
            }
          },
        },
      ]
    );
  };

  // Toggle status
  const toggleStatus = async (shelter) => {
    try {
      const response = await fetch(`${CONFIG.API_URL}/admin/shelters/${shelter.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ ...shelter, is_active: !shelter.is_active }),
      });
      if (response.ok) fetchShelters();
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  // Verify shelter
  const handleVerify = async (status) => {
    if (!selectedShelter) return;
    try {
      const response = await fetch(`${CONFIG.API_URL}/admin/shelters/${selectedShelter.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ ...selectedShelter, verification_status: status }),
      });
      if (response.ok) {
        Alert.alert('Success', `Shelter ${status}`);
        setShowVerifyModal(false);
        setShowDetailModal(false);
        fetchShelters();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update verification');
    }
  };

  // Pick Image and convert to base64
  const pickImage = async (type) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: type === 'logo' ? [1, 1] : [16, 9],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setUploadingImage(type);
        
        try {
          // Convert image to base64
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: 'base64',
          });
          
          // Determine mime type from URI
          const extension = uri.split('.').pop()?.toLowerCase();
          const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
          const base64Uri = `data:${mimeType};base64,${base64}`;
          
          if (type === 'logo') setFormData(prev => ({ ...prev, logo_url: base64Uri }));
          else if (type === 'cover') setFormData(prev => ({ ...prev, cover_image_url: base64Uri }));
          else if (type === 'proof') setFormData(prev => ({ ...prev, proof_document_url: base64Uri }));
        } catch (err) {
          console.error('Error converting image to base64:', err);
          Alert.alert('Error', 'Failed to process image');
        }
        
        setUploadingImage(null);
      }
    } catch (error) {
      setUploadingImage(null);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  // Map HTML
  const getMapHtml = () => {
    const lat = formData.latitude || '14.5995';
    const lng = formData.longitude || '120.9842';
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body, #map { height: 100%; width: 100%; }
          .search-box {
            position: absolute;
            top: 16px;
            left: 16px;
            right: 16px;
            z-index: 1000;
            background: white;
            border-radius: 12px;
            padding: 12px 16px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            display: flex;
            gap: 10px;
          }
          .search-box input {
            flex: 1;
            border: none;
            font-size: 15px;
            outline: none;
          }
          .confirm-btn {
            position: absolute;
            bottom: 24px;
            left: 16px;
            right: 16px;
            z-index: 1000;
            background: linear-gradient(135deg, #FF6B35, #E55A2B);
            color: white;
            border: none;
            border-radius: 14px;
            padding: 16px;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
          }
          .info-box {
            position: absolute;
            bottom: 90px;
            left: 16px;
            right: 16px;
            z-index: 1000;
            background: white;
            border-radius: 12px;
            padding: 14px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <div class="search-box">
          <span>📍</span>
          <input type="text" id="searchInput" placeholder="Search location..." />
        </div>
        <div class="info-box" id="info">Tap on map to select location</div>
        <button class="confirm-btn" onclick="confirmLocation()">Confirm Location</button>
        <script>
          var map = L.map('map').setView([${lat}, ${lng}], 14);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
          var marker = L.marker([${lat}, ${lng}], {draggable: true}).addTo(map);
          var selectedLat = ${lat}, selectedLng = ${lng}, selectedAddress = '';
          
          function updateAddress(lat, lng) {
            document.getElementById('info').innerHTML = 'Loading address...';
            fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat='+lat+'&lon='+lng)
              .then(r => r.json())
              .then(data => {
                selectedAddress = data.display_name || '';
                document.getElementById('info').innerHTML = selectedAddress.substring(0, 80) + '...';
              })
              .catch(() => {
                document.getElementById('info').innerHTML = lat.toFixed(6) + ', ' + lng.toFixed(6);
              });
          }
          
          map.on('click', function(e) {
            selectedLat = e.latlng.lat;
            selectedLng = e.latlng.lng;
            marker.setLatLng(e.latlng);
            updateAddress(selectedLat, selectedLng);
          });
          
          marker.on('dragend', function(e) {
            var pos = marker.getLatLng();
            selectedLat = pos.lat;
            selectedLng = pos.lng;
            updateAddress(selectedLat, selectedLng);
          });
          
          document.getElementById('searchInput').addEventListener('keyup', function(e) {
            if (e.key === 'Enter') {
              var q = this.value;
              fetch('https://nominatim.openstreetmap.org/search?format=json&q='+encodeURIComponent(q)+'&limit=1')
                .then(r => r.json())
                .then(data => {
                  if (data[0]) {
                    var lat = parseFloat(data[0].lat);
                    var lng = parseFloat(data[0].lon);
                    map.setView([lat, lng], 16);
                    marker.setLatLng([lat, lng]);
                    selectedLat = lat;
                    selectedLng = lng;
                    selectedAddress = data[0].display_name;
                    document.getElementById('info').innerHTML = selectedAddress.substring(0, 80) + '...';
                  }
                });
            }
          });
          
          function confirmLocation() {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              lat: selectedLat,
              lng: selectedLng,
              address: selectedAddress
            }));
          }
          
          updateAddress(${lat}, ${lng});
        </script>
      </body>
      </html>
    `;
  };

  // Handle map message
  const handleMapMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      setFormData(prev => ({
        ...prev,
        latitude: data.lat.toString(),
        longitude: data.lng.toString(),
        address: data.address || prev.address,
      }));
      setShowMapModal(false);
    } catch (error) {
      console.error('Map error:', error);
    }
  };

  // Form steps
  const formSteps = [
    { title: 'Basic Info', icon: 'information-circle' },
    { title: 'Location', icon: 'location' },
    { title: 'Details', icon: 'list' },
    { title: 'Media', icon: 'images' },
  ];

  // Render Step Content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Basic Information</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Shelter Name *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="business-outline" size={20} color={THEME.textMuted} />
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(t) => setFormData(p => ({ ...p, name: t }))}
                  placeholder="Enter shelter name"
                  placeholderTextColor={THEME.textMuted}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Shelter Type</Text>
              <View style={styles.typeGrid}>
                {SHELTER_TYPES.map(type => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.typeCard,
                      formData.shelter_type === type.id && { borderColor: type.color, backgroundColor: type.color + '15' }
                    ]}
                    onPress={() => setFormData(p => ({ ...p, shelter_type: type.id }))}
                  >
                    <View style={[styles.typeIcon, { backgroundColor: type.color + '20' }]}>
                      <Ionicons name={type.icon} size={20} color={type.color} />
                    </View>
                    <Text style={[
                      styles.typeLabel,
                      formData.shelter_type === type.id && { color: type.color, fontWeight: '700' }
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
                  onChangeText={(t) => setFormData(p => ({ ...p, description: t }))}
                  placeholder="Describe your shelter..."
                  placeholderTextColor={THEME.textMuted}
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
              onPress={() => setShowMapModal(true)}
            >
              <LinearGradient colors={[THEME.accent, '#059669']} style={styles.mapButtonGradient}>
                <Ionicons name="map" size={24} color="#FFF" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.mapButtonText}>Pick Location on Map</Text>
                  {formData.latitude && formData.longitude && (
                    <Text style={styles.mapButtonCoords}>
                      {parseFloat(formData.latitude).toFixed(4)}, {parseFloat(formData.longitude).toFixed(4)}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Address *</Text>
              <View style={[styles.inputContainer, styles.multilineContainer]}>
                <View style={styles.inputIconWrap}>
                  <Ionicons name="location-outline" size={20} color={THEME.textMuted} />
                </View>
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={formData.address}
                  onChangeText={(t) => setFormData(p => ({ ...p, address: t }))}
                  placeholder="Full address"
                  placeholderTextColor={THEME.textMuted}
                  multiline
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Contact Person</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={THEME.textMuted} />
                <TextInput
                  style={styles.input}
                  value={formData.contact_person_name}
                  onChangeText={(t) => setFormData(p => ({ ...p, contact_person_name: t }))}
                  placeholder="Contact person name"
                  placeholderTextColor={THEME.textMuted}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Phone</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="call-outline" size={18} color={THEME.textMuted} />
                  <TextInput
                    style={styles.input}
                    value={formData.phone}
                    onChangeText={(t) => setFormData(p => ({ ...p, phone: t }))}
                    placeholder="Phone"
                    placeholderTextColor={THEME.textMuted}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={18} color={THEME.textMuted} />
                  <TextInput
                    style={styles.input}
                    value={formData.email}
                    onChangeText={(t) => setFormData(p => ({ ...p, email: t.toLowerCase() }))}
                    placeholder="Email"
                    placeholderTextColor={THEME.textMuted}
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
              <Text style={styles.label}>Animals Accepted</Text>
              <View style={styles.animalGrid}>
                {ANIMAL_TYPES.map(animal => (
                  <TouchableOpacity
                    key={animal.id}
                    style={[
                      styles.animalChip,
                      formData.animals_accepted.includes(animal.id) && styles.animalChipActive
                    ]}
                    onPress={() => {
                      const arr = formData.animals_accepted.includes(animal.id)
                        ? formData.animals_accepted.filter(a => a !== animal.id)
                        : [...formData.animals_accepted, animal.id];
                      setFormData(p => ({ ...p, animals_accepted: arr }));
                    }}
                  >
                    <Text style={styles.animalEmoji}>{animal.emoji}</Text>
                    <Text style={[
                      styles.animalLabel,
                      formData.animals_accepted.includes(animal.id) && styles.animalLabelActive
                    ]}>{animal.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Capacity</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.input, { marginLeft: 0, textAlign: 'center' }]}
                    value={formData.shelter_capacity}
                    onChangeText={(t) => setFormData(p => ({ ...p, shelter_capacity: t }))}
                    placeholder="Max"
                    placeholderTextColor={THEME.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Current Count</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.input, { marginLeft: 0, textAlign: 'center' }]}
                    value={formData.current_count}
                    onChangeText={(t) => setFormData(p => ({ ...p, current_count: t }))}
                    placeholder="Now"
                    placeholderTextColor={THEME.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Services Offered</Text>
              <View style={styles.servicesWrap}>
                {SERVICES.map(service => (
                  <TouchableOpacity
                    key={service.id}
                    style={[
                      styles.serviceChip,
                      formData.services_offered.includes(service.id) && styles.serviceChipActive
                    ]}
                    onPress={() => {
                      const arr = formData.services_offered.includes(service.id)
                        ? formData.services_offered.filter(s => s !== service.id)
                        : [...formData.services_offered, service.id];
                      setFormData(p => ({ ...p, services_offered: arr }));
                    }}
                  >
                    <Ionicons 
                      name={service.icon} 
                      size={14} 
                      color={formData.services_offered.includes(service.id) ? '#FFF' : THEME.textSecondary} 
                    />
                    <Text style={[
                      styles.serviceLabel,
                      formData.services_offered.includes(service.id) && styles.serviceLabelActive
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
                    <Ionicons name="sunny-outline" size={18} color={THEME.accent} />
                  </View>
                  <View style={styles.timePickerInfo}>
                    <Text style={styles.timePickerLabel}>Opens</Text>
                    <Text style={styles.timePickerValue}>{formatTime(openTime)}</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.timeDivider}>
                  <Ionicons name="arrow-forward" size={16} color={THEME.textMuted} />
                </View>

                <TouchableOpacity
                  style={styles.timePickerBtn}
                  onPress={() => {
                    setTimePickerType('close');
                    setShowTimePicker(true);
                  }}
                >
                  <View style={[styles.timePickerIcon, { backgroundColor: THEME.warning + '15' }]}>
                    <Ionicons name="moon-outline" size={18} color={THEME.warning} />
                  </View>
                  <View style={styles.timePickerInfo}>
                    <Text style={styles.timePickerLabel}>Closes</Text>
                    <Text style={styles.timePickerValue}>{formatTime(closeTime)}</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Preview */}
              {formData.operating_hours && (
                <View style={styles.hoursPreview}>
                  <Ionicons name="time" size={16} color={THEME.primary} />
                  <Text style={styles.hoursPreviewText}>{formData.operating_hours}</Text>
                </View>
              )}
            </View>
          </View>
        );
      
      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Media & Status</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Shelter Logo</Text>
              <TouchableOpacity 
                style={styles.imageUpload}
                onPress={() => pickImage('logo')}
                disabled={uploadingImage === 'logo'}
              >
                {uploadingImage === 'logo' ? (
                  <ActivityIndicator color={THEME.primary} />
                ) : formData.logo_url ? (
                  <>
                    <Image source={{ uri: formData.logo_url }} style={styles.uploadedImage} />
                    <TouchableOpacity 
                      style={styles.removeImage}
                      onPress={() => setFormData(p => ({ ...p, logo_url: '' }))}
                    >
                      <Ionicons name="close" size={16} color="#FFF" />
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={32} color={THEME.textMuted} />
                    <Text style={styles.uploadText}>Upload Logo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Cover Photo</Text>
              <TouchableOpacity 
                style={[styles.imageUpload, styles.coverUpload]}
                onPress={() => pickImage('cover')}
                disabled={uploadingImage === 'cover'}
              >
                {uploadingImage === 'cover' ? (
                  <ActivityIndicator color={THEME.primary} />
                ) : formData.cover_image_url ? (
                  <>
                    <Image source={{ uri: formData.cover_image_url }} style={styles.uploadedCover} />
                    <TouchableOpacity 
                      style={styles.removeImage}
                      onPress={() => setFormData(p => ({ ...p, cover_image_url: '' }))}
                    >
                      <Ionicons name="close" size={16} color="#FFF" />
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Ionicons name="image-outline" size={32} color={THEME.textMuted} />
                    <Text style={styles.uploadText}>Upload Cover</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Active Status</Text>
              <View style={styles.statusRow}>
                <TouchableOpacity 
                  style={[styles.statusBtn, formData.is_active && styles.statusBtnActive]}
                  onPress={() => setFormData(p => ({ ...p, is_active: true }))}
                >
                  <Ionicons name="checkmark-circle" size={20} color={formData.is_active ? THEME.success : THEME.textMuted} />
                  <Text style={[styles.statusBtnText, formData.is_active && { color: THEME.success }]}>Active</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.statusBtn, !formData.is_active && styles.statusBtnInactive]}
                  onPress={() => setFormData(p => ({ ...p, is_active: false }))}
                >
                  <Ionicons name="pause-circle" size={20} color={!formData.is_active ? THEME.danger : THEME.textMuted} />
                  <Text style={[styles.statusBtnText, !formData.is_active && { color: THEME.danger }]}>Inactive</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Verification Status</Text>
              <View style={styles.verificationRow}>
                <TouchableOpacity 
                  style={[
                    styles.verificationBtn, 
                    formData.verification_status === 'pending' && { borderColor: THEME.warning, backgroundColor: THEME.warning + '15' }
                  ]}
                  onPress={() => setFormData(p => ({ ...p, verification_status: 'pending' }))}
                >
                  <Ionicons name="time-outline" size={18} color={formData.verification_status === 'pending' ? THEME.warning : THEME.textMuted} />
                  <Text style={[styles.verificationBtnText, formData.verification_status === 'pending' && { color: THEME.warning }]}>Pending</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[
                    styles.verificationBtn, 
                    formData.verification_status === 'verified' && { borderColor: THEME.success, backgroundColor: THEME.success + '15' }
                  ]}
                  onPress={() => setFormData(p => ({ ...p, verification_status: 'verified' }))}
                >
                  <Ionicons name="checkmark-circle" size={18} color={formData.verification_status === 'verified' ? THEME.success : THEME.textMuted} />
                  <Text style={[styles.verificationBtnText, formData.verification_status === 'verified' && { color: THEME.success }]}>Verified</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[
                    styles.verificationBtn, 
                    formData.verification_status === 'rejected' && { borderColor: THEME.danger, backgroundColor: THEME.danger + '15' }
                  ]}
                  onPress={() => setFormData(p => ({ ...p, verification_status: 'rejected' }))}
                >
                  <Ionicons name="close-circle" size={18} color={formData.verification_status === 'rejected' ? THEME.danger : THEME.textMuted} />
                  <Text style={[styles.verificationBtnText, formData.verification_status === 'rejected' && { color: THEME.danger }]}>Rejected</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      
      default:
        return null;
    }
  };

  // Render Shelter Card
  const renderShelterCard = ({ item }) => {
    const statusConfig = STATUS_CONFIG[item.verification_status] || STATUS_CONFIG.pending;
    const shelterType = SHELTER_TYPES.find(t => t.id === item.shelter_type);
    const logoImage = getShelterDisplayImage(item, 'logo');
    const coverImage = getShelterDisplayImage(item, 'cover');
    const capacityPercent = item.shelter_capacity > 0 
      ? Math.min(100, Math.round((item.current_count || 0) / item.shelter_capacity * 100)) 
      : 0;
    
    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => {
          setSelectedShelter(item);
          setShowDetailModal(true);
        }}
        activeOpacity={0.85}
      >
        {/* Cover Image Section */}
        <View style={styles.cardCoverSection}>
          {coverImage ? (
            <Image source={{ uri: coverImage }} style={styles.cardCoverImage} />
          ) : (
            <LinearGradient 
              colors={[shelterType?.color || THEME.primary, THEME.primaryDark]} 
              style={styles.cardCoverGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="home" size={28} color="rgba(255,255,255,0.25)" />
            </LinearGradient>
          )}
          
          {/* Status Badges */}
          <View style={styles.cardBadgesRow}>
            <View style={[styles.cardStatusBadge, { backgroundColor: item.is_active ? THEME.success : THEME.textMuted }]}>
              <View style={styles.cardStatusDot} />
              <Text style={styles.cardStatusText}>{item.is_active ? 'Active' : 'Inactive'}</Text>
            </View>
            <View style={[styles.cardVerifyBadge, { backgroundColor: statusConfig.bg }]}>
              <Ionicons name={statusConfig.icon} size={12} color={statusConfig.color} />
              <Text style={[styles.cardVerifyText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
            </View>
          </View>
        </View>

        {/* Main Content Section */}
        <View style={styles.cardContent}>
          {/* Header with Avatar and Info */}
          <View style={styles.cardHeader}>
            {/* Avatar */}
            <View style={styles.cardAvatarWrap}>
              {logoImage ? (
                <Image source={{ uri: logoImage }} style={styles.cardAvatar} />
              ) : (
                <View style={[styles.cardAvatar, styles.cardAvatarPlaceholder]}>
                  <Ionicons name="business" size={24} color={THEME.primary} />
                </View>
              )}
              {item.verification_status === 'verified' && (
                <View style={styles.cardVerifiedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={THEME.success} />
                </View>
              )}
            </View>
            
            {/* Shelter Info */}
            <View style={styles.cardInfoSection}>
              <View style={styles.cardNameRow}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                {shelterType && (
                  <View style={[styles.cardTypeTag, { backgroundColor: shelterType.color + '15' }]}>
                    <Ionicons name={shelterType.icon} size={10} color={shelterType.color} />
                    <Text style={[styles.cardTypeText, { color: shelterType.color }]}>{shelterType.label}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Stats Section */}
          <View style={styles.cardStatsRow}>
            <View style={styles.cardStatItem}>
              <View style={[styles.cardStatIcon, { backgroundColor: THEME.primary + '12' }]}>
                <Ionicons name="paw" size={16} color={THEME.primary} />
              </View>
              <View style={styles.cardStatTextWrap}>
                <Text style={styles.cardStatValue}>{item.current_count || 0}</Text>
                <Text style={styles.cardStatLabel}>ANIMALS</Text>
              </View>
            </View>
            
            <View style={styles.cardStatDivider} />
            
            <View style={styles.cardStatItem}>
              <View style={[styles.cardStatIcon, { backgroundColor: THEME.accent + '12' }]}>
                <Ionicons name="home" size={16} color={THEME.accent} />
              </View>
              <View style={styles.cardStatTextWrap}>
                <Text style={styles.cardStatValue}>{item.shelter_capacity || '-'}</Text>
                <Text style={styles.cardStatLabel}>CAPACITY</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Actions Footer */}
        <View style={styles.cardActionsBar}>
          <TouchableOpacity 
            style={styles.cardActionBtn} 
            onPress={(e) => { e.stopPropagation(); openEditModal(item); }}
          >
            <View style={[styles.cardActionIconWrap, { backgroundColor: THEME.primary + '12' }]}>
              <Ionicons name="create-outline" size={16} color={THEME.primary} />
            </View>
            <Text style={[styles.cardActionLabel, { color: THEME.primary }]}>Edit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.cardActionBtn} 
            onPress={(e) => { e.stopPropagation(); openPetsModal(item); }}
          >
            <View style={[styles.cardActionIconWrap, { backgroundColor: THEME.accent + '12' }]}>
              <Ionicons name="paw-outline" size={16} color={THEME.accent} />
            </View>
            <Text style={[styles.cardActionLabel, { color: THEME.accent }]}>Pets</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.cardActionBtn} 
            onPress={(e) => { e.stopPropagation(); toggleStatus(item); }}
          >
            <View style={[styles.cardActionIconWrap, { backgroundColor: THEME.warning + '12' }]}>
              <Ionicons name={item.is_active ? 'pause' : 'play'} size={16} color={THEME.warning} />
            </View>
            <Text style={[styles.cardActionLabel, { color: THEME.warning }]}>
              {item.is_active ? 'Pause' : 'Resume'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.cardActionBtn} 
            onPress={(e) => { e.stopPropagation(); handleDelete(item); }}
          >
            <View style={[styles.cardActionIconWrap, { backgroundColor: THEME.danger + '12' }]}>
              <Ionicons name="trash-outline" size={16} color={THEME.danger} />
            </View>
            <Text style={[styles.cardActionLabel, { color: THEME.danger }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.primary} />
      
      {/* Header */}
      <LinearGradient colors={[THEME.primary, THEME.primaryDark]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <Text style={styles.headerTitleText}>Shelter Management</Text>
            <Text style={styles.headerSubtitle}>{stats.total} shelters registered</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
            <Ionicons name="add" size={24} color={THEME.primary} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={THEME.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search shelters..."
            placeholderTextColor={THEME.textMuted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={THEME.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Stats */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statText}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: THEME.success }]}>{stats.verified}</Text>
          <Text style={styles.statText}>Verified</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: THEME.warning }]}>{stats.pending}</Text>
          <Text style={styles.statText}>Pending</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: THEME.primary }]}>{stats.active}</Text>
          <Text style={styles.statText}>Active</Text>
        </View>
      </View>

      {/* Shelter List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.primary} />
          <Text style={styles.loadingText}>Loading shelters...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredShelters}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={renderShelterCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchShelters();
              }}
              colors={[THEME.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="home-outline" size={64} color={THEME.textMuted} />
              <Text style={styles.emptyTitle}>No Shelters Found</Text>
              <Text style={styles.emptySubtitle}>Add a new shelter to get started</Text>
            </View>
          }
        />
      )}

      {/* Add/Edit Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <LinearGradient colors={[THEME.primary, THEME.primaryDark]} style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{editMode ? 'Edit Shelter' : 'Add Shelter'}</Text>
                <Text style={styles.modalSubtitle}>{formSteps[currentStep].title}</Text>
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </LinearGradient>

            {/* Step Indicator */}
            <View style={styles.stepIndicator}>
              {formSteps.map((step, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.stepItem}
                  onPress={() => setCurrentStep(index)}
                >
                  <View style={[
                    styles.stepCircle,
                    currentStep === index && styles.stepCircleActive,
                    currentStep > index && styles.stepCircleCompleted,
                  ]}>
                    {currentStep > index ? (
                      <Ionicons name="checkmark" size={14} color="#FFF" />
                    ) : (
                      <Ionicons name={step.icon} size={14} color={currentStep === index ? '#FFF' : THEME.textMuted} />
                    )}
                  </View>
                  <Text style={[
                    styles.stepLabel,
                    currentStep === index && styles.stepLabelActive
                  ]}>{step.title}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {renderStepContent()}
            </ScrollView>

            <View style={styles.modalFooter}>
              {currentStep > 0 && (
                <TouchableOpacity 
                  style={styles.prevButton}
                  onPress={() => setCurrentStep(p => p - 1)}
                >
                  <Text style={styles.prevButtonText}>Back</Text>
                </TouchableOpacity>
              )}
              {currentStep < formSteps.length - 1 ? (
                <TouchableOpacity 
                  style={styles.nextButton}
                  onPress={() => setCurrentStep(p => p + 1)}
                >
                  <LinearGradient colors={[THEME.primary, THEME.primaryDark]} style={styles.nextButtonGradient}>
                    <Text style={styles.nextButtonText}>Next</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFF" />
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.nextButton}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <LinearGradient colors={[THEME.success, '#16A34A']} style={styles.nextButtonGradient}>
                    {saving ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <>
                        <Text style={styles.nextButtonText}>{editMode ? 'Update' : 'Create'}</Text>
                        <Ionicons name="checkmark" size={18} color="#FFF" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.detailModalContainer]}>
            {selectedShelter && (
              <>
                {/* Hero Header Section */}
                <View style={styles.detailHeroSection}>
                  {getShelterDisplayImage(selectedShelter, 'cover') ? (
                    <Image source={{ uri: getShelterDisplayImage(selectedShelter, 'cover') }} style={styles.detailCoverImage} />
                  ) : (
                    <LinearGradient 
                      colors={[
                        SHELTER_TYPES.find(t => t.id === selectedShelter.shelter_type)?.color || THEME.primary, 
                        THEME.primaryDark
                      ]} 
                      style={styles.detailCoverGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Ionicons name="business" size={48} color="rgba(255,255,255,0.15)" />
                    </LinearGradient>
                  )}
                  
                  {/* Overlay Gradient */}
                  <LinearGradient 
                    colors={['transparent', 'rgba(0,0,0,0.7)']} 
                    style={styles.detailCoverOverlay}
                  />
                  
                  {/* Close Button */}
                  <TouchableOpacity style={styles.detailCloseBtn} onPress={() => setShowDetailModal(false)}>
                    <Ionicons name="close" size={22} color="#FFF" />
                  </TouchableOpacity>
                  
                  {/* Status Badges */}
                  <View style={styles.detailBadgesContainer}>
                    <View style={[
                      styles.detailStatusPill, 
                      { backgroundColor: selectedShelter.is_active ? THEME.success : THEME.textMuted }
                    ]}>
                      <View style={styles.detailStatusDot} />
                      <Text style={styles.detailStatusText}>
                        {selectedShelter.is_active ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                    <View style={[
                      styles.detailVerifyPill, 
                      { backgroundColor: STATUS_CONFIG[selectedShelter.verification_status]?.bg }
                    ]}>
                      <Ionicons 
                        name={STATUS_CONFIG[selectedShelter.verification_status]?.icon} 
                        size={14} 
                        color={STATUS_CONFIG[selectedShelter.verification_status]?.color} 
                      />
                      <Text style={[
                        styles.detailVerifyText, 
                        { color: STATUS_CONFIG[selectedShelter.verification_status]?.color }
                      ]}>
                        {STATUS_CONFIG[selectedShelter.verification_status]?.label}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Avatar & Title Section */}
                  <View style={styles.detailHeroContent}>
                    <View style={styles.detailAvatarFrame}>
                      {getShelterDisplayImage(selectedShelter, 'logo') ? (
                        <Image source={{ uri: getShelterDisplayImage(selectedShelter, 'logo') }} style={styles.detailAvatarImg} />
                      ) : (
                        <View style={[styles.detailAvatarImg, styles.detailAvatarFallback]}>
                          <Ionicons name="business" size={32} color={THEME.primary} />
                        </View>
                      )}
                      {selectedShelter.verification_status === 'verified' && (
                        <View style={styles.detailVerifiedIcon}>
                          <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                        </View>
                      )}
                    </View>
                    <View style={styles.detailHeroInfo}>
                      <Text style={styles.detailTitle} numberOfLines={2}>{selectedShelter.name}</Text>
                      {SHELTER_TYPES.find(t => t.id === selectedShelter.shelter_type) && (
                        <View style={styles.detailTypeRow}>
                          <Ionicons 
                            name={SHELTER_TYPES.find(t => t.id === selectedShelter.shelter_type)?.icon} 
                            size={12} 
                            color="rgba(255,255,255,0.9)" 
                          />
                          <Text style={styles.detailTypeText}>
                            {SHELTER_TYPES.find(t => t.id === selectedShelter.shelter_type)?.label} Shelter
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Stats Cards Row */}
                <View style={styles.detailStatsContainer}>
                  <TouchableOpacity 
                    style={styles.detailStatCard}
                    onPress={() => {
                      setShowDetailModal(false);
                      openPetsModal(selectedShelter);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.detailStatIconBg, { backgroundColor: THEME.primary + '15' }]}>
                      <Ionicons name="paw" size={20} color={THEME.primary} />
                    </View>
                    <Text style={styles.detailStatNumber}>{selectedShelter.current_count || 0}</Text>
                    <Text style={styles.detailStatDesc}>Animals</Text>
                    <View style={styles.detailStatLink}>
                      <Text style={styles.detailStatLinkText}>View All</Text>
                      <Ionicons name="chevron-forward" size={12} color={THEME.primary} />
                    </View>
                  </TouchableOpacity>
                  
                  <View style={styles.detailStatCard}>
                    <View style={[styles.detailStatIconBg, { backgroundColor: THEME.accent + '15' }]}>
                      <Ionicons name="home" size={20} color={THEME.accent} />
                    </View>
                    <Text style={styles.detailStatNumber}>{selectedShelter.shelter_capacity || '-'}</Text>
                    <Text style={styles.detailStatDesc}>Capacity</Text>
                    <View style={styles.detailCapacityMini}>
                      <View style={styles.detailCapacityTrack}>
                        <View style={[
                          styles.detailCapacityProgress,
                          { 
                            width: `${selectedShelter.shelter_capacity > 0 
                              ? Math.min(100, ((selectedShelter.current_count || 0) / selectedShelter.shelter_capacity) * 100) 
                              : 0}%` 
                          }
                        ]} />
                      </View>
                    </View>
                  </View>
                </View>

                <ScrollView 
                  style={styles.detailScrollContent} 
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.detailScrollInner}
                >
                  {/* Description Section */}
                  {selectedShelter.description && (
                    <View style={styles.detailInfoCard}>
                      <View style={styles.detailCardHeader}>
                        <Ionicons name="document-text" size={18} color={THEME.primary} />
                        <Text style={styles.detailCardTitle}>About</Text>
                      </View>
                      <Text style={styles.detailDescText}>{selectedShelter.description}</Text>
                    </View>
                  )}

                  {/* Contact Information Section */}
                  <View style={styles.detailInfoCard}>
                    <View style={styles.detailCardHeader}>
                      <Ionicons name="call" size={18} color={THEME.primary} />
                      <Text style={styles.detailCardTitle}>Contact Information</Text>
                    </View>
                    
                    <View style={styles.detailContactGrid}>
                      {/* Address */}
                      <View style={styles.detailContactItem}>
                        <View style={[styles.detailContactIcon, { backgroundColor: THEME.primary + '12' }]}>
                          <Ionicons name="location" size={16} color={THEME.primary} />
                        </View>
                        <View style={styles.detailContactInfo}>
                          <Text style={styles.detailContactLabel}>Address</Text>
                          <Text style={styles.detailContactValue}>{selectedShelter.address || 'Not provided'}</Text>
                        </View>
                      </View>
                      
                      {/* Contact Person */}
                      {selectedShelter.contact_person_name && (
                        <View style={styles.detailContactItem}>
                          <View style={[styles.detailContactIcon, { backgroundColor: THEME.accent + '12' }]}>
                            <Ionicons name="person" size={16} color={THEME.accent} />
                          </View>
                          <View style={styles.detailContactInfo}>
                            <Text style={styles.detailContactLabel}>Contact Person</Text>
                            <Text style={styles.detailContactValue}>{selectedShelter.contact_person_name}</Text>
                          </View>
                        </View>
                      )}
                      
                      {/* Phone */}
                      {selectedShelter.phone && (
                        <TouchableOpacity 
                          style={styles.detailContactItem}
                          onPress={() => Linking.openURL(`tel:${selectedShelter.phone}`)}
                        >
                          <View style={[styles.detailContactIcon, { backgroundColor: THEME.success + '12' }]}>
                            <Ionicons name="call" size={16} color={THEME.success} />
                          </View>
                          <View style={styles.detailContactInfo}>
                            <Text style={styles.detailContactLabel}>Phone</Text>
                            <Text style={[styles.detailContactValue, { color: THEME.primary }]}>{selectedShelter.phone}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={THEME.textMuted} />
                        </TouchableOpacity>
                      )}
                      
                      {/* Email */}
                      {selectedShelter.email && (
                        <TouchableOpacity 
                          style={styles.detailContactItem}
                          onPress={() => Linking.openURL(`mailto:${selectedShelter.email}`)}
                        >
                          <View style={[styles.detailContactIcon, { backgroundColor: '#6366F1' + '12' }]}>
                            <Ionicons name="mail" size={16} color="#6366F1" />
                          </View>
                          <View style={styles.detailContactInfo}>
                            <Text style={styles.detailContactLabel}>Email</Text>
                            <Text style={[styles.detailContactValue, { color: THEME.primary }]} numberOfLines={1}>
                              {selectedShelter.email}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={THEME.textMuted} />
                        </TouchableOpacity>
                      )}
                      
                      {/* Operating Hours */}
                      {selectedShelter.operating_hours && (
                        <View style={styles.detailContactItem}>
                          <View style={[styles.detailContactIcon, { backgroundColor: THEME.warning + '12' }]}>
                            <Ionicons name="time" size={16} color={THEME.warning} />
                          </View>
                          <View style={styles.detailContactInfo}>
                            <Text style={styles.detailContactLabel}>Operating Hours</Text>
                            <Text style={styles.detailContactValue}>{selectedShelter.operating_hours}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Animals Accepted Section */}
                  {selectedShelter.animals_accepted?.length > 0 && (
                    <View style={styles.detailInfoCard}>
                      <View style={styles.detailCardHeader}>
                        <Ionicons name="paw" size={18} color={THEME.primary} />
                        <Text style={styles.detailCardTitle}>Animals Accepted</Text>
                      </View>
                      <View style={styles.detailChipsWrap}>
                        {selectedShelter.animals_accepted.map(animal => {
                          const animalInfo = ANIMAL_TYPES.find(a => a.id === animal);
                          return (
                            <View key={animal} style={styles.detailAnimalChip}>
                              <Text style={styles.detailAnimalEmoji}>{animalInfo?.emoji || '🐾'}</Text>
                              <Text style={styles.detailAnimalText}>{animalInfo?.label || animal}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* Services Section */}
                  {selectedShelter.services_offered?.length > 0 && (
                    <View style={styles.detailInfoCard}>
                      <View style={styles.detailCardHeader}>
                        <Ionicons name="medical" size={18} color={THEME.primary} />
                        <Text style={styles.detailCardTitle}>Services Offered</Text>
                      </View>
                      <View style={styles.detailServicesGrid}>
                        {selectedShelter.services_offered.map(s => {
                          const serviceInfo = SERVICES.find(sv => sv.id === s);
                          return (
                            <View key={s} style={styles.detailServiceItem}>
                              <View style={styles.detailServiceIcon}>
                                <Ionicons name={serviceInfo?.icon || 'checkmark'} size={14} color={THEME.success} />
                              </View>
                              <Text style={styles.detailServiceLabel}>{serviceInfo?.label || s}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* Capacity & Usage Section */}
                  <View style={styles.detailInfoCard}>
                    <View style={styles.detailCardHeader}>
                      <Ionicons name="stats-chart" size={18} color={THEME.primary} />
                      <Text style={styles.detailCardTitle}>Capacity & Usage</Text>
                    </View>
                    <View style={styles.detailCapacitySection}>
                      <View style={styles.detailCapacityStats}>
                        <View style={styles.detailCapacityStat}>
                          <Text style={styles.detailCapacityNumber}>{selectedShelter.current_count || 0}</Text>
                          <Text style={styles.detailCapacityLabel}>Current Animals</Text>
                        </View>
                        <View style={styles.detailCapacityDivider} />
                        <View style={styles.detailCapacityStat}>
                          <Text style={styles.detailCapacityNumber}>{selectedShelter.shelter_capacity || 0}</Text>
                          <Text style={styles.detailCapacityLabel}>Total Capacity</Text>
                        </View>
                        <View style={styles.detailCapacityDivider} />
                        <View style={styles.detailCapacityStat}>
                          <Text style={[
                            styles.detailCapacityNumber,
                            { 
                              color: selectedShelter.shelter_capacity > 0 
                                ? (((selectedShelter.current_count || 0) / selectedShelter.shelter_capacity) * 100 > 80 
                                  ? THEME.danger 
                                  : ((selectedShelter.current_count || 0) / selectedShelter.shelter_capacity) * 100 > 50 
                                    ? THEME.warning 
                                    : THEME.success)
                                : THEME.textMuted
                            }
                          ]}>
                            {selectedShelter.shelter_capacity > 0 
                              ? Math.round(((selectedShelter.current_count || 0) / selectedShelter.shelter_capacity) * 100) 
                              : 0}%
                          </Text>
                          <Text style={styles.detailCapacityLabel}>Usage</Text>
                        </View>
                      </View>
                      <View style={styles.detailCapacityBarLarge}>
                        <View style={[
                          styles.detailCapacityFillLarge,
                          { 
                            width: `${selectedShelter.shelter_capacity > 0 
                              ? Math.min(100, ((selectedShelter.current_count || 0) / selectedShelter.shelter_capacity) * 100) 
                              : 0}%`,
                            backgroundColor: selectedShelter.shelter_capacity > 0 
                              ? (((selectedShelter.current_count || 0) / selectedShelter.shelter_capacity) * 100 > 80 
                                ? THEME.danger 
                                : ((selectedShelter.current_count || 0) / selectedShelter.shelter_capacity) * 100 > 50 
                                  ? THEME.warning 
                                  : THEME.success)
                              : THEME.textMuted
                          }
                        ]} />
                      </View>
                    </View>
                  </View>

                  {/* Location Coordinates Section */}
                  {(selectedShelter.latitude || selectedShelter.longitude) && (
                    <View style={styles.detailInfoCard}>
                      <View style={styles.detailCardHeader}>
                        <Ionicons name="navigate" size={18} color={THEME.primary} />
                        <Text style={styles.detailCardTitle}>Location Coordinates</Text>
                      </View>
                      <View style={styles.detailCoordsContainer}>
                        <View style={styles.detailCoordsRow}>
                          <View style={styles.detailCoordItem}>
                            <Text style={styles.detailCoordLabel}>Latitude</Text>
                            <Text style={styles.detailCoordValue}>{selectedShelter.latitude || 'N/A'}</Text>
                          </View>
                          <View style={styles.detailCoordItem}>
                            <Text style={styles.detailCoordLabel}>Longitude</Text>
                            <Text style={styles.detailCoordValue}>{selectedShelter.longitude || 'N/A'}</Text>
                          </View>
                        </View>
                        {selectedShelter.latitude && selectedShelter.longitude && (
                          <TouchableOpacity 
                            style={styles.detailMapButton}
                            onPress={() => {
                              const url = `https://www.google.com/maps?q=${selectedShelter.latitude},${selectedShelter.longitude}`;
                              Linking.openURL(url);
                            }}
                          >
                            <Ionicons name="map" size={16} color="#FFF" />
                            <Text style={styles.detailMapButtonText}>View on Google Maps</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Proof Document Section */}
                  {selectedShelter.proof_document_url && (
                    <View style={styles.detailInfoCard}>
                      <View style={styles.detailCardHeader}>
                        <Ionicons name="document-attach" size={18} color={THEME.primary} />
                        <Text style={styles.detailCardTitle}>Proof Document</Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.detailDocumentButton}
                        onPress={() => Linking.openURL(selectedShelter.proof_document_url)}
                      >
                        <View style={styles.detailDocumentIconWrap}>
                          <Ionicons name="document" size={24} color={THEME.primary} />
                        </View>
                        <View style={styles.detailDocumentInfo}>
                          <Text style={styles.detailDocumentTitle}>View Document</Text>
                          <Text style={styles.detailDocumentSubtitle}>Tap to open proof document</Text>
                        </View>
                        <Ionicons name="open-outline" size={20} color={THEME.primary} />
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>

                {/* Action Footer */}
                <View style={styles.detailActionsFooter}>
                  <TouchableOpacity 
                    style={[styles.detailActionButton, styles.detailActionPrimary]}
                    onPress={() => {
                      setShowDetailModal(false);
                      openEditModal(selectedShelter);
                    }}
                  >
                    <Ionicons name="create-outline" size={18} color="#FFF" />
                    <Text style={styles.detailActionPrimaryText}>Edit Shelter</Text>
                  </TouchableOpacity>
                  
                  {selectedShelter.verification_status === 'pending' && (
                    <TouchableOpacity 
                      style={[styles.detailActionButton, styles.detailActionSuccess]}
                      onPress={() => handleVerify('verified')}
                    >
                      <Ionicons name="checkmark-circle-outline" size={18} color={THEME.success} />
                      <Text style={[styles.detailActionSecondaryText, { color: THEME.success }]}>Verify</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity 
                    style={[styles.detailActionButton, styles.detailActionDanger]}
                    onPress={() => handleDelete(selectedShelter)}
                  >
                    <Ionicons name="trash-outline" size={18} color={THEME.danger} />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Map Modal */}
      <Modal visible={showMapModal} animationType="slide">
        <View style={styles.mapContainer}>
          <View style={styles.mapHeader}>
            <TouchableOpacity style={styles.mapClose} onPress={() => setShowMapModal(false)}>
              <Ionicons name="close" size={24} color={THEME.text} />
            </TouchableOpacity>
            <Text style={styles.mapTitle}>Select Location</Text>
            <View style={{ width: 40 }} />
          </View>
          <WebView
            ref={webViewRef}
            source={{ html: getMapHtml() }}
            style={{ flex: 1 }}
            onMessage={handleMapMessage}
            javaScriptEnabled
            domStorageEnabled
          />
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
                <Ionicons name="close" size={24} color={THEME.textSecondary} />
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
                color={timePickerType === 'open' ? THEME.accent : THEME.warning} 
              />
              <Text style={styles.timePickerPreviewText}>
                {formatTime(timePickerType === 'open' ? openTime : closeTime)}
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.timePickerConfirm}
              onPress={() => setShowTimePicker(false)}
            >
              <LinearGradient colors={[THEME.primary, THEME.primaryDark]} style={styles.timePickerConfirmGradient}>
                <Text style={styles.timePickerConfirmText}>Confirm</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Shelter Pets Modal */}
      <Modal visible={showPetsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: SCREEN_HEIGHT * 0.9 }]}>
            <LinearGradient colors={[THEME.primary, THEME.primaryDark]} style={styles.petsModalHeader}>
              <View style={styles.petsModalHeaderContent}>
                <View style={styles.petsModalIconWrap}>
                  <Ionicons name="paw" size={24} color="#FFF" />
                </View>
                <View style={styles.petsModalTitleWrap}>
                  <Text style={styles.petsModalTitle}>Shelter Pets</Text>
                  <Text style={styles.petsModalSubtitle} numberOfLines={1}>
                    {selectedShelter?.name || 'Loading...'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.petsModalClose} 
                onPress={() => setShowPetsModal(false)}
              >
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </LinearGradient>

            {/* Stats Bar */}
            <View style={styles.petsStatsBar}>
              <View style={styles.petsStat}>
                <Text style={styles.petsStatValue}>{shelterPets.length}</Text>
                <Text style={styles.petsStatLabel}>Total</Text>
              </View>
              <View style={styles.petsStatDivider} />
              <View style={styles.petsStat}>
                <Text style={[styles.petsStatValue, { color: THEME.success }]}>
                  {shelterPets.filter(p => p.status === 'available').length}
                </Text>
                <Text style={styles.petsStatLabel}>Available</Text>
              </View>
              <View style={styles.petsStatDivider} />
              <View style={styles.petsStat}>
                <Text style={[styles.petsStatValue, { color: THEME.warning }]}>
                  {shelterPets.filter(p => p.status === 'pending').length}
                </Text>
                <Text style={styles.petsStatLabel}>Pending</Text>
              </View>
              <View style={styles.petsStatDivider} />
              <View style={styles.petsStat}>
                <Text style={[styles.petsStatValue, { color: THEME.accent }]}>
                  {shelterPets.filter(p => p.status === 'adopted').length}
                </Text>
                <Text style={styles.petsStatLabel}>Adopted</Text>
              </View>
            </View>

            {loadingPets ? (
              <View style={styles.petsLoadingContainer}>
                <ActivityIndicator size="large" color={THEME.primary} />
                <Text style={styles.petsLoadingText}>Loading pets...</Text>
              </View>
            ) : shelterPets.length === 0 ? (
              <View style={styles.petsEmptyState}>
                <Ionicons name="paw-outline" size={64} color={THEME.textMuted} />
                <Text style={styles.petsEmptyTitle}>No Pets Found</Text>
                <Text style={styles.petsEmptySubtitle}>
                  This shelter doesn't have any pets registered yet
                </Text>
              </View>
            ) : (
              <FlatList
                data={shelterPets}
                keyExtractor={(item, index) => `${item.source_type || 'pet'}-${item.id?.toString() || index}`}
                contentContainerStyle={styles.petsList}
                showsVerticalScrollIndicator={false}
                renderItem={({ item: pet }) => {
                  const statusColors = {
                    available: { bg: THEME.success + '20', text: THEME.success },
                    pending: { bg: THEME.warning + '20', text: THEME.warning },
                    adopted: { bg: THEME.accent + '20', text: THEME.accent },
                    transferred: { bg: '#6366F1' + '20', text: '#6366F1' },
                  };
                  const statusColor = statusColors[pet.status] || statusColors.available;
                  
                  // Handle image - support both primary_image and images array (for transferred animals)
                  // Also handle case where images might be returned as PostgreSQL array string
                  let petImage = pet.primary_image;
                  if (!petImage && pet.images) {
                    if (Array.isArray(pet.images) && pet.images.length > 0) {
                      petImage = pet.images[0];
                    } else if (typeof pet.images === 'string' && pet.images.startsWith('{')) {
                      // Parse PostgreSQL array format: {item1,item2}
                      const parsed = pet.images.slice(1, -1).split(',').filter(Boolean);
                      petImage = parsed.length > 0 ? parsed[0] : null;
                    }
                  }
                  
                  // Check if this is a transferred rescue animal
                  const isTransferred = pet.source_type === 'rescue_transfer';
                  
                  return (
                    <View style={styles.petCard}>
                      {petImage ? (
                        <Image source={{ uri: petImage }} style={styles.petImage} />
                      ) : (
                        <View style={[styles.petImage, styles.petImagePlaceholder]}>
                          <Ionicons name="paw" size={24} color={THEME.textMuted} />
                        </View>
                      )}
                      <View style={styles.petInfo}>
                        <View style={styles.petNameRow}>
                          <Text style={styles.petName} numberOfLines={1}>{pet.name}</Text>
                          {pet.is_featured && (
                            <Ionicons name="star" size={14} color={THEME.warning} />
                          )}
                          {isTransferred && (
                            <View style={styles.transferredBadge}>
                              <Ionicons name="swap-horizontal" size={10} color="#6366F1" />
                            </View>
                          )}
                        </View>
                        <Text style={styles.petBreed} numberOfLines={1}>
                          {pet.breed || pet.species || 'Unknown breed'}
                        </Text>
                        <View style={styles.petMeta}>
                          {isTransferred && pet.transferred_by ? (
                            <View style={styles.petMetaItem}>
                              <Ionicons name="person-outline" size={12} color={THEME.textMuted} />
                              <Text style={styles.petMetaText}>By {pet.transferred_by}</Text>
                            </View>
                          ) : (
                            <>
                              <View style={styles.petMetaItem}>
                                <Ionicons name="calendar-outline" size={12} color={THEME.textMuted} />
                                <Text style={styles.petMetaText}>{pet.age_display || 'Unknown'}</Text>
                              </View>
                              <View style={styles.petMetaItem}>
                                <Ionicons 
                                  name={pet.gender === 'Male' ? 'male' : pet.gender === 'Female' ? 'female' : 'help-circle-outline'} 
                                  size={12} 
                                  color={pet.gender === 'Male' ? '#3B82F6' : pet.gender === 'Female' ? '#EC4899' : THEME.textMuted} 
                                />
                                <Text style={styles.petMetaText}>{pet.gender || 'Unknown'}</Text>
                              </View>
                            </>
                          )}
                        </View>
                      </View>
                      <View style={[styles.petStatus, { backgroundColor: statusColor.bg }]}>
                        <Text style={[styles.petStatusText, { color: statusColor.text }]}>
                          {isTransferred ? 'Rescued' : (pet.status?.charAt(0).toUpperCase() + pet.status?.slice(1) || 'Available')}
                        </Text>
                      </View>
                    </View>
                  );
                }}
              />
            )}

            <View style={styles.petsModalFooter}>
              <TouchableOpacity 
                style={styles.petsModalCloseBtn}
                onPress={() => setShowPetsModal(false)}
              >
                <Text style={styles.petsModalCloseBtnText}>Close</Text>
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
    backgroundColor: THEME.background,
  },
  
  // Header
  header: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 12 : 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitleText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: THEME.text,
  },
  
  // Stats
  statsBar: {
    flexDirection: 'row',
    backgroundColor: THEME.surface,
    marginHorizontal: 16,
    marginTop: -8,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.text,
  },
  statText: {
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 2,
  },
  
  // Filters
  filters: {
    maxHeight: 44,
    marginBottom: 12,
  },
  filtersContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  filterTextActive: {
    color: '#FFF',
  },
  
  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: THEME.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: THEME.textMuted,
    marginTop: 4,
  },
  
  // Card - Professional Redesign
  card: {
    backgroundColor: THEME.surface,
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
    overflow: 'hidden',
  },
  cardCoverSection: {
    height: 90,
    position: 'relative',
  },
  cardCoverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cardCoverGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBadgesRow: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 6,
  },
  cardStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  cardStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
  cardStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cardVerifyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  cardVerifyText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  cardAvatarWrap: {
    position: 'relative',
    marginRight: 14,
  },
  cardAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: THEME.surface,
  },
  cardAvatarPlaceholder: {
    backgroundColor: THEME.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.border,
  },
  cardVerifiedBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: THEME.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.border,
  },
  cardInfoSection: {
    flex: 1,
    justifyContent: 'center',
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.text,
    letterSpacing: -0.3,
  },
  cardTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  cardTypeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cardLocationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 4,
  },
  cardLocation: {
    fontSize: 12,
    color: THEME.textSecondary,
    flex: 1,
    lineHeight: 17,
  },
  cardContactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  cardContactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardContactText: {
    fontSize: 11,
    color: THEME.textMuted,
    maxWidth: 110,
  },
  cardStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surfaceAlt,
    borderRadius: 14,
    padding: 12,
  },
  cardStatItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardStatTextWrap: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  cardStatIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardStatValue: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.text,
  },
  cardStatLabel: {
    fontSize: 9,
    color: THEME.textMuted,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  cardStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: THEME.border,
    marginHorizontal: 10,
  },
  cardCapacityBlock: {
    flex: 1,
  },
  cardCapacityTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardCapacityPercent: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.text,
  },
  cardCapacityBar: {
    height: 6,
    backgroundColor: THEME.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  cardCapacityFill: {
    height: '100%',
    borderRadius: 3,
  },
  cardActionsBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    backgroundColor: THEME.surfaceAlt,
  },
  cardActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  cardActionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardActionLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: THEME.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.9,
  },
  // Detail Modal - Professional Redesign
  detailModalContainer: {
    maxHeight: SCREEN_HEIGHT * 0.92,
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  modalSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Step Indicator
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: THEME.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepCircleActive: {
    backgroundColor: THEME.primary,
  },
  stepCircleCompleted: {
    backgroundColor: THEME.success,
  },
  stepLabel: {
    fontSize: 11,
    color: THEME.textMuted,
    fontWeight: '500',
  },
  stepLabelActive: {
    color: THEME.primary,
    fontWeight: '700',
  },
  
  // Modal Body
  modalBody: {
    padding: 20,
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  stepContent: {},
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 20,
  },
  
  // Form
  formGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: THEME.text,
    marginLeft: 10,
  },
  multilineContainer: {
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  multilineInput: {
    textAlignVertical: 'top',
    minHeight: 44,
    paddingVertical: 0,
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
  inputIconWrap: {
    paddingTop: 2,
  },
  row: {
    flexDirection: 'row',
  },
  
  // Type Grid
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
    backgroundColor: THEME.surface,
    borderWidth: 1.5,
    borderColor: THEME.border,
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
    color: THEME.textSecondary,
  },
  
  // Map Button
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
  
  // Animals
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
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  animalChipActive: {
    backgroundColor: THEME.primary + '15',
    borderColor: THEME.primary,
  },
  animalEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  animalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  animalLabelActive: {
    color: THEME.primary,
  },
  
  // Services
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
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
    gap: 4,
  },
  serviceChipActive: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  serviceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  serviceLabelActive: {
    color: '#FFF',
  },
  
  // Image Upload
  imageUpload: {
    height: 120,
    borderRadius: 14,
    backgroundColor: THEME.surfaceAlt,
    borderWidth: 2,
    borderColor: THEME.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  coverUpload: {
    height: 140,
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  uploadedCover: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeImage: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadText: {
    fontSize: 13,
    color: THEME.textMuted,
    marginTop: 8,
  },
  
  // Status
  statusRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statusBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: THEME.surface,
    borderWidth: 1.5,
    borderColor: THEME.border,
    gap: 8,
  },
  statusBtnActive: {
    backgroundColor: THEME.success + '15',
    borderColor: THEME.success,
  },
  statusBtnInactive: {
    backgroundColor: THEME.danger + '15',
    borderColor: THEME.danger,
  },
  statusBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  
  // Verification Status
  verificationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  verificationBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: THEME.surface,
    borderWidth: 1.5,
    borderColor: THEME.border,
    gap: 6,
  },
  verificationBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  
  // Modal Footer
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    backgroundColor: THEME.surface,
  },
  prevButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: THEME.surfaceAlt,
  },
  prevButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.textSecondary,
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
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  
  // Detail Modal - Professional Redesign
  detailModalContainer: {
    maxHeight: SCREEN_HEIGHT * 0.92,
    flex: 1,
  },
  detailHeroSection: {
    height: 180,
    position: 'relative',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  detailCoverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  detailCoverGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailCoverOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%',
  },
  detailCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  detailBadgesContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  detailStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  detailStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
  detailStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  detailVerifyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  detailVerifyText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  detailHeroContent: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  detailAvatarFrame: {
    position: 'relative',
  },
  detailAvatarImg: {
    width: 68,
    height: 68,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#FFF',
    backgroundColor: THEME.surface,
  },
  detailAvatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.surfaceAlt,
  },
  detailVerifiedIcon: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.success,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  detailHeroInfo: {
    flex: 1,
    marginLeft: 14,
    paddingBottom: 4,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    letterSpacing: -0.3,
  },
  detailTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 5,
  },
  detailTypeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  detailStatsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
    backgroundColor: THEME.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  detailStatCard: {
    flex: 1,
    backgroundColor: THEME.surfaceAlt,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  detailStatIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailStatNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.text,
  },
  detailStatDesc: {
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  detailStatLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 2,
  },
  detailStatLinkText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.primary,
  },
  detailCapacityMini: {
    width: '100%',
    marginTop: 8,
  },
  detailCapacityTrack: {
    height: 4,
    backgroundColor: THEME.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  detailCapacityProgress: {
    height: '100%',
    backgroundColor: THEME.accent,
    borderRadius: 2,
  },
  detailScrollContent: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  detailScrollInner: {
    padding: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  detailInfoCard: {
    backgroundColor: THEME.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  detailCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  detailCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailDescText: {
    fontSize: 14,
    color: THEME.textSecondary,
    lineHeight: 22,
  },
  detailContactGrid: {
    gap: 2,
  },
  detailContactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  detailContactIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailContactInfo: {
    flex: 1,
  },
  detailContactLabel: {
    fontSize: 10,
    color: THEME.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailContactValue: {
    fontSize: 14,
    color: THEME.text,
    fontWeight: '500',
  },
  detailChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailAnimalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surfaceAlt,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  detailAnimalEmoji: {
    fontSize: 18,
  },
  detailAnimalText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.text,
  },
  detailServicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailServiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.success + '10',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  detailServiceIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: THEME.success + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailServiceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.success,
  },
  // Capacity & Usage Section Styles
  detailCapacitySection: {
    gap: 16,
  },
  detailCapacityStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  detailCapacityStat: {
    alignItems: 'center',
    flex: 1,
  },
  detailCapacityNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.text,
  },
  detailCapacityLabel: {
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailCapacityDivider: {
    width: 1,
    height: 40,
    backgroundColor: THEME.border,
  },
  detailCapacityBarLarge: {
    height: 10,
    backgroundColor: THEME.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  detailCapacityFillLarge: {
    height: '100%',
    borderRadius: 5,
  },
  // Location Coordinates Styles
  detailCoordsContainer: {
    gap: 12,
  },
  detailCoordsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  detailCoordItem: {
    flex: 1,
    backgroundColor: THEME.surfaceAlt,
    padding: 12,
    borderRadius: 10,
  },
  detailCoordLabel: {
    fontSize: 11,
    color: THEME.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailCoordValue: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.text,
  },
  detailMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  detailMapButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  // Proof Document Styles
  detailDocumentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surfaceAlt,
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  detailDocumentIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: THEME.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailDocumentInfo: {
    flex: 1,
  },
  detailDocumentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text,
  },
  detailDocumentSubtitle: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 2,
  },
  detailActionsFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    backgroundColor: THEME.surface,
  },
  detailActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  detailActionPrimary: {
    flex: 1,
    backgroundColor: THEME.primary,
  },
  detailActionPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  detailActionSuccess: {
    backgroundColor: THEME.success + '15',
    paddingHorizontal: 20,
  },
  detailActionDanger: {
    backgroundColor: THEME.danger + '15',
    paddingHorizontal: 16,
  },
  detailActionSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Map
  mapContainer: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 12 : 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: THEME.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  mapClose: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: THEME.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.text,
  },

  // Operating Hours - Days Picker
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
    backgroundColor: THEME.surface,
    borderWidth: 1.5,
    borderColor: THEME.border,
    minWidth: 44,
    alignItems: 'center',
  },
  dayChipActive: {
    backgroundColor: THEME.primary + '15',
    borderColor: THEME.primary,
  },
  dayChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  dayChipTextActive: {
    color: THEME.primary,
    fontWeight: '700',
  },

  // Quick Select Buttons
  quickSelectRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickSelectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: THEME.surfaceAlt,
  },
  quickSelectText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.textMuted,
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
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  timePickerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: THEME.accent + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  timePickerInfo: {
    flex: 1,
  },
  timePickerLabel: {
    fontSize: 11,
    color: THEME.textMuted,
    marginBottom: 2,
  },
  timePickerValue: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.text,
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
    backgroundColor: THEME.primary + '10',
    gap: 8,
  },
  hoursPreviewText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.primary,
    flex: 1,
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
    backgroundColor: THEME.surface,
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
    borderBottomColor: THEME.border,
  },
  timePickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.text,
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
    color: THEME.textMuted,
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
    backgroundColor: THEME.primary,
  },
  timeOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.textSecondary,
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
    backgroundColor: THEME.surfaceAlt,
    gap: 10,
  },
  timePickerPreviewText: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.text,
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

  // Shelter Pets Modal
  petsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  petsModalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  petsModalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  petsModalTitleWrap: {
    flex: 1,
  },
  petsModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  petsModalSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  petsModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  petsStatsBar: {
    flexDirection: 'row',
    backgroundColor: THEME.surface,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  petsStat: {
    flex: 1,
    alignItems: 'center',
  },
  petsStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.text,
  },
  petsStatLabel: {
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 2,
  },
  petsStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: THEME.border,
    alignSelf: 'center',
  },
  petsLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  petsLoadingText: {
    marginTop: 12,
    color: THEME.textSecondary,
  },
  petsEmptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  petsEmptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.text,
    marginTop: 16,
  },
  petsEmptySubtitle: {
    fontSize: 14,
    color: THEME.textMuted,
    textAlign: 'center',
    marginTop: 6,
  },
  petsList: {
    padding: 16,
  },
  petCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  petImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: THEME.surfaceAlt,
  },
  petImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  petInfo: {
    flex: 1,
    marginLeft: 12,
  },
  petNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  petName: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.text,
    flex: 1,
  },
  transferredBadge: {
    backgroundColor: '#6366F1' + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  petBreed: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  petMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 12,
  },
  petMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  petMetaText: {
    fontSize: 11,
    color: THEME.textMuted,
  },
  petStatus: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  petStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  petsModalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    backgroundColor: THEME.surface,
  },
  petsModalCloseBtn: {
    backgroundColor: THEME.surfaceAlt,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  petsModalCloseBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
});

export default memo(AdminSheltersScreen);
