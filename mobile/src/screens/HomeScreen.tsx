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
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import {
  MapPin,
  LocateFixed,
  ChevronRight,
  Search,
  X,
  Car,
  CalendarClock,
  House,
  Clock,
  CalendarDays,
  CircleUserRound,
  Route,
  DollarSign,
  Clock as ClockIcon,
  Check,
  Navigation,
} from 'lucide-react-native';
import Button from '../components/Button';
import BottomSheetModal from '../components/BottomSheetModal';
import { useToast } from '../components/Toast';
import { colors, radius, spacing, font, shadow } from '../theme/theme';
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
  Home: undefined;
  Login: undefined;
};

type Coords = { latitude: number; longitude: number };
type RoutePoint = [number, number];

type CampusLocation = {
  name: string;
  coords: Coords;
  address?: string;
  category?: string;
};

// SPU Kimberley Campus locations (internal building presets - not available on
// public map data, so these stay curated). Double-check these coordinates
// against the actual campus building GPS pins when you get a chance.
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

// Live text search for any real place (used while typing in the destination box).
// Backed by Photon (OpenStreetMap data), biased toward the user's current location.
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

// Real nearby points of interest around a location (used for the default
// "suggested near you" list before the user types anything).
// Backed by Overpass (OpenStreetMap data).
async function fetchNearbyPlaces(center: Coords, radiusMeters = 6000): Promise<CampusLocation[]> {
  const query = `[out:json][timeout:25];(node["amenity"](around:${radiusMeters},${center.latitude},${center.longitude});node["shop"](around:${radiusMeters},${center.latitude},${center.longitude});node["tourism"](around:${radiusMeters},${center.latitude},${center.longitude});node["aeroway"="aerodrome"](around:${radiusMeters},${center.latitude},${center.longitude}););out body 80;`;

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query,
    });
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
  } catch (error) {
    console.error('Nearby places error:', error);
    return [];
  }
}

// Real road-following route (fastest driving route) via OSRM's public routing
// engine. No API key needed. "overview=full" returns every bend in the road
// as a coordinate, so the line on the map curves exactly where the road curves.
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

const BASE_FARE = 5;
const RATE_PER_KM = 4;

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

// Web Map Component
const WebMap = ({
  userLocation,
  destination,
  routePoints,
  places,
  onLocationSelect,
  loading,
}: {
  userLocation: Coords;
  destination: CampusLocation | null;
  routePoints: Coords[];
  places: CampusLocation[];
  onLocationSelect: (location: CampusLocation) => void;
  loading?: boolean;
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

  const MapUpdater = () => {
    const map = useMap();
    useEffect(() => {
      if (!map) return;
      try {
        setTimeout(() => {
          map.invalidateSize();
          if (destination) {
            const L = require('leaflet');
            const bounds = L.latLngBounds(
              [userLocation.latitude, userLocation.longitude],
              [destination.coords.latitude, destination.coords.longitude]
            );
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
          } else {
            map.setView([userLocation.latitude, userLocation.longitude], 15);
          }
        }, 300);
      } catch (e) {
        console.warn('Map update error:', e);
      }
    }, [map, destination, userLocation]);
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

          {/* User marker */}
          <Marker
            position={[userLocation.latitude, userLocation.longitude]}
            icon={createMarkerIcon('#4CAF50', 20, '📍')}
          >
            <Popup>Your Location</Popup>
          </Marker>

          {/* Destination marker */}
          {destination && (
            <Marker
              position={[destination.coords.latitude, destination.coords.longitude]}
              icon={createMarkerIcon('#2196F3', 28, '🏁')}
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

          {/* Route (follows real public roads via OSRM, bends where the road bends) */}
          {routePoints.length > 1 && (
            <Polyline
              positions={routePoints.map(p => [p.latitude, p.longitude])}
              color="#2196F3"
              weight={5}
              opacity={0.85}
              lineCap="round"
              lineJoin="round"
              smoothFactor={1}
            />
          )}

          {/* Real nearby places + campus presets */}
          {places.map((loc) => {
            const isDestination = destination?.name === loc.name;
            return (
              <Marker
                key={`${loc.name}-${loc.coords.latitude}-${loc.coords.longitude}`}
                position={[loc.coords.latitude, loc.coords.longitude]}
                icon={isDestination ? createMarkerIcon('#2196F3', 28, '🏁') : createMarkerIcon('#9E9E9E', 14, '•')}
                eventHandlers={{
                  click: () => onLocationSelect(loc),
                }}
              >
                <Popup>
                  <strong>{loc.name}</strong>
                  <br />
                  <span style={{ fontSize: 12 }}>{loc.address}</span>
                  <br />
                  <span style={{ fontSize: 11, color: '#666' }}>{loc.category}</span>
                </Popup>
              </Marker>
            );
          })}

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

export default function HomeScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [firstName, setFirstName] = useState('');
  const [userLocation, setUserLocation] = useState<Coords>(FALLBACK_REGION);
  const [pickupLabel, setPickupLabel] = useState('Detecting location...');
  const [locating, setLocating] = useState(true);
  const [destination, setDestination] = useState<CampusLocation | null>(null);
  const [destSheetVisible, setDestSheetVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [routePoints, setRoutePoints] = useState<Coords[]>([]);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [routing, setRouting] = useState(false);

  // Real search + real nearby places state
  const [searchResults, setSearchResults] = useState<CampusLocation[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<CampusLocation[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('user');
        if (raw) {
          const user = JSON.parse(raw);
          if (user?.fullName) setFirstName(user.fullName.split(' ')[0]);
        }
      } catch (e) {}
    })();
    detectLocation();
  }, []);

  // Clean up any pending debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

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
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setUserLocation(coords);
      loadNearbyPlaces(coords);

      try {
        const [place] = await Location.reverseGeocodeAsync(coords);
        const label = place?.street || place?.name || place?.district || 'Current Location';
        setPickupLabel(label);
      } catch {
        setPickupLabel('Current Location');
      }
    } catch (err) {
      setPickupLabel('SPU Kimberley Campus');
      showToast('Could not detect your location', 'red');
      loadNearbyPlaces(userLocation);
    } finally {
      setLocating(false);
    }
  };

  // Live search-as-you-type against real place data (debounced, like Bolt/Uber)
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

  const handleLocationSelect = async (location: CampusLocation) => {
    setDestination(location);
    setDestSheetVisible(false);
    setSearch('');
    setShowSearchResults(false);
    setSearchResults([]);

    setRouting(true);
    try {
      const route = await getRoute(userLocation, location.coords);
      setRoutePoints(routeToMapCoords(route.coordinates));
      setRouteDistance(route.distance);
      setRouteDuration(route.duration);
      showToast(`Route to ${location.name} - ${route.distance.toFixed(1)} km`, 'green');
    } catch (error) {
      const dist = distanceKm(userLocation, location.coords);
      setRoutePoints([userLocation, location.coords]);
      setRouteDistance(dist);
      setRouteDuration((dist / 25) * 60);
    } finally {
      setRouting(false);
    }
  };

  // Places shown as pins on the map: campus presets + real nearby POIs
  const mapPlaces = useMemo(() => {
    return [...CAMPUS_LOCATIONS, ...nearbyPlaces];
  }, [nearbyPlaces]);

  // Places shown in the "Where to?" sheet
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

  const tripDistanceKm = routeDistance || (destination ? distanceKm(userLocation, destination.coords) : 0);
  const fare = tripDistanceKm > 0 ? estimateFare(tripDistanceKm) : 0;
  const etaMinutes = routeDuration || (destination ? (tripDistanceKm / 25) * 60 : 0);

  const handleRequestRide = async () => {
    if (!destination) return;
    setRequesting(true);
    try {
      await apiClient.post('/rides/request', {
        pickup: { label: pickupLabel, ...userLocation },
        destination: { label: destination.name, ...destination.coords },
        estimatedFare: fare,
        estimatedDistanceKm: Number(tripDistanceKm.toFixed(2)),
        estimatedDuration: Math.round(etaMinutes),
        route: routePoints,
      });
      showToast('Ride requested! Looking for a driver', 'green');
    } catch (error: any) {
      showToast('Could not request ride. Please try again.', 'red');
    } finally {
      setRequesting(false);
    }
  };

  const handleComingSoon = (feature: string) => {
    showToast(`${feature} is coming soon`, 'blue');
  };

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
        <Text style={styles.mapPlaceholderText}>Map available on mobile</Text>
        <Text style={styles.mapPlaceholderSubtext}>Please use the app on iOS or Android</Text>
      </View>
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

            <TouchableOpacity
              style={styles.locateButton}
              onPress={detectLocation}
            >
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
            <View style={styles.rideRow}>
              <View style={[styles.rideDot, { backgroundColor: colors.green }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rideRowLabel}>PICKUP</Text>
                <Text style={styles.rideRowValue} numberOfLines={1}>
                  {locating ? 'Detecting location...' : pickupLabel}
                </Text>
              </View>
            </View>

            <View style={styles.rideDivider} />

            <TouchableOpacity style={styles.rideRow} onPress={() => setDestSheetVisible(true)} activeOpacity={0.7}>
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
                <Text style={styles.routeDetailText}>
                  {routeDistance.toFixed(1)} km
                </Text>
              </View>
              <View style={styles.routeDetailItem}>
                <ClockIcon size={16} color={colors.gray600} strokeWidth={2} />
                <Text style={styles.routeDetailText}>
                  ~{Math.round(etaMinutes)} min
                </Text>
              </View>
              <View style={styles.routeDetailItem}>
                
                <Text style={[styles.routeDetailText, { color: colors.green, fontWeight: 'bold' }]}>
                  R {fare.toFixed(2)}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.actionsWrap}>
            <Button
              label="Request Ride"
              onPress={handleRequestRide}
              disabled={!destination || routing}
              loading={requesting}
              icon={<Car size={18} color={colors.white} strokeWidth={2} />}
            />
          </View>
        </Animated.View>
      </ScrollView>

      {/* BOTTOM NAV */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 8 }]}>
        <NavItem icon={<House size={20} color={colors.green} strokeWidth={2} />} label="Home" active />
        <NavItem
          icon={<Clock size={20} color={colors.gray400} strokeWidth={1.8} />}
          label="History"
          onPress={() => handleComingSoon('Trip history')}
        />
        <NavItem
          icon={<CalendarDays size={20} color={colors.gray400} strokeWidth={1.8} />}
          label="Schedule"
          onPress={() => handleComingSoon('Scheduling')}
        />
        <NavItem
          icon={<CircleUserRound size={20} color={colors.gray400} strokeWidth={1.8} />}
          label="Profile"
          onPress={() => handleComingSoon('Profile')}
        />
      </View>

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
          {searchLoading && (
            <ActivityIndicator size="small" color={colors.gray400} />
          )}
          {search.length > 0 && !searchLoading && (
            <TouchableOpacity onPress={() => {
              setSearch('');
              setShowSearchResults(false);
              setSearchResults([]);
            }}>
              <X size={16} color={colors.gray400} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.categoryFilter}>
          <Text style={styles.categoryFilterText}>
            {showSearchResults
              ? (searchLoading ? 'Searching...' : `Search results (${filteredLocations.length})`)
              : (nearbyLoading ? 'Finding places near you...' : 'Suggested near you')}
          </Text>
        </View>

        {filteredLocations.map((loc) => (
          <TouchableOpacity
            key={`${loc.name}-${loc.coords.latitude}-${loc.coords.longitude}`}
            style={[
              styles.destOption,
              destination?.name === loc.name && styles.destOptionSelected
            ]}
            onPress={() => handleLocationSelect(loc)}
            activeOpacity={0.7}
          >
            <View style={[
              styles.destIconCircle,
              destination?.name === loc.name && styles.destIconCircleSelected
            ]}>
              <MapPin size={16} color={destination?.name === loc.name ? colors.white : colors.green} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.destName, destination?.name === loc.name && styles.destNameSelected]}>
                {loc.name}
              </Text>
              <Text style={styles.destAddress}>{loc.address}</Text>
              <View style={styles.destMeta}>
                <Text style={styles.destCategory}>{loc.category}</Text>
                <Text style={styles.destDistance}>{distanceKm(userLocation, loc.coords).toFixed(1)} km away</Text>
              </View>
            </View>
            {destination?.name === loc.name && (
              <Check size={16} color={colors.green} strokeWidth={3} />
            )}
          </TouchableOpacity>
        ))}

        {!searchLoading && showSearchResults && filteredLocations.length === 0 && search.length > 1 && (
          <View style={styles.noResultsContainer}>
            <Text style={styles.noResults}>No places found for "{search}"</Text>
            <Text style={styles.noResultsSub}>Try a different spelling, or search for a landmark, mall, or street name</Text>
          </View>
        )}
      </BottomSheetModal>
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
      <Text style={[styles.navItemLabel, active && styles.navItemLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },

  header: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.lg, backgroundColor: colors.white },
  greetingSmall: { fontFamily: font.medium, fontSize: 13, color: colors.gray400, fontWeight: '500' },
  greetingName: { fontFamily: font.extrabold, fontSize: 24, color: colors.gray900, fontWeight: '800' },

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
  mapPlaceholderText: { fontFamily: font.semibold, fontSize: 14, color: colors.gray500, fontWeight: '600' },
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
  liveBadgeText: { fontFamily: font.bold, fontSize: 10, fontWeight: '700', color: colors.green },

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
  rideRowValue: { fontFamily: font.semibold, fontSize: 14.5, color: colors.gray800, fontWeight: '600', marginTop: 1 },
  rideRowPlaceholder: { color: colors.gray400, fontWeight: '500' },
  rideDivider: { height: 1, backgroundColor: colors.gray100, marginLeft: 22, marginVertical: 2 },

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

  bottomNav: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    paddingTop: 10,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 3 },
  navItemLabel: { fontFamily: font.medium, fontSize: 10.5, color: colors.gray400, fontWeight: '500' },
  navItemLabelActive: { color: colors.green, fontFamily: font.semibold, fontWeight: '600' },

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
  searchInput: { flex: 1, fontFamily: font.regular, fontSize: 14, color: colors.gray900, paddingVertical: 10 },

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
  destName: { fontFamily: font.semibold, fontSize: 14.5, color: colors.gray900, fontWeight: '600' },
  destNameSelected: { color: colors.blue },
  destAddress: { fontFamily: font.regular, fontSize: 12, color: colors.gray500, marginTop: 1 },
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
});