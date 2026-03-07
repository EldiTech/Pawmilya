/**
 * Shared Admin Constants
 * Centralized color palette, status configurations, and common constants
 */

import { Dimensions } from 'react-native';

export const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Modern admin color palette - single source of truth
export const ADMIN_COLORS = {
  primary: '#FF8C42',
  primaryDark: '#E57529',
  primaryLight: '#FFB380',
  secondary: '#7C5DFA',
  accent: '#00C9A7',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#475569',
  textLight: '#475569',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  shadow: '#64748B',
};

// User status configuration
export const USER_STATUS_CONFIG = {
  active: { 
    color: '#00B894', 
    label: 'Active', 
    bg: '#E8FFF3', 
    icon: 'checkmark-circle',
  },
  suspended: { 
    color: '#E17055', 
    label: 'Suspended', 
    bg: '#FFF0E8', 
    icon: 'pause-circle',
  },
};

// Pet status configuration
export const PET_STATUS_CONFIG = {
  available: { bg: '#E8FFF3', color: '#00B894', icon: 'checkmark-circle', label: 'Available' },
  pending: { bg: '#FFF8E1', color: '#F39C12', icon: 'time', label: 'Pending' },
  adopted: { bg: '#E8F4FD', color: '#0984E3', icon: 'heart', label: 'Adopted' },
};

// Adoption status configuration
export const ADOPTION_STATUS_CONFIG = {
  pending: { 
    color: '#F39C12', 
    label: 'Pending', 
    bg: '#FFF8E1', 
    icon: 'time-outline'
  },
  reviewing: { 
    color: '#0984E3', 
    label: 'Reviewing', 
    bg: '#E8F4FD', 
    icon: 'eye-outline'
  },
  approved: { 
    color: '#00B894', 
    label: 'Approved', 
    bg: '#E8FFF3', 
    icon: 'checkmark-circle-outline'
  },
  rejected: { 
    color: '#E17055', 
    label: 'Rejected', 
    bg: '#FFF0E8', 
    icon: 'close-circle-outline'
  },
};

// Rescue urgency configuration
export const URGENCY_CONFIG = {
  critical: { color: '#E53935', label: 'Critical', icon: 'alert-circle', bg: '#FFEBEE' },
  high: { color: '#FB8C00', label: 'High', icon: 'warning', bg: '#FFF3E0' },
  normal: { color: '#00B894', label: 'Normal', icon: 'document-text', bg: '#E8FFF3' },
  low: { color: '#9E9E9E', label: 'Low', icon: 'remove-circle', bg: '#F5F5F5' },
};

// Rescue status configuration
export const RESCUE_STATUS_CONFIG = {
  new: { color: '#FB8C00', label: 'New', icon: 'add-circle', bg: '#FFF3E0' },
  in_progress: { color: '#0984E3', label: 'In Progress', icon: 'sync', bg: '#E8F4FD' },
  on_the_way: { color: '#3B82F6', label: 'On the Way', icon: 'car', bg: '#EBF5FF' },
  arrived: { color: '#8B5CF6', label: 'Arrived', icon: 'location', bg: '#F3E8FF' },
  pending_verification: { color: '#F59E0B', label: 'Pending Verification', icon: 'time', bg: '#FEF3C7' },
  rescued: { color: '#00B894', label: 'Rescued', icon: 'checkmark-circle', bg: '#E8FFF3' },
  cannot_complete: { color: '#EF4444', label: 'Cannot Complete', icon: 'close-circle', bg: '#FEE2E2' },
  closed: { color: '#6B7280', label: 'Closed', icon: 'lock-closed', bg: '#F3F4F6' },
  false_report: { color: '#E53935', label: 'False Report', icon: 'ban', bg: '#FFEBEE' },
};

// Rescuer application status configuration
export const RESCUER_STATUS_CONFIG = {
  pending: { color: '#F59E0B', label: 'Pending', icon: 'time', bg: '#FEF3C7' },
  approved: { color: '#10B981', label: 'Approved', icon: 'checkmark-circle', bg: '#D1FAE5' },
  rejected: { color: '#EF4444', label: 'Rejected', icon: 'close-circle', bg: '#FEE2E2' },
  revoked: { color: '#6B7280', label: 'Revoked', icon: 'ban', bg: '#F3F4F6' },
};

// Rescue action labels
export const RESCUE_ACTION_LABELS = {
  created: { label: 'Report Created', icon: 'add-circle', color: '#10B981' },
  status_changed: { label: 'Status Changed', icon: 'swap-horizontal', color: '#3B82F6' },
  rescuer_assigned: { label: 'Rescuer Assigned', icon: 'person-add', color: '#8B5CF6' },
  rescuer_declined: { label: 'Rescuer Declined', icon: 'close-circle', color: '#EF4444' },
  rescuer_cancelled: { label: 'Rescue Cancelled', icon: 'exit', color: '#F59E0B' },
  rescuer_on_the_way: { label: 'On The Way', icon: 'car', color: '#3B82F6' },
  rescuer_arrived: { label: 'Arrived at Location', icon: 'location', color: '#8B5CF6' },
  submitted_for_verification: { label: 'Submitted for Verification', icon: 'cloud-upload', color: '#F59E0B' },
  verification_approved: { label: 'Verification Approved', icon: 'checkmark-circle', color: '#10B981' },
  verification_rejected: { label: 'Verification Rejected', icon: 'close-circle', color: '#EF4444' },
  rescue_completed: { label: 'Rescue Completed', icon: 'trophy', color: '#10B981' },
  cannot_complete: { label: 'Cannot Complete', icon: 'warning', color: '#EF4444' },
  admin_edit: { label: 'Edited by Admin', icon: 'pencil', color: '#6B7280' },
};

// Transport icons mapping
export const TRANSPORT_ICONS = {
  motorcycle: 'bicycle',
  car: 'car',
  bicycle: 'bicycle',
  walking: 'walk',
  public_transport: 'bus',
};

// Dashboard stats configuration
export const DASHBOARD_STATS_CONFIG = [
  { 
    key: 'pets',
    label: 'Pets', 
    icon: 'paw', 
    gradient: ['#FF8C42', '#FF6B35'],
    iconBg: 'rgba(255, 140, 66, 0.15)',
  },
  { 
    key: 'adoptions',
    label: 'Adoptions', 
    icon: 'heart', 
    gradient: ['#EC4899', '#F472B6'],
    iconBg: 'rgba(236, 72, 153, 0.15)',
  },
  { 
    key: 'rescues',
    label: 'Rescues', 
    icon: 'medkit', 
    gradient: ['#10B981', '#34D399'],
    iconBg: 'rgba(16, 185, 129, 0.15)',
  },
  { 
    key: 'users',
    label: 'Users', 
    icon: 'people', 
    gradient: ['#7C5DFA', '#A78BFA'],
    iconBg: 'rgba(124, 93, 250, 0.15)',
  },
];

// Menu items configuration
export const ADMIN_MENU_ITEMS = [
  { 
    id: 'pets', 
    title: 'Manage Pets',
    icon: 'paw', 
    color: '#FF8C42',
    bgColor: 'rgba(255, 140, 66, 0.1)',
  },
  { 
    id: 'rescues', 
    title: 'Rescue Reports',
    icon: 'medkit', 
    color: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
  },
  { 
    id: 'adoptions', 
    title: 'Adoptions',
    icon: 'heart', 
    color: '#EC4899',
    bgColor: 'rgba(236, 72, 153, 0.1)',
  },
  { 
    id: 'deliveries', 
    title: 'Deliveries',
    icon: 'car', 
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
  },
  { 
    id: 'shelterApplications', 
    title: 'Shelter Applications',
    icon: 'document-text', 
    color: '#F97316',
    bgColor: 'rgba(249, 115, 22, 0.1)',
  },
  { 
    id: 'shelters', 
    title: 'Shelter Management',
    icon: 'home', 
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.1)',
  },
  { 
    id: 'shelterTransfers', 
    title: 'Shelter Transfers',
    icon: 'swap-horizontal', 
    color: '#14B8A6',
    bgColor: 'rgba(20, 184, 166, 0.1)',
  },
  { 
    id: 'rescuerApplications', 
    title: 'Rescuer Applications',
    icon: 'shield-checkmark', 
    color: '#7C5DFA',
    bgColor: 'rgba(124, 93, 250, 0.1)',
  },
  { 
    id: 'users', 
    title: 'User Management',
    icon: 'people', 
    color: '#6B7280',
    bgColor: 'rgba(107, 114, 128, 0.1)',
  },
];
