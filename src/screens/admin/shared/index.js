/**
 * Shared Admin Module
 * Central export for all shared admin functionality
 */

// Constants
export {
  ADMIN_COLORS,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  USER_STATUS_CONFIG,
  PET_STATUS_CONFIG,
  ADOPTION_STATUS_CONFIG,
  URGENCY_CONFIG,
  RESCUE_STATUS_CONFIG,
  RESCUER_STATUS_CONFIG,
  RESCUE_ACTION_LABELS,
  TRANSPORT_ICONS,
  DASHBOARD_STATS_CONFIG,
  ADMIN_MENU_ITEMS,
} from './constants';

// Components
export {
  AdminHeader,
  AdminSearchBar,
  AdminFilterTabs,
  StatusBadge,
  AdminLoadingOverlay,
  AdminEmptyState,
  AdminActionButton,
  AdminCard,
  ModalButton,
} from './components';

// Utilities
export {
  formatDate,
  formatTimeAgo,
  formatNumber,
  debounce,
  filterItems,
  getCountByField,
  generateAvatarUrl,
  isValidEmail,
  isValidPhone,
  truncateText,
  createHeaders,
  handleApiResponse,
  sortItems,
  groupBy,
  getImageUrl,
} from './utils';

// Hooks
export {
  useFadeAnimation,
  useListData,
  useSearch,
  useFilter,
  useModal,
  useForm,
  useMutation,
  useConfirmation,
  useDebounce,
} from './hooks';

// Styles
export { commonStyles } from './styles';
