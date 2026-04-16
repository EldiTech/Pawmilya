/**
 * Shared Admin Components
 * Reusable UI components for admin screens
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import {
    ActivityIndicator,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { ADMIN_COLORS } from './constants';

export default function DummyComponentsRoute() { return null; }

/**
 * Admin Header Component
 * Consistent header design across all admin screens
 */
export const AdminHeader = memo(({ 
  title, 
  subtitle, 
  onGoBack, 
  rightAction,
  rightIcon = 'add',
  showBadge = false,
  badgeCount = 0,
}) => (
  <LinearGradient
    colors={[ADMIN_COLORS.primary, ADMIN_COLORS.primaryDark]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.headerGradient}
  >
    <View style={styles.header}>
      <TouchableOpacity onPress={onGoBack} style={styles.backBtn} activeOpacity={0.8}>
        <Ionicons name="arrow-back" size={24} color="#FFF" />
      </TouchableOpacity>
      <View style={styles.headerTitleWrap}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
      </View>
      {rightAction ? (
        <TouchableOpacity style={styles.addBtn} onPress={rightAction} activeOpacity={0.8}>
          <LinearGradient
            colors={['#FFFFFF', '#F8F9FE']}
            style={styles.addBtnGradient}
          >
            <Ionicons name={rightIcon} size={24} color={ADMIN_COLORS.primary} />
          </LinearGradient>
        </TouchableOpacity>
      ) : showBadge ? (
        <View style={styles.headerBadge}>
          <LinearGradient
            colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.15)']}
            style={styles.headerBadgeGradient}
          >
            <Text style={styles.headerBadgeText}>{badgeCount}</Text>
          </LinearGradient>
        </View>
      ) : (
        <View style={styles.headerPlaceholder} />
      )}
    </View>
  </LinearGradient>
));

/**
 * Search Bar Component
 */
export const AdminSearchBar = memo(({ 
  value, 
  onChangeText, 
  placeholder = 'Search...',
  onClear,
}) => (
  <View style={styles.searchContainer}>
    <View style={styles.searchWrap}>
      <View style={styles.searchIconWrap}>
        <Ionicons name="search" size={20} color={ADMIN_COLORS.primary} />
      </View>
      <TextInput
        style={styles.searchInput}
        placeholder={placeholder}
        placeholderTextColor={ADMIN_COLORS.textMuted}
        value={value}
        onChangeText={onChangeText}
      />
      {value?.length > 0 && (
        <TouchableOpacity onPress={onClear || (() => onChangeText(''))} style={styles.clearBtn}>
          <Ionicons name="close-circle" size={22} color={ADMIN_COLORS.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  </View>
));

/**
 * Filter Tabs Component
 */
export const AdminFilterTabs = memo(({ 
  filters, 
  activeFilter, 
  onFilterChange,
  getCount,
}) => (
  <View style={styles.filterContainer}>
    {filters.map((f) => (
      <TouchableOpacity
        key={f.key}
        onPress={() => onFilterChange(f.key)}
        style={[
          styles.filterTab,
          activeFilter === f.key && styles.filterTabActive,
        ]}
        activeOpacity={0.7}
      >
        <Ionicons
          name={f.icon}
          size={16}
          color={activeFilter === f.key ? '#FFF' : ADMIN_COLORS.textLight}
          style={styles.filterIcon}
        />
        <Text
          style={[
            styles.filterLabel,
            activeFilter === f.key && styles.filterLabelActive,
          ]}
        >
          {f.label}
        </Text>
        {getCount && (
          <View style={[
            styles.filterCount,
            activeFilter === f.key && styles.filterCountActive,
          ]}>
            <Text style={[
              styles.filterCountText,
              activeFilter === f.key && styles.filterCountTextActive,
            ]}>
              {getCount(f.key)}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    ))}
  </View>
));

/**
 * Status Badge Component
 */
export const StatusBadge = memo(({ status, config }) => {
  const statusInfo = config[status] || { color: '#666', label: status, bg: '#F0F0F0', icon: 'help-circle' };
  
  return (
    <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
      <Ionicons name={statusInfo.icon} size={14} color={statusInfo.color} />
      <Text style={[styles.statusText, { color: statusInfo.color }]}>
        {statusInfo.label}
      </Text>
    </View>
  );
});

/**
 * Loading Overlay Component
 */
export const AdminLoadingOverlay = memo(({ visible = false, message = 'Loading...' }) => {
  if (!visible) return null;
  
  return (
    <View style={styles.loadingOverlay}>
      <View style={styles.loadingCard}>
        <ActivityIndicator size="large" color={ADMIN_COLORS.primary} />
        <Text style={styles.loadingText}>{message}</Text>
      </View>
    </View>
  );
});

/**
 * Empty State Component
 */
export const AdminEmptyState = memo(({ 
  icon = 'document-text-outline', 
  title = 'No Data', 
  message = 'No items found',
}) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyIconWrap}>
      <Ionicons name={icon} size={48} color={ADMIN_COLORS.textMuted} />
    </View>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyMessage}>{message}</Text>
  </View>
));

/**
 * Action Button Component
 */
export const AdminActionButton = memo(({ 
  icon, 
  color, 
  onPress, 
  size = 'medium',
  style,
}) => {
  const buttonSize = size === 'small' ? 32 : size === 'large' ? 44 : 38;
  const iconSize = size === 'small' ? 16 : size === 'large' ? 22 : 18;
  
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.actionButton,
        { 
          width: buttonSize, 
          height: buttonSize, 
          backgroundColor: `${color}15`,
        },
        style,
      ]}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={iconSize} color={color} />
    </TouchableOpacity>
  );
});

/**
 * Card Component
 */
export const AdminCard = memo(({ children, style, onPress }) => {
  const content = (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
  
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }
  
  return content;
});

/**
 * Confirmation Modal Button
 */
export const ModalButton = memo(({ 
  title, 
  onPress, 
  variant = 'primary', // 'primary', 'secondary', 'danger'
  loading = false,
  disabled = false,
  style,
}) => {
  const getColors = () => {
    switch (variant) {
      case 'danger':
        return [ADMIN_COLORS.danger, '#DC2626'];
      case 'secondary':
        return [ADMIN_COLORS.border, ADMIN_COLORS.border];
      default:
        return [ADMIN_COLORS.primary, ADMIN_COLORS.primaryDark];
    }
  };
  
  return (
    <TouchableOpacity 
      onPress={onPress} 
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[styles.modalButton, style]}
    >
      <LinearGradient
        colors={getColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.modalButtonGradient,
          variant === 'secondary' && styles.modalButtonSecondary,
          (disabled || loading) && styles.modalButtonDisabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={variant === 'secondary' ? ADMIN_COLORS.text : '#FFF'} />
        ) : (
          <Text style={[
            styles.modalButtonText,
            variant === 'secondary' && styles.modalButtonTextSecondary,
          ]}>
            {title}
          </Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  // Header styles
  headerGradient: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  addBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  addBtnGradient: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
  headerPlaceholder: {
    width: 44,
  },
  headerBadge: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  headerBadgeGradient: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  headerBadgeText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  
  // Search styles
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: ADMIN_COLORS.background,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 14,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    shadowColor: ADMIN_COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIconWrap: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: ADMIN_COLORS.text,
    paddingVertical: 12,
  },
  clearBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Filter styles
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: ADMIN_COLORS.background,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: ADMIN_COLORS.card,
    marginRight: 8,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  filterTabActive: {
    backgroundColor: ADMIN_COLORS.primary,
    borderColor: ADMIN_COLORS.primary,
  },
  filterIcon: {
    marginRight: 6,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: ADMIN_COLORS.textLight,
  },
  filterLabelActive: {
    color: '#FFF',
  },
  filterCount: {
    marginLeft: 6,
    backgroundColor: ADMIN_COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  filterCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: ADMIN_COLORS.textMuted,
  },
  filterCountTextActive: {
    color: '#FFF',
  },
  
  // Status badge styles
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  
  // Loading styles
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingCard: {
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: ADMIN_COLORS.textSecondary,
    fontWeight: '500',
  },
  
  // Empty state styles
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: ADMIN_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: ADMIN_COLORS.text,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: ADMIN_COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Action button styles
  actionButton: {
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Card styles
  card: {
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    shadowColor: ADMIN_COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  
  // Modal button styles
  modalButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: ADMIN_COLORS.background,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  modalButtonTextSecondary: {
    color: ADMIN_COLORS.text,
  },
});
