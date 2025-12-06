import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  ImageList, 
  ImageListItem, 
  CircularProgress,
  Grid,
  Chip,
  Divider,
  Paper
} from '@mui/material';
import { ArrowBack, Person, Email, Phone, VerifiedUser, CalendarToday, CheckCircle, Cancel, Pending } from '@mui/icons-material';
import api from '../config/api';
import colors from '../theme/colors';

function UserDocumentsPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserDocuments();
  }, [userId]);

  const fetchUserDocuments = async () => {
    try {
      const response = await api.get(`/admin/user/${userId}`);
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching user documents:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return colors.success;
      case 'rejected':
        return colors.error;
      case 'pending':
        return '#ff9800';
      default:
        return colors.textSecondary;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle sx={{ fontSize: 20 }} />;
      case 'rejected':
        return <Cancel sx={{ fontSize: 20 }} />;
      case 'pending':
        return <Pending sx={{ fontSize: 20 }} />;
      default:
        return null;
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      <Button 
        startIcon={<ArrowBack />} 
        onClick={() => navigate('/admin/dashboard')} 
        sx={{ mb: 3 }}
      >
        Back
      </Button>

      {/* User Details Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: colors.textPrimary }}>
              {user?.name}'s Details
            </Typography>
            <Chip
              icon={getStatusIcon(user?.status)}
              label={user?.status?.toUpperCase() || 'UNKNOWN'}
              sx={{
                backgroundColor: getStatusColor(user?.status),
                color: 'white',
                fontWeight: 700,
                fontSize: '0.875rem',
                padding: '4px 8px'
              }}
            />
          </Box>

          <Grid container spacing={3}>
            {/* Personal Information */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, backgroundColor: colors.primaryVeryLight }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Person sx={{ color: colors.primary }} />
                  Personal Information
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
                      Full Name
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {user?.name || 'N/A'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Email sx={{ fontSize: 14 }} />
                      Email Address
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {user?.email || 'N/A'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Phone sx={{ fontSize: 14 }} />
                      Phone Number
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {user?.phone || 'N/A'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
                      Role
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {user?.role === 'admin' ? 'Administrator' : 'User'}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>

            {/* Account Status & Dates */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, backgroundColor: colors.primaryVeryLight }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <VerifiedUser sx={{ color: colors.primary }} />
                  Account Status
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
                      Verification Status
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      {user?.isVerified ? (
                        <Chip 
                          icon={<CheckCircle />} 
                          label="Verified" 
                          size="small" 
                          sx={{ backgroundColor: colors.success, color: 'white' }}
                        />
                      ) : (
                        <Chip 
                          icon={<Pending />} 
                          label="Not Verified" 
                          size="small" 
                          sx={{ backgroundColor: '#ff9800', color: 'white' }}
                        />
                      )}
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CalendarToday sx={{ fontSize: 14 }} />
                      Registration Date
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {formatDate(user?.createdAt)}
                    </Typography>
                  </Box>
                  {user?.approvedAt && (
                    <Box>
                      <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
                        Approval Date
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {formatDate(user?.approvedAt)}
                      </Typography>
                    </Box>
                  )}
                  {user?.updatedAt && (
                    <Box>
                      <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
                        Last Updated
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {formatDate(user?.updatedAt)}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            </Grid>

            {/* Document Numbers */}
            {(user?.documents?.aadhar?.number || user?.documents?.pan?.number) && (
              <Grid item xs={12}>
                <Paper sx={{ p: 2, backgroundColor: colors.primaryVeryLight }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Document Numbers
                  </Typography>
                  <Grid container spacing={2}>
                    {user?.documents?.aadhar?.number && (
                      <Grid item xs={12} sm={6}>
                        <Box>
                          <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
                            Aadhar Number
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                            {user.documents.aadhar.number}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    {user?.documents?.pan?.number && (
                      <Grid item xs={12} sm={6}>
                        <Box>
                          <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
                            PAN Number
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                            {user.documents.pan.number}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                </Paper>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Documents Section */}
      <Card>
        <CardContent>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>
            Documents
          </Typography>
          {user?.documents && (
            <ImageList cols={3} gap={16} sx={{ margin: 0 }}>
              {user.documents.aadhar?.front && (
                <ImageListItem>
                  <img 
                    src={user.documents.aadhar.front} 
                    alt="Aadhar Front" 
                    style={{ width: '100%', height: 'auto', borderRadius: '8px' }}
                    loading="lazy"
                  />
                  <Box sx={{ mt: 1, textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      Aadhar Front
                    </Typography>
                  </Box>
                </ImageListItem>
              )}
              {user.documents.aadhar?.back && (
                <ImageListItem>
                  <img 
                    src={user.documents.aadhar.back} 
                    alt="Aadhar Back" 
                    style={{ width: '100%', height: 'auto', borderRadius: '8px' }}
                    loading="lazy"
                  />
                  <Box sx={{ mt: 1, textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      Aadhar Back
                    </Typography>
                  </Box>
                </ImageListItem>
              )}
              {user.documents.pan?.image && (
                <ImageListItem>
                  <img 
                    src={user.documents.pan.image} 
                    alt="PAN" 
                    style={{ width: '100%', height: 'auto', borderRadius: '8px' }}
                    loading="lazy"
                  />
                  <Box sx={{ mt: 1, textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      PAN Card
                    </Typography>
                  </Box>
                </ImageListItem>
              )}
              {user.documents.selfie && (
                <ImageListItem>
                  <img 
                    src={user.documents.selfie} 
                    alt="Selfie" 
                    style={{ width: '100%', height: 'auto', borderRadius: '8px' }}
                    loading="lazy"
                  />
                  <Box sx={{ mt: 1, textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      Selfie
                    </Typography>
                  </Box>
                </ImageListItem>
              )}
            </ImageList>
          )}
          {(!user?.documents?.aadhar?.front && !user?.documents?.aadhar?.back && !user?.documents?.pan?.image && !user?.documents?.selfie) && (
            <Typography variant="body2" sx={{ color: colors.textSecondary, textAlign: 'center', py: 4 }}>
              No documents uploaded yet
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default UserDocumentsPage;

