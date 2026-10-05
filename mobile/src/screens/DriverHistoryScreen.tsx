import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, Clock3, MapPin, Star } from 'lucide-react-native';
import apiClient from '../services/ApiClient';
import DriverBottomNav from '../components/DriverBottomNav';
import { colors, font, radius, spacing } from '../theme/theme';

type Ride = {
  id: number | string;
  pickup?: string | null;
  destination?: string | null;
  fare?: number | string | null;
  completedAt?: string | null;
  riderName?: string | null;
  riderRating?: number | null;
  riderRatingComment?: string | null;
  driverRating?: number | null;
  driverRatingComment?: string | null;
};

const PAGE_SIZE = 5;

export default function DriverHistoryScreen() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    try {
      const response = await apiClient.get('/driver/history');
      setRides(Array.isArray(response.data) ? response.data : []);
      setError('');
    } catch {
      setError('Ride history could not be loaded. Pull down to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const pageCount = Math.max(1, Math.ceil(rides.length / PAGE_SIZE));
  const visibleRides = rides.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const ratedRides = rides.filter((ride) => isValidRating(ride.riderRating));
  const averageRating = ratedRides.length
    ? (ratedRides.reduce((total, ride) => total + Number(ride.riderRating), 0) / ratedRides.length).toFixed(1)
    : '—';
  const fares = rides.map((ride) => Number(ride.fare)).filter(Number.isFinite);
  const totalEarned = fares.reduce((total, fare) => total + fare, 0);

  const refresh = () => {
    setPage(0);
    setRefreshing(true);
    void load();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.gray50} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.green} />}
      >
        <View style={styles.headingRow}>
          <View>
            <Text style={styles.eyebrow}>YOUR WORK</Text>
            <Text style={styles.title}>Ride history</Text>
            <Text style={styles.subtitle}>Completed trips, earnings and rider ratings.</Text>
          </View>
          <View style={styles.headingIcon}><Clock3 size={22} color={colors.greenDark} /></View>
        </View>

        <View style={styles.summary}>
          <SummaryValue label="COMPLETED" value={rides.length.toString()} />
          <View style={styles.summaryDivider} />
          <SummaryValue label="TOTAL EARNED" value={fares.length ? formatFare(totalEarned) : '—'} />
          <View style={styles.summaryDivider} />
          <SummaryValue label="AVG. RATING" value={averageRating} />
        </View>

        <View style={styles.listHeading}>
          <Text style={styles.listTitle}>Recent trips</Text>
          <Text style={styles.listCount}>{rides.length} total</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.green} style={styles.loader} />
        ) : error ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); void load(); }}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : visibleRides.length === 0 ? (
          <View style={styles.stateBox}>
            <View style={styles.emptyIcon}><MapPin size={22} color={colors.gray500} /></View>
            <Text style={styles.emptyTitle}>No completed trips yet</Text>
            <Text style={styles.stateText}>Your completed rides will appear here.</Text>
          </View>
        ) : (
          visibleRides.map((ride) => (
            <View style={styles.tripCard} key={ride.id}>
              <View style={styles.tripTop}>
                <View style={styles.dateWrap}>
                  <Clock3 size={14} color={colors.gray500} />
                  <Text style={styles.date}>{formatDate(ride.completedAt)}</Text>
                </View>
                <Text style={styles.fare}>{formatFare(ride.fare)}</Text>
              </View>

              <View style={styles.routeBlock}>
                <View style={styles.routeTrack}>
                  <View style={styles.pickupDot} />
                  <View style={styles.routeStem} />
                  <View style={styles.destinationDot} />
                </View>
                <View style={styles.routeDetails}>
                  <Text style={styles.routeLabel}>PICKUP</Text>
                  <Text style={styles.routeValue} numberOfLines={2}>{ride.pickup || 'Pickup location unavailable'}</Text>
                  <Text style={[styles.routeLabel, styles.destinationLabel]}>DESTINATION</Text>
                  <Text style={styles.routeValue} numberOfLines={2}>{ride.destination || 'Destination unavailable'}</Text>
                </View>
              </View>

              <View style={styles.tripFooter}>
                <Text style={styles.rider} numberOfLines={1}>{ride.riderName || 'Rider details unavailable'}</Text>
                <View style={styles.ratings}>
                  <TripRating label="RIDER" value={ride.riderRating} />
                  <TripRating label="YOU" value={ride.driverRating} />
                </View>
              </View>
              {ride.riderRatingComment ? <Text style={styles.comment}>Rider review: {ride.riderRatingComment}</Text> : null}
              {ride.driverRatingComment ? <Text style={styles.comment}>Your review: {ride.driverRatingComment}</Text> : null}
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          <TouchableOpacity disabled={page === 0} onPress={() => setPage((value) => Math.max(0, value - 1))} style={[styles.pageButton, page === 0 && styles.disabled]} accessibilityLabel="Previous page">
            <ChevronLeft size={17} color={page === 0 ? colors.gray400 : colors.gray800} />
            <Text style={[styles.pageText, page === 0 && styles.disabledText]}>Previous</Text>
          </TouchableOpacity>
          <Text style={styles.pageLabel}>{page + 1} / {pageCount}</Text>
          <TouchableOpacity disabled={page >= pageCount - 1} onPress={() => setPage((value) => Math.min(pageCount - 1, value + 1))} style={[styles.pageButton, page >= pageCount - 1 && styles.disabled]} accessibilityLabel="Next page">
            <Text style={[styles.pageText, page >= pageCount - 1 && styles.disabledText]}>Next</Text>
            <ChevronRight size={17} color={page >= pageCount - 1 ? colors.gray400 : colors.gray800} />
          </TouchableOpacity>
        </View>
        <DriverBottomNav active="DriverHistory" />
      </View>
    </View>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryValue}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{value}</Text>
    </View>
  );
}

function TripRating({ label, value }: { label: string; value?: number | null }) {
  return (
    <View style={styles.tripRating}>
      <Text style={styles.tripRatingLabel}>{label}</Text>
      {isValidRating(value) ? (
        <View style={styles.stars} accessibilityLabel={`${label.toLowerCase()} rating ${value} out of 5`}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Star key={star} size={10} color={star <= Number(value) ? colors.yellow : colors.gray300} fill={star <= Number(value) ? colors.yellow : 'transparent'} />
          ))}
          <Text style={styles.ratingNumber}>{value}/5</Text>
        </View>
      ) : <Text style={styles.notRated}>Not rated</Text>}
    </View>
  );
}

function isValidRating(value?: number | null) {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5;
}

function formatDate(value?: string | null) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleString('en-ZA', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatFare(value?: number | string | null) {
  if (value == null || value === '') return 'Fare unavailable';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Fare unavailable';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2 }).format(amount);
}

const styles = StyleSheet.create({
  container: { flex: 1, minWidth: 0, minHeight: 0, backgroundColor: colors.gray50 },
  scroll: { flex: 1, minHeight: 0 },
  content: { paddingHorizontal: spacing.md, paddingTop: 10, paddingBottom: spacing.lg },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  eyebrow: { color: colors.greenDark, fontFamily: font.bold, fontSize: 9, marginBottom: 3 },
  title: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 21 },
  subtitle: { color: colors.gray500, fontFamily: font.medium, fontSize: 10, marginTop: 2 },
  headingIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.md, paddingVertical: 5, paddingHorizontal: spacing.xs, marginBottom: 10 },
  summaryValue: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 2 },
  summaryLabel: { color: colors.gray500, fontFamily: font.bold, fontSize: 8 },
  summaryNumber: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 13, marginTop: 2 },
  summaryDivider: { width: 1, height: 22, backgroundColor: colors.gray200 },
  listHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 3 },
  listTitle: { color: colors.gray900, fontFamily: font.bold, fontSize: 14 },
  listCount: { color: colors.gray500, fontFamily: font.medium, fontSize: 10 },
  tripCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.md, paddingHorizontal: 7, paddingVertical: 5, marginBottom: 4 },
  tripTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  dateWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  date: { color: colors.gray500, fontFamily: font.medium, fontSize: 9 },
  fare: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 12, marginLeft: spacing.sm },
  routeBlock: { flexDirection: 'row' },
  routeTrack: { width: 16, alignItems: 'center', paddingTop: 2, paddingBottom: 2 },
  pickupDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green, zIndex: 1 },
  routeStem: { width: 1, flex: 1, backgroundColor: colors.gray300 },
  destinationDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.gray800, zIndex: 1 },
  routeDetails: { flex: 1, paddingLeft: 6 },
  routeLabel: { color: colors.gray400, fontFamily: font.bold, fontSize: 7, marginBottom: 1 },
  destinationLabel: { marginTop: 3 },
  routeValue: { color: colors.gray900, fontFamily: font.semibold, fontSize: 11, lineHeight: 14 },
  tripFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.gray100, marginTop: 3, paddingTop: 3, gap: 6 },
  rider: { color: colors.gray500, fontFamily: font.medium, fontSize: 9, flex: 1 },
  ratings: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tripRating: { alignItems: 'flex-end' },
  tripRatingLabel: { color: colors.gray400, fontFamily: font.bold, fontSize: 7, marginBottom: 1 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  ratingNumber: { color: colors.gray700, fontFamily: font.bold, fontSize: 8, marginLeft: 2 },
  notRated: { color: colors.gray400, fontFamily: font.medium, fontSize: 8 },
  comment: { color: colors.gray600, fontFamily: font.regular, fontSize: 9, lineHeight: 12, marginTop: 3 },
  loader: { marginTop: spacing.xxxl },
  stateBox: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xxxl, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gray200 },
  emptyIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.gray100, marginBottom: spacing.sm },
  emptyTitle: { color: colors.gray900, fontFamily: font.bold, fontSize: 14, marginBottom: 5 },
  stateText: { color: colors.gray500, fontFamily: font.medium, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  retryButton: { marginTop: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, backgroundColor: colors.green, borderRadius: radius.sm },
  retryText: { color: colors.white, fontFamily: font.bold, fontSize: 12 },
  footer: { flexShrink: 0, backgroundColor: colors.white },
  pagination: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.gray200 },
  pageButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.gray100 },
  disabled: { backgroundColor: colors.gray50 },
  pageText: { color: colors.gray800, fontFamily: font.bold, fontSize: 11 },
  disabledText: { color: colors.gray400 },
  pageLabel: { color: colors.gray600, fontFamily: font.semibold, fontSize: 11 },
});
