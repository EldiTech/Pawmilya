import * as dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { collection, doc, getDocs, getFirestore, query, setDoc, where } from 'firebase/firestore';

dotenv.config();

// DO NOT USE THIS SCRIPT IN PRODUCTION. THIS IS FOR LOCAL DEV ONLY.
console.log('Loading environment variables for creation...', process.env.EXPO_PUBLIC_FIREBASE_API_KEY);

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_EMAIL = process.argv[2] || process.env.EXPO_PUBLIC_ADMIN_EMAIL || 'admin@pawmilya.com';
const ADMIN_PASSWORD = process.argv[3] || process.env.EXPO_PUBLIC_ADMIN_PASSWORD || 'Admin123';
const ADMIN_NAME = 'Super Admin';

async function createAdmin() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Please provide an email and password!');
    process.exit(1);
  }

  try {
    console.log(`Attempting to create admin account for: ${ADMIN_EMAIL}`);
    const userCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    const user = userCredential.user;
    
    console.log(`Created Auth user: ${user.uid}`);
    
    await setDoc(doc(db, 'users', user.uid), {
      email: ADMIN_EMAIL,
      full_name: ADMIN_NAME,
      role: 'admin',
      status: 'active',
      two_factor_enabled: false,
      created_at: new Date().toISOString()
    });

    console.log('Admin document successfully written to Firestore!');
    process.exit(0);
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log('Admin user already exists in Firebase Auth! Ensuring 2FA is disabled in Firestore...');

      const usersRef = collection(db, 'users');
      const adminQuery = query(usersRef, where('email', '==', ADMIN_EMAIL));
      const snapshot = await getDocs(adminQuery);

      if (snapshot.empty) {
        console.log('No Firestore user document found for this admin email.');
        console.log('Create one manually in users collection with two_factor_enabled set to false.');
      } else {
        for (const userDoc of snapshot.docs) {
          await setDoc(
            doc(db, 'users', userDoc.id),
            {
              email: ADMIN_EMAIL,
              role: 'admin',
              status: 'active',
              two_factor_enabled: false,
            },
            { merge: true }
          );
        }
        console.log('Updated existing admin user document(s): two_factor_enabled set to false.');
      }
      process.exit(0);
    } else {
      console.error('Error creating admin user:', error);
      process.exit(1);
    }
  }
}

createAdmin();
