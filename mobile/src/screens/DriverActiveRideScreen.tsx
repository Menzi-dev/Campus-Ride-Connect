import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, StyleSheet, Text, TouchableOpacity, View, Linking, RefreshControl, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import { ArrowLeft, Car, Check, MapPin, Navigation, Route as RouteIcon, Phone, MessageCircle, RefreshCw } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing, font, shadow } from '../theme/theme';
import apiClient from '../services/ApiClient';
import { useToast } from '../components/Toast';
import ChatScreen from './ChatScreen';

type RootStackParamList = {
  DriverDashboard: undefined;
  DriverActiveRide: { requestId: string };
  Chat: { rideId: string; otherPartyName?: string };
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
  riderName?: string;
  rider?: { fullName?: string };
  riderPhone?: string;
};
type Coordinate = { latitude: number; longitude: number };

const NORTH_CAPE_MALL: Coordinate = { latitude: -28.7587766, longitude: 24.759741 };

let LeafletMap: any;
let LeafletTileLayer: any;
let LeafletPolyline: any;
let LeafletMarker: any;
let LeafletZoomControl: any;
let LeafletUseMap: any;
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
    LeafletUseMap = reactLeaflet.useMap;
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

function DriverMapUpdater({ routePoints }: { routePoints: Coordinate[] }) {
  if (!LeafletUseMap) return null;

  const map = LeafletUseMap();

  useEffect(() => {
    if (!map || routePoints.length < 2) return;

    const frame = window.setTimeout(() => {
      const bounds = leaflet.latLngBounds(routePoints.map((point) => [point.latitude, point.longitude]));
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
    }, 150);

    return () => window.clearTimeout(frame);
  }, [map, routePoints]);

  return null;
}

export default function DriverActiveRideScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'DriverActiveRide'>>();
  const { showToast } = useToast();
  const [ride, setRide] = useState<Ride | null>(null);
  const [routePoints, setRoutePoints] = useState<Coordinate[]>([]);
  const [carPosition, setCarPosition] = useState<Coordinate>(NORTH_CAPE_MALL);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [routeError, setRouteError] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatVisible, setChatVisible] = useState(false);
  const seenMessageIdsRef = useRef<Set<number>>(new Set());
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (document.querySelector('link[data-campus-leaflet]')) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.setAttribute('data-campus-leaflet', 'true');
    document.head.appendChild(link);
  }, []);

  const phase = String(ride?.status || '').toUpperCase();
  const headingToPickup = phase === 'ACCEPTED' || phase === 'ENROUTE';
  const isPickupPhase = headingToPickup;
  const isArrivalPhase = phase === 'ARRIVED';
  const startPoint = headingToPickup ? NORTH_CAPE_MALL : { latitude: ride?.pickupLat || NORTH_CAPE_MALL.latitude, longitude: ride?.pickupLng || NORTH_CAPE_MALL.longitude };
  const endPoint = headingToPickup
    ? { latitude: ride?.pickupLat || NORTH_CAPE_MALL.latitude, longitude: ride?.pickupLng || NORTH_CAPE_MALL.longitude }
    : { latitude: ride?.destLat || NORTH_CAPE_MALL.latitude, longitude: ride?.destLng || NORTH_CAPE_MALL.longitude };

  const loadRide = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const response = await apiClient.get(`/driver/rides/${route.params.requestId}`);
      setRide(response.data);
    } catch (error) {
      setRouteError(true);
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  };

  // Make call to rider
  const handleCallRider = () => {
    if (ride?.riderPhone) {
      const phoneNumber = ride.riderPhone.replace(/\D/g, '');
      const telUrl = `tel:${phoneNumber}`;
      Linking.openURL(telUrl).catch(err => console.log('Error opening phone:', err));
    }
  };

  // Send message to rider
  const handleMessageRider = () => {
    if (ride) {
      setUnreadCount(0);
      setChatVisible(true);
    }
  };

  const riderDisplayName = ride?.riderName || ride?.rider?.fullName || 'Unknown rider';

  useEffect(() => {
    AsyncStorage.getItem('user').then((value) => {
      if (value) {
        const user = JSON.parse(value);
        setCurrentUserId(Number(user.id ?? user.userId));
      }
    });
  }, []);

  useEffect(() => {
    if (!ride?.id || currentUserId == null) return;

    let cancelled = false;
    const pollMessages = async () => {
      try {
        const response = await apiClient.get(`/rides/${ride.id}/messages`);
        const messages: { id: number; senderId: number; message: string; senderName?: string }[] = response.data || [];
        if (cancelled) return;

        const firstPoll = seenMessageIdsRef.current.size === 0;
        const incoming = messages.filter((message) => message.senderId !== currentUserId && !seenMessageIdsRef.current.has(message.id));
        messages.forEach((message) => seenMessageIdsRef.current.add(message.id));
        if (!firstPoll && incoming.length > 0) {
          const latest = incoming[incoming.length - 1];
          showToast(`${latest.senderName || 'Rider'}: ${latest.message}`, 'green');
          setUnreadCount((count) => count + incoming.length);
        }
      } catch {
        // Message polling is non-critical while the ride continues.
      }
    };

    pollMessages();
    const interval = setInterval(pollMessages, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ride?.id, currentUserId, showToast]);

  useEffect(() => {
    loadRide();
    return () => {
      if (animationRef.current) clearInterval(animationRef.current);
    };
  }, []);

  useEffect(() => {
    if (!ride || !startPoint || !endPoint) return;

    let cancelled = false;
    const waitingAtPickup = phase === 'ARRIVED';
    setProgress(waitingAtPickup ? 1 : 0.08);
    setCarPosition(waitingAtPickup ? endPoint : startPoint);
    setRoutePoints([startPoint, endPoint]);

    const loadRoute = async () => {
      try {
        const points = await getRoute(startPoint, endPoint);
        if (!cancelled) {
          setRoutePoints(points.length ? points : [startPoint, endPoint]);
          setRouteError(false);
        }
      } catch {
        if (!cancelled) {
          setRoutePoints([startPoint, endPoint]);
          setRouteError(true);
        }
      }
    };

    loadRoute();
    return () => { cancelled = true; };
  }, [ride?.status, ride?.pickupLat, ride?.pickupLng, ride?.destLat, ride?.destLng]);

  useEffect(() => {
    const canMove = headingToPickup || phase === 'STARTED';
    if (!routePoints.length || !canMove) {
      if (animationRef.current) clearInterval(animationRef.current);
      return;
    }

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
      if (status === 'COMPLETED') {
        navigation.replace('DriverDashboard');
      }
    } catch (error: any) {
      setRouteError(true);
    } finally {
      setUpdating(false);
    }
  };

  const markerIcon = useMemo(() => {
    if (!leaflet) return undefined;
    return leaflet.divIcon({
      className: 'driver-car-marker',
      html: '<div style="background:#16a34a;border:3px solid white;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 12px rgba(0,0,0,.28);font-size:21px">🚗</div>',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  }, []);

  const pickupIcon = useMemo(() => {
    if (!leaflet) return undefined;
    return leaflet.divIcon({
      className: 'pickup-marker',
      html: '<div style="background:#2563eb;border:3px solid white;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.28);font-size:15px">📍</div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
  }, []);

  const showArriveButton = isPickupPhase && progress >= 0.82;
  const showStartButton = isArrivalPhase;
  const showCompleteButton = phase === 'STARTED' && !headingToPickup;

  if (loading) return <View style={[styles.centered]}><ActivityIndicator size="large" color={colors.green} /></View>;
  if (!ride) return <View style={[styles.centered]}><Text style={styles.errorText}>This ride is no longer available.</Text></View>;

  return (
    <View style={styles.container}>
      <Modal
        visible={chatVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setChatVisible(false)}
      >
        <View style={styles.chatOverlay}>
          <TouchableOpacity style={styles.chatBackdrop} activeOpacity={1} onPress={() => setChatVisible(false)} />
          <View style={styles.chatSheet}>
            <ChatScreen rideId={String(ride.id)} otherPartyName={riderDisplayName} onClose={() => setChatVisible(false)} />
          </View>
        </View>
      </Modal>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton} accessibilityLabel="Back to driver dashboard">
          <ArrowLeft size={22} color={colors.gray800} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>{headingToPickup ? 'ON THE WAY TO PICKUP' : 'RIDER TRIP'}</Text>
          <Text style={styles.title}>{headingToPickup ? 'North Cape Mall' : 'Passenger pickup'}</Text>
        </View>
        <TouchableOpacity
          onPress={() => loadRide(true)}
          disabled={refreshing}
          accessibilityLabel="Refresh ride information"
        >
          <RefreshCw
            size={20}
            color={colors.gray600}
            strokeWidth={2}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.mapFrame}>
        {Platform.OS === 'web' && LeafletMap && routePoints.length > 0 ? (
          <LeafletMap
            style={{ height: '100%', width: '100%' }}
            center={[startPoint.latitude, startPoint.longitude]}
            zoom={15}
            zoomControl={false}
            scrollWheelZoom={false}
            dragging={true}
            attributionControl={false}
          >
            <LeafletTileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <DriverMapUpdater routePoints={routePoints} />
            <LeafletPolyline
              positions={routePoints.map((point) => [point.latitude, point.longitude])}
              pathOptions={{ color: '#2563EB', weight: 6, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
            />
            <LeafletMarker position={[endPoint.latitude, endPoint.longitude]} icon={pickupIcon} />
            <LeafletMarker position={[carPosition.latitude, carPosition.longitude]} icon={markerIcon} />
            <LeafletZoomControl position="topright" />
          </LeafletMap>
        ) : (
          <View style={styles.nativeMap}>
            <View style={styles.nativeMapContent}>
              <Car size={48} color={colors.green} strokeWidth={1.5} />
              <Text style={styles.nativeMapText}>Route loaded</Text>
              <Text style={styles.nativeMapProgress}>{Math.round(progress * 100)}% to pickup</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.infoPanelWrapper}>
        <View style={styles.infoPanel}>
          <View style={styles.routeHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>FROM</Text>
              <Text style={styles.value} numberOfLines={1}>{headingToPickup ? 'North Cape Mall' : (ride.pickupLocation || 'Pickup')}</Text>
            </View>
            <RouteIcon size={20} color={colors.greenDark} style={{ marginHorizontal: spacing.sm }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>TO</Text>
              <Text style={styles.value} numberOfLines={1}>{headingToPickup ? (ride.pickupLocation || 'Pickup') : (ride.destination || 'Destination')}</Text>
            </View>
          </View>
          <Text style={styles.status}>{routeError ? 'Using direct route preview' : `${Math.round(progress * 100)}% of this route`}</Text>

          {/* Call and Message Buttons */}
          <View style={styles.communicationButtons}>
            <TouchableOpacity
              style={styles.callButton}
              onPress={handleCallRider}
              disabled={!ride?.riderPhone}
              accessibilityLabel="Call rider"
            >
              <Phone size={18} color={colors.white} strokeWidth={2} />
              <Text style={styles.communicationButtonText}>Call Rider</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.messageButton}
              onPress={handleMessageRider}
              activeOpacity={0.7}
              hitSlop={8}
              accessibilityLabel="Message rider"
            >
              <MessageCircle size={18} color={colors.white} strokeWidth={2} />
              <Text style={styles.communicationButtonText}>Message</Text>
              {unreadCount > 0 && (
                <View pointerEvents="none" style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Status Buttons - Conditional Display */}
          {showArriveButton && (
            <TouchableOpacity
              style={[styles.primaryButton, styles.arriveButton]}
              onPress={() => updateStatus('ARRIVED')}
              disabled={updating}
            >
              {updating ? <ActivityIndicator color={colors.white} /> : (
                <>
                  <Check size={19} color={colors.white} />
                  <Text style={styles.primaryButtonText}>I Have Arrived!</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {showStartButton && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => updateStatus('STARTED')}
              disabled={updating}
            >
              {updating ? <ActivityIndicator color={colors.white} /> : (
                <>
                  <Navigation size={19} color={colors.white} />
                  <Text style={styles.primaryButtonText}>Start Trip</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {showCompleteButton && (
            <TouchableOpacity
              style={[styles.primaryButton, styles.completeButton]}
              onPress={() => updateStatus('COMPLETED')}
              disabled={updating}
            >
              {updating ? <ActivityIndicator color={colors.white} /> : (
                <>
                  <Check size={19} color={colors.white} />
                  <Text style={styles.primaryButtonText}>Complete Trip</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <Text style={styles.helper}>
            {showArriveButton 
              ? 'You are arriving at the pickup point!' 
              : headingToPickup 
              ? 'Follow the moving car to the rider pickup point.' 
              : showStartButton
              ? 'The rider is ready. Start the trip to the destination.'
              : 'Drive the rider to the destination.'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative', backgroundColor: colors.gray50 },
  chatOverlay: { flex: 1, justifyContent: 'flex-end' },
  chatBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,23,42,0.34)' },
  chatSheet: { height: '88%', overflow: 'hidden', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.gray50 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.red, fontFamily: font.semibold },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, paddingTop: spacing.xl, backgroundColor: colors.white, ...shadow.sm },
  iconButton: { padding: spacing.sm, marginRight: spacing.sm },
  headerText: { flex: 1 },
  eyebrow: { color: colors.greenDark, fontFamily: font.bold, fontSize: 10, letterSpacing: 0.7 },
  title: { color: colors.gray900, fontFamily: font.bold, fontSize: 20, marginTop: 3 },
  mapFrame: {
    flex: 1,
    minHeight: 300,
    overflow: 'hidden',
    backgroundColor: colors.greenLight,
    zIndex: 0,
  },
  nativeMap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenLight },
  nativeMapContent: { alignItems: 'center', justifyContent: 'center' },
  nativeMapText: { marginTop: spacing.md, color: colors.gray700, fontFamily: font.medium },
  nativeMapProgress: { marginTop: 2, color: colors.greenDark, fontFamily: font.semibold },
  infoPanelWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    elevation: 20,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...shadow.lg,
  },
  infoPanel: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  routeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  label: { color: colors.gray400, fontFamily: font.bold, fontSize: 10, letterSpacing: 0.7 },
  value: { color: colors.gray900, fontFamily: font.semibold, fontSize: 14, marginTop: 4, maxWidth: 170 },
  status: { color: colors.gray500, fontFamily: font.medium, fontSize: 12, marginTop: spacing.lg, marginBottom: spacing.md },
  
  // Communication Buttons
  communicationButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.blue,
  },
  messageButton: {
    position: 'relative',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.purple || '#9333ea',
  },
  unreadBadge: {
    position: 'absolute',
    top: -7,
    right: -7,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.red,
    borderWidth: 2,
    borderColor: colors.white,
  },
  unreadBadgeText: { color: colors.white, fontFamily: font.bold, fontSize: 10 },
  communicationButtonText: {
    color: colors.white,
    fontFamily: font.semibold,
    fontSize: 13,
    fontWeight: '600',
  },
  
  primaryButton: { minHeight: 52, marginTop: spacing.md, borderRadius: radius.md, backgroundColor: colors.greenDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  arriveButton: { backgroundColor: colors.green },
  completeButton: { backgroundColor: colors.blue },
  primaryButtonText: { color: colors.white, fontFamily: font.bold, fontSize: 15 },
  helper: { color: colors.gray500, fontFamily: font.regular, textAlign: 'center', fontSize: 12, marginTop: spacing.sm },
});
