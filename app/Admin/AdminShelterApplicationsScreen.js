import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDocs, orderBy, query, writeBatch } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import { db } from '../../firebaseConfig';
import { normalizeImageUrl } from '../../utils/imageUrl';

const AdminShelterApplicationsScreen = ({ onGoBack }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [viewingApp, setViewingApp] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const statusPalette = {
    pending: { bg: '#FFF8E1', text: '#F59E0B' },
    approved: { bg: '#E8FFF3', text: '#10B981' },
    rejected: { bg: '#FFEBEE', text: '#EF4444' },
  };

  const fetchApplications = async () => {
    try {
      const q = query(collection(db, 'shelter_applications'), orderBy('created_at', 'desc'));
      const querySnapshot = await getDocs(q);
      const apps = [];
      querySnapshot.forEach((doc) => {
        apps.push({ id: doc.id, ...doc.data() });
      });
      setApplications(apps);
    } catch (error) {
      console.error('Error fetching shelter applications:', error);
      Alert.alert('Error', 'Failed to load shelter applications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const filteredApplications = applications.filter((app) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      String(app.name || '').toLowerCase().includes(q)
      || String(app.email || '').toLowerCase().includes(q)
      || String(app.status || '').toLowerCase().includes(q)
      || String(app.city || '').toLowerCase().includes(q)
    );
  });

  const handleRefresh = () => {
    setRefreshing(true);
    fetchApplications();
  };

  const approveApplication = async (app) => {
    Alert.alert(
      'Approve Application',
      `Are you sure you want to approve ${app.name}? This will grant them shelter manager privileges.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            try {
              setProcessingId(app.id);
              const batch = writeBatch(db);

              // 1. Update application status
              const appRef = doc(db, 'shelter_applications', app.id);
              batch.update(appRef, { status: 'approved', processed_at: new Date() });

              // 2. Create the actual shelter profile
              const shelterRef = doc(collection(db, 'shelters'));
              batch.set(shelterRef, {
                name: app.name,
                shelterType: app.shelterType || '',
                email: app.email,
                phone: app.phone,
                address: app.address || '',
                city: app.city || '',
                location: app.location || '',
                image: app.image || null,
                latitude: app.latitude || null,
                longitude: app.longitude || null,
                description: app.description,
                capacity: app.capacity,
                website: app.website || '',                  animalTypes: app.animalTypes || [],
                  servicesOffered: app.servicesOffered || [],                manager_id: app.user_id,
                created_at: new Date(),
                status: 'active'
              });

              // 3. Update user to be a shelter manager
              const userRef = doc(db, 'users', app.user_id);
              batch.update(userRef, { is_shelter_manager: true });

              // 4. Send notification
              const notificationRef = doc(collection(db, 'notifications'));
              batch.set(notificationRef, {
                user_id: app.user_id,
                title: 'Application Approved',
                message: `Congratulations! Your shelter application for ${app.name} has been approved. You are now a Shelter Manager.`,
                read: false,
                created_at: new Date()
              });

              await batch.commit();

              Alert.alert('Success', 'Shelter application approved!');
              fetchApplications();
            } catch (error) {
              console.error('Error approving application:', error);
              Alert.alert('Error', 'Failed to approve application');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const rejectApplication = (app) => {
    Alert.alert(
      'Reject Application',
      `Are you sure you want to reject ${app.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessingId(app.id);
              const batch = writeBatch(db);
              
              const appRef = doc(db, 'shelter_applications', app.id);
              batch.update(appRef, { status: 'rejected', processed_at: new Date() });
              
              const notificationRef = doc(collection(db, 'notifications'));
              batch.set(notificationRef, {
                user_id: app.user_id,
                title: 'Application Rejected',
                message: `Unfortunately, your shelter application for ${app.name} has been rejected.`,
                read: false,
                created_at: new Date()
              });
              
              await batch.commit();
              Alert.alert('Success', 'Shelter application rejected.');
              fetchApplications();
            } catch (error) {
              console.error('Error rejecting application:', error);
              Alert.alert('Error', 'Failed to reject application');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const formatLocation = (address, city, location) => {
    const parts = [address, city, location].filter(p => p && String(p).trim().length > 0);
    return parts.length > 0 ? parts.join(', ') : 'No location provided';
  };

  const renderApplication = ({ item }) => {
    const isPending = item.status === 'pending';
    const status = String(item.status || 'pending').toLowerCase();
    const palette = statusPalette[status] || statusPalette.pending;
    const dateStr = item.created_at?.toDate ? item.created_at.toDate().toLocaleDateString() : 'N/A';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 }}>
            {item.image ? (
              <Image source={{ uri: normalizeImageUrl(item.image) }} style={styles.shelterAvatar} />
            ) : null}
            <Text style={styles.shelterName} numberOfLines={1}>{item.name}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: palette.bg }]}>
            <Text style={[styles.statusText, { color: palette.text }]}>
              {status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="mail" size={16} color={COLORS.textMedium} />
          <Text style={styles.infoText}>{item.email}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="call" size={16} color={COLORS.textMedium} />
          <Text style={styles.infoText}>{item.phone}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="business" size={16} color={COLORS.textMedium} />
          <Text style={styles.infoText}>Type: {item.shelterType || 'N/A'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="location" size={16} color={COLORS.textMedium} />
          <Text style={styles.infoText}>
            {formatLocation(item.address, item.city, item.location)}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="people" size={16} color={COLORS.textMedium} />
          <Text style={styles.infoText}>Capacity: {item.capacity}</Text>
        </View>

        <View style={styles.descriptionBox}>
          <Text style={styles.descriptionLabel}>Description:</Text>
          <Text style={styles.descriptionText} numberOfLines={2}>{item.description}</Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>Applied: {dateStr}</Text>
          <TouchableOpacity onPress={() => setViewingApp(item)}>
            <Text style={styles.viewLink}>View Full Info</Text>
          </TouchableOpacity>
        </View>

        {isPending && (
          <View style={styles.actions}>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.rejectBtn]} 
              onPress={() => rejectApplication(item)}
              disabled={processingId === item.id}
            >
              <Text style={styles.rejectText}>Reject</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionBtn, styles.approveBtn]} 
              onPress={() => approveApplication(item)}
              disabled={processingId === item.id}
            >
              {processingId === item.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.approveText}>Approve</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        {!isSearching ? (
          <>
            <Text style={styles.headerTitle}>Shelter Applications</Text>
            <TouchableOpacity onPress={() => setIsSearching(true)} style={styles.searchButton}>
              <Ionicons name="search" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by shelter, email, city, or status..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            <TouchableOpacity onPress={() => { setIsSearching(false); setSearchQuery(''); }}>
              <Ionicons name="close-circle" size={24} color={COLORS.textMedium} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredApplications}
          renderItem={renderApplication}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={60} color={COLORS.borderLight} />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No matching shelter applications found.' : 'No shelter applications found.'}
              </Text>
            </View>
          }
        />
      )}

      {viewingApp && (
        <Modal visible={!!viewingApp} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHandleWrap}>
                <View style={styles.modalHandle} />
              </View>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Application Details</Text>
                <TouchableOpacity onPress={() => setViewingApp(null)}>
                  <Ionicons name="close" size={24} color={COLORS.textDark} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
                {viewingApp.image ? (
                  <View style={{ alignItems: 'center', marginBottom: SPACING.md }}>
                    <Image source={{ uri: normalizeImageUrl(viewingApp.image) }} style={{ width: 100, height: 100, borderRadius: 50, resizeMode: 'cover', borderWidth: 2, borderColor: COLORS.primary }} />
                  </View>
                ) : null}

                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>General Information</Text>
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.modalLabel}>Shelter Name</Text>
                    <Text style={styles.modalValue}>{viewingApp.name || 'N/A'}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.modalLabel}>Shelter Type</Text>
                    <Text style={styles.modalValue}>{viewingApp.shelterType || 'N/A'}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.modalLabel}>User Email</Text>
                    <Text style={styles.modalValue}>{viewingApp.email || 'N/A'}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.modalLabel}>Phone Number</Text>
                    <Text style={styles.modalValue}>{viewingApp.phone || 'N/A'}</Text>
                  </View>

                  {!!viewingApp.website && (
                    <View style={styles.detailRow}>
                      <Text style={styles.modalLabel}>Website</Text>
                      <Text style={styles.modalValue}>{viewingApp.website}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Location Details</Text>

                  <View style={styles.detailRow}>
                    <Text style={styles.modalLabel}>Address</Text>
                    <Text style={styles.modalValue}>
                      {formatLocation(viewingApp.address, viewingApp.city, viewingApp.location)}
                    </Text>
                  </View>
                </View>

                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Facility & Services</Text>

                  <View style={styles.detailRow}>
                    <Text style={styles.modalLabel}>Capacity</Text>
                    <Text style={styles.modalValue}>{viewingApp.capacity || '0'}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.modalLabel}>Animal Types</Text>
                    <Text style={styles.modalValue}>{viewingApp.animalTypes?.join?.(', ') || 'N/A'}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.modalLabel}>Services Offered</Text>
                    <Text style={styles.modalValue}>{viewingApp.servicesOffered?.join?.(', ') || 'N/A'}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.modalLabel}>Description</Text>
                    <Text style={styles.modalValue}>{viewingApp.description || 'No description provided.'}</Text>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingTop: 56,
    backgroundColor: COLORS.backgroundWhite,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    height: 40,
    marginLeft: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark,
    paddingVertical: 0,
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  card: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  shelterName: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    flex: 1,
    marginRight: SPACING.sm,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.round,
  },
  statusText: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xs, gap: SPACING.xs },
  infoText: { fontSize: FONTS.sizes.sm, color: COLORS.textMedium, flex: 1 },
  descriptionBox: { backgroundColor: COLORS.background, padding: SPACING.md, borderRadius: RADIUS.sm, marginVertical: SPACING.sm },
  descriptionLabel: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold, color: COLORS.textMedium, marginBottom: 4 },
  descriptionText: { fontSize: FONTS.sizes.sm, color: COLORS.textDark, fontStyle: 'italic' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.sm },
  dateText: { fontSize: FONTS.sizes.xs, color: COLORS.textMedium },
  viewLink: { fontSize: FONTS.sizes.sm, color: COLORS.primary, fontWeight: FONTS.weights.semiBold },
  actions: { flexDirection: 'row', marginTop: SPACING.md, gap: SPACING.sm },
  actionBtn: { flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FECACA' },
  rejectText: { color: '#EF4444', fontWeight: FONTS.weights.bold, fontSize: FONTS.sizes.sm },
  approveBtn: { backgroundColor: '#10B981' },
  approveText: { color: '#FFFFFF', fontWeight: FONTS.weights.bold, fontSize: FONTS.sizes.sm },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { marginTop: SPACING.md, color: COLORS.textMedium, fontSize: FONTS.sizes.md },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, height: '85%', paddingBottom: SPACING.xl },
  modalHandleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  modalHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  modalTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.textDark },
  modalBody: { flex: 1 },
  modalScrollContent: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.xxl },
  sectionContainer: { marginBottom: SPACING.lg, backgroundColor: COLORS.backgroundWhite, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderLight },
  sectionTitle: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, color: COLORS.primary, marginBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, paddingBottom: SPACING.xs },
  detailRow: { marginBottom: SPACING.md },
  modalLabel: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold, color: COLORS.textMedium, textTransform: 'uppercase', marginBottom: 4 },
  modalValue: { fontSize: FONTS.sizes.md, color: COLORS.textDark, lineHeight: 22 },
});

export default AdminShelterApplicationsScreen;
