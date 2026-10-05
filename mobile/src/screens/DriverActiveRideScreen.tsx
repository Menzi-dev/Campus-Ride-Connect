import useMapResize from '../hooks/useMapResize';
import Button from '../components/Button';
import ScrollableCard from '../components/ScrollableCard';
import RideSosModal from '../components/RideSosModal';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View, Linking, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import { ArrowLeft, Car, Check, MapPin, Navigation, Route as RouteIcon, Phone, MessageCircle, RefreshCw, Siren, Star, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
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
  riderProfileImage?: string | null;
  riderPhone?: string;
  cancellationReason?: string | null;
  cancelledBy?: number | string | null;
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
  return (Math.atan2(nextPoint.longitude - position.longitude, nextPoint.latitude - position.latitude) * 180) / Math.PI;
}

function DriverMapUpdater({ routePoints }: { routePoints: Coordinate[] }) {
  if (!LeafletUseMap) return null;

  const map = LeafletUseMap();
  useMapResize(map);

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
  const [sosVisible, setSosVisible] = useState(false);
  const [ratingVisible, setRatingVisible] = useState(false);
  const [cancelDialogVisible, setCancelDialogVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancellationNotice, setCancellationNotice] = useState('');
  const [cancellationNoticeVisible, setCancellationNoticeVisible] = useState(false);
  const [selectedRiderRating, setSelectedRiderRating] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [hoveredButton, setHoveredButton] = useState<'call' | 'message' | 'complete' | null>(null);
  const seenMessageIdsRef = useRef<Set<number>>(new Set());
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancellationNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const carPositionRef = useRef<Coordinate>(NORTH_CAPE_MALL);

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
    const phone = ride?.riderPhone?.replace(/[^\d+]/g, '');
    if (!phone) { showToast('The rider has not provided a phone number. Use Message instead.', 'blue'); return; }
    Linking.openURL(`tel:${phone}`).catch(() => showToast(`Could not open the phone app. You can call ${phone} directly.`, 'red'));
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
    if (!ride?.id || currentUserId == null || phase === 'COMPLETED' || phase === 'CANCELLED') return;
    let disposed = false;
    const pollCancellation = async () => {
      try {
        const response = await apiClient.get(`/driver/rides/${ride.id}`);
        if (disposed) return;
        const latestRide = response.data as Ride;
        if (String(latestRide.status).toUpperCase() !== 'CANCELLED') return;

        setRide((previous) => previous ? { ...previous, ...latestRide } : latestRide);
        const cancelledByDriver = Number(latestRide.cancelledBy) === currentUserId;
        setCancellationNotice(`${cancelledByDriver ? 'You cancelled this ride.' : 'The rider cancelled this ride.'}\nReason: ${latestRide.cancellationReason || 'No reason provided.'}`);
        setCancellationNoticeVisible(true);
        if (animationRef.current) clearInterval(animationRef.current);
        cancellationNoticeTimerRef.current = setTimeout(() => {
          cancellationNoticeTimerRef.current = null;
          setCancellationNoticeVisible(false);
          navigation.replace('DriverDashboard');
        }, 3000);
      } catch {
        // Cancellation polling is non-critical while the ride continues.
      }
    };

    void pollCancellation();
    const interval = setInterval(pollCancellation, 2000);
    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, [ride?.id, currentUserId, phase, navigation]);

  useEffect(() => {
    loadRide();
    return () => {
      if (animationRef.current) clearInterval(animationRef.current);
      if (cancellationNoticeTimerRef.current) clearTimeout(cancellationNoticeTimerRef.current);
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

  useEffect(() => {
    carPositionRef.current = carPosition;
  }, [carPosition]);

  useEffect(() => {
    if (!ride?.id || !['ACCEPTED', 'ENROUTE', 'STARTED'].includes(phase)) return;
    const publishLocation = () => {
      apiClient.post(`/driver/rides/${ride.id}/location`, carPositionRef.current).catch(() => undefined);
    };
    publishLocation();
    const interval = setInterval(publishLocation, 500);
    return () => clearInterval(interval);
  }, [ride?.id, phase]);

  const updateStatus = async (status: 'ARRIVED' | 'STARTED' | 'COMPLETED') => {
    if (!ride || updating) return;
    setUpdating(true);
    try {
      const response = await apiClient.post(`/driver/rides/${ride.id}/status`, { status });
      setRide((previous) => previous ? { ...previous, ...response.data } : response.data);
      setProgress(0);
      if (status === 'COMPLETED') {
        setRatingVisible(true);
      }
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'Could not update the ride status. Please try again.', 'red');
    } finally {
      setUpdating(false);
    }
  };

  const openCancellationDialog = () => {
    setCancelReason('');
    setCancelDialogVisible(true);
  };

  const handleConfirmRideCancellation = async () => {
    if (!ride || cancelSubmitting) return;
    const reason = cancelReason.trim();
    if (!reason) return;
    setCancelSubmitting(true);
    try {
      const response = await apiClient.post(`/rides/${ride.id}/cancel`, { reason });
      setRide((previous) => previous ? { ...previous, ...response.data } : { ...ride, ...response.data });
      setCancelDialogVisible(false);
      setCancellationNotice(`You cancelled this ride.\nReason: ${reason}`);
      setCancellationNoticeVisible(true);
      if (animationRef.current) clearInterval(animationRef.current);
      cancellationNoticeTimerRef.current = setTimeout(() => {
        cancellationNoticeTimerRef.current = null;
        setCancellationNoticeVisible(false);
        navigation.replace('DriverDashboard');
      }, 3000);
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'Could not cancel ride', 'red');
    } finally {
      setCancelSubmitting(false);
    }
  };

  const submitRiderRating = async () => {
    if (!ride || selectedRiderRating < 1 || submittingRating) return;
    setSubmittingRating(true);
    try {
      await apiClient.post(`/rides/${ride.id}/rider-rating`, { rating: selectedRiderRating });
      showToast('Rider rating submitted', 'green');
      setRatingVisible(false);
      navigation.replace('DriverDashboard');
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'Could not submit rider rating', 'red');
    } finally {
      setSubmittingRating(false);
    }
  };

  const carHeading = getRouteHeading(carPosition, routePoints);
  const markerIcon = useMemo(() => {
    if (!leaflet) return undefined;
    return leaflet.divIcon({
      className: 'driver-car-marker',
      html: `<div style="width:38px;height:38px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 3px rgba(15,23,42,.4));transform:rotate(${carHeading}deg)">
        <svg viewBox="0 0 80 120" width="38" height="38" role="img" aria-label="Campus ride vehicle">
          <defs><linearGradient id="driverTopCarBody" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cbd5db"/><stop offset=".2" stop-color="#fff"/><stop offset=".8" stop-color="#f8fafc"/><stop offset="1" stop-color="#b8c2c9"/></linearGradient><linearGradient id="driverTopCarGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b5563"/><stop offset="1" stop-color="#111827"/></linearGradient></defs>
          <ellipse cx="40" cy="61" rx="25" ry="55" fill="rgba(15,23,42,.2)"/>
          <path d="M40 3c13 0 22 13 25 29l7 54c2 16-7 29-20 31H28c-13-2-22-15-20-31l7-54C18 16 27 3 40 3Z" fill="url(#driverTopCarBody)" stroke="#94a3ad" stroke-width="1.5"/>
          <path d="M27 21c3-9 8-13 13-13s10 4 13 13l5 27H22l5-27Z" fill="url(#driverTopCarGlass)" stroke="#7c8790" stroke-width="1.2"/>
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
  }, [carHeading]);

  const pickupIcon = useMemo(() => {
    if (!leaflet) return undefined;
    return leaflet.divIcon({
      className: 'pickup-marker',
      html: '<div style="width:28px;height:38px;position:relative;filter:drop-shadow(0 2px 2px rgba(15,23,42,.4))"><svg viewBox="0 0 40 54" width="28" height="38" aria-label="Pickup location marker"><ellipse cx="20" cy="51" rx="13" ry="2.5" fill="rgba(15,23,42,.35)"/><path d="M20 2C10.1 2 2 10.1 2 20c0 13.1 18 30 18 30s18-16.9 18-30C38 10.1 29.9 2 20 2Z" fill="#ef4444" stroke="#fff" stroke-width="2"/><circle cx="20" cy="20" r="6.5" fill="#fff"/></svg></div>',
      iconSize: [28, 38],
      iconAnchor: [14, 38],
    });
  }, []);

  const driverLocationIcon = useMemo(() => {
    if (!leaflet) return undefined;
    return leaflet.divIcon({
      className: 'location-pin-marker',
      html: '<div style="width:25px;height:34px;position:relative;filter:drop-shadow(0 2px 2px rgba(15,23,42,.4))"><svg viewBox="0 0 40 54" width="25" height="34" aria-label="Driver location marker"><ellipse cx="20" cy="51" rx="13" ry="2.5" fill="rgba(15,23,42,.35)"/><path d="M20 2C10.1 2 2 10.1 2 20c0 13.1 18 30 18 30s18-16.9 18-30C38 10.1 29.9 2 20 2Z" fill="#16a34a" stroke="#fff" stroke-width="2"/><circle cx="20" cy="20" r="6.5" fill="#fff"/></svg></div>',
      iconSize: [25, 34],
      iconAnchor: [12.5, 34],
    });
  }, []);

  const showArriveButton = isPickupPhase && progress >= 0.82;
  const showStartButton = isArrivalPhase;
  const showCompleteButton = phase === 'STARTED' && !headingToPickup;

  if (loading) return <View style={[styles.centered]}><ActivityIndicator size="large" color={colors.green} /></View>;
  if (!ride) return <View style={[styles.centered]}><Text style={styles.errorText}>This ride is no longer available.</Text><Button label="Retry" onPress={() => loadRide(true)} loading={refreshing} disabled={refreshing} style={{ marginTop: spacing.lg }} /><Button label="Back to dashboard" variant="secondary" onPress={() => navigation.navigate('DriverDashboard')} style={{ marginTop: spacing.sm }} /></View>;

  return (
    <View style={styles.container}>
      <RideSosModal visible={sosVisible} rideId={ride.id} onClose={() => setSosVisible(false)} />
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
      <Modal visible={ratingVisible} transparent animationType="fade" onRequestClose={() => undefined}>
        <View style={styles.ratingBackdrop}>
          <ScrollableCard style={styles.ratingCard}>
            <Text style={styles.ratingTitle}>Rate your rider</Text>
            {ride.riderProfileImage ? (
              <Image source={{ uri: ride.riderProfileImage }} style={styles.ratingRiderImage} />
            ) : null}
            <Text style={styles.ratingSubtitle}>How was your ride with {riderDisplayName}?</Text>
            <View style={styles.ratingStars}>
              {[1, 2, 3, 4, 5].map((rating) => (
                <TouchableOpacity
                  key={rating}
                  style={styles.ratingStarButton}
                  onPress={() => setSelectedRiderRating(rating)}
                  accessibilityLabel={`Rate rider ${rating} out of 5`}
                >
                  <Star
                    size={34}
                    color={rating <= selectedRiderRating ? colors.orange : colors.gray300}
                    fill={rating <= selectedRiderRating ? colors.orange : 'transparent'}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.ratingSubmitButton, (selectedRiderRating === 0 || submittingRating) && styles.ratingSubmitDisabled]}
              onPress={submitRiderRating}
              disabled={selectedRiderRating === 0 || submittingRating}
            >
              {submittingRating ? <ActivityIndicator color={colors.white} /> : <Text style={styles.ratingSubmitText}>Submit rating</Text>}
            </TouchableOpacity>
          </ScrollableCard>
        </View>
      </Modal>
      <Modal visible={cancelDialogVisible} transparent animationType="fade" onRequestClose={() => setCancelDialogVisible(false)}>
        <View style={styles.cancelDialogBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !cancelSubmitting && setCancelDialogVisible(false)} />
          <ScrollableCard style={styles.cancelDialogCard}>
            <View style={styles.cancelDialogIcon}><X size={21} color={colors.red} /></View>
            <Text style={styles.cancelDialogTitle}>Cancel this ride?</Text>
            <Text style={styles.cancelDialogSubtitle}>Please tell the rider why you need to cancel.</Text>
            <TextInput
              style={styles.cancelReasonInput}
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Enter a cancellation reason"
              placeholderTextColor={colors.gray400}
              multiline
              maxLength={500}
              textAlignVertical="top"
              editable={!cancelSubmitting}
            />
            <Text style={styles.cancelReasonCount}>{cancelReason.length}/500</Text>
            <View style={styles.cancelDialogActions}>
              <TouchableOpacity style={styles.cancelKeepButton} onPress={() => setCancelDialogVisible(false)} disabled={cancelSubmitting}>
                <Text style={styles.cancelKeepText}>Keep ride</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelConfirmButton, (!cancelReason.trim() || cancelSubmitting) && styles.cancelConfirmDisabled]}
                onPress={handleConfirmRideCancellation}
                disabled={!cancelReason.trim() || cancelSubmitting}
              >
                {cancelSubmitting ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.cancelConfirmText}>Cancel ride</Text>}
              </TouchableOpacity>
            </View>
          </ScrollableCard>
        </View>
      </Modal>
      <Modal visible={cancellationNoticeVisible} transparent animationType="fade" onRequestClose={() => undefined}>
        <View style={styles.cancelDialogBackdrop}>
          <ScrollableCard style={styles.cancelNoticeCard}>
            <View style={styles.cancelNoticeIcon}><Check size={24} color={colors.white} /></View>
            <Text style={styles.cancelDialogTitle}>Ride cancelled</Text>
            <Text style={styles.cancelNoticeText}>{cancellationNotice}</Text>
            <Text style={styles.cancelNoticeHint}>Returning to Driver Dashboard…</Text>
          </ScrollableCard>
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

      {/* ===== MAP + INFO PANEL (map now flexes to fill space above the panel) ===== */}
      <View style={styles.mapAndPanel}>
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
              <LeafletMarker position={[startPoint.latitude, startPoint.longitude]} icon={driverLocationIcon} />
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
            <View style={styles.riderProfileRow}>
              <View style={styles.riderAvatar}>
                {ride.riderProfileImage ? (
                  <Image source={{ uri: ride.riderProfileImage }} style={styles.riderAvatarImage} />
                ) : (
                  <Text style={styles.riderAvatarText}>{riderDisplayName.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</Text>
                )}
              </View>
              <View style={styles.riderIdentity}>
                <Text style={styles.riderLabel}>RIDER</Text>
                <Text style={styles.riderName} numberOfLines={1}>{riderDisplayName}</Text>
              </View>
              {['ACCEPTED', 'ENROUTE', 'ARRIVED', 'STARTED'].includes(phase) && (
                <TouchableOpacity style={styles.sosButton} onPress={() => setSosVisible(true)} accessibilityRole="button" accessibilityLabel="Activate SOS alert" accessibilityHint="Alert Campus Security about this ride" testID="driver-sos-button">
                  <Siren size={22} color={colors.white} strokeWidth={2} />
                </TouchableOpacity>
              )}
            </View>
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
              <Pressable
                style={({ pressed }) => [styles.callButton, (hoveredButton === 'call' || pressed) && styles.greenButtonHover]}
                onPress={handleCallRider}
                onHoverIn={() => setHoveredButton('call')}
                onHoverOut={() => setHoveredButton(null)}
                accessibilityLabel="Call rider"
              >
                {({ pressed }) => {
                  const inverted = hoveredButton === 'call' || pressed;
                  return <>
                    <Phone size={18} color={inverted ? colors.greenDark : colors.white} strokeWidth={2} />
                    <Text style={[styles.communicationButtonText, inverted && styles.greenButtonHoverText]}>Call Rider</Text>
                  </>;
                }}
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.messageButton, (hoveredButton === 'message' || pressed) && styles.greenButtonHover]}
                onPress={handleMessageRider}
                onHoverIn={() => setHoveredButton('message')}
                onHoverOut={() => setHoveredButton(null)}
                hitSlop={8}
                accessibilityLabel="Message rider"
              >
                {({ pressed }) => {
                  const inverted = hoveredButton === 'message' || pressed;
                  return <>
                    <MessageCircle size={18} color={inverted ? colors.greenDark : colors.white} strokeWidth={2} />
                    <Text style={[styles.communicationButtonText, inverted && styles.greenButtonHoverText]}>Message</Text>
                    {unreadCount > 0 && (
                      <View pointerEvents="none" style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                      </View>
                    )}
                  </>;
                }}
              </Pressable>
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
              <Pressable
                style={({ pressed }) => [styles.primaryButton, styles.completeButton, (hoveredButton === 'complete' || pressed) && styles.greenButtonHover]}
                onPress={() => updateStatus('COMPLETED')}
                onHoverIn={() => setHoveredButton('complete')}
                onHoverOut={() => setHoveredButton(null)}
                disabled={updating}
              >
                {({ pressed }) => {
                  const inverted = hoveredButton === 'complete' || pressed;
                  return updating ? <ActivityIndicator color={inverted ? colors.greenDark : colors.white} /> : (
                    <>
                      <Check size={19} color={inverted ? colors.greenDark : colors.white} />
                      <Text style={[styles.primaryButtonText, inverted && styles.greenButtonHoverText]}>Complete Trip</Text>
                    </>
                  );
                }}
              </Pressable>
            )}

            {!['COMPLETED', 'CANCELLED'].includes(phase) && (
              <TouchableOpacity style={styles.cancelRideButton} onPress={openCancellationDialog} disabled={updating || cancelSubmitting}>
                <X size={17} color={colors.red} />
                <Text style={styles.cancelRideButtonText}>Cancel ride</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minWidth: 0, minHeight: 0, position: 'relative', backgroundColor: colors.gray50 },

  // ===== Rating modal =====
  ratingBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: 'rgba(15,23,42,0.55)' },
  ratingCard: { width: '100%', maxWidth: 380, padding: spacing.xl, backgroundColor: colors.white, borderRadius: radius.lg, ...shadow.lg },
  ratingTitle: { textAlign: 'center', color: colors.gray900, fontFamily: font.bold, fontSize: 20 },
  ratingRiderImage: { alignSelf: 'center', width: 64, height: 64, borderRadius: 32, marginTop: spacing.md },
  ratingSubtitle: { textAlign: 'center', color: colors.gray600, fontFamily: font.regular, fontSize: 13, marginTop: spacing.sm },
  ratingStars: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginVertical: spacing.xl },
  ratingStarButton: { padding: 2 },
  ratingSubmitButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.green, borderRadius: radius.md },
  ratingSubmitDisabled: { opacity: 0.5 },
  ratingSubmitText: { color: colors.white, fontFamily: font.bold, fontSize: 14 },

  // ===== Cancel dialog =====
  cancelDialogBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: 'rgba(15,23,42,0.55)' },
  cancelDialogCard: { width: '100%', maxWidth: 400, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.white, ...shadow.lg },
  cancelDialogIcon: { width: 42, height: 42, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: '#FEE2E2', marginBottom: spacing.md },
  cancelDialogTitle: { color: colors.gray900, fontFamily: font.bold, fontSize: 19, textAlign: 'center' },
  cancelDialogSubtitle: { color: colors.gray600, fontFamily: font.regular, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: spacing.xs },
  cancelReasonInput: { minHeight: 104, maxHeight: 150, marginTop: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.md, backgroundColor: colors.gray50, color: colors.gray900, fontFamily: font.regular, fontSize: 14 },
  cancelReasonCount: { color: colors.gray400, fontFamily: font.medium, fontSize: 10, textAlign: 'right', marginTop: 4 },
  cancelDialogActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  cancelKeepButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.gray100 },
  cancelKeepText: { color: colors.gray800, fontFamily: font.bold, fontSize: 13 },
  cancelConfirmButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.red },
  cancelConfirmDisabled: { opacity: 0.5 },
  cancelConfirmText: { color: colors.white, fontFamily: font.bold, fontSize: 13 },
  cancelNoticeCard: { width: '100%', maxWidth: 360, padding: spacing.xl, alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.white, ...shadow.lg },
  cancelNoticeIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: colors.green, marginBottom: spacing.md },
  cancelNoticeText: { color: colors.gray700, fontFamily: font.medium, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: spacing.sm },
  cancelNoticeHint: { color: colors.gray400, fontFamily: font.medium, fontSize: 11, textAlign: 'center', marginTop: spacing.md },
  cancelRideButton: { minHeight: 48, marginTop: spacing.md, borderWidth: 1, borderColor: colors.red, borderRadius: radius.md, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  cancelRideButtonText: { color: colors.red, fontFamily: font.bold, fontSize: 14 },

  // ===== Chat overlay =====
  chatOverlay: { flex: 1, justifyContent: 'flex-end' },
  chatBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,23,42,0.34)' },
  chatSheet: { height: '88%', overflow: 'hidden', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.gray50 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.red, fontFamily: font.semibold },

  // ===== Header =====
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, paddingTop: spacing.xl, backgroundColor: colors.white, ...shadow.sm },
  iconButton: { padding: spacing.sm, marginRight: spacing.sm },
  headerText: { flex: 1 },
  eyebrow: { color: colors.greenDark, fontFamily: font.bold, fontSize: 10, letterSpacing: 0.7 },
  title: { color: colors.gray900, fontFamily: font.bold, fontSize: 20, marginTop: 3 },

  // ===== Map + Info Panel (new layout) =====
  // Parent column: map takes all remaining space, info panel sits naturally at the bottom.
  mapAndPanel: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: colors.gray50,
  },
  // Map grows to fill the space above the info panel — route is fully visible.
  mapFrame: {
    flex: 1,
    minHeight: 320,
    overflow: 'hidden',
    backgroundColor: colors.greenLight,
    zIndex: 0,
  },
  nativeMap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenLight },
  nativeMapContent: { alignItems: 'center', justifyContent: 'center' },
  nativeMapText: { marginTop: spacing.md, color: colors.gray700, fontFamily: font.medium },
  nativeMapProgress: { marginTop: 2, color: colors.greenDark, fontFamily: font.semibold },

  // Info panel is a normal flex child now — no overlap with the map.
  infoPanelWrapper: {
    flexShrink: 0,
    zIndex: 20,
    elevation: 20,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...shadow.lg,
  },
  infoPanel: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.lg },
  riderProfileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  riderAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  riderAvatarImage: { width: '100%', height: '100%' },
  riderAvatarText: { color: colors.white, fontFamily: font.bold, fontSize: 15 },
  riderIdentity: { flex: 1, minWidth: 0 },
  sosButton: { width: 44, height: 44, borderRadius: 22, flexShrink: 0, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  riderLabel: { color: colors.gray400, fontFamily: font.bold, fontSize: 10 },
  riderName: { color: colors.gray900, fontFamily: font.semibold, fontSize: 14, marginTop: 2 },
  routeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  label: { color: colors.gray400, fontFamily: font.bold, fontSize: 10, letterSpacing: 0.7 },
  value: { color: colors.gray900, fontFamily: font.semibold, fontSize: 14, marginTop: 4, maxWidth: 170 },
  status: { color: colors.gray500, fontFamily: font.medium, fontSize: 12, marginTop: spacing.lg, marginBottom: spacing.md },

  // ===== Communication buttons =====
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
    backgroundColor: colors.greenDark,
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
    backgroundColor: colors.green,
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
  greenButtonHover: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.green },
  greenButtonHoverText: { color: colors.greenDark },

  // ===== Primary action buttons =====
  primaryButton: { minHeight: 52, marginTop: spacing.md, borderRadius: radius.md, backgroundColor: colors.greenDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  arriveButton: { backgroundColor: colors.green },
  completeButton: { backgroundColor: colors.green },
  primaryButtonText: { color: colors.white, fontFamily: font.bold, fontSize: 15 },
  helper: { color: colors.gray500, fontFamily: font.regular, textAlign: 'center', fontSize: 12, marginTop: spacing.sm },
});
