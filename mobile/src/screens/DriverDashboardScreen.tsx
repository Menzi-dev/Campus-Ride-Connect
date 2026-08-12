// mobile/src/screens/DriverDashboardScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  User,
  Car,
  Star,
  Clock,
  LogOut,
  ChevronRight,
  AlertCircle,
  ShieldCheck,
  Hourglass,
  RefreshCw,
} from 'lucide-react-native';
import { colors, radius, spacing, font, shadow } from '../theme/theme';
import Button from '../components/Button';
import { useToast } from '../components/Toast';
import apiClient from '../services/ApiClient';

type RootStackParamList = {
  Login: undefined;
  DriverDashboard: undefined;
  ActiveTrip: { requestId: string } | undefined;
  TripHistory: undefined;
  DriverVerification: undefined;
  Profile: undefined;
};

type DriverStats = {
  todayRides: number;
  earnings: number;
  rating: number;
  totalRides: number;
  online: boolean;
  approved: boolean;
};

type RideRequest = {
  id: string;
  riderName: string;
  riderInitials: string;
  pickup: string;
  destination: string;
  fare: string;
  distance?: string;
  time?: string;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
};

export default function DriverDashboardScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingApproval, setCheckingApproval] = useState(false);
  const [stats, setStats] = useState<DriverStats>({
    todayRides: 0,
    earnings: 0,
    rating: 0,
    totalRides: 0,
    online: false,
    approved: false,
  });
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [driverName, setDriverName] = useState('Driver');
  const [online, setOnline] = useState(false);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [showApprovalMessage, setShowApprovalMessage] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const startPulseAnimation = () => {
    pulseLoopRef.current?.stop();
    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoopRef.current.start();
  };

  const stopPulseAnimation = () => {
    pulseLoopRef.current?.stop();
    pulseAnim.setValue(1);
  };

  // Load user data
  const loadUserData = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (!userStr) {
        console.log('No user data found');
        return null;
      }
      const user = JSON.parse(userStr);
      setUserEmail(user.email || '');
      if (user.fullName) {
        const names = user.fullName.split(' ');
        setDriverName(`${names[0]} ${names.length > 1 ? names[names.length - 1]?.[0] || '' : ''}.`);
      }
      return user;
    } catch (e) {
      console.error('Error loading user data:', e);
      return null;
    }
  };

  // Check if driver is approved
  const checkApprovalStatus = async (isRefresh = false) => {
    if (isRefresh) setCheckingApproval(true);

    try {
      const userStr = await AsyncStorage.getItem('user');
      if (!userStr) {
        console.log('No user data in checkApprovalStatus');
        setIsApproved(false);
        return;
      }

      const user = JSON.parse(userStr);
      console.log('Checking approval for user:', user.id);
      
      try {
        const response = await apiClient.get(`/users/${user.id}/status`);
        console.log('Approval response:', response.data);
        
        const approved = response.data?.approved === true;
        setIsApproved(approved);
        setLastChecked(new Date());

        if (approved) {
          stopPulseAnimation();
          await loadDashboardData();
          if (showApprovalMessage) {
            showToast('Your account has been approved! 🎉', 'green');
            setShowApprovalMessage(false);
          }
        } else {
          startPulseAnimation();
          setStats(prev => ({ ...prev, approved: false }));
        }
      } catch (err: any) {
        console.error('Approval check error:', err?.response?.status);
        
        // Handle 404 as pending
        if (err?.response?.status === 404) {
          console.log('User status not found - treating as pending');
          setIsApproved(false);
          startPulseAnimation();
          return;
        }
        
        // Handle auth errors as pending
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          console.log('Auth error - user not approved');
          setIsApproved(false);
          startPulseAnimation();
          return;
        }
        
        // Other errors - treat as pending
        console.log('Other error in approval check:', err?.message);
        setIsApproved(false);
        startPulseAnimation();
      }
    } catch (err) {
      console.error('Error in checkApprovalStatus:', err);
      setIsApproved(false);
    } finally {
      setCheckingApproval(false);
    }
  };

  // Load dashboard data from API
  const loadDashboardData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    try {
      console.log('Loading dashboard data...');
      
      // Get driver stats
      const statsResponse = await apiClient.get('/driver/stats');
      console.log('Stats loaded:', statsResponse.data);
      
      setStats(prev => ({
        ...prev,
        todayRides: statsResponse.data?.todayRides || 0,
        earnings: statsResponse.data?.earnings || 0,
        rating: statsResponse.data?.rating || 0,
        totalRides: statsResponse.data?.totalRides || 0,
        online: statsResponse.data?.online || false,
      }));
      setOnline(statsResponse.data?.online || false);

      // Get pending ride requests
      const requestsResponse = await apiClient.get('/driver/requests');
      setRequests(requestsResponse.data || []);
      console.log('Requests loaded:', requestsResponse.data?.length || 0);
    } catch (err: any) {
      console.error('Load dashboard error:', err);
      showToast('Failed to load dashboard data', 'red');
      // Clear data on error instead of falling back to mock
      setStats({
        todayRides: 0,
        earnings: 0,
        rating: 0,
        totalRides: 0,
        online: false,
        approved: true,
      });
      setRequests([]);
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  };

  // Main load function
  const loadDashboard = useCallback(async () => {
    console.log('Loading dashboard...');
    setLoading(true);
    
    // Load user data
    await loadUserData();
    
    // Check approval status
    await checkApprovalStatus(false);
    
    setHasLoaded(true);
    setLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    loadDashboard();
    
    return () => {
      stopPulseAnimation();
    };
  }, []);

  // Poll for approval when pending
  useEffect(() => {
    if (isApproved === false && hasLoaded) {
      const interval = setInterval(() => {
        console.log('Polling approval status...');
        checkApprovalStatus(true);
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [isApproved, hasLoaded]);

  // Poll for requests when approved
  useEffect(() => {
    if (isApproved === true && hasLoaded) {
      const interval = setInterval(() => {
        if (!refreshing) {
          loadDashboardData(true);
        }
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [isApproved, hasLoaded]);

  // Toggle online status
  const toggleOnline = async () => {
    if (!isApproved) {
      showToast('Your account is pending approval', 'blue');
      return;
    }

    if (togglingOnline) return;

    setTogglingOnline(true);
    const newStatus = !online;

    try {
      console.log('Toggling online to:', newStatus);
      
      const response = await apiClient.post('/driver/online', { online: newStatus });
      
      if (response.data?.success !== false) {
        setOnline(newStatus);
        setStats(prev => ({ ...prev, online: newStatus }));
        showToast(
          newStatus ? 'You are now online' : 'You are now offline',
          newStatus ? 'green' : 'blue'
        );
      } else {
        showToast(response.data?.message || 'Could not update status', 'red');
      }
    } catch (err: any) {
      console.error('Toggle online error:', err);
      showToast('Failed to update online status', 'red');
    } finally {
      setTogglingOnline(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      if (online) {
        await apiClient.post('/driver/online', { online: false });
      }
    } catch (e) {
      console.log('Error setting offline:', e);
    }
    await AsyncStorage.multiRemove(['authToken', 'user']);
    navigation.replace('Login');
    showToast('Logged out', 'blue');
  };

  // Handle ride request
  const handleRequestAction = async (requestId: string, action: 'accept' | 'decline') => {
    try {
      await apiClient.post(`/driver/requests/${requestId}/${action}`);
      setRequests(prev => prev.filter(r => r.id !== requestId));
      if (action === 'accept') {
        showToast('Ride accepted!', 'green');
        navigation.navigate('ActiveTrip', { requestId });
      } else {
        showToast('Ride declined', 'blue');
      }
    } catch (err: any) {
      console.error('Error handling request:', err);
      showToast(
        action === 'accept' 
          ? 'Failed to accept ride' 
          : 'Failed to decline ride',
        'red'
      );
    }
  };

  // Render loading
  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        <ActivityIndicator size="large" color={colors.green} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  // Show pending approval if not approved
  if (isApproved === false) {
    return (
      <View style={styles.pendingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
          refreshControl={
            <RefreshControl 
              refreshing={checkingApproval} 
              onRefresh={() => checkApprovalStatus(true)} 
              tintColor={colors.green} 
            />
          }
        >
          <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
            <Text style={styles.welcomeText}>Welcome, {driverName}</Text>
            <TouchableOpacity onPress={handleLogout}>
              <LogOut size={20} color={colors.gray500} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <View style={styles.pendingCard}>
            <Animated.View style={[styles.pendingIconContainer, { transform: [{ scale: pulseAnim }] }]}>
              <Hourglass size={48} color={colors.orange} strokeWidth={1.5} />
            </Animated.View>
            
            <Text style={styles.pendingTitle}>Waiting for Approval</Text>
            <Text style={styles.pendingSubtitle}>
              Your driver account is pending review by an administrator.
            </Text>
            {userEmail && <Text style={styles.pendingEmail}>{userEmail}</Text>}

            <View style={styles.pendingInfoContainer}>
              <View style={styles.pendingInfoRow}>
                <ShieldCheck size={16} color={colors.green} strokeWidth={2} />
                <Text style={styles.pendingInfoText}>
                  This usually takes 24-48 hours
                </Text>
              </View>
              <View style={styles.pendingInfoRow}>
                <AlertCircle size={16} color={colors.orange} strokeWidth={2} />
                <Text style={styles.pendingInfoText}>
                  You'll be notified once approved
                </Text>
              </View>
            </View>

            <View style={styles.pendingActions}>
              <Button
                label="Check Status"
                onPress={() => checkApprovalStatus(true)}
                loading={checkingApproval}
                disabled={checkingApproval}
                icon={<RefreshCw size={16} color={colors.white} strokeWidth={2} />}
                style={styles.pendingButton}
              />
              <Text style={styles.pendingLastChecked}>
                Last checked: {lastChecked.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Show dashboard if approved
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadDashboardData(true)} tintColor={colors.green} />
        }
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <View>
            <Text style={styles.welcomeText}>Welcome, {driverName}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, online && styles.statusDotOnline]} />
              <Text style={styles.statusText}>{online ? 'You\'re online' : 'You\'re offline'}</Text>
              {online && <Text style={styles.statusSubtext}>• Receiving ride requests</Text>}
            </View>
          </View>
          <TouchableOpacity 
            onPress={toggleOnline} 
            style={[styles.onlineToggle, online && styles.onlineToggleActive]}
            disabled={togglingOnline}
          >
            {togglingOnline ? (
              <ActivityIndicator size="small" color={online ? colors.white : colors.gray600} />
            ) : (
              <Text style={[styles.onlineToggleText, online && styles.onlineToggleTextActive]}>
                {online ? 'ONLINE' : 'OFFLINE'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard 
            icon={<Car size={16} color={colors.gray400} strokeWidth={1.8} />}
            value={stats.todayRides}
            label="Today's Rides"
          />
          <StatCard 
            icon={<Clock size={16} color={colors.gray400} strokeWidth={1.8} />}
            value={`R ${stats.earnings.toFixed(2)}`}
            label="Earnings"
          />
          <StatCard 
            icon={<Star size={16} color={colors.gray400} strokeWidth={1.8} />}
            value={stats.rating.toFixed(1)}
            label="Rating"
            valueColor={colors.orange}
          />
          <StatCard 
            icon={<User size={16} color={colors.gray400} strokeWidth={1.8} />}
            value={stats.totalRides}
            label="Total Rides"
          />
        </View>

        {/* Incoming Requests */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Incoming Requests</Text>
          {requests.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{requests.length}</Text>
            </View>
          )}
        </View>

        {requests.length === 0 ? (
          <View style={styles.emptyState}>
            <AlertCircle size={22} color={colors.gray400} strokeWidth={1.8} />
            <Text style={styles.emptyStateText}>No incoming requests</Text>
            <Text style={styles.emptyStateSubtext}>Check back later for ride requests</Text>
          </View>
        ) : (
          requests.map((request) => (
            <RideRequestCard
              key={request.id}
              request={request}
              onAccept={() => handleRequestAction(request.id, 'accept')}
              onDecline={() => handleRequestAction(request.id, 'decline')}
            />
          ))
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.actionItem} 
            onPress={() => showToast('Trip History - Coming soon', 'blue')}
          >
            <Clock size={20} color={colors.gray600} strokeWidth={1.8} />
            <Text style={styles.actionText}>Trip History</Text>
            <ChevronRight size={16} color={colors.gray400} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionItem} 
            onPress={() => showToast('Profile & Verification - Coming soon', 'blue')}
          >
            <User size={20} color={colors.gray600} strokeWidth={1.8} />
            <Text style={styles.actionText}>Profile & Verification</Text>
            <ChevronRight size={16} color={colors.gray400} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={handleLogout}>
            <LogOut size={20} color={colors.red} strokeWidth={1.8} />
            <Text style={[styles.actionText, { color: colors.red }]}>Logout</Text>
            <ChevronRight size={16} color={colors.gray400} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// Stat Card Component
function StatCard({
  icon,
  value,
  label,
  valueColor,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.statCard}>
      {icon}
      <Text style={[styles.statValue, valueColor && { color: valueColor }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// Ride Request Card Component
function RideRequestCard({
  request,
  onAccept,
  onDecline,
}: {
  request: RideRequest;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.riderAvatar}>
          <Text style={styles.riderInitials}>{request.riderInitials}</Text>
        </View>
        <View style={styles.requestInfo}>
          <Text style={styles.riderName}>{request.riderName}</Text>
          <Text style={styles.requestRoute}>
            {request.pickup} → {request.destination}
          </Text>
        </View>
        <Text style={styles.requestFare}>{request.fare}</Text>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity style={styles.declineButton} onPress={onDecline}>
          <Text style={styles.declineText}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.acceptButton} onPress={onAccept}>
          <Text style={styles.acceptText}>View Request</Text>
          <ChevronRight size={14} color={colors.white} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxxl },
  loadingText: { fontFamily: font.medium, fontSize: 13, color: colors.gray500, marginTop: spacing.md },

  // Header Styles
  header: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.white,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    fontFamily: font.extrabold,
    fontSize: 20,
    fontWeight: '800',
    color: colors.gray900,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gray400,
    marginRight: 6,
  },
  statusDotOnline: {
    backgroundColor: colors.green,
  },
  statusText: {
    fontFamily: font.medium,
    fontSize: 12,
    fontWeight: '500',
    color: colors.gray500,
  },
  statusSubtext: {
    fontFamily: font.regular,
    fontSize: 11,
    color: colors.gray400,
    marginLeft: 4,
  },
  onlineToggle: {
    backgroundColor: colors.gray200,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    minWidth: 60,
    alignItems: 'center',
  },
  onlineToggleActive: {
    backgroundColor: colors.green,
  },
  onlineToggleText: {
    fontFamily: font.bold,
    fontSize: 10,
    fontWeight: '700',
    color: colors.gray600,
    letterSpacing: 0.5,
  },
  onlineToggleTextActive: {
    color: colors.white,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  statCard: {
    width: '47%',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.sm,
  },
  statValue: {
    fontFamily: font.extrabold,
    fontSize: 20,
    fontWeight: '800',
    color: colors.gray900,
    marginTop: 6,
  },
  statLabel: {
    fontFamily: font.semibold,
    fontSize: 10,
    fontWeight: '600',
    color: colors.gray400,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 1,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.xxl,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: font.extrabold,
    fontSize: 16,
    fontWeight: '800',
    color: colors.gray900,
  },
  badge: {
    backgroundColor: colors.blue,
    borderRadius: radius.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontFamily: font.bold,
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
  },

  // Empty State
  emptyState: {
    marginHorizontal: spacing.xxl,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: 4,
    ...shadow.sm,
  },
  emptyStateText: {
    fontFamily: font.semibold,
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray600,
    marginTop: 4,
  },
  emptyStateSubtext: {
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.gray400,
  },

  // Request Card
  requestCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    marginHorizontal: spacing.xxl,
    marginBottom: spacing.md,
    padding: spacing.lg,
    ...shadow.sm,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.md,
  },
  riderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderInitials: {
    fontFamily: font.bold,
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  requestInfo: {
    flex: 1,
  },
  riderName: {
    fontFamily: font.bold,
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray900,
  },
  requestRoute: {
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.gray500,
    marginTop: 2,
  },
  requestFare: {
    fontFamily: font.bold,
    fontSize: 16,
    fontWeight: '700',
    color: colors.green,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 10,
  },
  declineButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.red,
    alignItems: 'center',
  },
  declineText: {
    fontFamily: font.semibold,
    fontSize: 12,
    fontWeight: '600',
    color: colors.red,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.green,
  },
  acceptText: {
    fontFamily: font.semibold,
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },

  // Quick Actions
  quickActions: {
    marginHorizontal: spacing.xxl,
    marginTop: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.sm,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  actionText: {
    flex: 1,
    fontFamily: font.medium,
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray700,
  },

  // Pending Approval Styles
  pendingContainer: { flex: 1, backgroundColor: colors.white },
  pendingCard: {
    marginHorizontal: spacing.xxl,
    marginTop: spacing.xl,
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  pendingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(251, 146, 60, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  pendingTitle: {
    fontFamily: font.bold,
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: 4,
  },
  pendingSubtitle: {
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: 8,
  },
  pendingEmail: {
    fontFamily: font.medium,
    fontSize: 13,
    fontWeight: '500',
    color: colors.blue,
    marginBottom: spacing.md,
  },
  pendingInfoContainer: {
    width: '100%',
    gap: 8,
    marginBottom: spacing.lg,
  },
  pendingInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
  },
  pendingInfoText: {
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.gray600,
  },
  pendingActions: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.md,
  },
  pendingButton: {
    width: '100%',
  },
  pendingLastChecked: {
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.gray400,
  },
});