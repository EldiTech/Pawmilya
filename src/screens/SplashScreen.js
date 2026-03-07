import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/theme';

const { width, height } = Dimensions.get('window');

const SplashScreenComponent = ({ onFinish }) => {
  // Animation values
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(20)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslateY = useRef(new Animated.Value(15)).current;
  const pawPrint1 = useRef(new Animated.Value(0)).current;
  const pawPrint2 = useRef(new Animated.Value(0)).current;
  const pawPrint3 = useRef(new Animated.Value(0)).current;
  const pawPrint4 = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(0)).current;
  const bottomOpacity = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;
  const glowPulse = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Pulsing glow loop
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 0.8,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // Main animation sequence
    Animated.sequence([
      // 1. Outer ring appears
      Animated.parallel([
        Animated.spring(ringScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),

      // 2. Paw icon bounces in with rotation
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 4,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(logoRotate, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),

      // 3. Title slides in
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(titleTranslateY, {
          toValue: 0,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),

      // 4. Tagline slides in
      Animated.parallel([
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(taglineTranslateY, {
          toValue: 0,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),

      // 5. Decorative paw prints trail in
      Animated.stagger(120, [
        Animated.spring(pawPrint1, { toValue: 1, friction: 6, useNativeDriver: true }),
        Animated.spring(pawPrint2, { toValue: 1, friction: 6, useNativeDriver: true }),
        Animated.spring(pawPrint3, { toValue: 1, friction: 6, useNativeDriver: true }),
        Animated.spring(pawPrint4, { toValue: 1, friction: 6, useNativeDriver: true }),
      ]),

      // 6. Heart pops
      Animated.spring(heartScale, {
        toValue: 1,
        friction: 3,
        tension: 60,
        useNativeDriver: true,
      }),

      // 7. Bottom text
      Animated.timing(bottomOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),

      // 8. Hold for a moment
      Animated.delay(600),

      // 9. Fade out everything
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      pulseLoop.stop();
      onFinish && onFinish();
    });

    return () => pulseLoop.stop();
  }, []);

  const spin = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-15deg', '0deg'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeOut }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <LinearGradient
        colors={['#FFF8F3', '#FFE8D6', '#FFF5EE']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Background decorative paw prints */}
        <Animated.View style={[styles.bgPaw, styles.bgPaw1, { opacity: pawPrint1 }]}>
          <MaterialCommunityIcons name="paw" size={40} color="rgba(255, 149, 84, 0.08)" />
        </Animated.View>
        <Animated.View style={[styles.bgPaw, styles.bgPaw2, { opacity: pawPrint2 }]}>
          <MaterialCommunityIcons name="paw" size={55} color="rgba(255, 149, 84, 0.06)" />
        </Animated.View>
        <Animated.View style={[styles.bgPaw, styles.bgPaw3, { opacity: pawPrint3 }]}>
          <MaterialCommunityIcons name="paw" size={35} color="rgba(139, 94, 52, 0.06)" />
        </Animated.View>
        <Animated.View style={[styles.bgPaw, styles.bgPaw4, { opacity: pawPrint4 }]}>
          <MaterialCommunityIcons name="paw" size={48} color="rgba(255, 149, 84, 0.07)" />
        </Animated.View>

        {/* Main content */}
        <View style={styles.content}>
          {/* Glow behind logo */}
          <Animated.View style={[styles.glow, { opacity: glowPulse, transform: [{ scale: ringScale }] }]} />

          {/* Outer ring */}
          <Animated.View
            style={[
              styles.outerRing,
              {
                opacity: ringOpacity,
                transform: [{ scale: ringScale }],
              },
            ]}
          >
            {/* Inner circle with paw icon */}
            <Animated.View
              style={[
                styles.innerCircle,
                {
                  transform: [
                    { scale: logoScale },
                    { rotate: spin },
                  ],
                },
              ]}
            >
              <MaterialCommunityIcons name="paw" size={56} color={COLORS.primary} />
            </Animated.View>
          </Animated.View>

          {/* Heart accent */}
          <Animated.View
            style={[
              styles.heartBadge,
              {
                transform: [{ scale: heartScale }],
              },
            ]}
          >
            <Ionicons name="heart" size={18} color="#FFF" />
          </Animated.View>

          {/* App name */}
          <Animated.View
            style={{
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            }}
          >
            <Text style={styles.title}>Pawmilya</Text>
          </Animated.View>

          {/* Tagline */}
          <Animated.View
            style={{
              opacity: taglineOpacity,
              transform: [{ translateY: taglineTranslateY }],
            }}
          >
            <Text style={styles.tagline}>Every pet deserves a loving family</Text>
          </Animated.View>

          {/* Paw trail */}
          <View style={styles.pawTrail}>
            {[pawPrint1, pawPrint2, pawPrint3, pawPrint4].map((anim, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.trailPaw,
                  {
                    opacity: anim,
                    transform: [
                      { scale: anim },
                      {
                        rotate: anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [`${-30 + i * 15}deg`, `${-15 + i * 10}deg`],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="paw"
                  size={16 + i * 2}
                  color={i % 2 === 0 ? COLORS.primary : COLORS.brownLight}
                />
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Bottom section */}
        <Animated.View style={[styles.bottom, { opacity: bottomOpacity }]}>
          <View style={styles.featureRow}>
            <View style={styles.featureItem}>
              <View style={[styles.featureDot, { backgroundColor: COLORS.primary }]} />
              <Text style={styles.featureText}>Adopt</Text>
            </View>
            <View style={styles.featureDivider} />
            <View style={styles.featureItem}>
              <View style={[styles.featureDot, { backgroundColor: COLORS.success }]} />
              <Text style={styles.featureText}>Rescue</Text>
            </View>
            <View style={styles.featureDivider} />
            <View style={styles.featureItem}>
              <View style={[styles.featureDot, { backgroundColor: COLORS.error }]} />
              <Text style={styles.featureText}>Love</Text>
            </View>
          </View>
          <Text style={styles.versionText}>v1.0.0</Text>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Glow effect behind logo
  glow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: COLORS.primary,
    top: -18,
  },

  // Outer ring (matches Logo component style)
  outerRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.backgroundWhite,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  innerCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Heart badge
  heartBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: COLORS.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: '#FFF',
  },

  // Title
  title: {
    fontSize: 38,
    fontWeight: '700',
    color: COLORS.brown,
    marginTop: 24,
    letterSpacing: 1,
    textShadowColor: 'rgba(139, 94, 52, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  // Tagline
  tagline: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.brownLight,
    marginTop: 8,
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  // Paw trail
  pawTrail: {
    flexDirection: 'row',
    marginTop: 28,
    gap: 12,
    alignItems: 'center',
  },
  trailPaw: {
    marginHorizontal: 4,
  },

  // Background paws
  bgPaw: {
    position: 'absolute',
  },
  bgPaw1: {
    top: height * 0.08,
    left: width * 0.1,
    transform: [{ rotate: '-25deg' }],
  },
  bgPaw2: {
    top: height * 0.15,
    right: width * 0.08,
    transform: [{ rotate: '20deg' }],
  },
  bgPaw3: {
    bottom: height * 0.22,
    left: width * 0.15,
    transform: [{ rotate: '15deg' }],
  },
  bgPaw4: {
    bottom: height * 0.3,
    right: width * 0.12,
    transform: [{ rotate: '-10deg' }],
  },

  // Bottom section
  bottom: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  featureText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.brownLight,
    letterSpacing: 0.5,
  },
  featureDivider: {
    width: 1,
    height: 14,
    backgroundColor: COLORS.accent,
  },
  versionText: {
    fontSize: 11,
    color: COLORS.brownMuted,
    fontWeight: '400',
    opacity: 0.6,
  },
});

export default SplashScreenComponent;
