import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import apiClient from '../services/ApiClient';
import { colors, font, radius, spacing, shadow } from '../theme/theme';
import { SecurityNav } from './SecurityCentreDashboardScreen';

type RootStackParamList = {
  SecurityDashboard: undefined;
  ActiveRidesMonitor: undefined;
  SosAlerts: undefined;
  ResolvedSos: undefined;
};

type Alert = {
  id: number;
  reference: string;
  riderName?: string;
  createdAt: string;
};

const ALERTS_PER_PAGE = 6;

export default function ResolvedSosScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [resolved, setResolved] = useState<Alert[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const response = await apiClient.get('/security/sos');
      setResolved(response.data?.resolved || []);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not load resolved SOS alerts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const pageCount = Math.max(1, Math.ceil(resolved.length / ALERTS_PER_PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleAlerts = resolved.slice(safePage * ALERTS_PER_PAGE, safePage * ALERTS_PER_PAGE + ALERTS_PER_PAGE);
  const formatDate = (value: string) => new Date(value).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.kicker}>SOS ALERTS</Text>
        <Text style={styles.title}>All Resolved SOS</Text>
        <Text style={styles.subtitle}>{resolved.length} resolved alerts</Text>
      </View>
      <ScrollView
        style={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.green} />}
        contentContainerStyle={styles.listContent}
      >
        {loading ? <ActivityIndicator size="large" color={colors.green} style={styles.loader} /> : error ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => load()}>
              <RefreshCw size={15} color={colors.white} />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : visibleAlerts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No resolved SOS alerts yet</Text>
          </View>
        ) : visibleAlerts.map((alert) => (
          <View style={styles.alertCard} key={alert.id}>
            <View>
              <Text style={styles.reference}>{alert.reference}</Text>
              <Text style={styles.alertText}>{alert.riderName || 'Unknown rider'} · {formatDate(alert.createdAt)}</Text>
            </View>
            <Text style={styles.resolvedBadge}>RESOLVED</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.pagination}>
        <TouchableOpacity
          style={[styles.pageButton, safePage === 0 && styles.disabledButton]}
          onPress={() => setPage(Math.max(0, safePage - 1))}
          disabled={safePage === 0}
        >
          <ChevronLeft size={18} color={safePage === 0 ? colors.gray400 : colors.gray800} />
          <Text style={[styles.pageButtonText, safePage === 0 && styles.disabledText]}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.pageCount}>Page {safePage + 1} of {pageCount}</Text>
        <TouchableOpacity
          style={[styles.pageButton, safePage >= pageCount - 1 && styles.disabledButton]}
          onPress={() => setPage(Math.min(pageCount - 1, safePage + 1))}
          disabled={safePage >= pageCount - 1}
        >
          <Text style={[styles.pageButtonText, safePage >= pageCount - 1 && styles.disabledText]}>Next</Text>
          <ChevronRight size={18} color={safePage >= pageCount - 1 ? colors.gray400 : colors.gray800} />
        </TouchableOpacity>
      </View>
      <SecurityNav active="alerts" onDashboard={() => navigation.navigate('SecurityDashboard')} onRides={() => navigation.navigate('ActiveRidesMonitor')} onAlerts={() => navigation.navigate('SosAlerts')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: { padding: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray200 },
  kicker: { color: colors.blue, fontFamily: font.bold, fontSize: 10, letterSpacing: 0.5 },
  title: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 23, marginTop: spacing.xs },
  subtitle: { color: colors.gray500, fontFamily: font.regular, fontSize: 12, marginTop: spacing.xs },
  list: { flex: 1, marginHorizontal: spacing.lg },
  listContent: { paddingTop: spacing.md, paddingBottom: 150 },
  loader: { marginTop: spacing.xxxl },
  alertCard: { backgroundColor: colors.white, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray200, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reference: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 15 },
  alertText: { color: colors.gray500, fontFamily: font.regular, fontSize: 11, marginTop: 3 },
  resolvedBadge: { color: colors.greenDark, backgroundColor: colors.greenLight, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 4, fontFamily: font.bold, fontSize: 9 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl },
  emptyTitle: { color: colors.gray600, fontFamily: font.semibold, fontSize: 14, textAlign: 'center' },
  retryButton: { marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.blue, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  retryText: { color: colors.white, fontFamily: font.semibold, fontSize: 13 },
  pagination: { position: 'absolute', left: 0, right: 0, bottom: 72, height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, borderTopWidth: 1, borderTopColor: colors.gray200, backgroundColor: colors.gray50, zIndex: 10, elevation: 10 },
  pageButton: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200, ...shadow.sm },
  disabledButton: { backgroundColor: colors.gray100, borderColor: colors.gray100 },
  pageButtonText: { color: colors.gray800, fontFamily: font.semibold, fontSize: 13 },
  disabledText: { color: colors.gray300 },
  pageCount: { color: colors.gray500, fontFamily: font.medium, fontSize: 12 },
});
