// Admin authentication - validates against backend API
import CONFIG from './config';

// Check if credentials match admin via API
export const isAdminLogin = async (email, password) => {
  try {
    const response = await fetch(`${CONFIG.API_URL}/auth/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    
    if (response.ok) {
      const data = await response.json();
      return { success: true, admin: data.admin, token: data.token };
    }
    return { success: false };
  } catch (error) {
    console.error('Admin login check failed:', error);
    return { success: false };
  }
};

export default { isAdminLogin };
