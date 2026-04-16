import { initializeApp } from 'firebase/app';
import { collection, doc, getDocs, getFirestore, setDoc, Timestamp } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

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
    imagePath: 'assets/images/pet-1.png',
  },
  {
    id: 'pet-2',
    name: 'Luna',
    breed: 'Domestic Shorthair',
    age: '1 year',
    gender: 'Female',
    location: 'Makati',
    category: 'Cat',
    imagePath: 'assets/images/pet-2.png',
  },
  {
    id: 'pet-3',
    name: 'Coco',
    breed: 'Shih Tzu',
    age: '3 years',
    gender: 'Female',
    location: 'Pasig',
    category: 'Dog',
    imagePath: 'assets/images/pet-3.png',
  },
  {
    id: 'pet-4',
    name: 'Pepper',
    breed: 'Persian Mix',
    age: '8 months',
    gender: 'Male',
    location: 'Taguig',
    category: 'Cat',
    imagePath: 'assets/images/pet-4.png',
  },
];

const FALLBACK_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAADICAIAAADdvUsCAAAEkklEQVR4nO3TMQEAIAzAsIF/z0NGDxIFfXp2ZgdA9t4OAPxkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0g2gGQDSDaAZANINoBkA0j2AmMGBRp5wh2YAAAAAElFTkSuQmCC';

const extToMime = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

const toDataUriFromFile = (filePath) => {
  try {
    const bytes = readFileSync(filePath);
    const base64 = bytes.toString('base64');
    const mime = extToMime[extname(filePath).toLowerCase()] || 'image/png';
    return `data:${mime};base64,${base64}`;
  } catch {
    return FALLBACK_BASE64;
  }
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const petsRef = collection(db, 'pets');
const existing = await getDocs(petsRef);

if (existing.empty) {
  await Promise.all(
    defaults.map((pet) => {
      const image = toDataUriFromFile(pet.imagePath);
      return setDoc(doc(db, 'pets', pet.id), {
        id: pet.id,
        name: pet.name,
        breed: pet.breed,
        age: pet.age,
        gender: pet.gender,
        location: pet.location,
        category: pet.category,
        image,
        created_at: new Date().toISOString(),
        createdAt: Timestamp.now(),
      });
    }),
  );
  console.log('Created pets with base64 images in Firestore.');
} else {
  await Promise.all(
    existing.docs.map(async (snapshot) => {
      const fallback = defaults.find((item) => item.id === snapshot.id) || defaults[0];
      const current = snapshot.data();
      const nextImage = toDataUriFromFile(fallback.imagePath);

      await setDoc(
        doc(db, 'pets', snapshot.id),
        {
          image: nextImage,
          name: current.name || fallback.name,
          breed: current.breed || fallback.breed,
          age: current.age || fallback.age,
          gender: current.gender || fallback.gender,
          location: current.location || fallback.location,
          category: current.category || fallback.category,
          created_at: current.created_at || new Date().toISOString(),
          createdAt: current.createdAt || Timestamp.now(),
        },
        { merge: true },
      );
    }),
  );
  console.log(`Updated ${existing.docs.length} pet document(s) with base64 image data.`);
}
