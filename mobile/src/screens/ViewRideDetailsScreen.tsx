// mobile/src/screens/ViewRideDetailsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import {
  ArrowLeft,
  MapPin,
  Clock,
  DollarSign,
  User,
  Star,
  AlertCircle,
  RefreshCw,
} from 'lucide-react-native';
import { colors, radius, spacing, font, shadow } from '../theme/theme';
import Button from '../components/Button';
import { useToast } from '../components/Toast';
import apiClient from '../services/ApiClient';

type RootStackParamList = {
  DriverDashboard: undefined;
  ViewRideDetails: { requestId: string };
  DriverActiveRide: { requestId: string };
};

type RideRequestDetails = {
  id: string;
  riderName: string;
  riderRating: number;
  riderInitials: string;
  pickup: string;
  destination: string;
  pickupLat?: number;
  pickupLng?: number;
  destLat?: number;
  destLng?: number;
  fare: string;
  distance?: string;
  estimatedTime?: string;
  riderPhone?: string;
  notes?: string;
  riderProfileImage?: string;
};

export default function ViewRideDetailsScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ViewRideDetails'>>();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [details, setDetails] = useState<RideRequestDetails | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  // Load ride details
  const loadRideDetails = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    try {
      console.log('📡 Fetching ride details for requestId:', route.params.requestId);
      const response = await apiClient.get(`/driver/requests/${route.params.requestId}`);
      console.log('✓ Ride details loaded:', response.data);
      setDetails(response.data);
      setLoading(false);
    } catch (error: any) {
      console.error('❌ Error loading ride details:');
      console.error('  Status:', error?.response?.status);
      console.error('  Message:', error?.response?.data?.error || error?.message);
      console.error('  Full error:', error);
      
      showToast(
        error?.response?.data?.error || 'Failed to load ride details',
        'red'
      );
      setDetails(null);
      setLoading(false);
    } finally {
      if (isRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRideDetails();
  }, [route.params.requestId]);

  const handleAccept = async () => {
    if (accepting) return;

    setAccepting(true);
    try {
      await apiClient.post(`/driver/requests/${route.params.requestId}/accept`);
      showToast('Ride accepted! Starting navigation...', 'green');
      
      // Navigate to active ride with a small delay to show toast
      setTimeout(() => {
        navigation.replace('DriverActiveRide', { requestId: route.params.requestId });
      }, 500);
    } catch (error: any) {
      console.error('Error accepting ride:', error);
      const serverMessage = error?.response?.data?.error || error?.response?.data?.message;
      showToast(
        serverMessage || 'Failed to accept ride',
        'red'
      );
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (declining) return;

    setDeclining(true);
    try {
      await apiClient.post(`/driver/requests/${route.params.requestId}/decline`);
      showToast('Ride declined', 'blue');
      navigation.goBack();
    } catch (error: any) {
      console.error('Error declining ride:', error);
      const serverMessage = error?.response?.data?.error || error?.response?.data?.message;
      showToast(
        serverMessage || 'Failed to decline ride',
        'red'
      );
      setDeclining(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        <ActivityIndicator size="large" color={colors.green} />
        <Text style={styles.loadingText}>Loading ride details...</Text>
      </View>
    );
  }

  if (!details) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        <AlertCircle size={48} color={colors.gray400} strokeWidth={1.5} />
        <Text style={styles.errorTitle}>Ride Not Available</Text>
        <Text style={styles.errorSubtitle}>This ride request is no longer available.</Text>
        <Button
          label="Go Back"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadRideDetails(true)}
            tintColor={colors.green}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityLabel="Back to dashboard"
          >
            <ArrowLeft size={22} color={colors.gray800} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ride Request Details</Text>
          <TouchableOpacity
            onPress={() => loadRideDetails(true)}
            disabled={refreshing}
            accessibilityLabel="Refresh ride details"
          >
            <RefreshCw
              size={20}
              color={colors.gray600}
              strokeWidth={2}
            />
          </TouchableOpacity>
        </View>

        {/* Rider Information Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Rider Information</Text>
          <View style={styles.riderInfo}>
            <View style={styles.riderAvatar}>
              <Text style={styles.riderInitials}>{details.riderInitials}</Text>
            </View>
            <View style={styles.riderDetails}>
              <Text style={styles.riderName}>{details.riderName}</Text>
              <View style={styles.ratingRow}>
                <Star size={14} color={colors.orange} fill={colors.orange} />
                <Text style={styles.riderRating}>{details.riderRating.toFixed(1)} Rating</Text>
              </View>
              {details.riderPhone && (
                <Text style={styles.riderPhone}>{details.riderPhone}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Trip Details Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Trip Details</Text>

          {/* Pickup Location */}
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <MapPin size={18} color={colors.green} />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Pickup Location</Text>
              <Text style={styles.detailValue}>{details.pickup}</Text>
            </View>
          </View>

          {/* Destination */}
          <View style={[styles.detailRow, styles.detailRowBorder]}>
            <View style={styles.detailIcon}>
              <MapPin size={18} color={colors.red} />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Destination</Text>
              <Text style={styles.detailValue}>{details.destination}</Text>
            </View>
          </View>

          {/* Distance and Time (if available) */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {Boolean(details.distance) && (
              <View style={[styles.detailSmall]}>
                <MapPin size={14} color={colors.gray400} />
                <Text style={styles.detailSmallLabel}>Distance</Text>
                <Text style={styles.detailSmallValue}>{details.distance}</Text>
              </View>
            )}
            {Boolean(details.estimatedTime) && (
              <View style={[styles.detailSmall]}>
                <Clock size={14} color={colors.gray400} />
                <Text style={styles.detailSmallLabel}>Time</Text>
                <Text style={styles.detailSmallValue}>{details.estimatedTime}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Fare Card */}
        <View style={styles.card}>
          <View style={styles.fareHeader}>
            <DollarSign size={20} color={colors.green} />
            <Text style={styles.sectionTitle}>Fare Amount</Text>
          </View>
          <Text style={styles.fareAmount}>{details.fare}</Text>
        </View>

        {/* Notes (if available) */}
        {Boolean(details.notes) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Special Notes</Text>
            <Text style={styles.notesText}>{details.notes}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <Button
            label="Decline"
            onPress={handleDecline}
            loading={declining}
            disabled={declining || accepting}
            variant="secondary"
            style={styles.declineButton}
          />
          <Button
            label="Accept Ride"
            onPress={handleAccept}
            loading={accepting}
            disabled={accepting || declining}
            style={styles.acceptButton}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  loadingText: {
    fontFamily: font.medium,
    fontSize: 13,
    color: colors.gray500,
    marginTop: spacing.md,
  },
  errorTitle: {
    fontFamily: font.extrabold,
    fontSize: 18,
    fontWeight: '800',
    color: colors.gray900,
    marginTop: spacing.lg,
  },
  errorSubtitle: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.gray500,
    marginTop: spacing.sm,
    textAlign: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  headerTitle: {
    fontFamily: font.extrabold,
    fontSize: 16,
    fontWeight: '800',
    color: colors.gray900,
  },
  backButton: {
    padding: 8,
  },

  // Cards
  card: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.xl,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    ...shadow.sm,
  },
  sectionTitle: {
    fontFamily: font.semibold,
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.md,
  },

  // Rider Info
  riderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  riderAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderInitials: {
    fontFamily: font.bold,
    fontSize: 20,
    fontWeight: '700',
    color: colors.white,
  },
  riderDetails: {
    flex: 1,
  },
  riderName: {
    fontFamily: font.bold,
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray900,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  riderRating: {
    fontFamily: font.medium,
    fontSize: 12,
    fontWeight: '500',
    color: colors.orange,
  },
  riderPhone: {
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.gray500,
    marginTop: 2,
  },

  // Detail Rows
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  detailRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
  },
  detailIcon: {
    paddingTop: 2,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontFamily: font.medium,
    fontSize: 11,
    fontWeight: '500',
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  detailValue: {
    fontFamily: font.semibold,
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
    marginTop: 2,
  },

  // Detail Small
  detailSmall: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
  },
  detailSmallLabel: {
    fontFamily: font.medium,
    fontSize: 10,
    fontWeight: '500',
    color: colors.gray500,
    marginTop: 4,
  },
  detailSmallValue: {
    fontFamily: font.bold,
    fontSize: 13,
    fontWeight: '700',
    color: colors.gray900,
    marginTop: 2,
  },

  // Fare
  fareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  fareAmount: {
    fontFamily: font.extrabold,
    fontSize: 28,
    fontWeight: '800',
    color: colors.green,
  },

  // Notes
  notesText: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.gray600,
    lineHeight: 20,
  },

  // Actions
  actionsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    marginVertical: spacing.xl,
    marginBottom: spacing.xxxl,
  },
  declineButton: {
    flex: 1,
  },
  acceptButton: {
    flex: 1,
  },
});
