import React, { useState, useContext, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Animated,
  TouchableOpacity,
  Linking,
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextInput, Button, Text, Card } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import api from '../config/api';
import { AuthContext } from '../context/AuthContext';
import colors from '../theme/colors';
import { fadeIn, slideUp, scaleIn, shake, cardEntrance } from '../utils/animations';

export default function AuthScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usePhone, setUsePhone] = useState(false);
  const [adminPhone, setAdminPhone] = useState(null);

  // Animation values
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoTranslateY = useRef(new Animated.Value(-30)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(50)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const errorShake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate logo entrance
    Animated.parallel([
      fadeIn(logoOpacity, 600),
      slideUp(logoTranslateY, 30, 600),
    ]).start();

    // Animate card entrance with delay
    setTimeout(() => {
      cardEntrance(cardOpacity, cardTranslateY).start();
    }, 200);

    // Fetch store info to get admin contact number
    const fetchStoreInfo = async () => {
      try {
        const response = await api.get('/store/info');
        if (response.data && response.data.phoneNumber) {
          setAdminPhone(response.data.phoneNumber);
        }
      } catch (error) {
        console.warn('Could not fetch store info:', error);
        // Use default phone number
        setAdminPhone('+91 98480 34323');
      }
    };
    fetchStoreInfo();
  }, []);

  useEffect(() => {
    if (error) {
      shake(errorShake).start();
    }
  }, [error]);

  const handleSignIn = async () => {
    if ((!email && !phone) || !password) {
      setError('Please fill all fields');
      return;
    }

    // Button press animation
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setLoading(true);
    setError('');

    try {
      console.log('🔐 Attempting sign in...', { email: usePhone ? undefined : email, phone: usePhone ? phone : undefined });
      const response = await api.post('/auth/signin', {
        email: usePhone ? undefined : email.toLowerCase().trim(),
        phone: usePhone ? phone.trim() : undefined,
        password,
      });

      console.log('✅ Sign in response:', response.data);

      if (response.data.token && response.data.user) {
        await login(response.data.token, response.data.user);
        // Navigation will be handled by App.js based on auth state
      } else {
        setError('Invalid response from server');
      }
    } catch (err) {
      console.error('❌ Sign in error:', err);
      const errorMessage = err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.msg ||
        err.message ||
        'Sign in failed. Please check your connection and try again.';

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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.cardContainer,
            {
              opacity: cardOpacity,
              transform: [{ translateY: cardTranslateY }],
            },
          ]}
        >
          <Card style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <Animated.View
                style={[
                  styles.logoContainer,
                  {
                    opacity: logoOpacity,
                    transform: [{ translateY: logoTranslateY }],
                  },
                ]}
              >
                <Image
                  source={require('../assets/Gemini_Generated_Image_8ia19c8ia19c8ia1.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </Animated.View>
              <Text style={styles.subtitle}>
                Sign in to continue
              </Text>

              {error ? (
                <Animated.View
                  style={{
                    transform: [{ translateX: errorShake }],
                  }}
                >
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    {(error.includes('rejected') || error.includes('pending')) && adminPhone && (
                      <Button
                        mode="contained"
                        icon="phone"
                        onPress={() => Linking.openURL(`tel:${adminPhone}`)}
                        style={styles.callButton}
                        buttonColor={colors.primary}
                        textColor="white"
                        compact
                      >
                        Call Admin: {adminPhone}
                      </Button>
                    )}
                  </View>
                </Animated.View>
              ) : null}

              <Button
                mode="outlined"
                onPress={() => setUsePhone(!usePhone)}
                style={styles.toggleButton}
                labelStyle={{ color: colors.primary, fontSize: 14, fontWeight: '500' }}
              >
                {usePhone ? 'Use Email' : 'Use Phone'}
              </Button>

              {usePhone ? (
                <TextInput
                  label="Phone Number"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  mode="outlined"
                  style={styles.input}
                  left={<TextInput.Icon icon="phone" color={colors.textPrimary} />}
                  outlineColor={colors.divider}
                  activeOutlineColor={colors.primary}
                  contentStyle={{ fontSize: 15 }}
                />
              ) : (
                <TextInput
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  mode="outlined"
                  style={styles.input}
                  left={<TextInput.Icon icon="email" color={colors.textPrimary} />}
                  outlineColor={colors.divider}
                  activeOutlineColor={colors.primary}
                  contentStyle={{ fontSize: 15 }}
                />
              )}

              <TextInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                mode="outlined"
                style={styles.input}
                left={<TextInput.Icon icon="lock" color={colors.textPrimary} />}
                outlineColor={colors.divider}
                activeOutlineColor={colors.primary}
                contentStyle={{ fontSize: 15 }}
              />

              <Animated.View
                style={{
                  transform: [{ scale: buttonScale }],
                }}
              >
                <TouchableOpacity
                  onPress={handleSignIn}
                  disabled={loading}
                  activeOpacity={0.9}
                >
                  <Button
                    mode="contained"
                    onPress={handleSignIn}
                    loading={loading}
                    disabled={loading}
                    style={styles.button}
                    buttonColor={colors.primary}
                    textColor={colors.white}
                    labelStyle={{ fontSize: 16, fontWeight: '700', letterSpacing: 0.5 }}
                  >
                    Sign In
                  </Button>
                </TouchableOpacity>
              </Animated.View>

              <View style={styles.linksContainer}>
                <Button
                  mode="text"
                  onPress={() => navigation.navigate('ForgotPassword')}
                  style={styles.linkButton}
                  labelStyle={styles.linkText}
                  contentStyle={styles.linkContent}
                >
                  Forgot Password?
                </Button>

                <Button
                  mode="text"
                  onPress={() => navigation.navigate('Register')}
                  style={styles.linkButton}
                  labelStyle={styles.linkText}
                  contentStyle={styles.linkContent}
                >
                  New User? Register Here
                </Button>

                <Button
                  mode="text"
                  onPress={() => navigation.navigate('AdminLogin')}
                  style={styles.linkButton}
                  labelStyle={styles.linkText}
                  contentStyle={styles.linkContent}
                >
                  Admin Login
                </Button>
              </View>
            </Card.Content>
          </Card>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 400,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: '100%',
  },
  card: {
    width: '100%',
    elevation: 0,
    backgroundColor: colors.white,
    borderRadius: 24,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: colors.divider,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 32,
    paddingTop: 40,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 320,
    height: 320,
    borderRadius: 20,
    backgroundColor: 'transparent',
    padding: 0,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 36,
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  input: {
    marginBottom: 16,
    backgroundColor: colors.white,
  },
  button: {
    marginTop: 8,
    paddingVertical: 16,
    backgroundColor: colors.primary,
    borderRadius: 12,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    marginBottom: 20,
  },
  linksContainer: {
    marginTop: 20,
    alignItems: 'center',
    width: '100%',
  },
  linkButton: {
    marginTop: 0,
    marginBottom: 0,
    paddingVertical: 8,
    paddingHorizontal: 0,
    minHeight: 44,
    justifyContent: 'center',
    width: '100%',
  },
  linkContent: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
  },
  linkText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  toggleButton: {
    marginBottom: 20,
    borderColor: colors.primary,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: colors.white,
    shadowColor: 'transparent',
    elevation: 0,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 8,
  },
  callButton: {
    marginTop: 8,
    alignSelf: 'center',
  },
});

