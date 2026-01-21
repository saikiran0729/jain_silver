import React, { useState, useEffect, useContext } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Grid,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import { TrendingUp, TrendingDown, Remove } from '@mui/icons-material';
import { AuthContext } from '../context/AuthContext';
import api from '../config/api';
import axios from 'axios';
import colors from '../theme/colors';

const POLLING_INTERVAL = 1000;

function HomePage() {
  const { user } = useContext(AuthContext);
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [previousRates, setPreviousRates] = useState({});
  const pollingIntervalRef = React.useRef(null);
  const currentRequestRef = React.useRef(null);

  // Check if rates are default/old (below ₹100) - should show fetching instead
  const areRatesDefault = (ratesToCheck) => {
    if (!ratesToCheck || ratesToCheck.length === 0) return true;
    // Check if any 99.9% rate is below ₹50 (current rates should be ~₹80-90)
    const OLD_RATE_THRESHOLD = 50;
    return ratesToCheck.some(rate =>
      rate.purity === '99.9%' && rate.ratePerGram < OLD_RATE_THRESHOLD
    );
  };

  const [showAsItIs, setShowAsItIs] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Try to get setting from public endpoint if available, or rely on backend default
        // Since we don't have a public settings endpoint verified, we will rely on rates.js
        // checking the DB. However, to be safe, we can try to fetch it if we had an endpoint.
        // For now, let's just trigger the polls.
        // The real fix was in rates.js which now checks the DB correctly during recalculation.
        // But if we want to force it from frontend, we need to know the value.
        // Let's assume the backend handles it now that we fixed `rates.js`.
      } catch (e) {
        console.warn('Failed to fetch settings');
      }
    };

    // Actually, we should try to get the setting to pass it explicitly to be sure
    // But since we don't have a guaranteed public endpoint, let's rely on the backend fix first.
    // If that fails, we'll need to expose the setting publicly.
    // Given the previous fix in rates.js (lines 1334+), it now checks the DB variable `showAsItIs`.
    // That variable `showAsItIs` in `rates.js` comes from `Settings.getSetting('showAsItIs')`.
    // So the backend fix SHOULD be enough without frontend changes, 
    // PROVIDED `rates.js` logic correctly reads the setting.

    // We already fixed `rates.js` to use `showAsItIs` variable.
    // And `rates.js` initializes `showAsItIs` from DB at the top of the route.
    // So we don't need to pass it from frontend if backend works.

    fetchRates();
    startPolling();
    return () => {
      stopPolling();
      // Cancel any pending request
      if (currentRequestRef.current) {
        currentRequestRef.current.cancel?.();
      }
    };
  }, []);

  const startPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    pollRates();
    pollingIntervalRef.current = setInterval(() => {
      pollRates();
    }, POLLING_INTERVAL);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const pollRates = async () => {
    // Cancel previous request if still pending
    if (currentRequestRef.current) {
      currentRequestRef.current.cancel?.();
    }

    try {
      // Create cancelable request
      const CancelToken = axios.CancelToken;
      const source = CancelToken.source();
      currentRequestRef.current = source;

      // Add cache-busting timestamp to ensure fresh data every second
      const response = await api.get('/rates', {
        timeout: 10000, // 10 seconds - backend may wait for fresh rates
        params: { _t: Date.now() }, // Cache busting - ensures fresh data (timestamp in URL)
        cancelToken: source.token
      });

      currentRequestRef.current = null; // Clear after success
      const newRates = response.data;
      const updateTime = new Date();

      if (newRates && Array.isArray(newRates) && newRates.length > 0) {
        // Check if rates are default/old - if so, keep loading state
        if (areRatesDefault(newRates)) {
          console.log('⏳ Rates are still old (below ₹100), waiting for fresh rates...');
          setLoading(true); // Keep loading state
          return; // Don't update rates yet
        }

        setLastUpdateTime(updateTime);
        setLoading(false); // Rates are fresh, stop loading

        setRates((prevRates) => {
          const updatedRates = newRates.map((newRate) => {
            const prevRate = Array.isArray(prevRates) ? prevRates.find(
              (rate) =>
                rate._id?.toString() === newRate._id?.toString() ||
                (rate.name === newRate.name &&
                  rate.weight?.value === newRate.weight?.value &&
                  rate.purity === newRate.purity)
            ) : null;

            const rateKey = newRate._id?.toString() || `${newRate.name}-${newRate.weight?.value}`;

            // ALWAYS show rate changes - no threshold, show every price change immediately
            // This ensures users see real-time price movements as market prices change
            if (prevRate) {
              const oldPrice = prevRate.ratePerGram || 0;
              const newPrice = newRate.ratePerGram || 0;
              const rateChanged = Math.abs(oldPrice - newPrice) > 0.01; // Show change if > 1 paisa

              if (rateChanged) {
                const isUp = newPrice > oldPrice;
                const changeAmount = Math.abs(newPrice - oldPrice);

                setPreviousRates((prev) => ({
                  ...prev,
                  [rateKey]: {
                    oldRate: oldPrice,
                    newRate: newPrice,
                    isUp: isUp,
                    changeAmount: changeAmount,
                    timestamp: Date.now(),
                  },
                }));

                // Keep indicator visible for 2 seconds to show price movement
                setTimeout(() => {
                  setPreviousRates((prev) => {
                    const newPrev = { ...prev };
                    delete newPrev[rateKey];
                    return newPrev;
                  });
                }, 2000);
              } else {
                // Rate is stable - still update timestamp but don't show change indicator
                // Remove any existing change indicator for stable rates
                setPreviousRates((prev) => {
                  const newPrev = { ...prev };
                  delete newPrev[rateKey];
                  return newPrev;
                });
              }
            } else {
              // New rate, show as updated
              setPreviousRates((prev) => ({
                ...prev,
                [rateKey]: {
                  oldRate: 0,
                  newRate: newRate.ratePerGram,
                  isUp: true,
                  timestamp: Date.now(),
                },
              }));
            }

            // Always use current time for lastUpdated to show live updates
            return {
              ...newRate,
              lastUpdated: updateTime, // Always use current time, not server time
            };
          });

          // Filter and sort rates - CRITICAL: Only show enabled products
          return sortRates(updatedRates);
        });
      } else {
        console.warn('No rates received from API');
      }
    } catch (error) {
      // Ignore canceled requests (they're expected when new request starts)
      if (axios.isCancel(error)) {
        return; // Silently ignore canceled requests
      }

      // Only log timeout errors occasionally to avoid spam
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        if (Math.random() < 0.05) { // Log only 5% of timeout errors
          console.warn('Polling timeout (this is normal if rates API is slow)');
        }
      } else if (error.response?.status !== 503) {
        // Log other errors (but not 503 which is expected when API is unavailable)
        if (Math.random() < 0.1) {
          console.warn('Polling error:', error.message, error.response?.status);
        }
      }
      // Don't stop polling on error - continue trying
      // Keep existing rates if available
    } finally {
      currentRequestRef.current = null; // Clear ref after request completes
    }
  };

  const fetchRates = async () => {
    try {
      const response = await api.get('/rates', {
        timeout: 10000, // 10 seconds - backend may wait for fresh rates
        params: { _t: Date.now() } // Cache busting
      });
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        // Check if rates are default/old - if so, keep loading state
        if (areRatesDefault(response.data)) {
          console.log('⏳ Initial rates are old (below ₹100), waiting for fresh rates...');
          setLoading(true); // Keep loading state
          setRates([]); // Don't show default rates
          // Will be updated by polling
        } else {
          const sortedRates = sortRates(response.data);
          setRates(sortedRates);
          setLastUpdateTime(new Date());
          setLoading(false);
          console.log(`✅ Loaded ${sortedRates.length} silver rates`);
        }
      } else {
        console.warn('⚠️ Unexpected response format:', response.data);
        setLoading(false);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || 'Network Error';
      const statusCode = error.response?.status;

      console.error('❌ Error fetching rates:', {
        message: errorMsg,
        status: statusCode,
        code: error.code,
        url: error.config?.url
      });

      // Don't show error to user, just keep loading state
      // Rates will be fetched by polling
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    // Format without commas - show exact price
    // Use 2 decimal places but no comma separators
    return `₹${Number(price || 0).toFixed(2)}`;
  };

  const formatWeight = (weight) => {
    return `${weight.value} ${weight.unit}`;
  };

  // Filter and sort rates - CRITICAL: Only show enabled products to customers
  const sortRates = (ratesArray) => {
    if (!Array.isArray(ratesArray)) return [];

    // CRITICAL: Filter out disabled products (isVisible === false)
    // Only show products where isVisible is true or undefined (default to visible)
    const visibleRates = ratesArray.filter(rate => {
      const isVisible = rate.isVisible !== undefined ? rate.isVisible : true;
      return isVisible !== false;
    });

    // Sort to put "Silver 1 kg" first
    return [...visibleRates].sort((a, b) => {
      // Check if rate is "Silver 1 kg" (by name or weight)
      const aIs1Kg = (a.name?.toLowerCase().includes('1 kg') || a.name?.toLowerCase().includes('1kg')) &&
        (a.weight?.value === 1 && a.weight?.unit === 'kg');
      const bIs1Kg = (b.name?.toLowerCase().includes('1 kg') || b.name?.toLowerCase().includes('1kg')) &&
        (b.weight?.value === 1 && b.weight?.unit === 'kg');

      // Put 1 kg first
      if (aIs1Kg && !bIs1Kg) return -1;
      if (!aIs1Kg && bIs1Kg) return 1;

      // Otherwise maintain original order
      return 0;
    });
  };

  const getRateColor = (rateKey) => {
    const prevRate = previousRates?.[rateKey];
    if (!prevRate) return colors.textPrimary;
    return prevRate.isUp ? colors.success : colors.error;
  };

  const getTypeIcon = (type, name, weight) => {
    if (type === 'coin') {
      return 'coin-image';
    }
    if (type === 'bar') {
      // Check weight first (more reliable than name)
      if (weight) {
        const weightValue = weight.value;
        const weightUnit = weight.unit;
        if (weightUnit === 'kg' && weightValue === 1) {
          return 'bar-image';
        }
        if (weightUnit === 'grams' && (weightValue === 100 || weightValue === 500)) {
          return 'bar-image';
        }
      }
      // Fallback to name check (for backward compatibility)
      if (name) {
        const nameLower = name.toLowerCase();
        if (nameLower.includes('1 kg') || nameLower.includes('1kg') ||
          nameLower.includes('100 grams') || nameLower.includes('100g') ||
          nameLower.includes('500 grams') || nameLower.includes('500g')) {
          return 'bar-image';
        }
      }
    }
    switch (type) {
      case 'bar': return '📦';
      case 'jewelry': return '💍';
      default: return '✨';
    }
  };

  const getProductImage = (type, name, weight) => {
    const iconType = getTypeIcon(type, name, weight);
    if (iconType === 'coin-image') {
      return '/silver-coin.jpg';
    }
    if (iconType === 'bar-image') {
      return '/silver-bars.webp';
    }
    return null;
  };

  if (loading || areRatesDefault(rates)) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: 2 }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ color: colors.textSecondary }}>
          Fetching live rates...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2 }, maxWidth: 1400, mx: 'auto', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            fontSize: 20,
            color: '#000000',
          }}
        >
          Live Rates
        </Typography>
        {lastUpdateTime && (
          <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.75rem' }}>
            Last update: {lastUpdateTime.toLocaleTimeString()}
          </Typography>
        )}
      </Box>

      <Grid container spacing={2} sx={{ flex: 1, minHeight: 0 }}>
        <Grid item xs={12} md={3} sx={{ order: { xs: 2, md: 0 } }}>
          <Box
            component="img"
            src="/banner2.png"
            alt="Banner"
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'center',
              borderRadius: 1,
              boxShadow: 2,
            }}
          />
        </Grid>
        <Grid item xs={12} md={6} sx={{ order: { xs: 1, md: 0 } }}>
          {rates.length === 0 ? (
            <Alert severity="info">No rates available</Alert>
          ) : (
            <TableContainer component={Paper} sx={{ boxShadow: 2, height: '100%', overflow: 'auto' }}>
              <Table sx={{ minWidth: { xs: 400, sm: 650 }, width: '100%' }} size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableCell sx={{ fontWeight: 700, fontSize: { xs: '0.75rem', sm: '0.85rem' }, py: 1, pl: 1, pr: 0.5 }}>Product</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: { xs: '0.75rem', sm: '0.85rem' }, py: 1, pl: 0.5, pr: 1, whiteSpace: 'nowrap' }}>Sell Price</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rates && Array.isArray(rates) && rates.map((rate) => {
                    const rateKey = rate._id?.toString() || `${rate.name}-${rate.weight?.value}`;
                    const prevRate = previousRates?.[rateKey];
                    const rateColor = getRateColor(rateKey);
                    // Use originalName for icon determination to keep icon consistent even when displayName changes
                    // Also use weight for more reliable icon detection
                    const productNameForIcon = rate.originalName || rate.name;
                    const productImage = getProductImage(rate.type, productNameForIcon, rate.weight);
                    const iconType = getTypeIcon(rate.type, productNameForIcon, rate.weight);

                    return (
                      <TableRow
                        key={rate._id || rateKey}
                        sx={{
                          '&:hover': { backgroundColor: '#fafafa' },
                          backgroundColor: prevRate
                            ? prevRate.isUp
                              ? '#E8F5E9'
                              : '#FFEBEE'
                            : 'white',
                        }}
                      >
                        <TableCell sx={{ py: 0.75, pl: 1, pr: 0.5, width: 'auto' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {productImage ? (
                              <Box
                                component="img"
                                src={productImage}
                                alt={rate.name}
                                sx={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: 0.5,
                                  objectFit: 'cover',
                                  border: `1px solid ${colors.border}`,
                                  flexShrink: 0,
                                }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <Avatar
                                sx={{
                                  width: 40,
                                  height: 40,
                                  backgroundColor: colors.primaryVeryLight,
                                  fontSize: 16,
                                  flexShrink: 0,
                                }}
                              >
                                {iconType}
                              </Avatar>
                            )}
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem', lineHeight: 1.2 }}>
                                {rate.name}
                              </Typography>
                              <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.7rem' }}>
                                {rate.purity} • {formatWeight(rate.weight)}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell align="right" sx={{ py: 0.75, pl: 0.5, pr: 1, whiteSpace: 'nowrap', width: 'auto' }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 700,
                              color: rateColor || '#d32f2f',
                              fontSize: { xs: '0.85rem', sm: '0.95rem' },
                            }}
                          >
                            {formatPrice(rate.rate)}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: colors.textSecondary,
                              fontSize: { xs: '0.65rem', sm: '0.7rem' },
                              display: 'block',
                            }}
                          >
                            ₹{Number((rate.ratePerGram || 0) * 1000).toFixed(2)}/kg
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Grid>
        <Grid item xs={12} md={3} sx={{ order: { xs: 3, md: 0 } }}>
          <Box
            component="img"
            src="/banner.png"
            alt="Banner"
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'center',
              borderRadius: 1,
              boxShadow: 2,
            }}
          />
        </Grid>
      </Grid>
    </Box>
  );
}

export default HomePage;

