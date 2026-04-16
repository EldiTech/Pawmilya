import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebaseConfig';
import { shelterService } from '../../services';
import { normalizeImageUrl } from '../../utils/imageUrl';

const getShelterTrustMeta = (shelter = {}) => {
  const verificationStatus = String(shelter?.verification_status || '').trim().toLowerCase();
  const isVerified = Boolean(
    shelter?.is_verified
    || shelter?.verified
    || verificationStatus === 'approved'
    || verificationStatus === 'verified'
  );

  if (isVerified) {
    return {
      label: 'Verified',
      icon: 'checkmark-circle',
      bgColor: '#E8F5E9',
      borderColor: 'rgba(143, 194, 154, 0.4)',
      textColor: COLORS.success,
    };
  }

  return {
    label: 'Listed',
    icon: 'information-circle',
    bgColor: '#EFF6FF',
    borderColor: 'rgba(59, 130, 246, 0.35)',
    textColor: '#1D4ED8',
  };
};

const AvailableSheltersScreen = ({ onOpenChat }) => {
  const { user } = useAuth();
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedShelter, setSelectedShelter] = useState(null);
  const [openingChatShelterId, setOpeningChatShelterId] = useState(null);

  const fetchShelters = async () => {
    try {
      const data = await shelterService.getShelters();
      setShelters(data);
    } catch (error) {
      console.error('Error fetching shelters:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchShelters();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchShelters();
  };

  const openShelterChat = async (shelter) => {
    const shelterId = String(shelter?.id || '').trim();
    const shelterManagerId = String(shelter?.manager_id || '').trim();
    const adopterId = String(user?.uid || '').trim();

    if (!adopterId) {
      Alert.alert('Sign In Required', 'Please sign in to message shelters.');
      return;
    }

    if (!shelterId || !shelterManagerId) {
      Alert.alert('Chat Unavailable', 'This shelter has no active chat contact yet.');
      return;
    }

    try {
      setOpeningChatShelterId(shelterId);

      const chatId = `inquiry_${adopterId}_${shelterId}`;
      const chatRef = doc(collection(db, 'chats'), chatId);
      const existingChatSnap = await getDoc(chatRef);

      if (existingChatSnap.exists()) {
        await setDoc(chatRef, {
          updated_at: serverTimestamp(),
          shelter_name: shelter?.name || 'Shelter',
          shelter_manager_id: shelterManagerId,
        }, { merge: true });
      } else {
        await setDoc(chatRef, {
          chat_type: 'shelter_inquiry',
          adopter_id: adopterId,
          adopter_name: user?.full_name || user?.name || user?.email || 'Adopter',
          adopter_email: user?.email || null,
          shelter_id: shelterId,
          shelter_manager_id: shelterManagerId,
          shelter_name: shelter?.name || 'Shelter',
          pet_name: 'Shelter Inquiry',
          participants: [adopterId, shelterManagerId].filter(Boolean),
          status: 'open',
          last_message: '',
          last_sender_id: null,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      }

      if (chatId) {
        onOpenChat?.({
          chatId,
          returnTab: 'shelter',
          role: 'adopter',
        });
      }
    } catch (error) {
      Alert.alert('Chat Error', error?.message || 'Unable to open shelter chat right now.');
    } finally {
      setOpeningChatShelterId(null);
    }
  };

  const renderShelterCard = ({ item }) => {
    const trustMeta = getShelterTrustMeta(item);

    return (
    <View style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setSelectedShelter(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}>
            {item.image ? (
              <Image source={{ uri: normalizeImageUrl(item.image) }} style={styles.shelterImage} />
            ) : (
              <Ionicons name="home" size={24} color={COLORS.primary} />
            )}
          </View>
          <View style={styles.cardHeaderInfo}>
            <Text style={styles.shelterName}>{item.name}</Text>
            <View style={styles.subtitleContainer}>
              <View style={[styles.badgeContainer, { backgroundColor: trustMeta.bgColor, borderColor: trustMeta.borderColor }]}>
                <Ionicons name={trustMeta.icon} size={12} color={trustMeta.textColor} />
                <Text style={[styles.badgeText, { color: trustMeta.textColor }]}>{trustMeta.label}</Text>
              </View>
              <Text style={styles.shelterLocation} numberOfLines={1}>
                • {item.city}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.viewMoreBtn}>
          <Text style={styles.viewMoreText}>View Information</Text>
          <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.messageBtn, openingChatShelterId === item.id && styles.messageBtnDisabled]}
        onPress={() => openShelterChat(item)}
        disabled={openingChatShelterId === item.id}
      >
        {openingChatShelterId === item.id ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color="#FFFFFF" style={styles.messageBtnIcon} />
            <Text style={styles.messageBtnText}>Message Shelter</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
  };

  const renderShelterModal = () => {
    if (!selectedShelter) return null;
    
    return (
      <Modal
        visible={!!selectedShelter}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedShelter(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Shelter Information</Text>
              <TouchableOpacity onPress={() => setSelectedShelter(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent} showsVerticalScrollIndicator={false}>
              <View style={styles.modalIconWrap}>
                {selectedShelter.image ? (
                  <Image source={{ uri: normalizeImageUrl(selectedShelter.image) }} style={styles.modalShelterImage} />
                ) : (
                  <Ionicons name="business" size={40} color={COLORS.primary} />
                )}
              </View>
              
              <Text style={styles.modalShelterName}>{selectedShelter.name}</Text>
              
              <View style={styles.infoSection}>
                <View style={styles.infoRow}>
                  <Ionicons name="mail" size={20} color={COLORS.textLight} />
                  <Text style={styles.infoText}>{selectedShelter.email}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="call" size={20} color={COLORS.textLight} />
                  <Text style={styles.infoText}>{selectedShelter.phone}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="location" size={20} color={COLORS.textLight} />
                  <Text style={styles.infoText}>{selectedShelter.address}, {selectedShelter.city}</Text>
                </View>
                {selectedShelter.website ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="globe" size={20} color={COLORS.textLight} />
                    <Text style={styles.infoText}>{selectedShelter.website}</Text>
                  </View>
                ) : null}
                {selectedShelter.capacity ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="people" size={20} color={COLORS.textLight} />
                    <Text style={styles.infoText}>Capacity: {selectedShelter.capacity}</Text>
                  </View>
                ) : null}
              </View>

              {selectedShelter.animalTypes?.length > 0 ? (
                <View style={styles.bioSection}>
                   <Text style={styles.sectionTitle}>Accepted Pets</Text>
                   <Text style={styles.bioText}>{selectedShelter.animalTypes.join(', ')}</Text>
                </View>
              ) : null}

              {selectedShelter.servicesOffered?.length > 0 ? (
                <View style={styles.bioSection}>
                   <Text style={styles.sectionTitle}>Services Offered</Text>
                   <Text style={styles.bioText}>{selectedShelter.servicesOffered.join(', ')}</Text>
                </View>
              ) : null}

              {selectedShelter.bio && selectedShelter.bio.trim().length > 0 ? (
                <View style={styles.bioSection}>
                   <Text style={styles.sectionTitle}>About Us (Bio)</Text>
                   <Text style={styles.bioText}>{selectedShelter.bio.trim()}</Text>
                </View>
              ) : null}

              {selectedShelter.description && selectedShelter.description.trim().length > 0 ? (
                <View style={styles.bioSection}>
                   <Text style={styles.sectionTitle}>Description</Text>
                   <Text style={styles.bioText}>{selectedShelter.description.trim()}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.modalMessageBtn, openingChatShelterId === selectedShelter.id && styles.messageBtnDisabled]}
                onPress={() => openShelterChat(selectedShelter)}
                disabled={openingChatShelterId === selectedShelter.id}
              >
                {openingChatShelterId === selectedShelter.id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#FFFFFF" style={styles.modalMessageIcon} />
                    <Text style={styles.modalMessageBtnText}>Message This Shelter</Text>
                  </>
                )}
              </TouchableOpacity>

            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Available Shelters</Text>
        <Text style={styles.headerSubtitle}>Discover and connect with local shelters</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={shelters}
          renderItem={renderShelterCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="moon" size={60} color={COLORS.textLight} />
              <Text style={styles.emptyTitle}>No Shelters Found</Text>
              <Text style={styles.emptyText}>There are currently no active shelters available. Check back later!</Text>
            </View>
          }
        />
      )}
      
      {renderShelterModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
  },
  listContainer: {
    padding: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? 104 : 88,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    shadowColor: COLORS.brown,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    overflow: 'hidden',
  },
  shelterImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    resizeMode: 'cover',
  },
  cardHeaderInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  shelterName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  subtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(143, 194, 154, 0.4)',
    marginRight: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: FONTS.weights.bold,
    marginLeft: 2,
  },
  shelterLocation: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textLight,
  },
  shelterBio: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    lineHeight: 22,
  },
  viewMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  viewMoreText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.primary,
    marginRight: 4,
  },
  messageBtn: {
    marginTop: SPACING.sm,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  messageBtnIcon: {
    marginRight: 6,
  },
  messageBtnDisabled: {
    opacity: 0.7,
  },
  messageBtnText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
    lineHeight: 22,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.backgroundWhite,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: SPACING.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : SPACING.xxl,
    paddingTop: SPACING.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  modalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  closeBtn: {
    padding: SPACING.xs,
  },
  modalBody: {
    maxHeight: '100%',
  },
  modalBodyContent: {
    alignItems: 'center',
    paddingBottom: SPACING.md,
  },
  modalIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  modalShelterImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    resizeMode: 'cover',
  },
  modalShelterName: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.xl,
    textAlign: 'center',
  },
  infoSection: {
    width: '100%',
    backgroundColor: COLORS.backgroundLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  infoText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    marginLeft: SPACING.md,
    flex: 1,
    lineHeight: 20,
  },
  bioSection: {
    width: '100%',
    backgroundColor: COLORS.backgroundLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: SPACING.sm,
  },
  bioText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium,
    lineHeight: 24,
  },
  modalMessageBtn: {
    width: '100%',
    marginBottom: SPACING.lg,
    marginTop: SPACING.xs,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  modalMessageIcon: {
    marginRight: 8,
  },
  modalMessageBtnText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
  },
});

export default AvailableSheltersScreen;