import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Image,
  Linking,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Card, Button, Divider, Chip } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import api from '../config/api';
import colors from '../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function NewsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [storeInfo, setStoreInfo] = useState(null);
  const [loading, setLoading] = useState(false); // Don't block UI
  const [refreshing, setRefreshing] = useState(false);
  const [newsPosts, setNewsPosts] = useState([]);
  const [loadingNews, setLoadingNews] = useState(false); // Don't block - show UI immediately
  const [rates, setRates] = useState([]);
  const [loadingRates, setLoadingRates] = useState(false);

  useEffect(() => {
    // Load all in parallel immediately - no delays
    Promise.all([
      fetchNews(),
      fetchStoreInfo(),
      fetchRates()
    ]).catch(() => {
      // Errors handled individually in each function
    });
  }, []);

  const fetchStoreInfo = async () => {
    try {
      // Fetch in parallel - don't block UI
      const response = await api.get('/store/info', {
        timeout: 8000, // Further reduced for faster response
        params: { _t: Date.now() } // Cache busting
      });
      if (response.data) {
        setStoreInfo(response.data);
      }
    } catch (error) {
      // Silently fail - use default data
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('Error fetching store info:', error.message);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const fetchNews = async () => {
    try {
      // Don't set loading - let UI show immediately
      const response = await api.get('/news', {
        timeout: 8000, // Further reduced for faster response
        params: { limit: 20, page: 1 }
      });
      if (response.data?.news) {
        setNewsPosts(response.data.news);
      }
    } catch (error) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.error('Error fetching news:', error.message);
      }
      setNewsPosts([]);
    }
  };

  const fetchRates = async () => {
    try {
      setLoadingRates(true);
      const response = await api.get('/rates', {
        timeout: 25000,
        params: { _t: Date.now() }
      });
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        // Filter out default rates if needed, but still show some rates
        const validRates = response.data.filter(rate => {
          // Show rates that are not default (₹169 per gram)
          return rate.ratePerGram && rate.ratePerGram >= 170;
        });

        // If we have valid rates, show first 3, otherwise show first 3 of all rates
        const ratesToShow = validRates.length > 0 ? validRates : response.data;
        setRates(ratesToShow.slice(0, 3));

        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log(`✅ Loaded ${ratesToShow.slice(0, 3).length} rates for NewsScreen`);
        }
      } else {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn('No rates data received');
        }
        setRates([]);
      }
    } catch (error) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('Error fetching rates:', error.message, error.response?.status);
      }
      setRates([]);
    } finally {
      setLoadingRates(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStoreInfo();
    fetchNews();
    fetchRates();
  };

  const formatPrice = (price) => {
    return `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatWeight = (weight) => {
    return `${weight.value} ${weight.unit}`;
  };

  const handleSocialMediaPress = (url) => {
    if (url) {
      Linking.openURL(url).catch((err) =>
        console.error('Error opening URL:', err)
      );
    }
  };

  const handlePhoneCall = (phoneNumber) => {
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`);
    }
  };

  const handleAddressPress = (address) => {
    if (address) {
      const encodedAddress = encodeURIComponent(address);
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`
      ).catch((err) => console.error('Error opening maps:', err));
    }
  };

  // Don't block UI - show content immediately even if store info is loading

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <Image
            source={require('../assets/Gemini_Generated_Image_8ia19c8ia19c8ia1.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View style={styles.navContainer}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigation.navigate('HomeTab')}
            >
              <Text style={styles.navButtonText}>Live Rates</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonActive]}
              onPress={() => navigation.navigate('NewsTab')}
            >
              <Text style={styles.navButtonTextActive}>News</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigation.navigate('ProfileTab')}
            >
              <Text style={styles.navButtonText}>Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Rates Display in Header */}
        {rates.length > 0 && (
          <View style={styles.headerRatesContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.headerRatesScroll}>
              {rates.slice(0, 3).map((rate, index) => (
                <TouchableOpacity
                  key={rate._id || index}
                  style={styles.headerRateItem}
                  onPress={() => navigation.navigate('HomeTab')}
                >
                  <Text style={styles.headerRateName} numberOfLines={1}>{rate.name}</Text>
                  <Text style={styles.headerRatePrice}>{formatPrice(rate.rate)}</Text>
                  <Text style={styles.headerRatePerGram}>₹{rate.ratePerGram?.toFixed(2)}/g</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        {loadingRates && rates.length === 0 && (
          <View style={styles.headerRatesContainer}>
            <Text style={styles.headerRatesLoading}>Loading rates...</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* News Posts Section */}
        <Card style={styles.card} elevation={2}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <Icon name="newspaper" size={32} color={colors.primary} />
              <Text variant="titleLarge" style={styles.cardTitle}>
                Latest News & Updates
              </Text>
            </View>
            <Divider style={styles.divider} />
            {newsPosts.length === 0 ? (
              <Text style={styles.emptyText}>Loading news posts...</Text>
            ) : (
              <View>
                {newsPosts.map((post) => (
                  <Card
                    key={post._id}
                    style={[styles.newsCard, { borderLeftWidth: 4, borderLeftColor: colors.primary }]}
                    elevation={1}
                  >
                    <Card.Content>
                      <View style={styles.newsHeader}>
                        <View style={{ flex: 1 }}>
                          <View style={styles.newsChips}>
                            {post.category && (
                              <Chip
                                textStyle={{ textTransform: 'capitalize', fontSize: 11 }}
                                style={styles.categoryChip}
                              >
                                {post.category}
                              </Chip>
                            )}
                            {post.published && (
                              <Chip
                                textStyle={{ fontSize: 11 }}
                                style={[styles.categoryChip, { backgroundColor: colors.success + '20' }]}
                              >
                                Published
                              </Chip>
                            )}
                          </View>
                          <Text variant="titleMedium" style={styles.newsTitle}>
                            {post.title}
                          </Text>
                          <Text style={styles.newsDate}>
                            {new Date(post.publishedAt || post.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </Text>
                        </View>
                      </View>
                      {post.image && (
                        <Image
                          source={{ uri: post.image }}
                          style={styles.newsImage}
                          resizeMode="cover"
                          onError={() => { }}
                        />
                      )}
                      <Text style={styles.newsContent}>
                        {post.content}
                      </Text>
                      {post.tags && post.tags.length > 0 && (
                        <View style={styles.tagsContainer}>
                          {post.tags.map((tag, idx) => (
                            <Chip
                              key={idx}
                              textStyle={{ fontSize: 11 }}
                              style={styles.tagChip}
                            >
                              {tag}
                            </Chip>
                          ))}
                        </View>
                      )}
                    </Card.Content>
                  </Card>
                ))}
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Welcome Card */}
        <Card style={styles.welcomeCard} elevation={3}>
          <Card.Content>
            <View style={styles.welcomeHeader}>
              <Icon name="hand-wave" size={40} color={colors.primary} />
              <Text variant="headlineSmall" style={styles.welcomeTitle}>
                Welcome to Jain Silver Plaza
              </Text>
            </View>
            <Text variant="bodyLarge" style={styles.welcomeText}>
              {storeInfo?.welcomeMessage ||
                'Your trusted partner for premium silver products. We offer the best quality silver coins, bars, and jewelry with transparent pricing and excellent customer service.'}
            </Text>
          </Card.Content>
        </Card>

        {/* About Us Card */}
        <Card style={styles.card} elevation={2}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <Icon name="information" size={32} color={colors.primary} />
              <Text variant="titleLarge" style={styles.cardTitle}>
                About Us
              </Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.aboutContent}>
              <Text style={styles.aboutTitle}>Jain Silver Plaza</Text>
              <Text style={styles.aboutSubtitle}>Silver Jewellery Manufacturers & Jewellery Showrooms</Text>
              <View style={styles.ratingContainer}>
                <Icon name="star" size={20} color="#FFC107" />
                <Text style={styles.ratingText}>4.4</Text>
                <Text style={styles.ratingCount}>(84 Ratings)</Text>
              </View>
              <Text style={styles.aboutDescription}>
                Jain Silver Plaza is recognized as one of the <Text style={{ fontWeight: '700' }}>best silver shops in Vijayawada</Text> and Andhra Pradesh.
                With years of experience in silver jewellery manufacturing and retail, we have built a reputation for
                excellence, authenticity, and customer satisfaction. Our commitment to quality and transparency has made
                us a trusted name in the silver industry.
              </Text>
              <Text style={styles.aboutDescription}>
                We specialize in premium quality silver coins, bars, and exquisite jewellery pieces. Located in the
                heart of Vijayawada, we have been serving customers with authentic silver products and transparent
                pricing for years. Our showroom offers a wide range of silver products including coins, bars, and
                custom jewellery designs.
              </Text>
              <Text style={styles.aboutDescription}>
                We maintain the highest standards of quality and provide excellent customer service to ensure your
                complete satisfaction. Every product is certified for purity and authenticity, giving you peace of
                mind with your investment.
              </Text>
              <Text style={[styles.aboutDescription, { fontWeight: '700', marginTop: 16, marginBottom: 8, fontSize: 16, color: colors.primaryDark }]}>
                Why Choose Jain Silver Plaza?
              </Text>
              <View style={styles.featuresContainer}>
                <View style={styles.featureItem}>
                  <Icon name="check-circle" size={20} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.featureText, { fontWeight: '600' }]}>Authentic Silver Products</Text>
                    <Text style={[styles.featureText, { fontSize: 12, color: colors.textSecondary, marginTop: 2 }]}>100% certified purity guaranteed</Text>
                  </View>
                </View>
                <View style={styles.featureItem}>
                  <Icon name="trending-up" size={20} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.featureText, { fontWeight: '600' }]}>Live Market Rates</Text>
                    <Text style={[styles.featureText, { fontSize: 12, color: colors.textSecondary, marginTop: 2 }]}>Real-time pricing updated every second</Text>
                  </View>
                </View>
                <View style={styles.featureItem}>
                  <Icon name="shield-check" size={20} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.featureText, { fontWeight: '600' }]}>Secure Transactions</Text>
                    <Text style={[styles.featureText, { fontSize: 12, color: colors.textSecondary, marginTop: 2 }]}>Safe and reliable payment options</Text>
                  </View>
                </View>
                <View style={styles.featureItem}>
                  <Icon name="trophy" size={20} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.featureText, { fontWeight: '600' }]}>Best Silver Shop</Text>
                    <Text style={[styles.featureText, { fontSize: 12, color: colors.textSecondary, marginTop: 2 }]}>Top-rated in Vijayawada</Text>
                  </View>
                </View>
                <View style={styles.featureItem}>
                  <Icon name="check-circle" size={20} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.featureText, { fontWeight: '600' }]}>Customer Satisfaction</Text>
                    <Text style={[styles.featureText, { fontSize: 12, color: colors.textSecondary, marginTop: 2 }]}>4.4⭐ rating with 84+ reviews</Text>
                  </View>
                </View>
              </View>

              <Text style={[styles.aboutDescription, { fontWeight: '700', marginTop: 20, marginBottom: 8, fontSize: 16, color: colors.primaryDark }]}>
                Our Services
              </Text>
              <View style={styles.servicesContainer}>
                <View style={styles.serviceCard}>
                  <Icon name="currency-usd" size={24} color={colors.primary} />
                  <Text style={styles.serviceTitle}>Silver Coins</Text>
                  <Text style={styles.serviceDescription}>
                    Premium quality silver coins in various weights (1g, 5g, 10g, 50g, 100g) with 99.9% purity.
                    Perfect for investment and gifting.
                  </Text>
                </View>
                <View style={styles.serviceCard}>
                  <Icon name="package-variant" size={24} color={colors.primary} />
                  <Text style={styles.serviceTitle}>Silver Bars</Text>
                  <Text style={styles.serviceDescription}>
                    High-purity silver bars (100g, 500g, 1kg) with 99.99% purity. Ideal for serious investors
                    looking for bulk silver purchases.
                  </Text>
                </View>
                <View style={styles.serviceCard}>
                  <Icon name="diamond-stone" size={24} color={colors.primary} />
                  <Text style={styles.serviceTitle}>Silver Jewelry</Text>
                  <Text style={styles.serviceDescription}>
                    Exquisite handcrafted silver jewelry in 92.5% and 99.9% purity. Custom designs available
                    to match your style and preferences.
                  </Text>
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Store Timings Card */}
        {storeInfo?.storeTimings && (
          <Card style={styles.card} elevation={2}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <Icon name="clock-outline" size={32} color={colors.primary} />
                <Text variant="titleLarge" style={styles.cardTitle}>
                  Store Timings
                </Text>
              </View>
              <Divider style={styles.divider} />
              {storeInfo.storeTimings.map((timing, index) => (
                <View key={index} style={styles.timingRow}>
                  <Text style={styles.timingDay}>{timing.day}:</Text>
                  <Text style={styles.timingHours}>
                    {timing.isClosed ? 'Closed' : `${timing.openTime} - ${timing.closeTime}`}
                  </Text>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Store Location Card */}
        <Card style={styles.card} elevation={2}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <Icon name="map-marker" size={32} color={colors.primary} />
              <Text variant="titleLarge" style={styles.cardTitle}>
                Store Location
              </Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.storeLocationContainer}>
              <Text style={styles.storeLocationTitle}>Jain Silver Plaza</Text>
              <Text style={styles.storeLocationAddress}>
                Governerpet, Vijayawada, Andhra Pradesh{'\n'}
                Gopala Reddy Road, Governerpet{'\n'}
                Vijayawada-520002, Andhra Pradesh
              </Text>
              <Text style={styles.storeLocationInfo}>
                Open until 9:00 PM • 4.4 ⭐ (84 Ratings)
              </Text>
              <Button
                mode="contained"
                onPress={() => {
                  Linking.openURL('https://www.google.com/maps/place/16%C2%B030\'41.3%22N+80%C2%B037\'33.3%22E/@16.511483,80.62592,17z/data=!3m1!4b1!4m4!3m3!8m2!3d16.511483!4d80.62592?entry=ttu&g_ep=EgoyMDI1MTEyMy4xIKXMDSoASAFQAw%3D%3D');
                }}
                style={styles.mapButton}
                buttonColor={colors.primary}
                textColor={colors.white}
                icon="map"
              >
                Open in Google Maps
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Social Media Card */}
        {(storeInfo?.instagram ||
          storeInfo?.facebook ||
          storeInfo?.youtube) && (
            <Card style={styles.card} elevation={2}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <Icon name="share-variant" size={32} color={colors.primary} />
                  <Text variant="titleLarge" style={styles.cardTitle}>
                    Follow Us
                  </Text>
                </View>
                <Divider style={styles.divider} />
                <View style={styles.socialContainer}>
                  {storeInfo.instagram && (
                    <TouchableOpacity
                      style={styles.socialButton}
                      onPress={() => handleSocialMediaPress(storeInfo.instagram)}
                    >
                      <Icon name="instagram" size={32} color="#E4405F" />
                      <Text style={styles.socialLabel}>Instagram</Text>
                    </TouchableOpacity>
                  )}
                  {storeInfo.facebook && (
                    <TouchableOpacity
                      style={styles.socialButton}
                      onPress={() => handleSocialMediaPress(storeInfo.facebook)}
                    >
                      <Icon name="facebook" size={32} color="#1877F2" />
                      <Text style={styles.socialLabel}>Facebook</Text>
                    </TouchableOpacity>
                  )}
                  {storeInfo.youtube && (
                    <TouchableOpacity
                      style={styles.socialButton}
                      onPress={() => handleSocialMediaPress(storeInfo.youtube)}
                    >
                      <Icon name="youtube" size={32} color="#FF0000" />
                      <Text style={styles.socialLabel}>YouTube</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card.Content>
            </Card>
          )}

        {/* Contact Card */}
        {storeInfo?.phoneNumber && (
          <Card style={styles.card} elevation={2}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <Icon name="phone" size={32} color={colors.primary} />
                <Text variant="titleLarge" style={styles.cardTitle}>
                  Contact Us
                </Text>
              </View>
              <Divider style={styles.divider} />
              <Text style={styles.contactDescription}>
                Visit our showroom or call us for the best silver rates in Vijayawada. Our expert team is ready
                to assist you with all your silver needs. We offer competitive pricing, authentic products, and
                excellent customer service.
              </Text>
              <View style={styles.contactRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.contactLabel, { fontSize: 12, color: colors.textSecondary, marginBottom: 4 }]}>Store Phone</Text>
                  <Text style={styles.contactText}>{storeInfo.phoneNumber}</Text>
                </View>
                <Button
                  mode="contained"
                  onPress={() => handlePhoneCall(storeInfo.phoneNumber)}
                  icon="phone"
                  buttonColor={colors.primary}
                  textColor={colors.white}
                  compact
                >
                  Call Now
                </Button>
              </View>
            </Card.Content>
          </Card>
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
    backgroundColor: colors.primaryDark, // Professional blue header
    padding: 20,
    paddingTop: 60,
    paddingBottom: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    width: '100%',
  },
  logoTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navContainer: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  navButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    minWidth: 60,
    alignItems: 'center',
  },
  navButtonActive: {
    borderBottomColor: colors.white,
  },
  navButtonText: {
    color: colors.primaryVeryLight,
    fontSize: 14,
    fontWeight: '500',
  },
  navButtonTextActive: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  headerLogo: {
    width: 60,
    height: 60,
    marginRight: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  titleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontWeight: '700',
    fontSize: 24,
    marginBottom: 2,
    color: colors.white,
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    color: colors.primaryVeryLight,
    fontSize: 12,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  welcomeCard: {
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: colors.primaryVeryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  welcomeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  welcomeTitle: {
    marginLeft: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  welcomeText: {
    color: colors.textPrimary,
    lineHeight: 24,
    fontSize: 15,
  },
  card: {
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: colors.white,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    marginLeft: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  divider: {
    marginBottom: 16,
    marginTop: 4,
  },
  timingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 4,
  },
  timingDay: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  timingHours: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
    flex: 1,
    textAlign: 'right',
  },
  addressText: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: 12,
  },
  mapButton: {
    marginTop: 8,
    borderColor: colors.primary,
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  socialButton: {
    alignItems: 'center',
    padding: 16,
    margin: 8,
    borderRadius: 12,
    backgroundColor: colors.primaryVeryLight,
    minWidth: 100,
  },
  socialLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contactText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  aboutContent: {
    marginTop: 8,
  },
  aboutTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  aboutSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.primaryVeryLight,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginLeft: 6,
    marginRight: 6,
  },
  ratingCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  aboutDescription: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: 12,
  },
  featuresContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureText: {
    fontSize: 14,
    color: colors.textPrimary,
    marginLeft: 10,
    fontWeight: '500',
  },
  storeLocationContainer: {
    marginTop: 8,
  },
  storeLocationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  storeLocationAddress: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 8,
  },
  storeLocationInfo: {
    fontSize: 13,
    color: colors.textHint,
    marginBottom: 16,
    fontWeight: '500',
  },
  servicesContainer: {
    marginTop: 12,
  },
  serviceCard: {
    backgroundColor: colors.primaryVeryLight,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 8,
    marginBottom: 6,
  },
  serviceDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  contactDescription: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: 16,
  },
  contactLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: 20,
  },
  newsCard: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  newsHeader: {
    marginBottom: 12,
  },
  newsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  categoryChip: {
    height: 24,
    backgroundColor: colors.primaryVeryLight,
  },
  newsTitle: {
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
    fontSize: 16,
  },
  newsDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  newsImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
  },
  newsContent: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tagChip: {
    height: 24,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRatesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerRatesScroll: {
    flexDirection: 'row',
  },
  headerRateItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    padding: 10,
    marginRight: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  headerRateName: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  headerRatePrice: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  headerRatePerGram: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
  },
  headerRatesLoading: {
    color: colors.white,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 8,
  },
});

