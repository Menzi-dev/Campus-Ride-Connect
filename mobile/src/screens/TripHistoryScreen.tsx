import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, Clock3, MapPin, Star } from 'lucide-react-native';
import { colors, font, radius, spacing } from '../theme/theme';
import apiClient from '../services/ApiClient';
import BottomNav from '../components/BottomNav';

type RootStackParamList = {
  RatingDriver: { rideId: string; driverName?: string; returnToHistory?: boolean };
};

type Ride = {
  id: number | string;
  driverId?: number | null;
  driverName?: string;
  pickupLocation?: string | null;
  destination?: string | null;
  fare?: number | string | null;
  createdAt?: string | null;
  completedAt?: string | null;
  status?: string;
  riderRating?: number | null;
  riderRatingComment?: string | null;
};

const PAGE_SIZE = 5;

export default function TripHistoryScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const response = await apiClient.get('/rides/history');
      const history: Ride[] = Array.isArray(response.data) ? response.data : [];
      setRides(history.filter((ride) => ride.status?.toUpperCase() === 'COMPLETED'));
      setError('');
    } catch {
      setError('Trip history could not be loaded. Pull down to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pageCount = Math.max(1, Math.ceil(rides.length / PAGE_SIZE));
  const visibleRides = rides.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const ratedRides = rides.filter((ride) => isValidRating(ride.riderRating));
  const averageRating = ratedRides.length
    ? (ratedRides.reduce((total, ride) => total + Number(ride.riderRating), 0) / ratedRides.length).toFixed(1)
    : '—';
  const fares = rides
    .filter((ride) => ride.fare != null && ride.fare !== '')
    .map((ride) => Number(ride.fare))
    .filter(Number.isFinite);
  const totalSpent = fares.reduce((total, fare) => total + fare, 0);

  const openRating = (ride: Ride) => {
    const driverName = ride.driverName || (ride.driverId ? `Driver #${ride.driverId}` : undefined);
    navigation.navigate('RatingDriver', {
      rideId: String(ride.id),
      driverName,
      returnToHistory: true,
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.gray50} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setPage(0); load(true); }} tintColor={colors.green} />}
      >
        <View style={styles.headingRow}>
          <View>
            <Text style={styles.eyebrow}>YOUR RIDES</Text>
            <Text style={styles.title}>Trip history</Text>
            <Text style={styles.subtitle}>Completed trips, fares and your ratings.</Text>
          </View>
          <View style={styles.headingIcon}><Clock3 size={22} color={colors.greenDark} /></View>
        </View>

        <View style={styles.summary}>
          <SummaryValue label="COMPLETED" value={rides.length.toString()} />
          <View style={styles.summaryDivider} />
          <SummaryValue label="TOTAL SPENT" value={fares.length ? formatFare(totalSpent) : '—'} />
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
            <TouchableOpacity style={styles.retryButton} onPress={() => load()}>
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
                  <Text style={styles.date}>{formatDate(ride.completedAt || ride.createdAt)}</Text>
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
                  <Text style={styles.routeValue} numberOfLines={2}>{ride.pickupLocation || 'Pickup location unavailable'}</Text>
                  <Text style={[styles.routeLabel, styles.destinationLabel]}>DESTINATION</Text>
                  <Text style={styles.routeValue} numberOfLines={2}>{ride.destination || 'Destination unavailable'}</Text>
                </View>
              </View>

              <View style={styles.tripFooter}>
                <Text style={styles.driver} numberOfLines={1}>
                  {ride.driverName || (ride.driverId ? `Driver #${ride.driverId}` : 'Driver details unavailable')}
                </Text>
                {isValidRating(ride.riderRating) ? (
                  <View style={styles.ratingResult} accessibilityLabel={`Your rating: ${ride.riderRating} out of 5`}>
                    <View style={styles.stars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} size={14} color={star <= Number(ride.riderRating) ? colors.yellow : colors.gray300} fill={star <= Number(ride.riderRating) ? colors.yellow : 'transparent'} />
                      ))}
                    </View>
                    <Text style={styles.ratingNumber}>{ride.riderRating}/5</Text>
                  </View>
                ) : ride.driverId ? (
                  <TouchableOpacity style={styles.rateButton} onPress={() => openRating(ride)}>
                    <Text style={styles.rateButtonText}>Rate ride</Text>
                    <ArrowUpRight size={14} color={colors.greenDark} />
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.notRated}>Not rated</Text>
                )}
              </View>

              {ride.riderRatingComment ? <Text style={styles.comment}>Review: {ride.riderRatingComment}</Text> : null}
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          <TouchableOpacity disabled={page === 0} onPress={() => setPage((value) => Math.max(0, value - 1))} style={[styles.pageButton, page === 0 && styles.disabled]} accessibilityLabel="Previous page">
            <ChevronLeft size={17} color={page === 0 ? colors.gray400 : colors.gray800} />
            <Text style={[styles.pageText, page === 0 && styles.disabledText]}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.pageLabel}>{page + 1} / {pageCount}</Text>
          <TouchableOpacity disabled={page >= pageCount - 1} onPress={() => setPage((value) => Math.min(pageCount - 1, value + 1))} style={[styles.pageButton, page >= pageCount - 1 && styles.disabled]} accessibilityLabel="Next page">
            <Text style={[styles.pageText, page >= pageCount - 1 && styles.disabledText]}>Next</Text>
            <ChevronRight size={17} color={page >= pageCount - 1 ? colors.gray400 : colors.gray800} />
          </TouchableOpacity>
        </View>
        <BottomNav active="RiderHistory" />
      </View>
    </View>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryValue}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{value}</Text>
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
  container: { flex: 1, minHeight: 0, backgroundColor: colors.gray50 },
  scroll: { flex: 1, minHeight: 0 },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: 132 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  eyebrow: { color: colors.greenDark, fontFamily: font.bold, fontSize: 10, marginBottom: 5 },
  title: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 23 },
  subtitle: { color: colors.gray500, fontFamily: font.medium, fontSize: 11, marginTop: 3 },
  headingIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, marginBottom: spacing.md },
  summaryValue: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 2 },
  summaryLabel: { color: colors.gray500, fontFamily: font.bold, fontSize: 8 },
  summaryNumber: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 14, marginTop: 3 },
  summaryDivider: { width: 1, height: 26, backgroundColor: colors.gray200 },
  listHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.xs },
  listTitle: { color: colors.gray900, fontFamily: font.bold, fontSize: 15 },
  listCount: { color: colors.gray500, fontFamily: font.medium, fontSize: 11 },
  tripCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.xs },
  tripTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  dateWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  date: { color: colors.gray500, fontFamily: font.medium, fontSize: 11 },
  fare: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 14, marginLeft: spacing.sm },
  routeBlock: { flexDirection: 'row' },
  routeTrack: { width: 18, alignItems: 'center', paddingTop: 3, paddingBottom: 3 },
  pickupDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.green, zIndex: 1 },
  routeStem: { width: 1, flex: 1, backgroundColor: colors.gray300 },
  destinationDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gray800, zIndex: 1 },
  routeDetails: { flex: 1, paddingLeft: spacing.sm },
  routeLabel: { color: colors.gray400, fontFamily: font.bold, fontSize: 7, marginBottom: 2 },
  destinationLabel: { marginTop: spacing.xs },
  routeValue: { color: colors.gray900, fontFamily: font.semibold, fontSize: 12, lineHeight: 16 },
  tripFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.gray100, marginTop: spacing.xs, paddingTop: spacing.xs },
  driver: { color: colors.gray500, fontFamily: font.medium, fontSize: 10, flex: 1, marginRight: spacing.sm },
  ratingResult: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  ratingNumber: { color: colors.gray700, fontFamily: font.bold, fontSize: 10 },
  rateButton: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 5, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.greenLight },
  rateButtonText: { color: colors.greenDark, fontFamily: font.bold, fontSize: 10 },
  notRated: { color: colors.gray400, fontFamily: font.medium, fontSize: 10 },
  comment: { color: colors.gray600, fontFamily: font.regular, fontSize: 10, lineHeight: 14, marginTop: spacing.xs },
  loader: { marginTop: spacing.xxxl },
  stateBox: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xxxl, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gray200 },
  emptyIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.gray100, marginBottom: spacing.sm },
  emptyTitle: { color: colors.gray900, fontFamily: font.bold, fontSize: 14, marginBottom: 5 },
  stateText: { color: colors.gray500, fontFamily: font.medium, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  retryButton: { marginTop: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, backgroundColor: colors.green, borderRadius: radius.sm },
  retryText: { color: colors.white, fontFamily: font.bold, fontSize: 12 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.white, zIndex: 5 },
  pagination: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.gray200 },
  pageButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.gray100 },
  disabled: { backgroundColor: colors.gray50 },
  pageText: { color: colors.gray800, fontFamily: font.bold, fontSize: 11 },
  disabledText: { color: colors.gray400 },
  pageLabel: { color: colors.gray600, fontFamily: font.semibold, fontSize: 11 },
});