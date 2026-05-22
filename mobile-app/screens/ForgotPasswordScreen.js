import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextInput, Button, Text, Card } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import api from '../config/api';
import colors from '../theme/colors';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1); // 1: Enter email/phone, 2: Enter OTP, 3: Reset password
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [usePhone, setUsePhone] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetToken, setResetToken] = useState('');

  const handleRequestReset = async () => {
    if ((!email && !phone)) {
      setError('Please enter email or phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/forgot-password', {
        email: usePhone ? undefined : email,
        phone: usePhone ? phone : undefined,
      });

      const otpMessage = response.data.otp
        ? `OTP has been sent. Demo OTP: ${response.data.otp}`
        : response.data.message || 'OTP has been sent to your registered phone/email';

      Alert.alert(
        'OTP Sent',
        otpMessage,
        [{ text: 'OK', onPress: () => setStep(2) }]
      );
    } catch (err) {
      console.error('Forgot password error:', err);
      const errorMessage = err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Failed to send OTP. Please check your connection and try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/verify-reset-otp', {
        email: usePhone ? undefined : email,
        phone: usePhone ? phone : undefined,
        otp,
      });

      setResetToken(response.data.resetToken);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      setError('Please fill all fields');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/auth/reset-password', {
        resetToken,
        newPassword,
      });

      Alert.alert(
        'Success',
        'Password reset successfully. You can now login with your new password.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Auth'),
          },
        ]
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password. Please try again.');
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
        <Card style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../assets/fuck.jpg')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>
              Reset Password
            </Text>
            <Text style={styles.subtitle}>
              {step === 1 && 'Enter your email or phone to receive OTP'}
              {step === 2 && 'Enter the OTP sent to your phone/email'}
              {step === 3 && 'Enter your new password'}
            </Text>

            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}

            {step === 1 && (
              <>
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

                <Button
                  mode="contained"
                  onPress={handleRequestReset}
                  loading={loading}
                  disabled={loading}
                  style={styles.button}
                  labelStyle={{ fontSize: 16, fontWeight: '600', letterSpacing: 0.3 }}
                >
                  Send OTP
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <Text style={styles.demoOtpText}>
                  Demo OTP: Check console logs or the alert message
                </Text>
                <TextInput
                  label="OTP"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  mode="outlined"
                  style={styles.input}
                  maxLength={6}
                  left={<TextInput.Icon icon="key" color={colors.textPrimary} />}
                  outlineColor={colors.divider}
                  activeOutlineColor={colors.primary}
                  contentStyle={{ fontSize: 15 }}
                />

                <Button
                  mode="contained"
                  onPress={handleVerifyOTP}
                  loading={loading}
                  disabled={loading}
                  style={styles.button}
                  labelStyle={{ fontSize: 16, fontWeight: '600', letterSpacing: 0.3 }}
                >
                  Verify OTP
                </Button>

                <Button
                  mode="text"
                  onPress={handleRequestReset}
                  style={styles.linkButton}
                  labelStyle={{ color: colors.primary, fontSize: 15, fontWeight: '500', letterSpacing: 0.1 }}
                >
                  Resend OTP
                </Button>
              </>
            )}

            {step === 3 && (
              <>
                <TextInput
                  label="New Password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  mode="outlined"
                  style={styles.input}
                  left={<TextInput.Icon icon="lock" color={colors.textPrimary} />}
                  outlineColor={colors.divider}
                  activeOutlineColor={colors.primary}
                  contentStyle={{ fontSize: 15 }}
                />

                <TextInput
                  label="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  mode="outlined"
                  style={styles.input}
                  left={<TextInput.Icon icon="lock-check" color={colors.textPrimary} />}
                  outlineColor={colors.divider}
                  activeOutlineColor={colors.primary}
                  contentStyle={{ fontSize: 15 }}
                />

                <Button
                  mode="contained"
                  onPress={handleResetPassword}
                  loading={loading}
                  disabled={loading}
                  style={styles.button}
                  labelStyle={{ fontSize: 16, fontWeight: '600', letterSpacing: 0.3 }}
                >
                  Reset Password
                </Button>
              </>
            )}

            <Button
              mode="text"
              onPress={() => navigation.navigate('Auth')}
              style={styles.linkButton}
              labelStyle={{ color: colors.primary, fontSize: 15, fontWeight: '500', letterSpacing: 0.1 }}
            >
              Back to Login
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primaryVeryLight,
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
    maxWidth: 400,
    elevation: 0,
    backgroundColor: colors.white,
    borderRadius: 20,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 0,
    overflow: 'hidden',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 160,
    height: 160,
    borderRadius: 20,
    backgroundColor: 'transparent',
    padding: 0,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '700',
    fontSize: 32,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 36,
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  cardContent: {
    padding: 32,
    paddingTop: 40,
    paddingBottom: 40,
  },
  input: {
    marginBottom: 16,
    backgroundColor: colors.white,
  },
  button: {
    marginTop: 8,
    paddingVertical: 14,
    backgroundColor: colors.primary,
    borderRadius: 12,
    shadowColor: colors.shadowColored,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  linkButton: {
    marginTop: 16,
    paddingVertical: 6,
    minHeight: 40,
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
    marginBottom: 24,
    fontSize: 13,
    fontWeight: '500',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    lineHeight: 18,
  },
  demoOtpText: {
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 12,
    color: colors.textHint,
    fontStyle: 'italic',
    backgroundColor: colors.primaryVeryLight,
    padding: 8,
    borderRadius: 8,
  },
});

