import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebaseConfig';

const formatDate = (value) => {
  if (!value) return '';
  const parsed = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const AdoptionChatScreen = ({ chatId, onBack, viewerRole = '' }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const loadChat = useCallback(async () => {
    if (!chatId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      const chatSnap = await getDoc(doc(db, 'chats', chatId));
      const chatData = chatSnap.exists() ? { id: chatSnap.id, ...chatSnap.data() } : null;
      setChat(chatData);

      const msgSnap = await getDocs(query(collection(db, 'chats', chatId, 'messages'), orderBy('created_at', 'asc')));
      const rows = msgSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
      setMessages(rows);
    } catch (error) {
      setMessages([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [chatId]);

  useEffect(() => {
    loadChat();
  }, [loadChat]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadChat();
  }, [loadChat]);

  const counterpartName = useMemo(() => {
    if (!chat) return 'Adoption Chat';
    if (chat.adopter_id === user?.uid) return chat.shelter_name || 'Shelter';
    return chat.adopter_name || 'Adopter';
  }, [chat, user?.uid]);

  const resolvedViewerRole = useMemo(() => {
    if (viewerRole) return viewerRole;
    if (!chat || !user?.uid) return '';
    if (chat.adopter_id === user.uid) return 'adopter';
    if (chat.shelter_manager_id === user.uid) return 'shelter';
    return '';
  }, [chat, user?.uid, viewerRole]);

  const sendMessage = useCallback(async () => {
    const body = String(draft || '').trim();
    if (!body || !chatId || !user?.uid) return;

    try {
      setSending(true);
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: body,
        sender_id: user.uid,
        sender_role: resolvedViewerRole || 'participant',
        sender_name: user.full_name || user.name || user.email || 'User',
        created_at: serverTimestamp(),
      });

      await updateDoc(doc(db, 'chats', chatId), {
        last_message: body,
        last_sender_id: user.uid,
        last_message_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      setDraft('');
      loadChat();
    } finally {
      setSending(false);
    }
  }, [chatId, draft, loadChat, resolvedViewerRole, user?.email, user?.full_name, user?.name, user?.uid]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8EF" />

      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{counterpartName}</Text>
          <Text style={styles.headerSubtitle}>{chat?.pet_name || 'Adoption Chat'}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={styles.emptyText}>No messages yet. Start the conversation.</Text>
          </View>
        ) : (
          messages.map((msg) => {
            const mine = resolvedViewerRole
              ? msg.sender_role === resolvedViewerRole
              : msg.sender_id === user?.uid;
            return (
              <View key={msg.id} style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapOther]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{msg.text}</Text>
                </View>
                <Text style={styles.timeText}>{formatDate(msg.created_at)}</Text>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor={COLORS.textLight}
          value={draft}
          onChangeText={setDraft}
          editable={!sending}
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={sending}>
          {sending ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="send" size={18} color="#FFF" />}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8EF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F2E7D8',
    backgroundColor: '#FFF8EF',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF2E5',
    borderWidth: 1,
    borderColor: '#F4DDC5',
  },
  headerTitle: { fontSize: 18, fontFamily: 'Poppins-SemiBold', color: '#1E1A15' },
  headerSubtitle: { marginTop: 2, fontSize: 12, color: '#7D6851' },
  messagesList: { flex: 1, paddingHorizontal: SPACING.md },
  messagesContent: { paddingVertical: SPACING.sm, paddingBottom: 120 },
  centerBox: { marginTop: 60, alignItems: 'center' },
  emptyText: { color: '#7D6851' },
  bubbleWrap: { marginTop: SPACING.xs },
  bubbleWrapMine: { alignItems: 'flex-end' },
  bubbleWrapOther: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    borderRadius: 14,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  bubbleMine: { backgroundColor: COLORS.primary },
  bubbleOther: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEDFCF' },
  bubbleText: { color: '#2A1F14', fontSize: FONTS.sizes.sm },
  bubbleTextMine: { color: '#FFFFFF' },
  timeText: { marginTop: 2, fontSize: 10, color: '#8A7258' },
  inputBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1E6D8',
  },
  input: {
    flex: 1,
    minHeight: 40,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    borderColor: '#E5D5C3',
    backgroundColor: '#FFFDF8',
    paddingHorizontal: SPACING.md,
    color: COLORS.textDark,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: SPACING.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
});

export default AdoptionChatScreen;
