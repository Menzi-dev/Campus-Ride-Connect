// Administrator dashboard: load totals and driver applications. Open submitted documents, approve
// or reject an application and refresh the displayed information after a decision.
// Where: mobile/src/screens/AdminDashboardScreen.tsx; start at AdminDashboardScreen(), then follow
// the named actions below.
// How: AdminDashboardScreen() renders the screen and keeps its form/list/progress values in React
// state. loadData(), handleDecision() and viewDocument() contain the API calls; ApiClient.ts adds
// the /api base path and saved login token.
/** Loads university operations data and provides driver application review actions. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Pressable,
  Image,
  AppState,
  Platform,
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
  X,
  TriangleAlert,
  RotateCcw,
  Check,
  Eye,
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
  UserManagement: undefined;
  RideMonitoring: undefined;
  IncidentReports: undefined;
  UniversitySettings: undefined;
  Login: undefined;
};

type Stats = {
  totalUsers: number;
  totalDrivers: number;
  ridesToday: number;
  pendingApprovals: number;
  activeSOS: number;
  safetyScorePercent: number | null;
  completedRides: number;
  sosFreeCompletedRides: number;
  updatedAt: string;
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
  const [documentPreview, setDocumentPreview] = useState<{ uri: string; title: string; type: string } | null>(null);
  useEffect(() => () => {
    if (Platform.OS === 'web' && documentPreview) URL.revokeObjectURL(documentPreview.uri);
  }, [documentPreview]);
  const [showAllApprovals, setShowAllApprovals] = useState(false);
  const loadingRef = useRef(false);
  const decisionRef = useRef<string | null>(null);
  const loadVersion = useRef(0);

  // Feature: Retrieve dashboard totals and driver applications, keeping refresh and retry feedback
  // in sync.
  // Where: AdminDashboardScreen.loadData() below.
  // How: loadData() uses apiClient.get('/admin/dashboard') through mobile/src/services/ApiClient.ts
  // to exchange data with the backend. setRefreshing() and setLoading() update React state, which
  // redraws the related screen content.
  const loadData = useCallback(async (isRefresh = false, silent = false) => {
    if (loadingRef.current || decisionRef.current) return;
    loadingRef.current = true;
    const version = loadVersion.current;
    if (!silent) {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
    }
    setError(null);
    setUnauthorized(false);

    try {
      const response = await apiClient.get('/admin/dashboard');
      if (version !== loadVersion.current) return;
      const applications = response.data.approvals;
      if (!response.data.stats || !Array.isArray(applications)) throw new Error('Incomplete dashboard response');
      setStats(response.data.stats);
      setApprovals(applications);

    } catch (err: any) {
      if (version !== loadVersion.current) return;
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
      loadingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // New registrations should appear while the admin is reviewing applications.
  useFocusEffect(
    useCallback(() => {
      loadData();
      const interval = setInterval(() => {
        if (AppState.currentState === 'active') loadData(true, true);
      }, 15000);
      const subscription = AppState.addEventListener('change', state => {
        if (state === 'active') loadData(true, true);
      });
      return () => {
        clearInterval(interval);
        subscription.remove();
      };
    }, [loadData])
  );

  // Feature: Send the chosen application approval or rejection and refresh the administrator data.
  // Where: AdminDashboardScreen.handleDecision() below.
  // How: handleDecision() posts /admin/driver-approvals/${id}/${decision}. AdminController updates
  // the account/driver records; setApprovals() and the dashboard refresh show the result.
  const handleDecision = async (id: string, decision: 'approve' | 'reject') => {
    if (decisionRef.current) return;
    decisionRef.current = id;
    loadVersion.current += 1;
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
        decisionRef.current = null;
        await loadData(true, true);
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
      decisionRef.current = null;
      setActioningId(null);
      setShowDetailsModal(false);
    }
  };

  // Feature: Open the selected driver application document and report any failure.
  // Where: AdminDashboardScreen.viewDocument() below.
  // How: viewDocument() uses apiClient.get(url) through mobile/src/services/ApiClient.ts to
  // exchange data with the backend. setDocumentPreview() update React state, which redraws the
  // related screen content.
  const viewDocument = async (url: string, title: string) => {
    try {
      if (Platform.OS !== 'web') return showToast('Open the dashboard in your browser to preview documents', 'red');
      const response = await apiClient.get(url, { responseType: 'blob' });
      const blob = response.data as Blob;
      setDocumentPreview({ uri: URL.createObjectURL(blob), title, type: blob.type });
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
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <Text style={styles.headerSmall}>Admin Dashboard</Text>
            <Text style={styles.headerTitle} numberOfLines={2}>{stats?.universityName || 'CampusConnect'}</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => loadData(true)}
            disabled={refreshing}
          >
            <RotateCcw size={20} color={colors.gray600} strokeWidth={2} />
          </TouchableOpacity>
        </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={colors.green} />
        }
      >
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
            label="Driver Accounts"
          />
          <StatCard
            icon={<CalendarCheck size={16} color={colors.blue} strokeWidth={1.8} />}
            value={stats?.ridesToday ?? 0}
            label="Requests Today"
          />
          <StatCard
            icon={<Hourglass size={16} color={colors.orange} strokeWidth={1.8} />}
            value={stats?.pendingApprovals ?? 0}
            label="Pending Approvals"
            valueColor={colors.orange}
          />
          <StatCard
            icon={<Siren size={16} color={colors.red} strokeWidth={1.8} />}
            value={stats?.activeSOS ?? 0}
            label="Open SOS Alerts"
            valueColor={colors.red}
          />
          <StatCard
            icon={<ShieldCheck size={16} color={colors.green} strokeWidth={1.8} />}
            value={stats?.safetyScorePercent == null ? 'N/A' : `${stats.safetyScorePercent}%`}
            label="SOS-Free Trips"
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
            onPress={() => navigation.navigate('UserManagement')}
          />
          <NavCard
            icon={<MapPinned size={22} color={colors.green} strokeWidth={1.8} />}
            label="Ride Monitoring"
            onPress={() => navigation.navigate('RideMonitoring')}
          />
          <NavCard
            icon={<FileWarning size={22} color={colors.red} strokeWidth={1.8} />}
            label="Incident Reports"
            onPress={() => navigation.navigate('IncidentReports')}
          />
          <NavCard
            icon={<SettingsIcon size={22} color={colors.gray500} strokeWidth={1.8} />}
            label="Settings"
            onPress={() => navigation.navigate('UniversitySettings')}
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
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowDetailsModal(false)} />
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
                  {!selectedApproval.proofDocUrl && !selectedApproval.licenceDocUrl && !selectedApproval.vehicleDocUrl &&
                    <Text style={{ color: colors.gray500, fontSize: 13 }}>No application documents are available for this registration.</Text>}

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
      {/* Render last so the document stays above the application review sheet. */}
      <Modal visible={documentPreview !== null} transparent animationType="slide" onRequestClose={() => setDocumentPreview(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.5)', justifyContent: 'center', padding: 16 }}>
          <View style={{ height: '90%', backgroundColor: 'white', borderRadius: 16, padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontWeight: '700', flex: 1 }}>{documentPreview?.title}</Text>
              <TouchableOpacity accessibilityLabel="Close document" onPress={() => setDocumentPreview(null)}><X size={24} color={colors.black} /></TouchableOpacity>
            </View>
            {documentPreview && (documentPreview.type.startsWith('image/')
              ? <Image source={{ uri: documentPreview.uri }} style={{ flex: 1 }} resizeMode="contain" />
              : Platform.OS === 'web' ? <iframe title={documentPreview.title} src={documentPreview.uri} style={{ width: '100%', flex: 1, border: 0 }} /> : null)}
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
  onReject,
  onViewDetails,
}: {
  approval: PendingApproval;
  busy: boolean;
  isNew: boolean;
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
          label="View"
          onPress={onViewDetails}
          loading={busy}
          disabled={busy}
          icon={<Eye size={15} color={colors.white} strokeWidth={2.2} />}
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

// Screen appearance: keep layout, spacing, colours and text styles together here.
const styles = StyleSheet.create({
  container: { flex: 1, minWidth: 0, minHeight: 0, backgroundColor: colors.gray50 },
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
    paddingBottom: spacing.md,
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
    fontSize: 20,
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
    gap: 8,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  statCard: {
    flexBasis: 120,
    flexGrow: 1,
    minWidth: 0,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 10,
    ...shadow.sm,
    alignItems: 'center',
  },
  statIcon: {
    marginBottom: 4,
  },
  statValue: {
    fontFamily: font.extrabold,
    fontSize: 18,
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
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontFamily: font.extrabold,
    fontSize: 14,
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
    padding: 12,
    ...shadow.sm,
  },
  approvalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.md
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    fontSize: 14,
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
    minHeight: 44,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: colors.red,
  },
  approveButton: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 10,
  },

  navSectionTitle: {
    fontFamily: font.extrabold,
    fontSize: 14,
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
    flexBasis: 140,
    flexGrow: 1,
    minWidth: 0,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    ...shadow.sm,
  },
  navIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navCardLabel: {
    fontFamily: font.semibold,
    fontSize: 12,
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
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
    minHeight: 0,
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
    minHeight: 0,
    flexShrink: 1,
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
