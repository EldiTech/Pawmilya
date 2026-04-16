const ADMIN_EMAIL = String(process.env.EXPO_PUBLIC_ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.EXPO_PUBLIC_ADMIN_PASSWORD || '');

export const isAdminLogin = async (email, password) => {
  const safeEmail = String(email || '').trim().toLowerCase();
  const safePassword = String(password || '');

  const success =
    ADMIN_EMAIL.length > 0 &&
    ADMIN_PASSWORD.length > 0 &&
    safeEmail === ADMIN_EMAIL &&
    safePassword === ADMIN_PASSWORD;

  return {
    success,
    token: success ? 'admin-session-token' : null,
  };
};
