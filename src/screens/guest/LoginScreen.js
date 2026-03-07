import React, { useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Logo from '../../components/Logo';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { isAdminLogin } from '../../config/adminCredentials';
import { useAuth } from '../../context/AuthContext';

const LoginScreen = ({ onNavigateToSignUp, onGoBack, onLoginSuccess, onAdminLogin }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      // Check if admin login via API
      const adminResult = await isAdminLogin(email, password);
      if (adminResult.success) {
        onAdminLogin && onAdminLogin(adminResult.token);
        return;
      }

      // Regular user login via API
      const response = await login(email, password);
      
      if (response.success) {
        onLoginSuccess && onLoginSuccess();
      } else {
        Alert.alert(
          'Login Failed',
          response.message || 'Invalid email or password. Please try again.'
        );
      }
    } catch (error) {
      Alert.alert(
        'Login Failed',
        error.message || 'Invalid email or password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Back Button */}
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={onGoBack}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>

        {/* Logo Section */}
        <View style={styles.logoSection} accessibilityRole="header">
          <Logo size="large" />
          <Text style={styles.appName} accessibilityRole="header">Pawmilya</Text>
          <Text style={styles.tagline}>Every paw deserves a home</Text>
        </View>

        {/* Login Form */}
        <View style={styles.formSection}>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color={COLORS.textMedium} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={COLORS.textMedium}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              accessibilityLabel="Email input"
              accessibilityHint="Enter your email address"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.textMedium} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={COLORS.textMedium}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              accessibilityLabel="Password input"
              accessibilityHint="Enter your password"
            />
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)}
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              accessibilityRole="button"
            >
              <Ionicons 
                name={showPassword ? "eye-outline" : "eye-off-outline"} 
                size={20} 
                color={COLORS.textMedium} 
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.loginButton, loading && styles.loginButtonDisabled]} 
            activeOpacity={0.8} 
            onPress={handleLogin}
            disabled={loading}
            accessibilityLabel="Sign in button"
            accessibilityRole="button"
            accessibilityState={{ disabled: loading }}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.textWhite} accessibilityLabel="Signing in" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Sign Up Link */}
        <View style={styles.signUpContainer}>
          <Text style={styles.signUpText}>Don't have an account? </Text>
          <TouchableOpacity 
            onPress={onNavigateToSignUp}
            accessibilityLabel="Sign up"
            accessibilityRole="link"
            accessibilityHint="Navigate to the sign up screen"
          >
            <Text style={styles.signUpLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 44,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },

  // Back Button
  backButton: {
    position: 'absolute',
    top: SPACING.lg,
    left: SPACING.md,
    padding: SPACING.sm,
    zIndex: 10,
  },

  // Logo
  logoSection: {
    alignItems: 'center',
    marginBottom: SPACING.xxxl,
  },
  appName: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginTop: SPACING.lg,
  },
  tagline: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    marginTop: SPACING.xs,
  },

  // Form
  formSection: {
    marginBottom: SPACING.xl,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  input: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark,
    paddingVertical: SPACING.xs,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.round,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },

  // Sign Up
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signUpText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
  },
  signUpLink: {
    fontSize: FONTS.sizes.md,
    color: COLORS.primary,
    fontWeight: FONTS.weights.bold,
  },
});

export default memo(LoginScreen);
