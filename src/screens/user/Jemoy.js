import React, { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Animated,
  Keyboard,
  Alert,
  Share,
  Modal,
  Dimensions,
  Linking,
  AppState,
  ToastAndroid,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';
import { COLORS } from '../../constants/theme';
import CONFIG from '../../config/config';
import { useAuth } from '../../context/AuthContext';
import JemoyIcon from '../../components/JemoyIcon';
import { Image } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Constants ──────────────────────────────────────────────
const GEMINI_MODELS = CONFIG.GEMINI_MODELS;
const AI_CHAT_URL = `${CONFIG.API_URL}${CONFIG.ENDPOINTS.AI_CHAT}`;
const AI_CONTEXT_URL = `${CONFIG.API_URL}${CONFIG.ENDPOINTS.AI_CONTEXT}`;
const STORAGE_KEY_BASE = '@jemoy_chat_history';
const SESSIONS_KEY_BASE = '@jemoy_sessions';
const ACTIVE_SESSION_KEY_BASE = '@jemoy_active_session';
const MAX_HISTORY_PAIRS = 20;
const TYPEWRITER_INTERVAL = 18;
const SCROLL_DELAY = 120;
const PERSIST_DEBOUNCE = 600;
const API_TIMEOUT = 20000;

// ─── Theme Tokens (Pawmilya warm orange/brown) ─────────────
const UI = {
  headerFrom: '#FF9554',
  headerTo: '#E67D3C',
  chatBg: '#FFF8F3',
  userBubbleBg: '#FF9554',
  userBubbleText: '#FFFFFF',
  botBubbleBg: '#FFFFFF',
  botBubbleText: '#8B5E34',
  botBubbleBorder: 'rgba(139, 94, 52, 0.10)',
  subtle: 'rgba(139, 94, 52, 0.06)',
  subtleBorder: 'rgba(139, 94, 52, 0.10)',
  avatarBg: '#FFE4C9',
  avatarRing: '#FFB584',
  timeUser: 'rgba(255,255,255,0.75)',
  timeBot: '#A67C52',
  inputBorder: 'rgba(255, 149, 84, 0.20)',
  inputFocusBorder: '#FF9554',
  pillBg: 'rgba(255,149,84,0.10)',
  pillBorder: 'rgba(255,149,84,0.22)',
  pillText: '#E67D3C',
};

// ─── System Prompt (core identity — live data is injected at runtime) ────
const SYSTEM_PROMPT_CORE = `You are Jemoy 🐾, the friendly, warm, and knowledgeable AI customer support assistant for **Pawmilya** — a Philippine-based pet adoption and animal rescue mobile app. The tagline is "Every Paw Deserves a Family." You are a Siberian Husky mascot — energetic, loyal, and always ready to help!

IDENTITY & PERSONALITY
- You are "Jemoy," Pawmilya's Siberian Husky support buddy. NEVER reveal you are an AI model, Gemini, Google AI, or any LLM. If asked, say: "I'm Jemoy, Pawmilya's very own Siberian Husky support assistant! 🐾🐺"
- Be warm, empathetic, patient, and concise. Use emojis sparingly (🐾🐺🐶🐱❤️✅) to keep a friendly but professional tone.
- Always guide users step by step. If a feature is "coming soon," say so politely and suggest alternatives.
- If a question is outside the scope of Pawmilya, politely redirect: "That's a bit outside my expertise, but I'm here for anything Pawmilya-related!"
- Answer in the same language the user writes in (English or Filipino/Tagalog).
- Keep responses concise (under 200 words when possible) unless the user asks for detail.

APP OVERVIEW
Pawmilya ("Paw + Pamilya/Family") connects adopters with rescued pets, enables citizens to report animals in distress, supports verified rescuers on missions, and provides a shelter directory — all within one app.
Mission: Creating a world where every stray animal finds a loving home.
Vision: A Philippines where no animal is left behind.
Core values: Compassion, Protection, Community, Sustainability.

USER ROLES
• Guest — Can browse featured pets and the mission page. Must register to adopt, report rescues, or save favorites.
• User (default after registration) — Full access: adopt pets, report rescues, browse shelters, manage profile, receive notifications.
• Rescuer — A User whose rescuer application was approved. Gets the Rescuer Dashboard, can accept rescue missions.
• Admin — Separate system. Manages pets, users, adoptions, rescues, shelters, and rescuer applications.

KEY FEATURES & FLOWS
- Registration: Sign Up with full name, phone, email, password → auto logged in
- Login: Email + password. If 2FA enabled, OTP is sent to email for verification.
- Pet browsing: Pets tab → filter by category (Dogs, Cats, etc.) → search by name/breed/location → tap for full details
- Favorites: Tap heart icon to save pets, view in favorites
- Adoption flow: Browse → Tap Adopt → 4-step form (Living Situation, Household, Experience, Final Details) → Submit → Wait for admin review → Statuses: Pending → Reviewing → Approved/Rejected/Cancelled → If approved: Complete Adoption with delivery details → COD payment → Delivery tracking (Processing → Preparing → Out for Delivery → Delivered)
- Rescue reporting: 4-step form (Basic Info + urgency, Location/map, Details, Photos up to 5) → Submitted → Rescuer assigned
- Urgency levels: Low (🟢), Normal (🟡), High (🟠), Critical (🔴)
- Become a rescuer: Settings → Apply → Admin reviews → Approved = Rescuer Dashboard access
- Rescuer missions: Accept → On the Way → Arrived → Submit verification photo → Admin verifies → Complete. Locked to mission screen during active rescue.
- Shelter transfers: After rescue completion, transfer animal to a shelter with available capacity
- Shelters: Browse directory, see details (capacity, services, contact), call/email/get directions
- Notifications: Bell icon shows unread count, types include adoption/rescue/rescuer/shelter/system updates
- Profile: Edit name, phone, bio, address, city, avatar (under 1.5 MB)
- Settings: Change password, toggle 2FA, download data, delete account, logout
- Payment: Cash on Delivery (COD) only. Fee covers food, medical, vaccinations, shelter expenses.
- Contact: support@pawmilya.com, +639123456789, Emergency Hotline: 0917-123-4567

RESPONSE GUIDELINES
- For "how to" questions, give numbered step-by-step instructions.
- For status questions, list possible statuses with brief explanations.
- For errors, diagnose the likely cause and provide a solution.
- If the user seems frustrated, be extra empathetic.
- If you don't know the exact answer, suggest contacting support@pawmilya.com.
- End warmly: "Is there anything else I can help you with? 🐶"
- NEVER make up features that don't exist.

IMAGE ANALYSIS
- You can analyze images. Pet photos → identify breed, age, health, give tips. Distress → guide rescue reporting. Screenshots → troubleshoot. Other → describe and relate to Pawmilya.
`;

// Build the dynamic context block from live API data
const buildDynamicContext = (ctx) => {
  if (!ctx) return '';
  const lines = ['\n═══ LIVE APP DATA (real-time from database) ═══'];

  // Pet stats
  if (ctx.petStats) {
    const p = ctx.petStats;
    lines.push(`\nPET STATISTICS: ${p.available} available, ${p.pending} pending adoption, ${p.adopted} adopted (${p.total} total). Adoption fees range ₱${p.feeRange.min}–₱${p.feeRange.max} (avg ₱${p.feeRange.avg}).`);
  }

  // Categories
  if (ctx.categories?.length) {
    lines.push(`CATEGORIES: ${ctx.categories.map(c => `${c.name} (${c.pet_count} available)`).join(', ')}`);
  }

  // Recent available pets
  if (ctx.recentPets?.length) {
    lines.push('\nRECENTLY ADDED AVAILABLE PETS:');
    ctx.recentPets.forEach(p => {
      const age = p.age_years ? `${p.age_years}y` : `${p.age_months}mo`;
      lines.push(`- ${p.name} — ${p.category || 'Pet'}, ${p.breed_name || 'Mixed'}, ${p.gender}, ${age}, ₱${p.adoption_fee}${p.shelter_name ? ` @ ${p.shelter_name} (${p.shelter_city})` : ''}`);
    });
  }

  // Shelters
  if (ctx.shelterStats) {
    const s = ctx.shelterStats;
    lines.push(`\nSHELTER STATISTICS: ${s.active} active shelters (${s.verified} verified), housing ${s.totalAnimals} animals (capacity ${s.totalCapacity}).`);
  }
  if (ctx.shelters?.length) {
    lines.push('ACTIVE SHELTERS:');
    ctx.shelters.forEach(s => {
      const slots = (s.max_capacity || 0) - (s.current_count || 0);
      lines.push(`- ${s.name} (${s.city || 'N/A'}) — ${s.type || 'Shelter'}${s.is_verified ? ' ✅ Verified' : ''}, ${s.current_count}/${s.max_capacity} animals, ${slots} slots open`);
    });
  }

  // Current user activity
  if (ctx.userActivity) {
    if (ctx.userActivity.adoptions?.length) {
      lines.push("\nTHIS USER'S ADOPTIONS:");
      ctx.userActivity.adoptions.forEach(a => {
        lines.push(`- ${a.pet_name || 'Pet'}: ${a.status}`);
      });
    }
    if (ctx.userActivity.rescues?.length) {
      lines.push("THIS USER'S RESCUE REPORTS:");
      ctx.userActivity.rescues.forEach(r => {
        lines.push(`- "${r.title}": ${r.status} (${r.urgency} urgency)`);
      });
    }
  }

  lines.push('\nUse this real data to give accurate, personalized answers. When users ask about available pets, shelters, fees, or their own applications — reference the actual data above rather than giving generic answers.');
  return lines.join('\n');
};

// ─── Quick suggestions ──────────────────────────────────────
const QUICK_SUGGESTIONS = [
  { id: 1, icon: 'paw', text: 'How to adopt', query: 'How do I adopt a pet on Pawmilya? Give me the full step-by-step process.' },
  { id: 2, icon: 'alert-circle', text: 'Report rescue', query: 'How can I report an animal that needs rescue? What info do I need?' },
  { id: 3, icon: 'shield-checkmark', text: 'Become rescuer', query: 'How do I become a verified rescuer? What are the requirements?' },
  { id: 4, icon: 'cube', text: 'Track delivery', query: 'How do I track my adopted pet delivery? What are the delivery stages?' },
  { id: 5, icon: 'business', text: 'Find shelters', query: 'How do I find nearby animal shelters and what info can I see about them?' },
  { id: 6, icon: 'person-circle', text: 'Edit profile', query: 'How do I edit my profile, change my password, or update my avatar?' },
  { id: 7, icon: 'card', text: 'Fees & payment', query: 'How much does adoption cost and what payment methods are accepted?' },
  { id: 8, icon: 'help-buoy', text: 'App issues', query: 'The app is giving me errors or not loading properly. What should I do?' },
];

// ─── Follow-up Suggestions (contextual, shown after bot replies) ────
const FOLLOW_UP_MAP = [
  { keywords: ['adopt', 'adoption', 'apply'], suggestions: [
    { text: '📋 What are the requirements?', query: 'What are the requirements to adopt a pet on Pawmilya?' },
    { text: '💰 How much does it cost?', query: 'How much does pet adoption cost on Pawmilya?' },
    { text: '🚚 How is delivery done?', query: 'How does pet delivery work after adoption approval?' },
  ]},
  { keywords: ['rescue', 'report', 'emergency'], suggestions: [
    { text: '📞 Emergency hotline', query: 'What is the emergency rescue hotline number?' },
    { text: '🦸 Become a rescuer', query: 'How do I become a verified rescuer on Pawmilya?' },
    { text: '📍 Track my report', query: 'How can I track my rescue report status?' },
  ]},
  { keywords: ['shelter', 'shelters'], suggestions: [
    { text: '📞 Contact a shelter', query: 'How do I contact a shelter on Pawmilya?' },
    { text: '🐕 View shelter pets', query: 'How do I see available pets at a specific shelter?' },
    { text: '📍 Find nearby', query: 'How do I find shelters near my location?' },
  ]},
  { keywords: ['account', 'profile', 'settings', 'password'], suggestions: [
    { text: '🔒 Change password', query: 'How do I change my password on Pawmilya?' },
    { text: '📸 Update photo', query: 'How do I change my profile picture?' },
    { text: '🗑️ Delete account', query: 'How do I delete my Pawmilya account?' },
  ]},
  { keywords: ['rescuer', 'verified', 'dashboard', 'mission'], suggestions: [
    { text: '📊 Rescuer dashboard', query: 'What features does the rescuer dashboard have?' },
    { text: '🚗 Mission steps', query: 'What are the steps in a rescue mission?' },
    { text: '🏠 Shelter transfer', query: 'How do shelter transfers work after a rescue?' },
  ]},
];

const getFollowUpSuggestions = (botText) => {
  const lower = botText.toLowerCase();
  for (const mapping of FOLLOW_UP_MAP) {
    if (mapping.keywords.some((kw) => lower.includes(kw))) {
      return mapping.suggestions;
    }
  }
  return null;
};

// ─── Time-of-day greeting helper ────────────────────────
const getTimeGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

// Deep-link action keyword mappings
const ACTION_KEYWORDS = [
  { keywords: ['pets tab', 'browse pets', 'view pets', 'find pets', 'pets screen'], action: 'pets', label: 'Browse Pets', icon: 'paw' },
  { keywords: ['adoptions tab', 'adoption screen', 'my adoptions', 'track adoption', 'adoption status'], action: 'adoptions', label: 'My Adoptions', icon: 'heart' },
  { keywords: ['rescue tab', 'report rescue', 'report a rescue', 'rescue screen'], action: 'rescue', label: 'Go to Rescue', icon: 'medkit' },
  { keywords: ['shelter tab', 'shelters', 'find shelter', 'browse shelter', 'shelter screen'], action: 'shelter', label: 'View Shelters', icon: 'home' },
  { keywords: ['settings', 'edit profile', 'change password', 'account settings'], action: 'settings', label: 'Open Settings', icon: 'settings' },
  { keywords: ['notification', 'notifications', 'notification bell'], action: 'notifications', label: 'Notifications', icon: 'notifications' },
];

// ─── Pure helpers (no dependencies, no hooks) ───────────────
const generateId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

const formatTime = (date) =>
  new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatDateLabel = (date) => {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
};

const detectActions = (responseText) => {
  const lower = responseText.toLowerCase();
  return ACTION_KEYWORDS.filter((ak) => ak.keywords.some((kw) => lower.includes(kw))).slice(0, 3);
};

const createTimestamp = () => new Date().toISOString();

// ─── Session helpers ────────────────────────────────────────
const createSession = (id, title = 'New Chat') => ({
  id,
  title,
  createdAt: createTimestamp(),
  updatedAt: createTimestamp(),
});

const generateSessionTitle = (firstMessage) => {
  if (!firstMessage) return 'New Chat';
  const text = firstMessage.trim();
  if (text.length <= 30) return text;
  return text.substring(0, 27) + '…';
};

// ─── Image to Base64 helper ─────────────────────────────────
const imageToBase64 = async (uri) => {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch (error) {
    console.error('Failed to convert image to base64 via FileSystem:', error);
    return null;
  }
};

// ─── Markdown Parser ────────────────────────────────────────
const parseBoldInline = (text, baseStyle) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={i} style={[baseStyle, { fontWeight: '700' }]}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return (
      <Text key={i} style={baseStyle}>
        {part}
      </Text>
    );
  });
};

const MarkdownText = memo(({ text, style, isUser }) => {
  const baseStyle = isUser ? styles.userText : styles.botText;
  const lines = text.split('\n');

  return (
    <Text style={[styles.messageText, style]}>
      {lines.map((line, i) => {
        const trimmed = line.trimStart();
        const indent = line.length - trimmed.length;
        const prefix = ' '.repeat(Math.min(indent, 4));

        if (/^[•\-–]\s/.test(trimmed)) {
          return (
            <Text key={i}>
              {i > 0 ? '\n' : ''}
              {prefix}  •  {parseBoldInline(trimmed.replace(/^[•\-–]\s/, ''), baseStyle)}
            </Text>
          );
        }

        const numMatch = trimmed.match(/^(\d+)[.)]\s/);
        if (numMatch) {
          return (
            <Text key={i}>
              {i > 0 ? '\n' : ''}
              {prefix}  {numMatch[1]}.  {parseBoldInline(trimmed.slice(numMatch[0].length), baseStyle)}
            </Text>
          );
        }

        return (
          <Text key={i}>
            {i > 0 ? '\n' : ''}
            {parseBoldInline(line, baseStyle)}
          </Text>
        );
      })}
    </Text>
  );
});

// ─── Typewriter ─────────────────────────────────────────────
const TypewriterMarkdown = memo(({ text, style, isUser, onComplete }) => {
  const [displayedWordCount, setDisplayedWordCount] = useState(0);
  const words = useMemo(() => text.split(/(\s+)/), [text]);
  const totalWords = words.length;

  // FIX: stabilise onComplete in a ref so it doesn't retrigger the effect
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (displayedWordCount >= totalWords) {
      onCompleteRef.current?.();
      return;
    }
    const timer = setTimeout(() => {
      setDisplayedWordCount((prev) => Math.min(prev + 3, totalWords));
    }, TYPEWRITER_INTERVAL);
    return () => clearTimeout(timer);
  }, [displayedWordCount, totalWords]);

  const displayedText = useMemo(
    () => words.slice(0, displayedWordCount).join(''),
    [words, displayedWordCount],
  );

  return <MarkdownText text={displayedText} style={style} isUser={isUser} />;
});

// ─── Date Separator ─────────────────────────────────────────
const DateSeparator = memo(({ date }) => (
  <View style={styles.dateSeparator}>
    <View style={styles.dateLine} />
    <View style={styles.datePill}>
      <Text style={styles.dateText}>{formatDateLabel(date)}</Text>
    </View>
    <View style={styles.dateLine} />
  </View>
));

// ─── Offline Banner ─────────────────────────────────────────
const OfflineBanner = memo(() => (
  <View style={styles.offlineBanner}>
    <View style={styles.offlineInner}>
      <Ionicons name="cloud-offline-outline" size={14} color="#FFFFFF" />
      <Text style={styles.offlineText}>No internet connection</Text>
    </View>
  </View>
));

// ─── Action Buttons (Deep-link) ─────────────────────────────
const ActionButtons = memo(({ actions, onAction }) => {
  if (!actions || actions.length === 0) return null;
  return (
    <View style={styles.actionRow}>
      {actions.map((action, i) => (
        <TouchableOpacity
          key={`${action.action}-${i}`}
          style={styles.actionChip}
          onPress={() => onAction(action.action)}
          activeOpacity={0.7}
        >
          <Ionicons name={action.icon} size={13} color={UI.pillText} />
          <Text style={styles.actionChipText}>{action.label}</Text>
          <Ionicons name="chevron-forward" size={11} color={UI.timeBot} />
        </TouchableOpacity>
      ))}
    </View>
  );
});

// ─── Feedback Thumbs ────────────────────────────────────────
const FeedbackThumbs = memo(({ messageId, feedback, onFeedback }) => (
  <View style={styles.feedbackRow}>
    <TouchableOpacity
      onPress={() => onFeedback(messageId, 'up')}
      style={[styles.thumbBtn, feedback === 'up' && styles.thumbActive]}
      activeOpacity={0.6}
    >
      <Ionicons
        name={feedback === 'up' ? 'thumbs-up' : 'thumbs-up-outline'}
        size={13}
        color={feedback === 'up' ? COLORS.success : UI.timeBot}
      />
    </TouchableOpacity>
    <TouchableOpacity
      onPress={() => onFeedback(messageId, 'down')}
      style={[styles.thumbBtn, feedback === 'down' && styles.thumbActive]}
      activeOpacity={0.6}
    >
      <Ionicons
        name={feedback === 'down' ? 'thumbs-down' : 'thumbs-down-outline'}
        size={13}
        color={feedback === 'down' ? COLORS.error : UI.timeBot}
      />
    </TouchableOpacity>
  </View>
));

// ─── Jemoy Avatar ───────────────────────────────────────────
const JemoyAvatar = memo(({ size = 34 }) => (
  <View
    style={[
      styles.avatarWrap,
      {
        width: size + 4,
        height: size + 4,
        borderRadius: (size + 4) / 2,
      },
    ]}
  >
    <JemoyIcon size={size * 0.7} />
  </View>
));

// ─── Message Bubble ─────────────────────────────────────────
const MessageBubble = memo(({
  item,
  isAnimating,
  onAnimationComplete,
  onCopy,
  onFeedback,
  feedback,
  actions,
  onAction,
  onRetry,
  onSpeak,
  isSpeaking,
}) => {
  const isUser = item.role === 'user';
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const translateY = fadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY }] }}>
      {/* Bubble row */}
      <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
        {!isUser && <JemoyAvatar size={30} />}
        <TouchableOpacity
          activeOpacity={0.85}
          onLongPress={() => onCopy(item.text)}
          style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}
        >
          {/* Image preview in user bubble */}
          {isUser && item.imageUri && (
            <Image
              source={{ uri: item.imageUri }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          )}
          {isAnimating && !isUser ? (
            <TypewriterMarkdown
              text={item.text}
              isUser={false}
              onComplete={onAnimationComplete}
            />
          ) : (
            <MarkdownText text={item.text} isUser={isUser} />
          )}
          <Text style={[styles.msgTime, { color: isUser ? UI.timeUser : UI.timeBot }]}>
            {item.time}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Footer (copy / TTS / feedback / actions) */}
      {!isUser && !isAnimating && (
        <View style={styles.botFooter}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <TouchableOpacity
              onPress={() => onCopy(item.text)}
              style={styles.copyBtn}
              activeOpacity={0.6}
            >
              <Ionicons name="copy-outline" size={12} color={UI.timeBot} />
              <Text style={styles.copyLabel}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onSpeak(item.id, item.text)}
              style={[styles.copyBtn, isSpeaking && styles.ttsActive]}
              activeOpacity={0.6}
            >
              <Ionicons
                name={isSpeaking ? 'stop-circle' : 'volume-medium-outline'}
                size={13}
                color={isSpeaking ? COLORS.primary : UI.timeBot}
              />
              <Text style={[styles.copyLabel, isSpeaking && { color: COLORS.primary }]}>
                {isSpeaking ? 'Stop' : 'Listen'}
              </Text>
            </TouchableOpacity>
          </View>
          <FeedbackThumbs
            messageId={item.id}
            feedback={feedback}
            onFeedback={onFeedback}
          />
        </View>
      )}
      {!isUser && !isAnimating && <ActionButtons actions={actions} onAction={onAction} />}

      {/* Retry */}
      {item.failed && onRetry != null && (
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.7}>
          <Ionicons name="refresh" size={13} color={COLORS.error} />
          <Text style={styles.retryLabel}>Tap to retry</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
});

// ─── Typing Indicator ───────────────────────────────────────
const TypingIndicator = memo(() => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createAnim = (dot, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]),
      );
    const a1 = createAnim(dot1, 0);
    const a2 = createAnim(dot2, 150);
    const a3 = createAnim(dot3, 300);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  const dotStyle = (dot) => ({
    opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
    transform: [{ scale: dot.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) }],
  });

  return (
    <View style={[styles.bubbleRow, { marginTop: 2 }]}>
      <JemoyAvatar size={30} />
      <View style={[styles.bubble, styles.botBubble, styles.typingBubble]}>
        <View style={styles.typingDots}>
          {[dot1, dot2, dot3].map((d, i) => (
            <Animated.View key={i} style={[styles.dot, dotStyle(d)]} />
          ))}
        </View>
      </View>
    </View>
  );
});

// ─── Search Modal ───────────────────────────────────────────
const SearchModal = memo(({ visible, onClose, messages, onScrollToMessage }) => {
  const [query, setQuery] = useState('');

  // Reset query when modal opens
  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return messages.filter((m) => m.text.toLowerCase().includes(q));
  }, [query, messages]);

  const handleResultPress = useCallback(
    (id) => {
      onScrollToMessage(id);
      onClose();
    },
    [onScrollToMessage, onClose],
  );

  const renderSearchItem = useCallback(
    ({ item }) => (
      <TouchableOpacity
        style={styles.searchItem}
        onPress={() => handleResultPress(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.searchItemHeader}>
          <View style={[styles.searchRoleBadge, item.role === 'user' && styles.searchRoleBadgeUser]}>
            <Text style={[styles.searchRoleText, item.role === 'user' && styles.searchRoleTextUser]}>
              {item.role === 'user' ? 'You' : 'Jemoy'}
            </Text>
          </View>
          <Text style={styles.searchItemTime}>{item.time}</Text>
        </View>
        <Text style={styles.searchItemBody} numberOfLines={2}>
          {item.text}
        </Text>
      </TouchableOpacity>
    ),
    [handleResultPress],
  );

  const searchKeyExtractor = useCallback((item) => item.id, []);

  const emptyIcon = query.trim() ? 'search' : 'chatbubbles-outline';
  const emptyText = query.trim() ? 'No messages found' : 'Search your conversation';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.searchOverlay}>
        <View style={styles.searchSheet}>
          <View style={styles.searchHandle} />
          <View style={styles.searchBar}>
            <View style={styles.searchInputWrap}>
              <Ionicons name="search" size={18} color={UI.timeBot} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search messages…"
                placeholderTextColor={UI.timeBot}
                autoFocus
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={18} color={UI.timeBot} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.searchCancel}>
              <Text style={styles.searchCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={results}
            keyExtractor={searchKeyExtractor}
            renderItem={renderSearchItem}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.searchEmptyWrap}>
                <Ionicons name={emptyIcon} size={40} color={UI.subtleBorder} />
                <Text style={styles.searchEmptyText}>{emptyText}</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
});

// ═════════════════════════════════════════════════════════════
// ─── MAIN JEMOY SCREEN ──────────────────────────────────────
// ═════════════════════════════════════════════════════════════
const JemoyScreen = ({ onGoBack, onNavigateTo }) => {
  const { user } = useAuth();

  // ─── User-specific storage keys ─────────────────────────
  const userId = user?.id || user?.email || 'guest';
  const STORAGE_KEY = useMemo(() => `${STORAGE_KEY_BASE}_${userId}`, [userId]);
  const SESSIONS_KEY = useMemo(() => `${SESSIONS_KEY_BASE}_${userId}`, [userId]);
  const ACTIVE_SESSION_KEY = useMemo(() => `${ACTIVE_SESSION_KEY_BASE}_${userId}`, [userId]);

  // ─── State ──────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [animatingMessageId, setAnimatingMessageId] = useState(null);
  const [feedbackState, setFeedbackState] = useState({});
  const [searchVisible, setSearchVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const [followUpSuggestions, setFollowUpSuggestions] = useState(null);
  const [lastFailedMessage, setLastFailedMessage] = useState(null);

  // ─── Session State ────────────────────────────────────
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [sessionsModalVisible, setSessionsModalVisible] = useState(false);

  // ─── Image Attachment State ───────────────────────────
  const [attachedImage, setAttachedImage] = useState(null); // { uri, base64, mimeType }

  // ─── TTS State ────────────────────────────────────────
  const [speakingMessageId, setSpeakingMessageId] = useState(null);

  // ─── Refs ───────────────────────────────────────────────
  const flatListRef = useRef(null);
  const conversationHistory = useRef([]);
  const persistTimer = useRef(null);
  const isSendingRef = useRef(false);   // FIX: prevents concurrent sends
  const mountedRef = useRef(true);      // FIX: prevents state updates after unmount
  const messagesRef = useRef([]);       // for renderMessage date-separator peek
  const appStateRef = useRef(AppState.currentState);
  const wasOfflineRef = useRef(false);

  // Keep messagesRef in sync
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ─── Network reconnect auto-retry ───────────────────────
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground — check if we were offline and have a failed message
        if (wasOfflineRef.current && lastFailedMessage && mountedRef.current) {
          setIsOnline(true);
          wasOfflineRef.current = false;
        }
      }
      appStateRef.current = nextAppState;
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub?.remove();
  }, [lastFailedMessage]);

  // Track offline state
  useEffect(() => {
    if (!isOnline) wasOfflineRef.current = true;
  }, [isOnline]);

  // ─── Unmount guard & cleanup ────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (persistTimer.current) {
        clearTimeout(persistTimer.current);
        persistTimer.current = null;
      }
      // Stop TTS on unmount
      Speech.stop();
    };
  }, []);

  // ─── Personalised system prompt ─────────────────────────
  const [liveContext, setLiveContext] = useState(null);

  // Fetch live app context from the backend on mount
  useEffect(() => {
    let cancelled = false;
    const fetchContext = async () => {
      if (!user?.token) return;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(AI_CONTEXT_URL, {
          headers: { Authorization: `Bearer ${user.token}` },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setLiveContext(data);
        }
      } catch { /* context fetch is best-effort */ }
    };
    fetchContext();
    return () => { cancelled = true; };
  }, [user?.token]);

  const systemPrompt = useMemo(() => {
    let prompt = SYSTEM_PROMPT_CORE;
    if (user) {
      prompt += `\n\nCURRENT USER CONTEXT:\n- Name: ${user.full_name || user.name || 'User'}\n- Email: ${user.email || 'N/A'}\n- Role: ${user.role || 'user'}\n- Address them by their first name when appropriate.\n`;
    }
    prompt += buildDynamicContext(liveContext);
    return prompt;
  }, [user, liveContext]);

  // ─── Welcome message factory ───────────────────────────
  const createWelcomeMessage = useCallback(() => {
    const name = user?.full_name?.split(' ')[0] || user?.name?.split(' ')[0] || '';
    const timeGreet = getTimeGreeting();
    const greeting = name
      ? `${timeGreet}, ${name}! 🐾`
      : `${timeGreet}! 🐾`;
    const ts = createTimestamp();
    return {
      id: generateId(),
      role: 'bot',
      text: `${greeting} I'm Jemoy, your Pawmilya husky buddy! 🐺\n\nHere's what I can help with:\n• 🐶 Pet adoption & tracking\n• 🚨 Rescue reporting\n• 🏠 Shelter information\n• � Pet photo analysis — send me a photo!\n• 👤 Account & settings\n• ❓ General questions\n\nTap a quick question below or type anything!`,
      time: formatTime(ts),
      timestamp: ts,
      failed: false,
    };
  }, [user]);

  // ─── Smart Contextual Greeting (uses liveContext from /ai/context) ─
  const [contextGreetingShown, setContextGreetingShown] = useState(false);

  // Inject a contextual greeting message when live context first arrives
  useEffect(() => {
    if (!liveContext || contextGreetingShown || !isLoaded) return;

    const contextParts = [];
    const adoptions = liveContext.userActivity?.adoptions || [];
    const active = adoptions.filter(a => a.status === 'pending' || a.status === 'approved');
    if (active.length > 0) {
      const petNames = active.slice(0, 2).map(a => a.pet_name || 'a pet').join(' & ');
      const statusLabel = active[0].status === 'approved' ? 'approved ✅' : 'under review 📋';
      contextParts.push(`Your adoption for **${petNames}** is ${statusLabel}!`);
    }
    const rescues = liveContext.userActivity?.rescues || [];
    const activeRescues = rescues.filter(r => r.status === 'pending' || r.status === 'in_progress');
    if (activeRescues.length > 0) {
      contextParts.push(`You have **${activeRescues.length}** active rescue report${activeRescues.length > 1 ? 's' : ''} 🚨`);
    }
    if (liveContext.petStats?.available) {
      contextParts.push(`There are **${liveContext.petStats.available}** pets available for adoption right now! 🐶`);
    }

    if (contextParts.length > 0) {
      const ts = createTimestamp();
      const contextMsg = {
        id: generateId(),
        role: 'bot',
        text: `📊 **Quick update for you:**\n${contextParts.join('\n')}\n\nFeel free to ask me about any of these!`,
        time: formatTime(ts),
        timestamp: ts,
        failed: false,
      };
      setMessages((prev) => [...prev, contextMsg]);
    }
    setContextGreetingShown(true);
  }, [liveContext, contextGreetingShown, isLoaded]);

  // ─── Load persisted chat ────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const loadChat = async () => {
      try {
        // Load sessions list
        const storedSessions = await AsyncStorage.getItem(SESSIONS_KEY);
        let sessionsList = [];
        if (storedSessions) {
          sessionsList = JSON.parse(storedSessions);
        }

        // Get active session ID
        let sessionId = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);

        // If no sessions exist, create a default one
        if (sessionsList.length === 0) {
          const newSession = createSession(generateId(), 'New Chat');
          sessionsList = [newSession];
          sessionId = newSession.id;
          await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessionsList));
          await AsyncStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
        } else if (!sessionId || !sessionsList.find(s => s.id === sessionId)) {
          sessionId = sessionsList[0].id;
          await AsyncStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
        }

        if (cancelled) return;
        setSessions(sessionsList);
        setActiveSessionId(sessionId);

        // Load messages for the active session
        const storageKey = `${STORAGE_KEY}_${sessionId}`;
        const stored = await AsyncStorage.getItem(storageKey);
        if (cancelled) return;
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
            setMessages(parsed.messages);
            conversationHistory.current = Array.isArray(parsed.history) ? parsed.history : [];
            setShowSuggestions(parsed.messages.length <= 1);
            setFeedbackState(parsed.feedback || {});
          } else {
            setMessages([createWelcomeMessage()]);
          }
        } else {
          setMessages([createWelcomeMessage()]);
        }
      } catch {
        if (!cancelled) setMessages([createWelcomeMessage()]);
      }
      if (!cancelled) setIsLoaded(true);
    };
    loadChat();
    return () => {
      cancelled = true;
    };
  }, [createWelcomeMessage, STORAGE_KEY, SESSIONS_KEY, ACTIVE_SESSION_KEY]);

  // ─── Persist chat (debounced) ───────────────────────────
  useEffect(() => {
    if (!isLoaded || messages.length === 0 || !activeSessionId) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      try {
        // Strip non-serialisable props
        const cleanMessages = messages.map(({ onRetry, ...rest }) => rest);
        const storageKey = `${STORAGE_KEY}_${activeSessionId}`;
        await AsyncStorage.setItem(
          storageKey,
          JSON.stringify({
            messages: cleanMessages,
            history: conversationHistory.current,
            feedback: feedbackState,
          }),
        );
      } catch {
        /* silent persist failure */
      }
    }, PERSIST_DEBOUNCE);
  }, [messages, feedbackState, isLoaded, activeSessionId, STORAGE_KEY]);

  // ─── Stable scroll helper ─────────────────────────────
  const scrollToBottom = useCallback((delay = SCROLL_DELAY) => {
    setTimeout(() => {
      if (mountedRef.current && flatListRef.current) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
    }, delay);
  }, []);

  // ─── Auto-scroll on new messages ──────────────────────
  const prevMessageCount = useRef(0);
  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      scrollToBottom();
    }
    prevMessageCount.current = messages.length;
  }, [messages.length, scrollToBottom]);

  // ─── Trim conversation history ────────────────────────
  const trimHistory = useCallback(() => {
    const maxParts = MAX_HISTORY_PAIRS * 2;
    if (conversationHistory.current.length > maxParts) {
      conversationHistory.current = conversationHistory.current.slice(-maxParts);
    }
  }, []);

  // ─── Gemini API call with model fallback ──────────────
  const sendMessageToGemini = useCallback(
    async (userMessage, imageData = null) => {
      // Build user parts — text + optional image
      const userParts = [{ text: userMessage || 'What do you see in this image?' }];
      if (imageData) {
        userParts.push({
          inline_data: {
            mime_type: imageData.mimeType || 'image/jpeg',
            data: imageData.base64,
          },
        });
      }

      const userPart = { role: 'user', parts: userParts };
      const contentsSnapshot = [...conversationHistory.current, userPart];

      const requestBody = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: contentsSnapshot,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      };

      for (let i = 0; i < GEMINI_MODELS.length; i++) {
        const model = GEMINI_MODELS[i];
        const isLastModel = i === GEMINI_MODELS.length - 1;

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), API_TIMEOUT);

          const response = await fetch(AI_CHAT_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
            },
            signal: controller.signal,
            body: JSON.stringify({
              model,
              requestBody,
            }),
          });
          clearTimeout(timeout);

          // Rate limited
          if (response.status === 429) {
            if (!isLastModel) continue;
            return {
              text: "I'm getting a lot of questions right now! Please wait about a minute and try again. ⏳",
              failed: true,
            };
          }

          // Auth issue
          if (response.status === 403 || response.status === 401) {
            if (!isLastModel) continue;
            return {
              text: "I'm experiencing an authentication issue. Please try again later or contact support. 🔑",
              failed: true,
            };
          }

          const responseText = await response.text();
          if (!response.ok) {
            if (!isLastModel) continue;
            return {
              text: "Something went wrong on my end. Please try again in a moment. 🐕",
              failed: true,
            };
          }

          let data;
          try {
            data = JSON.parse(responseText);
          } catch {
            if (!isLastModel) continue;
            return {
              text: "I received an unexpected response. Please try again. 🐾",
              failed: true,
            };
          }

          // Blocked by safety filter on prompt
          if (data?.promptFeedback?.blockReason) {
            return {
              text: "I couldn't process that message. Could you try rephrasing? 🐾",
              failed: false,
            };
          }

          const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            // SUCCESS — commit both user + model turns to history
            // Store only text in history (not image base64) to keep it lightweight
            const historyUserPart = { role: 'user', parts: [{ text: userMessage || '[Image sent]' }] };
            conversationHistory.current.push(historyUserPart);
            conversationHistory.current.push({ role: 'model', parts: [{ text: candidateText }] });
            trimHistory();
            if (mountedRef.current) setIsOnline(true);
            return { text: candidateText, failed: false };
          }

          // Safety-finished
          if (data?.candidates?.[0]?.finishReason === 'SAFETY') {
            return {
              text: "I can't respond to that, but I'm happy to help with anything else about Pawmilya! 🐾",
              failed: false,
            };
          }

          if (!isLastModel) continue;
          return {
            text: "Hmm, I couldn't process that right now. Could you try again? 🐾",
            failed: true,
          };
        } catch (error) {
          if (!isLastModel) continue;
          if (mountedRef.current) setIsOnline(false);
          if (error.name === 'AbortError') {
            return {
              text: "The request timed out. Please check your connection and try again. 📡",
              failed: true,
            };
          }
          return {
            text: "I'm having trouble connecting. Please check your internet and try again. 🐕",
            failed: true,
          };
        }
      }

      // Safety net (should never reach here)
      return { text: "Something unexpected happened. Please try again. 🐾", failed: true };
    },
    [systemPrompt, trimHistory, user?.token],
  );

  // ─── Send handler ─────────────────────────────────────
  const handleSend = useCallback(
    async (overrideText, retryMessageId) => {
      const text = (overrideText || inputText).trim();
      const hasImage = !!attachedImage;
      if (!text && !hasImage) return;
      if (isSendingRef.current) return;

      // FIX: gate concurrent sends with a ref (state updates are async and unreliable as a gate)
      isSendingRef.current = true;

      Keyboard.dismiss();
      if (mountedRef.current) setShowSuggestions(false);

      // Capture and clear image attachment before async work
      const imageToSend = hasImage ? { ...attachedImage } : null;
      if (hasImage) setAttachedImage(null);

      // Remove the failed message if retrying
      if (retryMessageId) {
        setMessages((prev) => prev.filter((m) => m.id !== retryMessageId));
      }

      // Add user message bubble (unless retrying — the original user msg is still there)
      if (!retryMessageId) {
        const ts = createTimestamp();
        const userMsg = {
          id: generateId(),
          role: 'user',
          text: text || (hasImage ? '📷 [Photo]' : ''),
          time: formatTime(ts),
          timestamp: ts,
          failed: false,
          imageUri: imageToSend?.uri || null,
        };
        setMessages((prev) => [...prev, userMsg]);

        // Auto-title session from first user message
        if (activeSessionId && text) {
          setSessions((prev) => {
            const updated = prev.map((s) => {
              if (s.id === activeSessionId && s.title === 'New Chat') {
                return { ...s, title: generateSessionTitle(text), updatedAt: createTimestamp() };
              }
              return s;
            });
            // Persist sessions
            AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updated)).catch(() => {});
            return updated;
          });
        }
      }

      if (!overrideText) setInputText('');
      setIsTyping(true);

      const result = await sendMessageToGemini(text, imageToSend);

      if (!mountedRef.current) {
        isSendingRef.current = false;
        return;
      }

      const botMsgId = generateId();
      const ts = createTimestamp();
      const botMsg = {
        id: botMsgId,
        role: 'bot',
        text: result.text,
        time: formatTime(ts),
        timestamp: ts,
        failed: result.failed,
        actions: result.failed ? [] : detectActions(result.text),
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
      if (!result.failed) {
        setAnimatingMessageId(botMsgId);
        // Generate follow-up suggestions based on bot response
        const followUps = getFollowUpSuggestions(result.text);
        setFollowUpSuggestions(followUps);
        setLastFailedMessage(null);
      } else {
        setFollowUpSuggestions(null);
        setLastFailedMessage(text);
      }
      isSendingRef.current = false;
    },
    [inputText, sendMessageToGemini, attachedImage, activeSessionId, SESSIONS_KEY],
  );

  // FIX: ref-based retry so closures always have the freshest handleSend
  const handleSendRef = useRef(handleSend);
  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  const handleRetry = useCallback((originalText, failedMsgId) => {
    handleSendRef.current(originalText, failedMsgId);
  }, []);

  // ─── Suggestion press (stable — doesn't depend on inputText) ──
  const handleSuggestionPress = useCallback((suggestion) => {
    handleSendRef.current(suggestion.query);
  }, []);

  // ─── Clear chat ───────────────────────────────────────
  const handleClearChat = useCallback(() => {
    Alert.alert('Clear Chat', 'Are you sure you want to clear the conversation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          conversationHistory.current = [];
          setFeedbackState({});
          setAnimatingMessageId(null);
          const ts = createTimestamp();
          setMessages([
            {
              id: generateId(),
              role: 'bot',
              text: "Chat cleared! 🧹 Jemoy's ready to help — ask me anything about Pawmilya! 🐺",
              time: formatTime(ts),
              timestamp: ts,
              failed: false,
            },
          ]);
          setShowSuggestions(true);
          try {
            if (activeSessionId) {
              await AsyncStorage.removeItem(`${STORAGE_KEY}_${activeSessionId}`);
            }
          } catch {
            /* silent */
          }
        },
      },
    ]);
  }, []);

  // ─── Copy text to clipboard ────────────────────────────
  const handleCopy = useCallback((text) => {
    Clipboard.setStringAsync(text);
    if (Platform.OS === 'android') {
      ToastAndroid.show('Copied to clipboard', ToastAndroid.SHORT);
    } else {
      Alert.alert('Copied', 'Message copied to clipboard.');
    }
  }, []);

  // ─── Share full conversation ──────────────────────────
  const handleShareConversation = useCallback(async () => {
    try {
      const transcript = messages
        .map((m) => `[${m.role === 'user' ? 'You' : 'Jemoy'}] ${m.time}\n${m.text}`)
        .join('\n\n---\n\n');
      await Share.share({
        message: `Pawmilya Chat with Jemoy 🐺\n\n${transcript}`,
        title: 'Pawmilya Chat Export',
      });
    } catch {
      /* user cancelled */
    }
  }, [messages]);

  // ─── Contact support escalation ───────────────────────
  const handleContactSupport = useCallback(() => {
    Alert.alert(
      'Contact Support 📧',
      'Need more help? Our support team is ready to assist you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '📧 Email Support',
          onPress: () => Linking.openURL('mailto:support@pawmilya.com?subject=Support%20Request%20from%20Pawmilya%20App'),
        },
        {
          text: '📞 Call Hotline',
          onPress: () => Linking.openURL('tel:+639171234567'),
        },
      ],
    );
  }, []);

  // ─── Feedback (with optional comment on thumbs down) ──
  const handleFeedback = useCallback((messageId, type) => {
    setFeedbackState((prev) => {
      const isTogglingOff = prev[messageId] === type;
      // Schedule side-effects outside the updater via setTimeout
      if (!isTogglingOff) {
        setTimeout(() => {
          if (type === 'down') {
            Alert.alert(
              'Feedback 🐾',
              'Sorry about that! What went wrong?',
              [
                { text: 'Not helpful', onPress: () => {} },
                { text: 'Incorrect info', onPress: () => {} },
                { text: 'Too long/short', onPress: () => {} },
                { text: 'Cancel', style: 'cancel' },
              ],
            );
          } else if (type === 'up' && Platform.OS === 'android') {
            ToastAndroid.show('Thanks for the feedback! 🐾', ToastAndroid.SHORT);
          }
        }, 0);
      }
      return { ...prev, [messageId]: isTogglingOff ? null : type };
    });
  }, []);

  // ─── Navigate action ─────────────────────────────────
  const handleAction = useCallback(
    (tabName) => {
      if (onNavigateTo) onNavigateTo(tabName);
    },
    [onNavigateTo],
  );

  // ─── Image Picker (Camera + Gallery) ──────────────────
  const handleImagePick = useCallback(() => {
    Alert.alert('Send a Photo', 'Choose how you want to add a photo for Jemoy to analyze.', [
      {
        text: '📷 Camera',
        onPress: async () => {
          try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Needed', 'Camera permission is required to take photos.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: 'images',
              quality: 0.7,
              base64: true,
              allowsEditing: true,
              aspect: [4, 3],
            });
            if (!result.canceled && result.assets[0]) {
              const asset = result.assets[0];
              const base64 = asset.base64 || await imageToBase64(asset.uri);
              if (base64) {
                setAttachedImage({
                  uri: asset.uri,
                  base64,
                  mimeType: asset.mimeType || 'image/jpeg',
                });
              } else {
                Alert.alert('Image Processing Error', 'We could not properly format this image. Try taking another photo or selecting one from your gallery.');
              }
            }
          } catch (error) {
            console.error('Camera Error:', error);
            Alert.alert('Camera Error', 'Something went wrong when trying to open the camera or process the photo.');
          }
        },
      },
      {
        text: '🖼️ Gallery',
        onPress: async () => {
          try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Needed', 'Gallery permission is required to select photos.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: 'images',
              quality: 0.7,
              base64: true,
              allowsEditing: true,
              aspect: [4, 3],
            });
            if (!result.canceled && result.assets[0]) {
              const asset = result.assets[0];
              const base64 = asset.base64 || await imageToBase64(asset.uri);
              if (base64) {
                setAttachedImage({
                  uri: asset.uri,
                  base64,
                  mimeType: asset.mimeType || 'image/jpeg',
                });
              } else {
                Alert.alert('Image Processing Error', 'We could not properly format this gallery image. Try another photo.');
              }
            }
          } catch (error) {
            console.error('Gallery Error:', error);
            Alert.alert('Gallery Error', 'Something went wrong when trying to open your photo gallery.');
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, []);

  // ─── Remove attached image ────────────────────────────
  const handleRemoveImage = useCallback(() => {
    setAttachedImage(null);
  }, []);

  // ─── Text-to-Speech ───────────────────────────────────
  const handleSpeak = useCallback(async (messageId, text) => {
    if (speakingMessageId === messageId) {
      // Stop speaking
      Speech.stop();
      setSpeakingMessageId(null);
      return;
    }
    // Stop any current speech first
    Speech.stop();
    setSpeakingMessageId(messageId);

    // Strip markdown for cleaner speech
    const cleanText = text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/[•\-–]\s/g, '')
      .replace(/[🐾🐺🐶🐱❤️✅📋💰🚚📞🦸📍🔒📸🗑️📊🚗🏠📧📤🧹⏳🔑🐕📡🚨👤❓📷🖼️]/g, '')
      .trim();

    try {
      Speech.speak(cleanText, {
        language: 'en',
        pitch: 1.0,
        rate: 0.9,
        onDone: () => {
          if (mountedRef.current) setSpeakingMessageId(null);
        },
        onStopped: () => {
          if (mountedRef.current) setSpeakingMessageId(null);
        },
        onError: () => {
          if (mountedRef.current) setSpeakingMessageId(null);
        },
      });
    } catch {
      setSpeakingMessageId(null);
    }
  }, [speakingMessageId]);

  // ─── Session Management ───────────────────────────────
  const handleNewSession = useCallback(async () => {
    // Save current chat first
    if (activeSessionId && messages.length > 0) {
      const cleanMessages = messages.map(({ onRetry, ...rest }) => rest);
      const storageKey = `${STORAGE_KEY}_${activeSessionId}`;
      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify({
          messages: cleanMessages,
          history: conversationHistory.current,
          feedback: feedbackState,
        }),
      ).catch(() => {});
    }

    // Create new session
    const newSession = createSession(generateId(), 'New Chat');
    const updatedSessions = [newSession, ...sessions];
    setSessions(updatedSessions);
    setActiveSessionId(newSession.id);
    setMessages([createWelcomeMessage()]);
    conversationHistory.current = [];
    setFeedbackState({});
    setShowSuggestions(true);
    setFollowUpSuggestions(null);
    setAnimatingMessageId(null);
    setAttachedImage(null);
    Speech.stop();
    setSpeakingMessageId(null);

    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updatedSessions)).catch(() => {});
    await AsyncStorage.setItem(ACTIVE_SESSION_KEY, newSession.id).catch(() => {});
    setSessionsModalVisible(false);
  }, [activeSessionId, messages, sessions, feedbackState, createWelcomeMessage, STORAGE_KEY, SESSIONS_KEY, ACTIVE_SESSION_KEY]);

  const handleSwitchSession = useCallback(async (sessionId) => {
    if (sessionId === activeSessionId) {
      setSessionsModalVisible(false);
      return;
    }

    // Save current session first
    if (activeSessionId && messages.length > 0) {
      const cleanMessages = messages.map(({ onRetry, ...rest }) => rest);
      const storageKey = `${STORAGE_KEY}_${activeSessionId}`;
      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify({
          messages: cleanMessages,
          history: conversationHistory.current,
          feedback: feedbackState,
        }),
      ).catch(() => {});
    }

    // Load target session
    setActiveSessionId(sessionId);
    Speech.stop();
    setSpeakingMessageId(null);
    setAttachedImage(null);
    setFollowUpSuggestions(null);
    setAnimatingMessageId(null);

    try {
      const storageKey = `${STORAGE_KEY}_${sessionId}`;
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          setMessages(parsed.messages);
          conversationHistory.current = Array.isArray(parsed.history) ? parsed.history : [];
          setFeedbackState(parsed.feedback || {});
          setShowSuggestions(parsed.messages.length <= 1);
        } else {
          setMessages([createWelcomeMessage()]);
          conversationHistory.current = [];
          setFeedbackState({});
          setShowSuggestions(true);
        }
      } else {
        setMessages([createWelcomeMessage()]);
        conversationHistory.current = [];
        setFeedbackState({});
        setShowSuggestions(true);
      }
    } catch {
      setMessages([createWelcomeMessage()]);
      conversationHistory.current = [];
      setFeedbackState({});
      setShowSuggestions(true);
    }

    await AsyncStorage.setItem(ACTIVE_SESSION_KEY, sessionId).catch(() => {});
    setSessionsModalVisible(false);
  }, [activeSessionId, messages, feedbackState, createWelcomeMessage, STORAGE_KEY, ACTIVE_SESSION_KEY]);

  const handleDeleteSession = useCallback(async (sessionId) => {
    if (sessions.length <= 1) {
      Alert.alert('Cannot Delete', 'You need at least one chat session.');
      return;
    }
    Alert.alert('Delete Chat', 'Are you sure you want to delete this conversation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updatedSessions = sessions.filter((s) => s.id !== sessionId);
          setSessions(updatedSessions);
          await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updatedSessions)).catch(() => {});
          await AsyncStorage.removeItem(`${STORAGE_KEY}_${sessionId}`).catch(() => {});

          // If deleting the active session, switch to first available
          if (sessionId === activeSessionId) {
            const nextSession = updatedSessions[0];
            handleSwitchSession(nextSession.id);
          }
        },
      },
    ]);
  }, [sessions, activeSessionId, handleSwitchSession, STORAGE_KEY, SESSIONS_KEY]);

  // ─── Animation complete ───────────────────────────────
  const handleAnimationComplete = useCallback(() => {
    setAnimatingMessageId(null);
  }, []);

  // ─── Search scroll ───────────────────────────────────
  const handleScrollToMessage = useCallback(
    (messageId) => {
      const index = messages.findIndex((m) => m.id === messageId);
      if (index >= 0) {
        flatListRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.5,
        });
      }
    },
    [messages],
  );

  // ─── Follow-up suggestion press ──────────────────────
  const handleFollowUpPress = useCallback((suggestion) => {
    setFollowUpSuggestions(null);
    handleSendRef.current(suggestion.query);
  }, []);

  // ─── Modal controls (stable references) ───────────────
  const openSearch = useCallback(() => setSearchVisible(true), []);
  const closeSearch = useCallback(() => setSearchVisible(false), []);

  // ─── Input handlers (stable references) ───────────────
  const handleFocus = useCallback(() => {
    setInputFocused(true);
    // Hide follow-ups when keyboard opens to prevent layout jump
    setFollowUpSuggestions(null);
    scrollToBottom(200);
  }, [scrollToBottom]);
  const handleBlur = useCallback(() => setInputFocused(false), []);
  const handlePressSend = useCallback(() => handleSend(), [handleSend]);

  // ─── Render message row ───────────────────────────────
  // FIX: wraps with <View> instead of <> to avoid missing key warning in FlatList
  // FIX: reads previous message from messagesRef to avoid stale closure issue
  const renderMessage = useCallback(
    ({ item, index }) => {
      let showDateSep = false;
      if (index === 0) {
        showDateSep = true;
      } else {
        const prev = messagesRef.current[index - 1];
        if (
          prev &&
          new Date(prev.timestamp || 0).toDateString() !==
            new Date(item.timestamp || 0).toDateString()
        ) {
          showDateSep = true;
        }
      }

      return (
        <View>
          {showDateSep && (
            <DateSeparator date={item.timestamp || createTimestamp()} />
          )}
          <MessageBubble
            item={item}
            isAnimating={animatingMessageId === item.id}
            onAnimationComplete={handleAnimationComplete}
            onCopy={handleCopy}
            onFeedback={handleFeedback}
            feedback={feedbackState[item.id] || null}
            actions={item.actions}
            onAction={handleAction}
            onSpeak={handleSpeak}
            isSpeaking={speakingMessageId === item.id}
            onRetry={
              item.failed
                ? () => handleRetry(item.text, item.id)
                : undefined
            }
          />
        </View>
      );
    },
    [
      animatingMessageId,
      handleAnimationComplete,
      handleCopy,
      handleFeedback,
      feedbackState,
      handleAction,
      handleRetry,
      handleSpeak,
      speakingMessageId,
    ],
  );

  const keyExtractor = useCallback((item) => item.id, []);

  // FIX: graceful fallback for scrollToIndex failure
  const onScrollToIndexFailed = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, []);

  // ─── Memoised list footer ─────────────────────────────
  const listFooter = useMemo(
    () => (isTyping ? <TypingIndicator /> : null),
    [isTyping],
  );

  // ─── Memoised list header (suggestions) ───────────────
  // FIX: uses handleSuggestionPress (stable ref-based) so header doesn't
  // re-render on every keystroke in the input
  const listHeader = useMemo(() => {
    if (!showSuggestions || messages.length > 1) return null;
    return (
      <View style={styles.suggestionsWrap}>
        <Text style={styles.suggestionsLabel}>Quick questions</Text>
        <View style={styles.suggestionsGrid}>
          {QUICK_SUGGESTIONS.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.suggestionCard}
              onPress={() => handleSuggestionPress(s)}
              activeOpacity={0.75}
            >
              <View style={styles.suggestionIconWrap}>
                <Ionicons name={s.icon} size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.suggestionCardText}>{s.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }, [showSuggestions, messages.length, handleSuggestionPress]);

  // ─── Derived state ────────────────────────────────────
  const charCount = inputText.length;
  const canSend = (inputText.trim().length > 0 || !!attachedImage) && !isTyping;

  // ─── Loading State ────────────────────────────────────
  if (!isLoaded) {
    return (
      <View style={styles.loadingScreen}>
        <View style={styles.loadingAvatarLarge}>
          <JemoyIcon size={48} />
        </View>
        <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 20 }} />
        <Text style={styles.loadingLabel}>Starting Jemoy…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={UI.headerFrom} />

      {/* ─── Header ──────────────────────────────────────── */}
      <LinearGradient
        colors={[UI.headerFrom, UI.headerTo]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity style={styles.headerBackBtn} onPress={onGoBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.headerProfile}>
          <View style={styles.headerAvatar}>
            <JemoyIcon size={24} />
            <View style={[styles.onlineBadge, !isOnline && styles.offlineBadge]} />
          </View>
          <View>
            <Text style={styles.headerName}>Jemoy</Text>
            <Text style={styles.headerStatus}>{isOnline ? 'Online' : 'Offline'}</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setSessionsModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubbles-outline" size={17} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={openSearch} activeOpacity={0.7}>
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => {
              Alert.alert('Chat Options', 'What would you like to do?', [
                { text: 'Export Chat 📤', onPress: handleShareConversation },
                { text: 'Contact Support 📧', onPress: handleContactSupport },
                { text: 'Clear Chat 🧹', onPress: handleClearChat, style: 'destructive' },
                { text: 'Cancel', style: 'cancel' },
              ]);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-vertical" size={18} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ─── Offline Banner ──────────────────────────────── */}
      {!isOnline && <OfflineBanner />}

      {/* ─── Chat Body ───────────────────────────────────── */}
      <KeyboardAvoidingView
        style={styles.chatBody}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onScrollToIndexFailed={onScrollToIndexFailed}
          extraData={animatingMessageId}
          ListFooterComponent={listFooter}
          ListHeaderComponent={listHeader}
          removeClippedSubviews={false}
          maxToRenderPerBatch={15}
          windowSize={11}
          initialNumToRender={20}
        />

        {/* ─── Follow-up Suggestions ───────────────────── */}
        {followUpSuggestions && !isTyping && !inputFocused && (
          <View style={styles.followUpWrap}>
            <FlatList
              horizontal
              data={followUpSuggestions}
              keyExtractor={(item, i) => `followup-${i}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.followUpList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.followUpChip}
                  onPress={() => handleFollowUpPress(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.followUpText}>{item.text}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* ─── Image Preview ─────────────────────────────── */}
        {attachedImage && (
          <View style={styles.imagePreviewWrap}>
            <Image source={{ uri: attachedImage.uri }} style={styles.imagePreviewThumb} />
            <View style={styles.imagePreviewInfo}>
              <Text style={styles.imagePreviewLabel}>📷 Photo attached</Text>
              <Text style={styles.imagePreviewHint}>Jemoy will analyze this image</Text>
            </View>
            <TouchableOpacity onPress={handleRemoveImage} style={styles.imagePreviewRemove} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={22} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Input ───────────────────────────────────── */}
        <View style={styles.inputArea}>
          <View style={[styles.inputRow, inputFocused && styles.inputRowFocused]}>
            <TouchableOpacity
              onPress={handleImagePick}
              style={styles.inputIconBtn}
              activeOpacity={0.6}
            >
              <Ionicons
                name="camera-outline"
                size={20}
                color={attachedImage ? COLORS.primary : (inputFocused ? COLORS.primary : UI.timeBot)}
              />
            </TouchableOpacity>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Message Jemoy…"
              placeholderTextColor={UI.timeBot}
              multiline
              maxLength={1000}
              editable={!isTyping}
              onFocus={handleFocus}
              onBlur={handleBlur}
              returnKeyType="default"
              blurOnSubmit={false}
            />
            {charCount > 0 && (
              <Text style={[
                styles.charCount,
                charCount > 900 && styles.charCountWarn,
                charCount > 980 && styles.charCountDanger,
              ]}>
                {charCount}/1000
              </Text>
            )}
            <TouchableOpacity
              style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
              onPress={handlePressSend}
              disabled={!canSend}
              activeOpacity={0.7}
            >
              {isTyping ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="arrow-up" size={18} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.disclaimerRow}>
            <Text style={styles.disclaimer}>Jemoy can make mistakes. Verify important info.</Text>
            <TouchableOpacity onPress={handleContactSupport} activeOpacity={0.7}>
              <Text style={styles.supportLink}>Need help? Contact us</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* ─── Sessions Modal ─────────────────────────────────── */}
      <Modal
        visible={sessionsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSessionsModalVisible(false)}
      >
        <View style={styles.searchOverlay}>
          <View style={styles.sessionsSheet}>
            <View style={styles.searchHandle} />
            <View style={styles.sessionsHeader}>
              <Text style={styles.sessionsTitle}>💬 Chat Sessions</Text>
              <TouchableOpacity
                style={styles.newSessionBtn}
                onPress={handleNewSession}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                <Text style={styles.newSessionBtnText}>New Chat</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={sessions}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 40 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.sessionItem,
                    item.id === activeSessionId && styles.sessionItemActive,
                  ]}
                  onPress={() => handleSwitchSession(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.sessionItemLeft}>
                    <Ionicons
                      name={item.id === activeSessionId ? 'chatbubble' : 'chatbubble-outline'}
                      size={18}
                      color={item.id === activeSessionId ? COLORS.primary : UI.timeBot}
                    />
                    <View style={styles.sessionItemInfo}>
                      <Text
                        style={[
                          styles.sessionItemTitle,
                          item.id === activeSessionId && styles.sessionItemTitleActive,
                        ]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <Text style={styles.sessionItemDate}>
                        {formatDateLabel(item.updatedAt || item.createdAt)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteSession(item.id)}
                    style={styles.sessionDeleteBtn}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="trash-outline" size={16} color={UI.timeBot} />
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.searchEmptyWrap}>
                  <Ionicons name="chatbubbles-outline" size={40} color={UI.subtleBorder} />
                  <Text style={styles.searchEmptyText}>No sessions yet</Text>
                </View>
              }
            />
            <TouchableOpacity
              style={styles.sessionsCloseBtn}
              onPress={() => setSessionsModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.searchCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Search Modal ────────────────────────────────── */}
      <SearchModal
        visible={searchVisible}
        onClose={closeSearch}
        messages={messages}
        onScrollToMessage={handleScrollToMessage}
      />
    </View>
  );
};

// ═════════════════════════════════════════════════════════════
// ─── STYLES ─────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  // ─── Screen / Loading ─────────
  screen: {
    flex: 1,
    backgroundColor: UI.chatBg,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: UI.chatBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingAvatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: UI.avatarBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: UI.avatarRing,
  },
  loadingLabel: {
    marginTop: 12,
    fontSize: 14,
    color: UI.timeBot,
    fontWeight: '500',
  },

  // ─── Header ───────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 54,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4ADE80',
    borderWidth: 2,
    borderColor: '#FF9554',
  },
  offlineBadge: {
    backgroundColor: '#9CA3AF',
  },
  headerName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  headerStatus: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Offline Banner ───────────
  offlineBanner: {
    backgroundColor: '#EF4444',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  offlineInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  offlineText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // ─── Chat Body ────────────────
  chatBody: {
    flex: 1,
  },
  msgList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },

  // ─── Date Separator ───────────
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dateLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: UI.subtleBorder,
  },
  datePill: {
    backgroundColor: UI.subtle,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
    marginHorizontal: 10,
  },
  dateText: {
    fontSize: 11,
    color: UI.timeBot,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // ─── Avatar ───────────────────
  avatarWrap: {
    backgroundColor: UI.avatarBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: UI.avatarRing,
    marginRight: 8,
    marginTop: 2,
  },

  // ─── Bubbles ──────────────────
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 6,
    maxWidth: '88%',
    alignSelf: 'flex-start',
  },
  bubbleRowUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '100%',
    flexShrink: 1,
  },
  userBubble: {
    backgroundColor: UI.userBubbleBg,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    shadowColor: '#FF9554',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  botBubble: {
    backgroundColor: UI.botBubbleBg,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: UI.botBubbleBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  messageText: {
    fontSize: 14.5,
    lineHeight: 21,
  },
  userText: {
    color: UI.userBubbleText,
  },
  botText: {
    color: UI.botBubbleText,
  },
  msgTime: {
    fontSize: 10,
    marginTop: 6,
    alignSelf: 'flex-end',
    fontWeight: '500',
  },

  // ─── Bot Footer ───────────────
  botFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 38,
    marginTop: 3,
    marginBottom: 2,
    paddingRight: 8,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  copyLabel: {
    fontSize: 11,
    color: UI.timeBot,
    fontWeight: '500',
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  thumbBtn: {
    padding: 5,
    borderRadius: 14,
  },
  thumbActive: {
    backgroundColor: UI.subtle,
  },

  // ─── Action Chips ─────────────
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: 38,
    marginBottom: 10,
    gap: 6,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.pillBg,
    borderWidth: 1,
    borderColor: UI.pillBorder,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 5,
  },
  actionChipText: {
    fontSize: 12,
    color: UI.pillText,
    fontWeight: '600',
  },

  // ─── Retry ────────────────────
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginLeft: 38,
    marginTop: 4,
    marginBottom: 8,
    backgroundColor: COLORS.errorBackground,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 5,
  },
  retryLabel: {
    fontSize: 12,
    color: COLORS.error,
    fontWeight: '600',
  },

  // ─── Typing Indicator ─────────
  typingBubble: {
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },

  // ─── Suggestions ──────────────
  suggestionsWrap: {
    marginBottom: 20,
    marginTop: 4,
  },
  suggestionsLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: UI.timeBot,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionCard: {
    width: (SCREEN_WIDTH - 32 - 8) / 2 - 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: UI.botBubbleBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  suggestionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: UI.pillBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  suggestionCardText: {
    fontSize: 13,
    color: UI.botBubbleText,
    fontWeight: '600',
    lineHeight: 18,
  },

  // ─── Input Area ───────────────
  inputArea: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: UI.botBubbleBorder,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: UI.chatBg,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: UI.inputBorder,
    paddingRight: 5,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  inputRowFocused: {
    borderColor: UI.inputFocusBorder,
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#FF9554',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    } : {}),
  },
  inputIconBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 14.5,
    color: UI.botBubbleText,
    maxHeight: 100,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 0,
    lineHeight: 20,
    textAlignVertical: 'center',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF9554',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
    shadowColor: '#FF9554',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendBtnDisabled: {
    backgroundColor: '#FFB584',
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
  },
  disclaimer: {
    fontSize: 10,
    color: UI.timeBot,
    letterSpacing: 0.1,
  },
  disclaimerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  supportLink: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  charCount: {
    fontSize: 10,
    color: UI.timeBot,
    fontWeight: '500',
    marginRight: 6,
    marginBottom: 12,
    alignSelf: 'flex-end',
  },
  charCountWarn: {
    color: COLORS.warning,
  },
  charCountDanger: {
    color: COLORS.error,
    fontWeight: '700',
  },
  // ─── Follow-up Suggestions ────
  followUpWrap: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: UI.botBubbleBorder,
    paddingVertical: 8,
  },
  followUpList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  followUpChip: {
    backgroundColor: UI.pillBg,
    borderWidth: 1,
    borderColor: UI.pillBorder,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
  },
  followUpText: {
    fontSize: 12.5,
    color: UI.pillText,
    fontWeight: '600',
  },

  // ─── Search Modal ─────────────
  searchOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  searchSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 50,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  searchHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: UI.subtleBorder,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: UI.botBubbleBorder,
    gap: 10,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.chatBg,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 0,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: UI.botBubbleText,
  },
  searchCancel: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  searchCancelText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  searchItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: UI.subtle,
  },
  searchItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  searchRoleBadge: {
    backgroundColor: UI.avatarBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  searchRoleBadgeUser: {
    backgroundColor: UI.pillBg,
  },
  searchRoleText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchRoleTextUser: {
    color: UI.pillText,
  },
  searchItemTime: {
    fontSize: 10,
    color: UI.timeBot,
    fontWeight: '500',
  },
  searchItemBody: {
    fontSize: 13,
    color: UI.botBubbleText,
    lineHeight: 18,
  },
  searchEmptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  searchEmptyText: {
    fontSize: 14,
    color: UI.timeBot,
    fontWeight: '500',
  },

  // ─── Image in Message ─────────
  messageImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 8,
  },

  // ─── Image Preview (attached) ──
  imagePreviewWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: UI.botBubbleBorder,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  imagePreviewThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: UI.chatBg,
  },
  imagePreviewInfo: {
    flex: 1,
  },
  imagePreviewLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: UI.botBubbleText,
  },
  imagePreviewHint: {
    fontSize: 11,
    color: UI.timeBot,
    marginTop: 2,
  },
  imagePreviewRemove: {
    padding: 4,
  },

  // ─── TTS Active ───────────────
  ttsActive: {
    backgroundColor: UI.pillBg,
    borderRadius: 8,
  },

  // ─── Sessions Modal ──────────
  sessionsSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 50,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sessionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: UI.botBubbleBorder,
  },
  sessionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: UI.botBubbleText,
  },
  newSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 5,
  },
  newSessionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: UI.subtle,
  },
  sessionItemActive: {
    backgroundColor: UI.pillBg,
  },
  sessionItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sessionItemInfo: {
    flex: 1,
  },
  sessionItemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: UI.botBubbleText,
  },
  sessionItemTitleActive: {
    fontWeight: '700',
    color: COLORS.primary,
  },
  sessionItemDate: {
    fontSize: 11,
    color: UI.timeBot,
    marginTop: 2,
  },
  sessionDeleteBtn: {
    padding: 8,
  },
  sessionsCloseBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: UI.botBubbleBorder,
  },
});

export default memo(JemoyScreen);
