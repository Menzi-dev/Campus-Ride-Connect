// Current position: provide a shared location request for browser and native screens.
// Where: requestCurrentLocation() in services/CurrentLocation.ts; ride screens call it for
// pickup/location.
// How: Platform.OS chooses browser geolocation or Expo Location; rejected permissions return an
// error for the calling screen to explain.
import { Platform } from 'react-native';
import * as Location from 'expo-location';

/** Returns device coordinates or an actionable permission/service error for the screen. */
// Feature: Use browser or Expo location APIs to obtain a current position with the required
// permission.
// Where: CurrentLocation.requestCurrentLocation() below.
// How: requestCurrentLocation() selects browser geolocation on web or Expo Location on native
// devices. Callers receive the position or handle the rejected permission/request.
export async function requestCurrentLocation() {
  if (Platform.OS === 'web') {
    if (!window.isSecureContext) {
      throw new Error('Location needs a secure HTTPS link. You can still choose your pickup manually.');
    }
    if (!navigator.geolocation) {
      throw new Error('This browser does not support location. Choose your pickup manually.');
    }
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, error => {
        const message = error.code === 1
          ? 'Allow location in your browser site settings, then tap the location button again.'
          : error.code === 3
            ? 'Location took too long. Check that device location is on and try again.'
            : 'Could not find your location. Turn on device location and try again.';
        reject(new Error(message));
      }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    });
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  }

  if (!await Location.hasServicesEnabledAsync()) {
    throw new Error('Device location services are turned off. Enable Location in Settings, then try again.');
  }
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error(permission.canAskAgain
      ? 'Allow location access to detect your pickup. Tap the location button to try again.'
      : 'Enable location permission for CampusConnect in your device settings.');
  }
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { latitude: position.coords.latitude, longitude: position.coords.longitude };
}
