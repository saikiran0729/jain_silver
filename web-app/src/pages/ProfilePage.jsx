import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, Typography, Button, Divider, Chip, Alert, Grid } from '@mui/material';
import { Logout, AccountCircle, Phone, Store, AccountBalance, Verified, Star, Info } from '@mui/icons-material';
import { AuthContext } from '../context/AuthContext';
import api from '../config/api';
import colors from '../theme/colors';

function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [storeInfo, setStoreInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
    fetchStoreInfo();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/users/profile', {
        timeout: 30000 // Increased to 30 seconds for serverless MongoDB connection
      });
      if (response.data) {
        setProfile(response.data);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || 'Network Error';
      console.error('Error fetching profile:', {
        message: errorMsg,
        status: error.response?.status,
        code: error.code
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStoreInfo = async () => {
    try {
      const response = await api.get('/store/info', {
        timeout: 10000,
        params: { _t: Date.now() } // Cache busting
      });
      if (response.data) {
        setStoreInfo(response.data);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || 'Network Error';
      console.error('Error fetching store info:', {
        message: errorMsg,
        status: error.response?.status,
        code: error.code
      });
      // Don't show error to user - use default data
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logout();
      navigate('/');
    }
  };

  const handlePhoneCall = (phoneNumber) => {
    if (phoneNumber) {
      window.open(`tel:${phoneNumber}`, '_self');
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
      {/* Personal Information Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <AccountCircle sx={{ mr: 1, color: colors.primary, fontSize: 32 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Personal Information
            </Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>Name</Typography>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>{profile?.name || user?.name || 'N/A'}</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>Email</Typography>
                <Typography variant="body1">{profile?.email || user?.email || 'N/A'}</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>Phone</Typography>
                <Typography variant="body1">{profile?.phone || user?.phone || 'N/A'}</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>Status</Typography>
                <Chip
                  label={(profile?.status || 'pending').toUpperCase()}
                  color={profile?.status === 'approved' ? 'success' : profile?.status === 'rejected' ? 'error' : 'warning'}
                  sx={{ mt: 0.5 }}
                />
              </Box>
            </Grid>
            {profile?.aadharNumber && (
              <Grid item xs={12} sm={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>Aadhar Number</Typography>
                  <Typography variant="body1">{profile.aadharNumber}</Typography>
                </Box>
              </Grid>
            )}
            {profile?.panNumber && (
              <Grid item xs={12} sm={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>PAN Number</Typography>
                  <Typography variant="body1">{profile.panNumber}</Typography>
                </Box>
              </Grid>
            )}
            <Grid item xs={12} sm={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>Account Type</Typography>
                <Chip
                  label={profile?.role === 'admin' ? 'Administrator' : 'Customer'}
                  size="small"
                  sx={{
                    backgroundColor: profile?.role === 'admin' ? colors.primary : colors.primaryVeryLight,
                    color: profile?.role === 'admin' ? 'white' : colors.textPrimary,
                    fontWeight: 600
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>Verification Status</Typography>
                <Chip
                  icon={profile?.isVerified ? <Verified /> : null}
                  label={profile?.isVerified ? 'Verified' : 'Not Verified'}
                  size="small"
                  sx={{
                    backgroundColor: profile?.isVerified ? colors.success + '20' : colors.warning + '20',
                    color: profile?.isVerified ? colors.success : colors.warning,
                    fontWeight: 600
                  }}
                />
              </Box>
            </Grid>
            {profile?.createdAt && (
              <Grid item xs={12} sm={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>Member Since</Typography>
                  <Typography variant="body1">
                    {new Date(profile.createdAt).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </Typography>
                </Box>
              </Grid>
            )}
            {profile?.approvedAt && (
              <Grid item xs={12} sm={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>Account Approved</Typography>
                  <Typography variant="body1">
                    {new Date(profile.approvedAt).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </Typography>
                </Box>
              </Grid>
            )}
            {profile?.updatedAt && (
              <Grid item xs={12} sm={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>Last Updated</Typography>
                  <Typography variant="body1">
                    {new Date(profile.updatedAt).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Typography>
                </Box>
              </Grid>
            )}
            <Grid item xs={12} sm={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>Documents Uploaded</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                  {profile?.documents?.aadhar?.front && profile?.documents?.aadhar?.back ? (
                    <Chip label="Aadhar" size="small" color="success" />
                  ) : (
                    <Chip label="Aadhar" size="small" color="default" />
                  )}
                  {profile?.documents?.pan?.image ? (
                    <Chip label="PAN" size="small" color="success" />
                  ) : (
                    <Chip label="PAN" size="small" color="default" />
                  )}
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Bank Details Card */}
      {storeInfo?.bankDetails && storeInfo.bankDetails.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <AccountBalance sx={{ mr: 1, color: colors.primary, fontSize: 32 }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Bank Details
              </Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {storeInfo.bankDetails.map((bank, index) => (
              <Box key={index} sx={{ mb: index < storeInfo.bankDetails.length - 1 ? 3 : 0 }}>
                {index > 0 && <Divider sx={{ mb: 2 }} />}
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" sx={{ color: colors.textSecondary }}>Bank Name</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>{bank.bankName || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" sx={{ color: colors.textSecondary }}>Account Number</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>{bank.accountNumber || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" sx={{ color: colors.textSecondary }}>IFSC Code</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>{bank.ifscCode || 'N/A'}</Typography>
                  </Grid>
                  {bank.accountHolderName && (
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" sx={{ color: colors.textSecondary }}>Account Holder</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>{bank.accountHolderName}</Typography>
                    </Grid>
                  )}
                  {bank.branch && (
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" sx={{ color: colors.textSecondary }}>Branch</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>{bank.branch}</Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Store Contact Card */}
      {storeInfo && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Store sx={{ mr: 1, color: colors.primary, fontSize: 32 }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Store Contact
              </Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {storeInfo.phoneNumber && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>{storeInfo.phoneNumber}</Typography>
                <Button
                  variant="contained"
                  startIcon={<Phone />}
                  onClick={() => handlePhoneCall(storeInfo.phoneNumber)}
                  sx={{ backgroundColor: colors.primary }}
                >
                  Call Store
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* About Jain Silver Plaza Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Info sx={{ mr: 1, color: colors.primary, fontSize: 32 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              About Jain Silver Plaza
            </Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.8 }}>
            <strong>Jain Silver Plaza</strong> is recognized as one of the <strong>best silver shops in Vijayawada</strong>. 
            We specialize in premium quality silver coins, bars, and exquisite jewelry with transparent pricing 
            and excellent customer service.
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, p: 1.5, backgroundColor: colors.primaryVeryLight, borderRadius: 2, width: 'fit-content' }}>
            <Star sx={{ color: '#FFC107', mr: 1 }} />
            <Typography variant="h6" sx={{ mr: 1, fontWeight: 700 }}>4.4</Typography>
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>(84+ Customer Reviews)</Typography>
          </Box>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Verified sx={{ color: colors.success, mr: 1, fontSize: 20 }} />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>Authentic Silver Products</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Verified sx={{ color: colors.success, mr: 1, fontSize: 20 }} />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>Live Market Rates</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Verified sx={{ color: colors.success, mr: 1, fontSize: 20 }} />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>Secure Transactions</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Verified sx={{ color: colors.success, mr: 1, fontSize: 20 }} />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>Expert Customer Service</Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Logout Button */}
      <Card>
        <CardContent>
          <Button
            fullWidth
            variant="contained"
            color="error"
            startIcon={<Logout />}
            onClick={handleLogout}
            sx={{ py: 1.5 }}
          >
            Logout
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}

export default ProfilePage;

