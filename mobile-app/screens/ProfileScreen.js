import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Image,
  Linking,
  Alert,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Card, Button, Divider, Chip } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import api from '../config/api';
import { AuthContext } from '../context/AuthContext';
import colors from '../theme/colors';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, logout } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [storeInfo, setStoreInfo] = useState(null);
  const [loading, setLoading] = useState(false); // Don't block UI initially
  const [refreshing, setRefreshing] = useState(false);
  const [rates, setRates] = useState([]);
  const [loadingRates, setLoadingRates] = useState(false);

  useEffect(() => {
    // Load all in parallel immediately - no delays
    Promise.all([
      fetchProfile(),
      fetchStoreInfo(),
      fetchRates()
    ]).catch(() => {
      // Errors handled individually in each function
    });
  }, []);

  const fetchProfile = async () => {
    try {
      // Use user data from context immediately, then update with fresh data
      const response = await api.get('/users/profile', {
        timeout: 8000 // Further reduced for faster response
      });
      setProfile(response.data);
    } catch (error) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.error('Error fetching profile:', error.message);
      }
      // Keep using user from context if profile fetch fails
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchStoreInfo = async () => {
    try {
      // Fetch in parallel - don't block UI
      const response = await api.get('/store/info', {
        timeout: 8000 // Further reduced for faster response
      });
      if (response.data) {
        setStoreInfo(response.data);
      }
    } catch (error) {
      // Silently fail - use default data
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('Error fetching store info:', error.message);
      }
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
          console.log(`✅ Loaded ${ratesToShow.slice(0, 3).length} rates for ProfileScreen`);
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
    fetchProfile();
    fetchStoreInfo();
    fetchRates();
  };

  const formatPrice = (price) => {
    return `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatWeight = (weight) => {
    return `${weight.value} ${weight.unit}`;
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            // Navigation will be handled by AuthContext
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you absolutely sure you want to permanently delete your account? This will erase your profile, all uploaded documents (Aadhar, PAN, selfie), and all access rights. This action CANNOT be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await api.delete('/users/profile');
              Alert.alert('Success', 'Your account has been permanently deleted.', [
                {
                  text: 'OK',
                  onPress: async () => {
                    await logout();
                  }
                }
              ]);
            } catch (error) {
              Alert.alert(
                'Error',
                error.response?.data?.message || 'Failed to delete account. Please try again later.'
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };


  const handlePhoneCall = (phoneNumber) => {
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`);
    }
  };

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
              style={styles.navButton}
              onPress={() => navigation.navigate('NewsTab')}
            >
              <Text style={styles.navButtonText}>News</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonActive]}
              onPress={() => navigation.navigate('ProfileTab')}
            >
              <Text style={styles.navButtonTextActive}>Profile</Text>
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
        {/* User Info Card */}
        <Card style={styles.card} elevation={2}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <Icon name="account-circle" size={32} color={colors.primary} />
              <Text variant="titleLarge" style={styles.cardTitle}>
                Personal Information
              </Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name:</Text>
              <Text style={styles.infoValue}>{profile?.name || user?.name || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>{profile?.email || user?.email || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone:</Text>
              <Text style={styles.infoValue}>{profile?.phone || user?.phone || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status:</Text>
              <Chip
                style={[
                  styles.statusChip,
                  profile?.status === 'approved'
                    ? styles.statusApproved
                    : profile?.status === 'rejected'
                      ? styles.statusRejected
                      : styles.statusPending,
                ]}
                textStyle={styles.statusText}
              >
                {profile?.status?.toUpperCase() || 'PENDING'}
              </Chip>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Account Type:</Text>
              <Chip
                style={[
                  styles.statusChip,
                  { backgroundColor: profile?.role === 'admin' ? colors.primary : colors.primaryVeryLight }
                ]}
                textStyle={[
                  styles.statusText,
                  { color: profile?.role === 'admin' ? 'white' : colors.textPrimary }
                ]}
              >
                {profile?.role === 'admin' ? 'ADMINISTRATOR' : 'CUSTOMER'}
              </Chip>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Verification:</Text>
              <Chip
                style={[
                  styles.statusChip,
                  profile?.isVerified
                    ? styles.statusApproved
                    : { backgroundColor: colors.warning + '20' }
                ]}
                textStyle={[
                  styles.statusText,
                  { color: profile?.isVerified ? colors.success : colors.warning }
                ]}
                icon={profile?.isVerified ? 'check-circle' : null}
              >
                {profile?.isVerified ? 'VERIFIED' : 'NOT VERIFIED'}
              </Chip>
            </View>
            {profile?.createdAt && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Member Since:</Text>
                <Text style={styles.infoValue}>
                  {new Date(profile.createdAt).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Text>
              </View>
            )}
            {profile?.approvedAt && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Account Approved:</Text>
                <Text style={styles.infoValue}>
                  {new Date(profile.approvedAt).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Text>
              </View>
            )}
            {profile?.updatedAt && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Last Updated:</Text>
                <Text style={styles.infoValue}>
                  {new Date(profile.updatedAt).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Documents:</Text>
              <View style={{ flexDirection: 'row', gap: 8, flex: 2, justifyContent: 'flex-end' }}>
                {profile?.documents?.aadhar?.front && profile?.documents?.aadhar?.back ? (
                  <Chip
                    style={[styles.statusChip, styles.statusApproved]}
                    textStyle={[styles.statusText, { color: colors.success }]}
                    icon="check-circle"
                  >
                    Aadhar
                  </Chip>
                ) : (
                  <Chip
                    style={[styles.statusChip, { backgroundColor: colors.primaryVeryLight }]}
                    textStyle={styles.statusText}
                  >
                    Aadhar
                  </Chip>
                )}
                {profile?.documents?.pan?.image ? (
                  <Chip
                    style={[styles.statusChip, styles.statusApproved]}
                    textStyle={[styles.statusText, { color: colors.success }]}
                    icon="check-circle"
                  >
                    PAN
                  </Chip>
                ) : (
                  <Chip
                    style={[styles.statusChip, { backgroundColor: colors.primaryVeryLight }]}
                    textStyle={styles.statusText}
                  >
                    PAN
                  </Chip>
                )}
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Bank Details Card */}
        {storeInfo?.bankDetails && (
          <Card style={styles.card} elevation={2}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <Icon name="bank" size={32} color={colors.primary} />
                <Text variant="titleLarge" style={styles.cardTitle}>
                  Bank Details
                </Text>
              </View>
              <Divider style={styles.divider} />
              {storeInfo.bankDetails.map((bank, index) => (
                <View key={index} style={styles.bankSection}>
                  {index > 0 && <Divider style={styles.bankDivider} />}
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Bank Name:</Text>
                    <Text style={styles.infoValue}>{bank.bankName || 'N/A'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Account Number:</Text>
                    <Text style={styles.infoValue}>{bank.accountNumber || 'N/A'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>IFSC Code:</Text>
                    <Text style={styles.infoValue}>{bank.ifscCode || 'N/A'}</Text>
                  </View>
                  {bank.accountHolderName && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Account Holder:</Text>
                      <Text style={styles.infoValue}>{bank.accountHolderName}</Text>
                    </View>
                  )}
                  {bank.branch && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Branch:</Text>
                      <Text style={styles.infoValue}>{bank.branch}</Text>
                    </View>
                  )}
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Store Contact Card */}
        {storeInfo && (
          <Card style={styles.card} elevation={2}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <Icon name="store" size={32} color={colors.primary} />
                <Text variant="titleLarge" style={styles.cardTitle}>
                  Store Contact
                </Text>
              </View>
              <Divider style={styles.divider} />
              {storeInfo.phoneNumber && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Store Phone:</Text>
                  <View style={styles.phoneRow}>
                    <Text style={styles.infoValue}>{storeInfo.phoneNumber}</Text>
                    <Button
                      mode="text"
                      compact
                      onPress={() => handlePhoneCall(storeInfo.phoneNumber)}
                      icon="phone"
                      textColor={colors.primary}
                    >
                      Call
                    </Button>
                  </View>
                </View>
              )}
            </Card.Content>
          </Card>
        )}

        {/* About Jain Silver Plaza Card */}
        <Card style={styles.card} elevation={2}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <Icon name="information" size={32} color={colors.primary} />
              <Text variant="titleLarge" style={styles.cardTitle}>
                About Jain Silver Plaza
              </Text>
            </View>
            <Divider style={styles.divider} />
            <Text style={styles.aboutDescription}>
              <Text style={{ fontWeight: '700' }}>Jain Silver Plaza</Text> is recognized as one of the <Text style={{ fontWeight: '700' }}>best silver shops in Vijayawada</Text>.
              We specialize in premium quality silver coins, bars, and exquisite jewelry with transparent pricing
              and excellent customer service.
            </Text>
            <View style={styles.ratingContainer}>
              <Icon name="star" size={20} color="#FFC107" />
              <Text style={styles.ratingText}>4.4</Text>
              <Text style={styles.ratingCount}>(84+ Customer Reviews)</Text>
            </View>
            <View style={styles.featuresContainer}>
              <View style={styles.featureItem}>
                <Icon name="check-circle" size={18} color={colors.success} />
                <Text style={styles.featureText}>Authentic Silver Products</Text>
              </View>
              <View style={styles.featureItem}>
                <Icon name="check-circle" size={18} color={colors.success} />
                <Text style={styles.featureText}>Live Market Rates</Text>
              </View>
              <View style={styles.featureItem}>
                <Icon name="check-circle" size={18} color={colors.success} />
                <Text style={styles.featureText}>Secure Transactions</Text>
              </View>
              <View style={styles.featureItem}>
                <Icon name="check-circle" size={18} color={colors.success} />
                <Text style={styles.featureText}>Expert Customer Service</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Logout Button */}
        <Button
          mode="contained"
          onPress={handleLogout}
          style={styles.logoutButton}
          buttonColor={colors.error}
          textColor={colors.white}
          icon="logout"
        >
          Logout
        </Button>

        {/* Delete Account Button */}
        <Button
          mode="outlined"
          onPress={handleDeleteAccount}
          style={styles.deleteAccountButton}
          textColor={colors.error}
          icon="account-remove"
        >
          Delete Account
        </Button>
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  logoTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    flex: 2,
    textAlign: 'right',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'flex-end',
  },
  statusChip: {
    alignSelf: 'flex-end',
  },
  statusApproved: {
    backgroundColor: colors.success + '20',
  },
  statusRejected: {
    backgroundColor: colors.error + '20',
  },
  statusPending: {
    backgroundColor: colors.warning + '20',
  },
  statusText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 11,
  },
  bankSection: {
    marginTop: 8,
  },
  bankDivider: {
    marginVertical: 16,
  },
  logoutButton: {
    marginTop: 20,
    paddingVertical: 8,
    borderRadius: 12,
  },
  deleteAccountButton: {
    marginTop: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderColor: colors.error,
    borderWidth: 1,
  },
  storeLocationContainer: {
    flexDirection: 'row',
    marginTop: 8,
    padding: 12,
    backgroundColor: colors.primaryVeryLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locationIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  storeLocationText: {
    flex: 1,
  },
  storeLocationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  storeLocationAddress: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  mapButton: {
    marginTop: 4,
    borderColor: colors.primary,
  },
  aboutDescription: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 22,
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

