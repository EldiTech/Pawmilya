import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import { db } from '../../firebaseConfig';

const STATUS_COLORS = {
  pending: { bg: '#FFF8E1', text: '#F59E0B' },
  approved: { bg: '#E8FFF3', text: '#10B981' },
  rejected: { bg: '#FFEBEE', text: '#EF4444' },
  revoked: { bg: '#F1F5F9', text: '#64748B' },
};

const titleCase = (value) => {
  const safe = String(value || '');
  return safe
    .split('_')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
    .join(' ');
};

const TRANSFER_STATUSES = new Set(['pending', 'approved', 'rejected', 'in_transit', 'arrived_at_shelter', 'completed']);

const getLogWorkflow = (item) => {
  const explicitWorkflow = String(item?.workflow_type || '').toLowerCase();
  if (explicitWorkflow === 'shelter_transfer' || explicitWorkflow === 'rescue_verification' || explicitWorkflow === 'rescue_mission') {
    return explicitWorkflow === 'rescue_verification' ? 'rescue_mission' : explicitWorkflow;
  }

  const status = String(item?.status || '').toLowerCase();
  const eventType = String(item?.event_type || '').toLowerCase();
  const title = String(item?.title || '').toLowerCase();
  const description = String(item?.description || item?.notes || '').toLowerCase();
  const textBlob = `${title} ${description}`;

  if (
    eventType.includes('transfer') ||
    TRANSFER_STATUSES.has(status) ||
    textBlob.includes('transfer') ||
    textBlob.includes('shelter') ||
    textBlob.includes('turnover') ||
    textBlob.includes('in transit')
  ) {
    return 'shelter_transfer';
  }

  return 'rescue_mission';
};

const getGroupWorkflow = (entries = []) => {
  const hasTransferFlow = entries.some((entry) => getLogWorkflow(entry) === 'shelter_transfer');
  return hasTransferFlow ? 'shelter_transfer' : 'rescue_mission';
};

const getStatusPresentation = (item, workflowOverride = '') => {
  const status = String(item?.status || '').toLowerCase();
  const workflow = workflowOverride || getLogWorkflow(item);

  if (status === 'pending_verification') {
    return {
      label: workflow === 'shelter_transfer' ? 'Transfer Workflow Pending' : 'Admin Verification Pending',
      bg: '#FEF3C7',
      text: '#B45309',
    };
  }

  if (workflow === 'shelter_transfer') {
    if (status === 'pending') return { label: 'Shelter Review Pending', bg: '#FEF3C7', text: '#B45309' };
    if (status === 'approved') return { label: 'Shelter Approved', bg: '#E8FFF3', text: '#0F9F6E' };
    if (status === 'rejected') return { label: 'Shelter Rejected', bg: '#FEE2E2', text: '#B91C1C' };
    if (status === 'in_transit') return { label: 'To Shelter', bg: '#DBEAFE', text: '#1D4ED8' };
    if (status === 'arrived_at_shelter') return { label: 'Arrived At Shelter', bg: '#EDE9FE', text: '#6D28D9' };
    if (status === 'completed') return { label: 'Turnover Complete', bg: '#DCFCE7', text: '#166534' };
  }

  const fallback = STATUS_COLORS[status] || { bg: '#F1F5F9', text: '#475569' };
  return {
    label: titleCase(status || 'unknown'),
    bg: fallback.bg,
    text: fallback.text,
  };
};

const AdminRescuerApplicationsScreen = ({ onGoBack }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [viewingApp, setViewingApp] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [viewingLogs, setViewingLogs] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [rescueTitleById, setRescueTitleById] = useState({});

  const fetchApplications = async () => {
    try {
      const appsQuery = query(collection(db, 'rescuer_applications'), orderBy('created_at', 'desc'));
      const snapshot = await getDocs(appsQuery);
      const list = snapshot.docs.map((applicationDoc) => ({
        id: applicationDoc.id,
        ...applicationDoc.data(),
      }));
      setApplications(list);
    } catch (error) {
      console.error('Error fetching rescuer applications:', error);
      Alert.alert('Error', 'Failed to load rescuer applications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchApplications();
  };

  const sendUserNotification = async (batch, userId, title, message) => {
    const notificationRef = doc(collection(db, 'notifications'));
    batch.set(notificationRef, {
      user_id: userId,
      title,
      message,
      read: false,
      created_at: new Date(),
    });
  };

  const approveApplication = (application) => {
    Alert.alert(
      'Approve Rescuer Application',
      `Approve ${application.full_name || 'this applicant'} as a rescuer?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              setProcessingId(application.id);
              const batch = writeBatch(db);

              const applicationRef = doc(db, 'rescuer_applications', application.id);
              batch.update(applicationRef, {
                status: 'approved',
                processed_at: new Date(),
                rejection_reason: '',
              });

              const userRef = doc(db, 'users', application.user_id);
              batch.update(userRef, {
                is_rescuer: true,
                rescuer_status: 'approved',
                rescuer_application_id: application.id,
                rescuer_approved_at: new Date(),
              });

              await sendUserNotification(
                batch,
                application.user_id,
                'Rescuer Application Approved',
                'Congratulations! Your rescuer application has been approved. You can now participate in rescue operations.',
              );

              await batch.commit();
              setViewingApp((prev) => (prev?.id === application.id ? { ...prev, status: 'approved' } : prev));
              await fetchApplications();
            } catch (error) {
              console.error('Error approving rescuer application:', error);
              Alert.alert('Error', 'Failed to approve application.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  };

  const rejectApplication = (application) => {
    Alert.alert(
      'Reject Rescuer Application',
      `Reject ${application.full_name || 'this applicant'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessingId(application.id);
              const batch = writeBatch(db);

              const applicationRef = doc(db, 'rescuer_applications', application.id);
              batch.update(applicationRef, {
                status: 'rejected',
                processed_at: new Date(),
              });

              const userRef = doc(db, 'users', application.user_id);
              batch.update(userRef, {
                is_rescuer: false,
                rescuer_status: 'rejected',
              });

              await sendUserNotification(
                batch,
                application.user_id,
                'Rescuer Application Rejected',
                'Your rescuer application was not approved at this time. You may reapply after addressing the review notes.',
              );

              await batch.commit();
              setViewingApp((prev) => (prev?.id === application.id ? { ...prev, status: 'rejected' } : prev));
              await fetchApplications();
            } catch (error) {
              console.error('Error rejecting rescuer application:', error);
              Alert.alert('Error', 'Failed to reject application.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  };

  const revokeApplication = (application) => {
    Alert.alert(
      'Revoke Rescuer Verification',
      `Revoke rescuer verification for ${application.full_name || 'this user'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessingId(application.id);

              const applicationRef = doc(db, 'rescuer_applications', application.id);
              await updateDoc(applicationRef, {
                status: 'revoked',
                processed_at: new Date(),
              });

              const userRef = doc(db, 'users', application.user_id);
              await updateDoc(userRef, {
                is_rescuer: false,
                rescuer_status: 'revoked',
              });

              await fetchApplications();
              setViewingApp((prev) => (prev?.id === application.id ? { ...prev, status: 'revoked' } : prev));
            } catch (error) {
              console.error('Error revoking rescuer verification:', error);
              Alert.alert('Error', 'Failed to revoke rescuer verification.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  };

  const renderApplication = ({ item }) => {
    const status = String(item.status || 'pending').toLowerCase();
    const statusStyle = STATUS_COLORS[status] || STATUS_COLORS.pending;
    const appliedDate = item.created_at?.toDate ? item.created_at.toDate().toLocaleDateString() : 'N/A';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleWrap}>
            <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} />
            <Text style={styles.cardTitle} numberOfLines={1}>{item.full_name || 'Unknown Applicant'}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>{titleCase(status)}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="mail" size={16} color={COLORS.textMedium} />
          <Text style={styles.infoText}>{item.email || 'No email'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="call" size={16} color={COLORS.textMedium} />
          <Text style={styles.infoText}>{item.phone || 'No phone'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="location" size={16} color={COLORS.textMedium} />
          <Text style={styles.infoText} numberOfLines={1}>{item.address || 'No address'}</Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>Applied: {appliedDate}</Text>
          <TouchableOpacity onPress={() => setViewingApp(item)}>
            <Text style={styles.viewLink}>View Details</Text>
          </TouchableOpacity>
        </View>

        {status === 'pending' ? (
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
        ) : null}

        {status === 'approved' ? (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.revokeBtnInline]}
              onPress={() => revokeApplication(item)}
              disabled={processingId === item.id}
            >
              <Text style={styles.revokeBtnTextInline}>Revoke</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.auditBtnInline]}
              onPress={() => fetchUserLogs(item.user_id)}
            >
              <Ionicons name="list-outline" size={16} color={COLORS.primary} style={{marginRight: 4}} />
              <Text style={styles.auditBtnTextInline}>Audit Logs</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  const formatAvailability = (value) => {
    if (Array.isArray(value)) {
      return value.map(titleCase).join(', ');
    }
    if (typeof value === 'string' && value.trim()) {
      return value
        .split(',')
        .map((entry) => titleCase(entry.trim()))
        .join(', ');
    }
    return 'N/A';
  };

  const fetchUserLogs = async (userId) => {
    setViewingLogs(userId);
    setRescueTitleById({});
    setLoadingLogs(true);
    try {
      const normalizedId = String(userId ?? '').trim();
      const lookupValues = Array.from(new Set([userId, normalizedId].filter(Boolean)));
      const queryTargets = [];

      lookupValues.forEach((value) => {
        queryTargets.push({ field: 'rescuer_id', value });
        queryTargets.push({ field: 'user_id', value });
      });

      const fetchedById = new Map();
      await Promise.all(queryTargets.map(async ({ field, value }) => {
        const logsQuery = query(
          collection(db, 'rescuer_audit_logs'),
          where(field, '==', value)
        );
        const snapshot = await getDocs(logsQuery);
        snapshot.docs.forEach((logDoc) => {
          fetchedById.set(logDoc.id, { id: logDoc.id, ...logDoc.data() });
        });
      }));

      const fetchedLogs = Array.from(fetchedById.values());
      // Sort in JS to avoid complex index requirements upfront
      fetchedLogs.sort((a, b) => (b.created_at?.toMillis?.() || 0) - (a.created_at?.toMillis?.() || 0));

      const rescueIds = Array.from(new Set(
        fetchedLogs
          .map((entry) => String(entry?.rescue_report_id || '').trim())
          .filter((value) => value.length > 0)
      ));

      if (rescueIds.length > 0) {
        const titleEntries = await Promise.all(rescueIds.map(async (rescueId) => {
          try {
            const reportSnap = await getDoc(doc(db, 'rescue_reports', rescueId));
            if (!reportSnap.exists()) {
              return [rescueId, ''];
            }
            const reportData = reportSnap.data() || {};
            const reportTitle = String(
              reportData.title ||
              reportData.report_title ||
              reportData.pet_name ||
              ''
            ).trim();
            return [rescueId, reportTitle];
          } catch (lookupError) {
            console.error('Error fetching rescue report title:', lookupError);
            return [rescueId, ''];
          }
        }));

        const titleMap = {};
        titleEntries.forEach(([rescueId, reportTitle]) => {
          if (reportTitle) {
            titleMap[rescueId] = reportTitle;
          }
        });
        setRescueTitleById(titleMap);
      }

      setLogs(fetchedLogs);
    } catch (error) {
      console.error('Error fetching logs:', error);
      Alert.alert('Notice', 'No logs found or error fetching logs. Please ensure the activity collection exists.');
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const filteredApplications = applications.filter((app) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (app.full_name || '').toLowerCase().includes(q) ||
      (app.email || '').toLowerCase().includes(q) ||
      (app.status || '').toLowerCase().includes(q)
    );
  });

  const groupedLogs = useMemo(() => {
    const groupsMap = new Map();

    logs.forEach((entry) => {
      const rescueId = String(entry?.rescue_report_id || '').trim() || 'unassigned';
      if (!groupsMap.has(rescueId)) {
        groupsMap.set(rescueId, []);
      }
      groupsMap.get(rescueId).push(entry);
    });

    return Array.from(groupsMap.entries())
      .map(([rescueId, entries]) => ({
        rescueId,
        entries,
        latestAt: entries[0]?.created_at?.toMillis?.() || 0,
      }))
      .sort((a, b) => b.latestAt - a.latestAt);
  }, [logs]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        {!isSearching ? (
          <>
            <Text style={styles.headerTitle}>Rescuer Applications</Text>
            <TouchableOpacity onPress={() => setIsSearching(true)} style={styles.searchButton}>
              <Ionicons name="search" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, email, or status..."
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
          keyExtractor={(item) => item.id}
          renderItem={renderApplication}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="shield-outline" size={60} color={COLORS.borderLight} />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No matching rescuer applications found.' : 'No rescuer applications found.'}
              </Text>
            </View>
          }
        />
      )}

      {viewingApp ? (
        <Modal visible={!!viewingApp} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Application Details</Text>
                <TouchableOpacity onPress={() => setViewingApp(null)}>
                  <Ionicons name="close" size={24} color={COLORS.textDark} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Personal Information</Text>
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.modalLabel}>Full Name</Text>
                    <Text style={styles.modalValue}>{viewingApp.full_name || 'N/A'}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.modalLabel}>Email</Text>
                    <Text style={styles.modalValue}>{viewingApp.email || 'N/A'}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.modalLabel}>Phone</Text>
                    <Text style={styles.modalValue}>{viewingApp.phone || 'N/A'}</Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.modalLabel}>Address</Text>
                    <Text style={styles.modalValue}>{viewingApp.address || 'N/A'}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.modalLabel}>City</Text>
                    <Text style={styles.modalValue}>{viewingApp.city || 'N/A'}</Text>
                  </View>
                </View>

                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Application Details</Text>
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.modalLabel}>Motivation</Text>
                    <Text style={styles.modalValue}>{viewingApp.reason || 'N/A'}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.modalLabel}>Experience</Text>
                    <Text style={styles.modalValue}>{viewingApp.experience || 'N/A'}</Text>
                  </View>
                </View>

                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Logistics & Status</Text>

                  <View style={styles.detailRow}>
                    <Text style={styles.modalLabel}>Availability</Text>
                    <Text style={styles.modalValue}>{formatAvailability(viewingApp.availability)}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.modalLabel}>Transportation</Text>
                    <Text style={styles.modalValue}>{titleCase(viewingApp.transportation_type || 'N/A')}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.modalLabel}>Coordinates</Text>
                    <Text style={styles.modalValue}>
                      {viewingApp.latitude && viewingApp.longitude
                        ? `${Number(viewingApp.latitude).toFixed(6)}, ${Number(viewingApp.longitude).toFixed(6)}`
                        : 'N/A'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.modalLabel}>Status</Text>
                    <Text style={[styles.modalValue, { color: STATUS_COLORS[viewingApp.status?.toLowerCase()]?.text || COLORS.textDark, fontWeight: 'bold' }]}>
                      {titleCase(viewingApp.status || 'pending')}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Audit Logs Modal */}
      {viewingLogs && (
        <Modal visible={true} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Rescuer Activities</Text>
                  <Text style={styles.modalSubtitle}>Grouped by rescue report with workflow-aware statuses</Text>
                </View>
                <TouchableOpacity onPress={() => setViewingLogs(null)}>
                  <Ionicons name="close" size={24} color={COLORS.textDark} />
                </TouchableOpacity>
              </View>
              {loadingLogs ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
              ) : (
                <>
                  <FlatList
                    data={groupedLogs}
                    keyExtractor={(group) => group.rescueId}
                    contentContainerStyle={styles.logsListContent}
                    ListEmptyComponent={
                      <View style={styles.emptyContainer}>
                        <Ionicons name="document-text-outline" size={48} color={COLORS.borderLight} />
                        <Text style={styles.emptyText}>No activity logs found for this user.</Text>
                      </View>
                    }
                    renderItem={({ item: group }) => {
                      const groupWorkflow = getGroupWorkflow(group.entries);
                      const latestEntry = group.entries[0] || null;
                      const latestPresentation = latestEntry ? getStatusPresentation(latestEntry, groupWorkflow) : null;

                      return (
                      <View style={styles.logGroupCard}>
                        <View style={styles.logGroupHeader}>
                          <Text style={styles.logGroupTitle}>
                            {group.rescueId === 'unassigned'
                              ? 'General Activity'
                              : (rescueTitleById[group.rescueId] || `Rescue ${group.rescueId}`)}
                          </Text>
                          <Text style={styles.logGroupCount}>{group.entries.length} log{group.entries.length > 1 ? 's' : ''}</Text>
                        </View>
                        {latestPresentation ? (
                          <View style={[styles.groupCurrentStatusPill, { backgroundColor: latestPresentation.bg }]}>
                            <Text style={[styles.groupCurrentStatusText, { color: latestPresentation.text }]}>
                              Current: {latestPresentation.label}
                            </Text>
                          </View>
                        ) : null}
                        {group.rescueId !== 'unassigned' ? (
                          <Text style={styles.logGroupMeta}>Rescue ID: {group.rescueId}</Text>
                        ) : null}

                        {group.entries.map((item) => (
                          <View key={item.id} style={styles.logCard}>
                            <View style={styles.logMetaRow}>
                              <Text style={styles.logDate}>
                                {item.created_at?.toDate ? item.created_at.toDate().toLocaleString() : 'N/A'}
                              </Text>
                              {item.status ? (() => {
                                const statusPresentation = getStatusPresentation(item, groupWorkflow);
                                return (
                                <View
                                  style={[
                                    styles.logStatusPill,
                                    {
                                      backgroundColor: statusPresentation.bg,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.logStatusText,
                                      {
                                        color: statusPresentation.text,
                                      },
                                    ]}
                                  >
                                    {statusPresentation.label}
                                  </Text>
                                </View>
                                );
                              })() : null}
                            </View>
                            <View style={styles.logWorkflowRow}>
                              <Text style={styles.logWorkflowText}>
                                {groupWorkflow === 'shelter_transfer' ? 'Shelter Transfer Flow' : 'Rescue Verification Flow'}
                              </Text>
                            </View>
                            <Text style={styles.logTitle}>{item.title || item.status || 'Rescue Operation'}</Text>
                            <Text style={styles.logDescription}>{item.description || item.notes || 'No details provided.'}</Text>
                          </View>
                        ))}
                      </View>
                      );
                    }}
                  />
                </>
              )}
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
    backgroundColor: COLORS.background,
  },
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
  cardTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.sm,
    gap: SPACING.xs,
  },
  cardTitle: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.round,
  },
  statusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    gap: SPACING.xs,
  },
  infoText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
  },
  cardFooter: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
  },
  viewLink: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: FONTS.weights.semiBold,
  },
  actions: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  actionBtn: {
    flex: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  approveBtn: {
    backgroundColor: COLORS.success,
  },
  rejectText: {
    color: COLORS.danger,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  approveText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  revokeBtnInline: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  revokeBtnTextInline: {
    color: COLORS.textDark,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  auditBtnInline: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  auditBtnTextInline: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  revokeBtn: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  revokeBtnText: {
    color: COLORS.textDark,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  auditLogsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  auditLogsBtnText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
  },
  logsListContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  logGroupCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: SPACING.md,
  },
  logGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  logGroupTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  logGroupMeta: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
    marginBottom: SPACING.sm,
  },
  groupCurrentStatusPill: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    marginBottom: SPACING.xs,
  },
  groupCurrentStatusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
  logGroupCount: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
    fontWeight: FONTS.weights.semiBold,
  },
  logCard: {
    backgroundColor: COLORS.backgroundWhite,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  logMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  logTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
    marginBottom: 6,
  },
  logDate: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
  },
  logStatusPill: {
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  logStatusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
  logWorkflowRow: {
    marginBottom: 6,
  },
  logWorkflowText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: FONTS.weights.semiBold,
  },
  logDescription: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMedium,
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    marginTop: SPACING.md,
    color: COLORS.textMedium,
    fontSize: FONTS.sizes.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '85%',
    backgroundColor: COLORS.backgroundWhite,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingBottom: SPACING.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  modalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark,
  },
  modalSubtitle: {
    marginTop: 2,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMedium,
  },
  modalBody: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  sectionContainer: {
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.backgroundWhite,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
    marginBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    paddingBottom: SPACING.xs,
  },
  detailRow: {
    marginBottom: SPACING.md,
  },
  modalLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textMedium,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  modalValue: {
    color: COLORS.textDark,
    fontSize: FONTS.sizes.md,
    lineHeight: 22,
  },
});

export default AdminRescuerApplicationsScreen;
