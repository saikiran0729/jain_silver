import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Card, Button, Divider } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../config/api';
import colors from '../theme/colors';

const { width } = Dimensions.get('window');

export default function UserDocumentsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const { userId } = route.params || {};
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    fetchUserDetails();
  }, []);

  const fetchUserDetails = async () => {
    try {
      const response = await api.get(`/admin/user/${userId}`);
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching user details:', error);
      Alert.alert('Error', 'Failed to load user documents');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    Alert.alert(
      'Approve User',
      'Are you sure you want to approve this user?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Approve',
          onPress: async () => {
            setApproving(true);
            try {
              await api.put(`/admin/approve-user/${userId}`);
              Alert.alert('Success', 'User approved successfully', [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]);
            } catch (error) {
              Alert.alert('Error', 'Failed to approve user');
            } finally {
              setApproving(false);
            }
          },
        },
      ]
    );
  };

  const handleReject = () => {
    Alert.prompt(
      'Reject User',
      'Enter reason for rejection:',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reject',
          onPress: async (reason) => {
            setApproving(true);
            try {
              await api.put(`/admin/reject-user/${userId}`, { reason });
              Alert.alert('Success', 'User rejected', [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]);
            } catch (error) {
              Alert.alert('Error', 'Failed to reject user');
            } finally {
              setApproving(false);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const getDocumentUrl = (filename) => {
    if (!filename) return null;

    // If filename is already a full URL (CloudFront or S3), return it as is
    if (filename.startsWith('http://') || filename.startsWith('https://')) {
      return filename;
    }

    // If filename contains CloudFront domain, it's already a CloudFront URL
    if (filename.includes('cloudfront.net')) {
      return filename;
    }

    // Otherwise, construct CloudFront URL from S3 key
    // Documents are stored in S3 and served via CloudFront
    const cloudfrontUrl = 'https://dglrmjf688z0y.cloudfront.net';
    // Remove any leading slashes and construct full URL
    const cleanKey = filename.startsWith('/') ? filename.substring(1) : filename;
    return `${cloudfrontUrl}/${cleanKey}`;
  };

  const renderDocument = (title, filename, number = null) => {
    const url = getDocumentUrl(filename);

    if (!url) {
      return (
        <Card style={styles.documentCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.documentTitle}>
              {title}
            </Text>
            <Text variant="bodyMedium" style={styles.missingText}>
              Not uploaded
            </Text>
          </Card.Content>
        </Card>
      );
    }

    return (
      <Card style={styles.documentCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.documentTitle}>
            {title}
          </Text>
          {number && (
            <Text variant="bodySmall" style={styles.documentNumber}>
              Number: {number}
            </Text>
          )}
          <Image
            source={{ uri: url }}
            style={styles.documentImage}
            resizeMode="contain"
          />
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading documents...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>User not found</Text>
        <Button onPress={() => navigation.goBack()}>Go Back</Button>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Image
            source={require('../assets/fuck.jpg')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View style={styles.headerTextContainer}>
            <Text variant="headlineMedium" style={styles.headerTitle}>
              User Documents
            </Text>
          </View>
        </View>
        <Text variant="bodyMedium" style={styles.userName}>
          {user.name}
        </Text>
        <Text variant="bodySmall" style={styles.userEmail}>
          {user.email}
        </Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.infoCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Personal Information
            </Text>
            <View style={styles.infoRow}>
              <Text variant="bodySmall" style={styles.infoLabel}>Name:</Text>
              <Text variant="bodyMedium" style={styles.infoValue}>{user.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text variant="bodySmall" style={styles.infoLabel}>Email:</Text>
              <Text variant="bodyMedium" style={styles.infoValue}>{user.email}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text variant="bodySmall" style={styles.infoLabel}>Phone:</Text>
              <Text variant="bodyMedium" style={styles.infoValue}>{user.phone}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text variant="bodySmall" style={styles.infoLabel}>Role:</Text>
              <Text variant="bodyMedium" style={styles.infoValue}>
                {user.role === 'admin' ? 'Administrator' : 'User'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text variant="bodySmall" style={styles.infoLabel}>Status:</Text>
              <Text variant="bodyMedium" style={[styles.infoValue, {
                color: user.status === 'approved' ? colors.success :
                  user.status === 'rejected' ? colors.error : '#ff9800',
                fontWeight: '600'
              }]}>
                {user.status?.toUpperCase()}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text variant="bodySmall" style={styles.infoLabel}>Verified:</Text>
              <Text variant="bodyMedium" style={[styles.infoValue, {
                color: user.isVerified ? colors.success : '#ff9800',
                fontWeight: '600'
              }]}>
                {user.isVerified ? 'Yes' : 'No'}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {(user.createdAt || user.approvedAt || user.updatedAt) && (
          <Card style={styles.infoCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Account Details
              </Text>
              {user.createdAt && (
                <View style={styles.infoRow}>
                  <Text variant="bodySmall" style={styles.infoLabel}>Registered:</Text>
                  <Text variant="bodyMedium" style={styles.infoValue}>
                    {new Date(user.createdAt).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </Text>
                </View>
              )}
              {user.approvedAt && (
                <View style={styles.infoRow}>
                  <Text variant="bodySmall" style={styles.infoLabel}>Approved:</Text>
                  <Text variant="bodyMedium" style={styles.infoValue}>
                    {new Date(user.approvedAt).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </Text>
                </View>
              )}
              {user.updatedAt && (
                <View style={styles.infoRow}>
                  <Text variant="bodySmall" style={styles.infoLabel}>Last Updated:</Text>
                  <Text variant="bodyMedium" style={styles.infoValue}>
                    {new Date(user.updatedAt).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </Text>
                </View>
              )}
            </Card.Content>
          </Card>
        )}

        {(user.documents?.aadhar?.number || user.documents?.pan?.number) && (
          <Card style={styles.infoCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Document Numbers
              </Text>
              {user.documents?.aadhar?.number && (
                <View style={styles.infoRow}>
                  <Text variant="bodySmall" style={styles.infoLabel}>Aadhar:</Text>
                  <Text variant="bodyMedium" style={[styles.infoValue, styles.documentNumber]}>
                    {user.documents.aadhar.number}
                  </Text>
                </View>
              )}
              {user.documents?.pan?.number && (
                <View style={styles.infoRow}>
                  <Text variant="bodySmall" style={styles.infoLabel}>PAN:</Text>
                  <Text variant="bodyMedium" style={[styles.infoValue, styles.documentNumber]}>
                    {user.documents.pan.number}
                  </Text>
                </View>
              )}
            </Card.Content>
          </Card>
        )}

        <Divider style={styles.divider} />

        <Text variant="titleLarge" style={styles.sectionTitle}>
          Aadhar Card
        </Text>
        {renderDocument(
          'Aadhar Front',
          user.documents?.aadhar?.front,
          user.documents?.aadhar?.number
        )}
        {renderDocument('Aadhar Back', user.documents?.aadhar?.back)}

        <Divider style={styles.divider} />

        <Text variant="titleLarge" style={styles.sectionTitle}>
          PAN Card
        </Text>
        {renderDocument(
          'PAN Card',
          user.documents?.pan?.image,
          user.documents?.pan?.number
        )}

        <Divider style={styles.divider} />

        <Text variant="titleLarge" style={styles.sectionTitle}>
          Selfie
        </Text>
        {renderDocument('Selfie', user.documents?.selfie)}

        {user?.status === 'pending' && (
          <View style={styles.approvalActions}>
            <Button
              mode="contained"
              onPress={handleApprove}
              loading={approving}
              disabled={approving}
              style={[styles.actionButton, styles.approveButton]}
              icon="check-circle"
            >
              Approve User
            </Button>
            <Button
              mode="outlined"
              onPress={handleReject}
              disabled={approving}
              style={[styles.actionButton, styles.rejectButton]}
              icon="close-circle"
            >
              Reject User
            </Button>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <Button
            mode="outlined"
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            Back to Dashboard
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 24,
    paddingTop: 66,
    paddingBottom: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLogo: {
    width: 80,
    height: 80,
    marginRight: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontWeight: '800',
    fontSize: 22,
    marginBottom: 6,
    color: colors.white,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  userName: {
    color: colors.primaryVeryLight,
    marginBottom: 3,
    fontSize: 13,
    fontWeight: '500',
  },
  userEmail: {
    color: 'rgba(255, 255, 255, 0.8)',
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
  infoCard: {
    marginBottom: 18,
    elevation: 3,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  sectionTitle: {
    fontWeight: '700',
    fontSize: 20,
    marginTop: 20,
    marginBottom: 14,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  divider: {
    marginVertical: 20,
    backgroundColor: colors.divider,
    height: 1,
  },
  documentCard: {
    marginBottom: 18,
    elevation: 3,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  documentTitle: {
    fontWeight: '700',
    fontSize: 18,
    marginBottom: 10,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  documentNumber: {
    color: colors.textSecondary,
    marginBottom: 14,
    fontSize: 13,
    fontWeight: '500',
  },
  documentImage: {
    width: width - 80,
    height: (width - 80) * 1.4,
    backgroundColor: colors.primaryVeryLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  missingText: {
    color: colors.textHint,
    fontStyle: 'italic',
    fontSize: 14,
    fontWeight: '500',
  },
  approvalActions: {
    marginTop: 28,
    marginBottom: 20,
    gap: 14,
  },
  actionButton: {
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  approveButton: {
    backgroundColor: colors.success,
  },
  rejectButton: {
    borderColor: colors.error,
    borderWidth: 1.5,
    backgroundColor: '#FFEBEE',
  },
  buttonContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  backButton: {
    paddingVertical: 10,
    borderColor: colors.primary,
    borderWidth: 1.5,
    borderRadius: 12,
    backgroundColor: colors.primaryVeryLight,
  },
  loadingText: {
    marginTop: 16,
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  errorText: {
    color: colors.error,
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  infoLabel: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
    flex: 1,
  },
  infoValue: {
    color: colors.textPrimary,
    fontWeight: '500',
    fontSize: 14,
    flex: 2,
    textAlign: 'right',
  },
  documentNumber: {
    fontFamily: 'monospace',
    fontSize: 13,
  },
});

