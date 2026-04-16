import { initializeApp } from 'firebase/app';
import { collection, doc, getDocs, getFirestore, setDoc, Timestamp } from 'firebase/firestore';

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const firebaseConfig = {
  apiKey: requireEnv('EXPO_PUBLIC_FIREBASE_API_KEY'),
  authDomain: requireEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: requireEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: requireEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requireEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requireEnv('EXPO_PUBLIC_FIREBASE_APP_ID'),
};

const defaults = [
  {
    id: 'pet-1',
    name: 'Milo',
    breed: 'Aspin Mix',
    age: '2 years',
    gender: 'Male',
    location: 'Quezon City',
    category: 'Dog',
    image: 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Golde33443.jpg',
  },
  {
    id: 'pet-2',
    name: 'Luna',
    breed: 'Domestic Shorthair',
    age: '1 year',
    gender: 'Female',
    location: 'Makati',
    category: 'Cat',
    image: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Cat03.jpg',
  },
  {
    id: 'pet-3',
    name: 'Coco',
    breed: 'Shih Tzu',
    age: '3 years',
    gender: 'Female',
    location: 'Pasig',
    category: 'Dog',
    image: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Lhasa_Apso.jpg',
  },
  {
    id: 'pet-4',
    name: 'Pepper',
    breed: 'Persian Mix',
    age: '8 months',
    gender: 'Male',
    location: 'Taguig',
    category: 'Cat',
    image: 'https://upload.wikimedia.org/wikipedia/commons/9/9b/Gustav_chocolate.jpg',
  },
];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const petsRef = collection(db, 'pets');
const existing = await getDocs(petsRef);

if (existing.empty) {
  await Promise.all(
    defaults.map((pet) =>
      setDoc(doc(db, 'pets', pet.id), {
        ...pet,
        created_at: new Date().toISOString(),
        createdAt: Timestamp.now(),
      }),
    ),
  );
  console.log('Created pets collection with image fields in Firestore.');
} else {
  await Promise.all(
    existing.docs.map(async (snapshot) => {
      const current = snapshot.data();
      const fallback = defaults.find((item) => item.id === snapshot.id);
      const image = current.image || fallback?.image || 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Cat03.jpg';

      await setDoc(
        doc(db, 'pets', snapshot.id),
        {
          name: current.name || fallback?.name || 'Unnamed Pet',
          breed: current.breed || fallback?.breed || 'Unknown Breed',
          age: current.age || fallback?.age || 'Unknown age',
          gender: current.gender || fallback?.gender || 'Unknown',
          location: current.location || fallback?.location || 'Unknown location',
          category: current.category || fallback?.category || 'Other',
          image,
          created_at: current.created_at || new Date().toISOString(),
          createdAt: current.createdAt || Timestamp.now(),
        },
        { merge: true },
      );
    }),
  );
  console.log(`Updated ${existing.docs.length} pet document(s) with image fields.`);
}
