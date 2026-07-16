import axios from 'axios';
import type { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =============================================
// CHOOSE YOUR API URL BASED ON TESTING DEVICE
// =============================================

// OPTION 1: Android Emulator
const API_BASE_URL = 'http://10.0.2.2:8080/api';

// OPTION 2: Physical Device (replace with your IP)
// const API_BASE_URL = 'http://192.168.1.100:8080/api';

// OPTION 3: iOS Simulator
// const API_BASE_URL = 'http://localhost:8080/api';

// =============================================
// AXIOS CLIENT CONFIGURATION
// =============================================

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

export default apiClient;