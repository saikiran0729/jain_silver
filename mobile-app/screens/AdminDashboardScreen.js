import React, { useState, useEffect, useContext, useCallback, useMemo, memo, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  TextInput,
  Modal,
  TouchableOpacity,
  Switch,
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Card, Button, Chip, List, Portal, Dialog, Paragraph, Divider, SegmentedButtons } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import api from '../config/api';
import { AuthContext } from '../context/AuthContext';
import colors from '../theme/colors';

export default function AdminDashboardScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, logout } = useContext(AuthContext);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [globalShowAsItIs, setGlobalShowAsItIs] = useState(false);
  const [mainTab, setMainTab] = useState(0); // 0: Users, 1: News, 2: Profile/Store
  const [rates, setRates] = useState([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustValue, setAdjustValue] = useState('');
  const [adjustType, setAdjustType] = useState('increase');
  const [adjustValueType, setAdjustValueType] = useState('amount');
  const [selectedItem, setSelectedItem] = useState('all');
  const [loadingAction, setLoadingAction] = useState(false);
  const [showOriginalRates, setShowOriginalRates] = useState(false);
  const [baseRateFromSource, setBaseRateFromSource] = useState(null);
  const [editProductDialogOpen, setEditProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editProductName, setEditProductName] = useState('');
  const [newsPosts, setNewsPosts] = useState([]);
  const [loadingNews, setLoadingNews] = useState(false);
  const [newsDialogOpen, setNewsDialogOpen] = useState(false);
  const [editingNews, setEditingNews] = useState(null);
  const [newsForm, setNewsForm] = useState({ title: '', content: '', image: '', category: 'general', tags: '', published: false });
  const [storeInfo, setStoreInfo] = useState(null);
  const [loadingStore, setLoadingStore] = useState(false);
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);
  const [storeForm, setStoreForm] = useState({});

  // Ref for polling interval
  const pollingIntervalRef = useRef(null);
  const POLLING_INTERVAL = 1000; // Poll every 1 second

  // Refs to avoid stale closures during intervals
  const ratesRef = useRef(rates);
  const globalShowAsItIsRef = useRef(globalShowAsItIs);
  const showOriginalRatesRef = useRef(showOriginalRates);

  useEffect(() => {
    ratesRef.current = rates;
  }, [rates]);
  useEffect(() => {
    globalShowAsItIsRef.current = globalShowAsItIs;
  }, [globalShowAsItIs]);
  useEffect(() => {
    showOriginalRatesRef.current = showOriginalRates;
  }, [showOriginalRates]);

  // Memoize fetch functions using latest closures via refs or just safely handle them
  // A cleaner approach is to use the refs inside fetchRates directly
  const fetchUsersMemo = useCallback(() => {
    fetchUsers();
  }, []);

  const fetchShowAsItIsSettingMemo = useCallback(() => {
    fetchShowAsItIsSetting();
  }, []);

  const fetchNewsMemo = useCallback(() => {
    fetchNews();
  }, []);

  const fetchStoreInfoMemo = useCallback(() => {
    fetchStoreInfo();
  }, []);

  useEffect(() => {
    fetchUsersMemo();
    fetchRates(true);
    fetchShowAsItIsSettingMemo();
    if (mainTab === 1) fetchNewsMemo();
    if (mainTab === 2) fetchStoreInfoMemo();
  }, [mainTab, fetchUsersMemo, fetchShowAsItIsSettingMemo, fetchNewsMemo, fetchStoreInfoMemo]);

  // Poll rates every second when on Users tab (where rates are displayed)
  useEffect(() => {
    // Only poll when on the Users tab (mainTab === 0)
    if (mainTab !== 0) {
      // Clear polling if we're not on the Users tab
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // Start polling rates every second
    const startPolling = () => {
      // Clear any existing polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      // Set up interval to poll every second
      pollingIntervalRef.current = setInterval(() => {
        // Use skipUpdate=true to avoid triggering backend updates
        // Use silent=true to prevent fading out/showing loading states
        fetchRates(true, true);
      }, POLLING_INTERVAL);

      console.log('✅ Started polling rates every second (Admin Dashboard)');
    };

    startPolling();

    // Cleanup: Clear interval on unmount or when mainTab changes
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        console.log('⏹️ Stopped polling rates (Admin Dashboard)');
      }
    };
  }, [mainTab]);

  const fetchShowAsItIsSetting = async () => {
    try {
      const response = await api.get('/admin/show-as-it-is');
      setGlobalShowAsItIs(response.data.showAsItIs || false);
      setShowOriginalRates(response.data.showAsItIs || false); // Sync local view with global setting
    } catch (error) {
      console.warn('⚠️ Error fetching showAsItIs setting:', error.message);
      setGlobalShowAsItIs(false);
    }
  };

  const toggleShowAsItIs = async () => {
    try {
      setLoadingAction(true);
      const response = await api.post('/admin/toggle-show-as-it-is');
      const newValue = response.data.showAsItIs;
      setGlobalShowAsItIs(newValue);
      setShowOriginalRates(newValue);
      Alert.alert('Success', response.data.message || `"Show As It Is" ${newValue ? 'enabled' : 'disabled'} successfully`);
      // Refetch rates with new showAsItIs state
      await fetchRates(true);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to toggle "Show As It Is" setting');
    } finally {
      setLoadingAction(false);
    }
  };

  const fetchBaseRate = async () => {
    try {
      const response = await api.get('/rates/base-rate');
      console.log('✅ Base rate fetched from source:', response.data);
      setBaseRateFromSource(response.data);
      return response.data;
    } catch (error) {
      // Silently handle 404 - endpoint may not be deployed yet
      // We'll calculate original rates from current rates and adjustments
      if (error.response?.status === 404) {
        console.log('ℹ️ Base rate endpoint not available, will calculate from current rates');
      } else {
        console.warn('⚠️ Error fetching base rate:', error.message);
      }
      return null;
    }
  };

  const fetchRates = async (skipUpdate = false, silent = false) => {
    try {
      // ONLY show loading if we have no rates at all and it's not a silent refresh
      const currentRates = ratesRef.current;
      if (!silent && (!currentRates || currentRates.length === 0)) {
        setLoadingRates(true);
      }
      console.log('📡 Fetching rates from /rates endpoint (admin view)...', skipUpdate ? '(skipping update)' : '');
      // Use skipUpdate parameter to avoid waiting for slow external rate updates
      // This prevents timeouts when admin adjusts rates and immediately fetches them
      // Add admin=true to ensure all products (including disabled ones) are returned
      // Pass showAsItIs parameter to backend so it knows the current state
      const response = await api.get('/rates', {
        params: {
          skipUpdate: skipUpdate ? 'true' : undefined,
          admin: 'true', // Explicitly mark as admin request to get all products including disabled ones
          showAsItIs: globalShowAsItIsRef.current ? 'true' : undefined // Pass current showAsItIs state
        },
        timeout: 60000 // 60 seconds timeout for admin dashboard (increased from 30s)
      });

      console.log('📡 Fetching rates with params:', {
        skipUpdate: skipUpdate ? 'true' : undefined,
        admin: 'true',
        showAsItIs: globalShowAsItIs ? 'true' : undefined
      });
      let fetchedRates = response.data || [];

      // Handle object response with rates property (fallback from backend)
      if (fetchedRates && !Array.isArray(fetchedRates) && Array.isArray(fetchedRates.rates)) {
        fetchedRates = fetchedRates.rates;
      }

      // Ensure fetchedRates is an array
      if (!Array.isArray(fetchedRates)) {
        console.error('❌ Expected array of rates but got:', typeof fetchedRates, fetchedRates);
        fetchedRates = [];
      }

      // Log raw response for debugging
      console.log('📦 Raw rates response:', fetchedRates.map(r => ({
        name: r.name || r.originalName,
        isVisible: r.isVisible,
        hasIsVisible: r.hasOwnProperty('isVisible')
      })));

      const visibleCount = fetchedRates.filter(r => r.isVisible !== false).length;
      const disabledCount = fetchedRates.filter(r => r.isVisible === false).length;
      console.log('✅ Rates fetched successfully:', fetchedRates.length, 'total rates');
      console.log('📊 Visibility breakdown:', `${visibleCount} visible, ${disabledCount} disabled`);

      if (disabledCount > 0) {
        const disabledProducts = fetchedRates.filter(r => r.isVisible === false);
        const disabledNames = disabledProducts.map(r => r.name || r.originalName || 'unnamed');
        console.log('🚫 DISABLED PRODUCTS RECEIVED:', disabledNames.join(', '));
        console.log('🚫 Disabled products details:', disabledProducts.map(r => ({
          name: r.name || r.originalName,
          isVisible: r.isVisible,
          _id: r._id
        })));
      } else {
        console.warn('⚠️ WARNING: No disabled products in response! All products are visible.');
        // Check if any products have isVisible explicitly set
        const productsWithIsVisible = fetchedRates.filter(r => r.hasOwnProperty('isVisible'));
        console.log('📋 Products with isVisible property:', productsWithIsVisible.length, 'out of', fetchedRates.length);
      }

      // Compare lengths or basic properties to avoid setting new references if data is identical
      let hasChanges = false;
      if (!currentRates || currentRates.length !== fetchedRates.length) {
        hasChanges = true;
      } else {
        for (let i = 0; i < fetchedRates.length; i++) {
          const oldRate = currentRates.find(r => r._id === fetchedRates[i]._id || r.name === fetchedRates[i].name);
          if (!oldRate ||
            oldRate.ratePerGram !== fetchedRates[i].ratePerGram ||
            oldRate.rate !== fetchedRates[i].rate ||
            oldRate.manualAdjustment !== fetchedRates[i].manualAdjustment ||
            oldRate.isVisible !== fetchedRates[i].isVisible) {
            hasChanges = true;
            break;
          }
        }
      }

      if (hasChanges) {
        setRates(fetchedRates);
      }

      // If showing original rates, also fetch base rate from source
      if (showOriginalRatesRef.current) {
        await fetchBaseRate();
      }
    } catch (error) {
      console.error('❌ Error fetching rates:', error);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      console.error('Error response status:', error.response?.status);
      console.error('Error response statusText:', error.response?.statusText);
      console.error('Error response data:', JSON.stringify(error.response?.data, null, 2));
      console.error('Error config URL:', error.config?.url);
      console.error('Error config baseURL:', error.config?.baseURL);

      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to fetch rates';

      // Handle different error types
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        console.warn('⏱️ Request timeout - rates endpoint may be slow');
        Alert.alert('Request Timeout', 'The rates endpoint may be slow. Please try again.');
      } else if (!error.response) {
        console.warn('🌐 Network error - check if server is running');
        Alert.alert('Network Error', `${error.message}. Please check your internet connection and try again.`);
      } else if (error.response?.status === 503) {
        console.warn('⚠️ Service temporarily unavailable - rate update in progress');
        Alert.alert('Service Unavailable', 'Rates are being updated. Please wait a moment and try again.');
      } else if (error.response?.status === 500) {
        console.warn('⚠️ Server error');
        Alert.alert('Server Error', `${errorMsg}. Please try again later.`);
      } else {
        console.warn(`⚠️ Failed to fetch rates: ${errorMsg}`);
        Alert.alert('Error', `Failed to fetch rates: ${errorMsg}`);
      }

      // Set empty array on error to prevent UI issues
      setRates([]);
    } finally {
      setLoadingRates(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);

      console.log('🔍 Starting to fetch users...');
      console.log('API base URL:', api.defaults.baseURL);

      // Fetch pending users
      try {
        console.log('📡 Making request to /admin/pending-users...');
        const pendingResponse = await api.get('/admin/pending-users');
        console.log('✅ Response received:', {
          status: pendingResponse.status,
          statusText: pendingResponse.statusText,
          dataType: typeof pendingResponse.data,
          isArray: Array.isArray(pendingResponse.data),
          dataLength: Array.isArray(pendingResponse.data) ? pendingResponse.data.length : 'N/A'
        });
        // Backend returns array directly, not wrapped in data property
        const users = Array.isArray(pendingResponse.data) ? pendingResponse.data : (pendingResponse.data?.users || []);
        console.log('✅ Pending users fetched successfully:', users.length);
        setPendingUsers(users);
      } catch (pendingError) {
        console.error('❌ Error fetching pending users:', pendingError);
        console.error('Error message:', pendingError.message);
        console.error('Error code:', pendingError.code);
        console.error('Error response status:', pendingError.response?.status);
        console.error('Error response statusText:', pendingError.response?.statusText);
        console.error('Error response data:', JSON.stringify(pendingError.response?.data, null, 2));

        const errorMsg = pendingError.response?.data?.message || pendingError.message || 'Failed to fetch pending users';

        if (pendingError.response?.status === 401 || pendingError.response?.status === 403) {
          Alert.alert('Authentication Error', `${errorMsg}. Please sign in again.`);
          // Navigation will be handled by auth context
          return;
        }

        // Show detailed error message
        if (pendingError.code === 'ECONNABORTED' || pendingError.message?.includes('timeout')) {
          console.warn('⏱️ Request timeout - server may be slow or unavailable');
          Alert.alert('Request Timeout', 'The server may be slow. Please try again.');
        } else if (!pendingError.response) {
          console.warn('🌐 Network error - check if server is running');
          Alert.alert('Network Error', `${pendingError.message}. Please check your internet connection and try again.`);
        } else {
          console.warn(`⚠️ Failed to fetch pending users: ${errorMsg}`);
          Alert.alert('Error', `Failed to fetch pending users: ${errorMsg}`);
        }
        setPendingUsers([]);
      }

      // Try to fetch all users
      try {
        console.log('📡 Making request to /admin/users...');
        const allResponse = await api.get('/admin/users');
        console.log('✅ Response received:', {
          status: allResponse.status,
          statusText: allResponse.statusText,
          dataType: typeof allResponse.data,
          isArray: Array.isArray(allResponse.data),
          dataLength: Array.isArray(allResponse.data) ? allResponse.data.length : 'N/A'
        });
        // Backend returns array directly, not wrapped in data property
        const users = Array.isArray(allResponse.data) ? allResponse.data : (allResponse.data?.users || []);
        console.log('✅ All users fetched successfully:', users.length);
        setAllUsers(users);
      } catch (allUsersError) {
        console.error('❌ Error fetching all users:', allUsersError);
        console.error('Error message:', allUsersError.message);
        console.error('Error code:', allUsersError.code);
        console.error('Error response status:', allUsersError.response?.status);
        console.error('Error response statusText:', allUsersError.response?.statusText);
        console.error('Error response data:', JSON.stringify(allUsersError.response?.data, null, 2));

        const errorMsg = allUsersError.response?.data?.message || allUsersError.message || 'Failed to fetch all users';

        if (allUsersError.response?.status === 401 || allUsersError.response?.status === 403) {
          // Already handled above, just use pending users
          console.warn('⚠️ Authentication error for all users, using pending users only');
          setAllUsers(pendingUsers);
        } else {
          // Don't show alert, just use pending users as fallback
          console.warn('⚠️ All users endpoint not available, using pending users only');
          setAllUsers(pendingUsers);
        }
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Failed to fetch users';
      if (error.response?.status === 401 || error.response?.status === 403) {
        Alert.alert('Authentication Error', `${errorMsg}. Please sign in again.`);
      } else {
        Alert.alert('Error', `Failed to fetch users: ${errorMsg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = useCallback(async (userId) => {
    try {
      setLoadingAction(true);
      await api.put(`/admin/approve-user/${userId}`);
      Alert.alert('Success', 'User approved successfully');
      await fetchUsers();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to approve user');
    } finally {
      setLoadingAction(false);
    }
  }, []);

  const handleReject = useCallback(async (userId) => {
    Alert.alert(
      'Reject User',
      'Are you sure you want to reject this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoadingAction(true);
              await api.put(`/admin/reject-user/${userId}`, { reason: 'Rejected by admin' });
              Alert.alert('Success', 'User rejected successfully');
              await fetchUsers();
            } catch (error) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to reject user');
            } finally {
              setLoadingAction(false);
            }
          },
        },
      ]
    );
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Auth' }],
    });
  }, [logout, navigation]);

  const handleAdjustRates = async () => {
    const value = parseFloat(adjustValue);
    if (isNaN(value) || value <= 0) {
      Alert.alert('Invalid', 'Please enter a valid positive number');
      return;
    }
    try {
      setLoadingAction(true);
      const isPercentage = adjustValueType === 'percentage';
      const finalValue = adjustType === 'decrease' ? -Math.abs(value) : value;

      let finalAmountToSend = finalValue;

      // If amount adjustment, calculate per-gram value for the API
      // UI assumes ₹/kg for silver/all items and ₹/10g for gold
      if (!isPercentage) {
        if (selectedItem === 'category:gold') {
          finalAmountToSend = finalValue / 10;
        } else if (selectedItem === 'category:silver' || selectedItem === 'all') {
          finalAmountToSend = finalValue / 1000;
        } else {
          // Specific item - check its type
          const targetRate = rates.find(r => r.name === selectedItem);
          if (targetRate && targetRate.type === 'gold') {
            finalAmountToSend = finalValue / 10;
          } else {
            finalAmountToSend = finalValue / 1000;
          }
        }
      }

      const payload = {
        value: finalAmountToSend,
        adjustmentType: adjustValueType // 'amount' or 'percentage'
      };

      const itemNameToSend = selectedItem === 'all' ? 'all' : selectedItem;
      if (selectedItem !== 'all') {
        payload.itemName = selectedItem;
      }

      let amountValue = finalAmountToSend;

      // OPTIMISTIC UPDATE: Update local rates state immediately
      setRates(prevRates => {
        return prevRates.map(r => {
          let shouldAdjust = false;
          if (selectedItem === 'all') {
            shouldAdjust = true;
          } else if (selectedItem === 'category:gold') {
            shouldAdjust = r.type === 'gold';
          } else if (selectedItem === 'category:silver') {
            shouldAdjust = r.type !== 'gold';
          } else if ((r.originalName || r.name) === itemNameToSend) {
            shouldAdjust = true;
          }

          if (shouldAdjust) {
            const currentPercentage = r.manualAdjustmentPercentage || 0;
            const currentAdjustment = r.manualAdjustment || 0;
            const currentRatePerGram = r.ratePerGram || 0;

            // Derive the market base price (Normal Price) from stored values
            const currentNormalPrice = (currentRatePerGram - currentAdjustment) / (1 + currentPercentage / 100);

            let newManualAdjustment = currentAdjustment;
            let newPercentage = currentPercentage;

            if (isPercentage) {
              newPercentage += amountValue;
            } else {
              newManualAdjustment += amountValue;
            }

            const newRatePerGram = Math.max(0, currentNormalPrice * (1 + newPercentage / 100) + newManualAdjustment);

            let weightFactor = r.weight?.value || 1;
            if (r.weight?.unit === 'kg') weightFactor *= 1000;

            return {
              ...r,
              manualAdjustment: newManualAdjustment,
              manualAdjustmentPercentage: newPercentage,
              ratePerGram: newRatePerGram,
              rate: newRatePerGram * weightFactor
            };
          }
          return r;
        });
      });

      setAdjustDialogOpen(false);
      setAdjustValue('');

      const response = await api.post('/admin/adjust-rates', payload, {
        timeout: 60000 // 60 seconds timeout - backend may trigger rate update
      });

      const message = response.data?.message || `Rates adjusted successfully`;
      console.log('✅ Adjust rates success:', message);

      // Background fetch to confirm (silent=true)
      fetchRates(true, true);
    } catch (error) {
      // Refresh rates on error to rollback optimistic changes
      await fetchRates(true);
      const errorMsg = error.response?.data?.message || error.response?.data?.error || 'Failed to adjust rates';
      Alert.alert('Error', errorMsg);
      console.error('Adjust rates error:', error);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleEditProduct = useCallback((product) => {
    setEditingProduct(product);
    // Use displayName if it's different from original, otherwise use current name
    const currentDisplayName = product.displayName !== undefined && product.displayName !== null
      ? product.displayName
      : (product.originalName || product.name || '');
    setEditProductName(currentDisplayName);
    setEditProductDialogOpen(true);
  }, []);

  const handleSaveProduct = async () => {
    if (!editingProduct) return;

    try {
      setLoadingAction(true);
      // Use originalName if available (for admin), otherwise use name
      const productName = editingProduct.originalName || editingProduct.name || editingProduct._id;
      const response = await api.put('/admin/product', {
        productName: productName,
        displayName: editProductName.trim() || null, // null means use original name
        isVisible: editingProduct.isVisible !== undefined ? editingProduct.isVisible : true
      });
      Alert.alert('Success', response.data.message || 'Product updated successfully');
      setEditProductDialogOpen(false);
      setEditingProduct(null);
      setEditProductName('');
      await fetchRates(true); // Refresh rates
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to update product');
      console.error('Update product error:', error);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleToggleVisibility = useCallback(async (product) => {
    try {
      setLoadingAction(true);
      const currentVisibility = product.isVisible !== undefined ? product.isVisible : true;
      const newVisibility = !currentVisibility;

      // Prioritize _id if available (most reliable), then originalName, then name
      // Backend can match by ObjectId, name, or displayName
      const productId = product._id;
      const productName = product.originalName || product.name || (productId ? productId.toString() : null);

      // Use _id as productName if it's a valid ObjectId (24 hex chars)
      const identifierToSend = (productId && productId.toString().match(/^[0-9a-fA-F]{24}$/))
        ? productId.toString()
        : productName;

      console.log(`🔄 Toggling visibility for product:`, {
        identifierToSend,
        productId: productId?.toString(),
        productName,
        currentName: product.name,
        originalName: product.originalName,
        currentVisibility,
        newVisibility
      });

      // Optimistically update local state for immediate UI feedback
      // Match by _id first (most reliable), then by originalName, then by name
      setRates(prevRates =>
        prevRates.map(rate => {
          // Try to match by _id first (most reliable)
          if (productId && rate._id && rate._id.toString() === productId.toString()) {
            console.log(`✅ Optimistic update: Matched by _id: ${rate._id}`);
            return { ...rate, isVisible: newVisibility };
          }
          // Then try by originalName
          const rateOriginalName = rate.originalName || rate.name;
          if (rateOriginalName === productName) {
            console.log(`✅ Optimistic update: Matched by originalName: ${rateOriginalName}`);
            return { ...rate, isVisible: newVisibility };
          }
          // Finally try by name (might be displayName)
          if (rate.name === productName || rate.name === product.name) {
            console.log(`✅ Optimistic update: Matched by name: ${rate.name}`);
            return { ...rate, isVisible: newVisibility };
          }
          return rate;
        })
      );

      console.log(`📤 Sending update request:`, {
        productName: identifierToSend,
        isVisible: newVisibility,
        url: '/admin/product'
      });

      const response = await api.put('/admin/product', {
        productName: identifierToSend,
        isVisible: newVisibility
      });

      console.log(`✅ Backend response:`, response.data);

      // Verify the response contains the updated product
      if (response.data?.product) {
        console.log(`✅ Product updated in backend:`, {
          name: response.data.product.name,
          isVisible: response.data.product.isVisible,
          displayName: response.data.product.displayName
        });
      }

      // Force immediate refresh without delay to get latest state
      await fetchRates(true);

      // Verify the updated state in the refreshed rates
      const refreshedRates = await api.get('/rates', {
        params: {
          skipUpdate: 'true',
          admin: 'true'
        }
      });
      const updatedProduct = refreshedRates.data.find(r => {
        const rId = r._id?.toString();
        const rName = r.originalName || r.name;
        // Match by _id first (most reliable)
        if (productId && rId && rId === productId.toString()) {
          return true;
        }
        // Then by originalName
        if (rName === productName) {
          return true;
        }
        // Finally by name
        if (r.name === productName || r.name === product.name) {
          return true;
        }
        return false;
      });

      if (updatedProduct) {
        console.log(`✅ Verified updated product in fresh fetch:`, {
          name: updatedProduct.name,
          originalName: updatedProduct.originalName,
          isVisible: updatedProduct.isVisible
        });
      } else {
        console.warn(`⚠️ Could not find updated product in fresh fetch`);
      }

      // Show success feedback
      Alert.alert('Success', `Product ${newVisibility ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error('❌ Toggle visibility error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      // Revert optimistic update on error
      const productIdForRevert = product._id;
      const productNameForRevert = product.originalName || product.name || (productIdForRevert ? productIdForRevert.toString() : null);
      const originalVisibility = product.isVisible !== undefined ? product.isVisible : true;
      setRates(prevRates =>
        prevRates.map(rate => {
          // Match by _id first
          if (productIdForRevert && rate._id && rate._id.toString() === productIdForRevert.toString()) {
            return { ...rate, isVisible: originalVisibility };
          }
          // Then by originalName
          const rateOriginalName = rate.originalName || rate.name;
          if (rateOriginalName === productNameForRevert) {
            return { ...rate, isVisible: originalVisibility };
          }
          // Finally by name
          if (rate.name === productNameForRevert || rate.name === product.name) {
            return { ...rate, isVisible: originalVisibility };
          }
          return rate;
        })
      );

      const errorMsg = error.response?.data?.message || error.message || 'Failed to update product visibility';
      Alert.alert('Error', errorMsg);
    } finally {
      setLoadingAction(false);
    }
  }, []);

  const fetchNews = async () => {
    try {
      setLoadingNews(true);
      const response = await api.get('/news/admin/all');
      console.log('News response:', response.data);
      setNewsPosts(response.data?.news || []);
      if (response.data?.news?.length === 0) {
        console.log('No news posts found in database');
      }
    } catch (error) {
      console.error('Error fetching news:', error);
      console.error('Error response:', error.response?.data);
      setNewsPosts([]);
      Alert.alert('Error', error.response?.data?.message || 'Failed to fetch news posts. Please check console for details.');
    } finally {
      setLoadingNews(false);
    }
  };

  const fetchStoreInfo = async () => {
    try {
      setLoadingStore(true);
      const response = await api.get('/store/info');
      const storeData = response.data || {};
      setStoreInfo(storeData);
      // Preserve all fields including storeTimings and bankDetails
      setStoreForm({
        welcomeMessage: storeData.welcomeMessage || '',
        address: storeData.address || '',
        phoneNumber: storeData.phoneNumber || '',
        instagram: storeData.instagram || '',
        facebook: storeData.facebook || '',
        youtube: storeData.youtube || '',
        storeTimings: storeData.storeTimings || [],
        bankDetails: storeData.bankDetails || []
      });
    } catch (error) {
      console.error('Error fetching store info:', error);
      Alert.alert('Error', 'Failed to fetch store information');
    } finally {
      setLoadingStore(false);
    }
  };

  const handleCreateNews = () => {
    setEditingNews(null);
    setNewsForm({ title: '', content: '', image: '', category: 'general', tags: '', published: false });
    setNewsDialogOpen(true);
  };

  const handleEditNews = (news) => {
    setEditingNews(news);
    setNewsForm({
      title: news.title,
      content: news.content,
      image: news.image || '',
      category: news.category || 'general',
      tags: news.tags?.join(', ') || '',
      published: news.published || false
    });
    setNewsDialogOpen(true);
  };

  const handleSaveNews = async () => {
    if (!newsForm.title || !newsForm.content) {
      Alert.alert('Error', 'Title and content are required');
      return;
    }
    try {
      setLoadingAction(true);
      const payload = {
        ...newsForm,
        tags: newsForm.tags ? newsForm.tags.split(',').map(t => t.trim()).filter(t => t) : []
      };
      if (editingNews) {
        await api.put(`/news/${editingNews._id}`, payload);
        Alert.alert('Success', 'News post updated successfully');
      } else {
        await api.post('/news', payload);
        Alert.alert('Success', 'News post created successfully');
      }
      setNewsDialogOpen(false);
      setNewsForm({ title: '', content: '', image: '', category: 'general', tags: '', published: false });
      await fetchNews(); // Refresh news list
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to save news post');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDeleteNews = async (id) => {
    Alert.alert(
      'Delete News',
      'Are you sure you want to delete this news post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoadingAction(true);
              await api.delete(`/news/${id}`);
              Alert.alert('Success', 'News post deleted successfully');
              await fetchNews(); // Refresh news list
            } catch (error) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to delete news post');
            } finally {
              setLoadingAction(false);
            }
          },
        },
      ]
    );
  };

  const handleSaveStoreInfo = async () => {
    try {
      setLoadingAction(true);

      // Prepare the data to send - ensure arrays are properly formatted
      const dataToSend = {
        welcomeMessage: storeForm.welcomeMessage || '',
        address: storeForm.address || '',
        phoneNumber: storeForm.phoneNumber || '',
        instagram: storeForm.instagram || '',
        facebook: storeForm.facebook || '',
        youtube: storeForm.youtube || '',
        storeTimings: Array.isArray(storeForm.storeTimings) ? storeForm.storeTimings : [],
        bankDetails: Array.isArray(storeForm.bankDetails) ? storeForm.bankDetails : []
      };

      // Validate data before sending
      if (!dataToSend.welcomeMessage && !dataToSend.address && !dataToSend.phoneNumber) {
        Alert.alert('Error', 'Please fill in at least one field (Welcome Message, Address, or Phone Number)');
        return;
      }

      console.log('Saving store info:', JSON.stringify(dataToSend, null, 2));
      console.log('Request URL:', '/store/info');
      console.log('Request method:', 'PUT');

      const response = await api.put('/store/info', dataToSend, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('Store info saved response:', response.data);

      if (response.data && response.data.storeInfo) {
        // Update local state with the response data
        setStoreInfo(response.data.storeInfo);
        setStoreForm({
          welcomeMessage: response.data.storeInfo.welcomeMessage || '',
          address: response.data.storeInfo.address || '',
          phoneNumber: response.data.storeInfo.phoneNumber || '',
          instagram: response.data.storeInfo.instagram || '',
          facebook: response.data.storeInfo.facebook || '',
          youtube: response.data.storeInfo.youtube || '',
          storeTimings: response.data.storeInfo.storeTimings || [],
          bankDetails: response.data.storeInfo.bankDetails || []
        });
      }

      Alert.alert('Success', 'Store information updated successfully');
      setStoreDialogOpen(false);
      await fetchStoreInfo(); // Refresh store info display
    } catch (error) {
      console.error('Error saving store info:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          data: error.config?.data
        }
      });

      let errorMessage = 'Failed to update store information.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }

      if (error.response?.status === 401) {
        errorMessage = 'Unauthorized. Please login again.';
      } else if (error.response?.status === 403) {
        errorMessage = 'Forbidden. Admin access required.';
      } else if (error.response?.status === 503) {
        errorMessage = 'Database connection unavailable. Please try again later.';
      } else if (!error.response) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setLoadingAction(false);
    }
  };

  // Memoize status color function
  const getStatusColor = useCallback((status) => {
    switch (status) {
      case 'approved':
        return colors.success;
      case 'rejected':
        return colors.error;
      case 'pending':
        return colors.warning;
      default:
        return colors.textSecondary;
    }
  }, []);

  // Memoize users list to prevent unnecessary recalculations
  const usersToShow = useMemo(() => {
    return activeTab === 'pending' ? pendingUsers : allUsers;
  }, [activeTab, pendingUsers, allUsers]);

  // Memoize tab handlers
  const handleMainTabChange = useCallback((tabIndex) => {
    setMainTab(tabIndex);
  }, []);

  const handleActiveTabChange = useCallback((tab) => {
    setActiveTab(tab);
  }, []);

  const handleRefreshRates = useCallback(() => {
    fetchRates(true);
  }, []);

  const handleOpenAdjustDialog = useCallback((type) => {
    setAdjustType(type);
    setAdjustValueType('amount');
    setAdjustValue('');
    setSelectedItem('all');
    setAdjustDialogOpen(true);
  }, []);

  const handleSelectItem = useCallback((itemName) => {
    setSelectedItem(itemName);
  }, []);

  const handleSetAdjustValueType = useCallback((type) => {
    setAdjustValueType(type);
  }, []);

  const handleNavigateToDocuments = useCallback((userId) => {
    navigation.navigate('UserDocuments', { userId });
  }, [navigation]);

  // Memoize calculateOriginalRate function
  const calculateOriginalRate = useCallback((rate) => {
    const adjustment = rate.manualAdjustment || 0;
    const currentRatePerGram = rate.ratePerGram || 0;
    let weightInGrams = rate.weight?.value || 1;
    if (rate.weight?.unit === 'kg') {
      weightInGrams = weightInGrams * 1000;
    }
    const currentTotalRate = rate.rate || 0;

    // If showing "as it is" and we have base rate from source, use it
    if (showOriginalRates && baseRateFromSource && baseRateFromSource.baseRatePerGram) {
      // Calculate original rate based on current base rate from RB Gold and purity
      let baseRate = baseRateFromSource.baseRatePerGram;

      // Apply purity adjustments (same as backend does)
      if (rate.purity === '92.5%') {
        baseRate = baseRate * 0.96;
      }
      // Both 99.9% and 99.99% use base rate as-is (no multiplier)

      return Math.round(baseRate * 100) / 100;
    } else if (showOriginalRates) {
      // Fallback: Calculate original from current rate - adjustment
      // Formula: Original = Current - Adjustment
      // This reverses the adjustment to get the true original rate from RB Gold
      let originalRatePerGram = currentRatePerGram - adjustment;

      // Validate calculated original rate
      // If current rate is 0 (clamped), original should be positive
      if (currentRatePerGram === 0 && adjustment < 0) {
        // Rate was clamped to 0, so original = |adjustment| or higher
        // Try stored originalRatePerGram first
        if (rate.originalRatePerGram && rate.originalRatePerGram > Math.abs(adjustment)) {
          originalRatePerGram = rate.originalRatePerGram;
        } else if (rate.originalRate && rate.originalRate > 0) {
          originalRatePerGram = rate.originalRate / weightInGrams;
        } else {
          // Estimate: if adjustment is -92.25, original was likely around 92-184
          // Use stored originalRatePerGram if reasonable, otherwise estimate
          if (rate.originalRatePerGram && rate.originalRatePerGram > 0) {
            originalRatePerGram = rate.originalRatePerGram;
          } else {
            // Conservative estimate: assume adjustment is 50% of original
            originalRatePerGram = Math.abs(adjustment) * 2;
          }
        }
      } else if (originalRatePerGram <= 0) {
        // Calculated original is invalid, try stored values
        if (rate.originalRatePerGram && rate.originalRatePerGram > 0) {
          originalRatePerGram = rate.originalRatePerGram;
        } else if (rate.originalRate && rate.originalRate > 0) {
          originalRatePerGram = rate.originalRate / weightInGrams;
        } else {
          // Last resort: estimate
          originalRatePerGram = Math.max(Math.abs(adjustment) * 2, 100);
        }
      }

      // Final validation: ensure original is reasonable
      if (originalRatePerGram <= 0) {
        originalRatePerGram = Math.max(Math.abs(adjustment), 50);
      }

      return originalRatePerGram;
    } else {
      // Fallback: Calculate from current rate and adjustment
      // Priority 1: Use stored originalRatePerGram if it exists and seems reasonable
      let originalRatePerGram;
      if (rate.originalRatePerGram && rate.originalRatePerGram > 0) {
        // Check if stored original makes sense
        const calculatedFromStored = rate.originalRatePerGram - adjustment;
        // If calculated rate from stored original matches current rate (within tolerance), use stored
        if (Math.abs(calculatedFromStored - currentRatePerGram) < 1 || currentRatePerGram === 0) {
          originalRatePerGram = rate.originalRatePerGram;
        } else {
          // Stored original doesn't match, calculate from current
          originalRatePerGram = currentRatePerGram - adjustment;
        }
      } else {
        // Priority 2: Calculate from current rate and adjustment
        originalRatePerGram = currentRatePerGram - adjustment;

        // If calculated original is unreasonable (too low), try stored originalRate
        if (originalRatePerGram <= 0 && rate.originalRate && rate.originalRate > 0) {
          // Calculate from total original rate
          originalRatePerGram = rate.originalRate / weightInGrams;
        }
      }

      // Final validation: ensure original rate is positive and reasonable
      if (originalRatePerGram <= 0 || originalRatePerGram < Math.abs(adjustment)) {
        // If still invalid, use stored originalRatePerGram as last resort
        if (rate.originalRatePerGram && rate.originalRatePerGram > Math.abs(adjustment)) {
          originalRatePerGram = rate.originalRatePerGram;
        } else {
          // Estimate: if adjustment is large negative, original was likely 2x the adjustment
          originalRatePerGram = Math.max(Math.abs(adjustment) * 2, 100); // At least ₹100/gram
        }
      }

      return originalRatePerGram;
    }
  }, [showOriginalRates, baseRateFromSource]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Image
            source={require('../assets/Gemini_Generated_Image_8ia19c8ia19c8ia1.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View style={styles.headerTextContainer}>
            <Text variant="headlineMedium" style={styles.headerTitle}>
              Admin Dashboard
            </Text>
            <Text variant="bodyMedium" style={styles.headerSubtitle}>
              {user?.name || 'Admin'}
            </Text>
          </View>
        </View>
        <Button
          mode="contained"
          onPress={handleLogout}
          style={styles.logoutButton}
          buttonColor={colors.white}
          textColor={colors.primaryDark}
          labelStyle={styles.logoutButtonText}
        >
          Logout
        </Button>
      </View>

      {/* Main Navigation Tabs */}
      <View style={styles.mainTabs}>
        <Button
          mode={mainTab === 0 ? 'contained' : 'outlined'}
          onPress={() => handleMainTabChange(0)}
          style={styles.mainTabButton}
          icon="account"
        >
          Users
        </Button>
        <Button
          mode={mainTab === 1 ? 'contained' : 'outlined'}
          onPress={() => handleMainTabChange(1)}
          style={styles.mainTabButton}
          icon="newspaper"
        >
          News
        </Button>
        <Button
          mode={mainTab === 2 ? 'contained' : 'outlined'}
          onPress={() => handleMainTabChange(2)}
          style={styles.mainTabButton}
          icon="store"
        >
          Store
        </Button>
      </View>

      {/* Users Tab Content */}
      {mainTab === 0 && (
        <ScrollView
          style={styles.tabScrollView}
          contentContainerStyle={styles.tabScrollContent}
          showsVerticalScrollIndicator={true}
        >
          {/* Rate Adjustment Card */}
          <Card style={styles.rateAdjustCard} elevation={4}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.rateAdjustTitle}>
                Rate Adjustment
              </Text>
              <Text variant="bodyMedium" style={styles.rateAdjustDescription}>
                Adjust metal rates. Enter value to increase or decrease rates (per 10g for gold, per kg for silver).
              </Text>
              <View style={styles.rateAdjustButtons}>
                <Button
                  mode="contained"
                  onPress={() => handleOpenAdjustDialog('decrease')}
                  style={styles.decreaseButton}
                  buttonColor={colors.error}
                  textColor={colors.white}
                  icon="minus-circle"
                  disabled={loadingAction}
                >
                  Decrease
                </Button>
                <Button
                  mode="contained"
                  onPress={() => handleOpenAdjustDialog('increase')}
                  style={styles.increaseButton}
                  buttonColor={colors.success}
                  textColor={colors.white}
                  icon="plus-circle"
                  disabled={loadingAction}
                >
                  Increase
                </Button>
              </View>
              <View style={styles.showAsItIsContainer}>
                <Chip
                  style={[styles.showAsItIsChip, { backgroundColor: globalShowAsItIs ? colors.success : colors.textSecondary }]}
                  textStyle={styles.showAsItIsChipText}
                >
                  {globalShowAsItIs ? 'Global: Show As It Is ON' : 'Global: Show As It Is OFF'}
                </Chip>
                <Button
                  mode={globalShowAsItIs ? "contained" : "outlined"}
                  onPress={toggleShowAsItIs}
                  style={styles.showAsItIsButton}
                  icon="refresh"
                  disabled={loadingAction || loadingRates}
                >
                  {globalShowAsItIs ? 'Disable Show As It Is' : 'Enable Show As It Is'}
                </Button>
              </View>
            </Card.Content>
          </Card>

          {/* Current Rates Display Card */}
          <Card style={styles.ratesCard} elevation={4}>
            <Card.Content>
              <View style={styles.ratesHeader}>
                <Text variant="titleLarge" style={styles.ratesTitle}>
                  Current Silver Rates
                </Text>
                <Button size="small" onPress={handleRefreshRates} disabled={loadingRates}>
                  Refresh
                </Button>
              </View>
              {loadingRates ? (
                <Text style={styles.loadingText}>Loading rates...</Text>
              ) : rates.length > 0 ? (
                <ScrollView horizontal>
                  <View>
                    {rates.map((rate) => {
                      // Use displayName if available, otherwise use name or originalName
                      const displayName = rate.displayName || rate.name || rate.originalName || 'Unknown';
                      const hasAdjustment = rate.manualAdjustment && rate.manualAdjustment !== 0;
                      const adjustment = rate.manualAdjustment || 0;
                      let weightInGrams = rate.weight?.value || 1;
                      if (rate.weight?.unit === 'kg') {
                        weightInGrams = weightInGrams * 1000;
                      }
                      const originalRatePerGram = calculateOriginalRate(rate);
                      const originalTotalPrice = Math.round(originalRatePerGram * weightInGrams * 100) / 100;
                      // Use ratePerGram and rate from backend (already includes adjustments)
                      const currentRatePerGram = rate.ratePerGram || 0;
                      const currentTotalRate = rate.rate || 0;
                      // Adjusted values are what's shown to users (current rates)
                      const adjustedPrice = currentTotalRate;
                      const adjustedRatePerGram = currentRatePerGram;

                      const isVisible = rate.isVisible !== undefined ? rate.isVisible : true;

                      // Debug logging for disabled products
                      if (isVisible === false) {
                        console.log('🚫 Rendering disabled product:', {
                          name: displayName,
                          originalName: rate.originalName,
                          isVisible: rate.isVisible,
                          hasIsVisible: rate.hasOwnProperty('isVisible')
                        });
                      }

                      return (
                        <Card key={rate._id || rate.originalName || rate.name} style={[
                          styles.rateItemCard,
                          !isVisible && styles.rateItemCardDisabled
                        ]}>
                          <Card.Content>
                            <View style={styles.rateItemHeader}>
                              <Text variant="titleMedium" style={[
                                styles.rateItemName,
                                !isVisible && styles.rateItemNameDisabled
                              ]}>
                                {displayName}
                              </Text>
                              {!isVisible && (
                                <Chip
                                  style={styles.disabledChip}
                                  textStyle={styles.disabledChipText}
                                  icon="eye-off"
                                >
                                  Hidden
                                </Chip>
                              )}
                            </View>
                            <Text variant="bodySmall" style={[
                              styles.rateItemDetails,
                              !isVisible && styles.rateItemDetailsDisabled
                            ]}>
                              {rate.purity} • {rate.weight?.value} {rate.weight?.unit}
                            </Text>
                            {showOriginalRates ? (
                              <>
                                <Text variant="bodyMedium" style={styles.rateItemPrice}>
                                  ₹{originalTotalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Text>
                                <Text variant="bodySmall" style={styles.rateItemPerGram}>
                                  {rate.type === 'gold'
                                    ? `₹${Number((originalRatePerGram || 0) * 10).toFixed(2)}/10g`
                                    : `₹${Number((originalRatePerGram || 0) * 1000).toFixed(2)}/kg`
                                  }
                                </Text>
                              </>
                            ) : (
                              <>
                                <Text variant="bodySmall" style={styles.rateItemOriginal}>
                                  Original: ₹{originalTotalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Text>
                                <Text variant="bodySmall" style={[styles.rateItemPerGram, { color: colors.textSecondary }]}>
                                  {rate.type === 'gold'
                                    ? `₹${Number((originalRatePerGram || 0) * 10).toFixed(2)}/10g`
                                    : `₹${Number((originalRatePerGram || 0) * 1000).toFixed(2)}/kg`
                                  }
                                </Text>
                                <Text variant="bodyMedium" style={[styles.rateItemPrice, {
                                  color: adjustedPrice === 0 ? colors.error : (hasAdjustment ? (adjustment > 0 ? colors.success : colors.error) : colors.textPrimary),
                                  fontWeight: hasAdjustment ? '600' : '400'
                                }]}>
                                  ₹{adjustedPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Text>
                                <Text variant="bodySmall" style={[styles.rateItemPerGram, {
                                  color: adjustedPrice === 0 ? colors.error : colors.textSecondary
                                }]}>
                                  {rate.type === 'gold'
                                    ? `₹${Number((adjustedRatePerGram || 0) * 10).toFixed(2)}/10g`
                                    : `₹${Number((adjustedRatePerGram || 0) * 1000).toFixed(2)}/kg`
                                  }
                                </Text>
                                {hasAdjustment ? (
                                  <View style={{ alignItems: 'center', marginTop: 4 }}>
                                    <Chip
                                      style={[styles.adjustmentChip, { backgroundColor: adjustment > 0 ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)', borderColor: adjustment > 0 ? colors.success : colors.error, borderWidth: 1 }]}
                                      textStyle={[styles.adjustmentChipText, { color: adjustment > 0 ? colors.success : colors.error }]}
                                    >
                                      {`${adjustment > 0 ? '+' : ''}${rate.type === 'gold' ? (adjustment * 10).toFixed(2) : (adjustment * 1000).toFixed(2)}`}
                                    </Chip>
                                    <Text variant="bodySmall" style={{ color: colors.textSecondary, fontSize: 9, marginTop: 2 }}>
                                      {rate.type === 'gold' ? 'per 10g' : 'per kg'}
                                    </Text>
                                  </View>
                                ) : (
                                  <Text variant="bodySmall" style={{ color: colors.textSecondary, fontSize: 10, marginTop: 4 }}>
                                    —
                                  </Text>
                                )}
                              </>
                            )}
                            <View style={styles.rateItemActions}>
                              <View style={styles.visibilityContainer}>
                                <Text variant="bodySmall" style={!isVisible && styles.visibilityLabelDisabled}>
                                  {isVisible ? 'Visible' : 'Hidden'}
                                </Text>
                                <Switch
                                  value={isVisible}
                                  onValueChange={() => handleToggleVisibility(rate)}
                                  disabled={loadingAction}
                                  trackColor={{ false: colors.error, true: colors.success }}
                                />
                              </View>
                              <Button
                                mode="outlined"
                                onPress={() => handleEditProduct(rate)}
                                disabled={loadingAction}
                                style={styles.editProductButton}
                                icon="pencil"
                              >
                                Edit
                              </Button>
                            </View>
                          </Card.Content>
                        </Card>
                      );
                    })}
                  </View>
                </ScrollView>
              ) : (
                <Text style={styles.emptyText}>No rates available</Text>
              )}
            </Card.Content>
          </Card>

          {/* Users Table Card */}
          <Card style={styles.usersCard} elevation={4}>
            <Card.Content>
              <View style={styles.tabs}>
                <Button
                  mode={activeTab === 'pending' ? 'contained' : 'outlined'}
                  onPress={() => handleActiveTabChange('pending')}
                  style={styles.tabButton}
                >
                  Pending ({pendingUsers.length})
                </Button>
                <Button
                  mode={activeTab === 'all' ? 'contained' : 'outlined'}
                  onPress={() => handleActiveTabChange('all')}
                  style={styles.tabButton}
                >
                  All Users ({allUsers.length})
                </Button>
              </View>

              {loading ? (
                <Text style={styles.loadingText}>Loading...</Text>
              ) : usersToShow.length === 0 ? (
                <Text style={styles.emptyText}>No users found</Text>
              ) : (
                <View style={styles.usersList}>
                  {usersToShow.map((userItem) => (
                    <Card key={userItem._id} style={styles.userCard}>
                      <Card.Content>
                        <View style={styles.userHeader}>
                          <View style={styles.userInfo}>
                            <Text variant="titleMedium" style={styles.userName}>
                              {userItem.name}
                            </Text>
                            <Text variant="bodyMedium" style={styles.userEmail}>
                              {userItem.email}
                            </Text>
                            <Text variant="bodySmall" style={styles.userPhone}>
                              {userItem.phone}
                            </Text>
                          </View>
                          <Chip
                            style={[styles.statusChip, { backgroundColor: getStatusColor(userItem.status) }]}
                            textStyle={styles.statusText}
                          >
                            {userItem.status.toUpperCase()}
                          </Chip>
                        </View>

                        <View style={styles.actions}>
                          <Button
                            mode="outlined"
                            icon="file-document"
                            onPress={() => handleNavigateToDocuments(userItem._id)}
                            style={styles.viewDocsButton}
                          >
                            View Documents
                          </Button>
                        </View>

                        {userItem.status === 'pending' && (
                          <View style={styles.actions}>
                            <Button
                              mode="contained"
                              onPress={() => handleApprove(userItem._id)}
                              style={[styles.actionButton, styles.approveButton]}
                              disabled={loadingAction}
                            >
                              Approve
                            </Button>
                            <Button
                              mode="outlined"
                              onPress={() => handleReject(userItem._id)}
                              style={[styles.actionButton, styles.rejectButton]}
                              disabled={loadingAction}
                            >
                              Reject
                            </Button>
                          </View>
                        )}

                        {userItem.approvedAt && (
                          <Text variant="bodySmall" style={styles.approvedText}>
                            {userItem.status === 'approved' ? 'Approved' : 'Rejected'} on:{' '}
                            {new Date(userItem.approvedAt).toLocaleString()}
                          </Text>
                        )}
                      </Card.Content>
                    </Card>
                  ))}
                </View>
              )}
            </Card.Content>
          </Card>
        </ScrollView>
      )}

      {/* News Tab Content */}
      {mainTab === 1 && (
        <ScrollView style={styles.tabScrollView} contentContainerStyle={styles.tabScrollContent}>
          <Card style={styles.newsCard} elevation={4}>
            <Card.Content>
              <View style={styles.newsHeader}>
                <Text variant="titleLarge" style={styles.newsTitle}>
                  News Posts
                </Text>
                <Button
                  mode="contained"
                  onPress={handleCreateNews}
                  icon="plus"
                  disabled={loadingAction}
                >
                  New Post
                </Button>
              </View>
              {loadingNews ? (
                <Text style={styles.loadingText}>Loading news...</Text>
              ) : newsPosts.length === 0 ? (
                <Text style={styles.emptyText}>No news posts found. Create your first post!</Text>
              ) : (
                newsPosts.map((post) => (
                  <Card key={post._id} style={styles.newsItemCard}>
                    <Card.Content>
                      <Text variant="titleMedium" style={styles.newsItemTitle}>
                        {post.title}
                      </Text>
                      <View style={styles.newsItemMeta}>
                        <Chip label={post.category} style={styles.newsCategoryChip} />
                        <Chip
                          label={post.published ? 'Published' : 'Draft'}
                          style={[styles.newsStatusChip, { backgroundColor: post.published ? colors.success : colors.textSecondary }]}
                          textStyle={styles.newsStatusChipText}
                        />
                        <Text variant="bodySmall" style={styles.newsItemViews}>
                          Views: {post.views || 0}
                        </Text>
                      </View>
                      <Text variant="bodySmall" style={styles.newsItemDate}>
                        {new Date(post.createdAt).toLocaleDateString()}
                      </Text>
                      <View style={styles.newsItemActions}>
                        <Button
                          mode="outlined"
                          onPress={() => handleEditNews(post)}
                          icon="pencil"
                          style={styles.newsActionButton}
                        >
                          Edit
                        </Button>
                        <Button
                          mode="outlined"
                          onPress={() => handleDeleteNews(post._id)}
                          icon="delete"
                          buttonColor={colors.error}
                          textColor={colors.white}
                          style={styles.newsActionButton}
                        >
                          Delete
                        </Button>
                      </View>
                    </Card.Content>
                  </Card>
                ))
              )}
            </Card.Content>
          </Card>
        </ScrollView>
      )}

      {/* Store/Profile Tab Content */}
      {mainTab === 2 && (
        <ScrollView style={styles.tabScrollView} contentContainerStyle={styles.tabScrollContent}>
          <Card style={styles.storeCard} elevation={4}>
            <Card.Content>
              <View style={styles.storeHeader}>
                <Text variant="titleLarge" style={styles.storeTitle}>
                  Store Information
                </Text>
                <Button
                  mode="contained"
                  onPress={() => setStoreDialogOpen(true)}
                  disabled={loadingAction}
                >
                  Edit Store Info
                </Button>
              </View>
              {loadingStore ? (
                <Text style={styles.loadingText}>Loading store info...</Text>
              ) : storeInfo ? (
                <View>
                  <View style={styles.storeInfoRow}>
                    <Text variant="titleSmall" style={styles.storeInfoLabel}>Welcome Message</Text>
                    <Text variant="bodyMedium">{storeInfo.welcomeMessage || 'N/A'}</Text>
                  </View>
                  <View style={styles.storeInfoRow}>
                    <Text variant="titleSmall" style={styles.storeInfoLabel}>Phone Number</Text>
                    <Text variant="bodyMedium">{storeInfo.phoneNumber || 'N/A'}</Text>
                  </View>
                  <View style={styles.storeInfoRow}>
                    <Text variant="titleSmall" style={styles.storeInfoLabel}>Address</Text>
                    <Text variant="bodyMedium">{storeInfo.address || 'N/A'}</Text>
                  </View>
                  <View style={styles.storeInfoRow}>
                    <Text variant="titleSmall" style={styles.storeInfoLabel}>Instagram</Text>
                    <Text variant="bodySmall">{storeInfo.instagram || 'N/A'}</Text>
                  </View>
                  <View style={styles.storeInfoRow}>
                    <Text variant="titleSmall" style={styles.storeInfoLabel}>Facebook</Text>
                    <Text variant="bodySmall">{storeInfo.facebook || 'N/A'}</Text>
                  </View>
                  <View style={styles.storeInfoRow}>
                    <Text variant="titleSmall" style={styles.storeInfoLabel}>YouTube</Text>
                    <Text variant="bodySmall">{storeInfo.youtube || 'N/A'}</Text>
                  </View>
                  {storeInfo.storeTimings && storeInfo.storeTimings.length > 0 && (
                    <View style={styles.storeInfoRow}>
                      <Text variant="titleSmall" style={styles.storeInfoLabel}>Store Timings</Text>
                      {storeInfo.storeTimings.map((timing, index) => (
                        <View key={index} style={styles.timingItem}>
                          <Text variant="bodySmall">
                            <Text style={styles.timingDay}>{timing.day}:</Text>{' '}
                            {timing.isClosed ? 'Closed' : `${timing.openTime} - ${timing.closeTime}`}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {storeInfo.bankDetails && storeInfo.bankDetails.length > 0 && (
                    <View style={styles.storeInfoRow}>
                      <Text variant="titleSmall" style={styles.storeInfoLabel}>Bank Details</Text>
                      {storeInfo.bankDetails.map((bank, index) => (
                        <Card key={index} style={styles.bankCard}>
                          <Card.Content>
                            <Text variant="titleSmall" style={styles.bankName}>{bank.bankName}</Text>
                            <Text variant="bodySmall">Account: {bank.accountNumber}</Text>
                            <Text variant="bodySmall">IFSC: {bank.ifscCode}</Text>
                            <Text variant="bodySmall">Holder: {bank.accountHolderName}</Text>
                            <Text variant="bodySmall">Branch: {bank.branch}</Text>
                          </Card.Content>
                        </Card>
                      ))}
                    </View>
                  )}
                </View>
              ) : (
                <Text style={styles.emptyText}>No store information available</Text>
              )}
            </Card.Content>
          </Card>
        </ScrollView>
      )}

      {/* Adjust Rates Dialog */}
      <Portal>
        <Dialog visible={adjustDialogOpen} onDismiss={() => {
          setAdjustDialogOpen(false);
          setAdjustValue('');
          setAdjustValueType('amount');
          setSelectedItem('all');
        }}>
          <Dialog.Title>{adjustType === 'decrease' ? 'Decrease Rates' : 'Increase Rates'}</Dialog.Title>
          <Dialog.Content>
            <Paragraph style={styles.dialogDescription}>
              Choose adjustment type and enter the value to {adjustType === 'decrease' ? 'decrease' : 'increase'} rates.
            </Paragraph>
            <Text variant="labelLarge" style={styles.dialogLabel}>Select Item</Text>
            <View style={styles.selectContainer}>
              <Button
                mode={selectedItem === 'all' ? 'contained' : 'outlined'}
                onPress={() => handleSelectItem('all')}
                style={styles.selectButton}
              >
                All Items
              </Button>
              {rates.map((rate) => (
                <Button
                  key={rate._id || rate.name}
                  mode={selectedItem === rate.name ? 'contained' : 'outlined'}
                  onPress={() => handleSelectItem(rate.name)}
                  style={styles.selectButton}
                >
                  {rate.name}
                </Button>
              ))}
            </View>
            <Text variant="labelLarge" style={styles.dialogLabel}>Adjustment Type</Text>
            <View style={styles.selectContainer}>
              <Button
                mode={adjustValueType === 'amount' ? 'contained' : 'outlined'}
                onPress={() => handleSetAdjustValueType('amount')}
                style={styles.selectButton}
              >
                Amount (₹/10g or ₹/kg)
              </Button>
              <Button
                mode={adjustValueType === 'percentage' ? 'contained' : 'outlined'}
                onPress={() => handleSetAdjustValueType('percentage')}
                style={styles.selectButton}
              >
                Percentage (%)
              </Button>
            </View>
            <TextInput
              style={styles.dialogInput}
              placeholder={adjustValueType === 'amount' ? 'e.g., 50 (₹/10g or ₹/kg)' : 'e.g., 5 (%)'}
              value={adjustValue}
              onChangeText={setAdjustValue}
              keyboardType="numeric"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => {
              setAdjustDialogOpen(false);
              setAdjustValue('');
              setAdjustValueType('amount');
              setSelectedItem('all');
            }} disabled={loadingAction}>
              Cancel
            </Button>
            <Button
              onPress={handleAdjustRates}
              mode="contained"
              disabled={loadingAction || !adjustValue}
            >
              {loadingAction ? 'Applying...' : adjustType === 'decrease' ? 'Decrease' : 'Increase'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Edit Product Dialog */}
      <Portal>
        <Dialog visible={editProductDialogOpen} onDismiss={() => {
          setEditProductDialogOpen(false);
          setEditingProduct(null);
          setEditProductName('');
        }}>
          <Dialog.Title>Edit Product</Dialog.Title>
          <Dialog.Content>
            {editingProduct && (
              <>
                <Paragraph style={styles.dialogDescription}>
                  Original Name: <Text style={styles.dialogBold}>{editingProduct.originalName || editingProduct.name}</Text>
                </Paragraph>
                <TextInput
                  style={styles.dialogInput}
                  placeholder="Display Name (leave empty to use original)"
                  value={editProductName}
                  onChangeText={setEditProductName}
                />
                <Paragraph style={styles.dialogHelperText}>
                  Leave empty to show the original product name to users
                </Paragraph>
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => {
              setEditProductDialogOpen(false);
              setEditingProduct(null);
              setEditProductName('');
            }} disabled={loadingAction}>
              Cancel
            </Button>
            <Button onPress={handleSaveProduct} mode="contained" disabled={loadingAction}>
              {loadingAction ? 'Saving...' : 'Save'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* News Dialog */}
      <Portal>
        <Dialog visible={newsDialogOpen} onDismiss={() => setNewsDialogOpen(false)} style={styles.fullDialog}>
          <Dialog.Title>{editingNews ? 'Edit News Post' : 'Create News Post'}</Dialog.Title>
          <Dialog.ScrollArea>
            <Dialog.Content>
              <TextInput
                style={styles.dialogInput}
                placeholder="Title"
                value={newsForm.title}
                onChangeText={(text) => setNewsForm({ ...newsForm, title: text })}
              />
              <Text variant="labelLarge" style={styles.dialogLabel}>Category</Text>
              <View style={styles.selectContainer}>
                {['general', 'announcement', 'update', 'offer'].map((cat) => (
                  <Button
                    key={cat}
                    mode={newsForm.category === cat ? 'contained' : 'outlined'}
                    onPress={() => setNewsForm({ ...newsForm, category: cat })}
                    style={styles.selectButton}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Button>
                ))}
              </View>
              <TextInput
                style={styles.dialogInput}
                placeholder="Image URL (optional)"
                value={newsForm.image}
                onChangeText={(text) => setNewsForm({ ...newsForm, image: text })}
              />
              <TextInput
                style={styles.dialogInput}
                placeholder="Tags (comma separated)"
                value={newsForm.tags}
                onChangeText={(text) => setNewsForm({ ...newsForm, tags: text })}
              />
              <TextInput
                style={[styles.dialogInput, styles.dialogTextArea]}
                placeholder="Content"
                value={newsForm.content}
                onChangeText={(text) => setNewsForm({ ...newsForm, content: text })}
                multiline
                numberOfLines={6}
              />
              <View style={styles.checkboxContainer}>
                <Switch
                  value={newsForm.published}
                  onValueChange={(value) => setNewsForm({ ...newsForm, published: value })}
                />
                <Text variant="bodyMedium" style={styles.checkboxLabel}>Publish immediately</Text>
              </View>
            </Dialog.Content>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setNewsDialogOpen(false)} disabled={loadingAction}>
              Cancel
            </Button>
            <Button onPress={handleSaveNews} mode="contained" disabled={loadingAction}>
              {loadingAction ? 'Saving...' : editingNews ? 'Update' : 'Create'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Store Info Dialog */}
      <Portal>
        <Dialog visible={storeDialogOpen} onDismiss={() => setStoreDialogOpen(false)} style={styles.fullDialog}>
          <Dialog.Title>Edit Store Information</Dialog.Title>
          <Dialog.ScrollArea>
            <Dialog.Content>
              <TextInput
                style={[styles.dialogInput, styles.dialogTextArea]}
                placeholder="Welcome Message"
                value={storeForm.welcomeMessage || ''}
                onChangeText={(text) => setStoreForm({ ...storeForm, welcomeMessage: text })}
                multiline
                numberOfLines={3}
              />
              <TextInput
                style={styles.dialogInput}
                placeholder="Phone Number"
                value={storeForm.phoneNumber || ''}
                onChangeText={(text) => setStoreForm({ ...storeForm, phoneNumber: text })}
                keyboardType="phone-pad"
              />
              <TextInput
                style={[styles.dialogInput, styles.dialogTextArea]}
                placeholder="Address"
                value={storeForm.address || ''}
                onChangeText={(text) => setStoreForm({ ...storeForm, address: text })}
                multiline
                numberOfLines={2}
              />
              <TextInput
                style={styles.dialogInput}
                placeholder="Instagram URL"
                value={storeForm.instagram || ''}
                onChangeText={(text) => setStoreForm({ ...storeForm, instagram: text })}
              />
              <TextInput
                style={styles.dialogInput}
                placeholder="Facebook URL"
                value={storeForm.facebook || ''}
                onChangeText={(text) => setStoreForm({ ...storeForm, facebook: text })}
              />
              <TextInput
                style={styles.dialogInput}
                placeholder="YouTube URL"
                value={storeForm.youtube || ''}
                onChangeText={(text) => setStoreForm({ ...storeForm, youtube: text })}
              />
              <Text variant="titleSmall" style={styles.dialogLabel}>Store Timings</Text>
              {(storeForm.storeTimings || []).map((timing, index) => (
                <Card key={index} style={styles.timingEditCard}>
                  <Card.Content>
                    <TextInput
                      style={styles.dialogInput}
                      placeholder="Day"
                      value={timing.day || ''}
                      onChangeText={(text) => {
                        const newTimings = [...(storeForm.storeTimings || [])];
                        newTimings[index].day = text;
                        setStoreForm({ ...storeForm, storeTimings: newTimings });
                      }}
                    />
                    <TextInput
                      style={styles.dialogInput}
                      placeholder="Open Time (e.g., 11:00 AM)"
                      value={timing.openTime || ''}
                      onChangeText={(text) => {
                        const newTimings = [...(storeForm.storeTimings || [])];
                        newTimings[index].openTime = text;
                        setStoreForm({ ...storeForm, storeTimings: newTimings });
                      }}
                    />
                    <TextInput
                      style={styles.dialogInput}
                      placeholder="Close Time (e.g., 08:30 PM)"
                      value={timing.closeTime || ''}
                      onChangeText={(text) => {
                        const newTimings = [...(storeForm.storeTimings || [])];
                        newTimings[index].closeTime = text;
                        setStoreForm({ ...storeForm, storeTimings: newTimings });
                      }}
                    />
                    <View style={styles.checkboxContainer}>
                      <Switch
                        value={timing.isClosed || false}
                        onValueChange={(value) => {
                          const newTimings = [...(storeForm.storeTimings || [])];
                          newTimings[index].isClosed = value;
                          setStoreForm({ ...storeForm, storeTimings: newTimings });
                        }}
                      />
                      <Text variant="bodyMedium" style={styles.checkboxLabel}>Closed</Text>
                    </View>
                    <Button
                      mode="outlined"
                      onPress={() => {
                        const newTimings = storeForm.storeTimings.filter((_, i) => i !== index);
                        setStoreForm({ ...storeForm, storeTimings: newTimings });
                      }}
                      icon="delete"
                      buttonColor={colors.error}
                      textColor={colors.white}
                    >
                      Remove
                    </Button>
                  </Card.Content>
                </Card>
              ))}
              <Button
                mode="outlined"
                onPress={() => {
                  const newTimings = [...(storeForm.storeTimings || []), { day: '', openTime: '', closeTime: '', isClosed: false }];
                  setStoreForm({ ...storeForm, storeTimings: newTimings });
                }}
                icon="plus"
              >
                Add Timing
              </Button>
              <Text variant="titleSmall" style={styles.dialogLabel}>Bank Details</Text>
              {(storeForm.bankDetails || []).map((bank, index) => (
                <Card key={index} style={styles.bankEditCard}>
                  <Card.Content>
                    <TextInput
                      style={styles.dialogInput}
                      placeholder="Bank Name"
                      value={bank.bankName || ''}
                      onChangeText={(text) => {
                        const newBanks = [...(storeForm.bankDetails || [])];
                        newBanks[index].bankName = text;
                        setStoreForm({ ...storeForm, bankDetails: newBanks });
                      }}
                    />
                    <TextInput
                      style={styles.dialogInput}
                      placeholder="Account Number"
                      value={bank.accountNumber || ''}
                      onChangeText={(text) => {
                        const newBanks = [...(storeForm.bankDetails || [])];
                        newBanks[index].accountNumber = text;
                        setStoreForm({ ...storeForm, bankDetails: newBanks });
                      }}
                    />
                    <TextInput
                      style={styles.dialogInput}
                      placeholder="IFSC Code"
                      value={bank.ifscCode || ''}
                      onChangeText={(text) => {
                        const newBanks = [...(storeForm.bankDetails || [])];
                        newBanks[index].ifscCode = text;
                        setStoreForm({ ...storeForm, bankDetails: newBanks });
                      }}
                    />
                    <TextInput
                      style={styles.dialogInput}
                      placeholder="Account Holder Name"
                      value={bank.accountHolderName || ''}
                      onChangeText={(text) => {
                        const newBanks = [...(storeForm.bankDetails || [])];
                        newBanks[index].accountHolderName = text;
                        setStoreForm({ ...storeForm, bankDetails: newBanks });
                      }}
                    />
                    <TextInput
                      style={styles.dialogInput}
                      placeholder="Branch"
                      value={bank.branch || ''}
                      onChangeText={(text) => {
                        const newBanks = [...(storeForm.bankDetails || [])];
                        newBanks[index].branch = text;
                        setStoreForm({ ...storeForm, bankDetails: newBanks });
                      }}
                    />
                    <Button
                      mode="outlined"
                      onPress={() => {
                        const newBanks = storeForm.bankDetails.filter((_, i) => i !== index);
                        setStoreForm({ ...storeForm, bankDetails: newBanks });
                      }}
                      icon="delete"
                      buttonColor={colors.error}
                      textColor={colors.white}
                    >
                      Remove
                    </Button>
                  </Card.Content>
                </Card>
              ))}
              <Button
                mode="outlined"
                onPress={() => {
                  const newBanks = [...(storeForm.bankDetails || []), { bankName: '', accountNumber: '', ifscCode: '', accountHolderName: '', branch: '' }];
                  setStoreForm({ ...storeForm, bankDetails: newBanks });
                }}
                icon="plus"
              >
                Add Bank
              </Button>
            </Dialog.Content>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setStoreDialogOpen(false)} disabled={loadingAction}>
              Cancel
            </Button>
            <Button onPress={handleSaveStoreInfo} mode="contained" disabled={loadingAction}>
              {loadingAction ? 'Saving...' : 'Save'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.primary,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerLogo: {
    width: 50,
    height: 50,
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    color: colors.white,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: colors.white,
    opacity: 0.9,
  },
  logoutButton: {
    marginLeft: 12,
  },
  logoutButtonText: {
    fontWeight: '600',
  },
  mainTabs: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  mainTabButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  tabScrollView: {
    flex: 1,
  },
  tabScrollContent: {
    paddingBottom: 24,
  },
  usersCard: {
    margin: 16,
    marginTop: 8,
  },
  usersList: {
    marginTop: 16,
  },
  tabs: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: colors.surface,
  },
  tabButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  rateAdjustCard: {
    margin: 16,
    marginBottom: 8,
  },
  rateAdjustTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  rateAdjustDescription: {
    color: colors.textSecondary,
    marginBottom: 16,
  },
  rateAdjustButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  decreaseButton: {
    flex: 1,
  },
  increaseButton: {
    flex: 1,
  },
  showAsItIsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  showAsItIsChip: {
    marginRight: 8,
  },
  showAsItIsChipText: {
    color: colors.white,
    fontWeight: '600',
  },
  showAsItIsButton: {
    flex: 1,
  },
  ratesCard: {
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  ratesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  ratesTitle: {
    fontWeight: 'bold',
  },
  rateItemCard: {
    marginRight: 12,
    marginBottom: 12,
    minWidth: 200,
  },
  rateItemCardDisabled: {
    opacity: 0.6,
    backgroundColor: colors.surface,
  },
  rateItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  rateItemName: {
    fontWeight: '600',
    flex: 1,
  },
  rateItemNameDisabled: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  disabledChip: {
    backgroundColor: colors.error,
    marginLeft: 8,
  },
  disabledChipText: {
    color: colors.white,
    fontSize: 10,
  },
  rateItemDetails: {
    color: colors.textSecondary,
    marginBottom: 8,
  },
  rateItemDetailsDisabled: {
    opacity: 0.7,
  },
  visibilityLabelDisabled: {
    color: colors.error,
  },
  rateItemPrice: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  rateItemPerGram: {
    color: colors.textSecondary,
    marginBottom: 4,
  },
  rateItemOriginal: {
    color: colors.textSecondary,
    marginBottom: 4,
    fontSize: 12,
  },
  adjustmentChip: {
    marginTop: 4,
  },
  adjustmentChipText: {
    color: colors.white,
    fontWeight: '600',
  },
  rateItemActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  visibilityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editProductButton: {
    flex: 1,
    marginLeft: 8,
  },
  userCard: {
    marginBottom: 12,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontWeight: '600',
    marginBottom: 4,
  },
  userEmail: {
    color: colors.textSecondary,
    marginBottom: 2,
  },
  userPhone: {
    color: colors.textSecondary,
  },
  statusChip: {
    marginLeft: 8,
  },
  statusText: {
    color: colors.white,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
  },
  approveButton: {
    backgroundColor: colors.success,
  },
  rejectButton: {
    borderColor: colors.error,
  },
  approvedText: {
    color: colors.textSecondary,
    marginTop: 8,
    fontSize: 12,
  },
  viewDocsButton: {
    marginTop: 8,
  },
  newsCard: {
    margin: 16,
  },
  newsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  newsTitle: {
    fontWeight: 'bold',
  },
  newsItemCard: {
    marginBottom: 12,
  },
  newsItemTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  newsItemMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  newsCategoryChip: {
    marginRight: 4,
  },
  newsStatusChip: {
    marginRight: 4,
  },
  newsStatusChipText: {
    color: colors.white,
  },
  newsItemViews: {
    color: colors.textSecondary,
  },
  newsItemDate: {
    color: colors.textSecondary,
    marginBottom: 8,
  },
  newsItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  newsActionButton: {
    flex: 1,
  },
  storeCard: {
    margin: 16,
  },
  storeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  storeTitle: {
    fontWeight: 'bold',
  },
  storeInfoRow: {
    marginBottom: 16,
  },
  storeInfoLabel: {
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  timingItem: {
    marginBottom: 4,
  },
  timingDay: {
    fontWeight: '600',
  },
  bankCard: {
    marginBottom: 8,
  },
  bankName: {
    fontWeight: '600',
    marginBottom: 4,
  },
  loadingText: {
    textAlign: 'center',
    color: colors.textSecondary,
    padding: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    padding: 16,
  },
  dialogDescription: {
    marginBottom: 16,
    color: colors.textSecondary,
  },
  dialogBold: {
    fontWeight: 'bold',
  },
  dialogHelperText: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textSecondary,
  },
  dialogLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  selectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  selectButton: {
    marginRight: 4,
    marginBottom: 4,
  },
  dialogInput: {
    backgroundColor: colors.surface,
    marginBottom: 16,
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  dialogTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkboxLabel: {
    marginLeft: 8,
  },
  fullDialog: {
    maxHeight: '90%',
  },
  timingEditCard: {
    marginBottom: 12,
  },
  bankEditCard: {
    marginBottom: 12,
  },
});