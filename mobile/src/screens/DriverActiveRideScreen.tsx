import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import { ArrowLeft, Car, Check, MapPin, Navigation, Route as RouteIcon } from 'lucide-react-native';
import { colors, radius, spacing, font, shadow } from '../theme/theme';
import apiClient from '../services/ApiClient';

type RootStackParamList = {
  DriverDashboard: undefined;
  DriverActiveRide: { requestId: string };
};
type Ride = {
  id: number;
  status: string;
  pickupLat?: number;
  pickupLng?: number;
  pickupLocation?: string;
  destination?: string;
  destLat?: number;
  destLng?: number;
  fare?: number;
};
type Coordinate = { latitude: number; longitude: number };

const NORTH_CAPE_MALL: Coordinate = { latitude: -28.7587766, longitude: 24.759741 };

let LeafletMap: any;
let LeafletTileLayer: any;
let LeafletPolyline: any;
let LeafletMarker: any;
let LeafletZoomControl: any;
let leaflet: any;
if (Platform.OS === 'web') {
  try {
    leaflet = require('leaflet');
    const reactLeaflet = require('react-leaflet');
    LeafletMap = reactLeaflet.MapContainer;
    LeafletTileLayer = reactLeaflet.TileLayer;
    LeafletPolyline = reactLeaflet.Polyline;
    LeafletMarker = reactLeaflet.Marker;
    LeafletZoomControl = reactLeaflet.ZoomControl;
  } catch {
    LeafletMap = null;
  }
}

async function getRoute(start: Coordinate, end: Coordinate): Promise<Coordinate[]> {
  const url = `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Route unavailable');
  const data = await response.json();
  return (data.routes?.[0]?.geometry?.coordinates || []).map(([longitude, latitude]: number[]) => ({ latitude, longitude }));
}

function interpolateRoute(route: Coordinate[], progress: number): Coordinate {
  if (!route.length) return NORTH_CAPE_MALL;
  const index = Math.min(route.length - 1, Math.floor(progress * route.length));
  return route[index];
}

export default function DriverActiveRideScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'DriverActiveRide'>>();
  const [ride, setRide] = useState<Ride | null>(null);
  const [routePoints, setRoutePoints] = useState<Coordinate[]>([]);
  const [carPosition, setCarPosition] = useState<Coordinate>(NORTH_CAPE_MALL);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [routeError, setRouteError] = useState(false);
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const phase = String(ride?.status || '').toUpperCase();
  const headingToPickup = phase === 'ACCEPTED' || phase === 'ENROUTE';
  const startPoint = headingToPickup ? NORTH_CAPE_MALL : { latitude: ride?.pickupLat || NORTH_CAPE_MALL.latitude, longitude: ride?.pickupLng || NORTH_CAPE_MALL.longitude };
  const endPoint = headingToPickup
    ? { latitude: ride?.pickupLat || NORTH_CAPE_MALL.latitude, longitude: ride?.pickupLng || NORTH_CAPE_MALL.longitude }
    : { latitude: ride?.destLat || NORTH_CAPE_MALL.latitude, longitude: ride?.destLng || NORTH_CAPE_MALL.longitude };

  const loadRide = async () => {
    try {
      const response = await apiClient.get(`/driver/rides/${route.params.requestId}`);
      setRide(response.data);
    } catch (error) {
      setRouteError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRide();
    return () => {
      if (animationRef.current) clearInterval(animationRef.current);
    };
  }, []);

  useEffect(() => {
    if (!ride || !startPoint || !endPoint) return;
    let cancelled = false;
    setProgress(0);
    setCarPosition(startPoint);
    getRoute(startPoint, endPoint)
      .then((points) => {
        if (!cancelled) {
          setRoutePoints(points.length ? points : [startPoint, endPoint]);
          setRouteError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRoutePoints([startPoint, endPoint]);
          setRouteError(true);
        }
      });
    return () => { cancelled = true; };
  }, [ride?.status, ride?.pickupLat, ride?.pickupLng, ride?.destLat, ride?.destLng]);

  useEffect(() => {
    if (!routePoints.length || phase === 'COMPLETED') return;
    animationRef.current = setInterval(() => {
      setProgress((current) => {
        const next = Math.min(1, current + 0.0125);
        setCarPosition(interpolateRoute(routePoints, next));
        if (next >= 1 && animationRef.current) clearInterval(animationRef.current);
        return next;
      });
    }, 500);
    return () => {
      if (animationRef.current) clearInterval(animationRef.current);
    };
  }, [routePoints, phase]);

  const updateStatus = async (status: 'ARRIVED' | 'STARTED' | 'COMPLETED') => {
    if (!ride || updating) return;
    setUpdating(true);
    try {
      const response = await apiClient.post(`/driver/rides/${ride.id}/status`, { status });
      setRide(response.data);
      setProgress(0);
    } catch (error: any) {
      setRouteError(true);
    } finally {
      setUpdating(false);
    }
  };

  const markerIcon = useMemo(() => {
    if (!leaflet) return undefined;
    return leaflet.divIcon({ className: 'driver-car-marker', html: '<div style="background:#16a34a;border:3px solid white;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 12px rgba(0,0,0,.25);font-size:20px">🚗</div>', iconSize: [38, 38], iconAnchor: [19, 19] });
  }, []);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color={colors.green} /></View>;
  if (!ride) return <View style={styles.centered}><Text style={styles.errorText}>This ride is no longer available.</Text></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton} accessibilityLabel="Back to driver dashboard">
          <ArrowLeft size={22} color={colors.gray800} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>{headingToPickup ? 'ON THE WAY TO PICKUP' : 'RIDER TRIP'}</Text>
          <Text style={styles.title}>{headingToPickup ? 'North Cape Mall' : 'Passenger pickup'}</Text>
        </View>
        <Car size={25} color={colors.greenDark} />
      </View>

      <View style={styles.mapFrame}>
        {Platform.OS === 'web' && LeafletMap && routePoints.length > 0 ? (
          <LeafletMap style={{ height: '100%', width: '100%' }} center={[carPosition.latitude, carPosition.longitude]} zoom={14} zoomControl={false}>
            <LeafletTileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LeafletPolyline positions={routePoints.map((point) => [point.latitude, point.longitude])} pathOptions={{ color: colors.green, weight: 6, opacity: 0.85 }} />
            <LeafletMarker position={[endPoint.latitude, endPoint.longitude]} />
            <LeafletMarker position={[carPosition.latitude, carPosition.longitude]} icon={markerIcon} />
            <LeafletZoomControl position="bottomright" />
          </LeafletMap>
        ) : (
          <View style={styles.nativeMap}><Navigation size={46} color={colors.green} /><Text style={styles.nativeMapText}>Live route map available on web</Text></View>
        )}
      </View>

      <View style={styles.infoPanel}>
        <View style={styles.routeHeader}>
          <View><Text style={styles.label}>FROM</Text><Text style={styles.value}>{headingToPickup ? 'North Cape Mall' : (ride.pickupLocation || 'Pickup point')}</Text></View>
          <RouteIcon size={20} color={colors.greenDark} />
          <View><Text style={styles.label}>TO</Text><Text style={styles.value}>{headingToPickup ? (ride.pickupLocation || 'Rider pickup') : (ride.destination || 'Destination')}</Text></View>
        </View>
        <Text style={styles.status}>{routeError ? 'Using direct route preview' : `${Math.round(progress * 100)}% of this route`}</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => updateStatus(headingToPickup ? 'ARRIVED' : phase === 'ARRIVED' ? 'STARTED' : 'COMPLETED')}
          disabled={updating}
        >
          {updating ? <ActivityIndicator color={colors.white} /> : <><Check size={19} color={colors.white} /><Text style={styles.primaryButtonText}>{headingToPickup ? 'I have arrived' : phase === 'ARRIVED' ? 'Start trip' : 'Complete trip'}</Text></>}
        </TouchableOpacity>
        <Text style={styles.helper}>{headingToPickup ? 'Follow the moving car to the rider pickup point.' : phase === 'ARRIVED' ? 'The rider is ready. Start the trip to the destination.' : 'Drive the rider to the destination.'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.red, fontFamily: font.semibold },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, paddingTop: spacing.xl, backgroundColor: colors.white, ...shadow.sm },
  iconButton: { padding: spacing.sm, marginRight: spacing.sm },
  headerText: { flex: 1 },
  eyebrow: { color: colors.greenDark, fontFamily: font.bold, fontSize: 10, letterSpacing: 0.7 },
  title: { color: colors.gray900, fontFamily: font.bold, fontSize: 20, marginTop: 3 },
  mapFrame: { flex: 1, minHeight: 360, overflow: 'hidden' },
  nativeMap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenLight },
  nativeMapText: { marginTop: spacing.md, color: colors.gray700, fontFamily: font.medium },
  infoPanel: { backgroundColor: colors.white, padding: spacing.xl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, ...shadow.lg },
  routeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  label: { color: colors.gray400, fontFamily: font.bold, fontSize: 10, letterSpacing: 0.7 },
  value: { color: colors.gray900, fontFamily: font.semibold, fontSize: 14, marginTop: 4, maxWidth: 170 },
  status: { color: colors.gray500, fontFamily: font.medium, fontSize: 12, marginTop: spacing.lg },
  primaryButton: { minHeight: 52, marginTop: spacing.md, borderRadius: radius.md, backgroundColor: colors.greenDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  primaryButtonText: { color: colors.white, fontFamily: font.bold, fontSize: 15 },
  helper: { color: colors.gray500, fontFamily: font.regular, textAlign: 'center', fontSize: 12, marginTop: spacing.sm },
});
