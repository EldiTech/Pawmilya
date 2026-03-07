import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  StatusBar,
  Platform,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import Logo from '../../components/Logo';
import CONFIG from '../../config/config';

const MISSION_VALUES = [
  {
    id: 1,
    icon: 'heart',
    title: 'Compassion',
    description: 'We believe every animal deserves love, care, and a safe home.',
    color: COLORS.error,
  },
  {
    id: 2,
    icon: 'shield-checkmark',
    title: 'Protection',
    description: 'We are committed to rescuing and protecting animals in need.',
    color: COLORS.success,
  },
  {
    id: 3,
    icon: 'people',
    title: 'Community',
    description: 'We build bridges between shelters, rescuers, and adopters.',
    color: COLORS.primary,
  },
  {
    id: 4,
    icon: 'leaf',
    title: 'Sustainability',
    description: 'We promote responsible pet ownership and population control.',
    color: '#4CAF50',
  },
];

const TEAM_MEMBERS = [
  {
    id: 1,
    name: 'Dr. Maria Santos',
    role: 'Founder & Director',
    image: 'https://via.placeholder.com/100?text=MS',
  },
  {
    id: 2,
    name: 'Juan dela Cruz',
    role: 'Operations Manager',
    image: 'https://via.placeholder.com/100?text=JC',
  },
  {
    id: 3,
    name: 'Ana Reyes',
    role: 'Volunteer Coordinator',
    image: 'https://via.placeholder.com/100?text=AR',
  },
];

const MissionScreen = () => {
  const [stats, setStats] = useState({
    petsAdopted: '2,450+',
    rescues: '1,200+',
    partnerShelters: '85+',
    volunteers: '500+',
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Fetch actual stats from API
  const fetchStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const response = await fetch(`${CONFIG.API_URL}/health/stats`);
      if (response.ok) {
        const data = await response.json();
        if (data.stats) {
          setStats({
            petsAdopted: data.stats.adoptions ? `${data.stats.adoptions.toLocaleString()}+` : '2,450+',
            rescues: data.stats.rescues ? `${data.stats.rescues.toLocaleString()}+` : '1,200+',
            partnerShelters: data.stats.shelters ? `${data.stats.shelters.toLocaleString()}+` : '85+',
            volunteers: data.stats.users ? `${data.stats.users.toLocaleString()}+` : '500+',
          });
        }
      }
    } catch (error) {
      console.log('Could not fetch stats, using defaults');
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Handle Contact Us button press
  const handleContactUs = useCallback(() => {
    Alert.alert(
      'Contact Us',
      'How would you like to get in touch?',
      [
        {
          text: 'Email',
          onPress: () => Linking.openURL('mailto:support@pawmilya.com?subject=Inquiry from Pawmilya App'),
        },
        {
          text: 'Call',
          onPress: () => Linking.openURL('tel:+639123456789'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Our Mission</Text>
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.logoContainer}>
            <Logo size="large" />
          </View>
          <Text style={styles.heroTitle}>Pawmilya</Text>
          <Text style={styles.heroTagline}>Every Paw Deserves a Family</Text>
        </View>

        {/* Mission Statement */}
        <View style={styles.missionCard}>
          <MaterialCommunityIcons name="target" size={32} color={COLORS.primary} />
          <Text style={styles.missionTitle}>Our Mission</Text>
          <Text style={styles.missionText}>
            Pawmilya is dedicated to creating a world where every stray animal finds a loving home. 
            We connect compassionate individuals with animals in need, facilitate rescues, 
            and support shelters in their noble work of animal welfare.
          </Text>
        </View>

        {/* Vision */}
        <View style={styles.visionCard}>
          <MaterialCommunityIcons name="eye" size={32} color={COLORS.textWhite} />
          <Text style={styles.visionTitle}>Our Vision</Text>
          <Text style={styles.visionText}>
            A Philippines where no animal is left behind – where every stray is rescued, 
            every shelter is supported, and every family can experience the joy of pet adoption.
          </Text>
        </View>

        {/* Values */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Core Values</Text>
          <View style={styles.valuesGrid}>
            {MISSION_VALUES.map((value) => (
              <View key={value.id} style={styles.valueCard}>
                <View style={[styles.valueIcon, { backgroundColor: value.color + '20' }]}>
                  <Ionicons name={value.icon} size={24} color={value.color} />
                </View>
                <Text style={styles.valueTitle}>{value.title}</Text>
                <Text style={styles.valueDescription}>{value.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* What We Do */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What We Do</Text>
          <View style={styles.servicesContainer}>
            <View style={styles.serviceItem}>
              <View style={styles.serviceIcon}>
                <MaterialCommunityIcons name="paw" size={28} color={COLORS.primary} />
              </View>
              <View style={styles.serviceContent}>
                <Text style={styles.serviceTitle}>Pet Adoption</Text>
                <Text style={styles.serviceDescription}>
                  We help match loving families with pets looking for their forever homes.
                </Text>
              </View>
            </View>
            <View style={styles.serviceItem}>
              <View style={styles.serviceIcon}>
                <MaterialCommunityIcons name="ambulance" size={28} color={COLORS.primary} />
              </View>
              <View style={styles.serviceContent}>
                <Text style={styles.serviceTitle}>Rescue Operations</Text>
                <Text style={styles.serviceDescription}>
                  Our network of rescuers responds to reports of strays in distress.
                </Text>
              </View>
            </View>
            <View style={styles.serviceItem}>
              <View style={styles.serviceIcon}>
                <MaterialCommunityIcons name="home-heart" size={28} color={COLORS.primary} />
              </View>
              <View style={styles.serviceContent}>
                <Text style={styles.serviceTitle}>Shelter Support</Text>
                <Text style={styles.serviceDescription}>
                  We partner with shelters to increase visibility and resources.
                </Text>
              </View>
            </View>
            <View style={styles.serviceItem}>
              <View style={styles.serviceIcon}>
                <MaterialCommunityIcons name="school" size={28} color={COLORS.primary} />
              </View>
              <View style={styles.serviceContent}>
                <Text style={styles.serviceTitle}>Education</Text>
                <Text style={styles.serviceDescription}>
                  We promote responsible pet ownership through awareness campaigns.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Impact Stats */}
        <View style={styles.impactSection}>
          <Text style={styles.impactTitle}>Our Impact</Text>
          {loadingStats ? (
            <ActivityIndicator size="small" color={COLORS.textWhite} style={{ marginVertical: SPACING.lg }} />
          ) : (
            <View style={styles.impactGrid}>
              <View style={styles.impactItem}>
                <Text style={styles.impactNumber}>{stats.petsAdopted}</Text>
                <Text style={styles.impactLabel}>Pets Adopted</Text>
              </View>
              <View style={styles.impactItem}>
                <Text style={styles.impactNumber}>{stats.rescues}</Text>
                <Text style={styles.impactLabel}>Rescues</Text>
              </View>
              <View style={styles.impactItem}>
                <Text style={styles.impactNumber}>{stats.partnerShelters}</Text>
                <Text style={styles.impactLabel}>Partner Shelters</Text>
              </View>
              <View style={styles.impactItem}>
                <Text style={styles.impactNumber}>{stats.volunteers}</Text>
                <Text style={styles.impactLabel}>Volunteers</Text>
              </View>
            </View>
          )}
        </View>

        {/* Team */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Meet Our Team</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.teamScroll}
          >
            {TEAM_MEMBERS.map((member) => (
              <View key={member.id} style={styles.teamCard}>
                <Image source={{ uri: member.image }} style={styles.teamImage} />
                <Text style={styles.teamName}>{member.name}</Text>
                <Text style={styles.teamRole}>{member.role}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Contact CTA */}
        <View style={styles.ctaSection}>
          <Text style={styles.ctaTitle}>Want to Get Involved?</Text>
          <Text style={styles.ctaText}>
            Join our community of animal lovers and make a difference today!
          </Text>
          <TouchableOpacity 
            style={styles.ctaButton} 
            activeOpacity={0.8}
            onPress={handleContactUs}
            accessibilityLabel="Contact Us"
            accessibilityHint="Opens options to contact Pawmilya via email or phone"
          >
            <Ionicons name="mail" size={20} color={COLORS.textWhite} />
            <Text style={styles.ctaButtonText}>Contact Us</Text>
          </TouchableOpacity>
        </View>

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
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },

  // Hero Section
  heroSection: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  logoContainer: {
    marginBottom: SPACING.md,
  },
  heroTitle: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
    marginTop: SPACING.sm,
  },
  heroTagline: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textMedium,
    fontStyle: 'italic',
    marginTop: SPACING.xs,
  },

  // Mission Card
  missionCard: {
    marginHorizontal: SPACING.xl,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: SPACING.lg,
  },
  missionTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  missionText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    textAlign: 'center',
    lineHeight: 24,
  },

  // Vision Card
  visionCard: {
    marginHorizontal: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  visionTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  visionText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textWhite,
    textAlign: 'center',
    lineHeight: 24,
    opacity: 0.95,
  },

  // Sections
  section: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xxl,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.lg,
  },

  // Values
  valuesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  valueCard: {
    width: '48%',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    elevation: 2,
  },
  valueIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  valueTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.xs,
  },
  valueDescription: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    lineHeight: 20,
  },

  // Services
  servicesContainer: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    elevation: 2,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  serviceIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  serviceTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    lineHeight: 20,
  },

  // Impact
  impactSection: {
    marginHorizontal: SPACING.xl,
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.xxl,
  },
  impactTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  impactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  impactItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  impactNumber: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },
  impactLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textWhite,
    opacity: 0.9,
  },

  // Team
  teamScroll: {
    paddingRight: SPACING.xl,
  },
  teamCard: {
    width: 140,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    marginRight: SPACING.md,
    elevation: 2,
  },
  teamImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: SPACING.sm,
  },
  teamName: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    textAlign: 'center',
  },
  teamRole: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
    textAlign: 'center',
    marginTop: 4,
  },

  // CTA
  ctaSection: {
    marginHorizontal: SPACING.xl,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    elevation: 3,
    marginBottom: SPACING.xxl,
  },
  ctaTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.sm,
  },
  ctaText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.round,
  },
  ctaButtonText: {
    color: COLORS.textWhite,
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    marginLeft: SPACING.sm,
  },

  bottomSpacing: {
    height: 100,
  },
});

export default memo(MissionScreen);
