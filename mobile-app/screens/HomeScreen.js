import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Image,
  Animated,
  Easing,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Card, Chip } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import api from '../config/api';
import { AuthContext } from '../context/AuthContext';
import colors from '../theme/colors';

// Using HTTP polling for rate updates (Socket.io doesn't work on Vercel serverless)
const POLLING_INTERVAL = 1000; // Poll every 1 second (1000ms)

export default function HomeScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useContext(AuthContext);
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [usdRate, setUsdRate] = useState(89.25); // Default USD-INR rate
  const [previousRates, setPreviousRates] = useState({});
  const [cardAnimations, setCardAnimations] = useState({});

  // Check if rates are default/old (₹169) - should show fetching instead
  const areRatesDefault = (ratesToCheck) => {
    if (!ratesToCheck || ratesToCheck.length === 0) return true;
    // Check if any 99.9% rate is the default ₹169 (or close to it)
    const OLD_RATE_THRESHOLD = 170;
    return ratesToCheck.some(rate =>
      rate.purity === '99.9%' && rate.ratePerGram < OLD_RATE_THRESHOLD
    );
  };

  const pollingIntervalRef = useRef(null);

  // Filter rates by visibility and sort to put "Silver 1 kg" first
  const filterAndSortRates = (ratesArray) => {
    if (!Array.isArray(ratesArray)) return [];

    // Filter out rates where isVisible is false
    // Default to true if isVisible is undefined (for backward compatibility)
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

  // Initialize card entrance animations when rates load (only once)
  useEffect(() => {
    if (rates.length > 0 && !loading && Object.keys(cardAnimations).length === 0) {
      const newAnimations = {};
      rates.forEach((rate, index) => {
        const rateKey = rate._id?.toString() || `${rate.name}-${rate.weight?.value}`;
        const opacity = new Animated.Value(0);
        const translateY = new Animated.Value(30);

        // Start animation
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 400,
            delay: index * 50,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 400,
            delay: index * 50,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();

        newAnimations[rateKey] = { opacity, translateY };
      });
      setCardAnimations(newAnimations);
    }
  }, [rates.length, loading]);

  useEffect(() => {
    fetchRates();
    startPolling();

    return () => {
      stopPolling();
    };
  }, []);

  const startPolling = () => {
    // Clear any existing polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Poll rates immediately, then every second
    pollRates();

    // Poll rates every second
    pollingIntervalRef.current = setInterval(() => {
      pollRates();
    }, POLLING_INTERVAL);

    console.log('✅ Started HTTP polling for rate updates (every 1 second)');
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('⏹️ Stopped HTTP polling');
    }
  };

  const pollRates = async () => {
    try {
      // Use timeout for rates endpoint with cache busting
      const response = await api.get('/rates', {
        timeout: 20000, // 20 seconds for polling (increased for reliability)
        params: { _t: Date.now() } // Cache busting to ensure fresh data
      });
      const newRates = response.data;
      const updateTime = new Date();

      if (newRates && newRates.length > 0) {
        // Filter by visibility first
        const visibleRates = filterAndSortRates(newRates);

        // Check if rates are default/old - if so, keep loading state
        if (areRatesDefault(visibleRates)) {
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.log('⏳ Rates are still default (₹169), waiting for fresh rates...');
          }
          // Don't set loading to true if we already have rates - just wait
          if (rates.length === 0) {
            setLoading(true);
          }
          return; // Don't update rates yet
        }

        setLastUpdateTime(updateTime);
        setLoading(false); // Rates are fresh, stop loading

        setRates((prevRates) => {
          // Compare and update rates (already filtered and sorted)
          const updatedRates = visibleRates.map((newRate) => {
            // Find matching rate in previous rates
            const prevRate = Array.isArray(prevRates) ? prevRates.find(rate =>
              rate._id?.toString() === newRate._id?.toString() ||
              (rate.name === newRate.name &&
                rate.weight?.value === newRate.weight?.value &&
                rate.purity === newRate.purity)
            ) : null;

            const rateKey = newRate._id?.toString() || `${newRate.name}-${newRate.weight?.value}`;

            if (prevRate) {
              // ALWAYS check if rate changed - no threshold, show every update
              const rateChanged = Math.abs(prevRate.ratePerGram - newRate.ratePerGram) > 0;

              if (rateChanged) {
                // Store previous rate for comparison (will trigger color change)
                setPreviousRates(prev => ({
                  ...prev,
                  [rateKey]: {
                    oldRate: prevRate.ratePerGram,
                    newRate: newRate.ratePerGram,
                    isUp: newRate.ratePerGram > prevRate.ratePerGram,
                    timestamp: Date.now()
                  }
                }));

                // Clear the previous rate after 1.5 seconds to reset to black
                setTimeout(() => {
                  setPreviousRates(prev => {
                    const newPrev = { ...prev };
                    delete newPrev[rateKey];
                    return newPrev;
                  });
                }, 1500); // Clear after 1.5 seconds to show color change

                console.log(`📡 Rate updated: ${newRate.name} - ₹${newRate.ratePerGram}/gram (${newRate.ratePerGram > prevRate.ratePerGram ? '↑ GREEN' : '↓ RED'})`);
              } else {
                // Rate is stable - remove change indicator
                setPreviousRates(prev => {
                  const newPrev = { ...prev };
                  delete newPrev[rateKey];
                  return newPrev;
                });
                setPreviousRates(prev => {
                  const newPrev = { ...prev };
                  delete newPrev[rateKey];
                  return newPrev;
                });
              }
            } else {
              // New rate - no previous comparison, show in black
              setPreviousRates(prev => {
                const newPrev = { ...prev };
                delete newPrev[rateKey];
                return newPrev;
              });
            }

            // Always use current time for lastUpdated to show live updates
            return {
              ...newRate,
              lastUpdated: updateTime // Always use current time, not server time
            };
          });

          // Filter by visibility and sort rates to put "Silver 1 kg" first
          return filterAndSortRates(updatedRates);
        });
      }
    } catch (error) {
      // Handle network errors gracefully
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        // Network error - will retry on next poll
        if (Math.random() < 0.1) { // Log 10% of network errors
          console.warn('⚠️ Network error (will retry):', error.message);
        }
      } else if (error.response?.status === 503) {
        // Service unavailable - RB Goldspot API might be down
        console.warn('⚠️ Rate service unavailable (will retry):', error.response?.data?.message);
      } else if (error.response?.status === 404) {
        // Endpoint not found
        console.error('❌ Rates endpoint not found (404) - check API URL');
      } else if (error.response?.status >= 500) {
        // Server error
        console.error('❌ Server error when fetching rates:', error.response?.status);
      } else {
        // Other errors - log occasionally
        if (Math.random() < 0.1) { // Log 10% of other errors
          console.warn('⚠️ Polling error (will retry):', {
            message: error.message,
            status: error.response?.status,
            code: error.code
          });
        }
      }
    }
  };

  const fetchRates = async () => {
    try {
      if (rates.length === 0) {
        setLoading(true);
      }
      // Use longer timeout for rates endpoint (can be slow on first call)
      const response = await api.get('/rates', {
        timeout: 25000, // 25 seconds for initial load (increased for reliability)
        params: { _t: Date.now() } // Cache busting
      });
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        // Check if rates are default/old - if so, keep loading state
        if (areRatesDefault(response.data)) {
          console.log('⏳ Initial rates are default (₹169), waiting for fresh rates...');
          setLoading(true); // Keep loading state
          setRates([]); // Don't show default rates
          // Will be updated by polling
        } else {
          const filteredAndSortedRates = filterAndSortRates(response.data);
          setRates(filteredAndSortedRates);
          setLoading(false);
          console.log(`✅ Loaded ${filteredAndSortedRates.length} visible silver rates (filtered from ${response.data.length} total)`);
        }
      } else {
        console.warn('⚠️ Unexpected response format:', response.data);
        setRates([]);
        setLoading(false);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || 'Network Error';
      const statusCode = error.response?.status;

      // Log error details for debugging
      console.error('❌ Error fetching rates:', {
        message: errorMsg,
        status: statusCode,
        code: error.code,
        url: error.config?.url
      });

      // If it's a network error or timeout, show user-friendly message
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
        console.warn('⚠️ Network issue - rates may be temporarily unavailable');
      } else if (statusCode === 404) {
        console.error('❌ Rates endpoint not found (404)');
      } else if (statusCode >= 500) {
        console.error('❌ Server error - backend may be down');
      }

      // Don't clear rates on error - keep showing last known rates for better UX
      // Only clear if we have no rates at all
      if (rates.length === 0) {
        console.warn('⚠️ No rates available - will retry on next poll');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRates();
  };


  const formatPrice = (price) => {
    return `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPriceUSD = (priceInr) => {
    const priceUsd = priceInr / usdRate;
    return `$${Number(priceUsd).toFixed(2)}`;
  };

  const formatWeight = (weight) => {
    return `${weight.value} ${weight.unit}`;
  };

  const getTypeIcon = (type, name, weight) => {
    // Use silver coin image for coin types
    if (type === 'coin') {
      return 'coin-image'; // Return 'coin-image' to indicate we should use the coin image
    }

    // Use silver bars image for specific bar types
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
          return 'bar-image'; // Return 'bar-image' to indicate we should use the bar image
        }
      }
    }

    // Use emojis for other types
    switch (type) {
      case 'bar': return '📦';
      case 'jewelry': return '💍';
      default: return '✨';
    }
  };

  // Fetch USD rate from backend (if available) or use default
  useEffect(() => {
    const fetchUsdRate = async () => {
      try {
        // Try to get USD rate from the rates endpoint or a separate endpoint
        // For now, using default rate from rbgoldspot (around 89.25)
        // You can update this to fetch from your backend if you add USD rate endpoint
        setUsdRate(89.25);
      } catch (error) {
        console.warn('Could not fetch USD rate, using default');
        setUsdRate(89.25);
      }
    };
    fetchUsdRate();
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Image
            source={require('../assets/Gemini_Generated_Image_8ia19c8ia19c8ia1.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View style={styles.navContainer}>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonActive]}
              onPress={() => navigation.navigate('HomeTab')}
            >
              <Text style={styles.navButtonTextActive}>Live Rates</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigation.navigate('NewsTab')}
            >
              <Text style={styles.navButtonText}>News</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigation.navigate('ProfileTab')}
            >
              <Text style={styles.navButtonText}>Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.titleSection}>
          <View style={styles.titleRow}>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              Live Silver Rates
            </Text>
            {lastUpdateTime && (
              <View style={styles.updateBadge}>
                <Text style={styles.updateBadgeText}>
                  {lastUpdateTime.toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </View>
            )}
          </View>
          {lastUpdateTime && (
            <Text style={styles.lastUpdateTime}>
              Last updated: {lastUpdateTime.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })}
            </Text>
          )}
        </View>

        {loading || areRatesDefault(rates) ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Fetching live rates...</Text>
          </View>
        ) : rates.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No rates available</Text>
          </View>
        ) : (
          <>
            {/* Banners Section */}
            <View style={styles.bannersContainer}>
              <View style={styles.bannerWrapper}>
                <Image
                  source={require('../assets/banner2.png')}
                  style={styles.bannerImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.bannerWrapper}>
                <Image
                  source={require('../assets/banner.png')}
                  style={styles.bannerImage}
                  resizeMode="contain"
                />
              </View>
            </View>

            <View style={styles.ratesContainer}>
              {rates && Array.isArray(rates) && rates.map((rate, index) => {
                const rateKey = rate._id?.toString() || `${rate.name}-${rate.weight?.value}`;
                const prevRate = previousRates?.[rateKey];

                // Determine rate change color: Green (up), Red (down), Black (no change)
                const getRateColor = () => {
                  if (!prevRate) return colors.primaryDark;
                  return prevRate.isUp ? colors.success : colors.error;
                };

                const rateColor = getRateColor();

                // Background color for rate change indication
                const cardStyle = prevRate ? {
                  backgroundColor: prevRate.isUp ? '#E8F5E9' : '#FFEBEE',
                  borderLeftColor: prevRate.isUp ? colors.success : colors.error,
                } : {};

                return (
                  <Card
                    key={rate._id || index}
                    style={[styles.rateCard, cardStyle]}
                    elevation={2}
                  >
                    <Card.Content style={styles.rateCardContent}>
                      <View style={styles.rateRow}>
                        <View style={styles.productSection}>
                          {/* Use originalName and weight for icon determination to keep icon consistent even when displayName changes */}
                          {(() => {
                            const productNameForIcon = rate.originalName || rate.name;
                            const iconType = getTypeIcon(rate.type, productNameForIcon, rate.weight);
                            if (iconType === 'coin-image') {
                              return (
                                <Image
                                  source={require('../assets/615UjZXVbnL._AC_UY1100_.jpg')}
                                  style={styles.productImage}
                                  resizeMode="cover"
                                />
                              );
                            } else if (iconType === 'bar-image') {
                              return (
                                <Image
                                  source={require('../assets/silver-bars-on-shiny-metallic-surface.webp')}
                                  style={styles.productImage}
                                  resizeMode="cover"
                                />
                              );
                            } else {
                              return (
                                <View style={styles.productImagePlaceholder}>
                                  <Text style={styles.productImageEmoji}>{iconType}</Text>
                                </View>
                              );
                            }
                          })()}
                          <View style={styles.productInfo}>
                            <Text style={styles.productName} numberOfLines={2}>
                              {rate.displayName || rate.name || 'Unknown'}
                            </Text>
                            <View style={styles.productMeta}>
                              <Chip
                                style={styles.purityChip}
                                textStyle={styles.purityChipText}
                              >
                                {rate.purity}
                              </Chip>
                              <Text style={styles.weightText}>
                                {formatWeight(rate.weight)}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.priceSection}>
                          <Text style={[styles.priceText, { color: rateColor }]}>
                            {rate.type === 'gold'
                              ? `₹${Number((rate.ratePerGram || 0) * 10).toFixed(2)}`
                              : `₹${Number((rate.ratePerGram || 0) * 1000).toFixed(2)}`
                            }
                            <Text style={styles.priceUnit}>
                              {rate.type === 'gold' ? '/10g' : '/kg'}
                            </Text>
                          </Text>
                          <Text style={styles.totalItemPrice}>
                            Total: {formatPrice(rate.rate)}
                          </Text>
                        </View>
                      </View>
                    </Card.Content>
                  </Card>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLogo: {
    width: 75,
    height: 75,
    marginRight: 12,
    borderRadius: 8,
  },
  navContainer: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'center',
    gap: 8,
  },
  navButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    borderRadius: 4,
  },
  navButtonActive: {
    borderBottomColor: colors.primary,
  },
  navButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  navButtonTextActive: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  titleSection: {
    marginBottom: 20,
  },
  bannersContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
    paddingHorizontal: 0,
  },
  bannerWrapper: {
    flex: 1,
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: '700',
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  updateBadge: {
    backgroundColor: colors.primaryVeryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  updateBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  lastUpdateTime: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  ratesContainer: {
    gap: 8,
  },
  rateCard: {
    marginBottom: 0,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  rateCardContent: {
    padding: 12,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 7,
    paddingRight: 0,
  },
  productImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 7,
  },
  productImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.primaryVeryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 7,
  },
  productImageEmoji: {
    fontSize: 24,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
    lineHeight: 18,
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    minHeight: 22, // Ensure enough space for chip
  },
  purityChip: {
    height: 24,
    paddingVertical: 0,
    paddingHorizontal: 8,
    backgroundColor: colors.primaryVeryLight,
    borderColor: colors.primary,
    borderWidth: 1,
    justifyContent: 'center',
  },
  purityChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryDark,
    lineHeight: 14,
    includeFontPadding: false,
  },
  weightText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  priceSection: {
    alignItems: 'flex-end',
    minWidth: 100,
    paddingLeft: 0,
  },
  priceText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primaryDark,
    marginBottom: 0,
    letterSpacing: -0.5,
  },
  priceUnit: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    marginLeft: 2,
  },
  totalItemPrice: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
});

