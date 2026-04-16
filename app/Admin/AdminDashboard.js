import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../../firebaseConfig';
import {
  ADMIN_COLORS,
  ADMIN_MENU_ITEMS,
  DASHBOARD_STATS_CONFIG,
  formatNumber,
  SCREEN_WIDTH,
  useFadeAnimation,
} from './shared';

const CARD_WIDTH = (SCREEN_WIDTH - 52) / 2;

const AdminDashboard = ({ onNavigate, onLogout, adminToken }) => {
  const [statsData, setStatsData] = useState({
    total_pets: 0,
    total_adoptions: 0,
    active_rescues: 0,
    total_users: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { fadeAnim, slideAnim } = useFadeAnimation();

  // Memoized stats to prevent unnecessary re-renders
  const stats = useMemo(() => [
    { ...DASHBOARD_STATS_CONFIG[0], value: String(statsData.total_pets || 0) },
    { ...DASHBOARD_STATS_CONFIG[1], value: String(statsData.total_adoptions || 0) },
    { ...DASHBOARD_STATS_CONFIG[2], value: String(statsData.active_rescues || 0) },
    { ...DASHBOARD_STATS_CONFIG[3], value: formatNumber(statsData.total_users || 0) },
  ], [statsData]);

  useEffect(() => {
    fetchDashboardStats();
  }, [adminToken]);

  const fetchDashboardStats = useCallback(async () => {
    try {
      setLoading(true);
      
      const petsSnapshot = await getDocs(collection(db, 'pets'));
      const total_pets = petsSnapshot.size;

      const adoptionsSnapshot = await getDocs(collection(db, 'adoptions'));
      const total_adoptions = adoptionsSnapshot.size;

      const rescuesSnapshot = await getDocs(query(collection(db, 'rescue_reports'), where('status', '==', 'active')));
      const active_rescues = rescuesSnapshot.size;

      const usersSnapshot = await getDocs(collection(db, 'users'));
      const total_users = usersSnapshot.docs.filter(doc => doc.data().role !== 'admin').length;

      setStatsData({
        total_pets,
        total_adoptions,
        active_rescues,
        total_users
      });

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboardStats();
    setRefreshing(false);
  }, [fetchDashboardStats]);

  const renderStatCard = useCallback((stat, index) => (
    <Animated.View 
      key={index} 
      style={[
        styles.statCard,
        { 
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }
      ]}
    >
      <View style={styles.statCardInner}>
        <LinearGradient
          colors={stat.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.statGradient}
        >
          <View style={styles.statIconContainer}>
            <Ionicons name={stat.icon} size={18} color="#FFF" />
          </View>
          <Text style={styles.statValue}>{stat.value}</Text>
          <Text style={styles.statLabel}>{stat.label}</Text>
        </LinearGradient>
      </View>
    </Animated.View>
  ), [fadeAnim, slideAnim]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={ADMIN_COLORS.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={[ADMIN_COLORS.primary, ADMIN_COLORS.primaryDark]}
                style={styles.logoGradient}
              >
                <Ionicons name="paw" size={20} color="#FFF" />
              </LinearGradient>
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Pawmilya</Text>
              <Text style={styles.headerSubtitle}>Admin Dashboard</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.settingsButton} 
              onPress={() => onNavigate('settings')} 
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={20} color={ADMIN_COLORS.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.logoutButton} 
              onPress={onLogout} 
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={20} color={ADMIN_COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={[ADMIN_COLORS.primary]}
            tintColor={ADMIN_COLORS.primary}
          />
        }
      >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Welcome back! 👋</Text>
          <Text style={styles.welcomeText}>Here's what's happening today</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsSection}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={ADMIN_COLORS.primary} />
              <Text style={styles.loadingText}>Loading stats...</Text>
            </View>
          ) : (
            <View style={styles.statsRow}>
              {stats.map((stat, index) => renderStatCard(stat, index))}
            </View>
          )}
        </View>

        {/* Quick Action */}
        <Animated.View style={[styles.quickActionSection, { opacity: fadeAnim }]}>
          <TouchableOpacity 
            style={styles.addPetButton} 
            onPress={() => onNavigate('addPet')} 
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[ADMIN_COLORS.primary, ADMIN_COLORS.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.addPetGradient}
            >
              <View style={styles.addPetIconWrap}>
                <Ionicons name="add" size={24} color={ADMIN_COLORS.primary} />
              </View>
              <View style={styles.addPetTextContainer}>
                <Text style={styles.addPetTitle}>Add New Pet</Text>
                <Text style={styles.addPetSubtitle}>Register a new pet for adoption</Text>
              </View>
              <View style={styles.addPetArrow}>
                <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.9)" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Menu Section */}
        <View style={styles.menuSection}>
          {ADMIN_MENU_ITEMS.filter((item) => item.id !== 'deliveries').map((item, index) => (
            <Animated.View 
              key={item.id}
              style={[
                styles.menuItemWrapper,
                { 
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                }
              ]}
            >
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => onNavigate(item.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconContainer, { backgroundColor: item.bgColor }]}>
                  <Ionicons name={item.icon} size={22} color={item.color} />
                </View>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Ionicons name="chevron-forward" size={20} color={ADMIN_COLORS.textMuted} />
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ADMIN_COLORS.background,
  },
  header: {
    backgroundColor: ADMIN_COLORS.surface,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 12 : 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.border,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    marginRight: 12,
  },
  logoGradient: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: ADMIN_COLORS.textSecondary,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  settingsButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: ADMIN_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  logoutButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: ADMIN_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 20,
  },
  welcomeSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
    marginBottom: 4,
  },
  welcomeText: {
    fontSize: 15,
    color: ADMIN_COLORS.textSecondary,
  },
  statsSection: {
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  statCard: {
    width: '25%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  statCardInner: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: ADMIN_COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statGradient: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
    marginTop: 2,
  },
  quickActionSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  addPetButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: ADMIN_COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  addPetGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  addPetIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  addPetTextContainer: {
    flex: 1,
  },
  addPetTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addPetSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  addPetArrow: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuSection: {
    paddingHorizontal: 16,
  },
  menuItemWrapper: {
    marginBottom: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    shadowColor: ADMIN_COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  menuIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: ADMIN_COLORS.text,
  },
  loadingContainer: {
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: ADMIN_COLORS.textSecondary,
  },
});

export default memo(AdminDashboard);
