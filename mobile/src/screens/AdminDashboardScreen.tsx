// mobile/src/screens/AdminDashboardScreen.tsx
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
  Modal,
  Image,
  Linking,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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
  Check,
  Eye,
  Download,
  UserCheck,
  UserX,
  Clock,
  Mail,
  Phone,
  Hash,
  GraduationCap,
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
  userId: string;
  fullName: string;
  email: string;
  studentNumber?: string;
  phone?: string;
  yearOfStudy?: number;
  licencePlate?: string;
  vehicleMake?: string;
  vehicleYear?: string;
  selfieUrl?: string;
  licenceDocUrl?: string;
  proofDocUrl?: string;
  vehicleDocUrl?: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  role: string;
};

const PREVIEW_LIMIT = 5;

export default function AdminDashboardScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [stats, setStats] = useState<Stats | null>(null);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAllApprovals, setShowAllApprovals] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setUnauthorized(false);

    try {
      // Fetch dashboard stats
      const statsResponse = await apiClient.get('/admin/dashboard/stats');
      setStats(statsResponse.data ?? null);

      // Fetch pending driver approvals
      const approvalsResponse = await apiClient.get('/admin/driver-approvals/pending');
      setApprovals(approvalsResponse.data ?? []);
      
      console.log('Pending approvals loaded:', approvalsResponse.data?.length || 0);
    } catch (err: any) {
      console.error('Load data error:', err);
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        await AsyncStorage.multiRemove(['authToken', 'user']);
        setUnauthorized(true);
        showToast('Please sign in again', 'red');
      } else if (err?.message === 'Network Error') {
        setError('Cannot reach the server. Check your connection.');
      } else {
        setError(err?.response?.data?.error || 'Could not load dashboard data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Load data on focus
  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => {};
    }, [])
  );

  const handleDecision = async (id: string, decision: 'approve' | 'reject') => {
    setActioningId(id);
    try {
      const response = await apiClient.post(`/admin/driver-approvals/${id}/${decision}`);
      
      if (response.data?.success !== false) {
        // Remove the approval from the list
        setApprovals((prev) => prev.filter((a) => a.id !== id));
        setStats((prev) =>
          prev ? { ...prev, pendingApprovals: Math.max(0, prev.pendingApprovals - 1) } : prev
        );
        showToast(
          decision === 'approve' ? 'Driver approved successfully!' : 'Application rejected',
          decision === 'approve' ? 'green' : 'red'
        );
      } else {
        showToast(response.data?.message || `Could not ${decision} this application`, 'red');
      }
    } catch (err: any) {
      console.error('Decision error:', err);
      const message = err?.response?.data?.error || 
                     err?.response?.data?.message ||
                     `Could not ${decision} this application. Please try again.`;
      showToast(message, 'red');
    } finally {
      setActioningId(null);
      setShowDetailsModal(false);
    }
  };

  const viewDocument = async (url: string, title: string) => {
    try {
      const fullUrl = url.startsWith('http') ? url : `${apiClient.defaults.baseURL}${url}`;
      const canOpen = await Linking.canOpenURL(fullUrl);
      if (canOpen) {
        await Linking.openURL(fullUrl);
      } else {
        showToast('Cannot open document', 'red');
      }
    } catch (err) {
      showToast('Could not open document', 'red');
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-ZA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return dateString;
    }
  };

  const isNew = (submittedAt: string) => {
    const hours = (Date.now() - new Date(submittedAt).getTime()) / 36e5;
    return hours <= 24;
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        <ActivityIndicator size="large" color={colors.green} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (error || unauthorized) {
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
          style={{ marginTop: spacing.lg }}
        />
      </View>
    );
  }

  const displayApprovals = showAllApprovals ? approvals : approvals.slice(0, PREVIEW_LIMIT);

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
          <View>
            <Text style={styles.headerSmall}>Admin Dashboard</Text>
            <Text style={styles.headerTitle}>{stats?.universityName || 'CampusConnect'}</Text>
          </View>
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={() => loadData(true)}
            disabled={refreshing}
          >
            <RotateCcw size={20} color={colors.gray600} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* STATS GRID */}
        <View style={styles.statsGrid}>
          <StatCard 
            icon={<Users size={16} color={colors.blue} strokeWidth={1.8} />} 
            value={stats?.totalUsers ?? 0} 
            label="Total Users" 
          />
          <StatCard 
            icon={<Car size={16} color={colors.green} strokeWidth={1.8} />} 
            value={stats?.totalDrivers ?? 0} 
            label="Drivers" 
          />
          <StatCard 
            icon={<CalendarCheck size={16} color={colors.blue} strokeWidth={1.8} />} 
            value={stats?.ridesToday ?? 0} 
            label="Rides Today" 
          />
          <StatCard
            icon={<Hourglass size={16} color={colors.orange} strokeWidth={1.8} />}
            value={stats?.pendingApprovals ?? 0}
            label="Pending"
            valueColor={colors.orange}
          />
          <StatCard
            icon={<Siren size={16} color={colors.red} strokeWidth={1.8} />}
            value={stats?.activeSOS ?? 0}
            label="Active SOS"
            valueColor={colors.red}
          />
          <StatCard
            icon={<ShieldCheck size={16} color={colors.green} strokeWidth={1.8} />}
            value={`${stats?.safetyScorePercent ?? 0}%`}
            label="Safety Score"
            valueColor={colors.green}
          />
        </View>

        {/* PENDING APPROVALS SECTION */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionLeft}>
            <Text style={styles.sectionTitle}>Pending Driver Approvals</Text>
            {(stats?.pendingApprovals ?? 0) > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{stats?.pendingApprovals}</Text>
              </View>
            )}
          </View>
          {approvals.length > PREVIEW_LIMIT && (
            <TouchableOpacity 
              onPress={() => setShowAllApprovals(!showAllApprovals)}
              style={styles.viewToggle}
            >
              <Text style={styles.viewToggleText}>
                {showAllApprovals ? 'Show Less' : `View All (${approvals.length})`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {approvals.length === 0 ? (
          <View style={styles.emptyState}>
            <ShieldCheck size={32} color={colors.green} strokeWidth={1.8} />
            <Text style={styles.emptyStateText}>All caught up!</Text>
            <Text style={styles.emptyStateSubtext}>No pending driver applications to review</Text>
          </View>
        ) : (
          <>
            {displayApprovals.map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                busy={actioningId === approval.id}
                isNew={isNew(approval.submittedAt)}
                onApprove={() => handleDecision(approval.id, 'approve')}
                onReject={() => handleDecision(approval.id, 'reject')}
                onViewDetails={() => {
                  setSelectedApproval(approval);
                  setShowDetailsModal(true);
                }}
              />
            ))}
          </>
        )}

        {/* NAV GRID */}
        <Text style={styles.navSectionTitle}>Quick Actions</Text>
        <View style={styles.navGrid}>
          <NavCard
            icon={<Users size={22} color={colors.blue} strokeWidth={1.8} />}
            label="User Management"
            onPress={() => showToast('Coming soon', 'blue')}
          />
          <NavCard
            icon={<MapPinned size={22} color={colors.green} strokeWidth={1.8} />}
            label="Ride Monitoring"
            onPress={() => showToast('Coming soon', 'blue')}
          />
          <NavCard
            icon={<FileWarning size={22} color={colors.red} strokeWidth={1.8} />}
            label="Incident Reports"
            onPress={() => showToast('Coming soon', 'blue')}
          />
          <NavCard
            icon={<SettingsIcon size={22} color={colors.gray500} strokeWidth={1.8} />}
            label="Settings"
            onPress={() => showToast('Coming soon', 'blue')}
          />
        </View>
      </ScrollView>

      {/* Details Modal */}
      <Modal
        visible={showDetailsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Application Details</Text>
              <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
                <X size={24} color={colors.gray500} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {selectedApproval && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Profile Section */}
                <View style={styles.profileSection}>
                  <View style={styles.profileAvatar}>
                    <Text style={styles.profileInitials}>
                      {selectedApproval.fullName
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.profileInfo}>
                    <Text style={styles.profileName}>{selectedApproval.fullName}</Text>
                    <Text style={styles.profileRole}>Driver Application</Text>
                    {isNew(selectedApproval.submittedAt) && (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>NEW</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Personal Info */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Personal Information</Text>
                  
                  <View style={styles.detailRow}>
                    <View style={styles.detailIcon}>
                      <Mail size={16} color={colors.gray500} strokeWidth={1.8} />
                    </View>
                    <Text style={styles.detailLabel}>Email</Text>
                    <Text style={styles.detailValue}>{selectedApproval.email}</Text>
                  </View>
                  
                  {selectedApproval.phone && (
                    <View style={styles.detailRow}>
                      <View style={styles.detailIcon}>
                        <Phone size={16} color={colors.gray500} strokeWidth={1.8} />
                      </View>
                      <Text style={styles.detailLabel}>Phone</Text>
                      <Text style={styles.detailValue}>{selectedApproval.phone}</Text>
                    </View>
                  )}
                  
                  {selectedApproval.studentNumber && (
                    <View style={styles.detailRow}>
                      <View style={styles.detailIcon}>
                        <Hash size={16} color={colors.gray500} strokeWidth={1.8} />
                      </View>
                      <Text style={styles.detailLabel}>Student Number</Text>
                      <Text style={styles.detailValue}>{selectedApproval.studentNumber}</Text>
                    </View>
                  )}
                  
                  {selectedApproval.yearOfStudy && (
                    <View style={styles.detailRow}>
                      <View style={styles.detailIcon}>
                        <GraduationCap size={16} color={colors.gray500} strokeWidth={1.8} />
                      </View>
                      <Text style={styles.detailLabel}>Year of Study</Text>
                      <Text style={styles.detailValue}>Year {selectedApproval.yearOfStudy}</Text>
                    </View>
                  )}
                </View>

                {/* Vehicle Info */}
                {selectedApproval.licencePlate && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Vehicle Information</Text>
                    
                    <View style={styles.detailRow}>
                      <View style={styles.detailIcon}>
                        <Car size={16} color={colors.gray500} strokeWidth={1.8} />
                      </View>
                      <Text style={styles.detailLabel}>Licence Plate</Text>
                      <Text style={styles.detailValue}>{selectedApproval.licencePlate}</Text>
                    </View>
                    
                    {selectedApproval.vehicleMake && (
                      <View style={styles.detailRow}>
                        <View style={styles.detailIcon}>
                          <Car size={16} color={colors.gray500} strokeWidth={1.8} />
                        </View>
                        <Text style={styles.detailLabel}>Vehicle</Text>
                        <Text style={styles.detailValue}>
                          {selectedApproval.vehicleMake} {selectedApproval.vehicleYear || ''}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Documents */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Documents</Text>
                  
                  {selectedApproval.proofDocUrl && (
                    <TouchableOpacity 
                      style={styles.documentRow}
                      onPress={() => viewDocument(selectedApproval.proofDocUrl!, 'Proof of Registration')}
                    >
                      <View style={styles.documentIcon}>
                        <FileWarning size={16} color={colors.blue} strokeWidth={1.8} />
                      </View>
                      <View style={styles.documentInfo}>
                        <Text style={styles.documentLabel}>Proof of Registration</Text>
                        <Text style={styles.documentHint}>Tap to view</Text>
                      </View>
                      <Eye size={16} color={colors.gray400} strokeWidth={1.8} />
                    </TouchableOpacity>
                  )}
                  
                  {selectedApproval.licenceDocUrl && (
                    <TouchableOpacity 
                      style={styles.documentRow}
                      onPress={() => viewDocument(selectedApproval.licenceDocUrl!, "Driver's Licence")}
                    >
                      <View style={styles.documentIcon}>
                        <FileWarning size={16} color={colors.orange} strokeWidth={1.8} />
                      </View>
                      <View style={styles.documentInfo}>
                        <Text style={styles.documentLabel}>Driver's Licence</Text>
                        <Text style={styles.documentHint}>Tap to view</Text>
                      </View>
                      <Eye size={16} color={colors.gray400} strokeWidth={1.8} />
                    </TouchableOpacity>
                  )}
                  
                  {selectedApproval.vehicleDocUrl && (
                    <TouchableOpacity 
                      style={styles.documentRow}
                      onPress={() => viewDocument(selectedApproval.vehicleDocUrl!, 'Vehicle Registration')}
                    >
                      <View style={styles.documentIcon}>
                        <FileWarning size={16} color={colors.green} strokeWidth={1.8} />
                      </View>
                      <View style={styles.documentInfo}>
                        <Text style={styles.documentLabel}>Vehicle Registration</Text>
                        <Text style={styles.documentHint}>Tap to view</Text>
                      </View>
                      <Eye size={16} color={colors.gray400} strokeWidth={1.8} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Submitted Date */}
                <View style={styles.detailSection}>
                  <View style={styles.detailRow}>
                    <View style={styles.detailIcon}>
                      <Clock size={16} color={colors.gray500} strokeWidth={1.8} />
                    </View>
                    <Text style={styles.detailLabel}>Submitted</Text>
                    <Text style={styles.detailValue}>{formatDate(selectedApproval.submittedAt)}</Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <Button
                    label="Reject"
                    onPress={() => handleDecision(selectedApproval.id, 'reject')}
                    variant="red"
                    disabled={actioningId === selectedApproval.id}
                    style={styles.modalActionButton}
                    icon={<X size={18} color={colors.red} strokeWidth={2.2} />}
                  />
                  <Button
                    label="Approve"
                    onPress={() => handleDecision(selectedApproval.id, 'approve')}
                    loading={actioningId === selectedApproval.id}
                    disabled={actioningId === selectedApproval.id}
                    style={styles.modalActionButton}
                    icon={<Check size={18} color={colors.white} strokeWidth={2.2} />}
                  />
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
      <View style={styles.statIcon}>{icon}</View>
      <Text style={[styles.statValue, valueColor && { color: valueColor }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ApprovalCard({
  approval,
  busy,
  isNew,
  onApprove,
  onReject,
  onViewDetails,
}: {
  approval: PendingApproval;
  busy: boolean;
  isNew: boolean;
  onApprove: () => void;
  onReject: () => void;
  onViewDetails: () => void;
}) {
  const initials = approval.fullName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View style={styles.approvalCard}>
      <TouchableOpacity onPress={onViewDetails} activeOpacity={0.7}>
        <View style={styles.approvalTopRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.approvalInfo}>
            <View style={styles.approvalNameRow}>
              <Text style={styles.approvalName}>{approval.fullName}</Text>
              {isNew && (
                <View style={styles.newBadgeSmall}>
                  <Text style={styles.newBadgeSmallText}>NEW</Text>
                </View>
              )}
            </View>
            <Text style={styles.approvalMeta} numberOfLines={1}>
              {approval.email}
              {approval.licencePlate ? ` • ${approval.licencePlate}` : ''}
            </Text>
            <Text style={styles.approvalDate}>
              {new Date(approval.submittedAt).toLocaleDateString('en-ZA', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
          <TouchableOpacity style={styles.detailsButton} onPress={onViewDetails}>
            <Eye size={16} color={colors.green} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      <View style={styles.approvalButtonRow}>
        <Button
          label="Reject"
          onPress={onReject}
          variant="red"
          disabled={busy}
          icon={<X size={15} color={colors.red} strokeWidth={2.2} />}
          style={styles.rejectButton}
        />
        <Button
          label="Approve"
          onPress={onApprove}
          loading={busy}
          disabled={busy}
          icon={<Check size={15} color={colors.white} strokeWidth={2.2} />}
          style={styles.approveButton}
        />
      </View>
    </View>
  );
}

function NavCard({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.navCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.navIcon}>{icon}</View>
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

  header: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.white,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerSmall: { 
    fontFamily: font.medium, 
    fontSize: 12, 
    color: colors.gray400, 
    fontWeight: '500', 
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitle: { 
    fontFamily: font.extrabold, 
    fontSize: 22, 
    color: colors.gray900, 
    fontWeight: '800' 
  },
  refreshButton: {
    padding: 8,
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
  },

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
    alignItems: 'center',
  },
  statIcon: {
    marginBottom: 4,
  },
  statValue: { 
    fontFamily: font.extrabold, 
    fontSize: 20, 
    fontWeight: '800', 
    color: colors.gray900, 
    marginTop: 2,
  },
  statLabel: {
    fontFamily: font.semibold,
    fontSize: 9,
    fontWeight: '600',
    color: colors.gray400,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 1,
    textAlign: 'center',
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: { 
    fontFamily: font.extrabold, 
    fontSize: 16, 
    fontWeight: '800', 
    color: colors.gray900 
  },
  viewToggle: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  viewToggleText: {
    fontFamily: font.semibold,
    fontSize: 12,
    fontWeight: '600',
    color: colors.green,
  },
  countBadge: {
    backgroundColor: colors.orange,
    borderRadius: radius.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: { 
    fontFamily: font.bold, 
    fontSize: 10, 
    fontWeight: '700', 
    color: colors.white 
  },

  emptyState: {
    marginHorizontal: spacing.xxl,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: 4,
    ...shadow.sm,
  },
  emptyStateText: { 
    fontFamily: font.bold, 
    fontSize: 16, 
    fontWeight: '700', 
    color: colors.gray700,
    marginTop: 4,
  },
  emptyStateSubtext: {
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.gray400,
  },

  approvalCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    marginHorizontal: spacing.xxl,
    marginBottom: spacing.md,
    padding: spacing.md,
    ...shadow.sm,
  },
  approvalTopRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    marginBottom: spacing.md 
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { 
    fontFamily: font.bold, 
    fontSize: 16, 
    fontWeight: '700', 
    color: colors.white 
  },
  approvalInfo: {
    flex: 1,
  },
  approvalNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  approvalName: { 
    fontFamily: font.bold, 
    fontSize: 15, 
    fontWeight: '700', 
    color: colors.gray900 
  },
  newBadgeSmall: {
    backgroundColor: '#FDE68A',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  newBadgeSmallText: {
    fontFamily: font.bold,
    fontSize: 8,
    fontWeight: '700',
    color: colors.gray900,
  },
  approvalMeta: { 
    fontFamily: font.regular, 
    fontSize: 12, 
    color: colors.gray500,
    marginTop: 1,
  },
  approvalDate: {
    fontFamily: font.regular,
    fontSize: 10,
    color: colors.gray400,
    marginTop: 1,
  },
  detailsButton: {
    padding: 8,
    backgroundColor: colors.greenLight,
    borderRadius: radius.full,
  },

  approvalButtonRow: { 
    flexDirection: 'row', 
    gap: 10 
  },
  rejectButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.red,
  },
  approveButton: {
    flex: 1,
  },

  navSectionTitle: {
    fontFamily: font.extrabold,
    fontSize: 16,
    fontWeight: '800',
    color: colors.gray900,
    paddingHorizontal: spacing.xxl,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  navGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: spacing.xxl,
  },
  navCard: {
    width: '47%',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 8,
    ...shadow.sm,
  },
  navIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navCardLabel: { 
    fontFamily: font.semibold, 
    fontSize: 13, 
    fontWeight: '600', 
    color: colors.gray700,
    textAlign: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  modalTitle: {
    fontFamily: font.bold,
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
  },
  modalBody: {
    padding: spacing.xl,
    paddingBottom: spacing.lg,
  },

  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitials: {
    fontFamily: font.bold,
    fontSize: 24,
    fontWeight: '700',
    color: colors.white,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontFamily: font.bold,
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
  },
  profileRole: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.gray500,
  },
  newBadge: {
    backgroundColor: '#FDE68A',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  newBadgeText: {
    fontFamily: font.bold,
    fontSize: 9,
    fontWeight: '700',
    color: colors.gray900,
  },

  detailSection: {
    marginBottom: spacing.lg,
  },
  detailSectionTitle: {
    fontFamily: font.semibold,
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray700,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray50,
    gap: 8,
  },
  detailIcon: {
    width: 20,
    alignItems: 'center',
  },
  detailLabel: {
    fontFamily: font.medium,
    fontSize: 12,
    fontWeight: '500',
    color: colors.gray500,
    width: 80,
  },
  detailValue: {
    fontFamily: font.semibold,
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray900,
    flex: 1,
  },

  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.gray50,
    borderRadius: radius.sm,
    marginBottom: 6,
    gap: 12,
  },
  documentIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentInfo: {
    flex: 1,
  },
  documentLabel: {
    fontFamily: font.semibold,
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray700,
  },
  documentHint: {
    fontFamily: font.regular,
    fontSize: 10,
    color: colors.gray400,
  },

  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  modalActionButton: {
    flex: 1,
  },
});