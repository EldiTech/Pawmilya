import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isAdminLogin } from '../config/adminCredentials';
import { auth, db } from '../firebaseConfig';

const AuthContext = createContext(null);

const parseFirebaseAuthError = (error) => {
  const code = error?.code || '';
  const message = String(error?.message || '').toLowerCase();

  if (code === 'auth/invalid-credential') return 'Invalid email or password.';
  if (code === 'auth/user-not-found') return 'No account found for this email.';
  if (code === 'auth/wrong-password') return 'Invalid email or password.';
  if (code === 'auth/email-already-in-use') return 'This email is already registered.';
  if (code === 'auth/weak-password') return 'Password is too weak.';
  if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
  if (code === 'auth/network-request-failed') return 'Network error. Please try again.';
  if (code === 'auth/visibility-check-was-unavailable' || message.includes('visibility-check-was-unavailable')) {
    return 'Firebase verification check is temporarily unavailable. Please try again in a moment, or restart the app and retry sign up.';
  }
  if (code === 'auth/invalid-api-key' || String(error?.message || '').toLowerCase().includes('api-key-not-valid')) {
    return 'Firebase API key is invalid for this project. Recheck EXPO_PUBLIC_FIREBASE_API_KEY in .env and restart Expo.';
  }
  if (code === 'auth/configuration-not-found') {
    return 'Firebase Auth configuration not found. Use Firebase Web app config in .env and enable Email/Password in Firebase Console > Authentication > Sign-in method.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Email/Password sign-in is disabled. Enable it in Firebase Console > Authentication > Sign-in method.';
  }

  return error?.message || 'Authentication failed. Please try again.';
};

const isVisibilityCheckError = (error) => {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return code === 'auth/visibility-check-was-unavailable' || message.includes('visibility-check-was-unavailable');
};

const createUserWithRetry = async (authInstance, email, password, attempts = 2) => {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await createUserWithEmailAndPassword(authInstance, email, password);
    } catch (error) {
      lastError = error;
      const shouldRetry = isVisibilityCheckError(error) && attempt < attempts;
      if (!shouldRetry) {
        throw error;
      }
    }
  }

  throw lastError;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savedAccounts, setSavedAccounts] = useState([]);

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const stored = await AsyncStorage.getItem('pawmilya_saved_accounts');
        if (stored) {
          setSavedAccounts(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Error loading saved accounts:', error);
      }
    };
    loadAccounts();
  }, []);

  const saveAccountToDevice = async (currentUser, currentPassword) => {
    try {
      const stored = await AsyncStorage.getItem('pawmilya_saved_accounts');
      let accounts = stored ? JSON.parse(stored) : [];
      
      const newAccount = {
        uid: currentUser.uid,
        email: currentUser.email,
        password: currentPassword,
        displayName: currentUser.displayName || currentUser.full_name || 'User',
        avatar_url: currentUser.photoURL || currentUser.avatar_url || null,
        role: currentUser.role || 'user'
      };

      const existingIndex = accounts.findIndex(a => a.email === currentUser.email);
      if (existingIndex >= 0) {
        accounts[existingIndex] = { ...accounts[existingIndex], ...newAccount };
      } else {
        if (accounts.length >= 5) {
          // If we somehow bypass the UI limit, replace the oldest one? Or just don't add.
          // Let's just keep the last 5 accessed
          accounts.shift(); 
        }
        accounts.push(newAccount);
      }

      await AsyncStorage.setItem('pawmilya_saved_accounts', JSON.stringify(accounts));
      setSavedAccounts([...accounts]);
    } catch (error) {
      console.error('Error saving account:', error);
    }
  };

  const removeSavedAccount = async (email) => {
    try {
      const updated = savedAccounts.filter(a => a.email !== email);
      await AsyncStorage.setItem('pawmilya_saved_accounts', JSON.stringify(updated));
      setSavedAccounts(updated);
      
      // If we remove the active account, also sign out
      if (user && user.email === email) {
        await logout();
      }
    } catch (error) {
      console.error('Error removing account:', error);
    }
  };

  useEffect(() => {
    let unsubscribeSnapshot = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          // Fetch once for initial load
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            setUser({ ...firebaseUser, ...userDocSnap.data() });
          } else {
            setUser(firebaseUser);
          }

          // Listen for real-time updates to user role/status
          unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              setUser((prevUser) => ({ ...prevUser, ...firebaseUser, ...docSnap.data() }));
            }
          });
        } catch (error) {
          console.error("Error fetching user profile data:", error);
          setUser(firebaseUser);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, []);

  const login = async (email, password) => {
    const safeEmail = String(email || '').trim();
    const safePassword = String(password || '');

    if (!safeEmail || !safePassword) {
      return { success: false, message: 'Email and password are required.' };
    }

    try {
      const result = await signInWithEmailAndPassword(auth, safeEmail, safePassword);
      // Fetch user data before saving
      let storedUser = result.user;
      try {
          const userDocRef = doc(db, 'users', result.user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
             storedUser = { ...storedUser, ...userDocSnap.data() };
          }
      } catch (e) {
          console.error(e);
      }
      await saveAccountToDevice(storedUser, safePassword);
      
      return { success: true, user: result.user };
    } catch (error) {
      const adminCheck = await isAdminLogin(safeEmail, safePassword);
      
      // If credentials match the hardcoded admin ones but the user doesn't exist in Firebase Auth yet, auto-create it
      if (adminCheck.success && (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password')) {
        try {
          const result = await createUserWithRetry(auth, safeEmail, safePassword);
          const adminInfo = {
            uid: result.user.uid,
            full_name: 'Super Admin',
            email: safeEmail,
            role: 'admin',
            two_factor_enabled: false,
            created_at: serverTimestamp()
          };
          await setDoc(doc(db, 'users', result.user.uid), adminInfo, { merge: true });
          
          setUser({ ...result.user, ...adminInfo });
          await saveAccountToDevice({ ...result.user, ...adminInfo }, safePassword);
          
          return { success: true, user: result.user };
        } catch (createError) {
          if (createError.code === 'auth/email-already-in-use') {
            return { success: false, message: 'Admin account already exists with a different password in Firebase. Please use the original password or clear the account in Firebase console.' };
          }
          return { success: false, message: parseFirebaseAuthError(createError) };
        }
      }
      return { success: false, message: parseFirebaseAuthError(error) };
    }
  };

  const register = async (payload = {}) => {
    const fullName = String(payload.fullName || '').trim();
    const email = String(payload.email || '').trim();
    const phoneNumber = String(payload.phoneNumber || '').trim();
    const password = String(payload.password || '');

    if (!fullName || !email || !phoneNumber || !password) {
      return {
        success: false,
        message: 'Missing required registration fields.',
      };
    }

    try {
      const result = await createUserWithRetry(auth, email, password);

      await updateProfile(result.user, {
        displayName: fullName,
      });

      await setDoc(doc(db, 'users', result.user.uid), {
        uid: result.user.uid,
        full_name: fullName,
        email,
        phone_number: phoneNumber,
        avatar_url: '',
        created_at: serverTimestamp(),
      }, { merge: true });

      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, message: parseFirebaseAuthError(error) };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      return { success: true };
    } catch (error) {
      return { success: false, message: parseFirebaseAuthError(error) };
    }
  };

  const updateUser = (partial = {}) => {
    setUser((previous) => {
      if (!previous) {
        return previous;
      }

      // Preserve key identity fields from Firebase user objects.
      const identity = {
        uid: previous.uid,
        email: previous.email,
        displayName: previous.displayName,
        photoURL: previous.photoURL,
      };

      return {
        ...identity,
        ...previous,
        ...partial,
      };
    });
  };

  const authValue = useMemo(() => ({
    user,
    isLoading,
    isAuthenticated: !!user,
    savedAccounts,
    removeSavedAccount,
    login,
    register,
    logout,
    updateUser,
  }), [user, isLoading, savedAccounts]);

  return <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const contextValue = useContext(AuthContext);

  if (!contextValue) {
    return {
      user: null,
      isLoading: false,
      isAuthenticated: false,
      savedAccounts: [],
      removeSavedAccount: async () => {},
      login: async () => ({ success: false, message: 'Auth provider is not mounted.' }),
      register: async () => ({ success: false, message: 'Auth provider is not mounted.' }),
      logout: async () => ({ success: false, message: 'Auth provider is not mounted.' }),
      updateUser: () => {},
    };
  }

  return contextValue;
};
