import React, { useContext } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Avatar,
  Chip,
} from '@mui/material';
import {
  Newspaper as NewsIcon,
  AccountCircle as ProfileIcon,
  TrendingUp as RatesIcon,
} from '@mui/icons-material';
import { Button } from '@mui/material';
import { AuthContext } from '../context/AuthContext';
import colors from '../theme/colors';

function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useContext(AuthContext);


  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          backgroundColor: '#ffffff',
          borderBottom: `2px solid #d32f2f`,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <Toolbar
          sx={{
            px: { xs: 2, sm: 3, md: 4 },
            py: 1.5,
            minHeight: { xs: '70px !important', sm: '80px !important' },
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <Box
            component="img"
            src="/1764232687647-removebg-preview.png"
            alt="Jain Silver Plaza"
            sx={{
              height: { xs: 60, sm: 70, md: 80 },
              width: 'auto',
              mr: 2,
              cursor: 'pointer',
              objectFit: 'contain',
            }}
            onClick={() => navigate('/')}
          />
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0, alignItems: 'center', flex: 1, justifyContent: 'center' }}>
            <Button
              onClick={() => navigate('/')}
              sx={{
                color: location.pathname === '/' ? '#d32f2f' : '#333333',
                fontWeight: location.pathname === '/' ? 700 : 500,
                textTransform: 'none',
                fontSize: '0.95rem',
                px: 2,
                py: 1,
                borderBottom: location.pathname === '/' ? '3px solid #d32f2f' : '3px solid transparent',
                borderRadius: 0,
                '&:hover': {
                  backgroundColor: 'rgba(211, 47, 47, 0.05)',
                  color: '#d32f2f',
                },
              }}
            >
              Live Rates
            </Button>
            <Button
              onClick={() => navigate('/news')}
              sx={{
                color: location.pathname === '/news' ? '#d32f2f' : '#333333',
                fontWeight: location.pathname === '/news' ? 700 : 500,
                textTransform: 'none',
                fontSize: '0.95rem',
                px: 2,
                py: 1,
                borderBottom: location.pathname === '/news' ? '3px solid #d32f2f' : '3px solid transparent',
                borderRadius: 0,
                '&:hover': {
                  backgroundColor: 'rgba(211, 47, 47, 0.05)',
                  color: '#d32f2f',
                },
              }}
            >
              News
            </Button>
            <Button
              onClick={() => navigate('/profile')}
              sx={{
                color: location.pathname === '/profile' ? '#d32f2f' : '#333333',
                fontWeight: location.pathname === '/profile' ? 700 : 500,
                textTransform: 'none',
                fontSize: '0.95rem',
                px: 2,
                py: 1,
                borderBottom: location.pathname === '/profile' ? '3px solid #d32f2f' : '3px solid transparent',
                borderRadius: 0,
                '&:hover': {
                  backgroundColor: 'rgba(211, 47, 47, 0.05)',
                  color: '#d32f2f',
                },
              }}
            >
              Profile
            </Button>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={user?.location || 'Andhra Pradesh'}
              size="small"
              sx={{
                backgroundColor: '#f5f5f5',
                color: '#333333',
                fontWeight: 600,
                fontSize: '0.75rem',
                height: 28,
                display: { xs: 'none', sm: 'flex' },
              }}
            />
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ flexGrow: 1, backgroundColor: colors.background }}>
        <Outlet />
      </Box>
    </Box>
  );
}

export default Layout;

