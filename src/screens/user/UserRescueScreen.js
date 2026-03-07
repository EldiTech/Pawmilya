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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { rescueService, userService } from '../../services';
import CONFIG from '../../config/config';
import UserRescuerDashboardScreen from './UserRescuerDashboardScreen';
import { getImageUrl as sharedGetImageUrl, withCacheBusting } from './shared';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Use shared getImageUrl utility
const getImageUrl = sharedGetImageUrl;

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

const UserRescueScreen = ({ onNavigateToRescuerRegistration, onNavigateToReportRescue, onGoBack }) => {
  const { user } = useAuth();
  const [rescueReports, setRescueReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isRescuer, setIsRescuer] = useState(false);
  const [checkingRescuerStatus, setCheckingRescuerStatus] = useState(true);
  const [userName, setUserName] = useState('User');
  const [rescuerTab, setRescuerTab] = useState('dashboard'); // 'dashboard' or 'map'
  const webViewRef = useRef(null);

  // Sync username immediately when user context changes
  useEffect(() => {
    if (user?.full_name) {
      setUserName(user.full_name);
    } else if (user?.name) {
      setUserName(user.name);
    }
  }, [user?.full_name, user?.name]);

  // Fetch rescue reports on mount (public data)
  useEffect(() => {
    fetchRescueReports();
    // Also fetch user profile on mount if authenticated
    fetchUserProfile();
  }, []);

  // Fetch user-specific data when user is available
  useEffect(() => {
    if (user?.id) {
      // Fetch profile from API for most up-to-date data
      fetchUserProfile();
      checkRescuerStatus();
    } else {
      // User not loaded yet or logged out, reset states
      setCheckingRescuerStatus(false);
      setIsRescuer(false);
    }
  }, [user?.id]);

  const fetchUserProfile = async () => {
    try {
      const profileResponse = await userService.getProfile();
      if (profileResponse.success && profileResponse.data) {
        setUserName(profileResponse.data.full_name || 'User');
      } else if (profileResponse.data) {
        setUserName(profileResponse.data.full_name || 'User');
      }
    } catch (error) {
      // Silently fail - user might not be logged in yet
    }
  };

  const checkRescuerStatus = async () => {
    if (!user?.id) {
      setIsRescuer(false);
      setCheckingRescuerStatus(false);
      return;
    }

    try {
      setCheckingRescuerStatus(true);
      
      // Get auth token from AsyncStorage
      const token = await AsyncStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      
      const response = await fetch(
        withCacheBusting(`${CONFIG.API_URL}/rescuer-applications/my-application`),
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
      
      if (data.hasApplication && data.application?.status === 'approved') {
        setIsRescuer(true);
      } else if (user?.role === 'rescuer') {
        setIsRescuer(true);
      } else {
        setIsRescuer(false);
      }
    } catch (error) {
      // Silently ignore errors
      setIsRescuer(false);
    } finally {
      setCheckingRescuerStatus(false);
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
    await Promise.all([fetchUserProfile(), checkRescuerStatus(), fetchRescueReports()]);
    setRefreshing(false);
  }, []);

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

  const handleRespondToRescue = useCallback((report) => {
    Alert.alert(
      'Respond to Rescue',
      `Do you want to respond to this rescue report: "${report.title || `Report #${report.id}`}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Respond', 
          onPress: () => {
            Alert.alert('Response Sent', 'The reporter will be notified that you are on your way!');
          } 
        },
      ]
    );
  }, []);

  const getStatusColor = useCallback((status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
      case 'new':
        return COLORS.warning;
      case 'in_progress':
      case 'in progress':
        return COLORS.primary;
      case 'resolved':
      case 'completed':
      case 'rescued':
        return COLORS.success;
      case 'cancelled':
        return COLORS.error;
      default:
        return COLORS.textMedium;
    }
  }, []);

  const getUrgencyColor = useCallback((urgency) => {
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
  }, []);

  // Handle WebView messages
  const handleWebViewMessage = useCallback((event) => {
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
  }, [rescueReports, handleRespondToRescue]);

  // Send rescue data to map
  const sendRescuesToMap = useCallback(() => {
    if (webViewRef.current && rescueReports.length > 0) {
      const activeRescues = rescueReports.filter(r => r.status !== 'resolved' && r.status !== 'rescued');
      webViewRef.current.postMessage(JSON.stringify({
        type: 'rescues',
        rescues: activeRescues
      }));
    }
  }, [rescueReports]);

  // Rescuer View - Rescue Report Card
  const renderRescuerReportCard = (report) => (
    <TouchableOpacity 
      key={report.id} 
      style={styles.rescuerReportCard} 
      activeOpacity={0.8}
      onPress={() => handleRespondToRescue(report)}
    >
      <View style={styles.reportHeader}>
        <View style={styles.urgencyBadge}>
          <View style={[styles.urgencyDot, { backgroundColor: getUrgencyColor(report.urgency || 'medium') }]} />
          <Text style={[styles.urgencyText, { color: getUrgencyColor(report.urgency || 'medium') }]}>
            {(report.urgency || 'Medium').toUpperCase()}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(report.status) }]}>
            {report.status?.replace('_', ' ') || 'New'}
          </Text>
        </View>
      </View>
      
      <View style={styles.reportBody}>
        {report.image && (
          <Image source={{ uri: getImageUrl(report.image) }} style={styles.reportImage} />
        )}
        <View style={styles.reportDetails}>
          <Text style={styles.reportTitle} numberOfLines={2}>
            {report.title || report.description?.substring(0, 50) || `Rescue Report #${report.id}`}
          </Text>
          <View style={styles.reportMeta}>
            <Ionicons name="location" size={14} color={COLORS.textMedium} />
            <Text style={styles.reportMetaText} numberOfLines={1}>
              {report.location || 'Location not specified'}
            </Text>
          </View>
          <View style={styles.reportMeta}>
            <Ionicons name="time" size={14} color={COLORS.textMedium} />
            <Text style={styles.reportMetaText}>
              {report.created_at ? new Date(report.created_at).toLocaleString() : 'Just now'}
            </Text>
          </View>
        </View>
      </View>
      
      <TouchableOpacity style={styles.respondButton} onPress={() => handleRespondToRescue(report)}>
        <Ionicons name="arrow-forward-circle" size={20} color={COLORS.textWhite} />
        <Text style={styles.respondButtonText}>Respond to Rescue</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderRescueCard = (report) => (
    <TouchableOpacity key={report.id} style={styles.rescueCard} activeOpacity={0.8}>
      <Image
        source={{ uri: getImageUrl(report.image) || 'https://via.placeholder.com/100?text=Rescue' }}
        style={styles.rescueImage}
      />
      <View style={styles.rescueInfo}>
        <Text style={styles.rescueTitle} numberOfLines={1}>
          {report.title || `Rescue Report #${report.id}`}
        </Text>
        <Text style={styles.rescueLocation} numberOfLines={1}>
          <Ionicons name="location-outline" size={12} color={COLORS.textMedium} />
          {' '}{report.location || 'Unknown location'}
        </Text>
        <Text style={styles.rescueDate}>
          <Ionicons name="calendar-outline" size={12} color={COLORS.textMedium} />
          {' '}{report.created_at ? new Date(report.created_at).toLocaleDateString() : 'N/A'}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(report.status) }]}>
            {report.status?.replace('_', ' ') || 'Pending'}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textMedium} />
    </TouchableOpacity>
  );

  // Memoized filtered reports for performance
  const activeReports = useMemo(() => 
    rescueReports.filter(r => r.status !== 'resolved' && r.status !== 'rescued'),
    [rescueReports]
  );
  const completedReports = useMemo(() => 
    rescueReports.filter(r => r.status === 'resolved' || r.status === 'rescued'),
    [rescueReports]
  );
  const criticalReports = useMemo(() => 
    rescueReports.filter(r => r.urgency?.toLowerCase() === 'critical' && r.status !== 'resolved' && r.status !== 'rescued'),
    [rescueReports]
  );

  // Rescuer Dashboard View
  const renderRescuerView = () => {

    return (
      <>
        <View style={styles.rescuerWelcome}>
          <View style={styles.rescuerBadge}>
            <MaterialCommunityIcons name="shield-star" size={24} color={COLORS.textWhite} />
          </View>
          <View style={styles.rescuerWelcomeText}>
            <Text style={styles.rescuerTitle}>Welcome, Rescuer {userName}!</Text>
            <Text style={styles.rescuerSubtitle}>You have access to rescue reports in your area</Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#FFA726' + '20' }]}>
              <Ionicons name="alert-circle" size={24} color="#FFA726" />
            </View>
            <Text style={styles.statNumber}>{activeReports.length}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#DC2626' + '20' }]}>
              <Ionicons name="warning" size={24} color="#DC2626" />
            </View>
            <Text style={styles.statNumber}>{criticalReports.length}</Text>
            <Text style={styles.statLabel}>Critical</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: COLORS.success + '20' }]}>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
            </View>
            <Text style={styles.statNumber}>{completedReports.length}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, rescuerTab === 'dashboard' && styles.tabActive]}
            onPress={() => setRescuerTab('dashboard')}
          >
            <Ionicons 
              name="list" 
              size={18} 
              color={rescuerTab === 'dashboard' ? COLORS.textWhite : COLORS.textMedium} 
            />
            <Text style={[styles.tabText, rescuerTab === 'dashboard' && styles.tabTextActive]}>
              Dashboard
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, rescuerTab === 'map' && styles.tabActive]}
            onPress={() => {
              setRescuerTab('map');
              setTimeout(sendRescuesToMap, 500);
            }}
          >
            <Ionicons 
              name="map" 
              size={18} 
              color={rescuerTab === 'map' ? COLORS.textWhite : COLORS.textMedium} 
            />
            <Text style={[styles.tabText, rescuerTab === 'map' && styles.tabTextActive]}>
              Map View
            </Text>
          </TouchableOpacity>
        </View>

        {rescuerTab === 'map' ? (
          <View style={styles.mapContainer}>
            <WebView
              ref={webViewRef}
              source={{ html: RESCUER_MAP_HTML }}
              style={styles.mapWebView}
              onMessage={handleWebViewMessage}
              onLoad={sendRescuesToMap}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              scrollEnabled={false}
            />
          </View>
        ) : (
          <>
            <TouchableOpacity style={styles.emergencyCard} onPress={handleEmergencyCall} activeOpacity={0.8}>
              <View style={styles.emergencyIcon}>
                <Ionicons name="call" size={28} color="#FFF" />
              </View>
              <View style={styles.emergencyContent}>
                <Text style={styles.emergencyTitle}>Emergency Hotline</Text>
                <Text style={styles.emergencyNumber}>{EMERGENCY_HOTLINE}</Text>
                <Text style={styles.emergencySubtext}>24/7 Animal Rescue Emergency</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Active Rescue Reports</Text>
                <View style={styles.reportCountBadge}>
                  <Text style={styles.reportCountText}>{activeReports.length}</Text>
                </View>
              </View>
              
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.loadingText}>Loading rescue reports...</Text>
                </View>
              ) : activeReports.length > 0 ? (
                activeReports.map(renderRescuerReportCard)
              ) : (
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons name="check-circle" size={48} color={COLORS.success} />
                  <Text style={styles.emptyTitle}>All Clear!</Text>
                  <Text style={styles.emptyText}>No active rescue reports at the moment</Text>
                </View>
              )}
            </View>

            {completedReports.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Completed Rescues</Text>
                {completedReports.slice(0, 3).map(report => (
                  <View key={report.id} style={styles.completedCard}>
                    <View style={styles.completedIcon}>
                      <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                    </View>
                    <View style={styles.completedInfo}>
                      <Text style={styles.completedTitle} numberOfLines={1}>
                        {report.title || `Rescue #${report.id}`}
                      </Text>
                      <Text style={styles.completedDate}>
                        {report.updated_at ? new Date(report.updated_at).toLocaleDateString() : 'Recently'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </>
    );
  };

  // Regular User View
  const renderUserView = () => (
    <>
      <View style={styles.welcomeCard}>
        <View style={styles.welcomeIconContainer}>
          <MaterialCommunityIcons name="hand-heart" size={40} color={COLORS.primary} />
        </View>
        <Text style={styles.welcomeTitle}>Hi, {userName}! Want to be a rescuer?</Text>
        <Text style={styles.welcomeSubtitle}>
          Join our community of heroes who save animal lives every day. Register as a rescuer and make a difference!
        </Text>
        <TouchableOpacity
          style={styles.registerButton}
          activeOpacity={0.8}
          onPress={onNavigateToRescuerRegistration}
        >
          <Ionicons name="shield-checkmark" size={20} color={COLORS.textWhite} />
          <Text style={styles.registerButtonText}>Register Here</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.emergencyCardUser} onPress={handleEmergencyCall} activeOpacity={0.8}>
        <View style={styles.emergencyIconUser}>
          <Ionicons name="call" size={24} color={COLORS.error} />
        </View>
        <View style={styles.emergencyContentUser}>
          <Text style={styles.emergencyTitleUser}>Emergency Hotline</Text>
          <Text style={styles.emergencyNumberUser}>{EMERGENCY_HOTLINE}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textMedium} />
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How Rescue Works</Text>
        <View style={styles.stepsContainer}>
          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Spot a Stray</Text>
              <Text style={styles.stepDescription}>
                See a stray animal in need of help or rescue.
              </Text>
            </View>
          </View>
          <View style={styles.stepConnector} />
          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Report It</Text>
              <Text style={styles.stepDescription}>
                Submit a rescue report with location and photos.
              </Text>
            </View>
          </View>
          <View style={styles.stepConnector} />
          <View style={styles.stepItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Rescue Team Acts</Text>
              <Text style={styles.stepDescription}>
                Our registered rescuers respond to save the animal.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </>
  );

  if (checkingRescuerStatus) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // If user is verified rescuer, show the dedicated rescuer dashboard
  if (isRescuer) {
    return (
      <UserRescuerDashboardScreen 
        onNavigateToReportRescue={onNavigateToReportRescue}
      />
    );
  }

  // Regular user view
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
        <View style={styles.header}>
          {onGoBack && (
            <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
              <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
          )}
          <Text style={[styles.headerTitle, onGoBack && styles.headerTitleWithBack]}>Rescue</Text>
        </View>

        {renderUserView()}

        <View style={styles.bottomSpacing} />
      </ScrollView>
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
  headerTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  headerTitleWithBack: {
    flex: 1,
  },
  rescuerTagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.round,
  },
  rescuerTagText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.success,
    marginLeft: 4,
  },
  rescuerWelcome: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  rescuerBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rescuerWelcomeText: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  rescuerTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },
  rescuerSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  emergencyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
    backgroundColor: '#DC2626',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  emergencyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emergencyContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  emergencyTitle: {
    fontSize: FONTS.sizes.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  emergencyNumber: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: '#FFF',
  },
  emergencySubtext: {
    fontSize: FONTS.sizes.xs,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  emergencyCardUser: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.error + '30',
  },
  emergencyIconUser: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.error + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emergencyContentUser: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  emergencyTitleUser: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
  },
  emergencyNumberUser: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.error,
  },
  rescuerReportCard: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    elevation: 3,
  },
  reportHeader: {
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
  reportBody: {
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
    fontSize: FONTS.sizes.lg,
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
  reportCountBadge: {
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  reportCountText: {
    color: COLORS.textWhite,
    fontSize: FONTS.sizes.sm,
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
  welcomeCard: {
    marginHorizontal: SPACING.xl,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    elevation: 3,
    marginBottom: SPACING.lg,
  },
  welcomeIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  welcomeTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  welcomeSubtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.round,
    elevation: 2,
  },
  registerButtonText: {
    color: COLORS.textWhite,
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    marginLeft: SPACING.sm,
  },
  section: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.lg,
  },
  stepsContainer: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    elevation: 2,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: COLORS.textWhite,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
  },
  stepContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  stepTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    lineHeight: 20,
  },
  stepConnector: {
    width: 2,
    height: 20,
    backgroundColor: COLORS.borderLight,
    marginLeft: 15,
    marginVertical: SPACING.sm,
  },
  rescueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    elevation: 2,
  },
  rescueImage: {
    width: 70,
    height: 70,
    borderRadius: RADIUS.md,
  },
  rescueInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  rescueTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
  },
  rescueLocation: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: 4,
  },
  rescueDate: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
    marginTop: 2,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.xs,
  },
  statusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    textTransform: 'capitalize',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginHorizontal: SPACING.xs,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  actionLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
    textAlign: 'center',
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
  floatingButton: {
    position: 'absolute',
    bottom: 100,
    right: SPACING.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  bottomSpacing: {
    height: 100,
  },
  // Stats styles
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
  // Tab styles
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
  // Map styles
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
});

export default memo(UserRescueScreen);
