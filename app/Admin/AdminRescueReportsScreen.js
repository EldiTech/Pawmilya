import { Ionicons } from '@expo/vector-icons';
import { collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
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
import { isRescueCompletedStatus, normalizeRescueStatus } from '../../utils/status';
import { ADMIN_COLORS } from './shared';

const STATUS_COLORS = {
  active: { bg: '#FFF3E0', text: '#F57C00' },
  pending: { bg: '#FFF3E0', text: '#F57C00' },
  in_progress: { bg: '#E3F2FD', text: '#1976D2' },
  pending_verification: { bg: '#FEF3C7', text: '#B45309' },
  rescued: { bg: '#DCFCE7', text: '#166534' },
  cannot_complete: { bg: '#FEE2E2', text: '#B91C1C' },
};

const STATUS_LABELS = {
  active: 'ACTIVE',
  pending: 'PENDING',
  in_progress: 'IN PROGRESS',
  pending_verification: 'PENDING VERIFY',
  rescued: 'RESCUED',
  cannot_complete: 'CANNOT COMPLETE',
};

const AdminRescueReportsScreen = ({ onGoBack }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewingReport, setViewingReport] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const pendingVerificationCount = useMemo(
    () => reports.filter((item) => normalizeRescueStatus(item.status) === 'pending_verification').length,
    [reports]
  );

  const rescuedCount = useMemo(
    () => reports.filter((item) => normalizeRescueStatus(item.status) === 'rescued').length,
    [reports]
  );

  const fetchReports = async () => {
    try {
      const q = query(collection(db, 'rescue_reports'), orderBy('created_at', 'desc'));
      const snapshot = await getDocs(q);
      const data = [];
      snapshot.forEach(doc => {
        const raw = doc.data() || {};
        data.push({
          id: doc.id,
          ...raw,
          status: normalizeRescueStatus(raw.status),
        });
      });
      setReports(data);
    } catch (error) {
      console.error('Error fetching reports:', error);
      Alert.alert('Error', 'Failed to load rescue reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReports();
  };

  const deleteReport = async (report) => {
    Alert.alert(
      'Delete Report',
      'Are you sure you want to delete this rescue report? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessingId(`delete_${report.id}`);
              await deleteDoc(doc(db, 'rescue_reports', report.id));
              Alert.alert('Success', 'Report deleted successfully');
              setViewingReport(null);
              fetchReports();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete report');
            } finally {
              setProcessingId(null);
            }
          }
        }
      ]
    );
  };

  const updateStatus = async (report, newStatus) => {
    const normalizedStatus = normalizeRescueStatus(newStatus);

    Alert.alert(
      'Update Status',
      `Mark this report as ${normalizedStatus.replace('_', ' ')}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setProcessingId(report.id);
              const ref = doc(db, 'rescue_reports', report.id);
              const rescuerId = String(
                report?.rescuer_id
                ?? report?.assigned_rescuer_id
                ?? report?.rescuer_uid
                ?? ''
              ).trim();
              const reporterId = String(
                report?.reporter_id
                ?? report?.reporter_uid
                ?? report?.user_id
                ?? report?.created_by
                ?? ''
              ).trim();
              const previousStatus = normalizeRescueStatus(report?.status);
              const patch = {
                status: normalizedStatus,
                updated_at: serverTimestamp(),
              };

              if (isRescueCompletedStatus(normalizedStatus)) {
                patch.verified_at = serverTimestamp();
                patch.verification_notes = report?.completion_notes || 'Verified by admin.';
                patch.verified_rescuer_id = rescuerId || null;
              }

              await updateDoc(ref, patch);

              const wasPendingVerification = normalizeRescueStatus(report?.status) === 'pending_verification';
              if (wasPendingVerification && isRescueCompletedStatus(normalizedStatus) && rescuerId) {
                const notificationRef = doc(collection(db, 'notifications'));
                await setDoc(notificationRef, {
                  user_id: rescuerId,
                  title: 'Rescue Proof Verified',
                  message: `Admin verified your rescue proof for "${report?.title || `Report #${report.id}`}". Great work!`,
                  type: 'rescue_verification_approved',
                  rescue_report_id: report.id,
                  read: false,
                  created_at: serverTimestamp(),
                });
              }

              const becameCompleted = !isRescueCompletedStatus(previousStatus) && isRescueCompletedStatus(normalizedStatus);
              if (becameCompleted && reporterId) {
                const notificationRef = doc(collection(db, 'notifications'));
                await setDoc(notificationRef, {
                  user_id: reporterId,
                  title: 'Your Report Has Been Rescued',
                  message: `Good news! "${report?.title || `Report #${report.id}`}" has been marked as rescued. Thank you for reporting and helping save a life.`,
                  type: 'rescue_report_rescued',
                  rescue_report_id: report.id,
                  read: false,
                  created_at: serverTimestamp(),
                });
              }

              Alert.alert('Success', 'Status updated successfully');
              setViewingReport(prev => prev ? { ...prev, status: normalizedStatus } : null);
              fetchReports();
            } catch (error) {
              Alert.alert('Error', 'Failed to update status');
            } finally {
              setProcessingId(null);
            }
          }
        }
      ]
    );
  };

  const openRejectVerificationModal = (report) => {
    setViewingReport(report);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  const submitRejectVerification = async () => {
    if (!viewingReport) {
      return;
    }

    const reason = rejectReason.trim();
    if (!reason) {
      Alert.alert('Required', 'Please provide a rejection reason.');
      return;
    }

    try {
      setProcessingId(`reject_${viewingReport.id}`);

      const reportRef = doc(db, 'rescue_reports', viewingReport.id);
      await updateDoc(reportRef, {
        status: 'active',
        rescuer_id: null,
        accepted_at: null,
        completion_photo: null,
        completion_notes: null,
        verification_notes: `Verification rejected: ${reason}`,
        verification_rejection_reason: reason,
        verification_rejected_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      if (viewingReport.rescuer_id) {
        const notificationRef = doc(collection(db, 'notifications'));
        await setDoc(notificationRef, {
          user_id: String(viewingReport.rescuer_id),
          title: 'Rescue Verification Rejected',
          message: `Your submitted rescue for "${viewingReport.title || `Report #${viewingReport.id}`}" was rejected. Reason: ${reason}. The report has been reopened for rescue.`,
          type: 'rescue_verification_rejected',
          rescue_report_id: viewingReport.id,
          read: false,
          created_at: serverTimestamp(),
        });
      }

      Alert.alert('Rejected', 'Verification rejected. The rescue has been reopened for other rescuers.');
      setRejectModalVisible(false);
      setRejectReason('');
      setViewingReport((prev) => prev ? {
        ...prev,
        status: 'active',
        rescuer_id: null,
        completion_photo: null,
        completion_notes: null,
      } : null);
      fetchReports();
    } catch (error) {
      console.error('Reject verification error:', error);
      Alert.alert('Error', 'Failed to reject verification. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const openMaps = (location) => {
    if (!location) return;
    const query = encodeURIComponent(location);
    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      android: `geo:0,0?q=${query}`,
    });
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open maps application');
    });
  };

  const openPhone = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {
       Alert.alert('Error', 'Could not open phone application');
    });
  };

  const renderItem = ({ item }) => {
    const dateStr = item.created_at?.toDate ? item.created_at.toDate().toLocaleDateString() : 'N/A';
    const normalizedStatus = normalizeRescueStatus(item.status);
    const styleObj = STATUS_COLORS[normalizedStatus] || STATUS_COLORS.active;

    const urgency = item.urgency ? item.urgency.charAt(0).toUpperCase() + item.urgency.slice(1) : 'Normal';
    const animalType = item.animalType || item.animal_type || 'Unknown';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            <View style={[styles.statusIndicator, { backgroundColor: styleObj.text }]} />
            <Text style={styles.reportTitle} numberOfLines={1}>{item.title}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: styleObj.bg }]}>
             <Text style={[styles.badgeText, { color: styleObj.text }]} numberOfLines={1}>
               {STATUS_LABELS[normalizedStatus] || 'ACTIVE'}
             </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="location" size={16} color="#9CA3AF" />
          <Text style={styles.infoText} numberOfLines={1}>{item.location || item.location_description || item.city || 'Unknown Location'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="paw" size={16} color="#9CA3AF" />
          <Text style={styles.infoText} numberOfLines={1}>
            <Text style={{fontWeight: '400', textTransform: 'capitalize'}}>{animalType}</Text> - {urgency} Urgency
          </Text>
        </View>

        <View style={styles.footerLine} />
        
        <View style={styles.footerRow}>
           <Text style={styles.dateText}>Created: {dateStr}</Text>
           <TouchableOpacity
             style={[
               styles.viewBtn,
               normalizedStatus === 'pending_verification' && styles.verifyNowBtn,
             ]}
             onPress={() => setViewingReport(item)}
           >
             <Text
               style={[
                 styles.viewBtnText,
                 normalizedStatus === 'pending_verification' && styles.verifyNowBtnText,
               ]}
             >
               {normalizedStatus === 'pending_verification' ? 'Review Proof' : 'Manage'}
             </Text>
             <Ionicons name="chevron-forward" size={14} color="#F57C00" />
           </TouchableOpacity>
        </View>
      </View>
    );
  };

  const filteredReports = useMemo(() => {
    let sourceReports = reports;

    if (activeFilter === 'pending') {
      sourceReports = reports.filter((item) => normalizeRescueStatus(item.status) === 'pending_verification');
    } else if (activeFilter === 'rescued') {
      sourceReports = reports.filter((item) => normalizeRescueStatus(item.status) === 'rescued');
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return sourceReports;

    return sourceReports.filter((item) => {
      const normalizedStatus = normalizeRescueStatus(item.status);
      const fields = [
        item.title,
        item.location,
        item.location_description,
        item.city,
        item.animalType,
        item.animal_type,
        item.urgency,
        normalizedStatus,
      ]
        .map((value) => String(value || '').toLowerCase());

      return fields.some((value) => value.includes(q));
    });
  }, [activeFilter, reports, searchQuery]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rescue Reports</Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search reports"
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
          autoCapitalize="none"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, activeFilter === 'all' && styles.filterChipActive]}
          onPress={() => setActiveFilter('all')}
        >
          <Text numberOfLines={1} style={[styles.filterChipText, activeFilter === 'all' && styles.filterChipTextActive]}>All Reports ({reports.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, activeFilter === 'pending' && styles.filterChipActive]}
          onPress={() => setActiveFilter('pending')}
        >
          <Text numberOfLines={1} style={[styles.filterChipText, activeFilter === 'pending' && styles.filterChipTextActive]}>Pending  ({pendingVerificationCount})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, activeFilter === 'rescued' && styles.filterChipActive]}
          onPress={() => setActiveFilter('rescued')}
        >
          <Text numberOfLines={1} style={[styles.filterChipText, activeFilter === 'rescued' && styles.filterChipTextActive]}>Rescued ({rescuedCount})</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ADMIN_COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredReports}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[ADMIN_COLORS.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="medkit-outline" size={60} color={ADMIN_COLORS.border} />
              <Text style={styles.emptyText}>
                {searchQuery
                  ? 'No reports match your search.'
                  : (activeFilter === 'pending'
                    ? 'No pending verifications found.'
                    : activeFilter === 'rescued'
                      ? 'No verified rescued reports found.'
                      : 'No rescue reports found.')}
              </Text>
            </View>
          }
        />
      )}

      {viewingReport && (
        <Modal visible={!!viewingReport} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                 <Text style={styles.modalTitle}>Report Details</Text>
                 <TouchableOpacity onPress={() => setViewingReport(null)} style={styles.closeBtn}>
                   <Ionicons name="close" size={24} color={ADMIN_COLORS.textSecondary} />
                 </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {viewingReport.images && viewingReport.images.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                    {viewingReport.images.map((img, i) => (
                      <View key={i} style={styles.imageWrapper}>
                         <Image source={{ uri: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}` }} style={styles.reportImage} />
                      </View>
                    ))}
                  </ScrollView>
                )}

                <View style={styles.detailSection}>
                   <Text style={styles.detailLabel}>Title</Text>
                   <Text style={styles.detailValue}>{viewingReport.title}</Text>
                </View>

                <View style={styles.detailSection}>
                   <Text style={styles.detailLabel}>Animal Type</Text>
                   <Text style={[styles.detailValue, {textTransform: 'capitalize'}]}>{viewingReport.animalType}</Text>
                </View>

                <View style={styles.detailSection}>
                   <Text style={styles.detailLabel}>Urgency</Text>
                   <Text style={[styles.detailValue, {textTransform: 'capitalize'}]}>{viewingReport.urgency}</Text>
                </View>

                <View style={styles.detailSection}>
                   <Text style={styles.detailLabel}>Description</Text>
                   <Text style={styles.detailValue}>{viewingReport.description}</Text>
                </View>

                {viewingReport.status === 'pending_verification' && (
                  <>
                    <Text style={styles.sectionHeader}>Verification Submission</Text>

                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Rescuer Notes</Text>
                      <Text style={styles.detailValue}>
                        {viewingReport.completion_notes || 'No notes submitted.'}
                      </Text>
                    </View>

                    {viewingReport.completion_photo ? (
                      <View style={styles.verificationProofCard}>
                        <Text style={styles.detailLabel}>Proof Photo</Text>
                        <Image
                          source={{
                            uri: String(viewingReport.completion_photo).startsWith('data:') || String(viewingReport.completion_photo).startsWith('http')
                              ? viewingReport.completion_photo
                              : `data:image/jpeg;base64,${viewingReport.completion_photo}`,
                          }}
                          style={styles.verificationProofImage}
                        />
                      </View>
                    ) : (
                      <View style={styles.verificationMissingProof}>
                        <Ionicons name="warning-outline" size={18} color="#B45309" />
                        <Text style={styles.verificationMissingProofText}>No proof photo attached.</Text>
                      </View>
                    )}
                  </>
                )}

                <TouchableOpacity style={styles.actionRow} onPress={() => openMaps(viewingReport.location)}>
                   <View style={styles.actionRowLeft}>
                     <Ionicons name="location" size={20} color={ADMIN_COLORS.primary} />
                     <Text style={styles.actionRowText}>{viewingReport.location}</Text>
                   </View>
                   <Ionicons name="open-outline" size={20} color={ADMIN_COLORS.textMuted} />
                </TouchableOpacity>

                <Text style={styles.sectionHeader}>Reporter Info</Text>
                <View style={styles.detailSection}>
                   <Text style={styles.detailLabel}>Name</Text>
                   <Text style={styles.detailValue}>{viewingReport.reporter_name || 'Anonymous'}</Text>
                </View>
                
                {viewingReport.reporter_phone ? (
                  <TouchableOpacity style={styles.actionRow} onPress={() => openPhone(viewingReport.reporter_phone)}>
                    <View style={styles.actionRowLeft}>
                      <Ionicons name="call" size={20} color={ADMIN_COLORS.primary} />
                      <Text style={styles.actionRowText}>{viewingReport.reporter_phone}</Text>
                    </View>
                    <Ionicons name="open-outline" size={20} color={ADMIN_COLORS.textMuted} />
                  </TouchableOpacity>
                ) : null}

                <View style={styles.actionButtonsContainer}>
                   {normalizeRescueStatus(viewingReport.status) === 'pending_verification' && (
                     <>
                       <TouchableOpacity
                         style={[styles.statusButton, styles.verifyButton]}
                         onPress={() => updateStatus(viewingReport, 'rescued')}
                         disabled={processingId === viewingReport.id}
                       >
                         {processingId === viewingReport.id ? (
                           <ActivityIndicator size="small" color="#FFF" />
                         ) : (
                           <Text style={styles.statusButtonText}>Verify Rescue</Text>
                         )}
                       </TouchableOpacity>

                       <TouchableOpacity
                         style={[styles.statusButton, styles.rejectVerificationButton]}
                         onPress={() => openRejectVerificationModal(viewingReport)}
                         disabled={processingId === `reject_${viewingReport.id}`}
                       >
                         {processingId === `reject_${viewingReport.id}` ? (
                           <ActivityIndicator size="small" color="#FFF" />
                         ) : (
                           <Text style={styles.statusButtonText}>Reject Rescue</Text>
                         )}
                       </TouchableOpacity>
                     </>
                   )}

                   {normalizeRescueStatus(viewingReport.status) !== 'in_progress' && !isRescueCompletedStatus(viewingReport.status) && (
                     <TouchableOpacity 
                       style={[styles.statusButton, { backgroundColor: '#1976D2' }]} 
                       onPress={() => updateStatus(viewingReport, 'in_progress')}
                       disabled={processingId === viewingReport.id}
                     >
                       {processingId === viewingReport.id ? (
                         <ActivityIndicator size="small" color="#FFF" />
                       ) : (
                         <Text style={styles.statusButtonText}>Mark In Progress</Text>
                       )}
                     </TouchableOpacity>
                   )}

                   {!isRescueCompletedStatus(viewingReport.status) && (
                     <TouchableOpacity 
                       style={[styles.statusButton, { backgroundColor: '#388E3C' }]} 
                       onPress={() => updateStatus(viewingReport, 'rescued')}
                       disabled={processingId === viewingReport.id}
                     >
                       <Text style={styles.statusButtonText}>Mark as Rescued</Text>
                     </TouchableOpacity>
                   )}

                   <TouchableOpacity 
                     style={[styles.statusButton, { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#EF4444' }]} 
                     onPress={() => deleteReport(viewingReport)}
                     disabled={processingId === `delete_${viewingReport.id}`}
                   >
                     {processingId === `delete_${viewingReport.id}` ? (
                       <ActivityIndicator size="small" color="#EF4444" />
                     ) : (
                       <Text style={[styles.statusButtonText, { color: '#EF4444' }]}>Delete Report</Text>
                     )}
                   </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      <Modal visible={rejectModalVisible} transparent animationType="fade">
        <View style={styles.rejectModalOverlay}>
          <View style={styles.rejectModalCard}>
            <Text style={styles.rejectModalTitle}>Reject Verification</Text>
            <Text style={styles.rejectModalSubtitle}>
              Add a reason. This will notify the rescuer and reopen the report for others.
            </Text>

            <TextInput
              style={styles.rejectInput}
              placeholder="Enter rejection reason"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              value={rejectReason}
              onChangeText={setRejectReason}
              textAlignVertical="top"
            />

            <View style={styles.rejectActionsRow}>
              <TouchableOpacity
                style={styles.rejectCancelBtn}
                onPress={() => {
                  setRejectModalVisible(false);
                  setRejectReason('');
                }}
              >
                <Text style={styles.rejectCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.rejectConfirmBtn}
                onPress={submitRejectVerification}
                disabled={processingId === `reject_${viewingReport?.id}`}
              >
                {processingId === `reject_${viewingReport?.id}` ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.statusButtonText}>Confirm Reject</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB', // matched light background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? 44 : 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginRight: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchWrap: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    minHeight: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    marginLeft: 8,
    paddingVertical: 8,
  },
  clearSearchBtn: {
    paddingLeft: 6,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  filterChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },
  filterChipTextActive: {
    color: '#92400E',
  },
  listContent: {
    padding: 12,
    paddingBottom: 100,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: ADMIN_COLORS.textMuted,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  badge: {
    maxWidth: 138,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#4B5563',
    flex: 1,
  },
  footerLine: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginTop: 8,
    marginBottom: 10,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4ED',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
  },
  viewBtnText: {
    color: '#F57C00',
    fontSize: 13,
    fontWeight: '700',
    marginRight: 5,
  },
  verifyNowBtn: {
    backgroundColor: '#FEF3C7',
  },
  verifyNowBtnText: {
    color: '#B45309',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: ADMIN_COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 56,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#D1D5DB',
    marginTop: 10,
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: ADMIN_COLORS.text,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  imageScroll: {
    marginBottom: 20,
  },
  imageWrapper: {
    width: 200,
    height: 150,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  reportImage: {
    width: '100%',
    height: '100%',
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: ADMIN_COLORS.text,
    marginTop: 20,
    marginBottom: 12,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 13,
    color: ADMIN_COLORS.textMuted,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    color: ADMIN_COLORS.text,
    lineHeight: 22,
  },
  verificationProofCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 12,
  },
  verificationProofImage: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    marginTop: 8,
    backgroundColor: '#F3F4F6',
  },
  verificationMissingProof: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  verificationMissingProofText: {
    marginLeft: 8,
    color: '#92400E',
    fontSize: 14,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: ADMIN_COLORS.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  actionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  actionRowText: {
    marginLeft: 12,
    fontSize: 15,
    color: ADMIN_COLORS.text,
    flex: 1,
  },
  actionButtonsContainer: {
    marginTop: 24,
    gap: 12,
  },
  statusButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyButton: {
    backgroundColor: '#059669',
  },
  rejectVerificationButton: {
    backgroundColor: '#DC2626',
  },
  rejectModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  rejectModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  rejectModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  rejectModalSubtitle: {
    marginTop: 6,
    marginBottom: 12,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  rejectInput: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FAFAFA',
  },
  rejectActionsRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  rejectCancelBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  rejectCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  rejectConfirmBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
  },
  statusButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AdminRescueReportsScreen;