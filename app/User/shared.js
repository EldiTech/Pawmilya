import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl as NativeRefreshControl, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../../constants/theme';
import { DEFAULT_BASE64_IMAGE, normalizeImageUrl } from '../../utils/imageUrl';

export const getImageUrl = (imagePath) => {
  if (imagePath && typeof imagePath === 'object') {
    const images = Array.isArray(imagePath.images) ? imagePath.images : [];
    const candidate = imagePath.image || imagePath.image_url || images[0] || null;
    return normalizeImageUrl(candidate, DEFAULT_BASE64_IMAGE);
  }

  return normalizeImageUrl(imagePath, DEFAULT_BASE64_IMAGE);
};

export const getTimeAgo = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const ScreenHeader = ({ title, subtitle }) => (
  <View style={styles.header}>
    <Text style={styles.headerTitle}>{title}</Text>
    {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
  </View>
);

export const SearchBar = ({ value, onChangeText, placeholder }) => (
  <View style={styles.searchContainer}>
    <View style={styles.searchBar}>
      <Ionicons name="search" size={20} color={COLORS.textLight || '#9CA3AF'} />
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textLight || '#9CA3AF'}
      />
      {value ? (
        <Ionicons name="close-circle" size={20} color={COLORS.textLight || '#9CA3AF'} onPress={() => onChangeText('')} />
      ) : null}
    </View>
  </View>
);

export const LoadingState = ({ message = 'Loading...' }) => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color={COLORS.primary} />
    <Text style={styles.loadingText}>{message}</Text>
  </View>
);

export const EmptyState = ({ icon, iconSet, title, subtitle }) => {
  const IconComponent = iconSet === 'material' ? MaterialCommunityIcons : Ionicons;
  return (
    <View style={styles.emptyContainer}>
      <IconComponent name={icon || "folder-open-outline"} size={64} color={COLORS.textLight || '#9CA3AF'} />
      <Text style={styles.emptyTitle}>{title || 'No Results Found'}</Text>
      <Text style={styles.emptyText}>{subtitle || 'Try adjusting your filters or search query.'}</Text>
    </View>
  );
};

export const BottomSpacing = () => <View style={{ height: Platform.OS === 'ios' ? 132 : 112 }} />;

export const RefreshControl = (props) => (
  <NativeRefreshControl colors={[COLORS.primary]} tintColor={COLORS.primary} {...props} />
);

export const useDataFetching = (fetchFn) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const result = await fetchFn();
      setData(result || []);
    } catch (e) {
      console.error('Fetch error:', e);
      setData([]);
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    loadData(true);
  }, [loadData]);

  return { data, loading, refreshing, onRefresh };
};

export const useCombinedFilters = (items, searchFilterFn, categoryKey, defaultCategoryId = 'all') => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(defaultCategoryId);

  const filteredItems = useMemo(() => {
    let result = Array.isArray(items) ? items : [];

    // Filter by category
    if (selectedCategory && selectedCategory !== defaultCategoryId) {
      result = result.filter(item => {
        const val = item[categoryKey]?.toLowerCase() || '';
        return val === selectedCategory.toLowerCase();
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(item => searchFilterFn(item, lowerQuery));
    }

    return result;
  }, [items, searchQuery, selectedCategory, categoryKey, defaultCategoryId, searchFilterFn]);

  return {
    filteredItems,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
  };
};

export const containerStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background || '#F9FAFB',
  },
  content: {
    flex: 1,
  },
});

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark || '#111827',
  },
  headerSubtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium || '#6B7280',
    marginTop: SPACING.xs,
  },
  searchContainer: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundWhite || '#FFFFFF',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  searchInput: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: FONTS.sizes.md,
    color: COLORS.textDark || '#111827',
    paddingVertical: SPACING.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxxl * 2,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium || '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxxl * 2,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textDark || '#111827',
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textMedium || '#6B7280',
    textAlign: 'center',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.xl,
  },
});

export default function DummySharedRoute() {
  return null;
}

export const handleApiError = (error, defaultMessage) => { console.error(error); Alert.alert('Error', error?.message || defaultMessage || 'Something went wrong'); };

export const getShelterImage = (imagePath) => getImageUrl(imagePath);

export const useSearch = (items, searchFilterFn) => { const [searchQuery, setSearchQuery] = useState(''); const filteredItems = useMemo(() => items.filter(item => searchFilterFn(item, searchQuery)), [items, searchQuery, searchFilterFn]); return { filteredItems, searchQuery, setSearchQuery }; };
