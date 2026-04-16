const fs = require('fs');
let code = \import { app, db } from '../firebaseConfig';
import { collection, getDocs, query, limit } from 'firebase/firestore';

const samplePets = [
  {
    id: 'pet-1',
    name: 'Milo',
    breed: 'Aspin Mix',
    age: '2 years',
    gender: 'Male',
    location: 'Quezon City',
    image: null,
    category: 'Dog',
    created_at: '2026-01-12T08:00:00Z',
  },
  {
    id: 'pet-2',
    name: 'Luna',
    breed: 'Domestic Shorthair',
    age: '1 year',
    gender: 'Female',
    location: 'Makati',
    image: null,
    category: 'Cat',
    created_at: '2026-02-05T08:00:00Z',
  },
  {
    id: 'pet-3',
    name: 'Coco',
    breed: 'Shih Tzu',
    age: '3 years',
    gender: 'Female',
    location: 'Pasig',
    image: null,
    category: 'Dog',
    created_at: '2026-03-21T08:00:00Z',
  },
  {
    id: 'pet-4',
    name: 'Pepper',
    breed: 'Persian Mix',
    age: '8 months',
    gender: 'Male',
    location: 'Taguig',
    image: null,
    category: 'Cat',
    created_at: '2026-03-29T08:00:00Z',
  },
];

let rescueReports = [
  {
    id: 'rescue-1',
    title: 'Injured dog near market',
    description: 'Brown dog limping and hiding beside a stall.',
    location: 'Pasig Public Market',
    animalType: 'dog',
    urgency: 'high',
    status: 'active',
    created_at: '2026-04-01T09:00:00Z',
    reporter_name: 'Anonymous',
    reporter_phone: '09171234567',
    reporter_email: 'guest@example.com',
    images: [],
  },
  {
    id: 'rescue-2',
    title: 'Kitten stuck in drainage',
    description: 'Small kitten heard crying under the street grate.',
    location: 'BGC 5th Avenue',
    animalType: 'cat',
    urgency: 'critical',
    status: 'active',
    created_at: '2026-04-03T11:30:00Z',
    reporter_name: 'Anonymous',
    reporter_phone: '09171234567',
    reporter_email: 'guest@example.com',
    images: [],
  },
];

const toArray = (value) => (Array.isArray(value) ? value : []);

const petService = {
  async getPets(filters = {}) {
    try {
      const q = query(collection(db, 'pets'));
      const querySnapshot = await getDocs(q);
      let data = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });

      const { category, search } = filters;
      const categoryNeedle = (category || '').toLowerCase();
      const searchNeedle = (search || '').toLowerCase();

      data = data.filter((pet) => {
        const matchesCategory = categoryNeedle
          ? (pet.category || '').toLowerCase() === categoryNeedle
          : true;

        const haystack = \\\\ \ \\\\.toLowerCase();
        const matchesSearch = searchNeedle ? haystack.includes(searchNeedle) : true;

        return matchesCategory && matchesSearch;
      });

      return { success: true, data };
    } catch (err) {
      console.error(err);
      return { success: false, data: [] };
    }
  },

  async getFeaturedPets(limitCount = 6) {
    try {
      const safeLimit = Number.isFinite(limitCount) ? Math.max(1, Math.trunc(limitCount)) : 6;
      const q = query(collection(db, 'pets'));
      const querySnapshot = await getDocs(q);
      const data = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      return { success: true, data };
    } catch (err) {
      console.error(err);
      return { success: false, data: [] };
    }
  },
};

const rescueService = {
  async getRescueReports({ limit = 20 } = {}) {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 20;
    return { success: true, data: toArray(rescueReports).slice(0, safeLimit) }; 
  },

  async getRescueStats() {
    const reports = toArray(rescueReports);
    const active = reports.filter((item) => item.status !== 'resolved').length; 
    return {
      success: true,
      data: {
        active,
        volunteers: Math.max(active * 2, 0),
        rescued: reports.length,
      },
    };
  },

  async volunteerForRescue(reportId) {
    if (!reportId) {
      throw new Error('Missing report id');
    }

    return { success: true, message: 'Volunteer registered' };
  },

  async createRescueReport(reportData = {}) {
    const record = {
      id: \\\escue-\\\\,
      status: 'active',
      created_at: new Date().toISOString(),
      ...reportData,
    };

    rescueReports = [record, ...toArray(rescueReports)];

    return {
      success: true,
      message: 'Rescue report created',
      data: record,
    };
  },
};

export { petService, rescueService };\;
fs.writeFileSync('services/index.js', code.replace(/\\r?\\n/g, '\\r\\n'), 'utf-8');
console.log('Saved');
