import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tabs, Tab, CircularProgress, MenuItem, Select, FormControl, InputLabel, Grid, IconButton, TextareaAutosize } from '@mui/material';
import { Logout, CheckCircle, Cancel, Visibility, Remove, Add, Edit, Delete, Add as AddIcon, Newspaper, Person, Store, RestartAlt } from '@mui/icons-material';
import { AuthContext } from '../context/AuthContext';
import api from '../config/api';
import colors from '../theme/colors';

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

  useEffect(() => {
    fetchUsers();
    fetchRates();
    if (mainTab === 1) fetchNews();
    if (mainTab === 2) fetchStoreInfo();
  }, [mainTab]);

  const fetchRates = async () => {
    try {
      setLoadingRates(true);
      console.log('📡 Fetching rates from /rates endpoint...');
      const response = await api.get('/rates');
      console.log('✅ Rates fetched successfully:', response.data?.length || 0, 'rates');
      setRates(response.data || []);
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
      
      // Set empty array on error to prevent UI issues
      setRates([]);
    } finally {
      setLoadingRates(false);
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

  const handleAdjustRates = async () => {
    const value = parseFloat(adjustValue);
    if (isNaN(value) || value <= 0) {
      alert('Please enter a valid positive number');
      return;
    }
    try {
      setLoadingAction(true);
      const finalValue = adjustType === 'decrease' ? -Math.abs(value) : value;
      const payload = {
        value: finalValue,
        adjustmentType: adjustValueType // 'amount' or 'percentage'
      };
      if (selectedItem !== 'all') {
        payload.itemName = selectedItem;
      }
      const response = await api.post('/admin/adjust-rates', payload);
      const message = `Rates ${adjustType === 'decrease' ? 'decreased' : 'increased'} by ${adjustValueType === 'percentage' ? `${Math.abs(value)}%` : `₹${Math.abs(value)}/gram`}${selectedItem !== 'all' ? ` for ${selectedItem}` : ' for all items'} successfully`;
      alert(message);
      setAdjustDialogOpen(false);
      setAdjustValue('');
      setSelectedItem('all');
      setAdjustValueType('amount');
      // Refresh rates to show updated values
      await fetchRates();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to adjust rates');
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
      fetchNews();
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
      fetchNews();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete news post');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSaveStoreInfo = async () => {
    try {
      setLoadingAction(true);
      console.log('Saving store info:', storeForm);
      const response = await api.put('/store/info', storeForm);
      console.log('Store info saved:', response.data);
      alert('Store information updated successfully');
      setStoreDialogOpen(false);
      fetchStoreInfo();
    } catch (error) {
      console.error('Error saving store info:', error);
      console.error('Error response:', error.response?.data);
      alert(error.response?.data?.message || error.response?.data?.error || 'Failed to update store information. Please check console for details.');
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
            <Box sx={{ ml: 'auto' }}>
              <Button
                size="small"
                variant={showOriginalRates ? "contained" : "outlined"}
                {...(showOriginalRates ? { color: "primary" } : {})}
                startIcon={<RestartAlt />}
                onClick={() => setShowOriginalRates(!showOriginalRates)}
                disabled={loadingAction}
                sx={{ minWidth: 150 }}
              >
                {showOriginalRates ? 'Show Adjusted' : 'Show As It Is'}
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
            <Button size="small" onClick={fetchRates} disabled={loadingRates}>
              Refresh
            </Button>
          </Box>
          {loadingRates ? (
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
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Price per Gram</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Normal Price</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Adjusted Price</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Adjustment</TableCell>
                      </>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rates.map((rate) => {
                    const hasAdjustment = rate.manualAdjustment && rate.manualAdjustment !== 0;
                    const adjustment = rate.manualAdjustment || 0;
                    
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
                    
                    // Calculate true original rate from RB Gold (before any adjustments)
                    // Formula: Original = Current - Adjustment
                    // Example: If original was ₹184, decreased by 50% (-₹92), current is ₹92
                    // Then: Original = ₹92 - (-₹92) = ₹184 ✓
                    let originalRatePerGram = currentRatePerGram - adjustment;
                    
                    // Debug logging (remove in production)
                    if (showOriginalRates && hasAdjustment) {
                      console.log(`[${rate.name}] Current: ₹${currentRatePerGram}, Adjustment: ₹${adjustment}, Calculated Original: ₹${originalRatePerGram}`);
                    }
                    
                    // Safety check: If calculated original is negative or zero, try using stored originalRatePerGram
                    // But only if it makes sense (stored value should be higher than current if adjustment is negative)
                    if (originalRatePerGram <= 0 && rate.originalRatePerGram && rate.originalRatePerGram > currentRatePerGram) {
                      console.log(`[${rate.name}] Using stored originalRatePerGram: ₹${rate.originalRatePerGram}`);
                      originalRatePerGram = rate.originalRatePerGram;
                    }
                    
                    // Ensure original rate is never negative
                    originalRatePerGram = Math.max(0, originalRatePerGram);
                    const originalTotalPrice = Math.round(originalRatePerGram * weightInGrams * 100) / 100;
                    
                    // Adjusted price (current rate, may be 0 if adjustment makes it negative)
                    const adjustedPrice = currentTotalRate;
                    const adjustedRatePerGram = currentRatePerGram;
                    
                    // When showing "as it is", display original rates without adjustments
                    if (showOriginalRates) {
                      return (
                        <TableRow key={rate._id || rate.name}>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {rate.name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                              {rate.purity} • {rate.weight?.value} {rate.weight?.unit}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                              ₹{originalTotalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                              ₹{originalRatePerGram.toFixed(2)}/gram
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    
                    // Default view: show both normal and adjusted prices
                    return (
                      <TableRow key={rate._id || rate.name}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {rate.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                            {rate.purity} • {rate.weight?.value} {rate.weight?.unit}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                            ₹{originalTotalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                          <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block' }}>
                            ₹{originalRatePerGram.toFixed(2)}/gram
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: hasAdjustment ? 600 : 400,
                              color: adjustedPrice === 0 ? colors.error : (hasAdjustment ? (adjustment > 0 ? colors.success : colors.error) : colors.textPrimary)
                            }}
                          >
                            ₹{adjustedPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                          <Typography variant="caption" sx={{ color: adjustedPrice === 0 ? colors.error : colors.textSecondary, display: 'block' }}>
                            ₹{adjustedRatePerGram.toFixed(2)}/gram
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {hasAdjustment ? (
                            <Chip
                              label={`${adjustment > 0 ? '+' : ''}₹${adjustment.toFixed(2)}/gram`}
                              size="small"
                              sx={{
                                backgroundColor: adjustment > 0 ? colors.success : colors.error,
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
              {rates.map((rate) => (
                <MenuItem key={rate._id || rate.name} value={rate.name}>
                  {rate.name}
                </MenuItem>
              ))}
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
      </>
      )}

      {/* News Tab Content */}
      {mainTab === 1 && (
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
      )}

      {/* Profile/Store Tab Content */}
      {mainTab === 2 && (
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
              </Grid>
            ) : (
              <Alert severity="info">No store information available</Alert>
            )}
          </CardContent>
        </Card>
      )}

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
    </Box>
  );
}

export default AdminDashboardPage;

