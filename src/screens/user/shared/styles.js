/**
 * Shared styles for user screens
 * Eliminates duplication of common style patterns
 */

import { StyleSheet, Platform, StatusBar } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../../constants/theme';

/**
 * Common container styles used across screens
 */
export const containerStyles = StyleSheet.create({
  // Main screen container with safe area padding
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 44,
  },
  // Simple flex container
  flex: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // Scroll view style
  scrollView: {
    flex: 1,
  },
  // Content with bottom tab bar spacing
  contentWithTabBar: {
    paddingBottom: 100,
  },
});

/**
 * Header styles used across screens
 */
export const headerStyles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  title: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  subtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: 4,
  },
});

/**
 * Search bar styles
 */
export const searchStyles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  input: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark,
  },
});

/**
 * Card styles used for pets, shelters, applications, etc.
 */
export const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  image: {
    width: '100%',
    height: 150,
    backgroundColor: COLORS.backgroundLight,
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: SPACING.lg,
  },
  title: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginBottom: SPACING.xs,
  },
});

/**
 * Info row styles (for displaying icon + text pairs)
 */
export const infoRowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
  },
  text: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginLeft: SPACING.xs,
    flex: 1,
  },
});

/**
 * Action button styles
 */
export const buttonStyles = StyleSheet.create({
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
  },
  primaryText: {
    color: COLORS.textWhite,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundWhite,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: SPACING.xs,
  },
  secondaryText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
  },
  small: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  smallText: {
    fontSize: FONTS.sizes.xs,
  },
  // Action buttons row
  row: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  // Colored action buttons
  success: { backgroundColor: COLORS.success },
  error: { backgroundColor: COLORS.error },
  info: { backgroundColor: '#2196F3' },
});

/**
 * Loading and empty state styles
 */
export const stateStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: SPACING.xl,
  },
  emptyIcon: {
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
});

/**
 * Modal styles
 */
export const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  content: {
    backgroundColor: COLORS.backgroundWhite,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  contentCenter: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
    width: '100%',
    maxWidth: 340,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  title: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    paddingHorizontal: SPACING.xl,
  },
});

/**
 * Badge/tag styles
 */
export const badgeStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  text: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
  },
  // Status colors
  pending: {
    backgroundColor: '#FFF3E0',
  },
  pendingText: {
    color: '#FF9800',
  },
  success: {
    backgroundColor: COLORS.success + '20',
  },
  successText: {
    color: COLORS.success,
  },
  error: {
    backgroundColor: COLORS.error + '20',
  },
  errorText: {
    color: COLORS.error,
  },
});

/**
 * Bottom spacing for screens with tab bar
 */
export const bottomSpacing = {
  height: 100,
};

/**
 * Combine multiple style objects
 * @param  {...Object} styles - Style objects to combine
 * @returns {Object} Combined style object
 */
export const combineStyles = (...styles) => {
  return Object.assign({}, ...styles.filter(Boolean));
};
