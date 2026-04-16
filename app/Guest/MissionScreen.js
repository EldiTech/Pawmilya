import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { memo, useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Logo from '../../components/Logo';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';

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

const PROBLEM_AREAS = [
  {
    id: 1,
    icon: 'alert-circle',
    title: 'Strays Are Often Invisible',
    description:
      'Many stray animals remain unreported because people do not know where or how to ask for help quickly.',
  },
  {
    id: 2,
    icon: 'time',
    title: 'Rescue Response Is Delayed',
    description:
      'Critical rescue information is usually scattered across chat groups and personal messages, causing slow action.',
  },
  {
    id: 3,
    icon: 'git-network',
    title: 'Support Networks Are Disconnected',
    description:
      'Shelters, rescuers, and adopters care deeply, but coordination is difficult without one shared platform.',
  },
];

const SOLUTION_PILLARS = [
  {
    id: 1,
    icon: 'search',
    title: 'Adoption Discovery',
    description: 'People can browse available pets and connect with shelters in one trusted space.',
  },
  {
    id: 2,
    icon: 'warning',
    title: 'Fast Rescue Reporting',
    description: 'Anyone can submit detailed rescue reports with location and photos for faster response.',
  },
  {
    id: 3,
    icon: 'people',
    title: 'Shared Coordination',
    description: 'Rescuers, shelters, and community members collaborate through a clearer rescue workflow.',
  },
];

const HISTORY_TIMELINE = [
  {
    id: 1,
    year: 'Beginning',
    text: 'Pawmilya started from a simple observation: many people wanted to help stray animals but lacked a clear path to act.',
  },
  {
    id: 2,
    year: 'Community Listening',
    text: 'We listened to adopters, rescuers, and shelters to understand recurring pain points in rescue and adoption efforts.',
  },
  {
    id: 3,
    year: 'Platform Creation',
    text: 'We built this application to make reporting, rescuing, and adoption more organized, transparent, and accessible.',
  },
  {
    id: 4,
    year: 'Today',
    text: 'Pawmilya continues to improve with one goal: help more animals find safety, care, and permanent loving homes.',
  },
];

const MissionScreen = () => {
  const [historyExpanded, setHistoryExpanded] = useState(false);

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

        {/* Why We Created This App */}
        <View style={styles.storyCard}>
          <MaterialCommunityIcons name="book-open-page-variant" size={30} color={COLORS.primary} />
          <Text style={styles.storyTitle}>Why We Created Pawmilya</Text>
          <Text style={styles.storyText}>
            Pawmilya was created to solve a real community problem: compassionate people wanted to help,
            but rescue and adoption processes were often difficult, fragmented, and slow.
          </Text>
        </View>

        {/* Statement of Problem */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statement of Problem</Text>
          <Text style={styles.sectionLead}>
            Animal welfare efforts are strong, but the process often lacks a single, reliable coordination channel.
          </Text>
          <View style={styles.problemList}>
            {PROBLEM_AREAS.map((problem) => (
              <View key={problem.id} style={styles.problemCard}>
                <View style={styles.problemIconWrap}>
                  <Ionicons name={problem.icon} size={20} color={COLORS.error} />
                </View>
                <View style={styles.problemContent}>
                  <Text style={styles.problemTitle}>{problem.title}</Text>
                  <Text style={styles.problemDescription}>{problem.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Solution */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Solution</Text>
          <Text style={styles.sectionLead}>
            Pawmilya brings rescue reporting, adoption discovery, and stakeholder collaboration into one
            accessible platform.
          </Text>
          <View style={styles.solutionList}>
            {SOLUTION_PILLARS.map((item) => (
              <View key={item.id} style={styles.solutionCard}>
                <View style={styles.solutionIconWrap}>
                  <Ionicons name={item.icon} size={20} color={COLORS.primary} />
                </View>
                <View style={styles.solutionContent}>
                  <Text style={styles.solutionTitle}>{item.title}</Text>
                  <Text style={styles.solutionDescription}>{item.description}</Text>
                </View>
              </View>
            ))}
          </View>
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

        {/* History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our History</Text>
          <View style={styles.historyCard}>
            {HISTORY_TIMELINE.slice(0, historyExpanded ? HISTORY_TIMELINE.length : 2).map((item, index) => (
              <View key={item.id} style={[styles.historyRow, index === (historyExpanded ? HISTORY_TIMELINE.length : 2) - 1 && styles.historyRowLast]}>
                <View style={styles.historyDotCol}>
                  <View style={styles.historyDot} />
                  <View style={styles.historyLine} />
                </View>
                <View style={styles.historyTextCol}>
                  <Text style={styles.historyYear}>{item.year}</Text>
                  <Text style={styles.historyText}>{item.text}</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity
              style={styles.historyToggleBtn}
              onPress={() => setHistoryExpanded((prev) => !prev)}
              activeOpacity={0.8}
            >
              <Text style={styles.historyToggleText}>{historyExpanded ? 'Show Less' : 'Read Full History'}</Text>
              <Ionicons
                name={historyExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          </View>
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
  sectionLead: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    lineHeight: 22,
    marginBottom: SPACING.md,
  },

  // Story Card
  storyCard: {
    marginHorizontal: SPACING.xl,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
  },
  storyTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  storyText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    lineHeight: 22,
    textAlign: 'center',
  },

  // Problem / Solution
  problemList: {
    gap: SPACING.sm,
  },
  problemCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: SPACING.md,
  },
  problemIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.error + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  problemContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  problemTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  problemDescription: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    lineHeight: 20,
  },
  solutionList: {
    gap: SPACING.sm,
  },
  solutionCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: SPACING.md,
  },
  solutionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '16',
    alignItems: 'center',
    justifyContent: 'center',
  },
  solutionContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  solutionTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  solutionDescription: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    lineHeight: 20,
  },

  // History
  historyCard: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: SPACING.lg,
  },
  historyRow: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
  },
  historyRowLast: {
    marginBottom: SPACING.md,
  },
  historyDotCol: {
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    marginTop: 5,
  },
  historyLine: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.borderLight,
    marginTop: 6,
  },
  historyTextCol: {
    flex: 1,
  },
  historyYear: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
    marginBottom: 3,
  },
  historyText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    lineHeight: 20,
  },
  historyToggleBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  historyToggleText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.primary,
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
