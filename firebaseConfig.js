import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const rawAppId = requireEnv('EXPO_PUBLIC_FIREBASE_APP_ID');
const looksLikeNativeAppId = /:(android|ios):/i.test(rawAppId);

if (looksLikeNativeAppId) {
  console.warn(
    'EXPO_PUBLIC_FIREBASE_APP_ID appears to be a native app id. For Expo/Firebase Web SDK auth, use the Web app config from Firebase Console.',
  );
}

const firebaseConfig = {
  apiKey: requireEnv('EXPO_PUBLIC_FIREBASE_API_KEY'),
  authDomain: requireEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: requireEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: requireEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requireEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  ...(!looksLikeNativeAppId ? { appId: rawAppId } : {}),
};

let app;
let db;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false,
  });
} else {
  app = getApp();
  db = getFirestore(app);
}
let auth;

try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

export { app, auth, db, firebaseConfig };
export default app;
