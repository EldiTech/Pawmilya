// API Configuration
// Prefer EXPO_PUBLIC_API_URL for all environments.
// Fallbacks are only for local development:
// - Android emulator: http://10.0.2.2:3000/api
// - Same machine (web/simulator): http://localhost:3000/api
const FALLBACK_DEV_API_URL = 'http://10.0.2.2:3000/api';
const FALLBACK_PROD_API_URL = 'http://localhost:3000/api';

const DEV_API_URL = process.env.EXPO_PUBLIC_API_URL || FALLBACK_DEV_API_URL;
const PROD_API_URL = process.env.EXPO_PUBLIC_API_URL || FALLBACK_PROD_API_URL;

export const CONFIG = {
  API_URL: __DEV__ ? DEV_API_URL : PROD_API_URL,
  
  // API Endpoints
  ENDPOINTS: {
    // Auth
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH_TOKEN: '/auth/refresh',
    VERIFY_OTP: '/auth/verify-otp',
    RESEND_OTP: '/auth/resend-otp',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    
    // Users
    USER_PROFILE: '/users/profile',
    USER_STATUS: '/users/status',
    UPDATE_PROFILE: '/users/profile',
    UPLOAD_AVATAR: '/users/avatar',
    CHANGE_PASSWORD: '/users/change-password',
    TOGGLE_2FA: '/users/toggle-2fa',
    DELETE_ACCOUNT: '/users/account',
    ALL_USERS: '/users/all',
    USER_FAVORITES: '/users/favorites',
    USER_APPLICATIONS: '/users/applications',
    USER_NOTIFICATIONS: '/users/notifications',
    UNREAD_NOTIFICATIONS_COUNT: '/users/notifications/unread-count',
    MARK_NOTIFICATION_READ: '/users/notifications/:id/read',
    MARK_ALL_NOTIFICATIONS_READ: '/users/notifications/read-all',
    
    // Pets
    PETS: '/pets',
    PET_BY_ID: '/pets/:id',
    FEATURED_PETS: '/pets/featured',
    SEARCH_PETS: '/pets/search',
    PET_CATEGORIES: '/pets/categories',
    PET_BREEDS: '/pets/breeds/:categoryId',
    
    // Favorites
    FAVORITES: '/users/favorites',
    ADD_FAVORITE: '/users/favorites',
    REMOVE_FAVORITE: '/users/favorites/:id',
    
    // Adoptions
    ADOPTIONS: '/adoptions',
    MY_APPLICATIONS: '/adoptions/my-applications',
    ADOPTION_BY_ID: '/adoptions/:id',
    CREATE_ADOPTION: '/adoptions',
    UPDATE_ADOPTION: '/adoptions/:id',
    CANCEL_ADOPTION: '/adoptions/:id/cancel',
    ADOPTION_PAYMENT: '/adoptions/:id/payment',
    
    // Payments (PayMongo)
    CREATE_CHECKOUT: '/payments/create-checkout',
    VERIFY_PAYMENT: '/payments/verify/:adoptionId',
    
    // Rescue Reports
    RESCUE_REPORTS: '/rescue-reports',
    RESCUE_STATS: '/rescue-reports/stats',
    CREATE_RESCUE_REPORT: '/rescue-reports',
    RESCUE_REPORT_BY_ID: '/rescue-reports/:id',
    VOLUNTEER_FOR_RESCUE: '/rescue-reports/:id/volunteer',
    
    // Shelters
    SHELTERS: '/shelters',
    SHELTER_BY_ID: '/shelters/:id',
    NEARBY_SHELTERS: '/shelters/nearby',
    
    // Shelter Transfers
    AVAILABLE_SHELTERS: '/shelter-transfers/available-shelters',
    SHELTER_TRANSFER_REQUEST: '/shelter-transfers/request',
    MY_TRANSFER_REQUESTS: '/shelter-transfers/my-requests',
    UPDATE_TRANSFER_DELIVERY_STATUS: '/shelter-transfers/:id/delivery-status',
    CANCEL_TRANSFER_REQUEST: '/shelter-transfers/:id/cancel',
    
    // Shelter Applications
    SHELTER_APPLICATIONS: '/shelter-applications',
    MY_SHELTER_APPLICATION: '/shelter-applications/my-application',
    
    // Shelter Manager
    SHELTER_MANAGER_STATUS: '/shelter-manager/status',
    SHELTER_MANAGER_MY_SHELTER: '/shelter-manager/my-shelter',
    SHELTER_MANAGER_PETS: '/shelter-manager/pets',
    SHELTER_MANAGER_PET_UPDATE: '/shelter-manager/pets/:id',
    SHELTER_MANAGER_TRANSFERS: '/shelter-manager/transfers',
    SHELTER_MANAGER_ADOPTIONS: '/shelter-manager/adoptions',
    SHELTER_MANAGER_PAYMENTS_OVERVIEW: '/shelter-manager/payments-overview',
    SHELTER_MANAGER_ADOPTION_STATUS: '/shelter-manager/adoptions/:id/status',
    SHELTER_MANAGER_ADOPTION_PAYMENT: '/shelter-manager/adoptions/:id/payment',
    SHELTER_MANAGER_ADOPTION_VERIFY_PAYMENT: '/shelter-manager/adoptions/:id/verify-payment',
    SHELTER_MANAGER_DELIVERY_STATUS: '/shelter-manager/deliveries/:id/status',
    
    // Admin Endpoints
    ADMIN_DASHBOARD_STATS: '/admin/dashboard/stats',
    ADMIN_PETS: '/admin/pets',
    ADMIN_PET_BY_ID: '/admin/pets/:id',
    ADMIN_USERS: '/admin/users',
    ADMIN_USER_STATUS: '/admin/users/:id/status',
    ADMIN_ADOPTIONS: '/admin/adoptions',
    ADMIN_ADOPTION_STATUS: '/admin/adoptions/:id/status',
    ADMIN_RESCUES: '/admin/rescues',
    ADMIN_RESCUE_STATUS: '/admin/rescues/:id/status',

    // AI
    AI_CHAT: '/ai/chat',
    AI_CONTEXT: '/ai/context',
  },
  
  // Storage Keys
  STORAGE_KEYS: {
    AUTH_TOKEN: '@pawmilya_auth_token',
    REFRESH_TOKEN: '@pawmilya_refresh_token',
    USER_DATA: '@pawmilya_user_data',
  },
  
  // Request timeout (ms)
  TIMEOUT: 10000,

  // Gemini AI model preferences used by backend AI proxy
  GEMINI_MODELS: [
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash-lite',
  ],
};

export default CONFIG;
