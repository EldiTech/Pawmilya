import * as dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { collection, deleteDoc, getDocs, getFirestore } from 'firebase/firestore';

dotenv.config();

console.log('Loading environment variables for database cleanup...');

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Core collections in the app
const collectionsToClear = [
  'adoptions',
  'chats',
  'notifications',
  'payments',
  'pet_categories',
  'pets',
  'rescue_reports',
  'rescuer_applications',
  'shelter_applications',
  'shelters',
  'transfers',
  'users'
];

async function deleteQueryBatch(db, collectionName, resolve, reject) {
  try {
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);

    const batchSize = snapshot.size;
    if (batchSize === 0) {
      console.log(`✓ Collection '${collectionName}' is empty.`);
      resolve();
      return;
    }

    console.log(`Deleting ${batchSize} documents in '${collectionName}'...`);
    
    let deletedCount = 0;
    for (const document of snapshot.docs) {
      if (collectionName === 'chats') {
        const subCollectionRef = collection(db, `chats/${document.id}/messages`);
        const subSnapshot = await getDocs(subCollectionRef);
        for (const subDoc of subSnapshot.docs) {
          await deleteDoc(subDoc.ref);
        }
      }

      await deleteDoc(document.ref);
      deletedCount++;
    }

    console.log(`Deleted ${deletedCount} documents in '${collectionName}'.`);

    process.nextTick(() => {
      deleteQueryBatch(db, collectionName, resolve, reject);
    });
  } catch (error) {
    reject(error);
  }
}

async function clearDatabase() {
  console.log('WARNING: This will delete ALL documents in the specified collections.');
  // Add a small delay so user can abort if accidental
  console.log('Starting in 3 seconds... Press Ctrl+C to abort.');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('Starting database cleanup...');

  try {
    for (const collectionName of collectionsToClear) {
      await new Promise((resolve, reject) => {
        deleteQueryBatch(db, collectionName, resolve, reject);
      });
    }
    console.log('\n✅ Database cleanup completed successfully!');
  } catch (error) {
    console.error('\n❌ Error cleaning database:', error);
    process.exit(1);
  }
  process.exit(0);
}

clearDatabase();
