/**
 * Shared Admin Styles
 * Common styles used across admin screens
 */

import { StyleSheet, Platform, StatusBar } from 'react-native';
import { ADMIN_COLORS, SCREEN_WIDTH } from './constants';

export const commonStyles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    backgroundColor: ADMIN_COLORS.background,
  },
  safeContainer: {
    flex: 1,
    backgroundColor: ADMIN_COLORS.primary,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  
  // List styles
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  listItem: {
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    overflow: 'hidden',
    shadowColor: ADMIN_COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  listItemInner: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  
  // Avatar styles
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 14,
    marginRight: 14,
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  
  // Text styles
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: ADMIN_COLORS.text,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: ADMIN_COLORS.textMuted,
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: ADMIN_COLORS.textLight,
    marginBottom: 6,
  },
  value: {
    fontSize: 15,
    color: ADMIN_COLORS.text,
  },
  
  // Action row styles
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  actionRowPadding: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  
  // Divider
  divider: {
    height: 1,
    backgroundColor: ADMIN_COLORS.border,
    marginHorizontal: 16,
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: ADMIN_COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: ADMIN_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    padding: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: ADMIN_COLORS.border,
  },
  
  // Form styles
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: ADMIN_COLORS.text,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: ADMIN_COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: ADMIN_COLORS.text,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  formInputFocused: {
    borderColor: ADMIN_COLORS.primary,
    backgroundColor: '#FFF',
  },
  formTextarea: {
    height: 100,
    textAlignVertical: 'top',
  },
  formError: {
    fontSize: 12,
    color: ADMIN_COLORS.danger,
    marginTop: 4,
  },
  
  // Picker/Select styles
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: ADMIN_COLORS.background,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  pickerOptionActive: {
    backgroundColor: ADMIN_COLORS.primary,
    borderColor: ADMIN_COLORS.primary,
  },
  pickerOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: ADMIN_COLORS.textLight,
  },
  pickerOptionTextActive: {
    color: '#FFF',
  },
  
  // Section styles
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
    marginBottom: 12,
  },
  
  // Detail view styles
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.border,
  },
  detailLabel: {
    fontSize: 14,
    color: ADMIN_COLORS.textMuted,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: ADMIN_COLORS.text,
    flex: 2,
    textAlign: 'right',
  },
  
  // Image styles
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: ADMIN_COLORS.background,
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ADMIN_COLORS.background,
  },
  
  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: ADMIN_COLORS.textSecondary,
  },
  
  // Scroll indicator
  scrollIndicator: {
    width: 40,
    height: 4,
    backgroundColor: ADMIN_COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  
  // Row utilities
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowSpaceBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flex1: {
    flex: 1,
  },
  
  // Spacing utilities
  mt8: { marginTop: 8 },
  mt16: { marginTop: 16 },
  mb8: { marginBottom: 8 },
  mb16: { marginBottom: 16 },
  mr8: { marginRight: 8 },
  ml8: { marginLeft: 8 },
  p16: { padding: 16 },
  ph16: { paddingHorizontal: 16 },
  pv8: { paddingVertical: 8 },
});

export default commonStyles;
