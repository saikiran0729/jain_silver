import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Avatar,
  ToggleButton,
  ToggleButtonGroup,
  Link,
} from '@mui/material';
import { Email, Phone, Lock } from '@mui/icons-material';
import { AuthContext } from '../context/AuthContext';
import api from '../config/api';
import colors from '../theme/colors';

function AuthPage() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usePhone, setUsePhone] = useState(false);
  const [adminPhone, setAdminPhone] = useState(null);

  const handleSignIn = async () => {
    if ((!email && !phone) || !password) {
      setError('Please fill all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Build request body - only include defined fields
      const signinData = { password };
      if (usePhone) {
        signinData.phone = phone.trim();
      } else {
        signinData.email = email.toLowerCase().trim();
      }
      
      const response = await api.post('/auth/signin', signinData);

      if (response.data.token && response.data.user) {
        await login(response.data.token, response.data.user);
        if (response.data.user.role === 'admin') {
          navigate('/admin/dashboard');
        } else {
          navigate('/');
        }
      } else {
        setError('Invalid response from server');
      }
    } catch (err) {
      // Handle different error types
      let errorMessage = 'Sign in failed. Please check your connection and try again.';
      
      if (err.response?.status === 400) {
        // Validation errors
        const errors = err.response?.data?.errors;
        if (errors && Array.isArray(errors) && errors.length > 0) {
          errorMessage = errors.map(e => e.msg || e.message).join(', ');
        } else {
          errorMessage = err.response?.data?.message || 'Invalid credentials. Please check your email/phone and password.';
        }
      } else if (err.response?.status === 401) {
        errorMessage = 'Invalid credentials. Please check your email/phone and password.';
      } else if (err.response?.status === 503) {
        errorMessage = 'Database connection failed. Please try again in a moment.';
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.errors?.[0]?.msg) {
        errorMessage = err.response.data.errors[0].msg;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      // Show status information if available
      const userStatus = err.response?.data?.userStatus || err.response?.data?.status;
      const responseAdminPhone = err.response?.data?.adminPhone || adminPhone;
      
      if (userStatus) {
        let statusMessage = errorMessage;
        
        // Add admin contact for rejected/pending users
        if ((userStatus === 'rejected' || userStatus === 'pending') && responseAdminPhone) {
          statusMessage = `${errorMessage}\n\nAdmin Contact: ${responseAdminPhone}`;
        }
        
        setError(statusMessage);
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        backgroundColor: colors.background,
      }}
    >
      {/* Left Side - Logo Section */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          width: { md: '50%', lg: '55%' },
          backgroundColor: '#ffffff',
          alignItems: 'center',
          justifyContent: 'center',
          p: 6,
          position: 'relative',
          borderRight: '1px solid rgba(0,0,0,0.08)',
        }}
      >
        <Box
          sx={{
            textAlign: 'center',
            maxWidth: 600,
            width: '100%',
          }}
        >
          <Box
            component="img"
            src="/1764232687647-removebg-preview.png"
            alt="Jain Silver Plaza"
            sx={{
              width: '100%',
              maxWidth: 450,
              height: 'auto',
              mb: 5,
              objectFit: 'contain',
              mx: 'auto',
              display: 'block',
            }}
          />
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              color: colors.textPrimary,
              mb: 2,
              fontSize: { md: '2rem', lg: '2.5rem' },
            }}
          >
            Welcome Back
          </Typography>
          <Typography
            variant="h6"
            sx={{
              color: colors.textSecondary,
              fontWeight: 400,
              lineHeight: 1.8,
              fontSize: { md: '1rem', lg: '1.1rem' },
            }}
          >
            Your trusted partner for premium silver products
          </Typography>
        </Box>
      </Box>

      {/* Right Side - Login Form */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: { xs: '100%', md: '50%', lg: '45%' },
          p: { xs: 3, sm: 4, md: 6 },
        }}
      >
        <Card
          sx={{
            width: '100%',
            maxWidth: 450,
            borderRadius: 3,
            boxShadow: { xs: 'none', sm: '0 4px 20px rgba(0,0,0,0.1)' },
            border: { xs: 'none', sm: '1px solid rgba(0,0,0,0.1)' },
          }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 4, md: 5 } }}>
            {/* Mobile Logo - Only visible on small screens */}
            <Box
              sx={{
                display: { xs: 'flex', md: 'none' },
                flexDirection: 'column',
                alignItems: 'center',
                mb: 4,
              }}
            >
              <Box
                component="img"
                src="/1764232687647-removebg-preview.png"
                alt="Jain Silver Plaza"
                sx={{
                  width: 250,
                  height: 'auto',
                  maxWidth: '100%',
                  mb: 2,
                  objectFit: 'contain',
                }}
              />
            </Box>

            <Box sx={{ mb: 4 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: colors.textPrimary, mb: 1 }}>
                Sign In
              </Typography>
              <Typography variant="body1" sx={{ color: colors.textSecondary }}>
                Sign in to your account to continue
              </Typography>
            </Box>

          {error && (
            <Alert 
              severity="error" 
              sx={{ mb: 2, whiteSpace: 'pre-line' }}
              action={
                (error.includes('rejected') || error.includes('pending')) && adminPhone ? (
                  <Button
                    size="small"
                    color="inherit"
                    startIcon={<Phone />}
                    onClick={() => handlePhoneCall(adminPhone)}
                    sx={{ textTransform: 'none' }}
                  >
                    Call Admin
                  </Button>
                ) : null
              }
            >
              {error}
            </Alert>
          )}

          <ToggleButtonGroup
            value={usePhone ? 'phone' : 'email'}
            exclusive
            onChange={(e, value) => setUsePhone(value === 'phone')}
            fullWidth
            sx={{ mb: 2 }}
          >
            <ToggleButton value="email">Email</ToggleButton>
            <ToggleButton value="phone">Phone</ToggleButton>
          </ToggleButtonGroup>

          {usePhone ? (
            <TextField
              fullWidth
              label="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              margin="normal"
              InputProps={{
                startAdornment: <Phone sx={{ mr: 1, color: colors.textHint }} />,
              }}
            />
          ) : (
            <TextField
              fullWidth
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              margin="normal"
              InputProps={{
                startAdornment: <Email sx={{ mr: 1, color: colors.textHint }} />,
              }}
            />
          )}

          <TextField
            fullWidth
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            margin="normal"
            InputProps={{
              startAdornment: <Lock sx={{ mr: 1, color: colors.textHint }} />,
            }}
          />

          <Button
            fullWidth
            variant="contained"
            onClick={handleSignIn}
            disabled={loading}
            sx={{
              mt: 3,
              mb: 2,
              py: 1.5,
              backgroundColor: colors.primary,
              '&:hover': { backgroundColor: colors.primaryDark },
            }}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </Button>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 3 }}>
              <Button
                variant="text"
                onClick={() => navigate('/forgot-password')}
                sx={{
                  color: colors.primary,
                  textTransform: 'none',
                  fontSize: '0.95rem',
                }}
              >
                Forgot Password?
              </Button>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center', mt: 1 }}>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  Don't have an account?
                </Typography>
                <Button
                  variant="text"
                  onClick={() => navigate('/register')}
                  sx={{
                    color: colors.primary,
                    textTransform: 'none',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    p: 0,
                    minWidth: 'auto',
                  }}
                >
                  Register Here
                </Button>
              </Box>
              <Button
                variant="text"
                onClick={() => navigate('/admin/login')}
                sx={{
                  color: colors.textSecondary,
                  textTransform: 'none',
                  fontSize: '0.85rem',
                  mt: 1,
                }}
              >
                Admin Login
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

export default AuthPage;

