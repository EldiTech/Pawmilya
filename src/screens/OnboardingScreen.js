import React, { useState, useRef, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Animated,
  StatusBar,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    icon: 'paw',
    iconFamily: 'MaterialCommunityIcons',
    iconColor: '#FF9554',
    gradientColors: ['#FFF8F3', '#FFE8D6'],
    title: 'Welcome to Pawmilya',
    subtitle: 'Your trusted companion\nin pet adoption & rescue',
    description:
      'Find your perfect furry friend and give them a loving forever home. We connect caring hearts with pets in need.',
    accentIcon: 'heart',
    accentIconFamily: 'Ionicons',
  },
  {
    id: '2',
    icon: 'search',
    iconFamily: 'Ionicons',
    iconColor: '#8FC29A',
    gradientColors: ['#F0FAF2', '#D9F0DD'],
    title: 'Browse & Discover',
    subtitle: 'Explore pets waiting\nfor a home',
    description:
      'Browse through various breeds, filter by type, age, or location. Every pet has a story — find the one meant for you.',
    accentIcon: 'filter',
    accentIconFamily: 'Ionicons',
  },
  {
    id: '3',
    icon: 'hand-holding-heart',
    iconFamily: 'FontAwesome5',
    iconColor: '#FF6B6B',
    gradientColors: ['#FFF5F5', '#FFE0E0'],
    title: 'Adopt with Love',
    subtitle: 'A simple & caring\nadoption process',
    description:
      'Submit your application, get approved, and welcome your new family member. We guide you every step of the way.',
    accentIcon: 'clipboard-check',
    accentIconFamily: 'MaterialCommunityIcons',
  },
  {
    id: '4',
    icon: 'alert-circle-outline',
    iconFamily: 'MaterialCommunityIcons',
    iconColor: '#FFB74D',
    gradientColors: ['#FFFAF0', '#FFF0D4'],
    title: 'Report & Rescue',
    subtitle: 'Help animals\nin distress',
    description:
      'Spot a stray or an animal in danger? Report it instantly with location details. Together, we can save more lives.',
    accentIcon: 'location-sharp',
    accentIconFamily: 'Ionicons',
  },
  {
    id: '5',
    icon: 'home-heart',
    iconFamily: 'MaterialCommunityIcons',
    iconColor: '#FF9554',
    gradientColors: ['#FFF8F3', '#FFE4C9'],
    title: "You're All Set!",
    subtitle: 'Start your journey\nwith Pawmilya',
    description:
      'Create an account to adopt, rescue, and make a difference. Every pet deserves a loving family — and it starts with you.',
    accentIcon: 'rocket',
    accentIconFamily: 'Ionicons',
  },
];

const IconRenderer = memo(({ family, name, size, color }) => {
  switch (family) {
    case 'Ionicons':
      return <Ionicons name={name} size={size} color={color} />;
    case 'FontAwesome5':
      return <FontAwesome5 name={name} size={size} color={color} />;
    case 'MaterialCommunityIcons':
    default:
      return <MaterialCommunityIcons name={name} size={size} color={color} />;
  }
});

const SlideItem = memo(({ item, index, scrollX }) => {
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

  const iconScale = scrollX.interpolate({
    inputRange,
    outputRange: [0.5, 1, 0.5],
    extrapolate: 'clamp',
  });

  const iconOpacity = scrollX.interpolate({
    inputRange,
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  const textTranslateY = scrollX.interpolate({
    inputRange,
    outputRange: [30, 0, 30],
    extrapolate: 'clamp',
  });

  const textOpacity = scrollX.interpolate({
    inputRange,
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.slide}>
      <LinearGradient colors={item.gradientColors} style={styles.slideGradient}>
        {/* Decorative Floating Shapes */}
        <View style={styles.decorContainer}>
          <View style={[styles.decorCircle, styles.decorTopLeft, { backgroundColor: `${item.iconColor}15` }]} />
          <View style={[styles.decorCircle, styles.decorTopRight, { backgroundColor: `${item.iconColor}10` }]} />
          <View style={[styles.decorCircle, styles.decorBottomLeft, { backgroundColor: `${item.iconColor}08` }]} />
        </View>

        {/* Main Icon Area */}
        <View style={styles.iconSection}>
          <Animated.View
            style={[
              styles.iconContainer,
              {
                transform: [{ scale: iconScale }],
                opacity: iconOpacity,
              },
            ]}
          >
            {/* Outer ring */}
            <View style={[styles.iconOuterRing, { borderColor: `${item.iconColor}30` }]}>
              {/* Inner ring */}
              <View style={[styles.iconInnerRing, { backgroundColor: `${item.iconColor}15` }]}>
                {/* Center circle */}
                <View style={[styles.iconCircle, { backgroundColor: `${item.iconColor}20` }]}>
                  <IconRenderer
                    family={item.iconFamily}
                    name={item.icon}
                    size={64}
                    color={item.iconColor}
                  />
                </View>
              </View>
            </View>

            {/* Floating accent icon */}
            <Animated.View
              style={[
                styles.accentBadge,
                {
                  backgroundColor: item.iconColor,
                  opacity: iconOpacity,
                },
              ]}
            >
              <IconRenderer
                family={item.accentIconFamily}
                name={item.accentIcon}
                size={18}
                color="#FFF"
              />
            </Animated.View>
          </Animated.View>
        </View>

        {/* Text Content */}
        <Animated.View
          style={[
            styles.textSection,
            {
              transform: [{ translateY: textTranslateY }],
              opacity: textOpacity,
            },
          ]}
        >
          <Text style={[styles.slideTitle, { color: item.iconColor }]}>{item.title}</Text>
          <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: `${item.iconColor}40` }]} />
            <MaterialCommunityIcons name="paw" size={16} color={`${item.iconColor}80`} />
            <View style={[styles.dividerLine, { backgroundColor: `${item.iconColor}40` }]} />
          </View>
          <Text style={styles.slideDescription}>{item.description}</Text>
        </Animated.View>
      </LinearGradient>
    </View>
  );
});

const Paginator = memo(({ data, scrollX }) => (
  <View style={styles.paginatorContainer}>
    {data.map((_, index) => {
      const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
      const dotWidth = scrollX.interpolate({
        inputRange,
        outputRange: [8, 28, 8],
        extrapolate: 'clamp',
      });
      const dotOpacity = scrollX.interpolate({
        inputRange,
        outputRange: [0.3, 1, 0.3],
        extrapolate: 'clamp',
      });
      const dotColor = scrollX.interpolate({
        inputRange,
        outputRange: [COLORS.brownLight, COLORS.primary, COLORS.brownLight],
        extrapolate: 'clamp',
      });
      return (
        <Animated.View
          key={index}
          style={[
            styles.dot,
            {
              width: dotWidth,
              opacity: dotOpacity,
              backgroundColor: dotColor,
            },
          ]}
        />
      );
    })}
  </View>
));

const OnboardingScreen = ({ onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = useCallback(() => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      onComplete();
    }
  }, [currentIndex, onComplete]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const isLastSlide = currentIndex === SLIDES.length - 1;

  const renderItem = useCallback(
    ({ item, index }) => <SlideItem item={item} index={index} scrollX={scrollX} />,
    [scrollX],
  );

  const keyExtractor = useCallback((item) => item.id, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Skip Button */}
      {!isLastSlide && (
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.skipText}>Skip</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.brownLight} />
        </TouchableOpacity>
      )}

      {/* Slide List */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewConfig}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
      />

      {/* Bottom Controls */}
      <View style={styles.bottomContainer}>
        <Paginator data={SLIDES} scrollX={scrollX} />

        <TouchableOpacity
          onPress={handleNext}
          activeOpacity={0.85}
          style={styles.nextButtonWrapper}
        >
          <LinearGradient
            colors={
              isLastSlide ? [COLORS.primary, COLORS.primaryDark] : [COLORS.primary, '#FFAC6E']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.nextButton}
          >
            {isLastSlide ? (
              <View style={styles.getStartedRow}>
                <Text style={styles.getStartedText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFF" />
              </View>
            ) : (
              <Ionicons name="arrow-forward" size={24} color="#FFF" />
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default memo(OnboardingScreen);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  /* Skip Button */
  skipButton: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 48 : 56,
    right: SPACING.xl,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.round,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  skipText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.brownLight,
    marginRight: 2,
  },

  /* Slide */
  slide: {
    width,
    flex: 1,
  },
  slideGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 70 : 80,
    paddingBottom: 180,
  },

  /* Decorative Elements */
  decorContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
  },
  decorTopLeft: {
    width: 200,
    height: 200,
    top: -50,
    left: -60,
  },
  decorTopRight: {
    width: 150,
    height: 150,
    top: 40,
    right: -40,
  },
  decorBottomLeft: {
    width: 250,
    height: 250,
    bottom: 60,
    left: -80,
  },

  /* Icon Section */
  iconSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconOuterRing: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconInnerRing: {
    width: 150,
    height: 150,
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Accent Badge */
  accentBadge: {
    position: 'absolute',
    top: 10,
    right: -5,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  /* Text Section */
  textSection: {
    alignItems: 'center',
    paddingHorizontal: SPACING.xxxl,
  },
  slideTitle: {
    fontSize: 26,
    fontWeight: FONTS.weights.bold,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  slideSubtitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.medium,
    color: COLORS.brown,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: SPACING.md,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.md,
  },
  dividerLine: {
    width: 30,
    height: 1.5,
    borderRadius: 1,
  },
  slideDescription: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: 0.2,
  },

  /* Bottom */
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'android' ? 36 : 48,
    paddingTop: SPACING.lg,
    alignItems: 'center',
    backgroundColor: 'rgba(255,248,243,0.9)',
  },

  /* Paginator */
  paginatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },

  /* Next Button */
  nextButtonWrapper: {
    elevation: 6,
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderRadius: RADIUS.round,
  },
  nextButton: {
    minWidth: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  getStartedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  getStartedText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: '#FFF',
  },
});
