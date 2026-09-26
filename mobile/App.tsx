import 'react-native-gesture-handler';
import React from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from './src/components/Toast';

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
import PaymentMethodsScreen from './src/screens/PaymentMethodsScreen';
import DriverActiveRideScreen from './src/screens/DriverActiveRideScreen';
import DriverEarningsScreen from './src/screens/DriverEarningsScreen';
import DriverHistoryScreen from './src/screens/DriverHistoryScreen';
import DriverProfileScreen from './src/screens/DriverProfileScreen';
import ViewRideDetailsScreen from './src/screens/ViewRideDetailsScreen';
import RatingDriverScreen from './src/screens/RatingDriverScreen';
import ChatScreen from './src/screens/ChatScreen';
import UserManagementScreen from './src/screens/UserManagementScreen';
import RideMonitoringScreen from './src/screens/RideMonitoringScreen';
import IncidentReportsScreen from './src/screens/IncidentReportsScreen';
import AudioRecordingsScreen from './src/screens/AudioRecordingsScreen';
import ActiveRidesMonitorScreen from './src/screens/ActiveRidesMonitorScreen';
import SosAlertsScreen from './src/screens/SosAlertsScreen';
import ResolvedSosScreen from './src/screens/ResolvedSosScreen';
import UniversitySettingsScreen from './src/screens/UniversitySettingsScreen';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';

type RootStackParamList = {
  Landing: undefined;
  Login: undefined;
  CreateAccount: undefined;
  FaceVerification: { fullName?: string; email?: string } | undefined;
  AdminDashboard: undefined;
  UserManagement: undefined;
  RideMonitoring: undefined;
  IncidentReports: undefined;
  AudioRecordings: { incidentId: number; security?: boolean };
  ActiveRidesMonitor: undefined;
  SosAlerts: undefined;
  ResolvedSos: undefined;
  UniversitySettings: undefined;
  DriverDashboard: undefined;
  SecurityDashboard: undefined;
  Home: { skipActiveRideRestore?: boolean } | undefined;
  TestConnection: undefined;
  TripHistory: undefined;
  Schedule: undefined;
  Profile: undefined;
  PaymentMethods: undefined;
  RiderHistory: undefined;
  RiderSchedule: undefined;
  RiderProfile: undefined;
  RiderPaymentMethods: undefined;
  ViewRideDetails: { requestId: string };
  DriverActiveRide: { requestId: string };
  DriverEarnings: undefined;
  DriverHistory: undefined;
  DriverProfile: undefined;
  RatingDriver: { rideId: string; driverName?: string; returnToHistory?: boolean };
  Chat: { rideId: string; otherPartyName?: string };
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    setInitialRoute('Landing');
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
              <Stack.Screen name="UserManagement" component={UserManagementScreen} />
              <Stack.Screen name="RideMonitoring" component={RideMonitoringScreen} />
              <Stack.Screen name="IncidentReports" component={IncidentReportsScreen} />
              <Stack.Screen name="AudioRecordings" component={AudioRecordingsScreen} />
              <Stack.Screen name="ActiveRidesMonitor" component={ActiveRidesMonitorScreen} />
              <Stack.Screen name="SosAlerts" component={SosAlertsScreen} />
              <Stack.Screen name="ResolvedSos" component={ResolvedSosScreen} />
              <Stack.Screen name="UniversitySettings" component={UniversitySettingsScreen} />
              <Stack.Screen name="DriverDashboard" component={DriverDashboardScreen} />
              <Stack.Screen name="SecurityDashboard" component={SecurityCentreDashboardScreen} />
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="TestConnection" component={TestConnectionScreen} />
              <Stack.Screen name="RiderHistory" component={TripHistoryScreen} />
              <Stack.Screen name="RiderSchedule" component={ScheduleScreen} />
              <Stack.Screen name="RiderProfile" component={ProfileScreen} />
              <Stack.Screen name="RiderPaymentMethods" component={PaymentMethodsScreen} />
              <Stack.Screen name="ViewRideDetails" component={ViewRideDetailsScreen} />
              <Stack.Screen name="DriverActiveRide" component={DriverActiveRideScreen} />
              <Stack.Screen name="DriverEarnings" component={DriverEarningsScreen} />
              <Stack.Screen name="DriverHistory" component={DriverHistoryScreen} />
              <Stack.Screen name="DriverProfile" component={DriverProfileScreen} />
              <Stack.Screen name="RatingDriver" component={RatingDriverScreen} />
              <Stack.Screen name="Chat" component={ChatScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
