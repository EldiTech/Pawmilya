import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, SPACING } from '../../constants/theme';
import { auth, db } from '../../firebaseConfig';

const formatDate = (value) => {
  if (!value) return 'N/A';
  const parsed = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleString();
};

const ShelterChatsScreen = ({ onBack, onOpenChat }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState([]);

  const loadChats = useCallback(async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser?.uid) {
        setRows([]);
        return;
      }

      const chatsSnap = await getDocs(query(
        collection(db, 'chats'),
        where('shelter_manager_id', '==', currentUser.uid),
        orderBy('updated_at', 'desc')
      ));
      const mapped = chatsSnap.docs
        .map((item) => ({ id: item.id, ...item.data() }));

      setRows(mapped);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadChats();
  }, [loadChats]);

  const openChat = useCallback((item) => {
    onOpenChat?.({
      chatId: item.id,
      returnTab: 'shelterChats',
      role: 'shelter',
    });
  }, [onOpenChat]);

  const hasRows = useMemo(() => rows.length > 0, [rows.length]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8EF" />

      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Adoption Chats</Text>
          <Text style={styles.headerSubtitle}>Communicate with adopters in progress</Text>
        </View>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {loading ? (
          <View style={styles.centerBox}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : !hasRows ? (
          <View style={styles.centerBox}><Text style={styles.emptyText}>No chat conversations yet.</Text></View>
        ) : (
          rows.map((item) => (
            <TouchableOpacity key={item.id} style={styles.card} onPress={() => openChat(item)}>
              <Text style={styles.cardTitle}>{item.pet_name || 'Adoption Chat'}</Text>
              <Text style={styles.metaText}>Adopter: {item.adopter_name || 'Unknown'}</Text>
              <Text style={styles.metaText}>Last: {item.last_message || 'No messages yet'}</Text>
              <Text style={styles.metaText}>Updated: {formatDate(item.updated_at || item.created_at)}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8EF' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 50,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F2E7D8',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: SPACING.sm,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF2E5',
    borderWidth: 1,
    borderColor: '#F4DDC5',
  },
  headerTitle: { fontSize: 20, fontFamily: 'Poppins-SemiBold', color: '#1E1A15' },
  headerSubtitle: { marginTop: 4, fontSize: 12, color: '#7D6851' },
  list: { flex: 1, paddingHorizontal: SPACING.md },
  listContent: { paddingTop: SPACING.sm, paddingBottom: 120 },
  centerBox: { marginTop: 70, alignItems: 'center' },
  emptyText: { color: '#7D6851' },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEDFCF',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardTitle: { fontSize: 16, color: '#2A1F14', fontWeight: '700' },
  metaText: { marginTop: 2, fontSize: 12, color: '#7D6851' },
});

export default ShelterChatsScreen;
