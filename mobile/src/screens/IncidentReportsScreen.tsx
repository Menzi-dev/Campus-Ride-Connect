import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, Eye, Headphones, RefreshCw, Search, X } from 'lucide-react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import apiClient from '../services/ApiClient';
import { colors, font, radius, shadow, spacing } from '../theme/theme';

type RootStackParamList = { AdminDashboard: undefined; IncidentReports: undefined; AudioRecordings: { incidentId: number } };
type Incident = {
  id: number;
  referenceNumber: string;
  type: string;
  typeLabel: string;
  status: 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
  rideReference: string;
  riderName?: string;
  driverName?: string;
  pickupLocation?: string;
  destination?: string;
  createdAt: string;
  hasAudio: boolean;
  recordingDuration?: number;
};

const statusColors = {
  INVESTIGATING: { background: colors.yellowLight, text: colors.yellowText },
  RESOLVED: { background: colors.greenLight, text: colors.greenDark },
  CLOSED: { background: colors.gray100, text: colors.gray700 },
};
const REPORTS_PER_PAGE = 4;

export default function IncidentReportsScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  const loadIncidents = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const response = await apiClient.get('/admin/incidents');
      const nextIncidents = Array.isArray(response.data) ? response.data : [];
      setIncidents(nextIncidents);
      setPage((current) => Math.min(current, Math.max(0, Math.ceil(nextIncidents.length / REPORTS_PER_PAGE) - 1)));
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not load incident reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadIncidents(); }, [loadIncidents]));

  const formatDate = (value: string) => new Date(value).toLocaleString('en-ZA', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredIncidents = normalizedQuery
    ? incidents.filter((incident) => [
      incident.referenceNumber,
      incident.typeLabel,
      incident.status,
      incident.rideReference,
      incident.riderName,
      incident.driverName,
      incident.pickupLocation,
      incident.destination,
    ].some((value) => value?.toLowerCase().includes(normalizedQuery)))
    : incidents;
  const pageCount = Math.max(1, Math.ceil(filteredIncidents.length / REPORTS_PER_PAGE));
  const visibleIncidents = filteredIncidents.slice(page * REPORTS_PER_PAGE, (page + 1) * REPORTS_PER_PAGE);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityLabel="Back to admin dashboard">
          <ArrowLeft size={20} color={colors.greenDark} /><Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.titleRow}>
          <View><Text style={styles.title}>Incident Reports</Text><Text style={styles.subtitle}>{filteredIncidents.length} matching incident{filteredIncidents.length === 1 ? '' : 's'}</Text></View>
          <TouchableOpacity style={styles.refreshButton} onPress={() => loadIncidents(true)} disabled={refreshing} accessibilityLabel="Refresh incident reports">
            <RefreshCw size={18} color={colors.gray600} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.searchBox} activeOpacity={0.9} onPress={() => searchInputRef.current?.focus()} accessibilityRole="search">
          <Search size={18} color={colors.gray500} />
          <TextInput
            ref={searchInputRef}
            value={searchQuery}
            onChangeText={(value) => { setSearchQuery(value); setPage(0); }}
            placeholder="Search incident reports"
            placeholderTextColor={colors.gray400}
            style={styles.searchInput}
            returnKeyType="search"
            accessibilityLabel="Search incident reports"
          />
          {searchQuery.length > 0 && <TouchableOpacity onPress={() => { setSearchQuery(''); setPage(0); }} accessibilityLabel="Clear incident search">
            <X size={17} color={colors.gray500} />
          </TouchableOpacity>}
        </TouchableOpacity>
      </View>
      <FlatList
        data={loading || error || filteredIncidents.length === 0 ? [] : visibleIncidents}
        keyExtractor={(incident) => String(incident.id)}
        style={styles.resultsScroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadIncidents(true)} tintColor={colors.green} />}
        contentContainerStyle={styles.content}
        renderItem={({ item: incident }) => {
          const status = statusColors[incident.status] || statusColors.INVESTIGATING;
          return <View key={incident.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.reference}>#{incident.referenceNumber}</Text>
              <View style={styles.badge}><Text style={styles.badgeText}>{incident.typeLabel}</Text></View>
              <View style={[styles.badge, { backgroundColor: status.background }]}><Text style={[styles.badgeText, { color: status.text }]}>{incident.status}</Text></View>
            </View>
            <Text style={styles.rideLine}>Ride #{incident.rideReference} <Text style={styles.dot}>•</Text> {incident.riderName || 'Unknown rider'} <Text style={styles.routeArrow}>→</Text> {incident.driverName || 'Unassigned driver'}</Text>
            <Text style={styles.timestamp}>{formatDate(incident.createdAt)}</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.detailsButton} onPress={() => setSelected(incident)}><Eye size={17} color={colors.gray800} /><Text style={styles.detailsText}>View Details</Text></TouchableOpacity>
              {incident.hasAudio && <TouchableOpacity style={styles.audioButton} onPress={() => navigation.navigate('AudioRecordings', { incidentId: incident.id })}><Headphones size={17} color={colors.white} /><Text style={styles.audioText}>Audio</Text></TouchableOpacity>}
            </View>
          </View>;
        }}
        ListHeaderComponent={loading ? <ActivityIndicator size="large" color={colors.green} style={styles.loader} /> : error ? (
          <View style={styles.state}><AlertTriangle size={32} color={colors.red} /><Text style={styles.stateTitle}>Could not load reports</Text><Text style={styles.stateText}>{error}</Text><TouchableOpacity style={styles.retryButton} onPress={() => loadIncidents()}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View>
        ) : filteredIncidents.length === 0 ? (
          <View style={styles.state}><AlertTriangle size={32} color={colors.gray400} /><Text style={styles.stateTitle}>No incident reports</Text><Text style={styles.stateText}>Recorded incidents will appear here when they are flagged.</Text></View>
        ) : null}
        ListFooterComponent={<View style={styles.listBottomSpace} />}
      />
      {!loading && !error && filteredIncidents.length > 0 && <View style={styles.pagination}>
        <TouchableOpacity
          style={[styles.pageButton, page === 0 && styles.disabledPageButton]}
          disabled={page === 0}
          onPress={() => setPage((current) => Math.max(0, current - 1))}
          accessibilityLabel="Previous incident reports"
        >
          <ChevronLeft size={17} color={page === 0 ? colors.gray400 : colors.gray800} />
          <Text style={[styles.pageButtonText, page === 0 && styles.disabledPageText]}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.pageCount}>Page {page + 1} of {pageCount}</Text>
        <TouchableOpacity
          style={[styles.pageButton, page >= pageCount - 1 && styles.disabledPageButton]}
          disabled={page >= pageCount - 1}
          onPress={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
          accessibilityLabel="Next incident reports"
        >
          <Text style={[styles.pageButtonText, page >= pageCount - 1 && styles.disabledPageText]}>Next</Text>
          <ChevronRight size={17} color={page >= pageCount - 1 ? colors.gray400 : colors.gray800} />
        </TouchableOpacity>
      </View>}
      <Modal visible={selected !== null} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}><View style={styles.modal}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>Incident Details</Text><TouchableOpacity onPress={() => setSelected(null)}><X size={22} color={colors.gray500} /></TouchableOpacity></View>
          {selected && <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalReference}>#{selected.referenceNumber}</Text>
            <Detail label="Type" value={selected.typeLabel} /><Detail label="Status" value={selected.status} /><Detail label="Ride" value={`#${selected.rideReference}`} /><Detail label="Rider" value={selected.riderName || 'Unknown rider'} /><Detail label="Driver" value={selected.driverName || 'Unassigned driver'} /><Detail label="Route" value={`${selected.pickupLocation || 'Unknown pickup'} → ${selected.destination || 'Unknown destination'}`} /><Detail label="Reported" value={formatDate(selected.createdAt)} />
            {selected.hasAudio && <TouchableOpacity style={styles.modalAudioButton} onPress={() => { setSelected(null); navigation.navigate('AudioRecordings', { incidentId: selected.id }); }}><Headphones size={17} color={colors.white} /><Text style={styles.audioText}>Open Audio Recording</Text></TouchableOpacity>}
          </ScrollView>}
        </View></View>
      </Modal>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={styles.detail}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: { backgroundColor: colors.white, paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg, zIndex: 2, elevation: 4, borderBottomWidth: 1, borderBottomColor: colors.gray200 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: spacing.sm },
  backText: { color: colors.greenDark, fontFamily: font.semibold, fontSize: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 24 },
  subtitle: { color: colors.gray500, fontFamily: font.regular, fontSize: 12, marginTop: 3 },
  refreshButton: { padding: 10, borderRadius: radius.full, backgroundColor: colors.gray100 },
  searchBox: { height: 46, marginTop: spacing.lg, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gray200, backgroundColor: colors.gray50, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchInput: { flex: 1, minWidth: 0, color: colors.gray900, fontFamily: font.regular, fontSize: 14, paddingVertical: 0, borderWidth: 0, outlineStyle: 'none' as any },
  resultsScroll: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, paddingBottom: 88 },
  listBottomSpace: { height: spacing.sm },
  pagination: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 3, minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, borderTopWidth: 1, borderTopColor: colors.gray200, backgroundColor: colors.white, elevation: 8, shadowColor: colors.black, shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.08, shadowRadius: 4 },
  pageButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200 },
  disabledPageButton: { backgroundColor: colors.gray100, borderColor: colors.gray100 },
  pageButtonText: { color: colors.gray800, fontFamily: font.semibold, fontSize: 12 },
  disabledPageText: { color: colors.gray400 },
  pageCount: { color: colors.gray600, fontFamily: font.medium, fontSize: 12 },
  loader: { marginTop: spacing.xxxl },
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  reference: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 15, marginRight: 2 },
  badge: { backgroundColor: colors.redLight, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 5 },
  badgeText: { color: colors.red, fontFamily: font.bold, fontSize: 10, letterSpacing: 0.2 },
  rideLine: { color: colors.gray700, fontFamily: font.medium, fontSize: 13, marginTop: spacing.sm },
  dot: { color: colors.gray400 },
  routeArrow: { color: colors.gray500 },
  timestamp: { color: colors.gray400, fontFamily: font.regular, fontSize: 12, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  detailsButton: { flex: 1, minHeight: 34, backgroundColor: colors.gray100, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  detailsText: { color: colors.gray800, fontFamily: font.bold, fontSize: 12 },
  audioButton: { flex: 1, minHeight: 34, backgroundColor: colors.blue, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  audioText: { color: colors.white, fontFamily: font.bold, fontSize: 12 },
  state: { alignItems: 'center', padding: spacing.xxxl, marginTop: spacing.xxxl },
  stateTitle: { color: colors.gray900, fontFamily: font.bold, fontSize: 16, marginTop: spacing.md },
  stateText: { color: colors.gray500, fontFamily: font.regular, fontSize: 13, textAlign: 'center', marginTop: spacing.sm },
  retryButton: { backgroundColor: colors.green, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, marginTop: spacing.lg },
  retryText: { color: colors.white, fontFamily: font.bold, fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.45)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 20 },
  modalReference: { color: colors.red, fontFamily: font.extrabold, fontSize: 24, marginBottom: spacing.md },
  detail: { borderTopWidth: 1, borderTopColor: colors.gray200, paddingVertical: spacing.md },
  detailLabel: { color: colors.gray500, fontFamily: font.medium, fontSize: 12, textTransform: 'uppercase' },
  detailValue: { color: colors.gray900, fontFamily: font.semibold, fontSize: 15, marginTop: 4 },
  modalAudioButton: { minHeight: 48, backgroundColor: colors.blue, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: spacing.lg, marginBottom: spacing.sm },
});
