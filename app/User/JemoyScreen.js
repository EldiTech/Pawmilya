import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocs } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import { db } from '../../firebaseConfig';

const QUICK_PROMPTS = [
  'How do I prepare my home for a new dog?',
  'What food is best for kittens?',
  'How to calm an anxious rescue pet?',
  'What vaccines are needed first?',
];

const APP_QUICK_PROMPTS = [
  'How many tabs are in the app?',
  'Where can I report a stray animal?',
  'How do I apply for adoption?',
  'Why is a pet marked unavailable?',
];

const APP_ASSISTANT_RULES = `
You are Jemoy, the in-app assistant for Pawmilya.
Answer clearly and briefly.
Prioritize app guidance when the user asks about app usage, navigation, counts, steps, or reasons.
If unsure, state uncertainty and provide the best next action in the app.

App facts:
- Main user tabs: Home, Pets, Shelter, Adoptions, Settings.
- Report rescue flow: Home -> Found a Stray Animal card -> submit rescue report.
- Adoption flow: Pets -> open pet -> submit adoption application -> shelter/admin review -> approved requests move to adoption chat and transfer flow.
- Shelter messaging: Shelter tab lists shelters and allows chat.
- Ask Jemoy entry: Settings -> Ask Jemoy.
- Pet availability basics: pets can become unavailable when pending/approved/completed adoption or listing is cancelled/unlisted.
`;

const APP_KNOWLEDGE_SECTIONS = [
  {
    title: 'App Overview',
    keywords: ['app', 'overview', 'about', 'what is pawmilya', 'purpose'],
    content: 'Pawmilya is a rescue, adoption, and shelter coordination app. It helps users adopt pets, report rescue cases, message shelters, and track adoption progress.',
  },
  {
    title: 'User Navigation',
    keywords: ['tab', 'tabs', 'navigation', 'menu', 'home', 'pets', 'shelter', 'adoptions', 'settings'],
    content: 'Main user tabs are Home, Pets, Shelter, Adoptions, and Settings. Ask Jemoy is opened from Settings.',
  },
  {
    title: 'Guest Navigation',
    keywords: ['guest', 'guest tab', 'login', 'mission', 'rescue'],
    content: 'Guest area includes Home, Pets, Rescue, Mission, and Log In. Guests can browse and report, but account actions require sign-in.',
  },
  {
    title: 'Adoption Flow',
    keywords: ['adoption', 'apply', 'adopt', 'application', 'requirements', 'process'],
    content: 'Adoption flow: open Pets, choose a pet, submit adoption form, wait for review, then continue through chat and transfer updates when approved.',
  },
  {
    title: 'Rescue Flow',
    keywords: ['rescue', 'stray', 'report', 'urgent', 'mission'],
    content: 'Rescue flow starts from Home using Found a Stray Animal. Users submit details and location so rescuers/admin can coordinate response.',
  },
  {
    title: 'Shelter Features',
    keywords: ['shelter', 'shelter chat', 'shelter registration', 'manage shelter', 'shelter manager'],
    content: 'Shelter tools include shelter listing and chat, shelter application, and management screens for profile, pets, adoptions, transfers, and funds.',
  },
  {
    title: 'Rescuer Features',
    keywords: ['rescuer', 'rescue dashboard', 'volunteer', 'mission progress'],
    content: 'Rescuer flow includes application, rescuer dashboard, mission assignment, and mission completion with admin verification steps.',
  },
  {
    title: 'Admin Features',
    keywords: ['admin', 'admin dashboard', 'admin review', 'applications', 'reports', 'transfers'],
    content: 'Admin module handles users, shelters, rescue reports, adoptions, pets, transfer/delivery processes, and application approvals.',
  },
  {
    title: 'Chat Features',
    keywords: ['chat', 'message', 'conversation', 'adoption chat'],
    content: 'Chat is available for user-to-shelter communication in Shelter listings and adoption-specific conversations in Adoptions.',
  },
  {
    title: 'Availability Rules',
    keywords: ['available', 'unavailable', 'adopted', 'in process', 'status'],
    content: 'Pets are unavailable when in active adoption lifecycle states (pending, approved, completed, in transit) or when listing status is cancelled/unlisted.',
  },
  {
    title: 'Notifications and Settings',
    keywords: ['notifications', 'settings', 'profile', 'two factor', '2fa', 'security'],
    content: 'Settings supports profile edits, password change, two-factor toggle, notifications access, rescuer/shelter registration entry points, and Ask Jemoy.',
  },
];

const APP_INTENT_KEYWORDS = [
  'app', 'pawmilya', 'tab', 'menu', 'screen', 'where', 'how', 'why', 'how many', 'count',
  'adoption', 'rescue', 'shelter', 'rescuer', 'admin', 'chat', 'settings', 'notification',
  'login', 'signup', 'sign up', 'report', 'mission', 'status', 'available', 'unavailable',
];

const GEMINI_MODEL = String(process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-flash-lite-latest').trim();
const GEMINI_TIMEOUT_MS = 25000;
const APP_STATS_CACHE_TTL_MS = 60 * 1000;

let appStatsCache = {
  fetchedAt: 0,
  value: null,
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

const BLOCKED_LISTING_STATUSES = new Set(['cancelled', 'adopted', 'unlisted', 'archived']);
const BLOCKED_ADOPTION_STATUSES = new Set(['pending', 'approved', 'completed', 'in_transit', 'for_delivery', 'delivered']);
const ACTIVE_RESCUE_STATUSES = new Set(['active', 'pending', 'new', 'open', 'unassigned', 'in_progress', 'on_the_way', 'arrived', 'pending_verification']);

const APP_FAQ_RULES = [
  {
    match: (q) => q.includes('how many') && (q.includes('tab') || q.includes('menu')),
    answer: 'Pawmilya has 5 main tabs for users: Home, Pets, Shelter, Adoptions, and Settings.',
  },
  {
    match: (q) => q.includes('where') && (q.includes('report') || q.includes('stray') || q.includes('rescue')),
    answer: 'Go to Home and tap the Found a Stray Animal card to submit a rescue report.',
  },
  {
    match: (q) => (q.includes('how') && q.includes('adopt')) || q.includes('adoption process'),
    answer: 'Open Pets, choose a pet, tap Adopt, complete the form, and wait for review. You can then continue through chat and transfer updates if approved.',
  },
  {
    match: (q) => q.includes('where') && (q.includes('chat') || q.includes('message')),
    answer: 'Use the Shelter tab to message listed shelters, or use the Adoptions chat when you have an active adoption conversation.',
  },
  {
    match: (q) => q.includes('why') && (q.includes('unavailable') || q.includes('not available')),
    answer: 'A pet is usually marked unavailable when it is already in an active adoption flow (pending, approved, or completed) or when its listing is no longer active.',
  },
  {
    match: (q) => q.includes('where') && q.includes('jemoy'),
    answer: 'You can open Ask Jemoy from Settings.',
  },
  {
    match: (q) => q.includes('how many') && q.includes('role'),
    answer: 'The app supports multiple roles: Guest, User (adopter), Rescuer, Shelter, and Admin.',
  },
  {
    match: (q) => q.includes('where') && (q.includes('shelter') && q.includes('apply')),
    answer: 'Go to Settings and select Register a Shelter, or Manage My Shelter if your application is already approved.',
  },
  {
    match: (q) => q.includes('where') && (q.includes('rescuer') && q.includes('apply')),
    answer: 'Go to Settings and tap Become a Rescuer to open the rescuer application flow.',
  },
];

const getAppFaqAnswer = (question = '') => {
  const normalized = String(question || '').toLowerCase();
  const matched = APP_FAQ_RULES.find((rule) => rule.match(normalized));
  return matched ? matched.answer : '';
};

const isCountQuestion = (question = '') => {
  const normalized = String(question || '').toLowerCase();
  return (
    normalized.includes('how many')
    || normalized.includes('count')
    || normalized.includes('number of')
    || normalized.includes('total')
  );
};

const isAppQuestion = (question = '') => {
  const normalized = String(question || '').toLowerCase();
  return APP_INTENT_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const buildAppKnowledgeContext = () => {
  return APP_KNOWLEDGE_SECTIONS
    .map((section) => `${section.title}: ${section.content}`)
    .join('\n');
};

const getAppKnowledgeAnswer = (question = '') => {
  if (!isAppQuestion(question)) {
    return '';
  }

  const normalized = String(question || '').toLowerCase();

  const scored = APP_KNOWLEDGE_SECTIONS
    .map((section) => {
      const score = section.keywords.reduce((total, keyword) => {
        return total + (normalized.includes(keyword) ? 1 : 0);
      }, 0);

      return { ...section, score };
    })
    .filter((section) => section.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (!scored.length) {
    return 'I can help with app navigation, adoption flow, rescue reporting, shelter chat, and account settings. Tell me what part you need and I will guide you step by step.';
  }

  return scored.map((section) => `${section.title}: ${section.content}`).join('\n\n');
};

const fetchLiveAppStats = async () => {
  const now = Date.now();
  if (appStatsCache.value && now - appStatsCache.fetchedAt < APP_STATS_CACHE_TTL_MS) {
    return appStatsCache.value;
  }

  const [petsSnapshot, adoptionsSnapshot, rescueSnapshot, sheltersSnapshot] = await Promise.all([
    getDocs(collection(db, 'pets')),
    getDocs(collection(db, 'adoptions')),
    getDocs(collection(db, 'rescue_reports')),
    getDocs(collection(db, 'shelters')),
  ]);

  const blockedPetIds = new Set();
  let activeAdoptions = 0;

  adoptionsSnapshot.forEach((adoptionDoc) => {
    const adoption = adoptionDoc.data() || {};
    const adoptionStatus = String(adoption.status || '').trim().toLowerCase();
    if (BLOCKED_ADOPTION_STATUSES.has(adoptionStatus)) {
      activeAdoptions += 1;
      const petId = String(adoption.pet_id || '').trim();
      if (petId) {
        blockedPetIds.add(petId);
      }
    }
  });

  let availablePets = 0;
  petsSnapshot.forEach((petDoc) => {
    const pet = petDoc.data() || {};
    const status = String(pet.status || '').trim().toLowerCase();
    const listingStatus = String(pet.adoption_listing_status || '').trim().toLowerCase();
    const adoptionStatus = String(pet.adoption_status || '').trim().toLowerCase();

    if (BLOCKED_PET_STATUSES.has(status)) return;
    if (BLOCKED_LISTING_STATUSES.has(listingStatus)) return;
    if (BLOCKED_ADOPTION_STATUSES.has(adoptionStatus)) return;
    if (blockedPetIds.has(petDoc.id)) return;

    availablePets += 1;
  });

  let activeRescueReports = 0;
  rescueSnapshot.forEach((rescueDoc) => {
    const rescue = rescueDoc.data() || {};
    const rescueStatus = String(rescue.status || '').trim().toLowerCase();
    if (ACTIVE_RESCUE_STATUSES.has(rescueStatus)) {
      activeRescueReports += 1;
    }
  });

  const stats = {
    availablePets,
    activeRescueReports,
    activeAdoptions,
    shelters: sheltersSnapshot.size,
    userTabs: 5,
    guestTabs: 5,
    roles: 5,
  };

  appStatsCache = {
    fetchedAt: now,
    value: stats,
  };

  return stats;
};

const buildLiveStatsContext = (stats = {}) => {
  return [
    `Available pets: ${stats.availablePets ?? 0}`,
    `Active rescue reports: ${stats.activeRescueReports ?? 0}`,
    `Active adoption records: ${stats.activeAdoptions ?? 0}`,
    `Registered shelters: ${stats.shelters ?? 0}`,
    `Main user tabs: ${stats.userTabs ?? 5}`,
    `Main guest tabs: ${stats.guestTabs ?? 5}`,
  ].join('\n');
};

const getLiveStatsAnswer = (question = '', stats = {}) => {
  const normalized = String(question || '').toLowerCase();

  if (normalized.includes('tab') || normalized.includes('menu')) {
    return `Users have ${stats.userTabs ?? 5} main tabs. Guests also have ${stats.guestTabs ?? 5} main tabs.`;
  }

  if (normalized.includes('pet') || normalized.includes('adopt')) {
    return `There are currently ${stats.availablePets ?? 0} pets available for adoption, with ${stats.activeAdoptions ?? 0} active adoption records in progress.`;
  }

  if (normalized.includes('rescue') || normalized.includes('report')) {
    return `There are currently ${stats.activeRescueReports ?? 0} active rescue reports.`;
  }

  if (normalized.includes('shelter')) {
    return `There are currently ${stats.shelters ?? 0} registered shelters in the app.`;
  }

  if (normalized.includes('role')) {
    return `Pawmilya supports ${stats.roles ?? 5} core roles: Guest, User, Rescuer, Shelter, and Admin.`;
  }

  return `Current app counts: ${stats.availablePets ?? 0} available pets, ${stats.activeRescueReports ?? 0} active rescue reports, ${stats.activeAdoptions ?? 0} active adoptions, and ${stats.shelters ?? 0} registered shelters.`;
};

const buildLocalFallback = (question = '') => {
  const normalized = String(question || '').toLowerCase();

  if (normalized.includes('food') || normalized.includes('feed')) {
    return 'For most pets, use age-appropriate food, provide clean water all day, and keep feeding times consistent. If there is a medical history, check with a vet before changing diet.';
  }

  if (normalized.includes('vaccine') || normalized.includes('shot')) {
    return 'Start with core vaccines based on age and species. The safest next step is a vet visit to get a personalized vaccine schedule.';
  }

  if (normalized.includes('anxious') || normalized.includes('scared')) {
    return 'Give your pet a quiet safe space, keep routines predictable, and use short calm interactions. Avoid forcing contact while trust is still building.';
  }

  if (normalized.includes('adopt')) {
    return 'Prepare food, water bowls, safe sleeping space, and a calm routine before bringing a pet home. Plan a first-week vet check and gradual bonding time.';
  }

  return 'I can still help right now: tell me your pet type, age, and concern, and I will give practical care tips while the AI quota resets.';
};

const normalizeGeminiError = (error) => {
  const raw = String(error?.message || '').trim();
  const lower = raw.toLowerCase();

  if (!raw) {
    return 'I could not contact the AI service right now.';
  }

  if (lower.includes('aborted') || lower.includes('timeout')) {
    return 'The AI request timed out. Please try again in a moment.';
  }

  if (lower.includes('quota') || lower.includes('rate_limit') || lower.includes('429')) {
    return 'AI request limit reached for now. I will use built-in answers until your Gemini quota resets.';
  }

  if (lower.includes('api key') || lower.includes('permission') || lower.includes('unauthenticated') || lower.includes('403')) {
    return 'AI access is not authorized. Please verify your Gemini API key and project permissions.';
  }

  return 'I could not reach Gemini right now. Using built-in answer instead.';
};

const extractGeminiText = (payload) => {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  if (!candidates.length) {
    return '';
  }

  const parts = Array.isArray(candidates[0]?.content?.parts) ? candidates[0].content.parts : [];
  const text = parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('\n')
    .trim();

  return text;
};

const askGemini = async (question, recentMessages = [], liveStatsContext = '') => {
  const apiKey = String(process.env.EXPO_PUBLIC_GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('Gemini API key is missing. Add EXPO_PUBLIC_GEMINI_API_KEY in .env and restart Expo.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  const historyParts = recentMessages
    .slice(-6)
    .map((msg) => `${msg.role === 'assistant' ? 'Assistant' : 'User'}: ${String(msg.text || '').trim()}`)
    .filter(Boolean)
    .join('\n');

  const promptText = historyParts
    ? `${historyParts}\nUser: ${question}`
    : question;

  const appKnowledgeContext = buildAppKnowledgeContext();

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: `${APP_ASSISTANT_RULES}\n\nApp knowledge base:\n${appKnowledgeContext}${liveStatsContext ? `\n\nLive app stats:\n${liveStatsContext}` : ''}`,
          }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: promptText }],
          },
        ],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 320,
        },
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const apiError = payload?.error?.message || `Gemini request failed (${response.status}).`;
      const taggedError = new Error(apiError);
      taggedError.statusCode = response.status;
      throw taggedError;
    }

    const answer = extractGeminiText(payload);
    if (!answer) {
      throw new Error('Gemini returned an empty response.');
    }

    return answer;
  } finally {
    clearTimeout(timeoutId);
  }
};

const JemoyScreen = ({ onBack }) => {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hi, I am Jemoy. Ask me anything about pet care, adoption, rescue, and training.',
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const scrollRef = useRef(null);

  const canSend = useMemo(() => String(input || '').trim().length > 0 && !sending, [input, sending]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const saved = await AsyncStorage.getItem('pawmilya_jemoy_chat_history');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.length > 0) {
            setMessages(parsed);
          }
        }
      } catch (e) {
        console.error('Failed to load chat history', e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadHistory();
  }, []);

  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem('pawmilya_jemoy_chat_history', JSON.stringify(messages))
        .catch(e => console.error('Failed to save chat history', e));
    }
  }, [messages, isLoaded]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollToEnd({ animated: true });
      }
    });
  }, []);

  const pushMessage = useCallback((message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const sendMessage = useCallback(async (forcedText) => {
    const text = String(forcedText ?? input).trim();
    if (!text || sending) return;

    setInput('');
    setSending(true);

    const userMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      text,
    };
    pushMessage(userMessage);
    scrollToBottom();

    const faqAnswer = getAppFaqAnswer(text);
    const appKnowledgeAnswer = getAppKnowledgeAnswer(text);
    const shouldLoadLiveStats = isCountQuestion(text);
    let liveStatsAnswer = '';
    let liveStatsContext = '';

    if (shouldLoadLiveStats) {
      try {
        const liveStats = await fetchLiveAppStats();
        liveStatsAnswer = getLiveStatsAnswer(text, liveStats);
        liveStatsContext = buildLiveStatsContext(liveStats);
      } catch (statsError) {
        liveStatsAnswer = '';
        liveStatsContext = '';
      }
    }

    try {
      const replyText = await askGemini(text, messages, liveStatsContext);

      pushMessage({
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        text: replyText,
      });
      scrollToBottom();
    } catch (error) {
      const fallbackText = faqAnswer || liveStatsAnswer || appKnowledgeAnswer || buildLocalFallback(text);
      const normalizedError = normalizeGeminiError(error);
      pushMessage({
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        text: `${normalizedError}\n\n${fallbackText}`,
      });
      scrollToBottom();
    } finally {
      setSending(false);
    }
  }, [input, messages, pushMessage, scrollToBottom, sending]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.backgroundWhite} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textDark} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Ask Jemoy</Text>
          <Text style={styles.headerSubtitle}>Your AI Pet Assistant</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messagesWrap}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={scrollToBottom}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message) => {
          const isUser = message.role === 'user';
          return (
            <View
              key={message.id}
              style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAssistant]}
            >
              {!isUser && (
                <Image 
                  source={require('../../assets/images/jemoy.png')}
                  style={styles.messageAvatar}
                  resizeMode="cover"
                />
              )}
              <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
                <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>{message.text}</Text>
              </View>
            </View>
          );
        })}

        {sending ? (
          <View style={styles.typingWrap}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.typingText}>Jemoy is thinking...</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.promptRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promptContent}>
          {[...APP_QUICK_PROMPTS, ...QUICK_PROMPTS].map((prompt) => (
            <TouchableOpacity
              key={prompt}
              style={styles.promptChip}
              onPress={() => sendMessage(prompt)}
              disabled={sending}
            >
              <Text style={styles.promptChipText}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask Jemoy about your pet..."
          placeholderTextColor={COLORS.textMedium}
          multiline
          maxLength={600}
        />
        <TouchableOpacity
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={() => sendMessage()}
          disabled={!canSend}
        >
          <Ionicons name="send" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 8 : 56,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.backgroundWhite,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
  },
  messagesWrap: {
    flex: 1,
  },
  messagesContent: {
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  messageRow: {
    width: '100%',
    flexDirection: 'row',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: SPACING.sm,
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 8,
  },
  assistantBubble: {
    backgroundColor: COLORS.backgroundWhite,
    borderBottomLeftRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  messageText: {
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
  },
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {
    color: COLORS.textDark,
  },
  typingWrap: {
    marginTop: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  typingText: {
    color: COLORS.textMedium,
    fontSize: FONTS.sizes.xs,
  },
  promptRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    backgroundColor: COLORS.backgroundWhite,
    paddingVertical: SPACING.xs,
  },
  promptContent: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.xs,
  },
  promptChip: {
    borderWidth: 1,
    borderColor: `${COLORS.primary}66`,
    backgroundColor: `${COLORS.primary}14`,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    marginRight: SPACING.xs,
  },
  promptChipText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.backgroundWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    gap: SPACING.xs,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 42,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    color: COLORS.textDark,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.55,
  },
});

export default JemoyScreen;
