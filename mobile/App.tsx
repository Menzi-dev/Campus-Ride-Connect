import 'react-native-gesture-handler';
import React from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from './src/components/Toast';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import Screens
import LandingScreen from './src/screens/LandingScreen';
import LoginScreen from './src/screens/LoginScreen';
import CreateAccountScreen from './src/screens/CreateAccountScreen';
import HomeScreen from './src/screens/HomeScreen';
import TestConnectionScreen from './src/screens/TestConnectionScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import DriverDashboardScreen from './src/screens/DriverDashboardScreen';
import SecurityCentreDashboardScreen from './src/screens/SecurityCentreDashboardScreen';
import FaceVerificationScreen from './src/screens/FaceVerificationScreen';
import TripHistoryScreen from './src/screens/TripHistoryScreen';
import ScheduleScreen from './src/screens/ScheduleRideScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import DriverActiveRideScreen from './src/screens/DriverActiveRideScreen';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';

type RootStackParamList = {
  Landing: undefined;
  Login: undefined;
  CreateAccount: undefined;
  FaceVerification: { fullName?: string; email?: string } | undefined;
  AdminDashboard: undefined;
  DriverDashboard: undefined;
  SecurityDashboard: undefined;
  Home: undefined;
  TestConnection: undefined;
  TripHistory: undefined;
  Schedule: undefined;
  Profile: undefined;
  DriverActiveRide: { requestId: string };
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const [token, rawUser] = await Promise.all([
          AsyncStorage.getItem('authToken'),
          AsyncStorage.getItem('user'),
        ]);

        if (!token || !rawUser) {
          setInitialRoute('Landing');
          return;
        }

        const user = JSON.parse(rawUser);
        switch (user?.role) {
          case 'ADMIN':
            setInitialRoute('AdminDashboard');
            break;
          case 'DRIVER':
            setInitialRoute('DriverDashboard');
            break;
          case 'SECURITY':
            setInitialRoute('SecurityDashboard');
            break;
          default:
            setInitialRoute('Home');
        }
      } catch {
        await AsyncStorage.multiRemove(['authToken', 'user']);
        setInitialRoute('Landing');
      }
    };

    restoreSession();
  }, []);

  if (!initialRoute) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#16A34A" />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <SafeAreaProvider>
        <ToastProvider>
          <NavigationContainer>
            <Stack.Navigator
              id="Main"
              initialRouteName={initialRoute}
              screenOptions={({ navigation, route }) => ({
                cardStyle: { backgroundColor: '#ffffff' },
                headerStyle: { backgroundColor: '#ffffff' },
                headerTitle: '',
                headerShown: route.name !== 'Landing' && route.name !== 'Home',
                headerLeft: ({ canGoBack }) => canGoBack ? (
                  <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    accessibilityLabel="Go back"
                    hitSlop={12}
                    style={{ paddingHorizontal: 18, paddingVertical: 8 }}
                  >
                    <ArrowLeft size={22} color="#1f2937" strokeWidth={2.2} />
                  </TouchableOpacity>
                ) : null,
                headerRight: route.name === 'Login' ? () => (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('CreateAccount')}
                    accessibilityLabel="Continue to create account"
                    hitSlop={12}
                    style={{ paddingHorizontal: 18, paddingVertical: 8 }}
                  >
                    <ArrowRight size={22} color="#16a34a" strokeWidth={2.2} />
                  </TouchableOpacity>
                ) : undefined,
              })}
            >
              <Stack.Screen name="Landing" component={LandingScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
              <Stack.Screen name="FaceVerification" component={FaceVerificationScreen} />
              <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
              <Stack.Screen name="DriverDashboard" component={DriverDashboardScreen} />
              <Stack.Screen name="SecurityDashboard" component={SecurityCentreDashboardScreen} />
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="TestConnection" component={TestConnectionScreen} />
              <Stack.Screen name="TripHistory" component={TripHistoryScreen} />
              <Stack.Screen name="Schedule" component={ScheduleScreen} />
              <Stack.Screen name="Profile" component={ProfileScreen} />
              <Stack.Screen name="DriverActiveRide" component={DriverActiveRideScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
