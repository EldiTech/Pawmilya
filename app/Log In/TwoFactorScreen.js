import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';

const OTP_LENGTH = 6;

const TwoFactorScreen = ({ maskedEmail, onVerifySuccess, onGoBack, onResend, isTransitionLoading = false }) => {
  const [code, setCode] = useState(Array(OTP_LENGTH).fill(''));
  const [countdown, setCountdown] = useState(60);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef([]);
  const isBusy = isVerifying || isResending || isTransitionLoading;

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Auto-focus the first input on mount
  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
  }, []);

  const handleChange = (text, index) => {
    // Only allow digits
    const digit = text.replace(/[^0-9]/g, '');
    const newCode = [...code];

    // Handle paste of full 6-digit code into first input
    if (index === 0 && digit.length === OTP_LENGTH) {
      const digits = digit.split('');
      for (let i = 0; i < OTP_LENGTH; i++) {
        newCode[i] = digits[i];
      }
      setCode(newCode);
      inputRefs.current[OTP_LENGTH - 1]?.focus();
      handleVerify(digit);
      return;
    }

    if (digit.length > 1) {
      // Handle paste — distribute digits across inputs
      const digits = digit.split('');
      for (let i = 0; i < digits.length && index + i < OTP_LENGTH; i++) {
        newCode[index + i] = digits[i];
      }
      setCode(newCode);
      const nextIndex = Math.min(index + digits.length, OTP_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();
    } else {
      newCode[index] = digit;
      setCode(newCode);
      if (digit && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    }

    // Auto-submit when all digits are filled
    const fullCode = newCode.join('');
    if (fullCode.length === OTP_LENGTH && !newCode.includes('')) {
      handleVerify(fullCode);
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (otpCode) => {
    const finalCode = otpCode || code.join('');
    if (finalCode.length !== OTP_LENGTH) {
      Alert.alert('Invalid Code', 'Please enter the full 6-digit code.');
      return;
    }

    if (!onVerifySuccess) {
      Alert.alert('Error', 'Verification handler is not available.');
      return;
    }

    try {
      setIsVerifying(true);
      const result = await onVerifySuccess({ code: finalCode });
      if (result?.success === false) {
        Alert.alert('Verification Failed', result.message || 'Invalid verification code.');
      }
    } catch (error) {
      Alert.alert('Verification Failed', error?.message || 'Unable to verify code.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;

    if (!onResend) {
      Alert.alert('Error', 'Resend handler is not available.');
      return;
    }

    setCountdown(60);
    setCode(Array(OTP_LENGTH).fill(''));
    inputRefs.current[0]?.focus();

    try {
      setIsResending(true);
      const result = await onResend();
      if (result?.success === false) {
        Alert.alert('Resend Failed', result.message || 'Unable to resend code.');
      } else {
        Alert.alert('Code Sent', 'A new verification code was sent to your email.');
      }
    } catch (error) {
      Alert.alert('Resend Failed', error?.message || 'Unable to resend code.');
    } finally {
      setIsResending(false);
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
          disabled={isBusy}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>

        {/* Icon Section */}
        <View style={styles.iconSection}>
          <View style={styles.shieldIcon}>
            <Ionicons name="shield-checkmark" size={64} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Verify Your Identity</Text>
          <Text style={styles.subtitle}>
            We've sent a 6-digit verification code to
          </Text>
          <Text style={styles.emailText}>{maskedEmail}</Text>
        </View>

        {/* OTP Input */}
        <View style={styles.otpContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={[
                styles.otpInput,
                digit ? styles.otpInputFilled : null,
              ]}
              value={digit}
              onChangeText={(text) => handleChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={index === 0 ? OTP_LENGTH : 1}
              selectTextOnFocus
              editable={!isBusy}
              accessibilityLabel={`Digit ${index + 1}`}
            />
          ))}
        </View>

        {/* Verify Button */}
        <TouchableOpacity
          style={styles.verifyButton}
          activeOpacity={0.8}
          onPress={() => handleVerify()}
          disabled={isBusy}
          accessibilityLabel="Verify code"
          accessibilityRole="button"
        >
          <Text style={styles.verifyButtonText}>{isTransitionLoading ? 'Signing you in...' : isVerifying ? 'Verifying...' : 'Verify'}</Text>
        </TouchableOpacity>

        {/* Resend */}
        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn't receive the code? </Text>
          {countdown > 0 ? (
            <Text style={styles.countdownText}>Resend in {countdown}s</Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={isBusy}>
              <Text style={styles.resendLink}>{isResending ? 'Sending...' : 'Resend Code'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {isTransitionLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading your account...</Text>
          </View>
        )}
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
  backButton: {
    position: 'absolute',
    top: SPACING.lg,
    left: SPACING.md,
    padding: SPACING.sm,
    zIndex: 10,
  },
  iconSection: {
    alignItems: 'center',
    marginBottom: SPACING.xxxl,
  },
  shieldIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${COLORS.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    textAlign: 'center',
  },
  emailText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
    marginTop: SPACING.xs,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: SPACING.xxl,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.backgroundWhite,
    textAlign: 'center',
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  otpInputFilled: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}08`,
  },
  verifyButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyButtonText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  resendText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
  },
  countdownText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    fontWeight: FONTS.weights.semiBold,
  },
  resendLink: {
    fontSize: FONTS.sizes.md,
    color: COLORS.primary,
    fontWeight: FONTS.weights.bold,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: `${COLORS.background}E6`,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark,
    fontWeight: FONTS.weights.semiBold,
  },
});

export default memo(TwoFactorScreen);
