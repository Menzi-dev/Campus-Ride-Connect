import { useSafeAreaInsets } from 'react-native-safe-area-context';
﻿import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { AlertTriangle, Car, Crosshair, Shield, Siren } from 'lucide-react-native';
import apiClient from '../services/ApiClient';
import { useToast } from '../components/Toast';
import { colors, font, radius, spacing, shadow } from '../theme/theme';

type RootStackParamList = { SecurityDashboard: undefined; ActiveRidesMonitor: undefined; SosAlerts: undefined };
type Ride = { id: number; riderName?: string; driverName?: string; pickupLocation?: string; destination?: string; status: string };
type Alert = { id: number; reference: string; triggeredByName?: string; triggeredByRole?: string; riderName?: string; driverName?: string; gpsLat?: number; gpsLng?: number; rideReference: string; createdAt: string };

export default function SecurityCentreDashboardScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { showToast } = useToast();
  const [rides, setRides] = useState<Ride[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const loadData = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try { const response = await apiClient.get('/security/dashboard'); setRides(response.data?.activeRides || []); setAlerts(response.data?.activeSos || []); setError(''); }
    catch (err: any) { setError(err?.response?.data?.error || 'Could not load security dashboard'); showToast('Could not load security data', 'red'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [showToast]);
  useFocusEffect(useCallback(() => { loadData(); const timer = setInterval(() => loadData(true), 15000); return () => clearInterval(timer); }, [loadData]));
  const activeAlert = alerts[0];
  const formatDate = (value?: string) => value ? new Date(value).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Time unavailable';
  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.green} /></View>;
  return (
    <View style={styles.container}><ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={colors.green} />} contentContainerStyle={styles.content}>
      <View style={styles.header}><View style={styles.icon}><Shield size={22} color={colors.greenDark} /></View><View style={{ flex: 1, minWidth: 0 }}><Text style={styles.kicker}>Security Centre</Text><Text style={styles.title}>Campus Security Officer</Text></View></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.stats}><Stat icon={<Car size={20} color={colors.blue} />} value={rides.length} label="ACTIVE RIDES" /><Stat icon={<Siren size={20} color={colors.red} />} value={alerts.length} label="SOS ALERTS" /></View>
      {activeAlert ? <View style={styles.alertCard}><View style={styles.alertHeading}><Text style={styles.alertTitle}>SOS ALERT</Text><Text style={styles.alertTime}>{formatDate(activeAlert.createdAt)}</Text></View>{activeAlert.triggeredByName ? <><Text style={styles.alertLabel}>REPORTED BY {activeAlert.triggeredByRole === 'DRIVER' ? 'DRIVER' : 'RIDER'}</Text><Text style={styles.alertValue}>{activeAlert.triggeredByName}</Text></> : null}<Text style={styles.alertLabel}>RIDER</Text><Text style={styles.alertValue}>{activeAlert.riderName || 'Unknown rider'}</Text><Text style={styles.alertLabel}>DRIVER</Text><Text style={styles.alertValue}>{activeAlert.driverName || 'Unassigned driver'}</Text><Text style={styles.alertMeta}>#{activeAlert.rideReference}  •  {activeAlert.gpsLat ?? '-'}, {activeAlert.gpsLng ?? '-'}</Text><TouchableOpacity style={styles.lightButton} onPress={() => navigation.navigate('SosAlerts')}><Siren size={16} color={colors.red} /><Text style={styles.lightButtonText}>Respond Now</Text></TouchableOpacity></View> : <View style={styles.empty}><Text style={styles.emptyTitle}>No active SOS alerts</Text><Text style={styles.emptyText}>New emergency alerts will appear here.</Text></View>}
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>LIVE RIDES</Text><TouchableOpacity onPress={() => navigation.navigate('ActiveRidesMonitor')}><Text style={styles.link}>View monitor</Text></TouchableOpacity></View>
      {rides.slice(0, 4).map((ride) => <View style={styles.rideCard} key={ride.id}><View style={styles.rideTop}><Text style={styles.rideId}>#R-{ride.id}</Text><Text style={styles.time}>{ride.status}</Text></View><Text style={styles.rideNames}>{ride.riderName || 'Unknown rider'} <Text style={styles.arrow}>→</Text> {ride.driverName || 'Unassigned driver'}</Text><Text style={styles.route}>{ride.pickupLocation || 'Pickup'} → {ride.destination || 'Destination'}</Text><TouchableOpacity style={styles.trackButton} onPress={() => navigation.navigate('ActiveRidesMonitor')}><Crosshair size={15} color={colors.white} /><Text style={styles.trackText}>Track</Text></TouchableOpacity></View>)}
    </ScrollView><SecurityNav active="dashboard" onDashboard={() => navigation.navigate('SecurityDashboard')} onRides={() => navigation.navigate('ActiveRidesMonitor')} onAlerts={() => navigation.navigate('SosAlerts')} /></View>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) { return <View style={styles.stat}><View>{icon}</View><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }

export function SecurityNav({ active, onDashboard, onRides, onAlerts }: { active: string; onDashboard: () => void; onRides: () => void; onAlerts: () => void }) { const insets = useSafeAreaInsets(); return <View testID="security-bottom-nav" style={[styles.nav, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}><NavItem icon={<Shield size={19} />} label="Dashboard" active={active === 'dashboard'} onPress={onDashboard} /><NavItem icon={<Car size={19} />} label="Active Rides" active={active === 'rides'} onPress={onRides} /><NavItem icon={<Siren size={19} />} label="SOS Alerts" active={active === 'alerts'} onPress={onAlerts} /></View>; }
function NavItem({ icon, label, active, onPress }: { icon: React.ReactElement<any>; label: string; active: boolean; onPress: () => void }) { return <TouchableOpacity style={styles.navItem} onPress={onPress}>{React.cloneElement(icon, { color: active ? colors.green : colors.gray400 })}<Text style={[styles.navText, active && styles.navActive]}>{label}</Text></TouchableOpacity>; }

const styles = StyleSheet.create({
  container: {
    flex: 1, minWidth: 0, minHeight: 0,
    backgroundColor: colors.gray50,
  },
  content: { padding: spacing.lg, paddingBottom: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gray50 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  icon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  kicker: { color: colors.gray500, fontFamily: font.regular, fontSize: 12 },
  title: {
    fontFamily: font.extrabold,
    fontSize: 21,
    color: colors.gray900,
    marginTop: 2,
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.gray500,
    textAlign: 'center',
  },
  error: { color: colors.red, fontFamily: font.medium, marginBottom: spacing.md },
  stats: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, ...shadow.sm },
  statValue: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 25, marginTop: spacing.sm },
  statLabel: { color: colors.gray500, fontFamily: font.bold, fontSize: 10, marginTop: 2 },
  alertCard: { backgroundColor: colors.red, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.lg },
  alertHeading: { flexDirection: 'row', justifyContent: 'space-between' },
  alertTitle: { color: colors.white, fontFamily: font.extrabold, fontSize: 13 },
  alertTime: { color: colors.white, fontFamily: font.regular, fontSize: 11 },
  alertLabel: { color: '#FECACA', fontFamily: font.bold, fontSize: 9, marginTop: spacing.md },
  alertValue: { color: colors.white, fontFamily: font.bold, fontSize: 14 },
  alertMeta: { color: colors.white, fontFamily: font.mono, fontSize: 12, marginTop: spacing.md },
  lightButton: { backgroundColor: colors.white, minHeight: 42, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  lightButtonText: { color: colors.red, fontFamily: font.bold, fontSize: 13 },
  empty: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.lg },
  emptyTitle: { color: colors.gray800, fontFamily: font.bold, fontSize: 14 },
  emptyText: { color: colors.gray500, fontFamily: font.regular, fontSize: 12, marginTop: spacing.xs },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionTitle: { color: colors.gray600, fontFamily: font.bold, fontSize: 12 },
  link: { color: colors.blue, fontFamily: font.bold, fontSize: 12 },
  rideCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  rideTop: { flexDirection: 'row', justifyContent: 'space-between' },
  rideId: { color: colors.gray900, fontFamily: font.bold, fontSize: 13 },
  time: { color: colors.gray400, fontFamily: font.mono, fontSize: 10 },
  rideNames: { color: colors.gray900, fontFamily: font.bold, fontSize: 14, marginTop: spacing.sm },
  arrow: { color: colors.gray400 },
  route: { color: colors.gray500, fontFamily: font.regular, fontSize: 11, marginTop: 4 },
  trackButton: { backgroundColor: colors.blue, borderRadius: radius.full, minHeight: 36, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  trackText: { color: colors.white, fontFamily: font.bold, fontSize: 12 },
  nav: { flexShrink: 0, minHeight: 64, paddingTop: spacing.sm, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.gray200, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', zIndex: 10, elevation: 10 },
  navItem: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center', alignItems: 'center', gap: 3 },
  navText: { color: colors.gray400, fontFamily: font.medium, fontSize: 10 },
  navActive: { color: colors.green, fontFamily: font.bold },
});
