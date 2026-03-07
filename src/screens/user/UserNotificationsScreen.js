import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { userService } from '../../services';
import { useAuth } from '../../context/AuthContext';
import { getTimeAgo, parseApiResponse } from './shared';

// Extracted outside component for stability
const NOTIFICATION_ICONS = {
  rescuer_approved: { name: 'shield-checkmark', color: COLORS.success, bg: COLORS.success + '20' },
  rescuer_rejected: { name: 'close-circle', color: COLORS.error, bg: COLORS.error + '20' },
  adoption_update: { name: 'heart', color: COLORS.primary, bg: COLORS.primary + '20' },
  rescue_update: { name: 'medkit', color: '#64B5F6', bg: '#64B5F620' },
  shelter_transfer: { name: 'home', color: '#6366F1', bg: '#6366F120' },
  shelter_transfer_approved: { name: 'checkmark-circle', color: COLORS.success, bg: COLORS.success + '20' },
  shelter_transfer_rejected: { name: 'close-circle', color: COLORS.error, bg: COLORS.error + '20' },
  shelter_transfer_completed: { name: 'shield-checkmark', color: COLORS.success, bg: COLORS.success + '20' },
  system: { name: 'information-circle', color: COLORS.warning, bg: COLORS.warning + '20' },
  default: { name: 'notifications', color: COLORS.primary, bg: COLORS.primary + '20' },
};

const getNotificationIcon = (type, data) => {
  // Handle shelter_transfer with status-specific icons
  if (type === 'shelter_transfer' && data) {
    try {
      const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
      if (parsedData.status === 'approved') {
        return NOTIFICATION_ICONS.shelter_transfer_approved;
      } else if (parsedData.status === 'rejected') {
        return NOTIFICATION_ICONS.shelter_transfer_rejected;
      } else if (parsedData.status === 'completed') {
        return NOTIFICATION_ICONS.shelter_transfer_completed;
      }
    } catch (e) {
      // Use default shelter_transfer icon
    }
  }
  return NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.default;
};

const UserNotificationsScreen = ({ onGoBack, onNavigateToAdoptions, onNavigateToRescues }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Clear notifications and re-fetch when user changes
  useEffect(() => {
    // Clear old notifications immediately when user changes
    setNotifications([]);
    setLoading(true);
    
    if (user?.id) {
      fetchNotifications();
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await userService.getNotifications();
      const data = parseApiResponse(response);
      setNotifications(data);
    } catch (error) {
      // Silently ignore errors
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      await userService.markNotificationAsRead(notificationId);
      
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
      // Still mark locally
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      );
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await userService.markAllNotificationsAsRead();
      
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, is_read: true }))
      );
    } catch (error) {
      console.error('Error marking all as read:', error);
      // Still mark locally
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, is_read: true }))
      );
    }
  }, []);

  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);

  // Handle notification press - mark as read and navigate
  const handleNotificationPress = useCallback((notification) => {
    // Mark as read first
    markAsRead(notification.id);
    
    // Parse notification data if needed
    let notificationData = notification.data;
    if (typeof notificationData === 'string') {
      try {
        notificationData = JSON.parse(notificationData);
      } catch (e) {
        notificationData = {};
      }
    }
    
    // Navigate based on notification type
    switch (notification.type) {
      case 'adoption_update':
      case 'adoption_approved':
      case 'adoption_rejected':
        if (onNavigateToAdoptions) {
          onNavigateToAdoptions();
        }
        break;
      case 'rescue_update':
      case 'rescue_assigned':
      case 'rescue_completed':
        if (onNavigateToRescues) {
          onNavigateToRescues();
        }
        break;
      case 'rescuer_approved':
      case 'rescuer_rejected':
        // Could navigate to rescuer dashboard or settings
        break;
      case 'shelter_transfer':
      case 'shelter_transfer_approved':
      case 'shelter_transfer_rejected':
      case 'shelter_transfer_completed':
        // Shelter transfer notifications - could navigate to shelter section
        break;
      default:
        // Just mark as read for other types
        break;
    }
  }, [markAsRead, onNavigateToAdoptions, onNavigateToRescues]);

  const renderNotification = useCallback((notification) => {
    const iconData = getNotificationIcon(notification.type, notification.data);
    
    return (
      <TouchableOpacity
        key={notification.id}
        style={[
          styles.notificationCard,
          !notification.is_read && styles.notificationCardUnread,
        ]}
        onPress={() => handleNotificationPress(notification)}
        activeOpacity={0.7}
      >
        <View style={[styles.notificationIcon, { backgroundColor: iconData.bg }]}>
          <Ionicons name={iconData.name} size={24} color={iconData.color} />
        </View>
        
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={styles.notificationTitle}>{notification.title}</Text>
            {!notification.is_read && <View style={styles.unreadDot} />}
          </View>
          
          <Text style={styles.notificationMessage}>{notification.message}</Text>
          
          <Text style={styles.notificationTime}>{getTimeAgo(notification.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  }, [markAsRead]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
        {unreadCount === 0 && <View style={{ width: 80 }} />}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
        >
          {notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="bell-off-outline" size={80} color="#DDD" />
              <Text style={styles.emptyTitle}>No Notifications</Text>
              <Text style={styles.emptyText}>
                You're all caught up! We'll notify you when there's something new.
              </Text>
            </View>
          ) : (
            <View style={styles.notificationsContainer}>
              {notifications.map(renderNotification)}
            </View>
          )}
          
          <View style={styles.bottomSpacing} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 44,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.backgroundWhite,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  headerBadge: {
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
    paddingHorizontal: 6,
  },
  headerBadgeText: {
    color: COLORS.textWhite,
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
  markAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  markAllText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: FONTS.weights.semiBold,
  },
  scrollView: {
    flex: 1,
  },
  notificationsContainer: {
    padding: SPACING.lg,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  notificationCardUnread: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  notificationIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  notificationTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginLeft: SPACING.xs,
  },
  notificationMessage: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    lineHeight: 20,
    marginBottom: SPACING.xs,
  },
  notificationTime: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textLight,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: SPACING.xxl,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomSpacing: {
    height: 20,
  },
});

export default memo(UserNotificationsScreen);
