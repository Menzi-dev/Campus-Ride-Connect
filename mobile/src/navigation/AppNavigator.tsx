// mobile/src/navigation/AppNavigator.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import LandingScreen from '../screens/LandingScreen';
import LoginScreen from '../screens/LoginScreen';
import CreateAccountScreen from '../screens/CreateAccountScreen';
import FaceVerificationScreen from '../screens/FaceVerificationScreen';
import HomeScreen from '../screens/HomeScreen';
import TripHistoryScreen from '../screens/TripHistoryScreen';
import ScheduleScreen from '../screens/ScheduleRideScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PaymentMethodsScreen from '../screens/PaymentMethodsScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import DriverDashboardScreen from '../screens/DriverDashboardScreen';
import SecurityCentreDashboardScreen from '../screens/SecurityCentreDashboardScreen';
import ViewRideDetailsScreen from '../screens/ViewRideDetailsScreen';
import DriverActiveRideScreen from '../screens/DriverActiveRideScreen';
import DriverEarningsScreen from '../screens/DriverEarningsScreen';
import DriverHistoryScreen from '../screens/DriverHistoryScreen';
import DriverProfileScreen from '../screens/DriverProfileScreen';
import RatingDriverScreen from '../screens/RatingDriverScreen';
import ChatScreen from '../screens/ChatScreen';
import UserManagementScreen from '../screens/UserManagementScreen';
import SosAlertsScreen from '../screens/SosAlertsScreen';
import ResolvedSosScreen from '../screens/ResolvedSosScreen';

type RootStackParamList = {
  Landing: undefined;
  Login: undefined;
  CreateAccount: undefined;
  FaceVerification: { fullName?: string; email?: string } | undefined;
  AdminDashboard: undefined;
  UserManagement: undefined;
  SosAlerts: undefined;
  ResolvedSos: undefined;
  DriverDashboard: undefined;
  SecurityDashboard: undefined;
  Home: { skipActiveRideRestore?: boolean } | undefined;
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

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        id="root"
        initialRouteName="Landing"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
        <Stack.Screen 
          name="FaceVerification" 
          component={FaceVerificationScreen} 
          options={{ headerShown: false, gestureEnabled: false }} 
        />
        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
        <Stack.Screen name="UserManagement" component={UserManagementScreen} />
        <Stack.Screen name="SosAlerts" component={SosAlertsScreen} />
        <Stack.Screen name="ResolvedSos" component={ResolvedSosScreen} />
        <Stack.Screen name="DriverDashboard" component={DriverDashboardScreen} />
        <Stack.Screen name="ViewRideDetails" component={ViewRideDetailsScreen} />
        <Stack.Screen name="DriverActiveRide" component={DriverActiveRideScreen} />
        <Stack.Screen name="DriverEarnings" component={DriverEarningsScreen} />
        <Stack.Screen name="DriverHistory" component={DriverHistoryScreen} />
        <Stack.Screen name="DriverProfile" component={DriverProfileScreen} />
        <Stack.Screen name="RatingDriver" component={RatingDriverScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="SecurityDashboard" component={SecurityCentreDashboardScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="RiderHistory" component={TripHistoryScreen} />
        <Stack.Screen name="RiderSchedule" component={ScheduleScreen} />
        <Stack.Screen name="RiderProfile" component={ProfileScreen} />
        <Stack.Screen name="RiderPaymentMethods" component={PaymentMethodsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}