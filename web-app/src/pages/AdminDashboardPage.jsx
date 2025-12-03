import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tabs, Tab, CircularProgress, MenuItem, Select, FormControl, InputLabel, Grid, IconButton, TextareaAutosize } from '@mui/material';
import { Logout, CheckCircle, Cancel, Visibility, Remove, Add, Edit, Delete, Add as AddIcon, Newspaper, Person, Store } from '@mui/icons-material';
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
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState('increase'); // 'increase' or 'decrease'
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

  useEffect(() => {
    fetchUsers();
    fetchRates();
    if (mainTab === 1) fetchNews();
    if (mainTab === 2) fetchStoreInfo();
  }, [mainTab]);

  const fetchRates = async () => {
    try {
      setLoadingRates(true);
      const response = await api.get('/rates');
      setRates(response.data || []);
    } catch (error) {
      console.error('Error fetching rates:', error);
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
      
      try {
        const pendingResponse = await api.get('/admin/pending-users');
        setPendingUsers(pendingResponse.data || []);
      } catch (pendingError) {
        console.error('Error fetching pending users:', pendingError);
        const errorMsg = pendingError.response?.data?.message || pendingError.message || 'Failed to fetch pending users';
        if (pendingError.response?.status === 401 || pendingError.response?.status === 403) {
          alert(`Authentication error: ${errorMsg}. Please sign in again.`);
          navigate('/admin/login');
          return;
        }
        alert(`Failed to fetch pending users: ${errorMsg}`);
        setPendingUsers([]);
      }
      
      // Try to fetch all users
      try {
        const allResponse = await api.get('/admin/users');
        setAllUsers(allResponse.data || []);
      } catch (allUsersError) {
        console.error('Error fetching all users:', allUsersError);
        const errorMsg = allUsersError.response?.data?.message || allUsersError.message || 'Failed to fetch all users';
        if (allUsersError.response?.status === 401 || allUsersError.response?.status === 403) {
          // Already handled above, just use pending users
          setAllUsers(pendingUsers);
        } else {
          console.warn('All users endpoint not available, using pending users only');
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
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid positive number');
      return;
    }
    try {
      setLoadingAction(true);
      const finalAmount = adjustType === 'decrease' ? -Math.abs(amount) : amount;
      const payload = { amount: finalAmount };
      if (selectedItem !== 'all') {
        payload.itemName = selectedItem;
      }
      const response = await api.post('/admin/adjust-rates', payload);
      const percentage = response.data?.percentageChange || 0;
      const message = `Rates ${adjustType === 'decrease' ? 'decreased' : 'increased'} by ₹${amount}/gram (${percentage > 0 ? '+' : ''}${percentage}%)${selectedItem !== 'all' ? ` for ${selectedItem}` : ' for all items'} successfully`;
      alert(message);
      setAdjustDialogOpen(false);
      setAdjustAmount('');
      setSelectedItem('all');
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
      setNewsPosts(response.data?.news || []);
    } catch (error) {
      console.error('Error fetching news:', error);
      alert('Failed to fetch news posts');
    } finally {
      setLoadingNews(false);
    }
  };

  const fetchStoreInfo = async () => {
    try {
      setLoadingStore(true);
      const response = await api.get('/store/info');
      setStoreInfo(response.data);
      setStoreForm(response.data);
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
      await api.put('/store/info', storeForm);
      alert('Store information updated successfully');
      setStoreDialogOpen(false);
      fetchStoreInfo();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update store information');
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
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="error"
              startIcon={<Remove />}
              onClick={() => {
                setAdjustType('decrease');
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
                setAdjustDialogOpen(true);
              }}
              disabled={loadingAction}
            >
              Increase Rates
            </Button>
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
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Normal Price</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Adjusted Price</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Adjustment</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rates.map((rate) => {
                    const hasAdjustment = rate.manualAdjustment && rate.manualAdjustment !== 0;
                    const normalPrice = rate.originalRate || rate.rate;
                    const adjustedPrice = rate.rate;
                    const adjustment = rate.manualAdjustment || 0;
                    
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
                            ₹{normalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                          <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block' }}>
                            ₹{rate.originalRatePerGram?.toFixed(2) || rate.ratePerGram.toFixed(2)}/gram
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: hasAdjustment ? 600 : 400,
                              color: hasAdjustment ? (adjustment > 0 ? colors.success : colors.error) : colors.textPrimary
                            }}
                          >
                            ₹{adjustedPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                          <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block' }}>
                            ₹{rate.ratePerGram.toFixed(2)}/gram
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
      <Dialog open={adjustDialogOpen} onClose={() => setAdjustDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {adjustType === 'decrease' ? 'Decrease Rates' : 'Increase Rates'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: colors.textSecondary }}>
            Enter the amount per gram to {adjustType === 'decrease' ? 'decrease' : 'increase'} rates.
            Example: Enter 100 to {adjustType === 'decrease' ? 'decrease' : 'increase'} by ₹100/gram.
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
          <TextField
            fullWidth
            label={`Amount to ${adjustType === 'decrease' ? 'decrease' : 'increase'}`}
            type="number"
            value={adjustAmount}
            onChange={(e) => setAdjustAmount(e.target.value)}
            margin="normal"
            placeholder="e.g., 100"
            inputProps={{ min: 0, step: 0.01 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjustDialogOpen(false)} disabled={loadingAction}>
            Cancel
          </Button>
          <Button
            onClick={handleAdjustRates}
            variant="contained"
            color={adjustType === 'decrease' ? 'error' : 'success'}
            disabled={loadingAction || !adjustAmount}
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
      <Dialog open={newsDialogOpen} onClose={() => setNewsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingNews ? 'Edit News Post' : 'Create News Post'}</DialogTitle>
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
      <Dialog open={storeDialogOpen} onClose={() => setStoreDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Store Information</DialogTitle>
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

