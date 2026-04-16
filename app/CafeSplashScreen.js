import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Image, StatusBar, StyleSheet } from 'react-native';

const CafeSplashScreen = ({ onFinish }) => {
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.92)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const shimmerTranslate = useRef(new Animated.Value(-240)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmerTranslate, {
        toValue: 240,
        duration: 1400,
        useNativeDriver: true,
      })
    );
    shimmerLoop.start();

    Animated.sequence([
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(logoRotate, {
          toValue: 1,
          duration: 520,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.delay(950),
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start(() => {
      shimmerLoop.stop();
      onFinish && onFinish();
    });

    return () => shimmerLoop.stop();
  }, [
    cardOpacity,
    cardScale,
    fadeOut,
    logoRotate,
    logoScale,
    onFinish,
    shimmerTranslate,
    subtitleOpacity,
  ]);

  const tilt = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-5deg', '0deg'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeOut }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF6F3" />
      <LinearGradient
        colors={['#FFF6F3', '#FFEDE7', '#FFF8F1']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardOpacity,
              transform: [{ scale: cardScale }],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.logoWrap,
              {
                transform: [{ scale: logoScale }, { rotate: tilt }],
              },
            ]}
          >
            <Image
              source={require('../assets/images/csc.jpg')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Animated.View
              style={[
                styles.shimmer,
                {
                  transform: [{ translateX: shimmerTranslate }, { rotate: '18deg' }],
                },
              ]}
            />
          </Animated.View>

          <Animated.Text style={[styles.title, { opacity: subtitleOpacity }]}>Cat Sanctuary Cafe</Animated.Text>
          <Animated.Text style={[styles.caption, { opacity: subtitleOpacity }]}>Guided by Cat Sanctuary Cafe</Animated.Text>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '84%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(115, 6, 34, 0.15)',
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: 'center',
    shadowColor: '#730622',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 10,
    overflow: 'hidden',
  },
  logoWrap: {
    width: 228,
    height: 228,
    borderRadius: 114,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFDFC',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  shimmer: {
    position: 'absolute',
    top: -30,
    left: -120,
    width: 56,
    height: 300,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  title: {
    marginTop: 18,
    fontSize: 28,
    fontWeight: '700',
    color: '#730622',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  caption: {
    marginTop: 8,
    fontSize: 14,
    color: '#8E3A4D',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});

export default CafeSplashScreen;