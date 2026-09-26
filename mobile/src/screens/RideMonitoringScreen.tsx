import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowLeft, ChevronLeft, ChevronRight, Crosshair, MapPin, Radio, TriangleAlert } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import apiClient from '../services/ApiClient';
import { colors, font, radius, shadow, spacing } from '../theme/theme';

type RootStackParamList = { AdminDashboard: undefined; RideMonitoring: undefined };
type Coordinate = { latitude: number; longitude: number };
type Sos = { id: number; status: string; gpsLat?: number; gpsLng?: number };
type ActiveRide = {
	id: number;
	status: string;
	pickupLocation?: string;
	destination?: string;
	pickupLat?: number;
	pickupLng?: number;
	destLat?: number;
	destLng?: number;
	riderName?: string;
	driverName?: string;
	sos?: Sos | null;
};

const CAMPUS: Coordinate = { latitude: -28.7588, longitude: 24.7597 };
const RIDES_PER_PAGE = 4;
let MapContainer: any;
let TileLayer: any;
let Polyline: any;
let Marker: any;
let ZoomControl: any;
let useMap: any;
let leaflet: any;
if (Platform.OS === 'web') {
	try {
		leaflet = require('leaflet');
		require('leaflet/dist/leaflet.css');
		const reactLeaflet = require('react-leaflet');
		MapContainer = reactLeaflet.MapContainer;
		TileLayer = reactLeaflet.TileLayer;
		Polyline = reactLeaflet.Polyline;
		Marker = reactLeaflet.Marker;
		ZoomControl = reactLeaflet.ZoomControl;
		useMap = reactLeaflet.useMap;
	} catch {
		MapContainer = null;
	}
}

function MonitoringMapUpdater({ points }: { points: Coordinate[] }) {
	if (!useMap) return null;
	const map = useMap();
	useEffect(() => {
		if (!map || points.length < 2) return;
		const frame = window.setTimeout(() => {
			const bounds = leaflet.latLngBounds(points.map((point) => [point.latitude, point.longitude]));
			map.invalidateSize();
			map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
		}, 150);
		return () => window.clearTimeout(frame);
	}, [map, points]);
	return null;
}

function getRouteHeading(position: Coordinate, routePoints: Coordinate[]): number {
	if (routePoints.length < 2) return 0;
	let nearestIndex = 0;
	let nearestDistance = Number.POSITIVE_INFINITY;
	routePoints.forEach((point, index) => {
		const distance = Math.abs(point.latitude - position.latitude) + Math.abs(point.longitude - position.longitude);
		if (distance < nearestDistance) {
			nearestDistance = distance;
			nearestIndex = index;
		}
	});
	const nextPoint = routePoints[Math.min(nearestIndex + 1, routePoints.length - 1)];
	const latitudeDelta = nextPoint.latitude - position.latitude;
	const longitudeDelta = nextPoint.longitude - position.longitude;
	return (Math.atan2(longitudeDelta, latitudeDelta) * 180) / Math.PI;
}

function createLocationPinIcon(color: string, size: number = 28) {
	if (typeof window === 'undefined' || !MapContainer) return null;
	const pinHeight = Math.round(size * 1.35);
	try {
		const L = require('leaflet');
		return L.divIcon({
			className: 'location-pin-marker',
			html: `<div style="width:${size}px;height:${pinHeight}px;position:relative;filter:drop-shadow(0 2px 2px rgba(15,23,42,.4))">
				<svg viewBox="0 0 40 54" width="${size}" height="${pinHeight}" aria-label="Location marker">
					<ellipse cx="20" cy="51" rx="13" ry="2.5" fill="rgba(15,23,42,.35)"/>
					<path d="M20 2C10.1 2 2 10.1 2 20c0 13.1 18 30 18 30s18-16.9 18-30C38 10.1 29.9 2 20 2Z" fill="${color}" stroke="#fff" stroke-width="2"/>
					<circle cx="20" cy="20" r="6.5" fill="#fff"/>
				</svg>
			</div>`,
			iconSize: [size, pinHeight],
			iconAnchor: [size / 2, pinHeight],
		});
	} catch {
		return null;
	}
}

function createDriverCarIcon(heading: number) {
	if (typeof window === 'undefined' || !MapContainer) return null;
	try {
		const L = require('leaflet');
		return L.divIcon({
			className: 'driver-car-marker',
			html: `<div style="width:38px;height:38px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 3px rgba(15,23,42,.4));transform:rotate(${heading}deg)">
				<svg viewBox="0 0 80 120" width="38" height="38" role="img" aria-label="Campus ride vehicle">
					<defs><linearGradient id="topCarBody" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cbd5db"/><stop offset=".2" stop-color="#fff"/><stop offset=".8" stop-color="#f8fafc"/><stop offset="1" stop-color="#b8c2c9"/></linearGradient><linearGradient id="topCarGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b5563"/><stop offset="1" stop-color="#111827"/></linearGradient></defs>
					<ellipse cx="40" cy="61" rx="25" ry="55" fill="rgba(15,23,42,.2)"/>
					<path d="M40 3c13 0 22 13 25 29l7 54c2 16-7 29-20 31H28c-13-2-22-15-20-31l7-54C18 16 27 3 40 3Z" fill="url(#topCarBody)" stroke="#94a3ad" stroke-width="1.5"/>
					<path d="M27 21c3-9 8-13 13-13s10 4 13 13l5 27H22l5-27Z" fill="url(#topCarGlass)" stroke="#7c8790" stroke-width="1.2"/>
					<path d="M22 53h36v30H22Z" fill="#f8fafc"/><path d="M22 61h36v22H22Z" fill="#16a34a" opacity=".9"/>
					<path d="M25 64h13v16H25Zm17 0h13v16H42Z" fill="#22c55e" opacity=".55"/>
					<path d="M18 34h7M55 34h7M15 91h8M57 91h8" stroke="#aab4bb" stroke-width="2" stroke-linecap="round"/>
					<path d="M21 99c2 10 8 15 19 15s17-5 19-15" fill="#e2e8ec" stroke="#a3afb7" stroke-width="1"/>
					<path d="M28 107h24" stroke="#64727b" stroke-width="1.5" stroke-linecap="round"/>
				</svg>
			</div>`,
			iconSize: [38, 38],
			iconAnchor: [19, 19],
		});
	} catch {
		return null;
	}
}

function MonitoringMap({ ride, rides }: { ride: ActiveRide | null; rides: ActiveRide[] }) {
	const start = { latitude: ride?.pickupLat ?? CAMPUS.latitude, longitude: ride?.pickupLng ?? CAMPUS.longitude };
	const end = { latitude: ride?.destLat ?? CAMPUS.latitude + 0.004, longitude: ride?.destLng ?? CAMPUS.longitude + 0.004 };
	const [routePoints, setRoutePoints] = useState<Coordinate[]>([start, end]);
	const [carPosition, setCarPosition] = useState<Coordinate>(start);
	const [carProgress, setCarProgress] = useState(0);

	useEffect(() => {
		let cancelled = false;
		const loadRoute = async () => {
			if (!ride?.pickupLat || !ride.pickupLng || !ride.destLat || !ride.destLng) {
				setRoutePoints([start, end]);
				setCarPosition(start);
				setCarProgress(0);
				return;
			}
			try {
				const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`);
				const data = await response.json();
				const points = (data.routes?.[0]?.geometry?.coordinates || []).map(([longitude, latitude]: number[]) => ({ latitude, longitude }));
				if (!cancelled) {
					const nextPoints = points.length > 1 ? points : [start, end];
					setRoutePoints(nextPoints);
					setCarPosition(nextPoints[0]);
					setCarProgress(0);
				}
			} catch {
				if (!cancelled) {
					setRoutePoints([start, end]);
					setCarPosition(start);
					setCarProgress(0);
				}
			}
		};
		loadRoute();
		return () => { cancelled = true; };
	}, [ride?.id, start.latitude, start.longitude, end.latitude, end.longitude]);

	useEffect(() => {
		if (routePoints.length < 2) return;
		const interval = setInterval(() => {
			setCarProgress((current) => {
				if (current >= 1) return 1;
				const next = Math.min(current + 0.02, 1);
				const index = Math.min(Math.floor(next * (routePoints.length - 1)), routePoints.length - 1);
				const segment = routePoints[index];
				const previous = routePoints[Math.max(index - 1, 0)];
				const segmentProgress = routePoints.length > 1 ? (next * (routePoints.length - 1) - index) : 0;
				setCarPosition({
					latitude: previous.latitude + (segment.latitude - previous.latitude) * segmentProgress,
					longitude: previous.longitude + (segment.longitude - previous.longitude) * segmentProgress,
				});
				return next;
			});
		}, 1000);
		return () => clearInterval(interval);
	}, [routePoints]);

	if (Platform.OS !== 'web' || !MapContainer) {
		return <View style={styles.mapFallback}><MapPin size={28} color={colors.green} /><Text style={styles.mapFallbackText}>Live route map available in web preview</Text></View>;
	}

	const pickupIcon = createLocationPinIcon('#16a34a', 25);
	const destinationIcon = createLocationPinIcon('#ef4444', 28);
	const sosIcon = createLocationPinIcon('#ef4444', 20);
	const carIcon = createDriverCarIcon(getRouteHeading(carPosition, routePoints));

	return (
		<View style={styles.mapWrap}>
			<MapContainer key={ride?.id ?? 'all-rides'} center={[start.latitude, start.longitude]} zoom={14} zoomControl={false} attributionControl={false} scrollWheelZoom={true} dragging={true} style={styles.map}>
				<TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
				<MonitoringMapUpdater points={routePoints} />
				{ZoomControl && <ZoomControl position="topright" />}
				{rides.map((item) => item.id === ride?.id ? <Polyline key={`route-${item.id}`} positions={routePoints.map((point) => [point.latitude, point.longitude])} pathOptions={{ color: colors.blue, weight: 5 }} /> : item.pickupLat != null && item.pickupLng != null && item.destLat != null && item.destLng != null && <Polyline key={`route-${item.id}`} positions={[[item.pickupLat, item.pickupLng], [item.destLat, item.destLng]]} pathOptions={{ color: colors.gray400, weight: 3, opacity: 0.65 }} />)}
				{rides.map((item) => item.id !== ride?.id && item.pickupLat != null && item.pickupLng != null && <Marker key={`pickup-${item.id}`} position={[item.pickupLat, item.pickupLng]} icon={pickupIcon} />)}
				{rides.map((item) => item.id === ride?.id && item.destLat != null && item.destLng != null && <Marker key={`destination-${item.id}`} position={[item.destLat, item.destLng]} icon={destinationIcon} />)}
				{rides.map((item) => item.sos?.status === 'DISPATCHED' && item.sos.gpsLat != null && item.sos.gpsLng != null && <Marker key={`sos-${item.id}`} position={[item.sos.gpsLat, item.sos.gpsLng]} icon={sosIcon} />)}
				{ride && <Marker position={[carPosition.latitude, carPosition.longitude]} icon={carIcon} zIndexOffset={1000} />}
			</MapContainer>
			<View style={styles.liveMapBadge}><Radio size={13} color={colors.greenDark} /><Text style={styles.liveMapText}>ROUTE VIEW</Text></View>
		</View>
	);
}

export default function RideMonitoringScreen() {
	const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
	const [rides, setRides] = useState<ActiveRide[]>([]);
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(0);

	const loadRides = async (refresh = false) => {
		if (refresh) setRefreshing(true); else setLoading(true);
		try {
			const response = await apiClient.get('/admin/rides/monitoring');
			const nextRides = Array.isArray(response.data) ? response.data : [];
			setRides(nextRides);
			setPage((current) => Math.min(current, Math.max(0, Math.ceil(nextRides.length / RIDES_PER_PAGE) - 1)));
			setSelectedId((current) => current && nextRides.some((ride: ActiveRide) => ride.id === current) ? current : nextRides[0]?.id ?? null);
			setError(null);
		} catch (err: any) {
			setError(err?.response?.data?.error || 'Could not load active rides');
		} finally {
			setLoading(false); setRefreshing(false);
		}
	};

	useEffect(() => { loadRides(); const interval = setInterval(() => loadRides(true), 15000); return () => clearInterval(interval); }, []);

	const selectedRide = useMemo(() => rides.find((ride) => ride.id === selectedId) || rides[0] || null, [rides, selectedId]);
	const pageCount = Math.max(1, Math.ceil(rides.length / RIDES_PER_PAGE));
	const visibleRides = rides.slice(page * RIDES_PER_PAGE, page * RIDES_PER_PAGE + RIDES_PER_PAGE);

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}><ArrowLeft size={19} color={colors.greenDark} /><Text style={styles.backText}>Back</Text></TouchableOpacity>
				<Text style={styles.title}>Ride Monitoring</Text>
			</View>
			<View style={styles.body}>
			<ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadRides(true)} tintColor={colors.green} />} contentContainerStyle={styles.content}>
				{loading ? <ActivityIndicator size="large" color={colors.green} style={styles.loader} /> : error ? <View style={styles.empty}><TriangleAlert color={colors.red} /><Text style={styles.emptyText}>{error}</Text><TouchableOpacity onPress={() => loadRides()} style={styles.retry}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View> : <>
					<MonitoringMap ride={selectedRide} rides={rides} />
					<View style={styles.sectionRow}><View><Text style={styles.sectionTitle}>CURRENT RIDES • {rides.length}</Text><Text style={styles.sectionHint}>Updated within the last 2 hours</Text></View><TouchableOpacity accessibilityLabel="Refresh current rides" style={styles.refreshButton} onPress={() => loadRides(true)} disabled={refreshing}><>{refreshing && <ActivityIndicator size="small" color={colors.blue} />}<Text style={[styles.refreshText, refreshing && styles.refreshDisabled]}>{refreshing ? 'Refreshing...' : 'Refresh'}</Text></></TouchableOpacity></View>
					{rides.length === 0 ? <View style={styles.empty}><Text style={styles.emptyText}>No active rides right now</Text></View> : visibleRides.map((ride) => <RideCard key={ride.id} ride={ride} selected={ride.id === selectedRide?.id} onTrack={() => { setSelectedId(ride.id); setPage(Math.floor(rides.findIndex((item) => item.id === ride.id) / RIDES_PER_PAGE)); }} />)}
				</>}
			</ScrollView>
			<View style={styles.pagination}>
				<TouchableOpacity style={[styles.pageButton, page === 0 && styles.disabledButton]} disabled={page === 0} onPress={() => setPage((current) => Math.max(0, current - 1))}><ChevronLeft size={17} color={page === 0 ? colors.gray500 : colors.gray800} /><Text style={[styles.pageButtonText, page === 0 && styles.disabledText]}>Back</Text></TouchableOpacity>
				<Text style={styles.pageCount}>Page {page + 1} of {pageCount}</Text>
				<TouchableOpacity style={[styles.pageButton, page >= pageCount - 1 && styles.disabledButton]} disabled={page >= pageCount - 1} onPress={() => setPage((current) => Math.min(pageCount - 1, current + 1))}><Text style={[styles.pageButtonText, page >= pageCount - 1 && styles.disabledText]}>Next</Text><ChevronRight size={17} color={page >= pageCount - 1 ? colors.gray500 : colors.gray800} /></TouchableOpacity>
			</View>
			</View>
		</View>
	);
}

function RideCard({ ride, selected, onTrack }: { ride: ActiveRide; selected: boolean; onTrack: () => void }) {
	return <View style={[styles.rideCard, selected && styles.selectedCard]}><View style={styles.rideTop}><Text style={styles.rideId}>#R-{ride.id}</Text>{ride.sos?.status === 'DISPATCHED' && <Text style={styles.sosTag}>SOS</Text>}<Text style={styles.rideStatus}>{ride.status}</Text></View><Text style={styles.routeNames}>{ride.riderName || 'Unknown rider'} <Text style={styles.routeArrow}>→</Text> {ride.driverName || 'Unassigned driver'}</Text><Text style={styles.routeMeta}>{ride.pickupLocation || 'Pickup location'} → {ride.destination || 'Destination'}</Text><TouchableOpacity style={styles.trackButton} onPress={onTrack}><Crosshair size={16} color={colors.white} /><Text style={styles.trackText}>Track Live</Text></TouchableOpacity></View>;
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: colors.gray50 },
	body: { flex: 1, minHeight: 0 },
	header: { backgroundColor: colors.white, paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg },
	backButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: spacing.sm },
	backText: { color: colors.greenDark, fontFamily: font.semibold, fontSize: 14 },
	title: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 22 },
	scrollArea: { flex: 1, minHeight: 0 },
	content: { padding: spacing.lg, paddingBottom: spacing.md },
	mapWrap: { height: 205, borderRadius: radius.lg, overflow: 'hidden', ...shadow.sm },
	map: { flex: 1 },
	mapFallback: { height: 205, borderRadius: radius.lg, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center', gap: 8 },
	mapFallbackText: { color: colors.greenDark, fontFamily: font.semibold, fontSize: 12 },
	liveMapBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: colors.white, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
	liveMapText: { color: colors.greenDark, fontFamily: font.bold, fontSize: 11 },
	sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.sm },
	sectionTitle: { color: colors.gray600, fontFamily: font.bold, fontSize: 12 },
	sectionHint: { color: colors.gray400, fontFamily: font.regular, fontSize: 10, marginTop: 2 },
	refreshText: { color: colors.blue, fontFamily: font.semibold, fontSize: 12 },
	refreshButton: { minWidth: 78, minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
	refreshDisabled: { color: colors.gray400 },
	rideCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.gray200, ...shadow.sm },
	selectedCard: { borderColor: colors.blue },
	rideTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	rideId: { color: colors.gray800, fontFamily: font.bold, fontSize: 14 },
	rideStatus: { color: colors.gray400, fontFamily: font.medium, fontSize: 10, marginLeft: 'auto' },
	sosTag: { color: colors.red, backgroundColor: colors.redLight, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, fontFamily: font.bold, fontSize: 9 },
	routeNames: { color: colors.gray900, fontFamily: font.bold, fontSize: 14, marginTop: 7 },
	routeArrow: { color: colors.gray400 },
	routeMeta: { color: colors.gray500, fontFamily: font.regular, fontSize: 11, marginTop: 4 },
	trackButton: { height: 38, borderRadius: radius.full, backgroundColor: colors.blue, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: spacing.md },
	trackText: { color: colors.white, fontFamily: font.bold, fontSize: 13 },
	pagination: { height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, borderTopWidth: 1, borderTopColor: colors.gray200, backgroundColor: colors.gray50 },
	pageButton: { height: 38, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200 },
	disabledButton: { backgroundColor: colors.gray100, borderColor: colors.gray100 },
	pageButtonText: { color: colors.gray800, fontFamily: font.semibold, fontSize: 12 },
	disabledText: { color: colors.gray500 },
	pageCount: { color: colors.gray600, fontFamily: font.medium, fontSize: 12 },
	loader: { marginTop: spacing.xxxl },
	empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm },
	emptyText: { color: colors.gray500, fontFamily: font.medium, fontSize: 13, textAlign: 'center' },
	retry: { backgroundColor: colors.green, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
	retryText: { color: colors.white, fontFamily: font.semibold, fontSize: 12 },
});
