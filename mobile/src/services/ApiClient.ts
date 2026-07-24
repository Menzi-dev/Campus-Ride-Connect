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
    return [webHost, 'localhost', '127.0.0.1', '10.0.2.2'];
  }

  // iOS simulator uses localhost; a real iPhone should use LOCAL_IP.
  return ['localhost', '127.0.0.1'];
};

const hostChoices = getHostChoices();
const baseURL = `http://${hostChoices[0]}:${PORT}/api`;
console.log('[ApiClient] primary baseURL =', baseURL);
console.log('[ApiClient] host choices =', hostChoices.join(', '));

const apiClient = axios.create({
  baseURL,
  timeout: 10000,
});

const isNetworkError = (error: any) => {
  return !error.response && error.request;
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (config && isNetworkError(error)) {
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
      await AsyncStorage.multiRemove(['authToken', 'user']);
    }
    return Promise.reject(error);
  }
);

// Attach the JWT to every request automatically once the user is logged in
apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('authToken');
  
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
  }
  return config;
});

export default apiClient;