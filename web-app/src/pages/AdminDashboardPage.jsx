import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tabs, Tab, CircularProgress, MenuItem, Select, FormControl, InputLabel, Grid, IconButton, TextareaAutosize, Accordion, AccordionSummary, AccordionDetails, Checkbox, FormControlLabel, Switch } from '@mui/material';
import { Logout, CheckCircle, Cancel, Visibility, Remove, Add, Edit, Delete, Delete as DeleteIcon, Add as AddIcon, Newspaper, Person, Store, RestartAlt, ExpandMore, TrendingUp, TrendingDown } from '@mui/icons-material';
import { AuthContext } from '../context/AuthContext';
import api from '../config/api';
import colors from '../theme/colors';

// Helper to prevent floating point errors
const roundToTwo = (num) => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

function AdminDashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustValue, setAdjustValue] = useState('');
  const [adjustType, setAdjustType] = useState('increase'); // 'increase' or 'decrease'
  const [adjustValueType, setAdjustValueType] = useState('amount'); // 'amount' or 'percentage'
  const [selectedItem, setSelectedItem] = useState('all'); // 'all' or specific item name
  const [loadingAction, setLoadingAction] = useState(false);
  const [rates, setRates] = useState([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [mainTab, setMainTab] = useState(0); // 0: Users, 1: News, 2: Profile
  const [newsPosts, setNewsPosts] = useState([]);
  const [loadingNews, setLoadingNews] = useState(false);
  const [newsDialogOpen, setNewsDialogOpen] = useState(false);
  const [editingNews, setEditingNews] = useState(null);
  const [newsForm, setNewsForm] = useState({ title: '', content: '', image: '', category: 'general', tags: '', published: false });
  const [storeInfo, setStoreInfo] = useState(null);
  const [loadingStore, setLoadingStore] = useState(false);
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);
  const [storeForm, setStoreForm] = useState({});
  const [showOriginalRates, setShowOriginalRates] = useState(false); // Toggle to show original rates without adjustments
  const [baseRateFromSource, setBaseRateFromSource] = useState(null); // Current base rate from RB Gold
  const [globalShowAsItIs, setGlobalShowAsItIs] = useState(false); // Global "Show As It Is" setting
  const [previousRates, setPreviousRates] = useState({}); // Track previous prices for smooth animations

  // Poll base rate every second to update Normal Price live (same as "Show As It Is")
  const baseRateIntervalRef = React.useRef(null);
  // Poll rates every second to update Adjusted Price according to market changes + manual adjustments
  const ratesIntervalRef = React.useRef(null);

  useEffect(() => {
    // Fetch immediately
    fetchBaseRate();
    fetchRates(true); // Use skipUpdate=true for fast initial load (backend will update in background)

    // Set up interval to fetch base rate every second for live Normal Price updates
    baseRateIntervalRef.current = setInterval(() => {
      fetchBaseRate();
    }, 1000); // Updated to 1 second per user request

    // Set up interval to fetch rates every second for live Adjusted Price updates
    // Use skipUpdate=true for fast polling (backend triggers updates in background on Vercel)
    // Optimized to update smoothly without causing UI flickering
    ratesIntervalRef.current = setInterval(() => {
      // Use skipUpdate=true for fast polling (backend triggers updates in background on Vercel)
      // Pass isPolling=true to suppress error alerts and prevent loading state changes
      fetchRates(true, true);
    }, 1000); // Updated to 1 second per user request

    // Cleanup on unmount
    return () => {
      if (baseRateIntervalRef.current) {
        clearInterval(baseRateIntervalRef.current);
        baseRateIntervalRef.current = null;
      }
      if (ratesIntervalRef.current) {
        clearInterval(ratesIntervalRef.current);
        ratesIntervalRef.current = null;
      }
    };
  }, []);
  const [editProductDialogOpen, setEditProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editProductName, setEditProductName] = useState('');

  useEffect(() => {
    // Initial fetch of global settings
    fetchShowAsItIsSetting();
    fetchBaseRate();
  }, []);

  useEffect(() => {
    // Fetch tab-specific data
    if (mainTab === 0) {
      fetchUsers();
      fetchRates(true);
    } else if (mainTab === 1) {
      fetchNews();
    } else if (mainTab === 2) {
      fetchStoreInfo();
    }
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
      setShowOriginalRates(newValue); // Sync local view
      alert(response.data.message || `"Show As It Is" ${newValue ? 'enabled' : 'disabled'} successfully`);
      // Refresh rates to show updated values - skip update to avoid timeout
      await fetchRates(true);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to toggle "Show As It Is" setting');
    } finally {
      setLoadingAction(false);
    }
  };

  const fetchBaseRate = async () => {
    try {
      // Use dedicated endpoint to get just the base rate (faster)
      // Add cache busting timestamp
      // Increase timeout to prevent frequent timeouts
      const response = await api.get('/rates/base-rate', {
        params: { _t: Date.now() },
        timeout: 10000 // Increased from 5000ms to 10000ms to reduce timeout errors
      });
      if (response.data && response.data.baseRatePerGram) {
        setBaseRateFromSource(response.data);
        // Only log occasionally to avoid console spam (every 10 seconds)
        const now = Date.now();
        if (!fetchBaseRate.lastLogTime || now - fetchBaseRate.lastLogTime > 10000) {
          console.log(`✅ Live base rate: ₹${Number(response.data.baseRatePerGram || 0).toFixed(2)}/gram (updating every second for Normal Price)`);
          fetchBaseRate.lastLogTime = now;
        }
      }
      return response.data;
    } catch (error) {
      // Silently handle errors during polling - don't spam console
      // Only log if base rate was never successfully fetched
      if (!baseRateFromSource || !baseRateFromSource.baseRatePerGram) {
        console.warn('⚠️ Error fetching base rate from RB Gold:', error.message);
        if (error.response?.status === 404) {
          console.warn('   Base rate endpoint not available - ensure backend is deployed');
        }
      }
      return null;
    }
  };



  const fetchRates = async (skipUpdate = true, isPolling = false) => {
    try {
      // Only show loading spinner on initial load, never during polling to avoid UI flickering
      // CRITICAL: Don't set loadingRates during polling to prevent button from being disabled
      if (!isPolling) {
        if (!rates || rates.length === 0) {
          setLoadingRates(true);
        }
        // Only set loading on initial fetch, not during polling
        if (!skipUpdate || rates.length === 0) {
          setLoadingRates(true);
        }
      }
      console.log('📡 Fetching rates from /rates endpoint...', skipUpdate ? '(skipping update)' : '(allowing update)');

      // CRITICAL: Always fetch base rate FIRST to ensure Normal Price shows exact RB Gold prices
      // Fetch base rate before rates to ensure it's available when calculating Normal Price
      await fetchBaseRate();

      // Use skipUpdate=true for fast polling (just read from MongoDB)
      // Backend will trigger updates in background on Vercel even when skipUpdate=true
      // Use longer timeout for skipUpdate=false (manual refresh that triggers full update)
      const response = await api.get('/rates', {
        params: {
          skipUpdate: skipUpdate ? 'true' : undefined,
          _t: Date.now() // Cache busting
        },
        timeout: skipUpdate ? 15000 : 60000 // 15 seconds for polling (allows time for MongoDB read), 60s for manual refresh (full update)
      });
      console.log('✅ Rates fetched successfully:', response.data?.length || 0, 'rates');
      // Only clear loading if we set it (not during polling)
      if (!isPolling) {
        setLoadingRates(false);
      }
      // Update rates only if data actually changed to prevent unnecessary re-renders and UI flickering
      setRates(prevRates => {
        const newRates = response.data || [];

        // CRITICAL FIX: Ensure newRates is an array before iterating
        // Use empty array if response.data is not an array (e.g. error object)
        const safeRates = Array.isArray(newRates) ? newRates : [];

        if (!Array.isArray(newRates)) {
          console.error('❌ Expected array of rates but got:', typeof newRates, newRates);
          // If polling, just return previous rates to avoid UI disruption
          if (isPolling) return prevRates;
          // If manual fetch, keep previous rates but log error
        }

        // Compare all rates to detect any changes in adjustedPrice or ratePerGram
        // This ensures we only update state when prices actually change
        if (prevRates.length === 0 || prevRates.length !== safeRates.length) {
          // Initialize previous rates tracking
          const initialPrevRates = {};
          safeRates.forEach(rate => {
            const rateKey = rate._id?.toString() || rate.name;
            initialPrevRates[rateKey] = {
              adjustedPrice: rate.adjustedPrice || rate.rate || 0,
              adjustedRatePerGram: rate.ratePerGram || 0,
              originalTotalPrice: rate.normalPrice || rate.rate || 0,
              originalRatePerGram: rate.ratePerGram || 0
            };
          });
          setPreviousRates(initialPrevRates);
          return safeRates;
        }

        // Track price changes for smooth animations
        const updatedPrevRates = { ...previousRates };
        let hasChanges = false;

        safeRates.forEach((newRate, index) => {
          const rateKey = newRate._id?.toString() || newRate.name;
          const prevRate = prevRates.find(r => (r._id?.toString() || r.name) === rateKey);

          // Calculate weight in grams for this rate
          let weightInGrams = newRate.weight?.value || 1;
          if (newRate.weight?.unit === 'kg') {
            weightInGrams = weightInGrams * 1000;
          }

          // Calculate normal price (original price from base rate)
          // Apply purity adjustments to base rate
          let originalRatePerGram = 0;
          if (baseRateFromSource?.baseRatePerGram && baseRateFromSource.baseRatePerGram > 0) {
            const baseRate = baseRateFromSource.baseRatePerGram;
            if (newRate.purity === '92.5%') {
              originalRatePerGram = baseRate * 0.96;
            } else {
              // Both 99.9% and 99.99% use base rate as-is (₹290/gram)
              originalRatePerGram = baseRate;
            }

            // Validate calculated rate
            if (!originalRatePerGram || originalRatePerGram <= 0 || isNaN(originalRatePerGram)) {
              originalRatePerGram = newRate.ratePerGram || 290;
            }
          } else {
            // Fallback if baseRateFromSource not available
            originalRatePerGram = newRate.ratePerGram || 290;
          }

          // Final validation
          if (!originalRatePerGram || originalRatePerGram <= 0 || isNaN(originalRatePerGram) || !isFinite(originalRatePerGram)) {
            originalRatePerGram = 290; // Default fallback
          }
          const originalTotalPrice = originalRatePerGram * weightInGrams;

          // Calculate adjusted price in real-time: Normal Price + Manual Adjustment
          // Use roundToTwo to fix floating point errors (e.g., 0.1 + 0.2 != 0.3)
          const manualAdjustment = newRate.manualAdjustment || 0;
          const adjustedRatePerGram = roundToTwo(originalRatePerGram + manualAdjustment);
          // Calculate weight in grams for total price (for Kg display, weightInGrams is 1000)
          // Displaying per Kg means we multiply the *per gram* rate by 1000
          // For consistency, we calculate the total price based on the precise per-gram rate
          const finalAdjustedPrice = Math.max(0, roundToTwo(adjustedRatePerGram * weightInGrams));

          // Get previous calculated values from previousRates state
          const prevCalculated = previousRates[rateKey] || {};
          const prevOriginalTotalPrice = prevCalculated.originalTotalPrice || 0;
          const prevAdjustedPrice = prevCalculated.adjustedPrice || 0;

          // Always update the calculated values in previousRates
          updatedPrevRates[rateKey] = {
            adjustedPrice: finalAdjustedPrice,
            adjustedRatePerGram: adjustedRatePerGram,
            originalTotalPrice: originalTotalPrice,
            originalRatePerGram: originalRatePerGram
          };

          // Check if prices changed (compare calculated values)
          const priceChanged = (
            Math.abs(prevOriginalTotalPrice - originalTotalPrice) > 0.01 ||
            Math.abs(prevAdjustedPrice - finalAdjustedPrice) > 0.01
          );

          if (priceChanged && prevCalculated.originalTotalPrice !== undefined) {
            hasChanges = true;
            // Store old values for animation
            updatedPrevRates[rateKey] = {
              ...updatedPrevRates[rateKey],
              oldAdjustedPrice: prevCalculated.adjustedPrice || 0,
              oldAdjustedRatePerGram: prevCalculated.adjustedRatePerGram || 0,
              oldOriginalTotalPrice: prevCalculated.originalTotalPrice || 0,
              oldOriginalRatePerGram: prevCalculated.originalRatePerGram || 0,
              timestamp: Date.now()
            };

            // Clear animation after 2 seconds
            setTimeout(() => {
              setPreviousRates(prev => {
                const updated = { ...prev };
                if (updated[rateKey]) {
                  delete updated[rateKey].oldAdjustedPrice;
                  delete updated[rateKey].oldAdjustedRatePerGram;
                  delete updated[rateKey].oldOriginalTotalPrice;
                  delete updated[rateKey].oldOriginalRatePerGram;
                  delete updated[rateKey].timestamp;
                }
                return updated;
              });
            }, 2000);
          }
        });

        // Always update previous rates state with current calculated values
        setPreviousRates(updatedPrevRates);

        // Always return new rates to ensure prices are displayed
        // The comparison was preventing updates when it shouldn't
        return newRates;
      });

      // CRITICAL: Ensure base rate is available for Normal Price calculation
      // Re-fetch if not available to ensure Normal Price shows exact RB Gold prices
      if (!baseRateFromSource || !baseRateFromSource.baseRatePerGram) {
        console.warn('⚠️ Base rate not available after fetching rates, re-fetching...');
        const baseRate = await fetchBaseRate();
        if (baseRate && baseRate.baseRatePerGram) {
          console.log(`✅ Base rate now available: ₹${baseRate.baseRatePerGram}/gram (exact RB Gold price)`);
        } else {
          console.error('❌ CRITICAL: Base rate still not available - Normal Price will not show exact RB Gold prices!');
        }
      } else {
        console.log(`✅ Base rate available for Normal Price: ₹${baseRateFromSource.baseRatePerGram}/gram (exact RB Gold price)`);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to fetch rates';

      // During polling, only log warnings (not errors) to prevent console spam
      if (isPolling) {
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          console.warn('⏱️ Request timeout during polling - will retry on next poll');
        } else {
          console.warn(`⚠️ Error during polling: ${errorMsg} - will retry on next poll`);
        }
        // Don't log full error details during polling to prevent console spam
      } else {
        // Only log full error details for manual refreshes
        console.error('❌ Error fetching rates:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('Error response status:', error.response?.status);
        console.error('Error response statusText:', error.response?.statusText);
        console.error('Error response data:', JSON.stringify(error.response?.data, null, 2));
        console.error('Error config URL:', error.config?.url);
        console.error('Error config baseURL:', error.config?.baseURL);
      }

      // Handle different error types - only show alerts for manual refreshes, not during polling
      if (!isPolling) {
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          console.warn('⏱️ Request timeout - rates endpoint may be slow');
          alert('Request timeout. The rates endpoint may be slow. Please try again.');
        } else if (!error.response) {
          console.warn('🌐 Network error - check if server is running');
          alert(`Network error: ${error.message}. Please check your internet connection and try again.`);
        } else if (error.response?.status === 503) {
          console.warn('⚠️ Service temporarily unavailable - rate update in progress');
          alert('Rates are being updated. Please wait a moment and try again.');
        } else if (error.response?.status === 500) {
          console.warn('⚠️ Server error');
          alert(`Server error: ${errorMsg}. Please try again later.`);
        } else {
          console.warn(`⚠️ Failed to fetch rates: ${errorMsg}`);
          alert(`Failed to fetch rates: ${errorMsg}`);
        }
      }
      // During polling, errors are already logged above as warnings (no alerts)

      // Don't clear rates on polling errors - keep showing last known rates
      if (!isPolling) {
        setRates([]);
      }
    } finally {
      // Always clear loading state after fetch completes (success or error)
      // But only if we don't have rates yet (to prevent flickering during polling)
      if (rates.length === 0 || !isPolling) {
        setLoadingRates(false);
      }
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);

      // Check if user is authenticated
      const token = localStorage.getItem('token');
      if (!token) {
        alert('You are not authenticated. Please sign in again.');
        navigate('/admin/login');
        return;
      }

      console.log('🔍 Starting to fetch users...');
      console.log('Token exists:', !!token);
      console.log('API base URL:', api.defaults.baseURL);
      console.log('Full URL will be:', `${api.defaults.baseURL}/admin/pending-users`);

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
        console.error('Error config URL:', pendingError.config?.url);
        console.error('Error config baseURL:', pendingError.config?.baseURL);

        const errorMsg = pendingError.response?.data?.message || pendingError.message || 'Failed to fetch pending users';

        if (pendingError.response?.status === 401 || pendingError.response?.status === 403) {
          alert(`Authentication error: ${errorMsg}. Please sign in again.`);
          navigate('/admin/login');
          return;
        }

        // Show detailed error message
        if (pendingError.code === 'ECONNABORTED' || pendingError.message?.includes('timeout')) {
          console.warn('⏱️ Request timeout - server may be slow or unavailable');
          alert('Request timeout. The server may be slow. Please try again.');
        } else if (!pendingError.response) {
          console.warn('🌐 Network error - check if server is running');
          alert(`Network error: ${pendingError.message}. Please check your internet connection and try again.`);
        } else {
          console.warn(`⚠️ Failed to fetch pending users: ${errorMsg}`);
          alert(`Failed to fetch pending users: ${errorMsg}`);
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
        console.error('Error config URL:', allUsersError.config?.url);
        console.error('Error config baseURL:', allUsersError.config?.baseURL);

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
        alert(`Authentication error: ${errorMsg}. Please sign in again.`);
        navigate('/admin/login');
      } else {
        alert(`Failed to fetch users: ${errorMsg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    try {
      setLoadingAction(true);
      await api.put(`/admin/approve-user/${userId}`);
      await fetchUsers();
      alert('User approved successfully');
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to approve user');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleReject = async (userId) => {
    if (window.confirm('Are you sure you want to reject this user?')) {
      try {
        setLoadingAction(true);
        await api.put(`/admin/reject-user/${userId}`, { reason: 'Rejected by admin' });
        await fetchUsers();
        alert('User rejected successfully');
      } catch (error) {
        alert(error.response?.data?.message || 'Failed to reject user');
      } finally {
        setLoadingAction(false);
      }
    }
  };

  const handleViewDocuments = (userId) => {
    navigate(`/admin/users/${userId}/documents`);
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    // Use displayName if it's different from original, otherwise use current name
    const currentDisplayName = product.displayName !== undefined && product.displayName !== null
      ? product.displayName
      : (product.originalName || product.name || '');
    setEditProductName(currentDisplayName);
    setEditProductDialogOpen(true);
  };

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
      alert(response.data.message || 'Product updated successfully');
      setEditProductDialogOpen(false);
      setEditingProduct(null);
      setEditProductName('');
      await fetchRates(true); // Refresh rates
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update product');
      console.error('Update product error:', error);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleToggleVisibility = async (product) => {
    try {
      setLoadingAction(true);
      const newVisibility = !(product.isVisible !== undefined ? product.isVisible : true);
      // Use originalName if available (for admin), otherwise use name
      const productName = product.originalName || product.name || product._id;
      const response = await api.put('/admin/product', {
        productName: productName,
        isVisible: newVisibility
      });
      await fetchRates(true); // Refresh rates
      // Don't show alert for visibility toggle to avoid spam
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update product visibility');
      console.error('Toggle visibility error:', error);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleAdjustRates = async () => {
    const value = parseFloat(adjustValue);
    if (isNaN(value) || value <= 0) {
      alert('Please enter a valid positive number');
      return;
    }
    try {
      setLoadingAction(true);
      const finalValue = adjustType === 'decrease' ? -Math.abs(value) : value;

      // CRITICAL: Ensure we're sending the originalName, not displayName
      let itemNameToSend = selectedItem;
      if (selectedItem !== 'all') {
        // Find the rate to get its originalName
        const selectedRate = rates.find(r => {
          const originalName = r.originalName || r.name;
          const displayName = r.displayName || r.name;
          return originalName === selectedItem || displayName === selectedItem;
        });

        if (selectedRate) {
          itemNameToSend = selectedRate.originalName || selectedRate.name;
          console.log(`🔍 Adjust rates: Selected "${selectedItem}" → Sending originalName: "${itemNameToSend}"`);
          console.log(`   Rate details: name="${selectedRate.name}", originalName="${selectedRate.originalName}", displayName="${selectedRate.displayName}"`);
        } else {
          console.warn(`⚠️ Could not find rate for selectedItem: "${selectedItem}"`);
        }
      }

      const payload = {
        value: finalValue,
        adjustmentType: adjustValueType // 'amount' or 'percentage'
      };
      if (itemNameToSend !== 'all') {
        payload.itemName = itemNameToSend;
        console.log(`📤 Sending adjust-rates request with itemName: "${itemNameToSend}"`);
      }
      const response = await api.post('/admin/adjust-rates', payload, {
        timeout: 60000 // 60 seconds timeout - backend may trigger rate update
      });
      const message = response.data?.message || `Rates ${adjustType === 'decrease' ? 'decreased' : 'increased'} by ${adjustValueType === 'percentage' ? `${Math.abs(value)}%` : `₹${Math.abs(value)}/gram`}${selectedItem !== 'all' ? ` for ${selectedItem}` : ' for all items'} successfully`;
      alert(message);
      setAdjustDialogOpen(false);
      setAdjustValue('');
      setSelectedItem('all');
      setAdjustValueType('amount');
      // Refresh rates to show updated values - skip update to avoid timeout
      await fetchRates(true);
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || 'Failed to adjust rates';
      alert(errorMsg);
      console.error('Adjust rates error:', error);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

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
      alert(error.response?.data?.message || 'Failed to fetch news posts. Please check console for details.');
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
      alert('Failed to fetch store information');
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
      alert('Title and content are required');
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
        alert('News post updated successfully');
      } else {
        await api.post('/news', payload);
        alert('News post created successfully');
      }
      setNewsDialogOpen(false);
      setNewsForm({ title: '', content: '', image: '', category: 'general', tags: '', published: false });
      await fetchNews(); // Refresh news list
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to save news post');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDeleteNews = async (id) => {
    if (!window.confirm('Are you sure you want to delete this news post?')) return;
    try {
      setLoadingAction(true);
      await api.delete(`/news/${id}`);
      alert('News post deleted successfully');
      await fetchNews(); // Refresh news list
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete news post');
    } finally {
      setLoadingAction(false);
    }
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
        alert('Please fill in at least one field (Welcome Message, Address, or Phone Number)');
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

      alert('Store information updated successfully');
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

      alert(errorMessage);
    } finally {
      setLoadingAction(false);
    }
  };

  const usersToShow = activeTab === 0 ? pendingUsers : allUsers;

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Admin Dashboard
        </Typography>
        <Button variant="contained" color="error" startIcon={<Logout />} onClick={handleLogout}>
          Logout
        </Button>
      </Box>

      {/* Main Navigation Tabs */}
      <Tabs value={mainTab} onChange={(e, newValue) => setMainTab(newValue)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab icon={<Person />} label="Users" />
        <Tab icon={<Newspaper />} label="News" />
        <Tab icon={<Store />} label="Profile/Store" />
      </Tabs>

      {/* Users Tab Content */}
      {mainTab === 0 && (
        <>
          {/* Rate Adjustment Card */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Rate Adjustment</Typography>
              <Typography variant="body2" sx={{ mb: 2, color: colors.textSecondary }}>
                Adjust silver rates per gram. Enter positive amount to increase or decrease rates.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<Remove />}
                  onClick={() => {
                    setAdjustType('decrease');
                    setAdjustValueType('amount');
                    setAdjustValue('');
                    setSelectedItem('all');
                    setAdjustDialogOpen(true);
                  }}
                  disabled={loadingAction}
                >
                  Decrease Rates
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<Add />}
                  onClick={() => {
                    setAdjustType('increase');
                    setAdjustValueType('amount');
                    setAdjustValue('');
                    setSelectedItem('all');
                    setAdjustDialogOpen(true);
                  }}
                  disabled={loadingAction}
                >
                  Increase Rates
                </Button>
                <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Chip
                    label={globalShowAsItIs ? 'Global: Show As It Is ON' : 'Global: Show As It Is OFF'}
                    color={globalShowAsItIs ? "success" : "default"}
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  <Button
                    size="small"
                    variant={globalShowAsItIs ? "contained" : "outlined"}
                    {...(globalShowAsItIs ? { color: "primary" } : {})}
                    startIcon={<RestartAlt />}
                    onClick={toggleShowAsItIs}
                    disabled={loadingAction}
                    sx={{ minWidth: 150, pointerEvents: loadingAction ? 'none' : 'auto' }}
                  >
                    {globalShowAsItIs ? 'Disable Show As It Is' : 'Enable Show As It Is'}
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Current Rates Display Card */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Current Silver Rates</Typography>
                <Button size="small" onClick={() => fetchRates(false)} disabled={loadingRates}>
                  Refresh
                </Button>
              </Box>
              {loadingRates && rates.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : rates.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                        {showOriginalRates ? (
                          <>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Original Price</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Price per Kg</TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Normal Price</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Adjusted Price</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Adjustment</TableCell>
                          </>
                        )}
                        <TableCell align="center" sx={{ fontWeight: 700 }}>Visible</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rates.map((rate) => {

                        // Calculate weight in grams
                        let weightInGrams = rate.weight?.value || 1;
                        if (rate.weight?.unit === 'kg') {
                          weightInGrams = weightInGrams * 1000;
                        }

                        // Calculate original rate from RB Gold by subtracting manual adjustment
                        // IMPORTANT: Always calculate original from current rate - adjustment
                        // The backend may store incorrect originalRatePerGram, so we calculate it ourselves
                        // Original Rate = Current Rate - Manual Adjustment
                        // This gives us the true original price from the source (RB Gold) without any adjustments
                        const currentRatePerGram = rate.ratePerGram || 0;
                        const currentTotalRate = rate.rate || 0;

                        // Calculate Normal Price = EXACT RB Gold price (with purity adjustments only, NO manual adjustments)
                        // ALWAYS use base rate from RB Gold source for Normal Price
                        let originalRatePerGram;

                        // CRITICAL: Always use base rate from RB Gold source if available
                        // This ensures Normal Price shows EXACT RB Gold price without any manual adjustments
                        if (baseRateFromSource && baseRateFromSource.baseRatePerGram && baseRateFromSource.baseRatePerGram > 0) {
                          // Get exact base rate from RB Gold and apply purity adjustments
                          const baseRate = baseRateFromSource.baseRatePerGram;

                          // Apply purity adjustments (same as backend)
                          if (rate.purity === '92.5%') {
                            originalRatePerGram = baseRate * 0.96;
                          } else {
                            // Both 99.9% and 99.99% use base rate as-is (₹290/gram) - MUST be exactly the base rate
                            originalRatePerGram = baseRate;
                          }

                          // Validate calculated rate
                          if (!originalRatePerGram || originalRatePerGram <= 0 || isNaN(originalRatePerGram)) {
                            console.warn(`⚠️ [${rate.name}] Invalid calculated rate from base (${baseRate}), using fallback`);
                            originalRatePerGram = baseRate || 290; // Use base rate as fallback, not currentRatePerGram
                          }
                        } else {
                          // Fallback only if baseRateFromSource is not available (should rarely happen)
                          // CRITICAL: Don't use currentRatePerGram directly as it may include adjustments or be stale
                          // Instead, try to get the original rate from backend data first
                          const manualAdjustment = rate.manualAdjustment || 0;

                          // Try stored originalRatePerGram first (most accurate fallback)
                          if (rate.originalRatePerGram && rate.originalRatePerGram > 0) {
                            originalRatePerGram = rate.originalRatePerGram;
                            console.warn(`⚠️ [${rate.name}] Base rate not available, using stored originalRatePerGram: ₹${originalRatePerGram}`);
                          } else if (rate.originalRate && rate.originalRate > 0) {
                            originalRatePerGram = rate.originalRate / weightInGrams;
                            console.warn(`⚠️ [${rate.name}] Base rate not available, using stored originalRate: ₹${originalRatePerGram}/gram`);
                          } else {
                            // Last resort: calculate from current rate - manual adjustment
                            originalRatePerGram = currentRatePerGram - manualAdjustment;

                            // Validate the calculated value
                            if (originalRatePerGram <= 0 || isNaN(originalRatePerGram)) {
                              // Final fallback to default market rate
                              originalRatePerGram = 290; // Default market rate
                              console.warn(`⚠️ [${rate.name}] All fallbacks failed, using default rate: ₹${originalRatePerGram}`);
                            } else {
                              console.warn(`⚠️ [${rate.name}] Base rate from RB Gold not available, using calculated fallback: ₹${originalRatePerGram} (current: ₹${currentRatePerGram}, adjustment: ₹${manualAdjustment})`);
                            }
                          }
                        }

                        // Final validation to ensure we have a valid number
                        if (!originalRatePerGram || originalRatePerGram <= 0 || isNaN(originalRatePerGram) || !isFinite(originalRatePerGram)) {
                          originalRatePerGram = 290; // Default fallback
                          console.warn(`⚠️ [${rate.name}] Final validation failed, using default: ₹${originalRatePerGram}`);
                        }

                        // Debug logging for 99.9% items to verify base rate is used correctly
                        if (rate.purity === '99.9%' && baseRateFromSource?.baseRatePerGram) {
                          const expectedRate = baseRateFromSource.baseRatePerGram;
                          if (Math.abs(originalRatePerGram - expectedRate) > 0.01) {
                            console.warn(`⚠️ [${rate.name}] 99.9% rate mismatch: Expected ₹${expectedRate}, Got ₹${originalRatePerGram}`);
                          }
                        }

                        // Calculate total price (no rounding to preserve exact RB Gold price)
                        // CRITICAL: For Silver Bar 1kg (99.99%), calculation must be: ₹208.5/gram × 1000g = ₹208,500
                        // Formula: originalRatePerGram × weightInGrams = totalPrice
                        // Example: If baseRate = ₹207.46/gram (99.9%), then:
                        //   99.99% rate = ₹207.46 × 1.005 = ₹208.5/gram
                        //   Silver Bar 1kg = ₹208.5 × 1000 = ₹208,500 ✓
                        const originalTotalPrice = originalRatePerGram * weightInGrams;

                        // Calculate manual adjustment (per gram)
                        const manualAdjustment = rate.manualAdjustment || 0;

                        // Calculate Adjusted Price in real-time based on Normal Price + Manual Adjustment
                        // This ensures adjusted price updates smoothly every second as normal price changes
                        // Formula: Adjusted Price = Normal Price + (Manual Adjustment × Weight in Grams)
                        // Adjusted Rate Per Gram = Normal Rate Per Gram + Manual Adjustment
                        const adjustedRatePerGram = originalRatePerGram + manualAdjustment;
                        const adjustedPrice = adjustedRatePerGram * weightInGrams;

                        // Ensure adjusted price doesn't go negative
                        const finalAdjustedPrice = Math.max(0, adjustedPrice);
                        const finalAdjustedRatePerGram = Math.max(0, adjustedRatePerGram);

                        // Compute adjustment as the difference between adjusted rate and calculated original rate.
                        // Since we're calculating adjusted price from normal price + manual adjustment,
                        // the displayed adjustment is simply the manual adjustment value
                        const displayedAdjustment = manualAdjustment;
                        const EPS = 0.0001;
                        const hasAdjustment = Math.abs(displayedAdjustment) > EPS;

                        // Get price change indicators for smooth animations
                        const rateKey = rate._id?.toString() || rate.name;
                        const prevRate = previousRates[rateKey] || {};
                        const originalPriceChanged = prevRate.oldOriginalTotalPrice !== undefined &&
                          Math.abs((prevRate.oldOriginalTotalPrice || 0) - (originalTotalPrice || 0)) > 0.01;
                        const adjustedPriceChanged = prevRate.oldAdjustedPrice !== undefined &&
                          Math.abs((prevRate.oldAdjustedPrice || 0) - (finalAdjustedPrice || 0)) > 0.01;

                        const originalPriceIsUp = originalPriceChanged && (originalTotalPrice || 0) > (prevRate.oldOriginalTotalPrice || 0);
                        const originalPriceIsDown = originalPriceChanged && (originalTotalPrice || 0) < (prevRate.oldOriginalTotalPrice || 0);
                        const adjustedPriceIsUp = adjustedPriceChanged && (finalAdjustedPrice || 0) > (prevRate.oldAdjustedPrice || 0);
                        const adjustedPriceIsDown = adjustedPriceChanged && (finalAdjustedPrice || 0) < (prevRate.oldAdjustedPrice || 0);

                        // When showing "as it is", display original rates without adjustments
                        if (showOriginalRates) {
                          return (
                            <TableRow
                              key={rate._id || rate.name}
                              sx={{
                                backgroundColor: originalPriceChanged
                                  ? (originalPriceIsUp ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)')
                                  : 'transparent',
                                transition: 'background-color 0.3s ease-in-out'
                              }}
                            >
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {rate.name}
                                </Typography>
                                <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                                  {rate.purity} • {rate.weight?.value} {rate.weight?.unit}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                  {originalPriceChanged && (
                                    originalPriceIsUp ? (
                                      <TrendingUp sx={{ fontSize: 16, color: colors.success }} />
                                    ) : (
                                      <TrendingDown sx={{ fontSize: 16, color: colors.error }} />
                                    )
                                  )}
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontWeight: 600,
                                      color: originalPriceChanged
                                        ? (originalPriceIsUp ? colors.success : colors.error)
                                        : colors.textPrimary,
                                      transition: 'color 0.3s ease-in-out, transform 0.2s ease-in-out',
                                      transform: originalPriceChanged ? 'scale(1.05)' : 'scale(1)'
                                    }}
                                  >
                                    ₹{Number(originalTotalPrice || 0).toFixed(2)}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell align="right">
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                  {originalPriceChanged && (
                                    originalPriceIsUp ? (
                                      <TrendingUp sx={{ fontSize: 16, color: colors.success }} />
                                    ) : (
                                      <TrendingDown sx={{ fontSize: 16, color: colors.error }} />
                                    )
                                  )}
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontWeight: 600,
                                      color: originalPriceChanged
                                        ? (originalPriceIsUp ? colors.success : colors.error)
                                        : colors.textPrimary,
                                      transition: 'color 0.3s ease-in-out, transform 0.2s ease-in-out',
                                      transform: originalPriceChanged ? 'scale(1.05)' : 'scale(1)'
                                    }}
                                  >
                                    ₹{Number((originalRatePerGram || 0) * 1000).toFixed(2)}/kg
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell align="center">
                                <Switch
                                  checked={rate.isVisible !== undefined ? rate.isVisible : true}
                                  onChange={() => handleToggleVisibility(rate)}
                                  size="small"
                                  disabled={loadingAction}
                                />
                              </TableCell>
                              <TableCell align="center">
                                <IconButton
                                  size="small"
                                  onClick={() => handleEditProduct(rate)}
                                  disabled={loadingAction}
                                  color="primary"
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          );
                        }

                        // Default view: show both normal and adjusted prices
                        return (
                          <TableRow
                            key={rate._id || rate.name}
                            sx={{
                              backgroundColor: adjustedPriceChanged
                                ? (adjustedPriceIsUp ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)')
                                : 'transparent',
                              transition: 'background-color 0.3s ease-in-out'
                            }}
                          >
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {rate.name}
                              </Typography>
                              <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                                {rate.purity} • {rate.weight?.value} {rate.weight?.unit}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                {originalPriceChanged && (
                                  originalPriceIsUp ? (
                                    <TrendingUp sx={{ fontSize: 12, color: colors.success }} />
                                  ) : (
                                    <TrendingDown sx={{ fontSize: 12, color: colors.error }} />
                                  )
                                )}
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: 600,
                                    color: colors.textPrimary,
                                  }}
                                >
                                  ₹{Number((originalRatePerGram || 0) * 1000).toFixed(2)}/kg
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                {adjustedPriceChanged && (
                                  adjustedPriceIsUp ? (
                                    <TrendingUp sx={{ fontSize: 12, color: colors.success }} />
                                  ) : (
                                    <TrendingDown sx={{ fontSize: 12, color: colors.error }} />
                                  )
                                )}
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: hasAdjustment ? 600 : 400,
                                    color: hasAdjustment ? (displayedAdjustment > 0 ? colors.success : colors.error) : colors.textPrimary,
                                  }}
                                >
                                  ₹{Number((finalAdjustedRatePerGram || 0) * 1000).toFixed(2)}/kg
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                {adjustedPriceChanged && (
                                  adjustedPriceIsUp ? (
                                    <TrendingUp sx={{ fontSize: 12, color: colors.success }} />
                                  ) : (
                                    <TrendingDown sx={{ fontSize: 12, color: colors.error }} />
                                  )
                                )}
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: finalAdjustedRatePerGram === 0
                                      ? colors.error
                                      : adjustedPriceChanged
                                        ? (adjustedPriceIsUp ? colors.success : colors.error)
                                        : colors.textSecondary,
                                    transition: 'color 0.3s ease-in-out',
                                    display: 'block'
                                  }}
                                >
                                  ₹{Number(finalAdjustedPrice || 0).toFixed(2)}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              {hasAdjustment ? (
                                <Chip
                                  label={`${displayedAdjustment > 0 ? '+' : ''}₹${Number((Math.abs(displayedAdjustment) || 0) * 1000).toFixed(2)}/kg`}
                                  size="small"
                                  sx={{
                                    backgroundColor: displayedAdjustment > 0 ? colors.success : colors.error,
                                    color: 'white',
                                    fontWeight: 600
                                  }}
                                />
                              ) : (
                                <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                                  No adjustment
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="center">
                              <Switch
                                checked={rate.isVisible !== undefined ? rate.isVisible : true}
                                onChange={() => handleToggleVisibility(rate)}
                                size="small"
                                disabled={loadingAction}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                onClick={() => handleEditProduct(rate)}
                                disabled={loadingAction}
                                color="primary"
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" sx={{ color: colors.textSecondary, textAlign: 'center', p: 2 }}>
                  No rates available
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Users Table Card */}
          <Card>
            <CardContent>
              <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
                <Tab label={`Pending Users (${pendingUsers.length})`} />
                <Tab label={`All Users (${allUsers.length})`} />
              </Tabs>

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : usersToShow.length === 0 ? (
                <Alert severity="info">No users found</Alert>
              ) : (
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {usersToShow.map((userItem) => (
                        <TableRow key={userItem._id}>
                          <TableCell>{userItem.name}</TableCell>
                          <TableCell>{userItem.email}</TableCell>
                          <TableCell>{userItem.phone}</TableCell>
                          <TableCell>
                            <Chip
                              label={userItem.status || 'pending'}
                              color={userItem.status === 'approved' ? 'success' : userItem.status === 'rejected' ? 'error' : 'warning'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              {userItem.status === 'pending' && (
                                <>
                                  <Button
                                    size="small"
                                    color="success"
                                    startIcon={<CheckCircle />}
                                    onClick={() => handleApprove(userItem._id)}
                                    disabled={loadingAction}
                                    variant="contained"
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="small"
                                    color="error"
                                    startIcon={<Cancel />}
                                    onClick={() => handleReject(userItem._id)}
                                    disabled={loadingAction}
                                    variant="contained"
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<Visibility />}
                                onClick={() => handleViewDocuments(userItem._id)}
                              >
                                View Docs
                              </Button>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>

          {/* Adjust Rates Dialog */}
          <Dialog
            open={adjustDialogOpen}
            onClose={() => {
              setAdjustDialogOpen(false);
              setAdjustValue('');
              setAdjustValueType('amount');
              setSelectedItem('all');
            }}
            maxWidth="sm"
            fullWidth
            disableEnforceFocus={false}
            disableAutoFocus={false}
            keepMounted={false}
            aria-labelledby="adjust-rates-dialog-title"
          >
            <DialogTitle id="adjust-rates-dialog-title">
              {adjustType === 'decrease' ? 'Decrease Rates' : 'Increase Rates'}
            </DialogTitle>
            <DialogContent>
              <Typography variant="body2" sx={{ mb: 2, color: colors.textSecondary }}>
                Choose adjustment type and enter the value to {adjustType === 'decrease' ? 'decrease' : 'increase'} rates.
                {adjustValueType === 'amount'
                  ? ` Example: Enter 100 to ${adjustType === 'decrease' ? 'decrease' : 'increase'} by ₹100/gram.`
                  : ` Example: Enter 5 to ${adjustType === 'decrease' ? 'decrease' : 'increase'} by 5%.`
                }
              </Typography>
              <FormControl fullWidth margin="normal">
                <InputLabel>Select Item</InputLabel>
                <Select
                  value={selectedItem}
                  onChange={(e) => setSelectedItem(e.target.value)}
                  label="Select Item"
                >
                  <MenuItem value="all">All Items</MenuItem>
                  {rates.map((rate) => {
                    // Use originalName for backend lookup, but show displayName or name to user
                    // CRITICAL: Always use the database name (originalName) for the value
                    // This ensures backend can find the rate even if displayName is changed
                    const originalName = rate.originalName || rate.name;
                    const displayName = rate.displayName || rate.name;

                    // Debug log to verify we're sending the right value
                    if (displayName !== originalName) {
                      console.log(`🔍 Rate dropdown: "${displayName}" → sending originalName: "${originalName}"`);
                    }

                    return (
                      <MenuItem key={rate._id || originalName} value={originalName}>
                        {displayName}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
              <FormControl fullWidth margin="normal">
                <InputLabel>Adjustment Type</InputLabel>
                <Select
                  value={adjustValueType}
                  onChange={(e) => setAdjustValueType(e.target.value)}
                  label="Adjustment Type"
                >
                  <MenuItem value="amount">Amount (₹/gram)</MenuItem>
                  <MenuItem value="percentage">Percentage (%)</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label={adjustValueType === 'amount'
                  ? `Amount (₹/gram) to ${adjustType === 'decrease' ? 'decrease' : 'increase'}`
                  : `Percentage (%) to ${adjustType === 'decrease' ? 'decrease' : 'increase'}`
                }
                type="number"
                value={adjustValue}
                onChange={(e) => setAdjustValue(e.target.value)}
                margin="normal"
                placeholder={adjustValueType === 'amount' ? 'e.g., 100' : 'e.g., 5'}
                inputProps={{ min: 0, step: adjustValueType === 'amount' ? 0.01 : 0.1 }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => {
                setAdjustDialogOpen(false);
                setAdjustValue('');
                setAdjustValueType('amount');
                setSelectedItem('all');
              }} disabled={loadingAction}>
                Cancel
              </Button>
              <Button
                onClick={handleAdjustRates}
                variant="contained"
                color={adjustType === 'decrease' ? 'error' : 'success'}
                disabled={loadingAction || !adjustValue}
              >
                {loadingAction ? 'Applying...' : adjustType === 'decrease' ? 'Decrease' : 'Increase'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Edit Product Dialog */}
          <Dialog
            open={editProductDialogOpen}
            onClose={() => {
              setEditProductDialogOpen(false);
              setEditingProduct(null);
              setEditProductName('');
            }}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>Edit Product</DialogTitle>
            <DialogContent>
              {editingProduct && (
                <>
                  <Typography variant="body2" sx={{ mb: 2, color: colors.textSecondary }}>
                    Original Name: <strong>{editingProduct.originalName || editingProduct.name}</strong>
                  </Typography>
                  <TextField
                    fullWidth
                    label="Display Name"
                    value={editProductName}
                    onChange={(e) => setEditProductName(e.target.value)}
                    margin="normal"
                    placeholder="Leave empty to use original name"
                    helperText="Leave empty to show the original product name to users"
                  />
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => {
                setEditProductDialogOpen(false);
                setEditingProduct(null);
                setEditProductName('');
              }} disabled={loadingAction}>
                Cancel
              </Button>
              <Button onClick={handleSaveProduct} variant="contained" disabled={loadingAction}>
                {loadingAction ? 'Saving...' : 'Save'}
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )
      }

      {/* News Tab Content */}
      {
        mainTab === 1 && (
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>News Posts</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateNews}>
                  New Post
                </Button>
              </Box>
              {loadingNews ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : newsPosts.length === 0 ? (
                <Alert severity="info">No news posts found. Create your first post!</Alert>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Views</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {newsPosts.map((post) => (
                        <TableRow key={post._id}>
                          <TableCell>{post.title}</TableCell>
                          <TableCell>
                            <Chip label={post.category} size="small" />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={post.published ? 'Published' : 'Draft'}
                              color={post.published ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{post.views || 0}</TableCell>
                          <TableCell>{new Date(post.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <IconButton size="small" onClick={() => handleEditNews(post)}>
                              <Edit />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => handleDeleteNews(post._id)}>
                              <Delete />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        )
      }

      {/* Profile/Store Tab Content */}
      {
        mainTab === 2 && (
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Store Information</Typography>
                <Button variant="contained" onClick={() => setStoreDialogOpen(true)}>
                  Edit Store Info
                </Button>
              </Box>
              {loadingStore ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : storeInfo ? (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" sx={{ color: colors.textSecondary }}>Welcome Message</Typography>
                    <Typography variant="body1" sx={{ mb: 2 }}>{storeInfo.welcomeMessage || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" sx={{ color: colors.textSecondary }}>Phone Number</Typography>
                    <Typography variant="body1" sx={{ mb: 2 }}>{storeInfo.phoneNumber || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ color: colors.textSecondary }}>Address</Typography>
                    <Typography variant="body1" sx={{ mb: 2 }}>{storeInfo.address || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="subtitle2" sx={{ color: colors.textSecondary }}>Instagram</Typography>
                    <Typography variant="body2" sx={{ mb: 2, wordBreak: 'break-all' }}>{storeInfo.instagram || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="subtitle2" sx={{ color: colors.textSecondary }}>Facebook</Typography>
                    <Typography variant="body2" sx={{ mb: 2, wordBreak: 'break-all' }}>{storeInfo.facebook || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="subtitle2" sx={{ color: colors.textSecondary }}>YouTube</Typography>
                    <Typography variant="body2" sx={{ mb: 2, wordBreak: 'break-all' }}>{storeInfo.youtube || 'N/A'}</Typography>
                  </Grid>
                  {storeInfo.storeTimings && storeInfo.storeTimings.length > 0 && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ color: colors.textSecondary, mb: 1 }}>Store Timings</Typography>
                      {storeInfo.storeTimings.map((timing, index) => (
                        <Box key={index} sx={{ mb: 1, p: 1, backgroundColor: colors.primaryVeryLight, borderRadius: 1 }}>
                          <Typography variant="body2">
                            <strong>{timing.day}:</strong> {timing.isClosed ? 'Closed' : `${timing.openTime} - ${timing.closeTime}`}
                          </Typography>
                        </Box>
                      ))}
                    </Grid>
                  )}
                  {storeInfo.bankDetails && storeInfo.bankDetails.length > 0 && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ color: colors.textSecondary, mb: 1 }}>Bank Details</Typography>
                      {storeInfo.bankDetails.map((bank, index) => (
                        <Box key={index} sx={{ mb: 2, p: 2, backgroundColor: colors.primaryVeryLight, borderRadius: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>{bank.bankName}</Typography>
                          <Typography variant="body2">Account: {bank.accountNumber}</Typography>
                          <Typography variant="body2">IFSC: {bank.ifscCode}</Typography>
                          <Typography variant="body2">Holder: {bank.accountHolderName}</Typography>
                          <Typography variant="body2">Branch: {bank.branch}</Typography>
                        </Box>
                      ))}
                    </Grid>
                  )}
                </Grid>
              ) : (
                <Alert severity="info">No store information available</Alert>
              )}
            </CardContent>
          </Card>
        )
      }

      {/* News Dialog */}
      <Dialog
        open={newsDialogOpen}
        onClose={() => setNewsDialogOpen(false)}
        maxWidth="md"
        fullWidth
        disableEnforceFocus={false}
        disableAutoFocus={false}
        keepMounted={false}
        aria-labelledby="news-dialog-title"
      >
        <DialogTitle id="news-dialog-title">{editingNews ? 'Edit News Post' : 'Create News Post'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Title"
            value={newsForm.title}
            onChange={(e) => setNewsForm({ ...newsForm, title: e.target.value })}
            margin="normal"
            required
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Category</InputLabel>
            <Select
              value={newsForm.category}
              onChange={(e) => setNewsForm({ ...newsForm, category: e.target.value })}
              label="Category"
            >
              <MenuItem value="general">General</MenuItem>
              <MenuItem value="announcement">Announcement</MenuItem>
              <MenuItem value="update">Update</MenuItem>
              <MenuItem value="offer">Offer</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Image URL (optional)"
            value={newsForm.image}
            onChange={(e) => setNewsForm({ ...newsForm, image: e.target.value })}
            margin="normal"
            placeholder="https://example.com/image.jpg"
          />
          <TextField
            fullWidth
            label="Tags (comma separated)"
            value={newsForm.tags}
            onChange={(e) => setNewsForm({ ...newsForm, tags: e.target.value })}
            margin="normal"
            placeholder="silver, news, update"
          />
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>Content</Typography>
            <TextareaAutosize
              minRows={6}
              style={{ width: '100%', padding: '8px', fontFamily: 'inherit', fontSize: '14px' }}
              value={newsForm.content}
              onChange={(e) => setNewsForm({ ...newsForm, content: e.target.value })}
              placeholder="Enter news content..."
            />
          </Box>
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
            <input
              type="checkbox"
              id="published"
              checked={newsForm.published}
              onChange={(e) => setNewsForm({ ...newsForm, published: e.target.checked })}
            />
            <label htmlFor="published" style={{ marginLeft: '8px' }}>Publish immediately</label>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewsDialogOpen(false)} disabled={loadingAction}>
            Cancel
          </Button>
          <Button onClick={handleSaveNews} variant="contained" disabled={loadingAction}>
            {loadingAction ? 'Saving...' : editingNews ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Store Info Dialog */}
      <Dialog
        open={storeDialogOpen}
        onClose={() => setStoreDialogOpen(false)}
        maxWidth="md"
        fullWidth
        disableEnforceFocus={false}
        disableAutoFocus={false}
        keepMounted={false}
        aria-labelledby="store-info-dialog-title"
      >
        <DialogTitle id="store-info-dialog-title">Edit Store Information</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Welcome Message"
            value={storeForm.welcomeMessage || ''}
            onChange={(e) => setStoreForm({ ...storeForm, welcomeMessage: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />
          <TextField
            fullWidth
            label="Phone Number"
            value={storeForm.phoneNumber || ''}
            onChange={(e) => setStoreForm({ ...storeForm, phoneNumber: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Address"
            value={storeForm.address || ''}
            onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
            margin="normal"
            multiline
            rows={2}
          />
          <TextField
            fullWidth
            label="Instagram URL"
            value={storeForm.instagram || ''}
            onChange={(e) => setStoreForm({ ...storeForm, instagram: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Facebook URL"
            value={storeForm.facebook || ''}
            onChange={(e) => setStoreForm({ ...storeForm, facebook: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="YouTube URL"
            value={storeForm.youtube || ''}
            onChange={(e) => setStoreForm({ ...storeForm, youtube: e.target.value })}
            margin="normal"
          />

          {/* Store Timings */}
          <Accordion sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="h6">Store Timings</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {(storeForm.storeTimings || []).map((timing, index) => (
                <Box key={index} sx={{ mb: 2, p: 2, border: `1px solid ${colors.divider}`, borderRadius: 1 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        label="Day"
                        value={timing.day || ''}
                        onChange={(e) => {
                          const newTimings = [...(storeForm.storeTimings || [])];
                          newTimings[index].day = e.target.value;
                          setStoreForm({ ...storeForm, storeTimings: newTimings });
                        }}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        label="Open Time"
                        value={timing.openTime || ''}
                        onChange={(e) => {
                          const newTimings = [...(storeForm.storeTimings || [])];
                          newTimings[index].openTime = e.target.value;
                          setStoreForm({ ...storeForm, storeTimings: newTimings });
                        }}
                        size="small"
                        placeholder="11:00 AM"
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        label="Close Time"
                        value={timing.closeTime || ''}
                        onChange={(e) => {
                          const newTimings = [...(storeForm.storeTimings || [])];
                          newTimings[index].closeTime = e.target.value;
                          setStoreForm({ ...storeForm, storeTimings: newTimings });
                        }}
                        size="small"
                        placeholder="08:30 PM"
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={timing.isClosed || false}
                            onChange={(e) => {
                              const newTimings = [...(storeForm.storeTimings || [])];
                              newTimings[index].isClosed = e.target.checked;
                              setStoreForm({ ...storeForm, storeTimings: newTimings });
                            }}
                          />
                        }
                        label="Closed"
                      />
                    </Grid>
                  </Grid>
                </Box>
              ))}
              <Button
                startIcon={<Add />}
                onClick={() => {
                  const newTimings = [...(storeForm.storeTimings || []), { day: '', openTime: '', closeTime: '', isClosed: false }];
                  setStoreForm({ ...storeForm, storeTimings: newTimings });
                }}
                size="small"
              >
                Add Timing
              </Button>
            </AccordionDetails>
          </Accordion>

          {/* Bank Details */}
          <Accordion sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="h6">Bank Details</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {(storeForm.bankDetails || []).map((bank, index) => (
                <Box key={index} sx={{ mb: 2, p: 2, border: `1px solid ${colors.divider}`, borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2">Bank {index + 1}</Typography>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        const newBanks = storeForm.bankDetails.filter((_, i) => i !== index);
                        setStoreForm({ ...storeForm, bankDetails: newBanks });
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Bank Name"
                        value={bank.bankName || ''}
                        onChange={(e) => {
                          const newBanks = [...(storeForm.bankDetails || [])];
                          newBanks[index].bankName = e.target.value;
                          setStoreForm({ ...storeForm, bankDetails: newBanks });
                        }}
                        size="small"
                        margin="normal"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Account Number"
                        value={bank.accountNumber || ''}
                        onChange={(e) => {
                          const newBanks = [...(storeForm.bankDetails || [])];
                          newBanks[index].accountNumber = e.target.value;
                          setStoreForm({ ...storeForm, bankDetails: newBanks });
                        }}
                        size="small"
                        margin="normal"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="IFSC Code"
                        value={bank.ifscCode || ''}
                        onChange={(e) => {
                          const newBanks = [...(storeForm.bankDetails || [])];
                          newBanks[index].ifscCode = e.target.value;
                          setStoreForm({ ...storeForm, bankDetails: newBanks });
                        }}
                        size="small"
                        margin="normal"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Account Holder Name"
                        value={bank.accountHolderName || ''}
                        onChange={(e) => {
                          const newBanks = [...(storeForm.bankDetails || [])];
                          newBanks[index].accountHolderName = e.target.value;
                          setStoreForm({ ...storeForm, bankDetails: newBanks });
                        }}
                        size="small"
                        margin="normal"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Branch"
                        value={bank.branch || ''}
                        onChange={(e) => {
                          const newBanks = [...(storeForm.bankDetails || [])];
                          newBanks[index].branch = e.target.value;
                          setStoreForm({ ...storeForm, bankDetails: newBanks });
                        }}
                        size="small"
                        margin="normal"
                      />
                    </Grid>
                  </Grid>
                </Box>
              ))}
              <Button
                startIcon={<Add />}
                onClick={() => {
                  const newBanks = [...(storeForm.bankDetails || []), { bankName: '', accountNumber: '', ifscCode: '', accountHolderName: '', branch: '' }];
                  setStoreForm({ ...storeForm, bankDetails: newBanks });
                }}
                size="small"
              >
                Add Bank
              </Button>
            </AccordionDetails>
          </Accordion>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStoreDialogOpen(false)} disabled={loadingAction}>
            Cancel
          </Button>
          <Button onClick={handleSaveStoreInfo} variant="contained" disabled={loadingAction}>
            {loadingAction ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box >
  );
}

export default AdminDashboardPage;

