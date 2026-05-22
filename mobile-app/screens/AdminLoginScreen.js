import React, { useState, useCallback, useContext, memo } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextInput, Button, Text, Card } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import api from '../config/api';
import { AuthContext } from '../context/AuthContext';
import colors from '../theme/colors';

function AdminLoginScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAdminSignIn = useCallback(async () => {
    if (!email || !password) {
      setError('Please fill all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('🔐 Attempting admin sign in...', { email: email.toLowerCase().trim() });
      const response = await api.post('/auth/admin/signin', {
        email: email.toLowerCase().trim(),
        password,
      });

      console.log('✅ Admin sign in response:', response.data);

      if (response.data.token && response.data.user) {
        await login(response.data.token, response.data.user);
        // Navigation will be handled by App.js based on auth state
      } else {
        setError('Invalid response from server');
      }
    } catch (err) {
      console.error('❌ Admin sign in error:', err);
      const errorMessage = err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.msg ||
        err.message ||
        'Admin sign in failed. Please check your connection and try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [email, password, login]);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

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
            Admin Login
          </Text>
          <Text variant="bodySmall" style={styles.subtitle}>
            Jain Silver Plaza Admin Portal
          </Text>

          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          <TextInput
            label="Admin Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="email" />}
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="lock" />}
          />

          <Button
            mode="contained"
            onPress={handleAdminSignIn}
            loading={loading}
            disabled={loading}
            style={styles.button}
          >
            Sign In
          </Button>

          <Button
            mode="text"
            onPress={handleGoBack}
            style={styles.linkButton}
          >
            Back to User Login
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
    marginBottom: 32,
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
});

export default memo(AdminLoginScreen);

