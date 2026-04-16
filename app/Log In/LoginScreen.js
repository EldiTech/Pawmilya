import { Ionicons } from "@expo/vector-icons";
import { sendPasswordResetEmail } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Logo from "../../components/Logo";
import SwitchAccountModal from "../../components/ui/SwitchAccountModal";
import { COLORS, FONTS, RADIUS, SPACING } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";

const LoginScreen = ({
  onNavigateToSignUp,
  onGoBack,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [switchAccountVisible, setSwitchAccountVisible] = useState(false);
  const { savedAccounts } = useAuth();
  const screenAnim = useRef(new Animated.Value(0)).current;
  const loginButtonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(screenAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [screenAnim]);

  const onLoginPressIn = useCallback(() => {
    Animated.spring(loginButtonScale, {
      toValue: 0.97,
      friction: 6,
      tension: 220,
      useNativeDriver: true,
    }).start();
  }, [loginButtonScale]);

  const onLoginPressOut = useCallback(() => {
    Animated.spring(loginButtonScale, {
      toValue: 1,
      friction: 6,
      tension: 220,
      useNativeDriver: true,
    }).start();
  }, [loginButtonScale]);

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

  const handleLogin = async () => {
    const safeEmail = String(email || "").trim();
    const safePassword = String(password || "");

    if (!safeEmail || !safePassword) {
      Alert.alert("Missing Fields", "Please enter both email and password.");
      return;
    }

    if (!onLoginSuccess) {
      Alert.alert("Error", "Login handler is not available.");
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await onLoginSuccess({ email: safeEmail, password: safePassword });

      if (result?.success === false) {
        Alert.alert("Login Failed", result.message || "Unable to sign in.");
      }
    } catch (error) {
      Alert.alert("Login Failed", error?.message || "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    const safeEmail = String(email || "").trim();
    if (!safeEmail) {
      Alert.alert("Forgot Password", "Please enter your email address into the email field above to reset your password.");
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(safeEmail)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");  
      return;
    }

    try {
      setIsSubmitting(true);
      
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", safeEmail));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        Alert.alert("Account Not Found", "There is no account registered with this email.");
        return;
      }

      await sendPasswordResetEmail(auth, safeEmail);
      Alert.alert("Password Reset Sent", "Check your email inbox (and spam folder) for a link to reset your password.");
    } catch (error) {
      console.error(error);
      Alert.alert("Password Reset Failed", error?.message || "Unable to send reset email.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Back Button */}
      <Animated.View style={[styles.backButtonWrapper, screenAnimatedStyle]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onGoBack}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />      
        </TouchableOpacity>
      </Animated.View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Animated.View style={screenAnimatedStyle}>
        {/* Logo Section */}
        <View style={styles.logoSection} accessibilityRole="header">
          <Logo size="large" />
          <Text style={styles.appName} accessibilityRole="header">
            Pawmilya
          </Text>
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
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={COLORS.textMedium}
            />
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
              accessibilityLabel={
                showPassword ? "Hide password" : "Show password"
              }
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
            style={styles.forgotPasswordContainer} 
            onPress={handleForgotPassword}
            disabled={isSubmitting}
            accessibilityLabel="Forgot your password?"
            accessibilityRole="button"
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <Animated.View style={{ transform: [{ scale: loginButtonScale }] }}>
            <TouchableOpacity
              style={styles.loginButton}
              activeOpacity={0.9}
              onPress={handleLogin}
              onPressIn={onLoginPressIn}
              onPressOut={onLoginPressOut}
              disabled={isSubmitting}
              accessibilityLabel="Sign in button"
              accessibilityRole="button"
            >
              <Text style={styles.loginButtonText}>{isSubmitting ? "Signing In..." : "Sign In"}</Text>
            </TouchableOpacity>
          </Animated.View>

          {savedAccounts.length > 0 && (
            <TouchableOpacity 
              style={styles.savedAccountsButton} 
              onPress={() => setSwitchAccountVisible(true)}
            >
              <Ionicons name="people-outline" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
              <Text style={styles.savedAccountsButtonText}>Use Saved Account</Text>
            </TouchableOpacity>
          )}
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
        </Animated.View>
      </KeyboardAvoidingView>

      <SwitchAccountModal 
        visible={switchAccountVisible} 
        onClose={() => setSwitchAccountVisible(false)}
        onAddAccount={() => {
          setSwitchAccountVisible(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 44,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
  },

  // Back Button
  backButtonWrapper: {
    position: "absolute",
    top: Platform.OS === "android" ? StatusBar.currentHeight + 10 : 54,
    left: SPACING.md,
    zIndex: 10,
  },
  backButton: {
    padding: SPACING.sm,
  },

  // Logo
  logoSection: {
    alignItems: "center",
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
    flexDirection: "row",
    alignItems: "center",
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
  forgotPasswordContainer: {
    alignSelf: "flex-end",
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  forgotPasswordText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.round,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.lg,
  },
  loginButtonText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },
  savedAccountsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  savedAccountsButtonText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
  },

  // Sign Up
  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
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
