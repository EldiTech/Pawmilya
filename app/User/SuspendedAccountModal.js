import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebaseConfig';

// Context for suspension state
const SuspensionContext = createContext(null);

// Suspension Provider Component
export const SuspensionProvider = ({ children, onLogout }) => {
  const { user, logout } = useAuth();
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let intervalId;
    let cancelled = false;

    const checkSuspension = async () => {
      if (!user?.uid || cancelled) {
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const snapshot = await getDoc(userRef);

        if (!snapshot.exists()) {
          return;
        }

        const userData = snapshot.data() || {};
        if (userData.status === 'suspended') {
          setIsSuspended(true);
          setSuspensionReason(userData.suspension_reason || 'Violation of community guidelines');
          setShowModal(true);
        } else {
          setIsSuspended(false);
          setShowModal(false);
        }
      } catch {
        // Ignore transient network errors; next poll will retry.
      }
    };

    if (user?.uid) {
      checkSuspension();
      intervalId = setInterval(checkSuspension, 60000);
    }

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [user?.uid]);

  // Keep for backwards compatibility for any manual checks
  const checkSuspensionStatus = useCallback(async () => {
    // Handled automatically via onSnapshot now
  }, []);

  // Handle acknowledge
  const handleAcknowledge = useCallback(async () => {
    setShowModal(false);
    await logout();
    if (onLogout) {
      onLogout();
    }
  }, [logout, onLogout]);

  return (
    <SuspensionContext.Provider value={{ isSuspended, checkSuspensionStatus }}>
      {children}
      
      {/* Suspended Account Modal */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.iconContainer}>
              <Ionicons name="ban" size={60} color={COLORS.error} />
            </View>
            
            <Text style={styles.title}>Account Suspended</Text>
            
            <Text style={styles.message}>
              Your account has been suspended due to a violation of our community guidelines.
            </Text>
            
            {suspensionReason && (
              <View style={styles.reasonContainer}>
                <Text style={styles.reasonLabel}>Reason:</Text>
                <Text style={styles.reasonText}>{suspensionReason}</Text>
              </View>
            )}
            
            <Text style={styles.note}>
              If you believe this was a mistake, please contact our support team for assistance.
            </Text>
            
            <TouchableOpacity
              style={styles.acknowledgeButton}
              onPress={handleAcknowledge}
            >
              <Text style={styles.acknowledgeButtonText}>I Understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SuspensionContext.Provider>
  );
};

// Hook to use suspension check
export const useSuspensionCheck = () => {
  const context = useContext(SuspensionContext);
  if (!context) {
    // Return a no-op if not within provider
    return { isSuspended: false, checkSuspensionStatus: () => {} };
  }
  return context;
};

// Standalone Modal Component for individual screens
export const SuspendedAccountModal = ({ visible, reason, onAcknowledge }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.iconContainer}>
            <Ionicons name="ban" size={60} color={COLORS.error} />
          </View>
          
          <Text style={styles.title}>Account Suspended</Text>
          
          <Text style={styles.message}>
            Your account has been suspended due to a violation of our community guidelines.
          </Text>
          
          {reason && (
            <View style={styles.reasonContainer}>
              <Text style={styles.reasonLabel}>Reason:</Text>
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          )}
          
          <Text style={styles.note}>
            If you believe this was a mistake, please contact our support team for assistance.
          </Text>
          
          <TouchableOpacity
            style={styles.acknowledgeButton}
            onPress={onAcknowledge}
          >
            <Text style={styles.acknowledgeButtonText}>I Understand</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalContent: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.error + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.error,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  message: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  reasonContainer: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    width: '100%',
    marginBottom: SPACING.lg,
  },
  reasonLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textDark,
    marginBottom: SPACING.xs,
  },
  reasonText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    lineHeight: 20,
  },
  note: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    fontStyle: 'italic',
  },
  acknowledgeButton: {
    backgroundColor: COLORS.error,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxl,
    borderRadius: RADIUS.round,
    width: '100%',
  },
  acknowledgeButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
    textAlign: 'center',
  },
});

export default SuspendedAccountModal;
