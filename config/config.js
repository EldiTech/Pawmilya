const CONFIG = {
  API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000',
  PAYMONGO_PUBLIC_KEY:
    process.env.EXPO_PUBLIC_PAYMONGO_PUBLIC_KEY || process.env.PAYMONGO_PUBLIC_KEY || '',
};

export default CONFIG;
