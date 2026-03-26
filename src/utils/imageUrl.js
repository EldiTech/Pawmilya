import CONFIG from '../config/config';

const getBaseUrl = () => CONFIG.API_URL.replace('/api', '');

const isLocalHost = (hostname = '') => {
  const value = String(hostname || '').toLowerCase();
  return value === 'localhost' || value === '127.0.0.1' || value === '10.0.2.2';
};

export const normalizeImageUrl = (imagePath, placeholder = null) => {
  if (!imagePath) return placeholder;

  if (typeof imagePath !== 'string') {
    return placeholder;
  }

  if (imagePath.startsWith('data:image')) {
    return imagePath;
  }

  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    try {
      const parsedUrl = new URL(imagePath);
      const isLegacyUploadPath = parsedUrl.pathname.startsWith('/uploads/');

      // Rebase only legacy local upload URLs to the app's current API host.
      if (isLegacyUploadPath && isLocalHost(parsedUrl.hostname)) {
        return `${getBaseUrl()}${parsedUrl.pathname}`;
      }

      return imagePath;
    } catch {
      return imagePath;
    }
  }

  return `${getBaseUrl()}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
};

export const getImageUrl = normalizeImageUrl;
export const getApiAssetBaseUrl = getBaseUrl;
