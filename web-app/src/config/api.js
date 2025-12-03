import axios from 'axios';

const API_BASE_URL = 'https://jain-silver-phi.vercel.app/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 seconds - backend may wait for fresh rates
  maxContentLength: 50 * 1024 * 1024,
  maxBodyLength: 50 * 1024 * 1024,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    // Don't override timeout if explicitly set in the request
    if (!config.timeout) {
      if (config.url && (config.url.includes('/rates') || config.url === '/rates')) {
        config.timeout = 10000; // 10 seconds - backend may wait for fresh rates
      } else if (config.url && (config.url.includes('/admin') || config.url.includes('/store') || config.url.includes('/news'))) {
        config.timeout = 30000; // 30 seconds - admin/store/news endpoints may need more time for database queries
      }
    }
    
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    
    return Promise.reject(error);
  }
);

export default api;

