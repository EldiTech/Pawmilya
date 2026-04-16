import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDocs, orderBy, query, where, writeBatch } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Linking,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { db } from '../../firebaseConfig';
import { normalizeImageUrl } from '../../utils/imageUrl';
import { ADMIN_COLORS } from './shared';

const AdminShelterManagementScreen = ({ onGoBack }) => {
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewingShelter, setViewingShelter] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [shelterPetCount, setShelterPetCount] = useState(0);
  const [petCountLoading, setPetCountLoading] = useState(false);

  const fetchShelters = async () => {
    try {
      const q = query(collection(db, 'shelters'), orderBy('created_at', 'desc'));
      const snapshot = await getDocs(q);
      const data = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setShelters(data);
    } catch (error) {
      console.error('Error fetching shelters:', error);
      Alert.alert('Error', 'Failed to load shelters');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchShelters();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchShelterPetCount = async () => {
      if (!viewingShelter?.id) {
        setShelterPetCount(0);
        setPetCountLoading(false);
        return;
      }

      try {
        setPetCountLoading(true);
        const petsQuery = query(collection(db, 'pets'), where('shelter_id', '==', viewingShelter.id));
        const petsSnapshot = await getDocs(petsQuery);
        if (!cancelled) {
          setShelterPetCount(petsSnapshot.size);
        }
      } catch (error) {
        console.error('Error fetching shelter pet count:', error);
        if (!cancelled) {
          setShelterPetCount(0);
        }
      } finally {
        if (!cancelled) {
          setPetCountLoading(false);
        }
      }
    };

    fetchShelterPetCount();

    return () => {
      cancelled = true;
    };
  }, [viewingShelter?.id]);

  const filteredShelters = shelters.filter((s) => {
    const q = String(searchQuery || '').trim().toLowerCase();
    if (!q) return true;
    return (
      String(s.name || '').toLowerCase().includes(q)
      || String(s.shelterType || '').toLowerCase().includes(q)
      || String(s.city || '').toLowerCase().includes(q)
      || String(s.status || '').toLowerCase().includes(q)
    );
  });

  const handleRefresh = () => {
    setRefreshing(true);
    fetchShelters();
  };

  const toggleShelterStatus = (shelter) => {
    const isActive = shelter.status === 'active';
    const action = isActive ? 'suspend' : 'activate';
    
    Alert.alert(
      `${action === 'suspend' ? 'Suspend' : 'Activate'} Shelter`,
      `Are you sure you want to ${action} ${shelter.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          style: isActive ? 'destructive' : 'default',
          onPress: async () => {
            try {
              setProcessingId(shelter.id);
              
              const batch = writeBatch(db);
              const shelterRef = doc(db, 'shelters', shelter.id);
              batch.update(shelterRef, { status: isActive ? 'suspended' : 'active' });
              
              // Only revoke manager privileges on suspension. Don't re-add since we don't track original privileges here reliably
              if (isActive && shelter.manager_id) {
                 const userRef = doc(db, 'users', shelter.manager_id);
                 batch.update(userRef, { is_shelter_manager: false });
              }
              
              await batch.commit();
              fetchShelters();
              setViewingShelter(null);
              Alert.alert('Success', `Shelter ${action}d successfully`);
            } catch (error) {
              console.error(`Error ${action}ing shelter:`, error);
              Alert.alert('Error', `Failed to ${action} shelter`);
            } finally {
              setProcessingId(null);
            }
          }
        }
      ]
    );
  };

  const openMaps = (address, city) => {
    if (!address) return;
    const query = encodeURIComponent(`${address}, ${city || ''}`);
    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      android: `geo:0,0?q=${query}`,
    });
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open maps application');
    });
  };

  const openEmail = (email) => {
    if (!email) return;
    Linking.openURL(`mailto:${email}`).catch(() => {
       Alert.alert('Error', 'Could not open mail application');
    });
  };

  const openPhone = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {
       Alert.alert('Error', 'Could not open phone application');
    });
  };

  const formatLocation = (address, city, location) => {
    const parts = [address, city, location].filter(p => p && String(p).trim().length > 0);
    return parts.length > 0 ? parts.join(', ') : 'No location provided';
  };

  const renderItem = ({ item }) => {
    const isActive = item.status === 'active';
    const dateStr = item.created_at?.toDate ? item.created_at.toDate().toLocaleDateString() : 'N/A';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            {item.image ? (
              <Image source={{ uri: normalizeImageUrl(item.image) }} style={styles.shelterAvatar} />
            ) : (
              <View style={[styles.statusIndicator, { backgroundColor: isActive ? ADMIN_COLORS.success : ADMIN_COLORS.danger }]} />
            )}
            <Text style={styles.shelterName}>{item.name}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: isActive ? '#E8FFF3' : '#FFF0E8' }]}>
             <Text style={[styles.badgeText, { color: isActive ? ADMIN_COLORS.success : ADMIN_COLORS.danger }]}>
               {isActive ? 'ACTIVE' : 'SUSPENDED'}
             </Text>
          </View>
        </View>

        <View style={styles.footerRow}>
           <View style={{ flex: 1, marginRight: 8, gap: 4 }}>
             <Text style={styles.dateText}>Type: {item.shelterType || 'N/A'}</Text>
             <Text style={styles.dateText}>Created: {dateStr}</Text>
           </View>
           <TouchableOpacity style={styles.viewBtn} onPress={() => setViewingShelter(item)}>
             <Text style={styles.viewBtnText}>Manage</Text>
             <Ionicons name="chevron-forward" size={14} color={ADMIN_COLORS.primary} />
           </TouchableOpacity>
        </View>
      </View>
    );
  };

  const selectedCapacity = Number(viewingShelter?.capacity);
  const hasSelectedCapacity = Number.isFinite(selectedCapacity) && selectedCapacity > 0;
  const occupancyPercent = hasSelectedCapacity
    ? Math.min(100, Math.round((shelterPetCount / selectedCapacity) * 100))
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
          <Ionicons name="arrow-back" size={24} color={ADMIN_COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shelter Management</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={ADMIN_COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search shelters by name..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={ADMIN_COLORS.textMuted}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ADMIN_COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredShelters}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[ADMIN_COLORS.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="business-outline" size={60} color={ADMIN_COLORS.border} />
              <Text style={styles.emptyText}>No registered shelters found.</Text>
            </View>
          }
        />
      )}

      {viewingShelter && (
        <Modal visible={!!viewingShelter} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHandleWrap}>
                <View style={styles.modalHandle} />
              </View>
              <View style={styles.modalHeader}>
                 <Text style={styles.modalTitle}>Shelter Details</Text>
                 <TouchableOpacity onPress={() => setViewingShelter(null)} style={styles.closeBtn}>
                   <Ionicons name="close" size={24} color={ADMIN_COLORS.text} />
                 </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.profileHeaderCard}>
                  {viewingShelter.image ? (
                    <Image source={{ uri: normalizeImageUrl(viewingShelter.image) }} style={styles.modalLogo} />
                  ) : (
                    <View style={styles.modalLogoPlaceholder}>
                      <Ionicons name="business" size={26} color={ADMIN_COLORS.primary} />
                    </View>
                  )}

                  <View style={styles.profileMeta}>
                    <Text style={styles.profileName}>{viewingShelter.name}</Text>
                    <Text style={styles.profileSubtext} numberOfLines={2}>
                      {formatLocation(viewingShelter.address, viewingShelter.city, viewingShelter.location)}
                    </Text>

                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: viewingShelter.status === 'active' ? '#E8FFF3' : '#FFF0E8' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          { color: viewingShelter.status === 'active' ? ADMIN_COLORS.success : ADMIN_COLORS.danger },
                        ]}
                      >
                        {viewingShelter.status === 'active' ? 'ACTIVE' : 'SUSPENDED'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.statsGrid}>
                  <View style={[styles.statCard, styles.statCardEmphasis]}>
                    <Text style={styles.statLabel}>Current Pets</Text>
                    {petCountLoading ? (
                      <ActivityIndicator size="small" color={ADMIN_COLORS.primary} style={{ marginTop: 6 }} />
                    ) : (
                      <Text style={[styles.statValue, styles.statValueEmphasis]}>{shelterPetCount}</Text>
                    )}
                  </View>

                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Capacity</Text>
                    <Text style={styles.statValue}>{viewingShelter.capacity || 'Not specified'}</Text>
                  </View>

                  <View style={[styles.statCard, styles.statCardWide]}>
                    <Text style={styles.statLabel}>Occupancy</Text>
                    <Text style={styles.statValue}>{occupancyPercent !== null ? `${occupancyPercent}%` : 'N/A'}</Text>
                    <Text style={styles.statMeta}>
                      {hasSelectedCapacity ? `${shelterPetCount} / ${selectedCapacity} pets` : 'Add capacity to compute occupancy'}
                    </Text>
                    <View style={styles.occupancyTrack}>
                      <View
                        style={[
                          styles.occupancyFill,
                          { width: occupancyPercent !== null ? `${Math.max(4, occupancyPercent)}%` : '0%' },
                        ]}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.contactCard}>
                 <TouchableOpacity style={styles.contactRow} onPress={() => openMaps(viewingShelter.address || viewingShelter.location, viewingShelter.city)}>
                     <View style={styles.contactIcon}>
                       <Ionicons name="location" size={20} color={ADMIN_COLORS.primary} />
                     </View>
                     <View style={styles.contactTextContainer}>
                       <Text style={styles.contactText}>
                         {formatLocation(viewingShelter.address, viewingShelter.city, viewingShelter.location)}
                       </Text>
                     </View>
                   </TouchableOpacity>

                   <TouchableOpacity style={styles.contactRow} onPress={() => openEmail(viewingShelter.email)}>
                     <View style={styles.contactIcon}>
                       <Ionicons name="mail" size={20} color={ADMIN_COLORS.primary} />
                     </View>
                     <View style={styles.contactTextContainer}>
                       <Text style={styles.contactText}>{viewingShelter.email}</Text>
                     </View>
                   </TouchableOpacity>

                   <TouchableOpacity style={styles.contactRow} onPress={() => openPhone(viewingShelter.phone)}>
                     <View style={styles.contactIcon}>
                       <Ionicons name="call" size={20} color={ADMIN_COLORS.primary} />
                     </View>
                     <View style={styles.contactTextContainer}>
                       <Text style={styles.contactText}>{viewingShelter.phone}</Text>
                     </View>
                   </TouchableOpacity>

                   {viewingShelter.website ? (
                     <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL(viewingShelter.website).catch(() => {})}>
                       <View style={styles.contactIcon}>
                         <Ionicons name="globe" size={20} color={ADMIN_COLORS.primary} />
                       </View>
                       <View style={styles.contactTextContainer}>
                         <Text style={styles.contactText}>{viewingShelter.website}</Text>
                       </View>
                     </TouchableOpacity>
                   ) : null}
                </View>

                <View style={styles.rowGrid}>
                  <View style={styles.gridItem}>
                    <Text style={styles.detailLabel}>Shelter Type</Text>
                    <Text style={styles.detailValue}>{viewingShelter.shelterType || 'Not specified'}</Text>
                  </View>

                  <View style={styles.gridItem}>
                    <Text style={styles.detailLabel}>Manager UID</Text>
                    <Text style={styles.detailValue} numberOfLines={1} ellipsizeMode="middle">{viewingShelter.manager_id || 'Not assigned'}</Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                   <Text style={styles.detailLabel}>Accepted Pets</Text>
                   <View style={styles.descBox}>
                     <Text style={styles.descText}>{viewingShelter.animalTypes?.join?.(', ') || 'Not specified'}</Text>
                   </View>
                </View>

                <View style={styles.detailSection}>
                   <Text style={styles.detailLabel}>Services Offered</Text>
                   <View style={styles.descBox}>
                     <Text style={styles.descText}>{viewingShelter.servicesOffered?.join?.(', ') || 'Not specified'}</Text>
                   </View>
                </View>

                {viewingShelter.bio && viewingShelter.bio.trim().length > 0 ? (
                  <View style={styles.detailSection}>
                     <Text style={styles.detailLabel}>About Us (Bio)</Text>
                     <View style={styles.descBox}>
                       <Text style={styles.descText}>{viewingShelter.bio.trim()}</Text>
                     </View>
                  </View>
                ) : null}

                {viewingShelter.description && viewingShelter.description.trim().length > 0 ? (
                  <View style={styles.detailSection}>
                     <Text style={styles.detailLabel}>Description</Text>
                     <View style={styles.descBox}>
                       <Text style={styles.descText}>{viewingShelter.description.trim()}</Text>
                     </View>
                  </View>
                ) : null}

                <TouchableOpacity 
                   style={[styles.actionBtn, { backgroundColor: viewingShelter.status === 'active' ? '#FFF0E8' : '#E8FFF3' }]}
                   onPress={() => toggleShelterStatus(viewingShelter)}
                   disabled={processingId === viewingShelter.id}
                >
                   {processingId === viewingShelter.id ? (
                     <ActivityIndicator size="small" color={viewingShelter.status === 'active' ? ADMIN_COLORS.danger : ADMIN_COLORS.success} />
                   ) : (
                     <>
                       <Ionicons 
                         name={viewingShelter.status === 'active' ? 'warning' : 'checkmark-circle'} 
                         size={20} 
                         color={viewingShelter.status === 'active' ? ADMIN_COLORS.danger : ADMIN_COLORS.success} 
                       />
                       <Text style={[styles.actionBtnText, { color: viewingShelter.status === 'active' ? ADMIN_COLORS.danger : ADMIN_COLORS.success }]}>
                         {viewingShelter.status === 'active' ? 'Suspend Shelter' : 'Re-activate Shelter'}
                       </Text>
                     </>
                   )}
                </TouchableOpacity>

                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ADMIN_COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: ADMIN_COLORS.surface,
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: ADMIN_COLORS.text,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ADMIN_COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ADMIN_COLORS.background,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: ADMIN_COLORS.text,
  },
  listContent: {
    padding: 12,
    paddingBottom: 28,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 15,
    color: ADMIN_COLORS.textMuted,
  },
  card: {
    backgroundColor: ADMIN_COLORS.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },  shelterAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    resizeMode: 'cover',
  },  shelterName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: ADMIN_COLORS.text,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: ADMIN_COLORS.textSecondary,
    marginLeft: 8,
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9', // Lighter border color for separation
  },
  dateText: {
    fontSize: 12,
    color: ADMIN_COLORS.textMuted,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 140, 66, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: ADMIN_COLORS.primary,
    marginRight: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: ADMIN_COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 8,
    maxHeight: '90%',
  },
  modalHandleWrap: {
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 8,
  },
  modalHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalLogo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 12,
    resizeMode: 'cover',
  },
  modalLogoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF2E8',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: ADMIN_COLORS.text,
  },
  closeBtn: {
    padding: 4,
    backgroundColor: ADMIN_COLORS.background,
    borderRadius: 20,
  },
  modalBody: {
    paddingBottom: 20,
  },
  profileHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8F2',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FFE7D6',
  },
  profileMeta: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
    marginBottom: 2,
  },
  profileSubtext: {
    fontSize: 13,
    color: ADMIN_COLORS.textSecondary,
    marginBottom: 8,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: ADMIN_COLORS.background,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    flexBasis: '48%',
  },
  statCardWide: {
    flexBasis: '100%',
  },
  statCardEmphasis: {
    backgroundColor: '#FFF4EA',
    borderColor: '#FFD9BF',
  },
  statLabel: {
    fontSize: 12,
    color: ADMIN_COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
  },
  statValueEmphasis: {
    color: ADMIN_COLORS.primary,
  },
  statMeta: {
    marginTop: 4,
    fontSize: 12,
    color: ADMIN_COLORS.textSecondary,
  },
  occupancyTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    marginTop: 8,
    overflow: 'hidden',
  },
  occupancyFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: ADMIN_COLORS.primary,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: ADMIN_COLORS.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 15,
    color: ADMIN_COLORS.text,
  },
  contactCard: {
    backgroundColor: ADMIN_COLORS.background,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  contactIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ADMIN_COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactTextContainer: {
    flex: 1,
  },
  contactText: {
    fontSize: 14,
    color: ADMIN_COLORS.text,
    fontWeight: '500',
  },
  rowGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  gridItem: {
    flex: 1,
  },
  descBox: {
    backgroundColor: ADMIN_COLORS.background,
    padding: 16,
    borderRadius: 12,
  },
  descText: {
    fontSize: 14,
    color: ADMIN_COLORS.textSecondary,
    lineHeight: 22,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
});

export default AdminShelterManagementScreen;