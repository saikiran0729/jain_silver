import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, TextField, Button, Typography, Alert, Table, TableBody, TableCell, TableContainer, TableRow, Paper, CircularProgress } from '@mui/material';
import { AuthContext } from '../context/AuthContext';
import api from '../config/api';
import colors from '../theme/colors';

function AdminLoginPage() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rates, setRates] = useState([]);
  const [loadingRates, setLoadingRates] = useState(true);

  // Fetch rates on mount and every second
  useEffect(() => {
    fetchRates();
    const interval = setInterval(() => {
      fetchRates();
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchRates = async () => {
    try {
      const response = await api.get('/rates', {
        params: { skipUpdate: true },
        timeout: 30000
      });
      // Handle both response formats:
      // - Array directly (normal success case)
      // - Object with .rates property (fallback/unavailable case)
      let ratesData = [];
      if (Array.isArray(response.data)) {
        ratesData = response.data;
      } else if (response.data && Array.isArray(response.data.rates)) {
        ratesData = response.data.rates;
      }

      if (ratesData.length > 0) {
        // Filter to show only Gold products
        const goldProducts = ratesData.filter(rate =>
          rate.name?.toLowerCase().includes('gold')
        );
        setRates(goldProducts);
      }
    } catch (err) {
      console.error('Error fetching rates:', err);
    } finally {
      setLoadingRates(false);
    }
  };

  const handleAdminSignIn = async () => {
    if (!email || !password) {
      setError('Please fill all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/admin/signin', {
        email: email.toLowerCase().trim(),
        password,
      });

      if (response.data.token && response.data.user) {
        await login(response.data.token, response.data.user);
        navigate('/admin/dashboard');
      } else {
        setError('Invalid response from server');
      }
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        'Admin sign in failed. Please check your connection and try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  const getUnit = (name) => {
    if (name.toLowerCase().includes('gold')) {
      return '/10g';
    }
    return '/kg';
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, backgroundColor: colors.background }}>
      <Box sx={{ maxWidth: 900, width: '100%', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Live Prices Card */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, textAlign: 'center' }}>
              Live Gold Prices
            </Typography>
            {loadingRates ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress size={30} />
              </Box>
            ) : (
              <TableContainer component={Paper} elevation={0}>
                <Table size="small">
                  <TableBody>
                    {rates.map((rate) => (
                      <TableRow key={rate._id}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {rate.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {rate.purity} • {rate.weight}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                            {formatPrice(rate.originalRatePerGram * (rate.name.toLowerCase().includes('gold') ? 10 : 1000))}{getUnit(rate.name)}
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: colors.primary }}>
                            {formatPrice(rate.adjustedPrice)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        {/* Login Card */}
        <Card>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" sx={{ mb: 3, fontWeight: 700, textAlign: 'center' }}>
              Admin Login
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TextField fullWidth label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} margin="normal" />
            <TextField fullWidth label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} margin="normal" />
            <Button fullWidth variant="contained" onClick={handleAdminSignIn} disabled={loading} sx={{ mt: 3 }}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
            <Button fullWidth variant="text" onClick={() => navigate('/')} sx={{ mt: 1 }}>
              Back to User Login
            </Button>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

export default AdminLoginPage;

