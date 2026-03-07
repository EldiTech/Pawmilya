/**
 * Shared components for user screens
 * Reusable UI components to reduce code duplication
 */

import React, { memo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl as RNRefreshControl,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../constants/theme';
import { headerStyles, searchStyles, stateStyles } from './styles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Offline Banner component - shows when device is offline
 */
export const OfflineBanner = memo(({ isVisible, onRetry }) => {
  const translateY = useRef(new Animated.Value(-50)).current;
  
  useEffect(() => {
    Animated.timing(translateY, {
      toValue: isVisible ? 0 : -50,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isVisible, translateY]);
  
  if (!isVisible) return null;
  
  return (
    <Animated.View 
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: '#FF5252',
          paddingVertical: SPACING.sm,
          paddingHorizontal: SPACING.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        },
        { transform: [{ translateY }] }
      ]}
      accessibilityLabel="You are offline"
      accessibilityRole="alert"
    >
      <Ionicons name="cloud-offline" size={18} color="#FFF" />
      <Text style={{ color: '#FFF', marginLeft: SPACING.xs, fontWeight: FONTS.weights.semiBold, fontSize: FONTS.sizes.sm }}>
        You're offline
      </Text>
      {onRetry && (
        <TouchableOpacity 
          onPress={onRetry} 
          style={{ marginLeft: SPACING.md, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm }}
          accessibilityLabel="Retry connection"
          accessibilityRole="button"
        >
          <Text style={{ color: '#FFF', fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.semiBold }}>Retry</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
});

OfflineBanner.displayName = 'OfflineBanner';

/**
 * Skeleton Loader component - placeholder while loading
 */
export const SkeletonLoader = memo(({ width = '100%', height = 20, borderRadius = RADIUS.sm, style }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;
  
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);
  
  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#E0E0E0',
          opacity,
        },
        style,
      ]}
    />
  );
});

SkeletonLoader.displayName = 'SkeletonLoader';

/**
 * Skeleton Card - for list item placeholders
 */
export const SkeletonCard = memo(({ style }) => (
  <View style={[{
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  }, style]}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <SkeletonLoader width={60} height={60} borderRadius={RADIUS.md} />
      <View style={{ flex: 1, marginLeft: SPACING.md }}>
        <SkeletonLoader width="70%" height={16} style={{ marginBottom: SPACING.xs }} />
        <SkeletonLoader width="50%" height={12} style={{ marginBottom: SPACING.xs }} />
        <SkeletonLoader width="40%" height={12} />
      </View>
    </View>
  </View>
));

SkeletonCard.displayName = 'SkeletonCard';

/**
 * Skeleton List - multiple skeleton cards
 */
export const SkeletonList = memo(({ count = 3, style }) => (
  <View style={style}>
    {Array.from({ length: count }).map((_, index) => (
      <SkeletonCard key={index} />
    ))}
  </View>
));

SkeletonList.displayName = 'SkeletonList';

/**
 * Error State with Retry component
 */
export const ErrorState = memo(({ 
  error,
  onRetry,
  title = 'Something went wrong',
  subtitle,
  style,
}) => (
  <View style={[stateStyles.emptyContainer, style]}>
    <View style={{
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#FFEBEE',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.lg,
    }}>
      <Ionicons name="alert-circle" size={40} color="#F44336" />
    </View>
    <Text style={stateStyles.emptyTitle}>{title}</Text>
    <Text style={stateStyles.emptySubtitle}>
      {subtitle || error?.message || 'An unexpected error occurred'}
    </Text>
    {onRetry && (
      <TouchableOpacity 
        style={{
          marginTop: SPACING.lg,
          backgroundColor: COLORS.primary,
          paddingVertical: SPACING.md,
          paddingHorizontal: SPACING.xl,
          borderRadius: RADIUS.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: SPACING.xs,
        }}
        onPress={onRetry}
        accessibilityLabel="Retry"
        accessibilityRole="button"
        accessibilityHint="Tap to try again"
      >
        <Ionicons name="refresh" size={18} color={COLORS.textWhite} />
        <Text style={{ 
          color: COLORS.textWhite, 
          fontWeight: FONTS.weights.semiBold,
          fontSize: FONTS.sizes.md,
        }}>
          Try Again
        </Text>
      </TouchableOpacity>
    )}
  </View>
));

ErrorState.displayName = 'ErrorState';

/**
 * Screen Header component
 */
export const ScreenHeader = memo(({ title, subtitle, style }) => (
  <View style={[headerStyles.container, style]} accessibilityRole="header">
    <Text style={headerStyles.title} accessibilityRole="header">{title}</Text>
    {subtitle && <Text style={headerStyles.subtitle}>{subtitle}</Text>}
  </View>
));

ScreenHeader.displayName = 'ScreenHeader';

/**
 * Search Bar component
 */
export const SearchBar = memo(({ 
  value, 
  onChangeText, 
  placeholder = 'Search...', 
  style,
  containerStyle,
}) => (
  <View style={[searchStyles.container, containerStyle]}>
    <View style={[searchStyles.bar, style]}>
      <Ionicons name="search" size={20} color={COLORS.textMedium} />
      <TextInput
        style={searchStyles.input}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMedium}
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel="Search input"
        accessibilityHint={`Search for ${placeholder.toLowerCase()}`}
      />
      {value?.length > 0 && (
        <TouchableOpacity 
          onPress={() => onChangeText('')}
          accessibilityLabel="Clear search"
          accessibilityRole="button"
        >
          <Ionicons name="close-circle" size={20} color={COLORS.textMedium} />
        </TouchableOpacity>
      )}
    </View>
  </View>
));

SearchBar.displayName = 'SearchBar';

/**
 * Loading State component
 */
export const LoadingState = memo(({ message = 'Loading...', style }) => (
  <View style={[stateStyles.loadingContainer, style]} accessibilityLabel={message}>
    <ActivityIndicator size="large" color={COLORS.primary} />
    <Text style={stateStyles.loadingText}>{message}</Text>
  </View>
));

LoadingState.displayName = 'LoadingState';

/**
 * Empty State component with illustration
 */
export const EmptyState = memo(({ 
  icon = 'alert-circle-outline', 
  iconSet = 'ionicons',
  title, 
  subtitle,
  actionLabel,
  onAction,
  illustration,
  style,
}) => (
  <View style={[stateStyles.emptyContainer, style]} accessibilityLabel={title}>
    {illustration ? (
      illustration
    ) : (
      <View style={{
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.accent,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.lg,
      }}>
        {iconSet === 'material' ? (
          <MaterialCommunityIcons name={icon} size={50} color={COLORS.primary} />
        ) : (
          <Ionicons name={icon} size={50} color={COLORS.primary} />
        )}
      </View>
    )}
    <Text style={stateStyles.emptyTitle}>{title}</Text>
    {subtitle && <Text style={stateStyles.emptySubtitle}>{subtitle}</Text>}
    {actionLabel && onAction && (
      <TouchableOpacity 
        style={{
          marginTop: SPACING.lg,
          backgroundColor: COLORS.primary,
          paddingVertical: SPACING.md,
          paddingHorizontal: SPACING.xl,
          borderRadius: RADIUS.lg,
        }}
        onPress={onAction}
      >
        <Text style={{ 
          color: COLORS.textWhite, 
          fontWeight: FONTS.weights.semiBold,
          fontSize: FONTS.sizes.md,
        }}>
          {actionLabel}
        </Text>
      </TouchableOpacity>
    )}
  </View>
));

EmptyState.displayName = 'EmptyState';

/**
 * Info Row component (icon + text)
 */
export const InfoRow = memo(({ icon, text, numberOfLines = 1, style }) => (
  <View style={[{ 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    marginBottom: SPACING.xs 
  }, style]}>
    <Ionicons name={icon} size={14} color={COLORS.textMedium} />
    <Text 
      style={{ 
        fontSize: FONTS.sizes.sm, 
        color: COLORS.textMedium, 
        marginLeft: SPACING.xs, 
        flex: 1 
      }} 
      numberOfLines={numberOfLines}
    >
      {text}
    </Text>
  </View>
));

InfoRow.displayName = 'InfoRow';

/**
 * Action Button component
 */
export const ActionButton = memo(({ 
  icon, 
  label, 
  onPress, 
  variant = 'primary', // 'primary', 'secondary', 'success', 'error', 'info'
  size = 'normal', // 'normal', 'small'
  style,
  disabled = false,
}) => {
  const variantColors = {
    primary: COLORS.primary,
    secondary: COLORS.backgroundWhite,
    success: COLORS.success,
    error: COLORS.error,
    info: '#2196F3',
  };
  
  const isSecondary = variant === 'secondary';
  const backgroundColor = isSecondary ? COLORS.backgroundWhite : variantColors[variant];
  const textColor = isSecondary ? COLORS.primary : COLORS.textWhite;
  const iconSize = size === 'small' ? 14 : 16;
  const fontSize = size === 'small' ? FONTS.sizes.xs : FONTS.sizes.sm;
  const padding = size === 'small' 
    ? { paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm }
    : { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md };
  
  return (
    <TouchableOpacity
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor,
          borderRadius: RADIUS.md,
          gap: 4,
          opacity: disabled ? 0.5 : 1,
          ...padding,
        },
        isSecondary && { borderWidth: 1, borderColor: COLORS.primary },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {icon && <Ionicons name={icon} size={iconSize} color={textColor} />}
      <Text style={{ 
        color: textColor, 
        fontSize, 
        fontWeight: FONTS.weights.semiBold 
      }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

ActionButton.displayName = 'ActionButton';

/**
 * Status Badge component
 */
export const StatusBadge = memo(({ 
  status, 
  icon,
  label,
  style,
}) => {
  const statusConfigs = {
    pending: {
      backgroundColor: '#FFF3E0',
      color: '#FF9800',
      icon: 'time-outline',
      label: 'Pending',
    },
    approved: {
      backgroundColor: '#E8F5E9',
      color: '#4CAF50',
      icon: 'checkmark-circle-outline',
      label: 'Approved',
    },
    rejected: {
      backgroundColor: '#FFEBEE',
      color: '#F44336',
      icon: 'close-circle-outline',
      label: 'Rejected',
    },
    in_progress: {
      backgroundColor: '#E3F2FD',
      color: '#2196F3',
      icon: 'sync-outline',
      label: 'In Progress',
    },
  };
  
  const config = statusConfigs[status?.toLowerCase()] || statusConfigs.pending;
  
  return (
    <View style={[
      {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: config.backgroundColor,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: RADIUS.sm,
        gap: 4,
      },
      style,
    ]}>
      <Ionicons name={icon || config.icon} size={12} color={config.color} />
      <Text style={{ 
        fontSize: FONTS.sizes.xs, 
        fontWeight: FONTS.weights.semiBold,
        color: config.color,
      }}>
        {label || config.label}
      </Text>
    </View>
  );
});

StatusBadge.displayName = 'StatusBadge';

/**
 * Refresh Control wrapper with default colors
 */
export const RefreshControl = (props) => (
  <RNRefreshControl 
    colors={[COLORS.primary]} 
    tintColor={COLORS.primary}
    {...props} 
  />
);

/**
 * Bottom Spacing component for screens with tab bar
 */
export const BottomSpacing = memo(() => (
  <View style={{ height: 100 }} />
));

BottomSpacing.displayName = 'BottomSpacing';

/**
 * Section Header component
 */
export const SectionHeader = memo(({ 
  title, 
  actionLabel, 
  onAction,
  style,
}) => (
  <View style={[{ 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: SPACING.lg,
  }, style]}>
    <Text style={{ 
      fontSize: FONTS.sizes.xl, 
      fontWeight: FONTS.weights.bold, 
      color: COLORS.textDark 
    }}>
      {title}
    </Text>
    {actionLabel && onAction && (
      <TouchableOpacity onPress={onAction}>
        <Text style={{ 
          fontSize: FONTS.sizes.md, 
          color: COLORS.primary, 
          fontWeight: FONTS.weights.semiBold 
        }}>
          {actionLabel}
        </Text>
      </TouchableOpacity>
    )}
  </View>
));

SectionHeader.displayName = 'SectionHeader';
