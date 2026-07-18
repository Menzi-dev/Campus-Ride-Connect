import axios from 'axios';
import type { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// =============================================
// AUTO-DETECT API URL BASED ON PLATFORM
// =============================================

const getApiBaseUrl = (): string => {
    // Web browser should use localhost so the browser can reach the local backend.
    if (typeof window !== 'undefined' && typeof window.location !== 'undefined') {
        return 'http://localhost:8080/api';
    }

    // React Native - Android Emulator
    if (Platform.OS === 'android') {
        return 'http://10.0.2.2:8080/api';
    }

    // React Native - iOS Simulator
    if (Platform.OS === 'ios') {
        return 'http://localhost:8080/api';
    }

    // Fallback (physical device - you need to set your IP)
    // return 'http://192.168.1.100:8080/api';
    return 'http://localhost:8080/api';
};

// =============================================
// AXIOS CLIENT CONFIGURATION
// =============================================

const API_BASE_URL = getApiBaseUrl();

const apiClient: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 10000,
});

// Add token to every request (for authenticated endpoints)
apiClient.interceptors.request.use(
    async (config) => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        } catch (error) {
            console.error('Error adding token:', error);
            return config;
        }
    },
    (error) => Promise.reject(error)
);

// Handle response errors
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            // Token expired - redirect to login
            await AsyncStorage.removeItem('authToken');
            // Navigate to login (handled in App.tsx)
        }
        return Promise.reject(error);
    }
);

// Log the API URL being used (helpful for debugging)
console.log(`🌐 API Client using base URL: ${API_BASE_URL}`);

export default apiClient;