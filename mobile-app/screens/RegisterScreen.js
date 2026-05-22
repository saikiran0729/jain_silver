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
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../config/api';
import colors from '../theme/colors';

export default function RegisterScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [formData, setFormData] = useState({
    surname: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    aadharNumber: '',
    panNumber: '',
  });
  const [documents, setDocuments] = useState({
    aadharFront: null,
    aadharBack: null,
    panImage: null,
    selfie: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pickImage = async (type) => {
    try {
      // Show action sheet to choose between camera and gallery
      Alert.alert(
        'Select Image',
        'Choose an option',
        [
          {
            text: 'Camera',
            onPress: async () => {
              try {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') {
                  Alert.alert('Permission Required', 'Camera permission is required to take a photo. Please enable it in your device settings.');
                  return;
                }

                console.log('📷 Launching camera...');
                const cameraOptions = {
                  allowsEditing: true,
                  aspect: [4, 3],
                  quality: 0.8,
                };

                // Use MediaTypeOptions if available, otherwise omit (defaults to Images)
                if (ImagePicker.MediaTypeOptions) {
                  cameraOptions.mediaTypes = ImagePicker.MediaTypeOptions.Images;
                } else if (ImagePicker.MediaType) {
                  cameraOptions.mediaTypes = ImagePicker.MediaType.Images;
                }

                const result = await ImagePicker.launchCameraAsync(cameraOptions);

                console.log('📷 Camera result:', JSON.stringify(result, null, 2));

                if (result.canceled) {
                  console.log('❌ User canceled camera');
                  return;
                }

                if (!result.assets || result.assets.length === 0) {
                  console.error('❌ No assets in camera result');
                  Alert.alert('Error', 'No image was captured. Please try again.');
                  return;
                }

                const asset = result.assets[0];
                if (!asset.uri) {
                  console.error('❌ No URI in asset:', asset);
                  Alert.alert('Error', 'Image capture failed. Please try again.');
                  return;
                }

                setDocuments({ ...documents, [type]: asset });
                console.log('✅ Image captured from camera:', asset.uri);
              } catch (error) {
                console.error('❌ Error capturing image from camera:', error);
                console.error('Error details:', {
                  message: error.message,
                  code: error.code,
                  stack: error.stack
                });
                Alert.alert('Error', `Failed to capture image: ${error.message || 'Unknown error'}`);
              }
            },
          },
          {
            text: 'Gallery',
            onPress: async () => {
              try {
                // Request media library permissions only on iOS
                if (Platform.OS === 'ios') {
                  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (status !== 'granted') {
                    Alert.alert('Permission Required', 'Media library permission is required to select photos. Please enable it in your device settings.');
                    return;
                  }
                }

                console.log('🖼️ Launching image library...');
                const libraryOptions = {
                  allowsEditing: true,
                  aspect: [4, 3],
                  quality: 0.8,
                };

                // Use MediaTypeOptions if available, otherwise omit (defaults to Images)
                if (ImagePicker.MediaTypeOptions) {
                  libraryOptions.mediaTypes = ImagePicker.MediaTypeOptions.Images;
                } else if (ImagePicker.MediaType) {
                  libraryOptions.mediaTypes = ImagePicker.MediaType.Images;
                }

                const result = await ImagePicker.launchImageLibraryAsync(libraryOptions);

                console.log('🖼️ Gallery result:', JSON.stringify(result, null, 2));

                if (result.canceled) {
                  console.log('❌ User canceled gallery selection');
                  return;
                }

                if (!result.assets || result.assets.length === 0) {
                  console.error('❌ No assets in gallery result');
                  Alert.alert('Error', 'No image was selected. Please try again.');
                  return;
                }

                const asset = result.assets[0];
                if (!asset.uri) {
                  console.error('❌ No URI in asset:', asset);
                  Alert.alert('Error', 'Image selection failed. Please try again.');
                  return;
                }

                setDocuments({ ...documents, [type]: asset });
                console.log('✅ Image selected from gallery:', asset.uri);
              } catch (error) {
                console.error('❌ Error selecting image from gallery:', error);
                console.error('Error details:', {
                  message: error.message,
                  code: error.code,
                  stack: error.stack
                });
                Alert.alert('Error', `Failed to select image: ${error.message || 'Unknown error'}`);
              }
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
        { cancelable: true }
      );
    } catch (error) {
      console.error('Error in pickImage:', error);
      Alert.alert('Error', `Failed to pick image: ${error.message || 'Unknown error'}`);
    }
  };

  const takeSelfie = async () => {
    try {
      // Show action sheet to choose between camera and gallery for selfie
      Alert.alert(
        'Take Selfie',
        'Choose an option',
        [
          {
            text: 'Camera',
            onPress: async () => {
              try {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') {
                  Alert.alert('Permission Required', 'Camera permission is required to take a selfie. Please enable it in your device settings.');
                  return;
                }

                console.log('📷 Launching camera for selfie...');
                const cameraOptions = {
                  allowsEditing: true,
                  aspect: [4, 3],
                  quality: 0.8,
                };

                // Use MediaTypeOptions if available, otherwise omit (defaults to Images)
                if (ImagePicker.MediaTypeOptions) {
                  cameraOptions.mediaTypes = ImagePicker.MediaTypeOptions.Images;
                } else if (ImagePicker.MediaType) {
                  cameraOptions.mediaTypes = ImagePicker.MediaType.Images;
                }

                const result = await ImagePicker.launchCameraAsync(cameraOptions);

                console.log('📷 Selfie camera result:', JSON.stringify(result, null, 2));

                if (result.canceled) {
                  console.log('❌ User canceled selfie camera');
                  return;
                }

                if (!result.assets || result.assets.length === 0) {
                  console.error('❌ No assets in selfie camera result');
                  Alert.alert('Error', 'No selfie was captured. Please try again.');
                  return;
                }

                const asset = result.assets[0];
                if (!asset.uri) {
                  console.error('❌ No URI in selfie asset:', asset);
                  Alert.alert('Error', 'Selfie capture failed. Please try again.');
                  return;
                }

                setDocuments((prevDocs) => ({ ...prevDocs, selfie: asset }));
                console.log('✅ Selfie captured from camera:', asset.uri);
              } catch (error) {
                console.error('❌ Error capturing selfie from camera:', error);
                console.error('Error details:', {
                  message: error.message,
                  code: error.code,
                  stack: error.stack
                });
                Alert.alert('Error', `Failed to capture selfie: ${error.message || 'Unknown error'}`);
              }
            },
          },
          {
            text: 'Gallery',
            onPress: async () => {
              try {
                // Request media library permissions only on iOS
                if (Platform.OS === 'ios') {
                  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (status !== 'granted') {
                    Alert.alert('Permission Required', 'Media library permission is required to select photos. Please enable it in your device settings.');
                    return;
                  }
                }

                console.log('🖼️ Launching image library for selfie...');
                const libraryOptions = {
                  allowsEditing: true,
                  aspect: [4, 3],
                  quality: 0.8,
                };

                // Use MediaTypeOptions if available, otherwise omit (defaults to Images)
                if (ImagePicker.MediaTypeOptions) {
                  libraryOptions.mediaTypes = ImagePicker.MediaTypeOptions.Images;
                } else if (ImagePicker.MediaType) {
                  libraryOptions.mediaTypes = ImagePicker.MediaType.Images;
                }

                const result = await ImagePicker.launchImageLibraryAsync(libraryOptions);

                console.log('🖼️ Selfie gallery result:', JSON.stringify(result, null, 2));

                if (result.canceled) {
                  console.log('❌ User canceled selfie gallery selection');
                  return;
                }

                if (!result.assets || result.assets.length === 0) {
                  console.error('❌ No assets in selfie gallery result');
                  Alert.alert('Error', 'No selfie was selected. Please try again.');
                  return;
                }

                const asset = result.assets[0];
                if (!asset.uri) {
                  console.error('❌ No URI in selfie asset:', asset);
                  Alert.alert('Error', 'Selfie selection failed. Please try again.');
                  return;
                }

                setDocuments((prevDocs) => ({ ...prevDocs, selfie: asset }));
                console.log('✅ Selfie selected from gallery:', asset.uri);
              } catch (error) {
                console.error('❌ Error selecting selfie from gallery:', error);
                console.error('Error details:', {
                  message: error.message,
                  code: error.code,
                  stack: error.stack
                });
                Alert.alert('Error', `Failed to select selfie: ${error.message || 'Unknown error'}`);
              }
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
        { cancelable: true }
      );
    } catch (error) {
      console.error('Error in takeSelfie:', error);
      Alert.alert('Error', `Failed to take selfie: ${error.message || 'Unknown error'}`);
    }
  };

  const handleRegister = async () => {
    // Validation
    if (!formData.surname || !formData.lastName || !formData.email || !formData.phone || !formData.password) {
      setError('Please fill all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!formData.aadharNumber || !formData.panNumber) {
      setError('Please provide Aadhar and PAN numbers');
      return;
    }

    if (!documents.aadharFront || !documents.aadharBack || !documents.panImage || !documents.selfie) {
      setError('Please upload all required documents including selfie');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create FormData
      const data = new FormData();

      // Append text fields
      data.append('surname', formData.surname.trim());
      data.append('lastName', formData.lastName.trim());
      data.append('name', (formData.surname.trim() + ' ' + formData.lastName.trim()).trim());
      data.append('email', formData.email.toLowerCase().trim());
      data.append('phone', formData.phone.trim());
      data.append('password', formData.password);
      data.append('aadharNumber', formData.aadharNumber.trim());
      data.append('panNumber', formData.panNumber.trim().toUpperCase());

      // Append image files - React Native FormData format
      // React Native FormData automatically handles file URIs
      const aadharFrontFile = {
        uri: documents.aadharFront.uri,
        type: documents.aadharFront.mimeType || 'image/jpeg',
        name: 'aadharFront.jpg',
      };

      const aadharBackFile = {
        uri: documents.aadharBack.uri,
        type: documents.aadharBack.mimeType || 'image/jpeg',
        name: 'aadharBack.jpg',
      };

      const panImageFile = {
        uri: documents.panImage.uri,
        type: documents.panImage.mimeType || 'image/jpeg',
        name: 'panImage.jpg',
      };

      // Validate selfie before creating file object
      if (!documents.selfie || !documents.selfie.uri) {
        throw new Error('Selfie is required but not found');
      }

      const selfieFile = {
        uri: documents.selfie.uri,
        type: documents.selfie.mimeType || 'image/jpeg',
        name: 'selfie.jpg',
      };

      console.log('📎 File URIs (first 50 chars):', {
        aadharFront: aadharFrontFile.uri.substring(0, 50) + '...',
        aadharBack: aadharBackFile.uri.substring(0, 50) + '...',
        panImage: panImageFile.uri.substring(0, 50) + '...',
        selfie: selfieFile.uri.substring(0, 50) + '...',
      });

      // Append all files to FormData
      data.append('aadharFront', aadharFrontFile);
      data.append('aadharBack', aadharBackFile);
      data.append('panImage', panImageFile);
      data.append('selfie', selfieFile);

      console.log('✅ All files appended to FormData, including selfie');

      console.log('📝 Registering user...', {
        email: formData.email.toLowerCase().trim(),
        phone: formData.phone.trim(),
        surname: formData.surname.trim(),
        lastName: formData.lastName.trim(),
        documents: {
          aadharFront: documents.aadharFront.uri ? '✓' : '✗',
          aadharBack: documents.aadharBack.uri ? '✓' : '✗',
          panImage: documents.panImage.uri ? '✓' : '✗',
          selfie: documents.selfie.uri ? '✓' : '✗'
        }
      });

      // Make API call - axios will automatically set Content-Type for FormData
      console.log('🌐 Making API request to:', api.defaults.baseURL + '/auth/register');
      console.log('📦 FormData size check:', {
        hasAadharFront: !!documents.aadharFront,
        hasAadharBack: !!documents.aadharBack,
        hasPanImage: !!documents.panImage,
        hasSelfie: !!documents.selfie,
        formDataKeys: Object.keys(data)
      });

      // Calculate approximate size for logging
      const estimatedSize = (documents.aadharFront?.fileSize || 0) +
        (documents.aadharBack?.fileSize || 0) +
        (documents.panImage?.fileSize || 0) +
        (documents.selfie?.fileSize || 0);
      console.log('📊 Estimated upload size:', `${(estimatedSize / 1024 / 1024).toFixed(2)}MB`);

      if (estimatedSize > 4 * 1024 * 1024) {
        console.warn('⚠️  Warning: Total file size may exceed Vercel limit (4.5MB)');
      }

      // Use native fetch API for FormData - works better with React Native
      console.log('📤 Using fetch API for file upload...');
      const uploadUrl = api.defaults.baseURL + '/auth/register';

      // Get token for authorization
      const token = await AsyncStorage.getItem('token');

      // Create headers
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      // Don't set Content-Type - fetch will set it automatically for FormData

      // Use fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout

      try {
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: headers,
          body: data,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        console.log('📥 Response status:', response.status);
        console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

        // Parse response
        const responseData = await response.json();

        // Check if response is ok
        if (!response.ok) {
          throw {
            response: {
              data: responseData,
              status: response.status,
              statusText: response.statusText,
            },
            message: responseData.message || 'Request failed',
            status: response.status,
          };
        }

        // Show success message - always show after successful registration
        const demoOTP = responseData.otp;
        const userId = responseData.userId || responseData.user?._id || responseData.user?.id;

        console.log('✅ Registration successful:', { userId, hasOTP: !!demoOTP });

        Alert.alert(
          'Registration Successful!',
          'You have been registered successfully. Your account is pending admin approval. You can sign in once your account is approved.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate back to login screen
                navigation.goBack();
              },
            },
          ]
        );

        // Return response data directly
        return { data: responseData, status: response.status };
      } catch (fetchError) {
        clearTimeout(timeoutId);

        if (fetchError.name === 'AbortError') {
          throw {
            code: 'ECONNABORTED',
            message: 'Request timeout',
            config: { url: uploadUrl, method: 'POST' },
          };
        }

        // Re-throw with axios-like format
        throw fetchError;
      }
    } catch (err) {
      console.error('❌ Registration error:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        code: err.code,
        config: err.config ? {
          url: err.config.url,
          method: err.config.method,
          baseURL: err.config.baseURL,
          timeout: err.config.timeout,
          headers: err.config.headers
        } : undefined
      });

      // Log network error details specifically
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        console.error('🌐 Network error details:', {
          code: err.code,
          message: err.message,
          config: err.config ? {
            url: err.config.url,
            baseURL: err.config.baseURL,
            method: err.config.method
          } : undefined
        });
      }

      let errorMessage = 'Registration failed. Please try again.';

      // Handle network errors specifically
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
        console.error('⚠️  Network error - possible causes:');
        console.error('   1. No internet connection');
        console.error('   2. Server is down or unreachable');
        console.error('   3. Request timeout (file too large?)');
        console.error('   4. Request size exceeds server limit (4.5MB)');
        console.error('   5. Files may be too large - try reducing image quality');
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMessage = 'Request timed out. The files might be too large. Please try with smaller images.';
      } else if (err.response?.data) {
        // Handle validation errors
        if (err.response.data.errors && Array.isArray(err.response.data.errors)) {
          const errorMessages = err.response.data.errors.map(e => {
            if (typeof e === 'string') return e;
            return e.msg || e.message || JSON.stringify(e);
          });
          errorMessage = errorMessages.join('\n');
        }
        // Handle single error message
        else if (err.response.data.message) {
          errorMessage = err.response.data.message;
        }
        // Handle error object
        else if (err.response.data.error) {
          errorMessage = typeof err.response.data.error === 'string'
            ? err.response.data.error
            : err.response.data.error.message || 'Server error occurred';
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      // Handle network/timeout errors
      else if (err.message || err.code) {
        console.error('Network error details:', {
          message: err.message,
          code: err.code,
          response: err.response?.status,
          config: {
            url: err.config?.url,
            baseURL: err.config?.baseURL,
            method: err.config?.method
          }
        });

        if (err.message.includes('timeout') || err.code === 'ECONNABORTED') {
          errorMessage = 'Request timed out. The server took too long to respond.';
        } else if (err.message.includes('Network Error') || err.code === 'ERR_NETWORK' || err.code === 'NETWORK_ERROR') {
          errorMessage = `Cannot connect to backend server.\n\nPlease check:\n1. Internet connection is active\n2. Backend is deployed on Vercel\n3. URL: https://jain-silver.vercel.app\n\nIf issue persists, check Vercel deployment status.`;
        } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
          errorMessage = `Connection refused. Backend server is not running.\n\nStart it with:\ncd backend\nnode server.js`;
        } else if (err.code === 'EAI_AGAIN') {
          errorMessage = 'DNS lookup failed. Check your network connection.';
        } else {
          errorMessage = `Error: ${err.message || err.code || 'Unknown error'}`;
        }
      }

      setError(errorMessage);
      Alert.alert('Registration Failed', errorMessage);
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
              Register
            </Text>
            <Text style={styles.subtitle}>
              Create your Jain Silver Plaza account
            </Text>

            <View style={styles.kycNotice}>
              <Text style={styles.kycNoticeText}>
                📋 <Text style={styles.kycBold}>KYC Required:</Text> Aadhar and PAN documents are mandatory for account verification and compliance purposes.
              </Text>
            </View>

            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}

            <TextInput
              label="Surname"
              value={formData.surname}
              onChangeText={(text) => setFormData({ ...formData, surname: text })}
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="account" color={colors.textPrimary} />}
              outlineColor={colors.divider}
              activeOutlineColor={colors.primary}
              contentStyle={{ fontSize: 15 }}
            />

            <TextInput
              label="Last Name"
              value={formData.lastName}
              onChangeText={(text) => setFormData({ ...formData, lastName: text })}
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="account" color={colors.textPrimary} />}
              outlineColor={colors.divider}
              activeOutlineColor={colors.primary}
              contentStyle={{ fontSize: 15 }}
            />

            <TextInput
              label="Email"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="email" color={colors.textPrimary} />}
              outlineColor={colors.divider}
              activeOutlineColor={colors.primary}
              contentStyle={{ fontSize: 15 }}
            />

            <TextInput
              label="Phone Number"
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              keyboardType="phone-pad"
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="phone" color={colors.textPrimary} />}
              outlineColor={colors.divider}
              activeOutlineColor={colors.primary}
              contentStyle={{ fontSize: 15 }}
            />

            <TextInput
              label="Password"
              value={formData.password}
              onChangeText={(text) => setFormData({ ...formData, password: text })}
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
              value={formData.confirmPassword}
              onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
              secureTextEntry
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="lock-check" color={colors.textPrimary} />}
              outlineColor={colors.divider}
              activeOutlineColor={colors.primary}
              contentStyle={{ fontSize: 15 }}
            />

            <Text style={styles.sectionLabel}>KYC Documents (Required)</Text>

            <TextInput
              label="Aadhar Number"
              value={formData.aadharNumber}
              onChangeText={(text) => setFormData({ ...formData, aadharNumber: text })}
              keyboardType="numeric"
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="card-account-details" color={colors.textPrimary} />}
              outlineColor={colors.divider}
              activeOutlineColor={colors.primary}
              contentStyle={{ fontSize: 15 }}
              placeholder="12-digit Aadhar number"
            />

            <Button
              mode="outlined"
              onPress={() => pickImage('aadharFront')}
              style={styles.docButton}
              labelStyle={{ color: documents.aadharFront ? colors.success : colors.primary, fontSize: 14, fontWeight: '500' }}
              icon={documents.aadharFront ? "check-circle" : "upload"}
            >
              {documents.aadharFront ? 'Aadhar Front ✓' : 'Upload Aadhar Front'}
            </Button>

            <Button
              mode="outlined"
              onPress={() => pickImage('aadharBack')}
              style={styles.docButton}
              labelStyle={{ color: documents.aadharBack ? colors.success : colors.primary, fontSize: 14, fontWeight: '500' }}
              icon={documents.aadharBack ? "check-circle" : "upload"}
            >
              {documents.aadharBack ? 'Aadhar Back ✓' : 'Upload Aadhar Back'}
            </Button>

            <TextInput
              label="PAN Number"
              value={formData.panNumber}
              onChangeText={(text) => setFormData({ ...formData, panNumber: text.toUpperCase() })}
              autoCapitalize="characters"
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="card-account-details" color={colors.textPrimary} />}
              outlineColor={colors.divider}
              activeOutlineColor={colors.primary}
              contentStyle={{ fontSize: 15 }}
              placeholder="10-character PAN (e.g., ABCDE1234F)"
            />

            <Button
              mode="outlined"
              onPress={() => pickImage('panImage')}
              style={styles.docButton}
              labelStyle={{ color: documents.panImage ? colors.success : colors.primary, fontSize: 14, fontWeight: '500' }}
              icon={documents.panImage ? "check-circle" : "upload"}
            >
              {documents.panImage ? 'PAN Image ✓' : 'Upload PAN Image'}
            </Button>

            <Button
              mode="outlined"
              onPress={takeSelfie}
              style={styles.docButton}
              labelStyle={{ color: documents.selfie ? colors.success : colors.primary, fontSize: 14, fontWeight: '500' }}
              icon={documents.selfie ? "check-circle" : "camera"}
            >
              {documents.selfie ? 'Selfie ✓' : 'Take Selfie'}
            </Button>

            <Button
              mode="contained"
              onPress={handleRegister}
              loading={loading}
              disabled={loading}
              style={styles.button}
              labelStyle={{ fontSize: 16, fontWeight: '600', letterSpacing: 0.3 }}
            >
              Register
            </Button>

            <Button
              mode="text"
              onPress={() => navigation.goBack()}
              style={styles.linkButton}
              labelStyle={{ color: colors.primary, fontSize: 15, fontWeight: '500', letterSpacing: 0.1 }}
            >
              Already have an account? Sign In
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
  cardContent: {
    padding: 32,
    paddingTop: 40,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
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
    fontSize: 32,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 32,
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  input: {
    marginBottom: 16,
    backgroundColor: colors.white,
  },
  docButton: {
    marginBottom: 16,
    borderColor: colors.primary,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: colors.white,
    shadowColor: 'transparent',
    elevation: 0,
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
  kycNotice: {
    backgroundColor: colors.primaryVeryLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    padding: 14,
    borderRadius: 8,
    marginBottom: 24,
    marginTop: 8,
  },
  kycNoticeText: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  kycBold: {
    fontWeight: '700',
    color: colors.primaryDark,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryDark,
    marginTop: 8,
    marginBottom: 12,
    letterSpacing: 0.3,
  },
});

