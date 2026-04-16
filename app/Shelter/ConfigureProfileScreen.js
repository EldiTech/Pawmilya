import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { WebView } from 'react-native-webview';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { normalizeImageUrl } from '../../utils/imageUrl';

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
export default function ConfigureProfileScreen({ onBack }) {
  const { user } = useAuth();
  const [image, setImage] = useState(user?.shelter?.image ? normalizeImageUrl(user.shelter.image) : null);
  const [mapReady, setMapReady] = useState(false);
  const webViewRef = useRef(null);

  const [formData, setFormData] = useState({
    name: user?.shelter?.name || '',
    shelterType: user?.shelter?.shelterType || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.shelter?.address || '',
    city: user?.shelter?.city || '',
    website: user?.shelter?.website || '',
    bio: user?.shelter?.bio || '',
    latitude: user?.shelter?.latitude || 14.5995,
    longitude: user?.shelter?.longitude || 120.9842,
    servicesOffered: user?.shelter?.servicesOffered || [],
    animalTypes: user?.shelter?.animalTypes || [],
  });

  const AVAILABLE_SERVICES = ['Grooming', 'Boarding', 'Adoptions', 'Medical Care', 'Training', 'Rescue', 'Fostering'];
  const AVAILABLE_ANIMALS = ['Dogs', 'Cats'];
  const AVAILABLE_SHELTER_TYPES = ['Public Shelter', 'Private Shelter', 'Rescue Organization', 'Sanctuary', 'Foster-Based'];

  const toggleSelection = (field, item) => {
    setFormData((prev) => {
      const list = prev[field] || [];
      if (list.includes(item)) {
        return { ...prev, [field]: list.filter((i) => i !== item) };
      }
      return { ...prev, [field]: [...list, item] };
    });
  };

  useEffect(() => {
    (async () => {
      try {
        const { shelterService } = require('../../services');
        const shelterResponse = await shelterService.getManagedShelter();
        const shelterData = shelterResponse?.success ? shelterResponse.data : null;

        if (!shelterData) {
          throw new Error(shelterResponse?.error || 'Unable to load shelter profile');
        }
        
        if (shelterData.image) setImage(normalizeImageUrl(shelterData.image));

        setFormData(prev => ({
          ...prev,
          name: shelterData.name || '',
          shelterType: shelterData.shelterType || '',
          email: shelterData.email || user?.email || '',
          phone: shelterData.phone || user?.phone || '',
          address: shelterData.address || '',
          city: shelterData.city || '',
          website: shelterData.website || '',
          bio: shelterData.bio || '',
          latitude: shelterData.latitude || 14.5995,
          longitude: shelterData.longitude || 120.9842,
          servicesOffered: shelterData.servicesOffered || [],
          animalTypes: shelterData.animalTypes || [],
        }));

        if (!shelterData.latitude) {
          let { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            let location = await Location.getCurrentPositionAsync({});
            setFormData(prev => ({
              ...prev,
              latitude: location.coords.latitude,
              longitude: location.coords.longitude
            }));
          }
        }
      } catch(e) {
        console.log('Error fetching shelter profile data', e);
      } finally {
        setMapReady(true);
      }
    })();
  }, []);

  const handleMapMessage = (event) => {
    try {
      const { lat, lng, address } = JSON.parse(event.nativeEvent.data);
      if (lat && lng) {
        setFormData(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          ...(address ? {
            address: address,
            city: address.split(',').length > 1 ? address.split(',')[address.split(',').length - 2].trim() : prev.city
          } : {})
        }));
      }
    } catch (e) {
      console.log('Error parsing map message', e);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    try {
      // Show loading indicator or simple try block
      const updateData = { ...formData };
      if (image) {
        updateData.image = image;
      }
      
      const { shelterService } = require('../../services');
      const response = await shelterService.updateManagedShelter(updateData);
      if (!response?.success) {
        throw new Error(response?.error || 'Failed to update shelter profile');
      }
      
      Alert.alert('Success', 'Profile information updated successfully!');
      onBack(); // navigate back after saving
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile information.');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : null}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configure Profile</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content} 
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Picture Section */}
        <View style={styles.imageSection}>
          <TouchableOpacity onPress={pickImage} style={styles.imageContainer} activeOpacity={0.8}>
            {image ? (
              <Image source={{ uri: image }} style={styles.profileImage} />
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons name="business" size={40} color={COLORS.textMedium} />
              </View>
            )}
            <View style={styles.editIconContainer}>
              <Ionicons name="camera" size={16} color={COLORS.backgroundWhite} />
            </View>
          </TouchableOpacity>
          <Text style={styles.imageHelpText}>Tap to change picture</Text>
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Shelter Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Happy Paws"
              placeholderTextColor={COLORS.textLight}
              value={formData.name}
              onChangeText={(text) => handleInputChange('name', text)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Shelter Type</Text>
            <View style={styles.chipContainer}>
              {AVAILABLE_SHELTER_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.chip, formData.shelterType === type && styles.chipActive]}
                  onPress={() => handleInputChange('shelterType', type)}
                >
                  <Text style={[styles.chipText, formData.shelterType === type && styles.chipActiveText]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="shelter@example.com"
              placeholderTextColor={COLORS.textLight}
              keyboardType="email-address"
              value={formData.email}
              autoCapitalize="none"
              onChangeText={(text) => handleInputChange('email', text)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter contact number"
              placeholderTextColor={COLORS.textLight}
              keyboardType="phone-pad"
              value={formData.phone}
              onChangeText={(text) => handleInputChange('phone', text)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location Details</Text>
            {formData.address ? (
              <Text style={{ marginBottom: 8, fontSize: FONTS.sizes.sm, color: COLORS.textMedium }}>
                Current: {formData.address}
              </Text>
            ) : null}
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

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Website (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="https://..."
              placeholderTextColor={COLORS.textLight}
              keyboardType="url"
              autoCapitalize="none"
              value={formData.website}
              onChangeText={(text) => handleInputChange('website', text)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Shelter Bio / About</Text>
            <TextInput
              style={[styles.input, styles.textArea, { minHeight: 100 }]}
              placeholder="Tell us about your shelter, your mission, and the animals you rescue..."
              placeholderTextColor={COLORS.textLight}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={formData.bio}
              onChangeText={(text) => handleInputChange('bio', text)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Services Offered</Text>
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
            <Text style={styles.label}>Accepted Pets</Text>
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
        
        {/* Extra spacing at bottom for scroll safety */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundWhite,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.backgroundWhite,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  saveButton: {
    padding: SPACING.xs,
  },
  saveText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
  },
  content: {
    padding: SPACING.xl,
  },
  imageSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: COLORS.brown,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.backgroundWhite,
  },
  imageHelpText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: SPACING.md,
  },
  formSection: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.backgroundLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: Platform.OS === 'ios' ? SPACING.md : 10,
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.backgroundLight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textDark,
  },
  chipActiveText: {
    color: COLORS.backgroundWhite,
    fontWeight: FONTS.weights.semiBold,
  },
  mapContainer: {
    height: 400,
    borderRadius: RADIUS.md,
    marginTop: SPACING.xs,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  map: { flex: 1 },
  mapPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.backgroundLight },
  mapOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'none'
  },
  mapInstruction: { fontSize: FONTS.sizes.xs, color: COLORS.textDark, fontWeight: FONTS.weights.semiBold, backgroundColor: 'rgba(255,255,255,0.7)', padding: 4, borderRadius: 4 },
});
