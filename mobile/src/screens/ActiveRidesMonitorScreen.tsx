import useMapResize from '../hooks/useMapResize';
import { useToast } from '../components/Toast';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Crosshair, Phone, Radio, TriangleAlert } from 'lucide-react-native';
import apiClient from '../services/ApiClient';
import { colors, font, radius, spacing, shadow } from '../theme/theme';
import { SecurityNav } from './SecurityCentreDashboardScreen';

type RootStackParamList = { SecurityDashboard: undefined; ActiveRidesMonitor: undefined; SosAlerts: undefined };
type Coordinate = { latitude: number; longitude: number };
type Ride = { id: number; riderName?: string; driverName?: string; driverPhone?: string; pickupLocation?: string; destination?: string; pickupLat?: number; pickupLng?: number; destLat?: number; destLng?: number; currentLat?: number; currentLng?: number; status: string; sos?: { status: string; gpsLat?: number; gpsLng?: number } | null };

let LeafletMap: any;
let LeafletTileLayer: any;
let LeafletPolyline: any;
let LeafletMarker: any;
let LeafletPopup: any;
let LeafletZoomControl: any;
let LeafletUseMap: any;
let leaflet: any;
if (Platform.OS === 'web') {
  try {
    leaflet = require('leaflet');
    require('leaflet/dist/leaflet.css');
    const reactLeaflet = require('react-leaflet');
    LeafletMap = reactLeaflet.MapContainer;
    LeafletTileLayer = reactLeaflet.TileLayer;
    LeafletPolyline = reactLeaflet.Polyline;
    LeafletMarker = reactLeaflet.Marker;
    LeafletPopup = reactLeaflet.Popup;
    LeafletZoomControl = reactLeaflet.ZoomControl;
    LeafletUseMap = reactLeaflet.useMap;
  } catch {
    LeafletMap = null;
  }
}

function SecurityMapUpdater({ points }: { points: Coordinate[] }) {
  if (!LeafletUseMap) return null;
  const map = LeafletUseMap();
  useMapResize(map);
  useEffect(() => {
    if (!map || !points.length) return;
    const bounds = leaflet.latLngBounds(points.map((point) => [point.latitude, point.longitude]));
    map.invalidateSize();
    map.fitBounds(bounds, { padding: [35, 35], maxZoom: 16 });
  }, [map, points]);
  return null;
}

async function getRoute(start: Coordinate, end: Coordinate): Promise<Coordinate[]> {
  const url = `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Route unavailable');
  const data = await response.json();
  return (data.routes?.[0]?.geometry?.coordinates || []).map(([longitude, latitude]: number[]) => ({ latitude, longitude }));
}

function interpolateRoute(route: Coordinate[], progress: number): Coordinate {
  return route[Math.min(route.length - 1, Math.floor(progress * route.length))] || route[0];
}

function getRouteHeading(position: Coordinate, route: Coordinate[]): number {
  if (route.length < 2) return 0;
  const nearestIndex = route.reduce((best, point, index) => {
    const distance = Math.abs(point.latitude - position.latitude) + Math.abs(point.longitude - position.longitude);
    const bestDistance = Math.abs(route[best].latitude - position.latitude) + Math.abs(route[best].longitude - position.longitude);
    return distance < bestDistance ? index : best;
  }, 0);
  const next = route[Math.min(nearestIndex + 1, route.length - 1)];
  return (Math.atan2(next.longitude - position.longitude, next.latitude - position.latitude) * 180) / Math.PI;
}

function LiveRideLayer({ ride, icons }: { ride: Ride; icons: any }) {
  const start = { latitude: Number(ride.pickupLat), longitude: Number(ride.pickupLng) };
  const end = Number.isFinite(ride.destLat) && Number.isFinite(ride.destLng)
    ? { latitude: Number(ride.destLat), longitude: Number(ride.destLng) }
    : start;
  const livePosition = Number.isFinite(ride.currentLat) && Number.isFinite(ride.currentLng)
    ? { latitude: Number(ride.currentLat), longitude: Number(ride.currentLng) }
    : null;
  const [route, setRoute] = useState<Coordinate[]>([start, end]);
  const [progress, setProgress] = useState(0.08);
  const [displayPosition, setDisplayPosition] = useState<Coordinate | null>(livePosition);
  const previousPositionRef = React.useRef<Coordinate | null>(livePosition);
  const positionAnimationRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    let cancelled = false;
    getRoute(start, end).then((points) => { if (!cancelled && points.length > 1) setRoute(points); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [ride.id, ride.pickupLat, ride.pickupLng, ride.destLat, ride.destLng]);
  useEffect(() => {
    if (livePosition || !['ACCEPTED', 'ENROUTE', 'STARTED'].includes(String(ride.status).toUpperCase()) || route.length < 2) return;
    const timer = setInterval(() => setProgress((value) => value >= 1 ? 0 : Math.min(1, value + 0.0125)), 500);
    return () => clearInterval(timer);
  }, [ride.status, route.length, livePosition]);
  useEffect(() => {
    if (!livePosition) return;
    if (positionAnimationRef.current) clearInterval(positionAnimationRef.current);
    const from = previousPositionRef.current || livePosition;
    const startedAt = Date.now();
    positionAnimationRef.current = setInterval(() => {
      const progressValue = Math.min(1, (Date.now() - startedAt) / 500);
      setDisplayPosition({
        latitude: from.latitude + (livePosition.latitude - from.latitude) * progressValue,
        longitude: from.longitude + (livePosition.longitude - from.longitude) * progressValue,
      });
      if (progressValue >= 1 && positionAnimationRef.current) {
        clearInterval(positionAnimationRef.current);
        positionAnimationRef.current = null;
        previousPositionRef.current = livePosition;
      }
    }, 40);
    return () => { if (positionAnimationRef.current) clearInterval(positionAnimationRef.current); };
  }, [ride.currentLat, ride.currentLng]);
  const position = displayPosition || livePosition || interpolateRoute(route, progress);
  const heading = getRouteHeading(position, route);
  const vehicleIcon = useMemo(() => leaflet?.divIcon({
    className: 'driver-car-marker',
    html: `<div style="width:38px;height:38px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 3px rgba(15,23,42,.4));transform:rotate(${heading}deg)"><svg viewBox="0 0 80 120" width="38" height="38" role="img" aria-label="Campus ride vehicle"><defs><linearGradient id="securityCarBody${ride.id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cbd5db"/><stop offset=".2" stop-color="#fff"/><stop offset=".8" stop-color="#f8fafc"/><stop offset="1" stop-color="#b8c2c9"/></linearGradient><linearGradient id="securityCarGlass${ride.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b5563"/><stop offset="1" stop-color="#111827"/></linearGradient></defs><ellipse cx="40" cy="61" rx="25" ry="55" fill="rgba(15,23,42,.2)"/><path d="M40 3c13 0 22 13 25 29l7 54c2 16-7 29-20 31H28c-13-2-22-15-20-31l7-54C18 16 27 3 40 3Z" fill="url(#securityCarBody${ride.id})" stroke="#94a3ad" stroke-width="1.5"/><path d="M27 21c3-9 8-13 13-13s10 4 13 13l5 27H22l5-27Z" fill="url(#securityCarGlass${ride.id})" stroke="#7c8790" stroke-width="1.2"/><path d="M22 53h36v30H22Z" fill="#f8fafc"/><path d="M22 61h36v22H22Z" fill="#16a34a" opacity=".9"/><path d="M25 64h13v16H25Zm17 0h13v16H42Z" fill="#22c55e" opacity=".55"/><path d="M18 34h7M55 34h7M15 91h8M57 91h8" stroke="#aab4bb" stroke-width="2" stroke-linecap="round"/><path d="M21 99c2 10 8 15 19 15s17-5 19-15" fill="#e2e8ec" stroke="#a3afb7" stroke-width="1"/><path d="M28 107h24" stroke="#64727b" stroke-width="1.5" stroke-linecap="round"/></svg></div>`,
    iconSize: [38, 38], iconAnchor: [19, 19],
  }), [heading, ride.id]);
  return <><LeafletPolyline positions={route.map((point) => [point.latitude, point.longitude])} pathOptions={{ color: colors.blue, weight: 6, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }} /><LeafletMarker position={[position.latitude, position.longitude]} icon={vehicleIcon}><LeafletPopup>Live vehicle for ride #R-{ride.id}</LeafletPopup></LeafletMarker><LeafletMarker position={[end.latitude, end.longitude]} icon={icons.destination}><LeafletPopup>{ride.destination || 'Destination'}</LeafletPopup></LeafletMarker></>;
}

function SecurityLiveMap({ rides }: { rides: Ride[] }) {
  const mapRides = rides.filter((ride) => Number.isFinite(ride.pickupLat) && Number.isFinite(ride.pickupLng));
  const points = mapRides.flatMap((ride) => {
    const start = { latitude: Number(ride.pickupLat), longitude: Number(ride.pickupLng) };
    const destination = Number.isFinite(ride.destLat) && Number.isFinite(ride.destLng)
      ? { latitude: Number(ride.destLat), longitude: Number(ride.destLng) }
      : null;
    const sos = ride.sos && Number.isFinite(ride.sos.gpsLat) && Number.isFinite(ride.sos.gpsLng)
      ? { latitude: Number(ride.sos.gpsLat), longitude: Number(ride.sos.gpsLng) }
      : null;
    return [start, ...(destination ? [destination] : []), ...(sos ? [sos] : [])];
  });
  const center = points[0];
  const icons = useMemo(() => {
    if (!leaflet) return {};
    const vehicle = leaflet.divIcon({ className: 'security-vehicle-marker', html: '<span>●</span>', iconSize: [30, 30], iconAnchor: [15, 15] });
    const destination = leaflet.divIcon({ className: 'security-destination-marker', html: '<span></span>', iconSize: [18, 18], iconAnchor: [9, 9] });
    const sos = leaflet.divIcon({ className: 'security-sos-marker', html: '<span>!</span>', iconSize: [24, 24], iconAnchor: [12, 12] });
    return { vehicle, destination, sos };
  }, []);
  if (Platform.OS !== 'web' || !LeafletMap || !center) {
    return <View style={styles.mapFallback}><Radio size={28} color={colors.green} /><Text style={styles.mapText}>{rides.length ? 'Waiting for ride coordinates' : 'No active rides to track'}</Text></View>;
  }
  return <View style={styles.map}><View style={styles.live}><Radio size={13} color={colors.greenDark} /><Text style={styles.liveText}>LIVE TRACKING</Text></View><LeafletMap center={[center.latitude, center.longitude]} zoom={15} zoomControl={false} attributionControl={false} style={styles.leafletMap}>
    <LeafletTileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
    <SecurityMapUpdater points={points} />
    <LeafletZoomControl position="topright" />
    {mapRides.map((ride) => {
      const start = { latitude: Number(ride.pickupLat), longitude: Number(ride.pickupLng) };
      const destination = Number.isFinite(ride.destLat) && Number.isFinite(ride.destLng) ? { latitude: Number(ride.destLat), longitude: Number(ride.destLng) } : null;
      const sos = ride.sos && Number.isFinite(ride.sos.gpsLat) && Number.isFinite(ride.sos.gpsLng) ? { latitude: Number(ride.sos.gpsLat), longitude: Number(ride.sos.gpsLng) } : null;
      return <React.Fragment key={ride.id}><LiveRideLayer ride={ride} icons={icons} />{sos && <LeafletMarker position={[sos.latitude, sos.longitude]} icon={icons.sos}><LeafletPopup>SOS location for ride #R-{ride.id}</LeafletPopup></LeafletMarker>}</React.Fragment>;
    })}
  </LeafletMap></View>;
}

export default function ActiveRidesMonitorScreen() {
  const { showToast } = useToast();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>(); const [rides, setRides] = useState<Ride[]>([]); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState('');
  const load = useCallback(async (refresh = false) => { refresh ? setRefreshing(true) : setLoading(true); try { const response = await apiClient.get('/security/rides'); setRides(response.data || []); setError(''); } catch (err: any) { setError(err?.response?.data?.error || 'Could not load active rides. Try again.'); } finally { setLoading(false); setRefreshing(false); } }, []);
  useFocusEffect(useCallback(() => { load(); const timer = setInterval(() => load(true), 2000); return () => clearInterval(timer); }, [load]));
  const contact = () => { const phone = rides.find((ride) => ride.driverPhone)?.driverPhone?.replace(/[^\d+]/g, ''); if (!phone) { showToast('No driver phone number is available for the active rides.', 'blue'); return; } Linking.openURL(`tel:${phone}`).catch(() => showToast(`Could not open the phone app. Call ${phone} directly.`, 'red')); };
  return <View style={styles.container}><View style={styles.fixedHeader}><Text style={styles.title}>Active Rides Monitor</Text></View><ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.green} />} contentContainerStyle={styles.content}><SecurityLiveMap rides={rides} /><View style={styles.mapActions}><TouchableOpacity style={styles.primary} disabled={refreshing || loading} onPress={() => load(true)}><Crosshair size={16} color={colors.white} /><Text style={styles.primaryText}>Center Map</Text></TouchableOpacity><TouchableOpacity style={styles.secondary} onPress={contact}><Phone size={16} color={colors.gray800} /><Text style={styles.secondaryText}>Contact</Text></TouchableOpacity></View>{error ? <View style={styles.empty}><Text accessibilityRole="alert" style={styles.emptyText}>{error}</Text><TouchableOpacity onPress={() => load(true)} disabled={refreshing}><Text style={styles.emptyText}>Try again</Text></TouchableOpacity></View> : null}{loading ? <ActivityIndicator size="large" color={colors.green} /> : rides.map((ride) => <View style={styles.card} key={ride.id}><View style={styles.row}><Text style={styles.id}>#R-{ride.id}</Text>{ride.sos && <Text style={styles.sos}>SOS</Text>}<Text style={styles.status}>{ride.status}</Text></View><Text style={styles.names}>{ride.riderName || 'Unknown rider'} → {ride.driverName || 'Unassigned driver'}</Text><Text style={styles.route}>{ride.pickupLocation || 'Pickup'} → {ride.destination || 'Destination'}</Text><Text style={styles.coordinates}>{ride.pickupLat ?? '-'}, {ride.pickupLng ?? '-'}</Text></View>)}{!loading && !error && !rides.length && <View style={styles.empty}><TriangleAlert size={24} color={colors.gray400} /><Text style={styles.emptyText}>No active rides right now</Text></View>}</ScrollView><SecurityNav active="rides" onDashboard={() => navigation.navigate('SecurityDashboard')} onRides={() => navigation.navigate('ActiveRidesMonitor')} onAlerts={() => navigation.navigate('SosAlerts')} /></View>;
}
const styles = StyleSheet.create({ container: { flex: 1, minWidth: 0, minHeight: 0, backgroundColor: colors.gray50 }, fixedHeader: { backgroundColor: colors.gray50, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm, zIndex: 2 }, scrollArea: { flex: 1 }, content: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg }, title: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 22 }, map: { height: 230, borderRadius: radius.lg, overflow: 'hidden', ...shadow.sm }, leafletMap: { height: '100%', width: '100%' }, mapFallback: { height: 230, backgroundColor: colors.greenLight, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: 8 }, live: { position: 'absolute', top: 12, left: 12, zIndex: 1000, backgroundColor: colors.white, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', gap: 4 }, liveText: { color: colors.greenDark, fontFamily: font.bold, fontSize: 10 }, mapText: { color: colors.greenDark, fontFamily: font.bold }, mapActions: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md }, primary: { flex: 1, backgroundColor: colors.blue, borderRadius: radius.full, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, primaryText: { color: colors.white, fontFamily: font.bold, fontSize: 12 }, secondary: { flex: 1, backgroundColor: colors.white, borderRadius: radius.full, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.gray200 }, secondaryText: { color: colors.gray800, fontFamily: font.bold, fontSize: 12 }, card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm }, row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, id: { color: colors.gray900, fontFamily: font.bold, fontSize: 14 }, sos: { color: colors.red, backgroundColor: colors.redLight, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, fontFamily: font.bold, fontSize: 10 }, status: { color: colors.gray400, fontFamily: font.mono, fontSize: 10, marginLeft: 'auto' }, names: { color: colors.gray900, fontFamily: font.bold, fontSize: 14, marginTop: spacing.sm }, route: { color: colors.gray500, fontFamily: font.regular, fontSize: 11, marginTop: 4 }, coordinates: { color: colors.gray400, fontFamily: font.mono, fontSize: 10, marginTop: spacing.sm }, empty: { alignItems: 'center', padding: spacing.xxxl }, emptyText: { color: colors.gray500, fontFamily: font.medium, marginTop: spacing.sm } });