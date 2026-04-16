/**
 * Shared Admin Module
 * Central export for all shared admin functionality
 */

export default function DummySharedIndexRoute() { return null; }

// Constants
export {
    ADMIN_COLORS, ADMIN_MENU_ITEMS, ADOPTION_STATUS_CONFIG, DASHBOARD_STATS_CONFIG, PET_STATUS_CONFIG, RESCUE_ACTION_LABELS, RESCUE_STATUS_CONFIG,
    RESCUER_STATUS_CONFIG, SCREEN_HEIGHT, SCREEN_WIDTH, TRANSPORT_ICONS, URGENCY_CONFIG, USER_STATUS_CONFIG
} from './constants';

// Components
export {
    AdminActionButton,
    AdminCard, AdminEmptyState, AdminFilterTabs, AdminHeader, AdminLoadingOverlay, AdminSearchBar, ModalButton, StatusBadge
} from './components';

// Utilities
export {
    createHeaders, debounce,
    filterItems, formatDate, formatNumber, formatTimeAgo, generateAvatarUrl, getCountByField, getImageUrl, groupBy, handleApiResponse, isValidEmail,
    isValidPhone, sortItems, truncateText
} from './utils';

// Hooks
export {
    useConfirmation,
    useDebounce, useFadeAnimation, useFilter, useForm, useListData, useModal, useMutation, useSearch
} from './hooks';

// Styles
export { commonStyles } from './styles';

