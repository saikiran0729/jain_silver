import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Using Vercel backend URL for all environments
// All API calls will go to: https://jain-silver-phi.vercel.app/api
const API_BASE_URL = 'https://jain-silver-phi.vercel.app/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds timeout (increased for better reliability)
  maxContentLength: 50 * 1024 * 1024, // 50MB max content length
  maxBodyLength: 50 * 1024 * 1024, // 50MB max body length
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests and handle timeouts
api.interceptors.request.use(
  async (config) => {
    // Set timeout for rates endpoint (optimized for reliability)
    if (config.url && (config.url.includes('/rates') || config.url === '/rates')) {
      config.timeout = 25000; // 25 seconds for rates (increased for better reliability)
    } else if (config.url && (config.url.includes('/store') || config.url.includes('/news'))) {
      config.timeout = 20000; // 20 seconds for store/news endpoints
    }
    
    // Add authentication token
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Don't set Content-Type for FormData - let axios handle it automatically
    // React Native FormData needs special handling
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
      // React Native FormData - don't transform, send as-is
      config.transformRequest = [];
      // Add additional headers for file uploads
      config.headers['Accept'] = 'application/json';
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors (e.g., token expiration)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear storage
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }
    
    // Handle network errors gracefully
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      // Only log in development, don't spam console in production
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('🌐 Network Error:', {
          message: error.message,
          code: error.code,
          url: error.config?.url,
          baseURL: error.config?.baseURL,
        });
      }
      
      // For rates endpoint, return empty array instead of throwing error
      // This allows the app to continue showing cached/default rates
      if (error.config?.url?.includes('/rates')) {
        return Promise.resolve({ data: [] });
      }
    }
    
    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('⏱️ Request Timeout:', {
          url: error.config?.url,
          timeout: error.config?.timeout,
        });
      }
      
      // For rates endpoint, return empty array on timeout
      if (error.config?.url?.includes('/rates')) {
        return Promise.resolve({ data: [] });
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;

