const fs = require('fs');
const file = 'services/index.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(\import { updateProfile as updateAuthProfile } from 'firebase/auth';\, \import { updateProfile as updateAuthProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';\);

content = content.replace(\  async changePassword() {
    return { success: false, error: 'Change password is currently unavailable' };
  },\, \  async changePassword(currentPassword, newPassword) {
    try {
      const user = auth.currentUser;
      if (!user) {
        return { success: false, error: 'No user signed in' };
      }
      if (!user.email) {
        return { success: false, error: 'User email not found' };
      }
      
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      
      return { success: true };
    } catch (error) {
      console.error('Change password error:', error);
      return { 
        success: false, 
        error: error.message.includes('auth/invalid-login-credentials') || error.message.includes('auth/wrong-password')
          ? 'Current password is incorrect' 
          : 'Failed to update password. Please try again.'
      };
    }
  },\);

fs.writeFileSync(file, content);
