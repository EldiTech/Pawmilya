import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, SPACING } from '../../constants/theme';
import { db } from '../../firebaseConfig';

const formatMoney = (value) => `PHP ${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ShelterFundsScreen = ({ onBack }) => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPayments = async () => {
      setLoading(true);
      try {
        const snapshot = await getDocs(collection(db, 'payments'));
        const rows = snapshot.docs.map((item) => {
          const data = item.data() || {};
          return {
            id: item.id,
            ...data,
            amount: Number(data.amount || 0),
            createdAtMs: data.created_at?.toDate ? data.created_at.toDate().getTime() : 0,
          };
        });

        rows.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setPayments(rows);
      } catch (error) {
        console.log('Failed to load funds', error);
        setPayments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, []);

  const summary = useMemo(() => {
    const total = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paidCount = payments.filter((item) => String(item.status || '').toLowerCase() === 'paid').length;
    const pendingCount = payments.filter((item) => String(item.status || '').toLowerCase() === 'pending').length;

    return { total, paidCount, pendingCount };
  }, [payments]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8EF" />

      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Funds</Text>
          <Text style={styles.headerSubtitle}>All adoption payments</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Funds</Text>
            <Text style={styles.summaryValue}>{formatMoney(summary.total)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Paid</Text>
            <Text style={styles.summaryValue}>{summary.paidCount}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Pending</Text>
            <Text style={styles.summaryValue}>{summary.pendingCount}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading funds...</Text>
          </View>
        ) : null}

        {!loading && payments.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="wallet-outline" size={20} color="#8B6D4A" />
            <Text style={styles.emptyText}>No payments yet.</Text>
          </View>
        ) : null}

        {!loading && payments.map((item) => (
          <View key={item.id} style={styles.paymentRow}>
            <View style={styles.paymentLeft}>
              <Text style={styles.paymentPetName}>{item.pet_name || 'Adoption Payment'}</Text>
              <Text style={styles.paymentMeta}>{(item.method || 'method').toUpperCase()} • {(item.status || 'paid').toUpperCase()}</Text>
              <Text style={styles.paymentMeta}>{item.reference || item.id}</Text>
            </View>
            <Text style={styles.paymentAmount}>{formatMoney(item.amount)}</Text>
          </View>
        ))}

        <View style={{ height: 26 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8EF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 50,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.lg,
    backgroundColor: '#FFF8EF',
    borderBottomWidth: 1,
    borderBottomColor: '#F2E7D8',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    padding: SPACING.sm,
    marginRight: SPACING.sm,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF2E5',
    borderWidth: 1,
    borderColor: '#F4DDC5',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#1E1A15',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#7D6851',
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EBDCCB',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#8A7258',
    marginBottom: 3,
  },
  summaryValue: {
    fontSize: 13,
    color: '#2A1F14',
    fontFamily: 'Poppins-SemiBold',
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  loadingText: {
    fontSize: 12,
    color: '#7D6851',
  },
  emptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: '#FFFDF8',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F2E9DC',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  emptyText: {
    fontSize: 12,
    color: '#7F684F',
  },
  paymentRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1E6D8',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  paymentLeft: {
    flex: 1,
    paddingRight: SPACING.sm,
  },
  paymentPetName: {
    fontSize: 13,
    color: '#2D241A',
    fontFamily: 'Poppins-SemiBold',
  },
  paymentMeta: {
    marginTop: 2,
    fontSize: 11,
    color: '#8A7258',
  },
  paymentAmount: {
    fontSize: 13,
    color: '#7B4518',
    fontFamily: 'Poppins-SemiBold',
  },
});

export default ShelterFundsScreen;
