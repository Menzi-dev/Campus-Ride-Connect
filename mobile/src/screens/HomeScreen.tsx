// mobile/src/screens/HomeScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
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
  House,
  Clock,
  Clock as ClockIcon,
  CalendarDays,
  CircleUserRound,
  Route,
  Check,
  Navigation,
  AlertCircle,
  Phone,
  MessageCircle,
  Star,
  AlertTriangle,
  CreditCard,
  Banknote,
  Circle,
  CheckCircle2,
  Link,
  Copy,
  MessageSquare,
  ArrowLeft,
} from 'lucide-react-native';
import Button from '../components/Button';
import BottomSheetModal from '../components/BottomSheetModal';
import ChatScreen from './ChatScreen';
import { useToast } from '../components/Toast';
import { colors, radius, spacing, font, shadow } from '../theme/theme';

const MAX_SOS_RECORDING_SECONDS = 60;
const SOS_AUDIO_SEGMENT_SECONDS = 5;
import apiClient from '../services/ApiClient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Web - Use Leaflet with dynamic import
let MapContainer: any = null;
let TileLayer: any = null;
let Marker: any = null;
let Popup: any = null;
let Polyline: any = null;
let useMap: any = null;
let ZoomControl: any = null;

// Only load Leaflet on web
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
    console.warn('Leaflet not available:', e);
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

// SPU Kimberley Campus locations
const CAMPUS_LOCATIONS: CampusLocation[] = [
  {
    name: 'Library Complex',
    coords: { latitude: -28.7411, longitude: 24.7685 },
    address: 'Library Road, Kimberley',
    category: 'Academic',
  },
  {
    name: 'Main Lecture Block',
    coords: { latitude: -28.7420, longitude: 24.7695 },
    address: 'Academic Avenue, Kimberley',
    category: 'Academic',
  },
  {
    name: 'Residence Block D',
    coords: { latitude: -28.7435, longitude: 24.7705 },
    address: 'Residence Street, Kimberley',
    category: 'Residence',
  },
  {
    name: 'Sports Complex',
    coords: { latitude: -28.7445, longitude: 24.7715 },
    address: 'Sports Road, Kimberley',
    category: 'Recreation',
  },
  {
    name: 'Student Village',
    coords: { latitude: -28.7455, longitude: 24.7725 },
    address: 'Village Drive, Kimberley',
    category: 'Residence',
  },
  {
    name: 'Cafeteria',
    coords: { latitude: -28.7465, longitude: 24.7735 },
    address: 'Food Court Lane, Kimberley',
    category: 'Dining',
  },
  {
    name: 'Main Gate',
    coords: { latitude: -28.7480, longitude: 24.7750 },
    address: 'Entrance Road, Kimberley',
    category: 'Entrance',
  },
];

const FALLBACK_REGION: Coords = { latitude: -28.7440, longitude: 24.7720 };

// Public, keyless routing/geocoding endpoints
const OSRM_ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving';
const PHOTON_SEARCH_URL = 'https://photon.komoot.io/api/';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

function distanceKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
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
        address: addressParts.length ? addressParts.join(', ') : (props.country || 'South Africa'),
        category: props.osm_value
          ? capitalize(String(props.osm_value).replace(/_/g, ' '))
          : (props.type ? capitalize(String(props.type)) : 'Place'),
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

async function getRoute(start: Coords, end: Coords): Promise<{
  coordinates: RoutePoint[];
  distance: number;
  duration: number;
}> {
  try {
    const url = `${OSRM_ROUTE_URL}/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson&steps=false`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to get route');
    }

    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes?.length) {
      throw new Error('No route found');
    }

    const route = data.routes[0];

    return {
      coordinates: route.geometry.coordinates,
      distance: route.distance / 1000,
      duration: route.duration / 60,
    };
  } catch (error) {
    console.error('Routing error:', error);
    return {
      coordinates: [
        [start.longitude, start.latitude],
        [end.longitude, end.latitude]
      ],
      distance: distanceKm(start, end),
      duration: (distanceKm(start, end) / 25) * 60,
    };
  }
}

function routeToMapCoords(routeCoords: RoutePoint[]): Coords[] {
  return routeCoords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}

function interpolateRoute(route: Coords[], progress: number): Coords {
  if (!route.length) return FALLBACK_REGION;
  const index = Math.min(route.length - 1, Math.max(0, Math.floor(progress * route.length)));
  return route[index] || route[0];
}

const BASE_FARE = 5;
const RATE_PER_KM = 4;
const DRIVER_START_POINT: Coords = { latitude: -28.7587766, longitude: 24.759741 };

function estimateFare(km: number) {
  const fare = BASE_FARE + km * RATE_PER_KM;
  return Math.round(fare * 2) / 2;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getRouteHeading(position: Coords, routePoints: Coords[]): number {
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

// Web Map Component
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
  driverDestination?: Coords;
  driverMarker?: boolean;
}) => {
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const checkLeafletCSS = () => {
        const links = document.querySelectorAll('link[rel="stylesheet"]');
        let leafletLoaded = false;
        links.forEach(link => {
          if (link.getAttribute('href')?.includes('leaflet')) {
            leafletLoaded = true;
          }
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

  const createMarkerIcon = (color: string, size: number = 16, emoji?: string) => {
    if (typeof window === 'undefined' || !MapContainer) return null;
    try {
      const L = require('leaflet');
      return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          background-color: ${color}; 
          width: ${size}px; 
          height: ${size}px; 
          border-radius: 50%; 
          border: 3px solid white; 
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${emoji ? '16px' : '0'};
        ">${emoji || ''}</div>`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2],
      });
    } catch (e) {
      return null;
    }
  };
  
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
  };

  const MapUpdater = () => {
    const map = useMap();
    useEffect(() => {
      if (!map) return;
      let cancelled = false;
      const updateMap = setTimeout(() => {
        if (cancelled) return;
        try {
          map.invalidateSize();
          // If we have a driver route, fit to the whole route
          if (routePoints && routePoints.length > 1) {
            const L = require('leaflet');
            const bounds = L.latLngBounds(
              routePoints.map((p) => [p.latitude, p.longitude])
            );
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
          } else if (destination) {
            const L = require('leaflet');
            const bounds = L.latLngBounds(
              [userLocation.latitude, userLocation.longitude],
              [destination.coords.latitude, destination.coords.longitude]
            );
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
          } else {
            map.setView([userLocation.latitude, userLocation.longitude], 15);
          }
        } catch {
          // The map may be unmounted while a route update is settling.
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
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
          />

          <ZoomControl position="topright" />

          <MapUpdater />

          <Marker
            position={[userLocation.latitude, userLocation.longitude]}
            icon={createLocationPinIcon('#16a34a', 25)}
          >
            <Popup>Your Location</Popup>
          </Marker>

          {destination && (
            <Marker
              position={[destination.coords.latitude, destination.coords.longitude]}
              icon={createLocationPinIcon('#ef4444', 28)}
            >
              <Popup>
                <strong>{destination.name}</strong>
                <br />
                <span style={{ fontSize: 12 }}>{destination.address}</span>
                <br />
                <span style={{ fontSize: 11, color: '#666' }}>{destination.category}</span>
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
              positions={routePoints.map(p => [p.latitude, p.longitude])}
              color="#2196F3"
              weight={6}
              opacity={0.9}
              lineCap="round"
              lineJoin="round"
              smoothFactor={1}
            />
          )}

          {loading && (
            <div style={{
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
            }}>
              <div className="spinner" style={{
                width: 24,
                height: 24,
                border: '3px solid rgba(255,255,255,0.3)',
                borderTop: '3px solid white',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <span>Calculating route...</span>
            </div>
          )}
        </MapContainer>
      </View>
    );
  } catch (e) {
    setMapError(true);
    return (
      <View style={styles.mapPlaceholder}>
        <ActivityIndicator size="large" color={colors.green} />
        <Text style={styles.mapPlaceholderText}>Loading map...</Text>
      </View>
    );
  }
};

// Types for ride data from backend
type RideRequest = {
  id: string;
  riderId: string;
  driverId?: string;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  destinationLat: number;
  destinationLng: number;
  destinationAddress: string;
  fare: number;
  distance: number;
  duration: number;
  status: 'pending' | 'accepted' | 'enroute' | 'arrived' | 'started' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  currentLat?: number;
  currentLng?: number;
  driver?: {
    id: string;
    fullName: string;
    rating: number;
    vehicleMake: string;
    vehicleModel: string;
    licencePlate: string;
    phone?: string;
  };
};

export default function HomeScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Home'>>();
  const skipActiveRideRestore = route.params?.skipActiveRideRestore === true;
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  // User state
  const [firstName, setFirstName] = useState('');
  const [userId, setUserId] = useState<string>('');
  const [userLocation, setUserLocation] = useState<Coords>(FALLBACK_REGION);
  const [pickupLabel, setPickupLabel] = useState('Detecting location...');
  const [locating, setLocating] = useState(true);
  const [pickupSheetVisible, setPickupSheetVisible] = useState(false);
  const [pickupSearch, setPickupSearch] = useState('');
  const [pickupSearchResults, setPickupSearchResults] = useState<CampusLocation[]>([]);
  const [pickupSearchLoading, setPickupSearchLoading] = useState(false);

  // Trip state
  const [destination, setDestination] = useState<CampusLocation | null>(null);
  const [destSheetVisible, setDestSheetVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [routePoints, setRoutePoints] = useState<Coords[]>([]);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [routing, setRouting] = useState(false);

  // Real ride state
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [currentRide, setCurrentRide] = useState<RideRequest | null>(null);

  // Finding Drivers overlay state
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
  const [tripStatus, setTripStatus] = useState<'enroute' | 'arrived' | 'started' | 'completed'>('enroute');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showActiveTrip, setShowActiveTrip] = useState(false);
  const [sosVisible, setSosVisible] = useState(false);
  const [sosSending, setSosSending] = useState(false);
  const [sosDispatched, setSosDispatched] = useState(false);
  const [sosRecordingSeconds, setSosRecordingSeconds] = useState(0);
  const sosRecordingSecondsRef = useRef(0);
  const sosUploadingRef = useRef(false);
  const [sosLocation, setSosLocation] = useState<Coords>(FALLBACK_REGION);
  const [showSosRecordingToast, setShowSosRecordingToast] = useState(false);
  const sosRecordingRef = useRef<Audio.Recording | null>(null);
  const sosWebRecorderRef = useRef<MediaRecorder | null>(null);
  const sosWebStreamRef = useRef<MediaStream | null>(null);
  const sosWebChunksRef = useRef<Blob[]>([]);
  const sosWebSegmentChunksRef = useRef<Blob[]>([]);
  const sosAlertIdRef = useRef<number | null>(null);
  const sosTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sosToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sosWaveAnimationsRef = useRef(
    Array.from({ length: 11 }, () => new Animated.Value(0.55))
  );
  const [chatVisible, setChatVisible] = useState(false);
  const [riderMessageToast, setRiderMessageToast] = useState('');
  const riderToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const seenMessageIdsRef = useRef<Set<number>>(new Set());
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [showRatingThankYou, setShowRatingThankYou] = useState(false);
  const [shareRideVisible, setShareRideVisible] = useState(false);
  const shareSheetAnim = useRef(new Animated.Value(0)).current;
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [selectedCard, setSelectedCard] = useState('4242');
  const [paymentRide, setPaymentRide] = useState<RideRequest | null>(null);
  const [pollingInterval, setPollingInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  // Real search + real nearby places state
  const [searchResults, setSearchResults] = useState<CampusLocation[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<CampusLocation[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  // ===== DRIVER NAVIGATION STATE (mirrors DriverActiveRideScreen) =====
  const [driverRoutePoints, setDriverRoutePoints] = useState<Coords[]>([]);
  const [driverCarPosition, setDriverCarPosition] = useState<Coords>(DRIVER_START_POINT);
  const [driverProgress, setDriverProgress] = useState(0);
  const driverAnimationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const driverRouteRequestRef = useRef(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickupSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Finding drivers animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const driverFadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const rotateLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // ===== CLEAR DRIVER NAVIGATION =====
  // Wipes the route polyline, the car marker and stops the animation loop.
  // Called when the trip is completed so nothing is left on the map.
  const clearDriverNavigation = () => {
    driverRouteRequestRef.current += 1; // invalidate any in-flight route fetch
    setDriverRoutePoints([]);
    setDriverCarPosition(DRIVER_START_POINT);
    setDriverProgress(0);
  };

  // Load user data
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('user');
        if (raw) {
          const user = JSON.parse(raw);
          if (user?.fullName) setFirstName(user.fullName.split(' ')[0]);
          if (user?.id) setUserId(user.id);
        }
      } catch (e) {}
    })();
    detectLocation();
    if (!skipActiveRideRestore) checkForActiveRide();

    // Fade in animation
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [skipActiveRideRestore]);

  useEffect(() => {
    if (!currentRideId || !userId || !showActiveTrip) return;

    let cancelled = false;
    const pollMessages = async () => {
      try {
        const response = await apiClient.get(`/rides/${currentRideId}/messages`);
        const messages: { id: number; senderId: number; message: string; senderName?: string }[] = response.data || [];
        if (cancelled) return;

        const firstPoll = seenMessageIdsRef.current.size === 0;
        const incoming = messages.filter((message) => message.senderId !== Number(userId) && !seenMessageIdsRef.current.has(message.id));
        messages.forEach((message) => seenMessageIdsRef.current.add(message.id));
        if (!firstPoll && incoming.length > 0) {
          const latest = incoming[incoming.length - 1];
          setRiderMessageToast(`${latest.senderName || 'Driver'}: ${latest.message}`);
          if (riderToastTimerRef.current) clearTimeout(riderToastTimerRef.current);
          riderToastTimerRef.current = setTimeout(() => setRiderMessageToast(''), 3200);
          setUnreadMessageCount((count) => count + incoming.length);
        }
      } catch {
        // Message polling is non-critical while the trip continues.
      }
    };

    pollMessages();
    const interval = setInterval(pollMessages, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (riderToastTimerRef.current) clearTimeout(riderToastTimerRef.current);
    };
  }, [currentRideId, userId, showActiveTrip]);

  // ===== DRIVER PHASE DERIVATION (mirrors driver screen) =====
  const driverPhase = String(currentRide?.status || tripStatus || '').toLowerCase();
  const driverHeadingToPickup =
    driverPhase === 'accepted' || driverPhase === 'enroute' || driverPhase === 'pending';
  const driverIsArrivalPhase = driverPhase === 'arrived';
  const driverIsDestinationPhase = driverPhase === 'started';
  const tripCompleted = driverPhase === 'completed' || tripStatus === 'completed';

  // ===== Defensive extraction of pickup/dest from backend (handles camelCase + snake_case) =====
  const ridePickupLat = useMemo(() => {
    const r: any = currentRide;
    return Number(
      r?.pickupLat ??
        r?.pickup_lat ??
        r?.pickup?.latitude ??
        userLocation.latitude
    );
  }, [currentRide, userLocation.latitude]);

  const ridePickupLng = useMemo(() => {
    const r: any = currentRide;
    return Number(
      r?.pickupLng ??
        r?.pickup_lng ??
        r?.pickup?.longitude ??
        userLocation.longitude
    );
  }, [currentRide, userLocation.longitude]);

  const rideDestLat = useMemo(() => {
    const r: any = currentRide;
    return Number(
      r?.destinationLat ??
        r?.destLat ??
        r?.destination_lat ??
        r?.dest_lat ??
        r?.destination?.latitude ??
        destination?.coords.latitude ??
        ridePickupLat
    );
  }, [currentRide, destination?.coords.latitude, ridePickupLat]);

  const rideDestLng = useMemo(() => {
    const r: any = currentRide;
    return Number(
      r?.destinationLng ??
        r?.destLng ??
        r?.destination_lng ??
        r?.dest_lng ??
        r?.destination?.longitude ??
        destination?.coords.longitude ??
        ridePickupLng
    );
  }, [currentRide, destination?.coords.longitude, ridePickupLng]);

  // Compute driver start/end points based on phase (mirrors driver screen)
  const driverStartPoint = useMemo<Coords>(() => {
    if (driverHeadingToPickup) return DRIVER_START_POINT;
    return { latitude: ridePickupLat, longitude: ridePickupLng };
  }, [driverHeadingToPickup, ridePickupLat, ridePickupLng]);

  const driverEndPoint = useMemo<Coords>(() => {
    if (driverHeadingToPickup) {
      return { latitude: ridePickupLat, longitude: ridePickupLng };
    }
    return { latitude: rideDestLat, longitude: rideDestLng };
  }, [driverHeadingToPickup, ridePickupLat, ridePickupLng, rideDestLat, rideDestLng]);

  // Check if user has an active ride
  const checkForActiveRide = async () => {
    try {
      const response = await apiClient.get('/rides/active');
      if (response.data && response.data.id) {
        const status = String(response.data.status || '').toLowerCase();
        setCurrentRide(response.data);
        setCurrentRideId(String(response.data.id));

        if (status === 'pending') {
          setFindingDriversVisible(true);
          setSearchingForDriver(true);
          setDriverFound(false);
          setShowActiveTrip(false);
          startFindingDriversAnimations();
          startRidePolling(String(response.data.id));
          return;
        }

        if (['accepted', 'enroute', 'arrived', 'started'].includes(status)) {
          setFindingDriversVisible(true);
          setSearchingForDriver(false);
          setDriverFound(true);

          if (response.data.driver) {
            setDriverName(response.data.driver.fullName);
            setDriverRating(response.data.driver.rating || 0);
            setDriverCar(`${response.data.driver.vehicleMake} ${response.data.driver.vehicleModel}`);
            setDriverPlate(response.data.driver.licencePlate);
            setDriverPhone(response.data.driver.phone || '');

            Animated.timing(driverFadeAnim, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }).start();
          }

          setShowActiveTrip(true);
          setTripStatus(
            status === 'accepted'
              ? 'enroute'
              : (status as 'enroute' | 'arrived' | 'started' | 'completed')
          );

          startRidePolling(response.data.id);
        }
      }
    } catch (error) {
      console.log('No active ride found');
    }
  };

  // Poll for ride updates
  const startRidePolling = (rideId: string) => {
    if (pollingInterval) clearInterval(pollingInterval);

    const interval = setInterval(async () => {
      try {
        const response = await apiClient.get(`/rides/${rideId}/status`);
        const ride = response.data;
        console.log('[RiderNav] Poll ride:', ride?.status, {
          pickupLat: ride?.pickupLat ?? ride?.pickup_lat,
          pickupLng: ride?.pickupLng ?? ride?.pickup_lng,
          destinationLat:
            ride?.destinationLat ?? ride?.destLat ?? ride?.destination_lat ?? ride?.dest_lat,
          destinationLng:
            ride?.destinationLng ?? ride?.destLng ?? ride?.destination_lng ?? ride?.dest_lng,
        });
        setCurrentRide(ride);
        if (Number.isFinite(ride.currentLat) && Number.isFinite(ride.currentLng)) {
          setDriverCarPosition({ latitude: Number(ride.currentLat), longitude: Number(ride.currentLng) });
        }

        const status = String(ride.status || '').toLowerCase();
        if (
          status === 'accepted' ||
          status === 'enroute' ||
          status === 'arrived' ||
          status === 'started'
        ) {
          // Driver accepted the ride - show driver info
          setSearchingForDriver(false);
          setDriverFound(true);

          if (ride.driver) {
            setDriverName(ride.driver.fullName);
            setDriverRating(ride.driver.rating || 0);
            setDriverCar(`${ride.driver.vehicleMake} ${ride.driver.vehicleModel}`);
            setDriverPlate(ride.driver.licencePlate);
            setDriverPhone(ride.driver.phone || '');

            Animated.timing(driverFadeAnim, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }).start();
          }

          setTripStatus(
            status === 'accepted'
              ? 'enroute'
              : (status as 'enroute' | 'arrived' | 'started' | 'completed')
          );
          setShowActiveTrip(true);

          if (ride.duration) {
            setTimeRemaining(Math.min(100, ride.duration));
          }
        } else if (status === 'completed') {
          // ===== TRIP COMPLETED: clear the driver navigation =====
          clearDriverNavigation();
          setCurrentRideId(String(ride.id || rideId));
          setCurrentRide(ride);
          setTripStatus('completed');
          setShowActiveTrip(true);
          setFindingDriversVisible(true);
          clearInterval(interval);
          setPollingInterval(null);
          showToast('Trip completed!', 'green');
        } else if (status === 'cancelled') {
          clearInterval(interval);
          setPollingInterval(null);
          clearDriverNavigation();
          closeFindingDrivers();
          showToast('Trip was cancelled', 'red');
        }
      } catch (error) {
        console.error('Error polling ride:', error);
      }
    }, 3000);

    setPollingInterval(interval);
  };

  // ===== DRIVER ROUTE LOADING (mirrors driver screen) =====
  // Recalculate route whenever status or pickup/dest changes.
  // Skip entirely when the trip is already completed.
  useEffect(() => {
    if (!currentRide || !showActiveTrip) return;
    if (tripCompleted) return;
    if (!driverStartPoint || !driverEndPoint) return;

    const requestId = ++driverRouteRequestRef.current;
    const waitingAtPickup = driverIsArrivalPhase;

    // Reset progress + car position based on phase
    setDriverProgress(waitingAtPickup ? 1 : 0.08);
    setDriverCarPosition(waitingAtPickup ? driverEndPoint : driverStartPoint);
    // Always seed at least a 2-point straight line so the polyline renders immediately
    setDriverRoutePoints([driverStartPoint, driverEndPoint]);

    console.log('[RiderNav] Loading route', {
      phase: driverPhase,
      headingToPickup: driverHeadingToPickup,
      start: driverStartPoint,
      end: driverEndPoint,
    });

    const loadRoute = async () => {
      try {
        const route = await getRoute(driverStartPoint, driverEndPoint);
        const points = routeToMapCoords(route.coordinates);
        if (requestId !== driverRouteRequestRef.current) return;
        console.log('[RiderNav] Route loaded with', points.length, 'points');
        setDriverRoutePoints(points.length > 1 ? points : [driverStartPoint, driverEndPoint]);
      } catch (err) {
        console.warn('[RiderNav] Route fetch failed, using straight line', err);
        if (requestId !== driverRouteRequestRef.current) return;
        setDriverRoutePoints([driverStartPoint, driverEndPoint]);
      }
    };

    loadRoute();
  }, [
    currentRide?.id,
    currentRide?.status,
    showActiveTrip,
    tripCompleted,
    driverPhase,
    driverHeadingToPickup,
    driverIsArrivalPhase,
    driverStartPoint,
    driverEndPoint,
  ]);

  // ===== DRIVER ANIMATION LOOP (mirrors driver screen) =====
  useEffect(() => {
    const canMove = driverHeadingToPickup || driverIsDestinationPhase;

    // Do not animate if the trip is completed
    if (tripCompleted) {
      if (driverAnimationRef.current) {
        clearInterval(driverAnimationRef.current);
        driverAnimationRef.current = null;
      }
      return;
    }

    // Always place the car somewhere visible when the route updates
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

    driverAnimationRef.current = setInterval(() => {
      setDriverProgress((current) => {
        const next = Math.min(1, current + 0.0125);
        setDriverCarPosition(interpolateRoute(driverRoutePoints, next));
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
  }, [driverRoutePoints, driverHeadingToPickup, driverIsDestinationPhase, tripCompleted]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
      if (driverAnimationRef.current) {
        clearInterval(driverAnimationRef.current);
        driverAnimationRef.current = null;
      }
      stopFindingDriversAnimations();
    };
  }, []);

  const stopFindingDriversAnimations = () => {
    pulseLoopRef.current?.stop();
    rotateLoopRef.current?.stop();
  };

  const loadNearbyPlaces = async (coords: Coords) => {
    setNearbyLoading(true);
    const places = await fetchNearbyPlaces(coords);
    setNearbyPlaces(places);
    setNearbyLoading(false);
  };

  const detectLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPickupLabel('SPU Kimberley Campus');
        showToast('Location permission denied', 'red');
        loadNearbyPlaces(userLocation);
        setLocating(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setUserLocation(coords);
      loadNearbyPlaces(coords);
      if (destination) {
        updateRoute(coords, destination);
      }

      setPickupLabel('Current Location');
    } catch (err) {
      setPickupLabel('SPU Kimberley Campus');
      showToast('Could not detect your location', 'red');
      loadNearbyPlaces(userLocation);
    } finally {
      setLocating(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearch(text);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

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

    if (pickupSearchDebounceRef.current) {
      clearTimeout(pickupSearchDebounceRef.current);
    }

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

  const selectPickupLocation = (location: CampusLocation) => {
    setUserLocation(location.coords);
    setPickupLabel(location.address ? `${location.name}, ${location.address}` : location.name);
    setPickupSheetVisible(false);
    setPickupSearch('');
    setPickupSearchResults([]);
    loadNearbyPlaces(location.coords);
    if (destination) {
      updateRoute(location.coords, destination);
    }
    showToast(`Pickup set to ${location.name}`, 'green');
  };

  const handleLocationSelect = async (location: CampusLocation) => {
    setDestination(location);
    setDestSheetVisible(false);
    setSearch('');
    setShowSearchResults(false);
    setSearchResults([]);

    await updateRoute(userLocation, location);
    showToast(`Route to ${location.name}`, 'green');
  };

  const mapPlaces = useMemo(() => {
    return [...CAMPUS_LOCATIONS, ...nearbyPlaces];
  }, [nearbyPlaces]);

  const filteredLocations = useMemo(() => {
    if (showSearchResults) {
      const query = search.trim().toLowerCase();
      const campusMatches = CAMPUS_LOCATIONS.filter((loc) =>
        loc.name.toLowerCase().includes(query)
      );
      return [...campusMatches, ...searchResults];
    }

    const combined = [...CAMPUS_LOCATIONS, ...nearbyPlaces]
      .map((loc) => ({
        ...loc,
        distance: distanceKm(userLocation, loc.coords),
      }))
      .sort((a, b) => a.distance - b.distance);

    return combined.slice(0, 15);
  }, [search, userLocation, searchResults, showSearchResults, nearbyPlaces]);

  const tripDistanceKm =
    routeDistance || (destination ? distanceKm(userLocation, destination.coords) : 0);
  const fare = tripDistanceKm > 0 ? estimateFare(tripDistanceKm) : 0;
  const etaMinutes = routeDuration || (destination ? (tripDistanceKm / 25) * 60 : 0);

  const handleRequestRide = async () => {
    if (!destination) {
      showToast('Please select a destination first', 'red');
      return;
    }

    if (!userId) {
      showToast('Please login again', 'red');
      return;
    }

    setRequesting(true);

    try {
      const token = await AsyncStorage.getItem('authToken');

      if (!token) {
        showToast('Please login again', 'red');
        setRequesting(false);
        return;
      }

      const rideData = {
        riderId: userId,
        pickupLocation: pickupLabel,
        pickupLat: userLocation.latitude,
        pickupLng: userLocation.longitude,
        pickupAddress: pickupLabel,
        destination: destination.name,
        destinationLat: destination.coords.latitude,
        destinationLng: destination.coords.longitude,
        destLat: destination.coords.latitude,
        destLng: destination.coords.longitude,
        destinationAddress: destination.name,
        fare: fare,
        distance: tripDistanceKm,
        distanceKm: tripDistanceKm,
        duration: etaMinutes,
      };

      const response = await apiClient.post('/rides/request', rideData);
      const newRide = response.data;
      setCurrentRideId(newRide.id);
      setCurrentRide(newRide);
      setPaymentRide(newRide);
      setPaymentMethod('CASH');
      setPaymentVisible(true);
    } catch (error: any) {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        showToast('Session expired. Please login again.', 'red');
        await AsyncStorage.multiRemove(['authToken', 'user']);
        setTimeout(() => {
          navigation.replace('Login');
        }, 1000);
      } else if (error?.response?.status === 400) {
        const message =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          'Invalid ride request. Please check your details.';
        showToast(message, 'red');
      } else if (error?.response?.status === 404) {
        showToast('Ride service not available. Please try again later.', 'red');
      } else if (error?.message === 'Network Error') {
        showToast('Network error. Please check your internet connection.', 'red');
      } else if (error?.response?.data?.message) {
        showToast(error.response.data.message, 'red');
      } else {
        showToast('Could not request ride. Please try again.', 'red');
      }
    } finally {
      setRequesting(false);
    }
  };

  const confirmPayment = async () => {
    if (!paymentRide?.id) return;
    try {
      await apiClient.post(`/rides/${paymentRide.id}/payment`, {
        method: paymentMethod,
        ...(paymentMethod === 'CARD' ? { cardLastFour: selectedCard } : {}),
      });
      setPaymentVisible(false);
      showToast('Payment method saved', 'green');
      startFindingDriversFlow(String(paymentRide.id));
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'Could not save payment method', 'red');
    }
  };

  const startFindingDriversFlow = (rideId: string) => {
    setFindingDriversVisible(true);
    setSearchingForDriver(true);
    setDriverFound(false);
    setShowActiveTrip(false);
    setElapsedSeconds(0);
    // Ensure any prior driver nav is gone before starting a fresh flow
    clearDriverNavigation();

    startFindingDriversAnimations();

    const timerInterval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    startRidePolling(rideId);

    return () => clearInterval(timerInterval);
  };

  const startFindingDriversAnimations = () => {
    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoopRef.current.start();

    rotateLoopRef.current = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rotateLoopRef.current.start();

    Animated.timing(driverFadeAnim, {
      toValue: 0,
      duration: 0,
      useNativeDriver: true,
    }).start();
  };

  const handleCancelSearch = async () => {
    if (cancelling) return;
    setCancelling(true);

    try {
      if (currentRideId) {
        await apiClient.post(`/rides/${currentRideId}/cancel`);
      }
      showToast('Ride search cancelled', 'blue');

      setTimeout(() => {
        closeFindingDrivers();
      }, 500);
    } catch (error) {
      showToast('Could not cancel ride', 'red');
      setCancelling(false);
    }
  };

  const closeFindingDrivers = () => {
    setFindingDriversVisible(false);
    setShowActiveTrip(false);
    setCancelling(false);
    setCurrentRideId(null);
    setCurrentRide(null);
    clearDriverNavigation();
    stopFindingDriversAnimations();
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  };

  const handleCallDriver = () => {
    if (driverPhone) {
      const phoneUrl = `tel:${driverPhone.replace(/[^\d+]/g, '')}`;
      Linking.openURL(phoneUrl).catch(() => {
        showToast(`Could not call ${driverName || 'the driver'}`, 'red');
      });
    } else {
      showToast('Driver phone number not available', 'red');
    }
  };

  const handleMessageDriver = () => {
    const rideId = currentRideId || (currentRide?.id ? String(currentRide.id) : null);
    if (rideId) {
      setUnreadMessageCount(0);
      setChatVisible(true);
    } else {
      showToast('The active ride is not available', 'red');
    }
  };

  const openShareRideSheet = () => {
    setShareRideVisible(true);
    shareSheetAnim.setValue(0);
    Animated.timing(shareSheetAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const closeShareRideSheet = () => {
    Animated.timing(shareSheetAnim, {
      toValue: 0,
      duration: 170,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setShareRideVisible(false);
    });
  };

  const shareLink = currentRideId ? `campusconnect.app/t/${currentRideId}` : '';

  const handleCopyRideLink = async () => {
    try {
      if (Platform.OS === 'web' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareLink);
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
    const url =
      channel === 'whatsapp'
        ? `https://wa.me/?text=${encodeURIComponent(text)}`
        : `sms:?body=${encodeURIComponent(text)}`;
    try {
      await Linking.openURL(url);
    } catch {
      showToast(`Could not open ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}`, 'red');
    }
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
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
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

  const confirmSOS = async () => {
    if (sosSending) return;
    setSosSending(true);
    try {
      const rideId = currentRideId || (currentRide?.id ? String(currentRide.id) : null);
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
        sosAlertIdRef.current = response.data.alertId;
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

  const finishSosRecording = async (continueRecording = false) => {
    if (sosUploadingRef.current) return;
    sosUploadingRef.current = true;
    const recording = sosRecordingRef.current;
    const alertId = sosAlertIdRef.current;
    const rideId = currentRideId || (currentRide?.id ? String(currentRide.id) : null);
    const webRecorder = sosWebRecorderRef.current;
    if (!alertId || !rideId || (Platform.OS !== 'web' && !recording) || (Platform.OS === 'web' && !webRecorder)) return;
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
        const uploadResponse = await fetch(`${uploadBaseUrl}/rides/${rideId}/sos/${alertId}/audio`, {
          method: 'PUT',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        });
        if (!uploadResponse.ok) {
          const responseBody = await uploadResponse.text();
          throw new Error(`Audio upload failed (${uploadResponse.status}): ${responseBody || 'server rejected the recording'}`);
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
    const rideId = currentRideId || (currentRide?.id ? String(currentRide.id) : null);
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
      console.error('SOS audio segment upload failed:', error);
    } finally {
      sosUploadingRef.current = false;
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

  const handleCancelTrip = async () => {
    try {
      if (currentRideId) {
        await apiClient.post(`/rides/${currentRideId}/cancel`);
      }
      showToast('Trip cancelled', 'red');
      // Clear navigation immediately so nothing lingers on the map
      clearDriverNavigation();
      closeFindingDrivers();
    } catch (error) {
      showToast('Could not cancel trip', 'red');
    }
  };

  // ===== COMPLETE TRIP: clear nav then go to rating =====
  const handleCompleteTrip = async () => {
    try {
      const completedRideId = currentRideId || (currentRide?.id ? String(currentRide.id) : null);
      if (!completedRideId) {
        showToast(
          'The completed ride could not be found. Please refresh your dashboard.',
          'red'
        );
        return;
      }

      // Clear the map's navigation immediately so no route or car marker is left
      clearDriverNavigation();

      closeFindingDrivers();

      setTimeout(() => {
        navigation.navigate('RatingDriver', {
          rideId: completedRideId,
          driverName: driverName || undefined,
        });
      }, 300);
    } catch (error) {
      console.error('Error navigating to rating:', error);
      showToast('Could not navigate to rating screen', 'red');
    }
  };

  const handleRateDriver = async () => {
    if (!currentRideId) {
      showToast('The completed ride could not be found. Please refresh your dashboard.', 'red');
      return;
    }
    if (selectedRating < 1 || submittingRating) return;

    setSubmittingRating(true);
    try {
      await apiClient.post(`/rides/${currentRideId}/rating`, { rating: selectedRating });
      setShowRatingModal(false);
      setShowRatingThankYou(true);
      setTimeout(() => {
        setShowRatingThankYou(false);
        setSelectedRating(0);
        clearDriverNavigation();
        closeFindingDrivers();
      }, 2200);
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'Could not submit rating', 'red');
    } finally {
      setSubmittingRating(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getStatusText = () => {
    switch (tripStatus) {
      case 'enroute':
        return 'Driver is en route to you';
      case 'arrived':
        return 'Driver has arrived';
      case 'started':
        return 'Trip in progress';
      case 'completed':
        return 'Trip completed';
      default:
        return 'Trip in progress';
    }
  };

  const getStatusColor = () => {
    switch (tripStatus) {
      case 'enroute':
        return colors.blue;
      case 'arrived':
        return colors.green;
      case 'started':
        return colors.orange;
      case 'completed':
        return colors.green;
      default:
        return colors.blue;
    }
  };

  // Compute ETA display from driver progress + trip duration
  const driverEtaDisplay = useMemo(() => {
    if (driverIsArrivalPhase) return 'Arrived';
    if (tripCompleted) return 'Completed';
    const baseDuration = currentRide?.duration || routeDuration || 5;
    const remaining = Math.max(1, Math.round(baseDuration * (1 - driverProgress)));
    return `~${remaining} min`;
  }, [driverProgress, driverIsArrivalPhase, tripCompleted, currentRide?.duration, routeDuration]);

  const renderMap = () => {
    if (Platform.OS === 'web') {
      return (
        <WebMap
          userLocation={userLocation}
          destination={destination}
          routePoints={routePoints}
          places={mapPlaces}
          onLocationSelect={handleLocationSelect}
          loading={routing}
        />
      );
    }

    return (
      <View style={styles.mapPlaceholder}>
        <ActivityIndicator size="large" color={colors.green} />
        <Text style={styles.mapPlaceholderText}>Loading map...</Text>
        <Text style={styles.mapPlaceholderSubtext}>Please use the app on iOS or Android</Text>
      </View>
    );
  };

  const renderFindingDriversOverlay = () => {
    if (!findingDriversVisible) return null;

    const isDriverAssigned =
      currentRide?.driver &&
      ['accepted', 'enroute', 'arrived', 'started'].includes(currentRide.status);

    return (
      <Modal
        visible={findingDriversVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {}}
      >
        <View style={styles.overlayContainer}>
          <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

          {riderMessageToast ? (
            <View style={[styles.riderMessageToast, { bottom: insets.bottom + spacing.xxl }]}>
              <Text style={styles.riderMessageToastText} numberOfLines={2}>{riderMessageToast}</Text>
              <TouchableOpacity
                onPress={() => setRiderMessageToast('')}
                style={styles.riderMessageToastClose}
                accessibilityLabel="Dismiss message notification"
              >
                <Text style={styles.riderMessageToastCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={[styles.overlayHeader, { paddingTop: insets.top + 14 }]}>
            <TouchableOpacity
              onPress={handleCancelSearch}
              style={styles.closeButton}
              disabled={cancelling || searchingForDriver || isDriverAssigned || showActiveTrip}
            >
              <X size={24} color={colors.gray700} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.overlayTitle}>
              {showActiveTrip ? 'Active Trip' : 'Finding Drivers'}
            </Text>
            <View style={styles.headerRight} />
          </View>

          {sosVisible && (
            <View style={[styles.sosLayer, sosDispatched && styles.sosActivatedLayer]}>
              {!sosDispatched && <Pressable style={styles.sosBackdrop} onPress={() => setSosVisible(false)} />}
              {sosDispatched ? (
                <View style={styles.sosActivatedPanel}>
                  <View style={styles.sosActivatedHeader}>
                    <TouchableOpacity
                      onPress={async () => { setSosVisible(false); setSosDispatched(false); await finishSosRecording(); }}
                      style={styles.sosBackButton}
                      accessibilityLabel="Back to active trip"
                    >
                      <ArrowLeft size={22} color={colors.white} strokeWidth={2.4} />
                    </TouchableOpacity>
                    <View style={styles.sosHeaderIcon}><AlertTriangle size={24} color={colors.white} strokeWidth={2.5} /></View>
                    <View><Text style={styles.sosActivatedTitle}>SOS Activated</Text><Text style={styles.sosActivatedSubtitle}>Campus Security has been alerted</Text></View>
                  </View>
                  <View style={styles.sosAlertNotice}><AlertTriangle size={14} color="#ef4444" /><Text style={styles.sosAlertNoticeText}>Campus Security and your emergency contact have been notified with your live GPS location.</Text></View>
                  <View style={styles.sosGpsCard}><Text style={styles.sosSectionLabel}>GPS LOCATION</Text><Text style={styles.sosGpsValue}>{sosLocation.latitude.toFixed(6)}, {sosLocation.longitude.toFixed(6)}</Text><View style={styles.sosGpsDot} /></View>
                  <View style={styles.sosEvidenceRow}><Text style={styles.sosSectionLabel}>EVIDENCE AUDIO</Text><View style={styles.sosRecBadge}><View style={styles.sosRecDot} /><Text style={styles.sosRecText}>REC</Text></View></View>
                  <Text style={styles.sosTimer}>{String(Math.floor(sosRecordingSeconds / 60)).padStart(2, '0')}:{String(sosRecordingSeconds % 60).padStart(2, '0')}</Text>
                  <View style={styles.sosWaveform}>{[10, 18, 28, 38, 24, 44, 30, 18, 10, 25, 15].map((height, index) => <Animated.View key={index} style={[styles.sosWaveBar, { height, transform: [{ scaleY: sosWaveAnimationsRef.current[index] }] }]} />)}</View>
                  <View style={styles.sosRecordingButton}><View style={styles.sosRecordingDot} /><Text style={styles.sosRecordingText}>Recording in progress...</Text></View>
                  <TouchableOpacity style={styles.sosSafeButton} onPress={async () => { setSosVisible(false); setSosDispatched(false); await finishSosRecording(); }}><Text style={styles.sosSafeText}>I'm Safe — Cancel SOS</Text></TouchableOpacity>
                  {showSosRecordingToast && <View style={styles.sosBottomNotice}><AlertTriangle size={15} color={colors.white} /><Text style={styles.sosBottomNoticeText}>Audio recording started</Text></View>}
                </View>
              ) : (
                <View style={styles.sosCard}>
                  <View style={styles.sosHandle} />
                  <View style={styles.sosWarningIcon}><AlertTriangle size={42} color="#ef4444" fill="#ef4444" strokeWidth={2.5} /></View>
                  <Text style={styles.sosTitle}>Activate SOS Alert?</Text>
                  <Text style={styles.sosSubtitle}>This will immediately alert Campus Security and your emergency contact with your live GPS location.</Text>
                  <TouchableOpacity style={styles.sosConfirmButton} onPress={confirmSOS} disabled={sosSending}>{sosSending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.sosConfirmText}>Yes, Send SOS Alert</Text>}</TouchableOpacity>
                  <TouchableOpacity style={styles.sosCancelButton} onPress={() => setSosVisible(false)} disabled={sosSending}><Text style={styles.sosCancelText}>×  Cancel</Text></TouchableOpacity>
                </View>
              )}
            </View>
          )}

          <ScrollView
            style={styles.overlayContent}
            contentContainerStyle={{
              paddingBottom: showActiveTrip ? insets.bottom + 10 : insets.bottom + 20,
            }}
            showsVerticalScrollIndicator={false}
          >
            {!showActiveTrip ? (
              <>
                <View style={styles.searchContainer}>
                  <View style={styles.searchCircle}>
                    {searchingForDriver ? (
                      <>
                        <Animated.View
                          style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]}
                        />
                        <Animated.View
                          style={[styles.loadingRing, { transform: [{ rotate: spin }] }]}
                        />
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

                  <Text style={styles.searchStatus}>
                    {searchingForDriver ? 'Searching nearby...' : 'Driver Found!'}
                  </Text>
                  <Text style={styles.searchSubStatus}>
                    {searchingForDriver
                      ? `Looking for available drivers near you (${formatTime(elapsedSeconds)})`
                      : 'A driver has been assigned to your ride'}
                  </Text>
                </View>

                {isDriverAssigned && currentRide?.driver && (
                  <Animated.View style={[styles.driverInfo, { opacity: driverFadeAnim }]}>
                    <View style={styles.driverAvatar}>
                      <Text style={styles.driverAvatarText}>
                        {currentRide.driver.fullName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </Text>
                    </View>
                    <View style={styles.driverDetails}>
                      <Text style={styles.driverName}>{currentRide.driver.fullName}</Text>
                      <View style={styles.driverRatingContainer}>
                        <Star size={14} color={colors.orange} strokeWidth={2} fill={colors.orange} />
                        <Text style={styles.driverRating}>
                          {currentRide.driver.rating || 0}
                        </Text>
                      </View>
                      <Text style={styles.driverCar}>
                        {currentRide.driver.vehicleMake} {currentRide.driver.vehicleModel}
                      </Text>
                      <Text style={styles.driverPlate}>
                        {currentRide.driver.licencePlate}
                      </Text>
                    </View>
                  </Animated.View>
                )}

                <View style={styles.tripDetails}>
                  <View style={styles.tripRow}>
                    <View style={styles.tripIconContainer}>
                      <MapPin size={16} color={colors.green} strokeWidth={2} />
                    </View>
                    <View style={styles.tripTextContainer}>
                      <Text style={styles.tripLabel}>Your location</Text>
                      <Text style={styles.tripValue} numberOfLines={1}>
                        {pickupLabel || 'Current Location'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.tripDivider} />

                  <View style={styles.tripRow}>
                    <View style={styles.tripIconContainer}>
                      <Navigation size={16} color={colors.blue} strokeWidth={2} />
                    </View>
                    <View style={styles.tripTextContainer}>
                      <Text style={styles.tripLabel}>Your destination</Text>
                      <Text style={styles.tripValue} numberOfLines={1}>
                        {destination?.name || 'Destination'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.rideInfo}>
                  <View style={styles.rideInfoItem}>
                    <Route size={16} color={colors.green} strokeWidth={1.8} />
                    <Text style={styles.rideInfoText}>{tripDistanceKm.toFixed(1)} km</Text>
                  </View>
                  <View style={styles.rideInfoDivider} />
                  <View style={styles.rideInfoItem}>
                    <ClockIcon size={16} color={colors.green} strokeWidth={1.8} />
                    <Text style={styles.rideInfoText}>~{Math.round(etaMinutes)} min</Text>
                  </View>
                  <View style={styles.rideInfoDivider} />
                  <View style={styles.rideInfoItem}>
                    <Text style={styles.rideInfoFare}>R {fare.toFixed(2)}</Text>
                  </View>
                </View>

                {searchingForDriver && (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleCancelSearch}
                    disabled={cancelling}
                  >
                    {cancelling ? (
                      <ActivityIndicator size="small" color={colors.red} />
                    ) : (
                      <Text style={styles.cancelButtonText}>Cancel Search</Text>
                    )}
                  </TouchableOpacity>
                )}
              </>
            ) : (
              // ===== ACTIVE TRIP VIEW (mirrors driver screen navigation) =====
              <>
                <View style={styles.activeMapContainer}>
                  {/* Once the trip is completed, we do not pass any driver route/marker,
                      so the map shows only the static pickup/destination markers. */}
                  {!tripCompleted ? (
                    <WebMap
                      userLocation={userLocation}
                      destination={destination}
                      routePoints={
                        driverRoutePoints.length > 1 ? driverRoutePoints : routePoints
                      }
                      places={[]}
                      onLocationSelect={() => undefined}
                      loading={false}
                      driverPosition={driverCarPosition}
                      driverMarker={true}
                    />
                  ) : (
                    <WebMap
                      userLocation={userLocation}
                      destination={destination}
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

                {currentRide?.driver && (
                  <View style={styles.activeDriverCard}>
                    <View style={styles.driverHeader}>
                      <View style={styles.referenceDriverAvatar}>
                        <Text style={styles.driverAvatarText}>
                          {currentRide.driver.fullName
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </Text>
                      </View>
                      <View style={styles.referenceDriverIdentity}>
                        <Text style={styles.driverName}>
                          {currentRide.driver.fullName}
                        </Text>
                        <Text style={styles.referenceDriverVehicle}>
                          {currentRide.driver.vehicleMake || 'Vehicle'}{' '}
                          {currentRide.driver.vehicleModel || ''}
                        </Text>
                        <View style={styles.referenceDriverRating}>
                          <Star
                            size={14}
                            color={colors.yellow}
                            strokeWidth={2}
                            fill={colors.yellow}
                          />
                          <Text style={styles.referenceDriverRatingText}>
                            {currentRide.driver.rating || 0} · Driver
                          </Text>
                        </View>
                      </View>
                      <View style={styles.referencePlateBadge}>
                        <Text style={styles.referencePlateText}>
                          {currentRide.driver.licencePlate || 'No plate'}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.referenceTripCard}>
                  <View style={styles.referenceTripRow}>
                    <View
                      style={[styles.referenceTripDot, { backgroundColor: colors.green }]}
                    />
                    <View style={styles.referenceTripText}>
                      <Text style={styles.referenceTripLabel}>
                        {driverHeadingToPickup ? 'DRIVER HEADING TO PICKUP' : 'PICKUP'}
                      </Text>
                      <Text style={styles.referenceTripValue}>
                        {pickupLabel || 'Your location'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.referenceTripConnector} />
                  <View style={styles.referenceTripRow}>
                    <View
                      style={[styles.referenceTripDot, { backgroundColor: colors.gray900 }]}
                    />
                    <View style={styles.referenceTripText}>
                      <Text style={styles.referenceTripLabel}>DESTINATION</Text>
                      <Text style={styles.referenceTripValue}>
                        {destination?.name || 'Destination'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.referenceFareRow}>
                    <Text style={styles.referenceFareLabel}>Fare</Text>
                    <Text style={styles.referenceFareValue}>R {fare.toFixed(2)}</Text>
                  </View>
                </View>

                <View style={styles.referenceActionRow}>
                  <TouchableOpacity style={styles.referenceSosButton} onPress={handleSOS}>
                    <AlertTriangle size={17} color={colors.white} strokeWidth={2} />
                    <Text style={styles.referenceActionText}>SOS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.referenceCallButton}
                    onPress={handleCallDriver}
                  >
                    <Phone size={17} color={colors.white} strokeWidth={2} />
                    <Text style={styles.referenceActionText}>Call</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.referenceContactRow}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleMessageDriver}
                    activeOpacity={0.7}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Message driver"
                  >
                    <MessageCircle size={20} color={colors.green} strokeWidth={2} />
                    <Text style={styles.actionButtonText}>Message</Text>
                    {unreadMessageCount > 0 && (
                      <View pointerEvents="none" style={styles.unreadMessageBadge}>
                        <Text style={styles.unreadMessageBadgeText}>{unreadMessageCount > 9 ? '9+' : unreadMessageCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={openShareRideSheet}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Share Ride Link"
                  >
                    <Link size={18} color={colors.gray800} strokeWidth={2} />
                    <Text style={styles.actionButtonText}>Share Ride Link</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>

          {showActiveTrip && (
            <View style={styles.buttonContainer}>
              {tripStatus === 'completed' && (
                <View style={styles.bottomActions}>
                  <TouchableOpacity
                    style={[styles.bottomAction, styles.completeAction]}
                    onPress={handleCompleteTrip}
                  >
                    <Star size={18} color={colors.white} fill={colors.white} />
                    <Text style={styles.completeActionText}>Rate our driver</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {shareRideVisible && (
            <View style={styles.shareModalLayer}>
              <Pressable style={styles.shareBackdrop} onPress={closeShareRideSheet}>
                <Animated.View
                  style={[
                    styles.shareSheet,
                    {
                      opacity: shareSheetAnim,
                      transform: [
                        {
                          translateY: shareSheetAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [80, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                  onStartShouldSetResponder={() => true}
                  onTouchEnd={(event) => event.stopPropagation()}
                >
                  <View style={styles.paymentHandle} />
                  <Text style={styles.shareTitle}>Share Ride Link</Text>
                  <Text style={styles.shareSubtitle}>
                    Let your contacts follow your trip in real time.
                  </Text>
                  <Text style={styles.shareLabel}>TRIP PREVIEW</Text>
                  <Text style={styles.shareRoute}>
                    {pickupLabel} → {destination?.name || 'Destination'}
                  </Text>
                  <Text style={styles.shareDriver}>
                    Driver {driverName || 'assigned'} • ETA{' '}
                    {Math.max(1, Math.round((100 - timeRemaining) / 10))} min
                  </Text>
                  <View style={styles.shareLinkRow}>
                    <Text style={styles.shareLink} numberOfLines={2}>
                      {shareLink}
                    </Text>
                    <TouchableOpacity
                      style={styles.copyButton}
                      onPress={handleCopyRideLink}
                      accessibilityLabel="Copy ride link"
                    >
                      <Copy size={16} color={colors.white} strokeWidth={2} />
                      <Text style={styles.copyButtonText}>Copy</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.shareChannelRow}>
                    <TouchableOpacity
                      style={styles.whatsappButton}
                      onPress={() => handleShareRide('whatsapp')}
                    >
                      <MessageCircle size={17} color={colors.white} strokeWidth={2} />
                      <Text style={styles.shareChannelText}>WhatsApp</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.smsButton}
                      onPress={() => handleShareRide('sms')}
                    >
                      <MessageSquare size={17} color={colors.white} strokeWidth={2} />
                      <Text style={styles.shareChannelText}>SMS</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={styles.backToTripButton}
                    onPress={closeShareRideSheet}
                  >
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
                  rideId={currentRideId || (currentRide?.id ? String(currentRide.id) : undefined)}
                  otherPartyName={driverName || currentRide?.driver?.fullName || 'Driver'}
                  onClose={() => setChatVisible(false)}
                />
              </View>
            </View>
          )}
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <Text style={styles.greetingSmall}>{getGreeting()},</Text>
          <Text style={styles.greetingName}>{firstName || 'there'}</Text>
        </View>

        <Animated.View style={{ opacity: fadeAnim }}>
          {/* MAP */}
          <View style={styles.mapCard}>
            {renderMap()}

            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>YOUR LOCATION</Text>
            </View>

            <TouchableOpacity style={styles.locateButton} onPress={detectLocation}>
              <LocateFixed size={20} color={colors.green} strokeWidth={2} />
            </TouchableOpacity>

            {destination && (
              <View style={styles.destinationBadge}>
                <Navigation size={12} color={colors.white} strokeWidth={2} />
                <Text style={styles.destinationBadgeText}>{destination.name}</Text>
              </View>
            )}
          </View>

          {/* RIDE INPUT CARD */}
          <View style={styles.rideCard}>
            <TouchableOpacity
              style={styles.rideRow}
              onPress={() => setPickupSheetVisible(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.rideDot, { backgroundColor: colors.green }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rideRowLabel}>PICKUP</Text>
                <Text style={styles.rideRowValue} numberOfLines={1}>
                  {locating ? 'Detecting location...' : pickupLabel}
                </Text>
              </View>
              <Search size={16} color={colors.gray400} strokeWidth={2} />
              <ChevronRight size={16} color={colors.gray300} strokeWidth={2} />
            </TouchableOpacity>

            <View style={styles.rideDivider} />

            <TouchableOpacity
              style={styles.rideRow}
              onPress={() => setDestSheetVisible(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.rideDot, { backgroundColor: colors.blue }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rideRowLabel}>DESTINATION</Text>
                <Text
                  style={[styles.rideRowValue, !destination && styles.rideRowPlaceholder]}
                  numberOfLines={1}
                >
                  {destination ? destination.name : 'Search for a place...'}
                </Text>
              </View>
              <Search size={16} color={colors.gray400} strokeWidth={2} />
              <ChevronRight size={16} color={colors.gray300} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* ROUTE & FARE DETAILS */}
          {destination && routeDistance && (
            <View style={styles.routeDetails}>
              <View style={styles.routeDetailItem}>
                <Route size={16} color={colors.blue} strokeWidth={2} />
                <Text style={styles.routeDetailText}>{routeDistance.toFixed(1)} km</Text>
              </View>
              <View style={styles.routeDetailItem}>
                <ClockIcon size={16} color={colors.gray600} strokeWidth={2} />
                <Text style={styles.routeDetailText}>~{Math.round(etaMinutes)} min</Text>
              </View>
              <View style={styles.routeDetailItem}>
                <Text
                  style={[
                    styles.routeDetailText,
                    { color: colors.green, fontWeight: 'bold' },
                  ]}
                >
                  R {fare.toFixed(2)}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.actionsWrap}>
            <Button
              label="Request Ride"
              onPress={handleRequestRide}
              disabled={!destination || requesting}
              loading={requesting}
              icon={<Car size={18} color={colors.white} strokeWidth={2} />}
            />
            <TouchableOpacity style={styles.scheduleRideButton} onPress={() => navigation.navigate('RiderSchedule')}>
              <CalendarDays size={18} color={colors.greenDark} strokeWidth={2} />
              <Text style={styles.scheduleRideText}>Schedule Ride</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>

      {/* BOTTOM NAV */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 8 }]}>
        <NavItem
          icon={<House size={20} color={colors.green} strokeWidth={2} />}
          label="Home"
          active
        />
        <NavItem
          icon={<Clock size={20} color={colors.gray400} strokeWidth={1.8} />}
          label="History"
          onPress={() => navigation.navigate('RiderHistory')}
        />
        <NavItem
          icon={<CalendarDays size={20} color={colors.gray400} strokeWidth={1.8} />}
          label="Schedule"
          onPress={() => navigation.navigate('RiderSchedule')}
        />
        <NavItem
          icon={<CircleUserRound size={20} color={colors.gray400} strokeWidth={1.8} />}
          label="Profile"
          onPress={() => navigation.navigate('RiderProfile')}
        />
      </View>

      {/* PICKUP SHEET */}
      <BottomSheetModal
        visible={pickupSheetVisible}
        onClose={() => {
          setPickupSheetVisible(false);
          setPickupSearch('');
          setPickupSearchResults([]);
        }}
        title="Choose pickup"
        subtitle="Use your current location or search for a place"
      >
        <TouchableOpacity
          style={styles.currentLocationOption}
          onPress={detectLocation}
          activeOpacity={0.7}
        >
          <View style={styles.currentLocationIcon}>
            <LocateFixed size={18} color={colors.green} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.destName}>Use current location</Text>
            <Text style={styles.destAddress}>
              {locating ? 'Detecting location...' : pickupLabel}
            </Text>
          </View>
          {locating ? (
            <ActivityIndicator size="small" color={colors.green} />
          ) : (
            <ChevronRight size={16} color={colors.gray300} strokeWidth={2} />
          )}
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
            autoFocus={true}
          />
          {pickupSearchLoading && <ActivityIndicator size="small" color={colors.gray400} />}
          {pickupSearch.length > 0 && !pickupSearchLoading && (
            <TouchableOpacity
              onPress={() => {
                setPickupSearch('');
                setPickupSearchResults([]);
              }}
            >
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
              <Text style={styles.destDistance}>
                {distanceKm(userLocation, loc.coords).toFixed(1)} km away
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {!pickupSearchLoading &&
          pickupSearch.trim().length > 1 &&
          pickupSearchResults.length === 0 && (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResults}>No pickup places found</Text>
              <Text style={styles.noResultsSub}>
                Try a landmark, street, residence, or campus building
              </Text>
            </View>
          )}
      </BottomSheetModal>

      {/* DESTINATION SHEET */}
      <BottomSheetModal
        visible={destSheetVisible}
        onClose={() => {
          setDestSheetVisible(false);
          setShowSearchResults(false);
        }}
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
            autoFocus={true}
          />
          {searchLoading && <ActivityIndicator size="small" color={colors.gray400} />}
          {search.length > 0 && !searchLoading && (
            <TouchableOpacity
              onPress={() => {
                setSearch('');
                setShowSearchResults(false);
                setSearchResults([]);
              }}
            >
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
            style={[
              styles.destOption,
              destination?.name === loc.name && styles.destOptionSelected,
            ]}
            onPress={() => handleLocationSelect(loc)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.destIconCircle,
                destination?.name === loc.name && styles.destIconCircleSelected,
              ]}
            >
              <MapPin
                size={16}
                color={destination?.name === loc.name ? colors.white : colors.green}
                strokeWidth={2}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.destName,
                  destination?.name === loc.name && styles.destNameSelected,
                ]}
              >
                {loc.name}
              </Text>
              <Text style={styles.destAddress}>{loc.address}</Text>
              <View style={styles.destMeta}>
                <Text style={styles.destCategory}>{loc.category}</Text>
                <Text style={styles.destDistance}>
                  {distanceKm(userLocation, loc.coords).toFixed(1)} km away
                </Text>
              </View>
            </View>
            {destination?.name === loc.name && (
              <Check size={16} color={colors.green} strokeWidth={3} />
            )}
          </TouchableOpacity>
        ))}

        {!searchLoading &&
          showSearchResults &&
          filteredLocations.length === 0 &&
          search.length > 1 && (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResults}>No places found for "{search}"</Text>
              <Text style={styles.noResultsSub}>
                Try a different spelling, or search for a landmark, mall, or street name
              </Text>
            </View>
          )}
      </BottomSheetModal>

      {/* Finding Drivers Overlay */}
      {renderFindingDriversOverlay()}

      <Modal
        visible={showRatingModal}
        transparent
        animationType="fade"
        onRequestClose={() => undefined}
      >
        <View style={styles.ratingBackdrop}>
          <View style={styles.ratingCard}>
            <Text style={styles.ratingTitle}>Rate our driver</Text>
            <Text style={styles.ratingSubtitle}>
              How was your ride with {driverName}?
            </Text>
            <View style={styles.ratingStars}>
              {[1, 2, 3, 4, 5].map((value) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setSelectedRating(value)}
                  accessibilityLabel={`${value} star rating`}
                  style={styles.ratingStarButton}
                >
                  <Star
                    size={32}
                    color={value <= selectedRating ? colors.orange : colors.gray300}
                    fill={value <= selectedRating ? colors.orange : 'transparent'}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[
                styles.submitRatingButton,
                selectedRating === 0 && styles.submitRatingDisabled,
              ]}
              onPress={handleRateDriver}
              disabled={selectedRating === 0 || submittingRating}
            >
              {submittingRating ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitRatingText}>Submit rating</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showRatingThankYou} transparent animationType="fade">
        <View style={styles.ratingBackdrop}>
          <View style={styles.thankYouCard}>
            <View style={styles.thankYouIcon}>
              <Check size={30} color={colors.white} />
            </View>
            <Text style={styles.ratingTitle}>Thank you for rating!</Text>
            <Text style={styles.ratingSubtitle}>
              Your feedback helps keep CampusConnect safe.
            </Text>
          </View>
        </View>
      </Modal>

      <Modal
        visible={paymentVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentVisible(false)}
      >
        <View style={styles.paymentBackdrop}>
          <View style={styles.paymentSheet}>
            <View style={styles.paymentHandle} />
            <Text style={styles.paymentTitle}>Choose payment</Text>
            <Text style={styles.paymentSubtitle}>
              Review your trip and select how you will pay.
            </Text>
            <View style={styles.paymentTripCard}>
              <View style={styles.paymentTripRow}>
                <MapPin size={16} color={colors.green} strokeWidth={2} />
                <Text style={styles.paymentTripText} numberOfLines={1}>
                  {pickupLabel}
                </Text>
              </View>
              <View style={styles.paymentTripDivider} />
              <View style={styles.paymentTripRow}>
                <Navigation size={16} color={colors.blue} strokeWidth={2} />
                <Text style={styles.paymentTripText} numberOfLines={1}>
                  {destination?.name}
                </Text>
              </View>
              <View style={styles.paymentSummaryRow}>
                <Text style={styles.paymentSummaryLabel}>
                  {tripDistanceKm.toFixed(1)} km  •  ~{Math.round(etaMinutes)} min
                </Text>
                <Text style={styles.paymentAmount}>R {fare.toFixed(2)}</Text>
              </View>
            </View>
            <Text style={styles.paymentSectionTitle}>Payment method</Text>
            <TouchableOpacity
              style={[
                styles.paymentOption,
                paymentMethod === 'CASH' && styles.paymentOptionSelected,
              ]}
              onPress={() => setPaymentMethod('CASH')}
            >
              {paymentMethod === 'CASH' ? (
                <CheckCircle2 size={21} color={colors.green} />
              ) : (
                <Circle size={21} color={colors.gray400} />
              )}
              <Banknote size={20} color={colors.gray700} />
              <View style={styles.paymentOptionText}>
                <Text style={styles.paymentOptionTitle}>Cash</Text>
                <Text style={styles.paymentOptionSubtitle}>
                  Pay the driver when the trip is complete
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.paymentOption,
                paymentMethod === 'CARD' && styles.paymentOptionSelected,
              ]}
              onPress={() => setPaymentMethod('CARD')}
            >
              {paymentMethod === 'CARD' ? (
                <CheckCircle2 size={21} color={colors.green} />
              ) : (
                <Circle size={21} color={colors.gray400} />
              )}
              <CreditCard size={20} color={colors.gray700} />
              <View style={styles.paymentOptionText}>
                <Text style={styles.paymentOptionTitle}>Card</Text>
                <Text style={styles.paymentOptionSubtitle}>Use a saved card</Text>
              </View>
            </TouchableOpacity>
            {paymentMethod === 'CARD' && (
              <View style={styles.savedCards}>
                <Text style={styles.savedCardsTitle}>Saved cards</Text>
                <TouchableOpacity
                  style={[
                    styles.savedCard,
                    selectedCard === '4242' && styles.savedCardSelected,
                  ]}
                  onPress={() => setSelectedCard('4242')}
                >
                  <CreditCard size={20} color={colors.blue} />
                  <View style={styles.paymentOptionText}>
                    <Text style={styles.paymentOptionTitle}>Visa ending in 4242</Text>
                    <Text style={styles.paymentOptionSubtitle}>Default card</Text>
                  </View>
                  <CheckCircle2 size={19} color={colors.green} />
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              style={styles.proceedPaymentButton}
              onPress={confirmPayment}
            >
              <Text style={styles.proceedPaymentText}>
                {paymentMethod === 'CASH'
                  ? 'Proceed with cash'
                  : `Pay R ${fare.toFixed(2)} with card`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function NavItem({
  icon,
  label,
  active,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress} activeOpacity={0.6}>
      {icon}
      <Text style={[styles.navItemLabel, active && styles.navItemLabelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  chatOverlay: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', zIndex: 100 },
  chatBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,23,42,0.34)' },
  chatSheet: { height: '88%', overflow: 'hidden', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.gray50 },
  riderMessageToast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 200,
    elevation: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.green,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  riderMessageToastText: { flex: 1, color: colors.white, fontFamily: font.semibold, fontSize: 13 },
  sosLayer: { ...StyleSheet.absoluteFill, zIndex: 300, justifyContent: 'flex-end', paddingHorizontal: 22 },
  sosActivatedLayer: { paddingHorizontal: 0, justifyContent: 'flex-start' },
  sosBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,23,42,0.46)' },
  sosCard: { width: '100%', padding: spacing.xl, paddingBottom: spacing.lg, borderRadius: 24, backgroundColor: colors.white, alignItems: 'center', shadowColor: colors.black, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 24 },
  sosHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.gray300, marginBottom: spacing.xl },
  sosWarningIcon: { width: 54, height: 50, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  sosTitle: { color: '#111827', fontFamily: font.bold, fontSize: 19, textAlign: 'center' },
  sosSubtitle: { color: '#7b8494', fontFamily: font.regular, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg, maxWidth: 300 },
  sosConfirmButton: { width: '100%', minHeight: 48, borderRadius: radius.full, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },
  sosConfirmText: { color: colors.white, fontFamily: font.bold, fontSize: 14 },
  sosCancelButton: { width: '100%', minHeight: 44, marginTop: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.gray200, alignItems: 'center', justifyContent: 'center' },
  sosCancelText: { color: '#1f2937', fontFamily: font.semibold, fontSize: 14 },
  sosActivatedPanel: { flex: 1, width: '100%', backgroundColor: colors.white, minHeight: 0 },
  sosActivatedHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg, backgroundColor: '#ef4444' },
  sosBackButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', marginRight: spacing.xs },
  sosHeaderIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f87171', alignItems: 'center', justifyContent: 'center' },
  sosActivatedTitle: { color: colors.white, fontFamily: font.bold, fontSize: 18 },
  sosActivatedSubtitle: { color: colors.white, fontFamily: font.regular, fontSize: 12, marginTop: 2 },
  sosAlertNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, margin: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: '#fee2e2' },
  sosAlertNoticeText: { flex: 1, color: '#ef4444', fontFamily: font.medium, fontSize: 12, lineHeight: 17 },
  sosGpsCard: { marginHorizontal: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: '#f8fafc', position: 'relative' },
  sosSectionLabel: { color: '#475569', fontFamily: font.bold, fontSize: 11, letterSpacing: 0.5 },
  sosGpsValue: { color: '#111827', fontFamily: font.bold, fontSize: 14, marginTop: 7 },
  sosGpsDot: { position: 'absolute', top: spacing.md, right: spacing.md, width: 7, height: 7, borderRadius: 4, backgroundColor: '#ef4444' },
  sosEvidenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: spacing.lg, marginTop: spacing.lg },
  sosRecBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#fee2e2' },
  sosRecDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },
  sosRecText: { color: '#ef4444', fontFamily: font.bold, fontSize: 10 },
  sosTimer: { color: '#111827', fontFamily: font.extrabold, fontSize: 42, letterSpacing: 1, textAlign: 'center', marginTop: spacing.lg },
  sosWaveform: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, height: 44, marginVertical: spacing.md },
  sosWaveBar: { width: 3, borderRadius: 2, backgroundColor: '#ef4444' },
  sosRecordingButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginHorizontal: spacing.lg, minHeight: 40, borderRadius: 22, backgroundColor: '#f87171' },
  sosRecordingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fecaca' },
  sosRecordingText: { color: colors.white, fontFamily: font.bold, fontSize: 13 },
  sosSafeButton: { marginHorizontal: spacing.lg, marginTop: spacing.md, minHeight: 42, borderRadius: 22, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  sosSafeText: { color: colors.white, fontFamily: font.bold, fontSize: 13 },
  sosBottomNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.lg, marginTop: 'auto', marginBottom: spacing.lg, paddingHorizontal: spacing.md, minHeight: 38, borderRadius: radius.md, backgroundColor: '#ef4444' },
  sosBottomNoticeText: { color: colors.white, fontFamily: font.bold, fontSize: 12 },
  riderMessageToastClose: { marginLeft: spacing.sm, padding: spacing.xs },
  riderMessageToastCloseText: { color: colors.white, fontSize: 16, fontWeight: '700' },

  header: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.white,
  },
  greetingSmall: {
    fontFamily: font.medium,
    fontSize: 13,
    color: colors.gray400,
    fontWeight: '500',
  },
  greetingName: {
    fontFamily: font.extrabold,
    fontSize: 24,
    color: colors.gray900,
    fontWeight: '800',
  },

  mapCard: {
    height: Math.min(SCREEN_HEIGHT * 0.35, 350),
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#e8eaed',
    ...shadow.md,
    position: 'relative',
  },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  mapPlaceholderText: {
    fontFamily: font.semibold,
    fontSize: 14,
    color: colors.gray500,
    fontWeight: '600',
  },
  mapPlaceholderSubtext: { fontFamily: font.regular, fontSize: 12, color: colors.gray400 },

  liveBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    ...shadow.sm,
    zIndex: 10,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green },
  liveBadgeText: {
    fontFamily: font.bold,
    fontSize: 10,
    fontWeight: '700',
    color: colors.green,
  },

  destinationBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(33, 150, 243, 0.9)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    ...shadow.sm,
    zIndex: 10,
  },
  destinationBadgeText: {
    fontFamily: font.semibold,
    fontSize: 10,
    fontWeight: '600',
    color: colors.white,
  },

  locateButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    padding: 10,
    ...shadow.md,
    zIndex: 10,
  },

  rideCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.md,
    ...shadow.md,
  },
  rideRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  rideDot: { width: 10, height: 10, borderRadius: 5 },
  rideRowLabel: {
    fontFamily: font.bold,
    fontSize: 10,
    fontWeight: '700',
    color: colors.gray400,
    letterSpacing: 0.5,
  },
  rideRowValue: {
    fontFamily: font.semibold,
    fontSize: 14.5,
    color: colors.gray800,
    fontWeight: '600',
    marginTop: 1,
  },
  rideRowPlaceholder: { color: colors.gray400, fontWeight: '500' },
  rideDivider: {
    height: 1,
    backgroundColor: colors.gray100,
    marginLeft: 22,
    marginVertical: 2,
  },

  routeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  routeDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.gray50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  routeDetailText: {
    fontFamily: font.medium,
    fontSize: 12,
    fontWeight: '500',
    color: colors.gray600,
  },

  actionsWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  scheduleRideButton: { minHeight: 44, marginTop: spacing.sm, borderRadius: radius.full, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  scheduleRideText: { color: colors.greenDark, fontFamily: font.bold, fontSize: 13 },

  bottomNav: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    paddingTop: 10,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 3 },
  navItemLabel: {
    fontFamily: font.medium,
    fontSize: 10.5,
    color: colors.gray400,
    fontWeight: '500',
  },
  navItemLabelActive: {
    color: colors.green,
    fontFamily: font.semibold,
    fontWeight: '600',
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.gray50,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.gray900,
    paddingVertical: 10,
  },

  currentLocationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  currentLocationIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  categoryFilter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  categoryFilterText: {
    fontFamily: font.semibold,
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray600,
  },

  destOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  destOptionSelected: {
    backgroundColor: 'rgba(33, 150, 243, 0.05)',
  },
  destIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destIconCircleSelected: {
    backgroundColor: colors.blue,
  },
  destName: {
    fontFamily: font.semibold,
    fontSize: 14.5,
    color: colors.gray900,
    fontWeight: '600',
  },
  destNameSelected: { color: colors.blue },
  destAddress: {
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.gray500,
    marginTop: 1,
  },
  destMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  destCategory: {
    fontFamily: font.medium,
    fontSize: 10,
    fontWeight: '500',
    color: colors.gray400,
    backgroundColor: colors.gray100,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  destDistance: { fontFamily: font.regular, fontSize: 11, color: colors.gray400 },
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  noResults: {
    fontFamily: font.medium,
    fontSize: 14,
    color: colors.gray600,
    textAlign: 'center',
  },
  noResultsSub: {
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.gray400,
    textAlign: 'center',
    marginTop: 4,
  },

  // Overlay styles
  overlayContainer: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#ffffff',
  },
  overlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  overlayTitle: {
    fontFamily: font.bold,
    fontSize: 20,
    fontWeight: '700',
    color: colors.gray900,
    letterSpacing: 0.2,
  },
  headerRight: {
    width: 40,
  },
  closeButton: {
    padding: 10,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
  },
  overlayContent: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },

  buttonContainer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  shareModalLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    elevation: 100,
  },

  // Finding Drivers styles
  searchContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingTop: spacing.xl,
  },
  searchCircle: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(76, 175, 80, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(76, 175, 80, 0.25)',
  },
  loadingRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2.5,
    borderColor: 'rgba(76, 175, 80, 0.2)',
    borderTopColor: colors.green,
    borderRightColor: colors.green,
  },
  carIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  foundContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  foundCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.green,
  },
  searchStatus: {
    fontFamily: font.bold,
    fontSize: 24,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  searchSubStatus: {
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Driver Info
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.06)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.25)',
  },
  driverAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
    shadowColor: colors.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  driverAvatarText: {
    fontFamily: font.bold,
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontFamily: font.bold,
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: 4,
  },
  driverRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    marginBottom: 3,
  },
  driverRating: {
    fontFamily: font.semibold,
    fontSize: 13,
    fontWeight: '600',
    color: colors.orange,
  },
  driverCar: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.gray700,
    marginTop: 2,
  },
  driverPlate: {
    fontFamily: font.semibold,
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray600,
    letterSpacing: 0.8,
    marginTop: 1,
  },

  // Trip Details
  tripDetails: {
    width: '100%',
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  tripIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripTextContainer: {
    flex: 1,
  },
  tripLabel: {
    fontFamily: font.medium,
    fontSize: 11,
    fontWeight: '500',
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tripValue: {
    fontFamily: font.semibold,
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray900,
    marginTop: 3,
    lineHeight: 21,
  },
  tripDivider: {
    height: 1,
    backgroundColor: colors.gray200,
    marginLeft: 54,
  },

  // Ride Info
  rideInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    marginBottom: spacing.xl,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.2)',
  },
  rideInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  rideInfoText: {
    fontFamily: font.medium,
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray700,
  },
  rideInfoFare: {
    fontFamily: font.bold,
    fontSize: 15,
    fontWeight: '700',
    color: colors.green,
  },
  rideInfoDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(76, 175, 80, 0.25)',
  },

  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: '#f44336',
    marginTop: spacing.lg,
    alignSelf: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.08)',
  },
  cancelButtonText: {
    fontFamily: font.semibold,
    fontSize: 15,
    fontWeight: '600',
    color: '#f44336',
  },

  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: radius.full,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    marginTop: spacing.md,
    alignSelf: 'center',
  },
  waitingText: {
    fontFamily: font.medium,
    fontSize: 14,
    fontWeight: '500',
    color: colors.green,
  },

  // Active Trip styles
  activeMapContainer: {
    height: Math.min(SCREEN_HEIGHT * 0.3, 250),
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.gray100,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  activeMapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  activeMapStatus: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    maxWidth: '82%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: radius.md,
    backgroundColor: colors.greenDark,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 7,
    elevation: 5,
  },
  mapOverlay: {
    alignItems: 'center',
    width: '100%',
  },
  routeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '80%',
    marginBottom: spacing.md,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.green,
    borderWidth: 2,
    borderColor: colors.gray100,
  },
  routeDotEnd: {
    backgroundColor: colors.blue,
  },
  routeLineBar: {
    flex: 1,
    height: 3,
    backgroundColor: colors.gray300,
    marginHorizontal: 4,
  },
  mapStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  mapStatusText: {
    flexShrink: 1,
    fontFamily: font.semibold,
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },
  mapETA: {
    fontFamily: font.medium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.88)',
  },

  activeDriverCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  referenceTripCard: {
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  referenceTripRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  referenceTripDot: { width: 10, height: 10, borderRadius: 5 },
  referenceTripText: { flex: 1 },
  referenceTripLabel: {
    fontFamily: font.bold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.gray400,
  },
  referenceTripValue: {
    marginTop: 3,
    fontFamily: font.bold,
    fontSize: 15,
    color: colors.gray800,
  },
  referenceTripConnector: {
    height: 20,
    borderLeftWidth: 2,
    borderLeftColor: colors.gray300,
    marginLeft: 4,
    marginVertical: 2,
  },
  referenceFareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
  },
  referenceFareLabel: {
    fontFamily: font.medium,
    fontSize: 13,
    color: colors.gray500,
  },
  referenceFareValue: {
    fontFamily: font.bold,
    fontSize: 18,
    color: colors.green,
  },
  referenceActionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  referenceSosButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    borderRadius: radius.full,
    backgroundColor: colors.red,
  },
  referenceCallButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    borderRadius: radius.full,
    backgroundColor: colors.green,
  },
  referenceActionText: {
    fontFamily: font.bold,
    fontSize: 13,
    color: colors.white,
  },
  referenceContactRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  referenceDriverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    backgroundColor: colors.blue,
    ...shadow.sm,
  },
  referenceDriverIdentity: { flex: 1, minWidth: 0 },
  referenceDriverVehicle: {
    marginTop: 2,
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.gray500,
  },
  referenceDriverRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  referenceDriverRatingText: {
    fontFamily: font.medium,
    fontSize: 11,
    color: colors.yellowText,
  },
  referencePlateBadge: {
    maxWidth: 106,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: colors.gray900,
  },
  referencePlateText: {
    fontFamily: font.bold,
    fontSize: 11,
    color: colors.white,
    letterSpacing: 0.4,
  },
  driverActions: {
    flexDirection: 'row',
    gap: 12,
  },
  shareRideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 46,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.full,
    backgroundColor: colors.white,
  },
  shareRideButtonText: {
    fontFamily: font.bold,
    fontSize: 13,
    color: colors.gray800,
  },
  actionButton: {
    position: 'relative',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  actionButtonText: {
    fontFamily: font.medium,
    fontSize: 12,
    fontWeight: '500',
    color: colors.gray700,
  },
  unreadMessageBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
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
  unreadMessageBadgeText: { color: colors.white, fontFamily: font.bold, fontSize: 10 },

  tripProgress: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTitle: {
    fontFamily: font.medium,
    fontSize: 12,
    fontWeight: '500',
    color: colors.gray600,
  },
  progressPercent: {
    fontFamily: font.bold,
    fontSize: 14,
    fontWeight: '700',
    color: colors.green,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gray200,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressStep: {
    alignItems: 'center',
    gap: 4,
  },
  progressStepActive: {
    opacity: 1,
  },
  progressStepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gray300,
  },
  progressStepDotActive: {
    backgroundColor: colors.green,
  },
  progressStepText: {
    fontFamily: font.regular,
    fontSize: 8,
    color: colors.gray400,
    textTransform: 'uppercase',
  },
  progressStepTextActive: {
    color: colors.gray900,
  },
  progressStepLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray200,
  },

  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.red,
    marginBottom: spacing.sm,
  },
  sosButtonText: {
    fontFamily: font.bold,
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },

  ratingBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(17,24,39,0.55)',
  },
  ratingCard: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    padding: spacing.xxl,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    ...shadow.lg,
  },
  thankYouCard: {
    width: '100%',
    maxWidth: 330,
    alignItems: 'center',
    padding: spacing.xxl,
    borderRadius: radius.xl,
    backgroundColor: colors.white,
    ...shadow.lg,
  },
  shareBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17,24,39,0.16)',
  },
  shareSheet: {
    width: '100%',
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    ...shadow.lg,
  },
  shareTitle: {
    fontFamily: font.bold,
    fontSize: 21,
    fontWeight: '700',
    color: colors.gray900,
    marginTop: spacing.lg,
  },
  shareSubtitle: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.gray500,
  },
  shareLabel: {
    fontFamily: font.bold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.gray400,
  },
  shareRoute: {
    marginTop: spacing.sm,
    fontFamily: font.bold,
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray900,
  },
  shareDriver: {
    marginTop: 4,
    fontFamily: font.regular,
    fontSize: 11,
    color: colors.gray500,
  },
  shareLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.gray50,
  },
  shareLink: {
    flex: 1,
    fontFamily: font.mono,
    fontSize: 11,
    color: colors.gray700,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.green,
  },
  copyButtonText: {
    fontFamily: font.bold,
    fontSize: 12,
    color: colors.white,
  },
  shareChannelRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  whatsappButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 48,
    borderRadius: radius.full,
    backgroundColor: colors.green,
  },
  smsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 48,
    borderRadius: radius.full,
    backgroundColor: colors.blue,
  },
  shareChannelText: {
    fontFamily: font.bold,
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  backToTripButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.full,
  },
  backToTripText: {
    fontFamily: font.bold,
    fontSize: 13,
    color: colors.gray800,
  },
  ratingTitle: {
    color: colors.gray900,
    fontFamily: font.bold,
    fontSize: 20,
    textAlign: 'center',
  },
  ratingSubtitle: {
    marginTop: spacing.sm,
    color: colors.gray500,
    fontFamily: font.regular,
    fontSize: 13,
    textAlign: 'center',
  },
  ratingStars: {
    flexDirection: 'row',
    marginVertical: spacing.xxl,
  },
  ratingStarButton: {
    paddingHorizontal: spacing.xs,
  },
  submitRatingButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.green,
  },
  submitRatingDisabled: {
    backgroundColor: colors.gray300,
  },
  submitRatingText: {
    color: colors.white,
    fontFamily: font.bold,
    fontSize: 15,
  },
  thankYouIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 58,
    height: 58,
    marginBottom: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.green,
  },

  paymentBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  paymentSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  paymentHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray300,
    marginBottom: spacing.md,
  },
  paymentTitle: { fontFamily: font.bold, fontSize: 21, color: colors.gray900 },
  paymentSubtitle: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.gray500,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  paymentTripCard: {
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  paymentTripRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  paymentTripText: {
    flex: 1,
    fontFamily: font.medium,
    fontSize: 13,
    color: colors.gray800,
  },
  paymentTripDivider: {
    height: 12,
    borderLeftWidth: 1,
    borderLeftColor: colors.gray300,
    marginLeft: 8,
    marginVertical: 2,
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  paymentSummaryLabel: {
    fontFamily: font.medium,
    fontSize: 12,
    color: colors.gray500,
  },
  paymentAmount: {
    fontFamily: font.bold,
    fontSize: 19,
    color: colors.gray900,
  },
  paymentSectionTitle: {
    fontFamily: font.bold,
    fontSize: 14,
    color: colors.gray800,
    marginBottom: spacing.sm,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  paymentOptionSelected: {
    borderColor: colors.green,
    backgroundColor: colors.greenLight,
  },
  paymentOptionText: { flex: 1 },
  paymentOptionTitle: {
    fontFamily: font.bold,
    fontSize: 14,
    color: colors.gray800,
  },
  paymentOptionSubtitle: {
    fontFamily: font.regular,
    fontSize: 11,
    color: colors.gray500,
    marginTop: 2,
  },
  savedCards: { marginTop: spacing.xs, marginBottom: spacing.sm },
  savedCardsTitle: {
    fontFamily: font.bold,
    fontSize: 12,
    color: colors.gray600,
    marginBottom: spacing.xs,
  },
  savedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  savedCardSelected: { borderColor: colors.blue, backgroundColor: '#eff6ff' },
  proceedPaymentButton: {
    backgroundColor: colors.green,
    borderRadius: radius.md,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  proceedPaymentText: {
    fontFamily: font.bold,
    fontSize: 14,
    color: colors.white,
  },

  bottomActions: {
    flexDirection: 'row',
    gap: 8,
  },
  bottomAction: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  cancelAction: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cancelActionText: {
    fontFamily: font.semibold,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  completeAction: {
    backgroundColor: colors.green,
  },
  completeActionText: {
    fontFamily: font.bold,
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
});