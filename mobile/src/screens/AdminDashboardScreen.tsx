import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Users,
  Car,
  CalendarCheck,
  Hourglass,
  Siren,
  ShieldCheck,
  MapPinned,
  FileWarning,
  Settings as SettingsIcon,
  ArrowRight,
  X,
  TriangleAlert,
  RotateCcw,
} from 'lucide-react-native';
import Button from '../components/Button';
import { useToast } from '../components/Toast';
import { colors, radius, spacing, font, shadow } from '../theme/theme';
import apiClient from '../services/ApiClient';

type RootStackParamList = {
  AdminDashboard: undefined;
  Login: undefined;
};

type Stats = {
  totalUsers: number;
  totalDrivers: number;
  ridesToday: number;
  pendingApprovals: number;
  activeSOS: number;
  safetyScorePercent: number;
  universityName?: string;
};

type PendingApproval = {
  id: string;
  fullName: string;
  email: string;
  licenceNumber?: string;
  submittedAt: string; // ISO date
};

const PREVIEW_LIMIT = 3;

export default function AdminDashboardScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [stats, setStats] = useState<Stats | null>(null);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [usersList, setUsersList] = useState<Array<{id:any; fullName:string; email:string; role:string}>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setUnauthorized(false);

    try {
      // Backend contract:
      //   GET /admin/dashboard -> { stats: Stats, approvals: PendingApproval[] }
      const response = await apiClient.get('/admin/dashboard');
      setStats(response.data?.stats ?? null);
      setApprovals(response.data?.approvals ?? []);
      // Fetch users separately (admin-only endpoint)
      try {
        const usersResp = await apiClient.get('/users');
        setUsersList(Array.isArray(usersResp.data) ? usersResp.data : []);
      } catch (uErr) {
        // non-fatal: keep existing usersList
        console.warn('Failed to load users preview', uErr);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const message =
        status === 401 || status === 403
          ? 'Your session isn\u2019t authorized to view this. Please sign in again.'
          : err?.message === 'Network Error'
          ? 'Cannot reach the server. Check your connection.'
          : 'Could not load dashboard data.';

      if (status === 401 || status === 403) {
        await AsyncStorage.multiRemove(['authToken', 'user']);
        setUnauthorized(true);
      }
      setError(message);
      try {
        // capture any backend payload for diagnostics
        const details = err?.response?.data ? JSON.stringify(err.response.data) : err?.message || String(err);
        setErrorDetails(details);
      } catch (e) {
        setErrorDetails(String(err));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const runDiagnostics = async () => {
    try {
      const resp = await apiClient.get('/test/hello');
      const payload = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
      showToast(`Backend: ${payload}`, 'green');
    } catch (err: any) {
      const msg = err?.message || err?.response?.data || 'No response';
      showToast(`Diagnostic failed: ${msg}`, 'red');
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDecision = async (id: string, decision: 'approve' | 'reject') => {
    setActioningId(id);
    try {
      // Assumed contract — adjust to match your real backend:
      //   POST /admin/driver-approvals/:id/approve
      //   POST /admin/driver-approvals/:id/reject
      await apiClient.post(`/admin/driver-approvals/${id}/${decision}`);

      setApprovals((prev) => prev.filter((a) => a.id !== id));
      setStats((prev) =>
        prev ? { ...prev, pendingApprovals: Math.max(0, prev.pendingApprovals - 1) } : prev
      );
      showToast(
        decision === 'approve' ? 'Driver approved' : 'Application rejected',
        decision === 'approve' ? 'green' : 'red'
      );
    } catch (err: any) {
      const message =
        err?.response?.data?.error || `Could not ${decision} this application. Please try again.`;
      showToast(message, 'red');
    } finally {
      setActioningId(null);
    }
  };

  const handleComingSoon = (feature: string) => {
    showToast(`${feature} is coming soon`, 'blue');
  };

  const isNew = (submittedAt: string) => {
    const hours = (Date.now() - new Date(submittedAt).getTime()) / 36e5;
    return hours <= 48;
  };

  // ---- LOADING ----
  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        <ActivityIndicator size="large" color={colors.green} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  // ---- ERROR ----
  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        <TriangleAlert size={32} color={colors.red} strokeWidth={1.8} />
        <Text style={styles.errorTitle}>Couldn't load the dashboard</Text>
        <Text style={styles.errorSubtitle}>{error}</Text>
        <Button
          label={unauthorized ? 'Sign In Again' : 'Retry'}
          onPress={() => {
            if (unauthorized) {
              navigation.replace('Login');
            } else {
              loadData();
            }
          }}
          icon={<RotateCcw size={16} color={colors.white} strokeWidth={2} />}
          style={{ marginTop: spacing.lg, width: 160 }}
        />
        {errorDetails && (
          <Text style={{ marginTop: 10, fontSize: 12, color: colors.gray500, textAlign: 'center' }}>
            {errorDetails}
          </Text>
        )}
        <Button
          label="Run Diagnostics"
          onPress={runDiagnostics}
          variant="white"
          icon={<RotateCcw size={16} color={colors.gray800} strokeWidth={2} />}
          style={{ marginTop: spacing.md, width: 160 }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={colors.green} />
        }
      >
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <Text style={styles.headerSmall}>Admin Dashboard</Text>
          <Text style={styles.headerTitle}>{stats?.universityName || 'Your University'}</Text>
        </View>

        {/* STATS GRID */}
        <View style={styles.statsGrid}>
          <StatCard icon={<Users size={16} color={colors.gray400} strokeWidth={1.8} />} value={stats?.totalUsers ?? 0} label="Users" />
          <StatCard icon={<Car size={16} color={colors.gray400} strokeWidth={1.8} />} value={stats?.totalDrivers ?? 0} label="Drivers" />
          <StatCard icon={<CalendarCheck size={16} color={colors.gray400} strokeWidth={1.8} />} value={stats?.ridesToday ?? 0} label="Today" />
          <StatCard
            icon={<Hourglass size={16} color={colors.orange} strokeWidth={1.8} />}
            value={stats?.pendingApprovals ?? 0}
            label="Pending"
            valueColor={colors.orange}
          />
          <StatCard
            icon={<Siren size={16} color={colors.red} strokeWidth={1.8} />}
            value={stats?.activeSOS ?? 0}
            label="SOS"
            valueColor={colors.red}
          />
          <StatCard
            icon={<ShieldCheck size={16} color={colors.green} strokeWidth={1.8} />}
            value={`${stats?.safetyScorePercent ?? 0}%`}
            label="Safe"
          />
        </View>

        {/* PENDING APPROVALS */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Pending Driver Approvals</Text>
          {(stats?.pendingApprovals ?? 0) > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{stats?.pendingApprovals}</Text>
            </View>
          )}
        </View>

        {approvals.length === 0 ? (
          <View style={styles.emptyState}>
            <ShieldCheck size={22} color={colors.green} strokeWidth={1.8} />
            <Text style={styles.emptyStateText}>All caught up — no pending applications</Text>
          </View>
        ) : (
          <>
            {approvals.slice(0, PREVIEW_LIMIT).map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                isNew={isNew(approval.submittedAt)}
                busy={actioningId === approval.id}
                onApprove={() => handleDecision(approval.id, 'approve')}
                onReject={() => handleDecision(approval.id, 'reject')}
              />
            ))}
            {approvals.length > PREVIEW_LIMIT && (
              <TouchableOpacity
                style={styles.viewAllRow}
                onPress={() => handleComingSoon('Full approvals list')}
                activeOpacity={0.7}
              >
                <Text style={styles.viewAllText}>
                  View all {approvals.length} pending applications
                </Text>
                <ArrowRight size={14} color={colors.green} strokeWidth={2} />
              </TouchableOpacity>
            )}
          </>
        )}




        {/* NAV GRID */}
        <View style={styles.navGrid}>
          <NavCard
            icon={<Users size={22} color={colors.blue} strokeWidth={1.8} />}
            label="User Management"
            onPress={() => handleComingSoon('User Management')}
          />
          <NavCard
            icon={<MapPinned size={22} color={colors.green} strokeWidth={1.8} />}
            label="Ride Monitoring"
            onPress={() => handleComingSoon('Ride Monitoring')}
          />
          <NavCard
            icon={<FileWarning size={22} color={colors.red} strokeWidth={1.8} />}
            label="Incident Reports"
            onPress={() => handleComingSoon('Incident Reports')}
          />
          <NavCard
            icon={<SettingsIcon size={22} color={colors.gray500} strokeWidth={1.8} />}
            label="Settings"
            onPress={() => handleComingSoon('Settings')}
          />
        </View>
      </ScrollView>
    </View>
  );
}

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

function ApprovalCard({
  approval,
  isNew,
  busy,
  onApprove,
  onReject,
}: {
  approval: PendingApproval;
  isNew: boolean;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const initials = approval.fullName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View style={styles.approvalCard}>
      <View style={styles.approvalTopRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.approvalName}>{approval.fullName}</Text>
          <Text style={styles.approvalMeta} numberOfLines={1}>
            {approval.email}
            {approval.licenceNumber ? ` \u2022 ${approval.licenceNumber}` : ''}
          </Text>
        </View>
        {isNew && (
          <View
            style={{
              backgroundColor: '#FDE68A',
              borderRadius: 999,
              paddingHorizontal: spacing.sm,
              paddingVertical: 4,
              alignSelf: 'flex-start',
            }}
          >
            <Text
              style={{
                fontFamily: font.bold,
                fontSize: 11,
                fontWeight: '700',
                color: colors.gray900,
                letterSpacing: 0.4,
              }}
            >
              NEW
            </Text>
          </View>
        )}
      </View>

      <View style={styles.approvalButtonRow}>
        <Button
          label="Reject"
          onPress={onReject}
          variant="red"
          disabled={busy}
          icon={<X size={15} color={colors.red} strokeWidth={2.2} />}
          style={{ flex: 1 }}
        />
        <Button
          label="Approve"
          onPress={onApprove}
          loading={busy}
          disabled={busy}
          icon={<ShieldCheck size={15} color={colors.white} strokeWidth={2.2} />}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

function NavCard({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.navCard} onPress={onPress} activeOpacity={0.7}>
      {icon}
      <Text style={styles.navCardLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxxl },
  loadingText: { fontFamily: font.medium, fontSize: 13, color: colors.gray500, marginTop: spacing.md },
  errorTitle: { fontFamily: font.bold, fontSize: 16, fontWeight: '700', color: colors.gray900, marginTop: spacing.md },
  errorSubtitle: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: 4,
  },

  header: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.lg, backgroundColor: colors.white },
  headerSmall: { fontFamily: font.medium, fontSize: 13, color: colors.gray400, fontWeight: '500', marginBottom: 2 },
  headerTitle: { fontFamily: font.extrabold, fontSize: 22, color: colors.gray900, fontWeight: '800' },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  statCard: {
    width: '31%',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.sm,
  },
  statValue: { fontFamily: font.extrabold, fontSize: 20, fontWeight: '800', color: colors.gray900, marginTop: 6 },
  statLabel: {
    fontFamily: font.semibold,
    fontSize: 10,
    fontWeight: '600',
    color: colors.gray400,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 1,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.xxl,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  sectionTitle: { fontFamily: font.extrabold, fontSize: 16, fontWeight: '800', color: colors.gray900 },
  countBadge: {
    backgroundColor: colors.orange,
    borderRadius: radius.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: { fontFamily: font.bold, fontSize: 11, fontWeight: '700', color: colors.white },

  emptyState: {
    marginHorizontal: spacing.xxl,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: 8,
    ...shadow.sm,
  },
  emptyStateText: { fontFamily: font.medium, fontSize: 13, color: colors.gray500, fontWeight: '500' },

  approvalCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    marginHorizontal: spacing.xxl,
    marginBottom: spacing.md,
    padding: spacing.lg,
    ...shadow.sm,
  },
  approvalTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: font.bold, fontSize: 15, fontWeight: '700', color: colors.white },
  approvalName: { fontFamily: font.bold, fontSize: 15, fontWeight: '700', color: colors.gray900 },
  approvalMeta: { fontFamily: font.regular, fontSize: 12, color: colors.gray400, marginTop: 1 },
  approvalButtonRow: { flexDirection: 'row', gap: 10 },

  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  viewAllText: { fontFamily: font.semibold, fontSize: 13, fontWeight: '600', color: colors.green },

  navGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: spacing.xxl,
    marginTop: spacing.lg,
  },
  navCard: {
    width: '47%',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 8,
    ...shadow.sm,
  },
  navCardLabel: { fontFamily: font.bold, fontSize: 13.5, fontWeight: '700', color: colors.gray800 },
});