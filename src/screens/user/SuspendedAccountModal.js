import React, { useState, useEffect, useRef, createContext, useContext, memo, useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import userService from '../../services/userService';

// Context for suspension state
const SuspensionContext = createContext(null);

// Suspension Provider Component
export const SuspensionProvider = ({ children, onLogout }) => {
  const { logout } = useAuth();
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [showModal, setShowModal] = useState(false);
  const checkInterval = useRef(null);

  // Function to check suspension status
  const checkSuspensionStatus = useCallback(async () => {
    try {
      const response = await userService.checkStatus();
      if (response.success && response.data?.suspended) {
        setIsSuspended(true);
        setSuspensionReason(response.data.suspension_reason || 'Violation of community guidelines');
        setShowModal(true);
        // Clear interval once suspended is detected
        if (checkInterval.current) {
          clearInterval(checkInterval.current);
        }
      }
    } catch (error) {
      if (error?.status === 403 && error?.message?.toLowerCase().includes('suspended')) {
        setIsSuspended(true);
        setSuspensionReason('Violation of community guidelines');
        setShowModal(true);
        if (checkInterval.current) {
          clearInterval(checkInterval.current);
        }
      }
      // Silently ignore other errors (network issues, etc.)
    }
  }, []);

  // Check immediately on mount and every 30 seconds (battery-friendly)
  useEffect(() => {
    // Immediate check
    checkSuspensionStatus();
    
    // Check every 30 seconds — balanced between responsiveness and efficiency
    checkInterval.current = setInterval(checkSuspensionStatus, 30000);
    
    return () => {
      if (checkInterval.current) {
        clearInterval(checkInterval.current);
      }
    };
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
