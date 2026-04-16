import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Logo from '../../components/Logo';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import { petService } from '../../services';
import { DEFAULT_BASE64_IMAGE, normalizeImageUrl } from '../../utils/imageUrl';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_CARD_WIDTH = SCREEN_WIDTH - SPACING.xl * 2;

// ─── Data ────────────────────────────────────────────────
const HOW_IT_WORKS_STEPS = [
  {
    id: '1',
    step: '01',
    icon: 'person-add',
    color: '#FF9554',
    bgColor: '#FFF3EB',
    title: 'Create Account',
    description:
      'Sign up in just a few seconds and become part of our caring community of pet lovers.',
  },
  {
    id: '2',
    step: '02',
    icon: 'search',
    color: '#8FC29A',
    bgColor: '#F0FAF2',
    title: 'Browse Pets',
    description:
      'Explore pets by breed, age, size, or location. Each one has a unique story waiting for you.',
  },
  {
    id: '3',
    step: '03',
    icon: 'document-text',
    color: '#64B5F6',
    bgColor: '#EBF5FF',
    title: 'Apply to Adopt',
    description:
      'Fill out a simple application form and our team will review it to ensure a perfect match.',
  },
  {
    id: '4',
    step: '04',
    icon: 'heart',
    color: '#FF6B6B',
    bgColor: '#FFF0F0',
    title: 'Welcome Home',
    description:
      'Get approved, pick up your new family member, and give them a loving forever home.',
  },
  {
    id: '5',
    step: '05',
    icon: 'alert-circle',
    color: '#FFB74D',
    bgColor: '#FFF8EE',
    title: 'Report & Rescue',
    description:
      'Spot an animal in need? Report it instantly with location details to help save a life.',
  },
];

// ─── Sub-components ──────────────────────────────────────

/* Carousel slide */
const CarouselSlide = memo(({ item, index, scrollX }) => {
  const inputRange = [
    (index - 1) * CAROUSEL_CARD_WIDTH,
    index * CAROUSEL_CARD_WIDTH,
    (index + 1) * CAROUSEL_CARD_WIDTH,
  ];
  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.92, 1, 0.92],
    extrapolate: 'clamp',
  });
  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.5, 1, 0.5],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[styles.carouselSlide, { width: CAROUSEL_CARD_WIDTH, transform: [{ scale }], opacity }]}
    >
      <View style={[styles.carouselCard, { borderColor: item.color + '25' }]}>
        <View style={styles.carouselStepRow}>
          <View style={[styles.carouselStepBadge, { backgroundColor: item.color + '18' }]}>
            <Text style={[styles.carouselStepText, { color: item.color }]}>Step {item.step}</Text>
          </View>
          <View style={[styles.carouselStepLine, { backgroundColor: item.color + '20' }]} />
        </View>
        <View style={[styles.carouselIconWrap, { backgroundColor: item.bgColor }]}>
          <View style={[styles.carouselIconInner, { backgroundColor: item.color + '20' }]}>
            <Ionicons name={item.icon} size={36} color={item.color} />
          </View>
        </View>
        <Text style={styles.carouselTitle}>{item.title}</Text>
        <Text style={styles.carouselDescription}>{item.description}</Text>
      </View>
    </Animated.View>
  );
});

/* Carousel dots */
const CarouselDots = memo(({ count, scrollX }) => (
  <View style={styles.dotsRow}>
    {Array.from({ length: count }).map((_, i) => {
      const inputRange = [
        (i - 1) * CAROUSEL_CARD_WIDTH,
        i * CAROUSEL_CARD_WIDTH,
        (i + 1) * CAROUSEL_CARD_WIDTH,
      ];
      const w = scrollX.interpolate({ inputRange, outputRange: [8, 24, 8], extrapolate: 'clamp' });
      const o = scrollX.interpolate({ inputRange, outputRange: [0.25, 1, 0.25], extrapolate: 'clamp' });
      const bg = scrollX.interpolate({
        inputRange,
        outputRange: [COLORS.brownLight, COLORS.primary, COLORS.brownLight],
        extrapolate: 'clamp',
      });
      return <Animated.View key={i} style={[styles.dot, { width: w, opacity: o, backgroundColor: bg }]} />;
    })}
  </View>
));

// ─── Main Component ──────────────────────────────────────

const HomeScreen = ({ onNavigateToRescue, onNavigateToLogin }) => {
  const [featuredPets, setFeaturedPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const carouselScrollX = useRef(new Animated.Value(0)).current;
  const screenAnim = useRef(new Animated.Value(0)).current;
  const primaryCtaScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchFeaturedPets();

    Animated.timing(screenAnim, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFeaturedPets();
    setRefreshing(false);
  }, []);

  const getPetImageUri = (imagePath) => {
    return normalizeImageUrl(imagePath, DEFAULT_BASE64_IMAGE);
  };

  const fetchFeaturedPets = async () => {
    try {
      setLoading(true);
      const response = await petService.getFeaturedPets(6);
      if (response.success && Array.isArray(response.data)) {
        setFeaturedPets(response.data);
      } else if (Array.isArray(response.data)) {
        setFeaturedPets(response.data);
      } else if (Array.isArray(response)) {
        setFeaturedPets(response);
      }
    } catch (error) {
      console.error('Error fetching featured pets:', error);
      Alert.alert('Error', error?.message || 'Failed to load featured pets.');
    } finally {
      setLoading(false);
    }
  };

  const showAccountRequired = () => {
    Alert.alert(
      'Account Required',
      'Please create an account first to access this feature and help us keep track of adoptions and rescues.',
      [{ text: 'OK', style: 'default', onPress: onNavigateToLogin }],
    );
  };

  const handlePrimaryPressIn = useCallback(() => {
    Animated.spring(primaryCtaScale, {
      toValue: 0.97,
      friction: 6,
      tension: 220,
      useNativeDriver: true,
    }).start();
  }, [primaryCtaScale]);

  const handlePrimaryPressOut = useCallback(() => {
    Animated.spring(primaryCtaScale, {
      toValue: 1,
      friction: 6,
      tension: 220,
      useNativeDriver: true,
    }).start();
  }, [primaryCtaScale]);

  const screenAnimatedStyle = {
    opacity: screenAnim,
    transform: [
      {
        translateY: screenAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
    ],
  };

  // ─────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <Animated.View style={[styles.screenAnimatedWrap, screenAnimatedStyle]}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        >
        {/* ── 1. Brand Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Logo size="medium" />
            <View style={styles.headerText}>
              <Text style={styles.brandName}>Pawmilya</Text>
              <Text style={styles.brandTagline}>Find your fur-ever friend</Text>
            </View>
          </View>
        </View>

        {/* ── 2. Welcome Banner ── */}
        <View style={styles.px}>
          <View style={styles.welcomeBanner}>
            <View style={styles.welcomeIconRow}>
              <View style={styles.welcomeIconCircle}>
                <MaterialCommunityIcons name="paw" size={28} color={COLORS.primary} />
              </View>
            </View>
            <Text style={styles.welcomeTitle}>Every pet deserves a loving home</Text>
            <Text style={styles.welcomeBody}>
              Browse adorable pets near you, report animals in distress, and become part of a
              community that cares.
            </Text>
            <Animated.View style={{ transform: [{ scale: primaryCtaScale }] }}>
              <TouchableOpacity
                style={styles.welcomeBtn}
                activeOpacity={0.9}
                onPress={showAccountRequired}
                onPressIn={handlePrimaryPressIn}
                onPressOut={handlePrimaryPressOut}
              >
                <Text style={styles.welcomeBtnText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={18} color={COLORS.textWhite} />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>

        {/* ── 3. Report Rescue ── */}
        <View style={styles.px}>
          <TouchableOpacity
            style={styles.rescueCard}
            activeOpacity={0.85}
            onPress={onNavigateToRescue}
          >
            <View style={styles.rescueIconCircle}>
              <Ionicons name="alert-circle" size={28} color={COLORS.error} />
            </View>
            <View style={styles.rescueTextBlock}>
              <Text style={styles.rescueTitle}>Found a Stray Animal?</Text>
              <Text style={styles.rescueSub}>Report it now and help save a life</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={COLORS.error} />
          </TouchableOpacity>
        </View>

        {/* ── 4. Featured Pets ── */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View>
              <Text style={styles.sectionTitle}>Meet Our Friends</Text>
              <Text style={styles.sectionSub}>Pets looking for a home</Text>
            </View>
            <MaterialCommunityIcons name="paw" size={20} color={COLORS.primaryLight} />
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingLabel}>Loading pets...</Text>
            </View>
          ) : featuredPets.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.petsScroll}
            >
              {featuredPets.map((pet) => (
                <TouchableOpacity
                  key={pet.id}
                  style={styles.petCard}
                  activeOpacity={0.85}
                  onPress={showAccountRequired}
                >
                  <Image source={{ uri: getPetImageUri(pet.image) }} style={styles.petImg} />
                  <View style={styles.petBadge}>
                    <View style={styles.petBadgeDot} />
                    <Text style={styles.petBadgeText}>Available</Text>
                  </View>
                  <View style={styles.petBody}>
                    <Text style={styles.petName} numberOfLines={1}>{pet.name}</Text>
                    <Text style={styles.petBreed} numberOfLines={1}>{pet.breed || 'Mixed Breed'}</Text>
                    <View style={styles.petMetas}>
                      <View style={styles.petMeta}>
                        <Ionicons name="calendar-outline" size={12} color={COLORS.textLight} />
                        <Text style={styles.petMetaTxt}>{pet.age || 'Unknown'}</Text>
                      </View>
                      {pet.location ? (
                        <View style={styles.petMeta}>
                          <Ionicons name="location-outline" size={12} color={COLORS.textLight} />
                          <Text style={styles.petMetaTxt} numberOfLines={1}>{pet.location}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyBox}>
              <Ionicons name="paw-outline" size={48} color={COLORS.borderLight} />
              <Text style={styles.emptyTitle}>No pets available right now</Text>
              <Text style={styles.emptySub}>Check back soon for new arrivals!</Text>
            </View>
          )}
        </View>

        {/* ── 5. How It Works ── */}
        <View style={styles.carouselSection}>
          <View style={styles.px}>
            <View style={styles.sectionHead}>
              <View>
                <Text style={styles.sectionTitle}>How It Works</Text>
                <Text style={styles.sectionSub}>Swipe to explore each step</Text>
              </View>
              <Ionicons name="swap-horizontal" size={18} color={COLORS.primaryLight} />
            </View>
          </View>

          <FlatList
            data={HOW_IT_WORKS_STEPS}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={CAROUSEL_CARD_WIDTH}
            decelerationRate="fast"
            contentContainerStyle={styles.carouselList}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: carouselScrollX } } }],
              { useNativeDriver: false },
            )}
            scrollEventThrottle={16}
            renderItem={({ item, index }) => (
              <CarouselSlide item={item} index={index} scrollX={carouselScrollX} />
            )}
            getItemLayout={(_, index) => ({
              length: CAROUSEL_CARD_WIDTH,
              offset: CAROUSEL_CARD_WIDTH * index,
              index,
            })}
          />
          <CarouselDots count={HOW_IT_WORKS_STEPS.length} scrollX={carouselScrollX} />
        </View>

        {/* ── 6. Footer ── */}
        <View style={styles.footer}>
          <MaterialCommunityIcons name="paw" size={16} color={COLORS.borderLight} />
          <Text style={styles.footerText}>Made with love for every pet</Text>
        </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </Animated.View>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 44,
  },
  scrollView: { flex: 1 },
  screenAnimatedWrap: { flex: 1 },
  px: { paddingHorizontal: SPACING.xl },

  /* ── 1. Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  headerText: {},
  brandName: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    letterSpacing: 0.3,
  },
  brandTagline: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: 1,
  },

  /* ── 2. Welcome Banner ── */
  welcomeBanner: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    alignItems: 'center',
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary + '12',
  },
  welcomeIconRow: { marginBottom: SPACING.md },
  welcomeIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  welcomeBody: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.sm,
  },
  welcomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: SPACING.xxl,
    borderRadius: RADIUS.round,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  welcomeBtnText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },

  /* ── 3. Rescue Card ── */
  rescueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.error + '08',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xxl,
    borderWidth: 1,
    borderColor: COLORS.error + '20',
    gap: SPACING.md,
  },
  rescueIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.backgroundWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rescueTextBlock: {
    flex: 1,
  },
  rescueTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: 2,
  },
  rescueSub: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
  },

  /* ── 4. Section shared ── */
  section: {
    marginBottom: SPACING.xxl,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: 2,
  },
  sectionSub: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
  },
  /* ── Featured Pets ── */
  petsScroll: {
    paddingLeft: SPACING.xl,
    paddingRight: SPACING.md,
  },
  petCard: {
    width: 180,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    marginRight: SPACING.md,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  petImg: {
    width: '100%',
    height: 160,
    backgroundColor: COLORS.borderLight,
  },
  petBadge: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.round,
    gap: 4,
  },
  petBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.textWhite,
  },
  petBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },
  petBody: {
    padding: SPACING.md,
  },
  petName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: 2,
  },
  petBreed: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginBottom: SPACING.sm,
  },
  petMetas: { gap: 4 },
  petMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  petMetaTxt: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textLight,
    flex: 1,
  },

  /* ── Loading / Empty ── */
  loadingBox: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
    marginHorizontal: SPACING.xl,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
  },
  loadingLabel: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
    marginHorizontal: SPACING.xl,
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
    marginTop: SPACING.md,
  },
  emptySub: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: SPACING.xs,
  },

  /* ── 5. Carousel ── */
  carouselSection: {
    marginBottom: SPACING.xxl,
  },
  carouselList: {
    paddingHorizontal: SPACING.xl,
  },
  carouselSlide: {
    justifyContent: 'center',
  },
  carouselCard: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
    marginHorizontal: 2,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    borderWidth: 1.5,
  },
  carouselStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: SPACING.xl,
  },
  carouselStepBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
  },
  carouselStepText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 0.5,
  },
  carouselStepLine: {
    flex: 1,
    height: 1.5,
    marginLeft: SPACING.md,
    borderRadius: 1,
  },
  carouselIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  carouselIconInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  carouselDescription: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: SPACING.sm,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },

  /* ── 6. Footer ── */
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
  },
  footerText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.borderLight,
    fontWeight: FONTS.weights.medium,
  },

  bottomSpacer: { height: 80 },
});

export default memo(HomeScreen);
