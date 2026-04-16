import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY_HERE';

const getGoogleMapHtml = (apiKey) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    body { padding: 0; margin: 0; font-family: sans-serif; }
    #map { height: 100vh; width: 100vw; }
    .center-marker {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -100%);
      z-index: 1000;
      pointer-events: none;
    }
    .custom-search-container {
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      width: 90%;
      max-width: 400px;
      z-index: 1001; /* Above map */
    }
    #pac-input {
      background-color: #fff;
      font-family: inherit;
      font-size: 15px;
      font-weight: 400;
      padding: 0 11px 0 13px;
      text-overflow: ellipsis;
      width: 100%;
      height: 44px;
      border-radius: 8px;
      border: 1px solid transparent;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
      outline: none;
      box-sizing: border-box;
    }
    #pac-input:focus { border-color: #FF4B4B; }
    /* Hide some default google maps ui for cleaner look */
    .gmnoprint { display: none !important; }
  </style>
  <script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places"></script>
</head>
<body>
  <div class="custom-search-container">
    <input id="pac-input" type="text" placeholder="Search for location..." />
  </div>
  <div id="map"></div>
  <svg class="center-marker" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FF4B4B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3"></circle>
  </svg>
  <script>
    let map;
    let geocoder;
    function initMap(lat, lng) {
      const gLat = parseFloat(lat);
      const gLng = parseFloat(lng);
      
      map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: gLat, lng: gLng },
        zoom: 18,
        disableDefaultUI: true,
        zoomControl: false,
        gestureHandling: 'greedy',
        mapTypeId: 'hybrid',
        tilt: 45
      });

      geocoder = new google.maps.Geocoder();

      const input = document.getElementById('pac-input');
      const autocomplete = new google.maps.places.Autocomplete(input);
      autocomplete.bindTo('bounds', map);

      autocomplete.addListener('place_changed', function() {
        const place = autocomplete.getPlace();
        if (!place.geometry || !place.geometry.location) {
          return;
        }
        if (place.geometry.viewport) {
          map.fitBounds(place.geometry.viewport);
        } else {
          map.setCenter(place.geometry.location);
          map.setZoom(18);
          map.setTilt(45);
        }
        
        let formattedAddress = place.formatted_address || '';
        window.ReactNativeWebView.postMessage(JSON.stringify({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          address: formattedAddress
        }));
      });

      // Post back to React Native when dragging stops
      map.addListener('dragend', function() {
        const center = map.getCenter();
        const lat = center.lat();
        const lng = center.lng();
        
        geocoder.geocode({ location: { lat, lng } }, function(results, status) {
          let address = '';
          if (status === 'OK' && results[0]) {
            address = results[0].formatted_address;
            input.value = address;
          }
          window.ReactNativeWebView.postMessage(JSON.stringify({
            lat: lat,
            lng: lng,
            address: address
          }));
        });
      });
    }
  </script>
</body>
</html>
`;

const UserShelterApplicationScreen = ({ onBack }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const totalSteps = 4;
  const webViewRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    shelterType: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    latitude: 14.5995,  // default to MNL
    longitude: 120.9842,
    servicesOffered: [],
    animalTypes: [],
    description: '',
    capacity: '',
    website: '',
  });

  const AVAILABLE_SERVICES = ['Grooming', 'Boarding', 'Adoptions', 'Medical Care', 'Training', 'Rescue', 'Fostering'];
  const AVAILABLE_ANIMALS = ['Dogs', 'Cats'];
  const AVAILABLE_SHELTER_TYPES = ['Public Shelter', 'Private Shelter', 'Rescue Organization', 'Sanctuary', 'Foster-Based'];

  const toggleSelection = (field, item) => {
    setFormData((prev) => {
      const list = prev[field];
      if (list.includes(item)) {
        return { ...prev, [field]: list.filter((i) => i !== item) };
      }
      return { ...prev, [field]: [...list, item] };
    });
  };

  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (user) {
      const fallbackPhone = user.phone_number || user.phone || user.phoneNumber || '';
      setFormData(prev => ({
        ...prev,
        email: user.email || prev.email,
        phone: prev.phone || fallbackPhone,
      }));
    }
  }, [user]);

  useEffect(() => {
    if (step === 2 && !mapReady) {
      (async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          let location = await Location.getCurrentPositionAsync({});
          setFormData(prev => ({
            ...prev,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          }));
        }
        setMapReady(true);
      })();
    }
  }, [step]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleMapMessage = (event) => {
    try {
      const { lat, lng, address } = JSON.parse(event.nativeEvent.data);
      setFormData(prev => ({ 
        ...prev, 
        latitude: lat, 
        longitude: lng,
        ...(address ? { address } : {})
      }));
    } catch (e) {
      console.log('Error parsing map message', e);
    }
  };

  const nextStep = () => {
    if (step === 1 && (!formData.name || !formData.shelterType || !formData.email || !formData.phone)) {
      Alert.alert('Error', 'Please fill in all basic information, including shelter type');
      return;
    }
    if (step === 3 && (formData.servicesOffered.length === 0 || formData.animalTypes.length === 0)) {
      Alert.alert('Error', 'Please select at least one service and one animal type');
      return;
    }
    setStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const prevStep = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!formData.description || !formData.capacity) {
      Alert.alert('Error', 'Please fill in description and capacity');
      return;
    }

    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not authenticated');

      const applicationsRef = collection(db, 'shelter_applications');
      const q = query(applicationsRef, where('user_id', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        Alert.alert('Error', 'You have already submitted a shelter application.');
        setLoading(false);
        return;
      }

      const appData = {
        ...formData,
        user_id: currentUser.uid,
        status: 'pending',
        created_at: serverTimestamp(),
      };

      await addDoc(collection(db, 'shelter_applications'), appData);

      Alert.alert('Success', 'Shelter application submitted successfully!', [
        { text: 'OK', onPress: onBack },
      ]);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicatorContainer}>
      {[1, 2, 3, 4].map((s) => (
        <View key={s} style={styles.stepWrapper}>
          <View style={[styles.stepCircle, step >= s && styles.activeStepCircle]}>
            <Text style={[styles.stepText, step >= s && styles.activeStepText]}>{s}</Text>
          </View>
          {s < totalSteps && (
            <View style={[styles.stepLine, step > s && styles.activeStepLine, { width: SCREEN_WIDTH / 8 }]} />
          )}
        </View>
      ))}
    </View>
  );

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Basic Information</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Shelter Name *</Text>
              <TextInput style={styles.input} value={formData.name} onChangeText={(val) => handleChange('name', val)} placeholder="Enter shelter name" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Shelter Type *</Text>
              <View style={styles.chipContainer}>
                {AVAILABLE_SHELTER_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.chip, formData.shelterType === type && styles.chipActive]}
                    onPress={() => handleChange('shelterType', type)}
                  >
                    <Text style={[styles.chipText, formData.shelterType === type && styles.chipActiveText]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address * (Auto-filled)</Text>
              <TextInput style={styles.input} value={formData.email} onChangeText={(val) => handleChange('email', val)} placeholder="Enter contact email" keyboardType="email-address" autoCapitalize="none" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number * (Auto-filled)</Text>
              <TextInput style={styles.input} value={formData.phone} onChangeText={(val) => handleChange('phone', val)} placeholder="Enter contact phone number" keyboardType="phone-pad" />
            </View>
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Location Details</Text>
            <View style={styles.mapContainer}>
              {mapReady ? (
                <WebView
                  ref={webViewRef}
                  source={{ html: getGoogleMapHtml(GOOGLE_MAPS_API_KEY) }}
                  injectedJavaScript={`initMap(${formData.latitude}, ${formData.longitude}); true;`}
                  style={styles.map}
                  onMessage={handleMapMessage}
                  scrollEnabled={false}
                />
              ) : (
                <View style={styles.mapPlaceholder}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={{ marginTop: 8, color: COLORS.textMedium }}>Loading Map...</Text>
                </View>
              )}
              <View style={styles.mapOverlay}>
                <Text style={styles.mapInstruction}>Drag map to adjust location pin</Text>
              </View>
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Services & Animals</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Services Offered *</Text>
              <View style={styles.chipContainer}>
                {AVAILABLE_SERVICES.map((service) => (
                  <TouchableOpacity
                    key={service}
                    style={[styles.chip, formData.servicesOffered.includes(service) && styles.chipActive]}
                    onPress={() => toggleSelection('servicesOffered', service)}
                  >
                    <Text style={[styles.chipText, formData.servicesOffered.includes(service) && styles.chipActiveText]}>
                      {service}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Kinds of Animals for Adoption *</Text>
              <View style={styles.chipContainer}>
                {AVAILABLE_ANIMALS.map((animal) => (
                  <TouchableOpacity
                    key={animal}
                    style={[styles.chip, formData.animalTypes.includes(animal) && styles.chipActive]}
                    onPress={() => toggleSelection('animalTypes', animal)}
                  >
                    <Text style={[styles.chipText, formData.animalTypes.includes(animal) && styles.chipActiveText]}>
                      {animal}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        );
      case 4:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Additional Details</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description *</Text>
              <TextInput style={[styles.input, styles.textArea]} value={formData.description} onChangeText={(val) => handleChange('description', val)} placeholder="Tell us more about the shelter..." multiline numberOfLines={4} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Maximum Capacity *</Text>
              <TextInput style={styles.input} value={formData.capacity} onChangeText={(val) => handleChange('capacity', val)} placeholder="e.g., 50" keyboardType="numeric" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Website (Optional)</Text>
              <TextInput style={styles.input} value={formData.website} onChangeText={(val) => handleChange('website', val)} placeholder="https://..." keyboardType="url" autoCapitalize="none" />
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Register Shelter</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {renderStepIndicator()}
        <View style={styles.formContainer}>{renderStepContent()}</View>

        <View style={styles.footer}>
          {step > 1 && (
            <TouchableOpacity style={styles.prevButton} onPress={prevStep}>
              <Text style={styles.prevButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          {step < totalSteps ? (
            <TouchableOpacity style={styles.nextButton} onPress={nextStep}>
              <Text style={styles.nextButtonText}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={COLORS.backgroundWhite} />
              ) : (
                <Text style={styles.nextButtonText}>Submit Application</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    backgroundColor: COLORS.backgroundWhite,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  headerTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.textDark },
  backButton: { padding: SPACING.sm },
  scrollContent: { padding: SPACING.lg },
  stepIndicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  stepWrapper: { flexDirection: 'row', alignItems: 'center' },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeStepCircle: { backgroundColor: COLORS.primary },
  stepText: { color: COLORS.textMedium, fontWeight: FONTS.weights.bold, fontSize: FONTS.sizes.sm },
  activeStepText: { color: COLORS.textWhite },
  stepLine: { height: 2, backgroundColor: COLORS.borderLight, marginHorizontal: 4 },
  activeStepLine: { backgroundColor: COLORS.primary },
  formContainer: { backgroundColor: COLORS.backgroundWhite, borderRadius: RADIUS.lg, padding: SPACING.lg },
  stepTitle: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textDark, marginBottom: SPACING.lg },
  inputGroup: { marginBottom: SPACING.md },
  label: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.medium, color: COLORS.textDark, marginBottom: SPACING.xs },
  input: {
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONTS.sizes.md,
  },
  textArea: { height: 90, textAlignVertical: 'top' },

  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  chip: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.backgroundWhite,
    marginBottom: SPACING.sm, // fallback for older react-native versions lacking gap
  },
  chipActive: {
    backgroundColor: COLORS.primary,
  },
  chipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: FONTS.weights.medium,
  },
  chipActiveText: {
    color: COLORS.textWhite,
  },
  
  mapContainer: {
    height: 400,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.lg,
    position: 'relative',
  },
  map: { flex: 1 },
  mapPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  mapOverlay: {
    position: 'absolute',
    bottom: 10,
    left: '10%',
    right: '10%',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    pointerEvents: 'none'
  },
  mapInstruction: { fontSize: FONTS.sizes.xs, color: COLORS.textDark, fontWeight: FONTS.weights.semiBold },

  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.xl },
  prevButton: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginRight: SPACING.sm,
    alignItems: 'center',
  },
  prevButtonText: { color: COLORS.primary, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold },
  nextButton: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    marginLeft: SPACING.sm,
    alignItems: 'center',
  },
  submitButton: {
    flex: 2,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  nextButtonText: { color: COLORS.textWhite, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold },
});

export default UserShelterApplicationScreen;
