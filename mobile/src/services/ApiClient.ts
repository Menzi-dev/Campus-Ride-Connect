// Backend connection: create one shared HTTP client, choose a reachable API address, attach saved
// login tokens and handle connection/authentication failures.
// Where: getHostChoices(), axios.create() and both interceptors in services/ApiClient.ts.
// How: The client joins each screen endpoint to baseURL, attaches the saved authToken and tries
// another local host on connection failure. HTTP 401 removes the saved session.
import axios, { AxiosRequestHeaders } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// IMPORTANT: point this at wherever your Spring Boot backend is running.
//
// - Android emulator     -> 10.0.2.2 maps to your computer's localhost
// - iOS simulator / web  -> localhost works directly
// - Physical phone        -> use your computer's LAN IP, e.g. 10.3.0.116
//   (run `ipconfig` on Windows / `ifconfig` on Mac to find it; phone and
//   laptop must be on the same Wi-Fi network)
// ---------------------------------------------------------------------------
const LOCAL_IP: string = ''; // Set this only for a real physical device. Leave empty for emulators.
const PORT = 8080;

// Feature: Choose backend addresses suitable for the browser, emulator or configured physical
// phone.
// Where: ApiClient.getHostChoices() below.
// How: getHostChoices() checks LOCAL_IP and Platform.OS. Android emulator choices include 10.0.2.2;
// browser choices use window.location.hostname. axios.create() uses the resulting API address.
const getHostChoices = () => {
  if (LOCAL_IP) {
    return [LOCAL_IP];
  }

  if (Platform.OS === 'android') {
    return ['10.0.2.2', 'localhost', '127.0.0.1'];
  }

  if (Platform.OS === 'web') {
    const webHost = typeof window !== 'undefined' && window.location.hostname
      ? window.location.hostname
      : 'localhost';
    return Array.from(new Set([
      webHost,
      ...(webHost === 'localhost' ? ['127.0.0.1'] : ['localhost']),
    ]));
  }

  // iOS simulator uses localhost; a real iPhone should use LOCAL_IP.
  return ['localhost', '127.0.0.1'];
};

const hostChoices = getHostChoices();
// HTTPS previews proxy the API on the same origin to avoid mixed-content blocks.
const secureWeb = Platform.OS === 'web' && typeof window !== 'undefined'
  && window.location.protocol === 'https:';
const baseURL = secureWeb ? `${window.location.origin}/api` : `http://${hostChoices[0]}:${PORT}/api`;
console.log('[ApiClient] primary baseURL =', baseURL);
console.log('[ApiClient] host choices =', hostChoices.join(', '));

const apiClient = axios.create({
  baseURL,
  timeout: 10000,
});

const isNetworkError = (error: any) => {
  return !error.response && error.request;
};

// Feature: Retry another local host after a network failure. Clear the saved session when the
// server rejects authentication.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (config && !secureWeb && isNetworkError(error)) {
      config.__retryCount = config.__retryCount || 0;

      if (config.__retryCount < hostChoices.length - 1) {
        config.__retryCount += 1;
        const nextHost = hostChoices[config.__retryCount];
        config.baseURL = `http://${nextHost}:${PORT}/api`;
        console.log(`[ApiClient] retrying request with host: ${nextHost}`);
        return apiClient.request(config);
      }
    }

    if (error.response?.status === 401) {
      // Expired credentials must not be reused by subsequent requests or restored sessions.
      await AsyncStorage.multiRemove(['authToken', 'user']);
    }
    return Promise.reject(error);
  }
);

// Attach the JWT to every request automatically once the user is logged in
apiClient.interceptors.request.use(async (config) => {
  const isLoginRequest = config.url === '/auth/login' || config.url?.endsWith('/auth/login');
  const isPasswordResetRequest = config.url?.startsWith('/auth/password-reset/');
  const isUnauthenticatedAuthRequest = isLoginRequest || isPasswordResetRequest || config.url?.startsWith('/auth/email-verification/') || config.url === '/auth/register';
  const token = isUnauthenticatedAuthRequest ? null : await AsyncStorage.getItem('authToken');

  // Report session presence without printing the JWT itself.
  if (!token && !isUnauthenticatedAuthRequest) {
    console.warn('[ApiClient] ⚠️ WARNING: No authToken found in AsyncStorage for request to', config.url);
  } else if (token) {
    console.log('[ApiClient] ✓ Token found, adding to Authorization header for:', config.url);
  }

  // Don't set Content-Type for FormData; let axios/the FormData API handle it
  if (!(config.data instanceof FormData)) {
    if (!config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json';
    }
  }

  if (token) {
    config.headers = {
      ...(config.headers ?? {}),
      Authorization: `Bearer ${token}`,
    } as AxiosRequestHeaders;
  } else if (!isUnauthenticatedAuthRequest) {
    console.warn('[ApiClient] ⚠️ No token in AsyncStorage - request will be unauthenticated');
  }
  return config;
});

export default apiClient;
