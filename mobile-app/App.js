import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
// Removed bottom tab navigator import - using stack navigation only
import { Provider as PaperProvider, DefaultTheme } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import colors from './theme/colors';

import AuthScreen from './screens/AuthScreen';
import RegisterScreen from './screens/RegisterScreen';
import OTPVerificationScreen from './screens/OTPVerificationScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import NewsScreen from './screens/NewsScreen';
import AdminLoginScreen from './screens/AdminLoginScreen';
import AdminDashboardScreen from './screens/AdminDashboardScreen';
import UserDocumentsScreen from './screens/UserDocumentsScreen';
import SplashScreen from './screens/SplashScreen';
import { AuthContext, AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';

const Stack = createStackNavigator();

// Removed bottom tab navigator - using stack navigation with header navigation instead

function AppNavigator() {
  const { user, isAuthenticated, isLoading } = React.useContext(AuthContext);
  const [showSplash, setShowSplash] = React.useState(true);

  React.useEffect(() => {
    if (!isLoading) {
      // Show splash for minimum 2 seconds for branding
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (isLoading || showSplash) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor={colors.primaryDark} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Auth" component={AuthScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
          </>
        ) : user?.role === 'admin' ? (
          <>
            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
            <Stack.Screen name="UserDocuments" component={UserDocumentsScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="HomeTab" component={HomeScreen} />
            <Stack.Screen name="NewsTab" component={NewsScreen} />
            <Stack.Screen name="ProfileTab" component={ProfileScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Extend default theme with custom colors
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    accent: colors.accent,
    background: colors.background,
    surface: colors.surface,
    text: colors.textPrimary,
    onSurface: colors.textPrimary,
    onBackground: colors.textPrimary,
    disabled: colors.textHint,
    placeholder: colors.textHint,
    backdrop: colors.divider,
  },
};

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <AuthProvider>
            <AppNavigator />
          </AuthProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

