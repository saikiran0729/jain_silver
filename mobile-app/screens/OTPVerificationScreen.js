import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextInput, Button, Text, Card } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../config/api';
import colors from '../theme/colors';

export default function OTPVerificationScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const { userId, demoOTP } = route.params || {};
  const [otp, setOtp] = useState(demoOTP || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/verify-otp', {
        userId,
        otp,
      });

      if (response.data.message) {
        Alert.alert(
          'Success',
          'OTP verified successfully. Your account is pending admin approval.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Auth'),
            },
          ]
        );
      }
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!userId) {
      setError('User ID not found');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/resend-otp', { userId });
      const newOTP = response.data.otp;
      Alert.alert(
        'OTP Resent',
        `New Demo OTP: ${newOTP}\n\n(For testing purposes)`,
        [{ text: 'OK' }]
      );
      setOtp(newOTP || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.logoContainer}>
            <Image
              source={require('../assets/fuck.jpg')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text variant="headlineMedium" style={styles.title}>
            Verify OTP
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Enter the 6-digit OTP sent to your phone
          </Text>

          {demoOTP && (
            <Card style={styles.otpCard}>
              <Card.Content>
                <Text variant="titleSmall" style={styles.otpLabel}>
                  Demo OTP (for testing):
                </Text>
                <Text variant="headlineSmall" style={styles.otpValue}>
                  {demoOTP}
                </Text>
                <Text variant="bodySmall" style={styles.otpNote}>
                  This OTP is shown for demo purposes only
                </Text>
              </Card.Content>
            </Card>
          )}

          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          <TextInput
            label="OTP"
            value={otp}
            onChangeText={setOtp}
            keyboardType="numeric"
            maxLength={6}
            mode="outlined"
            style={styles.input}
          />

          <Button
            mode="contained"
            onPress={handleVerifyOTP}
            loading={loading}
            disabled={loading}
            style={styles.button}
          >
            Verify OTP
          </Button>

          <Button
            mode="text"
            onPress={handleResendOTP}
            disabled={loading}
            style={styles.linkButton}
          >
            Resend OTP
          </Button>
        </Card.Content>
      </Card>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  card: {
    elevation: 8,
    backgroundColor: colors.white,
    borderRadius: 24,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  logo: {
    width: 140,
    height: 140,
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
    marginBottom: 8,
    fontWeight: '700',
    fontSize: 26,
    color: colors.primaryDark,
    letterSpacing: 0.5,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 28,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    marginBottom: 18,
    backgroundColor: colors.white,
  },
  button: {
    marginTop: 12,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 14,
    shadowColor: colors.shadowColored,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  linkButton: {
    marginTop: 20,
    paddingVertical: 8,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  otpCard: {
    marginBottom: 20,
    backgroundColor: colors.primaryVeryLight,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 18,
    padding: 20,
    shadowColor: colors.shadowColored,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  otpLabel: {
    textAlign: 'center',
    marginBottom: 12,
    color: colors.primaryDark,
    fontWeight: '700',
    fontSize: 13,
  },
  otpValue: {
    textAlign: 'center',
    color: colors.primaryDark,
    fontWeight: '700',
    fontSize: 32,
    letterSpacing: 8,
    marginBottom: 8,
  },
  otpNote: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontStyle: 'italic',
    fontSize: 12,
  },
});

