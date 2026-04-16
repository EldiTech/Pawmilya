import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

export default function SwitchAccountModal({ visible, onClose, onAddAccount }) {
  const { savedAccounts, removeSavedAccount, login, user: activeUser } = useAuth();
  const [loadingEmail, setLoadingEmail] = useState(null);

  const handleSwitch = async (account) => {
    if (activeUser?.email === account.email) {
      onClose();
      return; // Already logged into this account
    }

    try {
      setLoadingEmail(account.email);
      const res = await login(account.email, account.password);
      if (res.success) {
        onClose();
      } else {
        Alert.alert('Login Failed', res.message || 'Please log in manually.');
      }
    } catch (err) {
      Alert.alert('Login Failed', err.message || 'Could not log in.');
    } finally {
      setLoadingEmail(null);
    }
  };

  const handleRemove = (account) => {
    Alert.alert('Remove Account', `Remove ${account.email} from saved accounts?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeSavedAccount(account.email) }
    ]);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.background} onPress={onClose} activeOpacity={1} />
        
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Switch Account</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
          </View>

          <View style={styles.accountList}>
            {savedAccounts.length === 0 && (
              <Text style={styles.noAccounts}>No saved accounts</Text>
            )}

            {savedAccounts.map((account) => {
              const isActive = activeUser?.email === account.email;
              const isLoading = loadingEmail === account.email;

              return (
                <View key={account.email} style={[styles.accountItem, isActive && styles.accountItemActive]}>
                  <TouchableOpacity 
                    style={styles.accountDetails}
                    onPress={() => handleSwitch(account)}
                    disabled={isLoading}
                  >
                    <View style={styles.avatar}>
                      <Ionicons name="person" size={20} color={isActive ? COLORS.primary : COLORS.textMedium} />
                    </View>
                    <View style={styles.info}>
                      <Text style={[styles.name, isActive && styles.textActive]}>{account.displayName}</Text>
                      <Text style={styles.email}>{account.email}</Text>
                    </View>
                    
                    {isLoading && <ActivityIndicator color={COLORS.primary} size="small" style={{ marginLeft: 10 }} />}
                    {isActive && !isLoading && <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />}
                  </TouchableOpacity>

                  {/* Remove Account Button */}
                  <TouchableOpacity 
                    style={styles.moreOptions} 
                    onPress={() => handleRemove(account)}
                    disabled={isLoading}
                  >
                    <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {savedAccounts.length < 5 && (
            <TouchableOpacity style={styles.addAccount} onPress={onAddAccount}>
              <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} />
              <Text style={styles.addAccountText}>Add Account</Text>
            </TouchableOpacity>
          )}

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textDark,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  accountList: {
    marginBottom: SPACING.md,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  accountItemActive: {
    backgroundColor: '#F5F5F5',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 0,
    marginVertical: SPACING.xs,
  },
  accountDetails: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textDark,
  },
  textActive: {
    color: COLORS.primary,
  },
  email: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  moreOptions: {
    padding: SPACING.sm,
    marginLeft: SPACING.xs,
  },
  addAccount: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: RADIUS.md,
  },
  addAccountText: {
    marginLeft: SPACING.sm,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  noAccounts: {
    textAlign: 'center',
    color: COLORS.textLight,
    paddingVertical: SPACING.md,
  },
});
