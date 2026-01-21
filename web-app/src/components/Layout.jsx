import React, { useContext, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import {
  Newspaper as NewsIcon,
  AccountCircle as ProfileIcon,
  TrendingUp as RatesIcon,
  Menu as MenuIcon,
} from '@mui/icons-material';
import { Button } from '@mui/material';
import { AuthContext } from '../context/AuthContext';
import colors from '../theme/colors';

function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useContext(AuthContext);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);


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
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 2, cursor: 'pointer' }} onClick={() => navigate('/')}>
            <Box
              component="img"
              src="/1764232687647-removebg-preview.png"
              alt="Jain Silver Plaza"
              sx={{
                height: { xs: 70, sm: 80, md: 90 }, // Increased size
                width: 'auto',
                mr: 2,
                objectFit: 'contain',
              }}
            />
            <Typography
              variant="h6"
              component="div"
              sx={{
                fontWeight: 700,
                color: colors.primary, // Using theme color (Red)
                display: { xs: 'none', sm: 'block' }, // Hide on very small screens if needed, or show
                fontSize: { xs: '1rem', sm: '1.2rem', md: '1.4rem' },
                lineHeight: 1.2,
              }}
            >
              JAIN SILVER PLAZA
            </Typography>
          </Box>
          {/* Desktop Navigation */}
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

          {/* Location Chip - Center on mobile, hidden on desktop */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <Chip
              label={user?.location || 'Andhra Pradesh'}
              size="small"
              sx={{
                backgroundColor: '#f5f5f5',
                color: '#333333',
                fontWeight: 600,
                fontSize: '0.75rem',
                height: 28,
              }}
            />
          </Box>

          {/* Right side - Mobile Menu Button */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Mobile Menu Button - At the end */}
            <IconButton
              sx={{ display: { xs: 'flex', md: 'none' }, color: '#333333' }}
              onClick={() => setMobileMenuOpen(true)}
            >
              <MenuIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer Menu */}
      <Drawer
        anchor="right"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        sx={{
          display: { xs: 'block', md: 'none' },
        }}
      >
        <Box sx={{ width: 250, pt: 2 }}>
          <List>
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => {
                  navigate('/');
                  setMobileMenuOpen(false);
                }}
                sx={{
                  backgroundColor: location.pathname === '/' ? 'rgba(211, 47, 47, 0.1)' : 'transparent',
                  borderLeft: location.pathname === '/' ? '4px solid #d32f2f' : '4px solid transparent',
                }}
              >
                <RatesIcon sx={{ mr: 2, color: location.pathname === '/' ? '#d32f2f' : '#333333' }} />
                <ListItemText
                  primary="Live Rates"
                  sx={{
                    color: location.pathname === '/' ? '#d32f2f' : '#333333',
                    fontWeight: location.pathname === '/' ? 700 : 500,
                  }}
                />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => {
                  navigate('/news');
                  setMobileMenuOpen(false);
                }}
                sx={{
                  backgroundColor: location.pathname === '/news' ? 'rgba(211, 47, 47, 0.1)' : 'transparent',
                  borderLeft: location.pathname === '/news' ? '4px solid #d32f2f' : '4px solid transparent',
                }}
              >
                <NewsIcon sx={{ mr: 2, color: location.pathname === '/news' ? '#d32f2f' : '#333333' }} />
                <ListItemText
                  primary="News"
                  sx={{
                    color: location.pathname === '/news' ? '#d32f2f' : '#333333',
                    fontWeight: location.pathname === '/news' ? 700 : 500,
                  }}
                />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => {
                  navigate('/profile');
                  setMobileMenuOpen(false);
                }}
                sx={{
                  backgroundColor: location.pathname === '/profile' ? 'rgba(211, 47, 47, 0.1)' : 'transparent',
                  borderLeft: location.pathname === '/profile' ? '4px solid #d32f2f' : '4px solid transparent',
                }}
              >
                <ProfileIcon sx={{ mr: 2, color: location.pathname === '/profile' ? '#d32f2f' : '#333333' }} />
                <ListItemText
                  primary="Profile"
                  sx={{
                    color: location.pathname === '/profile' ? '#d32f2f' : '#333333',
                    fontWeight: location.pathname === '/profile' ? 700 : 500,
                  }}
                />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      <Box sx={{ flexGrow: 1, backgroundColor: colors.background }}>
        <Outlet />
      </Box>
    </Box>
  );
}

export default Layout;

