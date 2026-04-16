import { RefreshControl as NativeRefreshControl, Platform, View } from 'react-native';
import { COLORS } from '../constants/theme';
import { DEFAULT_BASE64_IMAGE, normalizeImageUrl } from './imageUrl';

export const getAvatarUrl = (avatarPath) => {
  return normalizeImageUrl(avatarPath, DEFAULT_BASE64_IMAGE);
};

export const getPetImageUrl = (imagePath) => {
  if (imagePath && typeof imagePath === 'object') {
    const images = Array.isArray(imagePath.images) ? imagePath.images : [];
    const candidate = imagePath.image || imagePath.image_url || images[0] || null;
    return normalizeImageUrl(candidate, DEFAULT_BASE64_IMAGE);
  }

  return normalizeImageUrl(imagePath, DEFAULT_BASE64_IMAGE);
};

export const parseApiResponse = (response) => {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return [];
};

export const handleApiError = (error, scope = 'User') => {
  console.error(`[${scope}]`, error);
};

export const RefreshControl = ({ refreshing, onRefresh }) => {
  return (
    <NativeRefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={[COLORS.primary]}
      tintColor={COLORS.primary}
    />
  );
};

export const BottomSpacing = () => <View style={{ height: Platform.OS === 'ios' ? 132 : 112 }} />;
