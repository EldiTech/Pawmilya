import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, SPACING } from '../../constants/theme';

const ShelterDashboard = ({ onBack, onNavigateToConfigureProfile, onNavigateToTransfers, onNavigateToRescuedPets, onNavigateToAvailablePets, onNavigateToFunds, onNavigateToAdoptionRequests, onNavigateToChats }) => {
  const renderRow = (title, icon, iconFamily, onPress, description) => (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.actionRowLeft}>
        <View style={styles.actionIconWrap}>
          {iconFamily === 'Ionicons' ? (
             <Ionicons name={icon} size={22} color={COLORS.primary} />
          ) : (
             <MaterialCommunityIcons name={icon} size={22} color={COLORS.primary} />
          )}
        </View>
        <View style={styles.actionTextWrap}>
          <Text style={styles.actionTitle}>{title}</Text>
          {description ? <Text style={styles.actionDesc}>{description}</Text> : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.backgroundWhite} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />      
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Shelter Management</Text>
          <Text style={styles.headerSubtitle}>Manage your shelter operations</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pets & Adoptions</Text>
          <View style={styles.cardGroup}>
            {renderRow('Available Pets', 'paw', 'Ionicons', onNavigateToAvailablePets, 'Manage pets ready for adoption')}
            <View style={styles.divider} />
            {renderRow('Rescued Pets', 'heart-outline', 'MaterialCommunityIcons', onNavigateToRescuedPets, 'View unlisted or rescued pets')}
            <View style={styles.divider} />
            {renderRow('Adoption Requests', 'file-document-edit-outline', 'MaterialCommunityIcons', onNavigateToAdoptionRequests, 'Review applications from users')}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Operations</Text>
          <View style={styles.cardGroup}>
            {renderRow('Transfers', 'git-compare-outline', 'Ionicons', onNavigateToTransfers, 'Transfer pets between shelters')}
            <View style={styles.divider} />
            {renderRow('Funds', 'wallet-outline', 'Ionicons', onNavigateToFunds, 'Track collected funds and donations')}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.cardGroup}>
            {renderRow('Chats', 'chatbubble-ellipses-outline', 'Ionicons', onNavigateToChats, 'Messages with adopters')}
            <View style={styles.divider} />
            {renderRow('Configure Profile', 'cog-outline', 'MaterialCommunityIcons', onNavigateToConfigureProfile, 'Update shelter details and rules')}
          </View>
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 54,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.backgroundWhite,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    marginRight: 6,
    padding: 6,
    marginLeft: -6,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  contentContainer: {
    padding: SPACING.lg,
    paddingBottom: 40,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  cardGroup: {
    backgroundColor: COLORS.backgroundWhite,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    backgroundColor: COLORS.backgroundWhite,
  },
  actionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF0E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  actionTextWrap: {
    flex: 1,
    paddingRight: SPACING.sm,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 13,
    color: '#64748B',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 76,
  }
});

export default ShelterDashboard;