// mobile/src/screens/ScheduleScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  ScrollView,
  Animated,
  Easing,
  Dimensions,
  ActivityIndicator,
  Modal,
  Pressable,
  Linking,
  Share,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import {
  MapPin,
  LocateFixed,
  ChevronRight,
  Search,
  X,
  Car,
  CalendarDays,
  Clock,
  Clock as ClockIcon,
  CircleUserRound,
  Route as RouteIcon,
  Check,
  Navigation,
  Star,
  Phone,
  MessageCircle,
  Link as LinkIcon,
  Copy,
  MessageSquare,
  ArrowLeft,
  AlertTriangle,
  CreditCard,
  Banknote,
  Circle,
  CheckCircle2,
  House,
} from 'lucide-react-native';
import Button from '../components/Button';
import BottomSheetModal from '../components/BottomSheetModal';
import ChatScreen from './ChatScreen';
import { useToast } from '../components/Toast';
import { colors, radius, spacing, font, shadow } from '../theme/theme';
import apiClient from '../services/ApiClient';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// ---------- Leaflet (web only) ----------
let MapContainer: any = null;
let TileLayer: any = null;
let Marker: any = null;
let Popup: any = null;
let Polyline: any = null;
let useMap: any = null;
let ZoomControl: any = null;

if (Platform.OS === 'web') {
  try {
    const L = require('leaflet');
    const ReactLeaflet = require('react-leaflet');
    MapContainer = ReactLeaflet.MapContainer;
    TileLayer = ReactLeaflet.TileLayer;
    Marker = ReactLeaflet.Marker;
    Popup = ReactLeaflet.Popup;
    Polyline = ReactLeaflet.Polyline;
    useMap = ReactLeaflet.useMap;
    ZoomControl = ReactLeaflet.ZoomControl;

    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  } catch (e) {
    console.warn('Leaflet not available on Schedule screen:', e);
  }
}

type RootStackParamList = {
  Home: { skipActiveRideRestore?: boolean } | undefined;
  Login: undefined;
  RiderHistory: undefined;
  RiderSchedule: undefined;
  RiderProfile: undefined;
  RatingDriver: { rideId: string; driverName?: string };
  Chat: { rideId: string; otherPartyName?: string };
};

type Coords = { latitude: number; longitude: number };
type RoutePoint = [number, number];

type CampusLocation = {
  name: string;
  coords: Coords;
  address?: string;
  category?: string;
};

type ScheduledRide = {
  id: string | number;
  riderId: string | number;
  driverId?: string | number;
  pickupLat: number;
  pickupLng: number;
  destLat?: number;
  destLng?: number;
  pickupAddress: string;
  pickupLocation?: string;
  destinationLat: number;
  destinationLng: number;
  destinationAddress: string;
  destination?: string;
  fare: number;
  distance?: number;
  distanceKm?: number;
  duration?: number;
  durationMinutes?: number;
  scheduledAt?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  currentLat?: number;
  currentLng?: number;
  driver?: {
    id: string | number;
    fullName: string;
    rating: number;
    vehicleMake: string;
    vehicleModel: string;
    licencePlate: string;
    phone?: string;
  };
};

type SavedPaymentCard = { id: string; lastFour: string; label: string; expiry: string; isDefault?: boolean };

const CAMPUS_LOCATIONS: CampusLocation[] = [
  { name: 'Library Complex', coords: { latitude: -28.7411, longitude: 24.7685 }, address: 'Library Road, Kimberley', category: 'Academic' },
  { name: 'Main Lecture Block', coords: { latitude: -28.742, longitude: 24.7695 }, address: 'Academic Avenue, Kimberley', category: 'Academic' },
  { name: 'Residence Block D', coords: { latitude: -28.7435, longitude: 24.7705 }, address: 'Residence Street, Kimberley', category: 'Residence' },
  { name: 'Sports Complex', coords: { latitude: -28.7445, longitude: 24.7715 }, address: 'Sports Road, Kimberley', category: 'Recreation' },
  { name: 'Student Village', coords: { latitude: -28.7455, longitude: 24.7725 }, address: 'Village Drive, Kimberley', category: 'Residence' },
  { name: 'Cafeteria', coords: { latitude: -28.7465, longitude: 24.7735 }, address: 'Food Court Lane, Kimberley', category: 'Dining' },
  { name: 'Main Gate', coords: { latitude: -28.748, longitude: 24.775 }, address: 'Entrance Road, Kimberley', category: 'Entrance' },
];

const FALLBACK_REGION: Coords = { latitude: -28.744, longitude: 24.772 };

const OSRM_ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving';
const PHOTON_SEARCH_URL = 'https://photon.komoot.io/api/';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const BASE_FARE = 5;
const RATE_PER_KM = 4;
const DRIVER_START_POINT: Coords = { latitude: -28.7587766, longitude: 24.759741 };
const DISPATCH_POLL_MS = 5000;
const STATUS_POLL_MS = 3000;
const DISPATCHED_CACHE_KEY = 'scheduledRidesDispatchedIds';
const HELD_RIDES_KEY = 'scheduledRidesHeldPayloads';
const MIN_AGE_BEFORE_DISPATCH_MS = 30_000;
const MAX_SOS_RECORDING_SECONDS = 60;
const SOS_AUDIO_SEGMENT_SECONDS = 5;

// ---------- helpers ----------
function distanceKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function positiveMetric(...values: Array<number | string | null | undefined>): number {
  for (const value of values) {
    const metric = Number(value);
    if (Number.isFinite(metric) && metric > 0) return metric;
  }
  return 0;
}
function normalizeRideMetrics(ride: ScheduledRide): ScheduledRide {
  return {
    ...ride,
    distance: positiveMetric(ride.distance, ride.distanceKm),
    duration: positiveMetric(ride.duration, ride.durationMinutes),
  };
}
function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function formatOsmCategory(tags: Record<string, string>): string {
  if (tags.amenity) return capitalize(tags.amenity.replace(/_/g, ' '));
  if (tags.shop) return capitalize(tags.shop.replace(/_/g, ' '));
  if (tags.tourism) return capitalize(tags.tourism.replace(/_/g, ' '));
  if (tags.aeroway) return 'Airport';
  return 'Place';
}
function estimateFare(km: number) {
  const fare = BASE_FARE + km * RATE_PER_KM;
  return Math.round(fare * 2) / 2;
}
function routeToMapCoords(routeCoords: RoutePoint[]): Coords[] {
  return routeCoords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}
function interpolateRoute(route: Coords[], progress: number): Coords {
  if (!route.length) return FALLBACK_REGION;
  if (route.length === 1) return route[0];
  const clamped = Math.max(0, Math.min(1, progress));
  const normalized = clamped * (route.length - 1);
  const index = Math.min(route.length - 1, Math.max(0, Math.round(normalized)));
  return route[index] || route[0];
}
function estimateRouteProgress(route: Coords[], position: Coords): number {
  if (!route.length) return 0;
  if (route.length === 1) return 1;
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  route.forEach((point, index) => {
    const d = Math.abs(point.latitude - position.latitude) + Math.abs(point.longitude - position.longitude);
    if (d < nearestDistance) {
      nearestDistance = d;
      nearestIndex = index;
    }
  });
  const clampedIndex = Math.min(route.length - 1, Math.max(0, nearestIndex));
  return clampedIndex / Math.max(1, route.length - 1);
}
function getRouteHeading(position: Coords, routePoints: Coords[]): number {
  if (routePoints.length < 2) return 0;
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  routePoints.forEach((point, index) => {
    const d = Math.abs(point.latitude - position.latitude) + Math.abs(point.longitude - position.longitude);
    if (d < nearestDistance) {
      nearestDistance = d;
      nearestIndex = index;
    }
  });
  const nextPoint = routePoints[Math.min(nearestIndex + 1, routePoints.length - 1)];
  const latitudeDelta = nextPoint.latitude - position.latitude;
  const longitudeDelta = nextPoint.longitude - position.longitude;
  return (Math.atan2(longitudeDelta, latitudeDelta) * 180) / Math.PI;
}
function formatScheduleDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = parseServerDate(iso);
  if (!d || Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-ZA', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
function formatTimeHHMM(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}
function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function parseServerDate(input?: string | null): Date | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}
function scheduledTimeMs(ride: { scheduledAt?: string }): number | null {
  const d = parseServerDate(ride.scheduledAt);
  if (!d) return null;
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

async function searchPlacesByText(query: string, bias: Coords): Promise<CampusLocation[]> {
  try {
    const url = `${PHOTON_SEARCH_URL}?q=${encodeURIComponent(query)}&lat=${bias.latitude}&lon=${bias.longitude}&limit=12`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Search request failed');
    const data = await response.json();
    const seen = new Set<string>();
    const results: CampusLocation[] = [];
    for (const feature of data.features || []) {
      const props = feature.properties || {};
      const name = props.name;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const [lon, lat] = feature.geometry.coordinates;
      const addressParts = [props.street, props.district, props.city, props.state].filter(Boolean);
      results.push({
        name,
        coords: { latitude: lat, longitude: lon },
        address: addressParts.length ? addressParts.join(', ') : props.country || 'South Africa',
        category: props.osm_value
          ? capitalize(String(props.osm_value).replace(/_/g, ' '))
          : props.type
          ? capitalize(String(props.type))
          : 'Place',
      });
    }
    return results;
  } catch (error) {
    console.error('Place search error:', error);
    return [];
  }
}

async function fetchNearbyPlaces(center: Coords, radiusMeters = 6000): Promise<CampusLocation[]> {
  const query = `[out:json][timeout:25];(node["amenity"](around:${radiusMeters},${center.latitude},${center.longitude});node["shop"](around:${radiusMeters},${center.latitude},${center.longitude});node["tourism"](around:${radiusMeters},${center.latitude},${center.longitude});node["aeroway"="aerodrome"](around:${radiusMeters},${center.latitude},${center.longitude}););out body 80;`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error('Overpass request failed');
    const data = await response.json();
    const seen = new Set<string>();
    const places: (CampusLocation & { distance: number })[] = [];
    for (const el of data.elements || []) {
      const name = el.tags?.name;
      if (!name || seen.has(name)) continue;
      if (typeof el.lat !== 'number' || typeof el.lon !== 'number') continue;
      seen.add(name);
      const coords = { latitude: el.lat, longitude: el.lon };
      places.push({
        name,
        coords,
        address: el.tags['addr:street']
          ? `${el.tags['addr:housenumber'] ? el.tags['addr:housenumber'] + ' ' : ''}${el.tags['addr:street']}, Kimberley`
          : 'Kimberley, Northern Cape',
        category: formatOsmCategory(el.tags),
        distance: distanceKm(center, coords),
      });
    }
    return places.sort((a, b) => a.distance - b.distance).slice(0, 25);
  } catch {
    return [];
  }
}

async function getRoute(start: Coords, end: Coords): Promise<{ coordinates: RoutePoint[]; distance: number; duration: number }> {
  try {
    const url = `${OSRM_ROUTE_URL}/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson&steps=false`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to get route');
    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No route found');
    const route = data.routes[0];
    return {
      coordinates: route.geometry.coordinates,
      distance: route.distance / 1000,
      duration: route.duration / 60,
    };
  } catch (error) {
    return {
      coordinates: [
        [start.longitude, start.latitude],
        [end.longitude, end.latitude],
      ],
      distance: distanceKm(start, end),
      duration: (distanceKm(start, end) / 25) * 60,
    };
  }
}

// ---------- WebMap ----------
const WebMap = ({
  userLocation,
  destination,
  routePoints,
  places,
  onLocationSelect,
  loading,
  driverPosition,
  driverMarker,
}: {
  userLocation: Coords;
  destination: CampusLocation | null;
  routePoints: Coords[];
  places: CampusLocation[];
  onLocationSelect: (location: CampusLocation) => void;
  loading?: boolean;
  driverPosition?: Coords;
  driverMarker?: boolean;
}) => {
  const [, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const checkLeafletCSS = () => {
        const links = document.querySelectorAll('link[rel="stylesheet"]');
        let leafletLoaded = false;
        links.forEach((link) => {
          if (link.getAttribute('href')?.includes('leaflet')) leafletLoaded = true;
        });
        if (!leafletLoaded) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
          link.crossOrigin = '';
          document.head.appendChild(link);
        }
      };
      checkLeafletCSS();
    }
  }, []);

  const createLocationPinIcon = (color: string, size: number = 28) => {
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
  };

  const createDriverCarIcon = (heading: number) => {
    if (typeof window === 'undefined' || !MapContainer) return null;
    try {
      const L = require('leaflet');
      return L.divIcon({
        className: 'driver-car-marker',
        html: `<div style="width:38px;height:38px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 3px rgba(15,23,42,.4));transform:rotate(${heading}deg)">
          <svg viewBox="0 0 80 120" width="38" height="38" role="img" aria-label="Campus ride vehicle">
            <defs><linearGradient id="topCarBodyS" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cbd5db"/><stop offset=".2" stop-color="#fff"/><stop offset=".8" stop-color="#f8fafc"/><stop offset="1" stop-color="#b8c2c9"/></linearGradient><linearGradient id="topCarGlassS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b5563"/><stop offset="1" stop-color="#111827"/></linearGradient></defs>
            <ellipse cx="40" cy="61" rx="25" ry="55" fill="rgba(15,23,42,.2)"/>
            <path d="M40 3c13 0 22 13 25 29l7 54c2 16-7 29-20 31H28c-13-2-22-15-20-31l7-54C18 16 27 3 40 3Z" fill="url(#topCarBodyS)" stroke="#94a3ad" stroke-width="1.5"/>
            <path d="M27 21c3-9 8-13 13-13s10 4 13 13l5 27H22l5-27Z" fill="url(#topCarGlassS)" stroke="#7c8790" stroke-width="1.2"/>
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
  };

  const MapUpdater = () => {
    const map = useMap();
    useEffect(() => {
      if (!map) return;
      let cancelled = false;
      const updateMap = setTimeout(() => {
        if (cancelled) return;
        try {
          if (typeof map.invalidateSize === 'function') {
            map.invalidateSize();
          }
          const validRoute = Array.isArray(routePoints)
            ? routePoints.filter(
                (p) =>
                  p &&
                  Number.isFinite(p.latitude) &&
                  Number.isFinite(p.longitude) &&
                  Math.abs(p.latitude) <= 90 &&
                  Math.abs(p.longitude) <= 180
              )
            : [];

          if (validRoute.length > 1) {
            const L = require('leaflet');
            const bounds = L.latLngBounds(validRoute.map((p) => [p.latitude, p.longitude]));
            if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
              return;
            }
          }

          if (
            destination &&
            destination.coords &&
            Number.isFinite(destination.coords.latitude) &&
            Number.isFinite(destination.coords.longitude) &&
            Number.isFinite(userLocation.latitude) &&
            Number.isFinite(userLocation.longitude)
          ) {
            const L = require('leaflet');
            const bounds = L.latLngBounds(
              [userLocation.latitude, userLocation.longitude],
              [destination.coords.latitude, destination.coords.longitude]
            );
            if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
              return;
            }
          }

          if (Number.isFinite(userLocation.latitude) && Number.isFinite(userLocation.longitude)) {
            map.setView([userLocation.latitude, userLocation.longitude], 15);
          }
        } catch (err) {
          console.warn('[WebMap] MapUpdater error:', err);
        }
      }, 300);
      return () => {
        cancelled = true;
        clearTimeout(updateMap);
      };
    }, [map, destination, userLocation, routePoints]);
    return null;
  };

  if (!MapContainer || !TileLayer || mapError) {
    return (
      <View style={styles.mapPlaceholder}>
        <ActivityIndicator size="large" color={colors.green} />
        <Text style={styles.mapPlaceholderText}>Loading map...</Text>
      </View>
    );
  }

  try {
    return (
      <View style={{ flex: 1, backgroundColor: '#e8eaed' }}>
        <MapContainer
          center={[userLocation.latitude, userLocation.longitude]}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={false}
          scrollWheelZoom={true}
          dragging={true}
          whenReady={() => setMapReady(true)}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
          <ZoomControl position="topright" />
          <MapUpdater />

          <Marker position={[userLocation.latitude, userLocation.longitude]} icon={createLocationPinIcon('#16a34a', 25)}>
            <Popup>Pickup</Popup>
          </Marker>

          {destination && (
            <Marker position={[destination.coords.latitude, destination.coords.longitude]} icon={createLocationPinIcon('#ef4444', 28)}>
              <Popup>
                <strong>{destination.name}</strong>
                <br />
                <span style={{ fontSize: 12 }}>{destination.address}</span>
              </Popup>
            </Marker>
          )}

          {driverMarker && driverPosition && (
            <Marker
              position={[driverPosition.latitude, driverPosition.longitude]}
              icon={createDriverCarIcon(getRouteHeading(driverPosition, routePoints))}
              zIndexOffset={1000}
            >
              <Popup>Driver location</Popup>
            </Marker>
          )}

          {routePoints.length > 1 && (
            <Polyline
              positions={routePoints.map((p) => [p.latitude, p.longitude])}
              color="#2196F3"
              weight={6}
              opacity={0.9}
              lineCap="round"
              lineJoin="round"
              smoothFactor={1}
            />
          )}

          {loading && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'rgba(0,0,0,0.75)',
                borderRadius: '12px',
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: 'white',
                zIndex: 1000,
              }}
            >
              <div
                className="spinner"
                style={{
                  width: 24,
                  height: 24,
                  border: '3px solid rgba(255,255,255,0.3)',
                  borderTop: '3px solid white',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <span>Calculating route...</span>
            </div>
          )}
        </MapContainer>
      </View>
    );
  } catch (err) {
    console.warn('[WebMap] render error:', err);
    setMapError(true);
    return (
      <View style={styles.mapPlaceholder}>
        <ActivityIndicator size="large" color={colors.green} />
        <Text style={styles.mapPlaceholderText}>Loading map...</Text>
      </View>
    );
  }
};

// ================= MAIN SCREEN =================
export default function ScheduleScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [userId, setUserId] = useState<string>('');
  const [userLocation, setUserLocation] = useState<Coords>(FALLBACK_REGION);
  const [pickupLabel, setPickupLabel] = useState('Current Location');
  const [pickupCoords, setPickupCoords] = useState<Coords>(FALLBACK_REGION);
  const [locating, setLocating] = useState(true);

  const [pickupSheetVisible, setPickupSheetVisible] = useState(false);
  const [pickupSearch, setPickupSearch] = useState('');
  const [pickupSearchResults, setPickupSearchResults] = useState<CampusLocation[]>([]);
  const [pickupSearchLoading, setPickupSearchLoading] = useState(false);

  const [destSheetVisible, setDestSheetVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<CampusLocation[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<CampusLocation[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  const [destination, setDestination] = useState<CampusLocation | null>(null);
  const [date, setDate] = useState<Date>(new Date());
  const [timeString, setTimeString] = useState<string>('08:00');
  const [timePickerVisible, setTimePickerVisible] = useState(false);

  const [routePoints, setRoutePoints] = useState<Coords[]>([]);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [routing, setRouting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [paymentVisible, setPaymentVisible] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [savedPaymentCards, setSavedPaymentCards] = useState<SavedPaymentCard[]>([]);
  const [selectedCard, setSelectedCard] = useState('');
  const [paymentRide, setPaymentRide] = useState<ScheduledRide | null>(null);

  const [scheduledRides, setScheduledRides] = useState<ScheduledRide[]>([]);
  const scheduledRidesRef = useRef<ScheduledRide[]>([]);
  const dispatchedRideIdsRef = useRef<Set<string>>(new Set());
  const [scheduledListVisible, setScheduledListVisible] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  const [nowTick, setNowTick] = useState<number>(Date.now());

  // Finding Drivers overlay
  const [findingDriversVisible, setFindingDriversVisible] = useState(false);
  const [searchingForDriver, setSearchingForDriver] = useState(true);
  const [driverFound, setDriverFound] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [driverRating, setDriverRating] = useState(0);
  const [driverCar, setDriverCar] = useState('');
  const [driverPlate, setDriverPlate] = useState('');
  const [driverPhone, setDriverPhone] = useState('');

  // Active Trip
  const [activeRide, setActiveRide] = useState<ScheduledRide | null>(null);
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [activeTripVisible, setActiveTripVisible] = useState(false);
  const [activeRideLoaded, setActiveRideLoaded] = useState(false);
  const [tripStatus, setTripStatus] = useState<'enroute' | 'arrived' | 'started' | 'completed'>('enroute');
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [riderMessageToast, setRiderMessageToast] = useState('');
  const [chatVisible, setChatVisible] = useState(false);
  const [shareRideVisible, setShareRideVisible] = useState(false);
  const shareSheetAnim = useRef(new Animated.Value(0)).current;

  // SOS
  const [sosVisible, setSosVisible] = useState(false);
  const [sosSending, setSosSending] = useState(false);
  const [sosDispatched, setSosDispatched] = useState(false);
  const [sosRecordingSeconds, setSosRecordingSeconds] = useState(0);
  const sosRecordingSecondsRef = useRef(0);
  const [sosLocation, setSosLocation] = useState<Coords>(FALLBACK_REGION);
  const [showSosRecordingToast, setShowSosRecordingToast] = useState(false);
  const sosAlertIdRef = useRef<number | null>(null);
  const sosWebRecorderRef = useRef<MediaRecorder | null>(null);
  const sosWebStreamRef = useRef<MediaStream | null>(null);
  const sosWebChunksRef = useRef<Blob[]>([]);
  const sosWebSegmentChunksRef = useRef<Blob[]>([]);
  const sosRecordingRef = useRef<Audio.Recording | null>(null);
  const sosUploadingRef = useRef(false);
  const sosTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sosToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sosWaveAnimationsRef = useRef(Array.from({ length: 11 }, () => new Animated.Value(0.55)));

  // Rating
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [showRatingThankYou, setShowRatingThankYou] = useState(false);

  // Driver nav
  const [driverRoutePoints, setDriverRoutePoints] = useState<Coords[]>([]);
  const [driverCarPosition, setDriverCarPosition] = useState<Coords>(DRIVER_START_POINT);
  const [driverProgress, setDriverProgress] = useState(0);
  const [driverRouteKey, setDriverRouteKey] = useState<string>('idle');
  const driverAnimationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const driverRouteRequestRef = useRef(0);
  const lastLoadedRouteKeyRef = useRef<string>('idle');
  const activeTripShownForRideRef = useRef<string | null>(null);

  // Polls / animations
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dispatchCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dispatchAlarmRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const findingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const showActiveTripTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenMessageIdsRef = useRef<Set<number>>(new Set());
  const riderToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickupSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const driverFadeAnim = useRef(new Animated.Value(0)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const rotateLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // ---------- boot ----------
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('user');
        if (raw) {
          const user = JSON.parse(raw);
          if (user?.id) setUserId(String(user.id));
        }
      } catch {}
      try {
        const cache = await AsyncStorage.getItem(DISPATCHED_CACHE_KEY);
        if (cache) {
          const arr: string[] = JSON.parse(cache);
          if (Array.isArray(arr)) dispatchedRideIdsRef.current = new Set(arr.map(String));
        }
      } catch {}
    })();
    detectLocation();
  }, []);

  useEffect(() => {
    scheduledRidesRef.current = scheduledRides;
  }, [scheduledRides]);

  useEffect(() => {
    if (countdownTickRef.current) clearInterval(countdownTickRef.current);
    countdownTickRef.current = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => {
      if (countdownTickRef.current) clearInterval(countdownTickRef.current);
    };
  }, []);

  const persistDispatched = async () => {
    try {
      await AsyncStorage.setItem(
        DISPATCHED_CACHE_KEY,
        JSON.stringify(Array.from(dispatchedRideIdsRef.current))
      );
    } catch {}
  };

  const loadHeldPayloads = async (): Promise<Record<string, ScheduledRide>> => {
    try {
      const raw = await AsyncStorage.getItem(HELD_RIDES_KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === 'object' ? obj : {};
    } catch {
      return {};
    }
  };
  const saveHeldPayload = async (ride: ScheduledRide) => {
    try {
      const current = await loadHeldPayloads();
      current[String(ride.id)] = ride;
      await AsyncStorage.setItem(HELD_RIDES_KEY, JSON.stringify(current));
    } catch {}
  };
  const removeHeldPayload = async (rideId: string | number) => {
    try {
      const current = await loadHeldPayloads();
      delete current[String(rideId)];
      await AsyncStorage.setItem(HELD_RIDES_KEY, JSON.stringify(current));
    } catch {}
  };

  const clearScheduledDispatchAlarm = () => {
    if (dispatchAlarmRef.current) {
      clearTimeout(dispatchAlarmRef.current);
      dispatchAlarmRef.current = null;
    }
  };

  const scheduleNextScheduledDispatch = () => {
    clearScheduledDispatchAlarm();

    const nextRide = [...scheduledRidesRef.current]
      .filter((ride) => {
        const st = String(ride.status || '').toLowerCase();
        if (st !== 'scheduled') return false;
        const rideId = String(ride.id);
        if (!rideId || dispatchedRideIdsRef.current.has(rideId)) return false;
        const t = scheduledTimeMs(ride);
        return t != null && t > Date.now() - 1000;
      })
      .sort((a, b) => {
        const at = scheduledTimeMs(a) ?? Number.MAX_SAFE_INTEGER;
        const bt = scheduledTimeMs(b) ?? Number.MAX_SAFE_INTEGER;
        return at - bt;
      })[0];

    if (!nextRide) return;

    const t = scheduledTimeMs(nextRide);
    if (t == null) return;
    const waitMs = Math.max(0, t - Date.now());

    dispatchAlarmRef.current = setTimeout(() => {
      void checkAndDispatchDueRides();
    }, waitMs);
  };

  useFocusEffect(
    useCallback(() => {
      const refreshDueRides = async () => {
        await loadScheduledRides();
        await checkAndDispatchDueRides();
        scheduleNextScheduledDispatch();
      };
      void refreshDueRides();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  useEffect(() => {
    if (dispatchCheckRef.current) clearInterval(dispatchCheckRef.current);
    dispatchCheckRef.current = setInterval(() => {
      void checkAndDispatchDueRides();
      scheduleNextScheduledDispatch();
    }, DISPATCH_POLL_MS);
    return () => {
      if (dispatchCheckRef.current) clearInterval(dispatchCheckRef.current);
      clearScheduledDispatchAlarm();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (statusPollRef.current) clearInterval(statusPollRef.current);
      if (dispatchCheckRef.current) clearInterval(dispatchCheckRef.current);
      if (countdownTickRef.current) clearInterval(countdownTickRef.current);
      if (findingTimerRef.current) clearInterval(findingTimerRef.current);
      if (messagePollRef.current) clearInterval(messagePollRef.current);
      if (driverAnimationRef.current) clearInterval(driverAnimationRef.current);
      if (riderToastTimerRef.current) clearTimeout(riderToastTimerRef.current);
      if (showActiveTripTimeoutRef.current) clearTimeout(showActiveTripTimeoutRef.current);
      if (sosTimerRef.current) clearInterval(sosTimerRef.current);
      if (sosToastTimerRef.current) clearTimeout(sosToastTimerRef.current);
      clearScheduledDispatchAlarm();
      pulseLoopRef.current?.stop();
      rotateLoopRef.current?.stop();
    };
  }, []);

  const startFindingDriversAnimations = () => {
    pulseLoopRef.current?.stop();
    rotateLoopRef.current?.stop();
    pulseAnim.setValue(1);
    rotateAnim.setValue(0);
    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulseLoopRef.current.start();
    rotateLoopRef.current = Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true })
    );
    rotateLoopRef.current.start();
    driverFadeAnim.setValue(0);
  };

  const stopFindingDriversAnimations = () => {
    pulseLoopRef.current?.stop();
    rotateLoopRef.current?.stop();
  };

  const detectLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPickupLabel('SPU Kimberley Campus');
        setLocating(false);
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setUserLocation(coords);
      setPickupCoords(coords);
      setPickupLabel('Current Location');
      loadNearbyPlaces(coords);
      if (destination) updateRoute(coords, destination);
    } catch {
      setPickupLabel('SPU Kimberley Campus');
    } finally {
      setLocating(false);
    }
  };

  const loadNearbyPlaces = async (coords: Coords) => {
    setNearbyLoading(true);
    const places = await fetchNearbyPlaces(coords);
    setNearbyPlaces(places);
    setNearbyLoading(false);
  };

  const updateRoute = async (pickup: Coords, dropoff: CampusLocation) => {
    setRouting(true);
    try {
      const route = await getRoute(pickup, dropoff.coords);
      setRoutePoints(routeToMapCoords(route.coordinates));
      setRouteDistance(route.distance);
      setRouteDuration(route.duration);
    } catch {
      const dist = distanceKm(pickup, dropoff.coords);
      setRoutePoints([pickup, dropoff.coords]);
      setRouteDistance(dist);
      setRouteDuration((dist / 25) * 60);
    } finally {
      setRouting(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearch(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setShowSearchResults(false);
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setShowSearchResults(true);
    setSearchLoading(true);
    searchDebounceRef.current = setTimeout(async () => {
      const results = await searchPlacesByText(trimmed, userLocation);
      setSearchResults(results);
      setSearchLoading(false);
    }, 400);
  };

  const handlePickupSearch = (text: string) => {
    setPickupSearch(text);
    if (pickupSearchDebounceRef.current) clearTimeout(pickupSearchDebounceRef.current);
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setPickupSearchResults([]);
      setPickupSearchLoading(false);
      return;
    }
    setPickupSearchLoading(true);
    pickupSearchDebounceRef.current = setTimeout(async () => {
      const results = await searchPlacesByText(trimmed, userLocation);
      setPickupSearchResults(results);
      setPickupSearchLoading(false);
    }, 400);
  };

  const selectPickupLocation = (location: CampusLocation) => {
    setPickupCoords(location.coords);
    setUserLocation(location.coords);
    setPickupLabel(location.address ? `${location.name}, ${location.address}` : location.name);
    setPickupSheetVisible(false);
    setPickupSearch('');
    setPickupSearchResults([]);
    loadNearbyPlaces(location.coords);
    if (destination) updateRoute(location.coords, destination);
    showToast(`Pickup set to ${location.name}`, 'green');
  };

  const handleLocationSelect = async (location: CampusLocation) => {
    setDestination(location);
    setDestSheetVisible(false);
    setSearch('');
    setShowSearchResults(false);
    setSearchResults([]);
    await updateRoute(pickupCoords, location);
    showToast(`Route to ${location.name}`, 'green');
  };

  const filteredLocations = useMemo(() => {
    if (showSearchResults) {
      const query = search.trim().toLowerCase();
      const campusMatches = CAMPUS_LOCATIONS.filter((loc) => loc.name.toLowerCase().includes(query));
      return [...campusMatches, ...searchResults];
    }
    const combined = [...CAMPUS_LOCATIONS, ...nearbyPlaces]
      .map((loc) => ({ ...loc, distance: distanceKm(userLocation, loc.coords) }))
      .sort((a, b) => a.distance - b.distance);
    return combined.slice(0, 15);
  }, [search, userLocation, searchResults, showSearchResults, nearbyPlaces]);

  const tripDistanceKm = routeDistance || (destination ? distanceKm(pickupCoords, destination.coords) : 0);
  const fare = tripDistanceKm > 0 ? estimateFare(tripDistanceKm) : 0;
  const etaMinutes = routeDuration || (destination ? (tripDistanceKm / 25) * 60 : 0);

  const dateOptions = useMemo(
    () =>
      [0, 1, 2, 3].map((offset) => {
        const value = new Date();
        value.setDate(value.getDate() + offset);
        return value;
      }),
    []
  );

  const scheduledDateTime = useMemo(() => {
    const [hh, mm] = timeString.split(':').map(Number);
    const d = new Date(date);
    d.setHours(hh || 0, mm || 0, 0, 0);
    return d;
  }, [date, timeString]);

  const isFutureTime = scheduledDateTime.getTime() > Date.now() + 30 * 1000;
  const formMsRemaining = useMemo(() => scheduledDateTime.getTime() - nowTick, [scheduledDateTime, nowTick]);

  const nextScheduledRide = useMemo(() => {
    const candidates = scheduledRides
      .filter((r) => String(r.status || '').toLowerCase() === 'scheduled')
      .map((r) => ({ ride: r, t: scheduledTimeMs(r) ?? Number.MAX_SAFE_INTEGER }))
      .sort((a, b) => a.t - b.t);
    return candidates[0]?.ride ?? null;
  }, [scheduledRides]);

  const nextScheduledMsRemaining = useMemo(() => {
    if (!nextScheduledRide) return null;
    const t = scheduledTimeMs(nextScheduledRide);
    if (t == null) return null;
    return t - nowTick;
  }, [nextScheduledRide, nowTick]);

  const upcomingCount = scheduledRides.filter((r) => {
    const s = String(r.status || '').toLowerCase();
    return s === 'scheduled' || s === 'pending';
  }).length;

  const badgeMsRemaining = useMemo(() => {
    const candidates: number[] = [];
    if (formMsRemaining > 0) candidates.push(formMsRemaining);
    if (nextScheduledMsRemaining != null && nextScheduledMsRemaining > 0) candidates.push(nextScheduledMsRemaining);
    if (!candidates.length) return null;
    return Math.min(...candidates);
  }, [formMsRemaining, nextScheduledMsRemaining]);

  const badgeTargetLabel = useMemo(() => {
    if (formMsRemaining > 0 && (nextScheduledMsRemaining == null || formMsRemaining <= nextScheduledMsRemaining)) {
      return formatTimeHHMM(scheduledDateTime);
    }
    if (nextScheduledRide?.scheduledAt) {
      const d = parseServerDate(nextScheduledRide.scheduledAt);
      return d ? formatTimeHHMM(d) : '—';
    }
    return formatTimeHHMM(scheduledDateTime);
  }, [formMsRemaining, nextScheduledMsRemaining, nextScheduledRide, scheduledDateTime]);

  const webTimeInputRef = useRef<HTMLInputElement | null>(null);
  const onPickTime = () => {
    if (Platform.OS === 'web') {
      if (webTimeInputRef.current) {
        (webTimeInputRef.current as any).showPicker?.();
        webTimeInputRef.current.click();
      } else {
        setTimePickerVisible(true);
      }
    } else {
      setTimePickerVisible(true);
    }
  };

  const adjustTime = (deltaMinutes: number) => {
    const [hh, mm] = timeString.split(':').map(Number);
    const base = new Date();
    base.setHours(hh || 0, mm || 0, 0, 0);
    base.setMinutes(base.getMinutes() + deltaMinutes);
    setTimeString(formatTimeHHMM(base));
  };

  const hydrateActiveRide = useCallback(
    (ride: ScheduledRide): ScheduledRide => {
      const fallbackDestName = destination?.name || (destination as any)?.address || '';
      const fallbackDestLat = destination?.coords.latitude;
      const fallbackDestLng = destination?.coords.longitude;
      return {
        ...ride,
        pickupLat: Number((ride as any).pickupLat ?? (ride as any).pickup_lat ?? pickupCoords.latitude),
        pickupLng: Number((ride as any).pickupLng ?? (ride as any).pickup_lng ?? pickupCoords.longitude),
        pickupAddress: ride.pickupAddress || ride.pickupLocation || pickupLabel || 'Current Location',
        destinationLat: Number((ride as any).destinationLat ?? (ride as any).destLat ?? fallbackDestLat ?? 0),
        destinationLng: Number((ride as any).destinationLng ?? (ride as any).destLng ?? fallbackDestLng ?? 0),
        destinationAddress: ride.destinationAddress || ride.destination || fallbackDestName || 'Destination',
        destination: ride.destination || fallbackDestName || 'Destination',
        fare: Number(ride.fare) > 0 ? Number(ride.fare) : fare || 0,
        distance: positiveMetric(ride.distance, ride.distanceKm),
        duration: positiveMetric(ride.duration, ride.durationMinutes),
      };
    },
    [destination, pickupCoords.latitude, pickupCoords.longitude, pickupLabel, fare, tripDistanceKm, etaMinutes]
  );

  const submitScheduledRide = async () => {
    if (!pickupLabel.trim()) return showToast('Please choose a pickup location', 'red');
    if (!destination) return showToast('Please choose a destination', 'red');
    if (!isFutureTime) return showToast('Please choose a time at least 30 seconds in the future', 'red');
    if (!userId) return showToast('Please login again', 'red');

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        showToast('Please login again', 'red');
        setSaving(false);
        return;
      }

      const pad = (n: number) => String(n).padStart(2, '0');
      const localScheduledAt =
        `${scheduledDateTime.getFullYear()}-${pad(scheduledDateTime.getMonth() + 1)}-${pad(
          scheduledDateTime.getDate()
        )}T${pad(scheduledDateTime.getHours())}:${pad(scheduledDateTime.getMinutes())}:${pad(
          scheduledDateTime.getSeconds()
        )}`;

      const payload = {
        riderId: userId,
        pickupLocation: pickupLabel,
        pickupLat: pickupCoords.latitude,
        pickupLng: pickupCoords.longitude,
        pickupAddress: pickupLabel,
        destination: destination.name,
        destinationLat: destination.coords.latitude,
        destinationLng: destination.coords.longitude,
        destLat: destination.coords.latitude,
        destLng: destination.coords.longitude,
        destinationAddress: destination.name,
        fare,
        distance: tripDistanceKm,
        distanceKm: tripDistanceKm,
        duration: etaMinutes,
        scheduledAt: localScheduledAt,
        status: 'scheduled',
        isScheduled: true,
        autoDispatch: false,
      };

      const response = await apiClient.post('/rides/request', payload);
      const newRide: ScheduledRide = response.data;
      setPaymentRide(newRide);
      const [cardsRaw, preferredMethod] = await Promise.all([
        AsyncStorage.getItem('saved_cards'),
        AsyncStorage.getItem('default_payment_method'),
      ]);
      const cards: SavedPaymentCard[] = cardsRaw ? JSON.parse(cardsRaw) : [];
      const preferredCard = cards.find((card) => card.isDefault) || cards[0];
      setSavedPaymentCards(cards);
      setSelectedCard(preferredCard?.id || '');
      setPaymentMethod(preferredMethod === 'CARD' && preferredCard ? 'CARD' : 'CASH');
      setPaymentVisible(true);
    } catch (error: any) {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        showToast('Session expired. Please login again.', 'red');
        await AsyncStorage.multiRemove(['authToken', 'user']);
        setTimeout(() => navigation.replace('Login'), 1000);
      } else if (error?.response?.data?.message || error?.response?.data?.error) {
        showToast(error.response.data.message || error.response.data.error, 'red');
      } else if (error?.message === 'Network Error') {
        showToast('Network error. Please check your internet connection.', 'red');
      } else {
        showToast('Could not schedule ride. Please try again.', 'red');
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmPayment = async () => {
    if (!paymentRide?.id) return;
    const chosenCard = savedPaymentCards.find((card) => card.id === selectedCard);
    if (paymentMethod === 'CARD' && !chosenCard) {
      showToast('Add a saved card in Profile before choosing card payment', 'red');
      return;
    }
    try {
      await apiClient.post(`/rides/${paymentRide.id}/payment`, {
        method: paymentMethod,
        ...(paymentMethod === 'CARD' && chosenCard ? { cardLastFour: chosenCard.lastFour } : {}),
      });
      setPaymentVisible(false);

      const when = formatScheduleDateTime(paymentRide.scheduledAt);
      showToast(`Ride scheduled for ${when}`, 'green');

      await saveHeldPayload(paymentRide);

      setRoutePoints([]);
      setRouteDistance(null);
      setRouteDuration(null);
      setTimeString('08:00');
      setDate(new Date());

      await loadScheduledRides();
      scheduleNextScheduledDispatch();
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'Could not save payment method', 'red');
    }
  };

  const loadScheduledRides = async () => {
    setListLoading(true);
    try {
      let rides: ScheduledRide[] = [];
      try {
        const response = await apiClient.get('/rides/scheduled');
        rides = response.data || [];
      } catch {
        try {
          const [activeRes, historyRes] = await Promise.all([
            apiClient.get('/rides/active').catch(() => ({ data: null })),
            apiClient.get('/rides/history').catch(() => ({ data: [] })),
          ]);
          const active = activeRes.data ? [activeRes.data] : [];
          const history = Array.isArray(historyRes.data) ? historyRes.data : [];
          rides = [...active, ...history];
        } catch {
          rides = [];
        }
      }
      const relevant = rides.map(normalizeRideMetrics).filter((r) => {
        const st = String(r.status || '').toLowerCase();
        return (
          st === 'scheduled' ||
          st === 'pending' ||
          st === 'accepted' ||
          st === 'enroute' ||
          st === 'arrived' ||
          st === 'started' ||
          (st === 'completed' && !!r.scheduledAt)
        );
      });
      scheduledRidesRef.current = relevant;
      setScheduledRides(relevant);
      scheduleNextScheduledDispatch();
    } finally {
      setListLoading(false);
    }
  };

  const checkAndDispatchDueRides = async () => {
    const now = Date.now();
    const list = scheduledRidesRef.current;
    const held = await loadHeldPayloads();
    const due: ScheduledRide[] = [];

    for (const r of list) {
      const st = String(r.status || '').toLowerCase();
      if (st !== 'scheduled') continue;

      const rideIdStr = String(r.id);
      if (!rideIdStr) continue;
      if (dispatchedRideIdsRef.current.has(rideIdStr)) continue;

      const t = scheduledTimeMs(r);
      if (t == null) continue;

      const createdAtMs = parseServerDate((r as any).createdAt)?.getTime();
      if (createdAtMs && now - createdAtMs < MIN_AGE_BEFORE_DISPATCH_MS) continue;

      if (now < t) continue;

      due.push(r);
    }

    if (!due.length) return;

    for (const ride of due) {
      const rideIdStr = String(ride.id);
      dispatchedRideIdsRef.current.add(rideIdStr);
      try {
        try {
          await apiClient.post(`/rides/${ride.id}/dispatch`);
        } catch {
          await apiClient.post(`/rides/${ride.id}/start-search`);
        }
        await removeHeldPayload(rideIdStr);
      } catch (e) {
        dispatchedRideIdsRef.current.delete(rideIdStr);
      }
    }
    void persistDispatched();

    const primary = due[0];
    if (primary) {
      openFindingDriversFlow(String(primary.id));
    }
    await loadScheduledRides();
    scheduleNextScheduledDispatch();
  };

  const enterRideSession = async (rideId: string, seedRide?: ScheduledRide) => {
    const seed = seedRide ?? scheduledRidesRef.current.find((r) => String(r.id) === rideId);
    if (seed) {
      const hydratedRide = hydrateActiveRide(seed);
      setActiveRide(hydratedRide);

      if (!hydratedRide.distance || !hydratedRide.duration) {
        const pickup = {
          latitude: Number((seed as any).pickupLat ?? (seed as any).pickup_lat),
          longitude: Number((seed as any).pickupLng ?? (seed as any).pickup_lng),
        };
        const dropoff = {
          latitude: Number(seed.destLat ?? (seed as any).destinationLat ?? (seed as any).dest_lat),
          longitude: Number(seed.destLng ?? (seed as any).destinationLng ?? (seed as any).dest_lng),
        };
        const routeCoordinates = [pickup.latitude, pickup.longitude, dropoff.latitude, dropoff.longitude];
        if (routeCoordinates.every(Number.isFinite) && !(routeCoordinates.every((coordinate) => coordinate === 0))) {
          void getRoute(pickup, dropoff).then((route) => {
            setActiveRide((current) => {
              if (!current || String(current.id) !== rideId) return current;
              return {
                ...current,
                distance: hydratedRide.distance || route.distance,
                duration: hydratedRide.duration || route.duration,
              };
            });
          });
        }
      }
    }

    setActiveRideId(rideId);
    setActiveRideLoaded(!!seed);
    activeTripShownForRideRef.current = null;

    const st = String(seed?.status || 'scheduled').toLowerCase();

    if (['accepted', 'enroute', 'arrived', 'started', 'completed'].includes(st)) {
      setFindingDriversVisible(false);
      setActiveTripVisible(true);
      clearDriverNavigation();
    } else {
      setFindingDriversVisible(true);
      setSearchingForDriver(true);
      setDriverFound(false);
      setActiveTripVisible(false);
      setElapsedSeconds(0);
      clearDriverNavigation();
      startFindingDriversAnimations();
      if (findingTimerRef.current) clearInterval(findingTimerRef.current);
      findingTimerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }

    startStatusPolling(rideId, {
      fromFinding: !['accepted', 'enroute', 'arrived', 'started', 'completed'].includes(st),
    });
  };

  const openFindingDriversFlow = (rideId: string) => {
    if (activeRideId === rideId && (findingDriversVisible || activeTripVisible)) return;
    setElapsedSeconds(0);
    void enterRideSession(rideId);
  };

  const closeFindingDrivers = () => {
    setFindingDriversVisible(false);
    setSearchingForDriver(true);
    setDriverFound(false);
    setCancelling(false);
    setActiveTripVisible(false);
    setActiveRide(null);
    setActiveRideId(null);
    setActiveRideLoaded(false);
    clearDriverNavigation();
    stopFindingDriversAnimations();
    if (findingTimerRef.current) {
      clearInterval(findingTimerRef.current);
      findingTimerRef.current = null;
    }
    if (statusPollRef.current) {
      clearInterval(statusPollRef.current);
      statusPollRef.current = null;
    }
    if (showActiveTripTimeoutRef.current) {
      clearTimeout(showActiveTripTimeoutRef.current);
      showActiveTripTimeoutRef.current = null;
    }
  };

  const startStatusPolling = (rideId: string, opts?: { fromFinding?: boolean }) => {
    if (statusPollRef.current) clearInterval(statusPollRef.current);
    setActiveRideId(rideId);
    if (opts?.fromFinding) {
      setFindingDriversVisible(true);
      setActiveTripVisible(false);
    }

    const poll = async () => {
      try {
        const response = await apiClient.get(`/rides/${rideId}/status`);
        const ride: ScheduledRide = response.data;
        if (!ride || !ride.status) return;
        const normalizedRide = {
          ...(activeRide || ({} as ScheduledRide)),
          ...ride,
          ...(ride.currentLat != null ? { currentLat: Number(ride.currentLat) } : {}),
          ...(ride.currentLng != null ? { currentLng: Number(ride.currentLng) } : {}),
        } as ScheduledRide;
        setActiveRide((prev) => hydrateActiveRide({ ...(prev || ({} as ScheduledRide)), ...normalizedRide }));
        setActiveRideLoaded(true);

        if (Number.isFinite(ride.currentLat as any) && Number.isFinite(ride.currentLng as any)) {
          setDriverCarPosition({ latitude: Number(ride.currentLat), longitude: Number(ride.currentLng) });
          if (driverRoutePoints.length > 1) {
            setDriverProgress(
              estimateRouteProgress(driverRoutePoints, {
                latitude: Number(ride.currentLat),
                longitude: Number(ride.currentLng),
              })
            );
          }
        }

        const status = String(ride.status || '').toLowerCase();

        if (status === 'pending') {
          if (!findingDriversVisible && !activeTripVisible) setFindingDriversVisible(true);
          setSearchingForDriver(true);
          setDriverFound(false);
          return;
        }

        if (['accepted', 'enroute', 'arrived', 'started'].includes(status)) {
          if (ride.driver) {
            setDriverName(ride.driver.fullName || '');
            setDriverRating(ride.driver.rating || 0);
            setDriverCar(`${ride.driver.vehicleMake || ''} ${ride.driver.vehicleModel || ''}`.trim());
            setDriverPlate(ride.driver.licencePlate || '');
            setDriverPhone(ride.driver.phone || '');
            Animated.timing(driverFadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
          }
          setSearchingForDriver(false);
          setDriverFound(true);
          setTripStatus(status === 'accepted' ? 'enroute' : (status as 'enroute' | 'arrived' | 'started'));

          if (activeTripShownForRideRef.current !== rideId) {
            activeTripShownForRideRef.current = rideId;
            if (showActiveTripTimeoutRef.current) clearTimeout(showActiveTripTimeoutRef.current);
            showActiveTripTimeoutRef.current = setTimeout(() => {
              setFindingDriversVisible(false);
              setActiveTripVisible(true);
              stopFindingDriversAnimations();
              if (findingTimerRef.current) {
                clearInterval(findingTimerRef.current);
                findingTimerRef.current = null;
              }
            }, 900);
          } else {
            setFindingDriversVisible(false);
            setActiveTripVisible(true);
          }
          return;
        }

        if (status === 'completed') {
          setTripStatus('completed');
          setFindingDriversVisible(false);
          setActiveTripVisible(true);
          if (statusPollRef.current) {
            clearInterval(statusPollRef.current);
            statusPollRef.current = null;
          }
          setShowRatingModal(true);
          return;
        }

        if (status === 'cancelled') {
          if (statusPollRef.current) {
            clearInterval(statusPollRef.current);
            statusPollRef.current = null;
          }
          closeFindingDrivers();
          showToast('Trip was cancelled', 'red');
          void loadScheduledRides();
        }
      } catch (err) {
        // keep polling
      }
    };

    poll();
    statusPollRef.current = setInterval(poll, STATUS_POLL_MS);
  };

  const loadDriverRoute = async (start: Coords, end: Coords, status: string) => {
    const requestId = ++driverRouteRequestRef.current;
    const waitingAtPickup = status === 'arrived';
    const initialStart = waitingAtPickup ? end : start;
    const initialProgress = waitingAtPickup ? 1 : 0.08;
    setDriverProgress(initialProgress);
    setDriverCarPosition(initialStart);
    setDriverRoutePoints([start, end]);
    setDriverRouteKey(`${start.latitude},${start.longitude}->${end.latitude},${end.longitude}@${status}`);

    try {
      const route = await getRoute(start, end);
      const points = routeToMapCoords(route.coordinates);
      if (requestId !== driverRouteRequestRef.current) return;
      const resolvedPoints = points.length > 1 ? points : [start, end];
      setDriverRoutePoints(resolvedPoints);
      setDriverCarPosition(interpolateRoute(resolvedPoints, initialProgress));
    } catch {
      if (requestId !== driverRouteRequestRef.current) return;
      setDriverRoutePoints([start, end]);
      setDriverCarPosition(interpolateRoute([start, end], initialProgress));
    }
  };

  const clearDriverNavigation = () => {
    driverRouteRequestRef.current += 1;
    setDriverRoutePoints([]);
    setDriverCarPosition(DRIVER_START_POINT);
    setDriverProgress(0);
    setDriverRouteKey('idle');
    lastLoadedRouteKeyRef.current = 'idle';
  };

  const driverPhase = String(activeRide?.status || tripStatus || '').toLowerCase();
  const driverHeadingToPickup = driverPhase === 'accepted' || driverPhase === 'enroute' || driverPhase === 'pending';
  const driverIsArrivalPhase = driverPhase === 'arrived';
  const driverIsDestinationPhase = driverPhase === 'started';
  const tripCompleted = driverPhase === 'completed' || tripStatus === 'completed';

  useEffect(() => {
    if (!activeTripVisible || !activeRide) return;
    if (tripCompleted) return;
    if (!['accepted', 'enroute', 'arrived', 'started'].includes(driverPhase)) return;

    const pickup: Coords = {
      latitude: Number((activeRide as any).pickupLat ?? (activeRide as any).pickup_lat),
      longitude: Number((activeRide as any).pickupLng ?? (activeRide as any).pickup_lng),
    };
    const dropoff: Coords = {
      latitude: Number((activeRide as any).destinationLat ?? (activeRide as any).destLat),
      longitude: Number((activeRide as any).destinationLng ?? (activeRide as any).destLng),
    };
    if (!Number.isFinite(pickup.latitude) || !Number.isFinite(pickup.longitude)) return;
    if (!Number.isFinite(dropoff.latitude) || !Number.isFinite(dropoff.longitude)) return;

    const headingToPickup = driverPhase === 'accepted' || driverPhase === 'enroute';
    const waitingAtPickup = driverPhase === 'arrived';
    const start = headingToPickup || waitingAtPickup ? DRIVER_START_POINT : pickup;
    const end = headingToPickup || waitingAtPickup ? pickup : dropoff;

    const key = `${start.latitude},${start.longitude}->${end.latitude},${end.longitude}@${driverPhase}`;
    if (lastLoadedRouteKeyRef.current === key) return;
    lastLoadedRouteKeyRef.current = key;

    void loadDriverRoute(start, end, driverPhase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTripVisible, activeRide?.id, driverPhase, tripCompleted]);

  useEffect(() => {
    if (!activeRide) return;
    const liveLat = Number((activeRide as any).currentLat ?? (activeRide as any).current_lat);
    const liveLng = Number((activeRide as any).currentLng ?? (activeRide as any).current_lng);
    if (Number.isFinite(liveLat) && Number.isFinite(liveLng) && driverRoutePoints.length > 1) {
      const nextPosition = { latitude: liveLat, longitude: liveLng };
      setDriverCarPosition(nextPosition);
      setDriverProgress(estimateRouteProgress(driverRoutePoints, nextPosition));
    }
  }, [activeRide, driverRoutePoints]);

  useEffect(() => {
    const canMove = driverHeadingToPickup || driverIsDestinationPhase;
    if (tripCompleted) {
      if (driverAnimationRef.current) {
        clearInterval(driverAnimationRef.current);
        driverAnimationRef.current = null;
      }
      return;
    }

    if (driverRoutePoints.length > 0) {
      setDriverCarPosition(interpolateRoute(driverRoutePoints, driverProgress));
    }

    if (!driverRoutePoints.length || !canMove) {
      if (driverAnimationRef.current) {
        clearInterval(driverAnimationRef.current);
        driverAnimationRef.current = null;
      }
      return;
    }

    if (driverAnimationRef.current) {
      clearInterval(driverAnimationRef.current);
      driverAnimationRef.current = null;
    }

    driverAnimationRef.current = setInterval(() => {
      setDriverProgress((current) => {
        const next = Math.min(1, Math.max(current, 0.08) + 0.0125);
        const nextPosition = interpolateRoute(driverRoutePoints, next);
        setDriverCarPosition(nextPosition);
        if (next >= 1 && driverAnimationRef.current) {
          clearInterval(driverAnimationRef.current);
          driverAnimationRef.current = null;
        }
        return next;
      });
    }, 500);

    return () => {
      if (driverAnimationRef.current) {
        clearInterval(driverAnimationRef.current);
        driverAnimationRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverRouteKey, driverHeadingToPickup, driverIsDestinationPhase, tripCompleted, driverProgress]);

  useEffect(() => {
    if (!activeRideId || !userId || !activeTripVisible) return;
    if (messagePollRef.current) clearInterval(messagePollRef.current);
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await apiClient.get(`/rides/${activeRideId}/messages`);
        const messages: { id: number; senderId: number; message: string; senderName?: string }[] = response.data || [];
        if (cancelled) return;
        const firstPoll = seenMessageIdsRef.current.size === 0;
        const incoming = messages.filter((m) => m.senderId !== Number(userId) && !seenMessageIdsRef.current.has(m.id));
        messages.forEach((m) => seenMessageIdsRef.current.add(m.id));
        if (!firstPoll && incoming.length > 0) {
          const latest = incoming[incoming.length - 1];
          setRiderMessageToast(`${latest.senderName || 'Driver'}: ${latest.message}`);
          if (riderToastTimerRef.current) clearTimeout(riderToastTimerRef.current);
          riderToastTimerRef.current = setTimeout(() => setRiderMessageToast(''), 3200);
          setUnreadMessageCount((c) => c + incoming.length);
        }
      } catch {}
    };
    poll();
    messagePollRef.current = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      if (messagePollRef.current) clearInterval(messagePollRef.current);
    };
  }, [activeRideId, userId, activeTripVisible]);

  const handleCancelSearch = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      if (activeRideId) await apiClient.post(`/rides/${activeRideId}/cancel`);
      showToast('Ride search cancelled', 'blue');
      setTimeout(() => closeFindingDrivers(), 400);
    } catch {
      showToast('Could not cancel ride', 'red');
      setCancelling(false);
    }
  };

  const handleCallDriver = () => {
    if (driverPhone) {
      const phoneUrl = `tel:${driverPhone.replace(/[^\d+]/g, '')}`;
      Linking.openURL(phoneUrl).catch(() => showToast(`Could not call ${driverName || 'the driver'}`, 'red'));
    } else {
      showToast('Driver phone number not available', 'red');
    }
  };

  const handleMessageDriver = () => {
    if (activeRideId) {
      setUnreadMessageCount(0);
      setChatVisible(true);
    } else {
      showToast('The active ride is not available', 'red');
    }
  };

  const openShareRideSheet = () => {
    setShareRideVisible(true);
    shareSheetAnim.setValue(0);
    Animated.timing(shareSheetAnim, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };
  const closeShareRideSheet = () => {
    Animated.timing(shareSheetAnim, { toValue: 0, duration: 170, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (finished) setShareRideVisible(false);
    });
  };
  const shareLink = activeRideId ? `campusconnect.app/t/${activeRideId}` : '';
  const handleCopyRideLink = async () => {
    try {
      if (Platform.OS === 'web' && (navigator as any).clipboard) {
        await (navigator as any).clipboard.writeText(shareLink);
      } else {
        await Share.share({ message: shareLink });
      }
      showToast('Ride link copied', 'green');
    } catch {
      showToast('Could not copy ride link', 'red');
    }
  };
  const handleShareRide = async (channel: 'whatsapp' | 'sms') => {
    const text = `Track my CampusConnect ride: ${shareLink}`;
    const url = channel === 'whatsapp' ? `https://wa.me/?text=${encodeURIComponent(text)}` : `sms:?body=${encodeURIComponent(text)}`;
    try {
      await Linking.openURL(url);
    } catch {
      showToast(`Could not open ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}`, 'red');
    }
  };

  const resolveCurrentRideId = () => {
    const rideId = activeRideId ?? (activeRide?.id ? String(activeRide.id) : null);
    return rideId ? String(rideId) : null;
  };

  const clearSosSession = () => {
    sosAlertIdRef.current = null;
    sosRecordingRef.current = null;
    sosWebRecorderRef.current = null;
    sosWebStreamRef.current = null;
    sosWebChunksRef.current = [];
    sosWebSegmentChunksRef.current = [];
    sosUploadingRef.current = false;
    if (sosTimerRef.current) {
      clearInterval(sosTimerRef.current);
      sosTimerRef.current = null;
    }
    setSosDispatched(false);
    setSosVisible(false);
    setSosRecordingSeconds(0);
    sosRecordingSecondsRef.current = 0;
    setShowSosRecordingToast(false);
  };

  const handleSOS = async () => {
    setSosVisible(true);
    setSosDispatched(false);
  };

  const startSosRecording = async () => {
    if (Platform.OS === 'web') {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('Browser audio recording is not supported');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 24000 });
      sosWebChunksRef.current = [];
      sosWebSegmentChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          sosWebChunksRef.current.push(event.data);
          sosWebSegmentChunksRef.current.push(event.data);
        }
      };
      recorder.start(1000);
      sosWebStreamRef.current = stream;
      sosWebRecorderRef.current = recorder;
      return;
    }
    const permission = await Audio.requestPermissionsAsync();
    if (permission.status !== 'granted') throw new Error('Microphone permission is required for SOS evidence');
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.LOW_QUALITY);
    await recording.startAsync();
    sosRecordingRef.current = recording;
  };

  const finishSosRecording = async (continueRecording = false) => {
    const recording = sosRecordingRef.current;
    const alertId = sosAlertIdRef.current;
    const rideId = resolveCurrentRideId();
    const webRecorder = sosWebRecorderRef.current;

    if (!alertId || !rideId || (Platform.OS !== 'web' && !recording) || (Platform.OS === 'web' && !webRecorder)) {
      sosRecordingRef.current = null;
      sosWebRecorderRef.current = null;
      sosWebStreamRef.current = null;
      sosWebChunksRef.current = [];
      sosWebSegmentChunksRef.current = [];
      sosUploadingRef.current = false;
      return;
    }

    if (sosUploadingRef.current) return;
    sosUploadingRef.current = true;

    try {
      const form = new FormData();
      if (Platform.OS === 'web') {
        const audioBlob = await new Promise<Blob>((resolve) => {
          webRecorder!.onstop = () => resolve(new Blob(sosWebChunksRef.current, { type: 'audio/webm' }));
          webRecorder!.stop();
        });
        sosWebStreamRef.current?.getTracks().forEach((track) => track.stop());
        form.append('audio', audioBlob, `sos-${alertId}.webm`);
      } else {
        await recording!.stopAndUnloadAsync();
        const uri = recording!.getURI();
        if (!uri) return;
        form.append('audio', { uri, name: `sos-${alertId}.m4a`, type: 'audio/m4a' } as any);
      }
      form.append('duration', String(sosRecordingSecondsRef.current));

      if (Platform.OS === 'web') {
        const token = await AsyncStorage.getItem('authToken');
        const uploadBaseUrl = apiClient.defaults.baseURL || 'http://localhost:8080/api';
        const response = await fetch(`${uploadBaseUrl}/rides/${rideId}/sos/${alertId}/audio`, {
          method: 'PUT',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        });
        if (!response.ok) {
          const body = await response.text();
          throw new Error(`Audio upload failed (${response.status}): ${body || 'server rejected the recording'}`);
        }
      } else {
        await apiClient.put(`/rides/${rideId}/sos/${alertId}/audio`, form);
      }

      if (!continueRecording) showToast('SOS audio evidence saved', 'green');
    } catch (error: any) {
      console.error('SOS audio upload failed:', error?.response?.data || error);
      showToast('SOS was saved, but audio upload failed', 'yellow');
    } finally {
      sosRecordingRef.current = null;
      sosWebRecorderRef.current = null;
      sosWebStreamRef.current = null;
      sosWebChunksRef.current = [];
      sosWebSegmentChunksRef.current = [];
      sosUploadingRef.current = false;
      if (continueRecording && sosDispatched && sosAlertIdRef.current) {
        await startSosRecording();
        sosRecordingSecondsRef.current = 0;
        setSosRecordingSeconds(0);
      }
    }
  };

  const uploadWebSosSegment = async () => {
    const alertId = sosAlertIdRef.current;
    const rideId = activeRideId || (activeRide?.id ? String(activeRide.id) : null);
    const recorder = sosWebRecorderRef.current;
    if (!alertId || !rideId || !recorder || recorder.state !== 'recording' || sosUploadingRef.current) return;
    const chunks = sosWebSegmentChunksRef.current.splice(0);
    if (!chunks.length) return;

    sosUploadingRef.current = true;
    try {
      const form = new FormData();
      form.append('audio', new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }), `sos-${alertId}.webm`);
      form.append('duration', String(SOS_AUDIO_SEGMENT_SECONDS));
      const token = await AsyncStorage.getItem('authToken');
      const uploadBaseUrl = apiClient.defaults.baseURL || 'http://localhost:8080/api';
      const response = await fetch(`${uploadBaseUrl}/rides/${rideId}/sos/${alertId}/audio`, {
        method: 'PUT',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!response.ok) throw new Error(await response.text());
    } catch (error) {
      sosWebSegmentChunksRef.current.unshift(...chunks);
    } finally {
      sosUploadingRef.current = false;
    }
  };

  const confirmSOS = async () => {
    if (sosSending) return;
    setSosSending(true);
    try {
      const rideId = resolveCurrentRideId();
      if (rideId) {
        let gpsLat: number | undefined;
        let gpsLng: number | undefined;
        try {
          const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
          gpsLat = position.coords.latitude;
          gpsLng = position.coords.longitude;
        } catch {
          gpsLat = userLocation.latitude;
          gpsLng = userLocation.longitude;
        }
        const alertLocation = { latitude: gpsLat, longitude: gpsLng };
        setSosLocation(alertLocation);
        const response = await apiClient.post(`/rides/${rideId}/sos`, { gpsLat, gpsLng });
        const alertId = Number(response?.data?.alertId ?? 0);
        if (!Number.isFinite(alertId) || alertId <= 0) {
          throw new Error('SOS alert was not created');
        }
        sosAlertIdRef.current = alertId;
        await startSosRecording();
        setSosRecordingSeconds(0);
        sosRecordingSecondsRef.current = 0;
        setShowSosRecordingToast(true);
        if (sosToastTimerRef.current) clearTimeout(sosToastTimerRef.current);
        sosToastTimerRef.current = setTimeout(() => {
          setShowSosRecordingToast(false);
          sosToastTimerRef.current = null;
        }, 2600);
        setSosDispatched(true);
        showToast('SOS alert dispatched.', 'red');
      } else {
        showToast('An active ride is required for SOS.', 'red');
      }
    } catch (error) {
      showToast('Could not send SOS alert', 'red');
    } finally {
      setSosSending(false);
    }
  };

  useEffect(() => {
    if (!sosDispatched) {
      if (sosTimerRef.current) clearInterval(sosTimerRef.current);
      return;
    }
    sosTimerRef.current = setInterval(() => {
      setSosRecordingSeconds((seconds) => {
        const nextSeconds = Math.min(seconds + 1, MAX_SOS_RECORDING_SECONDS);
        sosRecordingSecondsRef.current = nextSeconds;
        if (nextSeconds === MAX_SOS_RECORDING_SECONDS) {
          void finishSosRecording().finally(() => {
            if (sosTimerRef.current) clearInterval(sosTimerRef.current);
            setSosDispatched(false);
            setSosVisible(false);
          });
        } else if (nextSeconds % SOS_AUDIO_SEGMENT_SECONDS === 0 && Platform.OS === 'web') {
          void uploadWebSosSegment();
        }
        return nextSeconds;
      });
    }, 1000);
    return () => {
      if (sosTimerRef.current) clearInterval(sosTimerRef.current);
    };
  }, [sosDispatched]);

  useEffect(() => {
    const animations = sosWaveAnimationsRef.current.map((animation, index) => (
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 55),
          Animated.timing(animation, { toValue: 1.35, duration: 230, useNativeDriver: true }),
          Animated.timing(animation, { toValue: 0.45, duration: 230, useNativeDriver: true }),
        ])
      )
    ));

    if (sosDispatched) {
      animations.forEach((animation) => animation.start());
    }

    return () => {
      animations.forEach((animation) => animation.stop());
      sosWaveAnimationsRef.current.forEach((animation) => animation.setValue(0.55));
    };
  }, [sosDispatched]);

  useEffect(() => () => {
    if (sosToastTimerRef.current) clearTimeout(sosToastTimerRef.current);
  }, []);

  const handleRateDriver = async () => {
    const rideId = resolveCurrentRideId();
    if (!rideId) {
      showToast('The completed ride could not be found.', 'red');
      return;
    }
    if (selectedRating < 1 || submittingRating) return;
    setSubmittingRating(true);
    try {
      await apiClient.post(`/rides/${rideId}/rating`, {
        rating: selectedRating,
        ...(ratingComment.trim() ? { comment: ratingComment.trim() } : {}),
      });
      setShowRatingModal(false);
      setShowRatingThankYou(true);
      setTimeout(() => {
        setShowRatingThankYou(false);
        setSelectedRating(0);
        setRatingComment('');
        setActiveTripVisible(false);
        setFindingDriversVisible(false);
        setDriverFound(false);
        setSearchingForDriver(false);
        setActiveRide(null);
        setActiveRideId(null);
        setActiveRideLoaded(false);
        clearDriverNavigation();
        if (statusPollRef.current) {
          clearInterval(statusPollRef.current);
          statusPollRef.current = null;
        }
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home', params: { skipActiveRideRestore: true } }],
        });
      }, 2200);
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'Could not submit rating', 'red');
    } finally {
      setSubmittingRating(false);
    }
  };

  const cancelScheduledRide = async (rideId: string | number) => {
    try {
      await apiClient.post(`/rides/${rideId}/cancel`);
      await removeHeldPayload(String(rideId));
      showToast('Scheduled ride cancelled', 'blue');
      await loadScheduledRides();
    } catch {
      showToast('Could not cancel scheduled ride', 'red');
    }
  };

  const trackScheduledRide = (ride: ScheduledRide) => {
    setScheduledListVisible(false);
    const st = String(ride.status || '').toLowerCase();
    if (st === 'scheduled') {
      showToast('This ride has not been dispatched yet.', 'blue');
      return;
    }
    if (st === 'pending') {
      openFindingDriversFlow(String(ride.id));
      return;
    }
    if (['accepted', 'enroute', 'arrived', 'started'].includes(st)) {
      activeTripShownForRideRef.current = String(ride.id);
      setActiveRide(hydrateActiveRide(ride));
      setActiveRideId(String(ride.id));
      setActiveRideLoaded(true);
      setActiveTripVisible(true);
      setFindingDriversVisible(false);
      startStatusPolling(String(ride.id));
      return;
    }
    if (st === 'completed') {
      setActiveRide(hydrateActiveRide(ride));
      setActiveRideId(String(ride.id));
      setActiveRideLoaded(true);
      setActiveTripVisible(true);
      setTripStatus('completed');
      setShowRatingModal(true);
      return;
    }
    showToast('This ride has not been dispatched yet.', 'blue');
  };

  const getStatusText = () => {
    switch (tripStatus) {
      case 'enroute': return 'Driver is en route to you';
      case 'arrived': return 'Driver has arrived';
      case 'started': return 'Trip in progress';
      case 'completed': return 'Trip completed';
      default: return 'Trip in progress';
    }
  };
  const statusColorFor = (status: string) => {
    const s = String(status || '').toLowerCase();
    if (s === 'scheduled') return colors.blue;
    if (s === 'pending') return colors.orange;
    if (s === 'accepted' || s === 'enroute' || s === 'arrived') return colors.blue;
    if (s === 'started') return colors.orange;
    if (s === 'completed') return colors.green;
    if (s === 'cancelled') return colors.gray400;
    return colors.gray500;
  };
  const statusLabelFor = (status: string) => {
    const s = String(status || '').toLowerCase();
    if (s === 'scheduled') return 'Ride Scheduled';
    if (s === 'pending') return 'Finding Driver';
    if (s === 'accepted' || s === 'enroute' || s === 'arrived') return 'In Progress';
    if (s === 'started') return 'In Progress';
    if (s === 'completed') return 'Completed';
    if (s === 'cancelled') return 'Cancelled';
    return capitalize(s || 'Unknown');
  };

  const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // ===== FINDING DRIVERS OVERLAY (matches screenshot 1) =====
  const renderFindingDriversOverlay = () => {
    if (!findingDriversVisible) return null;
    const isDriverAssigned =
      activeRide?.driver && ['accepted', 'enroute', 'arrived', 'started'].includes(String(activeRide.status || '').toLowerCase());

    return (
      <Modal visible={findingDriversVisible} transparent animationType="slide" onRequestClose={() => {}}>
        <View style={styles.overlayContainer}>
          <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

          {riderMessageToast ? (
            <View style={[styles.riderMessageToast, { bottom: insets.bottom + spacing.xxl }]}>
              <Text style={styles.riderMessageToastText} numberOfLines={2}>{riderMessageToast}</Text>
              <TouchableOpacity onPress={() => setRiderMessageToast('')} style={styles.riderMessageToastClose}>
                <Text style={styles.riderMessageToastCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={[styles.overlayHeader, { paddingTop: insets.top + 14 }]}>
            <TouchableOpacity onPress={handleCancelSearch} style={styles.closeButton} disabled={cancelling || !searchingForDriver}>
              <X size={24} color={colors.gray700} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.overlayTitle}>Finding Drivers</Text>
            <View style={styles.headerRight} />
          </View>

          <ScrollView style={styles.overlayContent} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }} showsVerticalScrollIndicator={false}>
            <View style={styles.searchContainer}>
              <View style={styles.searchCircle}>
                {searchingForDriver ? (
                  <>
                    <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
                    <Animated.View style={[styles.loadingRing, { transform: [{ rotate: spin }] }]} />
                    <View style={styles.carIconContainer}>
                      <Car size={40} color={colors.white} strokeWidth={1.8} />
                    </View>
                  </>
                ) : driverFound ? (
                  <View style={styles.foundContainer}>
                    <View style={styles.foundCircle}>
                      <Check size={50} color={colors.green} strokeWidth={1.5} />
                    </View>
                  </View>
                ) : null}
              </View>
              <Text style={styles.searchStatus}>{searchingForDriver ? 'Searching nearby...' : 'Driver Found!'}</Text>
              <Text style={styles.searchSubStatus}>
                {searchingForDriver
                  ? `Looking for available drivers near you (${formatElapsed(elapsedSeconds)})`
                  : 'A driver has been assigned to your ride'}
              </Text>
            </View>

            {isDriverAssigned && activeRide?.driver && (
              <Animated.View style={[styles.driverInfo, { opacity: driverFadeAnim }]}>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>
                    {activeRide.driver.fullName.split(' ').map((n) => n[0]).join('')}
                  </Text>
                </View>
                <View style={styles.driverDetails}>
                  <Text style={styles.driverName}>{activeRide.driver.fullName}</Text>
                  <View style={styles.driverRatingContainer}>
                    <Star size={14} color={colors.orange} strokeWidth={2} fill={colors.orange} />
                    <Text style={styles.driverRating}>{activeRide.driver.rating || 0}</Text>
                  </View>
                  <Text style={styles.driverCar}>{activeRide.driver.vehicleMake} {activeRide.driver.vehicleModel}</Text>
                  <Text style={styles.driverPlate}>{activeRide.driver.licencePlate}</Text>
                </View>
              </Animated.View>
            )}

            <View style={styles.tripDetails}>
              <View style={styles.tripRow}>
                <View style={styles.tripIconContainer}>
                  <MapPin size={16} color={colors.green} strokeWidth={2} />
                </View>
                <View style={styles.tripTextContainer}>
                  <Text style={styles.tripLabel}>YOUR LOCATION</Text>
                  <Text style={styles.tripValue} numberOfLines={1}>
                    {String((activeRide as any)?.pickupAddress || pickupLabel || 'Current Location')}
                  </Text>
                </View>
              </View>
              <View style={styles.tripDivider} />
              <View style={styles.tripRow}>
                <View style={styles.tripIconContainer}>
                  <Navigation size={16} color={colors.blue} strokeWidth={2} />
                </View>
                <View style={styles.tripTextContainer}>
                  <Text style={styles.tripLabel}>YOUR DESTINATION</Text>
                  <Text style={styles.tripValue} numberOfLines={1}>
                    {String((activeRide as any)?.destinationAddress || (activeRide as any)?.destination || destination?.name || 'Destination')}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.rideInfo}>
              <View style={styles.rideInfoItem}>
                <RouteIcon size={16} color={colors.green} strokeWidth={1.8} />
                <Text style={styles.rideInfoText}>{Number((activeRide as any)?.distance ?? tripDistanceKm ?? 0).toFixed(1)} km</Text>
              </View>
              <View style={styles.rideInfoDivider} />
              <View style={styles.rideInfoItem}>
                <ClockIcon size={16} color={colors.green} strokeWidth={1.8} />
                <Text style={styles.rideInfoText}>~{Math.round(Number((activeRide as any)?.duration ?? etaMinutes ?? 0))} min</Text>
              </View>
              <View style={styles.rideInfoDivider} />
              <View style={styles.rideInfoItem}>
                <Text style={styles.rideInfoFare}>R {Number((activeRide as any)?.fare ?? fare ?? 0).toFixed(2)}</Text>
              </View>
            </View>

            {searchingForDriver && (
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancelSearch} disabled={cancelling}>
                {cancelling ? <ActivityIndicator size="small" color={colors.red} /> : <Text style={styles.cancelButtonText}>Cancel Search</Text>}
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  // ===== SOS overlay (matches screenshot 3) =====
  const renderSosOverlay = () => {
    if (!sosVisible) return null;
    return (
      <View style={[styles.sosLayer, sosDispatched && styles.sosActivatedLayer]}>
        {!sosDispatched && <Pressable style={styles.sosBackdrop} onPress={() => setSosVisible(false)} />}
        {sosDispatched ? (
          <View style={styles.sosActivatedPanel}>
            <View style={styles.sosActivatedHeader}>
              <TouchableOpacity
                onPress={async () => {
                  setSosVisible(false);
                  setSosDispatched(false);
                  await finishSosRecording();
                }}
                style={styles.sosBackButton}
              >
                <ArrowLeft size={22} color={colors.white} strokeWidth={2.4} />
              </TouchableOpacity>
              <View style={styles.sosHeaderIcon}>
                <AlertTriangle size={22} color={colors.white} strokeWidth={2.5} />
              </View>
              <View>
                <Text style={styles.sosActivatedTitle}>SOS Activated</Text>
                <Text style={styles.sosActivatedSubtitle}>Campus Security has been alerted</Text>
              </View>
            </View>
            <View style={styles.sosAlertNotice}>
              <AlertTriangle size={14} color="#ef4444" />
              <Text style={styles.sosAlertNoticeText}>
                Campus Security and your emergency contact have been notified with your live GPS location.
              </Text>
            </View>
            <View style={styles.sosGpsCard}>
              <Text style={styles.sosSectionLabel}>GPS LOCATION</Text>
              <Text style={styles.sosGpsValue}>
                {sosLocation.latitude.toFixed(6)}, {sosLocation.longitude.toFixed(6)}
              </Text>
              <View style={styles.sosGpsDot} />
            </View>
            <View style={styles.sosEvidenceRow}>
              <Text style={styles.sosSectionLabel}>EVIDENCE AUDIO</Text>
              <View style={styles.sosRecBadge}>
                <View style={styles.sosRecDot} />
                <Text style={styles.sosRecText}>REC</Text>
              </View>
            </View>
            <Text style={styles.sosTimer}>
              {String(Math.floor(sosRecordingSeconds / 60)).padStart(2, '0')}:
              {String(sosRecordingSeconds % 60).padStart(2, '0')}
            </Text>
            <View style={styles.sosWaveform}>
              {[10, 18, 28, 38, 24, 44, 30, 18, 10, 25, 15].map((height, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.sosWaveBar,
                    { height, transform: [{ scaleY: sosWaveAnimationsRef.current[index] }] },
                  ]}
                />
              ))}
            </View>
            <View style={styles.sosRecordingButton}>
              <View style={styles.sosRecordingDot} />
              <Text style={styles.sosRecordingText}>Recording in progress...</Text>
            </View>
            <TouchableOpacity
              style={styles.sosSafeButton}
              onPress={async () => {
                setSosVisible(false);
                setSosDispatched(false);
                await finishSosRecording();
              }}
            >
              <Text style={styles.sosSafeText}>I'm Safe — Cancel SOS</Text>
            </TouchableOpacity>
            {showSosRecordingToast && (
              <View style={styles.sosBottomNotice}>
                <AlertTriangle size={15} color={colors.white} />
                <Text style={styles.sosBottomNoticeText}>Audio recording started</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.sosCard}>
            <View style={styles.sosHandle} />
            <View style={styles.sosWarningIcon}>
              <AlertTriangle size={42} color="#ef4444" fill="#ef4444" strokeWidth={2.5} />
            </View>
            <Text style={styles.sosTitle}>Activate SOS Alert?</Text>
            <Text style={styles.sosSubtitle}>
              This will immediately alert Campus Security and your emergency contact with your live GPS location.
            </Text>
            <TouchableOpacity style={styles.sosConfirmButton} onPress={confirmSOS} disabled={sosSending}>
              {sosSending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.sosConfirmText}>Yes, Send SOS Alert</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.sosCancelButton} onPress={() => setSosVisible(false)} disabled={sosSending}>
              <Text style={styles.sosCancelText}>×  Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // ===== Rating modal (matches screenshots 5 & 6) =====
  const renderRatingModal = () => (
    <>
      <Modal visible={showRatingModal} transparent animationType="slide" onRequestClose={() => undefined}>
        <View style={styles.ratingFullBackdrop}>
          <View style={[styles.ratingFullHeader, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity
              style={styles.ratingBackButton}
              onPress={() => setShowRatingModal(false)}
              accessibilityLabel="Go back"
            >
              <ArrowLeft size={22} color={colors.gray900} strokeWidth={2.2} />
            </TouchableOpacity>
            <Text style={styles.ratingHeaderTitle}>Rate your ride</Text>
            <View style={{ width: 40 }} />
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={[
                styles.ratingContent,
                { paddingBottom: insets.bottom + 30 },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.ratingTopLabel}>TRIP COMPLETED</Text>
              <Text style={styles.ratingBigTitle}>Rate our driver</Text>
              <Text style={styles.ratingBigSubtitle}>
                How was your ride with {driverName || activeRide?.driver?.fullName || 'your driver'}?
              </Text>

              <View style={styles.ratingStarsRow}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <TouchableOpacity
                    key={value}
                    onPress={() => setSelectedRating(value)}
                    style={styles.ratingBigStarButton}
                    accessibilityLabel={`${value} star rating`}
                  >
                    <Star
                      size={44}
                      color={value <= selectedRating ? colors.orange : colors.gray300}
                      strokeWidth={2}
                      fill={value <= selectedRating ? colors.orange : 'transparent'}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.ratingCommentInput}
                placeholder="Add a comment (optional)"
                placeholderTextColor={colors.gray400}
                value={ratingComment}
                onChangeText={setRatingComment}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.ratingBigSubmit, selectedRating === 0 && styles.ratingBigSubmitDisabled]}
                onPress={handleRateDriver}
                disabled={selectedRating === 0 || submittingRating}
              >
                {submittingRating ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.ratingBigSubmitText}>Submit rating</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={showRatingThankYou} transparent animationType="fade">
        <View style={styles.ratingBackdrop}>
          <View style={styles.thankYouCard}>
            <View style={styles.thankYouIcon}>
              <Check size={30} color={colors.white} />
            </View>
            <Text style={styles.ratingTitle}>Thank you for rating!</Text>
            <Text style={styles.ratingSubtitle}>Your feedback helps keep CampusConnect safe.</Text>
          </View>
        </View>
      </Modal>
    </>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {Platform.OS === 'web' && (
        // @ts-ignore web-only
        <input
          ref={webTimeInputRef}
          type="time"
          value={timeString}
          onChange={(e: any) => setTimeString(e.target.value || '08:00')}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
        />
      )}

      <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backPill}>
            <ArrowLeft size={16} color={colors.greenDark} strokeWidth={2.4} />
            <Text style={styles.backPillText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Schedule Ride</Text>
          <Text style={styles.subtitle}>Book your ride in advance</Text>

          <View style={styles.scheduledActionsRow}>
            <TouchableOpacity
              style={styles.scheduledButton}
              onPress={() => { setScheduledListVisible(true); loadScheduledRides(); }}
              activeOpacity={0.85}
            >
              <CalendarDays size={18} color={colors.white} strokeWidth={2.2} />
              <Text style={styles.scheduledButtonText} numberOfLines={1}>Scheduled Rides</Text>
              {upcomingCount > 0 && (
                <View style={styles.scheduledBadge}>
                  <Text style={styles.scheduledBadgeText}>{upcomingCount > 9 ? '9+' : upcomingCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            {badgeMsRemaining != null && (
              <View style={[styles.countdownBadge, badgeMsRemaining <= 0 && styles.countdownBadgeFiring]}>
                <Clock size={14} color={colors.white} strokeWidth={2.4} />
                {badgeMsRemaining > 0 ? (
                  <View style={styles.countdownCopy}>
                    <Text style={styles.countdownLabel} numberOfLines={1}>{badgeTargetLabel}</Text>
                    <Text style={styles.countdownValue} numberOfLines={1}>In {formatCountdown(badgeMsRemaining)}</Text>
                  </View>
                ) : (
                  <Text style={styles.countdownValue} numberOfLines={1}>Dispatching now…</Text>
                )}
              </View>
            )}
          </View>
        </View>

        <View style={styles.mapCard}>
          <WebMap
            userLocation={pickupCoords}
            destination={
              destination ??
              (activeRide
                ? {
                    name: String(activeRide.destinationAddress || activeRide.destination || 'Destination'),
                    coords: {
                      latitude: Number((activeRide as any).destinationLat ?? (activeRide as any).destLat ?? 0),
                      longitude: Number((activeRide as any).destinationLng ?? (activeRide as any).destLng ?? 0),
                    },
                    address: String(activeRide.destinationAddress || ''),
                    category: 'Destination',
                  }
                : null)
            }
            routePoints={routePoints.length > 1 ? routePoints : driverRoutePoints}
            places={[]}
            onLocationSelect={handleLocationSelect}
            loading={routing}
            driverPosition={activeTripVisible ? driverCarPosition : undefined}
            driverMarker={activeTripVisible && !tripCompleted}
          />
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>{activeTripVisible ? 'LIVE TRIP' : 'ROUTE PREVIEW'}</Text>
          </View>

          {destination && (
            <View style={styles.destinationBadge}>
              <Navigation size={12} color={colors.white} strokeWidth={2} />
              <Text style={styles.destinationBadgeText} numberOfLines={1}>{destination.name}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.locateButton} onPress={detectLocation}>
            <LocateFixed size={20} color={colors.green} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={styles.rideCard}>
          <TouchableOpacity style={styles.rideRow} onPress={() => setPickupSheetVisible(true)} activeOpacity={0.7}>
            <View style={[styles.rideDot, { backgroundColor: colors.green }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rideRowLabel}>PICKUP</Text>
              <Text style={styles.rideRowValue} numberOfLines={1}>{locating ? 'Detecting location...' : pickupLabel}</Text>
            </View>
            <Search size={16} color={colors.gray400} strokeWidth={2} />
            <ChevronRight size={16} color={colors.gray300} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.rideDivider} />
          <TouchableOpacity style={styles.rideRow} onPress={() => setDestSheetVisible(true)} activeOpacity={0.7}>
            <View style={[styles.rideDot, { backgroundColor: colors.blue }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rideRowLabel}>DESTINATION</Text>
              <Text style={[styles.rideRowValue, !destination && styles.rideRowPlaceholder]} numberOfLines={1}>
                {destination ? destination.name : 'Search for a place...'}
              </Text>
            </View>
            <Search size={16} color={colors.gray400} strokeWidth={2} />
            <ChevronRight size={16} color={colors.gray300} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={styles.dateCard}>
          <Text style={styles.sectionLabel}>DATE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateTabs}>
            {dateOptions.map((option, index) => {
              const selected = date.toDateString() === option.toDateString();
              return (
                <TouchableOpacity key={option.toISOString()} style={[styles.dateTab, selected && styles.dateTabSelected]} onPress={() => setDate(option)} activeOpacity={0.85}>
                  <Text style={[styles.dateTabText, selected && styles.dateTabTextSelected]}>
                    {index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : option.toLocaleDateString('en-ZA', { weekday: 'short', day: '2-digit', month: 'short' })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[styles.sectionLabel, styles.timeSectionLabel]}>TIME</Text>
          <View style={styles.timeRow}>
            <TouchableOpacity style={styles.timePill} onPress={onPickTime} activeOpacity={0.85}>
              <Clock size={19} color={colors.greenDark} strokeWidth={2.4} />
              <Text style={styles.timePillText}>{timeString}</Text>
              <Text style={styles.timePillHint} numberOfLines={1}>Tap to edit</Text>
            </TouchableOpacity>
            <View style={styles.timeQuickAdjust}>
              <TouchableOpacity style={styles.timeAdjustBtn} onPress={() => adjustTime(-15)}>
                <Text style={styles.timeAdjustText}>−15m</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.timeAdjustBtn} onPress={() => adjustTime(15)}>
                <Text style={styles.timeAdjustText}>+15m</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.timeAdjustBtn} onPress={() => adjustTime(60)}>
                <Text style={styles.timeAdjustText}>+1h</Text>
              </TouchableOpacity>
            </View>
          </View>
          {!isFutureTime && <Text style={styles.timeError}>Please choose a time at least 30 seconds in the future.</Text>}
          {isFutureTime && (
            <Text style={styles.timeOk}>
              Fires in {formatCountdown(scheduledDateTime.getTime() - nowTick)} · {scheduledDateTime.toLocaleString('en-ZA')}
            </Text>
          )}
        </View>

      </ScrollView>

      <View style={styles.fixedFooter}>
        {destination && routeDistance != null && (
          <View style={styles.routeDetails}>
            <View style={styles.routeDetailItem}>
              <RouteIcon size={15} color={colors.blue} strokeWidth={2} />
              <Text style={styles.routeDetailText}>{routeDistance.toFixed(1)} km</Text>
            </View>
            <View style={styles.routeDetailItem}>
              <ClockIcon size={15} color={colors.gray600} strokeWidth={2} />
              <Text style={styles.routeDetailText}>~{Math.round(etaMinutes)} min</Text>
            </View>
            <View style={styles.routeDetailItem}>
              <Text style={[styles.routeDetailText, { color: colors.green, fontWeight: 'bold' }]}>R {fare.toFixed(2)}</Text>
            </View>
          </View>
        )}
        <View style={styles.actionsWrap}>
          <Button
            label={saving ? 'Scheduling...' : 'Schedule Ride'}
            onPress={submitScheduledRide}
            disabled={!destination || !isFutureTime || saving}
            loading={saving}
            icon={<CalendarDays size={18} color={colors.white} strokeWidth={2} />}
            style={styles.scheduleActionButton}
          />
        </View>
        <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 6 }]}>
        <NavItem
          icon={<House size={20} color={colors.gray400} strokeWidth={1.8} />}
          label="Home"
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Home', params: { skipActiveRideRestore: true } }] })}
        />
        <NavItem
          icon={<Clock size={20} color={colors.gray400} strokeWidth={1.8} />}
          label="History"
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'RiderHistory' }] })}
        />
        <NavItem icon={<CalendarDays size={20} color={colors.green} strokeWidth={2} />} label="Schedule" active />
        <NavItem
          icon={<CircleUserRound size={20} color={colors.gray400} strokeWidth={1.8} />}
          label="Profile"
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'RiderProfile' }] })}
        />
        </View>
      </View>

      {/* Pickup sheet */}
      <BottomSheetModal
        visible={pickupSheetVisible}
        onClose={() => { setPickupSheetVisible(false); setPickupSearch(''); setPickupSearchResults([]); }}
        title="Choose pickup"
        subtitle="Use your current location or search for a place"
      >
        <TouchableOpacity style={styles.currentLocationOption} onPress={() => { setPickupSheetVisible(false); detectLocation(); }} activeOpacity={0.7}>
          <View style={styles.currentLocationIcon}>
            <LocateFixed size={18} color={colors.green} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.destName}>Use current location</Text>
            <Text style={styles.destAddress}>{locating ? 'Detecting location...' : pickupLabel}</Text>
          </View>
          {locating ? <ActivityIndicator size="small" color={colors.green} /> : <ChevronRight size={16} color={colors.gray300} strokeWidth={2} />}
        </TouchableOpacity>

        <View style={styles.searchRow}>
          <Search size={16} color={colors.gray400} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search pickup location..."
            placeholderTextColor={colors.gray400}
            value={pickupSearch}
            onChangeText={handlePickupSearch}
            autoCapitalize="none"
            autoFocus
          />
          {pickupSearchLoading && <ActivityIndicator size="small" color={colors.gray400} />}
          {pickupSearch.length > 0 && !pickupSearchLoading && (
            <TouchableOpacity onPress={() => { setPickupSearch(''); setPickupSearchResults([]); }}>
              <X size={16} color={colors.gray400} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>

        {pickupSearchResults.map((loc) => (
          <TouchableOpacity
            key={`pickup-${loc.name}-${loc.coords.latitude}-${loc.coords.longitude}`}
            style={styles.destOption}
            onPress={() => selectPickupLocation(loc)}
            activeOpacity={0.7}
          >
            <View style={styles.destIconCircle}>
              <MapPin size={16} color={colors.green} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.destName}>{loc.name}</Text>
              <Text style={styles.destAddress}>{loc.address}</Text>
              <Text style={styles.destDistance}>{distanceKm(userLocation, loc.coords).toFixed(1)} km away</Text>
            </View>
          </TouchableOpacity>
        ))}

        {!pickupSearchLoading && pickupSearch.trim().length > 1 && pickupSearchResults.length === 0 && (
          <View style={styles.noResultsContainer}>
            <Text style={styles.noResults}>No pickup places found</Text>
            <Text style={styles.noResultsSub}>Try a landmark, street, residence, or campus building</Text>
          </View>
        )}
      </BottomSheetModal>

      {/* Destination sheet */}
      <BottomSheetModal
        visible={destSheetVisible}
        onClose={() => { setDestSheetVisible(false); setShowSearchResults(false); }}
        title="Where to?"
        subtitle="Search for any real place in Kimberley"
      >
        <View style={styles.searchRow}>
          <Search size={16} color={colors.gray400} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search any place in Kimberley..."
            placeholderTextColor={colors.gray400}
            value={search}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoFocus
          />
          {searchLoading && <ActivityIndicator size="small" color={colors.gray400} />}
          {search.length > 0 && !searchLoading && (
            <TouchableOpacity onPress={() => { setSearch(''); setShowSearchResults(false); setSearchResults([]); }}>
              <X size={16} color={colors.gray400} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.categoryFilter}>
          <Text style={styles.categoryFilterText}>
            {showSearchResults
              ? searchLoading
                ? 'Searching...'
                : `Search results (${filteredLocations.length})`
              : nearbyLoading
              ? 'Finding places near you...'
              : 'Suggested near you'}
          </Text>
        </View>

        {filteredLocations.map((loc) => (
          <TouchableOpacity
            key={`${loc.name}-${loc.coords.latitude}-${loc.coords.longitude}`}
            style={[styles.destOption, destination?.name === loc.name && styles.destOptionSelected]}
            onPress={() => handleLocationSelect(loc)}
            activeOpacity={0.7}
          >
            <View style={[styles.destIconCircle, destination?.name === loc.name && styles.destIconCircleSelected]}>
              <MapPin size={16} color={destination?.name === loc.name ? colors.white : colors.green} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.destName, destination?.name === loc.name && styles.destNameSelected]}>{loc.name}</Text>
              <Text style={styles.destAddress}>{loc.address}</Text>
              <View style={styles.destMeta}>
                <Text style={styles.destCategory}>{loc.category}</Text>
                <Text style={styles.destDistance}>{distanceKm(userLocation, loc.coords).toFixed(1)} km away</Text>
              </View>
            </View>
            {destination?.name === loc.name && <Check size={16} color={colors.green} strokeWidth={3} />}
          </TouchableOpacity>
        ))}

        {!searchLoading && showSearchResults && filteredLocations.length === 0 && search.length > 1 && (
          <View style={styles.noResultsContainer}>
            <Text style={styles.noResults}>No places found for "{search}"</Text>
            <Text style={styles.noResultsSub}>Try a different spelling, or search for a landmark, mall, or street name</Text>
          </View>
        )}
      </BottomSheetModal>

      {/* Native time picker modal */}
      <Modal visible={timePickerVisible} transparent animationType="fade" onRequestClose={() => setTimePickerVisible(false)}>
        <Pressable style={styles.timeModalBackdrop} onPress={() => setTimePickerVisible(false)}>
          <View style={styles.timeModalCard}>
            <Text style={styles.timeModalTitle}>Select time</Text>
            <Text style={styles.timeModalValue}>{timeString}</Text>
            <View style={styles.timeModalGrid}>
              {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23].map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[styles.timeModalCell, timeString.startsWith(String(h).padStart(2, '0')) && styles.timeModalCellSelected]}
                  onPress={() => {
                    const mm = timeString.split(':')[1] || '00';
                    setTimeString(`${String(h).padStart(2, '0')}:${mm}`);
                  }}
                >
                  <Text style={[styles.timeModalCellText, timeString.startsWith(String(h).padStart(2, '0')) && styles.timeModalCellTextSelected]}>
                    {String(h).padStart(2, '0')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.timeModalMinutesRow}>
              {['00', '15', '30', '45'].map((m) => {
                const selected = timeString.endsWith(`:${m}`);
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.timeModalCell, selected && styles.timeModalCellSelected]}
                    onPress={() => {
                      const hh = timeString.split(':')[0] || '08';
                      setTimeString(`${hh}:${m}`);
                    }}
                  >
                    <Text style={[styles.timeModalCellText, selected && styles.timeModalCellTextSelected]}>:{m}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={styles.timeModalConfirm} onPress={() => setTimePickerVisible(false)}>
              <Text style={styles.timeModalConfirmText}>Done</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Payment modal */}
      <Modal visible={paymentVisible} transparent animationType="slide" onRequestClose={() => setPaymentVisible(false)}>
        <View style={styles.paymentBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPaymentVisible(false)} />
          <View style={styles.paymentSheet}>
            <View style={styles.paymentHandle} />
            <Text style={styles.paymentTitle}>Choose payment</Text>
            <Text style={styles.paymentSubtitle}>Review your scheduled trip and select how you will pay.</Text>
            <View style={styles.paymentTripCard}>
              <View style={styles.paymentTripRow}>
                <MapPin size={16} color={colors.green} strokeWidth={2} />
                <Text style={styles.paymentTripText} numberOfLines={1}>{pickupLabel}</Text>
              </View>
              <View style={styles.paymentTripDivider} />
              <View style={styles.paymentTripRow}>
                <Navigation size={16} color={colors.blue} strokeWidth={2} />
                <Text style={styles.paymentTripText} numberOfLines={1}>{destination?.name}</Text>
              </View>
              <View style={styles.paymentTripRow}>
                <Clock size={16} color={colors.orange} strokeWidth={2} />
                <Text style={styles.paymentTripText} numberOfLines={1}>{scheduledDateTime.toLocaleString('en-ZA')}</Text>
              </View>
              <View style={styles.paymentSummaryRow}>
                <Text style={styles.paymentSummaryLabel}>{tripDistanceKm.toFixed(1)} km  •  ~{Math.round(etaMinutes)} min</Text>
                <Text style={styles.paymentAmount}>R {fare.toFixed(2)}</Text>
              </View>
            </View>

            <Text style={styles.paymentSectionTitle}>Payment method</Text>
            <TouchableOpacity style={[styles.paymentOption, paymentMethod === 'CASH' && styles.paymentOptionSelected]} onPress={() => setPaymentMethod('CASH')}>
              {paymentMethod === 'CASH' ? <CheckCircle2 size={21} color={colors.green} /> : <Circle size={21} color={colors.gray400} />}
              <Banknote size={20} color={colors.gray700} />
              <View style={styles.paymentOptionText}>
                <Text style={styles.paymentOptionTitle}>Cash</Text>
                <Text style={styles.paymentOptionSubtitle}>Pay the driver when the trip is complete</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.paymentOption, paymentMethod === 'CARD' && styles.paymentOptionSelected, savedPaymentCards.length === 0 && styles.paymentOptionDisabled]}
              disabled={savedPaymentCards.length === 0}
              onPress={() => setPaymentMethod('CARD')}
            >
              {paymentMethod === 'CARD' ? <CheckCircle2 size={21} color={colors.green} /> : <Circle size={21} color={colors.gray400} />}
              <CreditCard size={20} color={colors.gray700} />
              <View style={styles.paymentOptionText}>
                <Text style={styles.paymentOptionTitle}>Card</Text>
                <Text style={styles.paymentOptionSubtitle}>{savedPaymentCards.length ? 'Choose a saved card' : 'Add a card from Profile > Saved cards'}</Text>
              </View>
            </TouchableOpacity>
            {paymentMethod === 'CARD' && (
              <View style={styles.savedCards}>
                <Text style={styles.savedCardsTitle}>Saved cards</Text>
                {savedPaymentCards.map((card) => (
                  <TouchableOpacity key={card.id} style={[styles.savedCard, selectedCard === card.id && styles.savedCardSelected]} onPress={() => setSelectedCard(card.id)}>
                    <CreditCard size={20} color={colors.blue} />
                    <View style={styles.paymentOptionText}>
                      <Text style={styles.paymentOptionTitle}>{card.label}</Text>
                      <Text style={styles.paymentOptionSubtitle}>{card.isDefault ? 'Default card' : `Expires ${card.expiry}`}</Text>
                    </View>
                    {selectedCard === card.id && <CheckCircle2 size={19} color={colors.green} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity style={styles.proceedPaymentButton} onPress={confirmPayment}>
              <Text style={styles.proceedPaymentText}>
                {paymentMethod === 'CASH' ? 'Proceed with cash' : `Pay R ${fare.toFixed(2)} with card`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Scheduled rides list */}
      <Modal visible={scheduledListVisible} transparent animationType="slide" onRequestClose={() => setScheduledListVisible(false)}>
        <View style={styles.listBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setScheduledListVisible(false)} />
          <View style={styles.listSheet}>
            <View style={styles.paymentHandle} />
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>Scheduled Rides</Text>
              <TouchableOpacity onPress={() => setScheduledListVisible(false)} style={styles.listCloseBtn}>
                <X size={18} color={colors.gray700} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
            <Text style={styles.listSubtitle}>All your upcoming and in-progress scheduled rides.</Text>
            {listLoading ? (
              <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.green} />
                <Text style={styles.listEmptyText}>Loading...</Text>
              </View>
            ) : scheduledRides.length === 0 ? (
              <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
                <CalendarDays size={40} color={colors.gray300} strokeWidth={1.6} />
                <Text style={styles.listEmptyText}>No scheduled rides yet.</Text>
                <Text style={styles.listEmptySub}>Book one and it will show up here.</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: SCREEN_HEIGHT * 0.62 }} showsVerticalScrollIndicator={false}>
                {scheduledRides.map((ride) => {
                  const st = String(ride.status || '').toLowerCase();
                  const canCancel = st === 'scheduled';
                  const canTrack = ['pending', 'accepted', 'enroute', 'arrived', 'started'].includes(st);
                  const canRate = st === 'completed';
                  const t = scheduledTimeMs(ride);
                  const msLeft = t != null ? t - nowTick : null;
                  return (
                    <View key={String(ride.id)} style={styles.listItem}>
                      <View style={styles.listItemHeader}>
                        <Text style={styles.listItemTime}>{formatScheduleDateTime(ride.scheduledAt)}</Text>
                        <View style={[styles.statusPill, { backgroundColor: statusColorFor(st) + '22' }]}>
                          <View style={[styles.statusDot, { backgroundColor: statusColorFor(st) }]} />
                          <Text style={[styles.statusPillText, { color: statusColorFor(st) }]}>{statusLabelFor(st)}</Text>
                        </View>
                      </View>
                      {st === 'scheduled' && msLeft != null && (
                        <View style={styles.listCountdownRow}>
                          <Clock size={13} color={colors.greenDark} strokeWidth={2.4} />
                          <Text style={styles.listCountdownText}>
                            {msLeft > 0 ? `Starts in ${formatCountdown(msLeft)}` : 'Dispatching now…'}
                          </Text>
                        </View>
                      )}
                      <View style={styles.listRoute}>
                        <View style={[styles.listDot, { backgroundColor: colors.green }]} />
                        <Text style={styles.listRouteText} numberOfLines={1}>{ride.pickupAddress || ride.pickupLocation || 'Pickup'}</Text>
                      </View>
                      <View style={styles.listRouteConnector} />
                      <View style={styles.listRoute}>
                        <View style={[styles.listDot, { backgroundColor: colors.blue }]} />
                        <Text style={styles.listRouteText} numberOfLines={1}>{ride.destinationAddress || ride.destination || 'Destination'}</Text>
                      </View>
                      <View style={styles.listMetaRow}>
                        <Text style={styles.listMetaText}>R {Number(ride.fare || 0).toFixed(2)}</Text>
                        <Text style={styles.listMetaText}>{ride.distance ? `${ride.distance.toFixed(1)} km` : 'Distance unavailable'}</Text>
                        <Text style={styles.listMetaText}>{ride.duration ? `~${Math.round(ride.duration)} min` : 'ETA unavailable'}</Text>
                      </View>
                      {(canCancel || canTrack || canRate) && (
                        <View style={styles.listActionsRow}>
                          {canTrack && (
                            <TouchableOpacity style={[styles.listAction, styles.listActionPrimary]} onPress={() => trackScheduledRide(ride)}>
                              <Navigation size={14} color={colors.white} strokeWidth={2.2} />
                              <Text style={styles.listActionPrimaryText}>Track</Text>
                            </TouchableOpacity>
                          )}
                          {canCancel && (
                            <TouchableOpacity style={[styles.listAction, styles.listActionDanger]} onPress={() => cancelScheduledRide(ride.id)}>
                              <X size={14} color={colors.red} strokeWidth={2.4} />
                              <Text style={styles.listActionDangerText}>Cancel</Text>
                            </TouchableOpacity>
                          )}
                          {canRate && (
                            <TouchableOpacity
                              style={[styles.listAction, styles.listActionPrimary]}
                              onPress={() => {
                                setScheduledListVisible(false);
                                setActiveRideId(String(ride.id));
                                setActiveRide(hydrateActiveRide(ride));
                                setActiveRideLoaded(true);
                                setDriverName(ride.driver?.fullName || '');
                                setShowRatingModal(true);
                              }}
                            >
                              <Star size={14} color={colors.white} fill={colors.white} />
                              <Text style={styles.listActionPrimaryText}>Rate</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {renderFindingDriversOverlay()}

      {/* ===== Active Trip overlay (matches screenshots 2 & 4) ===== */}
      {activeTripVisible && activeRideId && (
        <Modal visible transparent animationType="slide" onRequestClose={() => {}}>
          <View style={styles.overlayContainer}>
            <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
            {riderMessageToast ? (
              <View style={[styles.riderMessageToast, { bottom: insets.bottom + spacing.xxl }]}>
                <Text style={styles.riderMessageToastText} numberOfLines={2}>{riderMessageToast}</Text>
                <TouchableOpacity onPress={() => setRiderMessageToast('')} style={styles.riderMessageToastClose}>
                  <Text style={styles.riderMessageToastCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <View style={[styles.overlayHeader, { paddingTop: insets.top + 14 }]}>
              <View style={styles.headerRight} />
              <Text style={styles.overlayTitle}>Active Trip</Text>
              <View style={styles.headerRight} />
            </View>

            {!activeRideLoaded || !activeRide ? (
              <View style={styles.activeLoadingContainer}>
                <ActivityIndicator size="large" color={colors.green} />
                <Text style={styles.activeLoadingText}>Loading trip…</Text>
              </View>
            ) : (
              <ScrollView style={styles.overlayContent} contentContainerStyle={{ paddingBottom: insets.bottom + 10 }} showsVerticalScrollIndicator={false}>
                <View style={styles.activeMapContainer}>
                  {!tripCompleted ? (
                    <WebMap
                      userLocation={{
                        latitude: Number((activeRide as any).pickupLat ?? (activeRide as any).pickup_lat ?? pickupCoords.latitude),
                        longitude: Number((activeRide as any).pickupLng ?? (activeRide as any).pickup_lng ?? pickupCoords.longitude),
                      }}
                      destination={{
                        name: String(activeRide.destinationAddress || activeRide.destination || destination?.name || 'Destination'),
                        coords: {
                          latitude: Number((activeRide as any).destinationLat ?? (activeRide as any).destLat ?? destination?.coords.latitude ?? 0),
                          longitude: Number((activeRide as any).destinationLng ?? (activeRide as any).destLng ?? destination?.coords.longitude ?? 0),
                        },
                        address: String(activeRide.destinationAddress || destination?.address || ''),
                        category: destination?.category || 'Destination',
                      }}
                      routePoints={driverRoutePoints.length > 1 ? driverRoutePoints : routePoints}
                      places={[]}
                      onLocationSelect={() => undefined}
                      loading={false}
                      driverPosition={driverCarPosition}
                      driverMarker={true}
                    />
                  ) : (
                    <WebMap
                      userLocation={{
                        latitude: Number((activeRide as any).pickupLat ?? pickupCoords.latitude),
                        longitude: Number((activeRide as any).pickupLng ?? pickupCoords.longitude),
                      }}
                      destination={null}
                      routePoints={[]}
                      places={[]}
                      onLocationSelect={() => undefined}
                      loading={false}
                      driverMarker={false}
                    />
                  )}
                  <View style={styles.activeMapStatus}>
                    <Text style={styles.mapStatusText}>{getStatusText()}</Text>
                  </View>
                </View>

                {activeRide?.driver ? (
                  <View style={styles.activeDriverCard}>
                    <View style={styles.driverHeader}>
                      <View style={styles.referenceDriverAvatar}>
                        <Text style={styles.driverAvatarText}>
                          {String(activeRide.driver.fullName || driverName || 'D').split(' ').map((n) => n[0]).join('')}
                        </Text>
                      </View>
                      <View style={styles.referenceDriverIdentity}>
                        <Text style={styles.driverName}>{activeRide.driver.fullName || driverName}</Text>
                        <Text style={styles.referenceDriverVehicle}>
                          {activeRide.driver.vehicleMake} {activeRide.driver.vehicleModel}
                        </Text>
                        <View style={styles.referenceDriverRating}>
                          <Star size={14} color={colors.orange} strokeWidth={2} fill={colors.orange} />
                          <Text style={styles.referenceDriverRatingText}>{activeRide.driver.rating || 0} · Driver</Text>
                        </View>
                      </View>
                      <View style={styles.referencePlateBadge}>
                        <Text style={styles.referencePlateText}>{activeRide.driver.licencePlate || driverPlate || 'No plate'}</Text>
                      </View>
                    </View>
                  </View>
                ) : null}

                <View style={styles.referenceTripCard}>
                  <View style={styles.referenceTripRow}>
                    <View style={[styles.referenceTripDot, { backgroundColor: colors.green }]} />
                    <View style={styles.referenceTripText}>
                      <Text style={styles.referenceTripLabel}>
                        {driverHeadingToPickup ? 'DRIVER HEADING TO PICKUP' : driverIsDestinationPhase ? 'DRIVER HEADING TO DESTINATION' : 'PICKUP'}
                      </Text>
                      <Text style={styles.referenceTripValue} numberOfLines={2}>
                        {String(activeRide.pickupAddress || activeRide.pickupLocation || pickupLabel || 'Current Location')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.referenceTripConnector} />
                  <View style={styles.referenceTripRow}>
                    <View style={[styles.referenceTripDot, { backgroundColor: colors.gray900 }]} />
                    <View style={styles.referenceTripText}>
                      <Text style={styles.referenceTripLabel}>DESTINATION</Text>
                      <Text style={styles.referenceTripValue} numberOfLines={2}>
                        {String(activeRide.destinationAddress || activeRide.destination || destination?.name || 'Destination')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.referenceFareRow}>
                    <Text style={styles.referenceFareLabel}>Fare</Text>
                    <Text style={styles.referenceFareValue}>R {Number((activeRide as any).fare ?? fare ?? 0).toFixed(2)}</Text>
                  </View>
                </View>

                {/* SOS + Call side by side (matches screenshots 2 & 4) */}
                <View style={styles.referenceActionRow}>
                  <TouchableOpacity style={styles.referenceSosButton} onPress={handleSOS}>
                    <AlertTriangle size={17} color={colors.white} strokeWidth={2.3} />
                    <Text style={styles.referenceActionText}>SOS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.referenceCallButton} onPress={handleCallDriver}>
                    <Phone size={17} color={colors.white} strokeWidth={2} />
                    <Text style={styles.referenceActionText}>Call</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.referenceContactRow}>
                  <TouchableOpacity style={styles.actionButton} onPress={handleMessageDriver} activeOpacity={0.7}>
                    <MessageCircle size={20} color={colors.green} strokeWidth={2} />
                    <Text style={styles.actionButtonText}>Message</Text>
                    {unreadMessageCount > 0 && (
                      <View pointerEvents="none" style={styles.unreadMessageBadge}>
                        <Text style={styles.unreadMessageBadgeText}>{unreadMessageCount > 9 ? '9+' : unreadMessageCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={openShareRideSheet} activeOpacity={0.7}>
                    <LinkIcon size={18} color={colors.gray800} strokeWidth={2} />
                    <Text style={styles.actionButtonText}>Share Ride Link</Text>
                  </TouchableOpacity>
                </View>

                {tripStatus === 'completed' && (
                  <View style={styles.buttonContainer}>
                    <TouchableOpacity style={[styles.bottomAction, styles.completeAction]} onPress={() => setShowRatingModal(true)}>
                      <Star size={18} color={colors.white} fill={colors.white} />
                      <Text style={styles.completeActionText}>Rate our driver</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}

            {shareRideVisible && (
              <View style={styles.shareModalLayer}>
                <Pressable style={styles.shareBackdrop} onPress={closeShareRideSheet}>
                  <Animated.View
                    style={[styles.shareSheet, { opacity: shareSheetAnim, transform: [{ translateY: shareSheetAnim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }] }]}
                    onStartShouldSetResponder={() => true}
                    onTouchEnd={(e) => e.stopPropagation()}
                  >
                    <View style={styles.paymentHandle} />
                    <Text style={styles.shareTitle}>Share Ride Link</Text>
                    <Text style={styles.shareSubtitle}>Let your contacts follow your trip in real time.</Text>
                    <Text style={styles.shareLabel}>TRIP PREVIEW</Text>
                    <Text style={styles.shareRoute}>{pickupLabel} → {activeRide?.destinationAddress || destination?.name || 'Destination'}</Text>
                    <View style={styles.shareLinkRow}>
                      <Text style={styles.shareLink} numberOfLines={2}>{shareLink}</Text>
                      <TouchableOpacity style={styles.copyButton} onPress={handleCopyRideLink}>
                        <Copy size={16} color={colors.white} strokeWidth={2} />
                        <Text style={styles.copyButtonText}>Copy</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.shareChannelRow}>
                      <TouchableOpacity style={styles.whatsappButton} onPress={() => handleShareRide('whatsapp')}>
                        <MessageCircle size={17} color={colors.white} strokeWidth={2} />
                        <Text style={styles.shareChannelText}>WhatsApp</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.smsButton} onPress={() => handleShareRide('sms')}>
                        <MessageSquare size={17} color={colors.white} strokeWidth={2} />
                        <Text style={styles.shareChannelText}>SMS</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.backToTripButton} onPress={closeShareRideSheet}>
                      <ArrowLeft size={16} color={colors.gray800} strokeWidth={2} />
                      <Text style={styles.backToTripText}>Back to Trip</Text>
                    </TouchableOpacity>
                  </Animated.View>
                </Pressable>
              </View>
            )}

            {chatVisible && (
              <View style={styles.chatOverlay}>
                <Pressable style={styles.chatBackdrop} onPress={() => setChatVisible(false)} />
                <View style={styles.chatSheet}>
                  <ChatScreen
                    rideId={activeRideId || (activeRide?.id ? String(activeRide.id) : undefined)}
                    otherPartyName={driverName || activeRide?.driver?.fullName || 'Driver'}
                    onClose={() => setChatVisible(false)}
                  />
                </View>
              </View>
            )}

            {renderSosOverlay()}
            {renderRatingModal()}
          </View>
        </Modal>
      )}

      {!activeTripVisible && renderRatingModal()}
    </View>
  );
}

function NavItem({ icon, label, active, onPress }: { icon: React.ReactNode; label: string; active?: boolean; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress} activeOpacity={0.6}>
      {icon}
      <Text style={[styles.navItemLabel, active && styles.navItemLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ================= STYLES =================
const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, backgroundColor: colors.gray50 },
  formScroll: { flex: 1, minHeight: 0 },
  formContent: { paddingBottom: spacing.sm },

  header: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, backgroundColor: colors.white },
  backPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.greenLight,
  },
  backPillText: { color: colors.greenDark, fontFamily: font.bold, fontSize: 12 },
  title: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 22, marginTop: spacing.sm },
  subtitle: { color: colors.gray500, fontFamily: font.medium, fontSize: 12, marginTop: 2 },
  scheduledButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', flexShrink: 1,
    marginTop: 0, paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.full, backgroundColor: colors.green, ...shadow.sm,
  },
  scheduledButtonText: { color: colors.white, fontFamily: font.bold, fontSize: 12, flexShrink: 1 },
  scheduledActionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.sm },
  scheduledBadge: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.red, marginLeft: 4,
  },
  scheduledBadgeText: { color: colors.white, fontFamily: font.bold, fontSize: 10 },

  mapCard: {
    height: Math.min(Math.max(SCREEN_HEIGHT * 0.22, 170), 230),
    marginHorizontal: spacing.md, marginTop: spacing.sm,
    borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#e8eaed',
    ...shadow.md, position: 'relative',
  },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  mapPlaceholderText: { fontFamily: font.semibold, fontSize: 14, color: colors.gray500, fontWeight: '600' },
  liveBadge: {
    position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.white, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 5, ...shadow.sm, zIndex: 10,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green },
  liveBadgeText: { fontFamily: font.bold, fontSize: 10, fontWeight: '700', color: colors.green },
  countdownBadge: { maxWidth: '52%', flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.greenDark, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 7 },
  countdownBadgeFiring: { maxWidth: '52%', flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.orange, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 8 },
  countdownCopy: { flexShrink: 1 },
  countdownLabel: { color: colors.white, fontFamily: font.semibold, fontSize: 9, opacity: 0.9 },
  countdownValue: { color: colors.white, fontFamily: font.extrabold, fontSize: 12, letterSpacing: 0 },
  destinationBadge: {
    position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(33, 150, 243, 0.9)', borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 5, ...shadow.sm, zIndex: 10, maxWidth: '70%',
  },
  destinationBadgeText: { fontFamily: font.semibold, fontSize: 10, fontWeight: '600', color: colors.white },
  locateButton: {
    position: 'absolute', bottom: 12, right: 12, backgroundColor: colors.white,
    borderRadius: radius.full, padding: 10, ...shadow.md, zIndex: 10,
  },

  rideCard: {
    backgroundColor: colors.white, borderRadius: radius.md,
    marginHorizontal: spacing.md, marginTop: spacing.sm, padding: spacing.sm, ...shadow.sm,
  },
  rideRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  rideDot: { width: 9, height: 9, borderRadius: 5 },
  rideRowLabel: { fontFamily: font.bold, fontSize: 9, fontWeight: '700', color: colors.gray400, letterSpacing: 0 },
  rideRowValue: { fontFamily: font.semibold, fontSize: 13, color: colors.gray800, fontWeight: '600', marginTop: 1 },
  rideRowPlaceholder: { color: colors.gray400, fontWeight: '500' },
  rideDivider: { height: 1, backgroundColor: colors.gray100, marginLeft: 22, marginVertical: 2 },

  dateCard: {
    backgroundColor: colors.white, borderRadius: radius.md,
    marginHorizontal: spacing.md, marginTop: spacing.sm, padding: spacing.sm, ...shadow.sm,
  },
  sectionLabel: { fontFamily: font.bold, fontSize: 9, letterSpacing: 0, color: colors.gray500, marginBottom: spacing.xs },
  timeSectionLabel: { marginTop: spacing.sm },
  dateTabs: { gap: 6, paddingRight: spacing.sm },
  dateTab: { borderWidth: 1, borderColor: colors.gray200, backgroundColor: colors.white, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 6 },
  dateTabSelected: { backgroundColor: colors.green, borderColor: colors.green },
  dateTabText: { color: colors.gray700, fontFamily: font.bold, fontSize: 11 },
  dateTabTextSelected: { color: colors.white },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  timePill: {
    flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radius.md,
    backgroundColor: colors.gray50, borderWidth: 1, borderColor: colors.gray200,
  },
  timePillText: { color: colors.gray900, fontFamily: font.extrabold, fontSize: 24, letterSpacing: 0 },
  timePillHint: { color: colors.gray400, fontFamily: font.medium, fontSize: 8, marginLeft: 'auto', flexShrink: 1 },
  timeQuickAdjust: { flexDirection: 'row', gap: 4 },
  timeAdjustBtn: { minWidth: 40, minHeight: 34, paddingHorizontal: 6, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  timeAdjustText: { color: colors.greenDark, fontFamily: font.bold, fontSize: 10 },
  timeError: { color: colors.red, fontFamily: font.semibold, fontSize: 10, marginTop: 4 },
  timeOk: { color: colors.greenDark, fontFamily: font.semibold, fontSize: 10, marginTop: 4 },

  routeDetails: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: spacing.sm, marginTop: 4 },
  routeDetailItem: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.gray50, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm,
  },
  routeDetailText: { fontFamily: font.medium, fontSize: 11, fontWeight: '500', color: colors.gray600 },

  fixedFooter: { flexShrink: 0, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.gray100, paddingTop: 2 },
  actionsWrap: { paddingHorizontal: spacing.md, marginTop: 4, marginBottom: 4 },
  scheduleActionButton: { minHeight: 44, borderRadius: radius.md },

  bottomNav: { flexDirection: 'row', backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.gray100, paddingTop: 7 },
  navItem: { flex: 1, alignItems: 'center', gap: 3 },
  navItemLabel: { fontFamily: font.medium, fontSize: 10.5, color: colors.gray400, fontWeight: '500' },
  navItemLabelActive: { color: colors.green, fontFamily: font.semibold, fontWeight: '600' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.gray50, borderWidth: 1.5, borderColor: colors.gray200,
    borderRadius: radius.md, paddingHorizontal: 12, marginBottom: spacing.md,
  },
  searchInput: { flex: 1, fontFamily: font.regular, fontSize: 14, color: colors.gray900, paddingVertical: 10 },

  currentLocationOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
    marginBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  currentLocationIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.greenLight,
    alignItems: 'center', justifyContent: 'center',
  },

  categoryFilter: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  categoryFilterText: { fontFamily: font.semibold, fontSize: 12, fontWeight: '600', color: colors.gray600 },

  destOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  destOptionSelected: { backgroundColor: 'rgba(33, 150, 243, 0.05)' },
  destIconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  destIconCircleSelected: { backgroundColor: colors.blue },
  destName: { fontFamily: font.semibold, fontSize: 14.5, color: colors.gray900, fontWeight: '600' },
  destNameSelected: { color: colors.blue },
  destAddress: { fontFamily: font.regular, fontSize: 12, color: colors.gray500, marginTop: 1 },
  destMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  destCategory: {
    fontFamily: font.medium, fontSize: 10, fontWeight: '500', color: colors.gray400,
    backgroundColor: colors.gray100, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4,
  },
  destDistance: { fontFamily: font.regular, fontSize: 11, color: colors.gray400 },
  noResultsContainer: { alignItems: 'center', paddingVertical: spacing.xl },
  noResults: { fontFamily: font.medium, fontSize: 14, color: colors.gray600, textAlign: 'center' },
  noResultsSub: { fontFamily: font.regular, fontSize: 12, color: colors.gray400, textAlign: 'center', marginTop: 4 },

  timeModalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  timeModalCard: { width: '100%', maxWidth: 380, backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, ...shadow.lg },
  timeModalTitle: { fontFamily: font.bold, fontSize: 16, color: colors.gray900, textAlign: 'center' },
  timeModalValue: { fontFamily: font.extrabold, fontSize: 40, color: colors.greenDark, textAlign: 'center', marginVertical: spacing.md, letterSpacing: 1 },
  timeModalGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  timeModalCell: {
    minWidth: 46, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.gray200, backgroundColor: colors.white, alignItems: 'center', marginBottom: 4,
  },
  timeModalCellSelected: { backgroundColor: colors.green, borderColor: colors.green },
  timeModalCellText: { fontFamily: font.bold, fontSize: 13, color: colors.gray800 },
  timeModalCellTextSelected: { color: colors.white },
  timeModalMinutesRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.md },
  timeModalConfirm: { marginTop: spacing.lg, backgroundColor: colors.green, borderRadius: radius.md, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  timeModalConfirmText: { color: colors.white, fontFamily: font.bold, fontSize: 14 },

  paymentBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  paymentSheet: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xxl },
  paymentHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: colors.gray300, marginBottom: spacing.md },
  paymentTitle: { fontFamily: font.bold, fontSize: 21, color: colors.gray900 },
  paymentSubtitle: { fontFamily: font.regular, fontSize: 13, color: colors.gray500, marginTop: 4, marginBottom: spacing.md },
  paymentTripCard: { backgroundColor: colors.gray50, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  paymentTripRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 3 },
  paymentTripText: { flex: 1, fontFamily: font.medium, fontSize: 13, color: colors.gray800 },
  paymentTripDivider: { height: 10, borderLeftWidth: 1, borderLeftColor: colors.gray300, marginLeft: 8, marginVertical: 2 },
  paymentSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.gray200, marginTop: spacing.md, paddingTop: spacing.md },
  paymentSummaryLabel: { fontFamily: font.medium, fontSize: 12, color: colors.gray500 },
  paymentAmount: { fontFamily: font.bold, fontSize: 19, color: colors.gray900 },
  paymentSectionTitle: { fontFamily: font.bold, fontSize: 14, color: colors.gray800, marginBottom: spacing.sm },
  paymentOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  paymentOptionSelected: { borderColor: colors.green, backgroundColor: colors.greenLight },
  paymentOptionDisabled: { opacity: 0.55 },
  paymentOptionText: { flex: 1 },
  paymentOptionTitle: { fontFamily: font.bold, fontSize: 14, color: colors.gray800 },
  paymentOptionSubtitle: { fontFamily: font.regular, fontSize: 11, color: colors.gray500, marginTop: 2 },
  savedCards: { marginTop: spacing.xs, marginBottom: spacing.sm },
  savedCardsTitle: { fontFamily: font.bold, fontSize: 12, color: colors.gray600, marginBottom: spacing.xs },
  savedCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.md, padding: spacing.md },
  savedCardSelected: { borderColor: colors.blue, backgroundColor: '#eff6ff' },
  proceedPaymentButton: { backgroundColor: colors.green, borderRadius: radius.md, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  proceedPaymentText: { fontFamily: font.bold, fontSize: 14, color: colors.white },

  listBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  listSheet: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xxl },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listTitle: { fontFamily: font.bold, fontSize: 21, color: colors.gray900 },
  listCloseBtn: { padding: 6, borderRadius: radius.full, backgroundColor: colors.gray100 },
  listSubtitle: { fontFamily: font.regular, fontSize: 12, color: colors.gray500, marginTop: 4, marginBottom: spacing.md },
  listEmptyText: { fontFamily: font.semibold, fontSize: 14, color: colors.gray600, marginTop: spacing.md, textAlign: 'center' },
  listEmptySub: { fontFamily: font.regular, fontSize: 12, color: colors.gray400, marginTop: 4, textAlign: 'center' },
  listItem: { borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, backgroundColor: colors.white },
  listItemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  listItemTime: { fontFamily: font.bold, fontSize: 12.5, color: colors.gray800 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontFamily: font.bold, fontSize: 10 },
  listCountdownRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.greenLight, alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  listCountdownText: { fontFamily: font.bold, fontSize: 11, color: colors.greenDark },
  listRoute: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  listDot: { width: 9, height: 9, borderRadius: 5 },
  listRouteText: { flex: 1, fontFamily: font.medium, fontSize: 13, color: colors.gray800 },
  listRouteConnector: { height: 12, borderLeftWidth: 2, borderLeftColor: colors.gray300, marginLeft: 4, marginVertical: 2 },
  listMetaRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.gray100, marginTop: spacing.md, paddingTop: spacing.sm },
  listMetaText: { fontFamily: font.medium, fontSize: 11.5, color: colors.gray600 },
  listActionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  listAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 38, borderRadius: radius.full },
  listActionPrimary: { backgroundColor: colors.green },
  listActionPrimaryText: { color: colors.white, fontFamily: font.bold, fontSize: 12 },
  listActionDanger: { borderWidth: 1, borderColor: colors.red, backgroundColor: 'rgba(244,67,54,0.06)' },
  listActionDangerText: { color: colors.red, fontFamily: font.bold, fontSize: 12 },

  overlayContainer: { flex: 1, flexDirection: 'column', backgroundColor: '#ffffff' },
  overlayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  overlayTitle: { fontFamily: font.bold, fontSize: 20, fontWeight: '700', color: colors.gray900, letterSpacing: 0.2 },
  headerRight: { width: 40 },
  closeButton: { padding: 10, borderRadius: radius.full, backgroundColor: colors.gray100 },
  overlayContent: { flex: 1, paddingHorizontal: spacing.xl },

  activeLoadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  activeLoadingText: { fontFamily: font.semibold, fontSize: 14, color: colors.gray500 },

  searchContainer: { alignItems: 'center', marginBottom: spacing.xl, paddingTop: spacing.xl },
  searchCircle: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl, position: 'relative' },
  pulseRing: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(76, 175, 80, 0.12)', borderWidth: 2, borderColor: 'rgba(76, 175, 80, 0.25)' },
  loadingRing: { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 2.5, borderColor: 'rgba(76, 175, 80, 0.2)', borderTopColor: colors.green, borderRightColor: colors.green },
  carIconContainer: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.green,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.green, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 12,
  },
  foundContainer: { alignItems: 'center', justifyContent: 'center' },
  foundCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(76, 175, 80, 0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.green },
  searchStatus: { fontFamily: font.bold, fontSize: 24, fontWeight: '700', color: colors.gray900, marginBottom: 8, letterSpacing: 0.3 },
  searchSubStatus: { fontFamily: font.regular, fontSize: 14, color: colors.gray600, textAlign: 'center', lineHeight: 20 },

  driverInfo: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.06)', borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.lg, width: '100%',
    borderWidth: 1, borderColor: 'rgba(76, 175, 80, 0.25)',
  },
  driverAvatar: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: colors.blue,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.lg,
    shadowColor: colors.blue, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  driverAvatarText: { fontFamily: font.bold, fontSize: 22, fontWeight: '700', color: colors.white },
  driverDetails: { flex: 1 },
  driverName: { fontFamily: font.bold, fontSize: 16, fontWeight: '700', color: colors.gray900, marginBottom: 4 },
  driverRatingContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, marginBottom: 3 },
  driverRating: { fontFamily: font.semibold, fontSize: 13, fontWeight: '600', color: colors.orange },
  driverCar: { fontFamily: font.regular, fontSize: 13, color: colors.gray700, marginTop: 2 },
  driverPlate: { fontFamily: font.semibold, fontSize: 12, fontWeight: '600', color: colors.gray600, letterSpacing: 0.8, marginTop: 1 },

  tripDetails: {
    width: '100%', backgroundColor: colors.gray50, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.gray200,
  },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  tripIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center' },
  tripTextContainer: { flex: 1 },
  tripLabel: { fontFamily: font.medium, fontSize: 11, fontWeight: '500', color: colors.gray500, textTransform: 'uppercase', letterSpacing: 0.8 },
  tripValue: { fontFamily: font.semibold, fontSize: 15, fontWeight: '600', color: colors.gray900, marginTop: 3, lineHeight: 21 },
  tripDivider: { height: 1, backgroundColor: colors.gray200, marginLeft: 54 },

  rideInfo: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.08)', borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: 12, marginBottom: spacing.xl,
    width: '100%', borderWidth: 1, borderColor: 'rgba(76, 175, 80, 0.2)',
  },
  rideInfoItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  rideInfoText: { fontFamily: font.medium, fontSize: 13, fontWeight: '500', color: colors.gray700 },
  rideInfoFare: { fontFamily: font.bold, fontSize: 15, fontWeight: '700', color: colors.green },
  rideInfoDivider: { width: 1, height: 22, backgroundColor: 'rgba(76, 175, 80, 0.25)' },

  cancelButton: {
    paddingVertical: 14, paddingHorizontal: 48, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: '#f44336', marginTop: spacing.lg, alignSelf: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.08)',
  },
  cancelButtonText: { fontFamily: font.semibold, fontSize: 15, fontWeight: '600', color: '#f44336' },

  activeMapContainer: {
    height: Math.min(SCREEN_HEIGHT * 0.3, 250), borderRadius: radius.lg, overflow: 'hidden',
    backgroundColor: colors.gray100, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.gray200,
  },
  activeMapStatus: {
    position: 'absolute', top: spacing.md, left: spacing.md, maxWidth: '82%',
    flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 8, paddingHorizontal: 11,
    borderRadius: radius.md, backgroundColor: colors.greenDark,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', ...shadow.sm,
  },
  mapStatusText: { flexShrink: 1, fontFamily: font.semibold, fontSize: 12, fontWeight: '600', color: colors.white },

  activeDriverCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.gray200 },
  driverHeader: { flexDirection: 'row', alignItems: 'center' },
  referenceDriverAvatar: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md, backgroundColor: colors.blue, ...shadow.sm,
  },
  referenceDriverIdentity: { flex: 1, minWidth: 0 },
  referenceDriverVehicle: { marginTop: 2, fontFamily: font.regular, fontSize: 12, color: colors.gray500 },
  referenceDriverRating: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  referenceDriverRatingText: { fontFamily: font.medium, fontSize: 11, color: colors.orange },
  referencePlateBadge: { maxWidth: 106, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.sm, backgroundColor: colors.gray900 },
  referencePlateText: { fontFamily: font.bold, fontSize: 11, color: colors.white, letterSpacing: 0.4 },

  referenceTripCard: { backgroundColor: colors.gray50, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.gray100 },
  referenceTripRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  referenceTripDot: { width: 10, height: 10, borderRadius: 5 },
  referenceTripText: { flex: 1 },
  referenceTripLabel: { fontFamily: font.bold, fontSize: 10, letterSpacing: 0.8, color: colors.gray400 },
  referenceTripValue: { marginTop: 3, fontFamily: font.bold, fontSize: 15, color: colors.gray800 },
  referenceTripConnector: { height: 20, borderLeftWidth: 2, borderLeftColor: colors.gray300, marginLeft: 4, marginVertical: 2 },
  referenceFareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.gray200, marginTop: spacing.lg, paddingTop: spacing.md },
  referenceFareLabel: { fontFamily: font.medium, fontSize: 13, color: colors.gray500 },
  referenceFareValue: { fontFamily: font.bold, fontSize: 18, color: colors.green },
  referenceActionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  referenceCallButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, borderRadius: radius.full, backgroundColor: colors.green },
  referenceSosButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, borderRadius: radius.full, backgroundColor: '#ef4444' },
  referenceActionText: { fontFamily: font.bold, fontSize: 13, color: colors.white },
  referenceContactRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  actionButton: {
    position: 'relative', flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.gray50,
    borderWidth: 1, borderColor: colors.gray200,
  },
  actionButtonText: { fontFamily: font.medium, fontSize: 12, fontWeight: '500', color: colors.gray700 },
  unreadMessageBadge: {
    position: 'absolute', top: -8, right: -8, minWidth: 19, height: 19, borderRadius: 10,
    paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.red, borderWidth: 2, borderColor: colors.white,
  },
  unreadMessageBadgeText: { color: colors.white, fontFamily: font.bold, fontSize: 10 },
  buttonContainer: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  bottomAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: radius.lg },
  completeAction: { backgroundColor: colors.green },
  completeActionText: { fontFamily: font.bold, fontSize: 14, color: colors.white },

  // ===== SOS styles =====
  sosLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 300, justifyContent: 'flex-end', paddingHorizontal: 22 },
  sosActivatedLayer: { paddingHorizontal: 0, justifyContent: 'flex-start' },
  sosBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.46)' },
  sosCard: { width: '100%', padding: spacing.xl, paddingBottom: spacing.lg, borderRadius: 24, backgroundColor: colors.white, alignItems: 'center', shadowColor: colors.black, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 24 },
  sosHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.gray300, marginBottom: spacing.xl },
  sosWarningIcon: { width: 54, height: 50, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  sosTitle: { color: '#111827', fontFamily: font.bold, fontSize: 19, textAlign: 'center' },
  sosSubtitle: { color: '#7b8494', fontFamily: font.regular, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg, maxWidth: 300 },
  sosConfirmButton: { width: '100%', minHeight: 48, borderRadius: radius.full, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },
  sosConfirmText: { color: colors.white, fontFamily: font.bold, fontSize: 14 },
  sosCancelButton: { marginTop: spacing.md, alignItems: 'center', justifyContent: 'center' },
  sosCancelText: { color: colors.gray700, fontFamily: font.bold, fontSize: 15 },
  sosActivatedPanel: { flex: 1, width: '100%', backgroundColor: colors.white, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  sosActivatedHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.md },
  sosBackButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sosHeaderIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  sosActivatedTitle: { color: colors.white, fontFamily: font.bold, fontSize: 20 },
  sosActivatedSubtitle: { color: 'rgba(255,255,255,0.85)', fontFamily: font.regular, fontSize: 12, marginTop: 4 },
  sosAlertNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  sosAlertNoticeText: { flex: 1, color: '#7f1d1d', fontFamily: font.medium, fontSize: 12 },
  sosGpsCard: { backgroundColor: '#f9fafb', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: '#e5e7eb' },
  sosSectionLabel: { color: '#6b7280', fontFamily: font.bold, fontSize: 11, letterSpacing: 0.8 },
  sosGpsValue: { marginTop: 6, color: '#111827', fontFamily: font.bold, fontSize: 16 },
  sosGpsDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', position: 'absolute', top: spacing.md, right: spacing.md },
  sosEvidenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sosRecBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  sosRecDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#ef4444' },
  sosRecText: { fontFamily: font.bold, fontSize: 10, color: '#b91c1c' },
  sosTimer: { fontFamily: font.extrabold, fontSize: 40, letterSpacing: 2, color: '#111827', marginVertical: spacing.sm, textAlign: 'center' },
  sosWaveform: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4, height: 42, marginBottom: spacing.md },
  sosWaveBar: { width: 6, borderRadius: 999, backgroundColor: '#ef4444' },
  sosRecordingButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#f87171', borderRadius: radius.full, marginBottom: spacing.md },
  sosRecordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fecaca' },
  sosRecordingText: { color: colors.white, fontFamily: font.bold, fontSize: 13 },
  sosSafeButton: { backgroundColor: colors.green, borderRadius: radius.full, paddingVertical: 14, alignItems: 'center' },
  sosSafeText: { color: colors.white, fontFamily: font.bold, fontSize: 15 },
  sosBottomNotice: { position: 'absolute', bottom: 18, left: 18, right: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#ef4444', paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md },
  sosBottomNoticeText: { color: colors.white, fontFamily: font.medium, fontSize: 12 },

  // ===== Rating full-screen (matches screenshots 5 & 6) =====
  ratingFullBackdrop: { flex: 1, backgroundColor: colors.white },
  ratingFullHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  ratingBackButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingHeaderTitle: { fontFamily: font.bold, fontSize: 16, color: colors.gray900 },
  ratingContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, alignItems: 'center' },
  ratingTopLabel: {
    color: colors.greenDark,
    fontFamily: font.bold,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  ratingBigTitle: {
    color: colors.gray900,
    fontFamily: font.extrabold,
    fontSize: 26,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  ratingBigSubtitle: {
    color: colors.gray500,
    fontFamily: font.regular,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  ratingStarsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginVertical: spacing.xxl,
  },
  ratingBigStarButton: { padding: spacing.xs },
  ratingCommentInput: {
    width: '100%',
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.gray900,
    backgroundColor: colors.white,
    marginBottom: spacing.lg,
  },
  ratingBigSubmit: {
    width: '100%',
    minHeight: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingBigSubmitDisabled: { backgroundColor: colors.gray300 },
  ratingBigSubmitText: { color: colors.white, fontFamily: font.bold, fontSize: 15 },

  ratingBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: 'rgba(17,24,39,0.55)' },
  ratingCard: { width: '100%', maxWidth: 360, alignItems: 'center', padding: spacing.xxl, borderRadius: radius.xl, backgroundColor: colors.white, ...shadow.lg },
  thankYouCard: { width: '100%', maxWidth: 330, alignItems: 'center', padding: spacing.xxl, borderRadius: radius.xl, backgroundColor: colors.white, ...shadow.lg },
  ratingTitle: { color: colors.gray900, fontFamily: font.bold, fontSize: 20, textAlign: 'center' },
  ratingSubtitle: { marginTop: spacing.sm, color: colors.gray500, fontFamily: font.regular, fontSize: 13, textAlign: 'center' },
  ratingStars: { flexDirection: 'row', marginVertical: spacing.xxl },
  ratingStarButton: { paddingHorizontal: spacing.xs },
  submitRatingButton: { width: '100%', alignItems: 'center', justifyContent: 'center', minHeight: 50, borderRadius: radius.md, backgroundColor: colors.green },
  submitRatingDisabled: { backgroundColor: colors.gray300 },
  submitRatingText: { color: colors.white, fontFamily: font.bold, fontSize: 15 },
  thankYouIcon: { alignItems: 'center', justifyContent: 'center', width: 58, height: 58, marginBottom: spacing.lg, borderRadius: radius.full, backgroundColor: colors.green },

  shareModalLayer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 100, elevation: 100,
  },
  shareBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,24,39,0.16)' },
  shareSheet: {
    width: '100%', backgroundColor: colors.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl,
    ...shadow.lg,
  },
  shareTitle: { fontFamily: font.bold, fontSize: 21, fontWeight: '700', color: colors.gray900, marginTop: spacing.lg },
  shareSubtitle: { marginTop: spacing.xs, marginBottom: spacing.lg, fontFamily: font.regular, fontSize: 12, color: colors.gray500 },
  shareLabel: { fontFamily: font.bold, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: colors.gray400 },
  shareRoute: { marginTop: spacing.sm, fontFamily: font.bold, fontSize: 15, fontWeight: '700', color: colors.gray900 },
  shareLinkRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md,
    backgroundColor: colors.gray50,
  },
  shareLink: { flex: 1, fontFamily: font.mono, fontSize: 11, color: colors.gray700 },
  copyButton: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full, backgroundColor: colors.green,
  },
  copyButtonText: { fontFamily: font.bold, fontSize: 12, color: colors.white },
  shareChannelRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  whatsappButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, minHeight: 48, borderRadius: radius.full, backgroundColor: colors.green,
  },
  smsButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, minHeight: 48, borderRadius: radius.full, backgroundColor: colors.blue,
  },
  shareChannelText: { fontFamily: font.bold, fontSize: 13, fontWeight: '700', color: colors.white },
  backToTripButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 48, marginTop: spacing.md, borderWidth: 1, borderColor: colors.gray200,
    borderRadius: radius.full,
  },
  backToTripText: { fontFamily: font.bold, fontSize: 13, color: colors.gray800 },
  chatOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'flex-end', zIndex: 100,
  },
  chatBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.34)',
  },
  chatSheet: {
    height: '88%', overflow: 'hidden',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    backgroundColor: colors.gray50,
  },
  riderMessageToast: {
    position: 'absolute', left: spacing.lg, right: spacing.lg,
    zIndex: 200, elevation: 30,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.lg,
    backgroundColor: colors.green, ...shadow.md,
  },
  riderMessageToastText: { flex: 1, color: colors.white, fontFamily: font.semibold, fontSize: 13 },
  riderMessageToastClose: { marginLeft: spacing.sm, padding: spacing.xs },
  riderMessageToastCloseText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});