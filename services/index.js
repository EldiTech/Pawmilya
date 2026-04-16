import { EmailAuthProvider, reauthenticateWithCredential, updateProfile as updateAuthProfile, updatePassword } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { normalizeAdoptionStatus, normalizeRescueStatus, normalizeTransferStatus } from '../utils/status';

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

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const otpSessions = new Map();

const otpService = {
  maskEmail(email = '') {
    const safeEmail = String(email || '').trim();
    const [name = '', domain = ''] = safeEmail.split('@');

    if (!name || !domain) return safeEmail;

    const visibleName = name.length <= 2 ? `${name[0] || '*'}*` : `${name.slice(0, 2)}${'*'.repeat(Math.max(name.length - 2, 1))}`;
    return `${visibleName}@${domain}`;
  },

  async sendOtp(email = '') {
    const safeEmail = String(email || '').trim().toLowerCase();

    if (!safeEmail) {
      return { success: false, message: 'Email is required for OTP.' };
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + OTP_EXPIRY_MS;

    const serviceId = process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID;
    const templateId = process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EXPO_PUBLIC_EMAILJS_PRIVATE_KEY;

    if (!serviceId || !templateId || !publicKey) {
      return {
        success: false,
        message: 'Missing EmailJS config. Set EXPO_PUBLIC_EMAILJS_SERVICE_ID, EXPO_PUBLIC_EMAILJS_TEMPLATE_ID, and EXPO_PUBLIC_EMAILJS_PUBLIC_KEY.',
      };
    }

    try {
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          accessToken: privateKey,
          template_params: {
            to_email: safeEmail,
            email: safeEmail,
            user_email: safeEmail,
            recipient: safeEmail,
            to: safeEmail,
            company_name: 'Pawmilya',
            app_name: 'Pawmilya',
            user_name: safeEmail.split('@')[0] || 'User',
            otp_code: code,
            otp: code,
            passcode: code,
            otp_expiry_minutes: '5',
          },
        }),
      });

      if (!response.ok) {
        const details = await response.text();
        const strictModeError = String(details || '').toLowerCase().includes('strict mode')
          && String(details || '').toLowerCase().includes('private key');
        const emptyRecipientError = String(details || '').toLowerCase().includes('recipient')
          && String(details || '').toLowerCase().includes('empty');

        return {
          success: false,
          message: strictModeError
            ? 'EmailJS strict mode is enabled. Add EXPO_PUBLIC_EMAILJS_PRIVATE_KEY to your .env (or disable strict mode for non-browser API access in EmailJS dashboard).'
            : emptyRecipientError
              ? 'EmailJS template recipient is empty. In EmailJS template settings, set To Email to {{to_email}} (or {{email}}).'
            : (details || 'Failed to send OTP email.'),
        };
      }

      otpSessions.set(safeEmail, { code, expiresAt });

      return {
        success: true,
        maskedEmail: otpService.maskEmail(safeEmail),
      };
    } catch (error) {
      return {
        success: false,
        message: error?.message || 'Failed to send OTP email.',
      };
    }
  },

  async verifyOtp(email = '', code = '') {
    const safeEmail = String(email || '').trim().toLowerCase();
    const safeCode = String(code || '').trim();
    const session = otpSessions.get(safeEmail);

    if (!session) {
      return { success: false, message: 'OTP session not found. Please request a new code.' };
    }

    if (Date.now() > session.expiresAt) {
      otpSessions.delete(safeEmail);
      return { success: false, message: 'OTP has expired. Please request a new code.' };
    }

    if (safeCode !== session.code) {
      return { success: false, message: 'Invalid verification code.' };
    }

    otpSessions.delete(safeEmail);
    return { success: true };
  },
};

const normalizePetRecord = (id, raw = {}) => {
  const docData = raw || {};
  const images = Array.isArray(docData.images) ? docData.images : [];
  const categoryName =
    docData.category
    || docData.type
    || docData.species
    || docData.animal_type
    || (Number(docData.category_id) === 2 ? 'cat' : Number(docData.category_id) === 1 ? 'dog' : '');

  const parsedAgeYears = Number.parseInt(docData.age_years, 10);
  const resolvedAge = Number.isFinite(parsedAgeYears) && parsedAgeYears > 0
    ? `${parsedAgeYears} year${parsedAgeYears === 1 ? '' : 's'}`
    : String(docData.age || '').trim();

  const normalizedCategory = String(categoryName || '').toLowerCase();

  return {
    id,
    ...docData,
    image: docData.image || docData.image_url || images[0] || null,
    breed: docData.breed || docData.breed_name || '',
    species: docData.species || (normalizedCategory ? `${normalizedCategory.charAt(0).toUpperCase()}${normalizedCategory.slice(1)}` : ''),
    category: normalizedCategory,
    age: resolvedAge || 'Unknown',
  };
};

const BLOCKED_PET_STATUSES = new Set([
  'pending',
  'reserved',
  'approved',
  'in_transit',
  'adopted',
  'unavailable',
  'not_available',
  'not available',
  'for_delivery',
  'delivered',
]);

const BLOCKED_LISTING_STATUSES = new Set([
  'cancelled',
  'adopted',
  'unlisted',
  'archived',
]);

const BLOCKED_ADOPTION_STATUSES = new Set([
  'pending',
  'approved',
  'completed',
  'in_transit',
  'for_delivery',
  'delivered',
]);

const isPetPubliclyAvailable = (pet = {}) => {
  const status = String(pet.status || '').trim().toLowerCase();
  const listingStatus = String(pet.adoption_listing_status || '').trim().toLowerCase();
  const adoptionStatus = String(pet.adoption_status || '').trim().toLowerCase();

  if (BLOCKED_PET_STATUSES.has(status)) {
    return false;
  }

  if (BLOCKED_LISTING_STATUSES.has(listingStatus)) {
    return false;
  }

  if (BLOCKED_ADOPTION_STATUSES.has(adoptionStatus)) {
    return false;
  }

  return true;
};

const getBlockedPetIdsFromAdoptions = async () => {
  try {
    const adoptionStatuses = ['pending', 'approved', 'completed', 'in_transit', 'for_delivery', 'delivered'];
    const adoptionQuery = query(collection(db, 'adoptions'), where('status', 'in', adoptionStatuses));
    const adoptionSnapshot = await getDocs(adoptionQuery);
    const blockedIds = new Set();

    adoptionSnapshot.forEach((adoptionDoc) => {
      const adoption = adoptionDoc.data() || {};
      const petId = String(adoption.pet_id || '').trim();
      if (petId) {
        blockedIds.add(petId);
      }
    });

    return blockedIds;
  } catch (error) {
    return new Set();
  }
};

const petService = {
  async getPets(filters = {}) {
    try {
      const q = query(collection(db, 'pets'));
      const querySnapshot = await getDocs(q);
      let data = [];
      querySnapshot.forEach((doc) => {
        const docData = doc.data() || {};
        if (docData.name && isPetPubliclyAvailable(docData)) {
          data.push(normalizePetRecord(doc.id, docData));
        }
      });

      const blockedPetIds = await getBlockedPetIdsFromAdoptions();
      if (blockedPetIds.size) {
        data = data.filter((pet) => !blockedPetIds.has(String(pet.id || '').trim()));
      }

      const { category, search } = filters;
      const categoryNeedle = (category || '').toLowerCase();
      const searchNeedle = (search || '').toLowerCase();

      data = data.filter((pet) => {
        const matchesCategory = categoryNeedle
          ? (pet.category || '').toLowerCase() === categoryNeedle
          : true;

        const haystack = `${pet.name || ''} ${pet.breed || ''} ${pet.location || ''}`.toLowerCase();
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
      const q = query(collection(db, 'pets'), limit(safeLimit * 4));
      const querySnapshot = await getDocs(q);
      const data = [];
      querySnapshot.forEach((doc) => {
        const docData = doc.data() || {};
        if (docData.name && isPetPubliclyAvailable(docData)) {
          data.push(normalizePetRecord(doc.id, docData));
        }
      });

      const blockedPetIds = await getBlockedPetIdsFromAdoptions();
      const filtered = blockedPetIds.size
        ? data.filter((pet) => !blockedPetIds.has(String(pet.id || '').trim()))
        : data;
      
      return { success: true, data: filtered.slice(0, safeLimit) };
    } catch (err) {
      console.error(err);
      return { success: false, data: [] };
    }
  },
};

const rescueService = {
  async getRescueReports({ limitCount = 20 } = {}) {
    try {
      const safeLimit = Number.isFinite(limitCount) ? Math.max(1, Math.trunc(limitCount)) : 20;
      const q = query(
        collection(db, 'rescue_reports'), 
        where('status', 'in', ['active', 'pending', 'new', 'open', 'unassigned', 'in_progress', 'on_the_way', 'arrived']),
        limit(safeLimit)
      );
      const querySnapshot = await getDocs(q);
      const data = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      
      // Sort by created_at locally if we can't use order_by with where in easily without index
      data.sort((a, b) => {
        const dateA = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at || 0);
        const dateB = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at || 0);
        return dateB - dateA;
      });

      return { success: true, data };
    } catch (error) {
      console.error('Error fetching rescue reports:', error);
      return { success: false, data: [] };
    }
  },

  async getRescueStats() {
    try {
      const activeQ = query(collection(db, 'rescue_reports'), where('status', 'in', ['active', 'pending', 'new', 'open', 'unassigned', 'in_progress', 'on_the_way', 'arrived', 'pending_verification']));
      const activeSnap = await getDocs(activeQ);
      const activeCount = activeSnap.size;

      const rescuedQ = query(collection(db, 'rescue_reports'), where('status', 'in', ['rescued', 'resolved', 'completed']));
      const rescuedSnap = await getDocs(rescuedQ);
      const rescuedCount = rescuedSnap.size;

      const allReportsSnap = await getDocs(collection(db, 'rescue_reports'));
      const uniqueVolunteerIds = new Set();

      allReportsSnap.forEach((reportDoc) => {
        const report = reportDoc.data() || {};

        const singleAssignees = [
          report.rescuer_id,
          report.rescuer_uid,
          report.assigned_rescuer_id,
          report.assigned_to,
          report.accepted_by,
          report.verified_rescuer_id,
          report.volunteer_id,
        ];

        singleAssignees.forEach((value) => {
          const id = String(value || '').trim();
          if (id) {
            uniqueVolunteerIds.add(id);
          }
        });

        const listAssignees = [report.volunteer_ids, report.volunteers, report.assigned_rescuers];
        listAssignees.forEach((list) => {
          if (!Array.isArray(list)) return;
          list.forEach((value) => {
            const id = String(value || '').trim();
            if (id) {
              uniqueVolunteerIds.add(id);
            }
          });
        });
      });

      return {
        success: true,
        data: {
          active: activeCount,
          volunteers: uniqueVolunteerIds.size,
          rescued: rescuedCount,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: { active: 0, volunteers: 0, rescued: 0 },
      };
    }
  },

  async volunteerForRescue(reportId) {
    if (!reportId) {
      return { success: false, error: 'Missing report id' };
    }

    return { success: true, message: 'Volunteer registered' };
  },

  async createRescueReport(reportData = {}) {
    try {
      const currentUser = auth.currentUser;
      const reporterId = String(currentUser?.uid || reportData?.reporter_id || reportData?.user_id || '').trim();
      const normalizedReporterType = reporterId ? 'member' : 'guest';

      const appData = {
        ...reportData,
        ...(reporterId ? {
          reporter_id: reporterId,
          reporter_uid: reporterId,
          user_id: reporterId,
          created_by: reporterId,
        } : {}),
        reporter_type: normalizedReporterType,
        status: 'active',
        created_at: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'rescue_reports'), appData);

      if (reporterId) {
        const notificationRef = doc(collection(db, 'notifications'));
        await setDoc(notificationRef, {
          user_id: reporterId,
          title: 'Rescue Report Submitted',
          message: `Your report "${reportData?.title || `Report #${docRef.id}`}" was submitted successfully. We will notify you when there is an update.`,
          type: 'rescue_report_submitted',
          rescue_report_id: docRef.id,
          read: false,
          created_at: serverTimestamp(),
        });
      }

      return {
        success: true,
        message: 'Rescue report created',
        data: { id: docRef.id, ...appData },
      };
    } catch (error) {
      console.error('Error creating rescue report:', error);
      return { success: false, message: 'Failed to create report' };
    }
  },

  async requestRescuerAdoption(reportId, notes = '') {
    const safeReportId = String(reportId || '').trim();
    const rescuerId = auth.currentUser?.uid;

    if (!safeReportId) {
      return { success: false, error: 'Missing rescue report id' };
    }

    if (!rescuerId) {
      return { success: false, error: 'You must be logged in to request adoption' };
    }

    try {
      const reportRef = doc(db, 'rescue_reports', safeReportId);
      const reportSnap = await getDoc(reportRef);

      if (!reportSnap.exists()) {
        return { success: false, error: 'Rescue report not found' };
      }

      const reportData = reportSnap.data() || {};
      const reportStatus = normalizeRescueStatus(reportData.status);

      if (reportStatus !== 'rescued') {
        return { success: false, error: 'Only completed rescues can be requested for adoption' };
      }

      const adoptionStatus = normalizeAdoptionStatus(reportData.rescuer_adoption_status);

      if (adoptionStatus === 'approved') {
        return { success: false, error: 'This rescued animal is already adopted by you' };
      }

      if (adoptionStatus === 'requested') {
        return { success: false, error: 'Your adoption request is already pending' };
      }

      const assignedRescuerId = String(
        reportData.rescuer_id
          ?? reportData.rescuer_uid
          ?? reportData.assigned_rescuer_id
          ?? reportData.assigned_to
          ?? reportData.accepted_by
          ?? ''
      );

      if (assignedRescuerId && assignedRescuerId !== rescuerId) {
        return { success: false, error: 'Only the rescuer assigned to this report can request adoption' };
      }

      await updateDoc(reportRef, {
        rescuer_adoption_status: 'requested',
        rescuer_adoption_requested_by: rescuerId,
        rescuer_adoption_requested_at: serverTimestamp(),
        rescuer_adoption_notes: String(notes || '').trim(),
        updated_at: serverTimestamp(),
      });

      return {
        success: true,
        message: 'Adoption request submitted successfully',
      };
    } catch (error) {
      console.error('Error requesting rescuer adoption:', error);
      return {
        success: false,
        error: error?.message || 'Failed to submit adoption request',
      };
    }
  },
};

const userService = {
  async getTwoFactorPreferenceByEmail(email = '') {
    const safeEmail = String(email || '').trim().toLowerCase();

    if (!safeEmail) {
      return { success: false, error: 'Email is required', enabled: true };
    }

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', safeEmail), limit(1));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return { success: true, enabled: true };
      }

      const data = snapshot.docs[0].data() || {};
      const isAdmin = data.role === 'admin';
      return { success: true, enabled: data.two_factor_enabled !== false, isAdmin };
    } catch (error) {
      return { success: false, error: error?.message || 'Failed to fetch 2FA preference', enabled: true };
    }
  },

  async getProfile() {
    const currentUser = auth.currentUser;

    if (!currentUser?.uid) {
      return { success: false, error: 'No authenticated user', data: null };
    }

    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      const data = userDoc.exists() ? userDoc.data() : {};

      return {
        success: true,
        data: {
          uid: currentUser.uid,
          full_name: data?.full_name || currentUser.displayName || 'User',
          email: data?.email || currentUser.email || '',
          avatar_url: data?.avatar_url || currentUser.photoURL || '',
          phone: data?.phone || data?.phone_number || '',
          bio: data?.bio || '',
          address: data?.address || '',
          city: data?.city || '',
          two_factor_enabled: data?.two_factor_enabled !== false,
        },
      };
    } catch (error) {
      return { success: false, error: error?.message || 'Failed to fetch profile', data: null };
    }
  },

  async updateProfile(profileData = {}) {
    const currentUser = auth.currentUser;

    if (!currentUser?.uid) {
      return { success: false, error: 'No authenticated user' };
    }

    const safeData = {
      full_name: String(profileData.full_name || '').trim(),
      phone: String(profileData.phone || '').trim(),
      bio: String(profileData.bio || '').trim(),
      address: String(profileData.address || '').trim(),
      city: String(profileData.city || '').trim(),
      updated_at: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'users', currentUser.uid), safeData, { merge: true });

      if (safeData.full_name) {
        await updateAuthProfile(currentUser, { displayName: safeData.full_name });
      }

      return { success: true, user: safeData };
    } catch (error) {
      return { success: false, error: error?.message || 'Failed to update profile' };
    }
  },

  async uploadAvatar(avatarUri = '') {
    const currentUser = auth.currentUser;

    if (!currentUser?.uid) {
      return { success: false, error: 'No authenticated user' };
    }

    const safeUri = String(avatarUri || '').trim();
    if (!safeUri) {
      return { success: false, error: 'Avatar URI is required' };
    }

    try {
      await setDoc(doc(db, 'users', currentUser.uid), {
        avatar_url: safeUri,
        updated_at: serverTimestamp(),
      }, { merge: true });

      return { success: true, avatar_url: safeUri };
    } catch (error) {
      return { success: false, error: error?.message || 'Failed to update avatar' };
    }
  },

  async toggle2FA() {
    const currentUser = auth.currentUser;

    if (!currentUser?.uid) {
      return { success: false, error: 'No authenticated user' };
    }

    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    const currentEnabled = userDoc.exists() ? userDoc.data()?.two_factor_enabled !== false : true;
    const nextEnabled = !currentEnabled;

    await setDoc(userDocRef, {
      two_factor_enabled: nextEnabled,
      updated_at: serverTimestamp(),
    }, { merge: true });

    return { success: true, data: { two_factor_enabled: nextEnabled } };
  },

  async getFavorites() {
    return { success: true, data: [] };
  },

  async getApplications() {
    return { success: true, data: [] };
  },

  async getUnreadNotificationsCount() {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return { success: true, data: { count: 0 } };
      
      const q = query(
        collection(db, 'notifications'),
        where('user_id', '==', currentUser.uid),
        where('read', '==', false)
      );
      
      const snapshot = await getDocs(q);
      return { success: true, data: { count: snapshot.size } };
    } catch (e) {
      return { success: true, data: { count: 0 } };
    }
  },

  async changePassword(currentPassword, newPassword) {
    try {
      const user = auth.currentUser;
      if (!user) return { success: false, error: 'No user signed in' };
      if (!user.email) return { success: false, error: 'User email not found' };
      
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      
      return { success: true };
    } catch (error) {
      console.error('Change password error:', error);
      let errorMsg = 'Failed to update password. Please try again.';
      if (error.code === 'auth/invalid-login-credentials' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMsg = 'Current password is incorrect';
      }
      return { success: false, error: errorMsg };
    }
  },

  async deleteAccount() {
    return { success: false, error: 'Delete account is currently unavailable' };
  },
};

const shelterService = {
  async getShelterManagerStatus() {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return { success: false, isManager: false };
      
      const userRef = doc(db, 'users', currentUser.uid);
      const docSnap = await getDoc(userRef);
      if (docSnap.exists() && docSnap.data().is_shelter_manager) {
        return { success: true, isManager: true };
      }
      return { success: true, isManager: false };
    } catch (e) {
      return { success: false, isManager: false };
    }
  },

  async submitShelterApplication(applicationData) {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return { success: false, error: 'Not authenticated' };
      }

      const appData = {
        ...applicationData,
        user_id: currentUser.uid,
        status: 'pending',
        created_at: serverTimestamp(),
      };

      await addDoc(collection(db, 'shelter_applications'), appData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message || 'Failed to submit shelter application' };
    }
  },

  async getMyShelterApplication() {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return { success: false, error: 'Not authenticated', data: null };
      }

      const q = query(
        collection(db, 'shelter_applications'),
        where('user_id', '==', currentUser.uid),
        limit(1)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        return { 
          success: true, 
          data: { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } 
        };
      }
      return { success: true, data: null };
    } catch (error) {
      return { success: false, error: error?.message || 'Failed to fetch shelter application', data: null };
    }
  },

  async getManagedShelter() {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return { success: false, error: 'Not authenticated', data: null };
      }

      const q = query(
        collection(db, 'shelters'),
        where('manager_id', '==', currentUser.uid),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return { success: true, data: { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } };
      }
      return { success: false, error: 'Shelter not found', data: null };
    } catch (error) {
      return { success: false, error: error?.message || 'Failed to fetch managed shelter', data: null };
    }
  },

  async getManagedShelterPets() {
    try {
      const shelterResponse = await this.getManagedShelter();
      if (!shelterResponse?.success || !shelterResponse?.data?.id) {
        return { success: false, error: shelterResponse?.error || 'Shelter not found', data: [] };
      }

      const shelter = shelterResponse.data;
      const q = query(collection(db, 'pets'), where('shelter_id', '==', shelter.id));
      const snapshot = await getDocs(q);
      const pets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return { success: true, data: pets };
    } catch (error) {
      return { success: false, error: error?.message || 'Failed to fetch managed shelter pets', data: [] };
    }
  },

  async getManagedShelterTransfers() {
    try {
      const shelterResponse = await this.getManagedShelter();
      if (!shelterResponse?.success || !shelterResponse?.data?.id) {
        return { success: false, error: shelterResponse?.error || 'Shelter not found', data: [] };
      }

      const shelter = shelterResponse.data;
      const queries = [
        getDocs(query(collection(db, 'transfers'), where('from_shelter_id', '==', shelter.id))),
        getDocs(query(collection(db, 'transfers'), where('to_shelter_id', '==', shelter.id)))
      ];
      
      const [fromSnap, toSnap] = await Promise.all(queries);
      const transfers = [];
      fromSnap.forEach(doc => transfers.push({ id: doc.id, ...doc.data() }));
      toSnap.forEach(doc => {
        if (!transfers.find(t => t.id === doc.id)) {
          transfers.push({ id: doc.id, ...doc.data() });
        }
      });
      return { success: true, data: transfers };
    } catch (error) {
      return { success: false, error: error?.message || 'Failed to fetch transfers', data: [] };
    }
  },

  async getShelterAdoptions() {
    try {
      const shelterResponse = await this.getManagedShelter();
      if (!shelterResponse?.success || !shelterResponse?.data?.id) {
        return { success: false, error: shelterResponse?.error || 'Shelter not found', data: [] };
      }

      const shelter = shelterResponse.data;
      const q = query(collection(db, 'adoptions'), where('shelter_id', '==', shelter.id));
      const snapshot = await getDocs(q);
      return { success: true, data: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) };
    } catch (error) {
      return { success: false, error: error?.message || 'Failed to fetch shelter adoptions', data: [] };
    }
  },

  async getManagedShelterPaymentsOverview() {
    return { summary: { total: 0 }, recentPayments: [] };
  },

  async verifyAdoptionPayment(id) {
    return { success: true };
  },

  async respondToTransferRequest(id, status) {
    try {
      const ref = doc(db, 'transfers', id);
      await updateDoc(ref, { status, updated_at: serverTimestamp() });
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message || 'Failed to update transfer request' };
    }
  },

  async updateManagedShelterPet(id, data) {
    try {
      const ref = doc(db, 'pets', id);
      await updateDoc(ref, { ...data, updated_at: serverTimestamp() });
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message || 'Failed to update shelter pet' };
    }
  },

  async updateManagedShelter(data) {
    try {
      const shelterResponse = await this.getManagedShelter();
      if (!shelterResponse?.success || !shelterResponse?.data?.id) {
        return { success: false, error: shelterResponse?.error || 'Shelter not found' };
      }

      const shelter = shelterResponse.data;
      const ref = doc(db, 'shelters', shelter.id);
      await updateDoc(ref, { ...data, updated_at: serverTimestamp() });
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message || 'Failed to update shelter profile' };
    }
  },

  async updateAdoptionStatus(id, status, reason = null) {
    try {
      const ref = doc(db, 'adoptions', id);
      const payload = { status, updated_at: serverTimestamp() };
      if (reason) payload.rejection_reason = reason;
      await updateDoc(ref, payload);
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message || 'Failed to update adoption status' };
    }
  },

  async confirmAdoptionPayment(id) {
    try {
      const ref = doc(db, 'adoptions', id);
      await updateDoc(ref, { payment_verified: true, updated_at: serverTimestamp() });
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message || 'Failed to confirm adoption payment' };
    }
  },

  async updateDeliveryStatus(id, status) {
    try {
      const ref = doc(db, 'adoptions', id);
      await updateDoc(ref, { delivery_status: status, updated_at: serverTimestamp() });
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message || 'Failed to update delivery status' };
    }
  },

  async getShelters() {
    try {
      const q = query(
        collection(db, 'shelters'),
        where('status', '==', 'active')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      return [];
    }
  },

  async getAvailableShelters() {
    try {
      const shelters = await this.getShelters();
      const list = Array.isArray(shelters) ? shelters : [];

      // Keep shelters with no capacity value or with at least 1 available slot.
      return list.filter((item) => {
        const capacity = Number(item?.shelter_capacity || 0);
        const currentCount = Number(item?.current_count || 0);
        const availableSlots = item?.available_slots !== undefined
          ? Number(item.available_slots)
          : (capacity > 0 ? capacity - currentCount : 1);

        return capacity === 0 || availableSlots > 0;
      });
    } catch (error) {
      console.error('Error getting available shelters:', error);
      return [];
    }
  },

  async createTransferRequest(rescueReportId, shelterId, notes = '', urgency = 'normal') {
    const currentUser = auth.currentUser;
    const reportId = String(rescueReportId || '').trim();
    const targetShelterId = String(shelterId || '').trim();

    if (!currentUser?.uid) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!reportId || !targetShelterId) {
      return { success: false, error: 'Missing rescue report or shelter id' };
    }

    try {
      const reportRef = doc(db, 'rescue_reports', reportId);
      const reportSnap = await getDoc(reportRef);
      if (!reportSnap.exists()) {
        return { success: false, error: 'Rescue report not found' };
      }

      const reportData = reportSnap.data() || {};

      const shelterRef = doc(db, 'shelters', targetShelterId);
      const shelterSnap = await getDoc(shelterRef);
      const shelterData = shelterSnap.exists() ? (shelterSnap.data() || {}) : {};

      // Block repeat submissions for the same rescue while a prior transfer is still active.
      const existingTransfersSnap = await getDocs(
        query(collection(db, 'transfers'), where('rescue_report_id', '==', reportId))
      );

      const blockedStatuses = new Set(['pending', 'approved', 'in_transit', 'arrived_at_shelter', 'completed']);
      let existingTransfer = null;

      existingTransfersSnap.forEach((transferDoc) => {
        if (existingTransfer) {
          return;
        }

        const transfer = transferDoc.data() || {};
        const transferRescuerId = String(transfer.rescuer_id || transfer.requested_by || '').trim();
        const transferStatus = normalizeTransferStatus(transfer.status);

        if (transferRescuerId === currentUser.uid && blockedStatuses.has(transferStatus)) {
          existingTransfer = { id: transferDoc.id, ...transfer, status: transferStatus };
        }
      });

      if (existingTransfer) {
        const existingShelterName =
          existingTransfer.shelter_name ||
          existingTransfer.to_shelter_name ||
          shelterData.name ||
          'the selected shelter';

        return {
          success: false,
          code: 'transfer_request_exists',
          error: `A transfer request is already in progress for this rescue report to ${existingShelterName}. Please wait for the shelter decision before submitting again.`,
          data: { existing_transfer: existingTransfer },
        };
      }

      const transferPayload = {
        rescue_report_id: reportId,
        rescuer_id: currentUser.uid,
        from_rescue_status: normalizeRescueStatus(reportData.status),
        shelter_id: targetShelterId,
        shelter_name: shelterData.name || '',
        shelter_address: shelterData.address || '',
        shelter_city: shelterData.city || '',
        shelter_phone: shelterData.phone || '',
        shelter_latitude: shelterData.latitude ?? null,
        shelter_longitude: shelterData.longitude ?? null,
        status: 'pending',
        urgency: String(urgency || 'normal').toLowerCase(),
        notes: String(notes || '').trim(),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      };

      const transferRef = await addDoc(collection(db, 'transfers'), transferPayload);

      await updateDoc(reportRef, {
        shelter_transfer_request_id: transferRef.id,
        shelter_transfer_status: 'pending',
        transferred_shelter_id: targetShelterId,
        transferred_shelter_name: shelterData.name || '',
        transferred_shelter_address: shelterData.address || '',
        transferred_shelter_city: shelterData.city || '',
        transferred_shelter_latitude: shelterData.latitude ?? null,
        transferred_shelter_longitude: shelterData.longitude ?? null,
        shelter_transfer_requested_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      return {
        success: true,
        message: 'Transfer request submitted',
        data: {
          transfer_request: {
            id: transferRef.id,
            ...transferPayload,
          },
        },
      };
    } catch (error) {
      console.error('Error creating transfer request:', error);
      return { success: false, error: error?.message || 'Failed to create transfer request' };
    }
  },

  async getMyTransferRequests() {
    const currentUser = auth.currentUser;
    if (!currentUser?.uid) {
      return { success: false, data: [] };
    }

    try {
      const [byRescuer, byRequestedBy] = await Promise.all([
        getDocs(query(collection(db, 'transfers'), where('rescuer_id', '==', currentUser.uid))),
        getDocs(query(collection(db, 'transfers'), where('requested_by', '==', currentUser.uid))),
      ]);

      const merged = new Map();
      byRescuer.forEach((docSnap) => merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
      byRequestedBy.forEach((docSnap) => merged.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));

      const rows = Array.from(merged.values()).sort((a, b) => {
        const aDate = a?.updated_at?.toDate ? a.updated_at.toDate() : new Date(a?.updated_at || 0);
        const bDate = b?.updated_at?.toDate ? b.updated_at.toDate() : new Date(b?.updated_at || 0);
        return bDate - aDate;
      });

      return { success: true, data: rows };
    } catch (error) {
      console.error('Error getting transfer requests:', error);
      return { success: false, data: [], error: error?.message || 'Failed to fetch transfer requests' };
    }
  },

  async updateTransferDeliveryStatus(transferRequestId, status, notes = '') {
    const requestId = String(transferRequestId || '').trim();
    const nextStatus = normalizeTransferStatus(status);

    if (!requestId || !nextStatus) {
      return { success: false, error: 'Missing transfer id or status' };
    }

    try {
      const transferRef = doc(db, 'transfers', requestId);
      const transferSnap = await getDoc(transferRef);
      if (!transferSnap.exists()) {
        return { success: false, error: 'Transfer request not found' };
      }

      const transferData = transferSnap.data() || {};

      await updateDoc(transferRef, {
        status: nextStatus,
        delivery_notes: String(notes || '').trim(),
        updated_at: serverTimestamp(),
      });

      const rescueReportId = String(transferData.rescue_report_id || '').trim();
      if (rescueReportId) {
        const reportRef = doc(db, 'rescue_reports', rescueReportId);
        await updateDoc(reportRef, {
          shelter_transfer_status: nextStatus,
          transferred_shelter_id: transferData.shelter_id || '',
          transferred_shelter_name: transferData.shelter_name || '',
          transferred_shelter_address: transferData.shelter_address || '',
          transferred_shelter_city: transferData.shelter_city || '',
          transferred_shelter_latitude: transferData.shelter_latitude ?? null,
          transferred_shelter_longitude: transferData.shelter_longitude ?? null,
          updated_at: serverTimestamp(),
        });
      }

      return {
        success: true,
        message: 'Transfer delivery status updated',
        data: {
          transfer_request: {
            id: requestId,
            ...transferData,
            status: nextStatus,
            delivery_notes: String(notes || '').trim(),
          },
        },
      };
    } catch (error) {
      console.error('Error updating transfer delivery status:', error);
      return { success: false, error: error?.message || 'Failed to update delivery status' };
    }
  },

  async getShelterById(id) {
    try {
      const docSnap = await getDoc(doc(db, 'shelters', id));
      if (docSnap.exists()) {
        return { success: true, data: { id: docSnap.id, ...docSnap.data() } };
      }

      return { success: false, error: 'Not found', data: null };
    } catch (error) {
      return { success: false, error: error?.message || 'Failed to fetch shelter', data: null };
    }
  },

  async getShelterPets(id) {
    try {
      const q = query(collection(db, 'pets'), where('shelter_id', '==', id));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      return [];
    }
  }
};

export { otpService, petService, rescueService, shelterService, userService };

